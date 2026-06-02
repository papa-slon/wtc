# ecosystem-backend-implementer handoff
## Scope
Read-only backend lane for Phase 3.43 / epoch 20260602-0903. Audit the current backend auth flow for the smallest safe implementation of DB-backed, account-specific login lockout without rewriting unrelated auth. Focus areas: `verifyLogin` integration point, generic return states, audit write location, demo parity, registration explicitly out of scope except for future audit, and exact tests required.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/session.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/auth/src/password.ts`
- `packages/auth/src/session.ts`
- `packages/auth/src/rate-limit.ts`
- `packages/audit/src/audit.ts`
- `packages/shared/src/errors.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/db-persistence.test.ts`

## Files changed
None - read-only audit, except this required handoff file.

## Findings
1. Severity: High. Evidence: Phase 3.42 explicitly did not implement DB-backed account lockout and left it as a future backend + DB + security phase at `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:6` and `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:90`; `docs/STATUS.md:19` to `docs/STATUS.md:20` still lists DB-backed account-specific login lockout as not production-ready. The DB `users` identity row only has `id`, `email`, `passwordHash`, `displayName`, and `createdAt` at `packages/db/src/schema.ts:15` to `packages/db/src/schema.ts:24`. Recommendation: add a migration for persistent account-lockout state before claiming account lockout is shipped. Target part: DB-backed account lockout persistence.
2. Severity: High. Evidence: the current auth integration point is `loginAction` calling `verifyLogin(email, password)` and treating any falsy result as `invalid_credentials` at `apps/web/src/app/(auth)/actions.ts:23` to `apps/web/src/app/(auth)/actions.ts:30`; the backend selector exports `verifyLogin` as the stable core auth boundary at `apps/web/src/lib/backend.ts:49` to `apps/web/src/lib/backend.ts:55`; the DB adapter currently only loads a user and verifies the Argon2 password at `apps/web/src/lib/db-store.ts:78` to `apps/web/src/lib/db-store.ts:82`. Recommendation: keep the public browser response generic, but widen the internal `verifyLogin` result from `DemoUser | null` to a small discriminated state such as `success | invalid | locked` so the action can keep neutral redirects while tests can assert lockout semantics. Target part: `verifyLogin` contract and login action wiring.
3. Severity: High. Evidence: failed-login audit currently happens in the server action after `verifyLogin` returns null at `apps/web/src/app/(auth)/actions.ts:26` to `apps/web/src/app/(auth)/actions.ts:29`; the DB audit writer persists `audit_logs` through `createDbAuditWriter(db()).write(input)` at `apps/web/src/lib/db-store.ts:60` to `apps/web/src/lib/db-store.ts:64`; transaction-local audit insert patterns already exist in DB repositories, for example entitlement grant/revoke at `packages/db/src/repositories.ts:138` to `packages/db/src/repositories.ts:174`. Recommendation: for DB-backed failed attempts, write the attempt counter/lockout update and `auth.login_failed` audit row in one repository transaction; do not leave state mutation in `@wtc/db` and failure audit in the server action as two separate writes. Keep `auth.login` success audit in `loginAction` after session creation, but reset lockout state inside the DB verification path before returning success. Target part: audit/state atomicity.
4. Severity: Medium. Evidence: the in-memory demo backend has the same binary `verifyLogin` shape and no lockout state at `apps/web/src/lib/demo.ts:204` to `apps/web/src/lib/demo.ts:208`; dev memory mode is selected whenever `DATABASE_URL` is absent at `apps/web/src/lib/backend.ts:20` to `apps/web/src/lib/backend.ts:24`. Recommendation: add in-memory parity for failed count, reset window, locked-until, and success reset, or document an explicit demo-only no-lockout exception and ensure UI/storage badges do not imply account lockout in memory mode. Prefer parity because auth e2e helpers and local smoke flows commonly run without Postgres. Target part: demo parity.
5. Severity: Medium. Evidence: `packages/auth/src/rate-limit.ts:1` to `packages/auth/src/rate-limit.ts:12` is intentionally Edge-safe and owns the current IP sliding-window limiter, while password verification is Node/native Argon2 at `packages/auth/src/password.ts:1` to `packages/auth/src/password.ts:24`. Recommendation: do not fold account lockout into the Edge limiter. Add a separate Node-safe pure helper such as `packages/auth/src/login-lockout.ts` for policy math and keep DB mutation in `@wtc/db` / `apps/web/src/lib/db-store.ts`. Target part: package boundary.
6. Severity: Medium. Evidence: `AUDIT_ACTIONS` already includes `auth.login`, `auth.login_failed`, and `auth.account_unlock` at `packages/audit/src/audit.ts:8` to `packages/audit/src/audit.ts:46`, but there is no explicit `auth.account_locked` action code. Recommendation: either record lockout transitions as `auth.login_failed` with non-secret `after.reason: 'locked' | 'threshold_reached'` and `result: 'failure'`, or add new reserved audit codes in the same phase with audit tests and docs updates. Avoid adding raw password, user-agent-derived secrets, or per-attempt internal counters to user-facing responses. Target part: audit action vocabulary.
7. Severity: Low. Evidence: `registerAction` currently creates a user/session and redirects with generic `temporary` on any creation failure at `apps/web/src/app/(auth)/actions.ts:36` to `apps/web/src/app/(auth)/actions.ts:52`; Phase 3.42 separately kept registration audit as a future item at `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:98` and `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:118`. Recommendation: do not include register audit or duplicate-email behavior changes in the account-lockout slice except to keep shared auth error-copy tests passing; schedule registration audit as a separate future audit. Target part: scope control.

## Decisions
- The smallest safe implementation boundary is `verifyLogin`, not a rewrite of custom session auth, cookies, CSRF, or the Edge IP limiter.
- Browser-facing login failure must remain generic. Both bad password, missing account, and locked account should redirect to a safe allowlisted code and copy path; any distinction belongs only in internal result state, DB rows, and audit metadata.
- DB lockout state should be updated atomically with failure audit. A race-safe repository helper should own failed-count increment, reset-window handling, lockout timestamp setting, and success reset.
- Demo parity should be maintained unless the implementation phase explicitly accepts and documents a memory-mode exception.
- Registration is out of scope for Phase 3.43 except as a future audit item.

## Risks
- If `verifyLogin` remains binary, implementation code will either leak lockout state into browser redirects or make lockout behavior hard to test without reading DB internals.
- If failed-attempt state and `auth.login_failed` audit stay split across repository and server action, DB failures or redirects can create state/audit mismatch.
- If account lockout is implemented only in the DB adapter, local memory-mode auth can continue to behave differently and produce misleading acceptance confidence.
- If nonexistent emails are persisted in a lockout table keyed by raw email, the implementation may create an account-enumeration and PII-retention surface. Prefer existing-user keyed state, with generic handling for unknown emails.
- Multi-instance production still needs the separate nginx/shared-store IP throttling and trusted-proxy proof from Phase 3.42; account lockout does not replace that layer.

## Verification/tests
- Add `packages/auth/src/login-lockout.test.ts`: deterministic pure tests for threshold `5` failures, `15 min` reset window, `15 min` lockout duration, no perpetual extension on blocked attempts unless deliberately specified, and success reset policy.
- Add `tests/integration/auth-login-lockout.test.ts` or extend DB integration coverage with PGlite: seed user, wrong password increments account state, fifth wrong password sets locked-until, correct password during lock returns locked internal state and no session, correct password after expiry succeeds and clears failed state, nonexistent email returns the same generic invalid state and does not create a user-scoped lockout row.
- Add a race test around concurrent wrong-password attempts for one user: final failed count/locked-until must be deterministic enough to fail closed, with no lost update that lets more than threshold attempts through.
- Add audit integration assertions: failed attempt writes `auth.login_failed`; threshold/locked attempt writes either `auth.login_failed` with safe reason metadata or the newly added lockout audit code; success reset does not leak password or raw token; admin unlock, if implemented in the same slice, writes `auth.account_unlock`.
- Add server-action/static auth-copy assertions: `loginAction` still redirects with allowlisted generic codes only; locked accounts do not render account-specific copy; existing `tests/integration/auth-error-copy.test.ts` remains green.
- Add demo parity tests if memory mode implements lockout, or an explicit static/docs test proving memory mode is labelled as no-lockout if that exception is accepted.
- Required gates for implementation phase: focused auth/DB Vitest, `npm run db:generate -w @wtc/db`, `npm run check:core`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `node scripts/gates.mjs full`, `npm run secret:scan`, and `npm run governance:check`. Real-Postgres race proof remains desirable but may be NOT RUN if credentials are still unavailable; if skipped, report it explicitly.

## Next actions
1. Implement the backend-owned lockout slice with a migration, a pure policy helper, repository transaction helpers, widened internal `verifyLogin` state, and generic action redirects.
2. Keep `packages/auth/src/rate-limit.ts` and `apps/web/src/middleware.ts` stable except for tests proving the existing IP limiter still behaves.
3. Defer registration audit to a separate backend/security audit after account lockout lands.
