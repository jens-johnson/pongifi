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
 * ██████████████████████████████████ scripts/spike/result-entry/scenarios-budget.ts ███████████████████████████████████
 *
 * Runtime and storage measurements for the result-entry spike.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID } from 'node:crypto';

import { DatabaseError } from '@neondatabase/serverless';

import { DEFAULT_TRANSACTION_LIMITS } from '#utils/db/constants';
import {
  TransactionBudgetError,
  TransactionOutcomeUnknownError,
  withInteractiveTransaction,
} from '#utils/db/transaction';
import type { IPublishedGeneration } from '#utils/results';
import { publishRatingGeneration, settleDueResults } from '#utils/results';

import { LEAGUE_ID, read, resetDatabase, seedLeague, settingsFixture } from './harness';
import { recordOrThrow, singles } from './scenarios-schema';
import type { IScenario, IScenarioResult } from './types';
import { PACKAGES } from './types';

/**
 * How many eligible game rows each measurement is taken at. Test sizes, not a promised supported capacity
 * @internal
 * @constant
 */
const SIZES: readonly number[] = [100, 1000, 10000];

/**
 * How many accounts the seeded matches rotate between, so the ladder is a real chain of transitive opponents rather
 * than one pair playing itself
 * @internal
 * @constant
 */
const PLAYERS: readonly string[] = ['Ada', 'Ben', 'Cara', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal'];

/**
 * Seeds a league with settled singles results, written directly rather than through the service.
 *
 * Recording ten thousand results one at a time would spend its whole time replaying the ladder after each, which is
 * the cost being measured rather than the fixture. The rows written here are the same shape the service writes
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @param count - How many matches to write
 * @returns The seeded accounts
 */
async function seedLadder(connectionString: string, count: number): Promise<Record<string, string>> {
  await resetDatabase(connectionString);

  const ids: Record<string, string> = await seedLeague(
    connectionString,
    [...PLAYERS],
    settingsFixture({ requireConfirmation: false }),
  );
  const players: string[] = PLAYERS.map((name: string): string => ids[name]!);

  await read(
    connectionString,
    `WITH seeded AS (
       SELECT i,
              gen_random_uuid() AS revision_id,
              gen_random_uuid() AS game_id,
              (now() - ((10000 - i) || ' minutes')::interval) AS played_at,
              ($2::uuid[])[(i % ${PLAYERS.length}) + 1] AS winner,
              ($2::uuid[])[((i + 1) % ${PLAYERS.length}) + 1] AS loser
       FROM generate_series(1, $1) AS i
     ),
     revisions AS (
       INSERT INTO "result_revisions" ("id", "canonical_match_id", "league_id", "revision", "is_current", "state",
         "game_type", "settings_snapshot", "policy_snapshot", "league_configuration_revision", "submission",
         "reconstruction", "reconstruction_version", "submission_digest", "played_at", "original_played_at",
         "submitted_at", "settled_at", "settled_reason", "recorded_by")
       SELECT s.revision_id, s.revision_id, $3, 1, true, 'CONFIRMED', 'SINGLES', $4::jsonb, $5::jsonb, 1,
              '{}'::jsonb, '{}'::jsonb, 1, 'seeded', s.played_at, s.played_at, s.played_at, s.played_at,
              'NO_CONFIRMATION_NEEDED', $6
       FROM seeded s
       RETURNING "id"
     ),
     inserted_games AS (
       INSERT INTO "games" ("id", "league_id", "match_id", "game_number", "type", "status", "confirmation_status",
         "confirmed_at", "recording_mode", "settings_snapshot", "created_by", "ended_at", "result_revision_id")
       SELECT s.game_id, $3, s.revision_id, 1, 'SINGLES', 'COMPLETE', 'CONFIRMED', s.played_at, 'RETROACTIVE',
              $4::jsonb, $6, s.played_at, s.revision_id
       FROM seeded s
       RETURNING "id"
     ),
     links AS (
       INSERT INTO "result_revision_games" ("result_revision_id", "game_id", "game_number")
       SELECT s.revision_id, s.game_id, 1 FROM seeded s
       RETURNING "game_id"
     )
     INSERT INTO "game_participants" ("game_id", "user_id", "side", "final_score", "outcome", "result_revision_id", "seat")
     SELECT s.game_id, s.winner, 'A'::participant_side, 11, 'WIN'::participant_outcome, s.revision_id, 'A1' FROM seeded s
     UNION ALL
     SELECT s.game_id, s.loser, 'B'::participant_side, 4, 'LOSS'::participant_outcome, s.revision_id, 'B1' FROM seeded s`,
    [
      count,
      players,
      LEAGUE_ID,
      JSON.stringify({
        cutthroatTimeCap: 0,
        expediteEnabled: false,
        gameType: 'SINGLES',
        matchFormat: 1,
        serviceInterval: 2,
        targetScore: 11,
        winningMargin: 2,
      }),
      JSON.stringify({
        provisionalGames: 5,
        ratingEnabled: true,
        requireConfirmation: false,
        resultAmendmentWindow: 48,
        resultConfirmationWindow: 24,
        version: 1,
        whoCanRecordResults: 'PARTICIPANTS',
      }),
      ids.Ada!,
    ],
  );

  return ids;
}

/**
 * How much space the generation tables take, in bytes
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @returns The total size of the snapshot and generation tables
 */
async function generationBytes(connectionString: string): Promise<number> {
  const [row] = await read<{ bytes: string }>(
    connectionString,
    `SELECT (pg_total_relation_size('rating_snapshots') + pg_total_relation_size('rating_generations'))::text AS bytes`,
  );

  return Number(row!.bytes);
}

/**
 * Measures one transition at one ladder size
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @param count - How many game rows the league already has
 * @returns A line of measurements
 */
async function measure(connectionString: string, count: number): Promise<{ detail: string; withinBudget: boolean }> {
  const ids: Record<string, string> = await seedLadder(connectionString, count);
  const before: number = await generationBytes(connectionString);
  const started: number = performance.now();

  // The deployed limits, not raised ones: a measurement taken under a two-minute ceiling says nothing about whether the
  // operation fits the budget the application will actually run it under
  await withInteractiveTransaction(
    (transaction) =>
      recordOrThrow(transaction, ids.Ada!, {
        clientOperationId: randomUUID(),
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles([[11, 4]], [ids.Ada!, ids.Ben!], { playedAt: new Date().toISOString() }),
      }),
    { connectionString },
  );

  const elapsed: number = performance.now() - started;
  const [written] = await read<{ generations: number; snapshots: number }>(
    connectionString,
    `SELECT (SELECT count(*)::int FROM "rating_snapshots") AS snapshots,
            (SELECT count(*)::int FROM "rating_generations") AS generations`,
  );
  const after: number = await generationBytes(connectionString);

  // A second publication on the same league, for the split the transition's own figure cannot give: the whole
  // transaction above also writes a revision, its game rows and its events
  const published: IPublishedGeneration = await withInteractiveTransaction(
    (transaction) => publishRatingGeneration(transaction, LEAGUE_ID, null),
    { connectionString },
  );
  const { engineMs, insertMs, readMs } = published.timings;

  return {
    detail:
      `${count} rows → ${elapsed.toFixed(0)}ms for the whole transaction ` +
      `(read ${readMs.toFixed(0)}ms, engine ${engineMs.toFixed(0)}ms, snapshot write ${insertMs.toFixed(0)}ms), ` +
      `${written!.snapshots} snapshots in ${written!.generations} generation, ` +
      `${((after - before) / 1024 / 1024).toFixed(2)} MB of generation storage`,
    withinBudget: elapsed < DEFAULT_TRANSACTION_LIMITS.operationTimeoutMs,
  };
}

/**
 * The runtime-budget measurements
 * @public
 * @constant
 */
export const BUDGET_SCENARIOS: readonly IScenario[] = [
  {
    package: PACKAGES.BUDGET,
    name: 'one transition under the deployed limits, at 100, 1,000 and 10,000 eligible game rows',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      const measurements: { detail: string; withinBudget: boolean }[] = [];

      for (const size of SIZES) {
        measurements.push(await measure(connectionString, size));
      }

      return {
        detail: measurements.map((measurement): string => measurement.detail).join('\n        '),
        passed: measurements.every((measurement): boolean => measurement.withinBudget),
      };
    },
  },
  {
    package: PACKAGES.BUDGET,
    name: 'a backdated correction near the beginning of a 1,000-row league costs the same full replay',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await seedLadder(connectionString, 1000);

      const [oldest] = await read<{ id: string; played_at: Date }>(
        connectionString,
        `SELECT "canonical_match_id" AS id, "played_at" FROM "result_revisions" ORDER BY "played_at" LIMIT 1`,
      );

      await read(
        connectionString,
        `UPDATE "result_revisions" SET "state" = 'UNCONFIRMED', "settled_at" = NULL, "settled_reason" = NULL,
           "confirmation_deadline" = now() - interval '1 minute' WHERE "canonical_match_id" = $1`,
        [oldest!.id],
      );

      const started: number = performance.now();
      const settled: number = await withInteractiveTransaction(
        (transaction) => settleDueResults(transaction, LEAGUE_ID),
        { connectionString },
      );
      const elapsed: number = performance.now() - started;

      return {
        detail: `settling the oldest of 1,000 results took ${elapsed.toFixed(0)}ms and settled ${settled}`,
        passed: settled === 1,
      };
    },
  },
  {
    package: PACKAGES.BUDGET,
    name: 'two writers on one 1,000-row league serialize, and the second pays the first one’s replay as lock wait',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      const ids: Record<string, string> = await seedLadder(connectionString, 1000);
      const record = (): Promise<{ elapsed: number }> => {
        const started: number = performance.now();

        return withInteractiveTransaction(
          (transaction) =>
            recordOrThrow(transaction, ids.Ada!, {
              clientOperationId: randomUUID(),
              expectedLeagueRevision: 1,
              leagueId: LEAGUE_ID,
              submission: singles([[11, 4]], [ids.Ada!, ids.Ben!], { playedAt: new Date().toISOString() }),
            }),
          { connectionString },
        ).then((): { elapsed: number } => ({ elapsed: performance.now() - started }));
      };
      const [first, second] = await Promise.all([record(), record()]);
      const [counts] = await read<{ generations: number; pointers: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "rating_generations") AS generations,
                (SELECT count(*)::int FROM "active_rating_generations") AS pointers`,
      );

      return {
        detail: `two concurrent writers took ${first!.elapsed.toFixed(0)}ms and ${second!.elapsed.toFixed(0)}ms; ${counts!.generations} generations published, ${counts!.pointers} active pointer`,
        passed: counts!.generations === 2 && counts!.pointers === 1,
      };
    },
  },
  {
    package: PACKAGES.BUDGET,
    name: 'a sequence of short statements that outruns the whole-operation budget writes nothing',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);
      await seedLeague(connectionString, ['Ada', 'Ben']);

      let thrown: string = 'nothing';
      const started: number = performance.now();

      try {
        await withInteractiveTransaction(
          async (transaction) => {
            await transaction.query(`UPDATE "leagues" SET "name" = 'renamed' WHERE "id" = $1`, [LEAGUE_ID]);

            // Ten statements, each of them well inside the statement limit and none of them waiting for a lock: the
            // shape a long rating replay has, and the one no database-side limit refuses
            for (let index = 0; index < 10; index += 1) {
              await transaction.query('SELECT pg_sleep(0.2)');
            }
          },
          { connectionString, limits: { operationTimeoutMs: 800, statementTimeoutMs: 5000 } },
        );
      } catch (error: unknown) {
        thrown = error instanceof TransactionBudgetError ? 'the operation budget' : String(error);
      }

      const elapsed: number = performance.now() - started;
      const [league] = await read<{ name: string }>(connectionString, `SELECT "name" FROM "leagues" WHERE "id" = $1`, [
        LEAGUE_ID,
      ]);

      return {
        detail: `refused by ${thrown} after ${elapsed.toFixed(0)}ms; league name is still "${league!.name}"`,
        passed: thrown === 'the operation budget' && league!.name === 'Spike League' && elapsed < 1500,
      };
    },
  },
  {
    package: PACKAGES.BUDGET,
    name: 'a commit the database itself refuses is a failure, not an outcome nobody knows',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);
      await seedLeague(connectionString, ['Ada', 'Ben']);

      let thrown: unknown = undefined;

      try {
        await withInteractiveTransaction(
          async (transaction) => {
            await transaction.query(`UPDATE "leagues" SET "name" = 'renamed' WHERE "id" = $1`, [LEAGUE_ID]);

            // A violation the server cannot see until the transaction ends, which is how a real `COMMIT` is made to
            // come back with an error of the database's own composing rather than with silence
            await transaction.query(
              `CREATE TEMP TABLE "deferred_check" ("id" integer PRIMARY KEY DEFERRABLE INITIALLY DEFERRED)`,
            );
            await transaction.query(`INSERT INTO "deferred_check" ("id") VALUES (1), (1)`);
          },
          { connectionString },
        );
      } catch (error: unknown) {
        thrown = error;
      }

      const [league] = await read<{ name: string }>(connectionString, `SELECT "name" FROM "leagues" WHERE "id" = $1`, [
        LEAGUE_ID,
      ]);
      const refused: boolean = thrown instanceof DatabaseError && thrown.severity === 'ERROR';
      const described: string =
        thrown instanceof DatabaseError
          ? `${thrown.severity} ${thrown.code}`
          : `${(thrown as Error | undefined)?.name ?? 'nothing'}`;

      // The distinction the helper draws is only as good as what the driver really hands it: this is where the
      // severity and the code a commit refusal actually carries are read off the wire rather than assumed
      return {
        detail: `the commit came back as ${described} and the helper reported it as a failure rather than an unknown outcome; league name is still "${league!.name}"`,
        passed: refused && !(thrown instanceof TransactionOutcomeUnknownError) && league!.name === 'Spike League',
      };
    },
  },
];
