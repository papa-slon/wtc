# ecosystem-security-auditor handoff
## Scope
Phase 3.23 read-only security/no-leak audit of the LMS DB browser acceptance harness before any run.

Focus:
- secrets and artifact leak risks in the opt-in LMS DB browser harness;
- required environment hygiene before an operator run;
- what the generated-artifact scanner does and does not guarantee;
- what must not be logged, retained, or archived.

No product code, tests, non-handoff docs, servers, Playwright, DB commands, `psql`, migrations, seeds, live endpoints, scanner commands, or external services were used. This handoff is the only file written.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `package.json`
- `apps/web/package.json`
- `.secretlintignore`
- `.gitignore`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/e2e/helpers/auth.ts`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md`
- `docs/handoffs/20260602-0023-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0023-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0023-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0023-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md`
- `docs/handoffs/20260602-0047-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0047-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0047-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md`
- `docs/handoffs/20260602-0106-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-0106-ecosystem-backend-implementer.md`
- `docs/handoffs/20260602-0106-ecosystem-devops-implementer.md`

## Files changed
None - read-only audit. This required handoff is the only file written.

## Findings
1. Severity: High. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:68`-`72` says the LMS DB upload/download gate is RUN only after a fresh empty DB, `LMS_E2E_DATABASE_URL`, Playwright exit 0, scanner exit 0, no forbidden artifacts, archived evidence, and DB drop; Phase 3.22 still records `npm run e2e:lms:db` as NOT RUN at `docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md:90`-`92`; the runner would apply migrations/seed and start Playwright at `scripts/run-lms-db-e2e.mjs:55`-`64`. Recommendation: keep this gate NOT RUN until an operator explicitly performs the full throwaway-DB browser run and scanner pass in an allowed run session; default e2e, PGlite, source inspection, and scanner-on-existing-roots are not substitutes. Target part: LMS DB browser acceptance reporting.

2. Severity: High. Evidence: the master matrix requires a fresh empty `wtc_test_lms_*` database at `docs/ACCEPTANCE_MATRIX_MASTER.md:21` and `docs/ACCEPTANCE_MATRIX_MASTER.md:68`, and the deployment runbook example uses `wtc_test_lms_YYYYMMDDHHMMSS` at `docs/DEPLOYMENT.md:58`-`62`; however both the prep script and Playwright config currently enforce `^wtc_test(_[a-z0-9]+)?$` at `scripts/prepare-lms-db-e2e.ts:17`-`20` and `playwright.lms-db.config.ts:17`-`18`, which rejects a two-underscore name like `wtc_test_lms_202606020125`. Recommendation: reconcile the runbook/matrix and guard before any acceptance run, preferably by making the guard accept the documented unique LMS throwaway naming scheme or by updating the docs to a guard-accepted unique name. Target part: pre-run DB environment hygiene.

3. Severity: High. Evidence: the runner copies `LMS_E2E_DATABASE_URL` into both `LMS_E2E_DATABASE_URL` and child `DATABASE_URL`, creates `LMS_DB_E2E_PREP_TOKEN`, enables `E2E_AUTH_BYPASS`, and supplies `SESSION_SECRET` / `SECRET_VAULT_KEK` at `scripts/run-lms-db-e2e.mjs:19`-`33`; child processes inherit stdout/stderr at `scripts/run-lms-db-e2e.mjs:35`-`40`; the e2e login helper posts the fixed demo password at `tests/e2e/helpers/auth.ts:3`-`9`, and the local e2e login route sets a session cookie at `apps/web/src/app/api/e2e/login/route.ts:19`-`27`. Recommendation: do not archive raw shell transcripts, env dumps, request bodies, headers, cookies, or unredacted stdout/stderr; if stdout is captured, redact DB URLs, passwords, cookie/auth headers, session tokens, `SESSION_SECRET`, `SECRET_VAULT_KEK`, and prep tokens before retention. Target part: command logging and evidence archive.

4. Severity: Medium. Evidence: the e2e auth bypass is locally guarded by production/env/host checks at `apps/web/src/app/api/e2e/login/route.ts:8`-`10`, and the Playwright config targets `http://localhost:3101` with `reuseExistingServer: false` at `playwright.lms-db.config.ts:40` and `playwright.lms-db.config.ts:48`-`52`; nevertheless the route deliberately sets a non-secure local cookie at `apps/web/src/app/api/e2e/login/route.ts:21`-`27`, while the runner enables `E2E_AUTH_BYPASS` at `scripts/run-lms-db-e2e.mjs:25`. Recommendation: run only on a local workstation or isolated CI worker, never behind preview/prod ingress, never with `NODE_ENV=production`, and do not reuse or expose an already-running server on port 3101. Target part: e2e auth-bypass isolation.

5. Severity: Medium. Evidence: the scanner covers fixed forbidden text patterns for LMS bytes/base64, storage keys, raw iframe, DB/env assignments, cookie/auth headers, bearer/basic auth, and password hashes at `scripts/scan-lms-db-e2e-artifacts.mjs:12`-`45`; it scans existing default roots at `scripts/scan-lms-db-e2e-artifacts.mjs:5` and `scripts/scan-lms-db-e2e-artifacts.mjs:76`-`83`; it fails closed on compressed/container artifacts at `scripts/scan-lms-db-e2e-artifacts.mjs:95`-`98`; it skips image bytes at `scripts/scan-lms-db-e2e-artifacts.mjs:101`-`104`; and it reports only file/category, not matched values, at `scripts/scan-lms-db-e2e-artifacts.mjs:115`-`120`. Recommendation: treat the scanner as a necessary generated-text-artifact check, not as proof that the DB browser run happened, not as OCR/visual review, and not as permission to retain trace zips; screenshots need manual visual review or discard, and compressed traces must be discarded or expanded into a controlled scan flow before archiving. Target part: scanner guarantee boundaries.

6. Severity: Medium. Evidence: the scanner roots are broad and reusable (`test-results`, `playwright-report`, `tests/e2e/screenshots`, `logs/lms-db-e2e`) at `scripts/scan-lms-db-e2e-artifacts.mjs:5`; the runner only deletes the prep marker at `scripts/run-lms-db-e2e.mjs:17` and `scripts/run-lms-db-e2e.mjs:91`; the LMS mobile spec writes a deterministic screenshot path at `tests/e2e/lms-db-materials.spec.ts:225`-`228`; `.secretlintignore` excludes `test-results`, `playwright-report`, and `*.png` at `.secretlintignore:8`-`11`, while `.gitignore` only ignores `test-results/`, `playwright-report/`, and `*.tmp.png` screenshots at `.gitignore:17`-`21`. Recommendation: before a real run, isolate or clean the LMS DB artifact roots, record the run timestamp, and archive only current-run LMS DB artifacts after scanner pass; do not mix stale default-e2e screenshots/reports into the evidence package. Target part: artifact freshness and archive scope.

7. Severity: Medium. Evidence: the browser spec creates dynamic filename/body/hash markers at `tests/e2e/lms-db-materials.spec.ts:101`-`106` and intentionally verifies the successful clean download returns `content-disposition`, `x-lms-sha256`, and raw file text at `tests/e2e/lms-db-materials.spec.ts:209`-`217`; the scanner static denylist catches the stable body/base64 prefixes and static marker names at `scripts/scan-lms-db-e2e-artifacts.mjs:24`-`30`, but it does not consume a per-run manifest for the exact dynamic filename or SHA-256 value. Recommendation: do not archive raw successful download response logs, HAR/network traces, or expanded trace content unless a per-run marker manifest or equivalent scanner rule covers the exact filename and hash; archive only redacted summaries plus approved screenshots after visual review. Target part: dynamic marker and network artifact leakage.

8. Severity: Medium. Evidence: Phase 3.20 introduced the scanner because generic `secret:scan` is not an LMS artifact oracle (`docs/handoffs/20260602-0023-phase-3-20-lms-db-e2e-artifact-scan.md:58`-`65`); Phase 3.21 hardened failed-response and auth/cookie marker checks (`docs/handoffs/20260602-0047-phase-3-21-lms-db-no-leak-assertion-hardening.md:49`-`65`); Phase 3.22 narrowed student/teacher DTO boundaries but still kept the actual LMS DB browser run unobserved (`docs/handoffs/20260602-0106-phase-3-22-lms-material-dto-boundary.md:60`-`65`). Recommendation: preserve the Phase 3.20-3.22 source hardening, but keep the final acceptance blocker open until the live throwaway browser run produces current artifacts that pass the scanner and archive policy. Target part: prior-phase evidence interpretation.

## Decisions
- This was a single requested read-only `ecosystem-security-auditor` lane; no background agents were launched, and none were left running.
- `npm run e2e:lms:db` remains NOT RUN in this session and must stay outside default `npm run e2e`, `npm run ci:local`, and broad gates unless the operator explicitly starts the guarded throwaway-DB acceptance flow.
- The only supported run entry point remains `npm run e2e:lms:db`; direct `npx playwright test -c playwright.lms-db.config.ts` is not acceptable evidence because the runner owns env setup, prep token, marker cleanup, and scanner invocation.
- Evidence archive is allowed only after: fresh empty throwaway DB, runner exit 0, scanner exit 0, redacted stdout summary, screenshot visual review/discard, no retained compressed/container trace artifacts, and DB drop.
- Never retain or publish DB URLs, DB credentials, `.env` values, shell env dumps, `LMS_DB_E2E_PREP_TOKEN`, session cookies, auth headers, bearer/basic tokens, demo password request bodies, raw uploaded file bytes/base64, raw iframe HTML, storage keys/paths, or raw successful download response bodies.

## Risks
- The documented `wtc_test_lms_*` DB naming scheme currently conflicts with the implemented regex guard, so a correct runbook command can fail before Playwright or tempt ad hoc operator workarounds.
- Scanner pass on existing roots can be a false confidence signal if artifacts are stale, roots are missing, screenshots are skipped, or trace zips are absent because the run never happened.
- Successful download response data is intentionally sensitive enough for archives: raw bytes, filename, and content hash may be present in network artifacts if traces/HAR/logging are enabled.
- Screenshots are binary and skipped by the scanner; they must be reviewed visually before retention or discarded.
- This audit did not validate production object storage, external malware scanning, signed-object redirects, quarantine cleanup, public upload rollout, or any real DB/browser behavior.

## Verification/tests
RUN:
1. Static/source inspection with `Get-Content`, `rg`, and read-only directory inventory.
2. Prior Phase 3.20-3.22 handoff review for scanner, no-leak assertion, DTO-boundary, devops, and acceptance wording.

NOT RUN:
1. `npm run e2e:lms:db` - explicitly not run; it would start a local server, run Playwright, apply migrations/seeds, run the scanner, and mutate a throwaway database.
2. `node scripts/scan-lms-db-e2e-artifacts.mjs` - not run; this audit reviewed scanner guarantees from source only.
3. `npm run e2e`, `npx playwright test`, Next dev/preview/prod servers, live endpoints, `psql`, DB create/drop, migrations, seeds, DB reads/writes, or external services - forbidden by scope.
4. `npm test`, typecheck, lint, build, `npm run secret:scan`, `node scripts/gates.mjs full`, or governance checks - not run because this was a read-only security inspection and no product/test implementation changed.
5. OCR/image-content inspection of screenshots - not run; screenshot artifacts remain outside automated scanner guarantees.

No gate is claimed green in this session.

## Next actions
1. Reconcile the `wtc_test_lms_*` runbook/matrix language with the implemented DB-name guard before any operator acceptance run.
2. Before the real run, isolate or clean the LMS DB artifact roots and prepare a redacted evidence-capture path that cannot include raw env, request bodies, cookies, headers, DB URLs, or shell transcripts.
3. Run the actual acceptance only through `npm run e2e:lms:db` with a fresh empty throwaway DB, then archive only redacted current-run evidence after scanner pass, screenshot review/discard, and DB drop.
4. Add a per-run marker manifest or equivalent scanner coverage for exact dynamic filename/hash if any network trace, HAR, or expanded trace content will be retained.
