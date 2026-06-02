# Phase 3.64 production canary deploy handoff
## Scope
Phase 3.64 moved WTC from local-only readiness into a public HTTPS production canary without modifying the two live bot codebases or bot configuration. The phase used the operator-provided SSH access for the Singapore server, kept both existing bots running, deployed the WTC web app above them, and added a firewall layer so bot API ports are no longer reachable from the public internet while remaining reachable locally on the server.

Public canary URL:
- `https://<wtc-canary-host>`

Per-agent handoffs used for this phase:
- `docs/handoffs/20260602-2029-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-2029-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-2029-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-2029-ecosystem-bot-integration-auditor.md`

All four background agents were closed before this aggregate report.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, Phase 3.63 docs and handoffs, Phase 3.64 per-agent handoffs, CI workflow/results, production config tests, server nginx state, server docker/process state, server Postgres state, server bot listener state, server firewall state, and public HTTPS/browser smokes.

The existing bot services and bot source/config trees were treated as read-only. No plaintext exchange secrets were printed or persisted.

## Files changed
Repository:
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md` - this aggregate deploy handoff.
- `docs/STATUS.md` - Phase 3.64 status update.
- `docs/NEXT_ACTIONS.md` - production canary next actions.
- `docs/PRODUCTION_BLOCKERS_CURRENT.md` - current production blocker clarification.

Already landed in commit `5522900` before this aggregate:
- Axioma production env can now be omitted when `AXIOMA_ROUTE_SKELETON_ENABLED=false`; enabling Axioma in staging/production still requires bridge token, ES256 key, and key id.
- CI no longer generates or prints a private ES256 key and no longer commits raw Playwright screenshots.
- Phase 3.64 per-agent handoffs were added.

Server changes:
- Deployed release `5522900` to `/home/ubuntu/apps/wtc_ecosystem_platform_releases/20260602-1412-5522900`.
- Created canary database `wtc_platform_canary_20260602_1412` from the existing WTC preview DB, then ran migrations and seed.
- Started `wtc-ecosystem-canary` on `127.0.0.1:8301`.
- Switched WTC nginx routing from `127.0.0.1:8300` to `127.0.0.1:8301`.
- Created and enabled nginx HTTPS canary host `<wtc-canary-host>`.
- Issued Let's Encrypt TLS for `<wtc-canary-host>`, valid from 2026-06-02 to 2026-08-31.
- Added `/usr/local/sbin/wtc-bot-api-firewall.sh`.
- Added and enabled `wtc-bot-api-firewall.service`, which drops non-loopback inbound TCP access to ports `8000` and `8080`.

Server state intentionally left in place:
- `wtc-ecosystem-preview` remains running on `127.0.0.1:8300` as rollback-only old preview; nginx no longer routes the WTC public host to it.
- Existing Axioma nginx/server state was not intentionally changed.
- Existing bot code/config/process ownership was not changed.

## Findings
1. Severity: High. The public WTC canary is live over HTTPS and supports registration/login with secure host cookies. Evidence: browser and curl smokes passed for `https://<wtc-canary-host>`, including a real register/login cycle.
2. Severity: High. Both existing bots remained running after deploy. Evidence: `turtle-bot.service` is active, tmux session `bot` exists, and server-local ports `8000` and `8080` remain open.
3. Severity: High. Bot API ports were exposed externally before this phase and are now blocked from the outside while still open on localhost. Evidence: local external TCP probe after firewall returned `80 open`, `443 open`, `8000 timeout`, `8080 timeout`; server-local probes returned `8000 local open` and `8080 local open`.
4. Severity: High. Real bot integration is still not enabled. The canary intentionally runs `BOT_ADAPTER_MODE=mock` and `FEATURE_LIVE_BOT_CONTROL=false`; this is correct until Tortila and Legacy adapters pass security and bot-integration acceptance.
5. Severity: High. Legacy non-mock adapter remains blocked by upstream plaintext/key and service-account/vault/safety gates. The site must not start/stop/apply live bot config until these gates pass.
6. Severity: Medium. Billing is not self-serve live. The canary uses crypto/manual style production config rather than mock, but no Stripe production/test checkout webhook acceptance has been run.
7. Severity: Medium. Axioma is intentionally omitted for this scope. `AXIOMA_ROUTE_SKELETON_ENABLED=false`; `/.well-known/axioma-jwks.json` returns expected disabled/unavailable behavior.
8. Severity: Medium. The canary hostname is a temporary `nip.io` HTTPS hostname, not a branded production domain.

## Decisions
- Deployed a canary rather than claiming final full production, because live bot adapters, billing, Axioma, and provider gates are not green.
- Kept both existing bots running and did not modify bot code/config.
- Hardened network exposure around the bot API ports instead of changing the bot processes.
- Kept live bot control disabled and bot adapter mode mocked until security and bot-integration acceptance can be passed.
- Left the old WTC preview container running on localhost-only port `8300` as rollback evidence, with nginx public routing on the canary container `8301`.
- Omitted Axioma for this production slice because the operator explicitly allowed Axioma to be skipped.

## Risks
- The current site is production-canary live, but bot data/control in the UI is still mocked. Treating this as full bot-integrated production would be inaccurate.
- If a branded domain is required, DNS/TLS must be repeated for that hostname.
- If `wtc-bot-api-firewall.service` is disabled or iptables state is overwritten, ports `8000` and `8080` could become publicly reachable again.
- The old preview container remains a rollback process on localhost-only `8300`; it should be removed after a deliberate rollback-retention decision.
- Stripe/self-serve billing, live bot adapters, Axioma, live LMS object-store/scanner, production monitoring, and live worker rollout remain separate gates.

## Verification/tests
RUN/PASS in Phase 3.64:
- Four read-only agents dispatched before deploy work; four per-agent handoffs exist and are cited above; all agents closed.
- Local `npm run ci:local` - PASS: `check:core`, governance, lint, root/web typecheck, secret scan, tests, coverage/build path included by script; root tests observed `105` files, `935` passed, `10` skipped; Next build observed `35` pages.
- GitHub Actions for commit `0b5d233` - PASS.
- GitHub Actions for commit `5522900` / run `26824978779` - PASS: core checks, governance, lint, typecheck root/web, secret scan, production-like env, migrations/seed, tests, coverage, build, and e2e.
- Server deploy smoke: `/`, `/login`, `/register`, `/products/tortila` returned HTTP `200` over `https://<wtc-canary-host>`.
- Unauthenticated `/app/bots` returned redirect as expected.
- Browser real registration succeeded with a fresh canary user and landed on `/app`.
- Browser fresh login for that canary user succeeded and landed on `/app`.
- Browser session cookie was `__Host-wtc_session`, `secure=true`, `httpOnly=true`, `sameSite=Lax`, scoped to `<wtc-canary-host>`.
- Browser `/app/bots` authenticated smoke returned HTTP `200` and showed mock/no-live banners.
- Production e2e bypass check: GET `/api/e2e/login` returned `405`, so the browser bypass is not exposed as a GET login path in production.
- Server services active: `nginx`, `postgresql`, `turtle-bot.service`, and `wtc-bot-api-firewall.service`.
- Server tmux bot session active: `bot`.
- Server containers active: `wtc-ecosystem-canary` and rollback-only `wtc-ecosystem-preview`.
- Server-local bot TCP probes: `127.0.0.1:8000` open and `127.0.0.1:8080` open.
- External TCP probe from local machine: `<server-public-ip>:80` open, `:443` open, `:8000` timeout, `:8080` timeout.
- In-app browser opened to `https://<wtc-canary-host>/products/tortila`.

NOT RUN / NOT GREEN in Phase 3.64:
- Real Tortila non-mock read-only adapter acceptance against production canary.
- Real Legacy non-mock adapter acceptance.
- Any live bot start/stop/apply-config action.
- Stripe real test checkout and real webhook replay.
- Axioma live bridge/account-link/download acceptance; intentionally skipped for current scope.
- Live LMS object-store and live external scanner acceptance.
- Branded-domain DNS/TLS.
- Production worker systemd rollout/monitoring.
- Long-running production observability/alerting burn-in.

## Next actions
1. Keep the operator-known canary URL online for review: `https://<wtc-canary-host>`.
2. Decide whether to keep or stop the rollback-only localhost WTC preview container on `8300`.
3. Run a dedicated bot-integration hardening phase for Tortila read-only production adapter only; do not enable live control.
4. Run a separate Legacy adapter security remediation phase after the upstream plaintext/key issue is solved.
5. Run billing provider acceptance before enabling self-serve payments.
6. Attach a branded domain and repeat TLS/nginx smoke once DNS is available.
7. Add production monitoring and worker process rollout after canary review.
