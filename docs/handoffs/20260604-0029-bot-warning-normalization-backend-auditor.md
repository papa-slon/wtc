# bot-warning-normalization-backend-auditor handoff
## Scope
Read-only backend audit for WTC Phase 3.85 warning provenance and normalization across bot runtime health and statistics. Scope was limited to Tortila `warnings` and Legacy `warningCodes` as produced by worker snapshots and consumed by user statistics, bot safety/dashboard, admin system health, admin bot fleet, and admin user bot detail surfaces.

This audit did not read or write `.env`, secrets, provider databases, live bots, SSH, tmux, systemd, or live server state. It did not edit product or test code. The only file written is this canonical handoff.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`
5. `docs/CANONICAL_ANALYTICS_MODEL.md`
6. `docs/BOT_CONTROL_SAFETY_MODEL.md`
7. `docs/CONTRACTS/legacy-bot-adapter.md`
8. `packages/bot-adapters/src/warnings.ts`
9. `packages/bot-adapters/src/types.ts`
10. `packages/db/src/schema.ts`
11. `packages/db/src/repositories.ts`
12. `apps/worker/src/jobs.ts`
13. `apps/worker/src/legacy-live.ts`
14. `apps/web/src/features/bots/data.tsx`
15. `apps/web/src/app/(app)/app/bots/page.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
18. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
19. `apps/web/src/features/bots/statistics-panels.tsx`
20. `apps/web/src/features/admin/health-detail.ts`
21. `apps/web/src/features/admin/queries.ts`
22. `apps/web/src/features/admin/bot-health-loader.ts`
23. `apps/web/src/features/admin/user-bot-detail-loader.ts`
24. `apps/web/src/features/admin/types.ts`
25. `apps/web/src/app/admin/bots/page.tsx`
26. `apps/web/src/app/admin/system-health/page.tsx`
27. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
28. `tests/integration/admin-health-detail.test.ts`
29. `tests/integration/admin-bot-health-loader.test.ts`
30. `tests/integration/admin-user-bot-detail-static.test.ts`
31. `tests/integration/admin-user-bot-detail-loader.test.ts`
32. `tests/integration/bot-read-safety-static.test.ts`
33. `tests/integration/bot-statistics-static.test.ts`
34. `tests/integration/legacy-live-worker-static.test.ts`
35. `tests/integration/legacy-provider-worker.test.ts`
36. `tests/integration/worker-health-mapping.test.ts`
37. `tests/integration/worker-tortila-snapshot.test.ts`
38. `tests/e2e/smoke.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. There is no single canonical code-to-warning normalizer for persisted DB warning provenance. Evidence: the canonical code registry includes Tortila and Legacy codes at `packages/bot-adapters/src/warnings.ts:12`, `packages/bot-adapters/src/warnings.ts:20`, and `packages/bot-adapters/src/warnings.ts:24`, while the DB-backed user loader hard-codes only Tortila persistent warnings and one Legacy code at `apps/web/src/features/bots/data.tsx:183`, `apps/web/src/features/bots/data.tsx:187`, and `apps/web/src/features/bots/data.tsx:190`. Recommendation: add a pure shared normalizer, for example `warningsFromCodes(productCode, codes)`, in `@wtc/bot-adapters` or another non-React package; filter with `isCanonicalWarningCode`, de-dupe, and return `RiskWarning[]`. Target part: shared bot warning DTO/projection.

2. Severity: High. Tortila signal warning codes are persisted by the worker but are dropped by DB-backed user surfaces. Evidence: the Tortila worker stores `health.warnings.map((w) => w.code)` in metric `rawJson.warningCodes` at `apps/worker/src/jobs.ts:179` and `apps/worker/src/jobs.ts:185`, and stores health-detail `warnings` at `apps/worker/src/jobs.ts:235` and `apps/worker/src/jobs.ts:240`; the DB loader returns only `TORTILA_PERSISTENT_WARNINGS` for Tortila at `apps/web/src/features/bots/data.tsx:183`, ignores `detail.warnings` at `apps/web/src/features/bots/data.tsx:187`, and statistics renders only `activeRead.warnings.data` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:393`. Recommendation: normalize both `detail.warningCodes` and `detail.warnings` as scalar code arrays for Tortila, with latest metric `rawJson.warningCodes` used only as a sanitized fallback inside the server loader if health detail is absent. Target part: user bot dashboard, safety, statistics, and bot list warning counts.

3. Severity: High. Legacy `no_trade_history` is generated and persisted but not rendered as a normalized warning, so Legacy statistics can look quieter than the runtime contract says. Evidence: `buildLegacyLiveWarnings` always returns `no_trade_history` and adds `legacy_quarantined` when needed at `apps/worker/src/legacy-live.ts:311`; the Legacy metric snapshot writes `warningCodes` at `apps/worker/src/legacy-live.ts:430` and `apps/worker/src/legacy-live.ts:443`; Legacy fleet health writes `warningCodes` at `apps/worker/src/legacy-live.ts:567` and `apps/worker/src/legacy-live.ts:586`; the UI mapping only handles `legacy_quarantined` at `apps/web/src/features/bots/data.tsx:189` and `apps/web/src/features/bots/data.tsx:190`. The adapter contract requires `no_trade_history` as a `BotHealth.warnings[]` warning at `docs/CONTRACTS/legacy-bot-adapter.md:293` and `docs/CONTRACTS/legacy-bot-adapter.md:306`. Recommendation: map `no_trade_history` to an info-level `RiskWarning` everywhere Legacy DB snapshots are shown, and keep `legacy_quarantined` warning-level. Target part: Legacy statistics, safety, dashboard, and read model.

4. Severity: Medium. Admin health detail projection allowlists `warnings` but not `warningCodes`, so Legacy health rows can lose warning provenance before rendering. Evidence: `SAFE_HEALTH_DETAIL_KEYS` contains `warnings` at `apps/web/src/features/admin/health-detail.ts:36` but not `warningCodes`; system health maps every health row through `projectHealthDetail` at `apps/web/src/features/admin/queries.ts:238` and `apps/web/src/features/admin/queries.ts:242`; admin bot health does the same at `apps/web/src/features/admin/bot-health-loader.ts:285` and `apps/web/src/features/admin/bot-health-loader.ts:292`. Recommendation: project a sanitized canonical warning-code array for admin health rows, either by allowlisting `warningCodes` after canonical filtering or by projecting a normalized `warnings` summary. Keep arbitrary provider text, quarantine reasons, URLs, and errors out unless separately redacted and approved. Target part: admin system health and admin bot health tables.

5. Severity: Medium. The admin bot fleet page shows static Tortila persistent warnings, but it has no explicit normalized runtime warning summary for either bot. Evidence: the page imports static `TORTILA_PERSISTENT_WARNINGS` at `apps/web/src/app/admin/bots/page.tsx:7` and renders them unconditionally at `apps/web/src/app/admin/bots/page.tsx:142`; the loader selects the latest Legacy metric `rawJson` only to build safe `liveConfig` rows at `apps/web/src/features/admin/bot-health-loader.ts:206` and `apps/web/src/features/admin/bot-health-loader.ts:224`; `AdminBotHealthResult` has health rows and runtime facts but no warning summary field at `apps/web/src/features/admin/types.ts:285` and `apps/web/src/features/admin/types.ts:323`. Recommendation: add an explicit `botWarningSummaries` or `warningCodesByTarget` field derived from sanitized health detail, not provider raw config, and render counts/max severity plus canonical labels above the health table. Target part: `/admin/bots`.

6. Severity: Medium. The per-user admin bot drilldown intentionally avoids metric `rawJson`, which is good for secret safety, but it also means warning provenance cannot be added there by reading raw snapshot blobs. Evidence: the static guard rejects `schema.botMetricSnapshots.rawJson` in the loader at `tests/integration/admin-user-bot-detail-static.test.ts:42`; the loader selects scalar metric columns only at `apps/web/src/features/admin/user-bot-detail-loader.ts:791` through `apps/web/src/features/admin/user-bot-detail-loader.ts:804`; `AdminUserBotSummary` has no warning field at `apps/web/src/features/admin/types.ts:135` through `apps/web/src/features/admin/types.ts:155`. Recommendation: if warnings are shown in `/admin/users/[userId]/bots`, feed them through a sanitized per-user/per-provider warning DTO or canonical health summary, never by exposing `rawJson` to the admin loader. Target part: admin user bot detail.

## Decisions
1. Treat `integration_health_checks.detail.warningCodes`, `integration_health_checks.detail.warnings`, and `bot_metric_snapshots.rawJson.warningCodes` as provenance inputs, not as UI contracts.
2. Normalize warning codes in a shared non-React package or server-only DTO before any UI page receives them.
3. Preserve the current secret-safety posture: scalar code arrays are acceptable only after canonical filtering; raw provider rows, provider DB URLs, exchange keys, tokens, raw errors, and quarantine free text must not be rendered by default.
4. Keep live bot control, exchange ping, worker restart/tick, provider DB access, and `.env` access out of scope for this normalization slice.
5. Preserve Legacy provider-account scoping from Phase 3.84: user-facing Legacy warnings should be shown only inside the same user-owned bot instance plus active provider-account mapping boundary used for runtime facts.

## Risks
1. Current user-facing DB mode can undercount warnings: Tortila signal codes and Legacy `no_trade_history` are produced but not consistently rendered.
2. Adding `warningCodes` directly to admin projection without canonical filtering could expose arbitrary strings from provider-adjacent health details.
3. Reading metric `rawJson` broadly to recover warning codes would weaken the existing admin drilldown secret boundary.
4. Duplicated warning mapping logic across worker, user read model, admin health, and tests will drift unless a shared normalizer owns code-to-banner semantics.
5. A health-detail-only approach can miss codes present in metric snapshots after historical worker runs; a rawJson-only approach can bypass safer redaction. The next implementation should prefer health detail but include a narrow sanitized fallback if needed.

## Verification/tests
RUN:
1. Read required governance and prior-phase docs before source inspection.
2. Static source inspection with `rg` and line-numbered `Get-Content` for worker producers, user read model, statistics pages, admin loaders/pages, warning registry, DB health storage, and focused tests.
3. Confirmed no `.env`, secrets, provider DBs, live bots, SSH, tmux, systemd, worker tick, live server mutation, or product/test code edits were performed.

NOT RUN:
1. `npm test` - not run; this was a read-only audit and no implementation was changed.
2. Focused Vitest suites - not run; static evidence was sufficient to identify the provenance gap.
3. Playwright/browser checks - not run; no UI implementation changed.
4. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run secret:scan`, `npm run governance:check` - not run; no product/test code changed.
5. `db:migrate`, `db:seed`, worker tick/restart, live exchange ping, live bot start/stop/apply/retest, SSH/tmux/systemd/provider DB reads or writes - not run by policy.

## Next actions
1. Implement a shared `warningsFromCodes(productCode, codes)` normalizer using `CANONICAL_WARNING_CODES` and full `RiskWarning` definitions for `tp_reconcile_p0`, `margin_preflight_p1`, Tortila signal codes, `no_trade_history`, and `legacy_quarantined`.
2. Standardize worker health detail to include `warningCodes` for both Tortila and Legacy; keep `warnings` as a backwards-compatible alias only if needed, and ensure all arrays contain canonical string codes only.
3. Update `apps/web/src/features/bots/data.tsx` so DB-backed user reads normalize codes from health detail, and optionally from the latest user-scoped metric raw warning codes through a narrow server-only extractor that returns only canonical codes.
4. Update admin projection so `projectHealthDetail` either exposes filtered `warningCodes` or a normalized warning summary; render admin bot fleet warnings explicitly instead of relying on truncated JSON.
5. Keep `/admin/users/[userId]/bots` rawJson-free; add warnings there only through a sanitized scoped DTO if the product requires per-user admin warning visibility.
6. Add focused tests: Legacy `no_trade_history` and `legacy_quarantined` render from DB warning codes, Tortila signal codes survive DB mode, admin health projection preserves canonical `warningCodes` while redacting secrets, and admin user drilldown still does not select/render `rawJson`.
