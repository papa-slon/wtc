# ecosystem-backend-implementer handoff
## Scope
Read-only Phase 3.44 / epoch 20260602-0940 backend audit before implementing admin account unlock for the DB-backed login lockout slice. Inspected backend selectors, admin feature patterns, server actions, auth/session/CSRF helpers, audit patterns, repositories, current lockout tests, and status docs. No product code or docs were edited except this handoff.
## Files inspected
- `AGENTS.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/handoffs/20260602-0903-phase-3-43-auth-account-lockout.md`
- `packages/auth/src/rbac.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `apps/web/src/app/admin/support/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/tv/actions.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
## Files changed
None — read-only audit
## Findings
1. HIGH - Admin unlock is still target-only, but the required backend contract is already named by docs and audit codes. Evidence: `docs/SECURITY_MODEL.md:174` says admin unlock route/panel is still target-only/not run; `docs/RBAC_MATRIX.md:233` specifies `POST /api/admin/users/:id/unlock` as admin-only with in-transaction `auth.account_unlock`; `packages/audit/src/audit.ts:40`-`packages/audit/src/audit.ts:46` already reserves `auth.account_unlock`. Recommendation: implement the smallest current-app shape as an admin server action plus DB repository primitive, not a broad auth refactor: `adminUnlockAccountAction(formData)` delegates to `unlockUserLoginLockout(db, { userId, actorUserId, reason, now })`. Target part: backend unlock service/action.
2. HIGH - The unlock primitive must clear the full login-lockout state in the same transaction as the audit row. Evidence: durable lockout state spans eight `users` columns at `packages/db/src/schema.ts:22`-`packages/db/src/schema.ts:29`; `attemptUserLogin()` reads all of them through `lockoutStateFromUser()` at `packages/db/src/repositories.ts:85`-`packages/db/src/repositories.ts:95`; failed login updates all lockout fields at `packages/db/src/repositories.ts:150`-`packages/db/src/repositories.ts:166`; success resets them with `nextLoginSuccessState()` at `packages/db/src/repositories.ts:145`-`packages/db/src/repositories.ts:147`. Recommendation: the repository should row-lock the target user, capture minimal `before` lockout state, set `failedLogin15mCount`, `failedLogin60mCount`, and `failedLoginTotalCount` to `0`, set all lockout timestamps/review markers to `null`, then insert one `auth.account_unlock` audit row in the same transaction. Target part: `@wtc/db` repository.
3. HIGH - Admin actor enforcement should use the existing admin action guard stack and must not rely on layout-only protection. Evidence: admin actions currently follow `requireUser() -> assertAdmin() -> assertCsrf() -> Zod -> repo -> revalidatePath` in the file header and implementations at `apps/web/src/features/admin/actions.ts:3`-`apps/web/src/features/admin/actions.ts:8`, `apps/web/src/features/admin/actions.ts:35`-`apps/web/src/features/admin/actions.ts:39`, and `apps/web/src/features/admin/actions.ts:74`-`apps/web/src/features/admin/actions.ts:78`; `assertAdmin()` itself rejects non-admin roles at `packages/auth/src/rbac.ts:89`-`packages/auth/src/rbac.ts:94`; page/layout gates exist at `apps/web/src/app/admin/layout.tsx:12`-`apps/web/src/app/admin/layout.tsx:16` but direct server-action posts still need action-level checks. Recommendation: keep unlock in `apps/web/src/features/admin/actions.ts` with action-level `requireUser`, `assertAdmin(actor.roles)`, `assertCsrf(formData)`, and Zod validation before calling the repository. Target part: server action RBAC/CSRF.
4. MEDIUM - The current CSRF guard is present and session-bound, but coverage is mostly static. Evidence: `assertCsrf()` derives the token from the current session cookie and throws on mismatch at `apps/web/src/lib/csrf.tsx:30`-`apps/web/src/lib/csrf.tsx:35`; every authenticated server-action file is statically checked for `assertCsrf()` in `tests/integration/csrf-coverage.test.ts:27`-`tests/integration/csrf-coverage.test.ts:36`; current admin actions call `assertCsrf(formData)` after the admin guard. Recommendation: add unlock to the same static CSRF coverage and add one focused static test that the unlock action contains `assertAdmin(actor.roles)`, `assertCsrf(formData)`, `unlockUserLoginLockout`, and `revalidatePath('/admin/users')`. Do not create a route handler unless it has an equivalent header/form CSRF guard. Target part: CSRF and static tests.
5. MEDIUM - `/admin/users` cannot currently render a precise unlock control because the safe admin user DTO omits lockout fields and the page is read-only. Evidence: `AdminUserView` exposes only `id`, `email`, `displayName`, `roles`, and `createdAt` at `apps/web/src/features/admin/types.ts:10`-`apps/web/src/features/admin/types.ts:17`; `mapToAdminUserView()` intentionally strips `passwordHash` at `apps/web/src/features/admin/queries.ts:104`-`apps/web/src/features/admin/queries.ts:115`; `/admin/users` explicitly says role assignment/account suspension are unavailable and renders no mutation form at `apps/web/src/app/admin/users/page.tsx:35`-`apps/web/src/app/admin/users/page.tsx:47`. Recommendation: extend the admin DTO with display-safe lockout fields only, such as `accountLockedUntil`, `accountLockoutReviewRequiredAt`, and optionally failed counts, while continuing to strip `passwordHash`; render the unlock form on `/admin/users` only for locked/review-required users. Target part: admin selectors and users page backend data shape.
6. MEDIUM - Reason validation should be explicit and stricter than a free-form hidden input. Evidence: existing admin schemas require trimmed reasons for grant/revoke/flag review with min 3/max 500 at `apps/web/src/features/admin/schemas.ts:22`-`apps/web/src/features/admin/schemas.ts:42` and `apps/web/src/features/admin/schemas.ts:59`-`apps/web/src/features/admin/schemas.ts:64`; RBAC docs still describe entitlement reasons as min 10 at `docs/RBAC_MATRIX.md:235`-`docs/RBAC_MATRIX.md:236`, showing validation policy drift. Recommendation: add `unlockAccountSchema = z.object({ userId: z.string().uuid(), reason: z.string().trim().min(10).max(500) })` or deliberately align with the current min-3 admin convention, then keep the UI `required`, `minLength`, and `maxLength` in sync. Prefer min 10 for unlock because it is a security override. Target part: admin schema/action validation.
7. MEDIUM - Revalidate behavior should stay local and predictable. Evidence: current admin mutations use `revalidatePath('/admin/entitlements')`, `revalidatePath('/admin/support')`, or both review paths after successful repository calls at `apps/web/src/features/admin/actions.ts:65`, `apps/web/src/features/admin/actions.ts:100`, `apps/web/src/features/admin/actions.ts:133`, and `apps/web/src/features/admin/actions.ts:218`-`apps/web/src/features/admin/actions.ts:220`; TV admin actions revalidate their own admin page at `apps/web/src/features/tv/actions.ts:118` and `apps/web/src/features/tv/actions.ts:152`. Recommendation: after unlock, call `revalidatePath('/admin/users')` and `revalidatePath('/admin/audit-log')`. Avoid adding a public redirect code or changing `/login`; public login must remain the generic `invalid_credentials` path from `apps/web/src/app/(auth)/actions.ts:26`-`apps/web/src/app/(auth)/actions.ts:29`. Target part: route refresh/public UX isolation.
8. MEDIUM - Demo-mode parity is not currently available for admin unlock even though demo-mode lockout state exists. Evidence: backend selection uses DB when `DATABASE_URL` is set and in-memory `demo.ts` otherwise at `apps/web/src/lib/backend.ts:20`-`apps/web/src/lib/backend.ts:24`; in-memory login lockouts are stored in `loginLockouts` at `apps/web/src/lib/demo.ts:57`-`apps/web/src/lib/demo.ts:61` and updated on failed attempts at `apps/web/src/lib/demo.ts:241`-`apps/web/src/lib/demo.ts:284`; current admin actions either call DB repositories directly or no-op/fallback in demo mode at `apps/web/src/features/admin/actions.ts:56`-`apps/web/src/features/admin/actions.ts:63` and `apps/web/src/features/admin/actions.ts:126`-`apps/web/src/features/admin/actions.ts:129`. Recommendation: either add a memory `unlockLoginLockout(userId, actorId, reason)` helper and export it through `backend.ts`, or make the UI honestly disabled/no-op in demo mode. For local development, memory parity is preferable. Target part: backend selector and demo adapter.
9. MEDIUM - Acceptance needs both repository behavior tests and action/static tests; existing lockout tests do not cover admin unlock. Evidence: PGlite lockout coverage proves failure thresholds, locked-account denial, success reset, unknown-account audit neutrality, and review marker at `tests/integration/auth-login-lockout-db.test.ts:57`-`tests/integration/auth-login-lockout-db.test.ts:146`; the opt-in real-Postgres harness already has a cross-connection failed-login race test at `tests/integration/db-real-postgres.test.ts:176`-`tests/integration/db-real-postgres.test.ts:210`; auth-copy tests pin generic public login redirects at `tests/integration/auth-error-copy.test.ts:37`-`tests/integration/auth-error-copy.test.ts:54`. Recommendation: add PGlite tests that lock a user, call `unlockUserLoginLockout`, assert all lockout fields clear, assert one `auth.account_unlock` row with admin actor and reason, assert missing user fails without audit success, and assert a post-unlock correct login succeeds. Add static action tests for RBAC/CSRF/revalidate and safe DTO stripping. Add an opt-in real-Postgres unlock-vs-failed-attempt race only if the repository uses row locking. Target part: tests.
## Decisions
- Use the existing Next server-action admin pattern for the first implementation. The REST-like `POST /api/admin/users/:id/unlock` in docs can be represented by a server action in this App Router codebase unless a later phase creates real `/api/admin/*` route handlers.
- Keep business mutation in `@wtc/db`; keep `apps/web/src/features/admin/actions.ts` as orchestration only; keep `/admin/users` as the natural UI host.
- Use `auth.account_unlock` for the audit action. Suggested audit shape: `actorUserId = admin id`, `actorRole = 'admin'`, `targetType = 'user'`, `targetId = unlocked user id`, `before = { accountLockedUntil, accountLockoutReviewRequiredAt, failedLogin15mCount, failedLogin60mCount, failedLoginTotalCount }`, `after = { unlocked: true, reason }`, `result = 'success'`.
- Do not add a new public auth error code, banner, or redirect for locked/unlocked state. `/login` remains generic.
- Support role must not unlock accounts. Existing docs allow support to read admin users, but `assertAdmin()` is the correct mutation guard.
## Risks
- A non-transactional unlock could race with failed-login attempts and either lose a counter increment or silently re-lock after the admin sees success. Use row lock or a conditional update inside one transaction.
- Clearing total failure count removes an operational signal. If security wants historical failure count preserved, add a separate append-only audit/reporting field in a later phase; do not leave active lockout fields partially uncleared.
- If lockout fields are added to `AdminUserView` by returning raw repository rows, password hashes can leak. Keep explicit DTO projection.
- Demo no-op behavior would confuse local operators because Phase 3.43 lockout works in memory mode. Prefer memory parity or an explicitly disabled UI state.
- Real-Postgres race coverage remains opt-in without `REAL_POSTGRES_DATABASE_URL`.
## Verification/tests
- Read-only only; no test suite was run.
- Verified current workspace is not git-backed: `git status --short` returned `fatal: not a git repository`.
- Used targeted `rg` searches for `attemptUserLogin`, `auth.account_unlock`, `accountLockedUntil`, `failedLogin`, `assertAdmin`, `assertCsrf`, `revalidatePath`, `AdminUserView`, and `unlock`.
- Inspected current source files listed above with line-numbered reads.
## Next actions
1. Add `unlockUserLoginLockout` to `packages/db/src/repositories.ts` using one transaction, row lock, complete lockout-state clear, and in-transaction `auth.account_unlock` audit.
2. Add `unlockAccountSchema` to `apps/web/src/features/admin/schemas.ts`.
3. Add `adminUnlockAccountAction` to `apps/web/src/features/admin/actions.ts` with action-level `requireUser`, `assertAdmin`, `assertCsrf`, Zod validation, repository call, and `revalidatePath('/admin/users')` plus `revalidatePath('/admin/audit-log')`.
4. Extend `listUsersWithCreatedAt`/`loadAdminUsers` and `AdminUserView` with safe lockout display fields while still stripping `passwordHash`.
5. Render the unlock form on `/admin/users` with `CsrfField`, target user ID, required reason, and no public login-state disclosure.
6. Add PGlite repository tests, static admin action/CSRF tests, and update the opt-in real-Postgres race harness only if the implementation introduces unlock-vs-login concurrency semantics.
