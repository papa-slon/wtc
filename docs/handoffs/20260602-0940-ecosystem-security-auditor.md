# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.44 / epoch 20260602-0940 security audit before implementing admin account unlock for the DB-backed login lockout slice. Focus areas: admin-only RBAC, CSRF, reason capture, in-transaction `auth.account_unlock` audit, no public credential-state leakage, no plaintext secrets, generic login behavior preservation, and claim boundaries.
## Files inspected
- `AGENTS.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0903-phase-3-43-auth-account-lockout.md`
- `packages/auth/src/rbac.ts`
- `packages/auth/src/login-lockout.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/auth/error-copy.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
## Files changed
None — read-only audit
## Findings
1. HIGH - Admin unlock is specified and reserved, but not implemented in current source. Evidence: `auth.account_unlock` is present in `AUDIT_ACTIONS` at `packages/audit/src/audit.ts:40`-`45`; the RBAC matrix reserves `POST /api/admin/users/:id/unlock` with in-transaction `auth.account_unlock` at `docs/RBAC_MATRIX.md:224`-`233`; the security model explicitly says admin unlock route or panel is still target-only/not run at `docs/SECURITY_MODEL.md:167`-`175`; the admin users page is still read-only and says account suspension changes are unavailable at `apps/web/src/app/admin/users/page.tsx:35`-`47`; targeted source search for unlock/account_unlock under `apps/web/src`, `packages/db/src`, and `tests/integration` found only the reserved audit action plus unrelated marketing copy. Recommendation: implement unlock as a new backend/repository mutation plus admin action or API route; do not claim shipped admin unlock until the route/action, repository state clear, in-transaction audit, UI affordance, and tests all exist. Target part: admin unlock feature boundary.
2. HIGH - Unlock must be admin-only and cannot rely on layout guards or support-read access. Evidence: `assertAdmin()` is documented as mandatory inside every admin-only server action at `packages/auth/src/rbac.ts:89`-`95`; the current admin actions call `requireUser()`, `assertAdmin(actor.roles)`, and then `assertCsrf(formData)` before parsing and mutation at `apps/web/src/features/admin/actions.ts:31`-`39`, `apps/web/src/features/admin/actions.ts:70`-`78`, and `apps/web/src/features/admin/actions.ts:105`-`113`; admin users page render is also gated at `apps/web/src/app/admin/users/page.tsx:7`-`10`; the matrix allows support for read-only admin user views but not unlock at `docs/RBAC_MATRIX.md:226`-`233`. Recommendation: gate unlock inside the mutation handler with `requireUser()` plus `assertAdmin(actor.roles)` before any state change; add denial coverage proving `support`, `teacher`, `user`, and unauthenticated actors cannot unlock; do not count admin layout visibility as authorization. Target part: unlock RBAC.
3. HIGH - Unlock needs explicit CSRF coverage based on the chosen surface. Evidence: the active web CSRF helper derives a session-bound hidden-field token and `assertCsrf(formData)` fails closed on mismatch at `apps/web/src/lib/csrf.tsx:19`-`35`; current admin server actions use that helper before Zod/DB work at `apps/web/src/features/admin/actions.ts:35`-`39` and `apps/web/src/features/admin/actions.ts:74`-`78`; the static CSRF test only scans `'use server'` action files and exempts only login/register at `tests/integration/csrf-coverage.test.ts:5`-`17` and `tests/integration/csrf-coverage.test.ts:27`-`44`. Recommendation: prefer a server action under `apps/web/src/features/admin/actions.ts` so existing CSRF coverage catches it, or, if implementing `POST /api/admin/users/:id/unlock`, add route-handler CSRF verification and tests because the current static scan will not cover route handlers. Target part: CSRF guard and tests.
4. HIGH - The unlock state clear and `auth.account_unlock` audit must be one DB transaction. Evidence: login lockout durable state lives on `users` columns at `packages/db/src/schema.ts:22`-`29`; `attemptUserLogin()` uses a transaction, row lock, lockout check, state update, and failure audit in one path at `packages/db/src/repositories.ts:111`-`174`; the shared `auditRowValues()` builder redacts payloads and maps audit input to the DB row at `packages/db/src/repositories.ts:345`-`365`; the security model says admin overrides including unlock must audit before commit and rollback if audit fails at `docs/SECURITY_MODEL.md:259`-`268`. Recommendation: add a repository primitive like `unlockUserAccount(db, { targetUserId, actorUserId, reason, now })` that row-locks the target user, records minimal pre-clear lockout flags, clears `failed_login_*`, `last_failed_login_at`, `account_locked_until`, and `account_lockout_review_required_at`, and inserts `auth.account_unlock` with actor id/role and reason in the same transaction. Target part: `@wtc/db` unlock repository.
5. MEDIUM - Reason capture needs a stricter explicit schema than current admin action reason examples. Evidence: current grant/revoke/review schemas accept reason strings with `.min(3)` at `apps/web/src/features/admin/schemas.ts:22`-`27`, `apps/web/src/features/admin/schemas.ts:37`-`42`, and `apps/web/src/features/admin/schemas.ts:59`-`64`; the RBAC matrix's admin-action checklist says reason should be non-empty and uses `z.string().min(10)` for grant/revoke at `docs/RBAC_MATRIX.md:291`-`300`; existing grant/revoke repos put the reason in audit and product-access events at `packages/db/src/repositories.ts:256`-`292` and `packages/db/src/repositories.ts:295`-`306`. Recommendation: add an `unlockAccountSchema` with `userId: uuid` and `reason: string.trim().min(10).max(500)`; pass the reason from the validated server-side body only, never from query text or client-supplied actor fields; store it in the unlock audit `after` payload. Target part: unlock input validation and audit reason.
6. HIGH - Public login behavior must remain generic after unlock lands. Evidence: `loginAction()` redirects invalid form to `invalid_form` and all invalid/locked/unknown credential attempts to `invalid_credentials` at `apps/web/src/app/(auth)/actions.ts:23`-`33`; browser copy maps `invalid_credentials` only to "Invalid email or password." at `apps/web/src/features/auth/error-copy.ts:8`-`12`; static tests pin that the auth action delegates to `attemptLogin()` and does not write `auth.login_failed` itself at `tests/integration/auth-error-copy.test.ts:37`-`54`; PGlite lockout tests prove locked accounts deny before password verification and unknown identifiers do not persist raw target ids at `tests/integration/auth-login-lockout-db.test.ts:79`-`97` and `tests/integration/auth-login-lockout-db.test.ts:116`-`127`. Recommendation: unlock implementation must not add public `locked`, `unlocked`, `review_required`, remaining-attempts, or target-email messages to `/login`, registration, middleware 429s, redirects, or query-string error copy. Target part: browser auth flow and error-copy contract.
7. MEDIUM - Admin unlock can show account state only inside admin-only surfaces, and it must not expose password hashes or secret material. Evidence: `users.passwordHash` exists in the DB model at `packages/db/src/schema.ts:18`-`21`; `mapToAdminUserView()` intentionally strips `passwordHash` before admin rendering at `apps/web/src/features/admin/queries.ts:104`-`115`, and `AdminUserView` exposes only id, email, displayName, roles, and createdAt at `apps/web/src/features/admin/types.ts:7`-`17`; audit redaction catches secret-looking keys and PHC/hash/token-looking values at `packages/audit/src/redact.ts:12`-`36` and `packages/audit/src/redact.ts:45`-`78`. Recommendation: if the users page gains lockout status, return only admin-safe booleans or timestamps such as `isLocked`, `lockedUntil`, and `reviewRequired`; never return `passwordHash`, plaintext submitted passwords, session token material, CSRF tokens, raw request headers, or raw exception messages in DTOs, audit, UI, tests, fixtures, or screenshots. Target part: admin users DTO/UI and audit payloads.
8. MEDIUM - Do not over-claim support escalation auditing or production unlock readiness. Evidence: `assertAdmin()` throws `AccessDeniedError` but does not itself write an audit row at `packages/auth/src/rbac.ts:82`-`95`; existing admin server actions call `assertAdmin(actor.roles)` directly at `apps/web/src/features/admin/actions.ts:35`-`39` and related actions; the RBAC matrix says support-user admin-only mutation attempts should write a read-only audit note at `docs/RBAC_MATRIX.md:302`; current status keeps admin unlock, email/review workflow, production rollout, and active real-Postgres lockout race proof as not run at `docs/STATUS.md:16`-`18` and `docs/PRODUCTION_BLOCKERS_CURRENT.md:7`-`10`. Recommendation: unless Phase 3.44 explicitly adds denial-audit coverage, claim only admin-only rejection, not support-escalation audit logging; even after local unlock implementation, keep production rollout, email notification, append-only DB role, and live CI as NOT RUN until observed. Target part: claims, docs, and final report truth.
## Decisions
- Implement unlock in the same architectural lane as Phase 3.43: pure lockout state shape from `@wtc/auth`, durable state and audit mutation in `@wtc/db`, and web admin action as orchestration only.
- The unlock action should clear lockout/review/failure counters but should not alter password hash, roles, sessions, entitlements, or product access.
- Admin UI may show lockout status because it is admin-only; public auth pages must remain credential-state neutral.
- The existing `auth.account_unlock` audit action is sufficient; do not add a new audit code unless the event semantics change.
## Risks
- A non-atomic unlock can clear state without audit, or audit without clearing state, leaving an unreliable security trail.
- A route-handler implementation can bypass the existing server-action CSRF static test unless explicit route CSRF tests are added.
- Different login redirects or copy for locked/unlocked users would reintroduce account-enumeration risk.
- Reusing current short `.min(3)` reason schema would produce weak unlock audit records for a sensitive admin override.
- A broad user row DTO can accidentally surface `passwordHash` or lockout internals beyond the admin-only need.
## Verification/tests
- Static inspection only. No product code was changed and no live server mutation was performed.
- Targeted source searches were run for `account_unlock`, `unlock`, `failedLogin`, `accountLocked`, `attemptUserLogin`, `assertCsrf`, `assertAdmin`, admin actions, audit writers, and lockout tests.
- NOT RUN: `npm test`, `npm run typecheck`, `npm run lint`, Playwright, real-Postgres race tests, production nginx/shared-store proof, live production deploy, CI.
## Next actions
1. Add `unlockAccountSchema` in `apps/web/src/features/admin/schemas.ts` with `userId` UUID and a required admin reason of at least 10 characters.
2. Add `unlockUserAccount()` in `packages/db/src/repositories.ts`: row-lock target user, clear lockout state, and insert `auth.account_unlock` audit in the same transaction.
3. Add `adminUnlockAccountAction()` in `apps/web/src/features/admin/actions.ts` using `requireUser()`, `assertAdmin(actor.roles)`, `assertCsrf(formData)`, Zod parse, repository call, and `revalidatePath('/admin/users')`.
4. Extend the admin users DTO/page to show admin-only lockout state and an unlock form with `CsrfField`; do not add any public auth copy or redirects.
5. Add PGlite tests for state clear, in-transaction audit reason, non-admin denial, CSRF/static coverage, generic login copy preservation, and no password/hash/secret leakage.
6. Run focused tests first, then the standard local gates; keep active real-Postgres race, production rollout, email notification, append-only audit DB role, and CI listed as NOT RUN unless actually observed.
