# legacy-source-proof-safety-auditor handoff
## Scope
Read-only safety/source audit for WTC Phase 4.48. Inspected how Legacy closed-trade source-proof status could be surfaced from worker DB snapshots/rawJson to user/admin pages without exposing secrets, raw provider payloads, provider URLs, live-control affordances, or misleading readiness. No env/secret files were read, no live service/provider calls were made, no DB mutation was performed, and no server/bot control was attempted.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `packages/bot-adapters/src/warnings.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`

## Files changed
None - read-only audit. Wrote this handoff only.

## Findings
1. Severity P1 - The only currently safe source-proof payload in worker metric `rawJson` is the small `closedTradeSourceProof` summary, not the surrounding `rawJson` or `liveConfig` object. Evidence: `apps/worker/src/legacy-live.ts:433` writes metric `rawJson`; `apps/worker/src/legacy-live.ts:447` stores `closedTradeSourceProof` with only `status`, `canImportClosedTrades`, and `missingRequirements`; `apps/worker/src/legacy-live.ts:452` also stores `liveConfig`, which contains provider-account and active-order operational details. Recommendation: user/admin UI should add a dedicated projection for `rawJson.closedTradeSourceProof` and must not pass `rawJson` or `liveConfig` through. Target part: user/admin Legacy source-proof status view.
2. Severity P1 - Safe allowed fields for surfacing are narrow: `status`, `canImportClosedTrades`, `missingRequirements`, plus surrounding snapshot context such as `snapshotAt`, `sourceAdapter`, `readState`, `healthStatus`, `warningCodes`/canonical `no_trade_history`, and `liveControlDisabled` where already redacted. Evidence: `apps/worker/src/legacy-closed-trade-source-proof.ts:48` defines the result fields; `apps/worker/src/legacy-live.ts:447` persists only the safe proof subset; `apps/worker/src/legacy-live.ts:423` keeps `closedPnlUsd` undefined and `apps/worker/src/legacy-live.ts:432` keeps `tradeCount: 0`; `packages/bot-adapters/src/warnings.ts:67` explains `no_trade_history` as unavailable closed-trade stats, not zero. Recommendation: render copy as "source proof blocked/no closed-trade source proven" or "mapper-ready only", never as trading-performance readiness. Target part: source-proof badge/card copy.
3. Severity P1 - Forbidden fields and strings for user/admin pages include `rawJson`, `liveConfig`, `rawPayloadAllowlist`, `unsafeRawPayloadFields`, `blockers`, `evidenceRef`, `sourceField`, `artifactId`, provider URLs, env names such as `LEGACY_DATABASE_URL` and `TORTILA_JOURNAL_URL`, secret-shaped strings (`secret`, `token`, `password`, `authorization`, `cookie`, `api_key`, `private`, `credential`, `dsn`, `headers`), and live-control strings (`startBot`, `stopBot`, `applyConfig`, `closePosition`, `placeOrder`, `test connection`, `Connection verified`). Evidence: `apps/worker/src/legacy-closed-trade-source-proof.ts:57` validates evidence refs; `apps/worker/src/legacy-closed-trade-source-proof.ts:59` treats secret-shaped raw field names as unsafe; `tests/integration/legacy-closed-trade-source-proof-static.test.ts:91` rejects `api_key`, `Authorization`, and unbounded field names; `tests/integration/legacy-closed-trade-source-proof-static.test.ts:113` guards against live IO and control strings. Recommendation: encode this forbidden list in the next UI/static test before adding any rendered proof panel. Target part: safety tests and DTO projection.
4. Severity P2 - Current user read loading selects metric `rawJson` but only consumes `rawJson.liveConfig` through `buildSafeRuntimeConfigView`; it does not yet surface `closedTradeSourceProof`. Evidence: `apps/web/src/features/bots/data.tsx:493` selects `rawJson`; `apps/web/src/features/bots/data.tsx:636` extracts only `liveConfig`; `apps/web/src/features/bots/data.tsx:652` returns metrics/positions/trades/config/warnings without a source-proof DTO. Recommendation: add a typed `legacyClosedTradeSourceProof` read model field or a small helper that accepts only the three allowed proof keys. Target part: user bot statistics/dashboard pages.
5. Severity P2 - Current admin health loading reads Legacy metric `rawJson` for operational `liveConfig` rows but does not yet project source-proof status; the admin health-detail allowlist also does not include source-proof keys. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:414` selects Legacy metric `rawJson`; `apps/web/src/features/admin/bot-health-loader.ts:246` extracts only `liveConfig`; `apps/web/src/features/admin/health-detail.ts:4` allowlists health detail keys and omits `closedTradeSourceProof`; `apps/web/src/features/admin/health-detail.ts:87` redacts and drops non-allowlisted keys. Recommendation: admin source-proof display should be built from metric snapshot DTOs, not generic health detail, and should mask provider IDs as the current admin runtime rows do. Target part: admin bot health/source evidence panel.
6. Severity P2 - Existing static tests already define useful guardrails, but they do not yet assert a source-proof UI projection because that UI does not exist. Evidence: `tests/integration/bot-read-safety-static.test.ts:105` forbids `rawJson`, `liveConfig`, provider URLs, secrets, and live-control strings in the user bot list; `tests/integration/bot-read-safety-static.test.ts:430` verifies the admin Legacy pub_id inspector safety pattern; `tests/integration/bot-read-safety-static.test.ts:466` forbids raw provider and secret fields on admin user pages. Recommendation: next implementation should extend these tests with explicit `closedTradeSourceProof` allowed-field checks and forbidden string checks before rendering. Target part: Phase 4.48 implementation gates.

## Decisions
1. Treat `blocked_no_source` as the only current truthful status; Phase 4.47 records all source requirements missing and closed-trade import fail-closed.
2. Treat `ready_for_mapper` as mapper readiness only, not importer completion, analytics readiness, exchange safety, or permission for live control.
3. Keep raw provider payloads and source evidence internals out of user/admin UI; expose only status booleans and missing requirement keys/labels.
4. Prefer a DTO/projection helper over reading arbitrary `rawJson` in React/page components.

## Risks
1. A future UI that displays `canImportClosedTrades: true` without "mapper-ready only" copy could imply that closed-trade importer replay and analytics are complete.
2. Exposing `unsafeRawPayloadFields` or `blockers` directly can leak secret-shaped field names such as `api_key` or `Authorization`.
3. Passing `rawJson` or `liveConfig` through page props can accidentally expose provider-account runtime internals beyond the current masked admin inspector.
4. Adding source-proof status to health detail would require expanding an allowlist that is currently intentionally generic; metric-snapshot projection is safer.

## Verification/tests
RUN:
1. Read-only inspection of the requested files.
2. Static grep for `closedTradeSourceProof`, `rawJson`, `liveConfig`, provider URL/env names, secret-shaped strings, and live-control strings in the requested source/test set.
3. `git status --short --branch` to confirm the worktree was already dirty before this handoff.

NOT RUN:
1. Vitest/typecheck/lint/build - not requested for this read-only auditor lane and no product/source/test files were edited.
2. Browser/Playwright rendering - source-proof UI is not implemented in this lane.
3. DB queries/migrations - prohibited by read-only/no-mutation scope.
4. Env/secret reads - prohibited by scope.
5. Live Legacy provider/service calls, exchange pings, bot start/stop/apply-config, server control, deploy, CI - prohibited or outside scope.

## Next actions
1. Implement a small server-side projection such as `legacyClosedTradeSourceProofFromMetricRawJson(rawJson)` that returns only `status`, `canImportClosedTrades`, and `missingRequirements` after validating known enum values.
2. Add user/admin copy that says closed-trade source proof is blocked until a real Legacy source is proven; keep PnL/win-rate/profit-factor unavailable rather than zero.
3. Extend static tests to require the allowed fields and forbid `rawJson`, `liveConfig`, `rawPayloadAllowlist`, `unsafeRawPayloadFields`, `blockers`, evidence refs/source fields, provider URLs, secrets, and live-control strings in any new source-proof UI.
