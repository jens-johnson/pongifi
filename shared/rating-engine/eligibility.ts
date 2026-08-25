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
 * ███████████████████████████████████████ #shared/rating-engine/eligibility.ts ████████████████████████████████████████
 *
 * What a game feeds; the data eligibility matrix in spec VIII.VII expressed as four pure predicates.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { EConfirmationStatus, EGameStatus } from '#shared/domain';

import type { IGameEligibility } from './types';

/**
 * Statuses that represent a game actually played to some conclusion
 * @internal
 * @constant
 */
const PLAYED_STATUSES = new Set<EGameStatus>([EGameStatus.COMPLETE, EGameStatus.RETIRED]);

/**
 * Whether a result has been accepted. An unconfirmed or disputed game feeds nothing at all until it is settled, which
 * is what stops a solo-recorded result moving ratings before anyone else has seen it (VII.VI)
 * @internal
 * @function
 * @param eligibility - The game's eligibility facts
 * @returns Whether the result counts yet
 */
function isSettled(eligibility: IGameEligibility): boolean {
  return eligibility.confirmationStatus === EConfirmationStatus.CONFIRMED;
}

/**
 * Whether a game counts toward win-loss records. Walkovers count here and nowhere else: a side that turned up is
 * credited with the win, but no ball was struck, so there is nothing to rate and nothing to measure (III.II.X.I)
 * @public
 * @function
 * @param eligibility - The game's eligibility facts
 * @returns Whether the game feeds win-loss
 */
export function feedsWinLoss(eligibility: IGameEligibility): boolean {
  return (
    isSettled(eligibility) && (PLAYED_STATUSES.has(eligibility.status) || eligibility.status === EGameStatus.WALKOVER)
  );
}

/**
 * Whether a game feeds ratings. A guest carries no rating, so there is no defensible expected score to update the
 * members against, and the game is unrated for everyone in it (VI.III)
 * @public
 * @function
 * @param eligibility - The game's eligibility facts
 * @returns Whether the game moves ratings
 */
export function feedsRatings(eligibility: IGameEligibility): boolean {
  return (
    isSettled(eligibility) &&
    PLAYED_STATUSES.has(eligibility.status) &&
    eligibility.ratingEnabled &&
    !eligibility.hasGuest &&
    !eligibility.isUnratedOverride
  );
}

/**
 * Whether a game feeds points-based statistics. A retirement contributes the points scored before the withdrawal; a
 * walkover contributes none, having been awarded rather than played
 * @public
 * @function
 * @param eligibility - The game's eligibility facts
 * @returns Whether the game feeds points statistics
 */
export function feedsPointStatistics(eligibility: IGameEligibility): boolean {
  return isSettled(eligibility) && PLAYED_STATUSES.has(eligibility.status);
}

/**
 * Whether a game feeds service and rally statistics. These need the point-level detail only a live recording captures;
 * a retroactive entry produces a synthetic log sufficient to reconstruct the score and nothing more (VII.IV)
 * @public
 * @function
 * @param eligibility - The game's eligibility facts
 * @returns Whether the game feeds rally statistics
 */
export function feedsRallyStatistics(eligibility: IGameEligibility): boolean {
  return feedsPointStatistics(eligibility) && eligibility.isLiveRecorded;
}
