# ecosystem-backend-implementer handoff
## Scope
Phase 3.27 read-only backend/db audit before edits. Scope: LMS filename minimization in DB repository, audit, and download boundaries. Inspect `packages/db/src/repositories.ts`, schema constraints, `MaterialFileDownloadRow`, material upload/download audits, `createMaterial`, cleanup/download compatibility, and tests. Determine the safest no-migration path to avoid raw filenames in audit payloads and success responses while preserving DB integrity and teacher workflows where possible.

## Files inspected
- `AGENTS.md`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `packages/db/migrations/0013_young_martin_li.sql`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`

## Files changed
None - read-only audit. Handoff written at `docs/handoffs/20260602-0245-ecosystem-backend-implementer.md`.

## Findings
1. Severity: High. Evidence: the current repository upload audit is already filename-minimized. `materialAuditAfter()` keeps file upload audit payloads to lesson/label/kind, size, `hasContentHash`, provider, `hasStorageKey`, scan state, quarantine reason, and retention timestamp, with no `fileName`, `mimeType`, raw checksum, storage key, or bytes (`packages/db/src/repositories.ts:716`-`728`); `createMaterial()` writes that summary in the in-transaction `education.material_upload` audit row (`packages/db/src/repositories.ts:735`-`744`); the PGlite repository test asserts the upload audit payload does not contain `notes.txt`, `fileName`, `mimeType`, or the content hash (`tests/integration/db-lms-ph3-1.test.ts:123`-`128`). Recommendation: keep upload audit at this summary-only shape; do not add raw filename back for teacher convenience. Target part: material upload audit boundary.

2. Severity: High. Evidence: the current download audit is also filename-minimized. `recordMaterialDownloadAudit()` writes lesson id, course id, size, `hasContentHash`, storage provider, scan status, and retention timestamp only (`packages/db/src/repositories.ts:880`-`896`), while the handler records the audit only after successful byte resolution (`apps/web/src/features/lms/material-download.ts:65`-`72`). The handler test asserts the download audit does not contain the clean filename, `fileName`, `mimeType`, raw hash, base64 payload, or file body (`tests/integration/lms-material-download-handler.test.ts:124`-`130`). Recommendation: preserve this separation; do not move response-only or DB-only metadata into audit rows. Target part: material download audit boundary.

3. Severity: High. Evidence: the current success response avoids raw filenames by deriving the attachment name from MIME type: `attachmentNameForMime()` maps known LMS MIME types to `lesson-material.*` (`apps/web/src/features/lms/material-download.ts:33`-`38`), and `downloadHeaders()` sets `Content-Disposition` from that generic name (`apps/web/src/features/lms/material-download.ts:41`-`49`). Unit and DB-browser specs assert `lesson-material.txt` and explicitly assert the raw upload filename is absent (`tests/integration/lms-material-download-handler.test.ts:117`-`122`, `tests/e2e/lms-db-materials.spec.ts:210`-`217`). Recommendation: keep filename minimization at the web response boundary; do not use `row.fileName` in successful response headers. Target part: LMS download handler.

4. Severity: Medium. Evidence: no DB migration is needed for this slice. The schema still stores `materials.file_name` and requires it for file rows through `materials_payload_check` (`packages/db/src/schema.ts:256`-`263`, `packages/db/src/schema.ts:285`-`297`), and `materialInsertValues()` still validates and persists `input.fileName` and `input.mimeType` for file materials (`packages/db/src/repositories.ts:681`-`709`). This preserves file-row integrity and existing DB round trips without exposing the value through audit/response boundaries. Recommendation: leave `file_name` in the schema and treat it as private DB metadata unless a later explicit privacy migration replaces it with generated display names. Target part: schema/repository persistence.

5. Severity: Medium. Evidence: `MaterialFileDownloadRow` still includes `fileName` and `mimeType` (`packages/db/src/repositories.ts:813`-`829`), and `getMaterialFileForPublishedLesson()` still selects and returns both (`packages/db/src/repositories.ts:831`-`878`), but current response and audit code no longer consume `fileName` for public output (`apps/web/src/features/lms/material-download.ts:33`-`49`, `packages/db/src/repositories.ts:880`-`896`). Recommendation: the lowest-risk no-migration implementation is to keep this row shape temporarily for DB compatibility while enforcing no public/audit use. If the next cleanup wants a stricter contract, remove `fileName` from `MaterialFileDownloadRow` only after updating all call sites and tests; that is optional and not required for filename minimization. Target part: download repository DTO boundary.

6. Severity: Medium. Evidence: teacher-facing DTOs are now filename-free in the active source: `TeacherMaterialView` aliases `MaterialView` with no `fileName`/`mimeType` fields (`packages/lms/src/types.ts:60`-`72`), `toTeacherMaterialView()` returns only the base material view (`apps/web/src/features/lms/queries.ts:78`-`80`), and the static test asserts the teacher view/mapper do not reintroduce filename or storage metadata (`tests/integration/lms-ph3-1-static.test.ts:157`-`180`). Recommendation: preserve teacher workflows through material label, type, size, scan status, and download availability. If teachers later need a visible original filename, make that a separate product decision with explicit privacy acceptance; do not silently re-expose the raw DB filename. Target part: teacher LMS DTO/UI boundary.

7. Severity: Medium. Evidence: cleanup and download compatibility do not depend on raw filenames. Cleanup scopes by file kind, `db-local` provider, `lms/materials/` key prefix, expired retention, and soft-deleted or unsafe scan state (`packages/db/src/repositories.ts:776`-`810`); DB-local download integrity checks use bytes, size, and `contentSha256`, not the filename (`packages/db/src/repositories.ts:855`-`860`); storage resolution validates provider/key/bytes/hash (`apps/web/src/features/lms/material-storage.ts:106`-`118`). Recommendation: do not change cleanup or integrity semantics for filename minimization. Keep hash and filename private in DB rows while response/audit surfaces remain minimized. Target part: cleanup/download compatibility.

8. Severity: Low. Evidence: the active tests have good intended coverage but were not run in this read-only slice. Coverage points include upload audit no-filename assertions (`tests/integration/db-lms-ph3-1.test.ts:123`-`128`), success download header no-filename assertions (`tests/integration/lms-material-download-handler.test.ts:117`-`122`), DB-browser success no-filename assertions (`tests/e2e/lms-db-materials.spec.ts:210`-`217`), static DTO no-filename assertions (`tests/integration/lms-ph3-1-static.test.ts:157`-`180`), and harness checks that the browser spec contains `lesson-material.txt` plus `not.toContain(fileName)` (`tests/integration/lms-db-e2e-harness.test.ts:76`-`93`). Recommendation: implementation acceptance still needs focused Vitest plus the normal full/e2e gates in the operator phase; this audit does not claim green gates. Target part: verification.

## Decisions
- Safest implementation path: no migration. Keep `materials.file_name` as private DB metadata required for current file-row integrity, but exclude it from audits, public/student/teacher DTOs, rendered pages, and successful response headers.
- Successful LMS downloads should use a generic MIME-derived attachment name such as `lesson-material.txt`, never the raw uploaded filename.
- Upload and download audit rows should remain summary-only: size/hash-presence/provider/scan/retention metadata is acceptable; raw filename, raw MIME field names, storage key, bytes, and raw checksum are not.
- Teacher workflows should rely on the material label plus size/status/download controls. Reintroducing original filename display should require an explicit product/privacy decision.
- `MaterialFileDownloadRow.fileName` can remain as internal compatibility metadata for now; the key requirement is no public or audit consumption. Removing it is a later optional hardening cleanup, not a blocker for this no-migration slice.

## Risks
- A future handler or audit refactor could reuse `row.fileName` because `MaterialFileDownloadRow` still carries it. Keep tests that assert `Content-Disposition` and audit JSON do not contain raw filenames.
- Removing `materials.file_name` from schema now would require a migration and could break existing file-row constraints and round-trip tests without improving the already-minimized response/audit boundary.
- Teacher filename display is currently minimized. If support workflows depend on the original filename, the platform needs a deliberate replacement such as a teacher-controlled material label or generated display name.
- The current evidence is source/test inspection only. No gate output proves the whole current tree is green in this audit slice.

## Verification/tests
- No gates run; forbidden by scope.
- No servers run; forbidden by scope.
- No DB commands, migrations, seeds, Playwright, live object storage, scanner, signed redirects, or live services run; forbidden by scope.
- `git status --short` was attempted for orientation only and failed with `fatal: not a git repository (or any of the parent directories): .git`.
- Suggested future acceptance commands for the operator phase:
  1. `npm test -- tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-db-e2e-harness.test.ts`
  2. `npm run typecheck`
  3. `npm run typecheck -w @wtc/web`
  4. `node scripts/gates.mjs full`
  5. `node scripts/gates.mjs e2e`
  6. `node scripts/scan-lms-db-e2e-artifacts.mjs`

## Next actions
1. If implementing from a branch that does not already have the observed current shape, make the no-migration boundary edits only: remove filename/MIME from upload/download audits, use MIME-derived generic `Content-Disposition`, and keep teacher/student DTOs filename-free.
2. Keep `materials.file_name` and repository file insert validation unchanged for DB integrity.
3. Keep cleanup/download integrity unchanged; do not couple filename minimization to retention cleanup or object-store lifecycle.
4. Run the suggested focused tests and normal gates in the operator implementation phase before claiming acceptance.
