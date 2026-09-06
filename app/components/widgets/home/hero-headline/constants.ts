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
 * ████████████████████████████████ #components/widgets/home/hero-headline/constants.ts ████████████████████████████████
 *
 * Rotating labels and timing for the landing-page headline.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

/**
 * Hero lines in rotation order; the first line is rendered server-side.
 * @internal
 * @constant
 */
export const HEADLINES: readonly string[] = [
  'Ping pong,\nproperly scored.',
  'Make every\ngame count.',
  'Crown the next\noffice champion.',
  'Bragging rights\nstart here.',
  'From lunch break\nto leaderboard.',
  'Winner\nstays on.',
  'Settle it\non the table.',
  'The table tennis app\nyou actually needed.',
];

/**
 * Milliseconds each hero line remains visible before rotation.
 * @internal
 * @constant
 */
export const INTERVAL_MS: number = 5000;
