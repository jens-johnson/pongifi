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
 * ████████████████████████████████████████ #components/data/stats-bar/types.ts ████████████████████████████████████████
 *
 * Display unit types for public statistics.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Imported by the sibling component.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { IPublicStats } from '../../../../server/api/stats.get';

/**
 * One public statistic rendered by the landing page stats bar.
 * @internal
 * @interface
 */
export interface IStat {
  /* Numeric API field displayed by the item */
  key: keyof Pick<IPublicStats, 'gamesRecorded' | 'leaguesActiveThisWeek' | 'minutesLogged' | 'pointsScored'>;

  /* Human-readable label */
  label: string;

  /* Optional suffix appended to the formatted value */
  suffix?: string;
}

/**
 * One magnitude used to abbreviate large public statistics.
 * @internal
 * @interface
 */
export interface IStatUnit {
  /* Smallest power represented by the suffix */
  divisor: number;

  /* Abbreviation appended to the scaled value */
  suffix: string;
}
