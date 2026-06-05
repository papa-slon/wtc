# ecosystem-platform-architect handoff
## Scope
Read-only platform/DB audit for Phase 4.54 user-route Tortila DB proof. Inspected the existing managed DB Playwright harness pattern and the smallest safe way to prove real-source Tortila Mark/uPnL `N/A` on user routes.

Out of scope: code edits, live servers, env/secrets mutation, `/api/marks`, exchange calls, provider probes, live bot start/stop/apply-config.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0535-phase-4-53-tortila-mark-unavailable-user-admin.md`
- `package.json`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `playwright.admin-user-bots-db.config.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/e2e/helpers/auth.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/seed.ts`

## Files changed
None - read-only audit

## Findings
1. Severity P1 - The existing managed admin DB harness already seeds the exact hostile Tortila position proof data needed for the user-route Mark/uPnL `N/A` gate, so a second fixture stack would be unnecessary risk. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:398-416` inserts `A_ONLY_POSITION_SYMBOL` for Tortila with real-looking `sourceAdapter: 'USER_A_TORTILA_POSITION_SOURCE'`, `markPrice: '105.00000000'`, and `unrealizedPnlUsd: '12.5000'`; `apps/web/src/features/bots/data.tsx:542-546` derives `markUnavailable` from real source adapters; `apps/web/src/features/bots/data.tsx:587-599` still maps numeric DB mark/uPnL into canonical positions, meaning only rendered assertions prove the UI suppresses them. Recommendation: extend the existing admin-user-bots managed DB harness with a focused user-route browser spec instead of creating a new prepare script, migration path, or DB repository. Target part: managed DB Playwright acceptance.
2. Severity P1 - The prepared selected user cannot currently be logged in through the existing e2e login helper, so the user-route proof will fail unless the fixture/login path is adjusted. Evidence: `scripts/prepare-admin-user-bot-detail-e2e.ts:191-199` creates `admin-drilldown-a@wtc.local` and `admin-drilldown-b@wtc.local` with fake password hashes; `tests/e2e/helpers/auth.ts:5-16` logs in through `/api/e2e/login` using the fixed demo password; `apps/web/src/app/api/e2e/login/route.ts:16-20` calls real `verifyLogin` and `createSession`; `packages/db/src/seed.ts:27-35` shows the valid demo hash comes from `hashPassword(DEMO_PASSWORD)`. Recommendation: in the fixture, create `userA` with a valid demo-password hash or add an e2e-only prepared-user login branch inside the guarded local-only `/api/e2e/login` route; prefer valid fixture hash because it avoids new auth bypass semantics. Target part: fixture/auth setup for browser proof.
3. Severity P1 - The current browser spec proves selected-user admin `N/A`, not user routes. Evidence: `tests/e2e/admin-user-bot-detail-db.spec.ts:291-306` asserts the Tortila admin coverage matrix and admin runtime row render Mark/uPnL as `N/A`; `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:239-244` and `apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx:38-43` contain the user-route source-boundary banner; `apps/web/src/app/(app)/app/bots/statistics/page.tsx:202-204` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:491` render user statistics Mark/uPnL as `N/A` when `markUnavailable` is true. Recommendation: add a new focused spec such as `tests/e2e/user-bot-routes-db.spec.ts` that logs in as `admin-drilldown-a@wtc.local`, visits `/app/bots/tortila`, `/app/bots/tortila/positions`, and `/app/bots/statistics?bot=tortila`, then asserts `A_ONLY_POSITION_SYMBOL`, Mark `N/A`, uPnL `N/A`, neutral/no `wtc-up`/`wtc-down` on uPnL cells, and the no-`/api/marks` copy. Target part: user-route rendered DB proof.
4. Severity P2 - The existing config is safe to reuse but must be expanded deliberately. Evidence: `playwright.admin-user-bots-db.config.ts:13-32` refuses unprepared DB URLs with marker HMAC validation; `playwright.admin-user-bots-db.config.ts:39-55` currently matches only `admin-user-bot-detail-db.spec.ts` and runs desktop/mobile serially; `playwright.admin-user-bots-db.config.ts:56-72` starts the local web server with `DATABASE_URL`, mock adapter mode, and live-control/TV automation disabled. Recommendation: extend `testMatch` to include the new user-route spec and keep `fullyParallel: false`, `workers: 1`, mock/no-live env, and the signed prepared marker. Do not add production-only hooks. Target part: Playwright config.
5. Severity P2 - Keep the existing managed runner/env gate rather than introducing a second admin DB env for the same fixture. Evidence: `package.json:36-38` already exposes `e2e:admin-user-bots:db`, `e2e:admin-user-bots:db:managed`, and `e2e:admin-user-bots:db:managed:matrix`; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:17-24` documents `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, creates `wtc_test_admin_user_bots_*`, and warns against archiving URLs/secrets; `scripts/run-admin-user-bot-detail-e2e-managed.mjs:101-119` creates and force-drops each throwaway DB; `scripts/run-admin-user-bot-detail-e2e.mjs:25-40` delegates with scrubbed local env and no-live flags. Recommendation: extend the admin runner, gated by `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`; optionally add a human-friendly alias `e2e:user-bot-routes:db:managed` only if it delegates to the same runner and env, not a new DB lifecycle. Target part: package scripts and managed DB gate naming.
6. Severity P2 - The existing static harness tests will need contract updates to prevent silent drift after the user-route spec is added. Evidence: `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:25-34` pins script registration and current `testMatch`; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:130-170` pins admin-only rendered assertions, including `N/A`; `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts:188-210` pins managed runner help/redaction and rejects credential-shaped URLs. Recommendation: update this static harness test to require the new user-route spec filename, three route visits, `A_ONLY_POSITION_SYMBOL`, Mark/uPnL `N/A`, no `wtc-up`/`wtc-down` on unavailable cells, and no `/api/marks` source-boundary copy. Target part: static test coverage for the managed harness.
7. Severity P3 - DB schema/repository changes are not needed for this proof. Evidence: `packages/db/src/schema.ts:538-555` already has `bot_position_snapshots.mark_price`, `unrealized_pnl_usd`, and `source_adapter`; `packages/db/src/repositories.ts:2218-2226` already accepts optional `markPrice`/`unrealizedPnlUsd` and batch-inserts position snapshots; `scripts/prepare-admin-user-bot-detail-e2e.ts:180-186` already applies all migration SQL and seeds the DB before fixture inserts. Recommendation: keep this as a Playwright/fixture/auth proof only; do not alter schema, migrations, repositories, `/api/marks`, workers, or bot adapters. Target part: DB boundary.

## Decisions
1. Recommendation: extend the existing admin-user-bots managed DB runner/config and add one new focused user-route spec; do not create a separate DB lifecycle runner/config.
2. Gate env recommendation: keep `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` as the managed-create/drop env for this proof, because it already owns the selected-user bot fixture and safety checks. The inner runner should continue using `ADMIN_USER_BOTS_E2E_DATABASE_URL`, `ADMIN_USER_BOTS_E2E=1`, and the prep-token marker.
3. Auth recommendation: make the prepared `userA` login-capable with the demo password hash, then use `loginAs(page, 'admin-drilldown-a@wtc.local')` from the existing helper.
4. No code, env, server, secret, `/api/marks`, exchange, or bot-control changes were made in this audit.

## Risks
1. If the existing config's `testMatch` is widened without static coverage, the admin matrix could silently grow or skip the user-route spec.
2. If a new login shortcut consumes `ADMIN_USER_BOTS_E2E_USER_ID`, it may become a broader auth bypass than needed; fixture hashing is safer.
3. Reusing `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` means the gate name remains admin-oriented even though it will cover user routes too; document the expanded coverage in script help and `NEXT_ACTIONS.md`.
4. Managed DB proof remains NOT RUN until the operator supplies an admin Postgres URL that can create/drop throwaway `wtc_test_admin_user_bots_*` databases.

## Verification/tests
RUN:
1. Read-only source inspection only.
2. `git status --short --branch` to confirm branch and pre-existing dirty tree.
3. Targeted `rg`/file reads over harness, route, DB, auth, package, and docs files.

NOT RUN:
1. No Playwright tests.
2. No Vitest/typecheck/lint/secret/governance gates.
3. No managed DB runner because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied.
4. No live server, `/api/marks`, exchange, provider, bot-control, deploy, or CI action.

## Next actions
1. Implement the smallest proof: valid demo-password hash for prepared `userA`, one `tests/e2e/user-bot-routes-db.spec.ts`, widened `playwright.admin-user-bots-db.config.ts` `testMatch`, and static harness assertions.
2. Run `npm run e2e:admin-user-bots:db:managed` with `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` when a throwaway admin Postgres URL is available.
3. If matrix coverage is required, run `npm run e2e:admin-user-bots:db:managed:matrix` after the single-scenario proof is green.
4. Keep `/api/marks`, exchange probes, provider probes, live bot controls, schema changes, and production hooks out of this proof.
