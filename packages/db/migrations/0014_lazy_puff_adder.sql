CREATE TABLE "lms_object_cleanup_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 10 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "lms_object_cleanup_tasks_provider_check" CHECK ("lms_object_cleanup_tasks"."storage_provider" IN ('s3-r2')),
	CONSTRAINT "lms_object_cleanup_tasks_reason_check" CHECK ("lms_object_cleanup_tasks"."reason" IN ('material_create_pending')),
	CONSTRAINT "lms_object_cleanup_tasks_status_check" CHECK ("lms_object_cleanup_tasks"."status" IN ('pending', 'completed', 'dead_letter'))
);
--> statement-breakpoint
CREATE INDEX "lms_object_cleanup_tasks_pending_run_idx" ON "lms_object_cleanup_tasks" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "lms_object_cleanup_tasks_storage_key_idx" ON "lms_object_cleanup_tasks" USING btree ("storage_key");