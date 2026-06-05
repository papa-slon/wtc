# legacy-closed-trade-server-auditor handoff
## Scope
Read-only Phase 4.69 Legacy closed-trade source audit with current server evidence. The audit checked WTC source-proof code/docs, server Legacy app source metadata, and provider DB schema metadata. It did not edit files, dump raw rows, read env/DSN/token values, restart services, call exchange/live-control paths, or run DB writes.

## Files inspected
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- Server Legacy app code under `/home/ubuntu/apps/bot`
- Server Legacy provider DB table/column metadata only

## Files changed
None - read-only audit.

## Findings
1. Severity: P0. No durable Legacy closed-trade source exists in the currently observed server Legacy runtime. Evidence: provider DB metadata exposes `api_keys`, `orders`, `slots`, `stageconfigs`, `symbolsettingss`, and `users`, but no `trades`, `fills`, `history`, `pnl`, `funding`, or `fees` table/view. Recommendation: keep Legacy realized analytics/import blocked. Target part: Legacy source-proof gate.
2. Severity: P0. Legacy runtime persists active operational state, not realized economics. Evidence: server `models.py` defines `Order` and `Slot`; trading logic closes/toggles orders and slots, while `FILLED` handling toggles active order state instead of persisting closed-trade economics. Recommendation: reject orders, slots, and FILLED handling as closed-trade substitutes. Target part: Legacy runtime/source boundary.
3. Severity: High. WTC destination import model is ready but downstream only. Evidence: WTC `bot_trade_imports` schema/repositories support provider-scoped idempotent imports, but `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF` remains `blocked_no_source`. Recommendation: build only a source-packet/intake gate until a real source appears. Target part: WTC Legacy importer boundary.

## Decisions
- Do not build Legacy realized PnL, win rate, profit factor, fees/funding analytics, or equity curves from current Legacy data.
- Treat the next honest Legacy work as a source-packet contract, not an importer.

## Risks
- Importing inactive orders/slots would fabricate performance statistics.
- A valid source still needs replay semantics, provider/pub_id scope, raw payload allowlist, and all economics fields before mapper work.

## Verification/tests
RUN:
1. Local WTC source-proof code/docs inspection - PASS.
2. Server Legacy app/source metadata inspection - PASS.
3. Server provider DB metadata/count/index/enum scan - PASS in metadata-only scope.

NOT RUN:
1. File edits, tests/build/lint, raw DB row dumps, env/DSN/token reads, service restarts, live controls, exchange/API calls - intentionally skipped.

## Next actions
1. Keep Legacy closed-trade UI in source-not-proven state.
2. If Legacy analytics is prioritized, define a source packet requiring provider/pub_id scope, stable external trade/fill id, symbol, side, size, entry/exit, realized PnL, fees, funding sign policy, opened/closed timestamps, exit reason, source cursor/replay key, and raw payload allowlist.
3. Add mapper/import only after a real Legacy source packet/table/API satisfies that contract.
