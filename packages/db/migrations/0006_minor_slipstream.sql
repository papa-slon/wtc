ALTER TABLE "product_access_events" DROP CONSTRAINT "product_access_events_entitlement_id_entitlements_id_fk";
--> statement-breakpoint
ALTER TABLE "product_access_events" DROP CONSTRAINT "product_access_events_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "product_access_events" DROP CONSTRAINT "product_access_events_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "product_access_events" ADD CONSTRAINT "product_access_events_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_access_events" ADD CONSTRAINT "product_access_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_access_events" ADD CONSTRAINT "product_access_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;