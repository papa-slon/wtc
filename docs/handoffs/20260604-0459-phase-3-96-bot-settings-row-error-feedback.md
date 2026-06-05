# phase-3-96-bot-settings-row-error-feedback handoff
## Scope
Implement the next narrow Legacy/Tortila bot-settings UX/safety slice: carry a sanitized first validation error from the save action to settings/setup pages, highlight the exact affected Tortila coin, Legacy coin, or Legacy stage row, and prove the flow with focused runtime/static/rendered gates.

This phase did not finish the full Legacy/Tortila bot objective. It only improves failed-save clarity on the existing settings/setup surfaces. Live bots, provider DBs, exchange endpoints, worker tick/restart, start/stop/apply/retest, env/vault/secret files, SSH, tmux, and systemd were not touched.

Per-agent handoffs:
- [`docs/handoffs/20260604-0459-bot-settings-row-error-ux-auditor.md`](20260604-0459-bot-settings-row-error-ux-auditor.md)
- [`docs/handoffs/20260604-0459-bot-settings-row-error-security-auditor.md`](20260604-0459-bot-settings-row-error-security-auditor.md)
- [`docs/handoffs/20260604-0459-bot-settings-row-error-tests-auditor.md`](20260604-0459-bot-settings-row-error-tests-auditor.md)

All three background agents were closed after their handoffs were read.

Background agents:
- `019e8f80-07b0-7c00-a0b4-83a683b986d6` closed after result collection.
- `019e8f80-1be0-7b00-bc11-827fce752543` closed after result collection.
- `019e8f80-3164-7290-92d5-5e99c35a9c78` closed after result collection.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0424-phase-3-95-bot-rendered-admin-user-gate.md`
8. `docs/handoffs/20260604-0459-bot-settings-row-error-ux-auditor.md`
9. `docs/handoffs/20260604-0459-bot-settings-row-error-security-auditor.md`
10. `docs/handoffs/20260604-0459-bot-settings-row-error-tests-auditor.md`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/features/bots/config-action-handler.ts`
14. `apps/web/src/features/bots/config.ts`
15. `apps/web/src/features/bots/config-review.ts`
16. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
17. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
18. `apps/web/src/features/bots/config-types.ts`
19. `tests/e2e/bot-settings.spec.ts`
20. `tests/integration/bot-config-action-handler.test.ts`
21. `tests/integration/bot-config-review-static.test.ts`
22. `tests/integration/bot-read-safety-static.test.ts`
23. `tests/integration/bot-runtime-config-sanitizer.test.ts`

## Files changed
1. `apps/web/src/features/bots/config-action-handler.ts`
2. `apps/web/src/features/bots/config.ts`
3. `apps/web/src/features/bots/config-error-copy.ts`
4. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
5. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
6. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
7. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
8. `tests/integration/bot-config-action-handler.test.ts`
9. `tests/integration/bot-config-review-static.test.ts`
10. `tests/integration/bot-read-safety-static.test.ts`
11. `tests/e2e/bot-settings.spec.ts`
12. `docs/handoffs/20260604-0459-bot-settings-row-error-ux-auditor.md`
13. `docs/handoffs/20260604-0459-bot-settings-row-error-security-auditor.md`
14. `docs/handoffs/20260604-0459-bot-settings-row-error-tests-auditor.md`
15. `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`

## Findings
1. Severity: High. Failed custom saves previously collapsed all validation failures into `?err=config`, so users could not know which coin/stage blocked saving. Evidence: prior `handleSaveBotConfigAction()` redirected every form issue to `routes.configError`; settings/setup showed only generic banners. Recommendation: keep redirect-based server actions but append whitelisted `issue` and bounded `row` coordinates. Target part: user bot config save feedback.
2. Severity: High. Row feedback must not leak submitted symbols, provider IDs, raw config, Zod text, or secret-shaped fields. Evidence: security handoff required sanitized coordinates only; implementation now maps validation to fixed codes in `config.ts` and renders copy from `config-error-copy.ts`. Recommendation: keep `SAFE_ERROR_CODES`, `safeRow()`, and generic forbidden-field handling. Target part: disclosure boundary.
3. Severity: High. Users need inline correction near the actual setting, not only a top banner. Evidence: `TortilaSymbolConfigTable` now renders `#tortila-symbol-N [role="alert"]`; `LegacyAveragingConfigTable` now renders `#legacy-symbol-N` and `#legacy-stage-N` alerts with `aria-invalid`/`aria-describedby`. Recommendation: later field-specific highlighting can extend the same whitelisted code contract. Target part: settings UX and accessibility.
4. Severity: Medium. The rendered gate initially failed because Playwright's text locator matched both the top banner and inline row alert. Evidence: first rendered run had 4 strict-mode locator failures; after locator scoping to the row alert, the same gate passed 10/10. Recommendation: keep rendered assertions anchored to row IDs and alert regions. Target part: test stability.

## Decisions
1. Added `BotConfigActionConfigError` with `code` and optional bounded `row`; did not expose raw issue messages or submitted values.
2. Added `firstFormIssue` as an optional injected dependency so the action helper remains testable and surface-independent.
3. Kept forbidden-field failures generic: they can show `issue=forbidden-field`, but never row focus or submitted key/value text.
4. Used a new `config-error-copy.ts` whitelist dictionary for UI copy, so query params only select approved text.
5. Kept admin selected-user bot drilldown out of scope; user-owned settings/setup only were wired in this phase.

## Risks
1. This is first-error-only feedback; multiple invalid rows still require iterative correction.
2. Field-level focus is coarse in this slice: the affected row/card is highlighted, while exact input-level targeting can be added later using the same safe code model.
3. The worktree remains heavily dirty from prior phases; this phase preserved unrelated dirty files and did not revert them.
4. Full DB-backed admin-user rendered acceptance is still blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, inherited from Phase 3.95.

## Verification/tests
RUN:
1. Required protocol/status docs and Phase 3.95 aggregate were read before edits.
2. `git status --short --branch` was inspected before edits; branch was `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty state.
3. Read-only agents were dispatched before edits and wrote the three per-agent handoffs listed above.
4. `npx vitest run tests/integration/bot-config-action-handler.test.ts` - first attempt failed because direct `config.ts` import could not resolve `@/lib/backend` in this Vitest file; test strategy was changed to injected deps/source checks.
5. `npx vitest run tests/integration/bot-config-action-handler.test.ts` - PASS, 1 file / 14 tests.
6. `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - first attempt failed on stale static assertion for literal `Configuration was not saved`; assertion was updated for dynamic `botConfigErrorCopy`.
7. `npx vitest run tests/integration/bot-config-action-handler.test.ts tests/integration/bot-config-review-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts` - PASS, 4 files / 43 tests.
8. `npm run typecheck` - PASS.
9. `npm run typecheck -w @wtc/web` - PASS.
10. `npm run lint` - PASS.
11. `.next-e2e` cleanup before rendered gate - PASS, removed `apps/web/.next-e2e` after verifying the absolute path stayed inside the workspace.
12. `E2E_PORT=3426 npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line` - first attempt failed 4 tests due Playwright strict text locator ambiguity, not missing UI.
13. `.next-e2e` cleanup before rerun - PASS, removed `apps/web/.next-e2e` after verifying the absolute path stayed inside the workspace.
14. `E2E_PORT=3426 npx playwright test tests/e2e/bot-settings.spec.ts --project=desktop --project=mobile --reporter=line` - PASS, 10 tests.
15. `git diff --check` - PASS.
16. `npm run secret:scan` - PASS.
17. `npm run governance:check` before this aggregate - PASS with 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
18. `git diff --check` after this aggregate - PASS.
19. `npm run secret:scan` after this aggregate - PASS.
20. `npm run governance:check` after this aggregate - PASS with 0 errors, 3 cited per-agent handoffs present, and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
21. Background agents were closed: `019e8f80-07b0-7c00-a0b4-83a683b986d6`, `019e8f80-1be0-7b00-bc11-827fce752543`, `019e8f80-3164-7290-92d5-5e99c35a9c78`.

NOT RUN:
1. Full `npm test` - skipped; focused runtime/static/rendered/type/lint gates were run for this slice.
2. Full `npm run build` - skipped; typecheck and focused rendered Next/Playwright build path were run.
3. Full e2e suite - skipped; only `tests/e2e/bot-settings.spec.ts` desktop/mobile was run.
4. DB-backed admin-user rendered acceptance `npm run e2e:admin-user-bots:db:managed` - blocked/skipped because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is not configured.
5. Live bot start/stop/apply/retest, exchange ping, provider DB read/write, worker tick/restart, env/vault/secret inspection, SSH, tmux, and systemd - forbidden by scope and not run.

## Next actions
1. Extend row feedback to exact field focus if product wants the next UX refinement: add safe `field` enum and mark only the matching input.
2. Add a multi-error summary/count after first-error acceptance is stable.
3. Resume DB-backed admin-user rendered acceptance only when `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is available.
4. Continue the broader bot-completion roadmap with the next new session/phase; do not claim Legacy/Tortila bot completion from this narrow UX slice.
