# ecosystem-db-architect handoff
## Scope
Read-only Phase 3.36 audit of the LMS pending upload cleanup dead-letter acknowledgement/retry workflow. Scope was limited to the database model, migrations, repository APIs, worker interaction, and no-leak projection constraints for `lms_object_cleanup_tasks`.

## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `packages/db/migrations/meta/0014_snapshot.json`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`

## Files changed
- `docs/handoffs/20260602-0609-ecosystem-db-architect.md` only.
- None — read-only audit for product code.

## Findings
1. High - A migration is required before safe acknowledgement can be accepted. Current `schema.ts` declares `acknowledgedAt`, `acknowledgedBy`, and `lms_object_cleanup_tasks_dead_letter_ack_idx` for `lms_object_cleanup_tasks` (`packages/db/src/schema.ts:314`, `packages/db/src/schema.ts:315`, `packages/db/src/schema.ts:322`), but the generated table migration and snapshot still contain only the original 12 columns and no dead-letter ack index (`packages/db/migrations/0014_lazy_puff_adder.sql:1`, `packages/db/migrations/0014_lazy_puff_adder.sql:20`, `packages/db/migrations/meta/0014_snapshot.json:2726`, `packages/db/migrations/meta/0014_snapshot.json:2808`). Recommendation: land an explicit follow-up migration, preferably `0015`, adding nullable `acknowledged_at`, nullable `acknowledged_by REFERENCES users(id)`, and the `(status, acknowledged_at)` index; then regenerate/verify migration metadata. Target part: DB schema/migrations.
2. High - Repository support for admin acknowledgement/retry does not exist yet. Existing cleanup APIs cover create, complete, failure/dead-letter, pending-worker listing, and count-only summary (`packages/db/src/repositories.ts:817`, `packages/db/src/repositories.ts:869`, `packages/db/src/repositories.ts:902`, `packages/db/src/repositories.ts:942`, `packages/db/src/repositories.ts:982`), but there is no `acknowledgeLmsObjectCleanup...` or `retryLmsObjectCleanup...` API. Recommendation: add two admin-only repository functions: `acknowledgeLmsObjectCleanupDeadLetters(db, actorAdminId, now, scope)` and `retryLmsObjectCleanupDeadLetters(db, actorAdminId, now, scope)`, with summary-only return values. Target part: `packages/db/src/repositories.ts`.
3. Medium - Retry can be supported by existing lifecycle columns, but only with a deliberate DB-only transition. `status`, `attempts`, `maxAttempts`, `runAfter`, and `lastErrorCode` already model a failed task and the worker only lists due `pending` rows (`packages/db/src/schema.ts:309`, `packages/db/src/schema.ts:310`, `packages/db/src/schema.ts:311`, `packages/db/src/schema.ts:312`, `packages/db/src/schema.ts:313`, `packages/db/src/repositories.ts:954`, `packages/db/src/repositories.ts:958`). Recommendation: retry should update selected `dead_letter` rows back to `pending`, reset `attempts` to `0` or otherwise explicitly define retry-cycle semantics, set `runAfter = now`, clear `lastErrorCode`, and let the worker perform remote DELETE later; do not perform object-store network calls inside the DB transaction. Target part: DB retry API and worker boundary.
4. Medium - Failure transitions should be made transaction-safe before admin retry/ack races are introduced. `recordLmsObjectCleanupTaskFailure` currently selects the pending row, then updates by `id` only, and inserts the dead-letter audit after that update (`packages/db/src/repositories.ts:909`, `packages/db/src/repositories.ts:912`, `packages/db/src/repositories.ts:917`, `packages/db/src/repositories.ts:923`, `packages/db/src/repositories.ts:924`, `packages/db/src/repositories.ts:937`). A concurrent completion or admin transition between select and update could be overwritten. Recommendation: wrap failure transition and any dead-letter audit insert in one transaction, and make the update conditional on `id` plus `status = 'pending'`, returning the updated row before writing audit. Target part: cleanup task failure repository boundary.
5. Medium - Admin no-leak constraints must remain count-only and server-selected. The worker can receive task IDs and storage keys internally from `listPendingLmsObjectCleanupTasks` (`packages/db/src/repositories.ts:945`, `packages/db/src/repositories.ts:948`, `packages/db/src/repositories.ts:972`, `packages/db/src/repositories.ts:974`), but the admin summary intentionally selects no task IDs or object locators (`packages/db/src/repositories.ts:982`, `packages/db/src/repositories.ts:992`), the admin UI says those fields are hidden (`apps/web/src/app/admin/system-health/page.tsx:103`, `apps/web/src/app/admin/system-health/page.tsx:105`), and tests reject `storageKey`/`cleanupTaskId` exposure (`tests/integration/admin-lms-cleanup-review.test.ts:19`, `tests/integration/admin-health-detail.test.ts:18`, `tests/integration/admin-health-detail.test.ts:44`). Recommendation: admin acknowledgement/retry should operate on server-side filters such as all unacknowledged dead letters before a timestamp plus expected count, not client-visible cleanup task IDs or object keys; audit payloads should include only counts, provider, scope, generic action, and actor. Target part: admin projection DTOs, server actions, and repo return types.

## Decisions
- Existing generated DB columns are not enough for safe acknowledgement without overloading `completed_at` or `completed` semantics; acknowledgement needs explicit durable metadata.
- No new status value is required if `acknowledged_at IS NULL` means needs review and `acknowledged_at IS NOT NULL` means reviewed while `status = 'dead_letter'` remains the terminal cleanup state.
- Retry does not require a new table if the product accepts aggregate retry semantics and resets/reschedules `dead_letter` rows back to `pending`.
- Object-store DELETE must stay outside DB transactions. Repository retry schedules DB state; the worker later performs DELETE and calls the existing completion/failure APIs.
- Admin-facing reads and mutations must remain count-only and must not project cleanup task IDs, object keys, filenames, hashes, signed URLs, scanner details, provider response bodies, or raw provider errors.

## Risks
- The current `schema.ts` to migration mismatch will cause drift: TypeScript references acknowledgement columns that a fresh DB built from migrations does not have.
- Retrying all dead letters without an `expectedCount` or `created/updated before` guard could accidentally include rows that dead-letter while the admin page is open.
- Reusing `completed_at` for acknowledgement would make "object delete confirmed" indistinguishable from "operator accepted unresolved cleanup"; do not use that shortcut.
- Free-form acknowledgement notes could capture secrets or provider response text. Prefer no note, a constrained reason enum, or a strictly redacted bounded field with tests.

## Verification/tests
- Read-only source inspection only. No tests or generators were run because this lane was explicitly scoped as a read-only audit with only this handoff file allowed.
- Existing relevant coverage observed: migration column guard for the current cleanup table (`tests/integration/lms-object-cleanup-tasks.test.ts:43`), retry/dead-letter behavior (`tests/integration/lms-object-cleanup-tasks.test.ts:105`), summary no-leak assertions (`tests/integration/lms-object-cleanup-tasks.test.ts:169`), admin no-leak static guard (`tests/integration/admin-lms-cleanup-review.test.ts:7`), and worker pending-cleanup no-leak assertions (`tests/integration/worker-tortila-snapshot.test.ts:269`).

## Next actions
1. Add a Phase 3.36 migration that reconciles `schema.ts` with generated SQL/snapshots for `acknowledged_at`, `acknowledged_by`, and the dead-letter acknowledgement index.
2. Add repository APIs for aggregate acknowledgement and aggregate retry, with one transaction per DB state change plus summary-only audit rows.
3. Harden `recordLmsObjectCleanupTaskFailure` into a conditional transactional transition before adding admin actions.
4. Extend `summarizeLmsObjectCleanupOperations` and admin DTOs with unacknowledged versus acknowledged dead-letter counts while preserving no task IDs/object locators.
5. Add tests for migration columns, ack/retry transitions, race-safe status guards, summary-only audit payloads, and admin static no-leak constraints before exposing UI controls.
