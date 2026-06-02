# ecosystem-devops-implementer handoff
## Scope
Phase 3.20 read-only devops audit for LMS DB e2e artifact capture and runbook automation in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Requested inspection scope:
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `.gitignore`
- root and web `package.json` scripts
- current `test-results/`, `playwright-report/`, and e2e screenshot artifact behavior

This audit recommends how to wire artifact scanning into the opt-in LMS DB browser runner, what artifacts to scan/archive, and how to report RUN/NOT RUN without adding the DB browser gate to default gates.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260601-2355-phase-3-19-lms-db-browser-negative-coverage.md`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `.gitignore`
- `package.json`
- `apps/web/package.json`
- `scripts/gates.mjs`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `test-results/.last-run.json`
- `tests/e2e/screenshots/`
- `playwright-report/`

## Files changed
None - read-only audit

## Findings
1. Severity: High. The LMS DB browser runner is isolated and fail-closed, but artifact leak scanning is still manual. Evidence: `scripts/run-lms-db-e2e.mjs:35-52` prepares the DB, runs `npx playwright test -c playwright.lms-db.config.ts`, cleans the prep marker, and prints an archive reminder; no scanner command runs before the gate can be treated as accepted. `docs/ACCEPTANCE_MATRIX_MASTER.md:68-70` already requires artifacts to be archived/scanned before the gate is RUN. Recommendation: add a dedicated `scripts/scan-lms-db-e2e-artifacts.mjs` and call it from `scripts/run-lms-db-e2e.mjs` after Playwright finishes and before final exit; the runner should exit non-zero if either Playwright or artifact scanning fails. Target part: opt-in runner acceptance boundary.

2. Severity: High. The scanner should run for both passing and failing Playwright attempts, while preserving the original failure status. Evidence: `playwright.lms-db.config.ts:41-42` retains screenshots/traces only on failure, and failure artifacts are exactly where leaked response bodies, headers, or HTML snapshots are most likely to appear. Recommendation: change the runner from `execSync` fail-fast behavior to an explicit status collection flow: run prep, run Playwright, always scan existing artifact paths in a `finally`/post-run section, clean `.next-e2e-db/lms-db-e2e-prepared.json`, then exit with a composed failure code if Playwright failed or the scanner found leaks. Target part: artifact scanner wiring.

3. Severity: Medium. Artifact locations are currently shared with default Playwright output, which can mix default e2e evidence with the opt-in DB browser gate. Evidence: `playwright.lms-db.config.ts:31-65` has no explicit `outputDir` or reporter output folder; `test-results/.last-run.json:1-4` is currently only a default Playwright status file; `playwright-report/` is absent in this working tree; `tests/e2e/lms-db-materials.spec.ts:162-163` writes DB LMS screenshots into `tests/e2e/screenshots/lms-db-material-lesson-<project>.png`. Recommendation: give the DB config an explicit artifact root such as `test-results/lms-db-e2e/<run-id>/`, with subfolders for `playwright-output/`, `html-report/`, `screenshots/`, `stdout.log`, and `scan-report.json`; copy or write the LMS DB screenshots there instead of relying only on the shared screenshot directory. Target part: artifact capture layout.

4. Severity: Medium. `.gitignore` protects generated `test-results/` and `playwright-report/`, but not the deterministic LMS DB screenshot names. Evidence: `.gitignore:17-21` ignores `coverage/`, `test-results/`, `playwright-report/`, and only `tests/e2e/screenshots/*.tmp.png`; the screenshot directory currently contains many normal `.png` artifacts, and the DB spec writes `lms-db-material-lesson-*.png` via `tests/e2e/lms-db-materials.spec.ts:162-163`. Recommendation: either ignore `tests/e2e/screenshots/lms-db-material-lesson-*.png` or move/copy those screenshots under the ignored DB artifact root and keep only deliberate, curated screenshots in `tests/e2e/screenshots/`. Target part: accidental artifact commit prevention.

5. Severity: Medium. Documentation names the artifact set, but the runbook does not yet define a machine-checkable archive manifest. Evidence: `docs/DEPLOYMENT.md:67-69` says to keep redacted stdout, `test-results/`, `playwright-report/` if generated, and LMS DB screenshots; `docs/ACCEPTANCE_MATRIX_MASTER.md:68-70` requires archive/scan/drop-DB before RUN. Recommendation: the scanner should emit `test-results/lms-db-e2e/<run-id>/scan-report.json` with `runId`, artifact roots scanned, forbidden patterns checked, files scanned, zip/trace handling status, redacted DB name, Playwright status, scanner status, and operator DB-drop confirmation placeholder. Target part: acceptance evidence manifest.

6. Severity: Medium. The scanner must cover both text and binary/container artifacts, not just `secretlint`. Evidence: `package.json:17` runs `secretlint "**/*"`, which is useful for repository text but is not a targeted LMS artifact leak oracle; Playwright traces may be compressed, screenshots are binary, and the e2e spec deliberately creates sensitive sentinel values (`tests/e2e/lms-db-materials.spec.ts:41-45`, `tests/e2e/lms-db-materials.spec.ts:100-102`, `tests/e2e/lms-db-materials.spec.ts:147-154`). Recommendation: scan for fixed and generated LMS leak markers including `fileBytesBase64`, `storageKey`, `lms/materials/`, `DB LMS browser material`, `EICAR-STANDARD-ANTIVIRUS-TEST-FILE`, raw iframe HTML markers, `postgres://`, `LMS_E2E_DATABASE_URL`, `DATABASE_URL`, `SESSION_SECRET`, `SECRET_VAULT_KEK`, `Bearer `, and `Basic `. For `.zip` Playwright traces, either decompress entries before scanning or fail the scanner with an explicit "unscanned trace archive" error. Target part: leak scanner coverage.

7. Severity: Low. The LMS DB browser gate is currently kept out of default gates correctly, and that boundary should remain. Evidence: `package.json:27-31` wires default `e2e` and `ci:local` without `e2e:lms:db`; `scripts/gates.mjs:43-50` keeps Playwright e2e as its own plan and does not include `e2e:lms:db`; `tests/integration/lms-db-e2e-harness.test.ts:82-90` statically asserts the DB browser gate is not in default gates. Recommendation: keep the scanner inside `npm run e2e:lms:db`, not `ci:local`, `full`, or default `e2e`; default gates may continue to run static guards that verify the opt-in gate remains separate. Target part: default gate discipline.

## Decisions
- Treat `npm run e2e:lms:db` as the only supported entry point for LMS DB browser acceptance.
- Keep the LMS DB browser gate out of `npm run e2e`, `npm run ci:local`, and `node scripts/gates.mjs full`.
- Wire scanning as part of the opt-in runner itself, so a human cannot accidentally report RUN from a Playwright pass whose artifacts were never inspected.
- Archive only redacted command summaries and generated artifacts. Do not archive raw database URLs, credentials, session secrets, KEKs, or full unredacted environment dumps.
- Prefer one run-scoped artifact root under ignored `test-results/lms-db-e2e/<run-id>/` to avoid mixing DB acceptance evidence with default e2e output.

## Risks
- Until scanning is automated, a future successful Playwright run can still be over-reported as accepted while artifact leak checks remain manual.
- Shared artifact directories can cause stale screenshots or `.last-run.json` from default e2e to be mistaken for DB browser evidence.
- Playwright failure traces may contain useful debugging data and higher leak risk; treating traces as archived evidence without decompression-aware scanning is unsafe.
- The DB gate still mutates a throwaway Postgres database. RUN status must remain unavailable without a fresh empty `wtc_test_lms_*` URL and post-run database drop.
- Local DB-byte upload/download acceptance is not production object storage, external malware scanning, signed-object delivery, or quarantine cleanup.

## Verification/tests
RUN:
1. Read-only source and doc inspection of the requested runner, runbook, matrix, ignore rules, package scripts, Playwright config, static harness, current `test-results`, and screenshot directory.
2. Verified `docs/handoffs/20260602-0023-ecosystem-devops-implementer.md` did not exist before writing this handoff.
3. Verified current `test-results/.last-run.json` contains only `{"status":"passed","failedTests":[]}` and `playwright-report/` is absent in this working tree.

NOT RUN:
1. `npm run e2e:lms:db` - no fresh throwaway `LMS_E2E_DATABASE_URL` was supplied, and the command would mutate a database and start a local server.
2. `npx playwright test` / default Playwright - forbidden by requested read-only/no-server scope.
3. `psql`, migrations, seeds, DB setup/drop, or any database mutation - forbidden by requested scope.
4. `npm test`, typecheck, lint, `node scripts/gates.mjs full`, or `node scripts/gates.mjs e2e` - not needed for this read-only devops audit and not requested.
5. Live Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, preview/prod server, object storage, or malware scanner endpoints - forbidden by repository guardrails and requested scope.

## Next actions
1. Implement `scripts/scan-lms-db-e2e-artifacts.mjs` as a local, dependency-light scanner for the run-scoped LMS DB artifact root, including decompression or explicit failure for Playwright trace archives.
2. Update `scripts/run-lms-db-e2e.mjs` so the flow is: validate `LMS_E2E_DATABASE_URL` -> prepare throwaway DB -> run Playwright -> collect artifacts -> run scanner -> clean prep marker -> print RUN/NOT RUN summary -> exit non-zero on Playwright or scanner failure.
3. Update `playwright.lms-db.config.ts` with an explicit DB-run `outputDir` and reporter output path under `test-results/lms-db-e2e/<run-id>/`; avoid mixing with default e2e output.
4. Move or copy `lms-db-material-lesson-*.png` into the run-scoped artifact root, or add an ignore rule for those generated DB screenshots.
5. Extend the static harness to assert scanner wiring, explicit artifact root, scanner report creation, and continued exclusion from `ci:local`, default `e2e`, and `scripts/gates.mjs full`.
6. After implementation, the acceptance report should say `npm run e2e:lms:db` is RUN only if all are true: fresh empty `wtc_test_lms_*` DB supplied, prep succeeded, Playwright exited 0, scanner exited 0, artifacts archived with `scan-report.json`, and the operator dropped the throwaway DB. Otherwise report NOT RUN or FAILED with the exact missing/failed condition.
