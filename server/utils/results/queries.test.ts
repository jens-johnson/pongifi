/**
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 *
 *                                  ██████╗  ██████╗ ███╗   ██╗ ██████╗ ██╗███████╗██╗
 *                                  ██╔══██╗██╔═══██╗████╗  ██║██╔════╝ ██║██╔════╝██║
 *                                  ██████╔╝██║   ██║██╔██╗ ██║██║  ███╗██║█████╗  ██║
 *                                  ██╔═══╝ ██║   ██║██║╚██╗██║██║   ██║██║██╔══╝  ██║
 *                                  ██║     ╚██████╔╝██║ ╚████║╚██████╔╝██║██║     ██║
 *                                  ╚═╝      ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚═╝╚═╝     ╚═╝
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 * ███████████████████████████████████████ #server/utils/results/queries.test.ts ███████████████████████████████████████
 *
 * Unit tests for the match read, against the real migrations on PGlite.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import type { QueryResult, QueryResultRow } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameCreator, LeagueRole, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { IMatchView, IResultSubmission } from '#shared/results';
import { DELETED_ACCOUNT_NAME, ResultAction, ResultEnding, ResultState, Seat, SideSatisfaction } from '#shared/results';
import { GameType, Side } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import type { IInteractiveTransaction } from '../db/types';
import { HOUR_MS } from './constants';
import type { IResultEffect, TResultOutcome } from './types';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The handle the mocked database module hands back
 * @internal
 * @constant
 */
const databaseRef = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('#utils/db', (): Record<string, unknown> => ({ useDatabase: (): unknown => databaseRef.current }));

const { readMatchView } = await import('./queries');
const { answerResult, recordResult } = await import('./utils');

/**
 * Where the checked-in migrations live
 * @internal
 * @constant
 */
const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/**
 * The league every fixture is built in
 * @internal
 * @constant
 */
const LEAGUE_ID: string = '11111111-1111-1111-1111-111111111111';

/**
 * The database under test
 * @internal
 */
let client: PGlite;

/**
 * The accounts the fixture seated, by display name
 * @internal
 */
let ids: Record<string, string>;

/**
 * Runs one statement outside any transaction
 * @internal
 * @async
 * @function
 * @param text - The statement
 * @param values - The values to bind
 * @returns The rows
 */
async function read<TRow extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<TRow[]> {
  const { rows } = await client.query<TRow>(text, values);

  return rows;
}

/**
 * Runs a body inside a real transaction on the single PGlite session
 * @internal
 * @async
 * @function
 * @param body - What to run inside it
 * @returns The body's value
 */
async function inTransaction<TResult>(
  body: (transaction: IInteractiveTransaction) => Promise<TResult>,
): Promise<TResult> {
  const transaction: IInteractiveTransaction = {
    query: async <TRow extends QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<TRow>> =>
      (await client.query<TRow>(text, values)) as unknown as QueryResult<TRow>,
  };

  await client.query('BEGIN');

  try {
    const value: TResult = await body(transaction);

    await client.query('COMMIT');

    return value;
  } catch (error: unknown) {
    await client.query('ROLLBACK');

    throw error;
  }
}

/**
 * The league's settings, varied per fixture
 * @internal
 * @function
 * @param overrides - What this fixture changes
 * @returns The settings
 */
function settingsFixture(overrides: Partial<TLeagueSettings> = {}): TLeagueSettings {
  return {
    allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES],
    cutthroatTimeCap: 0,
    expediteEnabled: false,
    matchFormat: 1,
    provisionalGames: 5,
    ratingEnabled: true,
    requireConfirmation: true,
    resultAmendmentWindow: 48,
    resultConfirmationWindow: 24,
    serviceInterval: 2,
    targetScore: {
      [GameType.CUTTHROAT]: 15,
      [GameType.DOUBLES]: 11,
      [GameType.SINGLES]: 11,
    },
    walkoverGracePeriod: 15,
    whoCanCreateGames: GameCreator.PLAYER,
    whoCanRecordResults: ResultRecorder.PARTICIPANTS,
    winningMargin: 2,
    ...overrides,
  };
}

/**
 * Seeds a league with a roster: the first name is its commissioner, the rest are players
 * @internal
 * @async
 * @function
 * @param names - The display names to seed
 * @param settings - The league's settings
 */
async function seedLeague(names: string[], settings: TLeagueSettings = settingsFixture()): Promise<void> {
  ids = {};

  for (const name of names) {
    const [row] = await read<{ id: string }>(
      'INSERT INTO "users" ("email", "display_name") VALUES ($1, $2) RETURNING "id"',
      [`${name.toLowerCase()}@example.com`, name],
    );

    ids[name] = row!.id;
  }

  await read(
    `INSERT INTO "leagues" ("id", "name", "abbreviation", "settings", "created_by")
     VALUES ($1, 'Friday Ladder', 'FRI', $2, $3)`,
    [LEAGUE_ID, JSON.stringify(settings), ids[names[0]!]!],
  );

  for (const [index, name] of names.entries()) {
    await read(`INSERT INTO "memberships" ("league_id", "user_id", "role", "status") VALUES ($1, $2, $3, 'ACTIVE')`, [
      LEAGUE_ID,
      ids[name]!,
      index === 0 ? 'COMMISSIONER' : 'PLAYER',
    ]);
  }
}

/**
 * A singles submission
 * @internal
 * @function
 * @param seats - The two accounts
 * @param overrides - What the case changes
 * @returns The submission
 */
function singles(seats: [string, string], overrides: Partial<IResultSubmission> = {}): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: GameType.SINGLES,
    games: [
      {
        a: 11,
        b: 4,
        gameNumber: 1,
      },
    ],
    playedAt: new Date(Date.now() - HOUR_MS).toISOString(),
    retiredSeat: null,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: seats[0],
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: seats[1],
      },
    ],
    ...overrides,
  };
}

/**
 * Records a result and answers with the match it created
 * @internal
 * @async
 * @function
 * @param recorder - Who records it
 * @param submission - What they entered
 * @returns The canonical match id
 */
async function record(recorder: string, submission: IResultSubmission): Promise<string> {
  const outcome: TResultOutcome = await inTransaction((transaction) =>
    recordResult(transaction, recorder, {
      clientOperationId: randomUUID(),
      expectedLeagueRevision: 1,
      leagueId: LEAGUE_ID,
      submission,
    }),
  );

  if (!outcome.ok) {
    throw new Error(`the fixture could not record: ${outcome.refusal}`);
  }

  return (outcome.value as IResultEffect).canonicalMatchId;
}

/**
 * Reads a match as one account sees it
 * @internal
 * @async
 * @function
 * @param match - The match
 * @param viewer - Who is looking
 * @param role - The role they hold
 * @returns The view
 */
async function view(match: string, viewer: string, role: LeagueRole = LeagueRole.PLAYER): Promise<IMatchView> {
  const found: IMatchView | null = await readMatchView(LEAGUE_ID, match, viewer, role);

  if (!found) {
    throw new Error('the fixture match could not be read');
  }

  return found;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeAll(async (): Promise<void> => {
    client = new PGlite();
    databaseRef.current = drizzle(client);

    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  });

  beforeEach(async (): Promise<void> => {
    await read(`TRUNCATE "result_revisions", "games", "rating_generations", "memberships", "leagues", "users" CASCADE`);
    await seedLeague(['Ada', 'Ben', 'Cara']);
  });

  afterAll(async (): Promise<void> => {
    await client.close();
  });

  describe(symbolName(readMatchView), (): void => {
    it('reads a recorded match as the page states it', async (): Promise<void> => {
      const match: string = await record(ids.Ada!, singles([ids.Ada!, ids.Ben!]));
      const page: IMatchView = await view(match, ids.Ben!);

      expect(page.state).toBe(ResultState.UNCONFIRMED);
      expect(page.games).toEqual([
        {
          a: 11,
          b: 4,
          gameNumber: 1,
          retired: false,
          winner: Side.A,
        },
      ]);
      expect(page.gamesWon).toEqual({ a: 1, b: 0 });
      expect(page.rules).toEqual({
        matchFormat: 1,
        targetScore: 11,
        winningMargin: 2,
      });
      expect(page.recordedBy.displayName).toBe('Ada');
    });

    it('says which side is waiting, and which answered by recording', async (): Promise<void> => {
      const match: string = await record(ids.Ada!, singles([ids.Ada!, ids.Ben!]));
      const page: IMatchView = await view(match, ids.Ben!);
      const waiting = page.sides.find((side): boolean => side.satisfiedBy === SideSatisfaction.PENDING);

      expect(page.sides.find((side): boolean => side.side === Side.A)?.satisfiedBy).toBe(SideSatisfaction.SUBMISSION);
      expect(waiting?.confirmers.map((confirmer): string => confirmer.displayName)).toEqual(['Ben']);
    });

    it('offers each viewer only what their role and seat allow', async (): Promise<void> => {
      const match: string = await record(ids.Ada!, singles([ids.Ada!, ids.Ben!]));
      const opponent: IMatchView = await view(match, ids.Ben!);
      const recorder: IMatchView = await view(match, ids.Ada!);
      const stranger: IMatchView = await view(match, ids.Cara!);
      const commissioner: IMatchView = await view(match, ids.Cara!, LeagueRole.COMMISSIONER);

      // The opponent owes the answer; the recorder may object to their own entry but not confirm it
      expect([opponent.viewer.mayConfirm, opponent.viewer.mayDispute]).toEqual([true, true]);
      expect([recorder.viewer.mayConfirm, recorder.viewer.mayDispute]).toEqual([false, true]);
      // A player who was not in it has nothing to do with it; an administrator may always void
      expect([stranger.viewer.mayConfirm, stranger.viewer.mayDispute, stranger.viewer.mayVoid]).toEqual([
        false,
        false,
        false,
      ]);
      expect(commissioner.viewer.mayVoid).toBe(true);
    });

    it('shows the rating each member took from the active generation once it is accepted', async (): Promise<void> => {
      const match: string = await record(ids.Ada!, singles([ids.Ada!, ids.Ben!]));

      await inTransaction((transaction) =>
        answerResult(transaction, ids.Ben!, {
          action: ResultAction.CONFIRM,
          canonicalMatchId: match,
          clientOperationId: randomUUID(),
          expectedRevision: 1,
          note: null,
        }),
      );

      const page: IMatchView = await view(match, ids.Ben!);
      const winner = page.participants.find((participant): boolean => participant.identity.displayName === 'Ada');
      const loser = page.participants.find((participant): boolean => participant.identity.displayName === 'Ben');

      expect(page.state).toBe(ResultState.CONFIRMED);
      expect(winner?.rating?.delta).toBeGreaterThan(0);
      expect(loser?.rating?.delta).toBeLessThan(0);
      expect(winner?.rating?.before).toBe(1200);
      // The confirmation that answered the side is checked against the member who gave it
      expect(loser?.confirmed).toBe(true);
      expect(winner?.confirmed).toBe(false);
    });

    it('says a guest game is unrated, and why', async (): Promise<void> => {
      const match: string = await record(
        ids.Ada!,
        singles([ids.Ada!, ids.Ben!], {
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ids.Ada!,
            },
            {
              guestName: 'Priya',
              seat: Seat.B1,
              userId: null,
            },
          ],
        }),
      );
      const page: IMatchView = await view(match, ids.Ada!);

      expect(page.rating).toEqual({ rated: false, unratedReason: 'GUEST' });
      expect(page.participants.map((participant): boolean => participant.identity.guest)).toEqual([false, true]);
    });

    it('names a deleted account as deleted wherever it would have named them', async (): Promise<void> => {
      const match: string = await record(ids.Ada!, singles([ids.Ada!, ids.Ben!]));

      await read(`UPDATE "users" SET "deleted_at" = now() WHERE "id" = $1`, [ids.Ben!]);

      const page: IMatchView = await view(match, ids.Ada!);
      const opponent = page.participants.find((participant): boolean => participant.side === Side.B);
      const waiting = page.sides.find((side): boolean => side.satisfiedBy === SideSatisfaction.PENDING);

      expect(opponent?.identity.displayName).toBe(DELETED_ACCOUNT_NAME);
      expect(opponent?.identity.removed).toBe(true);
      // The side still owes its answer, and still names who owed it
      expect(waiting?.confirmers[0]?.displayName).toBe(DELETED_ACCOUNT_NAME);
    });

    it('answers nothing for a match that belongs to another league', async (): Promise<void> => {
      const match: string = await record(ids.Ada!, singles([ids.Ada!, ids.Ben!]));

      expect(
        await readMatchView('22222222-2222-4222-8222-222222222222', match, ids.Ada!, LeagueRole.PLAYER),
      ).toBeNull();
    });
  });
});
