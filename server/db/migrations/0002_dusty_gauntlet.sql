CREATE TABLE "league_creation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"payload_digest" text NOT NULL,
	"league_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_creation_requests" ADD CONSTRAINT "league_creation_requests_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_creation_requests" ADD CONSTRAINT "league_creation_requests_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "league_creation_requests_creator_submission_unique" ON "league_creation_requests" USING btree ("created_by","submission_id");--> statement-breakpoint
-- A league with two live shareable links is the state the index below forbids, and only that league can say which
-- of them should survive, so this refuses to migrate rather than choosing one.
DO $$
DECLARE
  duplicated text;
BEGIN
  SELECT string_agg("league_id"::text, ', ' ORDER BY "league_id"::text) INTO duplicated
    FROM (
      SELECT "league_id" FROM "invitations"
       WHERE "status" = 'PENDING' AND "email" IS NULL
       GROUP BY "league_id" HAVING count(*) > 1
    ) AS duplicates;
  IF duplicated IS NOT NULL THEN
    RAISE EXCEPTION 'Leagues with more than one live shareable invitation: %. Retire the extra invitations before migrating.', duplicated;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_league_shared_pending_unique" ON "invitations" USING btree ("league_id") WHERE "invitations"."status" = 'PENDING' AND "invitations"."email" IS NULL;
