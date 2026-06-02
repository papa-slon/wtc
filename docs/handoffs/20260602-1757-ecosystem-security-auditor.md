# ecosystem-security-auditor handoff
## Scope
Read-only Phase 3.60 security audit for the next credentialed gate: active real-Postgres managed proof with `npm run accept:real-pg:managed`, using the operator-approved existing local bot Postgres settings from `C:\Users\maxib\GTE BOT\bot\.env` without printing credential values. No DB-mutating commands, product-code edits, live bot control, provider calls, preview starts, SSH/nginx/systemd checks, CI, or deploy actions were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-1714-phase-3-59-existing-bot-lms-db-acceptance.md`
- `docs/handoffs/20260602-1714-ecosystem-security-auditor.md`
- `docs/NEXT_SESSION_PROMPT_AFTER_PHASE_3_59_20260602.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/DEPLOYMENT.md`
- `.env.example`
- `package.json`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/preflight-log-root.mjs`
- `scripts/workspace-path-guard.mjs`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/real-pg-managed-runner-safety.test.ts`
- Adjacent `C:\Users\maxib\GTE BOT\bot\.env` key names only; no values printed.

## Files changed
None - read-only audit. Own handoff written: `docs/handoffs/20260602-1757-ecosystem-security-auditor.md`.

## Findings
1. Severity: High. Evidence: `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:65-66`, `docs/DEPLOYMENT.md:380-391`, `docs/ACCEPTANCE_MATRIX_MASTER.md:39-44`. Recommendation: keep Phase 3.60 scoped to the single active real-PG gate and do not report it green until `npm run accept:real-pg:managed` supplies a child `REAL_POSTGRES_DATABASE_URL`, all active DB-mutating real-PG tests pass without skips, and the throwaway DB is dropped. Target part: gate truth and reporting.
2. Severity: High. Evidence: `scripts/run-real-pg-harness-managed.mjs:39-41`, `scripts/run-real-pg-harness-managed.mjs:103-121`, `docs/DEPLOYMENT.md:385-388`. Recommendation: treat the next run as an explicitly DB-mutating managed proof, not discovery; use only a non-throwaway maintenance admin URL from the operator-approved local bot settings, record only the generated `wtc_test_realpg*` database name, and verify the final drop message or manually clean up any orphaned throwaway DB if interrupted. Target part: database lifecycle and cleanup.
3. Severity: High. Evidence: `scripts/run-real-pg-harness-managed.mjs:65-70`, `scripts/redacted-child-process.mjs:6-24`, `scripts/redacted-child-process.mjs:44-62`. Recommendation: run from a clean PowerShell environment with only the needed admin URL and non-secret runtime flags; allow the wrapper to generate ephemeral `SESSION_SECRET` and `SECRET_VAULT_KEK` when absent, and never copy raw env dumps, full URLs, cookies, auth headers, or secret values into chat, docs, logs, fixtures, or screenshots. Target part: process environment and retained output.
4. Severity: Medium. Evidence: `tests/integration/db-real-postgres.test.ts:41-42`, `tests/integration/db-real-postgres.test.ts:81-85`, `tests/integration/db-real-postgres.test.ts:274-303`, `docs/DEPLOYMENT.md:431-440`. Recommendation: reject any default `npm test -- tests/integration/db-real-postgres.test.ts` result that only exercises availability/guard/helper tests; acceptance requires the active suite to run against a fresh `wtc_test*` database. Target part: test-result interpretation.
5. Severity: Medium. Evidence: `package.json:35`, `scripts/run-real-pg-harness-managed.mjs:112-124`, `scripts/run-lms-db-e2e.mjs:83-85`, `scripts/scan-lms-db-e2e-artifacts.mjs:51-58`. Recommendation: because the real-PG managed runner does not invoke a retained-artifact scanner, archive only a compact redacted summary unless a deliberate retained log is separately scanned; do not treat terminal output as scanner-clean merely because the child-process redactor forwarded it. Target part: evidence retention.
6. Severity: Medium. Evidence: `docs/PRODUCTION_BLOCKERS_CURRENT.md:8-14`, `docs/PRODUCTION_BLOCKERS_CURRENT.md:29-33`, `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:65-66`. Recommendation: when reporting Phase 3.60, explicitly distinguish older/raw-IP or preview-host real-Postgres evidence from the current active managed real-PG proof, which remains NOT RUN until this exact credentialed gate passes. Target part: blocker-doc truth and operator handoff language.

## Decisions
- Did not run `npm run accept:real-pg:managed` because it creates and drops a database.
- Did not run manual `REAL_POSTGRES_DATABASE_URL` Vitest, `psql`, `db:migrate`, or `db:seed`.
- Treat the adjacent bot `.env` only as an operator-approved local credential source; values must stay local/in-process and out of retained evidence.
- Prefer the managed runner over manual DB setup for the next gate because it constructs a fresh throwaway DB and drops it in `finally`.
- No product code, scripts, package files, env files, status docs, or blocker docs were edited.

## Risks
- The existing bot Postgres credential may be broader than a purpose-built acceptance role; a process kill between create and drop can leave an orphaned `wtc_test_realpg*` database.
- The wrapper inherits `process.env`; unrelated real provider credentials in the shell increase blast radius if any child path ever prints an unrecognized secret shape.
- Redacted stdout/stderr is not the same as scanner-clean retained evidence; any saved transcript needs a separate retention decision and scan.
- The workspace is still not git-backed in this session, so there is no branch, commit, PR, or GitHub CI proof for this gate.

## Verification/tests
- RUN: required local rule reads: `AGENTS.md` and `docs/SESSION_PROTOCOL.md`.
- RUN: session-grounding reads from seed/status/latest handoff/implemented/next-action docs.
- RUN: `git rev-parse --show-toplevel` -> NOT GIT-BACKED.
- RUN: adjacent bot `.env` key-name-only inspection for database/Postgres fields; values were not printed.
- RUN: `npm run accept:real-pg:managed -- --help` -> PASS; help only, no DB connection or mutation.
- RUN: fake-value redaction sanity check through `redactProcessOutput()` -> PASS; fake DB URL, fake session secret, and fake Authorization value were masked.
- NOT RUN: `npm run accept:real-pg:managed` because it creates/drops a throwaway database.
- NOT RUN: `npm test -- tests/integration/db-real-postgres.test.ts` with `REAL_POSTGRES_DATABASE_URL`, because active DB mutation is outside this read-only audit.
- NOT RUN: `psql`, `npm run db:migrate`, `npm run db:seed`, Playwright/e2e, preview, provider live preflights, Stripe, Axioma, SSH/nginx/systemd, bot services/control, deploy, GitHub CI, production monitoring, root `npm test`, build, lint, typecheck, secret scan, and governance check.
- No background agents were spawned by this role; none were left running.

## Next actions
1. In the next single-purpose credentialed phase, construct `REAL_POSTGRES_ADMIN_DATABASE_URL` in-process from the approved local bot Postgres settings, without printing the value, then run `npm run accept:real-pg:managed`.
2. Accept the gate only if the runner creates a fresh `wtc_test_realpg*` database, active real-PG tests pass without skipped DB-mutating blocks, output remains redacted, and the runner drops the generated DB.
3. If the run fails or is interrupted, first verify/drop any generated `wtc_test_realpg*` database, then retain only a compact redacted failure summary and keep the gate marked NOT RUN or FAIL as observed.
