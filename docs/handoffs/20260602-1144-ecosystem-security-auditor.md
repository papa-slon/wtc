# ecosystem-security-auditor handoff

## Scope
Read-only Phase 3.47 security assessment for active real-Postgres auth/account proof readiness. No files edited, no secrets
printed, no live services or DBs mutated by this auditor.

## Files inspected
`tests/integration/db-real-postgres.test.ts`; `tests/integration/db-axioma-jti.test.ts`; `docs/DEPLOYMENT.md`;
`docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/PRODUCTION_BLOCKERS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`;
`docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `package.json`; `scripts/gates.mjs`; `.secretlintrc.json`; `.secretlintignore`;
`.env.example`; `scripts/scan-lms-db-e2e-artifacts.mjs`; prior Phase 3.46 handoffs.

## Files changed
None - read-only audit.

## Findings
1. HIGH - `REAL_POSTGRES_DATABASE_URL` must not be set until the operator has a fresh empty throwaway DB whose pathname is
   exactly `wtc_test` or matches `wtc_test_<suffix>`. Recommendation: never use preview, production, or persistent dev DBs.
2. HIGH - Active auth/account real-PG proof is currently NOT RUN in this shell because `REAL_POSTGRES_DATABASE_URL` is absent.
   Recommendation: do not report green until DB-mutating tests run and pass.
3. HIGH - Run only the focused harness after setting the variable. Another opt-in real-PG suite keys off the same env var, so
   broad `npm test` increases blast radius.
4. MEDIUM - Old raw-IP preview B1 evidence is not the current auth/account race proof. Recommendation: keep production blocker
   wording until fresh `wtc_test*` evidence exists.
5. MEDIUM - Evidence must stay redacted: no full URLs, credentials, passwords, `SESSION_SECRET`, `SECRET_VAULT_KEK`, cookies,
   tokens, or raw env dumps.

## Decisions
Do not set `REAL_POSTGRES_DATABASE_URL` in this read-only lane. Treat active proof as NOT RUN until operator supplies fresh
`wtc_test*` credentials and the focused harness exits 0 without skipped active tests.

## Risks
The DB-name guard proves pathname class, not freshness. Leaving `REAL_POSTGRES_DATABASE_URL` in the shell can activate other
opt-in real-PG tests. A default passing run can be misreported as acceptance.

## Verification/tests
RUN: read-only inspection; boolean env presence check only.

NOT RUN: active `REAL_POSTGRES_DATABASE_URL` harness, `npm run secret:scan`, full gates, preview/prod DB mutation, live server
mutation, live bot mutation, CI in this lane.

## Next actions
1. Use a managed runner or operator-created fresh `wtc_test_<suffix>` DB.
2. Preserve redacted evidence only: focused command shape, active PASS count, skipped count, and target DB class.
3. Clear the env var and drop the throwaway DB after the run.
