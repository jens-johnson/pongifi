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
 * ████████████████████████████████████████ #utils/leagues/display/constants.ts ████████████████████████████████████████
 *
 * Labels and locale for the league page and invite panel copy.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { GameType } from '#shared/rules-engine';

/**
 * How each format is named on the league page.
 * @public
 * @constant
 */
export const GAME_TYPE_LABELS: Readonly<Record<GameType, string>> = {
  /* The house-rules three-player format */
  [GameType.CUTTHROAT]: 'Cutthroat',

  /* Two against two */
  [GameType.DOUBLES]: 'Doubles',

  /* One against one */
  [GameType.SINGLES]: 'Singles',
};

/**
 * The locale dates are written in across the account surfaces: day, month name, year.
 * @public
 * @constant
 */
export const DISPLAY_DATE_LOCALE: string = 'en-GB';
