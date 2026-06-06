# production-domain-readiness-auditor handoff
## Scope
Phase 4.75 read-only production/branded-domain readiness audit for the current WTC canary. Scope was limited to repository docs, current handoffs, deployment docs, environment contracts, and local git state. No live server, DNS, TLS, nginx, Docker, systemd, firewall, DB, tmux, bot, exchange, provider-console, env-file, raw-log, or raw-row check was performed in this lane.

No raw host/IP, env value, DSN, token, secret, cookie, raw DB row, or full raw log body is retained here. Server references are limited to `<wtc-canary-host>`, service names, release labels, routes, and redacted status/count evidence already recorded in prior handoffs.

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
- `.env.example`
- `docker-compose.yml`
- `packages/config/src/env.ts`
- `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md`
- `docs/handoffs/20260606-0905-canary-deploy-preflight-auditor.md`
- `docs/handoffs/20260606-0905-canary-security-perimeter-auditor.md`
- `docs/handoffs/20260606-0909-runtime-continuity-auditor.md`
- `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md`
- Local handoff listing and `git status --short --branch`

## Files changed
- `docs/handoffs/20260606-1000-production-domain-readiness-auditor.md` (this handoff only)

## Findings
1. Severity: P0. The existing WTC HTTPS canary is proven for the exact current WTC app/worker release, but only in canary scope. Evidence: `docs/STATUS.md:4`-`20` records the `abe6784518abcbebe38368f3cef05039d55c520f` canary deploy, local/public smoke, five short burn-in cycles, unchanged bot services, and explicit exclusions; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:101`-`133` lists the gates RUN and NOT RUN; `docs/IMPLEMENTED_FILES.md:3`-`13` preserves the same canary-only truth. Recommendation: treat Phase 4.74 as RUN/PASS for the existing WTC canary app/worker only, not branded/full production. Target part: release truth.

2. Severity: P0. Branded-domain DNS/TLS/nginx target is not proven. Evidence: `docs/DEPLOYMENT.md:585`-`592` defines the production nginx domain/TLS step as a separate approval-gated rollout phase; `docs/DEPLOYMENT.md:645`-`647` says production server deployment and production nginx/domain/TLS cutover are NOT RUN; `docs/NEXT_ACTIONS.md:151`-`158` says full production/branded-domain rollout is NOT RUN and still needs branded target host/domain, DNS/TLS cutover, smoke routes, firewall/proxy probes, monitoring window, and rollback data. Recommendation: require an operator production-domain packet before any cutover: branded domain, DNS owner/TTL plan, TLS issuance/renewal method, nginx server-block target, upstream service/port mapping by service name, and exact public smoke routes. Target part: DNS/TLS/nginx.

3. Severity: P0. Public smoke is proven for the existing canary target, not for the future branded domain. Evidence: `docs/STATUS.md:11`-`14` and `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:112`-`115` record `/api/health`, `/`, `/login`, and `/products` as `200` on the current canary with protected bot/admin redirects; `docs/NEXT_ACTIONS.md:152` says branded rollout remains NOT RUN. Recommendation: for branded production, rerun public smoke against the branded hostname and record only route/status/header categories with the host redacted as `<wtc-canary-host>` until the operator approves public naming. Target part: public smoke.

4. Severity: P0. Internal bot-port perimeter is partially proven for canary from workstation-vantage negative probes, but not revalidated in this Phase 4.75 audit and not equivalent to provider-console/security-group proof. Evidence: `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md:41` and `:69` record public TCP negative probes for internal bot/service ports as PASS from the workstation vantage; `docs/handoffs/20260606-0728-phase-472-tortila-runtime-auth-firewall.md:76` says cloud-provider security-group console audit or VPN/private-network proof was NOT RUN; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:95`-`98` says public TCP negative probes were not rerun after the WTC switch and provider-console proof remains required. Recommendation: branded/full production must rerun external negative probes and separately capture provider-console/security-group proof without exposing raw coordinates. Target part: network perimeter.

5. Severity: P0. Provider-console/security-group proof remains open. Evidence: `docs/STATUS.md:18`-`20`, `docs/STATUS.md:54`-`56`, and `docs/PRODUCTION_BLOCKERS_CURRENT.md:18`-`21` all preserve provider-console perimeter proof as a remaining blocker after current canary gates. Recommendation: operator must provide cloud/provider-console access or a redacted export/screenshot package proving inbound rules, private-network posture, and expected public listeners before calling production perimeter green. Target part: provider perimeter.

6. Severity: P1. Rollback is defined for the current WTC canary app/worker, but a branded-domain/full-production rollback plan is not yet proven. Evidence: `docs/DEPLOYMENT.md:15`-`24` records current canary web/worker rollback and the latest historical pre-migration backup; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:76`-`80` names the current canary release and immediate WTC rollback release; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:130`-`133` says no new DB backup, provider-console proof, branded-domain cutover, long burn-in, or credentialed provider acceptance ran in Phase 4.74. Recommendation: branded production needs a rollback runbook covering WTC release rollback, nginx/domain rollback, DNS TTL/cutback, and DB backup/restore conditions before cutover. Target part: rollback.

7. Severity: P1. Monitoring/alerting is not production-complete. Evidence: `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:115`-`118` proves five short burn-in cycles; `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:97`-`98` says full production/branded-domain acceptance still requires a longer monitoring window; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:140`-`150` says current gates do not clear full branded/live-provider production readiness. Recommendation: define and run a long burn-in/alerting gate with WTC health, worker continuity, restart counts, protected-route behavior, alert delivery, and operator acknowledgement. Target part: observability.

8. Severity: P1. Secret provisioning requirements are documented and fail-closed in code, but full branded-production secret provisioning is not proven. Evidence: `docs/DEPLOYMENT.md:27`-`31` says Phase 4.74 reused existing server-side canary env files without printing values; `docs/DEPLOYMENT.md:606`-`616` lists required production secret/config names and fail-closed bot adapter requirements; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:75`-`119` lists remaining credentialed gates and required operator inputs; `packages/config/src/env.ts:81`-`124` and `:170`-`202` enforce production-like config failures for weak/missing secrets and provider prerequisites. Recommendation: branded production must provide a secret provisioning method by name only, verify key presence/shape without printing values, and run each credentialed provider gate separately. Target part: secret provisioning.

9. Severity: P1. DB migration/backup policy exists, but full production DB migration/backup/restore acceptance remains open. Evidence: `docs/handoffs/20260606-0918-phase-474-canary-deploy-abe6784.md:65`-`69` says the Phase 4.74 release had no DB migration/package-lock changes and `db:migrate` was a safety check; `docs/DEPLOYMENT.md:596`-`604` requires `pg_dump` before any production migration and restore plus prior build for rollback; `docs/DEPLOYMENT.md:582`-`583` and `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:115` say intended append-only audit-role proof is not RUN unless the command completes against the intended database role/target. Recommendation: before branded production, require a migration diff decision, backup artifact, restore plan, seed approval decision, and intended restricted-role proof. Target part: DB migration/backup.

10. Severity: P1. Required operator inputs are not complete for branded/full production. Evidence: `docs/NEXT_ACTIONS.md:152` and `:158` state full branded rollout needs branded target, DNS/TLS, longer burn-in, provider/live gates, rollback plan, DB migration/seed approval, secret provisioning method, smoke routes, firewall/proxy probes, and monitoring window; `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:110`-`119` lists still-NOT-RUN intended role, object-store/scanner, Stripe, and Axioma gates. Recommendation: do not start a production cutover session until the operator supplies the production-domain packet and chooses which credentialed provider gates are in scope. Target part: operator inputs.

## Decisions
- Treated this as a single read-only auditor handoff; no N-agent audit claim is made.
- Did not run live DNS, TLS, curl, SSH, nginx, Docker, systemd, firewall, DB, tmux, bot, provider-console, or raw-log checks in Phase 4.75. Current docs/handoffs already prove the canary scope and clearly mark branded/full-production gaps.
- Did not inspect or print server env files, raw logs, raw DB rows, DSNs, tokens, cookies, or raw host/IP coordinates.
- Current local worktree had pre-existing changes before this handoff write: `docs/DEPLOYMENT.md` modified and `tests/integration/deployment-release-build-static.test.ts` untracked. This auditor did not touch them.
- Current verdict: existing WTC canary app/worker is proven in its stated scope; full branded-domain production readiness is NOT RUN / NOT CLEARED.

## Risks
- Live canary state may drift after Phase 4.74; this audit did not refresh live state.
- Workstation-vantage negative probes are useful canary evidence but can miss cloud security-group, private-network, or provider-console misconfiguration.
- A branded-domain cutover can fail independently of canary health through DNS, TLS issuance, nginx server-block, cookie-domain, HSTS, cache, or redirect behavior.
- Reusing the canary rollback label is insufficient for production if a future phase changes DB schema, nginx/domain routing, DNS, or provider secrets.
- Raw logs/env/DB rows are intentionally excluded, so future acceptance needs redacted summaries and artifact scans rather than broad dumps.

## Verification/tests
RUN:
1. Protocol and governance inspection - PASS; `AGENTS.md` and `docs/SESSION_PROTOCOL.md` read for read-only, handoff, and gates RUN/NOT RUN rules.
2. Current handoff chain inspection - PASS; Phase 4.74 aggregate plus deploy preflight, security/perimeter, runtime-continuity, and Phase 4.72 auth/firewall handoffs inspected.
3. Current deployment/status/blocker docs inspection - PASS; `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, and `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md` inspected.
4. Environment/secret contract inspection - PASS; `.env.example` and `packages/config/src/env.ts` inspected with values redacted.
5. Local worktree check - PASS; `git status --short --branch` observed branch `codex/phase-475-production-readiness` and pre-existing local changes before this handoff write.

NOT RUN:
1. Live DNS/TLS/nginx checks - NOT RUN; no branded-domain packet or approved target verification was supplied for this read-only auditor.
2. Public branded-domain smoke - NOT RUN; no branded production domain/cutover exists in the inspected evidence.
3. Live canary SSH/curl refresh - NOT RUN; this lane relied on current Phase 4.74 docs/handoffs and avoided raw coordinates.
4. Internal bot-port negative probes after Phase 4.74 - NOT RUN in this audit; latest evidence is Phase 4.72 workstation-vantage proof, and provider-console proof remains separate.
5. Provider-console/security-group/private-network proof - NOT RUN; requires operator/provider access or redacted provider evidence.
6. Production DB migration, seed, backup, restore, or intended append-only role proof - NOT RUN; would require approved target credentials and potential mutation.
7. Secret provisioning validation - NOT RUN; no env files or secret stores were read.
8. Long burn-in/alerting/monitor delivery - NOT RUN; Phase 4.74 only proves five short canary cycles.
9. Stripe/Axioma/LMS live provider gates - NOT RUN; still require operator credentials/config and separate acceptance phases.
10. Live bot start/stop/restart/apply-config/test-connection, exchange ping, `/api/marks`, or `/api/overview` - NOT RUN; forbidden/out of scope.
11. Local npm tests/lint/build/secret scan - NOT RUN; this was a docs-only readiness audit and prior Phase 4.74/4.75 evidence review did not require code execution.

## Next actions
1. Operator supplies a branded-production packet with no secret values: branded hostname, DNS owner/TTL plan, TLS method, nginx target/upstream by service name, exact release SHA, rollback release, allowed services to touch, DB target/migration/seed decision, backup/restore policy, secret provisioning method, smoke routes, perimeter probes, monitoring window/alert recipients, and credentialed provider gates in scope.
2. Run a dedicated branded-domain readiness/cutover phase with read-only agents before mutation. Prove DNS, TLS, nginx, public smoke, protected-route redirects, cookie/security headers, external bot-port negative probes, provider-console/security-group rules, and rollback readiness before any broad production claim.
3. For DB-affecting production work, run migration diff review first; take `pg_dump` before DDL; prove restore/rollback path; run intended append-only audit-role acceptance against the approved target only with redacted output.
4. For secrets/providers, verify presence/shape only, never values; run Stripe, Axioma, LMS object-store/scanner, and any bot adapter gates as separate credentialed phases.
5. If branded smoke, perimeter, worker continuity, or alerting fails, roll back only the affected WTC/nginx/DNS layer according to the approved runbook; do not restart or control live bot services unless a separate audited recovery phase authorizes it.
