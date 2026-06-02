ALTER TABLE "materials" ADD COLUMN "storage_provider" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "scan_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "scan_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "quarantine_reason" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "retained_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "materials"
SET
  "storage_provider" = 'db-local',
  "storage_key" = 'lms/materials/legacy/' || "content_sha256",
  "scan_status" = 'clean',
  "scan_checked_at" = NOW(),
  "retained_until" = NOW() + INTERVAL '365 days'
WHERE "kind" = 'file' AND "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "materials_scan_status_idx" ON "materials" USING btree ("scan_status");--> statement-breakpoint
CREATE INDEX "materials_retained_until_idx" ON "materials" USING btree ("retained_until");--> statement-breakpoint
CREATE INDEX "materials_deleted_at_idx" ON "materials" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_scan_status_check" CHECK ("materials"."scan_status" IN ('pending', 'clean', 'quarantined', 'failed', 'not_required'));--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_file_lifecycle_check" CHECK ((
        ("materials"."kind" = 'file' AND "materials"."storage_provider" IS NOT NULL AND "materials"."storage_key" IS NOT NULL AND "materials"."scan_status" IN ('pending', 'clean', 'quarantined', 'failed') AND "materials"."retained_until" IS NOT NULL)
        OR
        ("materials"."kind" <> 'file' AND "materials"."storage_provider" IS NULL AND "materials"."storage_key" IS NULL AND "materials"."scan_status" = 'not_required' AND "materials"."scan_checked_at" IS NULL AND "materials"."quarantine_reason" IS NULL AND "materials"."retained_until" IS NULL)
      ));
