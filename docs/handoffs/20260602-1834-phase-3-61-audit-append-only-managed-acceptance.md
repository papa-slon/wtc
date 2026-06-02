# Phase 3.61 audit append-only managed acceptance handoff
## Scope
Run one local credentialed DB-role acceptance gate: append-only `audit_logs` proof through a generated throwaway database and temporary restricted role, using the operator-identified local existing-bot Postgres settings from `C:\Users\maxib\GTE BOT\bot\.env` without printing credential values.

This phase added a managed wrapper around the existing direct `npm run accept:audit:append-only-role` preflight. The wrapper creates a fresh `wtc_test_audit_*` database, applies migrations, creates a temporary `wtc_app_role_*` role, grants only `SELECT`/`INSERT` on `public.audit_logs`, runs the direct preflight, and drops both generated resources.

Out of scope: direct production/preview intended-role proof, live object storage, live external scanner, Stripe, Axioma live acceptance, preview/live smoke, SSH/nginx/systemd, bot service control, deploy, GitHub CI, root full test suite, and production monitoring.

## Agents
- [`docs/handoffs/20260602-1830-ecosystem-security-auditor.md`](20260602-1830-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1829-ecosystem-tests-runner.md`](20260602-1829-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1831-ecosystem-devops-implementer.md`](20260602-1831-ecosystem-devops-implementer.md)

All spawned agents were closed before final reporting.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/DEPLOYMENT.md`, `docs/AUDIT_LOG_SCHEMA.md`, `package.json`, `scripts/audit-append-only-role-preflight.mjs`, `scripts/run-audit-append-only-role-managed.mjs`, `scripts/redacted-child-process.mjs`, `tests/integration/audit-append-only-role-preflight.test.ts`, `tests/integration/audit-append-only-role-managed-runner-safety.test.ts`, `packages/db/src/schema.ts`, `packages/db/migrations/*.sql`, and adjacent bot `.env` key names/status only.

## Files changed
- `scripts/run-audit-append-only-role-managed.mjs`
- `package.json`
- `tests/integration/audit-append-only-role-managed-runner-safety.test.ts`
- `docs/handoffs/20260602-1830-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1829-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1831-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1834-phase-3-61-audit-append-only-managed-acceptance.md`
- status docs updated for Phase 3.61

## Findings
1. Severity: High. Direct `npm run accept:audit:append-only-role` cannot be run from the existing bot admin source as-is because the direct preflight requires a restricted app-role URL and refuses admin-looking users. Fix: added `npm run accept:audit:append-only-role:managed` for local throwaway proof with a generated restricted role.
2. Severity: High. The first managed run created and dropped `wtc_test_audit_20260602113036_6c10be` but failed before the direct preflight because PostgreSQL utility syntax does not accept a prepared placeholder for `CREATE ROLE ... PASSWORD`. Fix: the runner now validates generated identifiers/literals before using `unsafe()` only for that utility command.
3. Severity: High. The final managed run created `wtc_test_audit_20260602113142_0aa15f`, applied `17` migrations, created temporary role `wtc_app_role_20260602113142_97bf21`, proved `select=true insert=true update=false delete=false truncate=false probe=inserted`, and dropped both the generated DB and role. This clears local throwaway append-only audit role proof.
4. Severity: Medium. The managed proof uses a generated temporary role, not the real production/preview `wtc_app_role`. The production/preview intended-role proof remains NOT RUN until the direct preflight passes against the intended target.
5. Severity: Medium. PostgreSQL emitted NOTICE messages about long generated identifier truncation during migration application. The preflight still completed and cleanup succeeded; these notices are recorded as observed output, not a failing gate.

## Decisions
- Treat `npm run accept:audit:append-only-role:managed` as RUN/PASS only from the final managed throwaway run after the `CREATE ROLE` utility quoting fix.
- Keep the first failed managed run as debugging evidence, not acceptance evidence.
- Continue reporting direct production/preview append-only role proof and all provider/server/CI gates as NOT RUN.
- Do not claim git/branch/PR/GitHub CI readiness because this root is not git-backed.

## Risks
- The existing bot Postgres credential is powerful enough to create/drop databases and roles; future phases must remain single-purpose and values-hidden.
- A hard process kill during a managed run could leave orphan `wtc_test_audit_*` databases or `wtc_app_role_*` roles; normal failure cleanup worked in both observed runs.
- This phase proves local generated-role permissions only. It does not prove the intended production/preview restricted role, provider acceptance, server deployment, GitHub CI, or production monitoring.

## Verification/tests
| Gate | Command | Result |
|---|---|---|
| Required protocol/docs read | `Get-Content`/`rg` over protocol, blocker, acceptance, and runbook files | PASS |
| Git root truth | `git rev-parse --show-toplevel` | NOT GIT-BACKED |
| Adjacent bot Postgres key presence | key-name-only parse of `C:\Users\maxib\GTE BOT\bot\.env` | PASS; values not printed |
| Managed runner syntax | `node --check scripts\run-audit-append-only-role-managed.mjs` | PASS |
| Focused audit runner tests | `npm test -- tests/integration/audit-append-only-role-preflight.test.ts tests/integration/audit-append-only-role-managed-runner-safety.test.ts` | PASS; `16` tests passed |
| Audit append-only managed proof, first attempt | `npm run accept:audit:append-only-role:managed` with in-process admin URL from `bot\.env` | FAIL; generated DB `wtc_test_audit_20260602113036_6c10be` created/dropped; failed at `CREATE ROLE ... PASSWORD` utility syntax |
| Audit append-only managed proof, final attempt | `npm run accept:audit:append-only-role:managed` with in-process admin URL from `bot\.env` | PASS; DB `wtc_test_audit_20260602113142_0aa15f` and role `wtc_app_role_20260602113142_97bf21` created/dropped; preflight proved SELECT/INSERT only |
| Root typecheck | `npm run typecheck` | PASS |
| Web typecheck | `npm run typecheck -w @wtc/web` | PASS |
| Root lint | `npm run lint` | PASS |
| Secret scan | `npm run secret:scan` | PASS |

Gates NOT RUN: direct `npm run accept:audit:append-only-role` against intended production/preview role, `npm run preview:safe`, default `npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, root `npm test`, `npm run build -w @wtc/web`, LMS DB browser rerun, real-PG managed rerun, live LMS object-store preflight, live LMS external-scanner preflight, real Stripe checkout/webhook replay, live Axioma endpoint/account-link/download acceptance, preview/prod DB migration or seed, SSH/nginx/systemd/server checks, bot services/control, GitHub CI execution, deploy, and production monitoring.

## Next actions
1. Run final governance check after this handoff exists.
2. Update blocker/status docs so local managed audit append-only role proof is cleared while production/preview intended-role proof stays NOT RUN.
3. Next single-purpose phase should be one of: live LMS object-store, live LMS external scanner, Stripe, Axioma, preview smoke/e2e/build, GitHub CI, or deploy/server checks.
