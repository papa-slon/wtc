# ecosystem-tradingview-access-implementer handoff

Epoch: 20260530-0925. Read-only audit of Phase 2.1 scope.

---

## Scope

Phase 2.1 — TradingView access: profiles + grants + revoke metadata. Read-only reconciliation wave.
Covers: current-vs-TARGET state for `tradingview_profiles`, `tradingview_access_grants`,
`revoked_at`/`revoked_by` on `tradingview_access_requests`; user TV profile flow; admin
grant/revoke with full metadata; task-queue truth; automation non-default confirmation; test list.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-tradingview-access-implementer.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md`
- `docs/CONTRACTS/tradingview-access.md`
- `packages/tradingview-access/src/index.ts`
- `apps/web/src/lib/tv-types.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md`

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. CONFIRMED: Package is a single file, not the multi-file TARGET layout (INFO — known, tracked)

**Evidence:** `packages/tradingview-access/src/index.ts` is a single 106-line file. The multi-file
split (`service.ts`, `admin-service.ts`, `scheduler.ts`, `task-runner.ts`, `adapter.ts`,
`adapters/`, `queries/`, `validation/`) described in `docs/TRADINGVIEW_ACCESS_PLAN.md` §Package
Structure is explicitly labelled TARGET and does not exist. This is the documented ground truth
from the Phase 2 Wave 1 design handoff (20260530-0126). No code path in the app imports from
sub-paths of `@wtc/tradingview-access` — all in-memory service usage routes through the single
`index.ts`.

**Recommendation:** Phase 2.1 does NOT need to split the file to implement profiles + grants +
revoke metadata. The new DB repos (`upsertTradingViewProfile`, `createTvGrant`, `revokeTvGrant`,
`listTvGrantsForUser`, `listAllTvGrants`) belong in `packages/db/src/repositories.ts` alongside
the existing TV repos, not in new package files. The `packages/tradingview-access/src/index.ts`
in-memory service is the dev fallback only. Additive change: leave the single file intact; add DB
repos and update `TvService` interface + `db-store.ts` adapter.

---

### 2. CONFIRMED: `tradingview_profiles` and `tradingview_access_grants` tables do not exist (MEDIUM — implementation gap)

**Evidence:** `packages/db/src/schema.ts` contains exactly two TradingView tables:
`tradingviewAccessRequests` (line 148) and `tradingviewAccessTasks` (line 159). Neither
`tradingview_profiles` nor `tradingview_access_grants` appear anywhere in `schema.ts`. The
`packages/db/migrations/` directory has not been inspected in this wave, but the db-architect
handoff (20260530-0126) confirms these are REAL-in-0002 (not yet landed). All Phase 2.1 code that
calls `upsertTradingViewProfile` or `createTvGrant` depends on migration 0002 being applied first.

**Recommendation:** Phase 2.1 code changes MUST be preceded by migration 0002 landing
(db-architect's work). The Wave-2 serial implementer must not write `upsertTradingViewProfile` or
`createTvGrant` repos until the Drizzle table definitions exist in `schema.ts` to type against.
The plan is correctly ordered: db-architect lands 0002, then this implementer wires the repos and
service adapter.

---

### 3. CONFIRMED: `revokeTv` does not populate `revoked_at`/`revoked_by` — tracked debt (HIGH — correctness gap)

**Evidence:** `packages/db/src/repositories.ts` line 278–283, `revokeTv`:

```ts
await tx.update(s.tradingviewAccessRequests)
  .set({ status: 'revoked' })
  .where(eq(s.tradingviewAccessRequests.id, requestId));
await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, ... }));
```

The `UPDATE` sets only `status = 'revoked'`. The admin id (`adminId`) and timestamp (`now`) are
available as parameters but are NOT written to the request row. The revoke actor lives only in the
`audit_logs` row. The comment at line 277 acknowledges this: "adminId/now are recorded in the
audit row (the schema has no revoked_at/revoked_by columns yet)."

Migration 0002 adds `revoked_at TIMESTAMPTZ` and `revoked_by UUID REFERENCES users(id)` as
nullable additive columns. After migration 0002 lands, `revokeTv` must be updated to:
1. `SET status='revoked', revoked_at=new Date(now), revoked_by=adminId` on `tradingview_access_requests`.
2. Also `SET revoked_at, revoked_by, revoke_reason` on the matching `tradingview_access_grants` row
   (via the new `revokeTvGrant` repo).
3. `SET current_grant_id = NULL` on `tradingview_profiles` for the user.
4. Write the in-txn audit row as it does today — already correct.

The audit row is correctly in-txn today (finding: audit is NOT the gap; the column population is).

**Recommendation:** After migration 0002, update `revokeTv` (or replace with `revokeTvGrant`) to
write the three surfaces: request row columns, grant row columns, profile `current_grant_id` null.
All in one transaction. Do not split across calls.

---

### 4. CONFIRMED: `grantTv` does not create a `tradingview_access_grants` row or update `tradingview_profiles.current_grant_id` (HIGH — Phase 2.1 new requirement)

**Evidence:** `packages/db/src/repositories.ts` lines 271–276, `grantTv`:

```ts
await tx.update(s.tradingviewAccessRequests)
  .set({ status: 'granted', grantedAt: new Date(now), grantedBy: adminId, expiresAt: new Date(now + durationMs) })
  .where(eq(s.tradingviewAccessRequests.id, requestId));
await tx.insert(s.auditLogs).values(auditRowValues({ ... action: 'tradingview.grant' ... }));
```

No `tradingview_access_grants` insert. No `tradingview_profiles.current_grant_id` update. These
tables do not yet exist. After migration 0002, `grantTv` (or the new `createTvGrant` repo) must,
in a single transaction:
1. UPDATE `tradingview_access_requests`: `status='granted'`, `granted_at`, `granted_by`, `expires_at`.
2. INSERT into `tradingview_access_grants`: `request_id`, `user_id`, `tv_username`, `granted_at`,
   `expires_at`, `granted_by`, `granted_by_type='admin'`.
3. UPSERT `tradingview_profiles`: set `current_grant_id` to the new grant's id. The profile row
   must exist (created by `upsertTradingViewProfile` during submit flow) before this UPDATE fires.
   Use a deferred FK or two-step within the txn: INSERT grant first, then UPDATE profile.
4. Write in-txn audit row: `action='tradingview.grant'`, `actorUserId=adminId`.

**Recommendation:** Introduce `createTvGrant` as a new repo function that wraps steps 1–4. The
existing `grantTv` can delegate to it once 0002 is live, or `TvService.grant` in `db-store.ts`
can call `createTvGrant` directly. The db-architect handoff already specifies the signature:
`createTvGrant(db, {requestId, userId, tvUsername, grantedAt, expiresAt?, grantedBy?, grantedByType})`.

---

### 5. CONFIRMED: `upsertTradingViewProfile` is absent from all current code (MEDIUM — new requirement)

**Evidence:** No call to `upsertTradingViewProfile` exists anywhere in the codebase. The
`tradingview_profiles` table does not exist in `schema.ts`. The `submitTvRequest` repo (line
257–263) inserts a request row with `tradingViewUsername` inline but does not touch any profile
table. The user-facing submit flow in `db-store.ts` (line 125–130) calls `rSubmitTvRequest`
directly with no profile upsert.

After migration 0002, `submitTvRequest` in `repositories.ts` must be extended (or the `db-store.ts`
adapter extended) to call `upsertTradingViewProfile` in the same transaction as the request insert.
Alternatively, `upsertTradingViewProfile` can be a separate call made by the server action before
`submitRequest`, inside a single coordinated operation. The cleaner path is inside the repo txn.

**Recommendation:** Extend `submitTvRequest` to also upsert `tradingview_profiles` in the same
transaction. Audit action for profile creation/update: `tv_access.profile_update` (as specified by
db-architect). This is additive and does not change the existing request insert.

---

### 6. CONFIRMED: `TvRequestDTO` / `TvRequestView` lacks `revokedAt`/`revokedBy` fields (MEDIUM — type gap)

**Evidence:** `packages/db/src/repositories.ts` lines 233–242, `TvRequestDTO`:

```ts
export interface TvRequestDTO {
  id: string; userId: string; tradingViewUsername: string; status: TvStatus;
  requestedAt: number;
  grantedAt?: number; grantedBy?: string; expiresAt?: number;
  // NOT PRESENT: revokedAt, revokedBy
}
```

`apps/web/src/lib/tv-types.ts` line 10: `export type TvRequestView = TvRequestDTO;`

Both the in-memory `TvAccessRequest` (in `index.ts` lines 16–18) and the db-architect's Phase 2.1
spec include `revokedAt`/`revokedBy`. The DB DTO cannot include them until the columns exist.

**Recommendation:** After migration 0002, add optional `revokedAt?: number` and `revokedBy?: string`
to `TvRequestDTO` and update `rowToTvDto` to populate them:
```ts
if (r.revokedAt) dto.revokedAt = r.revokedAt.getTime();
if (r.revokedBy) dto.revokedBy = r.revokedBy;
```
`TvRequestView` inherits these fields automatically (it is a type alias). No change needed to
`tv-types.ts` itself.

---

### 7. CONFIRMED: `TvService` interface lacks `upsertProfile` and grant-metadata signatures (MEDIUM — interface gap)

**Evidence:** `apps/web/src/lib/tv-types.ts` lines 12–19, `TvService`:

```ts
export interface TvService {
  submitRequest(userId, username, hasEntitlement, now): Promise<TvRequestView>;
  listByUser(userId): Promise<TvRequestView[]>;
  listAll(): Promise<TvRequestView[]>;
  grant(requestId, adminId, now, durationMs): Promise<void>;
  revoke(requestId, adminId, now): Promise<void>;
}
```

Missing for Phase 2.1:
- `revoke` has no `reason` parameter — the admin revoke flow cannot capture reason without it.
- No `getProfile(userId)` or `upsertProfile(userId, tvUsername)` method.
- No `listGrantsForUser(userId)` for the user profile panel.

**Recommendation:** Phase 2.1 adds to `TvService`:
```ts
revoke(requestId, adminId, now, reason?: string): Promise<void>;
getProfile(userId: string): Promise<TvProfileView | null>;
listGrantsForUser(userId: string): Promise<TvGrantView[]>;
listAllGrants(opts?: { activeOnly: boolean }): Promise<TvGrantView[]>;
```
New view types `TvProfileView` and `TvGrantView` should be defined in `tv-types.ts` and backed by
the new repo DTOs. Both DB adapter (`db-store.ts`) and in-memory adapter (`demo.ts`) must implement
the extended interface — the in-memory adapter returns stubbed/empty data for the grant methods.

---

### 8. CONFIRMED: `revokeTv` audit row does not include the revoke reason (LOW — completeness gap)

**Evidence:** `repositories.ts` line 281: `after: { status: 'revoked' }`. The reason field is not
in the current `revoke` call signature at all (`revoke(requestId, adminId, now)`). The audit row
records `status: 'revoked'` but no reason. Admin queue currently has no reason field (TARGET per
plan doc).

**Recommendation:** When `reason` parameter is added to the `revoke` / `revokeTvGrant` signature,
include it in the audit row: `after: { status: 'revoked', reason }`. This is a one-line additive
change in the txn body. Do not log user-supplied reason to exception traces.

---

### 9. CONFIRMED: `sweepTvExpiry` does not write audit rows and does not consult `entitlement_id` FK (LOW — known gap)

**Evidence:** `repositories.ts` lines 285–297, `sweepTvExpiry`: the loop updates status to
`'expired'` and inserts `tradingview_access_tasks` rows but does NOT call `auditRowValues` or
insert into `audit_logs`. The scheduler has no entitlement join because `entitlement_id` column
does not exist yet.

**Recommendation:** This is deferred. After migration 0002 adds `entitlement_id` to
`tradingview_access_requests`, extend `sweepTvExpiry` to: (a) write audit rows for every
`granted → expired` transition, actor_type=`scheduler`; (b) join `entitlements` to detect
billing-triggered revokes. `tradingview_access_tasks` rows remain informational/unconsumed —
`job_queue` is RESERVED. No task executor ships in Phase 2.1.

---

### 10. CONFIRMED: `grantTv` has no state guard — any request can be granted regardless of current status (LOW — known gap, tracked)

**Evidence:** `repositories.ts` line 271: `UPDATE ... SET status='granted'` with only a
`WHERE id = requestId` condition. An already-`revoked` or already-`expired` request can be
re-granted. Same issue on `revokeTv` line 278. Both were documented as TARGET in the Phase 2 Wave
1 handoff (Finding 6 of 20260530-0126-ecosystem-tradingview-access-implementer.md).

**Recommendation:** Phase 2.1 adds a state guard inside the `createTvGrant` txn:
```ts
// Inside the transaction, before the UPDATE:
const [existing] = await tx.select().from(s.tradingviewAccessRequests)
  .where(eq(s.tradingviewAccessRequests.id, requestId)).limit(1);
if (!existing) throw new Error('REQUEST_NOT_FOUND');
if (!['pending', 'expiring_soon'].includes(existing.status))
  throw new Error('INVALID_STATE');
```
Similar guard for revoke: only `pending`, `granted`, `expiring_soon` are revokable. The guard
runs inside the same transaction, so it is race-safe under serializable isolation.

---

## Decisions

1. Package structure: `packages/tradingview-access/src/index.ts` stays as the in-memory single
   file. All Phase 2.1 DB work lands in `packages/db/src/repositories.ts` (new repo functions)
   and `apps/web/src/lib/db-store.ts` (adapter wiring). No new files in `packages/tradingview-access`
   are required for Phase 2.1. The multi-file TARGET split is deferred beyond Phase 2.1.

2. Dependency ordering: migration 0002 (`tradingview_profiles`, `tradingview_access_grants`,
   `revoked_at`/`revoked_by` columns) is a hard prerequisite. The db-architect controls 0002. Phase
   2.1 code changes cannot typecheck or run until 0002 Drizzle table definitions exist in `schema.ts`.

3. Audit action names: CURRENT convention (`tradingview.*` dot-notation) is retained for
   `tradingview.grant` and `tradingview.revoke`. New repo functions introduced in Phase 2.1 use
   `tv_access.profile_update` (as specified by db-architect) and `tv_access.grant` /
   `tv_access.revoke` (consistent with the grant/profile bounded context). Existing action names
   are not renamed — audit log history must remain readable.

4. Single transaction for all Phase 2.1 mutations: every mutation touches at most three tables
   in one transaction — `tradingview_access_requests`, `tradingview_access_grants`,
   `tradingview_profiles` — plus the `audit_logs` insert. Splitting across transactions is not
   permitted; partial writes would leave profile/grant state inconsistent.

5. `tradingview_profiles.current_grant_id` FK ordering: INSERT grant row first, then UPDATE profile
   with `current_grant_id = grant.id`. Both in the same txn. The FK is deferrable per db-architect
   spec so the UPDATE order within the txn is valid.

6. Automation: `FEATURE_TV_AUTOMATION_ADAPTER` stays `false` in all environments. No automation
   adapter code ships in Phase 2.1. The `TradingViewAutomationAdapter` interface file does not
   exist and must NOT be created in Phase 2.1 unless the db-architect spec explicitly directs it
   and it is behind a feature flag with a stub that throws immediately.

7. `tradingview_access_tasks` rows remain informational and unconsumed. `job_queue` is RESERVED.
   No task executor is added in Phase 2.1.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Phase 2.1 blocked until migration 0002 lands | P1 — hard blocker | db-architect must deliver `tradingview_profiles` + `tradingview_access_grants` + additive columns in schema.ts before any Phase 2.1 code runs. The implementer must not write Drizzle query code against tables that do not yet exist in schema.ts — TypeScript would not compile. |
| `tradingview_profiles.current_grant_id` circular reference during txn | P1 | Resolved by INSERT-then-UPDATE within a single deferred-FK txn. db-architect spec already accounts for this (20260530-0126 §Risks row 3). Do not do both in a single INSERT. |
| In-memory adapter (`demo.ts`) diverges from DB adapter (`db-store.ts`) after Phase 2.1 | P2 | Both must implement the same extended `TvService` interface. The in-memory adapter stubs out `getProfile` and `listGrantsForUser` with null/[] — acceptable for dev. Failing to update `demo.ts` causes a typecheck failure (interface not satisfied). |
| `revoke` reason parameter added to `TvService.revoke` breaks existing call sites | P2 | Make `reason` optional (`reason?: string`). Existing call sites in the admin page pass no reason today — they continue to compile. The new admin revoke form adds the reason field as optional-but-encouraged in the UI. |
| `sweepTvExpiry` runs without audit rows for scheduler-driven expirations | P2 | Known gap; deferred to Phase 2.1+ scheduler extension. Admins can reconstruct via `expires_at` column comparison. Not a correctness risk for the Phase 2.1 grant/revoke flow. |
| Duplicate submit rows — `submitTvRequest` inserts on every call | P2 | Already tracked from Phase 2 Wave 1 (Finding 7 of 20260530-0126). Partial unique index `uq_tv_active_request` is in the db-architect 0002 spec but the implementer must verify it lands. Until then, application-level guard only. |
| No rate limiting on submit/grant/revoke | P3 | TARGET; documented in contract. Not a Phase 2.1 blocker. |

---

## Verification/tests

The following tests are required before Phase 2.1 is considered complete. All run against the
PGlite integration harness (same pattern as Phase 1.7 `db-persistence.test.ts`). Gates are NOT
RUN this wave (read-only audit).

### TV grant writes grant row and updates profile.current_grant_id

```
GIVEN: a tradingview_profiles row exists for userId (from upsertTradingViewProfile)
AND: a tradingview_access_requests row exists with status='pending'
WHEN: createTvGrant(db, {requestId, userId, tvUsername, grantedAt, expiresAt, grantedBy, grantedByType:'admin'})
THEN:
  - tradingview_access_grants row inserted with correct request_id, user_id, granted_by, granted_by_type
  - tradingview_access_requests.status = 'granted', granted_at and granted_by populated
  - tradingview_profiles.current_grant_id = the new grant's id
  - audit_logs row inserted in same txn: action='tv_access.grant', actor_user_id=grantedBy
```

### TV revoke populates revoked_at/revoked_by on both tables + nulls current_grant_id + in-txn audit with actor

```
GIVEN: a grant exists (createTvGrant already called), profile.current_grant_id is set
WHEN: revokeTvGrant(db, grantId, adminId, 'duplicate subscription', now)
THEN:
  - tradingview_access_grants.revoked_at = new Date(now), .revoked_by = adminId, .revoke_reason = 'duplicate subscription'
  - tradingview_access_requests.status = 'revoked', .revoked_at = new Date(now), .revoked_by = adminId
  - tradingview_profiles.current_grant_id = NULL
  - audit_logs row inserted in same txn: action='tv_access.revoke', actor_user_id=adminId,
    after includes { status:'revoked', reason:'duplicate subscription' }
  - All four writes committed atomically (rollback one → rollback all)
```

### listTvGrantsForUser per-user isolation

```
GIVEN: userA has 2 grants, userB has 1 grant
WHEN: listTvGrantsForUser(db, userA.id)
THEN: returns exactly 2 rows, all with user_id = userA.id
WHEN: listTvGrantsForUser(db, userB.id)
THEN: returns exactly 1 row, user_id = userB.id
ASSERT: userA's grants never appear in userB's result and vice versa
```

### Profile upsert is idempotent

```
GIVEN: upsertTradingViewProfile(db, {userId, tvUsername: 'handle_v1'}) called once
THEN: exactly 1 tradingview_profiles row for userId, tv_username='handle_v1'
WHEN: upsertTradingViewProfile(db, {userId, tvUsername: 'handle_v2'}) called again
THEN: still exactly 1 row, tv_username='handle_v2', updated_at advanced
ASSERT: no duplicate rows; audit_logs has 2 entries (one per call) with action='tv_access.profile_update'
```

### State guard on grant rejects invalid transitions

```
GIVEN: request with status='revoked'
WHEN: createTvGrant called for that requestId
THEN: throws 'INVALID_STATE' (or equivalent); no grant row inserted; no audit row written
GIVEN: request with status='pending'
WHEN: createTvGrant called
THEN: succeeds (as per the happy-path test above)
```

### State guard on revoke rejects already-revoked

```
GIVEN: request with status='revoked' (already revoked by a prior call)
WHEN: revokeTvGrant called again
THEN: throws 'INVALID_STATE'; no second grant/request row mutation; no duplicate audit row
```

### In-memory demo adapter satisfies TvService interface after extension

```
TYPE CHECK: demo.ts tvService object satisfies the extended TvService interface
  (revoke with optional reason, getProfile returns null, listGrantsForUser returns [])
This is a typecheck gate, not a runtime test.
```

---

## User TV profile flow (Phase 2.1 specification)

All server actions remain server-side RBAC + entitlement gated. No client state infers access.

### Submit / update TV username

1. User visits `/app/indicators`. Server component calls `accessFor(userId, 'tradingview_indicators')`.
2. If entitlement not active/grace: show `RiskWarningBanner`, disable form, deny submit.
3. If entitled: show current profile state panel (see below) + submit/update form.
4. Server action `submitTvAction`:
   a. `requireUser()` + `assertCsrf(formData)`.
   b. `accessFor(userId, 'tradingview_indicators')` — second server-side check (fail-closed).
   c. Validate TV username via `tradingViewUsernameSchema`.
   d. Call `upsertTradingViewProfile(db, {userId, tvUsername})` — creates or updates profile; in-txn audit `tv_access.profile_update`.
   e. Call `submitTvRequest(db, userId, tvUsername, now)` — inserts request row; in-txn audit `tradingview.submit`.
   f. `revalidatePath('/app/indicators')`.

### Profile state panel (Phase 2.1 TARGET, replaces bare table)

After Phase 2.1, the user page shows a single status panel driven by the latest active/most-recent
request state:

| State | Display |
|---|---|
| No request ever | "Submit your TradingView username to request access." |
| `pending` | "Your request is in the admin queue. You will be notified when access is granted." |
| `granted` | "Access granted. Your TradingView handle @{username} has been given access to WTC indicator scripts." |
| `expiring_soon` | "Your access expires in N days ({expiry_date}). Renew your subscription to keep access." |
| `expired` | "Your subscription has expired and access has been revoked. Renew to restore access." |
| `revoked` | "Access has been revoked. Contact support if you believe this is an error." |

Data source for the panel: `tvService.listGrantsForUser(userId)` — the most recent grant row
(ordered by `granted_at DESC`) drives the grant/expiry/revoke metadata. The request status column
drives the `pending`/`expired` states. The two are consistent because grant/revoke mutations keep
both tables in sync within the same transaction.

---

## Admin grant/revoke flow with metadata (Phase 2.1 specification)

### Grant flow

```
Admin clicks [Grant] for request row in /admin/tradingview-access
  → Server action grantAction:
      1. requireUser() + assertAdmin(actor.roles) + assertCsrf(formData)
      2. Validate: requestId (uuid), duration (positive int, days), optional notes
      3. createTvGrant(db, {
           requestId,
           userId: request.userId,
           tvUsername: request.tradingViewUsername,
           grantedAt: new Date(now),
           expiresAt: new Date(now + durationDays * 86_400_000),
           grantedBy: actor.id,
           grantedByType: 'admin'
         })
         — in same txn:
           UPDATE tradingview_access_requests: status='granted', granted_at, granted_by, expires_at
           INSERT tradingview_access_grants: all fields above
           UPDATE tradingview_profiles: current_grant_id = grant.id
           INSERT audit_logs: action='tv_access.grant', actor_user_id=actor.id,
             after: { status:'granted', tvUsername, durationDays }
      4. revalidatePath('/admin/tradingview-access')
```

State guard (in-txn): only `pending` and `expiring_soon` requests may be granted. Other statuses
return `INVALID_STATE` before any write.

### Revoke flow

```
Admin clicks [Revoke] for request row in /admin/tradingview-access
  → Server action revokeAction (Phase 2.1 adds reason field to the form):
      1. requireUser() + assertAdmin(actor.roles) + assertCsrf(formData)
      2. Validate: requestId (uuid), reason (text, optional but shown in UI)
      3. Look up current active grant: SELECT from tradingview_access_grants
         WHERE request_id = requestId AND revoked_at IS NULL LIMIT 1
      4. revokeTvGrant(db, grantId, actor.id, reason, now)
         — in same txn:
           UPDATE tradingview_access_grants:
             revoked_at=new Date(now), revoked_by=actor.id, revoke_reason=reason
           UPDATE tradingview_access_requests:
             status='revoked', revoked_at=new Date(now), revoked_by=actor.id
           UPDATE tradingview_profiles:
             current_grant_id=NULL
           INSERT audit_logs: action='tv_access.revoke', actor_user_id=actor.id,
             after: { status:'revoked', reason }
      5. revalidatePath('/admin/tradingview-access')
```

State guard (in-txn): only `pending`, `granted`, `expiring_soon` requests may be revoked. Guard
runs inside the transaction — concurrent double-revoke is rejected by the state check on `status`.

### Revoke metadata surfaces in admin queue

After Phase 2.1, the admin queue row for a revoked request shows:
- Revoked at: from `tradingview_access_requests.revoked_at` (new column, not an audit log query).
- Revoked by: join to `users.email` on `tradingview_access_requests.revoked_by`.
- Revoke reason: from `tradingview_access_grants.revoke_reason` (the grants table is the source of
  the reason field; the request row does not carry reason).

This eliminates the previous gap where the revoke actor was only recoverable via a secondary
`audit_logs` query.

---

## Automation non-default confirmation

**Confirmed: no TradingView automation ships as default in Phase 2.1 or any subsequent phase
unless explicitly gated.**

Evidence from seed (0000-orchestrator-seed.md, Hard Rule 8): "TradingView access is manual/admin-queue
by default; no credential-stuffing / brittle browser automation as production default."

Current state: `FEATURE_TV_AUTOMATION_ADAPTER` env var does not exist in any source file (no
`process.env.FEATURE_TV_AUTOMATION_ADAPTER` reference found). No `adapter.ts`, `adapters/mock.ts`,
or `adapters/real.stub.ts` files exist in `packages/tradingview-access/src/`. The
`TradingViewAutomationAdapter` interface is specified in `TRADINGVIEW_ACCESS_PLAN.md` as TARGET
only.

Phase 2.1 must NOT create any adapter file, no automation code, no browser automation, no
credential-passing logic. If the feature flag env var is introduced in a future phase, it must:
- Default to `false` in all `.env.example` and deployment configs.
- Only activate an adapter that throws immediately (stub) until a ToS-compliant mechanism is
  reviewed and approved.
- Be explicitly marked experimental in the UI if visible to admin.
- Never involve Puppeteer, Playwright, Selenium, or credential injection against TradingView.

---

## Next actions

1. **db-architect (prerequisite, blocks all below):** Land migration 0002 with:
   - `tradingview_profiles` table (Drizzle definition in `schema.ts` + SQL in 0002 migration file).
   - `tradingview_access_grants` table (Drizzle definition + SQL).
   - `ALTER TABLE tradingview_access_requests ADD COLUMN revoked_at TIMESTAMPTZ, ADD COLUMN revoked_by UUID REFERENCES users(id)`.
   - Partial unique index `uq_tv_active_request` on `tradingview_access_requests(user_id)` WHERE status IN ('pending','granted','expiring_soon').
   All per the db-architect handoff `docs/handoffs/20260530-0126-ecosystem-db-architect.md`.

2. **tradingview-access-implementer (Phase 2.1 DB repos):** After schema.ts has the new tables,
   add to `packages/db/src/repositories.ts`:
   - `upsertTradingViewProfile(db, {userId, tvUsername})` — ON CONFLICT(user_id) DO UPDATE; in-txn audit `tv_access.profile_update`.
   - `getTvProfile(db, userId)` — read-only.
   - `createTvGrant(db, {requestId, userId, tvUsername, grantedAt, expiresAt?, grantedBy?, grantedByType})` — four-write txn (request UPDATE + grant INSERT + profile UPDATE + audit INSERT); state guard `pending|expiring_soon` only.
   - `revokeTvGrant(db, grantId, adminId, reason?, now?)` — four-write txn (grant UPDATE + request UPDATE + profile UPDATE + audit INSERT); state guard `pending|granted|expiring_soon` only.
   - `listTvGrantsForUser(db, userId)` — WHERE user_id = userId; per-user isolation.
   - `listAllTvGrants(db, {activeOnly?})` — admin-scoped.
   Export new DTOs: `TvProfileDTO`, `TvGrantDTO`.

3. **tradingview-access-implementer (Phase 2.1 type updates):** Update `packages/db/src/repositories.ts`:
   - Add `revokedAt?: number` and `revokedBy?: string` to `TvRequestDTO`.
   - Update `rowToTvDto` to map `r.revokedAt` and `r.revokedBy`.
   Update `apps/web/src/lib/tv-types.ts`:
   - Add `TvProfileView`, `TvGrantView` types.
   - Extend `TvService` interface: add `revoke` `reason?` param, `getProfile`, `listGrantsForUser`, `listAllGrants`.

4. **tradingview-access-implementer (Phase 2.1 adapter wiring):** Update `apps/web/src/lib/db-store.ts`:
   - Wire `upsertTradingViewProfile` into `tvService.submitRequest` call (call before `rSubmitTvRequest`, same logical operation).
   - Wire `createTvGrant` as `tvService.grant`.
   - Wire `revokeTvGrant` as `tvService.revoke` (pass reason from form data).
   - Implement `tvService.getProfile` and `tvService.listGrantsForUser`.
   Update `apps/web/src/lib/demo.ts`:
   - Extend in-memory `tvService` to satisfy the extended `TvService` interface (stub `getProfile` → null, `listGrantsForUser` → []).

5. **tradingview-access-implementer (Phase 2.1 admin queue UI):** Update
   `apps/web/src/app/admin/tradingview-access/page.tsx`:
   - Add reason text input to revoke action form.
   - Pass reason through server action → `tvService.revoke`.
   - Display `revokedAt` and `revokedBy` (email) in revoked rows.
   - Display grant `expiresAt` and `grantedBy` from grant record.

6. **tradingview-access-implementer (Phase 2.1 user UI):** Update
   `apps/web/src/app/(app)/app/indicators/page.tsx`:
   - Replace bare table with the state-specific prose panel.
   - Call `tvService.listGrantsForUser(userId)` to get grant metadata for `granted`/`expiring_soon` states.
   - Show `current_grant_id` grant's `expires_at` in the `expiring_soon` panel.

7. **tradingview-access-implementer (Phase 2.1 tests):** Add PGlite integration tests covering
   all five scenarios in the Verification/tests section above to
   `packages/db/tests/integration/db-persistence.test.ts`.

8. **Phase 2.1 gates to run** (NOT RUN this read-only wave):
   - `npm run typecheck` — must pass after all type additions.
   - `npm test` — new PGlite integration tests green.
   - `npm run lint` — must pass.
   - `npm run build -w @wtc/web` — must pass.
   - `db:migrate` / `db:seed` — NOT RUN (no `DATABASE_URL` in this environment).
