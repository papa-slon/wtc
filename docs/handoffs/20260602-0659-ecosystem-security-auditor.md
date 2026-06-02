# ecosystem-security-auditor handoff
## Scope
Phase 3.38 read-only security/no-leak audit for a future live external malware scanner preflight harness. Scope covered `LMS_FILE_SCANNER_*` configuration, current runtime scanner fetch behavior, LMS upload audit/log/error behavior, generated artifact scanner coverage, relevant tests, and deployment/status docs.

No product code, tests, scripts, configs, live services, databases, browsers, or production targets were changed or exercised.

## Files inspected
- `.env.example`
- `.secretlintignore`
- `.secretlintrc.json`
- `package.json`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/lms/src/materials.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/db/src/repositories.ts`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/lms/material-storage.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/AUDIT_LOG_SCHEMA.md`

## Files changed
- `docs/handoffs/20260602-0659-ecosystem-security-auditor.md` - handoff only.

## Findings
1. Severity: High. There is no repo-native live external malware scanner preflight harness yet; the only live opt-in acceptance command is object-store-only. Evidence: `package.json:27`-`package.json:30` defines e2e DB runners and `accept:lms:object-storage`, but no `accept:lms:scanner`; the `scripts/` directory contains `lms-s3-r2-live-preflight.mjs` and no scanner live preflight script; `docs/DEPLOYMENT.md:87`-`docs/DEPLOYMENT.md:115` explicitly scopes the preflight to S3/R2 and says it does not prove live external scanner behavior; `docs/STATUS.md:20`-`docs/STATUS.md:22` and `docs/NEXT_ACTIONS.md:13`-`docs/NEXT_ACTIONS.md:15` keep live external scanner acceptance NOT RUN. Recommendation: add a separate dry-run-first/live-opt-in scanner preflight, for example `scripts/lms-external-scanner-live-preflight.mjs` plus `accept:lms:scanner`, with explicit consent flags, safe corpus, no default gate wiring, redacted evidence under its own log root, and artifact scanning before archive. Target part: live external scanner preflight command boundary.

2. Severity: High. A future live scanner harness can leak scanner endpoint, bearer token, raw bytes, or vendor response details if it records raw request/response data. The current runtime path itself keeps these inside `fetch`, but the request necessarily contains sensitive material. Evidence: `apps/web/src/features/lms/material-storage.ts:124`-`apps/web/src/features/lms/material-storage.ts:145` POSTs raw bytes to the configured scanner endpoint with `authorization: Bearer ...`, MIME, and size headers; `tests/integration/lms-material-storage.test.ts:251`-`tests/integration/lms-material-storage.test.ts:262` confirms the scanner URL, auth header, MIME/size headers, and body are present in the fetch call; `scripts/scan-lms-db-e2e-artifacts.mjs:45`-`scripts/scan-lms-db-e2e-artifacts.mjs:46` rejects retained `LMS_FILE_SCANNER_ENDPOINT=` and `LMS_FILE_SCANNER_TOKEN=` assignments. Recommendation: the live scanner preflight must never print, persist, audit, screenshot, trace, or return raw endpoint URLs, bearer tokens, request headers, request bodies, vendor response bodies, or raw vendor reason strings. Keep only status class, elapsed time, byte count, verdict class, and generic result codes. Target part: live scanner evidence model.

3. Severity: High. Scanner acceptance must prove live clean, quarantine, failure, malformed, and timeout behavior as separate observations; current evidence is local/mocked only. Evidence: `apps/web/src/features/lms/material-storage.ts:130`-`apps/web/src/features/lms/material-storage.ts:156` aborts the scanner call by timeout, maps fetch errors, non-2xx, and malformed JSON to `lms_file_scan_failed`, and accepts only `clean` or `quarantined`; `apps/web/src/features/lms/material-storage.ts:234`-`apps/web/src/features/lms/material-storage.ts:255` calls the scanner before object storage and only writes `s3-r2` objects for clean verdicts; `tests/integration/lms-material-storage.test.ts:230`-`tests/integration/lms-material-storage.test.ts:288` and `tests/integration/lms-material-storage.test.ts:338`-`tests/integration/lms-material-storage.test.ts:373` cover these cases with mocks; `docs/ACCEPTANCE_MATRIX_MASTER.md:98`-`docs/ACCEPTANCE_MATRIX_MASTER.md:104` says live scanner acceptance still needs a real endpoint/token and live observations. Recommendation: the future preflight should run an operator-approved safe corpus through a real scanner endpoint and produce distinct PASS/FAIL lines for clean, quarantine, non-2xx, malformed response, and timeout paths. Target part: live acceptance semantics.

4. Severity: Medium. Scanner config validation is strong, but it is duplicated between typed config and runtime scanner code, creating drift risk for a new harness. Evidence: `packages/config/src/env.ts:122`-`packages/config/src/env.ts:134` requires endpoint/token and rejects non-HTTPS endpoints, embedded credentials, query strings, and fragments when `LMS_FILE_SCANNER_MODE=external`; `apps/web/src/features/lms/material-storage.ts:84`-`apps/web/src/features/lms/material-storage.ts:105` independently revalidates endpoint/token and timeout with generic runtime errors; `packages/config/src/env.test.ts:159`-`packages/config/src/env.test.ts:232` pins redacted config errors, HTTPS-only endpoints, no endpoint credentials/query, accepted external settings, and timeout rejection. Recommendation: the live preflight should reuse the same scanner config reader or an extracted shared helper, not introduce a third parser with looser endpoint/token/timeout rules. Target part: scanner config loading.

5. Severity: Medium. Generated artifact scanning is a usable safety gate for a scanner preflight only if the harness emits text/JSON summaries and treats unscanned artifacts as failures. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`scripts/scan-lms-db-e2e-artifacts.mjs:65` blocks LMS file metadata, storage keys, scanner endpoint/token assignments, object-store env assignments, signed object auth markers, cookies, bearer/basic values, DB URLs, and password hashes; `scripts/scan-lms-db-e2e-artifacts.mjs:130`-`scripts/scan-lms-db-e2e-artifacts.mjs:134` accepts explicit roots; `scripts/scan-lms-db-e2e-artifacts.mjs:157`-`scripts/scan-lms-db-e2e-artifacts.mjs:166` fails closed on configured container extensions but skips image bytes; `tests/integration/lms-db-e2e-artifact-scan.test.ts:66`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:85` verifies scanner/object-store env leak rejection, and `tests/integration/lms-db-e2e-artifact-scan.test.ts:146`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:152` verifies screenshots are skipped while trace zips fail. Recommendation: make the scanner preflight write only small UTF-8 JSON/text summaries under a dedicated root, run `node scripts/scan-lms-db-e2e-artifacts.mjs <scanner-log-root>`, disable HAR/trace retention, and avoid screenshots unless they are separately reviewed and contain no network/devtools UI. Target part: retained artifact gate.

6. Severity: Medium. `secret:scan` is not enough for live scanner evidence retention. Evidence: `package.json:17` runs `secretlint "**/*"`; `.secretlintignore:8`-`.secretlintignore:13` excludes generated evidence roots and binary assets such as `test-results`, `playwright-report`, `*.png`, and `*.ico`; `.secretlintrc.json:1`-`.secretlintrc.json:7` uses only the recommended preset. Recommendation: report `secret:scan` as a source/fixtures backstop only. The live scanner preflight must have its own generated-artifact scan gate against its run-specific evidence root, and that gate must be listed separately in RUN/NOT RUN reporting. Target part: gate reporting and archive policy.

7. Severity: Medium. Current LMS upload error handling avoids scanner detail leaks but also suppresses scanner failure observability at the server-action boundary. Evidence: `apps/web/src/features/lms/material-storage.ts:146`-`apps/web/src/features/lms/material-storage.ts:156` maps scanner fetch, non-2xx, malformed JSON, and unsupported statuses to `lms_file_scan_failed`; `apps/web/src/features/lms/actions.ts:135`-`apps/web/src/features/lms/actions.ts:153` catches file preparation/storage errors and returns `null`, so no material success audit is written and no scanner failure audit is emitted; `packages/db/src/repositories.ts:743`-`packages/db/src/repositories.ts:753` writes `education.material_upload` only after a material insert succeeds. Recommendation: the live preflight must be a process-level harness that exits non-zero and writes a redacted failure summary for scanner failures. Before public rollout, consider a generic server-side audit/metric such as `education.material_upload_failed` with no filename, hash, bytes, endpoint, token, vendor body, or raw reason. Target part: operational failure visibility.

8. Severity: Low. Success audit and read DTO paths currently avoid raw scanner/vendor detail, and the scanner preflight should preserve that shape. Evidence: `apps/web/src/features/lms/material-storage.ts:108`-`apps/web/src/features/lms/material-storage.ts:121` normalizes quarantine reasons into bounded safe codes; `packages/db/src/repositories.ts:725`-`packages/db/src/repositories.ts:737` records upload audit metadata as `storageProvider`, `hasStorageKey`, `scanStatus`, `hasQuarantineReason`, and retention timestamp rather than raw quarantine text; `apps/web/src/features/lms/queries.ts:69`-`apps/web/src/features/lms/queries.ts:72` exposes download URL only for clean files and scan status only; `docs/AUDIT_LOG_SCHEMA.md:220`-`docs/AUDIT_LOG_SCHEMA.md:224` forbids scanner details, provider responses, raw errors, storage keys, and file bytes in LMS upload/cleanup audit surfaces. Recommendation: keep live preflight summaries aligned with this count/status-only model and do not add vendor detail to admin UI, audit payloads, retained logs, or generated artifacts. Target part: audit/log/DTO no-leak discipline.

## Decisions
- Treat Phase 3.38 as read-only audit only; no code, tests, scripts, configs, docs, migrations, gates, live scanner calls, or live object-store calls were changed or run.
- Keep live external malware scanner acceptance separate from local mocked scanner boundary, live S3/R2 object-store preflight, DB-backed browser acceptance, worker cleanup/reconciliation, and public upload rollout.
- Any future scanner preflight should be opt-in, operator-approved, dry-run-first, live-gated by explicit consent flags, and absent from default `ci:local`, `gates.mjs`, and Playwright flows.
- Retained scanner evidence should be text/JSON, summary-only, scanner-passed, and safe to archive without raw endpoint, token, request headers, request body, vendor response body, filenames, hashes, object keys, signed URLs, cookies, or DB URLs.

## Risks
- A real scanner vendor may return verbose malware names, policy text, stack traces, or request IDs that become sensitive if logged or stored.
- A harness that wraps `fetch` naively can leak the bearer token, endpoint, raw file body, or response body even though the app runtime currently collapses errors.
- Screenshot, HAR, trace, compressed, PDF, or binary evidence can bypass text scanning; current scanner skips image bytes and rejects known compressed/container extensions rather than inspecting them.
- Without a scanner-specific preflight command, teams may mistakenly cite the object-store preflight or local mocked scanner tests as live malware-engine acceptance.
- Silent upload failure behavior is no-leak friendly but weak for operations; absent generic metrics/audit can make scanner outages invisible outside the future preflight process.

## Verification/tests
- RUN this session: source, test, script, and docs inspection only.
- NOT RUN: `npm test`; focused LMS/config/scanner Vitest; `npm run typecheck`; `npm run typecheck -w @wtc/web`; `npm run lint`; `npm run secret:scan`; `npm run governance:check`; `node scripts/gates.mjs full`; `node scripts/gates.mjs e2e`; `npm run e2e:lms:db`; `npm run e2e:lms:db:managed`; `npm run accept:lms:object-storage -- --dry-run`; `npm run accept:lms:object-storage -- --live`; any live external malware scanner call; any live S3/R2 call; any DB command; any server process.
- Verified by source inspection that current external scanner mode is HTTPS/token gated, bounded by timeout, scanner-before-storage, fail-closed on unavailable/malformed responses, and does not send filename or content hash in the scanner request envelope.
- Verified by source inspection that current upload audit payloads avoid raw quarantine reason, endpoint, token, request headers, bytes, storage keys, and provider/scanner response bodies.
- Verified by source inspection that the generated artifact scanner now rejects scanner endpoint/token assignments and many object-store/live evidence leak markers, but remains a text-focused scanner that skips image bytes and rejects rather than inspects containers.

## Next actions
1. Add `scripts/lms-external-scanner-live-preflight.mjs` and `accept:lms:scanner` as a scanner-only opt-in command with `--dry-run` and `--live` modes, explicit live consent flags, safe test corpus configuration, and no default gate wiring.
2. Reuse or extract the existing scanner config rules so the preflight enforces the same HTTPS/no-credentials/no-query/no-fragment endpoint, bearer token, and timeout semantics as the app.
3. Make the preflight output only redacted summary evidence under a dedicated root such as `logs/lms-scanner-preflight`, then run `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight` before any archive.
4. Add static and integration tests proving the scanner preflight never prints endpoint/token/auth headers/vendor body/request body, refuses missing consent, stays out of default gates, and fails on representative clean/quarantine/failure/timeout fixture outcomes.
5. Keep public uploads disabled until live scanner acceptance, live object-store acceptance, observed DB-backed browser acceptance, cleanup/reconciliation acceptance, retained-artifact scanning, and explicit operator rollout approval are all separately RUN/PASS.
