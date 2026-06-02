# ecosystem-security-auditor handoff
## Scope
Phase 3.24 read-only security audit of the proposed/current LMS material cleanup boundary before acceptance. Focus: no plaintext secrets, audit payloads, byte/hash/storage-key leak avoidance, fail-closed download behavior after cleanup, and whether cleanup should hard-delete bytes vs rows.

No servers, Playwright, DB commands, migrations/seeds, live endpoints, external services, or gates were run.

## Files inspected
- `AGENTS.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/lms/src/materials.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/audit/src/redact.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `packages/db/src/repositories.ts:769`-`packages/db/src/repositories.ts:771` says this is cleanup for DB-local LMS file payloads, but the delete predicate at `packages/db/src/repositories.ts:773`-`packages/db/src/repositories.ts:786` filters only `kind = file`, `retained_until <= now`, and deleted/unsafe state; it does not constrain `storage_provider` or `storage_key`. The schema explicitly has `storageProvider` and `storageKey` columns at `packages/db/src/schema.ts:261`-`packages/db/src/schema.ts:262`, while deployment docs say production object storage is not implemented yet at `docs/DEPLOYMENT.md:46`-`docs/DEPLOYMENT.md:49`. Recommendation: scope the cleanup predicate to `storageProvider = 'db-local'` and, if practical, a local storage-key prefix allowlist before hard-deleting rows. Future object-storage rows need a separate delete-object-then-tombstone flow, not this DB-local purge. Target part: `purgeExpiredLmsMaterialFiles`.

2. Severity: High. Evidence: the cleanup performs a hard delete at `packages/db/src/repositories.ts:773`-`packages/db/src/repositories.ts:786` and the worker records only integration health/count metadata at `apps/worker/src/index.ts:107`-`apps/worker/src/index.ts:115`; `recordHealthCheck()` writes `integration_health_checks`, not `audit_logs`, at `packages/db/src/repositories.ts:910`-`packages/db/src/repositories.ts:911`. Existing audit action coverage includes material upload/download/delete and system worker/health actions at `packages/audit/src/audit.ts:91`-`packages/audit/src/audit.ts:93` and `packages/audit/src/audit.ts:124`-`packages/audit/src/audit.ts:126`, but no cleanup-specific material purge event. Recommendation: add a summary-only audit event for cleanup, e.g. `system.lms_material_cleanup` or `education.material_cleanup`, with only count, cutoff timestamp, storage provider, and coarse eligible states. Do not include material ids, filenames, raw bytes/base64, content hashes, storage keys, quarantine reason, or storage-key presence booleans. Target part: cleanup audit accountability and payload shape.

3. Severity: Medium. Evidence: the current schema requires file rows to retain `content_sha256`, `file_bytes_base64`, `storage_provider`, `storage_key`, and `retained_until` at `packages/db/src/schema.ts:256`-`packages/db/src/schema.ts:267`, and the file payload/lifecycle checks require those fields for file rows at `packages/db/src/schema.ts:280` and `packages/db/src/schema.ts:290`. The current cleanup comment recognizes this and hard-deletes eligible rows because the schema cannot keep a file row without bytes/checksum metadata at `packages/db/src/repositories.ts:769`-`packages/db/src/repositories.ts:771`. Recommendation: for the current DB-local build, hard-delete the entire eligible row rather than trying to null only bytes/hash/storage keys in violation of checks. If business history must survive physical byte purge, add a migration for a tombstone state or separate minimal tombstone table first. Target part: hard-delete bytes vs rows decision.

4. Severity: Medium. Evidence: material upload and download audit payload builders do not include raw bytes or raw `storageKey`, but they do pass `contentSha256` into the audit input at `packages/db/src/repositories.ts:711`-`packages/db/src/repositories.ts:724` and `packages/db/src/repositories.ts:854`-`packages/db/src/repositories.ts:872`. `auditRowValues()` routes payloads through `buildEvent()` at `packages/db/src/repositories.ts:225`-`packages/db/src/repositories.ts:240`, and `buildEvent()` redacts before/after values at `packages/audit/src/audit.ts:177`-`packages/audit/src/audit.ts:178`; the redactor treats 64+ hex strings as secret-like at `packages/audit/src/redact.ts:52`-`packages/audit/src/redact.ts:61`. Recommendation: do not rely on generic redaction for cleanup payloads. Keep cleanup audit/log/health output count-only and add explicit tests that cleanup output never contains `fileBytesBase64`, `storageKey`, `storage_key`, `lms/materials/`, exact SHA-256 values, `contentSha256`, `hasStorageKey`, or file body markers. Target part: audit redaction and cleanup evidence hygiene.

5. Severity: Medium. Evidence: download lookup is fail-closed before streaming because it requires file kind, `scanStatus = clean`, `deletedAt IS NULL`, published lesson/course, non-null bytes/storage fields, and hash-valid bytes at `packages/db/src/repositories.ts:808`-`packages/db/src/repositories.ts:834`; the route returns `404` and skips audit when no row is returned at `apps/web/src/features/lms/material-download.ts:62`-`apps/web/src/features/lms/material-download.ts:65`. Current cleanup tests assert row deletion for expired soft-deleted/unsafe rows at `tests/integration/db-lms-ph3-1.test.ts:145`-`tests/integration/db-lms-ph3-1.test.ts:152`, and pre-cleanup quarantine denial is covered at `tests/integration/lms-material-download-handler.test.ts:168`-`tests/integration/lms-material-download-handler.test.ts:181`. Recommendation: add explicit post-cleanup assertions that `listMaterials()` and `getMaterialFileForPublishedLesson()` cannot return purged rows, and that download attempts after cleanup return JSON failure with no `x-lms-sha256`, no `content-disposition`, no clean-file `content-length`, no raw body/base64, no hash, and no storage-key markers. Target part: post-cleanup fail-closed test boundary.

6. Severity: Low. Evidence: the worker currently emits only purge counts in health/log surfaces at `apps/worker/src/index.ts:107`-`apps/worker/src/index.ts:119` and `apps/worker/src/tick-once.ts:22`-`apps/worker/src/tick-once.ts:25`, which is the right no-leak shape. The artifact scanner forbids LMS byte/storage/hash/auth markers at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:45` and fails closed on unscanned binary/container artifacts at `scripts/scan-lms-db-e2e-artifacts.mjs:94`-`scripts/scan-lms-db-e2e-artifacts.mjs:108`, but it skips image bytes at `scripts/scan-lms-db-e2e-artifacts.mjs:101`-`scripts/scan-lms-db-e2e-artifacts.mjs:104`. Recommendation: keep worker cleanup output count-only; archive no HAR/trace/container artifacts; visually review or discard screenshots after any cleanup-related browser run. Target part: operational evidence handling.

## Decisions
- Treat the current working-tree `purgeExpiredLmsMaterialFiles()` implementation as the proposed cleanup boundary under audit.
- Current schema supports hard-deleting eligible DB-local file rows; byte-only purge while preserving the same `materials` row is not safe without a schema change.
- Cleanup logs and worker health should remain count-only.
- Cleanup audit, if added, must be summary-only and must not include row ids, names, raw bytes/base64, hashes, storage keys, storage-key presence booleans, or quarantine details.

## Risks
- The cleanup implementation is already present in the inspected tree even though this audit scope was framed as "before implementation"; this handoff audits the current proposed implementation and flags required hardening before acceptance.
- Without a `storageProvider = 'db-local'` predicate, future object-storage rows could be hard-deleted before their object bytes are deleted, losing the storage key needed for cleanup reconciliation.
- Without an audit event, hard-deleted LMS material rows have only worker health/count observability, not append-only audit accountability.
- No live DB/browser behavior was observed in this lane.

## Verification/tests
- RUN: read-only file and text inspection with `rg`, `Get-Content`, and `Select-String`.
- NOT RUN: servers, Playwright, DB commands, migrations/seeds, live endpoints, external services, or gates, per scope.
- NOT RUN: `npm test`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, `node scripts/gates.mjs`, or scanner execution.

## Next actions
1. Add `storageProvider = 'db-local'` and, if possible, `storageKey` prefix scoping to `purgeExpiredLmsMaterialFiles()`.
2. Add a cleanup summary audit action/payload with count-only fields and explicit no-leak tests.
3. Extend cleanup tests to assert post-cleanup `listMaterials()`, `getMaterialFileForPublishedLesson()`, and download-handler failure behavior.
4. If product needs row history after byte purge, add a schema-level tombstone design before attempting byte/hash/storage-key nulling.
