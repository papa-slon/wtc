# Handoff: ecosystem-frontend-implementer-admin

**Timestamp:** 2026-05-30 11:45 UTC  
**Slug:** ecosystem-frontend-implementer-admin  
**Agent role:** ecosystem-frontend-implementer (admin console)

---

## Scope

Admin console surface work for Phase 2.3 Visible-Progress Wave:

- T1: `/admin/users` — real user list via `listUsers`, mapped to `AdminUserView` (no `passwordHash`)
- T2: `/admin/system-health` — backend mode, safety-disabled states, webhook health, TV queue counts, integration health checks
- T3: `/admin/support` (NEW route) — admin triage with status-update server action
- T4: `/admin/entitlements` — grant now requires `reason` + optional `validUntil`; revoke requires `reason`; product-access timeline via `loadAdminTimeline`

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/DESIGN_SYSTEM.md`
- `apps/web/src/app/admin/users/page.tsx` (was Placeholder)
- `apps/web/src/app/admin/system-health/page.tsx` (was Placeholder)
- `apps/web/src/app/admin/entitlements/page.tsx` (existing, extended)
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/tradingview-access/page.tsx` (pattern reference)
- `apps/web/src/app/admin/audit-log/page.tsx` (pattern reference)
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/lib/format.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/features/billing/timeline.ts`
- `apps/web/src/features/support/data.ts`
- `apps/web/src/features/tv/queries.ts`
- `packages/auth/src/rbac.ts`
- `packages/auth/src/index.ts`
- `packages/db/src/repositories.ts` (grantProduct/revokeProduct/listSupportTickets/updateSupportTicket signatures confirmed)
- `packages/db/src/schema.ts` (integrationHealthChecks table confirmed at line 243)
- `packages/db/src/index.ts`
- `packages/ui/src/index.ts`
- `packages/ui/src/components.tsx`

---

## Files changed

**New files:**
- `apps/web/src/features/admin/types.ts` — DTOs: AdminUserView, SystemHealthSnapshot, AdminTicketView, etc.
- `apps/web/src/features/admin/queries.ts` — Server-only loaders: loadAdminUsers, loadSystemHealth, loadAdminSupport
- `apps/web/src/features/admin/schemas.ts` — Zod schemas: ticketUpdateSchema, grantProductSchema, revokeProductSchema
- `apps/web/src/features/admin/actions.ts` — Server actions: adminGrantProductAction, adminRevokeProductAction, adminUpdateTicketAction
- `apps/web/src/app/admin/support/page.tsx` — NEW route

**Modified files:**
- `apps/web/src/app/admin/users/page.tsx` — Full implementation (was Placeholder)
- `apps/web/src/app/admin/system-health/page.tsx` — Full implementation (was Placeholder)
- `apps/web/src/app/admin/entitlements/page.tsx` — Added reason + validUntil inputs; threaded into new actions; added timeline

---

## Findings

1. **`grantProduct` signature in repositories.ts** (line 128): `grantProduct(db, userId, productCode, now=Date.now(), actorUserId?, reason?, validUntil?)` — confirmed all optional trailing params added by db-architect.

2. **`revokeProduct` signature** (line 164): `revokeProduct(db, userId, productCode, now=Date.now(), actorUserId?, reason?)` — confirmed.

3. **`integrationHealthChecks` schema table** (line 243): `{ id, target, status, detail, checkedAt }` — no dedicated repo function; the task spec explicitly says to do a direct SELECT in features/admin using getServerDb() + schema table.

4. **`listSupportTickets` repo** (line 881): supports `{ userId?, status?, assignedTo? }` filter — used directly in loadAdminSupport.

5. **`updateSupportTicket` repo** (line 891): audits `support.ticket_update` in-txn; supports `{ status?, priority?, assignedTo? }` patch.

6. **db-store.ts `grantProduct`/`revokeProduct`** wrappers (lines 99-104) don't pass reason/validUntil/actorUserId through to the DB repo. Admin actions therefore call the DB repo directly via `getServerDb()` to use the new optional params (fallback to backend wrapper in demo mode).

7. **`recentAuditEvents` in @wtc/db** (repositories.ts line 244) takes `(db, limit)` — used directly in system-health loader for webhook health counting.

8. **ADMIN_NAV in nav.ts** does not include `/admin/support` — devops owns nav.ts per task instructions. The route is functional via direct URL. Dev note below.

---

## Decisions

1. **`AdminUserView` strips `passwordHash`** in `mapToAdminUserView()` — F-12/F-13 security requirement. The function is in features/admin/queries.ts (not in a React page) and is the only place DbUser is consumed in this surface.

2. **Direct DB repo calls in actions** — admin actions call `@wtc/db` `grantProduct`/`revokeProduct` directly (via dynamic import + `getServerDb()`) to pass `actorUserId`, `reason`, and `validUntil`. The lib/backend wrappers don't expose these params and are only used as a demo-mode fallback.

3. **System health: safety-disabled states are hardcoded truths** — `liveControlDisabled = true` and `tvAutomationDisabled = true` are always shown as policy facts (not read from DB). This matches the safety boundary: no runtime flag changes these.

4. **Integration health checks: direct SELECT** — per task spec, no new repo function was added; `features/admin/queries.ts` does `db.select().from(schema.integrationHealthChecks)` directly using the exported schema table from `@wtc/db`.

5. **Support page: status filter via URL query param** — filter links use `?status=open` etc.; the filter is read from `searchParams` prop (Next.js 15 async form, typed as `Promise<Record<string, string | string[] | undefined>>`).

6. **`'use server'` placement** — build error caught during initial attempt: the directive must be the first line of the file. Fixed by moving it before the block comment. All subsequent builds succeed.

7. **nav.ts not modified** — devops-owned per task instructions. `/admin/support` route is accessible via direct URL and from the admin console. The task says devops owns nav.

---

## Risks

1. **ADMIN_NAV missing `/admin/support`** — the route works but is not linked in the sidebar. Devops agent must add `{ href: '/admin/support', label: 'Support' }` to `ADMIN_NAV` in `apps/web/src/lib/nav.ts`.

2. **`createdAt` on DbUser**: The `listUsers` repo returns `DbUser` which omits `createdAt` (it is in the schema row but not in the DTO). The loader does a secondary per-user SELECT to get `createdAt` from `schema.users`. This is N+1 and could be slow for large user lists. For MVP it is acceptable; a joined `listUsersWithCreatedAt` repo function is the correct fix.

3. **demo-mode grant/revoke reason silently ignored** — when DATABASE_URL is not set, the backend wrapper is called without reason/validUntil. This is honest (demo mode is not persistent) but the user sees no feedback about the omission. Production always calls the DB repo directly.

4. **`listSupportTickets` in `features/admin/queries.ts` uses a dynamic import** — `const { listSupportTickets } = await import('@wtc/db')` — this is consistent and tree-shakes correctly in Next.js, but it could instead be a top-level import. Kept dynamic to avoid circular-import risk; can be changed to static import at the top of the file with no behavior change.

---

## Verification/tests

**typecheck:**
```
npm run typecheck -w @wtc/web
EXIT: 0  (clean)
```

**build:**
```
npm run build -w @wtc/web
✓ Compiled successfully in 6.2s
✓ 32/32 static pages generated
EXIT: 0  (clean)
```

**Routes confirmed in build output:**
- `ƒ /admin/users` — dynamic (server-rendered)
- `ƒ /admin/system-health` — dynamic
- `ƒ /admin/support` — dynamic (NEW)
- `ƒ /admin/entitlements` — dynamic

**State coverage per screen:**

| Screen | loading | empty | error | disabled | storage pill |
|--------|---------|-------|-------|----------|--------------|
| `/admin/users` | n/a (async RSC) | EmptyState | n/a | read-only notice | yes |
| `/admin/system-health` | n/a | EmptyState (health checks) | n/a | safety flags shown | yes |
| `/admin/support` | n/a | EmptyState | n/a | closed-ticket guard | yes |
| `/admin/entitlements` | n/a | EmptyState | n/a | form validation | yes |

---

## Next actions

1. **Devops agent**: Add `{ href: '/admin/support', label: 'Support' }` to `ADMIN_NAV` in `apps/web/src/lib/nav.ts`.
2. **db-architect (future)**: Add `listUsersWithCreatedAt` repo to avoid N+1 in admin users loader.
3. **Phase 3 / migration 0003**: Support ticket replies (`support_ticket_replies` table) for full admin response flow.
4. **Future**: Role mutation (promote/demote) UI in `/admin/users` — currently read-only per MVP scope.
