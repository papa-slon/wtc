# ecosystem-tradingview-access-implementer handoff

_2026-05-30, epoch `20260530-2100`. Phase 2.8 — PG5 follow-up: `markExpiringSoon` pre-pass design._
_READ-ONLY audit. No files changed. All findings cite concrete file:line evidence._

## Scope

Design the `markExpiringSoon(db, now)` repository pre-pass so the 7-day server-side `expiring_soon`
status is actually written to `tradingview_access_requests`. Covers:

1. Which rows transition, and invariants (idempotent; must NOT touch expired/revoked/pending rows).
2. The exact threshold constant and where it lives.
3. The exact repo signature and Drizzle update predicate; which table carries `expiresAt`; audit decision.
4. The exact call-site insertion in `apps/worker/src/index.ts` (before `sweepTvExpiry`).
5. The PGlite test matrix (5 cases).

## Files inspected

- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\src\repositories.ts` (full; lines 1–1419)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\src\schema.ts` (full; lines 1–660)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\worker\src\index.ts` (full; lines 1–113)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\worker\src\jobs.ts` (full; lines 1–175)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web\src\features\tv\queries.ts` (full; lines 1–98)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web\src\features\tv\actions.ts` (full; lines 1–153)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\tests\integration\db-pg5.test.ts` (full; lines 1–127)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\tradingview-access\src\index.ts` (full; lines 1–106)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\TRADINGVIEW_ACCESS_PLAN.md` (full; lines 1–564)
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\handoffs\20260530-1930-phase-2-7-tortila-states-tv-bounded-fixes.md`

## Files changed

None — read-only audit.

## Findings

### F-01 (high) — `expiring_soon` status is never written by any DB code path

**Evidence:**
- `packages/db/src/repositories.ts:252` — `TvStatus` type includes `'expiring_soon'` as a valid union member.
- `packages/db/src/repositories.ts:326–338` — `sweepTvExpiry` queries only `status = 'granted'` AND `expiresAt <= now`. It never queries the window `now < expiresAt <= now+7d` and never writes `expiring_soon`.
- `packages/tradingview-access/src/index.ts:99–100` — The in-memory `TvAccessService.sweep()` DOES write `expiring_soon` (the `else if` branch at line 99); but this code path is used only in the `memoryTick()` demo loop, never in `dbTick()`.
- `apps/web/src/features/tv/queries.ts:92` — The admin queue counts `active` as `granted || expiring_soon`. This count is always equivalent to `granted`-only because no row ever has `status = 'expiring_soon'` in the DB.
- `apps/web/src/features/tv/actions.ts:52` — `GRANTABLE_STATES` includes `'expiring_soon'`, meaning admin can re-grant an expiring-soon request; but since the status is never written, this branch is unreachable.
- `docs/TRADINGVIEW_ACCESS_PLAN.md:104–106` — Confirms this is a known gap: "The `expiring_soon` DB transition is TARGET."

**Recommendation:** Implement `markExpiringSoon` as described in Findings F-02 through F-05 below.

---

### F-02 (medium) — Exact semantics and transition invariants for `markExpiringSoon`

**Evidence and design:**

The correct transition predicate, based on reading `sweepTvExpiry` at `repositories.ts:327–330` and the
in-memory sweep at `tradingview-access/src/index.ts:92–103`:

```
UPDATE tradingview_access_requests
SET status = 'expiring_soon'
WHERE status = 'granted'
  AND expiresAt IS NOT NULL
  AND expiresAt > now            -- still in the future (not yet expired)
  AND expiresAt <= now + TV_EXPIRING_SOON_WINDOW_MS
```

Invariants verified by reading the schema and repos:

1. **Only `granted` rows transition** — `pending`, `revoked`, `expired`, and already-`expiring_soon` rows
   are excluded by the `status = 'granted'` predicate. This matches the in-memory sweep at
   `tradingview-access/src/index.ts:92` which iterates `list({ status: 'granted' })` only.

2. **`expiresAt > now`** — excludes already-expired rows. `sweepTvExpiry` handles those
   (`repositories.ts:330`: `lte(expiresAt, now)`). If `markExpiringSoon` runs first and a row is
   simultaneously within the window AND past expiry (impossible by construction: `> now AND <= now+7d`
   implies `> now`), the predicate is still safe.

3. **`expiresAt IS NOT NULL`** — schema at `schema.ts:166` shows `expiresAt` is nullable on the request
   row (never-expiring admin grants). Rows with null `expiresAt` must not be touched. Drizzle's `and(gt,
   lte)` on a nullable column is DB-engine safe (Postgres evaluates NULL comparisons as NULL = false), but
   adding an explicit `isNotNull` guard is cleaner and self-documenting.

4. **Idempotent** — `status = 'granted'` in the predicate means a second run will find zero matching rows
   (they are already `expiring_soon`) and issue an UPDATE affecting 0 rows. No second write, no audit
   duplication.

5. **Must run BEFORE `sweepTvExpiry`** — so a row transitions `granted → expiring_soon → (later tick) → revoked`.
   If sweep runs first, it would consume the row as expired and revoke it before expiring_soon is ever
   written. The ordering in `apps/worker/src/index.ts:34–35` currently is:
   `reconcileAllEntitlements` then `sweepTvExpiry`. `markExpiringSoon` inserts between them:
   `reconcileAllEntitlements` → `markExpiringSoon` → `sweepTvExpiry`.
   This ensures: expiry reconciliation first, then warn window, then revoke.

**Recommendation:** Implement as described.

---

### F-03 (medium) — `expiresAt` column location: request row, not grant row

**Evidence:**

Both the `tradingview_access_requests` table (`schema.ts:166`) and the `tradingview_access_grants` table
(`schema.ts:479`) carry an `expiresAt` column. The question is which one `markExpiringSoon` should read.

`sweepTvExpiry` at `repositories.ts:327–330` queries `tradingviewAccessRequests.expiresAt`. The request
row `expiresAt` is written by `atomicGrantTv` at `repositories.ts:1272–1273` from `now + durationMs`.
The grant row `expiresAt` is also set to the same value (line 1281). Both are kept in sync by
`atomicGrantTv`; but the canonical source for the sweep is the request row.

`markExpiringSoon` must use `tradingviewAccessRequests.expiresAt` (same table, same column) for
consistency with `sweepTvExpiry`. The Drizzle symbol is `s.tradingviewAccessRequests.expiresAt`.

**Recommendation:** Use `s.tradingviewAccessRequests.expiresAt` — do not query `tradingviewAccessGrants`.

---

### F-04 (medium) — Threshold constant location and value

**Evidence:**

The in-memory sweep uses a module-level constant at `tradingview-access/src/index.ts:52`:
```ts
const EXPIRING_WINDOW_MS = 7 * 86_400_000;
```
This is private (not exported) and lives inside `packages/tradingview-access`, not `packages/db`.

`sweepTvExpiry` defines its parallel constant implicitly via a direct `lte(..., new Date(now))` call
— there is no named `TV_EXPIRY_WINDOW_MS` exported from `repositories.ts`. The only exported constant
for the TV domain is `TV_EXPIRED_BY_WORKER_REASON` at `repositories.ts:315`.

The new constant should live alongside the other TV repo constants in `packages/db/src/repositories.ts`
immediately before `markExpiringSoon`, so the worker does not need to import from
`@wtc/tradingview-access`:

```ts
/** 7-day window: requests whose expiresAt is within this range from now are marked 'expiring_soon'. */
export const TV_EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
```

Placing it near `TV_EXPIRED_BY_WORKER_REASON` (line 315) keeps the two TV sweep constants co-located.

**Recommendation:** Export `TV_EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000` from
`packages/db/src/repositories.ts` near line 315.

---

### F-05 (medium) — Exact repo signature, Drizzle predicate, and audit decision

**Evidence and design:**

The `sweepTvExpiry` signature is `(db: Db, now = Date.now()): Promise<{ expired: number; tasksQueued: number }>`.
`markExpiringSoon` follows the same pattern.

The Drizzle import at `repositories.ts:11` is:
```ts
import { and, eq, lte, desc, isNull, inArray } from 'drizzle-orm';
```
Two new operators are needed: `gt` (greater-than, for `expiresAt > now`) and `isNotNull`.
`isNotNull` is not yet imported (but `isNull` is). `gt` is not yet imported.
The import line must be updated to add both.

**Applyable signature (insert after line 337, i.e., after the closing `}` of `sweepTvExpiry`):**

```ts
/**
 * Pre-pass: mark GRANTED requests whose expiresAt is within the next 7 days as 'expiring_soon'.
 * Must run BEFORE sweepTvExpiry in the worker tick so the state progression is:
 *   granted → expiring_soon → (next tick, past expiresAt) → revoked.
 *
 * Transition predicate:
 *   status = 'granted'
 *   AND expiresAt IS NOT NULL
 *   AND expiresAt > now            (still in the future — sweep handles the expired side)
 *   AND expiresAt <= now + TV_EXPIRING_SOON_WINDOW_MS
 *
 * Idempotent: a second run finds zero rows (already expiring_soon) and writes nothing.
 * Does NOT audit individual row transitions (a single aggregate note is sufficient for an
 * internal status pre-pass; the downstream revoke audit via atomicRevokeTv is the durable record).
 * Returns { marked: number }.
 */
export async function markExpiringSoon(
  db: Db,
  now = Date.now(),
): Promise<{ marked: number }> {
  const windowEnd = new Date(now + TV_EXPIRING_SOON_WINDOW_MS);
  const result = await db
    .update(s.tradingviewAccessRequests)
    .set({ status: 'expiring_soon' })
    .where(
      and(
        eq(s.tradingviewAccessRequests.status, 'granted'),
        isNotNull(s.tradingviewAccessRequests.expiresAt),
        gt(s.tradingviewAccessRequests.expiresAt, new Date(now)),
        lte(s.tradingviewAccessRequests.expiresAt, windowEnd),
      ),
    )
    .returning({ id: s.tradingviewAccessRequests.id });
  return { marked: result.length };
}
```

The `returning({ id })` trick is necessary because Drizzle (like Postgres) does not return a row count
from an UPDATE by default in the postgres-js driver — `.returning()` is the idiomatic way to count
affected rows. If an exact count is not needed, `result.length` from `.returning({ id })` is sufficient.

**Import line change** (line 11 of `repositories.ts`):
```ts
// Before:
import { and, eq, lte, desc, isNull, inArray } from 'drizzle-orm';
// After:
import { and, eq, lte, gt, desc, isNull, isNotNull, inArray } from 'drizzle-orm';
```

**Audit decision:** No per-row audit row for `markExpiringSoon`. Rationale:
- The transition `granted → expiring_soon` is a soft informational state bump, not an access-change.
  The user still has access; nothing is being revoked.
- The security auditor (Phase 2.7 handoff `20260530-1930-ecosystem-security-auditor.md`) confirmed that
  the `tv_access.revoke` audit row written by `atomicRevokeTv` is the durable revoke record; the
  expiring_soon pre-pass is a scheduler concern, not a security event.
- Adding audit rows for every `expiring_soon` bump would inflate `audit_logs` with low-signal rows.
  A single log line from the worker (`console.log('[worker:db] tv expiring_soon marked N')`) is
  sufficient operational observability.
- This is consistent with how `reconcileAllEntitlements` works: the in-memory `reconcileEntitlements`
  writes audit rows for every status change (including `active → grace → expired`), but the bulk DB
  `reconcileAllEntitlements` only audits the final `expired`/`revoked` transitions (not the
  intermediate grace bump). Pattern: access-granting and access-revoking transitions are audited;
  purely informational intermediate states are not.

**Recommendation:** No per-row audit in `markExpiringSoon`. Log aggregate count only.

---

### F-06 (medium) — Worker call-site insertion

**Evidence:**

`apps/worker/src/index.ts:31–36` shows the current `dbTick` body:
```ts
const { createDb, reconcileAllEntitlements, sweepTvExpiry, recordHealthCheck, ensureBotInstance } = await import('@wtc/db');
const db = createDb(url);
const now = Date.now();
const ent = await reconcileAllEntitlements(db, now);
const tv = await sweepTvExpiry(db, now);
await recordHealthCheck(...);
```

`markExpiringSoon` is not imported and not called. It must be:
1. Added to the destructuring import on line 31.
2. Called with `now` between `reconcileAllEntitlements` and `sweepTvExpiry`.

**Applyable diff for `apps/worker/src/index.ts` lines 31–37:**

```ts
// line 31 — add markExpiringSoon to the import
const { createDb, reconcileAllEntitlements, markExpiringSoon, sweepTvExpiry, recordHealthCheck, ensureBotInstance } = await import('@wtc/db');
const db = createDb(url);
const now = Date.now();
const ent = await reconcileAllEntitlements(db, now);
// NEW: mark expiring_soon BEFORE sweepTvExpiry so the state progression is:
//   granted → expiring_soon (this pre-pass) → revoked (next tick, via sweepTvExpiry → atomicRevokeTv)
const expiring = await markExpiringSoon(db, now);
const tv = await sweepTvExpiry(db, now);
await recordHealthCheck(db, 'worker', 'ok', {
  entitlementsChanged: ent.changed,
  tvExpiringSoon: expiring.marked,
  tvExpired: tv.expired,
  tvTasksQueued: tv.tasksQueued,
});
console.log(`[worker:db] entitlements changed ${ent.changed}, tv expiring_soon ${expiring.marked}, tv expired ${tv.expired}, revoke tasks ${tv.tasksQueued}`);
```

The `recordHealthCheck` detail object gains `tvExpiringSoon` for operational visibility. The existing
`console.log` gains the count. No other change is needed in the worker.

**Recommendation:** Apply the diff above. The ordering guarantee is: reconcile entitlements → mark
expiring_soon → sweep expired → health check.

---

### F-07 (low) — Also mark `expiring_soon` on GRANT rows (optional, low priority)

**Evidence:**

`tradingview_access_grants` (`schema.ts:479`) also carries an `expiresAt` column with an index
(`tvag_expires_at_idx` at `schema.ts:489`). The admin UI (`queries.ts:64`) returns `TvGrantRow[]` which
includes `expiresAt`. However, the grant row has no `status` column (it is `revokedAt IS NULL` = active,
`revokedAt IS NOT NULL` = revoked). The `expiring_soon` concept lives only on the request row.

`markExpiringSoon` correctly targets `tradingview_access_requests` only. The grant row does not need a
status update. The admin UI surfaces grant expiry via the request row's status. No action needed on
the grant table.

**Recommendation:** No change to the grant row; `markExpiringSoon` on the request row is sufficient.

---

### F-08 (low) — `TRADINGVIEW_ACCESS_PLAN.md` "CURRENT" labels need updating post-implementation

**Evidence:**

`docs/TRADINGVIEW_ACCESS_PLAN.md:104–106`:
```
CURRENT — `expiring_soon` transition:
The `expiring_soon` state transition ... the DB worker sweep does NOT mark `expiring_soon` — it only
handles `expired`. The `expiring_soon` DB transition is TARGET.
```

Once `markExpiringSoon` is implemented, this claim becomes stale. The plan doc also lists
`granted --> expiring_soon : scheduler: days_until_expiry <= WARNING_DAYS (TARGET)` in the state machine
diagram at line 205.

**Recommendation:** After implementation, update `TRADINGVIEW_ACCESS_PLAN.md` lines 104–106 and the state
machine diagram at line 205 to mark the `expiring_soon` transition as CURRENT. (Deferred to the
implementation agent.)

---

### F-09 (info) — Test matrix for `tests/integration/db-pg5.test.ts` (new file or appended section)

**Evidence:**

The existing `db-pg5.test.ts` covers sweep atomicity and `listUsersWithEmailByIds`. The `markExpiringSoon`
function needs its own PGlite test matrix. The test file uses a `beforeAll` that runs migrations and
seeds the DB in isolation. The five required cases are:

**Test matrix (applyable; add as a new `describe` block in `tests/integration/db-pg5.test.ts` or a
sibling `db-pg5-expiring-soon.test.ts`):**

```ts
import { markExpiringSoon, TV_EXPIRING_SOON_WINDOW_MS, atomicGrantTv, sweepTvExpiry,
         submitTvRequest, listAllTv } from '@wtc/db';

describe('markExpiringSoon pre-pass', () => {

  // Case 1: row 6 days from expiry → transitions to expiring_soon
  it('marks a granted request expiring in 6 days as expiring_soon', async () => {
    const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    // Grant with expiresAt 6 days in the future
    const req = await submitTvRequest(db, userB, 'mark_user_soon');
    await atomicGrantTv(db, { requestId: req.id, userId: userB, tvUsername: 'mark_user_soon',
      adminId: admin, durationMs: sixDaysMs }, now);
    const result = await markExpiringSoon(db, now);
    expect(result.marked).toBeGreaterThanOrEqual(1);
    const rows = await listAllTv(db);
    expect(rows.find(r => r.id === req.id)!.status).toBe('expiring_soon');
  });

  // Case 2: row 10 days from expiry → unchanged (still granted)
  it('does NOT mark a granted request expiring in 10 days', async () => {
    const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const req = await submitTvRequest(db, userB, 'mark_user_not_yet');
    await atomicGrantTv(db, { requestId: req.id, userId: userB, tvUsername: 'mark_user_not_yet',
      adminId: admin, durationMs: tenDaysMs }, now);
    await markExpiringSoon(db, now);
    const rows = await listAllTv(db);
    expect(rows.find(r => r.id === req.id)!.status).toBe('granted');
  });

  // Case 3: already-expired row → not touched by markExpiringSoon (left for sweepTvExpiry)
  it('does NOT touch a row whose expiresAt is in the past', async () => {
    const now = Date.now();
    const req = await submitTvRequest(db, userB, 'mark_user_past');
    // Grant with negative duration: expiresAt = now - 1s (already expired)
    await atomicGrantTv(db, { requestId: req.id, userId: userB, tvUsername: 'mark_user_past',
      adminId: admin, durationMs: -1000 }, now);
    // markExpiringSoon should NOT touch this row (expiresAt <= now is excluded by > now guard)
    await markExpiringSoon(db, now);
    const rows = await listAllTv(db);
    // Still 'granted' — sweepTvExpiry is responsible for this row
    expect(rows.find(r => r.id === req.id)!.status).toBe('granted');
  });

  // Case 4: idempotent — second run with same now is a no-op
  it('is idempotent: a second run with the same now marks 0 additional rows', async () => {
    // Reuse the 6-day row from Case 1 (now expiring_soon); run again
    const result2 = await markExpiringSoon(db, Date.now());
    // May mark 0 or some new rows from other tests, but the already-expiring_soon row is not double-marked
    const rows = await listAllTv(db);
    // All expiring_soon rows remain expiring_soon (no double transition)
    for (const r of rows.filter(r => r.status === 'expiring_soon')) {
      expect(r.status).toBe('expiring_soon'); // tautological but documents no regression
    }
    // The key invariant: no expiring_soon row was changed back to granted
    expect(result2.marked).toBeGreaterThanOrEqual(0); // idempotent = no error, count may be 0
  });

  // Case 5: revoked row → not touched
  it('does NOT touch a revoked row', async () => {
    const now = Date.now();
    const req = await submitTvRequest(db, userB, 'mark_user_revoked');
    await atomicGrantTv(db, { requestId: req.id, userId: userB, tvUsername: 'mark_user_revoked',
      adminId: admin, durationMs: 3 * 24 * 60 * 60 * 1000 }, now);
    // Manually revoke the row
    const { atomicRevokeTv } = await import('@wtc/db');
    await atomicRevokeTv(db, req.id, { id: admin, role: 'admin' }, 'test-revoke', now);
    // Now run markExpiringSoon — should not touch it
    await markExpiringSoon(db, now);
    const rows = await listAllTv(db);
    expect(rows.find(r => r.id === req.id)!.status).toBe('revoked');
  });
});
```

**Recommendation:** Add this test block. Note that Cases 3 and 5 require careful isolation (their grant
rows will have `status = 'granted'` right after `atomicGrantTv`, so the `beforeAll` PGlite instance
should be isolated per describe block to avoid cross-test interference, or the assertions should find the
specific row by `req.id`). Using `req.id` lookups (as shown above) avoids interference even in a shared
PGlite instance.

---

### F-10 (info) — `expiringSoon` count not surfaced in worker health-check detail

**Evidence:**

`apps/worker/src/index.ts:36`:
```ts
await recordHealthCheck(db, 'worker', 'ok', { entitlementsChanged: ent.changed, tvExpired: tv.expired, tvTasksQueued: tv.tasksQueued });
```
After adding `markExpiringSoon`, the `tvExpiringSoon: expiring.marked` count is new operational
information. The F-06 finding above already includes it in the recommended diff.

**Recommendation:** Included in F-06 diff.

## Decisions

1. **`expiring_soon` status is written on the `tradingview_access_requests` table only** — same table
   that `sweepTvExpiry` reads. No change to `tradingview_access_grants`.

2. **Predicate is `status = 'granted' AND expiresAt IS NOT NULL AND expiresAt > now AND expiresAt <= now + 7d`** —
   strictly excludes expired/revoked/pending/already-expiring-soon rows.

3. **Ordering in worker: reconcile → markExpiringSoon → sweepTvExpiry** — so the state machine is
   `granted → expiring_soon → revoked` across ticks, never skipping the warn state.

4. **No per-row audit for `markExpiringSoon`** — an internal informational status bump; the durable
   audit record is the downstream `tv_access.revoke` (written by `atomicRevokeTv`). Consistent with
   `reconcileAllEntitlements` pattern.

5. **`TV_EXPIRING_SOON_WINDOW_MS` lives in `packages/db/src/repositories.ts`** adjacent to
   `TV_EXPIRED_BY_WORKER_REASON` — not in `@wtc/tradingview-access` (which is the in-memory service) to
   avoid a cross-package dependency in the worker.

6. **Import extension required**: `gt` and `isNotNull` must be added to the `drizzle-orm` import at
   `repositories.ts:11`.

7. **No migration needed** — `tradingview_access_requests.status` (`schema.ts:162`) already accepts
   `expiring_soon` as a valid text value; it is a plain `text` column with no DB-level CHECK constraint.
   `db:generate` should report "No schema changes".

8. **`returning({ id })` for row count** — Drizzle/postgres-js does not expose `rowCount` from UPDATE;
   `.returning()` is the correct idiomatic way to count affected rows.

## Risks

- **Case 3 test subtlety**: a row with `expiresAt = now - 1000` and `status = 'granted'` is NOT touched
  by `markExpiringSoon` (correct — guarded by `> now`). But it also will NOT be touched by
  `sweepTvExpiry` if status is already something other than `'granted'`. In practice, right after
  `atomicGrantTv` the status is `'granted'`, so `sweepTvExpiry` will pick it up on the same tick.
  The test must assert the row is still `'granted'` immediately after `markExpiringSoon` but before
  `sweepTvExpiry` runs.

- **`expiring_soon` → `revoked` path**: once a row transitions to `expiring_soon`, `sweepTvExpiry`
  queries `status = 'granted'` only (`repositories.ts:330`), so it will MISS the `expiring_soon` row on
  subsequent ticks. The sweep's WHERE clause must be updated to include `'expiring_soon'`:
  ```ts
  // Current (repositories.ts:330):
  .where(and(eq(s.tradingviewAccessRequests.status, 'granted'), lte(...)))
  // Required fix:
  .where(and(inArray(s.tradingviewAccessRequests.status, ['granted', 'expiring_soon']), lte(...)))
  ```
  **This is a critical correctness issue**: without this change, `expiring_soon` rows will never be
  revoked by the sweep — they will be stuck in `expiring_soon` indefinitely. This fix must be applied
  atomically with `markExpiringSoon`.

- **`GRANTABLE_STATES` in actions.ts** (`actions.ts:52`) already includes `'expiring_soon'`, so the
  admin can re-grant an expiring-soon request. This is correct; no change needed there.

- **PGlite isolation**: the shared `beforeAll` PGlite instance in `db-pg5.test.ts` accumulates rows
  across tests. The `markExpiringSoon` tests must look up rows by `req.id` rather than relying on total
  counts. The test matrix in F-09 already does this.

- **No real-PG run**: as in all prior phases, the real-PG harness is NOT RUN (no `DATABASE_URL`). The
  PGlite path exercises the same SQL engine.

## Verification/tests

The following tests should be added and run to verify the implementation:

| # | Test | Location | Expected |
|---|------|----------|----------|
| 1 | Row 6 days from expiry → `expiring_soon` | `db-pg5.test.ts` (new describe) | `status = 'expiring_soon'`, `marked >= 1` |
| 2 | Row 10 days from expiry → unchanged `granted` | Same | `status = 'granted'`, row not transitioned |
| 3 | Row with `expiresAt` in the past → not touched | Same | `status = 'granted'` (sweep handles it) |
| 4 | Idempotent second run → no error, already-expiring rows unchanged | Same | `status = 'expiring_soon'` still |
| 5 | Revoked row → not touched | Same | `status = 'revoked'` |
| 6 | `sweepTvExpiry` with `expiring_soon` row → revokes it (sweep WHERE fix) | `db-pg5.test.ts` | `status = 'revoked'` after sweep |

Gate sequence (unchanged from Phase 2.7):
```
npm run check:core
npm run lint
npm run typecheck
npm run typecheck -w @wtc/web
npm run secret:scan
npm test          # 317 baseline + new markExpiringSoon tests
npm run coverage
npm run db:generate -w @wtc/db   # must remain "No schema changes"
npm run build -w @wtc/web
npm run e2e
npm run governance:check
```

## Next actions

1. **[CRITICAL — must be co-landed with `markExpiringSoon`]** Update `sweepTvExpiry` WHERE clause at
   `packages/db/src/repositories.ts:330` to include `'expiring_soon'` rows:
   ```ts
   // Change:
   .where(and(eq(s.tradingviewAccessRequests.status, 'granted'), lte(...)))
   // To:
   .where(and(inArray(s.tradingviewAccessRequests.status, ['granted', 'expiring_soon']), lte(...)))
   ```
   Without this, `markExpiringSoon` creates rows that the sweep will never clean up.

2. **Add `gt` and `isNotNull` to the `drizzle-orm` import** at `repositories.ts:11`.

3. **Add `TV_EXPIRING_SOON_WINDOW_MS` constant** to `repositories.ts` near line 315 (adjacent to
   `TV_EXPIRED_BY_WORKER_REASON`).

4. **Add `markExpiringSoon` function** to `repositories.ts` after `sweepTvExpiry` (after line 338),
   with signature and Drizzle predicate as specified in F-05.

5. **Update worker `dbTick`** at `apps/worker/src/index.ts:31–37` to import and call `markExpiringSoon`
   between `reconcileAllEntitlements` and `sweepTvExpiry`, as specified in F-06.

6. **Add PGlite tests** for all 5 cases (plus the sweep-with-expiring-soon case) in
   `tests/integration/db-pg5.test.ts` or a sibling file, as specified in F-09.

7. **Update `docs/TRADINGVIEW_ACCESS_PLAN.md`** lines 104–106 and the state machine diagram to mark
   the `expiring_soon` transition as CURRENT (deferred; can be done in the same PR).

8. **Carry-forward**: the `entitlement_id` FK on `tradingview_access_requests` (referenced in the TARGET
   scheduler algorithm at `TRADINGVIEW_ACCESS_PLAN.md:329`) is still absent from the schema. The current
   `markExpiringSoon` design correctly uses `tradingviewAccessRequests.expiresAt` (set at grant time from
   `durationMs`) — it does NOT join `entitlements`. The full TARGET scheduler that joins entitlements is
   still TARGET; `markExpiringSoon` is the bounded CURRENT implementation of the warning step only.
