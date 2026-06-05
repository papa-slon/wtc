# Phase 3.99 admin-selected-user-drilldown-tests-auditor handoff
## Scope
Read-only tests/rendered audit for the selected-user Bot drilldown overview and stable per-bot anchors on `/admin/users/[userId]/bots`, after Phase 3.98's admin bot owner drilldown.

The current source already contains a `Bot drilldown overview` table and per-bot anchor targets. This audit names the exact focused gates and assertions needed to lock that rendered behavior down without broad live/provider work.

No product code, tests, package files, scripts, live services, provider DB/env/vault/SSH/tmux/systemd/worker/start/stop/apply/retest path, or Playwright/Vitest gate was run or changed in this audit.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0617-phase-3-98-admin-bot-owner-drilldown.md`
8. `docs/handoffs/20260604-0603-bot-admin-drilldown-tests-auditor.md`
9. `tests/integration/admin-user-bot-detail-static.test.ts`
10. `tests/integration/admin-user-bot-detail-loader.test.ts`
11. `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
12. `tests/integration/admin-responsive.test.ts`
13. `tests/e2e/admin-mobile-pg8.spec.ts`
14. `tests/e2e/admin-user-bot-detail-db.spec.ts`
15. `playwright.config.ts`
16. `playwright.admin-user-bots-db.config.ts`
17. `playwright.auth.config.ts`
18. `playwright.auth-db.config.ts`
19. `playwright.lms-db.config.ts`
20. `package.json`
21. `scripts/run-admin-user-bot-detail-e2e.mjs`
22. `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
23. `scripts/prepare-admin-user-bot-detail-e2e.ts`
24. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
25. `apps/web/src/app/admin/bots/page.tsx`
26. `apps/web/src/features/admin/user-bot-detail-loader.ts`

## Files changed
1. `docs/handoffs/20260604-0620-admin-selected-user-drilldown-tests-auditor.md` - handoff only; no product code or tests changed.

## Findings
1. Severity: High. The selected-user overview and stable anchors are present in source, but current static coverage does not explicitly pin them. Evidence: `botAnchor()` returns `bot-${bot.productCode}` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:72` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:74`; the overview table renders at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:150` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:186`; bot cards receive `id={botAnchor(bot)}` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:188` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:190`; the existing static test covers read-only/RBAC/safety strings at `tests/integration/admin-user-bot-detail-static.test.ts:63` through `tests/integration/admin-user-bot-detail-static.test.ts:113` but does not assert `Bot drilldown overview`, `botAnchor`, `href="#..."`, or `id={botAnchor(bot)}`. Recommendation: extend the selected-user page static test with exact overview/anchor assertions before accepting this slice. Target part: static source guard.
2. Severity: High. The populated DB-rendered spec must prove that the overview links target stable per-bot cards; today it proves selected-user facts and read-only safety but not the new anchor behavior. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:109` through `tests/e2e/admin-user-bot-detail-db.spec.ts:130` asserts page heading, storage/live-control pills, bot headings, stats scope, body markers, no forms, no CSRF, no live-control buttons, no horizontal scroll, and screenshot capture; it does not assert `Bot drilldown overview`, `Jump to bot card`, `a[href="#bot-tortila_bot"]`, `a[href="#bot-legacy_bot"]`, `#bot-tortila_bot`, `#bot-legacy_bot`, or hash navigation. Recommendation: add those rendered assertions to the DB spec and to the harness static test. Target part: populated rendered acceptance.
3. Severity: High. The loader lane already supplies deterministic two-bot selected-user facts and should remain the first data gate for the overview. Evidence: `loadAdminUserBotDetailFromDb()` builds bots from `ADMIN_BOT_PRODUCT_CODES.map` at `apps/web/src/features/admin/user-bot-detail-loader.ts:1009` through `apps/web/src/features/admin/user-bot-detail-loader.ts:1044`; the loader test asserts target Tortila and Legacy facts at `tests/integration/admin-user-bot-detail-loader.test.ts:442` through `tests/integration/admin-user-bot-detail-loader.test.ts:561`; it asserts no cross-user/raw/secrets leakage at `tests/integration/admin-user-bot-detail-loader.test.ts:569` through `tests/integration/admin-user-bot-detail-loader.test.ts:623`. Recommendation: keep `admin-user-bot-detail-loader.test.ts` mandatory and add `expect(detail.bots.map((bot) => bot.productCode)).toEqual(['tortila_bot', 'legacy_bot'])` if rendered overview order is relied upon. Target part: selected-user data ordering and isolation.
4. Severity: High. Legacy overview text must remain provider-scoped and masked, not fleet-global or raw provider identity. Evidence: short/long provider IDs are masked at `apps/web/src/features/admin/user-bot-detail-loader.ts:215` through `apps/web/src/features/admin/user-bot-detail-loader.ts:222`; provider account DTOs expose the masked value at `apps/web/src/features/admin/user-bot-detail-loader.ts:636` through `apps/web/src/features/admin/user-bot-detail-loader.ts:653`; metrics/positions/trades are scoped through provider-aware row filtering at `apps/web/src/features/admin/user-bot-detail-loader.ts:706` through `apps/web/src/features/admin/user-bot-detail-loader.ts:723`; the rendered DB spec already hides raw `USER_A_LEGACY_PUB_ID` while allowing masked `USER_A...B_ID` at `tests/e2e/admin-user-bot-detail-db.spec.ts:59` through `tests/e2e/admin-user-bot-detail-db.spec.ts:64` and `tests/e2e/admin-user-bot-detail-db.spec.ts:121` through `tests/e2e/admin-user-bot-detail-db.spec.ts:124`. Recommendation: overview assertions should require `Legacy pub_id USER_A...B_ID` and continue forbidding raw pub_id, raw config, raw trade JSON, secrets, and password markers. Target part: Legacy attribution.
5. Severity: Medium. PG8 mobile coverage remains necessary but does not prove populated overview rows. Evidence: PG8 mobile visits `/admin/users/demo-user/bots` at `tests/e2e/admin-mobile-pg8.spec.ts:20` through `tests/e2e/admin-mobile-pg8.spec.ts:24`; the selected-user page only renders the overview inside the `detail.user` branch at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:126` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:186`; PG8 source coverage wraps admin tables and requires `data-label` cells at `tests/integration/admin-responsive.test.ts:69` through `tests/integration/admin-responsive.test.ts:81`. Recommendation: keep PG8 as shell/table responsive proof, then use the admin DB rendered harness mobile project for populated overview row proof. Target part: mobile/rendered acceptance.
6. Severity: Medium. The DB rendered harness is correctly opt-in and should stay separate from default e2e. Evidence: default Playwright ignores `admin-user-bot-detail-db.spec.ts` at `playwright.config.ts:9`; package scripts register `e2e:admin-user-bots:db` and `e2e:admin-user-bots:db:managed` at `package.json:33` through `package.json:34`; the admin DB config requires `ADMIN_USER_BOTS_E2E === '1'`, a throwaway DB name, a prep token, and marker HMAC at `playwright.admin-user-bots-db.config.ts:13` through `playwright.admin-user-bots-db.config.ts:30`; the same config runs desktop and mobile projects at `playwright.admin-user-bots-db.config.ts:52` through `playwright.admin-user-bots-db.config.ts:55`. Recommendation: report the DB rendered gate as NOT RUN unless the managed runner creates/drops `wtc_test_admin_user_bots_*` and both projects pass. Target part: gate honesty.
7. Severity: Medium. Anchor assertions should use stable selectors, not repeated text labels, because the page repeats headings and labels like `Stats scope`, bot names, warnings, and provider mapping copy. Evidence: overview link cells render `href={`#${botAnchor(bot)}`}` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:176` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:180`; target cards render stable ids at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:188` through `apps/web/src/app/admin/users/[userId]/bots/page.tsx:190`; existing rendered assertions use broad text for stats scope and provider scope at `tests/e2e/admin-user-bot-detail-db.spec.ts:117` through `tests/e2e/admin-user-bot-detail-db.spec.ts:119`. Recommendation: prefer `page.locator('a[href="#bot-tortila_bot"]')`, `page.locator('#bot-tortila_bot')`, and card-scoped heading assertions over unscoped `getByText()` for the anchor flow. Target part: Playwright locator stability.
8. Severity: Medium. The worktree is already broadly dirty, so this audit should not imply a clean branch or broad suite result. Evidence: `git status --short --branch` shows branch `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified/untracked bot/admin phase files. Recommendation: after implementation, run focused gates against touched/adjacent files and report exact NOT RUN gates instead of claiming whole-site acceptance. Target part: release hygiene.

## Decisions
1. Treat the selected-user overview/anchor work as an admin selected-user drilldown test slice, not a broad phase or live-provider gate.
2. Keep the mandatory first lane as static plus loader plus harness Vitest: selected-user page source, selected-user DB loader isolation, and guarded DB rendered harness registration.
3. Keep PG8 mobile as shell/table proof only; use the admin user-bots DB rendered harness for populated overview proof.
4. Require rendered assertions for stable anchor hrefs, target ids, hash navigation, masked Legacy identity, overview stat summaries, warning summaries, no forms, no CSRF fields, and no live-control buttons.
5. Do not recommend live bot services, provider DB mutation outside the guarded throwaway harness, env/vault inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, or exchange ping for this slice.

## Risks
1. No tests were run in this audit by instruction, so all gate recommendations are inspection-derived and must be executed by the implementation/session operator before acceptance.
2. The populated admin DB rendered gate remains operationally blocked unless `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is deliberately supplied.
3. Static source assertions can become copy-brittle; the most durable new checks should target `botAnchor`, exact anchor hrefs, stable card ids, and table `data-label` structure.
4. Demo-mode `/admin/users/demo-user/bots` can pass mobile shell checks without rendering the populated overview branch.
5. Generated `.next-e2e*`, screenshots, traces, and `test-results` can create misleading churn after rendered gates; clean or retain only bounded generated artifacts after review.

## Verification/tests
RUN:
1. Required protocol/context docs read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/handoffs/20260604-0617-phase-3-98-admin-bot-owner-drilldown.md`.
2. Read-only inspection of the selected-user admin bot page, admin fleet bot page, selected-user loader, static/loader/harness tests, PG8 static/mobile tests, admin DB rendered spec, Playwright configs, package scripts, and admin DB e2e runners.
3. `Test-Path docs/handoffs/20260604-0620-admin-selected-user-drilldown-tests-auditor.md` before writing - returned `False`.
4. `git rev-parse --show-toplevel` - PASS; current root is `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.
5. `git status --short --branch` - inspected; branch is `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked bot/admin phase state.

NOT RUN:
1. Vitest gates - not run because this was a read-only tests/rendered audit and the user explicitly prohibited running tests.
2. Playwright/rendered gates - not run because the user explicitly prohibited running tests/live services and this would start a local dev server/generate artifacts.
3. `npm run e2e:admin-user-bots:db:managed` - not run; it requires intentionally supplied `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` and creates/drops a throwaway DB.
4. Full `npm test`, `npm run build`, `npm run ci:local`, `node scripts/gates.mjs full`, and `node scripts/gates.mjs e2e` - not run for read-only audit scope.
5. Live services, provider DB/env/vault/secret inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, and live exchange ping - not run by policy and scope.

Recommended focused gates after implementation:
1. Static/loader/harness lane:
   `npm exec vitest -- run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
2. Admin responsive source lane:
   `npm exec vitest -- run tests/integration/admin-responsive.test.ts`
3. Admin mobile shell lane, with an isolated port if needed:
   `E2E_PORT=3429 npm exec playwright -- test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile --reporter=line`
4. Populated admin selected-user rendered lane, only when the admin maintenance URL is deliberately supplied without printing it:
   `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=<maintenance-url-without-printing-value> npm run e2e:admin-user-bots:db:managed`
5. Source health after code/test edits:
   `npm exec tsc -- -p tsconfig.json --noEmit`
   `npm exec tsc -- -p apps/web/tsconfig.json --noEmit`
   `npm run lint`
   `npm run secret:scan`
   `git diff --check -- apps/web/src/app/admin/users/[userId]/bots/page.tsx tests/integration/admin-user-bot-detail-static.test.ts tests/e2e/admin-user-bot-detail-db.spec.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
6. Optional broader acceptance only after focused gates are green:
   `npm run build -w @wtc/web`
   `node scripts/gates.mjs full`
   `node scripts/gates.mjs e2e`

Exact static assertions to add or keep in `tests/integration/admin-user-bot-detail-static.test.ts`:
1. `expect(page).toContain('Bot drilldown overview');`
2. `expect(page).toContain('Selected-user read-only drilldown');`
3. `expect(page).toContain('function botAnchor');`
4. `expect(page).toContain('bot-${bot.productCode}');`
5. `expect(page).toContain('href={`#${botAnchor(bot)}`}');`
6. `expect(page).toContain('id={botAnchor(bot)}');`
7. `expect(page).toContain('Jump to bot card');`
8. `expect(page).toContain('scrollMarginTop: 90');`
9. `expect(page).toContain('overviewRuntimeScope');`
10. `expect(page).toContain('overviewWarningLabel');`
11. `expect(page).toContain('overviewStatsLabel');`
12. `expect(page).toContain('data-label="Drilldown"');`
13. Keep the existing negative assertions for `CsrfField`, `type="submit"`, `saveBotConfigAction`, `startBot`, `stopBot`, `applyConfig`, and `test connection`.

Exact rendered assertions to add or keep in `tests/e2e/admin-user-bot-detail-db.spec.ts`:
1. `await expect(page.getByRole('heading', { name: 'Bot drilldown overview' })).toBeVisible();`
2. `await expect(page.getByText('Selected-user read-only drilldown')).toBeVisible();`
3. `await expect(page.getByRole('link', { name: 'Jump to bot card' })).toHaveCount(2);`
4. `await expect(page.locator('a[href="#bot-tortila_bot"]')).toHaveCount(1);`
5. `await expect(page.locator('a[href="#bot-legacy_bot"]')).toHaveCount(1);`
6. `await expect(page.locator('#bot-tortila_bot')).toHaveCount(1);`
7. `await expect(page.locator('#bot-legacy_bot')).toHaveCount(1);`
8. `await expect(page.locator('#bot-tortila_bot').getByRole('heading', { name: 'Tortila Bot' })).toBeVisible();`
9. `await expect(page.locator('#bot-legacy_bot').getByRole('heading', { name: 'Legacy Bot' })).toBeVisible();`
10. `await expect(page.getByText('user instance snapshots')).toBeVisible();`
11. `await expect(page.getByText('Legacy pub_id USER_A...B_ID')).toBeVisible();`
12. `await expect(page.getByText('1234.5600 wallet / 1 positions / 1 trades / 2 equity points')).toBeVisible();`
13. `await expect(page.getByText('2222.2200 wallet / 1 positions / 1 trades / 1 equity points')).toBeVisible();`
14. `await expect(page.getByText('6 notices - max error')).toBeVisible();`
15. `await expect(page.getByText('4 notices - max warning')).toBeVisible();`
16. `await page.locator('a[href="#bot-legacy_bot"]').click();`
17. `await expect(page).toHaveURL(/#bot-legacy_bot$/);`
18. Keep body-level visible/hidden marker checks, no-form/no-CSRF/no-live-control checks, and no-horizontal-scroll check.

Exact harness-static assertions to add or keep in `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`:
1. `expect(spec).toContain('Bot drilldown overview');`
2. `expect(spec).toContain('Jump to bot card');`
3. `expect(spec).toContain('a[href="#bot-tortila_bot"]');`
4. `expect(spec).toContain('a[href="#bot-legacy_bot"]');`
5. `expect(spec).toContain('#bot-tortila_bot');`
6. `expect(spec).toContain('#bot-legacy_bot');`
7. `expect(spec).toContain('Legacy pub_id USER_A...B_ID');`
8. Keep the existing harness assertions that the DB spec is opt-in, excluded from default `e2e`/`ci:local`, uses mock bot adapter mode, disables live bot control, and refuses unsafe DB URLs.

## Next actions
1. Add the static overview/anchor assertions, then run the static/loader/harness Vitest lane.
2. Extend the DB rendered spec with stable href/id/hash assertions and overview row text, then run the managed DB rendered gate only when `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is intentionally available.
3. Keep PG8 mobile shell proof in the focused gate stack, but do not treat it as populated overview acceptance.
4. Preserve the no-live-control boundary: no provider mutation, worker tick, live bot control, env/vault inspection, SSH, tmux, systemd, start/stop/apply/retest, or exchange ping in this slice.
