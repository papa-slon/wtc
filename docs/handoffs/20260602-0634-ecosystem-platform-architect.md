# ecosystem-platform-architect handoff
## Scope
Read-only Phase 3.37 LMS live S3/R2 acceptance preflight audit after Phase 3.36. Inspected the shared `@wtc/lms` object-storage helpers, web material storage path, worker cleanup path, generated artifact scanner, deployment docs, and acceptance docs. No product code, tests, migrations, DB commands, browser runs, live S3/R2 calls, live scanner calls, or production/public-upload changes were performed.

Target recommendation: a bounded preflight implementation before operator-provided throwaway bucket credentials: deterministic SigV4/reference-vector tests, an operator-safe opt-in live acceptance harness, and retained-artifact no-leak boundaries.
## Files inspected
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/object-storage.test.ts`
- `packages/lms/src/index.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `package.json`
- `.env.example`
- `packages/config/src/env.ts`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-0548-phase-3-35-lms-shared-object-storage-primitives.md`
- `docs/handoffs/20260602-0609-phase-3-36-lms-cleanup-ack-retry.md`
## Files changed
- `docs/handoffs/20260602-0634-ecosystem-platform-architect.md` only.
- No product code changed.
## Findings
1. Severity: High. Evidence: `packages/lms/src/object-storage.ts:81`-`110` owns the SigV4 canonical request/signature logic and `packages/lms/src/object-storage.ts:112`-`223` builds signed PUT, DELETE, and read URLs, but current package tests assert only request shape, no-secret leakage, bounded expiry, and 64-hex signature format at `packages/lms/src/object-storage.test.ts:26`-`70`. They do not pin exact canonical query/header ordering or exact signatures against deterministic reference vectors. Recommendation: before live credentials, add deterministic SigV4 vector tests with fixed config, timestamp, key, payload, MIME, and content-disposition; assert the exact PUT Authorization header, DELETE Authorization header, and GET signed URL query, including canonical encoding for the `lms/materials/<opaque>` path. Target part: `@wtc/lms` object-storage cryptographic compatibility.
2. Severity: High. Evidence: `package.json:27`-`29` exposes default Playwright and LMS DB-browser runners only; there is no live object-store acceptance script. `docs/DEPLOYMENT.md:70`-`72` and `docs/handoffs/20260602-0609-phase-3-36-lms-cleanup-ack-retry.md:107` explicitly say live S3/R2 upload/download/delete/reconcile acceptance was not run. Recommendation: add a separate opt-in `npm run acceptance:lms:object-store` harness that defaults to dry-run/no-network, refuses live mode unless an explicit enable flag and throwaway-bucket assertion are set, validates env through `readLmsObjectStorageConfig()`, writes only under a generated `lms/materials/live-acceptance-<run>` key, performs PUT, signed GET, DELETE, and already-absent verification, and exits nonzero on any unredacted evidence. Target part: operator-safe live acceptance harness.
3. Severity: High. Evidence: the web path calls shared builders but retains app-local fetch/error semantics for PUT at `apps/web/src/features/lms/material-storage.ts:172`-`187`, compensation DELETE at `apps/web/src/features/lms/material-storage.ts:190`-`204`, and signed redirect delivery at `apps/web/src/features/lms/material-storage.ts:291`-`312`; the worker cleanup path calls the shared DELETE builder and treats `404` as reconciled at `apps/worker/src/lms-object-cleanup.ts:31`-`44`. Mocked tests cover these paths at `tests/integration/lms-material-storage.test.ts:132`-`180`, `tests/integration/lms-material-storage.test.ts:290`-`317`, and `tests/integration/worker-tortila-snapshot.test.ts:155`-`230`, but live acceptance must exercise the app-level wrappers, not only the package helper. Recommendation: structure the harness in two layers: deterministic helper vectors with no network, then live wrapper probes that call `storeLmsUploadedFile()`, `resolveLmsMaterialFileDelivery()`, `deleteLmsObjectStorageFile()`, and worker DELETE/reconcile behavior under a controlled throwaway key/prefix. Target part: web/worker runtime parity.
4. Severity: Medium. Evidence: the artifact scanner rejects storage-key fields, signed URL tokens, auth headers, bearer/basic auth, scanner endpoint/token assignments, and container artifacts at `scripts/scan-lms-db-e2e-artifacts.mjs:14`-`54` and `scripts/scan-lms-db-e2e-artifacts.mjs:140`-`179`; tests prove signed URL and cleanup evidence rejection at `tests/integration/lms-db-e2e-artifact-scan.test.ts:72`-`97`. However `docs/DEPLOYMENT.md:103`-`106` and `docs/DEPLOYMENT.md:128`-`140` document retained artifacts only for the DB-browser runner and explicitly state that it is not live S3/R2 acceptance. Recommendation: extend the scanner or add a dedicated live-object artifact scanner mode before live credentials are used. The live harness should emit a transient dynamic marker manifest containing the generated object key, bucket, endpoint host, access key id, signed URL fragments, and any request IDs, then archive only redacted status/count/timing artifacts after the scanner passes; never archive the marker manifest, request headers, signed URLs, object keys, provider bodies, raw errors, bytes, hashes, or secrets. Target part: retained live evidence no-leak boundary.
5. Severity: Medium. Evidence: `.env.example:30` and `.env.example:43` keep public uploads disabled until live object-store plus external scanner acceptance is observed; `packages/config/src/env.ts:136`-`142` blocks public uploads in staging/production unless storage is `s3-r2` and scanner mode is `external`; `docs/DEPLOYMENT.md:82`-`85` adds DB-backed browser evidence and retained scanned artifacts as rollout prerequisites. Recommendation: keep the Phase 3.37 preflight separate from public-upload rollout. The harness may prove live object-store mechanics, but it must not toggle `LMS_PUBLIC_UPLOADS_ENABLED`, weaken external scanner requirements, or claim DB-browser/public rollout acceptance. Target part: rollout sequencing and production safety.
6. Severity: Medium. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:144`-`149` defines the shared object-store primitive boundary and states it is not live object-store acceptance; `docs/ACCEPTANCE_MATRIX_MASTER.md:91`-`97`, `docs/ACCEPTANCE_MATRIX_MASTER.md:105`-`112`, and `docs/ACCEPTANCE_MATRIX_MASTER.md:135`-`143` separately require observed live gates for S3/R2, cleanup/reconciliation, and ack/retry boundaries. Recommendation: add a new acceptance matrix row for "LMS live object-store preflight" with exact proof: deterministic vectors green, live harness green against an operator-approved throwaway bucket, retained artifacts scanned green, and explicit NOT RUN entries for live scanner, DB-browser acceptance, and public rollout unless separately observed. Target part: acceptance documentation.
## Decisions
- Keep SigV4 config parsing, path construction, signing, and read URL construction inside `@wtc/lms`; do not reintroduce HMAC/signing code into web or worker app files.
- Treat deterministic vector coverage as the next local confidence step. It can be implemented and verified without live credentials.
- Treat the live object-store harness as an explicit opt-in operator action, separate from default `npm run e2e`, `npm run e2e:lms:db`, and public-upload rollout.
- Retained live evidence should be summary-only and scanner-approved. The transient dynamic marker manifest is test input, not an archive artifact.
- Keep `LMS_PUBLIC_UPLOADS_ENABLED=false` until live object-store, live external scanner, DB-browser acceptance, and retained artifact gates are all observed in their own phases.
## Risks
- Passing deterministic SigV4 vectors reduces signer drift risk but still does not prove R2/S3 account permissions, bucket policy, endpoint behavior, object lifecycle, or network reachability.
- A live harness can mutate the wrong bucket if guardrails are weak. Require explicit live enablement, a throwaway-bucket assertion, generated one-run key prefixes, and cleanup/verification in `finally`.
- Wrapper-level live probes may still miss the full browser route, entitlement, and scanner path. Do not use object-store harness success as DB-browser or public-upload acceptance.
- Retained artifacts can easily leak signed URLs, headers, object keys, or provider error bodies unless the harness emits only redacted summaries and the scanner denies run-specific dynamic markers.
## Verification/tests
- Not run: no Vitest, typecheck, lint, worker smoke, full gate, e2e, LMS DB-browser runner, artifact scanner, secret scan, governance check, live S3/R2 calls, live scanner calls, or DB commands were executed in this read-only audit.
- `git status --short` cannot verify the diff in this workspace because `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform` is not a git repository.
## Next actions
1. Add deterministic SigV4/reference-vector tests in `packages/lms/src/object-storage.test.ts` or `packages/lms/src/object-storage-vectors.test.ts`; run `npm test -- packages/lms/src/object-storage.test.ts` and keep web/worker static extraction tests green.
2. Add a dry-run-first `scripts/run-lms-object-storage-live-acceptance.mjs` plus an npm script such as `acceptance:lms:object-store`; add tests proving it refuses missing explicit live enablement, rejects non-HTTPS or non-throwaway configuration, redacts env values, and produces only scanner-safe summary artifacts.
3. Extend `scripts/scan-lms-db-e2e-artifacts.mjs` into a shared generated-artifact scanner mode or add a dedicated live-object scanner; include dynamic marker support for live object keys, signed URL fragments, bucket/endpoint/access-key identifiers, request IDs, and provider body snippets, while printing labels only.
4. Update `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, `docs/NEXT_ACTIONS.md`, and `docs/STATUS.md` to define the live object-store preflight gate and keep live scanner, DB-browser acceptance, and public upload rollout explicitly NOT RUN.
5. Only after the preflight implementation lands and an operator supplies throwaway bucket credentials, run the live harness and archive only the redacted summary artifacts after scanner and secret scan pass.
