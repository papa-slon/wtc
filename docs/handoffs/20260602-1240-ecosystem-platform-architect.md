# ecosystem-platform-architect handoff
## Scope
Read-only Phase 3.50 platform audit for bounded local safety cleanup: managed real-PG runner unknown-argument refusal and `scripts/gates.mjs` invalid-mode help truth.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `package.json`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/gates.mjs`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `tests/integration/db-real-postgres.test.ts`, recent Phase 3.47 and 3.49 handoffs.

## Files changed
None - read-only audit.

## Findings
1. Medium. The phase should stay limited to scripts, focused tests, and docs truth. Recommendation: no live DB, migrations, app routes, or product code. Target part: phase scope.
2. Medium. Managed real-PG unknown-arg refusal must happen before DB setup. Recommendation: add focused regression coverage. Target part: runner safety tests.
3. Low. `gates.mjs` invalid-mode help should list all modes and stay aligned with `PLANS`. Recommendation: generate from `Object.keys(PLANS)` or statically test it. Target part: gate-runner help truth.
4. High. Do not claim active real-PG or production DB proof from syntax/help/refusal checks. Recommendation: keep proof gates NOT RUN until credentials and active harness passes exist. Target part: gate claims.
5. Low. Help-first CLI behavior is consistent with existing preflight scripts; no change required unless stricter CLI semantics are explicitly desired. Target part: CLI consistency.

## Decisions
No migrations, runtime package logic, app routes, live server mutation, bot mutation, or live DB action are needed. `node scripts/gates.mjs full` remains separate from e2e and active real-PG acceptance.

## Risks
Default real-PG Vitest can pass with DB-mutating tests skipped. The workspace is not git-backed, so no CI/commit claim should be made.

## Verification/tests
RUN by auditor: syntax/help/refusal checks and read-only inspection. NOT RUN by auditor: active managed real-PG, manual real-PG harness, db:migrate, db:seed, full gates, e2e, production/preview DB proof, live deploy.

## Next actions
1. Add focused tests for managed real-PG unknown-arg refusal and gates invalid-mode help truth.
2. Keep active real-PG and production proofs explicitly NOT RUN.
