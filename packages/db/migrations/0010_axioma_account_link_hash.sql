ALTER TABLE "axioma_account_links" ADD COLUMN "link_nonce_hash" text;--> statement-breakpoint
ALTER TABLE "axioma_account_links" ADD COLUMN "consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "axioma_account_links" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "axioma_account_links" ADD COLUMN "linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "axioma_account_links" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "axioma_account_links" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "axioma_account_links" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "axioma_account_links"
SET "one_time_code" = NULL,
    "state" = CASE WHEN "state" = 'pending' THEN 'revoked' ELSE "state" END,
    "revoked_at" = CASE WHEN "state" = 'pending' THEN now() ELSE "revoked_at" END,
    "updated_at" = now()
WHERE "one_time_code" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "aal_link_nonce_hash_idx" ON "axioma_account_links" USING btree ("link_nonce_hash") WHERE "link_nonce_hash" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "aal_active_user_idx" ON "axioma_account_links" USING btree ("user_id") WHERE "state" = 'linked' AND "revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "aal_active_axioma_user_idx" ON "axioma_account_links" USING btree ("axioma_user_id") WHERE "state" = 'linked' AND "revoked_at" IS NULL AND "axioma_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "aal_user_state_idx" ON "axioma_account_links" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "aal_code_expires_at_idx" ON "axioma_account_links" USING btree ("code_expires_at");
