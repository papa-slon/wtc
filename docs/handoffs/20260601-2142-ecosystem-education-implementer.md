# ecosystem-education-implementer handoff
## Scope
Phase 3.15 read-only audit for epoch 20260601-2142. Scope was LMS uploads and the stored embed sanitizer production blocker. No product code was changed. No live services were started or mutated. No external calls were made.

Focus: identify the next local implementation slice that can land file byte storage and stored embed sanitization without a one-file prototype, fake integration, raw HTML rendering, or pretending file uploads exist before the backend boundary is real.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260531-0130-phase-3-1-lms-rich.md`
- `docs/handoffs/20260601-1740-ecosystem-education-implementer.md`
- `packages/lms/package.json`
- `packages/lms/src/index.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/urls.ts`
- `packages/lms/src/completion.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0005_noisy_supreme_intelligence.sql`
- `packages/audit/src/audit.ts`
- `packages/config/src/env.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/lms-types.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/community/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Target part: LMS material file byte storage. Evidence: production blocker list explicitly says file byte storage and stored embed sanitizer are not built (`docs/PRODUCTION_BLOCKERS_CURRENT.md:16`). Current DB material shape is still only `lesson_id`, `label`, `url`, and `kind` (`packages/db/src/schema.ts:244`, `packages/db/src/schema.ts:248`, `packages/db/src/schema.ts:249`), and the original migration matches that shape (`packages/db/migrations/0000_broken_jack_murdock.sql:114`, `packages/db/migrations/0000_broken_jack_murdock.sql:118`, `packages/db/migrations/0000_broken_jack_murdock.sql:119`). The repo create path is documented as plain link metadata and accepts only `{ lessonId, label, url, kind }` (`packages/db/src/repositories.ts:630`, `packages/db/src/repositories.ts:631`, `packages/db/src/repositories.ts:637`). The action boundary is link-only (`apps/web/src/features/lms/actions.ts:63`, `apps/web/src/features/lms/actions.ts:64`), and teacher UI says upload bytes are not enabled until object storage, virus scanning, and retention are reviewed (`apps/web/src/app/teacher/materials/page.tsx:29`, `apps/web/src/app/teacher/materials/page.tsx:31`, `apps/web/src/app/teacher/materials/page.tsx:32`). Recommendation: land a bounded storage slice before exposing `file`: add material file metadata columns, a discriminated LMS material DTO, a storage port plus real local filesystem/dev adapter, strict MIME/size policy, upload route/action, entitlement-checked download route, audit, and PGlite/route tests. Do not store bytes in React/server-action-only code and do not represent stored files as public external URLs.

2. Severity: High. Target part: stored embed sanitizer. Evidence: the LMS plan says `embed` is not writable/renderable until the sanitizer lands (`docs/EDUCATION_LMS_PLAN.md:32`, `docs/EDUCATION_LMS_PLAN.md:36`), and requires `embed_html` to be sanitized before storage with an allowlist (`docs/EDUCATION_LMS_PLAN.md:272`, `docs/EDUCATION_LMS_PLAN.md:811`, `docs/EDUCATION_LMS_PLAN.md:813`, `docs/EDUCATION_LMS_PLAN.md:816`). Current schema only has `content_type` and `external_url`; the comment states `embed` needs a server-side sanitizer first (`packages/db/src/schema.ts:234`, `packages/db/src/schema.ts:236`, `packages/db/src/schema.ts:237`, `packages/db/src/schema.ts:241`). The Phase 3.1 migration added only `content_type` and `external_url`, not `embed_html` (`packages/db/migrations/0005_noisy_supreme_intelligence.sql:3`, `packages/db/migrations/0005_noisy_supreme_intelligence.sql:4`). Current actions exclude `embed` from the Zod enum (`apps/web/src/features/lms/actions.ts:53`, `apps/web/src/features/lms/actions.ts:59`), and the student route renders only a placeholder for `embed` (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:82`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:84`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:85`). Recommendation: implement `sanitizeEmbedHtml(raw)` in `packages/lms` with allowlist tests before any migration or UI write path adds `embed_html`; then co-land `lessons.embed_html`, repo-level sanitize-before-write, teacher form support, sandboxed student rendering, and a security-auditor sign-off gate.

3. Severity: Medium. Target part: LMS domain/repository contract. Evidence: repository methods currently accept `contentType?: string` and `kind: string` (`packages/db/src/repositories.ts:595`, `packages/db/src/repositories.ts:619`, `packages/db/src/repositories.ts:631`), while safety currently depends on the app action Zod enums (`apps/web/src/features/lms/actions.ts:53`, `apps/web/src/features/lms/actions.ts:64`). The UI-facing material type already advertises `link | file | embed` (`packages/lms/src/types.ts:57`, `packages/lms/src/types.ts:61`, `packages/lms/src/types.ts:62`), and query mapping casts DB `kind` into that broader type while still exposing every material as `externalUrl` (`apps/web/src/features/lms/queries.ts:63`, `apps/web/src/features/lms/queries.ts:64`). Recommendation: before enabling file/embed outside the current link-only surface, move the discriminated validation boundary into `packages/lms` and/or repository input types, then make app actions call those package-level schemas. File materials should not carry `externalUrl`; embed lessons should not be representable without sanitized `embedHtml`.

4. Severity: Medium. Target part: material download route and audit trail. Evidence: the plan requires `GET /api/education/materials/[materialId]/download` to verify entitlement and call `getMaterialDownloadUrl` (`docs/EDUCATION_LMS_PLAN.md:1435`, `docs/EDUCATION_LMS_PLAN.md:1436`, `docs/EDUCATION_LMS_PLAN.md:1437`), and says `file_key` must never be returned to clients (`docs/EDUCATION_LMS_PLAN.md:298`, `docs/EDUCATION_LMS_PLAN.md:299`). Current student lesson rendering opens `material.externalUrl` directly (`apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:117`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:123`, `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:127`). The audit enum has `education.material_upload` and `education.material_delete`, but no material download event yet (`packages/audit/src/audit.ts:84`, `packages/audit/src/audit.ts:91`, `packages/audit/src/audit.ts:92`). Recommendation: include the download endpoint in the same file-storage slice: session + entitlement + published-course checks, no public `file_key`, no query token secrets, no-store/nosniff headers for streamed local bytes, and a normalized material-download audit code.

5. Severity: Medium. Target part: storage safety configuration. Evidence: the product plan defines max size, allowed MIME types, object storage, and short-lived signed download behavior (`docs/EDUCATION_LMS_PLAN.md:295`, `docs/EDUCATION_LMS_PLAN.md:296`, `docs/EDUCATION_LMS_PLAN.md:297`, `docs/EDUCATION_LMS_PLAN.md:298`). Current config validation covers core DB/secrets/bot/Axioma/billing keys but has no LMS storage provider, upload size, MIME, scan, or storage-root settings (`packages/config/src/env.ts:13`, `packages/config/src/env.ts:22`, `packages/config/src/env.ts:28`, `packages/config/src/env.ts:39`, `packages/config/src/env.ts:50`). Teacher UI already names virus scanning and retention as unresolved review items (`apps/web/src/app/teacher/materials/page.tsx:31`, `apps/web/src/app/teacher/materials/page.tsx:32`). Recommendation: add explicit LMS storage config and fail-closed readiness before teacher upload controls appear. For the local slice, a filesystem adapter is acceptable only if it is a real byte-store implementation behind the storage port, path-traversal safe, quota/size checked, and clearly labelled as local/dev; production should require object-store configuration before enabling file uploads.

6. Severity: Medium. Target part: acceptance tests for the next slice. Evidence: current static tests intentionally prove negative guardrails: no `embed` write path, no raw `dangerouslySetInnerHTML`, and material writer/form link-only (`tests/integration/lms-ph3-1-static.test.ts:48`, `tests/integration/lms-ph3-1-static.test.ts:60`, `tests/integration/lms-ph3-1-static.test.ts:64`, `tests/integration/lms-ph3-1-static.test.ts:105`, `tests/integration/lms-ph3-1-static.test.ts:114`). Current PGlite material tests only create link materials (`tests/integration/db-lms-ph3-1.test.ts:92`, `tests/integration/db-lms-ph3-1.test.ts:96`, `tests/integration/db-lms-ph3-1.test.ts:97`). Recommendation: next implementation must add positive tests, not only remove guards: sanitizer malicious-input cases, repo sanitize-before-write, migration round-trip for `embed_html` and file metadata, upload/download handler tests with fixture bytes, entitlement denial tests, audit-no-secret/no-file-key tests, and one static guard that rejects any raw `embed_html` render bypass.

## Decisions
- No product code was edited.
- The current implementation remains intentionally link-only for LMS materials and non-rendering for stored embeds.
- The next local slice should not be a UI unlock first. It should land package/domain primitives, DB shape, route handlers, app wiring, and tests together.
- A local filesystem byte-storage adapter can be a real local acceptance adapter if it actually persists and streams bytes behind an interface. A placeholder signed URL, fake file key, or metadata-only file form would not clear the blocker.
- `embed_html` should not be added independently from the sanitizer and repo-level sanitize-before-write call.

## Risks
- Enabling `file` in the current material form would be misleading because there is no byte storage, no download route, no `file_key`, and no download audit.
- Enabling `embed` in the current lesson form would rely on a DB CHECK value that exists only for forward compatibility; there is no `embed_html` column or sanitizer.
- Leaving repo inputs as generic strings makes future non-action callers easy to get wrong once file/embed support expands.
- The docs still contain older dev-stub language around material files. The implementation slice should choose an honest local adapter or explicitly keep production blocked rather than reviving metadata-only upload UX.

## Verification/tests
- RUN: `npm test -- tests/integration/lms-ph3-1-static.test.ts tests/integration/lms-community-static.test.ts tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-service.test.ts`
- RESULT: PASS, 4 files, 49 tests passed.
- NOT RUN: full `node scripts/gates.mjs full`; reason: read-only focused audit requested, and full gate was outside the scoped LMS upload/embed investigation.
- NOT RUN: Playwright e2e; reason: no live server per request, and current e2e does not yet exercise DB-backed teacher upload/embed flows.
- NOT RUN: live services/external calls; reason: explicitly forbidden for this audit.

## Next actions
1. Phase 3.15 implementation slice A: add `packages/lms` sanitizer and file policy primitives. Include `sanitizeEmbedHtml`, allowed iframe attribute/src checks, file MIME/size policy, and discriminated `LinkMaterial` / `FileMaterial` / `EmbedLesson` types.
2. Phase 3.15 implementation slice B: add DB migration and repos. Add `lessons.embed_html`; add material file metadata (`file_key`, `file_name`, `file_size_bytes`, `mime_type`, and a CHECK or typed discriminator for `kind/material_type`); sanitize inside `updateLesson` before writing; store file metadata only after storage adapter success; audit without raw URLs, file keys, or raw HTML.
3. Phase 3.15 implementation slice C: add route/action wiring. Teacher upload action validates CSRF, RBAC, ownership, MIME/size, then calls the storage port and repo in the correct order. Student download route verifies session, entitlement, course/lesson visibility, then streams/redirects through the storage provider without exposing `file_key`.
4. Phase 3.15 implementation slice D: expose UI only after backend gates exist. Teacher course editor may show `file` and `embed` only when the storage/sanitizer readiness checks pass. Student lesson page renders sanitized embeds in a sandboxed boundary and file materials through the download route, not raw `externalUrl`.
5. Phase 3.15 verification: run focused sanitizer tests, PGlite migration/repo tests, route handler tests with fixture bytes, static no-raw-HTML/no-file-key tests, then `node scripts/gates.mjs full`. Run e2e only after the route tests pass and with no live external service dependency.
