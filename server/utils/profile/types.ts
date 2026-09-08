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
 * ██████████████████████████████████████████ #server/utils/profile/types.ts ███████████████████████████████████████████
 *
 * Row and payload shapes for the profile queries.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { LeagueRole } from '#shared/domain';

/**
 * A user row as the profile queries select it, before timestamps are rendered for the browser.
 * @public
 * @interface
 */
export interface IProfileRow {
  /* The provider-owned profile image, or null when Google supplied none */
  avatarUrl: string | null;

  /* When the account was created */
  createdAt: Date;

  /* The player's chosen display name */
  displayName: string;

  /* The verified Google address */
  email: string;

  /* Pongifi's stable user identifier */
  id: string;

  /* When the player finished /welcome, or null while the step is outstanding */
  profileCompletedAt: Date | null;
}

/**
 * One league the signed-in player belongs to, as the home and leagues panels render it.
 * @public
 * @interface
 */
export interface ILeagueMembership {
  /* The league's short form, shown where the full name will not fit */
  abbreviation: string;

  /* The league's identifier */
  id: string;

  /* When the player joined, as an ISO string */
  joinedAt: string;

  /* The league's name */
  name: string;

  /* The player's role in this league */
  role: LeagueRole;
}
