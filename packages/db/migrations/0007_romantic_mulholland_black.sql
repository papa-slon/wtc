CREATE TABLE "bot_trade_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_instance_id" uuid NOT NULL,
	"external_trade_id" text NOT NULL,
	"source_adapter" text NOT NULL,
	"review_status" text DEFAULT 'unreviewed' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"setup" text,
	"mistake" text,
	"notes" text,
	"r_multiple" numeric(10, 4),
	"mae_pct" numeric(8, 4),
	"mfe_pct" numeric(8, 4),
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_trade_reviews_status_check" CHECK ("bot_trade_reviews"."review_status" IN ('unreviewed', 'reviewed', 'flagged', 'ignored'))
);
--> statement-breakpoint
ALTER TABLE "bot_trade_reviews" ADD CONSTRAINT "bot_trade_reviews_bot_instance_id_bot_instances_id_fk" FOREIGN KEY ("bot_instance_id") REFERENCES "public"."bot_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_trade_reviews" ADD CONSTRAINT "bot_trade_reviews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_trade_reviews" ADD CONSTRAINT "bot_trade_reviews_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "btr_trade_review_idx" ON "bot_trade_reviews" USING btree ("bot_instance_id","external_trade_id","source_adapter");--> statement-breakpoint
CREATE INDEX "btr_instance_updated_idx" ON "bot_trade_reviews" USING btree ("bot_instance_id","updated_at");