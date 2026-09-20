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
import type { TResultOutcome } from '#utils/results';
import { answerResult, redactNotesForAccount, ResultRefusalError } from '#utils/results';

import { HOUR_MS, LEAGUE_ID, read, resetDatabase, seedLeague, settingsFixture } from './harness';
import { amendOrThrow, recordOrThrow, singles } from './scenarios-schema';
import { latch } from './scenarios-transaction';
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
async function disputed(
  connectionString: string,
  note: string | null = NOTE,
): Promise<{
  ids: Record<string, string>;
  match: string;
}> {
  await resetDatabase(connectionString);

  const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara'], settingsFixture());
  const created = await withInteractiveTransaction(
    (transaction) =>
      recordOrThrow(transaction, ids.Ada!, {
        clientOperationId: randomUUID(),
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles([[11, 4]], [ids.Ben!, ids.Cara!], {
          playedAt: new Date(Date.now() - HOUR_MS).toISOString(),
        }),
      }),
    { connectionString },
  );

  await withInteractiveTransaction(
    async (transaction) => {
      const outcome: TResultOutcome = await answerResult(transaction, ids.Ben!, {
        action: ResultAction.DISPUTE,
        canonicalMatchId: created.canonicalMatchId,
        clientOperationId: randomUUID(),
        expectedRevision: 1,
        note,
      });

      if (!outcome.ok) {
        throw new ResultRefusalError(outcome.refusal);
      }

      return outcome;
    },
    { connectionString },
  );

  return { ids, match: created.canonicalMatchId };
}

/**
 * Records a result nobody has answered yet, so a case can time a dispute against something else
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @returns The accounts and the match
 */
async function pending(connectionString: string): Promise<{ ids: Record<string, string>; match: string }> {
  await resetDatabase(connectionString);

  const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara'], settingsFixture());
  const created = await withInteractiveTransaction(
    (transaction) =>
      recordOrThrow(transaction, ids.Ada!, {
        clientOperationId: randomUUID(),
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles([[11, 4]], [ids.Ben!, ids.Cara!], {
          playedAt: new Date(Date.now() - HOUR_MS).toISOString(),
        }),
      }),
    { connectionString },
  );

  return { ids, match: created.canonicalMatchId };
}

/**
 * Disputes a result with a note on its own connection, holding every lock the write took until it is released.
 *
 * This is how a race is arranged rather than hoped for: the note's transaction sits between its own account locks and
 * its commit, which is exactly the window a deletion has to contend with
 * @internal
 * @function
 * @param connectionString - The disposable database
 * @param context - The accounts, the match, and the latches the case drives it with
 * @returns The write's answer
 */
function disputeHolding(
  connectionString: string,
  context: { held: ReturnType<typeof latch>; ids: Record<string, string>; match: string; release: Promise<void> },
): Promise<TResultOutcome> {
  return withInteractiveTransaction(
    async (transaction) => {
      const outcome: TResultOutcome = await answerResult(transaction, context.ids.Ben!, {
        action: ResultAction.DISPUTE,
        canonicalMatchId: context.match,
        clientOperationId: randomUUID(),
        expectedRevision: 1,
        note: NOTE,
      });

      context.held.open();
      await context.release;

      return outcome;
    },
    { connectionString, limits: { idleTimeoutMs: 30000, operationTimeoutMs: 30000 } },
  );
}

/**
 * How the note a case wrote reads now
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @returns The note's body, its redaction stamp, and how many notes there are
 */
async function noteState(
  connectionString: string,
): Promise<{ body: string | null; redacted_at: Date | null; rows: number }> {
  const [row] = await read<{ body: string | null; redacted_at: Date | null; rows: number }>(
    connectionString,
    `SELECT n."body", n."redacted_at", (SELECT count(*)::int FROM "result_dispute_notes") AS rows
     FROM "result_dispute_notes" n LIMIT 1`,
  );

  return row!;
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
    name: 'a note that commits first is found by the deletion that was waiting behind it',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      const { ids, match } = await pending(connectionString);
      const held = latch();
      const release = latch();
      const noting: Promise<TResultOutcome> = disputeHolding(connectionString, {
        held,
        ids,
        match,
        release: release.reached,
      });

      await held.reached;

      // The deletion cannot even mark the account until the note's transaction lets go of the row it shares with it
      const deleting: Promise<number> = withInteractiveTransaction(
        async (transaction) => {
          await transaction.query(`UPDATE "users" SET "deleted_at" = now() WHERE "id" = $1`, [ids.Cara!]);

          return redactNotesForAccount(transaction, ids.Cara!);
        },
        {
          connectionString,
          limits: {
            lockTimeoutMs: 20000,
            operationTimeoutMs: 30000,
            statementTimeoutMs: 20000,
          },
        },
      );

      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 300);
      });

      release.open();

      const [outcome, redacted] = await Promise.all([noting, deleting]);
      const note = await noteState(connectionString);

      return {
        detail: `the dispute ${outcome.ok ? 'committed' : `was refused as ${outcome.refusal}`} and the deletion redacted ${redacted}; body ${note.body === null ? 'null' : 'still present'}, stamped ${note.redacted_at !== null}, ${note.rows} note row`,
        passed: outcome.ok && redacted === 1 && note.body === null && note.redacted_at !== null && note.rows === 1,
      };
    },
  },
  {
    package: PACKAGES.PRIVACY,
    name: 'a note written while a deletion was committing is born with no words in it',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      const { ids, match } = await pending(connectionString);
      const held = latch();
      const release = latch();
      const deleting: Promise<number> = withInteractiveTransaction(
        async (transaction) => {
          await transaction.query(`UPDATE "users" SET "deleted_at" = now() WHERE "id" = $1`, [ids.Cara!]);

          const redacted: number = await redactNotesForAccount(transaction, ids.Cara!);

          held.open();
          await release.reached;

          return redacted;
        },
        { connectionString, limits: { idleTimeoutMs: 30000, operationTimeoutMs: 30000 } },
      );

      await held.reached;

      // Reaches the accounts the note could name and waits there, behind the deletion's own lock on that row
      const noting: Promise<TResultOutcome> = withInteractiveTransaction(
        (transaction) =>
          answerResult(transaction, ids.Ben!, {
            action: ResultAction.DISPUTE,
            canonicalMatchId: match,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            note: NOTE,
          }),
        {
          connectionString,
          limits: {
            lockTimeoutMs: 20000,
            operationTimeoutMs: 30000,
            statementTimeoutMs: 20000,
          },
        },
      );

      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 300);
      });

      release.open();

      const [redacted, outcome] = await Promise.all([deleting, noting]);
      const note = await noteState(connectionString);
      const [copies] = await read<{ n: number }>(
        connectionString,
        `SELECT count(*)::int AS n FROM "result_dispute_notes" WHERE "body" LIKE '%Priya%'`,
      );

      return {
        detail: `the deletion found ${redacted} existing notes and the dispute ${outcome.ok ? 'committed' : `was refused as ${outcome.refusal}`}; body ${note.body === null ? 'null' : 'still present'}, stamped ${note.redacted_at !== null}, ${copies!.n} copies of the words anywhere`,
        passed: outcome.ok && redacted === 0 && note.body === null && note.redacted_at !== null && copies!.n === 0,
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
