# legacy-closed-trade-source-finder handoff
## Scope
Read-only Phase 4.70 audit for whether Legacy has any non-fabricated closed-trade or realized PnL source locally or in current sanitized server evidence. No files were edited, no services restarted, no DB/runtime mutation occurred, no exchange endpoints were called, and no secrets were printed.

## Files inspected
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `apps/worker/src/legacy-live.ts`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `docs/handoffs/20260606-0440-legacy-closed-trade-server-auditor.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- Local sibling Legacy-like source files and BOT_TFLAB SQLite metadata only.

## Files changed
None — read-only audit

## Findings
1. Severity: P0. No valid Legacy closed-trade source is proven. Evidence: `closed-trade-source-proof.ts` requires a source table/API, provider filter, stable id, economics, fees/funding policy, timestamps, replay semantics, and raw allowlist; current candidate remains `blocked_no_source` in tests. Recommendation: keep Legacy importer and realized analytics blocked. Target part: Legacy source-proof gate.
2. Severity: P0. Local Legacy source persists active operational state, not realized economics. Evidence: local models/orders/slots do not provide closed-trade PnL/fees/funding/timestamps; `FILLED` handling toggles/increments state instead of writing a trade ledger. Recommendation: reject inactive orders, slots, and `FILLED` handling as substitutes. Target part: Legacy runtime/source boundary.
3. Severity: P0. Current server evidence still shows no provider closed-trade table/view. Evidence: Phase 4.69 server handoff lists operational tables only and no `trades`, `fills`, `history`, `pnl`, `funding`, or `fees` table/view. Recommendation: do not infer realized analytics from orders/slots. Target part: approved-server source gate.
4. Severity: P1. WTC import destination is ready but downstream only. Evidence: `bot_trade_imports` and `importBotTrade()` already support provider-scoped idempotent imports. Recommendation: implement mapper only after upstream source proof. Target part: WTC import pipeline.
5. Severity: P1. BOT_TFLAB and GTE/Axioma terminal journals are false positives for Legacy provider truth. Recommendation: keep them out of `legacy-db` analytics unless separately reclassified with provenance and replay policy. Target part: sibling artifact filtering.

## Decisions
- Do not implement the Legacy provider importer now.
- Keep Legacy realized PnL, win rate, profit factor, fees/funding attribution, and equity curves blocked.
- Manual upload/audit trail can be designed separately, but must not unlock `legacy-db` source claims.

## Risks
- Fabricated analytics if inactive orders/slots are treated as closed trades.
- Server evidence may drift; a future metadata-only probe can refresh it.
- Manual uploads can become misleading unless separated from provider truth.

## Verification/tests
RUN:
1. Read-only source searches.
2. Line-numbered reads of WTC proof, worker, DB, contract, handoff, and sibling source files.
3. Read-only SQLite metadata/count inspection for BOT_TFLAB candidates.

NOT RUN:
1. Fresh SSH/server DB query, exchange/provider calls, service restarts, DB writes/migrations/seeds, npm test/build/lint gates.

## Next actions
1. Keep Legacy analytics blocked in product surfaces.
2. Request a real Legacy source packet with provider/pub_id filter, stable external id, entry/exit, size, realized PnL, fees, funding, timestamps, exit reason, replay key, and raw allowlist.
3. Optionally design a separate manual upload/audit workflow.
