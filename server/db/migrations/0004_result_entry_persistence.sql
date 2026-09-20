CREATE TYPE "public"."result_action" AS ENUM('CONFIRM', 'DISPUTE', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."result_operation" AS ENUM('AMEND', 'CONFIRM', 'CREATE', 'DISPUTE', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."result_settle_reason" AS ENUM('CONFIRMED_BY_ALL', 'DEADLINE_PASSED', 'NO_CONFIRMATION_NEEDED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."result_state" AS ENUM('CONFIRMED', 'DISPUTED', 'UNCONFIRMED', 'VOID');--> statement-breakpoint
CREATE TABLE "active_rating_generations" (
	"league_id" uuid PRIMARY KEY NOT NULL,
	"rating_generation_id" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"caused_by_revision_id" uuid,
	"rated_game_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_revision_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"type" "result_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_dispute_notes" (
	"result_action_id" uuid PRIMARY KEY NOT NULL,
	"body" text,
	"redacted_at" timestamp with time zone,
	CONSTRAINT "result_dispute_notes_redacted_empty" CHECK ("result_dispute_notes"."redacted_at" IS NULL OR "result_dispute_notes"."body" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "result_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"operation" "result_operation" NOT NULL,
	"client_operation_id" uuid NOT NULL,
	"request_digest" text NOT NULL,
	"canonical_match_id" uuid NOT NULL,
	"result_revision_id" uuid NOT NULL,
	"effect" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_required_answerers" (
	"result_revision_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_revision_games" (
	"result_revision_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"game_number" integer NOT NULL,
	CONSTRAINT "result_revision_games_number_positive" CHECK ("result_revision_games"."game_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "result_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_match_id" uuid NOT NULL,
	"league_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"is_current" boolean,
	"state" "result_state" NOT NULL,
	"game_type" "game_type" NOT NULL,
	"settings_snapshot" jsonb NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"league_configuration_revision" integer NOT NULL,
	"submission" jsonb NOT NULL,
	"reconstruction" jsonb NOT NULL,
	"reconstruction_version" integer NOT NULL,
	"submission_digest" text NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"original_played_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"confirmation_deadline" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"settled_reason" "result_settle_reason",
	"recorded_by" uuid NOT NULL,
	"edited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "result_revisions_revision_positive" CHECK ("result_revisions"."revision" >= 1),
	CONSTRAINT "result_revisions_settled_pair" CHECK (("result_revisions"."settled_at" IS NULL) = ("result_revisions"."settled_reason" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD COLUMN "result_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "game_participants" ADD COLUMN "result_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "game_participants" ADD COLUMN "seat" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "result_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "superseded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD COLUMN "rating_before" double precision;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD COLUMN "delta" double precision;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD COLUMN "rating_generation_id" uuid;--> statement-breakpoint
-- Every snapshot written before generations existed belongs to one generation per league: the ladder as it stood at
-- this migration. Added nullable and backfilled first, because a NOT NULL column cannot be added to a table that
-- already has rows, and a league whose ratings were dropped here would read as an empty ladder rather than a rebuilt one
INSERT INTO "rating_generations" ("league_id", "rated_game_count")
SELECT "league_id", count(DISTINCT "game_id")::int
FROM "rating_snapshots"
GROUP BY "league_id";--> statement-breakpoint
UPDATE "rating_snapshots" AS "s"
SET "rating_generation_id" = "g"."id"
FROM "rating_generations" AS "g"
WHERE "g"."league_id" = "s"."league_id";--> statement-breakpoint
INSERT INTO "active_rating_generations" ("league_id", "rating_generation_id")
SELECT "league_id", "id" FROM "rating_generations";--> statement-breakpoint
ALTER TABLE "rating_snapshots" ALTER COLUMN "rating_generation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "active_rating_generations" ADD CONSTRAINT "active_rating_generations_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_rating_generations" ADD CONSTRAINT "active_rating_generations_rating_generation_id_rating_generations_id_fk" FOREIGN KEY ("rating_generation_id") REFERENCES "public"."rating_generations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_generations" ADD CONSTRAINT "rating_generations_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_generations" ADD CONSTRAINT "rating_generations_caused_by_revision_id_result_revisions_id_fk" FOREIGN KEY ("caused_by_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_actions" ADD CONSTRAINT "result_actions_result_revision_id_result_revisions_id_fk" FOREIGN KEY ("result_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_actions" ADD CONSTRAINT "result_actions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_dispute_notes" ADD CONSTRAINT "result_dispute_notes_result_action_id_result_actions_id_fk" FOREIGN KEY ("result_action_id") REFERENCES "public"."result_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_operations" ADD CONSTRAINT "result_operations_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_operations" ADD CONSTRAINT "result_operations_result_revision_id_result_revisions_id_fk" FOREIGN KEY ("result_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_required_answerers" ADD CONSTRAINT "result_required_answerers_result_revision_id_result_revisions_id_fk" FOREIGN KEY ("result_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_required_answerers" ADD CONSTRAINT "result_required_answerers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revision_games" ADD CONSTRAINT "result_revision_games_result_revision_id_result_revisions_id_fk" FOREIGN KEY ("result_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revision_games" ADD CONSTRAINT "result_revision_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_revisions_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_revisions_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revisions" ADD CONSTRAINT "result_revisions_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rating_generations_league_idx" ON "rating_generations" USING btree ("league_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "result_actions_one_per_actor_unique" ON "result_actions" USING btree ("result_revision_id","actor_user_id","type");--> statement-breakpoint
CREATE INDEX "result_actions_revision_idx" ON "result_actions" USING btree ("result_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_operations_key_unique" ON "result_operations" USING btree ("actor_user_id","operation","client_operation_id");--> statement-breakpoint
CREATE INDEX "result_operations_match_idx" ON "result_operations" USING btree ("canonical_match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_required_answerers_pk" ON "result_required_answerers" USING btree ("result_revision_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_revision_games_pk" ON "result_revision_games" USING btree ("result_revision_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_revision_games_number_unique" ON "result_revision_games" USING btree ("result_revision_id","game_number");--> statement-breakpoint
CREATE INDEX "result_revision_games_game_idx" ON "result_revision_games" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_revisions_match_revision_unique" ON "result_revisions" USING btree ("canonical_match_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "result_revisions_current_unique" ON "result_revisions" USING btree ("canonical_match_id") WHERE "result_revisions"."is_current";--> statement-breakpoint
CREATE INDEX "result_revisions_due_idx" ON "result_revisions" USING btree ("league_id","state","confirmation_deadline");--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_result_revision_id_result_revisions_id_fk" FOREIGN KEY ("result_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD CONSTRAINT "rating_snapshots_rating_generation_id_rating_generations_id_fk" FOREIGN KEY ("rating_generation_id") REFERENCES "public"."rating_generations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_live_league_idx" ON "games" USING btree ("superseded_at","league_id","status");--> statement-breakpoint
CREATE INDEX "games_result_revision_idx" ON "games" USING btree ("result_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rating_snapshots_generation_unique" ON "rating_snapshots" USING btree ("rating_generation_id","game_id","user_id","scope");--> statement-breakpoint
CREATE INDEX "rating_snapshots_generation_idx" ON "rating_snapshots" USING btree ("rating_generation_id","scope");