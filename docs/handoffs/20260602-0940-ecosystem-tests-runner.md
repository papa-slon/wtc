# ecosystem-tests-runner handoff
## Scope
Read-only test strategy audit for Phase 3.44 admin account unlock before implementation. Scope covered existing auth lockout tests, admin/RBAC/static tests, PGlite and real-Postgres harnesses, e2e admin scope, and gate runner expectations. No product code or non-handoff docs were edited.

## Files inspected
- `packages/auth/src/login-lockout.ts`
- `packages/auth/src/login-lockout.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `vitest.config.ts`
- `scripts/gates.mjs`
- `package.json`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`

## Files changed
None — read-only audit

## Findings
1. **HIGH - Repository unlock needs direct PGlite proof, not only UI/static checks.** Evidence: Phase 3.43 lockout tests prove failed-password lockout, locked-account denial, success reset, unknown-account audit minimization, and review marker behavior in `tests/integration/auth-login-lockout-db.test.ts:57-145`; durable lockout state is currently updated only by `attemptUserLogin()` in `packages/db/src/repositories.ts:117-172`. `auth.account_unlock` is only a reserved audit action today (`packages/audit/src/audit.ts:45`, `docs/AUDIT_LOG_SCHEMA.md:176`). Recommendation: add a focused PGlite integration test file or extend `auth-login-lockout-db.test.ts` to cover the new repo primitive, e.g. `unlockUserAccount(db, { targetUserId, actorUserId, reason, now })`: create/lock a user, unlock as admin, assert all failed-login counters and lock/review timestamps are cleared, assert a single `auth.account_unlock` audit row with `actorRole: 'admin'`, `actorUserId`, `targetType: 'user'`, `targetId`, `after.reason`, and non-secret before/after lockout metadata, then assert a correct password login succeeds immediately after unlock. Target part: `@wtc/db` repository and `tests/integration/admin-account-unlock-db.test.ts`.

2. **HIGH - Admin action guardrails must explicitly cover `features/admin/actions.ts`.** Evidence: generic CSRF coverage scans only `apps/web/src/app` (`tests/integration/csrf-coverage.test.ts:10-17`), while admin shared actions live in `apps/web/src/features/admin/actions.ts:1-310`; current feature-action checks are narrow cleanup string assertions (`tests/integration/admin-lms-cleanup-review.test.ts:43-51`). Recommendation: add a static test such as `tests/integration/admin-account-unlock-static.test.ts` that slices `adminUnlockAccountAction` and asserts the current admin-action pipeline: `requireUser()` then `assertAdmin(actor.roles)` then `assertCsrf(formData)` then Zod schema parse then DB repo call then `revalidatePath('/admin/users')`. Also assert the action imports/uses an unlock schema, does not write audit outside the repo, and does not contain password/hash/token/log output. Target part: admin server action guardrail.

3. **HIGH - Unlock reason validation needs schema-level and UI-level tests.** Evidence: existing admin mutation schemas require reasons for grants/revokes/flag-review at `apps/web/src/features/admin/schemas.ts:22-63`, and admin actions consume those parsed reasons at `apps/web/src/features/admin/actions.ts:43-59`, `apps/web/src/features/admin/actions.ts:82-95`, and `apps/web/src/features/admin/actions.ts:151-165`. Recommendation: add `unlockAccountSchema` with `userId: uuid` and `reason: trimmed string min 3 max 500`, then test the schema directly or statically assert it is used by the unlock action. The admin users page should render a required reason control named `reason` only for locked/review-required accounts and submit it with a CSRF field. Target part: `apps/web/src/features/admin/schemas.ts`, `apps/web/src/features/admin/actions.ts`, and `/admin/users` UI.

4. **MEDIUM - Admin user DTO/page must expose only the minimal lockout status needed to render unlock.** Evidence: `AdminUserView` currently exposes `id`, `email`, `displayName`, `roles`, and `createdAt` only (`apps/web/src/features/admin/types.ts:10-17`); `mapToAdminUserView()` strips `passwordHash` and maps only display-safe fields (`apps/web/src/features/admin/queries.ts:105-114`); `/admin/users` is currently read-only (`apps/web/src/app/admin/users/page.tsx:17-18`, `apps/web/src/app/admin/users/page.tsx:43-46`). Recommendation: add static tests that `AdminUserView` includes sanitized lockout fields only, for example `accountLockedUntil`, `accountLockoutReviewRequiredAt`, and perhaps count summaries needed for ops triage, while continuing to exclude `passwordHash`. Add page tests that the user table has lockout/review columns, a per-row unlock form only when unlockable, no "unlock all", and no raw password/hash/session/token strings. Target part: admin loader DTO and `/admin/users` render.

5. **MEDIUM - RBAC coverage should stay split: pure RBAC plus action-pipeline static checks.** Evidence: `admin-ops-rbac.test.ts` proves `assertAdmin` rejects `user`, `teacher`, `support`, and empty roles, and allows admin (`tests/integration/admin-ops-rbac.test.ts:52-74`), but it does not execute Next server actions. Vitest excludes `apps/web/**` (`vitest.config.ts:8-10`), so Next request-context actions are normally covered by source assertions. Recommendation: do not attempt brittle direct execution of `adminUnlockAccountAction` under Vitest. Instead, keep the pure `assertAdmin` tests and add static action-pipeline assertions that the unlock action calls `assertAdmin(actor.roles)` before any repo write. The repository test should not try to prove RBAC; the action static test owns that. Target part: test layering.

6. **MEDIUM - E2E should cover rendering/fitting, not production DB unlock semantics, unless a DB e2e harness is introduced.** Evidence: existing admin mobile e2e logs in the demo admin and covers `/admin/users` at 375px (`tests/e2e/admin-mobile-pg8.spec.ts:20-48`); smoke e2e also visits `/admin/users` in demo mode (`tests/e2e/smoke.spec.ts:168-176`). The PG8 spec explicitly notes that demo mode renders empty states rather than real DB rows (`tests/e2e/admin-mobile-pg8.spec.ts:10-14`). Recommendation: after UI implementation, run the current admin mobile e2e to catch layout regressions. Do not claim browser-level unlock acceptance unless a dedicated DB-backed Playwright harness creates a locked test user and submits the form against a disposable DB. Target part: Playwright acceptance boundary.

7. **MEDIUM - Real-Postgres unlock race should remain opt-in and NOT RUN without credentials.** Evidence: the real-PG harness is guarded by `REAL_POSTGRES_DATABASE_URL` (`tests/integration/db-real-postgres.test.ts:39-70`) and already contains an opt-in cross-connection failed-login serialization test (`tests/integration/db-real-postgres.test.ts:176-206`). Deployment docs state PGlite is not a substitute for real-PG acceptance where cross-connection isolation matters (`docs/DEPLOYMENT.md:281-290`). Recommendation: if unlock implementation uses row locking or must be race-safe against simultaneous failed login attempts, add an opt-in real-PG test for unlock-vs-fail or double-unlock under `describe.skipIf(!run)`. Without operator credentials, report it as NOT RUN, not green. Target part: real-PG acceptance.

8. **LOW - Gate runner already gives the right final sweep shape; focused Phase 3.44 tests should be run before the full gate.** Evidence: `scripts/gates.mjs` defines `full` as governance, check:core, lint, root typecheck, web typecheck, secret scan, Vitest, db:generate, and web build (`scripts/gates.mjs:49-51`), while e2e is intentionally separate (`scripts/gates.mjs:44-47`, `scripts/gates.mjs:52-53`). Recommendation: run focused unlock tests first, then `node scripts/gates.mjs full`, then `node scripts/gates.mjs e2e`. Target part: verification sequence.

## Decisions
1. Treat repository unlock correctness as the primary acceptance proof: durable reset plus in-transaction audit must pass in PGlite.
2. Treat admin action RBAC/CSRF/reason validation as static source coverage because Next server actions depend on request context and current Vitest intentionally excludes `apps/web/**`.
3. Treat Playwright as a layout/navigation regression gate for `/admin/users`, not as DB unlock proof, unless a separate disposable-DB e2e harness is added.
4. Keep real-Postgres concurrency acceptance opt-in; do not block local Phase 3.44 completion on missing credentials, but list it as NOT RUN.

## Risks
1. A repo-only unlock function can be correct while the admin action accidentally omits CSRF/RBAC; mitigate with a dedicated static action-body test.
2. A UI-only unlock button can appear for every user and create an operator footgun; mitigate with static page assertions for locked/review-required-only rendering and no bulk unlock.
3. PGlite can prove migration/repo semantics but not true cross-connection races; mitigate with an optional `REAL_POSTGRES_DATABASE_URL` test and explicit NOT RUN reporting.
4. If the implementation writes audit in the web action instead of inside the DB transaction, unlock could commit without audit on partial failure; the PGlite test must inspect one atomic repo call and audit row.

## Verification/tests
Recommended focused tests after implementation:

```powershell
npm test -- packages/auth/src/login-lockout.test.ts tests/integration/auth-login-lockout-db.test.ts tests/integration/admin-account-unlock-db.test.ts tests/integration/admin-account-unlock-static.test.ts tests/integration/admin-ops-rbac.test.ts tests/integration/admin-responsive.test.ts
```

Recommended full local gates:

```powershell
npm run check:core
npm run typecheck
npm run typecheck -w @wtc/web
npm run lint
npm run db:generate -w @wtc/db
node scripts/gates.mjs full
node scripts/gates.mjs e2e
npm run secret:scan
npm run governance:check
```

Opt-in only, NOT RUN without operator credentials:

```powershell
$env:REAL_POSTGRES_DATABASE_URL = "postgres://<credentials>@127.0.0.1:5432/wtc_test"
npm test -- tests/integration/db-real-postgres.test.ts
```

Tests run during this audit: none. This was a read-only strategy pass using file inspection only.

## Next actions
1. Implement `unlockUserAccount` or equivalent in `@wtc/db` with in-transaction `auth.account_unlock` audit and lockout-state reset.
2. Add `admin-account-unlock-db.test.ts` for locked-user unlock, audit reason, unknown/unlocked edge behavior, and login-after-unlock.
3. Add `unlockAccountSchema`, `adminUnlockAccountAction`, and `admin-account-unlock-static.test.ts` for RBAC/CSRF/schema/revalidate/no-leak guardrails.
4. Extend admin users DTO/page with minimal lockout status and per-locked-user unlock form; add static UI assertions and run existing admin mobile e2e.
5. Report real-PG unlock/concurrency proof as NOT RUN unless `REAL_POSTGRES_DATABASE_URL` is provided.
