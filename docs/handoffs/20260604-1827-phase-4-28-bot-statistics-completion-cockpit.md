# phase-4-28-bot-statistics-completion-cockpit handoff
## Scope
Phase 4.28 narrowed the bot statistics surface toward a clearer, evidence-grade command center for Legacy and Tortila:
- user statistics now surfaces aggregate `target='worker'` heartbeat readiness in the statistics command center;
- Legacy statistics now has an operational cockpit for stage utilization, active RSI/CCI triggers, order-symbol coverage, and closed-trade-history status;
- selected-user admin drilldown now mirrors a statistics coverage matrix so admins see scoped evidence versus pending history without edit controls;
- focused static/integration coverage was added for the completion semantics and read-only boundaries.

Read-only agents were launched before implementation and then closed before this report:
- `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md`
- `docs/handoffs/20260604-1818-bot-statistics-ux-product-auditor.md`
- `docs/handoffs/20260604-1821-bot-statistics-tests-visual-auditor.md`

All background agents from this phase were closed/cleaned up.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md`
- `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md`
- `docs/handoffs/20260604-1818-bot-statistics-ux-product-auditor.md`
- `docs/handoffs/20260604-1821-bot-statistics-tests-visual-auditor.md`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`

## Files changed
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/bot-statistics-completion.test.ts`
- `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md`
- `docs/handoffs/20260604-1818-bot-statistics-ux-product-auditor.md`
- `docs/handoffs/20260604-1821-bot-statistics-tests-visual-auditor.md`
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`

## Findings
1. Severity P1 - User statistics command center previously showed product health but not the aggregate worker heartbeat made explicit by Phase 4.27. Evidence: `apps/web/src/features/bots/readiness-loader.ts` already reads latest `integration_health_checks.target='worker'`; `apps/web/src/app/(app)/app/bots/statistics/page.tsx` now calls `loadBotReadinessForUser(user, active.code, 'dashboard', { read: activeRead })` and passes `workerHeartbeatLabel`, `workerHeartbeatTone`, and `workerHeartbeatDetail` into `BotStatisticsCommandCenter`. Recommendation: keep this read-only DTO path and do not run worker ticks during page render. Target part: user statistics command center.
2. Severity P1 - Legacy statistics needed to be operationally rich without fabricating performance history. Evidence: `apps/web/src/features/bots/statistics-panels.tsx` now renders `Legacy statistics cockpit`, `Stage utilization by trigger`, `Order-symbol coverage`, and `Legacy closed-trade history pending`; closed-trade-dependent PF/win rate/realized PnL are shown as pending import until imported trades exist. Recommendation: keep Legacy as operational analytics until immutable closed-trade imports exist. Target part: Legacy statistics panel.
3. Severity P1 - Admin selected-user statistics could look like unsupported Legacy finance values were simply dashes. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx` now uses `legacyPendingMetric()` and `adminStatisticsCoverageRows()` to show `pending import`, provider scope, worker heartbeat, operational coverage, closed-trade history, and analytics status. Recommendation: admin remains diagnostic/read-only; user settings and provider mappings are not editable here. Target part: selected-user admin drilldown.
4. Severity P2 - Data/security auditor identified deeper follow-up risks outside this slice: global admin Legacy fleet currently derives provider rows from one latest raw metric snapshot, Legacy warning attribution is count-scoped rather than provider-identity-scoped, and trade import idempotency is not provider-account-aware. Evidence and recommendations are in `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md`. Recommendation: handle as a separate Phase 4.29 data-scope hardening slice, not inside this UI polish. Target part: admin bot health loader, warning attribution, DB/import tests.

## Decisions
- Kept Phase 4.28 narrow: statistics completion clarity and heartbeat visibility only.
- Used existing persisted DTO/readiness paths; no direct adapter calls, live exchange ping, provider probe, live config apply, start/stop, or worker tick was added.
- Kept Legacy performance-history metrics honest: operational evidence can be complete while closed-trade analytics remain pending.
- Mirrored user/admin semantics enough to reduce product drift without refactoring admin fleet loaders in this phase.
- Added focused static/integration tests instead of Playwright because this patch did not start a browser session or introduce a dedicated `tests/e2e/bot-statistics.spec.ts`.

## Risks
- Full `/goal` is not complete. Legacy/Tortila settings/statistics/readiness have progressed substantially, but deeper data-scope hardening, rendered visual proof, managed worker DB acceptance, and full bot continuity proof still need authorized environments.
- The worktree remains heavily dirty with many pre-existing modified/untracked files from prior WTC phases. This handoff reports the files touched/verified in Phase 4.28 only.
- Playwright rendered layout was not run after this patch, so mobile/desktop visual fit is not formally proven for the new cockpit/matrix.
- Managed worker continuity and admin selected-user DB matrix remain not run because no `WORKER_CONTINUITY_ADMIN_DATABASE_URL` or `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is configured.
- The admin global Legacy fleet multi-provider aggregation risk remains open and should not be called complete.

## Verification/tests
RUN:
- `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-continuity-builder.test.ts` - PASS, 7 files / 66 tests.
- `npm run typecheck -w @wtc/web` - PASS.
- `git diff --check` - PASS.
- `npm run secret:scan` - PASS.

RUN BY READ-ONLY TESTS/VISUAL AUDITOR:
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS as inventory only: 103 images, 0 blocked artifacts. This is not formal visual acceptance.

NOT RUN:
- `npm run typecheck` - not run; scoped web typecheck was run instead.
- `npm run typecheck -w @wtc/worker` - not run; worker code was not changed in this phase.
- `npm run lint` - not run; focused static tests plus typecheck were run.
- `npm run build -w @wtc/web` - not run.
- `npx playwright test ...` - not run; no dedicated bot statistics e2e spec exists yet and this phase did not start a browser.
- `npm run evidence:visual -- --manifest <review>` - not run; no reviewed visual manifest was created.
- `npm run accept:worker:continuity` - not run; requires configured DB/runtime environment.
- `npm run accept:worker:continuity:managed` - not run; requires `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
- Live bot start/stop/apply-config, exchange ping, provider reachability probe, SSH, tmux, systemd, deploy, production monitoring, raw env dump, or raw secret reads - not run and intentionally out of scope.

## Next actions
1. Phase 4.29 should address the data-security auditor's deeper scope findings: multi-provider Legacy fleet aggregation, provider-identity-safe Legacy warning attribution, selected-user readiness wording/gating, and provider-aware trade import idempotency.
2. Add a dedicated `tests/e2e/bot-statistics.spec.ts` for Tortila and Legacy desktop/mobile rendered proof, including no horizontal scroll and no live-control/exchange-ping claims.
3. Run managed worker continuity and admin selected-user DB matrix only after operator-approved throwaway/admin Postgres URLs are provided.
4. Continue treating the full bot completion goal as active/not done until DB-backed continuity, rendered UX, and data-scope hardening are all observed green.
