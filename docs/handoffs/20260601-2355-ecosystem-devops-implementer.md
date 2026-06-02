# ecosystem-devops-implementer handoff
## Scope
Phase 3.19 read-only devops audit for the operator runbook and isolated DB-backed LMS e2e harness hardening after Phase 3.18. Scope covered `scripts/run-lms-db-e2e.mjs`, `scripts/prepare-lms-db-e2e.ts`, `playwright.lms-db.config.ts`, `docs/DEPLOYMENT.md`, package scripts, gate runner behavior, artifact documentation, and the current static harness guard. No product code was edited. No servers, Playwright runs, database commands, psql calls, migrations, seeds, live endpoints, SSH, tmux, systemd, preview/prod services, object storage, or malware scanner were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `playwright.lms-db.config.ts`
- `tests/e2e/lms-db-materials.spec.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `package.json`
- `apps/web/package.json`
- `scripts/gates.mjs`
- `playwright.config.ts`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260601-2350-phase-3-18-lms-db-browser-acceptance-harness.md`
- `docs/handoffs/20260601-2350-ecosystem-db-architect.md`
- `docs/handoffs/20260601-2350-ecosystem-devops-implementer.md`

## Files changed
None - read-only audit

## Findings
1. High - The LMS DB browser harness is documented as an `LMS_E2E_DATABASE_URL`-only operator action, but the runner and prep script still accept `REAL_POSTGRES_DATABASE_URL` as a fallback. Evidence: `scripts/run-lms-db-e2e.mjs:6` and `scripts/prepare-lms-db-e2e.ts:6` use `process.env.LMS_E2E_DATABASE_URL ?? process.env.REAL_POSTGRES_DATABASE_URL`; `docs/DEPLOYMENT.md:54-65` says LMS DB browser acceptance must run through `npm run e2e:lms:db` after setting `LMS_E2E_DATABASE_URL`; `docs/DEPLOYMENT.md:80-147` separately defines `REAL_POSTGRES_DATABASE_URL` for the real-Postgres Vitest harness. Recommendation: remove the fallback from both scripts, require `LMS_E2E_DATABASE_URL` explicitly, and fail with a message that `REAL_POSTGRES_DATABASE_URL` is for the non-browser real-PG harness only. Target part: harness env isolation.
2. Medium - Fresh/empty database enforcement is present in code, but the operator runbook should make one-database-per-run and forced cleanup explicit enough for repeatable execution. Evidence: `scripts/prepare-lms-db-e2e.ts:17-21` refuses non-`wtc_test*` names, `scripts/prepare-lms-db-e2e.ts:32-41` refuses any existing public base table, and `docs/DEPLOYMENT.md:57-68` shows create/run/drop commands but does not state that each run needs a unique fresh database or how to handle an already-connected throwaway DB. Recommendation: update the runbook to require `wtc_test_lms_<YYYYMMDDHHMMSS>` per run, state that a reused DB is invalid unless dropped and recreated first, and document the operator/admin cleanup path including active-connection termination or `DROP DATABASE ... WITH (FORCE)` where supported. Target part: runbook database lifecycle.
3. Medium - Direct Playwright config invocation is now mostly fail-closed, but the runner leaves the prep marker behind and the static guard does not yet lock the direct-run contract. Evidence: `scripts/run-lms-db-e2e.mjs:12-13` creates a random prep token and deletes the marker before a run, `scripts/prepare-lms-db-e2e.ts:51-57` writes `.next-e2e-db/lms-db-e2e-prepared.json`, `playwright.lms-db.config.ts:14-24` rejects missing marker/token or URL mismatch, and `tests/integration/lms-db-e2e-harness.test.ts:26-34` only checks that these strings exist. Recommendation: delete the marker in a runner `finally` after Playwright exits, and extend the static test to assert that the only supported root command is `npm run e2e:lms:db`, that the fallback to `REAL_POSTGRES_DATABASE_URL` is absent, and that direct `npx playwright test -c playwright.lms-db.config.ts` remains unsupported in docs. Target part: direct-config hardening.
4. Medium - Artifact capture is under-documented for the first real `npm run e2e:lms:db` acceptance run. Evidence: `docs/DEPLOYMENT.md:67` says "Archive artifacts if needed" without listing what counts; `playwright.lms-db.config.ts:41-42` retains screenshots/traces on failure; `tests/e2e/lms-db-materials.spec.ts:8`, `tests/e2e/lms-db-materials.spec.ts:155`, and `tests/e2e/lms-db-materials.spec.ts:208` write mobile layout screenshots under `tests/e2e/screenshots/`; `.gitignore:19-21` excludes Playwright result/report folders and tmp screenshots. Recommendation: document the artifact set for accepted runs: runner stdout/stderr summary with secrets redacted, exact command and DB name only, `test-results/`, `playwright-report/` if generated, and `tests/e2e/screenshots/lms-db-material-lesson-*.png`, followed by throwaway DB drop confirmation. Target part: runbook evidence capture.
5. Low - Default gates correctly exclude the DB-backed LMS browser harness today, but this should be protected because folding it into defaults would make local gates mutate databases and start a second e2e server. Evidence: `package.json:27-31` keeps `e2e:lms:db` separate from `e2e` and `ci:local`; `scripts/gates.mjs:47-53` defines `full` without e2e and `e2e` as only the default `npx playwright test`; `playwright.config.ts:23-35` starts the demo-mode server on port 3100, while `playwright.lms-db.config.ts:48-63` starts the DB harness on port 3101 with `DATABASE_URL`. Recommendation: add a static guard asserting `e2e:lms:db` is not referenced by `ci:local`, `scripts/gates.mjs` `full`, or default `e2e`, and keep reporting it as a separate RUN/NOT RUN gate. Target part: gate separation.
6. Low - The acceptance matrix has not caught up to the Phase 3.18 LMS DB browser gate, so future completion reviews can miss the required evidence. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:62-65` lists PG7 education/LMS criteria but no `npm run e2e:lms:db` row or fresh-DB evidence requirement; `docs/STATUS.md:3-15` and `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` already state the harness exists but the throwaway-Postgres browser run remains NOT RUN. Recommendation: add an LMS DB browser acceptance row to the matrix with the exact command, required fresh `wtc_test_lms_*` database, artifact expectations, and NOT RUN semantics until an observed green run. Target part: documentation source of truth.
7. Low - Some post-Phase 3.18 docs still repeat the `REAL_POSTGRES_DATABASE_URL` fallback, which will become stale once the LMS browser harness is isolated to `LMS_E2E_DATABASE_URL`. Evidence: `docs/IMPLEMENTED_FILES.md:4-6` says the LMS browser harness requires `LMS_E2E_DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`, while `docs/NEXT_ACTIONS.md:5-13` correctly names `LMS_E2E_DATABASE_URL` only. Recommendation: after the script hardening, update `IMPLEMENTED_FILES`, `DEPLOYMENT`, and `NEXT_ACTIONS` to consistently reserve `REAL_POSTGRES_DATABASE_URL` for `tests/integration/db-real-postgres.test.ts`. Target part: docs consistency.

## Decisions
- Treat Phase 3.19 as a single foreground read-only `ecosystem-devops-implementer` audit, not a broad implementation phase.
- Do not run `npm run e2e:lms:db`, `npx playwright test`, `node scripts/gates.mjs e2e`, `npm test`, migrations, seeds, `psql`, or any server command because the prompt explicitly forbids servers, Playwright, DB/psql, and live endpoint activity.
- Keep `npm run e2e:lms:db` out of default `npm run e2e`, `node scripts/gates.mjs full`, and `npm run ci:local` until CI/operator flow can provision and destroy a fresh throwaway database safely.
- Prefer one explicit variable for the browser harness: `LMS_E2E_DATABASE_URL`. `REAL_POSTGRES_DATABASE_URL` should remain the Vitest real-PG harness variable only.

## Risks
- If the `REAL_POSTGRES_DATABASE_URL` fallback remains, an operator may unintentionally reuse the real-PG harness database for browser acceptance, mixing two mutation-heavy gates and weakening evidence.
- If artifact paths are not documented before the first green run, the run may be technically successful but insufficiently auditable for production-readiness evidence.
- If direct config invocation is manually forced, it can produce results that look similar to the supported gate but lack the runner's fresh-DB preparation and cleanup guarantees.
- If the acceptance matrix is not updated, future "done" reviews can rely on default demo e2e and miss the unobserved DB-backed browser gate.

## Verification/tests
- Read-only inspection only.
- Ran `rg`/`Get-Content`/`Test-Path` style file inspections against the files listed above.
- Confirmed `docs/handoffs/20260601-2355-ecosystem-devops-implementer.md` did not exist before this handoff was written.
- Confirmed the workspace is not a git repository (`git status --short` returned `fatal: not a git repository`).
- NOT RUN: `npm run e2e:lms:db` - forbidden by prompt and would start a server and mutate a database.
- NOT RUN: `npx playwright test` / `node scripts/gates.mjs e2e` / `npm run e2e` - forbidden by prompt because they start Playwright/dev servers.
- NOT RUN: `npm test`, `npm run typecheck`, `npm run lint`, `node scripts/gates.mjs full`, `npm run ci:local` - outside this read-only audit and not needed to write the requested handoff.
- NOT RUN: `npm run db:migrate`, `npm run db:seed`, `scripts/prepare-lms-db-e2e.ts`, `psql`, and any database connection - forbidden by prompt.
- NOT RUN: live Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, preview/prod server, object storage, malware scanner, or live endpoint calls - forbidden/out of scope.

## Next actions
1. Change `scripts/run-lms-db-e2e.mjs` and `scripts/prepare-lms-db-e2e.ts` to require `LMS_E2E_DATABASE_URL` only and reject the `REAL_POSTGRES_DATABASE_URL` fallback for browser acceptance.
2. Add runner cleanup and operator feedback: remove `.next-e2e-db/lms-db-e2e-prepared.json` in `finally`, print non-secret artifact locations, and remind the operator to drop the throwaway DB.
3. Update `docs/DEPLOYMENT.md` with a stricter runbook: unique `wtc_test_lms_<timestamp>` DB per run, empty-schema refusal, direct-config unsupported, artifact list, redaction rules, and forced drop/connection cleanup guidance.
4. Extend `tests/integration/lms-db-e2e-harness.test.ts` to statically guard env isolation, direct-config unsupported docs, marker cleanup behavior, and exclusion from `ci:local`/`scripts/gates.mjs` default plans.
5. Update `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/NEXT_ACTIONS.md` so the LMS DB browser gate is a separate NOT RUN/RUN acceptance item and `REAL_POSTGRES_DATABASE_URL` is reserved for the real-PG Vitest harness.
