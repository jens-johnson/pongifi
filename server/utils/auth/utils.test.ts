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
 * █████████████████████████████████████████ #server/utils/auth/utils.test.ts ██████████████████████████████████████████
 *
 * Persistence tests for the Google identity upsert, run against a real Postgres.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { beforeEach, describe, expect, it } from 'vitest';

import { symbolName } from '#shared/utils/symbol';

import type { IVerifiedGoogleProfile, TSessionUserRow } from './types';
import { buildGoogleUserUpsert } from './utils';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The checked-in migration directory every environment applies before its build; the suite applies the same one so the
 * statement under test runs against the real schema rather than a hand-written approximation
 * @internal
 * @constant
 */
const MIGRATIONS_FOLDER: string = fileURLToPath(new URL('../../db/migrations', import.meta.url));

/**
 * A verified Google identity for a returning player
 * @internal
 * @constant
 */
const GOOGLE_PROFILE: IVerifiedGoogleProfile = {
  avatarUrl: 'https://lh3.googleusercontent.com/original.png',
  displayName: 'Maya Google',
  email: 'maya@example.com',
  providerAccountId: 'google-subject-maya',
};

/**
 * The display name the player chooses on their profile page, replacing the seeded Google one
 * @internal
 * @constant
 */
const CHOSEN_NAME: string = 'Maya "Topspin" R.';

/**
 * The database under test, rebuilt for every case so no case inherits another's rows
 * @internal
 */
let database: ReturnType<typeof drizzle>;

/**
 * Runs the production upsert statement against the suite database.
 * @internal
 * @function
 * @param profile - The verified Google identity signing in
 * @returns The session user the statement returned, or undefined when it returned no rows
 */
async function signIn(profile: IVerifiedGoogleProfile = GOOGLE_PROFILE): Promise<TSessionUserRow | undefined> {
  const { rows } = await database.execute<TSessionUserRow>(buildGoogleUserUpsert(profile));

  return rows[0];
}

/**
 * Reads a stored user back by email, bypassing the statement under test.
 * @internal
 * @function
 * @param email - The address to look the account up by
 * @returns The stored display name and avatar
 */
async function readUser(email: string = GOOGLE_PROFILE.email): Promise<Record<string, unknown> | undefined> {
  const { rows } = await database.execute<Record<string, unknown>>(
    sql`SELECT "display_name", "avatar_url", "email" FROM "users" WHERE "email" = ${email}`,
  );

  return rows[0];
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(symbolName(buildGoogleUserUpsert), (): void => {
    beforeEach(async (): Promise<void> => {
      database = drizzle(new PGlite());

      await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
    });

    it('seeds the display name and avatar from Google when the account is new', async (): Promise<void> => {
      expect(await signIn()).toMatchObject({
        avatarUrl: GOOGLE_PROFILE.avatarUrl,
        displayName: GOOGLE_PROFILE.displayName,
        email: GOOGLE_PROFILE.email,
      });
    });

    it('preserves a display name the player edited when they sign in again', async (): Promise<void> => {
      await signIn();

      // The player renames themselves on their profile page
      await database.execute(sql`UPDATE "users" SET "display_name" = ${CHOSEN_NAME}`);

      // Google still reports its own name on the next sign-in, and must not win
      expect(await signIn()).toMatchObject({ displayName: CHOSEN_NAME });
      expect(await readUser()).toMatchObject({ display_name: CHOSEN_NAME });
    });

    it('refreshes the avatar from Google when they sign in again', async (): Promise<void> => {
      await signIn();

      // The player changes their photo on Google's side; the avatar is provider-owned, so it follows
      const updated: IVerifiedGoogleProfile = {
        ...GOOGLE_PROFILE,
        avatarUrl: 'https://lh3.googleusercontent.com/new.png',
      };

      expect(await signIn(updated)).toMatchObject({ avatarUrl: updated.avatarUrl });
    });

    it('preserves the display name when Google links to an account that already owns the email', async (): Promise<void> => {
      // An account exists with the player's address but no linked Google identity, so the upsert takes the
      // ON CONFLICT ("email") path rather than the linked-account path
      await database.execute(
        sql`INSERT INTO "users" ("email", "display_name") VALUES (${GOOGLE_PROFILE.email}, ${CHOSEN_NAME})`,
      );

      expect(await signIn()).toMatchObject({
        avatarUrl: GOOGLE_PROFILE.avatarUrl,
        displayName: CHOSEN_NAME,
      });
    });

    it('reports that a brand new account still has to complete the welcome step', async (): Promise<void> => {
      expect(await signIn()).toMatchObject({ needsWelcome: true });
    });

    it('stops reporting the welcome step once the player has completed it', async (): Promise<void> => {
      await signIn();

      // Completing /welcome stamps the column the flag is derived from
      await database.execute(sql`UPDATE "users" SET "profile_completed_at" = NOW()`);

      expect(await signIn()).toMatchObject({ needsWelcome: false });
    });

    it('returns no row when the linked account is soft-deleted', async (): Promise<void> => {
      await signIn();

      await database.execute(sql`UPDATE "users" SET "deleted_at" = NOW()`);

      expect(await signIn()).toBeUndefined();
    });

    it('keeps the existing email when another account already owns the incoming address', async (): Promise<void> => {
      await signIn();

      // A second account claims the address Google reports for the first
      await database.execute(
        sql`INSERT INTO "users" ("email", "display_name") VALUES (${'other@example.com'}, ${'Other Player'})`,
      );

      await database.execute(
        sql`UPDATE "users" SET "email" = ${'renamed@example.com'} WHERE "display_name" = ${GOOGLE_PROFILE.displayName}`,
      );
      await database.execute(
        sql`UPDATE "users" SET "email" = ${GOOGLE_PROFILE.email} WHERE "display_name" = ${'Other Player'}`,
      );

      // The linked account keeps its own address rather than colliding with the one that now owns it
      expect(await signIn()).toMatchObject({ email: 'renamed@example.com' });
    });
  });
});
