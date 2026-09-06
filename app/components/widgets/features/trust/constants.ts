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
 * ██████████████████████████████████ #components/widgets/features/trust/constants.ts ██████████████████████████████████
 *
 * How a result reaches acceptance, and which games count toward which records.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * How a recorded result travels to acceptance, and what happens when it is disputed, amended or voided
 * @public
 * @constant
 */
export const TRUST_WORKFLOW: readonly string[] = [
  'When confirmation is on, recording a result asks the other participants to confirm it.',
  "If nobody responds inside the league's confirmation window, the result is accepted automatically.",
  'Accepted results count toward the records and ratings they qualify for.',
  'Disputed results are held out of everything until a manager resolves them.',
  "Results can be amended inside the league's amendment window; anything that depended on them is recalculated.",
  'Retirements, walkovers, and no contests are recorded as what they were. A walkover counts as a win and nothing else; no ball was struck, so there is nothing to rate.',
  'Commissioners can void a game, and the ratings that depended on it are replayed.',
];

/**
 * Which games count toward which records. The distinctions are the ones the schema enforces, not editorial ones
 * @public
 * @constant
 */
export const TRUST_ELIGIBILITY: readonly string[] = [
  'Win/loss counts accepted games, including walkovers. A walkover credits the win and nothing else: no ball was struck, so there is nothing to rate and nothing to measure.',
  'Ratings require an accepted, played game in a league that rates games, with no guest in the game and no unrated override on it.',
  'Point statistics count any accepted, played game. A retirement contributes the points scored before the withdrawal; a walkover contributes none, having been awarded rather than played.',
  'Rally statistics additionally require that the game was scored live.',
  'The practical version: you can seat someone without an account as a guest, and that game still counts for points and for win/loss. It is simply unrated for everyone in it, guest and members alike.',
];
