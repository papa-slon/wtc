# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.31 security audit for LMS object storage cleanup, scanner boundaries, audit/log redaction, generated artifact scanning, and public-upload blockers after Phase 3.30.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`; `packages/lms/src/materials.ts`; `packages/db/src/repositories.ts`; `packages/audit/src/audit.ts`; `packages/audit/src/redact.ts`; `packages/config/src/env.ts`; `apps/worker/src/index.ts`; `apps/worker/src/tick-once.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `docs/AUDIT_LOG_SCHEMA.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/DEPLOYMENT.md`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/IMPLEMENTED_FILES.md`; `.env.example`.
## Files changed
None - read-only audit
## Findings
1. High - `s3-r2` object delete/reconciliation was not implemented. Evidence: current object adapter had PUT and signed read only; cleanup was scoped to `db-local`. Recommendation: add separate SigV4 DELETE and DB finalization after confirmed delete/already-absent. Target part: object-store cleanup.
2. High - Clean `s3-r2` uploads can be orphaned if DB creation fails after object PUT. Evidence: upload storage prepares/writes object before `createMaterial()` inserts the row. Recommendation: future slice should add compensating delete-on-create-failure or pending/outbox semantics. Target part: upload transaction/object lifecycle.
3. High - Object delete failures must retain retry state. Evidence: only the DB row stores the object key needed for deletion. Recommendation: never hard-delete on network, auth, 5xx, timeout, or malformed config failure. Target part: fail-closed delete behavior.
4. Medium - Quarantined `s3-r2` rows require explicit metadata-only policy. Evidence: Phase 3.30 avoids standard-bucket PUT for quarantined rows but still stores metadata. Recommendation: purge expired unsafe metadata rows without logging raw reasons; treat 404 as idempotent for rows that require object delete. Target part: quarantine cleanup policy.
5. Medium - Cleanup audit/log output must be count-only. Evidence: existing LMS audits avoid raw keys/reasons. Recommendation: include counts/provider/cutoff/scope only; exclude material IDs, keys, URLs, request headers, signatures, filenames, hashes, MIME, scanner endpoint/token, and provider bodies. Target part: audit/log redaction.
6. Medium - Signed URL tokens remain sensitive artifacts. Evidence: generated artifact scanner rejects `X-Amz-*` tokens. Recommendation: do not log delete canonical requests or headers, and add cleanup-log artifact fixtures. Target part: artifact scanning.
## Decisions
- Treat this as local mocked cleanup acceptance only.
- Keep `LMS_PUBLIC_UPLOADS_ENABLED=false` operationally until live object storage, live scanner, cleanup/reconciliation, DB browser, and artifact evidence gates are all observed.
## Risks
- Row deletion before object deletion can orphan data.
- Cleanup logs can leak object keys or signatures if raw provider request data is retained.
- Public-upload config passing does not prove cleanup readiness.
## Verification/tests
Read-only inspection only. No tests, gates, live scanner, or live object-store calls run by this agent.
## Next actions
1. Add SigV4 DELETE with generic errors and no request logging.
2. Add retry-safe DB finalization after object delete success or already-absent response.
3. Add count-only health/audit tests and cleanup artifact scanner fixtures.
4. Keep live acceptance gates NOT RUN without approved throwaway credentials.
