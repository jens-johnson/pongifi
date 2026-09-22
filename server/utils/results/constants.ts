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
 * ████████████████████████████████████████ #server/utils/results/constants.ts █████████████████████████████████████████
 *
 * The scope, roles and units the result operations work in.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { RatingScope } from '#shared/domain';
import { SubmissionProblem } from '#shared/results';

/**
 * The one ladder this slice writes. Sub-ratings by format are a later slice, and computing them here would publish a
 * generation whose shape a later migration has to unpick
 * @public
 * @constant
 */
export const REPLAYED_SCOPE: RatingScope = RatingScope.OVERALL;

/**
 * How many milliseconds are in an hour, which is the unit both frozen windows are stated in
 * @public
 * @constant
 */
export const HOUR_MS: number = 60 * 60 * 1000;

/**
 * The roles that may record for anybody, amend a disputed result, and see every action a league's results offer
 * @public
 * @constant
 */
export const ADMIN_ROLES: readonly string[] = ['COMMISSIONER', 'MANAGER'];

/**
 * The most revisions one settlement sweep will accept, so a league nobody has read for a month cannot ask one
 * transaction to settle more than it has time for. What is left stays due and is picked up by the next run
 * @public
 * @constant
 */
export const SETTLEMENT_BATCH: number = 50;

/**
 * The most candidate matches one duplicate check reads under the league's lock. A warning is worth a bounded look
 * and nothing more: a busy evening must not turn one save into an unbounded scan inside a transaction
 * @public
 * @constant
 */
export const DUPLICATE_SCAN_LIMIT: number = 50;

/**
 * The submission problems that are about when the match was played rather than about what was entered.
 *
 * The two bounds a result write measures against a window, and the only two whose refusal states that window back.
 * Every other problem keeps the general validation sentence: telling somebody with an impossible score that their
 * play time was wrong is worse than telling them nothing
 * @public
 * @constant
 */
export const PLAY_TIME_PROBLEMS: readonly SubmissionProblem[] = [
  SubmissionProblem.PLAYED_AT_FUTURE,
  SubmissionProblem.PLAYED_AT_STALE,
];
