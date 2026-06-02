/**
 * Billing webhook integration tests (PGlite — real Postgres engine, no Docker).
 * Tests the @wtc/billing verify/parse package + the applyStripeEvent repo that the webhook
 * route wires together. Route handlers themselves are excluded from Vitest.
 *
 * Cases:
 *   BW-001  valid checkout.session.completed -> entitlement granted + product_access_events row
 *   BW-002  tampered body (wrong signature) -> parseWebhook returns null
 *   BW-003  wrong secret -> parseWebhook returns null
 *   BW-004  duplicate event.id -> applyStripeEvent returns {applied:false}, no second PAE row
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
  type Db,
} from '@wtc/db';
import { hasAccess } from '@wtc/entitlements';
import { createStripeProvider } from '@wtc/billing';
import { signWebhook } from '@wtc/billing';

// Short, obviously-fake test secret — NOT a real credential.
const TEST_SECRET = 'whsec_testfake';
// Fixed timestamp (ms) so timestamp-tolerance math is deterministic.
const NOW_MS = 1_900_000_000_000;
const NOW_SEC = Math.floor(NOW_MS / 1000);

function makeCheckoutEvent(eventId: string, userId: string, planCode: string): string {
  return JSON.stringify({
    id: eventId,
    type: 'checkout.session.completed',
    data: { object: { metadata: { userId, planCode } } },
  });
}

let db: Db;
let userId: string;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userId = (await createUser(db, { email: 'bw-user@wtc.local', passwordHash: 'h', displayName: 'BW User' })).id;
});

describe('BW-002 / BW-003 — verify-first: invalid signatures rejected', () => {
  const provider = createStripeProvider({ webhookSecret: TEST_SECRET });

  it('BW-002 tampered body (signature no longer matches) -> parseWebhook returns null', async () => {
    const body = makeCheckoutEvent('evt_bw_tamper', userId, 'axioma_monthly');
    const header = signWebhook(body, TEST_SECRET, NOW_SEC);
    // Tamper with the body AFTER signing — HMAC no longer matches.
    const tampered = body.replace(userId, 'attacker-injected-id');
    const result = await provider.parseWebhook(tampered, header, NOW_MS);
    expect(result).toBeNull();
  });

  it('BW-003 wrong secret -> parseWebhook returns null', async () => {
    const body = makeCheckoutEvent('evt_bw_wrongsec', userId, 'axioma_monthly');
    // Sign with the WRONG secret so verification fails.
    const header = signWebhook(body, 'whsec_completelywrong', NOW_SEC);
    const result = await provider.parseWebhook(body, header, NOW_MS);
    expect(result).toBeNull();
  });
});

describe('BW-001 — valid checkout.session.completed grants entitlement + writes PAE row', () => {
  it('applies event, grants axioma_terminal, writes product_access_events row (toState=active)', async () => {
    // Simulate route: parseWebhook succeeds -> applyStripeEvent with extracted info.
    const r = await applyStripeEvent(
      db,
      {
        stripeEventId: 'evt_bw_checkout_001',
        billingEvent: 'payment_succeeded',
        userId,
        productCodes: ['axioma_terminal'],
        planCode: 'axioma_monthly',
      },
      NOW_MS,
    );

    expect(r.applied).toBe(true);
    expect(r.productsChanged).toBe(1);

    // Entitlement is active (hasAccess = true).
    const ents = await entitlementsOf(db, userId);
    expect(hasAccess(ents, 'axioma_terminal', NOW_MS)).toBe(true);

    // product_access_events row written with correct toState.
    const events = await listProductAccessEvents(db, userId, { productCode: 'axioma_terminal' });
    expect(events.length).toBeGreaterThan(0);
    const pae = events.find((e) => e.toState === 'active');
    expect(pae).toBeDefined();
    expect(pae!.userId).toBe(userId);
    expect(pae!.productCode).toBe('axioma_terminal');
    expect(pae!.actorType).toBe('billing_webhook');
  });
});

describe('BW-004 — duplicate event.id -> idempotent (no second PAE row)', () => {
  it('replays the same event id, returns {applied:false}, product_access_events count unchanged', async () => {
    // First apply (same eventId as BW-001 — relies on beforeAll shared db).
    // Use a fresh event id specific to this idempotency test.
    const eventId = 'evt_bw_idem_004';
    const user2Id = (await createUser(db, { email: 'bw-idem@wtc.local', passwordHash: 'h', displayName: 'Idem' })).id;

    const first = await applyStripeEvent(
      db,
      { stripeEventId: eventId, billingEvent: 'payment_succeeded', userId: user2Id, productCodes: ['education'], planCode: 'education_lifetime' },
      NOW_MS,
    );
    expect(first.applied).toBe(true);
    const afterFirst = await listProductAccessEvents(db, user2Id, { productCode: 'education' });
    const countAfterFirst = afterFirst.length;

    // Replay — must be idempotent.
    const replay = await applyStripeEvent(
      db,
      { stripeEventId: eventId, billingEvent: 'payment_succeeded', userId: user2Id, productCodes: ['education'], planCode: 'education_lifetime' },
      NOW_MS,
    );
    expect(replay.applied).toBe(false);
    expect(replay.productsChanged).toBe(0);

    // No second PAE row written.
    const afterReplay = await listProductAccessEvents(db, user2Id, { productCode: 'education' });
    expect(afterReplay.length).toBe(countAfterFirst);
  });
});
