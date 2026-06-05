# legacy-stage-capacity-advisory-tests-auditor handoff
## Scope
Phase 4.03 read-only tests audit for Legacy stage capacity advisory coverage after Phase 4.02.

Scope was limited to current tests and nearby source around a safe top-control advisory when active Legacy RSI/CCI usage exceeds configured stage capacity. The audit recommends the smallest focused static and Playwright tests for settings/setup coverage and no-live-control guardrails.

No product code, test code, live bot services, provider state, secrets, env files, SSH, tmux, systemd, worker ticks, live pings, start/stop/apply/retest, or DB mutation were touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0714-phase-4-01-bot-validation-routing.md`
8. `docs/handoffs/20260604-0721-bot-validation-focus-tests-auditor.md`
9. `docs/handoffs/20260604-0729-phase-4-02-bot-validation-focus.md`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/bots/config-review.ts`
12. `apps/web/src/features/bots/config-error-copy.ts`
13. `apps/web/src/features/bots/config-action-handler.ts`
14. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
15. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
18. `tests/e2e/bot-settings.spec.ts`
19. `tests/integration/bot-config-review-static.test.ts`
20. `tests/integration/bot-read-safety-static.test.ts`
21. `tests/integration/bot-config-action-handler.test.ts`
22. `tests/integration/legacy-provider-worker.test.ts`
23. `tests/integration/bot-runtime-config-sanitizer.test.ts`
24. `package.json`
25. `playwright.config.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. Legacy over-capacity currently exists as a local table visual state only; it is not surfaced as a top-control advisory. Evidence: the table counts active rows by stage/signal in `stageUsageRows` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:45`, computes stage usage from rows at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:101`, and renders `over capacity` from `overRsi || overCci` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:377` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:383`. Recommendation: add a pure, exported advisory helper such as `deriveLegacyStageCapacityAdvisories(rows, stages)` near `config-review.ts` or a small shared bot config helper, then cover it with a focused static/integration test for active-only rows, inactive rows ignored, RSI vs CCI buckets, first over-capacity stage row, and advisory copy/href data. Target part: Legacy stage capacity advisory derivation.

2. Severity: High. Do not reuse `legacy-stage-capacity` for the new over-usage advisory; that code already means hard numeric validation for stage capacity fields. Evidence: `legacy-stage-capacity` is whitelisted at `apps/web/src/features/bots/config-error-copy.ts:59`, maps to "RSI and CCI capacities must be whole numbers from 0 to 50" at `apps/web/src/features/bots/config-error-copy.ts:181`, and is emitted when `legacyStageConfigSchema` rejects `rsiSlots`/`cciSlots` at `apps/web/src/features/bots/config.ts:121` and `apps/web/src/features/bots/config.ts:554`. Recommendation: keep over-usage advisory separate from `BotConfigErrorCopy` hard errors, or introduce a distinct advisory key like `legacy-stage-over-capacity` that never flows through `botConfigErrorRedirect`. Add a static/action test proving a valid numeric over-capacity form does not redirect to `err=config&issue=legacy-stage-capacity`. Target part: error/advisory contract.

3. Severity: High. The save pipeline blocks only `formIssues` / parse failures today, so the advisory should not become a save blocker unless product explicitly changes semantics. Evidence: settings/setup wire `botConfigFormIssues` and `botConfigFirstFormIssue` into the save action at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:111` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:78`; `handleSaveBotConfigAction` redirects when `issues.length > 0` at `apps/web/src/features/bots/config-action-handler.ts:169`; `botConfigFormIssues` only validates schema/duplicates and returns issues at `apps/web/src/features/bots/config.ts:564` through `apps/web/src/features/bots/config.ts:640`. Recommendation: add a focused `bot-config-action-handler` or config helper test with valid low capacity and too many active RSI/CCI rows that still reaches `persistConfig`, while the new advisory helper returns a warning. Target part: save behavior and advisory-not-blocking proof.

4. Severity: High. The top control center currently has one hard-error slot, `activeIssue`, and prepends `Validation issue` with bad tone; an over-capacity advisory needs a separate warn row. Evidence: `BotSetupControlCenterProps` exposes only `activeIssue?: BotConfigErrorCopy` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:36`; `buildSteps` consumes capacity as plain metric text at `apps/web/src/features/bots/BotSetupControlCenter.tsx:168` and `apps/web/src/features/bots/BotSetupControlCenter.tsx:195`; hard issues prepend `Validation issue` / `Needs fix` / bad tone at `apps/web/src/features/bots/BotSetupControlCenter.tsx:229`. Recommendation: add a small `advisories` or `capacityAdvisory` prop and static test that it renders a warn-toned row such as `Capacity advisory`, links to the first affected stage, and leaves `Validation issue` reserved for save-blocking errors. Target part: `BotSetupControlCenter` static/source coverage.

5. Severity: Medium. Settings and setup already have the data plumbing needed for a focused rendered advisory test, so no DB/live/provider gate is needed. Evidence: settings derives `legacyRows`/`legacyStages`, builds review metrics, and passes them to the control center/table at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:217`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:262`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:549`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:215`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:222`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:282`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:524`. Recommendation: add two narrow Playwright assertions in `tests/e2e/bot-settings.spec.ts`: one for `/app/bots/legacy/settings` and one for `/app/bots/legacy/setup?step=strategy`, each proving the advisory row is visible, links to `#legacy-stage-1` or the first affected stage, lands on the stage table, shows `over capacity`, has no horizontal scroll, and does not show hard-validation text unless a real save error is active. Target part: settings/setup rendered coverage.

6. Severity: Medium. Existing no-live-control guardrails are good and should be extended to the advisory surface. Evidence: current static safety forbids adapter/network/control/secret-shaped tokens across readiness/control-center sources at `tests/integration/bot-read-safety-static.test.ts:156`; review static coverage forbids live-control/provider raw fields in control/review surfaces at `tests/integration/bot-config-review-static.test.ts:166`; existing Playwright invalid tests assert no `Connection verified`, `applyConfig`, `startBot`, or `stopBot` text at `tests/e2e/bot-settings.spec.ts:134`, `tests/e2e/bot-settings.spec.ts:156`, and `tests/e2e/bot-settings.spec.ts:177`. Recommendation: extend the static guard to include the new advisory helper/source and add the same rendered no-live-control assertion to the advisory Playwright tests. Target part: no-live-control safety regression.

## Decisions
1. Recommend advisory semantics, not save-blocking semantics, for active RSI/CCI usage exceeding capacity unless product explicitly decides otherwise in the implementation phase.
2. Recommend a pure helper plus one focused static/integration test as the smallest reliable way to prove the advisory math without browser flake.
3. Recommend a separate warn-toned control-center advisory row rather than overloading `activeIssue` / `Validation issue`.
4. Recommend settings and setup Playwright coverage only for the Legacy strategy surface; no admin, DB-backed provider, worker, live adapter, or production-canary gate is needed for this UI advisory.
5. Recommend running bot-settings Playwright sequentially on Windows or isolating `NEXT_DIST_DIR`, matching the Phase 4.02 cache-race lesson.

## Risks
1. If implementers choose save-blocking semantics instead of advisory semantics, `legacy-stage-capacity` should still remain reserved for numeric range errors; use a new whitelisted issue code and update this test plan accordingly.
2. Current default Legacy reference data appears capable of producing over-capacity visuals; relying on defaults alone can be order-sensitive if earlier Playwright cases persist a user override. Prefer a deterministic helper test plus an e2e setup step that creates or selects a known over-capacity reference state.
3. A setup review step may not contain the stage table. If the advisory is visible outside `step=strategy`, its link should include the strategy step plus the fragment, and Playwright should verify navigation lands on the table.
4. The worktree was heavily dirty before this audit; recommendations are based on the current local Phase 4.02 tree.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and current Phase 4.01/4.02 handoffs.
2. Inspected focused current source and tests around Legacy stage capacity rendering, config validation, config review metrics, control-center issue routing, settings/setup wiring, action-handler redirects, Playwright bot settings coverage, and static no-live-control guardrails.
3. Checked current branch/worktree state with `git status --short --branch`.
4. Confirmed no existing handoff file at `docs/handoffs/20260604-0737-legacy-stage-capacity-advisory-tests-auditor.md` before writing.
5. Wrote this canonical read-only auditor handoff.

NOT RUN:
1. `npm test` - not run; this audit was inspection/recommendation only.
2. Playwright/e2e - not run; would start a local web server and write browser artifacts, outside this read-only auditor lane.
3. Lint/typecheck/build/secret scan/governance - not run; no product/test code was edited.
4. DB-backed, worker, provider, exchange, live bot, SSH, nginx, systemd, tmux, start/stop/apply/retest/ping gates - not run by safety policy and scope.
5. Git staging/commit/push/PR - not requested.

## Next actions
1. Add a pure Legacy stage capacity advisory helper and focused Vitest coverage for counting active RSI/CCI usage against stage capacities.
2. Add a save-path/static regression proving over-capacity with valid numeric inputs is advisory-only and does not redirect as `legacy-stage-capacity`.
3. Add a warn-toned `Capacity advisory` row to `BotSetupControlCenter` via a separate advisory prop/data shape, not `activeIssue`.
4. Add Playwright coverage for `/app/bots/legacy/settings` and `/app/bots/legacy/setup?step=strategy` proving the advisory link targets the first affected stage, lands in viewport, keeps no horizontal scroll, and does not expose live-control text.
5. Run the focused post-implementation gates: `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts` plus sequential desktop/mobile `npx playwright test tests/e2e/bot-settings.spec.ts` with fresh `E2E_PORT` values.
