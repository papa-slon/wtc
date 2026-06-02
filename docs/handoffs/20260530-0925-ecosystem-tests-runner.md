# ecosystem-tests-runner handoff

**Epoch:** 20260530-0925
**Phase:** 2.1 — Migration 0002 test plan + gate execution
**Wave:** 2 — READ-ONLY verification (gates RUN, tests NOT written this wave — read-only audit per task mandate)

---

## Scope

Phase 2.1 test-runner audit. Covers:
1. Full gate execution (governance:check through e2e) on the current tree — every gate is reported with the observed result.
2. Integration test plan keyed to each 0002 spine step, using the existing PGlite harness pattern.
3. E2e additions required for Phase 2.1 UI surfaces (TV, education, billing, bot-config).
4. Exact gate sequence with RUN vs NOT RUN annotated per environment.
5. Priority unit coverage gaps: entitlement state machine, crypto envelope vault, RBAC matrix, analytics normalization.
6. Coverage risk notes, especially the webhook route handler and the reconcileAllEntitlements worker path.

Authoritative prior plan: `docs/handoffs/20260530-0126-ecosystem-tests-runner.md`.
DB architect design: `docs/handoffs/20260530-0126-ecosystem-db-architect.md`.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-tests-runner.md`
- `docs/TEST_PLAN_PHASE2.md`
- `docs/STATUS.md`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md`
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/integration/db-persistence.test.ts` (full)
- `tests/integration/db-real-postgres.test.ts` (full)
- `tests/integration/csrf-coverage.test.ts` (full)
- `tests/e2e/smoke.spec.ts` (full)
- `packages/entitlements/src/state-machine.ts` (full)
- `packages/auth/src/rbac.ts` (full)
- `packages/db/src/repositories.ts` (lines 369–388)
- `packages/db/migrations/` (2 files present: 0000, 0001)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### F-1 (HIGH) — Migration 0002 does not exist yet; 0002-dependent PGlite tests cannot run

**Evidence:** `packages/db/migrations/` contains exactly 2 files (`0000_broken_jack_murdock.sql`, `0001_early_toad_men.sql`). `npm run db:generate -w @wtc/db` reports "No schema changes, nothing to migrate" because `packages/db/src/schema.ts` has not yet been updated with the 18 new tables. The PGlite pattern in `tests/integration/db-persistence.test.ts` lines 47–54 reads migration files from disk and applies them in sort order — so until 0002 SQL exists on disk, all new integration test cases that depend on those tables will fail with "relation does not exist".

**Recommendation:** The Wave-2 backend implementer must write the Drizzle schema additions to `packages/db/src/schema.ts` and run `npm run db:generate -w @wtc/db` to produce `0002_ecosystem_expansion.sql` BEFORE any new integration test files for those tables can be enabled. Test cases for tables not in 0002 (entitlement engine, RBAC matrix, analytics, CSRF, exchange-key vault shape) can be written and enabled immediately without waiting.

### F-2 (HIGH) — real-PG harness missing DB-name safety guard (carried from F-1 of 20260530-0126)

**Evidence:** `tests/integration/db-real-postgres.test.ts` line 47–54 — `beforeAll` creates the pool and immediately runs migration SQL with no check on the database name. If `REAL_POSTGRES_DATABASE_URL` were accidentally set to the production database URL, all migrations would be destructively applied to it.

**Recommendation (Wave 2 implementer, HIGH priority):** Insert as the FIRST statement of `beforeAll`, before the migration loop:
```ts
const dbName = new URL(URL as string).pathname.replace(/^\//, '');
if (!/^wtc_test(_[a-zA-Z0-9_]+)?$/.test(dbName)) {
  throw new Error(
    `SAFETY: real-PG harness refuses to run against '${dbName}'. ` +
    `Only wtc_test or wtc_test_* databases are permitted.`
  );
}
```
This guard must fire before any call to `sql.unsafe(...)`.

### F-3 (MEDIUM) — reconcileAllEntitlements (repositories.ts:371) and sweepTvExpiry worker paths are zero-covered

**Evidence:** Coverage output shows `packages/db/src/repositories.ts` lines 371–387 as uncovered. `reconcileAllEntitlements` is invoked only by `apps/worker/src/jobs.ts` which is excluded from Vitest (in `apps/web/**` exclusion scope — actually in `apps/worker`). `sweepTvExpiry` IS tested in the PGlite suite (db-persistence.test.ts lines 116–125 and 208–218) but the coverage report confirms `371–387` are the uncovered block, which is `reconcileAllEntitlements` only.

**Recommendation:** Add `reconcileAllEntitlements` to the new `billing-entitlement-states.test.ts` integration file. It already has a `db: Db` handle from the PGlite setup and requires no additional fixtures beyond seeded entitlements.

### F-4 (MEDIUM) — state-machine.ts branch coverage at 42.85% (6 of 14 branches uncovered)

**Evidence:** Coverage report: `packages/entitlements/src/state-machine.ts` 71.18% stmts / 42.85% branch. The uncovered lines include the `default` branch of the outer switch (line 89 — unknown status collapses to `manual_review`) and several `return current` no-op branches in the inner switch (e.g. `none` receiving a non-checkout/payment event). The fail-closed unknown-status behavior (line 89) is the most safety-critical gap.

**Recommendation:** Add to `packages/entitlements/src/engine.test.ts` (or a new `state-machine.test.ts`):
- `nextStatus('UNKNOWN_STATE' as any, 'payment_succeeded')` must return `'manual_review'` (fail-closed).
- `nextStatus('none', 'payment_failed')` must return `'none'` (no-op, stays none).
- `nextStatus('grace', 'subscription_canceled')` must return `'grace'` (no-op).
- `isGranting('BOGUS')` must return `false` (fail-closed, already in `__smoke__` but not in the Vitest suite).

### F-5 (LOW) — RBAC matrix has no test for `can(['user'], 'bot_config', 'delete')` being false

**Evidence:** `packages/auth/src/rbac.ts` line 27 — `bot_config: { read: ['user', 'admin'], create: ['user'], update: ['user'] }`. The `delete` key is absent, so the call falls through to `allowed.some(...)` returning `false`. No existing test in `packages/auth/src/rbac.test.ts` asserts this. The coverage report shows lines 53–62 (the `canActOnOwned` paths and the `assertAdmin` path) partially uncovered.

**Recommendation:** Add to the new `tests/integration/rbac-matrix.test.ts`:
- `can(['user'], 'bot_config', 'delete')` is `false`.
- `can(['teacher'], 'bot_config', 'delete')` is `false` (teacher has no bot_config access at all).
- `can(['admin'], 'bot_config', 'delete')` is `true` (admin `manage` implies all actions).

### F-6 (LOW) — analytics normalization: `packages/analytics/src/metrics.ts` lines 177–178, 254, 270 uncovered

**Evidence:** Coverage output: `metrics.ts` 100% stmts / 90% branch, uncovered branch at lines 177–178, 254, 270. These are edge-case branches in the drawdown and ROI calculations. The 13-test suite covers the primary paths but not all boundary conditions.

**Recommendation:** The existing `packages/analytics/src/metrics.test.ts` should be extended with:
- Drawdown edge case: equity curve with a single point (no drawdown possible).
- ROI calculation when `firstEquity` is 0 or undefined (guard branch at line 254/270).

### F-7 (INFO) — No Phase 2.1 integration test files exist yet; all 10 planned files are absent

**Evidence:** `tests/integration/` currently has exactly 4 files: `csrf-coverage.test.ts`, `check-governance.test.ts`, `db-real-postgres.test.ts`, `db-persistence.test.ts`. The 10 new files from the Phase 2 test plan (bot-config-ownership, exchange-key-vault, tortila-config, legacy-config, analytics-aggregation, tv-access-full, lms-full, billing-entitlement-states, rbac-matrix, csrf-new-actions) do not exist.

**Recommendation:** The Wave-2 implementer writes all 10 files. Files that depend on migration 0002 tables must guard their table-dependent describes with a `describe.skipIf` based on a detected migration file or a `PHASE_02_MIGRATION` env flag, so they skip gracefully until 0002 lands.

### F-8 (INFO) — No Phase 2.1 e2e spec files exist; smoke.spec.ts covers only Phase 1.7 surface

**Evidence:** `tests/e2e/` has exactly `smoke.spec.ts`. The 4 new spec files planned (`tv-access.spec.ts`, `education.spec.ts`, `billing-entitlement.spec.ts`, `bot-config.spec.ts`) do not exist. Screenshot inventory in `tests/e2e/screenshots/` confirms only 20 images (10 tests × 2 projects) from the current smoke suite.

**Recommendation:** Write all 4 new spec files in the same session as the UI implementation so the e2e gate can be run immediately after.

### F-9 (INFO) — webhook route handler path is zero-covered; highest-risk untested integration

**Evidence:** Coverage output shows `packages/billing/src/webhook.ts` at 28.57% stmts / 100% branch, lines 44, 55–60, 64–65, 68–69 uncovered. These are the actual `verify` + `map` + `persist` call chain. The Next.js route handler at `apps/web/src/app/api/webhooks/billing/route.ts` (if it exists) would be excluded from Vitest by `vitest.config.ts` line 9 (`exclude: ['apps/web/**']`). No Playwright test hits this endpoint.

**Recommendation:** Extract the handler's mapping logic into `packages/billing/src/webhook.ts` (as a callable function, not an HTTP handler), cover it with a Vitest unit test, and add a Playwright test that POSTs a mock webhook payload to `/api/webhooks/billing` and asserts a 200 response and a correct audit log.

---

## Decisions

1. All new integration tests must follow the PGlite pattern from `tests/integration/db-persistence.test.ts` lines 46–54: one `beforeAll` that reads all `.sql` files from `packages/db/migrations/`, applies them in sort order, and wraps with `drizzle(pg, { schema })`. No DB credentials required.
2. Migration 0002 must exist as an `.sql` file in `packages/db/migrations/` before any test depending on 0002 tables is enabled. Tests for tables NOT in 0002 (RBAC matrix, analytics, entitlement state machine, exchange-key vault shape from existing 0000 schema, CSRF scan) should be written and run immediately.
3. The real-PG safety guard (F-2) must be the first statement of `beforeAll` in `db-real-postgres.test.ts` before the harness is run against any Postgres instance. This is a hard boundary per the task brief.
4. LMS integration test cases that require `teacher_profiles`, `enrollments`, `lesson_progress`, or `pinned_links` use `describe.skipIf` until migration 0002 is present on disk.
5. `db:migrate` and `db:seed` remain NOT RUN until `DATABASE_URL` credentials pointing at `wtc_test` or `wtc_test_*` are provided. This is not a gate failure — it is an explicitly documented environment limitation.

---

## Risks

1. Migration 0002 scope is large (18 tables + 1 ALTER). If the backend implementer context-windows out partway through, the schema may be incomplete and the PGlite harness will fail on partial migrations. Rule-7 STOP applies: a partial schema must ship no new integration test files until the schema is complete and `db:generate` produces the 0002 SQL.
2. `teacher_profiles` backfill inside the 0002 migration transaction (INSERT for existing `courses.owner_teacher_id` rows) — if any `courses` row references a user_id that no longer exists, the FK will fail. The backfill must LEFT JOIN to users and skip orphan rows, or the migration will fail in PGlite with existing seed data.
3. `tradingview_profiles.current_grant_id` is a forward FK to `tradingview_access_grants`. Drizzle schema must declare this as deferred or the insert order must be: insert grant first, then update profile. The PGlite harness will surface this as a FK violation if the insert order is wrong.
4. `sweepTvExpiry` concurrent safety (see prior handoff coverage note #3) is only exercisable under real Postgres. Until credentials are provided, this race condition cannot be validated. Recommend `SELECT ... FOR UPDATE SKIP LOCKED` be added to the sweep before any production use.
5. The `reconcileAllEntitlements` function iterates all entitlement rows in one query without pagination. At scale this will be slow and may OOM. This is a Wave-2 implementation concern, not a test concern, but the integration test should seed enough rows to detect a missing WHERE clause.

---

## Verification / tests

### Gates actually run this session (all observed, no claims from memory)

| # | Gate | Command | Result | Evidence |
|---|------|---------|--------|---------|
| 1 | governance:check | `npm run governance:check` | PASS | 0 errors, 1 allowlisted warning (20260529-1921 historical); 14 cited per-agent handoffs present; epoch 20260530-0126 |
| 2 | check:core | `npm run check:core` | PASS | 7 smoke modules pass: entitlements 8 checks, crypto 7 checks, analytics 14 checks, audit, auth, axioma-bridge 7 checks, billing |
| 3 | lint | `npm run lint` | PASS | ESLint 9 flat config; exit 0; no warnings |
| 4 | typecheck (packages) | `npm run typecheck` | PASS | tsc --noEmit; exit 0 |
| 5 | typecheck (@wtc/web) | `npm run typecheck -w @wtc/web` | PASS | tsc --noEmit; exit 0 |
| 6 | secret:scan | `npm run secret:scan` | PASS | secretlint clean; exit 0 |
| 7 | test (Vitest) | `npm test` | PASS | 106 passed / 5 skipped (111 total) across 15 files; duration 3.40s |
| 8 | coverage | `npm run coverage` | PASS | 26.74% stmts / 67.47% branch (unchanged from Phase 2 baseline — no new source added this wave) |
| 9 | build | `npm run build -w @wtc/web` | PASS | 31/31 pages (+ 8 new teacher routes); all routes dynamic; compiled 3.0s |
| 10 | e2e | `npx playwright test` | PASS | 16/16 (8 tests × desktop + mobile); duration 1.8m; no flake |
| 11 | db:generate | `npm run db:generate -w @wtc/db` | PASS (informational) | "No schema changes, nothing to migrate" — confirms 0002 is not yet generated; 21 tables current |

### Gates NOT RUN (reason)

| # | Gate | Reason |
|---|------|--------|
| 12 | `npm run db:migrate -w @wtc/db` | Requires `DATABASE_URL` pointing at a real Postgres instance. Credentials unknown to the build agent. Docker absent. Real PG17 is present at 127.0.0.1:5432 but credentials not provided. |
| 13 | `npm run db:seed -w @wtc/db` | Same reason as db:migrate. |
| 14 | Real-PG harness (`REAL_POSTGRES_DATABASE_URL`) | Requires `REAL_POSTGRES_DATABASE_URL` set to `wtc_test` or `wtc_test_*`. Credentials unknown. 5 test cases inside `db-real-postgres.test.ts` skip automatically via `describe.skipIf(!run)`. |

### Vitest test count breakdown (observed)

| File | Tests | Notes |
|------|-------|-------|
| `tests/integration/db-persistence.test.ts` | 19 pass | PGlite; covers Phase 1.5–1.7 DB repos + TV + LMS thin |
| `tests/integration/db-real-postgres.test.ts` | 1 pass + 5 skip | Always-present availability test passes; real-PG suite skips (no URL) |
| `tests/integration/csrf-coverage.test.ts` | 3 pass | Static scan of `'use server'` files |
| `tests/integration/check-governance.test.ts` | 7 pass | governance fixture self-tests |
| `packages/analytics/src/metrics.test.ts` | 13 pass | computeMetrics, computeDrawdown, combineMetrics |
| `packages/entitlements/src/engine.test.ts` | 11 pass | State machine, fail-closed, bundles, reconcileExpiry |
| `packages/auth/src/rbac.test.ts` | 3 pass | can(), canActOnOwned() |
| `packages/auth/src/csrf.test.ts` | 3 pass | CSRF token round-trip |
| `packages/auth/src/session.test.ts` | 4 pass | hashToken, session token shape |
| `packages/crypto/src/vault.test.ts` | 5 pass | AES-256-GCM round-trip, tamper, rotation |
| `packages/axioma-bridge/src/handoff.test.ts` | 5 pass | ES256 sign/verify, expiry, aud |
| `packages/billing/src/provider.test.ts` | 3 pass | Webhook verify, idempotency, mock |
| `packages/bot-adapters/src/adapters.test.ts` | 7 pass | Mock adapters, warning aggregation |
| `packages/config/src/env.test.ts` | 12 pass | KEK validation, secret quality guards |
| `packages/shared/src/env-guards.test.ts` | 10 pass | Base64, entropy, placeholder checks |

### E2e screenshot inventory (observed in tests/e2e/screenshots/)

20 screenshots (10 tests × 2 projects): landing, pricing, app-overview, bot-tortila, axioma-terminal, security, admin-entitlements, admin-tradingview, bots-combined, bot-tortila-safety — all for desktop and mobile.

---

## Integration test plan for Phase 2.1 (Wave-2 implementer reference)

All new files go in `tests/integration/`. Each uses the same PGlite harness: one shared `beforeAll` that reads all `.sql` files from `packages/db/migrations/` in sort order and applies them. After 0002 lands, this automatically picks it up.

### Tests not blocked on migration 0002 (write and enable immediately)

**File: `tests/integration/exchange-key-vault.test.ts`**

Uses tables from 0000: `exchange_accounts`, `exchange_api_key_secrets`.

| # | Assertion |
|---|-----------|
| 1 | `addExchangeKey` inserts a sealed row; `SELECT * FROM exchange_api_key_secrets` returns a JSONB `sealed` column with fields `v`, `keyId`, `wrappedDek`, `payload` — no column named `api_key` or `api_secret`. |
| 2 | `sealed.payload` value is not equal to the original plaintext string (it is ciphertext). |
| 3 | `listExchangeKeys` return shape contains only `{id, userId, exchange, label, mode, keyMask}` — no `sealed`, `wrappedDek`, or `payload` field in any row. |
| 4 | `JSON.stringify(listExchangeKeys(...))` does not contain the strings `wrappedDek` or `payload`. |

**File: `tests/integration/rbac-matrix.test.ts`**

Pure in-process logic; no DB required.

| # | Assertion |
|---|-----------|
| 1 | `can(['user'], 'bot_config', 'create')` is `true`. |
| 2 | `can(['user'], 'bot_config', 'delete')` is `false` (key absent from MATRIX). |
| 3 | `can(['admin'], 'bot_config', 'delete')` is `true` (manage implies all). |
| 4 | `can(['teacher'], 'course', 'create')` is `true`. |
| 5 | `can(['user'], 'course', 'create')` is `false`. |
| 6 | `can(['user'], 'course', 'delete')` is `false`. |
| 7 | `can(['support'], 'audit_log', 'read')` is `true`. |
| 8 | `can(['user'], 'audit_log', 'read')` is `false`. |
| 9 | `canActOnOwned(['teacher'], 'course', 'update', 'tid1', 'tid2')` is `false` (ownership mismatch). |
| 10 | `canActOnOwned(['admin'], 'course', 'update', 'x', 'y')` is `true` (admin bypasses). |
| 11 | `can(['user'], 'tradingview_access', 'create')` is `true`. |
| 12 | `can(['user'], 'tradingview_access', 'manage')` is `false`. |
| 13 | `can(['admin'], 'entitlement', 'manage')` is `true`. |
| 14 | `can(['support'], 'entitlement', 'manage')` is `false`. |

**File: `tests/integration/analytics-aggregation.test.ts`**

Pure in-process; no DB for cases 1–6; case 7 uses `bot_metric_snapshots` (blocked on 0002).

| # | Assertion | Blocked? |
|---|-----------|---------|
| 1 | `computeMetrics` with 3 closed trades (2 wins, 1 loss) returns `closedPnl` = sum; `winRatePct` = 66.67; `profitFactor` = grossProfit / grossLoss. | No |
| 2 | Open positions contribute to `unrealizedPnl` only; `closedPnl` unchanged. | No |
| 3 | `computeMetrics` with no closed trades returns `winRatePct: null`, `profitFactor: null`, `roiOnMarginPct: null` — never 0. | No |
| 4 | `computeDrawdown` on monotonically increasing equity returns `maxDrawdownPct: 0`. | No |
| 5 | `computeDrawdown` on `[100, 80, 90, 70]` returns `maxDrawdownPct: 30`, `currentDrawdownPct: 30`. | No |
| 6 | `combineMetrics` on two `CanonicalMetricsInput` arrays sums `closedPnl`, `tradeCount`, `feesTotal` correctly. | No |
| 7 | `bot_metric_snapshots`: insert two snapshot rows for different bots; aggregated `walletEquity` sum correct. | Yes (0002) |

**File: `tests/integration/billing-entitlement-states.test.ts`**

Uses tables from 0000/0001: `entitlements`. No 0002 dependency.

| # | Assertion |
|---|-----------|
| 1 | `grantProduct(db, userId, 'club')` on a seeded user → `entitlementsOf` returns `status: 'active'`; `hasAccess` returns `true`. |
| 2 | `revokeProduct(db, userId, 'club')` → `hasAccess` returns `false`. |
| 3 | `applyBillingEvent(ent, 'refunded', now)` returns `status: 'refunded'`; update persisted via Drizzle; `entitlementsOf` reflects `status: 'refunded'`. |
| 4 | `applyBillingEvent(ent, 'chargeback', now)` returns `status: 'chargeback'`; `hasAccess` returns `false`. |
| 5 | `reconcileAllEntitlements(db, now)` for a row whose `currentPeriodEnd` is in the past and `graceUntil` is in the past transitions `status` to `expired`; DB row updated; `changed` return count is at least 1. |
| 6 | Manual grant after `revoked` state → `status: 'active'`; `hasAccess` returns `true`. |
| 7 | `entitlementsForPlan(userId, 'bundle_pro', now, {})` produces member product rows; `grantProduct` for each; `hasAccess` is `true` for each member. |
| 8 | `isGranting('UNKNOWN_STATUS')` returns `false` — fail-closed for DB corruption. |
| 9 | `nextStatus('BOGUS_STATE' as any, 'payment_succeeded')` returns `'manual_review'` — fail-closed for unknown state (exercises state-machine.ts line 89 default branch). |

**File: `tests/integration/csrf-new-actions.test.ts`**

Static scan; no DB.

| # | Assertion |
|---|-----------|
| 1 | Every `'use server'` file in `apps/web/src/app/(app)/**` calls `assertCsrf` at least once per action (extend existing CSRF scan). |
| 2 | Every `'use server'` file in `apps/web/src/app/teacher/**` calls `assertCsrf`. |
| 3 | Every `'use server'` file in `apps/web/src/app/admin/**` calls `assertCsrf` for `education`, `users`, `bots`, `products`, `system-health`. |
| 4 | Total `'use server'` file count found is >= the expected minimum (document the count after Phase 2.1 implementation lands). |

### Tests blocked on migration 0002 (use describe.skipIf until 0002 SQL exists on disk)

The guard for all 0002-blocked describes:
```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const HAS_0002 = existsSync(join(process.cwd(), 'packages', 'db', 'migrations', '0002_ecosystem_expansion.sql'));
describe.skipIf(!HAS_0002)('...', () => { ... });
```

**File: `tests/integration/bot-config-ownership.test.ts`** (requires `bot_config_versions`, `bot_instances`)

| # | Assertion |
|---|-----------|
| 1 | `addExchangeKey(db, {userId: userA, ...})` — `listExchangeKeys(db, userB)` returns 0 rows for that key. |
| 2 | `listExchangeKeys(db, userA)` shape has only `{id, userId, exchange, label, mode, keyMask}` — no `sealed` field. |
| 3 | Bot config: insert a `bot_configs` row for userA's bot instance; direct Drizzle query scoped to userB finds no rows. |
| 4 | `listBotConfigVersions(db, botInstanceId)` returns versions in DESC order. |
| 5 | `insertBotConfigVersion` for the same botInstanceId twice with different version numbers — no unique violation; both rows exist. |

**File: `tests/integration/tortila-config.test.ts`** (requires `bot_config_versions`)

| # | Assertion |
|---|-----------|
| 1 | Insert `bot_configs` row + call `insertBotConfigVersion`; read back via `listBotConfigVersions`; `config_json` equals what was written. |
| 2 | Two successive `insertBotConfigVersion` calls create two history rows (version sequence 1, 2). |
| 3 | Config JSONB with nested `{symbols, leverage, stages}` round-trips without loss. |
| 4 | User A cannot read User B's `bot_config_versions` (ownership check: WHERE bot_instance_id IN (SELECT id FROM bot_instances WHERE user_id = userA)). |

**File: `tests/integration/legacy-config.test.ts`** (requires `bot_config_versions`)

| # | Assertion |
|---|-----------|
| 1 | Insert a `bot_configs` row for a Legacy bot instance; `listBotConfigVersions` returns it; `config_json.rsi`, `config_json.take_profit_pct`, `config_json.balance_pct` survive. |
| 2 | `listBotConfigs(db, userId)` returns only rows whose `bot_instances.userId` equals the querying user. |

**File: `tests/integration/tv-access-full.test.ts`** (requires `tradingview_profiles`, `tradingview_access_grants`)

| # | Assertion |
|---|-----------|
| 1 | `upsertTradingViewProfile(db, {userId, tvUsername})` creates profile; `getTvProfile(db, userId)` returns it. |
| 2 | `createTvGrant(db, {...})` creates a grant record; `tradingview_profiles.current_grant_id` is updated in the same transaction. |
| 3 | `revokeTvGrant(db, grantId, adminId)` sets `revoked_at`, populates `revoked_by`, nulls `tradingview_profiles.current_grant_id`; audit row `tv_access.revoke` written in-txn with `actorUserId === adminId`. |
| 4 | `listTvGrantsForUser(db, userA_id)` does not return grants for userB. |
| 5 | `listAllTvGrants(db, {activeOnly: true})` excludes revoked grants. |
| 6 | `tradingview_access_requests.revoked_at` and `revoked_by` are populated after `revokeTvGrant`. |
| 7 | Existing `submitTvRequest` + `grantTv` + `revokeTv` flow: assert `listTvByUser` shows `status: 'revoked'`; `recentAuditEvents` contains both `tradingview.grant` and `tradingview.revoke` with the correct actor IDs. |

**File: `tests/integration/lms-full.test.ts`** (requires `teacher_profiles`, `enrollments`, `lesson_progress`, `pinned_links`)

| # | Assertion |
|---|-----------|
| 1 | `createTeacherProfile(db, {userId, displayName})` returns DTO with correct `userId`; audit row `education.teacher_profile_create` written. |
| 2 | `getTeacherProfile(db, userA_id)` does not return teacher profile for userB. |
| 3 | `upsertEnrollment(db, {userId, courseId})` creates enrollment; `listEnrollments(db, userId)` contains it; a second upsert does not create a duplicate (ON CONFLICT DO NOTHING). |
| 4 | `upsertLessonProgress(db, {userId, lessonId, percentComplete: 100, completed: true})` — `getLessonProgress(db, userId, lessonId)` returns `completed: true`. |
| 5 | `listCourseProgress(db, userA_id, courseId)` does not return progress rows for userB. |
| 6 | `markEnrollmentComplete(db, userId, courseId)` sets `completed_at`; audit row `education.course_completed` written. |
| 7 | `createCourse` + `createTeacherProfile` + `upsertEnrollment` + `upsertLessonProgress`: full chain persists in a single PGlite session without FK violations. |
| 8 | `createPinnedLink(db, {ownerType:'course', ownerId: courseId, ...})` — `listPinnedLinks(db, 'course', courseId)` returns it sorted by `sort_order`. |
| 9 | `deletePinnedLink` (soft-delete: sets `is_active=false`) — `listPinnedLinks` no longer returns it; audit row `education.pinned_link_delete` present. |
| 10 | `updateCourse` by Teacher B on Teacher A's course: the RBAC check at the route layer (`canActOnOwned(['teacher'], 'course', 'update', teacherB_id, teacherA_id)`) returns `false`. (This is a unit test of `canActOnOwned`, not a DB test.) |

---

## E2e additions for Phase 2.1

All specs belong in `tests/e2e/`. Dev server runs on port 3100 (in-memory). Login: `user@wtc.local / wtc-demo-pass-123`, `teacher@wtc.local / wtc-demo-pass-123`, `admin@wtc.local / wtc-demo-pass-123`.

### File: `tests/e2e/smoke.spec.ts` (extend existing)

Add to the existing 8 tests:

| Test | Key assertions |
|------|----------------|
| `/products/tortila` renders | `getByRole('heading', {name: 'Tortila Bot'})` visible; status < 400. |
| `/products/terminal` renders | `getByRole('heading', {name: 'Axioma Terminal'})` visible. |
| `/products/indicators` renders | `getByRole('heading', {name: 'TradingView Indicators'})` visible. |
| `/products/education` renders | `getByRole('heading', {name: 'Education'})` visible. |
| `/products` lists all products | At least 5 product cards visible. |
| `/app/bots` simulated banner | `getByText('Simulated data')` visible. |
| `/app/bots/legacy` renders | Heading visible; no 500 status. |
| `/app/billing` renders | `getByRole('heading', {name: 'Billing'})` visible. |
| `/app/support` renders | Support heading or form visible. |

### File: `tests/e2e/tv-access.spec.ts` (new)

| Test | Key assertions |
|------|----------------|
| User sees indicator access request form | Heading "Indicator access" visible; TradingView username input visible. |
| User submits TV request | Fill username, submit; success message or status row appears. |
| Admin sees TV queue | Login as admin; `/admin/tradingview-access`; submitted username visible. |
| Admin grant action | Grant button visible; click; row status changes to `granted`. |
| Admin revoke action | Revoke button visible; click; row status changes to `revoked`. |
| Memory backend badge | `getByText('storage: in-memory (dev)')` visible on indicators page. |
| Screenshots | `tv-request-{project}.png`, `tv-admin-queue-{project}.png`, `tv-granted-{project}.png`. |

### File: `tests/e2e/education.spec.ts` (new)

| Test | Key assertions |
|------|----------------|
| `/app/education` student view renders | Login as user; "Lessons & materials" heading; seeded course visible. |
| `/teacher` teacher dashboard | Login as teacher; "Your courses" heading; seeded course visible. |
| Teacher creates a new course | Click "New course"; fill title; submit; new course card appears. |
| Teacher course detail | Go to `/teacher/courses/{id}`; lesson list heading visible. |
| Admin `/admin/education` | Login as admin; all courses visible. |
| Student cannot access `/teacher` | Login as user; `/teacher` redirects or shows 403. |
| Memory backend badge | `getByText('storage: in-memory (dev)')` on `/app/education`. |
| Screenshots | `education-student-{project}.png`, `teacher-courses-{project}.png`, `admin-education-{project}.png`. |

### File: `tests/e2e/billing-entitlement.spec.ts` (new)

| Test | Key assertions |
|------|----------------|
| `/app/billing` shows active entitlements | Billing page lists seeded products; `active` chip visible; no raw `null` or `undefined` in DOM. |
| Admin entitlements panel | Login as admin; `/admin/entitlements`; user list visible; grant/revoke buttons visible. |
| Admin manual revoke | Click revoke; status changes to `revoked`; no 500. |
| Admin manual grant | Click grant; status changes to `active`. |
| Screenshots | `billing-user-{project}.png`, `admin-entitlements-action-{project}.png`. |

### File: `tests/e2e/bot-config.spec.ts` (new)

| Test | Key assertions |
|------|----------------|
| `/app/bots/tortila/settings` save/load | Fill config field; submit; success state visible. |
| `/app/bots/legacy/settings` renders | Settings heading visible; no 500. |
| Bot dashboard simulated-data banner | `/app/bots/tortila` — `getByText('Simulated data')` visible. |
| Bot risk warnings surfaced | `/app/bots/tortila` — "Risk & audit warnings" heading visible; at least one warning pill. |
| Screenshots | `bot-settings-tortila-{project}.png`, `bot-settings-legacy-{project}.png`. |

### Minimum screenshot inventory for Phase 2.1

All in `tests/e2e/screenshots/` as `{name}-desktop.png` and `{name}-mobile.png`:
`products-list`, `tortila-product`, `terminal-product`, `indicators-product`, `education-product`,
`app-bots-list`, `bot-legacy`, `bot-settings-tortila`, `bot-settings-legacy`,
`app-billing`, `tv-request`, `tv-admin-queue`, `tv-granted`,
`education-student`, `teacher-courses`, `admin-education`,
`billing-user`, `admin-entitlements-action`.

---

## Next actions

1. (HIGH, F-2) Wave-2 backend implementer: add the DB-name safety guard to `tests/integration/db-real-postgres.test.ts` `beforeAll` — first statement before `sql.unsafe(...)`.
2. (HIGH, F-1) Wave-2 backend implementer: write `packages/db/src/schema.ts` additions for all 18 REAL-in-0002 tables per the `docs/handoffs/20260530-0126-ecosystem-db-architect.md` column specs. Run `npm run db:generate -w @wtc/db` to produce `0002_ecosystem_expansion.sql`. This unblocks all 0002-gated integration tests.
3. (HIGH) Wave-2 backend implementer: add all repo functions listed in `docs/handoffs/20260530-0126-ecosystem-db-architect.md` §Repo functions to `packages/db/src/repositories.ts`.
4. (MEDIUM, F-3) Wave-2 tests implementer: add `reconcileAllEntitlements` to `tests/integration/billing-entitlement-states.test.ts`; seed a row with an expired `currentPeriodEnd` and assert `changed >= 1`.
5. (MEDIUM, F-4) Wave-2 tests implementer: extend `packages/entitlements/src/engine.test.ts` with the fail-closed unknown-status branch test and the no-op `nextStatus` branch tests.
6. (MEDIUM) Wave-2 tests implementer: write all 10 integration test files listed above; enable 0002-blocked describes with the `HAS_0002` guard.
7. (MEDIUM) Wave-2 tests implementer: write all 4 new e2e spec files alongside the UI implementation.
8. (LOW, F-9) Wave-2 tests implementer: add a Playwright test that POSTs a mock webhook to `/api/webhooks/billing` and asserts 200 + correct audit entry.
9. Operator: after migration 0002 SQL lands and gates 1–10 are green, provide `REAL_POSTGRES_DATABASE_URL=postgres://<creds>@127.0.0.1:5432/wtc_test` to enable gate 14 (real-PG harness, gates 12–13 require DATABASE_URL for migrate/seed).
