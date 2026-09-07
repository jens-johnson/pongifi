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
 * ███████████████████████████████ #components/widgets/about/play-contexts/constants.ts ████████████████████████████████
 *
 * Play-context content and animation timing.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IPlayContext } from './types';

/**
 * The four settings in which Pongifi leagues commonly play.
 * @internal
 * @constant
 */
export const CONTEXTS: readonly IPlayContext[] = [
  {
    blurb: 'Winner stays on, and the queue is half the fun.',
    label: 'The office',
    seats: [
      {
        on: true,
        x: 52,
        y: 130,
      },
      {
        on: true,
        x: 428,
        y: 130,
      },
      {
        on: true,
        x: 196,
        y: 238,
      },
      {
        on: true,
        x: 246,
        y: 238,
      },
    ],
  },
  {
    blurb: 'Two paddles, one table, and a rivalry that predates the app.',
    label: 'The family',
    seats: [
      {
        on: true,
        x: 52,
        y: 130,
      },
      {
        on: true,
        x: 428,
        y: 130,
      },
      {
        on: false,
        x: 150,
        y: 260,
      },
      {
        on: false,
        x: 330,
        y: 260,
      },
    ],
  },
  {
    blurb: 'Doubles, ladders, and people who already keep score properly.',
    label: 'The club',
    seats: [
      {
        on: true,
        x: 52,
        y: 98,
      },
      {
        on: true,
        x: 428,
        y: 98,
      },
      {
        on: true,
        x: 52,
        y: 162,
      },
      {
        on: true,
        x: 428,
        y: 162,
      },
    ],
  },
  {
    blurb: 'Late nights, questionable lighting, genuine stakes.',
    label: 'The garage',
    seats: [
      {
        on: true,
        x: 52,
        y: 130,
      },
      {
        on: true,
        x: 428,
        y: 130,
      },
      {
        on: true,
        x: 300,
        y: 238,
      },
      {
        on: false,
        x: 330,
        y: 260,
      },
    ],
  },
];

/**
 * Milliseconds a play context remains visible before automatic advance.
 * @internal
 * @constant
 */
export const DWELL_MS: number = 5000;
