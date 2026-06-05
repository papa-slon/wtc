# bot-statistics-tests-visual-auditor handoff
## Scope
Phase 4.28 read-only tests/visual audit for bot statistics and heartbeat polish in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope inspected: e2e/integration tests covering bot statistics, readiness map, bot settings, admin selected-user DB matrix, retained Playwright screenshots, and component/static tests. Goal was to determine the smallest proof set for a statistics/heartbeat polish patch, including fragile assertions, screenshot risks, and gates to run/not run.

No code, test, DB schema, runtime, worker, live bot control, exchange/provider probe, SSH, deploy, or production state was changed. The worktree was already heavily dirty before this audit.

## Files inspected
- `package.json`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `vitest.config.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-continuity-builder.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`
- `scripts/check-retained-visual-artifacts.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-worker-continuity-managed.mjs`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`

## Files changed
None — read-only audit.

## Findings
1. Severity P1 - Existing bot-statistics browser proof is split across broad smoke and warning-summary visual specs, and there is no dedicated `tests/e2e/bot-statistics.spec.ts` in this checkout. Evidence: `tests/e2e/smoke.spec.ts:116`-`131` checks Tortila statistics headings and takes only `bot-statistics-journal` screenshots, while `tests/e2e/smoke.spec.ts:133`-`140` checks Legacy statistics without a Legacy statistics screenshot; `tests/e2e/warning-summary-visual.spec.ts:82`-`86` checks both statistics pages only for warning-surface containment and screenshots. Recommendation: for Phase 4.28, add a focused `tests/e2e/bot-statistics.spec.ts` if the patch changes statistics UI materially; otherwise run `smoke.spec.ts` plus `warning-summary-visual.spec.ts` as the smallest existing rendered statistics proof. Target part: rendered bot statistics proof.

2. Severity P1 - The smallest static/pure proof set already exists, but it is source-string heavy and must be updated intentionally when copy or component names change. Evidence: `tests/integration/bot-statistics-static.test.ts:18`-`32` asserts the statistics route, operation map, evidence ladder, and command center by source text; `tests/integration/bot-statistics-static.test.ts:84`-`94` locks Legacy snapshot copy and rejects old DB live-read wording; `tests/integration/bot-statistics-static.test.ts:108`-`121` locks command-center copy plus absence of live-control/secret wiring. Recommendation: run focused Vitest for statistics/readiness/continuity/admin static coverage after the patch, but expect source assertion updates when product copy is intentionally polished. Target part: static/component guardrails.

3. Severity P1 - Worker heartbeat readiness is covered by pure builder and server DTO tests, so a polish patch can prove UI semantics without running the worker. Evidence: `tests/integration/bot-readiness-builder.test.ts:152`-`180` asserts fresh, missing, and blocked worker-heartbeat states; `tests/integration/bot-readiness-builder.test.ts:182`-`214` locks which surfaces include `Worker heartbeat`, `Runtime snapshot`, and `Statistics`; `tests/integration/bot-readiness-server-dto-static.test.ts:24`-`41` asserts the server DTO reads latest `integrationHealthChecks.target='worker'` and avoids live-control/secret paths. Recommendation: keep Phase 4.28 local proof to DTO/builder/static tests unless the implementation changes the worker runner or DB fixture semantics. Target part: heartbeat readiness UI.

4. Severity P1 - Admin selected-user DB matrix coverage is useful but opt-in; it is not part of default Playwright and requires an operator-approved throwaway Postgres admin URL. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:5` skips unless `ADMIN_USER_BOTS_E2E=1`; `playwright.admin-user-bots-db.config.ts:13`-`32` refuses unprepared/non-throwaway DB state; `package.json:35`-`37` exposes single and managed matrix scripts; `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:84`-`87` marks worker/admin DB browser gates not run without approved URLs. Recommendation: do not require the DB matrix for a local stats-copy/layout-only patch; require `npm run e2e:admin-user-bots:db:managed:matrix` only when admin selected-user facts, loader scope, scenario rows, or heartbeat states change. Target part: admin selected-user DB proof.

5. Severity P2 - The admin selected-user browser spec has strong scenario assertions but brittle exact counts and copy labels. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:22`-`104` defines four scenario expectation blocks with exact worker/statistics labels; `tests/e2e/admin-user-bot-detail-db.spec.ts:227`-`245` asserts counts such as two `Runtime health`, two statistics labels, two launch mirrors, and three `Worker heartbeat`; `tests/e2e/admin-user-bot-detail-db.spec.ts:255`-`271` requires all visible markers and rejects hidden leak markers. Recommendation: if Phase 4.28 renames heartbeat/statistics/admin labels, update this spec deliberately and keep the no-form/no-secret/no-live-control assertions intact. Target part: admin selected-user rendered assertions.

6. Severity P2 - Settings/readiness Playwright proof is valuable for navigation and launch-boundary polish, but it is also copy-sensitive. Evidence: `tests/e2e/bot-readiness-map.spec.ts:24`-`41` and `tests/e2e/bot-readiness-map.spec.ts:43`-`60` assert dashboard readiness labels, disabled start button, no `Connection verified`, no horizontal scroll, and screenshots for both bots; `tests/e2e/bot-settings.spec.ts:90`-`102` locks quick-path wording for statistics/admin/readiness/live-exchange copy; `tests/e2e/bot-settings.spec.ts:168`-`235` locks Legacy settings continuity, provider pub_id, trigger/stage, export-blocked, and screenshot behavior. Recommendation: include these specs when Phase 4.28 touches settings/setup/readiness CTAs or heartbeat placement, and keep wording changes synchronized with test expectations. Target part: bot settings/readiness browser proof.

7. Severity P2 - Current visual evidence is screenshot capture plus manual/inventory discipline, not pixel baseline assertion. Evidence: `playwright.config.ts:17`-`22` configures failure screenshots/traces while specs call `page.screenshot` directly; statistics/readiness/settings/admin screenshots are written by `tests/e2e/warning-summary-visual.spec.ts:66`-`99`, `tests/e2e/bot-readiness-map.spec.ts:41` and `tests/e2e/bot-readiness-map.spec.ts:60`, `tests/e2e/bot-settings.spec.ts:162` and `tests/e2e/bot-settings.spec.ts:235`, and `tests/e2e/admin-user-bot-detail-db.spec.ts:277`; `docs/ACCEPTANCE_MATRIX_MASTER.md:37`-`40` states e2e screenshots alone do not prove screenshot safety and retained visual artifacts need a manifest. Recommendation: after a patch, run visual inventory and manually review changed screenshots; do not claim formal visual acceptance unless a manifest-backed `npm run evidence:visual -- --manifest ...` passes for the retained images. Target part: Playwright screenshots and visual gate.

8. Severity P2 - Static/component tests are not true React render tests for `apps/web`; rendered layout proof must come from Playwright. Evidence: `vitest.config.ts:8`-`10` includes packages and integration tests but excludes `apps/web/**`; `tests/integration/admin-responsive.test.ts:4`-`9` documents that web JSX/server components are covered by e2e while fast guards are source assertions; `tests/integration/admin-user-bot-detail-static.test.ts:70`-`154` reads the admin selected-user page source and asserts strings/absence patterns. Recommendation: put new pure calculations into testable functions/builders, protect wiring with static tests, and rely on Playwright for mobile/desktop layout and screenshot proof. Target part: component/static test boundary.

## Decisions
- Smallest local proof set for a Phase 4.28 statistics/heartbeat polish patch:
  - `npx vitest run tests/integration/bot-statistics-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-continuity-builder.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/worker-continuity-acceptance-runner.test.ts`
  - If the admin selected-user loader/query shape changes, add `tests/integration/admin-user-bot-detail-loader.test.ts`.
  - If statistics UI changes materially, add or run a focused `tests/e2e/bot-statistics.spec.ts` for Tortila and Legacy on desktop/mobile. Since that file is absent now, the smallest existing substitute is `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/warning-summary-visual.spec.ts --project=desktop --project=mobile`.
  - If readiness/settings CTA placement changes, add `npx playwright test tests/e2e/bot-readiness-map.spec.ts tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile`.
  - Always follow screenshot-producing Playwright with `npm run evidence:visual -- --inventory tests/e2e/screenshots`; promote screenshots to formal visual acceptance only with a reviewed manifest.
- Keep `npm run accept:worker:continuity:managed` and `npm run e2e:admin-user-bots:db:managed:matrix` as opt-in hard gates that require approved Postgres URLs. They are not required for copy/layout-only stats polish.
- Do not run or add live bot start/stop/apply-config, live exchange ping, provider reachability probe, raw env dump, SSH, tmux, systemd, deploy, or production monitoring for this patch class.
- Preserve product truth: Legacy may show wallet, provider scope, stage capacity, active slots/orders, warning/heartbeat states, and missing closed-trade-history; do not fabricate Legacy win rate, PF, drawdown, or PnL from absent closed trades.

## Risks
- The worktree was already heavily dirty before this audit; findings describe current inspected files, not a clean branch baseline.
- `tests/e2e/bot-statistics.spec.ts` is absent, so rendered statistics proof currently depends on broad smoke plus warning-summary visual coverage unless the next patch adds a dedicated spec.
- Playwright screenshot calls overwrite stable filenames for normal bot readiness/settings/warning surfaces; admin selected-user screenshots now include runtime scenario, but any new worker-scenario dimension must also be included in filenames.
- `npm run evidence:visual -- --inventory` is not acceptance; it only counted retained images. Formal visual acceptance remains not green without a review manifest.
- `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and `WORKER_CONTINUITY_ADMIN_DATABASE_URL` were not used here. DB matrix and worker continuity gates remain authorization-dependent.
- Source-string tests are fragile by design. Polishing copy such as `Statistics command center`, `Worker heartbeat`, `live start disabled`, or `Connection verified` requires synchronized test updates.

## Verification/tests
RUN:
- `git status --short --branch` - inspected branch/dirty state; branch is `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified/untracked files.
- `Test-Path -LiteralPath 'tests/e2e/bot-statistics.spec.ts'` - returned `False`.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory only: 103 image file(s), 0 blocked binary/container artifact(s), 0 missing root(s), 104 total artifact file(s), 0 dynamic marker(s).
- Static/read-only file inspection with `rg`, `Get-Content`, and PowerShell line reads over the files listed above.

NOT RUN / NOT GREEN:
- `npx vitest run ...` focused stats/readiness/admin/worker tests - not run by this read-only auditor.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run secret:scan`, `node scripts/gates.mjs quick/full/e2e`, and `git diff --check` - not run.
- `npx playwright test ...` browser specs - not run; they would start the dev server and write/overwrite screenshots.
- `npm run e2e`, `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, and `npm run e2e:admin-user-bots:db:managed:matrix` - not run; DB matrix requires approved Postgres.
- `npm run accept:worker:continuity` and `npm run accept:worker:continuity:managed` - not run; worker continuity hard proof requires approved throwaway/full DB scope.
- `npm run evidence:visual -- --manifest <visual-review.json> ...` - not run/not green; no visual review manifest was created or validated.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probe, raw env dump, raw secret read, SSH, tmux, systemd, deploy, production monitoring, Stripe/Axioma/LMS live gates - not run.

## Next actions
1. Implement Phase 4.28 as a narrow statistics/heartbeat polish patch in stats/admin/readiness UI plus focused tests only.
2. Add a dedicated `tests/e2e/bot-statistics.spec.ts` if rendered stats content changes; cover Tortila and Legacy desktop/mobile, no horizontal scroll, no live-control/exchange-ping claims, Legacy closed-trade metrics pending, and screenshots.
3. Run the smallest local proof set from `## Decisions`, then run visual inventory and manually review only changed screenshots.
4. If admin selected-user DB facts or heartbeat scenario semantics change, run `npm run e2e:admin-user-bots:db:managed:matrix` only after `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is explicitly approved.
5. If worker continuity semantics change, run `npm run accept:worker:continuity:managed` only after `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is explicitly approved.
