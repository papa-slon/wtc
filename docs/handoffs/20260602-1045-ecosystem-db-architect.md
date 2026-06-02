# ecosystem-db-architect handoff
## Scope
Read-only Phase 3.45 DB audit for registration audit logging versus account-review notification. Scope covered repository transaction boundaries, schema/migration need, PGlite/real-Postgres expectations, and notification idempotency risk. No files were edited by this auditor.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/auth/src/login-lockout.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/admin-account-unlock-db.test.ts`
- `tests/integration/db-real-postgres.test.ts`
## Files changed
None - read-only audit
## Findings
1. High - Registration previously created users without an audit row. Evidence: `registerAction()` called `createUser()` and set a session, while the repository inserted `users` and `user_roles` only. Recommendation: write registration audit inside the repository transaction. Target part: identity repository.
2. Medium - `auth.register` needed to be added before any write. Evidence: `AUDIT_ACTIONS` previously had login/login_failed/logout and hardening codes, but no register action. Recommendation: add a typed dot-namespaced audit code and document it. Target part: audit registry.
3. Low - No migration is required. Evidence: `audit_logs.action` is text and `before`/`after` payloads are already JSON fields redacted through `buildEvent()`. Recommendation: run `db:generate` and expect no drift. Target part: schema/migrations.
4. High - Account-review notification is larger than registration audit. Evidence: the 20-failure review marker exists, but email notification remains target-only; notifications have no uniqueness key. Recommendation: keep review notification as a separate phase with first-transition idempotency. Target part: notifications.
5. Medium - Real-Postgres proof remains opt-in. Evidence: the real-PG harness skips without `REAL_POSTGRES_DATABASE_URL` and refuses non-`wtc_test*` databases. Recommendation: PGlite is enough for registration audit; use real Postgres only for active race proof. Target part: gates.
## Decisions
- Registration audit logging is the recommended local Phase 3.45 slice.
- Audit only successful account creation in this slice.
- Do not add a schema migration for audit action registration.
## Risks
- A post-commit app-level audit can leave a user row without an audit row.
- Review notification can spam duplicates unless keyed to first review-marker transition.
- Claiming email workflow would be false without dispatch and delivery-failure handling.
## Verification/tests
RUN by this auditor: read-only inspection and targeted searches.

NOT RUN by this auditor: tests, `db:generate`, full gates, real-Postgres harness, live mutation, or live DB migration.
## Next actions
1. Use `auth.register` in the DB transaction.
2. Add PGlite coverage for user + role + audit behavior and duplicate-email neutrality.
3. Run `npm run db:generate -w @wtc/db` and verify no schema drift.
