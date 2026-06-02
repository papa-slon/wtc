CREATE TABLE "billing_manual_review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_id" uuid,
	"reason" text NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"event_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"user_id" uuid,
	"plan_code" text,
	"billing_event" text,
	"status" text NOT NULL,
	"products_changed" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_manual_review_items" ADD CONSTRAINT "billing_manual_review_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_manual_review_items" ADD CONSTRAINT "billing_manual_review_items_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_webhook_events" ADD CONSTRAINT "billing_webhook_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bmri_provider_event_idx" ON "billing_manual_review_items" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "bmri_status_idx" ON "billing_manual_review_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bmri_user_id_idx" ON "billing_manual_review_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bwe_provider_event_idx" ON "billing_webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "bwe_expires_at_idx" ON "billing_webhook_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "bwe_user_id_idx" ON "billing_webhook_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_action_target_idx" ON "audit_logs" USING btree ("action","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_provider_ref_idx" ON "subscriptions" USING btree ("user_id","provider","provider_ref");