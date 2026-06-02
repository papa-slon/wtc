CREATE TABLE "bot_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_instance_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"config_json" jsonb NOT NULL,
	"changed_by" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_instance_id" uuid NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"wallet_equity_usd" numeric(18, 4),
	"closed_pnl_usd" numeric(18, 4),
	"unrealized_pnl_usd" numeric(18, 4),
	"win_rate" numeric(6, 4),
	"profit_factor" numeric(8, 4),
	"max_drawdown_pct" numeric(8, 4),
	"current_drawdown_pct" numeric(8, 4),
	"total_fees_usd" numeric(18, 4),
	"total_funding_usd" numeric(18, 4),
	"open_risk_usd" numeric(18, 4),
	"trade_count" integer,
	"source_adapter" text NOT NULL,
	"raw_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_position_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_instance_id" uuid NOT NULL,
	"snapshot_at" timestamp with time zone NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"size" numeric(20, 8) NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"mark_price" numeric(20, 8),
	"unrealized_pnl_usd" numeric(18, 4),
	"leverage" integer,
	"tp_price" numeric(20, 8),
	"sl_price" numeric(20, 8),
	"liquidation_price" numeric(20, 8),
	"opened_at" timestamp with time zone,
	"source_adapter" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_safety_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_instance_id" uuid NOT NULL,
	"event_code" text NOT NULL,
	"severity" text NOT NULL,
	"symbol" text,
	"description" text NOT NULL,
	"metadata" jsonb,
	"observed_at" timestamp with time zone NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_trade_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_instance_id" uuid NOT NULL,
	"external_trade_id" text NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"exit_price" numeric(20, 8) NOT NULL,
	"size" numeric(20, 8) NOT NULL,
	"realized_pnl_usd" numeric(18, 4) NOT NULL,
	"fees_usd" numeric(18, 4) DEFAULT '0' NOT NULL,
	"funding_paid_usd" numeric(18, 4) DEFAULT '0' NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone NOT NULL,
	"exit_reason" text,
	"source_adapter" text NOT NULL,
	"raw_json" jsonb,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"entitlement_id" uuid,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"percent_complete" numeric(5, 2) DEFAULT '0' NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link_url" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinned_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"icon_type" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"from_state" text NOT NULL,
	"to_state" text NOT NULL,
	"reason" text,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_code" text,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"assigned_to" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "teacher_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_download_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"version" text NOT NULL,
	"platform" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"entitlement_verified" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_license_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"axioma_user_id" text,
	"device_fingerprint" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_release_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"channel" text NOT NULL,
	"platform" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"release_notes_markdown" text,
	"download_url_template" text,
	"checksum_sha256" text,
	"min_supported_version" text,
	"is_current" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tradingview_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tv_username" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"granted_by" uuid,
	"granted_by_type" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"revoke_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tradingview_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tv_username" text NOT NULL,
	"verified_at" timestamp with time zone,
	"current_grant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "teacher_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "tradingview_access_requests" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tradingview_access_requests" ADD COLUMN "revoked_by" uuid;--> statement-breakpoint
ALTER TABLE "bot_config_versions" ADD CONSTRAINT "bot_config_versions_bot_instance_id_bot_instances_id_fk" FOREIGN KEY ("bot_instance_id") REFERENCES "public"."bot_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_config_versions" ADD CONSTRAINT "bot_config_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_metric_snapshots" ADD CONSTRAINT "bot_metric_snapshots_bot_instance_id_bot_instances_id_fk" FOREIGN KEY ("bot_instance_id") REFERENCES "public"."bot_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_position_snapshots" ADD CONSTRAINT "bot_position_snapshots_bot_instance_id_bot_instances_id_fk" FOREIGN KEY ("bot_instance_id") REFERENCES "public"."bot_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_safety_events" ADD CONSTRAINT "bot_safety_events_bot_instance_id_bot_instances_id_fk" FOREIGN KEY ("bot_instance_id") REFERENCES "public"."bot_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_safety_events" ADD CONSTRAINT "bot_safety_events_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_trade_imports" ADD CONSTRAINT "bot_trade_imports_bot_instance_id_bot_instances_id_fk" FOREIGN KEY ("bot_instance_id") REFERENCES "public"."bot_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinned_links" ADD CONSTRAINT "pinned_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_access_events" ADD CONSTRAINT "product_access_events_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_access_events" ADD CONSTRAINT "product_access_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_access_events" ADD CONSTRAINT "product_access_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_download_events" ADD CONSTRAINT "terminal_download_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_download_events" ADD CONSTRAINT "terminal_download_events_release_id_terminal_release_cache_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."terminal_release_cache"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_license_events" ADD CONSTRAINT "terminal_license_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradingview_access_grants" ADD CONSTRAINT "tradingview_access_grants_request_id_tradingview_access_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."tradingview_access_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradingview_access_grants" ADD CONSTRAINT "tradingview_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradingview_access_grants" ADD CONSTRAINT "tradingview_access_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradingview_access_grants" ADD CONSTRAINT "tradingview_access_grants_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradingview_profiles" ADD CONSTRAINT "tradingview_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradingview_profiles" ADD CONSTRAINT "tradingview_profiles_current_grant_id_tradingview_access_grants_id_fk" FOREIGN KEY ("current_grant_id") REFERENCES "public"."tradingview_access_grants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bcv_instance_version_idx" ON "bot_config_versions" USING btree ("bot_instance_id","version");--> statement-breakpoint
CREATE INDEX "bcv_instance_id_idx" ON "bot_config_versions" USING btree ("bot_instance_id","version");--> statement-breakpoint
CREATE INDEX "bms_instance_snapshot_idx" ON "bot_metric_snapshots" USING btree ("bot_instance_id","snapshot_at");--> statement-breakpoint
CREATE INDEX "bps_instance_snapshot_idx" ON "bot_position_snapshots" USING btree ("bot_instance_id","snapshot_at");--> statement-breakpoint
CREATE INDEX "bse_instance_observed_idx" ON "bot_safety_events" USING btree ("bot_instance_id","observed_at");--> statement-breakpoint
CREATE INDEX "bse_severity_idx" ON "bot_safety_events" USING btree ("severity");--> statement-breakpoint
CREATE UNIQUE INDEX "bti_external_trade_idx" ON "bot_trade_imports" USING btree ("bot_instance_id","external_trade_id","source_adapter");--> statement-breakpoint
CREATE INDEX "bti_instance_closed_idx" ON "bot_trade_imports" USING btree ("bot_instance_id","closed_at");--> statement-breakpoint
CREATE INDEX "bti_external_id_idx" ON "bot_trade_imports" USING btree ("source_adapter","external_trade_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_course_idx" ON "enrollments" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "enrollments_user_id_idx" ON "enrollments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_id_idx" ON "enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_user_lesson_idx" ON "lesson_progress" USING btree ("user_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_user_id_idx" ON "lesson_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","read_at") WHERE "read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "pinned_links_owner_idx" ON "pinned_links" USING btree ("owner_type","owner_id","sort_order");--> statement-breakpoint
CREATE INDEX "pae_entitlement_id_idx" ON "product_access_events" USING btree ("entitlement_id");--> statement-breakpoint
CREATE INDEX "pae_user_id_idx" ON "product_access_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_profiles_user_id_idx" ON "teacher_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tde_user_id_idx" ON "terminal_download_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tle_user_id_idx" ON "terminal_license_events" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trc_version_channel_platform_idx" ON "terminal_release_cache" USING btree ("version","channel","platform");--> statement-breakpoint
CREATE INDEX "trc_channel_platform_current_idx" ON "terminal_release_cache" USING btree ("channel","platform","is_current");--> statement-breakpoint
CREATE INDEX "tvag_user_id_idx" ON "tradingview_access_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tvag_expires_at_idx" ON "tradingview_access_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tvp_user_id_idx" ON "tradingview_profiles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_teacher_profile_id_teacher_profiles_id_fk" FOREIGN KEY ("teacher_profile_id") REFERENCES "public"."teacher_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tradingview_access_requests" ADD CONSTRAINT "tradingview_access_requests_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- 0002 hand-added (non-DDL data migration + CHECK); see docs/handoffs/20260530-0925-ecosystem-db-architect.md.
-- Placed last: every table/column referenced below already exists by this point.
-- Backfill teacher_profiles from existing courses.owner_teacher_id (additive cutover; owner_teacher_id kept).
INSERT INTO "teacher_profiles" ("id", "user_id", "display_name", "social_links", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), u.id, COALESCE(u.display_name, u.email), '{}'::jsonb, true, NOW(), NOW()
FROM (SELECT DISTINCT owner_teacher_id FROM "courses") AS c
JOIN "users" u ON u.id = c.owner_teacher_id
ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
-- Populate the new courses.teacher_profile_id from the backfilled profiles.
UPDATE "courses" SET "teacher_profile_id" = tp.id
FROM "teacher_profiles" tp
WHERE "courses"."owner_teacher_id" = tp.user_id;--> statement-breakpoint
-- Polymorphic owner_type integrity (no DB-level FK on pinned_links.owner_id).
ALTER TABLE "pinned_links" ADD CONSTRAINT "pinned_links_owner_type_check" CHECK ("owner_type" IN ('teacher_profile', 'course'));