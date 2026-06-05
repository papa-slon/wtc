# Phase 4.02 bot validation focus handoff
## Scope
Narrow implementation phase for premium validation landing in Legacy/Tortila bot settings/setup.

Phase goal: after Phase 4.01 added top-control `Fix row` / `Fix stage` routing, make those links land cleanly on the exact invalid row/stage and prove setup wizard invalid-save routing in browser tests.

This phase remained presentation/test-only. It did not start, stop, apply, retest, ping, mutate, or inspect live bot/provider/exchange systems, secrets, env files, SSH, tmux, systemd, or provider DB state.

Per-agent handoffs:

1. `docs/handoffs/20260604-0721-bot-validation-focus-tests-auditor.md`
2. `docs/handoffs/20260604-0723-bot-validation-focus-security-auditor.md`
3. `docs/handoffs/20260604-0725-bot-validation-focus-ux-auditor.md`

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0714-phase-4-01-bot-validation-routing.md`
8. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
9. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
10. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `tests/e2e/bot-settings.spec.ts`
14. `tests/integration/bot-read-safety-static.test.ts`
15. `tests/integration/bot-config-review-static.test.ts`
16. `tests/integration/bot-config-action-handler.test.ts`
17. All three Phase 4.02 per-agent handoffs listed above.

## Files changed
1. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
2. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
3. `tests/e2e/bot-settings.spec.ts`
4. `tests/integration/bot-read-safety-static.test.ts`
5. `tests/integration/bot-config-review-static.test.ts`
6. `docs/handoffs/20260604-0721-bot-validation-focus-tests-auditor.md`
7. `docs/handoffs/20260604-0723-bot-validation-focus-security-auditor.md`
8. `docs/handoffs/20260604-0725-bot-validation-focus-ux-auditor.md`
9. `docs/handoffs/20260604-0729-phase-4-02-bot-validation-focus.md`

## Findings
1. Severity: High. Tortila and Legacy invalid row/stage targets now have `scrollMarginTop` and focusable invalid targets/alerts, so hash navigation lands below the app chrome instead of hiding the fix area. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`. Recommendation: keep this as DOM/UX polish only; no extra server action is needed. Target part: bot config row/stage targets.
2. Severity: High. Rendered tests now click the top `Fix row` / `Fix stage` links, assert the URL hash, and assert the target alert is in the viewport for Tortila row, Legacy row, and Legacy stage errors. Evidence: `tests/e2e/bot-settings.spec.ts`. Recommendation: preserve these tests as acceptance proof for row-level validation UX. Target part: bot settings Playwright coverage.
3. Severity: High. The setup wizard now has a browser invalid-save proof for `/app/bots/tortila/setup?step=strategy`, including safe redirect metadata, top `Validation issue` row, `Fix row` link, target alert landing, no unsafe live-control text, and no horizontal scroll. Evidence: `tests/e2e/bot-settings.spec.ts`. Recommendation: add Legacy setup stage parity only if a future phase claims that exact path. Target part: setup wizard validation proof.
4. Severity: Medium. Static guardrails now lock the presence of `ISSUE_SCROLL_MARGIN_TOP`, `scrollMarginTop`, and focusable invalid targets in Tortila/Legacy tables. Evidence: `tests/integration/bot-read-safety-static.test.ts` and `tests/integration/bot-config-review-static.test.ts`. Recommendation: keep static checks limited to safety-critical UX guarantees; avoid brittle broad snapshots. Target part: static safety/review tests.
5. Severity: Medium. A first Playwright attempt ran desktop and mobile in parallel against the same `.next-e2e` output directory and produced webpack cache corruption (`__webpack_require__.C is not a function`). That run was rejected as invalid evidence. Sequential desktop/mobile runs after deleting generated `.next-e2e` both passed. Recommendation: run this spec sequentially or isolate `NEXT_DIST_DIR` when launching multiple Playwright projects in parallel. Target part: local e2e hygiene.

## Decisions
1. Kept the implementation presentation-only: no new loaders, route handlers, server actions, DB queries, adapter calls, live exchange ping, provider mutation, or live bot control.
2. Used existing sanitized issue routing from Phase 4.01; did not change `botConfigErrorCopy` or action-handler logic.
3. Proved visible anchored landing rather than asserting `document.activeElement`; native hash focus can vary, and visible landing is the current acceptance need.
4. Cleaned generated `apps/web/.next-e2e` after the invalid parallel run and after the final mobile run, verifying the path stayed inside the workspace before removal.
5. Left Legacy over-capacity semantics for a later phase; this phase handled hard validation focus only.

## Risks
1. Worktree remains heavily dirty/untracked from prior phases; this handoff covers only the Phase 4.02 scope and files above.
2. `BotSetupControlCenter.activeIssue` still depends on callers preserving the `botConfigErrorCopy(...)` boundary.
3. Full test/build suite was not run; focused gates were selected for this small UX/test slice.
4. This phase does not prove production deploy state, live exchange reachability, provider-side runtime behavior, or live bot control readiness.

## Verification/tests
RUN:
1. Read protocol/status/current Phase 4.01 handoff before edits.
2. Spawned three read-only agents before product edits; each wrote a canonical handoff and was later closed by the operator.
3. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts` - PASS, 3 files / 42 tests.
4. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
5. `npm exec tsc -- -p tsconfig.json --noEmit` - PASS.
6. Focused ESLint on changed bot table/test files - PASS.
7. Initial parallel Playwright desktop/mobile attempt - NOT ACCEPTED as green evidence; failed due generated Next/Webpack cache race in shared `.next-e2e`.
8. Deleted generated `apps/web/.next-e2e` after verifying the resolved path stayed inside the workspace.
9. `$env:E2E_PORT='45118'; npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop` - PASS, 7 tests.
10. Deleted generated `apps/web/.next-e2e` before mobile after verifying the resolved path stayed inside the workspace.
11. `$env:E2E_PORT='45119'; npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile` - PASS, 7 tests.
12. Deleted generated `apps/web/.next-e2e` after mobile after verifying the resolved path stayed inside the workspace.
13. `npm run secret:scan` - PASS.
14. `git diff --check` - PASS.

NOT RUN:
1. Full `npm test` - skipped because this was a focused validation-focus slice.
2. Full lint across the whole monorepo - skipped; focused ESLint was run.
3. Production build - skipped; TypeScript and focused Playwright covered this slice.
4. DB-backed populated admin/user gates - skipped; no DB loader or schema behavior changed.
5. Live bot/provider/exchange checks - skipped by safety policy; no live start/stop/apply/retest/ping/control action was in scope.
6. Git staging, commit, push, or PR - not requested.

## Next actions
1. Add Legacy setup `Fix stage` rendered parity only if the next acceptance claim specifically includes Legacy stage routing inside setup wizard.
2. Decide Legacy over-capacity semantics: advisory control-center warning versus save-blocking validation.
3. Consider isolating Playwright `NEXT_DIST_DIR` per project if desktop/mobile need to run in parallel on Windows.
4. Continue toward broader bot completion through fresh phases with read-only agents and exact gates.
