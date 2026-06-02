# Phase 3.47 managed real-PG proof runner handoff

## Scope
Prepared a safer operator path for the active real-Postgres auth/account race proof after Phase 3.46. This phase added a
managed runner that can create a fresh `wtc_test_<suffix>` database from an operator-supplied admin URL, run the focused
real-PG harness, and drop the throwaway database. This phase did not execute the active DB-mutating proof because no usable
Postgres credentials were supplied in the current shell.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-1144-ecosystem-tests-runner.md](20260602-1144-ecosystem-tests-runner.md)
- [docs/handoffs/20260602-1144-ecosystem-db-architect.md](20260602-1144-ecosystem-db-architect.md)
- [docs/handoffs/20260602-1144-ecosystem-security-auditor.md](20260602-1144-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-1144-ecosystem-devops-implementer.md](20260602-1144-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-1144-ecosystem-platform-architect.md](20260602-1144-ecosystem-platform-architect.md)

All five background agents completed and were closed after their results were collected.

## Files inspected
`AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/0000-orchestrator-seed.md`; `package.json`;
`packages/db/package.json`; `packages/db/drizzle.config.ts`; `packages/db/src/schema.ts`; `packages/db/src/repositories.ts`;
`packages/db/migrations/0016_colorful_lyja.sql`; `packages/db/migrations/meta/_journal.json`;
`packages/db/migrations/meta/0016_snapshot.json`; `tests/integration/db-real-postgres.test.ts`;
`tests/integration/db-axioma-jti.test.ts`; `scripts/run-lms-db-e2e-managed.mjs`; `docs/DEPLOYMENT.md`; `docs/STATUS.md`;
`docs/NEXT_ACTIONS.md`; `docs/IMPLEMENTED_FILES.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/PRODUCTION_BLOCKERS.md`;
`docs/PRODUCTION_BLOCKERS_CURRENT.md`; `.env.example`; `docker-compose.yml`.

## Files changed
- `scripts/run-real-pg-harness-managed.mjs`
- `package.json`
- `docs/DEPLOYMENT.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-1144-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1144-ecosystem-db-architect.md`
- `docs/handoffs/20260602-1144-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1144-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1144-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1144-phase-3-47-managed-real-pg-proof-runner.md`

## Findings
1. HIGH - Active real-PG auth/account race proof remains NOT RUN: `REAL_POSTGRES_DATABASE_URL` and usable admin credentials
   were absent in the current shell.
2. HIGH - Local PostgreSQL 17 is present and listening on `127.0.0.1:5432`, and `psql.exe` exists by full path, but
   passwordless/default auth did not work.
3. HIGH - The managed runner reduces operator error by creating a generated `wtc_test_<suffix>` DB, running only the focused
   harness, setting child-only env, and dropping the DB in `finally`.
4. MEDIUM - The runner must not be treated as proof until invoked with `REAL_POSTGRES_ADMIN_DATABASE_URL` and the active
   real-PG tests pass without skips.
5. MEDIUM - Broad `npm test` with a real-PG env remains discouraged because other opt-in real-PG suites can activate.

## Decisions
- Add `npm run accept:real-pg:managed` as the preferred operator path.
- Require `REAL_POSTGRES_ADMIN_DATABASE_URL` to point at a non-throwaway maintenance DB.
- Generate a `wtc_test_<suffix>` name accepted by the harness guard.
- Use the generated throwaway DB for both child `REAL_POSTGRES_DATABASE_URL` and `DATABASE_URL`.
- Generate ephemeral `SESSION_SECRET` and `SECRET_VAULT_KEK` in the child env if absent.
- Do not print full URLs, passwords, generated secrets, cookies, tokens, or raw env dumps.

## Risks
- The admin URL can create/drop databases; it must be supplied only by the operator and never archived.
- A successful runner syntax/help check is not active proof.
- If the drop step fails, the runner exits nonzero and reports the throwaway DB name for cleanup.

## Verification/tests
RUN:
- `node --check scripts/run-real-pg-harness-managed.mjs` - PASS.
- `npm run accept:real-pg:managed -- --help` - PASS.
- `npm run accept:real-pg:managed` without `REAL_POSTGRES_ADMIN_DATABASE_URL` - PASS as a refusal test: expected exit 2
  before any DB mutation.
- `npm test -- tests/integration/db-real-postgres.test.ts` - PASS default mode (`5 passed / 9 skipped`); DB-mutating real-PG
  block skipped because no `REAL_POSTGRES_DATABASE_URL` is set.
- `node scripts/gates.mjs full` - PASS (9/9: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test,
  db:generate, build).
- Final post-doc `npm run governance:check` - PASS (current phase `20260602-1144`, 5 cited per-agent handoffs all present,
  0 errors / 1 known historical warning).
- Final post-doc `npm run secret:scan` - PASS.

NOT RUN:
- Active `REAL_POSTGRES_ADMIN_DATABASE_URL` managed run - no operator credentials supplied.
- Active `REAL_POSTGRES_DATABASE_URL` real-PG harness - no throwaway DB credentials supplied.
- Preview/prod DB rollout, live server mutation, live bot mutation, live provider acceptance, GitHub Actions CI.

## Next actions
1. Run and record final local gates for this phase.
2. Operator supplies `REAL_POSTGRES_ADMIN_DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/postgres`.
3. Run `npm run accept:real-pg:managed`.
4. Accept active real-PG proof only if active real-PG tests pass without skipped DB-mutating tests and retained evidence is
   redacted.
