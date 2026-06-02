# Phase 3.30 LMS external scanner boundary handoff
## Scope
Implement the next local LMS public-upload safety slice after Phase 3.29: make `LMS_FILE_SCANNER_MODE=external` a real fail-closed server boundary with typed config, HTTPS/token requirements, bounded scanner timeout, scanner-before-storage ordering, clean/quarantine/failure semantics, no standard object write for quarantined `s3-r2` uploads, scanner endpoint/token artifact deny rules, and current docs. No live scanner credentials, live object-store credentials, or production services were used.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0341-ecosystem-education-implementer.md](20260602-0341-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0341-ecosystem-devops-implementer.md](20260602-0341-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-0341-ecosystem-security-auditor.md](20260602-0341-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0341-ecosystem-tests-runner.md](20260602-0341-ecosystem-tests-runner.md)

All four background agents were collected and closed before the final operator report.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `packages/lms/src/materials.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `packages/db/src/repositories.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `.env.example`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/DEPLOYMENT.md`; `docs/IMPLEMENTED_FILES.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/EDUCATION_LMS_PLAN.md`; `docs/AUDIT_LOG_SCHEMA.md`.
## Files changed
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `packages/db/src/repositories.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `.env.example`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260602-0341-ecosystem-education-implementer.md`
- `docs/handoffs/20260602-0341-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0341-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0341-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md`
## Findings
1. High - `external` scanner mode was previously only a config label. Implemented: external mode requires endpoint/token, runtime calls the scanner before storage writes, accepts only clean/quarantined, and fails closed on scanner errors. Target part: LMS scanner boundary.
2. High - Public-upload fences needed to apply to deployment axis as well as build axis. Implemented: LMS public-upload fences now apply when `NODE_ENV=production` or `APP_ENV=staging|production`. Target part: config fail-closed policy.
3. High - Scanner requests could hang. Implemented: bounded scanner timeout via `LMS_FILE_SCANNER_TIMEOUT_MS`, defaulting to 5000 ms. Target part: scanner HTTP client.
4. High - Quarantined external verdicts should not write unsafe bytes to the standard object bucket. Implemented: clean `s3-r2` verdicts may PUT; quarantined `s3-r2` verdicts return non-downloadable metadata rows without standard object write. Target part: object-storage quarantine policy.
5. Medium - Raw scanner/vendor reasons should not enter audit payloads. Implemented: upload audit now records `hasQuarantineReason` instead of raw `quarantineReason`. Target part: audit payload policy.
6. Medium - Retained artifacts needed scanner-specific env deny rules. Implemented: artifact scanner rejects `LMS_FILE_SCANNER_ENDPOINT=` and `LMS_FILE_SCANNER_TOKEN=` assignments. Target part: generated artifact scanner.
## Decisions
- Treat scanner failures/timeouts/malformed responses as no-row/no-storage failures in this phase.
- Keep quarantined rows non-downloadable through the existing clean-row DB lookup, and do not write quarantined `s3-r2` bytes to the standard object bucket.
- Do not implement async scanner callbacks, durable `failed` material rows, or object-store cleanup/reconciliation in this slice.
- Do not claim live scanner acceptance from mocked fetch tests.
- Keep `LMS_PUBLIC_UPLOADS_ENABLED=false` operationally until live scanner, live S3/R2, cleanup/reconciliation, and browser gates are observed.
## Risks
- Live scanner protocol, latency, verdict shape, and auth behavior remain unverified.
- Scanner failures are no-row/no-storage and may still need a future UX/audit event.
- Quarantined metadata rows for `s3-r2` do not retain bytes in the standard object bucket; any future review workflow needs a separate quarantine storage design.
- Object-store cleanup/reconciliation remains open.
- This directory is still not git-backed in this session.
## Verification/tests
RUN:
- `npm test -- packages/config/src/env.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/db-lms-ph3-1.test.ts` - PASS, 5 files / 76 tests.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- `node scripts/gates.mjs e2e` with LMS DB env vars cleared - PASS, 44 passed.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 images, 0 blocked containers, 2 missing roots, 70 total artifact files, 0 dynamic markers.
- Final `npm run secret:scan` after docs/handoffs - PASS.
- Final `npm run governance:check` after aggregate handoff - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- `npm run e2e:lms:db` - no fresh `LMS_E2E_DATABASE_URL`.
- `npm run e2e:lms:db:managed` - no `LMS_E2E_ADMIN_DATABASE_URL`.
- Live external scanner acceptance - no operator-approved scanner endpoint/token.
- Live S3/R2 upload/download acceptance - no object-store credentials.
- Object-store delete/reconciliation cleanup - not implemented.
- Production public upload rollout - blocked by live acceptance and cleanup gaps.
## Next actions
1. With operator-approved scanner credentials, add a live scanner acceptance gate covering clean, quarantined, non-2xx, timeout/network failure, malformed response, and no token/log leakage.
2. Add object-store delete/reconciliation before public upload rollout.
3. Run `npm run e2e:lms:db` or managed equivalent when a fresh throwaway/admin DB URL is available.
4. Keep public uploads disabled until live scanner, live S3/R2, cleanup/reconciliation, DB browser, and artifact evidence gates are green.
