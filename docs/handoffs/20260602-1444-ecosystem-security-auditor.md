# ecosystem-security-auditor handoff
## Scope
Read-only security audit for Phase 3.55 retained screenshot/OCR evidence policy. Scope covered screenshot/image artifacts, OCR gaps, secret-bearing screenshots, compressed artifacts, retained evidence, and secret/artifact scan rules. No file edits, live services, DB mutation, browser runs, or provider calls.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`, `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/lms-db-materials.spec.ts`, `tests/e2e/admin-mobile-pg8.spec.ts`, `tests/e2e/cabinet-pg9-mobile.spec.ts`, `playwright.config.ts`, `playwright.lms-db.config.ts`, `.github/workflows/ci.yml`, `.gitignore`, `.secretlintignore`, `.secretlintrc.json`, `package.json`, and selected admin/security UI files.

## Files changed
None — read-only audit

## Findings
1. Severity: High. Retained screenshot images are a scanner blind spot. Evidence: `AGENTS.md:77` forbids plaintext secrets in screenshots, `scripts/scan-lms-db-e2e-artifacts.mjs:11`-`12` classifies images separately, `scripts/scan-lms-db-e2e-artifacts.mjs:251`-`255` skips image bytes, `tests/integration/lms-db-e2e-artifact-scan.test.ts:300`-`304` proves a PNG containing `storageKey` still passes, and `.secretlintignore:16` excludes `*.png`. Recommendation: Phase 3.55 should make retained images fail closed unless an OCR/manual-review manifest marks them reviewed; scanner pass alone must not authorize screenshots. Target part: retained visual evidence scanner/policy.
2. Severity: High. CI uploads screenshots unconditionally without OCR/scanner gating or repo-local retention policy. Evidence: `.github/workflows/ci.yml:120`-`126` uploads `tests/e2e/screenshots/**` on `always()`, while `playwright.config.ts:16`-`17` and `playwright.lms-db.config.ts:41`-`42` retain screenshots/traces on failure. Recommendation: gate uploads behind screenshot review, upload only an allowlisted reviewed artifact set, and set explicit short retention for visual evidence. Target part: GitHub Actions e2e artifact upload.
3. Severity: Medium. Full-page screenshots cover security/admin surfaces that can become secret- or PII-bearing under real DB/operator data. Evidence: `tests/e2e/smoke.spec.ts:39`-`41` screenshots `/app/security`; `apps/web/src/app/(app)/app/security/page.tsx:41`-`42` renders API key/secret inputs and `apps/web/src/app/(app)/app/security/page.tsx:55`-`63` renders stored key masks; `tests/e2e/admin-mobile-pg8.spec.ts:20`-`32` and `:57` screenshot admin pages; `apps/web/src/app/admin/support/page.tsx:153`-`160` renders user ticket body; `apps/web/src/app/admin/users/page.tsx:87`-`89` renders emails. Recommendation: add retained-visual policy that requires demo/sanitized state and explicit review for admin/support/security screenshots. Target part: e2e screenshot evidence policy.
4. Severity: Medium. Compressed/container handling is fail-closed for a narrow set, but visual/video/binary containers remain incomplete. Evidence: scanner blocks only `.zip`, `.gz`, `.br`, `.pdf` at `scripts/scan-lms-db-e2e-artifacts.mjs:11`-`12`; Playwright traces are retained on failure at `playwright.config.ts:17` and `playwright.lms-db.config.ts:42`; Phase 3.54 says screenshots, traces, compressed artifacts, and binaries are not proven safe by text redaction at `docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md:37`-`38`. Recommendation: expand archive/video/container deny rules or require extraction plus scan/OCR before archive. Target part: retained artifact scanner binary/container policy.
5. Severity: Medium. Documentation overclaims screenshot coverage by `secret:scan`. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:14` says `secret:scan` proves secretlint clean including screenshots, but `package.json:17` runs text secretlint and `.secretlintignore:16` ignores `*.png`. Recommendation: separate screenshot safety from `secret:scan` until visual review/OCR is implemented and observed. Target part: acceptance-matrix truth.

## Decisions
Treat Phase 3.55 as a local evidence-safety phase, not live acceptance. Scanner text rules remain useful but are not sufficient for images, screenshots, traces, video, or compressed evidence. Screenshot retention should default-deny for real/operator data and require explicit reviewed artifacts.

## Risks
A green `secret:scan` or current artifact scan can create false confidence because images are skipped. Admin/support/security screenshots may be harmless in demo mode but risky against real DB state. OCR tooling was not available in this environment, so no screenshot content review was performed.

## Verification/tests
Read-only audit only. The auditor ran `node scripts/scan-lms-db-e2e-artifacts.mjs tests/e2e/screenshots`; it passed while reporting `68 image file(s)` skipped/handled as images, confirming the blind spot. `tesseract --version` was unavailable. No app tests, live gates, DB commands, browser runs, or mutation were run. `git status` showed this folder is not git-backed.

## Next actions
1. Implement a screenshot/OCR retained-artifact policy: default-deny images unless reviewed, produce a reviewed screenshot manifest, and fail if OCR/manual checks find denylisted markers.
2. Add tests proving PNGs with secret-like text no longer pass as accepted retained evidence.
3. Update CI upload and docs so screenshot safety is separate from `secret:scan` and text artifact scanning.
4. Expand compressed/binary deny rules or require extraction plus scan before retained evidence archive.
