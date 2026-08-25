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

import type { ELeagueRole, ELeagueVisibility, EMembershipStatus } from '#shared/domain';

/**
 * A league as the league list and league header render it. A structural mirror of the `leagues` row rather than the
 * generated type, narrow enough that a queried row satisfies it without every consumer importing the schema
 * @public
 */
export interface ILeagueSummary {
  /* The league's identifier */
  id: string;
  /* Its display name */
  name: string;
  /* An abbreviated name, eight characters or fewer */
  abbreviation: string;
  /* An optional description */
  description: string | null;
  /* An optional hero image */
  heroUrl: string | null;
  /* Whether the league can be discovered and requested */
  visibility: ELeagueVisibility;
}

/**
 * A member of a league, joined to the user behind them; the shape the roster and the leaderboard both read
 * @public
 */
export interface ILeagueMember {
  /* The membership's identifier */
  membershipId: string;
  /* The member's user identifier */
  userId: string;
  /* Their display name */
  displayName: string;
  /* Their avatar, where they have one */
  avatarUrl: string | null;
  /* What they may do in this league */
  role: ELeagueRole;
  /* Whether they are active, inactive, or removed */
  status: EMembershipStatus;
}
