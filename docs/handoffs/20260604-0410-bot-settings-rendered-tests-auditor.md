# bot-settings-rendered-tests-auditor handoff
## Scope
Read-only Phase 3.94 tests/browser-gates audit for the current bot settings, setup, statistics, admin global bot config, and admin selected-user bot drilldown surfaces. The goal was to identify the smallest meaningful local rendered UX plus safety acceptance gate that can run without live bot/provider mutation, and to run feasible focused existing gates only.

No product code, test code, live server state, provider DB, worker tick/restart, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, or live bot state was modified or touched. This is one named read-only auditor handoff, not an N-agent audit claim. No background agents were spawned by this auditor lane, so none required cleanup.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0340-phase-3-93-admin-global-provider-identity-boundary.md`
8. `docs/handoffs/20260604-0340-admin-global-provider-identity-tests-auditor.md`
9. `docs/handoffs/20260604-0340-admin-global-provider-identity-ux-source-auditor.md`
10. `docs/handoffs/20260604-0340-admin-global-provider-identity-boundary-auditor.md`
11. `package.json`
12. `apps/web/package.json`
13. `playwright.config.ts`
14. `vitest.config.ts`
15. `tests/e2e/helpers/auth.ts`
16. `tests/e2e/bot-settings.spec.ts`
17. `tests/e2e/bot-readiness-map.spec.ts`
18. `tests/e2e/warning-summary-visual.spec.ts`
19. `tests/e2e/admin-mobile-pg8.spec.ts`
20. `tests/e2e/smoke.spec.ts`
21. `tests/integration/admin-global-bot-config-static.test.ts`
22. `tests/integration/admin-global-bot-config-db.test.ts`
23. `tests/integration/user-resolved-bot-config-static.test.ts`
24. `tests/integration/user-resolved-bot-config-db.test.ts`
25. `tests/integration/admin-user-bot-detail-static.test.ts`
26. `tests/integration/admin-user-bot-detail-loader.test.ts`
27. `tests/integration/bot-statistics-static.test.ts`
28. `tests/integration/bot-config-review-static.test.ts`
29. `tests/integration/bot-runtime-config-sanitizer.test.ts`
30. `tests/integration/bot-config-export-route-handler.test.ts`
31. `apps/web/src/app/admin/bots/config/page.tsx`
32. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
33. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
34. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
35. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
36. `apps/web/src/features/admin/actions.ts`
37. `apps/web/src/features/admin/user-bot-detail-loader.ts`
38. `packages/db/src/repositories.ts`

## Files changed
1. `docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md`

## Findings
1. Severity: High. The local safety/static/DB coverage for config boundaries is meaningful and passed in this lane. Evidence: admin global static tests assert the admin route is RBAC/CSRF/Zod guarded and never calls adapters or live controls (`tests/integration/admin-global-bot-config-static.test.ts:45`, `tests/integration/admin-global-bot-config-static.test.ts:55`, `tests/integration/admin-global-bot-config-static.test.ts:57`, `tests/integration/admin-global-bot-config-static.test.ts:63`, `tests/integration/admin-global-bot-config-static.test.ts:66`, `tests/integration/admin-global-bot-config-static.test.ts:69`); DB tests reject nested provider/runtime/live-control keys without appending config, version, or audit rows (`tests/integration/admin-global-bot-config-db.test.ts:181`, `tests/integration/admin-global-bot-config-db.test.ts:184`, `tests/integration/admin-global-bot-config-db.test.ts:187`, `tests/integration/admin-global-bot-config-db.test.ts:193`, `tests/integration/admin-global-bot-config-db.test.ts:220`, `tests/integration/admin-global-bot-config-db.test.ts:223`); user config DB tests prove published defaults do not create user rows and user overrides stay user-owned (`tests/integration/user-resolved-bot-config-db.test.ts:102`, `tests/integration/user-resolved-bot-config-db.test.ts:125`, `tests/integration/user-resolved-bot-config-db.test.ts:170`, `tests/integration/user-resolved-bot-config-db.test.ts:205`, `tests/integration/user-resolved-bot-config-db.test.ts:208`). Recommendation: keep these focused Vitest files in the Phase 3.94 safety gate. Target part: non-live config/source safety.
2. Severity: High. Existing rendered coverage for user settings, setup, admin defaults, and readiness is well targeted and passed before the Playwright run later failed elsewhere. Evidence: `tests/e2e/bot-settings.spec.ts:13` through `tests/e2e/bot-settings.spec.ts:31` checks Tortila settings for readiness, disabled live apply, no "Connection verified", no horizontal scroll, and a screenshot; `tests/e2e/bot-settings.spec.ts:37` through `tests/e2e/bot-settings.spec.ts:52` checks Legacy settings, effective review, export link, and no horizontal scroll; `tests/e2e/bot-settings.spec.ts:55` through `tests/e2e/bot-settings.spec.ts:76` checks Tortila/Legacy setup review and incomplete-review blocking; `tests/e2e/bot-settings.spec.ts:79` through `tests/e2e/bot-settings.spec.ts:91` checks admin system defaults with live control disabled and no user override controls; `tests/e2e/bot-readiness-map.spec.ts:16` through `tests/e2e/bot-readiness-map.spec.ts:38` checks dashboard readiness maps and disabled live control for both bots. Recommendation: treat these two e2e specs as the smallest rendered acceptance core for settings/setup/readiness. Target part: rendered bot settings/setup/admin defaults.
3. Severity: High. The broader existing rendered gate is not green for Phase 3.94 because the focused Playwright command failed. Evidence: the statistics warning spec expects "Risk and status notes" on `/app/bots/statistics?bot=${bot}` (`tests/e2e/warning-summary-visual.spec.ts:82`, `tests/e2e/warning-summary-visual.spec.ts:83`), while the page source does render the title in the intended branches (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:396`, `apps/web/src/app/(app)/app/bots/statistics/page.tsx:398`); the failed run reported that desktop could not find that text, then additional `page.goto` calls aborted after Next dev crashed with missing `.next-e2e/server/app-paths-manifest.json`. Recommendation: before any visual acceptance claim, rerun the focused rendered gate from a clean serialized e2e dev server state; if the "Risk and status notes" assertion still fails after the manifest issue is gone, fix the stats page or the stale assertion. Target part: statistics rendered warning surface.
4. Severity: Medium. Admin selected-user bot drilldown has strong static/loader safety coverage, but rendered coverage is shallow. Evidence: static tests require the admin drilldown page to be read-only, admin-gated, and free of submit/save/live controls (`tests/integration/admin-user-bot-detail-static.test.ts:63`, `tests/integration/admin-user-bot-detail-static.test.ts:66`, `tests/integration/admin-user-bot-detail-static.test.ts:69`, `tests/integration/admin-user-bot-detail-static.test.ts:93`, `tests/integration/admin-user-bot-detail-static.test.ts:95`, `tests/integration/admin-user-bot-detail-static.test.ts:100`, `tests/integration/admin-user-bot-detail-static.test.ts:103`, `tests/integration/admin-user-bot-detail-static.test.ts:108`); loader tests prove target-user isolation and no raw config, secret, provider, token, or password-hash leakage (`tests/integration/admin-user-bot-detail-loader.test.ts:570`, `tests/integration/admin-user-bot-detail-loader.test.ts:604`, `tests/integration/admin-user-bot-detail-loader.test.ts:607`, `tests/integration/admin-user-bot-detail-loader.test.ts:617`, `tests/integration/admin-user-bot-detail-loader.test.ts:623`); however the only existing rendered route sweep checks heading/nav/storage/no-scroll for `/admin/users/demo-user/bots` (`tests/e2e/admin-mobile-pg8.spec.ts:20`, `tests/e2e/admin-mobile-pg8.spec.ts:23`, `tests/e2e/admin-mobile-pg8.spec.ts:37`, `tests/e2e/admin-mobile-pg8.spec.ts:44`, `tests/e2e/admin-mobile-pg8.spec.ts:50`, `tests/e2e/admin-mobile-pg8.spec.ts:57`) and skips desktop for that spec (`tests/e2e/admin-mobile-pg8.spec.ts:38`). Recommendation: add a focused admin-user-drilldown e2e that asserts the read-only pills, resolved config source, provider mapping mask, canonical warnings, positions/trades/equity cards, no submit controls, and absence of raw/secret markers on both desktop and mobile. Target part: admin user drilldown rendered acceptance.
5. Severity: Medium. The existing Playwright config is safe for local non-live rendering, but current local e2e infrastructure is collision-prone. Evidence: the config starts a dedicated dev server with `E2E_AUTH_BYPASS=1`, `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false` (`playwright.config.ts:27`, `playwright.config.ts:32`, `playwright.config.ts:33`, `playwright.config.ts:35`, `playwright.config.ts:36`, `playwright.config.ts:37`, `playwright.config.ts:38`); it hardcodes `NEXT_DIST_DIR` to `.next-e2e` (`playwright.config.ts:34`) and refuses to reuse existing servers (`playwright.config.ts:31`). The first run failed because port 3410 was already used; the retry on port 35410 avoided the port but still shared `.next-e2e` with the existing 3410 listener and later hit a missing Next manifest. Recommendation: serialize e2e runs or provide a per-port/per-run Next dist dir before using focused Playwright as a hard gate. Target part: local rendered-gate reliability.

## Decisions
1. Verdict: Phase 3.94 rendered UX and safety acceptance is not green in this auditor lane. Focused Vitest safety passed; focused rendered Playwright failed.
2. Smallest meaningful local safety gate that can run without live mutation:
   `npx vitest run tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/user-resolved-bot-config-db.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/bot-config-export-route-handler.test.ts`
3. Smallest meaningful existing rendered gate to attempt locally under mock/no-live flags:
   `npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile`
4. The rendered gate should only be accepted after it passes from a clean serialized dev-server state. Current evidence is partial: settings/setup/admin defaults/readiness passed, but statistics/admin warning/mobile sweep failed.
5. No live/provider mutation gate is needed or allowed for this phase; the safe local rendered gate uses mock adapters and explicitly disabled live bot control/TV automation.

## Risks
1. The worktree was already heavily dirty before this audit, including modified/untracked product, test, and handoff files. This auditor did not attribute authorship and did not revert or clean unrelated changes.
2. The rendered gate failure may be infrastructure-only, product-only, or mixed. The first desktop statistics assertion failed before the visible Next manifest crash, so it needs a clean rerun before classification.
3. Static string tests are useful tripwires but do not prove visual prominence, wrapping, click targets, or the absence of hidden rendered controls.
4. Admin selected-user drilldown still lacks content-level rendered acceptance for the actual read-only safety claims.
5. No full-platform gate was run, so this audit does not imply broad site readiness.

## Verification/tests
RUN:
1. Required protocol and status reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0340-phase-3-93-admin-global-provider-identity-boundary.md`.
2. Focused source/test inspection with `rg`/`Get-Content` over the files listed above.
3. `git status --short` - observed a heavily dirty worktree before this handoff, including focused modified/untracked product/test files and many untracked handoffs; no cleanup or revert was performed.
4. `npx vitest run tests/integration/admin-global-bot-config-static.test.ts tests/integration/admin-global-bot-config-db.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/user-resolved-bot-config-db.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/bot-statistics-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/bot-config-export-route-handler.test.ts` - PASS, 10 files / 42 tests.
5. `npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile` - FAIL before tests because `http://localhost:3410` was already used and config refuses reuse.
6. `$env:E2E_PORT='35410'; npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/bot-readiness-map.spec.ts tests/e2e/warning-summary-visual.spec.ts tests/e2e/admin-mobile-pg8.spec.ts --project=desktop --project=mobile` - FAIL, 10 passed / 3 failed / 1 skipped. Passing tests: desktop/mobile bot readiness, desktop/mobile bot settings, desktop/mobile bot setup, desktop/mobile admin bot defaults, mobile user warning summaries, mobile admin warning summaries. Failures: desktop `warning-summary-visual.spec.ts` could not find "Risk and status notes" on statistics; desktop admin warning summary aborted on `/admin/bots`; mobile admin PG8 aborted on `/admin/products`. Web server reported missing `.next-e2e/server/app-paths-manifest.json`.
7. `Get-NetTCPConnection -LocalPort 3410,35410 -ErrorAction SilentlyContinue` - observed `127.0.0.1:3410` listening with owning process 15440; no listener remained on 35410.
8. `git status --short -- tests/e2e/screenshots test-results apps/web/.next-e2e docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md` before writing this file - no screenshot/test-result/.next-e2e changes were reported.
9. `git diff --check -- docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md` - PASS.
10. `npx secretlint "docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md"` - PASS.
11. `git status --short -- docs/handoffs/20260604-0410-bot-settings-rendered-tests-auditor.md tests/e2e/screenshots test-results apps/web/.next-e2e` after writing this file - only the new handoff was reported.

NOT RUN:
1. Full `npm test` - skipped for focused auditor scope; the focused 10-file Vitest command above was run.
2. Full `npm run e2e` / complete Playwright suite - skipped because the smaller rendered gate already failed and broader e2e would be noisy.
3. `npm run lint`, root/web/worker typecheck, and `npm run build -w @wtc/web` - skipped because no product/test code was edited and this was a focused read-only auditor lane.
4. Full `npm run secret:scan` and `npm run governance:check` - not run; this per-agent lane is not an aggregate phase handoff. Handoff-only `secretlint` was run and passed.
5. Real Postgres migration/seed, provider DB, worker tick/restart/smoke, live bot start/stop/apply-config/retest, exchange ping, env/vault/secret inspection, SSH, tmux, systemd, live server checks - NOT RUN because forbidden by scope/protocol and unnecessary for this local rendered UX gate.

## Next actions
1. Main agent should rerun the focused Playwright gate from a clean serialized e2e state. Do not claim rendered acceptance until it passes.
2. If the clean rerun still fails at `warning-summary-visual.spec.ts:83`, add/fix a focused statistics e2e that asserts the statistics page heading, portfolio snapshot, risk/status notes, advanced panels, Legacy no-equity/no-monthly empty states, no "Connection verified", and no horizontal scroll on desktop/mobile.
3. Add a focused admin selected-user bot drilldown e2e for `/admin/users/demo-user/bots` on desktop and mobile. Minimum assertions: read-only status pills, resolved WTC settings, provider mapping mask, canonical warning summary, open positions/recent trades/equity cards, no submit/save/global-default/live-control controls, no raw config/secret markers.
4. Consider making Playwright's Next dist directory unique per e2e port/run or ensuring stale e2e dev servers are closed before launching the acceptance gate.
5. Keep all Phase 3.94 local gates on mock/read-only settings; do not run live bot/provider mutation gates.
