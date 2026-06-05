# legacy-closed-trade-source-auditor handoff
## Scope
Read-only Phase 4.47 Legacy source-proof audit for whether local source code/schema in `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform` or nearby `C:/Users/maxib/GTE BOT` project directories proves a durable Legacy closed-trade/fill source suitable for importing realized trade statistics.

Scope boundaries followed: no `.env`/secret files, no DB dumps/data rows, no credential logs, no live service/provider calls, no DB mutation, no server/bot start/stop/apply-config, no network provider calls, and no product/source/test/docs edits beyond this required handoff.

Overall verdict: NO_SOURCE. Current local evidence still proves a WTC destination contract and Legacy live snapshot/readiness surfaces, but it does not prove a durable Legacy source table/API for closed trades or fills with realized PnL, fees, funding, stable fill/trade identity, and replay semantics.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/bot-adapters/src/warnings.ts`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `C:/Users/maxib/GTE BOT/bot/models.py`
- `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py`
- `C:/Users/maxib/GTE BOT/bot/client_server/routes/api_management.py`
- `C:/Users/maxib/GTE BOT/bot/client_server/schemas/trade.py`
- `C:/Users/maxib/GTE BOT/bot/market_api/core.py`
- `C:/Users/maxib/GTE BOT/bot/market_api/bingx_client.py`
- `C:/Users/maxib/GTE BOT/trading-bot-server/models.py`
- `C:/Users/maxib/GTE BOT/trading-bot-server/core/trading_logic.py`
- `C:/Users/maxib/GTE BOT/trading-bot-server/market_api/core.py`
- `C:/Users/maxib/GTE BOT/trading-bot-server/market_api/bingx_client.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/models.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/_audit/srv_models.py`
- `C:/Users/maxib/GTE BOT/GTE_PROJECT/journal_server/app/models/trade.py`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - Verdict: NO_SOURCE. Current WTC Legacy worker reads only provider accounts, settings, stage configs, active slots, and active orders; it does not read a Legacy closed-trade/fill table/API. Evidence: `apps/worker/src/legacy-live.ts:83-91` defines the Legacy order row as `api_id`, `position`, `position_side`, `note`, `price`, `quantity`, and `active`; `apps/worker/src/legacy-live.ts:370-380` selects only active `slots` and active `orders`; `apps/worker/src/legacy-live.ts:313-315` always emits `no_trade_history`; `apps/worker/src/legacy-live.ts:416-431` writes Legacy metrics with closed PnL, win rate, profit factor, fees, and funding unavailable and `tradeCount: 0`. Recommendation: keep Legacy analytics pending; do not derive realized statistics from current WTC Legacy snapshots. Target part: `apps/worker/src/legacy-live.ts`.

2. Severity P1 - Verdict: NO_SOURCE. The local Legacy source model under `C:/Users/maxib/GTE BOT/bot` proves order/slot lifecycle state, not economic closed trades. Evidence: `C:/Users/maxib/GTE BOT/bot/models.py:91-102` relates `Api_Key` to orders/settings/stage config/slots only; `C:/Users/maxib/GTE BOT/bot/models.py:109-124` defines `Order` without realized PnL, fee, funding, closed timestamp, fill id, or replay identity; `C:/Users/maxib/GTE BOT/bot/models.py:177-187` defines `Slot` as active position/stage state; `C:/Users/maxib/GTE BOT/bot/models.py:266-282` closes a slot by setting `active=False`; `C:/Users/maxib/GTE BOT/bot/models.py:652-656` toggles an order inactive. Recommendation: do not treat inactive orders or slots as closed-trade history. Target part: Legacy DB/source schema.

3. Severity P1 - Verdict: NO_SOURCE. Local Legacy runtime/client code reconciles active/open order state and closes positions but does not persist realized trade economics. Evidence: `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py:607-615` builds `live_ids` from `get_open_orders`; `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py:621-623` toggles filled averaging orders and increments count; `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py:633-641` treats missing TP order as closure path and calls position close logic; `C:/Users/maxib/GTE BOT/bot/market_api/core.py:42-48` exposes positions and open orders, not closed trades; `C:/Users/maxib/GTE BOT/bot/market_api/bingx_client.py:370-388` implements positions and open orders only for reads. Recommendation: require a separate proven closed-fill/history source before any importer. Target part: Legacy runtime and market client.

4. Severity P1 - Verdict: INSUFFICIENT. WTC has a ready destination/import contract, but a destination is not source proof. Evidence: `packages/db/src/schema.ts:564-585` defines immutable `bot_trade_imports` with provider scope, stable external id, prices, size, realized PnL, fees, funding, opened/closed timestamps, source adapter, and raw JSON; `packages/db/src/schema.ts:588-596` defines scoped/unscoped idempotency indexes; `packages/db/src/repositories.ts:2233-2247` accepts the required `BotTradeImportInput`; `packages/db/src/repositories.ts:2248-2267` inserts idempotently and audits only on real insert. Recommendation: no new destination migration is indicated by this audit, but do not wire Legacy import until source proof names the upstream fields and replay semantics. Target part: `bot_trade_imports` / future Legacy importer.

5. Severity P1 - Verdict: NO_SOURCE. WTC's active import call is wired to the Tortila journal path, not Legacy. Evidence: `apps/worker/src/jobs.ts:97-103` identifies `snapshotTortilaJournal` as Tortila and says non-real mode writes `sourceAdapter='tortila-mock'`; `apps/worker/src/jobs.ts:120-127` imports `importBotTrade()` inside `snapshotTortilaJournal` and derives `sourceAdapter` as `tortila` or `tortila-mock`; `apps/worker/src/jobs.ts:233-255` imports closed trades from adapter-provided Tortila trades. Recommendation: do not infer Legacy source readiness from Tortila importer plumbing. Target part: worker importer wiring.

6. Severity P2 - Verdict: INSUFFICIENT. Nearby Turtle/Tortila source code does prove a durable trade/fill/funding model, but it is a different product path and not a Legacy source. Evidence: `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:76-89` creates a `trades` table with realized PnL, opened/closed timestamps, funding, and fees; `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/store.py:433-443` inserts those trade rows; `C:/Users/maxib/GTE BOT/bot_tortila/_audit/srv_models.py:31-41` defines unit fills with fee paid; `C:/Users/maxib/GTE BOT/bot_tortila/_audit/srv_models.py:58-73` defines `TradeRow` economics. Recommendation: keep this as Tortila/Turtle evidence only unless a separate product-boundary decision maps it explicitly to another product. Target part: sibling source boundary.

7. Severity P2 - Verdict: INSUFFICIENT. Nearby `GTE_PROJECT` journal code proves a manual/terminal/telegram journal, not a provider-scoped Legacy closed-trade/fill source. Evidence: `C:/Users/maxib/GTE BOT/GTE_PROJECT/journal_server/app/models/trade.py:40-43` restricts `TradeSource` to `telegram`, `terminal`, and `manual`; `C:/Users/maxib/GTE BOT/GTE_PROJECT/journal_server/app/models/trade.py:78-87` defines a journal `trades` table with that source enum; `C:/Users/maxib/GTE BOT/GTE_PROJECT/journal_server/app/models/trade.py:120-128` has optional `closed_at`, `pnl_amount`, and `pnl_percent`, but no Legacy provider account mapping, fill identity, fees/funding, or replay contract. Recommendation: do not use the journal as a Legacy realized-stat source without a separate audited adapter/product decision. Target part: sibling journal boundary.

8. Severity P1 - Verdict: NO_SOURCE. Current WTC docs and contracts intentionally preserve the source block. Evidence: `docs/NEXT_ACTIONS.md:61-65` says not to implement Legacy closed-trade import until a source-proof artifact names the source fields and says Phase 4.39 still found no durable source; `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md:44-50` records no durable local Legacy source and rejects inactive orders/slots; `docs/CONTRACTS/legacy-bot-adapter.md:306-313` documents the `no_trade_history` warning; `docs/CONTRACTS/legacy-bot-adapter.md:441-444` expects unavailable metrics and empty trades; `packages/bot-adapters/src/warnings.ts:59-68` encodes the Legacy no-history warning. Recommendation: leave product copy/status in source-blocked mode until a later proof artifact contradicts this with line-level source evidence. Target part: docs/contracts/product truth.

## Decisions
- Overall verdict is NO_SOURCE for durable Legacy closed-trade/fill source proof.
- WTC `bot_trade_imports` and `importBotTrade()` are adequate destinations once a source is proven; they are not evidence that a Legacy source exists.
- Inactive Legacy `orders`, inactive `slots`, missing TP/open-order reconciliation, and position close paths are not valid substitutes for realized closed trades.
- Tortila/Turtle and GTE journal sources remain separate product/source paths and are INSUFFICIENT for Legacy statistics import.

## Risks
- Treating `active=false` orders or slots as closed trades would fabricate realized PnL, fees, funding, win rate, profit factor, and equity curve.
- Reusing Tortila/Turtle rows as Legacy rows would corrupt product attribution and provider-account scope.
- A future importer could leak raw provider IDs or payloads if raw JSON is not allowlisted and sanitized.
- Fixture/test imports can prove WTC destination idempotency but cannot prove Legacy upstream source availability.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/NEXT_ACTIONS.md`, and the Phase 4.39 Legacy source-proof handoff.
- Static source/schema inspection of WTC Legacy worker, WTC DB schema/repositories, WTC warning/contract files, and WTC worker import wiring.
- Static source inspection of nearby Legacy-looking `bot` and `trading-bot-server` Python source files.
- Static source inspection of sibling Tortila/Turtle and GTE journal candidates to classify them as non-Legacy evidence.

NOT RUN:
- `npm test`, lint, typecheck, build, Playwright/browser proof - not run because this was a read-only source-proof audit with no product code changes.
- DB migration, DB read/query against live data, managed DB runner, server start, worker tick, bot start/stop/apply-config, exchange/provider API calls, network probes, deploy, production monitoring - not run by scope and safety boundary.
- `.env`, secret files, credential logs, DB dumps, or source data rows - not read by scope.

## Next actions
1. Keep Legacy closed-trade import blocked until a source-proof artifact names the durable table/API, provider/account filter, stable trade/fill id, symbol, side, size, entry/exit prices, realized PnL, fees/funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw-payload allowlist.
2. If proof requires DB metadata, run a separate operator-approved metadata-only discovery phase that returns schema/constraint names only and redacts sensitive values.
3. After source proof, implement a fixture-backed mapper in `apps/worker/src/legacy-live.ts`, call `importBotTrade()` with WTC `botProviderAccountId` and `sourceAdapter: 'legacy-db'`, and add provider-scoped replay tests before any UI changes from pending to loaded.
