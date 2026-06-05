# ecosystem-tests-runner handoff
## Scope
Read-only tests-runner planning for a future admin user bot drilldown/list slice.

The planned product surface is an admin-only, read-only way to inspect one user's bot access and latest safe bot snapshots, likely from `/admin/users` into a dedicated user bot detail route such as `/admin/users/[userId]/bots`. This handoff defines focused tests and gates only. No application/runtime code was edited, no live bot services were queried, and no live start/stop/apply-config/exchange-test behavior is permitted for this slice.

This was not a broad/major phase and did not claim a multi-agent audit. Agent tooling was not launched; this file is the single tests-runner planning handoff requested by the operator.

## Files inspected
- `AGENTS.md`
- `package.json`
- `apps/web/package.json`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `vitest.config.ts`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/lib/access.ts`
- `packages/db/src/schema.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/helpers/auth.ts`

## Files changed
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`

## Findings
1. Severity: High. The repo policy requires admin bot/user inspection to stay read-only and forbids live bot start/stop/apply-config until audits pass. Evidence: `AGENTS.md:74-82`, `apps/web/src/app/admin/bots/page.tsx:30-42`, `apps/web/src/app/admin/bots/page.tsx:58-79`. Recommendation: add tests that fail on start/stop/apply/config/test-connection controls, adapter writes, exchange-key display, or raw runtime URL display in the new admin user bot route/list. Target part: admin user bot route, admin queries, e2e spec.

2. Severity: High. Existing `/admin/users` is admin-guarded and currently has one mutation: audited lockout clearing. Evidence: `apps/web/src/app/admin/users/page.tsx:18-22`, `apps/web/src/app/admin/users/page.tsx:46-60`, `apps/web/src/app/admin/users/page.tsx:114-124`. Recommendation: the bot drilldown link/list must not reuse the unlock action column pattern for bot controls; it should be a read-only navigation/detail surface with no forms except existing account-lockout forms already present. Target part: `/admin/users` list extension and any `/admin/users/[userId]/bots` route.

3. Severity: High. The current cross-user admin bot health loader reads global/latest snapshots and Legacy provider rows, not a selected user's scoped bot instances. Evidence: `apps/web/src/features/admin/queries.ts:336-356`, `apps/web/src/features/admin/queries.ts:415-435`, `apps/web/src/features/admin/queries.ts:448-474`. Recommendation: create a user-scoped loader that joins through `bot_instances.user_id = requested userId` before reading metrics, configs, positions, trades, or reviews; add PGlite tests with two users to prove no other user's bot instance or snapshot leaks. Target part: `apps/web/src/features/admin/queries.ts` or a new admin feature module.

4. Severity: High. The database shape supports user-scoped drilldown through `bot_instances`, and worker-written bot facts hang off `bot_instance_id`. Evidence: `packages/db/src/schema.ts:138-152`, `packages/db/src/schema.ts:420-490`, `packages/db/src/schema.ts:498-524`. Recommendation: tests should require joins via `bot_instances.id` and avoid product-only/global latest snapshot queries for per-user admin views. Target part: loader query and DTO mapping.

5. Severity: High. Existing admin DTOs intentionally strip sensitive fields, and health details are projected before rendering. Evidence: `apps/web/src/features/admin/queries.ts:104-150`, `apps/web/src/features/admin/queries.ts:398-412`, `apps/web/src/features/admin/queries.ts:483-491`, `tests/integration/admin-health-detail.test.ts:4-35`. Recommendation: add a sanitizer/projection test for the new drilldown DTO that rejects `passwordHash`, `apiKey`, `apiSecret`, `secret`, `token`, `bearer`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`, raw `rawJson`, stack traces, and exchange URLs. Target part: admin user bot DTO/mapper and page rendering.

6. Severity: Medium. Existing static tests already enforce admin page table wrappers, `data-label` cells, and `StatusPill` state. Evidence: `tests/integration/admin-responsive.test.ts:1-9`, `tests/integration/admin-responsive.test.ts:68-90`, `tests/e2e/admin-mobile-pg8.spec.ts:4-15`, `tests/e2e/admin-mobile-pg8.spec.ts:40-58`. Recommendation: extend these guards to the new dynamic route and any new table/list section so the drilldown is mobile-readable at 375px. Target part: `tests/integration/admin-responsive.test.ts`, `tests/e2e/admin-mobile-pg8.spec.ts`, new e2e spec.

7. Severity: Medium. Existing bot read-safety tests cover user-facing bot routes, admin bot health setup-state handling, and Legacy pub_id inspector safety, but not a per-user admin bot drilldown. Evidence: `tests/integration/bot-read-safety-static.test.ts:26-85`, `tests/integration/bot-read-safety-static.test.ts:87-104`. Recommendation: add a dedicated admin user bot drilldown static test instead of diluting the existing broad file. Target part: new `tests/integration/admin-user-bot-drilldown-static.test.ts`.

8. Severity: Medium. Existing Playwright e2e runs in demo/mock mode, with live controls and TV automation disabled. Evidence: `playwright.config.ts:27-39`, `tests/e2e/helpers/auth.ts:5-15`. Recommendation: use Playwright for route rendering, admin auth, no-h-scroll, and absence of live controls; use PGlite/Vitest for row isolation because default e2e without `DATABASE_URL` cannot prove DB-backed cross-user data. Target part: new focused e2e and loader integration tests.

9. Severity: Medium. Phase 3.70 recorded that full `npm run e2e` timed out after 244 seconds, and `node scripts/gates.mjs full` plus `node scripts/gates.mjs e2e` were not run in that lane. Evidence: `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md:126-136`. Recommendation: do not claim full/e2e green for this slice until rerun in a dedicated acceptance lane with retained logs; run focused gates first. Target part: final acceptance report.

10. Severity: Low. `scripts/gates.mjs` intentionally separates `full` from `e2e`; `full` is core plus build, and `e2e` is Playwright only. Evidence: `scripts/gates.mjs:13-18`, `scripts/gates.mjs:44-53`. Recommendation: report `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` separately, and never imply `full` includes Playwright. Target part: gate checklist.

## Decisions
1. Add focused tests before or alongside implementation. Do not rely on the broad smoke suite to catch this slice.
2. Prefer two new integration files:
   - `tests/integration/admin-user-bot-drilldown-static.test.ts`
   - `tests/integration/admin-user-bot-drilldown-loader.test.ts`
3. Prefer one new focused Playwright file:
   - `tests/e2e/admin-user-bot-drilldown.spec.ts`
4. Extend existing coverage only where it is already a shared page-shell guard:
   - add the new admin route to `tests/integration/admin-responsive.test.ts`
   - add the new admin route to `tests/e2e/admin-mobile-pg8.spec.ts` only after it has a stable heading and demo/empty state.
5. The loader test should be PGlite/disposable only. Do not run migrations/seeds against a live `DATABASE_URL` for this planning or focused acceptance lane.
6. For this slice, "read-only" means no live adapter calls, no worker tick, no start/stop/apply config, no exchange ping, no server action mutation for bot state, and no rendering of exchange secrets or provider connection strings.

## Risks
1. The current admin bot health page is fleet/global; using its query shape as-is for user drilldown could leak another user's latest snapshot because it orders by latest bot metric snapshot without user scoping.
2. Default Playwright runs with no `DATABASE_URL`; it proves mock/demo rendering and safety-copy behavior, not real user row isolation.
3. Full e2e is currently a known acceptance risk from Phase 3.70. A focused spec can pass while `npm run e2e` or `node scripts/gates.mjs e2e` still times out elsewhere.
4. A route that shows Legacy `pub_id` values may still be support-sensitive. If displayed, tests should require shortened/masked presentation unless product/security explicitly approves full `pub_id` display for admin support.
5. If implementation adds a server action to "refresh", "sync", "test", or "recheck" bot state, the slice stops being read-only and must go back through bot-integration plus security review.
6. If implementation uses user entitlements only and ignores `bot_instances`, it may miss existing bot snapshots; if it uses `bot_instances` only and ignores entitlements, it may violate fail-closed access truth. Tests should require both: instance ownership for data scoping and entitlement status for access labeling.

## Verification/tests
RUN in this planning session:
1. `git status --short --branch` - observed dirty branch with pre-existing modified/untracked Phase 3.70 bot/settings files and handoffs; left untouched.
2. Source inspection only of scripts, AGENTS, Phase 3.70 handoff, admin user/bot routes, admin query/types, DB schema, existing static/e2e tests.

NOT RUN in this planning session:
1. Vitest/Playwright/gate commands - not run because the requested output is a read-only planning handoff and no application/runtime implementation was changed.
2. Full `npm run e2e` - not run; Phase 3.70 records a prior timeout after 244 seconds.
3. `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` - not run; no implementation to accept, and e2e/full-gate risk is recorded above.
4. Managed DB gates, `db:migrate`, `db:seed`, `accept:real-pg:managed`, auth/LMS managed e2e - not run; outside this slice and potentially DB-mutating unless pointed at disposable infrastructure.
5. `npm run worker:smoke`, `worker:tick`, `dev:worker` - not run; worker/live bot state is outside this read-only planning task.
6. Live bot start/stop/restart/apply-config, live exchange key ping/test, SSH/systemd/live canary probes - not run by policy.

Focused tests to add for the slice:
1. `tests/integration/admin-user-bot-drilldown-static.test.ts`
   - Assert `/admin/users` imports/links only to a read-only bot drilldown route and keeps existing unlock action isolated to lockout rows.
   - Assert new route calls `requireUser()` and `assertAdmin(actor.roles)`.
   - Assert route/page imports a read-only admin loader, not bot adapter/control/action modules.
   - Assert source does not contain forbidden live-control strings or identifiers: `Start bot`, `Stop bot`, `applyConfig`, `applyBot`, `restart`, `Test connection`, `Connection verified`, `getBotAdapter`, `persistBotConfig`, `saveBotConfig`, `listExchangeKeys`, `apiSecret`, `apiKey`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`.
   - Assert page renders `StatusPill`, `storage:`, `wtc-table-wrap`, `data-label=`, and a clear read-only/safety state.

2. `tests/integration/admin-user-bot-drilldown-loader.test.ts`
   - Build a disposable PGlite DB from migrations and seed.
   - Create two users, bot instances for both users, entitlements with different states, latest configs, metric snapshots, position snapshots, trade imports, and trade reviews.
   - Call the user-scoped loader/helper for user A and assert only user A's bot instances/snapshots/config summaries are returned.
   - Assert user B's bot IDs, external trade IDs, symbols unique to user B, and snapshot values do not appear in user A's JSON.
   - Assert DTO includes entitlement/access labels for Tortila and Legacy and fails closed for missing/blocked entitlements.
   - Assert raw/sensitive fields are absent: `passwordHash`, `apiKey`, `apiSecret`, `secret`, `token`, `bearer`, provider URL, DB URL, raw adapter payload, stack trace.
   - Assert loader is read-only by comparing row counts and latest timestamps for `audit_logs`, `bot_configs`, `bot_config_versions`, `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, and `bot_trade_reviews` before/after the call.
   - Assert demo/no-DB branch returns an honest `mode: 'demo'` empty state without adapter calls.

3. Extend `tests/integration/admin-responsive.test.ts`
   - Add the dynamic route file to the admin page source list once implemented.
   - Keep the existing table wrapper/data-label/StatusPill checks green for the new route/list.

4. Extend or add to `tests/integration/bot-read-safety-static.test.ts`
   - Prefer a new describe block or the dedicated static file above.
   - Assert the admin user bot drilldown uses DB snapshots/config summaries and `projectHealthDetail`/allowlist projection, never `loadBotReadModel` or direct adapters during render.

5. `tests/e2e/admin-user-bot-drilldown.spec.ts`
   - Use `loginAdmin(page)`.
   - Desktop and mobile: navigate to `/admin/users`, verify `User directory`, storage pill, read-only bot access/list entry point or demo empty state, and no `Start bot|Stop bot|Apply config|Test connection|Connection verified` controls.
   - Navigate to the new drilldown route or click the list link when a row exists. Verify route heading, read-only safety copy, storage pill, bot product rows/cards, entitlement/access labels, and no horizontal scroll.
   - Screenshot desktop and mobile artifacts under `tests/e2e/screenshots/admin-user-bot-drilldown-<project>.png`.
   - If default demo mode has no DB rows, keep this e2e scoped to shell/empty-state safety and rely on the PGlite loader test for real row isolation.

Safe focused gates after implementation:
1. `npx vitest run tests/integration/admin-user-bot-drilldown-static.test.ts tests/integration/admin-user-bot-drilldown-loader.test.ts tests/integration/admin-responsive.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-health-detail.test.ts`
2. `npm run typecheck`
3. `npm run typecheck -w @wtc/web`
4. `npm run lint`
5. `npm run secret:scan`
6. `npm run build -w @wtc/web`
7. `npx playwright test tests/e2e/admin-user-bot-drilldown.spec.ts --project=desktop --project=mobile`
8. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile`
9. Optional broader acceptance once focused gates are green: `node scripts/gates.mjs full`
10. Separate e2e acceptance with longer timeout/retained logs: `node scripts/gates.mjs e2e`

Gates not safe or not sufficient for this slice:
1. `npm run e2e` alone is not sufficient because prior Phase 3.70 full e2e timed out and default e2e has no real DB row isolation proof.
2. `node scripts/gates.mjs full` is not sufficient because it intentionally excludes Playwright.
3. Live DB migration/seed/worker/canary/service probes are out of scope unless run against disposable infrastructure and explicitly approved for a separate acceptance lane.

## Next actions
1. Implement the admin user bot drilldown with a dedicated read-only loader that takes a target `userId`, joins through `bot_instances.user_id`, projects safe DTOs only, and labels entitlement state.
2. Add the two integration tests and one focused e2e spec listed above before claiming the slice complete.
3. Extend admin responsive/mobile route lists once the route path and heading are final.
4. Run focused gates first, then broader `gates.mjs full` and separate `gates.mjs e2e` only in an acceptance lane with enough timeout.
5. Keep any future "refresh", "sync", "apply", "test connection", or live-control affordance out of this slice; those require security and bot-integration audit before tests-runner acceptance.
