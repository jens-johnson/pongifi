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
 * ███████████████████████████████████ #utils/features/scoring-fixture/constants.ts ████████████████████████████████████
 *
 * The fixture match the Features scoring illustration depicts: its settings, its players, and its scoreline.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IMatchSettings } from '#shared/rules-engine';
import { DEFAULT_SERVICE_INTERVAL, DEFAULT_WINNING_MARGIN, GameType } from '#shared/rules-engine';

/**
 * The rules the depicted match is played under. Best-of-three rather than Pongifi's best-of-one default, because the
 * illustration needs a finished first game to show that service carries over between games
 * @public
 * @constant
 */
export const SCORING_FIXTURE_SETTINGS: IMatchSettings = {
  cutthroatTimeCap: 0,
  expediteEnabled: false,
  gameType: GameType.SINGLES,
  matchFormat: 3,
  serviceInterval: DEFAULT_SERVICE_INTERVAL,
  targetScore: 11,
  winningMargin: DEFAULT_WINNING_MARGIN,
};

/**
 * The player who serves first in game one, and so is side A for the whole match
 * @public
 * @constant
 */
export const SCORING_FIXTURE_FIRST_SERVER: string = 'Sam';

/**
 * The player who receives first in game one, and so is side B for the whole match. The rotation swaps between games,
 * which is what hands this player the serve in game two
 * @public
 * @constant
 */
export const SCORING_FIXTURE_FIRST_RECEIVER: string = 'Maya';

/**
 * The losing score in the completed first game; the winner reaches the target
 * @public
 * @constant
 */
export const SCORING_FIXTURE_GAME_ONE_LOSING_SCORE: number = 7;

/**
 * Points played in game two before the diagram's snapshot. Twenty alternating points put both players one short of the
 * target, which is deuce, and return service to the player who opened the game
 * @public
 * @constant
 */
export const SCORING_FIXTURE_GAME_TWO_POINTS: number = 20;
