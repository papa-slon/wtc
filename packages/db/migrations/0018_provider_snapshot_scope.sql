ALTER TABLE "bot_metric_snapshots" ADD COLUMN "bot_provider_account_id" uuid;--> statement-breakpoint
ALTER TABLE "bot_position_snapshots" ADD COLUMN "bot_provider_account_id" uuid;--> statement-breakpoint
ALTER TABLE "bot_safety_events" ADD COLUMN "bot_provider_account_id" uuid;--> statement-breakpoint
ALTER TABLE "bot_trade_imports" ADD COLUMN "bot_provider_account_id" uuid;--> statement-breakpoint
ALTER TABLE "bot_metric_snapshots" ADD CONSTRAINT "bot_metric_snapshots_bot_provider_account_id_bot_provider_accounts_id_fk" FOREIGN KEY ("bot_provider_account_id") REFERENCES "public"."bot_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_position_snapshots" ADD CONSTRAINT "bot_position_snapshots_bot_provider_account_id_bot_provider_accounts_id_fk" FOREIGN KEY ("bot_provider_account_id") REFERENCES "public"."bot_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_safety_events" ADD CONSTRAINT "bot_safety_events_bot_provider_account_id_bot_provider_accounts_id_fk" FOREIGN KEY ("bot_provider_account_id") REFERENCES "public"."bot_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_trade_imports" ADD CONSTRAINT "bot_trade_imports_bot_provider_account_id_bot_provider_accounts_id_fk" FOREIGN KEY ("bot_provider_account_id") REFERENCES "public"."bot_provider_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bms_provider_snapshot_idx" ON "bot_metric_snapshots" USING btree ("bot_provider_account_id","snapshot_at");--> statement-breakpoint
CREATE INDEX "bps_provider_snapshot_idx" ON "bot_position_snapshots" USING btree ("bot_provider_account_id","snapshot_at");--> statement-breakpoint
CREATE INDEX "bse_provider_observed_idx" ON "bot_safety_events" USING btree ("bot_provider_account_id","observed_at");--> statement-breakpoint
CREATE INDEX "bti_provider_closed_idx" ON "bot_trade_imports" USING btree ("bot_provider_account_id","closed_at");
