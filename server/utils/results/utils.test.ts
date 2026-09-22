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
 * ████████████████████████████████████████ #server/utils/results/utils.test.ts ████████████████████████████████████████
 *
 * Unit tests for the result operations, run against the real migrations on PGlite.
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { GameCreator, ResultRecorder } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { IResultSeat, IResultSubmission } from '#shared/results';
import {
  MAX_ENTERED_SCORE,
  MAX_GUEST_NAME_LENGTH,
  ResultAction,
  ResultEnding,
  ResultState,
  Seat,
  SideSatisfaction,
} from '#shared/results';
import { GameType } from '#shared/rules-engine';
import { symbolName } from '#shared/utils/symbol';

import type { IInteractiveTransaction } from '../db/types';
import { HOUR_MS } from './constants';
import { ResultRefusal } from './enums';
import type { IResultEffect, TResultOutcome } from './types';
import {
  amendResult,
  answerResult,
  recordResult,
  redactNotesForAccount,
  resolveMatchRoute,
  settleDueResults,
} from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

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
 * The words a privacy case looks for, and looks for the absence of
 * @internal
 * @constant
 */
const NOTE: string = 'Cara called the let, not me';

/**
 * The PGlite instance every case runs against, migrated once
 * @internal
 */
let client: PGlite;

/**
 * The accounts seeded for the current case, by display name
 * @internal
 */
let ids: Record<string, string>;

/**
 * A league's settings, varied per fixture
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
 * Runs one statement outside any transaction the service opened, for seeding and for reading a case's result back
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
 * Runs a body inside a real transaction on the single PGlite session.
 *
 * The service's own surface, so nothing under test is adapted for the test: `FOR UPDATE`, `FOR SHARE`, savepoints and
 * `clock_timestamp()` all behave as they do on the deployed driver. What one session cannot do is hold two
 * transactions at once, which is why every genuinely concurrent case lives in the spike harness instead
 * @internal
 * @async
 * @function
 * @param body - What to run inside the transaction
 * @throws Whatever the body throws, after the transaction is rolled back
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
 * What every case starts from: the tables a case writes, emptied rather than rebuilt. The migrations are the slow
 * part, and each case seeds the roster it needs
 * @internal
 * @constant
 */
const EMPTIED: string = `TRUNCATE "result_revisions", "games", "rating_generations", "memberships", "leagues", "users" CASCADE`;

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
 * Who sits in one doubles seat: an account id, or a guest nobody can answer for
 * @internal
 */
type TOccupant = string | { guest: string };

/**
 * One side of a revision as the database stored it
 * @internal
 */
interface ISideRow {
  /* Who confirmed for this side, when somebody did */
  confirmedBy: string | null;

  /* The accounts frozen as eligible to answer for it */
  confirmers: string[];

  /* How it came to be satisfied, or that it is still pending */
  satisfiedBy: string;
}

/**
 * The seats a doubles fixture fills, in the order its occupants are given
 * @internal
 * @constant
 */
const DOUBLES_ORDER: readonly Seat[] = [Seat.A1, Seat.A2, Seat.B1, Seat.B2];

/**
 * How far apart two fixture matches are placed, which is past the thirty minutes a probable duplicate is judged
 * within
 * @internal
 * @constant
 */
const DISTINCT_MATCH_MS: number = 45 * 60 * 1000;

/**
 * How many of those places there are before they are reused, which keeps every fixture inside a default entry window
 * @internal
 * @constant
 */
const DISTINCT_MATCH_SLOTS: number = 24;

/**
 * How many fixture matches have been built, so each one takes its own place in the day
 * @internal
 */
let played: number = 0;

/**
 * A play time far enough from the last fixture's to be a different match.
 *
 * Every fixture match would otherwise be entered at the same instant with the same seats and the same scores, which
 * is the definition of a probable duplicate — the rule would refuse the second one, correctly, and the case would be
 * about the fixture rather than about what it meant to test. Each call steps back past the duplicate window
 * @internal
 * @function
 * @returns The play time, as an instant
 */
function nextPlayedAt(): string {
  played += 1;

  // Wrapped, so a long run of fixtures cannot walk the play time out of the entry window the league allows and turn
  // every later case into a refusal about its own fixture
  return new Date(Date.now() - HOUR_MS - (played % DISTINCT_MATCH_SLOTS) * DISTINCT_MATCH_MS).toISOString();
}

/**
 * A singles submission. The play time defaults to an hour ago, inside every league fixture's entry window
 * @internal
 * @function
 * @param rows - The scores, as `[a, b]` pairs
 * @param seats - The two accounts, either of which may be a guest label
 * @param overrides - What the case changes
 * @returns The submission
 */
function singles(
  rows: [number, number][],
  seats: [string, string],
  overrides: Partial<IResultSubmission> = {},
): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: GameType.SINGLES,
    games: rows.map(([a, b], index: number) => ({
      a: a!,
      b: b!,
      gameNumber: index + 1,
    })),
    playedAt: nextPlayedAt(),
    retiredSeat: null,
    seats: [
      {
        guestName: null,
        seat: Seat.A1,
        userId: seats[0]!,
      },
      {
        guestName: null,
        seat: Seat.B1,
        userId: seats[1]!,
      },
    ],
    ...overrides,
  };
}

/**
 * Empties the database and seeds a different roster, for a case that needs more accounts than the default three
 * @internal
 * @async
 * @function
 * @param names - The display names to seed, the first as commissioner
 */
async function reseed(names: string[]): Promise<void> {
  await read(EMPTIED);
  await seedLeague(names);
}

/**
 * A doubles submission seating A1, A2, B1 and B2 in that order.
 *
 * An account id seats that account; a `{ guest }` seats somebody who has none, which is how a side with nobody to
 * answer for it is expressed
 * @internal
 * @function
 * @param occupants - Who sits in each of the four seats
 * @returns The submission
 */
function doubles(occupants: [TOccupant, TOccupant, TOccupant, TOccupant]): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: GameType.DOUBLES,
    games: [
      {
        a: 11,
        b: 4,
        gameNumber: 1,
      },
    ],
    playedAt: nextPlayedAt(),
    retiredSeat: null,
    seats: DOUBLES_ORDER.map((seat: Seat, index: number): IResultSeat => {
      const occupant: TOccupant = occupants[index]!;

      return {
        guestName: typeof occupant === 'string' ? null : occupant.guest,
        seat,
        userId: typeof occupant === 'string' ? occupant : null,
      };
    }),
  };
}

/**
 * How each side of a revision stands, and who was frozen as eligible to answer for it
 * @internal
 * @async
 * @function
 * @param match - The canonical match id
 * @param revision - Which revision to read
 * @returns One entry per side, keyed by the side
 */
async function sidesOf(match: string, revision: number = 1): Promise<Record<string, ISideRow>> {
  const rows = await read<{ confirmed_by: string | null; confirmers: string[]; satisfied_by: string; side: string }>(
    `SELECT s."side", s."satisfied_by", s."confirmed_by_user_id" AS "confirmed_by",
            coalesce(array_agg(c."user_id" ORDER BY c."user_id") FILTER (WHERE c."user_id" IS NOT NULL), '{}') AS "confirmers"
     FROM "result_revision_sides" s
     JOIN "result_revisions" r ON r."id" = s."result_revision_id"
     LEFT JOIN "result_side_confirmers" c
       ON c."result_revision_id" = s."result_revision_id" AND c."side" = s."side"
     WHERE r."canonical_match_id" = $1 AND r."revision" = $2
     GROUP BY s."side", s."satisfied_by", s."confirmed_by_user_id"`,
    [match, revision],
  );

  return Object.fromEntries(
    rows.map((row): [string, ISideRow] => [
      row.side,
      {
        confirmedBy: row.confirmed_by,
        confirmers: [...row.confirmers].sort(),
        satisfiedBy: row.satisfied_by,
      },
    ]),
  );
}

/**
 * Gives an account a role in the seeded league, for the cases about who may void
 * @internal
 * @async
 * @function
 * @param userId - The account
 * @param role - The role they now hold
 */
async function setRole(userId: string, role: string): Promise<void> {
  await read(`UPDATE "memberships" SET "role" = $1 WHERE "user_id" = $2 AND "league_id" = $3`, [
    role,
    userId,
    LEAGUE_ID,
  ]);
}

/**
 * Records a result in its own transaction
 * @internal
 * @async
 * @function
 * @param actor - Who records it
 * @param submission - What they entered
 * @param overrides - What the case changes about the request
 * @returns What the write answered
 */
async function record(
  actor: string,
  submission: IResultSubmission,
  overrides: { clientOperationId?: string; expectedLeagueRevision?: number } = {},
): Promise<TResultOutcome> {
  return inTransaction((transaction) =>
    recordResult(transaction, actor, {
      clientOperationId: overrides.clientOperationId ?? randomUUID(),
      expectedLeagueRevision: overrides.expectedLeagueRevision ?? 1,
      leagueId: LEAGUE_ID,
      submission,
    }),
  );
}

/**
 * Answers a result in its own transaction
 * @internal
 * @async
 * @function
 * @param actor - Who answers
 * @param action - Confirm, dispute or void
 * @param match - The match
 * @param overrides - What the case changes about the request
 * @returns What the write answered
 */
async function answer(
  actor: string,
  action: ResultAction,
  match: string,
  overrides: { clientOperationId?: string; expectedRevision?: number; note?: string | null } = {},
): Promise<TResultOutcome> {
  return inTransaction((transaction) =>
    answerResult(transaction, actor, {
      action,
      canonicalMatchId: match,
      clientOperationId: overrides.clientOperationId ?? randomUUID(),
      expectedRevision: overrides.expectedRevision ?? 1,
      note: overrides.note ?? null,
    }),
  );
}

/**
 * Corrects a result in its own transaction
 * @internal
 * @async
 * @function
 * @param actor - Who corrects it
 * @param match - The match
 * @param submission - The corrected entry
 * @param overrides - What the case changes about the request
 * @returns What the write answered
 */
async function amend(
  actor: string,
  match: string,
  submission: IResultSubmission,
  overrides: { clientOperationId?: string; expectedRevision?: number } = {},
): Promise<TResultOutcome> {
  return inTransaction((transaction) =>
    amendResult(transaction, actor, {
      canonicalMatchId: match,
      clientOperationId: overrides.clientOperationId ?? randomUUID(),
      expectedRevision: overrides.expectedRevision ?? 1,
      submission,
    }),
  );
}

/**
 * The effect a write must have had, failing the case loudly when it was refused instead
 * @internal
 * @function
 * @param outcome - What the write answered
 * @throws Error when the write was refused
 * @returns The effect
 */
function effectOf(outcome: TResultOutcome): IResultEffect {
  if (!outcome.ok) {
    throw new Error(`the write was refused as ${outcome.refusal}`);
  }

  return outcome.value;
}

/**
 * Records a result nobody has answered yet, and returns its match
 * @internal
 * @async
 * @function
 * @param recorder - Who records it
 * @param seats - The two seated accounts
 * @returns The canonical match id
 */
async function pending(recorder: string, seats: [string, string]): Promise<string> {
  return effectOf(await record(recorder, singles([[11, 4]], seats))).canonicalMatchId;
}

/**
 * Records a result and disputes it, which is the only state this slice amends from
 * @internal
 * @async
 * @function
 * @param recorder - Who records it
 * @param seats - The two seated accounts
 * @param note - The words the dispute carries
 * @returns The canonical match id
 */
async function disputed(recorder: string, seats: [string, string], note: string | null = null): Promise<string> {
  const match: string = await pending(recorder, seats);

  effectOf(await answer(seats[0] === recorder ? seats[1] : seats[0], ResultAction.DISPUTE, match, { note }));

  return match;
}

/**
 * Marks an account deleted and removes its membership, the way account deletion will
 * @internal
 * @async
 * @function
 * @param userId - The account
 */
async function deleteAccount(userId: string): Promise<void> {
  await read(`UPDATE "users" SET "deleted_at" = now() WHERE "id" = $1`, [userId]);
  await read(`DELETE FROM "memberships" WHERE "user_id" = $1`, [userId]);
}

/**
 * The refusal a write answered with, or the word none when it did not refuse
 * @internal
 * @function
 * @param outcome - What the write answered
 * @returns The refusal
 */
function refusalOf(outcome: TResultOutcome): ResultRefusal | 'none' {
  return outcome.ok ? 'none' : outcome.refusal;
}

/**
 * The window a refusal states back, for the two bounds whose sentence names one
 * @internal
 * @function
 * @param outcome - What the write answered
 * @returns The window in hours, or null when the refusal carried none
 */
function windowOf(outcome: TResultOutcome): number | null {
  return outcome.ok ? null : (outcome.details?.windowHours ?? null);
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeAll(async (): Promise<void> => {
    client = new PGlite();

    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  });

  beforeEach(async (): Promise<void> => {
    await read(EMPTIED);
    await seedLeague(['Ada', 'Ben', 'Cara']);

    // Each case places its matches from the same start, so a long file cannot drift its fixtures out of the window
    played = 0;
  });

  afterAll(async (): Promise<void> => {
    await client.close();
  });

  describe(symbolName(recordResult), (): void => {
    it('addresses the match by revision one’s first game, and leaves a one-game match standalone', async (): Promise<void> => {
      const effect: IResultEffect = effectOf(await record(ids.Ada!, singles([[11, 4]], [ids.Ada!, ids.Ben!])));
      const rows = await read<{ id: string; match_id: string | null }>(
        `SELECT "id", "match_id" FROM "games" ORDER BY "game_number"`,
      );

      expect(rows).toHaveLength(1);
      expect(effect.canonicalMatchId).toBe(rows[0]!.id);
      expect(rows[0]!.match_id).toBeNull();
      expect(effect.resultRevisionId).not.toBe(effect.canonicalMatchId);
    });

    it('groups a best-of-three under the canonical id and keeps it as the match address', async (): Promise<void> => {
      await read(`UPDATE "leagues" SET "settings" = $1 WHERE "id" = $2`, [
        JSON.stringify(settingsFixture({ matchFormat: 3 })),
        LEAGUE_ID,
      ]);

      const effect: IResultEffect = effectOf(
        await record(
          ids.Ada!,
          singles(
            [
              [11, 4],
              [9, 11],
              [11, 8],
            ],
            [ids.Ada!, ids.Ben!],
          ),
        ),
      );
      const rows = await read<{ id: string; match_id: string | null }>(
        `SELECT "id", "match_id" FROM "games" ORDER BY "game_number"`,
      );

      expect(rows).toHaveLength(3);
      expect(effect.canonicalMatchId).toBe(rows[0]!.id);
      expect(rows.every((row): boolean => row.match_id === effect.canonicalMatchId)).toBe(true);
    });

    it('stamps a result born confirmed with the time it was submitted, not the time it was played', async (): Promise<void> => {
      await read(`UPDATE "leagues" SET "settings" = $1 WHERE "id" = $2`, [
        JSON.stringify(settingsFixture({ requireConfirmation: false })),
        LEAGUE_ID,
      ]);

      const playedAt: string = new Date(Date.now() - 6 * HOUR_MS).toISOString();

      await record(ids.Ada!, singles([[11, 4]], [ids.Ada!, ids.Ben!], { playedAt }));

      const [row] = await read<{ confirmed_at: Date; ended_at: Date; submitted_at: Date }>(
        `SELECT g."confirmed_at", g."ended_at", r."submitted_at"
         FROM "games" g JOIN "result_revisions" r ON r."id" = g."result_revision_id"`,
      );

      expect(row!.ended_at.toISOString()).toBe(playedAt);
      expect(row!.confirmed_at.getTime()).toBe(row!.submitted_at.getTime());
      expect(row!.confirmed_at.getTime()).toBeGreaterThan(row!.ended_at.getTime());
    });

    it('refuses a retry once the recorder has lost their membership, disclosing no receipt', async (): Promise<void> => {
      const clientOperationId: string = randomUUID();
      const submission: IResultSubmission = singles([[11, 4]], [ids.Ada!, ids.Ben!]);
      const first: IResultEffect = effectOf(await record(ids.Ada!, submission, { clientOperationId }));

      await read(`DELETE FROM "memberships" WHERE "user_id" = $1`, [ids.Ada!]);

      const retry: TResultOutcome = await record(ids.Ada!, submission, { clientOperationId });

      expect(refusalOf(retry)).toBe(ResultRefusal.NOT_FOUND);
      expect(JSON.stringify(retry)).not.toContain(first.resultRevisionId);
    });

    it('refuses a retry once the recorder’s account is deleted', async (): Promise<void> => {
      const clientOperationId: string = randomUUID();
      const submission: IResultSubmission = singles([[11, 4]], [ids.Ada!, ids.Ben!]);

      effectOf(await record(ids.Ada!, submission, { clientOperationId }));
      await read(`UPDATE "users" SET "deleted_at" = now() WHERE "id" = $1`, [ids.Ada!]);

      expect(refusalOf(await record(ids.Ada!, submission, { clientOperationId }))).toBe(ResultRefusal.NOT_FOUND);
    });

    it('answers a retry with the original effect and the revision that is current now', async (): Promise<void> => {
      const clientOperationId: string = randomUUID();
      const submission: IResultSubmission = singles([[11, 4]], [ids.Ada!, ids.Ben!]);
      const first: IResultEffect = effectOf(await record(ids.Ada!, submission, { clientOperationId }));

      effectOf(await answer(ids.Ben!, ResultAction.DISPUTE, first.canonicalMatchId));
      effectOf(await amend(ids.Ada!, first.canonicalMatchId, singles([[11, 6]], [ids.Ada!, ids.Ben!])));

      const retry: TResultOutcome = await record(ids.Ada!, submission, { clientOperationId });

      expect(retry.ok).toBe(true);

      if (retry.ok) {
        expect(retry.replayed).toBe(true);
        expect(retry.value.revision).toBe(1);
        expect(retry.value.resultRevisionId).toBe(first.resultRevisionId);
        expect(retry.current.revision).toBe(2);
        expect(retry.current.resultRevisionId).not.toBe(first.resultRevisionId);
        expect(retry.current.state).toBe(ResultState.UNCONFIRMED);
      }
    });

    it('treats a reordered body with an untrimmed guest label as the same request, not a changed one', async (): Promise<void> => {
      const clientOperationId: string = randomUUID();
      const seats = [
        {
          guestName: null,
          seat: Seat.A1,
          userId: ids.Ada!,
        },
        {
          guestName: '  Priya  ',
          seat: Seat.B1,
          userId: null,
        },
      ];
      const submission: IResultSubmission = {
        ...singles(
          [
            [11, 4],
            [11, 6],
          ],
          [ids.Ada!, ids.Ben!],
        ),
        games: [
          {
            a: 11,
            b: 6,
            gameNumber: 2,
          },
          {
            a: 11,
            b: 4,
            gameNumber: 1,
          },
        ],
        seats: [seats[1]!, seats[0]!],
      };

      await read(`UPDATE "leagues" SET "settings" = $1 WHERE "id" = $2`, [
        JSON.stringify(settingsFixture({ matchFormat: 3, requireConfirmation: false })),
        LEAGUE_ID,
      ]);

      const first: IResultEffect = effectOf(await record(ids.Ada!, submission, { clientOperationId }));
      const retry: TResultOutcome = await record(
        ids.Ada!,
        {
          ...submission,
          games: [...submission.games].reverse(),
          seats: [seats[0]!, seats[1]!],
        },
        { clientOperationId },
      );

      expect(refusalOf(retry)).toBe('none');
      expect(effectOf(retry).resultRevisionId).toBe(first.resultRevisionId);
      expect(await read(`SELECT 1 FROM "result_revisions"`)).toHaveLength(1);
    });

    it('refuses a body outside the form’s own bounds before anything is written', async (): Promise<void> => {
      const seats: [string, string] = [ids.Ada!, ids.Ben!];
      const bad: Record<string, IResultSubmission> = {
        duplicateMember: singles([[11, 4]], [ids.Ada!, ids.Ada!]),
        emptyGuest: singles([[11, 4]], [ids.Ada!, ids.Ben!], {
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ids.Ada!,
            },
            {
              guestName: '   ',
              seat: Seat.B1,
              userId: null,
            },
          ],
        }),
        future: singles([[11, 4]], seats, { playedAt: new Date(Date.now() + HOUR_MS).toISOString() }),
        longGuest: singles([[11, 4]], [ids.Ada!, ids.Ben!], {
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ids.Ada!,
            },
            {
              guestName: 'x'.repeat(41),
              seat: Seat.B1,
              userId: null,
            },
          ],
        }),
        noMember: singles([[11, 4]], [ids.Ada!, ids.Ben!], {
          seats: [
            {
              guestName: 'Priya',
              seat: Seat.A1,
              userId: null,
            },
            {
              guestName: 'Quinn',
              seat: Seat.B1,
              userId: null,
            },
          ],
        }),
        overRange: singles([[MAX_ENTERED_SCORE + 1, 4]], seats),
        stale: singles([[11, 4]], seats, { playedAt: new Date(Date.now() - 49 * HOUR_MS).toISOString() }),
      };
      const refusals: Record<string, string> = {};
      const windows: Record<string, number | null> = {};

      for (const [name, submission] of Object.entries(bad)) {
        const outcome: TResultOutcome = await record(ids.Ada!, submission);

        refusals[name] = refusalOf(outcome);
        windows[name] = windowOf(outcome);
      }

      // The two bounds measured against a window are answered with the refusal whose sentence states one, and every
      // other problem keeps the general one: a person with an impossible score is not told their play time is wrong
      expect(refusals).toEqual({
        duplicateMember: ResultRefusal.INVALID_SUBMISSION,
        emptyGuest: ResultRefusal.INVALID_SUBMISSION,
        future: ResultRefusal.ENTRY_PLAY_TIME,
        longGuest: ResultRefusal.INVALID_SUBMISSION,
        noMember: ResultRefusal.INVALID_SUBMISSION,
        overRange: ResultRefusal.INVALID_SUBMISSION,
        stale: ResultRefusal.ENTRY_PLAY_TIME,
      });
      // The league's window travels with the two that state one, and with nothing else
      expect(windows).toEqual({
        duplicateMember: null,
        emptyGuest: null,
        future: 48,
        longGuest: null,
        noMember: null,
        overRange: null,
        stale: 48,
      });
      expect(await read(`SELECT 1 FROM "result_revisions"`)).toHaveLength(0);
    });

    it('conflicts rather than replaying when a retry lengthens a guest label past the bound', async (): Promise<void> => {
      const operation: string = randomUUID();
      // One play time for both bodies: the label has to be the only thing that differs, or a conflict
      // would prove nothing about the label
      const playedAt: string = new Date(Date.now() - HOUR_MS).toISOString();
      const guest = (length: number): IResultSubmission =>
        singles([[11, 4]], [ids.Ada!, ids.Ben!], {
          playedAt,
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ids.Ada!,
            },
            {
              guestName: 'x'.repeat(length),
              seat: Seat.B1,
              userId: null,
            },
          ],
        });

      effectOf(await record(ids.Ada!, guest(MAX_GUEST_NAME_LENGTH), { clientOperationId: operation }));

      const changed: TResultOutcome = await record(ids.Ada!, guest(MAX_GUEST_NAME_LENGTH + 1), {
        clientOperationId: operation,
      });

      // Normalization used to cut the longer label back to the shorter one before the digest was taken, so a body
      // the server would have refused digested identically to the one already committed and was answered from its
      // receipt. The person would have been told their changed result was recorded
      expect(refusalOf(changed)).toBe(ResultRefusal.OPERATION_BODY_CHANGED);
      expect(await read(`SELECT 1 FROM "result_revisions"`)).toHaveLength(1);
    });

    it('still replays a retry that only reorders or pads what it sent', async (): Promise<void> => {
      const operation: string = randomUUID();
      const submission: IResultSubmission = singles([[11, 4]], [ids.Ada!, ids.Ben!], {
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
      });
      const first: IResultEffect = effectOf(await record(ids.Ada!, submission, { clientOperationId: operation }));
      const again: TResultOutcome = await record(
        ids.Ada!,
        {
          ...submission,
          playedAt: submission.playedAt.replace('.000Z', 'Z'),
          seats: [...submission.seats].reverse().map((seat) => ({
            ...seat,
            guestName: seat.guestName === null ? null : `  ${seat.guestName} `,
          })),
        },
        { clientOperationId: operation },
      );

      // The other half of the same rule: trimming and ordering are presentation, and a retry that differs only in
      // those is the same operation rather than a conflict
      expect(again.ok && again.replayed).toBe(true);
      expect(effectOf(again).resultRevisionId).toBe(first.resultRevisionId);
    });

    it('refuses a play time that states no instant rather than raising on it', async (): Promise<void> => {
      // Normalization read this field before anything validated it, so the request died as a `RangeError` — a 500
      // where the form's own rule says which field is wrong
      const outcome: TResultOutcome = await record(
        ids.Ada!,
        singles([[11, 4]], [ids.Ada!, ids.Ben!], { playedAt: 'not-an-instant' }),
      );

      expect(refusalOf(outcome)).toBe(ResultRefusal.INVALID_SUBMISSION);
      expect(await read(`SELECT 1 FROM "result_revisions"`)).toHaveLength(0);
    });

    it('refuses a seat naming somebody who has left the league or deleted their account', async (): Promise<void> => {
      await read(`DELETE FROM "memberships" WHERE "user_id" = $1`, [ids.Cara!]);

      const left: TResultOutcome = await record(ids.Ada!, singles([[11, 4]], [ids.Ada!, ids.Cara!]));

      await read(`UPDATE "users" SET "deleted_at" = now() WHERE "id" = $1`, [ids.Ben!]);

      const deleted: TResultOutcome = await record(ids.Ada!, singles([[11, 4]], [ids.Ada!, ids.Ben!]));

      expect([refusalOf(left), refusalOf(deleted)]).toEqual([
        ResultRefusal.SEAT_NOT_A_MEMBER,
        ResultRefusal.SEAT_NOT_A_MEMBER,
      ]);
    });

    it('answers a retry that carries an acknowledgement the first attempt did not', async (): Promise<void> => {
      // The acknowledgement travels with a save without being part of it. A digest that included it would make
      // "record it anyway" a different body under the same key, and the retry of a lost save would conflict with
      // the save it is retrying
      const key: string = randomUUID();
      const entry: IResultSubmission = singles([[11, 4]], [ids.Ada!, ids.Ben!]);
      const first: TResultOutcome = await record(ids.Ada!, entry, { clientOperationId: key });
      const retried: TResultOutcome = await inTransaction((transaction) =>
        recordResult(transaction, ids.Ada!, {
          acknowledgement: 'a token the first attempt never sent',
          clientOperationId: key,
          expectedLeagueRevision: 1,
          leagueId: LEAGUE_ID,
          submission: entry,
        }),
      );
      const revisions: unknown[] = await read(`SELECT 1 FROM "result_revisions"`);

      expect(effectOf(first).canonicalMatchId).toBe(effectOf(retried).canonicalMatchId);
      expect(retried.ok && retried.replayed).toBe(true);
      expect(revisions).toHaveLength(1);
    });

    it('warns again when the result changed after the warning was answered', async (): Promise<void> => {
      // What was acknowledged was a particular result and a particular set of candidates. Moving the play time by a
      // minute means the person is recording something they were never shown warned
      const entry: IResultSubmission = singles([[11, 4]], [ids.Ada!, ids.Ben!]);

      effectOf(await record(ids.Ada!, entry));

      const warned: TResultOutcome = await inTransaction((transaction) =>
        recordResult(transaction, ids.Ada!, {
          clientOperationId: randomUUID(),
          expectedLeagueRevision: 1,
          leagueId: LEAGUE_ID,
          submission: entry,
        }),
      );
      const token: string | undefined = warned.ok ? undefined : warned.details?.acknowledgement;
      const edited: TResultOutcome = await inTransaction((transaction) =>
        recordResult(transaction, ids.Ada!, {
          acknowledgement: token,
          clientOperationId: randomUUID(),
          expectedLeagueRevision: 1,
          leagueId: LEAGUE_ID,
          submission: { ...entry, playedAt: new Date(Date.parse(entry.playedAt) - 60 * 1000).toISOString() },
        }),
      );
      const accepted: TResultOutcome = await inTransaction((transaction) =>
        recordResult(transaction, ids.Ada!, {
          acknowledgement: token,
          clientOperationId: randomUUID(),
          expectedLeagueRevision: 1,
          leagueId: LEAGUE_ID,
          submission: entry,
        }),
      );

      expect(refusalOf(warned)).toBe(ResultRefusal.PROBABLE_DUPLICATE);
      expect(refusalOf(edited)).toBe(ResultRefusal.PROBABLE_DUPLICATE);
      expect(accepted.ok).toBe(true);
    });

    it('asks only the other side of a doubles result one of its players entered', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!])),
      ).canonicalMatchId;
      const sides: Record<string, ISideRow> = await sidesOf(match);

      // Ada entered it, so Ada's side answered by entering it; the other side owes one answer from either of them
      expect(sides.A).toEqual({
        confirmedBy: null,
        confirmers: [ids.Ada!, ids.Ben!].sort(),
        satisfiedBy: SideSatisfaction.SUBMISSION,
      });
      expect(sides.B).toEqual({
        confirmedBy: null,
        confirmers: [ids.Cara!, ids.Dan!].sort(),
        satisfiedBy: SideSatisfaction.PENDING,
      });
    });

    it('leaves both sides owing an answer when the recorder was not playing', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan', 'Eve']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ben!, ids.Cara!, ids.Dan!, ids.Eve!])),
      ).canonicalMatchId;
      const sides: Record<string, ISideRow> = await sidesOf(match);

      expect([sides.A!.satisfiedBy, sides.B!.satisfiedBy]).toEqual([
        SideSatisfaction.PENDING,
        SideSatisfaction.PENDING,
      ]);
      expect([sides.A!.confirmers, sides.B!.confirmers]).toEqual([
        [ids.Ben!, ids.Cara!].sort(),
        [ids.Dan!, ids.Eve!].sort(),
      ]);
    });

    it('exempts a side with nobody registered on it, and settles when no side is left to ask', async (): Promise<void> => {
      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, ids.Ben!, { guest: 'Priya' }, { guest: 'Lee' }])),
      ).canonicalMatchId;
      const sides: Record<string, ISideRow> = await sidesOf(match);
      const [revision] = await read<{ reason: string; state: string }>(
        `SELECT "settled_reason" AS reason, "state" FROM "result_revisions" WHERE "canonical_match_id" = $1`,
        [match],
      );

      expect([sides.A!.satisfiedBy, sides.B!.satisfiedBy]).toEqual([
        SideSatisfaction.SUBMISSION,
        SideSatisfaction.EXEMPT,
      ]);
      expect(sides.B!.confirmers).toEqual([]);
      // Nobody was asked and nobody voted: the reason says so rather than claiming a confirmation
      expect([revision!.state, revision!.reason]).toEqual([ResultState.CONFIRMED, 'NO_CONFIRMATION_NEEDED']);
    });

    it('still waits for the one opponent on a guest-partnered side', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, { guest: 'Lee' }, ids.Cara!, { guest: 'Priya' }])),
      ).canonicalMatchId;
      const sides: Record<string, ISideRow> = await sidesOf(match);

      expect(sides.B).toEqual({
        confirmedBy: null,
        confirmers: [ids.Cara!],
        satisfiedBy: SideSatisfaction.PENDING,
      });
    });

    it('asks the opponent’s side alone on a singles result a player entered', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const sides: Record<string, ISideRow> = await sidesOf(match);

      // Unchanged by the per-side rule: singles has one account on each side, so a side is a person
      expect([sides.A!.satisfiedBy, sides.B!.satisfiedBy]).toEqual([
        SideSatisfaction.SUBMISSION,
        SideSatisfaction.PENDING,
      ]);
      expect(sides.B!.confirmers).toEqual([ids.Ben!]);
    });
  });

  describe(symbolName(answerResult), (): void => {
    it('accepts a confirmation only from a participant the revision is waiting on', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const recorder: TResultOutcome = await answer(ids.Ada!, ResultAction.CONFIRM, match);
      const outsider: TResultOutcome = await answer(ids.Cara!, ResultAction.CONFIRM, match);
      const answerer: TResultOutcome = await answer(ids.Ben!, ResultAction.CONFIRM, match);

      expect([refusalOf(recorder), refusalOf(outsider)]).toEqual([ResultRefusal.FORBIDDEN, ResultRefusal.FORBIDDEN]);
      expect(effectOf(answerer).state).toBe(ResultState.CONFIRMED);
    });

    it('settles a seated-recorder doubles result on one opponent’s confirmation, and the teammate’s late press is a no-op', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!])),
      ).canonicalMatchId;
      const first: TResultOutcome = await answer(ids.Cara!, ResultAction.CONFIRM, match);
      const teammate: TResultOutcome = await answer(ids.Dan!, ResultAction.CONFIRM, match);
      const sides: Record<string, ISideRow> = await sidesOf(match);
      const votes = await read<{ actor: string }>(
        `SELECT "actor_user_id" AS actor FROM "result_actions" WHERE "type" = 'CONFIRM'`,
      );
      const [generations] = await read<{ n: number }>(`SELECT count(*)::int AS n FROM "rating_generations"`);

      expect(effectOf(first).state).toBe(ResultState.CONFIRMED);
      // The other opponent pressing Confirm afterwards is told where the match stands, and adds nothing
      expect(effectOf(teammate).state).toBe(ResultState.CONFIRMED);
      expect(votes.map((vote): string => vote.actor)).toEqual([ids.Cara!]);
      expect(sides.B!.confirmedBy).toBe(ids.Cara!);
      // One settlement, and the one generation the recording published plus the one the settlement did
      expect(generations!.n).toBe(2);
    });

    it('refuses a confirmation from the recorder’s own side, which the submission already answered', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!])),
      ).canonicalMatchId;
      const recorder: TResultOutcome = await answer(ids.Ada!, ResultAction.CONFIRM, match);
      const partner: TResultOutcome = await answer(ids.Ben!, ResultAction.CONFIRM, match);
      const partnerDisputes: TResultOutcome = await answer(ids.Ben!, ResultAction.DISPUTE, match);

      expect([refusalOf(recorder), refusalOf(partner)]).toEqual([ResultRefusal.FORBIDDEN, ResultRefusal.FORBIDDEN]);
      // Not being asked to confirm never removes a seated player's right to dispute while the result is pending
      expect(effectOf(partnerDisputes).state).toBe(ResultState.DISPUTED);
    });

    it('needs one member of each side when the recorder was not playing, and each side only once', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan', 'Eve']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ben!, ids.Cara!, ids.Dan!, ids.Eve!])),
      ).canonicalMatchId;
      const firstSide: TResultOutcome = await answer(ids.Ben!, ResultAction.CONFIRM, match);
      const sameSideAgain: TResultOutcome = await answer(ids.Cara!, ResultAction.CONFIRM, match);
      const finalSide: TResultOutcome = await answer(ids.Eve!, ResultAction.CONFIRM, match);
      const sides: Record<string, ISideRow> = await sidesOf(match);

      expect(effectOf(firstSide).state).toBe(ResultState.UNCONFIRMED);
      // The second account on an answered side changes nothing and is told so
      expect(effectOf(sameSideAgain).state).toBe(ResultState.UNCONFIRMED);
      expect(effectOf(finalSide).state).toBe(ResultState.CONFIRMED);
      expect([sides.A!.confirmedBy, sides.B!.confirmedBy]).toEqual([ids.Ben!, ids.Eve!]);
    });

    it('keeps a side owing its answer when one of its members is removed, and lets a teammate give it', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!])),
      ).canonicalMatchId;

      await read(`DELETE FROM "memberships" WHERE "user_id" = $1`, [ids.Cara!]);

      const removed: TResultOutcome = await answer(ids.Cara!, ResultAction.CONFIRM, match);
      const teammate: TResultOutcome = await answer(ids.Dan!, ResultAction.CONFIRM, match);
      const sides: Record<string, ISideRow> = await sidesOf(match);

      expect(refusalOf(removed)).toBe(ResultRefusal.NOT_FOUND);
      expect(effectOf(teammate).state).toBe(ResultState.CONFIRMED);
      // The eligible set is frozen: losing a membership removes access, not the row
      expect(sides.B!.confirmers).toEqual([ids.Cara!, ids.Dan!].sort());
      expect(sides.B!.confirmedBy).toBe(ids.Dan!);
    });

    it('waits for the deadline when every account that could answer a side is gone', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!])),
      ).canonicalMatchId;

      await read(`DELETE FROM "memberships" WHERE "user_id" = ANY($1::uuid[])`, [[ids.Cara!, ids.Dan!]]);
      await read(`UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute'`);

      const settled: number = await inTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID));
      const sides: Record<string, ISideRow> = await sidesOf(match);
      const [revision] = await read<{ reason: string; state: string }>(
        `SELECT "settled_reason" AS reason, "state" FROM "result_revisions"`,
      );

      expect(settled).toBe(1);
      expect([revision!.state, revision!.reason]).toEqual([ResultState.CONFIRMED, 'DEADLINE_PASSED']);
      // Accepting on the deadline invents no vote: the side is still recorded as never having answered
      expect(sides.B!.satisfiedBy).toBe(SideSatisfaction.PENDING);
      expect(sides.B!.confirmedBy).toBeNull();
    });

    it('conflicts on a fresh confirmation from an answered side once the result is disputed', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan', 'Eve']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ben!, ids.Cara!, ids.Dan!, ids.Eve!])),
      ).canonicalMatchId;

      effectOf(await answer(ids.Ben!, ResultAction.CONFIRM, match));
      effectOf(await answer(ids.Dan!, ResultAction.DISPUTE, match));

      const teammate: TResultOutcome = await answer(ids.Cara!, ResultAction.CONFIRM, match);

      // The harmless retry is harmless only while the revision still stands as they saw it
      expect(refusalOf(teammate)).toBe(ResultRefusal.STALE_RESULT);
    });

    it('lets a manager void a result a commissioner already accepted, and drops it from the ladder', async (): Promise<void> => {
      await setRole(ids.Ben!, 'MANAGER');

      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Cara!]);

      effectOf(await answer(ids.Cara!, ResultAction.CONFIRM, match));

      const voided: TResultOutcome = await answer(ids.Ben!, ResultAction.VOID, match);
      const [games] = await read<{ live: number; voided: number }>(
        `SELECT count(*) FILTER (WHERE "status" = 'VOID')::int AS voided,
                count(*) FILTER (WHERE "status" <> 'VOID')::int AS live
         FROM "games"`,
      );
      const [ladder] = await read<{ snapshots: number }>(
        `SELECT count(*)::int AS snapshots
         FROM "rating_snapshots" s
         JOIN "active_rating_generations" a ON a."rating_generation_id" = s."rating_generation_id"`,
      );

      expect(effectOf(voided).state).toBe(ResultState.VOID);
      expect([games!.voided, games!.live]).toEqual([1, 0]);
      // The void republishes the ladder inside its own transaction, and the voided match rates nobody
      expect(ladder!.snapshots).toBe(0);
    });

    it('records the role a void was taken under, and keeps it after the role is gone', async (): Promise<void> => {
      await setRole(ids.Ben!, 'MANAGER');

      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Cara!]);
      const key: string = randomUUID();

      effectOf(await answer(ids.Ben!, ResultAction.VOID, match, { clientOperationId: key }));

      await setRole(ids.Ben!, 'PLAYER');

      // The same operation again, from an account that is no longer a manager: the receipt answers it, and the audit
      // still says what authority the ruling was made under
      const replayed: TResultOutcome = await answer(ids.Ben!, ResultAction.VOID, match, { clientOperationId: key });
      const [action] = await read<{ role: string | null; type: string }>(
        `SELECT "type", "actor_role" AS role FROM "result_actions" WHERE "actor_user_id" = $1`,
        [ids.Ben!],
      );

      expect(replayed.ok && replayed.replayed).toBe(true);
      expect([action!.type, action!.role]).toEqual(['VOID', 'MANAGER']);

      await read(`DELETE FROM "memberships" WHERE "user_id" = $1`, [ids.Ben!]);

      // Authorization comes before the receipt, so an account that has left the league is not handed its old answer
      const gone: TResultOutcome = await answer(ids.Ben!, ResultAction.VOID, match, { clientOperationId: key });
      const [unchanged] = await read<{ role: string | null }>(
        `SELECT "actor_role" AS role FROM "result_actions" WHERE "actor_user_id" = $1`,
        [ids.Ben!],
      );

      expect(refusalOf(gone)).toBe(ResultRefusal.NOT_FOUND);
      expect(unchanged!.role).toBe('MANAGER');
    });

    it('records the role every other action was taken under too', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);

      effectOf(await answer(ids.Ben!, ResultAction.DISPUTE, match));
      effectOf(await answer(ids.Ada!, ResultAction.VOID, match));

      const rows = await read<{ role: string | null; type: string }>(
        `SELECT "type", "actor_role" AS role FROM "result_actions" ORDER BY "type"`,
      );

      expect(rows).toEqual([
        { role: 'PLAYER', type: 'DISPUTE' },
        { role: 'COMMISSIONER', type: 'VOID' },
      ]);
    });

    it('refuses a void from a player, and from the same manager the moment the role is gone', async (): Promise<void> => {
      await setRole(ids.Ben!, 'MANAGER');

      const first: string = await pending(ids.Ada!, [ids.Ada!, ids.Cara!]);
      const second: string = await pending(ids.Ada!, [ids.Ada!, ids.Cara!]);
      const player: TResultOutcome = await answer(ids.Cara!, ResultAction.VOID, first);
      const asManager: TResultOutcome = await answer(ids.Ben!, ResultAction.VOID, first);

      await setRole(ids.Ben!, 'PLAYER');

      // The same account and the same action, refused now only because the role that carried it is gone
      const demoted: TResultOutcome = await answer(ids.Ben!, ResultAction.VOID, second);
      const [survivor] = await read<{ state: string }>(
        `SELECT "state" FROM "result_revisions" WHERE "canonical_match_id" = $1`,
        [second],
      );

      expect([refusalOf(player), refusalOf(demoted)]).toEqual([ResultRefusal.FORBIDDEN, ResultRefusal.FORBIDDEN]);
      expect(effectOf(asManager).state).toBe(ResultState.VOID);
      expect(survivor!.state).toBe(ResultState.UNCONFIRMED);
    });

    it('lets the recorder dispute their own pending result', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);

      expect(effectOf(await answer(ids.Ada!, ResultAction.DISPUTE, match)).state).toBe(ResultState.DISPUTED);
    });

    it('refuses a second void rather than recording a second ruling', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ben!, ids.Cara!]);
      const first: TResultOutcome = await answer(ids.Ada!, ResultAction.VOID, match);
      const second: TResultOutcome = await answer(ids.Ada!, ResultAction.VOID, match);
      const [row] = await read<{ reason: string; superseded: Date | null }>(
        `SELECT r."settled_reason" AS reason, g."superseded_at" AS superseded
         FROM "result_revisions" r JOIN "games" g ON g."result_revision_id" = r."id"`,
      );

      expect(effectOf(first).state).toBe(ResultState.VOID);
      expect(refusalOf(second)).toBe(ResultRefusal.STALE_RESULT);
      expect(row!.reason).toBe('VOIDED');
      expect(row!.superseded).toBeNull();
    });

    it('settles a revision whose deadline passed while the transaction waited, and refuses the late dispute', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ben!, ids.Cara!]);

      // The deadline lands between this transaction's start time and the clock it reads under its locks, which is the
      // whole distinction: `now()` would still be inside the window when the dispute is judged
      await read(
        `UPDATE "result_revisions" SET "confirmation_deadline" = clock_timestamp() + interval '200 milliseconds'`,
      );

      const late: TResultOutcome = await inTransaction(async (transaction) => {
        await transaction.query(`SELECT pg_sleep(0.4)`);

        return answerResult(transaction, ids.Ben!, {
          action: ResultAction.DISPUTE,
          canonicalMatchId: match,
          clientOperationId: randomUUID(),
          expectedRevision: 1,
          note: 'too late',
        });
      });
      const [row] = await read<{ disputes: number; reason: string; state: string }>(
        `SELECT "state", "settled_reason" AS reason,
                (SELECT count(*)::int FROM "result_actions" WHERE "type" = 'DISPUTE') AS disputes
         FROM "result_revisions"`,
      );

      expect(refusalOf(late)).toBe(ResultRefusal.STALE_RESULT);
      expect([row!.state, row!.reason, row!.disputes]).toEqual(['CONFIRMED', 'DEADLINE_PASSED', 0]);
    });

    it('answers every kind of retry from its receipt, and refuses one whose author has lost access', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const keys: Record<string, string> = {
        confirm: randomUUID(),
        dispute: randomUUID(),
        void: randomUUID(),
      };

      effectOf(await answer(ids.Ben!, ResultAction.DISPUTE, match, { clientOperationId: keys.dispute }));

      const disputeRetry: TResultOutcome = await answer(ids.Ben!, ResultAction.DISPUTE, match, {
        clientOperationId: keys.dispute,
      });

      effectOf(await answer(ids.Ada!, ResultAction.VOID, match, { clientOperationId: keys.void }));

      const voidRetry: TResultOutcome = await answer(ids.Ada!, ResultAction.VOID, match, {
        clientOperationId: keys.void,
      });

      await read(`DELETE FROM "memberships" WHERE "user_id" = $1`, [ids.Ben!]);

      const lostAccess: TResultOutcome = await answer(ids.Ben!, ResultAction.DISPUTE, match, {
        clientOperationId: keys.dispute,
      });

      expect(disputeRetry.ok && disputeRetry.replayed && disputeRetry.value.state).toBe(ResultState.DISPUTED);
      expect(disputeRetry.ok && disputeRetry.current.state).toBe(ResultState.DISPUTED);
      expect(voidRetry.ok && voidRetry.replayed && voidRetry.current.state).toBe(ResultState.VOID);
      expect(refusalOf(lostAccess)).toBe(ResultRefusal.NOT_FOUND);
      expect(await read(`SELECT 1 FROM "result_actions" WHERE "type" = 'DISPUTE'`)).toHaveLength(1);
    });

    it('refuses every kind of retry once its author has lost access to the league', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const keys: Record<string, string> = {
        amend: randomUUID(),
        confirm: randomUUID(),
        dispute: randomUUID(),
        create: randomUUID(),
        void: randomUUID(),
      };
      const second: string = effectOf(
        await record(ids.Ada!, singles([[11, 5]], [ids.Ada!, ids.Ben!]), { clientOperationId: keys.create }),
      ).canonicalMatchId;

      effectOf(await answer(ids.Ben!, ResultAction.CONFIRM, second, { clientOperationId: keys.confirm }));
      effectOf(await answer(ids.Ben!, ResultAction.DISPUTE, match, { clientOperationId: keys.dispute }));

      const corrected: IResultEffect = effectOf(
        await amend(ids.Ada!, match, singles([[11, 6]], [ids.Ada!, ids.Ben!]), { clientOperationId: keys.amend }),
      );

      effectOf(await answer(ids.Ada!, ResultAction.VOID, match, { clientOperationId: keys.void, expectedRevision: 2 }));

      // Both of them leave: the recorder and amender, and the participant who confirmed one result and disputed another
      await read(`DELETE FROM "memberships" WHERE "user_id" = ANY($1::uuid[])`, [[ids.Ada!, ids.Ben!]]);

      const retries: Record<string, string> = {
        amend: refusalOf(
          await amend(ids.Ada!, match, singles([[11, 6]], [ids.Ada!, ids.Ben!]), { clientOperationId: keys.amend }),
        ),
        confirm: refusalOf(await answer(ids.Ben!, ResultAction.CONFIRM, second, { clientOperationId: keys.confirm })),
        create: refusalOf(
          await record(ids.Ada!, singles([[11, 5]], [ids.Ada!, ids.Ben!]), { clientOperationId: keys.create }),
        ),
        dispute: refusalOf(await answer(ids.Ben!, ResultAction.DISPUTE, match, { clientOperationId: keys.dispute })),
        void: refusalOf(
          await answer(ids.Ada!, ResultAction.VOID, match, { clientOperationId: keys.void, expectedRevision: 2 }),
        ),
      };

      expect(retries).toEqual({
        amend: ResultRefusal.NOT_FOUND,
        confirm: ResultRefusal.NOT_FOUND,
        create: ResultRefusal.NOT_FOUND,
        dispute: ResultRefusal.NOT_FOUND,
        void: ResultRefusal.NOT_FOUND,
      });
      expect(JSON.stringify(retries)).not.toContain(corrected.resultRevisionId);
    });

    it('refuses a note longer than a note may be, and a note on an action that carries none', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const long: TResultOutcome = await answer(ids.Ben!, ResultAction.DISPUTE, match, { note: 'x'.repeat(281) });
      const wrongAction: TResultOutcome = await answer(ids.Ben!, ResultAction.CONFIRM, match, { note: 'why not' });

      expect([refusalOf(long), refusalOf(wrongAction)]).toEqual([
        ResultRefusal.INVALID_SUBMISSION,
        ResultRefusal.INVALID_SUBMISSION,
      ]);
      expect(await read(`SELECT 1 FROM "result_actions"`)).toHaveLength(0);
    });

    it('stores a note about a match with a deleted participant already redacted', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ben!, ids.Cara!]);

      await deleteAccount(ids.Cara!);

      const dispute: TResultOutcome = await answer(ids.Ben!, ResultAction.DISPUTE, match, { note: NOTE });
      const [note] = await read<{ body: string | null; redacted_at: Date | null }>(
        `SELECT "body", "redacted_at" FROM "result_dispute_notes"`,
      );

      expect(effectOf(dispute).state).toBe(ResultState.DISPUTED);
      expect(note!.body).toBeNull();
      expect(note!.redacted_at).not.toBeNull();
      expect(await read(`SELECT 1 FROM "result_dispute_notes" WHERE "body" LIKE '%Cara%'`)).toHaveLength(0);
    });

    it('redacts a note that landed before the deletion, whichever order the two arrive in', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ben!, ids.Cara!]);

      effectOf(await answer(ids.Ben!, ResultAction.DISPUTE, match, { note: NOTE }));

      const redacted: number = await inTransaction((transaction) => redactNotesForAccount(transaction, ids.Cara!));

      expect(redacted).toBe(1);
      expect(await read(`SELECT 1 FROM "result_dispute_notes" WHERE "body" IS NOT NULL`)).toHaveLength(0);
    });

    it('answers a confirmation somebody makes twice with where the match stands, not an error', async (): Promise<void> => {
      // A recorder who was not playing, so the other side is still owed an answer and the second press has somewhere
      // to land that is not settlement: the spec's repeated confirm is a 200 with the current state
      await reseed(['Ada', 'Ben', 'Cara', 'Dan', 'Eve']);

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ben!, ids.Cara!, ids.Dan!, ids.Eve!])),
      ).canonicalMatchId;

      effectOf(await answer(ids.Ben!, ResultAction.CONFIRM, match));

      const again: TResultOutcome = await answer(ids.Ben!, ResultAction.CONFIRM, match);
      const votes: unknown[] = await read(
        `SELECT 1 FROM "result_actions" WHERE "actor_user_id" = $1 AND "type" = 'CONFIRM'`,
        [ids.Ben!],
      );

      expect(refusalOf(again)).toBe('none');
      expect(effectOf(again).state).toBe(ResultState.UNCONFIRMED);
      // A fresh operation id, so this is not the receipt path: the vote is simply not cast a second time
      expect(votes).toHaveLength(1);
    });

    it('answers a confirmation repeated after the match settled the same way', async (): Promise<void> => {
      const match: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);

      effectOf(await answer(ids.Ben!, ResultAction.CONFIRM, match));

      const again: TResultOutcome = await answer(ids.Ben!, ResultAction.CONFIRM, match);

      // Their own confirmation is what settled it; being told it is too late would be the page arguing with itself
      expect(refusalOf(again)).toBe('none');
      expect(effectOf(again).state).toBe(ResultState.CONFIRMED);
      expect(await read(`SELECT 1 FROM "result_actions" WHERE "type" = 'CONFIRM'`)).toHaveLength(1);
    });

    it('still conflicts on a confirmation repeated after the result was voided', async (): Promise<void> => {
      const match: string = effectOf(
        await record(ids.Ada!, {
          ...singles([[11, 4]], [ids.Ada!, ids.Ben!]),
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ids.Ben!,
            },
            {
              guestName: null,
              seat: Seat.B1,
              userId: ids.Cara!,
            },
          ],
        }),
      ).canonicalMatchId;

      effectOf(await answer(ids.Ben!, ResultAction.CONFIRM, match));
      effectOf(await answer(ids.Ada!, ResultAction.VOID, match));

      const again: TResultOutcome = await answer(ids.Ben!, ResultAction.CONFIRM, match);

      // The match did change under the page, and the conflict carrying VOID is what redraws it
      expect(refusalOf(again)).toBe(ResultRefusal.STALE_RESULT);
      expect(again.ok ? null : again.state).toBe(ResultState.VOID);
    });

    it('refuses a repeated dispute rather than answering it as already done', async (): Promise<void> => {
      const match: string = await disputed(ids.Ada!, [ids.Ada!, ids.Ben!]);

      // Only confirmation is idempotent by the page's contract; a second dispute of a disputed result is an error
      expect(refusalOf(await answer(ids.Ben!, ResultAction.DISPUTE, match))).toBe(ResultRefusal.STALE_RESULT);
    });
  });

  describe(symbolName(amendResult), (): void => {
    it('gives the corrected revision its own sides, and leaves the original’s alone', async (): Promise<void> => {
      await reseed(['Ada', 'Ben', 'Cara', 'Dan']);
      await setRole(ids.Cara!, 'MANAGER');

      const match: string = effectOf(
        await record(ids.Ada!, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!])),
      ).canonicalMatchId;

      effectOf(await answer(ids.Dan!, ResultAction.DISPUTE, match));
      effectOf(
        await amend(ids.Cara!, match, doubles([ids.Ada!, ids.Ben!, ids.Cara!, ids.Dan!]), { expectedRevision: 1 }),
      );

      const corrected: Record<string, ISideRow> = await sidesOf(match, 2);
      const original: Record<string, ISideRow> = await sidesOf(match, 1);

      // Cara corrected it from the other side, so the correction is answered by Cara's side and owed by Ada's
      expect([corrected.A!.satisfiedBy, corrected.B!.satisfiedBy]).toEqual([
        SideSatisfaction.PENDING,
        SideSatisfaction.SUBMISSION,
      ]);
      // And the original revision still records the sides it was born with
      expect([original.A!.satisfiedBy, original.B!.satisfiedBy]).toEqual([
        SideSatisfaction.SUBMISSION,
        SideSatisfaction.PENDING,
      ]);
    });

    it('refuses a correction whose play time states no instant', async (): Promise<void> => {
      const match: string = await disputed(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const outcome: TResultOutcome = await amend(
        ids.Ada!,
        match,
        singles([[11, 9]], [ids.Ada!, ids.Ben!], { playedAt: 'not-an-instant' }),
      );

      expect(refusalOf(outcome)).toBe(ResultRefusal.INVALID_SUBMISSION);
      expect(await read(`SELECT 1 FROM "result_revisions" WHERE "revision" = 2`)).toHaveLength(0);
    });

    it('conflicts when a retried correction lengthens a guest label past the bound', async (): Promise<void> => {
      const match: string = await disputed(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const operation: string = randomUUID();
      const playedAt: string = new Date(Date.now() - HOUR_MS).toISOString();
      const guest = (length: number): IResultSubmission =>
        singles([[11, 9]], [ids.Ada!, ids.Ben!], {
          playedAt,
          seats: [
            {
              guestName: null,
              seat: Seat.A1,
              userId: ids.Ada!,
            },
            {
              guestName: 'x'.repeat(length),
              seat: Seat.B1,
              userId: null,
            },
          ],
        });

      effectOf(await amend(ids.Ada!, match, guest(MAX_GUEST_NAME_LENGTH), { clientOperationId: operation }));

      const changed: TResultOutcome = await amend(ids.Ada!, match, guest(MAX_GUEST_NAME_LENGTH + 1), {
        clientOperationId: operation,
        expectedRevision: 1,
      });

      expect(refusalOf(changed)).toBe(ResultRefusal.OPERATION_BODY_CHANGED);
      expect(await read(`SELECT 1 FROM "result_revisions" WHERE "revision" = 3`)).toHaveLength(0);
    });

    it('corrects a disputed result and refuses every other state', async (): Promise<void> => {
      const unconfirmed: string = await pending(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const pendingRefusal: string = refusalOf(
        await amend(ids.Ada!, unconfirmed, singles([[11, 6]], [ids.Ada!, ids.Ben!])),
      );

      effectOf(await answer(ids.Ben!, ResultAction.CONFIRM, unconfirmed));

      const confirmedRefusal: string = refusalOf(
        await amend(ids.Ada!, unconfirmed, singles([[11, 6]], [ids.Ada!, ids.Ben!])),
      );
      const match: string = await disputed(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const corrected: TResultOutcome = await amend(ids.Ada!, match, singles([[11, 6]], [ids.Ada!, ids.Ben!]));

      effectOf(await answer(ids.Ada!, ResultAction.VOID, match, { expectedRevision: 2 }));

      const voidRefusal: string = refusalOf(
        await amend(ids.Ada!, match, singles([[11, 7]], [ids.Ada!, ids.Ben!]), { expectedRevision: 2 }),
      );

      expect([pendingRefusal, confirmedRefusal, voidRefusal]).toEqual([
        ResultRefusal.STALE_RESULT,
        ResultRefusal.STALE_RESULT,
        ResultRefusal.STALE_RESULT,
      ]);
      expect(effectOf(corrected).revision).toBe(2);
    });

    it('keeps the match address and supersedes only the revision it replaced', async (): Promise<void> => {
      const match: string = await disputed(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const corrected: IResultEffect = effectOf(await amend(ids.Ada!, match, singles([[11, 6]], [ids.Ada!, ids.Ben!])));
      const rows = await read<{ id: string; superseded: Date | null }>(
        `SELECT "id", "superseded_at" AS superseded FROM "games" ORDER BY "created_at"`,
      );

      expect(corrected.canonicalMatchId).toBe(match);
      expect(rows).toHaveLength(2);
      expect(rows[0]!.id).toBe(match);
      expect(rows[0]!.superseded).not.toBeNull();
      expect(rows[1]!.superseded).toBeNull();
    });

    it('still explains a committed correction to the manager who has since been demoted', async (): Promise<void> => {
      const match: string = await disputed(ids.Ada!, [ids.Ben!, ids.Cara!]);
      const clientOperationId: string = randomUUID();
      const submission: IResultSubmission = singles([[11, 6]], [ids.Ben!, ids.Cara!]);
      const first: IResultEffect = effectOf(await amend(ids.Ada!, match, submission, { clientOperationId }));

      await read(`UPDATE "memberships" SET "role" = 'PLAYER' WHERE "user_id" = $1`, [ids.Ada!]);

      const retry: TResultOutcome = await amend(ids.Ada!, match, submission, { clientOperationId });
      const fresh: TResultOutcome = await amend(ids.Ada!, match, singles([[11, 8]], [ids.Ben!, ids.Cara!]), {
        expectedRevision: 2,
      });

      expect(retry.ok && retry.replayed).toBe(true);
      expect(effectOf(retry).resultRevisionId).toBe(first.resultRevisionId);
      expect(refusalOf(fresh)).toBe(ResultRefusal.FORBIDDEN);
    });

    it('refuses a correction that moves the play time into the future or outside the frozen window', async (): Promise<void> => {
      const match: string = await disputed(ids.Ada!, [ids.Ada!, ids.Ben!]);
      const future: TResultOutcome = await amend(
        ids.Ada!,
        match,
        singles([[11, 6]], [ids.Ada!, ids.Ben!], { playedAt: new Date(Date.now() + HOUR_MS).toISOString() }),
      );
      const ancient: TResultOutcome = await amend(
        ids.Ada!,
        match,
        singles([[11, 6]], [ids.Ada!, ids.Ben!], { playedAt: new Date(Date.now() - 96 * HOUR_MS).toISOString() }),
      );
      // A score nobody could have played is not a play-time problem, and must not be answered with a play-time
      // sentence: the refusal that names a window is for the two bounds measured against one
      const impossible: TResultOutcome = await amend(
        ids.Ada!,
        match,
        singles([[MAX_ENTERED_SCORE + 1, 6]], [ids.Ada!, ids.Ben!]),
      );

      expect([refusalOf(future), refusalOf(ancient), refusalOf(impossible)]).toEqual([
        ResultRefusal.AMENDMENT_PLAY_TIME,
        ResultRefusal.AMENDMENT_PLAY_TIME,
        ResultRefusal.INVALID_SUBMISSION,
      ]);
      // The window travels with the refusal, because it is the number the sentence states and only the write that
      // read the snapshot knows it
      expect([windowOf(future), windowOf(ancient), windowOf(impossible)]).toEqual([48, 48, null]);
    });

    it('states the window the correction was measured against, not the one the league keeps now', async (): Promise<void> => {
      const match: string = await disputed(ids.Ada!, [ids.Ada!, ids.Ben!]);

      // The league shortens its window after the match was recorded. The correction is still judged by the window
      // frozen onto the revision, so the sentence the person reads has to state that one
      await read(`UPDATE "leagues" SET "settings" = $1 WHERE "id" = $2`, [
        JSON.stringify(settingsFixture({ resultAmendmentWindow: 6 })),
        LEAGUE_ID,
      ]);

      const refused: TResultOutcome = await amend(
        ids.Ada!,
        match,
        singles([[11, 6]], [ids.Ada!, ids.Ben!], { playedAt: new Date(Date.now() + HOUR_MS).toISOString() }),
      );

      expect(refusalOf(refused)).toBe(ResultRefusal.AMENDMENT_PLAY_TIME);
      expect(windowOf(refused)).toBe(48);
    });
  });

  describe(symbolName(resolveMatchRoute), (): void => {
    it('resolves a later game and a superseded revision’s game to the canonical page, and tells a stranger nothing', async (): Promise<void> => {
      await read(`UPDATE "leagues" SET "settings" = $1 WHERE "id" = $2`, [
        JSON.stringify(settingsFixture({ matchFormat: 3 })),
        LEAGUE_ID,
      ]);

      const match: string = effectOf(
        await record(
          ids.Ada!,
          singles(
            [
              [11, 4],
              [9, 11],
              [11, 8],
            ],
            [ids.Ada!, ids.Ben!],
          ),
        ),
      ).canonicalMatchId;

      effectOf(await answer(ids.Ben!, ResultAction.DISPUTE, match));
      effectOf(
        await amend(
          ids.Ada!,
          match,
          singles(
            [
              [11, 4],
              [11, 6],
            ],
            [ids.Ada!, ids.Ben!],
          ),
        ),
      );

      const games = await read<{ id: string; superseded: Date | null }>(
        `SELECT "id", "superseded_at" AS superseded FROM "games" ORDER BY "created_at"`,
      );
      const superseded: string = games[1]!.id;
      const current: string = games.find((row): boolean => row.superseded === null)!.id;
      const resolved = await inTransaction(async (transaction) => ({
        currentGame: await resolveMatchRoute(transaction, ids.Ada!, LEAGUE_ID, current),
        oldGame: await resolveMatchRoute(transaction, ids.Ada!, LEAGUE_ID, superseded),
        stranger: await resolveMatchRoute(transaction, randomUUID(), LEAGUE_ID, match),
        unknownGame: await resolveMatchRoute(transaction, ids.Ada!, LEAGUE_ID, randomUUID()),
      }));

      expect(resolved).toEqual({
        currentGame: match,
        oldGame: match,
        stranger: null,
        unknownGame: null,
      });
    });
  });

  describe(symbolName(settleDueResults), (): void => {
    it('settles only what is due, and no more than one run’s worth', async (): Promise<void> => {
      const matches: string[] = [
        await pending(ids.Ada!, [ids.Ben!, ids.Cara!]),
        await pending(ids.Ada!, [ids.Ben!, ids.Cara!]),
        await pending(ids.Ada!, [ids.Ben!, ids.Cara!]),
      ];

      await read(
        `UPDATE "result_revisions" SET "confirmation_deadline" = clock_timestamp() - interval '1 minute'
         WHERE "canonical_match_id" = ANY($1::uuid[])`,
        [[matches[0]!, matches[1]!]],
      );

      const firstRun: number = await inTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID, 1));
      const secondRun: number = await inTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID));
      const thirdRun: number = await inTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID));
      const [counts] = await read<{ confirmed: number; unconfirmed: number }>(
        `SELECT count(*) FILTER (WHERE "state" = 'CONFIRMED')::int AS confirmed,
                count(*) FILTER (WHERE "state" = 'UNCONFIRMED')::int AS unconfirmed
         FROM "result_revisions"`,
      );

      expect([firstRun, secondRun, thirdRun]).toEqual([1, 1, 0]);
      expect([counts!.confirmed, counts!.unconfirmed]).toEqual([2, 1]);
    });
  });
});
