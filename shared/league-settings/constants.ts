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
 * ███████████████████████████████████████ #shared/league-settings/constants.ts ████████████████████████████████████████
 *
 * The standard settings a new league starts with, from MVP Pitch IV.II and IV.III.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameCreator, ResultRecorder } from '#shared/domain';
import { GameType } from '#shared/rules-engine';

import type { TLeagueSettings } from './types';

/**
 * The settings every league starts with: the IV.II gameplay defaults and the IV.III administration defaults.
 *
 * League creation asks only which formats are played and takes everything else from here, because nobody can judge a
 * confirmation window or a provisional-game count before a single game has been played in the league
 * @public
 * @constant
 */
export const STANDARD_LEAGUE_SETTINGS: TLeagueSettings = {
  allowedGameTypes: [GameType.SINGLES, GameType.DOUBLES, GameType.CUTTHROAT],
  cutthroatTimeCap: 15,
  expediteEnabled: false,
  matchFormat: 1,
  provisionalGames: 10,
  ratingEnabled: true,
  requireConfirmation: true,
  resultAmendmentWindow: 48,
  resultConfirmationWindow: 24,
  serviceInterval: 2,
  targetScore: {
    [GameType.CUTTHROAT]: 7,
    [GameType.DOUBLES]: 11,
    [GameType.SINGLES]: 11,
  },
  walkoverGracePeriod: 10,
  whoCanCreateGames: GameCreator.PLAYER,
  whoCanRecordResults: ResultRecorder.PARTICIPANTS,
  winningMargin: 2,
};
