# Phase 4.51 Tortila source-confidence and loop-check handoff

## Scope
Tortila source-confidence parity slice plus an explicit anti-loop audit. This phase stopped further local Legacy
source-proof churn after Phase 4.50, recorded the independent loop-audit verdict, and added Tortila journal/source-confidence
clarity to user statistics and selected-user admin coverage.

This phase did not run real Tortila journal reads, `/api/marks`, exchange pings, live provider probes, live bot
start/stop/apply-config, production deploy, or CI. It did not claim Tortila is fully finished; it closed a local no-env
provenance/UX gap and left real journal/auth/worker gates separate.

Read-only phase handoffs:
- [20260605-0510-loop-audit-auditor.md](20260605-0510-loop-audit-auditor.md)
- [20260605-0510-tortila-final-parity-ux-auditor.md](20260605-0510-tortila-final-parity-ux-auditor.md)
- [20260605-0510-tortila-final-parity-safety-auditor.md](20260605-0510-tortila-final-parity-safety-auditor.md)
- [20260605-0510-tortila-final-parity-tests-auditor.md](20260605-0510-tortila-final-parity-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md`
- [20260605-0510-loop-audit-auditor.md](20260605-0510-loop-audit-auditor.md)
- [20260605-0510-tortila-final-parity-ux-auditor.md](20260605-0510-tortila-final-parity-ux-auditor.md)
- [20260605-0510-tortila-final-parity-safety-auditor.md](20260605-0510-tortila-final-parity-safety-auditor.md)
- [20260605-0510-tortila-final-parity-tests-auditor.md](20260605-0510-tortila-final-parity-tests-auditor.md)
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`

## Files changed
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0510-loop-audit-auditor.md`
- `docs/handoffs/20260605-0510-tortila-final-parity-ux-auditor.md`
- `docs/handoffs/20260605-0510-tortila-final-parity-safety-auditor.md`
- `docs/handoffs/20260605-0510-tortila-final-parity-tests-auditor.md`
- `docs/handoffs/20260605-0510-phase-4-51-tortila-source-confidence-loop-check.md`

## Findings
1. Severity P1 - The loop-audit verdict is "not pure loop, but loop-risk boundary." Evidence:
   [20260605-0510-loop-audit-auditor.md](20260605-0510-loop-audit-auditor.md) says Phase 4.40-4.46 reduced distinct
   local/no-env blockers, while Phase 4.47-4.50 are one useful but now saturated Legacy source-proof cluster.
   Recommendation: do not add more local Legacy source-proof copy/tests unless a managed DB run fails or real source
   evidence arrives. Target part: phase planning.
2. Severity P1 - Tortila's remaining clarity gap was distinct from the Legacy source-proof loop. Evidence:
   [20260605-0510-tortila-final-parity-ux-auditor.md](20260605-0510-tortila-final-parity-ux-auditor.md) recommended
   explicit Tortila journal/source-confidence rows because Legacy now had a stronger "why this data is real enough" story.
   Recommendation: add Tortila journal confidence without claiming real journal/auth completion. Target part: user/admin
   statistics.
3. Severity P1 - User Tortila statistics now expose the journal source boundary. Evidence:
   `apps/web/src/features/bots/statistics-panels.tsx` adds `Tortila journal confidence`, showing persisted journal trades,
   equity samples, open positions, and live-source calls disabled, with copy that analytics are computed only from persisted
   WTC journal snapshots and the page does not call `/api/marks`, live exchange, start/stop, or apply config. Recommendation:
   keep this panel tied to persisted rows, not live browser fetches. Target part: `/app/bots/statistics?bot=tortila`.
4. Severity P1 - Selected-user admin coverage now has a Tortila-only journal gate. Evidence:
   `apps/web/src/app/admin/users/[userId]/bots/page.tsx` adds `tortilaJournalImportGate()` and a Tortila-only
   `Journal import gate` row with `journal evidence present`, persisted user-instance journal row counts, runtime label, and
   explicit "No /api/marks live call" copy. Recommendation: keep this row out of Legacy and keep `Source-proof gate` out of
   Tortila. Target part: admin selected-user coverage matrix.
5. Severity P1 - Tortila is still not finished from an integration/safety standpoint. Evidence:
   [20260605-0510-tortila-final-parity-safety-auditor.md](20260605-0510-tortila-final-parity-safety-auditor.md) lists real
   journal continuity, journal auth/firewall, source-config provenance, safety-signal ingestion, Tortila identity/provider
   scope, and `/api/marks` contract contradiction as remaining blockers. Recommendation: keep these as env/source/safety
   gates, not local UI closure. Target part: remaining roadmap.
6. Severity P2 - Test coverage now proves the new local UI/provenance contract. Evidence:
   `tests/e2e/bot-statistics.spec.ts` asserts the user Tortila journal confidence panel on desktop/mobile; the admin DB spec
   asserts a Tortila-only row-scoped `Journal import gate`; the static harness pins these strings and no-row-control checks.
   Recommendation: run the managed DB matrix when env is supplied to turn the pinned spec into rendered DB proof. Target part:
   acceptance gates.

## Decisions
1. No more local Legacy source-proof microphases unless a managed DB run fails or a real source-proof artifact is provided.
2. Treated Tortila source-confidence as the next non-looping local slice because it is a different product gap from the
   Phase 4.47-4.50 Legacy cluster.
3. Did not call Tortila complete; the new UI is provenance clarity over persisted mock/no-env rows, not real journal
   readiness.
4. Kept `/api/marks` as an excluded source in UI copy; no call to `/api/marks` was added.
5. Closed all four read-only agents after collecting their handoffs.

## Risks
1. Managed DB admin selected-user browser proof is still NOT RUN because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` is absent.
2. Managed worker continuity is still NOT RUN because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is absent.
3. Real Tortila journal reads are still NOT RUN because journal base URL/token env is absent and source auth/firewall remains
   unresolved.
4. The current changes improve local clarity, but do not clear source-config provenance, safety-signal ingestion, Tortila
   provider identity, or the `/api/marks` contract contradiction.
5. The dirty tree remains a release risk until a dedicated git/CI/deploy phase handles the exact tree.

## Verification/tests
RUN:
1. Four read-only handoffs were collected before implementation:
   [20260605-0510-loop-audit-auditor.md](20260605-0510-loop-audit-auditor.md),
   [20260605-0510-tortila-final-parity-ux-auditor.md](20260605-0510-tortila-final-parity-ux-auditor.md),
   [20260605-0510-tortila-final-parity-safety-auditor.md](20260605-0510-tortila-final-parity-safety-auditor.md), and
   [20260605-0510-tortila-final-parity-tests-auditor.md](20260605-0510-tortila-final-parity-tests-auditor.md).
2. Environment preflight checked `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `WORKER_CONTINUITY_ADMIN_DATABASE_URL`,
   `LEGACY_DATABASE_URL`, `LEGACY_LIVE_READS_ENABLED`, `DATABASE_URL`, `REAL_POSTGRES_DATABASE_URL`,
   `TORTILA_JOURNAL_BASE_URL`, and `TORTILA_JOURNAL_TOKEN`; all were `NOT_SET` in this shell. Values were not printed.
3. `npx vitest run tests/integration/bot-statistics-completion.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/legacy-closed-trade-source-proof-static.test.ts`
   -> PASS (`5` files, `33` tests).
4. `npm run typecheck -w @wtc/web` -> PASS.
5. `npm run typecheck` -> PASS.
6. `E2E_PORT=3521 npx playwright test tests/e2e/bot-statistics.spec.ts` -> PASS (`4` tests: Tortila/Legacy desktop and
   mobile).
7. Completed background agents were closed after collecting results:
   `019e9621-385d-73d2-b2cd-393cc19d526f`, `019e9621-4c82-7190-9e77-1520e90e0ec7`,
   `019e9621-6132-78d1-b415-56e9ece0e577`, and `019e9622-e5bb-7c31-bdf5-6bc2925d8e8a`.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`.
2. `npm run accept:worker:continuity:managed` - blocked by missing `WORKER_CONTINUITY_ADMIN_DATABASE_URL`.
3. Real Tortila journal read-only fetches - blocked by missing journal env and unresolved journal auth/firewall proof.
4. Tortila `/api/marks`, exchange ping, provider probes - not run and not added; `/api/marks` remains excluded.
5. Live bot start/stop/apply-config - not run; still blocked by safety protocol and absent approved adapters.
6. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this focused local phase.

## Next actions
1. Stop local Legacy source-proof polish unless a managed DB run fails or real source evidence arrives.
2. When env is supplied, run the managed DB/browser matrix and managed worker continuity, then scan artifacts before
   retaining them.
3. For Tortila real completion, create a separate real journal read-only continuity gate that proves authenticated journal
   reads, `sourceAdapter=tortila`, `readState=ok`, metrics/positions/trades import, redaction, and no `/api/marks`.
4. Decide Tortila identity scope: document/test one journal runtime per WTC bot instance, or implement
   `tortila-journal` provider mapping and scoped worker writes.
5. Clean the Tortila adapter contract so `/api/marks` is consistently documented as excluded from WTC.
