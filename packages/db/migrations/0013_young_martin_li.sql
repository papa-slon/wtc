ALTER TABLE "materials" DROP CONSTRAINT "materials_payload_check";--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_payload_check" CHECK ((
        ("materials"."kind" = 'link' AND "materials"."url" IS NOT NULL AND "materials"."file_name" IS NULL AND "materials"."mime_type" IS NULL AND "materials"."size_bytes" IS NULL AND "materials"."content_sha256" IS NULL AND "materials"."file_bytes_base64" IS NULL AND "materials"."embed_html" IS NULL)
        OR
        ("materials"."kind" = 'file' AND "materials"."url" IS NULL AND "materials"."file_name" IS NOT NULL AND "materials"."mime_type" IS NOT NULL AND "materials"."size_bytes" IS NOT NULL AND "materials"."size_bytes" > 0 AND "materials"."content_sha256" IS NOT NULL AND "materials"."embed_html" IS NULL AND (
          ("materials"."storage_provider" = 'db-local' AND "materials"."file_bytes_base64" IS NOT NULL)
          OR
          ("materials"."storage_provider" <> 'db-local' AND "materials"."file_bytes_base64" IS NULL)
        ))
        OR
        ("materials"."kind" = 'embed' AND "materials"."url" IS NULL AND "materials"."file_name" IS NULL AND "materials"."mime_type" IS NULL AND "materials"."size_bytes" IS NULL AND "materials"."content_sha256" IS NULL AND "materials"."file_bytes_base64" IS NULL AND "materials"."embed_html" IS NOT NULL)
      ));