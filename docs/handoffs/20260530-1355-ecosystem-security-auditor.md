# Handoff: ecosystem-security-auditor — Phase 2.4 Read-Only Security Audit

**Epoch:** 20260530-1355
**Agent:** ecosystem-security-auditor
**Wave:** Phase 2.4 — READ-ONLY audit, zero code edits

---

## Scope

Full security audit of the Phase-2.3-landed code as the baseline for Phase-2.4 changes. Covers:

1. Billing manual_review admin flow (approve/reject/resolve) — pipeline analysis for Phase 2.4.
2. Durable webhook ledger — idempotency design, secret/sig/raw-body exclusion verification.
3. TV atomic grant/revoke — two-step atomicity gap, revoke-reason discard, revokeTvGrant wiring.
4. Tortila adapter — fixture/response secrets posture, AdapterNotReadyError leakage, /api/marks proxy boundary.
5. /admin/bots + system-health — secret leakage, legacy plaintext-key path.
6. Audit log page — RBAC enforcement gap.
7. Audit codes inventory — new codes needed for Phase 2.4 actions.
8. Per-mutation pipeline tables (billing manual_review, TV atomic grant/revoke, admin role assign).
9. No-secrets checklist updated for Phase 2.4 surfaces.
10. Regression test spec for all new Phase 2.4 paths.
11. Blockers list.

---

## Files inspected

| File | Lines read |
|---|---|
| `packages/auth/src/rbac.ts` | 1–96 |
| `packages/auth/src/csrf.ts` | 1–32 |
| `apps/web/src/lib/csrf.tsx` | 1–36 |
| `apps/web/src/lib/access.ts` | 1–34 |
| `apps/web/src/lib/backend.ts` | 1–113 |
| `apps/web/src/lib/server-config.ts` | 1–22 |
| `packages/audit/src/audit.ts` | 1–188 |
| `packages/audit/src/redact.ts` | 1–56 |
| `packages/db/src/repositories.ts` | 280–330, 395–480, 730–960 |
| `apps/web/src/features/admin/actions.ts` | 1–127 |
| `apps/web/src/features/admin/queries.ts` | 1–164 |
| `apps/web/src/features/admin/types.ts` | 1–78 |
| `apps/web/src/features/admin/schemas.ts` | 1–36 |
| `apps/web/src/features/tv/actions.ts` | 1–150 |
| `apps/web/src/features/tv/queries.ts` | 1–100 |
| `apps/web/src/features/billing/timeline.ts` | 1–107 |
| `apps/web/src/features/terminal/loader.ts` | 1–114 |
| `apps/web/src/features/bots/meta.ts` | 1–71 |
| `apps/web/src/features/bots/config.ts` | 1–90 |
| `apps/web/src/app/api/billing/webhook/route.ts` | 1–129 |
| `apps/web/src/app/admin/audit-log/page.tsx` | 1–30 |
| `apps/web/src/app/admin/bots/page.tsx` | 1–5 |
| `apps/web/src/app/admin/system-health/page.tsx` | 1–150 |
| `apps/web/src/app/admin/users/page.tsx` | 1–97 |
| `apps/web/src/app/admin/layout.tsx` | 1–40 |
| `apps/web/src/app/admin/support/page.tsx` | 1–206 |
| `apps/web/src/app/admin/entitlements/page.tsx` | 1–197 |
| `apps/web/src/app/admin/tradingview-access/page.tsx` | 1–198 |
| `apps/web/src/app/(app)/app/bots/page.tsx` | 1–111 |
| `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` | 1–196 |
| `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` | 1–137 |
| `packages/bot-adapters/src/types.ts` | 1–69 |
| `packages/bot-adapters/src/http.ts` | 1–128 |
| `packages/bot-adapters/src/control.ts` | 1–19 |
| `packages/bot-adapters/src/warnings.ts` | 1–68 |
| `packages/bot-adapters/src/mock-tortila.ts` | 1–120 |
| `packages/bot-adapters/src/mock-legacy.ts` | 1–87 |
| `packages/bot-adapters/src/factory.ts` | 1–30 |
| `packages/bot-adapters/src/adapters.test.ts` | 1–58 |
| `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md` | all |
| `docs/handoffs/20260530-1145-ecosystem-security-auditor.md` | all |
| `docs/NEXT_ACTIONS.md` | 1–111 |

---

## Files changed

None — read-only audit

---

## Findings

### F-01 — HIGH — Admin audit-log page has no server-side auth check

**Evidence:** `apps/web/src/app/admin/audit-log/page.tsx:1–30` — the entire file contains no call to `requireUser()`, `getCurrentUser()`, `assertAdmin()`, or `isAdmin()`. The audit log page loads `recentAuditEvents()` unconditionally and renders the full audit trail (actor roles, action codes, target types and truncated target IDs) to any unauthenticated caller who requests the route directly.

The admin layout (`apps/web/src/app/admin/layout.tsx:11–14`) does redirect unauthenticated visitors: `const user = await getCurrentUser(); if (!user) redirect('/login'); if (!isAdmin(user)) redirect('/app')`. However, a Next.js layout's redirect does NOT protect a directly-POSTed server action or a direct fetch to the page route from a client that bypasses the layout (e.g., a server-side fetch from another route, or any future RSC streaming context where layout auth is stripped). The `rbac.ts:93–95` comment is explicit: "a layout/render guard does NOT protect a directly-POSTed server action." The same principle applies to a page component that is fetched independently of its layout.

The audit log contains: actor roles, action codes (auth.login_failed, billing.webhook_received, tradingview.grant, admin.action, etc.), target types and truncated target IDs. While no plaintext secrets appear (redact() scrubs them), this is still sensitive operational intelligence.

**Recommendation (Phase 2.4 fix — P0):** Add auth guards directly to the page component, identical to every other admin page:

```typescript
// apps/web/src/app/admin/audit-log/page.tsx — add as the first two lines of the component body
const actor = await requireUser();
assertAdmin(actor.roles);
```

Import `{ requireUser }` from `@/lib/session` and `{ assertAdmin }` from `@wtc/auth`. This is a one-line code fix per the established pattern at every other admin page (system-health, support, users, entitlements, tradingview-access all follow this pattern at lines 7–9).

**Target Workstream:** A (admin operations hardening)

---

### F-02 — HIGH — TV revoke action validates reason field but silently discards it

**Evidence:** `apps/web/src/features/tv/actions.ts:133–148`

```typescript
const { requestId, reason: _reason } = parsed.data;
// ...
await revokeTv(db, requestId, actor.id, Date.now());
// reason is currently not threaded into revokeTv (it writes a fixed audit payload)
void _reason; // satisfies the validated schema; threaded into audit when revokeTv supports it
```

The revoke Zod schema (`revokeSchema` at actions.ts:44–47) requires `reason: z.string().min(3).max(200)`. The reason is validated, extracted, and then thrown away via `void _reason`. The `revokeTv` repo (repositories.ts:307–312) writes the audit row with a fixed `after: { status: 'revoked' }` — no reason field. The `tradingview_access_grants` table has a `revokeReason` column (confirmed by the `revokeTvGrant` repo at repositories.ts:794); it is never populated by the current revoke path.

This means the admin-visible audit trail (`tv_access.revoke`) and the grant table both lack the reason that the admin typed and the form validated. Forensic review of revoke decisions is therefore impossible from the audit log.

**Note:** This was a known Phase-2.3 follow-up (documented in the Phase-2.3 aggregate at line 92). Phase 2.4 must address it.

**Recommendation (Phase 2.4 fix — P1):**

Step 1 — add optional `reason?` param to `revokeTv` in repositories.ts:
```typescript
export async function revokeTv(
  db: Db, requestId: string, adminId: string, now = Date.now(), reason?: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'revoked', revokedAt: new Date(now), revokedBy: adminId })
      .where(eq(s.tradingviewAccessRequests.id, requestId));
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: adminId, actorRole: 'admin',
      action: 'tradingview.revoke',
      targetType: 'tradingview_access_request', targetId: requestId,
      after: { status: 'revoked', reason: reason ?? null }
    }, now));
  });
}
```

Step 2 — thread `reason` from `enhancedRevokeAction`:
```typescript
await revokeTv(db, requestId, actor.id, Date.now(), reason);
```

Step 3 — also wire `revokeTvGrant` for the grant-table row: the action must look up the active grant for this request (via `listTvGrantsForUser` filtered by `requestId`) and call `revokeTvGrant(db, grant.id, actor.id, reason)` inside the same server action after `revokeTv` completes. The `revokeTvGrant` repo already accepts `reason?` and writes it to `tradingview_access_grants.revokeReason`.

**Pipeline table for TV revoke (Phase 2.4 target):**

| Step | Implementation |
|---|---|
| requireUser | `const actor = await requireUser()` |
| assertAdmin | `assertAdmin(actor.roles)` |
| assertCsrf | `await assertCsrf(formData)` |
| Zod | `revokeSchema.safeParse(...)` — requestId UUID + reason min 3 max 200 |
| getServerDb | fail-closed throw if no DATABASE_URL |
| revokeTv | `revokeTv(db, requestId, actor.id, now, reason)` — writes audit with reason |
| lookup grant | `listTvGrantsForUser(db, targetUserId).find(g => g.requestId === requestId && !g.revokedAt)` |
| revokeTvGrant | `revokeTvGrant(db, grant.id, actor.id, reason)` — writes grant table + audit |
| revalidate | `revalidatePath('/admin/tradingview-access')` |

**Target Workstream:** B (TV access ops)

---

### F-03 — HIGH — TV grant uses two separate transactions; a failure between them leaves divergent state

**Evidence:** `apps/web/src/features/tv/actions.ts:99–115`

```typescript
// Step 1: update request status (grantTv writes its own in-txn audit row).
await grantTv(db, requestId, actor.id, now, durationMs);

// Step 2: insert grant row + upsert profile pointer (createTvGrant writes its own in-txn audit row).
// If this fails the request status is already 'granted' — documented as a tracked enhancement
await createTvGrant(db, { ... });
```

`grantTv` commits (sets request.status = 'granted'). If `createTvGrant` then throws (network blip, constraint violation, DB timeout), the `tradingview_access_requests` row is permanently `granted` but no `tradingview_access_grants` row exists. The admin TV page will show the request as granted (with a revoke button) but the grant history table will be empty, and the `tradingview_profiles.currentGrantId` pointer will be null. A subsequent re-grant attempt will fail the state guard (`req.status !== 'pending'`) because the request is now `granted`, making the state unrecoverable without a direct DB fix.

**Note:** This was a known Phase-2.3 follow-up (aggregate handoff line 91: "TV grant two-step atomicity (P1)").

**Recommendation (Phase 2.4 fix — P1):** Create a new atomic grant repo `atomicGrantTv` in repositories.ts that merges both steps in a single transaction:

```typescript
export async function atomicGrantTv(
  db: Db,
  input: {
    requestId: string; userId: string; tvUsername: string;
    adminId: string; durationMs: number; reason: string;
  },
  now = Date.now()
): Promise<TvGrantRow> {
  return db.transaction(async (tx) => {
    // Step 1: update request
    await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'granted', grantedAt: new Date(now), grantedBy: input.adminId, expiresAt: new Date(now + input.durationMs) })
      .where(eq(s.tradingviewAccessRequests.id, input.requestId));
    // Step 2: insert grant row
    const [grant] = await tx.insert(s.tradingviewAccessGrants)
      .values({ requestId: input.requestId, userId: input.userId, tvUsername: input.tvUsername,
                grantedAt: new Date(now), expiresAt: new Date(now + input.durationMs),
                grantedBy: input.adminId, grantedByType: 'admin' })
      .returning();
    if (!grant) throw new Error('failed to insert tv grant');
    // Step 3: upsert profile pointer
    await tx.insert(s.tradingviewProfiles)
      .values({ userId: input.userId, tvUsername: input.tvUsername, currentGrantId: grant.id })
      .onConflictDoUpdate({ target: s.tradingviewProfiles.userId,
                            set: { tvUsername: input.tvUsername, currentGrantId: grant.id, updatedAt: new Date(now) } });
    // Step 4: single combined audit row (or two: one per table change)
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.adminId, actorRole: 'admin',
      action: 'tv_access.grant',
      targetType: 'tradingview_access_grant', targetId: grant.id,
      after: { tvUsername: input.tvUsername, reason: input.reason, durationDays: Math.round(input.durationMs / 86_400_000) }
    }, now));
    return grant;
  });
}
```

Replace the two sequential calls in `enhancedGrantAction` with a single `atomicGrantTv(db, { ... })` call. Retire the separate `grantTv` + `createTvGrant` calls from the grant action path (they remain available for other callers).

**Target Workstream:** B (TV access ops)

---

### F-04 — HIGH — Webhook missing-userId path silently acknowledges 200 with no audit trail or manual_review alert

**Evidence:** `apps/web/src/app/api/billing/webhook/route.ts:88–92`

```typescript
if (!event.userId) {
  return Response.json({ received: true }, { status: 200 });
}
```

When a verified Stripe event carries no resolvable `userId` (metadata field absent or customer.email lookup returns no user), the webhook handler returns 200 (preventing Stripe retries — correct) but writes NO audit row and raises NO alert. The Phase-2.3 aggregate (line 93) acknowledges this: "events without resolvable userId are acknowledged (200, no grant — fail-closed) but no manual_review alert is raised." The PAYMENT_WEBHOOK_STATE_MACHINE.md (line 195) lists `charge.refunded` (partial) and `payment_partially_paid` as manual-review triggers. An unresolvable-userId event is equally ambiguous.

The concern is: a payment may have succeeded for a real user whose email did not match the DB (e.g., case mismatch, alias, Stripe customer not yet linked), and a legitimate entitlement is silently dropped. The only way an operator will notice today is by manually scanning the audit_logs for gaps in `billing.webhook_received` vs `billing.subscription_update` counts — an operational blind spot.

**Recommendation (Phase 2.4 fix — P1):** Before returning 200 on the missing-userId path, write a `billing.webhook_rejected` audit row and optionally a `notifications` row for admin review:

```typescript
if (!event.userId) {
  // Audit the no-op for manual review — this event reached the handler verified but was not applied.
  if (db) {
    await db.insert(schema.auditLogs).values(auditRowValues({
      actorRole: 'system',
      action: 'billing.webhook_rejected',
      targetType: 'billing_event',
      targetId: event.id,
      result: 'failure',
      after: { reason: 'unresolvable_user', eventType: event.type, planCode: event.planCode ?? null }
    }, Date.now()));
    // Optional: create an admin notification for manual_review
    await createNotification(db, {
      userId: SYSTEM_ADMIN_SENTINEL, // a sentinel user ID or a configurable admin user ID
      type: 'billing_manual_review',
      title: 'Webhook event requires manual review',
      body: `Stripe event ${event.id} (${event.type}) could not be applied: no matching user found.`,
    });
  }
  return Response.json({ received: true }, { status: 200 });
}
```

The `billing.webhook_rejected` action code is already in `AUDIT_ACTIONS` (audit.ts:47). The `createNotification` repo (repositories.ts:860–863) is already implemented. The notification recipient must be a real admin user ID (or a configurable sentinel) — NOT `null`.

If a per-user admin notification is not practical, the minimal acceptable fix is the `billing.webhook_rejected` audit row. This makes the gap visible to operators scanning the audit log.

**Target Workstream:** C (billing webhook hardening)

---

### F-05 — MEDIUM — Webhook idempotency is select-then-insert inside a transaction but has no unique constraint on (action, targetId) in audit_logs

**Evidence:** `packages/db/src/repositories.ts:937–940`

```typescript
const [seen] = await tx.select({ id: s.auditLogs.id })
  .from(s.auditLogs)
  .where(and(eq(s.auditLogs.action, 'billing.webhook_received'), eq(s.auditLogs.targetId, input.stripeEventId)))
  .limit(1);
if (seen) return { applied: false, productsChanged: 0 };
```

Inside a serializable transaction, this is safe against concurrent replays from a single DB connection. However, if two webhook deliveries arrive simultaneously (Stripe delivers at-least-once and can send duplicates within milliseconds), two separate DB connections will each see `seen = undefined` before either inserts, then both will proceed to insert the `billing.webhook_received` row and apply the entitlement change twice.

PGlite (the test engine) processes requests serially so this race never manifests in tests. Real Postgres with concurrent connections is susceptible. The standard fix is a DB-level `UNIQUE (action, target_id)` partial index on `audit_logs` scoped to `billing.webhook_received`, but that is a schema change (migration 0003 territory).

The Phase-2.3 security handoff acknowledged this (F-06: "select-then-insert on the audit_logs ledger — no durable unique-key table; concurrent-duplicate weakness"). Phase 2.4 plans a durable webhook events table in migration 0003.

**Recommendation (Phase 2.4 — db-architect):** Migration 0003 must include either:

Option A (preferred): A `billing_webhook_events` table with `event_id VARCHAR PRIMARY KEY` and `processed_at TIMESTAMP`. Replace the `applyStripeEvent` idempotency check with a `billing_webhook_events.event_id` INSERT on conflict do-nothing. This is race-proof at the DB level.

Option B: Add a partial unique index on `audit_logs(target_id) WHERE action = 'billing.webhook_received'`. This avoids a new table but couples the dedupe semantics to the audit schema.

Either option requires a migration. Until then, the current implementation is correct for all non-concurrent cases (Stripe's retry window is typically >1s) and should be labelled explicitly in the route handler comment.

**Target Workstream:** C (billing / db-architect)

---

### F-06 — MEDIUM — Admin support ticket update hardcodes actorRole:'support' in the audit row regardless of whether the actor is an admin

**Evidence:** `packages/db/src/repositories.ts:898`

```typescript
await tx.insert(s.auditLogs).values(auditRowValues({
  actorUserId: actorId,
  actorRole: 'support',    // ← hardcoded; may be 'admin' in practice
  action: 'support.ticket_update',
  ...
}, now));
```

The `updateSupportTicket` repo always writes `actorRole: 'support'` regardless of who calls it. The `adminUpdateTicketAction` (features/admin/actions.ts:101–126) calls `assertAdmin(actor.roles)` — the actor is therefore always an admin. But the audit row records them as `support`, which is misleading. If a support agent (without admin role) ever has a separate path to call this repo, their action would also be labelled `support` (correct in that case), but the admin path is wrong today.

The RBAC matrix (rbac.ts:51) grants `manage` on `support_ticket` to both `['support', 'admin']`, so both roles are legitimate callers of a future support-ticket update path. The fix is to pass the actor role from the action, not hardcode it in the repo.

**Recommendation (Phase 2.4 fix — MEDIUM):** Extend `updateSupportTicket` signature:

```typescript
export async function updateSupportTicket(
  db: Db,
  ticketId: string,
  input: { status?: string; priority?: string; assignedTo?: string },
  actorId: string,
  actorRole = 'support',  // optional; default keeps backward compatibility
  now = Date.now()
): Promise<void>
```

In `adminUpdateTicketAction`, call with `actorRole: actor.roles.includes('admin') ? 'admin' : 'support'`. Self-enrollment or any user-facing call to ticket update does not exist today; when it does, the caller passes the correct role.

**Target Workstream:** A (admin operations)

---

### F-07 — MEDIUM — Admin /admin/users N+1 query on createdAt remains (acknowledged Phase-2.3 follow-up)

**Evidence:** `apps/web/src/features/admin/queries.ts:59–65`

```typescript
const usersWithDate = await Promise.all(
  rows.map(async (u) => {
    const [raw] = await db.select({ createdAt: schema.users.createdAt })
      .from(schema.users).where(eq(schema.users.id, u.id)).limit(1);
    return mapToAdminUserView({ ...u, createdAt: raw?.createdAt ?? null });
  }),
);
```

Each user in `listUsers()` triggers a separate `SELECT createdAt FROM users WHERE id = ?` — N queries for N users. The Phase-2.3 aggregate (line 95) acknowledges this: "Admin `/admin/users` N+1 on createdAt — acceptable at MVP scale; `listUsersWithCreatedAt` is a future db-architect repo."

**Recommendation (Phase 2.4 fix — db-architect):** Add `listUsersWithCreatedAt` to `packages/db/src/repositories.ts`:

```typescript
export interface DbUserWithDate extends DbUser {
  createdAt: number | null; // epoch-ms
}
export async function listUsersWithCreatedAt(db: Db): Promise<DbUserWithDate[]> {
  const rows = await db.select().from(s.users).orderBy(desc(s.users.createdAt));
  return Promise.all(rows.map(async (u) => ({
    ...toDbUser(u),
    createdAt: u.createdAt ? u.createdAt.getTime() : null,
  })));
}
```

Then update `loadAdminUsers` to call `listUsersWithCreatedAt(db)` directly, eliminating the Promise.all N+1.

**Target Workstream:** A (admin operations / db-architect)

---

### F-08 — LOW — /admin/bots is a Placeholder; legacy plaintext-key path stays blocked (confirmed correct)

**Evidence:** `apps/web/src/app/admin/bots/page.tsx:1–5` — the page renders a `<Placeholder>` component with the text "Live control stays disabled until the audited adapter ships." No real data is loaded and no secrets are exposed. The `LEGACY_WARNINGS` array (warnings.ts:58–67) includes `legacy_plaintext_keys` with severity `'error'` and the detail explicitly: "WTC must NOT proxy this." The `createHttpLegacyAdapter` (http.ts:94–127) throws `AdapterNotReadyError` for all data methods except health. The health method calls `GET /api_management/` — this endpoint on the legacy bot (:8000) returns a list object, not an individual secret, but the response shape is unverified. The `AdapterNotReadyError` for `getConfig` carries the message "must strip plaintext keys before mapping" — this is the correct block.

**Recommendation (Phase 2.4 — no code change needed):** Confirm this posture is maintained. The admin /admin/bots page must remain a Placeholder until the legacy adapter has an upstream fix (key-stripping or encrypted-vault migration). The `LEGACY_WARNINGS` error card must continue to surface on every bot dashboard that uses the legacy adapter. No regression path should downgrade `legacy_plaintext_keys` severity from `'error'` to `'warning'`.

**Target Workstream:** D (bot read-only adapter — no Phase 2.4 changes required)

---

### F-09 — LOW — /api/marks live-price endpoint: confirmed NOT proxied (correct posture documented)

**Evidence:** Searched all `apps/web/src` for references to `/api/marks`, `marks`, `live.*price`, and `exchange.*price`. Zero matches found in the WTC codebase. The Tortila journal's `/api/marks` endpoint (which returns live BingX cache data) is mentioned only in the orchestrator seed and agent task descriptions as a boundary the WTC adapter must NOT cross. The `createHttpTortilaAdapter` (http.ts:51–92) maps only `/api/health` and stubs everything else with `AdapterNotReadyError`. There is no route, proxy, or fetch call to `/api/marks` anywhere in `apps/web`.

**Confirmed safe:** WTC does not proxy the live-price endpoint. Bot owns the exchange connection. No action required.

**Target Workstream:** D (confirmed no-op)

---

### F-10 — LOW — loadAdminTimeline does not enforce RBAC at the function level (caller-owned; gap documented)

**Evidence:** `apps/web/src/features/billing/timeline.ts:91–95`

```typescript
/**
 * Load the billing timeline for an admin view.
 * Includes actorId + actorType. Callers must verify the caller has admin/support role before
 * invoking this function (RBAC is enforced at the route/action layer, not here).
 */
```

The function is `server-only` (line 1) and its only current caller is the admin entitlements page (`/admin/entitlements/page.tsx`) which does `requireUser() → assertAdmin(actor.roles)` before calling it. This is the correct pattern. However, if a future caller neglects the guard, `loadAdminTimeline` will expose `actorId` and `actorType` fields to unauthorized users.

**Recommendation (Phase 2.4 — documentation):** No code change required for the current callers. However, when Phase 2.4 adds additional admin surfaces that call `loadAdminTimeline`, each caller MUST follow the `requireUser → assertAdmin → call` pattern. The existing JSDoc comment is sufficient warning; add an explicit note in the function to reference the audit field sensitivity:

```typescript
// SECURITY: actorId/actorType are audit-sensitive fields. RBAC must be verified at the route layer.
// Never call this function from a route that has not first called assertAdmin() or equivalent.
```

**Target Workstream:** A (documentation only)

---

## Per-mutation pipeline tables (Phase 2.4 target actions)

### Pipeline 1: Admin manual_review approve/reject/resolve

Proposed Phase 2.4 admin action for billing manual-review entitlement state transitions.

| Step | Implementation |
|---|---|
| requireUser | `const actor = await requireUser()` |
| assertAdmin | `assertAdmin(actor.roles)` — must be first post-session check |
| assertCsrf | `await assertCsrf(formData)` |
| Zod | `z.object({ userId: z.string().uuid(), product: z.string().min(1), action: z.enum(['approve','reject','resolve']), reason: z.string().min(3).max(500) })` |
| getServerDb | fail-closed; no-op in demo mode |
| entitlement read | fetch current entitlement status; fail-closed if not `manual_review` |
| grantProduct/revokeProduct repo | `grantProduct(db, userId, product, now, actor.id, reason)` or `revokeProduct(...)` depending on `action` |
| audit code | `'admin.entitlement_grant'` or `'admin.entitlement_revoke'` (already in AUDIT_ACTIONS) |
| NO auto-grant | If `action=approve` but entitlement is NOT in `manual_review` state, reject with error (never auto-grant ambiguous data) |
| revalidate | `revalidatePath('/admin/entitlements')` |

**Critical rule:** Ambiguous data (webhook with no userId, partial refund, chargeback) must NEVER auto-grant. The approve/reject actions require explicit admin intent with a typed reason. The entitlement state must be confirmed as `manual_review` before any transition is applied.

### Pipeline 2: TV atomic grant (Phase 2.4 target)

| Step | Implementation |
|---|---|
| requireUser | `const actor = await requireUser()` |
| assertAdmin | `assertAdmin(actor.roles)` |
| assertCsrf | `await assertCsrf(formData)` |
| Zod | `grantSchema` (requestId UUID, targetUserId UUID, tvUsername 1–100, reason 3–200, durationDays enum ['30','90','180','365']) |
| entitlement re-check | `accessFor(targetUserId, 'tradingview_indicators')` — fail-closed if not allowed |
| state guard | fetch request, check status in `GRANTABLE_STATES` — throw if not in `{'pending','expiring_soon'}` |
| atomicGrantTv | single transaction: update request + insert grant row + upsert profile pointer + single audit row with reason |
| revalidate | `revalidatePath('/admin/tradingview-access')` |

### Pipeline 3: TV atomic revoke (Phase 2.4 target)

| Step | Implementation |
|---|---|
| requireUser | `const actor = await requireUser()` |
| assertAdmin | `assertAdmin(actor.roles)` |
| assertCsrf | `await assertCsrf(formData)` |
| Zod | `revokeSchema` (requestId UUID, reason 3–200) |
| getServerDb | fail-closed |
| revokeTv+reason | `revokeTv(db, requestId, actor.id, now, reason)` — reason threaded into audit `after` field |
| revokeTvGrant | lookup active grant by requestId, call `revokeTvGrant(db, grant.id, actor.id, reason)` |
| revalidate | `revalidatePath('/admin/tradingview-access')` |

### Pipeline 4: listUsersWithCreatedAt (replacing N+1)

| Step | Implementation |
|---|---|
| Single query | `SELECT * FROM users ORDER BY created_at DESC` mapped through `toDbUser + createdAt.getTime()` |
| mapToAdminUserView | Strip passwordHash; include email (all admin callers have assertAdmin verified) |
| No N+1 | Eliminates `Promise.all` with per-user `SELECT createdAt WHERE id = ?` pattern |

---

## Audit codes needed for Phase 2.4

The following audit codes are already in `AUDIT_ACTIONS` (audit.ts:8–101) and cover Phase 2.4 actions:

| Phase 2.4 action | Existing audit code | Status |
|---|---|---|
| Manual review approve | `admin.entitlement_grant` | CURRENT — reuse |
| Manual review reject/resolve | `admin.entitlement_revoke` | CURRENT — reuse |
| Atomic TV grant | `tv_access.grant` | CURRENT — reuse |
| Atomic TV revoke | `tv_access.revoke` | CURRENT — reuse |
| Webhook missing-userId | `billing.webhook_rejected` | CURRENT — reuse |
| updateSupportTicket (admin) | `support.ticket_update` | CURRENT — reuse |
| Admin user role assign | `admin.user_role_assign` | CURRENT — reserved; not yet implemented |
| Admin user role revoke | `admin.user_role_revoke` | CURRENT — reserved; not yet implemented |
| listUsersWithCreatedAt N+1 fix | N/A (read-only, no audit) | N/A |

**New codes needed for Phase 2.4:**

| Code | Event | Trigger |
|---|---|---|
| `billing.manual_review_flagged` | Webhook event routed to manual review | Missing userId OR partial refund OR chargeback path — distinct from `billing.webhook_rejected` which is for unprocessable events |
| `admin.manual_review_approve` | Admin approves a manual review item | Clearer than reusing `admin.entitlement_grant` when the source is a manual_review escalation |
| `admin.manual_review_reject` | Admin rejects a manual review item | Symmetric to approve |

These three new codes should be added to `AUDIT_ACTIONS` in `packages/audit/src/audit.ts` under an `// --- Phase 2.4 additions ---` comment block. The db-architect must ensure the `auditLogs.action` column accepts them (it is a `varchar` in the schema, not a DB-level enum, so no migration is required).

---

## No-secrets checklist (Phase 2.4 surfaces)

| Surface | Secret type | Check |
|---|---|---|
| `billing.webhook_rejected` audit row | Stripe-Signature / raw body | NOT included — only `eventType`, `reason: 'unresolvable_user'`, `planCode` |
| `billing.manual_review_flagged` audit row | Stripe raw body | NOT included — only event id + type |
| `tv_access.grant` audit row (atomic) | Any secret | Not applicable — tvUsername is public |
| `tv_access.revoke` audit row | Any secret | Not applicable — reason is typed text |
| `admin.entitlement_grant` audit row | Stripe-Signature / payment data | NOT included — only `productCode`, `reason`, `validUntil` |
| `support.ticket_update` audit row | Any PII beyond ticketId | `after: { status, priority, assignedTo }` — no ticket body, no user email |
| `loadAdminUsers` return value | passwordHash | Stripped by `mapToAdminUserView` — confirmed at queries.ts:33–41 |
| `loadAdminTimeline` return value | Exchange keys / secrets | Actor fields are UUID identifiers only — no secret material |
| `BotConfigView.raw` (bot dashboard) | Exchange keys / API secrets | Mock adapters confirmed: raw contains strategy params only (turtle system, RSI/CCI, stages). No key fields present in mock-tortila.ts:79 or mock-legacy.ts:42–49. Real HTTP adapter's `getConfig` throws `AdapterNotReadyError` — never returns raw data. |
| `AdapterNotReadyError.message` | Internal URLs / secrets | Message template: `Real ${productCode} adapter method "${method}" is not verified yet...` — no URL, no key, no secret |
| `/admin/bots` page | Bot exchange keys | Placeholder only — no data loaded, no secret exposure |
| `/admin/system-health` response | DB credentials / env vars | Only boolean flags and counts — no connection string, no secret |
| `loadSystemHealth.webhookHealth` | Stripe event raw body | Only `totalReceived` count and `latestAt` timestamp from filtered audit rows |
| `HealthCheckView.detail` | Secrets in integration_health_checks | `JSON.stringify(hc.detail).slice(0, 120)` — truncated; health check records must never store secrets in detail (design responsibility of the worker) |
| `terminal/loader.ts` JWKS check | `AXIOMA_HANDOFF_SIGNING_KEY` value | Only boolean presence checked: `!!(process.env.AXIOMA_HANDOFF_SIGNING_KEY)` — value never exposed |
| Server-config `botAdapterOptions` | `TORTILA_JOURNAL_BASE_URL` / `LEGACY_BOT_BASE_URL` | Used server-side only to construct adapter; never returned in any client response |

**One gap identified (LOW):**

`HealthCheckView.detail` at `apps/web/src/app/admin/system-health/page.tsx:139` renders `JSON.stringify(hc.detail).slice(0, 120)` directly. If the worker ever writes a health check record with a detail object containing a secret-like key (e.g., `{ connectionString: '...' }`), it would be rendered. The `redact()` function is NOT applied to this field — it is fetched raw from the DB. This is a design responsibility of the worker (which does not yet write real health checks); it must be documented as a constraint.

---

## Regression test spec (Phase 2.4)

### Group A: Admin auth guard (F-01)

**ADMIN-AUTH-001:** GET `/admin/audit-log` (direct route fetch, bypassing layout) without a valid session cookie → must NOT return audit events (currently fails — no page-level guard). After fix: unauthenticated request → redirect to `/login`.

**ADMIN-AUTH-002:** Authenticated non-admin user (`role: 'user'`) requests `/admin/audit-log` → redirect to `/app`.

**ADMIN-AUTH-003:** Authenticated admin user requests `/admin/audit-log` → renders audit event table (200).

### Group B: TV revoke reason (F-02)

**TV-REVOKE-001:** `enhancedRevokeAction` with valid reason "policy violation" → audit row `tv_access.revoke` has `after.reason = 'policy violation'` (currently fails — reason is discarded).

**TV-REVOKE-002:** `enhancedRevokeAction` without reason field → Zod rejects, no DB write.

**TV-REVOKE-003:** `revokeTvGrant` is called for the active grant row when revoke is performed — grant table `revokeReason` column is populated.

### Group C: TV atomic grant (F-03)

**TV-ATOMIC-001:** `atomicGrantTv` succeeds entirely → request.status = 'granted', grant row exists, profile.currentGrantId points to the grant (all in one query, committed atomically).

**TV-ATOMIC-002:** Simulate failure at grant-row insert (mock DB error after request status update) → entire transaction rolls back → request.status remains 'pending', no grant row exists.

**TV-ATOMIC-003:** `enhancedGrantAction` with atomicGrantTv: no intermediate committed state is observable (use PGlite isolation test).

### Group D: Webhook missing-userId audit (F-04)

**WEBHOOK-MISSING-USER-001:** Stripe-verified event with no matching userId → `billing.webhook_rejected` audit row written with `result: 'failure'`, `after.reason: 'unresolvable_user'` (currently fails — no audit row written).

**WEBHOOK-MISSING-USER-002:** After fix, `billing.webhook_rejected` audit row contains ONLY `eventType`, `reason`, `planCode` — NOT the Stripe-Signature or raw body.

**WEBHOOK-MISSING-USER-003:** Response is still 200 (Stripe does not retry) even after the audit write.

### Group E: Idempotency concurrent-duplicate (F-05)

**WEBHOOK-IDEM-001:** Two concurrent `applyStripeEvent` calls with the same `stripeEventId` — only one entitlement update is applied, only one `billing.webhook_received` audit row exists. (Note: this requires a real-Postgres harness with concurrent connections; PGlite is serial and will pass trivially. Mark as NOT RUN without `REAL_POSTGRES_DATABASE_URL`.)

### Group F: Support ticket audit actorRole (F-06)

**SUPPORT-AUDIT-001:** `adminUpdateTicketAction` called by an admin user → audit row `support.ticket_update` has `actorRole = 'admin'` (currently fails — hardcoded 'support').

**SUPPORT-AUDIT-002:** `updateSupportTicket` called directly with `actorRole = 'support'` → audit row has `actorRole = 'support'` (existing behaviour must be preserved as the default).

### Group G: No-secrets regression (all surfaces)

**SECRETS-001:** `billing.webhook_rejected` audit row — assert `after` object keys are a subset of `['reason', 'eventType', 'planCode']`.

**SECRETS-002:** `tv_access.grant` audit row (atomic path) — assert `after` object keys are a subset of `['tvUsername', 'reason', 'durationDays']`.

**SECRETS-003:** `tv_access.revoke` audit row — assert `after` object keys are a subset of `['status', 'reason']`.

**SECRETS-004:** `loadAdminUsers` return value — assert no row has a `passwordHash` field at any nesting level.

**SECRETS-005:** `AdapterNotReadyError` message — assert the string does not contain `TORTILA_JOURNAL_BASE_URL`, `LEGACY_BOT_BASE_URL`, any URL pattern `http://`, or any key-like substring (`api_key`, `secret`, etc.).

**SECRETS-006:** `BotConfigView.raw` from mock adapters — assert no key in the serialized object matches the redact.ts `SECRET_HINTS` list (`secret`, `apikey`, `token`, `authorization`, `credentials`, `sealed`, etc.).

---

## Decisions

1. **Audit-log page F-01 is a P0 blocker.** Every other admin page has an in-page auth guard. The audit-log page is the only exception and it exposes more sensitive operational data than the users list (which is also admin-guarded). Fix is one import + two lines.

2. **TV revoke reason F-02 is confirmed as a Phase-2.4 P1.** The validated reason field is discarded today. No acceptable state — the audit trail must record why access was revoked.

3. **TV grant atomicity F-03 is confirmed as a Phase-2.4 P1.** The two-step implementation leaves an irrecoverable divergent state on failure between steps. The `atomicGrantTv` combined repo is the correct fix.

4. **Webhook missing-userId F-04 is a Phase-2.4 P1.** At minimum, a `billing.webhook_rejected` audit row must be written. An admin notification is strongly recommended. No action taken today (read-only wave).

5. **Webhook concurrent-duplicate F-05 is a Phase-2.4 P2 (db-architect scope).** The select-then-insert pattern is safe for non-concurrent use. Migration 0003 must include a durable dedupe mechanism. PGlite tests will not catch this; only real-Postgres concurrent tests will.

6. **Support ticket actorRole F-06 is a Phase-2.4 P2.** The hardcoded 'support' actorRole in `updateSupportTicket` is misleading when called from the admin path. Fix is a backward-compatible optional param.

7. **No new audit codes are absolutely required to ship Phase 2.4,** but `billing.manual_review_flagged`, `admin.manual_review_approve`, and `admin.manual_review_reject` improve audit trail clarity. They should be added to `AUDIT_ACTIONS` before any Phase 2.4 billing-manual-review action is implemented.

8. **/api/marks proxy boundary is confirmed clean.** No WTC code proxies the Tortila journal's live-price endpoint. Bot owns the exchange connection.

9. **Legacy plaintext-key adapter stays blocked.** `AdapterNotReadyError` on `getConfig` for the legacy adapter is the correct posture. No bypass is present.

10. **`loadAdminTimeline` RBAC is caller-enforced.** Current callers all have `assertAdmin` before invoking it. This is acceptable but must be maintained as a convention. A future support-role timeline view must use `loadUserTimeline` (actor fields omitted) or a separate function with explicit role checking.

---

## Risks

| Risk | Severity | Mitigated by |
|---|---|---|
| audit-log page serves sensitive operational data without auth guard (F-01) | HIGH | Fix required before Phase 2.4 ships; 2-line patch |
| TV revoke reason discarded — audit trail has no revoke rationale (F-02) | HIGH | Phase 2.4 P1 — thread reason through revokeTv + revokeTvGrant |
| TV grant two-step atomicity — irrecoverable divergent state on failure between steps (F-03) | HIGH | Phase 2.4 P1 — atomicGrantTv repo |
| Webhook missing-userId silently 200 — no audit, no alert, potential revenue/access gap (F-04) | HIGH | Phase 2.4 P1 — billing.webhook_rejected row + admin notification |
| Webhook concurrent-duplicate — select-then-insert race under concurrent Stripe delivery (F-05) | MEDIUM | Migration 0003 durable table or partial unique index; real-Postgres harness |
| Support ticket audit actorRole hardcoded 'support' for admin-called updates (F-06) | MEDIUM | Phase 2.4 P2 — optional actorRole param in updateSupportTicket |
| HealthCheckView.detail renders raw DB JSON without redact() — future worker must not write secrets to detail (F in no-secrets checklist) | LOW | Design constraint on worker; no code fix needed today |
| admin N+1 on /admin/users at scale (F-07) | LOW | Phase 2.4 P2 — listUsersWithCreatedAt; acceptable at MVP scale |

---

## Verification/tests

Gates RUN status is assessed from the Phase-2.3 final state. No new gates were run in this read-only wave.

| Gate | Phase-2.3 result | Phase-2.4 impact |
|---|---|---|
| `npm run governance:check` | PASS (14 cited handoffs) | This handoff must be cited in Phase-2.4 aggregate |
| `npm test` (Vitest) | PASS 171/5/176 | Phase 2.4 implementations must add tests per Groups A–G above |
| `npm run secret:scan` | PASS | No new secrets introduced in this wave |
| `npm run build -w @wtc/web` | PASS (44 routes) | No build impact from read-only audit |
| `npm run e2e` | PASS 28/28 | Phase 2.4 must add e2e specs for audit-log page auth guard |
| `db:migrate` / real-PG | NOT RUN (no DATABASE_URL) | F-05 concurrent test requires real-PG |

---

## Next actions

| Priority | Action | Owner | Evidence |
|---|---|---|---|
| P0 | Add `requireUser() → assertAdmin(actor.roles)` to `/admin/audit-log/page.tsx` | admin-implementer | F-01 |
| P1 | Add optional `reason?` param to `revokeTv`; thread from `enhancedRevokeAction`; wire `revokeTvGrant` | db-architect + tv-implementer | F-02 |
| P1 | Create `atomicGrantTv` repo (single transaction for request + grant + profile + audit); replace two-step calls in `enhancedGrantAction` | db-architect | F-03 |
| P1 | Write `billing.webhook_rejected` audit row + createNotification on missing-userId webhook path | billing-implementer | F-04 |
| P1 | Add `billing.manual_review_flagged`, `admin.manual_review_approve`, `admin.manual_review_reject` to AUDIT_ACTIONS | security-auditor (doc-only until implementer adds) | Decisions §7 |
| P2 | Add `billing_webhook_events` table (or partial unique index on audit_logs) to migration 0003 for concurrent-safe idempotency | db-architect | F-05 |
| P2 | Fix `updateSupportTicket` audit actorRole — add optional `actorRole` param; update `adminUpdateTicketAction` to pass actor role | db-architect | F-06 |
| P2 | Add `listUsersWithCreatedAt` repo; update `loadAdminUsers` to eliminate N+1 | db-architect | F-07 |
| P3 | Add regression tests per Groups A–G (ADMIN-AUTH-001/002/003, TV-REVOKE-001/002/003, TV-ATOMIC-001/002/003, WEBHOOK-MISSING-USER-001/002/003, SUPPORT-AUDIT-001/002, SECRETS-001 through SECRETS-006) | tests-runner | Verification/tests |
| P3 | Add e2e spec for audit-log page: unauthenticated → redirects to /login; non-admin → redirects to /app | tests-runner | F-01 |
| NOTE | `HealthCheckView.detail` worker must not write secrets — document in worker task spec | devops-implementer | No-secrets checklist |
