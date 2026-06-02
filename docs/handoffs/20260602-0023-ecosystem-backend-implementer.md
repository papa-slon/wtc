# ecosystem-backend-implementer handoff
## Scope
Phase 3.20 read-only LMS/backend audit for artifact scanner alignment with LMS material and download implementation. Inspected the DB-backed LMS browser spec, LMS student/teacher query mapping, material download handler, admin audit rendering, DB repository audit/download metadata, and docs that define the opt-in DB browser acceptance artifact expectations. No product code, docs, servers, Playwright, databases, `psql`, migrations, seeds, or live endpoints were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `playwright.lms-db.config.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/lib/backend.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.ts`
- `packages/db/src/repositories.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The artifact-scan requirement exists, but the exact scanner markers are still not codified as a local command or test, so acceptance can drift once `npm run e2e:lms:db` is finally run. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:68-70` requires the DB upload/download gate to archive and scan artifacts for no raw bytes/base64/storage keys; `docs/DEPLOYMENT.md:67-69` tells the operator to keep `test-results/`, `playwright-report/`, and `tests/e2e/screenshots/lms-db-material-lesson-*.png`; `scripts/run-lms-db-e2e.mjs:52` prints the same archive reminder; `playwright.lms-db.config.ts:41-42` captures screenshots/traces only on failure/retain-on-failure, so generated artifacts are not guaranteed unless the command fails or the mobile screenshot path runs. Recommendation: add a local artifact-scan script or static verifier before accepting the DB browser gate. The generated-artifact denylist should scan only generated artifacts, not source files, and should fail on these exact markers: `db-backed lms acceptance`, `ZGItYmFja2VkIGxtcyBhY2NlcHRhbmNl`, `EICAR-STANDARD-ANTIVIRUS-TEST-FILE`, `RUlDQVItU1RBTkRBUkQtQU5USVZJUlVTLVRFU1QtRklMRQ==`, `fileBytesBase64`, `storageKey`, `lms/materials/`, `<iframe src="https://player.vimeo.com/video/123456789"`, `&lt;iframe`, and `PGlmcmFtZSBzcmM9Imh0dHBzOi8vcGxheWVyLnZpbWVvLmNvbS92aWRlby8xMjM0NTY3ODki`. Target part: DB-backed LMS browser artifact scanner.

2. Severity: Medium. The current browser no-leak helper is page-HTML only; failed download responses do not yet prove that denial bodies and denial headers exclude material bytes, storage fields, file names, hashes, and success-only headers. Evidence: `tests/e2e/lms-db-materials.spec.ts:14-20` checks rendered HTML for plaintext, base64, `fileBytesBase64`, `storageKey`, and `lms/materials/`; `tests/e2e/lms-db-materials.spec.ts:29-34` checks unauthenticated `401` body only for `{ error: 'unauthenticated' }`; `tests/e2e/lms-db-materials.spec.ts:141-144` checks non-entitled `403` body only for `entitlement_denied`; `tests/e2e/lms-db-materials.spec.ts:156-159` checks malformed ID `400` body only for `invalid_material_id`; `apps/web/src/features/lms/material-download.ts:49-58` returns those denial JSON bodies before any DB row streaming, while `apps/web/src/features/lms/material-download.ts:31-39` sets success-only file headers including `content-disposition` and `x-lms-sha256`. Recommendation: add a local `expectNoDownloadResponseLeak(response, text, fileName?)` helper and apply it to the 401, 403, and 400 responses; assert the body text omits plaintext/base64, `fileBytesBase64`, `storageKey`, `lms/materials/`, `contentSha256`, `storageProvider`, `retainedUntil`, `quarantineReason`, `db-local`, the clean file name, and that failed responses do not include `x-lms-sha256`, `content-disposition`, or a clean-file `content-length`. Target part: DB browser failed-download assertions.

3. Severity: Medium. The LMS student material DTO still carries internal lifecycle metadata that is not currently rendered, so artifact scanning must distinguish rendered leaks from legitimate server-side metadata. Evidence: `packages/lms/src/types.ts:60-76` includes `contentSha256`, `storageProvider`, `scanStatus`, `quarantineReason`, `retainedUntil`, `deletedAt`, and `embedHtml` on `MaterialView`; `apps/web/src/features/lms/queries.ts:64-79` maps file material `contentSha256`, `storageProvider`, `quarantineReason`, `retainedUntil`, and `deletedAt` into that view; `apps/web/src/features/lms/queries.ts:284-300` loads student lesson materials through `listMaterials()` and `toMaterialView()`; the student page renders only size, scan status, download URL, and sanitized embed frame at `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:141-157`. Recommendation: either trim the student material DTO to fields the page renders, or add local assertions that rendered HTML and failed-response bodies do not contain `contentSha256`, the exact clean-file sha256 value, `storageProvider`, `db-local`, `retainedUntil`, `quarantineReason`, or `deletedAt`. Do not globally ban `contentSha256` or `x-lms-sha256` from all traces because the clean successful download intentionally returns `x-lms-sha256` and the DB audit metadata intentionally records the content hash. Target part: LMS material DTO/no-leak boundary.

4. Severity: Medium. Admin audit rendering aligns with the no-leak goal, but artifact assertions should explicitly protect that rendering contract. Evidence: `packages/db/src/repositories.ts:711-724` records material upload audit metadata without `fileBytesBase64` or raw `storageKey`, using `hasStorageKey` instead; `packages/db/src/repositories.ts:833-848` records download audit metadata with file name, MIME, size, content hash, storage provider, scan status, and retention, but not file bytes or storage key; `apps/web/src/lib/backend.ts:102-111` maps recent audit rows to id, timestamp, actor role, action, target type/id, and result only; `apps/web/src/app/admin/audit-log/page.tsx:31-33` renders actor, action, and truncated target only; `tests/e2e/lms-db-materials.spec.ts:169-171` checks action visibility and existing material no-leak markers. Recommendation: add an admin-page-specific assertion after navigating to `/admin/audit-log` that the page content omits `contentSha256`, the exact clean-file sha256 value, `storageProvider`, `db-local`, `retainedUntil`, `hasStorageKey`, `fileBytesBase64`, `storageKey`, and `lms/materials/`. Target part: admin audit rendering acceptance.

5. Severity: Medium. Sanitized iframe rendering is aligned in code, but the DB browser no-leak checks do not yet assert all security-relevant iframe attributes or artifact markers. Evidence: `packages/lms/src/materials.ts:117-133` defines EICAR/quarantine and local storage key generation, and `packages/lms/src/materials.ts:146-154` prepares scan status, storage key, quarantine reason, and retention; `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:10-21` renders sanitized iframe props with fixed `sandbox`, `referrerPolicy`, `allow`, and `allowFullScreen`; `tests/e2e/lms-db-materials.spec.ts:23-27` checks the page does not contain raw or escaped iframe source; `tests/e2e/lms-db-materials.spec.ts:129-133` checks iframe visibility/src and existing page no-leak helpers. Recommendation: extend the iframe block to assert `sandbox="allow-scripts allow-same-origin allow-presentation"`, `referrerpolicy="no-referrer"`, `loading="lazy"`, no `srcdoc`, and expected `allow`; keep raw/escaped iframe and raw-iframe base64 markers in the generated-artifact denylist. Target part: sanitized embed browser acceptance.

6. Severity: High. The DB-backed browser acceptance path still cannot be accepted as observed until the throwaway Postgres run and post-run artifact scan actually happen. Evidence: `docs/STATUS.md:12-15` marks `npm run e2e:lms:db` NOT RUN and lists observed DB-backed browser acceptance as still open; `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` keeps production LMS uploads/embeds blocked on the observed DB browser run plus object storage, malware scanning, signed redirects, quarantine cleanup, and public rollout; `docs/DEPLOYMENT.md:57-70` requires a fresh `wtc_test_lms_*` DB, `LMS_E2E_DATABASE_URL`, the supported command, evidence archive, and DB drop. Recommendation: do not treat source-level scanner alignment as acceptance; next implementation lane should add the local artifact scanner/no-leak assertions, then the operator must run `npm run e2e:lms:db` against a fresh empty DB and scan generated artifacts before clearing the gate. Target part: LMS DB acceptance governance.

## Decisions
- Treat generated artifacts as `test-results/`, `playwright-report/` if generated, LMS DB screenshots under `tests/e2e/screenshots/lms-db-material-lesson-*.png`, and any captured command/stdout summaries for the DB browser run.
- Treat raw file body markers, raw/base64 EICAR markers, storage field names, storage path prefixes, and raw/escaped iframe markers as forbidden generated-artifact strings.
- Do not recommend globally banning `x-lms-sha256`, `contentSha256`, or the clean sha256 value from every trace, because the successful download response intentionally exposes `x-lms-sha256` and DB audit metadata intentionally stores the content hash. Scope those checks to rendered pages, admin audit rendering, failed responses, and redacted artifacts.
- Keep this phase read-only and do not broaden into production object storage, external malware scanning, signed-object redirect, quarantine cleanup, or the actual throwaway DB run.

## Risks
- A naive artifact scanner that scans source files will fail on intentional test fixture strings in `tests/e2e/lms-db-materials.spec.ts`; it must scan generated artifacts only.
- A naive scanner that globally denies `x-lms-sha256` or the expected clean-file sha256 can false-positive on successful download traces. This is a product-intended integrity header, not a byte/storage-key leak.
- Current DTO shape still makes internal file metadata available to server-rendered material views; even if it is not visibly rendered today, future page edits can accidentally expose it unless the DTO is trimmed or no-leak assertions are widened.
- `npm run e2e:lms:db` remains unobserved in this audit, so all browser/spec conclusions are source-alignment conclusions only.

## Verification/tests
- RUN: read-only static/source inspection with `rg`, `Get-Content`, and local marker derivation for the exact base64 strings listed above.
- NOT RUN: servers, Playwright, `npm run e2e:lms:db`, default e2e, Vitest, typecheck, lint, DB commands, `psql`, migrations, seeds, live endpoints, Stripe, Axioma, TradingView, bot/exchange, preview/prod server, object storage, malware scanner, SSH, tmux, or systemd.

## Next actions
1. Add a generated-artifact scanner for the LMS DB browser run that scans only generated artifacts and fails on the exact denylist from Finding 1.
2. Add `expectNoDownloadResponseLeak()` to `tests/e2e/lms-db-materials.spec.ts` and apply it to 401/403/400 responses before the real DB run.
3. Add rendered-page/admin no-leak assertions for internal metadata strings: `contentSha256`, exact clean sha256, `storageProvider`, `db-local`, `retainedUntil`, `quarantineReason`, `deletedAt`, and `hasStorageKey`.
4. Add iframe attribute assertions for sanitized embeds.
5. After those local harness assertions are in place, run `npm run e2e:lms:db` only with a fresh empty `wtc_test_lms_<timestamp>` database, archive and scan artifacts, then drop the throwaway DB.
