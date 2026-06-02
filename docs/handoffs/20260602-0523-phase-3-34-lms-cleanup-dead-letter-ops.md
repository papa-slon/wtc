# Phase 3.34 LMS cleanup dead-letter ops handoff
## Scope
Add a local, count-only operational review surface for dead-lettered LMS pending upload cleanup tasks after Phase 3.33. This phase does not add acknowledgement, retry-from-dead-letter, row-level task browsing, live object-store acceptance, live scanner acceptance, DB browser acceptance, or public upload rollout.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0524-ecosystem-education-implementer.md](20260602-0524-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0526-ecosystem-db-architect.md](20260602-0526-ecosystem-db-architect.md)
- [docs/handoffs/20260602-0526-ecosystem-security-auditor.md](20260602-0526-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0525-ecosystem-frontend-implementer.md](20260602-0525-ecosystem-frontend-implementer.md)
- [docs/handoffs/20260602-0524-ecosystem-tests-runner.md](20260602-0524-ecosystem-tests-runner.md)

Background agents were collected and closed before the final operator report.
## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
## Files changed
- `packages/db/src/repositories.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- current docs and this handoff set.
## Findings
1. High - Phase 3.33 worker already marked health `error` on pending cleanup failures/dead letters, but admin health projection stripped the count fields. Implemented: LMS pending cleanup count fields are allowlisted by `projectHealthDetail()`. Target part: admin health projection.
2. High - Operators had no first-class count-only review surface for dead-lettered LMS upload cleanup tasks. Implemented: `/admin/system-health` now renders an LMS upload cleanup review card with dead-letter, due retry, scheduled retry, latest dead-letter time, and generic error-code summary only. Target part: admin system health UI.
3. Medium - Dead-letter transitions updated private task state but left no summary audit event. Implemented: `recordLmsObjectCleanupTaskFailure()` writes a summary-only `education.material_cleanup` event when a task first dead-letters. Target part: audit accountability.
4. Medium - A safe admin read model must not select private object locators. Implemented: `summarizeLmsObjectCleanupOperations()` selects only status, reason, attempts, max attempts, run-after, updated time, and generic last error code; it does not select cleanup task IDs or storage keys. Target part: DB repository projection.
5. Medium - Worker `error` was visually treated as a warning in the heartbeat card. Implemented: worker `error` now renders as a bad status pill. Target part: admin system health UX.
## Decisions
- No migration is needed for this phase; existing Phase 3.33 state is sufficient for count-only operational review.
- Do not build row-level browsing, acknowledgement, assignment, or retry-from-dead-letter in this slice.
- Keep cleanup task IDs, storage keys, filenames, hashes, signed URLs, auth headers, scanner details, provider bodies, and raw errors out of admin UI, health detail, audit payloads, and retained artifacts.
## Risks
- Operators can now see dead-letter counts, but there is still no acknowledgement workflow or safe retry-from-dead-letter action.
- Shared web/worker object-store primitives are still duplicated.
- Live S3/R2, live scanner, DB browser, and public upload rollout remain unobserved.
## Verification/tests
- Focused Phase 3.34 tests: `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-lms-cleanup-review.test.ts tests/integration/admin-responsive.test.ts` - PASS (`51` passed).
- Broader focused LMS/admin/worker/scanner tests: `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-lms-cleanup-review.test.ts tests/integration/admin-responsive.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-ph3-1-static.test.ts` - PASS (`94` passed).
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- Initial `npm run governance:check` - PASS, 0 errors / 1 known warning.
- Initial `npm run secret:scan` - PASS.
- `node scripts/gates.mjs full` - PASS, 9/9 gates.
- `node scripts/gates.mjs e2e` - PASS, `44` passed.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, `2` text files, `68` images, `0` blocked containers.
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS, 0 errors / 1 known warning.
- NOT RUN: DB-backed LMS browser acceptance, live S3/R2 upload/download/delete/reconcile acceptance, live external scanner acceptance, dead-letter acknowledgement/retry workflow, shared object-store primitive extraction, and public upload rollout.
## Next actions
- Add a safe acknowledgement/review lifecycle only after a separate security/product slice defines fields and audit semantics.
- Extract shared object-store signing/delete primitives to reduce web/worker drift.
- Run `npm run e2e:lms:db` or managed equivalent when throwaway DB credentials are supplied.
- Run live S3/R2 upload/download/delete/reconcile and live external scanner acceptance with operator-approved credentials.
