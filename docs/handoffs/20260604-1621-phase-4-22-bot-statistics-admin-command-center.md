# Phase 4.22 bot statistics/admin command center handoff

## Scope
Bounded implementation slice after Phase 4.21: improve the user bot statistics surface and selected-user admin bot drilldown without live-control actions, and close two security gaps found by read-only agents:

- Add a read-only statistics command center for Tortila and Legacy bot statistics.
- Add a read-only selected-user admin statistics command center.
- Fail closed when non-mock user statistics cannot be read from user-scoped WTC DB snapshots.
- Fail closed when a selected-user Legacy bot has ambiguous active provider mappings instead of selecting the first mapping.

Per-agent handoffs linked by this aggregate:

- `docs/handoffs/20260604-1555-bot-stats-admin-ux-auditor.md`
- `docs/handoffs/20260604-1555-bot-stats-admin-security-auditor.md`
- `docs/handoffs/20260604-1555-bot-stats-admin-gates-auditor.md`

## Files inspected
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `scripts/check-retained-visual-artifacts.mjs`

## Files changed
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx` - added a read-only statistics command center component.
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx` - mounted the command center and wired runtime, stats, risk, and settings summaries.
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx` - added selected-user statistics command center rows and metrics.
- `apps/web/src/features/bots/data.tsx` - made non-mock Tortila/Legacy user statistics require user-scoped DB snapshots instead of falling back to global adapter reads.
- `apps/web/src/features/admin/user-bot-detail-loader.ts` - changed Legacy selected-user provider account resolution to exact-one active provider mapping.
- `tests/integration/bot-statistics-static.test.ts` - covered the new statistics command center.
- `tests/integration/admin-user-bot-detail-static.test.ts` - covered selected-user command center and exact-one provider mapping guard.
- `tests/integration/bot-read-safety-static.test.ts` - covered user-scoped snapshot fail-closed copy.
- `tests/integration/admin-user-bot-detail-loader.test.ts` - added ambiguous Legacy provider mapping regression.
- `tests/e2e/smoke.spec.ts` - extended rendered statistics smoke for the command center.

## Findings
1. Severity P1 - User statistics could fall back to a non-user-scoped adapter read in non-mock mode if DB snapshots were unavailable. Evidence: security auditor handoff `docs/handoffs/20260604-1555-bot-stats-admin-security-auditor.md`. Resolution: `loadBotReadModelForUser` now returns a scoped snapshot issue and empty DB read model for Tortila/Legacy non-mock mode instead of calling the adapter fallback.
2. Severity P1 - Selected-user admin Legacy drilldown could select a provider mapping when more than one active mapping existed for the bot instance. Evidence: security auditor handoff `docs/handoffs/20260604-1555-bot-stats-admin-security-auditor.md`. Resolution: loader now groups active mappings by instance and only scopes Legacy stats when exactly one active mapping exists.
3. Severity P2 - Statistics UI had source/evidence panels, but no single operator-friendly command center tying performance, settings, admin mirror, and live-control boundary together. Evidence: UX and gates auditor handoffs. Resolution: added `BotStatisticsCommandCenter` and smoke/static coverage.
4. Severity P2 - Admin selected-user drilldown was safe but dense. Resolution: added a compact selected-user command center that summarizes access, scoped statistics, runtime attention, settings mirror, Legacy mapping, and admin read-only boundary.

## Decisions
- Kept the slice read-only: no live bot start/stop/apply-config, no exchange probe, no provider probe, no settings mutation, no provider mapping mutation.
- Used the existing `Card`, `MetricCard`, `StatusPill`, table, and button classes rather than adding a new UI system.
- Treated mock adapter mode as demo preview only; non-mock Tortila/Legacy user statistics must be DB-scoped or fail closed.
- Preserved admin global defaults as separate from user-owned settings; admin selected-user view is inspection only.

## Risks
- Full formal visual evidence gate remains fail-closed without a review manifest. Screenshots were generated and manually spot-checked, but no manifest-backed visual acceptance was created.
- Admin DB-backed selected-user Playwright matrix was not run because it requires the explicit disposable Postgres managed harness path.
- Legacy statistics still depends on worker/provider pub_id snapshots; this phase prevents unsafe fallback but does not add live provider ingestion.

## Verification/tests
RUN:
- `npx vitest run tests/integration/bot-statistics-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts` - PASS, 48 tests.
- `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts -t "does not pick the first active Legacy provider mapping"` - PASS, 1 focused regression.
- `npm run typecheck -w @wtc/web` - PASS.
- `npx playwright test tests/e2e/smoke.spec.ts -g "bot dashboard sub-tabs render with unified analytics"` with `E2E_PORT=3450` - PASS, desktop and mobile.
- `npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` with `E2E_PORT=3450` - PASS.
- `node scripts/gates.mjs quick` - PASS: lint, root typecheck, web typecheck, full Vitest.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS with one known historical warning.
- `git diff --check` - PASS.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory only: 103 image files, 0 blocked binary/container artifacts.
- Manual screenshot spot-check: `tests/e2e/screenshots/bot-statistics-journal-desktop.png`, `tests/e2e/screenshots/bot-statistics-journal-mobile.png`, `tests/e2e/screenshots/admin-user-bots-mobile375.png`.

NOT RUN / NOT GREEN:
- `npm run evidence:visual` formal acceptance - NOT GREEN. It failed as designed because no visual review manifest exists for the retained screenshot root.
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires explicit disposable admin Postgres URL/harness authorization.
- Worker live continuity with real Tortila journal or Legacy DB - NOT RUN; this phase was UI/read-model safety and did not authorize live provider reads.
- Live bot start/stop/apply-config, exchange key probe, provider probe - NOT RUN by design and remains disabled.
- Production deploy - NOT RUN.

## Next actions
1. Add a dedicated `tests/e2e/bot-statistics.spec.ts` if future statistics work outgrows the current smoke coverage.
2. When a disposable DB is explicitly available, run the admin selected-user DB matrix and review/manifest any retained screenshots.
3. Continue the next phase on Legacy/Tortila completeness through worker snapshot reliability and user-facing analytics depth, keeping live-control blocked until security and bot-integration audits authorize it.
