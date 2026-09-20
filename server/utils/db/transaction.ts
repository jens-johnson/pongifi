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
import type { IInteractiveTransaction, ITransactionLimits } from './types';

/**
 * Thrown when an operation outruns the whole-operation budget rather than any single database limit
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
 * The connection string is a parameter rather than something read from the runtime configuration here, so this module
 * knows nothing about Nuxt and a fixture can point it at a disposable database. {@link useResultTransaction} is the
 * deployed entry point that supplies it
 * @public
 * @async
 * @function
 * @param body - What to run inside the transaction
 * @param options - The connection string to dial and the limits to bound it by
 * @throws TransactionBudgetError when the whole operation outruns its budget
 * @throws Whatever the body throws, after the transaction is rolled back
 * @returns The body's value
 */
export async function withInteractiveTransaction<TResult>(
  body: (transaction: IInteractiveTransaction) => Promise<TResult>,
  options: { connectionString: string; limits?: Partial<ITransactionLimits> },
): Promise<TResult> {
  const limits: ITransactionLimits = { ...DEFAULT_TRANSACTION_LIMITS, ...options.limits };
  const pool: Pool = new Pool({ connectionString: options.connectionString });

  try {
    const client: PoolClient = await pool.connect();
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;
    let expired: boolean = false;

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL statement_timeout = ${limits.statementTimeoutMs}`);
      await client.query(`SET LOCAL lock_timeout = ${limits.lockTimeoutMs}`);
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = ${limits.idleTimeoutMs}`);

      const running: Promise<TResult> = body({
        /* Bound to the client so the body cannot start a second connection by accident */
        query: async <TRow extends QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<TRow>> =>
          client.query<TRow>(text, values),
      });

      // The race only reports whichever finishes first; the body keeps running until its statement returns, and this
      // handler is what keeps that later rejection from surfacing as an unhandled one
      void running.catch((): void => undefined);

      const budget: Promise<never> = new Promise<never>((_resolve, reject: (reason: Error) => void): void => {
        timer = setTimeout((): void => {
          expired = true;
          reject(new TransactionBudgetError(limits.operationTimeoutMs));
        }, limits.operationTimeoutMs);
      });
      const result: TResult = await Promise.race([running, budget]);

      clearTimeout(timer);
      await client.query('COMMIT');
      client.release();

      return result;
    } catch (error: unknown) {
      clearTimeout(timer);

      if (expired) {
        // A statement is still in flight on this connection, so a ROLLBACK would queue behind exactly the work the
        // budget just refused to wait for. Destroying the connection ends the transaction at the database instead
        client.release(error instanceof Error ? error : new Error('the operation budget expired'));

        throw error;
      }

      // A rollback that itself fails must not replace the reason the transaction is being abandoned
      await client.query('ROLLBACK').catch((): void => undefined);
      client.release();

      throw error;
    }
  } finally {
    await pool.end();
  }
}
