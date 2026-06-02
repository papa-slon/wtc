# ecosystem-backend-implementer handoff
## Scope
Phase 3.35 read-only backend audit of shared S3/R2 object-store helpers for LMS upload, signed download, upload compensation, expired-material cleanup, and pending-upload cleanup. Inspect current code and tests; do not edit product code. Recommend concrete helper signatures and migration path.
## Files inspected
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/material-create-compensation.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
## Files changed
- `docs/handoffs/20260602-0548-ecosystem-backend-implementer.md`
## Findings
1. Severity: High. The shared helper location already exists and is the right package boundary. Evidence: `@wtc/lms` exports `object-storage.ts` from `packages/lms/src/index.ts:13-19`, and the helper owns LMS-specific key validation, S3/R2 config parsing, URL construction, PUT signing, DELETE signing, and signed-read URL generation at `packages/lms/src/object-storage.ts:19-40`, `packages/lms/src/object-storage.ts:52-55`, `packages/lms/src/object-storage.ts:112-150`, `packages/lms/src/object-storage.ts:152-186`, and `packages/lms/src/object-storage.ts:188-222`. Recommendation: keep the shared helpers in `@wtc/lms`, not `@wtc/shared`, because they depend on LMS material-key rules and are not a general storage API. Target part: package boundary.

2. Severity: High. The current web LMS storage path is already migrated to the shared request builders while retaining app-level fetch/error semantics. Evidence: `apps/web/src/features/lms/material-storage.ts:3-18` imports `buildLmsObjectPutRequest`, `buildLmsObjectDeleteRequest`, `buildLmsObjectReadUrl`, and `readLmsObjectStorageConfig` from `@wtc/lms`; clean object upload builds the signed PUT at `apps/web/src/features/lms/material-storage.ts:172-188`; compensation builds the signed DELETE at `apps/web/src/features/lms/material-storage.ts:190-205`; signed download uses `buildLmsObjectReadUrl()` at `apps/web/src/features/lms/material-storage.ts:291-312`. Recommendation: treat the web path as the migration model; keep `lms_object_storage_write_failed`, `lms_object_storage_delete_failed`, 404-as-reconciled, and signed redirect semantics unchanged. Target part: web LMS storage adapter.

3. Severity: High. The current worker cleanup path is also using the shared DELETE request builder, so the original drift risk is reduced. Evidence: `apps/worker/src/lms-object-cleanup.ts:1-9` imports `buildLmsObjectDeleteRequest` and `readLmsObjectStorageConfig`; `deleteLmsObjectStorageObject()` builds the signed DELETE and treats 2xx/404 as success at `apps/worker/src/lms-object-cleanup.ts:31-45`; expired material cleanup and pending upload cleanup both call that helper at `apps/worker/src/lms-object-cleanup.ts:47-81` and `apps/worker/src/lms-object-cleanup.ts:84-118`. Recommendation: add a static regression test that app files do not import `node:crypto` or implement SigV4 primitives directly. Target part: worker/web drift guard.

4. Severity: Medium. The durable upload ordering must remain outside the low-level object helper. Evidence: clean `s3-r2` upload registers `beforeObjectPut` before `putObject()` at `apps/web/src/features/lms/material-storage.ts:222-255`; the server action creates the pending cleanup task inside that hook at `apps/web/src/features/lms/actions.ts:129-150`; material creation then uses the atomic create-and-complete path with compensation fallback at `apps/web/src/features/lms/actions.ts:405-417` and `apps/web/src/features/lms/material-create-compensation.ts:17-50`. Recommendation: keep object helpers stateless and side-effect-free about DB cleanup tasks; do not hide DB writes in the shared storage package. Target part: upload lifecycle boundary.

5. Severity: Medium. Current behavior is covered indirectly, but package-level helper tests are missing. Evidence: web tests verify opaque S3/R2 PUT and signed redirect behavior at `tests/integration/lms-material-storage.test.ts:132-186`, durable pre-PUT ordering at `tests/integration/lms-material-storage.test.ts:188-228`, compensation DELETE semantics at `tests/integration/lms-material-storage.test.ts:290-317`, and signed download redaction at `tests/integration/lms-material-download-handler.test.ts:229-277`; worker tests verify DELETE before row purge, 404-as-confirmed, count-only health/audit, and pending cleanup retry/dead-letter behavior at `tests/integration/worker-tortila-snapshot.test.ts:151-220` and `tests/integration/worker-tortila-snapshot.test.ts:269-337`. There is no dedicated `packages/lms` test for `buildLmsObjectPutRequest()`, `buildLmsObjectDeleteRequest()`, or `buildLmsObjectReadUrl()`. Recommendation: add `packages/lms/src/object-storage.test.ts` with fixed-time vectors for config validation, opaque-key rejection, PUT/DELETE method headers, signed read URL TTL clamping, and no secret in returned URLs. Target part: package test coverage.

6. Severity: Medium. Config validation exists in both package helper and global env loader, but their contracts should stay aligned. Evidence: `readLmsObjectStorageConfig()` requires endpoint, bucket, region, access key, secret, HTTPS endpoint without credentials/query/fragment, and bucket/region patterns at `packages/lms/src/object-storage.ts:19-40`; `loadEnv()` separately requires the same object-store keys and HTTPS endpoint when `LMS_FILE_STORAGE_PROVIDER=s3-r2` at `packages/config/src/env.ts:105-120`; config tests assert missing settings are redacted and HTTPS settings are accepted/rejected at `packages/config/src/env.test.ts:108-156`. Recommendation: add a small package test that mirrors the env-loader cases so future config changes cannot diverge silently. Target part: config/helper contract.

7. Severity: Low. The low-level request return type is usable but slightly under-specified for cross-app callers. Evidence: `LmsObjectStorageRequest` currently exposes only `url` and `headers` at `packages/lms/src/object-storage.ts:14-17`, while web and worker wrappers provide the HTTP method themselves at `apps/web/src/features/lms/material-storage.ts:183-200` and `apps/worker/src/lms-object-cleanup.ts:38-44`. Recommendation: either keep this as a pure signing helper and enforce method in package tests, or extend the request type to include `method: 'PUT' | 'DELETE'` so wrappers cannot mismatch the signed method. Target part: helper API ergonomics.
## Decisions
- Use `@wtc/lms` as the canonical shared object-store helper package because storage keys, LMS provider constants, and hash utilities live there.
- Keep shared helpers pure and deterministic: config parse, URL build, signature build, and signed-read URL generation. Keep DB cleanup task lifecycle in `apps/web` plus `packages/db`.
- Keep app-level fetch wrappers responsible for normalized operational errors and for treating DELETE 404 as reconciled.
- Do not expose object helpers, storage keys, signed URLs, authorization headers, access key IDs, secret access keys, filenames, hashes, scanner responses, or provider bodies to client DTOs, audit payloads, health details, screenshots, or generated artifacts.
## Risks
- `LmsObjectStorageConfig` necessarily contains access key and secret values; importing these helpers into client components or UI-facing DTO code would be a serious leak risk.
- Without direct package tests, a future change in canonical query ordering, payload hash, TTL clamping, or endpoint validation could break web/worker behavior even if app-level tests miss the exact signing regression.
- If `LmsObjectStorageRequest` remains method-less, a caller can theoretically sign a DELETE request and send it with another method; current wrappers do not do that, but the type does not prevent it.
- Live S3/R2 compatibility is still unproven; all current tests use mocked `fetch`.
## Verification/tests
- `npm run typecheck -w @wtc/web` - PASS on final current state.
- `npm run typecheck` - PASS.
- `npm test -- tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-material-create-compensation.test.ts tests/integration/worker-tortila-snapshot.test.ts` - PASS, 4 files / 34 tests.
- No live S3/R2, live scanner, DB-backed browser acceptance, public rollout, full gate, e2e gate, secret scan, or governance gate was run for this read-only audit.
## Next actions
1. Add `packages/lms/src/object-storage.test.ts` covering `readLmsObjectStorageConfig()`, `buildLmsObjectStorageUrl()`, `buildLmsObjectPutRequest()`, `buildLmsObjectDeleteRequest()`, and `buildLmsObjectReadUrl()` directly.
2. Add a static integration test that fails if `apps/web/src/features/lms/material-storage.ts` or `apps/worker/src/lms-object-cleanup.ts` imports `node:crypto`, defines SigV4 helpers, or references raw `AWS4` signing primitives outside `@wtc/lms`.
3. Consider changing `LmsObjectStorageRequest` to `{ method: 'PUT' | 'DELETE'; url: URL; headers: Record<string, string> }` and update wrappers to use `request.method`.
4. Keep live S3/R2 upload/download/delete/reconcile acceptance as a separate operator-credentialed phase; do not infer provider compatibility from mocked fetch tests.
