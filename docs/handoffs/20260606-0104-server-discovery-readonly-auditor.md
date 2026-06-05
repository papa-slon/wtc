# server-discovery-readonly-auditor handoff
## Scope
Read-only WTC repo inspection to define the server facts the main operator must collect before any deploy/source-completion phase. The agent did not SSH to the server, did not read the key, and made no file edits.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- Latest Phase 4.62 and 4.65 handoffs under `docs/handoffs/`
## Files changed
None - read-only audit.
## Findings
1. Severity P0 - Deploy is blocked on a fresh target packet, not local code. Evidence: `docs/STATUS.md` and `docs/NEXT_ACTIONS.md` require host/domain, release SHA, rollback, DB approval, secrets method, service boundaries, probes, smoke routes, and monitoring. Recommendation: collect those facts from the server before any deploy mutation. Target part: deploy target gate.
2. Severity P0 - Canonical Tortila source is still unproven from local repo evidence alone. Evidence: `docs/CONTRACTS/tortila-adapter.md` requires canonical source plus token middleware and firewall proof. Recommendation: server discovery must identify the runtime source path and source-control state. Target part: Tortila source gate.
3. Severity P0 - Legacy realized analytics/import is blocked until a real closed-trade source exists. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md` says Legacy has no closed-trade history endpoint while WTC destination tables exist. Recommendation: collect schema/artifact proof only, no row dumps. Target part: Legacy closed-trade source gate.
4. Severity P1 - WTC integration proof must remain count/status based. Evidence: `docs/DEPLOYMENT.md` says CI is not deployment proof. Recommendation: collect service state, env key presence, table counts, latest timestamps, and health codes only. Target part: WTC integration.
## Decisions
- Safe next step is read-only server discovery first.
- Do not print or request raw `DATABASE_URL`, tokens, `.env`, cookies, exchange keys, provider rows, or full process environments.
- Do not run bot start/stop/apply-config, systemd restarts, migrations, seeds, deploy commands, `/api/marks`, or `/api/overview` during discovery.
## Risks
1. Server inventory can expose env, command lines, unit files, logs, DB URLs, and tokens if commands are not filtered.
2. Green CI or local proof can be mistaken for production deployment proof.
3. Legacy active orders/slots can be mistaken for honest realized closed-trade history.
## Verification/tests
RUN: local repo status, latest handoff/status/doc inspection, schema/script inspection.
NOT RUN: SSH, server commands, npm gates, GitHub checks, deploy, DB mutation, migrations, seeds, service restarts, live bot/provider probes.
## Next actions
1. Main operator should run only redacted server discovery summaries/counts/statuses.
2. Then open exactly one phase: deploy target, canonical Tortila source, Legacy closed-trade source, or WTC integration verification.
