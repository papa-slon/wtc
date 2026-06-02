# Phase 3.6 - Strict e2e, IP preview, and admin terminal room

## Scope
Closed the current broad package verification pass after a 4 read-only auditor review. This phase did not touch live servers, live bots, exchanges, live Stripe, real TradingView automation, or real Axioma endpoints.

Per-agent handoffs cited by this aggregate:

- [`20260531-1600-bot-rooms-preview-auditor.md`](20260531-1600-bot-rooms-preview-auditor.md)
- [`20260531-1600-lms-tv-preview-auditor.md`](20260531-1600-lms-tv-preview-auditor.md)
- [`20260531-1600-admin-terminal-deploy-auditor.md`](20260531-1600-admin-terminal-deploy-auditor.md)
- [`20260531-1600-e2e-preview-auditor.md`](20260531-1600-e2e-preview-auditor.md)

## Files inspected
- `playwright.config.ts`
- `tests/e2e/*.spec.ts`
- `tests/e2e/helpers/*`
- `scripts/safe-preview.mjs`
- `scripts/gates.mjs`
- `apps/web/src/app/admin/*`
- `apps/web/src/app/(app)/app/*`
- `packages/db/src/repositories.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`

## Files changed
- `apps/web/src/app/api/e2e/login/route.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/backtester-pg10-mobile.spec.ts`
- `playwright.config.ts`
- `apps/web/next.config.ts`
- `scripts/safe-preview.mjs`
- `scripts/gates.mjs`
- `eslint.config.js`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `apps/web/src/app/admin/terminal/page.tsx`
- `packages/db/src/repositories.ts`
- `apps/web/src/lib/nav.ts`
- `tests/integration/admin-responsive.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- This aggregate and the 4 cited per-agent handoffs

## Findings
The broad WTC package is materially executed as a local product preview, but not production-ready. The previous Playwright flake came from Server Action login in `next dev` plus shared `.next` cache collisions. Admin terminal release management was the largest visible admin room gap. Safe preview needed to bind to `0.0.0.0` reliably on Windows without shell indirection.

## Decisions
- Added a guarded e2e-only login route that only works with `E2E_AUTH_BYPASS=1` outside production.
- Centralized Playwright login helpers and set retries to `0`.
- Isolated Playwright's Next build output with `NEXT_DIST_DIR=.next-e2e`.
- Made `scripts/gates.mjs` fail if Playwright reports any flaky test.
- Hardened `scripts/safe-preview.mjs` to run Next directly through `node` with `shell:false` and bind `--hostname 0.0.0.0 --port 3000`.
- Added `/admin/terminal` as a DB-only release metadata room with CSRF-protected publish/update and release history.
- Kept all live bot control, real adapters, Axioma CTAs, real TradingView automation, and live payment actions disabled unless their blockers clear.

## Risks
- Real Postgres acceptance is still NOT RUN because no throwaway `DATABASE_URL` / `REAL_POSTGRES_DATABASE_URL` was provided.
- Stripe CLI/test webhook replay with real test secrets is still NOT RUN.
- Axioma installer bytes, production ES256 key, endpoint shapes, and download/open-journal activation are still blocked.
- Legacy bot real adapter remains blocked by B3.
- TradingView invites are still manual/admin-state, not automated private-invite execution.
- Local preview is safe for visual review; it is not a production deployment.

## Verification/tests
- `npm run lint -- --quiet` - PASS.
- `npm run typecheck -- --pretty false` - PASS.
- `npm run typecheck -w @wtc/web -- --pretty false` - PASS.
- `npm run secret:scan` - PASS.
- Targeted Vitest for governance/admin/preview - PASS, 52 tests.
- `npx playwright test tests/e2e/smoke.spec.ts --project=desktop --reporter=list` - PASS, 17/17, retries 0.
- `npm run governance:check` - PASS before this aggregate; current aggregate will be rechecked after doc update.
- `npm run check:core` - PASS.
- `npm test` - PASS, 575 passed / 8 skipped (583), 54 files.
- `npm run coverage` - PASS, 24.17% statements / 76.27% branches.
- `npm run db:generate -w @wtc/db` - PASS, 41 tables, no schema changes.
- `npm run build -w @wtc/web` - PASS, including `/admin/terminal` and `/api/e2e/login`.
- `CI=1 npx playwright test --reporter=list` - PASS, 44 passed / 6 skipped / 0 flaky / 0 failed.
- Post-doc/fix checks: `npm run governance:check` - PASS, `npm run secret:scan` - PASS, targeted preview hardening Vitest - PASS,
  `npm run lint -- --quiet` - PASS after ignoring `.next-e2e`.
- Safe preview verified running on `0.0.0.0:3000`; HTTP checks returned 200 for `http://127.0.0.1:3000/`,
  `http://127.0.0.1:3000/login`, `http://192.168.72.141:3000/`, and `http://192.168.72.141:3000/login`.
- NOT RUN: real-PG migrate/seed/harness, live server/bot/exchange, live Stripe, real TradingView automation, real Axioma bridge, git/CI.

## Next actions
1. Start safe local preview and verify access through `127.0.0.1` and the local adapter IP.
2. Provide a throwaway `wtc_test` Postgres URL and run real-PG migrate/seed/harness.
3. Provision Stripe test secrets and run Stripe CLI webhook acceptance.
4. Provide Axioma endpoint shapes and ES256 key, then implement real download/open-journal activation.
5. Keep the next platform phase broad: bot durable snapshots, TV automation if approved, LMS uploads/embed sanitizer, and production deploy readiness should move as parallel workstreams, each with reviewers and rollback conditions.
