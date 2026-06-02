# ecosystem-tests-runner handoff

**Epoch:** 20260530-0126
**Wave:** 1 — READ-ONLY / PLAN (no gates run, no code or shared files changed)

## Scope

Phase 2 test and gate plan. Covers Part 12 integration test needs, Playwright e2e specs,
the sequential Wave-2 gate order with RUN-ability annotations, and coverage-risk notes.
Source of truth: Phase 1.7 baseline (93 pass / 5 skip Vitest across 14 files; 14/14 e2e;
26.92% stmt / 64.67% branch; 31/31 pages).

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/EDUCATION_LMS_PLAN.md` (lines 1–60)
- `package.json` (root)
- `playwright.config.ts`
- `vitest.config.ts`
- `tests/integration/db-persistence.test.ts` (full)
- `tests/integration/db-real-postgres.test.ts` (full)
- `tests/integration/csrf-coverage.test.ts` (full)
- `tests/e2e/smoke.spec.ts` (full)
- `packages/entitlements/src/engine.test.ts` (full)
- `packages/entitlements/src/state-machine.ts` (full)
- `packages/crypto/src/vault.test.ts` (full)
- `packages/auth/src/rbac.test.ts` (full)
- `packages/auth/src/rbac.ts` (full)
- `packages/auth/src/session.test.ts` (full)
- `packages/analytics/src/metrics.ts` (full)
- `packages/billing/src/provider.test.ts` (full)
- `packages/billing/src/webhook.ts` (full)
- `packages/bot-adapters/src/adapters.test.ts` (full)
- `packages/db/src/repositories.ts` (full)
- `packages/db/src/schema.ts` (first 80 lines)
- `packages/lms/src/index.ts` (full)
- `packages/tradingview-access/src/index.ts` (first 60 lines)

## Files changed

None — read-only audit.

---

## Integration test plan

All new tests belong in `tests/integration/` (picked up by `vitest.config.ts` glob
`tests/integration/**/*.test.ts`). PGlite is the real-engine path; each new file follows
the pattern in `db-persistence.test.ts` (one `beforeAll` that runs migrations, then
`describe` blocks).

### File: `tests/integration/bot-config-ownership.test.ts`

Covers: bot-config ownership (User A cannot read or edit User B config), exchange-key
ownership (ciphertext only, never plaintext across user boundaries).

| # | Assertion |
|---|-----------|
| 1 | `addExchangeKey(db, {userId: userA, ...})` — `listExchangeKeys(db, userB)` returns 0 rows for that key. |
| 2 | `JSON.stringify(listExchangeKeys(db, userA))` does not contain `wrappedDek` or `payload`. |
| 3 | `listExchangeKeys(db, userA)` does not JOIN `exchange_api_key_secrets` (asserted by checking the shape: only `{id, userId, exchange, label, mode, keyMask}` fields present, no `sealed` field). |
| 4 | `addExchangeKey` + `addExchangeKey` for the same user returns two separate view rows; `listExchangeKeys` count is 2. |
| 5 | Concurrent `addExchangeKey` x2 for userA resolves without throw and both rows persist (no txn collision). |

### File: `tests/integration/exchange-key-vault.test.ts`

Covers: vault envelope — ciphertext only stored; no plaintext ever surfaces.

| # | Assertion |
|---|-----------|
| 1 | `addExchangeKey` inserts a sealed row; direct DB `SELECT` on `exchange_api_key_secrets` returns a `sealed` JSONB with `v`, `keyId`, `wrappedDek`, `payload` fields and NO field named `apiKey` or `apiSecret`. |
| 2 | The `sealed.payload` value is not equal to the original plaintext (i.e., it is ciphertext, not the raw string). |
| 3 | `listExchangeKeys` never returns `sealed`, `wrappedDek`, or `payload` in any row. |
| 4 | Confirm `exchange_api_key_secrets` has no column named `api_key` or `api_secret` by querying `information_schema.columns` (PGlite supports this). |

### File: `tests/integration/tortila-config.test.ts`

Covers: Tortila config save/load round-trip.

| # | Assertion |
|---|-----------|
| 1 | Insert a `bot_configs` row via Drizzle with `botInstanceId` pointing to a seeded Tortila `bot_instances` row; read it back; `config` JSONB equals what was written. |
| 2 | A second insert for the same `botInstanceId` creates a second `bot_config_versions` history row (version sequence increases). |
| 3 | Config JSONB may contain a `symbols` array, `leverage`, `stages` — assert the round-trip does not lose nested objects. |
| 4 | User A cannot read User B's `bot_configs` rows (ownership check via direct DB query: `WHERE bot_instance_id IN (SELECT id FROM bot_instances WHERE user_id = ?)` returns nothing for the wrong user). |

### File: `tests/integration/legacy-config.test.ts`

Covers: Legacy bot config save/load round-trip.

| # | Assertion |
|---|-----------|
| 1 | Insert a `bot_configs` row for a Legacy bot instance; read back via `bot_instance_id`; assert `config.rsi`, `config.take_profit_pct`, `config.balance_pct` survive the round-trip. |
| 2 | `listBotConfigs(db, userId)` (to be implemented) returns only rows whose `bot_instances.userId` equals the querying user. |
| 3 | An attempt to write a config whose `bot_instance_id` references another user's instance raises a constraint error (FK to `bot_instances.user_id` enforced at the DB level). |

### File: `tests/integration/analytics-aggregation.test.ts`

Covers: analytics aggregation (per-bot + combined), closed vs unrealized PnL distinction,
drawdown calculation.

| # | Assertion |
|---|-----------|
| 1 | `computeMetrics` with 3 closed trades (2 wins, 1 loss) returns `closedPnl` = sum of `realizedPnl`; `winRatePct` = 66.67; `profitFactor` = grossProfit / grossLoss. |
| 2 | Open positions contribute to `unrealizedPnl` only; `closedPnl` is unchanged. |
| 3 | `computeMetrics` with no closed trades returns `winRatePct: null`, `profitFactor: null`, `roiOnMarginPct: null` (never 0). |
| 4 | `computeDrawdown` on a monotonically increasing curve returns `maxDrawdownPct: 0`, `currentDrawdownPct: 0`. |
| 5 | `computeDrawdown` on `[100, 80, 90, 70]` returns `maxDrawdownPct: 30` (from peak 100 to trough 70) and `currentDrawdownPct: 30`. |
| 6 | Combined-bot aggregation: two separate `computeMetrics` results summed into a combined view correctly accumulates `closedPnl`, `tradeCount`, `feesTotal`. (Test via a helper that merges two `CanonicalMetricsInput` arrays.) |
| 7 | `bot_metric_snapshots` table: insert two snapshot rows for different bots; query combined sum via Drizzle aggregation; confirm `walletEquity` sums correctly. |

### File: `tests/integration/tv-access-full.test.ts`

Covers: TV request/grant/revoke with in-txn audit; all edge cases not in `db-persistence.test.ts`.

| # | Assertion |
|---|-----------|
| 1 | `submitTvRequest` when user has no `tradingview_indicators` entitlement — confirm the service layer (`TvAccessService`) throws `No active tradingview_indicators entitlement`. |
| 2 | A user may have at most one `pending` TV request at a time — a second `submitTvRequest` before the first is resolved must either throw or be idempotent per the contract (assert the expected behavior and document it as a contract decision). |
| 3 | `grantTv` by a non-admin user ID — the audit row `actorRole` must never be `'user'` when the grant path is used (ensure no path exists where a user-role actor can call `grantTv`). |
| 4 | After `revokeTv`, `listTvByUser` shows `status: 'revoked'`; `listAllTv` also shows `status: 'revoked'`. |
| 5 | The `tradingview.submit` audit row `actorUserId` equals the requesting user's ID. |
| 6 | The `tradingview.grant` audit row `actorUserId` equals the admin's ID and `actorRole` is `'admin'`. |
| 7 | The `tradingview.revoke` audit row `actorUserId` equals the admin's ID. |
| 8 | Grant + revoke in the same test; `recentAuditEvents` returns both; neither is missing if the other succeeded (transactional guarantee). |

### File: `tests/integration/lms-full.test.ts`

Covers: LMS full flows — course, lesson, material, enrollment, progress, ownership, entitlement gating.
Depends on Phase 1.8 migration `0002` landing (teacher_profiles, enrollments, lesson_progress, pinned_links).

| # | Assertion |
|---|-----------|
| 1 | `createCourse` by Teacher A returns a DTO with `ownerTeacherId === teacherA.id`; audit row `education.course_create` recorded. |
| 2 | `updateCourse` by Teacher B on Teacher A's course throws ownership error. |
| 3 | `updateCourse` by admin on any teacher's course succeeds. |
| 4 | `createLesson` inside Teacher A's course by Teacher B throws ownership error. |
| 5 | `listLessonsForStudent(courseId, false)` returns `[]` (no education access, fail-closed). |
| 6 | `listLessonsForStudent(courseId, true)` on an unpublished course returns `[]`. |
| 7 | `listLessonsForStudent(courseId, true)` on a published course with 3 lessons (1 unpublished) returns 2 in `order` sequence. |
| 8 | `enrollUser(db, userId, courseId)` — `listEnrollments(db, userId)` shows the enrollment. |
| 9 | `markLessonComplete(db, userId, lessonId, true)` — `getLessonProgress(db, userId, courseId)` shows `completedAt` set. |
| 10 | `markLessonComplete` with `hasEducationAccess = false` throws `no education access`. |
| 11 | `addMaterial(db, lessonId, {...})` — `listMaterials(db, lessonId)` returns the material. |
| 12 | `deleteCourse` by Teacher B on Teacher A's course throws ownership error. |
| 13 | `listCoursesForTeacher` (non-admin) returns only the teacher's own courses; never another teacher's draft. |
| 14 | `listPublishedCourses` excludes unpublished courses regardless of calling user. |
| 15 | All create/update/delete operations write an `education.*` audit row in the same transaction. |

### File: `tests/integration/billing-entitlement-states.test.ts`

Covers: billing entitlement state transitions end-to-end in the DB layer.

| # | Assertion |
|---|-----------|
| 1 | Insert entitlement with `status: 'none'`; apply `payment_succeeded` via `grantProduct` → `status: 'active'`. |
| 2 | `revokeProduct` from `active` → `status: 'revoked'`; `hasAccess` returns `false`. |
| 3 | `applyBillingEvent(ent, 'refunded', now)` → `status: 'refunded'`; persist via DB update; verify `listEntitlements` returns `status: 'refunded'`. |
| 4 | `applyBillingEvent(ent, 'chargeback', now)` from `active` → `status: 'chargeback'`; `hasAccess` returns `false`. |
| 5 | `reconcileAllEntitlements(db, now)` for a row whose `currentPeriodEnd` is in the past → `status` transitions to `grace` or `expired`; DB row updated. |
| 6 | Manual grant after `revoked` state → `status: 'active'`; `hasAccess` returns `true` again. |
| 7 | Bundle expansion: `entitlementsForPlan(userId, 'bundle_pro', now, {})` produces `active` rows for all member products; all persist via `grantProduct` for each; `hasAccess` is `true` for each member. |
| 8 | An unknown/invalid status string in the DB → `isGranting` returns `false` (fail-closed for DB corruption). |

### File: `tests/integration/rbac-matrix.test.ts`

Covers: RBAC matrix completeness for all new Phase-2 resources and actions.

| # | Assertion |
|---|-----------|
| 1 | `can(['user'], 'bot_config', 'create')` is `true`; `can(['user'], 'bot_config', 'delete')` is `false`. |
| 2 | `can(['teacher'], 'course', 'create')` is `true`; `can(['user'], 'course', 'create')` is `false`. |
| 3 | `can(['teacher'], 'course', 'delete')` is `true`; `can(['user'], 'course', 'delete')` is `false`. |
| 4 | `can(['support'], 'audit_log', 'read')` is `true`; `can(['user'], 'audit_log', 'read')` is `false`. |
| 5 | `canActOnOwned(['teacher'], 'course', 'update', 'tid1', 'tid2')` is `false` (ownership mismatch). |
| 6 | `canActOnOwned(['admin'], 'course', 'update', 'anything', 'other')` is `true` (admin bypasses ownership). |
| 7 | `can(['user'], 'tradingview_access', 'create')` is `true`; `can(['user'], 'tradingview_access', 'manage')` is `false`. |
| 8 | `can(['admin'], 'entitlement', 'manage')` is `true`; every non-admin role for `manage` is `false`. |
| 9 | `can(['user'], 'exchange_key', 'read')` is `true`; `can(['user'], 'exchange_key', 'manage')` is `false`. |

### File: `tests/integration/csrf-new-actions.test.ts`

Extends `tests/integration/csrf-coverage.test.ts` for Phase-2 server actions.

| # | Assertion |
|---|-----------|
| 1 | Every `'use server'` file in `apps/web/src/app/(app)/**` calls `assertCsrf` at least once per action (extend the existing regex scan to include new route groups for Phase 2). |
| 2 | Every `'use server'` file in `apps/web/src/app/teacher/**` calls `assertCsrf`. |
| 3 | Every `'use server'` file in `apps/web/src/app/admin/**` calls `assertCsrf` (currently covered for `entitlements` and `tradingview-access`; extend for `education`, `users`, `bots`, `products`, `system-health`). |
| 4 | Confirm the count of `'use server'` files found is >= the expected minimum (document the expected count in the test after Phase 2 implementation lands). |

### Part-11 real-PG guard (existing file: `tests/integration/db-real-postgres.test.ts`)

This already exists and guards by `describe.skipIf(!REAL_POSTGRES_DATABASE_URL)`. The DB-name
safety check must be added to the `beforeAll`:

```
// SAFETY: this harness is destructive. Only run against wtc_test or wtc_test_*.
const dbName = new URL(URL as string).pathname.replace(/^\//, '');
if (!/^wtc_test(_[a-zA-Z0-9_]+)?$/.test(dbName)) {
  throw new Error(`SAFETY: real-PG harness refuses to run against '${dbName}'. Use wtc_test or wtc_test_*.`);
}
```

This check must fire BEFORE any migration SQL is executed. The test file must be updated in Wave 2
(it is not read-only; the guard is missing and is a hard boundary per the task brief).

---

## E2E test plan

All specs belong in `tests/e2e/` (Playwright config `testDir: './tests/e2e'`). Two projects:
`desktop` (1440×900) and `mobile` (390×844), both Chromium. Screenshots to `tests/e2e/screenshots/`.
The dev server runs on port 3100 (in-memory demo; no `DATABASE_URL`); login credentials:
`user@wtc.local / wtc-demo-pass-123`, `teacher@wtc.local / wtc-demo-pass-123`,
`admin@wtc.local / wtc-demo-pass-123`.

### File: `tests/e2e/smoke.spec.ts` (extend existing)

Current coverage: landing, pricing, legacy-bot product page, user dashboard + tortila + terminal + security, admin entitlements + tradingview queue, indicators + education (memory backend), teacher course console.

Additions needed in Phase 2:

| Test | Assertions |
|------|------------|
| `/products/tortila` renders | `getByRole('heading', {name: 'Tortila Bot'})` visible; status < 400. |
| `/products/terminal` renders | `getByRole('heading', {name: 'Axioma Terminal'})` visible. |
| `/products/indicators` renders | `getByRole('heading', {name: 'TradingView Indicators'})` visible. |
| `/products/education` renders | `getByRole('heading', {name: 'Education'})` visible. |
| `/products` lists all products | At least 5 product cards visible. |
| `login -> /app overview` screenshot parity | heading `Account overview` visible; screenshot saved as `app-overview-{project}.png`. |
| `/app/bots` list shows Tortila + Legacy | Both bot names visible; `Simulated data` banner visible. |
| `/app/bots/legacy` dashboard renders | `getByRole('heading', {name: 'Legacy Bot'})` visible; warning pill visible. |
| `/app/bots/tortila/settings` renders | Heading visible; no 500 status. |
| `/app/bots/tortila/trades` renders | Heading visible; mock trade rows OR empty state. |
| `/app/bots/tortila/equity` renders | Equity chart heading visible. |
| `/app/bots/tortila/positions` renders | Positions heading visible. |
| `/app/bots/tortila/safety` renders | Safety events heading visible. |
| `/app/billing` renders | `getByRole('heading', {name: 'Billing'})` visible; entitlement list shown. |
| `/app/products` (user products) renders | Product cards visible. |
| `/app/support` renders | Support form or heading visible. |
| `/app/terminal` Axioma link present | Link or button to open Axioma visible. |

### File: `tests/e2e/tv-access.spec.ts` (new)

| Test | Assertions |
|------|------------|
| User sees `/app/indicators` request form | `getByRole('heading', {name: 'Indicator access'})` visible; form with TradingView username input visible. |
| User submits TV request (happy path) | Fill username, submit; success message or status row appears. |
| Admin can see TV request in queue | Login as admin; `/admin/tradingview-access`; submitted username visible in the queue. |
| Admin grant action renders confirmation | Grant button visible; click it; row status changes to `granted` (or success toast). |
| Admin revoke action renders confirmation | Revoke button visible; click it; row status changes to `revoked`. |
| Memory backend badge present | `getByText('storage: in-memory (dev)')` visible on indicators page (no DATABASE_URL in e2e). |
| Screenshots | `tv-request-{project}.png`, `tv-admin-queue-{project}.png`, `tv-granted-{project}.png`. |

### File: `tests/e2e/education.spec.ts` (new)

| Test | Assertions |
|------|------------|
| `/app/education` student view renders enrolled courses | Login as `user@wtc.local`; course list heading visible; `Risk Management Fundamentals` present (seeded). |
| `/teacher` teacher dashboard shows own courses | Login as `teacher@wtc.local`; `Your courses` heading; seeded course title present. |
| Teacher can create a new course | Go to `/teacher`; click `New course`; fill title; submit; new course card appears. |
| Teacher course detail renders | Go to `/teacher/courses/{id}`; lesson list heading visible. |
| Admin `/admin/education` page renders | Login as admin; `/admin/education`; all courses visible including other teachers'. |
| Student cannot access `/teacher` routes | Login as `user@wtc.local`; `GET /teacher` redirects or shows 403/redirect to login. |
| Memory backend badge on education page | `getByText('storage: in-memory (dev)')` on `/app/education`. |
| Screenshots | `education-student-{project}.png`, `teacher-courses-{project}.png`, `admin-education-{project}.png`. |

### File: `tests/e2e/billing-entitlement.spec.ts` (new)

| Test | Assertions |
|------|------------|
| `/app/billing` shows active entitlements | Login as user; billing page lists at least `tortila_bot` and `education` products (seeded active). |
| Entitlement status chips visible | `active` chip/badge is visible for at least one product; no raw `null` or `undefined` in the DOM. |
| Admin entitlements panel shows all users | Login as admin; `/admin/entitlements`; user list present; grant/revoke buttons visible. |
| Admin manual revoke action | Click revoke for a user product; status changes to `revoked`; page does not 500. |
| Admin manual grant action | Click grant; status changes to `active`. |
| Screenshots | `billing-user-{project}.png`, `admin-entitlements-action-{project}.png`. |

### File: `tests/e2e/bot-config.spec.ts` (new)

| Test | Assertions |
|------|------------|
| `/app/bots/tortila/settings` save/load | Navigate; fill at least one config field; submit; success state or toast visible; navigate away and back; value persists (in-memory demo). |
| `/app/bots/legacy/settings` renders | Settings heading visible; no 500. |
| Bot dashboard `Simulated data` banner | `/app/bots/tortila` — banner text `Simulated data` visible. |
| Bot risk warnings are surfaced | `/app/bots/tortila` — `Risk & audit warnings` heading visible; at least one warning pill visible. |
| Screenshots | `bot-settings-tortila-{project}.png`, `bot-settings-legacy-{project}.png`. |

### Screenshot inventory (Phase 2 additions)

All screenshots land in `tests/e2e/screenshots/` following the `{name}-{project}.png` pattern.
Phase 2 must produce at minimum:
`products-list`, `tortila-product`, `terminal-product`, `indicators-product`, `education-product`,
`app-bots-list`, `bot-legacy`, `bot-settings-tortila`, `bot-settings-legacy`,
`app-billing`, `tv-request`, `tv-admin-queue`, `tv-granted`,
`education-student`, `teacher-courses`, `admin-education`,
`billing-user`, `admin-entitlements-action` — each for both `desktop` and `mobile` projects.

---

## Gate sequence + RUN-ability

Run gates **strictly in this order** in Wave 2. Do not run a later gate if an earlier gate is RED.

| # | Gate command | RUN-able? | Reason if NOT RUN |
|---|-------------|-----------|-------------------|
| 1 | `npm run governance:check` | RUN | Zero-dep, fs-only. First gate always. |
| 2 | `npm run check:core` | RUN | Zero-dep node --strip-types smokes. |
| 3 | `npm run lint` | RUN | ESLint 9, no network needed. |
| 4 | `npm run typecheck` | RUN | tsc --noEmit on packages. |
| 5 | `npm run typecheck -w @wtc/web` | RUN | tsc --noEmit on the Next app. |
| 6 | `npm run secret:scan` | RUN | secretlint, no network needed. |
| 7 | `npm test` (Vitest) | RUN | PGlite in-process; no DB creds needed. Includes all new integration tests. |
| 8 | `npm run coverage` | RUN | Vitest coverage; no DB creds needed. |
| 9 | `npm run build -w @wtc/web` | RUN | Next.js build; no DB creds needed. Also validates `instrumentation.ts` no-secrets build. |
| 10 | `npm run e2e` | RUN | Playwright (Chromium already installed). Runs against in-memory dev server on port 3100. |
| 11 | `npm run db:generate -w @wtc/db` | RUN | Generates migrations from schema. No DB creds needed. Run after any schema change in Phase 2. |
| 12 | `npm run db:migrate -w @wtc/db` | NOT RUN | Requires `DATABASE_URL` pointing at a real Postgres (credentials unknown; Docker absent). Real PG17 is at `127.0.0.1:5432` but credentials unknown to build agent. |
| 13 | `npm run db:seed -w @wtc/db` | NOT RUN | Requires `DATABASE_URL`. Same reason as above. |
| 14 | `npm test -- tests/integration/db-real-postgres.test.ts` (with `REAL_POSTGRES_DATABASE_URL` set) | NOT RUN | Requires `REAL_POSTGRES_DATABASE_URL` pointing at `wtc_test` or `wtc_test_*`. Credentials unknown. Skipped automatically by `describe.skipIf`. |

**CI gate** (`npm run ci:local`) covers gates 1–9 in a single chained run and is the minimum
bar for a green phase. Gate 10 (e2e) runs separately after `ci:local`.

**Wave-2 minimum bar for a green phase:** gates 1–10 all green. Gates 12–14 remain NOT RUN
until Postgres credentials are provided, which is explicitly documented and not a gate failure.

---

## Findings

### F-1 (HIGH) — real-PG harness missing DB-name safety guard

**Evidence:** `tests/integration/db-real-postgres.test.ts` line 47 — `beforeAll` runs migrations
immediately after pool creation with no check on the database name. The task brief (HARD BOUNDARIES)
requires a check that `REAL_POSTGRES_DATABASE_URL` points at `wtc_test` or `wtc_test_*` BEFORE any
destructive SQL is executed.

**Recommendation (Wave 2):** Add the following as the first statement of `beforeAll`, before the
migration loop:
```ts
const dbName = new URL(URL as string).pathname.replace(/^\//, '');
if (!/^wtc_test(_[a-zA-Z0-9_]+)?$/.test(dbName)) {
  throw new Error(
    `SAFETY: real-PG harness refuses to run against '${dbName}'. ` +
    `Only wtc_test or wtc_test_* databases are permitted for destructive tests.`
  );
}
```

### F-2 (MEDIUM) — LMS full contract tests blocked on Phase 1.8 migration

**Evidence:** `packages/db/src/repositories.ts` line 301 states "NOT the full contract —
teacher_profiles / enrollments / lesson_progress / pinned_links are Phase 1.8". The integration
tests for enrollment, progress, and materials depend on migration `0002` which does not exist yet.

**Recommendation:** The `lms-full.test.ts` test cases 8–11 (enrollment, progress, materials) must
be skipped via `describe.skipIf` or a feature flag until migration `0002` lands. Test cases 1–7 and
12–15 can be written and enabled now against the existing thin model.

### F-3 (MEDIUM) — TV duplicate-request contract undefined

**Evidence:** `packages/tradingview-access/src/index.ts` and `packages/db/src/repositories.ts`
`submitTvRequest` have no constraint preventing a user from submitting a second pending request.
Test case F-3 in `tv-access-full.test.ts` above documents this as a contract gap that must be
decided (throw, or silently return the existing pending row, or allow multiple).

**Recommendation:** Define the contract in `TRADINGVIEW_ACCESS_PLAN.md` before implementing the
test assertion. The test should document the decision explicitly.

### F-4 (LOW) — `can(['user'], 'bot_config', 'delete')` is implicitly false but not tested

**Evidence:** `packages/auth/src/rbac.ts` line 28 — `bot_config: { read: ['user', 'admin'], create: ['user'], update: ['user'] }` — `delete` is absent (only admin via `manage` could delete). There is no test asserting this. Add to `rbac-matrix.test.ts`.

### F-5 (LOW) — analytics aggregation has no combined-bot test

**Evidence:** `packages/analytics/src/metrics.ts` `computeMetrics` is tested at the unit level
but there is no test combining two bot metric sets (Tortila + Legacy combined portfolio view).
The `bot_metric_snapshots` table schema exists but the aggregation over multiple bots is untested.

---

## Coverage risk notes

The following new code paths are hardest to cover and carry the highest risk of silent regression:

1. **Webhook route handler** — `packages/billing/src/webhook.ts` is unit-tested but the Next.js
   route handler (`apps/web/src/app/api/webhooks/billing/route.ts` — if it exists or is added in
   Phase 2) is an `apps/web` file excluded from Vitest (`vitest.config.ts` line 9). It would require
   either a Playwright test hitting the endpoint or moving the handler logic into a package. Current
   coverage: 0% (apps/web excluded).

2. **`reconcileAllEntitlements` worker path** — `packages/db/src/repositories.ts` lines 371–383.
   The function is present but not called by any current Vitest test. It is invoked only by the
   worker. Adding it to `billing-entitlement-states.test.ts` is the safest path.

3. **`sweepTvExpiry` concurrent safety** — Only tested sequentially. Under a real Postgres with two
   concurrent sweeps, the `WHERE status = 'granted'` read-then-update is not atomic and could double-
   process. This requires either `SELECT ... FOR UPDATE SKIP LOCKED` or a `status = 'expired'` update
   guard. Only exercisable in the real-PG harness (`db-real-postgres.test.ts`).

4. **LMS `markComplete` / `enrollUser` paths** — Do not exist yet in `packages/db/src/repositories.ts`.
   They will be added in Phase 1.8. Until then, coverage of lesson progress is zero at the DB layer.

5. **Exchange key vault → app route binding** — The vault seals in `packages/crypto`; `addExchangeKey`
   in `packages/db` accepts the sealed blob; but the server action in `apps/web` that calls both
   (seal then store) is in `apps/web` and excluded from Vitest. The connection between the two is only
   exercised by e2e (security page). An integration test that calls the full chain (vault.seal → addExchangeKey → listExchangeKeys → assert no plaintext) would close this gap — this is the
   `exchange-key-vault.test.ts` plan above.

6. **RBAC for teacher object-ownership on new route actions** — The `canActOnOwned` function is tested
   at the unit level, but the Next.js server actions that call it (teacher course/lesson actions) are in
   `apps/web` and not in Vitest scope. These are only covered by Playwright smoke tests which do not
   attempt cross-teacher mutations. An explicit e2e test (Teacher B tries to edit Teacher A's course via
   form submit) would close this gap but requires two teacher accounts in seed data.

7. **Billing state transitions at the route layer** — `applyBillingEvent` is unit-tested in
   `packages/entitlements`; `grantProduct`/`revokeProduct` are integration-tested via PGlite; but
   the webhook route handler that ties them together is in `apps/web` and untested. This is the
   highest-risk untested path for the billing feature.

---

## Decisions

- All new integration tests use PGlite (same pattern as `db-persistence.test.ts`) so they run
  without DB credentials in both CI and local development.
- The real-PG safety guard (F-1) is a correctness fix, not a new feature test; it must land in
  Wave 2 before the real-PG harness is considered safe to run against the local PG17.
- LMS tests for Phase 1.8 features use `describe.skipIf` conditioned on a
  `PHASE_18_LMS` env flag (or detection of migration `0002` presence) to prevent false failures
  when running the current tree.
- E2e tests that require two distinct teacher accounts will need seed data to be extended in Phase 2.
  This must be done in `packages/db/src/seed.ts`, not in the test fixture directly.

## Risks

- Phase 1.8 migration `0002` is a prerequisite for 7 of the 15 LMS integration test cases.
  If Phase 1.8 slips, those tests will be blocked.
- `sweepTvExpiry` concurrency (F-3 coverage note #3) is only exercisable under real Postgres.
  Until DB credentials are provided, this race condition cannot be validated.
- The governance check (`npm run governance:check`) will need to accept this handoff as a
  new current-epoch per-agent file. The Phase 2 aggregate handoff must cite this file by path.

## Verification / tests

This is a plan document; no tests were run. The Wave-2 gate runner agent will execute the
full gate sequence and report observed results.

## Next actions

1. Wave 2 implementer: add the DB-name safety guard to `tests/integration/db-real-postgres.test.ts`
   `beforeAll` (F-1, HIGH).
2. Wave 2 implementer: create the 8 new integration test files listed above; enable Phase-1.8-
   dependent cases with `describe.skipIf` until migration `0002` lands.
3. Wave 2 implementer: extend `tests/e2e/smoke.spec.ts` with the product page additions; add
   `tv-access.spec.ts`, `education.spec.ts`, `billing-entitlement.spec.ts`, `bot-config.spec.ts`.
4. Wave 2 gate runner: run gates 1–10 in order; report each as RUN/GREEN, RUN/RED, or NOT RUN
   with exact file:line evidence for any failure.
5. Operator: after gates are green, provide Postgres credentials (`wtc_test`) to enable gates 12–14
   and the real-PG harness.
