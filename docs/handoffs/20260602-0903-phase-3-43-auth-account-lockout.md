# Phase 3.43 Auth account-lockout handoff
## Scope
Implement the next local auth-hardening slice: DB-backed, account-specific login lockout for `/login`, with generic browser
responses, durable failed-login state, reset-on-success, safe audit rows, PGlite coverage, and an opt-in real-Postgres race
gate. This phase did not mutate live servers, preview services, production databases, bot services, Stripe, Axioma, LMS object
stores, scanner endpoints, nginx, or systemd. The workspace is not currently git-backed (`git status` reports `fatal: not a
git repository`), so no commit/PR was created.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0903-ecosystem-security-auditor.md](20260602-0903-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0903-ecosystem-db-architect.md](20260602-0903-ecosystem-db-architect.md)
- [docs/handoffs/20260602-0903-ecosystem-backend-implementer.md](20260602-0903-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0903-ecosystem-platform-architect.md](20260602-0903-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0903-ecosystem-frontend-implementer.md](20260602-0903-ecosystem-frontend-implementer.md)
- [docs/handoffs/20260602-0903-ecosystem-tests-runner.md](20260602-0903-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0903-ecosystem-devops-implementer.md](20260602-0903-ecosystem-devops-implementer.md)

All seven background agents completed and were closed after their handoffs were collected.
## Files inspected
- `packages/auth/src/index.ts`
- `packages/auth/src/__smoke__.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/index.ts`
- `packages/db/migrations/meta/_journal.json`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `docs/SECURITY_MODEL.md`
- `docs/SITEMAP.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
## Files changed
- `packages/auth/src/login-lockout.ts`
- `packages/auth/src/login-lockout.test.ts`
- `packages/auth/src/index.ts`
- `packages/auth/src/__smoke__.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0016_colorful_lyja.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/meta/0016_snapshot.json`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `tests/integration/auth-login-lockout-db.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `docs/SECURITY_MODEL.md`
- `docs/SITEMAP.md`
- `docs/RBAC_MATRIX.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- this aggregate handoff.
## Findings
1. High - DB-backed account-specific login lockout was the next local auth hardening gap. Implemented: `users` now has
   durable 15-minute, 60-minute, total, last-failed, locked-until, and review-required fields; migration
   `0016_colorful_lyja.sql` is additive; `npm run db:generate -w @wtc/db` reports no drift after generation. Target part:
   auth DB persistence.
2. High - Login decisioning previously lived as a credential helper plus action-level failure audit. Implemented:
   `attemptUserLogin()` owns the durable login attempt transaction, row-locks the account, checks lockout before password
   verification, increments failed counters, resets state on success, and writes failure/locked audit rows in the backend/DB
   path. Target part: backend auth service.
3. High - Browser-facing lockout must not disclose whether an account exists, is locked, or how many attempts remain.
   Implemented: `loginAction()` delegates to `attemptLogin()` and redirects invalid, unknown, and locked outcomes to the same
   `invalid_credentials` code. The static auth-copy test now asserts the action no longer writes `auth.login_failed` itself.
   Target part: public auth UX.
4. Medium - Unknown-account audit rows previously risked treating submitted email as a user target. Implemented:
   unknown-account failure rows use `targetType: 'auth_login_identifier'`, `targetId: null`, and safe result metadata; PGlite
   tests assert the raw identifier is not persisted in target fields. Target part: audit shape.
5. Medium - PGlite can prove deterministic state transitions but not true cross-connection race behavior. Implemented:
   default PGlite lockout tests plus an opt-in `REAL_POSTGRES_DATABASE_URL` real-Postgres race test using five independent
   connections. Target part: verification strategy.
6. Medium - Memory mode needed honest parity without becoming production evidence. Implemented: `apps/web/src/lib/demo.ts`
   mirrors the lockout states/results/audit shape for local no-DB development; production selection still fails closed without
   `DATABASE_URL`. Target part: dev/demo adapter parity.
## Decisions
- Keep lockout threshold math in pure `@wtc/auth`; keep durable mutation and failure audit in `@wtc/db`; keep the web action
  as orchestration only.
- Use the existing `auth.login_failed` action for bad-password, unknown-account, and locked-account failure rows; do not add a
  new audit action in this phase.
- Preserve generic browser copy for locked accounts instead of adding a distinct public "locked" code.
- Defer admin unlock route/panel, email notification, review queue UX, password reset/change/verify-email route lockout, and
  production nginx/shared-store proof to later phases.
- Add an opt-in real-Postgres lockout race test but report it as NOT RUN unless `REAL_POSTGRES_DATABASE_URL` is provided and
  the throwaway-DB guard passes.
## Risks
- The default local proof uses PGlite, not an active real-Postgres race run. The opt-in race test exists, but it was skipped
  without operator-provided `REAL_POSTGRES_DATABASE_URL`.
- Admin unlock is still target-only. An administrator cannot yet clear lockout state through a routed, CSRF-protected,
  audited UI/action.
- The 20-failure review marker is stored, but email notification and a review workflow are not implemented.
- Production nginx/shared-store throttling, trusted proxy header normalization, production DB rollout, live deploy, and CI are
  still not run.
## Verification/tests
- Focused lockout/auth Vitest: `npm test -- packages/auth/src/login-lockout.test.ts tests/integration/auth-login-lockout-db.test.ts tests/integration/auth-error-copy.test.ts tests/integration/db-real-postgres.test.ts` - PASS (`17` passed / `8` skipped).
- `npm test -- tests/integration/db-real-postgres.test.ts` - PASS in default mode (`4` passed / `8` skipped); DB-mutating real-Postgres tests skipped because `REAL_POSTGRES_DATABASE_URL` was not set.
- `npm run check:core` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `node --check scripts/gates.mjs` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, `users` 13 columns, no schema drift after migration `0016_colorful_lyja`.
- `node scripts/gates.mjs full` - PASS (9/9 gates; Vitest `824` passed / `9` skipped).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- `npm run worker:smoke` - PASS.
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers, `2` missing roots, `70` total artifact files, `0` dynamic markers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (current phase `20260602-0903`, 7 cited per-agent handoffs all present, 0 errors / 1 known historical warning).
- NOT RUN: active `REAL_POSTGRES_DATABASE_URL` lockout race gate, production nginx/shared-store throttling proof, admin unlock, email notification/review workflow, live production deploy, live server mutation, CI via GitHub Actions.
## Next actions
1. Run `REAL_POSTGRES_DATABASE_URL=postgres://.../wtc_test_<suffix> npm test -- tests/integration/db-real-postgres.test.ts`
   against a fresh throwaway real-Postgres database to activate the cross-connection lockout race proof.
2. Implement admin unlock as an admin-only, CSRF-protected mutation that clears lockout state in the same transaction as an
   `auth.account_unlock` audit row.
3. Add registration audit logging or keep the explicit deferral in current docs.
4. Verify production nginx/shared-store auth throttling and trusted proxy header normalization only with explicit operator
   approval and redacted evidence.
