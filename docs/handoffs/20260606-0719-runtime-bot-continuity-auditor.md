# runtime-bot-continuity-auditor handoff
## Scope
Read-only Phase 4.72 `ecosystem-bot-integration-auditor` pass focused on live bot continuity, safe burn-in, and proof that Tortila/Turtle and Legacy stay alive while runtime deploy/auth/firewall work is prepared. The audit inspected required WTC governance/status/contract docs, prior Phase 4.66/4.68/4.71 continuity evidence, and read-only live snapshots on `<wtc-canary-host>`. No live server/runtime mutation was performed: no edits, no restarts, no tmux interaction that alters state, no docker changes, no exchange/API key probes, no live bot start/stop/apply-config, and no raw host/IP or secrets are recorded here.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md`
- `docs/handoffs/20260606-0641-runtime-deploy-auth-firewall-prep-auditor.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md`
- `docs/handoffs/20260606-0104-phase-466-server-canary-update.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- Read-only SSH snapshots from `<wtc-canary-host>` using `systemctl show`, filtered `journalctl`, read-only `tmux list-*`, listener metadata, Docker container metadata, and filtered worker logs.

## Files changed
None - read-only audit

## Findings
1. Severity: P0. Evidence: live read-only snapshots at `2026-06-06T00:17:42Z` and `2026-06-06T00:18:47Z` showed unchanged systemd bot PIDs and restart counters: `journal-server.service` PID `256388`, `ExecMainStartTimestamp=Thu 2026-06-04 06:28:13 UTC`, `NRestarts=0`; `turtle-bot.service` PID `256398`, `ExecMainStartTimestamp=Thu 2026-06-04 06:28:13 UTC`, `NRestarts=0`; `turtle-journal.service` PID `256372`, `ExecMainStartTimestamp=Thu 2026-06-04 06:28:12 UTC`, `NRestarts=0`; all three were `active/running`. This matches the Phase 4.66 bot PID baseline for those three units (`docs/handoffs/20260606-0104-phase-466-server-canary-update.md:36`) and Phase 4.68's unchanged-PID burn-in claim (`docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:37`, `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:69`). Recommendation: use these PID/start-time values as the pre-runtime-auth/firewall baseline and stop the phase on any unapproved `turtle-bot.service` PID/start-time/`NRestarts` change. Target part: Tortila/Turtle runtime continuity.
2. Severity: P0. Evidence: filtered worker logs from `2026-06-06T00:11:18Z` through `2026-06-06T00:18:18Z` repeated each minute: `[worker:tortila-snapshot] ok (mode=read-only, sourceAdapter=tortila)`, `[worker:legacy-snapshot] ok (sourceAdapter=legacy-db, accounts=2, settings=13, positions=2)`, and `[worker:db] status ok, bot_continuity ok, tortila ok, legacy ok`. This is the same continuity pattern previously accepted after deploy (`docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md:17`, `docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md:34`) and in the Phase 4.68 burn-in (`docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:69`). Recommendation: treat worker `bot_continuity ok`, `tortila ok`, `legacy ok`, plus both snapshot lines as the safest non-mutating burn-in monitor; require consecutive failures or missing lines to stop/rollback runtime deploy/auth/firewall work. Target part: WTC worker continuity.
3. Severity: High. Evidence: Legacy is alive but weaker to supervise than systemd units: live read-only tmux metadata showed `session=bot`, `pane_pid=3916524`, `command=python3`, and the application listener on port `:8000` was owned by PID `3916524`. Prior continuity audit already called out that Legacy is tmux-managed and has no systemd `NRestarts` evidence (`docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md:16`, `docs/handoffs/20260606-0356-post-deploy-bot-continuity-auditor.md:26`). Recommendation: detect unexpected Legacy changes by checking tmux session presence, pane PID `3916524`, the `python3` command, the port `:8000` listener PID, and worker `legacy-snapshot ok`; any disappearance or PID change should be treated as a break-glass event, not as permission to use tmux control. Target part: Legacy runtime continuity.
4. Severity: High. Evidence: runtime deploy/auth/firewall is still not cleared by Phase 4.71; the aggregate says server runtime deploy, journal restart, WTC worker restart/recreate, production token provisioning, firewall/private-network probes, external endpoint probes, canary switch, and runtime burn-in were NOT RUN (`docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md:67`) and next actions require baselining PIDs, worker continuity, runtime path, firewall rules, and rollback path before mutation (`docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md:72`, `docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md:73`). Live read-only state showed `wtc-bot-api-firewall.service` `active/exited` with `NRestarts=0`, but that is only service-state evidence, not firewall acceptance. Recommendation: run explicit redacted authorized/negative network probes in the runtime phase; do not claim firewall proof from unit state alone. Target part: Tortila production auth/firewall gate.
5. Severity: High. Evidence: WTC control boundaries still forbid using WTC or this phase as a live bot control path: `systemctl start/stop/restart`, `tmux send-keys`, process kills, env writes, exchange calls, exchange-key reads/logging, and bot DB resets are prohibited (`docs/BOT_CONTROL_SAFETY_MODEL.md:36`, `docs/BOT_CONTROL_SAFETY_MODEL.md:37`, `docs/BOT_CONTROL_SAFETY_MODEL.md:38`, `docs/BOT_CONTROL_SAFETY_MODEL.md:39`, `docs/BOT_CONTROL_SAFETY_MODEL.md:40`, `docs/BOT_CONTROL_SAFETY_MODEL.md:41`, `docs/BOT_CONTROL_SAFETY_MODEL.md:42`); the summary table keeps start/stop/config writes at "No" until audited (`docs/BOT_CONTROL_SAFETY_MODEL.md:262`, `docs/BOT_CONTROL_SAFETY_MODEL.md:263`, `docs/BOT_CONTROL_SAFETY_MODEL.md:264`, `docs/BOT_CONTROL_SAFETY_MODEL.md:265`, `docs/BOT_CONTROL_SAFETY_MODEL.md:266`, `docs/BOT_CONTROL_SAFETY_MODEL.md:267`). Phase 4.71 specifically says restart only the journal read service if required and do not restart `turtle-bot.service` (`docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md:75`, `docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md:76`, `docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md:78`). Recommendation: allow only WTC canary/worker replacement in scoped WTC deploys, and only an explicitly approved journal-read-service restart if canonical journal auth deployment requires it; `turtle-bot.service`, Legacy tmux, exchange pings, API key probes, and config apply remain forbidden. Target part: restart and live-control safety boundary.
6. Severity: Medium. Evidence: WTC canary and worker containers were stable during the audit: `wtc-ecosystem-canary` PID `416991`, started `2026-06-05T20:41:09.326171843Z`, `restartCount=0`, `status=running`; `wtc-ecosystem-worker` PID `417056`, started `2026-06-05T20:41:09.497317276Z`, `restartCount=0`, `status=running`. Phase 4.68 states the current canary release is `3aff2738815562c18f5623e9686c4c2f4ba2ef3a` and is mounted into those two containers (`docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md:35`, `docs/NEXT_ACTIONS.md:6`, `docs/NEXT_ACTIONS.md:128`). Recommendation: if runtime deploy work touches WTC containers, compare container start times and restart counts separately from live bot service PIDs; WTC container replacement is not evidence of a bot restart, but it must be followed by worker continuity proof. Target part: WTC canary/worker monitoring.

## Decisions
- Treated this pass as a read-only continuity audit, not a deploy or runtime mutation phase.
- Redacted the live host as `<wtc-canary-host>` and did not read or print `.env`, raw environment, database URLs, exchange keys, or journal tokens.
- Used current live PIDs/start times/`NRestarts` as the Phase 4.72 baseline because they still match the documented Phase 4.66/4.68 live-bot continuity evidence.
- Treated `wtc-bot-api-firewall.service active/exited` only as a read-only service-state snapshot, not as firewall proof.
- Chose worker continuity logs as the primary non-mutating safety signal because they prove both Tortila and Legacy read paths without touching exchange/control endpoints.

## Risks
- Legacy has no systemd `NRestarts`; tmux/pane/listener PID checks are necessary but weaker than systemd supervision.
- A listener on `:8080` or `:8000` is not firewall acceptance. Positive and negative network probes still have to run without printing secrets.
- The 65-second live stability pass is a spot check, not long burn-in or alerting proof.
- `journal-server.service` has `Restart=always`; a future failure could auto-recover without operator action, so monitors must compare start timestamps, not only `ActiveState`.
- Worker continuity proves WTC read-path health, not live-control readiness, exchange safety, or Legacy closed-trade realized analytics.

## Verification/tests
RUN:
1. Local docs/protocol inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, Phase 4.71 aggregate, bot safety model, Tortila contract, and Legacy contract.
2. Prior continuity evidence inspection: Phase 4.66 server canary update, Phase 4.68 canary deploy, and Phase 4.68 bot-continuity auditor handoffs.
3. `git status --short --branch` before handoff write: `## main...origin/main`.
4. Read-only SSH snapshot at `2026-06-06T00:17:12Z`: `systemctl show` for bot/firewall units, read-only `tmux list-sessions` and `tmux list-panes`, listener metadata for `:8000`/`:8080`, Docker metadata, and filtered worker logs.
5. Filtered systemd restart/failure journal query for the last two hours: no `Started`, `Stopped`, `Starting`, `Main process exited`, `Failed`, `failed`, or `restart` events returned for `journal-server.service`, `turtle-bot.service`, or `turtle-journal.service`.
6. Two-snapshot read-only monitor from `2026-06-06T00:17:42Z` to `2026-06-06T00:18:47Z`: systemd bot PIDs/start times/`NRestarts`, Legacy tmux pane PID, WTC container PIDs, start times, and restart counts stayed unchanged.
7. Worker filtered logs with timestamps from `2026-06-06T00:11:18Z` to `2026-06-06T00:18:18Z`: repeated `tortila-snapshot ok`, `legacy-snapshot ok`, `status ok`, `bot_continuity ok`, `tortila ok`, and `legacy ok`.

NOT RUN:
1. Server runtime deploy, canonical source installation on live runtime, production token provisioning, or journal auth rollout.
2. `systemctl start|stop|restart`, `service`, process kill, tmux send-keys, docker stop/remove/recreate, DB migrations/seeds, file edits, env reads/writes, or firewall rule changes on `<wtc-canary-host>`.
3. Exchange/API key probes, exchange pings, `/api/marks`, `/api/overview`, live bot start/stop/apply-config/test-connection.
4. Long burn-in, external firewall/private-network positive/negative probes, branded production rollout, or full alerting verification.
5. Legacy closed-trade realized analytics/import proof.

## Next actions
1. Before any runtime deploy/auth/firewall mutation, capture the same baseline again: `journal-server.service`, `turtle-bot.service`, `turtle-journal.service` `ActiveState`, `SubState`, `MainPID`, `ExecMainStartTimestamp`, `NRestarts`; Legacy tmux pane/listener PID; WTC canary/worker container PID/start/restartCount; worker continuity logs.
2. Detect unexpected bot PID changes by comparing against this baseline: `turtle-bot.service` PID `256398`, start `2026-06-04 06:28:13 UTC`, `NRestarts=0`; `turtle-journal.service` PID `256372`, start `2026-06-04 06:28:12 UTC`, `NRestarts=0`; `journal-server.service` PID `256388`, start `2026-06-04 06:28:13 UTC`, `NRestarts=0`; Legacy tmux pane/listener PID `3916524`. Any unapproved change is a stop condition.
3. During runtime work, run a one-minute monitor loop after every step: systemd PID/start/`NRestarts` check, filtered restart/failure journal query, WTC worker logs requiring `bot_continuity ok`, `tortila ok`, `legacy ok`, `tortila-snapshot ok`, `legacy-snapshot ok`, and WTC container restartCount check.
4. Restart allowed: WTC canary/worker containers only inside an approved WTC deploy; `turtle-journal.service` only if canonical journal auth deployment explicitly requires it, with operator approval, rollback path, no secret printout, and before/after PID evidence. Restart forbidden: `turtle-bot.service`, Legacy tmux/runtime, exchange pings, API-key probes, and config apply/start/stop controls.
5. If auth/firewall probes fail, worker continuity degrades, a bot PID changes unexpectedly, a secret appears in output/logs, or `/api/marks`/exchange paths are touched, stop immediately and roll back WTC runtime changes rather than restarting bots.
6. Keep Legacy realized PnL/import work blocked until a durable Legacy closed-trade source packet exists; active slots/orders and `FILLED` handling are not enough for honest realized analytics.
