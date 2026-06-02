# TradingView Access Plan

**Owner:** `packages/tradingview-access`
**Related contract:** [`docs/CONTRACTS/tradingview-access.md`](./CONTRACTS/tradingview-access.md)
**Related entitlement:** product code `tradingview_indicators`
**Admin queue page:** `/admin/tradingview-access`
**User page:** `/app/indicators`

---

## Current-vs-TARGET legend

Throughout this document every claim is labelled:

- **CURRENT** — implemented and in production today (as of Phase 1.7 / Phase 2 wave 1)
- **TARGET** — planned but not yet implemented; no code path exercises it

---

## Overview

TradingView Indicators is a WTC product that requires granting a user's TradingView username access to private indicator scripts on the TradingView platform. There is no official TradingView automation API for script access grants. The production default is therefore a **manual-first admin queue workflow**. An optional ToS-compliant automation adapter is defined behind a feature flag and explicitly marked experimental.

**Hard rules (from seed — non-negotiable):**
- Never use credential-stuffing or brittle browser automation as the production default.
- Entitlements are the only access source of truth and fail closed.
- Every grant and revoke is written to `audit_logs`.
- Users with a non-`active` (or valid `grace`) `tradingview_indicators` entitlement are denied access and their pending requests are blocked at the entitlement check gate.

---

## Phase 1.7 Persistence Reality (ground truth)

**CURRENT — DB persistence is live.**

The web UI is DB-backed when `DATABASE_URL` is set:

- DB adapter: `apps/web/src/lib/db-store.ts` — `tvService` object implementing `TvService` over `@wtc/db` repositories.
- In-memory dev fallback: `apps/web/src/lib/demo.ts` — same `TvService` interface, `TvAccessService` over `createMemoryTvStore()`.
- Selector: `apps/web/src/lib/backend.ts` — selects DB adapter when `DATABASE_URL` is set; fails closed in production without it; exports `tvService` and `backendMode`.

**CURRENT — Audit actions written in-transaction:**

`submitTvRequest` / `grantTv` / `revokeTv` in `packages/db/src/repositories.ts` each write an `audit_logs` row inside the same DB transaction as the state mutation:
- `tradingview.submit` (actor: user)
- `tradingview.grant` (actor: admin)
- `tradingview.revoke` (actor: admin)

The in-memory dev adapter writes the same action strings to the in-memory audit sink.

**CURRENT — Tables:**

| Table | Status |
|---|---|
| `tradingview_access_requests` | CURRENT — exists in `packages/db/src/schema.ts`; used by all repos and the worker sweep |
| `tradingview_access_tasks` | CURRENT — exists in `packages/db/src/schema.ts`; tasks are inserted by `sweepTvExpiry` but are informational/unconsumed (no task executor) |
| `tradingview_profiles` | TARGET — not implemented; no Drizzle table, no migration |
| `tradingview_access_grants` | TARGET — not implemented; no Drizzle table, no migration |

**CURRENT — `tradingview_access_requests` actual columns** (from `packages/db/src/schema.ts`):

```
id               uuid  PK
user_id          uuid  FK users.id
tradingview_username  text
status           text  -- pending | granted | expiring_soon | expired | revoked
requested_at     timestamptz (via createdAt helper, defaultNow)
granted_at       timestamptz nullable
granted_by       uuid nullable  -- admin user id
expires_at       timestamptz nullable
```

Missing from the CURRENT schema (no column exists today):
- `revoked_at` — revoke time lives only in the audit row
- `revoked_by` — revoke actor lives only in the audit row
- `entitlement_id` FK
- `state_updated_at`
- `notes`

**CURRENT — `tradingview_access_tasks` actual columns:**

```
id          uuid  PK
request_id  uuid  FK tradingview_access_requests.id
kind        text  -- 'revoke'
created_at  timestamptz defaultNow
done        boolean default false
```

Migration `0008` adds `tvat_request_kind_idx`, a unique index on `(request_id, kind)`. The migration first
dedupes historical rows, preserving an unfinished task when one exists, then creates the index. Current
repository insert paths for worker expiry and repair use `onConflictDoNothing` against that logical key.

Missing from the CURRENT schema (TARGET): `status`, `task_type`, `attempts`, `last_attempted_at`, `completed_at`, `error`, `scheduled_for`.

**CURRENT — `packages/tradingview-access/src/index.ts`:**

Single file. Exports: `TvAccessStatus`, `TvAccessRequest` (with `revokedAt`/`revokedBy` on the in-memory shape), `TvAccessTask`, `TvAccessStore`, `createMemoryTvStore`, `TvAccessService` (submit/grant/revoke/sweep). The multi-file package layout (`service.ts` / `admin-service.ts` / `scheduler.ts` / `task-runner.ts`) is TARGET.

**CURRENT — `packages/db/src/repositories.ts` DTO shape:**

`TvRequestDTO` (exported) does NOT include `revokedAt` / `revokedBy` because the DB table has no such columns; revoke actor/time live only in `audit_logs`.

**CURRENT — Worker sweep (`sweepTvExpiry`):**

Scans `tradingview_access_requests` where `status IN ('granted', 'expiring_soon')` AND `expires_at <= now`, and for each delegates to `atomicRevokeTv` with the SYSTEM actor (`{ id: null, role: 'system' }`, reason `expired_by_worker`) — fully revoking the request + grant row + profile pointer + a `tv_access.revoke` audit row (Phase 2.7) — then conflict-safely inserts one informational `tradingview_access_tasks` row (`kind = 'revoke'`). Terminal status is `revoked` (not `expired`). Tasks are informational only; there is no consumer. `job_queue` is RESERVED/unconsumed. The status filter includes `expiring_soon` (Phase 2.8) so rows the warn pre-pass moved to `expiring_soon` are still revoked at expiry.

**CURRENT — `expiring_soon` transition (Phase 2.8 / PG5):**

`markExpiringSoon(db, now)` (`packages/db/src/repositories.ts`) runs in the worker `dbTick` BEFORE `sweepTvExpiry`. It marks `tradingview_access_requests` rows `status='granted' AND expires_at IS NOT NULL AND now < expires_at <= now + TV_EXPIRING_SOON_WINDOW_MS (7 days)` as `expiring_soon`. State progression: `granted → expiring_soon → revoked`. It is idempotent (a second run finds 0 `granted` rows in-window), writes no per-row audit (informational status bump; the durable record is the later `tv_access.revoke`), and never touches expired/revoked/pending/already-expiring_soon rows or any access-granting column. (The separate `<14-day` UI banner on `/app/indicators`, Phase 2.7, is a client horizon and does not depend on this status.)

---

## `TvRequestView` (current view model — CURRENT)

The type used by both the indicators page and the admin queue is:

```ts
// apps/web/src/lib/tv-types.ts
export type TvRequestView = TvRequestDTO;   // re-exported from @wtc/db

// packages/db/src/repositories.ts
export interface TvRequestDTO {
  id: string;
  userId: string;
  tradingViewUsername: string;
  status: TvStatus;          // 'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked'
  requestedAt: number;       // epoch-ms
  grantedAt?: number;        // epoch-ms — present when status = granted/expiring_soon/expired
  grantedBy?: string;        // admin user uuid
  expiresAt?: number;        // epoch-ms
  // NOT PRESENT: revokedAt, revokedBy (no DB columns; live in audit_logs)
}
```

`TvService` interface (CURRENT, `apps/web/src/lib/tv-types.ts`):

```ts
interface TvService {
  submitRequest(userId: string, username: string, hasEntitlement: boolean, now: number): Promise<TvRequestView>;
  listByUser(userId: string): Promise<TvRequestView[]>;
  listAll(): Promise<TvRequestView[]>;
  grant(requestId: string, adminId: string, now: number, durationMs: number): Promise<void>;
  revoke(requestId: string, adminId: string, now: number): Promise<void>;
}
```

---

## User-Facing Workflow (`/app/indicators`) — CURRENT

### Step 1 — Entitlement gate (CURRENT)

The page `/app/indicators` is a Next.js server component. It calls `accessFor(user.id, 'tradingview_indicators')` (from `@/lib/access`) before showing content. If the entitlement check fails, a `RiskWarningBanner` is shown and the submit form is disabled. No form is hidden — the disabled state is visible so the user understands what is blocking them.

### Step 2 — TradingView username capture (CURRENT)

A server action `submitTvAction` validates via `tradingViewUsernameSchema` (from `@wtc/shared`), calls `tvService.submitRequest` with `access.allowed` as the entitlement gate (fail-closed: throws if `false`). On success, `revalidatePath('/app/indicators')` refreshes the table.

Form fields rendered:
| Field | Validation |
|---|---|
| `username` | `tradingViewUsernameSchema` from `@wtc/shared` |
| (no acknowledgement checkbox yet) | TARGET |

### Step 3 — Status panel (CURRENT, table-based)

The current indicators page renders a `<table>` of all requests for the user showing:
- TV username
- Status (via `StatusPill` with `tone()` — ok/warn/bad mapping)
- Requested date
- Expiry date (or `—` if null)

The full prose status panel with state-specific messages (pending/granted/expiring_soon/expired/revoked copy) is TARGET. The current implementation uses a generic table with a `StatusPill` badge.

State color mapping (CURRENT):
```ts
function tone(status: string): Tone {
  return status === 'granted' ? 'ok'
       : status === 'pending' || status === 'expiring_soon' ? 'warn'
       : 'bad';
}
```

### Target status panel (TARGET)

State-specific user-visible messages:

| State | Icon | User-visible text |
|---|---|---|
| `pending` | amber dot | "Your request is in the admin queue. You will be notified when access is granted." |
| `granted` | green dot | "Access granted. Open TradingView and search for the WTC indicator scripts by the usernames listed in the help guide." |
| `expiring_soon` | gold dot | "Your subscription expires in N days. Access will be revoked on `expiry_date`. Renew to keep access." |
| `expired` | gray dot | "Your subscription has expired. Access has been revoked. Renew to restore access." |
| `revoked` | red dot | "Access has been revoked. Contact support if you believe this is an error." |

---

## Access Request State Machine

```
[*] --> pending       : user submits username (active entitlement required)

pending --> granted       : admin grants access (manual; automation adapter TARGET)
pending --> revoked       : admin rejects before grant
pending --> expired       : entitlement expires before admin acts (worker sweep)

granted --> expiring_soon : scheduler: days_until_expiry ≤ WARNING_DAYS (TARGET)
granted --> expired       : scheduler: entitlement expired (CURRENT via sweepTvExpiry)
granted --> revoked       : admin manual revoke (CURRENT)

expiring_soon --> granted     : user renews entitlement (TARGET)
expiring_soon --> expired     : entitlement expires (TARGET)
expiring_soon --> revoked     : admin manual revoke (TARGET)

expired --> pending   : user renews entitlement and re-submits username
revoked --> pending   : admin lifts revoke or user re-applies with active entitlement
```

### State definitions

| State | Meaning | Access allowed |
|---|---|---|
| `pending` | Request submitted, awaiting admin grant action | No |
| `granted` | Admin confirmed access on TradingView | Yes |
| `expiring_soon` | Access active but entitlement expires within `WARNING_DAYS` | Yes |
| `expired` | Entitlement elapsed without renewal; revoke task inserted | No |
| `revoked` | Explicitly revoked by admin or triggered by chargeback/refund | No |

### Transition guards

All state transitions are enforced server-side. The UI reads state only; it never sets state directly.

| Transition | Guard |
|---|---|
| `* → pending` | Entitlement for `tradingview_indicators` must be `active` or `grace` |
| `pending → granted` | Caller must have `admin` role; audit entry required (CURRENT) |
| `* → revoked` | Caller must have `admin` role OR triggered by scheduler from expired entitlement; audit entry required |
| `expired → pending` | Entitlement must be re-activated before re-submission |

---

## Database Tables

### `tradingview_access_requests` (CURRENT)

```sql
tradingview_access_requests (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tradingview_username  text         NOT NULL,
  status                text         NOT NULL,  -- pending | granted | expiring_soon | expired | revoked
  requested_at          timestamptz  NOT NULL DEFAULT now(),
  granted_at            timestamptz,
  granted_by            uuid,        -- admin user id; no FK constraint currently
  expires_at            timestamptz
  -- MISSING (TARGET): revoked_at, revoked_by, entitlement_id, state_updated_at, notes
)
```

### `tradingview_access_tasks` (CURRENT — informational, no consumer)

```sql
tradingview_access_tasks (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid         NOT NULL REFERENCES tradingview_access_requests(id) ON DELETE CASCADE,
  kind        text         NOT NULL,   -- 'revoke'
  created_at  timestamptz  NOT NULL DEFAULT now(),
  done        boolean      NOT NULL DEFAULT false
  -- MISSING (TARGET): status, task_type, scheduled_for, attempts, last_attempted_at, completed_at, error
)
```

### `tradingview_profiles` (TARGET — not implemented)

Will store the user's self-reported TradingView handle as a dedicated profile row separate from the request. One row per WTC user. Not required for current functionality; requests carry `tradingview_username` inline.

```sql
tradingview_profiles (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  tv_username text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
)
```

### `tradingview_access_grants` (TARGET — not implemented)

Immutable append-only record of every grant/revoke action. Carries richer actor metadata than the audit log. Currently the revoke actor lives only in `audit_logs`.

```sql
tradingview_access_grants (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid         NOT NULL REFERENCES tradingview_access_requests(id),
  user_id      uuid         NOT NULL REFERENCES users(id),
  tv_username  text         NOT NULL,
  action       text         NOT NULL,  -- granted | revoked | renewed
  actor_id     uuid         REFERENCES users(id),  -- null if scheduler
  actor_type   text         NOT NULL,  -- admin | scheduler | automation_adapter
  performed_at timestamptz  NOT NULL DEFAULT now(),
  reason       text,
  adapter_ref  text         -- external reference from automation adapter (TARGET)
)
```

---

## Expiry Scheduler (CURRENT — partial)

**CURRENT:** `sweepTvExpiry` in `packages/db/src/repositories.ts` runs inside `apps/worker` cron loop.

Behaviour today:
1. Scans `tradingview_access_requests` where `status IN ('granted','expiring_soon')` AND `expires_at <= now`.
2. Delegates each row to `atomicRevokeTv` with system actor and reason `expired_by_worker`.
3. `atomicRevokeTv` marks request/grant/profile revoked, writes `tv_access.revoke`, and conflict-safely inserts one `tradingview_access_tasks` row with `kind = 'revoke'`, `done = false`.
4. Returns `{ expired: number, tasksQueued: number }`, counting only newly inserted tasks.
5. `repairMissingTvRevokeTasks` separately backfills historical worker-expiry revokes that predate task queuing, also conflict-safely.
6. The earlier `expiring_soon` transition is handled by `markExpiringSoon` before this sweep.
7. Does NOT consume or execute the queued tasks — tasks are informational only.

**TARGET — full scheduler algorithm:**

```
procedure run_tv_access_expiry_scheduler():

  // Step 1: Find active grants approaching expiry (TARGET)
  candidates = SELECT r.*, e.expires_at
    FROM tradingview_access_requests r
    JOIN entitlements e ON e.id = r.entitlement_id
    WHERE r.status IN ('granted', 'expiring_soon')
      AND e.product_code = 'tradingview_indicators'
      AND e.status IN ('active', 'grace')
      AND e.expires_at IS NOT NULL

  for each candidate in candidates:
    days_remaining = (candidate.expires_at - now()) / 1 day

    if days_remaining <= 0:
      upsert tradingview_access_tasks: task_type = 'revoke_expired', scheduled_for = now()

    elif days_remaining <= WARNING_DAYS (default 7):
      if candidate.status = 'granted':
        UPDATE tradingview_access_requests SET status = 'expiring_soon'
        upsert tradingview_access_tasks: task_type = 'warn_expiring', scheduled_for = now()

  // Step 2: Find requests where entitlement is revoked/expired by billing (TARGET)
  stale = SELECT r.*
    FROM tradingview_access_requests r
    JOIN entitlements e ON e.id = r.entitlement_id
    WHERE r.status IN ('pending', 'granted', 'expiring_soon')
      AND e.status IN ('expired', 'revoked', 'refunded', 'chargeback')

  for each stale: queue_revoke_task(stale.id, actor_type = 'scheduler')
```

---

## Audit Log Entries

### CURRENT audit actions (in use today)

| Action constant | Actor type | Written by |
|---|---|---|
| `tradingview.submit` | `user` | `submitTvRequest` in `repositories.ts` (in-txn) |
| `tradingview.grant` | `admin` | `grantTv` in `repositories.ts` (in-txn) |
| `tradingview.revoke` | `admin` | `revokeTv` in `repositories.ts` (in-txn) |

In-memory dev adapter uses the same action strings via the in-memory audit sink.

### TARGET audit actions (not yet emitted)

| Action constant | Actor type | Description |
|---|---|---|
| `tv_access_requested` | `user` | Alias/rename of `tradingview.submit` per plan doc (TARGET alignment) |
| `tv_access_username_changed` | `user` | User updated username on a pending request |
| `tv_access_request_cancelled` | `user` | User cancelled a pending request |
| `tv_access_granted` | `admin` | Rename of `tradingview.grant` |
| `tv_access_grant_automation` | `automation_adapter` | Adapter completed grant (experimental) |
| `tv_access_revoked` | `admin` | Rename of `tradingview.revoke` |
| `tv_access_revoke_scheduler` | `scheduler` | Worker revoked due to expiry |
| `tv_access_revoke_automation` | `automation_adapter` | Adapter completed revoke (experimental) |
| `tv_access_warn_expiring` | `scheduler` | Warning notification sent to user |

Note: the CURRENT audit action names (`tradingview.submit`, `tradingview.grant`, `tradingview.revoke`) follow the platform `domain.verb` convention. The TARGET names above use the older underscore convention from earlier plan docs. The implementer should pick one convention and use it consistently; the CURRENT convention is `tradingview.*` and is preferred.

---

## Admin Queue: `/admin/tradingview-access` (CURRENT)

### Access control (CURRENT)

Page is a Next.js server component. `requireUser()` establishes the session; `assertAdmin(actor.roles)` checks the admin role inside each server action. Non-admin route access is blocked at the server action level.

### Current layout (CURRENT)

The current page renders a table with columns: User (email), TV username, Status (StatusPill), Expires, Action (grant 90d / revoke buttons).

Server actions:
- `grantAction` — calls `tvService.grant(requestId, actor.id, Date.now(), 90 * DAY)`. Hardcoded 90-day duration.
- `revokeAction` — calls `tvService.revoke(requestId, actor.id, Date.now())`. No reason field currently.

Both actions call `revalidatePath('/admin/tradingview-access')` on success.

Missing from current UI (TARGET):
- Filter/search controls
- Row detail drawer
- Entitlement expiry column (requires joining entitlements; current view shows `expiresAt` from the TV request row which is the grant duration, not the entitlement expiry)
- Reason field on revoke
- Bulk grant/revoke
- Automation adapter status indicator
- Summary counts (pending/granted/expiring/revoked totals)

### Target admin queue layout (TARGET)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Admin — TradingView Access Queue                                            │
│                                                                              │
│  Filters: [All] [Pending] [Granted] [Expiring Soon] [Expired] [Revoked]     │
│  Search:  [username or user email ________________]                          │
│                                                                              │
│  User               TV Username     State          Entitlement exp.  Action  │
│  alice@wtc.io       @alice_trades   pending        2026-08-29        [Grant] │
│  carol@wtc.io       @carol_swing    expiring       2026-06-05        [Grant] │
│  dan@wtc.io         @dan_signals    granted        2027-01-01        [Revoke]│
│                                                                              │
│  Pending: 2   Expiring soon: 1   Granted: 47   Revoked: 12                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Grant action (CURRENT — manual, hardcoded 90d)

```
Admin clicks [grant 90d]
  → Server action grantAction:
      1. requireUser() + assertAdmin(actor.roles) + assertCsrf(formData)
      2. tvService.grant(requestId, actor.id, Date.now(), 90 * DAY)
         → DB: UPDATE status='granted', granted_at, granted_by, expires_at
         → audit_logs: tradingview.grant (in-txn)
      3. revalidatePath('/admin/tradingview-access')
```

### Revoke action (CURRENT — no reason field)

```
Admin clicks [revoke]
  → Server action revokeAction:
      1. requireUser() + assertAdmin(actor.roles) + assertCsrf(formData)
      2. tvService.revoke(requestId, actor.id, Date.now())
         → DB: UPDATE status='revoked'
         → audit_logs: tradingview.revoke (in-txn)
      3. revalidatePath('/admin/tradingview-access')
```

---

## Package Structure

### CURRENT — `packages/tradingview-access/src/index.ts` (single file)

Exports: `TvAccessStatus`, `TvAccessRequest`, `TvAccessTask`, `TvAccessStore`, `createMemoryTvStore`, `TvAccessService`. This is the in-memory service used by the dev adapter (`demo.ts`).

### TARGET — multi-file layout

```text
packages/tradingview-access/
  src/
    index.ts                   // re-exports
    types.ts                   // TvAccessState, TvAccessRequest, TvAccessGrant, TvAccessTask
    service.ts                 // TradingViewAccessService (submit, getStatus, cancel)
    admin-service.ts           // TvAdminService (grant, revoke, list, bulk)
    scheduler.ts               // runExpiryScheduler(): scans and queues tasks
    task-runner.ts             // processTasks(): picks up queued tasks, executes
    adapter.ts                 // TradingViewAutomationAdapter interface
    adapters/
      mock.ts                  // MockTradingViewAdapter (dev/test only)
      real.stub.ts             // stub + TODO for real adapter
    queries/
      requests.ts              // Drizzle queries for tradingview_access_requests
      grants.ts                // Drizzle queries for tradingview_access_grants
      tasks.ts                 // Drizzle queries for tradingview_access_tasks
    validation/
      submit.ts                // Zod schema: SubmitTvUsernameInput
      admin-grant.ts           // Zod schema: AdminGrantInput, AdminRevokeInput
  tests/
    service.test.ts
    scheduler.test.ts
    task-runner.test.ts
    adapter-mock.test.ts
```

---

## Optional Automation Adapter (Experimental, Feature-Flagged) — TARGET

> **PRODUCTION DEFAULT: DISABLED**
> This section describes an optional automation layer gated behind environment variable `FEATURE_TV_AUTOMATION_ADAPTER`. It is explicitly marked experimental and must never be enabled without legal/ToS review and explicit operator approval. It is NOT credential-stuffing and NOT brittle browser automation — it is a defined adapter interface that can be wired to a future ToS-compliant mechanism.

### Interface definition (TARGET — adapter.ts does not exist yet)

```ts
export interface TradingViewAutomationAdapter {
  readonly name: string
  grantAccess(tvUsername: string): Promise<{ ref: string }>
  revokeAccess(tvUsername: string): Promise<void>
  healthCheck(): Promise<'ok'>
}
```

### Real adapter TODO

```
TODO (tradingview-access/src/adapter-real.ts):
  Implement a real TradingViewAutomationAdapter ONLY when:
    1. TradingView provides an official API for script invite management, OR
    2. An officially documented and ToS-approved mechanism is identified.

  Do NOT implement:
    - Puppeteer/Playwright browser automation against TradingView login flows.
    - Credential injection of a shared TradingView account into browser context.
    - Any scraping-based approach.

  Until a compliant implementation exists, leave this as a stub and keep
  FEATURE_TV_AUTOMATION_ADAPTER=false in all environments.
```

---

## Configuration

| Env var | Default | Status | Description |
|---|---|---|---|
| `TV_ACCESS_WARNING_DAYS` | `7` | TARGET | Days before expiry at which state transitions to `expiring_soon` |
| `TV_ACCESS_SCHEDULER_INTERVAL_HOURS` | `6` | CURRENT (worker loop interval) | How often the expiry scheduler runs |
| `TV_ACCESS_MAX_TASK_ATTEMPTS` | `3` | TARGET | Max retry attempts for a task |
| `FEATURE_TV_AUTOMATION_ADAPTER` | `false` | TARGET | Enable the optional automation adapter (experimental) |
| `TV_AUTOMATION_ADAPTER_NAME` | `mock` | TARGET | Which adapter to load when feature flag is true |

---

## Required Tests Before Production

| Test | Location | Type | Status |
|---|---|---|---|
| User cannot submit without active entitlement | `packages/tradingview-access/tests/service.test.ts` | Unit | CURRENT (memory service tested) |
| Duplicate submission returns existing request | Same | Unit | TARGET |
| State machine: all valid transitions succeed | Same | Unit | CURRENT (partial — memory service) |
| State machine: invalid transitions throw | Same | Unit | TARGET |
| Scheduler: marks expiring_soon at correct threshold | `scheduler.test.ts` | Unit | TARGET |
| Scheduler: queues revoke task when entitlement expired | Same | Unit | TARGET (sweepTvExpiry tested in PGlite harness) |
| Task runner: grant task calls adapter when feature flag on | `task-runner.test.ts` | Unit | TARGET |
| Task runner: grant task only writes audit when feature flag off | Same | Unit | TARGET |
| Admin grant requires admin role | `admin-service.test.ts` | Unit | CURRENT (assertAdmin in server action) |
| Audit log entry present on every grant and revoke | Same | Integration | CURRENT (in-txn repos) |
| `/app/indicators` blocked for expired entitlement | Playwright e2e | E2E | CURRENT (covered by e2e suite) |
| Admin queue shows pending requests | Playwright e2e | E2E | CURRENT |

---

## Related Documents

- [`docs/CONTRACTS/tradingview-access.md`](./CONTRACTS/tradingview-access.md) — full API contract
- [`docs/ENTITLEMENT_STATE_MACHINE.md`](./ENTITLEMENT_STATE_MACHINE.md) — entitlement states that gate TV access
- [`docs/AUDIT_LOG_SCHEMA.md`](./AUDIT_LOG_SCHEMA.md) — audit log schema and action constants
- [`docs/DATA_MODEL.md`](./DATA_MODEL.md) — full table definitions and indexes
- `packages/tradingview-access/` — implementation package
- `apps/worker/` — scheduler and task runner host
