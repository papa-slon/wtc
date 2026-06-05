# admin-runtimehealth-gates-security-auditor handoff
## Scope
Read-only Phase 4.17 audit of acceptance-gate and safety boundaries for extending selected-user admin bot detail `runtimeHealth` DB E2E coverage. Focus: targeted gates after harness/spec changes, DB/browser/live gates that must stay NOT RUN without explicit throwaway Postgres, secret-safety assertions for scenario marker/detail text, and whether the core gate should be rerun when only tests/scripts change.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md`
- `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md`
- `package.json`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.admin-user-bots-db.config.ts`
- `playwright.config.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - evidence `package.json:34`, `package.json:35`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:28`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:31`, `scripts/gates.mjs:15`, `scripts/gates.mjs:50` - recommendation: after harness/spec changes, run the focused static harness test first, then lint the touched harness/spec/script files, then run the loader/static admin-user bot detail tests if DTO/fixture expectations changed, and run `node scripts/gates.mjs core` before calling the local slice green; target part: targeted local acceptance gates. The admin-user-bots DB E2E scripts are opt-in and excluded from default `e2e`/`ci:local`, while `core` is the repo-local acceptance sweep that includes governance, smokes, lint, root/web typecheck, secret scan, Vitest, and `db:generate`.
2. Severity P1 - evidence `scripts/gates.mjs:16`, `scripts/gates.mjs:17`, `scripts/gates.mjs:44`, `scripts/gates.mjs:51`, `scripts/gates.mjs:53`, `scripts/gates.mjs:96` - recommendation: do not use `node scripts/gates.mjs full` as a substitute for browser proof; run `full` only when a web build is needed and run E2E as its own explicit plan or opt-in DB runner; target part: gate sequencing. The gate runner intentionally separates `e2e` from `full`, and strict E2E treats flaky tests as failing.
3. Severity P1 - evidence `scripts/run-admin-user-bot-detail-e2e.mjs:7`, `scripts/run-admin-user-bot-detail-e2e.mjs:10`, `scripts/prepare-admin-user-bot-detail-e2e.ts:37`, `scripts/prepare-admin-user-bot-detail-e2e.ts:39`, `scripts/prepare-admin-user-bot-detail-e2e.ts:54`, `scripts/prepare-admin-user-bot-detail-e2e.ts:59`, `playwright.admin-user-bots-db.config.ts:14`, `playwright.admin-user-bots-db.config.ts:30` - recommendation: keep `npm run e2e:admin-user-bots:db`, direct Playwright on `playwright.admin-user-bots-db.config.ts`, and DB-backed browser acceptance NOT RUN unless `ADMIN_USER_BOTS_E2E_DATABASE_URL` names a fresh empty `wtc_test` / `wtc_test_*` database and the runner-created marker/HMAC matches; target part: DB/browser mutation safety.
4. Severity P1 - evidence `scripts/run-admin-user-bot-detail-e2e-managed.mjs:14`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:18`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:40`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:53`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:64`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:68`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:99`, `scripts/run-admin-user-bot-detail-e2e-managed.mjs:115` - recommendation: keep `npm run e2e:admin-user-bots:db:managed` NOT RUN unless an approved maintenance admin Postgres URL is explicitly supplied; target part: managed throwaway DB proof. The managed runner creates `wtc_test_admin_user_bots_*`, delegates to the existing harness, and drops the DB, but it is still a DB-mutation gate and must not be inferred from static tests.
5. Severity P1 - evidence `scripts/run-admin-user-bot-detail-e2e.mjs:34`, `scripts/run-admin-user-bot-detail-e2e.mjs:35`, `scripts/run-admin-user-bot-detail-e2e.mjs:36`, `playwright.admin-user-bots-db.config.ts:67`, `playwright.admin-user-bots-db.config.ts:68`, `playwright.admin-user-bots-db.config.ts:69`, `tests/e2e/admin-user-bot-detail-db.spec.ts:156`, `tests/e2e/admin-user-bot-detail-db.spec.ts:158` - recommendation: preserve mock adapter mode, disabled live control, disabled TV automation, zero forms, and no start/stop/apply/test-connection buttons in every expanded runtimeHealth scenario; target part: live-control safety. Extending coverage must not accidentally become live bot control or exchange/provider acceptance.
6. Severity P1 - evidence `scripts/prepare-admin-user-bot-detail-e2e.ts:389`, `scripts/prepare-admin-user-bot-detail-e2e.ts:393`, `scripts/prepare-admin-user-bot-detail-e2e.ts:394`, `scripts/prepare-admin-user-bot-detail-e2e.ts:397`, `scripts/prepare-admin-user-bot-detail-e2e.ts:401`, `scripts/prepare-admin-user-bot-detail-e2e.ts:405`, `scripts/prepare-admin-user-bot-detail-e2e.ts:406`, `tests/e2e/admin-user-bot-detail-db.spec.ts:13`, `tests/e2e/admin-user-bot-detail-db.spec.ts:56`, `tests/e2e/admin-user-bot-detail-db.spec.ts:113`, `tests/e2e/admin-user-bot-detail-db.spec.ts:152`, `tests/e2e/admin-user-bot-detail-db.spec.ts:154` - recommendation: for every new scenario marker/detail string, add either a positive visible assertion for sanitized business text or a negative hidden-marker assertion for raw provider, token, API key, quarantine, sealed secret, cross-user, raw config, raw trade, and base64-encoded variants; target part: runtimeHealth secret-safety assertions. The current spec proves safe detail text appears and then scans body text for hidden markers and their base64 encodings.
7. Severity P2 - evidence `scripts/redacted-child-process.mjs:7`, `scripts/redacted-child-process.mjs:13`, `scripts/redacted-child-process.mjs:16`, `scripts/redacted-child-process.mjs:44`, `scripts/redacted-child-process.mjs:78`, `scripts/redacted-child-process.mjs:79`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:111`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:121`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:124`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:126`, `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:128` - recommendation: continue to route child output through the redacted helper and keep static assertions that archived files do not contain full DB URLs or credentials; target part: log/artifact safety. Playwright traces and screenshots should be retained only after review and scanner-clean confirmation.
8. Severity P2 - evidence `AGENTS.md:57`, `AGENTS.md:76`, `AGENTS.md:77`, `docs/SESSION_PROTOCOL.md:54`, `docs/SESSION_PROTOCOL.md:56`, `docs/SESSION_PROTOCOL.md:83`, `docs/SESSION_PROTOCOL.md:84`, `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md:68`, `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md:60`, `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md:64` - recommendation: if only tests/scripts change, rerun focused tests/lint first and rerun `node scripts/gates.mjs core` before claiming local green because core includes secret scan, Vitest, and generation drift; do not rerun DB/browser/live gates unless their explicit throwaway credentials are supplied; target part: completion honesty.

## Decisions
- This audit did not execute gates, start preview/browser servers, touch live services, read raw env values, read raw secrets, or mutate any DB.
- Recommended post-change gate order: `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`; targeted ESLint for touched harness/spec/script files; `npx vitest run tests/integration/admin-user-bot-detail-loader.test.ts tests/integration/admin-user-bot-detail-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` when loader/static expectations are touched; `node scripts/gates.mjs core` before claiming local green.
- Run `node scripts/gates.mjs full` only if the change can affect web build output or the operator requires build proof; it is not a browser or DB acceptance substitute.
- Run `npm run e2e:admin-user-bots:db:managed` only with an explicit approved `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, or `npm run e2e:admin-user-bots:db` only with an explicit fresh empty `ADMIN_USER_BOTS_E2E_DATABASE_URL`.
- Keep `npm run accept:worker:continuity`, `npm run accept:real-pg:managed`, `npm run db:migrate`, `npm run db:seed`, live bot control, exchange/provider calls, deploy, SSH/tmux/systemd, raw env reads, and raw secret reads NOT RUN in this slice without separate explicit operator authorization and throwaway/intended-environment credentials.

## Risks
- Static harness tests can prove the guarded runner/spec shape, but they do not prove real browser rendering against Postgres; DB-backed browser acceptance remains unobserved until the opt-in runner is executed against a disposable DB.
- Fresh-green, stale, and missing runtimeHealth scenarios can false-green if fixture design does not isolate latest health rows per target; the next implementation should avoid relying on a newer same-target health row that masks the intended scenario.
- Retained Playwright traces/screenshots may contain sensitive rendered text if hidden-marker assertions regress; do not archive them until reviewed and scanner-clean.
- The worktree is heavily dirty with many pre-existing edits and untracked files; local gate outcomes may reflect unrelated changes.

## Verification/tests
RUN:
- Read-only file inspection and static grep of the requested gate, runner, fixture, protocol, and harness/spec boundaries.
- `git status --short --branch` for workspace state only; no git mutation.

NOT RUN:
- `npx vitest run tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - not run by this read-only audit agent; recommended as the first targeted post-change gate.
- Targeted ESLint - not run by this read-only audit agent; recommended after harness/spec/script edits.
- `node scripts/gates.mjs core` - not run by this read-only audit agent; rerun after tests/scripts changes before local green claims.
- `node scripts/gates.mjs full` - not run; only needed when build proof is in scope.
- `node scripts/gates.mjs e2e`, default `npm run e2e`, and direct Playwright DB config - not run; browser gates are outside this audit and DB config requires runner-created env/marker.
- `npm run e2e:admin-user-bots:db` - NOT RUN; no explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` was provided.
- `npm run e2e:admin-user-bots:db:managed` - NOT RUN; no explicit `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided.
- `npm run accept:worker:continuity`, `npm run accept:real-pg:managed`, `npm run db:migrate`, `npm run db:seed`, live bot start/stop/apply-config, exchange/provider calls, deploy, SSH/tmux/systemd, raw env reads, raw secret reads - NOT RUN by scope and safety policy.

## Next actions
1. Implement the expanded selected-user runtimeHealth DB E2E matrix only with isolated fixture semantics for fresh-green, stale, and missing states.
2. For each new fixture marker/detail string, update both the static harness and browser spec so safe text is asserted visible and raw/cross-user/secret text is asserted hidden, including base64 variants.
3. After implementation, run the targeted static/lint gates, then `node scripts/gates.mjs core`; run the DB browser gate only when a disposable Postgres target is explicitly supplied.
4. In the aggregate Phase 4.17 handoff, list exact RUN and NOT RUN gates and keep DB/browser/live acceptance NOT RUN unless observed in this session.
