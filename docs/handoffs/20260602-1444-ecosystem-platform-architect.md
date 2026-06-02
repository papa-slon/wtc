# ecosystem-platform-architect handoff
## Scope
Read-only platform architecture audit for Phase 3.55 retained screenshot/OCR evidence policy. Scope covered evidence/artifact scanning, script organization, package boundaries, acceptance docs, and whether the policy belongs in scripts, packages, or docs only.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/ARCHITECTURE.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`, `docs/handoffs/20260602-1357-phase-3-54-child-output-redaction.md`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/redacted-child-process.mjs`, `scripts/gates.mjs`, `tests/integration/lms-db-e2e-artifact-scan.test.ts`, `tests/e2e/smoke.spec.ts`, `tests/e2e/lms-db-materials.spec.ts`, `playwright.config.ts`, `playwright.lms-db.config.ts`, `package.json`, `.gitignore`, and `.secretlintignore`.

## Files changed
None — read-only audit

## Findings
1. Severity: High. The retained-artifact scanner includes screenshot roots but intentionally skips image bytes, so a scanner PASS is not screenshot leak proof. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:6`, `scripts/scan-lms-db-e2e-artifacts.mjs:11`, `scripts/scan-lms-db-e2e-artifacts.mjs:251`-`255`, `tests/integration/lms-db-e2e-artifact-scan.test.ts:300`-`304`. Recommendation: Phase 3.55 should add a retained visual-artifact policy gate that fails or separately marks screenshots as unverified unless OCR/manual review evidence exists. Target part: retained visual evidence scanner boundary.
2. Severity: High. E2E writes durable PNGs while secretlint ignores PNG/ICO files, so current `secret:scan` including screenshots language is stronger than tool coverage. Evidence: `tests/e2e/smoke.spec.ts:4`-`10`, `tests/e2e/lms-db-materials.spec.ts:251`-`253`, `.secretlintignore:16`-`17`, `docs/ACCEPTANCE_MATRIX_MASTER.md:14`. Recommendation: update acceptance wording to separate text secret scan, text artifact scan, and visual artifact review/OCR. Target part: acceptance matrix and evidence claims.
3. Severity: Medium. Current docs acknowledge this gap, but no global acceptance gate names it. Evidence: `docs/DEPLOYMENT.md:272`-`277` says screenshots need human review; `docs/DEPLOYMENT.md:300`-`303` says screenshots/binary files are not proven safe by stdout redaction; `docs/NEXT_ACTIONS.md:10`-`23` lists screenshot OCR as NOT RUN / next safety slice. Recommendation: add a dedicated retained visual artifacts row to `docs/ACCEPTANCE_MATRIX_MASTER.md` and carry RUN/NOT RUN status into status docs. Target part: docs acceptance matrix.
4. Severity: Medium. This should be script-only plus docs, not a new package helper. Evidence: packages are domain/runtime boundaries in `docs/ARCHITECTURE.md:42`-`57`; app/domain work is delegated to packages at `docs/ARCHITECTURE.md:107`; new packages require ADR justification at `docs/ARCHITECTURE.md:433`-`445`. Recommendation: implement as a sibling script such as `scripts/check-retained-visual-artifacts.mjs`, with integration tests. Do not add `@wtc/*` package code unless OCR becomes reusable runtime/domain functionality. Target part: monorepo/package boundary.
5. Severity: Medium. OCR/review needs the same dynamic marker discipline as the text scanner. Evidence: dynamic markers are loaded and value-suppressed in `scripts/scan-lms-db-e2e-artifacts.mjs:145`-`172`; the LMS DB browser spec emits dynamic filename/body/hash/embed markers at `tests/e2e/lms-db-materials.spec.ts:119`-`130`; the runner creates and deletes the transient marker manifest at `scripts/run-lms-db-e2e.mjs:7`-`8`, `:23`-`27`, `:101`-`107`. Recommendation: visual/OCR review should consume compatible marker labels and report labels only, never marker values. Target part: OCR/review manifest design.
6. Severity: Low. Keep long-running preview streams out of Phase 3.55 unless explicitly scoped. Evidence: `docs/STATUS.md:10`-`12` excludes `safe-preview.mjs` from retained evidence; `docs/DEPLOYMENT.md:309`-`310` says not to archive raw preview output. Recommendation: Phase 3.55 should target generated Playwright artifacts and retained screenshots only; long-running `safe-preview` retained-output policy remains a separate slice. Target part: phase scope.

## Decisions
Recommended implementation shape: script-only tooling plus docs acceptance updates. Do not implement as docs-only because the repo already documents the gap but still lacks an enforceable visual artifact policy. Do not implement as a package helper because this is operator evidence governance, not product/domain runtime logic.

## Risks
A naive OCR gate can leak the text it is checking if it prints matched OCR output. A manifest-only manual review gate can become box-checking unless it pins screenshot path, reviewer/tool, timestamp, and marker labels reviewed. Treat all screenshot proof as NOT RUN unless the visual gate is observed in the current session.

## Verification/tests
No tests or gates were run by the auditor; this was read-only inspection only.

## Next actions
1. Add a dedicated retained visual-artifact policy script or scanner mode.
2. Add integration tests proving PNGs are not silently treated as scanner-clean leak proof.
3. Add a review/OCR manifest shape that consumes dynamic marker labels without printing values.
4. Update `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, and the next-session prompt with exact RUN/NOT RUN semantics.
5. Keep package/app code untouched unless a later scoped phase requires runtime OCR behavior.
