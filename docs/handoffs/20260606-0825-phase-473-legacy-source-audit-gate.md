# phase-473-legacy-source-audit-gate handoff
## Scope
Phase 4.73 closed the next non-looping Legacy lane: current live/source truth for Legacy closed-trade analytics and a repeatable metadata-only source-audit gate. The phase did not implement a Legacy importer because the current live Legacy runtime still has no durable closed-trade source. Discovery was read-only; no live server mutation, DB writes, exchange/API-key probes, bot control, or service restarts were performed.

Per-agent handoffs:
- [docs/handoffs/20260606-0808-legacy-source-ux-auditor.md](20260606-0808-legacy-source-ux-auditor.md)
- [docs/handoffs/20260606-0809-legacy-import-readiness-auditor.md](20260606-0809-legacy-import-readiness-auditor.md)
- [docs/handoffs/20260606-0811-legacy-closed-trade-source-auditor.md](20260606-0811-legacy-closed-trade-source-auditor.md)

All three agents were closed before this handoff.

## Files inspected
- AGENTS.md
- docs/SESSION_PROTOCOL.md
- docs/STATUS.md
- docs/NEXT_ACTIONS.md
- docs/IMPLEMENTED_FILES.md
- docs/CONTRACTS/legacy-bot-adapter.md
- docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md
- packages/bot-adapters/src/legacy/closed-trade-source-proof.ts
- packages/bot-adapters/src/index.ts
- apps/worker/src/legacy-live.ts
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- tests/integration/legacy-closed-trade-source-proof-static.test.ts
- tests/fixtures/legacy-runtime-no-source-audit.json
- scripts/legacy-closed-trade-source-audit.mjs
- Live Legacy server metadata via read-only SSH/DB schema/count probes, with secrets/DSNs/rows not printed.

## Files changed
- packages/bot-adapters/src/legacy/closed-trade-source-proof.ts
- packages/bot-adapters/src/index.ts
- package.json
- scripts/legacy-closed-trade-source-audit.mjs
- tests/fixtures/legacy-runtime-no-source-audit.json
- tests/integration/legacy-closed-trade-source-proof-static.test.ts
- docs/STATUS.md
- docs/NEXT_ACTIONS.md
- docs/IMPLEMENTED_FILES.md
- docs/CONTRACTS/legacy-bot-adapter.md
- docs/handoffs/20260606-0808-legacy-source-ux-auditor.md
- docs/handoffs/20260606-0825-phase-473-legacy-source-audit-gate.md

## Findings
1. Severity: P0. Legacy remains `NO_SOURCE` / `blocked_no_source` for realized analytics/import. Evidence: live metadata found only operational tables (`api_keys`, `orders`, `slots`, `stageconfigs`, `symbolsettingss`, `users`); no trade/fill/history/pnl/funding/fee/closed table/API exists. Current live counts include high-volume inactive lifecycle rows, but no realized PnL, fees, funding, close timestamp, exit reason, replay cursor, or raw allowlist. Recommendation: keep Legacy importer, realized PnL, win rate, PF, fees/funding attribution, and equity curves blocked. Target part: Legacy source proof/import.
2. Severity: P0. Inactive orders/slots and `FILLED` handling are false substitutes. Evidence: Legacy source toggles orders/slots inactive and handles fills by recalculating TP or closing the position; it does not write a closed-trade ledger. Recommendation: do not map operational lifecycle rows to `bot_trade_imports`. Target part: mapper boundary.
3. Severity: P0. WTC is destination-ready but upstream source-blocked. Evidence: `bot_trade_imports` and `importBotTrade()` already support provider-scoped immutable imported trades and idempotency, while live WTC aggregate evidence still has `legacy-db=0` imports. Recommendation: add no destination migration now; wait for `ready_for_mapper` source proof. Target part: DB/import pipeline.
4. Severity: P1. Current user/admin UX is already honest enough and should not receive another local polish loop. Evidence: the UX auditor confirmed user and admin statistics surfaces expose `Source-proof gate`, blocked import, hidden realized metrics, and no raw proof payload. Recommendation: no further source-proof UI/status copy without a new source packet or failing rendered gate. Target part: product/admin UX.
5. Severity: P1. The new verifier removes repeated manual uncertainty without granting importer approval. Evidence: `npm run verify:legacy:closed-trade-source -- --input tests/fixtures/legacy-runtime-no-source-audit.json --expect blocked_no_source` passes and classifies the current safe snapshot as blocked; a synthetic complete metadata packet can become `ready_for_mapper` only when every source/economics/timestamp/replay/raw-allowlist requirement is present. Recommendation: require `--expect ready_for_mapper` before any future mapper slice. Target part: Legacy source acceptance.

## Decisions
- Add a metadata-only Legacy runtime/source audit helper in `@wtc/bot-adapters`.
- Add a CLI gate exposed as `npm run verify:legacy:closed-trade-source`.
- Pin the current safe live-runtime snapshot as `tests/fixtures/legacy-runtime-no-source-audit.json`.
- Keep `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF` fail-closed and update its artifact id to Phase 4.73.
- Do not implement a Legacy importer, realized analytics, or UI polish in this phase.
- Keep live controls, exchange pings, start/stop/apply-config, and connection tests out of scope.

## Risks
- A future source packet with a table named like `trades` but missing funding/replay/raw allowlist must remain blocked.
- A future mapper must preserve WTC provider-account UUID scoping; raw Legacy `pub_id` is source scope, not WTC row ownership by itself.
- CLI output includes safe operational table names, including `api_keys`, but never secret column names or values.
- Full unconstrained `npm test` can OOM on this Windows workspace; constrained full Vitest is the reliable local proof used in this phase.

## Verification/tests
RUN:
1. Read-only agents before edits: UX/source truth/import readiness lanes, all closed.
2. Read-only live Legacy metadata/source inspection: process/runtime/source/schema/count aggregates only; no raw rows, env, DSN, token, secret, exchange call, service restart, or live-control mutation.
3. `npm run verify:legacy:closed-trade-source -- --input tests/fixtures/legacy-runtime-no-source-audit.json --expect blocked_no_source` - PASS.
4. `npx vitest run tests/integration/legacy-closed-trade-source-proof-static.test.ts` - PASS (`10` tests).
5. `npm run typecheck` - PASS.
6. `npm run lint` - PASS.
7. `npm run secret:scan` - PASS.
8. `npm run governance:check` before aggregate - PASS with one known historical warning.
9. `git diff --check` - PASS.
10. `npx vitest run tests/integration/lms-db-e2e-artifact-scan.test.ts` - PASS (`26` tests), used to isolate a full-suite OOM symptom.
11. `npx vitest run --minWorkers=1 --maxWorkers=2` - PASS (`135` files, `1142` tests passed, `10` skipped).

NOT RUN:
1. Legacy importer replay tests - not applicable until a source packet passes as `ready_for_mapper`.
2. Managed DB/browser gates - not needed for this package/script/docs-only source-gate slice; no web route or DB schema changed.
3. WTC deploy - not run before PR/CI/merge.
4. Live bot start/stop/apply-config/test-connection/exchange ping - intentionally not run; no live-control audit approval.
5. Service restarts - not run in this phase; post-merge monitor must confirm both bots remain live.

OBSERVED NOT GREEN:
1. Plain `npm test` hit a Windows/Vitest full-suite resource failure: the focused failing LMS artifact-scan file passed alone, and full Vitest passed with `--minWorkers=1 --maxWorkers=2`. Treat the constrained full Vitest run as the local suite proof for this phase.

## Next actions
1. Open PR for Phase 4.73, run GitHub `gates` and `e2e`, merge only after green.
2. After merge, monitor both bots and WTC worker; restart only if needed and only via soft service/runtime restart that does not close positions or invoke live-control.
3. Keep Legacy realized analytics/import blocked until a real source packet validates with `npm run verify:legacy:closed-trade-source -- --input <safe-json> --expect ready_for_mapper`.
4. If a packet passes, start a separate mapper/importer phase with provider-scoped `importBotTrade()` and replay/idempotency/raw-allowlist tests.
