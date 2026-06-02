# Phase 3.37 LMS object-store live preflight handoff
## Scope
Implement a local, no-live-credentials LMS S3/R2 acceptance preflight after Phase 3.36. This phase adds deterministic SigV4
golden coverage, an operator-safe dry-run-first/live-opt-in preflight command, and generated-artifact no-leak rules for future
live object-store evidence. This phase does not run live S3/R2, live external scanner, DB-backed LMS browser acceptance, or
public upload rollout.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0634-ecosystem-platform-architect.md](20260602-0634-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0634-ecosystem-security-auditor.md](20260602-0634-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0634-ecosystem-backend-implementer.md](20260602-0634-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0634-ecosystem-tests-runner.md](20260602-0634-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0634-ecosystem-devops-implementer.md](20260602-0634-ecosystem-devops-implementer.md)

All five background agents completed and were closed after their handoffs were collected.
## Files inspected
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/object-storage.test.ts`
- `packages/lms/src/index.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `packages/config/src/env.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
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
- `packages/lms/src/object-storage.test.ts`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`
- `package.json`
- `.env.example`
- current docs and this handoff set.
## Findings
1. High - Shape-only SigV4 tests were not enough before live credentials. Implemented: exact deterministic golden assertions
   for PUT, DELETE, and signed read URL construction now pin authorization headers, payload hashes, dates, signatures, and
   query ordering. Target part: `@wtc/lms` shared object-store signer.
2. High - Live S3/R2 checks had no repo-native operator-safe entry point. Implemented:
   `scripts/lms-s3-r2-live-preflight.mjs` and `accept:lms:object-storage`. Dry-run validates config, builds signed requests,
   performs no network I/O, and writes redacted summary evidence. Live mode requires explicit live and throwaway confirmation.
   Target part: live object-store preflight command boundary.
3. High - Live evidence can leak object-store credentials, signed headers, object keys, or provider bodies. Implemented:
   scanner deny rules for `LMS_OBJECT_STORAGE_*` assignments, `AWS4-HMAC-SHA256 Credential=`, `x-amz-content-sha256`,
   `x-amz-date`, S3/R2 XML provider body markers, and request-id headers. Target part: retained artifact no-leak guard.
4. High - Public upload rollout must stay separate from object-store preflight. Implemented: the preflight refuses
   `LMS_PUBLIC_UPLOADS_ENABLED=true`, docs keep public uploads disabled, and acceptance docs separate live object-store,
   live scanner, DB browser, worker cleanup/reconcile, and public rollout gates. Target part: rollout sequencing.
5. Medium - Default gates must not mutate object storage. Implemented: static tests assert the preflight command is not called
   by default `e2e`, `ci:local`, or `scripts/gates.mjs`. Target part: gate safety.
6. Medium - Redacted dry-run evidence needed a machine proof. Implemented: integration tests run dry-run against fixture env,
   assert stdout and summary omit endpoint, bucket, access key, secret, raw object key, signed query tokens, and auth material,
   then scan the generated summary with the artifact scanner. Target part: evidence retention.
## Decisions
- Keep the SigV4 implementation in `packages/lms/src/object-storage.ts`; this phase only strengthens package-level vectors and
  live harnesses around the existing shared builders.
- Keep live object-store preflight as an explicit operator command, not part of default CI, default Playwright, or full gates.
- Use `LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE=1` and `LMS_OBJECT_STORAGE_LIVE_THROWAWAY=1` as the live-mutation consent gates.
- Store only redacted count/status summary evidence under `logs/lms-s3-r2-preflight`; raw URLs, keys, headers, signed queries,
  provider bodies, and secrets remain wire-only.
- Keep Phase 3.37 local-only unless the operator supplies throwaway credentials in a later phase.
## Risks
- Deterministic SigV4 golden vectors reduce canonicalization drift risk but still do not prove bucket credentials, policy,
  endpoint reachability, or provider-specific behavior.
- The live preflight is package/object-level only. It does not prove external scanner behavior, DB browser upload/download,
  worker cleanup/reconcile under live storage, or public upload rollout.
- A future live run can still fail after object creation; the script treats cleanup uncertainty as failure and reports only
  redacted counts.
## Verification/tests
- Focused LMS/storage/preflight tests: `npm test -- packages/lms/src/object-storage.test.ts tests/integration/lms-object-storage-shared-static.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-material-create-compensation.test.ts tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-object-storage-live-preflight.test.ts packages/config/src/env.test.ts` - PASS (`103` passed).
- `node --check scripts/lms-s3-r2-live-preflight.mjs` - PASS.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- Initial `npm run secret:scan` - PASS.
- Initial `npm run governance:check` - PASS (0 errors / 1 known warning).
- Initial `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers).
- `node scripts/gates.mjs full` - PASS (9/9).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- Final `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (0 errors / 1 known warning).
- NOT RUN: live S3/R2 upload/download/delete/reconcile acceptance, live external scanner acceptance, DB-backed LMS browser acceptance, public upload rollout.
## Next actions
- Run `npm run accept:lms:object-storage -- --live` only when operator-approved throwaway S3/R2 credentials are supplied, then scan `logs/lms-s3-r2-preflight`.
- Run live external scanner acceptance with operator-approved endpoint/token and safe corpus.
- Run `npm run e2e:lms:db` or managed equivalent when throwaway DB credentials are supplied.
- Add live worker cleanup/reconcile acceptance only after object-store preflight and scanner gates are green.
