# Phase 3.5 - Integration hardening and safe preview readiness

## Scope
Closed the Phase 3.4 production-readiness follow-up as a multi-lane hardening pass without touching live servers, live bots, exchanges, live Stripe, or real Axioma. This aggregate cites 4 per-agent handoffs from epoch `20260531-1500`:

- [`20260531-1500-db-preview-hardening.md`](20260531-1500-db-preview-hardening.md)
- [`20260531-1500-billing-webhook-hardening.md`](20260531-1500-billing-webhook-hardening.md)
- [`20260531-1500-axioma-skeleton.md`](20260531-1500-axioma-skeleton.md)
- [`20260531-1500-bot-admin-surface-hardening.md`](20260531-1500-bot-admin-surface-hardening.md)

The phase landed deployment/readiness spine work in parallel-safe areas: idempotent seed and safe local preview, billing webhook manual-review correctness, Axioma fail-closed route skeletons, and bot/admin read-only surface hardening.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`
- The 4 cited per-agent handoff files listed above
- `package.json`
- `scripts/safe-preview.mjs`
- `packages/db/src/seed.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/products/page.tsx`

## Files changed
- `package.json`
- `scripts/safe-preview.mjs`
- `.env.example`
- `packages/db/src/seed.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `tests/integration/axioma-skeleton-static.test.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/products/page.tsx`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- The 4 cited per-agent handoffs plus this aggregate

## Findings
1. `seedDatabase()` was not fully safe for repeated deploy/preview runs: demo users and the seeded teacher course needed existing-row resolution instead of duplicate insertion behavior.
2. `/api/billing/webhook` could acknowledge missing or unknown plan metadata as `no_op`, leaving no durable manual-review signal.
3. Axioma UI had product intent but lacked fail-closed route skeletons for download and journal handoff readiness checks.
4. Bot safety/admin product surfaces needed to degrade to warnings and real read-only summaries instead of route crashes or placeholders.

## Decisions
- Added `npm run preview:safe`, forcing the local preview into development, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
- Kept all Axioma route skeletons fail-closed: auth, entitlement, CSRF where applicable, DB, route flag, bridge token, ES256 key/key id, and valid URL must all be present before the UI enables bridge actions. No real Axioma network call was added.
- Changed webhook missing-user and unknown-plan paths to durable manual review; if review creation fails after the idempotency ledger insert, the ledger row is deleted and the route returns 500 so Stripe can retry.
- Replaced `/admin/products` placeholder behavior with a read-only product/admin overview over registry, catalog seed, plan coverage, and entitlement counts where a DB is available.
- Left live bot control disabled and live adapters off. This phase is readiness hardening, not production activation.

## Risks
- Real Postgres `db:migrate`, `db:seed`, and the real-PG harness were NOT run because no throwaway `DATABASE_URL` / `REAL_POSTGRES_DATABASE_URL` is configured in this environment.
- Stripe CLI acceptance was NOT run; webhook logic is covered by signed fake events and DB assertions, not a live Stripe replay.
- Axioma production bridge remains blocked on real endpoint shapes, production ES256 key provisioning, and the deployment decision for the download/journal routes.
- Playwright still has a known login/navigation race in older smoke specs; the final run exited green after retries with 3 flaky-green tests.

## Verification/tests
- `npm run check:core` - PASS.
- `npm run lint -- --quiet` - PASS.
- `npm run typecheck -- --pretty false` - PASS.
- `npm run typecheck -w @wtc/web -- --pretty false` - PASS.
- `npm run secret:scan` - PASS.
- `npm test` - PASS, 572 passed / 8 skipped (580), 54 files.
- `npm run coverage` - PASS, 24.33% statements / 76.37% branches.
- `npm run db:generate -w @wtc/db` - PASS, 41 tables, no schema changes.
- `npm run build -w @wtc/web` - PASS, 48 routes.
- `CI=1 npx playwright test --reporter=list` - PASS by exit code, 41 passed / 3 flaky-green / 6 skipped / 0 failed.
- `npm run governance:check` - PASS after this aggregate and truth-doc updates; current phase `20260531-1500`, 4 cited per-agent handoffs all present, 0 errors, 1 allowlisted historical warning.
- `npm run secret:scan` - PASS again after the docs update.
- NOT RUN: real Postgres migrate/seed/harness, live Stripe CLI, live Axioma bridge, live bot/server/exchange, CI/git, `npm ci`.

## Next actions
1. Run a throwaway real-Postgres acceptance pass once `DATABASE_URL` / `REAL_POSTGRES_DATABASE_URL` is available: migrate, seed, db-real-postgres harness, then repeat the smoke gates.
2. Run Stripe CLI/test-mode acceptance with valid, missing-user, missing-plan, and unknown-plan events and verify the admin manual-review queue.
3. Convert the Axioma route skeletons into real production bridge routes only after endpoint shapes and ES256 key management are approved.
4. Fix the known Playwright login/navigation flaky helper so the e2e result becomes strictly green without retry noise.
5. Keep live bot control and non-mock adapters disabled until the live-control audit and server-side safety gates are complete.
