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
 * ███████████████████████████████████████████ #server/utils/db/constants.ts ███████████████████████████████████████████
 *
 * The limits one result transaction runs under.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { ITransactionLimits } from './types';

/**
 * How long one statement inside a result transaction may run, how long it may wait for a lock, and how long the
 * transaction may sit idle, all in milliseconds.
 *
 * Chosen from the measured cost of a full-league rating replay rather than from a round number, and deliberately
 * inside the platform's own request limit: a transaction that outlives the function holding it is a lock nobody will
 * release. The measurements these are drawn from are recorded with the spike
 * @public
 * @constant
 */
export const DEFAULT_TRANSACTION_LIMITS: ITransactionLimits = {
  idleTimeoutMs: 5000,
  lockTimeoutMs: 5000,
  statementTimeoutMs: 10000,
};
