# Audit append-only role preflight handoff
## Scope
This handoff records the operator-safe acceptance path for PostgreSQL-level append-only `audit_logs` enforcement and reconciles the current docs/test truth. The phase did not run production/preview DB permission proof because no restricted app-role URL was supplied and no live DB mutation was approved.

## Files changed
- `scripts/audit-append-only-role-preflight.mjs`
- `package.json`
- `.env.example`
- `tests/integration/audit-append-only-role-preflight.test.ts`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/DATA_MODEL.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY_MODEL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/handoffs/20260602-1225-*.md`

## Findings
1. High. Production append-only audit DB-role proof remains NOT RUN. Evidence: `npm run accept:audit:append-only-role` now exists but requires operator-provided `AUDIT_APPEND_ONLY_DATABASE_URL` and explicit `AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1`. Recommendation: run only against the intended restricted app role and report RUN only from observed pass. Target part: production permission gate.
2. High. The restricted role must be non-elevated and not own `public.audit_logs`. Evidence: the preflight checks superuser/createdb/createrole/replication/bypassrls flags and table ownership before insert. Recommendation: keep these checks in the acceptance path. Target part: DB role safety.
3. Medium. Role naming is now standardized on `wtc_app_role` in the preflight examples and docs touched this phase. Recommendation: keep any future operator SQL aligned unless a deployment-specific override is documented. Target part: docs truth.
4. Medium. Default local gates must not be represented as production DB permission proof. Evidence: the new command stays out of `ci:local` and `scripts/gates.mjs`. Recommendation: keep acceptance gates explicit and RUN/NOT RUN separately reported. Target part: gate taxonomy.
5. Low. Additional unrelated safety cleanups remain: managed real-PG unknown-argument refusal, `scripts/gates.mjs` invalid-mode help, and raw preview URL hygiene. Recommendation: handle in separate bounded phases. Target part: follow-up hardening.

## Decisions
The permission proof is an operator preflight/runbook boundary, not a Drizzle migration. The command writes one safe `system.health_check` row only after explicit acceptance, and by default it refuses non-`wtc_test*` databases. For approved preview/staging/production targets, the operator must set `AUDIT_APPEND_ONLY_PREFLIGHT_NON_THROWAWAY_APPROVED=1` for that run.

## Risks
The actual production DB role may still be over-privileged until the preflight is run with the intended credentials. If an operator supplies an admin/owner role, the preflight refuses obvious admin-looking users and elevated/table-owner status, but production readiness still depends on testing the exact runtime DB role.

## Verification/tests
RUN:
- `node --check scripts/audit-append-only-role-preflight.mjs` PASS
- `npm run accept:audit:append-only-role -- --help` PASS
- missing-accept refusal PASS (expected non-zero before DB mutation)
- invalid-URL refusal PASS (expected non-zero before DB mutation)
- admin-looking URL user refusal PASS (expected non-zero before DB mutation)
- non-throwaway DB refusal PASS (expected non-zero before DB mutation)
- `npm test -- tests/integration/audit-append-only-role-preflight.test.ts` PASS (`9` passed)
- `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift)
- `npm run governance:check` PASS (0 errors / 1 known warning; 5 cited per-agent handoffs all present)
- `npm run secret:scan` PASS
- `node scripts/gates.mjs full` PASS (9/9)

NOT RUN:
- `npm run accept:audit:append-only-role` against a real restricted app-role URL (no operator URL supplied)
- active managed real-PG proof (`REAL_POSTGRES_ADMIN_DATABASE_URL` not supplied)
- production DB rollout/live deploy
- production nginx/shared-store auth throttling
- GitHub CI (workspace is not a git repo)
- live server, live bot, Stripe, Axioma, LMS object-store/scanner, or production monitoring gates

Per-agent handoffs cited:
- [`docs/handoffs/20260602-1225-ecosystem-security-auditor.md`](20260602-1225-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1225-ecosystem-db-architect.md`](20260602-1225-ecosystem-db-architect.md)
- [`docs/handoffs/20260602-1225-ecosystem-devops-implementer.md`](20260602-1225-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1225-ecosystem-tests-runner.md`](20260602-1225-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1225-ecosystem-platform-architect.md`](20260602-1225-ecosystem-platform-architect.md)

All current-phase agents were collected and closed before final reporting. A stale pre-existing agent from a prior registration-audit phase was also closed.

## Next actions
1. Run `npm run accept:audit:append-only-role` only after the operator supplies the intended restricted `wtc_app_role` database URL.
2. Run `npm run accept:real-pg:managed` after the operator supplies `REAL_POSTGRES_ADMIN_DATABASE_URL`.
3. In a separate bounded phase, fix managed real-PG unknown-argument refusal and `scripts/gates.mjs` invalid-mode help.
4. In a separate bounded phase, decide whether raw preview URL exposure is approved or should move to operator-only config.
