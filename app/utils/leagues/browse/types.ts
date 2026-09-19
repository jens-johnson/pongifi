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
 * ██████████████████████████████████████████ #utils/leagues/browse/types.ts ███████████████████████████████████████████
 *
 * Route-state types for the full leagues list.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { LeagueRole } from '#shared/domain';
import type { LeagueListPresentation, LeagueMembershipSort } from '#shared/profile';
import type { GameType } from '#shared/rules-engine';

/**
 * The full membership-list state persisted in the route query.
 * @public
 * @interface
 */
export interface ILeagueListRouteState {
  /* A required format, or null for every format */
  format: GameType | null;

  /* The requested one-based page */
  page: number;

  /* The chosen desktop presentation */
  presentation: LeagueListPresentation;

  /* A required viewer role, or null for every role */
  role: LeagueRole | null;

  /* Literal text matched against league names and short marks */
  search: string;

  /* The chosen row ordering */
  sort: LeagueMembershipSort;
}
