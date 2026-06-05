# ecosystem-security-auditor handoff
## Scope
Read-only Phase 4.53 audit of Tortila user-facing runtime and position safety after Phase 4.52. Scope checked that WTC does not call `/api/marks`, that real-mode Tortila mark/unrealized PnL placeholders cannot become user-facing live proof, and that no secrets, raw provider payloads, exchange probes, or live-control affordances are introduced on the inspected user/admin surfaces.

No live servers, env values, secrets, exchanges, `/api/marks`, provider probes, or bot controls were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/ARCHITECTURE.md`
- `apps/worker/src/jobs.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - The runtime adapter and worker still enforce the no-`/api/marks` boundary for Tortila reads. Evidence: `packages/bot-adapters/src/http.ts:78` through `packages/bot-adapters/src/http.ts:85` lists only health, summary, trades, and equity endpoints and states the adapter never calls `/api/marks`; `packages/bot-adapters/src/http.ts:186` through `packages/bot-adapters/src/http.ts:247` fetches `/api/summary`, `/api/trades/list`, and `/api/equity`, then maps positions from `summary.open_position_summaries`; `apps/worker/src/jobs.ts:9` through `apps/worker/src/jobs.ts:14` and `apps/worker/src/jobs.ts:108` through `apps/worker/src/jobs.ts:112` repeat that the snapshot job is read-only and never calls `/api/marks`. Recommendation: keep the adapter/worker call graph unchanged; do not add a marks proxy, route, poller, or fallback. Target part: Tortila HTTP adapter and worker snapshot job.
2. Severity P1 - Real-mode worker position snapshots no longer persist Tortila mark/uPnL placeholders, which prevents real journal placeholders from becoming stored position proof. Evidence: `packages/bot-adapters/src/tortila/tortila.mapping.ts:154` through `packages/bot-adapters/src/tortila/tortila.mapping.ts:174` documents `markPrice = avg_entry` and `unrealizedPnl = 0` as unavailable placeholders; `apps/worker/src/jobs.ts:216` through `apps/worker/src/jobs.ts:228` gates `markPrice` and `unrealizedPnlUsd` persistence behind `adapter.mode !== 'real'`. Recommendation: preserve this real-mode omission and add regression coverage if later position fields are refactored. Target part: worker position persistence.
3. Severity P1 - The user dashboard and user positions page render Tortila real-mode mark/uPnL as `N/A`, so the primary user-facing path does not display placeholder `0` or entry-as-mark values as live proof. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:130` through `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:132` derives `markUnavailable` for `tortila_bot` real mode; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:249` through `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:252` renders the Unrealized PnL card as `N/A`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:273` through `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:282` renders position Mark/uPnL as `N/A`; `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:11` through `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:14` derives the same guard and `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:57` through `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:58` renders Mark/uPnL as `N/A`. Recommendation: keep real-mode display gated by `meta.code === 'tortila_bot' && read.adapterMode === 'real'`; if a per-position source field is exposed later, prefer row-level source over page-level mode. Target part: user bot dashboard and positions page.
4. Severity P2 - The DB-backed user loader can theoretically misclassify a Tortila position row if snapshot sources are mixed, because `adapterMode` is derived from the first available latest metric/position/trade source rather than the source of each rendered position. Evidence: `apps/web/src/features/bots/data.tsx:511` through `apps/web/src/features/bots/data.tsx:520` selects the latest position source, but `apps/web/src/features/bots/data.tsx:533` through `apps/web/src/features/bots/data.tsx:535` chooses `sourceAdapter` in metric-first order; `apps/web/src/features/bots/data.tsx:575` through `apps/web/src/features/bots/data.tsx:587` then returns canonical positions without their row `sourceAdapter`, so `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:14` can only use page-level `read.adapterMode`. Recommendation: carry position row source/unavailability metadata into the read model or derive `markUnavailable` from `latestPosition.sourceAdapter` when rendering positions, so a newer/older metric snapshot cannot make real Tortila positions look mock. Target part: `apps/web/src/features/bots/data.tsx` and user position renderers.
5. Severity P2 - Selected-user admin now guards Tortila position Mark/uPnL, but the Unrealized PnL metric card still renders `bot.latestMetric.unrealizedPnlUsd` directly for Tortila. Evidence: admin helper functions return `N/A` for Tortila positions at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:57` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:69`, and the table uses them at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:954` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:955`; however the metric card at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:897` renders `bot.latestMetric.unrealizedPnlUsd ?? '-'` without a Tortila `N/A` guard. Recommendation: render selected-user admin Tortila metric-level Unrealized PnL as `N/A` too, or prove the loader never supplies a real-mode Tortila `unrealizedPnlUsd` metric placeholder. Target part: selected-user admin statistics metric card.
6. Severity P2 - The Tortila contract is improved but still contains active-looking marks artifacts that can reintroduce the wrong acceptance target. Evidence: `docs/CONTRACTS/tortila-adapter.md:249` through `docs/CONTRACTS/tortila-adapter.md:264` says `/api/marks` is excluded/reference-only, and `docs/CONTRACTS/tortila-adapter.md:424` through `docs/CONTRACTS/tortila-adapter.md:425` says the worker must never poll it; however `docs/CONTRACTS/tortila-adapter.md:441` through `docs/CONTRACTS/tortila-adapter.md:445` still lists a "Marks endpoint" timeout, and `docs/CONTRACTS/tortila-adapter.md:505` through `docs/CONTRACTS/tortila-adapter.md:509` still lists a `marks - BingX down` integration test. Recommendation: remove or relabel those rows as forbidden/reference-only static documentation checks, not WTC runtime integration tests. Target part: Tortila adapter contract tests/timeouts section.
7. Severity P2 - Current tests cover the adapter/worker/admin no-marks boundary but do not pin the user dashboard/positions cell behavior directly. Evidence: `tests/integration/two-bot-continuity-contract-static.test.ts:152` through `tests/integration/two-bot-continuity-contract-static.test.ts:162` checks no `/api/marks`, worker placeholder gating, and selected-user admin helpers; `tests/integration/admin-user-bot-detail-static.test.ts:247` through `tests/integration/admin-user-bot-detail-static.test.ts:255` checks admin journal gate and position helper names; `tests/e2e/admin-user-bot-detail-db.spec.ts:291` through `tests/e2e/admin-user-bot-detail-db.spec.ts:306` checks selected-user admin `N/A` cells; `tests/integration/bot-read-safety-static.test.ts:343` through `tests/integration/bot-read-safety-static.test.ts:356` checks warnings/no-green-copy but not Tortila real-mode Mark/uPnL cells. Recommendation: add focused static or rendered assertions for `/app/bots/tortila` and `/app/bots/tortila/positions` that fail if real-mode Tortila Mark/uPnL or Unrealized PnL use `fmtNum(p.markPrice)` / `fmtMoney(p.unrealizedPnl)` without the unavailable guard. Target part: user bot read-safety tests.

## Decisions
1. Treat `/api/marks` as permanently excluded from WTC. This audit does not recommend any marks route, proxy, poller, or exchange ping.
2. Treat Tortila real-mode mark price and unrealized PnL as unavailable on user/admin surfaces, even if old mock or historical placeholder values exist in storage.
3. Treat mock Tortila values as allowed only under visible simulated-data copy.
4. Did not inspect or mutate live env, live servers, live Tortila journal endpoints, exchange state, or bot controls.

## Risks
1. Mixed-source DB snapshots could let user-facing positions rely on a page-level mock/real mode that is not the rendered position row's source.
2. Selected-user admin metric-level Unrealized PnL still has a direct value path that is not as strict as the position table guard.
3. Contract rows for marks timeout and marks integration tests may confuse future implementers into treating `/api/marks` as a WTC acceptance gate.
4. Real Tortila journal/auth/firewall, worker continuity, source-config provenance, safety-signal ingestion, and identity scope remain unresolved gates.

## Verification/tests
RUN:
1. Read required protocol and status docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`.
2. Static source inspection with `rg`/line-numbered `Get-Content` over the scoped worker, adapter, web, contract, and tests files.
3. `git status --short --branch` was observed before writing this handoff; the tree was already dirty with many pre-existing modified/untracked files.

NOT RUN:
1. No Vitest, Playwright, typecheck, build, governance, secret scan, or `git diff --check` were run in this read-only audit.
2. No managed DB gates were run; DB env was not requested or inspected.
3. No real Tortila journal reads, `/api/marks`, exchange pings, provider probes, live bot start/stop/apply-config, deploy, SSH/systemd/tmux, or CI were run.

## Next actions
1. Add a row-source or mark-unavailable field to the user bot read model so real Tortila positions render `N/A` based on the position snapshot source, not metric-first page mode.
2. Guard selected-user admin metric-level Tortila Unrealized PnL as `N/A`, matching the position table behavior.
3. Clean `docs/CONTRACTS/tortila-adapter.md` marks timeout/test rows so `/api/marks` appears only as excluded/reference-only documentation.
4. Add focused user dashboard/positions tests that pin Tortila real-mode Mark/uPnL and Unrealized PnL as `N/A`.
