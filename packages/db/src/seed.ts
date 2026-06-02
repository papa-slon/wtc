/**
 * Seed demo data: roles, the product catalog, plan registry, demo users, sample entitlements,
 * and a sample course. Idempotent via onConflictDoNothing. Uses the entitlements registry as the
 * single source of product/plan codes. Never seeds real secrets.
 */
import { PRODUCTS, PLANS } from '@wtc/entitlements';
import { hashPassword } from '@wtc/auth';
import { and, eq } from 'drizzle-orm';
import type { Db } from './client.ts';
import { users, roles, userRoles, products, plans, entitlements, courses } from './schema.ts';

export const DEMO_PASSWORD = 'wtc-demo-pass-123';

export async function seedDatabase(db: Db): Promise<void> {
  await db.insert(roles).values([{ code: 'user' }, { code: 'teacher' }, { code: 'admin' }, { code: 'support' }]).onConflictDoNothing();

  await db
    .insert(products)
    .values(Object.values(PRODUCTS).map((p) => ({ code: p.code, slug: p.slug, name: p.name })))
    .onConflictDoNothing();

  await db
    .insert(plans)
    .values(Object.values(PLANS).map((p) => ({ code: p.code, name: p.name, billing: p.billing, kind: p.kind, products: p.products })))
    .onConflictDoNothing();

  const hash = await hashPassword(DEMO_PASSWORD);
  const demo = [
    { email: 'admin@wtc.local', displayName: 'WTC Admin', role: 'admin' },
    { email: 'teacher@wtc.local', displayName: 'WTC Teacher', role: 'teacher' },
    { email: 'user@wtc.local', displayName: 'WTC User', role: 'user' },
  ];

  for (const d of demo) {
    const inserted = await db.insert(users).values({ email: d.email, passwordHash: hash, displayName: d.displayName }).onConflictDoNothing().returning({ id: users.id });
    const existing = inserted[0] ? null : await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
    const userId = inserted[0]?.id ?? existing?.[0]?.id;
    if (!userId) throw new Error(`seed failed to resolve demo user ${d.email}`);

    await db.insert(userRoles).values({ userId, roleCode: d.role }).onConflictDoNothing();
    await db.insert(userRoles).values({ userId, roleCode: 'user' }).onConflictDoNothing();

    if (d.role === 'user') {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 365 * 86_400_000);
      await db.insert(entitlements).values([
        { userId, productCode: 'tortila_bot', status: 'active', source: 'subscription', planCode: 'tortila_yearly', startsAt: now, currentPeriodEnd: periodEnd },
        { userId, productCode: 'legacy_bot', status: 'active', source: 'subscription', planCode: 'legacy_monthly', startsAt: now, currentPeriodEnd: periodEnd },
        { userId, productCode: 'axioma_terminal', status: 'active', source: 'subscription', planCode: 'axioma_yearly', startsAt: now, currentPeriodEnd: periodEnd },
        { userId, productCode: 'education', status: 'active', source: 'one_time', planCode: 'education_lifetime', startsAt: now },
      ]).onConflictDoNothing(); // idempotent re-seed; relies on the unique (user_id, product_code) index
    }
    if (d.role === 'teacher') {
      const existingCourse = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.ownerTeacherId, userId), eq(courses.title, 'Risk Management Fundamentals')))
        .limit(1);
      if (!existingCourse[0]) {
        await db.insert(courses).values({ ownerTeacherId: userId, title: 'Risk Management Fundamentals', description: 'Position sizing, drawdown control, and journaling.', productCode: 'education', published: true });
      }
    }
  }
}
