# Phase 4.52 Tortila marks exclusion handoff

## Scope
Tortila `/api/marks` contract and rendering truth fix. This phase cleaned the WTC contract so `/api/marks` is consistently
excluded, prevented real Tortila worker snapshots from persisting mark/uPnL placeholders as if they were live values, and
made selected-user admin Tortila open-position mark/uPnL display `N/A`.

This phase did not call real Tortila journal endpoints, `/api/marks`, exchanges, providers, live bot controls, deploy, or CI.

Read-only phase handoffs:
- [20260605-0520-tortila-marks-contract-safety-auditor.md](20260605-0520-tortila-marks-contract-safety-auditor.md)
- [20260605-0520-tortila-marks-contract-tests-auditor.md](20260605-0520-tortila-marks-contract-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/tortila-adapter.md`
- [20260605-0520-tortila-marks-contract-safety-auditor.md](20260605-0520-tortila-marks-contract-safety-auditor.md)
- [20260605-0520-tortila-marks-contract-tests-auditor.md](20260605-0520-tortila-marks-contract-tests-auditor.md)
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
- `docs/CONTRACTS/tortila-adapter.md`
- `apps/worker/src/jobs.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0520-tortila-marks-contract-safety-auditor.md`
- `docs/handoffs/20260605-0520-tortila-marks-contract-tests-auditor.md`
- `docs/handoffs/20260605-0520-phase-4-52-tortila-marks-exclusion.md`

## Findings
1. Severity P1 - The Tortila contract contradicted the implementation. Evidence:
   [20260605-0520-tortila-marks-contract-safety-auditor.md](20260605-0520-tortila-marks-contract-safety-auditor.md)
   found `/api/marks` listed as required/polled while adapter and worker code say WTC must never call it. Recommendation:
   remove `/api/marks` from required endpoints and polling guidance; keep only the reference-only excluded section. Target
   part: `docs/CONTRACTS/tortila-adapter.md`.
2. Severity P1 - Selected-user admin could render persisted Tortila mark/uPnL placeholders as real live values. Evidence:
   [20260605-0520-tortila-marks-contract-tests-auditor.md](20260605-0520-tortila-marks-contract-tests-auditor.md)
   identified direct Mark/uPnL table rendering. Recommendation: render Tortila mark/uPnL as `N/A` and pin it in DB spec.
   Target part: admin selected-user page and DB e2e spec.
3. Severity P1 - Real Tortila worker snapshots should not store placeholder mark/uPnL values. Evidence:
   `packages/bot-adapters/src/tortila/tortila.mapping.ts` documents mark price as entry approximation and unrealized PnL as
   unavailable without `/api/marks`; WTC must not call `/api/marks`. Recommendation: only persist those placeholder fields in
   mock mode; omit them in real adapter mode. Target part: `apps/worker/src/jobs.ts`.
4. Severity P2 - The no-`/api/marks` boundary is now guarded statically and in the selected-user DB browser spec. Evidence:
   `tests/integration/two-bot-continuity-contract-static.test.ts` pins contract exclusion, worker omission, and admin `N/A`
   formatters; `tests/e2e/admin-user-bot-detail-db.spec.ts` pins Tortila position Mark/uPnL `N/A`; the harness test pins
   that assertion. Recommendation: run the managed DB matrix when env is supplied. Target part: tests/gates.

## Decisions
1. `/api/marks` remains permanently excluded from WTC.
2. Real Tortila worker snapshots omit mark/uPnL placeholder fields; mock snapshots can keep demo values.
3. Selected-user admin renders Tortila position Mark and uPnL as `N/A`, independent of any persisted placeholder.
4. Did not add a live journal read gate in this phase because journal env/auth/firewall proof is absent.
5. Closed both read-only agents after collecting their handoffs.

## Risks
1. Managed selected-user DB Playwright remains NOT RUN because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is absent.
2. Real Tortila journal continuity remains NOT RUN because journal URL/token env is absent and auth/firewall proof is not
   complete.
3. User-facing bot position pages may still need a separate rendered review for Tortila `markUnavailable` behavior outside
   selected-user admin.
4. The contract is cleaner, but source-config provenance and safety-signal ingestion remain separate Tortila blockers.

## Verification/tests
RUN:
1. Read-only agents created handoffs before implementation:
   [20260605-0520-tortila-marks-contract-safety-auditor.md](20260605-0520-tortila-marks-contract-safety-auditor.md) and
   [20260605-0520-tortila-marks-contract-tests-auditor.md](20260605-0520-tortila-marks-contract-tests-auditor.md).
2. Environment preflight checked `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`,
   `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`, `TORTILA_JOURNAL_BASE_URL`, `TORTILA_JOURNAL_TOKEN`, and
   `JOURNAL_READ_TOKEN`; all were `NOT_SET` in this shell. Values were not printed.
3. `npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/bot-statistics-completion.test.ts tests/integration/worker-tortila-snapshot.test.ts`
   -> PASS (`5` files, `32` tests).
4. `npm run typecheck -w @wtc/web` -> PASS.
5. `npm run typecheck -w @wtc/worker` -> PASS.
6. `npm run typecheck` -> PASS.
7. `npm run secret:scan` -> PASS.
8. `npm run governance:check` -> PASS (`0` errors, `1` known historical warning; current phase `20260605-0520`, `2`
   cited handoffs present).
9. `git diff --check` -> PASS.
10. Completed background agents were closed after collecting results:
   `019e963a-5c5e-7651-8b32-75724c501712` and `019e963a-70ce-7ad3-ba62-86c72984a74b`.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
2. `npm run accept:worker:continuity:managed` - blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
3. Real Tortila journal read-only fetches - blocked by missing journal env and unresolved auth/firewall proof.
4. Tortila `/api/marks`, exchange ping, provider probes - not run; `/api/marks` is excluded.
5. Live bot start/stop/apply-config - not run; still blocked by safety protocol and absent approved adapters.
6. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this focused local phase.

## Next actions
1. Run `npm run e2e:admin-user-bots:db:managed:matrix` when admin DB env is supplied so the pinned Tortila Mark/uPnL `N/A`
   assertion is proven in a managed browser DB run.
2. Add a real Tortila journal read-only continuity gate only after journal auth/firewall and env are available.
3. Review user-facing Tortila position pages for the same `markUnavailable` behavior in a separate focused rendered slice if
   needed; do not call `/api/marks`.
4. Continue reducing named Tortila blockers: source-config provenance, safety-signal ingestion, and identity/provider scope.
