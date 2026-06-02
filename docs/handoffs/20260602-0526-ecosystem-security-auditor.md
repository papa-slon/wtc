# ecosystem-security-auditor handoff
## Scope
Phase 3.34 read-only security audit for a future admin dead-letter operational review/alerting surface for LMS pending upload cleanup tasks. Scope covered no-leak and fail-closed requirements across audit payloads, admin routes/projections, external scanner boundaries, worker logs/health, and tests. No product code edits.

## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/guard.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `package.json`
- `scripts/gates.mjs`

## Files changed
None - read-only audit. This handoff artifact records the audit result.

## Findings
1. Severity: High. Evidence: the worker writes pending cleanup counters into health detail at `apps/worker/src/index.ts:139`, `apps/worker/src/index.ts:140`, `apps/worker/src/index.ts:141`, `apps/worker/src/index.ts:142`, `apps/worker/src/index.ts:143`, and `apps/worker/src/index.ts:144`, but the admin health projection allowlist at `apps/web/src/features/admin/health-detail.ts:3`-`apps/web/src/features/admin/health-detail.ts:24` does not include those keys, and unknown keys are dropped at `apps/web/src/features/admin/health-detail.ts:54`-`apps/web/src/features/admin/health-detail.ts:60`. The admin health page then renders only the projected detail at `apps/web/src/app/admin/system-health/page.tsx:209`-`apps/web/src/app/admin/system-health/page.tsx:210`. Recommendation: Phase 3.34 should add a safe admin projection for pending cleanup dead letters and/or allowlist only the count fields `lmsPendingObjectCleanupScanned`, `lmsPendingObjectDeleteAttempted`, `lmsPendingObjectDeleteConfirmed`, `lmsPendingObjectCleanupCompleted`, `lmsPendingObjectCleanupFailed`, and `lmsPendingObjectCleanupDeadLettered`; the page must show an error/review-required state when dead-lettered count is greater than zero. Target part: admin system health / dead-letter review visibility.

2. Severity: High. Evidence: `lms_object_cleanup_tasks` stores private operational fields including `id`, `storage_key`, `reason`, `status`, retry counters, `run_after`, `last_error_code`, and timestamps at `packages/db/src/schema.ts:302`-`packages/db/src/schema.ts:317`. The worker candidate selector returns `cleanupTaskId` and `storageKey` at `packages/db/src/repositories.ts:914`-`packages/db/src/repositories.ts:924`, and the worker uses the key for signed DELETE at `apps/worker/src/lms-object-cleanup.ts:196`-`apps/worker/src/lms-object-cleanup.ts:205`. Recommendation: do not render raw cleanup-task rows in admin UI. Add a dedicated admin DTO/query that exposes only aggregate counts and coarse timestamps/age buckets; if individual review rows are required, expose a server-generated opaque review handle only, not `id` or `storage_key`. Target part: admin dead-letter repository/query boundary.

3. Severity: High. Evidence: object storage signing material exists in web upload/delete/read helpers at `apps/web/src/features/lms/material-storage.ts:269`-`apps/web/src/features/lms/material-storage.ts:301`, `apps/web/src/features/lms/material-storage.ts:304`-`apps/web/src/features/lms/material-storage.ts:333`, and `apps/web/src/features/lms/material-storage.ts:389`-`apps/web/src/features/lms/material-storage.ts:424`; worker DELETE signing also builds an Authorization header at `apps/worker/src/lms-object-cleanup.ts:95`-`apps/worker/src/lms-object-cleanup.ts:127`. The artifact scanner already forbids signed URL/auth evidence at `scripts/scan-lms-db-e2e-artifacts.mjs:27`-`scripts/scan-lms-db-e2e-artifacts.mjs:30` and `scripts/scan-lms-db-e2e-artifacts.mjs:47`-`scripts/scan-lms-db-e2e-artifacts.mjs:52`. Recommendation: the admin surface must never expose signed URLs, Authorization headers, X-Amz query/header values, bucket/object paths, access key ids, scanner endpoint/token values, or provider response bodies. Target part: no-leak rendering and generated artifact policy.

4. Severity: Medium. Evidence: dead-letter creation is fail-closed at the worker status level because `workerHealthStatus` becomes `error` when pending cleanup failures or dead letters are present at `apps/worker/src/index.ts:124`, and logs remain count-only at `apps/worker/src/index.ts:149` plus `apps/worker/src/tick-once.ts:23`-`apps/worker/src/tick-once.ts:24`. Tests assert the worker result/health counters and dead-letter state at `tests/integration/worker-tortila-snapshot.test.ts:303`-`tests/integration/worker-tortila-snapshot.test.ts:329`, and assert no task ids, object key fragments, or object-store secret in health detail at `tests/integration/worker-tortila-snapshot.test.ts:330`-`tests/integration/worker-tortila-snapshot.test.ts:337`. Recommendation: keep the admin alert tied to worker health `error` and the specific count-only dead-letter metric; do not add per-key logs to make debugging easier. Target part: worker health to admin alert mapping.

5. Severity: Medium. Evidence: audit action coverage includes `education.material_cleanup` at `packages/audit/src/audit.ts:91`-`packages/audit/src/audit.ts:94`, and the cleanup task completion audit writes only count/provider/scope/confirmation fields at `packages/db/src/repositories.ts:865`-`packages/db/src/repositories.ts:878`. The audit schema explicitly forbids cleanup task IDs, material IDs, filenames, hashes, bytes, storage keys, signed URLs, request headers, scanner details, provider responses, and quarantine details for `education.material_cleanup` at `docs/AUDIT_LOG_SCHEMA.md:220`-`docs/AUDIT_LOG_SCHEMA.md:223`. Recommendation: if Phase 3.34 adds acknowledgement, requeue, or dismiss actions, audit with `admin.action` or a new typed admin action using summary-only payloads: counts, action name, status transition class, and actor only. Target part: admin review audit contract.

6. Severity: Medium. Evidence: scanner config is fail-closed: external mode requires HTTPS endpoint and token at `apps/web/src/features/lms/material-storage.ts:114`-`apps/web/src/features/lms/material-storage.ts:127`, bounded timeout is enforced at `apps/web/src/features/lms/material-storage.ts:130`-`apps/web/src/features/lms/material-storage.ts:135`, scanner network/parse failures collapse to generic `lms_file_scan_failed` at `apps/web/src/features/lms/material-storage.ts:154`-`apps/web/src/features/lms/material-storage.ts:187`, and clean `s3-r2` object PUT is reached only after scan and the durable registration hook at `apps/web/src/features/lms/material-storage.ts:427`-`apps/web/src/features/lms/material-storage.ts:459`. Recommendation: dead-letter review must not expose scanner endpoint, scanner token, scanner body, quarantine reason, or raw scanner error; the surface should show only cleanup queue health and generic failure class. Target part: scanner-to-admin data minimization.

7. Severity: Medium. Evidence: admin layout gates all admin routes with `getCurrentUser()`, login redirect, and `isAdmin()` redirect at `apps/web/src/app/admin/layout.tsx:12`-`apps/web/src/app/admin/layout.tsx:16`; admin pages repeat `requireUser()` and `assertAdmin()` at `apps/web/src/app/admin/system-health/page.tsx:8`-`apps/web/src/app/admin/system-health/page.tsx:10` and `apps/web/src/app/admin/audit-log/page.tsx:6`-`apps/web/src/app/admin/audit-log/page.tsx:8`. The admin query module states callers own the admin gate at `apps/web/src/features/admin/queries.ts:1`-`apps/web/src/features/admin/queries.ts:10`. Recommendation: any new `/admin/...` dead-letter page must keep both layout and page-level `requireUser()`/`assertAdmin()` gates; any server action must use `requireUser() -> assertAdmin() -> assertCsrf() -> schema validation -> repository action -> audit/revalidate`, matching the existing admin action convention at `apps/web/src/features/admin/actions.ts:4`. Target part: admin RBAC and mutation pipeline.

8. Severity: Medium. Evidence: the migration test asserts the task table has only private retry fields and lacks file/user/scanner payload columns at `tests/integration/lms-object-cleanup-tasks.test.ts:42`-`tests/integration/lms-object-cleanup-tasks.test.ts:65`; retry/dead-letter tests assert raw provider errors are sanitized to `delete_failed` at `tests/integration/lms-object-cleanup-tasks.test.ts:104`-`tests/integration/lms-object-cleanup-tasks.test.ts:123`; cleanup audit tests assert no task id, storage key, Authorization, or X-Amz at `tests/integration/lms-object-cleanup-tasks.test.ts:125`-`tests/integration/lms-object-cleanup-tasks.test.ts:151`. Recommendation: Phase 3.34 must add equivalent admin projection tests, because current tests prove internal worker/audit behavior but not future admin UI serialization. Target part: test coverage.

9. Severity: Medium. Evidence: the artifact scanner forbids LMS storage key field names, the internal `lms/materials/` path, file metadata fields, storage provider values, hash header, signed object URL tokens, scanner endpoint/token assignments, cookies, Authorization headers, bearer/basic tokens, and password hashes at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:54`. It has a specific pending upload cleanup negative fixture at `tests/integration/lms-db-e2e-artifact-scan.test.ts:88`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:97`. Recommendation: keep the scanner in the required gates after implementing the admin surface, and add a positive fixture proving safe admin dead-letter output passes plus a negative fixture for any new forbidden label/value introduced by the UI. Target part: artifact no-leak gate.

## Decisions
- The dead-letter operational review surface must be admin-only, read-only by default, and fail closed to "review required" when any pending cleanup task is dead-lettered or when worker health is stale/error.
- The surface must use a purpose-built safe projection, not direct `lms_object_cleanup_tasks` rows.
- Allowed fields for first implementation: status class, counts by `pending`/`dead_letter`, count of failed attempts, oldest due age bucket, newest update timestamp, worker latest tick timestamp, and generic reason label `pending upload object cleanup`.
- Forbidden fields for any admin DTO, page, audit row, console log, health detail, test artifact, screenshot, or exported report: cleanup task id, material id, storage key, `lms/materials/` path, bucket name/path, object URL, signed URL, `Authorization`, `Cookie`, `Set-Cookie`, `Bearer`, `Basic`, `X-Amz-*`, `AWSAccessKeyId`, access key id, secret access key, scanner endpoint, scanner token, scanner body, scanner response, provider response body, file name, MIME type, file bytes/base64, content hash, quarantine reason/detail, raw `last_error_code`, stack trace, and raw DB row JSON.
- If an operator action is added later, permitted audit payload is summary-only: action class, counts affected, previous aggregate status, next aggregate status, and actor; no row ids or object data.

## Risks
- There is no current admin dead-letter page or DTO; Phase 3.34 still needs implementation after this audit.
- Current `projectHealthDetail()` drops the new pending-cleanup counters, so the existing system-health page is not enough for operational review visibility.
- Direct Drizzle reads from `schema.lmsObjectCleanupTasks` in admin code would be a high-risk leak because the table necessarily stores `storage_key`.
- Web and worker still duplicate object-store SigV4 primitives, increasing the chance future admin/debug logging accidentally diverges or exposes signed material.
- Live S3/R2, live scanner, DB-backed browser acceptance, alert delivery, and public rollout remain outside this read-only audit.

## Verification/tests
No tests were run in this read-only audit; inspection only.

Required gates for Phase 3.34 implementation:
- `npm test -- tests/integration/admin-health-detail.test.ts tests/integration/admin-ops-rbac.test.ts tests/integration/admin-responsive.test.ts tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts`
- Add and run a new targeted admin dead-letter projection test that seeds `lms_object_cleanup_tasks` with storage keys/task ids/provider-error bait and asserts the admin DTO/page output omits all forbidden fields.
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run secret:scan`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`
- `node scripts/scan-lms-db-e2e-artifacts.mjs`
- `npm run governance:check`
- `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` only when a fresh throwaway/admin DB URL is available; default e2e is not a substitute for DB-backed LMS browser acceptance.

## Next actions
1. Implement a safe admin projection for LMS pending-upload cleanup dead letters, preferably in `apps/web/src/features/admin/queries.ts` plus an explicit DTO in `apps/web/src/features/admin/types.ts`.
2. Add the new counters to `projectHealthDetail()` only as count-only keys, or surface them through a narrower dead-letter-specific query.
3. Add an admin page/card that renders counts and review-required state only; do not render task ids, storage keys, retry row JSON, signed URL details, or raw errors.
4. Add projection/UI tests with leak bait and update artifact scanner tests for any new admin output.
5. Run the required gates above and record exact RUN/NOT RUN status in the aggregate Phase 3.34 handoff.
