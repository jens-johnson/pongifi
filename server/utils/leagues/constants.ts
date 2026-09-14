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
 * Constraint names, token size, roles, shared SQL predicates and the HTTP answers for league-entry refusals.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { SQL } from 'drizzle-orm';
import { and, isNotNull, isNull, sql } from 'drizzle-orm';

import { LeagueRole } from '#shared/domain';
import { SETTINGS_SECTION_FORBIDDEN_MESSAGE, SETTINGS_STALE_MESSAGE } from '#shared/leagues';

import { memberships } from '../../db/schema';
import { users } from '../../db/schema/users';
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

/**
 * The roles that may save the Identity section of the settings page: the league profile is a commissioner's or a
 * manager's to change (pitch IV.IV), while every other section is a commissioner's alone.
 * @public
 * @constant
 */
export const IDENTITY_EDITOR_ROLES: readonly LeagueRole[] = [LeagueRole.COMMISSIONER, LeagueRole.MANAGER];

/**
 * How far down an error's `cause` chain a database error is looked for; the driver wraps once, the ORM once more.
 * @public
 * @constant
 */
export const MAX_CAUSE_DEPTH: number = 4;

/* ─── Predicates ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The account half of every league-entry authorization: a live account that has finished /welcome.
 * @public
 * @constant
 */
export const ELIGIBLE_ACCOUNT: SQL = and(isNull(users.deletedAt), isNotNull(users.profileCompletedAt)) as SQL;

/**
 * Orders a roster commissioners first, then managers, then players, without depending on the enum's declared order.
 * @public
 * @constant
 */
export const ROLE_RANK: SQL = sql`CASE ${memberships.role} WHEN 'COMMISSIONER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END`;

/**
 * The predicate that a PENDING link is still usable: unexpired by the database clock and under its use limit.
 *
 * Replace and revoke carry it, so naming a link that has run out of time or uses is a stale request that changes
 * nothing, exactly like naming one that was already replaced. `now()` is the statement's start, so a link that expires
 * while the request waits on its lock still counts as usable; one that runs out of uses while waiting does not
 * @public
 * @constant
 */
export const USABLE_LINK: SQL = sql.raw(
  `("expires_at" IS NULL OR "expires_at" > now()) AND ("max_uses" IS NULL OR "use_count" < "max_uses")`,
);

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
 * Returned when a replace or revoke names the current link after it has passed its expiry or spent its uses. Re-reading
 * cannot help, so the answer sends the caller to a new link instead.
 * @public
 * @constant
 */
export const INVITE_NOT_LIVE_MESSAGE: string = 'This link is no longer live. Create a new link to invite players.';

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
 * Answered when the settings save cannot reach the database, which the page reads as an uncertain outcome and
 * reconciles by re-reading rather than by saving again.
 * @public
 * @constant
 */
export const SAVE_SETTINGS_UPSTREAM_MESSAGE: string = 'Pongifi could not save these settings.';

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
/**
 * Answered when a league's stored configuration is outside the limits the editor enforces, so no section of it can be
 * saved until the offending value is corrected.
 *
 * Only reachable for a league configured before those limits existed; a save from the page cannot produce it
 * @public
 * @constant
 */
export const SETTINGS_UNUSABLE_MESSAGE: string =
  'This league has a stored setting outside the allowed range, so it cannot be saved yet.';

export const REFUSAL_STATUS: Readonly<Record<LeagueRefusal, number>> = {
  /* The session is stale; the browser signs in again */
  [LeagueRefusal.ACCOUNT_MISSING]: 401,

  /* The settings page loaded before someone else's save; the page re-reads and compares */
  [LeagueRefusal.CONFIGURATION_CHANGED]: 409,

  /* A replayed identifier with a different payload */
  [LeagueRefusal.CONFLICT]: 409,

  /* A member without the role */
  [LeagueRefusal.FORBIDDEN]: 403,

  /* Answered as a body rather than thrown, so the response keeps its private cache policy */
  [LeagueRefusal.INVITE_UNAVAILABLE]: 404,

  /* Answered as a body rather than thrown, for the same reason */
  [LeagueRefusal.LEAGUE_NOT_FOUND]: 404,

  /* The link the panel showed is gone as a thing that can be changed; the panel re-reads on this too */
  [LeagueRefusal.LINK_NOT_LIVE]: 410,

  /* The page routes the account through /welcome on this */
  [LeagueRefusal.NEEDS_WELCOME]: 403,

  /* A manager reaching a commissioner's section, or a player reaching any of them */
  [LeagueRefusal.SECTION_FORBIDDEN]: 403,

  /* A well-formed save the stored configuration cannot accept */
  [LeagueRefusal.SETTINGS_UNUSABLE]: 422,

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

  /* The configuration moved while the page was open */
  [LeagueRefusal.CONFIGURATION_CHANGED]: SETTINGS_STALE_MESSAGE,

  /* The identifier was already spent */
  [LeagueRefusal.CONFLICT]: CREATE_CONFLICT_MESSAGE,

  /* The role is missing */
  [LeagueRefusal.FORBIDDEN]: INVITE_MANAGEMENT_FORBIDDEN_MESSAGE,

  /* The invite cannot be used */
  [LeagueRefusal.INVITE_UNAVAILABLE]: INVITE_UNAVAILABLE_MESSAGE,

  /* The league cannot be shown */
  [LeagueRefusal.LEAGUE_NOT_FOUND]: LEAGUE_NOT_FOUND_MESSAGE,

  /* The link ran out of time or uses */
  [LeagueRefusal.LINK_NOT_LIVE]: INVITE_NOT_LIVE_MESSAGE,

  /* Welcome is outstanding */
  [LeagueRefusal.NEEDS_WELCOME]: WELCOME_REQUIRED_MESSAGE,

  /* The section needs a role the caller does not have */
  [LeagueRefusal.SECTION_FORBIDDEN]: SETTINGS_SECTION_FORBIDDEN_MESSAGE,

  /* A stored value the editor's limits refuse */
  [LeagueRefusal.SETTINGS_UNUSABLE]: SETTINGS_UNUSABLE_MESSAGE,

  /* The link moved on */
  [LeagueRefusal.STALE]: INVITE_STALE_MESSAGE,
};
