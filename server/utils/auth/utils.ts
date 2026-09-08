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
 * ████████████████████████████████████████████ #server/utils/auth/utils.ts ████████████████████████████████████████████
 *
 * Atomic persistence for Google identities and their Pongifi users.
 *
 * █████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
 */

import { sql } from 'drizzle-orm';
import type { NeonHttpQueryResult } from 'drizzle-orm/neon-http';

import type { ISessionUser } from '#shared/auth';
import { AuthProvider } from '#shared/domain';
import { defineSymbol } from '#shared/utils/symbol';
import { useDatabase } from '#utils/db';
import { runUpstream } from '#utils/http';

import type { IVerifiedGoogleProfile, TSessionUserRow } from './types';

/**
 * Creates or refreshes the Pongifi user linked to a verified Google identity in one atomic database statement.
 * @public
 * @function
 * @param profile - The validated and normalized Google identity
 * @throws 502 when the database cannot complete the sign-in operation
 * @returns The session user, or `null` when the linked or email-matched Pongifi account is soft-deleted
 */
export async function upsertGoogleUser(profile: IVerifiedGoogleProfile): Promise<ISessionUser | null> {
  // Linking by email is safe only because this type is constructed after Google confirms email ownership
  const queryResult: NeonHttpQueryResult<TSessionUserRow> = await runUpstream(
    useDatabase().execute<TSessionUserRow>(sql`
      WITH "account_record" AS (
        SELECT "users"."id", "users"."deleted_at"
        FROM "user_accounts"
        INNER JOIN "users" ON "users"."id" = "user_accounts"."user_id"
        WHERE "user_accounts"."provider" = ${AuthProvider.GOOGLE}
          AND "user_accounts"."provider_account_id" = ${profile.providerAccountId}
      ),
      "updated_account_user" AS (
        UPDATE "users"
        SET
          "email" = CASE
            WHEN NOT EXISTS (
              SELECT 1
              FROM "users" AS "email_user"
              WHERE "email_user"."email" = ${profile.email}
                AND "email_user"."id" <> "users"."id"
            ) THEN ${profile.email}
            ELSE "users"."email"
          END,
          "display_name" = ${profile.displayName},
          "avatar_url" = ${profile.avatarUrl},
          "updated_at" = NOW()
        WHERE "users"."id" = (
          SELECT "account_record"."id"
          FROM "account_record"
          WHERE "account_record"."deleted_at" IS NULL
        )
        RETURNING
          "users"."avatar_url" AS "avatarUrl",
          "users"."display_name" AS "displayName",
          "users"."email",
          "users"."id"
      ),
      "new_or_matching_user" AS (
        INSERT INTO "users" ("email", "display_name", "avatar_url")
        SELECT ${profile.email}, ${profile.displayName}, ${profile.avatarUrl}
        WHERE NOT EXISTS (SELECT 1 FROM "account_record")
        ON CONFLICT ("email") DO UPDATE
        SET
          "display_name" = EXCLUDED."display_name",
          "avatar_url" = EXCLUDED."avatar_url",
          "updated_at" = NOW()
        WHERE "users"."deleted_at" IS NULL
        RETURNING
          "users"."avatar_url" AS "avatarUrl",
          "users"."display_name" AS "displayName",
          "users"."email",
          "users"."id"
      ),
      "linked_account" AS (
        INSERT INTO "user_accounts" ("user_id", "provider", "provider_account_id")
        SELECT "new_or_matching_user"."id", ${AuthProvider.GOOGLE}, ${profile.providerAccountId}
        FROM "new_or_matching_user"
        ON CONFLICT ("provider", "provider_account_id") DO UPDATE
        SET "provider_account_id" = EXCLUDED."provider_account_id"
        RETURNING "user_accounts"."user_id"
      )
      SELECT *
      FROM "updated_account_user"
      UNION ALL
      SELECT "new_or_matching_user".*
      FROM "new_or_matching_user"
      INNER JOIN "linked_account" ON "linked_account"."user_id" = "new_or_matching_user"."id"
      LIMIT 1
    `),
    'Pongifi could not finish signing you in.',
  );

  return queryResult.rows[0] ?? null;
}

/* ─── Metadata ───────────────────────────────────────────────────────────────────────────────────────────────────── */

// Register a readable name/description for diagnostics and any focused unit suite
defineSymbol(upsertGoogleUser, {
  name: 'Upsert Google User',
  description: 'Creates or refreshes the Pongifi user linked to a verified Google identity.',
});
