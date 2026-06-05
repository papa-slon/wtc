# admin-selected-user-source-proof-safety-auditor handoff
## Scope
Phase 4.49 read-only safety/DTO audit for the admin selected-user bot drilldown and the Phase 4.48 user Legacy `closedTradeSourceProof` projection.

Inspected the current admin selected-user bot detail loader, page, DTO types, static/loader/rendered tests, and the user Legacy source-proof projection. Recommended a safe DTO path for showing Legacy source-proof status in the admin selected-user drilldown without exposing `rawJson`, `liveConfig`, provider payloads, env names, secrets, or live-control affordances.

No env/secret files were read. No live services, DB mutation, server control, bot control, provider probes, exchange pings, tests with live env, or code/test/docs edits were performed except this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md`
- `docs/handoffs/20260605-0410-legacy-source-proof-safety-auditor.md`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`

## Files changed
None - read-only audit. Wrote this handoff only.

## Findings
1. Severity P1 - The current admin selected-user DTO shape is narrow and safe for source-proof display, but it is sourced from the global source-proof constant rather than the Phase 4.48 user worker-metric projection. Evidence: `apps/web/src/features/admin/types.ts:51` defines `AdminUserBotClosedTradeSourceProofSummary` with only `status`, `canImportClosedTrades`, `missingRequirements`, and `blockerCount`; `apps/web/src/features/admin/types.ts:192` adds it to `AdminUserBotSummary`; `apps/web/src/features/admin/user-bot-detail-loader.ts:52` builds it from `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF`; `apps/web/src/features/admin/user-bot-detail-loader.ts:1246` attaches it for every Legacy bot. Recommendation: keep this DTO shape, but add an explicit safe provenance field such as `sourceScope: 'global_preflight' | 'scoped_worker_metric'` and `evaluatedAt: number | null`, or set the DTO to `null` when no scoped metric exists. Target part: admin selected-user source-proof DTO.

2. Severity P1 - The selected-user admin loader intentionally does not select metric `rawJson`, which prevents leaks but also means it cannot currently mirror the Phase 4.48 worker-metric `closedTradeSourceProof` value. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:1089` selects metric fields from `botMetricSnapshots` but lines `1090-1098` include no `rawJson`; `tests/integration/admin-user-bot-detail-static.test.ts:44` and `tests/integration/admin-user-bot-detail-static.test.ts:45` explicitly forbid `schema.botTradeImports.rawJson` and `schema.botMetricSnapshots.rawJson` in the selected-user loader; Phase 4.48 says dynamic selected-user admin projection was deferred because raw metric JSON needed a separate safe DTO design (`docs/handoffs/20260605-0410-phase-4-48-legacy-source-proof-visibility.md:117`). Recommendation: if admin needs dynamic worker proof, add a tiny server-only projection function that reads only `rawJson.closedTradeSourceProof`, immediately validates it, returns the DTO, and never exposes `rawJson` to types, props, or React. Target part: loader projection boundary.

3. Severity P1 - The page already renders a Legacy `Source-proof gate` in two places and keeps live control absent, but the current copy can imply a status was evaluated for the selected user even when the DTO came from global preflight. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:63` maps `bot.closedTradeSourceProof` to labels; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:88` summarizes missing requirements by count only; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:221` adds a `Source-proof gate` coverage row for Legacy; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:872` renders a `Source-proof gate` metric. Recommendation: render provenance-aware copy: `global source proof blocked` when sourced from the preflight constant, `scoped worker proof blocked` only when parsed from a selected-user scoped metric snapshot, and never call `ready_for_mapper` importer-ready. Target part: admin selected-user page copy.

4. Severity P1 - The Phase 4.48 user projection is the correct sanitization template if admin later parses worker metric proof. Evidence: `apps/web/src/features/bots/data.tsx:337` accepts only object input; `apps/web/src/features/bots/data.tsx:340` allows only `blocked_no_source`, `ready_for_mapper`, or `unknown`; `apps/web/src/features/bots/data.tsx:344` filters `missingRequirements` to safe key strings and caps the list at `32`; `apps/web/src/features/bots/data.tsx:349` accepts `canImportClosedTrades` only when it is exactly boolean `true`; `apps/web/src/features/bots/data.tsx:350` returns only the tiny DTO. Recommendation: move this projection into a shared server-safe helper used by both user and admin surfaces, or duplicate the exact allowlist in admin with tests until a shared package is practical. Target part: shared DTO helper.

5. Severity P1 - Forbidden fields/strings for the admin selected-user source-proof path must be encoded in tests before any dynamic rawJson parsing is introduced. Evidence: `apps/worker/src/legacy-closed-trade-source-proof.ts:48` contains internal result fields not all safe for UI; `apps/worker/src/legacy-closed-trade-source-proof.ts:53` and `apps/worker/src/legacy-closed-trade-source-proof.ts:54` include `unsafeRawPayloadFields` and `blockers`; `apps/worker/src/legacy-closed-trade-source-proof.ts:57` requires evidence refs; `apps/worker/src/legacy-closed-trade-source-proof.ts:59` treats secret-shaped field names as unsafe; `tests/integration/legacy-closed-trade-source-proof-static.test.ts:91` rejects `api_key`, `Authorization`, and unbounded raw payload fields; `tests/integration/legacy-closed-trade-source-proof-static.test.ts:113` forbids live IO and bot-control strings. Recommendation: add static and loader tests forbidding these strings in admin page/types/result JSON: `rawJson`, `liveConfig`, `providerAccounts`, `activeSlots`, `activeOrderSummary`, `rawPayloadAllowlist`, `unsafeRawPayloadFields`, `blockers`, `evidence`, `evidenceRef`, `sourceField`, `artifactId`, `missingRejectedSubstitutes`, `providerPubId`, full `providerAccountId`, `apiKey`, `apiSecret`, `secret`, `token`, `password`, `authorization`, `cookie`, `private`, `credential`, `dsn`, `headers`, `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, `DATABASE_URL`, `startBot`, `stopBot`, `applyConfig`, `closePosition`, `placeOrder`, `test connection`, `Connection verified`, `type="submit"`, and `CsrfField`. Target part: safety tests.

6. Severity P2 - Existing selected-user tests provide a strong base but need source-proof-specific dynamic cases. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:46` to `tests/integration/admin-user-bot-detail-static.test.ts:49` checks the current constant DTO helper; `tests/integration/admin-user-bot-detail-static.test.ts:243` to `tests/integration/admin-user-bot-detail-static.test.ts:248` checks the page source-proof copy; `tests/integration/admin-user-bot-detail-loader.test.ts:583` to `tests/integration/admin-user-bot-detail-loader.test.ts:638` asserts no cross-user rows, raw config, secret markers, provider IDs, or health-secret markers leak from loader JSON; `tests/e2e/admin-user-bot-detail-db.spec.ts:148` to `tests/e2e/admin-user-bot-detail-db.spec.ts:199` lists hidden rendered markers and live-control labels; `tests/e2e/admin-user-bot-detail-db.spec.ts:274` to `tests/e2e/admin-user-bot-detail-db.spec.ts:277` asserts no forms, CSRF fields, or start/stop/apply/test buttons. Recommendation: add a fixture metric whose `rawJson.closedTradeSourceProof` includes safe keys plus hostile sibling fields, then assert the returned DTO and rendered text contain only status/count/safe keys and none of the forbidden internals. Target part: admin-user loader and rendered DB acceptance.

7. Severity P2 - Admin selected-user provider identity masking remains correct and should not be loosened for source-proof display. Evidence: `apps/web/src/features/admin/user-bot-detail-loader.ts:824` to `apps/web/src/features/admin/user-bot-detail-loader.ts:830` masks provider account IDs; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:125` to `apps/web/src/app/admin/users/[userId]/bots/page.tsx:129` renders only the masked provider account string; `tests/integration/admin-user-bot-detail-loader.test.ts:571` to `tests/integration/admin-user-bot-detail-loader.test.ts:580` expects the masked `USER_A...B_ID`; `tests/integration/admin-user-bot-detail-loader.test.ts:589` to `tests/integration/admin-user-bot-detail-loader.test.ts:590` assert the full provider ID is absent. Recommendation: source-proof status should not include raw provider account values, provider source rows, source table names from evidence refs, or raw payload allowlists. Target part: provider-boundary safety.

## Decisions
1. Do not recommend passing `rawJson`, `liveConfig`, provider payload arrays, worker raw payloads, or source-proof evidence internals through `AdminUserBotSummary`.
2. Treat the current admin DTO as safe but incomplete for dynamic selected-user worker proof because it is based on `CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF`.
3. Prefer a shared projection helper with the Phase 4.48 allowlist over React/page-level parsing.
4. Treat `blocked_no_source` as the current truthful production-safe state and `ready_for_mapper` as mapper-contract readiness only, not importer completion, analytics readiness, exchange safety, or live-control approval.
5. Keep selected-user admin drilldown read-only: no forms, no CSRF mutation controls, no start/stop/apply/test buttons, no provider or exchange live calls.

## Risks
1. If the admin page displays global preflight status without provenance, operators may misread it as selected-user worker snapshot proof.
2. If a future implementation weakens the static `rawJson` ban without a local parse-and-discard helper, `liveConfig` or provider payloads could reach page props.
3. If source-proof internals like `blockers`, `unsafeRawPayloadFields`, `evidenceRef`, or raw payload allowlists are rendered, they can leak secret-shaped field names or source implementation details.
4. If `canImportClosedTrades: true` is copied as "analytics ready", admin UX could imply a closed-trade importer and replay gate are complete when they are not.
5. Current local tree is very dirty and includes many pre-existing changes; this audit did not verify build health.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and Phase 4.48 source-proof handoffs.
2. `git status --short --branch` - observed a large pre-existing dirty tree on `codex/bot-analytics-settings-canary-20260603`; no cleanup or revert attempted.
3. Static grep/read-only inspection for `closedTradeSourceProof`, `Source-proof gate`, `rawJson`, `liveConfig`, provider account fields, env-name strings, secret-shaped strings, and live-control strings across the selected-user admin loader/page/types/tests and Phase 4.48 user projection.
4. Confirmed required handoff path did not exist before writing: `docs/handoffs/20260605-0490-admin-selected-user-source-proof-safety-auditor.md`.

NOT RUN:
1. Vitest, typecheck, lint, build, Playwright - not run because this was a read-only auditor lane and no product/test files were edited.
2. DB queries, migrations, seed, managed DB matrix - prohibited/outside scope.
3. Env/secret reads - prohibited by scope.
4. Live Legacy DB/provider/exchange probes, exchange key ping, live bot start/stop/apply-config, close/open position actions, server control, deploy, production monitoring, GitHub CI - prohibited or outside scope.
5. Background agent dispatch - not applicable to this single read-only auditor lane; no background agents were started and none were left running.

## Next actions
1. Keep the existing admin DTO fields, but add provenance: `sourceScope`, `evaluatedAt`, and maybe `snapshotAt` if parsed from a scoped metric. Use copy that distinguishes global preflight from scoped worker proof.
2. If dynamic worker proof is required, add a server-only helper such as `projectLegacyClosedTradeSourceProof(value: unknown)` that returns only `status`, `canImportClosedTrades`, sanitized `missingRequirements`, and `blockerCount`; call it on `rawJson.closedTradeSourceProof` inside the loader and discard the raw object immediately.
3. Add/extend tests before implementation: static tests for no `rawJson`/`liveConfig`/provider payload/page props; loader fixture with hostile `rawJson.closedTradeSourceProof` sibling fields; rendered DB hidden markers for source-proof internals/env names/secrets/live-control labels.
4. Do not build Legacy closed-trade analytics/importer from source-proof status alone. Importer work remains blocked until a real source artifact passes the Phase 4.47 source-proof contract and a separate audited mapper/importer gate.
