# phase-4-03-legacy-stage-capacity-advisory handoff
## Scope
Phase 4.03 implemented a narrow Legacy bot UX/settings slice: surface a top `Bot setup control center` advisory when active editable Legacy RSI/CCI stage usage exceeds configured stage capacity, and route the user to the existing rendered stage row. Scope stayed WTC-side only: no live bot start/stop/apply/retest, no exchange ping, no provider DB mutation, no raw runtime/provider payload, and no secret/env inspection.

Required read-only agents were launched before edits and wrote per-agent handoffs:
1. `docs/handoffs/20260604-0736-legacy-stage-capacity-advisory-ux-auditor.md`
2. `docs/handoffs/20260604-0737-legacy-stage-capacity-advisory-tests-auditor.md`
3. `docs/handoffs/20260604-0740-legacy-stage-capacity-advisory-security-auditor.md`

All three background agents were closed before this report.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/NEXT_ACTIONS.md`
5. `docs/handoffs/20260604-0729-phase-4-02-bot-validation-focus.md`
6. `docs/handoffs/20260604-0736-legacy-stage-capacity-advisory-ux-auditor.md`
7. `docs/handoffs/20260604-0737-legacy-stage-capacity-advisory-tests-auditor.md`
8. `docs/handoffs/20260604-0740-legacy-stage-capacity-advisory-security-auditor.md`
9. `apps/web/src/features/bots/config-review.ts`
10. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
11. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-action-handler.ts`
14. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
16. `tests/integration/bot-config-review-static.test.ts`
17. `tests/integration/bot-read-safety-static.test.ts`
18. `tests/e2e/bot-settings.spec.ts`

## Files changed
1. `apps/web/src/features/bots/config-review.ts`
2. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
3. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
4. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
5. `tests/integration/bot-config-review-static.test.ts`
6. `tests/integration/bot-read-safety-static.test.ts`
7. `tests/e2e/bot-settings.spec.ts`
8. `docs/handoffs/20260604-0751-phase-4-03-legacy-stage-capacity-advisory.md`

## Findings
1. Severity: High. Legacy over-capacity is now computed from editable WTC config rows/stages as an advisory model, not from runtime/provider snapshots. Evidence: `LegacyStageCapacityIssue`, `legacyStageCapacityIssues(...)`, and `firstLegacyStageCapacityIssue(...)` are defined in `apps/web/src/features/bots/config-review.ts:50`, `apps/web/src/features/bots/config-review.ts:169`, and `apps/web/src/features/bots/config-review.ts:204`; Legacy review flags the `Stage capacity` metric when a capacity issue exists at `apps/web/src/features/bots/config-review.ts:226` and `apps/web/src/features/bots/config-review.ts:241`. Recommendation: keep this helper pure and fed by saved config rows/stages only. Target part: Legacy settings/review source truth.

2. Severity: High. The top setup control center now renders a warning-tone `Stage capacity warning` row with `Over capacity` state and `Review stage` action below any hard validation issue. Evidence: prop and helper wiring live at `apps/web/src/features/bots/BotSetupControlCenter.tsx:37`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:137`, and `apps/web/src/features/bots/BotSetupControlCenter.tsx:142`; row insertion/action copy lives at `apps/web/src/features/bots/BotSetupControlCenter.tsx:251` to `apps/web/src/features/bots/BotSetupControlCenter.tsx:258`. Recommendation: keep this advisory separate from hard `Validation issue` save failures. Target part: top-control guidance.

3. Severity: High. Settings and setup now share the same advisory derivation and pass it into the same component, avoiding route drift. Evidence: settings imports/derives/passes `firstLegacyStageCapacityIssue` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:51`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:210`, and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:264`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:43`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:217`, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:284`. Recommendation: future Legacy stage UI should update this shared helper first. Target part: settings/setup parity.

4. Severity: Medium. Rendered coverage now proves the advisory row and link landing for both Legacy settings and setup. Evidence: `tests/e2e/bot-settings.spec.ts:234` creates the proof case; it asserts the warning at `tests/e2e/bot-settings.spec.ts:242` and `tests/e2e/bot-settings.spec.ts:254`; it clicks `Review stage` and verifies `#legacy-stage-1` viewport landing at `tests/e2e/bot-settings.spec.ts:244` to `tests/e2e/bot-settings.spec.ts:259`. Recommendation: keep this test focused on rendered navigation/no-live-control copy rather than provider/runtime checks. Target part: Playwright acceptance.

## Decisions
1. Over-capacity remains advisory, not save-blocking validation.
2. The advisory uses aggregate counts only: stage number, rendered stage row, RSI used/slots, CCI used/slots, active coin count.
3. The advisory is sourced from editable WTC resolved config rows/stages, not `legacyLiveConfig`, provider accounts, worker snapshots, balances, orders, pub_ids, or raw runtime payloads.
4. Settings links to `#legacy-stage-N`; setup links to `/app/bots/legacy/setup?step=strategy#legacy-stage-N` so the stage row exists when clicked.
5. Hard validation issues stay first when present; advisory comes next.

## Risks
1. Sparse or unusual stage configurations can still require product judgment for the best fallback stage-row target if a coin references an unrendered stage.
2. The advisory is not a live-bot readiness guarantee; it only reflects the WTC-side editable profile.
3. This phase did not address live stage recalculation while users type unsaved capacity values; it covers saved/resolved config and rendered post-save state.
4. The worktree remains broadly dirty from earlier phases; this phase only owns the files listed under `Files changed`.

## Verification/tests
RUN:
1. Read protocol/current-state docs and the Phase 4.02 aggregate.
2. Launched three read-only agents before edits and collected their handoffs: UX, tests, and security.
3. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` — 4 files, 44 tests passed.
4. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` — passed.
5. `npm exec tsc -- --noEmit` — passed.
6. `npm exec eslint -- 'apps/web/src/features/bots/config-review.ts' 'apps/web/src/features/bots/BotSetupControlCenter.tsx' 'apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx' 'apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts' 'tests/e2e/bot-settings.spec.ts'` — passed.
7. `E2E_PORT=3421 npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop` — 8 passed.
8. `E2E_PORT=3422 npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=mobile` — 8 passed.
9. `npm run secret:scan` — passed.
10. `git diff --check` — passed.
11. `npm run governance:check` — 0 errors, 1 known historical warning: `20260529-1921-integration-risk-auditor.md` missing `## Files inspected`.
12. Closed all three background agents.

NOT RUN:
1. Full `npm test`, full `npm run lint`, full build, full CI matrix, and coverage — skipped because this was a narrow phase with focused gates.
2. Live bot start/stop/restart/apply/retest/position-close — skipped by safety policy and scope.
3. Live provider DB, exchange ping, worker tick, tmux/systemd/service checks, env/vault/secret inspection — skipped by explicit phase boundary.
4. Git commit/push/PR — not requested.

Notes:
1. An initial Vitest invocation without `run` timed out because it entered watch mode; the corrected `vitest run` command passed.
2. An initial ESLint invocation failed before execution because PowerShell interpreted the unquoted `(app)` path; the quoted command passed.

## Next actions
1. Continue the bot setup polish with another narrow phase: live client-side preview of Legacy stage usage when a user changes capacity inputs before save, or proceed to the next user-facing Legacy/Tortila completion gap from `docs/NEXT_ACTIONS.md`.
2. Keep any future runtime/provider work behind the existing security and bot-integration audit gates.
