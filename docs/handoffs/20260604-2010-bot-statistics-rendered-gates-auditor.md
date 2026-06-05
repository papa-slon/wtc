# bot-statistics-rendered-gates-auditor handoff
## Scope
Phase 4.35 read-only rendered tests/gates audit for bot statistics in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope inspected: `tests/e2e`, Playwright configs, bot statistics route/components, bot statistics integration/static tests, current screenshot/test-result artifact shape, local e2e port state, and prior rendered/statistics handoffs. No code, test, config, schema, DB, service, provider, exchange, bot-control, worker, secret/env, SSH, deploy, or production state was changed. The only intentional write is this required handoff.

Current checkout state observed before this handoff: branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with many pre-existing modified and untracked files. `tests/e2e/bot-statistics.spec.ts` is present but untracked in this checkout.

## Files inspected
- `package.json`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `docs/handoffs/20260604-1821-bot-statistics-tests-visual-auditor.md`
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`
- `docs/handoffs/20260604-1925-rendered-acceptance-gates-auditor.md`
- `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md`
- Current `tests/e2e/screenshots` and `test-results` artifact inventory.
- Current local process/port state for existing Playwright/Next lanes.

## Files changed
None - read-only audit except this required handoff:
- `docs/handoffs/20260604-2010-bot-statistics-rendered-gates-auditor.md`

## Findings
1. Severity P1 - A dedicated `tests/e2e/bot-statistics.spec.ts` now exists, but it is untracked and the observed external Playwright artifacts show it is not green yet. Evidence: `tests/e2e/bot-statistics.spec.ts:44`-`60` checks Tortila statistics and `:63`-`:81` checks Legacy statistics; observed `test-results/.../error-context.md` reports failures on `getByText('Tortila Turtle Bot')` and `getByText('Legacy Averaging Bot')` while the rendered headings in the accessibility snapshot are `Tortila Bot` and `Legacy Bot`. Recommendation: keep the file, but correct those bot-name assertions before counting the spec as an acceptance gate. Target part: dedicated rendered statistics proof.

2. Severity P1 - The minimal dedicated spec shape should be two route tests plus shared safety/layout helpers, not another broad smoke test. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:327`-`:443` renders the common shell, continuity monitor, operation map, runtime evidence ladder, and command center; `:474`-`:539` branches into Tortila performance panels or Legacy operational panels. Recommendation: keep one Tortila test and one Legacy test, each using `loginUser`, `expectStatisticsShell`, `expectNoHScroll`, and `expectNoLiveControlClaims`. Target part: e2e spec shape.

3. Severity P1 - The shared shell assertions should cover the rendered route landmarks and read-only boundary without asserting volatile dollars, dates, exact worker age, or warning counts. Evidence: `BotStatisticsCommandCenter.tsx:45`-`:96` defines stable command-center layers `0. Worker heartbeat` through `6. Live boundary`; the route copy includes `Different strategies are not blended into one fake win rate`, `Statistics continuity monitor`, `Statistics operation map`, `Statistics evidence ladder`, and `Statistics command center`. Recommendation: assert those stable labels, `aria-current` selected bot links if useful, no horizontal scroll, no `Connection verified`, and no live-control buttons named `/start|stop|apply|test connection/i`. Avoid forbidding lowercase `start/stop` in body text because the safe boundary copy intentionally says runtime start/stop is absent. Target part: robust browser assertions.

4. Severity P1 - Bot-specific assertions should prove the product truth split. Evidence: Tortila renders financial/statistical panels such as `Net PnL after fees`, `Win rate`, `Profit factor`, `Equity curve`, `Performance diagnostics`, `Monthly returns`, `Symbol contribution`, and `Open risk exposure`; Legacy renders `Legacy operations`, `Legacy statistics cockpit`, `Provider pub_id`, `Active slots`, `Active order coverage`, `Stage utilization by trigger`, and closed-trade pending copy. Recommendation: Tortila should assert closed-trade performance panels and absence of Legacy pending-history notices; Legacy should assert operational evidence and absence of `Equity curve` plus `Net PnL after fees`. Target part: Tortila vs Legacy statistics semantics.

5. Severity P1 - The existing Playwright default config is sufficient for this dedicated no-live-DB rendered gate once the spec is fixed. Evidence: `playwright.config.ts:4`-`:5` takes `E2E_PORT`, `:8` uses `tests/e2e`, `:9` ignores only auth-production, LMS DB, and admin-user DB specs, `:23`-`:26` runs desktop and mobile, and `:27`-`:39` starts Next dev with `E2E_AUTH_BYPASS=1`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`. Recommendation: do not add another Playwright config or runner for this no-live-DB stats proof; run the file directly on a free `E2E_PORT`. Target part: gate command.

6. Severity P1 - The current local e2e lane is not quiet, so a fresh run must use a confirmed free port and must not count mid-run artifacts. Evidence: ports `3410`, `3411`, `3412`, `3420`, `3300`, `3310`, and `3457` had listeners or active connections during inspection; a Playwright process was observed running `tests/e2e/bot-statistics.spec.ts` with `next dev --port 3457`. Recommendation: do not reuse those ports or count the observed `test-results` artifacts as this auditor's gate. Target part: Playwright reliability.

7. Severity P2 - Existing static/integration tests protect source boundaries but do not replace rendered proof. Evidence: `tests/integration/bot-statistics-static.test.ts:17`-`:122` source-checks the statistics page, panels, command center, warnings, no direct adapter calls, and no live-control/secret wiring; `tests/integration/bot-statistics-completion.test.ts:13`-`:59` locks worker heartbeat and Legacy completion copy; `tests/integration/bot-read-safety-static.test.ts:55`-`:448` covers broader bot read-safety boundaries. Recommendation: run focused Vitest when route/component copy or wiring changes, but still require Playwright for desktop/mobile rendered layout. Target part: static vs rendered boundary.

8. Severity P2 - Screenshot capture is expected, but screenshot capture is not formal visual acceptance. Evidence: `playwright.config.ts:20`-`:21` retains failure screenshots/traces, while specs manually write full-page PNGs under `tests/e2e/screenshots`; current dedicated stats screenshots were absent because the observed spec failed before its manual screenshots. Recommendation: after a passing dedicated run, expect four fresh screenshots and then run visual inventory; only a manifest-backed review can make formal visual acceptance green. Target part: artifact expectations.

## Decisions
- Use the existing untracked `tests/e2e/bot-statistics.spec.ts` as the dedicated spec target after correcting its bot name assertions. Do not create a second dedicated stats e2e file.
- Minimal dedicated spec shape:
  - shared `shot(slug, project)` using `tests/e2e/screenshots/<slug>-<project>.png`;
  - shared `expectNoHScroll(page, label)`;
  - shared `expectNoLiveControlClaims(page)` checking no `Connection verified`, no role buttons named `/start|stop|apply|test connection/i`, no forms, and no visible secret markers such as `apiKey`, `apiSecret`, `sealed`, `token=`;
  - shared `expectStatisticsShell(page, label)` checking route heading, portfolio snapshot, continuity monitor, operation map, evidence ladder, command center, worker heartbeat, data scope, performance, admin mirror, live boundary, live-control-disabled pill/copy, and layout safety;
  - test 1: `/app/bots/statistics?bot=tortila` asserts `Tortila Bot`, performance metrics/panels, equity curve, journal diagnostics, and absence of Legacy pending-history notices;
  - test 2: `/app/bots/statistics?bot=legacy` asserts `Legacy Bot`, operational cockpit, provider pub_id, active slot/order/stage coverage, closed-trade pending truth, and absence of Tortila equity/net-PnL panels;
  - both tests take full-page screenshots.
- Exact dedicated rendered command after implementation, using a free port:

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
$targetPort = 35432
$busyPort = Get-NetTCPConnection -LocalPort $targetPort -ErrorAction SilentlyContinue
if ($busyPort) {
  $busyPort | Select-Object LocalAddress,LocalPort,State,OwningProcess
  throw "Bot statistics rendered gate preflight failed: choose a free E2E_PORT."
}
$env:E2E_PORT = "$targetPort"
$started = Get-Date
npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop --project=mobile
if ($LASTEXITCODE -ne 0) { throw "Bot statistics rendered e2e failed with exit code $LASTEXITCODE." }
Get-Item -LiteralPath "test-results\.last-run.json"
Get-Item -LiteralPath "tests\e2e\screenshots\bot-statistics-tortila-dedicated-desktop.png","tests\e2e\screenshots\bot-statistics-tortila-dedicated-mobile.png","tests\e2e\screenshots\bot-statistics-legacy-dedicated-desktop.png","tests\e2e\screenshots\bot-statistics-legacy-dedicated-mobile.png" | ForEach-Object {
  if ($_.LastWriteTime -lt $started) { throw "Stale bot statistics screenshot: $($_.FullName)" }
}
Remove-Item Env:E2E_PORT -ErrorAction SilentlyContinue
```

- Artifact expectations after a passing dedicated run:
  - `test-results/.last-run.json` exists and is newer than `$started`;
  - four fresh manual screenshots exist:
    - `tests/e2e/screenshots/bot-statistics-tortila-dedicated-desktop.png`
    - `tests/e2e/screenshots/bot-statistics-tortila-dedicated-mobile.png`
    - `tests/e2e/screenshots/bot-statistics-legacy-dedicated-desktop.png`
    - `tests/e2e/screenshots/bot-statistics-legacy-dedicated-mobile.png`
  - `test-results/<spec-case>/trace.zip` and `test-failed-1.png` should exist only on failure or retained-failure trace conditions;
  - run `npm run evidence:visual -- --inventory tests/e2e/screenshots` after screenshot-producing Playwright;
  - formal visual acceptance remains not green unless `npm run evidence:visual -- --manifest <review-manifest.json> tests/e2e/screenshots` passes with a reviewed manifest.
- Focused gates after implementation:

```powershell
npx vitest run tests/integration/bot-statistics-static.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts
npm run typecheck -w @wtc/web
npm run secret:scan
git diff --check
```

- Add `tests/integration/bot-readiness-builder.test.ts`, `tests/integration/bot-readiness-server-dto-static.test.ts`, and `tests/integration/bot-continuity-builder.test.ts` if worker heartbeat/readiness semantics change.
- `node scripts/gates.mjs e2e` can be run later for broader no-live-DB browser acceptance, but the minimal dedicated rendered statistics proof is the direct `npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop --project=mobile` command above.
- DB-backed admin selected-user matrix and managed worker continuity are not required for this dedicated mock/rendered proof unless the implementation changes populated DB scope, selected-user scenario semantics, or worker continuity acceptance.
- No background agents were spawned by this auditor, so there are no spawned agents to close and no N-agent claim is made.

## Risks
- The worktree is heavily dirty and the dedicated stats spec is untracked; this audit does not attribute ownership of existing dirty files.
- Current Playwright/Next processes and `test-results` artifacts were observed but not started or owned by this auditor. Treat them as diagnostic evidence only.
- The observed dedicated stats spec artifacts indicate current failures before screenshots; the gate is not green until rerun after the assertion fix.
- Screenshot filenames are stable and can be overwritten by future runs; artifact freshness must be checked against the owned run start time.
- Mock/default Playwright proves rendered labels, disabled live-control boundaries, and responsive layout only. It does not prove live DB ownership, provider reachability, exchange connectivity, live bot continuity, production deployment, or real worker freshness.
- Source-string integration tests are copy-sensitive. Intentional UI wording changes must update the relevant static tests instead of weakening safety assertions.

## Verification/tests
RUN:
- `git status --short --branch` - observed branch and dirty worktree before this handoff.
- `rg --files tests/e2e` - inspected e2e spec inventory.
- `rg --files tests/integration | rg "bot|statistics|render|e2e|static|admin|readiness"` - inspected integration/static test inventory.
- Read-only line inspection with `Get-Content`, `Select-String`, `Get-ChildItem`, `Test-Path`, and `rg` over the files listed above.
- `Test-Path -LiteralPath 'tests/e2e/bot-statistics.spec.ts'` - returned `True`.
- `git status --short -- 'tests/e2e/bot-statistics.spec.ts'` - observed the file is untracked.
- `Get-ChildItem tests/e2e/screenshots` filtered for statistics screenshots - observed broad/warning statistics screenshots, but no fresh dedicated `bot-statistics-*-dedicated-*.png` files.
- `Get-NetTCPConnection` for local e2e/dev ports - observed active listeners/connections on multiple ports including `3410`, `3411`, `3412`, `3420`, `3300`, `3310`, and `3457`.
- `Get-CimInstance Win32_Process` filtered for Playwright/Next - observed an existing external Playwright/Next lane for `tests/e2e/bot-statistics.spec.ts`; no process was stopped.
- Read-only `test-results` inspection - observed failure artifacts for the external bot-statistics run showing incorrect bot-name assertions.

NOT RUN / NOT GREEN:
- `npx playwright test tests/e2e/bot-statistics.spec.ts --project=desktop --project=mobile` - not run by this auditor; would start a dev server and write/overwrite screenshots/results.
- `npm run e2e`, `node scripts/gates.mjs e2e`, and broader Playwright specs - not run.
- `npx vitest run ...`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run typecheck -w @wtc/worker`, `npm run build -w @wtc/web`, `npm run secret:scan`, `npm run governance:check`, and `git diff --check` - not run by this read-only auditor.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - not run; current screenshots were not this auditor's owned artifacts.
- `npm run evidence:visual -- --manifest <review-manifest.json> tests/e2e/screenshots` - not run/not green; no reviewed visual manifest was created.
- `npm run e2e:admin-user-bots:db`, `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires explicit disposable Postgres/admin harness authorization.
- `npm run accept:worker:continuity`, `npm run accept:worker:continuity:managed`, `npm run worker:smoke`, `npm run worker:tick`, `npm run dev:worker` - not run; worker execution/DB acceptance is outside this read-only rendered-gate audit.
- Live bot start/stop/apply-config, live exchange ping, provider reachability probe, raw env/secret reads, DB migration/seed, SSH, tmux, systemd, deploy, production monitoring, Stripe/Axioma/LMS live gates - not run by safety scope and user instruction.

## Next actions
1. Correct the existing `tests/e2e/bot-statistics.spec.ts` bot-name assertions to the rendered labels (`Tortila Bot`, `Legacy Bot`) or assert the stable headings plus product pills/taglines without the wrong expanded names.
2. Tighten the shared no-live-control helper to reject live-control buttons named `/start|stop|apply|test connection/i`, reject `Connection verified`, and reject visible secret markers while allowing the intentional lowercase boundary sentence about runtime start/stop being absent.
3. Run the exact dedicated Playwright command in `## Decisions` on a confirmed free `E2E_PORT`.
4. Confirm the four dedicated screenshots are fresh and review them manually for desktop/mobile fit.
5. Run `npm run evidence:visual -- --inventory tests/e2e/screenshots`; use a reviewed manifest only if formal screenshot acceptance is required.
6. Run the focused static/typecheck/secret/diff gates listed above before declaring Phase 4.35 implementation green.
7. Do not claim DB-backed admin selected-user proof, managed worker continuity, live provider/exchange proof, or production readiness unless the corresponding opt-in gates are actually observed green in that implementation session.
