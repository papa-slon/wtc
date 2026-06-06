# long-burnin-continuity-auditor handoff
## Scope
Phase 4.75 read-only runtime long-burn-in and two-bot continuity audit for the already-deployed WTC canary app/worker release `20260606-0213-abe6784-phase474-main`.

Requested live scope was a bounded 10-15 minute monitor of WTC health, WTC canary/worker container running state, restart counts and mounted release, worker two-bot continuity tuple, selected `systemctl show` fields for `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service`, and Legacy tmux presence.

The live monitor was not run because this session did not have a usable operator-approved SSH alias or target coordinate that could be invoked without guessing or retaining raw host/IP material. No raw host/IP, env value, DSN, token, secret, raw DB row, or full raw log was printed or retained. No server, container, systemd, tmux, DB, firewall, env, bot, exchange, or live-control mutation was attempted.

This is a single foreground read-only auditor handoff. No background agents were launched and no N-agent audit claim is made.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md`
- `docs/handoffs/20260606-0909-runtime-continuity-auditor.md`
- `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md`
- `docs/handoffs/20260606-0905-canary-security-perimeter-auditor.md`
- Safe local target-discovery observations only: `~/.ssh/config` alias presence and sanitized PowerShell history shape, without retaining raw target material.

## Files changed
- `docs/handoffs/20260606-1000-long-burnin-continuity-auditor.md` - this handoff only.

## Findings
1. Severity: P0. The requested 10-15 minute live long-burn-in is BLOCKED in this session because no usable operator-approved SSH target is available without exposing or retaining raw target coordinates. Evidence: `docs/handoffs/20260606-0905-canary-security-perimeter-auditor.md:63` records that no SSH alias was available in the workspace for that auditor; `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md:86` records SSH probe blocked/auth unavailable; `docs/handoffs/20260606-0909-runtime-continuity-auditor.md:8` and `docs/handoffs/20260606-0909-runtime-continuity-auditor.md:141` prove a known target existed for that prior lane, but the coordinate itself is not present in this safe context. Recommendation: rerun this auditor only after the operator supplies a safe SSH alias or an approved target channel that can be invoked without printing raw host/IP. Target part: live monitor entry gate.
2. Severity: P0. The latest documented live baseline is Phase 4.74, not a fresh Phase 4.75 observation. Evidence: `docs/STATUS.md:3`-`15` records the `20260606-0213-abe6784-phase474-main` release, WTC canary/worker recreation, `restartCount=0`, worker `bot_continuity ok`, `tortila ok`, `legacy ok`, three bot services active/running with `NRestarts=0`, and Legacy tmux present; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:59`-`62` records the same five-cycle burn-in result. Recommendation: treat Phase 4.74 as prior baseline only; do not claim current long-burn-in green until live checks run in this session. Target part: continuity truth.
3. Severity: P0. Any future long-burn-in must remain WTC/read-only and must not repair WTC symptoms by restarting bot runtimes. Evidence: `AGENTS.md:76`-`77` forbids live server mutation during discovery and plaintext exchange secrets; `docs/SESSION_PROTOCOL.md:83`-`84` says never stop/restart/modify live servers/bots/secrets during read-only discovery; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:80`-`84` records that WTC canary/worker were recreated but Legacy tmux, Tortila trading bot, journal services, nginx, PostgreSQL, Docker daemon, firewall, env files, exchange-facing processes, and live-control routes were not mutated. Recommendation: future burn-in commands must be limited to read-only `systemctl show`, `docker inspect`, non-secret HTTP status checks, filtered worker continuity counts, and read-only tmux list metadata. Target part: safety boundary.
4. Severity: P1. Long production burn-in and alerting remain separate from the already-cleared Phase 4.74 canary deploy. Evidence: `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:84`-`86` says long production burn-in remains separate; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:132`-`135` lists long burn-in/alerting as NOT RUN; `docs/STATUS.md:20` keeps long production burn-in/alerting uncleared. Recommendation: keep production-readiness claims blocked until this monitor, alerting, branded-domain, and provider-console perimeter gates are actually observed. Target part: production readiness.
5. Severity: P2. The local worktree was already dirty before this handoff write, so this auditor must not attribute those files to Phase 4.75. Evidence: local `git status --short --branch` before writing this handoff showed branch `codex/phase-475-production-readiness` with pre-existing changes in `docs/DEPLOYMENT.md` and `tests/integration/deployment-release-build-static.test.ts`. Recommendation: preserve those changes and keep this auditor's write scope to this single handoff. Target part: workspace hygiene.

## Decisions
1. Did not run SSH, public curl, Docker, systemd, journalctl, tmux, DB, env, firewall, exchange, or bot-control commands against the live server.
2. Did not attempt to reconstruct or print a raw host/IP from history, env, secrets, or docs.
3. Did not launch background agents because this is one requested auditor lane, not a broad phase or N-agent audit.
4. The requested long-burn-in gate is NOT RUN/BLOCKED, not green.
5. Only this handoff file is written by this auditor.

## Risks
1. Server state may have drifted since the Phase 4.74 five-cycle burn-in.
2. WTC canary/worker could have restarted or mounted a different release after the last documented observation.
3. Legacy tmux has no systemd restart counter, so future proof must combine tmux presence, listener/process metadata, and worker `legacy ok`.
4. Without fresh SSH or public canary target access, WTC health, worker continuity, bot service fields, and Legacy tmux presence are unverified for Phase 4.75.
5. The pre-existing local dirty worktree could affect later docs/test phases if not separated from this auditor's single handoff.

## Verification/tests
RUN:
1. Memory/repo context pass for WTC canary deploy and continuity history.
2. Protocol inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed, current status/actions/deployment docs, and Phase 4.74 handoffs.
3. Current documented release baseline inspection: Phase 4.74 records show `20260606-0213-abe6784-phase474-main` mounted into WTC canary/worker and five short cycles green.
4. Safe target-discovery check: `~/.ssh/config` had no safe Host alias; sanitized PowerShell history showed only redacted non-alias target shapes, not a current invocable WTC-approved alias.
5. Local worktree check before handoff write: branch `codex/phase-475-production-readiness`; pre-existing dirty files observed as listed in Findings.
6. `git diff --check -- docs/handoffs/20260606-1000-long-burnin-continuity-auditor.md` - PASS.
7. Raw IPv4 scan of this handoff - PASS; no raw IPv4 candidates found.

NOT RUN:
1. 10-15 minute live WTC long-burn-in - BLOCKED because no usable operator-approved SSH alias/target is available in this context without raw coordinate exposure.
2. WTC health live check - NOT RUN for the same access reason.
3. Docker container running/restartCount/mount inspection for `wtc-ecosystem-canary` and `wtc-ecosystem-worker` - NOT RUN for the same access reason.
4. Worker continuity tuple inspection (`bot_continuity`, `tortila`, `legacy`, and snapshot lines) - NOT RUN for the same access reason.
5. Selected systemd fields for `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service` - NOT RUN for the same access reason.
6. Legacy tmux presence check - NOT RUN for the same access reason.
7. Public canary smoke - NOT RUN because the live canary URL is redacted in docs and no operator-approved public target was provided in this session.
8. Local npm tests, lint, build, Playwright, governance, and secret scan - NOT RUN; this auditor made no code changes and the live-monitor gate was blocked before runtime checks.
9. Any restart, recreate, start/stop, apply-config, test-connection, exchange ping, DB mutation, env read/write, raw log read, `/api/marks`, or `/api/overview` - NOT RUN because forbidden/out of scope.

## Next actions
1. Operator supplies a safe SSH alias or approved target channel that can be used without printing raw host/IP, env, DSN, token, or secret values.
2. Rerun this auditor as a new session and execute a bounded 10-15 minute read-only loop over WTC health, WTC canary/worker mount/restart counts, worker continuity tuple, selected bot systemd fields, and Legacy tmux presence.
3. Stop immediately if WTC health fails, worker continuity misses consecutive cycles, WTC containers are not mounted on `20260606-0213-abe6784-phase474-main`, any bot `NRestarts` increments, Legacy tmux disappears, a live-control path is touched, or evidence would require retaining raw host/IP/secrets/full logs.
