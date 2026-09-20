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
 * What bounds one result transaction: how long the whole operation may take, how long one statement may run, how long
 * it may wait for a lock, and how long the transaction may sit idle, all in milliseconds.
 *
 * Chosen from the measured cost of a full-league rating replay rather than from round numbers, and each one deliberately
 * inside the one above it: a statement that used the whole operation's budget would leave nothing for the rollback, and
 * a transaction that outlived the function holding it is a lock nobody will release. The whole-operation bound is the
 * one that matters for a promise about capacity, because the other three each bound a single wait and a long enough
 * sequence of short statements breaks none of them. The measurements these are drawn from are recorded with the spike
 * @public
 * @constant
 */
export const DEFAULT_TRANSACTION_LIMITS: ITransactionLimits = {
  idleTimeoutMs: 3000,
  lockTimeoutMs: 3000,
  operationTimeoutMs: 8000,
  statementTimeoutMs: 5000,
};
