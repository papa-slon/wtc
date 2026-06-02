# ecosystem-db-architect handoff
## Scope
Read-only DB architecture lane for Phase 3.43 / epoch 20260602-0903. Audited the current DB schema,
repositories, migrations, DB-backed auth store, and relevant auth/security truth to propose the smallest safe
DB-backed account-specific login lockout implementation. No product code edits were made.
## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md`
- `docs/SECURITY_MODEL.md`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/index.ts`
- `packages/db/package.json`
- `packages/db/migrations`
- `packages/db/migrations/meta/_journal.json`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/db-axioma-jti.test.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `package.json`
## Files changed
None — read-only audit, except this handoff file.
## Findings
1. High - Account-specific lockout is not implemented in the current DB schema. Evidence:
   `packages/db/src/schema.ts:15`-`24` defines `users` with only `id`, `email`, `password_hash`,
   `display_name`, and `created_at`; `docs/SECURITY_MODEL.md:145`-`162` marks account-specific lockout
   columns/admin unlock as target/not present; Phase 3.42 repeats the deferral in
   `docs/handoffs/20260602-0834-phase-3-42-auth-rate-limit-truth.md:90` and `:114`-`:117`.
   Recommendation: add the lockout state as DB-owned identity state before claiming account-specific lockout.
   Target part: auth lockout schema.
2. High - The login DB path currently verifies password without any DB-backed lockout state transition.
   Evidence: `apps/web/src/lib/db-store.ts:78`-`81` loads by email and returns `verifyPassword(...) ? u : null`;
   `apps/web/src/app/(auth)/actions.ts:26`-`32` audits login failure/success but does not update account
   counters or enforce `account_locked_until`. Recommendation: route login through DB repository functions that
   check lock state, record failed attempts, reset counters on success, and return only generic caller outcomes.
   Target part: auth repository/API boundary.
3. High - The documented three-column target is too small to safely enforce all documented thresholds. Evidence:
   `docs/SECURITY_MODEL.md:149`-`153` lists one failed count/reset pair plus `account_locked_until`, while
   `docs/SECURITY_MODEL.md:157`-`159` requires 5-in-15m, 10-in-60m, and 20-total review behavior. One reset
   timestamp cannot faithfully represent two overlapping windows plus total review. Recommendation: either narrow
   the shipped slice to one 15-minute window and update docs honestly, or add explicit 15-minute, 60-minute, and
   review counters in one migration. Target part: reset-window correctness.
4. Medium - Columns on `users` are the smallest safe DB-backed implementation for this slice; a separate table is
   not justified unless the phase also needs per-attempt history. Evidence: lockout is one-to-one with identity
   (`users.email` is unique at `packages/db/src/schema.ts:24`), the DB store already loads users by email at
   `apps/web/src/lib/db-store.ts:79`, and repo mutations already keep critical state and audit in transactions
   (`packages/db/src/repositories.ts:138`-`174`). Recommendation: add lockout columns to `users`; reserve a
   separate append-only `auth_login_events`/`auth_lockout_events` table for later forensic/history needs, not for
   the minimum lockout gate. Target part: schema shape.
5. High - Failed-attempt increments must be row-locked or single-statement atomic to avoid lost updates under
   concurrent login failures. Evidence: current repo comments already treat SELECT-then-INSERT races as unsafe and
   rely on DB-level upserts/unique constraints (`packages/db/src/repositories.ts:81`-`96`,
   `packages/db/src/repositories.ts:148`-`167`); real cross-connection races are only proven in real Postgres
   (`tests/integration/db-real-postgres.test.ts:102`-`115`, `tests/integration/db-axioma-jti.test.ts:132`-`157`).
   Recommendation: implement `recordFailedLoginAttempt` in `@wtc/db` as a transaction using `SELECT ... FOR UPDATE`
   on the user row or one raw SQL `UPDATE ... RETURNING` expression; never do read/compute/write without a row lock.
   Target part: race safety.
6. Medium - Migration metadata must follow the existing Drizzle sequence. Evidence: migrations currently run through
   `0015_wet_cobalt_man.sql`, and `_journal.json` has entries `idx` 0 through 15 with matching `0015_snapshot.json`.
   Recommendation: generate the next migration via `npm run db:generate -w @wtc/db`, expect
   `packages/db/migrations/0016_<drizzle-name>.sql`, `packages/db/migrations/meta/0016_snapshot.json`, and a
   `_journal.json` entry with `idx: 16`; do not hand-edit metadata except for documented generated output review.
   Target part: migration hygiene.
7. Medium - PGlite is necessary but insufficient for the concurrency acceptance claim. Evidence:
   `tests/integration/db-persistence.test.ts:1`-`5` applies real generated SQL to PGlite; the real-PG harness says
   it is the cross-connection complement because PGlite is single-connection (`tests/integration/db-real-postgres.test.ts:6`-`8`).
   Recommendation: add PGlite tests for migration replay, normal fail/success/reset semantics, lockout expiry, and
   generic outcomes; add an opt-in real-Postgres test with two independent pools racing failed attempts on the same
   account. Target part: verification.
## Decisions
- Recommend columns on `users`, not a separate lockout table, for the smallest safe account-specific implementation.
- If the phase must satisfy the full current `SECURITY_MODEL` thresholds, add explicit columns instead of the current
  three-column target:
  - `failed_login_15m_count integer not null default 0`
  - `failed_login_15m_reset_at timestamptz`
  - `failed_login_60m_count integer not null default 0`
  - `failed_login_60m_reset_at timestamptz`
  - `failed_login_total_count integer not null default 0`
  - `last_failed_login_at timestamptz`
  - `account_locked_until timestamptz`
  - `account_lockout_review_required_at timestamptz`
- If the implementation scope is intentionally smaller, ship only the 5-failures/15-minute lockout columns and update
  `docs/SECURITY_MODEL.md` so the 10/60 and 20-total behavior remains target-only.
- No new index is required for login enforcement because lookup is by `users.email` and the update is by primary key.
  Add an index on `account_locked_until` only if the same phase builds admin listing/sweeping by lock state.
- Store all timestamps as `timestamp(..., { withTimezone: true })`, consistent with the existing schema helpers.
  Use an injected `now` epoch/date in repositories for deterministic tests.
## Risks
- Updating counters after password verification still burns Argon2id CPU for known accounts; keep the existing IP
  middleware limiter as Layer 1 and enforce lockout before password verification when `account_locked_until > now`.
- Nonexistent email attempts cannot safely update account-specific state without creating an account-enumeration side
  channel. Keep caller copy generic and rely on IP/shared-store throttling for nonexistent-user floods.
- A raw `UPDATE ... RETURNING` or `SELECT ... FOR UPDATE` implementation must be PGlite-compatible for normal tests
  and real-Postgres-proven for cross-pool races.
- The existing `auth.login_failed` audit uses email as `targetId`; avoid adding plaintext password, IP, user agent,
  or secret-like request data to audit rows.
## Verification/tests
- RUN: read-only file inspection with PowerShell/rg for required docs, schema, repositories, migrations, and tests.
- NOT RUN: `npm run db:generate -w @wtc/db` because this lane is read-only and no schema edits were made.
- NOT RUN: PGlite lockout tests because implementation was not written in this lane.
- NOT RUN: real-Postgres lockout race test because implementation was not written and real DB credentials were not provided.
- NOT RUN: `npm test`, `npm run typecheck`, `npm run lint`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`,
  `npm run secret:scan`, and `npm run governance:check` because this was a read-only architecture lane with one handoff.
## Next actions
1. Implement the DB slice in these likely files: `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`,
   `packages/db/migrations/0016_<drizzle-name>.sql`, `packages/db/migrations/meta/_journal.json`,
   `packages/db/migrations/meta/0016_snapshot.json`, `apps/web/src/lib/db-store.ts`,
   `apps/web/src/app/(auth)/actions.ts`, `docs/SECURITY_MODEL.md`, and `docs/STATUS.md`.
2. Add focused tests in `tests/integration/db-persistence.test.ts` or a new
   `tests/integration/db-auth-lockout.test.ts` for PGlite migration replay, failed-attempt increments, reset-window
   rollover, locked-account generic denial, success reset, and lockout expiry.
3. Extend `tests/integration/db-real-postgres.test.ts` with an opt-in two-pool race where concurrent failed attempts
   on one account produce the exact expected counter/lock result and no lost update.
4. Gate the implementation with at least: focused lockout Vitest, `npm run db:generate -w @wtc/db` re-run showing no
   drift after migration generation, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`,
   `npm run check:core`, `node scripts/gates.mjs full`, final `npm run secret:scan`, and `npm run governance:check`.
