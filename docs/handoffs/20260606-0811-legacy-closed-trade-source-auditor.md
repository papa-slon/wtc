# legacy-closed-trade-source-auditor handoff
## Scope
Phase 4.73 read-only `ecosystem-bot-integration-auditor` lane for Legacy Bot closed-trade source truth in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope was limited to proving or rejecting a durable Legacy closed-trade source for realized analytics/importer work. I inspected WTC protocol/docs/contracts/source, current WTC destination code, and live Legacy/WTC metadata on `<wtc-canary-host>` through SSH using read-only commands only. No live runtime/server mutation was performed: no file edits on the server, no service restarts, no tmux state changes, no Docker/firewall/env writes, no exchange/API-key probes, no raw DB rows, no secret values, and no raw host/IP retained in this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/handoffs/20260606-0542-legacy-closed-trade-source-finder.md`
- `docs/handoffs/20260605-1810-legacy-source-final-auditor.md`
- `docs/handoffs/20260605-1600-legacy-source-deep-auditor.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- `docs/handoffs/20260604-2245-phase-4-39-legacy-closed-trade-source-proof.md`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `<wtc-canary-host>` read-only Legacy DB metadata via WTC worker `LEGACY_DATABASE_URL` variable captured only into shell memory, never printed.
- `<wtc-canary-host>` read-only WTC DB aggregate counts via WTC worker `DATABASE_URL` variable captured only into shell memory, never printed.
- `<wtc-canary-host>` source snippets from `~/apps/bot/models.py`, `~/apps/bot/core/trading_logic.py`, `~/apps/bot/client_server/routes/api_management.py`, and `~/apps/bot/market_api/core.py`, with secret-looking lines filtered.

## Files changed
None - read-only audit

## Findings
1. Severity: P0. Verdict: no durable Legacy closed-trade source is proven on the current live Legacy DB/runtime. Evidence: WTC's source-proof contract requires source table/API, mapped provider filter, stable trade/fill id, symbol, side, size, entry, exit, realized PnL, fees, funding sign policy, opened/closed timestamps, exit reason, replay/backfill semantics, and raw payload allowlist at `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:1-17`; the current proof candidate carries no evidence and evaluates to `blocked_no_source` at `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:128-135`. Live read-only metadata on `<wtc-canary-host>` found only `public.api_keys`, `public.orders`, `public.slots`, `public.stageconfigs`, `public.symbolsettingss`, and `public.users`; the candidate table search for trade/fill/history/pnl/fund/fee/deal/execution/closed returned none. Live non-secret column metadata showed `orders` has `order_id`, order/side/note/price/quantity/position/api_id/system_id/reason/active/stage and created/updated timestamps, but no exit price, realized PnL, fees, funding, closed timestamp, exit reason, or replay cursor. Recommendation: keep Legacy realized PnL, win rate, PF, fees/funding attribution, equity curves, and importer work blocked. Target part: Legacy source-proof gate.
2. Severity: P0. Inactive orders/slots and `FILLED` handling are false substitutes for closed trades. Evidence: WTC explicitly forbids substituting inactive orders, inactive slots, open-order reconciliation, position snapshots, Tortila/Turtle journal rows, or GTE manual journal rows for Legacy closed-trade proof at `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:23-30`. Live Legacy aggregates had `orders false=3421 true=14`, `TAKE_PROFIT false=684 true=2`, `BUY false=679 true=12`, and `slots false=718 true=2`, which proves lifecycle state exists but not realized economics. Live source snippets show `Order` stores order identity, side, note, price, quantity, position, active, and stage, while `Slot` stores position/reason/stage/averaging/active and timestamps; `close_slot()` only sets `active=False`, and `toggle_order()` only sets `active=False`. The `FILLED` push handler toggles the order, increments averaging state, or calls close-position logic for take-profit at `~/apps/bot/core/trading_logic.py:714-727`, not a trade ledger writer. Recommendation: reject inactive rows, filled push events, slots, balance changes, and active-order summaries as realized analytics inputs. Target part: Legacy runtime/source semantics.
3. Severity: P0. WTC's current Legacy worker is an operational snapshot reader, not a closed-trade importer. Evidence: the worker starts every Legacy warning set with `no_trade_history` at `apps/worker/src/legacy-live.ts:314`; reads only safe account, setting, stage, active slot, and active order columns at `apps/worker/src/legacy-live.ts:333-381`; writes metric snapshots with `closedPnlUsd`, `unrealizedPnlUsd`, `winRate`, `profitFactor`, fees, funding, and drawdowns undefined plus `tradeCount: 0` at `apps/worker/src/legacy-live.ts:416-431`; and embeds the fail-closed `closedTradeSourceProof` summary at `apps/worker/src/legacy-live.ts:446-449`. The adapter contract also states Legacy `getTrades()` is not available and active orders/slots are current state only at `docs/CONTRACTS/legacy-bot-adapter.md:293-312`. Recommendation: keep Legacy worker output framed as runtime/operational evidence only. Target part: `apps/worker/src/legacy-live.ts`.
4. Severity: P1. WTC's closed-trade destination is ready, but downstream only; it does not prove the upstream Legacy source. Evidence: `bot_trade_imports` is modeled as immutable imported closed trades with provider scope, external trade id, symbol, side, entry/exit price, size, realized PnL, fees, funding, opened/closed timestamps, exit reason, source adapter, raw JSON, and scoped/unscoped unique indexes at `packages/db/src/schema.ts:564-596`. `importBotTrade()` accepts those fields and performs provider-aware idempotent inserts at `packages/db/src/repositories.ts:2233-2268`. Live WTC aggregate counts on `<wtc-canary-host>` showed `bot_trade_imports` grouped as `tortila=27` and `legacy-db=0`; Legacy metric snapshots existed, but newer source-proof aggregates were `blocked_no_source|false=428` and no mapper-ready Legacy proof was observed. Recommendation: do not add another destination migration now; wait for a valid source packet and then build a mapper/sanitizer into the existing destination. Target part: WTC import pipeline.
5. Severity: P1. Legacy provider scope exists as `pub_id`/`api_id`, but not as a replay-safe closed-trade identity. Evidence: the contract says the accepted canary path reads provider Postgres safe columns by existing provider `pub_id` at `docs/CONTRACTS/legacy-bot-adapter.md:24-36`, and the worker can select `api_keys.pub_id` by mapped provider account at `apps/worker/src/legacy-live.ts:333-348`. Live Legacy DB metadata also contains `api_keys.pub_id`, `orders.api_id`, `slots.api_id`, `stageconfigs.api_id`, and `symbolsettingss.api_id`. That scope is enough for operational snapshots; it is not enough for closed trades because there is no stable trade/fill id plus economics/timestamp/replay source. Live WTC `bot_provider_accounts` aggregate returned no provider/product/status rows, so current canary evidence should not be treated as a provider-scoped import proof. Recommendation: the source packet must include provider/pub_id filter and replay/idempotency key before mapper work. Target part: provider-scoped Legacy import acceptance.
6. Severity: P1. The current product/docs boundary is still honest and should not be weakened. Evidence: Phase 4.72 explicitly left Legacy realized analytics/import blocked because no new Legacy closed-trade source packet/API/table was provided or discovered at `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md:43`, and listed Legacy closed-trade source/import proof as NOT RUN at `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md:72-78`. The canonical analytics model marks Legacy closed PnL, fees, funding, net PnL, win rate, and total trades unavailable at `docs/CANONICAL_ANALYTICS_MODEL.md:37-40`, `docs/CANONICAL_ANALYTICS_MODEL.md:83-88`, and `docs/CANONICAL_ANALYTICS_MODEL.md:220-226`. Recommendation: keep user/admin copy in the source-blocked state until the source-proof preflight becomes `ready_for_mapper` and importer tests pass. Target part: Legacy analytics UX/admin truth.

## Decisions
- Classification: `NO_SOURCE` / `blocked_no_source`.
- Do not implement Legacy closed-trade importer, realized PnL, win rate, profit factor, fee/funding attribution, or equity curves from the current Legacy DB/runtime.
- Keep inactive orders, inactive slots, `FILLED` reconciliation, active position snapshots, and Legacy balance snapshots out of `bot_trade_imports`.
- Treat `bot_trade_imports` and `importBotTrade()` as the correct future destination once upstream source proof exists.
- Keep any future raw payload allowlist narrow and secret-free; no provider row dumps or secret-bearing payloads.

## Risks
- Inactive `orders` and `slots` are high-volume and can look like history, but using them would fabricate realized analytics.
- A stable `order_id` is not a stable trade/fill id unless a source packet proves how entries/exits aggregate into one closed trade and replay key.
- Current Legacy snapshots are useful operational truth, but global/fleet evidence can be mistaken for provider-scoped closed-trade proof.
- Manual/GTE/Tortila journal artifacts can be valid in their own product lanes but are not Legacy provider truth without an explicit provenance decision and replay policy.
- Future source discovery could drift; re-run metadata-only probes before unblocking mapper work.

## Verification/tests
RUN:
1. Protocol/doc read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, Phase 4.72 handoff, Legacy adapter contract, and canonical analytics model.
2. Local WTC source reads for source-proof requirements, worker Legacy snapshot behavior, `bot_trade_imports`, and `importBotTrade()`.
3. Read-only SSH metadata probe on `<wtc-canary-host>`: process names, candidate source files, candidate DB files, env presence by name only, Legacy DB schema/table names, filtered non-secret column names, and row counts only.
4. Read-only Legacy DB candidate search: no table matching trade/fill/history/pnl/fund/fee/deal/execution/closed; operational table counts only.
5. Read-only Legacy state aggregates: orders/slots by active/note status only; no row payloads.
6. Read-only source snippets for Legacy model/runtime behavior, filtered for secret-looking lines.
7. Read-only WTC aggregate checks: `bot_trade_imports` by source adapter, Legacy import count, metric snapshot source counts, and source-proof status counts. One aggregate query had a SQL grouping mistake and was retried with a corrected subquery; no mutation occurred.
8. `git status --short --branch` before work: clean `main...origin/main`.

NOT RUN:
1. npm/Vitest/Playwright/build gates - not run because this auditor changed no product code and performed source/metadata proof only.
2. DB migrations, seeds, writes, fixture inserts, or importer execution - forbidden/out of scope.
3. Live server/runtime mutation - no service restart, no tmux attach/capture/change, no Docker/env/firewall writes.
4. Exchange/API-key probes, Legacy HTTP management endpoint calls, live control, start/stop/apply-config/test-connection - forbidden.
5. Raw env/DSN/secret printing, raw DB row dumps, raw log dumps, screenshots, or provider payload retention - forbidden.
6. Cloud-provider console/security-group audit - outside this SSH metadata lane.

## Next actions
1. Keep Legacy realized analytics/importer blocked in WTC product surfaces.
2. Request a real Legacy source packet naming the table/API/artifact, provider/pub_id filter, stable trade/fill id, symbol, side, size, entry price, exit price, realized PnL, fees, funding sign policy, opened timestamp, closed timestamp, exit reason, replay/backfill semantics, and raw payload allowlist.
3. If a candidate appears, run a separate metadata-only source-proof phase first; accept only `ready_for_mapper` from the preflight before implementation.
4. After accepted source proof, implement the smallest fixture-backed mapper in `apps/worker/src/legacy-live.ts` that calls `importBotTrade()` with WTC `botProviderAccountId`, `sourceAdapter: 'legacy-db'`, stable `externalTradeId`, sanitized `rawJson`, and provider-scoped replay/idempotency tests.
5. Decide and prove provider-account ownership/mapping before any Legacy import goes live; current operational snapshots alone are not provider-scoped closed-trade proof.
