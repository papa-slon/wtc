# Phase 4.39 Legacy closed-trade source proof handoff
## Scope
Deepen the Legacy closed-trade/fill source audit after local bot/admin acceptance became repeatable in Phase 4.38.

This phase was read-only for source/runtime systems: no live services, no provider calls, no exchange calls, no DB mutation,
no bot start/stop/apply-config, no process kill, no raw env/secret reads, no deploy, and no production monitoring. The only
changes are docs/handoff/status updates and a truth correction in the data-model docs.

Three read-only agents were launched before edits and then closed:
- [ecosystem-bot-integration-auditor](20260604-2245-legacy-closed-trade-source-deep-auditor.md)
- [ecosystem-db-architect / ecosystem-platform-architect](20260604-2245-legacy-closed-trade-destination-contract-auditor.md)
- [ecosystem-security-auditor](20260604-2245-legacy-closed-trade-source-safety-auditor.md)

## Files inspected
- `C:/Users/maxib/GTE BOT/bot/models.py`
- `C:/Users/maxib/GTE BOT/bot/database.py`
- `C:/Users/maxib/GTE BOT/bot/client_server/routes/api_management.py`
- `C:/Users/maxib/GTE BOT/bot/client_server/schemas/trade.py`
- `C:/Users/maxib/GTE BOT/bot/client_server/schemas/auth.py`
- `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py`
- `C:/Users/maxib/GTE BOT/bot/market_api/core.py`
- `C:/Users/maxib/GTE BOT/bot/market_api/bingx_client.py`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/DATA_MODEL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `docs/handoffs/20260604-2000-phase-4-34-data-model-provider-trade-scope.md`
- `docs/handoffs/20260604-2145-phase-4-38-local-bot-admin-acceptance-runner.md`
- `docs/handoffs/20260604-2245-legacy-closed-trade-source-deep-auditor.md`
- `docs/handoffs/20260604-2245-legacy-closed-trade-destination-contract-auditor.md`
- `docs/handoffs/20260604-2245-legacy-closed-trade-source-safety-auditor.md`

## Files changed
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md` - this aggregate handoff.
- `docs/DATA_MODEL.md` - corrected `bot_trade_imports.source_adapter` documentation from a narrow enum-like note to the
  actual free-text/current-source contract.
- `docs/STATUS.md` - updated current state with Phase 4.39 source/destination verdict.
- `docs/NEXT_ACTIONS.md` - updated next steps for Legacy closed-trade source proof and importer prerequisites.
- `docs/IMPLEMENTED_FILES.md` - recorded Phase 4.39 source-proof/destination-contract evidence.

## Findings
1. Severity P1 - No durable local Legacy closed-trade/fill source was proven. Evidence: the Legacy source has `Api_Key`
   relationships only for orders/settings/stage config/slots, while `Order` stores order intent/state and lacks realized
   PnL, fees, funding, trade-level opened/closed timestamps, and fill identity; see
   `C:/Users/maxib/GTE BOT/bot/models.py:91`, `C:/Users/maxib/GTE BOT/bot/models.py:109`, and
   `C:/Users/maxib/GTE BOT/bot/models.py:177`. The deep source auditor reached the same verdict in
   `docs/handoffs/20260604-2245-legacy-closed-trade-source-deep-auditor.md`. Recommendation: keep Legacy performance
   metrics pending and do not import from inactive orders/slots. Target part: Legacy source truth.

2. Severity P1 - Legacy runtime code toggles active order/slot state but does not persist economic closed trades. Evidence:
   `close_slot()` only sets `Slot.active=false` at `C:/Users/maxib/GTE BOT/bot/models.py:266`, `toggle_order()` sets
   `Order.active=false` at `C:/Users/maxib/GTE BOT/bot/models.py:653`, and the private order update handler toggles/reconciles
   FILLED events without recording realized PnL/fees/funding at `C:/Users/maxib/GTE BOT/bot/core/trading_logic.py:686`.
   Recommendation: do not treat order/slot lifecycle as closed-trade history. Target part: source semantics.

3. Severity P1 - WTC destination/repository layer is ready for a proven provider-scoped source. Evidence: `bot_trade_imports`
   has provider scope and economic fields documented in `docs/DATA_MODEL.md:522`; scoped/unscoped replay uniqueness is already
   implemented by the destination and repository per the destination-contract auditor. Recommendation: no new destination
   migration is required before a Legacy importer unless source discovery proves a missing concept. Target part:
   `bot_trade_imports`.

4. Severity P1 - The required importer contract is now explicit. Evidence: the destination-contract auditor requires source
   filtering by mapped Legacy `pub_id`, writing WTC `botProviderAccountId`, stable `externalTradeId`, normalized side,
   entry/exit prices, size, realized PnL, fees, funding, opened/closed timestamps, `sourceAdapter: 'legacy-db'`, and sanitized
   optional `rawJson`/`exitReason`. Recommendation: implement no importer until a source-proof artifact names those fields and
   replay semantics. Target part: future Legacy importer.

5. Severity P1 - Safety boundary remains binding. Evidence: the security auditor forbids live control, Legacy HTTP management
   probing, exchange/provider calls, raw env/secret reads, provider DB row dumps, and DB mutation outside approved
   managed/throwaway scopes in `docs/handoffs/20260604-2245-legacy-closed-trade-source-safety-auditor.md`. Recommendation:
   next source work must be metadata-only or fixture-backed unless the operator explicitly provides an approved managed scope.
   Target part: source discovery/acceptance.

6. Severity P2 - A durable Turtle/Tortila journal source exists locally, but it is a different product path and is not Legacy
   proof. Evidence: the deep auditor found Turtle/Tortila trade/fill/funding tables but noted they lack WTC Legacy provider
   account semantics as-is. Recommendation: do not wire Tortila/Turtle rows into `legacy_bot`; handle that only through
   Tortila source work or a separate product-boundary decision. Target part: product/source boundary.

## Decisions
- Legacy closed-trade analytics remain source-blocked; no realized PnL, win rate, profit factor, fee/funding attribution, or
  equity curve should be shown as loaded for Legacy until source-backed imports exist.
- WTC destination is ready for provider-scoped rows; missing work is source proof plus a safe reader/mapper/importer and tests.
- Mandatory Legacy mapper fields: WTC `botProviderAccountId`, `sourceAdapter: 'legacy-db'`, stable `externalTradeId`,
  `symbol`, normalized `side`, `entryPrice`, `exitPrice`, `size`, `realizedPnlUsd`, explicit `feesUsd`, explicit
  `fundingPaidUsd`, `openedAt`, and `closedAt`.
- Optional fields: `exitReason` and bounded sanitized `rawJson`; never raw provider row dumps or secret-bearing payloads.
- Replay rule: `(botInstanceId, botProviderAccountId, externalTradeId, sourceAdapter)` inserts once; exact replay inserts
  zero; the same external id under a different WTC provider account is distinct.

## Risks
- Inactive orders/slots can look tempting as "history" but would fabricate PnL/PF/win-rate.
- Repository fixtures can prove destination consumers but cannot prove Legacy source ingestion.
- A future mapper could accidentally store raw `pub_id` or provider payloads where WTC IDs/sanitized metadata are required.
- Hard-deleting provider-account rows can null historical scoped imports because the FK is `ON DELETE SET NULL`; provider
  account identity should stay durable.

## Verification/tests
RUN:
- Three read-only agent audits; all wrote handoffs and were closed.
- Read-only local source inspection under `C:/Users/maxib/GTE BOT/bot` for Legacy models/routes/market client/trading logic.
- Read-only WTC destination/contract/status inspection.

NOT RUN:
- Vitest/typecheck/lint/build/Playwright/browser proof - not run because this phase made no product code changes.
- `npm run db:migrate`, worker continuity, admin-user DB matrix, live Legacy DB/provider/exchange probes, SSH/tmux/systemd,
  deploy, production monitoring, and any bot start/stop/apply-config - not run by scope.
- Legacy closed-trade importer - not implemented/run because the source is still not proven.

## Next actions
1. Obtain a source-proof artifact before any Legacy importer work: source table/API name, provider/account filter, stable
   external trade/fill id, side, symbol, size, entry/exit prices, realized PnL, fee/funding sign policy, opened/closed
   timestamps, exit reason, replay/backfill semantics, and raw payload allowlist.
2. If proof requires DB metadata, run a separate operator-approved metadata-only discovery phase that returns schema/constraints
   only, redacts output, and writes its own handoff.
3. After source proof, implement the smallest fixture-backed mapper in `apps/worker/src/legacy-live.ts`, call
   `importBotTrade()` with WTC provider UUIDs, add replay/idempotency tests, and only then update Legacy UI from pending to
   loaded branches.
4. Keep `npm run accept:bots:local` as the local mock/no-live website acceptance proof; it does not clear source/live gates.
