ALTER TABLE "result_revision_sides" DROP CONSTRAINT IF EXISTS "result_revision_sides_confirmation_pair";--> statement-breakpoint
ALTER TABLE "result_actions" ADD COLUMN "actor_role" "league_role";--> statement-breakpoint
UPDATE "result_revision_sides"
  SET "confirmed_by_user_id" = NULL, "confirmed_at" = NULL
  WHERE "satisfied_by" <> 'CONFIRMATION'
    AND ("confirmed_by_user_id" IS NOT NULL OR "confirmed_at" IS NOT NULL);--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "result_revision_sides"
    WHERE "satisfied_by" = 'CONFIRMATION'
      AND ("confirmed_by_user_id" IS NULL OR "confirmed_at" IS NULL)
  ) THEN
    RAISE EXCEPTION 'a side claims a confirmation with no confirmer or no time; repair it before migrating';
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "result_revision_sides" ADD CONSTRAINT "result_revision_sides_confirmation_pair" CHECK (CASE WHEN "result_revision_sides"."satisfied_by" = 'CONFIRMATION'
            THEN "result_revision_sides"."confirmed_by_user_id" IS NOT NULL AND "result_revision_sides"."confirmed_at" IS NOT NULL
            ELSE "result_revision_sides"."confirmed_by_user_id" IS NULL AND "result_revision_sides"."confirmed_at" IS NULL
          END);