# ecosystem-security-auditor handoff
## Scope
Phase 3.22 read-only security audit of the LMS material DTO/query mapping boundary after Phase 3.21.
Focus: remove internal file metadata from student/admin rendered surfaces while preserving required teacher, download, and audit internals.

No product code, tests, docs, servers, Playwright, DB commands, psql, migrations, seeds, live endpoints, or external services were used. This handoff is the only file written.

## Files inspected
- `docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`
- `docs/handoffs/20260602-0047-ecosystem-security-auditor.md`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `packages/db/src/repositories.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Student material loading still uses the shared material mapper and the shared `MaterialView[]`, so student lesson data can receive teacher-grade file metadata. Evidence: `StudentLesson.materials` is typed as `MaterialView[]` and `loadStudentLesson()` maps raw `listMaterials()` rows through `toMaterialView()` (`apps/web/src/features/lms/queries.ts:271-297`). The shared mapper sets `downloadUrl`, `fileName`, `mimeType`, `sizeBytes`, and `scanStatus` for every file material consumer (`apps/web/src/features/lms/queries.ts:64-76`). The student lesson page renders file size and scan status (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:146-156`). Recommendation: add a dedicated `StudentMaterialView` plus `toStudentMaterialView()` and use it only in `loadStudentLesson()`. Target part: student material query and lesson render boundary.

2. Severity: High. The Phase 3.22 DTO split appears incomplete and likely type-breaking. Evidence: current `MaterialView` no longer declares `fileName` or `mimeType`, while `TeacherMaterialView` now extends it with those fields (`packages/lms/src/types.ts:60-76`), but `apps/web/src/features/lms/queries.ts` imports only `MaterialView` (`apps/web/src/features/lms/queries.ts:29-40`), still assigns `v.fileName` and `v.mimeType` (`apps/web/src/features/lms/queries.ts:70-71`), and teacher loaders still return `MaterialView[]` rather than `TeacherMaterialView[]` (`apps/web/src/features/lms/queries.ts:143-188`). Teacher components also read `material.fileName` through `MaterialView` props (`apps/web/src/app/teacher/courses/[id]/page.tsx:34-44`). Recommendation: complete the role-specific split before acceptance: `toStudentMaterialView()` for student surfaces, `toTeacherMaterialView()` for teacher surfaces, and explicit loader return types for each role. Target part: LMS view types and query mapper compile boundary.

3. Severity: Medium. Admin rendered pages are currently narrow, but that safety is implicit rather than pinned by a role DTO allowlist. Evidence: admin audit rendering uses `recentAuditEvents()` and renders only time, actor role, action, target prefix, and result (`apps/web/src/lib/backend.ts:101-111`, `apps/web/src/app/admin/audit-log/page.tsx:26-34`). Admin education renders course/teacher counts and manual enrollment controls, not material file metadata (`apps/web/src/app/admin/education/page.tsx:33-80`). DB audit payloads legitimately retain material metadata for internal audit/download traceability (`packages/db/src/repositories.ts:711-725`, `packages/db/src/repositories.ts:833-850`). Recommendation: keep admin rendered projections payload-free and add static allowlist tests so `before`/`after` or material row fields cannot be surfaced by accident. Target part: admin audit and future admin material moderation views.

4. Severity: Medium. Existing no-leak tests protect DOM/artifacts but do not enforce the object/projection boundary requested here. Evidence: Phase 3.21 recorded that student `MaterialView` still carried broader metadata than the visible UI needed (`docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md:74-77`). Current tests assert broad `MaterialView` display fields, including `fileName`, `mimeType`, `sizeBytes`, and `scanStatus`, are present or mapped (`tests/integration/lms-ph3-1-static.test.ts:142-162`). The browser spec currently expects students to see `clean` and `quarantined` status text (`tests/e2e/lms-db-materials.spec.ts:180-188`). Recommendation: replace those assertions with role-specific allowlists and update the student browser expectation to generic download availability only. Target part: DTO/static tests and LMS DB browser spec.

5. Severity: Low. The legacy `Material` export remains a broad internal shape that includes file bytes, hash, storage provider/key, quarantine, retention, and deletion fields (`packages/lms/src/index.ts:41-60`). It is not the current web query view type, but it is exported from `@wtc/lms` and could be mistaken for a render-safe DTO. Recommendation: document or rename this as an internal/store shape, or stop exporting it from public client-facing package entrypoints once the role-specific material views land. Target part: package API hygiene.

## Decisions
- Student view allowed fields: `id`, `title`, `materialType`, guarded `externalUrl` for link materials, and `downloadUrl` only for clean downloadable files. If the UI needs an unavailable state, use a generic boolean or enum such as `downloadAvailable` / `downloadState`; do not expose `fileName`, `mimeType`, `sizeBytes`, `scanStatus`, `contentSha256`, `fileBytesBase64`, `storageProvider`, `storageKey`, `scanCheckedAt`, `quarantineReason`, `retainedUntil`, `deletedAt`, or `hasStorageKey`. Prefer a sanitized iframe descriptor over raw `embedHtml` for embed materials if the DTO ever crosses a client boundary.
- Teacher view allowed fields: `id`, `lessonId`, `title`, `materialType`, guarded `externalUrl`, `downloadUrl` if teacher download/preview is intentionally supported, `fileName`, `mimeType`, `sizeBytes`, and coarse `scanStatus`. Do not expose hash, bytes, storage provider/key/path, scan checked timestamp, quarantine reason, retention timestamp, deletion timestamp, or `hasStorageKey` on teacher rendered surfaces.
- Admin view allowed fields for the current admin pages: audit summary fields only (`ts`, `actorRole`, `action`, `targetType`, truncated `targetId`, `result`) plus education course/teacher summary fields already rendered. Future admin material moderation, if built, should require its own `AdminMaterialSummary` allowlist; default to no file metadata on broad admin/audit pages.
- Download internals must keep `fileName`, `mimeType`, `sizeBytes`, `contentSha256`, `fileBytesBase64`, `storageProvider`, `storageKey`, `scanStatus`, `scanCheckedAt`, `quarantineReason`, and `retainedUntil` inside `MaterialFileDownloadRow` because the download handler validates bytes/hash, sets safe response headers, and records audit (`packages/db/src/repositories.ts:769-830`, `apps/web/src/features/lms/material-download.ts:31-66`).
- Audit internals may retain non-secret material metadata in DB audit rows for traceability, but rendered admin audit pages must continue projecting only summaries.

## Risks
- The current workspace is not a git repository from this cwd, so this audit cannot distinguish Phase 3.21 baseline from concurrent local edits. The `packages/lms/src/types.ts`, `apps/web/src/features/lms/queries.ts`, and `tests/integration/lms-ph3-1-static.test.ts` timestamps indicate an in-progress split while this audit was running.
- Without typecheck, the apparent `MaterialView` / `TeacherMaterialView` mismatch remains unverified by a compiler gate in this session.
- DOM no-leak checks can pass while server-side objects or future client components still receive broader fields from the shared mapper.
- Admin audit payloads intentionally hold material metadata in DB; any future "expanded details" admin UI must be treated as a new security review, not a harmless table expansion.

## Verification/tests
RUN:
1. Static source inspection with `rg`, `Get-Content`, `Get-ChildItem`, `Test-Path`, and `git status --short`.
2. `git status --short` returned `fatal: not a git repository (or any of the parent directories): .git`; no git diff or baseline comparison was available.

NOT RUN:
1. `npm test`, focused Vitest, typecheck, lint, build, `node scripts/gates.mjs full`, and scanner commands - not run because this was a read-only audit request focused on inspection and recommendations.
2. Playwright/default e2e, `npm run e2e:lms:db`, browser servers, Next dev/preview/production servers, DB commands, psql, migrations, seeds, live endpoints, and external services - explicitly forbidden by the prompt.

Tests needed:
1. Static type allowlist test: `StudentMaterialView` excludes `fileName`, `mimeType`, `sizeBytes`, `scanStatus`, `contentSha256`, `fileBytesBase64`, `storageProvider`, `storageKey`, `scanCheckedAt`, `quarantineReason`, `retainedUntil`, `deletedAt`, and `hasStorageKey`.
2. Static type allowlist test: `TeacherMaterialView` allows only the teacher display fields listed above and still excludes hash/bytes/storage/quarantine/retention/deletion internals.
3. Static mapper test: `loadStudentLesson()` uses `toStudentMaterialView()` and its mapper contains no `.fileName`, `.mimeType`, `.sizeBytes`, `.scanStatus`, `.contentSha256`, `.storageProvider`, `.storageKey`, `.fileBytesBase64`, `.quarantineReason`, `.retainedUntil`, or `.deletedAt` projections.
4. Static mapper test: `loadTeacherCourse()` and `loadTeacherMaterials()` use `TeacherMaterialView` / `toTeacherMaterialView()` and remain owner-scoped before materials are fetched.
5. Student page static test: the lesson page no longer references `m.sizeBytes`, `m.scanStatus`, `fileScanTone`, `fileName`, or other file metadata; it renders only title/kind, guarded link, generic download CTA, and generic unavailable state.
6. Browser no-leak test update: student LMS material surface must not show concrete filename, MIME, size, `clean`, `pending`, `quarantined`, or `failed`; successful downloads may still expose `content-disposition` filename and `x-lms-sha256` only in the successful file response, not in page DOM or failed responses.
7. Admin audit static/browser tests: `recentAuditEvents()` and `/admin/audit-log` must not project or render `before`, `after`, `fileName`, `mimeType`, `sizeBytes`, `contentSha256`, storage fields, quarantine fields, or retention fields.
8. Typecheck after the split: `npm run typecheck` and `npm run typecheck -w @wtc/web` should be required because the current inspected state suggests a type/interface mismatch.

## Next actions
1. Implement role-specific material DTOs and mappers: `StudentMaterialView`, `TeacherMaterialView`, and, only if needed, `AdminMaterialSummary`.
2. Replace shared `toMaterialView()` usage in student loaders with the student mapper; use the teacher mapper only in teacher loaders.
3. Update student rendered UI to remove file size and scan status, keeping only generic download availability.
4. Update the static and browser tests listed above, then run typecheck and focused tests in a later session where gates are allowed.
5. Do not remove internal fields from `MaterialFileDownloadRow`, file material creation, or DB audit rows; constrain them at projection/render boundaries instead.
