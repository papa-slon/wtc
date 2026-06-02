# ecosystem-education-implementer handoff
## Scope
Read-only Phase 3.29 LMS audit for the production object-storage adapter boundary: S3/R2-compatible upload/download, signed delivery, and preservation of filename/hash-free LMS DTO/audit/artifact behavior. No live S3/R2 acceptance was claimed or run.
## Files inspected
`apps/web/src/features/lms/material-storage.ts`; `apps/web/src/features/lms/material-download.ts`; `apps/web/src/features/lms/actions.ts`; `packages/lms/src/materials.ts`; `packages/lms/src/materials.test.ts`; `packages/lms/src/index.ts`; `packages/config/src/env.ts`; `packages/config/src/env.test.ts`; `packages/db/src/schema.ts`; `packages/db/src/repositories.ts`; `tests/integration/lms-material-storage.test.ts`; `tests/integration/lms-material-download-handler.test.ts`; `tests/integration/lms-db-e2e-artifact-scan.test.ts`; `scripts/scan-lms-db-e2e-artifacts.mjs`; `.env.example`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`.
## Files changed
None - read-only audit
## Findings
1. High - `packages/lms/src/materials.ts` and `packages/config/src/env.ts` only exposed `db-local`/`fs-local`. Recommendation: add explicit `s3-r2` provider and fail-closed object-store env validation. Target part: LMS provider contract and typed env.
2. High - `apps/web/src/features/lms/material-storage.ts` rejected any non-local provider while upload dispatch goes through `apps/web/src/features/lms/actions.ts`. Recommendation: implement S3/R2 upload inside the storage boundary, keep opaque `buildLmsStorageKey()` keys, and return no `fileBytesBase64` for remote storage. Target part: storage adapter boundary.
3. High - `apps/web/src/features/lms/material-download.ts` could only return bytes. Recommendation: replace byte-only resolution with a delivery union and issue a short-lived signed redirect only after auth, entitlement, clean published-row lookup, and storage resolution pass. Target part: material download handler.
4. High - existing remote-provider test coverage expected unsupported-provider 404 without audit. Recommendation: add `s3-r2` success redirect tests while preserving fail-closed behavior for unknown providers and signing/upload failures. Target part: handler integration tests.
5. Medium - DB constraints already allow non-`db-local` rows with null inline bytes. Recommendation: no migration is needed for the first adapter, but repository validation should reject arbitrary provider typos. Target part: repository validation.
6. Medium - generated keys are opaque, but the broad storage-key validator accepts nested paths for legacy/local compatibility. Recommendation: add or use a stricter opaque-key validator for production object-store rows. Target part: object-key policy.
7. Medium - current audit/scanner boundaries are summary-only but must not add signed URLs, object keys, query strings, filenames, MIME labels, or hashes. Target part: audit and generated-artifact no-leak boundary.
8. Medium - dynamic artifact scanning exists but signed redirect evidence needs explicit marker policy. Recommendation: reject signed URL query tokens or append exact dynamic markers before any retained evidence archive. Target part: scanner and evidence policy.
9. Medium - production public uploads remain blocked until object storage, external scanning, signed delivery, cleanup/reconciliation, and credentialed acceptance are observed. Target part: rollout gate and docs truth.
## Decisions
Add `s3-r2` as a first-class provider, keep `db-local` as default, use bytes-or-redirect download delivery, and avoid a DB migration in this slice because metadata-only non-local rows already fit the schema.
## Risks
Signed URLs can leak object keys and query signatures through response headers, traces, HARs, screenshots, stdout, or audit/admin surfaces. Endpoint-shape differences may require later adapter controls. Local signature scanning is still not a production malware scanner.
## Verification/tests
Read-only source inspection only. No tests, typechecks, Playwright runs, live S3/R2 calls, DB migrations, or credentialed acceptance were run by this agent.
## Next actions
1. Add `s3-r2` provider constants and typed env validation.
2. Implement S3/R2-compatible upload/signing with opaque keys and no inline DB bytes.
3. Refactor downloads to bytes-or-signed-redirect delivery.
4. Add focused config/storage/download/scanner tests.
5. Update current docs while keeping live S3/R2, external scanner, cleanup, DB browser, and public rollout gates NOT RUN.
