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
 * █████████████████████████████████████████ #shared/rules-engine/constants.ts █████████████████████████████████████████
 *
 * Pongifi's rule defaults; every one of these is overridable by a league or, where permitted, by a single game.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { EGameType } from './enums';

/**
 * Pongifi's default target score per game type; leagues override these, and a game may override the league
 * @public
 * @constant
 */
export const DEFAULT_TARGET_SCORE: Record<EGameType, number> = {
  [EGameType.SINGLES]: 11,
  [EGameType.DOUBLES]: 11,
  [EGameType.CUTTHROAT]: 7,
};

/**
 * The lead required to win a game
 * @public
 * @constant
 */
export const DEFAULT_WINNING_MARGIN = 2;

/**
 * Points between changes of service before deuce
 * @public
 * @constant
 */
export const DEFAULT_SERVICE_INTERVAL = 2;

/**
 * Minutes before a cutthroat game is capped
 * @public
 * @constant
 */
export const DEFAULT_CUTTHROAT_TIME_CAP = 15;

/**
 * How many participants each game type takes
 * @public
 * @constant
 */
export const PARTICIPANT_COUNT: Record<EGameType, number> = {
  [EGameType.SINGLES]: 2,
  [EGameType.DOUBLES]: 4,
  [EGameType.CUTTHROAT]: 3,
};

/**
 * Service interval once deuce or expedite is in force; both alternate service every point
 * @internal
 * @constant
 */
export const SINGLE_POINT_SERVICE_INTERVAL = 1;
