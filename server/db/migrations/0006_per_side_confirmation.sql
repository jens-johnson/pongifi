CREATE TYPE "public"."side_satisfaction" AS ENUM('CONFIRMATION', 'EXEMPT', 'PENDING', 'SUBMISSION');--> statement-breakpoint
CREATE TABLE "result_revision_sides" (
	"result_revision_id" uuid NOT NULL,
	"side" "participant_side" NOT NULL,
	"satisfied_by" "side_satisfaction" NOT NULL,
	"confirmed_by_user_id" uuid,
	"confirmed_at" timestamp with time zone,
	CONSTRAINT "result_revision_sides_confirmation_pair" CHECK (("result_revision_sides"."satisfied_by" = 'CONFIRMATION') = ("result_revision_sides"."confirmed_by_user_id" IS NOT NULL AND "result_revision_sides"."confirmed_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "result_side_confirmers" (
	"result_revision_id" uuid NOT NULL,
	"side" "participant_side" NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "result_revisions" ADD COLUMN "confirmation_rule_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "result_revision_sides" ADD CONSTRAINT "result_revision_sides_result_revision_id_result_revisions_id_fk" FOREIGN KEY ("result_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_revision_sides" ADD CONSTRAINT "result_revision_sides_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_side_confirmers" ADD CONSTRAINT "result_side_confirmers_result_revision_id_result_revisions_id_fk" FOREIGN KEY ("result_revision_id") REFERENCES "public"."result_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_side_confirmers" ADD CONSTRAINT "result_side_confirmers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "result_revision_sides_pk" ON "result_revision_sides" USING btree ("result_revision_id","side");--> statement-breakpoint
CREATE INDEX "result_revision_sides_pending_idx" ON "result_revision_sides" USING btree ("result_revision_id","satisfied_by");--> statement-breakpoint
CREATE UNIQUE INDEX "result_side_confirmers_pk" ON "result_side_confirmers" USING btree ("result_revision_id","side","user_id");--> statement-breakpoint
CREATE INDEX "result_side_confirmers_user_idx" ON "result_side_confirmers" USING btree ("result_revision_id","user_id");