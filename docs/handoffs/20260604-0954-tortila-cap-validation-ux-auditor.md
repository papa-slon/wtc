# ecosystem-ux-ui-designer handoff
## Scope
Read-only Phase 4.09 UX/product audit for the current Tortila portfolio caps map from Phase 4.08. Scope: inspect how top-level cap validation errors (`tortila-portfolio-limit`, `tortila-risk-limit`, `tortila-entry-throttle`) are copied, routed, and surfaced today, then recommend how users should find and fix those caps inside the Tortila strategy map without confusing cap errors with per-coin row errors.

Out of scope: product code edits, test edits, docs edits beyond this handoff, live server mutation, env/secret inspection, provider/API exchange actions, bot start/stop/apply/test/retest, worker ticks, DB/provider reads or writes, deploy/canary checks, and unrelated dirty worktree cleanup.
## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md`
4. `docs/handoffs/20260604-0926-tortila-portfolio-caps-ux-auditor.md`
5. `docs/handoffs/20260604-0926-tortila-portfolio-caps-source-auditor.md`
6. `docs/handoffs/20260604-0926-tortila-portfolio-caps-tests-security-auditor.md`
7. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
8. `apps/web/src/features/bots/config-error-copy.ts`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `tests/e2e/bot-settings.spec.ts`
12. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
13. `apps/web/src/features/bots/config.ts`
14. `apps/web/src/features/bots/config-review.ts`
## Files changed
None - read-only audit.

Handoff written: `docs/handoffs/20260604-0954-tortila-cap-validation-ux-auditor.md`.
## Findings
1. Severity: High. Phase 4.08 successfully embedded the portfolio caps into the Tortila strategy map, but explicitly left top-level cap validation errors as global follow-up work. Evidence: `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md:64`, `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md:66`, `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md:91`. Recommendation: treat the three Tortila cap codes as strategy-map cap-section errors with their own target and anchor, not as generic form errors. Target part: Tortila cap validation routing.
2. Severity: High. The current error-copy model has no cap-section target: supported targets are `tortila-row`, `legacy-row`, `legacy-stage`, and `global`, while the three cap codes return `global` copy. Evidence: `apps/web/src/features/bots/config-error-copy.ts:4`, `apps/web/src/features/bots/config-error-copy.ts:37`, `apps/web/src/features/bots/config-error-copy.ts:39`, `apps/web/src/features/bots/config-error-copy.ts:141`, `apps/web/src/features/bots/config-error-copy.ts:146`. Recommendation: add a distinct cap target such as `tortila-cap` plus a small cap group (`portfolio`, `risk`, `entry`) so copy, anchors, and aria state can route to the cap section without pretending a coin row failed. Target part: config error copy contract.
3. Severity: High. The setup control center currently falls global errors back to the whole form and labels the action `Review form`; row and stage errors are the only targeted anchors. Evidence: `apps/web/src/features/bots/BotSetupControlCenter.tsx:129`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:140`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:143`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:150`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:262`, `apps/web/src/features/bots/BotSetupControlCenter.tsx:269`. Recommendation: route `tortila-cap` to `#tortila-portfolio-caps`, show action label `Fix caps`, and use the issue's own detail instead of the generic "Open the configuration form below" text. Target part: Bot setup control center validation row.
4. Severity: High. The cap controls now live inside the strategy map, but the cap section has no stable `id`, no cap-level alert, no cap-specific `aria-describedby`, and no invalid state on affected cap inputs; only per-coin rows have targeted alert treatment. Evidence: `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:330`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:350`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:357`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:361`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:368`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:432`, `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:452`. Recommendation: give the portfolio cap block `id="tortila-portfolio-caps"`, render one inline `role="alert"` under the `Portfolio caps` heading for cap issues, set `aria-invalid`/`aria-describedby` only on the affected cap inputs, and leave all coin cards unhighlighted for cap errors. Target part: Tortila strategy-map cap section.
5. Severity: High. Settings and setup pass `saveIssue` into `TortilaSymbolConfigTable` only when the target is `tortila-row`, so top-level cap issues cannot reach the section that now contains the relevant fields. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:559`, `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:565`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:534`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:540`. Recommendation: pass cap issues into the shared Tortila table as a separate prop or broaden `saveIssue` handling to `tortila-row | tortila-cap`, while preserving row-only highlighting for row targets. Target part: settings/setup table wiring.
6. Severity: Medium. The validation source already groups top-level cap fields into the three requested codes and supplies exact server-side ranges, but current copy hides most ranges behind "allowed ranges." Evidence: `apps/web/src/features/bots/config.ts:63`, `apps/web/src/features/bots/config.ts:68`, `apps/web/src/features/bots/config.ts:479`, `apps/web/src/features/bots/config.ts:481`, `apps/web/src/features/bots/config-error-copy.ts:141`, `apps/web/src/features/bots/config-error-copy.ts:146`. Recommendation: make copy field-specific: portfolio caps require whole numbers for max open symbols 1-20, max total units 1-50, and units per direction 1-30; risk caps require halt drawdown 1-95% and daily max loss 0.5-50%; entry throttle requires a whole number 1-20. Target part: cap validation microcopy.
7. Severity: Medium. Current rendered tests prove Tortila row errors and Legacy stage errors can jump to their row/stage anchors, but there is no acceptance path for the three top-level Tortila cap codes. Evidence: `tests/e2e/bot-settings.spec.ts:148`, `tests/e2e/bot-settings.spec.ts:155`, `tests/e2e/bot-settings.spec.ts:157`, `tests/e2e/bot-settings.spec.ts:200`, `tests/e2e/bot-settings.spec.ts:202`, `tests/e2e/bot-settings.spec.ts:215`, `tests/e2e/bot-settings.spec.ts:222`, `tests/e2e/bot-settings.spec.ts:224`. Recommendation: add settings and setup E2E coverage for one `maxOpenSymbols`/unit cap failure, one halt-risk failure, and one entry-throttle failure; assert `Fix caps`, `#tortila-portfolio-caps`, no `row=` query, no `Fix row`, no row-card alert, and no live-control/exchange-proof text. Target part: rendered validation acceptance tests.
## Decisions
1. Top-level Tortila cap failures should be map-level errors, not row errors and not generic global form errors.
2. Recommended anchor: `#tortila-portfolio-caps`, placed on the cap block inside `Tortila strategy map`.
3. Recommended setup-control action label: `Fix caps`. Keep `Fix row` reserved for `tortila-row` and `legacy-row`; keep `Fix stage` reserved for `legacy-stage`.
4. Recommended inline titles: `Fix Tortila portfolio caps`, `Fix Tortila halt caps`, and `Fix Tortila entry throttle`.
5. Keep all copy WTC-reference scoped: "saved profile", "failed draft was not saved", and "not applied to the live bot" are safe; avoid "live capacity", "running limit", "exchange verified", "synced", or "currently enforced".
## Risks
1. If the three cap codes stay `global`, users will see a form-level error while the relevant controls sit inside a specific strategy-map block.
2. If cap codes are forced into `tortila-row`, users may chase the wrong coin card and think a per-coin risk or unit value failed.
3. If only the top banner changes and the cap inputs lack inline alert/invalid state, screen-reader and keyboard users still have to search the map manually.
4. If cap copy implies live enforcement, the UI will overstate WTC reference settings as current Tortila runtime truth.
5. The broader worktree was already heavily dirty on `codex/bot-analytics-settings-canary-20260603`; this audit does not attribute, revert, or overwrite any pre-existing changes.
## Verification/tests
RUN:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a heavily dirty pre-existing worktree before this handoff write.
2. Read-only inspection with `rg`, `Get-Content`, and targeted line-numbered slices of the requested docs/source/test files plus adjacent validation/control-center files.
3. `Test-Path -LiteralPath 'docs/handoffs/20260604-0954-tortila-cap-validation-ux-auditor.md'` - returned `False` before writing.
4. Wrote only `docs/handoffs/20260604-0954-tortila-cap-validation-ux-auditor.md`.

NOT RUN:
1. Playwright, Vitest, typecheck, lint, build, secret scan, governance check, coverage, full CI - skipped because this was an authorized read-only UX/product audit handoff with no product/test edits.
2. Live bot start/stop/apply/test/retest, live diagnostics, exchange ping, order/mark reads, `/api/marks`, worker tick, provider DB reads/writes, raw provider payload inspection, env/secret inspection, SSH/tmux/systemd, production/canary checks - skipped by explicit safety boundary.
3. Git commit, push, PR - not requested.
4. Background agent launch/cleanup - no background agents were launched by this auditor lane; none were left running.
## Next actions
1. Extend `BotConfigErrorTarget` with a cap-section target and map the three top-level Tortila cap codes to group-specific copy.
2. Add `id="tortila-portfolio-caps"` plus inline cap alert/aria handling inside `TortilaSymbolConfigTable`.
3. Pass cap-target issues from settings/setup into the Tortila table while keeping row-target issues row-only.
4. Add focused E2E tests for `tortila-portfolio-limit`, `tortila-risk-limit`, and `tortila-entry-throttle` on settings and setup, including the "not a row error" assertions.
5. Keep any runtime config proof, exchange check, live apply/start/stop, or current-enforcement claim for a separate audited security plus bot-integration phase.
