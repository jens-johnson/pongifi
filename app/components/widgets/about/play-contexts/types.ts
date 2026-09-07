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
 * █████████████████████████████████ #components/widgets/about/play-contexts/types.ts ██████████████████████████████████
 *
 * Content types for the About page play-context selector.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * One player position in a play-context table arrangement.
 * @internal
 * @interface
 */
export interface IPlayContextSeat {
  /* Whether the player is present in the arrangement */
  on: boolean;

  /* Horizontal position in diagram coordinates */
  x: number;

  /* Vertical position in diagram coordinates */
  y: number;
}

/**
 * One setting presented by the About page play-context selector.
 * @internal
 * @interface
 */
export interface IPlayContext {
  /* Supporting line shown when the context is selected */
  blurb: string;

  /* Selector label */
  label: string;

  /* All four animated player positions, including hidden seats */
  seats: readonly IPlayContextSeat[];
}
