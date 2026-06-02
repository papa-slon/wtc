# ecosystem-backend-implementer handoff
## Scope
Phase 3.15 read-only backend/platform audit, epoch 20260601-2142.

Scope was LMS uploads and stored embed sanitizer only. This audit inspected the current docs, DB schema/repos/migrations, `@wtc/lms`, education/admin web actions/pages, and tests to identify the smallest real implementation slice for durable LMS file metadata/bytes and sanitized embeds.

No live services were started, stopped, or mutated. No external calls were made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/index.ts`
- `packages/db/src/client.ts`
- `packages/db/src/seed.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0005_noisy_supreme_intelligence.sql`
- `packages/db/migrations/0010_axioma_account_link_hash.sql`
- `packages/db/migrations/meta/_journal.json`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/urls.ts`
- `packages/lms/src/guards.ts`
- `packages/lms/src/completion.ts`
- `packages/lms/src/lms.test.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/lib/lms-types.ts`
- `apps/web/src/app/teacher/courses/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/community/page.tsx`
- `apps/web/src/app/teacher/students/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`
- `tests/integration/lms-fixes.test.ts`
- `tests/integration/lms-community-static.test.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` states LMS uploads and embeds are not built; `packages/db/src/schema.ts:244` to `packages/db/src/schema.ts:250` shows `materials` only has `lessonId`, `label`, `url`, and `kind`; `packages/db/src/repositories.ts:630` to `packages/db/src/repositories.ts:639` creates only link metadata. Recommendation: implement file upload as a real package/db slice before exposing UI controls: add a DB-backed storage table or adapter-backed metadata table, store bytes or object references durably, enforce size/MIME limits, audit metadata only, and expose downloads through an entitlement-checked route. Target part: `packages/db` migration/repos, `packages/lms` storage contract, `apps/web` material upload/download route/action.

2. Severity: High. Evidence: `packages/db/src/schema.ts:234` to `packages/db/src/schema.ts:241` allows `lessons.content_type = 'embed'` but has no `embed_html` column; `apps/web/src/features/lms/actions.ts:53` to `apps/web/src/features/lms/actions.ts:60` deliberately excludes `embed` from the write schema; `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:82` to `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:85` renders only a placeholder. Recommendation: build a server-side sanitizer in `@wtc/lms` first, then add `lessons.embed_html` and only then allow `contentType: 'embed'` in the teacher action. Store only sanitized embed output, and keep render tests proving no raw unsanitized teacher HTML is emitted. Target part: `packages/lms` sanitizer, `packages/db` lesson repo/migration, `apps/web/src/features/lms/actions.ts`, student lesson renderer.

3. Severity: Medium. Evidence: `apps/web/src/features/lms/actions.ts:64` limits material writes to `kind: 'link'`, but `packages/db/src/repositories.ts:631` accepts `kind: string` and `packages/db/src/schema.ts:249` has no DB CHECK on `materials.kind`; `packages/lms/src/types.ts:12` already exposes `MaterialType = 'link' | 'file' | 'embed'`. Recommendation: when implementing uploads, do not widen the UI first. Replace the repo input with a discriminated union and add DB constraints for allowed material kinds and required fields per kind. If reusing the existing `materials` table, account for the current `url NOT NULL` shape; a sidecar `lms_material_files` table is the smallest low-risk route because it avoids weakening existing link rows. Target part: DB material schema/repo boundary.

4. Severity: Medium. Evidence: `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:123` to `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:127` renders material links directly through `safeHttpsUrl`; `docs/EDUCATION_LMS_PLAN.md:295` to `docs/EDUCATION_LMS_PLAN.md:299` requires object/file downloads through a server endpoint that verifies entitlement and never returns the storage key. Recommendation: add `GET /api/education/materials/[materialId]/download` before any file UI. The route must require a user, require active education entitlement, verify the material belongs to a published lesson/course visible to that user, then stream bytes or issue a short-lived signed URL. Target part: education material download route and student material renderer.

5. Severity: Low. Evidence: `tests/integration/lms-ph3-1-static.test.ts:48` to `tests/integration/lms-ph3-1-static.test.ts:50` asserts no embed write path, `tests/integration/lms-ph3-1-static.test.ts:60` to `tests/integration/lms-ph3-1-static.test.ts:67` asserts no raw embed render, and `tests/integration/lms-ph3-1-static.test.ts:105` to `tests/integration/lms-ph3-1-static.test.ts:114` asserts material writes stay link-only. Recommendation: update these tests in the same implementation slice as the sanitizer/upload work, not before. Add positive sanitizer/upload/download tests while preserving negative XSS, scheme, RBAC, ownership, and entitlement cases. Target part: integration/static/e2e test suite.

## Decisions
- Treat the current link-only LMS material path as intentional and correct for the current build. Do not expose `file` or `embed` controls until package/db/server boundaries exist.
- Keep business logic out of React pages. Put sanitizer, storage policy, MIME/size validation, and ownership/entitlement decisions in `packages/*` plus server route/action layers.
- Prefer a smallest durable file slice that does not require changing existing link semantics: add a dedicated DB-backed file/material-object table for bytes and metadata, then map it into the existing LMS material views. If product insists on one `materials` table, plan an explicit migration for the existing `url NOT NULL` incompatibility.
- Embed should be package-first: sanitizer unit tests and canonical sanitized storage before any teacher write UI accepts raw embed input.

## Risks
- A direct DB writer can currently set `lessons.content_type = 'embed'` because the CHECK allows it, but there is no embed payload column. The current renderer is safe because it emits only a placeholder, but the product experience is incomplete.
- The lower-level material repo accepts arbitrary `kind` from internal callers. The user-facing action blocks this today, but upload work should close the lower-level boundary before widening callers.
- Adding file support in the existing `materials` table is not purely additive because `url` is currently required. A sidecar file table reduces migration risk for the first durable bytes slice.
- No background read-only agent processes were available in this Codex session; this file is a single per-agent handoff and must not be counted as an N-agent audit.

## Verification/tests
- RUN: static local inspection only with `rg` and targeted `Get-Content` line reads.
- NOT RUN: `npm test` - skipped because this was a read-only audit handoff request, not an implementation/gate session.
- NOT RUN: `npm run typecheck` - skipped for the same reason.
- NOT RUN: `npm run lint` - skipped for the same reason.
- NOT RUN: `npm run build` - skipped for the same reason.
- NOT RUN: `npm run db:generate` / `npm run db:migrate` / `npm run db:seed` - skipped to avoid generating or mutating DB artifacts during discovery.
- NOT RUN: Playwright/e2e - skipped because no live services were to be started.
- No gate is claimed green in this session.

## Next actions
1. Implement `packages/lms/src/embed-sanitizer.ts` with an allowlist sanitizer for a single iframe embed: https-only `src`, bounded dimensions, allowed attributes only, no `script`, no `on*`, no `style`, no `data:`. Add malicious-input unit tests.
2. Add a DB migration after `0010` for `lessons.embed_html` and either a new durable file table such as `lms_material_files` (`lesson_id`, `title`, `file_name`, `mime_type`, `file_size_bytes`, `sha256`, `bytes bytea`, `uploaded_by`, timestamps) or a planned one-table material migration that resolves `materials.url NOT NULL`.
3. Add `packages/db` repos for sanitized embed updates, file create/list/delete, and entitlement-safe download lookup. Repos should audit only booleans/metadata such as `hasEmbedHtml`, `mimeType`, `fileSizeBytes`, and `sha256`; never audit raw embed HTML or bytes.
4. Add teacher upload/write paths only after the package/db boundary exists: CSRF first, require user, teacher/admin RBAC, course ownership, zod/file validation, storage write, in-transaction audit, revalidate.
5. Add student download route `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`: require user, require education entitlement, verify published course/lesson/material visibility, then stream bytes or redirect to a short-lived signed URL. Never expose storage keys.
6. Update teacher and student surfaces to show file materials/download buttons and sanitized embed lessons, then update static/integration/e2e tests in the same slice.
