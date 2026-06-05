# bot-live-health-auditor handoff
## Scope
Read-only live health audit after the operator reminded that both bots must stay alive and positions must not be closed. The audit checked process/service health only. It did not run start, stop, restart, order, position, exchange, config-apply, DB-dump, env-dump, or file-mutation commands.

## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- `docs/DEPLOYMENT.md`

## Files changed
None - read-only audit.

## Findings
1. Severity: High. Tortila/Turtle is alive and no restart is recommended. Evidence: `turtle-bot.service` and `turtle-journal.service` were reported `active/running` with stable PIDs, `NRestarts=0`, and local health endpoint returned `200`. Recommendation: do not restart while this state holds; keep monitoring service state and warning logs. Target part: Tortila runtime continuity.
2. Severity: High. Legacy is alive, but service-manager evidence is weaker because it is tmux-managed. Evidence: the Legacy bot Python process was running under the `bot` tmux session for about seven days and listening on its application port; `/api/health` returned `404`, interpreted as absent route rather than outage. Recommendation: avoid restart unless the process disappears, logs degrade, or WTC worker continuity fails; later migrate Legacy to a first-class supervised unit if operational policy allows. Target part: Legacy runtime continuity.
3. Severity: High. WTC integration worker sees both bots as healthy. Evidence: recent worker logs reported `bot_continuity ok`, `tortila ok`, `legacy ok`, `tortila-snapshot ok`, and `legacy-snapshot ok`; canary health returned `200`. Recommendation: treat worker continuity as the safest non-mutating monitor for now. Target part: WTC bot integration bridge.
4. Severity: Medium. Ports for bot services are bound broadly at process level, but firewall rules were reported for non-loopback drops. Evidence: read-only socket/firewall inspection. Recommendation: keep external reachability and firewall hardening in the deploy/security backlog. Target part: server perimeter.

## Decisions
- Did not restart either bot because both bots were alive and the WTC worker reported continuity ok.
- Did not test exchange keys, hit live-control routes, or inspect raw env/DB secrets.
- Treated Legacy `404` on `/api/health` as an endpoint absence caveat, not outage proof.

## Risks
- Legacy tmux supervision can hide restart policy and exit recovery state compared with systemd.
- This audit is a point-in-time health check, not proof of future liveness.
- No position/order state was queried to avoid live trading side effects and secret exposure.

## Verification/tests
RUN:
1. Read-only local docs inspection - PASS.
2. Read-only server service/process/socket/log/health checks - PASS; both bots alive.
3. WTC worker continuity log check - PASS; both bot snapshots reported ok.

NOT RUN:
1. Bot restart - not needed and would add unnecessary live-runtime risk.
2. Order/position close/cancel or live-control endpoints - forbidden for this audit.
3. Raw env, DB dump, docker inspect, exchange calls, external reachability probe - skipped to avoid secrets or side effects.

## Next actions
1. Continue PR #8 CI and merge/deploy flow.
2. Keep live bot restart as a break-glass action only if a later monitor shows down/degraded state.
3. Plan a later supervised-service hardening phase for Legacy if operations wants restart-policy parity with Tortila.
