# Handoff: ecosystem-backend-implementer-tortila
Epoch: 20260530-1355
Agent: ecosystem-backend-implementer (Tortila adapter + worker)
Role: Workstream B + C-worker — Tortila adapter schemas, fixtures, mapping, HTTP wiring, worker job

---

## Scope

Implemented the complete read-only Tortila journal adapter (Workstream B) and the tortila-journal
health/snapshot worker job (Workstream C-worker). All test gates pass (220/5, all green).

---

## Files inspected

`bot_tortila/src/turtle_bot/journal/{app.py,metrics.py}`, `state/{models,store}.py`, `packages/analytics/src/*`, `packages/bot-adapters/src/*`, and `20260530-1355-ecosystem-tortila-journal-auditor.md` + `20260530-1355-ecosystem-bot-runtime-auditor.md`.

## Findings

No new findings — implemented the tortila-journal auditor's F-03..F-08 (Zod schemas, 8 fixtures, mapping rules incl. fees sign-inversion + `winRatePct` null-when-no-trades + unavailable mark price + `filterZeroEquity`).

## Risks

Adapter is read-only + fixtures-only in tests; never live HTTP/SSH; never consumes `/api/marks` (bot owns the exchange). Control disabled; legacy adapter BLOCKED. Worker collector env-guarded (`TORTILA_JOURNAL_URL`; `not_configured` when absent). Real-PG NOT RUN.

## Verification/tests

typecheck clean; npm test 220/5 (25 files; +35 fixture-only tests T-01..T-20 + W-01..W-06); check:core 7/7. Final phase gates in the aggregate table.

## Files changed

- `packages/bot-adapters/src/tortila/tortila.schemas.ts` (NEW)
- `packages/bot-adapters/src/tortila/tortila.mapping.ts` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/health.valid.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/health.down.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/health.malformed.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/summary.valid.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/summary.no_trades.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/summary.missing_field.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/equity.valid.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/equity.empty.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/equity.length_mismatch.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/trades_list.valid.json` (NEW)
- `packages/bot-adapters/src/__fixtures__/tortila/trades_list.missing_fees.json` (NEW)
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts` (NEW — T-01..T-20 + W-01..W-06)
- `packages/bot-adapters/src/http.ts` (MODIFIED — wired real Tortila getMetrics/getPositions/getTrades/getEquityCurve)
- `apps/worker/src/jobs.ts` (MODIFIED — added snapshotTortilaJournal)
- `apps/worker/src/index.ts` (MODIFIED — wired snapshotTortilaJournal into dbTick)

---

## Implementation summary

### 1. Zod schemas (`tortila.schemas.ts`)

Four schemas derived from verified journal source (F-03..F-06 in tortila-journal-auditor):
- `TortilaHealthSchema` — `/api/health` shape
- `TortilaPositionSummarySchema` + `TortilaSummarySchema` — `/api/summary`
- `TortilaTradeRowSchema` + `TortilaTradeListSchema` — `/api/trades/list`
- `TortilaEquityCurveSchema` — `/api/equity` with `.refine(ts.length === equity.length)`

Critical comments in the schema file:
- `net_pnl` is documented as "DO NOT use for netPnlWithFees — use net_pnl_with_fees"
- `fees_pnl` is documented as "NEGATIVE (stored as a cost); use Math.abs for canonical fee"
- `qty` is documented as "ALWAYS null for closed trades from this endpoint"

### 2. Fixtures (`__fixtures__/tortila/`)

8 JSON fixtures — all synthetic numbers, no exchange keys:
- `health.valid.json`, `health.down.json`, `health.malformed.json`
- `summary.valid.json`, `summary.no_trades.json`, `summary.missing_field.json`
- `equity.valid.json`, `equity.empty.json`, `equity.length_mismatch.json`
- `trades_list.valid.json`, `trades_list.missing_fees.json`

### 3. Mapping functions (`tortila.mapping.ts`)

- `healthToCanonical`: injects `TORTILA_PERSISTENT_WARNINGS`; status always `'degraded'`
- `summaryToMetricsInput`: `feesTotal = Math.abs(fees_total)`; `winRatePct = null` when trades_total === 0
- `tradeRowToCanonical`: `fee = Math.abs(row.fees_pnl)`; `qty = row.qty ?? 0`; `realizedPnl = gross_pnl`
- `positionSummaryToCanonical`: `markPrice = avg_entry`; `unrealizedPnl = 0` (documented as unavailable)
- `equityCurveToPoints`: applies `filterZeroEquity` (GAP-F defence-in-depth); filters NaN timestamps

### 4. HTTP adapter wiring (`http.ts`)

`createHttpTortilaAdapter` now implements:
- `getHealth` — uses `TortilaHealthSchema.safeParse`; fail-closed on parse failure or network error
- `getMetrics` — GET `/api/summary` + all pages of `/api/trades/list` + `/api/equity`; calls `computeMetrics`
- `getPositions` — GET `/api/summary` → `open_position_summaries`
- `getTrades` — paginated GET `/api/trades/list` (page_size=500, all pages)
- `getEquityCurve` — GET `/api/equity`; applies `equityCurveToPoints` (filterZeroEquity included)

All data methods: network errors are caught and wrapped in `AdapterNotReadyError` (existing test
`adapters.test.ts:21` expects `AdapterNotReadyError` on failed fetch — preserved).
`/api/marks` is never called.

### 5. Worker job (`jobs.ts` + `index.ts`)

`snapshotTortilaJournal(db, adapter, botInstanceId, now)`:
- Calls `adapter.getHealth()` (never throws)
- Calls `adapter.getMetrics(botInstanceId)` inside a try/catch; `AdapterNotReadyError` is swallowed
- Writes `insertBotMetricSnapshot` with `snapshotAt: new Date(now)` (not epoch-ms — Finding 6)
- `sourceAdapter: 'tortila-mock'` when mock; `'tortila'` when real
- Writes `recordHealthCheck(db, 'tortila-journal', status, detail)`
- On any outer error: writes `recordHealthCheck(db, 'tortila-journal', 'error', {error: msg})` and returns

`dbTick` in `index.ts`:
- Reads `BOT_ADAPTER_MODE` and `TORTILA_JOURNAL_URL` directly from `process.env` (not from apps/web)
- Resolves `botInstanceId` from `SYSTEM_BOT_INSTANCE_ID` env var, OR calls `ensureBotInstance` with `SYSTEM_BOT_OWNER_ID`
- If neither is set: records `not_configured` health check and logs a warning, does NOT crash
- `getBotAdapter` called with same double-guard as factory.ts (mode + tortilaBaseUrl)

---

## Safety boundaries confirmed (unchanged from pre-Phase 2.4)

- `startBot / stopBot / applyConfig` throw `BotControlDisabledError` unconditionally in all adapters
- `/api/marks` is never called from WTC (documented in both schemas and http.ts)
- No live exchange calls, no SSH, no tmux, no systemd interaction
- Legacy real adapter stays BLOCKED (`getConfig` throws `AdapterNotReadyError` with plaintext-key comment)
- `BOT_ADAPTER_MODE` defaults to `'mock'`; real HTTP requires both mode + tortilaBaseUrl (double-guard)

---

## Test results

```
Test Files  25 passed (25)
Tests       220 passed | 5 skipped (225)
```

New tests: tortila-mapping.test.ts — 35 assertions (T-01..T-20 + W-01..W-06 + additional schema-mismatch/position coverage)
Existing adapters.test.ts — all 5 tests still passing (including the critical AdapterNotReadyError stub test)

`npm run typecheck` — clean
`npm run check:core` — all 7 smoke checks pass

---

## Decisions

### D-01: Network errors in real data methods are wrapped in AdapterNotReadyError
The existing `adapters.test.ts:21` test asserts that `getMetrics` throws `AdapterNotReadyError`
when called against a closed port. The real adapter now wraps fetch errors in `AdapterNotReadyError`
(with a detail string), preserving this contract. The distinction between "not yet implemented"
and "network failure" is in the detail string, not the error class.

### D-02: snapshotTortilaJournal runs in mock mode by default
When neither `TORTILA_JOURNAL_URL` nor `SYSTEM_BOT_INSTANCE_ID` + `SYSTEM_BOT_OWNER_ID` are set,
the job logs a warning and writes a `not_configured` health check. This is honest (GAP-H from
prior phases) — operators can see exactly what is needed.

### D-03: getMetrics equity failure is non-fatal
If `/api/equity` fails or has a mismatched schema, the metric snapshot proceeds with an empty
equity curve. `computeMetrics` handles empty curves correctly (drawdown returns nulls). This
prevents a transient equity endpoint issue from blocking the full snapshot.

---

## Remaining (out-of-scope for this agent)

- `apps/web/src/app/admin/bots/page.tsx` — replace Placeholder (owned by admin-ops agent)
- `apps/web/src/features/bots/adapter-safe.ts` — AdapterNotReadyError wrappers for bot pages (owned by product-surfaces agent)
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx` — mock-data banner (owned by product-surfaces agent)
- `docs/CONTRACTS/tortila-adapter.md` — field vocabulary update (contract-docs agent)
- Migration 0003 additive index on `integration_health_checks(target, checkedAt DESC)` (db-architect)

---

## Next actions for downstream agents

- **admin-ops agent**: implement `/admin/bots` page per Finding 3 in bot-runtime-auditor handoff;
  query `integration_health_checks WHERE target='tortila-journal'` and `bot_metric_snapshots`
- **product-surfaces agent**: add `safeGetMetrics` / `safeGetPositions` / `safeGetTrades` wrappers
  in `apps/web/src/features/bots/adapter-safe.ts` (Finding 4 in bot-runtime-auditor); add mock-data
  banner to `safety/page.tsx` (Finding 5)
- **db-architect**: add `ihc_target_checked_at_idx` index in migration 0003 (Finding 7)
