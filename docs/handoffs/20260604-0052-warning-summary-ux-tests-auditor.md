# warning-summary-ux-tests-auditor handoff
## Scope
Read-only Phase 3.86 UX/tests audit of warning visibility after Phase 3.85 bot warning normalization. Scope covered user bot dashboard/safety/statistics/list, cabinet product cards at `/app` and `/app/products`, `/admin/bots`, and `/admin/users/[userId]/bots`.

This audit did not edit product or test code, did not read `.env` or provider databases, did not touch live bots, SSH, tmux, systemd, worker ticks, or live controls.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md`
8. `packages/bot-adapters/src/warnings.ts`
9. `apps/web/src/features/bots/data.tsx`
10. `apps/web/src/app/(app)/app/bots/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
13. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
14. `apps/web/src/features/cabinet/loader.ts`
15. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
16. `packages/cabinet/src/derive.ts`
17. `apps/web/src/features/admin/health-detail.ts`
18. `apps/web/src/features/admin/bot-health-loader.ts`
19. `apps/web/src/features/admin/user-bot-detail-loader.ts`
20. `apps/web/src/features/admin/types.ts`
21. `apps/web/src/features/admin/queries.ts`
22. `apps/web/src/app/admin/bots/page.tsx`
23. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
24. `tests/integration/bot-read-safety-static.test.ts`
25. `tests/integration/bot-statistics-static.test.ts`
26. `tests/integration/admin-health-detail.test.ts`
27. `tests/integration/admin-bot-health-loader.test.ts`
28. `tests/integration/admin-user-bot-detail-static.test.ts`
29. `tests/integration/admin-user-bot-detail-loader.test.ts`
30. `tests/integration/cabinet-pg9.test.ts`
31. `tests/e2e/smoke.spec.ts`
32. `tests/e2e/admin-mobile-pg8.spec.ts`
33. `tests/e2e/cabinet-pg9-mobile.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Medium - User statistics can still show a false-clear empty state when the warnings read itself is unavailable. Evidence: statistics loads `warnings` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:223`, but the read-issue banner excludes `activeRead?.warnings.issue` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:329`; the warning card then falls through to `No adapter warnings` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:393-400`. Recommendation: render `read.warnings.issue` before the empty state and change copy to distinguish "warning snapshot unavailable", "read blocked/not configured", and "latest snapshot reported no warning codes". Target part: `/app/bots/statistics`.
2. Medium - User dashboard and bot list expose warning counts/titles, but not a first-class warning summary DTO. Evidence: the bot list only loads `['metrics']` at `apps/web/src/app/(app)/app/bots/page.tsx:20` and prints `health.warnings.length` at `apps/web/src/app/(app)/app/bots/page.tsx:82-85`; the bot dashboard does not request the `warnings` part at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:112-114` and renders raw `health.warnings` under `Runtime status notes` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:161-166`. Recommendation: add `warningSummary` to the bot read model/health projection with `count`, `activeCount`, `maxSeverity`, `codes`, `source`, `evaluatedAt`, and `readState`, then render the same summary on list, dashboard, safety, and statistics. Target part: user `/app/bots` and `/app/bots/[bot]`.
3. Medium - Safety page is closest to correct but its zero state still implies "clear" even when the absence could be a non-evaluated snapshot. Evidence: safety handles `read.warnings.issue` at `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:38-43`, but `warnings.length === 0` renders `No active safety events` at `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:54-57`. Recommendation: drive safety copy from the same `warningSummary.evaluationState` so the empty state says "No canonical warning codes in latest evaluated snapshot" only when that is true. Target part: `/app/bots/[bot]/safety`.
4. High - Cabinet warnings remain Tortila-only, so owned Legacy cards can report zero operational notices even after Legacy warning normalization. Evidence: cabinet imports `TORTILA_WARNINGS` only at `apps/web/src/features/cabinet/loader.ts:23`, computes `tortilaWarningsSummary()` at `apps/web/src/features/cabinet/loader.ts:67-72`, attaches `signals.warnings` only for `code === 'tortila_bot'` at `apps/web/src/features/cabinet/loader.ts:115`, and totals notices from card warnings at `apps/web/src/features/cabinet/loader.ts:186`; the card copy is generic `operational notice(s)` at `apps/web/src/features/cabinet/CabinetProductCard.tsx:88-93`. Recommendation: feed `CabinetSignals.warnings` from the shared warning summary for both `tortila_bot` and `legacy_bot`, including Legacy `no_trade_history` as info and `legacy_quarantined` as warning when present. Target part: `/app` and `/app/products` cabinet cards.
5. High - `/admin/bots` has normalized warning data in health detail but no first-class admin warning summary, so admins must notice truncated JSON or static Tortila banners. Evidence: static Tortila persistent banners render at `apps/web/src/app/admin/bots/page.tsx:142-150`; `AdminBotHealthResult` has health rows but no warning summary field at `apps/web/src/features/admin/types.ts:285-324`; the health table renders `JSON.stringify(hc.detail).slice(0, 120)` at `apps/web/src/app/admin/bots/page.tsx:401-402`; Phase 3.85 projection normalizes `warnings`/`warningCodes` to `warnings` in `apps/web/src/features/admin/health-detail.ts:96-98`. Recommendation: add `AdminBotWarningSummary[]` to `AdminBotHealthResult`, derived from sanitized canonical health detail, and render a visible "Warning summary" card by target/product before the health table. Target part: `/admin/bots`.
6. High - `/admin/users/[userId]/bots` has no per-bot warning/status summary, so a user drilldown can show metrics, positions, trades, and provider scope without the same warning truth. Evidence: `AdminUserBotSummary` has no warning field at `apps/web/src/features/admin/types.ts:135-155`; the loader selects metric/position/trade fields but intentionally not `schema.botMetricSnapshots.rawJson` at `apps/web/src/features/admin/user-bot-detail-loader.ts:791-853`; returned bot DTOs omit warnings at `apps/web/src/features/admin/user-bot-detail-loader.ts:909-933`; the page renders latest metrics/stats scope at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:245-268` with no warning card. Recommendation: add a scalar, secret-free `warningSummary` to `AdminUserBotSummary`, scoped by WTC bot instance and, for Legacy, the active provider-account mapping. Prefer sanitized health-detail provenance or a dedicated persisted warning-summary source; do not add metric `rawJson` reads to this drilldown. Target part: `/admin/users/[userId]/bots`.
7. Medium - Warning normalization is still implemented as surface-local arrays rather than a reusable summary builder. Evidence: the canonical registry exists in `packages/bot-adapters/src/warnings.ts:12-30` and warning DTOs are defined at `packages/bot-adapters/src/warnings.ts:33-68`; user DB projection has local `dbWarningsFromDetail` and product-code sets at `apps/web/src/features/bots/data.tsx:185-249`; admin health projection separately merges and filters strings at `apps/web/src/features/admin/health-detail.ts:65-98`. Recommendation: add one exported helper, for example `warningsFromCodes(productCode, inputs)` plus `summarizeWarnings(warnings, state)`, and use it in user read models, cabinet loader, admin bot health, and admin user bot detail. Target part: shared warning summary DTO/projection.
8. Medium - Tests cover Tortila visibility and admin projection sanitization, but not the newly important Legacy/cabinet/admin-summary UX. Evidence: Playwright smoke asserts Tortila warnings at `tests/e2e/smoke.spec.ts:30-33` and `tests/e2e/smoke.spec.ts:140-144`; statistics e2e checks Legacy panels but not warning text at `tests/e2e/smoke.spec.ts:124-129`; admin mobile e2e checks heading/nav/storage/no-scroll only at `tests/e2e/admin-mobile-pg8.spec.ts:42-59`; cabinet mobile e2e checks setup/blocker copy, not notices, at `tests/e2e/cabinet-pg9-mobile.spec.ts:18-28`. Recommendation: add focused integration tests for the shared normalizer and DTO consumers, plus e2e assertions for Legacy safety/statistics warning copy, cabinet Legacy notice count, `/admin/bots` warning summary visibility, and `/admin/users/[userId]/bots` warning summary copy/no horizontal scroll. Target part: tests/e2e and integration acceptance.

## Decisions
1. Treated Phase 3.85 as a successful array-normalization baseline for user read models and admin health-detail projection, not as completion of first-class UX summary DTOs.
2. Kept all proposed admin user drilldown work away from `bot_metric_snapshots.rawJson`; the current no-raw-json guard is a safety property to preserve.
3. Treated `no_trade_history` as a visible info-level Legacy status note, not an error, and `legacy_quarantined` as warning-level.
4. Treated empty-state copy as part of the risk model: "no warnings" should only appear when an evaluated snapshot reported no canonical warning codes.

## Risks
1. Without summary DTOs, future surfaces can regress to count-only or JSON-only warning visibility even while canonical warning arrays are present.
2. Cabinet `noticeCount` can undercount owned bot risk because it currently ignores Legacy warning truth.
3. Admin drilldowns can create an inconsistent operator experience: fleet view may show health detail warnings while user-specific drilldown appears quiet.
4. If teams add admin summaries by reading metric `rawJson`, they may reopen the raw-provider-data exposure risk that the current user drilldown avoids.

## Verification/tests
RUN:
1. Required docs/protocol and Phase 3.85 handoff read.
2. Read-only source inspection using `rg` and `Get-Content` over the scoped user, cabinet, admin, and test files.
3. Worktree status inspected before writing; it was already heavily dirty with many pre-existing Phase 3 artifacts.

NOT RUN:
1. Product/test code edits - prohibited by this auditor scope.
2. Vitest, Playwright, lint, typecheck, build, or preview - skipped because this was a read-only UX/tests audit and no product/test code changed.
3. Worker ticks, live bot controls, exchange pings, provider DB reads, SSH, tmux, systemd, `.env`, vault, secrets, git stage/commit/push/PR - not run by policy/scope.

## Next actions
1. Add shared warning helpers: `warningsFromCodes(productCode, inputs)` and `summarizeWarnings(warnings, evaluationState)` with canonical filtering, dedupe, max severity, active count, source/evaluated timestamp, and "not evaluated" support.
2. Add `warningSummary` to the user bot read model and render it consistently on `/app/bots`, `/app/bots/[bot]`, `/app/bots/[bot]/safety`, and `/app/bots/statistics`.
3. Replace cabinet's Tortila-only summary with normalized bot warning summaries for both Tortila and Legacy; update the generic cabinet notice copy to link users to the relevant bot room/safety page.
4. Add `AdminBotWarningSummary[]` to `AdminBotHealthResult` and render an explicit `/admin/bots` warning summary card from canonical health-detail warnings, not truncated JSON.
5. Add `warningSummary` to `AdminUserBotSummary` for `/admin/users/[userId]/bots`, scoped to the user's bot instance and Legacy provider mapping, without selecting metric `rawJson`.
6. Update tests: shared normalizer behavior tests; `bot-read-safety-static`/`bot-statistics-static` for Legacy warning copy and warnings issue handling; `cabinet-pg9` for Legacy notice count; admin bot/user detail loader tests for warning DTOs and no secret/raw-json leakage; e2e/mobile checks for Legacy warnings and admin summary visibility.
