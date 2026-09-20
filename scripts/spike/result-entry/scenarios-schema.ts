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
 * ██████████████████████████████████ scripts/spike/result-entry/scenarios-schema.ts ███████████████████████████████████
 *
 * Schema and reconstruction checks for the result-entry spike.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID } from 'node:crypto';

import type { IResultSubmission } from '#shared/results';
import { ResultEnding, ResultState, Seat } from '#shared/results';
import type { IMatchSettings, TMatchEvent } from '#shared/rules-engine';
import { GameType, replayMatch } from '#shared/rules-engine';
import { withInteractiveTransaction } from '#utils/db/transaction';
import type { IInteractiveTransaction } from '#utils/db/types';
import type { IResultEffect, TResultOutcome } from '#utils/results';
import { amendResult, recordResult, ResultRefusalError } from '#utils/results';

import { LEAGUE_ID, read, resetDatabase, seedLeague, settingsFixture } from './harness';
import type { IScenario, IScenarioResult } from './types';
import { PACKAGES } from './types';

/**
 * Unwraps a write's answer, turning a refusal back into a throw so a fixture that did not expect one fails loudly
 * @internal
 * @function
 * @param outcome - What the write answered
 * @throws ResultRefusalError when the write was refused
 * @returns What it did
 */
export function ok(outcome: TResultOutcome): IResultEffect {
  if (!outcome.ok) {
    throw new ResultRefusalError(outcome.refusal);
  }

  return outcome.value;
}

/**
 * Records a result, throwing on a refusal
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - Who is recording
 * @param request - The submission and the operation's identity
 * @returns What it did
 */
export async function recordOrThrow(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: Parameters<typeof recordResult>[2],
): Promise<IResultEffect> {
  return ok(await recordResult(transaction, actorId, request));
}

/**
 * Corrects a result, throwing on a refusal
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - Who is correcting
 * @param request - The corrected submission and the operation's identity
 * @returns What it did
 */
export async function amendOrThrow(
  transaction: IInteractiveTransaction,
  actorId: string,
  request: Parameters<typeof amendResult>[2],
): Promise<IResultEffect> {
  return ok(await amendResult(transaction, actorId, request));
}

/**
 * A singles submission from per-game scores
 * @internal
 * @function
 * @param rows - The scores, as `[a, b]` pairs
 * @param seats - The two accounts
 * @param overrides - What the case changes
 * @returns The submission
 */
export function singles(
  rows: [number, number][],
  seats: [string, string],
  overrides: Partial<IResultSubmission> = {},
): IResultSubmission {
  return {
    ending: ResultEnding.COMPLETED,
    gameType: GameType.SINGLES,
    games: rows.map(([a, b], index) => ({
      a,
      b,
      gameNumber: index + 1,
    })),
    playedAt: '2026-09-18T18:00:00.000Z',
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
 * Every schema and reconstruction check
 * @public
 * @constant
 */
export const SCHEMA_SCENARIOS: readonly IScenario[] = [
  {
    package: PACKAGES.SCHEMA,
    name: 'a best-of-three writes one revision, three game rows and a replayable log per game',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben'],
        settingsFixture({ matchFormat: 3 }),
      );

      await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles(
              [
                [11, 4],
                [9, 11],
                [11, 8],
              ],
              [ids.Ada!, ids.Ben!],
            ),
          }),
        { connectionString },
      );

      const games = await read<{ game_number: number; events: number; scores: string }>(
        connectionString,
        `SELECT rg."game_number",
                (SELECT count(*)::int FROM "game_events" e WHERE e."game_id" = g."id") AS "events",
                (SELECT string_agg(p."final_score"::text, '-' ORDER BY p."seat") FROM "game_participants" p WHERE p."game_id" = g."id") AS "scores"
         FROM "games" g
         JOIN "result_revision_games" rg ON rg."game_id" = g."id"
         JOIN "result_revisions" r ON r."id" = rg."result_revision_id" AND r."is_current"
         ORDER BY rg."game_number"`,
      );
      const revisions = await read<{ n: number }>(
        connectionString,
        `SELECT count(*)::int AS n FROM "result_revisions"`,
      );

      const expected: string = '1:16:11-4, 2:20:9-11, 3:19:11-8';
      const observed: string = games.map((row) => `${row.game_number}:${row.events}:${row.scores}`).join(', ');

      return {
        detail: `${revisions[0]!.n} revision, games ${observed}`,
        passed: revisions[0]!.n === 1 && observed === expected,
      };
    },
  },
  {
    package: PACKAGES.SCHEMA,
    name: 'every stored revision replays through the real engine to the scores it claims',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      const rows = await read<{
        reconstruction: { games: { events: TMatchEvent[]; scores: Record<string, number> }[] };
        settings_snapshot: IMatchSettings;
        revision: number;
      }>(
        connectionString,
        `SELECT "revision", "reconstruction", "settings_snapshot" FROM "result_revisions" ORDER BY "revision"`,
      );
      const checked: string[] = rows.map((row) => {
        const log: TMatchEvent[] = row.reconstruction.games.flatMap((game) => game.events);
        const state = replayMatch(row.settings_snapshot, log);

        return `r${row.revision}:${state.isComplete ? 'complete' : 'open'}:${state.gamesWon.A}-${state.gamesWon.B}`;
      });

      return {
        detail: checked.join(', '),
        passed: rows.length > 0 && checked.every((entry) => entry.includes('complete')),
      };
    },
  },
  {
    package: PACKAGES.SCHEMA,
    name: 'a 2 → 3 → 2 correction leaves only the current revision counted, and every old game addressable',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben'],
        settingsFixture({ matchFormat: 3, requireConfirmation: false }),
      );
      const created = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles(
              [
                [11, 4],
                [11, 6],
              ],
              [ids.Ada!, ids.Ben!],
            ),
          }),
        { connectionString },
      );

      await withInteractiveTransaction(
        (transaction) =>
          amendOrThrow(transaction, ids.Ada!, {
            canonicalMatchId: created.canonicalMatchId,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            submission: singles(
              [
                [11, 4],
                [9, 11],
                [11, 8],
              ],
              [ids.Ada!, ids.Ben!],
            ),
          }),
        { connectionString },
      );

      await withInteractiveTransaction(
        (transaction) =>
          amendOrThrow(transaction, ids.Ada!, {
            canonicalMatchId: created.canonicalMatchId,
            clientOperationId: randomUUID(),
            expectedRevision: 2,
            submission: singles(
              [
                [11, 4],
                [11, 6],
              ],
              [ids.Ada!, ids.Ben!],
            ),
          }),
        { connectionString },
      );

      const [counts] = await read<{ all_rows: number; live: number; revisions: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "games") AS all_rows,
                (SELECT count(*)::int FROM "games" WHERE "superseded_at" IS NULL AND "status" = 'COMPLETE') AS live,
                (SELECT count(*)::int FROM "result_revisions") AS revisions`,
      );
      const [addressable] = await read<{ n: number }>(
        connectionString,
        `SELECT count(*)::int AS n FROM "games" WHERE "superseded_at" IS NOT NULL`,
      );

      return {
        detail: `${counts!.revisions} revisions, ${counts!.all_rows} game rows in total, ${counts!.live} counted live, ${addressable!.n} superseded and still addressable`,
        passed: counts!.revisions === 3 && counts!.all_rows === 7 && counts!.live === 2 && addressable!.n === 5,
      };
    },
  },
  {
    package: PACKAGES.SCHEMA,
    name: 'a first-game retirement at nil-all in a best-of-seven is one unfinished row',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben'],
        settingsFixture({ matchFormat: 7, requireConfirmation: false }),
      );

      await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[0, 0]], [ids.Ada!, ids.Ben!], {
              ending: ResultEnding.RETIRED,
              retiredSeat: Seat.A1,
            }),
          }),
        { connectionString },
      );

      const rows = await read<{ outcome: string; seat: string; status: string }>(
        connectionString,
        `SELECT g."status", p."seat", p."outcome" FROM "games" g JOIN "game_participants" p ON p."game_id" = g."id" ORDER BY p."seat"`,
      );

      return {
        detail: rows.map((row) => `${row.seat}:${row.outcome}:${row.status}`).join(', '),
        passed:
          rows.length === 2 &&
          rows[0]!.status === 'RETIRED' &&
          rows[0]!.outcome === 'LOSS' &&
          rows[1]!.outcome === 'WIN',
      };
    },
  },
  {
    package: PACKAGES.SCHEMA,
    name: 'a score no legal rally order reaches is refused before anything is written',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      let refusal: string = 'none';

      try {
        await withInteractiveTransaction(
          (transaction) =>
            recordOrThrow(transaction, ids.Ada!, {
              clientOperationId: randomUUID(),
              expectedLeagueRevision: 1,
              leagueId: LEAGUE_ID,
              submission: singles([[13, 5]], [ids.Ada!, ids.Ben!]),
            }),
          { connectionString },
        );
      } catch (error: unknown) {
        refusal = error instanceof ResultRefusalError ? error.refusal : String(error);
      }

      const [counts] = await read<{ games: number; revisions: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "games") AS games, (SELECT count(*)::int FROM "result_revisions") AS revisions`,
      );

      return {
        detail: `refused as ${refusal}; ${counts!.revisions} revisions and ${counts!.games} game rows written`,
        passed: refusal === 'UNPLAYABLE' && counts!.games === 0 && counts!.revisions === 0,
      };
    },
  },
  {
    package: PACKAGES.SCHEMA,
    name: 'a form drawn against league rules that have since moved is refused rather than recorded under the new ones',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      let refusal: string = 'none';

      try {
        await withInteractiveTransaction(
          (transaction) =>
            recordOrThrow(transaction, ids.Ada!, {
              clientOperationId: randomUUID(),
              expectedLeagueRevision: 0,
              leagueId: LEAGUE_ID,
              submission: singles([[11, 4]], [ids.Ada!, ids.Ben!]),
            }),
          { connectionString },
        );
      } catch (error: unknown) {
        refusal = error instanceof ResultRefusalError ? error.refusal : String(error);
      }

      return { detail: `refused as ${refusal}`, passed: refusal === 'STALE_LEAGUE_RULES' };
    },
  },
  {
    package: PACKAGES.SCHEMA,
    name: 'a correction keeps the frozen format even when the league has changed its own',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben'],
        settingsFixture({ matchFormat: 3, requireConfirmation: false }),
      );
      const created = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles(
              [
                [11, 4],
                [11, 6],
              ],
              [ids.Ada!, ids.Ben!],
            ),
          }),
        { connectionString },
      );

      await read(
        connectionString,
        `UPDATE "leagues" SET "settings" = jsonb_set("settings", '{targetScore,SINGLES}', '21'),
           "configuration_revision" = "configuration_revision" + 1 WHERE "id" = $1`,
        [LEAGUE_ID],
      );

      await withInteractiveTransaction(
        (transaction) =>
          amendOrThrow(transaction, ids.Ada!, {
            canonicalMatchId: created.canonicalMatchId,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            submission: singles(
              [
                [11, 4],
                [11, 7],
              ],
              [ids.Ada!, ids.Ben!],
            ),
          }),
        { connectionString },
      );

      const rows = await read<{ revision: number; target: number }>(
        connectionString,
        `SELECT "revision", ("settings_snapshot" ->> 'targetScore')::int AS target
         FROM "result_revisions" ORDER BY "revision"`,
      );

      return {
        detail: rows.map((row) => `r${row.revision} target ${row.target}`).join(', '),
        passed: rows.length === 2 && rows.every((row) => row.target === 11),
      };
    },
  },
  {
    package: PACKAGES.SCHEMA,
    name: 'a birth with nobody left to ask settles in the operation that made it',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      const created = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: {
              ...singles([[11, 4]], [ids.Ada!, ids.Ben!]),
              seats: [
                {
                  guestName: null,
                  seat: Seat.A1,
                  userId: ids.Ada!,
                },
                {
                  guestName: 'Sam',
                  seat: Seat.B1,
                  userId: null,
                },
              ],
            },
          }),
        { connectionString },
      );
      const [row] = await read<{ reason: string; state: string }>(
        connectionString,
        `SELECT "state", "settled_reason" AS reason FROM "result_revisions" WHERE "id" = $1`,
        [created.resultRevisionId],
      );

      return {
        detail: `${row!.state} with reason ${row!.reason}`,
        passed: created.state === ResultState.CONFIRMED && row!.reason === 'NO_CONFIRMATION_NEEDED',
      };
    },
  },
];
