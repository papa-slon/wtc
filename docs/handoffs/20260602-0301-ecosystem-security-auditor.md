# ecosystem-security-auditor handoff
## Scope
Phase 3.28 read-only security audit before edits for dynamic artifact markers in the LMS DB e2e scanner. Reviewed scanner output behavior, manifest sensitivity, archive docs, and no-leak assertions. No product code, tests, migrations, gates, servers, databases, Playwright, or live services were run.

## Files inspected
- `AGENTS.md`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-material-download-handler.test.ts`
- `tests/integration/db-lms-ph3-1.test.ts`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-0245-phase-3-27-lms-filename-minimization.md`
- `.gitignore`
- `.secretlintignore`
- `package.json`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Dynamic marker scanning is still missing; the current scanner only has static forbidden patterns. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:12` to `scripts/scan-lms-db-e2e-artifacts.mjs:48` defines a fixed `FORBIDDEN` list, and `scripts/scan-lms-db-e2e-artifacts.mjs:73` to `scripts/scan-lms-db-e2e-artifacts.mjs:76` scans only those rules. The DB browser spec generates per-run sensitive values at `tests/e2e/lms-db-materials.spec.ts:97` to `tests/e2e/lms-db-materials.spec.ts:108`, including filename, body text, quarantine text, and content hash. Recommendation: Phase 3.28 should add a per-run dynamic denylist manifest consumed by the scanner, or an equivalent scanner input that covers exact runtime markers. Target part: `scripts/scan-lms-db-e2e-artifacts.mjs`, DB e2e runner/spec wiring, and scanner tests.

2. Severity: High. The dynamic marker manifest itself must be treated as sensitive and must not be archived. Evidence: current archive docs allow only redacted stdout, `test-results/`, `playwright-report/`, and selected screenshots after the scanner passes at `docs/DEPLOYMENT.md:80` to `docs/DEPLOYMENT.md:83`; runner output repeats that archive scope at `scripts/run-lms-db-e2e.mjs:91` to `scripts/run-lms-db-e2e.mjs:95`. The existing prep marker is transient under `.next-e2e-db/lms-db-e2e-prepared.json` and is deleted before and after the run at `scripts/run-lms-db-e2e.mjs:6` to `scripts/run-lms-db-e2e.mjs:17` and `scripts/run-lms-db-e2e.mjs:90` to `scripts/run-lms-db-e2e.mjs:95`; it contains a DB-name and URL HMAC metadata at `scripts/prepare-lms-db-e2e.ts:51` to `scripts/prepare-lms-db-e2e.ts:57`. Recommendation: store any dynamic marker manifest in the same transient `.next-e2e-db` class, delete it in `finally`, exclude it from archive instructions, and add a harness/static assertion that docs never tell operators to retain it. Target part: runner cleanup, scanner input contract, and deployment/archive docs.

3. Severity: High. Malformed or unreadable manifests must fail closed before archive eligibility. Evidence: no manifest parse path exists today in `scripts/scan-lms-db-e2e-artifacts.mjs:79` to `scripts/scan-lms-db-e2e-artifacts.mjs:86`; the scanner currently treats command arguments only as artifact roots. It fails closed for unscanned compressed/container artifacts at `scripts/scan-lms-db-e2e-artifacts.mjs:97` to `scripts/scan-lms-db-e2e-artifacts.mjs:111`, but there is no equivalent invalid-manifest branch. Recommendation: if a manifest path is supplied or required by the runner, require strict JSON shape, non-empty marker arrays, bounded string lengths, no empty marker values, and explicit exit 1 on missing/malformed/oversized/unsupported manifest data. Target part: scanner manifest parser and functional scanner tests.

4. Severity: Medium. Current scanner output already follows the no matched value printing invariant for static rules, and that invariant must be preserved for dynamic manifest rules. Evidence: failures store only `{ label, rule }` at `scripts/scan-lms-db-e2e-artifacts.mjs:73` to `scripts/scan-lms-db-e2e-artifacts.mjs:76`; failure output prints only `FAIL ${f.label}: ${f.rule}` at `scripts/scan-lms-db-e2e-artifacts.mjs:118` to `scripts/scan-lms-db-e2e-artifacts.mjs:124`; the scanner test asserts a secret-like DB URL is not printed in failure output at `tests/integration/lms-db-e2e-artifact-scan.test.ts:74` to `tests/integration/lms-db-e2e-artifact-scan.test.ts:85`. Recommendation: dynamic marker failures must emit stable category labels only, never the matched value, marker text, or manifest payload. Add tests with a unique dynamic filename/hash/URL and assert stderr omits the value. Target part: scanner output and test coverage.

5. Severity: Medium. Static/browser no-leak assertions are strong for HTML and response headers, but generated artifact scanning remains a necessary separate archive gate. Evidence: the browser spec rejects internal material markers in page HTML at `tests/e2e/lms-db-materials.spec.ts:30` to `tests/e2e/lms-db-materials.spec.ts:42`, rejects leak markers in failed response bodies/headers at `tests/e2e/lms-db-materials.spec.ts:52` to `tests/e2e/lms-db-materials.spec.ts:75`, and checks successful download headers use generic filename and omit `x-lms-sha256` at `tests/e2e/lms-db-materials.spec.ts:211` to `tests/e2e/lms-db-materials.spec.ts:220`. The scanner separately scans generated artifact paths/content at `scripts/scan-lms-db-e2e-artifacts.mjs:93` to `scripts/scan-lms-db-e2e-artifacts.mjs:115`. Recommendation: keep DOM/header assertions and artifact scanning as separate required checks; do not let a manifest scanner replace the browser no-leak assertions. Target part: acceptance criteria and test harness.

6. Severity: Medium. Images remain intentionally unscanned by bytes, so dynamic manifests do not solve visual leakage by themselves. Evidence: image extensions are skipped at `scripts/scan-lms-db-e2e-artifacts.mjs:9` and `scripts/scan-lms-db-e2e-artifacts.mjs:104` to `scripts/scan-lms-db-e2e-artifacts.mjs:107`; tests pin this skip behavior at `tests/integration/lms-db-e2e-artifact-scan.test.ts:65` to `tests/integration/lms-db-e2e-artifact-scan.test.ts:71`; docs require human visual review for screenshots at `docs/DEPLOYMENT.md:104` to `docs/DEPLOYMENT.md:108`. Recommendation: manifest scanning should cover text artifacts and paths; screenshots still need visual review or discard before archive. Target part: scanner docs and archive instructions.

## Decisions
- Required invariant: scanner failure output must print failure labels/categories only, never matched values or dynamic marker payloads.
- Required invariant: the dynamic marker manifest is sensitive runtime evidence and must not be archived; keep it transient and delete it in runner cleanup.
- Required invariant: malformed, missing-when-required, oversized, unsupported, or unreadable manifests must fail closed with exit 1.
- Required invariant: dynamic marker rules should be attached to stable labels such as `dynamic LMS original filename marker`, `dynamic LMS uploaded body marker`, `dynamic LMS content hash marker`, or `dynamic signed URL marker`, not to the raw marker values.
- Required invariant: image screenshots remain outside automated text scanning and require manual visual review/discard.

## Risks
- If the manifest is placed in `test-results/`, `playwright-report/`, `tests/e2e/screenshots/`, or `logs/lms-db-e2e`, operators may archive the exact sensitive values the scanner is meant to detect.
- If malformed manifests are ignored or treated as empty, a broken run could produce an apparently clean archive while dynamic markers were never scanned.
- If dynamic scanner failures print matched values for debugging, the scanner can leak DB URLs, signed URLs, content hashes, filenames, or raw uploaded body markers into retained stdout.
- If Phase 3.28 only adds a static prefix rule, it will improve filename coverage but still will not cover future signed URLs, exact hashes, generated object keys, or arbitrary per-run body markers.

## Verification/tests
- Gates run: none. This was a read-only audit.
- Gates not run: Vitest, typecheck, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `node scripts/scan-lms-db-e2e-artifacts.mjs`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, servers, database commands, Playwright, migrations/seeds, and live services were intentionally not run by scope.
- `git status --short` was attempted for orientation and failed with `fatal: not a git repository (or any of the parent directories): .git`.

## Next actions
1. Add a transient dynamic marker manifest generated by the DB e2e run, with exact per-run leak markers needed for retained generated text artifacts.
2. Update `scripts/scan-lms-db-e2e-artifacts.mjs` to consume that manifest through an explicit option or runner-controlled path, fail closed on malformed input, and print labels only.
3. Add scanner tests for dynamic marker detection, no matched value printing, malformed manifest failure, and proof the manifest file is not in archive roots/instructions.
4. Update deployment/acceptance docs so evidence archive remains allowed only after scanner pass, screenshot review/discard, throwaway DB drop, and manifest deletion.
5. After implementation, run focused scanner/harness tests, typecheck, full/e2e gates, scanner, and governance in the operator phase.
