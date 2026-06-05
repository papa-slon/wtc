# legacy-stage-capacity-advisory-ux-auditor handoff
## Scope
Read-only UX/product audit for Phase 4.03. Scope was limited to the proposed Legacy bot settings/setup slice after Phase 4.02: a safe top-control advisory when active Legacy RSI/CCI stage usage exceeds configured stage capacity, with an action linking to the first over-capacity stage row. No product code, tests, live bot services, secrets, env files, provider DB, or runtime services were changed.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0729-phase-4-02-bot-validation-focus.md`
8. `docs/handoffs/20260604-0725-bot-validation-focus-ux-auditor.md`
9. `docs/handoffs/20260604-0723-bot-validation-focus-security-auditor.md`
10. `docs/handoffs/20260604-0721-bot-validation-focus-tests-auditor.md`
11. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
12. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
13. `apps/web/src/features/bots/config.ts`
14. `apps/web/src/features/bots/config-review.ts`
15. `apps/web/src/features/bots/config-error-copy.ts`
16. `apps/web/src/features/bots/config-action-handler.ts`
17. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
18. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
19. `packages/ui/src/components.tsx`
20. `packages/ui/src/theme.css`
21. `tests/e2e/bot-settings.spec.ts`
22. `tests/integration/bot-config-review-static.test.ts`
23. `tests/integration/bot-read-safety-static.test.ts`
24. `tests/integration/bot-config-action-handler.test.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The over-capacity condition already exists in the Legacy stage table but is not lifted into the top control center, so the first-screen setup summary can look calmer than the actual stage model below it. Evidence: stage usage is derived from active rows at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:45`; the table compares usage against configured RSI/CCI capacities at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:356`; it labels the row `over capacity` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:382`; the control center currently builds only the normal setup layers plus hard validation issues at `apps/web/src/features/bots/BotSetupControlCenter.tsx:172` and `apps/web/src/features/bots/BotSetupControlCenter.tsx:229`. Recommendation: add one warning-tone control-center row for Legacy only, derived from the same editable WTC profile rows/stages as the table. Target part: `BotSetupControlCenter` plus the Legacy settings/setup callers.

2. Severity: High. The advisory should not block save. The existing blocking path is for invalid form/schema data, while over-capacity is a valid-but-risky stage allocation preview and saving still creates a WTC-side reference version, not a live bot apply. Evidence: Legacy stage config allows whole-number capacities from 0 to 50 at `apps/web/src/features/bots/config.ts:121`; hard invalid capacity maps to `legacy-stage-capacity` copy at `apps/web/src/features/bots/config-error-copy.ts:181`; `handleSaveBotConfigAction` only returns config errors before persistence for forbidden fields, form issues, or parse failures at `apps/web/src/features/bots/config-action-handler.ts:167`; settings failed-save copy explicitly says the failed draft was not saved or applied live at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:281`; setup says the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:487`. Recommendation: keep over-capacity advisory-only; do not extend Zod/form issue validation or disable `Save custom settings` for this slice. Target part: save semantics and warning copy.

3. Severity: High. Smallest premium UX shape: label `Stage capacity advisory`; state `Over capacity`; detail copy `Stage N is using X/Y RSI and A/B CCI slots. Save stays WTC-side and live apply remains disabled; review this stage before treating the profile as ready.`; action label `Review stage`; href `#legacy-stage-<renderedRowIndex>`. Evidence: the control center already renders warning/bad rows into `Needs attention` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:250`; actions are ordinary links in the control table at `apps/web/src/features/bots/BotSetupControlCenter.tsx:282`; warning visual primitives already exist via `StatusPill` and `.wtc-pill.warn` at `packages/ui/src/components.tsx:37` and `packages/ui/src/theme.css:83`. Recommendation: use the existing control table row, not a new full-width banner or modal; keep hard `Validation issue` first when both states exist, then show this advisory below it. Target part: top-control row hierarchy.

4. Severity: Medium. The link target can reuse the Phase 4.02 stage-row anchor, but the derivation should target the first rendered over-capacity row index, not blindly use the raw stage number. Evidence: the stage table renders four rows and derives each row's configured `stage` value at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:351`; the stable target id is `legacy-stage-${i + 1}` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:367`; Phase 4.02 rendered proof already clicks `Fix stage`, verifies `#legacy-stage-1`, and asserts the stage alert is in viewport at `tests/e2e/bot-settings.spec.ts:145`. Recommendation: derive `{ rowIndex, stage, used, capacity }` from the rendered stage row order and link to `#legacy-stage-${rowIndex}`. Target part: advisory derivation helper and action href.

5. Severity: Medium. Settings and setup should share the advisory contract because both pages render the same control center and Legacy table from resolved config rows/stages. Evidence: settings builds `legacyRows` and `legacyStages` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:208`, passes control-center `activeIssue` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:262`, and renders the Legacy table at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:549`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:214`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:282`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:524`. Recommendation: add one shared `legacyStageCapacityAdvisory` prop or helper output and pass it from both pages; do not create separate copy or separate logic per route. Target part: settings/setup parity.

6. Severity: Medium. Focused rendered proof should be small but visual enough: one Legacy advisory test should cover both `/app/bots/legacy/settings` and `/app/bots/legacy/setup?step=strategy`, assert the warning row/copy/action, click `Review stage`, verify the hash and first over-capacity stage row is in viewport, assert no horizontal scroll, and assert no live-control language appears. Evidence: current Playwright coverage already has `noHScroll` at `tests/e2e/bot-settings.spec.ts:6`, stage-capacity visibility at `tests/e2e/bot-settings.spec.ts:82`, Legacy setup rendering at `tests/e2e/bot-settings.spec.ts:202`, and unsafe live-control absence assertions in invalid paths at `tests/e2e/bot-settings.spec.ts:156`. Recommendation: add a focused Playwright case, then run it sequentially on desktop and mobile or isolate `NEXT_DIST_DIR`; do not run provider, worker, DB, or live bot gates for this UX advisory. Target part: `tests/e2e/bot-settings.spec.ts`.

## Decisions
1. Recommend advisory, not save-blocking validation.
2. Recommend one top-control warning row, not an additional page-level banner, modal, or card.
3. Warning copy should mention that save remains WTC-side and live apply remains disabled.
4. Action should be `Review stage`, linking to the first rendered over-capacity stage row.
5. Advisory should use the editable WTC reference/system/default config rows and stages, not raw provider snapshot data.
6. No live bot start/stop/restart/ping/apply/retest/control, no provider DB mutation, no secrets/env access, and no runtime service interaction are needed for this slice.

## Risks
1. If the advisory is made save-blocking, users may be unable to save an intentionally staged WTC-side reference profile even though nothing is applied live.
2. If the advisory is computed separately in settings and setup, the two routes can drift and show different stage readiness truth.
3. If the warning links by raw stage number instead of rendered row index, edited or sparse stage rows can send users to the wrong anchor.
4. If proof only checks text and not link landing, the Phase 4.02 focus/scroll acceptance gap can reappear.
5. Current worktree is heavily dirty/untracked from prior phases; this auditor lane does not validate or claim ownership of those changes.

## Verification/tests
RUN:
1. Read required protocol/truth docs and Phase 4.02 aggregate/per-agent handoffs.
2. Inspected branch/worktree state: branch `codex/bot-analytics-settings-canary-20260603`; broad pre-existing dirty/untracked files are present.
3. Inspected current source/tests for Legacy stage usage, capacity validation, control-center rows, settings/setup wiring, warning primitives, and focused rendered proof shape.
4. Verified repo root with `git rev-parse --show-toplevel`.

NOT RUN:
1. Playwright/e2e - not run in this read-only auditor lane because it starts a local web server and writes browser artifacts.
2. Vitest/typecheck/lint/build/secret scan - not run; this lane produced a recommendation handoff only.
3. Live bot/provider/exchange/worker/server checks - skipped by explicit safety policy and not needed for advisory UX.
4. DB/provider/secrets/env inspection or mutation - skipped by explicit scope.

## Next actions
1. Implement a small shared Legacy stage-capacity advisory derivation for current editable rows/stages: return the first rendered row where active RSI or CCI usage exceeds configured capacity.
2. Pass the advisory into `BotSetupControlCenter` from both Legacy settings and Legacy setup.
3. Render a single warning-tone row: `Stage capacity advisory` / `Over capacity` / concise copy / `Review stage` link to `#legacy-stage-N`; keep hard validation issues first.
4. Add focused rendered proof in `tests/e2e/bot-settings.spec.ts` for Legacy settings and setup, including click-through landing, no horizontal scroll, and no live-control text.
5. Run the focused Playwright proof sequentially on desktop and mobile, plus the existing focused static safety/review tests; keep live bot/provider/exchange gates out of this phase.
