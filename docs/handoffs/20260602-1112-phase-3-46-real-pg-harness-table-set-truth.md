# Phase 3.46 real-PG harness table-set truth handoff

## Scope
Closed the stale local real-Postgres harness table-count truth gap before the next active auth/account real-PG acceptance
phase. This phase did not run live services, preview/prod DBs, or production deployment. The DB-mutating real-PG block remains
NOT RUN because `REAL_POSTGRES_DATABASE_URL` was not supplied.

Background read-only agents launched before main-thread edits:
- [docs/handoffs/20260602-1112-ecosystem-security-auditor.md](20260602-1112-ecosystem-security-auditor.md)
- [docs/handoffs/20260602-1112-ecosystem-platform-architect.md](20260602-1112-ecosystem-platform-architect.md)
- [docs/handoffs/20260602-1112-ecosystem-devops-implementer.md](20260602-1112-ecosystem-devops-implementer.md)
- [docs/handoffs/20260602-1112-ecosystem-db-architect.md](20260602-1112-ecosystem-db-architect.md)
- [docs/handoffs/20260602-1112-ecosystem-tests-runner.md](20260602-1112-ecosystem-tests-runner.md)

All five background agents completed and were closed after their results were collected.

## Files inspected
`AGENTS.md`; `docs/SESSION_PROTOCOL.md`; `docs/handoffs/0000-orchestrator-seed.md`;
`tests/integration/db-real-postgres.test.ts`; `packages/db/src/schema.ts`; `packages/db/migrations/meta/_journal.json`;
`packages/db/migrations/meta/0016_snapshot.json`; `packages/db/migrations/0014_lazy_puff_adder.sql`;
`packages/db/migrations/0015_wet_cobalt_man.sql`; `packages/db/migrations/0016_colorful_lyja.sql`; `package.json`;
`packages/db/package.json`; `scripts/gates.mjs`; `docs/STATUS.md`; `docs/NEXT_ACTIONS.md`; `docs/IMPLEMENTED_FILES.md`;
`docs/DATA_MODEL.md`; `docs/DEPLOYMENT.md`; `docs/ACCEPTANCE_MATRIX_MASTER.md`; `docs/ROADMAP_MASTER.md`;
`docs/RISK_REGISTER_MASTER.md`; `docs/PRODUCTION_BLOCKERS.md`; `docs/PRODUCTION_BLOCKERS_CURRENT.md`; Phase 3.45 handoffs.

## Files changed
- `tests/integration/db-real-postgres.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/ROADMAP_MASTER.md`
- `docs/RISK_REGISTER_MASTER.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/PRODUCTION_BLOCKERS_CURRENT.md`
- `docs/DEPLOYMENT.md`
- `docs/DATA_MODEL.md`
- `docs/handoffs/20260602-1112-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1112-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1112-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1112-ecosystem-db-architect.md`
- `docs/handoffs/20260602-1112-ecosystem-tests-runner.md`
- `docs/handoffs/20260602-1112-phase-3-46-real-pg-harness-table-set-truth.md`

## Agent handoffs
- `docs/handoffs/20260602-1112-ecosystem-security-auditor.md`
- `docs/handoffs/20260602-1112-ecosystem-platform-architect.md`
- `docs/handoffs/20260602-1112-ecosystem-devops-implementer.md`
- `docs/handoffs/20260602-1112-ecosystem-db-architect.md`
- `docs/handoffs/20260602-1112-ecosystem-tests-runner.md`

All five background agents were collected and closed before final reporting.

## Findings
1. HIGH - The old hardcoded real-PG table-count proof was stale against the current 43-table schema. Target part:
   `tests/integration/db-real-postgres.test.ts`.
2. HIGH - The harness now avoids future count drift by comparing the real migrated base table set to the current Drizzle
   schema-derived table-name set. Target part: real-PG schema proof.
3. HIGH - Active real-Postgres auth/account race proof remains NOT RUN without a fresh throwaway `wtc_test*`
   `REAL_POSTGRES_DATABASE_URL`. Target part: acceptance reporting.
4. MEDIUM - Current docs needed reconciliation to separate deploy `db:migrate`/`db:seed` gates from the self-migrating and
   self-seeding focused harness. Target part: deployment/acceptance docs.
5. MEDIUM - Old raw-IP preview proof is historical and not a substitute for the current auth/account harness through
   migration `0016_colorful_lyja`. Target part: production blockers current.

## Decisions
- Use a dynamic schema table-set proof rather than any fixed `toBe(43)` assertion.
- Keep the DB-name guard as the first safety boundary before any connection opens.
- Keep active real-PG proof NOT RUN unless the DB-mutating block runs and passes against a fresh `wtc_test*`.
- No migration is needed for Phase 3.46.
- CI remains NOT RUN because this workspace is not git-backed.

## Risks
- A skipped no-credential Vitest run can exit 0 and be misreported as real-PG acceptance.
- A stale historical raw-IP preview proof can be misapplied to the current auth/account harness.
- Running broad `npm test` with real-PG env may activate other opt-in real-PG suites; use the focused command for acceptance.

## Verification/tests
RUN:
- `npm test -- tests/integration/db-real-postgres.test.ts` - PASS default mode (`5 passed / 9 skipped`); DB-mutating real-PG
  block skipped because `REAL_POSTGRES_DATABASE_URL` is unset.
- `npm run db:generate -w @wtc/db` - PASS, 43 tables, no schema changes.
- `npm run typecheck` - PASS.
- `npm run typecheck -w @wtc/web` - PASS.
- `npm run lint` - PASS.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS (current phase `20260602-1112`, 5 cited per-agent handoffs all present, 0 errors / 1
  known historical warning).
- `node scripts/gates.mjs full` - PASS (9/9: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test,
  db:generate, build).

NOT RUN:
- Active `REAL_POSTGRES_DATABASE_URL` real-PG auth/account race proof - no throwaway DB credentials supplied.
- `node scripts/gates.mjs e2e` - not part of the first Phase 3.46 draft because no UI/browser surface changed.
- Preview/prod DB rollout, live server mutation, live bot mutation, live Stripe/Axioma/LMS provider acceptance, GitHub Actions CI.

## Next actions
1. Next phase: operator supplies a fresh `wtc_test*` `REAL_POSTGRES_DATABASE_URL` and runs the focused harness to activate the
   real-PG auth/account race proof.
2. After active real-PG proof, proceed to production nginx/shared-store auth throttling and trusted proxy proof.
