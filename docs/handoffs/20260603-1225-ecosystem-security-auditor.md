# ecosystem-security-auditor handoff
## Scope
Read-only safety audit for the next canary deploy slice covering the bot analytics/settings UI changes. The objective is to state the non-negotiable constraints for deploying the UI slice while keeping both live bots alive and without enabling Legacy live adapter, Legacy authenticated API access, or live bot control.

This lane inspected repository handoffs and safety docs only. It did not edit product code and did not run SSH, Docker, systemd, nginx, DB, provider, exchange, browser, or live mutation commands.

## Files inspected
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md`
- `docs/handoffs/20260603-0053-ecosystem-security-auditor.md`
- `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md`
- `docs/handoffs/20260603-1147-phase-3-66-bot-analytics-settings-richness.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md`
- `docs/handoffs/20260603-1147-ecosystem-tests-runner.md`
- `docs/handoffs/20260603-1147-ecosystem-ux-statistics-auditor.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/CONTRACTS/tortila-adapter.md`

## Files changed
None — read-only audit.

## Findings
1. Severity: High. The deploy must be UI/statistics/settings only; no live bot runtime can be stopped, restarted, reconfigured, or otherwise mutated. Evidence: the seed rules say never stop/restart/modify live services and prohibit live bot control, SSH, tmux, systemd, process control, and `.env` mutation (`docs/handoffs/0000-orchestrator-seed.md:115-117`); the Phase 3.64 canary deploy kept both existing bots running (`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:49-53`); the Phase 3.66 UI slice states it did not mutate live bot runtime code, restart services, enable Legacy live reads, or enable start/stop/apply-config (`docs/handoffs/20260603-1147-phase-3-66-bot-analytics-settings-richness.md:3-8`). Recommendation: deploy only WTC web/UI artifacts and leave bot code, bot config, bot processes, tmux, systemd, Docker, nginx, and DB outside this auditor lane's approval. Target part: deploy scope.
2. Severity: High. Live bot control must remain disabled. Evidence: the control model says all bot controls default disabled and adapter methods throw `ControlDisabledError` (`docs/BOT_CONTROL_SAFETY_MODEL.md:13-23`); required live-control gates are not started (`docs/BOT_CONTROL_SAFETY_MODEL.md:93-151`); Phase 3.65 confirms `FEATURE_LIVE_BOT_CONTROL=false`, disabled HTTP control methods, and no start/stop/apply-config controls in browser/admin checks (`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:85-87`). Recommendation: keep `FEATURE_LIVE_BOT_CONTROL=false`; do not expose or route start, stop, restart, or apply-config controls; any visible control affordance must remain disabled/read-only. Target part: bot control safety.
3. Severity: High. Legacy live adapter and authenticated Legacy API access must remain blocked. Evidence: the runtime auditor found the live Legacy API unsafe because `/api_management/` can expose plaintext exchange-key material and requires `createLegacyBlockedAdapter()` as production path (`docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md:19-21`); the integration auditor says the non-mock Legacy adapter is deliberately blocked and no new path may bypass it (`docs/handoffs/20260603-1147-ecosystem-bot-integration-auditor.md:18-22`); the Legacy contract says staging/production non-mock routes use `createLegacyBlockedAdapter()` and require upstream plaintext-key remediation plus all safety gates before unblocking (`docs/CONTRACTS/legacy-bot-adapter.md:388-401`). Recommendation: do not set or introduce any Legacy base URL/live env path, do not call `/auth/login` or `/api_management/*`, and keep Legacy analytics operational/reference-only. Target part: Legacy adapter safety.
4. Severity: High. Legacy settings must remain WTC-side reference/export only with no live apply. Evidence: the Legacy settings auditor found the source model is per-symbol/stage/ladders and that the legacy update workflow is whole-set replacement, so live apply must remain disabled until safe adapter and safer update workflow audits pass (`docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md:22-31`); it also warns secret-bearing config and seed fields must not be copied into WTC docs or exports (`docs/handoffs/20260603-1147-ecosystem-legacy-settings-auditor.md:34-35`); the tests-runner handoff says the current export path is safe/reference-only and should keep live apply disabled until B3 clears (`docs/handoffs/20260603-1147-ecosystem-tests-runner.md:35`). Recommendation: ship UI matrices and safe JSON export only; no live-apply token, no secret fields, no hot-reload promise, no DB/API mutation. Target part: Legacy settings UI.
5. Severity: High. Tortila read-only canary evidence must remain DB-backed and control-free; the analytics/settings deploy must not widen it into direct user-page live probing. Evidence: Phase 3.65 accepted Tortila real reads only for the WTC DB-backed read-only canary and kept live start/stop/apply-config disabled (`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:3-8`); the phase rejected shared web live-fetch paths and required user pages to consume WTC DB snapshots/imports, not the journal directly (`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:65-68`); the Tortila contract states WTC is a read-only consumer and no write operations are permitted against the journal (`docs/CONTRACTS/tortila-adapter.md:21-26`). Recommendation: post-deploy evidence must show Tortila pages still use DB-backed read-only data, not live write/control endpoints. Target part: Tortila canary boundary.
6. Severity: High. Bot API firewall and service-alive evidence are mandatory after deploy. Evidence: Phase 3.64 added `wtc-bot-api-firewall.service` to drop non-loopback inbound access to ports `8000` and `8080` (`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:40-41`); Phase 3.65 found live bot services active and recommended keeping future WTC work scoped to WTC services (`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:73-80`); the runtime auditor found Legacy listening on `8000`, Tortila/Axioma services up, and required avoiding service mutation (`docs/handoffs/20260603-1147-ecosystem-bot-runtime-auditor.md:17-25`). Recommendation: after deploy, collect redacted evidence that `turtle-bot.service`, `turtle-journal.service`, Legacy tmux/process, nginx/Postgres as applicable, WTC canary, worker, and `wtc-bot-api-firewall.service` are still in the expected state, without printing secrets. Target part: post-deploy safety evidence.
7. Severity: Medium. No secret-bearing data may enter docs, logs, audit rows, screenshots, retained artifacts, or exports. Evidence: the seed rules prohibit copying `.env`/secrets (`docs/handoffs/0000-orchestrator-seed.md:115-117`); the audit schema requires no secrets in audit logs (`docs/AUDIT_LOG_SCHEMA.md:16-18`); the security model lists exchange key exfiltration through logs and secrets in git/logs/fixtures as explicit threats (`docs/SECURITY_MODEL.md:374-383`); Legacy API responses include plaintext `api_key` and `secret_key` fields that must never be logged or returned (`docs/CONTRACTS/legacy-bot-adapter.md:119-136`). Recommendation: run only redacted checks, suppress secret scan details, and treat any raw token/key/DB URL/cookie/host-coordinate leakage in retained artifacts as a rollback trigger. Target part: secret containment.
8. Severity: Medium. Rollback triggers must be safety-based, not only UI regressions. Evidence: Phase 3.64 kept `wtc-ecosystem-preview` on localhost-only `8300` as rollback evidence (`docs/handoffs/20260602-2125-phase-3-64-production-canary-deploy.md:62-70`); Phase 3.65 kept `wtc-ecosystem-preview` available as rollback and required monitoring worker, canary health, DB freshness, and firewall state (`docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:95-100`, `docs/handoffs/20260603-0124-phase-3-65-tortila-db-readonly-canary.md:147-152`). Recommendation: rollback or halt the slice if live bots are no longer confirmed alive, firewall state is not confirmed, Legacy live path activates, control affordances become enabled, DB snapshot freshness regresses materially, secrets appear in output/artifacts, or canary auth/access checks fail closed incorrectly. Target part: rollback decision.

## Decisions
- Approve only a canary deploy of the bot analytics/settings UI slice, not any bot runtime, adapter, DB, or live-control expansion.
- Keep `FEATURE_LIVE_BOT_CONTROL=false`, `FEATURE_TV_AUTOMATION=false`, Axioma live routes disabled, and Legacy blocked/non-live.
- Keep Legacy settings as reference/export UI only; no live apply, no live hot-reload claim, no authenticated Legacy API calls.
- Keep Tortila read-only evidence DB-backed; do not merge Legacy, Axioma, billing, LMS provider, or live-control gates into this UI deploy.
- Keep bot API firewall monitoring in scope for post-deploy evidence because the underlying bot listeners are still a safety boundary.
- Do not print or persist raw public host coordinates, DB URLs, session cookies, bearer tokens, exchange keys, Telegram tokens, `.env` values, or provider payloads.

## Risks
- A deploy operator could accidentally treat the richer settings UI as permission to apply Legacy config live; that remains explicitly forbidden.
- A route or env change could bypass `createLegacyBlockedAdapter()` and probe `/api_management/*`, creating a plaintext exchange-key exposure path.
- UI changes could make Tortila pages perform live journal reads in user requests instead of consuming WTC DB snapshots.
- Firewall drift could re-expose ports `8000` or `8080` because the bot APIs are still safety-sensitive listener surfaces.
- Post-deploy evidence may be insufficient if it proves only page rendering and not live-bot-alive, firewall, disabled-control, secret-scan, and DB-freshness conditions.

## Verification/tests
Gates RUN in this auditor lane:
- Read-only inspection of the listed handoff and safety documentation.
- Confirmed from docs that the current requested deploy slice is UI/statistics/settings only and that Phase 3.66 did not enable Legacy live reads, live bot control, or live bot mutation.
- Confirmed from docs that Legacy non-mock remains blocked by B3/plaintext-key risk and missing safety gates.
- Confirmed from docs that Phase 3.65 Tortila canary acceptance is DB-backed read-only and live controls remain disabled.

Gates NOT RUN in this auditor lane:
- SSH, Docker, systemd, nginx, DB, provider, exchange, browser, Playwright, curl, service, deploy, and live environment checks: not run by explicit scope.
- Product code inspection or edits: not run by explicit scope.
- `npm test`, typecheck, lint, build, `secret:scan`, `governance:check`, and CI: not run because this lane is a docs-only safety auditor pass.
- Legacy authenticated API acceptance: not run and remains blocked.
- Live bot start/stop/apply-config: not run and remains forbidden.
- Provider-side Legacy credential-safe endpoint acceptance: not run.
- Provider-side journal bearer-auth acceptance: not run in this lane.

Post-deploy evidence required from the deploy/test lane:
1. Canary pages for bot statistics/settings render the new UI and keep live controls absent or disabled.
2. Legacy pages remain reference/operational only, with no authenticated Legacy API calls and no live apply.
3. Tortila pages still show DB-backed read-only canary data and do not consume write/control endpoints.
4. Existing live bots remain alive after deploy: Legacy tmux/process and Tortila bot/journal services are still active according to redacted operational checks.
5. `wtc-bot-api-firewall.service` remains active and external probes still do not expose bot API ports.
6. WTC canary/worker health and DB snapshot freshness remain acceptable for Tortila read-only canary.
7. Retained logs/artifacts/screenshots/docs contain no secrets, tokens, DB URLs, cookies, exchange keys, or raw provider payloads.
8. Access control remains fail-closed: only entitled users can reach bot surfaces, and admin/support surfaces keep their RBAC boundaries.

Rollback or halt triggers:
1. Any live bot service stops, restarts unexpectedly, loses expected health, or shows deploy-induced mutation.
2. `FEATURE_LIVE_BOT_CONTROL` becomes true, start/stop/apply-config controls become enabled, or control routes/actions are reachable.
3. Legacy non-mock adapter, `LEGACY_BOT_BASE_URL`, `/auth/login`, or `/api_management/*` becomes active in the canary path.
4. Firewall state for ports `8000` or `8080` is missing, disabled, flushed, or externally reachable.
5. Tortila data path shifts from WTC DB snapshots/imports to direct user-page live journal probing.
6. Any secret, token, DB URL, cookie, exchange key, Telegram token, or provider payload appears in logs, docs, screenshots, retained artifacts, or API responses.
7. Canary auth/access checks fail open or bot entitlements no longer act as the only source of access truth.
8. DB snapshot freshness or worker health regresses enough that the UI presents stale data as current.

## Next actions
1. Deploy the bot analytics/settings UI slice only after the deploy lane restates the disabled-feature and no-live-mutation constraints.
2. Collect the post-deploy evidence listed above in a deploy/test handoff with exact gates run and not run.
3. Keep Legacy real adapter remediation as a separate phase requiring upstream key-free read endpoints, service-account/vault handling, firewall proof, redaction tests, and written security acceptance.
4. Keep live bot control as a separate phase until all `BOT_CONTROL_SAFETY_MODEL` gates are green and documented.
5. If any rollback trigger appears, stop the slice, preserve redacted evidence, and route rollback through the existing WTC canary/preview rollback plan without touching live bot runtime controls.
