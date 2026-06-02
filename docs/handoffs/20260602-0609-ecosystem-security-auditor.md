# ecosystem-security-auditor handoff
## Scope
Read-only security/RBAC/audit/no-leak audit for an admin-only LMS cleanup dead-letter acknowledgement/retry workflow in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`. Scope included admin route/action patterns, audit payload rendering, health DTO allowlists, `lms_object_cleanup_tasks` fields, and scanner/artifact deny rules. No product code was edited.

## Files inspected
- `apps/web/src/features/admin/actions.ts` lines 1-253
- `apps/web/src/app/admin/system-health/page.tsx` lines 1-130
- `apps/web/src/app/admin/audit-log/page.tsx` lines 1-44
- `apps/web/src/features/admin/queries.ts` lines 135-231
- `apps/web/src/features/admin/health-detail.ts` lines 1-74
- `apps/web/src/features/admin/types.ts` lines 46-80
- `apps/web/src/lib/backend.ts` lines 91-112
- `packages/db/src/schema.ts` lines 302-323
- `packages/db/src/repositories.ts` lines 781-1037
- `packages/audit/src/audit.ts` action list by search
- `packages/audit/src/redact.ts` lines 1-79
- `docs/AUDIT_LOG_SCHEMA.md` lines 16-18, 220-222, 263-311
- `docs/ACCEPTANCE_MATRIX_MASTER.md` lines 121-140
- `scripts/scan-lms-db-e2e-artifacts.mjs` lines 12-45
- `tests/integration/admin-health-detail.test.ts` lines 1-45
- `tests/integration/admin-lms-cleanup-review.test.ts` lines 1-40
- `tests/integration/lms-object-cleanup-tasks.test.ts` lines 91-210
- `tests/integration/worker-tortila-snapshot.test.ts` lines 301-353

## Files changed
None - read-only audit

## Findings
1. HIGH - Raw cleanup task IDs must not be exposed to the admin client; use opaque aggregate actions instead.
   Evidence: `packages/db/src/schema.ts:302` defines private `lms_object_cleanup_tasks`; `packages/db/src/schema.ts:307` stores `storage_key` on the same row; `packages/db/src/repositories.ts:784-788` models worker candidates with both `cleanupTaskId` and `storageKey`; `apps/web/src/app/admin/system-health/page.tsx:103-106` explicitly states the admin surface hides cleanup task IDs and object keys. The current boundary is intentional, not incidental.
   Recommendation: The admin UI must post only an operation intent, CSRF token, and short reason, such as `acknowledge_dead_letters` or `retry_dead_letters`. The server must select eligible rows internally by fixed scope: `storageProvider='s3-r2'`, `reason='material_create_pending'`, `status='dead_letter'`, bounded batch size, and optional server-side time cutoff. Do not render or accept `cleanupTaskId`, `storageKey`, object path fragments, signed URL tokens, filenames, hashes, provider responses, or scanner detail in forms, URLs, JSON, hidden inputs, health DTOs, audit payloads, or generated artifacts.
   Target part: admin LMS cleanup action/page contract, `@wtc/db` cleanup repositories, tests.

2. HIGH - Audit target IDs and payloads must remain aggregate/null; a per-row target would leak task identity through the audit log.
   Evidence: `apps/web/src/lib/backend.ts:91-99` exposes `targetId` in the admin audit DTO; `apps/web/src/app/admin/audit-log/page.tsx:32-33` renders action and a truncated target ID; current cleanup audit rows set `targetId: null` and summary payload only at `packages/db/src/repositories.ts:879-891` and `packages/db/src/repositories.ts:925-937`; `docs/AUDIT_LOG_SCHEMA.md:222` forbids cleanup task IDs, material IDs, storage keys, provider responses, and scanner details in `education.material_cleanup`.
   Recommendation: Add specific admin audit codes before implementation, for example `education.material_cleanup_ack` and `education.material_cleanup_retry` or `admin.lms_cleanup_ack` and `admin.lms_cleanup_retry`. Write the audit row in the same DB transaction as the ack/retry mutation. Use `targetType='lms_object_cleanup_tasks'` with `targetId=null` or a non-row aggregate target such as `pending_upload_object_cleanup`; payload may include counts, provider, reason, scope, oldest/latest timestamps, and the admin's bounded reason. It must not include row IDs, key values, file metadata, signed request data, raw error text, or selected row arrays.
   Target part: `packages/audit/src/audit.ts`, `packages/db/src/repositories.ts`, admin audit rendering expectations.

3. HIGH - The existing `completed` transition must not be reused for admin acknowledgement.
   Evidence: `packages/db/src/schema.ts:309-316` has only `pending`, `completed`, and `dead_letter` status plus completion timestamps; `packages/db/src/repositories.ts:869-891` marks tasks `completed` only after confirmed cleanup and records `objectDeleteConfirmed: true`; `tests/integration/lms-object-cleanup-tasks.test.ts:150-167` asserts that completed cleanup audit means confirmed cleanup, not acknowledgement.
   Recommendation: Acknowledgement needs separate state from successful object cleanup. Prefer nullable `acknowledged_at` and `acknowledged_by` columns while keeping `status='dead_letter'`, or a separate `dead_letter_acknowledged` status if the model needs status-only filtering. The health summary should count unacknowledged dead letters separately. Never mark an object cleanup task `completed` unless the worker confirmed DELETE 2xx/404 or equivalent absence.
   Target part: `packages/db/src/schema.ts`, cleanup summary repository, admin health DTO.

4. MEDIUM - Admin ack/retry actions must follow the existing fail-closed mutation pipeline and should not perform object deletion directly.
   Evidence: `apps/web/src/features/admin/actions.ts:1-8` documents the required pipeline; current admin actions call `requireUser`, `assertAdmin`, `assertCsrf`, Zod parsing, repository mutation, and `revalidatePath` at `apps/web/src/features/admin/actions.ts:27-57`, `apps/web/src/features/admin/actions.ts:66-92`, and `apps/web/src/features/admin/actions.ts:168-252`. The object cleanup worker path records count-only health and audit data at `tests/integration/worker-tortila-snapshot.test.ts:301-353`.
   Recommendation: Implement ack/retry as server actions with `requireUser -> assertAdmin -> assertCsrf -> Zod`. Require an admin reason with length bounds. Fail closed when no DB is configured in production-like environments. The action should mutate retry/ack state only; external object DELETE remains worker-owned. Revalidate `/admin/system-health` and any admin audit page after success.
   Target part: `apps/web/src/features/admin/actions.ts`, `apps/web/src/app/admin/system-health/page.tsx`, worker/repository boundary.

5. MEDIUM - Retry must be concurrency-safe and bounded because worker-facing primitives expose row IDs internally.
   Evidence: `packages/db/src/repositories.ts:942-980` selects pending cleanup candidates with `cleanupTaskId` and `storageKey` for the worker; `packages/db/src/repositories.ts:902-923` updates a pending task by ID after failures; `packages/db/src/repositories.ts:982-1037` shows the admin summary can be computed without selecting IDs or keys.
   Recommendation: Add dedicated aggregate repo functions rather than reusing ID-taking primitives from a server action. Functions should run in a transaction, select rows server-side under fixed provider/reason/status filters, cap affected rows, and be idempotent. If Postgres locking is available, use row-level locking or an equivalent compare-and-update predicate so concurrent admins/workers cannot double-ack, double-retry, or convert a worker-updated row.
   Target part: `packages/db/src/repositories.ts` new aggregate functions and integration tests.

6. MEDIUM - Artifact scanning does not currently deny cleanup task ID field names.
   Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:12-30` denies storage keys, internal storage paths, file metadata, signed object URL tokens, and related LMS fields, but it does not include `cleanupTaskId` or `cleanup_task_id`. Source tests already forbid those names in the admin review surface at `tests/integration/admin-lms-cleanup-review.test.ts:19-22` and health detail tests reject `cleanupTaskId` at `tests/integration/admin-health-detail.test.ts:18-44`.
   Recommendation: When implementing the workflow, extend artifact scanning to reject `cleanupTaskId` and `cleanup_task_id` in text artifacts. Add focused tests that intentionally put these markers into a generated text artifact fixture or scanner fixture and expect the scanner to fail.
   Target part: `scripts/scan-lms-db-e2e-artifacts.mjs`, scanner tests.

7. LOW - Existing health/audit redaction is strong enough for summary-only fields but must not be treated as permission to pass raw cleanup data.
   Evidence: `apps/web/src/features/admin/health-detail.ts:3-37` allowlists worker detail fields; `apps/web/src/features/admin/health-detail.ts:63-74` redacts and drops unknown keys; `tests/integration/admin-health-detail.test.ts:16-44` proves bearer tokens, storage keys, and cleanup task IDs are removed; `packages/audit/src/redact.ts:12-36` and `packages/audit/src/redact.ts:68-78` redact secret-looking keys and values. These are defense-in-depth controls, not primary access control.
   Recommendation: Keep DTO/source allowlists and redaction tests, but design ack/retry payloads so there is no raw task/object data to redact in the first place.
   Target part: health DTO tests, audit payload tests, admin action tests.

## Decisions
- Exposing raw `lms_object_cleanup_tasks.id` to admin clients is not acceptable for this workflow.
- Admin ack/retry must be opaque aggregate operations selected server-side by fixed provider/reason/status filters.
- Cleanup acknowledgement must be distinct from successful cleanup completion.
- Audit rows for ack/retry must be specific, in-transaction, and summary-only.
- The server action should schedule/reclassify cleanup work; external object deletion remains in the worker.

## Risks
- Without new acknowledgement state, implementers may incorrectly repurpose `completed`, making unconfirmed object cleanup look confirmed.
- Without aggregate server-side selection, a hidden-input or URL-based task ID creates an IDOR-style mutation surface and an audit-log leak.
- Without scanner updates, generated artifacts could leak `cleanupTaskId` even though current source guards catch it.
- Concurrent admin retry and worker retry could race unless the repository transition is transactional and predicate-guarded.
- Retrying dead letters before live object-store acceptance may create more dead letters; the UI should present retry as operational scheduling, not as proof of live S3/R2 readiness.

## Verification/tests
Read-only audit only. No product code was edited and no test suite was run.

Recommended gates for implementation:
- Focused repo/action tests for aggregate ack and retry: admin success, non-admin denied, CSRF denied, invalid reason denied, no DB/prod fail-closed, idempotent second submit.
- Audit assertions: new action code present, actor is admin, row written in the same transaction as state change, `targetId` is null or aggregate, payload contains only counts/scope/provider/reason/timestamps and no row IDs or object locators.
- Source/static guard: admin action/page/query code must not contain `cleanupTaskId`, `cleanup_task_id`, `storageKey`, `storage_key`, `X-Amz`, `Authorization`, `fileName`, or `contentSha256`.
- Scanner guard: generated artifact scanner rejects `cleanupTaskId` and `cleanup_task_id`.
- Standard gates after implementation: focused Vitest, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run secret:scan`, `npm run governance:check`, and the existing LMS artifact scanner.

## Next actions
1. Ask `ecosystem-db-architect` to design the acknowledgement state and aggregate transition functions without client-supplied task IDs.
2. Ask `ecosystem-backend-implementer` to add admin server actions following `requireUser -> assertAdmin -> assertCsrf -> Zod -> repo -> revalidatePath`.
3. Ask `ecosystem-frontend-implementer` to add count-only buttons/status to `/admin/system-health`; no per-row list, hidden task IDs, object keys, filenames, or provider errors.
4. Ask `ecosystem-tests-runner` to add source, integration, audit, scanner, and RBAC tests before public upload rollout claims.
5. Keep live S3/R2 acceptance, live scanner acceptance, DB browser acceptance, and public upload rollout out of scope for this workflow.
