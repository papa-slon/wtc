/**
 * Billing webhook hardening follow-up (Phase 3.4 gap closure).
 *
 * Uses signed fake Stripe webhook bodies only. No Stripe network calls.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import {
  schema,
  seedDatabase,
  createUser,
  createNotification,
  createManualReviewItem,
  getWebhookEventByProviderEvent,
  insertWebhookEventOnce,
  isBillingWebhookTerminalStatus,
  listNotifications,
  listManualReviewItems,
  listUsers,
  updateWebhookEventStatus,
  type Db,
} from '@wtc/db';
import { createStripeProvider, mapProviderEvent, signWebhook, type NormalizedEvent } from '@wtc/billing';

const TEST_SECRET = 'whsec_hardening_fake';
const NOW_MS = 1_900_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);

let db: Db;
let userId: string;
let adminId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userId = (await createUser(db, {
    email: 'billing-hardening-user@wtc.local',
    passwordHash: 'h',
    displayName: 'Billing Hardening User',
  })).id;
  const admin = (await listUsers(db)).find((u) => u.roles.includes('admin'));
  expect(admin).toBeDefined();
  adminId = admin!.id;
});

function signedCheckoutBody(eventId: string, metadata: Record<string, string>): { raw: string; sig: string } {
  const raw = JSON.stringify({
    id: eventId,
    type: 'checkout.session.completed',
    data: { object: { metadata } },
  });
  return { raw, sig: signWebhook(raw, TEST_SECRET, NOW_SEC) };
}

async function parseSignedEvent(eventId: string, metadata: Record<string, string>): Promise<NormalizedEvent> {
  const provider = createStripeProvider({ webhookSecret: TEST_SECRET });
  const { raw, sig } = signedCheckoutBody(eventId, metadata);
  const event = await provider.parseWebhook(raw, sig, NOW_MS);
  expect(event).not.toBeNull();
  return event!;
}

async function simulateManualReviewRoutePath(event: NormalizedEvent, reason: 'missing_user_id' | 'unknown_plan_code') {
  const billingEvent = mapProviderEvent(event.type);
  const dedup = await insertWebhookEventOnce(db, {
    provider: 'stripe',
    eventId: event.id,
    eventType: event.type,
    userId: event.userId ?? null,
    planCode: event.planCode ?? null,
    billingEvent,
    status: 'processing',
    productsChanged: 0,
  });
  expect(dedup.isDuplicate).toBe(false);

  await createManualReviewItem(db, {
    provider: 'stripe',
    eventId: event.id,
    eventType: event.type,
    userId: event.userId ?? null,
    reason,
    eventSnapshot: { id: event.id, type: event.type, planCode: event.planCode ?? null },
  });
  for (const adminUser of (await listUsers(db)).filter((u) => u.roles.includes('admin'))) {
    await createNotification(db, {
      userId: adminUser.id,
      type: 'billing_manual_review',
      title: 'Billing event requires manual review',
      body: `Webhook event ${event.id} (${event.type}) requires manual review (${reason}). Review at /admin/entitlements/review.`,
      linkUrl: '/admin/entitlements/review',
    });
  }
  await updateWebhookEventStatus(db, 'stripe', event.id, 'manual_review', 0);
}

async function ledgerStatus(eventId: string): Promise<string | undefined> {
  const [row] = await db.select().from(schema.billingWebhookEvents).where(
    and(
      eq(schema.billingWebhookEvents.provider, 'stripe'),
      eq(schema.billingWebhookEvents.eventId, eventId),
    ),
  );
  return row?.status;
}

describe('billing webhook ambiguous metadata hardening', () => {
  it('signed event with missing planCode creates manual_review, admin notification, and manual_review ledger', async () => {
    const eventId = 'evt_hardening_missing_plan';
    const event = await parseSignedEvent(eventId, { userId });
    expect(event.userId).toBe(userId);
    expect(event.planCode).toBeUndefined();

    await simulateManualReviewRoutePath(event, 'unknown_plan_code');

    const items = await listManualReviewItems(db, { status: 'pending' });
    const item = items.find((i) => i.eventId === eventId);
    expect(item).toBeDefined();
    expect(item!.reason).toBe('unknown_plan_code');
    expect(item!.userId).toBe(userId);
    expect(item!.eventSnapshot).toEqual({ id: eventId, type: 'checkout.session.completed', planCode: null });
    expect(await ledgerStatus(eventId)).toBe('manual_review');

    const notifications = await listNotifications(db, adminId);
    expect(notifications.some((n) => n.type === 'billing_manual_review' && n.body.includes(eventId))).toBe(true);
  });

  it('signed event with unknown planCode creates manual_review, admin notification, and manual_review ledger', async () => {
    const eventId = 'evt_hardening_unknown_plan';
    const event = await parseSignedEvent(eventId, { userId, planCode: 'unknown_plan_xyz' });
    expect(event.userId).toBe(userId);
    expect(event.planCode).toBe('unknown_plan_xyz');

    await simulateManualReviewRoutePath(event, 'unknown_plan_code');

    const items = await listManualReviewItems(db, { status: 'pending' });
    const item = items.find((i) => i.eventId === eventId);
    expect(item).toBeDefined();
    expect(item!.reason).toBe('unknown_plan_code');
    expect(item!.userId).toBe(userId);
    expect(item!.eventSnapshot).toEqual({ id: eventId, type: 'checkout.session.completed', planCode: 'unknown_plan_xyz' });
    expect(await ledgerStatus(eventId)).toBe('manual_review');

    const notifications = await listNotifications(db, adminId);
    expect(notifications.some((n) => n.type === 'billing_manual_review' && n.body.includes(eventId))).toBe(true);
  });

  it('route source uses manual_review status for missing user and plan-code ambiguity', () => {
    const handler = readFileSync(
      join(process.cwd(), 'apps', 'web', 'src', 'features', 'billing', 'webhook-handler.ts'),
      'utf8',
    );
    expect(handler).toContain("await createBillingManualReview(db, event, 'missing_user_id'");
    expect(handler).toContain("await createBillingManualReview(db, event, 'unknown_plan_code'");
    expect(handler).toContain("status: 'processing'");
    expect(handler).toContain('isBillingWebhookTerminalStatus(existing.status)');
    expect(handler.match(/updateWebhookEventStatus\(db, 'stripe', event\.id, 'manual_review', 0\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(handler).not.toContain("updateWebhookEventStatus(db, 'stripe', event.id, 'no_op', 0)");
  });

  it('ledger starts non-terminal and duplicate success is reserved for terminal statuses', async () => {
    const eventId = 'evt_hardening_processing_state';
    const dedup = await insertWebhookEventOnce(db, {
      provider: 'stripe',
      eventId,
      eventType: 'checkout.session.completed',
      userId,
      planCode: 'club_monthly',
      billingEvent: 'payment_succeeded',
      status: 'processing',
      productsChanged: 0,
    });
    expect(dedup.isDuplicate).toBe(false);
    const processing = await getWebhookEventByProviderEvent(db, 'stripe', eventId);
    expect(processing?.status).toBe('processing');
    expect(isBillingWebhookTerminalStatus(processing!.status)).toBe(false);

    await updateWebhookEventStatus(db, 'stripe', eventId, 'applied', 1);
    const applied = await getWebhookEventByProviderEvent(db, 'stripe', eventId);
    expect(applied?.status).toBe('applied');
    expect(isBillingWebhookTerminalStatus(applied!.status)).toBe(true);
  });
});
