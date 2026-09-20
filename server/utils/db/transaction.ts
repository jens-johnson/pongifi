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
import { Pool } from '@neondatabase/serverless';

import { DEFAULT_TRANSACTION_LIMITS } from './constants';
import type { IInteractiveTransaction, IOperationBudget, ITransactionLimits } from './types';

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
 * Thrown when the budget expired with the commit already in flight.
 *
 * The distinction from {@link TransactionBudgetError} is the whole point of having two: there the work is known not to
 * have happened, and here nobody knows. The database may have applied the commit and been unable to say so before the
 * connection went away. A caller must not report this as a failure, and must not retry it as a fresh operation
 * either — it resends the identical request under the same operation id, which is answered from the receipt the
 * commit either did or did not write
 * @public
 */
export class TransactionOutcomeUnknownError extends Error {
  /**
   * Builds the error a caller sees when the commit's outcome is unknown
   * @param budgetMs - The budget the operation outran, in milliseconds
   */
  public constructor(budgetMs: number) {
    super(`the result transaction outran its ${budgetMs}ms operation budget while committing; its outcome is unknown`);
    this.name = 'TransactionOutcomeUnknownError';
  }
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
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  const expiry: Promise<never> = new Promise<never>((_resolve, reject: (reason: Error) => void): void => {
    timer = setTimeout((): void => reject(new TransactionBudgetError(budget.budgetMs)), budget.deadline - Date.now());
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
 * @param options - The connection string to dial and the limits to bound it by
 * @throws TransactionBudgetError when the operation outruns its budget before the commit is sent, in which case
 *   nothing it attempted is durable
 * @throws TransactionOutcomeUnknownError when it outruns the budget with the commit in flight
 * @throws Whatever the body throws, after the transaction is rolled back
 * @returns The body's value
 */
export async function withInteractiveTransaction<TResult>(
  body: (transaction: IInteractiveTransaction) => Promise<TResult>,
  options: { connectionString: string; limits?: Partial<ITransactionLimits> },
): Promise<TResult> {
  const limits: ITransactionLimits = { ...DEFAULT_TRANSACTION_LIMITS, ...options.limits };
  const budget: IOperationBudget = {
    budgetMs: limits.operationTimeoutMs,
    deadline: Date.now() + limits.operationTimeoutMs,
  };
  const pool: Pool = new Pool({ connectionString: options.connectionString });

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

      /* Bound to the client so the body cannot start a second connection by accident */
      const result: TResult = await withinBudget(
        async (): Promise<TResult> => body({ query: run }),
        budget,
        (): void => undefined,
      );

      // Asked here rather than left to the step, because the two ways a commit can fall outside the budget are not
      // the same answer. A commit never sent is a transaction the server rolls back when this connection dies, which
      // is knowledge worth having; a commit sent and unanswered is not
      if (budget.deadline - Date.now() <= 0) {
        client.release(new TransactionBudgetError(limits.operationTimeoutMs));

        throw new TransactionBudgetError(limits.operationTimeoutMs);
      }

      try {
        await run('COMMIT');
      } catch (error: unknown) {
        if (error instanceof TransactionBudgetError) {
          client.release(error);

          throw new TransactionOutcomeUnknownError(limits.operationTimeoutMs);
        }

        throw error;
      }

      client.release();

      return result;
    } catch (error: unknown) {
      if (error instanceof TransactionOutcomeUnknownError) {
        throw error;
      }

      if (error instanceof TransactionBudgetError) {
        // A statement is still in flight on this connection, so a ROLLBACK would queue behind exactly the work the
        // budget just refused to wait for. Destroying the connection ends the transaction at the database instead,
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
    await cleanly(pool.end(), limits.cleanupTimeoutMs);
  }
}
