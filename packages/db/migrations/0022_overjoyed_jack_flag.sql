ALTER TABLE "bot_instances" ADD COLUMN "account_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "bi_user_product_account_idx" ON "bot_instances" USING btree ("user_id","product_code","account_id") WHERE "account_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bi_user_product_default_idx" ON "bot_instances" USING btree ("user_id","product_code") WHERE "account_id" IS NULL;