# tortila-marks-contract-safety-auditor handoff

## Scope
Read-only Phase 4.52 audit of the Tortila `/api/marks` contract boundary. The goal was to verify whether WTC consistently excludes `/api/marks`, identify any docs/code/test contradictions, and recommend the smallest follow-up changes that prevent mark-price placeholders from being shown as live unrealized PnL.

No env values were read or printed. No live services, journal endpoints, exchange probes, bot control, SSH, systemd, tmux, or server mutation were used. No code was edited.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/ARCHITECTURE.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/tortila/tortila.schemas.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
None - read-only audit. This handoff file is the only artifact written for the audit.

## Findings
1. Severity P1 - `docs/CONTRACTS/tortila-adapter.md` contradicts itself on `/api/marks`. Evidence: the required endpoint table lists `/api/marks` as an open-position display endpoint at `docs/CONTRACTS/tortila-adapter.md:53-62`, but the same document says `NEVER CONSUME FROM WTC` at `docs/CONTRACTS/tortila-adapter.md:250-263` and `EXCLUDED - never consumed` at `docs/CONTRACTS/tortila-adapter.md:456-460`. The rate-limit and timeout sections also specify WTC polling/timeout behavior for marks at `docs/CONTRACTS/tortila-adapter.md:421-447`. Recommendation: docs-only cleanup in `docs/CONTRACTS/tortila-adapter.md`: remove `/api/marks` from Required Endpoints, remove marks polling/cache bullets, remove the `/api/marks` polling row, remove the marks timeout row, and rename the marks section to `GET /api/marks (excluded - reference only)`. Target part: Tortila adapter contract.

2. Severity P1 - `docs/ARCHITECTURE.md` and `docs/BOT_INTEGRATION_PLAN.md` still imply a WTC marks path even though the current contract excludes it. Evidence: `docs/ARCHITECTURE.md:192-200` lists a phantom WTC route `GET /api/bots/tortila/marks`, while `docs/BOT_INTEGRATION_PLAN.md:261-266` says `getPositions()` may use `/api/marks` for live mark prices; this conflicts with `docs/BOT_INTEGRATION_PLAN.md:282`, which says `/api/marks` is excluded. Recommendation: remove the phantom architecture route; change the `getPositions()` row to say `/api/summary.open_position_summaries` only, with `/api/marks` permanently excluded and mark/unrealized values unavailable/N/A for Tortila. Target part: architecture and integration-plan docs.

3. Severity P2 - The contract documents `TortilaOverviewSchema` with nested `marks`, but the implementation does not define or consume a WTC marks schema. Evidence: `docs/CONTRACTS/tortila-adapter.md:168-192` includes `marks: z.record(... TortilaMarkSchema ...)`; current implementation files only expose the safe summary/trade/equity schemas, and `packages/bot-adapters/src/tortila/tortila.schemas.ts:13` explicitly says not to call `/api/marks`. Recommendation: label the overview bundle and nested marks schema as reference-only/not implemented in WTC, or remove the nested `marks` field from the WTC contract excerpt. Target part: Tortila adapter contract docs.

4. Severity P1 - Runtime adapter and worker code currently exclude `/api/marks`; no adapter/worker HTTP call change is needed to enforce exclusion. Evidence: `packages/bot-adapters/src/http.ts:76-85` lists implemented endpoints and says it never calls `/api/marks`; `packages/bot-adapters/src/http.ts:186-247` fetches `/api/summary`, `/api/trades/list`, and `/api/equity`, then maps positions from `summary.open_position_summaries`; `apps/worker/src/jobs.ts:108-110` repeats that the worker never calls marks. Recommendation: keep the adapter boundary as-is; future implementation should not add a marks route or poller. Target part: Tortila HTTP adapter and worker snapshot job.

5. Severity P1 - Real Tortila position mapping intentionally creates placeholder mark/unrealized values, so UI/storage must not present those placeholders as live PnL. Evidence: `packages/bot-adapters/src/tortila/tortila.mapping.ts:12-16` says mark price and unrealized PnL are unavailable without `/api/marks`; `packages/bot-adapters/src/tortila/tortila.mapping.ts:155-174` sets `markPrice = avg_entry` and `unrealizedPnl = 0`, with comments requiring UI to show N/A. `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts:475-492` pins those placeholders. Recommendation: keep mapping tests, but add downstream guards so placeholder `0` never reads as live PnL. Target part: worker persistence and UI rendering.

6. Severity P1 - The user Tortila statistics page already hides real Tortila mark/uPnL values, but the selected-user admin page does not. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:295` computes `markUnavailable` for real Tortila, and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:202-204` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:491` render Mark/uPnL/Unrealized PnL as `N/A`. `apps/web/src/features/bots/statistics-panels.tsx:89-100` also states no `/api/marks` probe. In contrast, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:882` renders `bot.latestMetric.unrealizedPnlUsd` directly, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:930-940` renders position `Mark` and `uPnL` directly for all bots. Recommendation: add an admin-side Tortila real-source guard and render `N/A` plus "mark price unavailable; /api/marks excluded" copy for Tortila sourceAdapter `tortila` rows. Target part: selected-user admin bot drilldown.

7. Severity P2 - Worker persistence currently writes placeholder mark/unrealized fields from real Tortila canonical positions into DB snapshots. Evidence: `apps/worker/src/jobs.ts:127` uses `sourceAdapter = 'tortila'` for real mode; `apps/worker/src/jobs.ts:197` writes `metrics.unrealizedPnl`; `apps/worker/src/jobs.ts:225-226` writes finite `markPrice` and `unrealizedPnlUsd` for positions. Because real mapping sets these placeholders to entry/zero, historical rows can later be rendered as live values unless every consumer guards them. Recommendation: in `apps/worker/src/jobs.ts`, omit `unrealizedPnlUsd`, `markPrice`, and position `unrealizedPnlUsd` when `sourceAdapter === 'tortila'`; keep mock/demo values for `tortila-mock`. Target part: worker snapshot persistence.

8. Severity P2 - Tests prove no marks call and user-statistics copy, but do not yet prevent selected-user admin placeholder rendering. Evidence: `tests/integration/two-bot-continuity-contract-static.test.ts:135-150` checks the adapter text contains `NEVER calls /api/marks`; `tests/integration/bot-statistics-completion.test.ts:44-51` checks user statistics copy; `tests/e2e/bot-statistics.spec.ts:55-58` checks rendered user Tortila no-marks copy; selected-user admin tests currently assert the journal gate copy at `tests/e2e/admin-user-bot-detail-db.spec.ts:291-301`. The admin DB fixture still seeds Tortila position `markPrice: '105.00000000'` and `unrealizedPnlUsd: '12.5000'` at `scripts/prepare-admin-user-bot-detail-e2e.ts:398-410`. Recommendation: add row-scoped admin tests that seed a real Tortila placeholder (`sourceAdapter: 'tortila'`, mark equals entry, unrealized equals 0) and assert `Unrealized PnL`, `Mark`, and `uPnL` render as `N/A` instead of live values. Target part: selected-user admin static and DB rendered tests.

## Decisions
1. Treat `/api/marks` as permanently excluded from WTC, not a future adapter option.
2. Do not recommend adding a WTC marks route, marks proxy, marks poller, or exchange ping.
3. Keep the current Tortila adapter's safe source path: `/api/health`, `/api/summary`, `/api/trades/list`, and `/api/equity`.
4. Make the next implementation slice small: docs cleanup, worker omission of real Tortila placeholder mark/uPnL fields, admin UI N/A guard, and focused tests.
5. Do not continue local Legacy/source-proof churn for this issue; this is a distinct Tortila contract-boundary fix.

## Risks
1. If only docs are fixed, existing and future real Tortila DB rows can still carry `markPrice = entry` and `unrealizedPnlUsd = 0`, which another UI may display as live PnL.
2. If only UI is fixed, persisted placeholder rows remain ambiguous for exports, admin loaders, and future surfaces.
3. Mock Tortila intentionally uses demo mark/uPnL values (`packages/bot-adapters/src/mock-tortila.ts:43-47`), so guards must distinguish `tortila` real source from `tortila-mock`.
4. Existing selected-user admin DB fixture values make Tortila mark/uPnL look real; tests should be updated before relying on that fixture for acceptance.
5. This audit did not verify real Tortila journal auth/firewall, managed worker continuity, production deploy, or live journal data.

## Verification/tests
RUN:
1. Read governance/session docs, seed handoff, current status docs, and Phase 4.51 handoff.
2. Checked repo state before edits: branch `codex/bot-analytics-settings-canary-20260603`, latest commit `e2d705f`, and a large pre-existing dirty tree.
3. Confirmed Claude Code agent roster is available with `claude agents`.
4. Ran one read-only advisory `ecosystem-bot-integration-auditor` lane to completion; it found the same docs/code split recorded above.
5. Two additional advisory lanes timed out; their spawned processes from this turn were terminated and older pre-existing Claude processes were left untouched.
6. Ran focused `rg` and line-number reads over the contract docs, adapter, worker, UI, loaders, fixtures, and tests.

NOT RUN:
1. No `npm`/Vitest/Playwright gates were run because this was a read-only contract-boundary audit.
2. No live Tortila journal reads, `/api/marks`, exchange pings, provider probes, bot start/stop/apply-config, SSH, systemd, tmux, deploy, or CI were run.
3. No env-dependent managed DB gates were run; no env values were printed.

## Next actions
1. Docs: update `docs/CONTRACTS/tortila-adapter.md`, `docs/ARCHITECTURE.md`, and `docs/BOT_INTEGRATION_PLAN.md` exactly as described in Findings 1-3.
2. Code: in `apps/worker/src/jobs.ts`, omit real Tortila mark/unrealized placeholder fields from persisted metric/position snapshots when `sourceAdapter === 'tortila'`; keep `tortila-mock` behavior unchanged.
3. Code: in `apps/web/src/app/admin/users/[userId]/bots/page.tsx`, add a real Tortila mark-unavailable guard and render admin `Unrealized PnL`, position `Mark`, and position `uPnL` as `N/A` for real Tortila rows, with short no-`/api/marks` explanatory copy.
4. Tests: expand `tests/integration/two-bot-continuity-contract-static.test.ts` or a focused contract static test to reject `/api/marks` in required endpoints, WTC polling intervals, timeouts, phantom architecture routes, and `getPositions()` alternatives.
5. Tests: update `scripts/prepare-admin-user-bot-detail-e2e.ts`, `tests/integration/admin-user-bot-detail-static.test.ts`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`, and `tests/e2e/admin-user-bot-detail-db.spec.ts` so a real Tortila placeholder fixture renders N/A, while Legacy and `tortila-mock` values remain allowed where intentional.
6. Suggested focused proof after implementation: `npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/worker-tortila-snapshot.test.ts` followed by `npm run typecheck -w @wtc/web` and the managed selected-user DB Playwright gate only when the throwaway DB env is supplied.
