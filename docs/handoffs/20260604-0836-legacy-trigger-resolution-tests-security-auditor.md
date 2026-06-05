# legacy-trigger-resolution-tests-security-auditor handoff
## Scope
Phase 4.06 read-only tests/security audit for adding or accepting a Legacy trigger-resolution map/explanation in the settings/setup UI. The audit inspected existing bot settings, config review, read-safety, and rendered Playwright coverage to identify exact focused tests to update/run and no-live-control/security string risks.

Out of scope: product-code edits, live services, provider DB, env/secrets, worker ticks, exchange pings, live bot start/stop/apply/retest, SSH/tmux/systemd, runtime mutation, and broad CI/deploy work.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/handoffs/20260604-0833-phase-4-05-legacy-draft-control-center.md`
7. `docs/handoffs/20260604-0836-legacy-trigger-resolution-ux-auditor.md`
8. `package.json`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
13. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
14. `apps/web/src/features/bots/config-review.ts`
15. `apps/web/src/features/bots/config.ts`
16. `tests/e2e/bot-settings.spec.ts`
17. `tests/integration/bot-config-review-static.test.ts`
18. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: the current tree already contains a trigger-resolution map in `LegacyAveragingConfigTable` (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:137`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:212`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:274`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:289`) and rendered Playwright already checks the heading/copy/columns on both settings and setup (`tests/e2e/bot-settings.spec.ts:76`, `tests/e2e/bot-settings.spec.ts:77`, `tests/e2e/bot-settings.spec.ts:79`, `tests/e2e/bot-settings.spec.ts:216`, `tests/e2e/bot-settings.spec.ts:218`, `tests/e2e/bot-settings.spec.ts:219`). Recommendation: keep `tests/e2e/bot-settings.spec.ts` as the rendered acceptance file and run it for both desktop and mobile after any map/copy change. Target part: rendered Legacy settings/setup coverage.
2. Severity: High. Evidence: current rendered coverage proves presence but not behavior: it checks static map labels only, while `stageResolutionRows` groups from saved `rows` plus local `signals`/`stageDrafts` (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:137`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:145`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:148`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:212`) and the visible stage input remains uncontrolled saved-row data (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:441`). Recommendation: add rendered checks that change a coin's trigger, stage group, and active/symbol state before save, then assert the map updates or explicitly label the map as saved-reference-only. Target part: `LegacyAveragingConfigTable` draft-state behavior and `tests/e2e/bot-settings.spec.ts`.
3. Severity: Medium. Evidence: the map currently summarizes candidates as symbol strings only (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:39`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:41`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:149`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:152`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:294`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:295`), while the UX audit requested row number, symbol, timeframe, threshold, and paused/blank exclusion explanation (`docs/handoffs/20260604-0836-legacy-trigger-resolution-ux-auditor.md:19`, `docs/handoffs/20260604-0836-legacy-trigger-resolution-ux-auditor.md:33`). Recommendation: static and rendered tests should assert at least one concrete candidate row/detail and the paused/blank exclusion copy, not just the heading. Target part: map content fidelity.
4. Severity: Medium. Evidence: static tests already pin the map strings and helper names (`tests/integration/bot-config-review-static.test.ts:177`, `tests/integration/bot-config-review-static.test.ts:180`, `tests/integration/bot-config-review-static.test.ts:182`, `tests/integration/bot-config-review-static.test.ts:184`, `tests/integration/bot-read-safety-static.test.ts:142`, `tests/integration/bot-read-safety-static.test.ts:145`, `tests/integration/bot-read-safety-static.test.ts:147`, `tests/integration/bot-read-safety-static.test.ts:148`) and guard against adapter/control/secrets in the relevant surfaces (`tests/integration/bot-config-review-static.test.ts:224`, `tests/integration/bot-config-review-static.test.ts:227`, `tests/integration/bot-read-safety-static.test.ts:181`). Recommendation: update/run exactly `tests/integration/bot-config-review-static.test.ts` and `tests/integration/bot-read-safety-static.test.ts` for this slice; also run the existing action/sanitizer safety files unchanged if any copy touches save/export/runtime boundaries. Target part: static safety regression coverage.
5. Severity: Medium. Evidence: the existing stage preview still says `live draft inside capacity` (`apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:518`), and tests pin that wording (`tests/integration/bot-config-review-static.test.ts:190`, `tests/e2e/bot-settings.spec.ts:233`), even though status/next-actions state Legacy settings are WTC-side reference/export only with no live Legacy apply path (`docs/STATUS.md:6`, `docs/STATUS.md:7`, `docs/NEXT_ACTIONS.md:13`, `docs/NEXT_ACTIONS.md:14`). Recommendation: replace this with `draft inside capacity` or `preview inside capacity` and update both static and rendered expectations; keep the trigger-resolution copy free of `live`, `retest`, `diagnostics`, `apply`, `start`, `stop`, `providerPubId`, raw payload, or secret-shaped strings unless they are explicit negative guardrails. Target part: no-live-control UI copy.
6. Severity: Low. Evidence: the operation map already frames Legacy triggers as WTC reference settings and no live control (`apps/web/src/features/bots/BotOperationMapPanel.tsx:91`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:94`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:100`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:117`, `apps/web/src/features/bots/BotOperationMapPanel.tsx:173`), and the setup control center keeps live controls disabled (`apps/web/src/features/bots/BotSetupControlCenter.tsx:257`). Recommendation: the new/accepted map should stay inside this same explanatory boundary and must not introduce backend reads, provider DB checks, worker ticks, exchange pings, or adapter calls. Target part: source/security boundary.

## Decisions
1. This audit made no product-code edits and did not run live or local rendered gates; it inspected current source/test coverage and wrote this one handoff.
2. The exact rendered test file for this slice is `tests/e2e/bot-settings.spec.ts`, specifically the settings workbench, setup review, and stage-over-capacity tests.
3. The exact static test files to update first are `tests/integration/bot-config-review-static.test.ts` and `tests/integration/bot-read-safety-static.test.ts`.
4. If the map remains draft-aware, tests must cover live client edits before save; if it is saved-reference-only, the UI copy must say so explicitly.

## Risks
1. The current code appears ahead of the sibling UX audit: the map exists now, but behavioral coverage is still thinner than the UX acceptance target.
2. A map that updates for trigger/capacity drafts but not stage/symbol/status drafts can mislead users while they are resolving an unsaved warning.
3. The phrase `live draft inside capacity` is a small but real safety-copy risk because this surface is not live Legacy control.
4. The broader worktree is dirty from prior phases; this auditor did not attempt cleanup or ownership reconciliation.

## Verification/tests
RUN:
1. Read required protocol/status/handoff files and the sibling UX auditor handoff.
2. Inspected the Legacy settings/setup composition and shared bot components listed above.
3. Inspected focused static and rendered test coverage by source search only.
4. Confirmed the requested handoff path did not exist before writing this single handoff.

NOT RUN:
1. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - not run; no product-code edits in this read-only audit.
2. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` and `npm exec tsc -- --noEmit` - not run; no product-code edits in this read-only audit.
3. `npm exec eslint -- 'apps/web/src/features/bots/LegacyAveragingConfigTable.tsx' 'apps/web/src/features/bots/BotSetupControlCenter.tsx' 'apps/web/src/features/bots/BotOperationMapPanel.tsx' 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts'` - not run; no product-code edits in this read-only audit.
4. `$env:E2E_PORT='3428'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` - not run; rendered/browser gates were only identified.
5. `$env:E2E_PORT='3429'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile` - not run; rendered/browser gates were only identified.
6. `npm run secret:scan`, `npm run governance:check`, build, coverage, full e2e, full CI - not run; out of this read-only audit scope.
7. Live bot start/stop/apply/retest, provider DB reads/writes, worker tick, exchange ping, raw provider payload inspection, env/secret inspection, SSH/tmux/systemd - not run by explicit scope and safety boundary.
8. Git commit, push, or PR - not requested.

## Next actions
1. Decide whether the trigger-resolution map must be draft-aware for symbol/stage/status edits. If yes, add local draft state for those fields and rendered tests that prove candidate movement before save.
2. Replace `live draft inside capacity` with safer reference-profile wording and update `tests/integration/bot-config-review-static.test.ts` plus `tests/e2e/bot-settings.spec.ts`.
3. Strengthen rendered Playwright checks in `tests/e2e/bot-settings.spec.ts`: assert concrete RSI/CCI candidate contents on settings and setup, change one trigger, change one stage, pause/blank one row, verify capacity state, and keep no horizontal scroll.
4. Run the focused static/type/lint/rendered commands listed in Verification/tests before any Phase 4.06 aggregate handoff claims this slice green.
