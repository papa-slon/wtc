# ecosystem-tradingview-access-implementer handoff

## Scope

Phase 2.7 read-only audit — Phase Group 5 (TradingView bounded fixes). Produce
implementation-ready call-site plans for 4 items:
1. sweepTvExpiry rewritten to call atomicRevokeTv per expired grant.
2. listUsersWithEmailByIds new repo function + loadTvAdminData N+1 fix.
3. revokeReason column added to grant-history table in the admin UI.
4. <14-day expiry banner on /app/indicators.

## Files inspected

- packages/db/src/schema.ts (lines 157-506)
- packages/db/src/repositories.ts (lines 1-1382, with focus on 250-327, 758-806, 1236-1381)
- apps/web/src/features/tv/queries.ts (all 99 lines)
- apps/web/src/app/admin/tradingview-access/page.tsx (all 197 lines)
- apps/web/src/app/(app)/app/indicators/page.tsx (all 179 lines)
- apps/worker/src/index.ts (all 108 lines)
- apps/worker/src/jobs.ts (all 149 lines)
- tests/integration/db-persistence.test.ts (all 271 lines)
- tests/integration/db-0003.test.ts (all 461 lines)
- packages/ui/src/components.tsx (lines 50-80)

## Files changed

None — read-only audit.

---

## Findings

### F-01 (high) sweepTvExpiry does not call atomicRevokeTv — grant row and profile pointer are never stamped by the worker

**Evidence:** packages/db/src/repositories.ts:315-327

The current loop issues a raw `UPDATE tradingview_access_requests SET status='expired'` and inserts a
`tradingview_access_tasks` row. It does NOT:
- Update `tradingview_access_grants` (revokedAt, revokedBy, revokeReason).
- Null the `tradingview_profiles.currentGrantId` pointer.
- Write the canonical `tv_access.revoke` audit row.

`atomicRevokeTv` (lines 1301-1339) performs all four steps atomically. The sweep must delegate to it.

**Recommendation:** Rewrite sweepTvExpiry (exact body below in Decisions).

**Target part:** PG5

---

### F-02 (high) loadTvAdminData has an N+1 query — getUserById called once per request row

**Evidence:** apps/web/src/features/tv/queries.ts:83-89

```
const rows: TvAdminRow[] = await Promise.all(
  requestRows.map(async (r) => {
    const dto = rowToTvDto(r);
    const userRow = await getUserById(db, r.userId);   // ← 1 query per row
    return { ...dto, userEmail: userRow?.email ?? r.userId };
  }),
);
```

With N requests this fires N sequential (or parallel via Promise.all) SELECT queries against the
users table. The repos already demonstrate the 2-flat-query pattern (listUsersWithCreatedAt,
line 1355-1381). A new `listUsersWithEmailByIds` repo function resolves this in one query.

**Recommendation:** Add `listUsersWithEmailByIds` to repositories.ts (exact signature below) and
rewrite loadTvAdminData to call it once after gathering all userIds.

**Target part:** PG5

---

### F-03 (medium) Grant-history table in admin UI has no revokeReason column

**Evidence:** apps/web/src/app/admin/tradingview-access/page.tsx:172-194

The `<table>` for grant history shows tvUsername, grantedAt, expiresAt, grantedByType,
revokedAt — but not revokeReason. The schema column `revokeReason` exists on
`tradingviewAccessGrants` (schema.ts:484) and is populated by atomicRevokeTv (repositories.ts:1321).
TvGrantRow is `typeof s.tradingviewAccessGrants.$inferSelect` (repositories.ts:759), so the field
is already in the type.

**Recommendation:** Add a revokeReason column to the grant-history `<th>`/`<td>` (exact JSX below).
The request-queue table at lines 56-158 does NOT need a join to show revokeReason — the request row
itself does not store revokeReason (that lives on the grant row). Showing it in the grants section
is correct and sufficient. No join is needed because the admin already sees the full grants array.

**Target part:** PG2 (admin UI)

---

### F-04 (medium) No expiry-approaching banner on /app/indicators for the user

**Evidence:** apps/web/src/app/(app)/app/indicators/page.tsx:1-179

There is no 14-day warning. The server-side worker marks status=`expiring_soon` at 7 days
(sweepTvExpiry currently only marks `expired`; the expiring_soon promotion is not yet wired
either — see F-01 relationship). The user has no advance UI warning before their grant expires.

**Recommendation:** Compute soonest upcoming expiry from grants (non-revoked, non-expired) and
requests with status `granted` or `expiring_soon`, check threshold 14*86_400_000 ms, and render
a RiskWarningBanner (exact JSX block below). The 7-day server `expiring_soon` status and the
14-day client banner are complementary: the banner fires at 14 days, the pill changes colour
at 7 days.

**Target part:** PG2 (user indicators page)

---

### F-05 (low) sweepTvExpiry audit uses legacy action 'tradingview.revoke' instead of canonical 'tv_access.revoke'

**Evidence:** packages/db/src/repositories.ts:311 vs 1335

The old `revokeTv` (line 308) writes `action: 'tradingview.revoke'`. `atomicRevokeTv` (line 1333)
writes `action: 'tv_access.revoke'`. If sweepTvExpiry is rewritten to call `atomicRevokeTv`, it
will naturally use the canonical action string. No separate fix needed beyond F-01 resolution.

**Target part:** PG5

---

### F-06 (low) sweepTvExpiry does not mark expiring_soon before expiry

**Evidence:** packages/db/src/repositories.ts:315-327

The function only selects rows where `status='granted' AND expiresAt <= now` (i.e., already past
deadline). There is no sweep step that promotes rows within 7 days to `expiring_soon`. The
`expiring_soon` status is declared in the type union (line 252) and used in UI tone logic
(queries.ts:93, page.tsx:10, indicators/page.tsx:27) but is never written by the worker. This
is a separate, bounded gap — the operator should decide whether to add a pre-expiry pass to
sweepTvExpiry or a separate `markExpiringSoon(db, horizon)` helper. Not blocked by the
4 items in scope, but should be tracked.

**Target part:** PG5

---

### F-07 (info) atomicRevokeTv signature places `reason` before `now` — breaking change risk when called from sweepTvExpiry

**Evidence:** packages/db/src/repositories.ts:1301-1306

```ts
export async function atomicRevokeTv(
  db: Db,
  requestId: string,
  adminId: string,
  reason?: string,
  now = Date.now(),
): Promise<void>
```

The `reason` parameter is positional (4th), `now` is 5th. Sweeper must pass both explicitly:
`atomicRevokeTv(db, r.id, SYSTEM_ACTOR_ID, 'expired_by_worker', now)`.
This is correct and unambiguous as long as the caller does not accidentally omit `reason`
and pass `now` as the 4th argument (which would be silently coerced to string).

**Recommendation:** The operator should call it with an explicit reason string, not with `now`
in the reason position. The pattern in Decisions shows the safe call shape.

**Target part:** PG5

---

## Decisions

### D-01 — sweepTvExpiry rewrite: delegate to atomicRevokeTv, keep tasksQueued in return value

**Decision:** Keep inserting the `tradingview_access_tasks` row. Reasoning: the task row is an
informational surface already referenced in the admin page copy
("revoke tasks are informational and unconsumed"). Dropping it silently would remove audit
breadcrumbs. The tasks table `kind='revoke'` row signals "the worker identified this as
needing revoke" even when no automation adapter is active. Keep it in the loop AFTER the atomic
revoke so it is only inserted if the revoke succeeds.

The return value `{ expired: number; tasksQueued: number }` is preserved unchanged so the
worker (index.ts:36) and health-check log remain correct.

**Actor ID:** The sweeper must pass an actor ID for the audit row. There is no `SYSTEM_USER_ID`
constant yet. Recommendation: use a well-known sentinel UUID
`'00000000-0000-0000-0000-000000000000'` (all-zeros) as the system actor, matching the
`actorUserId: null` / `actorRole: 'system'` pattern elsewhere. The security auditor should
confirm or supply a real system-actor row. The operator should use `null` for actorUserId and
pass `'system'` as actorRole to match the existing audit pattern. However, `atomicRevokeTv`
takes `adminId: string` (a uuid), not nullable. Two options:

  Option A (recommended): add a `SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000'`
  constant exported from `@wtc/shared` or defined locally in the worker, and pass it as adminId.
  The audit row will show actorUserId = that sentinel. Document it in RBAC_MATRIX.

  Option B: extend atomicRevokeTv to accept `adminId: string | null` and map null → actorUserId=null
  in the audit row. This is the fuller fix but touches the existing function signature.

The plan below uses Option A (const SYSTEM_ACTOR_ID) as the minimal safe change.

**Exact rewrite of sweepTvExpiry (packages/db/src/repositories.ts, replace lines 315-327):**

```ts
/** Worker sweep: mark expired grants and queue revoke tasks via atomicRevokeTv.
 *  Each expired 'granted' request is atomically revoked (request + grant + profile + audit).
 *  A tradingview_access_tasks row is inserted AFTER a successful revoke as an informational marker
 *  (tasks are unconsumed; no automation adapter is active by default).
 *  Returns { expired, tasksQueued } so the worker health log is unchanged.
 */
export async function sweepTvExpiry(db: Db, now = Date.now()): Promise<{ expired: number; tasksQueued: number }> {
  // Sentinel system actor: no human actor for automated sweeps.
  // This UUID should be the same across all system-actor audit rows.
  const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

  const due = await db
    .select()
    .from(s.tradingviewAccessRequests)
    .where(and(
      eq(s.tradingviewAccessRequests.status, 'granted'),
      lte(s.tradingviewAccessRequests.expiresAt, new Date(now)),
    ));

  let tasksQueued = 0;
  for (const r of due) {
    await atomicRevokeTv(db, r.id, SYSTEM_ACTOR_ID, 'expired_by_worker', now);
    await db.insert(s.tradingviewAccessTasks).values({ requestId: r.id, kind: 'revoke', done: false });
    tasksQueued += 1;
  }
  return { expired: due.length, tasksQueued };
}
```

NOTE: `atomicRevokeTv` is defined later in the same file (line 1301). Because both functions are
in the same module and JS hoisting applies to `const` exports only within the module, the call is
valid as long as `sweepTvExpiry` is called at runtime (not at module evaluation time). The current
file is already structured this way (functions declared in any order, called at runtime). No
circular-dependency issue.

The SYSTEM_ACTOR_ID constant can be extracted to a top-level `const` once confirmed by the
security auditor — inline is safe for now.

---

### D-02 — listUsersWithEmailByIds: exact repo signature and loadTvAdminData rewrite

**Add to packages/db/src/repositories.ts** (insert after `listUsersWithCreatedAt`, approximately
line 1382):

```ts
/**
 * Batch-resolve user emails by ID list. Returns a Map<id, email>.
 * Uses ONE inArray query; safe for admin-only call sites.
 * Early-returns an empty Map for an empty ids array (no DB round-trip).
 *
 * SECURITY: email is not a secret, but this function is admin-only.
 * Never call this in user-facing or unauthenticated paths.
 */
export async function listUsersWithEmailByIds(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .where(inArray(s.users.id, ids));
  const m = new Map<string, string>();
  for (const r of rows) m.set(r.id, r.email);
  return m;
}
```

**Also required:** add `inArray` to the drizzle-orm import at line 11:

```ts
import { and, eq, lte, desc, isNull, inArray } from 'drizzle-orm';
```

**Export listUsersWithEmailByIds from packages/db/src/index.ts** (or wherever the barrel
export lives — check the package's index).

**Rewrite loadTvAdminData in apps/web/src/features/tv/queries.ts:**

Replace the import block to add `listUsersWithEmailByIds`:

```ts
import {
  listTvByUser,
  listAllTv,
  listTvGrantsForUser,
  listAllTvGrants,
  getTvProfile,
  listUsersWithEmailByIds,   // ← replaces getUserById
  rowToTvDto,
  type TvRequestDTO,
  type TvProfileRow,
  type TvGrantRow,
} from '@wtc/db';
```

Replace lines 83-89 (the N+1 Promise.all block) with:

```ts
  // Gather unique userIds from the request list, then resolve emails in ONE query.
  const uniqueUserIds = [...new Set(requestRows.map((r) => r.userId))];
  const emailMap = await listUsersWithEmailByIds(db, uniqueUserIds);

  const rows: TvAdminRow[] = requestRows.map((r) => {
    const dto = rowToTvDto(r);
    return { ...dto, userEmail: emailMap.get(r.userId) ?? r.userId };
  });
```

This changes the function from async-parallel getUserById calls (O(N) queries) to exactly 2
queries total: listAllTv + listAllTvGrants (already there) + 1 inArray users query.

---

### D-03 — revokeReason in admin grant-history table

**Confirmed:** `TvGrantRow` is `typeof s.tradingviewAccessGrants.$inferSelect`
(repositories.ts:759). The schema column `revokeReason text` exists (schema.ts:484).
The field is already in the TypeScript type. No DTO mapping needed.

**The request-queue table** (page.tsx:56-158) shows columns from `TvRequestDTO`. TvRequestDTO
does NOT include revokeReason (repositories.ts:257-268 — only revokedAt/revokedBy). The grant
row's revokeReason is keyed by grantId, not requestId, so it requires joining grant→request.
Since admins already see both tables on the same page and the grants section directly holds
TvGrantRow (which has revokeReason), the correct approach is to show revokeReason only in the
grant-history table — no join required. The request-queue table is fine as-is.

**Exact JSX diff for apps/web/src/app/admin/tradingview-access/page.tsx:**

In the grant-history `<thead>` block (lines 172-179), add a `<th>` after `<th>Revoked at</th>`:

```tsx
<thead>
  <tr>
    <th>TV username</th>
    <th>Granted at</th>
    <th>Expires</th>
    <th>Granted by type</th>
    <th>Revoked at</th>
    <th>Revoke reason</th>   {/* ← add this */}
  </tr>
</thead>
```

In the grant-history `<tbody>` block (lines 182-190), add a `<td>` after the revokedAt cell:

```tsx
<tbody>
  {grants.map((g) => (
    <tr key={g.id}>
      <td className="wtc-mono">{g.tvUsername}</td>
      <td className="wtc-mono">{fmtDate(g.grantedAt.getTime())}</td>
      <td className="wtc-mono">{fmtDate(g.expiresAt?.getTime() ?? null)}</td>
      <td className="wtc-mono">{g.grantedByType}</td>
      <td className="wtc-mono">{fmtDate(g.revokedAt?.getTime() ?? null)}</td>
      <td className="wtc-mono" style={{ fontSize: 11 }}>{g.revokeReason ?? '—'}</td>  {/* ← add this */}
    </tr>
  ))}
</tbody>
```

---

### D-04 — <14-day expiry banner on /app/indicators

**Design decisions:**

1. The banner sources expiresAt from `tvData.grants` (TvGrantRow, has Date expiresAt) and
   `tvData.requests` (TvRequestDTO, has expiresAt?: number epoch-ms). Both are available on the
   page already.

2. Only consider rows that are NOT yet expired or revoked. For grants: include if `revokedAt` is
   null. For requests: include if status is `'granted'` or `'expiring_soon'`.

3. Threshold: 14 * 86_400_000 ms (14 days). If the soonest non-expired expiry is within this
   window AND in the future, show the banner.

4. Copy does NOT say "your access will be revoked in 7 days" — that would conflict with the
   server-side `expiring_soon` badge. It says "your access expires soon" with the exact date and
   days remaining.

5. The banner fires even if status is `expiring_soon` (which is <= 7 days server-side) — the two
   signals are compatible: the banner activates at 14 days, the status pill changes at 7 days.

**Exact computation and JSX — insert into apps/web/src/app/(app)/app/indicators/page.tsx:**

Insert this computed block AFTER the `tvData` and `access` variables are available (after line 33,
before the `return` statement):

```tsx
  // Compute soonest upcoming expiry within 14 days for the warning banner.
  // Sources: active/expiring_soon grants (TvGrantRow.expiresAt is a Date)
  //          and active/expiring_soon request DTOs (TvRequestDTO.expiresAt is epoch-ms).
  const FOURTEEN_DAYS_MS = 14 * 86_400_000;
  const now = Date.now();

  const upcomingExpiries: number[] = [
    // From grants: non-revoked rows with an expiresAt
    ...tvData.grants
      .filter((g) => g.revokedAt == null && g.expiresAt != null)
      .map((g) => g.expiresAt!.getTime()),
    // From request DTOs: granted/expiring_soon with an expiresAt
    ...tvData.requests
      .filter((r) => (r.status === 'granted' || r.status === 'expiring_soon') && r.expiresAt != null)
      .map((r) => r.expiresAt!),
  ].filter((ms) => ms > now); // exclude already-past timestamps

  const soonestExpiry = upcomingExpiries.length > 0
    ? Math.min(...upcomingExpiries)
    : null;

  const showExpiryBanner =
    soonestExpiry !== null && soonestExpiry - now <= FOURTEEN_DAYS_MS;

  const expiryDaysLeft = soonestExpiry != null
    ? Math.ceil((soonestExpiry - now) / 86_400_000)
    : null;
```

Then add the banner JSX inside the `return (...)`, immediately AFTER the `!access.allowed`
RiskWarningBanner block (after line 64, before the TradingView profile card at line 67):

```tsx
      {showExpiryBanner && expiryDaysLeft !== null && soonestExpiry !== null && (
        <RiskWarningBanner
          severity="warning"
          title={`TradingView access expires in ${expiryDaysLeft} day${expiryDaysLeft === 1 ? '' : 's'}`}
          detail={`Your indicator access expires on ${fmtDate(soonestExpiry)}. Renew your entitlement before then to avoid interruption. If your subscription renews automatically, an admin will re-grant access after confirmation.`}
        />
      )}
```

This slots between the no-entitlement warning (which shows when access is not allowed) and the
profile card (which shows when there is an active profile). The banner is suppressed when
`access.allowed === false` because the no-entitlement banner already covers that case — but note
that `access.allowed` and having an active grant are independent: a user could have an active grant
but their entitlement is lapsing. The two banners can theoretically coexist; the copy is distinct
enough that this is acceptable.

**Note on the `now` variable:** The current indicators page does not declare `now`. The computation
above declares it. If a future refactor passes server-side `now` as a prop/arg, this should be
aligned. For a Server Component, `Date.now()` at render time is correct.

---

## Risks

- R-01: SYSTEM_ACTOR_ID as all-zeros UUID references a non-existent user row. The audit_log table
  has `actor_user_id uuid` (no FK constraint observed in schema.ts lines 212-236 — confirmed no
  `.references()`). This is safe; the value is stored but not enforced. Document the sentinel in
  RBAC_MATRIX. If the security auditor mandates a real user row for system-actor, a migration that
  inserts a system user would be needed.

- R-02: sweepTvExpiry calling atomicRevokeTv means the request row will get status='revoked'
  (not 'expired'). This is semantically accurate (revoked by expiry). The 'expired' status in the
  existing test at db-persistence.test.ts:124 (`expect(status).toBe('expired')`) will FAIL after
  this change. The test must be updated to expect 'revoked'. The expiry test also checks
  `tasksQueued` stays green (the tasks row is still inserted). Update the test expectation at line
  124 from `'expired'` to `'revoked'` and add a grant-row assertion.

- R-03: loadTvAdminData currently calls `getUserById` which resolves roles too (it joins user_roles).
  The new `listUsersWithEmailByIds` fetches ONLY the email column. If any downstream consumer of
  the admin page needs the user's roles from that map, this change is insufficient. A review of
  the admin page JSX confirms the only field used is `userEmail` — no roles are rendered from the
  request queue. Safe to proceed.

- R-04: The `inArray(s.users.id, ids)` call with a large ids array (hundreds of unique users) is
  safe for normal usage. Postgres IN() handles up to ~65,000 parameters. No issue expected in
  practice.

- R-05: The banner computation uses `tvData.grants` which contains TvGrantRow objects (raw Drizzle
  select, Date fields). The indicators page currently renders `g.grantedAt.getTime()` etc. so
  Date fields are live. The filter `g.revokedAt == null` uses loose equality intentionally to cover
  both `null` and `undefined` (though Drizzle will return `null` for nullable timestamp columns).

---

## Verification/tests

**Tests to ADD (db-persistence.test.ts or db-0003.test.ts):**

Test A (sweepTvExpiry delegation to atomicRevokeTv):
- submitTvRequest + grantTv (expiresAt in past) + atomicGrantTv (to create grant row) + sweepTvExpiry
- Assert: request status = 'revoked' (not 'expired')
- Assert: grant row revokedAt != null, revokeReason = 'expired_by_worker'
- Assert: tradingviewProfiles.currentGrantId = null (profile pointer nulled)
- Assert: tasksQueued >= 1 (tasks row still inserted)
- Assert: audit row with action='tv_access.revoke' and after.reason='expired_by_worker'

**Tests to UPDATE (db-persistence.test.ts):**

- Line 124: change `.toBe('expired')` to `.toBe('revoked')` (sweep now revokes, not marks expired).
- Add grant-row assertion in the sweep idempotency test (line 208-219) to confirm revokeReason is set.

Test B (listUsersWithEmailByIds):
- Create 3 users, call listUsersWithEmailByIds with their ids, assert Map has 3 entries with correct emails.
- Call with empty array, assert empty Map returned (no query).
- Call with one unknown UUID, assert Map has 0 entries for that id (not an error).

Test C (banner computation logic — unit test):
- Pure function extracted from the page (if refactored to a util); or Playwright smoke test verifying
  banner renders when grants[0].expiresAt is within 14 days.

---

## Next actions

1. [PG5/backend-implementer] Add `inArray` to the drizzle-orm import at repositories.ts:11.
2. [PG5/backend-implementer] Add `listUsersWithEmailByIds` function to repositories.ts after line 1381
   (exact body in D-02).
3. [PG5/backend-implementer] Export `listUsersWithEmailByIds` from the packages/db barrel (index.ts).
4. [PG5/backend-implementer] Rewrite `sweepTvExpiry` (repositories.ts:315-327) with the exact body
   from D-01. Note: the existing test at db-persistence.test.ts:124 expects status='expired' and
   MUST be updated to expect 'revoked'.
5. [PG5/frontend-implementer] Fix loadTvAdminData N+1 (queries.ts:83-89) per D-02: swap getUserById
   for listUsersWithEmailByIds + update import.
6. [PG2/frontend-implementer] Add revokeReason column to admin grant-history table per D-03 (one th
   + one td per row).
7. [PG2/frontend-implementer] Add expiry banner to /app/indicators per D-04 (computation block + JSX).
8. [PG5/backend-implementer] Update db-persistence.test.ts:124 status assertion from 'expired' to
   'revoked'; add grant-row revokeReason check in the sweep idempotency test.
9. [PG5/backend-implementer] Add new integration tests A and B above (sweep delegation + email batch).
10. [PG5/tech-lead] Decide on SYSTEM_ACTOR_ID sentinel approach (D-01 Option A vs B); document in
    RBAC_MATRIX.md.
11. [PG5/backend-implementer] Track F-06 (expiring_soon not written by worker) as a follow-up item —
    add a pre-expiry pass to sweepTvExpiry in a future sub-task.
