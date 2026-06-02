# ecosystem-education-implementer handoff
## Scope
Phase 3.28 read-only education/LMS audit before edits. Scope was limited to the LMS DB e2e dynamic artifact marker manifest needed after Phase 3.27 so generated evidence can be scanned for per-run leak values without archiving raw marker values or printing them in command output.

No product code, tests, migrations, docs other than this handoff, servers, DB commands, Playwright, Vitest, or gates were run or changed.

## Files inspected
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`

## Files changed
None — read-only audit. Only this handoff was written.

## Findings
1. Severity: High. Evidence: the DB-backed LMS browser spec creates per-run dynamic material values at `tests/e2e/lms-db-materials.spec.ts:97`-`108`, including the uploaded filename, clean file body, quarantined body, and content SHA; page/header assertions consume those values at `tests/e2e/lms-db-materials.spec.ts:157`-`160`, `tests/e2e/lms-db-materials.spec.ts:194`-`197`, `tests/e2e/lms-db-materials.spec.ts:211`-`220`, and `tests/e2e/lms-db-materials.spec.ts:233`-`240`. The generated-artifact scanner only has static forbidden rules at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`48`, so it cannot reject exact per-run filename/hash/signed-url values unless those values match a static prefix. Recommendation: have the DB e2e spec write a transient per-run marker manifest for exact dynamic markers, and have the scanner load it to add exact raw and base64 marker checks. Target part: `tests/e2e/lms-db-materials.spec.ts` and `scripts/scan-lms-db-e2e-artifacts.mjs`.

2. Severity: High. Evidence: the runner creates a prep token and cleans only `.next-e2e-db/lms-db-e2e-prepared.json` at `scripts/run-lms-db-e2e.mjs:16`-`17` and `scripts/run-lms-db-e2e.mjs:90`-`95`; the prepare script writes only a redacted DB prep marker with `urlHmacSha256` at `scripts/prepare-lms-db-e2e.ts:51`-`57`; the archive instruction currently allows redacted stdout, `test-results/`, `playwright-report/`, and selected screenshots after scanning at `scripts/run-lms-db-e2e.mjs:91`-`95`. Recommendation: store raw dynamic marker values only under a non-archived transient path such as `.next-e2e-db/lms-db-e2e-markers/`, pass that path to the scanner by env or a dedicated flag, and delete the marker path in the runner `finally` alongside the prep marker. Do not place the raw manifest under `test-results`, `playwright-report`, `tests/e2e/screenshots`, or `logs/lms-db-e2e`. Target part: `scripts/run-lms-db-e2e.mjs`.

3. Severity: High. Evidence: scanner failure output reports only artifact label and rule label at `scripts/scan-lms-db-e2e-artifacts.mjs:118`-`123`, and the existing scanner test asserts a forbidden DB URL is not printed at `tests/integration/lms-db-e2e-artifact-scan.test.ts:74`-`85`. Recommendation: dynamic marker rules must follow the same output contract: manifest entries should have safe labels such as `clean file body`, `original filename`, `content hash`, `quarantined body`, and future `signed url host/query`, while scanner failures print only those labels and never the matched marker value, its base64 encoding, object key, URL, query string, or content hash. Add a regression test that a dynamic marker leak fails the scan and the thrown output contains the label but not the raw marker. Target part: `scripts/scan-lms-db-e2e-artifacts.mjs` and `tests/integration/lms-db-e2e-artifact-scan.test.ts`.

4. Severity: Medium. Evidence: the scanner accepts positional CLI roots at `scripts/scan-lms-db-e2e-artifacts.mjs:79`-`80` and scans only path/content for those roots at `scripts/scan-lms-db-e2e-artifacts.mjs:93`-`116`; the runner currently invokes it without any manifest argument at `scripts/run-lms-db-e2e.mjs:70`-`75` and again in the failure catch path at `scripts/run-lms-db-e2e.mjs:80`-`88`. Recommendation: add explicit argument parsing instead of overloading roots, for example `--marker-manifest <path>` plus optional artifact roots. The runner should pass the manifest path on both normal and failure scanner calls. The scanner should fail closed if `--marker-manifest` is supplied but unreadable or malformed, but keep the no-manifest mode working for default local scans. Target part: scanner CLI and runner wiring.

5. Severity: Medium. Evidence: the LMS DB Playwright config uses two projects at `playwright.lms-db.config.ts:44`-`47` with `workers: 1` at `playwright.lms-db.config.ts:34`-`36`; this is effectively serial today but still has separate desktop and mobile runs that generate different suffixes from `info.project.name` at `tests/e2e/lms-db-materials.spec.ts:96`-`108`. Recommendation: prefer a manifest directory or append-only JSONL file rather than one overwritten JSON object. Each project/test should emit a separate marker record with safe `label`, `encodingPolicy`, and raw `value` fields consumed only by the scanner. The scanner can compute base64 variants in memory so the manifest does not duplicate encodings. Target part: e2e marker writer helper.

6. Severity: Medium. Evidence: docs already mark dynamic per-run marker scanning as open in `docs/STATUS.md:15`-`17`, `docs/NEXT_ACTIONS.md:9`-`12`, `docs/IMPLEMENTED_FILES.md:17`-`23`, `docs/ACCEPTANCE_MATRIX_MASTER.md:84`-`91`, `docs/DEPLOYMENT.md:54`-`62`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md:16`; deployment docs describe the current scanner as static text-root scanning and screenshot-image skipping at `docs/DEPLOYMENT.md:104`-`108`. Recommendation: after implementation, update current docs to say dynamic marker scanning is local-runner implemented for retained text artifacts only, while screenshots still require human visual review or discard, and signed object storage/HAR/trace evidence remains a separate acceptance boundary unless those artifact types are made text-scannable or explicitly blocked. Target part: current status and acceptance docs.

## Decisions
- Do not archive raw marker values. If exact values must exist for scanning, keep them in a transient `.next-e2e-db` path that is deleted in `finally` and excluded from the documented archive set.
- Do not print raw dynamic marker values from the spec, runner, or scanner. Scanner output should report only artifact path and safe rule label.
- Keep static scanner rules. Dynamic marker manifests should add coverage, not replace static guards for internal field names, raw body prefixes, storage paths, auth headers, DB URLs, and unscannable containers.
- Keep screenshot bytes skipped by the scanner unless OCR or a separate visual review gate is introduced. Dynamic marker scanning should not be marketed as proving image artifacts are clean.
- Keep `npm run e2e:lms:db` and `npm run e2e:lms:db:managed` opt-in; this phase does not change the fact that observed DB browser acceptance is still not run without a fresh throwaway DB URL.

## Risks
- If the raw manifest is written into an archived root, it becomes the leak it was meant to detect.
- If the scanner prints matched dynamic values, a failed no-leak run can leak the filename, hash, raw file body, object key, signed URL, or auth-adjacent query value into logs.
- A static prefix-only deny rule for `wtc-db-e2e-notes-` is useful but weaker than exact marker scanning, and it will not cover future signed URL hosts/query tokens or object-store paths.
- Playwright trace ZIPs are still unscannable by the current scanner and should continue to fail closed or be excluded from accepted evidence until a safe trace/HAR policy lands.
- Base64 variants should be computed in scanner memory from each raw marker; storing both raw and base64 in the manifest widens the transient secret surface without adding coverage.

## Verification/tests
- Gates RUN: none. This was a read-only audit by instruction.
- Gates NOT RUN: `npm test`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm run build`, `npm run secret:scan`, `npm run governance:check`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `node scripts/scan-lms-db-e2e-artifacts.mjs`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, DB commands, servers, Playwright, migrations, and live services. Reason: forbidden by this read-only audit scope.
- Handoff format was checked against the canonical headings in `docs/SESSION_PROTOCOL.md:59`-`72`.

## Next actions
1. Implement a tiny e2e helper for `tests/e2e/lms-db-materials.spec.ts` that records exact per-run marker values to a transient marker directory only when `LMS_DB_E2E_MARKER_MANIFEST` or a similar runner-owned path is set.
2. Extend `scripts/run-lms-db-e2e.mjs` to create the transient marker path before Playwright, pass it to Playwright and the scanner, scan it after any Playwright attempt, and remove it in `finally` without printing marker values.
3. Extend `scripts/scan-lms-db-e2e-artifacts.mjs` with `--marker-manifest <path>` support, exact raw/base64 matching, fail-closed malformed manifest handling, and no matched-value output.
4. Add scanner and static harness tests proving dynamic marker leaks fail, raw marker values are not printed, runner wiring passes the manifest on success and failure paths, and the manifest path is outside archived artifact roots.
5. Update `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md` after implementation to distinguish implemented local dynamic text-artifact scanning from still-open signed delivery, trace/HAR, screenshot, and production object-storage acceptance.
