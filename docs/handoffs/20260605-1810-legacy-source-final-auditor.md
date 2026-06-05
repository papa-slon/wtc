# legacy-source-final-auditor handoff
## Scope
Phase 4.60 read-only Legacy closed-trade source audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Task: perform a bounded local search for a valid Legacy bot closed-trade source artifact/table/API under
`C:\Users\maxib\GTE BOT` and relevant sibling/copy folders. A valid source must prove source table/API,
mapped provider/account filter or user scope, stable trade/fill id, symbol, side, size, entry price, exit
price, realized PnL, fees/funding policy, opened and closed timestamps, exit reason, replay/idempotency
semantics, and raw-payload allowlist.

Safety boundaries followed: no live servers, no exchange/provider probes, no HTTP journal smoke, no SSH,
no bot start/stop/apply-config, no production mutation, no DB writes, no `.env` contents, no key folders,
no raw row dumps, no credential/DSN/token/password printing. Local demo/test data was inspected only as
filenames, headers, source code, or SQLite metadata/counts.

Protocol note: this is a single named auditor handoff. No multi-agent audit is claimed by this file.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`
- `docs/handoffs/20260605-1600-legacy-source-deep-auditor.md`
- `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`
- `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`
- `docs/handoffs/20260605-1730-tortila-journal-auth-boundary-auditor.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot\market_api\core.py`
- `C:\Users\maxib\GTE BOT\bot\market_api\bingx_client.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\models.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\market_api\core.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\market_api\bingx_client.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\client_server\routes\api_management.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\client_server\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\store.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\engine\orchestrator.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\turtle_bot.db` metadata/counts only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\backtest_engine.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\run_live.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\run_backtest.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot_data\bot.db` metadata/counts only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot_data\db\bot_*.db` metadata/counts only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\outputs\research\...\trades_detailed.csv` header only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB — копия` source search only, excluding raw data where possible
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\schemas\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\repositories\trade_repo.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT — копия\journal_server\app\models\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT — копия\docs\canonical_trade_contract_v1.md`
- `C:\Users\maxib\GTE BOT\GTE_PRO\journal_server\app\models\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_tv_parity\journal_server\app\models\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_tv_parity\docs\canonical_trade_contract_v1.md`
- `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\models.py`
- `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\binance_rest.py`
- Immediate directory map under `C:\Users\maxib\GTE BOT`

## Files changed
- `docs/handoffs/20260605-1810-legacy-source-final-auditor.md`

## Findings
1. Severity P0 - Verdict: no concrete local artifact unblocks Legacy closed-trade implementation. Evidence:
   `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:2`,
   `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:3`,
   `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:4`,
   `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:10`,
   `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:12`,
   `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:15`, and
   `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:17` define the required proof shape, while
   `tests/integration/legacy-closed-trade-source-proof-static.test.ts:50` keeps the current proof at
   `blocked_no_source`. Recommendation: do not implement a Legacy importer or change UI from pending to loaded
   until one source artifact proves every required field. Target part: Legacy source-proof gate.

2. Severity P0 - Legacy-like source folders are insufficient: they expose provider accounts, settings, active orders,
   slots, positions/open orders, and FILLED reconciliation, not durable closed-trade economics. Evidence:
   `C:\Users\maxib\GTE BOT\bot\models.py:91` defines `Api_Key`, `:96` defines `pub_id`, `:107` defines `Order`,
   `:175` defines `Slot`, `:264` closes only a slot, and `:651` toggles an order inactive; runtime FILLED handling
   calls `toggle_order` at `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:708` and `:712`.
   Legacy APIs expose API key/settings/stage/retest paths and only use `get_open_orders` for a permission check at
   `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py:129` and `:160`; the market interface has
   `get_positions`/`get_open_orders` but no closed history reader at
   `C:\Users\maxib\GTE BOT\bot\market_api\core.py:43` and `:47`. `trading-bot-server` and
   `bot_tortila\_old_bot_source` repeat the same model/runtime shape at
   `C:\Users\maxib\GTE BOT\trading-bot-server\models.py:91`,
   `C:\Users\maxib\GTE BOT\trading-bot-server\models.py:109`,
   `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py:91`, and
   `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py:109`. Recommendation: reject inactive orders,
   inactive slots, open positions, and FILLED reconciliation as source substitutes. Target part: Legacy runtime/source.

3. Severity P0 - WTC's current Legacy worker is a safe active-state snapshot reader, not a closed-trade reader.
   Evidence: `apps/worker/src/legacy-live.ts:83` defines `LegacyOrderRow`, `:314` always starts warnings with
   `no_trade_history`, `:336`, `:365`, `:370`, and `:376` read only `api_keys`, `stageconfigs`, `slots`, and
   `orders`; metrics leave `closedPnlUsd`, `winRate`, and `profitFactor` undefined at `:422`, `:424`, and `:425`,
   and set `tradeCount: 0` at `:431`. The contract states the Legacy bot has no closed-trade history endpoint at
   `docs/CONTRACTS/legacy-bot-adapter.md:295`, with `getTrades` empty at `:444`. Recommendation: do not derive
   realized PnL, win rate, profit factor, fees, funding, or equity curves from active snapshots. Target part:
   WTC Legacy adapter/worker.

4. Severity P1 - Tortila/Turtle is stronger source-shaped data, but it is the wrong product for Legacy. Evidence:
   `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\state\models.py:58` defines `TradeRow`, with realized PnL,
   opened/closed timestamps, exit reason, funding, and fees at `:65`, `:66`, `:67`, `:68`, `:70`, and `:73`;
   `state\store.py:47`, `:83`, `:87`, and `:88` define `unit_fills`/trade funding/fees columns; the orchestrator
   writes closed trades at `engine\orchestrator.py:767`, `:778`, `:779`, `:780`, `:781`, `:782`, and `:783`.
   Phase 4.59 proved WTC can read a Tortila fixture as `sourceAdapter=tortila` at
   `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md:57`. Metadata-only inspection of the local
   `turtle_bot.db` found `trades`, `unit_fills`, and `funding_payments` tables, but counts were all zero in the
   inspected local DB. Recommendation: keep Tortila rows in the Tortila product path; do not import them as
   `legacy_bot`. Target part: product/source boundary.

5. Severity P1 - `BOT_TFLAB` and its copy are wrong-product/demo-fixture candidates, not Legacy source proof.
   Evidence: `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md:5` describes layers as backtest, research, paper, and live;
   `bot\storage.py:39` creates `closed_trades`, `:40` defines `trade_id`, `:51`, `:52`, `:53`, and `:55` define
   gross PnL, fees, net PnL, and exit reason; `:75` creates `fills`. The backtest engine computes simulated fees and
   net PnL at `C:\Users\maxib\GTE BOT\BOT_TFLAB\backtest_engine.py:268`, `:269`, and `:273`. Header-only inspection
   of one `outputs\research\...\trades_detailed.csv` showed research/backtest columns such as `trade_index`,
   `split_bucket`, `gross_pnl_usd`, `net_pnl_usd`, `fees_paid`, and `slippage_paid`, not mapped Legacy provider
   scope. Metadata-only inspection of `bot_data\bot.db` and `bot_data\db\bot_*.db` found `closed_trades=0` and
   `fills=0` in every inspected DB. Recommendation: do not treat BOT_TFLAB as Legacy unless the operator makes a
   separate product-boundary decision and supplies nonzero provider-scoped source proof. Target part: sibling artifact
   filtering.

6. Severity P1 - GTE/Axioma terminal, Telegram, and manual journals are invalid Legacy substitutes. Evidence:
   `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:40`, `:41`, `:42`, and `:43` restrict
   `TradeSource` to `telegram`, `terminal`, and `manual`; `:121`, `:127`, and `:128` store optional close time and
   PnL fields, but the canonical contract says terminal `trade_id` is not sent and the server assigns its own id at
   `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md:94`; the bot path does not yet send
   `closed_at`, `pnl_amount`, or `pnl_percent` at `:125`. `GTE_PROJECT — копия`, `GTE_PRO`, and `GTE_tv_parity`
   expose the same manual/terminal/telegram journal shape at their inspected model/contract lines. Recommendation:
   reject GTE manual/terminal journals and Axioma journal rows as Legacy provider closed-trade proof. Target part:
   wrong-product journal filtering.

7. Severity P1 - Archived execution overlays are not durable closed-trade sources. Evidence:
   `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\models.py:94` defines an `OrderRequest`,
   `:108` defines `OrderResult`, and `binance_rest.py:277`, `:333`, and `:352` place/close orders or return order
   results; the scan found no closed-trade persistence, provider-account replay key, funding policy, or raw allowlist.
   Recommendation: keep archived overlays out of Legacy import scope. Target part: archived artifact filtering.

8. Severity P1 - WTC destination/import infrastructure is ready, but it is not upstream source evidence. Evidence:
   `packages/db/src/schema.ts:566` defines `bot_trade_imports`; `:570`, `:571`, `:577`, `:578`, `:579`, `:580`,
   `:581`, `:582`, and `:584` include provider account, external trade id, realized PnL, fees, funding, opened/closed
   timestamps, exit reason, and raw JSON fields. Uniqueness/idempotency is on unscoped and provider-scoped external
   trade ids at `:588`, `:589`, `:591`, and `:592`; `importBotTrade()` accepts the same mapper fields at
   `packages/db/src/repositories.ts:2234`, `:2235`, `:2236`, `:2237`, `:2241`, and defaults fees/funding safely at
   `:2246`. Recommendation: next implementation can use this destination only after source proof is complete; no
   destination migration is the blocker. Target part: WTC import destination.

## Decisions
1. Classification for this final local audit: `NO_VALID_LEGACY_SOURCE_ARTIFACT`.
2. Exact blocker: no local Legacy artifact/table/API proves all of stable trade/fill id, mapped provider filter or user
   scope, symbol, side, size, entry/exit prices, realized PnL, fees/funding policy, opened/closed timestamps, exit
   reason, replay/idempotency semantics, and raw-payload allowlist.
3. Re-confirmed invalid substitutes: inactive Legacy orders, inactive slots, open-order reconciliation/FILLED handling,
   open position snapshots, Tortila/Turtle journals, GTE/Axioma manual/terminal/Telegram journals, WTC fixtures/tests,
   BOT_TFLAB backtest/paper/live rows, research CSVs, and archived overlays.
4. No importer, mapper, UI-loaded state, realized PnL card, win-rate/profit-factor card, fee/funding attribution, or
   Legacy equity curve should be implemented from the artifacts inspected in this phase.
5. If a future source exists only in a live Legacy/provider DB or provider API, it remains unproven locally; live/provider
   probing was out of scope for this auditor.

## Risks
1. BOT_TFLAB has the most convincing false-positive table names (`closed_trades`, `fills`) but lacks proven Legacy
   product identity, mapped provider/user scope, nonzero inspected runtime rows, funding policy, replay semantics, and
   raw allowlist.
2. Tortila/Turtle has real source-shaped economics for its own product path; using it for Legacy would corrupt product
   attribution and provider-account scope.
3. Legacy active orders/slots can look like "history" after FILLED reconciliation, but they cannot honestly support
   realized PnL, fees, funding, win rate, profit factor, or equity curves.
4. GTE/Axioma journals may contain user-entered PnL, but their ids/source model are journal/terminal/manual scoped, not
   Legacy provider fill scoped.
5. Any future raw-payload mapper can leak secrets unless it stores only an explicit non-secret allowlist.

## Verification/tests
RUN:
1. `git status --short --branch` - RUN; branch `codex/bot-analytics-settings-canary-20260603` with extensive
   pre-existing dirty/untracked files. No cleanup or revert performed.
2. Protocol and prior truth reads - RUN for `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `0000-orchestrator-seed.md`,
   Phase 4.39, 4.47, 4.57, 4.58, and 4.59 handoffs.
3. Bounded local source/file discovery - RUN under `C:\Users\maxib\GTE BOT`, with targeted `rg` searches over
   Legacy-like bot folders, WTC source-proof/destination code, Tortila, BOT_TFLAB, GTE/Axioma journal folders,
   copy-equivalent folders, and archived overlays.
4. Legacy endpoint/schema pass - RUN for API management routes, trade schemas, market client interfaces, and runtime
   FILLED/order/slot handling.
5. SQLite metadata-only inspection - RUN with read-only SQLite connections for:
   - `bot_tortila\turtle_bot.db`: `trades=0`, `unit_fills=0`, `funding_payments=0`, `orders=0`.
   - `BOT_TFLAB\bot_data\bot.db`: `closed_trades=0`, `fills=0`, `open_positions=0`, `orders=0`, `bot_runs=0`.
   - `BOT_TFLAB\bot_data\db\bot_*.db`: seven inspected DBs each had `bot_runs=1`, `closed_trades=0`, `fills=0`,
     `open_positions=0`, and `orders=0`.
6. Research CSV header-only inspection - RUN for one representative `BOT_TFLAB\outputs\research\...\trades_detailed.csv`.

NOT RUN:
1. Live Legacy DB/provider/API queries - NOT RUN by scope and safety boundary.
2. Exchange/provider probes, exchange key tests, network probes, SSH/tmux/systemd/process control, live bot
   start/stop/apply-config/test-connection - NOT RUN by scope.
3. `.env` contents, key folders, token files, credentials, raw DSNs/passwords, raw SQLite rows, raw JSON payload rows,
   screenshots/images, and production logs - NOT RUN / not opened.
4. Vitest/typecheck/lint/build/Playwright/browser/governance/secret scan - NOT RUN; this was source discovery plus one
   handoff file only, with no product code changes.
5. Legacy mapper/import gate - NOT RUN; blocked by absent valid source artifact.
6. Production deploy, CI, monitoring, burn-in - NOT RUN; outside this auditor scope.

## Next actions
1. Keep Legacy closed-trade import blocked until a real source artifact is supplied that names the table/API and maps
   every required field with evidence references.
2. If a candidate is supplied, run a new metadata-only proof first: table/API name, constraints/indexes, count-only row
   availability, mapped `pub_id`/provider/user filter, stable trade/fill id, field mapping, replay key, and raw allowlist.
   Stop before printing raw rows or secret-bearing payloads.
3. If the candidate is BOT_TFLAB, require an explicit product-boundary decision before treating it as anything other than
   wrong-product/demo-fixture evidence; then prove nonzero rows, provider/user scope, funding policy, replay semantics,
   and raw allowlist.
4. If proof becomes complete, implement the smallest fixture-backed mapper that calls `importBotTrade()` with
   `botProviderAccountId`, `sourceAdapter='legacy-db'`, stable `externalTradeId`, and allowlisted `rawJson`; add replay
   and provider-scope idempotency tests before changing any Legacy UI from pending to loaded.
