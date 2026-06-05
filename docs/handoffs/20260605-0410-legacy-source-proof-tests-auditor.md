# legacy-source-proof-tests-auditor handoff
## Scope
Read-only Phase 4.48 tests/gates audit for surfacing Legacy closed-trade source-proof blocked status on user/admin statistics and readiness surfaces without changing live behavior. This audit inspected only source/docs/tests named by the operator, did not read `.env` or secret files, did not call live services/providers, did not mutate DB state, and did not run server/bot control.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260605-0333-phase-4-47-legacy-source-proof-preflight.md`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/admin/bots/page.tsx`

## Files changed
None - read-only audit, except this handoff.

## Findings
1. Severity P1 - User statistics already blocks fabricated Legacy performance, but the focused tests do not require Phase 4.47 source-proof language. Evidence: `apps/web/src/features/bots/statistics-panels.tsx:587` renders "Closed-trade history"; `apps/web/src/features/bots/statistics-panels.tsx:588` falls back to "pending import"; `apps/web/src/features/bots/statistics-panels.tsx:608` titles the banner "Legacy closed-trade history pending"; `apps/web/src/features/bots/statistics-panels.tsx:609` hides win rate/PF/realized PnL until imports exist. The current static test asserts these generic pending strings at `tests/integration/bot-statistics-completion.test.ts:25`, `tests/integration/bot-statistics-completion.test.ts:31`, and `tests/integration/bot-statistics-completion.test.ts:33`; the rendered gate does the same at `tests/e2e/bot-statistics.spec.ts:73` through `tests/e2e/bot-statistics.spec.ts:78`. Recommendation: add focused assertions that Legacy user statistics surfaces the explicit blocked reason, e.g. "source proof blocked", "stable closed-trade ids and close timestamps required", and "active orders/slots are not accepted substitutes". Target part: `LegacyOperationsPanel`, `BotStatisticsCommandCenter` Legacy summary, `bot-statistics-completion.test.ts`, and `bot-statistics.spec.ts`.
2. Severity P1 - Admin fleet readiness already has the exact closed-trade source-proof gate, but the named tests do not pin it directly. Evidence: `apps/web/src/app/admin/bots/page.tsx:180` defines the "Legacy closed-trade analytics" gate; `apps/web/src/app/admin/bots/page.tsx:182` sets state to "source proof blocked"; `apps/web/src/app/admin/bots/page.tsx:183` explains that active orders or slots are not substitutes; `apps/web/src/app/admin/bots/page.tsx:522` renders the gate table columns. The existing loader test covers sanitized Legacy warning codes at `tests/integration/admin-bot-health-loader.test.ts:360` through `tests/integration/admin-bot-health-loader.test.ts:390`, but it does not inspect the admin page gate copy. Recommendation: add a static assertion in a focused web static test that `apps/web/src/app/admin/bots/page.tsx` contains "Legacy closed-trade analytics", "source proof blocked", the stable id/close timestamp requirement, and no live-control/provider-call markers. Target part: admin fleet bot completion gate map.
3. Severity P1 - Selected-user admin readiness/statistics coverage currently proves scoped statistics and pending imports, but not the source-proof blocked cause. Evidence: `tests/integration/bot-statistics-completion.test.ts:38` through `tests/integration/bot-statistics-completion.test.ts:48` asserts selected-user admin drilldown coverage, "Closed-trade history", "pending import", and no fabricated Legacy PF/win rate/realized PnL; `tests/integration/admin-user-bot-detail-static.test.ts:216` through `tests/integration/admin-user-bot-detail-static.test.ts:223` asserts the selected-user command center and readiness functions. Recommendation: extend selected-user admin static coverage so the readiness/statistics surface distinguishes "blocked_no_source/source proof blocked" from a generic importer backlog, while preserving the existing read-only checks. Target part: `apps/web/src/app/admin/users/[userId]/bots/page.tsx` coverage through `admin-user-bot-detail-static.test.ts` or `bot-statistics-completion.test.ts`.
4. Severity P2 - The data boundary should remain a display of safe status, not a raw source-proof payload renderer. Evidence: `apps/web/src/features/bots/data.tsx:493` through `apps/web/src/features/bots/data.tsx:500` selects `botMetricSnapshots.rawJson`, while trade rows are read only from `bot_trade_imports` at `apps/web/src/features/bots/data.tsx:589` through `apps/web/src/features/bots/data.tsx:595` and mapped to closed trades at `apps/web/src/features/bots/data.tsx:598` through `apps/web/src/features/bots/data.tsx:610`. Recommendation: if Phase 4.48 adds a DTO/status bridge from the Phase 4.47 proof summary, test that it exposes only non-secret status keys such as `blocked_no_source` and missing requirement labels; do not render raw JSON or accept active orders/slots as trade proof. Target part: bot read model and statistics/readiness DTO.
5. Severity P2 - The focused gate set should stay local/static unless an operator explicitly supplies managed DB/browser context. Evidence: `AGENTS.md` and `docs/SESSION_PROTOCOL.md` require exact RUN/NOT RUN reporting and prohibit discovery mutation; `tests/e2e/bot-statistics.spec.ts:63` through `tests/e2e/bot-statistics.spec.ts:81` is the right rendered user-statistics proof once a local app fixture is available, while `tests/integration/admin-bot-health-loader.test.ts:329` through `tests/integration/admin-bot-health-loader.test.ts:332` demonstrates DB-backed loader tests intentionally compare before/after table counts. Recommendation: run static Vitest gates first; run loader/e2e gates only in their normal isolated/local harnesses, never against live provider/service state. Target part: Phase 4.48 verification plan.

## Decisions
1. Recommended test-only surfacing gates; no product/source/test code was changed in this auditor lane.
2. Treated Phase 4.47 as the source of truth: Legacy closed-trade analytics remain blocked until a real source artifact proves stable closed-trade ids, economic fields, provider scope, and close timestamps.
3. Kept admin/user surfaces separate: user statistics needs visible source-proof blocked copy; admin fleet already has it but needs static coverage; selected-user admin needs the same cause reflected in readiness/statistics coverage.
4. Did not recommend any live Legacy provider probe, DB mutation, bot control, or env/secret inspection.

## Risks
1. Generic "pending import" copy can be misread as normal backlog rather than a hard `NO_SOURCE`/`blocked_no_source` safety state.
2. If only the admin fleet page shows "source proof blocked", selected-user admins and users may still infer active slots/orders are enough to unlock PF, win rate, or realized PnL.
3. Rendering raw metric `rawJson` source-proof summaries would risk secret or internal payload leakage; expose a small sanitized DTO/status instead if implementation needs dynamic status.
4. E2E proof depends on the local fixture/server setup; it should not be treated as a live provider acceptance gate.

## Verification/tests
RUN:
1. Static/read-only inspection of the named files only.
2. `git status --short --branch` to record the pre-existing dirty tree state.

NOT RUN:
1. `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - not run because this auditor lane was scoped to identify gates and avoid source/test edits.
2. `npx vitest run tests/integration/admin-bot-health-loader.test.ts` - not run because the operator prohibited DB mutation in this lane; run only in the normal isolated test DB harness.
3. `npx playwright test tests/e2e/bot-statistics.spec.ts --project=chromium` - not run because no local web server/browser fixture gate was requested in this read-only lane.
4. `npm run typecheck -w @wtc/web`, `npm run secret:scan`, and `git diff --check` - not run because no product/source/test code was changed.
5. Any live Legacy DB/provider/exchange probe, worker tick, server/bot control, deploy, CI, or production monitoring - prohibited by scope and safety protocol.

## Next actions
1. Add a focused user statistics assertion in `tests/integration/bot-statistics-completion.test.ts` for "source proof blocked", stable closed-trade ids/close timestamps, and active orders/slots not being accepted substitutes.
2. Add a focused admin fleet static assertion for `apps/web/src/app/admin/bots/page.tsx` covering the "Legacy closed-trade analytics" gate and its blocked source-proof state.
3. Add selected-user admin static coverage in `tests/integration/admin-user-bot-detail-static.test.ts` or `tests/integration/bot-statistics-completion.test.ts` so selected-user readiness/statistics distinguishes source-proof blocked from generic import pending.
4. Add/update the rendered local gate in `tests/e2e/bot-statistics.spec.ts` so Legacy user statistics visibly shows the blocked source-proof reason and Tortila remains free of Legacy blocked copy.
5. Suggested exact commands for the implementation phase:
   - `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts`
   - `npx vitest run tests/integration/admin-bot-health-loader.test.ts`
   - `npx playwright test tests/e2e/bot-statistics.spec.ts --project=chromium`
   - `npm run typecheck -w @wtc/web`
   - `npm run secret:scan`
   - `git diff --check`
