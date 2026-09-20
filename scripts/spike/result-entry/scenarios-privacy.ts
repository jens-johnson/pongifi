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
 * ██████████████████████████████████ scripts/spike/result-entry/scenarios-privacy.ts ██████████████████████████████████
 *
 * Dispute-note isolation and redaction checks for the result-entry spike.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID } from 'node:crypto';

import { ResultAction } from '#shared/results';
import { withInteractiveTransaction } from '#utils/db/transaction';
import { redactNotesForAccount } from '#utils/results';

import { LEAGUE_ID, read, resetDatabase, seedLeague, settingsFixture } from './harness';
import { amendOrThrow, recordOrThrow, singles } from './scenarios-schema';
import type { IScenario, IScenarioResult } from './types';
import { PACKAGES } from './types';

/**
 * The words a case looks for everywhere a copy must not be
 * @internal
 * @constant
 */
const NOTE: string = 'Priya called the let, not me';

/**
 * Records a result and disputes it with a note, answering with the match and the disputing account
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @returns The match's canonical id and the accounts
 */
async function disputed(connectionString: string): Promise<{ ids: Record<string, string>; match: string }> {
  await resetDatabase(connectionString);

  const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara'], settingsFixture());
  const created = await withInteractiveTransaction(
    (transaction) =>
      recordOrThrow(transaction, ids.Ada!, {
        clientOperationId: randomUUID(),
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles([[11, 4]], [ids.Ben!, ids.Cara!], {
          playedAt: new Date(Date.now() - 3600000).toISOString(),
        }),
      }),
    { connectionString },
  );

  await withInteractiveTransaction(
    async (transaction) => {
      const outcome = await (
        await import('#utils/results')
      ).answerResult(transaction, ids.Ben!, {
        action: ResultAction.DISPUTE,
        canonicalMatchId: created.canonicalMatchId,
        clientOperationId: randomUUID(),
        expectedRevision: 1,
        note: NOTE,
      });

      if (!outcome.ok) {
        throw new Error(`the dispute was refused as ${outcome.refusal}`);
      }

      return outcome;
    },
    { connectionString },
  );

  return { ids, match: created.canonicalMatchId };
}

/**
 * The privacy checks
 * @public
 * @constant
 */
export const PRIVACY_SCENARIOS: readonly IScenario[] = [
  {
    package: PACKAGES.PRIVACY,
    name: 'a note lives in one place, with no copy in the journal, the receipts or the game rows',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await disputed(connectionString);

      const [copies] = await read<{
        actions: number;
        events: number;
        notes: number;
        receipts: number;
        revisions: number;
      }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "result_dispute_notes" WHERE "body" LIKE '%Priya%') AS notes,
                (SELECT count(*)::int FROM "result_revisions" WHERE "submission"::text LIKE '%Priya%' OR "reconstruction"::text LIKE '%Priya%') AS revisions,
                (SELECT count(*)::int FROM "result_operations" WHERE "effect"::text LIKE '%Priya%') AS receipts,
                (SELECT count(*)::int FROM "result_actions" a WHERE a::text LIKE '%Priya%') AS actions,
                (SELECT count(*)::int FROM "game_events" WHERE "detail"::text LIKE '%Priya%') AS events`,
      );

      return {
        detail: `notes ${copies!.notes}, journal ${copies!.revisions}, receipts ${copies!.receipts}, action rows ${copies!.actions}, events ${copies!.events}`,
        passed:
          copies!.notes === 1 &&
          copies!.revisions === 0 &&
          copies!.receipts === 0 &&
          copies!.actions === 0 &&
          copies!.events === 0,
      };
    },
  },
  {
    package: PACKAGES.PRIVACY,
    name: 'deleting the author redacts the words and leaves the scores and ratings standing',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      const { ids } = await disputed(connectionString);
      const redacted: number = await withInteractiveTransaction(
        (transaction) => redactNotesForAccount(transaction, ids.Ben!),
        { connectionString },
      );
      const [after] = await read<{ body: string | null; live: number; redacted_at: Date | null; rows: number }>(
        connectionString,
        `SELECT n."body", n."redacted_at",
                (SELECT count(*)::int FROM "result_dispute_notes") AS rows,
                (SELECT count(*)::int FROM "games" WHERE "superseded_at" IS NULL) AS live
         FROM "result_dispute_notes" n LIMIT 1`,
      );

      return {
        detail: `${redacted} note redacted; body ${after!.body === null ? 'null' : 'still present'}, row kept ${after!.rows === 1}, stamped ${after!.redacted_at !== null}, ${after!.live} game rows untouched`,
        passed:
          redacted === 1 &&
          after!.body === null &&
          after!.rows === 1 &&
          after!.redacted_at !== null &&
          after!.live === 1,
      };
    },
  },
  {
    package: PACKAGES.PRIVACY,
    name: 'deleting a seated player redacts a note on an earlier revision of the same match',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      const { ids, match } = await disputed(connectionString);

      // The correction supersedes the disputed revision; the note now hangs off a revision nobody reads by default
      await withInteractiveTransaction(
        (transaction) =>
          amendOrThrow(transaction, ids.Ada!, {
            canonicalMatchId: match,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            submission: singles([[11, 6]], [ids.Ben!, ids.Cara!], {
              playedAt: new Date(Date.now() - 3600000).toISOString(),
            }),
          }),
        { connectionString },
      );

      const redacted: number = await withInteractiveTransaction(
        (transaction) => redactNotesForAccount(transaction, ids.Cara!),
        { connectionString },
      );
      const [after] = await read<{ remaining: number; revisions: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "result_dispute_notes" WHERE "body" IS NOT NULL) AS remaining,
                (SELECT count(*)::int FROM "result_revisions") AS revisions`,
      );

      return {
        detail: `${redacted} note redacted across ${after!.revisions} revisions; ${after!.remaining} notes still carry words`,
        passed: redacted === 1 && after!.remaining === 0 && after!.revisions === 2,
      };
    },
  },
];
