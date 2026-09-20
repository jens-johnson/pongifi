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
 * The migration that gives every league the configuration revision its settings writes are checked against
 * @internal
 * @constant
 */
const REVISION_MIGRATION: string = '0003_stale_gateway.sql';

/**
 * The migration that adds the result-revision journal, receipts and generation-addressed ratings, and moves every
 * snapshot written before generations existed into one
 * @internal
 * @constant
 */
const RESULT_MIGRATION: string = '0004_result_entry_persistence.sql';

/**
 * The match every result fixture below is a revision of
 * @internal
 * @constant
 */
const MATCH_ID: string = '22222222-2222-2222-2222-222222222222';

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

/**
 * Inserts a completed game, which is what a rating snapshot and a result revision both hang off
 * @internal
 * @async
 * @function
 * @param owner - The account recording it
 * @returns The game's id
 */
async function seedGame(owner: string): Promise<string> {
  const { rows } = await database.query<{ id: string }>(
    `INSERT INTO "games" ("league_id", "type", "status", "settings_snapshot", "created_by")
     VALUES ($1, 'SINGLES', 'COMPLETE', '{}', $2) RETURNING "id"`,
    [LEAGUE_ID, owner],
  );

  return rows[0]!.id;
}

/**
 * Inserts a rating snapshot from before generations existed
 * @internal
 * @async
 * @function
 * @param owner - The rated account
 * @param gameId - The game that produced it
 */
async function seedSnapshot(owner: string, gameId: string): Promise<void> {
  await database.query(
    `INSERT INTO "rating_snapshots" ("league_id", "user_id", "scope", "rating", "games_played", "is_provisional", "game_id")
     VALUES ($1, $2, 'OVERALL', 1216.5, 1, true, $3)`,
    [LEAGUE_ID, owner, gameId],
  );
}

/**
 * Inserts one revision of a result
 * @internal
 * @async
 * @function
 * @param owner - The recorder
 * @param revision - Which revision this is
 * @param isCurrent - Whether it is the current one
 * @returns The revision's id
 */
async function seedRevision(owner: string, revision: number, isCurrent: boolean): Promise<string> {
  const { rows } = await database.query<{ id: string }>(
    `INSERT INTO "result_revisions" (
       "canonical_match_id", "league_id", "revision", "is_current", "state", "game_type",
       "settings_snapshot", "policy_snapshot", "league_configuration_revision", "submission",
       "reconstruction", "reconstruction_version", "submission_digest",
       "played_at", "original_played_at", "submitted_at", "recorded_by"
     ) VALUES ($1, $2, $3, $4, 'UNCONFIRMED', 'SINGLES', '{}', '{}', 1, '{}', '{}', 1, 'digest',
       now(), now(), now(), $5) RETURNING "id"`,
    [MATCH_ID, LEAGUE_ID, revision, isCurrent ? true : null, owner],
  );

  return rows[0]!.id;
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

  describe(REVISION_MIGRATION, (): void => {
    beforeEach(async (): Promise<void> => {
      database = new PGlite();

      await applyMigration(INITIAL_MIGRATION);
      await applyMigration(WELCOME_MIGRATION);
      await applyMigration(SHARED_LINK_MIGRATION);
    });

    /**
     * Reads a league's configuration revision back.
     * @internal
     * @function
     * @returns The stored revision
     */
    async function readRevision(): Promise<number | null> {
      const { rows } = await database.query<{ configuration_revision: number | null }>(
        'SELECT "configuration_revision" FROM "leagues" WHERE "id" = $1',
        [LEAGUE_ID],
      );

      return rows[0]!.configuration_revision;
    }

    it('starts a league that existed before the column at the first revision', async (): Promise<void> => {
      // An empty database cannot prove this: the row has to predate the migration that gives it a revision
      await seedLeague();

      await applyMigration(REVISION_MIGRATION);

      expect(await readRevision()).toBe(1);
    });

    it('starts a league created afterwards at the same first revision', async (): Promise<void> => {
      await applyMigration(REVISION_MIGRATION);

      await seedLeague();

      expect(await readRevision()).toBe(1);
    });

    it('refuses a league whose revision is set to null', async (): Promise<void> => {
      await applyMigration(REVISION_MIGRATION);

      await seedLeague();

      await expect(
        database.query('UPDATE "leagues" SET "configuration_revision" = NULL WHERE "id" = $1', [LEAGUE_ID]),
      ).rejects.toThrow();
    });
  });
  describe(RESULT_MIGRATION, (): void => {
    beforeEach(async (): Promise<void> => {
      database = new PGlite();

      await applyMigration(INITIAL_MIGRATION);
      await applyMigration(WELCOME_MIGRATION);
      await applyMigration(SHARED_LINK_MIGRATION);
      await applyMigration(REVISION_MIGRATION);
    });

    it('moves the ratings a league already had into one generation and points the league at it', async (): Promise<void> => {
      // An empty database cannot prove this: the snapshots have to predate the migration that adopts them
      const owner: string = await seedLeague();

      await seedSnapshot(owner, await seedGame(owner));
      await seedSnapshot(owner, await seedGame(owner));

      await applyMigration(RESULT_MIGRATION);

      const { rows } = await database.query<{ active: string; generation: string; rated: number }>(
        `SELECT "s"."rating_generation_id" AS "generation", "a"."rating_generation_id" AS "active", "g"."rated_game_count" AS "rated"
         FROM "rating_snapshots" AS "s"
         JOIN "active_rating_generations" AS "a" ON "a"."league_id" = "s"."league_id"
         JOIN "rating_generations" AS "g" ON "g"."id" = "s"."rating_generation_id"`,
      );

      expect(rows).toHaveLength(2);
      expect(rows.every((row): boolean => row.generation === rows[0]!.generation)).toBe(true);
      expect(rows.every((row): boolean => row.active === row.generation)).toBe(true);
      expect(rows[0]!.rated).toBe(2);
    });

    it('leaves a league with no ratings without a generation rather than an empty one', async (): Promise<void> => {
      await seedLeague();

      await applyMigration(RESULT_MIGRATION);

      const { rows } = await database.query('SELECT 1 FROM "rating_generations"');

      expect(rows).toHaveLength(0);
    });

    it('refuses a snapshot written without a generation once the column is in place', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(RESULT_MIGRATION);

      await expect(seedSnapshot(owner, await seedGame(owner))).rejects.toThrow();
    });

    it('allows one current revision of a match and any number of superseded ones', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(RESULT_MIGRATION);

      await seedRevision(owner, 1, false);
      await seedRevision(owner, 2, false);
      await seedRevision(owner, 3, true);

      await expect(seedRevision(owner, 4, true)).rejects.toThrow();
    });

    it('refuses a second revision under the same number', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(RESULT_MIGRATION);

      await seedRevision(owner, 1, true);

      await expect(seedRevision(owner, 1, false)).rejects.toThrow();
    });

    it('keeps a superseded game addressable while leaving it out of a live count', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(RESULT_MIGRATION);

      const superseded: string = await seedGame(owner);
      const live: string = await seedGame(owner);

      await database.query('UPDATE "games" SET "superseded_at" = now() WHERE "id" = $1', [superseded]);

      const { rows: counted } = await database.query<{ n: number }>(
        `SELECT count(*)::int AS "n" FROM "games" WHERE "superseded_at" IS NULL AND "status" = 'COMPLETE'`,
      );
      const { rows: addressable } = await database.query('SELECT 1 FROM "games" WHERE "id" = $1', [superseded]);

      expect(counted[0]!.n).toBe(1);
      expect(addressable).toHaveLength(1);
      expect(live).not.toBe(superseded);
    });

    it('refuses a second receipt under one operation key, and allows another key for the same actor', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(RESULT_MIGRATION);

      const revision: string = await seedRevision(owner, 1, true);
      const receipt = async (clientOperationId: string): Promise<unknown> =>
        database.query(
          `INSERT INTO "result_operations" ("actor_user_id", "operation", "client_operation_id", "request_digest",
             "canonical_match_id", "result_revision_id", "effect")
           VALUES ($1, 'CREATE', $2, 'digest', $3, $4, '{}')`,
          [owner, clientOperationId, MATCH_ID, revision],
        );

      await receipt('33333333-3333-3333-3333-333333333333');

      await expect(receipt('33333333-3333-3333-3333-333333333333')).rejects.toThrow();
      await expect(receipt('44444444-4444-4444-4444-444444444444')).resolves.toBeDefined();
    });

    it('refuses a note that claims to be redacted while its words are still there', async (): Promise<void> => {
      const owner: string = await seedLeague();

      await applyMigration(RESULT_MIGRATION);

      const revision: string = await seedRevision(owner, 1, true);
      const { rows } = await database.query<{ id: string }>(
        `INSERT INTO "result_actions" ("result_revision_id", "actor_user_id", "type")
         VALUES ($1, $2, 'DISPUTE') RETURNING "id"`,
        [revision, owner],
      );

      await expect(
        database.query(
          'INSERT INTO "result_dispute_notes" ("result_action_id", "body", "redacted_at") VALUES ($1, $2, now())',
          [rows[0]!.id, 'that was not the score'],
        ),
      ).rejects.toThrow();
    });
  });
});
