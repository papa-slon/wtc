# Phase 3.24 LMS material cleanup handoff
## Scope
Implement the next local LMS maintenance slice after Phase 3.23: cleanup for expired DB-local material file rows, worker tick integration, summary-only audit accountability, focused tests, and status documentation.

This phase does not implement production object storage, signed redirects, an external malware scanner, object-store delete/reconciliation cleanup, public upload rollout, or the not-yet-observed DB-backed browser acceptance run.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0144-ecosystem-education-implementer.md](20260602-0144-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0144-ecosystem-backend-implementer.md](20260602-0144-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0144-ecosystem-security-auditor.md](20260602-0144-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0144-ecosystem-tests-runner.md](20260602-0144-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final report.

## Files inspected
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `packages/lms/src/materials.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`

## Files changed
- `packages/db/src/repositories.ts`
- `packages/audit/src/audit.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260602-0144-phase-3-24-lms-material-cleanup.md`

## Findings
1. Severity: High. Existing `materials` checks require file rows to retain payload/checksum/storage metadata, so byte-only nulling would violate schema constraints. Recommendation implemented: hard-delete only eligible local file rows rather than mutating payload columns in place. Target part: `packages/db/src/repositories.ts`.
2. Severity: High. Future object-storage rows can share the same table shape, so local cleanup must not delete non-local rows or rows with unexpected keys. Recommendation implemented: cleanup requires `storage_provider = 'db-local'` and `storage_key LIKE 'lms/materials/%'`. Target part: cleanup predicate.
3. Severity: High. Active clean materials use `retained_until` as lifecycle metadata, not an access-expiry field. Recommendation implemented: active clean rows are kept even if `retained_until <= now`; cleanup only touches soft-deleted rows or unsafe scan states. Target part: LMS material availability.
4. Severity: Medium. Hard-delete cleanup needed append-only accountability beyond worker health rows. Recommendation implemented: `education.material_cleanup` is a typed audit action and the repository writes one summary-only system audit row when rows are purged. Target part: audit contract.
5. Severity: Medium. Worker observability must stay count-only. Recommendation implemented: `lmsMaterialsPurged` is recorded in worker result, worker health detail, DB tick log, and one-shot tick output without row IDs, names, hashes, bytes, base64, storage keys, or quarantine details. Target part: worker output.

## Decisions
- No schema migration was added. The current schema supports a safe hard-delete cleanup for eligible local file rows.
- The cleanup function is named `purgeExpiredLmsMaterialFiles(db, now)` and returns `{ purged }`.
- Cleanup eligibility is intentionally narrow: file kind, `db-local` provider, local `lms/materials/%` key prefix, `retained_until <= now`, and either soft-deleted or unsafe scan state.
- The worker invokes LMS cleanup after the existing entitlement, TV, and JTI maintenance steps and before recording worker health.
- Cleanup audit rows are summary-only; they do not include material IDs or file/storage internals.

## Risks
- This is not production object-storage cleanup. Object stores still need a delete-object/reconcile flow before any non-local row cleanup can be accepted.
- Quarantined rows still use the existing retention timestamp assigned at upload time; shortening risky-file retention remains a separate product-policy slice if desired.
- The actual DB-backed browser run remains not observed because no fresh throwaway/admin DB URL was supplied.
- The workspace is not a git repository from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`, so no git diff/status or commit evidence is available in this folder.

## Verification/tests
RUN:
1. `npm test -- tests/integration/db-lms-ph3-1.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/worker-health-mapping.test.ts` - PASS, 34 tests.
2. `npm run governance:check` - PASS, 0 errors / 1 known historical warning.
3. `node scripts/gates.mjs full` - PASS, 9/9 gates (governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build).
4. `node scripts/gates.mjs e2e` - PASS, 44 Playwright tests.
5. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 image files, 0 blocked containers, 2 missing roots, 70 total artifact files.
6. `npm run worker:smoke` - PASS, memory-demo worker tick.

NOT RUN:
1. `npm run e2e:lms:db` - no `LMS_E2E_DATABASE_URL`.
2. `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
3. DB create/drop, migrations against live Postgres, production object storage, external malware scanner, signed redirects, live Stripe/Axioma/TV/bot-control acceptance, and deployment actions - not in scope / no credentials.

## Next actions
1. When a fresh throwaway/admin DB URL is available, run `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` and archive only scanner-passed, redacted evidence.
2. Keep production LMS upload rollout blocked until object storage, external malware scanning, signed redirects, object-store cleanup, observed DB browser acceptance, and operator approval are complete.
