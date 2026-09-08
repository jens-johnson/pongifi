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
 * █████████████████████████████████████████████ #shared/profile/types.ts ██████████████████████████████████████████████
 *
 * The profile payload and display name validation result shapes.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { LeagueRole } from '#shared/domain';

/**
 * The current user's account as `/api/me` returns it.
 *
 * An allowlist rather than the `users` row: the browser never receives the soft-delete stamp or anything else the
 * account page has no use for.
 * @public
 * @interface
 */
export interface IProfile {
  /* The provider-owned profile image, or null when Google supplied none */
  avatarUrl: string | null;

  /* When the account was created, rendered as "member since" */
  createdAt: string;

  /* The player's chosen display name */
  displayName: string;

  /* The verified Google address, read-only on the profile page */
  email: string;

  /* Pongifi's stable user identifier */
  id: string;

  /* When the player finished /welcome, or null while the step is outstanding */
  profileCompletedAt: string | null;
}

/**
 * A rejected display name, carrying the message the form shows.
 * @public
 * @interface
 */
export interface IDisplayNameValidationFailure {
  /* The name did not satisfy the length rule */
  ok: false;

  /* The message shown beneath the field */
  message: string;
}

/**
 * An accepted display name, trimmed and ready to store.
 * @public
 * @interface
 */
export interface IDisplayNameValidationSuccess {
  /* The name satisfied the length rule */
  ok: true;

  /* The trimmed name to persist */
  value: string;
}

/**
 * The result of validating an untrusted display name.
 * @public
 */
export type TDisplayNameValidationResult = IDisplayNameValidationFailure | IDisplayNameValidationSuccess;

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
