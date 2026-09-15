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
 * The migration that records create-league submissions and makes one live shareable link per league a database
 * invariant
 * @internal
 * @constant
 */
const SHARED_LINK_MIGRATION: string = '0002_dusty_gauntlet.sql';

/**
 * The league the invitation fixtures below belong to
 * @internal
 * @constant
 */
const LEAGUE_ID: string = '11111111-1111-1111-1111-111111111111';

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
 * Inserts the account and league every invitation fixture hangs off
 * @internal
 * @async
 * @function
 * @returns The id of the account that owns the league
 */
async function seedLeague(): Promise<string> {
  const { rows } = await database.query<{ id: string }>(
    'INSERT INTO "users" ("email", "display_name") VALUES ($1, $2) RETURNING "id"',
    ['commissioner@example.com', 'Commissioner'],
  );
  const owner: string = rows[0]!.id;

  await database.query(
    'INSERT INTO "leagues" ("id", "name", "abbreviation", "settings", "created_by") VALUES ($1, $2, $3, $4, $5)',
    [LEAGUE_ID, 'Friday Ladder', 'FRI', '{}', owner],
  );

  return owner;
}

/**
 * Inserts a shareable invitation, which is what the partial index constrains
 * @internal
 * @async
 * @function
 * @param owner - The account issuing the invitation
 * @param token - The invitation's token
 * @param status - The invitation's status, PENDING unless the case needs a retired row
 * @returns Nothing
 */
async function seedSharedInvitation(owner: string, token: string, status: string = 'PENDING'): Promise<void> {
  await database.query(
    'INSERT INTO "invitations" ("league_id", "email", "token", "invited_by", "status") VALUES ($1, NULL, $2, $3, $4)',
    [LEAGUE_ID, token, owner, status],
  );
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

  describe(SHARED_LINK_MIGRATION, (): void => {
    beforeEach(async (): Promise<void> => {
      database = new PGlite();

      await applyMigration(INITIAL_MIGRATION);
      await applyMigration(WELCOME_MIGRATION);
    });

    it('refuses to migrate a league that already has two live shareable links', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await seedSharedInvitation(owner, 'first');
      await seedSharedInvitation(owner, 'second');

      // Naming the league is the point: the migration cannot know which link the commissioner meant to keep
      await expect(applyMigration(SHARED_LINK_MIGRATION)).rejects.toThrow(LEAGUE_ID);

      const { rows } = await database.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM "invitations" WHERE "status" = 'PENDING'`,
      );

      // A refusal that quietly retired one of them would be worse than no migration at all
      expect(rows[0]!.count).toBe(2);
    });

    it('rejects a second live shareable link once the index exists', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(SHARED_LINK_MIGRATION);
      await seedSharedInvitation(owner, 'first');

      await expect(seedSharedInvitation(owner, 'second')).rejects.toThrow('invitations_league_shared_pending_unique');
    });

    it('accepts a successor once its predecessor is no longer pending', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(SHARED_LINK_MIGRATION);
      await seedSharedInvitation(owner, 'expired', 'EXPIRED');
      await seedSharedInvitation(owner, 'revoked', 'REVOKED');

      // The index constrains live links only, so the history a league accumulates never blocks its next one
      await expect(seedSharedInvitation(owner, 'current')).resolves.toBeUndefined();
    });

    it('rejects a repeated create-league submission from the same account', async (): Promise<void> => {
      const owner: string = await seedLeague();
      const submission: string = '99999999-9999-9999-9999-999999999999';

      await applyMigration(SHARED_LINK_MIGRATION);

      const insertRequest = async (): Promise<unknown> =>
        database.query(
          'INSERT INTO "league_creation_requests" ("created_by", "submission_id", "payload_digest", "league_id") VALUES ($1, $2, $3, $4)',
          [owner, submission, 'digest', LEAGUE_ID],
        );

      await insertRequest();

      // This index is what makes two identical submissions produce one league rather than two
      await expect(insertRequest()).rejects.toThrow('league_creation_requests_creator_submission_unique');
    });
  });
});
