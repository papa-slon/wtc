# bot-validation-focus-tests-auditor handoff
## Scope
Phase 4.02 read-only tests audit for bot settings/setup validation routing after Phase 4.01.

Scope was limited to current tests and nearby source around:

1. Anchor focus/scroll polish for `Fix row` / `Fix stage` validation links.
2. Setup wizard invalid-save validation routing from `/app/bots/[bot]/setup?step=strategy`.
3. Smallest focused test additions only.

No product code, live bot services, provider state, secrets, env files, SSH, tmux, systemd, worker ticks, live pings, start/stop/apply/retest, or DB mutation were touched.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0714-phase-4-01-bot-validation-routing.md`
8. `docs/handoffs/20260604-0700-bot-validation-routing-tests-auditor.md`
9. `docs/handoffs/20260604-0702-bot-validation-routing-ux-auditor.md`
10. `docs/handoffs/20260604-0705-bot-validation-routing-security-auditor.md`
11. `tests/e2e/bot-settings.spec.ts`
12. `tests/integration/bot-config-action-handler.test.ts`
13. `tests/integration/bot-read-safety-static.test.ts`
14. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
15. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
16. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
17. `apps/web/src/features/bots/config-error-copy.ts`
18. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
19. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
20. `package.json`
21. `playwright.config.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. Current rendered settings tests prove the validation issue row, safe link `href`, local alert copy, and no horizontal scroll, but they do not prove the anchor action actually lands the user on the target row/stage after click. Evidence: Tortila settings invalid-save asserts URL, `Fix row` `href="#tortila-symbol-1"`, row alert visibility, and no h-scroll at `tests/e2e/bot-settings.spec.ts:93`; Legacy row does the same for `#legacy-symbol-1` at `tests/e2e/bot-settings.spec.ts:113`; Legacy stage does the same for `#legacy-stage-1` at `tests/e2e/bot-settings.spec.ts:132`; `BotSetupControlCenter` renders the link from sanitized `issueHref(...)` at `apps/web/src/features/bots/BotSetupControlCenter.tsx:119` and `apps/web/src/features/bots/BotSetupControlCenter.tsx:289`. Recommendation: extend the existing three invalid settings tests with one shared helper that clicks `Fix row` / `Fix stage`, asserts the URL hash, and asserts the target row or alert is in the viewport with no page h-scroll. Target part: `tests/e2e/bot-settings.spec.ts`.

2. Severity: High. The source already exposes focusable, scroll-margin-aware targets, but test coverage does not lock that polish. Evidence: Tortila target sections have `id="tortila-symbol-N"`, `tabIndex={-1}` when active, and `scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:91`; Legacy coin sections have the same shape at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:145`; Legacy stage rows have `id="legacy-stage-N"`, conditional `tabIndex={-1}`, and `scrollMarginTop` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:367`; alert containers are focusable with `tabIndex={-1}` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:103`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:157`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:390`. Recommendation: keep the rendered test small by asserting either computed `scrollMarginTop` plus `tabIndex === -1` on the active target, or, if the implementation adds explicit focus, `document.activeElement` equals the row or alert after clicking the control-center link. Target part: anchor focus/scroll assertions in `tests/e2e/bot-settings.spec.ts`.

3. Severity: High. Setup wizard rendered coverage still has no invalid-save routing case, even though the server action route is configured to preserve `step=strategy` and focused query metadata. Evidence: setup routes define `configError` and `configErrorFor` as `/app/bots/${bot}/setup?step=strategy&err=config...` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:89`; setup saves go through `handleSaveBotConfigAction(...)` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:146`; setup passes `activeIssue={configError ?? undefined}` into the control center at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:231` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:282`; current setup Playwright coverage renders strategy/review/setup pages at `tests/e2e/bot-settings.spec.ts:144` but does not submit an invalid setup save; helper-level coverage proves a focused setup redirect can produce `/app/bots/legacy/setup?step=strategy&err=config&issue=legacy-stage-capacity&row=2` at `tests/integration/bot-config-action-handler.test.ts:192`. Recommendation: add one new setup wizard Playwright case in `tests/e2e/bot-settings.spec.ts`, preferably the smallest Tortila risk path: visit `/app/bots/tortila/setup?step=strategy`, fill `input[name="risk_0"]` with `9`, click `Save custom settings`, assert `/setup?step=strategy&err=config&issue=tortila-row-risk&row=1`, assert the `Validation issue` row and `Fix row` link to `#tortila-symbol-1`, reuse the anchor in-viewport helper, and keep `noHScroll`. Target part: setup wizard invalid-save validation routing.

4. Severity: Medium. Additional integration/static tests are not the smallest next move unless redirect sanitization changes. Evidence: action-handler tests already prove row form issues redirect without raw symbol/Zod text at `tests/integration/bot-config-action-handler.test.ts:169`, setup focused redirects at `tests/integration/bot-config-action-handler.test.ts:192`, forbidden fields stay generic without row focus at `tests/integration/bot-config-action-handler.test.ts:201`, safe error codes and row bounds live in `apps/web/src/features/bots/config-error-copy.ts:20` and `apps/web/src/features/bots/config-error-copy.ts:75`, and product-mismatch query params downgrade to global copy at `apps/web/src/features/bots/config-error-copy.ts:211`. Recommendation: do not duplicate sanitization in the new browser test; keep the new setup/anchor checks rendered-only and continue running the existing action-handler/static safety tests as guardrails. Target part: focused Phase 4.02 test gate.

5. Severity: Medium. The focused acceptance gate should stay away from live bot/provider/exchange behavior. Evidence: `bot-read-safety-static.test.ts` asserts `activeIssue`, exact anchor templates, `Fix row`/`Fix stage`, and absence of `providerPubId` in the control center at `tests/integration/bot-read-safety-static.test.ts:115`; it also forbids adapter/network/live-control/secret-shaped tokens across readiness/control-center sources at `tests/integration/bot-read-safety-static.test.ts:147`; Phase 4.01 explicitly did not start, stop, apply, retest, ping, or mutate live bot/provider/exchange systems at `docs/handoffs/20260604-0714-phase-4-01-bot-validation-routing.md:11`. Recommendation: keep Phase 4.02 test additions in `tests/e2e/bot-settings.spec.ts` plus existing focused Vitest safety/action tests; no DB-backed, provider, exchange, worker, or live-control gate is needed for this polish. Target part: verification scope.

## Decisions
1. Recommend one-file test-only work in `tests/e2e/bot-settings.spec.ts` as the smallest product-safe delta.
2. Prefer extending the existing invalid settings tests for anchor click/scroll proof rather than adding separate duplicate scenarios.
3. Prefer one setup invalid-save rendered case, with Tortila risk as the smallest path; Legacy stage remains acceptable if the owning implementer wants setup-stage parity.
4. Treat `scrollMarginTop` / focusability as existing source behavior that needs rendered regression coverage, not as proof of actual click-through acceptance by itself.
5. Do not recommend any live bot, exchange ping, provider DB, worker, secret/env, or production-canary test for this Phase 4.02 polish.

## Risks
1. Native hash navigation may scroll but not reliably focus across browsers; an active-element assertion should only be added after explicit focus behavior is implemented or confirmed.
2. The worktree was already heavily dirty/untracked before this audit; recommendations are based on the current local tree after Phase 4.01.
3. Playwright will start a local web server through its config when run; use a fresh `E2E_PORT` and do not reuse or kill existing local servers.
4. Static tests can prove source guardrails, but only Playwright can prove rendered anchor landing and wizard invalid-save routing.

## Verification/tests
RUN:
1. Read `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and the Phase 4.01 handoff.
2. Inspected focused Phase 4.01 auditor handoffs, bot settings/setup Playwright coverage, bot config action-handler tests, static safety tests, control-center routing, row/stage anchor sources, and package Playwright scripts/config.
3. Checked current branch/worktree state with `git status --short --branch`.
4. Wrote this canonical read-only auditor handoff.

NOT RUN:
1. `npm test` - not run; this audit was inspection/recommendation only.
2. Playwright/e2e - not run; would start a local web server and write screenshots, outside this read-only auditor lane.
3. Lint/typecheck/build/secret scan/governance - not run; no product/test code was edited.
4. DB-backed, worker, provider, exchange, live bot, SSH, nginx, systemd, tmux, start/stop/apply/retest/ping gates - not run by safety policy and scope.
5. Git staging/commit/push/PR - not requested.

## Next actions
1. In `tests/e2e/bot-settings.spec.ts`, add a small helper for validation anchor clicks: click the control-center link, assert hash, assert target/alert is in viewport, assert no h-scroll, and optionally assert active-element only if explicit focus handling is added.
2. Extend the existing Tortila row, Legacy row, and Legacy stage invalid settings tests to reuse that helper.
3. Add one setup wizard invalid-save case for `/app/bots/tortila/setup?step=strategy` with `risk_0=9`, or the Legacy stage equivalent if stage parity is preferred.
4. Run focused gates after the test edits: `npm exec vitest -- run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-read-safety-static.test.ts` and `npm exec playwright -- test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line` with a fresh `E2E_PORT`.
