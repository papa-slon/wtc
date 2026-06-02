import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createPendingPaymentForPlan,
  createUser,
  entitlementsOf,
  grantProduct,
  listProductAccessEvents,
  schema,
  seedDatabase,
  type Db,
} from '@wtc/db';
import { hasAccess } from '@wtc/entitlements';

let db: Db;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const file of readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, file), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
});

describe('Phase 3.4 billing checkout pending-payment flow', () => {
  it('marks checkout-created products as pending_payment without granting access', async () => {
    const user = await createUser(db, { email: 'checkout-pending@wtc.local', passwordHash: 'phc', displayName: 'Checkout Pending' });
    const result = await createPendingPaymentForPlan(db, {
      userId: user.id,
      planCode: 'bundle_starter',
      productCodes: ['tortila_bot', 'education'],
      source: 'bundle',
      provider: 'stripe',
      checkoutSessionId: 'cs_test_pending_1',
    });

    expect(result.productsChanged).toBe(2);
    const ents = await entitlementsOf(db, user.id);
    expect(ents.map((e) => [e.productCode, e.status, e.planCode])).toContainEqual(['tortila_bot', 'pending_payment', 'bundle_starter']);
    expect(hasAccess(ents, 'tortila_bot', Date.now())).toBe(false);
    const events = await listProductAccessEvents(db, user.id);
    expect(events.filter((e) => e.reason === 'billing.checkout_created')).toHaveLength(2);
  });

  it('does not downgrade an existing manual grant to pending_payment', async () => {
    const user = await createUser(db, { email: 'checkout-manual@wtc.local', passwordHash: 'phc', displayName: 'Checkout Manual' });
    await grantProduct(db, user.id, 'education');
    const result = await createPendingPaymentForPlan(db, {
      userId: user.id,
      planCode: 'education_lifetime',
      productCodes: ['education'],
      source: 'one_time',
      provider: 'stripe',
      checkoutSessionId: 'cs_test_pending_2',
    });

    expect(result.productsChanged).toBe(0);
    const ents = await entitlementsOf(db, user.id);
    expect(hasAccess(ents, 'education', Date.now())).toBe(true);
    expect(ents.find((e) => e.productCode === 'education')?.status).toBe('active');
  });
});
