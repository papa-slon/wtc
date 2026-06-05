# ecosystem-tests-runner handoff

## Scope
Read-only Phase 4.11 tests audit for admin runtime evidence ladders on the admin bot fleet page and selected-user bot detail page. Scope was limited to identifying focused gates/tests that prove the ladders are read-only, derived from persisted WTC evidence, secret-safe, and not misleading "current runtime" or live-control claims. No product or test files were edited.

Note: while auditing, the current tree already contained a new admin-specific `AdminBotRuntimeEvidencePanel` and admin page wiring. I treated those as pre-existing/concurrent workspace changes and audited the current files without reverting or modifying them.

## Files inspected
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
- Supporting current-tree files for exact gates: `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`, `package.json`, `scripts/run-admin-user-bot-detail-e2e.mjs`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs`, `playwright.admin-user-bots-db.config.ts`

## Files changed
None - read-only audit except this handoff: `docs/handoffs/20260604-1049-admin-runtime-evidence-tests-auditor.md`.

## Findings
1. Severity: HIGH. DB-backed selected-user Playwright acceptance does not yet prove the new selected-user evidence ladders render.
   Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:292` renders `AdminBotRuntimeEvidencePanel`, with title/copy/metrics/rows at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:293-297`. The DB E2E visible markers stop at overview/warnings/provider mapping text in `tests/e2e/admin-user-bot-detail-db.spec.ts:13-41`, and the runtime assertions at `tests/e2e/admin-user-bot-detail-db.spec.ts:112-135` do not assert `Selected-user evidence ladder`, `Read-only admin evidence`, or the ladder row labels.
   Recommendation: in `tests/e2e/admin-user-bot-detail-db.spec.ts`, add visible markers and explicit Playwright assertions for `Selected-user evidence ladder` count 2, `Read-only admin evidence` count 2, `Entitlement gate`, `WTC settings source`, `Runtime scope`, `User-scoped statistics`, `Admin boundary`, and `view-only drilldown`; keep the existing hidden markers/no-form/no-live-button checks.
   Target part: selected-user DB browser acceptance.

2. Severity: HIGH. The admin fleet ladder is wired in source but has no browser smoke coverage.
   Evidence: `apps/web/src/app/admin/bots/page.tsx:305-310` renders `Admin fleet evidence ladder`. Existing smoke covers user bot evidence at `tests/e2e/smoke.spec.ts:30-34`, admin entitlements/TradingView at `tests/e2e/smoke.spec.ts:45-58`, and admin users/system-health/support at `tests/e2e/smoke.spec.ts:170-195`, but does not navigate to `/admin/bots`.
   Recommendation: add a `/admin/bots` leg to `tests/e2e/smoke.spec.ts` after `loginAdmin(page)`: assert `Bot fleet`, `LIVE CONTROL: DISABLED`, `Admin fleet evidence ladder`, `Fleet health row`, `Tortila owner snapshots`, `Legacy pub_id scope`, `Admin boundary`, and no buttons matching `/start|stop|apply|retest|test connection/i`; capture a screenshot such as `admin-bots-runtime-evidence`.
   Target part: admin fleet smoke/visual acceptance.

3. Severity: MEDIUM. Loader no-mutation checks do not count `integration_health_checks`, even though the new evidence ladders depend on health rows.
   Evidence: `tests/integration/admin-bot-health-loader.test.ts:22-34` counts users/instances/mappings/metrics only, while `apps/web/src/features/admin/bot-health-loader.ts:199-219` reads `integrationHealthChecks` and `apps/web/src/features/admin/bot-health-loader.ts:323-338` maps health detail into the admin result. `tests/integration/admin-user-bot-detail-loader.test.ts:34-58` likewise omits health rows, while `apps/web/src/features/admin/user-bot-detail-loader.ts:868-877` reads selected product health rows and `apps/web/src/features/admin/user-bot-detail-loader.ts:986-994` builds `healthByProduct`.
   Recommendation: add `integrationHealthChecks` to both loader-test `tableCounts()` helpers and keep before/after equality assertions. Add focused assertions that stale/not_configured health remains a persisted-read state, does not call or write new health checks, and redacts secret-like detail strings.
   Target part: Vitest loader no-mutation and evidence-source contract.

4. Severity: MEDIUM. Static checks for the admin evidence panel should pin "persisted evidence only" and "not current runtime" semantics more tightly.
   Evidence: `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:18-29` is a generic pass-through component, and it renders caller-provided copy/rows at `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:34-38` and `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:52-68`. Fleet copy currently says it is "not live-control proof" at `apps/web/src/app/admin/bots/page.tsx:305-310`, and selected-user copy says "inspection evidence, not permission to mutate" at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:292-298`. Current static coverage in `tests/integration/admin-user-bot-detail-static.test.ts:127-164` checks presence and several forbidden identifiers, but does not reject `fetch(`, env/DB URL usage, `retest`, `current runtime`, `live now`, or synchronous probe wording. The central safety loop at `tests/integration/bot-read-safety-static.test.ts:227-229` also excludes the admin pages/panel, while `tests/integration/bot-read-safety-static.test.ts:320-345` mostly asserts presence.
   Recommendation: extend the admin static test and central read-safety test to include `adminEvidencePanel`, `adminBots`, and the selected-user admin page in forbidden-regex checks: `getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|apiKey|apiSecret|sealed|Connection verified|process\.env|DATABASE_URL|LEGACY_DATABASE_URL|current runtime|live now|live probe`. Also assert required positive copy: `latest worker check only`, `does not probe the journal during render`, `bot_metric_snapshots pending`, `inspection evidence, not permission to mutate`, and `view-only drilldown`.
   Target part: static guardrails against misleading runtime claims.

5. Severity: LOW. The admin-specific panel choice should remain pinned so future work does not reuse the user-facing `BotRuntimeEvidencePanel` where "current user scope" would be misleading on fleet pages.
   Evidence: the user-facing panel expects `BotHealth` and user bot props at `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:7-18`, and its scoped row says `current user scope` at `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx:101-104`. The admin pages correctly import `AdminBotRuntimeEvidencePanel` at `apps/web/src/app/admin/bots/page.tsx:7` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:6`.
   Recommendation: add/keep static assertions that admin pages import `AdminBotRuntimeEvidencePanel` and do not import `BotRuntimeEvidencePanel`; keep `tests/integration/bot-statistics-static.test.ts:94-102` focused on the user/statistics ladder only.
   Target part: admin/user runtime-evidence component boundary.

## Decisions
- Recommend an admin-specific evidence panel rather than adapting `BotRuntimeEvidencePanel`, because admin fleet evidence has owner/mapping/snapshot semantics rather than a single current-user `BotHealth` contract.
- Treat evidence ladders as display-only views over persisted `integration_health_checks`, `bot_metric_snapshots`, `bot_position_snapshots`, `bot_trade_imports`, entitlements, and sanitized provider mappings.
- Browser acceptance should prove both desktop and mobile selected-user render through the existing DB E2E harness, and admin fleet render through smoke in demo/postgres-safe mode.
- No live services, DB mutations, worker ticks, provider/API/exchange calls, env/secret reads, deploy, SSH, tmux, or systemd actions were run in this audit.

## Risks
- The worktree is already very dirty and changed during this audit; all implementation/test changes observed here are treated as pre-existing or concurrent.
- Static source assertions are intentionally brittle but useful for safety boundaries; they should be paired with Playwright render checks.
- The DB E2E managed gate creates and drops a throwaway local Postgres database and starts a local web server; it must never point at production or shared state.
- This audit did not verify screenshots or run tests, so layout regressions, TypeScript errors, and hidden import issues remain unproven until the gates below run.

## Verification/tests
Run in this audit:
- File inspection only: `git status --short --branch`, targeted `rg`, line-numbered PowerShell `Get-Content`, and package/script inspection.

Not run in this audit:
- Vitest, Playwright, typecheck, lint, secret scan, build, DB E2E, smoke, worker ticks, or live services.

Recommended exact gates after test additions:
1. Focused Vitest:
   `npm test -- tests/integration/admin-bot-health-loader.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts`
2. Typecheck:
   `npm run typecheck`
3. Lint:
   `npm run lint`
4. Secret scan:
   `npm run secret:scan`
5. Diff whitespace/syntax gate:
   `git diff --check -- "apps/web/src/app/admin/bots/page.tsx" "apps/web/src/app/admin/users/[userId]/bots/page.tsx" "apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx" "apps/web/src/features/admin/bot-health-loader.ts" "apps/web/src/features/admin/user-bot-detail-loader.ts" "tests/integration/admin-bot-health-loader.test.ts" "tests/integration/admin-user-bot-detail-loader.test.ts" "tests/integration/admin-user-bot-detail-static.test.ts" "tests/integration/bot-read-safety-static.test.ts" "tests/e2e/admin-user-bot-detail-db.spec.ts" "tests/e2e/smoke.spec.ts"`
6. DB-backed selected-user Playwright, using only a local throwaway maintenance DB URL:
   `$env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL='<local postgres maintenance url>'; npm run e2e:admin-user-bots:db:managed; Remove-Item Env:ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`
7. Smoke Playwright after adding `/admin/bots` assertions:
   `npm run e2e -- tests/e2e/smoke.spec.ts`

## Next actions
1. Add selected-user DB E2E assertions for the two rendered `Selected-user evidence ladder` panels and their layer labels.
2. Add `/admin/bots` to smoke with fleet ladder, read-only, and no-live-control assertions.
3. Extend loader table-count helpers to include `integrationHealthChecks`, then add stale/not_configured health evidence assertions.
4. Tighten static forbidden-regex coverage for admin evidence panel/pages and pin no `fetch`, env/DB URL reads, `retest`, or "current runtime/live now" language.
5. Run the focused Vitest, typecheck, lint, secret, diff, DB E2E, and smoke gates listed above; report exact run/not-run status with reasons.
