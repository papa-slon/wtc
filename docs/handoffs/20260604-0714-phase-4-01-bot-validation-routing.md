# Phase 4.01 bot validation routing handoff
## Scope
Narrow implementation phase for Legacy/Tortila bot settings/setup validation routing.

Phase goal: when a safe config validation issue is active, the top `BotSetupControlCenter` must surface a concise `Validation issue` row and link the user directly to the exact existing row/stage anchor:

1. Tortila row issues -> `#tortila-symbol-N`
2. Legacy coin row issues -> `#legacy-symbol-N`
3. Legacy stage issues -> `#legacy-stage-N`

This phase did not start, stop, apply, retest, ping, or mutate any live bot/provider/exchange system. Existing local Next dev servers were observed on ports 3410/3411/3412 and left untouched; focused Playwright used fresh temporary ports.

Per-agent handoffs:

1. `docs/handoffs/20260604-0700-bot-validation-routing-tests-auditor.md`
2. `docs/handoffs/20260604-0702-bot-validation-routing-ux-auditor.md`
3. `docs/handoffs/20260604-0705-bot-validation-routing-security-auditor.md`

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`
5. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
6. `apps/web/src/features/bots/config-error-copy.ts`
7. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
8. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `tests/integration/bot-read-safety-static.test.ts`
12. `tests/integration/bot-config-review-static.test.ts`
13. `tests/integration/bot-config-action-handler.test.ts`
14. `tests/e2e/bot-settings.spec.ts`
15. All three Phase 4.01 per-agent handoffs listed above.

## Files changed
1. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
2. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
3. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
4. `tests/integration/bot-read-safety-static.test.ts`
5. `tests/integration/bot-config-review-static.test.ts`
6. `tests/e2e/bot-settings.spec.ts`
7. `docs/handoffs/20260604-0700-bot-validation-routing-tests-auditor.md`
8. `docs/handoffs/20260604-0702-bot-validation-routing-ux-auditor.md`
9. `docs/handoffs/20260604-0705-bot-validation-routing-security-auditor.md`
10. `docs/handoffs/20260604-0714-phase-4-01-bot-validation-routing.md`

## Findings
1. Severity: High. `BotSetupControlCenter` now accepts `activeIssue?: BotConfigErrorCopy`, prepends a top `Validation issue` row when present, and maps sanitized issue targets to fragment-only row/stage anchors. Evidence: `apps/web/src/features/bots/BotSetupControlCenter.tsx`. Recommendation: keep `activeIssue` fed only from `botConfigErrorCopy(...)`. Target part: bot setup/settings validation routing.
2. Severity: High. Settings and setup pages both pass `activeIssue={configError ?? undefined}` from the existing safe query-param copy helper. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`. Recommendation: do not add raw form/Zod/provider payloads to this prop. Target part: user bot settings/setup pages.
3. Severity: High. Focused rendered tests now prove Tortila row, Legacy row, and Legacy stage routing: `Fix row` links to `#tortila-symbol-1` and `#legacy-symbol-1`; `Fix stage` links to `#legacy-stage-1`. Evidence: `tests/e2e/bot-settings.spec.ts`. Recommendation: keep these tests in the acceptance gate for bot settings UX work. Target part: Playwright settings validation suite.
4. Severity: Medium. Initial Playwright rerun exposed duplicate issue copy in the control center and warning banner. The control center was made action-led: row/stage errors keep the correction hint, while global errors use concise form-routing copy. Evidence: desktop Playwright failed before this polish and passed afterward. Recommendation: keep detailed correction text in banner/inline row alerts; keep the top row concise. Target part: premium UX copy.
5. Severity: Medium. Existing local dev servers occupied ports 3410, 3411, and 3412; they were not killed or reused because they may belong to ongoing local work. Evidence: `Get-NetTCPConnection` / `Win32_Process` inspection. Recommendation: use a fresh `E2E_PORT` for focused e2e in future slices. Target part: local verification hygiene.

## Decisions
1. Kept Phase 4.01 presentation-only: no new loader, server action, adapter call, DB mutation, exchange ping, provider mutation, or live-control surface.
2. Used existing row/stage anchors from `TortilaSymbolConfigTable` and `LegacyAveragingConfigTable`.
3. Kept forbidden-field and global config failures unfocused to avoid credential/provider/live-control field leakage.
4. Added rendered Legacy stage-capacity coverage because Phase 4.00 explicitly left stage issue routing as the next gap.
5. Left broader Legacy over-capacity semantics as a future product decision; this phase handles hard validation issue routing only.

## Risks
1. Worktree remains heavily dirty/untracked from prior phases; this handoff covers only the Phase 4.01 scope above.
2. `BotSetupControlCenter` trusts the `activeIssue` object it receives; future callers must preserve the `botConfigErrorCopy` sanitization boundary.
3. Full test/build suite was not run; focused gates were selected to match this small validation-routing slice.
4. This phase does not prove live exchange reachability or live bot runtime behavior; those remain intentionally out of scope until separate audited adapter phases.

## Verification/tests
RUN:
1. Read protocol/status/current Phase 4.00 handoff before edits.
2. Spawned three read-only agents before product edits; each wrote a canonical handoff and was later closed.
3. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts` - PASS, 3 files / 42 tests.
4. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts` - PASS, 2 files / 28 tests after final copy polish.
5. `npm exec tsc -- -p apps/web/tsconfig.json --noEmit` - PASS.
6. `npm exec tsc -- -p tsconfig.json --noEmit` - PASS.
7. Focused ESLint on changed bot/settings/test files - PASS.
8. `$env:E2E_PORT='45114'; npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop` - PASS, 6 tests.
9. `$env:E2E_PORT='45115'; npx playwright test tests/e2e/bot-settings.spec.ts --project=mobile` - PASS, 6 tests.
10. `npm run secret:scan` - PASS.
11. `git diff --check` - PASS.

NOT RUN:
1. Full `npm test` - skipped because this was a focused validation-routing slice.
2. Full lint across the whole monorepo - skipped; focused ESLint was run.
3. Production build - skipped; TypeScript and focused Playwright covered this slice.
4. DB-backed populated admin/user gates - skipped; no DB loader or schema behavior changed.
5. Live bot/provider/exchange checks - skipped by safety policy; no live start/stop/apply/retest/ping/control action was in scope.
6. Git staging, commit, push, or PR - not requested.

## Next actions
1. Add focus/scroll polish for linked row/stage anchors, such as stable `scroll-margin-top` or focusable alert containers.
2. Add one setup-route invalid-save Playwright case if the next slice touches setup wizard validation.
3. Decide Legacy over-capacity semantics: advisory warning in the control center versus save-blocking validation.
4. Continue toward broader bot completion only through separate phases with fresh read-only agents and exact gates.
