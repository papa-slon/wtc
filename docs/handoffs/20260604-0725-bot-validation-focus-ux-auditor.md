# bot-validation-focus-ux-auditor handoff
## Scope
Phase 4.02 read-only UX/product audit for bot setup/settings validation focus after Phase 4.01.

Scope was limited to the current top-control `Fix row` / `Fix stage` links, row/stage anchors, alerts, scroll-margin, focus affordances, and whether the setup wizard needs rendered validation proof for Tortila and Legacy settings tables.

No product code was edited by this auditor. No live bot services, provider state, secrets, env files, SSH, tmux, systemd, worker ticks, live pings, start/stop/apply/retest, or DB mutation were touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0714-phase-4-01-bot-validation-routing.md`
8. `docs/handoffs/20260604-0721-bot-validation-focus-tests-auditor.md`
9. `docs/handoffs/20260604-0723-bot-validation-focus-security-auditor.md`
10. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
11. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
12. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
15. `packages/ui/src/components.tsx`
16. `packages/ui/src/theme.css`
17. `tests/e2e/bot-settings.spec.ts`
18. `tests/integration/bot-config-review-static.test.ts`
19. `tests/integration/bot-read-safety-static.test.ts`
20. `tests/integration/bot-config-action-handler.test.ts`
21. `playwright.config.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The top-control validation routing is coherent and should not be expanded: active issues map to fragment-only `#tortila-symbol-N`, `#legacy-symbol-N`, or `#legacy-stage-N` links, with `Fix row` / `Fix stage` labels rendered as normal links. Evidence: `apps/web/src/features/bots/BotSetupControlCenter.tsx:111`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:119`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:125`, and `apps/web/src/features/bots/BotSetupControlCenter.tsx:289`. Recommendation: preserve this as sanitized fragment navigation only; do not add loaders, adapter calls, live checks, or raw validation payloads to the control center. Target part: `BotSetupControlCenter` issue row.

2. Severity: High. The row/stage targets already have the smallest useful landing affordances: stable IDs, `tabIndex={-1}` on the active invalid target, local `role="alert"` copy, and `scrollMarginTop` for the sticky 64px app topbar. Evidence: Tortila uses `ISSUE_SCROLL_MARGIN_TOP` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:24` and applies `id`, `tabIndex`, alert, and scroll margin at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:89`; Legacy coin rows mirror this at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:11` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:143`; Legacy stage rows do so at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:366`; sticky topbar height is `packages/ui/src/theme.css:225`. Recommendation: no additional product-code polish is required for basic landing; if touched, move the duplicated inline issue target styling into a shared class with `:target` / `:focus-visible` ring rather than adding another card or banner. Target part: Tortila and Legacy config table anchors.

3. Severity: Medium. Rendered desktop proof now verifies click-through landing and alert visibility, but it proves viewport placement rather than actual browser focus ownership. Evidence: the Playwright helper checks bounding rect only at `tests/e2e/bot-settings.spec.ts:13`; click/hash/viewport checks are present for Tortila row at `tests/e2e/bot-settings.spec.ts:106`, Legacy row at `tests/e2e/bot-settings.spec.ts:129`, Legacy stage at `tests/e2e/bot-settings.spec.ts:151`, and Tortila setup row at `tests/e2e/bot-settings.spec.ts:173`; the current UI focus styling is input-specific at `packages/ui/src/theme.css:213`. Recommendation: the smallest remaining premium polish is test-first: add an optional active-element or visible `:target` / `:focus-visible` assertion; only add a tiny client focus helper if native hash focus fails in Chromium/WebKit. Target part: rendered focus acceptance.

4. Severity: Medium. The setup wizard now has rendered invalid-save proof for the Tortila row path, so setup no longer has zero browser evidence. Evidence: `/app/bots/tortila/setup?step=strategy` invalid risk save is covered at `tests/e2e/bot-settings.spec.ts:160`; setup passes `saveIssue` into Tortila and Legacy tables at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:515` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:523`; helper-level coverage proves Legacy setup can preserve `legacy-stage-capacity` row metadata at `tests/integration/bot-config-action-handler.test.ts:188`. Recommendation: no extra setup proof is mandatory unless the next slice specifically claims Legacy-stage wizard parity; if it does, add one Legacy setup `Fix stage` rendered case. Target part: setup wizard validation proof.

5. Severity: Medium. Alerts are adequate but should not be multiplied: the page-level error banner and inline row/stage alert already create enough accessible error surface, while the control-center row stays an action row rather than another alert. Evidence: `RiskWarningBanner` renders `role="alert"` for errors at `packages/ui/src/components.tsx:56`; settings renders the failed-save banner at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:281`; setup renders it at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:487`; inline alerts render in Tortila and Legacy tables at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:102`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:157`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:390`. Recommendation: keep detailed correction copy in the banner/inline alert, keep the control-center row concise, and avoid adding new `aria-live` regions. Target part: validation alert hierarchy.

6. Severity: Medium. The safety copy remains honest: validation focus does not imply live exchange connectivity or live bot control. Evidence: setup strategy copy says WTC-side intent is never applied to the live bot at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:511`; the control center renders unavailable live-control actions at `apps/web/src/features/bots/BotSetupControlCenter.tsx:222`; focused Playwright asserts no `Connection verified`, `applyConfig`, `startBot`, or `stopBot` text in invalid paths at `tests/e2e/bot-settings.spec.ts:111`, `tests/e2e/bot-settings.spec.ts:134`, `tests/e2e/bot-settings.spec.ts:156`, and `tests/e2e/bot-settings.spec.ts:177`. Recommendation: keep future focus polish out of live bot/provider/exchange language and gates. Target part: setup/settings copy and rendered tests.

## Decisions
1. Treat the current source as already containing the essential Phase 4.02 UX affordances for anchors, scroll margin, and visible alerts.
2. Do not recommend product-code changes unless an explicit active-focus assertion fails; then prefer a tiny focus/style helper over broader component redesign.
3. Treat current setup rendered proof as sufficient for generic wizard validation routing; Legacy setup `Fix stage` is a parity follow-up only if that exact path becomes an acceptance claim.
4. Do not recommend new alerts or louder copy; the premium path is clearer landing/focus, not more warning text.
5. Did not start, stop, restart, ping, apply, retest, or mutate any live bot/provider/exchange system.

## Risks
1. The branch remains heavily dirty/untracked from prior phases; this audit covers only the files and behavior listed above.
2. Native hash navigation can scroll without assigning `document.activeElement` consistently across browsers; current rendered proof checks visible landing, not active focus ownership.
3. This auditor ran only the desktop focused rendered subset, not mobile; mobile should be run before a final rendered acceptance claim.
4. Existing local dev listeners on `3000`, `3410`, `3411`, and `3412` were observed and left untouched; the focused Playwright run used a fresh temporary port.
5. This audit does not prove production deploy state, provider reachability, live exchange connectivity, or live bot runtime behavior.

## Verification/tests
RUN:
1. Read required protocol/truth docs and Phase 4.01/4.02 focused handoffs.
2. Inspected current branch/worktree state: `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked files.
3. Inspected focused source/tests for control-center routing, table anchors/alerts, setup wiring, and UI focus/alert primitives.
4. `npm exec vitest -- run tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts --reporter=dot` - PASS, 2 files / 28 tests.
5. `$env:E2E_PORT='45202'; npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop --grep "invalid|setup invalid" --reporter=line` - PASS, 4 tests.
6. Verified no listener remained on temporary port `45202` after Playwright exited.

NOT RUN:
1. Mobile Playwright - skipped in this UX auditor lane; run before final rendered acceptance.
2. Full `npm test`, full lint, typecheck, production build, coverage, governance, and secret scan - not run; product code was not edited.
3. Full e2e suite - not run; focused invalid validation paths were selected for this audit question.
4. DB-backed, worker, provider, exchange, live bot, SSH, nginx, systemd, tmux, start/stop/apply/retest/ping gates - not run by safety policy and scope.
5. Git staging, commit, push, or PR - not requested.

## Next actions
1. If Phase 4.02 continues, run the same focused Playwright subset on mobile with a fresh `E2E_PORT`.
2. Add a tiny focus/target assertion only if the team wants "focus" to mean active keyboard focus, not just visible anchored landing.
3. If active focus fails, add the smallest helper/class: shared issue target class with `scroll-margin-top`, `:target`, and `:focus-visible`; consider explicit focus only if CSS/native hash behavior is insufficient.
4. Add a Legacy setup `Fix stage` rendered case only if the next acceptance claim specifically includes Legacy stage routing inside `/setup?step=strategy`.
5. Keep all future validation-focus work on sanitized issue code + row coordinates; do not introduce live exchange ping, live bot control, provider DB mutation, or raw secret/provider text.
