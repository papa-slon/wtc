# user-warning-state-ux-tests-auditor handoff
## Scope
Phase 3.87 read-only UX/tests audit of user-facing bot warning surfaces after Phase 3.86. Scope was limited to warning-state DTO/UX/test gaps for `/app/bots`, `/app/bots/[bot]`, `/app/bots/[bot]/safety`, `/app/bots/statistics`, `apps/web/src/features/bots/data.tsx`, and current bot warning tests. No product code, test code, live bots, worker ticks, provider DB reads, `.env`, SSH, tmux, or systemd actions were run.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`
8. `apps/web/src/features/bots/data.tsx`
9. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
10. `apps/web/src/features/bots/meta.ts`
11. `packages/bot-adapters/src/warnings.ts`
12. `packages/bot-adapters/src/types.ts`
13. `packages/bot-adapters/src/adapters.test.ts`
14. `apps/web/src/app/(app)/app/bots/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
17. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
18. `tests/integration/bot-read-safety-static.test.ts`
19. `tests/integration/bot-statistics-static.test.ts`
20. `tests/e2e/smoke.spec.ts`
21. `tests/e2e/bot-settings.spec.ts`
22. `tests/integration/admin-bot-health-loader.test.ts`
23. `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The new `BotWarningSummary` DTO exists, but user-scope blocker paths can still collapse to `none_reported` when the latest health row is `ok` and no canonical codes exist. Evidence: `apps/web/src/features/bots/data.tsx:157-230` derives `none_reported` whenever there are no warnings, no warning read issue, and `health.readState` is `ok`; `emptyDbReadModel` attaches the user-scope/provider issue to metrics/positions/trades/config while setting `warningRead` to `{ data: warnings, issue: null }` at `apps/web/src/features/bots/data.tsx:334-352`; the missing user-scoped snapshot branch repeats that pattern at `apps/web/src/features/bots/data.tsx:478-490`. Recommendation: extend `botWarningSummary` to accept an explicit warning evaluation issue/reason, or pass a warning-specific issue for missing bot instance, ambiguous/missing Legacy provider mapping, and missing user-scoped metric/position/trade snapshots so those states become `not_evaluated` or `unavailable`, not `none_reported`. Target part: `BotWarningSummary` DTO and DB snapshot loader.
2. Severity: High. The safety tab still renders from raw `read.warnings.data` instead of the new summary DTO, so unavailable/not-evaluated warning states are not visible and zero counts can look positive. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:15-20` reduces `read.warnings.data ?? []` into counts; `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:46-56` shows `Active warnings` with `tone="up"` when zero and renders `No active safety events` solely from `warnings.length === 0`. Recommendation: import `WarningSummaryPanel`, render `read.warningSummary`, compute active/total cards from `summary.activeCount` and `summary.count`, and avoid green/up tone when `summary.status` is `unavailable` or `not_evaluated`. Target part: `/app/bots/[bot]/safety`.
3. Severity: High. The statistics warning card still has the pre-DTO empty branch and can claim `No adapter warnings` without distinguishing `none_reported` from unavailable or not evaluated. Evidence: `apps/web/src/app/(app)/app/bots/statistics/page.tsx:393-399` renders warning banners only when `activeRead?.warnings.data.length > 0`; otherwise it emits `EmptyState title="No adapter warnings"`. Recommendation: replace this branch with `WarningSummaryPanel summary={activeRead.warningSummary}` and keep capability notes below it, so statistics uses the same state vocabulary as the bot list/dashboard. Target part: `/app/bots/statistics`.
4. Severity: Medium. The bot list and dashboard are closest to the intended UX, but tests lag the current implementation and do not lock the four-state contract. Evidence: `/app/bots` now requests `['metrics', 'warnings']` and renders `WarningSummaryInline` at `apps/web/src/app/(app)/app/bots/page.tsx:21` and `apps/web/src/app/(app)/app/bots/page.tsx:84`; `/app/bots/[bot]` requests warnings and renders `WarningSummaryPanel` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:113-114` and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:162`; however `tests/integration/bot-read-safety-static.test.ts:70-72` still expects the bot list loader to request only `['metrics']`, and `tests/integration/bot-read-safety-static.test.ts:123-132` only asserts the old safe wrapper, not the summary status vocabulary. Recommendation: update static tests to require `BotWarningStatus = 'warnings_present' | 'none_reported' | 'unavailable' | 'not_evaluated'`, require list/dashboard/safety/statistics adoption of `warningSummary`, and remove stale exact-string expectations. Target part: bot warning static tests.
5. Severity: Medium. Browser/e2e coverage proves persistent Tortila warnings are visible in mock mode, but does not cover empty/evaluation edge states or Legacy. Evidence: `tests/e2e/smoke.spec.ts:140-143` and `tests/e2e/smoke.spec.ts:297-299` assert the Tortila P0 warning; there is no e2e assertion for `snapshot unavailable`, `not fully evaluated`, `none reported`, or Legacy provider mapping/missing snapshot warning states. Recommendation: add a focused Playwright or route-level rendered test fixture for all four labels from `WarningSummaryPanel`, preferably with mocked read models or a DB fixture that does not touch live bots. Target part: warning-state browser coverage.

## Decisions
1. Treat `BotWarningSummary` in `apps/web/src/features/bots/data.tsx` as the intended user-facing DTO owner; do not add page-local status enums.
2. Treat `WarningSummaryPanel` and `WarningSummaryInline` as the intended UX components for warning states.
3. Keep `warnings_present` distinct from `none_reported`; `none_reported` must mean an evaluated warning source returned zero canonical codes, not that runtime/bot safety is all-clear.
4. Keep user-scope readiness blockers separate from live control; warning-state fixes must not enable start, stop, apply-config, retest, provider reads, or exchange actions.

## Risks
1. The worktree changed during the audit: current files now include `BotWarningSummary` and `WarningSummaryPanel` work that was not present in the first read. Findings above reflect the re-read current state, not the earlier stale snapshot.
2. Static tests currently rely on exact source strings in several places, so the next implementation may need careful test updates to avoid brittle false failures while still locking the four-state warning contract.
3. Admin warning summaries still use only `warnings_present | none_reported`; this audit intentionally scoped to user-facing bot pages, but future shared DTO alignment may be useful.

## Verification/tests
RUN:
1. Required protocol/doc read by static file inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`.
2. Static source inspection of scoped user-facing bot warning surfaces and current bot warning tests.

NOT RUN:
1. `npm test`, focused Vitest, Playwright/e2e, browser preview, build, lint, typecheck, secret scan, and governance check - skipped because this phase was requested as a read-only UX/tests audit and the deliverable is an implementation handoff, not proof of code changes.
2. Worker tick/smoke, live bot start/stop/apply-config/retest, exchange ping, provider DB reads, `.env`, vault/secrets, SSH/tmux/systemd - not run by policy and explicit scope.

## Next actions
1. Update `apps/web/src/features/bots/data.tsx` so `BotWarningSummary` receives explicit user-scope warning evaluation issues and cannot turn missing instance/provider mapping/missing snapshots into `none_reported`.
2. Replace raw warning list empty-state rendering in `/app/bots/[bot]/safety` and `/app/bots/statistics` with `WarningSummaryPanel`.
3. Update static tests to require the four-state DTO and component adoption across list, dashboard, safety, and statistics.
4. Add focused browser/rendered coverage for warnings present, none reported, snapshot unavailable, and not fully evaluated without touching live bots or worker/provider paths.
