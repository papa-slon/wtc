# bot-warning-normalization-ux-tests-auditor handoff
## Scope
Read-only UX/tests audit for WTC Phase 3.85. Scope was user/admin bot warning visibility and statistics/dashboard copy for Tortila and Legacy, with attention to bot dashboards, statistics, settings, safety, admin bot health, admin user bot detail, cabinet/dashboard cards, and relevant e2e/static tests.

No product code, test code, env files, secrets, provider DBs, live bots, SSH, tmux, or systemd were read or modified. This agent wrote only this canonical handoff.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`
5. `docs/handoffs/20260603-2356-bot-readiness-server-dto-db-backend-auditor.md`
6. `docs/handoffs/20260603-2356-bot-readiness-server-dto-tests-ux-auditor.md`
7. `packages/bot-adapters/src/warnings.ts`
8. `packages/bot-adapters/src/types.ts`
9. `packages/bot-adapters/src/mock-legacy.ts`
10. `apps/worker/src/jobs.ts`
11. `apps/worker/src/legacy-live.ts`
12. `apps/web/src/features/bots/data.tsx`
13. `apps/web/src/features/bots/meta.ts`
14. `apps/web/src/features/bots/statistics-panels.tsx`
15. `apps/web/src/app/(app)/app/bots/page.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
18. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
19. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
20. `apps/web/src/features/cabinet/loader.ts`
21. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
22. `apps/web/src/app/admin/bots/page.tsx`
23. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
24. `apps/web/src/features/admin/health-detail.ts`
25. `apps/web/src/features/admin/bot-health-loader.ts`
26. `apps/web/src/features/admin/user-bot-detail-loader.ts`
27. `apps/web/src/features/admin/types.ts`
28. `apps/web/src/features/admin/queries.ts`
29. `tests/e2e/smoke.spec.ts`
30. `tests/e2e/bot-readiness-map.spec.ts`
31. `tests/e2e/bot-settings.spec.ts`
32. `tests/e2e/admin-mobile-pg8.spec.ts`
33. `tests/integration/admin-health-detail.test.ts`
34. `tests/integration/admin-bot-health-loader.test.ts`
35. `tests/integration/admin-user-bot-detail-static.test.ts`
36. `tests/integration/admin-user-bot-detail-loader.test.ts`
37. `tests/integration/bot-read-safety-static.test.ts`
38. `tests/integration/bot-statistics-static.test.ts`
39. `tests/integration/cabinet-pg9.test.ts`
40. `tests/integration/legacy-live-worker-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - Warning provenance is still split by key name, so Legacy warning codes can be silently absent from admin and user copy. Evidence: Tortila worker health details write `warnings` at `apps/worker/src/jobs.ts:123` and `apps/worker/src/jobs.ts:240`; Legacy worker health details write `warningCodes` at `apps/worker/src/legacy-live.ts:586` and `apps/worker/src/legacy-live.ts:637`; user DB warning projection reads only `detail.warningCodes` at `apps/web/src/features/bots/data.tsx:187-190`; admin health projection allowlists `warnings` but not `warningCodes` at `apps/web/src/features/admin/health-detail.ts:3-37`. Recommendation: add one shared server-side normalizer that accepts both `warnings` and `warningCodes`, maps canonical codes to safe `RiskWarning` title/detail/severity, and is used by user read models, admin bot health, and cabinet summaries. Target part: warning normalization DTO/projection.

2. High - Legacy `no_trade_history` is a real worker warning but can render as no warnings on user safety/statistics surfaces. Evidence: `buildLegacyLiveWarnings` always starts with `no_trade_history` at `apps/worker/src/legacy-live.ts:311-314`; the current DB warning mapper only turns `legacy_quarantined` into a visible Legacy warning at `apps/web/src/features/bots/data.tsx:190-198`; the safety page renders `No active safety events` when the normalized array is empty at `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:54-59`; the statistics page renders `No adapter warnings` when the same array is empty at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:393-400`. Recommendation: ensure Legacy `no_trade_history` appears as an info-level status note on Legacy safety/statistics/dashboard copy, and reserve "no warnings" empty states for cases where the latest snapshot was actually read and contained no warning codes. Target part: Legacy user warning copy.

3. Medium - The cabinet/user dashboard warning summary is Tortila-only even though the dashboard copy presents operational notices as an owned-product summary. Evidence: cabinet loader imports `TORTILA_WARNINGS` at `apps/web/src/features/cabinet/loader.ts:23`, computes only `tortilaWarningsSummary` at `apps/web/src/features/cabinet/loader.ts:67-72`, assigns `signals.warnings` only when `code === 'tortila_bot'` at `apps/web/src/features/cabinet/loader.ts:115`, and totals `noticeCount` from those card warnings at `apps/web/src/features/cabinet/loader.ts:186`; the card renders generic `operational notice(s)` copy at `apps/web/src/features/cabinet/CabinetProductCard.tsx:88-93`. Recommendation: feed cabinet cards from the same normalized warning summary for both bot products, with product-specific copy or link text so Legacy warnings are not hidden behind a zero notice count. Target part: user cabinet/dashboard copy.

4. Medium - Admin bot health exposes Legacy runtime status but not an explicit normalized warning summary. Evidence: loader captures `quarantined` and `quarantineReason` from Legacy provider rows at `apps/web/src/features/admin/bot-health-loader.ts:241-242`; the admin page renders only a status pill of `quarantined`, `running`, or `paused` at `apps/web/src/app/admin/bots/page.tsx:304-307`; the integration health table falls back to truncated JSON detail at `apps/web/src/app/admin/bots/page.tsx:401-402`; the current health-detail unit test proves only `warnings` survives projection at `tests/integration/admin-health-detail.test.ts:21-35`. Recommendation: add an admin-visible "Warning summary" or per-target warning card for `legacy-bot` and `tortila-journal`, showing canonical warning titles/counts and sanitized quarantine reason context instead of relying on raw JSON truncation. Target part: admin bot health.

5. Medium - Admin user bot detail has no per-bot warning/status summary, so an admin drilling into a user can inspect metrics and positions without seeing the same bot warning truth. Evidence: `AdminUserBotSummary` has no warning/status summary field at `apps/web/src/features/admin/types.ts:135-155`; the loader selects metric, position, and trade rows at `apps/web/src/features/admin/user-bot-detail-loader.ts:791-853` and returns per-bot summaries without warnings at `apps/web/src/features/admin/user-bot-detail-loader.ts:909-933`; the page renders latest metrics and stats scope at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:245-268` but no warning card. Recommendation: add a scalar, secret-free `warningSummary` or `statusSummary` to the admin user bot DTO, scoped by user bot instance and Legacy active provider mapping. If no warning snapshot was evaluated, copy should say "not evaluated" rather than imply clear status. Target part: admin user bot detail.

6. Medium - Existing tests prove Tortila warning visibility and readiness rows, but do not prove Legacy/admin warning normalization. Evidence: Playwright smoke asserts Tortila warning copy at `tests/e2e/smoke.spec.ts:30-33` and `tests/e2e/smoke.spec.ts:140-144`; bot readiness e2e asserts rows but no warning text at `tests/e2e/bot-readiness-map.spec.ts:16-38`; bot settings e2e focuses configuration at `tests/e2e/bot-settings.spec.ts:34-45`; admin mobile e2e checks heading, nav, storage pill, and no horizontal scroll only at `tests/e2e/admin-mobile-pg8.spec.ts:42-59`; bot statistics static tests cover Legacy panels but not warning copy at `tests/integration/bot-statistics-static.test.ts:64-75`. Recommendation: add focused tests for the shared normalizer, Legacy `no_trade_history` and `legacy_quarantined` on user safety/statistics, cabinet notice count for Legacy, and admin bot health/user detail warning summaries. Target part: tests/e2e and integration acceptance.

7. Medium - Empty-state copy currently risks equating "not surfaced" with "no risk." Evidence: safety uses `No active safety events` with a generic hint at `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:54-56`; statistics uses `No adapter warnings` at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:393-400`; DB read failures can still produce empty warning arrays when normalization misses a key at `apps/web/src/features/bots/data.tsx:187-198`. Recommendation: after normalization, distinguish `no warning codes reported by latest snapshot`, `warnings not evaluated`, and `warnings unavailable because read is blocked/not configured`. Target part: warning/status copy.

## Decisions
1. This audit treats `packages/bot-adapters/src/warnings.ts` as the canonical copy registry for warning titles/details/severity, with worker code arrays as evidence inputs.
2. Missing warning data should not be presented as healthy or clear. The UI should show an honest "not evaluated/unavailable" state when the source snapshot was not read or could not be normalized.
3. Legacy static caveats and Legacy dynamic worker warning codes are related but distinct: both should be visible, but tests should prove which source each surface is using.
4. Admin health and user bot detail should show summaries, not raw `JSON.stringify(detail)` snippets, for warning acceptance.

## Risks
1. This was a source/read-only audit; no app, DB, Playwright, or Vitest execution was performed.
2. Some warning behavior depends on production DB snapshot mode (`NODE_ENV=production` with non-mock adapter mode), so demo/mock pages may hide the production drift.
3. Current line references are accurate for this audit snapshot but may drift after Phase 3.85 edits.
4. Normalizing warning codes must stay secret-safe: no raw provider DB row, `.env`, exchange key, URL, stack trace, token, or provider DB secret should enter warning DTOs or test fixtures.

## Verification/tests
RUN:
1. Read required process/context docs: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/handoffs/20260603-2356-phase-3-84-bot-readiness-server-dto.md`.
2. Source-inspected warning registries, worker warning emitters, user bot read model, user dashboard/statistics/settings/safety pages, cabinet loader/card, admin bot health, admin user bot detail, and relevant e2e/static/integration tests.
3. Cross-checked the Phase 3.84 DB/backend and tests/UX auditor handoffs for prior warning-normalization notes.

NOT RUN:
1. `npm test` - not run; read-only audit only.
2. `npm run e2e` - not run; read-only audit only.
3. `npm run typecheck` or builds - not run; no product/test code edited.
4. `npm run secret:scan` or `npm run governance:check` - not run; this handoff only was added.
5. DB migrations, DB seeds, live provider DB reads, live bot start/stop/apply/retest, worker ticks/restarts, SSH, tmux, systemd, and `.env` access - not run by policy.

## Next actions
1. Implement a shared warning normalizer that accepts `warnings` and `warningCodes`, maps only canonical codes, deduplicates by code, and returns safe `RiskWarning` DTOs for Tortila and Legacy.
2. Use the normalizer in `loadBotReadModelForUser`, admin bot health projection, cabinet warning summaries, and admin user bot detail summaries.
3. Update UI copy so user safety/statistics/dashboard and admin health/detail surfaces distinguish "reported no warning codes", "warning snapshot unavailable", and "read blocked/not configured".
4. Add integration tests for Tortila `warnings`, Tortila `warningCodes`, Legacy `no_trade_history`, Legacy `legacy_quarantined`, unknown-code filtering, and no secret leakage.
5. Add Playwright/static acceptance for `/app/bots/legacy/safety`, `/app/bots/statistics?bot=legacy`, `/admin/bots`, `/admin/users/<id>/bots`, and cabinet notice count/copy.
