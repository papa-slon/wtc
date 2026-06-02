# ecosystem-backend-implementer handoff
## Scope
Phase 3.36 read-only backend audit for the LMS pending-upload cleanup dead-letter acknowledgement/retry workflow. Scope covered existing admin server-action/backend patterns, worker pending cleanup behavior, `@wtc/db` cleanup repositories, audit contracts, and tests. No product code edits were allowed. Note: the inspected tree already contains partial Phase 3.36 acknowledgement/retry code, so findings distinguish current partial implementation from the still-needed backend contract.
## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0014_lazy_puff_adder.sql`
- `packages/db/migrations/meta/0014_snapshot.json`
- `packages/audit/src/audit.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/features/admin/health-detail.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0609-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-0609-ecosystem-frontend-implementer.md`
- `docs/handoffs/20260602-0609-ecosystem-tests-runner.md`
## Files changed
None — read-only audit
## Findings
1. Severity: High. Evidence: `packages/db/src/schema.ts:314`-`packages/db/src/schema.ts:322` now declares `acknowledged_at`, `acknowledged_by`, and `lms_object_cleanup_tasks_dead_letter_ack_idx`, but `packages/db/migrations/0014_lazy_puff_adder.sql:1`-`packages/db/migrations/0014_lazy_puff_adder.sql:20` creates `lms_object_cleanup_tasks` without those columns/indexes, and `packages/db/migrations/meta/0014_snapshot.json:2726`-`packages/db/migrations/meta/0014_snapshot.json:2846` also lacks them for the cleanup table. `summarizeLmsObjectCleanupOperations()` already selects `acknowledgedAt` at `packages/db/src/repositories.ts:985`-`packages/db/src/repositories.ts:995`. Recommendation: before wiring or claiming Phase 3.36, either add the missing additive migration/snapshot for acknowledgement fields or revert the schema/repository/UI ack fields; otherwise migrated DBs and PGlite tests will fail on missing columns. Target part: DB migration/schema contract.
2. Severity: High. Evidence: `acknowledgeLmsObjectCleanupDeadLetters()` and `retryAcknowledgedLmsObjectCleanupDeadLetters()` already exist at `packages/db/src/repositories.ts:1059`-`packages/db/src/repositories.ts:1161`, but neither accepts an operator note, expected unacknowledged/acknowledged count, or observed latest dead-letter timestamp. The admin actions pass only `{ actorUserId: actor.id }` at `apps/web/src/features/admin/actions.ts:265`-`apps/web/src/features/admin/actions.ts:293`, and schemas validate only a literal operation at `apps/web/src/features/admin/schemas.ts:59`-`apps/web/src/features/admin/schemas.ts:65`. Recommendation: make the minimal backend API aggregate but guarded: accept expected count plus observed latest timestamp for the cohort, optionally a short sanitized operator note, reselect rows server-side, and abort on stale expectations so newly arrived dead letters are not acknowledged or retried unseen. Target part: admin mutation API and repository input contract.
3. Severity: High. Evidence: retry currently resets dead-letter rows to `status: 'pending'`, `attempts: 0`, `runAfter: now`, and clears acknowledgement/error fields at `packages/db/src/repositories.ts:1127`-`packages/db/src/repositories.ts:1144`. The original worker failure logic dead-letters when `attempts >= maxAttempts` at `packages/db/src/repositories.ts:902`-`packages/db/src/repositories.ts:923`, and the worker only processes due pending rows at `apps/worker/src/lms-object-cleanup.ts:84`-`apps/worker/src/lms-object-cleanup.ts:109`. Recommendation: do not reset attempts to zero unless product policy explicitly allows unlimited manual cycles; safer minimal retry preserves attempts or adds a separate bounded admin retry counter, sets `run_after=now`, and lets the worker perform the DELETE. Target part: retry lifecycle semantics.
4. Severity: High. Evidence: repository audit writes new actions `education.material_cleanup_ack` and `education.material_cleanup_retry` at `packages/db/src/repositories.ts:1089`-`packages/db/src/repositories.ts:1157`, but `packages/audit/src/audit.ts:84`-`packages/audit/src/audit.ts:100` registers `education.material_cleanup` only, and `docs/AUDIT_LOG_SCHEMA.md:120`-`docs/AUDIT_LOG_SCHEMA.md:125` says every new action must be added to `AUDIT_ACTIONS` before use. Recommendation: either register and document the two new action codes with summary-only payload rules, or use existing `education.material_cleanup` with an `operation` field; do not leave unregistered action literals in `AuditInput`. Target part: audit action contract/typecheck.
5. Severity: Medium. Evidence: current repository functions select private task IDs internally at `packages/db/src/repositories.ts:1065`-`packages/db/src/repositories.ts:1088` and `packages/db/src/repositories.ts:1113`-`packages/db/src/repositories.ts:1144`, while admin DTOs expose only aggregate counts/timestamps at `apps/web/src/features/admin/types.ts:54`-`apps/web/src/features/admin/types.ts:68` and `apps/web/src/features/admin/queries.ts:203`-`apps/web/src/features/admin/queries.ts:217`. Recommendation: keep IDs inside repository internals only; action return values and UI should expose counts, latest timestamps, generic error code, and mode only. No task IDs, object keys, filenames, hashes, signed URLs, scanner details, provider bodies, or raw provider errors should cross into web DTOs, form fields, logs, audits, or artifacts. Target part: no-leak boundary.
6. Severity: Medium. Evidence: admin mutation convention is documented and implemented as `requireUser -> assertAdmin -> assertCsrf -> Zod -> repo -> revalidatePath` at `apps/web/src/features/admin/actions.ts:1`-`apps/web/src/features/admin/actions.ts:18`, and the new cleanup actions follow that broad chain at `apps/web/src/features/admin/actions.ts:265`-`apps/web/src/features/admin/actions.ts:293`. However, they silently return when `getServerDb()` is null at `apps/web/src/features/admin/actions.ts:273`-`apps/web/src/features/admin/actions.ts:290`. Recommendation: for this operational workflow, prefer fail-closed/no-success semantics in demo/no-DB mode, or return a typed action result that the UI can render honestly; avoid a silent no-op that looks like an operator acknowledgement. Target part: admin action behavior.
7. Severity: Medium. Evidence: tests currently cover the old durable retry/dead-letter behavior and no-leak summary at `tests/integration/lms-object-cleanup-tasks.test.ts:105`-`tests/integration/lms-object-cleanup-tasks.test.ts:210`, and static admin no-leak review at `tests/integration/admin-lms-cleanup-review.test.ts:7`-`tests/integration/admin-lms-cleanup-review.test.ts:39`. No tests reference the new acknowledgement/retry functions, new audit actions, acknowledged counts, `latestAcknowledgedAt`, or the new admin actions/forms. Recommendation: add focused repo tests for acknowledgement, retry, stale guards, audit payload shape, idempotency, and worker pickup after retry; add admin action/static tests proving CSRF/Zod/RBAC, no locator fields in forms, and no raw provider error or key leakage. Target part: verification coverage.
8. Severity: Medium. Evidence: `docs/DATA_MODEL.md:875`-`docs/DATA_MODEL.md:897` still documents `lms_object_cleanup_tasks` without acknowledgement columns, while `apps/web/src/app/admin/system-health/page.tsx:109`-`apps/web/src/app/admin/system-health/page.tsx:147` already renders acknowledged counts and acknowledgement/retry controls. `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` still lists dead-letter acknowledgement/retry as open. Recommendation: after backend semantics are fixed and verified, update docs to define the local ack/retry boundary and keep live S3/R2, live scanner, DB-browser acceptance, and public upload rollout explicitly out of scope. Target part: docs/acceptance alignment.
## Decisions
- Keep `lms_object_cleanup_tasks` private and key-bearing; admin operations must be aggregate/cohort based.
- Keep object deletion in the worker path; admin retry should only make a reviewed dead-letter cohort eligible for worker processing.
- Durable acknowledgement needs real migrated columns, not audit-only state.
- The minimal backend API should be repository-first: summarize, acknowledge guarded cohort, retry guarded acknowledged cohort.
- Do not add row-level browsing or hidden form task IDs for this phase.
## Risks
- Current schema/repository drift can break migrated DB reads immediately because repository summary selects acknowledgement columns absent from migration `0014`.
- Current retry resets attempts and can allow repeated manual cycles that bypass the original max-attempt dead-letter signal.
- Unguarded aggregate actions can acknowledge or retry dead letters the operator did not actually review.
- New audit action literals may fail typecheck and are not yet documented with no-leak payload rules.
- Silent demo/no-DB no-ops can make the UI appear to complete an operational action that did not mutate durable state.
## Verification/tests
- Not run; this was a read-only audit.
- Recommended focused tests after implementation:
  - `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/admin-lms-cleanup-review.test.ts tests/integration/admin-health-detail.test.ts tests/integration/csrf-coverage.test.ts`
  - Add a dedicated ack/retry test if the file grows too large, then include it explicitly in the focused command.
- Required gates before claiming Phase 3.36 green: root typecheck, web typecheck, lint, worker smoke, `npm run db:generate -w @wtc/db`, secret scan, governance, full gate, e2e, and artifact scan. DB-browser, live S3/R2, live scanner, and public rollout remain NOT RUN unless separately provisioned and observed.
## Next actions
1. Reconcile the schema/migration drift for `acknowledged_at`, `acknowledged_by`, and the acknowledgement index.
2. Register/document `education.material_cleanup_ack` and `education.material_cleanup_retry`, or switch the implementation to existing `education.material_cleanup` with a summary-only `operation` field.
3. Harden repository APIs with expected cohort count/timestamp guards and bounded retry semantics that do not erase failure history without an explicit policy.
4. Harden admin schemas/actions to include the same guarded inputs and honest demo/no-DB behavior while keeping form data locator-free.
5. Add focused repository, admin action/static, worker retry, audit, and no-leak tests before running the phase gates.
