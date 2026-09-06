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
 * ████████████████████████████ #components/widgets/about/difference-carousel/constants.ts █████████████████████████████
 *
 * Slides and timing constants for the About page difference carousel.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IDifference } from './types';

/**
 * The three About page claims in their presentation order.
 * @internal
 * @constant
 */
export const DIFFERENCES: readonly IDifference[] = [
  {
    body: 'Every recorded game waits for the other player to confirm it, and nothing reaches the standings on one person’s word alone. It is the difference between a leaderboard people trust and one they argue about.',
    diagram: 'agreed',
    title: 'Scores are agreed upon, not claimed',
  },
  {
    body: 'Pongifi goes much further than a casual “first to 11, win by 2”, drawing on the ',
    diagram: 'rules',
    link: {
      after:
        '. From the expedite system and change of ends to service order in doubles and retirement, Pongifi models the official structure of the game, so an unusual match still scores correctly instead of needing an asterisk and a group chat argument.',
      href: 'https://www.ittf.com/statutes/',
      label: 'legal rules of the game put forward by the ITTF',
    },
    title: 'True to the rules',
  },
  {
    body: 'Beating someone better than you moves your rating further than beating someone worse. New players settle quickly, established ones move deliberately. The ladder answers who is actually best, not who played the most.',
    diagram: 'ratings',
    title: 'Ratings that move for the right reasons',
  },
];

/**
 * Milliseconds a claim remains visible before automatic advance.
 * @internal
 * @constant
 */
export const DWELL_MS: number = 7000;
