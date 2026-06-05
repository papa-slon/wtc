# phase-4-04-legacy-stage-live-preview handoff
## Scope
Phase 4.04 implemented a narrow Legacy bot settings/setup clarity slice: RSI/CCI stage capacity usage now updates live on the page while the user edits the capacity inputs before saving. This is a WTC-side draft preview only. No live bot start/stop/apply/retest, no exchange ping, no provider DB mutation, no worker tick, no raw runtime/provider payload, and no secret/env inspection were performed.

Required read-only agents were launched before edits and wrote per-agent handoffs:
1. `docs/handoffs/20260604-0759-legacy-stage-live-preview-ux-auditor.md`
2. `docs/handoffs/20260604-0759-legacy-stage-live-preview-tests-auditor.md`
3. `docs/handoffs/20260604-0800-legacy-stage-live-preview-security-auditor.md`

All three background agents were closed before this report.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md`
8. `docs/handoffs/20260604-0759-legacy-stage-live-preview-ux-auditor.md`
9. `docs/handoffs/20260604-0759-legacy-stage-live-preview-tests-auditor.md`
10. `docs/handoffs/20260604-0800-legacy-stage-live-preview-security-auditor.md`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-review.ts`
14. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
17. `tests/e2e/bot-settings.spec.ts`
18. `tests/integration/bot-config-review-static.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
1. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
2. `tests/e2e/bot-settings.spec.ts`
3. `tests/integration/bot-config-review-static.test.ts`
4. `tests/integration/bot-read-safety-static.test.ts`
5. `docs/handoffs/20260604-0808-phase-4-04-legacy-stage-live-preview.md`

## Findings
1. Severity: High. Legacy stage capacity rows now use controlled draft state, so the visible RSI/CCI usage and status update before a save/reload. Evidence: `LegacyStageDraft`, `defaultStageDraft(...)`, and `numericDraft(...)` are defined at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:28`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:42`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:50`; `stageDrafts` initializes the four visible stage rows at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:105`; totals use draft values at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:115` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:118`; row status uses draft values at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:391` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:394`. Recommendation: keep the preview local to the editable table until a separately scoped top-control bridge exists. Target part: Legacy stage capacity editor.

2. Severity: High. The stage block now tells the user this is a live WTC draft preview and shows an aggregate status pill before save. Evidence: the copy says usage updates as draft capacities are edited and saving only writes a WTC-side reference profile at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:373`; the aggregate `live draft inside capacity` / `N over capacity` pill renders at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:377` to `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:378`. Recommendation: keep this wording explicit so users do not confuse preview quality with live bot state. Target part: UX copy/readiness signal.

3. Severity: High. The controlled inputs keep the existing form names and existing save pipeline, so no new mutation path or live provider path was introduced. Evidence: stage input handlers update local `stageDrafts` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:421`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:435`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:449`; the field names remain `legacy_stage_rsi_${i}` and `legacy_stage_cci_${i}` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:428` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:442`. Recommendation: keep all save validation in `config.ts` / `config-action-handler.ts`. Target part: mutation boundary.

4. Severity: Medium. Rendered tests now prove pre-save live stage preview in both setup and settings. Evidence: setup fills the stage capacities and verifies `/0 RSI used`, `/0 CCI used`, `over capacity`, and no live-control strings at `tests/e2e/bot-settings.spec.ts:217` to `tests/e2e/bot-settings.spec.ts:222`; settings does the same before save at `tests/e2e/bot-settings.spec.ts:248` to `tests/e2e/bot-settings.spec.ts:251`. Recommendation: keep these checks in the focused bot-settings rendered gate. Target part: Playwright acceptance.

5. Severity: Medium. Static tests now guard the controlled live-preview contract and the WTC-side copy. Evidence: static review asserts the draft copy, `stageDrafts`, `setStageDrafts`, and controlled RSI/CCI values at `tests/integration/bot-config-review-static.test.ts:176` to `tests/integration/bot-config-review-static.test.ts:181`; read-safety asserts `stageDrafts` and `setStageDrafts` at `tests/integration/bot-read-safety-static.test.ts:133` to `tests/integration/bot-read-safety-static.test.ts:134`. Recommendation: if this becomes a reusable pure helper later, move these guards to behavior-level unit tests. Target part: regression coverage.

## Decisions
1. Live stage capacity preview is advisory, not save-blocking.
2. Preview stays local client state in `LegacyAveragingConfigTable`, sourced from editable WTC rows/stages already on the page.
3. The top `BotSetupControlCenter` remains saved/resolved-config driven in this phase; unsaved top-control bridging is left for a separate scope to avoid a larger client wrapper refactor.
4. Runtime/provider evidence and optional provider identity display remain read-only context only; the preview calculation does not read provider pub_id, `legacyLiveConfig`, balances, orders, worker snapshots, or raw runtime payloads.
5. The existing save path remains unchanged: zod/form issue checks, forbidden-field guards, RBAC/entitlement boundaries, and WTC config persistence.

## Risks
1. Top control-center warnings still reflect saved/resolved config, so the table preview is the current source for unsaved capacity feedback.
2. Changing a coin's stage/status row before save is not yet fully controlled, so this phase covers live RSI/CCI capacity edits, not every possible unsaved usage dimension.
3. The security auditor recommends a future hardening slice: narrow `LegacyAveragingConfigTable` from runtime-capable rows to pure `LegacySymbolConfig[]` or split provider identity display out.
4. The worktree remains broadly dirty from earlier phases; this phase only owns the files listed under `Files changed`.

## Verification/tests
RUN:
1. Read protocol/current-state docs, seed, status, implemented files, NEXT_ACTIONS, and the Phase 4.03 aggregate.
2. Launched three read-only agents before edits and collected their handoffs: UX, tests, and security.
3. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - 4 files, 44 tests passed.
4. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - passed.
5. `npm exec eslint -- 'apps/web/src/features/bots/LegacyAveragingConfigTable.tsx' 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts'` - passed.
6. `npm exec tsc -- --noEmit` - passed.
7. `E2E_PORT=3424 npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` - 8 passed.
8. `E2E_PORT=3425 npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile` - 8 passed. Note: after the 8 passing tests, Next dev emitted a shutdown/lifecycle failure line while Playwright stopped its webServer; the command exit code was 0.
9. `npm run secret:scan` - passed.
10. `git diff --check` - passed.
11. `npm run governance:check` before aggregate - 0 errors, 1 known historical warning: `20260529-1921-integration-risk-auditor.md` missing `## Files inspected`.
12. Closed all three background agents.

NOT RUN:
1. Full `npm test`, full `npm run lint`, full build, full CI matrix, and coverage - skipped because this was a narrow focused UI/settings phase with focused gates.
2. Live bot start/stop/restart/apply/retest/position-close - skipped by safety policy and scope.
3. Live provider DB, exchange ping, worker tick, tmux/systemd/service checks, env/vault/secret inspection - skipped by explicit phase boundary.
4. Git commit/push/PR - not requested.

## Next actions
1. Choose the next narrow bot-settings slice: either an unsaved top-control draft preview bridge, or the security hardening split that narrows editable Legacy rows away from runtime-capable provider identity rows.
2. Keep live bot/provider/exchange work behind the existing bot-integration and security audit gates.
