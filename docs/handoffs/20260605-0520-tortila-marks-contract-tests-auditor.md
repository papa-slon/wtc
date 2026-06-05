# tortila-marks-contract-tests-auditor handoff
## Scope
Read-only Phase 4.52 tests/gates audit for the Tortila no-`/api/marks` contract boundary. Scope covered Tortila adapter mapping tests, worker snapshot persistence, bot statistics/user UI guards, selected-user admin DB harness/e2e coverage, contract/static tests, and local gate wiring.

Goal: identify focused tests needed if `docs/CONTRACTS/tortila-adapter.md` is cleaned so `/api/marks` is excluded and no UI treats mark-derived placeholders as live PnL.

No code, app docs, tests, env values, live services, databases, browser sessions, bot runtime, provider state, exchange state, or live-control path was changed. The only filesystem write is this required handoff. Codex background/thread agent tools were not exposed in this session after tool discovery; this is one foreground tests-runner auditor handoff, with no N-agent claim and no background agents left running.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md`
- `docs/handoffs/20260605-0510-tortila-final-parity-tests-auditor.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/ARCHITECTURE.md`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/gates.mjs`
- `package.json`

## Files changed
None - read-only audit. Required handoff written at `docs/handoffs/20260605-0520-tortila-marks-contract-tests-auditor.md`.

## Findings
1. Severity P1 - The Tortila contract still contradicts itself about `/api/marks`, and there is no focused contract-static test to prevent the contradiction from returning after cleanup. Evidence: `docs/CONTRACTS/tortila-adapter.md:62` lists `/api/marks` as a normal consumed endpoint for "Open position display"; `docs/CONTRACTS/tortila-adapter.md:250` through `docs/CONTRACTS/tortila-adapter.md:263` says it is excluded and WTC must not call it; `docs/CONTRACTS/tortila-adapter.md:423` through `docs/CONTRACTS/tortila-adapter.md:447` still describes marks polling and timeout behavior; `docs/CONTRACTS/tortila-adapter.md:511` still names a `marks - BingX down` integration test; `docs/BOT_INTEGRATION_PLAN.md:266` still says positions can use `/api/marks`, while `docs/BOT_INTEGRATION_PLAN.md:282` says never consume it. Recommendation: add a static contract test, likely `tests/integration/tortila-marks-contract-static.test.ts`, that allows `/api/marks` only in explicit excluded/reference/no-consume text and fails on endpoint tables, polling intervals, timeout rows, or test matrices that imply WTC consumption. Target part: contract/docs static safety.

2. Severity P1 - Adapter mapping tests prove the placeholder values, but not that downstream UI treats those placeholders as unavailable PnL. Evidence: `packages/bot-adapters/src/tortila/tortila.mapping.ts:155` through `packages/bot-adapters/src/tortila/tortila.mapping.ts:174` maps Tortila positions to `markPrice = avg_entry` and `unrealizedPnl = 0` with a UI warning not to render it as a real zero; `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts:475` through `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts:492` asserts only the placeholder numbers; `tests/integration/two-bot-continuity-contract-static.test.ts:149` checks the HTTP adapter text contains `NEVER calls /api/marks`, not UI placeholder rendering. Recommendation: extend the mapper/static suite so a real Tortila placeholder carries or implies an unavailable marker that web/admin tests can assert, and add a no-live-PnL UI test that fails if Tortila real-mode branches render `fmtMoney(metrics.unrealizedPnl)` or `fmtNum(p.markPrice)` without the unavailable guard. Target part: adapter-to-UI placeholder contract.

3. Severity P1 - User-facing bot pages have real-mode `markUnavailable` guards, but existing tests mostly pin provenance copy rather than the actual Mark/uPnL cells and Unrealized PnL card. Evidence: `/app/bots/statistics` derives `markUnavailable` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:295` and uses it for the Unrealized PnL card at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:491`; the bot dashboard uses the guard at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:251` and table cells at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:281` through `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:282`; the positions page uses the same pattern at `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:14` and `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:57` through `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:58`; current statistics tests assert no `/api/marks` provenance copy at `tests/integration/bot-statistics-completion.test.ts:44` through `tests/integration/bot-statistics-completion.test.ts:51` and `tests/e2e/bot-statistics.spec.ts:55` through `tests/e2e/bot-statistics.spec.ts:58`. Recommendation: add focused static/rendered assertions that Tortila real-mode position Mark/uPnL and Unrealized PnL render `N/A` even when persisted/adapter data contains `markPrice = entryPrice` and `unrealizedPnl = 0`; keep mock-mode sample numbers allowed only under visible simulated-data copy. Target part: user bot statistics/dashboard/positions surfaces.

4. Severity P1 - The selected-user admin page currently renders persisted Tortila `unrealizedPnlUsd`, position `markPrice`, and position `uPnL` directly, so it needs the most focused test before claiming no UI treats placeholders as live PnL. Evidence: admin selected-user metrics render `Unrealized PnL` from `bot.latestMetric.unrealizedPnlUsd` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:882`; position `Mark` and `uPnL` render raw fields at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:939` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:940`; the loader projects those DB fields directly at `apps/web/src/features/admin/user-bot-detail-loader.ts:130` through `apps/web/src/features/admin/user-bot-detail-loader.ts:173`; the current fixture seeds live-looking Tortila values at `tests/integration/admin-user-bot-detail-loader.test.ts:245` through `tests/integration/admin-user-bot-detail-loader.test.ts:291`; the admin browser test asserts only the no-live-call copy at `tests/e2e/admin-user-bot-detail-db.spec.ts:293` through `tests/e2e/admin-user-bot-detail-db.spec.ts:297`. Recommendation: add a real-Tortila-placeholder fixture path in `scripts/prepare-admin-user-bot-detail-e2e.ts` and the matching static/loader/e2e assertions: sourceAdapter `tortila`, `markPrice == entryPrice`, `unrealizedPnlUsd == 0` must render as unavailable/not live, while closed PnL/trades/equity remain visible. Target part: selected-user admin DB harness and rendered acceptance.

5. Severity P1 - Worker snapshot tests do not yet lock the persistence boundary for Tortila placeholder mark/uPnL values. Evidence: `apps/worker/src/jobs.ts:196` through `apps/worker/src/jobs.ts:226` persists finite `metrics.unrealizedPnl`, `p.markPrice`, and `p.unrealizedPnl` into DB snapshots; `tests/integration/worker-tortila-snapshot.test.ts:66` through `tests/integration/worker-tortila-snapshot.test.ts:68` checks position rows exist and include `NEAR-USDT`, but not whether real Tortila placeholder mark/uPnL is distinguishable from live mark data; the user DB read model maps missing `markPrice` to `entryPrice` and missing `unrealizedPnlUsd` to zero at `apps/web/src/features/bots/data.tsx:575` through `apps/web/src/features/bots/data.tsx:588`. Recommendation: add a focused worker PGlite test with a fake real Tortila adapter returning placeholder mark/uPnL, then assert the persisted/read model path carries enough source/unavailable state for UI to show `N/A`; if the current schema cannot express that, the test should fail and force a tiny DTO/raw metadata addition rather than blessing raw zero. Target part: worker snapshot and read-model boundary.

6. Severity P2 - Existing local gates will run many related checks, but none is specifically named as the Tortila no-`/api/marks` contract gate. Evidence: `package.json:23` and `package.json:46` expose the two-bot continuity contract; `package.json:36` through `package.json:38` expose the admin selected-user DB matrix separately; `scripts/gates.mjs:131` through `scripts/gates.mjs:175` wires continuity/local/rendered plans but no dedicated Tortila marks-contract test. Recommendation: do not add a broad new runner yet; make the new static/worker/admin tests part of normal `npm test`, and document the focused acceptance command in the next implementation handoff. Target part: gate reporting.

## Decisions
1. The next implementation should be test-first around the no-`/api/marks` boundary: contract static guard, adapter/worker placeholder guard, user UI guard, and selected-user admin DB guard.
2. The selected-user admin rendered path is the highest-value downstream test because it currently prints persisted mark/uPnL fields directly while Phase 4.51 only pinned no-live-call provenance copy.
3. Contract cleanup should remove active `/api/marks` consumption language from `docs/CONTRACTS/tortila-adapter.md` and reconcile `docs/BOT_INTEGRATION_PLAN.md`, but this audit did not edit those docs.
4. No new npm script is required for the first cleanup slice; the focused tests can run directly and then be covered by root `npm test`.
5. Mock adapter live-looking values may remain for simulated demo UX only if the rendered UI visibly marks them as simulated, as in `packages/bot-adapters/src/mock-tortila.ts:46` and current simulated-data banners.

## Risks
1. The worktree was heavily dirty before this audit; this handoff does not classify or revert unrelated modified/untracked files.
2. No background agent tool was available in this Codex session; this is a single foreground auditor handoff and does not satisfy an N-agent broad-phase claim.
3. The recommended tests may expose small code/data-contract changes, especially on the selected-user admin and worker/read-model path.
4. If only the contract doc is cleaned, the UI can still overclaim placeholder zero/uPnL values unless the downstream tests are added in the same slice.
5. No env, live journal, exchange, provider, SSH/systemd/tmux, or live-control gate was touched.

## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with a large pre-existing dirty/untracked tree.
2. Tool discovery for Codex thread/background-agent tools - no usable `create_thread`, `send_message_to_thread`, `read_thread`, or close/archive thread tool was exposed; unrelated GitHub/Figma tools were found.
3. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and the Phase 4.51 aggregate/tests handoff.
4. Read-only `rg -n`, `Select-String`, and numbered source inspections over the files listed above.

NOT RUN:
1. `npx vitest run ...` - not run because this was read-only except for the handoff and no implementation tests were changed.
2. `npm test` - not run because it can write coverage/cache/output and this phase was an audit-only handoff.
3. `npm run accept:bots:rendered` - not run because it starts Playwright and can overwrite screenshots/logs.
4. `npm run accept:bots:local` - not run because it writes `logs/gates`, runs worker smoke, starts rendered E2E, and inventories screenshots.
5. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; managed DB/browser proof is outside this read-only audit and requires approved throwaway DB env.
6. `npm run accept:worker:continuity:managed` - not run; managed worker continuity is outside this read-only audit and requires approved throwaway DB env.
7. Real Tortila journal reads, `/api/marks`, exchange ping, provider probes, live bot start/stop/apply-config, SSH/systemd/tmux, production deploy, GitHub CI, and monitoring - not run by safety protocol and scope.

Recommended focused gates after the test/docs cleanup:
1. `npx vitest run packages/bot-adapters/src/__tests__/tortila-mapping.test.ts tests/integration/tortila-marks-contract-static.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
2. `npm run typecheck -w @wtc/web`
3. `npm run typecheck`
4. `npm run secret:scan`
5. `npm run governance:check`
6. `git diff --check`
7. If rendered DB proof is in scope and approved env is supplied: `npm run e2e:admin-user-bots:db:managed:matrix`, followed by screenshot/artifact inventory and review before retaining evidence.

## Next actions
1. Add `tests/integration/tortila-marks-contract-static.test.ts` and clean `docs/CONTRACTS/tortila-adapter.md` plus `docs/BOT_INTEGRATION_PLAN.md` so `/api/marks` is consistently excluded from WTC consumption.
2. Extend mapper/worker tests so Tortila placeholder `markPrice = entryPrice` and `unrealizedPnl = 0` cannot become live PnL in DB/read models.
3. Extend user bot UI tests to assert Tortila real-mode Mark/uPnL/Unrealized PnL render unavailable, not numeric placeholder values.
4. Extend selected-user admin static, loader, DB harness, and rendered DB spec to cover a real-Tortila-placeholder fixture and keep no-`/api/marks` copy row-scoped.
5. Keep live journal/env/source/worker-continuity/deploy gates as separate phases; do not fold live reads or bot control into this contract cleanup.
