# ecosystem-security-auditor handoff
## Scope
Phase 3.64 read-only security/live-server audit for WTC Ecosystem Platform.

Focus areas:
- secrets exposure risks and `.env` handling without printing values
- live bot safety boundaries
- DB/SSH/deploy risk gates
- no plaintext exchange secrets
- audit role / append-only proof status
- what must be true before deploy

Local workspace: `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Live target used only for read-only checks: `ssh -i "C:\Users\maxib\GTE BOT\keys\key_server_bot_singapur.pem" ubuntu@54.179.188.61`.

No server files, services, environment, DBs, bots, nginx config, or git state were mutated. Secret values were not printed. Remote `.env` review was limited to file metadata and assignment names.

Process note: this is one `ecosystem-security-auditor` lane. No multi-agent or N-agent audit claim is made.

## Files inspected
Local repo files:
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY_MODEL.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/RBAC_MATRIX.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `.env.example`
- `.gitignore`
- `.secretlintignore`
- `.secretlintrc.json`
- `package.json`
- `packages/config/src/env.ts`
- `packages/shared/src/env-guards.ts`
- `packages/audit/src/redact.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/crypto/src/vault.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `apps/web/instrumentation.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/vault.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(app)/app/security/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/worker/src/index.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/audit-append-only-role-preflight.mjs`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/preflight-log-root.mjs`
- `scripts/safe-worker-tick.mjs`

Live server read-only inventory:
- identity/host metadata: `hostname`, `whoami`, `uname -a`, `id -nG`
- listening sockets: `ss -ltn`
- services: `systemctl list-units --type=service --all --no-pager --no-legend`
- selected service metadata: `systemctl show ...`
- selected unit files: `systemctl cat journal-server.service turtle-bot.service turtle-journal.service --no-pager`
- nginx enabled/available site metadata plus selected routing lines
- metadata-only listings under:
  - `/home/ubuntu/apps/bot`
  - `/home/ubuntu/apps/turtle_bingx`
  - `/home/ubuntu/journal_server`
  - `/home/ubuntu/apps/wtc_ecosystem_platform`
  - `/home/ubuntu/apps/wtc_ecosystem_platform/.runtime`
  - `/home/ubuntu/.ssh`
- assignment-name-only extraction from active `.env` files:
  - `/home/ubuntu/apps/bot/.env`
  - `/home/ubuntu/apps/turtle_bingx/.env`
  - `/home/ubuntu/journal_server/.env`
  - `/home/ubuntu/apps/wtc_ecosystem_platform/.env.preview.local`
- filename-only grep scans for secret-shaped markers in selected logs/runtime files
- external TCP reachability probe from the current workstation to ports `22`, `80`, `443`, `8000`, `8080`, `8300`, `8123`, and `5432`

## Files changed
Only this required handoff:
- `docs/handoffs/20260602-2029-ecosystem-security-auditor.md`

No code, config, status/blocker docs, local git state, server files, live env, services, DB, bots, nginx, or provider state were changed.

## Findings
1. Severity: HIGH. Public live bot ports are reachable from the current network. Evidence: `docs/handoffs/0000-orchestrator-seed.md:41` documents bot ports `:8000` and `:8080` bound to `0.0.0.0` with no protected proxy assumption; `docs/CONTRACTS/legacy-bot-adapter.md:20` and `docs/CONTRACTS/legacy-bot-adapter.md:52` identify the legacy bot on `0.0.0.0:8000`; `docs/CONTRACTS/tortila-adapter.md:21` and `docs/CONTRACTS/tortila-adapter.md:42-44` identify Tortila journal on `0.0.0.0:8080` and require security-group/iptables restriction before read-only mode. Live read-only evidence: `ss -ltn` showed `0.0.0.0:8000` and `0.0.0.0:8080`; external TCP probe showed ports `8000` and `8080` open. Recommendation: do not enable WTC real bot adapters or deploy production WTC until these ports are restricted to approved source IPs or moved behind authenticated/private access. Target part: live bot network boundary.

2. Severity: HIGH. Live bot secret hygiene is not deploy-safe: exchange/API secret variable names exist in bot env files, and permissions/backups broaden exposure risk. Evidence: `AGENTS.md:77` and `docs/handoffs/0000-orchestrator-seed.md:121` prohibit plaintext exchange secrets in DB/logs/audit/responses/fixtures/screenshots and require encrypted-at-rest vault handling. Live read-only evidence: `/home/ubuntu/apps/bot` is `drwxrwxrwx`; `/home/ubuntu/apps/bot/.env` is `-rw-rw-rw-`; `/home/ubuntu/apps/turtle_bingx/.env` is `-rw-r--r--`; multiple `/home/ubuntu/apps/turtle_bingx/.env.backup*` files are `-rw-r--r--`; active Tortila env assignment names include `BINGX_DEMO_API_KEY`, `BINGX_DEMO_API_SECRET`, `BINGX_LIVE_API_KEY`, `BINGX_LIVE_API_SECRET`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`. No values were printed. Recommendation: before deploy, treat these env/backups as sensitive material, remove unnecessary backups, tighten permissions, move secrets into an approved secret store or service-specific restricted env handling, and rotate affected exchange/Telegram/API credentials if exposure is accepted as possible. Target part: server secret storage and live bot env handling.

3. Severity: HIGH. Tortila read-only adapter prerequisites are not satisfied for production use. Evidence: `docs/CONTRACTS/tortila-adapter.md:36-44` requires journal token auth and network restriction before `BOT_ADAPTER_MODE=read-only`; `docs/CONTRACTS/tortila-adapter.md:469-472` makes API token auth a phase gate; `packages/config/src/env.ts:112-113` requires `JOURNAL_READ_TOKEN` when production `BOT_ADAPTER_MODE` is not `mock`; `packages/bot-adapters/src/http.ts:94-97` refuses unauthenticated journal reads. Live read-only evidence: `turtle-journal.service` starts the journal on `--host 0.0.0.0 --port 8080`, uses `EnvironmentFile=/home/ubuntu/apps/turtle_bingx/.env`, and the active env assignment names did not include `JOURNAL_READ_TOKEN`. Recommendation: keep `BOT_ADAPTER_MODE=mock` for WTC production until journal bearer-token auth and network restriction are implemented and verified against the intended host. Target part: Tortila adapter activation.

4. Severity: HIGH. Legacy bot integration remains blocked by plaintext-key risk and public exposure. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:366-382` records the legacy API plaintext exchange-key issue as a blocker before WTC production read-only use; `docs/CONTRACTS/legacy-bot-adapter.md:391-401` says non-mock legacy modes route to a blocked adapter and there is no configuration path to reach the legacy bot; `packages/bot-adapters/src/legacy/legacy-blocked.ts:89-98` keeps control methods disabled; `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts:65-87` strips secret-looking fields before canonical mapping. Live read-only evidence: `0.0.0.0:8000` is externally reachable; `/home/ubuntu/apps/bot/.env` is world-readable/world-writable and has assignment names including `PASSWORD` and `KEY`. Recommendation: do not unblock legacy adapter or connect WTC to legacy read-only mode until the upstream plaintext-key response/storage problem is fixed, service-account auth is scoped, and the public port is restricted. Target part: legacy bot adapter and upstream legacy service.

5. Severity: HIGH. The live WTC preview is not a production deploy shape. Evidence: `docs/DEPLOYMENT.md:495-500` describes staged deployment gates and keeps audited live controls separate; `docs/DEPLOYMENT.md:537-548` lists production server deployment, production nginx/domain/TLS, production auth throttling, Axioma production handoff, real bot adapters, and live bot/exchange control as NOT RUN until explicit approval; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:94-96` still lists live/server preview smoke, GitHub CI, and deploy/server checks as NOT RUN in the prior operator packet. Live read-only evidence: nginx raw-IP site proxies `54.179.188.61` on port `80` to `127.0.0.1:8300`; `ss -ltn` showed `127.0.0.1:8300`; process inventory showed root-owned `npm run dev`, `node`, and `next-server` processes rather than a hardened production service. Recommendation: before deploy, replace dev-server preview with a built production process managed by a least-privilege service unit, with rollback, logs, env loading, DB migrations, TLS/domain, and smoke gates documented. Target part: WTC deploy/process model.

6. Severity: HIGH. WTC preview runtime artifacts may retain sensitive material or sensitive query helpers. Evidence: `docs/DEPLOYMENT.md:311-314` requires redacted artifact scanning without printing matched values; `docs/DEPLOYMENT.md:322-334` describes retained child-output redaction for DB/env secret assignments and private-key blocks; `.gitignore:17-26` ignores `.runtime`, `.env`, PEM/key files, and `secrets/`. Live read-only evidence: filename-only grep found secret-shaped markers in `/home/ubuntu/apps/wtc_ecosystem_platform/.runtime/backups/wtc_platform_preview_pre_0007_20260601_101722.sql`, `.runtime/wtc_get_user_id.mjs`, and `.runtime/wtc_query_journal.mjs`; metadata shows these `.runtime` files are group-readable. Recommendation: do not archive or reuse server `.runtime` artifacts until a value-redacted scan/review clears them; remove or relocate helper scripts and SQL backups under a policy that does not retain secrets or raw identifiers. Target part: retained evidence and server runtime artifacts.

7. Severity: MEDIUM. Server database exposure is better than bot exposure, but the intended production/preview append-only audit role is still unproven in this session. Evidence: live read-only `ss -ltn` showed Postgres bound to `127.0.0.1:5432`; external TCP probe showed port `5432` closed; `docs/AUDIT_LOG_SCHEMA.md:16` and `docs/AUDIT_LOG_SCHEMA.md:88-92` require the app role to have SELECT/INSERT only and no UPDATE/DELETE/TRUNCATE; `scripts/audit-append-only-role-preflight.mjs:18-21` documents the opt-in proof; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:87` lists the production/preview intended append-only audit DB-role proof as NOT RUN. Recommendation: before deploy, run `npm run accept:audit:append-only-role` against the actual restricted app role/database with explicit consent and retain only redacted summary evidence. Target part: DB audit-role gate.

8. Severity: MEDIUM. Local WTC code enforces strong no-plaintext exchange-key and audit-redaction boundaries, but doc truth still has stale redaction wording. Evidence: `packages/db/src/schema.ts:6` and `packages/db/src/schema.ts:128-132` define `exchange_api_key_secrets` with only sealed vault JSON and no plaintext column; `packages/db/src/repositories.ts:388-407` writes exchange key metadata plus sealed secret transactionally and never joins the secret row for list views; `packages/audit/src/redact.ts:12-34` includes secret hints for sealed/ciphertext/vault/credential/bearer/token fields; `packages/audit/src/redact.ts:68-76` applies recursive key and value redaction; local `npm run secret:scan` passed with output suppressed. Drift evidence: `docs/AUDIT_LOG_SCHEMA.md:290-295` and `docs/SECRET_VAULT_DESIGN.md:31` still describe some redaction additions as target/not yet in code, while current code already includes the major additions and deliberately omits bare `iv`/`tag` to avoid over-redacting innocuous field names. Recommendation: keep the code boundary; reconcile the docs so future deploy audits do not treat fixed redaction as target work or miss the deliberate `iv`/`tag` rationale. Target part: local secret vault/audit source of truth.

9. Severity: MEDIUM. Server WTC preview env appears stale relative to the current production config contract and Axioma enablement fence. Evidence: `packages/config/src/env.ts:79-80` requires `SECRET_VAULT_KEK` to be a base64 32-byte key; `packages/config/src/env.ts:86-95` requires Stripe config when `BILLING_PROVIDER=stripe` in production-like environments; `packages/config/src/env.ts:98-107` now requires `AXIOMA_BRIDGE_API_TOKEN`, `AXIOMA_HANDOFF_SIGNING_KEY`, and `AXIOMA_HANDOFF_KEY_ID` when Axioma routes are enabled in staging/production; `docs/DEPLOYMENT.md:515-516` still says production requires ES256 and treats `AXIOMA_HANDOFF_SIGNING_SECRET` as dev/test only; `apps/web/instrumentation.ts:12-13` calls `loadEnv()` at boot. Live read-only evidence: `/home/ubuntu/apps/wtc_ecosystem_platform/.env.preview.local` is `0600` but assignment names include `AXIOMA_HANDOFF_SIGNING_SECRET` and do not show the current ES256 key/key-id names. Recommendation: before deploy or Axioma route enablement, regenerate the server env from the current `.env.example`/config contract, keep Axioma fail-closed unless `AXIOMA_ROUTE_SKELETON_ENABLED` is intentionally enabled, and do not reuse stale preview env material as production material. Target part: deployment env compatibility.

10. Severity: MEDIUM. SSH/deploy privilege is broader than a production deploy should need. Evidence: live read-only `id -nG` shows `ubuntu` belongs to `sudo` and `docker`; process inventory showed WTC Node/Next processes owned by `root`; `/home/ubuntu/.ssh/authorized_keys` is `0600` and `.ssh` is `0700`, which is good, but the active SSH account is still a broad administrative path. `docs/DEPLOYMENT.md:553-554` forbids `.env` mutation and live process/systemd control from WTC and reiterates exchange keys/vault/entitlements boundaries. Recommendation: before deploy, run WTC under a least-privilege service account, avoid root-owned dev processes, restrict SSH access, and use a runbook that separates read-only inspection from approved deploy mutations. Target part: SSH/deploy operating model.

11. Severity: MEDIUM. Production TLS/session-cookie readiness is not proven for WTC. Evidence: nginx read-only routing showed `wtc-ecosystem-ip` listens on port `80` for raw IP and proxies to `127.0.0.1:8300`; Axioma has TLS on `443`, but the WTC raw-IP preview is not a production domain/TLS cutover. `apps/web/src/app/(auth)/actions.ts:14-17` sets cookies as Secure only when `NODE_ENV=production`; `docs/DEPLOYMENT.md:497` requires domain/TLS/HSTS before the production phase; `docs/DEPLOYMENT.md:543-544` keeps production nginx/domain/TLS and auth throttle/trusted-proxy verification NOT RUN. Recommendation: do not treat raw-IP port-80 preview as production; production must run behind HTTPS with current-session cookie smoke, trusted proxy headers, and rate-limit proof. Target part: nginx/TLS/session readiness.

12. Severity: LOW. Current local git state is better than the prior Phase 3.63 text, but CI is still not proven by this audit. Evidence: read-only local `git status --short --branch` now reports `main...origin/main`, `git remote -v` reports `origin`, and `git log --oneline -1` reports commit `0b5d233`; older Phase 3.63 handoff text at `docs/handoffs/20260602-2009-phase-3-63-production-readiness-gap-closure.md:45` said the folder was not git-backed. Recommendation: update status/docs in a future docs-truth slice if needed, but do not claim GitHub CI green until an actual Actions run is observed. Target part: CI/provenance.

## Decisions
- Used SSH because the current Phase 3.64 instruction explicitly supplied the target and allowed read-only checks. This is a scoped deviation from the older seed preference not to re-SSH.
- Did not read or print secret values. `.env` checks were limited to metadata and assignment names.
- Did not call `sudo`, mutate systemd, start/stop/restart services, inspect DB values, edit nginx, touch bot state, or run provider calls.
- Did not run HTTP endpoint smoke checks; the external reachability check used TCP connect probes only.
- Ran `npm run secret:scan` locally with output suppressed so possible matched values would not print.
- Treated local/dry-run gates from prior phases as useful evidence, not production acceptance.
- Did not make any multi-agent claim. This file is one per-agent handoff.

## Risks
- Publicly reachable legacy/Tortila bot ports create direct exposure independent of WTC.
- World-writable legacy bot files and broad-readable env/backups increase the blast radius if the `ubuntu` account, app code, logs, or any sibling process is compromised.
- WTC `.runtime` server artifacts and bot/journal logs may contain sensitive markers; filename-only scans found risk indicators but intentionally did not expose values.
- WTC raw-IP preview appears to be a dev-process shape, not a production-grade deployment.
- Intended append-only audit role proof remains unrun for the real preview/production app role.
- Live provider acceptance for LMS, Stripe, and Axioma remains unrun.
- Real bot read-only/control must remain disabled until network, auth, plaintext-key, and safety gates are all closed.

## Verification/tests
Gates RUN in this Phase 3.64 security-auditor lane:
- Protocol/doc read by inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, latest Phase 3.63 handoff, blocker docs, deployment docs, security/vault/audit/RBAC docs, and bot contracts.
- Static local source audit by inspection for config fail-closed behavior, vault storage, audit redaction, DB exchange-key persistence, bot adapter controls, backend production DB guard, and worker redaction.
- Local env-file inventory: only `.env.example` exists in this workspace by filename scan.
- `npm run secret:scan` - PASS, output suppressed.
- Local git metadata read-only: branch/remote/last commit observed.
- Read-only SSH reachability: connected as `ubuntu` to `54.179.188.61`.
- Live server identity/group inventory: hostname, user, kernel, and `ubuntu` groups observed.
- Live listening sockets: `ss -ltn` observed `0.0.0.0:8000`, `0.0.0.0:8080`, `127.0.0.1:8123`, `127.0.0.1:8300`, `127.0.0.1:5432`, and public `80/443/22`.
- External TCP probe: ports `22`, `80`, `443`, `8000`, and `8080` open; ports `8300`, `8123`, and `5432` closed from the current workstation.
- Live service inventory: `journal-server.service`, `turtle-bot.service`, `turtle-journal.service`, `nginx.service`, `postgresql@16-main.service`, `ufw.service`, and `docker.service` active.
- Live systemd metadata/unit reads for `journal-server.service`, `turtle-bot.service`, and `turtle-journal.service`.
- Live nginx metadata/routing read: raw-IP WTC site proxies to `127.0.0.1:8300`; Axioma site proxies to `127.0.0.1:8123` and has TLS certificate paths.
- Live env metadata/key-name inventory for active bot/Axioma/WTC env files, with no values printed.
- Filename-only grep scans for secret-shaped markers in selected `.runtime` and log paths, with no values printed.

Gates NOT RUN in this Phase 3.64 security-auditor lane:
- `npm test`, `npm run build -w @wtc/web`, `npm run e2e`, `npm run check:core`, `npm run typecheck`, `npm run lint`, and `npm run coverage` - not run; this was a read-only audit and made no code changes.
- `npm run governance:check` - not run; only this per-agent handoff was created, not an aggregate phase handoff.
- `npm run accept:audit:append-only-role` - not run because it writes one audit row and this phase forbade DB mutation.
- Any DB query against live Postgres - not run; no DB values or schemas were queried on the server.
- HTTP endpoint smoke checks - not run to avoid application requests/log writes; TCP-only reachability was used.
- `sudo`, `ufw status`, AWS security-group inspection, nginx config test/reload, systemd mutations, Docker commands, process control, tmux control, bot control, and deploy actions - not run.
- Live LMS object-store/scanner preflights - not run; no approved live provider config/consent in this lane.
- Stripe live/test checkout and webhook replay - not run; no scoped provider run in this lane.
- Axioma live bridge/account-link/download/JWKS acceptance - not run; no scoped live Axioma acceptance in this lane.
- GitHub Actions CI - not run/observed.

## Next actions
1. Treat the live bot env/backups/log markers as a security cleanup blocker: inventory with a redacted scanner, remove unnecessary env backups, tighten permissions, and rotate affected credentials if exposure is accepted as possible.
2. Restrict or close public `8000` and `8080` before any WTC real adapter activation; add and verify journal bearer-token auth before `BOT_ADAPTER_MODE=read-only`.
3. Keep legacy bot blocked until upstream plaintext exchange-key API/storage risk is fixed and verified.
4. Replace the WTC raw-IP dev preview with a least-privilege production process only after an approved deploy runbook, rollback plan, TLS/domain, env provisioning, migrations, and smoke checks exist.
5. Regenerate server WTC env from the current config contract; staging/production must provide strong `DATABASE_URL`, `SESSION_SECRET`, base64 32-byte `SECRET_VAULT_KEK`, non-mock provider settings as applicable, and Axioma bridge token plus ES256 key/key id before Axioma routes are enabled.
6. Run intended append-only audit role proof against the real restricted preview/production role only in an approved mutation phase, retaining redacted summary evidence only.
7. Run live LMS object-store/scanner, Stripe, Axioma, server/deploy, and GitHub CI gates as separate scoped phases; do not promote local/dry-run evidence to production acceptance.
8. Reconcile stale redaction/git-readiness wording in docs after the security cleanup plan is accepted.
