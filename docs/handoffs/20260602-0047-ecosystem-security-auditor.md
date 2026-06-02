# ecosystem-security-auditor handoff
## Scope
Phase 3.21 read-only security audit of LMS DB browser no-leak/security assertions after Phase 3.20. Inspected failed download response bodies/headers, admin audit rendering, material metadata exposure, raw file bytes/base64/storage path coverage, cookies/auth/secret marker coverage, and iframe sandbox/referrer/allow/loading/srcdoc boundaries.

No product code, tests, or docs were edited except this required handoff. No servers, Playwright, DB, psql, migrations, seeds, live endpoints, or external services were used.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`
- `docs/handoffs/20260602-0023-ecosystem-security-auditor.md`
- `docs/handoffs/20260601-2355-ecosystem-security-auditor.md`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `packages/lms/src/materials.ts`
- `packages/lms/src/types.ts`
- `packages/db/src/repositories.ts`
- `packages/auth/src/session.ts`
- `apps/web/src/lib/session.ts`
- `test-results/.last-run.json`
- `tests/e2e/screenshots/*` file inventory

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: Phase 3.20 explicitly keeps the actual DB-backed browser acceptance gate NOT RUN until a fresh throwaway `LMS_E2E_DATABASE_URL` run exits 0, scanner exits 0, evidence is archived, and the DB is dropped (`docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md:71-75`, `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md:90-91`). Phase 3.20 only observed the scanner against current generated roots, not real LMS DB Playwright artifacts (`docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md:88`). Recommendation: do not accept LMS DB browser no-leak coverage until `npm run e2e:lms:db` is run against a fresh empty `wtc_test*` database, the scanner passes on the generated artifacts, the evidence is redacted/archived, and the throwaway DB is dropped. Target part: LMS DB browser acceptance.

2. Severity: Medium. Evidence: the DB browser spec now checks internal material markers in DOM and failed-response text, including `contentSha256`, `storageProvider`, `db-local`, `retainedUntil`, `quarantineReason`, `deletedAt`, and `hasStorageKey` (`tests/e2e/lms-db-materials.spec.ts:10-22`, `tests/e2e/lms-db-materials.spec.ts:58-70`, `tests/e2e/lms-db-materials.spec.ts:190-204`, `tests/e2e/lms-db-materials.spec.ts:217-220`). The artifact scanner's forbidden list does not include those metadata markers; it covers file bytes/base64, storage key/path, raw iframe, DB/env/auth strings, and password hashes (`scripts/scan-lms-db-e2e-artifacts.mjs:12-35`). The student material mapper still populates those metadata fields for file materials (`apps/web/src/features/lms/queries.ts:68-79`), and DB audit payloads retain non-byte metadata such as `contentSha256`, `storageProvider`, `quarantineReason`, and `retainedUntil` (`packages/db/src/repositories.ts:711-725`, `packages/db/src/repositories.ts:840-849`). Recommendation: align the artifact scanner with the browser spec's `INTERNAL_MATERIAL_MARKERS`, while explicitly documenting the intended allowed case for the successful `x-lms-sha256` download header. Target part: metadata no-leak artifact boundary.

3. Severity: Medium. Evidence: the scanner flags cookie/auth artifacts only for title-case colon headers (`Cookie:`/`Set-Cookie:`), bearer/basic values, and `$argon2id$` (`scripts/scan-lms-db-e2e-artifacts.mjs:31-34`). The e2e login route deliberately sets a session cookie (`apps/web/src/app/api/e2e/login/route.ts:19-27`), and the repo has concrete session cookie names `wtc_session` and `__Host-wtc_session` (`packages/auth/src/session.ts:32-38`, `apps/web/src/lib/session.ts:6-13`). Artifacts serialized as JSON or lower-case header maps can contain `cookie`, `set-cookie`, `authorization`, or cookie names without the scanner's title-case-colon shape. Recommendation: add fixed-string/regex scanner rules and tests for `wtc_session`, `__Host-wtc_session`, JSON/lowercase `"cookie"`, `"set-cookie"`, `"authorization"`, and raw 64-hex session-token-looking values when adjacent to cookie/auth header keys. Target part: cookies/auth/secret marker coverage.

4. Severity: Low. Evidence: the scanner intentionally skips image artifacts by extension (`scripts/scan-lms-db-e2e-artifacts.mjs:91-94`), while the LMS DB spec writes a mobile screenshot on the success path (`tests/e2e/lms-db-materials.spec.ts:223-225`) and Phase 3.20 records that screenshots remain visual artifacts needing human review (`docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md:69-70`). This audit found no `tests/e2e/screenshots/lms-db-material-lesson-*.png` artifact currently present, but the scanner pass still reports existing screenshot images as skipped. Recommendation: require either manual visual review/OCR for retained LMS DB screenshots or archive only the specifically approved LMS DB screenshots after confirming they do not display file bytes, storage paths, cookies, or raw embed HTML. Target part: screenshot artifact no-leak evidence.

5. Severity: Low. Evidence: failed-response source assertions improved materially: the helper reads failed response bodies and headers, checks leak markers, verifies no `x-lms-sha256`, no `content-disposition`, and no clean-file-sized `content-length` (`tests/e2e/lms-db-materials.spec.ts:58-70`), then applies that to unauthenticated, entitlement-denied, and invalid-ID paths (`tests/e2e/lms-db-materials.spec.ts:74-80`, `tests/e2e/lms-db-materials.spec.ts:200-205`, `tests/e2e/lms-db-materials.spec.ts:217-220`). The download handler returns `no-store` JSON on failures and only streams bytes on the successful clean-file path (`apps/web/src/features/lms/material-download.ts:24-28`, `apps/web/src/features/lms/material-download.ts:47-66`). Remaining gap: the browser spec does not explicitly assert failed responses have no `set-cookie` and expected JSON `content-type`. Recommendation: extend `expectNoDownloadResponseLeak` to assert no `set-cookie` header and JSON content-type on failed responses. Target part: failed-response body/header assertions.

## Decisions
- Treat Phase 3.21 as one read-only `ecosystem-security-auditor` lane requested by the operator, not as a broad N-agent phase.
- Treat admin audit rendering as currently data-minimal in DOM: the page renders time, actor role, action, target prefix, and result only (`apps/web/src/app/admin/audit-log/page.tsx:26-34`). The residual risk is artifact/RSC/trace exposure of wider audit payloads, not the visible admin table.
- Treat sanitized iframe rendering as source-covered for the requested boundary: source rejects `srcdoc`, unsafe handlers/scripts, non-allowlisted iframe attrs, non-https/unapproved origins, non-lazy loading, and non-`no-referrer` policy (`packages/lms/src/materials.ts:207-226`), and the DB browser spec asserts sandbox, referrer policy, loading, allow, absent `srcdoc`, and fullscreen state (`tests/e2e/lms-db-materials.spec.ts:82-90`, `tests/e2e/lms-db-materials.spec.ts:187-189`).
- Treat `node scripts/scan-lms-db-e2e-artifacts.mjs` as a read-only artifact inspection command, not as a browser/server/DB gate.

## Risks
- A green scanner run against current roots is not proof of the real LMS DB browser flow because no fresh DB-backed Playwright run has generated the target artifacts yet.
- If Playwright traces or request logs serialize headers as JSON/lowercase keys, the current scanner can miss session cookie/auth header leakage.
- Student material DTOs still carry more metadata than the visible student UI needs; current DOM/failed-response checks reduce exposure but do not remove the data boundary risk.
- Screenshots remain outside automated text scanning and require explicit visual review if retained.

## Verification/tests
RUN:
1. Static/source inspection of the files listed above.
2. `node scripts/scan-lms-db-e2e-artifacts.mjs` - PASS: 2 text files, 68 image files skipped as images, 0 blocked containers, 2 missing roots, 70 total artifact files.
3. Filesystem artifact inventory: no `playwright-report/`, no `logs/lms-db-e2e/`, no `.next-e2e-db/`, and no `tests/e2e/screenshots/lms-db-material-lesson-*.png` existed during this audit; `test-results/.last-run.json` contains `{"status":"passed","failedTests":[]}`.

NOT RUN:
1. `npm run e2e:lms:db` - forbidden by this audit request because it starts Playwright/server and mutates a throwaway DB.
2. Playwright/default e2e, browser servers, Next dev/preview/production servers, DB setup/migration/seed, psql, or live endpoints - explicitly forbidden by this audit request.
3. `npm test`, typecheck, full gates, migrations, seeds, or external services - outside the requested static/read-only security audit.

## Next actions
1. Add the missing metadata-marker and lower-case/JSON auth-header rules to `scripts/scan-lms-db-e2e-artifacts.mjs`, with focused scanner tests.
2. Add `set-cookie` absence and JSON content-type checks to failed download response assertions.
3. Run the full opt-in acceptance later only with a fresh empty `wtc_test*` database: `npm run e2e:lms:db`, then archive redacted evidence, confirm the artifact scanner passes on generated artifacts, visually review or discard LMS DB screenshots, and drop the throwaway DB.
