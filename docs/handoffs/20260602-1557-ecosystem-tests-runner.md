# ecosystem-tests-runner handoff
## Scope
Phase 3.57 read-only tests-runner audit for symlink-hard preflight root confinement. Scope was limited to proposing focused tests and a gate sequence for symlink/junction/reparse-point hardening around preflight summary roots, retained text artifact scanning, and retained visual artifact scanning. No implementation, product-code edits, config edits, or test edits were performed.

## Files inspected
- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `package.json`
- `vitest.config.ts`
- `scripts/preflight-log-root.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `tests/integration/preflight-log-root.test.ts`
- `tests/integration/preflight-log-root-wiring.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/retained-visual-artifacts.test.ts`

## Files changed
None — read-only audit except this handoff file: `docs/handoffs/20260602-1557-ecosystem-tests-runner.md`.

## Findings
1. Severity: High. Evidence: `scripts/preflight-log-root.mjs:24` resolves a lexical repo path, `scripts/preflight-log-root.mjs:25-28` only compares lexical `relative(ROOT, absoluteRoot)`, and `scripts/preflight-log-root.mjs:36-40` creates the directory and writes the summary without `lstat`/`realpath` validation. Current helper tests cover accepted roots, blank fallback, and hostile URL/absolute/traversal roots in `tests/integration/preflight-log-root.test.ts:22-54`, but not an existing symlink, junction, or reparse-point ancestor under `logs/`. Recommendation: add focused helper tests that create a workspace-local directory reparse point under `logs/test-*` and assert the combined `resolvePreflightLogRoot` plus `writePreflightSummary` path refuses before writing `summary-*.json`. Target part: `tests/integration/preflight-log-root.test.ts`.

2. Severity: High. Evidence: all live preflight wrappers route through the shared helper per `scripts/lms-s3-r2-live-preflight.mjs`, `scripts/lms-external-scanner-live-preflight.mjs`, `scripts/billing-stripe-webhook-replay-preflight.mjs`, `scripts/billing-stripe-checkout-preflight.mjs`, and `scripts/axioma-handoff-preflight.mjs` references found by `resolvePreflightLogRoot`/`writePreflightSummary`; the current wiring test only proves URL-shaped override refusal and one lexical traversal case in `tests/integration/preflight-log-root-wiring.test.ts:70-108`. Recommendation: add one wiring case using the cheapest dry-run preflight fixture with `*_PREFLIGHT_LOG_ROOT=logs/test-*/junction` where `junction` points to another workspace-local test directory, expecting exit `2`, no `summary=`, no raw path echo, and no summary file in the target. Target part: `tests/integration/preflight-log-root-wiring.test.ts`.

3. Severity: High. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:126-140` confines explicit artifact roots and dynamic marker manifests lexically, then `scripts/scan-lms-db-e2e-artifacts.mjs:193-199` walks with `statSync`, which follows symlinks/junctions. The scanner maps roots at `scripts/scan-lms-db-e2e-artifacts.mjs:219-223` and walks existing roots at `scripts/scan-lms-db-e2e-artifacts.mjs:235-242`. Current scanner tests refuse URL/traversal/off-workspace inputs in `tests/integration/lms-db-e2e-artifact-scan.test.ts:44-79`, but do not prove explicit roots, nested directories, or dynamic marker manifests are refused when any path component is a reparse point. Recommendation: add tests for a reparse explicit root, a nested reparse child inside a scanned root, and `LMS_DB_E2E_DYNAMIC_MARKERS_PATH` through a reparse ancestor. Target part: `tests/integration/lms-db-e2e-artifact-scan.test.ts`.

4. Severity: High. Evidence: `scripts/check-retained-visual-artifacts.mjs:63-73` uses the same lexical workspace confinement shape, `scripts/check-retained-visual-artifacts.mjs:96-103` walks with `statSync`, dynamic marker and visual manifest paths are read after lexical resolution at `scripts/check-retained-visual-artifacts.mjs:135-159`, and manifest artifact/OCR sidecar paths are resolved then read at `scripts/check-retained-visual-artifacts.mjs:193-224`. Current visual tests cover unsafe URL/traversal roots only at `tests/integration/retained-visual-artifacts.test.ts:156-163`. Recommendation: add tests that refuse a reparse artifact root in both inventory and manifest mode, refuse a visual review manifest reached through a reparse ancestor, and refuse an OCR sidecar reached through a reparse ancestor without echoing marker values. Target part: `tests/integration/retained-visual-artifacts.test.ts`.

5. Severity: Medium. Evidence: Phase 3.53 documented the intended relative `logs/...` policy and lexical unsafe-root coverage in `docs/STATUS.md:60-72` and `docs/IMPLEMENTED_FILES.md:85-108`; Phase 3.56 documented raw preview log refusal and current gates in `docs/STATUS.md:3-21`; `docs/NEXT_ACTIONS.md:18-23` names symlink-hard preflight root confinement as the next local safety slice when credentials remain unavailable. Recommendation: keep Phase 3.57 narrow: test and harden filesystem-realpath/reparse behavior only, then rerun the same local evidence gates. Target part: phase scope and gate sequencing.

## Decisions
- Recommend rejecting any symlink/junction/reparse component in these retained-evidence roots rather than allowing links that currently resolve inside the workspace. This is easier to test without off-workspace writes and avoids time-of-check/time-of-use ambiguity before summary or artifact writes.
- Recommend test fixtures create only workspace-local targets, e.g. `logs/test-*/target` and `logs/test-*/link`, so the suite never writes outside `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.
- Recommend using Node's `symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')` for directory reparse fixtures. On Windows this should avoid admin-only symlink creation in normal cases; if the host still rejects junction creation with `EPERM`/`EACCES`, the focused test helper should report a controlled skip rather than attempting `mklink` or admin-only shell operations.

## Risks
- If implementation only uses `realpathSync` after `mkdirSync`, a malicious existing reparse ancestor can still redirect summary creation before validation. The tests should wrap the full summary-write path and assert no target summary exists.
- If scanners only validate explicit roots but keep `statSync` recursion, nested links under allowed roots can still be followed and scanned. The nested-child tests are required, not optional.
- If visual manifest paths are hardened but OCR sidecar paths are not, reviewed screenshot evidence can still retain sidecar text from an unexpected target. The OCR sidecar reparse test must be included.
- Broad gates can pass while this gap remains, because prior gates already passed for lexical confinement and raw-log refusal without reparse coverage.

## Verification/tests
No gates were run in this read-only audit lane. Expected gate sequence after implementation:

1. `node --check scripts/preflight-log-root.mjs`
2. `node --check scripts/scan-lms-db-e2e-artifacts.mjs`
3. `node --check scripts/check-retained-visual-artifacts.mjs`
4. `npm test -- tests/integration/preflight-log-root.test.ts tests/integration/preflight-log-root-wiring.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/retained-visual-artifacts.test.ts`
5. `npm run secret:scan`
6. `npm run typecheck`
7. `node scripts/gates.mjs full`
8. `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates`
9. `npm run evidence:visual -- --inventory tests/e2e/screenshots`
10. `npm run governance:check`

Expected NOT RUN for this local safety slice unless the operator separately provides credentials and scope: `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, actual LMS DB browser acceptance, active managed real-Postgres proof, production/preview append-only audit DB-role proof, live provider preflights, SSH/nginx/systemd/server checks, GitHub CI, deploy, and production monitoring.

## Next actions
1. Implement a shared filesystem confinement helper for retained-evidence paths that checks the real workspace root and refuses symlink/junction/reparse components before writing or walking. Apply it to `scripts/preflight-log-root.mjs`, `scripts/scan-lms-db-e2e-artifacts.mjs`, and `scripts/check-retained-visual-artifacts.mjs`.
2. Add the focused reparse tests listed above, keeping all fixture targets under `logs/test-*` and cleaning them with `rmSync(resolve(ROOT, rel), { recursive: true, force: true })`.
3. Run the gate sequence in `## Verification/tests`, then have the operator aggregate gates RUN/NOT RUN per `docs/SESSION_PROTOCOL.md:52-57`.
