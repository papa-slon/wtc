# Phase 3.32 LMS upload compensation handoff
## Scope
Local best-effort LMS object-upload compensation for the gap where a clean `s3-r2` object PUT succeeds but material DB creation fails. This phase does not implement durable outbox/pending-row/staging-key retry and does not run live S3/R2, live scanner, or DB-backed browser acceptance.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0429-ecosystem-education-implementer.md](20260602-0429-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0429-ecosystem-security-auditor.md](20260602-0429-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0429-ecosystem-devops-implementer.md](20260602-0429-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-0429-ecosystem-tests-runner.md](20260602-0429-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final operator report.
## Files inspected
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
## Files changed
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260602-0429-ecosystem-education-implementer.md`
- `docs/handoffs/20260602-0429-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0429-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0429-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0429-phase-3-32-lms-upload-compensation.md`
## Findings
1. High - `s3-r2` object PUT followed by material DB failure previously could orphan a clean object with no DB row for the worker to reconcile; evidence: `createMaterialAction` prepared storage before `createMaterial`. Recommendation: delegate file material creation through compensation orchestration; target part: LMS upload action.
2. High - Request-local compensation is still not durable when the compensation DELETE itself fails; evidence: no pending DB row/outbox exists after a failed material insert. Recommendation: keep durable pending-row/outbox/staging-key retry as a production blocker; target part: LMS upload lifecycle.
3. Medium - Quarantined `s3-r2` rows are metadata-only under the scanner invariant and must not trigger object DELETE; evidence: Phase 3.30 scanner boundary. Recommendation: compensate only provider `s3-r2` + clean scan status + storage key; target part: storage helper.
4. Medium - Original material creation errors must remain observable even if cleanup fails; evidence: action troubleshooting and audit semantics depend on the first failing boundary. Recommendation: swallow local compensation failures and rethrow the original error; target part: material-create orchestrator.
## Decisions
- Added `deleteLmsObjectStorageFile()` and `compensateLmsUploadedFile()` to the web LMS storage boundary using signed DELETE, treating 2xx and 404 as reconciled.
- Added `createMaterialWithUploadCompensation()` so `createMaterialAction` delegates the repository write through a testable compensation orchestrator.
- Local compensation is explicitly best-effort only; durable retry/outbox remains open.
## Risks
- If the compensation DELETE fails, an orphaned object can still remain until a future durable retry/staging-key design exists.
- Web and worker still have duplicated object-store signing code.
- Live object-store, live scanner, and DB browser behavior are unverified in this phase.
## Verification/tests
- Focused helper/storage/static tests: `npm test -- tests/integration/lms-material-create-compensation.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-ph3-1-static.test.ts` - PASS (`42` passed).
- Broader focused LMS/config/worker/scanner tests: `npm test -- tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-material-create-compensation.test.ts packages/config/src/env.test.ts` - PASS (`123` passed).
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run worker:smoke` - PASS.
- `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- `node scripts/gates.mjs e2e` with LMS DB env vars cleared - PASS, 40 passed.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 images, 0 blocked containers, 2 missing roots, 70 total artifact files, 0 dynamic markers.
- Final `npm run secret:scan` after docs/handoffs - PASS.
- Final `npm run governance:check` after aggregate handoff - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- `npm run e2e:lms:db` - no fresh `LMS_E2E_DATABASE_URL`.
- `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
- Live S3/R2 upload/download/delete/reconcile acceptance - no object-store credentials.
- Live external scanner acceptance - no operator-approved scanner endpoint/token.
- Durable pending-row/outbox/staging-key retry - intentionally not implemented in Phase 3.32.
- Production public upload rollout - blocked by durable retry, live acceptance, and DB browser evidence.
## Next actions
- Implement durable pending-row/outbox/staging-key retry for failed compensation DELETE and process-level interruption.
- Consolidate web/worker object-store primitives to reduce SigV4 drift.
- Run live S3/R2 upload/download/delete/reconcile acceptance, live external scanner acceptance, and DB-backed browser acceptance before public upload rollout.
