# ecosystem-education-implementer handoff
## Scope
Phase 3.24 read-only LMS material lifecycle cleanup audit after Phase 3.23. Scope was limited to inspecting materials schema, repositories, LMS material preparation/scan/retention fields, delete behavior, student/teacher surfaces, tests, worker cleanup precedent, and production blockers. Goal: determine a bounded local implementation plan for quarantine/retention cleanup that moves toward production without object storage or an external malware scanner.

No product code, tests, migrations, non-handoff docs, servers, Playwright runs, DB create/drop, seeds, live endpoints, external services, or gates were run or changed. The only write in this session is this handoff.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md`
- `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.test.ts`
- `packages/audit/src/audit.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/worker/src/index.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`

## Files changed
- `docs/handoffs/20260602-0144-ecosystem-education-implementer.md`

## Findings
1. Severity: High. Evidence: `packages/db/src/schema.ts:263`, `packages/db/src/schema.ts:266`, `packages/db/src/schema.ts:267`, `packages/db/src/schema.ts:272`, `packages/db/src/schema.ts:273`, `packages/db/src/schema.ts:274`, and `packages/db/src/schema.ts:277`. The materials table already has scan state, retained-until, deleted-at, and supporting indexes/checks, so no schema migration is required for a local cleanup slice. Recommendation: implement cleanup in repository/worker code against existing columns instead of adding storage tables. Target part: materials lifecycle cleanup.
2. Severity: High. Evidence: `packages/db/src/repositories.ts:648`, `packages/db/src/repositories.ts:649`, `packages/db/src/repositories.ts:762`, `packages/db/src/repositories.ts:763`, and `packages/db/src/repositories.ts:765`. Delete behavior is visibility-only: `listMaterials()` hides soft-deleted rows, and `deleteMaterial()` writes `deletedAt` plus an audit row but does not clear `fileBytesBase64`, shorten `retainedUntil`, or mark payload cleanup state. Recommendation: on delete, keep the soft-delete row but schedule local byte cleanup by shortening `retainedUntil` for file rows to a bounded deleted-material grace window. Target part: delete behavior.
3. Severity: High. Evidence: `packages/lms/src/materials.ts:117`, `packages/lms/src/materials.ts:123`, `packages/lms/src/materials.ts:126`, `packages/lms/src/materials.ts:146`, `packages/lms/src/materials.ts:151`, `packages/lms/src/materials.ts:153`, and `packages/lms/src/materials.ts:154`. Quarantine is synchronous and deterministic, but `prepareLmsFileMaterial()` still assigns the same retention path as clean files. Recommendation: keep the local deterministic scanner, but give quarantined/failed file payloads a short cleanup retention such as 7 days while preserving the material row and quarantine metadata. Target part: file preparation and retention semantics.
4. Severity: High. Evidence: `packages/db/src/repositories.ts:787`, `packages/db/src/repositories.ts:809`, `packages/db/src/repositories.ts:811`, `apps/web/src/features/lms/material-download.ts:56`, `apps/web/src/features/lms/material-download.ts:61`, `apps/web/src/features/lms/material-download.ts:62`, and `apps/web/src/features/lms/material-download.ts:66`. Downloads already fail closed on entitlement, DB configuration, published course/lesson, `deletedAt IS NULL`, and `scanStatus = 'clean'`. Recommendation: cleanup must not relax the download path; purged local bytes should continue to make the existing lookup return null. Target part: download safety.
5. Severity: Medium. Evidence: `apps/web/src/features/lms/queries.ts:65`, `apps/web/src/features/lms/queries.ts:70`, `apps/web/src/features/lms/queries.ts:72`, `apps/web/src/features/lms/queries.ts:78`, `apps/web/src/features/lms/queries.ts:81`, `packages/lms/src/types.ts:60`, `packages/lms/src/types.ts:66`, `packages/lms/src/types.ts:68`, `packages/lms/src/types.ts:72`, and `packages/lms/src/types.ts:74`. Student DTOs expose only safe display/download fields; teacher DTOs add filename/MIME display only. Recommendation: cleanup should not add new client-visible retention, storage key, hash, quarantine reason, or deleted-at fields. Target part: student/teacher DTO boundary.
6. Severity: Medium. Evidence: `apps/web/src/app/teacher/materials/page.tsx:46`, `apps/web/src/app/teacher/materials/page.tsx:49`, `apps/web/src/app/teacher/materials/page.tsx:68`, `apps/web/src/app/teacher/materials/page.tsx:72`, `apps/web/src/app/teacher/courses/[id]/page.tsx:247`, `apps/web/src/app/teacher/courses/[id]/page.tsx:248`, `apps/web/src/app/teacher/courses/[id]/page.tsx:250`, and `apps/web/src/app/teacher/courses/[id]/page.tsx:253`. Teacher surfaces already disclose the local-storage boundary, allow file/embed creation, show scan status, and expose delete. Recommendation: do not add a teacher-facing "cleanup" control in the bounded local slice; cleanup should be a backend/worker maintenance concern. Target part: teacher materials UI.
7. Severity: Medium. Evidence: `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:147`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:152`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:155`, and `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:156`. Student surfaces show scan status for file materials, render a download link only when the DTO has one, and show "download unavailable" otherwise. Recommendation: after payload cleanup, the student experience should stay as "download unavailable" for blocked/purged rows, not expose cleanup internals. Target part: student lesson UI.
8. Severity: Medium. Evidence: `apps/worker/src/index.ts:70`, `apps/worker/src/index.ts:74`, `apps/worker/src/index.ts:87`, `apps/worker/src/index.ts:92`, `apps/worker/src/index.ts:103`, `apps/worker/src/index.ts:109`, `packages/db/src/repositories.ts:1893`, `packages/db/src/repositories.ts:1895`, and `packages/db/src/repositories.ts:1905`. The worker already has a direct repository-cleanup pattern for expired Axioma JTIs and records counts in worker health. Recommendation: add an LMS repository cleanup primitive and wire it into `dbTick()` with a count such as `lmsMaterialPayloadsPurged`; do not create a live route or external service. Target part: worker maintenance path.
9. Severity: Medium. Evidence: `packages/audit/src/audit.ts:84`, `packages/audit/src/audit.ts:91`, `packages/audit/src/audit.ts:92`, `packages/audit/src/audit.ts:93`, `packages/db/src/repositories.ts:223`, `packages/db/src/repositories.ts:226`, and `packages/db/src/repositories.ts:238`. Audit actions include upload/download/delete but no cleanup action, while DB audit writes are already redacted through `buildEvent()`. Recommendation: add a typed audit action such as `education.material_cleanup` and write a summary-only system audit row for cleanup batches; do not include file bytes, storage keys, hashes, filenames, MIME values, or per-row secret-like material. Target part: audit contract.
10. Severity: Medium. Evidence: `tests/integration/db-lms-ph3-1.test.ts:125`, `tests/integration/db-lms-ph3-1.test.ts:127`, `tests/integration/db-lms-ph3-1.test.ts:128`, `tests/integration/lms-material-download-handler.test.ts:168`, `tests/integration/lms-material-download-handler.test.ts:179`, `tests/e2e/lms-db-materials.spec.ts:180`, `tests/e2e/lms-db-materials.spec.ts:186`, and `tests/e2e/lms-db-materials.spec.ts:188`. Current tests prove quarantined files are visible but not downloadable; they do not prove expired quarantined/deleted payload bytes are purged. Recommendation: add focused repository and LMS unit tests for cleanup selection, byte nulling, audit summary shape, and download still fail-closed after purge. Target part: test coverage.
11. Severity: Medium. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`, `docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md:88`, `docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md:89`, `docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md:90`, and `docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md:91`. Production object storage, a real malware engine, signed-object redirects, quarantine cleanup, observed DB-backed browser acceptance, and public upload rollout remain open; Phase 3.23 still did not run the DB browser gate. Recommendation: keep Phase 3.24 local cleanup explicitly non-production and do not mark production upload readiness from this slice. Target part: release readiness.

## Decisions
- Use the existing `materials` lifecycle columns for the next local cleanup slice; no migration is needed unless the team chooses to add an explicit cleanup timestamp later.
- Cleanup should preserve material rows and safe metadata, and clear only local `db-local` payload bytes (`fileBytesBase64`) for expired quarantined/failed or soft-deleted file materials.
- Do not purge active clean file payloads merely because `retainedUntil <= now`; until object storage exists, purging active clean bytes would break valid course downloads.
- Treat `retainedUntil` for active clean files as a storage-review/retention policy marker, and treat it as a cleanup eligibility marker only after soft delete or blocked scan state.
- Shorten retention at the source for risky/non-visible payloads: quarantined/failed uploads get a short retention window, and file delete shortens remaining retention to a bounded deleted-material grace window.
- Wire cleanup through the worker DB tick, following the existing JTI purge pattern, and record a count in worker health.
- Add a typed, summary-only system audit action for cleanup; do not expose cleanup metadata to student/teacher/admin UI beyond existing scan/download states.

## Risks
- Current quarantined rows receive the default 365-day retention timestamp, so a cleanup primitive alone will not materially reduce quarantine byte lifetime unless preparation/delete retention rules are updated too.
- Clearing `storageKey` would violate the current file lifecycle check for file rows and would remove useful reconciliation identity; keep `storageKey` internal and guarded by existing DTO/static tests.
- Clearing `fileBytesBase64` is allowed by the current schema, but any cleanup implementation must re-check `getMaterialFileForPublishedLesson()` behavior so purged rows cannot stream.
- A worker-only cleanup path depends on a deployed/running worker; docs already state production worker deployment/monitoring is still separate.
- The DB-backed LMS browser acceptance gate remains not observed in this session and was still not observed at Phase 3.23 without a supplied throwaway DB URL.

## Verification/tests
RUN:
1. Read-only memory and workspace orientation: searched prior WTC repo notes, confirmed working directory, and confirmed target handoff path did not already exist.
2. Read-only source discovery with `rg --files` and `rg -n` for LMS material, quarantine, retention, delete, scan, worker, audit, and test surfaces.
3. Read-only line inspection with `Get-Content` for all evidence cited above.
4. Handoff creation only: wrote `docs/handoffs/20260602-0144-ecosystem-education-implementer.md`.

Gates RUN:
- None.

NOT RUN:
1. `node scripts/gates.mjs full` - NOT RUN by explicit read-only scope.
2. `node scripts/gates.mjs e2e` - NOT RUN by explicit read-only scope.
3. `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run db:generate`, and focused Vitest suites - NOT RUN by explicit read-only scope.
4. `npm run e2e:lms:db` and `npm run e2e:lms:db:managed` - NOT RUN because scope forbids Playwright, server start, DB create/drop, migrations/seeds, and gates.
5. Servers, Playwright, DB create/drop, migrations, seeds, live endpoints, external services, object storage, malware scanner, bot/exchange controls, and deploy actions - NOT RUN.

## Next actions
1. Implement `@wtc/lms` retention helpers: keep clean files at 365 days, set quarantined/failed local payload retention to a short window such as 7 days, and provide a deleted-file retention helper such as 30 days.
2. Update `deleteMaterial()` so file rows still soft-delete but shorten `retainedUntil` to the deleted-file grace deadline when that is sooner than the existing value.
3. Add `purgeExpiredLmsMaterialPayloads(db, now, limit)` in `packages/db/src/repositories.ts`. It should update only `kind = 'file'`, `file_bytes_base64 IS NOT NULL`, `retained_until <= now`, and either `deleted_at IS NOT NULL` or `scan_status IN ('quarantined','failed')`; set `file_bytes_base64 = NULL`, preserve storage identity and display metadata, return counts by reason.
4. Add `education.material_cleanup` to the typed audit action list and write one summary-only system audit row per cleanup batch with counts only.
5. Wire the cleanup primitive into `apps/worker/src/index.ts` after the existing JTI purge, add `lmsMaterialPayloadsPurged` to worker health detail and tick logging.
6. Add tests: LMS retention unit tests, DB repository cleanup tests for deleted/quarantined/failed/active-clean selection, audit no-leak assertions, download-after-purge fail-closed assertion, and static DTO no-leak guards.
7. After implementation in a separate session, run focused tests first, then the standard full gates, and keep `npm run e2e:lms:db` / managed DB browser acceptance NOT RUN until a fresh throwaway DB URL is supplied.
