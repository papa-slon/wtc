# ecosystem-backend-implementer handoff
## Scope
Read-only Phase 3.24 backend/db inspection for implementing a safe LMS material cleanup repository function and optional worker integration. Scope covered current LMS material schema, migrations, repository behavior, LMS material action/download boundaries, worker DB tick flow, focused tests, and prior LMS handoffs. No product code, tests, or docs were edited except this single handoff.

## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/index.ts`
- `packages/db/migrations/0011_late_madelyne_pryor.sql`
- `packages/db/migrations/0012_old_maelstrom.sql`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/jobs.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/teacher/materials/page.tsx`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md`
- `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md`
- `docs/handoffs/20260601-2303-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md`
- `docs/handoffs/20260602-0125-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0125-phase-3-23-lms-db-managed-runner.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/EDUCATION_LMS_PLAN.md`

## Files changed
- `docs/handoffs/20260602-0144-ecosystem-backend-implementer.md`

## Findings
1. Severity: High. Evidence: `packages/db/src/schema.ts:260`-`267`, `packages/db/src/schema.ts:271`-`274`, `packages/db/migrations/0012_old_maelstrom.sql:1`-`18`, `packages/db/src/repositories.ts:676`-`704`, and `packages/db/src/repositories.ts:744`-`765`. The current schema already has local file bytes, storage provider/key, scan state, retention timestamp, soft-delete timestamp, and supporting indexes; `deleteMaterial()` is a tombstone transition, not a hard purge. Recommendation: implement cleanup as a repository primitive in `packages/db/src/repositories.ts`, not as a new migration or route, unless the chosen design needs new state such as `deleted_by` or object-delete tracking. Target part: `@wtc/db` LMS material repository.

2. Severity: High. Evidence: `packages/db/src/repositories.ts:648`-`650`, `packages/db/src/repositories.ts:787`-`813`, `apps/web/src/features/lms/queries.ts:65`-`72`, and `docs/handoffs/20260601-2303-phase-3-17-lms-storage-scan-retention.md:39`-`50`. Active material reads/downloads filter `deleted_at` but do not treat `retained_until` as an access-expiry field; the retention date is cleanup metadata. Recommendation: cleanup must hard-delete only file rows that are already soft-deleted and past retention, for example `kind='file' AND storage_provider='db-local' AND deleted_at IS NOT NULL AND retained_until < cutoff`. Do not purge active file rows just because `retained_until` is in the past. Target part: cleanup eligibility predicate.

3. Severity: High. Evidence: `packages/db/src/schema.ts:280`, `packages/lms/src/materials.ts:4`-`5`, `packages/lms/src/materials.ts:147`-`154`, and `packages/db/migrations/0012_old_maelstrom.sql:10`-`14`. The current runtime writes `db-local` rows, but the schema only requires a non-null storage provider/key, so future object-storage rows can exist without a schema change. Recommendation: the first safe cleanup function should either restrict hard deletion to `LMS_LOCAL_STORAGE_PROVIDER` / `db-local`, or require an object-storage deletion adapter/outbox before deleting non-local rows. Otherwise the row deletion can orphan an object by deleting the only stored key. Target part: storage-provider boundary.

4. Severity: Medium. Evidence: `packages/db/src/schema.ts:288`-`292`, `packages/db/src/repositories.ts:811`-`823`, and `apps/web/src/features/lms/material-download.ts:62`-`66`. File rows require `file_bytes_base64` under the current payload check, and the download handler streams bytes from that row. Recommendation: if the goal is to remove stored bytes after retention, use hard row deletion for eligible local file rows. Do not try to null `fileBytesBase64` in-place without a schema/check migration and revised download semantics. Target part: cleanup mutation shape.

5. Severity: Medium. Evidence: `packages/db/src/repositories.ts:1893`-`1905`, `apps/worker/src/index.ts:68`-`114`, `apps/worker/src/tick-once.ts:22`-`25`, `packages/db/src/schema.ts:324`-`328`, and `tests/integration/db-axioma-jti.test.ts:118`-`127`. The existing cleanup pattern is a repository function returning counts, called directly from `runDbWorkerTick()` before worker health is recorded; `job_queue` is explicitly reserved and not consumed. Recommendation: optional worker integration should follow the JTI purge pattern: add `lmsMaterialsPurged` to `DbWorkerTickResult`, call the repository from `runDbWorkerTick()`, record only aggregate counts in health detail, update one-shot tick output, and add focused worker tests. Do not enqueue `job_queue` work in this slice. Target part: worker DB tick integration.

6. Severity: Medium. Evidence: `packages/db/src/repositories.ts:711`-`725`, `packages/db/src/repositories.ts:833`-`849`, `tests/integration/lms-ph3-1-static.test.ts:148`-`161`, `tests/integration/lms-ph3-1-static.test.ts:188`-`197`, and `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`23`. Existing LMS boundaries deliberately keep raw bytes, storage keys, retention/deletion fields, and detailed audit payloads out of UI/generated artifacts. Recommendation: the cleanup function and worker health/logging should return/report aggregate counts only, not material ids, storage keys, hashes, filenames, or base64. If an audit row is added, keep it aggregate-only, such as `{ purged: n, storageProvider: 'db-local' }`, with no row-level metadata. Target part: no-leak observability.

7. Severity: Medium. Evidence: `tests/integration/db-lms-ph3-1.test.ts:101`-`110`, `tests/integration/db-lms-ph3-1.test.ts:112`-`128`, `tests/integration/lms-material-download-handler.test.ts:128`-`181`, and `tests/integration/worker-tortila-snapshot.test.ts:60`-`88`. Current focused tests cover scoped create/delete, file download lookup, quarantined no-download, fail-closed route behavior, and one DB worker tick, but no cleanup predicate exists yet. Recommendation: required test write scope is `tests/integration/db-lms-ph3-1.test.ts` for active-vs-soft-deleted-vs-within-retention-vs-expired cleanup cases. If the worker is wired, add or extend a worker integration test to prove the tick purges only eligible rows and records aggregate health. Target part: regression coverage.

8. Severity: Low. Evidence: `apps/web/src/features/lms/actions.ts:345`-`403`, `apps/web/src/features/lms/material-download.ts:47`-`66`, `apps/web/src/app/api/education/materials/[materialId]/download/route.ts:9`-`16`, and `apps/web/src/app/teacher/materials/page.tsx:46`-`73`. The cleanup slice does not need LMS web action, query, teacher UI, or download route edits: deletion already soft-deletes through server action/RBAC, lists hide soft-deleted rows, and downloads fail closed on deleted/unavailable rows. Recommendation: keep `apps/web` out of the required write scope unless a future product decision adds an admin cleanup surface. Target part: write-scope containment.

## Decisions
- Recommended minimal write scope: `packages/db/src/repositories.ts` plus `tests/integration/db-lms-ph3-1.test.ts`.
- Recommended optional worker write scope: `apps/worker/src/index.ts`, `apps/worker/src/tick-once.ts`, and one focused worker integration test file.
- No schema or migration change is required for a hard-delete cleanup of already soft-deleted `db-local` file rows.
- Treat this as local DB-byte cleanup, not production object-storage cleanup.
- Keep cleanup output aggregate-only; storage keys and bytes remain internal and must not be logged or surfaced.

## Risks
- A predicate based only on `retained_until < now` would delete active materials that the UI still exposes as clean/downloadable.
- Hard-deleting non-`db-local` rows before object deletion would orphan future object-storage files.
- Returning deleted row metadata from the repository or worker can break the existing no-leak DTO/artifact boundary.
- Worker integration broadens the result shape and health payload; tests that assert the worker tick output/detail must be updated in the same slice.
- This was source inspection only; no runtime DB behavior was observed in this session.

## Verification/tests
RUN:
1. Read-only source and document inspection with `rg`, `Get-Content`, and targeted line-number excerpts.
2. Confirmed the target handoff file did not exist before writing it.

NOT RUN:
1. `npm test`, Vitest, typecheck, lint, build, `node scripts/gates.mjs`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, Playwright, and any server start - forbidden by this read-only agent scope.
2. `psql`, DB create/drop, migrations, seeds, live endpoints, external services, object storage, malware scanning, preview/prod services, SSH, tmux, systemd, deploy actions, and bot/exchange controls - forbidden by scope.

## Next actions
1. Add `purgeExpiredDeletedLmsFileMaterials(db, now, opts?)` in `packages/db/src/repositories.ts` with a bounded, `db-local`-only, soft-deleted-and-retention-expired predicate and aggregate return value.
2. Add focused PGlite coverage in `tests/integration/db-lms-ph3-1.test.ts` for purged eligible local file rows and kept active/within-retention/non-local rows.
3. If worker integration is approved, wire the repository function into `runDbWorkerTick()` after the existing cleanup passes, update `DbWorkerTickResult` and one-shot output, and add a worker test for aggregate health detail.
