# ecosystem-devops-implementer handoff
## Scope
Read-only devops/DB acceptance review for Phase 3.59: whether an adjacent existing-bot Postgres credential can safely satisfy WTC managed acceptance runners that create and drop throwaway databases.

## Files inspected
- `package.json`
- `packages/db/package.json`
- `packages/db/drizzle.config.ts`
- `packages/db/src/client.ts`
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/run-lms-db-e2e-managed.mjs`
- `scripts/run-lms-db-e2e.mjs`
- `scripts/prepare-lms-db-e2e.ts`
- `scripts/redacted-child-process.mjs`
- `scripts/gates.mjs`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/real-pg-managed-runner-safety.test.ts`
- `docs/DEPLOYMENT.md`
- `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- adjacent bot config key names/suitability only; no values printed

## Files changed
None - read-only audit

## Findings
1. Severity: High. Evidence: adjacent `bot_tortila` current config exposes SQLite-style `DB_PATH`, while the operator later identified `C:\Users\maxib\GTE BOT\bot` as the intended local source with discrete Postgres fields. Recommendation: do not infer suitability from repo name; verify connection and `CREATE DATABASE` permission without printing values. Target part: credential discovery.
2. Severity: High. Evidence: `scripts/run-lms-db-e2e-managed.mjs:23`, `scripts/run-lms-db-e2e-managed.mjs:51`, `scripts/run-lms-db-e2e-managed.mjs:103`. Recommendation: managed LMS acceptance is suitable only against an approved maintenance DB; it must create/drop a fresh `wtc_test_lms_*`. Target part: DB mutation boundary.
3. Severity: Medium. Evidence: `scripts/run-real-pg-harness-managed.mjs:118`, `scripts/run-lms-db-e2e-managed.mjs:111`. Recommendation: after any credentialed run, confirm generated throwaway DB drop; hard kills can leave orphans. Target part: cleanup.
4. Severity: High. Evidence: `docs/CREDENTIAL_ACCEPTANCE_BLOCKERS_CURRENT.md:53`, `scripts/gates.mjs:49`. Recommendation: do not claim acceptance from default gates; only the specific managed command with active Playwright/scanner/cleanup proof clears LMS DB browser acceptance. Target part: acceptance reporting.

## Decisions
- Use `C:\Users\maxib\GTE BOT\bot\.env` as an operator-identified credential source only after status-only connection and `CREATE DATABASE` checks.
- Build the Postgres URL in-process from discrete env fields and remove `LMS_E2E_ADMIN_DATABASE_URL` after the command.
- Keep real-PG, audit-role, provider, deploy, and CI gates out of scope.

## Risks
- Adjacent bot hosts can be production-adjacent even when the generated WTC database name is disposable.
- Generated failure artifacts can contain traces/error context and must not be archived.
- This phase does not make the workspace git-backed.

## Verification/tests
RUN by this auditor: read-only inspection and key-name/suitability review only.

NOT RUN by this auditor: DB create/drop, Playwright, migrations/seeds, live servers, providers, deploy, CI.

## Next actions
Run the managed LMS DB acceptance with the approved credential source, record generated DB name and drop, and update blocker/status docs so only the LMS DB browser gate is cleared.

