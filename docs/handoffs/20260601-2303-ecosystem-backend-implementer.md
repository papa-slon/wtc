# ecosystem-backend-implementer handoff
## Scope
Read-only backend audit for Phase 3.17 LMS material upload production-readiness. Scope covered server actions, material download route/handler, DB repository/schema boundaries, object storage adapter opportunity, scan/quarantine fail-closed behavior, retention/deletion metadata, and DB-backed browser acceptance seams. No live services, servers, preview workers, Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, or production endpoints were touched.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/handoffs/20260601-2142-ecosystem-backend-implementer.md`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/e2e/education-ph3-1-mobile.spec.ts`
- `tests/e2e/smoke.spec.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `apps/web/src/features/lms/queries.ts:64` maps every file material to `/api/education/materials/${m.id}/download`; `apps/web/src/features/lms/queries.ts:189` to `apps/web/src/features/lms/queries.ts:198` loads all teacher materials through `listLessonsForCourse`, which includes drafts; `apps/web/src/app/teacher/materials/page.tsx:10` to `apps/web/src/app/teacher/materials/page.tsx:13` and `apps/web/src/app/teacher/materials/page.tsx:51` render file materials as links; the download handler then requires active education entitlement at `apps/web/src/features/lms/material-download.ts:51` to `apps/web/src/features/lms/material-download.ts:54` and the repository lookup only returns files under published lessons/courses at `packages/db/src/repositories.ts:723` to `packages/db/src/repositories.ts:739`. Recommendation: split the download authorization seam before production upload rollout: keep student downloads entitlement + published + clean-only, and add owner/admin download support for teacher/admin material management or stop rendering download links on teacher pages until the owner route exists. Target part: `apps/web/src/features/lms/material-download.ts`, `packages/db/src/repositories.ts`, `apps/web/src/features/lms/queries.ts`, teacher material pages, and browser acceptance.
2. Severity: High. Evidence: `packages/db/src/schema.ts:248` to `packages/db/src/schema.ts:261` stores file metadata and `file_bytes_base64` directly on `materials`; `packages/db/src/repositories.ts:645` to `packages/db/src/repositories.ts:648` makes file bytes part of the repository input; `packages/db/src/repositories.ts:681` states file bytes are stored base64 in the local DB row; `apps/web/src/features/lms/material-download.ts:57` to `apps/web/src/features/lms/material-download.ts:61` decodes and streams DB bytes. The target contract expects `file_key` object storage and signed download URLs at `docs/EDUCATION_LMS_PLAN.md:283` to `docs/EDUCATION_LMS_PLAN.md:299` and `docs/EDUCATION_LMS_PLAN.md:823` to `docs/EDUCATION_LMS_PLAN.md:828`. Recommendation: add an object-storage adapter interface with a deterministic local/dev implementation before wiring any real S3/R2 provider; persist provider/key/hash/size metadata and keep storage keys out of client views/audit. Target part: `packages/lms` material storage contract, `packages/db` migration/repos, upload action seam, download handler.
3. Severity: High. Evidence: current file normalization validates size/MIME/hash at `packages/lms/src/materials.ts:62` to `packages/lms/src/materials.ts:74`, and `createMaterialAction` immediately persists file input at `apps/web/src/features/lms/actions.ts:342` to `apps/web/src/features/lms/actions.ts:378`; the schema has no scan/quarantine columns at `packages/db/src/schema.ts:248` to `packages/db/src/schema.ts:277`; download eligibility checks only file kind and published course/lesson at `packages/db/src/repositories.ts:723` to `packages/db/src/repositories.ts:739`. Recommendation: add scan status metadata defaulting fail-closed (`pending`, `clean`, `quarantined`, `failed`), scanner adapter injection, audit-safe scan events, and make every download path require `scan_status='clean'` plus `deleted_at IS NULL`. Target part: DB migration/checks, `@wtc/lms` scanner policy, upload handler/repo, download lookup, tests.
4. Severity: Medium. Evidence: `deleteMaterialAction` delegates deletion at `apps/web/src/features/lms/actions.ts:381` to `apps/web/src/features/lms/actions.ts:400`; `deleteMaterial` performs a hard row delete at `packages/db/src/repositories.ts:694` to `packages/db/src/repositories.ts:708`; `materials` has no `created_at`, `deleted_at`, `deleted_by`, `delete_after`, object-deletion, or retention fields at `packages/db/src/schema.ts:248` to `packages/db/src/schema.ts:262`. `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` explicitly keeps retention policy open. Recommendation: replace production file delete with a tombstone/retention transition, filter deleted materials from teacher/student reads, schedule object deletion through an adapter, and keep the final hard purge as a separate ops/worker concern. Target part: `packages/db` schema/repos, material queries, delete server action.
5. Severity: Medium. Evidence: Phase 3.15 says browser e2e still runs mostly demo LMS flows at `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:58` to `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:60`; `tests/e2e/education-ph3-1-mobile.spec.ts:4` to `tests/e2e/education-ph3-1-mobile.spec.ts:12` says the DB-backed teacher editor/detail are out of e2e reach because there is no `DATABASE_URL`; `tests/e2e/smoke.spec.ts:59` to `tests/e2e/smoke.spec.ts:68` asserts the education page through the memory backend. The strongest current file evidence is PGlite/handler/static coverage at `tests/integration/lms-material-download-handler.test.ts:71` to `tests/integration/lms-material-download-handler.test.ts:102` and `tests/integration/db-lms-ph3-1.test.ts:110` to `tests/integration/db-lms-ph3-1.test.ts:123`. Recommendation: add an opt-in DB-backed browser acceptance seam for teacher file creation, clean/pending/quarantined status display, owner download, student download, and delete/tombstone behavior; do not count demo-mode e2e as upload acceptance. Target part: Playwright setup/seed, LMS e2e spec, test DB mode.
6. Severity: Low. Evidence: comments still describe embed as future-only at `apps/web/src/features/lms/actions.ts:52` to `apps/web/src/features/lms/actions.ts:65`, `packages/db/src/schema.ts:234` to `packages/db/src/schema.ts:244`, and `packages/lms/src/types.ts:7` to `packages/lms/src/types.ts:12`, while Phase 3.15 now supports sanitized embed writes and render paths. Recommendation: clean these comments in the same implementation slice so future agents do not treat current embed behavior as target-only. Target part: LMS docs/comments only.

## Decisions
- Preserve the existing mutation pipeline shape: CSRF first, session, RBAC/ownership/entitlement, Zod/file policy, repository transaction, audit, revalidate.
- Treat Phase 3.15 DB byte storage as local acceptance only, not production object storage.
- The bounded local implementation slice should add production-shaped seams without calling real cloud services: object-store interface, local/dev adapter, scanner interface, fail-closed scan metadata, retention/tombstone metadata, and route-handler tests.
- Do not claim an N-agent audit from this file. This is one per-agent backend handoff for the orchestrator to aggregate with other Phase 3.17 handoffs.

## Risks
- Tightening downloads to `scan_status='clean'` will block existing file rows unless the migration deliberately backfills or quarantines them. The backfill rule must be explicit and environment-safe.
- Adding owner/admin download support can leak draft materials if it reuses the student-published lookup without a separate ownership check. Keep student and teacher/admin authorization branches visibly separate.
- Moving from inline DB bytes to object metadata has data migration and cleanup risk. A transitional adapter should keep local tests deterministic while production remains fail-closed until provider configuration is explicit.
- Soft delete/retention changes can change teacher material counts and audit expectations; update queries and tests in the same slice.

## Verification/tests
RUN:
- Read-only source and document inspection with `rg`, `Get-Content`, and targeted line-number excerpts.
- `git status --short` - failed because this workspace is not a git repository; no git branch/status evidence is available.

NOT RUN:
- `npm test`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run typecheck`, `npm run build`, `npm run db:generate`, migrations, Playwright, or any server start. Reason: this lane was a read-only audit with the handoff as the only permitted file write.
- Live Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, production endpoint, or object-storage/scanner calls. Reason: explicitly forbidden by scope.

## Next actions
1. Add the next DB migration for material production metadata: storage provider/key/etag or local object id, scan status/timestamps/error/quarantine fields, deleted/deleted_by/delete_after/object_deleted_at fields, and indexes for downloadable clean files. Keep storage keys out of `MaterialView`.
2. Add `packages/lms` object-store and scanner contracts plus deterministic local adapters. No real S3/R2 or malware service calls in this local slice.
3. Extract upload orchestration behind an injectable backend handler, analogous to `material-download.ts`: validate file, write object through adapter, create material metadata as `pending`, run/mock scan, mark `clean` or `quarantined`, and audit metadata only.
4. Update repository download lookups so student downloads require active education entitlement, published course/lesson, `scan_status='clean'`, and not deleted; teacher/admin downloads require ownership/admin and not deleted, with a clear policy for draft files.
5. Change material delete to a tombstone/retention transition and adapter-backed object delete request; leave physical purge for a later worker/devops slice.
6. Add PGlite handler/repo tests for pending/quarantined/clean/deleted states and an opt-in DB-backed Playwright acceptance for teacher upload/download and student download.
