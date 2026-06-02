# ecosystem-tests-runner handoff
## Scope
Phase 3.36 read-only audit for the verification plan around an LMS pending-upload cleanup dead-letter acknowledgement/retry workflow. Scope was limited to existing integration/static tests and gates for LMS object cleanup tasks, admin system health review, worker cleanup counters, generated artifact scanning, and governance. No product code was edited.

## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `apps/web/src/app/admin/system-health/page.tsx`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/gates.mjs`
- `package.json`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
- `docs/handoffs/20260602-0609-ecosystem-tests-runner.md` - handoff artifact only.

## Findings
1. High - Repository coverage already pins retry scheduling and dead-letter summary behavior, but there is no ack/retry workflow coverage yet. Evidence: `lms_object_cleanup_tasks` has only `pending`, `completed`, and `dead_letter` style status storage plus retry fields at `packages/db/src/schema.ts:302`-`packages/db/src/schema.ts:316`; failure handling schedules retries and flips to `dead_letter` at `packages/db/src/repositories.ts:902`-`packages/db/src/repositories.ts:939`; due task selection only returns `pending` rows at `packages/db/src/repositories.ts:942`-`packages/db/src/repositories.ts:980`; current tests cover failure and summary-only dead-letter output at `tests/integration/lms-object-cleanup-tasks.test.ts:105`-`tests/integration/lms-object-cleanup-tasks.test.ts:210`. Recommendation: add focused repo tests for the new ack/retry APIs covering dead-letter-only eligibility, idempotent repeat calls, non-mutation of `pending` and `completed` rows, due retry visibility through `listPendingLmsObjectCleanupTasks`, and summary-only audit payloads with leak bait in `lastErrorCode`/operator note inputs. Target part: DB repository ack/retry contract.

2. High - Admin mutation tests must prove the workflow is bulk/count-only or otherwise does not expose private cleanup identifiers. Evidence: the current admin loader maps only count/date/error-code summary fields at `apps/web/src/features/admin/queries.ts:199`-`apps/web/src/features/admin/queries.ts:210`; the admin page states it hides cleanup task IDs, object keys, filenames, hashes, signed URLs, scanner details, and provider response bodies at `apps/web/src/app/admin/system-health/page.tsx:74`-`apps/web/src/app/admin/system-health/page.tsx:111`; the static test forbids locator fields in the page/loader and summary projection at `tests/integration/admin-lms-cleanup-review.test.ts:7`-`tests/integration/admin-lms-cleanup-review.test.ts:39`. Recommendation: add an admin action/route integration test that verifies admin-only RBAC, CSRF/schema validation if a server action is used, invalid input failure without row locators, successful acknowledge/retry responses containing counts only, and rendered HTML/source containing no `cleanupTaskId`, `cleanup_task_id`, `storageKey`, `storage_key`, object key suffix, `Authorization`, `X-Amz`, filenames, hashes, scanner details, or provider response text. Target part: admin acknowledgement/retry action and review UI.

3. High - Worker end-to-end coverage should prove ack and retry change actual cleanup behavior, not just admin counters. Evidence: the worker currently retries failed pending-upload cleanup by calling `recordLmsObjectCleanupTaskFailure()` and counts dead-lettered rows at `apps/worker/src/lms-object-cleanup.ts:84`-`apps/worker/src/lms-object-cleanup.ts:117`; existing worker tests prove failed deletes become dead-lettered and health detail stays count-only at `tests/integration/worker-tortila-snapshot.test.ts:269`-`tests/integration/worker-tortila-snapshot.test.ts:337`. Recommendation: add a focused worker integration path where a dead-letter row is retried by the new admin/repo API, becomes due, is picked up by `runDbWorkerTick`, and completes on 204/404; add the inverse acknowledgement path proving acknowledged/reviewed rows are not selected by `listPendingLmsObjectCleanupTasks` or attempted by the worker. Target part: worker cleanup reconciliation after operator actions.

4. Medium - Generated artifact scanning covers object keys, signed URLs, auth headers, DB URLs, and scanner envs, but it does not explicitly forbid cleanup task field names if they appear without other raw object material. Evidence: scanner deny rules include `storageKey`, `storage_key`, `lms/materials/`, `X-Amz-*`, `Authorization`, cookies, bearer/basic auth, and DB/scanner env assignments at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:54`; the pending-upload cleanup negative fixture fails because it includes a raw object URL and auth headers at `tests/integration/lms-db-e2e-artifact-scan.test.ts:88`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:96`. Recommendation: extend the scanner and tests to reject `cleanupTaskId`, `cleanup_task_id`, and any new admin ack/retry field labels that would identify private rows, while adding a positive fixture for safe count-only acknowledgement/retry summaries. Target part: retained artifact no-leak guard.

5. Medium - Gate reporting must keep focused tests, full gates, e2e, artifact scan, and DB-browser acceptance separate. Evidence: `node scripts/gates.mjs full` currently runs governance, core checks, lint, root/web typecheck, secret scan, Vitest, `db:generate`, and web build, while e2e is a separate plan at `scripts/gates.mjs:43`-`scripts/gates.mjs:52`; package scripts expose default e2e and opt-in LMS DB e2e separately at `package.json:27`-`package.json:31`; the acceptance matrix says the LMS DB browser gate is NOT RUN unless a fresh `wtc_test_lms_*` database URL or managed admin DB URL is provided and the artifact scanner passes on generated evidence at `docs/ACCEPTANCE_MATRIX_MASTER.md:68`-`docs/ACCEPTANCE_MATRIX_MASTER.md:76`. Recommendation: Phase 3.36 final report should list local gates RUN separately from LMS DB browser/live S3/R2/live scanner gates NOT RUN unless actually executed with the required credentials and fresh DB. Target part: phase verification and final operator report.

## Decisions
No product-code decisions were made. Verification should require the ack/retry workflow to remain count-only at admin, health, audit, log, and artifact boundaries.

## Risks
- If ack/retry is implemented as per-row UI with hidden form IDs, retained HTML and Playwright traces can leak private cleanup task identifiers even when visible text looks safe.
- If retry semantics are not pinned, a retry action can accidentally reset attempts forever, bypass max-attempt dead-lettering, or make acknowledged rows eligible for worker deletion again.
- If artifact scanner rules are not expanded before e2e/browser evidence is retained, a pure cleanup task identifier leak may pass the current scanner.
- If a schema status such as `acknowledged` is added, `db:generate` and migration tests must be included before claiming no drift.

## Verification/tests
Recommended focused tests after implementation:
- `npm test -- tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/admin-lms-cleanup-review.test.ts tests/integration/admin-health-detail.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts`
- If new files are created, include them explicitly, for example: `npm test -- tests/integration/lms-object-cleanup-ack-retry.test.ts tests/integration/admin-lms-cleanup-ack-retry.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts`

Recommended gate sequence:
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run lint`
- `npm run worker:smoke`
- `npm run db:generate -w @wtc/db`
- `node scripts/scan-lms-db-e2e-artifacts.mjs`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`
- final `node scripts/scan-lms-db-e2e-artifacts.mjs`
- final `npm run secret:scan`
- final `npm run governance:check`

Not run in this read-only audit: no Vitest, typecheck, lint, worker smoke, full gate, e2e gate, DB browser gate, live S3/R2 acceptance, live scanner acceptance, secret scan, or governance gate.

## Next actions
1. Define the exact ack terminal state before implementation: reuse `completed` for reviewed dead letters, or add a new explicit status and migration if product semantics require it.
2. Add repository-level ack/retry APIs and tests before wiring admin UI/actions.
3. Add admin action/static tests that prove count-only responses and no private locator fields in rendered/admin-source artifacts.
4. Add worker regression coverage for retry-to-cleanup and acknowledge-to-not-selected behavior.
5. Extend the artifact scanner for cleanup task identifier field names before retaining new browser/e2e evidence.
6. Run the focused tests first, then the full gate sequence above, and report any DB-browser/live gates as NOT RUN unless executed under the acceptance matrix requirements.
