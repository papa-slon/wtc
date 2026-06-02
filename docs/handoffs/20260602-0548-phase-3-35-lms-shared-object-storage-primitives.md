# Phase 3.35 LMS shared object-storage primitives handoff
## Scope
Extract duplicated local S3/R2 object-store request construction and SigV4 signing from the web and worker app files into a shared `@wtc/lms` package boundary. This phase does not run live S3/R2, live external scanner, DB-backed LMS browser acceptance, or public upload rollout.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0548-ecosystem-platform-architect.md](20260602-0548-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-0548-ecosystem-security-auditor.md](20260602-0548-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0548-ecosystem-backend-implementer.md](20260602-0548-ecosystem-backend-implementer.md)
- [docs/handoffs/20260602-0548-ecosystem-tests-runner.md](20260602-0548-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-0548-ecosystem-devops-implementer.md](20260602-0548-ecosystem-devops-implementer.md)

Background agents were collected before implementation completion. After the context transition, cleanup was attempted for all
five agent IDs; `close_agent` returned `not found` for each ID, leaving no closable background-agent handle in the current tool
context.
## Files inspected
- `apps/web/src/features/lms/material-storage.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/package.json`
- `apps/web/package.json`
- `apps/worker/package.json`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
## Files changed
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/object-storage.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- current docs and this handoff set.
## Findings
1. High - Web and worker duplicated object-store config parsing, object path building, and SigV4 signing. Implemented: `packages/lms/src/object-storage.ts` owns config validation and signed PUT/DELETE/read URL request builders. Target part: shared LMS package boundary.
2. High - Worker cleanup was the drift risk because it had its own DELETE signing path. Implemented: worker cleanup now uses `readLmsObjectStorageConfig()` and `buildLmsObjectDeleteRequest()` from `@wtc/lms`. Target part: worker cleanup.
3. Medium - Web upload/download/compensation should keep fetch/error semantics but stop owning signing. Implemented: web storage now uses shared PUT, DELETE, and read URL builders while preserving `lms_object_storage_write_failed`, `lms_object_storage_delete_failed`, and redirect behavior. Target part: web LMS storage.
4. Medium - Shared package helpers should stay pure and not read ambient env, DB, audit, logs, React, Next, or `@wtc/config`. Implemented: helpers accept explicit env/config inputs and return URL/header values only. Target part: package purity.
5. Medium - Future drift needs a machine guard. Implemented: package-level object-storage tests plus static app-source guard prevent SigV4 code returning to web/worker files. Target part: tests.
## Decisions
- Use `@wtc/lms` rather than creating a new `@wtc/object-storage` package because the only real consumers are LMS web/worker paths.
- Keep app-level `fetch` in web/worker; shared helpers only construct signed requests/URLs.
- Keep signed URL/header/token material out of audit, health, logs, docs, and retained artifacts.
## Risks
- Live S3/R2 signature behavior is still unobserved.
- Signed redirect artifact retention remains a production rollout risk until live/browser artifact evidence is scanned.
- Client components must not import the server-side object-storage helper path; current scan found no `use client` file importing `@wtc/lms`.
## Verification/tests
- Focused Phase 3.35 tests: `npm test -- packages/lms/src/object-storage.test.ts tests/integration/lms-material-storage.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-object-storage-shared-static.test.ts` - PASS (`24` passed).
- Broader focused LMS/config/worker/scanner tests: `npm test -- packages/lms/src/object-storage.test.ts tests/integration/lms-material-storage.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-object-storage-shared-static.test.ts tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts packages/config/src/env.test.ts` - PASS (`73` passed).
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run worker:smoke` - PASS.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- Initial `npm run governance:check` - PASS (0 errors / 1 known warning).
- Initial `npm run secret:scan` - PASS.
- `node scripts/gates.mjs full` - PASS (9/9).
- `node scripts/gates.mjs e2e` - PASS (`44` passed).
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS (`2` text files, `68` images, `0` blocked containers).
- Final `npm run secret:scan` - PASS.
- Final `npm run governance:check` - PASS (0 errors / 1 known warning).
- NOT RUN: live S3/R2 upload/download/delete/reconcile acceptance, live external scanner acceptance, DB-backed LMS browser acceptance, public upload rollout.
## Next actions
- Run live S3/R2 upload/download/delete/reconcile acceptance with operator-approved throwaway bucket credentials.
- Run live external scanner acceptance with operator-approved endpoint/token and safe corpus.
- Run `npm run e2e:lms:db` or managed equivalent when throwaway DB credentials are supplied.
- Define a safe dead-letter acknowledgement/retry workflow before public uploads.
