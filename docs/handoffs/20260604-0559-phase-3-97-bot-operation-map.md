# Phase 3.97 bot-operation-map handoff
## Scope
Implement one focused bot-completion slice: a reusable, read-only operation map that explains how Legacy and Tortila bot settings flow from WTC source selection into per-coin strategy, stages/slots/risk, runtime evidence, statistics, and admin visibility.

This phase did not try to finish the entire bot product. It specifically closed the "make it clear how this bot works" layer on the user dashboard, settings, setup, statistics, and selected-user admin detail surfaces.

Background agents launched before edits:
1. `docs/handoffs/20260604-0531-bot-operation-map-ux-auditor.md`
2. `docs/handoffs/20260604-0531-bot-operation-map-security-auditor.md`
3. `docs/handoffs/20260604-0531-bot-operation-map-tests-auditor.md`

All three background agents were closed before this aggregate handoff.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`
8. `docs/handoffs/20260604-0531-bot-operation-map-ux-auditor.md`
9. `docs/handoffs/20260604-0531-bot-operation-map-security-auditor.md`
10. `docs/handoffs/20260604-0531-bot-operation-map-tests-auditor.md`
11. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
14. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/features/bots/BotReadinessMap.tsx`
17. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
18. `apps/web/src/features/bots/config-review.ts`
19. `apps/web/src/features/bots/readiness.ts`
20. `apps/web/src/features/bots/readiness-loader.ts`
21. `apps/web/src/features/bots/statistics-panels.tsx`
22. `apps/web/src/features/admin/types.ts`
23. `apps/web/src/features/admin/user-bot-detail-loader.ts`
24. `tests/integration/bot-config-review-static.test.ts`
25. `tests/integration/bot-statistics-static.test.ts`
26. `tests/integration/bot-read-safety-static.test.ts`
27. `tests/integration/admin-user-bot-detail-static.test.ts`
28. `tests/e2e/bot-settings.spec.ts`
29. `tests/e2e/smoke.spec.ts`
30. External sanity-check references: Hummingbot Dashboard docs, Freqtrade configuration docs, and 3Commas DCA condition docs.

## Files changed
1. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
2. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
3. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
4. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
5. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
6. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
7. `tests/integration/bot-config-review-static.test.ts`
8. `tests/integration/bot-statistics-static.test.ts`
9. `tests/integration/bot-read-safety-static.test.ts`
10. `tests/integration/admin-user-bot-detail-static.test.ts`
11. `tests/e2e/bot-settings.spec.ts`
12. `tests/e2e/smoke.spec.ts`
13. `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`

## Findings
1. Severity: High. Users had the right facts spread across readiness, config review, runtime warnings, and statistics, but not one clear "how the bot operates" chain. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`, and `apps/web/src/app/(app)/app/bots/statistics/page.tsx` already loaded safe resolved config and read-model facts. Recommendation: add one reusable map over those existing facts. Target part: user bot comprehension.
2. Severity: High. Admin selected-user bot detail already had safe DTOs for config source, scoped stats, provider scope, warnings, and key metadata. Evidence: `apps/web/src/features/admin/types.ts` exposes `AdminUserBotConfigSummary` and `AdminUserBotSummary` without secret/raw payload fields. Recommendation: render the same operation map in unframed read-only mode inside each admin bot card. Target part: admin read-only visibility.
3. Severity: High. The operation map had to stay presentation-only and avoid raw provider/runtime or live-control sources. Evidence: security auditor finding 1 and 6; existing static tests already forbid adapter/fetch/vault/live-control paths in readiness surfaces. Recommendation: implement `BotOperationMapPanel` as a pure component accepting safe summaries and add static guards. Target part: safety boundary.
4. Severity: Medium. Rendered tests became stricter after adding repeated operation-map language. Evidence: first Playwright bot-settings run failed on unscoped `Runtime evidence` and `Settings source`; first statistics smoke attempts found repeated `Equity curve`/`Provider pub_id` and stale Legacy assertions. Recommendation: scope Playwright checks to table cells/headings and align Legacy smoke with the current Legacy operations section. Target part: rendered test stability.

## Decisions
1. Added `BotOperationMapPanel` as a shared presentation component with six layers: Settings source, Coin trigger/strategy map, Stages/slots/risk, Runtime evidence, Statistics, and Admin visibility.
2. Wired the map into the user bot dashboard, settings, setup wizard, selected-bot statistics, and admin selected-user bot detail.
3. For Legacy, the map emphasizes RSI/CCI trigger buckets, stage capacity, averaging/TP context, provider pub_id mapping count/scope, and read-only worker snapshots.
4. For Tortila, the map emphasizes Turtle system/timeframe/risk rows, portfolio caps, encrypted key metadata/journal snapshots, and separate statistics.
5. Admin rendering is `framed={false}` to avoid nesting cards and uses only selected-user summary fields; it adds no edit, submit, map, disable, apply, test, start, or stop controls.
6. External bot dashboard docs were used only as UX sanity-checks: Hummingbot separates configure/backtest/deploy/monitor; Freqtrade documents pairlist/config as the bot's tradable universe; 3Commas separates DCA trade start/indicator conditions. The implemented data boundary stayed repo-native and DTO-first.

## Risks
1. The full user goal remains open. This phase improves clarity and structure but does not finish every Legacy/Tortila runtime, adapter, live control, admin workflow, or complete bot product.
2. The worktree was already heavily dirty before this phase. This phase preserved unrelated existing edits and did not revert pre-existing changes.
3. Populated DB-backed admin rendered proof is still blocked without an intentional `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
4. The in-app Browser MCP tool was not exposed by tool discovery in this session; rendered proof was collected through Playwright desktop/mobile gates.

## Verification/tests
RUN:
1. Protocol/status/seed/Phase 3.96 docs read before edits.
2. Three Phase 3.97 read-only agents launched before edits and each wrote a canonical handoff.
3. `npx vitest run tests/integration/bot-config-review-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 4 files / 40 tests.
4. `npm run typecheck` - PASS.
5. `npm run typecheck -w @wtc/web` - PASS.
6. `npm run lint` - PASS.
7. Safe cleanup of `apps/web/.next-e2e` before rendered reruns - PASS, resolved path verified under `apps/web`.
8. `E2E_PORT=3427 npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line` - first run failed on strict locators, fixed; final PASS, 10 tests.
9. `E2E_PORT=3428 npx playwright test tests/e2e/smoke.spec.ts --grep "bot dashboard sub-tabs render with unified analytics" --project=desktop --project=mobile --reporter=line` - first runs exposed repeated/stale locators, fixed; final PASS, 2 tests.
10. `npx vitest run tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - PASS, 5 files / 34 tests.
11. Final `npm run typecheck` - PASS.
12. Final `npm run typecheck -w @wtc/web` - PASS.
13. Final `npm run lint` - PASS.
14. `git diff --check` before and after aggregate write - PASS.
15. `npm run secret:scan` before and after aggregate write - PASS.
16. `npm run governance:check` after aggregate write - PASS, current phase `20260604-0559`, 0 errors / 1 known historical warning.

NOT RUN:
1. Full `npm test` - skipped for focused phase scope and large pre-existing dirty tree.
2. Full `npm run build` or full `npm run e2e` - skipped for focused phase scope.
3. DB-backed populated admin rendered gate `npm run e2e:admin-user-bots:db:managed` - not run because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied.
4. Live bot services, provider DB mutation, exchange calls/pings, env/vault/secret inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest - not run by safety policy and scope.

## Next actions
1. Continue with the next phase as a new session per protocol.
2. Next high-value bot-completion slice: add an admin/user "statistics drilldown map" that lets admin select a user/pub_id and compare settings, scoped runtime stats, and warnings without edit rights.
3. Defer any live key ping, apply config, start/stop, or provider mutation until separate security and bot-integration audits approve the adapter path.
