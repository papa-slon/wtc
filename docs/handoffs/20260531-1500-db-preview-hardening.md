# db-preview-hardening handoff

## Scope
DB deploy-readiness only: inspect and harden `db:seed` idempotency, and add a safe local preview profile that forces development/mock/no-live-control switches. No live server, SSH, bot, exchange, worker, Stripe, billing, Axioma, admin, bot pages, or e2e specs were touched.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260531-1426-phase-3-4-stripe-test-checkout.md`
- `package.json`
- `packages/db/package.json`
- `packages/db/src/seed.ts`
- `packages/db/src/seed-cli.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/index.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `scripts/gates.mjs`
- `vitest.config.ts`
- `tsconfig.json`

## Files changed
- `packages/db/src/seed.ts`
- `package.json`
- `scripts/safe-preview.mjs`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `docs/handoffs/20260531-1500-db-preview-hardening.md`

## Findings
1. Medium - `packages/db/src/seed.ts`: the teacher demo course insert was not idempotent. Re-running seed after the teacher already existed skipped the whole user branch before, and after resolving existing users it would have duplicated the course without a guard. Recommendation: resolve existing demo users by email, always ensure roles/entitlements, and insert the demo course only when absent. Target part: DB seed.
2. Low - root scripts had `dev` but no safety-pinned preview command. Recommendation: add a local preview launcher that overrides risky environment switches to `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`. Target part: local preview.

## Decisions
- Kept the seed change application-level and migration-free. Adding a unique index on `(owner_teacher_id, title)` would be a broader data-model decision and could affect legitimate teacher workflows.
- `preview:safe` delegates to the existing `npm run dev -w @wtc/web` command but forces the safety environment values in the spawned process.
- Added one focused PGlite integration test file instead of broad e2e coverage, because this slice is seed/profile behavior and must not start a live server.

## Risks
- The demo course idempotency is deterministic for repeated seed runs. It is not a DB-level concurrency guarantee for two simultaneous seed processes because there is no course uniqueness constraint by design in this slice.
- Real Postgres `db:migrate`, `db:seed`, and the opt-in real-PG harness were not run because no throwaway `REAL_POSTGRES_DATABASE_URL` was provided in this lane.

## Verification/tests
- `npm test -- tests/integration/db-seed-preview-hardening.test.ts` - PASS, 2 tests passed.
- `npx eslint packages/db/src/seed.ts scripts/safe-preview.mjs tests/integration/db-seed-preview-hardening.test.ts --max-warnings 0` - PASS.
- `npm run typecheck -- --pretty false` - PASS.

## Next actions
- When a throwaway Postgres URL is available, run `npm run db:migrate -w @wtc/db`, `npm run db:seed -w @wtc/db` twice, then `npm test -- tests/integration/db-real-postgres.test.ts` with `REAL_POSTGRES_DATABASE_URL` set to the same throwaway database.
- If parallel seed execution becomes a requirement, decide whether a dedicated seed marker table or a narrow demo-course uniqueness constraint is acceptable.
