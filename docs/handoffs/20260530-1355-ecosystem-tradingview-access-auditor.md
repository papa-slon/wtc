## Scope

Phase 2.4 read-only audit wave — TradingView access integrity (Workstream E). This audit
covers the full data path from user submission through admin grant/revoke to scheduler sweep,
examining atomicity gaps, reason-forwarding failures, revoke-grant divergence, entitlement
re-check correctness, idempotency surface, and missing test coverage. Deliverables: (1) design
for an atomic grant repo/service, (2) atomic revoke with end-to-end reason persistence and
revokeTvGrant wiring, (3) exact repo signatures for db-architect, (4) service/action wiring
for the TV implementer, (5) test specifications for the test runner.

## Files inspected

- `packages/db/src/repositories.ts` lines 248–326 (submitTvRequest, grantTv, revokeTv, sweepTvExpiry)
- `packages/db/src/repositories.ts` lines 756–806 (upsertTradingViewProfile, createTvGrant, revokeTvGrant, listTvGrantsForUser, listAllTvGrants, getTvProfile)
- `packages/db/src/schema.ts` lines 148–169 (tradingviewAccessRequests, tradingviewAccessTasks)
- `packages/db/src/schema.ts` lines 454–492 (tradingviewAccessGrants, tradingviewProfiles)
- `apps/web/src/features/tv/queries.ts` (loadTvUserData, loadTvAdminData)
- `apps/web/src/features/tv/actions.ts` (enhancedGrantAction, enhancedRevokeAction)
- `apps/web/src/app/(app)/app/indicators/page.tsx` (submitTvAction, IndicatorsPage)
- `apps/web/src/app/admin/tradingview-access/page.tsx` (AdminTvPage)
- `docs/CONTRACTS/tradingview-access.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/handoffs/20260530-1145-ecosystem-tradingview-access-implementer.md`
- `tests/integration/db-persistence.test.ts` (TV section, lines 116–219)
- `tests/integration/db-0002.test.ts` (TV section, lines 144–169)

## Files changed

None — read-only audit

## Findings

### Finding 1 — HIGH: grant is non-atomic across two repo calls (orphaned request state on failure)

**Evidence:** `apps/web/src/features/tv/actions.ts:99–113`

```ts
// Step 1: update request status
await grantTv(db, requestId, actor.id, now, durationMs);

// Step 2: insert grant row + upsert profile pointer
// If this fails the request status is already 'granted' — documented as a tracked enhancement
await createTvGrant(db, { requestId, ... });
```

`grantTv` commits its own transaction (repositories.ts:299–304). `createTvGrant` runs in a
separate transaction (repositories.ts:778–787). If `createTvGrant` throws (network blip,
constraint violation, etc.) the request row is left in status `granted` with no corresponding
`tradingview_access_grants` row and no updated `tradingview_profiles.currentGrantId`. The admin
queue shows the request as granted but `listAllTvGrants` returns nothing; any future revoke via
`enhancedRevokeAction` calls `revokeTv` which updates the request row to `revoked` but cannot
call `revokeTvGrant` because there is no grant row. The access-log diverges permanently.

**Recommendation:** Replace the two sequential calls with a single `grantTvAtomic` repo that
executes all four writes — request status update, grant row insert, profile pointer upsert, and
audit row — inside one `db.transaction`. See Exact Signatures section below.

**Target Workstream:** E

---

### Finding 2 — HIGH: revoke reason is validated then discarded (audit and grant row receive null)

**Evidence:** `apps/web/src/features/tv/actions.ts:128–148`

```ts
const { requestId, reason: _reason } = parsed.data;   // line 137
// ...
await revokeTv(db, requestId, actor.id, Date.now());   // line 142 — reason NOT forwarded
void _reason; // satisfies the validated schema; threaded into audit when revokeTv supports it
```

`revokeTv` at `repositories.ts:307–312` writes a fixed audit payload `{ status: 'revoked' }`
with no reason field. The validated reason (3–200 chars, Zod-enforced, admin-entered) is
silently discarded. The audit log and any future review of revoke actions has no admin rationale.
Similarly, `revokeTvGrant` (repositories.ts:790) accepts `reason?: string` and correctly
forwards it to the grant row's `revokeReason` column and the audit payload, but
`enhancedRevokeAction` never calls `revokeTvGrant` at all (see Finding 3).

**Recommendation:** Add `reason?: string` to `revokeTv`. Thread the action's validated reason
into the `revokeTv` call and also into the `revokeTvGrant` call. See Exact Signatures.

**Target Workstream:** E

---

### Finding 3 — HIGH: enhancedRevokeAction does not call revokeTvGrant — grant row and profile pointer left stale

**Evidence:** `apps/web/src/features/tv/actions.ts:123–148`

`enhancedRevokeAction` calls only `revokeTv(db, requestId, actor.id, Date.now())`. It does not
look up the active grant by `requestId`, so `revokeTvGrant` is never called. Consequences:

1. `tradingview_access_grants.revokedAt` stays NULL — the grant appears active in `listAllTvGrants`.
2. `tradingview_access_grants.revokeReason` stays NULL.
3. `tradingview_profiles.currentGrantId` stays set to the now-revoked grant — the user profile
   still shows an "Active grant" indicator in `/app/indicators` (line 80, `profile.currentGrantId`
   truthy check).
4. `tv_access.revoke` audit action is written at the request level (targetType:
   `tradingview_access_request`) but no `tv_access.revoke` audit at the grant level is ever
   emitted for admin-initiated revokes through the UI.

The only existing code path that correctly revokes a grant (calling `revokeTvGrant`) is the
PGlite test at `db-0002.test.ts:154`, called directly. No service or action calls it in production.

**Recommendation:** In `enhancedRevokeAction`, after loading the request, look up the active
grant via `listTvGrantsForUser` (filter `revokedAt IS NULL` and `requestId` match), then call
`revokeTvGrant`. Ideally move both into one atomic repo call. See Exact Signatures.

**Target Workstream:** E

---

### Finding 4 — HIGH: grantTv does not guard current request state at the DB level — state guard is application-only

**Evidence:** `packages/db/src/repositories.ts:299–304`

```ts
export async function grantTv(db, requestId, adminId, now, durationMs): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'granted', grantedAt: ..., grantedBy: ..., expiresAt: ... })
      .where(eq(s.tradingviewAccessRequests.id, requestId));   // no status filter
    // ...
  });
}
```

The UPDATE has no `WHERE status IN ('pending','expiring_soon')` predicate. The application-level
state guard in `enhancedGrantAction` (lines 89–97) checks state via `listTvByUser` then calls
`grantTv`, but these are two separate round-trips with no lock. A concurrent second grant action
for the same requestId can bypass the application guard: both see `pending`, both call `grantTv`,
the second silently overwrites `granted_at`, `granted_by`, and `expires_at` on an already-granted
request and inserts a second `tradingview_access_grants` row (since `createTvGrant` has no
ON CONFLICT guard on `requestId`).

Also, `revokeTv` (repositories.ts:307) has no state guard either — it will mark `expired` or
`pending` rows as `revoked` without the admin seeing an error.

**Recommendation:** In the atomic repo, add a `WHERE status IN ('pending','expiring_soon')` filter
on the grant UPDATE and a `RETURNING id` check — if zero rows updated, throw `INVALID_STATE`.
Similarly for revoke: filter `WHERE status IN ('granted','expiring_soon')`. This makes the guard
DB-level and race-safe. See Exact Signatures.

**Target Workstream:** E

---

### Finding 5 — HIGH: sweepTvExpiry writes no audit row and is not atomic per-row

**Evidence:** `packages/db/src/repositories.ts:314–326`

```ts
export async function sweepTvExpiry(db, now = Date.now()): Promise<{ expired: number; tasksQueued: number }> {
  const due = await db.select()...;    // SELECT outside a transaction
  for (const r of due) {
    await db.update(...).set({ status: 'expired' })...;   // separate statement, no txn
    await db.insert(s.tradingviewAccessTasks)...;          // separate statement, no txn
    tasksQueued += 1;
  }
  return { expired: due.length, tasksQueued };
}
```

Three problems: (a) no `audit_logs` row is written for scheduler-driven `granted → expired`
transitions — these are unaudited state changes; (b) the status update and task insert are not
atomic per row — a crash between them leaves a status=`expired` row with no task; (c) the initial
SELECT is outside a transaction so concurrent sweep runs (or a grant that completes after the
SELECT) can double-process the same row (the second sweep would find status already `expired`
and skip, but between the SELECT and the UPDATE another grant could re-grant the request,
which then gets wrongly expired).

**Recommendation:** Per-row: wrap the status update + task insert + audit row in a single
`db.transaction`. In the UPDATE, add `WHERE status = 'granted'` and `RETURNING` — if 0 rows
affected (concurrent modification), skip the task insert. Write an `audit_logs` row with
`action: 'tradingview.expire'`, `actorRole: 'system'`, `actorUserId: null`.

**Target Workstream:** E

---

### Finding 6 — MEDIUM: entitlement re-check at grant uses listTvByUser (N+1 loop) for state guard

**Evidence:** `apps/web/src/features/tv/actions.ts:89–97`

```ts
const requestRows = await listTvByUser(db, targetUserId);    // fetches ALL user requests
const req = requestRows.map(rowToTvDto).find((r) => r.id === requestId);
```

The state guard loads all TV requests for the user and filters in JS to find the target request.
For a user with many historical requests this is wasteful and slightly racy (another request could
be inserted between the listTvByUser call and the grantTv call). The correct pattern for a state
guard is a single `SELECT ... WHERE id = $requestId AND status IN ('pending','expiring_soon')`
inside the same transaction as the UPDATE, so no TOCTOU is possible.

**Recommendation:** In the atomic `grantTvAtomic` repo, perform a `SELECT ... FOR UPDATE` on the
specific request row inside the transaction before the UPDATE, then check its status. The
application-level `listTvByUser` check in the action can be kept as an early-return UX guard
but the authoritative check must be inside the transaction.

**Target Workstream:** E

---

### Finding 7 — MEDIUM: no duplicate-request guard on submitTvRequest — each call inserts a new row

**Evidence:** `packages/db/src/repositories.ts:285–292`

```ts
export async function submitTvRequest(db, userId, username, now): Promise<TvRequest> {
  return db.transaction(async (tx) => {
    const [r] = await tx.insert(s.tradingviewAccessRequests)
      .values({ userId, tradingViewUsername: username, status: 'pending', requestedAt: ... })
      .returning();
    // no ON CONFLICT, no prior pending check
```

A user can submit multiple requests (or the same form twice quickly) and accumulate many
`pending` rows. The admin queue grows unbounded. `tradingview_access_requests` has no unique
index on `(userId, status='pending')`. The contract doc acknowledges this as TARGET idempotent
upsert but it is not implemented.

**Recommendation:** In `submitTvRequest`, within the transaction, SELECT the most recent
`pending` request for this user. If one exists and the username matches, return the existing row
(idempotent). If one exists with a different username, UPDATE the username in-place and return.
If none exists, INSERT. This eliminates the duplicate-row accumulation. The `tradingview_profiles`
upsert (also missing — see Finding 8) should happen in the same transaction.

**Target Workstream:** E

---

### Finding 8 — MEDIUM: submitTvRequest does not upsert tradingview_profiles

**Evidence:** `packages/db/src/repositories.ts:285–292` (submitTvRequest body); `apps/web/src/app/(app)/app/indicators/page.tsx:18–24` (submitTvAction body)

`upsertTradingViewProfile` exists (repositories.ts:760) and is tested. Neither `submitTvRequest`
nor `submitTvAction` calls it. As a result, a user who only submits a request and is then granted
by the admin will have a `tradingview_profiles` row (created by `createTvGrant`'s UPSERT on
line 781) but the profile was never populated from the user's own submission. If a user's
request is denied/revoked before `createTvGrant` runs, they have no profile row at all.

**Recommendation:** Inside `submitTvRequest`'s transaction, add:
```ts
await tx.insert(s.tradingviewProfiles)
  .values({ userId, tvUsername: username })
  .onConflictDoUpdate({ target: s.tradingviewProfiles.userId, set: { tvUsername: username, updatedAt: new Date(now) } });
```
This consolidates profile upsert at submission time and ensures the user's declared username is
always reflected in their profile regardless of grant outcome.

**Target Workstream:** E

---

### Finding 9 — MEDIUM: loadTvAdminData has an N+1 query on getUserById per request row

**Evidence:** `apps/web/src/features/tv/queries.ts:83–88`

```ts
const rows: TvAdminRow[] = await Promise.all(
  requestRows.map(async (r) => {
    const dto = rowToTvDto(r);
    const userRow = await getUserById(db, r.userId);    // one DB round-trip per row
    return { ...dto, userEmail: userRow?.email ?? r.userId };
  }),
);
```

`getUserById` is called once per request row. For a queue of 100 requests this is 100 sequential
DB calls (Promise.all runs them concurrently but each is still a network round-trip). The existing
contract doc at line 240 acknowledges this as an MVP N+1. For a production-ready queue this
must be replaced with a JOIN or a single `SELECT users.email FROM users WHERE id = ANY($ids)`.

**Recommendation:** Add `listUsersWithEmailByIds(db: Db, ids: string[]): Promise<Map<string, string>>`
to repositories.ts (single `SELECT id, email FROM users WHERE id = ANY($1)` query), then use
the Map in `loadTvAdminData` to resolve emails without per-row round-trips.

**Target Workstream:** E

---

### Finding 10 — MEDIUM: revokeTvGrant does not guard current grant state before stamping revokedAt

**Evidence:** `packages/db/src/repositories.ts:790–798`

```ts
export async function revokeTvGrant(db, grantId, adminId, reason?, now): Promise<void> {
  await db.transaction(async (tx) => {
    const [grant] = await tx.select()...where(eq(id, grantId)).limit(1);
    if (!grant) return;   // silent no-op on not-found
    await tx.update(s.tradingviewAccessGrants)
      .set({ revokedAt: ..., revokedBy: ..., revokeReason: ... })
      .where(eq(id, grantId));   // no WHERE revokedAt IS NULL
```

The UPDATE has no `WHERE revokedAt IS NULL` predicate. A double-revoke will silently overwrite
the original `revokedAt` timestamp and `revokeReason` with the second call's values, making the
audit trail misleading. A `grant not found` result (line 793 `return`) also emits no error to the
caller — a caller that passes a wrong `grantId` gets a silent success.

**Recommendation:** Add `WHERE revokedAt IS NULL` to the UPDATE. Use `RETURNING id` — if 0 rows
updated and the grant exists, throw `ALREADY_REVOKED`. If the SELECT returns no row, throw
`GRANT_NOT_FOUND` rather than silently returning.

**Target Workstream:** E

---

### Finding 11 — LOW: tradingviewAccessGrants has no unique index on requestId — double-grant inserts duplicate rows

**Evidence:** `packages/db/src/schema.ts:457–477` (tradingviewAccessGrants table definition)

The `tradingview_access_grants` table has indexes on `userId` and `expiresAt` but no unique
constraint on `requestId`. If `createTvGrant` is called twice for the same requestId (e.g., due
to the non-atomic two-step gap, a retry, or a race), two grant rows are inserted. The profile
pointer (`currentGrantId`) will be set to the latest one but the first orphaned grant row remains
with no `revokedAt`, so `listAllTvGrants({ activeOnly: true })` returns two active rows for the
same user/request.

**Recommendation:** Add `uniqueIndex('tvag_request_id_idx').on(t.requestId)` to
`tradingviewAccessGrants` in schema.ts. This prevents duplicate grant rows at the DB level. The
atomic `grantTvAtomic` repo must use `onConflictDoUpdate` or expect a 23505 as a duplicate-grant
signal.

**Target Workstream:** E (schema change requires migration 0003)

---

### Finding 12 — LOW: sweepTvExpiry task insert produces duplicate task rows on double-run before expiry check

**Evidence:** `packages/db/src/repositories.ts:320–323`

```ts
await db.insert(s.tradingviewAccessTasks)
  .values({ requestId: r.id, kind: 'revoke', done: false });
```

The `tradingview_access_tasks` table has no unique constraint on `(requestId, kind)`. If the
sweep runs twice before the first task is consumed (and `done` stays false), two revoke tasks are
inserted. The existing test at `db-persistence.test.ts:208–219` tests idempotency of the second
sweep call (which finds 0 expired rows) but does not test a crash-and-restart scenario where the
status update succeeds but the task insert is retried.

**Recommendation:** Add `onConflictDoNothing()` on a unique index `(requestId, kind)` for the
task insert, or use an `ON CONFLICT (request_id, kind) DO UPDATE SET done = false` to reset done
state on re-queue.

**Target Workstream:** E (requires migration 0003)

---

### Finding 13 — LOW: admin page shows grantedBy UUID, not email — not human-readable

**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx:81,84`

```tsx
<td className="wtc-mono" style={{ fontSize: 11 }}>{r.grantedBy ?? '—'}</td>
// ...
<td className="wtc-mono" style={{ fontSize: 11 }}>{r.revokedBy ?? '—'}</td>
```

`grantedBy` and `revokedBy` in `TvRequestDTO` are UUIDs (admin user IDs). The admin looking at
the queue sees opaque UUIDs rather than the admin's email. `loadTvAdminData` already calls
`getUserById` for the request owner — the same pattern could resolve admin UUIDs.

**Recommendation:** Enrich `TvAdminRow` with `grantedByEmail` and `revokedByEmail` fields
resolved in `loadTvAdminData`. This is a UX issue not a correctness issue; defer until the N+1
query is addressed with a batch lookup.

**Target Workstream:** E

---

## Decisions

1. **Atomic grant repo** replaces the two-call `grantTv + createTvGrant` pattern. The new repo
   is named `grantTvAtomic` and is the authoritative grant path. The old `grantTv` can be
   retained for internal scheduler use (expiry re-grant) but should be deprecated for admin calls.

2. **Atomic revoke repo** replaces the two-call `revokeTv + revokeTvGrant` pattern. A new
   `revokeTvAtomic(db, requestId, adminId, reason, now)` resolves the active grantId from the
   request row, then executes all writes (request status, grant stamp, profile pointer null,
   audit) in one transaction.

3. **Reason parameter** is added to both `revokeTv` and `revokeTvAtomic` as `reason: string`
   (not optional on admin-initiated revoke; optional for scheduler-initiated revoke).

4. **Entitlement re-check at grant** is confirmed correct in `enhancedGrantAction` (lines 79–84)
   — it calls `accessFor(targetUserId, 'tradingview_indicators')` which uses `@wtc/entitlements`
   `hasAccess` and fails closed. This check must be preserved in the refactored action.

5. **Manual-first default** is preserved. No automation adapter is wired. Feature flag
   `FEATURE_TV_AUTOMATION_ADAPTER` stays false. All grant/revoke goes through admin queue.

6. **Migration 0003** must add: `uniqueIndex on tradingview_access_grants(requestId)` and
   `uniqueIndex on tradingview_access_tasks(requestId, kind)`. These are additive-only changes.

---

## Exact Repo Signatures (for db-architect)

### `grantTvAtomic` — single-transaction grant

```ts
/**
 * Atomic TV access grant: request status update + grant row insert + profile pointer upsert
 * + audit row — all in ONE db.transaction. Replaces the sequential grantTv + createTvGrant calls.
 *
 * State guard: the UPDATE has WHERE status IN ('pending','expiring_soon'); if 0 rows updated
 * the request does not exist or is in a non-grantable state — throws TvInvalidStateError.
 *
 * Entitlement re-check MUST be performed by the caller (action) before calling this repo.
 * The repo itself does NOT call @wtc/entitlements (no circular dependency).
 */
export async function grantTvAtomic(
  db: Db,
  input: {
    requestId: string;
    adminId: string;
    tvUsername: string;         // from the request row; passed explicitly to avoid a SELECT
    targetUserId: string;       // from the request row; passed explicitly
    durationMs: number;
    reason: string;
    grantedByType: 'admin';     // always 'admin' for manual grants
  },
  now = Date.now(),
): Promise<{ grantId: string }> {
  return db.transaction(async (tx) => {
    // 1. Update request status — state-guarded at the DB level
    const updated = await tx
      .update(s.tradingviewAccessRequests)
      .set({
        status: 'granted',
        grantedAt: new Date(now),
        grantedBy: input.adminId,
        expiresAt: new Date(now + input.durationMs),
      })
      .where(
        and(
          eq(s.tradingviewAccessRequests.id, input.requestId),
          inArray(s.tradingviewAccessRequests.status, ['pending', 'expiring_soon']),
        ),
      )
      .returning({ id: s.tradingviewAccessRequests.id });

    if (!updated.length) {
      throw Object.assign(
        new Error(`Cannot grant request ${input.requestId}: not in a grantable state`),
        { code: 'INVALID_STATE' },
      );
    }

    // 2. Insert grant row
    const [grant] = await tx
      .insert(s.tradingviewAccessGrants)
      .values({
        requestId: input.requestId,
        userId: input.targetUserId,
        tvUsername: input.tvUsername,
        grantedAt: new Date(now),
        expiresAt: new Date(now + input.durationMs),
        grantedBy: input.adminId,
        grantedByType: input.grantedByType,
      })
      .returning({ id: s.tradingviewAccessGrants.id });

    if (!grant) throw new Error('failed to insert tv grant');

    // 3. Upsert profile pointer
    await tx
      .insert(s.tradingviewProfiles)
      .values({ userId: input.targetUserId, tvUsername: input.tvUsername, currentGrantId: grant.id })
      .onConflictDoUpdate({
        target: s.tradingviewProfiles.userId,
        set: { tvUsername: input.tvUsername, currentGrantId: grant.id, updatedAt: new Date(now) },
      });

    // 4. Audit row (single row covering the full grant action)
    await tx.insert(s.auditLogs).values(
      auditRowValues({
        actorUserId: input.adminId,
        actorRole: 'admin',
        action: 'tradingview.grant',
        targetType: 'tradingview_access_request',
        targetId: input.requestId,
        after: {
          status: 'granted',
          grantId: grant.id,
          tvUsername: input.tvUsername,
          reason: input.reason,
          durationMs: input.durationMs,
        },
      }, now),
    );

    return { grantId: grant.id };
  });
}
```

### `revokeTvAtomic` — single-transaction revoke with reason and grant resolution

```ts
/**
 * Atomic TV access revoke: resolve active grantId from requestId, stamp grant row,
 * update request status, null profile pointer, write audit — all in ONE db.transaction.
 * Replaces the sequential revokeTv + revokeTvGrant pattern.
 *
 * State guard: WHERE status IN ('granted','expiring_soon') on the request UPDATE.
 * Grant resolution: SELECT active grant (revokedAt IS NULL, requestId match) inside txn.
 * If no active grant exists (request was granted without a grant row due to prior atomicity gap),
 * the request status is still updated and audited — the grant step is skipped with a warning.
 *
 * reason is REQUIRED for admin-initiated revokes (Zod-enforced at the action level).
 * Pass reason = 'scheduler:expiry' for scheduler-driven revokes.
 */
export async function revokeTvAtomic(
  db: Db,
  input: {
    requestId: string;
    adminId: string | null;       // null for scheduler-initiated revokes
    actorRole: 'admin' | 'system';
    reason: string;
  },
  now = Date.now(),
): Promise<{ revokedGrantId: string | null }> {
  return db.transaction(async (tx) => {
    // 1. Resolve and lock the request row
    const [req] = await tx
      .select({
        id: s.tradingviewAccessRequests.id,
        status: s.tradingviewAccessRequests.status,
        userId: s.tradingviewAccessRequests.userId,
      })
      .from(s.tradingviewAccessRequests)
      .where(eq(s.tradingviewAccessRequests.id, input.requestId))
      .limit(1);

    if (!req) {
      throw Object.assign(new Error(`Request ${input.requestId} not found`), { code: 'REQUEST_NOT_FOUND' });
    }
    if (!['granted', 'expiring_soon'].includes(req.status)) {
      throw Object.assign(
        new Error(`Cannot revoke request in state '${req.status}'`),
        { code: 'INVALID_STATE' },
      );
    }

    // 2. Update request status
    await tx
      .update(s.tradingviewAccessRequests)
      .set({ status: 'revoked', revokedAt: new Date(now), revokedBy: input.adminId })
      .where(eq(s.tradingviewAccessRequests.id, input.requestId));

    // 3. Resolve active grant (revokedAt IS NULL, requestId match)
    const [activeGrant] = await tx
      .select({ id: s.tradingviewAccessGrants.id })
      .from(s.tradingviewAccessGrants)
      .where(
        and(
          eq(s.tradingviewAccessGrants.requestId, input.requestId),
          isNull(s.tradingviewAccessGrants.revokedAt),
        ),
      )
      .limit(1);

    let revokedGrantId: string | null = null;
    if (activeGrant) {
      // 4a. Stamp grant row
      await tx
        .update(s.tradingviewAccessGrants)
        .set({ revokedAt: new Date(now), revokedBy: input.adminId, revokeReason: input.reason })
        .where(
          and(
            eq(s.tradingviewAccessGrants.id, activeGrant.id),
            isNull(s.tradingviewAccessGrants.revokedAt), // double-revoke guard
          ),
        );

      // 4b. Null profile pointer
      await tx
        .update(s.tradingviewProfiles)
        .set({ currentGrantId: null, updatedAt: new Date(now) })
        .where(
          and(
            eq(s.tradingviewProfiles.userId, req.userId),
            eq(s.tradingviewProfiles.currentGrantId, activeGrant.id),
          ),
        );

      revokedGrantId = activeGrant.id;
    }

    // 5. Audit row
    await tx.insert(s.auditLogs).values(
      auditRowValues({
        actorUserId: input.adminId,
        actorRole: input.actorRole,
        action: 'tradingview.revoke',
        targetType: 'tradingview_access_request',
        targetId: input.requestId,
        after: {
          status: 'revoked',
          reason: input.reason,
          revokedGrantId,
        },
      }, now),
    );

    return { revokedGrantId };
  });
}
```

### `revokeTv` — add reason param (retain for backward compat; mark deprecated)

```ts
/** @deprecated Use revokeTvAtomic for all new call sites. This variant kept for worker sweep
 *  compatibility until sweepTvExpiry is refactored to use revokeTvAtomic. */
export async function revokeTv(
  db: Db,
  requestId: string,
  adminId: string,
  now = Date.now(),
  reason?: string,   // NEW optional param — thread into audit after payload
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'revoked', revokedAt: new Date(now), revokedBy: adminId })
      .where(eq(s.tradingviewAccessRequests.id, requestId));
    await tx.insert(s.auditLogs).values(
      auditRowValues({
        actorUserId: adminId,
        actorRole: 'admin',
        action: 'tradingview.revoke',
        targetType: 'tradingview_access_request',
        targetId: requestId,
        after: { status: 'revoked', reason: reason ?? null },
      }, now),
    );
  });
}
```

### `listUsersWithEmailByIds` — batch user lookup (eliminates N+1)

```ts
export async function listUsersWithEmailByIds(
  db: Db,
  ids: string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .where(inArray(s.users.id, ids));
  return new Map(rows.map((r) => [r.id, r.email]));
}
```

---

## Service/Action Wiring (for TV implementer)

### enhancedGrantAction — wire to grantTvAtomic

```ts
export async function enhancedGrantAction(formData: FormData): Promise<void> {
  'use server';
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = grantSchema.safeParse({ /* unchanged */ });
  if (!parsed.success) throw new Error(...);

  const { requestId, targetUserId, tvUsername, reason, durationDays } = parsed.data;
  const durationMs = DURATION_OPTIONS[durationDays]!;
  const now = Date.now();

  // Fail-closed entitlement re-check (unchanged — MUST remain)
  const access = await accessFor(targetUserId, 'tradingview_indicators');
  if (!access.allowed) throw new Error(`Cannot grant: user lacks active entitlement (${access.reason})`);

  const db = getServerDb();
  if (!db) throw new Error('[tv/actions] DATABASE_URL required');

  // Single atomic call — no more two-step sequential calls
  await grantTvAtomic(db, {
    requestId,
    adminId: actor.id,
    tvUsername,
    targetUserId,
    durationMs,
    reason,       // now forwarded — was discarded before
    grantedByType: 'admin',
  }, now);

  revalidatePath('/admin/tradingview-access');
}
```

### enhancedRevokeAction — wire to revokeTvAtomic

```ts
export async function enhancedRevokeAction(formData: FormData): Promise<void> {
  'use server';
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const parsed = revokeSchema.safeParse({
    requestId: formData.get('requestId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) throw new Error(...);

  const { requestId, reason } = parsed.data;
  const db = getServerDb();
  if (!db) throw new Error('[tv/actions] DATABASE_URL required');

  // Single atomic call — resolves grant internally, forwards reason
  await revokeTvAtomic(db, {
    requestId,
    adminId: actor.id,
    actorRole: 'admin',
    reason,    // now forwarded — was discarded before
  }, Date.now());

  revalidatePath('/admin/tradingview-access');
}
```

### loadTvAdminData — eliminate N+1

```ts
export async function loadTvAdminData(): Promise<TvAdminData> {
  const db = getServerDb();
  if (!db) return { mode: 'demo', rows: [], counts: { pending: 0, active: 0, revoked: 0, expired: 0 }, grants: [] };

  const [requestRows, grants] = await Promise.all([listAllTv(db), listAllTvGrants(db)]);

  // Single batch user lookup (replaces per-row getUserById)
  const uniqueUserIds = [...new Set(requestRows.map((r) => r.userId))];
  const emailMap = await listUsersWithEmailByIds(db, uniqueUserIds);

  const rows: TvAdminRow[] = requestRows.map((r) => ({
    ...rowToTvDto(r),
    userEmail: emailMap.get(r.userId) ?? r.userId,
  }));

  // counts unchanged
  return { mode: 'postgres', rows, counts: { ... }, grants };
}
```

---

## Risks

1. **Migration 0003 dependency:** The `uniqueIndex on tradingview_access_grants(requestId)` and
   `uniqueIndex on tradingview_access_tasks(requestId, kind)` changes require a migration. Until
   0003 lands, `grantTvAtomic` should use `onConflictDoUpdate` on the grant insert rather than
   relying on the unique constraint.

2. **Back-fill gap:** Existing `tradingview_access_grants` rows written by the old two-step
   process (or by direct `createTvGrant` calls in tests) may have duplicate `requestId` values.
   Migration 0003 must delete duplicates (keep the most recent by `grantedAt`) before adding the
   unique index.

3. **sweepTvExpiry refactor scope:** The sweep currently calls `revokeTv` (not `revokeTvAtomic`)
   implicitly through status-only updates. Refactoring sweep to call `revokeTvAtomic` (with
   `actorRole: 'system'`, `adminId: null`, `reason: 'scheduler:expiry'`) is a separate task;
   the deprecated `revokeTv` must remain until sweep is migrated.

4. **In-memory dev adapter drift:** `packages/tradingview-access/src/index.ts` is the in-memory
   `TvAccessService` used by the demo adapter. The `grant` and `revoke` methods on this service
   do not call the DB repos — they operate on an in-memory store. After the atomic repo refactor,
   the in-memory service's internal logic also needs alignment (state guard, reason forwarding)
   to avoid tests passing in demo mode that fail in production.

5. **Entitlement check timing:** `enhancedGrantAction` checks entitlement before the DB
   transaction. An entitlement could lapse in the milliseconds between check and commit. This is
   acceptable for a manual admin workflow (the admin verified entitlement moments before) but
   should be documented. A scheduler job that reconciles grants vs entitlements (sweepTvExpiry
   already does partial coverage) is the correct compensating control.

---

## Verification/tests

### Test 1 — Rollback on forced mid-transaction failure (no orphaned request state)

```ts
// tests/integration/tv-atomic-grant.test.ts
it('grantTvAtomic rolls back entirely if grant insert fails — no orphaned request', async () => {
  const req = await submitTvRequest(db, userId, 'tv_atomic_test');
  // Simulate: force a constraint error on the grant insert by providing an invalid FK
  await expect(
    grantTvAtomic(db, {
      requestId: req.id,
      adminId: adminId,
      tvUsername: 'tv_atomic_test',
      targetUserId: 'nonexistent-uuid-1111-2222-3333-444444444444', // FK violation on grants.userId
      durationMs: 90 * 86_400_000,
      reason: 'test grant',
      grantedByType: 'admin',
    }),
  ).rejects.toThrow();

  // Request status must still be 'pending' — rollback succeeded
  const row = (await listTvByUser(db, userId)).find((r) => r.id === req.id);
  expect(row!.status).toBe('pending');
  // No orphaned grant row
  expect((await listTvGrantsForUser(db, userId)).filter((g) => g.requestId === req.id)).toHaveLength(0);
  // No audit row for a failed grant
  const events = await recentAuditEvents(db, 1000);
  expect(events.filter((e) => e.action === 'tradingview.grant' && e.targetId === req.id)).toHaveLength(0);
});
```

### Test 2 — Revoke reason persists end-to-end (request row, grant row, audit row)

```ts
it('revokeTvAtomic persists reason on request, grant, and audit rows', async () => {
  const req = await submitTvRequest(db, userId, 'tv_reason_test');
  await grantTvAtomic(db, { requestId: req.id, adminId, tvUsername: 'tv_reason_test', targetUserId: userId, durationMs: 90 * DAY, reason: 'active subscriber', grantedByType: 'admin' });

  await revokeTvAtomic(db, { requestId: req.id, adminId, actorRole: 'admin', reason: 'plan cancelled by admin' });

  // Grant row has reason
  const grants = await listTvGrantsForUser(db, userId);
  const g = grants.find((x) => x.requestId === req.id)!;
  expect(g.revokeReason).toBe('plan cancelled by admin');
  expect(g.revokedBy).toBe(adminId);

  // Request row has revokedAt/revokedBy
  const reqRow = (await listAllTv(db)).find((r) => r.id === req.id)!;
  expect(reqRow.revokedAt).not.toBeNull();
  expect(reqRow.revokedBy).toBe(adminId);

  // Audit row has reason
  const events = await recentAuditEvents(db, 1000);
  const audit = events.find((e) => e.action === 'tradingview.revoke' && e.targetId === req.id);
  expect(audit).toBeTruthy();
  expect((audit!.after as Record<string, unknown>)['reason']).toBe('plan cancelled by admin');
});
```

### Test 3 — Duplicate grant (state guard) — second grant throws INVALID_STATE

```ts
it('grantTvAtomic throws INVALID_STATE if request is already granted', async () => {
  const req = await submitTvRequest(db, userId, 'tv_dupe_grant');
  await grantTvAtomic(db, { requestId: req.id, adminId, tvUsername: 'tv_dupe_grant', targetUserId: userId, durationMs: 90 * DAY, reason: 'first grant', grantedByType: 'admin' });

  await expect(
    grantTvAtomic(db, { requestId: req.id, adminId, tvUsername: 'tv_dupe_grant', targetUserId: userId, durationMs: 90 * DAY, reason: 'second grant', grantedByType: 'admin' }),
  ).rejects.toMatchObject({ code: 'INVALID_STATE' });

  // Only one grant row exists
  expect((await listTvGrantsForUser(db, userId)).filter((g) => g.requestId === req.id)).toHaveLength(1);
});
```

### Test 4 — Expired grant (sweepTvExpiry) writes audit row and is atomic

```ts
it('sweepTvExpiry writes an audit row for each expiry and skips already-expired rows', async () => {
  const req = await submitTvRequest(db, userId, 'tv_sweep_audit');
  await grantTvAtomic(db, { requestId: req.id, adminId, tvUsername: 'tv_sweep_audit', targetUserId: userId, durationMs: -1000, reason: 'test', grantedByType: 'admin' });

  const auditBefore = (await recentAuditEvents(db, 1000)).length;
  const result = await sweepTvExpiry(db, Date.now());
  expect(result.expired).toBeGreaterThanOrEqual(1);

  const events = await recentAuditEvents(db, 1000);
  expect(events.length).toBeGreaterThan(auditBefore);
  expect(events.some((e) => e.action === 'tradingview.expire' && e.targetId === req.id)).toBe(true);

  // Second sweep is a no-op (idempotent)
  const second = await sweepTvExpiry(db, Date.now());
  expect(second.expired).toBe(0);
});
```

### Test 5 — Admin-visible history in admin queue

```ts
it('loadTvAdminData returns grant history and resolves user emails without N+1', async () => {
  // Covered by the batch-lookup refactor; verify the grants array contains the grant row
  const data = await loadTvAdminData();
  expect(data.grants.length).toBeGreaterThanOrEqual(1);
  expect(data.rows.every((r) => typeof r.userEmail === 'string' && r.userEmail.includes('@'))).toBe(true);
});
```

### Test 6 — Entitlement re-check fail-closed at grant time

```ts
it('enhancedGrantAction throws if user entitlement is not active at grant time', async () => {
  // Use a user with no tradingview_indicators entitlement
  const req = await submitTvRequest(db, noEntitlementUserId, 'tv_noent');
  const formData = mockFormData({ requestId: req.id, targetUserId: noEntitlementUserId, tvUsername: 'tv_noent', reason: 'test', durationDays: '90' });
  await expect(enhancedGrantAction(formData)).rejects.toThrow(/lacks.*entitlement/);
  // Request remains pending
  expect((await listAllTv(db)).find((r) => r.id === req.id)!.status).toBe('pending');
});
```

---

## Next actions

1. **db-architect (Phase 2.4):** Implement `grantTvAtomic` and `revokeTvAtomic` in
   `packages/db/src/repositories.ts` using exact signatures above. Add `reason?: string` to
   `revokeTv` (deprecated path). Add `listUsersWithEmailByIds`. Export all from
   `packages/db/src/index.ts`.

2. **db-architect (Phase 2.4):** Draft migration 0003 with:
   - `CREATE UNIQUE INDEX tvag_request_id_idx ON tradingview_access_grants(request_id)` (with
     dedup script: delete older duplicate rows before adding the constraint).
   - `CREATE UNIQUE INDEX tvat_request_kind_idx ON tradingview_access_tasks(request_id, kind)`.

3. **TV implementer (Phase 2.4):** Replace `enhancedGrantAction` two-step with `grantTvAtomic`
   call. Replace `enhancedRevokeAction` with `revokeTvAtomic` call. Remove the `void _reason`
   suppression. Wire `listUsersWithEmailByIds` in `loadTvAdminData`.

4. **TV implementer (Phase 2.4):** Add idempotent pending-request check to `submitTvRequest`
   (inside the transaction, SELECT existing pending row; if found and username matches, return
   existing; if username differs, UPDATE in place). Add profile upsert in the same transaction.

5. **tests-runner (Phase 2.4):** Add integration tests for `grantTvAtomic` rollback,
   revoke-reason persistence, duplicate grant state guard, expired grant audit, and entitlement
   re-check fail-closed (six tests specified above). Target file:
   `tests/integration/tv-atomic-grant.test.ts`.

6. **sweepTvExpiry refactor (Phase 2.4 or 2.5):** Wrap per-row processing in a transaction, add
   audit row for each `granted → expired` transition, add `WHERE status = 'granted'` to the
   UPDATE with RETURNING to detect concurrent modification. Use `onConflictDoNothing` on the
   task insert with the new unique index.

7. **Contract doc update (Phase 2.4):** After implementation, update
   `docs/CONTRACTS/tradingview-access.md` Grant and Revoke sections to reflect the new atomic
   repo signatures and remove the "Missing (TARGET)" bullets that will have been resolved.
