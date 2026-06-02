# ecosystem-tests-runner handoff
## Scope
Read-only verification planning for epoch `20260601-1814`, focused on likely fixes around Stripe webhook idempotency, TradingView access expiry tasks, Axioma readiness, and bot/admin read-state. No source code edits, full gates, e2e runs, DB migrations, seeds, live Stripe calls, live TradingView operations, live Axioma calls, bot/exchange calls, SSH, tmux, or systemd actions were performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260601-1740-phase-3-7-runtime-product-hardening.md`
- `docs/handoffs/20260601-1740-ecosystem-tests-runner.md`
- `package.json`
- `apps/web/package.json`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `vitest.config.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/billing-webhook-hardening.test.ts`
- `tests/integration/billing-webhook-phase24.test.ts`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/billing-checkout-phase34.test.ts`
- `tests/integration/tv-access-hardening.test.ts`
- `tests/integration/db-tv-expiring.test.ts`
- `tests/integration/db-pg5.test.ts`
- `tests/integration/phase23-visible-progress.test.ts`
- `apps/web/src/features/terminal/axioma-routes.ts`
- `apps/web/src/app/api/axioma/download/route.ts`
- `apps/web/src/app/api/axioma/journal-handoff/route.ts`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.test.ts`
- `packages/axioma-bridge/src/es256.test.ts`
- `packages/axioma-bridge/src/signer.test.ts`
- `tests/integration/axioma-skeleton-static.test.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/meta.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit

## Findings
1. MEDIUM - Final gate reporting must keep `full` and e2e separate, and `full` is not read-only.
   Evidence: `scripts/gates.mjs:24` to `scripts/gates.mjs:25` creates `logs/gates`; `scripts/gates.mjs:49` to `scripts/gates.mjs:52` defines `full` as governance/check/lint/typecheck/secret/test/db:generate/build while `e2e` is its own plan; `scripts/gates.mjs:97` writes `logs/gates/summary.txt`. `playwright.config.ts:23` to `playwright.config.ts:35` starts a dedicated e2e dev server with safe bot/TV flags.
   Recommendation: after implementation, run and report `node scripts/gates.mjs full` and `npm run e2e` as two observed gates. Do not run them from read-only agent lanes.
   Target part: final verification and aggregate handoff gate table.

2. HIGH - Stripe idempotency now has a `processing` status and terminal-status helper, but acceptance still needs route-level behavior coverage, not only repo/static coverage.
   Evidence: the webhook route inserts the ledger with `status: 'processing'` at `apps/web/src/app/api/billing/webhook/route.ts:187` to `apps/web/src/app/api/billing/webhook/route.ts:196`; duplicate handling reads the existing row and rejects non-terminal statuses at `apps/web/src/app/api/billing/webhook/route.ts:198` to `apps/web/src/app/api/billing/webhook/route.ts:213`; terminal status helpers exist at `packages/db/src/repositories.ts:1417` to `packages/db/src/repositories.ts:1421`. Existing tests assert this partly by source/static and repository helpers at `tests/integration/billing-webhook-hardening.test.ts:157` to `tests/integration/billing-webhook-hardening.test.ts:190`, while `tests/integration/billing-webhook.test.ts:3` says route handlers are excluded from that suite.
   Recommendation: run the billing targeted suite after edits and add/keep a route-handler harness that constructs signed `Request` objects for duplicate terminal 200, duplicate processing 500/retry, stale processing cleanup, missing/unknown plan manual review, and valid entitlement application.
   Target part: Stripe webhook idempotency and retry safety.

3. HIGH - TradingView expiry revoke plus external task creation is still the atomicity/recovery verification hotspot.
   Evidence: `sweepTvExpiry` revokes through `atomicRevokeTv` and then inserts `tradingview_access_tasks` in a separate statement at `packages/db/src/repositories.ts:333` to `packages/db/src/repositories.ts:344`; `atomicRevokeTv` owns its own transaction at `packages/db/src/repositories.ts:1763` to `packages/db/src/repositories.ts:1805`. Current TV task coverage asserts the happy path task exists and can be marked done at `tests/integration/tv-access-hardening.test.ts:86` to `tests/integration/tv-access-hardening.test.ts:103`.
   Recommendation: after any fix, run the TV targeted suite and add a failure-injection or recovery test proving a task insert failure cannot leave a revoked WTC request without an open/manual recovery task.
   Target part: TradingView access expiry task integrity.

4. HIGH - Axioma readiness has split coverage: app routes forbid query-token handoff, but the package bridge still returns a token-bearing URL and its package test expects that shape.
   Evidence: app route readiness and POST-body handoff are centralized at `apps/web/src/features/terminal/axioma-routes.ts:22` to `apps/web/src/features/terminal/axioma-routes.ts:65`; the route static guard forbids `?token=` only in `apps/web/src/app/api/axioma/journal-handoff/route.ts` at `tests/integration/axioma-skeleton-static.test.ts:38` to `tests/integration/axioma-skeleton-static.test.ts:50`. The package bridge still returns `${base}/handoff?token=...` at `packages/axioma-bridge/src/bridge.ts:111` to `packages/axioma-bridge/src/bridge.ts:117`, and `packages/axioma-bridge/src/signer.test.ts:96` to `packages/axioma-bridge/src/signer.test.ts:103` decodes the token from the URL query.
   Recommendation: if Axioma readiness is touched, update both package and app tests so exported bridge APIs no longer normalize token-in-query as acceptable, while preserving ES256/JWKS, JTI-before-handoff, entitlement gate, and disabled terminal CTA coverage.
   Target part: Axioma handoff token contract and readiness.

5. MEDIUM - Bot adapter/worker/user read-state has targeted coverage, but admin bot rendering still needs a first-class `not_configured` assertion.
   Evidence: the real Tortila adapter refuses unauthenticated data reads at `packages/bot-adapters/src/http.ts:95` and returns `not_configured` from health at `packages/bot-adapters/src/http.ts:135` to `packages/bot-adapters/src/http.ts:178`; worker mapping records `not_configured` distinctly at `apps/worker/src/jobs.ts:53` to `apps/worker/src/jobs.ts:61` and `apps/worker/src/jobs.ts:109` to `apps/worker/src/jobs.ts:113`; user data reads skip metric/trade endpoints when `health.readState === 'not_configured'` at `apps/web/src/features/bots/data.tsx:149` to `apps/web/src/features/bots/data.tsx:156`. The admin loader treats every non-`ok` Tortila row as `lastErr` at `apps/web/src/features/admin/queries.ts:285` to `apps/web/src/features/admin/queries.ts:299`, and the page maps `tortilaLastError !== null` to `journal: last check error` at `apps/web/src/app/admin/bots/page.tsx:15` to `apps/web/src/app/admin/bots/page.tsx:19`.
   Recommendation: add a focused admin read-state test or source guard proving a persisted `status='not_configured'` row renders as setup-needed/neutral, not a runtime error. Then run bot adapter, worker, bot-read static, admin responsive/RBAC, and admin mobile e2e targets.
   Target part: bot/admin read-state observability.

6. MEDIUM - App route/UI behavior cannot be proven by Vitest package coverage alone.
   Evidence: `vitest.config.ts:8` includes `packages/**/*.test.ts` and `tests/integration/**/*.test.ts`, while `vitest.config.ts:9` excludes `apps/web/**`. Playwright runs app routes against `http://localhost:3100` at `playwright.config.ts:15` and starts `npm run dev:e2e -w @wtc/web` at `playwright.config.ts:23` to `playwright.config.ts:27`.
   Recommendation: pair each package/repository test with a source-guard integration test for app wiring and a Playwright spec for visible admin/terminal/billing/TV/bot behavior.
   Target part: app-layer verification strategy.

## Decisions
1. Did not run `node scripts/gates.mjs full`, `npm run e2e`, `node scripts/gates.mjs e2e`, `npm test`, `npm run db:generate`, `npm run build`, migrations, seeds, or any live/external operation.
2. Treat current worktree evidence as authoritative; the 1740 phase handoff was used for context but code/tests were re-inspected before making recommendations.
3. Treat `node scripts/gates.mjs full` as core+build only. E2E is a separate required gate.
4. Treat demo-only E2E as safe only after DB env vars are cleared. Current shell check observed `DATABASE_URL=false`, `REAL_POSTGRES_DATABASE_URL=false`, port 3000 listening, and port 3100 not listening.
5. Any real-Postgres, Stripe CLI/dashboard, TradingView, Axioma, worker deploy, or bot/exchange acceptance must be explicitly scoped by the operator with throwaway credentials or live-operation approval.

## Risks
1. A green `npm test` alone can miss route-handler behavior because app route files are excluded from Vitest discovery.
2. `node scripts/gates.mjs full` writes logs, runs `db:generate`, and builds the web app; it is unsuitable for read-only agents.
3. `npm run e2e` can inherit `DATABASE_URL` because `playwright.config.ts` does not clear it; demo-only runs must remove DB env vars first.
4. Stripe duplicate safety is not fully proven until the route-level duplicate-processing and stale-processing paths are exercised directly.
5. TradingView external access can drift if the next implementation changes revoke/task ordering without a failure or recovery test.
6. Axioma can regress into query-token handoff if package-level tests continue to accept `?token=` even while app route tests forbid it.
7. Admin bot dashboards can mislabel setup-needed `not_configured` rows as runtime errors unless a targeted test covers that state.

## Verification/tests
Gates RUN:
- None. This was read-only verification planning.

Read-only checks performed:
- Inspected required protocol docs and the prior aggregate handoff.
- Inspected package scripts, gate runner, Playwright config, Vitest config, current Stripe webhook route/tests, TV expiry repositories/tests, Axioma route/package tests, and bot/admin read-state code/tests.
- Checked current shell state without printing secrets: `DATABASE_URL=false`, `REAL_POSTGRES_DATABASE_URL=false`, `PORT_3000_LISTENING=true`, `PORT_3100_LISTENING=false`.

Gates NOT RUN:
- `npm test` - not run because this lane was scoped to read-only planning.
- `node scripts/gates.mjs full` - not run because it writes logs, runs `db:generate`, and builds.
- `npm run e2e` / `node scripts/gates.mjs e2e` - not run because Playwright starts a dev server and can mutate DB-backed state if DB env vars are present.
- `npm run db:migrate` / `npm run db:seed` / real-Postgres harness - not run because no throwaway DB acceptance was requested for this agent.
- Stripe CLI/dashboard, TradingView, Axioma, bot/exchange, SSH, tmux, systemd, preview worker operations - not run by scope and safety boundary.

Precise targeted gates after the relevant fixes are made:

```powershell
# Stripe webhook idempotency / billing
npm test -- tests/integration/billing-webhook-hardening.test.ts tests/integration/billing-webhook-phase24.test.ts tests/integration/billing-webhook.test.ts tests/integration/billing-checkout-phase34.test.ts

# TradingView expiry task integrity
npm test -- tests/integration/tv-access-hardening.test.ts tests/integration/db-tv-expiring.test.ts tests/integration/db-pg5.test.ts tests/integration/phase23-visible-progress.test.ts

# Axioma readiness / token contract
npm test -- packages/axioma-bridge/src/handoff.test.ts packages/axioma-bridge/src/es256.test.ts packages/axioma-bridge/src/signer.test.ts tests/integration/axioma-skeleton-static.test.ts tests/integration/phase23-visible-progress.test.ts

# Bot/admin read-state
npm test -- packages/bot-adapters/src/__tests__/getHealth-states.test.ts packages/bot-adapters/src/__tests__/legacy-blocked.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-responsive.test.ts tests/integration/admin-ops-rbac.test.ts

# Focused visible app coverage after UI/route changes
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue
npm run e2e -- tests/e2e/smoke.spec.ts tests/e2e/admin-mobile-pg8.spec.ts

# Final local gates after targeted fixes are green
node scripts/gates.mjs full
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:REAL_POSTGRES_DATABASE_URL -ErrorAction SilentlyContinue
npm run e2e
```

Full/e2e safety notes:
- `node scripts/gates.mjs full` is serialized and preferred over raw parallel npm commands on this Windows host, but it does not include e2e and it writes `logs/gates/*`.
- Demo-only Playwright should clear `DATABASE_URL` and `REAL_POSTGRES_DATABASE_URL` first.
- DB-backed Playwright or worker acceptance should use a named throwaway database only, then report that mutation target explicitly.
- Do not use the existing listener on port 3000 as proof of freshness; Playwright is configured for port 3100 with `reuseExistingServer=false`.

## Next actions
1. Implementer lanes should add/fix the missing targeted tests alongside code changes, especially route-level Stripe idempotency, TV task failure/recovery, package-level Axioma no-query-token contract, and admin `not_configured` rendering.
2. Operator should run the targeted gate group for each touched area before running `node scripts/gates.mjs full`.
3. Operator should run `npm run e2e` separately from `full`, with DB env vars cleared for demo-only acceptance or a documented throwaway DB for DB-backed acceptance.
4. Aggregate phase handoff must list exact gates run and exact gates not run with reasons; no green claim should be made from this read-only handoff.
