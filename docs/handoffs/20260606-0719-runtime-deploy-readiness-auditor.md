# runtime-deploy-readiness-auditor handoff
## Scope
Read-only Phase 4.72 `ecosystem-devops-implementer` audit for runtime deploy/auth/firewall readiness for the Tortila canonical source. Inspected local WTC docs/code and performed read-only SSH checks against `<wtc-canary-host>`. No live server/runtime mutation was performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md`
- `docs/handoffs/20260606-0641-runtime-deploy-auth-firewall-prep-auditor.md`
- `docs/handoffs/20260606-0440-tortila-source-perimeter-auditor.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `docs/DEPLOYMENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `package.json`
- `.env.example`
- `apps/worker/src/index.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/config/src/env.ts`
- Canonical Tortila source metadata under `C:\Users\maxib\GTE BOT\tortila_canonical_source`
- Read-only server metadata: systemd selected fields, Docker metadata without env values, release paths, listener/firewall summary, filtered worker logs, health status codes, and token-middleware grep only.

## Files changed
None - read-only audit

## Findings
1. Severity: P0. The running Tortila journal source is still not auth-ready, so production auth cannot be claimed green. Evidence: `docs/CONTRACTS/tortila-adapter.md` requires `JOURNAL_READ_TOKEN`, WTC bearer use, and firewall proof before production; current read-only SSH recheck found `/home/ubuntu/apps/turtle_bingx` still used by `turtle-journal.service` and token-middleware grep returned no matches. Recommendation: deploy canonical Tortila source commit `f53a774c3bc4c14653906bd2f778a515c565cf12` to the journal runtime before any WTC production-auth green claim. Target part: Tortila journal runtime auth.
2. Severity: P0. WTC canary release and local/current `main` release are no longer the same commit. Evidence: running canary remains release `20260605-203900-3aff273-phase467-picker`; current local/origin main is `3c4c0c83ccecd7352ec81945a77baf24a51d7802`. Recommendation: runtime deploy phase must name the exact WTC SHA to deploy, or explicitly leave WTC web/worker on `3aff273`. Target part: WTC release/versioning.
3. Severity: P0. Service boundary is clear: only WTC containers and, if required, the journal read service are eligible for the next phase; `turtle-bot.service` is not. Evidence: current read-only SSH showed `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service` active/running with `NRestarts=0`. Recommendation: stop immediately if `turtle-bot.service` PID/start time changes during the runtime phase. Target part: live bot continuity.
4. Severity: High. Firewall posture is useful but still not the production proof. Evidence: UFW inactive, process listeners on bot ports, and iptables DROP rules for non-loopback access to relevant bot ports. Recommendation: after token middleware is deployed, run redacted positive/negative probes from allowed and non-allowed origins; do not treat iptables listing alone as green. Target part: firewall/private-network proof.
5. Severity: High. WTC worker appears prepared for tokenized read-only mode, but current green worker logs are not auth proof. Evidence: WTC worker passes `JOURNAL_READ_TOKEN` into the Tortila adapter and env-name-only Docker checks showed relevant env keys exist, while current server journal still accepts unauthenticated requests. Recommendation: after journal auth deploy, prove missing token `401`, wrong token `401`, correct token success, and unchanged worker `tortila ok`/`bot_continuity ok` without printing token values. Target part: WTC worker auth path.
6. Severity: High. Secret/env rollout method must avoid raw secret handling. Evidence: deployment docs ban copying or printing server secrets; prior deploy handoffs reused canary env files without printing values. Recommendation: use stable server-side env file/drop-in mechanics, no `cat .env`, raw `env`, or secret echo. Target part: secret provisioning.
7. Severity: Medium. Rollback exists for WTC web/worker, but Tortila journal source rollback is not versioned yet. Evidence: WTC release/rollback dirs exist; `turtle-journal.service` still runs from mutable `/home/ubuntu/apps/turtle_bingx`. Recommendation: create a versioned Tortila source release and explicit journal-service rollback target before restarting any journal service. Target part: rollback readiness.
8. Severity: Medium. Exact WTC container recreation shape is discoverable, but no Docker healthcheck exists. Evidence: Docker inspect showed canary/worker commands and zero restarts. Recommendation: use HTTP health, protected-route redirects, worker logs, and service PID continuity as deploy health gates. Target part: runtime observability.

## Decisions
- Do not mutate live runtime in this auditor pass.
- Treat Phase 4.71 strict managed proof as local pre-deploy evidence only, not server runtime parity.
- Leave WTC web/worker on `3aff273` unless a separate WTC release switch is explicitly needed; this phase can clear journal runtime auth without recreating WTC containers because the current worker already has token/url/read-only env.
- Runtime phase must deploy/verify canonical Tortila journal auth before claiming production auth/firewall readiness.
- Never restart `turtle-bot.service` for this phase; only `turtle-journal.service` may be restarted if the approved journal-source switch requires it.

## Risks
- Current WTC worker can send a token, but current Tortila runtime does not enforce one, creating a false sense of auth readiness.
- Journal source is not release-versioned on the server; an in-place patch would make rollback brittle.
- Process-level listener on the Tortila journal is broad; firewall proof must be observed after the auth runtime is deployed.
- If WTC release switch includes DB migrations, rollback becomes DB restore plus release rollback, not only container recreation.

## Verification/tests
RUN:
1. Local branch/status check - PASS; branch `codex/phase-472-tortila-runtime-auth-firewall`.
2. Local WTC release metadata check - PASS; local/origin `main` are `3c4c0c8`.
3. Canonical Tortila source checkout check - PASS; clean `main...origin/main`, commit `f53a774c3bc4c14653906bd2f778a515c565cf12`.
4. Read-only SSH systemd baseline - PASS; selected service state/PID/restart fields only.
5. Read-only SSH Docker metadata - PASS; WTC canary/worker mounted to `20260605-203900-3aff273-phase467-picker`, zero restarts.
6. Read-only SSH runtime source grep - PASS; no token middleware matches found in current server runtime source.
7. Read-only SSH local health status codes - PASS; WTC local `/api/health` returned `200`, Tortila journal `/api/health` returned `200`.
8. Read-only SSH listener/firewall summary - PASS/PARTIAL; UFW inactive, iptables DROP rules observed for bot ports.
9. Filtered worker logs - PASS; recent `bot_continuity ok`, `tortila ok`, `legacy ok`, and snapshot lines only.
10. Env-name-only container check - PASS; printed variable names only, no values.

NOT RUN:
1. No service restart/start/stop, no Docker create/remove/restart, no firewall change, no nginx/systemd edit.
2. No `.env` read/print/write/copy and no secret value printed.
3. No DB migration, seed, dump, restore, DDL, DML, or row payload query.
4. No `/api/marks`, `/api/overview`, exchange ping, live bot control, config apply, start, stop, or test-connection.
5. No long burn-in; only point-in-time read-only checks.

## Next actions
1. Before any mutation, rerun baselines for systemd services, WTC containers, worker continuity, listener/firewall posture, and current journal auth matrix.
2. Stage canonical Tortila source in a versioned release path and verify it before any service switch.
3. Use a secret-safe journal token plan that prints no values.
4. Switch only `turtle-journal.service` to the staged source through a rollbackable drop-in; never restart `turtle-bot.service`.
5. Post-switch proof must include missing/wrong `401`, correct-token `2xx` for `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`, worker `bot_continuity ok`, `tortila ok`, `legacy ok`, and unchanged `turtle-bot.service` PID/start/`NRestarts`.
6. Stop on any unexpected bot PID/start change, failed auth matrix, public access regression, worker degradation, token leak, `/api/marks`/`/api/overview` use, or unexpected DB migration requirement.
