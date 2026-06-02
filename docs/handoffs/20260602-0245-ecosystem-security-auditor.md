# ecosystem-security-auditor handoff
## Scope
Phase 3.27 read-only security audit before edits for strict LMS filename no-leak policy after Phase 3.26.

Reviewed current LMS filename/hash leak surfaces only: successful download `Content-Disposition`, upload/download audit payloads, teacher material views, DB-backed E2E no-leak assertions, generated-artifact scanner, and current production/status docs. No product code, tests, migrations, gates, servers, DB commands, Playwright, or live services were run.

Note: during inspection, current source appeared to already contain filename-free changes in the LMS download handler, DTOs, tests, and scanner. This handoff reports the current filesystem state; this auditor did not make those edits.

## Files inspected
- `AGENTS.md`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/audit/src/redact.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DATA_MODEL.md`

## Files changed
None - read-only audit.

## Findings
1. P0 - Success `Content-Disposition` no longer uses the original filename in current source, but acceptance is unproven in this audit. Evidence: `apps/web/src/features/lms/material-download.ts:33` maps MIME type to fixed names, and `apps/web/src/features/lms/material-download.ts:46` emits `attachment; filename="${attachmentNameForMime(row.mimeType)}"` instead of `row.fileName`; `tests/integration/lms-material-download-handler.test.ts:119` expects `lesson-material.txt`, and `tests/integration/lms-material-download-handler.test.ts:120` asserts it does not contain `CLEAN_FILE_NAME`; `tests/e2e/lms-db-materials.spec.ts:214` expects `lesson-material.txt`, and `tests/e2e/lms-db-materials.spec.ts:215` asserts it does not contain `fileName`. Recommendation: implementation phase should run focused handler/browser-source tests and then the standard full/e2e gates before marking this surface green. Target part: LMS download handler and DB-backed browser acceptance.

2. P1 - Upload/download audit payloads are filename-free in current source, but upload audit still records material `label` and lifecycle metadata; strict policy must decide whether user-provided labels may equal filenames. Evidence: `packages/db/src/repositories.ts:716` creates base audit metadata with `lessonId`, `label`, and `kind`; current file upload audit fields at `packages/db/src/repositories.ts:719`-`packages/db/src/repositories.ts:728` exclude `fileName`, `mimeType`, and raw hash but include `sizeBytes`, `hasContentHash`, `storageProvider`, `hasStorageKey`, `scanStatus`, `quarantineReason`, and `retainedUntil`; download audit at `packages/db/src/repositories.ts:887`-`packages/db/src/repositories.ts:895` excludes filename/MIME/storage key/raw hash and records summary fields. Recommendation: keep `label` only if policy treats it as explicit teacher-visible content, not original filename metadata; otherwise add validation/copy preventing labels from defaulting to or matching uploaded filenames and add an audit regression for `education.material_upload`. Target part: `@wtc/db` material audit policy and tests.

3. P1 - Teacher material views appear filename-free in current source, but current docs still describe the older teacher display-only filename/MIME policy. Evidence: `packages/lms/src/types.ts:72` aliases `TeacherMaterialView = MaterialView` with no `fileName`/`mimeType`; `apps/web/src/features/lms/queries.ts:78`-`apps/web/src/features/lms/queries.ts:80` returns the student-safe mapper for teacher material views; `apps/web/src/app/teacher/courses/[id]/page.tsx:43` renders generic `file` plus size rather than the stored original filename. Contradicting docs: `docs/ACCEPTANCE_MATRIX_MASTER.md:78`-`docs/ACCEPTANCE_MATRIX_MASTER.md:79` still says teacher projections may add display-only filename/MIME, and `docs/IMPLEMENTED_FILES.md:86`-`docs/IMPLEMENTED_FILES.md:93` still documents the old Phase 3.22 teacher filename DTO behavior. Recommendation: after implementation/gates, update current docs to make filename-free teacher views the new contract and avoid rewriting historical handoffs. Target part: current docs/status/acceptance matrix.

4. P1 - DB E2E assertions cover dynamic original filename leakage in page HTML and success headers, but the artifact scanner cannot fully prove dynamic filename absence by itself. Evidence: the browser spec defines a dynamic filename at `tests/e2e/lms-db-materials.spec.ts:101`, includes it in leak markers at `tests/e2e/lms-db-materials.spec.ts:106`, asserts page HTML omits it at `tests/e2e/lms-db-materials.spec.ts:158`, `tests/e2e/lms-db-materials.spec.ts:194`, and `tests/e2e/lms-db-materials.spec.ts:237`, and asserts success headers omit it at `tests/e2e/lms-db-materials.spec.ts:215`; the scanner blocks DTO field names `fileName`/`mimeType` at `scripts/scan-lms-db-e2e-artifacts.mjs:17`-`scripts/scan-lms-db-e2e-artifacts.mjs:18`, but it skips image bytes at `scripts/scan-lms-db-e2e-artifacts.mjs:103`-`scripts/scan-lms-db-e2e-artifacts.mjs:105` and has no runtime marker input for the generated filename value. Recommendation: add scanner coverage for the fixed E2E filename prefix (`wtc-db-e2e-notes-`) or have the DB E2E runner emit a denylist manifest of dynamic leak markers for post-run artifact scanning. Target part: artifact scanner and DB browser runner.

5. P1 - Current docs correctly keep filename-free delivery/audit as a production blocker, but several current status files are now stale against the apparent source changes. Evidence: `docs/STATUS.md:14`-`docs/STATUS.md:16`, `docs/NEXT_ACTIONS.md:11`-`docs/NEXT_ACTIONS.md:14`, `docs/DEPLOYMENT.md:54`-`docs/DEPLOYMENT.md:60`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` still list filename-free download/audit policy as open; if the implementation is accepted, these must be revised to separate "locally implemented and gate-verified" from "actual DB browser acceptance / production object storage not run." Recommendation: update current docs only after gates observe the new code green. Target part: docs/status and production blockers.

6. P1 - The strict filename no-leak policy still cannot be accepted as production-complete because the real DB browser acceptance and production storage pipeline remain unobserved. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:70`-`docs/ACCEPTANCE_MATRIX_MASTER.md:76` requires an opt-in throwaway DB browser run plus scanner before the LMS DB gate is considered RUN; `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` states `npm run e2e:lms:db` / managed DB browser acceptance is still NOT RUN and real S3/R2 object storage, external malware scanning, signed redirects, object cleanup, and public rollout remain open. Recommendation: implementation phase should run the local gates available without live credentials, then keep DB-backed browser/live storage gates explicitly NOT RUN until credentials/infrastructure are provided. Target part: acceptance evidence and production blockers.

## Decisions
- Treat this handoff as read-only. I did not edit product code, tests, migrations, docs other than this requested handoff, or generated files.
- Treat "original filename no-leak" as no original upload filename in client DTOs, rendered teacher/student/admin pages, successful/failed download headers, and audit payloads. The stored DB column remains an internal implementation detail needed by the current schema unless a separate data-model/migration phase removes or renames it.
- Treat material `label` as distinct from original filename unless product/security policy decides labels must also be checked against uploaded filenames.
- Do not claim the strict policy is green from source inspection alone; gates were intentionally not run in this audit.

## Risks
- Concurrent or pre-existing edits changed the current source during/around this audit; acceptance must be based on a clean implementation phase and observed gate output, not this read-only handoff alone.
- Artifact scanner coverage is weaker than browser assertions for dynamic filenames because screenshots are skipped as images and scanner deny rules are mostly static markers.
- Current docs are partially stale: some files still say filename-free policy is open even though current source appears to implement it, while older docs still mention teacher display filename/MIME.
- The database schema still persists `file_name` internally; that is not a client/audit/header leak by itself, but it remains sensitive metadata if DB/admin raw-payload surfaces expand.

## Verification/tests
- Not run by instruction: no gates, no servers, no DB commands, no Playwright, no live services, no migrations/seeds.
- Read-only verification performed with file inspection and `rg`/`Get-Content` only.
- Required assertions for the implementation phase:
  1. Handler success response uses a generic MIME-derived filename and never contains the stored original filename.
  2. Handler failure responses keep `content-disposition`, `x-lms-sha256`, bytes/base64, original filename, storage key, and hash absent.
  3. `education.material_upload` and `education.material_download` audit rows do not contain original filename, `fileName`, MIME type, raw content hash, DB bytes/base64, or storage key.
  4. Student and teacher material DTOs/rendered pages do not project original filename or MIME fields.
  5. DB browser spec asserts the dynamic uploaded filename is absent from teacher, student, admin, denied-response, and success-header surfaces.
  6. Artifact scanner rejects filename/MIME field names and should be extended to reject the dynamic E2E filename prefix or a runner-provided denylist manifest.

## Next actions
1. In the implementation phase, stabilize the current apparent filename-free code changes and add/adjust any missing audit/upload assertions.
2. Run focused tests for LMS handler/storage/static/E2E-source assertions, then `npm run typecheck`, `npm run typecheck -w @wtc/web`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, and `node scripts/scan-lms-db-e2e-artifacts.mjs`.
3. If gates pass, update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, and `docs/AUDIT_LOG_SCHEMA.md` to reflect the new filename-free local policy while keeping actual DB browser acceptance and production object storage gates NOT RUN.
4. Do not mark production LMS complete until `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` is observed against a throwaway DB and real object-storage/scanner/signed-delivery gates are implemented and accepted.
