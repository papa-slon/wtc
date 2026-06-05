CREATE TABLE "bot_provider_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bot_instance_id" uuid NOT NULL,
	"product_code" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_provider_accounts_status_check" CHECK ("bot_provider_accounts"."status" IN ('active', 'disabled', 'needs_review')),
	CONSTRAINT "bot_provider_accounts_provider_account_id_check" CHECK (length(trim("bot_provider_accounts"."provider_account_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "bot_provider_accounts" ADD CONSTRAINT "bot_provider_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_provider_accounts" ADD CONSTRAINT "bot_provider_accounts_bot_instance_id_bot_instances_id_fk" FOREIGN KEY ("bot_instance_id") REFERENCES "public"."bot_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_provider_accounts" ADD CONSTRAINT "bot_provider_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bpa_user_product_idx" ON "bot_provider_accounts" USING btree ("user_id","product_code");--> statement-breakpoint
CREATE INDEX "bpa_instance_provider_idx" ON "bot_provider_accounts" USING btree ("bot_instance_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "bpa_instance_provider_account_idx" ON "bot_provider_accounts" USING btree ("bot_instance_id","provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bpa_active_provider_account_idx" ON "bot_provider_accounts" USING btree ("product_code","provider","provider_account_id") WHERE "status" = 'active';