CREATE TABLE "axioma_handoff_jti_revocations" (
	"jti" uuid PRIMARY KEY NOT NULL,
	"sub" uuid NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoke_reason" text
);
--> statement-breakpoint
CREATE INDEX "ahjr_expires_at_idx" ON "axioma_handoff_jti_revocations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ahjr_sub_idx" ON "axioma_handoff_jti_revocations" USING btree ("sub");