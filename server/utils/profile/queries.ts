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

import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import type { LeagueRole } from '#shared/domain';
import { MembershipStatus } from '#shared/domain';
import type { ILeagueMembership, IProfile } from '#shared/profile';
import { defineSymbol } from '#shared/utils/symbol';
import { useDatabase } from '#utils/db';

import { leagues, memberships } from '../../db/schema';
import { users } from '../../db/schema/users';
import type { IProfileRow } from './types';

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
 * Reads the leagues the signed-in player is an active member of.
 *
 * Scoped to their own ACTIVE memberships, so this cannot become a way to enumerate private leagues. Ordered by name
 * with the league id as the tiebreak, so two leagues sharing a name keep a stable position between requests.
 * @public
 * @function
 * @param userId - The identifier taken from the verified session
 * @returns The player's leagues, newest membership state included, in stable order
 */
export async function readMemberships(userId: string): Promise<ILeagueMembership[]> {
  const rows = await useDatabase()
    .select({
      abbreviation: leagues.abbreviation,
      id: leagues.id,
      joinedAt: memberships.joinedAt,
      name: leagues.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(leagues, eq(memberships.leagueId, leagues.id))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, MembershipStatus.ACTIVE)))
    .orderBy(asc(leagues.name), asc(leagues.id));

  return rows.map((row): ILeagueMembership => ({
    abbreviation: row.abbreviation,
    id: row.id,
    joinedAt: row.joinedAt.toISOString(),
    name: row.name,
    /* The column and the enum carry identical members; the cast reconciles drizzle's union with the domain type */
    role: row.role as LeagueRole,
  }));
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
