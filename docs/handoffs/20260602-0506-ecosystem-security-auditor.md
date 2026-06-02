# ecosystem-security-auditor handoff
## Scope
Read-only no-leak and fail-closed security audit for Phase 3.33 durable LMS upload compensation retry.
## Files inspected
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `docs/handoffs/20260602-0429-phase-3-32-lms-upload-compensation.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
## Files changed
None - read-only audit.
## Findings
1. High - Phase 3.32 can still orphan clean uploaded objects on failed DELETE or process exit. Recommendation: add DB-backed pending/outbox/staging lifecycle before public uploads. Target part: LMS upload lifecycle.
2. High - Current schema cannot represent orphan cleanup without abusing `materials`. Recommendation: add dedicated private cleanup/outbox table. Target part: DB model.
3. Medium - Retry persistence may include an opaque object key only as private DB worker state. Recommendation: never project it to DTOs, audits, health, stdout, screenshots, reports, or retained artifacts. Target part: no-leak controls.
4. Medium - Durable retry audit should be stricter than material upload audit: count/status/error-code only. Target part: audit model.
## Decisions
- Allowed private durable fields: id, provider, opaque key, operation/reason, state, attempts, next attempt, generic failure code, timestamps.
- Forbidden durable/log/audit fields: filename, MIME, content hash, bytes/base64, label, URL/embed HTML, signed URL, authorization header, scanner token/endpoint/reason, access key, secret key, session/cookie, or raw exception text.
- DELETE is eligible only for actually-written clean `s3-r2` objects.
## Risks
- Web and worker still duplicate SigV4 primitives.
- Any new evidence path can leak object metadata unless scanner coverage remains strict.
## Verification/tests
Read-only audit only; no commands run.
## Next actions
- Add durable table and worker path.
- Add tests for no-leak retry state, retry success/failure/dead-letter, and artifact scanner failures.
