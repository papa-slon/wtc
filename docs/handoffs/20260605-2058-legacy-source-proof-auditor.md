# legacy-source-proof-auditor handoff
## Scope
Phase 4.62 read-only Legacy closed-trade source proof discovery for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Goal: inspect WTC docs/contracts/tests and bounded local sibling candidates under `C:\Users\maxib\GTE BOT` for any valid Legacy closed-trade source artifact/API/table that proves stable trade id, provider/pub_id scope, symbol, side, size, entry/exit, realized PnL, fees/funding, opened/closed timestamps, exit reason, replay semantics, and a raw payload allowlist.

Safety boundaries followed:
- No live provider DB queries.
- No exchange/API calls.
- No bot starts/stops.
- No SSH or process control.
- No secrets, DSNs, or raw production rows printed.
- SQLite inspection was metadata/counts only for local `.db` files in BOT_TFLAB candidates; no row dumps.

Agent protocol note: no callable background-agent or thread-launch tooling was exposed in this Codex session after tool discovery, so this is a single foreground auditor handoff only. No N-agent claim is made, and there were no background agents to close.

Verdict: NO - Legacy realized analytics/import cannot be safely implemented now. WTC has a ready destination/import contract, but this session found no valid Legacy upstream source artifact/API/table.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/DATA_MODEL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1810-legacy-source-final-auditor.md`
- `docs/handoffs/20260605-2018-phase-461-main-merge-ci-truth.md`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\models.py`
- `C:\Users\maxib\GTE BOT\trading-bot-server\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\models.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\_old_bot_source\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\backtest_engine.py`
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot_data\bot.db` metadata/counts only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot_data\db\bot_*.db` metadata/counts only
- `C:\Users\maxib\GTE BOT\BOT_TFLAB - copy-equivalent folder` metadata/counts only via filesystem iteration
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\terminal\app\journal\trade_model.py`
- `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md`
- `C:\Users\maxib\GTE BOT\GTE_PRO` and `C:\Users\maxib\GTE BOT\GTE_tv_parity` equivalent journal/terminal files
- `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\models.py`
- `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\binance_rest.py`

## Files changed
None - read-only audit. Required handoff artifact only: `docs/handoffs/20260605-2058-legacy-source-proof-auditor.md`.

## Findings
1. Severity: P0. No valid Legacy source artifact/API/table was found, so Legacy realized analytics/import is still blocked. Evidence: WTC's proof contract requires source table/API, mapped provider/account filter, stable trade/fill id, symbol, side, size, entry/exit prices, realized PnL, fees, funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw payload allowlist at `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:1-17`. The current candidate is still the explicit no-source candidate at `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:128-136`, and tests pin `blocked_no_source` and `canImportClosedTrades=false` at `tests/integration/legacy-closed-trade-source-proof-static.test.ts:49-56`. Recommendation: do not implement Legacy importer, win rate, profit factor, realized PnL, fee/funding attribution, or equity from Legacy until a source artifact proves every required field. Target part: Legacy source-proof gate.

2. Severity: P0. The current Legacy contract and worker only support safe active-state snapshots, not closed-trade history. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:293-312` says `getTrades()` is not available and that active orders/slots are current state only; `apps/worker/src/legacy-live.ts:335-341` selects only safe account columns by `pub_id`; `apps/worker/src/legacy-live.ts:422-431` leaves closed PnL/unrealized PnL undefined and trade count zero; `apps/worker/src/legacy-live.ts:446-449` attaches the fail-closed source proof summary. Recommendation: keep worker output as operational runtime evidence only; do not derive realized analytics from it. Target part: Legacy worker/runtime snapshot.

3. Severity: P0. The local Legacy-like source trees store orders, settings, stages, and slots, not durable closed-trade economics. Evidence: `C:\Users\maxib\GTE BOT\bot\models.py:91-101` defines `Api_Key` with `pub_id`, orders, settings, stage config, slots, and balance; `C:\Users\maxib\GTE BOT\bot\models.py:109-123` defines `Order` with order id/type/side/price/quantity/api_id/active/stage but no realized PnL, fees, funding, opened/closed trade timestamps, or exit reason; `C:\Users\maxib\GTE BOT\bot\models.py:177-190` defines active slot state; `C:\Users\maxib\GTE BOT\bot\models.py:653-656` only marks orders inactive. The same shape was found in `trading-bot-server` and `bot_tortila\_old_bot_source`. Recommendation: reject inactive orders, active slots, stage state, and balance changes as closed-trade source substitutes. Target part: Legacy ORM/source schema.

4. Severity: P0. `FILLED` reconciliation is not a durable closed-trade/fill ledger. Evidence: `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:568-572` routes TP/averaging checks through open-order processing; `:612-624` infers done averaging orders by absence from live open-order ids and toggles/increments state; `:704-716` handles websocket `FILLED` by toggling order state and possibly incrementing average count. It does not persist stable closed trade/fill identity, realized PnL, fees, funding, opened/closed timestamps, exit reason, replay semantics, or a raw payload allowlist. Recommendation: do not treat `FILLED` handling as import proof. Target part: Legacy reconciliation.

5. Severity: P1. BOT_TFLAB is the most convincing false positive, but it is not valid Legacy proof. Evidence: `C:\Users\maxib\GTE BOT\BOT_TFLAB\README.md:5` frames it as backtest/research/paper/live; `C:\Users\maxib\GTE BOT\BOT_TFLAB\bot\storage.py:29-57` creates run-scoped `bot_runs` and `closed_trades`; `:75-83` creates run-scoped `fills`; `:171-184` inserts closed trades by `run_id`. Metadata-only local DB inspection found every inspected BOT_TFLAB and copy DB has `closed_trades=0`, `fills=0`, `orders=0`, and `open_positions=0`; `bot_data\bot.db` has `bot_runs=0`, while the seven `bot_data\db\bot_*.db` files each have `bot_runs=1`. Recommendation: keep BOT_TFLAB classified as wrong-product/demo/research unless the operator explicitly reclassifies product boundary and supplies nonzero provider-scoped source rows, funding policy, replay semantics, and raw allowlist. Target part: sibling artifact filtering.

6. Severity: P1. GTE/Axioma/terminal journal records are wrong-product for Legacy provider replay proof. Evidence: `C:\Users\maxib\GTE BOT\GTE_PROJECT\journal_server\app\models\trade.py:40-43` defines trade sources as telegram, terminal, and manual; `:96-128` defines journal trade fields such as asset, side, closed_at, result_r, pnl_amount, and pnl_percent. Terminal `CanonicalTradeRecord` has local UUID `trade_id`, source `terminal`, symbol, exchange context, entry/exit, qty, PnL, and fees at `C:\Users\maxib\GTE BOT\GTE_PROJECT\terminal\app\journal\trade_model.py:41-80`, but `to_server_payload()` excludes `trade_id` because the server assigns its own id at `:93-137`; the contract states `trade_id` is not sent at `C:\Users\maxib\GTE BOT\GTE_PROJECT\docs\canonical_trade_contract_v1.md:85-99` and bot-created rows still do not send closed/PnL fields at `:122-125`. Recommendation: do not use GTE terminal/manual journals as Legacy source proof. Target part: wrong-product journal boundary.

7. Severity: P1. WTC destination/import infrastructure is ready, but it is not upstream source evidence. Evidence: `docs/DATA_MODEL.md:522-562` documents immutable `bot_trade_imports`, provider-scoped indexes, and the Legacy source note; `packages/db/src/schema.ts:565-596` implements provider-scoped closed-trade fields and scoped/unscoped unique indexes; `packages/db/src/repositories.ts:2233-2246` accepts the required import fields and defaults fees/funding, while `:2239-2266` performs idempotent provider-aware insert and audits only real inserts. Recommendation: if source proof arrives later, implement a small mapper/sanitizer into the existing destination; do not add another destination migration first. Target part: WTC import destination.

8. Severity: P1. User/admin surfaces correctly keep Legacy realized analytics hidden while source proof is blocked. Evidence: statistics UI labels `blocked_no_source` as `Legacy source proof blocked` and says win rate, profit factor, realized PnL, and attribution stay hidden because no durable Legacy source is proven at `apps/web/src/features/bots/statistics-panels.tsx:515-536` and `:658-681`; tests assert that copy at `tests/integration/bot-statistics-completion.test.ts:35-36`; selected-user admin summarizes the proof via global preflight or scoped worker metric at `apps/web/src/features/admin/user-bot-detail-loader.ts:53-54`, `:884-887`, and `:1228-1249`; admin page renders `source proof blocked` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:87` and source-proof evidence copy at `:259`. Recommendation: leave UI in pending/blocked state until a real import gate passes. Target part: product honesty surfaces.

9. Severity: P2. Archived overlay code is not a source proof candidate. Evidence: `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\models.py:94-108` models order requests/results, and `C:\Users\maxib\GTE BOT\archiv\binance_overlay_app\app\binance_rest.py:277-352` places new/close-position orders and exposes unrealized/account fields, not a durable closed-trade/fill store with replay semantics and raw allowlist. Recommendation: keep archived overlays out of Legacy source-proof scope unless a separate artifact names a closed-trade table/API. Target part: archived sibling filtering.

## Decisions
1. Legacy realized analytics/import verdict: NO, not safe to implement now.
2. Keep `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF` at `blocked_no_source`.
3. Keep WTC `bot_trade_imports` as the destination contract for future proven rows; no destination migration is indicated by this audit.
4. Continue rejecting inactive orders, inactive slots, open-order reconciliation, position snapshots, Tortila/Turtle rows, GTE manual/terminal rows, BOT_TFLAB research/backtest rows, and archived overlays as substitutes.
5. If a new candidate is supplied, require one artifact package that names the table/API, provider/pub_id filter, stable external id, all economics/timestamps/exit fields, replay key, funding/fee sign policy, and raw payload allowlist before mapper work.

## Risks
1. Fabricated analytics risk: deriving win rate, profit factor, realized PnL, fees/funding, or equity from active orders/slots would be product misinformation.
2. Privacy/security risk: using raw provider rows or DB dumps as `rawJson` could expose `pub_id`, API keys, secrets, DSNs, endpoints, or production rows.
3. Replay risk: using order ids or local journal ids without proven source semantics could collapse distinct provider accounts or duplicate historical imports.
4. False-positive risk: BOT_TFLAB has attractive `closed_trades` and `fills` names, but current evidence shows wrong-product/run-scoped schema and zero local rows.
5. Process risk: no background agent launcher was available in this Codex session, so this is not a multi-agent audit.

## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/phase-462-production-source-discovery`; short status had no dirty rows before the handoff write.
2. Protocol read - inspected `AGENTS.md` and `docs/SESSION_PROTOCOL.md`.
3. WTC source-proof contract search - `rg` / `Select-String` across docs, packages, apps, tests, and scripts for Legacy closed-trade/source-proof terms.
4. WTC destination contract read - inspected `bot_trade_imports`, `importBotTrade()`, source-proof tests, worker proof projection, statistics/admin UI proof surfaces.
5. Bounded sibling source search - inspected local code/docs under `bot`, `trading-bot-server`, `bot_tortila\_old_bot_source`, `BOT_TFLAB`, `BOT_TFLAB - copy-equivalent folder`, `GTE_PROJECT`, `GTE_PRO`, `GTE_tv_parity`, and `archiv\binance_overlay_app`, excluding secrets/config where possible.
6. Local SQLite metadata/count inspection - used Python `sqlite3` in read-only URI mode for BOT_TFLAB `.db` files; printed only table names/counts for `bot_runs`, `closed_trades`, `fills`, `orders`, and `open_positions`.

NOT RUN:
1. Live provider DB queries - prohibited by scope.
2. Exchange/API calls - prohibited by scope.
3. Bot starts/stops/process control/SSH - prohibited by scope.
4. Raw row dumps, secret/DSN reads, provider payload dumps - prohibited by scope.
5. Test suite/lint/typecheck/Playwright - not needed for read-only discovery; no product code changed.
6. Multi-agent background dispatch - no callable agent/thread launch tool was available in this Codex session, and no N-agent claim is made.

## Next actions
1. Keep Legacy realized analytics/import blocked.
2. Stop local source-proof loops unless a new concrete source artifact is supplied.
3. Ask the operator for a source package or documentation that names the Legacy table/API and includes safe schema proof for: provider/pub_id filter, stable trade/fill id, symbol, side, size, entry/exit, realized PnL, fees/funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw payload allowlist.
4. If proof is supplied, run a new read-only source-proof phase first; only then implement a fixture-backed mapper/sanitizer that calls `importBotTrade()` with WTC `botProviderAccountId`, `sourceAdapter='legacy-db'`, stable `externalTradeId`, and allowlisted raw JSON.
5. Before UI changes from blocked/pending to loaded, add provider-scoped replay tests: same provider duplicate no-op, same external id under another mapped provider imports distinctly, no secret/provider raw dump leakage.
