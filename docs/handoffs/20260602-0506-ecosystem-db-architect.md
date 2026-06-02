# ecosystem-db-architect handoff
## Scope
Read-only DB architecture audit for Phase 3.33 durable DB state for LMS object-upload compensation retry.
## Files inspected
- `docs/handoffs/20260602-0429-phase-3-32-lms-upload-compensation.md`
- `docs/handoffs/20260602-0406-phase-3-31-lms-object-cleanup-reconciliation.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0013_young_martin_li.sql`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `docs/DATA_MODEL.md`
## Files changed
None - read-only audit.
## Findings
1. High - Phase 3.32 has no durable retry state when PUT succeeds, material creation fails, and DELETE fails. Recommendation: add durable pending cleanup state before or immediately around object PUT, then mark complete after material insert or successful compensation delete. Target part: DB model and repository.
2. High - Reusing `materials` is the wrong shape for pre-material orphan cleanup because file rows require lesson/material metadata. Recommendation: use a purpose-built private cleanup/outbox table. Target part: schema.
3. Medium - Current `job_queue` is reserved and unconsumed. Recommendation: prefer a narrow `lms_object_cleanup_tasks` table unless the phase promotes `job_queue` into a real consumed queue. Target part: durable retry table.
4. Medium - Safe fields are limited to provider, opaque key, reason/status, attempts, next run time, timestamps, and generic error code. Recommendation: never store filename, MIME, hash, bytes, label, lesson/course/user id, scanner token/reason, signed URL, auth header, or raw exception text. Target part: no-leak policy.
## Decisions
- Add a purpose-built pending cleanup/outbox table.
- Keep storage keys private DB worker state, not audit/log/health output.
- Keep audit and health count-only.
## Risks
- The table must store an opaque object key internally; tests must prove it never leaves DB/repository boundaries into artifacts.
- If enqueue happens only after DELETE fails, a process crash before enqueue still orphans an object.
## Verification/tests
Read-only audit only; no tests run.
## Next actions
- Implement table/migration and repository APIs.
- Add repository tests for create, complete, retry failure, dead-letter, and no-leak audit.
- Add worker tests for pending orphan cleanup.
