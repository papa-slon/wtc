# Handoff: ecosystem-tradingview-access-implementer
**Epoch:** 20260530-1355
**Agent:** ecosystem-tradingview-access-implementer (Phase 2.4 — Workstream E)
**Scope:** Wire atomicGrantTv and atomicRevokeTv into the TV server actions; eliminate the
two-transaction grant gap and the discarded-reason revoke gap identified by the auditor.

---

## Scope

Workstream E — wire `atomicGrantTv`/`atomicRevokeTv` into the TV server actions (single transaction; revoke reason persisted end-to-end; no orphan/divergent state).

## Files inspected

`apps/web/src/features/tv/{actions.ts,queries.ts}`, the TV pages, and `20260530-1355-ecosystem-tradingview-access-auditor.md` + `20260530-1355-ecosystem-db-architect.md`.

## Findings

No new findings — resolved auditor F-02 (two-transaction grant divergence) and F-03 (discarded revoke reason). See the aggregate "Findings → fixes".

## Files changed

| File | Change |
|------|--------|
| `apps/web/src/features/tv/actions.ts` | Replaced `grantTv + createTvGrant` (two-transaction) with single `atomicGrantTv` call; replaced `revokeTv + void _reason` with `atomicRevokeTv` (reason forwarded end-to-end); updated imports; updated JSDoc. No other files touched. |

---

## What was done

### enhancedGrantAction (auditor Finding F-02 resolved)

The former code called `grantTv(db, ...)` then `createTvGrant(db, ...)` as two separate
transactions in sequence. If `createTvGrant` threw, the request row was already `granted`
with no corresponding `tradingview_access_grants` row and no updated profile pointer — a
permanent divergence.

Replaced both calls with a single:
```ts
await atomicGrantTv(
  db,
  { requestId, userId: targetUserId, tvUsername, adminId: actor.id, durationMs, reason },
  now,
);
```
`atomicGrantTv` (implemented in packages/db by the db-architect) performs all four writes in
one `db.transaction`: request status update, grant row insert, profile pointer upsert, and
audit row. All guards preserved: `assertAdmin`, `assertCsrf`, Zod validation, fail-closed
entitlement re-check (`accessFor`), application-level state guard (`GRANTABLE_STATES`),
`DATABASE_URL` fail-closed.

### enhancedRevokeAction (auditor Findings F-02/F-03 resolved)

The former code called `revokeTv(db, requestId, actor.id, Date.now())` with no `reason`
forwarded, and `void _reason` suppressed the validated value. The grant row's `revokedAt`/
`revokeReason` were never stamped; the profile pointer `currentGrantId` was never nulled.

Replaced with:
```ts
await atomicRevokeTv(db, requestId, actor.id, reason, Date.now());
```
`atomicRevokeTv` performs all writes in one `db.transaction`: request status stamp, active
grant lookup by `requestId` (graceful if no grant exists), grant `revokedAt/revokedBy/
revokeReason` stamp, profile pointer null, and audit row with reason in the payload. The
reason is now persisted end-to-end: request row, grant row, and audit row.

### Imports cleaned up

Removed: `grantTv`, `revokeTv`, `createTvGrant` (no longer called by this module).
Added: `atomicGrantTv`, `atomicRevokeTv`.
Retained: `listTvByUser`, `rowToTvDto` (used by the application-level state guard).

### Pages untouched

`apps/web/src/app/(app)/app/indicators/page.tsx` and
`apps/web/src/app/admin/tradingview-access/page.tsx` required no changes. The admin queue
already renders `revokedAt`, `revokedBy`, and the grant history table. The user indicators
page reads `profile.currentGrantId` (now correctly nulled on revoke by `atomicRevokeTv`).
The revokeReason column is not currently surfaced in either UI — that is a separate UX
enhancement (auditor Finding 13) and is out of scope for this workstream.

---

## Decisions

1. The application-level `listTvByUser` state guard in `enhancedGrantAction` is RETAINED as a
   UX early-return (saves a transaction round-trip for the common invalid-state path). The
   authoritative guard is inside `atomicGrantTv` at the DB level. Both the auditor and the
   task spec confirm this dual-guard pattern is correct.

2. The `queries.ts` N+1 fix (`loadTvAdminData` using `listUsersWithEmailByIds`) is NOT in
   scope for this workstream. The db-architect implemented `listUsersWithCreatedAt` (for the
   admin users list), not a TV-specific `listUsersWithEmailByIds`. The N+1 in `loadTvAdminData`
   remains as documented MVP debt.

3. Manual-first copy is preserved in both page files. No automation adapter is wired.
   `FEATURE_TV_AUTOMATION_ADAPTER` stays false (not referenced in these files).

---

## Verification/tests

```
npm run typecheck -w @wtc/web
  → 0 errors, 0 warnings

npm run build -w @wtc/web
  → Compiled successfully in 6.7s; 44 routes; 0 errors; 0 warnings
```

---

## Risks / remaining items

- **N+1 in loadTvAdminData:** `getUserById` per request row is still present in `queries.ts`.
  Fixing this requires a `listUsersWithEmailByIds(db, ids)` repo that the db-architect did not
  implement in Wave 2. Defer to Phase 2.5 or add a targeted repo call.

- **revokeReason not surfaced in UI:** The `revokedBy` UUID is shown in the admin queue table
  (auditor Finding 13 UX issue). The `revokeReason` column on the grant row is not rendered in
  either the admin queue or the user grants history. Surfacing it is a future UX pass.

- **sweepTvExpiry not using atomicRevokeTv:** The worker sweep still calls the deprecated
  `revokeTv` (request-only, no grant stamp). Refactoring sweep to call `atomicRevokeTv` with
  `actorRole: 'system'` is a Phase 2.5 task (tracked in auditor Finding 5 / auditor next action 6).

- **Test coverage:** Six integration tests specified by the auditor (rollback, reason persistence,
  duplicate grant state guard, expired grant audit, admin-visible history, entitlement fail-closed)
  are not yet written. These are assigned to the tests-runner workstream.

---

## Next actions for other agents

**tests-runner (Phase 2.4):** Write `tests/integration/tv-atomic-grant.test.ts` using the six
test specifications from the auditor handoff. The repo functions `atomicGrantTv`,
`atomicRevokeTv`, `submitTvRequest`, `listTvByUser`, `listAllTv`, `listTvGrantsForUser` are all
exported from `@wtc/db` and are exercisable against PGlite.

**TV implementer or db-architect (Phase 2.5):** Add `listUsersWithEmailByIds` to repositories.ts
and wire it into `loadTvAdminData` in `features/tv/queries.ts` to eliminate the N+1.

**Worker implementer (Phase 2.5):** Refactor `sweepTvExpiry` to call `atomicRevokeTv` per row
(with `actorRole: 'system'`, `adminId: null`, `reason: 'scheduler:expiry'`) and deprecate the
`revokeTv` call path in the worker.
