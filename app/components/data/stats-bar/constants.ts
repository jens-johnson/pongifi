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
 * ██████████████████████████████████████ #components/data/stats-bar/constants.ts ██████████████████████████████████████
 *
 * Display labels, thresholds, and timing constants for public statistics.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IStat, IStatUnit } from './types';

/**
 * Duration of the count-up animation in milliseconds.
 * @internal
 * @constant
 */
export const COUNT_MS: number = 1400;

/**
 * Games required before social-proof figures appear.
 * @internal
 * @constant
 */
export const MINIMUM_GAMES: number = 25;

/**
 * Refresh interval for public statistics in milliseconds.
 * @internal
 * @constant
 */
export const POLL_MS: number = 30000;

/**
 * Public statistics rendered in presentation order.
 * @internal
 * @constant
 */
export const STATS: readonly IStat[] = [
  { key: 'gamesRecorded', label: 'games recorded' },
  { key: 'pointsScored', label: 'points scored' },
  { key: 'minutesLogged', label: 'minutes at the table' },
  { key: 'leaguesActiveThisWeek', label: 'leagues active this week' },
];

/**
 * Magnitudes used to abbreviate large values, ordered largest first.
 * @internal
 * @constant
 */
export const STAT_UNITS: readonly IStatUnit[] = [
  { divisor: 1e9, suffix: 'B' },
  { divisor: 1e6, suffix: 'M' },
  { divisor: 1e3, suffix: 'K' },
];
