# ecosystem-tests-runner handoff
## Scope
Phase 3.35 read-only audit for focused tests and gates needed when extracting shared LMS S3/R2 object-store primitives. Scope was limited to current object-store code, current integration/package tests, artifact scanner coverage, and gate commands. No product code, test code, migrations, or runtime behavior was changed.

## Files inspected
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/index.ts`
- `packages/lms/src/materials.ts`
- `packages/lms/src/materials.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-material-create-compensation.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-object-cleanup-tasks.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-ph3-1-static.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/gates.mjs`
- `package.json`

## Files changed
- `docs/handoffs/20260602-0548-ecosystem-tests-runner.md` - handoff artifact only.

## Findings
1. High - The shared primitive module exists, but it needs direct package-level golden tests before it can be treated as the canonical S3/R2 contract. Evidence: `@wtc/lms` exports `object-storage.ts` at `packages/lms/src/index.ts:18`-`packages/lms/src/index.ts:19`; the module owns config parsing, object URL construction, PUT signing, DELETE signing, and signed read URL generation at `packages/lms/src/object-storage.ts:19`-`packages/lms/src/object-storage.ts:40`, `packages/lms/src/object-storage.ts:52`-`packages/lms/src/object-storage.ts:55`, `packages/lms/src/object-storage.ts:112`-`packages/lms/src/object-storage.ts:149`, `packages/lms/src/object-storage.ts:152`-`packages/lms/src/object-storage.ts:185`, and `packages/lms/src/object-storage.ts:188`-`packages/lms/src/object-storage.ts:223`. Current package tests import material helpers only at `packages/lms/src/materials.test.ts:2`-`packages/lms/src/materials.test.ts:15`, while object-store behavior is covered indirectly through web integration tests at `tests/integration/lms-material-storage.test.ts:132`-`tests/integration/lms-material-storage.test.ts:185` and `tests/integration/lms-material-storage.test.ts:290`-`tests/integration/lms-material-storage.test.ts:317`. Recommendation: add `packages/lms/src/object-storage.test.ts` with deterministic tests for `readLmsObjectStorageConfig()`, `buildLmsObjectStorageUrl()`, `buildLmsObjectPutRequest()`, `buildLmsObjectDeleteRequest()`, and `buildLmsObjectReadUrl()`. Target part: package-level shared primitive contract.

2. High - Worker DELETE still carries local SigV4/config/path code, so extraction is not complete until the worker consumes the shared package builders. Evidence: web upload/delete/read paths already call the shared builders at `apps/web/src/features/lms/material-storage.ts:178`-`apps/web/src/features/lms/material-storage.ts:200` and `apps/web/src/features/lms/material-storage.ts:300`-`apps/web/src/features/lms/material-storage.ts:311`; worker still imports `createHmac` and defines its own object storage config, path, timestamp, signing key, and DELETE header code at `apps/worker/src/lms-object-cleanup.ts:1`, `apps/worker/src/lms-object-cleanup.ts:40`-`apps/worker/src/lms-object-cleanup.ts:61`, `apps/worker/src/lms-object-cleanup.ts:64`-`apps/worker/src/lms-object-cleanup.ts:76`, and `apps/worker/src/lms-object-cleanup.ts:79`-`apps/worker/src/lms-object-cleanup.ts:128`. Recommendation: add a static extraction guard that fails if `apps/worker/src/lms-object-cleanup.ts` contains `createHmac`, `signDeleteHeaders`, local `ObjectStorageConfig`, `awsEncode`, `timestampParts`, or `signingKey`, and requires imports of `readLmsObjectStorageConfig` plus `buildLmsObjectDeleteRequest` from `@wtc/lms`. Target part: worker extraction coverage.

3. Medium - Existing web integration tests cover mocked PUT, signed read redirect, and compensation DELETE, but they do not assert parity with the shared primitive builders. Evidence: PUT/read assertions currently inspect URL/header shape and secret omission at `tests/integration/lms-material-storage.test.ts:148`-`tests/integration/lms-material-storage.test.ts:185`; compensation DELETE assertions inspect method/header shape and omit the secret at `tests/integration/lms-material-storage.test.ts:307`-`tests/integration/lms-material-storage.test.ts:317`; signed download handler audit redaction is covered at `tests/integration/lms-material-download-handler.test.ts:256`-`tests/integration/lms-material-download-handler.test.ts:276`. Recommendation: extend `lms-material-storage.test.ts` so the captured web PUT, web compensation DELETE, and resolved signed read URL equal the output of `buildLmsObjectPutRequest()`, `buildLmsObjectDeleteRequest()`, and `buildLmsObjectReadUrl()` for the same env, key, bytes, MIME, disposition, and timestamp. Target part: web call-site parity after extraction.

4. Medium - Worker integration tests cover DELETE behavior and no-leak worker health/audit payloads, but they should compare worker DELETE requests to the shared builder after migration. Evidence: expired object cleanup asserts DELETE calls, Authorization format, and secret omission at `tests/integration/worker-tortila-snapshot.test.ts:189`-`tests/integration/worker-tortila-snapshot.test.ts:220`; worker health output omits object key fragments and the object-storage secret at `tests/integration/worker-tortila-snapshot.test.ts:228`-`tests/integration/worker-tortila-snapshot.test.ts:244`; pending upload cleanup repeats the no-leak checks for task IDs, object key fragments, and secrets at `tests/integration/worker-tortila-snapshot.test.ts:288`-`tests/integration/worker-tortila-snapshot.test.ts:337`; summary audit no-leak checks are at `tests/integration/worker-tortila-snapshot.test.ts:339`-`tests/integration/worker-tortila-snapshot.test.ts:353`. Recommendation: in both worker cleanup tests, compute the expected request with `buildLmsObjectDeleteRequest()` and assert the observed fetch URL and headers match exactly, while keeping the existing health/audit no-leak assertions. Target part: worker runtime parity and no-leak safety.

5. Medium - Package-level no-leak assertions must distinguish internal signing artifacts from rendered/logged artifacts. Evidence: internal signed requests must contain Authorization or `X-Amz-*` signing fields by design at `packages/lms/src/object-storage.ts:141`-`packages/lms/src/object-storage.ts:148`, `packages/lms/src/object-storage.ts:178`-`packages/lms/src/object-storage.ts:184`, and `packages/lms/src/object-storage.ts:200`-`packages/lms/src/object-storage.ts:221`; generated artifacts must not contain storage keys, signed URL tokens, auth headers, scanner env, cookies, or raw payload markers per `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:54`, with negative fixtures for signed object URLs and cleanup request evidence at `tests/integration/lms-db-e2e-artifact-scan.test.ts:72`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:96`. Recommendation: primitive unit tests should assert no `secretAccessKey`, scanner token, original filename, raw provider body, or raw file bytes appear in returned internal request material, while integration/artifact tests should continue forbidding `storageKey`, `lms/materials/`, `Authorization`, `X-Amz-*`, `AWSAccessKeyId`, bucket/object paths, file names, MIME/hash fields, scanner endpoint/token, and provider response bodies in health, audit, UI, logs, screenshots, and retained artifacts. Target part: no-leak assertion boundary.

6. Medium - The exact gate sequence should remain split between full gates and Playwright e2e. Evidence: package scripts expose `secret:scan`, `worker:smoke`, `db:generate`, and `e2e` at `package.json:17`-`package.json:28`; `scripts/gates.mjs` defines `full` as governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, db:generate, and build at `scripts/gates.mjs:47`-`scripts/gates.mjs:50`; the script explicitly states e2e is its own plan at `scripts/gates.mjs:43`-`scripts/gates.mjs:46`. Recommendation: run focused Vitest first, then typechecks/worker smoke/artifact scan, then `node scripts/gates.mjs full`, then `node scripts/gates.mjs e2e`, then final artifact scan/secret/governance checks. Target part: Phase 3.35 verification gates.

## Decisions
- Put the primitive golden tests beside the shared module: `packages/lms/src/object-storage.test.ts`.
- Keep web and worker integration tests focused on call-site parity and redacted outputs, not on reimplementing SigV4 inside the tests.
- Keep generated artifact no-leak rules stricter than internal builder tests; internal requests may contain signed request fields, retained artifacts must not.
- No migration or DB gate is expected for this extraction, but `db:generate` remains part of `node scripts/gates.mjs full` to prove no accidental schema drift.

## Risks
- If only package tests are added, the worker can keep duplicated SigV4 code and continue drifting from web behavior.
- If only integration tests are kept, a shared primitive bug can be masked by call-site assumptions and remain hard to isolate.
- Overbroad no-leak assertions in primitive tests can reject legitimate internal signing fields; underbroad artifact assertions can leak signed URLs, auth headers, or object keys into screenshots/logs.
- Live S3/R2 IAM, endpoint, clock-skew, and provider error-shape behavior remain unobserved by this local extraction test plan.

## Verification/tests
- Read-only inspection only.
- Commands used: `rg` searches, line-numbered `Get-Content` reads, and `Test-Path` for this handoff target.
- No tests or gates were run by this audit lane.
- No live S3/R2, scanner, browser, DB migration, or server command was run.

Recommended focused tests after implementation:
- `npm test -- packages/lms/src/object-storage.test.ts tests/integration/lms-material-storage.test.ts tests/integration/lms-material-download-handler.test.ts tests/integration/lms-material-create-compensation.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/lms-object-cleanup-tasks.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-ph3-1-static.test.ts`
- `npm run typecheck`
- `npm run typecheck -w @wtc/web`
- `npm run worker:smoke`
- `node scripts/scan-lms-db-e2e-artifacts.mjs`

Recommended final gates after implementation:
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`
- `node scripts/scan-lms-db-e2e-artifacts.mjs`
- `npm run secret:scan`
- `npm run governance:check`

Required no-leak assertions:
- Internal primitive tests: request builders must not expose `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY`, scanner token, original filename, raw provider body, or raw file bytes in error text or returned non-body metadata.
- Web tests: failure responses and audits must not include signed URLs, `Authorization`, `X-Amz-*`, object keys, bucket/object paths, original filenames, MIME/hash fields, scanner endpoint/token, provider response bodies, or object-storage secrets.
- Worker tests: health detail, console-observable count fields, and cleanup audit rows must not include task IDs, material IDs, storage keys, bucket/object paths, `Authorization`, `X-Amz-*`, access key IDs, secret access keys, filenames, MIME/hash fields, scanner details, provider bodies, or raw DB rows.
- Artifact scanner tests: retained artifacts must fail on any new label/value introduced by the extraction that contains storage keys, signed URL/query tokens, auth headers, object-storage credentials, scanner env, raw file bytes/base64, filenames, hashes, MIME fields, or provider response bodies.

## Next actions
1. Add `packages/lms/src/object-storage.test.ts` with fixed-time golden coverage for config, URL, PUT, DELETE, signed read URL, invalid config/key, and internal secret no-leak.
2. Add or extend static extraction tests so web and worker call sites import shared object-store builders and the worker no longer contains local SigV4 primitives.
3. Extend `tests/integration/lms-material-storage.test.ts` to compare web PUT, web compensation DELETE, and signed read delivery against shared builder outputs.
4. Extend `tests/integration/worker-tortila-snapshot.test.ts` to compare worker DELETE fetch requests against `buildLmsObjectDeleteRequest()` for expired material cleanup and pending upload cleanup.
5. Keep `tests/integration/lms-db-e2e-artifact-scan.test.ts` and `scripts/scan-lms-db-e2e-artifacts.mjs` in the focused and final gates so no signed object material leaks into retained artifacts.
6. Do not claim live S3/R2 acceptance, live scanner acceptance, DB browser acceptance, or public upload rollout from these local extraction gates.
