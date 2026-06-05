# legacy-closed-trade-importer-auditor handoff
## Scope
Phase 4.31 read-only auditor lane for the Legacy closed-trade importer. Scope was to inspect the current WTC worker/import path and local Legacy bot source, then propose the smallest safe worker/importer implementation only if a closed-trade source model exists locally. No live DB, provider, exchange, env, secret, SSH, tmux, systemd, or deploy actions were performed. This handoff makes no N-agent claim; no background agents were launched or left open for this single per-agent lane.

Verdict: BLOCKED on source evidence. The local Legacy source has account, settings, slot, and order state, but no durable closed-trade/fill model with stable trade id, realized PnL, fees, funding, opened_at, and closed_at. Do not implement a closed-trade importer from inactive `orders` rows.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/index.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0018_provider_snapshot_scope.sql`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `C:\Users\maxib\GTE BOT\bot\models.py`
- `C:\Users\maxib\GTE BOT\bot\database.py`
- `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py`
- `C:\Users\maxib\GTE BOT\bot\client_server\routes\api_management.py`

## Files changed
None - read-only audit. Protocol write only: `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`.

## Findings
1. Severity P1 - No safe Legacy closed-trade source model exists locally. Evidence: local Legacy `Order` stores `order_id`, order type/side/note, price, quantity, position, provider `api_id`, `system_id`, reason, active flag, and stage only at `C:\Users\maxib\GTE BOT\bot\models.py:109-124`; shared base timestamps are only generic `created_at`/`updated_at` at `C:\Users\maxib\GTE BOT\bot\database.py:44-48`; `close_slot()` only flips `Slot.active=false` and updates timestamps at `C:\Users\maxib\GTE BOT\bot\models.py:265-283`; `toggle_order()` only flips `Order.active=false` at `C:\Users\maxib\GTE BOT\bot\models.py:652-656`; close logic calls exchange close/cancel methods and slot/order toggles without persisting realized PnL, fees, funding, fills, or a trade-level close row at `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:581-592` and `C:\Users\maxib\GTE BOT\bot\core\trading_logic.py:607-640`. Recommendation: do not derive closed trades from inactive orders; require an upstream trade/fill source table or API first. Target part: Legacy source model.
2. Severity P1 - Current WTC Legacy worker reads only active account/settings/stage/slot/order state and intentionally emits no trade history. Evidence: `LegacyLiveSnapshotResult` has accounts/settings/positions/provider counters but no trade counters at `apps/worker/src/legacy-live.ts:8-17`; worker row shape for orders has no id, timestamps, PnL, fees, funding, or fill fields at `apps/worker/src/legacy-live.ts:83-91`; `buildLegacyLiveWarnings()` always includes `no_trade_history` at `apps/worker/src/legacy-live.ts:313-316`; `readLegacyRows()` selects `api_keys`, symbol settings, `stageconfigs`, active `slots`, and active `orders` only at `apps/worker/src/legacy-live.ts:333-381`; `snapshotLegacyRowsToWtc()` imports only metric and position snapshot repos at `apps/worker/src/legacy-live.ts:393-403`, writes `closedPnlUsd: undefined` and `tradeCount: 0` at `apps/worker/src/legacy-live.ts:416-431`, then writes only position snapshots at `apps/worker/src/legacy-live.ts:450-466`. Recommendation: keep Legacy closed-trade importer blocked until a real closed-trade/fill source is proven. Target part: `apps/worker/src/legacy-live.ts`.
3. Severity P1 - The WTC DB/import invariant is ready for provider-scoped closed trades, but only after source proof. Evidence: provider-account mappings store Legacy `pub_id` as `providerAccountId` and enforce active provider uniqueness at `packages/db/src/schema.ts:146-170`; `bot_trade_imports` now includes `bot_provider_account_id` and provider-aware partial unique indexes at `packages/db/src/schema.ts:564-596`; migration `packages/db/migrations/0021_complete_pepper_potts.sql:1-3` dropped the old provider-unaware unique index and added unscoped plus scoped partial unique indexes; `importBotTrade()` accepts `botProviderAccountId`, targets the matching partial index, and audits only the WTC UUID/null scope at `packages/db/src/repositories.ts:2233-2267`; Phase 4.30 records the same invariant and next-step warning at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:54-57`. Recommendation: if a source is added, pass the mapped WTC `botProviderAccountId` (`bot_provider_accounts.id`) into `importBotTrade()`, never raw `pub_id` as the scope key. Target part: repository import path.
4. Severity P2 - Existing tests cover adjacent behavior only; no Legacy closed-trade worker regression can be claimed. Evidence: `tests/integration/legacy-provider-worker.test.ts:25-96` fixtures Legacy accounts/settings/stages/slots/active orders only; `tests/integration/legacy-provider-worker.test.ts:156-205` asserts provider-scoped metric and position snapshots plus no secret serialization; Tortila already proves closed-trade idempotency separately at `tests/integration/worker-tortila-snapshot.test.ts:58-76`; read-only mode protects the worker from journal fetches and trade mutation at `tests/integration/worker-tortila-snapshot.test.ts:135-154`. Recommendation: add a Legacy worker closed-trade replay test only after the source model provides real closed-trade rows. Target part: tests.
5. Severity P2 - Worker orchestration exposes Tortila trade counters but not Legacy trade counters, matching the current implementation gap. Evidence: Tortila snapshot result tracks `tradesSeen` and `tradesImported` at `apps/worker/src/jobs.ts:24-35`; Tortila imports closed trades through `importBotTrade()` at `apps/worker/src/jobs.ts:233-257`; `runDbWorkerTick()` tracks Tortila trade counters at `apps/worker/src/index.ts:191-194` and Legacy only accounts/settings/positions/provider scope at `apps/worker/src/index.ts:195-202`; worker health detail records Tortila trade counters and Legacy non-trade counters at `apps/worker/src/index.ts:294-315`. Recommendation: if source proof lands, extend Legacy result/health counters in the same small worker slice so observability proves importer behavior. Target part: worker health/detail DTO.
6. Severity P2 - Current contracts deliberately say Legacy trade history is unavailable, so any importer must be preceded by source-truth updates. Evidence: the Legacy adapter contract maps closed PnL, win rate, profit factor, total trades, fees, and funding to null/no trade history at `docs/CONTRACTS/legacy-bot-adapter.md:248-269`; it states `getTrades()` is not available and closed positions are not tracked retrievably via API at `docs/CONTRACTS/legacy-bot-adapter.md:293-314`; open item says a trade history API is needed at `docs/CONTRACTS/legacy-bot-adapter.md:471-479`; the integration plan says `getTrades` is not available and asks whether orders can serve as proxy at `docs/BOT_INTEGRATION_PLAN.md:308-315` and `docs/BOT_INTEGRATION_PLAN.md:436-440`; analytics rules require unavailable Legacy metrics to stay null/N/A at `docs/CANONICAL_ANALYTICS_MODEL.md:165-170` and `docs/CANONICAL_ANALYTICS_MODEL.md:220-225`. Recommendation: do not flip UI/docs from N/A to real metrics until a source-backed importer is implemented and tested. Target part: docs/product truth.

## Decisions
- Do not implement a Legacy closed-trade importer in this phase.
- Treat inactive Legacy `orders` and closed `slots` as insufficient for canonical closed trades because they lack trade-level fills and economic PnL fields.
- Preserve Phase 4.30 provider-aware idempotency as the required destination invariant for any future importer.
- Do not read `.env`, print env values, query live DBs, call providers/exchanges, start preview, run worker loops, or mutate anything outside this handoff.
- No background agents were spawned for this single auditor handoff; none remain open.

## Risks
- Fabricating trades from inactive `orders` would mix canceled, filled, replaced, TP, and averaging orders and could produce false PnL/win-rate analytics.
- `Order.order_id` is order-level, not trade-level; TP orders can be canceled/replaced, and `system_id` groups bot intent rather than an exchange fill/trade.
- Local source may diverge from the live Legacy DB, but live DB/provider inspection was intentionally not performed in this read-only/no-secrets phase.
- `bot_provider_accounts` should remain durable identity rows. Because `bot_trade_imports.bot_provider_account_id` uses `ON DELETE set null`, hard-deleting provider accounts can still collide with unscoped uniqueness if duplicate scoped trades are nulled.
- Future source proof may require an upstream Legacy code change rather than WTC-only work: e.g. a safe read-only `GET /api_management/{api_id}/trades` endpoint or a durable provider DB table populated by the Legacy bot.

## Verification/tests
RUN:
- Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and Phase 4.30 handoff.
- Inspected requested WTC files with line-level evidence: `apps/worker/src/legacy-live.ts`, `apps/worker/src/jobs.ts`, `apps/worker/src/index.ts`, `tests/integration/worker-tortila-snapshot.test.ts`, `tests/integration/legacy-provider-worker.test.ts`, `packages/db/src/repositories.ts`, and `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`.
- Inspected local Legacy source files under `C:\Users\maxib\GTE BOT\bot` without reading `.env` or secret values.
- `git status --short --branch` - observed the branch and pre-existing dirty/untracked tree before this handoff.
- `Test-Path docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md` - returned `False` before writing this handoff.

NOT RUN:
- `npm test`, focused Vitest, typecheck, lint, build, `secret:scan`, `governance:check`, and `git diff --check` - not run because this phase made no code/test/schema changes and the implementation is blocked on source evidence.
- `npm run db:migrate`, managed worker continuity, admin DB matrix, preview/e2e, SSH/nginx/systemd/deploy, live provider/exchange probes - not run by scope and safety rules.
- Any env/secret inspection - not run by explicit user instruction.
- Legacy closed-trade importer test - not run because no closed-trade source model exists locally.

## Next actions
1. Get source evidence before any implementation. Required fields: provider account filter (`pub_id` or equivalent), stable external trade/fill id, symbol, side, size, entry price, exit price, realized PnL, fees, funding policy, opened_at, closed_at, exit reason, and row lifecycle/idempotency semantics.
2. If the Legacy bot source must change, add a read-only closed-trade/fill table or authenticated API upstream first; do not query live exchange history from WTC worker as a substitute.
3. Once source proof exists, smallest WTC implementation files are likely:
   - `apps/worker/src/legacy-live.ts` - add a safe closed-trade reader/mapper and call `importBotTrade()` with `botProviderAccountId: providerAccount.id`.
   - `tests/integration/legacy-provider-worker.test.ts` - add a two-provider replay regression with the same external trade id under two mapped provider accounts, first run inserts two scoped rows, replay inserts zero, no raw `pub_id`/secret leaks.
   - `apps/worker/src/index.ts` - add Legacy `tradesSeen`/`tradesImported` health detail only if the worker importer is added.
   - `packages/db/src/repositories.ts` - no expected schema change after Phase 4.30 unless a helper is needed for tests.
4. Verification after source-backed implementation: `npx vitest run tests/integration/legacy-provider-worker.test.ts tests/integration/worker-tortila-snapshot.test.ts`, `npm run typecheck -w @wtc/worker`, root `npm run typecheck`, `npm run secret:scan`, `git diff --check`, and `npm run governance:check`.
