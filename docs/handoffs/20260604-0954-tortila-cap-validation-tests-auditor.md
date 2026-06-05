# ecosystem-tests-runner handoff
## Scope
Read-only tests/security audit for Tortila top-level cap validation UX after Phase 4.08. Scope was to inspect current tests and recommend focused gates proving portfolio limit, risk halt, and entry throttle errors render useful global/inline guidance, do not route users to coin row anchors, and do not make live-control claims.

No product code, tests, or docs were edited outside this handoff. No live server mutation, env/secret inspection, provider/API exchange action, bot start/stop/apply/test, worker tick, deploy, or live diagnostics were run.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md`
4. `tests/e2e/bot-settings.spec.ts`
5. `tests/integration/bot-config-review-static.test.ts`
6. `tests/integration/bot-read-safety-static.test.ts`
7. `tests/integration/bot-config-action-handler.test.ts`
8. `apps/web/src/features/bots/config-error-copy.ts`
9. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
10. `apps/web/src/features/bots/config.ts`
11. `apps/web/src/features/bots/config-action-handler.ts`
12. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
13. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`

## Files changed
None - read-only audit. Handoff written: `docs/handoffs/20260604-0954-tortila-cap-validation-tests-auditor.md`.

## Findings
1. Severity: High. Evidence: `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md:90`; `tests/e2e/bot-settings.spec.ts:77`; `tests/e2e/bot-settings.spec.ts:148`; `apps/web/src/features/bots/config.ts:479`. Phase 4.08 already names top-level cap validation E2E as next work, while current rendered coverage proves cap display/status and row-targeted Tortila risk errors, not invalid top-level cap save UX. Recommendation: add focused rendered tests for invalid `maxOpenSymbols`/`maxTotalUnits`/`maxUnitsPerDirection`, `haltDrawdownPercent`/`dailyMaxLossPercent`, and `maxNewEntriesPerTick`. Target part: Tortila settings/setup cap validation UX.
2. Severity: High. Evidence: `apps/web/src/features/bots/config.ts:467`; `apps/web/src/features/bots/config.ts:479`; `apps/web/src/features/bots/config.ts:560`; `tests/integration/bot-config-action-handler.test.ts:238`; `tests/integration/bot-config-action-handler.test.ts:242`. The source classifier maps top-level Tortila cap fields to `tortila-portfolio-limit`, `tortila-risk-limit`, and `tortila-entry-throttle`, but the current integration test only checks string wiring and row classifications. Recommendation: add executable action-helper cases using real form input/schema helpers that submit invalid cap fields and assert focused redirects with those issue codes, no `row=` query, and no persistence. Target part: `handleSaveBotConfigAction` focused error routing.
3. Severity: High. Evidence: `apps/web/src/features/bots/config-error-copy.ts:37`; `apps/web/src/features/bots/config-error-copy.ts:141`; `apps/web/src/features/bots/config-error-copy.ts:143`; `apps/web/src/features/bots/config-error-copy.ts:145`; `apps/web/src/features/bots/BotSetupControlCenter.tsx:129`; `apps/web/src/features/bots/BotSetupControlCenter.tsx:143`; `apps/web/src/features/bots/BotSetupControlCenter.tsx:149`. Safe global copy exists for the three Tortila top-level cap categories, and the control center routes global issues to form review instead of row anchors, but there is no focused test proving those codes render as global guidance rather than `Fix row`/`#tortila-symbol-*`. Recommendation: add copy/control-center assertions for each cap issue: target is `global`, action label is `Review form`, href is `#custom-settings` or `#wizard-custom-settings`, and `Fix row` is absent. Target part: validation guidance and anchor routing.
4. Severity: Medium. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:117`; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:129`; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:300`; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:560`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:84`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:96`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:506`; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:535`. Settings and setup both wire real `botConfigFirstFormIssue`, `botConfigErrorRedirect`, route banners, and `TortilaSymbolConfigTable`, but only row errors are passed into row card highlighting. Recommendation: rendered gates should assert top-level cap failures show the route banner and setup-control validation row, while the table receives no row save issue. Target part: settings/setup rendered error surfaces.
5. Severity: Medium. Evidence: `AGENTS.md:74`; `AGENTS.md:81`; `docs/SESSION_PROTOCOL.md:81`; `tests/integration/bot-config-action-handler.test.ts:154`; `tests/integration/bot-config-action-handler.test.ts:320`; `tests/integration/bot-read-safety-static.test.ts:202`. Existing safety tests guard forbidden live-control keys and adapter/network imports, and repo protocol forbids live bot control during discovery. Recommendation: the cap-validation gate set must stay local/static/rendered only and assert absence of `Connection verified`, `applyConfig`, `startBot`, and `stopBot` in the invalid-cap rendered states. Target part: tests/security acceptance boundary.

## Decisions
1. Treat top-level cap validation as global/form-level UX, not a coin-row issue.
2. Keep row-anchor acceptance for per-coin Tortila fields only; cap fields should guide users to the configuration form and cap section.
3. Recommend small focused gates instead of a broad suite: action-helper classification, error-copy/control-center routing, and one rendered Playwright path covering settings plus setup.
4. Keep all proposed gates inside WTC reference-profile behavior. No gate should claim current runtime enforcement, exchange exposure, live apply, bot status, or live diagnostics.

## Risks
1. Without executable top-level cap tests, a future regression could route `maxOpenSymbols`, halt thresholds, or entry throttle failures as generic `form-invalid` or row-focused issues.
2. Without rendered checks, users may see safe copy in source but still get a row anchor or weak guidance in settings/setup.
3. Adding too many Playwright cases could slow the already broad bot settings spec; prefer a compact loop or one settings case plus one setup case, backed by faster Vitest coverage.
4. The worktree was heavily dirty before this audit, including untracked tests/handoffs and modified app files, so future implementers should preserve unrelated changes and isolate the cap-validation diff.

## Verification/tests
RUN:
1. `git branch --show-current` - observed `codex/bot-analytics-settings-canary-20260603`.
2. `git status --short` - observed heavily dirty tree before this handoff; no unrelated files were reverted.
3. Read-only `rg`/`Get-Content` inspections of the files listed above - completed.
4. `Test-Path docs/handoffs/20260604-0954-tortila-cap-validation-tests-auditor.md` before write - target did not exist.

NOT RUN:
1. `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts` - skipped because this lane was read-only audit/recommendation only.
2. `npx playwright test tests/e2e/bot-settings.spec.ts` - skipped because this lane did not run rendered gates or mutate app/test artifacts.
3. `npm run typecheck`, `npm run lint`, `npm run secret:scan`, `npm run build`, full `ci:local` - skipped; no product/test code changes were made.
4. DB migration/generate/seed, worker tick, live server restart/deploy, SSH/systemd/tmux - skipped by safety scope.
5. Live bot start/stop/apply/retest, live diagnostics, exchange ping/order/mark reads, provider/API actions, env/secret/vault inspection - skipped by safety scope.

## Next actions
1. Add Vitest cases in `tests/integration/bot-config-action-handler.test.ts` that use real `botConfigFormInput`, `botConfigSchemaFor`, `botConfigFirstFormIssue`, and focused Tortila routes to assert:
   - `maxOpenSymbols=0` redirects to `?err=config&issue=tortila-portfolio-limit` with no `row=`.
   - `haltDrawdownPercent=100` or `dailyMaxLossPercent=0` redirects to `?err=config&issue=tortila-risk-limit` with no `row=`.
   - `maxNewEntriesPerTick=0` redirects to `?err=config&issue=tortila-entry-throttle` with no `row=`.
   - each failure does not call `persistConfig`.
2. Add copy/control-center assertions that the three cap issue codes return `target: 'global'`, use useful copy, route to `Review form`, and never render `Fix row` or `#tortila-symbol-*`.
3. Add compact Playwright coverage in `tests/e2e/bot-settings.spec.ts` for Tortila settings and setup invalid cap saves. Assert the specific issue code URL, global banner text, `Review form` action, absence of row alert/row anchor, no live-control claims, and no horizontal scroll regression.
4. Suggested focused gate order after implementation: `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts`; then `npx playwright test tests/e2e/bot-settings.spec.ts`; then `npm run typecheck -w @wtc/web`; then `npm run secret:scan` if the diff touches security-sensitive copy or form fields.
