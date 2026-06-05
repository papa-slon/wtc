# phase-4-35-bot-statistics-rendered-proof handoff
## Scope
Phase 4.35 added dedicated rendered Playwright proof for bot statistics after Phase 4.32's broader smoke coverage. Scope covered Tortila statistics, Legacy operational statistics, Legacy closed-trade pending truth, desktop/mobile responsiveness, and no-live-control/no-exchange-ping claims.

Read-only participant handoffs launched before test implementation:
- [bot-statistics-rendered-ux-auditor](20260604-2010-bot-statistics-rendered-ux-auditor.md)
- [bot-statistics-rendered-gates-auditor](20260604-2010-bot-statistics-rendered-gates-auditor.md)

All background lanes for this phase were closed after their results were collected.

## Files inspected
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/meta.ts`
- `docs/handoffs/20260604-2010-bot-statistics-rendered-ux-auditor.md`
- `docs/handoffs/20260604-2010-bot-statistics-rendered-gates-auditor.md`

## Files changed
- `tests/e2e/bot-statistics.spec.ts`
- `docs/handoffs/20260604-2010-bot-statistics-rendered-ux-auditor.md`
- `docs/handoffs/20260604-2010-bot-statistics-rendered-gates-auditor.md`
- `docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md`

## Findings
1. Severity P1 - Statistics now have a dedicated desktop/mobile rendered proof instead of relying only on broad smoke coverage. Evidence: `tests/e2e/bot-statistics.spec.ts` visits Tortila and Legacy statistics pages, asserts command-center/readiness/evidence markers, no horizontal scroll, screenshots, and no live-control claims. Recommendation: include this spec in future focused bot rendered gates. Target part: statistics browser acceptance.
2. Severity P1 - Tortila statistics render full read-only performance evidence. Evidence: the spec asserts `Net PnL after fees`, exact `Win rate`, exact `Profit factor`, `Equity curve`, `Performance diagnostics`, `Monthly returns`, `Symbol contribution`, and `Open risk exposure`, while rejecting Legacy pending labels. Recommendation: keep Tortila performance analytics in the complete/read-only bucket. Target part: Tortila statistics.
3. Severity P1 - Legacy statistics render operational evidence without fabricating closed-trade performance. Evidence: the spec asserts `Legacy operations`, `Legacy statistics cockpit`, provider pub_id coverage, `closed trade imports pending`, `pending import`, `closed trades pending`, `PF, win rate, realized PnL pending`, `Legacy closed-trade history pending`, and no Tortila-only `Net PnL after fees`/`Equity curve`. Recommendation: keep Legacy performance history blocked until source proof exists. Target part: Legacy statistics.
4. Severity P2 - Early spec failures were assertion-shape issues, not product failures. Evidence: failed runs on ports `3456`, `3457`, `3458`, and `3459` were caused by strict locator ambiguity or outdated expected names; final run on `3460` passed. Recommendation: prefer heading-scoped and exact-label assertions for repeated product names/stat labels. Target part: e2e reliability.
5. Severity P1 - The expanded no-live-DB rendered pack is green with the new statistics spec included. Evidence: `E2E_PORT=3461 npx playwright test tests/e2e/smoke.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-statistics.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts` passed with 65 passed and 1 skipped. Recommendation: use this six-file pack as the current local rendered bot/admin proof. Target part: broader rendered acceptance.
6. Severity P2 - Screenshot inventory is clean, but formal visual manifest acceptance is still not run. Evidence: `npm run evidence:visual -- --inventory tests/e2e/screenshots` reported 107 image files, 0 blocked binary/container artifacts, 0 missing roots, and 0 dynamic markers; no reviewed manifest was created. Recommendation: keep inventory green separate from formal visual acceptance. Target part: visual evidence.

## Decisions
- Added `tests/e2e/bot-statistics.spec.ts` as a dedicated two-test spec that runs under desktop and mobile Playwright projects.
- Kept live-control/exchange/provider checks negative only; no live ping, provider probe, or start/stop/apply action was added.
- Kept screenshots under existing `tests/e2e/screenshots` naming: `bot-statistics-tortila-dedicated-*` and `bot-statistics-legacy-dedicated-*`.
- All Phase 4.35 background lanes were closed before this aggregate handoff.

## Risks
- This proof is mock/no-live-DB browser acceptance, not populated Postgres admin-user acceptance or live worker continuity.
- Screenshot capture is not formal visual manifest acceptance.
- Legacy source proof remains absent; the test protects pending copy but cannot unblock closed-trade import.

## Verification/tests
RUN:
- `E2E_PORT=3456 npx playwright test tests/e2e/bot-statistics.spec.ts` - FAIL, strict locator on duplicate `live control disabled`.
- `E2E_PORT=3457 npx playwright test tests/e2e/bot-statistics.spec.ts` - FAIL, outdated product names.
- `E2E_PORT=3458 npx playwright test tests/e2e/bot-statistics.spec.ts` - FAIL, duplicate product-name text.
- `E2E_PORT=3459 npx playwright test tests/e2e/bot-statistics.spec.ts` - FAIL, duplicate `Win rate` text; Legacy branch passed.
- `E2E_PORT=3460 npx playwright test tests/e2e/bot-statistics.spec.ts` - PASS, 4 passed.
- `E2E_PORT=3461 npx playwright test tests/e2e/smoke.spec.ts tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-statistics.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts` - PASS, 65 passed, 1 skipped.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory-only, 107 images, 0 blocked artifacts.

NOT RUN:
- Full `npm run e2e` - not run; the six-file focused no-live rendered pack was run instead.
- Admin-user DB Playwright matrix - not run; missing disposable admin Postgres env.
- Managed worker continuity - not run; missing worker continuity admin DB env.
- Formal visual manifest - not run; only inventory was run and no reviewed manifest was created.
- Live DB/provider/exchange probes, live bot control, deploy, SSH/tmux/systemd, and production monitoring - not run by safety scope.

## Next actions
1. Run focused static/integration checks plus `git diff --check` and `npm run governance:check`.
2. Optionally fold `tests/e2e/bot-statistics.spec.ts` into the next broad no-live-DB rendered pack.
3. Continue remaining hard gates only when disposable DB env values are available.
