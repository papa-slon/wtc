# QA / Gates Auditor Handoff — Phase 2.4 Read-Only Audit Wave

**Epoch:** 20260530-1355
**Agent:** ecosystem-qa-gates-auditor
**Workstream:** H (test matrix / QA gates)
**Phase:** 2.4 (Real Bot Read-Only + Access Ops + Production Readiness Spine)

---

## Scope

Pre-edit baseline gate run for Phase 2.4, capturing the exact state left by Phase 2.3
(epoch 20260530-1145). No code or doc edits are made. In addition to running all
read-only gates, this handoff specifies the complete Phase 2.4 test matrix
(files + cases) that the tests-runner agent must add.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `tests/integration/billing-webhook.test.ts`
- `tests/integration/phase23-visible-progress.test.ts`
- `tests/integration/lms-fixes.test.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/db-0002.test.ts`
- `tests/integration/db-persistence.test.ts`
- `tests/integration/db-real-postgres.test.ts`
- `tests/integration/check-governance.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/mock-tortila.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/analytics/src/metrics.ts` (header / type section)
- `packages/db/src/repositories.ts` (full)
- `packages/entitlements/src/engine.test.ts`
- `packages/crypto/src/vault.test.ts`
- `packages/auth/src/rbac.test.ts`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `apps/web/src/features/tv/actions.ts`
- `apps/web/src/features/admin/queries.ts`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py` (full — JSON API shapes)
- All handoff files at epoch 20260530-1145 (via glob listing)

---

## Files changed

None — read-only audit

---

## Findings

### Finding 1
**Severity:** MEDIUM
**Evidence:** `npm test` (first invocation) — Vitest exited with code 1, output line:
```
Error: EBUSY: resource busy or locked,
  open 'C:\Users\maxib\AppData\Local\Temp\uZvZ61N4q0EUcPV1NW_ul\ssr\40b9f1f37d5bd759c353e90078138580f67eb091'
```
All 22 test files (163/5) passed their own assertions; the unhandled error came from Vitest's
internal SSR-cache file write racing a prior PGlite cleanup on Windows. Second and third runs:
23 files, 171/5 (176 total), exit code 0. The inconsistent file count (22 vs 23) on the first
run is explained by test-collection timing.
**Recommendation:** This is the known Windows harness EBUSY gotcha (per memory). The tests
themselves pass. Document as intermittent; do NOT treat as a test failure. If it persists,
add `rimraf` of the Vitest temp SSR dir as a pre-test step in `package.json`.
**Target Workstream:** H

### Finding 2
**Severity:** MEDIUM
**Evidence:** `apps/web/src/features/tv/actions.ts:100-114` — `enhancedGrantAction` calls
`grantTv(db, requestId, actor.id, now, durationMs)` on line 100, then `createTvGrant(db, {...})`
on line 105. Each is in its own DB transaction. If `createTvGrant` throws (e.g., a unique
constraint or DB error), `tradingview_access_requests.status` is already `'granted'` with no
corresponding row in `tradingview_access_grants`. This is confirmed in the comment at line 10
of the same file ("both steps atomic" enhancement tracked).
**Recommendation:** Phase 2.4 must wrap both `grantTv` + `createTvGrant` in a single `db.transaction()` call in the repo layer (or a new atomic `atomicTvGrant` repo function). The test matrix must cover: (a) rollback when `createTvGrant` fails, (b) no orphaned request-row left in `'granted'` state, (c) duplicate grant rejected cleanly.
**Target Workstream:** C (TV access)

### Finding 3
**Severity:** MEDIUM
**Evidence:** `apps/web/src/features/tv/actions.ts:123-148` — `enhancedRevokeAction` validates
`reason` (line 130) and assigns it to `_reason` (line 137), then calls `revokeTv(db, requestId, actor.id, Date.now())` (line 142) with no `reason` parameter. The `void _reason` on line 146 is an explicit acknowledgement. `revokeTv` in `packages/db/src/repositories.ts:307-312` has no `reason` param; the audit row records `{ status: 'revoked' }` without reason. `revokeTvGrant` is not called at all.
**Recommendation:** Phase 2.4 must: (a) add an optional `reason?: string` parameter to `revokeTv` in `repositories.ts:307` and thread it into the audit `after` payload; (b) wire `revokeTvGrant` from the `requestId` (load the current grant via `listTvGrantsForUser` then call `revokeTvGrant(db, grantId, actorId, reason)`).
**Target Workstream:** C

### Finding 4
**Severity:** HIGH
**Evidence:** `apps/web/src/app/api/billing/webhook/route.ts:89-91` — when `event.userId` is
missing (metadata absent, or resolution fails), the route returns `200 OK` with `{received:true}`
and no DB write of any kind. No `manual_review` entitlement state is set, no audit row, no
notification. Per Phase 2.3 known follow-up (c): "webhook missing/unresolvable userId is
acknowledged 200 (fail-closed, no grant) but raises NO manual_review alert."
**Recommendation:** Phase 2.4 must add: when `event.userId` is falsy after parse, write an
audit row with `action: 'billing.webhook_unresolved_user'`, `after: { eventId: event.id, eventType: event.type }` (no PII, no body), and enqueue (or directly insert) a `manual_review` record. The existing PGlite idempotency tests (BW-001/BW-004) cover the happy path; a new case BW-005 must cover this branch.
**Target Workstream:** B (billing)

### Finding 5
**Severity:** MEDIUM
**Evidence:** `apps/web/src/features/admin/queries.ts:59-65` — `loadAdminUsers` calls `listUsers(db)` (one `SELECT * FROM users`) then, for every user row, issues a second `SELECT createdAt FROM users WHERE id = $id` (line 62). This is an N+1 query: one query + N point queries for N users. `listUsers` in `packages/db/src/repositories.ts:56-59` also calls `rolesOf` per user, making the total `1 + N (createdAt) + N (roles)` queries.
**Recommendation:** Phase 2.4 should add a `listUsersWithCreatedAt(db)` repo that does a single `SELECT users.*, json_agg(user_roles.role_code) FROM users LEFT JOIN user_roles ...` or two-query approach (users + roles batch), returning `AdminUserView[]` directly. Until then, this is a display-only page with no scaling requirement, so it is MEDIUM not HIGH.
**Target Workstream:** E (admin ops)

### Finding 6
**Severity:** MEDIUM
**Evidence:** `tests/integration/billing-webhook.test.ts:112-140` (BW-004) — the idempotency
test verifies that a second call to `applyStripeEvent` with the same `stripeEventId` returns
`{applied:false}` and no second PAE row. The mechanism is a `SELECT` on `audit_logs` for
`action='billing.webhook_received'` + `targetId=stripeEventId` followed by an `INSERT` if absent.
This is a read-then-write (not a DB-unique-key constraint), so two concurrent requests with the
same `stripeEventId` can both read "not present" and both insert. No unique index on
`(action, target_id)` in `audit_logs`.
**Recommendation:** Phase 2.4 must add a test case (BW-005) exercising the concurrent-duplicate
path in PGlite (two `applyStripeEvent` calls without `await` between them). The db-architect should add a partial unique index on `audit_logs (action, target_id)` where `action = 'billing.webhook_received'` so the second insert throws a 23505 and the caller catches it (idempotent). This makes the guard a hard constraint, not a TOCTOU.
**Target Workstream:** B

### Finding 7
**Severity:** LOW
**Evidence:** `npm test` (coverage run, 23 files): `packages/bot-adapters/src/http.ts:89-127`
shows `getConfig`, `getMetrics`, `getPositions`, `getTrades` — all throw `AdapterNotReadyError`.
The current `adapters.test.ts:18-24` only tests `getConfig`, `getMetrics`, and `getTrades`.
`getPositions` and `validateConfig` are not exercised. The `getEquityCurve` optional method
exists on the mock but is never tested for the real adapter. Coverage: `http.ts` 62.38% stmts.
**Recommendation:** Phase 2.4 test matrix should add: `getPositions` throws `AdapterNotReadyError`;
`validateConfig` returns `{ok:false}`; `getEquityCurve` is absent (undefined) on the real adapter
(no fabricated curve); valid/malformed Tortila `api/summary` + `api/trades` fixture schema assertions once the real mapping lands.
**Target Workstream:** H

### Finding 8
**Severity:** LOW
**Evidence:** `packages/entitlements/src/state-machine.ts` — coverage report shows
`state-machine.ts 74.57% stmts / 43.47% branch`. The transitions `revoked → *`, `refunded → *`,
`chargeback → *`, and `manual_review → *` paths are likely not exercised via the engine test
since `engine.test.ts` tests `explainAccess` and `reconcileExpiry` but not all raw state
machine transitions. Evidence: `engine.ts 96.32% stmts / 75% branch` and `state-machine.ts` branch drops to 43%.
**Recommendation:** Phase 2.4 test matrix should add direct `state-machine.ts` transition tests
covering: `revoked` stays revoked on billing events; `refunded/chargeback` from any state;
`manual_review` → remains until admin resolves; `grace` → `expired` boundary.
**Target Workstream:** H

---

## Decisions

1. The transient EBUSY error on first `npm test` invocation is classified as a known Windows
   harness artefact (matching the memory note). It does NOT constitute a test failure. The
   decisive run (second and subsequent) shows 171/5 (176), exit 0.
2. Coverage baseline for Phase 2.4: 24.33% stmts / 71.09% branch. Statement coverage is low
   because the Next.js page/action files have 0% (all executed only via the running app in e2e);
   branch coverage above 70% is meaningful (domain logic is well-tested). No enforcement
   threshold is currently configured.
3. The Phase 2.4 test matrix below is the normative specification for the tests-runner agent.
   Tests must be PGlite (in-process, no Docker) unless noted otherwise.

---

## Risks

1. **Webhook concurrent-duplicate** (Finding 6): two Stripe retries in rapid succession for the
   same event can slip past the read-then-write idempotency guard and produce two entitlement
   grants. In production Stripe delivery is single-threaded per endpoint but this is not
   contractually guaranteed.
2. **TV two-step grant non-atomicity** (Finding 2): a `createTvGrant` DB error after `grantTv`
   succeeds leaves the request row as `'granted'` with no grant record. An admin retrying the
   grant form will see "state guard: already granted" and be stuck. Must be atomic before
   Phase 2.4 ships to production.
3. **revokeTvGrant not called** (Finding 3): revoke updates the request row but not the grant
   row. `revokeTvGrant` (tested in TV-2) stamps `revokeReason` + nulls `currentGrantId`. The
   grant row currently retains `revokedAt=null` after a revoke action — profile may still show
   the stale `currentGrantId`.
4. **Real-PG gate still NOT RUN**: no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`/Docker available.
   PGlite covers the repo logic against a real Postgres engine (same SQL), but `db:migrate` /
   `db:seed` / real connection-pool / concurrent-connection tests remain unverified. The
   `db-real-postgres.test.ts` opt-in test (5 cases) is always skipped here.
5. **Statement coverage at 24.33%**: Next.js pages, route handlers, and features/* are 0% in
   Vitest because they require a running app (only e2e exercises them). This creates a permanent
   gap between unit/integration coverage and actual code coverage. e2e is the primary safety net
   for those paths.

---

## Verification / tests

### Phase 2.4 pre-edit baseline gate run (this audit wave)

All commands run from `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

| Gate | Command | Result |
|------|---------|--------|
| governance:check | `npm run governance:check` | PASS — 0 errors, 1 allowlisted historical warning (20260529-1921-integration-risk-auditor.md canonical headings; known historical drift) |
| check:core | `npm run check:core` | PASS — 7 smokes (entitlements, crypto, analytics, audit, auth, axioma-bridge, billing) |
| lint | `npm run lint` | PASS — exit 0 (no output = clean) |
| typecheck (packages) | `npm run typecheck` | PASS — exit 0 |
| typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — exit 0 |
| secret:scan | `npm run secret:scan` | PASS — exit 0 (no findings) |
| unit + integration tests | `npm test` | PASS — **171 passed / 5 skipped (176) across 23 test files**, exit 0. First run had transient Windows EBUSY (22 files, exit 1); second and third runs 23 files, exit 0. See Finding 1. |
| coverage | `npm run coverage` | PASS — **24.33% stmts / 71.09% branch** (23 files, 171/5/176). Coverage run does not trigger the EBUSY. |
| db:generate | `npm run db:generate -w @wtc/db` | PASS — **38 tables**, "No schema changes, nothing to migrate" |
| build | `npm run build -w @wtc/web` | PASS — **44 routes** (32 app routes + 12 dynamic segments) compiled cleanly in 4.7s |
| db:migrate / db:seed / real-PG | NOT RUN | no `DATABASE_URL` / `REAL_POSTGRES_DATABASE_URL` / Docker. PGlite is NOT a substitute for real-PG acceptance. |
| e2e | NOT RUN | audit wave: e2e excluded per the audit-wave spec (slow; was 28/28 at Phase 2.3 final). |

### Phase 2.4 test matrix (tests-runner must add)

The following test files and cases are required before Phase 2.4 gates can be declared green.
All are Vitest PGlite unless marked otherwise.

#### File: `tests/integration/tortila-adapter-fixture.test.ts` (NEW)

Tests the Tortila HTTP adapter against local fixture JSON (captured from `bot_tortila/src/turtle_bot/journal/app.py` — no live HTTP). Uses `msw` or manual mock of `fetch` to return fixture payloads. Covers the adapter's mapping of raw journal shapes to `CanonicalMetrics` / `CanonicalTrade[]` / `CanonicalPosition[]` once those mappings are implemented.

- **TA-001**: `api/health` fixture `{ok:true, ts:<iso>}` → `getHealth()` returns `processAlive:true`, `status:'degraded'` (P0/P1 warnings persist regardless), `warnings` includes `tp_reconcile_p0` and `margin_preflight_p1`.
- **TA-002**: `api/health` fixture `{ok:false}` → `getHealth()` returns `processAlive:false`, `status:'down'`, warnings still present.
- **TA-003**: `api/summary` valid fixture (all required fields present) → `getMetrics()` maps `net_pnl` to `closedPnl`, `max_dd_pct` to `maxDrawdownPct`, `win_rate_pct` to `winRatePct`, `last_equity` to `walletEquity`. Verifies closed vs unrealized PnL distinction: `net_pnl` is from closed trades; unrealized comes from `open_position_summaries[].unrealizedPnl` (if available, else null — never conflated).
- **TA-004**: `api/summary` missing required field (`net_pnl` absent) → `getMetrics()` throws `AdapterNotReadyError` or returns `null` for that metric (not a fabricated 0).
- **TA-005**: `api/trades` valid array fixture → `getTrades()` maps to `CanonicalTrade[]`. Verifies `realized_pnl` maps to `realizedPnl` (GROSS, before fees), `funding_pnl` maps to `funding`, fees field populated from `fees_pnl` when present.
- **TA-006**: `api/trades` response with a trade having `exit_price=null` (open trade, not yet closed) → `getTrades()` includes only closed trades (or maps `closedAt: null` correctly without throwing).
- **TA-007**: `api/equity` `{ts:[...], equity:[...]}` → `getEquityCurve()` returns `EquityPoint[]` with `filterZeroEquity` applied (equity<=0 entries dropped before returning). Verifies that artifact rows never fabricate a drawdown.
- **TA-008**: `api/equity` empty arrays → `getEquityCurve()` returns `[]` (not null, not a throw).
- **TA-009**: Bot UI graceful degradation — when `getMetrics()` throws `AdapterNotReadyError`, the calling code (mock of `features/bots/data.tsx` logic) catches and returns a null-metrics state, never crashing. This is a pure logic test (no React renderer needed); test the adapter-consumer pattern.
- **TA-010**: `api/overview` fixture — sanity-check that the `summary` sub-object fields match the `api/summary` contract (the two endpoints must stay in sync).

#### File: `tests/integration/tv-atomic-grant-revoke.test.ts` (NEW)

PGlite tests for the Phase 2.4 atomic grant/revoke implementation.

- **TVA-001**: `atomicTvGrant` (or equivalent single-transaction wrapper) — request transitions to `'granted'`, grant row exists with correct `userId`/`tvUsername`/`expiresAt`, profile `currentGrantId` updated, audit row written. On success no partial state.
- **TVA-002**: Rollback — if `createTvGrant` step throws (simulate by passing an invalid FK), the `tradingview_access_requests.status` is NOT `'granted'` (rollback restores `'pending'`). Verifies atomicity.
- **TVA-003**: Duplicate grant — calling the atomic grant twice for the same `requestId` (second call: request is already `'granted'`) → state guard rejects with a clear error, no second grant row.
- **TVA-004**: `revokeTv` with `reason` parameter — `tradingview_access_requests.status` = `'revoked'`, `revokedAt` and `revokedBy` set, audit `after.reason` = the provided string.
- **TVA-005**: `revokeTvGrant` called from the revoke action — grant row has `revokedAt` non-null, `revokeReason` = reason string, `currentGrantId` on the profile is null after revoke.
- **TVA-006**: Revoke on an already-revoked request → rejects with state guard error (no double-revoke).
- **TVA-007**: Expired grant — a grant past `expiresAt` that has been swept by `sweepTvExpiry` cannot be re-granted without a new request. Verifies sweep + state guard interaction.
- **TVA-008**: Grant history — `listTvGrantsForUser` returns all historical grants (including revoked ones) in insertion order; a new grant for the same user after a revoke creates a second row, not an update.

#### File: `tests/integration/billing-webhook-phase24.test.ts` (NEW — extends BW series)

- **BW-005**: Missing `userId` in event metadata → the route returns `200 OK` (acknowledged) AND writes an audit row with `action='billing.webhook_unresolved_user'`, `targetId=eventId`, no entitlement granted, no PAE row. (Test the repo/service layer, not the route handler directly.)
- **BW-006**: Concurrent duplicate `stripeEventId` — two simultaneous `applyStripeEvent` calls with the same event id. After both resolve, exactly one `audit_logs` row with `action='billing.webhook_received'` and `targetId=eventId` exists, and exactly one entitlement row is active (not two). If a unique index is added to `audit_logs`, one call should throw 23505 and the caller should treat it as `{applied:false}`.
- **BW-007**: Unknown `planCode` (e.g., `'unknown_plan_xyz'`) → `expandPlan` returns `[]` → no entitlement granted, no PAE row, `applyStripeEvent` returns `{applied:false, productsChanged:0}`.
- **BW-008**: `payment_refunded` event → entitlement transitions to `'refunded'`, `hasAccess` returns false. PAE row written with `toState='refunded'`.

#### File: `tests/integration/admin-ops-rbac.test.ts` (NEW)

PGlite tests for admin operations RBAC enforcement (repo-layer guards, not the route handler).

- **ADM-RBAC-001**: A non-admin user calling `loadAdminUsers()` equivalent (assertAdmin guard) → throws with an RBAC denial. (Pure auth test, no PGlite needed — use `packages/auth/src/rbac.test.ts` pattern.)
- **ADM-RBAC-002**: `listUsersWithCreatedAt` (new repo, if added) — returns all users with `createdAt` in a single query; per-user isolation confirmed (each row has the correct `createdAt`).
- **ADM-RBAC-003**: `updateSupportTicket` called by a non-admin actor → the server action's CSRF + assertAdmin guard rejects before the repo is called. (Pure logic test.)
- **ADM-RBAC-004**: `grantProduct` with a `reason` and `validUntil` — `product_access_events.reason` = the provided string, `entitlements.expiresAt` = `validUntil`. (Already covered by ADM-2 in phase23-visible-progress; verify no regression.)

#### File: `tests/integration/migration-0003-pglite.test.ts` (NEW — after db-architect lands migration)

PGlite round-trip test for migration 0003 (billing durable webhook ledger + billing manual-review state, as designed by the db-architect).

- **MIG3-001**: All three migrations (0000 + 0001 + 0002 + 0003) apply cleanly without error.
- **MIG3-002**: New table(s) introduced in 0003 accept a round-trip insert + select without FK errors.
- **MIG3-003**: Existing data from 0002 tables (seeded before applying 0003) is unaffected (additive migration does not drop or alter existing columns).
- **MIG3-004** (if `manual_review` table added): inserting a `manual_review` row with `eventId`, `reason`, `resolvedAt=null` + reading it back; marking resolved updates `resolvedAt`.

#### e2e additions (smoke.spec.ts — append to existing 28 tests)

Note: e2e does NOT run in the audit wave. The tests-runner must add these in the implementation wave.

- **E2E-29/30** (desktop + mobile): `/admin/tradingview-access` — grant form visible with duration dropdown; revoke form includes reason field (Phase 2.4 fix). Verify the form labels render.
- **E2E-31/32** (desktop + mobile): `/app/bots/tortila` — with `BOT_ADAPTER_MODE=mock`, the `getMetrics()` `AdapterNotReadyError` on un-mapped methods does NOT crash the page; page renders with `storage: mock` pill and `Start/Stop DISABLED` text.
- **E2E-33/34** (desktop + mobile): `/admin/entitlements` — manual review queue card present (Phase 2.4 if manual_review surface added).

#### Real-PG gate (NOT RUN — conditional)

`tests/integration/db-real-postgres.test.ts` — 5 cases always skipped (no `REAL_POSTGRES_DATABASE_URL`). If credentials become available, the existing test covers: migrate/seed/FK-cascade/unique-entitlement/session-destroy/concurrent-grantProduct/pool-teardown. Phase 2.4 should add: migration 0003 applies cleanly against real PG; `applyStripeEvent` concurrent duplicate under a DB-level unique index.

---

## Real vs mocked tally update (pre-Phase-2.4, no changes from Phase 2.3)

| Component | Status |
|-----------|--------|
| Entitlement state machine (fail-closed) | Real + PGlite-tested |
| Crypto vault (AES-256-GCM, no plaintext) | Real + PGlite-tested |
| RBAC matrix | Real + unit-tested |
| Analytics (closed vs unrealized PnL, drawdown) | Real + unit-tested (GAP-F verified) |
| Billing webhook (sig verify + idempotency) | Real + PGlite-tested (BW-001..004) |
| TV grant/revoke | Partially real: grant two-step NOT atomic (Finding 2); revoke reason not threaded (Finding 3) |
| Admin user list | Real but N+1 query (Finding 5) |
| Webhook missing-userId alert | NOT implemented (Finding 4) |
| Tortila real adapter | `getHealth` mapped; all other methods throw `AdapterNotReadyError` (honest stub) |
| Bot control | DISABLED (throws in all modes) |
| Legacy bot adapter | BLOCKED (plaintext key risk) |
| Real-PG db:migrate / db:seed | NOT RUN (no credentials / Docker) |
| PGlite as substitute for real-PG acceptance | NOT a substitute — clearly labelled |

---

## Next actions

1. **tests-runner (epoch 20260530-1355)**: Implement the test matrix above. Priority order:
   (a) `billing-webhook-phase24.test.ts` (BW-005 missing-userId + BW-006 concurrent duplicate),
   (b) `tv-atomic-grant-revoke.test.ts` (TVA-001..008 — gated on the atomicity fix landing),
   (c) `tortila-adapter-fixture.test.ts` (TA-001..010 — gated on real mapping landing),
   (d) `admin-ops-rbac.test.ts`, (e) `migration-0003-pglite.test.ts` after db-architect ships 0003.
2. **backend-implementer**: Fix TV atomic grant (Finding 2), wire revoke reason + `revokeTvGrant`
   (Finding 3), add missing-userId `manual_review` audit (Finding 4).
3. **db-architect**: Add partial unique index on `audit_logs (action, target_id)` scoped to
   `action='billing.webhook_received'` (Finding 6). Design migration 0003 (additive).
4. **platform-architect / backend-implementer**: Add `listUsersWithCreatedAt` single-query repo
   to eliminate the N+1 in `loadAdminUsers` (Finding 5).
5. **QA gate runner (Phase 2.4 post-implementation)**: Re-run the full gate set. Target:
   `npm test` ≥ 195 passed / 5 skipped; coverage stmts ~24% (stable — denominator grows with
   new test files); branch ≥ 71%. Build must still show 44+ routes. e2e must show ≥ 34/34.
6. **STATUS.md update**: After the post-implementation gate run, update the real-vs-mocked tally
   to reflect: TV atomicity fixed, revoke-reason wired, BW-005/006 covered, migration 0003 applied.
