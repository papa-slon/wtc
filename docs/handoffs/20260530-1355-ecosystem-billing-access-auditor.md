# Handoff: ecosystem-billing-access-auditor
**Epoch:** 20260530-1355
**Agent:** ecosystem-billing-access-auditor (Workstream D)
**Scope:** Billing/webhook hardening audit — Phase 2.4 read-only wave

---

## Scope

Workstream D audit delivering:
1. Durable `billing_webhook_events` ledger table design for migration 0003 with UNIQUE `(provider, event_id)` key; exact INSERT-then-conflict idempotency flow replacing the current select-then-insert.
2. Concurrent-duplicate test design.
3. Webhook upsert of subscription rows (`upsertSubscription` wiring path).
4. `manual_review` path: missing/unresolvable userId or ambiguous provider data — fail-closed, audit row, admin-visible review item table/shape. Never auto-grant on ambiguous data.
5. Admin approve/reject/resolve actions: RBAC + CSRF + Zod + entitlement fail-closed + audit, with exact repo signatures.
6. Whether Stripe test-mode checkout can be wired without a live charge path, or stays TARGET with the blocker documented.

---

## Files inspected

- `apps/web/src/app/api/billing/webhook/route.ts` (128 lines)
- `packages/billing/src/webhook.ts` (70 lines)
- `packages/billing/src/stripe.ts` (68 lines)
- `packages/billing/src/provider.ts` (75 lines)
- `packages/billing/src/index.ts` (12 lines)
- `packages/db/src/repositories.ts` (lines 1–247, 700–961 — full billing/entitlement section)
- `packages/db/src/schema.ts` (605 lines — full schema read)
- `apps/web/src/features/admin/actions.ts` (127 lines)
- `apps/web/src/features/admin/schemas.ts` (36 lines)
- `apps/web/src/features/admin/queries.ts` (164 lines)
- `apps/web/src/features/admin/types.ts` (78 lines)
- `apps/web/src/app/admin/entitlements/page.tsx` (197 lines)
- `docs/CONTRACTS/billing-webhooks.md` (483 lines)
- `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md` (395 lines)
- `docs/ENTITLEMENT_STATE_MACHINE.md` (543 lines)
- `docs/BILLING_PROVIDER_PLAN.md` (579 lines)
- `docs/handoffs/20260530-1145-ecosystem-billing-access-auditor.md` (476 lines — prior epoch)
- `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md` (aggregate, lines 1–100)

---

## Files changed

None — read-only audit

---

## Findings

### Finding 1 — HIGH — Current idempotency is select-then-insert: concurrent duplicate delivery can double-process (Workstream D)

**Evidence:** `packages/db/src/repositories.ts:938-940`:
```typescript
const [seen] = await tx.select({ id: s.auditLogs.id }).from(s.auditLogs)
  .where(and(eq(s.auditLogs.action, 'billing.webhook_received'), eq(s.auditLogs.targetId, input.stripeEventId)))
  .limit(1);
if (seen) return { applied: false, productsChanged: 0 };
await tx.insert(s.auditLogs).values(auditRowValues({ ... }));
```
Within a single Postgres transaction the SELECT and the INSERT are serialized at the transaction level. However, two concurrent webhook deliveries of the same event can both reach the SELECT with no existing row (the first transaction has not yet committed), and both will INSERT and both will proceed to apply state transitions. The `audit_logs` table has no UNIQUE constraint on `(action, targetId)` — schema.ts:204-222 shows only `actorIdx` and `actionIdx` general indices, no unique compound index. PostgreSQL does not prevent two transactions from each seeing an empty result on the same SELECT before either commits.

**Recommendation:** Replace this pattern with a dedicated `billing_webhook_events` table having a UNIQUE `(provider, event_id)` key and using INSERT-then-detect-conflict. See Decisions section for the exact table definition and flow. This is the core Phase 2.4 hardening item.

### Finding 2 — HIGH — Missing userId acknowledged 200 with no manual_review alert (Workstream D)

**Evidence:** `apps/web/src/app/api/billing/webhook/route.ts:89-91`:
```typescript
if (!event.userId) {
  return Response.json({ received: true }, { status: 200 });
}
```
When the Stripe event carries no `userId` in metadata (missing `meta.userId`, `meta.user_id`, and `obj.client_reference_id` — see `packages/billing/src/stripe.ts:60-63`), the route returns 200 without writing any audit row, without creating a notification, and without flagging the event for admin resolution. The contract at `docs/CONTRACTS/billing-webhooks.md:116` explicitly requires: "If `wtc_user_id` is absent from metadata on a paid event, the webhook handler transitions to `manual_review` and alerts admin." The Phase 2.3 aggregate acknowledged this as a P2 follow-up (`docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md:93`).

**Recommendation:** See Decisions section §4 for the exact `manual_review` path design: a `billing_manual_review_items` table, an audit row, and an admin notification. Never auto-grant on ambiguous data.

### Finding 3 — HIGH — `upsertSubscription` is never called from the webhook handler (Workstream D)

**Evidence:** `apps/web/src/app/api/billing/webhook/route.ts` calls only `applyStripeEvent`. `applyStripeEvent` at `packages/db/src/repositories.ts:932-961` writes to `entitlements` and `product_access_events` and the `audit_logs` idempotency row, but never calls `upsertSubscription`. The `subscriptions` table therefore has no rows written by the webhook path — only the demo `mockPurchase` action and any future checkout-session handler would write it. A subscription row is the durable record of the provider relationship (`providerRef`, `currentPeriodEnd`, `status`), needed for admin diagnostics, cancellation, and reconciliation.

**Evidence of `upsertSubscription` at `packages/db/src/repositories.ts:910-923`:** the function exists and handles the select-then-insert problem in a simpler form, but it is not wired to any webhook call path.

**Recommendation:** Wire `upsertSubscription` inside `applyStripeEvent` (or in the route handler before calling `applyStripeEvent`) when a `providerRef` is determinable from the event data. See Decisions section §3 for exact conditions and call site.

### Finding 4 — HIGH — No admin-visible `manual_review` item table or review queue surface (Workstream D)

**Evidence:** The admin entitlements page at `apps/web/src/app/admin/entitlements/page.tsx` exposes grant, revoke, and the product-access timeline (via `loadAdminTimeline`). There is no concept of a review item — no table storing "ambiguous webhook events needing admin resolution", no page section listing them, no approve/reject actions specifically for webhook-originated `manual_review` cases.

The `billing_manual_review_items` table described in `docs/CONTRACTS/billing-webhooks.md:409` (Gap 3) and `docs/ENTITLEMENT_STATE_MACHINE.md:52-53` ("Admin clears manual_review (approve) → active; Admin clears manual_review (reject) → revoked") has no implementation. The admin actions file at `apps/web/src/features/admin/actions.ts` contains only `adminGrantProductAction`, `adminRevokeProductAction`, and `adminUpdateTicketAction` — no `flagReviewAction`, `approveReviewAction`, `rejectReviewAction`.

**Recommendation:** Add the `billing_manual_review_items` table to migration 0003 (see Decisions §4) and the three admin resolution actions (see Decisions §5).

### Finding 5 — HIGH — `applyStripeEvent` also uses select-then-upsert on entitlements under a race (Workstream D)

**Evidence:** `packages/db/src/repositories.ts:943-953`:
```typescript
const [existing] = await tx.select().from(s.entitlements)
  .where(and(eq(s.entitlements.userId, input.userId), eq(s.entitlements.productCode, productCode)))
  .limit(1);
// ...
const [row] = await tx.insert(s.entitlements).values({...})
  .onConflictDoUpdate({ target: [s.entitlements.userId, s.entitlements.productCode], set: {...} })
  .returning({ id: s.entitlements.id });
```
The entitlement UPSERT itself is safe because the unique index `entitlements_user_product_idx` on `(userId, productCode)` at `packages/db/src/schema.ts:86` means the `onConflictDoUpdate` resolves correctly even under concurrency. However, the `fromState` captured at line 943 may be stale if two transactions race. This is secondary to Finding 1 (the idempotency dedup should prevent concurrent processing of the same event), but once the dedup is hardened, the stale `fromState` risk is mitigated since the same event is only processed once.

**Recommendation:** Document that the entitlement UPSERT is safe under concurrency (conflict target is a DB-enforced unique index). The primary fix is Finding 1 (durable event ledger). No additional change to the entitlement UPSERT is required.

### Finding 6 — MEDIUM — `upsertSubscription` uses select-then-insert without a unique key (Workstream D)

**Evidence:** `packages/db/src/repositories.ts:913-923`:
```typescript
if (input.providerRef) {
  const [existing] = await db.select().from(s.subscriptions)
    .where(and(eq(s.subscriptions.userId, input.userId), eq(s.subscriptions.provider, input.provider),
               eq(s.subscriptions.providerRef, input.providerRef)))
    .limit(1);
  if (existing) { /* update */ }
}
const [row] = await db.insert(s.subscriptions).values({...}).returning();
```
The `subscriptions` table in `packages/db/src/schema.ts:89-98` has no unique constraint on `(userId, provider, providerRef)`. Two concurrent calls with the same `providerRef` will both pass the SELECT and both INSERT, creating duplicate subscription rows.

**Recommendation:** Add a unique index `UNIQUE (user_id, provider, provider_ref)` on `subscriptions` in migration 0003. Drizzle definition: `(t) => ({ uniqUserProviderRef: uniqueIndex('subscriptions_user_provider_ref_idx').on(t.userId, t.provider, t.providerRef) })`. Then change `upsertSubscription` to use `INSERT ... ON CONFLICT (user_id, provider, provider_ref) DO UPDATE SET ...` instead of select-then-insert. This is additive (nullable `provider_ref` rows that already have `null` in the column still work — the unique index must be a partial index `WHERE provider_ref IS NOT NULL`).

### Finding 7 — MEDIUM — No `billing_manual_review_items` table or repo function for admin review queue (Workstream D)

**Evidence:** The schema at `packages/db/src/schema.ts` contains no `billing_manual_review_items` table. The `docs/CONTRACTS/billing-webhooks.md:207-223` references a `webhook_idempotency_keys` table (TARGET-only). There is no table for tracking unresolvable webhook events requiring admin triage, despite the state machine spec explicitly requiring it.

**Recommendation:** Add `billing_manual_review_items` table to migration 0003 (see Decisions §4 for exact column set). Add repo functions `createManualReviewItem`, `listManualReviewItems`, `resolveManualReviewItem` (see Decisions §5 for signatures).

### Finding 8 — MEDIUM — Admin entitlements page has no resolve/approve/reject for `manual_review` state (Workstream D)

**Evidence:** `apps/web/src/app/admin/entitlements/page.tsx` renders grant and revoke forms. Entitlements in `manual_review` state show with `tone('manual_review') = 'bad'` (via `evaluateStatus`) but there is no action to approve (→ `active`) or reject (→ `revoked`) a specific `manual_review` entitlement. The schemas file at `apps/web/src/features/admin/schemas.ts` has no `resolveReviewSchema`, `flagReviewSchema`.

**Recommendation:** Add three server actions (see Decisions §5): `adminFlagReviewAction`, `adminApproveReviewAction`, `adminRejectReviewAction`. Add corresponding Zod schemas. Add UI controls on the entitlements page for entitlements in `manual_review` state (approve/reject buttons with reason field).

### Finding 9 — MEDIUM — Stripe test-mode checkout: exact env requirements and blocker (Workstream D)

**Evidence:** `packages/billing/src/stripe.ts:38-45`:
```typescript
async createCheckout(): Promise<CheckoutSession> {
  if (!opts.secretKey) {
    throw new BillingProviderNotConfiguredError('Stripe checkout requires STRIPE_SECRET_KEY');
  }
  throw new BillingProviderNotConfiguredError(
    'Stripe Checkout Session creation is not wired yet — see docs/BILLING_PROVIDER_PLAN.md (live call pending)',
  );
},
```
`createCheckout` unconditionally throws even when `STRIPE_SECRET_KEY` is present. The Stripe SDK call (`stripe.checkout.sessions.create`) is not wired — the function body throws before making any network call. The webhook reception path (signature verification, `parseWebhook`, `applyStripeEvent`) is fully real and requires only `STRIPE_WEBHOOK_SECRET`.

**Recommendation:** Document the exact requirements (see Decisions §6). The webhook path is production-ready with only `STRIPE_WEBHOOK_SECRET`. The checkout creation path requires additional work before any Stripe test-mode end-to-end test can run.

### Finding 10 — LOW — `billing.webhook_received` audit rows do not record `provider` name (Workstream D)

**Evidence:** `packages/db/src/repositories.ts:940`:
```typescript
await tx.insert(s.auditLogs).values(auditRowValues({
  actorUserId: input.userId, actorRole: 'system',
  action: 'billing.webhook_received',
  targetType: 'billing_event', targetId: input.stripeEventId,
  after: { billingEvent: input.billingEvent, planCode: input.planCode ?? null }
}, now));
```
The audit row records `stripeEventId` as `targetId` and `billingEvent`/`planCode` in `after`, but does not record the provider name (always `'stripe'` today, but `'crypto'` or `'manual'` in future). When multiple providers are active, audit trails cannot distinguish provider-originated events without parsing the `stripeEventId` prefix.

**Recommendation:** Add `provider: 'stripe'` (or the actual provider name) to the `after` JSONB payload of the `billing.webhook_received` audit row. This is a non-schema change (JSONB field addition). Also persist `provider` in `billing_webhook_events` table (see Decisions §1).

### Finding 11 — LOW — `billing_webhook_events.processed_at` vs TTL design in `docs/CONTRACTS/billing-webhooks.md` (Workstream D)

**Evidence:** `docs/CONTRACTS/billing-webhooks.md:209-222` specifies `webhook_idempotency_keys` with an `expires_at` column (processed_at + 90 days) for TTL-based cleanup. The audit_logs ledger (as-built) has no TTL column. The new `billing_webhook_events` table must specify TTL behavior.

**Recommendation:** The `billing_webhook_events` table should include `expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')` for future cleanup. Add an index on `expires_at` to support a worker cleanup job. See Decisions §1 for the full table definition.

---

## Decisions

### Decision 1 — Durable `billing_webhook_events` ledger (migration 0003)

This table replaces the `audit_logs` select-then-insert idempotency pattern. It provides a UNIQUE `(provider, event_id)` key that enables INSERT-then-detect-conflict, eliminating the concurrent-duplicate window.

**Drizzle schema definition (packages/db/src/schema.ts — addendum for migration 0003):**

```typescript
// --- Billing: durable webhook event ledger (migration 0003) ---
// Replaces the audit_logs select-then-insert idempotency check in applyStripeEvent.
// UNIQUE (provider, event_id) is the single source of truth for "was this event processed?".
// Insert returns the new row on first delivery; ON CONFLICT DO NOTHING returns nothing on replay.
// Caller checks rows-returned to detect duplicate: 0 rows = duplicate, skip processing.
export const billingWebhookEvents = pgTable(
  'billing_webhook_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),        // 'stripe' | 'crypto' | 'manual'
    eventId: text('event_id').notNull(),          // provider event id (evt_xxx)
    eventType: text('event_type').notNull(),      // e.g. 'checkout.session.completed'
    userId: uuid('user_id'),                      // NULL when userId was unresolvable
    planCode: text('plan_code'),                  // NULL when planCode was absent/unknown
    billingEvent: text('billing_event'),          // mapped BillingEvent or NULL for no-op types
    status: text('status').notNull(),             // 'applied' | 'no_op' | 'manual_review' | 'error'
    productsChanged: integer('products_changed').notNull().default(0),
    // 90-day TTL for eventual cleanup; worker job prunes rows where expires_at < NOW()
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .$defaultFn(() => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // The enforcer: concurrent duplicate deliveries INSERT simultaneously;
    // exactly one wins, the rest get a unique-violation and return 0 rows (ON CONFLICT DO NOTHING).
    uniqProviderEvent: uniqueIndex('bwe_provider_event_idx').on(t.provider, t.eventId),
    expiresIdx: index('bwe_expires_at_idx').on(t.expiresAt),
    userIdx: index('bwe_user_id_idx').on(t.userId),
  }),
);
```

**Raw SQL for migration 0003 (minimal, additive):**

```sql
CREATE TABLE billing_webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  user_id       UUID REFERENCES users(id),          -- nullable: unresolvable userId events
  plan_code     TEXT,
  billing_event TEXT,
  status        TEXT NOT NULL,
  products_changed INTEGER NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '90 days',
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX bwe_provider_event_idx ON billing_webhook_events (provider, event_id);
CREATE INDEX bwe_expires_at_idx ON billing_webhook_events (expires_at);
CREATE INDEX bwe_user_id_idx ON billing_webhook_events (user_id);
```

**The INSERT-then-detect-conflict idempotency flow:**

This flow REPLACES the `SELECT ... FROM audit_logs WHERE action='billing.webhook_received' AND targetId=...` pattern in `applyStripeEvent`.

```typescript
// NEW repo function: packages/db/src/repositories.ts

export type BillingWebhookEventStatus = 'applied' | 'no_op' | 'manual_review' | 'error';

export interface InsertWebhookEventResult {
  isDuplicate: boolean;
  rowId: string | null; // null only on duplicate (ON CONFLICT DO NOTHING returns no rows)
}

/**
 * Attempt to record a webhook event for the first time.
 * Uses INSERT ... ON CONFLICT (provider, event_id) DO NOTHING.
 * Returns isDuplicate=true if the event was already recorded (concurrent or prior delivery).
 * MUST be called OUTSIDE the entitlement-mutation transaction so that the duplicate
 * check commits atomically before any state is mutated (prevents the ABA problem where
 * a failed txn leaves no record and the retry re-runs the check on an already-committed row).
 */
export async function insertWebhookEventOnce(
  db: Db,
  input: {
    provider: string;
    eventId: string;
    eventType: string;
    userId: string | null;
    planCode: string | null;
    billingEvent: string | null;
    status: BillingWebhookEventStatus;
    productsChanged?: number;
  },
): Promise<InsertWebhookEventResult> {
  const rows = await db
    .insert(s.billingWebhookEvents)
    .values({
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      userId: input.userId ?? null,
      planCode: input.planCode ?? null,
      billingEvent: input.billingEvent ?? null,
      status: input.status,
      productsChanged: input.productsChanged ?? 0,
    })
    .onConflictDoNothing()   // <-- KEY: unique violation → DO NOTHING → 0 rows returned
    .returning({ id: s.billingWebhookEvents.id });
  if (rows.length === 0) {
    return { isDuplicate: true, rowId: null };
  }
  return { isDuplicate: false, rowId: rows[0]!.id };
}

/**
 * Update the status of a previously-inserted webhook event row.
 * Called after the entitlement transaction completes to record the final outcome.
 */
export async function updateWebhookEventStatus(
  db: Db,
  provider: string,
  eventId: string,
  status: BillingWebhookEventStatus,
  productsChanged: number,
): Promise<void> {
  await db
    .update(s.billingWebhookEvents)
    .set({ status, productsChanged })
    .where(and(eq(s.billingWebhookEvents.provider, provider), eq(s.billingWebhookEvents.eventId, eventId)));
}
```

**Updated `applyStripeEvent` flow (revised signature for db-architect):**

The existing `applyStripeEvent` in `repositories.ts:932` must be refactored. The idempotency check moves OUT of the function and into the route handler, with `insertWebhookEventOnce` called first. `applyStripeEvent` then focuses solely on entitlement mutation and audit.

Revised route handler flow in `apps/web/src/app/api/billing/webhook/route.ts`:

```typescript
// Step 7 (replacing the current applyStripeEvent call):

// 7a. Attempt to record this event — concurrent duplicates are resolved by the DB unique index.
const dedup = await insertWebhookEventOnce(db, {
  provider: 'stripe',
  eventId: event.id,
  eventType: event.type,
  userId: event.userId ?? null,
  planCode: event.planCode ?? null,
  billingEvent: billingEvent,   // may be null for no-op event types
  status: 'applied',            // optimistic; updated after the txn
  productsChanged: 0,
});

if (dedup.isDuplicate) {
  // Exact duplicate delivery — idempotent no-op. HTTP 200 so Stripe stops retrying.
  return Response.json({ received: true }, { status: 200 });
}

// 7b. Apply entitlement transitions in a separate transaction.
try {
  const result = await applyStripeEventTransitions(db, {
    billingEvent, userId: event.userId!, productCodes, planCode: event.planCode,
  });
  // 7c. Update the ledger row with the final outcome.
  await updateWebhookEventStatus(db, 'stripe', event.id, 'applied', result.productsChanged);
  return Response.json({ received: true }, { status: 200 });
} catch (err) {
  // 7d. On failure, mark the ledger row as error so it is visible in admin audit.
  // The row EXISTS (inserted in 7a), so the next retry will see isDuplicate=true
  // UNLESS we delete the row on failure. Decision: DELETE on error so retries re-process.
  await db.delete(s.billingWebhookEvents)
    .where(and(eq(s.billingWebhookEvents.provider, 'stripe'), eq(s.billingWebhookEvents.eventId, event.id)));
  const msg = err instanceof Error ? err.message : String(err);
  if (process.env.NODE_ENV !== 'production') console.error('[billing/webhook] DB error', event.id, msg);
  return Response.json({ error: 'internal_error', message: 'Webhook processing failed. Event will be retried.' }, { status: 500 });
}
```

**Critical: the INSERT must be outside the entitlement transaction.** If `insertWebhookEventOnce` and the entitlement mutation share a transaction and the txn rolls back, the ledger row is also rolled back — the next retry finds no row and re-processes. This is intentional: a failed first attempt must be retried. If both calls share a txn and succeed together, fine. The current design intentionally separates them: `insertWebhookEventOnce` commits first (short txn), then the longer entitlement mutation runs. On entitlement failure the ledger row is deleted (as shown above) so the retry can re-insert.

**Why not use a two-phase with `status='processing'` and update to `'applied'`?** That approach requires a lock and an UPDATE path for timed-out processing (dead sessions leave rows in `processing` forever). The delete-on-error approach is simpler and correct because Stripe's retry timing (>30s between retries) makes the window between insert and delete irrelevant for the duplicate-detection goal.

### Decision 2 — Concurrent-duplicate test design

These tests must use PGlite (existing integration test harness) with real concurrent transactions. They are not unit tests — they require the actual ON CONFLICT behavior.

**Test file: `tests/integration/billing-webhook-idempotency.test.ts`**

```typescript
// Test 1: Exact duplicate — second insert returns isDuplicate=true
it('concurrent duplicate delivery: second insert is suppressed by unique index', async () => {
  const db = await createTestDb();
  // Simulate two concurrent deliveries of evt_001
  const [r1, r2] = await Promise.all([
    insertWebhookEventOnce(db, { provider: 'stripe', eventId: 'evt_001', eventType: 'invoice.paid',
      userId: testUserId, planCode: 'tortila_monthly', billingEvent: 'payment_succeeded', status: 'applied' }),
    insertWebhookEventOnce(db, { provider: 'stripe', eventId: 'evt_001', eventType: 'invoice.paid',
      userId: testUserId, planCode: 'tortila_monthly', billingEvent: 'payment_succeeded', status: 'applied' }),
  ]);
  // Exactly one must succeed and one must be marked duplicate
  const successCount = [r1, r2].filter(r => !r.isDuplicate).length;
  const dupCount = [r1, r2].filter(r => r.isDuplicate).length;
  expect(successCount).toBe(1);
  expect(dupCount).toBe(1);
  // Only one row in the table
  const rows = await db.select().from(schema.billingWebhookEvents)
    .where(and(eq(schema.billingWebhookEvents.provider, 'stripe'),
               eq(schema.billingWebhookEvents.eventId, 'evt_001')));
  expect(rows).toHaveLength(1);
});

// Test 2: Different event IDs from same provider are both accepted
it('different event IDs from same provider both insert', async () => {
  const db = await createTestDb();
  const r1 = await insertWebhookEventOnce(db, { provider: 'stripe', eventId: 'evt_AAA', ... });
  const r2 = await insertWebhookEventOnce(db, { provider: 'stripe', eventId: 'evt_BBB', ... });
  expect(r1.isDuplicate).toBe(false);
  expect(r2.isDuplicate).toBe(false);
});

// Test 3: Delete-on-error allows retry to re-insert
it('delete on error allows retry re-processing', async () => {
  const db = await createTestDb();
  const r1 = await insertWebhookEventOnce(db, { provider: 'stripe', eventId: 'evt_ERR', ... });
  expect(r1.isDuplicate).toBe(false);
  // Simulate processing failure: delete the row
  await db.delete(schema.billingWebhookEvents)
    .where(and(eq(schema.billingWebhookEvents.provider, 'stripe'), eq(schema.billingWebhookEvents.eventId, 'evt_ERR')));
  // Retry: should succeed again
  const r2 = await insertWebhookEventOnce(db, { provider: 'stripe', eventId: 'evt_ERR', ... });
  expect(r2.isDuplicate).toBe(false);
});

// Test 4: Full applyStripeEvent path with durable idempotency — entitlement applied exactly once
it('applyStripeEvent with durable idempotency: entitlement written exactly once on concurrent delivery', async () => {
  const db = await createTestDb();
  // Run two concurrent full webhook flows for the same event
  const [result1, result2] = await Promise.all([
    processWebhookEvent(db, { eventId: 'evt_CONC', ... }),
    processWebhookEvent(db, { eventId: 'evt_CONC', ... }),
  ]);
  // One applies, one is duplicate-skipped
  const applied = [result1, result2].filter(r => r.applied);
  expect(applied).toHaveLength(1);
  expect(applied[0].productsChanged).toBe(1);
  // Entitlement table has exactly one row for this user/product
  const ents = await db.select().from(schema.entitlements)
    .where(and(eq(schema.entitlements.userId, testUserId), eq(schema.entitlements.productCode, 'tortila_bot')));
  expect(ents).toHaveLength(1);
  expect(ents[0].status).toBe('active');
});
```

### Decision 3 — `upsertSubscription` wiring from the webhook handler

When to call `upsertSubscription`: only when the event carries a determinable `providerRef` (Stripe subscription ID). The `checkout.session.completed` event carries the subscription ID in `data.object.subscription` for subscription-mode checkouts. `invoice.paid` carries it in `data.object.subscription`.

**Required: extend `NormalizedEvent` in `packages/billing/src/provider.ts`:**

```typescript
export interface NormalizedEvent {
  id: string;
  type: string;
  userId?: string;
  planCode?: string;
  raw: unknown;
  // ADDED in Phase 2.4:
  providerRef?: string;           // Stripe subscription ID (sub_xxx) or invoice ID
  currentPeriodEnd?: number;      // Unix timestamp from the Stripe object
  subscriptionStatus?: string;    // 'active' | 'past_due' | 'canceled' | ...
}
```

**Required: extend `parseWebhook` in `packages/billing/src/stripe.ts`** to extract `providerRef` and `currentPeriodEnd`:

```typescript
// Inside parseWebhook, after extracting userId and planCode:
const subscriptionId = (obj as Record<string, unknown>).subscription as string | undefined;
const periodEnd = (obj as Record<string, unknown>).current_period_end as number | undefined;
const subStatus = (obj as Record<string, unknown>).status as string | undefined;
if (subscriptionId) out.providerRef = subscriptionId;
if (periodEnd) out.currentPeriodEnd = periodEnd;
if (subStatus) out.subscriptionStatus = subStatus;
```

**Call site in the route handler** (after the durable idempotency INSERT succeeds, before `applyStripeEventTransitions`):

```typescript
// Route handler, between dedup check and entitlement mutation:
if (event.userId && event.planCode && event.providerRef) {
  // Upsert the subscription row so the subscriptions table reflects the current provider state.
  // This is a best-effort record; the entitlement is the access source of truth.
  await upsertSubscription(db, {
    userId: event.userId,
    planCode: event.planCode,
    provider: 'stripe',
    providerRef: event.providerRef,
    status: event.subscriptionStatus ?? 'active',
    currentPeriodEnd: event.currentPeriodEnd ? new Date(event.currentPeriodEnd * 1000) : undefined,
  });
}
```

**When NOT to call `upsertSubscription`:**
- `event.userId` is null or unresolvable (missing userId path — see Decision 4).
- `event.providerRef` is absent (one-time payments, charge events, dispute events).
- `billingEvent` is `'chargeback'` or `'refunded'` — subscription status should not be upserting to `'active'` when the entitlement is being revoked. In these cases set `status: 'canceled'` if `event.subscriptionStatus` is absent.

**Uniqueness fix required in migration 0003** (from Finding 6): add the partial unique index on `subscriptions(user_id, provider, provider_ref) WHERE provider_ref IS NOT NULL` and update `upsertSubscription` to use `INSERT ... ON CONFLICT DO UPDATE`.

Updated `upsertSubscription` signature for db-architect:

```typescript
export async function upsertSubscription(
  db: Db,
  input: {
    userId: string;
    planCode: string;
    provider: string;
    providerRef?: string;          // when present, conflicts on (userId, provider, providerRef)
    status: string;
    currentPeriodEnd?: Date;
  },
): Promise<SubscriptionRow> {
  if (input.providerRef) {
    // Safe upsert using the unique index (requires migration 0003 to add the index).
    const [row] = await db
      .insert(s.subscriptions)
      .values({
        userId: input.userId, planCode: input.planCode, provider: input.provider,
        providerRef: input.providerRef, status: input.status,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      })
      .onConflictDoUpdate({
        target: [s.subscriptions.userId, s.subscriptions.provider, s.subscriptions.providerRef],
        set: { planCode: input.planCode, status: input.status, currentPeriodEnd: input.currentPeriodEnd ?? null },
      })
      .returning();
    if (!row) throw new Error('failed to upsert subscription');
    return row;
  }
  // No providerRef: plain INSERT (one-time payments, manual grants).
  const [row] = await db.insert(s.subscriptions).values({
    userId: input.userId, planCode: input.planCode, provider: input.provider,
    providerRef: null, status: input.status, currentPeriodEnd: input.currentPeriodEnd ?? null,
  }).returning();
  if (!row) throw new Error('failed to insert subscription');
  return row;
}
```

### Decision 4 — `manual_review` path for unresolvable userId or ambiguous provider data

**Trigger conditions** (all must result in a `manual_review` item, never an auto-grant):
- `event.userId` is absent or not a valid UUID resolving to a known user.
- `event.planCode` is absent or does not resolve to any product codes (expandPlan returns []).
- Partial refund: `charge.refunded` with a partial amount (amount < charge total).
- Crypto underpayment: `payment_partially_paid` event.
- `charge.dispute.closed` with an unexpected `status` value (not `'won'` or `'lost'`).
- Any event where the billing event type is known but the state machine would require `manual_review` directly.

**`billing_manual_review_items` table for migration 0003:**

```typescript
export const billingManualReviewItems = pgTable(
  'billing_manual_review_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // The webhook event that triggered this review item.
    provider: text('provider').notNull(),           // 'stripe' | 'crypto'
    eventId: text('event_id').notNull(),            // provider event id
    eventType: text('event_type').notNull(),
    // Resolution state.
    status: text('status').notNull().default('pending'),
    // 'pending' | 'approved' | 'rejected' | 'dismissed'
    // The user this event was for — NULL when userId was completely unresolvable.
    userId: uuid('user_id').references(() => users.id), // no cascade — keep after user deletion
    // What was ambiguous or missing.
    reason: text('reason').notNull(),
    // 'missing_user_id' | 'unknown_plan_code' | 'partial_refund' |
    // 'partial_payment' | 'ambiguous_dispute_outcome' | 'other'
    // Admin-provided resolution notes.
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    // Raw event snapshot for admin inspection (not the raw body — only the parsed NormalizedEvent).
    eventSnapshot: jsonb('event_snapshot').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // One review item per unresolvable event (not per delivery attempt).
    uniqProviderEvent: uniqueIndex('bmri_provider_event_idx').on(t.provider, t.eventId),
    statusIdx: index('bmri_status_idx').on(t.status),
    userIdx: index('bmri_user_id_idx').on(t.userId),
  }),
);
```

**Raw SQL for migration 0003:**
```sql
CREATE TABLE billing_manual_review_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         TEXT NOT NULL,
  event_id         TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  user_id          UUID REFERENCES users(id),
  reason           TEXT NOT NULL,
  resolved_by      UUID REFERENCES users(id),
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT,
  event_snapshot   JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX bmri_provider_event_idx ON billing_manual_review_items (provider, event_id);
CREATE INDEX bmri_status_idx ON billing_manual_review_items (status);
CREATE INDEX bmri_user_id_idx ON billing_manual_review_items (user_id);
```

**Repo functions for db-architect (`packages/db/src/repositories.ts` additions):**

```typescript
export type ManualReviewItemRow = typeof s.billingManualReviewItems.$inferSelect;

export type ManualReviewReason =
  | 'missing_user_id'
  | 'unknown_plan_code'
  | 'partial_refund'
  | 'partial_payment'
  | 'ambiguous_dispute_outcome'
  | 'other';

export type ManualReviewStatus = 'pending' | 'approved' | 'rejected' | 'dismissed';

/**
 * Create a manual review item for an unresolvable or ambiguous webhook event.
 * Uses INSERT ... ON CONFLICT DO NOTHING to prevent duplicate items for the same event
 * (idempotent: multiple deliveries of the same unresolvable event do not create multiple items).
 * Also writes an audit row and a notification for admin users.
 */
export async function createManualReviewItem(
  db: Db,
  input: {
    provider: string;
    eventId: string;
    eventType: string;
    userId: string | null;
    reason: ManualReviewReason;
    eventSnapshot: Record<string, unknown>;
  },
  now = Date.now(),
): Promise<ManualReviewItemRow | null> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(s.billingManualReviewItems)
      .values({
        provider: input.provider,
        eventId: input.eventId,
        eventType: input.eventType,
        userId: input.userId ?? null,
        reason: input.reason,
        eventSnapshot: input.eventSnapshot,
      })
      .onConflictDoNothing()
      .returning();
    if (rows.length === 0) return null; // already created for this event
    const item = rows[0]!;
    // Audit row.
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: null, actorRole: 'system',
      action: 'billing.manual_review_created',
      targetType: 'billing_manual_review_item', targetId: item.id,
      after: { provider: input.provider, eventId: input.eventId, reason: input.reason },
    }, now));
    // Notification for admin users (best-effort: if no admin users exist, silently skip).
    // Caller is responsible for finding admin user IDs and calling createNotification.
    return item;
  });
}

/**
 * List pending manual review items for the admin queue.
 * Optionally filter by status. Returns most recent first.
 */
export async function listManualReviewItems(
  db: Db,
  opts?: { status?: ManualReviewStatus; limit?: number },
): Promise<ManualReviewItemRow[]> {
  const where = opts?.status
    ? eq(s.billingManualReviewItems.status, opts.status)
    : undefined;
  const q = db.select().from(s.billingManualReviewItems).orderBy(desc(s.billingManualReviewItems.createdAt)).limit(opts?.limit ?? 100);
  return where ? q.where(where) : q;
}

/**
 * Resolve a manual review item. Admin approves (→ active) or rejects (→ revoked) or dismisses.
 * For 'approved': also calls grantProduct for the userId+productCodes if userId is known.
 * For 'rejected': also calls revokeProduct if an active entitlement exists.
 * For 'dismissed': no entitlement change (event was a no-op in disguise).
 * All changes are in one transaction; audit row is written inside.
 */
export async function resolveManualReviewItem(
  db: Db,
  input: {
    itemId: string;
    resolution: ManualReviewStatus; // 'approved' | 'rejected' | 'dismissed'
    resolvedByAdminId: string;
    resolutionNote: string;           // required, min 3 chars
    // For 'approved': required when userId and productCodes are known.
    approvalTarget?: { userId: string; productCodes: ProductCode[]; planCode?: string };
  },
  now = Date.now(),
): Promise<void> {
  await db.transaction(async (tx) => {
    const [item] = await tx.select().from(s.billingManualReviewItems)
      .where(eq(s.billingManualReviewItems.id, input.itemId)).limit(1);
    if (!item) throw new Error('manual_review_item_not_found');
    if (item.status !== 'pending') throw new Error('manual_review_item_already_resolved');

    await tx.update(s.billingManualReviewItems).set({
      status: input.resolution,
      resolvedBy: input.resolvedByAdminId,
      resolvedAt: new Date(now),
      resolutionNote: input.resolutionNote,
    }).where(eq(s.billingManualReviewItems.id, input.itemId));

    // Entitlement action based on resolution.
    if (input.resolution === 'approved' && input.approvalTarget) {
      for (const pc of input.approvalTarget.productCodes) {
        // Reuse grantProduct which writes its own in-txn audit row.
        // We pass the same tx here — grantProduct must accept a Db | TxDb param.
        // db-architect: grantProduct already uses db.transaction internally;
        // for nested txn safety, pass tx directly (Drizzle supports nested transactions
        // via savepoints when the outer is already a txn).
        await grantProduct(
          tx as unknown as Db,
          input.approvalTarget.userId,
          pc,
          now,
          input.resolvedByAdminId,
          `manual_review_approved: ${input.resolutionNote}`,
          undefined,
        );
      }
    }

    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: input.resolvedByAdminId, actorRole: 'admin',
      action: `billing.manual_review_${input.resolution}`,
      targetType: 'billing_manual_review_item', targetId: input.itemId,
      after: { resolution: input.resolution, note: input.resolutionNote },
    }, now));
  });
}
```

**Route handler path for missing userId (updated `apps/web/src/app/api/billing/webhook/route.ts`):**

```typescript
// Replace the current "return 200" at line 91 with:
if (!event.userId) {
  // Missing userId: fail-closed (no grant), create a manual_review item, alert admin.
  const db = getServerDb();
  if (db) {
    await createManualReviewItem(db, {
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      userId: null,
      reason: 'missing_user_id',
      // eventSnapshot contains only parsed event fields — never the raw body.
      eventSnapshot: { id: event.id, type: event.type, planCode: event.planCode ?? null },
    });
    // Notify all admin users (iterate listUsers and filter by role 'admin').
    // Best-effort; if notification fails, the review item is still created.
    const adminUsers = await listUsers(db);
    for (const admin of adminUsers) {
      if (admin.roles.includes('admin')) {
        await createNotification(db, {
          userId: admin.id,
          type: 'billing_manual_review',
          title: 'Billing event requires manual review',
          body: `Webhook event ${event.id} (${event.type}) has no resolvable userId. Review at /admin/entitlements/review.`,
          linkUrl: '/admin/entitlements/review',
        });
      }
    }
  }
  return Response.json({ received: true }, { status: 200 });
}
```

**Note on `eventSnapshot`:** The snapshot MUST NOT contain the raw webhook body, the Stripe signature, or any secret. It contains only the parsed `NormalizedEvent` fields (`id`, `type`, `planCode`, and similar non-secret metadata). The `raw` field of `NormalizedEvent` is explicitly excluded from the snapshot.

### Decision 5 — Admin approve/reject/resolve actions (RBAC + CSRF + Zod + entitlement fail-closed + audit)

**New Zod schemas in `apps/web/src/features/admin/schemas.ts`:**

```typescript
export const resolveReviewSchema = z.object({
  itemId: z.string().uuid('Invalid review item ID'),
  resolution: z.enum(['approved', 'rejected', 'dismissed']),
  resolutionNote: z.string().trim().min(3, 'Resolution note must be at least 3 characters').max(1000),
  // For approved: the target userId and comma-separated productCodes.
  approvalUserId: z.string().uuid().optional(),
  approvalProductCodes: z.string().optional(), // comma-separated ProductCode values
});

export const flagReviewSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  product: z.string().min(1, 'Product code is required'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters').max(500),
});
```

**New server actions in `apps/web/src/features/admin/actions.ts`:**

All three follow the identical security chain: `requireUser → assertAdmin → assertCsrf → Zod → repo (in-txn audit) → revalidatePath`.

```typescript
// ---- Entitlement: flag for manual review ----
export async function adminFlagReviewAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    userId: formData.get('userId'),
    product: formData.get('product'),
    reason: formData.get('reason'),
  };
  const parsed = flagReviewSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`);
  const { userId, product, reason } = parsed.data;

  const db = getServerDb();
  if (!db) return; // demo mode: no-op (production fail-closed via getServerDb())

  // Apply manual_review transition: uses applyBillingEvent with 'flag_review' BillingEvent.
  // Requires a new repo function `flagProductForReview` (db-architect deliverable):
  const { flagProductForReview } = await import('@wtc/db');
  await flagProductForReview(db, userId, product as ProductCode, Date.now(), actor.id, reason);
  revalidatePath('/admin/entitlements');
}

// ---- Manual review: approve (→ active) ----
export async function adminApproveReviewAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    itemId: formData.get('itemId'),
    resolution: 'approved',
    resolutionNote: formData.get('resolutionNote'),
    approvalUserId: formData.get('approvalUserId') ?? undefined,
    approvalProductCodes: formData.get('approvalProductCodes') ?? undefined,
  };
  const parsed = resolveReviewSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`);

  const db = getServerDb();
  if (!db) return;

  const { resolveManualReviewItem: repoResolve, isProductCode, expandPlan } = await import('@wtc/db');
  const productCodes = parsed.data.approvalProductCodes
    ? (parsed.data.approvalProductCodes.split(',').map(s => s.trim()).filter(isProductCode) as ProductCode[])
    : [];

  await repoResolve(db, {
    itemId: parsed.data.itemId,
    resolution: 'approved',
    resolvedByAdminId: actor.id,
    resolutionNote: parsed.data.resolutionNote,
    approvalTarget: parsed.data.approvalUserId && productCodes.length > 0
      ? { userId: parsed.data.approvalUserId, productCodes }
      : undefined,
  });
  revalidatePath('/admin/entitlements');
  revalidatePath('/admin/entitlements/review');
}

// ---- Manual review: reject (→ revoked) or dismiss (no entitlement change) ----
export async function adminRejectOrDismissReviewAction(formData: FormData): Promise<void> {
  const actor = await requireUser();
  assertAdmin(actor.roles);
  await assertCsrf(formData);

  const raw = {
    itemId: formData.get('itemId'),
    resolution: formData.get('resolution'), // 'rejected' | 'dismissed'
    resolutionNote: formData.get('resolutionNote'),
  };
  const parsed = resolveReviewSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`Validation failed: ${parsed.error.issues.map(i => i.message).join(', ')}`);
  if (parsed.data.resolution !== 'rejected' && parsed.data.resolution !== 'dismissed') {
    throw new Error('Invalid resolution for this action');
  }

  const db = getServerDb();
  if (!db) return;

  const { resolveManualReviewItem: repoResolve } = await import('@wtc/db');
  await repoResolve(db, {
    itemId: parsed.data.itemId,
    resolution: parsed.data.resolution,
    resolvedByAdminId: actor.id,
    resolutionNote: parsed.data.resolutionNote,
  });
  revalidatePath('/admin/entitlements');
  revalidatePath('/admin/entitlements/review');
}
```

**Additional repo function needed — `flagProductForReview` (db-architect deliverable):**

```typescript
/**
 * Admin-triggered manual_review flag. Transitions any state to 'manual_review'.
 * Uses applyBillingEvent with 'flag_review' BillingEvent.
 * Writes audit row + product_access_events row in the same transaction.
 */
export async function flagProductForReview(
  db: Db,
  userId: string,
  productCode: ProductCode,
  now = Date.now(),
  actorUserId?: string,
  reason?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(s.entitlements)
      .where(and(eq(s.entitlements.userId, userId), eq(s.entitlements.productCode, productCode)))
      .limit(1);
    if (!existing) return; // no entitlement to flag
    const fromState = existing.status;
    // applyBillingEvent with 'flag_review' → 'manual_review' (see engine.ts)
    const next = applyBillingEvent(rowToEntitlement(existing), 'flag_review', now);
    if (next.status === fromState) return; // already in manual_review
    await tx.update(s.entitlements)
      .set({ status: next.status, manualOverride: true, updatedAt: new Date(now) })
      .where(eq(s.entitlements.id, existing.id));
    const eventReason = reason ?? 'manual_review_flagged';
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: actorUserId ?? null, actorRole: 'admin',
      action: 'product.flag_review',
      targetType: 'entitlement', targetId: `${userId}:${productCode}`,
      after: { status: next.status, reason: eventReason },
    }, now));
    await tx.insert(s.productAccessEvents).values({
      entitlementId: existing.id, userId, productCode,
      fromState, toState: next.status, reason: eventReason,
      actorId: actorUserId ?? null,
      actorType: actorUserId ? 'admin' : 'system',
    });
  });
}
```

**Admin UI additions (not implemented in this read-only wave — design only):**

The admin entitlements page must add:
1. A "Flag for Review" button on each non-`manual_review` entitlement (form with `reason` textarea, `adminFlagReviewAction`).
2. For entitlements currently in `manual_review` state: show "Approve" and "Reject" buttons (not "Grant" and "Revoke") to distinguish admin-manual-review resolution from general grant/revoke.
3. A new `/admin/entitlements/review` sub-page (or section) listing `billing_manual_review_items` with status `pending`, event details (provider, eventId, eventType, reason, createdAt), and Approve/Reject/Dismiss forms.

The admin review page must use `listManualReviewItems(db, { status: 'pending' })` from the repo. Each row renders the `eventSnapshot` in a code block (non-secret fields only). The Approve form must include `approvalUserId` (populated from the item's `userId` if non-null) and `approvalProductCodes` (a comma-separated input or multi-select from `PRODUCT_CODES`). Reason (resolutionNote) is required on all three actions.

**Types to add to `apps/web/src/features/admin/types.ts`:**

```typescript
export interface ManualReviewItemView {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  status: string;
  userId: string | null;
  reason: string;
  eventSnapshot: Record<string, unknown>;
  createdAt: number; // epoch-ms
  resolvedBy: string | null;
  resolvedAt: number | null;
  resolutionNote: string | null;
}

export interface AdminManualReviewState {
  mode: 'postgres' | 'demo';
  items: ManualReviewItemView[];
}
```

### Decision 6 — Stripe test-mode checkout: exact env requirements and blocker status

**Webhook reception path — production-ready NOW with:**
- `STRIPE_WEBHOOK_SECRET` set to the Stripe test-mode webhook secret (`whsec_test_...`).
- No `STRIPE_SECRET_KEY` required.
- The webhook route at `apps/web/src/app/api/billing/webhook/route.ts` is fully functional for test-mode events replayed via the Stripe CLI (`stripe listen --forward-to localhost:3000/api/billing/webhook`).

**Checkout creation path — BLOCKED, requires additional work:**

`packages/billing/src/stripe.ts:38-45` throws `BillingProviderNotConfiguredError` unconditionally after checking for `STRIPE_SECRET_KEY`. The Stripe SDK call is not wired. Exact requirements to unblock:

```
Required env:
  STRIPE_SECRET_KEY=sk_test_...       (Stripe test-mode secret key)
  STRIPE_WEBHOOK_SECRET=whsec_test_...
  STRIPE_PRICE_MAP=tortila_monthly:price_xxx,...  (or equivalent config table)

Required code changes (NOT done in Phase 2.4 read-only wave):
  packages/billing/src/stripe.ts:
    - Remove the unconditional throw at line 43-45.
    - Import the Stripe SDK (add 'stripe' npm dependency to packages/billing).
    - Implement the checkout.sessions.create call with:
        mode: 'subscription' or 'payment',
        line_items: [{ price: STRIPE_PRICE_MAP[planCode], quantity: 1 }],
        success_url, cancel_url,
        metadata: { userId, planCode, productCode }.
    - Return { id: session.id, url: session.url, planCode, provider: 'stripe' }.

Required tests before activating the checkout path:
  BW-022: End-to-end test with Stripe test clock (Stripe CLI) — subscription lifecycle.
  BW-023: Stripe test chargeback flow.
  The local mock provider remains the only safe dev checkout path until the above are complete.
```

**Decision: Stripe test-mode checkout stays TARGET in Phase 2.4.** The blocker is the unimplemented `createCheckout` body. This is acceptable because: (a) the webhook path is fully real and can be tested with the Stripe CLI forwarding test events; (b) the mock provider covers all local dev and Vitest integration test scenarios; (c) no live Stripe charge is ever made. The TARGET label must be preserved in `docs/BILLING_PROVIDER_PLAN.md §2` and `docs/CONTRACTS/billing-webhooks.md §12`.

---

## Risks

1. **Nested transaction for `grantProduct` inside `resolveManualReviewItem`**: Drizzle's nested transaction support uses Postgres savepoints. This is safe in postgres-js but must be verified for the PGlite test harness (PGlite 0.2+ supports savepoints). If PGlite does not support savepoints, the test for `resolveManualReviewItem` must use a flat transaction with explicit grantProduct logic inlined. db-architect must confirm PGlite savepoint support before implementing the nested call.

2. **`billing_manual_review_items` eventSnapshot contains NormalizedEvent.raw**: `NormalizedEvent.raw` is typed as `unknown` and contains the full parsed Stripe event object, which may include customer email, payment method details, or other PII. The `eventSnapshot` column in the table MUST NOT store `NormalizedEvent.raw`. Only the fields `{ id, type, planCode, userId: null }` (non-secret, non-PII) should be stored. The implementation agent must explicitly exclude `raw` when constructing `eventSnapshot`.

3. **DELETE-on-error in the route handler exposes a narrow re-insert race**: between the DELETE of the failed `billing_webhook_events` row and the provider's retry, another actor could insert a row with the same `(provider, event_id)`. In practice this is a 30+ second window (Stripe's minimum retry delay) and the provider would be the same actor, so this is safe. It is not a security risk — the worst outcome is that a retry is blocked if a concurrent delivery re-inserts before the retry arrives. This is the correct behavior (concurrent delivery → only one processed).

4. **`listManualReviewItems` with no userId filter**: in a system with many webhook events, the pending review queue could grow large. The repo function defaults to `limit: 100`. The admin page must paginate or provide a count badge. This is a UI quality concern, not a security risk.

5. **Admin notification fan-out in the route handler**: the missing-userId path iterates all users and filters by role `'admin'`, then calls `createNotification` per admin. This is an N+1 query pattern. For MVP (few admin users) this is acceptable. A future optimization is `listAdminUserIds(db)` (a single JOIN query). This must be documented as a known N+1 in the route handler comment.

6. **Stripe test-mode webhook secret vs live-mode secret**: Stripe uses different `whsec_...` prefixes for test (`whsec_test_...`) and live mode. The `verifyWebhookSignature` function in `packages/billing/src/webhook.ts` does not validate the prefix — it accepts any string as the secret. This is correct (HMAC verification does not depend on the secret's content, only its value). However, misconfiguring a test secret in production (or vice versa) will cause all webhooks to fail. The `.env.example` must document both env vars clearly with the mode distinction. This is a configuration risk, not a code risk.

---

## Verification/tests

No tests run (read-only audit wave). Real Postgres not available; Docker absent. PGlite harness is available for the concurrent-duplicate tests once the `billing_webhook_events` table exists in migration 0003.

**Test coverage the db-architect + backend-implementer must deliver:**

| Test ID | Description | Mechanism | File |
|---|---|---|---|
| BWH-001 | `insertWebhookEventOnce`: first insert succeeds, `isDuplicate=false` | PGlite integration | `tests/integration/billing-webhook-idempotency.test.ts` |
| BWH-002 | `insertWebhookEventOnce`: second insert for same `(provider, event_id)` → `isDuplicate=true` | PGlite integration | same |
| BWH-003 | `Promise.all` concurrent dual insert → exactly one row in table | PGlite integration (key test) | same |
| BWH-004 | Delete-on-error allows re-insert on retry | PGlite integration | same |
| BWH-005 | Missing userId → `createManualReviewItem` creates item, admin notification created | PGlite integration | `tests/integration/billing-manual-review.test.ts` |
| BWH-006 | Unknown planCode → `createManualReviewItem` with `reason='unknown_plan_code'` | PGlite integration | same |
| BWH-007 | `resolveManualReviewItem` approve → entitlement `active`, audit row written | PGlite integration | same |
| BWH-008 | `resolveManualReviewItem` reject → entitlement unchanged (no userId), audit row written | PGlite integration | same |
| BWH-009 | `resolveManualReviewItem` on already-resolved item → throws `manual_review_item_already_resolved` | PGlite integration | same |
| BWH-010 | `adminApproveReviewAction`: no admin session → `requireUser` throws | Vitest unit (mock session) | `tests/unit/admin-review-actions.test.ts` |
| BWH-011 | `adminApproveReviewAction`: empty `resolutionNote` → Zod throws, no DB write | Vitest unit | same |
| BWH-012 | `flagProductForReview`: transitions `active → manual_review`, writes `product_access_events` row | PGlite integration | `tests/integration/billing-manual-review.test.ts` |
| BWH-013 | `upsertSubscription` with unique index: concurrent call for same `(userId, provider, providerRef)` → one row | PGlite integration | `tests/integration/subscription-upsert.test.ts` |
| BWH-014 | Route handler: valid event, userId present → `insertWebhookEventOnce` called before `applyStripeEventTransitions` | Vitest unit (spy on insertWebhookEventOnce) | `tests/unit/billing-webhook-route.test.ts` |

---

## Next actions

1. **(db-architect — migration 0003):** Create `billing_webhook_events` table (Decision 1 exact DDL). Create `billing_manual_review_items` table (Decision 4 exact DDL). Add partial unique index `UNIQUE (user_id, provider, provider_ref) WHERE provider_ref IS NOT NULL` on `subscriptions` table. Add all three tables to `packages/db/src/schema.ts` and write the migration 0003 SQL file.

2. **(db-architect — repo additions):** Add to `packages/db/src/repositories.ts`:
   - `insertWebhookEventOnce` (Decision 1)
   - `updateWebhookEventStatus` (Decision 1)
   - `createManualReviewItem` (Decision 4)
   - `listManualReviewItems` (Decision 4)
   - `resolveManualReviewItem` (Decision 4)
   - `flagProductForReview` (Decision 5)
   - Update `upsertSubscription` to use ON CONFLICT DO UPDATE with the new unique index (Decision 3)
   - Confirm PGlite savepoint support before implementing nested grantProduct inside resolveManualReviewItem

3. **(backend-implementer — route.ts update):** Update `apps/web/src/app/api/billing/webhook/route.ts` to:
   - Replace select-then-insert idempotency with `insertWebhookEventOnce` (Decision 1 flow)
   - Wire `upsertSubscription` call when `event.providerRef` is present (Decision 3)
   - Replace missing-userId 200 with `createManualReviewItem` + admin notifications (Decision 4)
   - Delete the `billing_webhook_events` row on DB error so retries re-process (Decision 1)

4. **(backend-implementer — provider.ts + stripe.ts):** Extend `NormalizedEvent` interface with `providerRef`, `currentPeriodEnd`, `subscriptionStatus` (Decision 3). Update `parseWebhook` in `stripe.ts` to extract these fields from the Stripe event object.

5. **(admin-implementer — actions.ts + schemas.ts):** Add `flagReviewSchema`, `resolveReviewSchema` to schemas. Add `adminFlagReviewAction`, `adminApproveReviewAction`, `adminRejectOrDismissReviewAction` to actions (Decision 5). Add `ManualReviewItemView` and `AdminManualReviewState` types to types.ts.

6. **(admin-implementer — entitlements page + review page):** Add Flag-for-Review controls on the entitlements page. Create `/admin/entitlements/review/page.tsx` listing pending `billing_manual_review_items` with Approve/Reject/Dismiss forms. Load via `loadManualReviewItems` query function in `features/admin/queries.ts`.

7. **(tests-runner):** Write `tests/integration/billing-webhook-idempotency.test.ts` covering BWH-001 through BWH-004. Write `tests/integration/billing-manual-review.test.ts` covering BWH-005 through BWH-012. Write `tests/integration/subscription-upsert.test.ts` covering BWH-013.

8. **(docs — billing-webhooks.md):** Update `docs/CONTRACTS/billing-webhooks.md §7` to reflect `billing_webhook_events` table as the new idempotency store (superseding `audit_logs` ledger); the `webhook_idempotency_keys` table remains TARGET-only and is superseded by `billing_webhook_events`. Update `§12` to clarify Stripe test-mode webhook path is production-ready with only `STRIPE_WEBHOOK_SECRET`; checkout creation is TARGET with the documented blocker.
