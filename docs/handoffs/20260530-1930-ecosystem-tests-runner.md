# ecosystem-tests-runner handoff

## Scope

Read-only audit for Phase 2.7 (PG2 + PG5). Define the focused test matrix for the two
implementation agents, audit existing test coverage gaps, and prescribe the full gate
sequence. No source code was modified. Baseline from docs/STATUS.md: 294 passed / 7 skipped
(301 total), 25.23% stmt / 71.61% branch, e2e 36/36, retries:2.

## Files inspected

- docs/handoffs/0000-orchestrator-seed.md
- docs/SESSION_PROTOCOL.md
- docs/STATUS.md (full history)
- AGENTS.md
- package.json (root scripts)
- vitest.config.ts
- playwright.config.ts
- tests/e2e/smoke.spec.ts
- tests/e2e/security-headers.spec.ts
- tests/integration/db-persistence.test.ts
- tests/integration/db-0002.test.ts
- tests/integration/db-0003.test.ts
- tests/integration/admin-ops-rbac.test.ts
- tests/integration/phase23-visible-progress.test.ts
- packages/bot-adapters/src/adapters.test.ts
- packages/bot-adapters/src/__tests__/tortila-mapping.test.ts
- packages/bot-adapters/src/http.ts
- packages/bot-adapters/src/warnings.ts
- packages/bot-adapters/src/types.ts
- packages/entitlements/src/engine.test.ts
- packages/crypto/src/vault.test.ts
- packages/auth/src/rbac.test.ts
- packages/analytics/src/metrics.test.ts
- packages/db/src/repositories.ts (sweepTvExpiry, getUserById, listUsersWithCreatedAt)
- apps/web/src/features/tv/queries.ts (loadTvAdminData, listUsersWithEmailByIds gap)
- scripts/check-governance.mjs

## Files changed

None — read-only audit.

## Findings

### F-01 [HIGH] sweepTvExpiry does NOT stamp grant row or null profile pointer
**Evidence:** packages/db/src/repositories.ts:315-327
`sweepTvExpiry` sets `status = 'expired'` on the request row and inserts a task row, but does
NOT: (a) look up and stamp `revokedAt`/`revokeReason='expired_by_worker'` on the
`tradingview_access_grants` row; (b) null `tradingview_profiles.currentGrantId`; (c) write a
`tv_access.revoke` audit row with a system actor. The existing test at
db-persistence.test.ts:116-126 only asserts `status === 'expired'` and counts — the grant
row and profile pointer are unverified. This means expired TV access is not fully cleaned up:
the `currentGrantId` pointer remains live and the grant row is unmarked.
**Recommendation (PG5, item d):** Extend `sweepTvExpiry` in a transaction per expired row:
(1) find the active grant row via `tradingviewAccessGrants` where `requestId = r.id` and
`revokedAt IS NULL`; (2) stamp it with `revokedAt = new Date(now)`,
`revokeReason = 'expired_by_worker'`; (3) null `tradingviewProfiles.currentGrantId` where
`currentGrantId = grant.id`; (4) insert `tv_access.revoke` audit with `actorUserId = null`,
`actorRole = 'system'`. Add a new PGlite test in `tests/integration/db-0003.test.ts` (or a
new `tests/integration/db-pg5.test.ts`) asserting all four postconditions.
**Target part: PG5 item (d)**

### F-02 [HIGH] loadTvAdminData has N+1 per-row getUserById calls
**Evidence:** apps/web/src/features/tv/queries.ts:83-88
`loadTvAdminData` calls `Promise.all(requestRows.map(async (r) => { const userRow = await getUserById(db, r.userId); ... }))`.
With N requests this issues N SELECT queries — one per user. `listUsersWithEmailByIds` does
not exist anywhere in the codebase (confirmed by grep across all .ts files). This is the gap
the PG5 scope names for item (f).
**Recommendation (PG5, items e and f):** Add `listUsersWithEmailByIds(db, ids: string[])` to
`packages/db/src/repositories.ts`. Implementation: single `db.select({ id, email }).from(users).where(inArray(users.id, ids))`, return `Map<string, string>`. Guard: if `ids.length === 0` return empty Map without issuing a query (the test for item e must assert this). Update
`loadTvAdminData` in `apps/web/src/features/tv/queries.ts` to call
`listUsersWithEmailByIds(db, requestRows.map(r => r.userId))` once, then map over the result
— replacing the per-row `getUserById`. A correctness test asserting userEmail mapping for two
distinct users is achievable with PGlite; a call-count spy is not feasible via PGlite (no
instrumentation hook) — document this in the test comment.
**Target part: PG5 items (e) and (f)**

### F-03 [HIGH] PG2 getHealth 4-state test coverage is absent
**Evidence:** packages/bot-adapters/src/adapters.test.ts (entire file), packages/bot-adapters/src/__tests__/tortila-mapping.test.ts:432-457
The PG2 scope requires a dedicated `getHealth` test covering four `readState` mappings:
`not_configured` (baseUrl absent → mock mode, no fetch), `unreachable` (fetch rejects,
e.g. AbortError), `malformed` (200 OK but Zod parse fails), `stale` (valid response but
`ts` field is >N minutes old relative to injected `now`). The current adapter test
(adapters.test.ts:42-48) checks that the real adapter getHealth "includes P0/P1 warnings"
and "status !== healthy" but does NOT cover the four discriminated readState values as a
first-class field. The BotHealth type (packages/bot-adapters/src/types.ts) has `status:
HealthStatus` but no `readState` field yet — that is a new addition needed for PG2.
**Recommendation (PG2, item a):** Add a `readState: 'not_configured' | 'unreachable' | 'malformed' | 'stale' | 'ok'` field to the `BotHealth` interface (types.ts). Populate it in `http.ts:getHealth` (not_configured when the adapter is constructed without a baseUrl, unreachable on fetch rejection, malformed on Zod failure, stale when the response ts is old). Use `vi.stubGlobal('fetch', ...)` for the unreachable/malformed cases and an injected `now` param for the stale case. Assert `getHealth()` NEVER throws (all paths return a value). Place these tests in a new file `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`.
**Target part: PG2 item (a)**

### F-04 [HIGH] JOURNAL_READ_TOKEN auth header injection not implemented or tested
**Evidence:** packages/bot-adapters/src/http.ts:40-50 (getJson function), grep found no JOURNAL_READ_TOKEN in any .ts file
The PG2 scope requires `JOURNAL_READ_TOKEN`: the GET carries the `Authorization: Bearer <token>` header when the env/token is set and omits it when unset; mock path unaffected; token value never appears in a snapshot/audit payload. Currently `getJson` (http.ts:44) sends only `{ accept: 'application/json' }` headers — no Authorization header, no token injection.
**Recommendation (PG2, item c):** (1) Accept an optional `token?: string` in `createHttpTortilaAdapter`. (2) In `getJson`, pass the token as a parameter and add `Authorization: Bearer ${token}` when present. (3) The factory should read `process.env.JOURNAL_READ_TOKEN` and pass it through. (4) Tests: stub fetch to capture request headers; assert `Authorization` is present (and matches the token) when `token` is set, absent when unset. Assert mock adapter path does NOT call fetch. Assert the token value does NOT appear in any `BotHealth` JSON serialization (`JSON.stringify(health)` must not contain the token string).
**Target part: PG2 item (c)**

### F-05 [MEDIUM] getWarnings() dedicated tests for canonical codes and mock/real parity are absent
**Evidence:** packages/bot-adapters/src/adapters.test.ts:51-57 (W-01..W-06 in tortila-mapping.test.ts cover warning registry); no `getWarnings()` method exists on BotAdapter
The PG2 scope mentions `getWarnings()` as a discrete method that returns the canonical signal codes for mock and at least the persistent P0/P1 for real. There is no `getWarnings()` method on the `BotAdapter` interface (types.ts). The existing warning-code assertions are in the W-01..W-06 block of tortila-mapping.test.ts (checking the static registries) and adapters.test.ts:34-48 (checking `getHealth().warnings`). These cover the CANONICAL_WARNING_CODES invariant but do not test a discrete `getWarnings()` interface.
**Recommendation (PG2, item b):** If PG2 adds a `getWarnings()` method to the adapter interface, add tests that: (a) for mock adapter, returned codes are a subset of CANONICAL_WARNING_CODES and include `tp_reconcile_p0` and `margin_preflight_p1`; (b) for real adapter (mocked fetch), same P0/P1 are present and every code is canonical. If PG2 instead routes through `getHealth().warnings`, document that this is the approved equivalent and add a dedicated assertion `warnings.every(w => CANONICAL_WARNING_CODES.includes(w.code))` to a new test case. Either way the invariant test must be explicit.
**Target part: PG2 item (b)**

### F-06 [MEDIUM] sweepTvExpiry existing test uses old grantTv (not atomicGrantTv) and db-persistence shared state
**Evidence:** tests/integration/db-persistence.test.ts:116-126 and :208-219
The idempotency test at line 208-219 uses `grantTv` (legacy Phase-1 call), not
`atomicGrantTv`. After sweepTvExpiry the grant row is not checked. The shared db state across
all describe blocks in db-persistence.test.ts means tests depend on ordering. New sweep tests
should use isolated PGlite instances or run in db-0003.test.ts (which already isolates per
describe).
**Recommendation:** Write the new `sweepTvExpiry` atomicity tests in
`tests/integration/db-0003.test.ts` or a new `tests/integration/db-pg5.test.ts` with their
own isolated PGlite `beforeAll`. Use `atomicGrantTv` to set up the grant so the profile
pointer and grant row are wired, then call `sweepTvExpiry` and assert all four postconditions
in F-01 above.
**Target part: PG5 item (d)**

### F-07 [LOW] e2e: admin grant-history revoke reason assertion is absent
**Evidence:** tests/e2e/smoke.spec.ts:236-259 (Phase 2.4 E2E-29/30 test)
The smoke test asserts "No grants recorded yet" (empty state) but does not assert that a
revoke reason appears in the grant history card when a revoked grant exists. This is listed
as OPTIONAL in the PG5 scope (item g).
**Recommendation:** Keep as low priority. Do NOT add a rapid-request or burst e2e test. If a
grant-history revoke-reason e2e is desired, seed a revoked grant in the dev server's in-memory
state before the test, then assert the reason text. Given the demo mode has no DATABASE_URL,
this requires the in-memory TV demo seeder to include a revoked grant row. Treat as a Phase
2.8 follow-on; do NOT include in the Phase 2.7 gate run.
**Target part: PG5 item (g) — OPTIONAL, deferred**

### F-08 [LOW] /app/indicators <14-day banner: no e2e assertion
**Evidence:** tests/e2e/smoke.spec.ts:67-76; apps/web/src/app/app/indicators/ (not inspected — out of scope for read-only run)
The Phase 2.7 PG5 scope mentions an OPTIONAL e2e for "indicators renders the <14-day banner".
No such banner assertion exists. Per the PG11 lesson, burst/rapid-request e2e must not be
added. The banner itself depends on the user's entitlement.expiresAt being within 14 days,
which requires a seeded near-expiry entitlement in the demo.
**Recommendation:** Deferred to Phase 2.8 like F-07. The in-memory seeder would need a near-
expiry entitlement for `tradingview_indicators`. Do not implement in Phase 2.7.
**Target part: PG5 item (g) — OPTIONAL, deferred**

### F-09 [INFO] governance:check will require 4 cited per-agent handoffs at epoch 20260530-1930
**Evidence:** scripts/check-governance.mjs:128-136 (N-claim rule); STATUS.md documents the 4-auditor fan-out requirement
The operator aggregate handoff at epoch 20260530-1930 must cite exactly the 4 per-agent
handoff files that the Phase 2.7 fan-out produces (this file is one of them). The
`governance:check` gate will fail if the aggregate cites fewer handoffs than the maximum
numeric claim, or if any current-epoch per-agent file is not cited.
**Recommendation:** Ensure the aggregate at `docs/handoffs/20260530-1930-phase-2-7-*.md`
links all 4 per-agent handoffs by path. This tests-runner handoff is:
`docs/handoffs/20260530-1930-ecosystem-tests-runner.md`.
**Target part: Governance gate**

## Decisions

1. PG2 tests go in `packages/bot-adapters/src/__tests__/getHealth-states.test.ts` (new file).
   The existing tortila-mapping.test.ts already covers fixture-based mapping; the new file
   covers live-path (fetch-stubbed) health state discrimination.

2. PG5 sweepTvExpiry atomicity tests go in `tests/integration/db-0003.test.ts` as a new
   describe block (or in a new `tests/integration/db-pg5.test.ts` if the file becomes too
   long). Either way, use a fresh isolated PGlite beforeAll.

3. `listUsersWithEmailByIds` is a new repo function (not a replacement for existing
   `listUsersWithCreatedAt` or `getUserById`). It returns `Map<string, string>` (id → email)
   so the call site in `loadTvAdminData` is a simple map lookup.

4. The PG2 `readState` field is additive to `BotHealth`; it does not break existing tests
   since the existing tests do not check for the absence of this field.

5. JOURNAL_READ_TOKEN auth header injection: the token is passed as a constructor arg to
   `createHttpTortilaAdapter` (with `process.env.JOURNAL_READ_TOKEN` as the default), not
   hardcoded in `getJson`. This keeps the function pure and testable.

6. e2e items F-07 and F-08 (admin grant-history revoke reason, indicators <14-day banner)
   are deferred to Phase 2.8. No burst/rapid-request e2e is added (PG11 lesson).

7. The 429 breach path remains unit-only (rate-limit.test.ts) per the comment in
   security-headers.spec.ts:32-34.

## Risks

1. sweepTvExpiry transactional extension (F-01): the current per-row loop is NOT in a
   transaction. Adding an inner transaction per expired request row could hit PGlite
   nested-transaction limitations. Recommend using a savepoint or restructuring as a
   single outer transaction per batch (while keeping the outer query outside the txn to
   avoid long-running read locks).

2. JOURNAL_READ_TOKEN (F-04): the token must never appear in `BotHealth`, audit logs, or
   redact.ts outputs. The `isSecretValue()` guard added in Phase 2.6 will catch it if it
   is a 64+-hex or Bearer string. Explicitly assert `JSON.stringify(health)` does not
   contain the token in the test.

3. loadTvAdminData N+1 fix (F-02): if `requestRows` is empty, `inArray(users.id, [])` may
   produce invalid SQL in some Drizzle/PGlite versions. Guard with `if (ids.length === 0)
   return new Map()` before calling the DB — item (e) requires this guard.

4. governance:check: the aggregate must be written AFTER all 4 per-agent handoffs exist.
   Do not write the aggregate first. The governance gate will fail if the aggregate is
   created and the other 3 per-agent files do not yet exist on disk.

5. `readState` field addition to BotHealth: the mock adapter and legacy adapter in http.ts
   must also populate `readState`. Omitting it from the mock will cause TypeScript errors
   if the field is required. Make it optional (`readState?: ...`) to remain backward-
   compatible with the existing 294 tests.

## Verification/tests

### Full gate sequence for Phase 2.7 (run in this order, sequentially)

| Gate | Command | Expected | Notes |
|------|---------|----------|-------|
| governance:check | `npm run governance:check` | PASS — 4 cited per-agent handoffs at epoch 20260530-1930 | Run AFTER all 4 per-agent handoffs exist and the aggregate cites them |
| check:core | `npm run check:core` | PASS — 7 smokes | Pure logic, no DB |
| lint | `npm run lint` | PASS — 0 errors, 0 warnings | --max-warnings 0 enforced |
| typecheck (packages) | `npm run typecheck` | PASS — exit 0 | Covers all packages/ |
| typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — exit 0 | loadTvAdminData type must match new repo |
| secret:scan | `npm run secret:scan` | PASS — no findings | JOURNAL_READ_TOKEN must not appear in fixtures |
| test (Vitest) | `npm test` | PASS — ≥ 294 passed / 7 skipped | New PG2 + PG5 tests must add to the count |
| coverage | `npm run coverage` | PASS — stmts ≥ 25.23%, branch ≥ 71.61% | Direction: both should hold or improve |
| db:generate | `npm run db:generate -w @wtc/db` | PASS — 40 tables, "No schema changes" | PG2/PG5 add no migrations |
| build | `npm run build -w @wtc/web` | PASS — all routes compile | loadTvAdminData signature change must typecheck |
| e2e | `npx playwright test` | PASS — 36/36 (retries:2; 1 dev-only Server-Action recompilation flake expected to auto-retry) | No new e2e tests added for PG2.7 (items g/h deferred) |

### Gates NOT RUN (with reason)

| Gate | Reason |
|------|--------|
| db:migrate | No DATABASE_URL / real Postgres credentials available. PGlite is NOT a substitute for migration correctness against real Postgres. |
| db:seed against Postgres | Same — no DATABASE_URL. |
| real-PG harness (db-real-postgres.test.ts) | REAL_POSTGRES_DATABASE_URL not set; all 5 real-PG cases skip via `describe.skipIf`. |
| Stripe checkout live | TARGET — no live Stripe keys. |
| Axioma ES256 provisioned key | TARGET — no provisioned P-256 key. |

### Priority unit coverage assertions to run after implementation

PG2 (packages/bot-adapters/src/__tests__/getHealth-states.test.ts):
- not_configured: `createHttpTortilaAdapter` with empty/missing baseUrl returns `readState: 'not_configured'` without calling fetch
- unreachable: `vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))` → `getHealth()` resolves (does not throw), `readState === 'unreachable'`, `processAlive === false`
- malformed: `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok:true, json: async () => ({ unexpected: 'shape' }) }))` → `readState === 'malformed'`, `processAlive === false`
- stale: valid `health.valid.json` but fixture `ts` is 15+ minutes before injected `now` → `readState === 'stale'`, `status === 'stale'`
- All four paths: `getHealth()` never throws; returned object satisfies BotHealth shape
- JOURNAL_READ_TOKEN: fetch stub captures request; `Authorization: Bearer test-token` present when token set; absent when unset; `JSON.stringify(health)` does not contain 'test-token'

PG5 (tests/integration/db-0003.test.ts or db-pg5.test.ts):
- sweepTvExpiry full atomicity: setup via `atomicGrantTv` (PGlite), then `sweepTvExpiry(db, now_after_expiry)`:
  - request.status === 'expired'
  - grant row: `revokedAt` is not null, `revokeReason === 'expired_by_worker'`
  - `tradingviewProfiles.currentGrantId === null`
  - audit event: `action === 'tv_access.revoke'`, `actorUserId === null`, after.revokeReason === 'expired_by_worker'
  - counts returned are still correct
- listUsersWithEmailByIds: batched — two users → map has both; empty ids → Map is empty, no DB query (guard assertion via call count mock or structural test)
- loadTvAdminData (correctness): with 2 requests from 2 different users in PGlite, userEmail is populated for both (not the fallback userId)

### Coverage direction

Expected coverage movement for Phase 2.7 (additive tests only, no new uncovered pages):
- Statement coverage: should hold at ~25% or improve slightly (new bot-adapter tests are small, well-covered units)
- Branch coverage: should hold at ~71.6% or improve (new PG5 tests exercise the sweepTvExpiry grant-row lookup branch and the empty-ids guard)

## Next actions

1. (PG2 implementer) Add `readState` field to `BotHealth` in types.ts. Populate in http.ts
   getHealth for all four paths. Accept `token?: string` in `createHttpTortilaAdapter`.
   Wire `process.env.JOURNAL_READ_TOKEN`. Write `getHealth-states.test.ts` per the matrix above.

2. (PG5 implementer) Add `listUsersWithEmailByIds` to packages/db/src/repositories.ts.
   Update `loadTvAdminData` in apps/web/src/features/tv/queries.ts to use it. Extend
   `sweepTvExpiry` to stamp the grant row + profile pointer + audit. Write PGlite tests per
   the matrix above.

3. (operator) After all 4 per-agent handoffs exist at epoch 20260530-1930, write the
   aggregate at `docs/handoffs/20260530-1930-phase-2-7-*.md` citing all 4. Then run the
   full gate sequence in order.

4. Run `npm run governance:check` last (after aggregate is written) to confirm 4-cited pass.

5. Do NOT add any burst/rapid-request e2e tests. The 429 rate-limit logic remains unit-only
   (packages/auth/src/rate-limit.test.ts) per the PG11 security-headers.spec.ts comment.
