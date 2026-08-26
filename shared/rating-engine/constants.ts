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
 * ████████████████████████████████████████ #shared/rating-engine/constants.ts █████████████████████████████████████████
 *
 * The rating model's constants. Seeded rather than settled; re-fit against real games once there are a few hundred.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameStatus } from '#shared/domain';

/**
 * The rating every player starts on, in every scope
 * @public
 * @constant
 */
export const STARTING_RATING: number = 1200;

/**
 * The K-factor applied while a rating is still provisional
 * @public
 * @constant
 */
export const PROVISIONAL_K_FACTOR: number = 40;

/**
 * The K-factor for an established rating below the elevated threshold
 * @public
 * @constant
 */
export const ESTABLISHED_K_FACTOR: number = 24;

/**
 * The K-factor for an established rating at or above the elevated threshold
 * @public
 * @constant
 */
export const ELEVATED_K_FACTOR: number = 16;

/**
 * The rating at which the elevated K-factor takes over
 * @public
 * @constant
 */
export const ELEVATED_RATING_THRESHOLD: number = 2100;

/**
 * The logistic scale of the Elo expectation curve; a 400-point gap gives the favourite a 10:1 expectation
 * @public
 * @constant
 */
export const ELO_SCALE: number = 400;

/**
 * The numerator of the margin-of-victory dampener. Seeded rather than settled; re-fit against real games (XIII.II)
 * @public
 * @constant
 */
export const DAMPENER_NUMERATOR: number = 2.2;

/**
 * How sharply the dampener responds to a rating gap. Seeded rather than settled
 * @public
 * @constant
 */
export const DAMPENER_GAP_COEFFICIENT: number = 0.001;

/**
 * The ceiling on the margin multiplier, so no single game can move a rating by more than twice the base K
 * @public
 * @constant
 */
export const MARGIN_MULTIPLIER_CAP: number = 2;

/**
 * The floor on the margin multiplier. The multiplier is 1.0 at the minimum winning margin, so an ordinary win behaves
 * exactly like plain Elo; flooring it keeps a below-margin result, which a retirement can produce, from zeroing the
 * exchange entirely
 * @public
 * @constant
 */
export const MARGIN_MULTIPLIER_FLOOR: number = 1;

/**
 * The share of a player's K-factor applied to each of the two pairwise comparisons a cutthroat game decomposes into, so
 * one cutthroat game carries roughly the volatility of one singles game rather than two
 * @public
 * @constant
 */
export const CUTTHROAT_K_SHARE: number = 0.5;

/**
 * Statuses that represent a game actually played to some conclusion, as opposed to awarded, abandoned, or still live
 * @public
 * @constant
 */
export const PLAYED_STATUSES: ReadonlySet<GameStatus> = new Set<GameStatus>([GameStatus.COMPLETE, GameStatus.RETIRED]);
