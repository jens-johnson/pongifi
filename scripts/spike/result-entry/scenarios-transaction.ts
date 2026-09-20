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
 * ████████████████████████████████ scripts/spike/result-entry/scenarios-transaction.ts ████████████████████████████████
 *
 * Transaction-path, concurrency and recovery checks for the result-entry spike.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { randomUUID } from 'node:crypto';

import { ResultAction, ResultState } from '#shared/results';
import { withInteractiveTransaction } from '#utils/db/transaction';
import type { IResultEffect, TResultOutcome } from '#utils/results';
import { answerResult, ResultRefusalError, settleDueResults } from '#utils/results';

import { LEAGUE_ID, read, resetDatabase, seedLeague, settingsFixture } from './harness';
import { amendOrThrow, disputeOne, ok, recordOrThrow, singles } from './scenarios-schema';
import type { IScenario, IScenarioResult } from './types';
import { PACKAGES } from './types';

/**
 * Answers a result, throwing on a refusal
 * @internal
 * @async
 * @function
 * @param transaction - The open transaction
 * @param actorId - Who is answering
 * @param request - The action and the operation's identity
 * @returns What it did
 */
async function answerOrThrow(
  transaction: Parameters<typeof answerResult>[0],
  actorId: string,
  request: Parameters<typeof answerResult>[2],
): Promise<IResultEffect> {
  return ok(await answerResult(transaction, actorId, request));
}

/**
 * A latch two transactions use to meet at a chosen point, so an interleaving is arranged rather than hoped for
 * @internal
 * @function
 * @returns The latch and the function that releases it
 */
export function latch(): { open: () => void; reached: Promise<void> } {
  let open: () => void = (): void => undefined;
  const reached: Promise<void> = new Promise<void>((resolve: () => void): void => {
    open = resolve;
  });

  return { open, reached };
}

/**
 * Reads what a thrown value was refused as
 * @internal
 * @function
 * @param error - What was thrown
 * @returns The refusal, or the message
 */
export function refusalOf(error: unknown): string {
  if (error instanceof ResultRefusalError) {
    return error.refusal;
  }

  return error instanceof Error ? error.message.split('\n')[0]! : String(error);
}

/**
 * Records one confirmed singles result and answers with its match
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @param recorder - Who records it
 * @param seats - The two seated accounts
 * @param rows - The scores
 * @returns What the creation did
 */
export async function recordOne(
  connectionString: string,
  recorder: string,
  seats: [string, string],
  rows: [number, number][] = [[11, 4]],
): Promise<IResultEffect> {
  return withInteractiveTransaction(
    (transaction) =>
      recordOrThrow(transaction, recorder, {
        clientOperationId: randomUUID(),
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles(rows, seats),
      }),
    { connectionString },
  );
}

/**
 * How many backends this database has open, so a transport can be shown to clean up after itself
 * @internal
 * @async
 * @function
 * @param connectionString - The disposable database
 * @returns The number of connections other than the counting one
 */
async function openConnections(connectionString: string): Promise<number> {
  const [row] = await read<{ n: number }>(
    connectionString,
    `SELECT count(*)::int AS n FROM "pg_stat_activity"
     WHERE "datname" = current_database() AND "pid" <> pg_backend_pid()`,
  );

  return row!.n;
}

/**
 * The real-transaction-path checks
 * @public
 * @constant
 */
export const TRANSACTION_SCENARIOS: readonly IScenario[] = [
  {
    package: PACKAGES.TRANSACTION,
    name: 'a failure before commit leaves no result, no game rows and no rating generation',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      let thrown: string = 'none';

      try {
        await withInteractiveTransaction(
          async (transaction) => {
            await recordOrThrow(transaction, ids.Ada!, {
              clientOperationId: randomUUID(),
              expectedLeagueRevision: 1,
              leagueId: LEAGUE_ID,
              submission: singles([[11, 4]], [ids.Ada!, ids.Ben!]),
            });

            throw new Error('the function died before its answer');
          },
          { connectionString },
        );
      } catch (error: unknown) {
        thrown = refusalOf(error);
      }

      const [counts] = await read<{ games: number; generations: number; revisions: number; snapshots: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "games") AS games,
                (SELECT count(*)::int FROM "result_revisions") AS revisions,
                (SELECT count(*)::int FROM "rating_generations") AS generations,
                (SELECT count(*)::int FROM "rating_snapshots") AS snapshots`,
      );

      return {
        detail: `threw "${thrown}"; ${counts!.revisions} revisions, ${counts!.games} games, ${counts!.generations} generations, ${counts!.snapshots} snapshots`,
        passed: counts!.revisions === 0 && counts!.games === 0 && counts!.generations === 0 && counts!.snapshots === 0,
      };
    },
  },
  {
    package: PACKAGES.TRANSACTION,
    name: 'a second writer meets the league lock and is refused by the lock timeout rather than interleaving',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      const holding = latch();
      const release = latch();

      const first: Promise<IResultEffect> = withInteractiveTransaction(
        async (transaction) => {
          const effect = await recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ada!, ids.Ben!]),
          });

          holding.open();
          await release.reached;

          return effect;
        },
        { connectionString },
      );

      await holding.reached;

      let refusal: string = 'none';

      try {
        await withInteractiveTransaction(
          (transaction) =>
            recordOrThrow(transaction, ids.Ada!, {
              clientOperationId: randomUUID(),
              expectedLeagueRevision: 1,
              leagueId: LEAGUE_ID,
              submission: singles([[11, 6]], [ids.Ada!, ids.Ben!]),
            }),
          { connectionString, limits: { lockTimeoutMs: 700 } },
        );
      } catch (error: unknown) {
        refusal = refusalOf(error);
      }

      release.open();
      await first;

      const [counts] = await read<{ revisions: number }>(
        connectionString,
        `SELECT count(*)::int AS revisions FROM "result_revisions"`,
      );

      return {
        detail: `second writer refused with "${refusal}"; ${counts!.revisions} result recorded`,
        passed: refusal.includes('lock timeout') && counts!.revisions === 1,
      };
    },
  },
  {
    package: PACKAGES.TRANSACTION,
    name: 'the transport leaves no connection behind after twenty transactions',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(
        connectionString,
        ['Ada', 'Ben'],
        settingsFixture({ requireConfirmation: false }),
      );
      const before: number = await openConnections(connectionString);

      for (let index = 0; index < 20; index += 1) {
        await recordOne(connectionString, ids.Ada!, [ids.Ada!, ids.Ben!], [[11, index % 10]]);
      }

      // The driver closes asynchronously, so a moment is allowed before the backends are counted
      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 500);
      });

      const after: number = await openConnections(connectionString);

      return {
        detail: `${before} connections before, ${after} after twenty committed transactions`,
        passed: after <= before,
      };
    },
  },
  {
    package: PACKAGES.TRANSACTION,
    name: 'a statement that outruns its limit ends the transaction visibly rather than half-writing',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);
      await seedLeague(connectionString, ['Ada', 'Ben']);

      let refusal: string = 'none';

      try {
        await withInteractiveTransaction(
          async (transaction) => {
            await transaction.query(`UPDATE "leagues" SET "name" = 'renamed' WHERE "id" = $1`, [LEAGUE_ID]);
            await transaction.query('SELECT pg_sleep(2)');
          },
          { connectionString, limits: { statementTimeoutMs: 300 } },
        );
      } catch (error: unknown) {
        refusal = refusalOf(error);
      }

      const [league] = await read<{ name: string }>(connectionString, `SELECT "name" FROM "leagues" WHERE "id" = $1`, [
        LEAGUE_ID,
      ]);

      return {
        detail: `refused with "${refusal}"; league name is still "${league!.name}"`,
        passed: refusal.includes('statement timeout') && league!.name === 'Spike League',
      };
    },
  },
];

/**
 * The concurrency and recovery checks, every one of them across independent connections
 * @public
 * @constant
 */
export const CONCURRENCY_SCENARIOS: readonly IScenario[] = [
  {
    package: PACKAGES.CONCURRENCY,
    name: 'two identical creates under one operation key write one result and return one receipt',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      const clientOperationId: string = randomUUID();
      const request = {
        clientOperationId,
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles([[11, 4]], [ids.Ada!, ids.Ben!]),
      };
      const both: PromiseSettledResult<IResultEffect>[] = await Promise.allSettled([
        withInteractiveTransaction((transaction) => recordOrThrow(transaction, ids.Ada!, request), {
          connectionString,
        }),
        withInteractiveTransaction((transaction) => recordOrThrow(transaction, ids.Ada!, request), {
          connectionString,
        }),
      ]);
      const [counts] = await read<{ receipts: number; revisions: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "result_revisions") AS revisions,
                (SELECT count(*)::int FROM "result_operations") AS receipts`,
      );
      const effects: string[] = both.map((outcome) =>
        outcome.status === 'fulfilled' ? outcome.value.resultRevisionId : `rejected: ${refusalOf(outcome.reason)}`,
      );

      return {
        detail: `${counts!.revisions} revision, ${counts!.receipts} receipt; both answers ${effects[0] === effects[1] ? 'identical' : `differ (${effects.join(' vs ')})`}`,
        passed: counts!.revisions === 1 && counts!.receipts === 1 && effects[0] === effects[1],
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'the same key with a changed body conflicts instead of writing a second result',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      const clientOperationId: string = randomUUID();

      await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId,
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ada!, ids.Ben!]),
          }),
        { connectionString },
      );

      let refusal: string = 'none';

      try {
        await withInteractiveTransaction(
          (transaction) =>
            recordOrThrow(transaction, ids.Ada!, {
              clientOperationId,
              expectedLeagueRevision: 1,
              leagueId: LEAGUE_ID,
              submission: singles([[11, 9]], [ids.Ada!, ids.Ben!]),
            }),
          { connectionString },
        );
      } catch (error: unknown) {
        refusal = refusalOf(error);
      }

      const [counts] = await read<{ revisions: number }>(
        connectionString,
        `SELECT count(*)::int AS revisions FROM "result_revisions"`,
      );

      return {
        detail: `refused as ${refusal}; ${counts!.revisions} revision written`,
        passed: refusal === 'OPERATION_BODY_CHANGED' && counts!.revisions === 1,
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'a lost answer is resolved by replaying the identical action, not by writing a second one',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben']);
      const clientOperationId: string = randomUUID();
      const request = {
        clientOperationId,
        expectedLeagueRevision: 1,
        leagueId: LEAGUE_ID,
        submission: singles([[11, 4]], [ids.Ada!, ids.Ben!]),
      };
      const first: IResultEffect = await withInteractiveTransaction(
        (transaction) => recordOrThrow(transaction, ids.Ada!, request),
        { connectionString },
      );
      const retry: IResultEffect = await withInteractiveTransaction(
        (transaction) => recordOrThrow(transaction, ids.Ada!, request),
        { connectionString },
      );
      const [counts] = await read<{ generations: number; revisions: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "result_revisions") AS revisions,
                (SELECT count(*)::int FROM "rating_generations") AS generations`,
      );

      return {
        detail: `retry answered ${retry.resultRevisionId === first.resultRevisionId ? 'with the original receipt' : 'with something else'}; ${counts!.revisions} revision, ${counts!.generations} generation`,
        passed:
          retry.resultRevisionId === first.resultRevisionId && counts!.revisions === 1 && counts!.generations === 1,
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'two final confirmations racing settle the result once and publish one ladder',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const created: IResultEffect = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ben!, ids.Cara!]),
          }),
        { connectionString },
      );
      const confirm = (actor: string): Promise<IResultEffect> =>
        withInteractiveTransaction(
          (transaction) =>
            answerOrThrow(transaction, actor, {
              action: ResultAction.CONFIRM,
              canonicalMatchId: created.canonicalMatchId,
              clientOperationId: randomUUID(),
              expectedRevision: 1,
              note: null,
            }),
          { connectionString },
        );
      const both: PromiseSettledResult<IResultEffect>[] = await Promise.allSettled([
        confirm(ids.Ben!),
        confirm(ids.Cara!),
      ]);
      const [state] = await read<{ generations: number; reason: string; settled: number; state: string }>(
        connectionString,
        `SELECT r."state", r."settled_reason" AS reason,
                (SELECT count(*)::int FROM "result_actions" WHERE "type" = 'CONFIRM') AS settled,
                (SELECT count(*)::int FROM "rating_generations") AS generations
         FROM "result_revisions" r WHERE r."id" = $1`,
        [created.resultRevisionId],
      );
      const settledCount: number = both.filter(
        (outcome) => outcome.status === 'fulfilled' && outcome.value.state === ResultState.CONFIRMED,
      ).length;

      return {
        detail: `${state!.state} by ${state!.reason}, ${state!.settled} confirmations, ${settledCount} of two answers reported the settlement, ${state!.generations} generations`,
        passed:
          state!.state === 'CONFIRMED' &&
          state!.reason === 'CONFIRMED_BY_ALL' &&
          state!.settled === 2 &&
          settledCount === 1,
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'a confirmation and a dispute racing leave one state, never a confirmed result with a dispute on it',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const created: IResultEffect = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ben!, ids.Cara!]),
          }),
        { connectionString },
      );
      const act = (actor: string, action: ResultAction): Promise<IResultEffect> =>
        withInteractiveTransaction(
          (transaction) =>
            answerOrThrow(transaction, actor, {
              action,
              canonicalMatchId: created.canonicalMatchId,
              clientOperationId: randomUUID(),
              expectedRevision: 1,
              note: action === ResultAction.DISPUTE ? 'that was not the score' : null,
            }),
          { connectionString },
        );
      const both: PromiseSettledResult<IResultEffect>[] = await Promise.allSettled([
        act(ids.Ben!, ResultAction.CONFIRM),
        act(ids.Cara!, ResultAction.DISPUTE),
      ]);
      const [state] = await read<{ games: string; state: string }>(
        connectionString,
        `SELECT r."state",
                (SELECT string_agg(DISTINCT g."confirmation_status"::text, ',') FROM "games" g WHERE g."result_revision_id" = r."id") AS games
         FROM "result_revisions" r WHERE r."id" = $1`,
        [created.resultRevisionId],
      );
      const outcomes: string[] = both.map((outcome) =>
        outcome.status === 'fulfilled' ? outcome.value.state : `rejected: ${refusalOf(outcome.reason)}`,
      );

      return {
        detail: `revision ${state!.state}, game rows ${state!.games}; answers ${outcomes.join(' and ')}`,
        passed: state!.state === state!.games && ['DISPUTED', 'UNCONFIRMED'].includes(state!.state),
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'a dispute that arrives after the deadline meets a result already settled by it',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const created: IResultEffect = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ben!, ids.Cara!]),
          }),
        { connectionString },
      );

      await read(
        connectionString,
        `UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute' WHERE "id" = $1`,
        [created.resultRevisionId],
      );

      // Deliberately not unwrapped: the point is that the transaction commits the settlement it did on the way in,
      // while the action itself is refused
      const outcome = await withInteractiveTransaction(
        (transaction) =>
          answerResult(transaction, ids.Ben!, {
            action: ResultAction.DISPUTE,
            canonicalMatchId: created.canonicalMatchId,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            note: 'too late',
          }),
        { connectionString },
      );
      const refusal: string = outcome.ok ? 'none' : outcome.refusal;

      const [state] = await read<{ disputes: number; reason: string; state: string }>(
        connectionString,
        `SELECT "state", "settled_reason" AS reason,
                (SELECT count(*)::int FROM "result_actions" WHERE "type" = 'DISPUTE') AS disputes
         FROM "result_revisions" WHERE "id" = $1`,
        [created.resultRevisionId],
      );

      return {
        detail: `${state!.state} by ${state!.reason}; the late dispute was refused as ${refusal} and wrote ${state!.disputes} rows`,
        passed:
          state!.state === 'CONFIRMED' &&
          state!.reason === 'DEADLINE_PASSED' &&
          state!.disputes === 0 &&
          refusal === 'STALE_RESULT',
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'a dispute that crossed the deadline while queued behind the league lock is late, not early',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const created: IResultEffect = await recordOne(connectionString, ids.Ada!, [ids.Ben!, ids.Cara!]);
      const [revision] = await read<{ deadline: Date }>(
        connectionString,
        `UPDATE "result_revisions" SET "confirmation_deadline" = clock_timestamp() + interval '600 milliseconds'
         WHERE "id" = $1 RETURNING "confirmation_deadline" AS deadline`,
        [created.resultRevisionId],
      );
      const holding = latch();
      const release = latch();

      // A third party holds the league's lock, which is the row every result write in the league has to pass through
      const blocker: Promise<void> = withInteractiveTransaction(
        async (transaction) => {
          await transaction.query(`SELECT "id" FROM "leagues" WHERE "id" = $1 FOR UPDATE`, [LEAGUE_ID]);
          holding.open();
          await release.reached;
        },
        { connectionString, limits: { idleTimeoutMs: 30000, operationTimeoutMs: 30000 } },
      );

      await holding.reached;

      // Begins now, comfortably inside the confirmation window, and will not see the lock for another second
      const disputing = withInteractiveTransaction(
        async (transaction) => {
          const outcome: TResultOutcome = await answerResult(transaction, ids.Ben!, {
            action: ResultAction.DISPUTE,
            canonicalMatchId: created.canonicalMatchId,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            note: 'I disagree',
          });
          const { rows } = await transaction.query<{ crossed: boolean; started: boolean }>(
            `SELECT now() < $1::timestamptz AS "started", clock_timestamp() > $1::timestamptz AS "crossed"`,
            [revision!.deadline],
          );

          return { clock: rows[0]!, outcome };
        },
        {
          connectionString,
          limits: {
            lockTimeoutMs: 10000,
            operationTimeoutMs: 30000,
            statementTimeoutMs: 10000,
          },
        },
      );

      // The deadline passes while the dispute is still queued
      await new Promise<void>((resolve: () => void): void => {
        setTimeout(resolve, 1000);
      });

      release.open();
      await blocker;

      const { clock, outcome } = await disputing;
      const refusal: string = outcome.ok ? 'none' : outcome.refusal;
      const [state] = await read<{ disputes: number; reason: string; state: string }>(
        connectionString,
        `SELECT "state", "settled_reason" AS reason,
                (SELECT count(*)::int FROM "result_actions" WHERE "type" = 'DISPUTE') AS disputes
         FROM "result_revisions" WHERE "id" = $1`,
        [created.resultRevisionId],
      );

      return {
        detail: `the transaction began ${clock.started ? 'before' : 'after'} the deadline and held its locks ${clock.crossed ? 'after' : 'before'} it; the dispute was refused as ${refusal} and wrote ${state!.disputes} rows, leaving ${state!.state} by ${state!.reason}`,
        passed:
          clock.started &&
          clock.crossed &&
          refusal === 'STALE_RESULT' &&
          state!.disputes === 0 &&
          state!.state === 'CONFIRMED' &&
          state!.reason === 'DEADLINE_PASSED',
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'a dispute committed before the deadline stops the deadline settling it, even across a held transaction',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const created: IResultEffect = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ben!, ids.Cara!]),
          }),
        { connectionString },
      );
      const disputing = latch();
      const passed = latch();

      const dispute: Promise<IResultEffect> = withInteractiveTransaction(
        async (transaction) => {
          const effect = await answerOrThrow(transaction, ids.Ben!, {
            action: ResultAction.DISPUTE,
            canonicalMatchId: created.canonicalMatchId,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            note: 'in time',
          });

          disputing.open();
          await passed.reached;

          return effect;
        },
        { connectionString },
      );

      await disputing.reached;

      // The deadline lapses while the dispute is still uncommitted; the sweep still has to wait for that transaction
      await read(
        connectionString,
        `UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute' WHERE "id" = $1 AND false`,
        [created.resultRevisionId],
      );

      passed.open();
      await dispute;

      await read(
        connectionString,
        `UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute' WHERE "id" = $1`,
        [created.resultRevisionId],
      );

      const swept: number = await withInteractiveTransaction(
        (transaction) => settleDueResults(transaction, LEAGUE_ID),
        { connectionString },
      );
      const [state] = await read<{ state: string }>(
        connectionString,
        `SELECT "state" FROM "result_revisions" WHERE "id" = $1`,
        [created.resultRevisionId],
      );

      return {
        detail: `dispute committed, sweep settled ${swept} results, revision is ${state!.state}`,
        passed: swept === 0 && state!.state === 'DISPUTED',
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'a confirmation aimed at a revision an amendment has replaced is refused as stale',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const created: IResultEffect = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ben!, ids.Cara!]),
          }),
        { connectionString },
      );

      await disputeOne(connectionString, ids.Ben!, created.canonicalMatchId);
      await withInteractiveTransaction(
        (transaction) =>
          amendOrThrow(transaction, ids.Ada!, {
            canonicalMatchId: created.canonicalMatchId,
            clientOperationId: randomUUID(),
            expectedRevision: 1,
            submission: singles([[11, 6]], [ids.Ben!, ids.Cara!]),
          }),
        { connectionString },
      );

      let refusal: string = 'none';

      try {
        await withInteractiveTransaction(
          (transaction) =>
            answerOrThrow(transaction, ids.Cara!, {
              action: ResultAction.CONFIRM,
              canonicalMatchId: created.canonicalMatchId,
              clientOperationId: randomUUID(),
              expectedRevision: 1,
              note: null,
            }),
          { connectionString },
        );
      } catch (error: unknown) {
        refusal = refusalOf(error);
      }

      const [counts] = await read<{ confirmations: number; revisions: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "result_revisions") AS revisions,
                (SELECT count(*)::int FROM "result_actions" WHERE "type" = 'CONFIRM') AS confirmations`,
      );

      return {
        detail: `refused as ${refusal}; ${counts!.revisions} revisions and ${counts!.confirmations} confirmations`,
        passed: refusal === 'STALE_RESULT' && counts!.revisions === 2 && counts!.confirmations === 0,
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'a void racing a deadline settlement leaves one effective outcome and one active ladder',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara']);
      const created: IResultEffect = await withInteractiveTransaction(
        (transaction) =>
          recordOrThrow(transaction, ids.Ada!, {
            clientOperationId: randomUUID(),
            expectedLeagueRevision: 1,
            leagueId: LEAGUE_ID,
            submission: singles([[11, 4]], [ids.Ben!, ids.Cara!]),
          }),
        { connectionString },
      );

      await read(
        connectionString,
        `UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute' WHERE "id" = $1`,
        [created.resultRevisionId],
      );

      const both: PromiseSettledResult<unknown>[] = await Promise.allSettled([
        withInteractiveTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID), { connectionString }),
        withInteractiveTransaction(
          (transaction) =>
            answerOrThrow(transaction, ids.Ada!, {
              action: ResultAction.VOID,
              canonicalMatchId: created.canonicalMatchId,
              clientOperationId: randomUUID(),
              expectedRevision: 1,
              note: null,
            }),
          { connectionString },
        ),
      ]);
      const [state] = await read<{ live: number; pointers: number; state: string }>(
        connectionString,
        `SELECT r."state",
                (SELECT count(*)::int FROM "games" WHERE "superseded_at" IS NULL AND "status" = 'COMPLETE') AS live,
                (SELECT count(*)::int FROM "active_rating_generations") AS pointers
         FROM "result_revisions" r WHERE r."id" = $1`,
        [created.resultRevisionId],
      );

      return {
        detail: `revision ${state!.state}, ${state!.live} live game rows, ${state!.pointers} active pointer; answers ${both.map((outcome) => outcome.status).join(' and ')}`,
        passed: state!.state === 'VOID' && state!.live === 0 && state!.pointers === 1,
      };
    },
  },
  {
    package: PACKAGES.CONCURRENCY,
    name: 'two results in one league settling at once are serialized into one final ladder',
    run: async (connectionString: string): Promise<IScenarioResult> => {
      await resetDatabase(connectionString);

      const ids: Record<string, string> = await seedLeague(connectionString, ['Ada', 'Ben', 'Cara', 'Dan']);
      const first: IResultEffect = await recordOne(connectionString, ids.Ada!, [ids.Ben!, ids.Cara!]);
      const second: IResultEffect = await recordOne(connectionString, ids.Ada!, [ids.Cara!, ids.Dan!]);

      await read(
        connectionString,
        `UPDATE "result_revisions" SET "confirmation_deadline" = now() - interval '1 minute' WHERE "id" = ANY($1)`,
        [[first.resultRevisionId, second.resultRevisionId]],
      );

      await Promise.allSettled([
        withInteractiveTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID), { connectionString }),
        withInteractiveTransaction((transaction) => settleDueResults(transaction, LEAGUE_ID), { connectionString }),
      ]);

      const [state] = await read<{ active_rows: number; pointers: number; settled: number }>(
        connectionString,
        `SELECT (SELECT count(*)::int FROM "result_revisions" WHERE "state" = 'CONFIRMED') AS settled,
                (SELECT count(*)::int FROM "active_rating_generations") AS pointers,
                (SELECT count(*)::int FROM "rating_snapshots" s
                 JOIN "active_rating_generations" a ON a."rating_generation_id" = s."rating_generation_id") AS active_rows`,
      );

      return {
        detail: `${state!.settled} results settled, ${state!.pointers} active pointer, ${state!.active_rows} snapshots in the active ladder`,
        passed: state!.settled === 2 && state!.pointers === 1 && state!.active_rows === 4,
      };
    },
  },
];
