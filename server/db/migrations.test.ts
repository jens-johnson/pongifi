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
 * ███████████████████████████████████████████ #server/db/migrations.test.ts ███████████████████████████████████████████
 *
 * Tests that the welcome-state migration backfills existing accounts and only those.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { getTestFileName } from '@jens-johnson/style-guide/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';

/* ─── Fixtures ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The migration that creates the schema, before onboarding state existed
 * @internal
 * @constant
 */
const INITIAL_MIGRATION: string = '0000_odd_landau.sql';

/**
 * The migration that adds profile_completed_at and backfills the accounts already in the table
 * @internal
 * @constant
 */
const WELCOME_MIGRATION: string = '0001_clammy_saracen.sql';

/**
 * The address of the account standing in for a player who signed in before onboarding shipped
 * @internal
 * @constant
 */
const EXISTING_PLAYER_EMAIL: string = 'existing@example.com';

/**
 * The address of the account standing in for a player who signs up afterwards
 * @internal
 * @constant
 */
const NEW_PLAYER_EMAIL: string = 'new@example.com';

/**
 * The database under test, rebuilt for every case
 * @internal
 */
let database: PGlite;

/**
 * Applies one checked-in migration file, splitting it on the marker drizzle writes between statements.
 * @internal
 * @function
 * @param fileName - The migration file to apply
 */
async function applyMigration(fileName: string): Promise<void> {
  const path: string = fileURLToPath(new URL(`migrations/${fileName}`, import.meta.url));
  const contents: string = await readFile(path, 'utf8');

  for (const statement of contents.split('--> statement-breakpoint')) {
    await database.exec(statement);
  }
}

/**
 * Reads an account's onboarding stamp back.
 * @internal
 * @function
 * @param email - The address to look the account up by
 * @returns The stored completion stamp and creation stamp
 */
async function readStamps(email: string): Promise<{ created_at: Date; profile_completed_at: Date | null }> {
  const { rows } = await database.query<{ created_at: Date; profile_completed_at: Date | null }>(
    'SELECT "created_at", "profile_completed_at" FROM "users" WHERE "email" = $1',
    [email],
  );

  return rows[0]!;
}

/* ─── Tests ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

describe(getTestFileName(import.meta.url), (): void => {
  describe(WELCOME_MIGRATION, (): void => {
    beforeEach(async (): Promise<void> => {
      database = new PGlite();

      // Only the first migration, so the table is in the state the second one will actually find in production
      await applyMigration(INITIAL_MIGRATION);
    });

    it('backfills an account that existed before the column was added as already complete', async (): Promise<void> => {
      await database.query('INSERT INTO "users" ("email", "display_name") VALUES ($1, $2)', [
        EXISTING_PLAYER_EMAIL,
        'Existing Player',
      ]);

      await applyMigration(WELCOME_MIGRATION);

      // An empty database cannot prove this: the row has to predate the migration that stamps it
      const { created_at, profile_completed_at } = await readStamps(EXISTING_PLAYER_EMAIL);

      expect(profile_completed_at).toEqual(created_at);
    });

    it('leaves an account created after the migration incomplete', async (): Promise<void> => {
      await applyMigration(WELCOME_MIGRATION);

      await database.query('INSERT INTO "users" ("email", "display_name") VALUES ($1, $2)', [
        NEW_PLAYER_EMAIL,
        'New Player',
      ]);

      // The backfill is a one-off statement, not a default, so it must not reach rows inserted later
      expect((await readStamps(NEW_PLAYER_EMAIL)).profile_completed_at).toBeNull();
    });
  });
});
