# Phase 3.70 bot settings workbench handoff
## Scope
Implemented a bounded bot settings/statistics UX hardening slice after required read-only agent fan-out.

Primary delivery:
- Tortila settings now uses a clearer per-coin card workbench with coin dropdowns, manual symbol override, Turtle system, risk, ATR stop/add, units, ATR period, TP R, and an explicit runtime export preview.
- Tortila setup/settings now render exchange-key metadata honestly: encrypted/masked only, no plaintext, no claimed live exchange ping, and the test button remains disabled pending security and bot-integration audit.
- Legacy settings now expose delay/delta filters as visible per-coin controls instead of hidden inputs, and the stage-capacity matrix has an explicit RSI/CCI slot summary.
- Settings save actions now run form issue preflight before Zod parsing and redirect to a visible validation banner instead of failing silently on invalid bot config.
- Legacy export was hardened to build from an allowlisted config shape instead of spreading raw live snapshot JSON.
- Admin bot health details now pass through the existing safe detail projector/redactor before rendering.
- Admin users now link to a read-only `/admin/users/[userId]/bots` drilldown that shows target-user WTC bot access, config version state, masked exchange-key metadata, and latest target-owned metric snapshots without live control, live key testing, raw config JSON, or Legacy provider-account ownership claims.
- The admin drilldown loader now has a pure `Db`-injected helper with a PGlite two-user isolation proof. It selects the target user without `passwordHash`, scopes bot facts through target-owned `bot_instances`, keeps exchange secrets/config history/raw config out of the DTO, and computes access with the entitlement engine instead of raw status checks.
- Fresh e2e coverage was added for Tortila and Legacy settings on desktop/mobile, plus the existing PG9 mobile setup test was updated to current UI.

This phase did not implement live start/stop/apply-config, live exchange key testing, normalized provider-account ownership, or production deployment. Live bots were not touched.

External research inspiration used:
- Freqtrade and FreqUI: https://github.com/freqtrade/freqtrade and https://docs.freqtrade.io/en/stable/freq-ui/
- Hummingbot Dashboard: https://hummingbot.org/dashboard/ and https://hummingbot.org/blog/hummingbot-dashboard-quickstart-guide/
- Bloomberg PORT: https://professional.bloomberg.com/products/bloomberg-terminal/portfolio-analytics/
- BlackRock Aladdin Risk: https://www.blackrock.com/aladdin/products/aladdin-risk

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260603-1522-phase-3-69-legacy-premium-settings.md`
- `docs/handoffs/20260603-legacy-bot-integration-auditor.md`
- `docs/handoffs/20260603-tortila-bot-integration-auditor.md`
- `docs/handoffs/20260603-bot-settings-ux-product.md`
- `docs/handoffs/20260603-bot-settings-platform-db.md`
- `docs/handoffs/20260603-bot-settings-security-access.md`
- `docs/handoffs/20260603-bot-settings-tests-runner.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/bot-settings.spec.ts`

## Files changed
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `docs/handoffs/20260603-legacy-bot-integration-auditor.md`
- `docs/handoffs/20260603-tortila-bot-integration-auditor.md`
- `docs/handoffs/20260603-bot-settings-ux-product.md`
- `docs/handoffs/20260603-bot-settings-platform-db.md`
- `docs/handoffs/20260603-bot-settings-security-access.md`
- `docs/handoffs/20260603-bot-settings-tests-runner.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
- `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`
- `docs/handoffs/20260603-1628-phase-3-70-bot-settings-workbench.md`

Ignored/generated verification artifacts:
- `tests/e2e/screenshots/bot-tortila-settings-desktop.png`
- `tests/e2e/screenshots/bot-tortila-settings-mobile.png`
- `tests/e2e/screenshots/bot-legacy-settings-desktop.png`
- `tests/e2e/screenshots/bot-legacy-settings-mobile.png`
- `test-results/`

## Findings
1. Severity: Critical. Legacy is exchange-active and stores provider-side plaintext exchange credentials, so WTC must keep Legacy pages read-only/reference/export only. Evidence: `docs/handoffs/20260603-legacy-bot-integration-auditor.md`. Recommendation: continue using safe-column DB snapshots only; do not add WTC direct HTTP/control.

2. Severity: High. Tortila production reads are accepted only as read-only journal/worker snapshots. Evidence: `docs/handoffs/20260603-tortila-bot-integration-auditor.md`. Recommendation: keep WTC settings as saved reference/export until provider-side config introspection, auth, and apply contracts exist.

3. Severity: High. User-facing Legacy snapshot reads remain product-scoped, not user/provider-account scoped. Evidence: `docs/handoffs/20260603-bot-settings-security-access.md` and `docs/handoffs/20260603-bot-settings-platform-db.md`. Recommendation: next phase must add normalized provider-account ownership and fail-closed user read/export scoping before production multi-user Legacy visibility.

4. Severity: High. Current target UX should distinguish Tortila as Turtle/trend and Legacy as RSI/CCI averaging. Evidence: `docs/handoffs/20260603-bot-settings-ux-product.md`. Recommendation: keep shared settings primitives but bot-specific vocabulary.

5. Severity: Medium. Legacy delay/delta controls were underrepresented as hidden state; this phase made them visible and added stage-capacity context. Current settings saves now run `botConfigFormIssues` and show an error banner instead of silently returning, but detailed per-field error preservation still needs a dedicated form-state phase. Evidence: integration auditors and current form parsers. Recommendation: add preserved user input plus exact per-row field errors next.

6. Severity: Medium. Legacy export previously spread raw config. This phase changed export to `legacyAllowedExportConfig`, with static regression coverage.

7. Severity: Medium. Admin bot health previously returned raw detail. This phase changed bot health checks and last-error/read-state extraction to use `projectHealthDetail`.

8. Severity: High. Admin user bot drilldown is acceptable only as a masked, read-only DTO view before normalized provider-account ownership exists. Evidence: `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`. Recommendation: keep `/admin/users/[userId]/bots` tied to target-owned WTC rows (`bot_instances.user_id`, entitlements, bot configs, exchange account metadata, bot metric snapshots by instance) and do not reuse product-scoped bot read models for selected-user facts.

9. Severity: High. Legacy provider `pub_id` rows are still fleet/provider-scoped and must not be presented as target-user-owned. Evidence: `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md` and `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`. Recommendation: leave full Legacy pub_id/slot/order inspection on `/admin/bots` as fleet diagnostics, and keep the user drilldown warning visible until `bot_provider_accounts` or equivalent ownership mapping exists.

10. Severity: High. The first admin drilldown implementation needed row-level proof, not only static source inspection. Evidence: `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`, `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`, and `tests/integration/admin-user-bot-detail-loader.test.ts`. Recommendation: keep the extracted `loadAdminUserBotDetailFromDb()` helper and its PGlite two-user fixture as the acceptance gate for future drilldown changes.

11. Severity: Medium. Access labels must remain date-aware and fail closed through `@wtc/entitlements`, because raw `active` rows can be expired by `expiresAt` or `currentPeriodEnd`. Evidence: `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`. Recommendation: keep `explainAccess()` in the loader path and test expired active Legacy rows as denied.

## Decisions
1. Keep live control disabled. No start/stop/apply-config route or button was enabled.
2. Keep Tortila exchange-key testing disabled until an audited read-only exchange ping adapter exists.
3. Keep Legacy exchange-key collection out of WTC; Legacy uses provider `pub_id` snapshots.
4. Treat external product research as UX inspiration only: Hummingbot/Freqtrade inform config/backtest/deploy flow patterns; Bloomberg/Aladdin inform risk/attribution/source-label dashboard language.
5. Do not attempt the DB/provider-account model inside this UI slice. It is the next broad phase.
6. Add the admin user bot drilldown as a read-only route rather than a modal or editable form, so the existing audited lockout action remains isolated and no bot mutation controls are introduced.
7. Show WTC reference config state and target-owned metric snapshots, not raw saved config JSON, config-version payloads, exchange secrets, or product-wide runtime snapshots.
8. Extract `loadAdminUserBotDetailFromDb(db, userId, now)` so PGlite can prove row isolation without mocking `getServerDb()` or Next server-only behavior.
9. Compute admin drilldown access through `explainAccess()` rather than raw entitlement status.

## Risks
1. Full production completion is not achieved: Legacy user/pub_id scoping, provider-account ownership, admin inspect audit, and column-restricted Legacy DB role proof are still open.
2. Full `npm run e2e` was not green in this operator lane because it timed out after 244 seconds. Scoped Playwright gates covering changed bot settings/setup surfaces passed.
3. Browser-plugin screenshot capture timed out, but Browser DOM verification passed and Playwright screenshots were created.
4. The local dev server on port 3411 is mock-only and proves web rendering, not deployed canary safety or live bot service continuity.
5. In-app Browser authenticated-page proof was blocked after the final dev-server restart by Browser runtime input/clipboard limitations and unsupported cookie injection; Playwright route proof passed.
6. `/admin/users/[userId]/bots` now has PGlite two-user row-isolation proof for target-owned entitlements, current configs, config history non-leakage, exchange metadata, sealed exchange-secret non-leakage, and metric snapshots. It still does not implement normalized provider-account ownership for full Legacy pub_id/user attribution.

## Verification/tests
RUN:
1. Required read-only agents dispatched before edits and closed before final report:
   - `docs/handoffs/20260603-legacy-bot-integration-auditor.md`
   - `docs/handoffs/20260603-tortila-bot-integration-auditor.md`
   - `docs/handoffs/20260603-bot-settings-ux-product.md`
   - `docs/handoffs/20260603-bot-settings-platform-db.md`
   - `docs/handoffs/20260603-bot-settings-security-access.md`
   - `docs/handoffs/20260603-bot-settings-tests-runner.md`
2. Additional read-only agents dispatched for the admin user bot drilldown before the admin slice edits and closed before final report:
   - `docs/handoffs/20260603-admin-user-bot-drilldown-ux-auditor.md`
   - `docs/handoffs/20260603-admin-user-bot-drilldown-security-auditor.md`
   - `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
3. Additional read-only agents dispatched for the admin drilldown loader isolation proof and closed before final report:
   - `docs/handoffs/20260603-admin-user-bot-drilldown-loader-platform-auditor.md`
   - `docs/handoffs/20260603-admin-user-bot-drilldown-loader-security-auditor.md`
   - `docs/handoffs/20260603-admin-user-bot-drilldown-loader-tests-auditor.md`
4. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/admin-health-detail.test.ts` - PASS, 23 tests.
5. `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-responsive.test.ts tests/integration/admin-account-unlock-static.test.ts` - PASS, 54 tests.
6. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 5 tests.
7. `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-responsive.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-export-static.test.ts tests/integration/admin-health-detail.test.ts` - PASS, 74 tests.
8. `npm run governance:check` - PASS, 0 errors, 1 known historical warning.
9. `npm run check:core` - PASS.
10. `npm run typecheck` - PASS.
11. `npm run typecheck -w @wtc/web` - PASS.
12. `npm run lint` - PASS.
13. `npm run secret:scan` - PASS.
14. `git diff --check` - PASS.
15. `npm test` - PASS, 109 files, 960 tests passed, 10 skipped. The scanner "failed" lines in stdout are intentional fail-closed fixture assertions; command exit was 0.
16. `npm run build -w @wtc/web` - PASS; route table includes `/admin/users/[userId]/bots`.
17. `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile` - PASS, 2 tests; rerun after adding visible Legacy delay/delta and stage-capacity controls.
18. `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile` - PASS, 2 tests.
19. `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS, 1 test; includes `/admin/users/demo-user/bots` and no 375px horizontal scroll.
20. Local mock-only dev server restarted on `http://localhost:3411` with `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `E2E_AUTH_BYPASS=1`.
21. `Invoke-WebRequest http://localhost:3411/login` after restart - PASS, 200.

NOT RUN / NOT GREEN:
1. Full `npm run e2e` - NOT GREEN; command timed out after 244 seconds without actionable failure output.
2. `node scripts/gates.mjs full` and `node scripts/gates.mjs e2e` - NOT RUN; would write retained gate logs and full e2e already timed out in the operator lane.
3. Managed DB gates, migrations, seeds, `accept:real-pg:managed`, auth/LMS managed e2e - NOT RUN; out of scope and potentially DB-mutating.
4. Worker DB smoke with live `DATABASE_URL` - NOT RUN; no live DB mutation.
5. Column-restricted Legacy DB role proof - NOT RUN; remains required.
6. Live canary deploy/status before-after proof - NOT RUN; no SSH/systemd/nginx/live service probes.
7. Live bot start/stop/restart/apply-config/retest - NOT RUN by policy.
8. Live exchange key ping/test - NOT RUN; UI explicitly marks it pending audit.
9. Provider-side Tortila journal bearer-auth proof - NOT RUN; source audit says it remains open.
10. Normalized Legacy provider-account/user scoping tests - NOT RUN; schema/model not implemented in this slice.
11. In-app Browser authenticated settings/admin proof after final restart - NOT GREEN; the Browser runtime could not reliably submit the login form because of input/clipboard interaction limits, and cookie injection was unsupported. Playwright bot settings/admin mobile route proof passed.

## Next actions
1. Start a new broad DB/security phase for `bot_provider_accounts`, normalized Legacy snapshots, user/pub_id-scoped reads, config drafts, and admin inspect audit.
2. Add preserved user input and exact per-row field errors for Tortila and Legacy settings.
3. Add a provider snapshot vs WTC reference diff tab for Legacy settings.
4. Add audited exchange-key test contract only after security and bot-integration sign-off; keep current button disabled until then.
5. Run full e2e/gate-runner in a dedicated acceptance lane with longer timeout and retained evidence handling.
6. For deploy proof, collect read-only before/after live bot service status and prove WTC web deploy did not stop `turtle-bot.service`, `turtle-journal.service`, Legacy runtime, or related services.
