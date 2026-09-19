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
 * █████████████████████████████████████████ #server/utils/profile/queries.ts ██████████████████████████████████████████
 *
 * Database reads and writes for the signed-in player's own account.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import type { SQL } from 'drizzle-orm';
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { LeagueRole } from '#shared/domain';
import { ConfirmationStatus, GameStatus, MembershipStatus } from '#shared/domain';
import { LEAGUE_GAME_TYPE_ORDER } from '#shared/leagues';
import type { ILeagueMembership, ILeagueMembershipPage, ILeagueMembershipQuery, IProfile } from '#shared/profile';
import { LeagueMembershipSort } from '#shared/profile';
import { PLAYED_STATUSES } from '#shared/rating-engine';
import type { GameType } from '#shared/rules-engine';
import { defineSymbol } from '#shared/utils/symbol';
import { useDatabase } from '#utils/db';

import { games, leagues, memberships } from '../../db/schema';
import { users } from '../../db/schema/users';
import type { ILeagueMembershipDatabaseRow, IProfileRow } from './types';

/**
 * The columns `/api/me` is allowed to return.
 *
 * Written out rather than selecting the row so a column added to `users` later is invisible to the browser until
 * somebody adds it here deliberately.
 * @internal
 * @constant
 */
const PROFILE_COLUMNS = {
  avatarUrl: users.avatarUrl,
  createdAt: users.createdAt,
  displayName: users.displayName,
  email: users.email,
  id: users.id,
  profileCompletedAt: users.profileCompletedAt,
} as const;

/**
 * Game statuses that count as accepted results in league rows.
 * @internal
 * @constant
 */
const ACCEPTED_GAME_STATUSES: readonly GameStatus[] = [...PLAYED_STATUSES, GameStatus.WALKOVER];

/**
 * Escapes SQL wildcard characters so membership search always treats the entered text literally.
 * @internal
 * @function
 * @param value - The normalized search text
 * @returns The escaped text wrapped for a contains match
 */
function toLiteralSearchPattern(value: string): string {
  return `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

/**
 * Builds the allowlisted filtering predicate for the player's active memberships.
 * @internal
 * @function
 * @param userId - The identifier taken from the verified session
 * @param query - The normalized membership query
 * @returns The parameterized membership predicate
 */
function buildMembershipPredicate(userId: string, query: ILeagueMembershipQuery): SQL {
  const predicates: SQL[] = [
    sql`viewer_membership."user_id" = ${userId}`,
    sql`viewer_membership."status" = ${MembershipStatus.ACTIVE}`,
  ];

  if (query.search) {
    const pattern: string = toLiteralSearchPattern(query.search);

    predicates.push(
      sql`(league."name" ILIKE ${pattern} ESCAPE '\\' OR league."abbreviation" ILIKE ${pattern} ESCAPE '\\')`,
    );
  }

  if (query.role) {
    predicates.push(sql`viewer_membership."role" = ${query.role}`);
  }

  if (query.format) {
    predicates.push(sql`(league."settings" -> 'allowedGameTypes') @> ${JSON.stringify([query.format])}::jsonb`);
  }

  return sql.join(predicates, sql.raw(' AND '));
}

/**
 * Resolves the allowlisted order clause for a membership page.
 * @internal
 * @function
 * @param sort - The normalized requested sort
 * @returns The stable SQL order clause, including the league identifier tiebreak
 */
function buildMembershipOrder(sort: LeagueMembershipSort): SQL {
  if (sort === LeagueMembershipSort.MEMBERS) {
    return sql`"memberCount" DESC, "id" ASC`;
  }

  if (sort === LeagueMembershipSort.NAME) {
    return sql`"name" ASC, "id" ASC`;
  }

  return sql`"joinedAt" DESC, "id" ASC`;
}

/**
 * Normalizes the selected JSON formats into the canonical display order.
 * @internal
 * @function
 * @param input - The JSON value returned by Postgres
 * @returns Known formats in their canonical order
 */
function toAllowedGameTypes(input: unknown): GameType[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return LEAGUE_GAME_TYPE_ORDER.filter((gameType: GameType): boolean => input.includes(gameType));
}

/**
 * Converts a stored row into the payload shape, rendering timestamps as ISO strings.
 * @internal
 * @function
 * @param row - The selected user row, or undefined when no live account matched
 * @returns The profile payload, or null when there is no account to return
 */
function toProfile(row: IProfileRow | undefined): IProfile | null {
  if (!row) {
    return null;
  }

  return {
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName,
    email: row.email,
    id: row.id,
    profileCompletedAt: row.profileCompletedAt?.toISOString() ?? null,
  };
}

/**
 * Reads the signed-in player's own account.
 * @public
 * @function
 * @param userId - The identifier taken from the verified session, never from the request
 * @returns The profile, or null when the account is missing or soft-deleted
 */
export async function readProfile(userId: string): Promise<IProfile | null> {
  const rows: IProfileRow[] = await useDatabase()
    .select(PROFILE_COLUMNS)
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));

  return toProfile(rows[0]);
}

/**
 * Whether the identifier from a session still names a live account.
 *
 * A cheaper companion to {@link readProfile} for handlers that need the session revalidated but have no use for the
 * profile itself. Selecting the id alone keeps the check to an index lookup rather than a row read.
 * @public
 * @function
 * @param userId - The identifier taken from the verified session, never from the request
 * @returns Whether an account exists for the identifier and has not been soft-deleted
 */
export async function isActiveAccount(userId: string): Promise<boolean> {
  const rows: { id: string }[] = await useDatabase()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  return rows.length > 0;
}

/**
 * Saves a new display name for the signed-in player.
 *
 * The soft-delete guard is repeated here rather than trusted from the read: a session outlives the account it names,
 * so an account deleted mid-session must not still be writable through it.
 * @public
 * @function
 * @param userId - The identifier taken from the verified session
 * @param displayName - The already-validated, trimmed name
 * @returns The saved profile, or null when there was no live account to write to
 */
export async function updateDisplayName(userId: string, displayName: string): Promise<IProfile | null> {
  const rows: IProfileRow[] = await useDatabase()
    .update(users)
    .set({ displayName, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning(PROFILE_COLUMNS);

  return toProfile(rows[0]);
}

/**
 * Saves the display name and marks onboarding finished in one write.
 *
 * Separate from {@link updateDisplayName} so an ordinary profile edit can never change onboarding state. The stamp is
 * coalesced rather than overwritten, so submitting the form twice does not move a completion date that already exists.
 * @public
 * @function
 * @param userId - The identifier taken from the verified session
 * @param displayName - The already-validated, trimmed name
 * @returns The saved profile, or null when there was no live account to write to
 */
export async function completeProfile(userId: string, displayName: string): Promise<IProfile | null> {
  const rows: IProfileRow[] = await useDatabase()
    .update(users)
    .set({
      displayName,
      profileCompletedAt: sql`COALESCE(${users.profileCompletedAt}, NOW())`,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning(PROFILE_COLUMNS);

  return toProfile(rows[0]);
}

/**
 * Reads one bounded page of leagues the signed-in player is an active member of.
 *
 * Counts, aggregates, clamping and rows share one statement, so a concurrent membership change cannot make a page and
 * its totals disagree. Member and game counts are aggregated separately before they meet the viewer's rows.
 * @public
 * @function
 * @param userId - The identifier taken from the verified session
 * @param query - The normalized search, filters, ordering and page bounds
 * @returns The effective membership page and both filtered and unfiltered totals
 */
export async function readMemberships(userId: string, query: ILeagueMembershipQuery): Promise<ILeagueMembershipPage> {
  const predicate: SQL = buildMembershipPredicate(userId, query);
  const order: SQL = buildMembershipOrder(query.sort);
  const acceptedStatuses: SQL = sql.join(
    ACCEPTED_GAME_STATUSES.map((status: GameStatus): SQL => sql`${status}`),
    sql.raw(', '),
  );
  const result = await useDatabase().execute<ILeagueMembershipDatabaseRow>(sql`
    WITH "activeMemberCounts" AS (
      SELECT "league_id" AS "leagueId", count(*)::int AS "memberCount"
      FROM ${memberships}
      INNER JOIN ${users} live_member
        ON live_member."id" = ${memberships}."user_id"
        AND live_member."deleted_at" IS NULL
      WHERE "status" = ${MembershipStatus.ACTIVE}
      GROUP BY "league_id"
    ),
    "acceptedGameCounts" AS (
      SELECT "league_id" AS "leagueId", count(*)::int AS "gameCount"
      FROM ${games}
      WHERE "confirmation_status" = ${ConfirmationStatus.CONFIRMED}
        AND "status" IN (${acceptedStatuses})
      GROUP BY "league_id"
    ),
    "filtered" AS (
      SELECT
        league."abbreviation" AS "abbreviation",
        league."settings" -> 'allowedGameTypes' AS "allowedGameTypes",
        league."description" AS "description",
        coalesce("acceptedGameCounts"."gameCount", 0)::int AS "gameCount",
        league."id" AS "id",
        viewer_membership."joined_at" AS "joinedAt",
        coalesce("activeMemberCounts"."memberCount", 0)::int AS "memberCount",
        league."name" AS "name",
        viewer_membership."role" AS "role"
      FROM ${memberships} viewer_membership
      INNER JOIN ${leagues} league ON league."id" = viewer_membership."league_id"
      LEFT JOIN "activeMemberCounts" ON "activeMemberCounts"."leagueId" = league."id"
      LEFT JOIN "acceptedGameCounts" ON "acceptedGameCounts"."leagueId" = league."id"
      WHERE ${predicate}
    ),
    "numbered" AS (
      SELECT "filtered".*, row_number() OVER (ORDER BY ${order}) AS "rowNumber"
      FROM "filtered"
    ),
    "counts" AS (
      SELECT
        (SELECT count(*)::int FROM "filtered") AS "filteredTotal",
        (
          SELECT count(*)::int
          FROM ${memberships} total_membership
          WHERE total_membership."user_id" = ${userId}
            AND total_membership."status" = ${MembershipStatus.ACTIVE}
        ) AS "unfilteredTotal"
    ),
    "pageBounds" AS (
      SELECT
        least(
          ${query.page},
          greatest(1, ceil("filteredTotal"::numeric / ${query.pageSize})::int)
        ) AS "effectivePage",
        "filteredTotal",
        "unfilteredTotal"
      FROM "counts"
    )
    SELECT "numbered".*, "pageBounds".*
    FROM "pageBounds"
    LEFT JOIN "numbered"
      ON "numbered"."rowNumber" > ("pageBounds"."effectivePage" - 1) * ${query.pageSize}
      AND "numbered"."rowNumber" <= "pageBounds"."effectivePage" * ${query.pageSize}
    ORDER BY "numbered"."rowNumber" ASC NULLS LAST
  `);
  const databaseRows: ILeagueMembershipDatabaseRow[] = result.rows;
  const metadata: ILeagueMembershipDatabaseRow = databaseRows[0]!;
  const rows: ILeagueMembership[] = databaseRows
    .filter((row: ILeagueMembershipDatabaseRow): boolean => row.id !== null)
    .map((row: ILeagueMembershipDatabaseRow): ILeagueMembership => ({
      abbreviation: row.abbreviation!,
      allowedGameTypes: toAllowedGameTypes(row.allowedGameTypes),
      description: row.description,
      gameCount: Number(row.gameCount),
      id: row.id!,
      joinedAt: new Date(row.joinedAt!).toISOString(),
      memberCount: Number(row.memberCount),
      name: row.name!,
      role: row.role as LeagueRole,
    }));

  return {
    filteredTotal: Number(metadata.filteredTotal),
    page: Number(metadata.effectivePage),
    pageSize: query.pageSize,
    rows,
    unfilteredTotal: Number(metadata.unfilteredTotal),
  };
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register readable names/descriptions so the unit suites can title their describe blocks from the source symbols
defineSymbol(readProfile, {
  name: 'Read Profile',
  description: "Reads the signed-in player's own account.",
});

defineSymbol(isActiveAccount, {
  name: 'Is Active Account',
  description: 'Reports whether the identifier from a session still names a live account.',
});

defineSymbol(updateDisplayName, {
  name: 'Update Display Name',
  description: 'Saves a new display name for the signed-in player.',
});

defineSymbol(completeProfile, {
  name: 'Complete Profile',
  description: 'Saves the display name and marks onboarding finished in one write.',
});

defineSymbol(readMemberships, {
  name: 'Read Memberships',
  description: 'Reads the leagues the signed-in player is an active member of.',
});
