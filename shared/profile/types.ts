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
import type { GameType } from '#shared/rules-engine';

import type { LeagueMembershipSort } from './enums';

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

  /* The formats this league currently permits */
  allowedGameTypes: GameType[];

  /* The league's optional description */
  description: string | null;

  /* Accepted games recorded in this league */
  gameCount: number;

  /* The league's identifier */
  id: string;

  /* When the player joined, as an ISO string */
  joinedAt: string;

  /* Active members in this league */
  memberCount: number;

  /* The league's name */
  name: string;

  /* The player's role in this league */
  role: LeagueRole;
}

/**
 * One page of the signed-in player's active league memberships.
 * @public
 * @interface
 */
export interface ILeagueMembershipPage {
  /* Active memberships matching the current search and filters */
  filteredTotal: number;

  /* The effective page after clamping a stale bookmark */
  page: number;

  /* The maximum rows requested for this consumer */
  pageSize: number;

  /* The memberships on the effective page */
  rows: ILeagueMembership[];

  /* Every active membership before search and filters */
  unfilteredTotal: number;
}

/**
 * The normalized server query for a membership page.
 * @public
 * @interface
 */
export interface ILeagueMembershipQuery {
  /* A required allowed format, or null for every format */
  format: GameType | null;

  /* The requested one-based page */
  page: number;

  /* The bounded number of rows returned */
  pageSize: number;

  /* A required viewer role, or null for every role */
  role: LeagueRole | null;

  /* Literal case-insensitive text matched against the name and short mark */
  search: string;

  /* The allowlisted row ordering */
  sort: LeagueMembershipSort;
}

/**
 * A rejected profile write body, carrying both the message and the status it is refused with.
 * @public
 * @interface
 */
export interface IProfileWriteBodyFailure {
  /* The body did not satisfy the shape rule, the allowlist, or the name rule */
  ok: false;

  /* The message returned as the status message */
  message: string;

  /* The HTTP status this particular refusal uses */
  statusCode: number;
}

/**
 * An accepted profile write body, reduced to the one value the endpoints persist.
 * @public
 * @interface
 */
export interface IProfileWriteBodySuccess {
  /* The body satisfied every rule */
  ok: true;

  /* The trimmed name to persist */
  value: string;
}

/**
 * The result of validating an untrusted profile write body.
 * @public
 */
export type TProfileWriteBodyResult = IProfileWriteBodyFailure | IProfileWriteBodySuccess;
