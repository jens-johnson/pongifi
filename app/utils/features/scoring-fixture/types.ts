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
 * █████████████████████████████████████ #utils/features/scoring-fixture/types.ts ██████████████████████████████████████
 *
 * Types for the Features scoring illustration: the per-player standing and the derived label set.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * One player's standing in the live game the diagram depicts
 * @public
 */
export interface IScoringFixturePlayer {
  /* Games won in the best-of-three match */
  gamesWon: number;

  /* Whether this player holds service */
  isServing: boolean;

  /* Display name */
  name: string;

  /* Points scored in the live game */
  score: number;
}

/**
 * Everything the scoring demo labels itself with, derived from a replay rather than written by hand, so the interface
 * cannot claim a state the rules engine would not produce
 * @public
 */
export interface IScoringFixture {
  /* A sentence describing the depicted state, for the diagram's accessible description */
  description: string;

  /* The game being played, counting from one */
  gameNumber: number;

  /* Whether the live game has reached deuce, after which service changes every point */
  isDeuce: boolean;

  /* Whether the match has reached a result */
  isComplete: boolean;

  /* The players, in the order the diagram lays them out: near side first */
  players: IScoringFixturePlayer[];

  /* The rules the match is played under, as a caption */
  settingsCaption: string;

  /* The winning player's name once the match is complete */
  winner: string | null;
}
