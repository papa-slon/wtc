# source-truth-implementation-planner handoff
## Scope
Read-only Phase 4.69 implementation planning after Phase 4.67 UI polish and Phase 4.68 canary deploy. The planner selected the next non-looping implementation slice that advances the two-bot objective without live control or fabricated analytics.

## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/handoffs/20260606-0356-phase-468-canary-deploy-3aff273.md`
- Bot adapter/worker source references named in those docs

## Files changed
None - read-only audit.

## Findings
1. Severity: High. The next non-looping implementation slice is a Tortila canonical source verifier. Evidence: Phase 4.68 deployed current UI/product work; Legacy realized analytics remains source-blocked; Tortila has local real-read/token proof but lacks canonical git-backed source and production auth/firewall proof. Recommendation: implement a WTC verifier that proves a supplied source root is canonical and token-gated before managed proof runs. Target part: Tortila source gate.
2. Severity: High. Legacy importer work remains premature. Evidence: `docs/CONTRACTS/legacy-bot-adapter.md` still states no closed-trade history endpoint; Legacy server audit confirms no durable source. Recommendation: do not implement importer or realized stats until a real source packet exists. Target part: Legacy analytics.
3. Severity: Medium. Admin boundaries must remain read-only for selected-user bot profiles. Evidence: existing docs keep admin selected-user drilldown inspection-only and system defaults separate from user-owned configs. Recommendation: source verifier work should not touch admin/user config mutation semantics. Target part: admin/user ownership.

## Decisions
- Implement `verify:tortila:canonical-source` plus strict managed-runner integration.
- Do not edit Tortila/Legacy runtime, live controls, exchange pings, `/api/marks`, or `/api/overview`.
- Do not change adapter mappings unless canonical source shape differs later.

## Risks
- Without a strict verifier, future acceptance can accidentally use adjacent `../bot_tortila` and overclaim canonical source readiness.
- Without source packets, repeated UI/docs polish can look like progress while leaving production gates unchanged.

## Verification/tests
RUN:
1. Read-only source/docs planning pass - PASS.

NOT RUN:
1. SSH, tests/build/lint, file edits, service mutations, live probes - intentionally skipped in planner scope.

## Next actions
1. Add the canonical-source verifier and tests.
2. Document that current adjacent/runtime Tortila sources fail the canonical verifier.
3. Keep the managed real-read runner compatible with local fixture mode, but require the verifier when `TORTILA_CANONICAL_SOURCE_REQUIRED=1`.
