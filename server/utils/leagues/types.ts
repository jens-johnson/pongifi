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
 * ██████████████████████████████████████████ #server/utils/leagues/types.ts ███████████████████████████████████████████
 *
 * Result and row types for the league-entry operations.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { LeagueRole } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';

import type { LeagueRefusal } from './enums';

/**
 * A league-entry operation that did what was asked, or found it already done.
 * @public
 * @interface
 */
export interface ILeagueOperationSuccess<TValue> {
  /* The operation succeeded */
  ok: true;

  /* What the caller gets back */
  value: TValue;
}

/**
 * A league-entry operation that wrote nothing, and why.
 * @public
 * @interface
 */
export interface ILeagueOperationFailure {
  /* The operation wrote nothing */
  ok: false;

  /* Why, which decides the HTTP answer */
  refusal: LeagueRefusal;
}

/**
 * The result of a league-entry operation.
 * @public
 */
export type TLeagueOperationResult<TValue> = ILeagueOperationFailure | ILeagueOperationSuccess<TValue>;

/**
 * The creation record a submission identifier resolves to.
 * @public
 * @interface
 */
export interface ICreationRequestRow {
  /* The league the submission created */
  leagueId: string;

  /* The digest of the normalized request that created it */
  payloadDigest: string;
}

/**
 * A league as its member-scoped read selects it, before the roster is attached.
 * @public
 * @interface
 */
export interface ILeagueRow {
  /* The league's short mark */
  abbreviation: string;

  /* The league's description, or null */
  description: string | null;

  /* The league's identifier */
  id: string;

  /* The league's name */
  name: string;

  /* The league's stored settings */
  settings: TLeagueSettings;

  /* The reader's own role */
  viewerRole: LeagueRole;
}

/**
 * The most recent shareable invitation of a league, with its usability decided against the database clock.
 * @public
 * @interface
 */
export interface IInviteLinkRow {
  /* Whether the expiry has passed, by the database clock */
  expired: boolean;

  /* When the link stops working, or null for a link issued without expiry */
  expiresAt: Date | null;

  /* The duration it was issued with, in whole days */
  expiresInDays: number;

  /* The invitation's identifier */
  id: string;

  /* The use limit, or null */
  maxUses: number | null;

  /* The stored status */
  status: string;

  /* The token */
  token: string;

  /* How many times it has been used */
  useCount: number;
}

/**
 * The summary a usable invite exposes to a visitor, before it is shaped for the wire.
 * @public
 * @interface
 */
export interface IInviteSummaryRow {
  /* The inviter's current display name */
  inviterName: string;

  /* The league's name */
  leagueName: string;

  /* The number of active members with live accounts */
  memberCount: number;
}
