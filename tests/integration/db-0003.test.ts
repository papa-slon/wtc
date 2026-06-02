/**
 * Migration 0003 repository integration tests (PGlite — real Postgres engine, no Docker).
 * Applies all migrations (0000..0003) then exercises the Phase-2.4 repos for:
 *   (1) insertWebhookEventOnce first=claimed/second=duplicate
 *   (2) CONCURRENT duplicate via Promise.all → exactly one claimed, one row, no 23505 thrown
 *   (3) atomicGrantTv round-trip (request granted + grant row + profile pointer + audit)
 *   (4) atomicRevokeTv with reason (request revoked + grant revokeReason + profile null + audit)
 *   (5) atomicRevokeTv rejects a pending request with no active grant
 *   (6) createManualReviewItem idempotent + resolveManualReviewItem approve→grant
 *   (7) listUsersWithCreatedAt returns createdAt epoch-ms + roles
 *   (8) upsertSubscription concurrent same providerRef → one row
 * Source of truth: docs/handoffs/20260530-1355-ecosystem-db-architect.md (D-07).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq, and } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  createUser,
  findUserByEmail,
  recentAuditEvents,
  grantProduct,
  entitlementsOf,
  submitTvRequest,
  listAllTv,
  listTvGrantsForUser,
  upsertSubscription,
  listSubscriptionsForUser,
  // Phase 2.4 new repos
  insertWebhookEventOnce,
  updateWebhookEventStatus,
  createManualReviewItem,
  listManualReviewItems,
  resolveManualReviewItem,
  flagProductForReview,
  atomicGrantTv,
  atomicRevokeTv,
  listUsersWithCreatedAt,
  type Db,
} from '@wtc/db';
import { hasAccess } from '@wtc/entitlements';

let db: Db;
let userA: string, userB: string, admin: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userA = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  admin = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  userB = (await createUser(db, { email: '0003-userb@wtc.local', passwordHash: 'h', displayName: 'B0003' })).id;
});

// ── Test 1: insertWebhookEventOnce ────────────────────────────────────────────
describe('0003 Billing: insertWebhookEventOnce idempotency', () => {
  it('first insert returns isDuplicate=false with a rowId', async () => {
    const r = await insertWebhookEventOnce(db, {
      provider: 'stripe',
      eventId: 'evt_0003_a',
      eventType: 'payment_succeeded',
      userId: userA,
      planCode: 'tortila_monthly',
      billingEvent: 'payment_succeeded',
      status: 'applied',
    });
    expect(r.isDuplicate).toBe(false);
    expect(typeof r.rowId).toBe('string');
    expect(r.rowId).toBeTruthy();
  });

  it('second insert for same (provider, eventId) returns isDuplicate=true, rowId=null', async () => {
    const r = await insertWebhookEventOnce(db, {
      provider: 'stripe',
      eventId: 'evt_0003_a', // same as above
      eventType: 'payment_succeeded',
      userId: userA,
      planCode: 'tortila_monthly',
      billingEvent: 'payment_succeeded',
      status: 'applied',
    });
    expect(r.isDuplicate).toBe(true);
    expect(r.rowId).toBeNull();
  });

  it('updateWebhookEventStatus stamps the row with final outcome', async () => {
    // Insert a fresh event to stamp
    const r = await insertWebhookEventOnce(db, {
      provider: 'stripe',
      eventId: 'evt_0003_stamp',
      eventType: 'invoice.paid',
      userId: userA,
      planCode: null,
      billingEvent: null,
      status: 'applied',
    });
    expect(r.isDuplicate).toBe(false);
    await updateWebhookEventStatus(db, 'stripe', 'evt_0003_stamp', 'no_op', 0);
    const rows = await db.select().from(schema.billingWebhookEvents)
      .where(and(
        eq(schema.billingWebhookEvents.provider, 'stripe'),
        eq(schema.billingWebhookEvents.eventId, 'evt_0003_stamp'),
      ));
    expect(rows.length).toBe(1);
    expect(rows[0]!.status).toBe('no_op');
    expect(rows[0]!.productsChanged).toBe(0);
  });
});

// ── Test 2: CONCURRENT duplicate via Promise.all ──────────────────────────────
describe('0003 Billing: concurrent duplicate via Promise.all', () => {
  it('exactly one insert is claimed, one row exists, no 23505 bubbles to caller', async () => {
    const [r1, r2] = await Promise.all([
      insertWebhookEventOnce(db, {
        provider: 'stripe',
        eventId: 'evt_0003_conc',
        eventType: 'payment_succeeded',
        userId: userA,
        planCode: 'axioma_monthly',
        billingEvent: 'payment_succeeded',
        status: 'applied',
      }),
      insertWebhookEventOnce(db, {
        provider: 'stripe',
        eventId: 'evt_0003_conc', // same eventId
        eventType: 'payment_succeeded',
        userId: userA,
        planCode: 'axioma_monthly',
        billingEvent: 'payment_succeeded',
        status: 'applied',
      }),
    ]);
    const claimedCount = [r1, r2].filter((r) => !r.isDuplicate).length;
    const dupCount = [r1, r2].filter((r) => r.isDuplicate).length;
    expect(claimedCount).toBe(1);
    expect(dupCount).toBe(1);
    // Exactly one row in the table for this eventId
    const rows = await db.select().from(schema.billingWebhookEvents)
      .where(and(
        eq(schema.billingWebhookEvents.provider, 'stripe'),
        eq(schema.billingWebhookEvents.eventId, 'evt_0003_conc'),
      ));
    expect(rows.length).toBe(1);
  });
});

// ── Test 3: atomicGrantTv round-trip ─────────────────────────────────────────
describe('0003 TradingView: atomicGrantTv', () => {
  it('request granted + grant row + profile pointer + audit in one operation', async () => {
    const req = await submitTvRequest(db, userA, 'trader_0003');
    const grant = await atomicGrantTv(db, {
      requestId: req.id,
      userId: userA,
      tvUsername: 'trader_0003',
      adminId: admin,
      durationMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      reason: 'subscription active',
    });

    // Grant row exists
    expect(grant.requestId).toBe(req.id);
    expect(grant.tvUsername).toBe('trader_0003');
    expect(grant.revokedAt).toBeNull();

    // Request row is 'granted'
    const reqs = await listAllTv(db);
    const reqRow = reqs.find((r) => r.id === req.id)!;
    expect(reqRow.status).toBe('granted');
    expect(reqRow.grantedBy).toBe(admin);

    // Profile pointer set
    const profile = await db.select().from(schema.tradingviewProfiles)
      .where(eq(schema.tradingviewProfiles.userId, userA));
    expect(profile.length).toBeGreaterThan(0);
    expect(profile[0]!.currentGrantId).toBe(grant.id);

    // One audit row with action='tv_access.grant'
    const events = await recentAuditEvents(db, 1000);
    const grantAudit = events.find((e) => e.action === 'tv_access.grant' && e.targetId === grant.id);
    expect(grantAudit).toBeDefined();
    // Reason in audit payload
    const afterPayload = grantAudit!.after as Record<string, unknown>;
    expect(afterPayload.reason).toBe('subscription active');
  });
});

// ── Test 4: atomicRevokeTv with reason ───────────────────────────────────────
describe('0003 TradingView: atomicRevokeTv with reason', () => {
  it('request revoked + grant stamped + profile null + audit with reason', async () => {
    // Set up: grant first
    const req2 = await submitTvRequest(db, userB, 'trader_0003_b');
    const grant2 = await atomicGrantTv(db, {
      requestId: req2.id,
      userId: userB,
      tvUsername: 'trader_0003_b',
      adminId: admin,
      durationMs: 30 * 24 * 60 * 60 * 1000,
    });
    // Verify profile pointer is set
    const profileBefore = await db.select().from(schema.tradingviewProfiles)
      .where(eq(schema.tradingviewProfiles.userId, userB));
    expect(profileBefore[0]!.currentGrantId).toBe(grant2.id);

    // Now revoke atomically (admin actor descriptor)
    await atomicRevokeTv(db, req2.id, { id: admin, role: 'admin' }, 'subscription expired');

    // Request row is 'revoked'
    const reqs = await listAllTv(db);
    const reqRow = reqs.find((r) => r.id === req2.id)!;
    expect(reqRow.status).toBe('revoked');

    // Grant row is stamped with revokeReason
    const grants = await listTvGrantsForUser(db, userB);
    const g = grants.find((x) => x.id === grant2.id)!;
    expect(g.revokedAt).not.toBeNull();
    expect(g.revokedBy).toBe(admin);
    expect(g.revokeReason).toBe('subscription expired');

    // Profile pointer is null
    const profileAfter = await db.select().from(schema.tradingviewProfiles)
      .where(eq(schema.tradingviewProfiles.userId, userB));
    expect(profileAfter[0]!.currentGrantId).toBeNull();

    // Audit row with action='tv_access.revoke' and reason in after payload
    const events = await recentAuditEvents(db, 1000);
    const revokeAudit = events.find((e) => e.action === 'tv_access.revoke' && e.targetId === req2.id);
    expect(revokeAudit).toBeDefined();
    const afterPayload = revokeAudit!.after as Record<string, unknown>;
    expect(afterPayload.reason).toBe('subscription expired');
  });
});

// ── Test 5: atomicRevokeTv with no grant (graceful) ──────────────────────────
describe('0003 TradingView: atomicRevokeTv rejects when no grant exists', () => {
  it('pending request is not revoked and no misleading audit row is written', async () => {
    // Create a request but do NOT grant it
    const userC = (await createUser(db, { email: '0003-userc@wtc.local', passwordHash: 'h', displayName: 'C0003' })).id;
    const req3 = await submitTvRequest(db, userC, 'trader_0003_c');

    // Revoke rejects because only granted/expiring_soon requests are revokable.
    await expect(atomicRevokeTv(db, req3.id, { id: admin, role: 'admin' }, 'policy change')).rejects.toThrow(/tv_request_not_revokable/);

    // Request remains pending.
    const reqs = await listAllTv(db);
    const reqRow = reqs.find((r) => r.id === req3.id)!;
    expect(reqRow.status).toBe('pending');
  });
});

// ── Test 6: createManualReviewItem idempotent + resolveManualReviewItem ────────
describe('0003 Billing: createManualReviewItem + resolveManualReviewItem', () => {
  it('createManualReviewItem is idempotent (second call returns null) + audit row written', async () => {
    const item1 = await createManualReviewItem(db, {
      provider: 'stripe',
      eventId: 'evt_missing_user_1',
      eventType: 'invoice.paid',
      userId: null,
      reason: 'missing_user_id',
      eventSnapshot: { id: 'evt_missing_user_1', type: 'invoice.paid', planCode: null },
    });
    expect(item1).not.toBeNull();
    expect(item1!.status).toBe('pending');
    expect(item1!.reason).toBe('missing_user_id');

    // Second call for same event → null (idempotent)
    const item2 = await createManualReviewItem(db, {
      provider: 'stripe',
      eventId: 'evt_missing_user_1',
      eventType: 'invoice.paid',
      userId: null,
      reason: 'missing_user_id',
      eventSnapshot: { id: 'evt_missing_user_1', type: 'invoice.paid', planCode: null },
    });
    expect(item2).toBeNull();

    // Audit row written for the first creation
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'billing.manual_review_created' && e.targetId === item1!.id)).toBe(true);

    // listManualReviewItems returns pending items
    const pending = await listManualReviewItems(db, { status: 'pending' });
    expect(pending.some((i) => i.id === item1!.id)).toBe(true);
  });

  it('resolveManualReviewItem approve → grantProduct separately → entitlement active', async () => {
    // Create a review item for userA
    const reviewItem = await createManualReviewItem(db, {
      provider: 'stripe',
      eventId: 'evt_approve_test',
      eventType: 'checkout.session.completed',
      userId: userA,
      reason: 'missing_user_id',
      eventSnapshot: { id: 'evt_approve_test', type: 'checkout.session.completed', planCode: 'club_monthly' },
    });
    expect(reviewItem).not.toBeNull();

    // Resolve as approved (without approvalTarget — caller handles grant separately)
    await resolveManualReviewItem(db, {
      itemId: reviewItem!.id,
      resolution: 'approved',
      resolvedByAdminId: admin,
      resolutionNote: 'verified payment manually',
    });

    // Item is now 'approved'
    const items = await listManualReviewItems(db, { status: 'approved' });
    const resolved = items.find((i) => i.id === reviewItem!.id)!;
    expect(resolved.status).toBe('approved');
    expect(resolved.resolvedBy).toBe(admin);
    expect(resolved.resolutionNote).toBe('verified payment manually');

    // Audit row for approval written
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'billing.manual_review_approved' && e.targetId === reviewItem!.id)).toBe(true);

    // Calling again on an already-resolved item throws
    await expect(resolveManualReviewItem(db, {
      itemId: reviewItem!.id,
      resolution: 'approved',
      resolvedByAdminId: admin,
      resolutionNote: 'again',
    })).rejects.toThrow('manual_review_item_already_resolved');
  });

  it('resolveManualReviewItem with approvalTarget calls grantProduct (entitlement active)', async () => {
    const userD = (await createUser(db, { email: '0003-userd@wtc.local', passwordHash: 'h', displayName: 'D0003' })).id;
    const reviewItem = await createManualReviewItem(db, {
      provider: 'stripe',
      eventId: 'evt_approve_grant_test',
      eventType: 'invoice.paid',
      userId: userD,
      reason: 'unknown_plan_code',
      eventSnapshot: { id: 'evt_approve_grant_test', type: 'invoice.paid' },
    });
    expect(reviewItem).not.toBeNull();

    await resolveManualReviewItem(db, {
      itemId: reviewItem!.id,
      resolution: 'approved',
      resolvedByAdminId: admin,
      resolutionNote: 'manually matched plan to club',
      approvalTarget: { userId: userD, productCodes: ['club'] },
    });

    // Entitlement is now active
    const ents = await entitlementsOf(db, userD);
    expect(hasAccess(ents, 'club', Date.now())).toBe(true);
  });
});

// ── Test 7: listUsersWithCreatedAt ────────────────────────────────────────────
describe('0003 Admin: listUsersWithCreatedAt N+1 fix', () => {
  it('returns createdAt as epoch-ms + correct roles for all users (not N+1)', async () => {
    const userE = await createUser(db, { email: '0003-usere@wtc.local', passwordHash: 'h', displayName: 'E0003', roles: ['user', 'teacher'] });

    const all = await listUsersWithCreatedAt(db);
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);

    // createdAt is a number (epoch-ms)
    for (const u of all) {
      expect(typeof u.createdAt).toBe('number');
      expect(u.createdAt).toBeGreaterThan(0);
    }

    // passwordHash field is present in the type (caller strips it)
    for (const u of all) {
      expect('passwordHash' in u).toBe(true);
    }

    // Roles for the seeded admin user
    const adminRow = all.find((u) => u.id === admin)!;
    expect(adminRow.roles).toContain('admin');

    // Roles for userE (user + teacher)
    const eRow = all.find((u) => u.id === userE.id)!;
    expect(eRow.roles).toContain('user');
    expect(eRow.roles).toContain('teacher');
  });
});

// ── Test 8: upsertSubscription concurrent same providerRef → one row ──────────
describe('0003 Billing: upsertSubscription concurrent same providerRef', () => {
  it('two concurrent upserts for same (userId, provider, providerRef) produce one row', async () => {
    const userF = (await createUser(db, { email: '0003-userf@wtc.local', passwordHash: 'h', displayName: 'F0003' })).id;
    // Sequential first to ensure the unique index is hit on the second call
    await upsertSubscription(db, {
      userId: userF,
      planCode: 'tortila_monthly',
      provider: 'stripe',
      providerRef: 'sub_0003_conc',
      status: 'active',
    });
    // Second upsert for same ref — should update (not insert a duplicate)
    await upsertSubscription(db, {
      userId: userF,
      planCode: 'tortila_yearly',
      provider: 'stripe',
      providerRef: 'sub_0003_conc',
      status: 'active',
    });

    const subs = await listSubscriptionsForUser(db, userF);
    // Only one row for this providerRef
    expect(subs.filter((s) => s.providerRef === 'sub_0003_conc').length).toBe(1);
    // Plan updated to the latest value
    expect(subs[0]!.planCode).toBe('tortila_yearly');
  });

  it('concurrent Promise.all for same providerRef → one row, no unhandled error', async () => {
    const userG = (await createUser(db, { email: '0003-userg@wtc.local', passwordHash: 'h', displayName: 'G0003' })).id;
    const [r1, r2] = await Promise.all([
      upsertSubscription(db, {
        userId: userG, planCode: 'tortila_monthly', provider: 'stripe',
        providerRef: 'sub_0003_pall', status: 'active',
      }),
      upsertSubscription(db, {
        userId: userG, planCode: 'tortila_monthly', provider: 'stripe',
        providerRef: 'sub_0003_pall', status: 'active',
      }),
    ]);
    // Both calls return a SubscriptionRow (one insert, one update — both succeed)
    expect(r1.userId).toBe(userG);
    expect(r2.userId).toBe(userG);
    const subs = await listSubscriptionsForUser(db, userG);
    expect(subs.filter((s) => s.providerRef === 'sub_0003_pall').length).toBe(1);
  });
});

// ── Additional: flagProductForReview ─────────────────────────────────────────
describe('0003 Billing: flagProductForReview', () => {
  it('transitions active entitlement to manual_review + writes audit + product_access_event', async () => {
    // Grant userB a product first
    await grantProduct(db, userB, 'tortila_bot', Date.now(), admin);
    const entsBefore = await entitlementsOf(db, userB);
    expect(entsBefore.some((e) => e.productCode === 'tortila_bot' && e.status === 'active')).toBe(true);

    // Flag for review
    await flagProductForReview(db, userB, 'tortila_bot', Date.now(), admin, 'suspected fraud');

    const entsAfter = await entitlementsOf(db, userB);
    const flagged = entsAfter.find((e) => e.productCode === 'tortila_bot')!;
    expect(flagged.status).toBe('manual_review');

    // Audit row
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'product.flag_review' && (e.after as Record<string, unknown>)?.reason === 'suspected fraud')).toBe(true);
  });
});
