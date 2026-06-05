CREATE TABLE "bot_global_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_config_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"profile_code" text NOT NULL,
	"version" integer NOT NULL,
	"label" text NOT NULL,
	"status" text NOT NULL,
	"applies_to_new_users" boolean DEFAULT true NOT NULL,
	"allow_user_override" boolean DEFAULT true NOT NULL,
	"config_json" jsonb NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_global_config_versions_product_check" CHECK ("bot_global_config_versions"."product_code" IN ('tortila_bot', 'legacy_bot')),
	CONSTRAINT "bot_global_config_versions_status_check" CHECK ("bot_global_config_versions"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "bot_global_config_versions_profile_code_check" CHECK (length(trim("bot_global_config_versions"."profile_code")) > 0),
	CONSTRAINT "bot_global_config_versions_label_check" CHECK (length(trim("bot_global_config_versions"."label")) > 0)
);
--> statement-breakpoint
CREATE TABLE "bot_global_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" text NOT NULL,
	"profile_code" text DEFAULT 'system_default' NOT NULL,
	"label" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"applies_to_new_users" boolean DEFAULT true NOT NULL,
	"allow_user_override" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"config" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_global_configs_product_check" CHECK ("bot_global_configs"."product_code" IN ('tortila_bot', 'legacy_bot')),
	CONSTRAINT "bot_global_configs_status_check" CHECK ("bot_global_configs"."status" IN ('draft', 'published', 'archived')),
	CONSTRAINT "bot_global_configs_profile_code_check" CHECK (length(trim("bot_global_configs"."profile_code")) > 0),
	CONSTRAINT "bot_global_configs_label_check" CHECK (length(trim("bot_global_configs"."label")) > 0)
);
--> statement-breakpoint
ALTER TABLE "bot_global_config_versions" ADD CONSTRAINT "bot_global_config_versions_global_config_id_bot_global_configs_id_fk" FOREIGN KEY ("global_config_id") REFERENCES "public"."bot_global_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_global_config_versions" ADD CONSTRAINT "bot_global_config_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_global_configs" ADD CONSTRAINT "bot_global_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bgcv_global_config_version_idx" ON "bot_global_config_versions" USING btree ("global_config_id","version");--> statement-breakpoint
CREATE INDEX "bgcv_product_profile_version_idx" ON "bot_global_config_versions" USING btree ("product_code","profile_code","version");--> statement-breakpoint
CREATE UNIQUE INDEX "bgc_product_profile_idx" ON "bot_global_configs" USING btree ("product_code","profile_code");--> statement-breakpoint
CREATE INDEX "bgc_product_status_idx" ON "bot_global_configs" USING btree ("product_code","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bgc_active_default_idx" ON "bot_global_configs" USING btree ("product_code") WHERE "status" = 'published' AND "applies_to_new_users" = true;