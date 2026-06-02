# ecosystem-backend-implementer handoff
## Scope
Phase 3.37 read-only backend/package audit for deterministic SigV4/reference-vector coverage and a safe live S3/R2 acceptance harness. Scope covered the shared LMS object-storage signer, current mocked package/integration tests, web material upload/download object-store callers, worker cleanup object-store callers, existing LMS DB/artifact harness patterns, and current deployment/acceptance docs. No product code edits were allowed.
## Files inspected
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/object-storage.test.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/index.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `.env.example`
- `package.json`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260602-0548-phase-3-35-lms-shared-object-storage-primitives.md`
## Files changed
None — read-only audit
## Findings
1. Severity: High. Evidence: `packages/lms/src/object-storage.ts:81`-`packages/lms/src/object-storage.ts:110` owns canonical-request signing and `packages/lms/src/object-storage.ts:112`-`packages/lms/src/object-storage.ts:223` builds PUT, DELETE, and presigned read requests, but `packages/lms/src/object-storage.test.ts:26`-`packages/lms/src/object-storage.test.ts:70` only asserts shape, header presence, bounded expiry, and secret absence. There is no exact expected Authorization header, canonical query, read URL, or signature value. Recommendation: extend `packages/lms/src/object-storage.test.ts` with deterministic reference-vector cases for PUT, DELETE, and GET/read URL using fixed endpoint, bucket, region, access key, secret, storage key, payload, MIME, content disposition, and timestamp; assert exact URL/query order, `x-amz-date`, payload hash, signed headers, Authorization string, and read URL signature. Target part: package-level SigV4 correctness.
2. Severity: High. Evidence: the shared signer is now centralized in `@wtc/lms` (`packages/lms/src/object-storage.ts:1`-`packages/lms/src/object-storage.ts:223`) and app callers delegate to it (`apps/web/src/features/lms/material-storage.ts:172`-`apps/web/src/features/lms/material-storage.ts:204`, `apps/web/src/features/lms/material-storage.ts:300`-`apps/web/src/features/lms/material-storage.ts:312`, `apps/worker/src/lms-object-cleanup.ts:31`-`apps/worker/src/lms-object-cleanup.ts:45`), but no test cross-checks those signatures against an independent implementation or reference fixture. Recommendation: add a small checked-in fixture block inside the package test or a fixture module such as `packages/lms/src/object-storage.reference.test.ts`; generate expected values once from an independent AWS SigV4 S3 reference implementation or official S3 SigV4 examples, then keep runtime code free of SDK dependencies. Acceptance semantics: the test must fail on any byte-level canonicalization drift in method, URI, query sorting/encoding, canonical headers, signed headers, payload hash mode, credential scope, or final signature. Target part: deterministic no-network reference coverage.
3. Severity: High. Evidence: root scripts currently expose default quality gates, worker smoke, and DB browser harnesses at `package.json:11`-`package.json:32`, while no script exists for live object-store acceptance. Deployment docs also state that S3/R2, scanner, and cleanup adapters have only local mocked coverage and no live upload/download/delete/reconcile acceptance (`docs/DEPLOYMENT.md:69`-`docs/DEPLOYMENT.md:85`). Recommendation: add a dedicated opt-in script, proposed entry point `npm run accept:lms:object-storage` -> `node --experimental-strip-types scripts/run-lms-object-storage-live.ts`, and keep it out of `npm run e2e`, `node scripts/gates.mjs full`, and `ci:local`. Target part: safe live acceptance harness entry point.
4. Severity: High. Evidence: `.env.example:29`-`.env.example:37` documents S3/R2 credentials and `.env.example:43` keeps public uploads disabled, while `packages/config/src/env.ts:105`-`packages/config/src/env.ts:120` only validates required object-store config when `LMS_FILE_STORAGE_PROVIDER=s3-r2`; there is no separate live-acceptance opt-in guard. Recommendation: the live harness must refuse to run unless `LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE=1` is set, all `LMS_OBJECT_STORAGE_*` vars pass `readLmsObjectStorageConfig()`, and the operator supplies a throwaway/private acceptance bucket or prefix that the script will mutate. It must also print a redacted preflight summary and require no `LMS_PUBLIC_UPLOADS_ENABLED=true`. Target part: live-mutation safety.
5. Severity: High. Evidence: object-store live behavior remains explicitly separate from local implementation in `docs/ACCEPTANCE_MATRIX_MASTER.md:91`-`docs/ACCEPTANCE_MATRIX_MASTER.md:97`, `docs/ACCEPTANCE_MATRIX_MASTER.md:105`-`docs/ACCEPTANCE_MATRIX_MASTER.md:112`, and `docs/ACCEPTANCE_MATRIX_MASTER.md:144`-`docs/ACCEPTANCE_MATRIX_MASTER.md:149`. Recommendation: live harness acceptance should be exact and narrow: create one opaque `lms/materials/<runId>` object, PUT known non-secret bytes with `buildLmsObjectPutRequest()`, fetch a presigned read URL from `buildLmsObjectReadUrl()` and assert 2xx plus exact body, DELETE with `buildLmsObjectDeleteRequest()` and require 2xx/204, assert a post-delete presigned GET is non-2xx/not found, and perform a cleanup DELETE that treats 2xx/204/404 as reconciled. Any network error, 403 signature mismatch, body mismatch, unexpected 2xx after delete, or secret-bearing output is FAIL. Target part: live S3/R2 upload/download/delete semantics.
6. Severity: Medium. Evidence: web upload currently scans, creates a durable pending cleanup row before object PUT, then calls shared signed PUT (`apps/web/src/features/lms/actions.ts:129`-`apps/web/src/features/lms/actions.ts:150`, `apps/web/src/features/lms/material-storage.ts:251`-`apps/web/src/features/lms/material-storage.ts:255`), and worker cleanup uses shared signed DELETE for expired materials and pending upload tasks (`apps/worker/src/lms-object-cleanup.ts:47`-`apps/worker/src/lms-object-cleanup.ts:118`). Recommendation: after the minimal package live harness is green, add optional PGlite-backed live integration coverage in the same script or a second script: seed only local throwaway rows, create a live object with the shared PUT builder, run `reconcilePendingLmsObjectCleanupTasks()` or `deleteLmsObjectStorageObject()`, and assert count-only results plus remote deletion. This remains package/backend acceptance, not public browser rollout. Target part: live cleanup/reconcile acceptance.
7. Severity: Medium. Evidence: generated-artifact scanning rejects signed object URL tokens such as `X-Amz-Signature` (`scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:30`) and DB runner docs require scanner-passed artifacts before archiving (`docs/DEPLOYMENT.md:122`-`docs/DEPLOYMENT.md:140`). Recommendation: the live S3/R2 harness must not archive raw URLs, Authorization headers, object keys, response bodies, scanner endpoints, bucket URLs, or credentials. It should write only a redacted summary such as operation names, HTTP status class, byte count, SHA-256 of the test body if needed, provider label `s3-r2`, and PASS/FAIL. If any raw signed URL/query/header/key is printed, the phase should fail the artifact scan. Target part: evidence retention/no-leak policy.
8. Severity: Medium. Evidence: current mocked web tests check signed PUT/read redirect/delete shape and secret absence (`tests/integration/lms-material-storage.test.ts:132`-`tests/integration/lms-material-storage.test.ts:186`, `tests/integration/lms-material-storage.test.ts:290`-`tests/integration/lms-material-storage.test.ts:317`), worker tests check mocked DELETE cleanup shape and no-leak health/audit payloads (`tests/integration/worker-tortila-snapshot.test.ts:155`-`tests/integration/worker-tortila-snapshot.test.ts:271`, `tests/integration/worker-tortila-snapshot.test.ts:273`-`tests/integration/worker-tortila-snapshot.test.ts:416`), and static tests prevent SigV4 duplication in app files (`tests/integration/lms-object-storage-shared-static.test.ts:7`-`tests/integration/lms-object-storage-shared-static.test.ts:33`). Recommendation: keep these as required local gates, but do not treat them as live acceptance; add static tests that root `package.json` contains the opt-in live script and that `scripts/gates.mjs`/default `e2e`/`ci:local` do not invoke it. Target part: gate honesty and default safety.
## Decisions
- Keep SigV4 implementation in `packages/lms/src/object-storage.ts`; do not reintroduce HMAC/signing helpers into web or worker app files.
- Add deterministic reference-vector coverage at package-test level before any live S3/R2 acceptance claim.
- Make live S3/R2 acceptance an explicit operator-approved script, not part of default gates or CI.
- Keep live harness evidence redacted and count/status-only; never retain raw signed URLs, Authorization headers, object keys, or secrets.
- Treat package-level live PUT/read/DELETE as the minimum object-store gate; treat DB worker cleanup/reconcile and public browser rollout as separate observed gates.
## Risks
- Current shape-only SigV4 tests can pass with a canonicalization bug that real S3/R2 rejects with 403/signature mismatch.
- A live harness without a hard opt-in flag or throwaway bucket/prefix guard could mutate non-test object storage.
- Capturing HAR, stdout, or debug logs from signed redirects can leak `X-Amz-Signature`, credential scope, object locators, or Authorization headers.
- A package-only live harness proves signer/storage liveness but not the full teacher upload, entitlement-checked download, external scanner, DB browser, or public upload rollout paths.
- Cloudflare R2 and AWS S3 may differ in delete/read-after-delete status details; acceptance must be precise enough to catch signature failures while allowing documented 404/already-absent cleanup semantics.
## Verification/tests
- Not run; this was a read-only audit.
- Recommended focused tests after implementation:
  - `npm test -- packages/lms/src/object-storage.test.ts tests/integration/lms-object-storage-shared-static.test.ts tests/integration/lms-material-storage.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts packages/config/src/env.test.ts`
  - Add and include the new live-harness static guard test if created separately.
- Recommended live acceptance command only when operator provides throwaway S3/R2 credentials:
  - `npm run accept:lms:object-storage`
- Required semantics for reporting the live gate as RUN: opt-in flag set, redacted preflight printed, PUT/read/DELETE/post-delete checks all exit 0 against the throwaway bucket/prefix, no raw signed URLs/headers/keys/secrets retained, final secret scan and artifact scan pass, and docs list DB browser/live scanner/public rollout separately unless they were also observed.
- Gates still required before claiming a Phase 3.37 implementation green: root typecheck, web typecheck, lint, worker smoke, `npm run db:generate -w @wtc/db`, focused Vitest, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, artifact scan, secret scan, and governance.
## Next actions
1. Add deterministic exact-vector tests to `packages/lms/src/object-storage.test.ts` for PUT, DELETE, and presigned read URL.
2. Add `scripts/run-lms-object-storage-live.ts` and `accept:lms:object-storage` as an opt-in script that refuses to run without `LMS_OBJECT_STORAGE_LIVE_ACCEPTANCE=1` and throwaway S3/R2 config.
3. Add static tests proving the live script is present but excluded from default gates, `e2e`, and `ci:local`.
4. Run the focused local test command and full local gates.
5. Only with operator-approved throwaway credentials, run `npm run accept:lms:object-storage`, retain redacted evidence only, then update current status/docs to separate live object-store acceptance from live scanner, DB browser, and public upload rollout.
