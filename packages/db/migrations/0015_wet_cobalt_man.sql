ALTER TABLE "lms_object_cleanup_tasks" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lms_object_cleanup_tasks" ADD COLUMN "acknowledged_by" uuid;--> statement-breakpoint
ALTER TABLE "lms_object_cleanup_tasks" ADD CONSTRAINT "lms_object_cleanup_tasks_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lms_object_cleanup_tasks_dead_letter_ack_idx" ON "lms_object_cleanup_tasks" USING btree ("status","acknowledged_at");