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
 * ████████████████████████ #server/api/leagues/[leagueId]/games/[gameId].get.database.test.ts █████████████████████████
 *
 * The result read run against real migrations, real services and a real driver, where mocked instants cannot hide a
 * boundary.
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
import type { EventHandler, H3Event } from 'h3';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { GameCreator, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { IResultSubmission } from '#shared/results';
import { ResultEnding, ResultState, Seat } from '#shared/results';
import { GameType } from '#shared/rules-engine';

import type { IInteractiveTransaction } from '../../../../utils/db/types';
import { SETTLEMENT_BATCH } from '../../../../utils/results/constants';
import { ResultRefusal } from '../../../../utils/results/enums';
import type { TResultOutcome } from '../../../../utils/results/types';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The handles the mocked database module hands back, filled once PGlite is up
 * @internal
 * @constant
 */
const refs = vi.hoisted((): { client: PGlite | undefined; database: unknown } => ({
  client: undefined,
  database: undefined,
}));

vi.mock('#utils/db', (): Record<string, unknown> => ({
  useDatabase: (): unknown => refs.database,
  useResultTransaction: async <TResult>(
    body: (transaction: IInteractiveTransaction) => Promise<TResult>,
  ): Promise<TResult> => {
    const client: PGlite = refs.client!;
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
  },
}));

/**
 * Where the real migrations live
 * @internal
 * @constant
 */
const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../../../../db/migrations', import.meta.url));

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
let ids: Record<string, string> = {};

/**
 * The account the request is made as
 * @internal
 */
let viewerId: string = '';

vi.stubGlobal(
  'defineEventHandler',
  vi.fn((handler: EventHandler): EventHandler => handler),
);
vi.stubGlobal(
  'requireUserSession',
  vi.fn(async (): Promise<{ user: { id: string } }> => ({ user: { id: viewerId } })),
);
vi.stubGlobal('setResponseHeader', vi.fn());

/**
 * The real handler, with only the database and the session replaced
 * @internal
 * @constant
 */
const { default: handler }: { default: EventHandler } = await import('./[gameId].get');

/**
 * The real service, used to build fixtures the way the product builds them
 * @internal
 * @constant
 */
const { recordResult } = await import('../../../../utils/results/utils');

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
 * The league's settings
 * @internal
 * @function
 * @returns The settings
 */
function settingsFixture(): TLeagueSettings {
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
  };
}

/**
 * Seeds a league with a roster: the first name is its commissioner, the rest are players
 * @internal
 * @async
 * @function
 * @param names - The display names to seed
 */
async function seedLeague(names: string[]): Promise<void> {
  ids = {};

  for (const name of names) {
    // A completed profile, because league access requires an eligible account and an unfinished one is not
    const [row] = await read<{ id: string }>(
      `INSERT INTO "users" ("email", "display_name", "profile_completed_at")
       VALUES ($1, $2, now()) RETURNING "id"`,
      [`${name.toLowerCase()}@example.com`, name],
    );

    ids[name] = row!.id;
  }

  await read(
    `INSERT INTO "leagues" ("id", "name", "abbreviation", "settings", "created_by")
     VALUES ($1, 'Friday Ladder', 'FRI', $2, $3)`,
    [LEAGUE_ID, JSON.stringify(settingsFixture()), ids[names[0]!]!],
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
 * Records one singles result and answers with the match it created
 * @internal
 * @async
 * @function
 * @param index - Which fixture this is, so no two look like the same match played twice
 * @returns The canonical match id
 */
async function recordOne(index: number): Promise<string> {
  const submission: IResultSubmission = {
    ending: ResultEnding.COMPLETED,
    gameType: GameType.SINGLES,
    games: [
      {
        a: 11,
        b: index % 9,
        gameNumber: 1,
      },
    ],
    // Distinct play times, or the service warns that this looks like a result somebody already recorded — which is
    // the correct behaviour, and exactly what a fixture of 51 identical matches would be asking for. Minutes apart
    // rather than hours, so every one of them stays inside the league's 48-hour entry window
    playedAt: new Date(Date.now() - (index + 2) * 60 * 1000).toISOString(),
    retiredSeat: null,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: ids.Ada!,
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: ids.Ben!,
      },
    ],
  };

  const operation: string = randomUUID();
  const attempt = async (acknowledgement: string | null): Promise<TResultOutcome> =>
    inTransaction((transaction) =>
      recordResult(transaction, ids.Ada!, {
        acknowledgement,
        clientOperationId: operation,
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission,
      }),
    );

  // A league of near-identical matches between the same pair is what this fixture needs and also exactly what the
  // duplicate warning is for, so the fixture answers it the way a person would: shown the candidates, record anyway
  let outcome: TResultOutcome = await attempt(null);

  if (!outcome.ok && outcome.refusal === ResultRefusal.PROBABLE_DUPLICATE) {
    outcome = await attempt(outcome.details?.acknowledgement ?? null);
  }

  if (!outcome.ok) {
    throw new Error(`fixture could not record a result: ${outcome.refusal}`);
  }

  return outcome.value.canonicalMatchId;
}

/**
 * Builds an event naming a league and a game
 * @internal
 * @function
 * @param gameId - The match to read
 * @returns The event
 */
function buildEvent(gameId: string): H3Event {
  return { context: { params: { gameId, leagueId: LEAGUE_ID } }, node: { res: {} } } as unknown as H3Event;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeAll(async (): Promise<void> => {
    client = new PGlite();
    refs.client = client;
    refs.database = drizzle(client);

    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    await seedLeague(['Ada', 'Ben']);

    viewerId = ids.Ada!;
  }, 120_000);

  afterAll(async (): Promise<void> => {
    await client.close();
  });

  it('calls a result the bounded sweep could not reach outstanding', async (): Promise<void> => {
    // The defect this covers is not in any one function: settleDueResults is bounded and correct, and the route's
    // flag is correct, but a route that inferred "caught up" from a sweep that resolved rendered an overdue
    // result as ordinarily pending. Only running them together shows it
    const overdue: string[] = [];

    for (let index = 0; index < SETTLEMENT_BATCH + 1; index += 1) {
      overdue.push(await recordOne(index));
    }

    const target: string = overdue.at(-1)!;

    // The sweep takes the earliest deadlines first, so the target is given the latest one and every other result
    // is given an earlier one. All of them are in the past
    await read(`UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '2 hours' WHERE "is_current"`);
    await read(
      `UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute'
         WHERE "is_current" AND "canonical_match_id" = $1`,
      [target],
    );

    const answered = (await handler(buildEvent(target))) as {
      match: { state: ResultState };
      settlementFailed: boolean;
      settlementOutstanding: boolean;
    };

    expect(answered.settlementFailed).toBe(false);
    expect(answered.match.state).toBe(ResultState.UNCONFIRMED);
    expect(answered.settlementOutstanding).toBe(true);
  }, 120_000);

  it('settles and stops calling it outstanding once the sweep reaches it', async (): Promise<void> => {
    // The first read cleared a batch; this one reaches the target, which proves the flag tracks the result rather
    // than latching, and that the deadline arithmetic runs on a real driver's value
    const [row] = await read<{ id: string }>(
      `SELECT "canonical_match_id" AS "id" FROM "result_revisions"
       WHERE "is_current" AND "state" = 'UNCONFIRMED' ORDER BY "confirmation_deadline" DESC LIMIT 1`,
    );

    const answered = (await handler(buildEvent(row!.id))) as {
      match: { state: ResultState };
      settlementOutstanding: boolean;
    };

    expect(answered.match.state).toBe(ResultState.CONFIRMED);
    expect(answered.settlementOutstanding).toBe(false);
  }, 120_000);
});
