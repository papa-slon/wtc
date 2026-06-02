# Runner gate help safety handoff
## Scope
This handoff records the bounded local safety cleanup for the managed real-Postgres runner and gate runner help. The phase did not run an active real-Postgres proof, did not mutate a live DB, and did not touch app/runtime feature code.

## Files changed
- `scripts/run-real-pg-harness-managed.mjs`
- `scripts/gates.mjs`
- `tests/integration/real-pg-managed-runner-safety.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260602-1240-*.md`

## Findings
1. Medium. `scripts/run-real-pg-harness-managed.mjs` now refuses unknown arguments before parsing `REAL_POSTGRES_ADMIN_DATABASE_URL`, constructing a Postgres client, or creating a throwaway DB. Recommendation: keep this order pinned by focused tests. Target part: managed real-PG typo safety.
2. Medium. Safety tests now clear `REAL_POSTGRES_ADMIN_DATABASE_URL` by default and include a credential-present `--dry-run` refusal case. Recommendation: avoid inherited live credential use in no-DB tests. Target part: test isolation.
3. Low. `scripts/gates.mjs` invalid-mode help now derives valid modes from `Object.keys(PLANS)` and includes `quick | core | full | build | e2e`. Recommendation: keep help tied to the plan map. Target part: gate help truth.
4. Low. `scripts/gates.mjs` now creates `logs/gates` only after mode validation, so invalid-mode typos do not create gate artifacts. Target part: operator typo safety.
5. High. Active real-PG proof remains NOT RUN. Syntax/help/refusal checks do not prove migrations, account-race behavior, or production DB readiness. Target part: gate claims.

## Decisions
The phase stayed script/test/docs only. Help-first behavior (`--help` exits 0 even with extra args) remains consistent with existing preflight scripts. No live DB action was attempted.

## Risks
The active real-PG proof and production append-only role proof are still external-credential blocked. Default test runs can still pass while DB-mutating real-PG tests are skipped.

## Verification/tests
RUN:
- `node --check scripts/run-real-pg-harness-managed.mjs` PASS
- `node --check scripts/gates.mjs` PASS
- `npm test -- tests/integration/real-pg-managed-runner-safety.test.ts` PASS (`7` passed)
- `npm run accept:real-pg:managed -- --dry-run` refusal PASS (expected non-zero before credentials/DB mutation)
- credential-present `--dry-run` refusal PASS via focused test
- `node scripts/gates.mjs nope` refusal PASS (expected non-zero with all valid modes listed)
- `npm run governance:check` PASS (0 errors / 1 known warning; 3 cited per-agent handoffs all present)
- `npm run secret:scan` PASS
- `npm run db:generate -w @wtc/db` PASS (43 tables, no schema drift)
- `node scripts/gates.mjs full` PASS (9/9)

NOT RUN:
- active `npm run accept:real-pg:managed` with `REAL_POSTGRES_ADMIN_DATABASE_URL`
- manual `REAL_POSTGRES_DATABASE_URL` real-PG harness
- production/preview append-only role proof
- production DB rollout/live deploy
- production nginx/shared-store auth throttling
- GitHub CI
- live server, live bot, Stripe, Axioma, LMS object-store/scanner, or production monitoring gates

Per-agent handoffs cited:
- [`docs/handoffs/20260602-1240-ecosystem-tests-runner.md`](20260602-1240-ecosystem-tests-runner.md)
- [`docs/handoffs/20260602-1240-ecosystem-devops-implementer.md`](20260602-1240-ecosystem-devops-implementer.md)
- [`docs/handoffs/20260602-1240-ecosystem-platform-architect.md`](20260602-1240-ecosystem-platform-architect.md)

All current-phase agents were collected and closed before reporting.

## Next actions
1. Run active managed real-PG proof when `REAL_POSTGRES_ADMIN_DATABASE_URL` is supplied.
2. Run append-only audit role proof when `AUDIT_APPEND_ONLY_DATABASE_URL` for the restricted `wtc_app_role` is supplied.
3. If credentials remain unavailable, the next local safety slice is raw preview URL hygiene or LMS managed wrapper URL redaction.
