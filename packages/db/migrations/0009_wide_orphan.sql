ALTER TABLE "terminal_download_events" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "terminal_download_events" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terminal_download_events" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terminal_download_events" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terminal_download_events" ADD COLUMN "axioma_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "tde_token_hash_idx" ON "terminal_download_events" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "tde_expires_at_idx" ON "terminal_download_events" USING btree ("expires_at");