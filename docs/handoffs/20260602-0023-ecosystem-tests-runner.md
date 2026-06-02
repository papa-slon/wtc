# ecosystem-tests-runner handoff
## Scope
Phase 3.20 read-only tests-runner audit for the LMS DB e2e artifact no-leak scanner after Phase 3.19.

Scope was limited to source/docs/artifact-convention inspection and an implementation recommendation. No product code, scripts, package files, tests, generated artifacts, database, server, Playwright run, `psql`, or live endpoint was touched. This handoff is the only file written.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `package.json`
- `.gitignore`
- `scripts/gates.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.config.ts`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `test-results/.last-run.json`
- `test-results/` and `playwright-report/` presence/conventions

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:68`-`70` requires the LMS DB browser gate to archive and scan artifacts for no raw bytes/base64/storage keys before the gate is RUN; `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md:62` and `:85`-`:86` repeat that artifact scanning is still required automation. Current `scripts/run-lms-db-e2e.mjs:52` only prints an archive reminder after Playwright. Recommendation: add an explicit scanner and invoke it from `scripts/run-lms-db-e2e.mjs` after Playwright exits 0 and before the command can be accepted. Target part: LMS DB browser artifact acceptance.
2. Severity: High. Evidence: `tests/e2e/lms-db-materials.spec.ts:44`-`:47` creates dynamic clean-file text, quarantined text, raw embed HTML, and a SHA-256 value inside the Playwright process; `tests/e2e/lms-db-materials.spec.ts:96`-`:105`, `:131`-`:133`, and `:170`-`:171` assert no leaks in selected rendered pages, but the exact dynamic markers are not exported to a post-run artifact scanner. Recommendation: have the runner generate scan marker values and pass them to Playwright via env, or have the spec write a short-lived marker manifest that the scanner reads and deletes/excludes. The scanner should check clean text, clean base64, quarantined text, quarantined base64, exact raw embed HTML, HTML-escaped raw embed HTML, `fileBytesBase64`, `storageKey`, `storage_key`, and `lms/materials/`. Target part: scanner input design.
3. Severity: Medium. Evidence: `package.json:27`-`:31`, `scripts/gates.mjs:47`-`:52`, and `tests/integration/lms-db-e2e-harness.test.ts:82`-`:89` keep `e2e:lms:db` out of default `e2e`, `ci:local`, and gate plans. Recommendation: preserve this split. If a scanner command is added, call it only from the opt-in LMS DB runner, not from default `node scripts/gates.mjs full`, default `node scripts/gates.mjs e2e`, or `npm run ci:local`. Add/extend static tests to assert both the scanner invocation and continued default-gate exclusion. Target part: default gate isolation.
4. Severity: Medium. Evidence: `.gitignore:19`-`:20` ignores `test-results/` and `playwright-report/`; `docs/DEPLOYMENT.md:68`-`:69` says to keep those generated artifacts when the DB gate is accepted; `playwright.lms-db.config.ts` uses `trace: 'retain-on-failure'`, so a failed run can create compressed trace artifacts. Recommendation: scan immediately inside the runner against `test-results/`, `playwright-report/`, `logs/gates/` if present, and `tests/e2e/screenshots/lms-db-material-lesson-*.png` only as a listed artifact, not as text proof. For text scanning, recurse through `.txt`, `.log`, `.json`, `.html`, `.xml`, `.md`, `.js`, `.css`, and fail closed on unscannable `.zip` traces unless a zip-expansion path is implemented. Target part: artifact path coverage and overclaim prevention.
5. Severity: Low. Evidence: `test-results/.last-run.json` currently contains only a passing status and no LMS DB artifact corpus; `playwright-report/` is absent. Recommendation: do not claim artifact scanning was observed in this audit; the scanner can be source-reviewed now, but the real proof remains a future `npm run e2e:lms:db` run against a fresh throwaway `LMS_E2E_DATABASE_URL`. Target part: acceptance reporting.

## Decisions
- Recommend a small implementation, not a default-gate expansion.
- Keep `npm run e2e:lms:db` opt-in and mutating-DB only when `LMS_E2E_DATABASE_URL` points at a fresh empty `wtc_test_lms_*` database.
- Prefer scanner invocation from `scripts/run-lms-db-e2e.mjs` so operators cannot forget the no-leak scan after a successful DB browser run.
- Treat generated screenshots as visual artifacts; this requested scanner should cover text artifacts/logs and should not overclaim pixel/OCR inspection.

## Risks
- Without a scanner command wired into the DB runner, a future passing Playwright run could still be reported before artifact/log leakage is checked.
- If marker values stay purely local to the Playwright test body, a post-run scanner cannot reliably know the exact uploaded byte/base64/raw-embed strings to search for.
- Playwright trace zips can contain DOM/network snapshots; accepting a failed run's artifacts without zip expansion or fail-closed zip handling would leave a leak gap.
- The actual DB-backed browser gate is still unobserved until a fresh throwaway `LMS_E2E_DATABASE_URL` is supplied and `npm run e2e:lms:db` exits 0.

## Verification/tests
RUN:
1. Static/source inspection only: `Get-Content`, `Select-String`, `rg`, and directory listing for requested docs/scripts/tests/artifact folders.
2. Confirmed `test-results/.last-run.json` exists and is only the default Playwright last-run status file.
3. Confirmed `playwright-report/` is absent in this workspace snapshot.

NOT RUN:
1. `npm run e2e:lms:db` - not run because no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied and it would start a local server and mutate a database.
2. `npx playwright test`, `npm run e2e`, and any server-starting browser gate - forbidden by this read-only audit scope.
3. `psql`, migrations, seeds, DB create/drop, or any database mutation - forbidden by this read-only audit scope.
4. `npm test`, typecheck, lint, full/e2e gate runners - not required for the read-only recommendation and no implementation was made.
5. Live Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, preview/production service, object storage, malware scanner, or worker deployment - out of scope and not touched.

## Next actions
1. Add `scripts/scan-lms-db-e2e-artifacts.mjs` that accepts marker values via env or a short-lived manifest and scans generated text artifacts/logs for LMS uploaded bytes/base64/storage keys/raw embed markers.
2. Update `scripts/run-lms-db-e2e.mjs` to call the scanner after `npx playwright test -c playwright.lms-db.config.ts` succeeds and before printing the acceptance/archive reminder.
3. Extend `tests/integration/lms-db-e2e-harness.test.ts` to assert the scanner is wired into the DB runner, marker source exists, direct/default gates still exclude `e2e:lms:db`, and the scanner has fail-closed patterns for `fileBytesBase64`, `storageKey`, `storage_key`, and `lms/materials/`.
4. When a fresh throwaway Postgres URL is available, run `npm run e2e:lms:db`, confirm the scanner passes, archive only the approved artifacts, and drop the throwaway DB.
