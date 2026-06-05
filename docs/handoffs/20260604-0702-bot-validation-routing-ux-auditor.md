# bot-validation-routing-ux-auditor handoff
## Scope
Phase 4.01 read-only UX/product audit of the current Legacy Bot and Tortila Bot setup/settings validation UX after Phase 4.00.

Inspected only the user bot setup/settings pages, `BotSetupControlCenter`, Legacy/Tortila row tables, row/stage error routing, and focused tests. No product code, live bot services, provider state, secrets, env files, SSH, tmux, systemd, worker ticks, live pings, start/stop/apply/retest, or DB mutation were touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`
8. `docs/handoffs/20260604-0642-bot-setup-control-center-ux-auditor.md`
9. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`
10. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
12. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
13. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
14. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
15. `apps/web/src/features/bots/config.ts`
16. `apps/web/src/features/bots/config-error-copy.ts`
17. `apps/web/src/features/bots/config-review.ts`
18. `tests/e2e/bot-settings.spec.ts`
19. `tests/integration/bot-config-action-handler.test.ts`
20. `tests/integration/bot-config-review-static.test.ts`
21. `tests/integration/bot-read-safety-static.test.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The current tree already contains the small hard-validation routing shape Phase 4.01 needs, and it should be kept as presentation/test hardening rather than expanded into live control. Evidence: `BotSetupControlCenterProps` accepts sanitized `activeIssue` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:36`; issue anchors are bounded to `tortila-symbol-N`, `legacy-symbol-N`, and `legacy-stage-N` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:111`; the issue row is prepended as `Validation issue` / `Needs fix` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:224`; settings and setup both pass `activeIssue={configError ?? undefined}` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:262` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:282`. Recommendation: preserve this narrow `BotConfigErrorCopy` input and do not add loaders, adapter calls, raw config payloads, or live exchange checks. Target part: `BotSetupControlCenter`, settings/setup wiring.
2. Severity: High. The row/stage anchors and inline alerts are strong enough to support premium first-issue routing, but the action should visually land the user on the exact problem, not merely change the hash. Evidence: Tortila rows expose `id="tortila-symbol-N"` and alert copy at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:90` and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:99`; Legacy coin rows expose `id="legacy-symbol-N"` and alert copy at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:144` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:153`; Legacy stage rows expose `id="legacy-stage-N"` and alert copy at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:363` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:382`. Recommendation: add focus/scroll polish for linked targets, such as stable `scroll-margin-top`, focusable error containers, and a rendered test that clicks `Fix row`/`Fix stage` and verifies the row alert is in view. Target part: row/stage table UX and Playwright coverage.
3. Severity: Medium. Settings-page rendered coverage now checks Tortila row, Legacy coin row, and Legacy stage hard-validation routing, but setup-step rendered coverage is still not proven. Evidence: settings e2e covers Tortila invalid row at `tests/e2e/bot-settings.spec.ts:86`, Legacy invalid row at `tests/e2e/bot-settings.spec.ts:105`, and Legacy invalid stage capacity at `tests/e2e/bot-settings.spec.ts:125`; action-handler coverage proves a setup redirect can carry `issue=legacy-stage-capacity&row=2` at `tests/integration/bot-config-action-handler.test.ts:188`, but there is no matching setup-route Playwright case. Recommendation: add one focused setup `?step=strategy` rendered invalid-save case, preferably Legacy stage or Tortila risk, to prove the wizard context, control-center row, table anchor, and no-horizontal-scroll behavior together. Target part: `tests/e2e/bot-settings.spec.ts`.
4. Severity: Medium. Legacy over-capacity is currently a soft visual state, not the same as a hard save validation error, so it can still be missed from the top control center unless the user scrolls to the stage table. Evidence: the stage table computes `overRsi`/`overCci` and renders `over capacity` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:352` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:377`; the persisted schema only enforces stage/rsi/cci numeric ranges at `apps/web/src/features/bots/config.ts:121`; the config review only reports total capacity metrics at `apps/web/src/features/bots/config-review.ts:158` and `apps/web/src/features/bots/config-review.ts:176`. Recommendation: decide explicitly whether over-capacity is advisory or save-blocking; if advisory, derive a safe warning for the control center with a link to the first over-capacity stage; if blocking, add a whitelisted `legacy-stage-over-capacity` issue and focused tests. Target part: Legacy stage capacity UX and config review/advisory derivation.
5. Severity: Medium. The current control-center issue row repeats full issue detail while the banner and inline alert repeat it again, which is functional but not yet premium-quality. Evidence: the control center row detail is `${activeIssue.title}. ${activeIssue.inlineHint ?? activeIssue.detail}` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:228`; settings also renders a top `RiskWarningBanner` with the same failed-save detail at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:281`; setup does the same inside Step 2 at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:487`; row/stage alerts render the detailed correction at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:111` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:395`. Recommendation: make the control-center row concise and action-led, for example `First blocking issue: Tortila coin slot 1`, leaving the detailed correction in the banner/inline alert. Target part: `BotSetupControlCenter` copy.
6. Severity: High. The security/disclosure boundary is currently good and must remain that way in Phase 4.01. Evidence: issue codes are whitelisted and row values bounded at `apps/web/src/features/bots/config-error-copy.ts:71` and `apps/web/src/features/bots/config-error-copy.ts:75`; product-target mismatches are downgraded to generic config errors at `apps/web/src/features/bots/config-error-copy.ts:211`; current static tests guard for `activeIssue`, anchors, and absence of raw `providerPubId` in the control center at `tests/integration/bot-read-safety-static.test.ts:115` and `tests/integration/bot-read-safety-static.test.ts:125`. Recommendation: keep all Phase 4.01 routing driven by sanitized code/row coordinates only; do not render submitted symbols, raw Zod text, provider IDs, key fields, config JSON, or secret-shaped values in the top summary. Target part: config error copy and control-center props.

## Decisions
1. Treated the latest filesystem state as ground truth; it already includes `activeIssue` wiring in the control center.
2. Treated Phase 4.01 as UX/test polish around existing safe DTOs and query-param coordinates, not a backend, adapter, or live-control phase.
3. Separated hard save validation errors from Legacy over-capacity warnings because the current code treats over-capacity as a visual pre-save status.
4. Did not recommend any live exchange ping, live bot start/stop/apply/retest, provider DB mutation, worker action, or secret inspection.
5. Did not edit product code.

## Risks
1. The worktree was already heavily dirty/untracked before this audit, and the bot validation routing code appears in that existing dirty tree rather than a clean baseline.
2. The current `activeIssue` implementation was observed during audit; this handoff audits the latest files and does not claim authorship.
3. Focused static/action tests passed, but rendered setup-route validation and visual focus/scroll behavior were not run in this audit.
4. Legacy over-capacity semantics remain a product decision: advisory warning versus hard validation.

## Verification/tests
RUN:
1. Required protocol and status docs were read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/NEXT_ACTIONS.md`.
2. Current git state was inspected: branch `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked state.
3. Focused code inspection of settings/setup pages, `BotSetupControlCenter`, row tables, config error copy, config review, and focused tests.
4. `npm exec vitest -- run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts` - PASS, 3 files / 42 tests.

NOT RUN:
1. Full `npm test` - not run; audit scope was focused UX/product validation routing.
2. Full `npm run lint` - not run.
3. `npm run build -w @wtc/web` - not run.
4. Full `npm run e2e` - not run.
5. Focused Playwright rerun - not run in this audit; existing test file was inspected only.
6. DB-backed populated admin/user bot gate - not run.
7. Preview/dev server start or restart - not run.
8. Live bot services, provider DB mutation, env/vault/secret file inspection, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, close positions, and live exchange ping - not run by safety policy.
9. Git staging, commit, push, or PR - not requested.

## Next actions
1. Keep the current `activeIssue` control-center row, but polish it: concise top-row copy, focusable target anchors, `scroll-margin-top`, and a click-through Playwright assertion.
2. Add setup-route rendered coverage for at least one invalid strategy save so `/setup?step=strategy&err=config&issue=...&row=...` proves the same premium routing as settings.
3. Decide and implement Legacy over-capacity semantics: warn-only control-center advisory, or a whitelisted hard validation issue with tests.
4. Keep Phase 4.01 bounded to presentation/tests over existing safe DTOs; do not mix in live exchange ping or live bot control.
