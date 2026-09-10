ALTER TABLE "users" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
-- Accounts that predate /welcome never had an onboarding step to complete, so they start complete rather than
-- being routed through a form they have already effectively filled in.
UPDATE "users" SET "profile_completed_at" = "created_at" WHERE "profile_completed_at" IS NULL;
