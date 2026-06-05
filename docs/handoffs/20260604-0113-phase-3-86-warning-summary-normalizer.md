# phase-3-86-warning-summary-normalizer handoff
## Scope
Phase 3.86 implemented the shared canonical bot warning normalizer and wired the first DTO/UI consumers after Phase 3.85. The slice stayed inside warning-code normalization and read-only warning summaries for Tortila/Legacy bot surfaces.

Background read-only agents were launched before edits, per `docs/SESSION_PROTOCOL.md`, and their handoffs are linked below:
1. `docs/handoffs/20260604-0052-warning-normalizer-backend-auditor.md`
2. `docs/handoffs/20260604-0052-warning-summary-ux-tests-auditor.md`
3. `docs/handoffs/20260604-0052-warning-scope-security-auditor.md`

All three background agents were collected and closed before this aggregate report.

Out of scope: live bot start/stop/apply-config, worker ticks, provider DB reads, `.env`/secrets, SSH/tmux/systemd, raw provider JSON refactors, and broad visual redesign.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0049-phase-3-85-bot-warning-normalization.md`
8. `packages/bot-adapters/src/warnings.ts`
9. `packages/bot-adapters/src/index.ts`
10. `packages/bot-adapters/src/adapters.test.ts`
11. `apps/web/src/features/bots/data.tsx`
12. `apps/web/src/features/admin/health-detail.ts`
13. `apps/web/src/features/admin/types.ts`
14. `apps/web/src/features/admin/bot-health-loader.ts`
15. `apps/web/src/app/admin/bots/page.tsx`
16. `apps/web/src/features/cabinet/loader.ts`
17. `apps/web/src/features/admin/user-bot-detail-loader.ts`
18. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
19. `tests/integration/admin-health-detail.test.ts`
20. `tests/integration/admin-bot-health-loader.test.ts`
21. `tests/integration/bot-read-safety-static.test.ts`
22. `tests/integration/cabinet-pg9.test.ts`
23. `tests/integration/admin-user-bot-detail-static.test.ts`
24. `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
1. `packages/bot-adapters/src/warnings.ts`
2. `packages/bot-adapters/src/index.ts`
3. `packages/bot-adapters/src/adapters.test.ts`
4. `apps/web/src/features/bots/data.tsx`
5. `apps/web/src/features/admin/health-detail.ts`
6. `apps/web/src/features/admin/types.ts`
7. `apps/web/src/features/admin/bot-health-loader.ts`
8. `apps/web/src/app/admin/bots/page.tsx`
9. `apps/web/src/features/cabinet/loader.ts`
10. `apps/web/src/features/admin/user-bot-detail-loader.ts`
11. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
12. `tests/integration/admin-bot-health-loader.test.ts`
13. `tests/integration/bot-read-safety-static.test.ts`
14. `tests/integration/cabinet-pg9.test.ts`
15. `tests/integration/admin-user-bot-detail-static.test.ts`
16. `tests/integration/admin-user-bot-detail-loader.test.ts`
17. `docs/handoffs/20260604-0052-warning-normalizer-backend-auditor.md`
18. `docs/handoffs/20260604-0052-warning-summary-ux-tests-auditor.md`
19. `docs/handoffs/20260604-0052-warning-scope-security-auditor.md`
20. `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`

## Findings
1. Severity: High. Warning-code parsing was duplicated in app surfaces and lacked one product-aware package owner. Evidence: `apps/web/src/features/bots/data.tsx` had local warning maps before this phase; `packages/bot-adapters/src/warnings.ts` now owns `warningCodesFromDetail`, `warningsFromDetail`, `warningSummaryFromWarnings`, and product-specific runtime warning definitions. Recommendation: keep future warning summary work importing from `@wtc/bot-adapters`, not page-local maps. Target part: bot warning normalization.
2. Severity: High. Legacy `legacy_quarantined` needed a registry-owned `RiskWarning` without becoming an unconditional Legacy adapter warning. Evidence: `LEGACY_RUNTIME_WARNINGS` now includes `legacy_quarantined`, while `LEGACY_WARNINGS` remains the baseline returned by blocked/mock Legacy adapters. Recommendation: keep runtime-only Legacy warnings conditional on persisted health codes. Target part: Legacy runtime health.
3. Severity: High. Admin warning visibility needed a first-class DTO, not truncated JSON. Evidence: `AdminBotHealthResult.botWarningSummaries` is now derived from sanitized `integration_health_checks` detail and rendered in `/admin/bots` as a canonical warning summary card. Recommendation: do not treat `JSON.stringify(hc.detail)` as the operator warning UI. Target part: admin fleet page.
4. Severity: High. Admin user bot drilldown needed warning visibility without reading raw metric/trade JSON or over-attributing global Legacy runtime warnings. Evidence: `AdminUserBotSummary.warningSummary` now uses registry-owned product warnings and only includes Legacy runtime health codes when the latest health row reports exactly one scoped provider-account mapping. Recommendation: preserve the `schema.botMetricSnapshots.rawJson` and `schema.botTradeImports.rawJson` bans in this loader. Target part: `/admin/users/[userId]/bots`.
5. Severity: Medium. Cabinet warnings were Tortila-only. Evidence: `apps/web/src/features/cabinet/loader.ts` now derives `signals.warnings` from `knownWarningsForProduct` for both bot products, still inside the `decision.allowed` branch. Recommendation: keep cabinet notice counts entitlement-gated. Target part: user cabinet.

## Decisions
1. `@wtc/bot-adapters` is the canonical warning registry and normalizer owner.
2. Admin fleet summaries use sanitized health details plus product-aware registry mapping.
3. Admin user summaries are diagnostic only and do not alter `accessOpen`, entitlements, CTAs, or live-control state.
4. Legacy runtime warning attribution in user drilldown is conservative: product warnings are visible, but dynamic health warnings are included only when the worker health row is uniquely scoped to one provider-account mapping.
5. Unknown, secret-shaped, or provider-origin warning strings are dropped; UI copy comes from registry-owned `RiskWarning` title/detail only.

## Risks
1. Full UI/browser rendering was not rechecked in this phase, so layout polish for the new summary blocks still needs a later Playwright/browser pass.
2. Legacy fleet inspector still contains a separate rawJson-backed read path from earlier phases; this phase did not refactor that path, only avoided extending it into user drilldown warning summaries.
3. `knownWarningsForProduct('tortila_bot')` still surfaces the full known Tortila warning set, including observed signal warnings, as product-level caveats; a future evaluated-state DTO could distinguish "known issue" from "latest health code observed".

## Verification/tests
RUN:
1. `npx vitest run packages/bot-adapters/src/adapters.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-bot-health-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/cabinet-pg9.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - passed, 7 files / 64 tests.
2. `npm run typecheck -w @wtc/web` - passed.
3. `npm run secret:scan` - passed.
4. `npm run governance:check` - passed with 0 errors and 1 known historical warning: `20260529-1921-integration-risk-auditor.md` missing `## Files inspected`.
5. `git diff --check` - passed.
6. Background agents collected and closed: backend/platform auditor, UX/tests auditor, scope/security auditor.

NOT RUN:
1. Full `npm test` - skipped because the focused Phase 3.86 test set covered the changed warning paths; repo remains heavily dirty from prior phases.
2. Root `npm run typecheck`, `npm run lint`, and `npm run build` - skipped for this slice after focused web typecheck passed.
3. Playwright/e2e, browser preview, and screenshot checks - skipped because this phase was DTO/server/static-heavy and no local preview server was started.
4. Worker tick/smoke, live bot start/stop/apply-config/retest, exchange ping, provider DB reads, `.env`, vault/secrets, SSH/tmux/systemd - not run by policy/scope.

## Next actions
1. Add a later UI verification slice for the new `/admin/bots` and `/admin/users/[userId]/bots` summary blocks at desktop/mobile widths.
2. Promote a richer user-facing warning state DTO for `/app/bots`, `/app/bots/[bot]`, safety, and statistics so empty states can distinguish unavailable, not evaluated, and none reported.
3. Consider a future persisted per-instance warning summary table if Legacy runtime warnings must be attributed per mapped provider account without relying on global health-row counts.
4. Continue toward the broader bot completion goal: Legacy/Tortila settings, statistics, admin/user boundaries, and operational readiness remain an active multi-phase goal, not complete in this phase.
