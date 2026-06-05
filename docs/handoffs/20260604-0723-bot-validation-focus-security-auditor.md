# bot-validation-focus-security-auditor handoff
## Scope
Phase 4.02 read-only security/data-boundary audit for bot validation focus and setup-route proof.

Inspected `BotSetupControlCenter`, `config-error-copy`, user bot settings/setup pages, Tortila/Legacy config tables, readiness/provider/exchange summary boundaries, and focused tests. The audit question was whether adding row/stage focus-scroll polish and setup-route invalid-save Playwright proof could expose secrets or raw provider/exchange material, mutate settings unexpectedly, imply live connectivity, or cross user/admin boundaries.

No product code was edited by this auditor. No live bot services, SSH, tmux, systemd, worker tick/restart, env/vault/secret file inspection, provider DB mutation, live exchange ping, live bot start/stop/apply/retest/control, or position action was run.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0653-phase-4-00-bot-setup-control-center.md`
8. `docs/handoffs/20260604-0644-bot-setup-control-center-security-auditor.md`
9. `docs/handoffs/20260604-0714-phase-4-01-bot-validation-routing.md`
10. `docs/handoffs/20260604-0705-bot-validation-routing-security-auditor.md`
11. `docs/handoffs/20260604-0700-bot-validation-routing-tests-auditor.md`
12. `docs/handoffs/20260604-0702-bot-validation-routing-ux-auditor.md`
13. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
14. `apps/web/src/features/bots/config-error-copy.ts`
15. `apps/web/src/features/bots/config-action-handler.ts`
16. `apps/web/src/features/bots/config.ts`
17. `apps/web/src/features/bots/runtime-config-sanitizer.ts`
18. `apps/web/src/features/bots/readiness-loader.ts`
19. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
20. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
21. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
22. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
23. `packages/db/src/repositories.ts`
24. `tests/integration/bot-read-safety-static.test.ts`
25. `tests/integration/bot-config-review-static.test.ts`
26. `tests/integration/bot-config-action-handler.test.ts`
27. `tests/integration/bot-runtime-config-sanitizer.test.ts`
28. `tests/e2e/bot-settings.spec.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. The top validation row remains on the safe issue-code boundary: settings/setup derive `activeIssue` only through `botConfigErrorCopy`, the helper accepts only whitelisted issue codes and bounded row numbers, and product-target mismatches downgrade to generic global copy. Evidence: settings computes and passes the issue at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:232` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:262`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:231` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:282`; whitelisting/bounds/product downgrade live at `apps/web/src/features/bots/config-error-copy.ts:20`, `apps/web/src/features/bots/config-error-copy.ts:75`, and `apps/web/src/features/bots/config-error-copy.ts:211`. Recommendation: keep `BotSetupControlCenter.activeIssue` fed only by this helper; do not pass raw form issues, Zod messages, symbols, provider ids, URLs, headers, or runtime JSON. Target part: validation issue copy and control-center props.
2. Severity: High. Focus/scroll polish is presentation-only on existing anchors and does not add a new data, action, or live-control path. Evidence: Tortila uses a constant scroll margin and applies `id`, `aria-describedby`, `tabIndex`, `scrollMarginTop`, and a local `role="alert"` at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:24`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:89`, and `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:102`; Legacy rows/stages do the same at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:11`, `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:143`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:366`. Recommendation: keep focus/scroll work limited to DOM attributes and styling over existing row/stage anchors. Target part: Tortila/Legacy config table focus targets.
3. Severity: High. Setup-route invalid-save proof uses the existing wizard save server action and shared config handler, not a new mutation path. Evidence: setup routes hard validation failures through `configErrorFor` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:87`, `wizardSaveConfig` calls `assertCsrf` before `handleSaveBotConfigAction` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:142`, and the form stays under the existing strategy step at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:501`; the e2e proof exercises `/setup?step=strategy` and asserts safe row focus/no unsafe live-control text at `tests/e2e/bot-settings.spec.ts:160`. Recommendation: keep setup Playwright proof focused on rendered navigation and failed-save state; do not add provider/live probes or raw error assertions. Target part: setup-route invalid-save acceptance.
4. Severity: High. Invalid or forbidden saves should not unexpectedly persist settings, and current handler/test evidence supports that boundary. Evidence: forbidden form keys include credential/provider/raw/live-control names at `apps/web/src/features/bots/config-action-handler.ts:51`; `handleSaveBotConfigAction` rejects forbidden keys before form issue parsing and returns config errors before parse/persist on validation failure at `apps/web/src/features/bots/config-action-handler.ts:159`; focused tests prove forbidden keys and row/stage form issues do not call parse or persist at `tests/integration/bot-config-action-handler.test.ts:154` and `tests/integration/bot-config-action-handler.test.ts:169`. Recommendation: keep invalid-save focus work before parse/persist; do not call `persistConfig` until form issues and schema parse pass. Target part: config action mutation boundary.
5. Severity: Medium. Provider/exchange summaries feeding the control center remain count/state based; however, the adjacent settings page still materializes Legacy provider account rows before masking display. Evidence: exchange readiness loads metadata summary/count only at `apps/web/src/features/bots/readiness-loader.ts:53`, denied access is hidden at `apps/web/src/features/bots/readiness-loader.ts:126`, exchange key list never joins sealed secret rows at `packages/db/src/repositories.ts:404`, metadata summary selects account ids and secret-row ids only at `packages/db/src/repositories.ts:415`, and provider mapping summary returns counts only at `packages/db/src/repositories.ts:1849`; settings derives Legacy provider account views at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:81` but passes only `providerAccountCount` to the control center at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:260` and displays masked `pub_id` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:445`. Recommendation: keep raw/masked provider identity out of focus URLs, issue copy, setup control rows, and setup-route tests. Target part: Legacy provider and exchange-key data boundary.
6. Severity: Medium. The current copy does not imply live exchange connectivity; it explicitly keeps live ping/control disabled. Evidence: `BotSetupControlCenter` says metadata-only readiness passed while live ping is not run, or that the control center does not contact an exchange, at `apps/web/src/features/bots/BotSetupControlCenter.tsx:66`; live-control actions are listed as unavailable at `apps/web/src/features/bots/BotSetupControlCenter.tsx:222`; setup strategy copy says saved intent is never applied to the live bot at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:511`; static tests reject `Connection verified` and live-control tokens at `tests/integration/bot-read-safety-static.test.ts:147`. Recommendation: do not add "connection verified", ping-success, adapter-success, apply, retest, start, or stop wording to this focus/proof slice. Target part: setup/control-center copy and tests.
7. Severity: Medium. Focused static/action tests passed in this audit lane, and the Playwright source now contains setup invalid-save plus click-through viewport assertions, but Playwright itself was not run by this read-only auditor. Evidence: click-through viewport helper and assertions appear at `tests/e2e/bot-settings.spec.ts:13`, `tests/e2e/bot-settings.spec.ts:106`, `tests/e2e/bot-settings.spec.ts:129`, `tests/e2e/bot-settings.spec.ts:151`, and setup invalid-save proof at `tests/e2e/bot-settings.spec.ts:160`. Recommendation: the owning implementation/tests lane should run focused desktop/mobile Playwright before claiming rendered Phase 4.02 acceptance. Target part: rendered e2e gate.

## Decisions
1. Treat the current focus/scroll and setup invalid-save work as acceptable from the security/data-boundary perspective because it is sanitized issue coordinates plus fragment navigation over existing forms.
2. Do not recommend new loaders, DB queries, server actions, route handlers, adapter calls, live exchange pings, or live-control paths for this slice.
3. Keep forbidden-field failures global and unfocused; no row/stage focus for credential/provider/live-control keys.
4. Treat the latest filesystem state as ground truth. The e2e file changed during the audit window; the line evidence above reflects the later re-read.
5. Do not run Playwright in this read-only lane because it starts a local web server and may write browser artifacts.

## Risks
1. The branch remains heavily dirty/untracked from prior phases; this handoff covers only the files and boundaries listed in scope.
2. `BotSetupControlCenter` still trusts its `activeIssue` prop; a future caller could weaken the boundary by bypassing `botConfigErrorCopy`.
3. The Legacy settings page still locally handles provider account rows, even though the control center receives counts only and visible `pub_id` is masked.
4. Rendered browser acceptance was inspected in source only here; Playwright proof is NOT observed green in this audit session.
5. This audit does not prove production deploy state, provider reachability, live exchange connectivity, or live bot runtime behavior.

## Verification/tests
RUN:
1. Read required protocol/truth docs and latest Phase 4.00/4.01 aggregate plus security/tests/UX handoffs.
2. Inspected current git state before the handoff; branch is `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked state.
3. Inspected scoped source/tests with read-only commands and line-number evidence.
4. `npm exec vitest -- run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-config-action-handler.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 4 files / 43 tests.

NOT RUN:
1. Playwright/e2e - not run by this read-only auditor because it starts a local web server and can write browser artifacts.
2. Full `npm test`, full lint, typecheck, production build, coverage, governance, and secret scan - not run; this was a focused read-only audit.
3. Live services, SSH, tmux, systemd, env/vault/secret inspection, provider DB mutation, worker tick/restart, live exchange ping, live bot start/stop/apply/retest/control, or position actions - not run by scope and safety policy.
4. Git staging, commit, push, or PR - not requested.

## Next actions
1. Run focused desktop/mobile Playwright for `tests/e2e/bot-settings.spec.ts` in the owning implementation/tests lane, using a fresh `E2E_PORT`.
2. Keep any future setup/focus tests on sanitized `err/config/issue/row` coordinates and local fragments only.
3. Add a small static assertion if any new `activeIssue` caller appears, proving it uses `botConfigErrorCopy` and not raw validation strings.
4. Keep live exchange ping, Legacy/Tortila apply, start/stop, retest, provider DB mutation, and admin provider mapping out of this focus/proof slice until separate bot-integration and security audits approve them.
