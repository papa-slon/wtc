ALTER TABLE "materials" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "embed_html" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "mime_type" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "content_sha256" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "file_bytes_base64" text;--> statement-breakpoint
ALTER TABLE "materials" ADD COLUMN "embed_html" text;--> statement-breakpoint
UPDATE "lessons" SET "content_type" = 'article' WHERE "content_type" = 'embed' AND "embed_html" IS NULL;--> statement-breakpoint
CREATE INDEX "materials_lesson_kind_idx" ON "materials" USING btree ("lesson_id","kind");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_embed_html_payload_check" CHECK ((("lessons"."content_type" = 'embed' AND "lessons"."embed_html" IS NOT NULL) OR ("lessons"."content_type" <> 'embed' AND "lessons"."embed_html" IS NULL)));--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_kind_check" CHECK ("materials"."kind" IN ('link', 'file', 'embed'));--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_payload_check" CHECK ((
        ("materials"."kind" = 'link' AND "materials"."url" IS NOT NULL AND "materials"."file_name" IS NULL AND "materials"."mime_type" IS NULL AND "materials"."size_bytes" IS NULL AND "materials"."content_sha256" IS NULL AND "materials"."file_bytes_base64" IS NULL AND "materials"."embed_html" IS NULL)
        OR
        ("materials"."kind" = 'file' AND "materials"."url" IS NULL AND "materials"."file_name" IS NOT NULL AND "materials"."mime_type" IS NOT NULL AND "materials"."size_bytes" IS NOT NULL AND "materials"."size_bytes" > 0 AND "materials"."content_sha256" IS NOT NULL AND "materials"."file_bytes_base64" IS NOT NULL AND "materials"."embed_html" IS NULL)
        OR
        ("materials"."kind" = 'embed' AND "materials"."url" IS NULL AND "materials"."file_name" IS NULL AND "materials"."mime_type" IS NULL AND "materials"."size_bytes" IS NULL AND "materials"."content_sha256" IS NULL AND "materials"."file_bytes_base64" IS NULL AND "materials"."embed_html" IS NOT NULL)
      ));
