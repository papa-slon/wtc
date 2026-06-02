/**
 * Billing webhook handler harness.
 *
 * Executes signed Request objects through the same extracted handler used by
 * apps/web/src/app/api/billing/webhook/route.ts. No Stripe network calls.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import {
  schema,
  seedDatabase,
  createUser,
  entitlementsOf,
  getWebhookEventByProviderEvent,
  insertWebhookEventOnce,
  listManualReviewItems,
  listNotifications,
  listProductAccessEvents,
  listUsers,
  type Db,
} from '@wtc/db';
import { hasAccess } from '@wtc/entitlements';
import { signWebhook } from '@wtc/billing';
import {
  handleBillingWebhookRequest,
  WEBHOOK_PROCESSING_STALE_MS,
} from '../../apps/web/src/features/billing/webhook-handler.ts';

const TEST_SECRET = 'whsec_route_handler_fake';
const NOW_MS = Date.now();
const NOW_SEC = Math.floor(NOW_MS / 1000);
const QUIET_LOG = { log() {}, error() {} };

let db: Db;
let userId: string;
let adminId: string;

beforeEach(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userId = (await createUser(db, {
    email: `billing-route-${crypto.randomUUID()}@wtc.local`,
    passwordHash: 'h',
    displayName: 'Billing Route User',
  })).id;
  const admin = (await listUsers(db)).find((u) => u.roles.includes('admin'));
  expect(admin).toBeDefined();
  adminId = admin!.id;
});

function checkoutRaw(eventId: string, metadata: Record<string, string>): string {
  return JSON.stringify({
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: metadata.userId,
        metadata,
        subscription: `sub_${eventId}`,
        current_period_end: Math.floor((NOW_MS + 30 * 24 * 60 * 60 * 1000) / 1000),
        status: 'active',
      },
    },
  });
}

function signedRequest(raw: string, secret = TEST_SECRET): Request {
  return new Request('https://wtc.local/api/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': signWebhook(raw, secret, NOW_SEC) },
    body: raw,
  });
}

function unsignedRequest(raw: string): Request {
  return new Request('https://wtc.local/api/billing/webhook', {
    method: 'POST',
    body: raw,
  });
}

function handle(req: Request): Promise<Response> {
  return handleBillingWebhookRequest(req, {
    db,
    env: { STRIPE_WEBHOOK_SECRET: TEST_SECRET, NODE_ENV: 'production' },
    now: NOW_MS,
    log: QUIET_LOG,
  });
}

async function ledgerStatus(eventId: string): Promise<string | undefined> {
  return (await getWebhookEventByProviderEvent(db, 'stripe', eventId))?.status;
}

describe('billing webhook extracted route handler', () => {
  it('rejects missing signature before writing the durable ledger', async () => {
    const eventId = 'evt_route_missing_sig';
    const res = await handle(unsignedRequest(checkoutRaw(eventId, { userId, planCode: 'club_monthly' })));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'signature_invalid' });
    expect(await ledgerStatus(eventId)).toBeUndefined();
  });

  it('rejects an invalid signature before writing the durable ledger', async () => {
    const eventId = 'evt_route_bad_sig';
    const res = await handle(signedRequest(checkoutRaw(eventId, { userId, planCode: 'club_monthly' }), 'wrong-secret'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: 'signature_invalid' });
    expect(await ledgerStatus(eventId)).toBeUndefined();
  });

  it('applies a valid checkout event, then treats terminal duplicate delivery as a 200 no-op', async () => {
    const eventId = 'evt_route_valid_checkout';
    const raw = checkoutRaw(eventId, { userId, planCode: 'club_monthly' });

    const first = await handle(signedRequest(raw));
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ received: true });
    expect(await ledgerStatus(eventId)).toBe('applied');
    expect(hasAccess(await entitlementsOf(db, userId), 'club', NOW_MS)).toBe(true);
    const afterFirstEvents = await listProductAccessEvents(db, userId, { productCode: 'club' });
    expect(afterFirstEvents.filter((event) => event.reason === 'payment_succeeded')).toHaveLength(1);

    const duplicate = await handle(signedRequest(raw));
    expect(duplicate.status).toBe(200);
    await expect(duplicate.json()).resolves.toEqual({ received: true });
    const afterDuplicateEvents = await listProductAccessEvents(db, userId, { productCode: 'club' });
    expect(afterDuplicateEvents.filter((event) => event.reason === 'payment_succeeded')).toHaveLength(1);
  });

  it('returns retryable 500 for a duplicate event still in processing', async () => {
    const eventId = 'evt_route_processing_duplicate';
    await insertWebhookEventOnce(db, {
      provider: 'stripe',
      eventId,
      eventType: 'checkout.session.completed',
      userId,
      planCode: 'club_monthly',
      billingEvent: 'payment_succeeded',
      status: 'processing',
      productsChanged: 0,
    });
    await db
      .update(schema.billingWebhookEvents)
      .set({ processedAt: new Date(NOW_MS) })
      .where(and(eq(schema.billingWebhookEvents.provider, 'stripe'), eq(schema.billingWebhookEvents.eventId, eventId)));

    const res = await handle(signedRequest(checkoutRaw(eventId, { userId, planCode: 'club_monthly' })));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: 'webhook_processing' });
    expect(await ledgerStatus(eventId)).toBe('processing');
    expect(await entitlementsOf(db, userId)).toEqual([]);
  });

  it('deletes a stale processing ledger row and returns retryable 500', async () => {
    const eventId = 'evt_route_stale_processing';
    await insertWebhookEventOnce(db, {
      provider: 'stripe',
      eventId,
      eventType: 'checkout.session.completed',
      userId,
      planCode: 'club_monthly',
      billingEvent: 'payment_succeeded',
      status: 'processing',
      productsChanged: 0,
    });
    await db
      .update(schema.billingWebhookEvents)
      .set({ processedAt: new Date(NOW_MS - WEBHOOK_PROCESSING_STALE_MS - 1000) })
      .where(and(eq(schema.billingWebhookEvents.provider, 'stripe'), eq(schema.billingWebhookEvents.eventId, eventId)));

    const res = await handle(signedRequest(checkoutRaw(eventId, { userId, planCode: 'club_monthly' })));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: 'webhook_processing' });
    expect(await ledgerStatus(eventId)).toBeUndefined();
  });

  it('creates manual_review and admin notification for a signed event missing userId', async () => {
    const eventId = 'evt_route_missing_user';
    const res = await handle(signedRequest(checkoutRaw(eventId, { planCode: 'club_monthly' })));

    expect(res.status).toBe(200);
    expect(await ledgerStatus(eventId)).toBe('manual_review');
    const review = (await listManualReviewItems(db, { status: 'pending' })).find((item) => item.eventId === eventId);
    expect(review?.reason).toBe('missing_user_id');
    expect(review?.eventSnapshot).toEqual({ id: eventId, type: 'checkout.session.completed', planCode: 'club_monthly' });
    const notifications = await listNotifications(db, adminId);
    expect(notifications.some((n) => n.type === 'billing_manual_review' && n.body.includes(eventId))).toBe(true);
  });

  it('creates manual_review and no entitlement for a signed event with unknown planCode', async () => {
    const eventId = 'evt_route_unknown_plan';
    const res = await handle(signedRequest(checkoutRaw(eventId, { userId, planCode: 'unknown_plan_xyz' })));

    expect(res.status).toBe(200);
    expect(await ledgerStatus(eventId)).toBe('manual_review');
    expect(await entitlementsOf(db, userId)).toEqual([]);
    const review = (await listManualReviewItems(db, { status: 'pending' })).find((item) => item.eventId === eventId);
    expect(review?.reason).toBe('unknown_plan_code');
    expect(review?.eventSnapshot).toEqual({ id: eventId, type: 'checkout.session.completed', planCode: 'unknown_plan_xyz' });
    const notifications = await listNotifications(db, adminId);
    expect(notifications.some((n) => n.type === 'billing_manual_review' && n.body.includes(eventId))).toBe(true);
  });
});
