ALTER TABLE "courses" ADD COLUMN "level" text DEFAULT 'beginner' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "content_type" text DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "external_url" text;--> statement-breakpoint
-- Phase 3.1 HAND-ADDED backfill (drizzle-kit cannot emit UPDATE statements): lessons with no
-- video_url are articles; rows WITH a video_url keep the ADD COLUMN DEFAULT 'video'. Safe before the
-- CHECK below (both 'video' and 'article' satisfy lessons_content_type_check). No row is ever NULL
-- because content_type was added NOT NULL DEFAULT 'video'. Pattern precedent: 0002_sour_paibok.sql.
UPDATE "lessons" SET "content_type" = 'article' WHERE "video_url" IS NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_level_check" CHECK ("courses"."level" IN ('beginner', 'intermediate', 'advanced'));--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_content_type_check" CHECK ("lessons"."content_type" IN ('video', 'embed', 'article', 'link'));