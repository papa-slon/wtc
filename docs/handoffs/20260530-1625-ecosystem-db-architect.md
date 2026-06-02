# Handoff — ecosystem-db-architect (Phase Group 1: Foundation / Real-DB / Truth)

_2026-05-30 16:25. Read-only audit. Agent: ecosystem-db-architect._

## Scope

Phase Group 1 implementation readiness audit:

1. Verify actual table count from `packages/db/src/schema.ts` and migration SQL; confirm 40 tables.
2. Enumerate every doc that states a stale count (e.g. "38 tables") with file:line.
3. Design a safe DB-name guard for `tests/integration/db-real-postgres.test.ts`.
4. Design an additional real-PG test proving migration 0003 applied (40 tables) and concurrent `billing_webhook_events` UNIQUE behavior.
5. Note any schema-vs-DATA_MODEL drift.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DATA_MODEL.md`
- `docs/DOMAIN_MODEL.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md`
- `packages/db/src/schema.ts`
- `packages/db/migrations/0003_fresh_blockbuster.sql`
- `packages/db/src/repositories.ts` (lines 1006–1054)
- `tests/integration/db-real-postgres.test.ts`
- `packages/bot-adapters/src/__fixtures__/tortila/` (all JSON files enumerated via glob)

## Files changed

None — read-only audit.

## Findings

### Finding 1 — MEDIUM — Table count confirmed at 40; IMPLEMENTED_FILES.md Persistence table is stale

**Evidence:** `packages/db/src/schema.ts` contains exactly 40 `pgTable` declarations:
21 base tables from migrations 0000/0001 + 17 from migration 0002 + 2 from migration 0003
(`billing_webhook_events`, `billing_manual_review_items`). This matches the migration SQL in
`packages/db/migrations/0003_fresh_blockbuster.sql` and the `db:generate` gate output ("40 tables").

**Stale references** (both must be corrected in Phase Group 1):

- `docs/IMPLEMENTED_FILES.md:107` — `| Drizzle schema (38 tables) |` — says 38; real count is 40.
- `docs/IMPLEMENTED_FILES.md:108` — `| Migration SQL | … (3 migrations, 38 tables) …` — same stale claim.

**Recommendation:** In Phase Group 1 implementation, update both lines to reflect 40 tables and
4 migrations (0000–0003). The rest of `IMPLEMENTED_FILES.md` (Phase 2.4 additions section at the top)
already correctly states 40 tables — only the Persistence table rows are stale.

**Target phase group:** 1 (Foundation/Truth).

---

### Finding 2 — MEDIUM — Tortila fixture count: docs say "8 fixtures"; 11 JSON files exist

**Evidence:** `docs/NEXT_ACTIONS.md:5`, `docs/STATUS.md:9`, and multiple phase-2.4 handoffs all cite
"8 fixtures". A glob of `packages/bot-adapters/src/__fixtures__/tortila/` returns 11 JSON files:
`health.valid.json`, `health.down.json`, `health.malformed.json`, `summary.valid.json`,
`summary.no_trades.json`, `summary.missing_field.json`, `equity.valid.json`, `equity.empty.json`,
`equity.length_mismatch.json`, `trades_list.valid.json`, `trades_list.missing_fields.json`.

The Phase 2.4 implementation added 3 fixtures beyond the originally-planned 8 to cover additional
edge cases. The doc claim "8 fixtures" is consistently understated.

**Recommendation:** In Phase Group 1 truth cleanup, update the Tortila adapter description in
`docs/IMPLEMENTED_FILES.md` Phase 2.4 additions section (line 16) from "8 fixtures" to "11 fixtures".
Also update `docs/NEXT_ACTIONS.md:5` and `docs/STATUS.md:9` where they say "8 fixtures". The test
count ("35 fixture-only tests") should be verified against the actual test file but is out of scope
for this audit.

**Target phase group:** 1 (Foundation/Truth).

---

### Finding 3 — MEDIUM — billing-webhooks.md §1 table still names the superseded design `webhook_idempotency_keys`

**Evidence:** `docs/CONTRACTS/billing-webhooks.md:21` reads:
```
| Idempotency store | WTC Platform — `webhook_idempotency_keys` table |
```
The landed table (migration 0003) is `billing_webhook_events`. The `webhook_idempotency_keys` name
was a superseded design that was never built. Section §7 of the same file already correctly documents
the as-built `billing_webhook_events` approach (lines 207–218). The stale reference is only in §1.

**Recommendation:** In Phase Group 1, update `docs/CONTRACTS/billing-webhooks.md:21` to:
```
| Idempotency store | WTC Platform — `billing_webhook_events` table (migration 0003; UNIQUE provider+event_id) |
```

**Target phase group:** 1 (Foundation/Truth).

---

### Finding 4 — HIGH — Real-PG harness lacks a DB-name safety guard; any `REAL_POSTGRES_DATABASE_URL` is accepted

**Evidence:** `tests/integration/db-real-postgres.test.ts:37–47` — the harness reads the URL from
`process.env.REAL_POSTGRES_DATABASE_URL`, creates a postgres-js pool directly, and runs migrations.
There is no check that the target database name matches a safe pattern. An operator could accidentally
point `REAL_POSTGRES_DATABASE_URL` at a production database (e.g. `wtc_production`) or even a staging
database with live user data; the harness would silently run migrations and a seed against it.

**Design for the guard (to be implemented in Phase Group 1):**

Add the following block at the top of the `describe.skipIf(!run)` block, immediately before the
`beforeAll`:

```typescript
// ---- DB-name safety guard ----
// The harness MUST NOT run against any database whose name does not match
// the throwaway pattern ^wtc_test(_[a-z0-9]+)?$.
// Parse the database name from the URL before creating any pool connection.
const parsed = (() => {
  try {
    // postgres URLs: postgres://user:pass@host:port/dbname[?params]
    // URL constructor requires a scheme; postgres:// is valid.
    return new URL(URL as string);
  } catch {
    return null;
  }
})();
const dbName = parsed?.pathname.replace(/^\//, '').split('?')[0] ?? '';
if (!/^wtc_test(_[a-z0-9]+)?$/.test(dbName)) {
  throw new Error(
    `REAL_POSTGRES_DATABASE_URL points at database "${dbName}" — ` +
    `refusing to run the harness. Target DB must match ^wtc_test(_[a-z0-9]+)?$ ` +
    `(e.g. wtc_test or wtc_test_ci). Create a throwaway DB and re-point the URL.`
  );
}
// ---- end guard ----
```

Placement requirements:
- The guard must execute INSIDE the `describe.skipIf(!run)(…)` block, NOT in the outer scope,
  so the file remains inert (no throw) when `REAL_POSTGRES_DATABASE_URL` is absent.
- The guard must execute BEFORE the pool is created (i.e., before `sql = postgres(…)`), so that
  a misconfigured URL causes an immediate, clearly-worded error rather than silent wrong-DB access.
- The outer `describe('real Postgres harness availability', …)` block must remain unchanged so
  `npm test` continues to pass without the env var.

**Target phase group:** 1 (Foundation/Real-DB).

---

### Finding 5 — HIGH — Real-PG harness has no test proving migration 0003 applied (40 tables) nor the `billing_webhook_events` concurrent-UNIQUE behavior

**Evidence:** `tests/integration/db-real-postgres.test.ts` contains five tests (lines 62–108) that
cover seed idempotency, unique entitlements, cross-connection concurrent `grantProduct`, session
lifecycle, and FK cascade. None of these tests verify:

(a) That migration 0003 was applied and all 40 tables are present.
(b) That two simultaneous `insertWebhookEventOnce` calls for the same `(provider, event_id)` under
    real Postgres produce exactly one committed row and zero thrown exceptions (the INSERT-on-conflict
    path that `onConflictDoNothing().returning()` must prove).

**Design for the two new tests (to be added inside the existing `describe.skipIf(!run)` block):**

```typescript
it('migration 0003: information_schema shows exactly 40 tables in public schema', async () => {
  // Proves all four migrations ran and the schema is complete.
  const result = await sql!<[{ count: string }]>`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `;
  expect(Number(result[0].count)).toBe(40);
});

it('concurrent insertWebhookEventOnce: exactly one row wins, zero throws, isDuplicate correct', async () => {
  // Proves the UNIQUE(provider, event_id) constraint on billing_webhook_events works correctly
  // under real Postgres concurrent-insert semantics. Uses two independent connections so the
  // INSERTs race at the DB level rather than being serialized by a single connection.
  const provider = 'stripe';
  const eventId = `evt_concurrent_test_${Date.now()}`;

  const sql2 = postgres(URL as string, { max: 4 });
  const db2 = drizzle(sql2, { schema }) as unknown as Db;
  try {
    const [r1, r2] = await Promise.all([
      insertWebhookEventOnce(db, {
        provider,
        eventId,
        eventType: 'checkout.session.completed',
        userId: null,
        planCode: null,
        billingEvent: null,
        status: 'applied',
        productsChanged: 1,
      }),
      insertWebhookEventOnce(db2, {
        provider,
        eventId,
        eventType: 'checkout.session.completed',
        userId: null,
        planCode: null,
        billingEvent: null,
        status: 'applied',
        productsChanged: 1,
      }),
    ]);
    // Exactly one call wins (isDuplicate: false), exactly one loses (isDuplicate: true).
    const winners = [r1, r2].filter((r) => !r.isDuplicate);
    const losers = [r1, r2].filter((r) => r.isDuplicate);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(winners[0]!.rowId).not.toBeNull();
    expect(losers[0]!.rowId).toBeNull();
    // DB confirms exactly one row for this event.
    const rows = await sql!<[{ count: string }]>`
      SELECT COUNT(*) AS count
      FROM billing_webhook_events
      WHERE provider = ${provider} AND event_id = ${eventId}
    `;
    expect(Number(rows[0].count)).toBe(1);
  } finally {
    await sql2.end({ timeout: 5 });
  }
});
```

The import for `insertWebhookEventOnce` must be added to the import block at line 33:
```typescript
  insertWebhookEventOnce,
```
This function is already exported from `packages/db/src/repositories.ts:1006`.

Both tests must stay inside `describe.skipIf(!run)(…)` so they remain inert without the env var.

**Target phase group:** 1 (Foundation/Real-DB).

---

### Finding 6 — LOW — DATA_MODEL.md §13 migration 0003 summary has schema drift vs. the actual landed table

**Evidence:** `docs/DATA_MODEL.md:1358–1370` (Migration 0003 section) describes
`billing_webhook_events` with these columns:
```
status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
processed_at TIMESTAMPTZ, meta JSONB
```
But the actual table in `packages/db/src/schema.ts:632–657` and
`packages/db/migrations/0003_fresh_blockbuster.sql:16–28` has:
```
event_type TEXT NOT NULL,
user_id UUID (nullable FK → users),
plan_code TEXT,
billing_event TEXT,
status TEXT NOT NULL (no DEFAULT in SQL),
products_changed INTEGER NOT NULL DEFAULT 0,
expires_at TIMESTAMPTZ NOT NULL (90-day TTL, set by $defaultFn),
processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```
The doc column list in §13 omits `event_type`, `user_id`, `plan_code`, `billing_event`,
`products_changed`, and `expires_at`; it specifies a `meta JSONB` column that does not exist in the
real table; and it specifies `status DEFAULT 'pending'` while the implemented status values are
`'applied' | 'no_op' | 'manual_review' | 'error'` (no `'pending'` default in the SQL).

Similarly, the `billing_manual_review_items` summary in §13 describes columns `raw_event JSONB`,
`status DEFAULT 'open'`, and `resolution TEXT`, while the actual table has `event_snapshot JSONB`,
`status DEFAULT 'pending'`, `resolution_note TEXT`, plus `event_type`, `user_id`, `reason`,
`resolved_by`, and `resolved_at`.

**Recommendation:** In Phase Group 1 truth cleanup, update `docs/DATA_MODEL.md` §13 Migration 0003
section to match the actual DDL. The per-table column specs in §8 are TARGET layout; the migration
summary in §13 should reflect the actually-landed columns. The primary finding is that the doc
summary is approximate, not that the schema itself is wrong.

**Target phase group:** 1 (Foundation/Truth).

---

### Finding 7 — LOW — DATA_MODEL.md §5.3 `terminal_download_events` `ip_address` type mismatch

**Evidence:** `docs/DATA_MODEL.md:623` documents `ip_address` column as type `INET`. The actual
column in `packages/db/src/schema.ts:559` uses `text('ip_address')` (TEXT, not INET), with inline
comment: "TEXT not INET (PGlite compatibility)". This discrepancy is already acknowledged in the
schema comment but the DATA_MODEL.md column type spec has not been updated.

**Recommendation:** Update `docs/DATA_MODEL.md:623` to show type as `TEXT` with a note explaining
the PGlite compatibility reason.

**Target phase group:** 1 (Foundation/Truth — minor).

---

### Finding 8 — INFO — `user_profiles` table: DATA_MODEL.md §1.5 documents it; schema.ts has no such table

**Evidence:** `docs/DATA_MODEL.md:115–134` documents a `user_profiles` table (5 columns). This table
does not appear in `packages/db/src/schema.ts` and is not in any migration file. It is listed as
TARGET in `docs/DATA_MODEL.md:1312`: "user_profiles (TARGET): no Wave-2 feature requires it".
The table count of 40 is therefore correct; this is an expected and documented gap, not new drift.

**Recommendation:** No action required. The TARGET label in §12 is accurate.

---

### Finding 9 — INFO — `secret_rotation_events` table: documented in DATA_MODEL.md, absent from schema

**Evidence:** `docs/DATA_MODEL.md:316–333` documents a `secret_rotation_events` table. It does not
appear in `packages/db/src/schema.ts`. Listed as TARGET in §12. Again, table count of 40 is correct.

**Recommendation:** No action required. The TARGET label in §12 is accurate.

## Decisions

1. The real table count is **40** (verified by direct grep of `packages/db/src/schema.ts`). All
   doc references to "38 tables" in the context of the current schema are stale and must be fixed
   in Phase Group 1.

2. The DB-name guard design (Finding 4) uses `new URL(urlString).pathname` to parse the database
   name. This is correct for standard postgres URL format (`postgres://user:pass@host/dbname`).
   The guard throws synchronously (before pool creation) inside the `describe.skipIf` block —
   this keeps the outer file inert when the env var is absent, and fails loudly when the URL
   points at an unsafe DB.

3. The concurrent webhook idempotency test (Finding 5) uses two independent `postgres-js` pools
   (same pattern as the existing `grantProduct` concurrency test at line 78–91), which is the only
   correct approach to prove DB-level UNIQUE constraint behavior. A single-connection test or a
   PGlite test cannot reproduce the real concurrent-insert race.

4. The `insertWebhookEventOnce` function uses `onConflictDoNothing().returning()` — this is the
   correct pattern. The test must assert `isDuplicate` on both return values, not just the row
   count, to prove the application-level contract (no throw, correct boolean).

5. The `billing_manual_review_items` and `billing_webhook_events` tables are in the `ops/billing`
   bounded context. Their owner in the seed is `db-architect` (per schema.ts comment at line 661).

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Harness runs against wrong DB (no guard) | HIGH | Implement the DB-name guard from Finding 4 before any real-PG gate run |
| Stale "38 tables" claim in docs misleads implementers counting migrations | MEDIUM | Fix IMPLEMENTED_FILES.md:107-108 in Phase Group 1 truth pass |
| `billing-webhooks.md §1` still names `webhook_idempotency_keys`; implementer may attempt to create it | MEDIUM | Fix `billing-webhooks.md:21` in Phase Group 1 truth pass |
| No real-PG proof that migration 0003 applied (table count) | HIGH | Add the 40-table information_schema test from Finding 5 |
| No real-PG proof of concurrent-UNIQUE deduplication on `billing_webhook_events` | HIGH | Add the concurrent insertWebhookEventOnce test from Finding 5 |
| DATA_MODEL.md §13 migration 0003 column summary is approximate | LOW | Fix in Phase Group 1 truth pass; does not affect runtime behavior |

## Verification/tests

### Existing tests that become relevant for Phase Group 1

- `tests/integration/db-real-postgres.test.ts` — 5 tests, all currently skipped (`describe.skipIf`).
  Adding the DB-name guard and the two new tests from Finding 5 makes this 7 tests.
- `tests/integration/db-0003.test.ts` — 14 PGlite tests for migration 0003 repos (PGlite only;
  not a substitute for real-PG concurrent behavior).

### Definition of done for Phase Group 1 real-PG acceptance

All of the following must pass with `REAL_POSTGRES_DATABASE_URL` pointing at a fresh `wtc_test`
database on the local PG17 (`127.0.0.1:5432`):

1. DB-name guard rejects any URL whose database name does not match `^wtc_test(_[a-z0-9]+)?$`.
2. All 7 real-PG tests pass (5 existing + 2 new from Finding 5).
3. The information_schema table-count test returns exactly 40.
4. The concurrent `insertWebhookEventOnce` test: exactly 1 winner, 0 throws, 1 DB row.
5. `npm test` (all tests) remains green when `REAL_POSTGRES_DATABASE_URL` is unset.

## Next actions

1. **[Phase Group 1 / truth]** Fix `docs/IMPLEMENTED_FILES.md:107` and `:108` — change "38 tables" to "40 tables" and "3 migrations" to "4 migrations".
2. **[Phase Group 1 / truth]** Fix `docs/IMPLEMENTED_FILES.md` Phase 2.4 additions section — update "8 fixtures" to "11 fixtures".
3. **[Phase Group 1 / truth]** Fix `docs/NEXT_ACTIONS.md:5` and `docs/STATUS.md:9` — update "8 fixtures" to "11 fixtures".
4. **[Phase Group 1 / truth]** Fix `docs/CONTRACTS/billing-webhooks.md:21` — replace `webhook_idempotency_keys` with `billing_webhook_events`.
5. **[Phase Group 1 / truth]** Fix `docs/DATA_MODEL.md` §13 migration 0003 summary — update both table column lists to match the actual landed DDL.
6. **[Phase Group 1 / truth]** Fix `docs/DATA_MODEL.md:623` `terminal_download_events` `ip_address` type — change `INET` to `TEXT` with PGlite note.
7. **[Phase Group 1 / real-DB]** Add DB-name guard to `tests/integration/db-real-postgres.test.ts` per the design in Finding 4.
8. **[Phase Group 1 / real-DB]** Add two new tests to `tests/integration/db-real-postgres.test.ts` per the design in Finding 5: (a) 40-table migration proof; (b) concurrent insertWebhookEventOnce deduplication.
9. **[Phase Group 1 / real-DB]** Add `insertWebhookEventOnce` to the import block at `db-real-postgres.test.ts:33`.
10. **[Phase Group 1 / gate]** Once the guard and tests are in place, provision `wtc_test` on local PG17, set `REAL_POSTGRES_DATABASE_URL`, and run `npm test -- tests/integration/db-real-postgres.test.ts`. Report gate as DONE only when all 7 tests pass. Real-PG remains NOT_RUN until that run completes.
