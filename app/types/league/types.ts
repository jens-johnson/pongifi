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
 * ██████████████████████████████████████████████ #types/league/types.ts ███████████████████████████████████████████████
 *
 * Structural mirrors of the league rows the app renders, kept narrow so queried rows satisfy them directly.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { LeagueRole, LeagueVisibility, MembershipStatus } from '#shared/domain';

/**
 * A member of a league, joined to the user behind them; the shape the roster and the leaderboard both read
 * @public
 */
export interface ILeagueMember {
  /* Their avatar, where they have one */
  avatarUrl: string | null;

  /* Their display name */
  displayName: string;

  /* The membership's identifier */
  membershipId: string;

  /* What they may do in this league */
  role: LeagueRole;

  /* Whether they are active, inactive, or removed */
  status: MembershipStatus;

  /* The member's user identifier */
  userId: string;
}

/**
 * A league as the league list and league header render it. A structural mirror of the `leagues` row rather than the
 * generated type, narrow enough that a queried row satisfies it without every consumer importing the schema
 * @public
 */
export interface ILeagueSummary {
  /* An abbreviated name, eight characters or fewer */
  abbreviation: string;

  /* An optional description */
  description: string | null;

  /* An optional hero image */
  heroUrl: string | null;

  /* The league's identifier */
  id: string;

  /* Its display name */
  name: string;

  /* Whether the league can be discovered and requested */
  visibility: LeagueVisibility;
}
