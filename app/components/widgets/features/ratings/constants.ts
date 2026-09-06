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
 * █████████████████████████████████ #components/widgets/features/ratings/constants.ts █████████████████████████████████
 *
 * What the ratings system provides, in the order the section lists them.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * What the ratings system provides, in the order the section lists them
 * @public
 * @constant
 */
export const RATING_CAPABILITIES: readonly string[] = [
  'A rating per player, per league, based on Elo.',
  'Separate ratings for singles, doubles, and cutthroat, plus an overall.',
  'A provisional period where new ratings move faster, then settle.',
  'In singles and doubles, margin of victory nudges the exchange within limits, so 11-3 and 11-9 do not count identically.',
  'Ratings recompute when a result is amended or voided, so the ladder always reflects the log.',
  'Rating history per player, and a league leaderboard per scope.',
  'Games, points, and minutes at the table, per player and per league.',
];
