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
 * ███████████████████████████████████████ #server/utils/profile/queries.test.ts ███████████████████████████████████████
 *
 * Persistence tests for the profile queries, run against a real Postgres.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LeagueRole } from '#shared/domain';
import type { ILeagueMembership, IProfile } from '#shared/profile';
import { symbolName } from '#shared/utils/symbol';

import { completeProfile, isActiveAccount, readMemberships, readProfile, updateDisplayName } from './queries';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The handle the mocked database module hands back, swapped for a fresh Postgres before each case
 * @internal
 * @constant
 */
const databaseRef = vi.hoisted((): { current: unknown } => ({ current: undefined }));

vi.mock('#utils/db', (): Record<string, unknown> => ({ useDatabase: (): unknown => databaseRef.current }));

/**
 * The checked-in migration directory, applied so the queries run against the real schema
 * @internal
 * @constant
 */
const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/**
 * The signed-in player's address
 * @internal
 * @constant
 */
const PLAYER_EMAIL: string = 'maya@example.com';

/**
 * A second player, present so every scoping assertion has something to wrongly include
 * @internal
 * @constant
 */
const OTHER_EMAIL: string = 'sam@example.com';

/**
 * The name a player renames themselves to
 * @internal
 * @constant
 */
const CHOSEN_NAME: string = 'Maya Topspin';

/**
 * The database under test, rebuilt for every case
 * @internal
 */
let database: ReturnType<typeof drizzle>;

/**
 * Inserts a player and returns their id.
 * @internal
 * @function
 * @param email - The account's address
 * @param displayName - The account's display name
 * @returns The new account's identifier
 */
async function insertUser(email: string, displayName: string): Promise<string> {
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "users" ("email", "display_name") VALUES (${email}, ${displayName}) RETURNING "id"`,
  );

  return rows[0]!.id;
}

/**
 * Inserts a league and joins a member to it.
 * @internal
 * @function
 * @param ownerId - The player creating the league
 * @param name - The league's name
 * @param abbreviation - The league's short form
 * @param memberId - The player joining
 * @param status - The membership status to record
 */
async function insertLeague(
  ownerId: string,
  name: string,
  abbreviation: string,
  memberId: string,
  status: string = 'ACTIVE',
): Promise<void> {
  const { rows } = await database.execute<{ id: string }>(
    sql`INSERT INTO "leagues" ("name", "abbreviation", "settings", "created_by")
        VALUES (${name}, ${abbreviation}, '{}'::jsonb, ${ownerId}) RETURNING "id"`,
  );

  await database.execute(
    sql`INSERT INTO "memberships" ("league_id", "user_id", "role", "status")
        VALUES (${rows[0]!.id}, ${memberId}, 'PLAYER', ${status}::membership_status)`,
  );
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  beforeEach(async (): Promise<void> => {
    database = drizzle(new PGlite());
    databaseRef.current = database;

    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  describe(symbolName(readProfile), (): void => {
    it('returns only the allowlisted account fields', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      // A column added to users later must stay invisible until somebody adds it to the allowlist deliberately
      expect(Object.keys((await readProfile(id))!).sort()).toEqual([
        'avatarUrl',
        'createdAt',
        'displayName',
        'email',
        'id',
        'profileCompletedAt',
      ]);
    });

    it('refuses to resolve a soft-deleted account', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW()`);

      expect(await readProfile(id)).toBeNull();
    });
  });

  describe(symbolName(updateDisplayName), (): void => {
    it('saves the name and leaves onboarding state alone', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      expect(await updateDisplayName(id, CHOSEN_NAME)).toMatchObject({
        displayName: CHOSEN_NAME,
        profileCompletedAt: null,
      });
    });

    it('writes nothing to a soft-deleted account, so a stale session cannot edit it', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW()`);

      expect(await updateDisplayName(id, CHOSEN_NAME)).toBeNull();
    });

    it("leaves another player's account untouched", async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const theirs: string = await insertUser(OTHER_EMAIL, 'Sam');

      await updateDisplayName(mine, CHOSEN_NAME);

      const { rows } = await database.execute<{ display_name: string }>(
        sql`SELECT "display_name" FROM "users" WHERE "id" = ${theirs}`,
      );

      expect(rows[0]!.display_name).toBe('Sam');
    });
  });

  describe(symbolName(completeProfile), (): void => {
    it('saves the name and stamps completion in one write', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const profile: IProfile | null = await completeProfile(id, CHOSEN_NAME);

      expect(profile!.displayName).toBe(CHOSEN_NAME);
      expect(profile!.profileCompletedAt).not.toBeNull();
    });

    it('keeps the original stamp when the operation runs twice', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      const first: IProfile | null = await completeProfile(id, CHOSEN_NAME);
      const second: IProfile | null = await completeProfile(id, 'Maya Backhand');

      // The name follows the second write; the completion date must not move
      expect(second!.displayName).toBe('Maya Backhand');
      expect(second!.profileCompletedAt).toBe(first!.profileCompletedAt);
    });
  });

  describe(symbolName(readMemberships), (): void => {
    it('returns only the leagues the player actively belongs to, in name order', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const theirs: string = await insertUser(OTHER_EMAIL, 'Sam');

      await insertLeague(mine, 'Warehouse Wednesdays', 'WW', mine);
      await insertLeague(mine, 'Basement Ballers', 'BB', mine);
      await insertLeague(mine, 'Left The Office', 'LTO', mine, 'REMOVED');
      await insertLeague(theirs, 'A Private League', 'APL', theirs);

      const leagues: ILeagueMembership[] = await readMemberships(mine);

      // A left league and another player's league are both absent; ordering is by name, not insertion
      expect(leagues.map((league: ILeagueMembership): string => league.name)).toEqual([
        'Basement Ballers',
        'Warehouse Wednesdays',
      ]);
      expect(leagues[0]!.role).toBe(LeagueRole.PLAYER);
    });

    it('returns nothing for a player who belongs to no leagues', async (): Promise<void> => {
      expect(await readMemberships(await insertUser(PLAYER_EMAIL, 'Maya'))).toEqual([]);
    });
  });

  describe(symbolName(isActiveAccount), (): void => {
    it('reports a live account as active', async (): Promise<void> => {
      expect(await isActiveAccount(await insertUser(PLAYER_EMAIL, 'Maya'))).toBe(true);
    });

    it('reports a soft-deleted account as inactive, so its sealed session stops resolving', async (): Promise<void> => {
      const id: string = await insertUser(PLAYER_EMAIL, 'Maya');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW() WHERE "id" = ${id}`);

      expect(await isActiveAccount(id)).toBe(false);
    });

    it('reports an identifier naming no account as inactive', async (): Promise<void> => {
      expect(await isActiveAccount('00000000-0000-0000-0000-000000000000')).toBe(false);
    });

    it('answers per account rather than for whoever exists', async (): Promise<void> => {
      const mine: string = await insertUser(PLAYER_EMAIL, 'Maya');
      const theirs: string = await insertUser(OTHER_EMAIL, 'Sam');

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW() WHERE "id" = ${mine}`);

      expect(await isActiveAccount(mine)).toBe(false);
      expect(await isActiveAccount(theirs)).toBe(true);
    });
  });
});
