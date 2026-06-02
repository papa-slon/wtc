# ecosystem-tests-runner handoff
## Scope
Phase 3.58 read-only tests-runner audit for the credentialed acceptance blocker packet after Phase 3.57. Scope was limited to reading the required governance/status/acceptance files and package scripts, identifying exact acceptance commands that remain NOT RUN without credentials, identifying which verification gates fit a docs/blocker packet, and writing this single handoff. No product code, preview, Playwright/e2e, live provider, database mutation, SSH, nginx/systemd, deploy, CI, or bot-service action was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `.env.example`
- `package.json` scripts
- `scripts/run-lms-db-e2e.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/audit-append-only-role-preflight.mjs`
- `scripts/lms-s3-r2-live-preflight.mjs`
- `scripts/lms-external-scanner-live-preflight.mjs`
- `scripts/billing-stripe-webhook-replay-preflight.mjs`
- `scripts/billing-stripe-checkout-preflight.mjs`
- `scripts/axioma-handoff-preflight.mjs`

## Files changed
None — read-only audit

## Findings
1. Severity: High. Phase 3.57 closed a local retained-evidence path-confinement gap, not live acceptance. Evidence: `docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md:3` says the phase did not run preview, Playwright, live DBs, live providers, SSH, nginx, systemd, deploy, GitHub CI, bot services, or monitoring; `docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md:75` lists the exact NOT RUN gates; `docs/NEXT_ACTIONS.md:14`-`docs/NEXT_ACTIONS.md:16` repeats live preview, e2e/Playwright, LMS DB browser, real-PG, audit-role, provider, server, CI, deploy, and monitoring as NOT RUN. Recommendation: keep Phase 3.58 as a blocker packet unless credentials are supplied and the matching acceptance command actually exits green. Target part: acceptance truth.

2. Severity: High. The core credentialed DB/browser commands that remain NOT RUN are exact and should not be replaced by local substitutes: `npm run e2e:lms:db` with `LMS_E2E_DATABASE_URL`, `npm run e2e:lms:db:managed` with `LMS_E2E_ADMIN_DATABASE_URL`, `npm test -- tests/integration/db-real-postgres.test.ts` with `REAL_POSTGRES_DATABASE_URL`, `npm run accept:real-pg:managed` with `REAL_POSTGRES_ADMIN_DATABASE_URL`, and `npm run accept:audit:append-only-role` with `AUDIT_APPEND_ONLY_DATABASE_URL`, `AUDIT_APPEND_ONLY_EXPECTED_ROLE`, and `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1`. Evidence: `package.json:28`-`package.json:36`; `docs/ACCEPTANCE_MATRIX_MASTER.md:25`-`docs/ACCEPTANCE_MATRIX_MASTER.md:26`; `docs/ACCEPTANCE_MATRIX_MASTER.md:94`-`docs/ACCEPTANCE_MATRIX_MASTER.md:103`; `scripts/run-lms-db-e2e-managed.mjs:9`-`scripts/run-lms-db-e2e-managed.mjs:16`; `scripts/run-real-pg-harness-managed.mjs:9`-`scripts/run-real-pg-harness-managed.mjs:14`; `scripts/audit-append-only-role-preflight.mjs:10`-`scripts/audit-append-only-role-preflight.mjs:18`; `docs/DEPLOYMENT.md:250`; `docs/DEPLOYMENT.md:268`-`docs/DEPLOYMENT.md:269`; `docs/DEPLOYMENT.md:380`-`docs/DEPLOYMENT.md:382`; `docs/DEPLOYMENT.md:468`-`docs/DEPLOYMENT.md:471`. Recommendation: list these as NOT RUN until operator credentials are present and the relevant command is executed with redacted retained evidence. Target part: credentialed database/browser acceptance.

3. Severity: High. Live provider acceptance remains credential/consent blocked; dry-run preflights are not live provider acceptance. Exact in-repo provider preflight commands are `npm run accept:lms:external-scanner -- --live`, `npm run accept:lms:object-storage -- --live`, `npm run accept:billing:stripe-webhook -- --dry-run`, `npm run accept:billing:stripe-checkout -- --dry-run`, and `npm run accept:axioma:handoff-preflight -- --dry-run`; Stripe/Axioma live acceptance still requires operator-provided scoped test/live credentials and evidence scans outside these dry-run-only local substitutes. Evidence: `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md:84`-`docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md:88`; `docs/DEPLOYMENT.md:64`-`docs/DEPLOYMENT.md:67`; `docs/DEPLOYMENT.md:77`; `docs/DEPLOYMENT.md:88`-`docs/DEPLOYMENT.md:91`; `docs/DEPLOYMENT.md:114`-`docs/DEPLOYMENT.md:117`; `docs/DEPLOYMENT.md:162`-`docs/DEPLOYMENT.md:169`; `docs/DEPLOYMENT.md:214`-`docs/DEPLOYMENT.md:221`; `docs/ACCEPTANCE_MATRIX_MASTER.md:68`-`docs/ACCEPTANCE_MATRIX_MASTER.md:87`; `docs/ACCEPTANCE_MATRIX_MASTER.md:132`-`docs/ACCEPTANCE_MATRIX_MASTER.md:137`; `docs/ACCEPTANCE_MATRIX_MASTER.md:186`-`docs/ACCEPTANCE_MATRIX_MASTER.md:193`. Recommendation: mark live object-store, live scanner, live Stripe, and live Axioma acceptance as NOT RUN unless scoped credentials plus consent flags are supplied and retained evidence scans green. Target part: live provider acceptance.

4. Severity: Medium. A docs/blocker packet should use governance and retained-evidence hygiene gates, not runtime acceptance gates. Appropriate packet gates are `npm run governance:check` after the operator aggregate cites this handoff, `npm run secret:scan` after blocker packet edits, `node scripts/scan-lms-db-e2e-artifacts.mjs <artifact-roots>` only for retained text/log evidence, and `npm run evidence:visual -- --manifest <visual-review.json> <artifact-roots>` only if screenshot/image evidence is retained. `npm run evidence:visual -- --inventory ...` is count-only and not acceptance. Evidence: `docs/SESSION_PROTOCOL.md:52`-`docs/SESSION_PROTOCOL.md:55`; `docs/ACCEPTANCE_MATRIX_MASTER.md:10`; `docs/ACCEPTANCE_MATRIX_MASTER.md:19`-`docs/ACCEPTANCE_MATRIX_MASTER.md:24`; `docs/DEPLOYMENT.md:294`-`docs/DEPLOYMENT.md:303`; `docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md:72`-`docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md:73`. Recommendation: for this packet, cite existing Phase 3.57 evidence and run only docs/evidence hygiene gates if docs are updated; do not treat those gates as live acceptance. Target part: blocker-packet verification.

5. Severity: Medium. `npm run preview:safe` is not a one-shot acceptance gate and raw preview/dev-server logs are not acceptable retained evidence. Evidence: `package.json:26` defines the wrapper; `docs/DEPLOYMENT.md:342`-`docs/DEPLOYMENT.md:347` says it is a long-running interactive stream and does not prove live preview smoke unless actually run or otherwise approved; `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md:129` forbids raw `dev-server.log`, `logs/preview-safe*.log`, copied terminal buffers, or screenshots of terminal output as acceptance evidence. Recommendation: keep preview smoke NOT RUN in this packet; if a later preview proof is approved, retain only redacted summary evidence and scan it before archive. Target part: preview evidence.

6. Severity: Medium. GitHub CI/commit/PR evidence cannot be claimed from this root. Evidence: `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_57_20260602.md:29` says not to claim commits, branches, PRs, GitHub CI, or merge readiness unless `git rev-parse --show-toplevel` proves the folder is git-backed; `docs/handoffs/20260602-1557-phase-3-57-symlink-hard-preflight-root-confinement.md:57` records the workspace was still not git-backed. Current read-only check returned `NOT_GIT_BACKED`. Recommendation: keep GitHub CI execution NOT RUN and avoid PR/merge claims. Target part: CI evidence.

## Decisions
- Did not run Playwright/e2e, `npm run preview:safe`, `node scripts/gates.mjs e2e`, DB-mutating acceptance, live provider preflights, SSH, nginx/systemd, deploy, CI, or bot services.
- Treated this lane as a read-only tests-runner blocker assessment. This handoff is not an aggregate phase handoff and does not change any acceptance gate status.
- Treated existing Phase 3.57 observed gates as evidence to cite, not as gates rerun in Phase 3.58.
- Treated missing credentials in the current process as blocker evidence without printing or archiving any credential values.

## Risks
- Credential environment was checked only in the current process; credentials may exist outside this shell or may be provided later by the operator.
- Governance is only a valid packet gate after the operator aggregate exists and cites every claimed per-agent handoff by path.
- Secret scanning covers text/config/source artifacts; screenshot/image evidence still requires the separate visual review manifest gate.
- Running `accept:audit:append-only-role` writes one `audit_logs` row by design; it must remain an explicit, approved credentialed acceptance action.

## Verification/tests
Read-only checks performed:

| Check | Result |
|---|---|
| Required repo files and package scripts inspected | PASS |
| Credential env presence checked without printing values | all checked blocker variables were unset in this process |
| `git rev-parse --show-toplevel` | NOT_GIT_BACKED |
| Target handoff path existence before write | absent |

Gates RUN by this auditor: none. This was a read-only blocker-packet audit, not an acceptance run.

Gates appropriate for a docs/blocker packet if the packet/aggregate is updated:

| Gate | Command | Use |
|---|---|---|
| governance | `npm run governance:check` | Run after the aggregate cites this handoff and any other claimed agents. |
| secret scan | `npm run secret:scan` | Run after blocker packet edits to catch plaintext secrets in text/source/config. |
| retained text/log scan | `node scripts/scan-lms-db-e2e-artifacts.mjs <artifact-roots>` | Run only for retained generated text/log evidence being archived. |
| retained visual review | `npm run evidence:visual -- --manifest <visual-review.json> <artifact-roots>` | Run only if screenshot/image artifacts are retained; inventory mode alone is not acceptance. |

Gates NOT RUN by this auditor: `npm run preview:safe`, `npm run e2e`, `node scripts/gates.mjs e2e`, `npm run e2e:lms:db`, `npm run e2e:lms:db:managed`, `npm test -- tests/integration/db-real-postgres.test.ts` with real DB credentials, `npm run accept:real-pg:managed`, `npm run accept:audit:append-only-role`, live LMS object-store/scanner acceptance, live/test Stripe acceptance, live Axioma acceptance, preview/prod DB migration/seed, SSH/nginx/systemd/server checks, GitHub CI execution, deploy, production monitoring, and bot services.

## Next actions
1. If credentials are available, run the matching credentialed acceptance path first: `npm run e2e:lms:db:managed`, `npm run accept:real-pg:managed`, or `npm run accept:audit:append-only-role`.
2. If credentials remain unavailable, write the operator aggregate blocker packet and cite this handoff plus the Phase 3.57 evidence. The aggregate must list exact gates RUN and NOT RUN with reasons.
3. For a docs-only blocker packet, run `npm run governance:check` after the aggregate exists and `npm run secret:scan` after docs edits. Add retained artifact scanner or visual-review gates only if new generated evidence is retained.
4. Do not claim production readiness, live preview readiness, real-Postgres acceptance, LMS DB browser acceptance, provider acceptance, GitHub CI, deploy, or monitoring until the matching command is observed green in the current session with redacted evidence.
