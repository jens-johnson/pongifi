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
 * █████████████████████████████████████████ #server/utils/leagues/queries.ts ██████████████████████████████████████████
 *
 * The single-statement SQL behind league creation, league reads, invite links and acceptance.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { SQL } from 'drizzle-orm';
import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import type { LeagueRole } from '#shared/domain';
import { MembershipStatus } from '#shared/domain';
import type { TLeagueSettings } from '#shared/league-settings';
import type { ICreateLeagueRequest, IInviteLinkOptions, ILeagueMember } from '#shared/leagues';
import { DEFAULT_INVITE_EXPIRY_DAYS } from '#shared/leagues';
import { defineSymbol } from '#shared/utils/symbol';
import { useDatabase } from '#utils/db';

import { invitations, leagueCreationRequests, leagues, memberships } from '../../db/schema';
import { users } from '../../db/schema/users';
import { AccountStanding } from './enums';
import type { ICreationRequestRow, IInviteLinkRow, IInviteSummaryRow, ILeagueRow } from './types';

/**
 * The account half of every league-entry authorization: a live account that has finished /welcome.
 * @internal
 * @constant
 */
const ELIGIBLE_ACCOUNT: SQL = and(isNull(users.deletedAt), isNotNull(users.profileCompletedAt)) as SQL;

/**
 * Orders a roster commissioners first, then managers, then players, without depending on the enum's declared order.
 * @internal
 * @constant
 */
const ROLE_RANK: SQL = sql`CASE ${memberships.role} WHEN 'COMMISSIONER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END`;

/**
 * The predicate that a PENDING link is still usable: unexpired by the database clock and under its use limit.
 *
 * Replace and revoke carry it, so naming a link that has run out of time or uses is a stale request that changes
 * nothing, exactly like naming one that was already replaced
 * @internal
 * @constant
 */
const USABLE_LINK: SQL = sql.raw(
  `("expires_at" IS NULL OR "expires_at" > now()) AND ("max_uses" IS NULL OR "use_count" < "max_uses")`,
);

/**
 * The subquery that holds when the caller is, right now, an ACTIVE commissioner or manager of the league with an
 * eligible account.
 *
 * Every invite mutation carries it inside its own statement, so a role or account that changed after the page loaded
 * cannot authorize the write; the session's view of the caller is never consulted
 * @internal
 * @function
 * @param leagueId - The league being acted on
 * @param userId - The identifier taken from the verified session
 * @returns The subquery, for use inside `EXISTS`
 */
function selectInviteManager(leagueId: string, userId: string): SQL {
  return sql`
    SELECT 1 FROM "memberships" m
      JOIN "users" u ON u."id" = m."user_id" AND u."deleted_at" IS NULL AND u."profile_completed_at" IS NOT NULL
     WHERE m."league_id" = ${leagueId}::uuid AND m."user_id" = ${userId}::uuid
       AND m."status" = 'ACTIVE' AND m."role" IN ('COMMISSIONER', 'MANAGER')`;
}

/**
 * The expiry a new link is issued with, measured from the database clock so every usability check agrees with it.
 * @internal
 * @function
 * @param expiresInDays - The chosen duration
 * @returns The SQL expression for the expiry timestamp
 */
function expiryFromNow(expiresInDays: number): SQL {
  return sql`now() + make_interval(days => ${expiresInDays}::int)`;
}

/**
 * Reads whether the account a session names can act in league entry.
 * @public
 * @function
 * @param userId - The identifier taken from the verified session
 * @returns The account's standing
 */
export async function readAccountStanding(userId: string): Promise<AccountStanding> {
  const rows: { profileCompletedAt: Date | null }[] = await useDatabase()
    .select({ profileCompletedAt: users.profileCompletedAt })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!rows[0]) {
    return AccountStanding.MISSING;
  }

  return rows[0].profileCompletedAt ? AccountStanding.ACTIVE : AccountStanding.NEEDS_WELCOME;
}

/**
 * Reads the league a creator's submission identifier already produced.
 * @public
 * @function
 * @param userId - The creator, taken from the verified session
 * @param submissionId - The identifier the create form generated
 * @returns The creation record, or null when the identifier has not been used
 */
export async function readCreationRequest(userId: string, submissionId: string): Promise<ICreationRequestRow | null> {
  const rows: ICreationRequestRow[] = await useDatabase()
    .select({ leagueId: leagueCreationRequests.leagueId, payloadDigest: leagueCreationRequests.payloadDigest })
    .from(leagueCreationRequests)
    .where(and(eq(leagueCreationRequests.createdBy, userId), eq(leagueCreationRequests.submissionId, submissionId)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Creates a league, its creator's ACTIVE COMMISSIONER membership and the submission record in one statement.
 *
 * One statement is one transaction on the HTTP driver, so the three rows exist together or not at all. The creator's
 * account is rechecked inside it. A second submission racing this one with the same identifier fails on the
 * submission index and takes its league with it; that error is thrown for the caller to resolve
 * @public
 * @function
 * @param userId - The creator, taken from the verified session
 * @param request - The validated, normalized request
 * @param settings - The complete settings the league starts with
 * @param payloadDigest - The digest of the normalized request
 * @throws The driver's unique violation when an identical submission committed first
 * @returns The new league's identifier, or null when the account could not create one
 */
export async function insertLeague(
  userId: string,
  request: ICreateLeagueRequest,
  settings: TLeagueSettings,
  payloadDigest: string,
): Promise<string | null> {
  const { rows }: { rows: { leagueId: string }[] } = await useDatabase().execute<{ leagueId: string }>(sql`
    WITH creator AS (
      SELECT "id" FROM "users"
       WHERE "id" = ${userId}::uuid AND "deleted_at" IS NULL AND "profile_completed_at" IS NOT NULL
    ),
    league AS (
      INSERT INTO "leagues" ("name", "abbreviation", "description", "visibility", "settings", "created_by")
      SELECT ${request.name}::text, ${request.abbreviation}::varchar, ${request.description}::text,
             'PRIVATE'::league_visibility, ${JSON.stringify(settings)}::jsonb, "id"
        FROM creator
      RETURNING "id"
    ),
    commissioner AS (
      INSERT INTO "memberships" ("league_id", "user_id", "role", "status")
      SELECT "id", ${userId}::uuid, 'COMMISSIONER'::league_role, 'ACTIVE'::membership_status FROM league
      RETURNING "league_id"
    ),
    submission AS (
      INSERT INTO "league_creation_requests" ("created_by", "submission_id", "payload_digest", "league_id")
      SELECT ${userId}::uuid, ${request.submissionId}::uuid, ${payloadDigest}::text, "league_id" FROM commissioner
      RETURNING "league_id"
    )
    SELECT "league_id" AS "leagueId" FROM submission`);

  return rows[0]?.leagueId ?? null;
}

/**
 * Reads a league through the caller's own ACTIVE membership and eligible account, in one query path.
 *
 * An unknown league and a league the caller is not an active member of both come back null, from the same query, so
 * nothing downstream can tell them apart
 * @public
 * @function
 * @param leagueId - The requested league, already checked to be a UUID
 * @param userId - The identifier taken from the verified session
 * @returns The league with the caller's role, or null
 */
export async function readLeagueForMember(leagueId: string, userId: string): Promise<ILeagueRow | null> {
  const rows = await useDatabase()
    .select({
      abbreviation: leagues.abbreviation,
      description: leagues.description,
      id: leagues.id,
      name: leagues.name,
      settings: leagues.settings,
      viewerRole: memberships.role,
    })
    .from(leagues)
    .innerJoin(
      memberships,
      and(
        eq(memberships.leagueId, leagues.id),
        eq(memberships.userId, userId),
        eq(memberships.status, MembershipStatus.ACTIVE),
      ),
    )
    .innerJoin(users, and(eq(users.id, memberships.userId), ELIGIBLE_ACCOUNT))
    .where(eq(leagues.id, leagueId))
    .limit(1);

  const row: (typeof rows)[number] | undefined = rows[0];

  /* The column and the enum carry identical members; the cast reconciles drizzle's union with the domain type */
  return row ? { ...row, viewerRole: row.viewerRole as LeagueRole } : null;
}

/**
 * Reads a league's active members with live accounts, commissioners first, then managers, then players.
 *
 * Only called after {@link readLeagueForMember} has authorized the reader. Selects no email address and no user
 * identifier: the membership's own id keys each row
 * @public
 * @function
 * @param leagueId - The authorized league
 * @returns The roster in display order
 */
export async function readLeagueMembers(leagueId: string): Promise<ILeagueMember[]> {
  const rows = await useDatabase()
    .select({
      avatarUrl: users.avatarUrl,
      displayName: users.displayName,
      id: memberships.id,
      joinedAt: memberships.joinedAt,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, and(eq(users.id, memberships.userId), isNull(users.deletedAt)))
    .where(and(eq(memberships.leagueId, leagueId), eq(memberships.status, MembershipStatus.ACTIVE)))
    .orderBy(ROLE_RANK, asc(memberships.joinedAt), asc(memberships.id));

  return rows.map((row: (typeof rows)[number]): ILeagueMember => ({
    avatarUrl: row.avatarUrl,
    displayName: row.displayName,
    id: row.id,
    joinedAt: row.joinedAt.toISOString(),
    role: row.role as LeagueRole,
  }));
}

/**
 * Reads the caller's current role in a league, through an ACTIVE membership and an eligible account.
 * @public
 * @function
 * @param leagueId - The league, already checked to be a UUID
 * @param userId - The identifier taken from the verified session
 * @returns The role, or null when the caller is not an active member
 */
export async function readViewerRole(leagueId: string, userId: string): Promise<LeagueRole | null> {
  const rows: { role: string }[] = await useDatabase()
    .select({ role: memberships.role })
    .from(memberships)
    .innerJoin(users, and(eq(users.id, memberships.userId), ELIGIBLE_ACCOUNT))
    .where(
      and(
        eq(memberships.leagueId, leagueId),
        eq(memberships.userId, userId),
        eq(memberships.status, MembershipStatus.ACTIVE),
      ),
    )
    .limit(1);

  return (rows[0]?.role as LeagueRole | undefined) ?? null;
}

/**
 * Reads a league's current shareable link, or its most recent one when none is PENDING.
 *
 * At most one shareable link is PENDING (the partial unique index), and it is always the newest, because a successor
 * is only inserted after its predecessor is retired. Expiry is decided here against the database clock, the same
 * clock acceptance checks it with
 * @public
 * @function
 * @param leagueId - The authorized league
 * @returns The link, or null when the league has never had one
 */
export async function readInviteLink(leagueId: string): Promise<IInviteLinkRow | null> {
  const rows = await useDatabase()
    .select({
      expired: sql<boolean>`(${invitations.expiresAt} IS NOT NULL AND ${invitations.expiresAt} <= now())`,
      expiresAt: invitations.expiresAt,
      expiresInDays: sql<number>`COALESCE(
        round(extract(epoch FROM ${invitations.expiresAt} - ${invitations.createdAt}) / 86400)::int,
        ${DEFAULT_INVITE_EXPIRY_DAYS}::int
      )`,
      id: invitations.id,
      maxUses: invitations.maxUses,
      status: invitations.status,
      token: invitations.token,
      useCount: invitations.useCount,
    })
    .from(invitations)
    .where(and(eq(invitations.leagueId, leagueId), isNull(invitations.email)))
    .orderBy(sql`(${invitations.status} = 'PENDING') DESC`, desc(invitations.createdAt), desc(invitations.id))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Creates a league's shareable link, retiring the named predecessor first when it has expired or run out of uses.
 *
 * One statement. The league's PENDING link, if any, is locked first, so every writer for one league takes the same
 * lock in the same order. A new link is inserted only when no link is PENDING, or when the PENDING link is the one the
 * caller named and it is no longer usable; a usable link is never rotated by a create. When two first creations race
 * there is no row to lock and the loser meets the partial unique index; that error is thrown for the caller to resolve
 * @public
 * @function
 * @param leagueId - The league, already checked to be a UUID
 * @param userId - The caller, taken from the verified session and reauthorized inside the statement
 * @param options - The chosen expiry and use limit
 * @param previousId - The last link the panel saw, or null
 * @param token - A freshly generated token
 * @throws The driver's unique violation when a concurrent creation committed first
 * @returns The new link's identifier, or null when nothing was inserted
 */
export async function insertInviteLink(
  leagueId: string,
  userId: string,
  options: IInviteLinkOptions,
  previousId: string | null,
  token: string,
): Promise<string | null> {
  const { rows }: { rows: { id: string }[] } = await useDatabase().execute<{ id: string }>(sql`
    WITH actor AS (${selectInviteManager(leagueId, userId)}),
    current AS (
      SELECT "id", "expires_at", "max_uses", "use_count" FROM "invitations"
       WHERE "league_id" = ${leagueId}::uuid AND "email" IS NULL AND "status" = 'PENDING'
         AND EXISTS (SELECT 1 FROM actor)
         FOR UPDATE
    ),
    retired AS (
      UPDATE "invitations" i
         SET "status" = (CASE WHEN i."expires_at" IS NOT NULL AND i."expires_at" <= now()
                              THEN 'EXPIRED' ELSE 'REVOKED' END)::invitation_status
       WHERE i."id" = (
         SELECT "id" FROM current
          WHERE "id" = ${previousId}::uuid
            AND (("expires_at" IS NOT NULL AND "expires_at" <= now())
                 OR ("max_uses" IS NOT NULL AND "use_count" >= "max_uses"))
       )
      RETURNING i."id"
    )
    INSERT INTO "invitations" ("league_id", "email", "token", "invited_by", "expires_at", "max_uses")
    SELECT ${leagueId}::uuid, NULL, ${token}::text, ${userId}::uuid, ${expiryFromNow(options.expiresInDays)},
           ${options.maxUses}::int
     WHERE EXISTS (SELECT 1 FROM actor)
       AND (NOT EXISTS (SELECT 1 FROM current) OR EXISTS (SELECT 1 FROM retired))
    RETURNING "id"`);

  return rows[0]?.id ?? null;
}

/**
 * Replaces a league's usable shareable link with a new one, only when it is still the link the caller named.
 *
 * The named link is locked, retired and succeeded in one statement. A stale request, one naming a link somebody else
 * already replaced or revoked, or one that has since expired or run out of uses, finds nothing to retire and inserts
 * nothing, so it can never revoke the newer link
 * @public
 * @function
 * @param leagueId - The league, already checked to be a UUID
 * @param userId - The caller, reauthorized inside the statement
 * @param expectedId - The link the caller believes is current
 * @param options - The expiry and use limit for the replacement
 * @param token - A freshly generated token
 * @returns The replacement's identifier, or null when nothing changed
 */
export async function replaceInviteLink(
  leagueId: string,
  userId: string,
  expectedId: string,
  options: IInviteLinkOptions,
  token: string,
): Promise<string | null> {
  const { rows }: { rows: { id: string }[] } = await useDatabase().execute<{ id: string }>(sql`
    WITH actor AS (${selectInviteManager(leagueId, userId)}),
    expected AS (
      SELECT "id" FROM "invitations"
       WHERE "league_id" = ${leagueId}::uuid AND "email" IS NULL AND "status" = 'PENDING'
         AND "id" = ${expectedId}::uuid AND ${USABLE_LINK} AND EXISTS (SELECT 1 FROM actor)
         FOR UPDATE
    ),
    retired AS (
      UPDATE "invitations" i
         SET "status" = (CASE WHEN i."expires_at" IS NOT NULL AND i."expires_at" <= now()
                              THEN 'EXPIRED' ELSE 'REVOKED' END)::invitation_status
       WHERE i."id" = (SELECT "id" FROM expected)
      RETURNING i."id"
    )
    INSERT INTO "invitations" ("league_id", "email", "token", "invited_by", "expires_at", "max_uses")
    SELECT ${leagueId}::uuid, NULL, ${token}::text, ${userId}::uuid, ${expiryFromNow(options.expiresInDays)},
           ${options.maxUses}::int
     WHERE EXISTS (SELECT 1 FROM retired)
    RETURNING "id"`);

  return rows[0]?.id ?? null;
}

/**
 * Revokes a league's usable shareable link by id. Memberships made through it are untouched, and a link that has
 * already expired or run out of uses is left as it is.
 * @public
 * @function
 * @param leagueId - The league, already checked to be a UUID
 * @param userId - The caller, reauthorized inside the statement
 * @param invitationId - The link to revoke
 * @returns Whether this call revoked it
 */
export async function revokeInviteLink(leagueId: string, userId: string, invitationId: string): Promise<boolean> {
  const { rows }: { rows: { id: string }[] } = await useDatabase().execute<{ id: string }>(sql`
    UPDATE "invitations" SET "status" = 'REVOKED'
     WHERE "id" = ${invitationId}::uuid AND "league_id" = ${leagueId}::uuid
       AND "email" IS NULL AND "status" = 'PENDING' AND ${USABLE_LINK}
       AND EXISTS (${selectInviteManager(leagueId, userId)})
    RETURNING "id"`);

  return rows.length > 0;
}

/**
 * Reads the stored status of one of a league's shareable links, resolved within that league only.
 * @public
 * @function
 * @param leagueId - The authorized league
 * @param invitationId - The link
 * @returns The status, or null when the league has no such shareable link
 */
export async function readInviteLinkStatus(leagueId: string, invitationId: string): Promise<string | null> {
  const rows: { status: string }[] = await useDatabase()
    .select({ status: invitations.status })
    .from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.leagueId, leagueId), isNull(invitations.email)))
    .limit(1);

  return rows[0]?.status ?? null;
}

/**
 * Accepts a shareable invitation: the membership transition and exactly one use, together, or nothing.
 *
 * The invitation row is locked first. A request that waited on that lock sees the committed use count and status when
 * it resumes, so two players racing for one remaining use produce one membership and one refusal, and a revoke that
 * commits first leaves the waiter nothing to claim. A new row joins as ACTIVE PLAYER; an INVITED or INACTIVE row is
 * reactivated as PLAYER, so an old elevated role is never restored by a link. An ACTIVE or REMOVED row is not touched,
 * and a use is spent only against a real transition. The account is rechecked inside the statement
 * @public
 * @function
 * @param token - The invite token, already checked for shape
 * @param userId - The identifier taken from the verified session
 * @returns The league joined, or null when this request made no transition
 */
export async function acceptInvitation(token: string, userId: string): Promise<string | null> {
  const { rows }: { rows: { leagueId: string | null }[] } = await useDatabase().execute<{ leagueId: string | null }>(
    sql`
    WITH claimable AS (
      SELECT "id", "league_id", "max_uses", "use_count" FROM "invitations"
       WHERE "token" = ${token}::text AND "status" = 'PENDING' AND "email" IS NULL
         AND ("expires_at" IS NULL OR "expires_at" > now())
         FOR UPDATE
    ),
    joined AS (
      INSERT INTO "memberships" ("league_id", "user_id", "role", "status")
      SELECT "league_id", ${userId}::uuid, 'PLAYER'::league_role, 'ACTIVE'::membership_status FROM claimable
       WHERE ("max_uses" IS NULL OR "use_count" < "max_uses")
         AND EXISTS (
           SELECT 1 FROM "users"
            WHERE "id" = ${userId}::uuid AND "deleted_at" IS NULL AND "profile_completed_at" IS NOT NULL
         )
      ON CONFLICT ("league_id", "user_id") DO UPDATE
         SET "status" = 'ACTIVE', "role" = 'PLAYER', "left_at" = NULL
       WHERE "memberships"."status" IN ('INVITED', 'INACTIVE')
      RETURNING "league_id"
    ),
    consumed AS (
      UPDATE "invitations" SET "use_count" = "use_count" + 1
       WHERE "id" = (SELECT "id" FROM claimable) AND EXISTS (SELECT 1 FROM joined)
      RETURNING "id"
    )
    SELECT (SELECT "league_id" FROM joined) AS "leagueId", (SELECT "id" FROM consumed) AS "consumedId"`,
  );

  return rows[0]?.leagueId ?? null;
}

/**
 * Reads the league a token leads an ACTIVE member with an eligible account to, whatever state the link is in.
 *
 * The membership authorizes the destination, not the invite, so an expired, revoked or exhausted link still takes a
 * member home. Anyone else gets null: a nonmember, a REMOVED member, a soft-deleted account
 * @public
 * @function
 * @param token - The invite token, already checked for shape
 * @param userId - The identifier taken from the verified session
 * @returns The league, or null
 */
export async function readMemberLeagueByToken(token: string, userId: string): Promise<string | null> {
  const rows: { leagueId: string }[] = await useDatabase()
    .select({ leagueId: memberships.leagueId })
    .from(invitations)
    .innerJoin(
      memberships,
      and(
        eq(memberships.leagueId, invitations.leagueId),
        eq(memberships.userId, userId),
        eq(memberships.status, MembershipStatus.ACTIVE),
      ),
    )
    .innerJoin(users, and(eq(users.id, memberships.userId), ELIGIBLE_ACCOUNT))
    .where(eq(invitations.token, token))
    .limit(1);

  return rows[0]?.leagueId ?? null;
}

/**
 * Reads the reviewed summary of a usable shareable invitation: league name, inviter name, active-member count.
 *
 * Usable means PENDING, unexpired by the database clock, and under its use limit. A signed-in visitor whose membership
 * in the league is REMOVED is refused here too, since the link could not admit them
 * @public
 * @function
 * @param token - The invite token, already checked for shape
 * @param userId - The signed-in visitor, or null when signed out
 * @returns The summary, or null when the invite is not usable by this visitor
 */
export async function readInviteSummary(token: string, userId: string | null): Promise<IInviteSummaryRow | null> {
  // The driver's row constraint needs an index signature, which an interface does not carry; the literal mirrors it
  const { rows }: { rows: IInviteSummaryRow[] } = await useDatabase().execute<{
    inviterName: string;
    leagueName: string;
    memberCount: number;
  }>(sql`
    SELECT l."name" AS "leagueName", inviter."display_name" AS "inviterName",
           (SELECT count(*)::int FROM "memberships" m
              JOIN "users" mu ON mu."id" = m."user_id" AND mu."deleted_at" IS NULL
             WHERE m."league_id" = i."league_id" AND m."status" = 'ACTIVE') AS "memberCount"
      FROM "invitations" i
      JOIN "leagues" l ON l."id" = i."league_id"
      JOIN "users" inviter ON inviter."id" = i."invited_by"
     WHERE i."token" = ${token}::text AND i."status" = 'PENDING' AND i."email" IS NULL
       AND (i."expires_at" IS NULL OR i."expires_at" > now())
       AND (i."max_uses" IS NULL OR i."use_count" < i."max_uses")
       AND NOT EXISTS (
         SELECT 1 FROM "memberships" r
          WHERE r."league_id" = i."league_id" AND r."user_id" = ${userId}::uuid AND r."status" = 'REMOVED'
       )`);

  return rows[0] ?? null;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suites can title their describe blocks from the source symbols
defineSymbol(readAccountStanding, {
  name: 'Read Account Standing',
  description: 'Reads whether the account a session names can act in league entry.',
});

defineSymbol(readCreationRequest, {
  name: 'Read Creation Request',
  description: "Reads the league a creator's submission identifier already produced.",
});

defineSymbol(insertLeague, {
  name: 'Insert League',
  description: 'Creates a league, its commissioner membership and the submission record in one statement.',
});

defineSymbol(readLeagueForMember, {
  name: 'Read League For Member',
  description: "Reads a league through the caller's own active membership.",
});

defineSymbol(readLeagueMembers, {
  name: 'Read League Members',
  description: "Reads a league's active members in display order.",
});

defineSymbol(readViewerRole, {
  name: 'Read Viewer Role',
  description: "Reads the caller's current role in a league.",
});

defineSymbol(readInviteLink, {
  name: 'Read Invite Link',
  description: "Reads a league's current or most recent shareable link.",
});

defineSymbol(insertInviteLink, {
  name: 'Insert Invite Link',
  description: "Creates a league's shareable link, retiring a dead predecessor the caller named.",
});

defineSymbol(replaceInviteLink, {
  name: 'Replace Invite Link',
  description: "Replaces a league's shareable link only when it is still the one the caller named.",
});

defineSymbol(revokeInviteLink, {
  name: 'Revoke Invite Link',
  description: "Revokes a league's pending shareable link by id.",
});

defineSymbol(readInviteLinkStatus, {
  name: 'Read Invite Link Status',
  description: "Reads the stored status of one of a league's shareable links.",
});

defineSymbol(acceptInvitation, {
  name: 'Accept Invitation',
  description: 'Accepts a shareable invitation: one membership transition and one use, together, or nothing.',
});

defineSymbol(readMemberLeagueByToken, {
  name: 'Read Member League By Token',
  description: 'Reads the league a token leads an active member to, whatever state the link is in.',
});

defineSymbol(readInviteSummary, {
  name: 'Read Invite Summary',
  description: 'Reads the reviewed summary of a usable shareable invitation.',
});
