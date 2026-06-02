# tradingview-access-implementer handoff

## Scope

Phase 2 Wave 1 — DESIGN ONLY. Reconcile contract/plan/UI/DB reality. Define view model. Specify
migration 0002 table needs. Document optional automation adapter boundary. No code or shared files
changed; only TRADINGVIEW_ACCESS_PLAN.md, CONTRACTS/tradingview-access.md, and this handoff written.

Epoch: 20260530-0126

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/TRADINGVIEW_ACCESS_PLAN.md` (pre-edit)
- `docs/CONTRACTS/tradingview-access.md` (pre-edit)
- `packages/tradingview-access/src/index.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `apps/web/src/lib/tv-types.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/(app)/app/indicators/page.tsx`
- `apps/web/src/app/admin/tradingview-access/page.tsx`

---

## Files changed

- `docs/TRADINGVIEW_ACCESS_PLAN.md` — full reconciliation; CURRENT vs TARGET labelling throughout; corrected table columns, audit actions, scheduler behaviour, package layout, UI layout
- `docs/CONTRACTS/tradingview-access.md` — version bump 1.0.0 → 1.1.0; reality statement updated; view model section added; every endpoint/boundary labelled CURRENT or TARGET; idempotency gaps noted

---

## Findings

### 1. Contract contained stale "Part E deferred" header (HIGH — doc drift)

**Evidence:** `docs/CONTRACTS/tradingview-access.md` top-of-file block read:
> "The web UI is NOT yet DB-backed (Part E)."

Part E landed in Phase 1.7. The contract had not been updated. Every consumer reading that file would believe the web UI is still in-memory. Fixed: removed the stale header; replaced with the Phase 1.7 reality statement.

### 2. `TvRequestDTO` shape diverges from plan's `TvAccessRequest` (MEDIUM — type contract drift)

**Evidence:** `packages/db/src/repositories.ts` `TvRequestDTO` has no `revokedAt`/`revokedBy` fields. The plan doc and original contract `TvAccessRequest` type included them. The DB schema (`schema.ts`) has no `revoked_at`/`revoked_by` columns. The revoke actor/time live only in the `audit_logs` row.

The `TvRequestView` type alias in `tv-types.ts` is `= TvRequestDTO`, so the view model correctly does NOT expose those fields. The plan doc was claiming fields that do not exist in the view. Fixed: TRADINGVIEW_ACCESS_PLAN.md and the contract now document the actual `TvRequestDTO` shape and explicitly note that revoke actor lives in `audit_logs`.

### 3. Audit action name mismatch (LOW — naming consistency)

**Evidence:** The plan doc listed TARGET audit actions as `tv_access_requested`, `tv_access_granted`, `tv_access_revoked`, etc. (underscore convention). The CURRENT code uses `tradingview.submit`, `tradingview.grant`, `tradingview.revoke` (dot notation). Both are in different parts of the plan doc without cross-referencing.

Fixed: TRADINGVIEW_ACCESS_PLAN.md and the contract now clearly distinguish CURRENT actions (`tradingview.*`) from TARGET action names; note that the CURRENT convention is preferred for consistency.

### 4. `expiring_soon` DB transition is TARGET, not CURRENT (MEDIUM — false capability claim)

**Evidence:** `sweepTvExpiry` in `repositories.ts` only handles `granted → expired`. It does not handle the `granted → expiring_soon` transition. That logic exists only in the in-memory `TvAccessService.sweep()` method. The plan doc stated the scheduler "transitions to expiring_soon" without marking this as TARGET.

Fixed: plan and contract both clearly label the `expiring_soon` DB transition as TARGET, and document what `sweepTvExpiry` actually does today.

### 5. `tradingview_access_tasks` task schema is minimal vs plan spec (MEDIUM — schema gap)

**Evidence:** Schema today: `id`, `request_id`, `kind` (only value: `'revoke'`), `created_at`, `done` (boolean). Plan doc specified: `status`, `task_type`, `scheduled_for`, `attempts`, `last_attempted_at`, `completed_at`, `error`. None of the extended columns exist. The tasks are informational and have no consumer.

Fixed: plan and contract now show the CURRENT minimal schema alongside TARGET columns.

### 6. Admin queue has no state guard on grant/revoke (LOW — missing invariant)

**Evidence:** `grantTv` in `repositories.ts` does an unconditional `UPDATE ... SET status='granted'` with no precondition check on current status. `revokeTv` likewise. Any request in any state can be granted or revoked by admin today. The plan doc described state guards as if they were implemented.

Fixed: contract section on `grant` and `revoke` now explicitly marks state guards as TARGET and notes the current unconstrained behaviour.

### 7. `submitTvRequest` inserts a new row every call — no dedup (LOW — idempotency gap)

**Evidence:** `repositories.ts` `submitTvRequest` calls `tx.insert(...).values(...)` with no conflict handling. Multiple submits by the same user create multiple rows. The plan doc described idempotent upsert behaviour (return existing pending request). The current UI page does display all rows in a table so duplicates would be visible.

Fixed: idempotency section in the contract now documents the current insert-always behaviour vs the TARGET upsert.

### 8. Admin UI uses N+1 `getUserById` calls (LOW — performance note, not a correctness bug)

**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx` calls `getUserById(r.userId)` inside a `Promise.all` over `tvService.listAll()` results. Acceptable for MVP queue sizes; should be replaced with a purpose-built JOIN query when queue grows.

Documented in the contract's `listAll` section as a known gap.

---

## Current-vs-TARGET reconciliation

### Tables

| Table | Status | Notes |
|---|---|---|
| `tradingview_access_requests` | CURRENT | Exists in schema.ts + migration 0000; used by all repos |
| `tradingview_access_tasks` | CURRENT | Exists; tasks queued by sweepTvExpiry; no consumer |
| `tradingview_profiles` | TARGET | Not implemented; no table, no migration |
| `tradingview_access_grants` | TARGET | Not implemented; no table, no migration |

### Columns in `tradingview_access_requests` (CURRENT)

```
id, user_id, tradingview_username, status, requested_at, granted_at, granted_by, expires_at
```

Not present (TARGET): `revoked_at`, `revoked_by`, `entitlement_id`, `state_updated_at`, `notes`

### Audit actions (CURRENT)

`tradingview.submit`, `tradingview.grant`, `tradingview.revoke` — written in-transaction by DB repos.

### Package layout (CURRENT)

Single `packages/tradingview-access/src/index.ts`. Multi-file split is TARGET.

### UI layer (CURRENT)

- `/app/indicators` — table of user's requests; submit form; `StatusPill` for state colour; no prose status panel
- `/admin/tradingview-access` — table of all requests; grant (hardcoded 90d) and revoke buttons; no filter/search/reason/bulk/drawer

---

## User + admin flow + view model

### User flow (current capability)

1. User visits `/app/indicators`. Server component calls `accessFor(userId, 'tradingview_indicators')`.
2. If not entitled: `RiskWarningBanner` shown; submit form disabled.
3. If entitled: `tvService.listByUser(userId)` renders the request table. Submit form enabled.
4. On submit: `tradingViewUsernameSchema` validates username; `tvService.submitRequest` called with `access.allowed` as entitlement gate; new `pending` row inserted; audit written in-txn; page revalidated.
5. Table shows all requests for the user with columns: TV username, status (StatusPill), requested date, expiry date.

### User flow (target additions)

- Acknowledgement checkbox on submit.
- Idempotent submit (upsert on existing pending row).
- Prose status panel replacing or augmenting the table (state-specific copy, expiry countdown for `expiring_soon`).
- Cancel-request action for `pending` state.
- Username-change action for `pending` state.

### Admin flow (current capability)

1. Admin visits `/admin/tradingview-access`. Server component calls `tvService.listAll()` then enriches each row with `getUserById`.
2. Table columns: user email, TV username, status (StatusPill), expires (grant expiry), grant 90d button, revoke button.
3. Grant: `assertAdmin` + CSRF check; `tvService.grant(requestId, actor.id, Date.now(), 90 * DAY)`; audit written in-txn.
4. Revoke: `assertAdmin` + CSRF check; `tvService.revoke(requestId, actor.id, Date.now())`; audit written in-txn.

### Admin flow (target additions)

- Filter by state; search by username or email.
- Summary counts per state.
- Reason field on revoke (required) and grant (optional).
- Variable grant duration (not hardcoded).
- State guards (pending/expiring_soon only grantable; pending/granted/expiring_soon only revokable).
- Row detail drawer with entitlement info, request history, audit log tail.
- Bulk grant and bulk revoke (up to 50 rows; each produces its own audit entry).
- Automation adapter status indicator (only visible when `FEATURE_TV_AUTOMATION_ADAPTER=true`).

### View model (CURRENT `TvRequestView`)

```ts
// Single type used by both indicators page and admin queue
export interface TvRequestDTO {   // aliased as TvRequestView in tv-types.ts
  id: string;                     // uuid
  userId: string;                 // uuid
  tradingViewUsername: string;    // public; safe in audit and UI
  status: TvStatus;               // 'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked'
  requestedAt: number;            // epoch-ms
  grantedAt?: number;             // epoch-ms
  grantedBy?: string;             // admin uuid
  expiresAt?: number;             // epoch-ms (grant duration expiry, not entitlement expiry)
}
```

Absent from the view (requires TARGET tables or columns):
- `revokedAt` / `revokedBy` — no DB columns; need `revoked_at`/`revoked_by` in migration 0002 or query from audit_logs
- `entitlementExpiresAt` — needs `entitlement_id` FK + join to `entitlements`
- `stateUpdatedAt` — needs `state_updated_at` column
- `lastGrantAction` — needs `tradingview_access_grants` table

### State colour mapping (CURRENT, in both pages)

```ts
function tone(status: string): Tone {
  return status === 'granted' ? 'ok'
       : status === 'pending' || status === 'expiring_soon' ? 'warn'
       : 'bad';  // expired, revoked
}
```

---

## Table needs for migration 0002

### Recommendation

For Phase 2 UI (the immediate next implementation wave), the priority split is:

**Needed for Phase 2 UI — add in migration 0002:**

1. `revoked_at` and `revoked_by` columns on `tradingview_access_requests` — needed so the admin queue and user panel can show revoke time/actor without a separate audit log query.
2. `state_updated_at` column on `tradingview_access_requests` — needed for the admin queue sort-by-last-change and for accurate display of when each state transition occurred.
3. `entitlement_id` column on `tradingview_access_requests` (FK to `entitlements.id`, nullable) — needed to join expiry data for the admin queue entitlement expiry column and for the scheduler to detect billing-driven revokes without a full-table scan.

**Can stay TARGET (not needed for Phase 2 UI):**

4. `tradingview_profiles` — the current design stores `tradingview_username` inline on each request row; a separate profile table adds normalisation but is not required for Phase 2 functionality.
5. `tradingview_access_grants` — the audit_log already records every grant/revoke action. A separate grants table adds a typed query surface and `reason` field, but the Phase 2 admin UI can function with the enriched `TvRequestView` using the columns above. Defer until the reason field and history drawer are implemented.

**For the full scheduler (needed when `expiring_soon` is implemented):**

6. Extend `tradingview_access_tasks` with: `status` (text, replaces `done` boolean; values: queued/processing/done/failed/cancelled), `task_type` (text; replaces `kind`; values: warn_expiring/revoke_expired/revoke_manual), `scheduled_for` (timestamptz), `attempts` (int default 0), `last_attempted_at` (timestamptz), `completed_at` (timestamptz), `error` (text). This is needed when a real task consumer is implemented; can stay TARGET until then.

### Column spec for db-architect (migration 0002)

```sql
-- ALTER TABLE tradingview_access_requests
ADD COLUMN revoked_at          timestamptz;
ADD COLUMN revoked_by          uuid REFERENCES users(id);
ADD COLUMN state_updated_at    timestamptz NOT NULL DEFAULT now();
ADD COLUMN entitlement_id      uuid REFERENCES entitlements(id);
ADD COLUMN notes               text;

-- CREATE TABLE tradingview_profiles  (TARGET — can defer)
CREATE TABLE tradingview_profiles (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tv_username text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT tradingview_profiles_user_id_key UNIQUE (user_id)
);

-- CREATE TABLE tradingview_access_grants  (TARGET — can defer)
CREATE TABLE tradingview_access_grants (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id   uuid         NOT NULL REFERENCES tradingview_access_requests(id),
  user_id      uuid         NOT NULL REFERENCES users(id),
  tv_username  text         NOT NULL,
  action       text         NOT NULL CHECK (action IN ('granted', 'revoked', 'renewed')),
  actor_id     uuid         REFERENCES users(id),
  actor_type   text         NOT NULL CHECK (actor_type IN ('admin', 'scheduler', 'automation_adapter')),
  performed_at timestamptz  NOT NULL DEFAULT now(),
  reason       text,
  adapter_ref  text
);

-- Extend tradingview_access_tasks  (TARGET — defer until task consumer implemented)
ALTER TABLE tradingview_access_tasks
  ADD COLUMN task_type         text,         -- warn_expiring | revoke_expired | revoke_manual
  ADD COLUMN scheduled_for     timestamptz,
  ADD COLUMN status            text NOT NULL DEFAULT 'queued',  -- queued | processing | done | failed | cancelled
  ADD COLUMN attempts          int  NOT NULL DEFAULT 0,
  ADD COLUMN last_attempted_at timestamptz,
  ADD COLUMN completed_at      timestamptz,
  ADD COLUMN error             text;
-- NOTE: 'kind' column stays for backward compat with CURRENT sweepTvExpiry inserts;
-- task_type is the target replacement.
```

Partial unique index needed when idempotent submit is implemented (Phase 2 service layer):
```sql
CREATE UNIQUE INDEX uq_tv_active_request
  ON tradingview_access_requests (user_id)
  WHERE status IN ('pending', 'granted', 'expiring_soon');
```

---

## Optional automation adapter (TARGET — design boundary)

The adapter is defined as an optional TypeScript interface. It must never be the production default.

```ts
// packages/tradingview-access/src/adapter.ts  (TARGET — file does not exist)
export interface TradingViewAutomationAdapter {
  readonly name: string;
  grantAccess(tvUsername: string): Promise<{ ref: string }>;
  revokeAccess(tvUsername: string): Promise<void>;
  healthCheck(): Promise<'ok'>;
}
```

Activation: `FEATURE_TV_AUTOMATION_ADAPTER=true` (env var, deployment-level only; never settable from frontend).

Constraints (hard, from seed):
- No credential-stuffing.
- No Puppeteer/Playwright/Selenium against TradingView UI as production default.
- No scraping.
- Only activate after legal/ToS review and explicit operator sign-off.

Until a ToS-compliant TradingView mechanism exists, the `real.stub.ts` adapter throws immediately with a descriptive TODO message. The mock adapter is dev/test only.

---

## Decisions

1. Keep `tradingview.submit` / `tradingview.grant` / `tradingview.revoke` as the canonical audit action names (CURRENT convention, dot-notation). Do not rename to the underscore variants from the older plan doc sections.
2. `revoked_at` / `revoked_by` should be added as proper columns in migration 0002 (not queried from audit_logs at runtime) — easier to display in admin queue and user panel without a secondary audit query.
3. `tradingview_profiles` and `tradingview_access_grants` can stay TARGET for Phase 2; the indicators page and admin queue can be improved significantly using only the three new columns on `tradingview_access_requests`.
4. The `TvRequestView` / `TvRequestDTO` type should gain optional `revokedAt` and `revokedBy` fields once migration 0002 lands — the `rowToTvDto` mapper should be updated to populate them.
5. Admin queue idempotency gaps (no state guards, no dedup on submit) should be addressed in the Phase 2 service layer, not by DB constraints alone.

---

## Risks

1. **Duplicate submit rows** — until idempotent upsert is implemented, repeated submits by the same user create multiple rows. The table rendering on the indicators page shows all rows, so users can see duplicates. Low severity for now (MVP queue); becomes confusing as users exercise the form multiple times.
2. **N+1 in admin queue** — `getUserById` called per row; acceptable at small scale. Should be replaced with a JOIN query before the queue exceeds ~50–100 rows in production.
3. **No state guard on grant/revoke** — admin can grant an already-revoked request or revoke an already-expired one. Audit trail is complete so the action is recoverable; no data is lost. Needs a guard before production.
4. **`expiring_soon` not driven in DB** — users with grants close to expiry do not see the warning state until a Phase 2 scheduler extension is deployed. The `expires_at` column is present and the admin queue shows it, so admins can manually see near-expiry cases.

---

## Verification / tests

No new tests written (DESIGN ONLY wave). The following tests are already passing (Phase 1.7):
- In-memory TV service: entitlement fail-closed, grant, revoke (unit, `packages/tradingview-access`)
- DB repo TV functions: `submitTvRequest`, `grantTv`, `revokeTv`, `sweepTvExpiry` (PGlite integration harness)
- E2E: indicators page renders; admin queue grant/revoke flows

Gates NOT RUN this wave: all gates (DESIGN ONLY; no code changed, no test runner invoked).

---

## Next actions

1. **db-architect** — implement migration 0002 with the three priority columns on `tradingview_access_requests` (`revoked_at`, `revoked_by`, `state_updated_at`, `entitlement_id`) plus the partial unique index. Optionally include `tradingview_profiles` and `tradingview_access_grants` if the implementer timeline allows.
2. **tradingview-access-implementer (Phase 2 code wave)** — update `rowToTvDto` to map `revokedAt`/`revokedBy`/`stateUpdatedAt` from the new columns; update `TvRequestDTO`/`TvRequestView` types to include them.
3. **tradingview-access-implementer** — add state guards to `grantTv` and `revokeTv`; add idempotent upsert to `submitTvRequest`.
4. **tradingview-access-implementer** — add reason field to admin revoke action; enrich admin queue with filter/search/summary counts.
5. **tradingview-access-implementer** — implement `expiring_soon` transition in `sweepTvExpiry` (use `entitlement_id` join once migration 0002 lands).
6. **tradingview-access-implementer** — add acknowledgement checkbox to submit form; add cancel-request action.
