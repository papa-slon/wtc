# ecosystem-tests-runner handoff
## Scope
Phase 3.22 read-only tests-runner audit of the current LMS `MaterialView`/material query/test boundary after Phase 3.21.

Focus: recommend exact static and integration tests for narrowing student/admin material DTOs so internal fields are not carried to surfaces that do not need them:
`contentSha256`, `storageProvider`, `retainedUntil`, `deletedAt`, `quarantineReason`, `storageKey`, and `fileBytesBase64`.

No product code, tests, scripts, docs, servers, Playwright, DB commands, `psql`, migrations, seeds, live endpoints, or external services were touched. This handoff is the only file written.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`
- `docs/handoffs/20260602-0047-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0047-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0047-ecosystem-tests-runner.md`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `package.json`
- `vitest.config.ts`
- `tsconfig.json`
- `apps/web/tsconfig.json`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `packages/lms/src/types.ts:60-70` now makes `MaterialView` student-safe and omits `fileName`, `mimeType`, and the internal storage/audit fields; `packages/lms/src/types.ts:72-76` adds `TeacherMaterialView` for teacher-only filename/MIME display. But `apps/web/src/features/lms/queries.ts:33` imports only `MaterialView`, `apps/web/src/features/lms/queries.ts:64-76` still returns `MaterialView` while assigning `v.fileName` and `v.mimeType`, and loader signatures still expose teacher and student materials as `MaterialView[]` at `apps/web/src/features/lms/queries.ts:146`, `apps/web/src/features/lms/queries.ts:187`, and `apps/web/src/features/lms/queries.ts:275`. Current static coverage at `tests/integration/lms-ph3-1-static.test.ts:143-162` slices from `MaterialView` through the following `TeacherMaterialView`, so it does not pin the exact student DTO shape. Recommendation: extend `tests/integration/lms-ph3-1-static.test.ts` with exact source-shape assertions: slice `MaterialView` only up to `export interface TeacherMaterialView`; assert allowed student keys are exactly `id`, `lessonId`, `title`, `materialType`, `externalUrl`, `downloadUrl`, `sizeBytes`, `scanStatus`, and `embedHtml`; assert `fileName`, `mimeType`, and every internal field are absent from that slice. Then slice `TeacherMaterialView` separately and assert it only adds `fileName` and `mimeType`, with no internal fields. Target part: static DTO contract.

2. Severity: High. Evidence: Phase 3.21 explicitly left object-key allowlist tests for a later phase (`docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md:93-96`). Current DOM/response tests reject marker strings in rendered pages and failed responses (`tests/e2e/lms-db-materials.spec.ts:28-40`, `tests/e2e/lms-db-materials.spec.ts:58-73`, `tests/e2e/lms-db-materials.spec.ts:192-236`), but they cannot prove server component loader objects are narrow before rendering. Recommendation: add a focused integration test file such as `tests/integration/lms-material-dto-boundary.test.ts` using in-process PGlite only. Seed a published course/lesson with one clean file material containing all internal DB fields, one quarantined file, one link, and one embed. Assert `loadStudentLesson(...).materials` object keys exactly match the student DTO allowlist by material type and never include `fileName`, `mimeType`, `contentSha256`, `storageProvider`, `retainedUntil`, `deletedAt`, `quarantineReason`, `storageKey`, or `fileBytesBase64`. Target part: student material loader boundary.

3. Severity: Medium. Evidence: teacher surfaces currently render filename/size/scan state at `apps/web/src/app/teacher/courses/[id]/page.tsx:34-48` and material title/kind/scan at `apps/web/src/app/teacher/materials/page.tsx:60-67`; they do not render hash, storage provider/key, retention, deletion, quarantine reason, or raw bytes. However `loadTeacherCourse()` and `loadTeacherMaterials()` still type their material payloads as `MaterialView[]`/`MaterialView` at `apps/web/src/features/lms/queries.ts:143-148` and `apps/web/src/features/lms/queries.ts:185-188`, so the teacher-only extension is not enforced at the query boundary. Recommendation: in the same DTO-boundary integration test, assert teacher material objects from `loadTeacherCourse()` and `loadTeacherMaterials()` may include `fileName` and `mimeType` but never include the internal field list. Add static assertions that `queries.ts` imports `TeacherMaterialView`, has a teacher mapper/projection, and uses `TeacherMaterialView` in teacher loader return types. Target part: teacher/admin-adjacent material query boundary.

4. Severity: Medium. Evidence: admin audit rows may legitimately retain internal material metadata inside DB audit payloads (`packages/db/src/repositories.ts:833-851`), while the admin audit view projection exposes only `id`, `ts`, `actorRole`, `action`, `targetType`, `targetId`, and `result` (`apps/web/src/lib/backend.ts:91-111`) and the page renders only those columns (`apps/web/src/app/admin/audit-log/page.tsx:22-40`). Current browser coverage checks the admin page DOM for no material markers after seeing `education.material_download` (`tests/e2e/lms-db-materials.spec.ts:230-236`), but there is no static or integration guard for the admin DTO/projection itself. Recommendation: add a static test that `AuditView` and `recentAuditEvents()` do not expose `before`, `after`, `metadata`, `fileName`, `mimeType`, hashes, storage fields, retention/deletion fields, quarantine fields, or raw bytes. If practical, extract a pure `toAuditView(row)`/`pickAuditView(row)` helper and add an integration test with an audit row containing all forbidden material fields, asserting `Object.keys(view).sort()` equals only the seven rendered admin fields. Target part: admin audit DTO projection.

5. Severity: Medium. Evidence: the DB schema necessarily stores internal material fields at `packages/db/src/schema.ts:248-267`, and `packages/lms/src/index.ts` still defines the internal in-memory `Material` model with storage and lifecycle fields. These internal models should not be confused with student/admin view DTOs. Recommendation: add static test names and comments that distinguish storage rows/internal models from surface DTOs, and explicitly allow the internal fields only in `MaterialRow`, repository download rows, audit persistence internals, and legacy memory `Material`, not in `MaterialView`, `TeacherMaterialView`, student loaders, or admin view DTOs. Target part: test clarity and future regression prevention.

## Decisions
1. Treat `MaterialView` as the student-safe material DTO. If a more explicit name is desired later, add `StudentMaterialView` as an alias or renamed interface, but the test contract should stay the same.
2. Treat `TeacherMaterialView` as the only material DTO allowed to carry display-only `fileName`/`mimeType`.
3. Treat admin audit rendering as currently material-DTO-free; the admin test target is the audit projection allowlist, not the DB audit persistence payload.
4. Treat DB schema rows, repository download rows, and the legacy in-memory `Material` model as internal/storage models where the forbidden fields may exist.
5. Do not move `npm run e2e:lms:db` into default gates; the recommended DTO checks should be static Vitest/PGlite integration coverage and remain independent of Playwright.

## Risks
1. No runtime proof was collected in this session because the requested scope forbade servers, Playwright, DB commands, migrations, seeds, live endpoints, and external services.
2. `apps/web/src/features/lms/queries.ts` appears mid-transition: `MaterialView` is narrowed in `packages/lms/src/types.ts`, but `queries.ts` still assigns teacher-only fields onto a `MaterialView`. This should be verified with a future read-only `tsc --noEmit -p apps/web/tsconfig.json --incremental false` or fixed in the implementation phase.
3. Integration tests that import `apps/web/src/features/lms/queries.ts` directly may need a small extraction of pure mapper/projection helpers because `queries.ts` imports `server-only` and Next app aliases. If extraction is required, keep it in `apps/web/src/features/lms` or `packages/lms`, not in React page files.
4. A future admin audit payload/details viewer would create a new surface and must get its own explicit DTO allowlist; the current admin table does not render payload details.

## Verification/tests
RUN:
1. Static/source inspection only with `rg`, `Get-Content`, `Get-ChildItem`, and `Test-Path`.
2. Confirmed `docs/handoffs/20260602-0106-ecosystem-tests-runner.md` did not exist before this write.
3. Confirmed `git status --short` is unavailable from this cwd because it is not a git repository.

NOT RUN:
1. `npm run e2e:lms:db` - forbidden by scope; would start Playwright/web-server flow and mutate a throwaway database.
2. `npx playwright test`, `npm run e2e`, or any browser/server-starting gate - forbidden by scope.
3. `psql`, migrations, seeds, DB create/drop, or any database mutation - forbidden by scope.
4. `npm test`, lint, typecheck, `node scripts/gates.mjs full`, or `node scripts/gates.mjs e2e` - not run because this was a recommendation-only read-only audit with no implementation.
5. Live Stripe, Axioma, TradingView, bot/exchange, object storage, malware scanner, preview/prod endpoint, SSH, tmux, systemd, or external service operations - out of scope and not touched.

## Next actions
1. Add exact static DTO shape tests in `tests/integration/lms-ph3-1-static.test.ts` for `MaterialView`, `TeacherMaterialView`, query imports, query mapper names, and loader return types.
2. Add `tests/integration/lms-material-dto-boundary.test.ts` with PGlite fixtures and object-key allowlist assertions for `loadStudentLesson()`, `loadTeacherCourse()`, and `loadTeacherMaterials()`.
3. Add static or extracted-helper integration coverage for admin `AuditView`/audit projection keys so material audit persistence metadata cannot appear in admin DTOs.
4. In the implementation phase, split query mappers into explicit student and teacher projections, then run `tsc --noEmit -p apps/web/tsconfig.json --incremental false` plus the focused new Vitest file(s).
