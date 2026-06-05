# deploy-target-discovery-auditor handoff
## Scope
Phase 4.62 read-only deploy/canary target discovery for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope was limited to repo docs, scripts, and config evidence needed to decide whether a production/canary deploy phase can safely start from local repository evidence alone. No SSH, scp, rsync, systemd, tmux, process control, live-host curl, production DB command, deploy command, or raw secret/DSN/token readout was run.

This is a single auditor handoff. No N-agent audit is claimed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/ARCHITECTURE.md`
- `docs/handoffs/20260605-1810-production-deploy-readiness-auditor.md`
- `docs/handoffs/20260605-1810-phase-460-production-readiness-hardening.md`
- `docs/handoffs/20260605-2005-production-boundary-auditor.md`
- `docs/handoffs/20260605-2005-release-merge-deploy-auditor.md`
- `docs/handoffs/20260605-2018-phase-461-main-merge-ci-truth.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`
- `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md`
- `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md`
- `docs/handoffs/20260531-1220-deploy-ip-readiness-auditor.md`
- `docs/handoffs/20260531-1426-deploy-production-readiness-auditor.md`
- `docs/handoffs/20260531-1600-admin-terminal-deploy-auditor.md`
- `.env.example` (variable names/placeholders only; values redacted during inspection)
- `.github/workflows/ci.yml`
- `docker-compose.yml`
- `package.json`
- `scripts/safe-preview.mjs`
- `scripts/gates.mjs`
- `scripts/run-tortila-real-read-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/redacted-child-process.mjs`

## Files changed
- `docs/handoffs/20260605-2058-deploy-target-discovery-auditor.md` only.

## Findings
1. Severity P0 - Production deploy cannot proceed from local repo evidence alone. Evidence: `docs/DEPLOYMENT.md:494-503` says every server rollout phase requires explicit approval; `docs/DEPLOYMENT.md:546-559` keeps production DB migration/seed, production deployment, nginx/domain/TLS, production auth/proxy proof, real bot adapters, and live bot/process-control gates NOT RUN; `docs/NEXT_ACTIONS.md:81-85` keeps Tortila production auth/firewall/deploy and production deploy/canary NOT RUN; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:97-99` says live/server preview smoke and deploy/server checks need an operator-approved target/checklist and are NOT RUN. Recommendation: start an explicit deploy target phase only after the operator supplies a target packet and approval. Target part: deploy phase entry gate.

2. Severity P0 - Current repo evidence proves release/CI history, not a current deploy target. Evidence: `docs/DEPLOYMENT.md:442-459` records Phase 4.61 GitHub CI passing while warning CI is not production deployment; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:98` clears GitHub CI only for merge commit `ed31aaaf89ebc4920a13887542fa3bb0bbd99545`; `package.json:11-56` contains local/acceptance scripts but no deploy script; `.github/workflows/ci.yml:11-165` contains `gates` and `e2e` jobs only, with no SSH/systemd/deploy job. Recommendation: before any deploy, name the exact release SHA/branch, ensure it is committed, and rerun/observe CI if the deploy tree differs from the already-verified merge commit. Target part: release selection and CI boundary.

3. Severity P0 - Historical canary evidence exists but is stale and sanitized; it is a pattern, not authorization. Evidence: Phase 3.64 recorded a public HTTPS canary and server changes at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:3-6` and `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:33-41`; Phase 3.67 recorded a prior WTC canary replacement pattern at `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:34-39` and `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:74-80`; Phase 3.68 recorded a later WTC canary/worker replacement at `docs/handoffs/20260603-1435-phase-3-68-legacy-db-live-read-canary.md:42-45`. These records do not prove the current server state, current rollback target, current canary host, or current operator authorization. Recommendation: require fresh operator confirmation of target host/domain, allowed services, current release/rollback paths, and whether web-only or web+worker replacement is approved. Target part: deploy target inventory.

4. Severity P0 - Required production/target inputs are absent from the repo and must not be inferred. Evidence: `docs/DEPLOYMENT.md:515-525` lists required production env and non-mock Tortila requirements; `.env.example:2` says never copy server secrets into the repo; `.env.example:84-100` names bot endpoint/token variables without real values; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:90-94` keeps intended append-only audit role, object-store/scanner, Stripe, and Axioma credentialed gates NOT RUN because target credentials/config are absent; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:99` says deploy/server checks require explicit approval, server target, secrets, and rollback plan. Recommendation: collect only non-secret target metadata in the next phase, and use a secret manager/operator shell for actual values. Target part: secrets, DB, provider, and approval inputs.

5. Severity P1 - The checked-in deploy runbook is not complete enough for a safe production mutation by itself. Evidence: `docker-compose.yml:1-19` is local development Postgres only; the repo file search found no app Dockerfile, checked-in nginx template, checked-in systemd unit, or deploy script; `docs/ARCHITECTURE.md:370-383` gives conceptual deployment phases, not a current operational runbook; `docs/DEPLOYMENT.md:505-513` documents generic migration/rollback expectations but not a current target backup file, rollback release, or operator-approved command sequence. Recommendation: after target inputs are supplied, write a sanitized deploy checklist/runbook before mutation, including release build, backup, smoke, rollback, and evidence capture steps. Target part: devops runbook.

6. Severity P1 - Production bot/provider boundaries still require separate approval and proof. Evidence: `AGENTS.md:74-82` keeps discovery read-only, forbids plaintext exchange secrets, and blocks live bot start/stop/apply-config until audits pass; `docs/DEPLOYMENT.md:557-559` keeps real bot adapters and any live bot/exchange systemd/process-control NOT RUN; `docs/NEXT_ACTIONS.md:81-83` keeps Tortila production auth/firewall/deploy and live-control actions NOT RUN; `docs/handoffs/20260605-2018-phase-461-main-merge-ci-truth.md:92-97` keeps production DB/deploy, Tortila production probes, Legacy source, live controls, and provider gates NOT RUN. Recommendation: a canary deploy may keep bot mode bounded only according to the target packet; do not enable non-mock adapters without explicit journal/source/firewall/probe approval, and do not add live controls. Target part: bot integration safety.

7. Severity P1 - Monitoring, proxy, firewall, and post-deploy smoke evidence are not currently executable from local repo evidence. Evidence: `docs/DEPLOYMENT.md:552-558` keeps production deployment, nginx/TLS, auth proxy proof, and real adapter production proof NOT RUN; historical canary handoffs record firewall/probe checks as part of prior live phases at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:86-90` and `docs/handoffs/20260603-1225-phase-3-67-bot-analytics-settings-canary-deploy.md:104-107`; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:97` says live/server preview smoke needs an approved target and evidence plan. Recommendation: next phase must name approved smoke URLs/routes, expected service checks, firewall/proxy checks, monitoring/burn-in duration, and redaction/artifact rules before touching the server. Target part: post-deploy verification.

## Decisions
1. Verdict: production deploy cannot proceed from local repo evidence alone.
2. The repo contains enough evidence to plan an approved canary/deploy phase, but not enough to start mutation safely.
3. Historical WTC canary paths and service names may be used as clues only after fresh target confirmation; they are not current target proof.
4. The exact missing inputs are:
   - Explicit operator approval for a deploy/canary phase, including whether this is production, canary, or preview.
   - Target host/domain/canary URL and approved access method, provided without raw secrets.
   - Exact release branch/SHA to deploy and whether the current docs-only handoff branch is included or excluded.
   - Allowed server process boundaries: web only or web plus worker; permitted container/service names; forbidden bot/nginx/systemd actions.
   - Current rollback target: previous release path/container, DB backup location/plan, and rollback smoke.
   - Target database name/role scope, migration/seed approval, backup approval, and append-only audit-role proof plan.
   - Secret provisioning method for required env values, without placing values in chat/docs/logs.
   - APP_ENV, APP_BASE_URL, BOT_ADAPTER_MODE, and whether Axioma, Stripe, LMS object/scanner, Tortila, or Legacy live paths are in scope.
   - If Tortila non-mock is in scope: canonical source landing, explicit journal URL, read-token provisioning, firewall/private-network proof, and authorized positive/negative probes.
   - Post-deploy evidence plan: routes to smoke, browser/admin checks, firewall/proxy checks, worker freshness, monitoring/burn-in duration, and artifact redaction/scanning.
5. No background agents were spawned by this auditor in this interface; none are left running.

## Risks
1. Reusing old Phase 3.64-3.68 canary facts without fresh server confirmation could deploy to a stale path, replace the wrong service, or rely on a missing rollback target.
2. Treating green Phase 4.61 CI as production deployment proof would skip target DB, secret, firewall, proxy, monitoring, and smoke gates.
3. Starting with raw target secrets in chat/docs/logs would violate the repository secret boundary and poison durable evidence.
4. Running managed local acceptance scripts against preview/production databases would turn safe harnesses into live mutation paths.
5. Enabling real bot adapters or live controls during deploy would widen the phase beyond canary deployment and violate existing bot-control safety gates.

## Verification/tests
RUN in this read-only auditor:
1. `git status --short --branch` - PASS; before this handoff write, branch was `codex/phase-462-production-source-discovery` with no reported working-tree changes.
2. `git rev-parse --abbrev-ref HEAD` and `git rev-parse HEAD` - PASS; observed branch `codex/phase-462-production-source-discovery` at `1ea1323b78183d51b66e9b71d67d2c2aa8ae8291`, matching local `main` before this handoff.
3. `git log --oneline -5` - PASS; latest commit is merge commit `1ea1323`.
4. `rg --files docs scripts .github` and deploy/canary artifact search - PASS; inspected docs/scripts/config inventory without live access.
5. Line-numbered `Get-Content` inspections of the files listed above - PASS; `.env.example` values were redacted during inspection.
6. `rg` searches over docs/scripts/config for deployment, target, canary, server, runbook, rollback, monitoring, and secret-boundary terms - PASS.
7. Post-write `git status --short --branch` - PASS; only this new handoff file is untracked.
8. Direct ASCII check for this handoff - PASS.

NOT RUN by design:
1. No npm tests, build, lint, secret scan, Playwright, or governance gates; scope was target/runbook discovery, not code verification.
2. No GitHub mutation, merge, push, PR, or workflow dispatch.
3. No SSH, scp, rsync, systemd, tmux, process control, deploy command, production DB command, live-host curl, provider probe, exchange probe, or bot control.
4. No raw `.env`, production DSN, secret, token, bearer header, cookie, exchange key, provider payload, or production row output.

## Next actions
1. Operator supplies the missing target packet listed in Decisions, with actual secrets provisioned out-of-band and never pasted into docs/chat/logs.
2. Start a new explicit production/canary deploy phase after target approval. If it is broad/major, launch the required read-only agents before any edit or server mutation.
3. Before deploy mutation, record exact release SHA, target, rollback plan, DB backup/migration/seed plan, secret provisioning method, allowed service boundaries, smoke routes, monitoring window, and forbidden actions.
4. Run local exact-tree gates and/or GitHub CI appropriate to the chosen release SHA before server mutation.
5. Only after approval and gates: execute the deploy runbook with redacted evidence, then write an aggregate handoff listing exact gates RUN and NOT RUN.
