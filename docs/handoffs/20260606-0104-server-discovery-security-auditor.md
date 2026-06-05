# server-discovery-security-auditor handoff
## Scope
Read-only pre-discovery security/bot-integration audit for the operator-provided SSH target. The agent defined strict boundaries before any server discovery. No SSH, network, DB, bot, deploy, or secret access was performed by the agent.
## Files inspected
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/NEXT_ACTIONS.md`
## Files changed
None - read-only audit.
## Findings
1. Severity P0 - Server target is not authorization to turn WTC into a bot control plane. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md` forbids SSH/systemd/tmux/env mutation/exchange-order paths from the app boundary and blocks live control until all gates pass. Recommendation: use SSH only as an operator deployment/discovery channel, never as a WTC runtime/control design. Target part: bot control and deployment boundary.
2. Severity P0 - Secrets and DBs coexist on the host, so raw discovery output is high risk. Evidence: key reading/logging is forbidden and prior credentialed gates avoided printing values. Recommendation: redact raw IPs, DB URLs, env values, JWTs, cookies, bearer tokens, private keys, exchange keys, API responses, row payloads, and logs before chat/docs/artifacts. Target part: evidence retention.
3. Severity P0 - Live bot control remains intentionally NOT RUN. Evidence: control adapters are hard-disabled, WTC reads snapshots rather than calling bot control endpoints, and live-control/test-connection/start-stop remains NOT RUN. Recommendation: forbid start/stop/restart/apply-config/retest/exchange ping during discovery. Target part: bot runtime.
4. Severity P1 - The supplied target still needs a deploy runbook before mutation. Evidence: production deploy requires target, release, rollback, services, DB approval, secret provisioning, smoke routes, proxy/firewall probes, and monitoring. Recommendation: record a written target packet before deploy/server mutation. Target part: rollout planning.
5. Severity P1 - Legacy analytics/import must not be inferred from live server state. Evidence: Legacy closed-trade source proof is NOT RUN and active orders/slots are explicitly insufficient for realized analytics. Recommendation: inventory source candidates only; no importer/realized-PnL mapping until stable trade IDs, economics, timestamps, replay rules, and raw allowlist are proven. Target part: Legacy source model.
## Decisions
Forbidden commands/actions until separately approved: `systemctl start|stop|restart`, `service`, `tmux send-keys`, `screen`, `kill/pkill`, deploy/rebuild/restart commands, migrations/seeds, DB DDL/DML, `.env` writes, `cat .env`, raw `env/printenv`, full `docker inspect`, raw `journalctl`, exchange API calls, `/api/marks`, bot start/stop/apply-config/test-connection`, and any command that prints credentials.

Allowed read-only classes: identity/time/host metadata; bounded service status; listener inventory; directory/file metadata without contents; git/release metadata; Docker/container names and status without env; PostgreSQL schema/count probes only, no row payloads; redacted health checks to approved local endpoints.
## Risks
1. Accidental evidence leakage through env, command lines, unit files, logs, DB URLs, or tokens.
2. Scope creep from read-only discovery into service restarts or quick production fixes.
## Verification/tests
RUN: local `git status --short --branch`; line-numbered reads/searches of the requested docs.
NOT RUN: SSH, network probes, nginx/systemd checks, bot service checks, production DB commands, npm gates, secret scan, deploy checks, live-control checks.
## Next actions
1. Convert the safety block into the main rollout.
2. Keep server discovery redacted and count/status based.
3. Require a full deploy target packet before deploy/server mutation.
