# phase 4.09 Tortila cap validation handoff
## Scope
Implement the next safe Tortila settings slice after Phase 4.08: top-level portfolio cap validation for the embedded Tortila strategy map.

This phase converts the three top-level Tortila cap errors into section-targeted UX:
1. `tortila-portfolio-limit`
2. `tortila-risk-limit`
3. `tortila-entry-throttle`

Strictly out of scope: live bot start/stop/apply/retest, live diagnostics, exchange ping, provider/API calls, env/secret inspection, worker tick, deploy/canary mutation, DB migration, production reads/writes, and claims that WTC reference caps are current live runtime enforcement.

Background read-only agents were launched before implementation and were closed after result collection.
## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md`
8. `docs/handoffs/20260604-0954-tortila-cap-validation-ux-auditor.md`
9. `docs/handoffs/20260604-0954-tortila-cap-validation-source-security-auditor.md`
10. `docs/handoffs/20260604-0954-tortila-cap-validation-tests-auditor.md`
11. `apps/web/src/features/bots/config-error-copy.ts`
12. `apps/web/src/features/bots/config.ts`
13. `apps/web/src/features/bots/config-action-handler.ts`
14. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
15. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
17. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
18. `tests/e2e/bot-settings.spec.ts`
19. `tests/integration/bot-config-action-handler.test.ts`
20. `tests/integration/bot-config-review-static.test.ts`
21. `tests/integration/bot-read-safety-static.test.ts`
## Files changed
1. `apps/web/src/features/bots/config-error-copy.ts`
   - Added `tortila-cap` error target.
   - Added `code` to `BotConfigErrorCopy`.
   - Added exact range copy for Tortila portfolio, risk, and entry-throttle caps.
   - Hardened redirect row handling with `ROW_SCOPED_ERROR_CODES`, so cap/global issues cannot gain `row=` focus accidentally.
2. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
   - Routes `tortila-cap` validation issues to `#tortila-portfolio-caps`.
   - Shows action label `Fix caps`.
3. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
   - Added stable cap-section anchor `id="tortila-portfolio-caps"`.
   - Added inline `role="alert"` for cap save errors.
   - Marks only affected cap inputs with `aria-invalid` and `aria-describedby`.
   - Keeps per-coin row highlighting isolated to `tortila-row`.
4. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
   - Passes the full Tortila `configError` into the Tortila table so row and cap targets can be handled locally.
5. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
   - Same Tortila table wiring for the setup wizard.
6. `tests/e2e/bot-settings.spec.ts`
   - Added rendered coverage for all three top-level Tortila cap error groups on settings/setup.
   - Asserts `Fix caps`, cap anchor, inline alert, affected input aria state, no row/stage action, no live-control copy, and no horizontal scroll regression.
7. `tests/integration/bot-config-action-handler.test.ts`
   - Added focused cap redirect/copy tests, including no persistence and no `row=` for cap issues.
8. `tests/integration/bot-config-review-static.test.ts`
   - Added wiring assertions for `tortila-cap`, `Fix caps`, cap alert, cap aria, exact range copy, and row-scoped redirect hardening.
9. `tests/integration/bot-read-safety-static.test.ts`
   - Added safety/static coverage for cap target wiring and alert accessibility.
10. `docs/handoffs/20260604-0954-tortila-cap-validation-ux-auditor.md`
    - Per-agent read-only UX handoff.
11. `docs/handoffs/20260604-0954-tortila-cap-validation-source-security-auditor.md`
    - Per-agent read-only source/security handoff.
12. `docs/handoffs/20260604-0954-tortila-cap-validation-tests-auditor.md`
    - Per-agent read-only tests/security handoff.
13. `docs/handoffs/20260604-1016-phase-4-09-tortila-cap-validation.md`
    - This aggregate phase handoff.
## Findings
1. Severity: High. Phase 4.08 embedded Tortila portfolio caps into the strategy map, but cap validation still lacked a section-targeted UX. Evidence: `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md`; `apps/web/src/features/bots/config-error-copy.ts`; `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`. Recommendation implemented: `tortila-cap` now routes to `#tortila-portfolio-caps` with inline alert and exact range copy. Target part: Tortila settings/setup validation UX.
2. Severity: High. Settings/setup previously passed Tortila `saveIssue` only for `tortila-row`, so top-level cap errors could not reach the embedded cap controls. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`. Recommendation implemented: pass full safe `configError`; table handles row and cap targets separately. Target part: settings/setup table wiring.
3. Severity: Medium. Generic row query handling could theoretically include `row=` for a non-row code if a future caller supplied one. Evidence: `apps/web/src/features/bots/config-error-copy.ts`. Recommendation implemented: redirect helper now appends `row=` only for whitelisted row/stage issue codes. Target part: safe validation redirects.
4. Severity: Medium. Existing tests covered row and stage validation but not the three top-level Tortila cap failures. Evidence: `tests/e2e/bot-settings.spec.ts`; `tests/integration/bot-config-action-handler.test.ts`. Recommendation implemented: added focused integration and rendered E2E coverage for portfolio, risk, and entry-throttle cap failures.
## Decisions
1. Tortila caps are WTC reference-profile settings only; UI copy must not claim current live runtime enforcement.
2. Top-level Tortila cap errors are not row errors. They use `target: 'tortila-cap'`, action `Fix caps`, and anchor `#tortila-portfolio-caps`.
3. Per-coin Tortila errors continue to use `tortila-row` and row card alerts.
4. Legacy row/stage validation behavior was preserved.
5. No live server, provider, exchange, worker, env, deploy, or bot-control action was used in this phase.
## Risks
1. Runtime Tortila truth is still not proven by this phase. A separate audited runtime/source phase is required before showing current live config, runtime diffs, exchange proof, or start/stop/apply/retest capability.
2. The worktree was already heavily dirty/untracked from prior phases. This phase did not revert or clean unrelated changes.
3. Full CI/build was not run; focused gates below were run for the touched validation path.
4. The UI now has exact server-side ranges, but there is still no pre-submit client-side numeric validation beyond browser number inputs and post-submit inline error state.
## Verification/tests
RUN:
1. Background read-only agents dispatched before implementation:
   - `docs/handoffs/20260604-0954-tortila-cap-validation-ux-auditor.md`
   - `docs/handoffs/20260604-0954-tortila-cap-validation-source-security-auditor.md`
   - `docs/handoffs/20260604-0954-tortila-cap-validation-tests-auditor.md`
2. Background agents closed after result collection:
   - `019e908e-1c15-7681-aff0-1b9a76b1a21f`
   - `019e908e-3037-7bb3-85c6-525ba23666c1`
   - `019e908e-46f6-74a2-a220-4852947d9ecb`
3. `npx eslint -- 'apps/web/src/features/bots/config-error-copy.ts' 'apps/web/src/features/bots/BotSetupControlCenter.tsx' 'apps/web/src/features/bots/TortilaSymbolConfigTable.tsx' 'apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx' 'apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx' 'tests/e2e/bot-settings.spec.ts' 'tests/integration/bot-config-review-static.test.ts' 'tests/integration/bot-read-safety-static.test.ts' 'tests/integration/bot-config-action-handler.test.ts'` - passed.
4. `npx vitest run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-action-handler.test.ts` - passed, 44 tests.
5. `npm run typecheck -w @wtc/web` - passed.
6. `npm run typecheck` - passed.
7. `$env:E2E_PORT='3437'; npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile` - passed, 18 tests.
8. `npm run secret:scan` - passed.
9. `git diff --check` - passed before aggregate handoff write.

RUN BUT NOT A PRODUCT FAILURE:
1. `$env:E2E_PORT='3436'; npx playwright test tests/e2e/bot-settings.spec.ts --project=chromium` - failed because this repo has Playwright projects `desktop` and `mobile`, not `chromium`. The correct desktop/mobile gate was rerun and passed.

NOT RUN:
1. Full CI/build/coverage - skipped to keep this phase focused on the touched Tortila validation path.
2. DB migrations, seeds, worker tick, production/canary deploy, SSH/tmux/systemd - skipped; not in scope.
3. Live bot start/stop/apply/retest, live diagnostics, exchange ping, provider/API calls, order/position/mark reads - skipped by safety protocol.
4. Env value or secret inspection - skipped; only repository `secret:scan` was run.
5. Git commit, push, PR - not requested.
## Next actions
1. Separate audited runtime/source phase before claiming current Tortila live config, runtime enforcement, live exchange proof, or any control action.
2. Consider client-side inline draft validation for the six cap inputs so invalid ranges can be flagged before submit.
3. Continue broad bot completion with the next isolated phase: Tortila runtime/source evidence map or admin default alignment for Tortila caps, depending on operator priority.
