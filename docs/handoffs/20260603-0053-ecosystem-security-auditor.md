# ecosystem-security-auditor handoff
## Scope
Phase 3.65 security audit for Tortila real read-only production integration on the current WTC production canary.

Question: can WTC safely enable Tortila real read-only on canary without plaintext exchange secrets, without exposing journal tokens, and with live control disabled?

Verdict: not approved for a global canary `BOT_ADAPTER_MODE=read-only` flip today. The current canary is safe because it remains mock-mode for bots. A future worker-only Tortila read-only canary can be made acceptable only after the mitigations in this handoff are completed and verified in a new scoped phase.

No code, local config, server config, DB rows, bot files, bot processes, nginx, Docker state, provider state, or live bot actions were modified. Read-only SSH was used only for service/listener/firewall/env-key classification. Secret values were not printed or persisted.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260602-2029-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-2029-ecosystem-bot-integration-auditor.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/SECURITY_MODEL.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/INTEGRATION_MAP.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `.env.example`
- `package.json`
- `packages/config/src/env.ts`
- `packages/config/src/env.test.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `packages/audit/src/redact.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `apps/web/instrumentation.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`

Live read-only checks on `<wtc-server>`:
- service active states for nginx, Postgres, Tortila bot, Tortila journal, and WTC bot API firewall
- listening sockets for ports `80`, `443`, `8000`, `8080`, `8300`, `8301`, `8123`, and `5432`
- firewall service metadata and safe script lines
- process/container names only
- metadata and safe-key inventory for WTC canary env, old WTC preview env, and active Tortila env
- external TCP reachability probe from the current workstation to `80`, `443`, `8000`, `8080`, `8301`, and `5432`

## Files changed
None - read-only audit.

Required handoff written by this auditor:
- `docs/handoffs/20260603-0053-ecosystem-security-auditor.md`

## Findings
1. Severity: HIGH. Current canary is safe because it is still mock-mode, but it is not safe to globally flip WTC canary to Tortila real read-only today. Evidence: Phase 3.64 records that canary bot integration is intentionally `BOT_ADAPTER_MODE=mock` and live control is false at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:52`; real Tortila non-mock acceptance was explicitly not run at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:93-95`; current live safe-env inventory showed the canary env as `APP_ENV=staging`, `NODE_ENV=production`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, `AXIOMA_ROUTE_SKELETON_ENABLED=false`, `JOURNAL_READ_TOKEN=<absent>`, and both Tortila journal URL vars absent. Recommendation: keep canary web on mock mode until a dedicated worker-only real-read phase clears token, firewall, worker, DB, and UI-source gates. Target part: canary adapter activation.

2. Severity: HIGH. Journal auth/token prerequisites are not satisfied. Evidence: the Tortila contract says the journal currently has no auth and requires `JOURNAL_READ_TOKEN` plus network restriction before production read-only at `docs/CONTRACTS/tortila-adapter.md:32-44`, and its phase gate requires token auth and port restriction at `docs/CONTRACTS/tortila-adapter.md:469-473`; production config rejects non-mock adapter mode without `JOURNAL_READ_TOKEN` at `packages/config/src/env.ts:111-115`; the real adapter refuses unauthenticated reads at `packages/bot-adapters/src/http.ts:93-98` and returns `not_configured` without a token at `packages/bot-adapters/src/http.ts:154-155`; current live safe-env inventory showed `JOURNAL_READ_TOKEN=<absent>` in both WTC canary env and the active Tortila env. Recommendation: implement/prove journal bearer-token auth, provision the read token through approved secret handling, rotate it, and rerun no-token/no-leak tests before enabling any non-mock mode. Target part: journal token gate.

3. Severity: HIGH. Server exposure is improved, but the journal still binds broadly and depends on the firewall service for external isolation. Evidence: seed discovery identifies bot ports `:8000` and `:8080` as `0.0.0.0` listeners at `docs/handoffs/0000-orchestrator-seed.md:41`; Phase 3.64 added and enabled a firewall service that drops non-loopback inbound access to `8000` and `8080` at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:40-41`; current read-only SSH showed `0.0.0.0:8000` and `0.0.0.0:8080` still listening locally, `wtc-bot-api-firewall.service=active`, and the firewall script inserting non-loopback DROP rules; current external probe showed `80` and `443` open while `8000`, `8080`, `8301`, and `5432` timed out. Recommendation: treat the firewall as a required gate, add monitoring for it, and preferably bind journal/legacy bot APIs to loopback or a private interface before read-only promotion. Target part: bot API network boundary.

4. Severity: HIGH. Plaintext exchange-secret risk remains on the bot host even though the WTC canary env itself does not contain exchange secret assignments. Evidence: the process gates prohibit plaintext exchange secrets in DB/logs/audit/responses/fixtures/screenshots at `AGENTS.md:76-77` and require exchange keys to remain encrypted at rest at `docs/handoffs/0000-orchestrator-seed.md:121`; WTC DB schema stores exchange secrets only as sealed vault JSON at `packages/db/src/schema.ts:128-132`; exchange-key create/list repositories never return sealed material and audit only non-secret metadata at `packages/db/src/repositories.ts:384-407`; current live safe-env inventory showed no exchange secret assignments in WTC canary env but did show exchange/Telegram secret assignments present in the active Tortila env, with no values printed. Recommendation: do not mount, copy, archive, or parse the Tortila bot env from WTC; tighten active/backed-up bot env permissions, remove unnecessary backups, and rotate credentials if exposure is accepted as possible. Target part: plaintext exchange-secret containment.

5. Severity: HIGH. Live control remains disabled and must stay disabled for this phase. Evidence: live control gates are still not started/green at `docs/BOT_CONTROL_SAFETY_MODEL.md:93-151`; code requires both feature flag and audit approval before any control method can proceed at `packages/bot-adapters/src/control.ts:1-17`; the HTTP Tortila adapter hard-disables `startBot`, `stopBot`, and `applyConfig` at `packages/bot-adapters/src/http.ts:57-70`; Phase 3.64 explicitly did not run any live start/stop/apply-config action at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:93-97`; current live canary env has `FEATURE_LIVE_BOT_CONTROL=false`. Recommendation: do not set `BOT_ADAPTER_MODE=audited`, do not expose live controls, and do not run bot start/stop/apply-config until both security and bot-integration control audits are complete. Target part: live bot control safety.

6. Severity: HIGH. A global canary adapter-mode flip could make user-facing web requests perform direct live journal reads; the safer path is worker-only polling into WTC DB snapshots. Evidence: the bot-integration auditor called this out at `docs/handoffs/20260602-2029-ecosystem-bot-integration-auditor.md:60-62` and `docs/handoffs/20260602-2029-ecosystem-bot-integration-auditor.md:80-84`; the worker builds the adapter with mode, journal URL, and `JOURNAL_READ_TOKEN` at `apps/worker/src/index.ts:151-186`; the worker job is read-only and never calls controls or `/api/marks` at `apps/worker/src/jobs.ts:9-15` and writes health/snapshots at `apps/worker/src/jobs.ts:105-248`; user-facing bot loader still constructs adapters from process env at `apps/web/src/features/bots/data.tsx:135-158`; admin health can observe DB-backed health/snapshot state at `apps/web/src/features/admin/queries.ts:342-451`. Recommendation: run first real-read canary as a dedicated worker process with scoped env and system bot binding while keeping web canary `BOT_ADAPTER_MODE=mock`, or first refactor production bot pages to read DB snapshots only. Target part: real-read data path.

7. Severity: MEDIUM. Audit/log redaction boundaries are good locally, but intended production append-only audit role proof was not run in this read-only lane. Evidence: redaction covers secret-like keys and values at `packages/audit/src/redact.ts:12-79`; audit event construction redacts before/after payloads at `packages/audit/src/audit.ts:166-183`; production console audit writer is disabled at `packages/audit/src/audit.ts:203-209`; trade imports audit only external trade id and source adapter at `packages/db/src/repositories.ts:1736-1746`; audit-log schema requires restricted app-role insert/select only at `docs/AUDIT_LOG_SCHEMA.md:88-92`; direct production/preview intended-role proof is still not run per `docs/PRODUCTION_BLOCKERS_CURRENT.md:20`. Recommendation: run the intended canary DB append-only audit-role proof only in an approved mutation phase, and retain a redacted summary; do not use this read-only audit as audit-role acceptance. Target part: audit durability and no-secret logging.

8. Severity: MEDIUM. Production worker rollout/monitoring is still not green, so real Tortila read-only freshness cannot be claimed. Evidence: Phase 3.64 lists production worker systemd rollout/monitoring as not green at `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:93-102`; current blocker docs keep the worker service rollout open at `docs/PRODUCTION_BLOCKERS_CURRENT.md:80`; current read-only process/container inventory observed canary and preview web processes/containers but no accepted production worker service gate. Recommendation: deploy a monitored worker only after token/network gates pass, with `SYSTEM_BOT_OWNER_ID` or `SYSTEM_BOT_INSTANCE_ID` bound, and verify `integration_health_checks`, snapshots, imports, admin bot health, and retained log scans. Target part: worker canary readiness.

## Decisions
- Do not approve a global canary `BOT_ADAPTER_MODE=read-only` flip in Phase 3.65.
- Current canary remains acceptable only in its current mock bot state with live control disabled.
- The first acceptable Tortila real-read experiment should be worker-only, not user-facing web request reads.
- No journal token value, DB URL, session secret, KEK, exchange key, Telegram token, cookie, or provider secret was printed.
- No live bot start/stop/apply-config, tmux control, systemd mutation, Docker mutation, DB mutation, nginx mutation, or bot file edit was run.
- No background agents were spawned by this per-agent lane; none are left running.

## Risks
- If `wtc-bot-api-firewall.service` is disabled or iptables state is flushed, the still-broad bot listeners can become externally reachable again.
- Provisioning a journal token without journal-side auth enforcement would create a false sense of security.
- Putting the journal token in general process env is acceptable only if env dumps, logs, retained artifacts, and support tooling are redaction-guarded; raw token values must never enter docs or chat.
- Existing Tortila bot env/backups contain plaintext exchange/Telegram secret assignments; WTC must not read, copy, mount, archive, or expose them.
- A global adapter-mode flip can turn user web requests into live journal probes before worker-only DB snapshot acceptance is proven.
- Real-read import writes can create misleading freshness if no monitored production worker cadence exists.

## Verification/tests
Gates RUN in this Phase 3.65 security-auditor lane:
- Protocol and seed read by inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`.
- Latest Phase 3.64 handoff and related status/action/blocker docs read by inspection.
- Security docs read by inspection: security model, secret vault, audit log schema, bot control safety, integration map, Tortila contract.
- Static local source audit by inspection: env validation, adapter factory, HTTP token handling, live-control gate, worker snapshot path, web bot loader, admin health, audit redaction, DB vault storage, and key tests.
- `npm run secret:scan` - PASS, output suppressed.
- `npm run governance:check` - PASS: `0` errors, `1` known historical warning for `20260529-1921-integration-risk-auditor.md` missing `## Files inspected`.
- Read-only SSH service/listener/firewall classification - PASS: nginx/Postgres/Tortila services active; bot listeners local on `0.0.0.0:8000` and `0.0.0.0:8080`; WTC canary and preview listeners localhost-only; firewall service active.
- Current external TCP probe - PASS for expected exposure shape: `80` and `443` open; `8000`, `8080`, `8301`, and `5432` timeout from current workstation.
- Safe env inventory - PASS with values hidden for secret-like keys: WTC canary has bot mode mock, live control false, TV automation false, Axioma routes false, journal token absent, and journal URL absent; active Tortila env has exchange/Telegram secret assignments present and no journal read token assignment.
- Git status check after write - PASS for scope tracking: this lane added `docs/handoffs/20260603-0053-ecosystem-security-auditor.md`; an unrelated untracked `docs/handoffs/20260603-0052-ecosystem-bot-integration-auditor.md` was also present and was not created or modified by this lane.

Gates NOT RUN in this Phase 3.65 security-auditor lane:
- `npm test`, focused Vitest, typecheck, lint, build, Playwright/e2e, coverage, and `npm run ci:local` - not run; static/read-only security lane and no code changes.
- Real Tortila `BOT_ADAPTER_MODE=read-only` acceptance - not run because journal token/auth, worker, DB, and UI-source gates are not cleared.
- Any live bot start/stop/apply-config action - explicitly forbidden and not run.
- Tortila `/api/marks` - not run; WTC must never consume it.
- Legacy authenticated API acceptance - not run; blocked by plaintext exchange-key risk.
- Live DB queries or append-only audit-role proof - not run because they write/read live DB state and this lane was read-only.
- HTTP application smokes against journal/canary - not run in this lane; TCP and SSH metadata checks were used to avoid app log writes.
- `sudo`, systemd mutation, Docker mutation, nginx mutation, deploy, tmux control, bot file edits, env edits, provider calls, and server config changes - not run.

## Next actions
1. Keep current canary `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`.
2. Implement/prove Tortila journal bearer auth and configure `JOURNAL_READ_TOKEN` without printing the value.
3. Keep or improve the firewall gate for `8000` and `8080`; preferably bind bot APIs to loopback/private interface and monitor the firewall service.
4. Clean up bot-host plaintext secret hygiene: do not expose values, remove unnecessary env backups, tighten permissions, and rotate credentials if exposure is accepted as possible.
5. Run a worker-only Tortila read canary with scoped `BOT_ADAPTER_MODE=read-only`, `TORTILA_JOURNAL_URL`, `JOURNAL_READ_TOKEN`, and system bot binding; keep the web container mock or DB-only.
6. Verify DB-backed admin observations: `integration_health_checks`, latest `bot_metric_snapshots`, `bot_trade_imports`, `/admin/bots`, and `/admin/system-health`.
7. Run retained log/artifact secret scans after the worker canary and run append-only audit-role proof only in an approved mutation phase.
8. Do not consider live bot control until the full security plus bot-integration control gates are documented green.
