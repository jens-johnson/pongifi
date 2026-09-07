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
 * █████████████████████████████████ #components/widgets/features/scoring/constants.ts █████████████████████████████████
 *
 * What the scoring surface does, split into the two columns the section renders.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * What the scoring surface does. Every line is scoped to what the rules engine and the schema implement: guest games
 * carry their rating consequence with them, and per-game adjustments are bounded by the league's own settings
 * @public
 * @constant
 */
export const SCORING_CAPABILITIES: readonly string[] = [
  'Rally-by-rally live scoring. In singles and doubles the server and receiver are always shown; in cutthroat the server and the receiving pair are.',
  'Undo the last rally; the score is derived from the log, so nothing is lost.',
  'Deuce, service changes, and changes of ends handled automatically.',
  'Lets, timeouts, towel breaks, and service warnings recorded as they happen.',
  'Enter a finished game after the fact, single score or full match.',
  'Schedule a game for later and record it when you play.',
  'Guests play by name, no account needed (guest games are unrated for everyone in them).',
  'Per-game adjustments within what the league allows: points to win, winning margin, service interval, best-of format.',
];

/**
 * Separate columns prevent a wrapped item from changing the spacing in the neighboring column
 * @public
 * @constant
 */
export const SCORING_CAPABILITY_COLUMNS: readonly (readonly string[])[] = [
  SCORING_CAPABILITIES.slice(0, 4),
  SCORING_CAPABILITIES.slice(4),
];
