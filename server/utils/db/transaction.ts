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
 * Three limits are set inside the transaction rather than on the role, so they bound this work and nothing else: how
 * long one statement may run, how long it may wait for a lock, and how long the transaction may sit idle. Each of
 * them ends the transaction visibly, with nothing written, rather than letting a caller claim a result settled while
 * the database is still deciding
 * @public
 * @async
 * @function
 * The connection string is a parameter rather than something read from the runtime configuration here, so this module
 * knows nothing about Nuxt and a fixture can point it at a disposable database. {@link useResultTransaction} is the
 * deployed entry point that supplies it
 * @public
 * @async
 * @function
 * @param body - What to run inside the transaction
 * @param options - The connection string to dial and the limits to bound it by
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

    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL statement_timeout = ${limits.statementTimeoutMs}`);
      await client.query(`SET LOCAL lock_timeout = ${limits.lockTimeoutMs}`);
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = ${limits.idleTimeoutMs}`);

      const result: TResult = await body({
        /* Bound to the client so the body cannot start a second connection by accident */
        query: async <TRow extends QueryResultRow>(text: string, values: unknown[] = []): Promise<QueryResult<TRow>> =>
          client.query<TRow>(text, values),
      });

      await client.query('COMMIT');

      return result;
    } catch (error: unknown) {
      // A rollback that itself fails must not replace the reason the transaction is being abandoned
      await client.query('ROLLBACK').catch((): void => undefined);

      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
