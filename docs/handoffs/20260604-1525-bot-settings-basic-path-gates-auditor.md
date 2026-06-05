# bot-settings-basic-path-gates-auditor handoff
## Scope
Phase 4.21 read-only tests/gates audit before edits.

Scope inspected current tests/gates for bot settings first-viewport/basic-path usability, page-level no-horizontal-scroll, export/copy behavior, and save validation. The output is focused recommendations for a Phase 4.21 implementation. This audit did not edit code, did not run executable gates, did not start a dev server/browser, did not inspect raw env/secrets, and did not call live bot, exchange, provider, SSH, tmux, systemd, deploy, DB migrate, or DB seed paths.

No background agents were spawned from this auditor lane, per operator instruction. No N-agent claim is made.

Current branch observed before this handoff: `codex/bot-analytics-settings-canary-20260603`. The checkout was already heavily dirty with many modified and untracked files before this audit; those pre-existing changes were not reverted or cleaned.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1354-bot-browser-settings-gates-auditor.md`
- `docs/handoffs/20260604-1427-bot-settings-export-gates-auditor.md`
- `docs/handoffs/20260604-1427-bot-settings-export-ux-auditor.md`
- `docs/handoffs/20260604-1455-phase-4-19-bot-settings-export-copy.md`
- `docs/handoffs/20260604-1505-bot-export-browser-gates-auditor.md`
- `docs/handoffs/20260604-1505-bot-export-browser-ux-auditor.md`
- `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md`
- `package.json`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/warning-summary-visual.spec.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-config-action-handler.test.ts`
- `tests/integration/bot-config-review-static.test.ts`
- `tests/integration/bot-config-source-audit-static.test.ts`
- `tests/integration/bot-runtime-config-sanitizer.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/user-resolved-bot-config-static.test.ts`
- `tests/integration/admin-global-bot-config-static.test.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`

## Files changed
None -- read-only audit. Required handoff artifact written at `docs/handoffs/20260604-1525-bot-settings-basic-path-gates-auditor.md`.

## Findings
1. Severity: High. Evidence: the current settings route renders header/control-center/readiness/continuity/source/review/operation/export/profile blocks before the editable config form starts at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:269` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:583`; the save button is at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:638` to `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:640`. The main browser test proves many workbench facts at `tests/e2e/bot-settings.spec.ts:76` to `tests/e2e/bot-settings.spec.ts:217`, but it does not assert a first-viewport basic path; Phase 4.20 explicitly deferred this at `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md:92` to `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md:95`. Recommendation: add a dedicated basic path surface before the long expert workbench, then add focused static assertions in a new `tests/integration/bot-settings-basic-path-static.test.ts` or the nearest bot-config static test:
   - `expect(settingsPage).toContain('id="settings-basic-path"')`
   - `expect(settingsPage.indexOf('id="settings-basic-path"')).toBeLessThan(settingsPage.indexOf('id="custom-settings"'))`
   - `expect(settingsPage).toContain('name="symbol_custom_0"')`
   - `expect(settingsPage).toContain('name="risk_0"')`
   - `expect(settingsPage).toContain('name="legacy_signal_0"')`
   - `expect(settingsPage).toContain('name="legacy_stage_0"')`
   - `expect(settingsPage).toContain('Save custom settings')`
   - `expect(settingsPage).not.toContain('applyConfig')`
   - `expect(settingsPage).not.toContain('startBot')`
   - `expect(settingsPage).not.toContain('stopBot')`
   Add focused Playwright assertions that visit `/app/bots/tortila/settings` and `/app/bots/legacy/settings`, assert `#settings-basic-path` is visible in the initial viewport on desktop and mobile, then assert the basic controls for coin, system/trigger, risk/stage, save, and export/copy are visible without opening advanced details. Target part: first-viewport/basic bot settings path.

2. Severity: Medium. Evidence: current bot settings no-scroll coverage uses a boolean helper only at `tests/e2e/bot-settings.spec.ts:6` to `tests/e2e/bot-settings.spec.ts:10`, then checks page-level no-scroll after long paths at `tests/e2e/bot-settings.spec.ts:150`, `tests/e2e/bot-settings.spec.ts:216`, `tests/e2e/bot-settings.spec.ts:239`, `tests/e2e/bot-settings.spec.ts:313`, `tests/e2e/bot-settings.spec.ts:365`, `tests/e2e/bot-settings.spec.ts:387`, `tests/e2e/bot-settings.spec.ts:408`, `tests/e2e/bot-settings.spec.ts:431`, `tests/e2e/bot-settings.spec.ts:469`, `tests/e2e/bot-settings.spec.ts:484`, and `tests/e2e/bot-settings.spec.ts:513`. Default mobile Playwright width is 390px at `playwright.config.ts:25`, not the 375px style used in older PG mobile checks. A better offender-reporting helper already exists at `tests/e2e/warning-summary-visual.spec.ts:6` to `tests/e2e/warning-summary-visual.spec.ts:28`. Recommendation: copy the offender-reporting helper into `bot-settings.spec.ts` or a shared e2e helper, then add exact Phase 4.21 browser assertions:
   - after each basic path page load and after each save/copy/export interaction, call `await expectNoHScroll(page, '<bot> basic path <viewport>')`
   - inside the mobile project, additionally run `await page.setViewportSize({ width: 375, height: 812 })` for `/app/bots/tortila/settings` and `/app/bots/legacy/settings`
   - assert all visible boxes under `#settings-basic-path` stay within viewport using the `expectVisibleBoxesInsideViewport` pattern from the same visual spec
   Target part: responsive no-horizontal-scroll diagnostics for the new basic settings path.

3. Severity: Medium. Evidence: Tortila copy UI writes through `navigator.clipboard.writeText` and surfaces `draft copied` or `copy manually` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:318` to `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:329` and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:620` to `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:647`. Current browser coverage asserts the exact draft preview and `data-copy-value` at `tests/e2e/bot-settings.spec.ts:123` to `tests/e2e/bot-settings.spec.ts:130`, but it does not click the button or prove clipboard success/fallback; Phase 4.20 lists clipboard proof as NOT RUN at `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md:140` to `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md:142`. Recommendation: add two focused Playwright assertions in the basic-path test:
   - success path: inject a `navigator.clipboard.writeText` stub before navigation, click `Copy draft SYMBOL_CONFIGS`, assert the captured string equals the rendered `Generated SYMBOL_CONFIGS draft` text and includes the edited `XRP/USDT:USDT@4h@1@0.007@2@1@4@20@0`, then assert `draft copied` is visible
   - fallback path: inject no clipboard or a rejecting clipboard stub, click the same button, assert `copy manually` is visible and no unsafe export markers are present in visible body text
   Keep static coverage that the copy button is `type="button"` and not a submit/live-control affordance. Target part: Tortila draft copy acceptance.

4. Severity: Medium. Evidence: export route and browser API coverage are strong: `tests/e2e/bot-settings.spec.ts:131` to `tests/e2e/bot-settings.spec.ts:148` checks Tortila export status/headers/body/unsafe markers, and `tests/e2e/bot-settings.spec.ts:197` to `tests/e2e/bot-settings.spec.ts:215` checks Legacy disabled UI plus 403 `provider_mapping_required`. Extracted route tests cover 401, entitlement denial, Legacy provider mapping, attachment headers, and unsafe markers at `tests/integration/bot-config-export-route-handler.test.ts:141` to `tests/integration/bot-config-export-route-handler.test.ts:285`; static export wiring is locked at `tests/integration/bot-config-export-static.test.ts:17` to `tests/integration/bot-config-export-static.test.ts:75`. The remaining gap for Phase 4.21 is basic-path placement and, if download-event proof is claimed, rendered-link download bytes. Recommendation: keep the current route/API assertions, add static assertions that the new `#settings-basic-path` contains or links to `Download last saved reference export` and the Legacy `Export requires mapped pub_id` blocked state, and add optional Playwright download-event proof only if retained download artifacts are discarded or scanned:
   - click `Download last saved reference export`
   - assert `download.suggestedFilename()` is `wtc-tortila-config.env`
   - read the temporary downloaded bytes, assert `# WTC Tortila Bot reference export`, `SYMBOL_CONFIGS=`, and `expectNoUnsafeExportMarkers(body)`
   - keep Legacy as disabled UI plus direct 403 API assertion, not a download event
   Target part: export/download proof for the basic path.

5. Severity: Medium. Evidence: save validation coverage is broad for invalid paths and no-write safety. E2E covers Tortila row risk errors at `tests/e2e/bot-settings.spec.ts:220` to `tests/e2e/bot-settings.spec.ts:240`, Tortila portfolio/risk/throttle errors at `tests/e2e/bot-settings.spec.ts:293` to `tests/e2e/bot-settings.spec.ts:343`, Legacy row errors at `tests/e2e/bot-settings.spec.ts:345` to `tests/e2e/bot-settings.spec.ts:366`, Legacy stage errors at `tests/e2e/bot-settings.spec.ts:368` to `tests/e2e/bot-settings.spec.ts:388`, and setup row errors at `tests/e2e/bot-settings.spec.ts:390` to `tests/e2e/bot-settings.spec.ts:409`. Static/action tests cover successful custom saves, forbidden fields before persistence, safe redirects, and no-write locked/default failures at `tests/integration/bot-config-action-handler.test.ts:130` to `tests/integration/bot-config-action-handler.test.ts:235`, `tests/integration/bot-config-action-handler.test.ts:272` to `tests/integration/bot-config-action-handler.test.ts:310`, and `tests/integration/bot-config-action-handler.test.ts:376` to `tests/integration/bot-config-action-handler.test.ts:412`. Recommendation: Phase 4.21 should not add a new save endpoint; it should route the first-viewport/basic path through the existing `saveBotConfigAction` and field names. Add Playwright assertions for successful basic saves before the invalid cases:
   - Tortila: from `#settings-basic-path`, fill `symbol_custom_0`, `system_0`, and `risk_0` with valid values, click `Save custom settings`, assert the URL does not contain `err=config`, assert `Configuration was not saved` has count 0, and assert a custom/source/version indicator is visible
   - Legacy: from `#settings-basic-path`, select `legacy_signal_0`, fill `legacy_stage_0` within range, click `Save custom settings`, assert no `err=config`, no `Configuration was not saved`, and no live-control strings
   - Then keep the existing invalid assertions but scope at least one Tortila row-risk and one Legacy stage-capacity failure through the new basic path so first-viewport validation and focus routing are proven
   Target part: basic save success and focused validation.

6. Severity: Medium. Evidence: local gate scripts exist at `package.json:12` to `package.json:48`; default Playwright is safe-local/mock with `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, no stale server reuse, and desktop/mobile projects at `playwright.config.ts:23` to `playwright.config.ts:40`; aggregate `scripts/gates.mjs` writes `logs/gates/*` at `scripts/gates.mjs:20` to `scripts/gates.mjs:27` and includes `db:generate` in `core/full` at `scripts/gates.mjs:48` to `scripts/gates.mjs:53`. Recommendation: after Phase 4.21 edits, use focused static/browser gates rather than broad DB/full gates first:
   - `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts`
   - include the new `tests/integration/bot-settings-basic-path-static.test.ts` in that command if created
   - `npx playwright test tests/e2e/bot-settings.spec.ts -g "basic path" --project=desktop`
   - `npx playwright test tests/e2e/bot-settings.spec.ts -g "basic path" --project=mobile`
   - then `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench" --project=desktop` and `--project=mobile` as regression coverage
   Target part: Phase 4.21 focused gate plan.

## Decisions
- Treated this as one foreground read-only tests/gates auditor handoff, not a broad implementation phase.
- Did not spawn background agents, per operator instruction.
- Did not run Playwright, Vitest, lint, typecheck, build, secret scan, gate runner, dev server, worker, DB, live provider, or deploy commands.
- Did not read raw env files or secrets.
- Recommended new assertions around stable ids/field names (`#settings-basic-path`, `#custom-settings`, current input names) because the existing e2e suite already uses route text, field names, and element ids rather than snapshot-only proof.
- Recommended keeping existing export/API and invalid-save coverage, then adding only the missing first-viewport, clipboard, download-event-if-claimed, 375px, and successful-save checks.

## Risks
- This audit is source/test inspection only; no runtime behavior is proven green in this session.
- Line numbers reflect the current heavily dirty checkout and can drift before Phase 4.21 implementation.
- The exact `#settings-basic-path` id is a proposed stable target for Phase 4.21; if the implementation chooses another stable id, update the proposed assertions consistently.
- Browser download-event tests can create temporary download artifacts; do not retain bytes/screenshots/traces as evidence unless they are scanned/reviewed.
- Clipboard stubbing must stay local to the test page and must not weaken the existing unsafe-marker checks.
- 390px mobile coverage remains useful, but it is not the same as explicit 375px proof for the new basic path.

## Verification/tests
Gates RUN this session:
- None. This session performed read-only inspection and wrote only this required handoff.

Inspection commands RUN this session:
- `Select-String -Path 'C:\Users\maxib\.codex\memories\MEMORY.md' -Pattern 'WTC|bot settings|bot_settings|Phase 4.21|handoff|wtc_ecosystem_platform' -Context 2,2`
- `Get-ChildItem -Force`
- `git status --short --branch`
- `Get-Content` reads of `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, latest relevant handoffs, Playwright configs, tests, and scoped source files.
- Targeted `rg` searches for bot settings, export/copy, validation, no-scroll, Playwright, and handoff evidence.
- `Test-Path -LiteralPath 'docs\handoffs\20260604-1525-bot-settings-basic-path-gates-auditor.md'`.

Commands NOT RUN this session:
- `npx vitest run tests/integration/bot-config-export-static.test.ts tests/integration/bot-config-export-route-handler.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts`
- `npx vitest run tests/integration/bot-settings-basic-path-static.test.ts` -- not present yet; recommended for Phase 4.21 if created.
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "basic path" --project=desktop`
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "basic path" --project=mobile`
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench" --project=desktop`
- `npx playwright test tests/e2e/bot-settings.spec.ts -g "bot settings workbench" --project=mobile`
- Clipboard success/fallback Playwright proof.
- Rendered-link download-event Playwright proof.
- `npm run lint`
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm test`
- `npm run build -w @wtc/web`
- `npm run secret:scan`
- `npm run governance:check`
- `node scripts/gates.mjs quick`
- `node scripts/gates.mjs core`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`
- `npm run e2e`
- `npm run e2e:admin-user-bots:db`
- `npm run e2e:admin-user-bots:db:managed`
- `npm run e2e:admin-user-bots:db:managed:matrix`
- `npm run worker:tick`
- `npm run worker:smoke`
- `npm run accept:worker:continuity`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run db:seed`
- Any live bot start/stop/apply-config, exchange/provider call, raw env read, raw secret read, SSH, tmux, systemd, deploy, or live server mutation.

## Next actions
1. Implement a stable first-viewport/basic settings path with `#settings-basic-path`, using existing safe field names and `saveBotConfigAction`; keep advanced ladders/caps/expert tables reachable but not required for the first task path.
2. Add the focused static assertions listed in Findings 1, 3, 4, and 5, preferably in a new `tests/integration/bot-settings-basic-path-static.test.ts` plus existing bot-config safety files.
3. Add focused Playwright basic-path tests for Tortila and Legacy across desktop, default mobile, and explicit 375px mobile no-scroll checks.
4. Add clipboard success/fallback assertions for `Copy draft SYMBOL_CONFIGS`; add rendered-link download-event proof only if the phase intends to claim actual browser download bytes.
5. Run the focused static command first, then the basic-path Playwright desktop/mobile commands, then the existing workbench Playwright regression commands; record exact RUN/NOT RUN gates in the Phase 4.21 aggregate handoff.
