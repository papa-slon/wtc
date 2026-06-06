# phase-471-tortila-strict-proof-auditor handoff
## Scope
Read-only audit of the Phase 4.71 Tortila strict managed proof boundary using canonical Tortila source at `C:\Users\maxib\GTE BOT\tortila_canonical_source`. No files were edited by the agent, no secrets were printed, no exchange endpoints or live bot control paths were touched.

## Files inspected
- `package.json`
- `scripts/run-tortila-real-read-managed.mjs`
- `scripts/tortila-canonical-source-verifier.mjs`
- `scripts/redacted-child-process.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260606-0542-phase-470-tortila-canonical-source-landing.md`
- Canonical source git metadata plus journal app/test files

## Files changed
None — read-only audit

## Findings
1. Severity: P0. Canonical source identity is green, but source authority alone is not runtime proof. Recommendation: claim source-control/verifier pass only unless strict managed proof and runtime deploy probes also pass. Target part: Tortila source gate.
2. Severity: P0. Strict runner mode correctly blocks fallback to adjacent `../bot_tortila`. Recommendation: strict proof must always set both `TORTILA_CANONICAL_SOURCE_REQUIRED=1` and `TORTILA_REAL_READ_SOURCE_ROOT`. Target part: WTC runner source boundary.
3. Severity: High. The managed proof scope is local fixture -> localhost proxy -> throwaway WTC DB evidence only. Recommendation: after success, claim canonical local read-only ingestion only, not production deployment. Target part: proof scope.
4. Severity: High. Runner needed extra protection because URL validation did not enforce localhost before Phase 4.71. Recommendation: harden runner to reject non-local admin hosts. Target part: DB safety boundary.
5. Severity: Medium. WTC verifier is structural/read-only and does not itself run bot pytest/ruff or prove deployed runtime auth. Recommendation: keep runtime auth/firewall as a separate phase. Target part: claim discipline.

## Decisions
- Use Phase 4.71 to run strict proof and harden runner locality.
- Do not combine strict managed proof with server runtime mutation.

## Risks
- A non-local admin URL could create/drop DBs on a shared target if not rejected.
- Production deploy, token provisioning, firewall/private-network posture, and burn-in remain separate gates.

## Verification/tests
RUN:
1. Read-only WTC/canonical source git checks.
2. WTC canonical verifier PASS.
3. Strict runner preflight without admin URL refused before DB work.

NOT RUN:
1. Production deploy/auth/firewall probes, live controls, exchange/provider probes.

## Next actions
1. Run strict proof with a proven disposable local Postgres lane.
2. Harden runner locality before relying on future operator-supplied admin URLs.
3. Start runtime deploy/auth/firewall only after strict proof passes.
