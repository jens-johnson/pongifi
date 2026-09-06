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
 * ███████████████████████████████ #components/widgets/features/ratings-diagram/types.ts ███████████████████████████████
 *
 * Types for the leaderboard illustration: one row of the depicted standings.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * One row of the depicted leaderboard
 * @public
 */
export interface IRatingsPlayerRow {
  /* Which way the player moved since the last recalculation */
  movement: 'down' | 'none' | 'up';

  /* Display name */
  name: string;

  /* Whether the player is still inside their provisional period, during which ratings move faster */
  provisional?: boolean;

  /* Position on the leaderboard, counting from one */
  rank: number;
}
