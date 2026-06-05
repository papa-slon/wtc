# phase-471-runtime-deploy-auth-firewall-prep-auditor handoff
## Scope
Read-only prep audit for the next Tortila runtime deploy/auth/firewall phase. The audit inspected current WTC docs, handoffs, contracts, runner scripts, env validation, adapter boundaries, and worker monitoring paths. It did not edit files, SSH, restart services, call endpoints, read/print secrets, query DB/runtime state, or touch exchange/live-control paths.

## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/handoffs/20260606-0542-phase-470-tortila-canonical-source-landing.md`
- `docs/handoffs/20260606-0440-tortila-source-perimeter-auditor.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `scripts/run-tortila-real-read-managed.mjs`
- `scripts/tortila-canonical-source-verifier.mjs`
- `packages/config/src/env.ts`
- `packages/bot-adapters/src/http.ts`
- `apps/worker/src/index.ts`
- `package.json`

## Files changed
None — read-only audit

## Findings
1. Severity: P0. Strict canonical managed proof is mandatory before runtime deploy. Recommendation: stop before server work if strict proof fails. Target part: WTC managed proof.
2. Severity: P0. Canonical Tortila source exists, but runtime auth/firewall/deploy remains unproven. Recommendation: use source as deploy input, not runtime proof. Target part: source/runtime boundary.
3. Severity: P0. Production-like real adapter mode must be token+URL+firewall gated. Recommendation: deploy token middleware, configure WTC worker token+URL, then prove missing/wrong/correct token behavior without printing secrets. Target part: auth boundary.
4. Severity: High. Runtime perimeter needs fresh post-deploy proof. Recommendation: capture server-local allowed probes and external/non-allowlisted timeout/refusal after middleware is deployed. Target part: firewall/private-network proof.
5. Severity: High. Bot continuity is the main safety invariant. Recommendation: baseline PIDs/start times/`NRestarts` before mutation; do not restart `turtle-bot.service`; stop if its PID changes unexpectedly. Target part: bot continuity.
6. Severity: High. The managed runner’s safety model is the hard stop/go gate, not a narrative checklist. Recommendation: proceed to runtime phase only after strict proof passes. Target part: acceptance proof.

## Decisions
- Runtime deploy/auth/firewall should be a separate phase after strict proof is green.
- WTC remains read-only for bot data.
- Do not use adjacent or server runtime folders as source authority.

## Risks
- Exposing `:8080` before firewall proof could leave a public auth-gated surface.
- Restarting `turtle-bot.service` would violate the safety boundary.
- Worker env/token changes before journal auth is live can degrade worker reads.

## Verification/tests
RUN:
1. Read-only docs/contracts/handoffs inspection.
2. Read-only runner/env/adapter/worker code inspection.

NOT RUN:
1. SSH/server metadata refresh, endpoint probes, DB/runtime mutation, service/container restart, secret read/print, exchange/provider/live-control calls.

## Next actions
1. Runtime phase preflight: launch read-only agents, baseline PIDs/restarts, worker continuity, current runtime path, firewall rules, rollback path.
2. Stage canonical Tortila source in a versioned server release directory.
3. Provision `JOURNAL_READ_TOKEN` without printing it.
4. Restrict journal port before green claim.
5. Restart only the journal read service if required; do not restart `turtle-bot.service`.
6. Run redacted auth/perimeter probes and burn-in.
