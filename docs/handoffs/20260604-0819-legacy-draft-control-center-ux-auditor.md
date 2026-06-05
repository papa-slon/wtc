# legacy-draft-control-center-ux-auditor handoff
## Scope
Read-only Phase 4.05 UX/product audit for the next narrow Legacy settings/setup slice: the top `Bot setup control center` should react to unsaved Legacy stage-capacity draft edits from the stage table, showing an explicit unsaved/WTC-side draft warning before save. Scope excludes live services, provider DB, env/secrets, worker ticks, exchange pings, live bot start/stop/apply/retest, and product/test/docs edits outside this required handoff.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/handoffs/20260604-0808-phase-4-04-legacy-stage-live-preview.md`
7. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
8. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
9. `apps/web/src/features/bots/config-review.ts`
10. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
12. `tests/e2e/bot-settings.spec.ts`
13. `tests/integration/bot-config-review-static.test.ts`
14. `packages/ui/src/theme.css`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. The current disk state satisfies the core UX requirement for over-capacity draft edits: stage-table edits emit a WTC-side draft event, and the top control center listens and inserts a distinct before-save warning row. Evidence: the event contract is `LEGACY_STAGE_CAPACITY_DRAFT_EVENT` plus `LegacyStageCapacityDraftEventDetail` at `apps/web/src/features/bots/config-review.ts:62`; the table calculates the first draft issue and dispatches `{ active: stageDraftTouched, issue }` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:82`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:159`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:160`; stage, RSI, and CCI inputs mark the draft touched at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:460`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:475`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:490`; the control center listens at `apps/web/src/features/bots/BotSetupControlCenter.tsx:291` and builds steps from `draftStageCapacityPreview` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:302`. Recommendation: accept this event bridge for the narrow slice; keep it WTC-side/client-only and do not couple it to provider or live-control state. Target part: draft warning bridge.

2. Severity: High. Draft copy is explicit enough and does not duplicate the saved validation/advisory label. Evidence: draft copy prefixes `Unsaved draft preview:` and says saving stores only a WTC reference version at `apps/web/src/features/bots/BotSetupControlCenter.tsx:159`; the draft row uses `Draft stage capacity warning` / `Unsaved over capacity`, while the saved row remains `Stage capacity warning` / `Over capacity` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:273`; rendered coverage asserts the draft row before save on setup and settings at `tests/e2e/bot-settings.spec.ts:215` and `tests/e2e/bot-settings.spec.ts:248`, then asserts the saved row after save at `tests/e2e/bot-settings.spec.ts:261`. Recommendation: preserve the separate labels so the user can distinguish unsaved table math from persisted WTC config state. Target part: labels/copy.

3. Severity: Medium. The settings and setup pages still pass saved/resolved capacity issues from server-rendered config, while unsaved edits flow through the client event; this keeps saved review logic stable. Evidence: settings computes and passes `legacyStageCapacityIssue` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:210` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:264`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:217` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:284`. Recommendation: avoid moving unsaved draft math into server page code; the server path should remain saved/resolved-config only. Target part: saved-vs-draft boundary.

4. Severity: Medium. No obvious horizontal-overflow regression is introduced by the top warning row: both the control center table and the stage table use `wtc-table-wrap`, action cells are constrained, and tests include no-horizontal-scroll checks around the affected setup/settings states. Evidence: control center table wrapper at `apps/web/src/features/bots/BotSetupControlCenter.tsx:327`; stage table wrapper at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:427`; responsive table/card-stack CSS at `packages/ui/src/theme.css:119` and `packages/ui/src/theme.css:121`; mobile value wrapping and input shrink rules at `packages/ui/src/theme.css:143` and `packages/ui/src/theme.css:181`; focused e2e checks call `noHScroll` around affected Legacy flows at `tests/e2e/bot-settings.spec.ts:226`, `tests/e2e/bot-settings.spec.ts:270`, and `tests/e2e/bot-settings.spec.ts:280`. Recommendation: keep any future top warning as a table row using existing `data-label` cells, not a wide inline banner inside the table. Target part: responsive layout.

5. Severity: Low. Product intent should remain explicit that the top control-center warning is over-capacity-only. Current code only creates a draft row when `draftStageCapacityPreview.active` has an issue; a benign unsaved edit that remains inside capacity updates the stage table pills but does not add a top warning. Evidence: `activeCapacityIssue` is chosen from `draftStageCapacityPreview.issue` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:273`, and the row renders only when `activeCapacityIssue` exists at `apps/web/src/features/bots/BotSetupControlCenter.tsx:275`. Recommendation: if product wants every unsaved capacity edit called out at the top, add a separate low-severity `Unsaved stage capacity draft` row; otherwise document/keep this as an over-capacity warning only. Target part: product semantics.

## Decisions
1. The current narrow implementation is UX-acceptable for the intended over-capacity draft-warning slice.
2. The draft warning should remain visually and textually distinct from saved validation/advisory warnings.
3. The top control center should consume a minimal client draft signal and continue to avoid provider/live-control data.
4. No additional broad phase, live-service probe, provider DB read, env/secret inspection, or live bot action is needed for this UX audit.

## Risks
1. Playwright assertions for the current draft-control-center behavior exist, but this auditor did not run Playwright because it would start the local web server; treat rendered coverage as inspected, not observed green in this lane.
2. If users expect the control center to warn about all unsaved stage edits, not only over-capacity edits, the current behavior will feel selective.
3. The worktree is broadly dirty from previous phases, so acceptance should scope ownership to the files listed in the implementation phase handoff, not to the entire repository state.

## Verification/tests
RUN:
1. Required protocol/current-state docs and Phase 4.04 aggregate were inspected.
2. Targeted UI, config-review, setup/settings page wiring, e2e coverage, static coverage, and responsive table CSS were inspected.
3. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts` - PASS, 1 file, 4 tests.

NOT RUN:
1. Playwright `tests/e2e/bot-settings.spec.ts` - skipped to honor this read-only auditor lane's no-live-services boundary; it would start the local web app.
2. Full `npm test`, full lint/typecheck/build/CI/coverage - skipped because this was a narrow UX/product audit, not an implementation acceptance phase.
3. Live server checks, provider DB, env/secret inspection, worker ticks, exchange pings, live bot start/stop/apply/retest - skipped by explicit scope and safety policy.
4. Git commit/push/PR - not requested.

## Next actions
1. Implementation acceptance can run the focused Playwright bot-settings spec on desktop and mobile, plus typecheck/lint as the operator chooses for the phase gate.
2. If product wants any unsaved stage capacity edit surfaced at the top, add a separate non-over-capacity draft row; otherwise keep the current over-capacity-only warning semantics.
3. Keep live Legacy control and provider/exchange work behind the existing bot-integration and security gates.
