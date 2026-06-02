# Phase 3.29 LMS S3/R2 object-storage boundary handoff
## Scope
Implement the next local LMS production-storage boundary slice after read-only agent dispatch: add an explicit S3/R2-compatible `s3-r2` provider, fail-closed object-store config, mocked SigV4 upload coverage, bytes-or-signed-redirect download delivery, upload authorization ordering before external writes, signed-URL artifact scanner rules, and current docs. No live object-store credentials or production services were used.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-0317-ecosystem-education-implementer.md](20260602-0317-ecosystem-education-implementer.md)
- [docs/handoffs/20260602-0317-ecosystem-devops-implementer.md](20260602-0317-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-0317-ecosystem-security-auditor.md](20260602-0317-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-0317-ecosystem-tests-runner.md](20260602-0317-ecosystem-tests-runner.md)

All four background agents were closed after their results were collected.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `packages/lms/src/materials.ts`; `packages/lms/src/materials.test.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `tests/integration/lms-db-e2e-harness.test.ts`; `tests/integration/db-lms-ph3-1.test.ts`; `.env.example`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; `docs/DEPLOYMENT.md`; `docs/IMPLEMENTED_FILES.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/EDUCATION_LMS_PLAN.md`.
## Files changed
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/actions.ts`
- `packages/db/src/repositories.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `.env.example`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260602-0317-ecosystem-education-implementer.md`
- `docs/handoffs/20260602-0317-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0317-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0317-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0317-phase-3-29-lms-s3-r2-object-storage-boundary.md`
## Findings
1. High - The LMS storage provider model needed an explicit object-store provider. Implemented: `LMS_OBJECT_STORAGE_PROVIDER = 's3-r2'`, typed config support, `.env.example` placeholders, and env tests requiring HTTPS endpoint, bucket, region, access key id, and secret access key. Target part: LMS/config provider boundary.
2. High - Adding config without runtime behavior would be fake integration. Implemented: `storeLmsUploadedFile()` can PUT to a path-style S3/R2-compatible endpoint using SigV4, returns metadata-only object rows, and hides secrets/signed details behind generic errors. Target part: storage adapter.
3. High - Byte-only downloads could not support private object storage. Implemented: `resolveLmsMaterialFileDelivery()` returns either bytes or redirect; the handler returns a no-body `302` with `private, no-store`, `no-referrer`, and `nosniff` after successful resolution/audit. Target part: download handler.
4. High - External object writes before ownership checks could orphan objects. Implemented: `createMaterialAction()` now obtains DB, verifies lesson/course match, and checks course ownership before preparing file storage. Target part: upload action sequencing.
5. Medium - Durable rows should not accept arbitrary storage-provider typos. Implemented: repository inserts validate supported providers and require opaque keys for `fs-local`/`s3-r2` object-style rows. Target part: DB repository validation.
6. Medium - Retained artifact evidence needed signed URL token guards. Implemented: scanner rejects `X-Amz-Algorithm`, `X-Amz-Credential`, `X-Amz-Signature`, and `AWSAccessKeyId`; scanner/harness tests pin those rules. Target part: artifact scanner.
## Decisions
- Keep `db-local` as the default local/dev provider and keep `fs-local` behavior intact.
- Treat `s3-r2` as local contract acceptance only in this phase; mocked upload/signing tests are not live object-store acceptance.
- Keep `LMS_PUBLIC_UPLOADS_ENABLED=false` by default, and allow production public uploads in config only when provider is `s3-r2` and scanner mode is `external`.
- Do not implement external malware scanning or object-store cleanup/reconciliation in this slice.
- Do not run DB browser or live object-store gates without fresh throwaway DB URLs and operator-approved object-store credentials.
## Risks
- Live S3/R2 endpoint behavior may differ from the path-style mocked boundary and still needs credentialed acceptance.
- Signed URLs intentionally appear in `Location` during successful remote delivery; retained traces/HAR/logs must be scanned or excluded to avoid leaking query signatures.
- Object-store rows can be orphaned by future delete paths until a delete/reconciliation worker is implemented.
- Local signature scanning is not a production malware-scanning engine.
- This directory is not git-backed in this session, so no commit/branch evidence exists here.
## Verification/tests
RUN:
- `npm test -- packages/lms/src/materials.test.ts packages/config/src/env.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/db-lms-ph3-1.test.ts` - PASS, 7 files / 82 tests.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `node scripts/gates.mjs full` - PASS, 9/9 gates: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, build.
- `node scripts/gates.mjs e2e` with LMS DB env vars cleared - PASS, 44 passed.
- `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, 2 text files, 68 images, 0 blocked containers, 2 missing roots, 70 total artifact files, 0 dynamic markers.
- `npm run secret:scan` after docs/handoffs - PASS.
- `npm run governance:check` after aggregate handoff - PASS, 0 errors / 1 known historical warning.

NOT RUN:
- `npm run e2e:lms:db` - not run because no fresh `LMS_E2E_DATABASE_URL` was supplied.
- `npm run e2e:lms:db:managed` - not run because no `LMS_E2E_ADMIN_DATABASE_URL` was supplied.
- Live S3/R2 upload/download/delete/reconcile acceptance - not run because no operator-approved endpoint/bucket/region/access key/secret key was supplied.
- External malware scanner acceptance - not run because no scanner provider/config exists.
- Production public upload rollout with `LMS_PUBLIC_UPLOADS_ENABLED=true` - not run because live object storage, external scanner, object cleanup, and production acceptance are still open.
## Next actions
1. With operator-approved throwaway object-store credentials, add/run a live S3/R2 upload/download acceptance gate that never uses production secrets and never archives signed URLs unscanned.
2. Implement an external malware scanner adapter and fail-closed quarantine workflow before enabling public uploads.
3. Implement object-store delete/reconciliation cleanup with count-only logs/audits and no object-key leakage.
4. Run `npm run e2e:lms:db` or `npm run e2e:lms:db:managed` when a fresh throwaway/admin DB URL is available.
5. Keep `LMS_PUBLIC_UPLOADS_ENABLED=false` until live object-store, external scanner, cleanup, and browser acceptance gates are observed green.
