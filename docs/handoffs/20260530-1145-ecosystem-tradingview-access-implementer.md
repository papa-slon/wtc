## Scope

Phase 2.3 visible-progress wave — TradingView access enrichment. Three sub-parts:

A. USER /app/indicators — enrich with profile, enriched request table (all 6 columns), and grant
   history; keep existing submit flow + manual-first copy.
B. ADMIN /admin/tradingview-access — enrich with status summary counts, per-row full details
   (grantedAt/grantedBy/revokedAt/revokedBy), grant history from listAllTvGrants; keep manual-first
   copy; honest statement that tasks are informational/unconsumed.
C. ENHANCED grant/revoke — required reason + duration selector (30/90/180/365) + state guard
   (only pending/expiring_soon may be granted) + fail-closed entitlement re-check
   (accessFor(userId,'tradingview_indicators').allowed) at grant time + createTvGrant call (populates
   tradingview_access_grants); revoke with validated reason. Both actions: assertCsrf + assertAdmin
   + Zod + in-txn audit (via repos).

## Files inspected

- `apps/web/src/app/(app)/app/indicators/page.tsx` — prior user page
- `apps/web/src/app/admin/tradingview-access/page.tsx` — prior admin page
- `apps/web/src/lib/backend.ts` — getServerDb(), tvService, backendMode
- `apps/web/src/lib/access.ts` — accessFor, reasonLabel, reasonTone
- `apps/web/src/lib/db-store.ts` — DB-backed tvService adapter
- `apps/web/src/lib/tv-types.ts` — TvService interface, TvRequestView
- `apps/web/src/lib/csrf.tsx` — CsrfField, assertCsrf
- `apps/web/src/lib/session.ts` — requireUser
- `apps/web/src/lib/format.ts` — fmtDate
- `packages/db/src/repositories.ts` — all TV repos: listTvByUser, listAllTv, grantTv, revokeTv,
  createTvGrant, listTvGrantsForUser, listAllTvGrants, getTvProfile, getUserById, rowToTvDto,
  TvRequestDTO, TvProfileRow, TvGrantRow
- `packages/db/src/index.ts` — re-exports all from repositories.ts
- `packages/auth/src/rbac.ts` — assertAdmin
- `packages/ui/src/components.tsx` — Card, SectionHeader, StatusPill, MetricCard, EmptyState
- `apps/web/src/features/lms/queries.ts` — reference pattern for features/* loaders

## Files changed

- `apps/web/src/features/tv/queries.ts` (NEW)
- `apps/web/src/features/tv/actions.ts` (NEW)
- `apps/web/src/app/(app)/app/indicators/page.tsx` (updated)
- `apps/web/src/app/admin/tradingview-access/page.tsx` (updated)

## Findings

1. All required repos (getTvProfile, listTvGrantsForUser, listAllTvGrants, createTvGrant,
   getUserById, rowToTvDto, TvProfileRow, TvGrantRow) exist in @wtc/db and are exported from
   packages/db/src/index.ts via `export * from './repositories.ts'`.

2. The prior admin page used tvService.listAll() (in-memory or DB-backed) and getUserById from
   lib/backend.ts. The new admin page uses loadTvAdminData() from features/tv/queries.ts which
   calls getServerDb() directly and calls the repos — consistent with the LMS pattern.

3. revokeTv in repositories.ts writes a fixed audit payload (no reason param exposed). Reason is
   validated in the action but cannot be forwarded to the audit row yet. Tracked below as a
   future enhancement.

4. The two-step grant (grantTv + createTvGrant) is not atomic across both calls — each has its
   own in-txn audit. If createTvGrant fails after grantTv succeeds, the request row is 'granted'
   but the grants table has no row. This is a known architectural trade-off; the working grant
   flow is preserved and the enhancement is tracked below.

5. enhancedRevokeAction shows the revoke form only for status=granted|expiring_soon (state guard
   at render time). The grant form shows only for status=pending|expiring_soon. Both match
   GRANTABLE_STATES logic in the action.

## Decisions

- features/tv/queries.ts follows the LMS pattern (import 'server-only', getServerDb(), explicit
  null->demo fallback, no fabricated data). No changes to repositories.ts.
- features/tv/actions.ts uses 'use server' inline (matching the indicators page pattern) for the
  server actions; they import from features/tv/actions rather than being defined in the page.
- The existing tvService.submitRequest flow in indicators/page.tsx is preserved intact.
- The prior tvService.grant/revoke in admin page are replaced by enhancedGrantAction /
  enhancedRevokeAction which add reason, duration, state guard, and entitlement re-check.
- MetricCard used for summary counts (already in @wtc/ui); no new UI primitives needed.
- reasonTone imported and used in indicators page for the entitlement status pill in submit form.

## Risks

1. Two-step grant atomicity: grantTv succeeds -> createTvGrant fails -> request is 'granted' but
   no grant row exists. Fix: wrap both in a single DB transaction at the repo level (requires a
   new combined repo or a transaction-aware refactor in repositories.ts). Owned by db-architect.

2. revokeTv reason forwarding: the reason param from the action form is validated but discarded
   because revokeTv in repositories.ts does not accept a reason. Fix: add an optional `reason?`
   param to revokeTv (alongside revokedAt/revokedBy) so the audit payload captures it. Owned by
   db-architect.

3. enhancedRevokeAction does not call revokeTvGrant (which nulls the profile pointer and stamps
   the grant row). It only calls revokeTv (request status). This means the grants table row may
   remain un-revoked even after the request is revoked via this action. The full revoke path
   (revokeTvGrant) requires the grantId, not the requestId. Fix: look up the active grant by
   requestId in the action and call revokeTvGrant. Tracked enhancement.

4. In-memory (demo) mode: loadTvAdminData returns empty demo lists when getServerDb() is null.
   The page shows the honest "storage: in-memory (demo)" pill and empty states. No fabricated data.

## Verification/tests

Self-verify commands run:

- `npm run typecheck -w @wtc/web` -> PASS (clean exit, no output)
- `npm run build -w @wtc/web` -> PASS (31/31 static pages, all routes compile, no type errors)

Build output shows both enriched routes:
- `/admin/tradingview-access` (ƒ dynamic)
- `/app/indicators` (ƒ dynamic)

## Next actions

1. db-architect: add optional `reason?` param to `revokeTv` in repositories.ts so the revoke
   action can forward the validated reason to the audit payload.

2. db-architect: add a combined atomic `grantTvWithRecord(db, requestId, adminId, now, durationMs,
   tvUsername)` repo that wraps both grantTv and createTvGrant in a single transaction.

3. ecosystem-tradingview-access-implementer: wire revokeTvGrant into enhancedRevokeAction by
   looking up the active grant row by requestId before calling revoke.

4. ecosystem-tests-runner: add unit tests for loadTvUserData, loadTvAdminData, enhancedGrantAction
   (state guard, entitlement re-check), and enhancedRevokeAction (reason validation).
