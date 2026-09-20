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
 * The instant one operation must be finished by, and the budget that instant was derived from.
 *
 * An instant rather than a duration, because every step of the operation is held to the same one: a per-step duration
 * would let a long enough sequence of permitted steps run for as long as it liked
 * @public
 */
export interface IOperationBudget {
  /* The budget the operation was given, kept for the message a refusal carries */
  budgetMs: number;

  /* The epoch millisecond the operation must be finished by */
  deadline: number;
}

/**
 * What bounds one result transaction, in milliseconds
 * @public
 */
export interface ITransactionLimits {
  /**
   * How long rolling back and closing the pool may take. Bounded separately from the operation, whose deadline is
   * usually the thing that has just passed by the time cleanup runs
   */
  cleanupTimeoutMs: number;

  /* How long the transaction may sit between statements before the database ends it */
  idleTimeoutMs: number;

  /**
   * How long the whole operation may take, from before the connection is dialled to the commit being answered. The
   * three database limits below each bound one wait; a long enough sequence of statements that never breaks any of
   * them can still outlive the function holding the connection, which is what this one refuses
   */
  operationTimeoutMs: number;

  /* How long a statement may wait for a lock before it is refused */
  lockTimeoutMs: number;

  /* How long a single statement may run */
  statementTimeoutMs: number;
}

/**
 * Where one transaction's wall time went, measured by the helper that owns each phase.
 *
 * Only this helper can see three of these: the dial happens before any statement the caller writes, the commit is
 * sent after the last one, and cleanup runs outside the operation's budget entirely. A measurement taken around the
 * call can see the total and nothing else, and one taken inside the body can attribute neither end of it.
 *
 * Every figure is one observation of one operation, in milliseconds, taken on the client side: a statement's time
 * includes the round trip that carried it
 * @public
 */
export interface ITransactionPhases {
  /* The caller's body, from the first statement it sends to the value it returns */
  bodyMs: number;

  /* Rolling back and closing the pool, bounded separately and spent after the operation's own deadline */
  cleanupMs: number;

  /* `COMMIT` sent until it was answered; zero when the operation ended before one was sent */
  commitMs: number;

  /* Whether the commit was answered, so a refused or abandoned operation is not read as a completed one */
  committed: boolean;

  /* Dialling the pool and taking a connection from it */
  connectMs: number;

  /* The whole budgeted operation, from before the dial until the commit was answered or the operation ended */
  operationMs: number;

  /* `BEGIN` and the three `SET LOCAL` limits, which are four round trips before the caller's work begins */
  preambleMs: number;
}
