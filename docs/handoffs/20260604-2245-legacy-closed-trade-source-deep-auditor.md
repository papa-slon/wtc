# ecosystem-bot-integration-auditor handoff
## Scope
Phase 4.39 read-only deep audit for Legacy closed-trade/fill source availability. Goal: determine whether any durable local Legacy bot source can support realized PnL, win-rate, and profit-factor import into WTC.

Boundary observed: no live services, no provider calls, no DB mutation, no bot start/stop, no process kill, no raw `.env` reads, no secret/token/DSN/private-endpoint output. Sibling folders under `C:/Users/maxib/GTE BOT` were inspected read-only. The only metadata-only DB inspection was `C:/Users/maxib/GTE BOT/bot_tortila/turtle_bot.db` table names, column names, and counts; no trade rows or payload values were read.

## Files inspected
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-tests-ux-auditor.md`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `C:/Users/maxib/GTE BOT/bot/models.py`
- `C:/Users/maxib/GTE BOT/bot/database.py`
- `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py`
- `C:/Users/maxib/GTE BOT/bot/market_api/bingx_client.py`
- `C:/Users/maxib/GTE BOT/bot/client_server/routes/api_management.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/models.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/engine/orchestrator.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/journal/app.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/journal/metrics.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/_old_bot_source/models.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/old_bot_backtest/dca_engine.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/turtle_bot.db` metadata only: table names, column names, counts.

## Files changed
`docs/handoffs/20260604-2245-legacy-closed-trade-source-deep-auditor.md` only.

## Findings
1. Severity P1 - No durable closed-trade/fill source was proven for the current WTC `legacy_bot` source model. Evidence: local Legacy `Api_Key` owns only `orders`, `settings`, `stage_config`, and `slots` at `C:/Users/maxib/GTE BOT/bot/models.py:91`; `Order` stores order id/type/side/note/price/quantity/position/api_id/system_id/active/stage but no realized PnL, fee, funding, opened/closed trade timestamps, or fill identity at `C:/Users/maxib/GTE BOT/bot/models.py:109`; `Slot` stores stage/active timestamps only at `C:/Users/maxib/GTE BOT/bot/models.py:177`; default table naming confirms these become ordinary model tables, not hidden trade tables, at `C:/Users/maxib/GTE BOT/bot/database.py:50`. Recommendation: keep Legacy closed-trade source status `UNKNOWN_NO_EVIDENCE`; do not import from `orders` or `slots`. Target part: Legacy source model.

2. Severity P1 - Legacy close/order lifecycle code marks runtime state inactive but does not persist economic closed trades or fills. Evidence: `close_slot()` updates `Slot.active=false` and returns a `Slot` at `C:/Users/maxib/GTE BOT/bot/models.py:266`; order helpers add/toggle/delete active order records at `C:/Users/maxib/GTE BOT/bot/models.py:527` and `C:/Users/maxib/GTE BOT/bot/models.py:653`; the Legacy contract states active orders/slots are current state only and closed positions are not retrievable via API at `docs/CONTRACTS/legacy-bot-adapter.md:293`. Recommendation: treat inactive slots/orders as insufficient for realized PnL, win rate, profit factor, fees, funding, and replay. Target part: source semantics/idempotency.

3. Severity P1 - WTC's current Legacy worker intentionally reads only safe provider Postgres runtime state and writes no trade imports. Evidence: `LegacyLiveSnapshotResult` has account/settings/position/provider counters and no trade counters at `apps/worker/src/legacy-live.ts:8`; `LegacyOrderRow` lacks id, timestamp, PnL, fee, funding, or fill fields at `apps/worker/src/legacy-live.ts:83`; `buildLegacyLiveWarnings()` always includes `no_trade_history` at `apps/worker/src/legacy-live.ts:313`; `readLegacyRows()` selects only `api_keys`, settings, `stageconfigs`, active `slots`, and active `orders` at `apps/worker/src/legacy-live.ts:333`; `snapshotLegacyRowsToWtc()` calls only metric/position snapshot repos and writes `closedPnlUsd`, `winRate`, `profitFactor`, fees, and funding as unavailable with `tradeCount: 0` at `apps/worker/src/legacy-live.ts:403` and `apps/worker/src/legacy-live.ts:416`. Recommendation: keep the worker in snapshot-only mode until a real source table/API is proven. Target part: `apps/worker/src/legacy-live.ts`.

4. Severity P1 - A durable local Turtle/Tortila journal source exists, but it is not a proven Legacy source and is not import-safe for Legacy as-is. Evidence: Turtle store defines `unit_fills`, `trades`, and `funding_payments` with economic fields at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:47`, `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:76`, and `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:92`; `TradeRow` contains realized/funding/fee fields at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/models.py:58`; the orchestrator writes trades on normal exit and safety close at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/engine/orchestrator.py:751` and `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/engine/orchestrator.py:1195`. However, that source is the Tortila/Turtle journal path, while WTC maps Tortila via `TORTILA_JOURNAL_URL` and Legacy via separate provider Postgres snapshots at `docs/CONTRACTS/tortila-adapter.md:8`; the WTC adapter factory routes `tortila_bot` to the Tortila HTTP adapter and non-mock `legacy_bot` to the blocked adapter/DB-snapshot path at `packages/bot-adapters/src/factory.ts:26`. Recommendation: do not label Turtle `trades` as Legacy imports; if desired, handle them through Tortila source work or a separate, audited identity-bridging decision. Target part: product/source boundary.

5. Severity P1 - The Turtle/Tortila SQLite schema still lacks the provider/account scope and stable external trade id required by WTC Legacy provider-scoped import. Evidence: WTC provider mapping requires a `bot_provider_accounts.id` scope with provider account identity at `packages/db/src/schema.ts:146`; WTC imported trades require `botProviderAccountId`, `externalTradeId`, symbol/side/entry/exit/size, realized PnL, fees, funding, opened/closed timestamps, `sourceAdapter`, and optional raw JSON at `packages/db/src/schema.ts:564`; repository idempotency branches on provider-scoped versus unscoped unique indexes at `packages/db/src/repositories.ts:2233`. Turtle `trades` uses local autoincrement `id` plus symbol/economics only at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:76`, and `unit_fills` uniqueness is `(symbol, unit_index, client_order_id)` without WTC account ownership at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:47`. Recommendation: do not feed this SQLite table into `legacy_bot` imports unless a future contract adds durable account scope, stable external id semantics, and replay tests. Target part: import idempotency/source mapping.

6. Severity P2 - Local `turtle_bot.db` currently has the relevant journal tables but no local rows to import. Evidence: metadata-only SQLite inspection found tables `trades`, `unit_fills`, and `funding_payments`; columns match `store.py`; counts were `trades=0`, `unit_fills=0`, `funding_payments=0`. File-level schema evidence is `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:76` and `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:47`. Recommendation: treat the DB as proof of a Turtle schema, not proof of available Legacy closed-trade data or an importable local backlog. Target part: local data availability.

7. Severity P2 - Legacy DCA backtest code contains simulated closed trades and statistics, but it is not a durable live bot source. Evidence: `ClosedTrade` has open/close timestamps, qty, entry/exit, and realized PnL in `C:/Users/maxib/GTE BOT/bot_tortila/old_bot_backtest/dca_engine.py:174`; backtest-only `win_rate` and `profit_factor` derive from in-memory `self.trades` at `C:/Users/maxib/GTE BOT/bot_tortila/old_bot_backtest/dca_engine.py:216`; the simulation appends `ClosedTrade` rows during a TP condition at `C:/Users/maxib/GTE BOT/bot_tortila/old_bot_backtest/dca_engine.py:392`. Recommendation: do not use backtest artifacts for WTC realized PnL/win-rate/profit-factor imports; they may inform analytics definitions only. Target part: analytics source eligibility.

8. Severity P1 - WTC destination idempotency is ready, but it is not source evidence. Evidence: Phase 4.31 records that WTC can store provider-scoped imported trades while local Legacy source does not prove a durable source at `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:5`; Phase 4.30 records provider-aware import invariants and explicitly says Legacy source ingestion was not run at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:54` and `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:92`. Recommendation: future work should connect a proven source into `importBotTrade()`; do not infer source availability from `bot_trade_imports`. Target part: DB/import readiness.

9. Severity P1 - User/admin UI must remain honest pending for Legacy performance metrics until a source-backed importer exists. Evidence: `BOT_CAPS.legacy_bot.hasTradeHistory=false` and `hasEquityCurve=false` at `apps/web/src/features/bots/meta.ts:69`; Legacy statistics cards show `pending import`, `PF, win rate, realized PnL pending`, and `Legacy closed-trade history pending` when closed trade count is zero at `apps/web/src/features/bots/statistics-panels.tsx:586`; the canonical analytics model says unavailable Legacy metrics must render N/A rather than zero at `docs/CANONICAL_ANALYTICS_MODEL.md:166` and marks Legacy closed PnL/fees/funding unavailable at `docs/CANONICAL_ANALYTICS_MODEL.md:218`. Recommendation: keep pending/unavailable copy and tests until imports are produced by a proven source. Target part: Legacy product/UI truth.

10. Severity P1 - Raw payload handling for any future Legacy import must be an allowlist, not a provider row dump. Evidence: current Legacy contract says WTC selects explicit safe provider columns, excludes `api_key`/`secret_key`, and rejects selected secret-hint fields at `docs/CONTRACTS/legacy-bot-adapter.md:24`; the worker implements safe-column reads and no secret-field assertion at `apps/worker/src/legacy-live.ts:333` and `apps/worker/src/legacy-live.ts:347`; WTC `importBotTrade()` accepts arbitrary `rawJson` at `packages/db/src/repositories.ts:2237`. Recommendation: future raw JSON should include only non-secret import diagnostics such as source table/version, source row id or stable source event id, normalized fee/funding sign notes, and mapper version; never include provider rows, raw API payloads, pub_id in UI/audit, credentials, tokens, DSNs, or endpoints. Target part: source mapper/raw payload allowlist.

## Decisions
- Verdict: No durable Legacy bot closed-trade/fill source available locally was proven for WTC `legacy_bot`.
- The durable closed-trade/fill schema found locally belongs to Turtle/Tortila, not the current WTC Legacy source path, and it lacks WTC Legacy provider-account scope as-is.
- Existing WTC `bot_trade_imports` and `importBotTrade()` remain the correct destination contract once source proof exists.
- Legacy performance analytics must remain pending/N/A; do not derive realized PnL, win-rate, or profit-factor from inactive Legacy orders/slots, WTC direct fixtures, Turtle local DB rows, or Legacy DCA backtests.

## Risks
- A future implementer may see `bot_tortila/turtle_bot.db` and incorrectly wire it to `legacy_bot`; that would cross product boundaries and bypass provider-scope semantics.
- A future implementer may use `orders.order_id` or Turtle local autoincrement `trades.id` as a stable external trade id without proving replay/idempotency across provider accounts.
- A future provider DB may contain a trade-history table not present in local source; this audit did not probe live provider DB schemas or rows.
- A future raw payload mapper could leak credentials or private provider metadata unless it is an allowlist with tests.

## Verification/tests
RUN:
- `git status --short --branch` - observed large pre-existing dirty/untracked worktree on `codex/bot-analytics-settings-canary-20260603`; no cleanup or revert performed.
- Read-only text search across WTC source/docs/tests for Legacy closed-trade, idempotency, worker, and UI evidence.
- Read-only source inspection under `C:/Users/maxib/GTE BOT/bot` and `C:/Users/maxib/GTE BOT/bot_tortila`, excluding `.env`, logs, secret/key folders, DB rows, provider calls, and live processes.
- Metadata-only SQLite inspection of `C:/Users/maxib/GTE BOT/bot_tortila/turtle_bot.db` via Python standard library after `sqlite3` CLI was unavailable: table names, column names, and counts only; no row values read. Result: `trades=0`, `unit_fills=0`, `funding_payments=0`.
- `Test-Path docs/handoffs/20260604-2245-legacy-closed-trade-source-deep-auditor.md` before write - returned `False`.

NOT RUN:
- Vitest, typecheck, lint, build, Playwright, browser proof - no code/test/schema implementation in this read-only audit.
- `npm run db:migrate`, WTC DB mutation, worker tick, managed acceptance, provider DB query, exchange/API query, journal HTTP query, live bot control - out of scope and intentionally not run.
- Raw `.env`, token, DSN, key, log payload, or private endpoint inspection - intentionally not run.

## Next actions
1. If Legacy closed-trade analytics are still required, obtain source proof first: provider/local table or endpoint name; provider/account scope; stable external trade/fill id; symbol; side; size; entry price; exit price; realized PnL; fee sign; funding sign; opened/closed timestamps; exit reason; lifecycle/update semantics; replay window; and raw payload allowlist.
2. Stop if the only available Legacy source remains active/inactive `orders` or `slots`, backtest output, direct WTC fixtures, or Turtle/Tortila journal rows without an explicit product-boundary decision.
3. Once source proof exists, implement the smallest mapper in `apps/worker/src/legacy-live.ts` that passes WTC `botProviderAccountId: providerAccount.id`, uses `sourceAdapter: 'legacy-db'`, stores only allowlisted raw JSON, and proves replay with two provider mappings sharing the same external id.
4. After importer proof, update Legacy UI/tests from pending to loaded only for provider-scoped imported trades; keep N/A when no source-backed imports exist.
