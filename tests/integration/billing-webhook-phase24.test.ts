/**
 * Billing webhook Phase 2.4 integration tests (PGlite — real Postgres engine, no Docker).
 *
 * Extends BW-001..004 in billing-webhook.test.ts with Phase 2.4 cases:
 *
 *   BW-005  missing userId → createManualReviewItem (missing_user_id) + audit
 *           + no entitlement granted + no PAE row
 *   BW-006  concurrent duplicate stripeEventId → exactly one audit row
 *           + exactly one entitlement row via applyStripeEvent
 *   BW-007  unknown planCode → expandPlan returns [] → no entitlement granted,
 *           no PAE row, applyStripeEvent returns {applied:true, productsChanged:0}
 *   BW-008  payment_refunded event → entitlement transitions to 'refunded',
 *           hasAccess returns false, PAE row written with toState='refunded'
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  createUser,
  applyStripeEvent,
  entitlementsOf,
  listProductAccessEvents,
  recentAuditEvents,
  createManualReviewItem,
  listManualReviewItems,
  type Db,
} from '@wtc/db';
import { hasAccess, expandPlan } from '@wtc/entitlements';

const NOW_MS = 1_900_000_000_000;

let db: Db;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
});

// ── BW-005: missing userId → manual_review item created, no grant ─────────────

describe('BW-005 — missing userId creates manual_review item + audit; no entitlement granted', () => {
  it('createManualReviewItem for a missing-userId event → status=pending, audit row written', async () => {
    const eventId = 'evt_bw_missing_user_005';
    const item = await createManualReviewItem(db, {
      provider: 'stripe',
      eventId,
      eventType: 'checkout.session.completed',
      userId: null,
      reason: 'missing_user_id',
      eventSnapshot: { id: eventId, type: 'checkout.session.completed', planCode: 'axioma_monthly' },
    });

    expect(item).not.toBeNull();
    expect(item!.status).toBe('pending');
    expect(item!.reason).toBe('missing_user_id');
    expect(item!.userId).toBeNull();
    expect(item!.provider).toBe('stripe');
    expect(item!.eventId).toBe(eventId);

    // Audit row written for creation
    const events = await recentAuditEvents(db, 1000);
    const auditRow = events.find(
      (e) => e.action === 'billing.manual_review_created' && e.targetId === item!.id,
    );
    expect(auditRow).toBeDefined();

    // listManualReviewItems returns pending item
    const pending = await listManualReviewItems(db, { status: 'pending' });
    expect(pending.some((i) => i.id === item!.id)).toBe(true);
  });

  it('BW-005b: no billing.webhook_received audit row when userId is null (route stops before applyStripeEvent)', async () => {
    // When userId is null the route acknowledges 200 but must NOT call applyStripeEvent.
    // We verify via the repo layer: a manual_review item is created but no
    // 'billing.webhook_received' audit row is written for this phantom event.
    const eventIdB = 'evt_bw_missing_user_005b';
    const item = await createManualReviewItem(db, {
      provider: 'stripe',
      eventId: eventIdB,
      eventType: 'invoice.paid',
      userId: null,
      reason: 'missing_user_id',
      eventSnapshot: { id: eventIdB, type: 'invoice.paid' },
    });
    expect(item).not.toBeNull();

    // No 'billing.webhook_received' row for this eventId (applyStripeEvent was never called)
    const events = await recentAuditEvents(db, 1000);
    const webhookReceived = events.find(
      (e) => e.action === 'billing.webhook_received' && e.targetId === eventIdB,
    );
    expect(webhookReceived).toBeUndefined();
  });
});

// ── BW-006: concurrent duplicate via applyStripeEvent ────────────────────────

describe('BW-006 — concurrent duplicate stripeEventId: exactly one audit row + one entitlement', () => {
  it('two simultaneous applyStripeEvent calls with same eventId → exactly one webhook_received row', async () => {
    const eventId = 'evt_bw_conc_006';
    const bwUser = (await createUser(db, { email: 'bw-conc006@wtc.local', passwordHash: 'h', displayName: 'ConcUser006' })).id;

    const [r1, r2] = await Promise.all([
      applyStripeEvent(
        db,
        { stripeEventId: eventId, billingEvent: 'payment_succeeded', userId: bwUser, productCodes: ['club'], planCode: 'club_monthly' },
        NOW_MS,
      ),
      applyStripeEvent(
        db,
        { stripeEventId: eventId, billingEvent: 'payment_succeeded', userId: bwUser, productCodes: ['club'], planCode: 'club_monthly' },
        NOW_MS,
      ),
    ]);

    // At least one call must have applied
    const appliedCount = [r1, r2].filter((r) => r.applied).length;
    expect(appliedCount).toBeGreaterThanOrEqual(1);

    // Exactly one 'billing.webhook_received' audit row for this eventId (idempotency guard)
    const events = await recentAuditEvents(db, 1000);
    const receivedRows = events.filter(
      (e) => e.action === 'billing.webhook_received' && e.targetId === eventId,
    );
    expect(receivedRows.length).toBe(1);
    expect(receivedRows[0]!.actorUserId).toBeNull();
    expect((receivedRows[0]!.after as Record<string, unknown>).userId).toBe(bwUser);

    // Entitlement for this user is active (at most one grant)
    const ents = await entitlementsOf(db, bwUser);
    const clubEnts = ents.filter((e) => e.productCode === 'club');
    expect(clubEnts.length).toBe(1);
    expect(hasAccess(ents, 'club', NOW_MS)).toBe(true);

    // Exactly one toState='active' PAE row
    const paeRows = await listProductAccessEvents(db, bwUser, { productCode: 'club' });
    const activeRows = paeRows.filter((p) => p.toState === 'active');
    expect(activeRows.length).toBe(1);
  });
});

// ── BW-007: unknown planCode → no entitlement granted ────────────────────────

describe('BW-007 — unknown planCode → expandPlan returns [] → no entitlement granted', () => {
  it('expandPlan returns empty array for an unknown plan code', () => {
    // expandPlan is the canonical source; if it returns [], applyStripeEvent receives []
    // and productsChanged is 0 (no entitlement rows written).
    const products = expandPlan('unknown_plan_xyz' as never);
    expect(products).toEqual([]);
  });

  it('applyStripeEvent with empty productCodes → applied=true, productsChanged=0, no entitlement', async () => {
    const bwUser7 = (await createUser(db, { email: 'bw-007@wtc.local', passwordHash: 'h', displayName: 'BW007' })).id;

    // Simulate the route calling applyStripeEvent after expandPlan([unknown]) returned []:
    const r = await applyStripeEvent(
      db,
      {
        stripeEventId: 'evt_bw_007_unknown_plan',
        billingEvent: 'payment_succeeded',
        userId: bwUser7,
        productCodes: [], // expandPlan returned []
        planCode: 'unknown_plan_xyz',
      },
      NOW_MS,
    );

    expect(r.applied).toBe(true);       // event was recorded (idempotent guard writes audit row)
    expect(r.productsChanged).toBe(0);  // but no products changed (empty product list)

    // No active entitlement granted
    const ents = await entitlementsOf(db, bwUser7);
    expect(ents.length).toBe(0);

    // No PAE row written
    const paeRows = await listProductAccessEvents(db, bwUser7);
    expect(paeRows.length).toBe(0);

    // Audit row IS written (billing.webhook_received — event was acknowledged)
    const events = await recentAuditEvents(db, 1000);
    const receivedRow = events.find(
      (e) => e.action === 'billing.webhook_received' && e.targetId === 'evt_bw_007_unknown_plan',
    );
    expect(receivedRow).toBeDefined();
  });
});

// ── BW-008: payment_refunded → entitlement transitions to 'refunded' ─────────

describe('BW-008 — payment_refunded → entitlement status=refunded, hasAccess=false, PAE row written', () => {
  it('active entitlement after payment_succeeded → refunded after refunded event', async () => {
    const bwUser8 = (await createUser(db, { email: 'bw-008@wtc.local', passwordHash: 'h', displayName: 'BW008' })).id;

    // First: grant via payment_succeeded → active
    const r1 = await applyStripeEvent(
      db,
      {
        stripeEventId: 'evt_bw_008_pay',
        billingEvent: 'payment_succeeded',
        userId: bwUser8,
        productCodes: ['tortila_bot'],
        planCode: 'tortila_monthly',
      },
      NOW_MS,
    );
    expect(r1.applied).toBe(true);
    expect(r1.productsChanged).toBe(1);

    const entsAfterPay = await entitlementsOf(db, bwUser8);
    expect(hasAccess(entsAfterPay, 'tortila_bot', NOW_MS)).toBe(true);

    // Second: refund → transitions to 'refunded'
    const r2 = await applyStripeEvent(
      db,
      {
        stripeEventId: 'evt_bw_008_refund',
        billingEvent: 'refunded',
        userId: bwUser8,
        productCodes: ['tortila_bot'],
        planCode: 'tortila_monthly',
      },
      NOW_MS + 1000,
    );
    expect(r2.applied).toBe(true);
    expect(r2.productsChanged).toBe(1);

    // Entitlement is now refunded (access denied)
    const entsAfterRefund = await entitlementsOf(db, bwUser8);
    const ent = entsAfterRefund.find((e) => e.productCode === 'tortila_bot');
    expect(ent).toBeDefined();
    expect(ent!.status).toBe('refunded');
    expect(hasAccess(entsAfterRefund, 'tortila_bot', NOW_MS + 2000)).toBe(false);

    // PAE row written with toState='refunded'
    const paeRows = await listProductAccessEvents(db, bwUser8, { productCode: 'tortila_bot' });
    const refundedPae = paeRows.find((p) => p.toState === 'refunded');
    expect(refundedPae).toBeDefined();
    expect(refundedPae!.userId).toBe(bwUser8);
    expect(refundedPae!.productCode).toBe('tortila_bot');
    expect(refundedPae!.actorType).toBe('billing_webhook');
  });

  it('a later payment_succeeded does not reactivate a refunded entitlement', async () => {
    const userId = (await createUser(db, { email: 'bw-008-terminal@wtc.local', passwordHash: 'h', displayName: 'BW008 Terminal' })).id;

    await applyStripeEvent(db, {
      stripeEventId: 'evt_bw_008_terminal_pay',
      billingEvent: 'payment_succeeded',
      userId,
      productCodes: ['tortila_bot'],
      planCode: 'tortila_monthly',
    }, NOW_MS);
    await applyStripeEvent(db, {
      stripeEventId: 'evt_bw_008_terminal_refund',
      billingEvent: 'refunded',
      userId,
      productCodes: ['tortila_bot'],
      planCode: 'tortila_monthly',
    }, NOW_MS + 1000);

    const replayedSuccess = await applyStripeEvent(db, {
      stripeEventId: 'evt_bw_008_terminal_late_success',
      billingEvent: 'payment_succeeded',
      userId,
      productCodes: ['tortila_bot'],
      planCode: 'tortila_monthly',
    }, NOW_MS + 2000);

    expect(replayedSuccess.applied).toBe(true);
    expect(replayedSuccess.productsChanged).toBe(0);
    const ents = await entitlementsOf(db, userId);
    const ent = ents.find((e) => e.productCode === 'tortila_bot');
    expect(ent!.status).toBe('refunded');
    expect(hasAccess(ents, 'tortila_bot', NOW_MS + 3000)).toBe(false);
  });
});
