# Phase 3.98 bot-admin-drilldown-tests-auditor handoff
## Scope
Read-only tests/rendered audit for the next admin bot explorer and selected-user drilldown improvement after Phase 3.97.

The audit inspected current Vitest static/loader coverage, the guarded admin-user bot DB e2e harness, PG8 admin mobile coverage, bot settings/statistics Playwright specs, and generated `.next-e2e*` cleanup guidance. It recommends exact focused gates and locator-risk controls only.

No product code, tests, package files, scripts, live bot services, provider DB, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest path, or rendered gate was run or changed in this audit.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`
8. `docs/handoffs/20260604-0531-bot-operation-map-tests-auditor.md`
9. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`
10. `docs/handoffs/20260604-0424-admin-user-bot-drilldown-rendered-auditor.md`
11. `docs/handoffs/20260604-0424-bot-rendered-gates-auditor.md`
12. `docs/handoffs/20260603-admin-user-bot-drilldown-tests-auditor.md`
13. `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`
14. `docs/handoffs/20260603-2000-phase-3-75-admin-bot-stats-drilldown.md`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/features/admin/user-bot-detail-loader.ts`
17. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
18. `tests/integration/admin-user-bot-detail-static.test.ts`
19. `tests/integration/admin-user-bot-detail-loader.test.ts`
20. `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
21. `tests/integration/admin-responsive.test.ts`
22. `tests/integration/bot-statistics-static.test.ts`
23. `tests/integration/bot-read-safety-static.test.ts`
24. `tests/integration/bot-config-review-static.test.ts`
25. `tests/integration/bot-readiness-builder.test.ts`
26. `tests/integration/bot-readiness-server-dto-static.test.ts`
27. `tests/integration/bot-config-action-handler.test.ts`
28. `tests/e2e/admin-user-bot-detail-db.spec.ts`
29. `tests/e2e/admin-mobile-pg8.spec.ts`
30. `tests/e2e/bot-settings.spec.ts`
31. `tests/e2e/smoke.spec.ts`
32. `playwright.config.ts`
33. `playwright.admin-user-bots-db.config.ts`
34. `scripts/run-admin-user-bot-detail-e2e.mjs`
35. `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
36. `scripts/prepare-admin-user-bot-detail-e2e.ts`
37. `.gitignore`
38. `eslint.config.js`
39. `package.json`

## Files changed
1. `docs/handoffs/20260604-0603-bot-admin-drilldown-tests-auditor.md`

## Findings
1. Severity: High. The selected-user admin detail already has the correct data boundary for a drilldown, but tests must preserve that boundary if the explorer adds filters, drill-in panels, or comparison UI. Evidence: the page requires `requireUser()` and `assertAdmin()` before loading detail at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:73` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:74`; it renders read-only storage/live-control pills at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:89` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:95`; static coverage requires no `CsrfField`, no submit controls, and no start/stop/apply/test strings at `tests/integration/admin-user-bot-detail-static.test.ts:100` through `tests/integration/admin-user-bot-detail-static.test.ts:112`. Recommendation: extend the existing static lane for any explorer/drilldown UI so it fails on new forms, hidden CSRF fields, live-control copy, raw provider IDs, or direct adapter imports. Target part: admin selected-user UI safety.
2. Severity: High. The loader lane is the strongest current proof for selected-user isolation and should be the first acceptance gate for any richer drilldown. Evidence: the loader test creates two users, Tortila and Legacy bot instances, provider accounts, metrics, positions, trades, equity, and warning markers at `tests/integration/admin-user-bot-detail-loader.test.ts:87` through `tests/integration/admin-user-bot-detail-loader.test.ts:422`; it asserts row counts do not change across load at `tests/integration/admin-user-bot-detail-loader.test.ts:430` through `tests/integration/admin-user-bot-detail-loader.test.ts:433`; it excludes user B, raw config, sealed secrets, raw trade JSON, password hashes, API keys, and tokens at `tests/integration/admin-user-bot-detail-loader.test.ts:570` through `tests/integration/admin-user-bot-detail-loader.test.ts:623`. Recommendation: add drilldown-specific assertions here before Playwright, especially for selected metric rows, active provider mapping, comparison panels, and any new "explorer" query state. Target part: DB-backed loader isolation.
3. Severity: High. Legacy selected-user stats are provider-scoped, not product-global, so a bot explorer must not treat fleet rows as selected-user rows. Evidence: the loader masks provider IDs at `apps/web/src/features/admin/user-bot-detail-loader.ts:215` and `apps/web/src/features/admin/user-bot-detail-loader.ts:649`; it scopes metric/position/trade rows through `scopedRows` at `apps/web/src/features/admin/user-bot-detail-loader.ts:715` through `apps/web/src/features/admin/user-bot-detail-loader.ts:722`; it marks Legacy stats as `providerScoped` only when an active provider account exists at `apps/web/src/features/admin/user-bot-detail-loader.ts:761` through `apps/web/src/features/admin/user-bot-detail-loader.ts:765`. Recommendation: loader tests for the explorer should include at least one unscoped Legacy fleet row and one wrong-provider row, then assert neither renders for the selected user. Target part: Legacy attribution.
4. Severity: High. Populated rendered acceptance exists, but it is correctly opt-in and must not be claimed green without a deliberate throwaway admin Postgres URL. Evidence: default Playwright ignores `admin-user-bot-detail-db.spec.ts` at `playwright.config.ts:9`; the admin DB config requires `ADMIN_USER_BOTS_E2E === '1'`, a throwaway DB name, and a prepared marker/HMAC at `playwright.admin-user-bots-db.config.ts:14` through `playwright.admin-user-bots-db.config.ts:30`; Phase 3.95 recorded the gate as blocked without `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` at `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md:75`. Recommendation: keep populated admin rendered proof behind `npm run e2e:admin-user-bots:db:managed`; report it as NOT RUN unless the runner creates/drops `wtc_test_admin_user_bots_*` and Playwright passes. Target part: rendered DB acceptance honesty.
5. Severity: Medium. Current DB rendered spec is a good baseline but should be extended if the drilldown adds operation-map or explorer-specific UI, because it currently proves only selected-user facts, read-only pills, stats scope, no forms, and no live-control buttons. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:109` through `tests/e2e/admin-user-bot-detail-db.spec.ts:119` asserts heading/storage/pills/bot headings/stats scope; `tests/e2e/admin-user-bot-detail-db.spec.ts:126` through `tests/e2e/admin-user-bot-detail-db.spec.ts:128` asserts no forms, no CSRF hidden inputs, and no start/stop/apply/test buttons. Recommendation: add scoped assertions for the new admin explorer region, such as a unique heading or test id, selected bot/user label, operation-map layer rows, and visible masked provider identity; keep forbidden-marker checks at body text level. Target part: DB Playwright drilldown proof.
6. Severity: Medium. PG8 mobile coverage already includes the dynamic selected-user route in source guards and demo rendered sweep, but it is layout-shell proof, not populated DB proof. Evidence: static PG8 includes `users/[userId]/bots/page.tsx` in `PAGES` at `tests/integration/admin-responsive.test.ts:19` through `tests/integration/admin-responsive.test.ts:22`; it requires table wrappers and `data-label` cells at `tests/integration/admin-responsive.test.ts:69` through `tests/integration/admin-responsive.test.ts:81`; rendered PG8 sweeps admin pages at exact 375px and asserts no horizontal scroll at `tests/e2e/admin-mobile-pg8.spec.ts:37` through `tests/e2e/admin-mobile-pg8.spec.ts:57`. Recommendation: keep PG8 as the mobile shell/table guard, then use the DB admin rendered harness for populated selected-user rows if the drilldown changes real data panels. Target part: admin mobile safety.
7. Severity: Medium. Bot settings and statistics rendered specs already have operation-map assertions, but several locators remain broad and may become brittle as explorer copy repeats headings like "Runtime evidence", "Stats scope", "Provider pub_id", or "Equity curve". Evidence: settings scopes operation layers through `td[data-label="Layer"]` at `tests/e2e/bot-settings.spec.ts:14`, but also uses broad `getByText(...).first()` in many places such as `tests/e2e/bot-settings.spec.ts:25`, `tests/e2e/bot-settings.spec.ts:56`, and `tests/e2e/bot-settings.spec.ts:60`; statistics smoke asserts `Statistics operation map`, `Equity curve`, `Legacy operations`, and exact `Provider pub_id` at `tests/e2e/smoke.spec.ts:116` through `tests/e2e/smoke.spec.ts:130`. Recommendation: for drilldown work, prefer region-scoped locators using a unique panel heading, `data-label` rows, or `locator(..., { hasText })`; avoid unscoped `getByText()` for repeated labels. Target part: rendered locator stability.
8. Severity: Medium. Generated e2e output has caused stale/contaminated rendered failures before, and cleanup must stay bounded to generated directories. Evidence: default Playwright uses `NEXT_DIST_DIR: '.next-e2e'` and `reuseExistingServer: false` at `playwright.config.ts:31` and `playwright.config.ts:34`; admin DB Playwright uses `.next-e2e-admin-user-bots` at `playwright.admin-user-bots-db.config.ts:63`; `.gitignore` and ESLint ignore `.next-e2e*` outputs at `.gitignore:10` through `.gitignore:17` and `eslint.config.js:14` through `eslint.config.js:18`; Phase 3.97 cleaned `apps/web/.next-e2e` only after verifying the path under `apps/web` at `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md:89`. Recommendation: before default rendered reruns, delete only `apps/web/.next-e2e` after resolving it inside `apps/web`; for admin DB rendered runs, treat `apps/web/.next-e2e-admin-user-bots` as generated and retain screenshots/traces only after review and leak scan. Target part: rendered gate hygiene.

## Decisions
1. Do not add a new broad gate for this improvement. Use focused static/loader/rendered gates matched to the files touched.
2. Treat `tests/integration/admin-user-bot-detail-static.test.ts` and `tests/integration/admin-user-bot-detail-loader.test.ts` as mandatory for selected-user admin changes.
3. Treat `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` as mandatory if the DB rendered harness, prepared fixture, Playwright config, or package scripts are touched.
4. Treat `tests/integration/admin-responsive.test.ts` plus `tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` as the mobile/table shell gate for admin explorer page changes.
5. Treat default bot settings/statistics Playwright as user-surface proof only. It does not prove populated admin selected-user DB rendering.
6. Do not run or recommend live bot control, provider DB mutation, worker tick/restart, env/vault inspection, SSH, tmux, systemd, or retest/apply/start/stop paths for this slice.

## Risks
1. The admin DB rendered gate is blocked operationally until `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is intentionally provided. Without it, only static, loader, demo/mobile, and user-surface rendered evidence is available.
2. The current worktree is heavily dirty and includes many pre-existing bot/admin phase files. Focused gates are safer than broad all-suite conclusions until the operator consolidates the branch.
3. Repeated operation-map and statistics labels make unscoped Playwright text locators likely to produce strict-mode failures or false positives.
4. Default e2e demo mode can pass while real selected-user rows remain unproven; do not use `admin-mobile-pg8.spec.ts` as populated data acceptance.
5. Generated `.next-e2e*`, `apps/web/next-env.d.ts`, screenshots, traces, and `test-results` can create misleading churn after rendered gates.

## Verification/tests
RUN:
1. Required protocol/context docs read before handoff: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/handoffs/20260604-0559-phase-3-97-bot-operation-map.md`.
2. Read-only inspection of current admin selected-user page, admin loader, operation map component, Vitest static/loader/harness tests, PG8 static/mobile tests, bot settings/statistics Playwright specs, Playwright configs, e2e runner scripts, generated-output ignore rules, and relevant prior handoffs.
3. `git rev-parse --show-toplevel` - PASS; current root is `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.
4. `git status --short --branch` - inspected; branch is `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked bot/admin phase state.

NOT RUN:
1. Vitest gates - not run because this is a read-only tests/rendered audit and no implementation was changed.
2. Playwright/rendered gates - not run to avoid starting Next, generating `.next-e2e*`, screenshots, traces, or server output during the audit.
3. `npm run e2e:admin-user-bots:db:managed` - not run; it requires an intentionally supplied `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and creates/drops a throwaway DB.
4. Full `npm test`, `npm run build`, `npm run ci:local`, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e` - not run for read-only audit scope.
5. Live services, provider DB mutation/read outside the guarded throwaway e2e harness, env/vault/secret file inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest - not run by policy and scope.

Recommended focused gates after implementation:
1. Admin selected-user static/loader/harness lane:
   `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
2. Bot safety/statistics static lane if shared bot panels or statistics copy change:
   `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/bot-config-action-handler.test.ts`
3. Admin mobile shell lane:
   `npx vitest run tests/integration/admin-responsive.test.ts`
   `E2E_PORT=3429 npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile --reporter=line`
4. User-facing rendered bot lane if settings/setup operation-map surfaces change, after safe `.next-e2e` cleanup:
   `E2E_PORT=3430 npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line`
5. Statistics rendered lane if `/app/bots/statistics` changes:
   `E2E_PORT=3431 npx playwright test tests/e2e/smoke.spec.ts --grep "bot dashboard sub-tabs render with unified analytics" --project=desktop --project=mobile --reporter=line`
6. Populated admin selected-user rendered lane only when the admin maintenance URL is deliberately supplied without printing it:
   `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<maintenance-url-without-printing-value> npm run e2e:admin-user-bots:db:managed`
7. Standard source health after implementation:
   `npm run typecheck`
   `npm run typecheck -w @wtc/web`
   `npm run lint`
   `npm run secret:scan`
8. Optional broader acceptance after focused gates:
   `npm run build -w @wtc/web`
   `node scripts/gates.mjs full`
   `node scripts/gates.mjs e2e`

Rendered cleanup guidance:
1. Before default rendered reruns, remove only `apps/web/.next-e2e` after resolving it inside `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web`.
2. Do not delete broad workspace paths, `.next`, source files, screenshots, traces, or `test-results` as part of this focused cleanup.
3. For admin DB rendered gates, `.next-e2e-admin-user-bots` is generated output; the runner removes its prepared marker, but retained screenshots/traces still need review and secret/leak scanning before archival.
4. After rendered gates, inspect `git status --short` and `git diff -- apps/web/next-env.d.ts` for generated churn before reporting acceptance.

## Next actions
1. If the next implementation changes only the admin selected-user drilldown/explorer, start with the admin static/loader/harness Vitest lane, then run PG8 mobile shell, then run the DB-backed admin rendered gate only if `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is available.
2. If the next implementation also touches user bot settings/setup/statistics, add the focused bot settings/statistics Playwright lanes with scoped locators.
3. Add unique region scoping for any new explorer panel before rendered assertions are written: stable heading, table caption, `td[data-label]`, or `data-testid`.
4. Keep live bot controls, provider mutations, worker ticks, and retest/apply/start/stop out of this phase until separate security and bot-integration gates authorize them.
