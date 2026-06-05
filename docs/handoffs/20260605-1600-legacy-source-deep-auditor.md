# legacy-source-deep-auditor handoff
## Scope
Phase 4.58 read-only Legacy closed-trade/fill source deep audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Goal: deep-search local `C:\Users\maxib\GTE BOT` folders for any valid Legacy closed-trade/fill source candidate and classify artifacts as `VALID_SOURCE_CANDIDATE`, `DEMO_FIXTURE_ONLY`, `WRONG_PRODUCT`, or `INSUFFICIENT`.

Required source fields checked: stable trade/fill id, provider/user scope, symbol, side, size, entry price, exit price, realized PnL, fees/funding policy, opened timestamp, closed timestamp, exit reason, replay semantics, and raw-payload allowlist.

Safety boundaries followed: no code edits, no live server/bot/provider calls, no DB mutation, no `.env` or secret-file reads, no raw row/payload dumps, no tokens/secrets/DSNs/endpoints printed. SQLite inspection was metadata-only: table names, column names, and row counts.

Protocol note: this is a single named auditor handoff. No multi-agent audit is claimed by this file.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-2245-legacy-closed-trade-source-deep-auditor.md`
- `docs/handoffs/20260605-0333-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260605-1425-source-artifact-discovery-auditor.md`
- `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/warnings.ts`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot\market_api\core.py`
- `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\models.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\market_api\core.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\market_api\bingx_client.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\market_api\core.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\market_api\bingx_client.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\engine\orchestrator.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_audit\srv_models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_audit\srv_store.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db` metadata only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\run_backtest.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\run_live.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\backtest_engine.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot_data\bot.db` metadata only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot_data\db\bot_*.db` metadata only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\outputs\research\...\trades_detailed.csv` header only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB — копия` file names/schema-equivalent code paths where accessible without raw payloads
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\repositories\trade_repo.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\services\trade_service.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\terminal\app\journal\trade_model.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\bot\bot\finalize_handlers.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\bot\services\journal_client.py`
- `C:\Users\maxib\GTE BOT\GTE_PRO\bot\services\journal_client.py`
- `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\models.py`
- `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\binance_rest.py`

## Files changed
- `docs/handoffs/20260605-1600-legacy-source-deep-auditor.md`

## Findings
1. Severity P0 - Classification: `INSUFFICIENT`. No artifact found in the local `GTE BOT` search satisfies the complete Legacy closed-trade/fill source contract. Evidence: WTC requires source table/API, mapped provider/account filter, stable trade/fill id, symbol, side, size, entry/exit prices, realized PnL, fees, funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw-payload allowlist at `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:1`, `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:2`, `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:3`, `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:4`, `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:12`, `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:16`, and `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:17`. The current candidate remains empty/blocking at `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:128` and `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:132`; Phase 4.57 still records the Legacy source/import gate as not run because no valid artifact was supplied or proven at `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md:118`. Recommendation: keep Legacy import blocked until one artifact proves every required field. Target part: Legacy source-proof gate.

2. Severity P0 - Classification: `INSUFFICIENT`. The Legacy-like runtime folders `C:\Users\maxib\GTE BOT\bot`, `C:\Users\maxib\GTE BOT\trading-bot-server`, and `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source` expose active order/slot lifecycle state, not durable realized closed trades or fills. Evidence: Legacy `Api_Key` owns orders/settings/stage configs/slots at `C:\Users\maxib\GTE BOT\bot\models.py:91`; `Order` has order id/order type/side/price/quantity/active fields but no realized PnL, fee, funding, opened/closed trade timestamps, or fill identity at `C:\Users\maxib\GTE BOT\bot\models.py:107`; `Slot` is active slot state at `C:\Users\maxib\GTE BOT\bot\models.py:175`; `toggle_order` only sets an order inactive at `C:\Users\maxib\GTE BOT\bot\models.py:651`. Runtime reconciliation filters open orders and handles `FILLED` status at `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:611`, `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:614`, and `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:708`, but does not persist the required economic closed-trade source contract. The old source copy repeats the same model shape at `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py:91`, `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py:109`, `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py:173`, and `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py:658`. Recommendation: reject inactive orders, slots, and FILLED reconciliation as Legacy closed-trade source substitutes. Target part: Legacy runtime/source schema.

3. Severity P0 - Classification: `INSUFFICIENT`. WTC's current Legacy worker is intentionally a safe active-state snapshot reader, not a trade importer. Evidence: `LegacyOrderRow` has order/position/price/quantity/active fields only at `apps/worker/src/legacy-live.ts:83`; `buildLegacyLiveWarnings()` always starts with `no_trade_history` at `apps/worker/src/legacy-live.ts:314`; reads are limited to `api_keys`, `symbolsettings`, `stageconfigs`, `slots`, and `orders` at `apps/worker/src/legacy-live.ts:335`, `apps/worker/src/legacy-live.ts:365`, `apps/worker/src/legacy-live.ts:370`, and `apps/worker/src/legacy-live.ts:376`; metric snapshots keep closed PnL, win rate, and profit factor unavailable with `tradeCount: 0` at `apps/worker/src/legacy-live.ts:422` and `apps/worker/src/legacy-live.ts:431`. The contract explicitly says Legacy has no closed-trade history endpoint and getTrades returns empty with `no_trade_history` at `docs/CONTRACTS/legacy-bot-adapter.md:295` and `docs/CONTRACTS/legacy-bot-adapter.md:444`. Recommendation: do not derive realized statistics from WTC active snapshots. Target part: `apps/worker/src/legacy-live.ts`.

4. Severity P1 - Classification: `WRONG_PRODUCT` for Legacy. Tortila/Turtle has a stronger closed-trade/fill shape, but it is not the Legacy source. Evidence: `TradeRow` includes symbol, side, units, entry/exit, realized PnL, opened/closed timestamps, exit reason, funding, and fees at `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:58`, `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:65`, `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:67`, `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:68`, `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:70`, and `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:73`; SQLite store tables include `unit_fills` and `trades` at `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py:47` and `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py:76`; the orchestrator writes closed trades on exits at `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\engine\orchestrator.py:766`, `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\engine\orchestrator.py:778`, `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\engine\orchestrator.py:1216`, and `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\engine\orchestrator.py:1224`. Metadata-only DB inspection found `turtle_bot.db` has `trades`, `unit_fills`, and `funding_payments`, but local counts are `trades=0`, `unit_fills=0`, and `funding_payments=0`. Recommendation: keep Tortila source work separate; do not route Tortila/Turtle rows into Legacy imports. Target part: product/source boundary.

5. Severity P1 - Classification: `WRONG_PRODUCT` for `BOT_TFLAB` SQLite runtime DBs; `DEMO_FIXTURE_ONLY` for `BOT_TFLAB` research CSVs. `BOT_TFLAB` contains attractive `closed_trades` and `fills` tables, but it is a strategy lab/backtest/paper/live product, not the Legacy provider source, and all inspected local DB closed-trade/fill counts were zero. Evidence: its README describes layers as backtest, research, paper, and live at `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md:5`; backtest/paper/live examples appear at `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md:66`, `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md:71`, and `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md:77`; storage creates `closed_trades` with `trade_id`, `run_id`, gross/net PnL, and exit reason at `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:39`, `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:40`, `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:51`, `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:53`, and `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:55`; it creates `fills` at `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:75` and saves run-scoped trades at `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:157` and `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:171`. The backtest engine computes simulated gross/net PnL and fees at `C:\Users\maxib\GTE BOT\BOT_TFLAB\backtest_engine.py:2`, `C:\Users\maxib\GTE BOT\BOT_TFLAB\backtest_engine.py:260`, and `C:\Users\maxib\GTE BOT\BOT_TFLAB\backtest_engine.py:272`. Metadata-only DB inspection found `closed_trades=0` and `fills=0` across `bot_data\bot.db` and `bot_data\db\bot_*.db`; research `trades_detailed.csv` header is simulated/backtest output. Recommendation: do not use `BOT_TFLAB` as Legacy source proof unless a separate operator decision declares it the product and provides provider/user scope plus nonzero source rows. Target part: artifact filtering.

6. Severity P1 - Classification: `WRONG_PRODUCT`. GTE/Axioma terminal and journal artifacts are manual/terminal/telegram journal rows, not provider-scoped Legacy bot fills. Evidence: GTE journal `TradeSource` is limited to `telegram`, `terminal`, and `manual` at `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:40`, `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:41`, `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:42`, and `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:43`; journal trade rows include optional closed time and PnL amount/percent at `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:121`, `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:127`, and `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:128`; the canonical contract says terminal `trade_id` is not sent and the server assigns its own id at `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md:94`, and bot-created rows still do not send closed time or PnL fields at `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md:125`. Terminal local trade ids are UUIDs and terminal-origin at `C:\Users\maxib\GTE BOT\GTE_PROJECT\terminal\app\journal\trade_model.py:51` and `C:\Users\maxib\GTE BOT\GTE_PROJECT\terminal\app\journal\trade_model.py:52`. Recommendation: reject GTE manual/terminal journals as Legacy source substitutes. Target part: wrong-product artifact filtering.

7. Severity P1 - Classification: `WRONG_PRODUCT`. `archiv\binance_overlay_app` is an archived execution overlay, not a durable Legacy closed-trade/fill source. Evidence: it defines order request/result models at `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\models.py:94` and `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\models.py:108`; REST code places new orders and close-position market orders at `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\binance_rest.py:277`, `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\binance_rest.py:333`, and `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\binance_rest.py:351`. The scan found no closed-trade persistence, fees/funding policy, replay semantics, or raw allowlist in this archived overlay path. Recommendation: ignore for Legacy source proof. Target part: archived artifact filtering.

8. Severity P1 - Classification: `DEMO_FIXTURE_ONLY`. WTC test fixtures and proof tests can validate the destination contract and source-proof preflight, but they are not source artifacts. Evidence: the static test builds a fixture candidate from synthetic `legacy_closed_trades.*` fields at `tests/integration/legacy-closed-trade-source-proof-static.test.ts:15` and `tests/integration/legacy-closed-trade-source-proof-static.test.ts:35`; it asserts the current state stays `blocked_no_source` at `tests/integration/legacy-closed-trade-source-proof-static.test.ts:45`; it explicitly rejects inactive orders/slots/Tortila/GTE journals as substitutes at `tests/integration/legacy-closed-trade-source-proof-static.test.ts:65`. WTC DB destination fields exist at `packages/db/src/schema.ts:564`, `packages/db/src/schema.ts:570`, `packages/db/src/schema.ts:571`, `packages/db/src/schema.ts:577`, `packages/db/src/schema.ts:578`, `packages/db/src/schema.ts:579`, `packages/db/src/schema.ts:580`, `packages/db/src/schema.ts:581`, `packages/db/src/schema.ts:582`, and `packages/db/src/schema.ts:584`, with idempotent provider-scoped import logic at `packages/db/src/repositories.ts:2233`, `packages/db/src/repositories.ts:2239`, `packages/db/src/repositories.ts:2251`, and `packages/db/src/repositories.ts:2266`. Recommendation: use tests/fixtures to verify a future mapper, not as source proof. Target part: WTC destination/test boundary.

## Decisions
1. No artifact was classified `VALID_SOURCE_CANDIDATE` for Legacy closed-trade/fill import.
2. Legacy-like `bot`, `trading-bot-server`, and `_old_bot_source` artifacts are `INSUFFICIENT`; they provide orders/slots/reconciliation, not realized closed-trade economics.
3. Tortila/Turtle source artifacts are `WRONG_PRODUCT` for Legacy, even though they have a stronger Tortila trade/fill shape.
4. `BOT_TFLAB` runtime DBs are `WRONG_PRODUCT` for Legacy and currently empty for closed trades/fills; `BOT_TFLAB` research CSVs are `DEMO_FIXTURE_ONLY`.
5. GTE/Axioma terminal, Telegram, manual journal, and archived overlay artifacts are `WRONG_PRODUCT`.
6. WTC `bot_trade_imports` and tests are `INSUFFICIENT` or `DEMO_FIXTURE_ONLY` as source evidence; they are destinations/guards, not upstream Legacy proof.
7. No secrets, tokens, DSNs, credentials, raw provider payloads, raw DB rows, or `.env` values were read or printed.

## Risks
1. The `BOT_TFLAB` `closed_trades` and `fills` schema is the most tempting false positive because it has several required field names, but it lacks proven Legacy identity, provider/user scope, nonzero local rows, funding policy, replay semantics, and raw allowlist.
2. Inactive Legacy orders/slots and `FILLED` reconciliation can be mistaken for closed-trade history; using them would fabricate realized PnL, win rate, profit factor, fees, funding, and equity curve.
3. Tortila/Turtle has valid-looking economic rows for its own product path; wiring it into Legacy would corrupt source attribution and provider-account scope.
4. A future raw payload mapper could leak secrets unless it stores only an explicit allowlist of non-secret diagnostics and normalized source ids.
5. This was local-only metadata/source inspection; a live provider DB may contain a history table not present in local source, but probing live provider databases was out of scope.

## Verification/tests
RUN:
1. `git status --short --branch` - RUN; branch `codex/bot-analytics-settings-canary-20260603` with extensive pre-existing dirty/untracked files. No cleanup or revert performed.
2. Protocol and prior truth reads - RUN for `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, Phase 4.39/4.47/4.57 handoffs, `docs/STATUS.md`, and `docs/NEXT_ACTIONS.md`.
3. Broad local file discovery - RUN with `rg --files` across `C:\Users\maxib\GTE BOT`, excluding `.git`, `node_modules`, build outputs, logs, `.env`, archives, binary images, and DB row dumps.
4. Keyword/source searches - RUN with `rg` for closed-trade/fill fields, realized PnL, fees, funding, timestamps, exit reason, order/fill ids, and source scopes across WTC, Legacy-like folders, Tortila/Turtle, `BOT_TFLAB`, GTE journals, and archived overlay paths.
5. SQLite metadata-only inspection - RUN via Python stdlib `sqlite3` read-only connections for `bot_tortila\turtle_bot.db` and `BOT_TFLAB\bot_data\*.db`; inspected table names, column names, and counts only.
6. Research CSV header-only inspection - RUN for one representative `BOT_TFLAB\outputs\research\...\trades_detailed.csv` header; no data rows read.

NOT RUN:
1. `npm test`, typecheck, lint, build, Playwright, governance, secret scan - NOT RUN; no code changed and this was source discovery only.
2. Live provider DB query, exchange/API call, network probe, journal HTTP call, worker tick, server/bot start/stop/apply-config, deploy, or CI - NOT RUN by scope and safety boundary.
3. `.env`, credential files, key folders, token files, DSNs, logs with payloads, raw SQLite rows, raw JSON payloads, screenshots, or image attachments - NOT RUN / not opened.
4. Legacy source mapper/import gate - NOT RUN; no valid Legacy source artifact was found.

## Next actions
1. Keep Legacy closed-trade import blocked until a source artifact proves all required fields: source table/API, mapped provider/account filter, stable trade/fill id, symbol, side, size, entry price, exit price, realized PnL, fees/funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw-payload allowlist.
2. If a candidate DB/API is supplied, run a new metadata-only source-proof phase first: schema/endpoint names, constraints, count-only row availability, provider filter, and field mapping. Stop before any row payload or secret-bearing output.
3. If the candidate is `BOT_TFLAB`, require an explicit operator product-boundary decision before treating it as anything other than `WRONG_PRODUCT`/`DEMO_FIXTURE_ONLY`, then prove nonzero rows, account/user scope, funding policy, replay semantics, and raw allowlist.
4. If source proof becomes complete, implement only a small mapper that calls `importBotTrade()` with `botProviderAccountId`, `sourceAdapter='legacy-db'`, a stable `externalTradeId`, and allowlisted raw JSON; add replay/idempotency tests before changing UI copy from pending to loaded.
5. Continue rejecting inactive Legacy orders/slots, WTC fixtures, Tortila/Turtle rows, GTE/Axioma journals, screenshots, terminal logs, and backtest/research outputs as Legacy source substitutes.
