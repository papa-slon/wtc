# phase-3-87-user-warning-state-visual-scope handoff
## Scope
Phase 3.87 implemented the next focused bot UX/data slice for user-facing warning state. The slice prevents empty warning arrays from reading as a bot safety all-clear, adds explicit warning scope for user bot pages, wires the shared warning summary into list/dashboard/safety/statistics, and adds focused static plus Playwright visual proof. This phase did not start, stop, retest, apply config to, or tick any live bot/worker.

Read-only agents were launched before edits and were closed after their results were collected:
1. `docs/handoffs/20260604-0116-user-warning-state-ux-tests-auditor.md`
2. `docs/handoffs/20260604-0116-warning-state-security-auditor.md`
3. `docs/handoffs/20260604-0116-warning-summary-visual-auditor.md`

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`
8. `docs/handoffs/20260604-0116-user-warning-state-ux-tests-auditor.md`
9. `docs/handoffs/20260604-0116-warning-state-security-auditor.md`
10. `docs/handoffs/20260604-0116-warning-summary-visual-auditor.md`
11. `apps/web/src/features/bots/data.tsx`
12. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
13. `apps/web/src/app/(app)/app/bots/page.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
16. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
17. `apps/web/src/app/admin/bots/page.tsx`
18. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
19. `packages/ui/src/theme.css`
20. `tests/integration/bot-read-safety-static.test.ts`
21. `tests/integration/bot-statistics-static.test.ts`
22. `tests/e2e/warning-summary-visual.spec.ts`
23. `package.json`
24. `apps/web/package.json`
25. `playwright.config.ts`

## Files changed
1. `apps/web/src/features/bots/data.tsx`
2. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
3. `apps/web/src/app/(app)/app/bots/page.tsx`
4. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
5. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
6. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
7. `packages/ui/src/theme.css`
8. `tests/integration/bot-read-safety-static.test.ts`
9. `tests/integration/bot-statistics-static.test.ts`
10. `tests/e2e/warning-summary-visual.spec.ts`
11. `docs/handoffs/20260604-0144-phase-3-87-user-warning-state-visual-scope.md`

## Findings
1. Severity: High. User warning summaries needed scope, not just status, so warnings could distinguish adapter warning reads, product health, provider-account health, unscoped runtime health, and not-requested views. Evidence: `apps/web/src/features/bots/data.tsx:72` defines `BotWarningScope`; `apps/web/src/features/bots/data.tsx:81` carries it on `BotWarningSummary`; `apps/web/src/features/bots/WarningSummaryPanel.tsx:27` and `apps/web/src/features/bots/WarningSummaryPanel.tsx:61` render scope in the shared UI. Recommendation: keep future user bot warning work on `BotWarningSummary`, not page-local warning booleans. Target part: user bot warning DTO.
2. Severity: High. Legacy runtime warning codes must not be attributed to a user provider account unless the latest worker health cycle is uniquely scoped. Evidence: `apps/web/src/features/bots/data.tsx:324` mirrors the single-mapped health check; `apps/web/src/features/bots/data.tsx:423` to `apps/web/src/features/bots/data.tsx:428` suppress unscoped Legacy health warnings and marks the scope as `runtime_not_scoped`. Recommendation: preserve this guard until the worker persists provider-scoped warning snapshots directly. Target part: Legacy user warning safety.
3. Severity: High. Missing user bot instance, missing Legacy provider mapping, or missing user-scoped snapshots must not collapse to `none_reported`. Evidence: `apps/web/src/features/bots/data.tsx:388` to `apps/web/src/features/bots/data.tsx:401` pass the read issue into warnings; `apps/web/src/features/bots/data.tsx:545` uses `runtime_not_scoped` for missing user-scoped snapshots; `apps/web/src/features/bots/data.tsx:164` to `apps/web/src/features/bots/data.tsx:230` turns unavailable/not-requested/unscoped states into explicit non-green statuses. Recommendation: any new DB snapshot blocker should pass a warning issue or non-user scope. Target part: DB-backed user read model.
4. Severity: Medium. Safety and statistics were still exposed to misleading empty-warning UI. Evidence: `/app/bots/[bot]/safety` now renders `WarningSummaryPanel` and uses neutral zero-warning tone at `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:49` and `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:55`; statistics now renders the same panel at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:395`. Recommendation: do not reintroduce raw `warnings.length === 0` empty states on bot pages. Target part: user bot warning UX.
5. Severity: Medium. Populated warning/table layouts had desktop and mobile overflow risks. Evidence: the final Playwright spec covers warning surfaces at `tests/e2e/warning-summary-visual.spec.ts:58`; the first visual run exposed desktop overflow on `/app/bots/statistics?bot=tortila`; `packages/ui/src/theme.css:64` and `packages/ui/src/theme.css:119` now constrain grid children/cards and table wrappers. Recommendation: keep the visual spec in the focused bot suite and extend it when admin selected-user warning rows get DB fixtures. Target part: responsive warning/table layout.
6. Severity: Medium. Static coverage lagged the new four-state warning contract. Evidence: `tests/integration/bot-read-safety-static.test.ts:136` to `tests/integration/bot-read-safety-static.test.ts:165` locks scope/status behavior and no all-clear copy; `tests/integration/bot-statistics-static.test.ts:34` to `tests/integration/bot-statistics-static.test.ts:41` locks the statistics warning panel. Recommendation: keep these as regression gates for future bot page edits. Target part: warning-state tests.

## Decisions
1. `none_reported` means only that an evaluated source reported zero canonical warning codes; it does not mean live safety, exchange safety, or permission to control a bot.
2. `runtime_not_scoped`, `not_requested`, and read issues remain visible warning states, not green all-clears.
3. Legacy user runtime health warnings are not user-attributed unless the health cycle reports exactly one mapped provider account.
4. The safety page zero-warning metric is neutral; green is reserved for separately audited safety states, not absence of canonical warning codes.
5. Table overflow is contained inside `.wtc-table-wrap`; page-level horizontal scroll is a visual failure.

## Risks
1. Admin fleet warning summaries remain a simpler two-state model. This phase added CSS/visual coverage for `/admin/bots`, but did not expand `AdminBotWarningSummary` to `unavailable`/`not_evaluated`.
2. Playwright runs in demo/mock mode, so it proves warning UX, overflow, and safety copy with mock adapter data; it does not prove production Postgres/provider DB freshness.
3. Screenshots from `tests/e2e/warning-summary-visual.spec.ts` were generated under `tests/e2e/screenshots/` but are ignored artifacts, not staged source.
4. The wider worktree remains heavily dirty from earlier WTC phases; this handoff only covers the files and gates listed here.

## Verification/tests
RUN:
1. Required protocol reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`.
2. Read-only agents dispatched before edits and closed after completion: UX/tests, security/scope, visual/frontend.
3. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts` - 2 files, 33 tests passed.
4. `npm run typecheck -w @wtc/web` - passed.
5. `npm run typecheck` - passed.
6. `npm run governance:check` - passed with 0 errors and 1 known historical warning for `20260529-1921-integration-risk-auditor.md`.
7. `npx playwright test tests/e2e/warning-summary-visual.spec.ts --project=desktop --project=mobile` - final run passed, 4 tests passed. Earlier red runs exposed and then verified fixes for strict locator drift and desktop statistics overflow.
8. Focused secret/live-control grep over changed warning/UI/test paths found only negative test assertions; no product path introduced `apiKey`, `apiSecret`, `token`, `startBot`, `stopBot`, `applyConfig`, `retest`, `vault.open`, `fetch(`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_URL`, or `Connection verified`.

NOT RUN:
1. Worker tick/smoke/restart, live bot start/stop/apply-config/retest, exchange ping, provider DB reads/writes, `.env`, vault/secrets, SSH, tmux, and systemd - forbidden by phase scope and safety rules.
2. `npm run secret:scan` - not run; a focused changed-path grep was run instead.
3. `npm run lint`, full `npm test`, full `npm run build`, and worker typecheck - not run because this was a focused user warning-state/visual slice in a dirty multi-phase worktree.
4. Production Postgres/e2e DB harness - not run; this phase used mock/demo Playwright only.

## Next actions
1. Align `/admin/bots` `AdminBotWarningSummary` with the richer user warning state or add explicit admin health/read-state status so "none reported" cannot be mistaken for service safety.
2. Add DB-fixture Playwright coverage for `/admin/users/<userId>/bots` populated warning rows when a stable test Postgres harness is selected.
3. Move from health-detail warning inference toward persisted user/provider-scoped warning snapshots when the worker pipeline supports it.
4. Continue the larger bot completion goal with the next slice: production-grade config UX/state coverage for Legacy and Tortila without enabling live control.
