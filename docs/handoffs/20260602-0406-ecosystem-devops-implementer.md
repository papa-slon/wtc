# ecosystem-devops-implementer handoff
## Scope
Read-only Phase 3.31 devops audit for LMS object-store delete/reconciliation cleanup: worker scheduling, env/deployment fences, gate scripts, no-live-credential acceptance, and status docs.
## Files inspected
`apps/worker/src/index.ts`; `apps/worker/src/tick-once.ts`; `scripts/safe-worker-tick.mjs`; `scripts/gates.mjs`; `package.json`; `.env.example`; `docker-compose.yml`; `apps/web/instrumentation.ts`; `apps/web/src/features/lms/actions.ts`; `apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `packages/lms/src/materials.ts`; `packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `tests/integration/worker-tortila-snapshot.test.ts`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `docs/DEPLOYMENT.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/AUDIT_LOG_SCHEMA.md`.
## Files changed
None - read-only audit
## Findings
1. High - Worker cleanup intentionally excluded `s3-r2`. Evidence: `deleteMaterial()` only soft-deletes rows and `purgeExpiredLmsMaterialFiles()` is `db-local` only. Recommendation: add a worker object cleanup pass after DB-local cleanup. Target part: worker cleanup.
2. High - Object helper code lived under `apps/web`, while cleanup runs under `apps/worker`. Evidence: worker imports package-level repos, not web feature modules. Recommendation: keep worker cleanup in worker/package boundaries, not React/web modules. Target part: package boundary.
3. Medium - Remote HTTP must not run inside DB transactions. Recommendation: select bounded candidates, DELETE outside a transaction, then finalize DB rows in a short transaction. Target part: worker orchestration.
4. Medium - Health and logs need separate object cleanup counts. Evidence: existing worker health only had `lmsMaterialsPurged`. Recommendation: add scanned/delete-attempted/delete-confirmed/metadata-only/purged/failed counts. Target part: operational health.
5. Medium - Runtime upload guard drifted from typed config for `APP_ENV=staging`. Evidence: config fences public uploads on staging/production, while runtime upload guard only blocked production. Recommendation: align runtime guard to staging as well. Target part: env/runtime fence.
6. Low - `docs/NEXT_ACTIONS.md` had stale Phase 3.30 "pending broad gates" wording despite green broad gates. Recommendation: correct in Phase 3.31 docs update. Target part: docs truth.
## Decisions
- Use the existing cron-style DB worker tick; do not introduce `job_queue`.
- Treat Phase 3.31 as local mocked HTTP plus PGlite/worker tests by default.
- Keep live S3/R2, live scanner, DB browser, and public rollout gates NOT RUN without credentials.
## Risks
- Deleting DB rows before remote object delete can orphan private objects.
- Raw cleanup logs can leak keys, URLs, headers, or signatures.
- Worker config drift can hide staging/production misconfiguration.
## Verification/tests
Read-only inspection only. Recommended gates: focused LMS/config/worker/scanner tests, typechecks, worker smoke, `node scripts/gates.mjs full`, env-cleared `node scripts/gates.mjs e2e`, artifact scanner, final secret scan, final governance.
## Next actions
1. Add DB candidate/finalize APIs and worker cleanup pass.
2. Add mocked DELETE success, 404, and failure tests.
3. Update docs distinguishing local cleanup from live acceptance.
