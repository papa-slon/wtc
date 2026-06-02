# ecosystem-security-auditor handoff
## Scope
Phase 3.37 read-only security audit for an LMS live S3/R2 object-store acceptance preflight and future live harness. Scope covered current LMS object-storage SigV4 signing, environment/config handling, web/worker fetch boundaries, signed download redirects, generated-artifact deny rules, audit/log behavior, and acceptance docs. No product code, tests, migrations, live object-store calls, scanner calls, DB commands, servers, or gate commands were executed.

## Files inspected
- `AGENTS.md`
- `.env.example`
- `.secretlintrc.json`
- `.secretlintignore`
- `package.json`
- `packages/config/src/env.ts`
- `packages/lms/src/object-storage.ts`
- `packages/lms/src/object-storage.test.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/worker/src/lms-object-cleanup.ts`
- `apps/worker/src/index.ts`
- `packages/audit/src/redact.ts`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/lms-object-storage-shared-static.test.ts`
- `tests/integration/admin-lms-cleanup-review.test.ts`

## Files changed
None — read-only audit

## Findings
1. Severity: High. Live preflight evidence can easily leak signed object-store material unless the harness records only redacted summaries. Evidence: `packages/lms/src/object-storage.ts:141`-`packages/lms/src/object-storage.ts:148` returns PUT headers with `authorization`; `packages/lms/src/object-storage.ts:178`-`packages/lms/src/object-storage.ts:184` returns DELETE headers with `authorization`; `packages/lms/src/object-storage.ts:200`-`packages/lms/src/object-storage.ts:222` returns read URLs containing `X-Amz-*` query parameters; `apps/web/src/features/lms/material-storage.ts:181`-`apps/web/src/features/lms/material-storage.ts:187` and `apps/web/src/features/lms/material-storage.ts:198`-`apps/web/src/features/lms/material-storage.ts:204` keep those request values inside `fetch`; `apps/worker/src/lms-object-cleanup.ts:36`-`apps/worker/src/lms-object-cleanup.ts:44` does the same for worker DELETE; `apps/web/src/features/lms/material-download.ts:52`-`apps/web/src/features/lms/material-download.ts:58` and `apps/web/src/features/lms/material-download.ts:91`-`apps/web/src/features/lms/material-download.ts:95` intentionally expose signed read URLs as a 302 `Location` header. Recommendation: the live preflight must never print, persist, audit, screenshot, trace, or return raw `request.url`, `request.headers`, `Location`, signed URL query strings, bucket path, object key, access key ID, secret key, scanner token, or provider response body. It should record only operation name, sanitized provider label, generated run ID, HTTP status class, elapsed milliseconds, byte count, and generic result code. Target part: live S3/R2 preflight evidence model.

2. Severity: High. Current config parsing is fail-closed, but a live harness needs stricter evidence redaction than the runtime parser provides. Evidence: `packages/config/src/env.ts:105`-`packages/config/src/env.ts:121` requires endpoint, bucket, region, access key ID, secret key, and HTTPS for `s3-r2`; `packages/lms/src/object-storage.ts:19`-`packages/lms/src/object-storage.ts:40` rejects missing/invalid object-store config with only `lms_object_storage_config_required`; `.env.example:33`-`.env.example:37` documents the object-store env names as placeholders; `packages/lms/src/object-storage.test.ts:26`-`packages/lms/src/object-storage.test.ts:50` verifies signed PUT/DELETE do not contain the secret access key. Recommendation: read live credentials from process environment or the operator's secret manager only for the process lifetime; do not write a live `.env` copy, JSON manifest, trace, dotenv dump, or command echo. Preflight output should say that required fields were present and HTTPS-valid, not show endpoint, bucket, region, access key ID, or secret. Target part: live preflight env/bootstrap handling.

3. Severity: High. The existing generated-artifact scanner is a strong DB-browser guard but is not yet sufficient for live object-store evidence. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:55` rejects storage fields, cleanup task IDs, `lms/materials/`, `X-Amz-*`, scanner env assignments, auth/cookie headers, bearer/basic values, DB URLs, and secret assignments; `tests/integration/lms-db-e2e-artifact-scan.test.ts:72`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:98` proves it fails on signed URL tokens and cleanup auth evidence; `tests/integration/lms-db-e2e-harness.test.ts:145`-`tests/integration/lms-db-e2e-harness.test.ts:160` statically pins several deny rules. Gaps for live preflight evidence: no explicit deny rule for `LMS_OBJECT_STORAGE_ENDPOINT=`, `LMS_OBJECT_STORAGE_BUCKET=`, `LMS_OBJECT_STORAGE_REGION=`, `LMS_OBJECT_STORAGE_ACCESS_KEY_ID=`, `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY=`, bare `AWS4-HMAC-SHA256 Credential=` outside an `authorization:` field, `x-amz-content-sha256`, `x-amz-date`, S3/R2 XML/JSON provider bodies, bucket URLs, or raw object-store host/path patterns that omit the `lms/materials/` marker. Recommendation: add a dedicated live-object-store artifact scanner or extend the existing scanner before retaining live evidence; the scanner should fail on every object-store env assignment, signed request/header token, object URL/path marker, provider body marker, HAR/network trace header, and any raw bucket/object prefix. Target part: live preflight retained-artifact gate.

4. Severity: Medium. `secret:scan` cannot be the acceptance oracle for live object-store artifacts. Evidence: `package.json:17` runs `secretlint "**/*"`; `.secretlintignore:8`-`.secretlintignore:11` excludes `test-results`, `playwright-report`, `*.png`, and other generated artifacts; `.secretlintrc.json:1`-`.secretlintrc.json:6` uses the recommended preset only. Recommendation: treat `npm run secret:scan` as a source/fixtures backstop, not as proof that live network evidence is safe. The live harness should run its own artifact scanner against its run-specific output root before any archive step, and the final report should list that scanner separately. Target part: gate reporting and artifact retention.

5. Severity: Medium. Current runtime code correctly avoids provider-body logging, and the live harness should preserve that behavior. Evidence: `apps/web/src/features/lms/material-storage.ts:181`-`apps/web/src/features/lms/material-storage.ts:187` throws generic `lms_object_storage_write_failed` without reading a provider body; `apps/web/src/features/lms/material-storage.ts:198`-`apps/web/src/features/lms/material-storage.ts:204` throws generic `lms_object_storage_delete_failed`; `apps/worker/src/lms-object-cleanup.ts:38`-`apps/worker/src/lms-object-cleanup.ts:44` does the same for worker DELETE; `apps/web/src/features/lms/material-storage.ts:108`-`apps/web/src/features/lms/material-storage.ts:121` sanitizes external scanner quarantine reasons to generic safe codes; `apps/web/src/features/lms/material-storage.ts:151`-`apps/web/src/features/lms/material-storage.ts:156` maps malformed scanner responses to `lms_file_scan_failed`. Recommendation: live preflight should not capture or print raw S3/R2 XML/JSON error bodies or scanner vendor bodies even on failure; if a response is needed for debugging, record only status, operation, generic provider family, and a local run step ID. Target part: live preflight failure handling.

6. Severity: Medium. Browser/network evidence around signed redirects is higher risk than app audit rows. Evidence: `apps/web/src/features/lms/material-download.ts:52`-`apps/web/src/features/lms/material-download.ts:58` sets the signed URL in `Location`; `tests/integration/lms-material-download-handler.test.ts:229`-`tests/integration/lms-material-download-handler.test.ts:277` verifies the audit log omits the signed redirect URL, storage key, `X-Amz-Signature`, filename, MIME field, hash, and file body; `scripts/scan-lms-db-e2e-artifacts.mjs:147`-`scripts/scan-lms-db-e2e-artifacts.mjs:159` fails closed on compressed/container artifacts but skips image bytes; `tests/integration/lms-db-e2e-artifact-scan.test.ts:131`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:138` confirms screenshots are skipped and trace zips are rejected. Recommendation: live redirect/browser harnesses should disable HAR/trace retention unless explicitly scanner-supported, avoid screenshots of devtools/network panels, and treat any unscanned trace/container artifact as a failed acceptance. If screenshots are retained, they need human review plus no network UI. Target part: signed redirect/browser evidence policy.

7. Severity: Medium. Bucket data and object keys must stay scoped to a throwaway prefix and should not be used as proof artifacts. Evidence: `packages/lms/src/object-storage.ts:47`-`packages/lms/src/object-storage.ts:55` builds path-style URLs using the configured bucket and opaque storage key; `tests/integration/lms-material-storage.test.ts:148`-`tests/integration/lms-material-storage.test.ts:184` proves mocked `s3-r2` writes use opaque keys and signed redirects; `docs/ACCEPTANCE_MATRIX_MASTER.md:91`-`docs/ACCEPTANCE_MATRIX_MASTER.md:97` states live object-store acceptance requires separate observed gates; `docs/ACCEPTANCE_MATRIX_MASTER.md:105`-`docs/ACCEPTANCE_MATRIX_MASTER.md:112` requires cleanup evidence to avoid raw object keys/auth/signed tokens. Recommendation: live preflight should use an operator-approved throwaway bucket or a single random prefix inside a throwaway bucket, list only that prefix, delete all created objects, and record only counts such as `objectsCreated=1`, `objectsDownloaded=1`, `objectsDeleted=1`, and `prefixEmptyAfterCleanup=true`. Do not archive object names, bucket listings, request paths, or provider inventory output. Target part: throwaway bucket/prefix operating procedure.

8. Severity: Low. Generic audit redaction is useful but not enough to make object-store request objects safe to audit. Evidence: `packages/audit/src/redact.ts:12`-`packages/audit/src/redact.ts:36` redacts keys containing secret/auth/token/cookie-style hints; `packages/audit/src/redact.ts:54`-`packages/audit/src/redact.ts:62` redacts bearer/basic values and long hex strings; `docs/AUDIT_LOG_SCHEMA.md:220`-`docs/AUDIT_LOG_SCHEMA.md:225` explicitly forbids file bytes, storage keys, signed URLs, request headers, scanner details, provider responses, and raw errors in LMS material cleanup/download audit actions. Access key IDs, bucket names, endpoints, object paths, and signed URLs can still be sensitive even when they do not match generic secret patterns. Recommendation: do not pass object-store config, request objects, response headers, provider bodies, bucket names, object keys, or signed URLs to audit logging at all; record summary counts and generic result codes before redaction. Target part: audit payload discipline.

## Decisions
- A Phase 3.37 live object-store preflight should be a separate opt-in harness, not part of `node scripts/gates.mjs full`, default `npm run e2e`, or the existing DB-browser harness.
- The harness should be evidence-minimal: redacted stdout plus a small JSON summary with run ID, operation statuses, counts, and scanner result only.
- Raw object-store request/response material is wire-only. It may exist in memory for `fetch`, but must not cross into logs, audits, JSON responses, screenshots, traces, archived artifacts, handoffs, or docs.
- Any live harness must run with operator-approved throwaway credentials and either a throwaway bucket or a throwaway random prefix, then prove cleanup by counts only.
- `LMS_PUBLIC_UPLOADS_ENABLED` must remain false until live object-store acceptance, live scanner acceptance, DB-backed browser evidence, and retained artifact scanning have all passed as separate observed gates.

## Risks
- A successful live PUT/GET/DELETE can still be unsafe to archive if stdout, HAR, Playwright trace, provider error body, or debug logging contains signed URLs, auth headers, bucket paths, access key IDs, object keys, scanner tokens, or provider inventory.
- Existing `secret:scan` ignores common generated artifact roots and binary files, so it can pass while live evidence artifacts leak sensitive values.
- Existing artifact scanning skips screenshots and rejects compressed traces instead of inspecting them; this is safe only when acceptance treats unscanned traces as failures and screenshots are manually reviewed.
- Provider error bodies can include bucket names, request IDs, canonical request hints, endpoint names, or object keys; retaining them would violate the no-leak boundary even without the secret access key.
- Listing an entire bucket for cleanup verification could expose unrelated tenant/operator data. Prefix-only operations and count-only evidence are required.

## Verification/tests
- No Vitest, typecheck, lint, worker smoke, secret scan, governance, Playwright, DB browser, scanner, live S3/R2, live external scanner, server, or migration command was run in this read-only audit.
- Verified by source inspection that object-store signing is centralized in `packages/lms/src/object-storage.ts` and that current web/worker call sites pass signed requests directly to `fetch`.
- Verified by source inspection that current app code uses generic object-store/scanner failure codes and does not read or log raw provider bodies in the inspected LMS paths.
- Verified by source inspection that current artifact scanning rejects several DB-browser and cleanup leak markers, but lacks explicit live object-store env/header/provider-body deny rules listed above.
- Verified by source inspection that the requested handoff headings from `AGENTS.md` are present.

## Next actions
1. Add a dedicated opt-in live preflight runner, for example `scripts/run-lms-object-storage-live-preflight.mjs`, that refuses to run unless `LMS_OBJECT_STORAGE_LIVE_PREFLIGHT=1`, `LMS_FILE_STORAGE_PROVIDER=s3-r2`, HTTPS config is present, and a throwaway bucket or random prefix is supplied.
2. Add a live artifact scanner, for example `scripts/scan-lms-object-storage-live-artifacts.mjs`, with deny rules for every `LMS_OBJECT_STORAGE_*` assignment, access key ID/secret key shape, endpoint/bucket assignment, `Authorization`, `AWS4-HMAC-SHA256 Credential=`, `x-amz-*`, `X-Amz-*`, signed redirect URLs, `lms/materials/`, provider XML/JSON body markers, HAR headers, and raw object keys.
3. Make the live runner write only a redacted run summary: config presence booleans, operation status classes, byte counts, created/downloaded/deleted counts, cleanup count, scanner status, and final `public_uploads_enabled=false` assertion.
4. Add static/integration tests proving the live runner never prints target URLs/env values and that the live artifact scanner fails on representative signed URL, auth header, object key, object-store env assignment, bucket listing, and provider-body fixtures while passing a count-only summary.
5. Keep live S3/R2 acceptance, live external scanner acceptance, DB-backed browser acceptance, and public upload rollout as separate operator-approved phases with explicit RUN/NOT RUN reporting.
