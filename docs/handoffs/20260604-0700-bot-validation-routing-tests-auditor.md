# bot-validation-routing-tests-auditor handoff
## Scope
Read-only Phase 4.01 tests audit for bot setup/settings validation routing.

Inspected existing integration and Playwright coverage around bot settings/setup, row-level form validation, row/stage anchors, and the top `BotSetupControlCenter`. The requested Phase 4.01 change is narrowly scoped: when Tortila or Legacy validation issues are active, the top control center should surface the issue and link to the exact row or stage anchor.

No product code was edited. No live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB mutation, worker tick/restart, exchange ping, live bot start/stop/apply/retest, or live bot control was run.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`
8. `docs/handoffs/20260604-0640-bot-setup-control-center-tests-auditor.md`
9. `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
10. `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
14. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
15. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/features/bots/config-error-copy.ts`
18. `tests/integration/bot-config-review-static.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`
20. `tests/integration/bot-config-action-handler.test.ts`
21. `tests/e2e/bot-settings.spec.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The pages already compute safe `configError` from whitelisted query params and pass it into the top control center, so Phase 4.01 should test this wiring rather than add a loader/action. Evidence: settings builds `configError` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:232` and passes `activeIssue={configError ?? undefined}` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:248`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:231` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:268`. Recommendation: add a static assertion that both settings and setup pass `activeIssue` from `botConfigErrorCopy` into `BotSetupControlCenter`. Target part: `tests/integration/bot-config-review-static.test.ts`.
2. Severity: High. `BotSetupControlCenter` already contains the desired anchor mapping and prepends a `Validation issue` row, but existing tests do not lock the mapping. Evidence: `issueAnchor` maps `tortila-row` to `tortila-symbol-${issue.row}`, `legacy-row` to `legacy-symbol-${issue.row}`, and `legacy-stage` to `legacy-stage-${issue.row}` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:111`; `issueHref` falls back to the editor only for non-row/global issues at `apps/web/src/features/bots/BotSetupControlCenter.tsx:119`; active issues are inserted before all other rows at `apps/web/src/features/bots/BotSetupControlCenter.tsx:224`; the action link renders through `step.href` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:283`. Recommendation: add a focused source test for `Validation issue`, `Fix row`, `Fix stage`, and the three exact anchor mappings. Target part: `BotSetupControlCenter` static coverage.
3. Severity: High. The exact row/stage anchors already exist in the form surfaces, so rendered tests can verify real navigation without introducing DB/live gates. Evidence: Tortila row sections expose `id={`tortila-symbol-${i + 1}`}` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:88`; Legacy coin rows expose `id={`legacy-symbol-${i + 1}`}` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:142`; Legacy stage rows expose `id={`legacy-stage-${i + 1}`}` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:362`; row/stage alerts use `role="alert"` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:99` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:382`. Recommendation: extend `tests/e2e/bot-settings.spec.ts` to assert the control-center issue link href and click target for `#tortila-symbol-1`, `#legacy-symbol-1`, and `#legacy-stage-1`. Target part: focused rendered settings/setup validation routing.
4. Severity: High. Current action-handler tests already prove the redirect metadata is bounded and secret-free; Phase 4.01 should reuse this as a guardrail, not duplicate it in the UI test. Evidence: Tortila row and Legacy stage redirects are covered at `tests/integration/bot-config-action-handler.test.ts:169`; forbidden fields stay generic and do not preserve caller row focus at `tests/integration/bot-config-action-handler.test.ts:201`; first-form-issue classification is source-guarded at `tests/integration/bot-config-action-handler.test.ts:238`; `botConfigErrorRedirect` bounds rows through `safeRow` at `apps/web/src/features/bots/config-error-copy.ts:75` and `apps/web/src/features/bots/config-error-copy.ts:204`. Recommendation: keep `tests/integration/bot-config-action-handler.test.ts` in the focused gate; only extend it if Phase 4.01 changes redirect/copy helpers. Target part: redirect and query-param safety.
5. Severity: Medium. Rendered coverage currently checks row-local alerts after invalid saves, but not the top control-center issue row or any Legacy stage failure. Evidence: Tortila invalid save checks URL and `#tortila-symbol-1 [role="alert"]` at `tests/e2e/bot-settings.spec.ts:86`; Legacy row invalid save checks URL and `#legacy-symbol-1 [role="alert"]` at `tests/e2e/bot-settings.spec.ts:102`; no current Playwright assertion mentions `Validation issue`, `Fix row`, `Fix stage`, or a `legacy-stage-capacity` browser path. Recommendation: add the smallest rendered delta: enrich the existing Tortila/Legacy row tests, plus one new Legacy stage-capacity test using `input[name="legacy_stage_rsi_0"]` or `legacy_stage_cci_0` out of range. Target part: `tests/e2e/bot-settings.spec.ts`.
6. Severity: Medium. The change should stay presentation-only and links-only; the safety static test already gives the right no-live-control boundary. Evidence: `BotSetupControlCenter` renders read-only rows/links only at `apps/web/src/features/bots/BotSetupControlCenter.tsx:265`; its live boundary says live operations are unavailable at `apps/web/src/features/bots/BotSetupControlCenter.tsx:217`; `bot-read-safety-static.test.ts` forbids `getBotAdapter`, `fetch(`, `vault.open`, `startBot`, `stopBot`, `applyConfig`, `retest`, secret fields, and `Connection verified` in the bot readiness/control-center sources at `tests/integration/bot-read-safety-static.test.ts:137`. Recommendation: do not add Playwright DB, live exchange, adapter, or provider gates for this slice; run the existing safety static gate after the focused test edits. Target part: safety regression.

## Decisions
1. Recommend no new product-code architecture for tests: use existing `botConfigErrorCopy`, `BotSetupControlCenter`, row/stage IDs, and the existing `bot-settings.spec.ts` rendered route.
2. Recommend one focused static-source test addition for issue wiring and anchor mapping.
3. Recommend three rendered assertions: Tortila row, Legacy coin row, and Legacy stage row.
4. Do not recommend full e2e, DB-backed populated admin-user bot gates, live exchange ping, provider reads, or live bot controls for Phase 4.01.
5. Treat `tests/integration/bot-config-action-handler.test.ts` as the redirect-safety source of truth; UI tests should verify rendering/navigation only.

## Risks
1. The branch was already heavily dirty/untracked before this audit, including target product files, test files, and many handoffs. Findings are based on the current dirty tree.
2. The current dirty tree already appears to contain `activeIssue` plumbing in `BotSetupControlCenter`; the remaining acceptance gap is test proof, not necessarily implementation.
3. Static source assertions are intentionally narrow and can become brittle if the component is refactored; keep them to the safety-critical mapping and page wiring only.
4. Playwright writes screenshots in `tests/e2e/bot-settings.spec.ts`, so rendered proof should use a fresh `E2E_PORT` and be run intentionally after implementation.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and recent Phase 4.00 handoffs.
2. Inspected current setup/settings pages, the control center, Tortila/Legacy config tables, config error copy, first-form issue classification, and focused integration/e2e tests with read-only shell commands.
3. Checked current branch/status before writing; branch is `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified/untracked files.
4. Confirmed this requested handoff path did not already exist before writing.

NOT RUN:
1. Vitest - not run; this was a read-only recommendation audit.
2. Playwright/e2e - not run; it starts a local web server and writes screenshot artifacts.
3. Full `npm test`, lint, typecheck, build, secret scan, coverage, governance - not run; no product code was changed.
4. Live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB reads/writes, worker tick/restart, exchange ping, live bot start/stop/apply/retest/control - not run by scope.
5. Git staging, commit, push, or PR - not requested.

Recommended focused Phase 4.01 gates:

```powershell
npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts
```

```powershell
$env:E2E_PORT = '3429'
npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line
```

Optional if implementation touches TypeScript types or broader files:

```powershell
npm exec tsc -- -p apps/web/tsconfig.json --noEmit
npm exec eslint -- apps/web/src/features/bots/BotSetupControlCenter.tsx apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/e2e/bot-settings.spec.ts --max-warnings 0
```

## Next actions
1. In `tests/integration/bot-config-review-static.test.ts`, assert both pages pass `activeIssue={configError ?? undefined}` and the control center maps active issues to `#tortila-symbol-N`, `#legacy-symbol-N`, and `#legacy-stage-N`.
2. In `tests/e2e/bot-settings.spec.ts`, extend the existing Tortila invalid-row test to assert the top `Validation issue` row has a `Fix row` link with `href="#tortila-symbol-1"` and that clicking it lands on the row alert.
3. In `tests/e2e/bot-settings.spec.ts`, extend the existing Legacy invalid-row test to assert the top `Validation issue` row has `href="#legacy-symbol-1"`.
4. Add one small Legacy stage-capacity rendered test that fills a stage capacity input out of range, expects `issue=legacy-stage-capacity&row=1`, and verifies the top `Fix stage` link targets `#legacy-stage-1`.
5. Keep Phase 4.01 out of live bot, provider, DB mutation, exchange ping, and adapter-control scope.
