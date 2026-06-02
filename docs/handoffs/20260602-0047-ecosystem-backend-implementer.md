# ecosystem-backend-implementer handoff
## Scope
Phase 3.21 read-only backend/LMS audit of:
- LMS material download route/handler.
- DB repositories and material file storage/audit paths.
- LMS DTO/query mapping for material metadata.
- Admin audit-log rendering path.
- `tests/e2e/lms-db-materials.spec.ts` coverage for no-leak boundaries.

No product code, tests, or docs were changed beyond this handoff. No servers, Playwright, DB, psql, migrations, seeds, live endpoints, or external services were run.

## Files inspected
- `AGENTS.md`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/index.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`
- `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`

## Files changed
None - read-only audit

## Findings
1. Severity: Medium. Failed-download no-leak assertions are incomplete for response bodies and headers. Evidence: `handleLmsMaterialDownloadRequest` returns early for invalid ID, unauthenticated, denied entitlement, missing DB, and missing/unclean file at `apps/web/src/features/lms/material-download.ts:47-66`; only the success path builds file headers and streams bytes at `apps/web/src/features/lms/material-download.ts:64-66`. The E2E covers unauthenticated exact JSON at `tests/e2e/lms-db-materials.spec.ts:29-34`, teacher-denied status/cache/error at `tests/e2e/lms-db-materials.spec.ts:140-145`, and invalid-ID status/cache/error at `tests/e2e/lms-db-materials.spec.ts:156-159`, but it does not assert that failed response bodies and headers omit file metadata. Recommendation: add a shared helper in `tests/e2e/lms-db-materials.spec.ts` that consumes `await res.text()` once, parses JSON from that text, and asserts all failed download responses have no `content-disposition`, no `x-lms-sha256`, no uploaded body, no uploaded-body base64, and none of `fileBytesBase64`, `storageKey`, `storage_key`, `lms/materials/`, `contentSha256`, `storageProvider`, `retainedUntil`, `quarantineReason`, `fileName`, `mimeType`, or the concrete `fileName`/`fileSha256`. Use it for the unauthenticated `401`, teacher-entitlement `403`, invalid-id `400`, and a direct quarantined-material `404` path if the test exposes that material ID. Target part: LMS material download no-leak coverage.

2. Severity: Medium. Admin audit metadata no-leak is true by current projection but under-asserted by the browser spec. Evidence: material download audit rows are built with after-payload fields at `packages/db/src/repositories.ts:833-851`; `auditRowValues` sends payloads through `buildEvent` redaction at `packages/db/src/repositories.ts:223-241`; long 64-hex values are redacted by `packages/audit/src/redact.ts:45-78`; the admin audit view receives only normalized top-level fields from `apps/web/src/lib/backend.ts:101-111` and renders only time, actor role, action, target, and result at `apps/web/src/app/admin/audit-log/page.tsx:22-40`. Current E2E only checks that raw uploaded bodies are not present on the admin page at `tests/e2e/lms-db-materials.spec.ts:166-171`. Recommendation: after `/admin/audit-log`, assert the page still contains `education.material_download`, then assert the page HTML does not contain the clean file body, quarantined body, their base64 encodings, the concrete `fileName`, the concrete `fileSha256`, `contentSha256`, `storageProvider`, `retainedUntil`, `quarantineReason`, `fileBytesBase64`, `storageKey`, `storage_key`, or `lms/materials/`. If an audit payload viewer is later added, use a dedicated allowlist DTO rather than rendering raw `before`/`after`. Target part: admin audit rendering and LMS DB browser acceptance.

3. Severity: High. The shared `MaterialView` DTO carries internal file metadata farther than the current render surfaces need. Evidence: the DB schema stores internal file payload/storage fields at `packages/db/src/schema.ts:248-295`; the query mapper intentionally omits `fileBytesBase64` and `storageKey` but still maps `contentSha256`, `storageProvider`, `quarantineReason`, `retainedUntil`, and `deletedAt` for every material view at `apps/web/src/features/lms/queries.ts:64-81`; the exported view type includes those same fields at `packages/lms/src/types.ts:60-77`; student rendering only uses material title/type/size/scan/download URL and safe external/embed output at `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:141-159`; teacher rendering only uses title/fileName/size/scan state at `apps/web/src/app/teacher/courses/[id]/page.tsx:34-48` and `apps/web/src/app/teacher/materials/page.tsx:60-67`. Recommendation: split/narrow material DTOs so the student DTO allowlist is only `id`, `lessonId`, `title`, `materialType`, `externalUrl`, `downloadUrl`, `sizeBytes`, `scanStatus`, and `embedHtml` when applicable; the teacher DTO can additionally include `fileName` if needed. Keep `contentSha256`, `fileBytesBase64`, `storageProvider`, `storageKey`, `retainedUntil`, `deletedAt`, and raw quarantine internals inside repositories/download/audit code unless a new explicit admin DTO is designed. Add unit/integration assertions on the returned material object keys, not only rendered HTML, because server components may stop rendering a field while the DTO still carries it. Target part: LMS DTO/query mapping boundary.

4. Severity: Low. The handler unit tests verify success audit redaction and some failures, but not no-lookup/no-audit behavior on all denied paths. Evidence: `tests/integration/lms-material-download-handler.test.ts:76-89` verifies success bytes/headers and that audit rows do not contain `UExBTg==` or `PLAN`; `tests/integration/lms-material-download-handler.test.ts:91-95` only checks statuses for unauthenticated, denied, and DB-not-configured; malformed ID is the only path that proves `getFile` was not called at `tests/integration/lms-material-download-handler.test.ts:113-129`. Recommendation: extend the integration helper with spy `getFile` and `recordAudit` callbacks for unauthenticated, denied, DB-null, and quarantined/missing-file cases. Assert `getFile` is not called before auth/entitlement/db gates, `recordAudit` is not called on failures, and each failed JSON body passes the same no-leak marker list from Finding 1. Target part: LMS download handler unit coverage.

## Decisions
1. Treated the current material download implementation as mostly fail-closed for serving bytes: auth and entitlement gates run before DB lookup, and the repo only returns clean file materials attached to published lessons and courses.
2. Treated raw file bytes and storage keys as hard internal fields. Also flagged `contentSha256`, `storageProvider`, retention timestamps, and raw quarantine details as DTO-boundary risks unless explicitly needed by a rendered/admin view.
3. Did not classify the admin audit page as currently leaking material payload metadata because the page projection drops `before`/`after`; the gap is missing regression assertions.

## Risks
1. Static audit only. No Playwright trace, browser serialization, RSC payload, or live DB behavior was observed this session.
2. The workspace is not git-backed, so no git diff/status validation was available beyond direct filesystem inspection.
3. If future client components receive `MaterialView` directly, the current broad DTO shape could expose metadata that today is merely unused by server-rendered pages.

## Verification/tests
- Ran read-only filesystem/search inspection with `rg`, `Get-ChildItem`, `Get-Content`, and `Test-Path`.
- Gates run: none.
- Gates not run: Playwright, DB-backed LMS E2E, Vitest, lint/typecheck, migrations, psql, seeds, live route calls, servers, and external services. Reason: explicitly forbidden by the Phase 3.21 prompt.

## Next actions
1. Add the failed-download no-leak helper to `tests/e2e/lms-db-materials.spec.ts` and apply it to `401`, `403`, `400`, and any reachable quarantined/missing-file `404`.
2. Add admin audit page no-leak assertions for concrete file values plus internal metadata field names after `education.material_download` is visible.
3. Narrow or split `MaterialView` into explicit student/teacher/admin projections, then assert object-key allowlists at the mapper/loader boundary.
4. Extend `tests/integration/lms-material-download-handler.test.ts` with `getFile` and `recordAudit` spies for failed paths.
