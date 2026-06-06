# canary-security-perimeter-auditor handoff
## Scope
Phase 4.74 read-only security/perimeter audit for the WTC exact-main canary deploy target `abe6784518abcbebe38368f3cef05039d55c520f`.

Scope covered local repository state, current deployment/security docs, Phase 4.68 canary deploy handoffs, Phase 4.72 Tortila runtime auth/firewall handoffs, Phase 4.73 Legacy source-audit handoffs, GitHub Actions status for the target commit, and local read-only security/static gates. No live server, Docker, systemd, firewall, nginx, env, DB, tmux, or bot mutation was performed. No raw host/IP, secret, DSN, token value, env value, raw log, or raw DB row is recorded here.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/SECURITY_MODEL.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `docs/handoffs/20260606-0356-post-deploy-release-auditor.md`
- `docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md`
- `docs/handoffs/20260606-0313-bot-live-health-auditor.md`
- `docs/handoffs/20260606-0716-runtime-security-firewall-auditor.md`
- `docs/handoffs/20260606-0719-runtime-deploy-readiness-auditor.md`
- `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md`
- `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md`
- `docs/handoffs/20260606-0825-phase-473-legacy-source-audit-gate.md`
- `package.json`
- `packages/db/src/schema.ts`
- `packages/audit/src/redact.ts`
- `packages/auth/src/rbac.ts`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `scripts/legacy-closed-trade-source-audit.mjs`
- `scripts/tortila-canonical-source-verifier.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-runtime-config-sanitizer.test.ts`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- Git metadata, GitHub Actions run metadata for `abe6784518abcbebe38368f3cef05039d55c520f`, and retained `logs/gates` artifact root via scanner only.

## Files changed
None - read-only audit

## Findings
1. Severity: P0. The local/origin exact-main target is verified, but repo deployment docs still describe the live WTC web/worker canary as the older `3aff2738815562c18f5623e9686c4c2f4ba2ef3a` release. Evidence: `git rev-parse HEAD`, `main`, and `origin/main` all returned `abe6784518abcbebe38368f3cef05039d55c520f`; `docs/DEPLOYMENT.md:8`-`15` records the current WTC canary as `3aff273...`; `docs/NEXT_ACTIONS.md:6`-`10` says that release was deployed and proved health/continuity. Recommendation: do not claim exact-main canary deploy complete until the WTC canary/worker are switched to `abe678...` and the post-switch gates below are rerun. Target part: release identity and public smoke truth.
2. Severity: P0. GitHub required checks are green for the exact target. Evidence: `gh run view 27049107863` reported workflow `CI`, head SHA `abe6784518abcbebe38368f3cef05039d55c520f`, jobs `gates` and `e2e`, both `success`; `docs/DEPLOYMENT.md:528`-`533` says green CI is not a production deployment and server rollout/perimeter remain separate. Recommendation: treat CI as the release-entry gate only; still require server smoke, perimeter probes, rollback, and continuity after deploy. Target part: release governance.
3. Severity: P0. Public smoke for `abe678...` is NOT RUN in this audit. Prior public smoke is only proven for the older deployed canary release. Evidence: Phase 4.68 public smoke passed for `3aff273...` in `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:68`, and current deploy docs still point live canary to that release at `docs/DEPLOYMENT.md:8`-`15`. Recommendation: after exact-main switch, run public non-secret smoke for `/api/health`, `/`, `/login`, `/products`, and protected bot/admin login redirects; record only status codes and redacted host label. Target part: public canary perimeter.
4. Severity: P0. Internal bot-port negative probes are proven for Phase 4.72 canary state, but were NOT rerun for an exact-main WTC switch in this audit. Evidence: Phase 4.72 records public TCP negative probes for internal bot/proxy ports as `connected=False` at `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md:41`, and `docs/DEPLOYMENT.md:62` summarizes that gate as passed from the workstation vantage. Recommendation: after switching WTC web/worker to `abe678...`, rerun negative probes for internal bot ports `8000`, `8080`, `8123`, and `8300` without printing host/IP, and keep provider-console/private-network proof separate. Target part: network perimeter.
5. Severity: High. Local secret/artifact gates are green for this read-only audit, but retained deploy evidence for the future server switch still needs its own scan. Evidence: `npm run secret:scan` exited `0`; `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` exited `0`; `package.json:17` defines the text secret scan; `docs/ACCEPTANCE_MATRIX_MASTER.md:28` and `docs/ACCEPTANCE_MATRIX_MASTER.md:34` define secret and retained gate-log artifact scans. Recommendation: before/after canary-switch reports must retain only redacted summaries and scan any new retained evidence root before archive. Target part: secret/artifact evidence hygiene.
6. Severity: High. No plaintext exchange-secret exposure was found in the inspected source path, and the known Legacy plaintext-key hazard remains blocked rather than hidden. Evidence: `packages/db/src/schema.ts:6` and `packages/db/src/schema.ts:128`-`132` model exchange key secrets as sealed vault records with no plaintext column; `packages/audit/src/redact.ts:12`-`29` includes implemented secret-key hints including sealed/vault material; `docs/SECRET_VAULT_DESIGN.md:26` states the no-plaintext rule; `docs/CONTRACTS/legacy-bot-adapter.md:429`-`436` says the Legacy HTTP/control adapter path is removed/blocked until the upstream plaintext-key issue and safety gates clear. Recommendation: keep deploy smoke and server probes out of raw DB rows, env dumps, API-key endpoints, and exchange connectivity tests. Target part: exchange-secret boundary.
7. Severity: High. No live-control exposure was found in the inspected local surface, and targeted static tests passed. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:36`-`41` forbids systemd/tmux/process/env/exchange-key control paths from WTC; `docs/BOT_CONTROL_SAFETY_MODEL.md:262`-`269` keeps `/api/marks`, SSH/systemd/tmux, exchange orders, and exchange-key reads at `Never`; `tests/integration/two-bot-continuity-contract-static.test.ts:87`-`93` checks live-control misconfiguration; `tests/integration/bot-read-safety-static.test.ts:85`-`105` checks the bot list has no live-control/secret wiring. Recommendation: post-deploy smoke must remain read-only; do not hit `/api/marks`, `/api/overview`, start/stop/apply-config/test-connection, exchange pings, or any live-control route. Target part: live-control perimeter.
8. Severity: High. Rollback safety is documented for the current canary and Tortila journal auth, but exact-main deploy must refresh the immediate rollback pointer. Evidence: `docs/DEPLOYMENT.md:15`-`24` records current WTC canary rollback release and the latest pre-migration backup from the previous DB-changing deploy; `docs/DEPLOYMENT.md:64`-`66` states Tortila journal auth rollback should restart only `turtle-journal.service`, not `turtle-bot.service`. The `3aff273...` to `abe678...` diff did not include `packages/db/migrations`, `docker-compose.yml`, lockfile, web routes, or worker runtime files. Recommendation: if `abe678...` is deployed, record the newly created release path and make currently running `3aff273...` the immediate web/worker rollback target; do not run DB restore unless a migration/data change actually occurs. Target part: rollback and blast-radius control.

## Decisions
- Treated this lane as a single read-only security/perimeter auditor handoff; no N-agent claim is made.
- Did not run live server SSH, public curl, Docker, systemd, firewall, DB, tmux, or bot probes because no SSH alias was available in this workspace and the user forbade mutation; no host/IP discovery was attempted from raw env/secrets.
- Accepted local and GitHub gates as fresh for `abe678...`; treated server/public/perimeter gates as NOT RUN for `abe678...` until observed after the canary switch.
- Kept all server references redacted to service names, route names, internal port numbers, and release SHAs; no raw host/IP, token, DSN, env value, raw logs, or raw DB rows are recorded.

## Risks
- If the deploy report reuses Phase 4.68 public smoke or Phase 4.72 firewall probes without rerunning them after the exact-main switch, it will overstate what is proven for `abe678...`.
- No Docker healthcheck exists for canary/worker in the prior release evidence, so exact-main health must rely on HTTP health, protected-route redirects, worker continuity, restart counts, and bot-service PID/start evidence.
- Provider-console/security-group proof remains separate from workstation-vantage TCP negative probes.
- The local diff suggests no DB migration for `abe678...`, but the deploy operator must still verify the release checkout before deciding whether DB backup/migrate/restore gates are required.
- Full branded production, live-control audit, Legacy realized closed-trade source/import, and long burn-in remain outside this canary security/perimeter handoff.

## Verification/tests
RUN:
1. `git status --short --branch` - PASS; final branch `codex/phase-474-canary-deploy-abe6784`, no dirty files before this handoff write.
2. `git rev-parse HEAD`, `main`, and `origin/main` - PASS; all returned `abe6784518abcbebe38368f3cef05039d55c520f`.
3. `git log --oneline 3aff2738815562c18f5623e9686c4c2f4ba2ef3a..abe6784518abcbebe38368f3cef05039d55c520f` - PASS; reviewed release delta from current documented canary to target.
4. `git diff --name-only 3aff2738815562c18f5623e9686c4c2f4ba2ef3a..abe6784518abcbebe38368f3cef05039d55c520f -- packages/db/migrations packages/db/src/schema.ts apps/web/src apps/worker/src packages/config/src package.json package-lock.json docker-compose.yml .github docs/DEPLOYMENT.md docs/NEXT_ACTIONS.md docs/STATUS.md` - PASS; only `docs/DEPLOYMENT.md`, `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, and `package.json` appeared in that scoped check.
5. GitHub Actions read-only status via `gh run view 27049107863` - PASS; target SHA `abe678...`, jobs `gates` and `e2e` succeeded.
6. `npm run secret:scan` - PASS; output suppressed except exit code to avoid echoing sensitive snippets on failure.
7. `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates` - PASS; output suppressed except exit code.
8. `npx vitest run tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-runtime-config-sanitizer.test.ts tests/integration/admin-bot-completion-gate-map.test.ts tests/integration/legacy-closed-trade-source-proof-static.test.ts --minWorkers=1 --maxWorkers=2` - PASS; 5 files, 51 tests.
9. `git diff --check` - PASS.

NOT RUN:
1. Exact-main server release build/install/switch - not run; forbidden for this auditor.
2. Exact-main public smoke on `<wtc-canary-host>` - not run; no live server access used in this audit.
3. Exact-main internal bot-port negative probes - not run; prior Phase 4.72 canary proof exists, but must be rerun after switch.
4. Server Docker metadata, systemd status, firewall tables, nginx config, env-name checks, DB migration, DB backup/restore, DB row probes, or worker logs - not run; no server access and no raw env/log/DB evidence allowed.
5. Authenticated browser smoke - not run; only CI/e2e and local static gates were observed.
6. `/api/marks`, `/api/overview`, exchange pings, live bot start/stop/apply-config/test-connection, tmux interaction, service restart, Docker recreate, firewall mutation, env mutation, bot mutation - forbidden.
7. Provider-console/security-group/private-network proof, full branded production cutover, long burn-in, alerting/monitoring acceptance - not run; out of scope for this read-only lane.

## Next actions
1. Before switching WTC web/worker to `abe678...`, verify release checkout SHA, create the release directory, and confirm whether DB migrations changed; if no DB migration changed, keep rollback to the currently running `3aff273...` web/worker release.
2. After the switch, run public smoke for `/api/health`, `/`, `/login`, `/products`, and protected bot/admin redirects; record only status codes and redacted host label.
3. After the switch, rerun internal bot-port negative probes for `8000`, `8080`, `8123`, and `8300`; record only `connected=false/true` style status, never raw host/IP.
4. Capture WTC canary/worker restart counts, worker continuity, and bot-service continuity without raw logs: require `bot_continuity ok`, `tortila ok`, `legacy ok`, `tortila-snapshot ok`, `legacy-snapshot ok`, and unchanged/unapproved live-bot service restart evidence.
5. Run/retain deploy evidence through redacted summaries only, then rerun secret/artifact scans on any new retained evidence root before archiving.
6. Stop and roll back WTC web/worker if public smoke fails, internal bot ports become reachable publicly, worker continuity degrades, a secret appears in output, a bot PID/start unexpectedly changes, or any live-control/exchange path is touched.
