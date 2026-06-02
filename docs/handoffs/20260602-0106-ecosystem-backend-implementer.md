# ecosystem-backend-implementer handoff
## Scope
Phase 3.22 read-only backend/LMS audit for a minimal material DTO split/narrowing design. Inspected the LMS query mapper, LMS view types, teacher/student LMS pages, material action/download paths, DB repositories/schema, and LMS material tests.

No product code, tests, docs, servers, Playwright, DB commands, psql, migrations, seeds, live endpoints, or external services were run or changed beyond writing this handoff.

## Files inspected
- `AGENTS.md`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/lib/lms-types.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/lms-fixes.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `docs/handoffs/20260602-0047-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`
- `docs/handoffs/20260602-0023-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`

## Files changed
None - read-only audit

## Findings
1. Severity: Medium. `MaterialView` is display-only now, but it is still one shared DTO for teacher and student material surfaces. Evidence: `packages/lms/src/types.ts:60` defines one `MaterialView` with `downloadUrl`, `fileName`, `mimeType`, `sizeBytes`, `scanStatus`, and `embedHtml` at `packages/lms/src/types.ts:66-72`; `apps/web/src/features/lms/queries.ts:64-76` maps those fields from every `MaterialRow`; teacher loaders consume that mapper at `apps/web/src/features/lms/queries.ts:173` and `apps/web/src/features/lms/queries.ts:197`; the student lesson loader also consumes it at `apps/web/src/features/lms/queries.ts:295`. The student page currently renders only title/type/size/scan/download link/safe embed and does not render `fileName` or `mimeType` at `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:146-158`, while E2E asserts the page omits filename/hash markers at `tests/e2e/lms-db-materials.spec.ts:35-39` and `tests/e2e/lms-db-materials.spec.ts:192-194`. Recommendation: split view DTOs in `packages/lms/src/types.ts` into a small common material base plus `StudentMaterialView` and `TeacherMaterialView`. Keep `StudentMaterialView` to `id`, `lessonId`, `title`, `materialType`, link `externalUrl`, file `downloadUrl`, `sizeBytes`, `scanStatus`, and embed `embedHtml`; do not include `fileName` or `mimeType` on the student DTO. Let `TeacherMaterialView` keep `fileName`, `mimeType`, `sizeBytes`, `scanStatus`, link URL, and sanitized embed fields. For minimal compatibility, keep `MaterialView` as a temporary alias to `TeacherMaterialView` or migrate teacher imports first, but make `StudentLesson.materials` use `StudentMaterialView[]`. Target part: LMS view DTO boundary.

2. Severity: Medium. The mapper seam should be split with explicit allowlists, not a parameterized "full row" projection. Evidence: `toMaterialView()` currently uses one row-to-view function for all audiences at `apps/web/src/features/lms/queries.ts:64-76`; the DB row includes file payload/storage columns at `packages/db/src/schema.ts:248-268`; the schema constraints prove link/file/embed have distinct payload shapes at `packages/db/src/schema.ts:285-293`. Recommendation: replace `toMaterialView()` with `toTeacherMaterialView()` and `toStudentMaterialView()` in `apps/web/src/features/lms/queries.ts`. The student mapper should build a fresh object literal and only set `downloadUrl` for clean files, matching current behavior at `apps/web/src/features/lms/queries.ts:68-73`; it should not read or assign `fileName`, `mimeType`, `contentSha256`, `fileBytesBase64`, `storageProvider`, `storageKey`, `retainedUntil`, `deletedAt`, or `quarantineReason`. Teacher mappers can keep display metadata used by `TeacherMaterialLabel()` at `apps/web/src/app/teacher/courses/[id]/page.tsx:34-48` and the materials table at `apps/web/src/app/teacher/materials/page.tsx:60-67`. Target part: LMS query mapping.

3. Severity: Medium. Downloads and audit need repository/internal DTOs preserved; only web view DTOs should narrow. Evidence: the download repository returns `MaterialFileDownloadRow` with filename, MIME, content hash, base64 bytes, storage provider/key, scan state, and retention at `packages/db/src/repositories.ts:769-831`; the handler uses file name and hash for successful download headers at `apps/web/src/features/lms/material-download.ts:31-40` and streams bytes only after auth, entitlement, DB, published-course, and clean-scan gates at `apps/web/src/features/lms/material-download.ts:47-66`; download audit intentionally records redacted operational metadata at `packages/db/src/repositories.ts:833-851`. Recommendation: do not narrow `MaterialFileDownloadRow`, `CreateMaterialInput`, schema columns, or audit payloads in this DTO split. Keep the student page linked by opaque material ID only, and let the authorized GET response continue to expose `content-disposition` and `x-lms-sha256` on the success path, as covered by `tests/e2e/lms-db-materials.spec.ts:209-217` and `tests/integration/lms-material-download-handler.test.ts:113-126`. Target part: download and audit correctness.

4. Severity: Low. Existing tests protect internal storage/audit fields, but they do not yet pin the student/teacher DTO split. Evidence: `tests/integration/lms-ph3-1-static.test.ts:142-162` asserts `MaterialView` excludes hard internal fields and that the current mapper does not project them, while `tests/e2e/lms-db-materials.spec.ts:180-195` asserts rendered student behavior for clean, quarantined, and embed materials. These tests do not assert that `StudentLesson.materials` cannot contain `fileName` or `mimeType` at the object boundary. Recommendation: after the code split, add object-key allowlist tests around the student mapper/loader and teacher mapper/loader. Keep browser assertions for rendered filename/hash no-leak, because they catch page regressions that type-only tests cannot. Target part: LMS regression coverage.

## Decisions
1. Treat the current schema, file material lifecycle, download handler, and audit row design as out of scope for this split; they already carry data needed for storage, downloads, and audit.
2. Recommend a TypeScript/view-layer split only: `StudentMaterialView` for student lessons and `TeacherMaterialView` for teacher material management.
3. Preserve current student UI behavior: clean file shows a Download link, quarantined/unclean file shows scan state plus download unavailable, link material uses guarded HTTPS, and embed material renders only sanitized iframe props.
4. Preserve teacher material behavior: teacher course/materials pages can still show filename, size, MIME/scan metadata, and delete actions.

## Risks
1. Static audit only. No browser serialization, RSC payload, DB-backed E2E, Vitest, typecheck, lint, or live route behavior was observed this session.
2. The workspace is not git-backed from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so no git diff/status validation was available.
3. Keeping `MaterialView` as a temporary alias helps minimize breakage, but it can also prolong ambiguity. A later cleanup should remove or deprecate the alias once pages and tests use the audience-specific names.

## Verification/tests
- RUN: read-only filesystem/source inspection with `rg`, `Get-Content`, `Get-ChildItem`, `Test-Path`, and a failed `git status --short` check that confirmed this directory is not a git repository.
- Gates run: none.
- Gates not run: servers, Playwright, DB-backed LMS E2E, Vitest, lint, typecheck, DB commands, psql, migrations, seeds, live endpoints, and external services. Reason: explicitly forbidden by the Phase 3.22 prompt.

## Next actions
1. Add `StudentMaterialView` and `TeacherMaterialView` to `packages/lms/src/types.ts`; keep `MaterialView` only as a temporary teacher-compatible alias if needed for minimal churn.
2. Replace `toMaterialView()` in `apps/web/src/features/lms/queries.ts` with `toStudentMaterialView()` and `toTeacherMaterialView()`, then wire `loadStudentLesson()` to the student mapper and `loadTeacherCourse()` / `loadTeacherMaterials()` to the teacher mapper.
3. Update LMS pages/imports only as needed for the new names; do not change material download route, DB repositories, schema, or audit payloads for this DTO split.
4. Add object-key allowlist tests for student and teacher material DTOs, then run focused LMS static/unit tests and typecheck in a separate implementation session.
