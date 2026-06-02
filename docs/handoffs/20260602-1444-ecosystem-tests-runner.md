# ecosystem-tests-runner handoff
## Scope
Read-only test audit for Phase 3.55 retained screenshot/OCR evidence policy. Scope inspected current coverage around `scripts/scan-lms-db-e2e-artifacts.mjs`, retained screenshots under `tests/e2e/screenshots`, screenshot/OCR/artifact-scanning tests, package scripts, and Playwright config. No file edits, Vitest runs, or Playwright runs.

## Files inspected
`AGENTS.md`, `package.json`, `apps/web/package.json`, `playwright.config.ts`, `playwright.lms-db.config.ts`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `scripts/gates.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/integration/lms-db-e2e-harness.test.ts`, `tests/integration/child-output-redaction.test.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/lms-db-materials.spec.ts`, `tests/e2e/admin-mobile-pg8.spec.ts`, `tests/e2e/cabinet-pg9-mobile.spec.ts`, `tests/e2e/backtester-pg10-mobile.spec.ts`, `tests/e2e/education-ph3-1-mobile.spec.ts`, `.secretlintignore`, `.gitignore`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, and the latest Phase 3.54 handoff.

## Files changed
None — read-only audit

## Findings
1. Severity: High. Screenshot roots are scanned only by path, not image content. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:6` includes `tests/e2e/screenshots`; `scripts/scan-lms-db-e2e-artifacts.mjs:11` classifies PNG/JPEG/WebP/GIF/ICO as images; `scripts/scan-lms-db-e2e-artifacts.mjs:251`-`254` skips image bytes; `tests/integration/lms-db-e2e-artifact-scan.test.ts:300` proves a PNG containing `storageKey` passes. Recommendation: add OCR/image-text extraction or fail closed unless a screenshot review manifest exists. Target part: retained screenshot scanner.
2. Severity: High. Default e2e gates generate retained screenshots but do not chain artifact scanning or OCR. Evidence: `package.json:27` maps `e2e` to plain `playwright test`; `scripts/gates.mjs:40` maps the e2e gate to `npx playwright test`; `tests/e2e/smoke.spec.ts:4` writes many screenshots under `tests/e2e/screenshots`. Recommendation: add a post-Playwright retained-artifact gate for default e2e or a dedicated retained-evidence command. Target part: e2e gate wiring.
3. Severity: High. LMS DB runner tells operators to archive LMS screenshots after the current scanner passes, but the scanner does not inspect screenshot pixels. Evidence: `scripts/run-lms-db-e2e.mjs:104` says to archive `tests/e2e/screenshots/lms-db-material-lesson-*.png` after scanner pass; `tests/e2e/lms-db-materials.spec.ts:251` writes the LMS DB screenshot; scanner skips image bytes at `scripts/scan-lms-db-e2e-artifacts.mjs:251`. Recommendation: require OCR/manual-review evidence before archiving LMS DB screenshots. Target part: LMS DB retained evidence policy.
4. Severity: Medium. Current documentation overclaims screenshot secret coverage. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:14` says `secret:scan` is clean including screenshots; `package.json:17` runs secretlint; `.secretlintignore:16` excludes all `*.png`. Recommendation: remove the screenshot claim or add OCR-backed image scanning. Target part: gate truth/docs.
5. Severity: Medium. Playwright failure artifacts can retain unreviewed screenshots/traces outside the normal scanner flow. Evidence: `playwright.config.ts:16` and `playwright.lms-db.config.ts:41` retain failure screenshots/traces; scanner fails closed on compressed artifacts but skips images at `scripts/scan-lms-db-e2e-artifacts.mjs:245` and `:251`. Recommendation: add a failure-artifact cleanup/review gate that blocks retained traces and OCR-checks failure screenshots before archive. Target part: failure evidence retention.

## Decisions
Current screenshot retention cannot be treated as scanner-clean. The existing retained-artifact scanner is a text/path/container gate, not OCR or image-content safety.

## Risks
Retained screenshots may visibly contain public preview URLs, account identifiers, cookies rendered in debug UI, internal LMS metadata, storage keys, hashes, filenames, or secret-shaped values while all current text scanners still pass.

## Verification/tests
Read-only audit only. The auditor ran `node scripts/scan-lms-db-e2e-artifacts.mjs`: PASS with `2` text files scanned, `68` image files skipped, `0` blocked containers, `2` missing roots, `70` total artifact files, `0` dynamic markers. Vitest and Playwright were not run because they can create temp logs, screenshots, reports, or browser artifacts.

## Next actions
1. Add visual/OCR scanner coverage with fixture images or OCR sidecars containing forbidden text such as `storageKey`, DB URLs, bearer tokens, public IP preview URLs, and `retainedUntil`.
2. Add clean-image positive and no-OCR/manual-manifest fail-closed tests.
3. Wire a retained screenshot/OCR gate into e2e evidence instructions without overclaiming default text scans.
4. Require a screenshot retention manifest with path, generated-at, source test, OCR/manual result, reviewer/tool, and staleness rule.
5. Update `docs/ACCEPTANCE_MATRIX_MASTER.md` so screenshots are not claimed covered by `secret:scan` unless OCR/review evidence exists.
