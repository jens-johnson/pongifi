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

import type { INumericBounds, TBoundedSetting, TLeagueSettings, TNumericSetting } from './types';

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

/**
 * The inclusive whole-number range every plain numeric setting is accepted in, read by the editor's controls and by
 * the server validator so a limit exists in exactly one place.
 *
 * The lower bounds follow the engines: a winning margin of zero would make the rating multiplier's logarithmic
 * denominator zero, and a service interval of zero leaves the counter without a threshold. Zero is meaningful only for
 * `cutthroatTimeCap`, where the rules engine already reads it as "no cap". The upper bounds are editor guardrails
 * rather than mathematical limits — the largest supported target scale for point settings, a day for the minute
 * settings, thirty days for the result windows and an extended calibration period for provisional games — decided in
 * the numeric contract addendum of 2026-09-14. Every value in {@link STANDARD_LEAGUE_SETTINGS} sits inside its range
 * @public
 * @constant
 */
export const LEAGUE_SETTINGS_NUMERIC_BOUNDS: Readonly<Record<TBoundedSetting, INumericBounds>> = {
  cutthroatTimeCap: { max: 1440, min: 0 },
  provisionalGames: { max: 1000, min: 1 },
  resultAmendmentWindow: { max: 720, min: 1 },
  resultConfirmationWindow: { max: 720, min: 1 },
  serviceInterval: { max: 21, min: 1 },
  walkoverGracePeriod: { max: 1440, min: 1 },
  winningMargin: { max: 21, min: 1 },
};

/**
 * The best-of values a league may be set to (pitch IV.II).
 *
 * A set rather than a range because only odd values are self-consistent: `gamesToWin` is `floor(N / 2) + 1`, so a
 * best of 4 is first to 3 and a 2-2 split plays a fifth game, and the deciding-game change of ends keys off the game
 * number equalling N, which is not the final possible game when N is even
 * @public
 * @constant
 */
export const MATCH_FORMAT_CHOICES: readonly number[] = [1, 3, 5, 7];

/**
 * The score each format may be played to (pitch III.II and IV.II), per format.
 * @public
 * @constant
 */
export const TARGET_SCORE_CHOICES: Readonly<Record<GameType, readonly number[]>> = {
  [GameType.CUTTHROAT]: [7, 11, 15],
  [GameType.DOUBLES]: [11, 15, 21],
  [GameType.SINGLES]: [11, 15, 21],
};

/**
 * The formats a target score is validated for, in the order the settings page lists them.
 *
 * Every format is validated whichever ones the league currently allows, so hiding a format cannot park an unusable
 * value in the stored object. It holds the same order as `LEAGUE_GAME_TYPE_ORDER` and is deliberately not that
 * constant: `#shared/leagues` imports this module for the settings shape, so the dependency cannot point back
 * @public
 * @constant
 */
export const TARGET_SCORE_FORMAT_ORDER: readonly GameType[] = [GameType.SINGLES, GameType.DOUBLES, GameType.CUTTHROAT];

/**
 * Every numeric setting in the order the settings page lists its controls, so a refusal names the first field a
 * commissioner would have found and the page has somewhere to put focus.
 *
 * One list rather than the ranges followed by the sets, because the page interleaves them: the Formats and scoring
 * section runs Game to, Win by, then the singles and doubles sub-group of Best of and Serve changes every, then the
 * cutthroat cap and the walkover grace. `targetScore` stands for one check per format, in
 * {@link TARGET_SCORE_FORMAT_ORDER}
 * @public
 * @constant
 */
export const LEAGUE_SETTINGS_NUMERIC_ORDER: readonly TNumericSetting[] = [
  'targetScore',
  'winningMargin',
  'matchFormat',
  'serviceInterval',
  'cutthroatTimeCap',
  'walkoverGracePeriod',
  'resultConfirmationWindow',
  'resultAmendmentWindow',
  'provisionalGames',
];
