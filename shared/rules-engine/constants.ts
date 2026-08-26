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

import { GameType } from './enums';

/**
 * Pongifi's default target score per game type; leagues override these, and a game may override the league
 * @public
 * @constant
 */
export const DEFAULT_TARGET_SCORE: Record<GameType, number> = {
  [GameType.SINGLES]: 11,
  [GameType.DOUBLES]: 11,
  [GameType.CUTTHROAT]: 7,
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
export const PARTICIPANT_COUNT: Record<GameType, number> = {
  [GameType.SINGLES]: 2,
  [GameType.DOUBLES]: 4,
  [GameType.CUTTHROAT]: 3,
};

/**
 * Service interval once deuce or expedite is in force; both alternate service every point
 * @internal
 * @constant
 */
export const SINGLE_POINT_SERVICE_INTERVAL = 1;
