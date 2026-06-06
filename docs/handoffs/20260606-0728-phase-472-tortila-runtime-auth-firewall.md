# Phase 4.72 Tortila runtime auth/firewall handoff
## Scope
Deployed the Phase 4.70 canonical Tortila source packet to the live Tortila journal runtime as a versioned journal-only release, provisioned the existing WTC worker journal read token into a separate journal service env file without printing the value, switched only `turtle-journal.service` through a rollbackable systemd drop-in, and verified live auth/firewall/worker continuity. This phase did not recreate WTC containers, did not deploy WTC web/worker beyond the existing `3aff273` canary release, did not restart `turtle-bot.service`, did not touch Legacy tmux, did not call exchange endpoints, and did not run live-control actions.

Agent handoffs:
- [docs/handoffs/20260606-0719-runtime-deploy-readiness-auditor.md](20260606-0719-runtime-deploy-readiness-auditor.md)
- [docs/handoffs/20260606-0716-runtime-security-firewall-auditor.md](20260606-0716-runtime-security-firewall-auditor.md)
- [docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md](20260606-0719-runtime-bot-continuity-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md`
- `C:\Users\maxib\GTE BOT\tortila_canonical_source`
- Server systemd metadata for `journal-server.service`, `turtle-bot.service`, `turtle-journal.service`, and `wtc-bot-api-firewall.service`
- Server Docker metadata/logs for `wtc-ecosystem-worker` and `wtc-ecosystem-canary`
- Server listener/firewall status and redacted journal auth probes

## Files changed
- `docs/handoffs/20260606-0719-runtime-deploy-readiness-auditor.md`
- `docs/handoffs/20260606-0716-runtime-security-firewall-auditor.md`
- `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md`
- `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`

## Findings
1. Severity: P0. Tortila journal runtime auth is now deployed and enforced. Evidence: versioned release `/home/ubuntu/apps/turtle_bingx_releases/20260606-0728-f53a774-journal-auth` is the `turtle-journal.service` `WorkingDirectory`; the drop-in is `/etc/systemd/system/turtle-journal.service.d/wtc-canonical-journal-auth.conf`; `JOURNAL_READ_TOKEN` presence was verified as a boolean only; `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list` returned missing `401`, wrong `401`, bearer `200`, and header-token summary `200`; `/api/marks` missing-token returned `401`. Recommendation: treat the runtime journal auth gate as RUN/PASS for this canary, and keep `/api/marks` out of WTC ingestion. Target part: Tortila production journal auth.
2. Severity: P0. Canonical source was staged and verified before switch. Evidence: WTC `npm run verify:tortila:canonical-source` passed for local canonical source commit `f53a774c3bc4c14653906bd2f778a515c565cf12`; server staged source imported from the release path; server `pytest` passed `100%`; server `ruff` reported `All checks passed`. Recommendation: keep this source release as the rollbackable journal runtime authority. Target part: canonical source runtime deploy.
3. Severity: P0. Live trading bot continuity survived the journal-only switch. Evidence: `turtle-bot.service` remained PID `256398`, `active/running`, `NRestarts=0`; `journal-server.service` remained PID `256388`, `active/running`, `NRestarts=0`; only `turtle-journal.service` changed PID to `442227` from the approved restart and stayed `active/running`, `NRestarts=0`. Recommendation: do not restart `turtle-bot.service`; continue monitoring PID/start/restart state. Target part: no-position-impact runtime safety.
4. Severity: P0. WTC worker stayed healthy through the auth switch. Evidence: worker logs after the switch repeatedly showed `tortila-snapshot ok (mode=read-only, sourceAdapter=tortila)`, `legacy-snapshot ok`, and `bot_continuity ok, tortila ok, legacy ok`; WTC worker container stayed running with restart count `0`. Recommendation: keep WTC worker on current env and release unless a separate WTC release phase requires changes. Target part: authenticated read-only ingestion.
5. Severity: High. Firewall public-negative proof is green from the workstation vantage, but provider-console/private-network proof is still not a full branded-production gate. Evidence: external TCP checks for ports `8000`, `8080`, `8123`, and `8300` returned `connected=False`; server still has `wtc-bot-api-firewall.service active/exited` and non-loopback DROP rules for bot ports. Recommendation: treat this as canary firewall proof; do not call it cloud security-group audit or full branded production. Target part: network perimeter proof.
6. Severity: High. Secret handling remained redacted. Evidence: token value was never printed; journal env file was created server-side from existing WTC worker env; marker counts over recent worker/journal/bot logs were `0` for token/authorization/password/secret patterns; `npm run secret:scan` is still required before PR merge. Recommendation: retain only status matrices and counts, not raw env/log dumps. Target part: no-secret-leak evidence.
7. Severity: P0. Legacy realized analytics/import remains blocked. Evidence: no new Legacy closed-trade source packet/API/table was provided or discovered. Recommendation: keep Legacy realized PnL/win-rate/import blocked until source proof exists. Target part: Legacy analytics.

## Decisions
- Left WTC web/worker containers on existing canary release `20260605-203900-3aff273-phase467-picker`; no WTC container recreation was needed because the worker already had `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL`, and `JOURNAL_READ_TOKEN` env.
- Used a versioned Tortila source release and systemd drop-in instead of overlaying the mutable live bot directory.
- Restarted only `turtle-journal.service` to load the canonical source and token env.
- Did not restart `turtle-bot.service`, Legacy tmux, nginx, PostgreSQL, Docker daemon, or WTC containers.
- Did not run `/api/overview`, WTC `/api/marks`, exchange pings, live bot control, config apply, or test-connection actions.

## Risks
- The journal uses a drop-in plus external release path; future operators must preserve or intentionally roll back that drop-in.
- Public TCP negative probes prove this workstation vantage, not an independent cloud provider console audit.
- This phase clears Tortila journal runtime auth/firewall canary proof, not full branded-domain production, live controls, or Legacy realized analytics.

## Verification/tests
RUN:
1. Read-only agents before edits/mutation - PASS; three agents launched and closed.
2. WTC canonical source verifier - PASS for commit `f53a774c3bc4c14653906bd2f778a515c565cf12`.
3. Pre-switch baseline - PASS; `turtle-bot.service` PID `256398`, `NRestarts=0`; pre-auth matrix was fail-open as expected (`missing=200`, `wrong=200`).
4. Server staged source import check - PASS; import resolved to `/home/ubuntu/apps/turtle_bingx_releases/20260606-0728-f53a774-journal-auth/src/turtle_bot/journal/app.py`.
5. Server bot pytest - PASS, `100%`.
6. Server bot ruff - PASS, `All checks passed!`.
7. Journal-only switch - PASS; `turtle-journal.service` active/running on staged release with token present as boolean.
8. Auth matrix - PASS: `/api/health`, `/api/summary`, `/api/equity`, `/api/trades/list` missing `401`, wrong `401`, bearer `200`; `/api/summary` header token `200`; `/api/marks` missing `401`.
9. Burn-in monitor - PASS across three cycles; bot services active/running, worker running with restart count `0`, worker `bot_continuity ok`, `tortila ok`, `legacy ok`.
10. Worker log search - PASS; repeated `tortila-snapshot ok` and `legacy-snapshot ok` after switch.
11. Public TCP negative probes - PASS; `8000`, `8080`, `8123`, and `8300` returned `connected=False` from the workstation vantage.
12. Runtime secret-marker counts - PASS; worker/journal/bot counts were `0`.

NOT RUN:
1. WTC web/worker release update to `3c4c0c8` - not needed for this runtime journal auth fix.
2. WTC DB migration/seed/backup - not needed; no WTC runtime code/container switch occurred.
3. Nginx, PostgreSQL, Docker daemon, `journal-server.service`, `turtle-bot.service`, or Legacy tmux restart - skipped by safety boundary.
4. Cloud provider security-group console audit or VPN/private-network proof - not available in this SSH/workstation phase.
5. `/api/overview`, WTC `/api/marks`, exchange pings, live bot control, config apply, start/stop/test-connection - forbidden and not run.
6. Legacy closed-trade source/import proof - still blocked by missing source.

## Next actions
1. Continue monitoring `turtle-bot.service` PID `256398`, `turtle-journal.service` PID `442227`, `journal-server.service` PID `256388`, and WTC worker continuity after PR/CI.
2. Update operator docs and merge Phase 4.72 handoff through PR/CI.
3. If a future WTC web/worker release is required, run a separate deploy phase; current WTC containers remain on `3aff273`.
4. Do not proceed to live bot controls until a separate security and bot-integration audit explicitly approves control adapters.
5. Keep Legacy realized analytics blocked until a durable closed-trade source packet exists.
