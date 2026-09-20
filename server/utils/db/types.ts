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
 * █████████████████████████████████████████████ #server/utils/db/types.ts █████████████████████████████████████████████
 *
 * Types for the database module; the Drizzle handle every query helper accepts.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { QueryResult, QueryResultRow } from '@neondatabase/serverless';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

/**
 * The Drizzle database handle bound to Neon's HTTP driver; the single type every query helper accepts
 * @public
 */
export type TDatabase = NeonHttpDatabase;

/**
 * The narrow surface a result transaction's body is given: one connection, one statement at a time, and no way to
 * reach another connection or to end the transaction from inside it
 * @public
 */
export interface IInteractiveTransaction {
  /**
   * Runs one statement on the transaction's own connection
   * @param text - The statement, with positional placeholders
   * @param values - The values to bind
   * @returns The result
   */
  query: <TRow extends QueryResultRow>(text: string, values?: unknown[]) => Promise<QueryResult<TRow>>;
}

/**
 * What bounds one result transaction, in milliseconds
 * @public
 */
export interface ITransactionLimits {
  /* How long the transaction may sit between statements before the database ends it */
  idleTimeoutMs: number;

  /**
   * How long the whole operation may take, from the first statement to the commit. The three database limits below
   * each bound one wait; a long enough sequence of statements that never breaks any of them can still outlive the
   * function holding the connection, which is what this one refuses
   */
  operationTimeoutMs: number;

  /* How long a statement may wait for a lock before it is refused */
  lockTimeoutMs: number;

  /* How long a single statement may run */
  statementTimeoutMs: number;
}
