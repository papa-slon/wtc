DROP INDEX "entitlements_user_product_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "entitlements_user_product_idx" ON "entitlements" USING btree ("user_id","product_code");