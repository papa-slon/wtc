# ecosystem-security-auditor handoff
## Scope
Phase 4.72 read-only security audit for Tortila production `JOURNAL_READ_TOKEN`, auth probes, firewall/private-network posture, and no-secret-leak gates on `<wtc-canary-host>`.

Constraints followed: no live server/runtime mutation, no service restart, no Docker change, no firewall change, no env write, no token generation/provisioning, no raw token printing, and no raw host/IP printing in this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260606-0641-phase-471-strict-managed-proof.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/SECURITY_MODEL.md`
- `docs/DEPLOYMENT.md`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/http.ts`
- `apps/worker/src/index.ts`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `C:\Users\maxib\GTE BOT\tortila_canonical_source\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\tortila_canonical_source\tests\test_journal.py`
- Read-only SSH observations on `<wtc-canary-host>`: `systemctl show` service metadata, process-env token presence booleans only, local curl status-code probes, listener classification, iptables port-filter evidence, public TCP negative probes, Docker worker env presence booleans only, and secret-marker log counts only.

## Files changed
None - read-only audit

## Findings
1. Severity: P0. Current live Tortila journal runtime is fail-open for `JOURNAL_READ_TOKEN`. Evidence: `docs/CONTRACTS/tortila-adapter.md:52-56` requires provisioning the token and WTC bearer use before production deployment; `C:\Users\maxib\GTE BOT\tortila_canonical_source\src\turtle_bot\journal\app.py:111-116` shows the canonical middleware permits all requests when the env token is absent; read-only SSH observed `journal_token_present=no`; local probes on `<wtc-canary-host>` returned `200` for both missing and wrong token on `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`, with correct-token probe `not_run_no_token`. Recommendation: hard-stop any production auth-ready claim until the canonical source is deployed with `JOURNAL_READ_TOKEN` configured and the live matrix observes missing/wrong `401` plus correct-token `2xx` without printing the token. Target part: Tortila journal auth.
2. Severity: High. The WTC worker is configured to send a journal token, but the journal does not enforce it, so worker-side secret presence is not sufficient proof. Evidence: `packages/config/src/env.ts:116-123` requires token and explicit URL in production-like non-mock modes; `packages/bot-adapters/src/http.ts:44-49` attaches bearer auth only when a token is configured and `packages/bot-adapters/src/http.ts:93-96` refuses unauthenticated journal reads; read-only Docker presence checks observed `worker_adapter_mode_read_only=yes`, `worker_tortila_url_present=yes`, and `worker_journal_token_present=yes`; live journal probes still accepted missing/wrong tokens. Recommendation: after deploying/provisioning the journal token gate, run a worker tick/burn-in that proves the worker still imports through the authenticated path and logs no token material. Target part: WTC worker to Tortila journal auth.
3. Severity: High. Public firewall posture was externally negative from this audit vantage, but port `8080` is bound broadly and relies on perimeter rules. Evidence: `docs/CONTRACTS/tortila-adapter.md:65-67` requires restricting the journal port to WTC worker/private network; `docs/CONTRACTS/tortila-adapter.md:492-497` keeps `BOT_ADAPTER_MODE=read-only` gated on token auth plus port restriction; listener classification observed `8080` and `8000` as `all_interfaces`, `8123` and `8300` as `loopback`; iptables read showed non-loopback DROP rules for `8080` and `8000`; public TCP probes to `<wtc-canary-host>` ports `8000`, `8080`, `8123`, and `8300` all returned `connected=False`. Recommendation: treat this as a useful public-negative firewall check, not full private-network proof; after auth is fixed, capture an authorized positive from the intended WTC worker path plus an unauthorized negative from outside the allowed network. Target part: firewall/private-network posture.
4. Severity: Medium. Recent no-secret-leak gates are green for scanned repo and count-only runtime log markers, but retained evidence must stay redacted. Evidence: `AGENTS.md:76-77` and `docs/SESSION_PROTOCOL.md:83-85` ban plaintext secret leakage; `packages/bot-adapters/src/http.ts:46-48` says bearer values are never logged/returned; `tests/integration/worker-tortila-snapshot.test.ts:214-224` and `tests/integration/worker-tortila-snapshot.test.ts:234-243` assert wrong-token fixtures do not leak into worker/detail payloads; read-only log marker counts for `journal-server.service`, `turtle-journal.service`, `turtle-bot.service`, and `wtc-ecosystem-worker` were all `0` over the last 2h; `npm run secret:scan` passed. Recommendation: continue retaining only redacted summaries/status-code matrices, not raw logs, raw curl buffers, screenshots of terminals, env dumps, or token-derived values. Target part: no-secret-leak evidence.
5. Severity: High. Runtime deploy/auth/firewall remains a separate incomplete gate despite Phase 4.71 local proof. Evidence: `docs/STATUS.md:14-16` says runtime deploy, production token provisioning, firewall/private-network probes, burn-in, live controls, and full branded production remained NOT RUN after Phase 4.71; `docs/NEXT_ACTIONS.md:123-124` keeps Tortila production auth/firewall/deploy NOT RUN; `docs/DEPLOYMENT.md:562-564` requires token provisioning and missing/wrong rejection before exposing the worker; `docs/DEPLOYMENT.md:598-599` keeps real bot adapters blocked on production journal secret, firewall, endpoint-shape, and monitoring proof. Recommendation: do not merge this lane into a production-ready verdict; mark current runtime auth as FAIL/BLOCKED until token enforcement is fixed and re-probed. Target part: phase gate honesty.

## Decisions
- Used strict SSH host-key checking and read-only commands only.
- Did not print, hash, copy, or generate the real `JOURNAL_READ_TOKEN`.
- Checked journal token presence as booleans only from the journal process environment.
- Checked WTC worker env readiness as booleans only from inside `wtc-ecosystem-worker`.
- Skipped the correct-token live journal probe because no token was configured in the journal runtime; running a fake "correct" probe would be false proof.
- Did not call `/api/marks` with a correct token and did not call any live-control/start/stop/apply-config/test-connection path.
- No background agents were spawned by this auditor.

## Risks
- The current journal accepts missing/wrong tokens, so any WTC worker success today can be accidental fail-open runtime behavior rather than authenticated production behavior.
- Public TCP negative probes prove only this audit vantage; cloud security-group/provider-console posture was not independently read.
- Because `8080` is bound to all interfaces, a firewall rule regression would expose a fail-open journal unless token enforcement is fixed first.
- A future token probe can leak secrets if implemented with shell tracing, curl command-line headers, raw logs, env dumps, or terminal screenshots.
- The repo worktree was not clean before this handoff: branch `codex/phase-472-tortila-runtime-auth-firewall` had an unrelated untracked `docs/handoffs/20260606-0719-runtime-bot-continuity-auditor.md`; this auditor did not modify it.

## Verification/tests
RUN:
1. Read required local docs and code listed above.
2. `git status --short --branch` - observed branch `codex/phase-472-tortila-runtime-auth-firewall` and an unrelated untracked bot-continuity handoff.
3. Strict read-only SSH connectivity to `<wtc-canary-host>` - PASS.
4. Service baseline via `systemctl show` - `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service` active/running with `NRestarts=0`; `wtc-bot-api-firewall.service` active/exited with `NRestarts=0`.
5. Journal process token presence check - RUN/FAIL: `journal_token_present=no`.
6. Local journal auth status-code matrix on allowed endpoints - RUN/FAIL: missing token `200`, wrong token `200`, correct token `not_run_no_token`; `x-journal-read-token` correct path `not_run_no_token`.
7. Listener classification - RUN: `8080` and `8000` bind `all_interfaces`; `8123` and `8300` bind `loopback`.
8. Firewall rule read - RUN/PARTIAL: iptables showed non-loopback DROP rules for `8080` and `8000`.
9. Public TCP negative probes from this workstation - RUN/PASS: `<wtc-canary-host>` ports `8000`, `8080`, `8123`, and `8300` all `connected=False`.
10. WTC worker env readiness booleans - RUN: `worker_adapter_mode_read_only=yes`, `worker_tortila_url_present=yes`, `worker_journal_token_present=yes`.
11. Recent runtime no-secret marker counts - RUN/PASS: `journal-server.service`, `turtle-journal.service`, `turtle-bot.service`, and `wtc-ecosystem-worker` all count `0` over the last 2h for token/authorization/password/secret markers.
12. `npm run secret:scan` - PASS.

NOT RUN:
1. Production token provisioning, token rotation setup, env writes, or secret generation - forbidden in this read-only audit.
2. Service restarts, Docker changes, firewall changes, nginx changes, DB changes, or live bot runtime changes - forbidden in this read-only audit.
3. Correct-token live journal probe - not run because the journal runtime had no configured token.
4. Authenticated worker tick/burn-in after fixed journal token enforcement - not run because auth is currently fail-open.
5. Cloud security-group/provider-console verification - not available in this SSH-only audit.
6. Full nft ruleset proof - not retained as proof; iptables plus external TCP probes were used.
7. Raw log review/archive or screenshot/OCR evidence - intentionally not retained to avoid secret leakage.
8. Live bot start/stop/apply-config/test-connection/exchange ping - forbidden and not run.

## Next actions
1. HARD STOP before any production-ready claim: deploy the Phase 4.70 canonical Tortila source to the journal runtime and provision `JOURNAL_READ_TOKEN` without printing or copying the value into chat/logs.
2. Re-run the live auth matrix with secret-safe mechanics: no `set -x`; do not put the real token in argv; feed curl headers via stdin/config; output only endpoint/status; require missing `401`, wrong generated token `401`, bearer correct `2xx` on `/api/health`, `/api/summary`, `/api/equity`, `/api/trades/list`, and `x-journal-read-token` correct `2xx` on `/api/summary`.
3. Prove network posture after auth is fixed: listener classification, firewall/nft or security-group rules, public negative TCP/HTTP probe from outside the allowlist, and authorized positive probe from the intended WTC worker/private path.
4. Re-run worker proof only after journal auth passes: worker tick/burn-in should show authenticated read-only imports, unchanged bot service PIDs/`NRestarts`, no `/api/marks`, and no token material in worker/journal logs.
5. Re-run no-secret gates after probes: count-only runtime log marker checks, `npm run secret:scan`, and retained-evidence scan if any logs/screenshots/reports are archived.
6. Stop immediately and roll back or hand off if any of these occur: token absent in journal process, missing/wrong token not `401`, correct token not `2xx`, public TCP connects to a protected bot port, any token/authorization marker appears in logs or artifacts, `/api/marks` is called by WTC, any bot PID/restart changes unexpectedly, or completing the phase would require runtime mutation outside an approved implementation session.
