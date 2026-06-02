# ecosystem-tests-runner handoff
## Scope
Phase 3.38 read-only tests/gates audit for a live external scanner preflight. Scope was limited to focused test and gate recommendations for dry-run syntax, scanner artifact leak tests, and exact RUN/NOT RUN reporting. No product code, tests, package scripts, env files, gates, live scanner endpoint, object storage, database, server, or deployment target was changed or exercised.
## Files inspected
- `tests/integration/lms-material-storage.test.ts`
- `tests/integration/lms-db-e2e-artifact-scan.test.ts`
- `tests/integration/lms-db-e2e-harness.test.ts`
- `tests/integration/lms-object-storage-live-preflight.test.ts`
- `scripts/gates.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `package.json`
- `.env.example`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/EDUCATION_LMS_PLAN.md`
- `docs/handoffs/20260602-0341-phase-3-30-lms-external-scanner-boundary.md`
- `docs/handoffs/20260602-0634-phase-3-37-lms-object-store-live-preflight.md`
- `docs/handoffs/20260602-0634-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-0659-ecosystem-devops-implementer.md`
## Files changed
- `docs/handoffs/20260602-0659-ecosystem-tests-runner.md`
## Findings
1. High - There is no repo-native live external scanner acceptance command to syntax-check, dry-run, or report. Evidence: `package.json:27`-`package.json:30` exposes default e2e, LMS DB e2e, managed LMS DB e2e, and object-store preflight only; `docs/DEPLOYMENT.md:58`-`docs/DEPLOYMENT.md:63` documents the runtime scanner request contract, but `docs/DEPLOYMENT.md:87`-`docs/DEPLOYMENT.md:115` has a runbook only for object-store preflight and explicitly says it does not prove scanner behavior; `docs/PRODUCTION_BLOCKERS_CURRENT.md:16` keeps live external malware-scanner acceptance open. Recommendation: add a separate `scripts/lms-external-scanner-live-preflight.mjs` plus `accept:lms:external-scanner`, with `--dry-run` default/no-network behavior and explicit `--live` mode. Target part: external scanner acceptance gate.
2. High - Existing local tests prove the mocked runtime scanner boundary, not live scanner acceptance. Evidence: `tests/integration/lms-material-storage.test.ts:230`-`tests/integration/lms-material-storage.test.ts:266` verifies scanner-before-object-storage ordering and no filename/hash in the mocked scanner envelope; `tests/integration/lms-material-storage.test.ts:268`-`tests/integration/lms-material-storage.test.ts:288` verifies quarantined `s3-r2` verdicts do not write unsafe bytes to object storage; `tests/integration/lms-material-storage.test.ts:338`-`tests/integration/lms-material-storage.test.ts:374` verifies non-2xx, malformed, and timeout scanner responses fail closed. Recommendation: keep these tests in the focused command set, but require a new preflight integration test that executes the future dry-run command, proves no network I/O, proves live mode refuses missing consent, and validates clean/quarantine/failure/timeout cases through a safe live corpus before any RUN claim. Target part: focused scanner test suite.
3. High - Artifact leak scanning is strong enough to reuse, but scanner preflight evidence needs an explicit root and tests. Evidence: `scripts/scan-lms-db-e2e-artifacts.mjs:45`-`scripts/scan-lms-db-e2e-artifacts.mjs:46` rejects `LMS_FILE_SCANNER_ENDPOINT=` and `LMS_FILE_SCANNER_TOKEN=` assignments; `tests/integration/lms-db-e2e-artifact-scan.test.ts:66`-`tests/integration/lms-db-e2e-artifact-scan.test.ts:70` covers those scanner env leaks; `scripts/scan-lms-db-e2e-artifacts.mjs:5` does not include a scanner preflight log root in defaults, while `scripts/scan-lms-db-e2e-artifacts.mjs:130`-`scripts/scan-lms-db-e2e-artifacts.mjs:131` supports explicit scan roots. Recommendation: require `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight` before archiving scanner preflight evidence, and add fixture tests for redacted dry-run/live summaries that would fail on endpoint URLs, bearer tokens, Authorization headers, raw scanner bodies, object keys, provider errors, and matched secret values. Target part: retained scanner evidence.
4. Medium - The DB browser harness and object-store preflight are useful adjacent evidence but must stay separate from live scanner reporting. Evidence: `tests/integration/lms-db-e2e-harness.test.ts:125`-`tests/integration/lms-db-e2e-harness.test.ts:134` keeps the LMS DB browser gate out of default gates; `tests/integration/lms-object-storage-live-preflight.test.ts:29`-`tests/integration/lms-object-storage-live-preflight.test.ts:38` keeps object-store preflight out of default gates; `docs/ACCEPTANCE_MATRIX_MASTER.md:98`-`docs/ACCEPTANCE_MATRIX_MASTER.md:104` says live malware-engine acceptance still needs real endpoint/token, safe corpus, live clean/quarantine/failure/timeout observations, cleanup/reconciliation, and public rollout as separate observed gates. Recommendation: report object-store preflight, LMS DB browser acceptance, and external scanner acceptance as three separate gates. Target part: RUN/NOT RUN reporting.
5. Medium - Default gates are correctly non-mutating, so a future scanner preflight must stay opt-in and outside `full`, `e2e`, and `ci:local`. Evidence: `scripts/gates.mjs:47`-`scripts/gates.mjs:52` defines `full` without live acceptance commands and runs Playwright as a separate `e2e` plan; `package.json:33` wires `ci:local` without `accept:lms:object-storage`; `tests/integration/lms-object-storage-live-preflight.test.ts:33`-`tests/integration/lms-object-storage-live-preflight.test.ts:37` asserts the object-store preflight stays out of default gates. Recommendation: add the same static exclusion checks for `accept:lms:external-scanner` once introduced, then run it only as an operator-approved focused acceptance command. Target part: gate safety.
6. Medium - Exact phase reporting must classify missing scanner credentials or missing command as NOT RUN, not PASS. Evidence: `docs/SESSION_PROTOCOL.md:52`-`docs/SESSION_PROTOCOL.md:57` requires exact gates RUN and NOT RUN and forbids green claims unless observed in-session; `docs/DEPLOYMENT.md:112`-`docs/DEPLOYMENT.md:115` already uses the same distinction for object-store preflight; `docs/handoffs/20260602-0659-ecosystem-devops-implementer.md:17`-`docs/handoffs/20260602-0659-ecosystem-devops-implementer.md:20` independently flags the missing scanner command, missing scanner acceptance env controls, missing runbook, and explicit artifact-root need. Recommendation: the Phase 3.38 aggregate should say live scanner preflight is NOT RUN until a dedicated command exists, dry-run and focused tests pass, the live command exits 0 against operator-approved scanner credentials, and its retained artifacts scan clean. Target part: aggregate handoff and final report.
## Decisions
- Treat live external scanner preflight as a separate acceptance gate from mocked scanner unit coverage, object-store preflight, LMS DB browser acceptance, cleanup/reconcile acceptance, and public upload rollout.
- Keep default gates non-mutating; scanner preflight should be explicit and operator-approved, never part of `node scripts/gates.mjs full`, default Playwright, or `ci:local`.
- Reuse the generated-artifact scanner for scanner preflight evidence, but require an explicit scanner log root until a dedicated default root exists.
- Keep all retained evidence summary-only: no endpoint URL, bearer token, Authorization header, raw scanner response body, uploaded bytes, object key, signed URL token, DB URL, cookie, or provider error.
## Risks
- Without a dedicated dry-run/live command, operators may hand-run live scanner checks and accidentally retain endpoint URLs, bearer tokens, request bodies, or raw scanner responses.
- Runtime config plus mocked fetch tests can be mistaken for live malware-engine acceptance even though protocol, latency, auth, verdict shape, timeout, and failure behavior remain unobserved against a real endpoint.
- Scanner evidence could pass general secret scanning while still leaking domain-specific scanner data unless the artifact scanner is explicitly run over the scanner preflight log root.
- Public LMS uploads remain unsafe to enable until live object-store, live external scanner, observed DB-browser acceptance, cleanup/reconcile evidence, and artifact checks are all observed green in an operator-approved phase.
## Verification/tests
RUN in this audit:
- Targeted source and documentation inspection of the files listed above.
- Confirmed the workspace directory is not git-backed in this session, so changed-file verification must use direct filesystem checks instead of `git status`.

NOT RUN in this audit:
- `npm test` - read-only audit only; no product/test implementation changed.
- Focused Vitest command set - not run because this audit requested recommendations, not execution.
- `node --check scripts/lms-external-scanner-live-preflight.mjs` - NOT RUN because the scanner preflight script does not exist yet.
- `npm run accept:lms:external-scanner -- --dry-run` - NOT RUN because the package script does not exist yet.
- `npm run accept:lms:external-scanner -- --live` - NOT RUN because the package script does not exist and no operator-approved live scanner endpoint/token was supplied.
- `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight` - NOT RUN because no scanner preflight artifact root exists yet.
- `npm run accept:lms:object-storage -- --dry-run` and `npm run accept:lms:object-storage -- --live` - NOT RUN because object-store preflight was not requested and does not prove scanner acceptance.
- `npm run e2e:lms:db` and `npm run e2e:lms:db:managed` - NOT RUN because no throwaway DB URL/admin URL was supplied and this is not the scanner gate.
- `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run secret:scan`, `npm run governance:check`, `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run worker:smoke`, and `npm run db:generate -w @wtc/db` - NOT RUN because this was a read-only audit with one handoff file allowed.
- Live external scanner acceptance, live S3/R2 acceptance, preview/production server mutation, SSH, tmux, systemd, database migration/seed, public upload rollout, or live bot/exchange action - NOT RUN; outside scope and no explicit operator approval/credentials.

Recommended focused commands after the scanner preflight script and tests are added:
- `node --check scripts/lms-external-scanner-live-preflight.mjs`
- `npm test -- tests/integration/lms-material-storage.test.ts tests/integration/lms-db-e2e-artifact-scan.test.ts tests/integration/lms-db-e2e-harness.test.ts tests/integration/lms-external-scanner-live-preflight.test.ts`
- `npm run accept:lms:external-scanner -- --dry-run`
- `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight`
- `npm run secret:scan`
- `npm run governance:check`
- `node scripts/gates.mjs full`
- `node scripts/gates.mjs e2e`

Recommended live boundary only after dry-run and focused tests are green and the operator supplies a safe scanner endpoint/token plus an approved test corpus:
- `npm run accept:lms:external-scanner -- --live`
- `node scripts/scan-lms-db-e2e-artifacts.mjs logs/lms-scanner-preflight`
## Next actions
1. Add `scripts/lms-external-scanner-live-preflight.mjs` with `--dry-run` and explicit `--live` modes, no-network dry-run output, consent flags, safe corpus support, timeout handling, and summary-only artifacts.
2. Wire `package.json` script `accept:lms:external-scanner` and keep it out of `ci:local`, default `e2e`, and `scripts/gates.mjs` plans.
3. Add commented scanner preflight env controls to `.env.example`, separate from runtime scanner config.
4. Add `tests/integration/lms-external-scanner-live-preflight.test.ts` to prove dry-run redaction, no network I/O, live consent refusal, safe corpus reporting, artifact scanner compatibility, and default-gate exclusion.
5. Add a deployment runbook section for live external scanner preflight with PASS/FAIL/NOT RUN rules and the mandatory artifact scan command.
6. Keep live scanner acceptance marked NOT RUN until the dedicated command exists, dry-run and focused tests pass, a live operator-approved run exits 0, retained artifacts scan clean, and the phase report lists every skipped gate with a reason.
