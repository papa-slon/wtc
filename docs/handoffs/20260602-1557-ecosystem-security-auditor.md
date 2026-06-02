# ecosystem-security-auditor handoff
## Scope
Phase 3.57 read-only security audit for symlink-hard preflight root confinement. Scope was limited to risks where symlinks, junctions, or other reparse points can bypass repo-local `logs/...` confinement or retained artifact root confinement, with focus on secret exfiltration through symlinked logs, traversal after filesystem resolution, unsafe output paths, and no-value-echo behavior.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260602-1338-phase-3-53-preflight-log-root-confinement.md`
- `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md`
- `docs/handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md`
- `package.json`
- `.gitignore`
- `.github/workflows/ci.yml`
- `scripts/preflight-log-root.mjs`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/lms-external-scanner-live-preflight.mjs`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/billing-stripe-checkout-preflight.mjs`
- `scripts/axioma-handoff-preflight.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `tests/integration/preflight-log-root.test.ts`
- `tests/integration/preflight-log-root-wiring.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`

## Files changed
None — read-only audit. This handoff file is the only allowed write: `docs/handoffs/20260602-1557-ecosystem-security-auditor.md`.

## Findings
1. Severity: High. Evidence: `scripts/preflight-log-root.mjs:24-28` confines the requested root only with `path.resolve()` plus lexical `relative()` checks, and `scripts/preflight-log-root.mjs:36-40` then calls `mkdirSync()` and `writeFileSync()` on that path. There is no `lstat`, `realpath`, symlink, junction, reparse-point, or existing-leaf-link check before write. The five preflight consumers all rely on this helper: `scripts/lms-s3-r2-live-preflight.mjs:43-50`, `scripts/lms-external-scanner-live-preflight.mjs:40-47`, `scripts/billing-stripe-webhook-replay-preflight.mjs:53-60`, `scripts/billing-stripe-checkout-preflight.mjs:37-44`, and `scripts/axioma-handoff-preflight.mjs:50-57`. Recommendation: make `writePreflightSummary()` physically confined, not just lexically confined: resolve the repo root and `logs` root with `realpathSync.native`, reject any existing path segment that is a symlink/junction/reparse point, verify the created directory's real path remains under the real repo `logs` root, reject existing symlink summary leaves, and write with exclusive/non-follow semantics where available. Target part: shared preflight summary root/output helper.

2. Severity: High. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:126-140` uses lexical workspace checks only, `scripts/scan-lms-db-e2e-artifacts.mjs:193-200` walks with `statSync()` and `readdirSync()`, `scripts/scan-lms-db-e2e-artifacts.mjs:222` accepts CLI roots through that lexical helper, and `scripts/scan-lms-db-e2e-artifacts.mjs:237-238` walks any existing root. `statSync()` follows symlinks, so an allowed-looking root such as `logs/gates` or a nested child below it can physically resolve outside the workspace. The scanner then reads file bytes at `scripts/scan-lms-db-e2e-artifacts.mjs:262-273`. Recommendation: introduce a shared artifact-root resolver that uses `lstat` before following entries, rejects symlinks/junctions/reparse points at roots and descendants, verifies `realpathSync.native()` for every scanned file remains under the real workspace and the real requested root, and refuses rather than scanning outside-workspace files. Target part: LMS DB retained artifact scanner root and recursive walk.

3. Severity: High. Evidence: `scripts/check-retained-visual-artifacts.mjs:63-73` repeats the same lexical-only workspace resolver, `scripts/check-retained-visual-artifacts.mjs:96-103` walks with symlink-following `statSync()`, and root scanning uses that result at `scripts/check-retained-visual-artifacts.mjs:256-267`. Review manifest artifact paths are resolved lexically at `scripts/check-retained-visual-artifacts.mjs:193-202`, and OCR sidecars are resolved and read at `scripts/check-retained-visual-artifacts.mjs:216-224` without physical confinement. A symlinked screenshot root, symlinked reviewed image, or symlinked OCR sidecar can therefore make off-workspace visual or text evidence look repo-local. Recommendation: reuse the same physical artifact confinement helper for visual roots, manifest artifact paths, dynamic marker manifests, and OCR sidecars; reject all symlinks/junctions/reparse points in retained visual evidence paths before inventory, manifest validation, or sidecar reads. Target part: retained visual artifact checker.

4. Severity: Medium. Evidence: the LMS text scanner intentionally scans file paths at `scripts/scan-lms-db-e2e-artifacts.mjs:250-253`, but failures are printed as `FAIL ${f.label}: ${f.rule}` at `scripts/scan-lms-db-e2e-artifacts.mjs:276-280`. If a generated artifact path itself contains a secret-shaped value or a dynamic marker value, the scanner can echo that value in the failure label while reporting the violation. Existing tests cover unsafe CLI roots and content no-echo, for example `tests/integration/lms-db-e2e-artifact-scan.test.ts:44-59`, `tests/integration/lms-db-e2e-artifact-scan.test.ts:217-245`, and `tests/integration/lms-db-e2e-artifact-scan.test.ts:283-301`, but they do not cover forbidden values in file or directory names. Recommendation: add a scanner-local `safeArtifactLabel()` equivalent to the visual checker's redaction pattern at `scripts/check-retained-visual-artifacts.mjs:92-94`, use it for every failure label, and add tests for secret-shaped filenames, dynamic marker values in paths, and path-triggered failures. Target part: LMS DB scanner no-value-echo output.

5. Severity: Medium. Evidence: `scripts/gates.mjs:24-25` hardcodes `LOG_DIR` to `logs/gates`, creates it at `scripts/gates.mjs:60`, derives per-gate log files at `scripts/gates.mjs:65`, writes retained logs at `scripts/gates.mjs:106`, and writes `summary.txt` at `scripts/gates.mjs:115`. This path is fixed rather than env-controlled, but it still follows a symlinked or junctioned `logs`/`logs/gates` directory and bypasses the shared preflight helper entirely. Current docs treat `logs/gates` as retained evidence to scan before archiving (`docs/STATUS.md:15-16`, `docs/ACCEPTANCE_MATRIX_MASTER.md:19-20`). Recommendation: route fixed `logs/gates` creation/writes through the same physical logs-root guard, or add a small `resolveFixedLogsRoot('logs/gates')` helper with realpath/reparse rejection and post-create verification. Target part: retained gate-log writer.

6. Severity: Low. Evidence: existing root tests are good lexical coverage but not symlink-hard coverage: `tests/integration/preflight-log-root.test.ts:41-54` covers absolute, URL, UNC, traversal, and non-`logs` roots; `tests/integration/preflight-log-root-wiring.test.ts:70-84` covers hostile URL roots across preflight scripts; `tests/integration/lms-db-e2e-artifact-scan.test.ts:44-59` covers unsafe explicit scanner roots; and `tests/integration/retained-visual-artifacts.test.ts:156-163` covers unsafe visual roots. None create or assert behavior for symlink, junction, reparse-point roots, nested symlink descendants, symlinked summary leaves, symlinked dynamic marker manifests, or symlinked OCR sidecars. Recommendation: add focused tests for each link type with platform-aware skips where Windows symlink privileges are unavailable, and use directory junction fallback for Windows directory-link coverage. Target part: Phase 3.57 regression coverage.

## Decisions
- This lane stayed read-only except for the required handoff file; no temp symlinks, junctions, fixtures, scripts, or tests were created.
- No runtime preflight, provider, DB, Playwright, preview, or gate command was executed.
- I treated Phase 3.53's own risk note (`docs/handoffs/20260602-1338-phase-3-53-preflight-log-root-confinement.md:37-41`) and Phase 3.56's next-action pointer (`docs/handoffs/20260602-1531-phase-3-56-safe-preview-retained-output-policy.md:70-72`) as confirmation that symlink-hard confinement is intentionally a separate follow-up.
- No raw secret values were found in the inspected source snippets. The no-value-echo issue above is static evidence about failure-label construction, not an observed leaked value from this audit.

## Risks
- Current local retained roots did not show active reparse points in the read-only inventory I ran, but the code is still vulnerable to a future or attacker-created link before the next preflight/scanner run.
- Lexical checks can pass before filesystem resolution changes the target. Realpath checks must be performed after directory creation as well as before writes to reduce TOCTOU exposure.
- Atomic no-follow behavior is platform-specific. If Node/Windows cannot guarantee `O_NOFOLLOW`-style leaf protection, the implementation should fail closed on any existing summary file and use randomized, exclusive create semantics.
- This workspace is not git-backed from the current root, so this audit is based on current on-disk files rather than committed state.

## Verification/tests
RUN:
- Read-only static inspection with `rg`, `Get-Content`, and `Get-ChildItem`.
- Reparse-point inventory over the workspace excluding `node_modules`/`coverage` returned no rows.
- Reparse-point inventory over `logs`, `test-results`, and `tests/e2e/screenshots` returned no rows.
- `git status --short` was attempted and confirmed the current directory is not a git repository.

NOT RUN:
- `node --check` on scripts.
- Vitest or Playwright.
- `node scripts/gates.mjs full` or `node scripts/gates.mjs e2e`.
- `npm run evidence:visual`.
- Any live object-store/scanner/Stripe/Axioma preflight.
- Any LMS DB browser acceptance, real-Postgres managed proof, append-only audit DB-role proof, DB mutation, preview server, SSH, nginx, systemd, bot service, provider network call, GitHub CI, deploy, or production monitoring.

## Next actions
1. Implement a shared physical path confinement helper for repo-local `logs/...` and retained artifact roots: real repo root, real `logs` root, segment-by-segment `lstat`, reparse/symlink rejection, post-create realpath verification, and safe/exclusive summary-file creation.
2. Apply it to `scripts/preflight-log-root.mjs`, all five preflight consumers through that helper, `scripts/scan-lms-db-e2e-artifacts.mjs`, `scripts/check-retained-visual-artifacts.mjs`, dynamic marker manifests, OCR sidecars, and `scripts/gates.mjs` fixed `logs/gates` writes.
3. Fix LMS scanner failure-label redaction so path-triggered failures cannot print secret-shaped path values.
4. Add focused regression tests for logs root symlink/junction refusal, nested artifact symlink refusal, leaf summary symlink refusal, symlinked marker/OCR sidecar refusal, and no-value-echo for secret-shaped filenames.
5. After implementation, run script syntax checks, focused Vitest for preflight/scanner/visual/gates wiring, `npm run secret:scan`, `npm run typecheck`, `node scripts/gates.mjs full`, scanner over `logs/gates`, visual inventory/refusal checks as scoped, and final governance only after the aggregate handoff exists.
