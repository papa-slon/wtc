# Phase 3.38 LMS external scanner live preflight handoff
## Scope
Implement a local, no-live-credentials LMS external malware-scanner acceptance preflight after Phase 3.37. This phase extracts
the external scanner request/response contract into `@wtc/lms`, rewires the web upload path to use it, adds a dry-run-first
and live-opt-in scanner preflight command, and hardens generated-artifact scanning for future scanner evidence. This phase
does not run live external scanner acceptance, live S3/R2, DB-backed LMS browser acceptance, cleanup/reconcile live
acceptance, or public upload rollout.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0659-ecosystem-platform-architect.md](20260602-0659-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0659-ecosystem-security-auditor.md](20260602-0659-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0659-ecosystem-backend-implementer.md](20260602-0659-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0659-ecosystem-tests-runner.md](20260602-0659-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0659-ecosystem-devops-implementer.md](20260602-0659-ecosystem-devops-implementer.md)

All five background agents completed and were closed after their handoffs were collected.
## Files inspected
- `apps/web/src/features/lms/material-storage.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/index.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/gates.mjs`
- `.env.example`
- `package.json`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/EDUCATION_LMS_PLAN.md`
## Files changed
- `packages/lms/src/external-scanner.ts`
- `packages/lms/src/external-scanner.test.ts`
- `packages/lms/src/index.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `scripts/lms-external-scanner-live-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-external-scanner-live-preflight.test.ts`
- `package.json`
- `.env.example`
- current docs and this handoff set.
## Findings
1. High - External scanner protocol lived in the web feature file, creating drift risk for any live harness. Implemented:
   `packages/lms/src/external-scanner.ts` owns scanner config parsing, request construction, response parsing, reason
   normalization, and injected-fetch scan execution. Target part: shared LMS scanner boundary.
2. High - The live scanner acceptance command did not exist. Implemented: `scripts/lms-external-scanner-live-preflight.mjs`
   and `accept:lms:external-scanner`. Dry-run validates config, builds scanner requests, performs no network I/O, and writes
   redacted summary evidence. Live mode requires explicit live and quarantine-corpus confirmation. Target part: scanner
   preflight command boundary.
3. High - Retained scanner evidence could leak endpoint, token, headers, exact corpus bytes, or vendor responses. Implemented:
   artifact deny rules for scanner live env assignments, `x-wtc-lms-*` request headers, `application/octet-stream`, and raw
   provider verdict JSON. Target part: retained artifact no-leak guard.
4. High - Public upload rollout must stay separate from scanner preflight. Implemented: the preflight refuses
   `LMS_PUBLIC_UPLOADS_ENABLED=true`, docs keep public uploads disabled, and acceptance docs separate live scanner,
   live object-store, DB browser, cleanup/reconcile, and public rollout gates. Target part: rollout sequencing.
5. Medium - Default gates must not call live scanner endpoints. Implemented: static tests assert the preflight command is not
   called by default `e2e`, `ci:local`, or `scripts/gates.mjs`. Target part: gate safety.
6. Medium - Redacted dry-run evidence needed machine proof. Implemented: integration tests run dry-run against fixture env,
   assert stdout and summary omit endpoint, token, auth headers, scanner request headers, octet-stream markers, and exact
   corpus bytes, then scan the generated summary with the artifact scanner. Target part: evidence retention.
## Decisions
- Keep external scanner request/response semantics in `@wtc/lms`; web continues to own upload orchestration and object-store
  write ordering.
- Keep scanner preflight as an explicit operator command, not part of default CI, default Playwright, or full gates.
- Use `LMS_FILE_SCANNER_LIVE_ACCEPTANCE=1` and `LMS_FILE_SCANNER_LIVE_EICAR=1` as live scanner consent gates.
- Store only redacted count/status summary evidence under `logs/lms-external-scanner-preflight`; raw endpoint URLs, bearer
  tokens, request headers, exact corpus bytes, raw vendor bodies, and raw reasons remain wire-only.
- Keep Phase 3.38 local-only unless the operator supplies an approved scanner endpoint/token in a later phase.
## Risks
- The local preflight reduces drift but still does not prove the vendor endpoint, auth, latency, timeout, or quarantine corpus
  behavior without a live run.
- Some scanner vendors may not support EICAR or deterministic failure/timeout fixtures; live acceptance must use an
  operator-approved safe corpus and report partial coverage honestly.
- Scanner preflight is scanner-only. It does not prove live S3/R2, DB browser upload/download, worker cleanup/reconcile, or
  public upload rollout.
## Verification/tests
- Focused scanner/preflight tests: `npm test -- packages/lms/src/external-scanner.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-external-scanner-live-preflight.test.ts` - PASS (`44` passed).
- `node --check scripts/lms-external-scanner-live-preflight.mjs` - PASS.
- Dry-run scanner preflight with temp evidence root: `npm run accept:lms:external-scanner -- --dry-run` plus
  `node scripts/scan-lms-db-e2e-artifacts.mjs <temp-root>` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- Initial `npm run governance:check` - PASS (0 errors / 1 known warning).
- Initial `npm run secret:scan` - PASS.
- Initial `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers).
- `node scripts/gates.mjs full` - PASS (9/9 gates).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (0 errors / 1 known warning; 5 cited per-agent handoffs all present).
- NOT RUN: live external scanner acceptance, live S3/R2 upload/download/delete/reconcile acceptance, DB-backed LMS browser acceptance, cleanup/reconcile live acceptance, public upload rollout.
## Next actions
- Run `npm run accept:lms:external-scanner -- --live` only when an operator-approved scanner endpoint/token and safe corpus are supplied, then scan `logs/lms-external-scanner-preflight`.
- Run live S3/R2 acceptance with operator-approved throwaway bucket credentials.
- Run `npm run e2e:lms:db` or managed equivalent when throwaway DB credentials are supplied.
- Add live worker cleanup/reconcile acceptance only after object-store and scanner live gates are green.
