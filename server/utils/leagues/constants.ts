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
 * ████████████████████████████████████████ #server/utils/leagues/constants.ts █████████████████████████████████████████
 *
 * Constraint names, token size, roles and the HTTP answers for league-entry refusals.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { LeagueRole } from '#shared/domain';

import { LeagueRefusal } from './enums';

/* ─── Database ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The SQLSTATE Postgres raises for a unique violation.
 * @public
 * @constant
 */
export const UNIQUE_VIOLATION_CODE: string = '23505';

/**
 * The partial unique index that holds one PENDING shareable link per league. Two first issues racing each other have
 * no row to lock, so the loser meets this index instead; it is matched by name so no other violation is swallowed.
 * @public
 * @constant
 */
export const SHARED_INVITE_CONSTRAINT: string = 'invitations_league_shared_pending_unique';

/**
 * The unique index on a creator's submission identifiers. Two identical submissions racing each other meet it, and the
 * loser's whole statement, league included, rolls back.
 * @public
 * @constant
 */
export const CREATION_REQUEST_CONSTRAINT: string = 'league_creation_requests_creator_submission_unique';

/**
 * How many random bytes an invite token carries; unpadded base64url renders 32 bytes as 43 characters.
 * @public
 * @constant
 */
export const INVITE_TOKEN_BYTES: number = 32;

/**
 * The roles that may see and manage a league's invite link (V.I).
 * @public
 * @constant
 */
export const INVITE_MANAGER_ROLES: readonly LeagueRole[] = [LeagueRole.COMMISSIONER, LeagueRole.MANAGER];

/* ─── Messages ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The one answer for an unknown league, a malformed identifier, and a league the caller is not an active member of.
 * @public
 * @constant
 */
export const LEAGUE_NOT_FOUND_MESSAGE: string = 'Pongifi could not find that league.';

/**
 * The one answer for an unknown, expired, revoked, exhausted or refused invite.
 * @public
 * @constant
 */
export const INVITE_UNAVAILABLE_MESSAGE: string = 'This invite is not available.';

/**
 * Returned when a player asks for invite management that only commissioners and managers have.
 * @public
 * @constant
 */
export const INVITE_MANAGEMENT_FORBIDDEN_MESSAGE: string = 'Only a commissioner or manager can manage the invite link.';

/**
 * Returned when a replace or revoke names a link that is no longer the current one; the panel re-reads on it.
 * @public
 * @constant
 */
export const INVITE_STALE_MESSAGE: string = 'This link was already replaced. Read the current link before changing it.';

/**
 * Returned when a submission identifier arrives carrying a different league than the one it already created.
 * @public
 * @constant
 */
export const CREATE_CONFLICT_MESSAGE: string = 'This submission already created a league with different details.';

/**
 * Returned when an account that still owes /welcome attempts a league write.
 * @public
 * @constant
 */
export const WELCOME_REQUIRED_MESSAGE: string = 'Finish setting up your account first.';

/**
 * Returned when the session names an account that no longer exists.
 * @public
 * @constant
 */
export const ACCOUNT_UNAVAILABLE_MESSAGE: string = 'This account is no longer available.';

/**
 * The 502 message when league creation cannot reach the database.
 * @public
 * @constant
 */
export const CREATE_LEAGUE_UPSTREAM_MESSAGE: string = 'Pongifi could not create the league.';

/**
 * The 502 message when a league read cannot reach the database.
 * @public
 * @constant
 */
export const READ_LEAGUE_UPSTREAM_MESSAGE: string = 'Pongifi could not read the league.';

/**
 * The 502 message when an invite-link read or write cannot reach the database.
 * @public
 * @constant
 */
export const INVITE_LINK_UPSTREAM_MESSAGE: string = 'Pongifi could not update the invite link.';

/**
 * The 502 message when an invite lookup cannot reach the database.
 * @public
 * @constant
 */
export const INVITE_LOOKUP_UPSTREAM_MESSAGE: string = 'Pongifi could not read the invite.';

/**
 * The 502 message when an acceptance cannot reach the database.
 * @public
 * @constant
 */
export const ACCEPT_INVITE_UPSTREAM_MESSAGE: string = 'Pongifi could not add you to the league.';

/* ─── Answers ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The status each refusal is answered with.
 * @public
 * @constant
 */
export const REFUSAL_STATUS: Readonly<Record<LeagueRefusal, number>> = {
  /* The session is stale; the browser signs in again */
  [LeagueRefusal.ACCOUNT_MISSING]: 401,

  /* A replayed identifier with a different payload */
  [LeagueRefusal.CONFLICT]: 409,

  /* A member without the role */
  [LeagueRefusal.FORBIDDEN]: 403,

  /* Answered as a body rather than thrown, so the response keeps its private cache policy */
  [LeagueRefusal.INVITE_UNAVAILABLE]: 404,

  /* Answered as a body rather than thrown, for the same reason */
  [LeagueRefusal.LEAGUE_NOT_FOUND]: 404,

  /* The page routes the account through /welcome on this */
  [LeagueRefusal.NEEDS_WELCOME]: 403,

  /* The panel re-reads on this */
  [LeagueRefusal.STALE]: 409,
};

/**
 * The message each refusal is answered with.
 * @public
 * @constant
 */
export const REFUSAL_MESSAGE: Readonly<Record<LeagueRefusal, string>> = {
  /* The account is gone */
  [LeagueRefusal.ACCOUNT_MISSING]: ACCOUNT_UNAVAILABLE_MESSAGE,

  /* The identifier was already spent */
  [LeagueRefusal.CONFLICT]: CREATE_CONFLICT_MESSAGE,

  /* The role is missing */
  [LeagueRefusal.FORBIDDEN]: INVITE_MANAGEMENT_FORBIDDEN_MESSAGE,

  /* The invite cannot be used */
  [LeagueRefusal.INVITE_UNAVAILABLE]: INVITE_UNAVAILABLE_MESSAGE,

  /* The league cannot be shown */
  [LeagueRefusal.LEAGUE_NOT_FOUND]: LEAGUE_NOT_FOUND_MESSAGE,

  /* Welcome is outstanding */
  [LeagueRefusal.NEEDS_WELCOME]: WELCOME_REQUIRED_MESSAGE,

  /* The link moved on */
  [LeagueRefusal.STALE]: INVITE_STALE_MESSAGE,
};
