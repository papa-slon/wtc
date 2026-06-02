# ecosystem-tests-runner handoff
## Scope
Read-only Phase 3.43 / epoch 20260602-0903 tests-runner lane for DB-backed account-specific login lockout. Audited current test strategy, gate impact, and the right split between unit coverage, PGlite integration, static coverage, Playwright, and an opt-in real-Postgres race gate. No product code edits.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md`
- `vitest.config.ts`
- `scripts/gates.mjs`
- `package.json`
- `packages/auth/src/rate-limit.ts`
- `packages/auth/src/rate-limit.test.ts`
- `packages/auth/src/csrf.test.ts`
- `packages/auth/src/rbac.test.ts`
- `packages/auth/src/security-headers.test.ts`
- `packages/auth/src/session.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/auth-rate-limit-middleware.test.ts`
- `tests/integration/auth-error-copy.test.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/db-0003.test.ts`
- `tests/integration/db-pg5.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `tests/integration/db-tv-expiring.test.ts`
- `apps/web/src/middleware.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/features/auth/error-copy.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/app/api/e2e/login/route.ts`
- `tests/e2e/helpers/auth.ts`
- `tests/e2e/security-headers.spec.ts`
- Playwright auth helper usage under `tests/e2e/*.spec.ts`
## Files changed
None - read-only audit, except this required handoff file.
## Findings
1. High - Current coverage proves IP-keyed auth rate limiting, not DB-backed account lockout. Evidence: `apps/web/src/middleware.ts:38` defines the 10/min policy, `apps/web/src/middleware.ts:87` keys it as `auth:${ip ?? 'unknown'}`, and `tests/integration/auth-rate-limit-middleware.test.ts:33` / `tests/integration/auth-rate-limit-middleware.test.ts:46` assert login/register 429 by client IP. Recommendation: implement account-lockout tests separately from middleware tests, with the account identifier normalized and hashed/redacted where audit/log persistence is involved. Target part: DB-backed account-specific lockout.
2. High - The DB identity schema and repositories have no account-lockout state yet, so a passing current gate cannot be accepted as lockout proof. Evidence: `packages/db/src/schema.ts:15`-`24` has `users` with only id/email/password/displayName/createdAt, `packages/db/src/schema.ts:40`-`50` has sessions, and `packages/db/src/repositories.ts:59`-`97` covers lookup/create only; there is no login attempt, locked-until, failure counter, or repository primitive for lockout decisions. Recommendation: add migration-backed lockout state and repository tests before web action integration. Target part: DB schema and `@wtc/db` repository contract.
3. High - The login server action currently verifies credentials directly and audits failed logins after the credential check returns null, so account-specific lockout must be inserted around this path and tested without account disclosure. Evidence: `apps/web/src/app/(auth)/actions.ts:23`-`33` calls `verifyLogin`, writes `auth.login_failed`, redirects to `invalid_credentials`, then sets session on success; `apps/web/src/features/auth/error-copy.ts:8`-`12` keeps browser copy generic. Recommendation: tests must pin locked, unknown-account, wrong-password, and success-after-window behavior to the same user-facing code while asserting durable audit/result differences only in DB-safe form. Target part: web auth action and browser error-copy contract.
4. Medium - PGlite is the right default integration layer for lockout transitions, but it should not be the final proof for concurrent threshold races. Evidence: `vitest.config.ts:5` includes `tests/integration/**/*.test.ts`, PGlite suites replay migrations in `tests/integration/db-persistence.test.ts:46`-`54`, and the real-Postgres harness documents that PGlite is a single-connection complement while real Postgres proves cross-connection races at `tests/integration/db-real-postgres.test.ts:4`-`8` and `tests/integration/db-real-postgres.test.ts:102`-`115`. Recommendation: add PGlite integration for deterministic state transitions and an opt-in real-Postgres test if lockout increments/unlocks rely on concurrent updates. Target part: integration gate design.
5. Medium - Playwright should not carry the lockout threshold gate. Evidence: `tests/e2e/helpers/auth.ts:5`-`12` uses `/api/e2e/login`, bypassing real `/login`; `apps/web/src/app/api/e2e/login/route.ts:9` restricts that bypass to local e2e; `tests/e2e/security-headers.spec.ts:30`-`34` explicitly avoids rapid POST 429 e2e bursts due shared dev-server flake; `scripts/gates.mjs:41` and `scripts/gates.mjs:54` keep e2e as a separate plan. Recommendation: keep e2e to one non-burst smoke for generic locked-login copy only if needed; do not require e2e for threshold/race acceptance. Target part: e2e gate stability.
6. Medium - Static coverage is useful for enforcing boundary placement and secret/account neutrality, but it must not replace DB behavior tests. Evidence: `tests/integration/auth-error-copy.test.ts:37`-`51` already statically pins auth page/action error-code usage; `tests/integration/auth-rate-limit-middleware.test.ts:73`-`77` statically pins Edge-safe subpath imports. Recommendation: add static assertions that lockout logic lives in `packages/*`/DB repositories rather than React pages, no plaintext passwords/secrets are persisted, and web pages render stable error codes only. Target part: boundary and leak-prevention guardrails.
7. Low - Gate runner impact is modest if lockout tests stay focused. Evidence: `scripts/gates.mjs:31`-`42` already routes `npm test` through the full/core gate, and the focused auth/DB slice in this lane passed quickly. Recommendation: add the new unit/PGlite tests to normal `npm test`; keep real-Postgres race proof opt-in via `REAL_POSTGRES_DATABASE_URL` and document it as a NOT-RUN gate unless explicitly provisioned. Target part: local and CI gate budget.
## Decisions
- Unit tests should cover pure lockout policy math: threshold, window, locked-until, success reset, unknown-account neutrality, clock injection, and no plaintext secret/account leakage in returned policy objects.
- PGlite integration should cover migration shape plus repository behavior: record failed attempt, lock on threshold, deny while locked, reset on successful login, keep unknown account response neutral, write redacted audit rows, and keep state scoped per normalized account.
- Web/action tests should be deterministic Vitest, not Playwright bursts: call the server-action-adjacent logic or a thin extracted auth service with mocked clock/DB and assert redirects/error codes stay generic.
- Add an opt-in real-Postgres race test only if the implementation updates per-account counters under concurrent failed logins or unlock transitions. Use the existing `REAL_POSTGRES_DATABASE_URL` throwaway-DB guard pattern.
- Do not add normal-suite e2e threshold tests. If browser coverage is required, limit it to one locked-account smoke that pre-seeds state and submits once, not a rapid failed-login burst.
## Risks
- PGlite can exercise Postgres SQL and migrations, but it does not prove cross-pool row-lock/update races that can occur under real production traffic.
- A naive lockout implementation can disclose account existence through different redirects, timing, audit target IDs, or visible copy even if password verification remains generic.
- Reusing middleware 429 tests as account-lockout acceptance would leave distributed IP rotation and per-account brute-force risk untested.
- Adding e2e burst tests would likely reintroduce the shared dev-server flake already documented by prior tests-runner decisions.
## Verification/tests
- RUN: `npm test -- packages/auth/src/rate-limit.test.ts tests/integration/auth-rate-limit-middleware.test.ts tests/integration/auth-error-copy.test.ts tests/integration/db-persistence.test.ts tests/integration/db-real-postgres.test.ts` - PASS (`5` test files, `45` passed, `7` skipped; skipped tests are the opt-in real-Postgres block because `REAL_POSTGRES_DATABASE_URL` was not set).
- RUN: static repository inspection with `rg` and line-numbered reads for the requested files/surfaces - PASS for audit purposes; no product code edits.
- NOT RUN: `node scripts/gates.mjs full` - skipped because this read-only lane was scoped to test-strategy/gate-impact audit, not full phase acceptance.
- NOT RUN: `node scripts/gates.mjs e2e` / `npx playwright test` - skipped deliberately; current Playwright login helper uses `/api/e2e/login`, and lockout threshold bursts should not run against the shared dev server.
- NOT RUN: real-Postgres active race gate - skipped because `REAL_POSTGRES_DATABASE_URL` was not provided and no DB-backed lockout implementation exists yet.
- NOT RUN: DB migration/generate gate for lockout - skipped because no schema changes were made in this read-only lane.
## Next actions
1. Add pure lockout policy tests under `packages/auth/src/*lockout*.test.ts`.
2. Add a migration-backed PGlite suite under `tests/integration/auth-login-lockout-db.test.ts` or `tests/integration/db-auth-lockout.test.ts`.
3. Add web/action integration coverage for generic redirects/error codes without Playwright bursts.
4. If the DB primitive uses concurrent counter updates, extend `tests/integration/db-real-postgres.test.ts` with an opt-in cross-connection failed-login race case and run it only with `REAL_POSTGRES_DATABASE_URL` pointing at `wtc_test` or `wtc_test_<suffix>`.
5. Focused commands for the implementing phase:
   - `npm test -- packages/auth/src/*lockout*.test.ts tests/integration/auth-login-lockout-db.test.ts tests/integration/auth-error-copy.test.ts`
   - `npm test -- tests/integration/db-real-postgres.test.ts` with `REAL_POSTGRES_DATABASE_URL` set only for the opt-in race proof
   - `node scripts/gates.mjs full`
   - `node scripts/gates.mjs e2e` only after full is green, and only as ordinary smoke/regression coverage
