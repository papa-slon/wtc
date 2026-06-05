# phase-3-88-bot-settings-effective-review handoff
## Scope
Phase 3.88 implemented a focused bot settings clarity slice for Legacy and Tortila after dispatching the required read-only agents. The slice adds an effective settings review layer across user settings, setup, and admin system defaults; closes the highest UX gaps around Legacy blank/custom coin rows and Tortila setup review gating; and expands focused static plus desktop/mobile Playwright coverage. No live bot start/stop/apply-config/retest, worker tick/restart, provider DB access, exchange ping, `.env`, vault/secret inspection, SSH, tmux, or systemd action was run.

Per-agent handoffs:
1. `docs/handoffs/20260604-0152-bot-settings-ux-auditor.md`
2. `docs/handoffs/20260604-0152-bot-settings-platform-security-auditor.md`
3. `docs/handoffs/20260604-0152-bot-settings-tests-visual-auditor.md`

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`
8. `docs/handoffs/20260604-0152-bot-settings-ux-auditor.md`
9. `docs/handoffs/20260604-0152-bot-settings-platform-security-auditor.md`
10. `docs/handoffs/20260604-0152-bot-settings-tests-visual-auditor.md`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/app/admin/bots/config/page.tsx`
14. `apps/web/src/features/bots/config.ts`
15. `apps/web/src/features/bots/config-types.ts`
16. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
17. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
18. `apps/web/src/features/bots/readiness.ts`
19. `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
20. `tests/e2e/bot-settings.spec.ts`
21. `tests/integration/user-resolved-bot-config-static.test.ts`
22. `tests/integration/admin-global-bot-config-static.test.ts`

## Files changed
1. `apps/web/src/features/bots/config-review.ts`
2. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
3. `apps/web/src/features/bots/config-types.ts`
4. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
5. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
6. `apps/web/src/features/bots/config.ts`
7. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
8. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
9. `apps/web/src/app/admin/bots/config/page.tsx`
10. `tests/integration/bot-config-review-static.test.ts`
11. `tests/e2e/bot-settings.spec.ts`
12. `docs/handoffs/20260604-0214-phase-3-88-bot-settings-effective-review.md`

## Findings
1. Severity: High. Users needed a clear effective map before editing dense bot fields; this is now implemented as a pure config-review DTO and a shared review panel. Evidence: `apps/web/src/features/bots/config-review.ts:103` defines the Tortila review, `apps/web/src/features/bots/config-review.ts:165` defines the Legacy review, and `apps/web/src/features/bots/BotConfigReviewPanel.tsx:63` exposes the shared "Effective settings review" frame. Recommendation: keep extending this layer with validation issue summaries rather than adding more disconnected warning cards. Target part: user/admin settings clarity.
2. Severity: High. The review is wired into every relevant surface without creating live control or user-override admin mutation paths. Evidence: user settings builds the review at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:205` and renders it at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:358`; setup builds it at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:212` and renders it at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:319`; admin defaults builds it at `apps/web/src/app/admin/bots/config/page.tsx:73` with `providerAccountCount: 0` at `apps/web/src/app/admin/bots/config/page.tsx:80` and renders it at `apps/web/src/app/admin/bots/config/page.tsx:113`. Recommendation: preserve this split: user settings show resolved/user config, admin defaults show system profiles only. Target part: source-of-truth and admin/user boundary.
3. Severity: High. Tortila setup review no longer treats key presence alone as completion when strategy config is still missing. Evidence: review locking now requires keys and config at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:241`, and the review step shows "Save strategy settings first" at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:508`. Recommendation: add seeded DB browser coverage later for system-default vs custom completion states. Target part: setup wizard correctness.
4. Severity: High. Legacy symbol rows now allow an intentional blank row and manual coin override instead of forcing every generated row into the first base symbol. Evidence: the UI renders `legacy_symbol_custom_` at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:147`, while form issue parsing reads the custom override at `apps/web/src/features/bots/config.ts:432` and save parsing reads it at `apps/web/src/features/bots/config.ts:484`. Recommendation: add a stateful form-submit regression next, including duplicate custom symbol and blank-row behavior. Target part: Legacy coin setup UX.
5. Severity: Medium. The Tortila export preview wording now states that it reflects current saved rows, not unsaved edits. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:165` changes the summary text to "Runtime export preview (current saved)". Recommendation: a future client-side live preview can update as form fields change, but until then the saved-state label should remain explicit. Target part: Tortila export clarity.
6. Severity: Medium. Browser coverage now includes user settings, setup, and admin defaults across desktop/mobile for the effective review. Evidence: `tests/e2e/bot-settings.spec.ts:23`, `tests/e2e/bot-settings.spec.ts:60`, and `tests/e2e/bot-settings.spec.ts:84` assert the review on settings/setup/admin respectively. Recommendation: keep adding route-specific visual specs for admin/user drilldowns as backend/security fixes land. Target part: visual acceptance.
7. Severity: Medium. Platform/security auditor findings remain open because they belong to a separate backend/audit slice: stale `exchange_key.test` wording, missing `before.version` on `bot.config.save`, repository-level user config validation, user override re-validation on load, and route/action runtime tests. Evidence: `docs/handoffs/20260604-0152-bot-settings-platform-security-auditor.md`. Recommendation: run a separate backend/security phase before claiming bot settings source-of-truth fully finished. Target part: audit/source hardening.

## Decisions
1. Effective settings review is pure DTO/UI; it does not load provider data, secrets, exchange clients, or bot adapters.
2. Admin defaults use the same review component but pass `providerAccountCount: 0` because provider pub_id mapping is not a system-default setting.
3. Built-in fallback is not enough to finish Tortila setup review when exchange-key setup is active; the user must have a saved system/default/custom WTC-side strategy source.
4. Legacy rows can now stay intentionally blank and can accept a manual override symbol; parser behavior follows the same selected-or-custom pattern as Tortila.
5. Backend/audit hardening findings are deferred rather than hidden; this phase intentionally stayed in the UX/settings clarity layer.

## Risks
1. The repository remains heavily dirty from prior phases; this handoff lists the Phase 3.88 files touched, but many unrelated modified/untracked files pre-existed.
2. Playwright used mock/demo browser state and did not prove provider DB freshness, production exchange reachability, or live bot continuity.
3. The new review panel summarizes the saved/resolved config at render time; it does not dynamically update while the uncontrolled form fields are being edited.
4. Row-level validation messages are still generic in the route banners; detailed issue text exists in `botConfigFormIssues` but is not yet surfaced per field.

## Verification/tests
RUN:
1. Read-only agents launched before edits and produced handoffs: UX, platform/security, and tests/visual.
2. Focused static/logic Vitest: `npx vitest run tests/integration/bot-config-review-static.test.ts tests/integration/user-resolved-bot-config-static.test.ts tests/integration/admin-global-bot-config-static.test.ts` -> 3 files, 12 tests passed.
3. Web package typecheck: `npm run typecheck -w @wtc/web` -> passed.
4. Focused Playwright desktop/mobile: `npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile` -> 6 tests passed.
5. Diff whitespace gate: `git diff --check -- <phase files>` -> passed.
6. Root typecheck: `npm run typecheck` -> passed.

NOT RUN:
1. Live bot start/stop/apply-config/retest - forbidden by safety protocol for this phase.
2. Worker tick/restart/smoke, provider DB reads/writes, exchange ping, `.env`, vault/secret inspection, SSH, tmux, and systemd - skipped by explicit scope and non-negotiable gates.
3. Full Playwright suite - skipped to keep this phase focused; the bot settings/setup/admin defaults spec was run on desktop and mobile.
4. Full test suite/build/secret scan - not run in this focused slice.

## Next actions
1. Backend/security phase: fix `exchange_key.test` audit wording, add `before.version` to `bot.config.save`, centralize user config forbidden-key validation, re-validate user override rows on load, and add runtime route/action tests.
2. UX phase: surface detailed row-level validation issues for duplicates, RSI/CCI exclusivity, numeric bounds, and stage capacity.
3. Visual phase: add seeded DB browser coverage for system-default/custom/locked states and admin/user drilldowns.
4. Product phase: continue from Legacy settings into Tortila-specific completion only after the source/audit hardening slice is green.
