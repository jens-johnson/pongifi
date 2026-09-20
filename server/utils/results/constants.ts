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
 * The role that may void a result. Deleting a result is a commissioner's, per the pitch's authority table (V.I)
 * @public
 * @constant
 */
export const VOID_ROLE: string = 'COMMISSIONER';
