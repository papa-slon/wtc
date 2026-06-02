# tradingview-persistence-auditor — Phase 1.7 / Part B handoff

20260529-2352 — READ-ONLY audit. Goal: precise plan + edit list to DB-wire the EXISTING TradingView
web UI (NOT automation) and decide the manual-workflow tail. Every claim is cited file:line and
confirmed by reading the live file. No file was created or edited except this handoff.

## Scope
DB-wire the EXISTING TradingView web UI onto the already-tested `@wtc/db` TV repositories, exactly
mirroring how the core backend selects DB vs memory and FAILS CLOSED in production. Deliver: (a) an
async TV service/store interface so typecheck catches missing awaits; (b) a DB-backed implementation
over the existing repos; (c) keep the memory implementation as the dev fallback; (d) a backend
selector that uses DB-backed TV when `DATABASE_URL` is set, memory otherwise, fail-closed in
production without `DATABASE_URL`; (e) DTO normalization (DB `Date` → epoch ms, mirroring
`rowToEntitlement`); (f) audit on submit/grant/revoke with NO secrets (confirm TV username is not a
secret); (g) the manual-workflow decision (keep unconsumed revoke tasks vs add a manual mark-done);
(h) badge truthfulness. Out of scope: TradingView automation, live servers/bots/SSH, billing/Axioma,
secrets handling. LMS is a sibling gap, noted only where it shares the same selector wiring.

## Files inspected
- `packages/tradingview-access/src/index.ts` (1-107) — `TvAccessStatus`, `TvAccessRequest`,
  `TvAccessTask`, `TvAccessStore`, `createMemoryTvStore`, `TvAccessService` (submit/grant/revoke/sweep). All SYNC.
- `packages/db/src/repositories.ts` (224-258) — TV repos: `submitTvRequest`, `listTvByUser`,
  `listAllTv`, `grantTv`, `revokeTv`, `sweepTvExpiry`, `TvStatus`, `TvRequest`; plus `rowToEntitlement`
  (102-117) as the DTO template, and `grantProduct`/`revokeProduct` (127-155) as the in-txn-audit template.
- `packages/db/src/schema.ts` (147-165, 217-234) — `tradingviewAccessRequests`,
  `tradingviewAccessTasks`, `jobQueue` (RESERVED).
- `packages/db/src/index.ts` (1-6) — barrel re-exports `* from './repositories.ts'`, so all TV repos
  are already importable as `@wtc/db`.
- `apps/web/src/lib/backend.ts` (1-78) — selector; `guard()`/fail-closed core (16-45); TV/LMS forced
  to memory unconditionally (47-51); `recentAuditEvents` DTO-normalization template (67-77).
- `apps/web/src/lib/demo.ts` (1-218) — memory `tvStore`/`tvService` (72-73), seed (112), `audit` (76).
- `apps/web/src/lib/db-store.ts` (1-107) — how core DB methods are exposed; `db()` lazy singleton
  (32-40); `audit` writer (42-46); `recentAuditRows` (105-107).
- Call sites: `apps/web/src/app/(app)/app/indicators/page.tsx` (1-77),
  `apps/web/src/app/admin/tradingview-access/page.tsx` (1-68), `apps/web/src/app/admin/page.tsx` (1-26).
- `apps/web/src/lib/format.ts` (23-26) — `fmtDate(ms: number | null | undefined)`.
- `packages/shared/src/schemas.ts` (47-54) — `tradingViewUsernameSchema` (proves username is public input).
- `apps/worker/src/index.ts` (1-47), `apps/worker/src/jobs.ts` (1-42) — existing DB TV consumer + memory loop.
- `packages/lms/src/index.ts` (1-107) — sibling sync service (shares the selector gap).

## Files changed
None — read-only audit

## Findings

### 1. TV/LMS services are wired to memory UNCONDITIONALLY — the fail-closed gap (HIGH, Part D)
Evidence: `apps/web/src/lib/backend.ts:47-51`:
```ts
// TradingView + LMS web UI: in-memory this phase (see header note).
export const tvService = memory.tvService;
export const tvStore = memory.tvStore;
export const lmsService = memory.lmsService;
export const lmsStore = memory.lmsStore;
```
The core uses `const useDb = !!process.env.DATABASE_URL` + `guard()` + `denied` (`backend.ts:16-27`) so
a production process without `DATABASE_URL` throws on first core call. TV bypasses all of that: even in
production with `DATABASE_URL` set, TV reads/writes the in-memory store and silently loses data on
restart. This is the single highest-value gap to close.
Recommendation: introduce a DB-backed TV implementation and select it the same way the core does (see
Findings 2-4 and Decisions). The TV exports must become async (Finding 5) and fail-closed in production.

### 2. The DB TV repos already exist, are barrel-exported, and are worker-proven (INFO, Part B)
Evidence: `packages/db/src/repositories.ts:228-258` defines `submitTvRequest(db, userId, username, now=Date.now()) → Promise<TvRequest>`,
`listTvByUser(db, userId) → Promise<TvRequest[]>`, `listAllTv(db) → Promise<TvRequest[]>`,
`grantTv(db, requestId, adminId, now, durationMs) → Promise<void>`,
`revokeTv(db, requestId, _adminId, _now) → Promise<void>`,
`sweepTvExpiry(db, now=Date.now()) → Promise<{expired; tasksQueued}>`. `packages/db/src/index.ts:5`
re-exports `* from './repositories.ts'`, so they import as `@wtc/db` today. `apps/worker/src/index.ts:15-21`
already calls `sweepTvExpiry` against a real `createDb(url)`. So Part B is "add a thin app-layer
adapter + selector", NOT "build repos".
Note the exact row type (`TvRequest = typeof s.tradingviewAccessRequests.$inferSelect`,
`repositories.ts:226`) — see Finding 6 for its column set, which is narrower than the memory interface.

### 3. The TV repos do NOT write audit rows; grant/revoke also DROP the actor + timestamp (HIGH, Part F)
Evidence: contrast the entitlement repos, which audit IN THE SAME TRANSACTION —
`repositories.ts:143` (`tx.insert(s.auditLogs).values(auditRowValues({... action: 'product.grant' ...}))`)
and `:153` (`product.revoke`) — against the TV repos, which write none:
- `submitTvRequest` (`:228-232`) — pure insert, no audit.
- `grantTv` (`:239-241`) — `set({ status:'granted', grantedAt, grantedBy: adminId, expiresAt })`, no audit.
- `revokeTv` (`:242-244`): `async function revokeTv(db, requestId, _adminId, _now)` →
  `set({ status: 'revoked' })`. The `_adminId` and `_now` are accepted and THROWN AWAY (leading `_`),
  so a DB revoke records neither who revoked nor when.
Today the memory web UI audits TV actions only implicitly via the shared in-memory audit sink, and in
fact `indicators/page.tsx`/`tradingview-access/page.tsx` call `tvService.*` directly with NO
`audit.write` at all — so even in memory, TV submit/grant/revoke produce no audit events.
Recommendation (Part F): the new app-layer DB adapter (Finding 4) must call `backend.audit.write(...)`
for `tradingview.request.submit`, `tradingview.access.grant`, `tradingview.access.revoke`. Audit payload
carries ONLY non-secret fields: `targetType: 'tradingview_request'`, `targetId: requestId`, and `after`
limited to `{ status, tradingViewUsername }` for submit and `{ status, expiresAt }`/`{ status }` for
grant/revoke. (Username is public input — see Finding 7 — so it is safe in audit.) Because the repo's
`revokeTv` discards the actor, the audit row written by the adapter is the ONLY record of who revoked;
state that explicitly. Stronger option for a later phase: add `revokedAt/revokedBy` columns (Finding 6)
and push the audit insert into the repo txn to match grant/revokeProduct — but that is a schema change
(Part C/migration), so keep it as a documented follow-up, not Phase 1.7.

### 4. No app-layer DB TV adapter exists; one must be added mirroring db-store.ts (HIGH, Part B)
Evidence: `apps/web/src/lib/db-store.ts:1-107` exposes core DB methods by wrapping `@wtc/db` repos
around a lazy `db()` singleton (`:32-40`) and re-using the app `audit` writer pattern (`:42-46`). There
is no equivalent for TV — `db-store.ts` exports nothing TV-related (confirmed by reading the whole file).
`backend.ts` therefore has no DB TV symbol to select even if it wanted to.
Recommendation: add a NEW file `apps/web/src/lib/tv-store.ts` exporting a memory `tvBackend` and a DB
`tvBackend` behind the shared async interface (Finding 5). Keep it separate from `db-store.ts` so the
core file stays focused; `backend.ts` imports both and selects. Proposed DB adapter (uses the same lazy
`db()` accessor — re-export it from `db-store.ts` or inline an identical singleton):
```ts
// apps/web/src/lib/tv-store.ts  (NEW FILE — DB-backed adapter)
import 'server-only';
import {
  submitTvRequest as rSubmit, listTvByUser as rListByUser, listAllTv as rListAll,
  grantTv as rGrant, revokeTv as rRevoke, type TvRequest,
} from '@wtc/db';
import type { AuditWriter } from '@wtc/audit';
import type { TvService, TvRequestView } from './tv-types'; // the async interface, Finding 5
import { db } from './db-store';                            // export `db` from db-store.ts (or duplicate)

// DTO: DB Date -> epoch ms, mirroring rowToEntitlement (repositories.ts:102-117). Finding 8.
function rowToTvView(r: TvRequest): TvRequestView {
  const v: TvRequestView = {
    id: r.id, userId: r.userId, tradingViewUsername: r.tradingViewUsername,
    status: r.status as TvRequestView['status'], requestedAt: r.requestedAt.getTime(),
  };
  if (r.grantedAt) v.grantedAt = r.grantedAt.getTime();
  if (r.grantedBy) v.grantedBy = r.grantedBy;
  if (r.expiresAt) v.expiresAt = r.expiresAt.getTime();
  return v; // NOTE: schema has no revokedAt/revokedBy columns — see Finding 6
}

export function createDbTvService(audit: AuditWriter): TvService {
  return {
    async submitRequest(userId, username, hasEntitlement, now) {
      if (!hasEntitlement) throw new Error('No active tradingview_indicators entitlement'); // mirror service:59
      const r = await rSubmit(db(), userId, username, now);
      await audit.write({ actorUserId: userId, actorRole: 'user', action: 'tradingview.request.submit',
        targetType: 'tradingview_request', targetId: r.id, after: { status: r.status, tradingViewUsername: username } });
      return rowToTvView(r);
    },
    async grant(requestId, adminId, now, durationMs) {
      await rGrant(db(), requestId, adminId, now, durationMs);
      await audit.write({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.access.grant',
        targetType: 'tradingview_request', targetId: requestId, after: { status: 'granted', expiresAt: now + durationMs } });
    },
    async revoke(requestId, adminId, now) {
      await rRevoke(db(), requestId, adminId, now);
      // repo discards adminId/now (Finding 3) — this audit row is the ONLY record of who revoked.
      await audit.write({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.access.revoke',
        targetType: 'tradingview_request', targetId: requestId, after: { status: 'revoked' } });
    },
    async listByUser(userId) { return (await rListByUser(db(), userId)).map(rowToTvView); },
    async listAll() { return (await rListAll(db())).map(rowToTvView); },
  };
}
```
The submit fail-closed check is duplicated from `TvAccessService.submitRequest` (`index.ts:58-59`); the
existing UI already gates with `access.allowed` (`indicators/page.tsx:18`), so the check is defence-in-depth.

### 5. The service/store API is SYNC, so missing awaits will NOT be caught — define an async interface (HIGH, Part A)
Evidence: `packages/tradingview-access/src/index.ts:30-37` (`TvAccessStore` methods return `void`/`T`,
not Promises) and `:54-106` (`submitRequest`/`grant`/`revoke`/`sweep` all return synchronously). The web
UI relies on that: `indicators/page.tsx:32` `const requests = tvStore.list().filter(...)` (no await),
`:18` `tvService.submitRequest(...)` (no await); `admin/tradingview-access/page.tsx:33`
`const requests = tvStore.list()` (no await), `:16` `tvService.grant(...)`, `:24` `tvService.revoke(...)`;
`admin/page.tsx:7` `tvStore.list({ status: 'pending' }).length` (no await). If the DB impl is dropped
behind the SAME sync types, every call site returns an unawaited `Promise` and silently breaks (`.filter`
on a Promise, `.length` on a Promise) with NO typecheck error.
Recommendation (Part A): define an app-level ASYNC interface in a new `apps/web/src/lib/tv-types.ts` and
type both impls to it, so `next build`/`tsc` flags the four call sites above as needing `await`:
```ts
// apps/web/src/lib/tv-types.ts  (NEW FILE)
export type TvStatus = 'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked';
export interface TvRequestView {
  id: string; userId: string; tradingViewUsername: string; status: TvStatus;
  requestedAt: number;            // epoch ms (never a Date — Finding 8)
  grantedAt?: number; grantedBy?: string; expiresAt?: number;
  // revokedAt/revokedBy intentionally OMITTED — no DB columns back them (Finding 6)
}
export interface TvService {
  submitRequest(userId: string, username: string, hasEntitlement: boolean, now: number): Promise<TvRequestView>;
  grant(requestId: string, adminId: string, now: number, durationMs: number): Promise<void>;
  revoke(requestId: string, adminId: string, now: number): Promise<void>;
  listByUser(userId: string): Promise<TvRequestView[]>;
  listAll(): Promise<TvRequestView[]>;
}
```
Note this collapses today's `tvService` + `tvStore` split into ONE async `TvService` (the UI only ever
needs submit/grant/revoke + two list reads; the raw `TvAccessStore` CRUD is not needed in the web layer).
Do NOT change `packages/tradingview-access` itself — it is the worker's sync memory model and is verified;
the async boundary belongs in the app layer.

### 6. DB schema lacks revokedAt/revokedBy that the memory model has — DTO + type divergence (MEDIUM, Part C)
Evidence: memory `TvAccessRequest` declares `revokedAt?: number; revokedBy?: string`
(`tradingview-access/src/index.ts:17-18`) and `revoke()` sets both (`:82`). The DB table has only
`grantedAt`/`grantedBy`/`expiresAt` and NO revoke columns (`schema.ts:148-157`), so
`TvRequest = $inferSelect` has no `revokedAt`/`revokedBy`. Two consequences: (a) any DTO that copies
`revokedAt`/`revokedBy` from a DB row will not typecheck — the app `TvRequestView` (Finding 5) must omit
them; (b) the prior 1921 handoff's "`requestedAt(number)` vs DB `Date`" mismatch is CONFIRMED and is the
general case: every DB timestamp (`requestedAt` via `createdAt()` `schema.ts:153`; `grantedAt`,
`expiresAt`) is a JS `Date` and MUST be `.getTime()`-mapped (Finding 8), not just `requestedAt`.
Recommendation: for Phase 1.7, OMIT `revokedAt`/`revokedBy` from `TvRequestView` and rely on the audit
row (Finding 3) for the revoke actor/timestamp. Document a follow-up (Part C) to add
`revoked_at`/`revoked_by` columns + make `revokeTv` populate them and audit in-txn, matching
`revokeProduct`. Do NOT silently leave the memory interface's revoke fields implying DB parity.

### 7. TV username is PUBLIC input, not a secret — safe in audit + DTO (INFO, Part F)
Evidence: `packages/shared/src/schemas.ts:47-53` validates `username` as a 2-30 char `[A-Za-z0-9_]+`
public handle; it is rendered in plaintext at `indicators/page.tsx:56` and
`admin/tradingview-access/page.tsx:51`, and seeded literally as `'demo_trader_99'` (`demo.ts:112`). It
is NOT routed through the vault (contrast `addExchangeKey` sealing in `demo.ts:204` / `db-store.ts:91`).
Recommendation: confirm in the audit payload (Finding 3) that `tradingViewUsername` is fine to record;
do NOT treat it like exchange key material. No redaction needed (and `buildEvent` redaction
`repositories.ts:194` is only a backstop).

### 8. fmtDate expects epoch ms; a raw DB Date would mis-render — normalize at the boundary (HIGH, Part E)
Evidence: `apps/web/src/lib/format.ts:23-26` — `fmtDate(ms: number | null | undefined)` does
`new Date(ms).toISOString()`. Render sites (1921 cited indicators:53-54 / admin:49 — verified, the live
lines are):
- `indicators/page.tsx:58` `{fmtDate(r.requestedAt)}` and `:59` `{fmtDate(r.expiresAt ?? null)}`.
- `admin/tradingview-access/page.tsx:53` `{fmtDate(r.expiresAt ?? null)}`.
Today these get `number` from the memory model (`index.ts:13,16`). If the DB row's `Date` reached
`fmtDate`, `new Date(Date)` happens to work but typechecking against `number` would fail, and passing a
`Date` to the client violates the "no Date object leaks to the client" rule (Server→Client serialization).
Recommendation (Part E): do ALL Date→ms mapping in `rowToTvView` (Finding 4), exactly mirroring
`rowToEntitlement` (`repositories.ts:102-117`) and the existing `recentAuditEvents` map
(`backend.ts:71` `ts: r.ts.getTime()`). The pages then keep passing `number` to `fmtDate` unchanged —
only the data source flips. No change to `format.ts`.

### 9. Three pages call TV sync today and must each gain awaits + use the selected service (MEDIUM, Part B/E)
Evidence and exact edits:
- `indicators/page.tsx:32`: `const requests = tvStore.list().filter((r) => r.userId === user.id);`
  → `const requests = await tvService.listByUser(user.id);` (server-side filter; import `tvService` only,
  drop `tvStore` from `:4`). `:18` `tvService.submitRequest(...)` → `await tvService.submitRequest(...)`.
- `admin/tradingview-access/page.tsx:33`: `const requests = tvStore.list();` →
  `const requests = await tvService.listAll();` (drop `tvStore` from `:2`). `:16`
  `tvService.grant(...)` → `await tvService.grant(...)`; `:24` `tvService.revoke(...)` →
  `await tvService.revoke(...)`. Note `rows` building (`:34`) already `await`s `getUserById` per row —
  fine, keep.
- `admin/page.tsx:7`: `const pendingTv = tvStore.list({ status: 'pending' }).length;` →
  `const pendingTv = (await tvService.listAll()).filter((r) => r.status === 'pending').length;`
  (drop `tvStore` from `:2`). The async interface (Finding 5) drops the `{status}` filter arg, so filter
  in the page. (`backendMode` at `admin/page.tsx:17` is already correct and needs no change.)
Recommendation: the async interface (Finding 5) makes `tsc` flag exactly these; do all three together.

### 10. Badges hardcode "storage: in-memory (demo)" unconditionally — must become backend-aware (MEDIUM, Part E)
Evidence (exact file:line for each badge):
- `indicators/page.tsx:39` `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>` and the
  `:40` copy "This view is not yet DB-persisted — requests reset on restart (TV/LMS DB wiring is Phase 1.5)."
- `admin/tradingview-access/page.tsx:40` `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>`
  and `:41` copy "…the web UI is NOT yet wired to them — Postgres wiring deferred (Part E)."
These are unconditional and become FALSE under `DATABASE_URL`.
Recommendation (Part E): drive the badge off `backendMode` (already exported, `backend.ts:29`; already
imported/used in `admin/page.tsx:2,17`). Replace each with:
```tsx
{backendMode === 'postgres'
  ? <StatusPill tone="ok">storage: Postgres</StatusPill>
  : <StatusPill tone="warn">storage: in-memory (dev)</StatusPill>}
```
and gate the "resets on restart / not yet wired" copy behind `backendMode !== 'postgres'`. Keep a
TRUTHFUL warn badge for the memory fallback — do NOT remove it outright (that would lie in dev). Mirrors
the existing truthful pattern in `admin/page.tsx:17`.

### 11. Memory impl must be retained as dev fallback + keep the seed working (LOW, Part B/D)
Evidence: `demo.ts:62,72-73` build the memory `tvStore`/`tvService` on `globalThis`; `demo.ts:112`
`tvService.submitRequest(user.id, 'demo_trader_99', true, now)` is SYNC inside `doSeed`. If the app
interface goes async, the dev fallback must adapt the existing sync `TvAccessService` to the async
`TvService` (a trivial `async` wrapper returning the sync result), and the seed call should be made
`await`-able (or left sync since the underlying memory service stays sync). Do NOT delete the memory
path — `backendMode === 'memory'` (no `DATABASE_URL`) still needs it for `next build` and dev.
Recommendation: in `apps/web/src/lib/tv-store.ts`, also export `createMemoryTvService()` that wraps
`memory.tvService`/`memory.tvStore` (from `demo.ts`) in the async `TvService` shape (await-free bodies),
so both impls satisfy Finding 5's interface and the selector just picks one.

### 12. LMS shares the identical selector gap (INFO, Part D — flagged, not in scope to fix here)
Evidence: `backend.ts:50-51` forces `lmsService`/`lmsStore` to memory unconditionally; `packages/lms/src/index.ts:61-106`
is fully sync like TV. The DB layer has `courses`/`lessons`/`materials` tables (`schema.ts:168-194`) but
NO LMS repositories in `repositories.ts` (confirmed — only TV/entitlement/exchange/audit repos exist).
Recommendation: LMS is the larger Part-C/Part-? decision (it needs repos written first); call it out so
the operator does not assume Part B closes LMS too. This handoff fixes ONLY TradingView.

## Decisions
- DECISION (Part B/A): collapse the web layer's `tvService` + `tvStore` into ONE async `TvService`
  interface (Finding 5). The web UI only needs submit/grant/revoke + listByUser/listAll; exposing the
  raw store CRUD async-wise is unnecessary surface. The worker keeps using the sync
  `packages/tradingview-access` model unchanged.
- DECISION — manual-workflow tail (Part G, item g): KEEP the "queued but unconsumed" revoke tasks
  exactly as they are; do NOT add a manual mark-done/cancel in Phase 1.7. Rationale: `sweepTvExpiry`
  already inserts `tradingview_access_tasks` rows on expiry (`repositories.ts:254`) and the worker calls
  it (`apps/worker/src/index.ts:19`), but NOTHING consumes those task rows — there is no dequeue anywhere
  (grep of `tradingviewAccessTasks` shows only schema + the two writers; `listTasks` exists only on the
  memory store `index.ts:36,48` and is unused by the web UI). The honest state is "revoke against
  TradingView is a MANUAL admin action; the task row is a reminder/audit marker, not an executed job."
  Adding a mark-done button now would imply a workflow that the absence of any real TradingView-side
  revoke does not support, and risks signalling the `job_queue` is live (it is RESERVED, `schema.ts:217-221`).
  WHAT TO DOCUMENT: in the admin TV page copy and in `docs/TRADINGVIEW_ACCESS_PLAN.md`, state plainly:
  "revoke is performed manually in TradingView by an admin; expiry sweeps mark the request `expired` and
  record a revoke task as a to-do marker; the task is informational and there is no automated executor."
  A manual-only mark-done/cancel is a reasonable Phase 1.8 follow-up ONCE a real revoke step exists — log
  it as a TARGET, not a Phase 1.7 deliverable.
- DECISION (Part F): write audit rows from the NEW app-layer DB adapter via `backend.audit.write` rather
  than editing the repos, because pushing audit into the TV repo txns requires also fixing the
  actor-dropping `revokeTv` and (ideally) adding revoke columns — that is a schema/Part-C change. The
  adapter-level audit is correct and shippable now; the in-txn version is a documented follow-up.
- DECISION (Part C, deferred): do NOT add `revoked_at`/`revoked_by` columns in Phase 1.7. Omit them from
  the DTO and lean on audit. Record the column addition + `revokeTv` rewrite as the next schema task.

## Risks
- Missing-await regressions: dropping a DB impl behind the CURRENT sync types would compile and then
  fail at runtime (`.filter`/`.length` on a Promise). Mitigation: land the async interface (Finding 5)
  FIRST so `tsc`/`next build` forces the await edits in Finding 9 before the selector flips.
- Silent data loss persists until selector wired: as long as `backend.ts:48-49` point at memory, a
  production deploy with `DATABASE_URL` still loses TV data on restart and is NOT fail-closed. Treat
  Finding 1 as the gating item.
- Audit completeness: until the repo-level fix (Finding 3/6), the revoke actor/time exist ONLY in the
  app-layer audit row; if a future caller bypasses the adapter and hits `revokeTv` directly, the actor is
  lost. Document that the adapter is the only sanctioned write path.
- DTO leak: any new TV code path that returns a raw `TvRequest` (with `Date`s) to a client component
  re-introduces the Date-serialization problem. Mitigation: funnel ALL reads through `rowToTvView`.
- Scope creep: LMS (Finding 12) and the `job_queue` consumer (Finding/Decision g) are tempting to bundle;
  both are out of Part B and would balloon the change.

## Verification/tests
(Operator to run — this auditor did not run anything.)
- Typecheck-as-guard: after adding the async interface and BEFORE editing pages, `tsc`/`next build` MUST
  error at `indicators/page.tsx:18,32`, `admin/tradingview-access/page.tsx:16,24,33`, `admin/page.tsx:7`.
  That error set IS the proof Finding 5 works; it should disappear once Finding 9 edits land.
- Fail-closed parity: with `NODE_ENV=production` and no `DATABASE_URL`, a TV submit/grant/revoke/list MUST
  throw the same class of error as the core `guard()` (`backend.ts:24-26`), not silently use memory.
- DB path: with `DATABASE_URL` set, submit then reload `/app/indicators` and `/admin/tradingview-access`
  across a process restart — the request MUST persist (it does today only because the worker writes; now
  the web UI must too). Confirm `tradingview_access_requests` row created and an `audit_logs` row with
  `action='tradingview.request.submit'` and NO secret material.
- DTO: assert no value passed to `fmtDate` is a `Date` (all `number|null`); grant then verify
  `expiresAt` renders as a YYYY-MM-DD via `fmtDate` (`format.ts:25`).
- Badge: with `DATABASE_URL` set, both pages show "storage: Postgres"; without it, "storage: in-memory (dev)".
- Existing PGlite TV repo integration tests still green (the repos are unchanged); no new repo behavior to test.

## Next actions
1. (Part A) Add `apps/web/src/lib/tv-types.ts` with the async `TvStatus`/`TvRequestView`/`TvService`
   from Finding 5 (omit revoke fields, all timestamps `number`).
2. (Part B) Add `apps/web/src/lib/tv-store.ts` exporting `createDbTvService(audit)` (Finding 4) and
   `createMemoryTvService()` (Finding 11); export the lazy `db()` from `db-store.ts` for reuse.
3. (Part D) In `apps/web/src/lib/backend.ts`, replace lines 47-49: select the DB TV service when
   `useDb`, the memory one otherwise, wrapped in the SAME `guard()`/`denied` fail-closed logic as the
   core; export a single async `tvService: TvService`. Leave `lmsService`/`lmsStore` as-is (Finding 12)
   with an updated comment that ONLY TV is now DB-wired.
4. (Part B/E) Apply the await + service-call edits in Finding 9 to the three pages; remove now-unused
   `tvStore` imports.
5. (Part F) Confirm the adapter writes the three audit actions with non-secret payloads (Finding 3/7).
6. (Part E) Make both badges backend-aware per Finding 10 (`indicators/page.tsx:39-40`,
   `admin/tradingview-access/page.tsx:40-41`).
7. (Part G) Update admin TV page copy + `docs/TRADINGVIEW_ACCESS_PLAN.md` to document the manual revoke +
   informational task per the Decision; do NOT add a mark-done button this phase.
8. (Part C, follow-up TARGET) Log: add `revoked_at`/`revoked_by` columns, rewrite `revokeTv` to populate
   them + audit in-txn (match `revokeProduct`), and DB-wire LMS (write LMS repos first). Not Phase 1.7.
