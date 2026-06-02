# ecosystem-security-auditor handoff
## Scope
Phase 3.20 read-only security audit for the LMS DB e2e artifact no-leak scanner. Scope was limited to source and artifact-surface inspection: LMS DB e2e markers, material download/audit/no-leak boundaries, Playwright artifact paths, secretlint config, existing logs/test-results directories, and current docs. No product code was edited. No servers, Playwright, database mutation, `psql`, migrations, seeds, or live endpoints were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`
- `docs/handoffs/20260601-2355-ecosystem-security-auditor.md`
- `package.json`
- `.secretlintrc.json`
- `.secretlintignore`
- `.gitignore`
- `scripts/gates.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `apps/web/src/features/lms/material-download.ts`
- `apps/web/src/app/api/education/materials/[materialId]/download/route.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/features/lms/queries.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `packages/lms/src/types.ts`
- `packages/lms/src/materials.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`
- `logs/gates/e2e.log`
- `logs/gates/secret_scan.log`
- `test-results/.last-run.json`
- `tests/e2e/screenshots/*` file listing

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:68-70` requires LMS DB browser artifacts to be archived/scanned for no raw bytes/base64/storage keys before the gate is accepted, but `.secretlintignore:8-11` excludes `test-results`, `playwright-report`, and `*.png`, while `package.json:17` only defines generic `secret:scan`. Recommendation: add a dedicated artifact scanner command for the LMS DB e2e output instead of relying on `secret:scan`. Target part: artifact no-leak acceptance gate.

2. Severity: High. Evidence: the current default Playwright gate skipped the LMS DB spec at `logs/gates/e2e.log:11` and `logs/gates/e2e.log:37`; `test-results/.last-run.json` contains only the last default run status; no `tests/e2e/screenshots/lms-db-material-lesson-*.png` files exist; and `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md:74-76` says `npm run e2e:lms:db` was not run. Recommendation: do not accept Phase 3.20 as evidence of DB-backed browser cleanliness until a fresh `wtc_test_lms_*` run produces artifacts and the scanner passes. Target part: observed artifact evidence.

3. Severity: Medium. Evidence: `tests/e2e/lms-db-materials.spec.ts:14-21` checks rendered HTML for plaintext bytes, base64, `fileBytesBase64`, `storageKey`, and `lms/materials/`, but the same spec reads the successful clean download body at `tests/e2e/lms-db-materials.spec.ts:147-154`; `playwright.lms-db.config.ts:41-42` retains screenshots/traces on failure, and the mobile branch writes a screenshot at `tests/e2e/lms-db-materials.spec.ts:161-163`. Recommendation: scan generated Playwright traces/reports/test-results and explicit screenshots after the opt-in run, not only DOM HTML during the test. Target part: browser artifact leak surface.

4. Severity: Medium. Evidence: `packages/lms/src/types.ts:60-76` defines material DTO fields that include file metadata (`contentSha256`, `storageProvider`, `quarantineReason`, `retainedUntil`, `deletedAt`), and `apps/web/src/features/lms/queries.ts:68-79` populates those fields for file materials. The student page only renders title/type/size/scan status/download/embed at `apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx:149-157`, and the admin audit page renders only narrow audit columns at `apps/web/src/app/admin/audit-log/page.tsx:26-34`. Recommendation: include serialized RSC/network artifacts in the scanner and either trim unused metadata from student DTOs or explicitly allow only non-secret fields. Target part: serialization and audit no-leak boundary.

5. Severity: Medium. Evidence: the exact source markers for a scanner are already present: generated file names and plaintext start at `tests/e2e/lms-db-materials.spec.ts:43-45`; the raw embed fixture starts at `tests/e2e/lms-db-materials.spec.ts:46`; current no-leak marker strings are listed at `tests/e2e/lms-db-materials.spec.ts:14-21`; demo login uses `wtc-demo-pass-123` at `tests/e2e/helpers/auth.ts:3`; and the seeded DB uses the same demo password at `packages/db/src/seed.ts:12`. Recommendation: centralize a forbidden-pattern manifest for the artifact scanner so the test fixture, scanner, and docs do not drift. Target part: forbidden marker definition.

6. Severity: Low. Evidence: `scripts/run-lms-db-e2e.mjs:52` prints a reminder to archive `test-results/`, `playwright-report/`, and LMS DB screenshots, while `docs/DEPLOYMENT.md:67-70` tells the operator to keep redacted command/stdout summary plus those artifacts. There is no scanner report path or redaction guarantee today. Recommendation: have the scanner emit only path/count/category summaries, never matched secret text or connection strings; store the report under a deterministic safe path such as `logs/lms-db-e2e-artifact-scan.json`. Target part: scanner report hygiene.

## Decisions
- Treat `secret:scan` as a source/config gate only for this purpose; it is not an LMS DB browser artifact scanner because the relevant artifact paths are ignored.
- Safe paths to scan after a future `npm run e2e:lms:db` run: `test-results/**`, `playwright-report/**` if generated, `tests/e2e/screenshots/lms-db-material-lesson-*.png`, and a redacted LMS DB e2e stdout log if one is deliberately captured.
- Do not scan the entire repo for the LMS artifact gate; source files intentionally contain fixture markers and would create false positives.
- Do not archive `.next-e2e-db/lms-db-e2e-prepared.json`; the runner is expected to delete it, and any leftover marker should be treated as cleanup evidence rather than acceptance evidence.
- The scanner should expand Playwright trace archives in memory or a temp directory and report only filenames/categories, not excerpts.

## Risks
- A future failed LMS DB Playwright run could retain traces that include the clean downloaded file body, session cookies, or request/response details.
- PNG screenshots are ignored by secretlint and need either OCR/manual inspection or a narrow rule that only approved LMS DB screenshots are retained.
- `LMS_E2E_DATABASE_URL` contains credentials; operator command logs or shell transcripts can leak it if archived without redaction.
- Student DTO metadata is broader than rendered UI needs, so serialized payload artifacts may expose internal storage/scan metadata even when DOM text is clean.

## Verification/tests
RUN:
1. Static/source inspection of the files listed above.
2. Existing artifact inventory: `test-results/` currently contains only `.last-run.json`; no `playwright-report/` or `.next-e2e-db/` directory was present; no `tests/e2e/screenshots/lms-db-material-lesson-*.png` file was present.
3. Read-only marker scan over `logs` and `test-results` for LMS fixture bytes, storage-key markers, DB URLs, demo password, bearer/basic/auth hash markers, and raw embed markers. Result: no matches in those artifact directories.

NOT RUN:
1. `npm run e2e:lms:db` - no fresh throwaway `LMS_E2E_DATABASE_URL` was provided, and the command would mutate a database and start Playwright.
2. Playwright/default e2e, browser servers, Next dev/preview/production servers, DB setup/migration/seed, `psql`, or live endpoints - forbidden by this read-only audit request.
3. `npm run secret:scan`, focused Vitest, full gates, or source-changing scanner implementation - outside this read-only handoff scope.
4. OCR/image-content inspection of PNG screenshots - no LMS DB screenshot artifact exists yet.

## Next actions
1. Add a repo-native LMS artifact scanner, for example `scripts/scan-lms-db-e2e-artifacts.mjs`, and wire it as an explicit post-step after `npm run e2e:lms:db`.
2. Initial forbidden marker categories should include: `db-backed lms acceptance`, base64 prefix `ZGItYmFja2VkIGxtcyBhY2NlcHRhbmNl`, `EICAR-STANDARD-ANTIVIRUS-TEST-FILE`, `fileBytesBase64`, `storageKey`, `storage_key`, `lms/materials/`, raw unsanitized Vimeo iframe fixture shape, `wtc-demo-pass-123`, `postgres://`/`postgresql://`, `LMS_E2E_DATABASE_URL=` with a non-placeholder value, `SESSION_SECRET=`, `SECRET_VAULT_KEK=`, `LMS_DB_E2E_PREP_TOKEN=`, `Cookie:`, `Set-Cookie:`, `Bearer `, `Basic `, and `$argon2id$`.
3. Add an allowlist for expected non-secret evidence, such as the literal action `education.material_download`, status text (`clean`, `quarantined`, `download unavailable`), and `x-lms-sha256` headers when they appear only as the expected response header name.
4. After scanner implementation, run it against the current artifact directories with no LMS DB artifacts to prove empty/absent paths are handled, then run it after the first fresh throwaway DB browser acceptance run.
5. Keep the acceptance wording strict: `npm run e2e:lms:db` is not accepted until the command exits 0, the throwaway DB is dropped, and the artifact scanner report is clean.
