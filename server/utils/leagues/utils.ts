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
 * ██████████████████████████████████████████ #server/utils/leagues/utils.ts ███████████████████████████████████████████
 *
 * League-entry operations: creation with replay deduplication, invite-link management, lookup and acceptance.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { createHash, randomBytes } from 'node:crypto';

import { createError, type H3Event, setResponseStatus } from 'h3';

import type { LeagueRole } from '#shared/domain';
import { InvitationStatus } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import { STANDARD_LEAGUE_SETTINGS } from '#shared/league-settings';
import type {
  IAcceptInviteResponse,
  ICreateLeagueRequest,
  ICreateLeagueResponse,
  IInviteLink,
  IInviteLinkOptions,
  IInvitePanel,
  IIssueInviteRequest,
  ILeagueDetail,
  ILeagueMember,
  INotFoundResponse,
  TInviteLookup,
} from '#shared/leagues';
import { InviteLinkState, InviteLookupKind, isInviteToken, isUuid } from '#shared/leagues';
import { defineSymbol } from '#shared/utils/symbol';

import {
  CREATION_REQUEST_CONSTRAINT,
  INVITE_MANAGER_ROLES,
  INVITE_TOKEN_BYTES,
  REFUSAL_MESSAGE,
  REFUSAL_STATUS,
  SHARED_INVITE_CONSTRAINT,
  UNIQUE_VIOLATION_CODE,
} from './constants';
import { AccountStanding, LeagueRefusal } from './enums';
import {
  acceptInvitation,
  insertInviteLink,
  insertLeague,
  readAccountStanding,
  readCreationRequest,
  readInviteLink,
  readInviteLinkStatus,
  readInviteSummary,
  readLeagueForMember,
  readLeagueMembers,
  readMemberLeagueByToken,
  readViewerRole,
  replaceInviteLink,
  revokeInviteLink,
} from './queries';
import type {
  ICreationRequestRow,
  IInviteLinkRow,
  IInviteSummaryRow,
  ILeagueOperationFailure,
  ILeagueRow,
  TLeagueOperationResult,
} from './types';

/**
 * How far down an error's `cause` chain a database error is looked for; the driver wraps once, the ORM once more.
 * @internal
 * @constant
 */
const MAX_CAUSE_DEPTH: number = 4;

/* ─── Helpers ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Wraps a value as a success.
 * @internal
 * @function
 * @param value - What the caller gets back
 * @returns The success result
 */
function succeed<TValue>(value: TValue): TLeagueOperationResult<TValue> {
  return { ok: true, value };
}

/**
 * Wraps a refusal as a failure.
 * @internal
 * @function
 * @param refusal - Why nothing was written
 * @returns The failure result
 */
function refuse(refusal: LeagueRefusal): ILeagueOperationFailure {
  return { ok: false, refusal };
}

/**
 * Finds the Postgres error inside whatever the driver and ORM wrapped it in.
 * @internal
 * @function
 * @param error - The thrown value
 * @param depth - How many causes have been followed so far
 * @returns The SQLSTATE and constraint, or null when no database error is present
 */
function findDatabaseError(error: unknown, depth: number = 0): { code: string; constraint?: string } | null {
  if (typeof error !== 'object' || error === null || depth > MAX_CAUSE_DEPTH) {
    return null;
  }

  const { cause, code, constraint }: { cause?: unknown; code?: unknown; constraint?: unknown } = error;

  if (typeof code === 'string') {
    return { code, constraint: typeof constraint === 'string' ? constraint : undefined };
  }

  return findDatabaseError(cause, depth + 1);
}

/**
 * Replaces a failed query with an error that carries no query text or parameters.
 *
 * The ORM's query error embeds every bound parameter in its message, and invite statements bind tokens. Only the
 * SQLSTATE survives, so a 502's cause can never become a way for a token to reach a log
 * @internal
 * @function
 * @param error - The thrown value
 * @returns An error safe to attach as a cause
 */
function redactQueryError(error: unknown): Error {
  const code: string = findDatabaseError(error)?.code ?? 'unknown';

  return new Error(`An invitation query failed with SQLSTATE ${code}.`);
}

/**
 * Reads the refusal an account that cannot act in league entry earns.
 * @internal
 * @function
 * @param userId - The identifier taken from the verified session
 * @returns The refusal, or null when the account is live and has finished /welcome
 */
async function readAccountRefusal(userId: string): Promise<LeagueRefusal | null> {
  const standing: AccountStanding = await readAccountStanding(userId);

  if (standing === AccountStanding.MISSING) {
    return LeagueRefusal.ACCOUNT_MISSING;
  }

  return standing === AccountStanding.NEEDS_WELCOME ? LeagueRefusal.NEEDS_WELCOME : null;
}

/**
 * Decides whether the caller may see and manage a league's invite link right now.
 * @internal
 * @function
 * @param leagueId - The league, already checked to be a UUID
 * @param userId - The identifier taken from the verified session
 * @returns Null when authorized, otherwise the refusal
 */
async function authorizeInviteManager(leagueId: string, userId: string): Promise<LeagueRefusal | null> {
  const role: LeagueRole | null = await readViewerRole(leagueId, userId);

  if (!role) {
    return (await readAccountRefusal(userId)) ?? LeagueRefusal.LEAGUE_NOT_FOUND;
  }

  return INVITE_MANAGER_ROLES.includes(role) ? null : LeagueRefusal.FORBIDDEN;
}

/**
 * Reads the invite panel's state after authorization.
 * @internal
 * @function
 * @param leagueId - The authorized league
 * @returns The panel
 */
async function readPanel(leagueId: string): Promise<IInvitePanel> {
  const row: IInviteLinkRow | null = await readInviteLink(leagueId);

  return { link: row ? toInviteLink(row) : null };
}

/**
 * Answers a create whose submission identifier already has a record: the original league for the same request, a
 * conflict for a different one. The account is checked before either answer.
 * @internal
 * @function
 * @param userId - The creator
 * @param record - The existing creation record
 * @param payloadDigest - The digest of the request being replayed
 * @returns The original result, or the refusal
 */
async function answerReplay(
  userId: string,
  record: ICreationRequestRow,
  payloadDigest: string,
): Promise<TLeagueOperationResult<ICreateLeagueResponse>> {
  const accountRefusal: LeagueRefusal | null = await readAccountRefusal(userId);

  if (accountRefusal) {
    return refuse(accountRefusal);
  }

  if (record.payloadDigest !== payloadDigest) {
    return refuse(LeagueRefusal.CONFLICT);
  }

  return succeed({ leagueId: record.leagueId });
}

/* ─── Pure Cores ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Generates an invite token: 32 cryptographically random bytes in unpadded base64url, the sole credential a link
 * carries.
 * @public
 * @function
 * @returns A 43-character token
 */
export function generateInviteToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url');
}

/**
 * Digests a normalized create request so a replayed submission identifier can be matched against what it created.
 *
 * The fields go in as an ordered tuple rather than an object, so the digest cannot depend on key order. The submission
 * identifier is left out: it is the key the digest is stored under, not part of what was asked for
 * @public
 * @function
 * @param request - The validated, normalized request
 * @returns A hex SHA-256 digest
 */
export function digestCreateLeagueRequest(request: ICreateLeagueRequest): string {
  const canonical: string = JSON.stringify([
    request.name,
    request.abbreviation,
    request.description,
    request.allowedGameTypes,
  ]);

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Whether an error is a unique violation of one named constraint, and nothing broader.
 * @public
 * @function
 * @param error - The thrown value, possibly wrapped by the ORM
 * @param constraint - The constraint the caller knows how to resolve
 * @returns Whether it is exactly that violation
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const found: { code: string; constraint?: string } | null = findDatabaseError(error);

  return found?.code === UNIQUE_VIOLATION_CODE && found.constraint === constraint;
}

/**
 * Derives the panel's view of a link from its row: usable, or why not.
 *
 * A PENDING link that is both out of uses and out of time reads as exhausted, because that is the line the panel
 * shows first. The token travels only while the link is usable
 * @public
 * @function
 * @param row - The link as read
 * @returns The link as the panel draws it
 */
export function toInviteLink(row: IInviteLinkRow): IInviteLink {
  const exhausted: boolean = row.maxUses !== null && row.useCount >= row.maxUses;
  let state: InviteLinkState = InviteLinkState.USABLE;

  if (row.status === InvitationStatus.EXPIRED) {
    state = InviteLinkState.EXPIRED;
  } else if (row.status !== InvitationStatus.PENDING) {
    state = InviteLinkState.REVOKED;
  } else if (exhausted) {
    state = InviteLinkState.EXHAUSTED;
  } else if (row.expired) {
    state = InviteLinkState.EXPIRED;
  }

  return {
    expiresAt: row.expiresAt?.toISOString() ?? null,
    expiresInDays: row.expiresInDays,
    id: row.id,
    maxUses: row.maxUses,
    state,
    token: state === InviteLinkState.USABLE ? row.token : null,
    useCount: row.useCount,
  };
}

/* ─── Operations ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Creates a league for the caller, or returns the league an earlier attempt of the same submission created.
 *
 * A known submission identifier is answered from its record before anything is written. Otherwise the league, its
 * commissioner membership and the record are written in one statement; if an identical submission won a race to the
 * same identifier, that statement rolls back whole and the winner's record answers instead
 * @public
 * @function
 * @param userId - The identifier taken from the verified session
 * @param request - The validated, normalized request
 * @throws Any database failure other than the submission race, for the handler's upstream guard
 * @throws When the statement wrote nothing for an eligible account, which would be a broken invariant
 * @returns The league, or the refusal
 */
export async function createLeague(
  userId: string,
  request: ICreateLeagueRequest,
): Promise<TLeagueOperationResult<ICreateLeagueResponse>> {
  const payloadDigest: string = digestCreateLeagueRequest(request);
  const existing: ICreationRequestRow | null = await readCreationRequest(userId, request.submissionId);

  if (existing) {
    return answerReplay(userId, existing, payloadDigest);
  }

  // Only the format selection is asked; every other setting takes the standard value
  const settings: TLeagueSettings = { ...STANDARD_LEAGUE_SETTINGS, allowedGameTypes: request.allowedGameTypes };
  let leagueId: string | null;

  try {
    leagueId = await insertLeague(userId, request, settings, payloadDigest);
  } catch (error: unknown) {
    const winner: ICreationRequestRow | null = isUniqueViolation(error, CREATION_REQUEST_CONSTRAINT)
      ? await readCreationRequest(userId, request.submissionId)
      : null;

    if (!winner) {
      throw error;
    }

    return answerReplay(userId, winner, payloadDigest);
  }

  if (leagueId) {
    return succeed({ leagueId });
  }

  // The statement's own account check refused; say which way. An eligible account always gets a league, so an empty
  // result for one is a broken invariant rather than an answer
  const accountRefusal: LeagueRefusal | null = await readAccountRefusal(userId);

  if (!accountRefusal) {
    throw new Error('League creation wrote nothing for an account eligible to create one.');
  }

  return refuse(accountRefusal);
}

/**
 * Reads a league for one of its active members, with its roster.
 * @public
 * @function
 * @param leagueId - The requested identifier, straight from the path
 * @param userId - The identifier taken from the verified session
 * @returns The league, or the refusal, which for anyone but a member is the same not-found whatever the reason
 */
export async function readLeagueDetail(
  leagueId: string,
  userId: string,
): Promise<TLeagueOperationResult<ILeagueDetail>> {
  // A malformed identifier cannot name a league, and must not reach a uuid column as a cast error
  if (!isUuid(leagueId)) {
    return refuse(LeagueRefusal.LEAGUE_NOT_FOUND);
  }

  const league: ILeagueRow | null = await readLeagueForMember(leagueId, userId);

  if (!league) {
    return refuse((await readAccountRefusal(userId)) ?? LeagueRefusal.LEAGUE_NOT_FOUND);
  }

  const members: ILeagueMember[] = await readLeagueMembers(leagueId);

  return succeed({ ...league, members });
}

/**
 * Reads a league's invite panel for a current commissioner or manager.
 * @public
 * @function
 * @param leagueId - The requested identifier, straight from the path
 * @param userId - The identifier taken from the verified session
 * @returns The panel, or the refusal
 */
export async function readInvitePanel(leagueId: string, userId: string): Promise<TLeagueOperationResult<IInvitePanel>> {
  if (!isUuid(leagueId)) {
    return refuse(LeagueRefusal.LEAGUE_NOT_FOUND);
  }

  const refusal: LeagueRefusal | null = await authorizeInviteManager(leagueId, userId);

  return refusal ? refuse(refusal) : succeed(await readPanel(leagueId));
}

/**
 * Creates a league's invite link, or returns the usable link that already exists without rotating it.
 *
 * When nothing was inserted the reason is found afterwards, against committed state: the caller lost their role, a
 * usable link already exists (a second manager, or a retry after a lost response), or the panel named a link that is
 * no longer the latest
 * @public
 * @function
 * @param leagueId - The requested identifier, straight from the path
 * @param userId - The identifier taken from the verified session
 * @param request - The validated options and the last link the panel saw
 * @throws A redacted error for any database failure other than the first-creation race
 * @returns The panel showing the current link, or the refusal
 */
export async function issueInvite(
  leagueId: string,
  userId: string,
  request: IIssueInviteRequest,
): Promise<TLeagueOperationResult<IInvitePanel>> {
  if (!isUuid(leagueId)) {
    return refuse(LeagueRefusal.LEAGUE_NOT_FOUND);
  }

  let created: string | null = null;

  try {
    created = await insertInviteLink(leagueId, userId, request, request.previousId, generateInviteToken());
  } catch (error: unknown) {
    // Two first creations raced and this one lost; the winner's link is read below like any existing link
    if (!isUniqueViolation(error, SHARED_INVITE_CONSTRAINT)) {
      throw redactQueryError(error);
    }
  }

  if (created) {
    return succeed(await readPanel(leagueId));
  }

  const refusal: LeagueRefusal | null = await authorizeInviteManager(leagueId, userId);

  if (refusal) {
    return refuse(refusal);
  }

  const panel: IInvitePanel = await readPanel(leagueId);

  return panel.link?.state === InviteLinkState.USABLE ? succeed(panel) : refuse(LeagueRefusal.STALE);
}

/**
 * Replaces a league's invite link with a new one, only when the link named is still the current one.
 * @public
 * @function
 * @param leagueId - The requested identifier, straight from the path
 * @param userId - The identifier taken from the verified session
 * @param invitationId - The link the caller believes is current, straight from the path
 * @param options - The validated expiry and use limit for the replacement
 * @throws A redacted error for any database failure
 * @returns The panel showing the replacement, or the refusal
 */
export async function replaceInvite(
  leagueId: string,
  userId: string,
  invitationId: string,
  options: IInviteLinkOptions,
): Promise<TLeagueOperationResult<IInvitePanel>> {
  if (!isUuid(leagueId)) {
    return refuse(LeagueRefusal.LEAGUE_NOT_FOUND);
  }

  let replaced: string | null = null;

  try {
    replaced = isUuid(invitationId)
      ? await replaceInviteLink(leagueId, userId, invitationId, options, generateInviteToken())
      : null;
  } catch (error: unknown) {
    // A creation that committed a link first is resolved like any other stale request
    if (!isUniqueViolation(error, SHARED_INVITE_CONSTRAINT)) {
      throw redactQueryError(error);
    }
  }

  if (replaced) {
    return succeed(await readPanel(leagueId));
  }

  const refusal: LeagueRefusal | null = await authorizeInviteManager(leagueId, userId);

  return refuse(refusal ?? LeagueRefusal.STALE);
}

/**
 * Revokes a league's invite link by id. Repeating the revoke of the exact link already revoked succeeds and touches
 * nothing, including any successor.
 * @public
 * @function
 * @param leagueId - The requested identifier, straight from the path
 * @param userId - The identifier taken from the verified session
 * @param invitationId - The link to revoke, straight from the path
 * @throws Any database failure, for the handler's upstream guard
 * @returns The panel after the revoke, or the refusal
 */
export async function revokeInvite(
  leagueId: string,
  userId: string,
  invitationId: string,
): Promise<TLeagueOperationResult<IInvitePanel>> {
  if (!isUuid(leagueId)) {
    return refuse(LeagueRefusal.LEAGUE_NOT_FOUND);
  }

  // Revocation binds no token, so its failures need no redaction
  const revoked: boolean = isUuid(invitationId) && (await revokeInviteLink(leagueId, userId, invitationId));

  if (revoked) {
    return succeed(await readPanel(leagueId));
  }

  const refusal: LeagueRefusal | null = await authorizeInviteManager(leagueId, userId);

  if (refusal) {
    return refuse(refusal);
  }

  // The repeat-revoke exception precedes the generic stale check, and is resolved within this league only
  const status: string | null = isUuid(invitationId) ? await readInviteLinkStatus(leagueId, invitationId) : null;

  return status === InvitationStatus.REVOKED ? succeed(await readPanel(leagueId)) : refuse(LeagueRefusal.STALE);
}

/**
 * Looks an invite token up for a visitor: an active member is sent to their league, anyone else gets the summary of a
 * usable invite, and every other case gets the same unavailable answer.
 * @public
 * @function
 * @param token - The token, straight from the path
 * @param userId - The signed-in visitor, or null when signed out
 * @throws A redacted error for any database failure
 * @returns The lookup, or the unavailable refusal
 */
export async function lookupInvite(
  token: string,
  userId: string | null,
): Promise<TLeagueOperationResult<TInviteLookup>> {
  if (!isInviteToken(token)) {
    return refuse(LeagueRefusal.INVITE_UNAVAILABLE);
  }

  try {
    const leagueId: string | null = userId ? await readMemberLeagueByToken(token, userId) : null;

    if (leagueId) {
      return succeed({ kind: InviteLookupKind.MEMBER, leagueId });
    }

    const summary: IInviteSummaryRow | null = await readInviteSummary(token, userId);

    return summary ? succeed({ ...summary, kind: InviteLookupKind.INVITE }) : refuse(LeagueRefusal.INVITE_UNAVAILABLE);
  } catch (error: unknown) {
    throw redactQueryError(error);
  }
}

/**
 * Accepts an invite for the caller: joins them, or confirms they are already in.
 *
 * The account is checked first, so an account still owing /welcome is told to finish rather than told the invite is
 * gone. When the acceptance makes no transition, the membership is re-read after the attempt, against committed
 * state: an active member is sent to their league, and everyone else, including a REMOVED member, sees the invite as
 * unavailable
 * @public
 * @function
 * @param token - The token, straight from the path
 * @param userId - The identifier taken from the verified session
 * @throws A redacted error for any database failure
 * @returns The league, or the refusal
 */
export async function acceptInvite(
  token: string,
  userId: string,
): Promise<TLeagueOperationResult<IAcceptInviteResponse>> {
  if (!isInviteToken(token)) {
    return refuse(LeagueRefusal.INVITE_UNAVAILABLE);
  }

  try {
    const accountRefusal: LeagueRefusal | null = await readAccountRefusal(userId);

    if (accountRefusal) {
      return refuse(accountRefusal);
    }

    const joined: string | null = await acceptInvitation(token, userId);
    const leagueId: string | null = joined ?? (await readMemberLeagueByToken(token, userId));

    return leagueId ? succeed({ leagueId }) : refuse(LeagueRefusal.INVITE_UNAVAILABLE);
  } catch (error: unknown) {
    throw redactQueryError(error);
  }
}

/* ─── HTTP ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Answers a refusal over HTTP.
 *
 * The two not-found refusals are returned as a body with a 404 status rather than thrown, because the framework's
 * error handler replaces the cache policy on a thrown 404, and these answers must keep the private, no-store policy
 * the handler set and stay identical whatever was actually missing. A missing account also clears the session
 * @public
 * @function
 * @param event - The request being answered
 * @param refusal - Why nothing was written
 * @throws The refusal's status and message, for every refusal but the two not-founds
 * @returns The not-found body
 */
export async function answerRefusal(event: H3Event, refusal: LeagueRefusal): Promise<INotFoundResponse> {
  const statusCode: number = REFUSAL_STATUS[refusal];
  const message: string = REFUSAL_MESSAGE[refusal];

  if (refusal === LeagueRefusal.ACCOUNT_MISSING) {
    await clearUserSession(event);
  }

  if (refusal === LeagueRefusal.LEAGUE_NOT_FOUND || refusal === LeagueRefusal.INVITE_UNAVAILABLE) {
    setResponseStatus(event, statusCode);

    return { message, statusCode };
  }

  throw createError({ statusCode, statusMessage: message });
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suites can title their describe blocks from the source symbols
defineSymbol(generateInviteToken, {
  name: 'Generate Invite Token',
  description: 'Generates a 43-character invite token from 32 random bytes.',
});

defineSymbol(digestCreateLeagueRequest, {
  name: 'Digest Create League Request',
  description: 'Digests a normalized create request for replay matching.',
});

defineSymbol(isUniqueViolation, {
  name: 'Is Unique Violation',
  description: 'Reports whether an error is a unique violation of one named constraint.',
});

defineSymbol(toInviteLink, {
  name: 'To Invite Link',
  description: "Derives the panel's view of a link from its row.",
});

defineSymbol(createLeague, {
  name: 'Create League',
  description: 'Creates a league, or returns the one an earlier attempt of the same submission created.',
});

defineSymbol(readLeagueDetail, {
  name: 'Read League Detail',
  description: 'Reads a league with its roster for one of its active members.',
});

defineSymbol(readInvitePanel, {
  name: 'Read Invite Panel',
  description: "Reads a league's invite panel for a current commissioner or manager.",
});

defineSymbol(issueInvite, {
  name: 'Issue Invite',
  description: "Creates a league's invite link, or returns the usable one that already exists.",
});

defineSymbol(replaceInvite, {
  name: 'Replace Invite',
  description: "Replaces a league's invite link only when the named link is still current.",
});

defineSymbol(revokeInvite, {
  name: 'Revoke Invite',
  description: "Revokes a league's invite link by id, repeat revokes included.",
});

defineSymbol(lookupInvite, {
  name: 'Lookup Invite',
  description: 'Looks an invite token up for a visitor.',
});

defineSymbol(acceptInvite, {
  name: 'Accept Invite',
  description: 'Accepts an invite for the caller, or confirms they are already in.',
});

defineSymbol(answerRefusal, {
  name: 'Answer Refusal',
  description: 'Answers a league-entry refusal over HTTP.',
});
