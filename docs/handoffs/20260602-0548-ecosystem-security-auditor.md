# ecosystem-security-auditor handoff
## Scope
Phase 3.35 read-only security audit for shared LMS object-store primitives after Phase 3.34. Scope: shared S3/R2 signing/config primitives, no secret/key/signature leaks, fail-closed configuration, audit/log/admin projection boundaries, and generated-artifact scanning. No product code, tests, migrations, or docs were edited outside this required handoff artifact.

## Files inspected
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/object-storage.test.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/materials.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/audit/src/redact.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/admin-health-detail.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/IMPLEMENTED_FILES.md`

## Files changed
None - read-only audit. This handoff artifact only.

## Findings
1. Severity: High. Current source now has the shared LMS object-store primitive in `@wtc/lms` and both web and worker consume it, so the earlier duplicate-SigV4 risk is largely closed in the current worktree. Evidence: `packages/lms/src/object-storage.ts:19`-`40` centralizes object-store config parsing, `packages/lms/src/object-storage.ts:112`-`150` signs PUT, `packages/lms/src/object-storage.ts:152`-`186` signs DELETE, and `packages/lms/src/object-storage.ts:188`-`222` signs short-lived read URLs. Web imports the shared builders at `apps/web/src/features/lms/material-storage.ts:3`-`19` and calls them for PUT/DELETE/read redirect at `apps/web/src/features/lms/material-storage.ts:172`-`204` and `apps/web/src/features/lms/material-storage.ts:300`-`312`. Worker imports the same shared DELETE builder at `apps/worker/src/lms-object-cleanup.ts:1`-`9` and calls it at `apps/worker/src/lms-object-cleanup.ts:31`-`44`. Recommendation: keep all SigV4, object URL, config parsing, and opaque-key validation in `packages/lms/src/object-storage.ts`; do not reintroduce app-local `createHmac`, `signCanonicalRequest`, `awsEncode`, or `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim()` code. Target part: shared LMS object-store primitive boundary.

2. Severity: High. The shared primitive necessarily constructs secret-bearing request objects and signed redirect URLs; those values are safe only while they remain wire-only. Evidence: `LmsObjectStorageRequest` carries `url` and `headers` at `packages/lms/src/object-storage.ts:14`-`17`; PUT and DELETE builders return an `authorization` header containing `AWS4-HMAC-SHA256 Credential=... Signature=...` at `packages/lms/src/object-storage.ts:141`-`148` and `packages/lms/src/object-storage.ts:178`-`184`; read URLs include `X-Amz-Credential` and `X-Amz-Signature` at `packages/lms/src/object-storage.ts:200`-`222`. Web keeps these values inside fetch calls and 302 `Location` only at `apps/web/src/features/lms/material-storage.ts:181`-`187`, `apps/web/src/features/lms/material-storage.ts:198`-`204`, and `apps/web/src/features/lms/material-download.ts:91`-`95`; worker keeps DELETE headers inside fetch at `apps/worker/src/lms-object-cleanup.ts:36`-`44`. Recommendation: never log, audit, return in JSON, render, snapshot, or persist `LmsObjectStorageRequest`, signed read URLs, object URLs, request headers, or config objects; future fetch helper wrappers must accept an injected `fetch` and return only success/failure categories. Target part: web/worker executor boundaries.

3. Severity: High. Fail-closed config is implemented in both `@wtc/config` and the shared object-store parser, with redacted generic errors. Evidence: `packages/config/src/env.ts:62`-`73` declares LMS storage/scanner env, `packages/config/src/env.ts:105`-`121` requires all S3/R2 values plus HTTPS endpoint when `LMS_FILE_STORAGE_PROVIDER=s3-r2`, and `packages/config/src/env.ts:136`-`143` blocks public production uploads unless object storage plus external scanner are configured. The shared parser rejects missing values, non-HTTPS endpoints, credentials/query/hash/path on endpoint URLs, and invalid bucket/region with only `lms_object_storage_config_required` at `packages/lms/src/object-storage.ts:19`-`40`. Tests assert missing object config does not print the object secret at `packages/config/src/env.test.ts:108`-`127`, reject HTTP endpoints at `packages/config/src/env.test.ts:144`-`157`, and enforce production public-upload fences at `packages/config/src/env.test.ts:235`-`307`. Recommendation: keep config errors generic; do not include endpoint, bucket, access key id, secret key, scanner endpoint, scanner token, or provider response bodies in thrown errors, health details, audits, or UI. Target part: config/error handling.

4. Severity: Medium. No-leak test coverage is strong for local/mocked paths, but live S3/R2 signature compatibility is still unproven. Evidence: package tests verify fail-closed config, signed PUT/DELETE shape, bounded read URL expiry, no secret in Authorization/read URLs, and opaque-key rejection at `packages/lms/src/object-storage.test.ts:18`-`77`; the static guard prevents app-local SigV4 reintroduction at `tests/integration/lms-object-storage-shared-static.test.ts:7`-`32`; focused storage tests verify upload/download/compensation no-secret behavior at `tests/integration/lms-material-storage.test.ts:132`-`185` and `tests/integration/lms-material-storage.test.ts:290`-`317`. These tests do not verify signatures against a live S3/R2 verifier or known SigV4 reference vectors. Recommendation: before live object-store acceptance, add deterministic SigV4 reference-vector tests or a local S3-compatible verifier, then run a throwaway-bucket PUT/GET/DELETE/reconcile acceptance with retained artifacts scanned. Target part: live S3/R2 acceptance and cryptographic compatibility.

5. Severity: Medium. Signed redirects intentionally put `X-Amz-*` material in the HTTP `Location` header, so retained network traces remain a sensitive artifact boundary even when app audit logs are clean. Evidence: `buildLmsObjectReadUrl()` emits `X-Amz-Algorithm`, `X-Amz-Credential`, `X-Amz-Expires`, and `X-Amz-Signature` at `packages/lms/src/object-storage.ts:200`-`222`; the download handler returns that URL as a 302 `Location` after auth/access/row resolution/audit at `apps/web/src/features/lms/material-download.ts:80`-`95`; tests assert audit rows do not contain the signed URL, storage key, `X-Amz-Signature`, filename, MIME field, hash, or file body at `tests/integration/lms-material-download-handler.test.ts:229`-`277`. Recommendation: DB/browser/e2e runs that exercise signed redirects must either avoid retaining raw network traces or must always run the artifact scanner before archiving. Target part: Playwright/e2e artifact retention policy.

6. Severity: Medium. Worker health and cleanup audit are count-only and do not leak object keys or object-store secrets in current tests. Evidence: worker object cleanup attempts signed DELETEs and treats 404 as reconciled at `apps/worker/src/lms-object-cleanup.ts:31`-`44`, `apps/worker/src/lms-object-cleanup.ts:47`-`81`, and `apps/worker/src/lms-object-cleanup.ts:84`-`115`. Worker tests assert DELETE Authorization does not contain the object-store secret and that health details omit object-key suffixes and the object-store secret at `tests/integration/worker-tortila-snapshot.test.ts:212`-`244`; cleanup audit assertions omit material IDs, filenames, object-key suffixes, and content hashes at `tests/integration/worker-tortila-snapshot.test.ts:246`-`263`; pending cleanup health/audit omits cleanup task IDs, object-key suffixes, and the object-store secret at `tests/integration/worker-tortila-snapshot.test.ts:320`-`350`. Recommendation: preserve the count-only health/audit contract; do not add per-object worker log lines or provider response text. Target part: worker logging/health/audit.

7. Severity: Medium. Generated-artifact scanning covers the right leak classes and currently passes on existing artifacts. Evidence: deny rules include storage DTO fields, raw `lms/materials/` keys, `X-Amz-Algorithm`, `X-Amz-Credential`, `X-Amz-Signature`, legacy `AWSAccessKeyId`, scanner endpoint/token assignments, cookies, auth headers, bearer/basic auth, and DB URL assignments at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`54`; the scanner reports only file/category summaries and exits nonzero on failures at `scripts/scan-lms-db-e2e-artifacts.mjs:166`-`178`; tests cover signed object URL tokens, raw cleanup evidence, pending-upload cleanup evidence, dynamic marker redaction, and non-printing of matched secret values at `tests/integration/lms-db-e2e-artifact-scan.test.ts:72`-`151`. Direct run in this audit passed: `2` text files, `68` images, `0` blocked containers, `2` missing roots, `70` total artifact files, `0` dynamic markers. Recommendation: keep this scanner in every LMS DB browser/object-storage evidence path and expand it if future providers introduce new signed-query/header names. Target part: artifact retention gates.

8. Severity: Low. Status/implemented docs still describe shared object-store primitives as open even though current source and focused tests show the shared primitive has been added and adopted. Evidence: `docs/STATUS.md:20`, `docs/IMPLEMENTED_FILES.md:21`, `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`, and `docs/ACCEPTANCE_MATRIX_MASTER.md:127` still list shared object-store primitives as remaining/open; current source contradicts that via `packages/lms/src/object-storage.ts:19`-`222`, `apps/web/src/features/lms/material-storage.ts:3`-`19`, and `apps/worker/src/lms-object-cleanup.ts:1`-`9`. Recommendation: the foreground operator should reconcile docs/aggregate handoff after all Phase 3.35 read-only agents are collected; keep live S3/R2, live scanner, DB browser acceptance, and public rollout marked open. Target part: phase status documentation.

## Decisions
- `packages/lms/src/object-storage.ts` is the correct shared home for LMS-specific S3/R2 config parsing, opaque key URL construction, and SigV4 request signing.
- The shared primitive may return wire-ready `url`/`headers`, but those values are forbidden outside immediate fetch/302 response construction.
- `accessKeyId`, `secretAccessKey`, `Authorization`, `X-Amz-*`, object URLs, raw `lms/materials/...` keys, cleanup task IDs, filenames, hashes, scanner endpoint/token values, provider response bodies, and raw errors are forbidden in logs, audits, health details, UI, generated docs, and retained artifacts.
- Existing app-level orchestration stays in web/worker: auth, entitlement checks, durable pre-PUT cleanup task creation, DB transactions, audit rows, retry/dead-letter accounting, and health summaries.
- Current local/mocked evidence is not live object-store acceptance.

## Risks
- A future consumer could serialize `LmsObjectStorageRequest` or signed read URLs into logs or artifacts unless static guards and artifact scanner rules remain mandatory.
- S3/R2 compatibility remains unproven until deterministic SigV4 reference-vector tests or live throwaway-bucket verification run.
- Retained Playwright/network traces can capture signed redirect `Location` headers; this is controlled by scanner policy, not by the app response alone.
- Docs currently lag the source on the shared primitive status, which can cause phase readiness confusion if not reconciled by the operator.

## Verification/tests
- RUN: `npm run typecheck -w @wtc/web` - PASS.
- RUN: `npm run typecheck -- --pretty false` - PASS.
- RUN: `npm test -- packages/lms/src/object-storage.test.ts tests/integration/lms-object-storage-shared-static.test.ts tests/integration/lms-material-storage.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts packages/config/src/env.test.ts tests/integration/admin-health-detail.test.ts tests/integration/admin-lms-cleanup-review.test.ts` - PASS, 8 files / 71 tests. The printed `artifact scan failed` blocks are expected negative-fixture assertions inside the passing scanner test file.
- RUN: `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS, `2` text files, `68` images, `0` blocked containers, `2` missing roots, `70` total artifact files, `0` dynamic markers.
- RUN: `npm run secret:scan` - PASS.
- NOT RUN: `node scripts/gates.mjs full`.
- NOT RUN: `node scripts/gates.mjs e2e`.
- NOT RUN: `npm run e2e:lms:db` / `npm run e2e:lms:db:managed` because no fresh `LMS_E2E_DATABASE_URL` or `LMS_E2E_ADMIN_DATABASE_URL` was supplied.
- NOT RUN: live S3/R2 upload/download/delete/reconcile acceptance.
- NOT RUN: live external malware-scanner acceptance.
- NOT RUN: public upload rollout.

## Next actions
1. Reconcile phase docs/aggregate status so shared object-store primitives are no longer listed as open once Phase 3.35 is accepted.
2. Add deterministic SigV4 reference-vector coverage or a local S3-compatible verifier before claiming live object-store compatibility.
3. Run full/e2e/governance gates after the foreground operator collects all Phase 3.35 handoffs.
4. Keep artifact scanning mandatory for any DB browser or signed-redirect evidence bundle.
5. Proceed to live throwaway S3/R2 and external scanner acceptance only after operator-approved credentials and artifact retention rules are in place.
