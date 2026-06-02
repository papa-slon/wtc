# ecosystem-devops-implementer handoff
## Scope
Read-only devops audit for Phase 3.55 retained screenshot/OCR evidence policy. Scope covered deployment/runbook artifact guidance, `logs/gates` behavior, retained-artifact scanner behavior, `.gitignore` / `.secretlintignore`, Playwright output directories, CI artifact upload, package scripts, and current generated artifacts. No live server, DB, provider, SSH, nginx, systemd, or bot activity.

## Files inspected
`AGENTS.md`, `README.md`, `package.json`, `.gitignore`, `.secretlintignore`, `.github/workflows/ci.yml`, `playwright.config.ts`, `playwright.lms-db.config.ts`, `docs/DEPLOYMENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_54_20260602.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `scripts/gates.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/redacted-child-process.mjs`, `scripts/run-lms-db-e2e.mjs`, `scripts/run-lms-db-e2e-managed.mjs`, `tests/e2e/*.spec.ts`, `logs/gates/*`, `test-results/`, and `tests/e2e/screenshots/`.

## Files changed
None — read-only audit

## Findings
1. Severity: High. Screenshot/OCR retention is explicitly not covered by the current retained-output policy. Evidence: `docs/DEPLOYMENT.md:300`-`303` says screenshots/traces/binaries are separate artifact/OCR evidence and not proven safe by stdout/stderr redaction; `scripts/scan-lms-db-e2e-artifacts.mjs:251`-`255` skips image bytes; `.secretlintignore:16` ignores all `*.png`. Recommendation: add a retained visual artifact policy that treats screenshots as unsafe until OCR text sidecars or a documented manual visual-review record pass forbidden-marker checks. Target part: deployment runbook / retained visual evidence.
2. Severity: Medium. Generated screenshots are durable in `tests/e2e/screenshots/`, while only temporary PNGs are ignored. Evidence: `.gitignore:22`-`26` ignores `test-results/`, `playwright-report/`, and `tests/e2e/screenshots/*.tmp.png` only; `tests/e2e/smoke.spec.ts:4`-`10` writes regular PNGs; current filesystem inspection found about 69 files / 30 MB in that directory. Recommendation: move per-run screenshots to an ignored retained-artifact root with a manifest, or explicitly split reviewed baseline screenshots from generated evidence screenshots. Target part: Playwright output dirs / ignore policy.
3. Severity: Medium. The retained-artifact scanner is useful but LMS/text-oriented, and its PASS output can be overclaimed for screenshots. Evidence: default roots include `tests/e2e/screenshots` at `scripts/scan-lms-db-e2e-artifacts.mjs:6`; image extensions are skipped at `scripts/scan-lms-db-e2e-artifacts.mjs:11` and `:251`-`:255`; scanner reports skipped image counts as part of a PASS at `scripts/scan-lms-db-e2e-artifacts.mjs:274`-`277`. Recommendation: document it as text-artifact scanning and add a separate visual/OCR scan command. Target part: artifact scan scripts.
4. Severity: Medium. `logs/gates` can contain stale unplanned logs beside a fresh summary. Evidence: `logs/gates/summary.txt:1`-`11` shows a current `full` run with 9 gates and no e2e; `scripts/gates.mjs:43`-`50` confirms `full` excludes e2e; `logs/gates/e2e.log:2` still contains full Playwright output. Recommendation: write gate logs under per-run IDs or archive only manifest-listed logs from the current plan after scan; do not archive the whole `logs/gates` directory blindly. Target part: gate log retention / archiving.
5. Severity: Medium. Staged CI would upload screenshots without OCR/scan gating or an explicit retention period. Evidence: CI is currently staged/inert at `.github/workflows/ci.yml:1`, but the e2e job uploads `tests/e2e/screenshots/**` at `.github/workflows/ci.yml:120`-`126` with no `retention-days` and no prior visual scan step. Recommendation: before enabling GitHub CI, add OCR/manual-review or artifact scan gating before upload, set short `retention-days`, and upload only approved artifacts plus manifest. Target part: CI artifact retention.

## Decisions
Current scanner PASS is only evidence that generated text/log artifacts matched no configured forbidden text patterns. It is not screenshot leak proof, OCR proof, trace safety proof, or permission to archive unreviewed binary artifacts.

## Risks
Unreviewed screenshots can retain plaintext secrets, cookies, internal IDs, raw preview coordinates, user/account data, or LMS material metadata even when text logs are clean. Future CI enablement could remotely retain screenshot artifacts by default. Stale `logs/gates` files can be accidentally archived as current evidence unless archive scope is manifest-driven.

## Verification/tests
Read-only commands run by the auditor: `git rev-parse --is-inside-work-tree` returned not git-backed; `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` PASS with 15 text files; `node scripts/scan-lms-db-e2e-artifacts.mjs tests/e2e/screenshots` PASS but 68 image files skipped; `node scripts/scan-lms-db-e2e-artifacts.mjs test-results` PASS with 1 text file. Not run: `npm run e2e`, `node scripts/gates.mjs full`, `npm run secret:scan`, live acceptance, deploy, DB mutation, SSH/nginx/systemd checks, provider calls, OCR tooling.

## Next actions
1. Add a Phase 3.55 retained screenshot/OCR policy to deployment and acceptance docs.
2. Add a visual artifact scan/review command and package script, then wire it into LMS DB/e2e evidence archive instructions.
3. Change generated screenshot retention to an ignored per-run artifact root or add a clear reviewed-baseline vs generated-evidence split.
4. Make `logs/gates` archive scope per-run/manifest-driven so stale logs are not bundled.
5. Update staged CI screenshot upload to run after visual policy checks and set explicit short retention.
