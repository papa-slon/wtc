# legacy-import-readiness-auditor handoff
## Scope
Phase 4.73 read-only `ecosystem-db-architect` / backend audit for WTC destination/importer readiness for Legacy closed trades in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope questions:
- What WTC already has for provider-scoped trade import destination/snapshots.
- What WTC already has for Legacy source-proof preflights.
- Whether Legacy statistics fail closed while source proof is absent.
- Whether the next minimal non-looping implementation should be a real importer or a repeatable source-audit gate.

Verdict: WTC has a provider-scoped destination/import contract and provider-scoped operational snapshots, plus a fail-closed Legacy source-proof contract and UI/admin visibility. WTC does not have a proven Legacy closed-trade source or Legacy importer. The next appropriate step is not an importer; it is a repeatable source-audit/source-packet gate unless a new source artifact is supplied.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `docs/DATA_MODEL.md`
- `docs/handoffs/20260605-2058-legacy-source-proof-auditor.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- `docs/handoffs/20260606-0240-bot-source-truth-auditor.md`
- `docs/handoffs/20260606-0440-legacy-closed-trade-server-auditor.md`
- `docs/handoffs/20260606-0542-legacy-closed-trade-source-finder.md`
- `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `package.json`
- `tests/integration/db-0002.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-bot-completion-gate-map.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: P0. Evidence: WTC has the provider-scoped closed-trade destination, but this is downstream storage, not source proof. `packages/db/src/schema.ts:564-596` defines immutable `bot_trade_imports` with `bot_provider_account_id`, `external_trade_id`, economics, timestamps, source adapter, raw JSON, and scoped/unscoped unique indexes. `packages/db/src/repositories.ts:2233-2268` implements provider-aware `importBotTrade()` idempotency and audits only real inserts. `tests/integration/db-0002.test.ts:119-188` proves duplicate replay returns `inserted:false` and the same external trade id can import distinctly under two Legacy provider-account UUIDs without leaking raw `pub_id`. Recommendation: keep this destination; do not add another migration before source proof. Target part: WTC import destination.

2. Severity: P0. Evidence: WTC also has provider-scoped Legacy operational snapshots, but not Legacy closed-trade imports. `packages/db/src/schema.ts:146-173` models WTC `bot_provider_accounts` using provider/account identity and active uniqueness. `apps/worker/src/legacy-live.ts:333-386` reads only safe Legacy account/settings/stage/active slot/active order columns filtered by `pub_id`; `apps/worker/src/legacy-live.ts:416-450` writes metric snapshots with `sourceAdapter='legacy-db'`, `closedPnlUsd` and performance fields undefined, `tradeCount: 0`, and a fail-closed `closedTradeSourceProof`; `apps/worker/src/legacy-live.ts:455-479` writes position snapshots only. `apps/worker/src/legacy-live.ts:541-566` loops active WTC provider-account mappings and passes WTC `botProviderAccountId` into snapshots. Recommendation: treat current Legacy worker output as runtime/operational evidence only. Target part: Legacy worker snapshot path.

3. Severity: P0. Evidence: the Legacy source-proof preflight exists and currently fails closed. `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:1-18` requires source table/API, provider filter, stable id, symbol, side, size, entry/exit, realized PnL, fees, funding policy, opened/closed timestamps, exit reason, replay semantics, and raw payload allowlist. It rejects inactive orders, inactive slots, open-order reconciliation, position snapshots, Tortila rows, and GTE journal rows at `:23-30`. The current candidate is `phase-4.47-no-local-legacy-closed-trade-source` with no evidence or raw allowlist at `:128-137`. `tests/integration/legacy-closed-trade-source-proof-static.test.ts:49-57` pins `blocked_no_source`, `canImportClosedTrades=false`, all requirements missing, and `missing_raw_payload_allowlist`. Recommendation: keep the preflight as the gate of record. Target part: Legacy source-proof contract.

4. Severity: P0. Evidence: no current repo/server handoff proves a Legacy closed-trade source has appeared since Phase 4.47. `docs/STATUS.md:20-22` says Phase 4.72 still does not clear Legacy realized closed-trade source/import. `docs/NEXT_ACTIONS.md:123-144` keeps Legacy closed-trade realized analytics/import blocked by source proof and defines the required source packet. `docs/handoffs/20260606-0440-legacy-closed-trade-server-auditor.md:17-20` reports current server metadata exposes operational tables only and no `trades`, `fills`, `history`, `pnl`, `funding`, or `fees` table/view. `docs/handoffs/20260606-0104-phase-466-server-canary-update.md:39` says WTC `bot_trade_imports` had Tortila rows and no `legacy-db` trade imports in that server proof. Recommendation: do not start a Legacy importer from current evidence. Target part: source availability.

5. Severity: P0. Evidence: Legacy statistics fail closed instead of fabricating performance. `docs/CONTRACTS/legacy-bot-adapter.md:248-269` maps closed PnL, win rate, profit factor, total trades, fees, and funding to null/no trade history. `docs/CONTRACTS/legacy-bot-adapter.md:293-314` says `getTrades()` is not available and active orders/slots are current state only. `docs/CANONICAL_ANALYTICS_MODEL.md:164-170` requires unavailable metrics to render as `N/A`/dash, not zero, specifically because Legacy has no trade history. `apps/web/src/features/bots/statistics-panels.tsx:650-681` renders closed-trade history as pending and shows `Legacy source proof blocked` with win rate, profit factor, realized PnL, and attribution hidden when blocked. Recommendation: keep UI/admin product truth in pending/source-blocked state until source-backed imports exist. Target part: Legacy statistics surfaces.

6. Severity: P1. Evidence: user/admin reads already scope Legacy rows by provider account and sanitize proof payloads. `apps/web/src/features/bots/data.tsx:461-502` requires exactly one active Legacy provider mapping and scopes metric, position, and trade reads by WTC `botProviderAccountId`. `apps/web/src/features/bots/data.tsx:606-630` maps `bot_trade_imports` into canonical trades only from scoped destination rows. `apps/web/src/features/bots/data.tsx:653-694` projects only a sanitized `closedTradeSourceProof`. `apps/web/src/features/admin/user-bot-detail-loader.ts:53-55`, `:884-887`, and `:1228-1249` use global preflight or scoped worker metric summaries. `tests/integration/admin-user-bot-detail-loader.test.ts:670-725` proves raw proof fields such as API-key-shaped values are stripped from the rendered summary. Recommendation: preserve provider scoping and safe summary boundaries in any future mapper. Target part: web/admin read model.

7. Severity: P1. Evidence: tests cover destination idempotency, current worker snapshot truth, and fail-closed proof behavior, but no Legacy importer regression exists because no source exists. `tests/integration/legacy-provider-worker.test.ts:156-205` proves provider-scoped metric/position snapshots and no secret serialization. `tests/integration/legacy-live-worker-static.test.ts:159-180` pins `no_trade_history` warnings and safe column selection. `tests/integration/legacy-closed-trade-source-proof-static.test.ts:105-113` allows a fully evidence-backed candidate only as `ready_for_mapper`, not as importer implementation. `package.json:11-58` has Tortila real-read and generic bot/admin gates, but no `accept:legacy:*` importer/source runner. Recommendation: the next testable Legacy addition should be a source-packet verifier or mapper tests after proof, not UI polish. Target part: verification boundary.

8. Severity: P1. Evidence: current worker observability tracks Tortila trade imports but not Legacy trade imports, matching the missing Legacy importer. `apps/worker/src/jobs.ts:235-258` imports Tortila closed trades with `importBotTrade()` and increments `tradesImported`; `apps/worker/src/index.ts:329` consumes Tortila `tradesImported`. `apps/worker/src/legacy-live.ts:473-484` returns Legacy account/settings/stage/position/slot counters only. `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md:25` shows live continuity logs for Legacy snapshot accounts/settings/positions, not trade imports. Recommendation: if source proof later passes, add Legacy trade counters to the worker result/health detail in the same small mapper slice. Target part: worker observability.

## Decisions
1. Legacy importer readiness verdict: destination-ready, source-blocked.
2. Do not implement a real Legacy importer in Phase 4.73 from current evidence.
3. Keep `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF` at `blocked_no_source` until a new source artifact satisfies every requirement.
4. Keep `bot_trade_imports` and `importBotTrade()` as the destination for any future proven Legacy rows; no destination migration is indicated.
5. The minimal non-looping next implementation is a repeatable source-audit/source-packet gate, not another local UI/source-proof polish pass and not an importer.
6. If and only if source proof becomes `ready_for_mapper`, implement the smallest mapper that calls `importBotTrade()` with WTC `botProviderAccountId`, `sourceAdapter='legacy-db'`, stable `externalTradeId`, normalized economics/timestamps, and allowlisted `rawJson`.

## Risks
1. Fabricated analytics risk: inactive orders, slots, active order coverage, or `FILLED` reconciliation can look operationally rich but do not prove realized PnL, fees, funding, close timestamps, or replay semantics.
2. Scope-collapse risk: using raw Legacy `pub_id` as `bot_trade_imports.bot_provider_account_id` would break WTC's provider-account UUID boundary.
3. Security risk: unbounded raw payload capture could leak API keys, secrets, DSNs, headers, provider identifiers, or raw production rows.
4. Loop risk: adding more blocked-source UI/status copy without a new source packet repeats Phase 4.47-4.50 and does not move importer readiness.
5. Replay risk: importing without a proven stable trade/fill id and backfill cursor can duplicate or collapse provider history.

## Verification/tests
RUN:
1. `git status --short --branch` - observed `## main...origin/main` with no short dirty rows before the handoff artifact.
2. `git log --oneline -n 8` - observed current head `2e2363e Record Tortila runtime auth firewall proof`.
3. Required protocol/docs reads - inspected AGENTS/session/status/next-actions/contract/analytics docs.
4. Source/destination searches - `rg` over `packages`, `apps`, `docs`, `tests`, and `scripts` for `bot_trade_imports`, `importBotTrade`, `closedTradeSourceProof`, `blocked_no_source`, Legacy stats, source proof, preflight, provider account, and importer terms.
5. Line-numbered code reads - inspected DB schema/repositories, Legacy worker, proof contract, web read models, statistics panels, worker/Tortila import contrast, package scripts, and focused tests.
6. Prior handoff reconciliation - checked current Phase 4.66-4.72 docs/handoffs for any new Legacy source proof; none was found.

NOT RUN:
1. `npm test`, lint, typecheck, build, Playwright - not run because this was a read-only audit and no product code changed.
2. Live provider DB queries, SSH/server probes, exchange/API calls, worker ticks, migrations, seeds, or service restarts - intentionally not run under read-only scope.
3. Legacy source-proof acceptance against a real source packet - not run because no source packet/table/API artifact is present in current evidence.
4. Legacy importer replay tests - not applicable until source proof becomes `ready_for_mapper`.
5. Background agent fan-out - this prompt invoked a single named read-only auditor; no N-agent claim is made.

## Next actions
1. Stop Legacy importer work until a concrete source packet exists.
2. Define or implement a repeatable, metadata-only Legacy source-audit gate that accepts a source packet/candidate and evaluates it through the existing proof requirements without live bot control or raw row/secret dumps.
3. Required source packet fields: table/API/artifact name, provider/pub_id filter tied to WTC mapping, stable external trade/fill id, symbol, side, size, entry price, exit price, realized PnL, fees, funding sign policy, opened timestamp, closed timestamp, exit reason, replay/backfill semantics, row retention/cursor policy, and raw payload allowlist.
4. If the source packet remains absent, keep product surfaces in `blocked_no_source` / pending import state and do not add UI polish as a substitute.
5. If a packet passes proof, add a fixture-backed mapper/importer slice: read the proven source by provider account, sanitize raw JSON by allowlist, call `importBotTrade()` with WTC `botProviderAccountId` and `sourceAdapter='legacy-db'`, add worker trade counters, and test same-provider duplicate no-op, same external id across two mapped providers, and no secret/provider raw leaks.
