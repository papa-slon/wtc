# Phase 3.60 existing-bot real-PG managed acceptance handoff
## Scope
Run one credentialed acceptance gate: active real-Postgres managed proof using the operator-identified local existing-bot Postgres settings from `C:\Users\maxib\GTE BOT\bot\.env`, without printing credential values. The gate was `npm run accept:real-pg:managed`, with `REAL_POSTGRES_ADMIN_DATABASE_URL` built only in-process from approved local fields.

Out of scope: LMS DB browser acceptance rerun, append-only audit DB-role proof, live S3/R2 object storage, live external scanner, Stripe, Axioma live acceptance, preview/live smoke, SSH/nginx/systemd, bot service control, deploy, GitHub CI, root full test suite, and production monitoring.

## Agents
- [`docs/handoffs/20260602-1757-ecosystem-security-auditor.md`](20260602-1757-ecosystem-security-auditor.md)
- [`docs/handoffs/20260602-1757-ecosystem-tests-runner.md`](20260602-1757-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1758-ecosystem-devops-implementer.md`](20260602-1758-ecosystem-devops-implementer.md)

All spawned agents were closed before final reporting.

## Files inspected
`AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, `docs/ACCEPTANCE_MATRIX_MASTER.md`, `docs/DEPLOYMENT.md`, `package.json`, `scripts/run-real-pg-harness-managed.mjs`, `scripts/redacted-child-process.mjs`, `tests/integration/db-real-postgres.test.ts`, `tests/integration/real-pg-managed-runner-safety.test.ts`, and adjacent bot `.env` key names/status only.

## Files changed
- `tests/integration/db-real-postgres.test.ts`
- `docs/handoffs/20260602-1757-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1757-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1758-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1802-phase-3-60-existing-bot-real-pg-managed-acceptance.md`
- status docs updated for Phase 3.60

## Findings
1. Severity: High. The existing `bot\.env` Postgres source had enough fields for the managed real-PG proof and the role could create/drop the generated throwaway DB. Values were never printed. Fix/handling: `REAL_POSTGRES_ADMIN_DATABASE_URL` was built only inside the Node wrapper process.
2. Severity: Medium. The first active run created and dropped `wtc_test_realpg20260602105728361315`, but failed because raw `postgres-js` returned `account_locked_until` as a timestamp string while the test expected a `Date` instance. Fix: `tests/integration/db-real-postgres.test.ts` now accepts either a valid `Date` or parseable timestamp string for that raw SQL field.
3. Severity: High. The final managed run created `wtc_test_realpg20260602105824d18bef`, ran the active real-PG harness, passed all `14` tests, and dropped the generated database. This clears the active managed real-Postgres proof for the current local throwaway path.
4. Severity: Medium. PostgreSQL emitted NOTICE messages about long generated identifier truncation during migrations. The harness still completed and the schema table-set proof passed; these notices are recorded as observed output, not a failing gate.
5. Severity: Medium. The real-PG managed runner redacts child output, but unlike the LMS DB browser runner it does not run a retained artifact scanner. Decision: retain only compact redacted command facts in docs, not raw logs or terminal transcripts.

## Decisions
- Treat `npm run accept:real-pg:managed` as RUN/PASS only from the final managed run after the timestamp assertion fix.
- Keep the first failed run as debugging evidence, not acceptance evidence.
- Continue reporting all other credentialed/live gates as NOT RUN.
- Do not claim git/branch/PR/GitHub CI readiness because `git rev-parse --show-toplevel` still reports this root is not git-backed.

## Risks
- The existing bot Postgres credential is powerful enough to create/drop databases; future phases must remain single-purpose and values-hidden.
- A hard process kill during a managed run could leave orphan `wtc_test_realpg*` databases; normal failure cleanup worked in both observed runs.
- This phase proves active real-PG migration/seed/concurrency behavior in a generated local throwaway database. It does not prove preview/prod DB rollout, append-only audit DB-role restrictions, live provider acceptance, server deployment, GitHub CI, or production monitoring.

## Verification/tests
| Gate | Command | Result |
|---|---|---|
| Required protocol/docs read | `Get-Content`/`rg` over protocol, blocker, acceptance, and runbook files | PASS |
| Git root truth | `git rev-parse --show-toplevel` | NOT GIT-BACKED |
| Adjacent bot Postgres key presence | key-name-only parse of `C:\Users\maxib\GTE BOT\bot\.env` | PASS; values not printed |
| Active real-PG managed proof, first attempt | `npm run accept:real-pg:managed` with in-process URL from `bot\.env` | FAIL; generated DB `wtc_test_realpg20260602105728361315` created/dropped; `13` passed, `1` failed timestamp type assertion |
| Active real-PG managed proof, final attempt | `npm run accept:real-pg:managed` with in-process URL from `bot\.env` | PASS; generated DB `wtc_test_realpg20260602105824d18bef` created/dropped; `14` tests passed |
| Focused safety/helper tests | `npm test -- tests/integration/real-pg-managed-runner-safety.test.ts tests/integration/db-real-postgres.test.ts` with real-PG envs cleared | PASS; `13` passed, `9` skipped inactive DB block |
| Root typecheck | `npm run typecheck` | PASS |
| Web typecheck | `npm run typecheck -w @wtc/web` | PASS |
| Root lint | `npm run lint` | PASS |
| Secret scan | `npm run secret:scan` | PASS |
| Governance check | `npm run governance:check` | PASS; `0` errors, `1` known historical warning |

Gates NOT RUN: `npm run preview:safe`, default `npm run e2e`, `node scripts/gates.mjs e2e`, `node scripts/gates.mjs full`, root `npm test`, `npm run build -w @wtc/web`, `npm run e2e:lms:db:managed`, manual `REAL_POSTGRES_DATABASE_URL` harness, `npm run accept:audit:append-only-role`, live LMS object-store preflight, live LMS external-scanner preflight, real Stripe checkout/webhook replay, live Axioma endpoint/account-link/download acceptance, preview/prod DB migration or seed, SSH/nginx/systemd/server checks, bot services/control, GitHub CI execution, deploy, and production monitoring.

## Next actions
1. Next single-purpose credentialed phase should be one of: append-only audit DB-role proof, live LMS object-store, live LMS external scanner, Stripe, Axioma, preview smoke, GitHub CI, or deploy/server checks.
2. Do not rerun LMS DB browser acceptance or active real-PG managed proof unless the relevant code/DB path changes, or the operator explicitly requests fresh proof.
