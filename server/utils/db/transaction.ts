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
 * ██████████████████████████████████████████ #server/utils/db/transaction.ts ██████████████████████████████████████████
 *
 * The interactive transaction a result transition is published inside.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { PoolClient, QueryResult, QueryResultRow } from '@neondatabase/serverless';
import { DatabaseError, Pool } from '@neondatabase/serverless';

import { DEFAULT_TRANSACTION_LIMITS } from './constants';
import type { IInteractiveTransaction, IOperationBudget, ITransactionLimits, ITransactionPhases } from './types';

/**
 * Thrown when an operation outruns the whole-operation budget rather than any single database limit.
 *
 * Nothing the operation attempted is durable when a caller sees this: the budget can only end the work before the
 * commit was sent, and a transaction whose connection is destroyed before `COMMIT` is rolled back by the server
 * @public
 */
export class TransactionBudgetError extends Error {
  /**
   * Builds the error a caller sees when the operation ran out of time
   * @param budgetMs - The budget it outran, in milliseconds
   */
  public constructor(budgetMs: number) {
    super(`the result transaction outran its ${budgetMs}ms operation budget`);
    this.name = 'TransactionBudgetError';
  }
}

/**
 * Thrown when the commit was sent and no answer to it ever arrived.
 *
 * The distinction from {@link TransactionBudgetError} is the whole point of having two: there the work is known not to
 * have happened, and here nobody knows. The database may have applied the commit and been unable to say so before the
 * connection went away. A caller must not report this as a failure, and must not retry it as a fresh operation
 * either — it resends the identical request under the same operation id, which is answered from the receipt the
 * commit either did or did not write.
 *
 * What makes an outcome unknown is the commit having been sent, not the shape of the error that came back instead of
 * its answer. A budget that expired around it and a socket that died under it are the same ignorance, so both arrive
 * here and both keep the cause that produced them
 * @public
 */
export class TransactionOutcomeUnknownError extends Error {
  /**
   * Builds the error a caller sees when the commit's outcome is unknown
   * @param why - What happened instead of the commit being answered
   * @param cause - The failure that stood in for the answer
   */
  public constructor(why: string, cause: unknown) {
    super(`the result transaction sent its commit and ${why}; its outcome is unknown`, { cause });
    this.name = 'TransactionOutcomeUnknownError';
  }
}

/**
 * Whether the database itself refused the commit, rather than its answer never arriving.
 *
 * Only an error the server composed and sent settles what happened to a commit, and only at `ERROR` severity: that is
 * a statement the database rejected and a transaction it has already rolled back. Anything else that surfaces while a
 * commit is outstanding — a dead socket, a pool tearing itself down, a `FATAL` that ends the session mid-flight — says
 * that this end stopped hearing, which is not the same as the commit not having happened
 * @internal
 * @function
 * @param error - Whatever came back instead of the commit's answer
 * @returns Whether it establishes that the commit did not take effect
 */
function wasRefusedByTheDatabase(error: unknown): boolean {
  return error instanceof DatabaseError && error.severity === 'ERROR';
}

/**
 * Awaits one step of the operation under the deadline the whole operation shares.
 *
 * The deadline is an instant rather than a duration per step, because a bound that restarts at every statement bounds
 * nothing: a replay is hundreds of short statements and each of them would be comfortably inside its own allowance.
 * A step reached with the deadline already behind it is refused without being started at all
 * @internal
 * @async
 * @function
 * @param start - How to begin the step, invoked only if there is budget left to begin it in
 * @param budget - The operation's deadline and the budget it was given
 * @param abandon - What to do with a value the step produces after the deadline has already answered for it
 * @throws TransactionBudgetError when the deadline has passed or passes first
 * @returns The step's value
 */
async function withinBudget<TValue>(
  start: () => Promise<TValue>,
  budget: IOperationBudget,
  abandon: (value: TValue) => void,
): Promise<TValue> {
  // A thunk rather than a promise, so a step reached after the deadline is never begun. Sending a statement whose
  // answer nobody is waiting for would leave the database working on behalf of a request that is already over
  if (budget.deadline - Date.now() <= 0) {
    throw new TransactionBudgetError(budget.budgetMs);
  }

  const work: Promise<TValue> = start();
  // Floored, because a step can begin inside the budget and take the whole of it to begin: a body that computes
  // rather than awaits crosses the deadline before it ever yields, and a negative delay is a warning from the runtime
  // where what is meant is an expiry that has already arrived
  const remaining: number = Math.max(0, budget.deadline - Date.now());
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  const expiry: Promise<never> = new Promise<never>((_resolve, reject: (reason: Error) => void): void => {
    timer = setTimeout((): void => reject(new TransactionBudgetError(budget.budgetMs)), remaining);
  });

  try {
    return await Promise.race([work, expiry]);
  } catch (error: unknown) {
    // Whatever the step does from here is nobody's answer, but it is still a promise that may reject, and an
    // unhandled rejection would be reported against a request that has already been told what happened to it
    void work.then(abandon, (): void => undefined);

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Awaits cleanup under a bound of its own.
 *
 * Cleanup cannot be held to the operation's deadline, which is usually the very thing that has just passed, and it
 * cannot be unbounded either: a rollback or a pool shutdown that never answers would keep a function alive long after
 * the request it belonged to was decided
 * @internal
 * @async
 * @function
 * @param work - The cleanup step
 * @param limitMs - How long it may take
 * @returns Whether it finished in time and without error
 */
async function cleanly(work: Promise<unknown>, limitMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  const expiry: Promise<false> = new Promise<false>((resolve: (value: false) => void): void => {
    timer = setTimeout((): void => resolve(false), limitMs);
  });

  try {
    return await Promise.race([work.then((): boolean => true), expiry]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    void work.catch((): void => undefined);
  }
}

/**
 * Sends the commit under the operation's deadline, and settles what a failure of it means.
 *
 * Which of the two answers a caller gets turns on whether the commit reached the wire, recorded inside the thunk
 * where it is a fact rather than inferred from a deadline read a moment earlier or from the shape of what came back.
 * A commit never sent leaves a transaction this connection's death rolls back, and the budget refusal stands. A
 * commit the database itself refused is an answer, and it stands too. Everything else — a socket that died, a
 * session that ended, a budget that expired around a statement already gone — is the case nobody can account for
 * @internal
 * @async
 * @function
 * @param client - The connection the transaction is open on
 * @param budget - The operation's deadline and the budget it was given
 * @throws TransactionBudgetError when the deadline passed before the commit could be sent
 * @throws TransactionOutcomeUnknownError when it was sent and its answer never arrived
 * @throws Whatever the database refused it with
 */
async function commitWithin(client: PoolClient, budget: IOperationBudget): Promise<void> {
  let sent: boolean = false;

  try {
    await withinBudget(
      async (): Promise<QueryResult<QueryResultRow>> => {
        sent = true;

        return client.query('COMMIT');
      },
      budget,
      (): void => undefined,
    );
  } catch (error: unknown) {
    if (!sent || wasRefusedByTheDatabase(error)) {
      throw error;
    }

    throw new TransactionOutcomeUnknownError(
      error instanceof TransactionBudgetError
        ? `outran its ${budget.budgetMs}ms operation budget waiting for the answer`
        : 'never heard the answer',
      error,
    );
  }
}

/**
 * When each phase of one operation finished, as the clock the helper measures with read it.
 *
 * Undefined means the operation never reached that phase, which is a different fact from a phase that took no time:
 * a transaction refused while dialling has no preamble, and reporting one of zero would describe a round trip that
 * never happened
 * @internal
 */
interface IPhaseMarks {
  /* When the connection was in hand */
  connectedAt: number | undefined;

  /* When the operation stopped, whether by a commit being answered or by whatever ended it instead */
  endedAt: number | undefined;

  /* When `BEGIN` and the three limits had been set */
  preambleAt: number | undefined;

  /* When the body returned its value */
  workedAt: number | undefined;
}

/**
 * Turns the instants one operation passed through into the durations between them.
 *
 * A phase the operation never reached is reported as zero rather than as a negative interval against a mark that was
 * never taken: the observer is handed what was measured, and `committed` says whether the operation got far enough
 * for the figures to describe a whole transaction
 * @internal
 * @function
 * @param startedAt - When the operation began, before the dial
 * @param marks - When each phase finished
 * @param committed - Whether the commit was answered
 * @returns Where the time went
 */
function phasesFrom(startedAt: number, marks: IPhaseMarks, committed: boolean): ITransactionPhases {
  const endedAt: number = marks.endedAt ?? startedAt;
  const connectedAt: number | undefined = marks.connectedAt;
  const preambleAt: number | undefined = marks.preambleAt;
  const workedAt: number | undefined = marks.workedAt;

  return {
    bodyMs: workedAt === undefined || preambleAt === undefined ? 0 : workedAt - preambleAt,
    cleanupMs: performance.now() - endedAt,
    commitMs: workedAt === undefined ? 0 : endedAt - workedAt,
    committed,
    connectMs: connectedAt === undefined ? 0 : connectedAt - startedAt,
    operationMs: endedAt - startedAt,
    preambleMs: preambleAt === undefined || connectedAt === undefined ? 0 : preambleAt - connectedAt,
  };
}

/**
 * Hands the measurement to whoever asked for it, without letting it change what the operation did.
 *
 * An observer is instrumentation, and instrumentation that throws from a `finally` would replace the reason a
 * transaction ended with a complaint about the thing watching it
 * @internal
 * @function
 * @param observer - Who asked, if anybody did
 * @param phases - Where the time went
 */
function report(observer: ((phases: ITransactionPhases) => void) | undefined, phases: ITransactionPhases): void {
  try {
    observer?.(phases);
  } catch {
    // Deliberately swallowed: see above
  }
}

/**
 * Runs one interactive transaction and hands back whatever the body returns.
 *
 * The application's ordinary reads stay on Neon's HTTP driver, which cannot hold a transaction open across statements:
 * every call is its own implicit transaction, so a lock taken in one is gone by the next. Publishing a result means
 * taking a lock, re-reading authority and state under it, writing the transition, a whole rating generation and the
 * pointer that selects it, and having a reader see either all of that or none of it. That needs a connection held
 * open, which is the WebSocket-backed `Pool` this opens.
 *
 * The pool is built and closed inside this call rather than kept alive between them. A Vercel function is short-lived
 * and may be frozen between requests; a pool that outlived the request would strand sockets on the database. The cost
 * is one connection setup per transaction, which is the price of not leaking one.
 *
 * Four limits bound the work. Three of them are set inside the transaction rather than on the role, so they bound this
 * work and nothing else: how long one statement may run, how long it may wait for a lock, and how long the transaction
 * may sit idle. Each ends the transaction visibly, with nothing written. The fourth is the whole operation's own
 * budget, kept here rather than in the database because no database limit measures it: a rating replay is hundreds of
 * short statements, and a sequence of them can outlive the function holding the connection without any one of them
 * running long enough to be refused.
 *
 * That fourth budget starts before the connection is dialled and runs until the commit is answered. Anything left
 * outside it would be time the operation really spends and nobody counts: opening a WebSocket to the database is a
 * network round trip on the same network the commit travels over, and both of them are exactly where a slow day shows
 * up. Cleanup is bounded separately, because by then the operation's own deadline is usually the thing that just
 * passed.
 *
 * The connection string is a parameter rather than something read from the runtime configuration here, so this module
 * knows nothing about Nuxt and a fixture can point it at a disposable database. {@link useResultTransaction} is the
 * deployed entry point that supplies it
 * @public
 * @async
 * @function
 * @param body - What to run inside the transaction
 * @param options - The connection string to dial, the limits to bound it by, and an optional observer for where the
 *   operation's time went
 * @throws TransactionBudgetError when the operation outruns its budget before the commit is sent, in which case
 *   nothing it attempted is durable
 * @throws TransactionOutcomeUnknownError when the commit was sent and its answer never arrived, whether the budget
 *   expired around it or the connection failed under it
 * @throws Whatever the body throws, after the transaction is rolled back
 * @returns The body's value
 */
export async function withInteractiveTransaction<TResult>(
  body: (transaction: IInteractiveTransaction) => Promise<TResult>,
  options: {
    connectionString: string;
    limits?: Partial<ITransactionLimits>;
    onPhases?: (phases: ITransactionPhases) => void;
  },
): Promise<TResult> {
  const limits: ITransactionLimits = { ...DEFAULT_TRANSACTION_LIMITS, ...options.limits };
  const budget: IOperationBudget = {
    budgetMs: limits.operationTimeoutMs,
    deadline: Date.now() + limits.operationTimeoutMs,
  };
  const startedAt: number = performance.now();
  const marks: IPhaseMarks = {
    connectedAt: undefined,
    endedAt: undefined,
    preambleAt: undefined,
    workedAt: undefined,
  };
  const pool: Pool = new Pool({ connectionString: options.connectionString });
  let committed: boolean = false;

  // A pool holds sockets this operation may already have stopped waiting for: a connection a refusal destroyed, or one
  // still closing while the pool shuts down, can report its failure with nobody left to hand it to. The pool re-emits
  // that as `error`, and an `error` event with no listener is an uncaught exception — in a function, the whole
  // instance rather than this one request. Observed against hosted Neon after a budget refusal
  pool.on('error', (): void => undefined);

  try {
    // Inside the budget, because dialling the database is a network round trip and a request that spent its whole
    // allowance here spent it
    const client: PoolClient = await withinBudget(
      async (): Promise<PoolClient> => pool.connect(),
      budget,
      // A connection that arrives after the budget answered belongs to nobody; destroying it is what stops it being
      // returned to a pool that is already shutting down
      (late: PoolClient): void => late.release(new TransactionBudgetError(limits.operationTimeoutMs)),
    );

    marks.connectedAt = performance.now();

    const run = async <TRow extends QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<TRow>> =>
      withinBudget(
        async (): Promise<QueryResult<TRow>> => client.query<TRow>(text, values),
        budget,
        (): void => undefined,
      );

    try {
      await run('BEGIN');
      await run(`SET LOCAL statement_timeout = ${limits.statementTimeoutMs}`);
      await run(`SET LOCAL lock_timeout = ${limits.lockTimeoutMs}`);
      await run(`SET LOCAL idle_in_transaction_session_timeout = ${limits.idleTimeoutMs}`);

      marks.preambleAt = performance.now();

      /* Bound to the client so the body cannot start a second connection by accident */
      const result: TResult = await withinBudget(
        async (): Promise<TResult> => body({ query: run }),
        budget,
        (): void => undefined,
      );

      marks.workedAt = performance.now();

      await commitWithin(client, budget);

      committed = true;
      marks.endedAt = performance.now();

      client.release();

      return result;
    } catch (error: unknown) {
      marks.endedAt ??= performance.now();

      // Every way out of the transaction hands the connection back from here, on exactly one of these branches and the
      // successful return above. Neon's pool wraps each client it lends out in a release-once guard and throws on a
      // second call, so a step that raises a refusal leaves the handing back to this owner rather than doing it too:
      // a connection released twice replaces the reason the operation ended with a complaint about the pool
      if (error instanceof TransactionOutcomeUnknownError) {
        // It may be holding a transaction whose fate nobody knows, and a ROLLBACK cannot establish that the commit
        // already sent did not take effect. Destroying it is the only honest thing left to do with it
        client.release(error);

        throw error;
      }

      if (error instanceof TransactionBudgetError) {
        // Either a statement is still in flight on this connection, in which case a ROLLBACK would queue behind exactly
        // the work the budget just refused to wait for, or the deadline passed with the commit still unsent and there
        // is no budget left to spend on one. Destroying the connection ends the transaction at the database instead,
        // and the commit was never sent, so nothing the operation attempted survives
        client.release(error);

        throw error;
      }

      // A rollback that itself fails must not replace the reason the transaction is being abandoned, and a connection
      // whose rollback did not finish must not be handed back for somebody else to inherit mid-transaction
      client.release(
        (await cleanly(client.query('ROLLBACK'), limits.cleanupTimeoutMs))
          ? undefined
          : new Error('the rollback outran its cleanup budget'),
      );

      throw error;
    }
  } finally {
    marks.endedAt ??= performance.now();

    await cleanly(pool.end(), limits.cleanupTimeoutMs);

    report(options.onPhases, phasesFrom(startedAt, marks, committed));
  }
}
