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
 * ██████████████████████████████████ scripts/spike/result-entry/scenarios-ratings.ts ██████████████████████████████████
 *
 * Rating replay and consistent-read checks for the result-entry spike.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID } from 'node:crypto';

import { ResultAction } from '#shared/results';
import { withInteractiveTransaction } from '#utils/db/transaction';
import { answerResult, settleDueResults } from '#utils/results';

import { LEAGUE_ID, read, resetDatabase, seedLeague, settingsFixture } from './harness';
import { amendOrThrow, recordOrThrow, singles } from './scenarios-schema';
import { latch } from './scenarios-transaction';
import type { IScenario, IScenarioResult } from './types';
import { PACKAGES } from './types';

/**
 * A league whose results settle the moment they are recorded, so a ladder case states only what it varies
 * @internal
 * @constant
 */
const NO_CONFIRMATION = settingsFixture({ requireConfirmation: false });

/**
 * An instant a number of hours before now, so a fixture that has to sit inside a frozen amendment window still does
 * on whatever day it is run
 * @internal
 * @function
 * @param hours - How long ago
 * @returns The instant, as an ISO string
 */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

/**
 * Records one settled singles result at a chosen play time
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @param recorder - Who records it
 * @param winner - The winning account
 * @param loser - The losing account
 * @param playedAt - When it was played
 * @returns The match's canonical id
 */
async function played(
  connectionString: string,
  recorder: string,
  winner: string,
  loser: string,
  playedAt: string,
): Promise<string> {
  const effect = await withInteractiveTransaction(
    (transaction) =>
      recordOrThrow(transaction, recorder, {
        clientOperationId: randomUUID(),
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles([[11, 4]], [winner, loser], { playedAt }),
      }),
    { connectionString },
  );

  return effect.canonicalMatchId;
}

/**
 * Reads the active ladder as a name-to-rating map, which is what two runs are compared on.
 *
 * The ordering is the replay's own total order read backwards, not the newest row by id: a player with two games at
 * the same instant has no "latest" one until the tie-break says so, and picking by game id would make their current
 * rating change every time a correction wrote a new row for the same score
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @returns Each player's current rating, keyed by display name
 */
async function ladder(connectionString: string): Promise<Record<string, number>> {
  const rows = await read<{ name: string; rating: number }>(
    connectionString,
    `SELECT DISTINCT ON (u."display_name") u."display_name" AS name, s."rating"
     FROM "rating_snapshots" s
     JOIN "active_rating_generations" a ON a."rating_generation_id" = s."rating_generation_id"
     JOIN "users" u ON u."id" = s."user_id"
     JOIN "games" g ON g."id" = s."game_id"
     JOIN "result_revision_games" rg ON rg."game_id" = g."id"
     JOIN "result_revisions" r ON r."id" = rg."result_revision_id"
     ORDER BY u."display_name", r."played_at" DESC, r."canonical_match_id" DESC, rg."game_number" DESC, g."id" DESC`,
  );

  return Object.fromEntries(rows.map((row) => [row.name, Math.round(row.rating * 100) / 100]));
}

/**
 * The rating and read checks
 * @public
 * @constant
 */
export const RATING_SCENARIOS: readonly IScenario[] = [
  {
    package: PACKAGES.RATINGS,
    name: 'correcting the first match in a chain moves a player who was never in it',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben', 'Cara', 'Dan'],
        NO_CONFIRMATION,
      );
      const firstPlayedAt: string = hoursAgo(3);
      const first: string = await played(connectionString, ids.Ada!, ids.Ada!, ids.Ben!, firstPlayedAt);

      await played(connectionString, ids.Ada!, ids.Ben!, ids.Cara!, hoursAgo(2));
      await played(connectionString, ids.Ada!, ids.Cara!, ids.Dan!, hoursAgo(1));

      const before: Record<string, number> = await ladder(connectionString);

      // Reverse the very first result: Ben beat Ada after all
      await withInteractiveTransaction(
        (transaction) =>
          amendOrThrow(transaction, ids.Ada!, {
            canonicalMatchId: first,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            submission: singles([[4, 11]], [ids.Ada!, ids.Ben!], { playedAt: firstPlayedAt }),
          }),
        { connectionString },
      );

      const after: Record<string, number> = await ladder(connectionString);
      const moved: string[] = Object.keys(before).filter((name) => before[name] !== after[name]);

      return {
        detail: `Dan ${before.Dan} → ${after.Dan}; every player whose rating moved: ${moved.join(', ')}`,
        passed: moved.includes('Dan') && moved.length === 4,
      };
    },
  },
  {
    package: PACKAGES.RATINGS,
    name: 'a voided match leaves the ladder exactly as if it had never been recorded',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben', 'Cara', 'Dan'],
        NO_CONFIRMATION,
      );

      await played(connectionString, ids.Ada!, ids.Ada!, ids.Ben!, hoursAgo(3));

      const voided: string = await played(connectionString, ids.Ada!, ids.Ben!, ids.Cara!, hoursAgo(2));

      await played(connectionString, ids.Ada!, ids.Cara!, ids.Dan!, hoursAgo(1));
      await withInteractiveTransaction(
        (transaction) =>
          answerResult(transaction, ids.Ada!, {
            action: ResultAction.VOID,
            canonicalMatchId: voided,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            note: null,
          }),
        { connectionString },
      );

      const afterVoid: Record<string, number> = await ladder(connectionString);

      await resetDatabase(connectionString);

      const rebuilt: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben', 'Cara', 'Dan'],
        NO_CONFIRMATION,
      );

      await played(connectionString, rebuilt.Ada!, rebuilt.Ada!, rebuilt.Ben!, hoursAgo(3));
      await played(connectionString, rebuilt.Ada!, rebuilt.Cara!, rebuilt.Dan!, hoursAgo(1));

      const never: Record<string, number> = await ladder(connectionString);
      const same: boolean = JSON.stringify(afterVoid) === JSON.stringify(never);

      return {
        detail: `after the void ${JSON.stringify(afterVoid)}; never recorded ${JSON.stringify(never)}`,
        passed: same,
      };
    },
  },
  {
    package: PACKAGES.RATINGS,
    name: 'two matches played at the same instant recompute to the same ladder every time',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara'], NO_CONFIRMATION);
      const tied: string = hoursAgo(1);
      const first: string = await played(connectionString, ids.Ada!, ids.Ada!, ids.Ben!, tied);

      await played(connectionString, ids.Ada!, ids.Ben!, ids.Cara!, tied);

      const before: Record<string, number> = await ladder(connectionString);

      // An amendment to the same scores changes nothing but forces the whole league to be replayed again
      await withInteractiveTransaction(
        (transaction) =>
          amendOrThrow(transaction, ids.Ada!, {
            canonicalMatchId: first,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            submission: singles([[11, 4]], [ids.Ada!, ids.Ben!], { playedAt: tied }),
          }),
        { connectionString },
      );

      const after: Record<string, number> = await ladder(connectionString);
      const [generations] = await read<{ n: number }>(
        connectionString,
        `SELECT count(*)::int AS n FROM "rating_generations"`,
      );

      return {
        detail: `${generations!.n} generations; ${JSON.stringify(before)} then ${JSON.stringify(after)}`,
        passed: JSON.stringify(before) === JSON.stringify(after) && generations!.n === 3,
      };
    },
  },
  {
    package: PACKAGES.RATINGS,
    name: 'a guest game and a rating-off league write no snapshots but still count as games played',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben'],
        settingsFixture({ ratingEnabled: false, requireConfirmation: false }),
      );

      await played(connectionString, ids.Ada!, ids.Ada!, ids.Ben!, hoursAgo(3));

      const [unrated] = await read<{ games: number; snapshots: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "games" WHERE "superseded_at" IS NULL AND "status" = 'COMPLETE') AS games,
                (SELECT count(*)::int FROM "rating_snapshots") AS snapshots`,
      );

      await resetDatabase(connectionString);

      const guests: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben'], NO_CONFIRMATION);

      await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, guests.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: {
              ...singles([[11, 4]], [guests.Ada!, guests.Ben!]),
              seats: [
                {
                  guestName: null,
                  seat: 'A1' as never,
                  userId: guests.Ada!,
                },
                {
                  guestName: 'Sam',
                  seat: 'B1' as never,
                  userId: null,
                },
              ],
            },
          }),
        { connectionString },
      );

      const [guested] = await read<{ games: number; snapshots: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "games" WHERE "superseded_at" IS NULL AND "status" = 'COMPLETE') AS games,
                (SELECT count(*)::int FROM "rating_snapshots") AS snapshots`,
      );

      return {
        detail: `rating off: ${unrated!.games} game, ${unrated!.snapshots} snapshots; with a guest: ${guested!.games} game, ${guested!.snapshots} snapshots`,
        passed: unrated!.games === 1 && unrated!.snapshots === 0 && guested!.games === 1 && guested!.snapshots === 0,
      };
    },
  },
  {
    package: PACKAGES.RATINGS,
    name: 'a reader during a publication sees a whole ladder, never half of the new one',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara'], NO_CONFIRMATION);

      await played(connectionString, ids.Ada!, ids.Ada!, ids.Ben!, hoursAgo(3));

      const publishing = latch();
      const release = latch();
      const writer: Promise<unknown> = withInteractiveTransaction(
        async (transaction) => {
          const effect = await recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ben!, ids.Cara!], { playedAt: hoursAgo(2) }),
          });

          publishing.open();
          await release.reached;

          return effect;
        },
        { connectionString },
      );

      await publishing.reached;

      const during = await read<{ n: number }>(
        connectionString,
        `SELECT count(*)::int AS n FROM "rating_snapshots" s
         JOIN "active_rating_generations" a ON a."rating_generation_id" = s."rating_generation_id"`,
      );

      release.open();
      await writer;

      const after = await read<{ n: number }>(
        connectionString,
        `SELECT count(*)::int AS n FROM "rating_snapshots" s
         JOIN "active_rating_generations" a ON a."rating_generation_id" = s."rating_generation_id"`,
      );

      return {
        detail: `${during[0]!.n} snapshots in the active ladder while the second result was uncommitted, ${after[0]!.n} after it committed`,
        passed: during[0]!.n === 2 && after[0]!.n === 4,
      };
    },
  },
  {
    package: PACKAGES.RATINGS,
    name: 'the public figures count only current, complete, confirmed game rows',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const confirmed: string = await played(connectionString, ids.Ada!, ids.Ben!, ids.Cara!, hoursAgo(3));

      await read(
        connectionString,
        `UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute' WHERE "canonical_match_id" = $1`,
        [confirmed],
      );
      await withInteractiveTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID), {
        connectionString,
      });

      // A second result that nobody has confirmed, which the landing figures must not claim
      await played(connectionString, ids.Ada!, ids.Ben!, ids.Cara!, hoursAgo(2));

      const [today] = await read<{ n: number }>(
        connectionString,
        `SELECT count(*)::int AS n FROM "games" WHERE "status" = 'COMPLETE'`,
      );
      const [corrected] = await read<{ n: number; points: number }>(
        connectionString,
        `SELECT count(*)::int AS n,
                (SELECT coalesce(sum(p."final_score"), 0)::int FROM "game_participants" p
                 JOIN "games" g2 ON g2."id" = p."game_id"
                 WHERE g2."status" = 'COMPLETE' AND g2."confirmation_status" = 'CONFIRMED' AND g2."superseded_at" IS NULL) AS points
         FROM "games" g
         WHERE g."status" = 'COMPLETE' AND g."confirmation_status" = 'CONFIRMED' AND g."superseded_at" IS NULL`,
      );

      return {
        detail: `today's predicate counts ${today!.n}; current, complete and confirmed counts ${corrected!.n} with ${corrected!.points} points`,
        passed: today!.n === 2 && corrected!.n === 1 && corrected!.points === 15,
      };
    },
  },
];
