# ecosystem-platform-architect handoff
## Scope
Read-only Phase 3.43 / epoch 20260602-0903 architecture audit of account-specific login lockout placement. Focus: keep package boundaries clean between `@wtc/auth` pure policy, `@wtc/db` durable lockout state, and `apps/web` server-action orchestration; avoid Edge middleware/database coupling; identify migration boundaries; separate current implementation from future-only scope.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/SECURITY_MODEL.md`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/backend.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/password.ts`
- `packages/auth/src/session.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/rbac.ts`
- `packages/auth/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/client.ts`
- `packages/db/src/index.ts`
- `packages/db/migrations/*.sql` via targeted search for auth/user/lockout fields
## Files changed
None - read-only audit
## Findings
1. High - Account-specific lockout is correctly documented as target-only and must not be counted as current protection. Evidence: `docs/STATUS.md:10` says account-specific lockout remains not implemented; `docs/SECURITY_MODEL.md:145` marks Layer 2 as target/not yet implemented; `docs/SECURITY_MODEL.md:162` says the columns and admin unlock flow are not present. Recommendation: implement this only in a dedicated backend + DB + security phase with migration and tests, and keep Phase 3.42's IP limiter status unchanged. Target part: auth lockout roadmap/truth.
2. High - The right durable placement is `@wtc/db`, not Edge middleware. Evidence: `apps/web/src/middleware.ts:11` requires Edge-safe imports only; `apps/web/src/middleware.ts:28` says the limiter store is in-process per Edge instance; `apps/web/src/middleware.ts:77` limits only POSTs to `/login` and `/register`; `packages/auth/src/rate-limit.ts:1` defines a pure dependency-free sliding-window helper. Recommendation: leave middleware as IP-only; do not import `@wtc/db`, `@wtc/auth` barrel, Argon2, Drizzle, or config/database clients into `middleware.ts`. Target part: Edge/db boundary.
3. High - Login orchestration currently has the only natural account-lockout decision point, but it delegates to a boolean-style `verifyLogin` with no lockout state update. Evidence: `apps/web/src/app/(auth)/actions.ts:26` calls `verifyLogin(email,password)` and treats null as invalid credentials; `apps/web/src/app/(auth)/actions.ts:28` writes `auth.login_failed` outside the DB login check; `apps/web/src/lib/db-store.ts:78` loads the user and verifies the password but does not mutate counters. Recommendation: replace or wrap `verifyLogin` with a DB-backed login attempt primitive that can atomically check lock state, verify password, update/reset failure fields, and return an account-neutral result for the web action. Target part: web action orchestration.
4. High - Schema/migration boundary is additive on `users`; no current table or migration contains lockout fields. Evidence: `packages/db/src/schema.ts:15` defines `users` with id/email/passwordHash/displayName/createdAt only; `docs/SECURITY_MODEL.md:147` targets `users` fields `failed_login_count`, `failed_login_reset_at`, and `account_locked_until`; targeted search found no `failed_login` or `account_locked` fields under `packages/db`. Recommendation: add a new Drizzle migration with nullable/defaulted user lockout columns, update `schema.ts`, and include generated SQL proof; do not create a side table unless security/db auditors decide review metadata needs append-only history beyond audit logs. Target part: DB migration.
5. Medium - `@wtc/auth` should own pure lockout policy math, not persistence or password verification. Evidence: `packages/auth/src/password.ts:15` owns Argon2 hashing/verify; `packages/auth/src/rate-limit.ts:63` is pure deterministic policy over caller-owned state; `docs/ARCHITECTURE_DECISIONS.md:16` requires domain logic in packages, not app files. Recommendation: add a pure `@wtc/auth` lockout policy module such as `evaluateLoginLockout()` / `nextLoginFailureState()` with explicit `now`, thresholds, and account state input, but keep Drizzle updates in `@wtc/db` and redirect/audit semantics in `apps/web`. Target part: auth package boundary.
6. Medium - Audit writes need to move into the durable login-attempt transaction or be deliberately split with documented semantics. Evidence: existing DB repositories use in-transaction audit patterns such as `packages/db/src/repositories.ts:249` for the DB audit writer and transactional mutations elsewhere; current failed-login audit is written by the web action after a null login result at `apps/web/src/app/(auth)/actions.ts:28`. Recommendation: for DB-backed login lockout, have `@wtc/db` expose a transactional login-attempt repository that writes failure/lockout/unlock audit rows in the same mutation unit, redacting account existence in public responses. Target part: audit consistency.
7. Medium - The dev/demo adapter can mirror semantics only for local UX, but production must fail closed to DB. Evidence: `apps/web/src/lib/backend.ts:20` selects DB when `DATABASE_URL` exists and `apps/web/src/lib/backend.ts:23` denies production without DB; `apps/web/src/lib/demo.ts:42` stores users/sessions in memory and `apps/web/src/lib/demo.ts:204` verifies password without lockout state. Recommendation: add memory lockout behavior only as a non-authoritative dev mirror after DB policy is defined; do not let the memory path become production acceptance evidence. Target part: backend selector/demo adapter.
8. Low - Future-only scope should stay out of the first lockout slice. Evidence: `docs/SECURITY_MODEL.md:159` includes 20-failure admin review and email notification; `docs/SECURITY_MODEL.md:160` includes admin unlock audit; current admin/user schema has no lockout columns or unlock flow. Recommendation: first slice should ship account-neutral temporary lockout for login only, migration, race-safe DB tests, and generic UX; defer email notification, admin review queues, unlock UI, password reset/change/verify-email route lockouts, and production nginx/shared-store proof unless explicitly scoped. Target part: phase scoping.
## Decisions
- Keep `apps/web/src/middleware.ts` as Edge-only IP throttling and document/header middleware. It must not become a DB client or account-lockout engine.
- Put lockout thresholds and state-transition math in a pure `@wtc/auth` submodule with no env, DB, Next, or Argon2 imports.
- Put durable lockout fields and race-safe mutation in `@wtc/db`: schema, migration, repositories, PGlite/real-Postgres-compatible tests, and audit rows where the same transaction changes lockout state.
- Keep `apps/web/src/app/(auth)/actions.ts` as orchestration only: parse form, call backend login-attempt service, set session on success, redirect with stable generic error codes on failure/lockout.
- Treat admin unlock, notification, long-term review workflow, password-reset/change/verify-email route coverage, and production shared-store/nginx verification as future-only unless a later phase explicitly scopes them.
## Risks
- If lockout is implemented in middleware, it will either break Edge bundling by importing Node/DB dependencies or become process-local state that fails distributed credential-stuffing defense.
- If lockout counters are updated outside the password verification transaction, concurrent attempts can undercount failures or clear lockout state incorrectly.
- If the public web action receives account-existence details from the repository, login copy can regress into enumeration leakage despite Phase 3.42's neutral error-code mapping.
- If memory/demo behavior is accepted as evidence, production DB race behavior remains unproven.
- Adding lockout fields to `users` is additive, but backfill/default choices still need DB-auditor review so old rows fail safely without locking every existing user.
## Verification/tests
- Read-only audit only; no product code edited.
- No gates run in this lane.
- NOT RUN: migration generation, DB-backed lockout implementation, PGlite lockout race tests, real-Postgres race proof, Playwright login lockout UX, production nginx/shared-store verification, admin unlock flow.
## Next actions
1. Launch a dedicated backend + DB + security implementation phase for account-specific login lockout.
2. Add a pure `@wtc/auth` lockout policy module with unit tests for threshold/reset/lock-window behavior.
3. Add a DB migration for `users.failed_login_count`, `users.failed_login_reset_at`, and `users.account_locked_until` or a security-approved equivalent.
4. Add an `@wtc/db` transactional login-attempt repository that checks current lockout, verifies password through caller-supplied verification or a clear repository boundary, updates/reset counters, writes audit rows, and returns an account-neutral result.
5. Update `apps/web/src/lib/db-store.ts`, `apps/web/src/lib/demo.ts`, and `apps/web/src/app/(auth)/actions.ts` to consume the new login-attempt contract without changing Edge middleware.
