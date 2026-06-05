# phase-4-26-aggregate-worker-continuity-launch-gate handoff
## Scope
Add a real aggregate worker-continuity launch-readiness gate for Tortila and Legacy. This phase makes user launch readiness and the selected-user admin mirror depend on the latest `integration_health_checks.target='worker'` row, not only product runtime health rows. It remains read-only: no live bot start/stop/apply-config, exchange ping, provider probe, worker tick, SSH, tmux, systemd, or deploy was run.

Linked auditor handoffs:
- [docs/handoffs/20260604-1732-bot-worker-continuity-runtime-auditor.md](docs/handoffs/20260604-1732-bot-worker-continuity-runtime-auditor.md)
- [docs/handoffs/20260604-1729-bot-continuity-web-product-auditor.md](docs/handoffs/20260604-1729-bot-continuity-web-product-auditor.md)
- [docs/handoffs/20260604-1734-bot-continuity-gates-security-auditor.md](docs/handoffs/20260604-1734-bot-continuity-gates-security-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260604-1724-phase-4-25-admin-launch-readiness-mirror.md`
- `docs/handoffs/20260604-1732-bot-worker-continuity-runtime-auditor.md`
- `docs/handoffs/20260604-1729-bot-continuity-web-product-auditor.md`
- `docs/handoffs/20260604-1734-bot-continuity-gates-security-auditor.md`
- `apps/worker/src/index.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
- `apps/web/src/features/bots/readiness.ts` - added aggregate worker fields to runtime readiness, made `Runtime snapshot` non-green unless aggregate worker continuity is ready, and inserted a `Worker heartbeat` row backed by `target='worker'`.
- `apps/web/src/features/bots/readiness-loader.ts` - reads the latest aggregate worker health row from `integration_health_checks`, computes a 3 minute freshness gate, and passes safe scalar worker continuity facts into readiness DTOs.
- `apps/web/src/features/admin/types.ts` - added `AdminUserBotWorkerContinuitySummary` and `workerContinuity` on selected-user bot summaries.
- `apps/web/src/features/admin/user-bot-detail-loader.ts` - reads latest `target='worker'`, computes per-product aggregate worker continuity status, and keeps it separate from product runtime health.
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx` - switched admin `Worker heartbeat` readiness to aggregate worker continuity, added selected-user `Worker attention`, and moved the heartbeat review anchor to the evidence ladder.
- `tests/integration/bot-readiness-builder.test.ts` - added fail-closed aggregate worker heartbeat cases.
- `tests/integration/bot-readiness-server-dto-static.test.ts` - locked the server-only aggregate worker DTO boundary.
- `tests/integration/bot-read-safety-static.test.ts` - locked no-live-control aggregate worker readiness semantics.
- `tests/integration/admin-user-bot-detail-static.test.ts` - locked selected-user aggregate worker mirror, top summary, and `runtime-evidence` anchor.
- `tests/e2e/bot-readiness-map.spec.ts` - asserts user dashboards render `Worker heartbeat`.
- `tests/e2e/admin-user-bot-detail-db.spec.ts` - updates selected-user DB acceptance expectations for `Worker heartbeat` plus `Worker attention`.
- `docs/handoffs/20260604-1732-bot-worker-continuity-runtime-auditor.md` - read-only auditor handoff.
- `docs/handoffs/20260604-1729-bot-continuity-web-product-auditor.md` - read-only auditor handoff.
- `docs/handoffs/20260604-1734-bot-continuity-gates-security-auditor.md` - read-only auditor handoff.
- `docs/handoffs/20260604-1748-phase-4-26-aggregate-worker-continuity-launch-gate.md` - this aggregate handoff.

## Findings
1. Severity P1 - User launch readiness now uses aggregate worker continuity instead of treating product runtime health as worker proof. Evidence: `apps/web/src/features/bots/readiness-loader.ts:24` sets a 3 minute stale window, `apps/web/src/features/bots/readiness-loader.ts:149` reads `target='worker'`, and `apps/web/src/features/bots/readiness.ts:95`-`101` blocks/holds readiness unless worker status, bot continuity, product snapshot, and product readState are green. Recommendation: keep product runtime and aggregate worker rows separate. Target part: user launch readiness.
2. Severity P1 - The `Worker heartbeat` row is explicit and fail-closed. Evidence: `apps/web/src/features/bots/readiness.ts:121` labels the row, `apps/web/src/features/bots/readiness.ts:123`-`127` shows fresh aggregate vs review/missing state, and `apps/web/src/features/bots/readiness.ts:208` inserts it before runtime/statistics rows. Recommendation: keep this row in dashboard launch readiness and avoid renaming it back to product runtime. Target part: readiness table.
3. Severity P1 - Selected-user admin launch readiness now uses aggregate worker continuity and exposes top-level worker attention. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:392` computes stale aggregate worker state, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:190` adds a top `Worker heartbeat` summary row, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:352` uses aggregate worker continuity in each bot readiness panel, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:456` adds `Worker attention`. Recommendation: keep admin read-only and never turn this into a worker tick button. Target part: admin selected-user bot drilldown.
4. Severity P2 - The admin heartbeat review link now targets evidence instead of the stats grid. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:358` links to `#...-runtime-evidence`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:560` anchors the selected-user evidence ladder. Recommendation: add a future click/scroll assertion in the DB browser matrix when that gate is authorized. Target part: admin UX polish.

## Decisions
- Used the existing append-only `integration_health_checks` table and latest `target='worker'` row; no migration was added.
- Treated a missing aggregate worker row, stale row over 180 seconds, `botContinuityStatus !== ok`, per-product snapshot not `ok`, or per-product readState not `ok` as non-green launch readiness.
- Kept `not_configured` as attention rather than outage, but never as ready.
- Kept product runtime health and scoped metric/position/trade rows as evidence, not a substitute for aggregate worker heartbeat.
- Did not run `accept:worker:continuity` in this phase because it writes DB health/snapshot rows and needs an explicitly authorized throwaway DB.

## Risks
- The worktree remains heavily dirty with many pre-existing modified and untracked files. This handoff certifies only the Phase 4.26 files listed above.
- `accept:worker:continuity` is still NOT RUN in this phase, so this is a UI/DTO fail-closed gate, not live/DB acceptance that the worker tick ran successfully today.
- The admin selected-user DB matrix remains NOT RUN, so populated Postgres ownership/leak proof for this exact new row is pending.
- One Playwright admin-mobile attempt failed with `EBUSY` because two Playwright web servers were launched in parallel against the same `.next-e2e` output. It was rerun alone and passed.
- One Playwright dashboard attempt used a nonexistent `chromium` project before rerunning with the repo's `desktop` project. The bad invocation is not counted green.

## Verification/tests
RUN:
- `npx vitest run tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-continuity-builder.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-bot-health-loader.test.ts tests/integration/worker-health-mapping.test.ts` - PASS, 8 files / 79 tests.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run typecheck -w @wtc/worker` - PASS.
- `E2E_PORT=3429 npx playwright test tests/e2e/bot-readiness-map.spec.ts --project=desktop` - PASS, 1 desktop browser test.
- `E2E_PORT=3430 npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS on rerun, 1 mobile browser test.
- `node scripts/gates.mjs quick` - PASS, 4 gates, 0 failing.
- `npm run secret:scan` - PASS.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory check, 103 image files, 0 blocked artifacts, 0 missing roots, 104 total artifact files, 0 dynamic markers.
- `git diff --check` - PASS before this aggregate.

NOT RUN / NOT GREEN:
- `npm run accept:worker:continuity` - NOT RUN; requires explicit fresh throwaway `DATABASE_URL`, runs a worker tick, and writes worker health/snapshot rows. It must also be checked for explicit `worker_status`, `bot_continuity`, `tortila`, and `legacy` evidence, not only exit 0.
- `npm run worker:smoke` - NOT RUN and not accepted as continuity proof because it can run memory-demo without `DATABASE_URL`.
- `npm run worker:tick`, `npm run dev:worker`, `npm run dev -w @wtc/worker` - NOT RUN.
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires throwaway/admin Postgres setup and artifact review.
- `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` - NOT RUN; `quick` plus focused browser gates were run for this slice.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probe, SSH, tmux, systemd, deploy, production monitoring, Stripe/Axioma/LMS live gates - NOT RUN by safety scope.

Failed or corrected invocations:
- `npx playwright test tests/e2e/bot-readiness-map.spec.ts --project=chromium` - failed because this repo uses `desktop` and `mobile` projects.
- Parallel `bot-readiness-map` and `admin-mobile-pg8` Playwright run - one admin-mobile process failed with `EBUSY` on `.next-e2e/types/routes.d.ts`; rerun alone passed.

## Next actions
1. Run `npm run governance:check` after this aggregate handoff so Phase 4.26 is recognized.
2. With explicit throwaway DB authorization, run `npm run accept:worker:continuity` and record the actual `worker_status`, `bot_continuity`, `tortila`, and `legacy` tuple.
3. With explicit disposable Postgres authorization, run `npm run e2e:admin-user-bots:db:managed:matrix` to prove the selected-user aggregate heartbeat row against populated DB scenarios and screenshots.
4. Consider the remaining UX polish as a separate phase: promote aggregate heartbeat into the top metric row of `BotLaunchReadinessPanel`, and add dashboard/safety CTAs to settings/setup continuity blocks.
