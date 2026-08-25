CREATE TYPE "public"."auth_provider" AS ENUM('GOOGLE');--> statement-breakpoint
CREATE TYPE "public"."confirmation_status" AS ENUM('CONFIRMED', 'DISPUTED', 'UNCONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."game_event_type" AS ENUM('EXPEDITE_INTRODUCED', 'LET', 'MATCH_INIT', 'RALLY', 'RETIREMENT', 'SERVICE_DOUBT', 'TIMEOUT', 'TIME_CAP_REACHED', 'TOWEL_BREAK');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('ABANDONED', 'COMPLETE', 'DRAFT', 'IN_PROGRESS', 'NO_CONTEST', 'RETIRED', 'SCHEDULED', 'VOID', 'WALKOVER');--> statement-breakpoint
CREATE TYPE "public"."game_type" AS ENUM('CUTTHROAT', 'DOUBLES', 'SINGLES');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('ACCEPTED', 'DECLINED', 'EXPIRED', 'PENDING', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."league_role" AS ENUM('COMMISSIONER', 'MANAGER', 'PLAYER');--> statement-breakpoint
CREATE TYPE "public"."league_visibility" AS ENUM('DISCOVERABLE', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('ACTIVE', 'INACTIVE', 'INVITED', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."participant_outcome" AS ENUM('LOSS', 'NO_RESULT', 'WIN');--> statement-breakpoint
CREATE TYPE "public"."participant_side" AS ENUM('A', 'B');--> statement-breakpoint
CREATE TYPE "public"."rating_scope" AS ENUM('CUTTHROAT', 'DOUBLES', 'OVERALL', 'SINGLES');--> statement-breakpoint
CREATE TYPE "public"."recording_mode" AS ENUM('LIVE', 'RETROACTIVE');--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" "game_event_type" NOT NULL,
	"serving_user_id" uuid,
	"scoring_user_id" uuid,
	"detail" jsonb,
	"detail_version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_events_sequence_non_negative" CHECK ("game_events"."sequence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "game_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_name" text,
	"side" "participant_side",
	"team_index" integer,
	"rotation_position" integer,
	"final_score" integer,
	"outcome" "participant_outcome",
	"confirmed_at" timestamp with time zone,
	"disputed_at" timestamp with time zone,
	CONSTRAINT "game_participants_identity" CHECK (("game_participants"."user_id" IS NULL) <> ("game_participants"."guest_name" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"match_id" uuid,
	"game_number" integer DEFAULT 1 NOT NULL,
	"type" "game_type" NOT NULL,
	"status" "game_status" DEFAULT 'DRAFT' NOT NULL,
	"confirmation_status" "confirmation_status" DEFAULT 'UNCONFIRMED' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"recording_mode" "recording_mode" DEFAULT 'LIVE' NOT NULL,
	"settings_snapshot" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"recorder_user_id" uuid,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_ms" integer,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_game_number_positive" CHECK ("games"."game_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"abbreviation" varchar(8) NOT NULL,
	"description" text,
	"hero_url" text,
	"visibility" "league_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"settings" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "league_role" DEFAULT 'PLAYER' NOT NULL,
	"status" "membership_status" DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"league_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "rating_scope" NOT NULL,
	"rating" double precision NOT NULL,
	"games_played" integer NOT NULL,
	"is_provisional" boolean NOT NULL,
	"game_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_serving_user_id_users_id_fk" FOREIGN KEY ("serving_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_scoring_user_id_users_id_fk" FOREIGN KEY ("scoring_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_participants" ADD CONSTRAINT "game_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_recorder_user_id_users_id_fk" FOREIGN KEY ("recorder_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD CONSTRAINT "rating_snapshots_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD CONSTRAINT "rating_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_snapshots" ADD CONSTRAINT "rating_snapshots_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_events_game_sequence_unique" ON "game_events" USING btree ("game_id","sequence");--> statement-breakpoint
CREATE INDEX "game_participants_game_idx" ON "game_participants" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_participants_user_idx" ON "game_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "games_league_ended_at_idx" ON "games" USING btree ("league_id","ended_at");--> statement-breakpoint
CREATE INDEX "games_league_status_idx" ON "games" USING btree ("league_id","status");--> statement-breakpoint
CREATE INDEX "games_match_idx" ON "games" USING btree ("match_id","game_number");--> statement-breakpoint
CREATE INDEX "games_confirmation_idx" ON "games" USING btree ("confirmation_status","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_unique" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_league_status_idx" ON "invitations" USING btree ("league_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_league_user_unique" ON "memberships" USING btree ("league_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_league_status_idx" ON "memberships" USING btree ("league_id","status");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_user_type_unique" ON "notification_preferences" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "rating_snapshots_current_idx" ON "rating_snapshots" USING btree ("league_id","user_id","scope","created_at");--> statement-breakpoint
CREATE INDEX "rating_snapshots_leaderboard_idx" ON "rating_snapshots" USING btree ("league_id","scope","created_at");--> statement-breakpoint
CREATE INDEX "rating_snapshots_game_idx" ON "rating_snapshots" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_provider_account_unique" ON "user_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "user_accounts_user_id_idx" ON "user_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");