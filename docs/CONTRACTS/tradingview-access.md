# Contract: TradingView Access

**Version:** 1.1.1
**Status:** CURRENT — DB-backed via `@wtc/db` repositories + in-memory dev fallback
**Last updated:** 2026-06-01
**Related plan:** [`docs/TRADINGVIEW_ACCESS_PLAN.md`](../TRADINGVIEW_ACCESS_PLAN.md)

---

## Current-vs-TARGET legend

- **CURRENT** — implemented today (Phase 1.7 / Phase 2 wave 1)
- **TARGET** — planned but not yet implemented

---

## Reality statement (Phase 1.7)

The TradingView web UI is **DB-backed when `DATABASE_URL` is set** (async `TvService`: DB adapter
`apps/web/src/lib/db-store.ts`, in-memory dev adapter `apps/web/src/lib/demo.ts`, fail-closed selector
`apps/web/src/lib/backend.ts`).

`submitTvRequest` / `grantTv` / `revokeTv` are transactional: they write `audit_logs` rows **in the same
DB transaction** as the state mutation (actions `tradingview.submit` / `tradingview.grant` /
`tradingview.revoke`; admin actor id recorded in every grant and revoke row).

**Tables CURRENT:** `tradingview_access_requests` + `tradingview_access_tasks` +
`tradingview_access_grants` + `tradingview_profiles` (all four tables exist — migration 0002 landed
Phase 2.1).

`tradingview_access_requests` has `revoked_at` / `revoked_by` columns (added in migration 0002 as
additive nullable columns). The revoke actor and time are recorded both on the request row and in the
`audit_logs` row written in the same DB transaction.

The multi-file package layout (`service.ts` / `admin-service.ts` / `scheduler.ts` / `task-runner.ts`) is
TARGET. Current code is a single `packages/tradingview-access/src/index.ts` (in-memory service) plus the
DB repositories in `packages/db/src/repositories.ts`.

`tradingview_access_tasks` rows inserted by `sweepTvExpiry` and `repairMissingTvRevokeTasks` are
informational/unconsumed — no task executor exists; `job_queue` is RESERVED. Migration `0008` enforces one
logical task per `(request_id, kind)` and both insert paths use conflict-safe inserts.

**TV username is public** (it is a public TradingView handle). It is safe to record in audit rows and
is not redacted.

---

## Owner

| Field | Value |
|---|---|
| **Owner** | `packages/tradingview-access` |
| **Implementation (CURRENT)** | single `packages/tradingview-access/src/index.ts` (in-memory) + DB repos in `packages/db/src/repositories.ts` (`submitTvRequest`, `listTvByUser`, `listAllTv`, `grantTv`, `revokeTv`, `sweepTvExpiry`, `rowToTvDto`) |
| **Implementation (TARGET)** | `packages/tradingview-access/src/service.ts`, `admin-service.ts`, `scheduler.ts`, `task-runner.ts` |
| **Exposed via (CURRENT)** | Next.js server actions in `apps/web/src/app/(app)/app/indicators/page.tsx` and `apps/web/src/app/admin/tradingview-access/page.tsx` |
| **Exposed via (TARGET)** | Route handlers under `apps/web/src/app/api/` (not yet created) |
| **Worker host** | `apps/worker` runs `sweepTvExpiry` on a cron-style loop; scheduler + task-runner that consume tasks are TARGET |
| **Entitlement gate** | `packages/entitlements` `hasAccess(userId, 'tradingview_indicators')` via `accessFor` in `apps/web/src/lib/access.ts` |

## Consumer

| Consumer | Interface used | Auth required |
|---|---|---|
| `apps/web` — `/app/indicators` | `tvService` from `@/lib/backend` (server component + server action) | Authenticated session cookie (`user` role minimum) |
| `apps/web` — `/admin/tradingview-access` | `tvService` from `@/lib/backend` (server component + server actions) | Authenticated session cookie (`admin` role) |
| `apps/worker` — expiry sweep | `sweepTvExpiry` from `@wtc/db` | Internal service call; no HTTP auth |
| `apps/worker` — task runner | TARGET — no consumer today | Internal |

---

## Authentication Method

All HTTP-facing endpoints use custom session auth: httpOnly + Secure + SameSite=Strict cookies issued by `packages/auth`. RBAC checked server-side on every call; session never trusted from client state.

CSRF protection: all state-mutating server actions call `assertCsrf(formData)` (double-submit token, CURRENT).

Worker-internal calls (`sweepTvExpiry`) run inside the worker Node.js process sharing the `@wtc/db` connection pool. No HTTP auth.

---

## View Model (CURRENT)

### `TvRequestView`

The single typed view rendered by both the indicators page and the admin queue:

```ts
// apps/web/src/lib/tv-types.ts — CURRENT
export type TvRequestView = TvRequestDTO;  // re-export from @wtc/db

// packages/db/src/repositories.ts — CURRENT
export interface TvRequestDTO {
  id: string;                   // uuid
  userId: string;               // uuid
  tradingViewUsername: string;  // public TradingView handle; safe in audit
  status: TvStatus;             // 'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked'
  requestedAt: number;          // epoch-ms (from requested_at column)
  grantedAt?: number;           // epoch-ms (from granted_at column; present when status=granted/expiring_soon)
  grantedBy?: string;           // admin user uuid (from granted_by column)
  expiresAt?: number;           // epoch-ms (from expires_at column)
  // revokedAt / revokedBy: DB columns exist on tradingview_access_requests (migration 0002, additive
  // nullable). Not yet surfaced in TvRequestDTO — add to DTO when the admin queue UI renders them.
  // Revoke actor also recorded in audit_logs (action 'tradingview.revoke').
}
```

`TvStatus` type (CURRENT, from `repositories.ts`):
```ts
export type TvStatus = 'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked';
```

### `TvService` interface (CURRENT)

```ts
// apps/web/src/lib/tv-types.ts
export interface TvService {
  submitRequest(userId: string, username: string, hasEntitlement: boolean, now: number): Promise<TvRequestView>;
  listByUser(userId: string): Promise<TvRequestView[]>;
  listAll(): Promise<TvRequestView[]>;
  grant(requestId: string, adminId: string, now: number, durationMs: number): Promise<void>;
  revoke(requestId: string, adminId: string, now: number): Promise<void>;
}
```

### `AdminTvAccessRow` (TARGET — for enriched admin queue)

The current admin queue fetches `tvService.listAll()` and enriches each row with a `getUserById` call per row. A typed `AdminTvAccessRow` for a purpose-built admin query is TARGET:

```ts
// TARGET
type AdminTvAccessRow = {
  requestId: string;
  userId: string;
  userEmail: string;
  displayName: string | null;
  tvUsername: string;
  status: TvStatus;
  submittedAt: number;          // epoch-ms
  stateUpdatedAt: number;       // epoch-ms (TARGET — no state_updated_at column today)
  entitlementPlanCode: string | null;
  entitlementExpiresAt: number | null;  // epoch-ms (TARGET — requires join to entitlements)
  lastGrantAction: AdminTvGrantRecord | null;  // TARGET — requires tradingview_access_grants table
}

type AdminTvGrantRecord = {
  action: 'granted' | 'revoked' | 'renewed';
  actorEmail: string | null;    // null if scheduler
  actorType: 'admin' | 'scheduler' | 'automation_adapter';
  performedAt: number;          // epoch-ms
  reason: string | null;
}
```

---

## Endpoint / Function Boundary

### User-facing — `submitTvRequest` (CURRENT)

Called by: server action `submitTvAction` in `apps/web/src/app/(app)/app/indicators/page.tsx`.

```ts
// Effective current call
tvService.submitRequest(userId, username, access.allowed, Date.now())
```

Input validation: `tradingViewUsernameSchema` from `@wtc/shared` (exact schema is in that package).

**Preconditions (CURRENT):**
1. Active session (httpOnly cookie, `requireUser()` throws on failure).
2. `accessFor(userId, 'tradingview_indicators').allowed === true` (fail-closed: false value is passed to `submitRequest` which throws `'No active tradingview_indicators entitlement'`).
3. CSRF token valid (`assertCsrf(formData)`).

**Postconditions (CURRENT):**
1. `tradingview_access_requests` row inserted with `status = 'pending'`.
2. `audit_logs` row inserted in the same DB transaction: `action = 'tradingview.submit'`.
3. Page revalidated via `revalidatePath('/app/indicators')`.

**Missing (TARGET):**
- Idempotent upsert on existing `pending` request (current code inserts a new row; duplicate prevention is application-level only).
- `tradingview_profiles` upsert.
- Acknowledgement checkbox.

---

### User-facing — `listByUser` (CURRENT)

Called by: `apps/web/src/app/(app)/app/indicators/page.tsx` (server component, no HTTP round-trip).

Returns all `TvRequestView[]` for the authenticated user. Read-only; no side effects.

---

### Admin-facing — `grant` (CURRENT)

Called by: server action `grantAction` in `apps/web/src/app/admin/tradingview-access/page.tsx`.

```ts
tvService.grant(requestId, actor.id, Date.now(), 90 * DAY)
```

**Preconditions (CURRENT):**
1. Active session + `assertAdmin(actor.roles)`.
2. CSRF token valid.

**Postconditions (CURRENT):**
1. `tradingview_access_requests` updated: `status = 'granted'`, `granted_at`, `granted_by`, `expires_at = now + 90 days`.
2. `audit_logs` row in the same DB transaction: `action = 'tradingview.grant'`, `actor_user_id = admin.id`.

**Missing (TARGET):**
- Entitlement re-check at grant time (second server-side check after entitlement may have changed).
- Variable duration (hardcoded 90d today).
- Reason field.
- `tradingview_access_grants` insert.
- State guard: only `pending`/`expiring_soon` → `granted`; currently no guard.

---

### Admin-facing — `revoke` (CURRENT)

Called by: server action `revokeAction` in `apps/web/src/app/admin/tradingview-access/page.tsx`.

```ts
tvService.revoke(requestId, actor.id, Date.now())
```

**Postconditions (CURRENT):**
1. `tradingview_access_requests` updated: `status = 'revoked'` (no `revoked_at`/`revoked_by` columns — actor in audit row).
2. `audit_logs` row in the same DB transaction: `action = 'tradingview.revoke'`, `actor_user_id = admin.id`.

**Missing (TARGET):**
- Reason field (currently no way to record reason except free-form notes).
- State guard (any status can be revoked today).
- `tradingview_access_grants` insert.
- Task cancellation for pending warn/revoke tasks.

---

### Admin-facing — `listAll` (CURRENT)

Called by: `apps/web/src/app/admin/tradingview-access/page.tsx` (server component). Returns all `TvRequestView[]` across all users. The page then enriches each row with `getUserById` (N+1 — acceptable for MVP queue size).

**Missing (TARGET):** Pagination, filter/search, sort, summary counts.

---

### Worker-facing — `sweepTvExpiry` (CURRENT — partial)

**Location:** `packages/db/src/repositories.ts` / called from `apps/worker`.

```ts
// CURRENT signature
export async function sweepTvExpiry(db: Db, now = Date.now()): Promise<{ expired: number; tasksQueued: number }>
```

Scans `tradingview_access_requests` where `status IN ('granted','expiring_soon')` AND `expires_at <= now`.
Delegates to `atomicRevokeTv` with system actor/reason `expired_by_worker`; that transaction revokes request,
grant, and profile state, writes `tv_access.revoke`, and conflict-safely queues one informational
`tradingview_access_tasks(kind='revoke')` row. Terminal status is `revoked`, not `expired`.

**TARGET additions:**
- Task consumer/automation for the manual revoke work.
- Join to `entitlements` to detect billing-triggered revokes.
- Richer `tradingview_access_tasks` schema (status, attempts, error, scheduled_for).

---

### Bulk operations (TARGET)

`adminBulkGrant` and `adminBulkRevoke` are TARGET — not implemented. The current admin page has individual row buttons only.

---

### `cancelTvAccessRequest` (TARGET)

User-initiated cancel of a `pending` request. Not implemented today.

---

## Error Envelope (TARGET)

Server actions today return `void` (success path) or throw (failures are swallowed in `submitTvAction` with `catch {}`). A discriminated error union is TARGET:

```ts
// TARGET
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: TvAccessErrorCode; message: string; fieldErrors?: Record<string, string[]> }

type TvAccessErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_ENTITLED'
  | 'REQUEST_NOT_FOUND'
  | 'INVALID_STATE'
  | 'NOT_OWNER'
  | 'FORBIDDEN'
  | 'ENTITLEMENT_LAPSED'
  | 'ADAPTER_ERROR'
  | 'INTERNAL_ERROR'
```

---

## Idempotency

| Operation | Current behaviour | Target |
|---|---|---|
| `submitRequest` with same username | Inserts a new row each call (no dedup today) | Return existing `pending` row; no duplicate |
| `submitRequest` with different username | Inserts a new row | Update `tv_username` on existing `pending` row |
| `grant` same requestId twice | Second call updates again (no guard) | Return `INVALID_STATE` on already-granted |
| `revoke` same requestId twice | Second call updates again (no guard) | Return `INVALID_STATE` on already-revoked |
| `sweepTvExpiry` | Idempotent on status check and task insert; duplicate logical tasks rejected by `(request_id, kind)` unique index | Rich task attempt/status model if automation is later added |

---

## Rate Limits (TARGET)

No rate limiting is implemented at the TV access layer today. Platform-level rate limiting is planned:

| Endpoint / Action | Limit |
|---|---|
| `submitTvUsername` | 5 per user per hour |
| `adminGrantAccess` | 60 per admin per minute |
| `adminRevokeAccess` | 60 per admin per minute |

---

## Timeouts

| Operation | Target timeout | On timeout |
|---|---|---|
| `submitTvRequest` DB write | 5 s | Return error; state not advanced |
| `grantTv` DB write + audit | 5 s | Return error; not committed |
| `revokeTv` DB write + audit | 5 s | Return error; not committed |
| `sweepTvExpiry` per batch | 60 s | Log error; yield to next run |

---

## Mock vs Real Status

| Component | CURRENT status | Notes |
|---|---|---|
| DB `TvService` adapter | CURRENT — real DB | `apps/web/src/lib/db-store.ts` over `@wtc/db` repositories; selected when `DATABASE_URL` is set |
| In-memory `TvService` adapter | CURRENT — dev fallback | `apps/web/src/lib/demo.ts`; resets on restart |
| `sweepTvExpiry` | CURRENT | Revokes granted/expiring rows through `atomicRevokeTv`, writes `tv_access.revoke`, conflict-safely queues one manual revoke task |
| `tradingview_access_tasks` consumer | TARGET | Tasks queued but never consumed |
| `tradingview_profiles` table | CURRENT | Table exists — migration 0002 Phase 2.1; columns: id, userId, tvUsername, verifiedAt, currentGrantId, createdAt, updatedAt |
| `tradingview_access_grants` table | CURRENT | Table exists — migration 0002 Phase 2.1; columns: id, requestId, userId, tvUsername, grantedAt, expiresAt, grantedBy, grantedByType, revokedAt, revokedBy, revokeReason, createdAt |
| `TradingViewAutomationAdapter` interface | TARGET | Defined in plan; no file exists yet |
| Real automation adapter | STUB/TODO | Must wait for TradingView ToS-compliant mechanism |
| Mock automation adapter | TARGET | Dev/test adapter stub planned |
| Notification delivery | TARGET | `notifications` table enqueue planned; email/Telegram delivery is TODO |

---

## TradingView ToS Constraint

TradingView does not provide a public API for script invite management. Any automation must be evaluated against TradingView's Terms of Service and must not involve:
- Logging into a TradingView account from WTC server infrastructure using stored credentials.
- Browser automation (Puppeteer, Playwright, Selenium) targeting TradingView's UI as a production default.
- Any scraping or screen-reading of TradingView pages.

The `TradingViewAutomationAdapter` interface allows a compliant implementation to be wired without changing the service layer. Until such an implementation exists, `FEATURE_TV_AUTOMATION_ADAPTER` must be `false` in all production environments.

---

## Data Retention

- `tradingview_access_requests` — retained indefinitely for audit; never deleted, only state-transitioned.
- `tradingview_access_grants` (TARGET) — append-only; never updated or deleted.
- `tradingview_access_tasks` — retained; `done` flag marks completion; archival policy TARGET.
- `tradingview_profiles` (TARGET) — follows user account lifecycle; deleted on user deletion.

---

## TV Username Sensitivity

A user's TradingView username is **not a secret** (it is public on TradingView). It is safe to:
- Record in `audit_logs` metadata (the CURRENT code does this).
- Display in admin UI.
- Include in `TvRequestDTO` and `TvRequestView`.

It should not appear in exception stack traces sent to external monitoring services, and should be treated as PII consistent with the platform privacy policy.

---

## Required Tests Before Production

| Test | File | Type | Status |
|---|---|---|---|
| `submitTvUsername` rejects without active entitlement | `service.test.ts` | Unit | CURRENT (memory service) |
| `adminGrantAccess` requires `admin` role | `admin-service.test.ts` | Unit | CURRENT (assertAdmin in action) |
| `adminRevokeAccess` requires `admin` role | Same | Unit | CURRENT |
| Audit log entry written on every grant | Same | Integration | CURRENT (in-txn repos; PGlite harness) |
| Audit log entry written on every revoke | Same | Integration | CURRENT |
| Scheduler queues `revoke_expired` when entitlement elapsed | `scheduler.test.ts` | Unit | TARGET |
| Scheduler transitions to `expiring_soon` at correct threshold | Same | Unit | TARGET |
| Task runner marks task `done` on success | `task-runner.test.ts` | Unit | TARGET |
| Task runner does NOT call adapter when feature flag is off | Same | Unit | TARGET |
| `/app/indicators` returns 403-equivalent for lapsed entitlement | Playwright e2e | E2E | CURRENT |
| Admin queue lists pending requests for admin only | Playwright e2e | E2E | CURRENT |
| Admin grant transitions row to `granted` and shows in UI | Playwright e2e | E2E | CURRENT |
