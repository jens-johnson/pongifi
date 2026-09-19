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
 * ███████████████████████████████ #components/widgets/leagues/rules-panel/constants.ts ████████████████████████████████
 *
 * Headings, block ids and fixed words of a league's rules card.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameType } from '#shared/rules-engine';
import type { TSettingsControl } from '~/utils/leagues/settings';

/**
 * What separates the rules of the summary line.
 * @public
 * @constant
 */
export const RULES_SUMMARY_SEPARATOR: string = ' · ';

/**
 * What separates the confirmation row's state from the window it is accepted after.
 * @public
 * @constant
 */
export const RULES_CONFIRMATION_SEPARATOR: string = ' · ';

/**
 * The heading of the group holding which formats are played and the rules of each.
 * @public
 * @constant
 */
export const RULES_FORMATS_HEADING: string = 'Formats';

/**
 * The heading of the group holding the targets and the margin.
 * @public
 * @constant
 */
export const RULES_SCORING_HEADING: string = 'Scoring';

/**
 * The heading of the group holding who plays, who records and how a result is accepted.
 * @public
 * @constant
 */
export const RULES_RESULTS_HEADING: string = 'Results';

/**
 * The heading of the group holding whether games are rated.
 * @public
 * @constant
 */
export const RULES_RATINGS_HEADING: string = 'Ratings';

/**
 * What a cutthroat time cap of zero reads as; the rules engine already treats zero as no cap (III.II.IX.IX).
 * @public
 * @constant
 */
export const RULES_NO_TIME_CAP: string = 'No cap';

/**
 * What a setting that is on or off reads as.
 * @public
 * @constant
 */
export const RULES_ON: string = 'On';

/**
 * What a setting that is off reads as.
 * @public
 * @constant
 */
export const RULES_OFF: string = 'Off';

/**
 * The id of the block naming which formats the league plays.
 * @public
 * @constant
 */
export const RULES_BLOCK_FORMATS: string = 'formats';

/**
 * The id of the block holding the rules that apply to singles and doubles but never to cutthroat.
 * @public
 * @constant
 */
export const RULES_BLOCK_SINGLES_DOUBLES: string = 'singles-doubles';

/**
 * The id of the block holding the rules that apply to cutthroat alone.
 * @public
 * @constant
 */
export const RULES_BLOCK_CUTTHROAT: string = 'cutthroat';

/**
 * The id of the one block every group other than Formats holds.
 * @public
 * @constant
 */
export const RULES_BLOCK_ROWS: string = 'rows';

/**
 * The id of the region the disclosure control opens, named so the control can point `aria-controls` at it.
 * @public
 * @constant
 */
export const RULES_DISCLOSURE_REGION_ID: string = 'league-rules-detail';

/**
 * The settings control each format's target score is addressed by, so a row reads the settings page's own label.
 * @public
 * @constant
 */
export const RULES_TARGET_SCORE_CONTROLS: Readonly<Record<GameType, TSettingsControl>> = {
  /* The house-rules three-player format */
  [GameType.CUTTHROAT]: 'targetScore.CUTTHROAT',

  /* Two against two */
  [GameType.DOUBLES]: 'targetScore.DOUBLES',

  /* One against one */
  [GameType.SINGLES]: 'targetScore.SINGLES',
};
