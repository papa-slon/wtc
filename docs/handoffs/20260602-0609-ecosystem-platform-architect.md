# ecosystem-platform-architect handoff
## Scope
Plan a bounded Phase 3.36 LMS pending-upload cleanup dead-letter acknowledgement/retry workflow after Phase 3.35 shared object-store primitives. Read-only audit only; no product-code edits. Focus areas: `lms_object_cleanup_tasks`, admin system health, worker cleanup, material upload/storage orchestration, and route/action boundaries.
## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0506-phase-3-33-lms-durable-upload-cleanup.md`
- `docs/handoffs/20260602-0523-phase-3-34-lms-cleanup-dead-letter-ops.md`
- `docs/handoffs/20260602-0548-phase-3-35-lms-shared-object-storage-primitives.md`
## Files changed
- `docs/handoffs/20260602-0609-ecosystem-platform-architect.md`
## Findings
1. Severity: High. Evidence: `packages/db/src/schema.ts:306`-`packages/db/src/schema.ts:323` and `packages/db/migrations/0014_lazy_puff_adder.sql:1`-`packages/db/migrations/0014_lazy_puff_adder.sql:16` define private cleanup tasks with provider/key/reason/status/attempt/run-after/error/completed fields and a status CHECK limited to `pending`, `completed`, and `dead_letter`; there is no acknowledgement field or acknowledged status. Recommendation: Phase 3.36 can implement retry with existing fields, but durable acknowledgement needs an additive migration, preferably nullable `acknowledged_at`, `acknowledged_by`, and a closed-code `acknowledgement_code` while keeping `status='dead_letter'` for unresolved objects. Target part: DB schema and migration.
2. Severity: High. Evidence: the worker only lists `status='pending'` rows due at `packages/db/src/repositories.ts:942`-`packages/db/src/repositories.ts:961`, deletes via app-local fetch at `apps/worker/src/lms-object-cleanup.ts:96`-`apps/worker/src/lms-object-cleanup.ts:109`, and records failures from pending rows only at `packages/db/src/repositories.ts:902`-`packages/db/src/repositories.ts:923`. Recommendation: implement retry as a DB-only admin action that atomically changes selected dead-letter rows back to `pending`, sets `run_after=now`, updates `updated_at`, and leaves actual object DELETE to the worker; do not perform S3/R2 calls from the admin request. Target part: retry workflow boundary.
3. Severity: High. Evidence: the current admin surface is intentionally count-only, with summary DTO fields in `apps/web/src/features/admin/types.ts:56`-`apps/web/src/features/admin/types.ts:65`, DB projection mapping at `apps/web/src/features/admin/queries.ts:199`-`apps/web/src/features/admin/queries.ts:211`, and UI copy explicitly hiding task IDs/object keys at `apps/web/src/app/admin/system-health/page.tsx:103`-`apps/web/src/app/admin/system-health/page.tsx:109`. Recommendation: Phase 3.36 should expose only aggregate buttons such as "Retry dead-lettered cleanup" and "Acknowledge current dead letters"; no row browser, task selector, storage key, signed URL, filename, hash, scanner detail, or provider body. Target part: admin UI/query boundary.
4. Severity: Medium. Evidence: admin mutation convention is `requireUser -> assertAdmin -> assertCsrf -> Zod -> repo -> revalidatePath` in `apps/web/src/features/admin/actions.ts:1`-`apps/web/src/features/admin/actions.ts:18`, while no cleanup action/schema exists (`rg` finds cleanup only in system-health query/page, not admin actions or schemas). Recommendation: add closed Zod schemas in `apps/web/src/features/admin/schemas.ts` and server actions in `apps/web/src/features/admin/actions.ts`; in demo/no-DB mode actions should fail closed or no-op with no fake success. Target part: admin action pipeline.
5. Severity: Medium. Evidence: pending cleanup rows are created before clean object PUT at `apps/web/src/features/lms/actions.ts:141`-`apps/web/src/features/lms/actions.ts:148`, shared PUT preserves app-local fetch/error handling at `apps/web/src/features/lms/material-storage.ts:172`-`apps/web/src/features/lms/material-storage.ts:187`, and successful material creation completes the cleanup task transactionally via `apps/web/src/features/lms/actions.ts:405`-`apps/web/src/features/lms/actions.ts:417`. Recommendation: do not change upload/material orchestration in this phase; scope the workflow to dead-letter task state and admin operations only. Target part: phase scope control.
6. Severity: Medium. Evidence: dead-letter creation already writes summary-only `education.material_cleanup` audit with counts/provider/scope/error at `packages/db/src/repositories.ts:924`-`packages/db/src/repositories.ts:937`, and the audit schema forbids cleanup task IDs, material IDs, filenames, hashes, bytes, storage keys, signed URLs, request headers, scanner details, provider responses, and quarantine details for that action at `docs/AUDIT_LOG_SCHEMA.md:222`. Recommendation: new retry/ack repository functions must write in-transaction summary-only audit rows with actor role `admin`, counts, storage provider, scope, operation, and generic reason/code only. Target part: audit contract.
7. Severity: Medium. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:120`-`docs/ACCEPTANCE_MATRIX_MASTER.md:127` leaves dead-letter acknowledgement/retry outside the durable cleanup boundary, and `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` still lists dead-letter acknowledgement/retry, live S3/R2 acceptance, live scanner acceptance, DB-backed browser acceptance, and public rollout as open. Recommendation: stop Phase 3.36 at local ack/retry semantics plus tests; do not include live S3/R2, live scanner, DB browser, or public upload rollout. Target part: stop conditions.
## Decisions
- Keep `lms_object_cleanup_tasks` private; admin surfaces remain count-only.
- Use existing status fields for manual retry from `dead_letter` to `pending`; this part does not require a migration.
- Use an additive migration for durable acknowledgement rather than overloading `completed` or audit-only acknowledgement.
- Keep object DELETE execution in the worker path; admin retry only changes task scheduling state.
- Keep the Phase 3.36 UI inside `/admin/system-health`; no new admin route or row-level browser.
## Risks
- Ack without new persisted fields would be misleading because the same dead-letter rows would reappear as unacknowledged after reload.
- Resetting attempts on retry could hide repeated provider failures; preserving attempts gives a bounded one-shot manual retry unless a later policy explicitly extends max attempts.
- Any per-row admin view or selector risks leaking private `storage_key`; aggregate operations are safer for this phase.
- Direct object DELETE from an admin action would duplicate worker fetch/error semantics and widen live mutation risk.
## Verification/tests
- Add repository tests for `retryLmsObjectCleanupDeadLetters()` and `acknowledgeLmsObjectCleanupDeadLetters()` covering status transitions, counts, idempotency, audit payload shape, and no key/task-id projection.
- Add admin action/schema tests proving CSRF/admin/Zod gating and demo/no-DB fail-closed behavior.
- Extend `admin-lms-cleanup-review`/static guards so admin UI and summaries still reject cleanup task IDs, storage keys, signed URLs, filenames, hashes, scanner details, and provider bodies.
- Run focused Vitest for cleanup/admin tests, then root typecheck, web typecheck, lint, `npm run db:generate -w @wtc/db`, `npm run secret:scan`, `npm run governance:check`, and the standard full/e2e gates if the phase edits UI.
## Next actions
1. Create a narrow Phase 3.36 implementation session with DB architect, backend implementer, security auditor, frontend implementer, tests runner, and devops read-only agents launched before edits.
2. Add the acknowledgement migration and schema types; do not alter `completed` semantics.
3. Add DB repository functions for aggregate retry and acknowledgement with in-transaction summary-only audit rows.
4. Add admin schemas/actions and count-only `/admin/system-health` controls.
5. Update acceptance/docs to define the local ack/retry boundary and explicitly keep live S3/R2, scanner, DB-browser, and public rollout NOT RUN.
