# ecosystem-db-architect handoff
## Scope
Read-only Phase 3.17 DB architecture audit for LMS material production-readiness after Phase 3.15. Scope was limited to the LMS material persistence model and repository support for object storage keys, file scan/quarantine status, retention/deletion timestamps, download audit, and local/dev adapter honesty. No live services, servers, Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, systemd, preview-worker, or production endpoints were touched.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/DATA_MODEL.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `.env.example`
- `packages/config/src/env.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/meta/0011_snapshot.json`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-service.test.ts`

## Files changed
None - read-only audit

## Findings
1. High - Production object-storage identity is missing from the DB material model. Evidence: the current `materials` table has `file_name`, `mime_type`, `size_bytes`, `content_sha256`, `file_bytes_base64`, and `embed_html`, but no `storage_provider`, `storage_bucket`, `storage_key`, object ETag/version, or upload timestamp (`packages/db/src/schema.ts:248`, `packages/db/src/schema.ts:256`, `packages/db/src/schema.ts:260`, `packages/db/src/schema.ts:261`). Migration `0011` added local byte columns only (`packages/db/migrations/0011_late_madelyne_pryor.sql:3`, `packages/db/migrations/0011_late_madelyne_pryor.sql:7`, `packages/db/migrations/0011_late_madelyne_pryor.sql:16`). The LMS plan still requires object-store `file_key` semantics and short-lived signed download behavior (`docs/EDUCATION_LMS_PLAN.md:298`, `docs/EDUCATION_LMS_PLAN.md:299`). Recommendation: add a forward-only migration that keeps existing local rows but adds object-storage metadata columns and broadens the file payload check to allow either explicit local DB bytes or object-backed metadata, never a public URL. Target part: `materials` schema and file-material repository DTOs.

2. High - File scan/quarantine lifecycle is absent, and downloads do not gate on scan state. Evidence: the file material row contains metadata and bytes only (`packages/db/src/schema.ts:256`, `packages/db/src/schema.ts:260`); `getMaterialFileForPublishedLesson()` filters only material id, `kind='file'`, published lesson, and published course before returning bytes (`packages/db/src/repositories.ts:723`, `packages/db/src/repositories.ts:739`, `packages/db/src/repositories.ts:741`). The current blocker list explicitly leaves malware scanning/quarantine open (`docs/PRODUCTION_BLOCKERS_CURRENT.md:16`). Recommendation: add `scan_status`, `scan_provider`, `scan_checked_at`, `scan_result`, `quarantined_at`, and `quarantine_reason`; make download lookup fail closed for `pending`, `failed`, and `quarantined` rows; add a repository primitive to record scan results with redacted audit. Target part: material download repository and future scanner adapter boundary.

3. High - Material deletion is hard-delete, so retention and storage cleanup cannot be enforced. Evidence: `deleteMaterial()` calls `tx.delete(s.materials)` and removes the row immediately (`packages/db/src/repositories.ts:694`, `packages/db/src/repositories.ts:705`, `packages/db/src/repositories.ts:707`). The current schema has no `deleted_at`, `delete_after`, `retention_until`, `storage_deleted_at`, or `deleted_by` columns on `materials` (`packages/db/src/schema.ts:248`, `packages/db/src/schema.ts:261`), while the data-model convention says soft deletes exist where stated and the documented materials model includes `deleted_at` (`docs/DATA_MODEL.md:24`, `docs/DATA_MODEL.md:848`, `docs/DATA_MODEL.md:862`). Recommendation: replace material hard delete with soft delete in the next DB slice; hide deleted rows from list/download queries; add retention and storage-delete timestamps plus a purge-candidate query for a later worker/devops phase. Target part: `deleteMaterial`, `listMaterials`, material download lookup, and migration.

4. Medium - Download audit exists for successful DB-byte streams, but production-grade download audit is incomplete. Evidence: the route records audit only after successful file lookup and byte decode (`apps/web/src/features/lms/material-download.ts:57`, `apps/web/src/features/lms/material-download.ts:60`, `apps/web/src/features/lms/material-download.ts:61`); denial and not-found paths return before any material-download audit (`apps/web/src/features/lms/material-download.ts:51`, `apps/web/src/features/lms/material-download.ts:56`, `apps/web/src/features/lms/material-download.ts:58`). The DB helper writes a generic `audit_logs` row with file metadata but no IP, user agent, request id, delivery status, storage provider, or signed-url issue/consume lifecycle (`packages/db/src/repositories.ts:757`, `packages/db/src/repositories.ts:761`, `packages/db/src/repositories.ts:764`). Tests only assert the success audit omits raw bytes/content (`tests/integration/lms-material-download-handler.test.ts:81`, `tests/integration/lms-material-download-handler.test.ts:83`). Recommendation: add a structured `material_download_events` ledger or equivalent repository event writer for success and failure attempts, with redacted metadata only; keep `audit_logs` as the human audit trail. Target part: download audit repository and route handler injection.

5. Medium - The local/dev storage boundary is honest in UI copy, but not enforced by config or DB state. Evidence: teacher UI states files are stored in the local DB and that production object storage/scanning remain separate gates (`apps/web/src/app/teacher/courses/[id]/page.tsx:237`, `apps/web/src/app/teacher/courses/[id]/page.tsx:240`; `apps/web/src/app/teacher/materials/page.tsx:35`, `apps/web/src/app/teacher/materials/page.tsx:38`), and backend selection fails closed without `DATABASE_URL` in production (`apps/web/src/lib/backend.ts:3`, `apps/web/src/lib/backend.ts:5`, `apps/web/src/lib/backend.ts:44`, `apps/web/src/lib/backend.ts:47`). But `createMaterialAction()` accepts file uploads whenever a DB exists and converts the upload to local bytes (`apps/web/src/features/lms/actions.ts:120`, `apps/web/src/features/lms/actions.ts:125`, `apps/web/src/features/lms/actions.ts:342`, `apps/web/src/features/lms/actions.ts:369`), and config has no LMS storage provider/readiness fence (`packages/config/src/env.ts:17`, `packages/config/src/env.ts:26`, `.env.example:11`, `.env.example:17`). Recommendation: add `LMS_FILE_STORAGE_MODE` or equivalent readiness config and make staging/production reject local DB byte storage for new file uploads; expose the resolved mode in LMS queries so "Postgres" is not mistaken for production object storage. Target part: config, action guard, and LMS mode DTO.

6. Medium - Repository support for object upload handoff/idempotency is not present. Evidence: `createMaterial()` inserts the material and upload audit in one transaction directly from the submitted payload (`packages/db/src/repositories.ts:681`, `packages/db/src/repositories.ts:688`, `packages/db/src/repositories.ts:690`); there is no pending-storage state, upload intent idempotency key, or complete/abort repository primitive. Recommendation: keep the next slice local-testable by adding metadata-only DB primitives: `createMaterialUploadIntent`, `completeMaterialStorage`, `recordMaterialScanResult`, `softDeleteMaterial`, and `getMaterialDownloadCandidate`; route/storage adapters can be injected later without live object-store calls. Target part: `packages/db/src/repositories.ts`.

7. Medium - Data-model docs have drifted behind the current implementation and the production target. Evidence: `docs/DATA_MODEL.md` still documents materials as `type`, `filename`, `url`, and `deleted_at` (`docs/DATA_MODEL.md:854`, `docs/DATA_MODEL.md:858`, `docs/DATA_MODEL.md:859`, `docs/DATA_MODEL.md:862`), while the current schema uses `label`, nullable `url`, `kind`, local byte columns, and `embed_html` (`packages/db/src/schema.ts:253`, `packages/db/src/schema.ts:260`, `packages/db/src/schema.ts:261`). Recommendation: update `docs/DATA_MODEL.md` in the implementation slice to distinguish current local DB byte storage, the new object-storage metadata columns, and any TARGET-only columns. Target part: DB documentation truth.

## Decisions
- Treat Phase 3.15 `file_bytes_base64` storage as a local acceptance mechanism only. It should remain for dev/PGlite compatibility but must be explicitly marked in DB state as local/dev, not silently production-valid.
- The next implementation should be a bounded, additive DB/repository slice: migration `0012` or next available migration, plus `schema.ts`, `repositories.ts`, PGlite tests, and docs truth updates. No live object-store, scanner, or production endpoint is required to test the DB slice.
- Recommended migration shape: add nullable object-storage metadata columns to `materials`; add scan/quarantine columns; add soft-delete/retention/storage-delete timestamps; add a structured `material_download_events` table or equivalent event ledger; backfill existing `file` rows as `storage_provider='local_db'` and `scan_status='skipped_dev'` or another explicit dev-only status.
- Recommended constraint shape: broaden `materials_payload_check` so `kind='file'` allows exactly one storage backing: local DB bytes for explicit dev rows or object metadata for production rows. Link and embed payload exclusivity should remain.
- Downloads should fail closed unless the row is published, not soft-deleted, not retention-deleted, integrity metadata matches, and scan state is production-allowed. Failure should be auditable without leaking object keys, signed URLs, file bytes, or raw teacher input.

## Risks
- Leaving hard deletes in place will orphan future object-store files or erase the DB evidence needed to reconcile object deletion.
- Allowing production uploads while `DATABASE_URL` exists but object storage/scanning is absent would make the UI's current honesty copy weaker than the server-side enforcement.
- Adding object metadata without revising the existing file payload check would create dead columns: the current check still requires `file_bytes_base64` for every `kind='file'` row.
- A scanner adapter should not be faked. The DB can model `pending`, `clean`, `quarantined`, `failed`, and explicit local/dev skip states; only a later integration slice should wire a real scanner.

## Verification/tests
RUN:
- Read-only file inspection with `Get-Content`, `rg --files`, and `rg -n` across the protocol docs, DB schema/repositories/migrations, LMS package, LMS web surfaces, docs, and relevant tests.

NOT RUN:
- `npm test`, `npm run typecheck`, `npm run db:generate`, `node scripts/gates.mjs full`, and Playwright e2e. Reason: this was a read-only audit phase; no implementation was made beyond this required handoff file.
- Real object storage, malware scanner, signed URL provider, real Postgres, live Stripe, live Axioma, live TradingView, live bot/exchange, SSH, tmux, systemd, preview-worker, and production endpoints. Reason: explicitly out of scope/forbidden for this read-only audit.

## Next actions
1. Implement the bounded additive LMS material persistence slice locally: next migration plus `schema.ts` and repository updates for object metadata, scan/quarantine state, soft deletion/retention timestamps, and structured download events.
2. Add PGlite migration/repository tests that replay all migrations, preserve existing link/file/embed rows, assert object-backed file rows do not require DB bytes, block pending/quarantined/deleted downloads, and verify redacted download event/audit rows.
3. Add config/readiness tests so staging/production cannot create new local-DB-byte file materials without object storage and scanner readiness.
4. Update `docs/DATA_MODEL.md`, `docs/EDUCATION_LMS_PLAN.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md` after implementation with current-vs-target truth and exact gates run/not run.
