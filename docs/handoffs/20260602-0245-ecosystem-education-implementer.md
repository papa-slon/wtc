# ecosystem-education-implementer handoff
## Scope
Phase 3.27 read-only education/LMS audit before edits. Scope is filename minimization for LMS material success paths after Phase 3.26: teacher, student, and admin material surfaces; successful download headers; LMS material upload/download audit payloads; and tests that pin filename behavior. No product code, tests, migrations, gates, servers, DB commands, Playwright, or live services were changed or run.

## Files inspected
- AGENTS.md
- apps/web/src/features/lms/material-download.ts
- apps/web/src/features/lms/material-storage.ts
- apps/web/src/features/lms/actions.ts
- apps/web/src/features/lms/queries.ts
- apps/web/src/app/teacher/courses/[id]/page.tsx
- apps/web/src/app/teacher/materials/page.tsx
- apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx
- apps/web/src/app/admin/education/page.tsx
- apps/web/src/app/admin/audit-log/page.tsx
- apps/web/src/lib/backend.ts
- packages/lms/src/materials.ts
- packages/lms/src/types.ts
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- packages/audit/src/audit.ts
- tests/integration/lms-material-download-handler.test.ts
- tests/integration/lms-material-storage.test.ts
- tests/integration/lms-ph3-1-static.test.ts
- tests/integration/db-lms-ph3-1.test.ts
- tests/integration/lms-db-e2e-harness.test.ts
- tests/e2e/lms-db-materials.spec.ts
- scripts/scan-lms-db-e2e-artifacts.mjs
- docs/STATUS.md
- docs/NEXT_ACTIONS.md
- docs/PRODUCTION_BLOCKERS_CURRENT.md

## Files changed
- docs/handoffs/20260602-0245-ecosystem-education-implementer.md only

## Findings
1. Severity: High. Evidence: successful LMS download responses are already minimized for the original uploaded filename in current source. `apps/web/src/features/lms/material-download.ts:33`-`40` builds headers with `content-disposition: attachment; filename="lesson-material.txt"` and no `x-lms-sha256`; `tests/integration/lms-material-download-handler.test.ts:114`-`123` asserts the 200 response uses `lesson-material.txt`, does not contain `CLEAN_FILE_NAME`, and has no hash header; `tests/e2e/lms-db-materials.spec.ts:210`-`218` mirrors that for the opt-in DB browser flow. Recommendation: keep this invariant; if MIME-specific names are needed later, derive them from allowlisted MIME type only, not `row.fileName`. Target part: LMS download handler and success-path tests.
2. Severity: High. Evidence: student material surfaces already exclude original filename. `packages/lms/src/types.ts:60`-`70` defines `MaterialView` without `fileName` or `mimeType`; `apps/web/src/features/lms/queries.ts:65`-`75` maps student file material DTOs to download URL, size, and scan status only; `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:141`-`156` renders title, type, size, scan status, and download link without filename; `tests/integration/lms-ph3-1-static.test.ts:148`-`173` statically pins no student filename projection. Recommendation: do not add filename back to `MaterialView`, student query mapping, failed download bodies, or student HTML. Target part: student LMS lesson material DTO and rendering.
3. Severity: High. Evidence: teacher/admin-authorized course editing still exposes the original uploaded filename. `packages/lms/src/types.ts:72`-`75` allows `TeacherMaterialView.fileName` and `mimeType`; `apps/web/src/features/lms/queries.ts:78`-`84` projects `m.fileName` and `m.mimeType` into teacher material views; `apps/web/src/features/lms/queries.ts:158`-`190` lets admins load the same teacher course detail path; `apps/web/src/app/teacher/courses/[id]/page.tsx:39`-`44` renders `{material.fileName ?? 'file'}` for file materials. `tests/integration/lms-ph3-1-static.test.ts:157`-`183` currently asserts the teacher mapper owns filename projection, so tests will need to move with the policy. Recommendation: for strict filename-free success paths, remove or stop projecting `fileName` from `TeacherMaterialView`, replace the teacher course label with neutral metadata such as title, file type label, size, and scan status, and update static tests accordingly. Target part: teacher course editor, admin-as-teacher course detail, TeacherMaterialView, and query mapper.
4. Severity: Medium. Evidence: the standalone teacher materials index currently does not render the original filename even though the server DTO carries it. `apps/web/src/app/teacher/materials/page.tsx:60`-`66` renders material title, course, lesson, kind, and scan status only. Recommendation: preserve that minimal table; if `TeacherMaterialView.fileName` is removed, this page should require little or no visual change beyond type updates. Target part: teacher materials index.
5. Severity: Medium. Evidence: upload and download audit payloads are already filename-minimized in current source, but the upload regression is weaker than the download regression. `packages/db/src/repositories.ts:716`-`731` builds `education.material_upload` after-payloads without `fileName` or `mimeType`; `packages/db/src/repositories.ts:880`-`896` builds `education.material_download` after-payloads without `fileName`, `mimeType`, raw hash, bytes, or storage key; `tests/integration/lms-material-download-handler.test.ts:125`-`132` asserts download audit JSON does not contain the clean filename, `fileName`, `mimeType`, hash, base64, or bytes. Recommendation: add/keep focused upload audit assertions that the material upload audit also excludes the uploaded filename and `fileName` key while preserving size, scan status, provider summary, and `hasContentHash`. Target part: DB repository audit tests.
6. Severity: Medium. Evidence: original filename is still persisted as server-private file-row metadata and selected into download rows. `packages/db/src/schema.ts:256` and `packages/db/src/schema.ts:290` require `file_name` for file materials; `packages/db/src/repositories.ts:654`-`670` requires `CreateFileMaterialInput.fileName`; `packages/db/src/repositories.ts:681`-`710` inserts it; `packages/db/src/repositories.ts:813`-`878` selects and returns it in `MaterialFileDownloadRow`. File byte integrity itself is not filename-dependent: `apps/web/src/features/lms/material-storage.ts:106`-`117` verifies bytes by `sizeBytes` and `contentSha256`, and `packages/db/src/repositories.ts:855`-`860` performs the same DB-local integrity check. Recommendation: do not remove the DB column in the next UI/header/audit slice unless a separate migration and retention policy is accepted; keep it server-private or replace it later with a generated display/download name if at-rest filename minimization becomes a requirement. Target part: data model and storage integrity boundary.
7. Severity: Medium. Evidence: opt-in DB browser acceptance has source assertions for no filename leakage, but it was not run in this read-only audit by instruction. `tests/e2e/lms-db-materials.spec.ts:35`-`39` rejects the uploaded filename in page HTML, `tests/e2e/lms-db-materials.spec.ts:155`-`158` checks after teacher upload, `tests/e2e/lms-db-materials.spec.ts:192`-`195` checks the student lesson, `tests/e2e/lms-db-materials.spec.ts:231`-`237` checks admin audit-log rendering, and `tests/integration/lms-db-e2e-harness.test.ts:76`-`91` statically verifies the flow exists. Recommendation: after implementation edits, run the focused Vitest set plus the opt-in DB browser gate only when `LMS_E2E_DATABASE_URL` or managed DB credentials are supplied. Target part: LMS DB browser acceptance.
8. Severity: Low. Evidence: current status docs are stale relative to source. `docs/STATUS.md:14`-`16`, `docs/NEXT_ACTIONS.md:11`-`14`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` still describe filename-free download/audit policy as open, while current code/tests already remove the original filename from success `Content-Disposition` and upload/download audit payloads. Recommendation: the next aggregate implementation phase should update current docs to distinguish the remaining teacher/admin display policy from already-minimized download headers and audit payloads. Target part: current status and blocker docs.

## Decisions
- Treat student success paths as already filename-minimized in current source: student DTO, student page HTML, success download header, and download audit are not the next implementation bottleneck.
- Treat teacher/admin-authorized material management as the remaining filename policy decision: either keep original filename as teacher-only display metadata, or remove it for strict filename-free success paths.
- Keep storage integrity independent from filename. Size, MIME allowlist, private content hash, storage provider/key, scan state, and byte resolution remain legitimate server-side storage fields; original filename should not be needed for download integrity.
- Do not collapse this into object-storage work. S3/R2, signed redirects, external scanner, and object-store cleanup remain separate gates.

## Risks
- Removing `TeacherMaterialView.fileName` without updating static tests will fail `tests/integration/lms-ph3-1-static.test.ts`.
- Removing the database `file_name` requirement without a migration will break `materials_payload_check`, repository insertion, and existing DB integration tests.
- Keeping teacher filenames while claiming strict filename-free success paths is internally inconsistent because admins can enter teacher course detail and see the same file metadata.
- Updating only current source without updating current docs will keep production blocker reports stale and make later phase acceptance ambiguous.

## Verification/tests
- Not run by instruction: no gates, servers, DB commands, migrations, Playwright, or live services.
- Read-only source inspection only.
- Recommended focused tests for the implementation phase: `npm test -- tests/integration/lms-material-download-handler.test.ts tests/integration/lms-ph3-1-static.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-db-e2e-harness.test.ts`.
- Recommended full gates after implementation and docs: `npm run typecheck`, `npm run typecheck -w @wtc/web`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `node scripts/scan-lms-db-e2e-artifacts.mjs`, and `npm run governance:check`.
- Recommended opt-in DB browser gate when credentials exist: `npm run e2e:lms:db` or `npm run e2e:lms:db:managed`.

## Next actions
1. Decide strict policy for teacher/admin filenames. If strict filename-free success paths are required, remove `fileName` and likely `mimeType` from `TeacherMaterialView`, `toTeacherMaterialView`, and teacher course file labels; keep size, scan status, title, and a MIME-derived generic type label if useful.
2. Preserve the current generic success download filename and no-hash-header assertions.
3. Add upload-audit no-filename regression coverage to match the existing download-audit assertions.
4. Update current docs so blockers say the remaining filename work is teacher/admin display policy and possibly at-rest DB retention policy, not already-fixed download header/audit payload leakage.
5. Run focused tests and full gates in the implementation phase; do not claim DB browser acceptance until `npm run e2e:lms:db` or managed equivalent is observed green.
