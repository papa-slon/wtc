# Phase 4.53 Tortila mark-unavailable user/admin handoff

## Scope
Tortila mark/uPnL unavailable semantics on user and selected-user admin surfaces after Phase 4.52. This phase closed the
fresh residual risk that placeholder Mark/uPnL values could still look like live market proof through mixed DB snapshot
sources, green `N/A` styling, admin metric cards, or contract rows that still described `/api/marks` as an integration
target.

This phase did not call real Tortila journal endpoints, `/api/marks`, exchanges, providers, live bot controls, deploy, or
CI.

Read-only phase handoffs:
- [20260605-0535-tortila-user-position-ux-auditor.md](20260605-0535-tortila-user-position-ux-auditor.md)
- [20260605-0535-tortila-user-position-safety-auditor.md](20260605-0535-tortila-user-position-safety-auditor.md)
- [20260605-0535-tortila-user-position-tests-auditor.md](20260605-0535-tortila-user-position-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`
- [20260605-0535-tortila-user-position-ux-auditor.md](20260605-0535-tortila-user-position-ux-auditor.md)
- [20260605-0535-tortila-user-position-safety-auditor.md](20260605-0535-tortila-user-position-safety-auditor.md)
- [20260605-0535-tortila-user-position-tests-auditor.md](20260605-0535-tortila-user-position-tests-auditor.md)
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `docs/CONTRACTS/tortila-adapter.md`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `docs/CONTRACTS/tortila-adapter.md`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0535-tortila-user-position-ux-auditor.md`
- `docs/handoffs/20260605-0535-tortila-user-position-safety-auditor.md`
- `docs/handoffs/20260605-0535-tortila-user-position-tests-auditor.md`
- `docs/handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md`

## Findings
1. Severity P1 - Page-level `adapterMode` was too weak for mixed DB snapshot sources. Evidence:
   `apps/web/src/features/bots/data.tsx:542-545` now computes `markUnavailable` from position, metric, and selected source
   adapters using `sourceAdapterIsReal`, instead of forcing user pages to infer it from metric-first `adapterMode`.
   Recommendation: keep Mark/uPnL display fail-closed for any real Tortila source row. Target part: user bot read model.
2. Severity P1 - User dashboard, positions, and statistics pages could show `N/A` with a positive PnL class. Evidence:
   `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:290`, `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:65`,
   and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:203` now use a neutral class when `markUnavailable` is true.
   Recommendation: do not style unavailable Tortila PnL as up/down. Target part: user bot UI tables.
3. Severity P1 - User pages needed explicit source-boundary copy for unavailable Mark/uPnL. Evidence:
   `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:239-244` and
   `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:38-43` now state that real-mode Tortila positions come from
   persisted read-only journal snapshots and WTC does not call `/api/marks` or a live exchange for Mark/uPnL.
   Recommendation: preserve this copy until a separately audited source can provide live mark values without `/api/marks`.
   Target part: user dashboard and positions page.
4. Severity P1 - Selected-user admin metric-level Unrealized PnL was less strict than the admin position table. Evidence:
   `apps/web/src/app/admin/users/[userId]/bots/page.tsx:72-75` adds `metricUnrealizedPnlLabel`, and
   `apps/web/src/app/admin/users/[userId]/bots/page.tsx:902` uses it for the metric card. Recommendation: keep Tortila
   admin Unrealized PnL as `N/A` unless a real audited source proves it. Target part: selected-user admin metrics.
5. Severity P2 - The Tortila contract still had marks timeout/test rows that looked like runtime acceptance targets.
   Evidence: `docs/CONTRACTS/tortila-adapter.md:446-447` now says `/api/marks` has no WTC timeout budget, and
   `docs/CONTRACTS/tortila-adapter.md:511-512` says marks are excluded from WTC integration tests. Recommendation: keep
   marks coverage as static boundary proof only. Target part: Tortila adapter contract.
6. Severity P2 - Rendered real-mode user route proof remains NOT RUN without a managed DB/user-position fixture. Evidence:
   `tests/integration/bot-read-safety-static.test.ts:116-127` statically pins the user surfaces and read-model guard;
   `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` still pins the selected-user admin DB browser harness.
   Recommendation: run or add a dedicated user-position managed DB Playwright gate only when throwaway DB env is available.
   Target part: future managed user bot DB acceptance.

## Decisions
1. `read.markUnavailable` is now the web-layer source of truth for Tortila Mark/uPnL display.
2. Real Tortila Mark/uPnL stays `N/A` and neutral on user dashboard, positions, statistics, and selected-user admin metric
   surfaces.
3. `/api/marks` remains permanently excluded from WTC runtime and integration tests.
4. Did not add a production test hook or force a rendered real-mode user branch without DB env, because that would create
   false confidence or new app-only test machinery.
5. Closed all three read-only agents after collecting their handoffs.

## Risks
1. Managed user-route rendered proof for real Tortila Mark/uPnL is still NOT RUN because no throwaway DB/user-position env is
   supplied.
2. Real Tortila journal continuity, source-config provenance, safety-signal ingestion, and identity scope remain separate
   NOT RUN gates.
3. The read model still returns numeric `CanonicalPosition.markPrice`/`unrealizedPnl` fields for analytics compatibility;
   future exporters/APIs must honor `markUnavailable` or carry row-level availability metadata.
4. Live bot start/stop/apply-config remains disabled and was not audited in this phase.

## Verification/tests
RUN:
1. Read-only agents created handoffs before implementation:
   [20260605-0535-tortila-user-position-ux-auditor.md](20260605-0535-tortila-user-position-ux-auditor.md),
   [20260605-0535-tortila-user-position-safety-auditor.md](20260605-0535-tortila-user-position-safety-auditor.md), and
   [20260605-0535-tortila-user-position-tests-auditor.md](20260605-0535-tortila-user-position-tests-auditor.md).
2. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/worker-tortila-snapshot.test.ts`
   -> PASS (`5` files, `56` tests).
3. `npm run typecheck -w @wtc/web` -> PASS.
4. `npm run typecheck` -> PASS.
5. `npm run secret:scan` -> PASS.
6. `npm run governance:check` -> PASS (`0` errors, `1` known historical warning; current phase `20260605-0535`, `3`
   cited handoffs present).
7. `git diff --check` -> PASS.
8. Completed background agents were closed after collecting results:
   `019e9655-1b40-7361-9d1a-fe7e7366dac0`, `019e9655-71cc-7f71-b6e4-2bea8fda3c72`, and
   `019e9655-c1ee-7ca1-9d43-16c535734897`.

NOT RUN:
1. User-route managed DB Playwright proof - blocked by absent throwaway DB/user-position env and no existing dedicated
   runner.
2. `npm run e2e:admin-user-bots:db:managed:matrix` - still blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
3. `npm run accept:worker:continuity:managed` - still blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
4. Real Tortila journal read-only fetches - blocked by missing journal env and unresolved auth/firewall proof.
5. Tortila `/api/marks`, exchange ping, provider probes - not run; `/api/marks` is excluded.
6. Live bot start/stop/apply-config - not run; still blocked by safety protocol and absent approved adapters.
7. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this focused local phase.

## Next actions
1. Run the existing managed admin DB matrix when `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is supplied.
2. Add/run a dedicated user-route managed DB Playwright proof for Tortila real-position Mark/uPnL `N/A` if a throwaway DB
   fixture lane is approved.
3. Continue the real Tortila journal/source blockers only with env/auth/firewall proof: journal continuity, source-config
   provenance, safety-signal ingestion, and identity scope.
4. Do not call `/api/marks` or add marks integration tests.
