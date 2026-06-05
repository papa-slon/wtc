# phase-4-10-tortila-runtime-evidence-ladder handoff
## Scope
Phase 4.10 implemented a narrow Tortila/Legacy runtime-source evidence UI slice.

The goal was to make the bot room and statistics page show where bot evidence comes from without
claiming live control, live exchange proof, current runtime enforcement, or a fresh worker tick.

Per `AGENTS.md` / `docs/SESSION_PROTOCOL.md`, read-only background auditors were launched before
any product or test edits. All background agents were closed before this handoff.

Per-agent handoffs:
1. `docs/handoffs/20260604-1025-tortila-runtime-source-bot-integration-auditor.md`
2. `docs/handoffs/20260604-1025-tortila-runtime-source-ux-auditor.md`
3. `docs/handoffs/20260604-1025-tortila-runtime-source-tests-auditor.md`
## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-1016-phase-4-09-tortila-cap-validation.md`
8. `apps/worker/src/index.ts`
9. `apps/web/src/features/bots/data.tsx`
10. `apps/web/src/features/bots/readiness-loader.ts`
11. `apps/web/src/features/bots/readiness.ts`
12. `apps/web/src/features/bots/BotReadinessMap.tsx`
13. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
14. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
15. `apps/web/src/features/bots/statistics-panels.tsx`
16. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
17. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
18. `apps/web/src/features/admin/bot-health-loader.ts`
19. `apps/web/src/app/admin/bots/page.tsx`
20. `packages/bot-adapters/src/types.ts`
21. `tests/integration/bot-read-safety-static.test.ts`
22. `tests/integration/bot-statistics-static.test.ts`
23. `tests/e2e/smoke.spec.ts`
24. The three per-agent handoff files listed in Scope.
## Files changed
1. `apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx`
2. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
3. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
4. `tests/integration/bot-read-safety-static.test.ts`
5. `tests/integration/bot-statistics-static.test.ts`
6. `tests/e2e/smoke.spec.ts`
7. `docs/handoffs/20260604-1025-tortila-runtime-source-bot-integration-auditor.md`
8. `docs/handoffs/20260604-1025-tortila-runtime-source-ux-auditor.md`
9. `docs/handoffs/20260604-1025-tortila-runtime-source-tests-auditor.md`
10. `docs/handoffs/20260604-1045-phase-4-10-tortila-runtime-evidence-ladder.md`
## Findings
1. Severity: High. Existing production user reads for Tortila and Legacy are already DB-snapshot backed in `apps/web/src/features/bots/data.tsx`, but the UI forced users to infer the source chain from separate health, readiness, operation-map, warning, and metric panels. Recommendation implemented: add a shared `BotRuntimeEvidencePanel` that presents the chain as `journal -> worker -> WTC DB snapshot -> scoped page data`, with read state, freshness, snapshot coverage, warning status, and scope copy. Target part: user bot dashboard and statistics.
2. Severity: High. `BotHealth.lastSyncAt`, `staleDataSeconds`, `readState`, and `readStateDetail` were already available but not treated as first-class dashboard proof. Recommendation implemented: render freshness and read-state rows directly from the existing sanitized read model; non-ok states remain warning/error banners, not hidden failures.
3. Severity: High. A metrics row, a health-only row, stale data, mock preview data, and current read-only DB snapshot evidence could visually blur together. Recommendation partially implemented: evidence panel now distinguishes source mode, process signal, freshness, statistics proof, WTC worker check, WTC DB snapshot, and scoped page data. Deeper admin metric-row-vs-metrics-available split remains a next action.
4. Severity: Medium. Statistics needed provenance similar to a professional terminal dashboard. Recommendation implemented: statistics now includes a `Statistics evidence ladder` before performance metrics, so users see source/freshness context before reading PnL, drawdown, PF, positions, and trades.
5. Severity: Medium. Existing smoke expected stale copy (`Risk & audit warnings`) while the current dashboard renders `Runtime status notes`. Recommendation implemented: update the smoke assertion to current UI language and add direct checks for the new dashboard/statistics evidence ladders.
## Decisions
1. This phase did not try to prove the live bot is currently running. It only made the existing read-only evidence chain visible and test-covered.
2. The new panel consumes only the existing `BotReadModel`/`BotHealth` data already loaded by the page. It does not call adapters, worker code, vaults, env, providers, exchanges, or DB mutations.
3. Copy intentionally says read-only evidence, WTC worker check, WTC DB snapshot, and scoped page data. It does not claim exchange verification, live ping success, current enforcement, or live control readiness.
4. User-facing placement is dashboard plus statistics. Admin-specific evidence rows are left for a later phase because admin loader semantics need a separate focused slice.
5. Background agents were closed after their handoffs were collected.
## Risks
1. This is not a live runtime acceptance gate. A fresh worker tick, journal endpoint check, provider/exchange verification, and process supervision proof were intentionally not run.
2. Current runtime config/enforcement for Tortila is still not proven by the journal path. WTC reference settings/caps must stay labelled as WTC-side reference/profile state.
3. Admin fleet/selected-user pages still need the same evidence-ladder language to avoid row-existence implying current runtime proof.
4. The worktree was already heavily dirty/untracked before this phase. This handoff only claims the files listed in `Files changed`.
5. In-app Browser DOM verification succeeded, but the Browser screenshot command timed out; visual screenshot evidence came from the focused Playwright smoke slice instead.
## Verification/tests
RUN:
1. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts` - passed, 34 tests.
2. `npm run typecheck -w @wtc/web` - passed.
3. `npm run lint` - passed.
4. `git diff --check -- 'apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx' 'apps/web/src/app/(app)/app/bots/[bot]/page.tsx' 'apps/web/src/app/(app)/app/bots/statistics/page.tsx' 'tests/integration/bot-read-safety-static.test.ts' 'tests/integration/bot-statistics-static.test.ts' 'tests/e2e/smoke.spec.ts'` - passed.
5. In-app Browser DOM check on `http://127.0.0.1:3420/app/bots/tortila` - confirmed `Runtime evidence ladder`, `WTC worker check`, `WTC DB snapshot`, and `Scoped page data`.
6. In-app Browser DOM check on `http://127.0.0.1:3420/app/bots/statistics?bot=tortila` - confirmed `Statistics evidence ladder`, `journal -> worker -> WTC DB snapshot -> scoped page data`, `WTC worker check`, `WTC DB snapshot`, and `Scoped page data`.
7. `$env:E2E_PORT='3427'; npx playwright test tests/e2e/smoke.spec.ts -g "user dashboard, bot warnings|bot dashboard sub-tabs render" --project=desktop` - passed, 2 tests.
8. Local web dev server started on `http://127.0.0.1:3420` for browser verification; this was a UI dev server only.

NOT RUN:
1. Worker tick / worker smoke - skipped because Phase 4.10 did not mutate or validate live runtime ingestion.
2. DB migrations, seeds, managed DB e2e, or DB mutation - skipped because this UI slice only consumes existing read models.
3. Live provider/API/exchange ping, order/position/mark reads, `/api/marks`, journal endpoint calls - skipped by safety boundary.
4. Bot start/stop/apply/retest/live diagnostics - skipped by safety boundary.
5. Env value, vault, raw secret, raw provider payload inspection - skipped by safety boundary.
6. Full `npm run ci:local`, full `npm test`, full Playwright desktop+mobile suite, build, coverage, governance check, and `npm run secret:scan` - not run due focused phase scope and existing large dirty worktree.
7. Deploy/canary/SSH/tmux/systemd/nginx checks - skipped; no deployment was attempted.
## Next actions
1. Add an admin-side evidence ladder in `apps/web/src/app/admin/bots/page.tsx` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx`, separating fleet health rows from user-scoped snapshot proof.
2. Extend the read model/admin loader with explicit latest metric/position/trade/import timestamps and `metricsAvailable` so the UI can distinguish health-only evidence from analytics evidence.
3. Add journal-page empty-state evidence so "no trades" can mean either fresh worker/no closed trades or stale/missing worker proof.
4. If the next phase needs to answer "the bot did not stop" as a runtime fact, run a separate approved live-runtime acceptance phase with worker/journal/process proof and strict no-mutation boundaries.
