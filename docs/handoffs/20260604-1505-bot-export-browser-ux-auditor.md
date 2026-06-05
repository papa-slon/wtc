# bot-export-browser-ux-auditor handoff
## Scope
Phase 4.20 read-only UX/product audit before edits. Scope: inspect current Legacy/Tortila bot settings export/download UX and admin/user drilldown/settings flow after Phase 4.19, focusing on whether users can configure coins/stages/triggers simply, copy/download settings without confusion, and admins can view users, pub_id, settings, and statistics read-only without modifying personal settings.

This was a single foreground auditor lane. No background agents were launched from this side, no N-agent claim is made, and no background agents were left open.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md`
- `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`
- `docs/handoffs/20260604-1427-bot-settings-export-security-auditor.md`
- `docs/handoffs/20260604-1427-bot-settings-export-gates-auditor.md`
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md`
- `docs/handoffs/20260604-1349-phase-4-17-admin-runtimehealth-scenario-matrix.md`
- `docs/handoffs/20260604-0629-phase-3-99-admin-selected-user-drilldown-overview.md`
- `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- Existing retained screenshots:
  - `tests/e2e/screenshots/bot-tortila-settings-desktop.png`
  - `tests/e2e/screenshots/bot-tortila-settings-mobile.png`
  - `tests/e2e/screenshots/bot-legacy-settings-desktop.png`
  - `tests/e2e/screenshots/bot-legacy-settings-mobile.png`

## Files changed
None — read-only audit

## Findings
1. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:527`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:533`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:537`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:544`, `apps/web/src/features/bots/config-export-handler.ts:56`, `apps/web/src/features/bots/config-export-handler.ts:60`, `apps/web/src/features/bots/config-export-handler.ts:61`, `tests/e2e/bot-settings.spec.ts:197`, `tests/e2e/bot-settings.spec.ts:201`, `tests/e2e/bot-settings.spec.ts:204`, `tests/e2e/bot-settings.spec.ts:213`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:60` - Legacy export is now honest but still unavailable when no active provider pub_id is mapped. That prevents a Legacy user from downloading any saved WTC reference settings in the common zero-mapping state, even though the page lets them configure coins/stages/triggers. Recommendation: make a product decision for Phase 4.20: either allow a sanitized WTC-only Legacy reference JSON export without provider mapping, or add a first-class admin-mapping CTA/state that makes "configure now, download later" explicit; if export stays blocked, add a copyable sanitized summary so users are not dead-ended. Target part: Legacy settings export/download availability.

2. Severity P2 - evidence `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:318`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:323`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:327`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:632`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:636`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:645`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:646`, `tests/e2e/bot-settings.spec.ts:126`, `tests/e2e/bot-settings.spec.ts:128`, `tests/e2e/bot-settings.spec.ts:130`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:54`, `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md:59` - Tortila copy UX is implemented and source-labeled, but browser acceptance still proves the `data-copy-value` source rather than actual clipboard success/fallback state. A regression in `navigator.clipboard.writeText` handling or the visible "draft copied/copy manually" result could pass the current export tests. Recommendation: add a scoped Playwright assertion that grants clipboard permission or injects a clipboard stub, clicks `Copy draft SYMBOL_CONFIGS`, and verifies the exact copied string plus success/fallback pill. Target part: Tortila settings copy acceptance.

3. Severity P2 - evidence `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:336`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:380`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:529`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:585`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:620`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:280`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:313`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:352`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:560`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:616`, `tests/e2e/bot-settings.spec.ts:150`, `tests/e2e/bot-settings.spec.ts:216` - the settings surfaces are layout-safe, but the "simple configuration" path is still buried in long expert workbenches: Tortila exposes strategy map, portfolio caps, per-row technical fields, and runtime export preview; Legacy exposes trigger resolution, up to six visible coin cards from a 14-row model, advanced ladder/filter details, and a stage-capacity table. The current browser gate proves no horizontal scroll, not whether the primary coin/stage/trigger task is discoverable quickly. Recommendation: add a basic-mode or first-viewport task path that prioritizes coin, trigger/system, stage, risk, and save/export, with advanced ladders/caps collapsed behind explicit controls; add mobile acceptance that the primary action path is visible and usable without scanning the whole page. Target part: user bot settings simplicity.

4. Severity P1 - verified control. Evidence `apps/web/src/app/admin/users/[userId]/bots/page.tsx:201`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:203`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:222`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:223`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:224`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:258`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:410`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:494`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:512`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:616`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:619`, `tests/e2e/admin-user-bot-detail-db.spec.ts:226`, `tests/e2e/admin-user-bot-detail-db.spec.ts:227`, `tests/e2e/admin-user-bot-detail-db.spec.ts:228`, `tests/integration/admin-user-bot-detail-static.test.ts:120`, `tests/integration/admin-user-bot-detail-static.test.ts:125`, `tests/integration/admin-user-bot-detail-static.test.ts:127`, `tests/integration/admin-user-bot-detail-static.test.ts:128`, `tests/integration/admin-user-bot-detail-static.test.ts:129`, `tests/integration/admin-user-bot-detail-static.test.ts:130` - selected-user admin drilldown meets the read-only intent in source and tests: admin RBAC is required, banners say live control/user settings/provider mappings are read-only, the page summarizes resolved settings and persisted statistics, and tests assert no forms, CSRF fields, settings save actions, global-config save actions, or live start/stop/apply controls. Recommendation: preserve this route as an inspection-only page; any future pub_id mapping, settings edit, entitlement, or live-control workflow must stay on a separate audited surface. Target part: admin selected-user drilldown mutation boundary.

5. Severity P2 - evidence `apps/web/src/features/admin/user-bot-detail-loader.ts:891`, `apps/web/src/features/admin/user-bot-detail-loader.ts:921`, `apps/web/src/features/admin/user-bot-detail-loader.ts:931`, `apps/web/src/features/admin/user-bot-detail-loader.ts:967`, `apps/web/src/features/admin/user-bot-detail-loader.ts:978`, `apps/web/src/features/admin/user-bot-detail-loader.ts:996`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1018`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1086`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1090`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1105`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1122`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1123`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1124`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1125`, `apps/web/src/features/admin/user-bot-detail-loader.ts:1127` - admin selected-user statistics are scoped through persisted DB rows and Legacy provider-account mapping before rendering, which fits the goal of read-only user/pub_id/settings/statistics visibility. Recommendation: keep statistics sourced through this safe loader projection, and avoid adding direct adapter reads or provider queries to the admin render path. Target part: admin user statistics/source boundary.

6. Severity P2 - evidence `package.json:34`, `package.json:35`, `package.json:36`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:26`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:31`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:32`, `tests/e2e/admin-user-bot-detail-db.spec.ts:230` - populated admin user drilldown browser proof remains opt-in and excluded from default/local CI scripts, and the spec writes a screenshot only when that DB-backed run is executed. There is no retained `admin-user-bot-detail-db-*` screenshot in the current screenshot directory. Recommendation: when a disposable Postgres admin URL is explicitly available, run `npm run e2e:admin-user-bots:db:managed:matrix`, review/retain desktop and mobile screenshots, and record the artifact paths in the aggregate handoff; until then, do not claim rendered admin-user drilldown visual acceptance. Target part: admin user drilldown browser/visual proof.

## Decisions
- Kept this audit read-only except for this requested handoff artifact.
- Treated this as a per-agent foreground auditor handoff, not a broad implementation phase; no background agents were launched from this side per the user instruction.
- Did not run Playwright, Vitest, lint, typecheck, build, DB, worker, provider, or live commands because the task explicitly asked for read-only inspection before edits.
- Used current source and existing retained screenshots for UX inspection. The admin selected-user screenshot expected by the DB-backed spec was not present in `tests/e2e/screenshots` during this audit.
- Did not inspect raw env, raw secrets, live provider data, SSH, tmux, systemd, or deployment state.

## Risks
- This audit cannot prove runtime behavior or gate freshness because no executable tests were run.
- The settings pages are visually safe but extremely long; a task-completion usability issue can remain even while automated no-horizontal-scroll and text-presence assertions pass.
- Legacy export policy is still unresolved for users without mapped pub_id: the current UI avoids confusion, but it does not satisfy a broad "download my settings now" interpretation.
- Admin selected-user drilldown has strong read-only guardrails, but its full DB-backed rendered matrix still depends on an explicit throwaway Postgres run outside this audit.
- The worktree was heavily dirty before this audit; this handoff does not claim ownership of pre-existing modified/untracked files.

## Verification/tests
Read-only inspection RUN:
- Read protocol/governance docs and latest relevant handoffs listed above.
- `git status --short --branch` - observed current branch `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified/untracked files.
- Source/test grep and line-number inspection of bot settings export/copy code, admin user drilldown code, admin loader code, and related E2E/static tests.
- Visual inspection of existing retained settings screenshots for Tortila desktop/mobile and Legacy desktop/mobile.

Executable gates NOT RUN:
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop` - not run; read-only audit only, would start browser/server and may write screenshots/artifacts.
- `npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile` - not run; read-only audit only.
- Clipboard/real browser copy verification - not run; current audit inspected source and test coverage only.
- `npm run e2e:admin-user-bots:db:managed` - not run; requires explicit disposable admin Postgres URL and creates/drops throwaway DB resources.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; requires explicit disposable admin Postgres URL and creates/drops four scenario DBs.
- `npx playwright test -c playwright.admin-user-bots-db.config.ts` - not run; requires runner-created env and prepared marker.
- `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - not run; read-only audit only.
- `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm test`, `npm run build -w @wtc/web`, `node scripts/gates.mjs quick|core|full`, `npm run secret:scan`, `npm run governance:check` - not run; outside this read-only audit scope and some write retained logs/artifacts.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, managed DB acceptance, worker tick/continuity, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads, SSH/tmux/systemd/deploy - not run by scope and non-negotiable safety policy.

## Next actions
1. Decide the Legacy no-pub_id export policy first: allow sanitized WTC-only reference export, or keep blocked and add an explicit admin-mapping path plus copyable sanitized summary.
2. Add a true Tortila copy browser assertion for `navigator.clipboard.writeText` success/fallback and exact copied text.
3. Reduce first-run settings complexity by making the basic coin/stage/trigger path visibly primary, with advanced risk/caps/ladders collapsed or stepped.
4. When an explicit disposable Postgres admin URL is available, run the admin-user DB E2E matrix and retain reviewed screenshots before claiming rendered admin drilldown acceptance.
5. Keep `/admin/users/[userId]/bots` read-only; do not add personal settings or provider-mapping mutations to that page in the next implementation slice.
