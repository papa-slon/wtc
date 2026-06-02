# Phase 3.44 Admin account unlock handoff
## Scope
Implement the next local auth-hardening slice: an admin-only, CSRF-protected account unlock for the DB-backed login lockout
state from Phase 3.43. The slice clears failed-login, lockout, and review state only through a DB transaction that also writes
`auth.account_unlock`, exposes only admin-safe lockout state on `/admin/users`, and preserves generic public login copy. This
phase did not mutate live servers, preview services, production databases, bot services, Stripe, Axioma, LMS object stores,
scanner endpoints, nginx, or systemd. The workspace is not currently git-backed (`git status` reports `fatal: not a git
repository`), so no commit/PR was created.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0940-ecosystem-security-auditor.md](20260602-0940-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0940-ecosystem-db-architect.md](20260602-0940-ecosystem-db-architect.md)
- [docs/handoffs/20260602-0940-ecosystem-backend-implementer.md](20260602-0940-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0940-ecosystem-platform-architect.md](20260602-0940-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0940-ecosystem-frontend-implementer.md](20260602-0940-ecosystem-frontend-implementer.md)
- [docs/handoffs/20260602-0940-ecosystem-tests-runner.md](20260602-0940-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0940-ecosystem-devops-implementer.md](20260602-0940-ecosystem-devops-implementer.md)

All seven background agents completed and were closed after their handoffs were collected.
## Files inspected
- `packages/auth/src/login-lockout.ts`
- `packages/auth/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/features/auth/error-copy.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
## Files changed
- `packages/auth/src/login-lockout.ts`
- `packages/auth/src/login-lockout.test.ts`
- `packages/auth/src/index.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `tests/integration/admin-account-unlock-db.test.ts`
- `tests/integration/admin-account-unlock-static.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- this aggregate handoff.
## Findings
1. High - Admin unlock was the next local blocker after Phase 3.43 account lockout. Implemented:
   `unlockUserLoginLockout()` row-locks the target user, clears every failed-login counter/reset timestamp, clears
   `last_failed_login_at`, `account_locked_until`, and `account_lockout_review_required_at`, then writes
   `auth.account_unlock` in the same transaction. Target part: auth DB mutation.
2. High - Unlock had to remain an admin-only mutation rather than a layout-only affordance. Implemented:
   `adminUnlockAccountAction()` runs `requireUser()`, `assertAdmin(actor.roles)`, `assertCsrf(formData)`, and
   `unlockAccountSchema.safeParse` before any DB call, then revalidates `/admin/users` and `/admin/audit-log`. Target part:
   admin server action.
3. High - Public auth behavior must not disclose locked or unlocked account state. Implemented: `/login` copy and redirects
   were not changed, and static tests assert no public locked/unlocked/review/remaining-attempt copy was introduced. Target
   part: public auth UX.
4. Medium - Admin user rows needed lockout visibility without leaking password hashes or raw user rows. Implemented:
   `listUsersWithCreatedAt()` projects safe lockout fields, `mapToAdminUserView()` still strips `passwordHash`, and
   `/admin/users` renders only account state, total failed count, last failed timestamp, and a per-user unlock form when
   unlockable. Target part: admin DTO and UI.
5. Medium - Basic admin unlock needs no schema migration. Verified: `npm run db:generate -w @wtc/db` reports 43 tables and no
   schema changes. Target part: schema/migrations.
6. Medium - True cross-connection unlock race proof remains opt-in. Implemented: `tests/integration/db-real-postgres.test.ts`
   includes an unlock race case, but it is skipped unless `REAL_POSTGRES_DATABASE_URL` is set to a throwaway real-Postgres DB.
   Target part: production-grade DB proof.
## Decisions
- Keep the lockout reset state in pure `@wtc/auth`; keep durable mutation and audit in `@wtc/db`; keep the web action as
  orchestration only.
- Clear all active lockout/review/failure fields on admin unlock. Historical failure accounting remains in audit rows rather
  than active user columns.
- Require a 10-500 character admin reason for unlock and include it only in the safe audit payload after validation/redaction.
- Render unlock controls only on the existing admin users page; do not add a public unlock code, banner, route, or email flow
  in this phase.
- Do not add a migration because Phase 3.43 already added all required durable lockout columns.
## Risks
- Active real-Postgres unlock concurrency proof was not run because no `REAL_POSTGRES_DATABASE_URL` was supplied.
- Email notification and review workflow for 20-failure accounts are still not implemented.
- Production nginx/shared-store rate-limiting, trusted proxy header normalization, production DB rollout, live deploy,
  append-only audit DB role verification, and GitHub CI are still not run.
- Demo/in-memory mode can display the admin users page, but the unlock mutation requires DB mode because the local production
  hardening target is DB-backed account state.
## Verification/tests
- Focused admin-unlock/auth Vitest:
  `npm test -- packages/auth/src/login-lockout.test.ts tests/integration/auth-login-lockout-db.test.ts tests/integration/admin-account-unlock-db.test.ts tests/integration/admin-account-unlock-static.test.ts tests/integration/admin-ops-rbac.test.ts tests/integration/admin-responsive.test.ts tests/integration/auth-error-copy.test.ts tests/integration/db-real-postgres.test.ts` - PASS (`82` passed / `9` skipped).
- `npm run check:core` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema drift.
- `node scripts/gates.mjs full` - PASS (9/9 gates).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- `npm run worker:smoke` - PASS.
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers, `2`
  missing roots, `70` total artifact files, `0` dynamic markers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (current phase `20260602-0940`, 7 cited per-agent handoffs all present, 0 errors
  / 1 known historical warning).
- NOT RUN: active `REAL_POSTGRES_DATABASE_URL` admin-unlock race gate, production nginx/shared-store throttling proof,
  production DB rollout/live deploy, email notification/review workflow, password reset/change/verify-email route lockout,
  registration audit event or explicit long-term deferral, append-only audit DB role verification, GitHub Actions CI, live
  server mutation, live bot mutation, Stripe live/test-provider acceptance, Axioma live acceptance, LMS live object-store or
  scanner acceptance.
## Next actions
1. Run `REAL_POSTGRES_DATABASE_URL=postgres://.../wtc_test_<suffix> npm test -- tests/integration/db-real-postgres.test.ts`
   against a fresh throwaway real-Postgres database to activate the account-lockout and admin-unlock race proof.
2. Add email or in-app notification plus a review workflow for accounts that hit the 20-failure review marker.
3. Add registration audit logging or keep the explicit deferral in current docs.
4. Verify production nginx/shared-store auth throttling and trusted proxy header normalization only with explicit operator
   approval and redacted evidence.
5. Prove append-only audit DB role permissions, production DB rollout, live deploy, and GitHub CI in separate phases.
