# ecosystem-education-implementer handoff
## Scope
Read-only Phase 3.31 LMS lifecycle audit for object-store delete/reconciliation cleanup after Phase 3.30. Focus: material soft-delete, cleanup eligibility, quarantined `s3-r2` metadata rows, audit payloads, and user-visible DTO boundaries.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `apps/web/src/features/lms/queries.ts`; `apps/worker/src/index.ts`; `packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `packages/lms/src/types.ts`; `packages/lms/src/index.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/worker-tortila-snapshot.test.ts`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/EDUCATION_LMS_PLAN.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/AUDIT_LOG_SCHEMA.md`.
## Files changed
None - read-only audit
## Findings
1. High - Object-store delete/reconciliation was absent. Evidence: object storage had PUT/read helpers in `apps/web/src/features/lms/material-storage.ts`, while `packages/db/src/repositories.ts` cleanup only purged `db-local` rows. Recommendation: add a separate injectable `s3-r2` cleanup/reconcile boundary. Target part: object-store cleanup.
2. High - Object cleanup eligibility needed product semantics. Evidence: `deleteMaterial()` soft-deletes rows, and material rows already carry provider/key/scan/retention/delete fields. Recommendation: eligible rows should be expired `s3-r2` files under `lms/materials/` with `deletedAt IS NOT NULL` or unsafe scan status; failed remote delete must retain retry state. Target part: DB lifecycle.
3. High - Quarantined `s3-r2` rows are metadata-only in Phase 3.30. Evidence: `storeLmsUploadedFile()` only PUTs on clean scan status and downloads require clean rows. Recommendation: cleanup should treat unsafe metadata-only rows as purgeable without object DELETE, while 404 remains idempotent for clean object rows. Target part: quarantine cleanup policy.
4. Medium - Cleanup audit must stay summary-only. Evidence: upload/download/local-cleanup audits avoid raw keys, filenames, hashes, and quarantine details. Recommendation: object cleanup audit should include aggregate counts/provider/cutoff/scope only. Target part: audit payload policy.
5. Medium - Worker reporting needs separate DB-local and object-store counts. Evidence: worker previously exposed only `lmsMaterialsPurged`. Recommendation: split object cleanup counts and keep logs count-only. Target part: worker health/reporting.
## Decisions
- Do not run live object-store, live scanner, DB browser, or public-upload rollout in this phase.
- Keep student and teacher material DTOs on allowlisted projections, not broad internal material rows.
## Risks
- Hard-deleting rows before object deletion can orphan private objects.
- Assuming all quarantined `s3-r2` rows have bucket objects can create false failures.
- Logging object keys, signed URLs, filenames, hashes, or vendor scanner details would violate the LMS leak boundary.
## Verification/tests
Read-only inspection only. No tests or gates run by this agent.
## Next actions
1. Add bounded DB candidate/finalize APIs for `s3-r2` cleanup.
2. Add worker-side SigV4 DELETE/reconcile behavior.
3. Add focused tests for delete success, 404 idempotence, delete failure retention, metadata-only quarantined purge, and no-leak health/audit payloads.
4. Update current docs and keep live gates explicitly NOT RUN.
