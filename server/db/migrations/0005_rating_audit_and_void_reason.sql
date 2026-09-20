-- The rating change a game made, and the reason a voided result was settled under, both of which arrived after 0004
-- had already been applied to a database. Every statement is guarded, because two schemas reach this migration: one
-- that ran 0004 as it was first applied and is missing all three, and a database created from the edited 0004 that
-- already has them. Drizzle skips a migration by its position in the journal rather than by its contents, so the
-- first of those is never repaired by re-running 0004 and the second must not fail on a column it already carries.
ALTER TYPE "public"."result_settle_reason" ADD VALUE IF NOT EXISTS 'VOIDED';--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD COLUMN IF NOT EXISTS "rating_before" double precision;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD COLUMN IF NOT EXISTS "delta" double precision;
