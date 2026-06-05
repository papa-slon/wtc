# phase-470-non-looping-risk-planner handoff
## Scope
Read-only Phase 4.70 risk/planning audit for the next implementable WTC phase after Phase 4.69. The audit reviewed current docs, recent handoffs, blockers, contracts, and verifier/runner scripts. No files were edited by the agent, no services restarted, no DB/runtime was mutated, no secrets were printed, and no exchange/provider calls were made.

## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260606-0440-phase-469-tortila-canonical-source-verifier.md`
- `docs/handoffs/20260606-0440-tortila-source-perimeter-auditor.md`
- `docs/handoffs/20260606-0440-legacy-closed-trade-server-auditor.md`
- `docs/handoffs/20260606-0440-source-truth-implementation-planner.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- `package.json`
- `scripts/tortila-canonical-source-verifier.mjs`
- `scripts/run-tortila-real-read-managed.mjs`

## Files changed
None — read-only audit

## Findings
1. Severity: P0. The next non-looping implementable phase is Tortila canonical source landing plus strict proof, not UI polish. Recommendation: focus on a clean git-backed Tortila source packet. Target part: Tortila source gate.
2. Severity: P0. Production token/firewall probing is premature until canonical source passes. Recommendation: first prove token middleware/tests in canonical source, then run a separate runtime deploy/probe phase. Target part: Tortila production auth/perimeter.
3. Severity: P0. Legacy realized analytics/import remains blocked by absent source, not WTC destination readiness. Recommendation: do not build importer/realized PnL until a real source exists. Target part: Legacy closed-trade analytics.
4. Severity: High. Current canary is healthy but does not clear full production/live-control gates. Recommendation: continue passive monitoring and avoid conflating canary health with source/prod readiness. Target part: ops release boundary.
5. Severity: High. A new implementation phase must dispatch read-only agents before edits and list exact RUN/NOT RUN gates. Recommendation: keep the governance chain intact. Target part: governance.

## Decisions
- Recommend a Tortila canonical source landing phase.
- Defer Legacy importer work until a real closed-trade source exists.
- Defer production token deployment/firewall probes until canonical source proof passes.
- Defer live control entirely.

## Risks
- Initializing a repo from adjacent source without cleanup could create false authority.
- Runtime probes before token middleware deployment would create misleading evidence.
- Any Legacy importer built from active orders/slots would fabricate statistics.

## Verification/tests
RUN:
1. Read-only status/docs/script inspection.

NOT RUN:
1. Tests/build/lint/typecheck, SSH, endpoint curls, DB queries/writes, deploys, restarts, exchange calls.

## Next actions
1. Land a clean git-backed Tortila source packet.
2. Run WTC canonical verifier.
3. Run strict managed proof only with a disposable DB lane.
4. Stop before runtime deployment and handle deploy/auth/firewall as a separate phase.
