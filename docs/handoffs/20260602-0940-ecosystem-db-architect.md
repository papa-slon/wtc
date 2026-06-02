# ecosystem-db-architect handoff
## Scope
Read-only Phase 3.44 / epoch 20260602-0940 DB audit before implementing admin account unlock for the DB-backed login lockout slice. Inspected the current `packages/db` schema, repositories, migrations, integration tests, and adjacent admin/security contracts. Focus: whether the existing lockout columns are sufficient, the repository primitive needed to clear lockout state atomically with an `auth.account_unlock` audit row, migration needs, and PGlite / real-Postgres test expectations. No product code or docs were edited except this handoff.
## Files inspected
- `AGENTS.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/index.ts`
- `packages/db/migrations/0016_colorful_lyja.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/audit/src/audit.ts`
- `packages/auth/src/login-lockout.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/lib/backend.ts`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/handoffs/20260602-0903-phase-3-43-auth-account-lockout.md`
## Files changed
None — read-only audit
## Findings
1. LOW - No DB migration is needed for a basic admin unlock. Evidence: the `users` table already has the full Phase 3.43 lockout state at `packages/db/src/schema.ts:22`-`packages/db/src/schema.ts:29`, migration `0016_colorful_lyja.sql:1`-`0016_colorful_lyja.sql:8` adds exactly those columns, and `_journal.json:117`-`_journal.json:123` registers that migration. Recommendation: implement Phase 3.44 as repository/app wiring plus tests, then run `npm run db:generate -w @wtc/db` and require no generated migration. Target part: schema/migrations.
2. HIGH - The unlock operation needs a new `@wtc/db` repository primitive; it must not be split into an app-level update plus app-level audit write. Evidence: `attemptUserLogin()` already uses a transaction at `packages/db/src/repositories.ts:111`-`packages/db/src/repositories.ts:180`, row-locks the user by email at `packages/db/src/repositories.ts:116`-`packages/db/src/repositories.ts:118`, and writes failed-login audit rows inside the same transaction at `packages/db/src/repositories.ts:120`-`packages/db/src/repositories.ts:166`. The admin override rule requires audit before commit / rollback on audit failure at `docs/SECURITY_MODEL.md:259`-`docs/SECURITY_MODEL.md:268`. Recommendation: add `unlockUserLoginLockout(db, { targetUserId, actorUserId, reason, now? })` in `packages/db/src/repositories.ts`; inside one transaction, `SELECT ... FOR UPDATE` the target `users.id`, capture prior lockout state, set the same zero/null fields as `nextLoginSuccessState()` / `lockoutPatch()`, insert `auth.account_unlock`, and only then let the transaction commit. Target part: DB repository mutation.
3. MEDIUM - `auth.account_unlock` is already a valid audit action, so the DB primitive should use it rather than `admin.action` or a new code. Evidence: `packages/audit/src/audit.ts:40`-`packages/audit/src/audit.ts:46` reserves `auth.account_unlock`, and `docs/RBAC_MATRIX.md:230`-`docs/RBAC_MATRIX.md:233` binds `POST /api/admin/users/:id/unlock` to in-transaction `auth.account_unlock`. Recommendation: audit rows should use `actorUserId = admin id`, `actorRole = 'admin'`, `targetType = 'user'`, `targetId = target user id`, `result = 'success'` for a cleared user, and safe before/after metadata only. Include the admin reason after redaction; do not include password hashes, submitted login identifiers, IP-derived secrets, or raw session tokens. Target part: audit payload shape.
4. MEDIUM - The safe admin user projection currently does not expose lockout status. Evidence: `listUsersWithCreatedAt()` selects only `id`, `email`, `displayName`, `passwordHash`, and `createdAt` from `users` at `packages/db/src/repositories.ts:3213`-`packages/db/src/repositories.ts:3223`, and `AdminUserView` exposes only `id`, `email`, `displayName`, `roles`, and `createdAt` at `apps/web/src/features/admin/types.ts:10`-`apps/web/src/features/admin/types.ts:17`. Recommendation: if the Phase 3.44 UI needs a lock badge or button state, add a safe DB projection such as `accountLockedUntil` / `accountLockoutReviewRequiredAt` for admins only, or add a narrow `getUserLockoutStateForAdmin()` lookup. The unlock action itself must still re-read and row-lock the target user server-side, so UI state is never authoritative. Target part: admin DB projection.
5. MEDIUM - PGlite coverage should verify unlock state transitions and audit atomicity; current PGlite coverage only proves login-lockout behavior. Evidence: `tests/integration/auth-login-lockout-db.test.ts:45`-`tests/integration/auth-login-lockout-db.test.ts:54` applies migrations through PGlite, lockout is asserted at `tests/integration/auth-login-lockout-db.test.ts:58`-`tests/integration/auth-login-lockout-db.test.ts:77`, success-reset is asserted at `tests/integration/auth-login-lockout-db.test.ts:99`-`tests/integration/auth-login-lockout-db.test.ts:114`, and review marker behavior is asserted at `tests/integration/auth-login-lockout-db.test.ts:129`-`tests/integration/auth-login-lockout-db.test.ts:146`. Recommendation: extend that suite or add `tests/integration/auth-account-unlock-db.test.ts` to lock a user, call the new unlock primitive, assert all failed-count/reset/lock/review fields are cleared, assert one `auth.account_unlock` audit row, assert audit failure would roll back the state change by transaction shape where feasible, and assert the next login attempt starts from the cleared state. Target part: integration tests.
6. MEDIUM - Real-Postgres proof remains opt-in and should be unlock-specific only if the implementation relies on concurrent ordering. Evidence: the real-PG harness is skipped without `REAL_POSTGRES_DATABASE_URL` at `tests/integration/db-real-postgres.test.ts:1`-`tests/integration/db-real-postgres.test.ts:15` and `tests/integration/db-real-postgres.test.ts:70`-`tests/integration/db-real-postgres.test.ts:80`; it already has a true cross-connection failed-login race at `tests/integration/db-real-postgres.test.ts:176`-`tests/integration/db-real-postgres.test.ts:207`. Recommendation: add an opt-in real-PG test if Phase 3.44 wants production-grade proof that concurrent unlock-vs-login or double-unlock operations serialize under the target-user row lock. Report it as NOT RUN unless a throwaway `wtc_test*` database URL is supplied. Target part: real-Postgres race gate.
## Decisions
- Existing `users` lockout columns are sufficient for the basic admin unlock slice; no new migration is recommended.
- The DB repository should own the unlock mutation and the `auth.account_unlock` audit insert in a single transaction.
- Unlock should clear the same failed-login state that successful login clears: 15m count/reset, 60m count/reset, total failed count, last failed timestamp, lockout-until, and review-required timestamp.
- The admin route/action should validate RBAC, CSRF, and reason before calling the DB primitive, but the DB primitive must still row-lock and validate the target user because UI/admin loader state can be stale.
- Admin list lockout display is optional for DB correctness; if implemented, expose only safe status fields through an admin-only projection.
## Risks
- A split app-level update plus audit write could leave a user unlocked without `auth.account_unlock`, or an audit row without a durable state change.
- Clearing only `account_locked_until` while leaving counters/review markers intact can cause immediate re-lock or stale review state after an admin believes the account is unlocked.
- PGlite can prove deterministic unlock transitions, but it is not enough to prove cross-connection races.
- A free-text admin reason can accidentally include sensitive data; rely on the audit redaction path and keep route validation/error copy from echoing secrets.
- If the admin UI displays lockout status from `listUsersWithCreatedAt()`, that function currently lacks the needed columns and would show stale or incomplete state unless extended.
## Verification/tests
- Read-only inspection only; no product-code edits and no test commands were run in this agent lane.
- Targeted searches were run for `failedLogin`, `accountLocked`, `accountLockout`, `auth.account_unlock`, `unlock`, `attemptUserLogin`, and `FOR UPDATE` across `packages/db`, `apps/web`, `packages/auth`, `tests`, and docs.
- Expected PGlite tests for implementation:
  1. lock user with failed attempts, unlock by admin, assert all lockout fields are zero/null;
  2. assert `auth.account_unlock` audit row has admin actor, target user id, safe before/after state, reason, and success result;
  3. assert next successful login after unlock is allowed and next failed login starts from count 1;
  4. assert missing target user returns a stable not-found/failure contract and, if the security lane requires attempted-admin-action audit, writes a failure audit row without exposing secrets;
  5. assert double unlock is idempotent enough for UI retries while still auditable according to the backend/security decision.
- Expected real-Postgres test, credentials permitting: concurrent locked-login attempt and admin unlock, or two concurrent unlocks, serialize to one coherent final state and coherent audit rows under the row lock.
## Next actions
1. Implement `unlockUserLoginLockout()` in `packages/db/src/repositories.ts` using a target-user `FOR UPDATE` lock, `lockoutPatch(nextLoginSuccessState())`, and in-transaction `auth.account_unlock`.
2. Add PGlite unlock tests covering state clear, audit row, retry/idempotency behavior, and post-unlock login behavior.
3. If UI needs lockout visibility, add a safe admin-only lockout projection; do not reuse `DbUserWithCreatedAt` directly in client responses.
4. Add an opt-in real-Postgres unlock race test if Phase 3.44 acceptance wants concurrent unlock/login proof.
5. After implementation, run `npm test -- tests/integration/auth-login-lockout-db.test.ts tests/integration/db-real-postgres.test.ts`, `npm run db:generate -w @wtc/db`, `npm run typecheck`, `npm run lint`, and the repo governance gate selected by the operator.
