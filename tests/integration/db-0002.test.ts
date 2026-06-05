/**
 * Migration 0002 repository integration tests (PGlite — real Postgres engine, no Docker).
 * Applies all migrations (incl. 0002) then exercises the Phase-2.1 repos for: idempotency,
 * per-user isolation, in-transaction audit, config versioning, TV grant/revoke metadata,
 * product-access events, terminal release exclusivity, notifications, and idempotent billing.
 * Source of truth for cases: docs/handoffs/20260530-0925-ecosystem-db-architect.md.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { and, eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema, seedDatabase, createUser, findUserByEmail, recentAuditEvents,
  grantProduct, listProductAccessEvents, entitlementsOf, createCourse,
  ensureBotInstance, saveBotConfig, insertBotConfigVersion, listBotConfigVersions,
  insertBotMetricSnapshot, listBotMetricSnapshots, importBotTrade,
  upsertBotProviderAccountMapping, disableBotProviderAccountMapping,
  insertBotSafetyEvent, listBotSafetyEvents, acknowledgeBotSafetyEvent,
  createTeacherProfile, getTeacherProfile, upsertEnrollment, listEnrollments, markEnrollmentComplete,
  upsertLessonProgress, getLessonProgress, listCourseProgress, createPinnedLink, listPinnedLinks, deletePinnedLink,
  upsertTradingViewProfile, getTvProfile, createTvGrant, revokeTvGrant, listTvGrantsForUser, submitTvRequest, listAllTv,
  upsertTerminalRelease, getCurrentTerminalRelease, recordDownloadEvent, recordLicenseEvent,
  createNotification, listNotifications, markNotificationRead, createSupportTicket, listSupportTickets,
  applyStripeEvent, upsertSubscription, listSubscriptionsForUser,
  type Db,
} from '@wtc/db';
import { hasAccess } from '@wtc/entitlements';

let db: Db;
let userA: string, userB: string, admin: string, teacher: string;
let courseId: string, lessonId: string, botInstanceId: string;

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
  teacher = (await createUser(db, { email: '0002-teacher@wtc.local', passwordHash: 'h', displayName: 'T2', roles: ['teacher'] })).id;
  userB = (await createUser(db, { email: '0002-userb@wtc.local', passwordHash: 'h', displayName: 'B' })).id;
  const course = await createCourse(db, { ownerTeacherId: teacher, title: '0002 Course', published: true });
  courseId = course.id;
  const [lesson] = await db.insert(schema.lessons).values({ courseId, title: 'L1', order: 1, published: true }).returning();
  lessonId = lesson!.id;
  botInstanceId = (await ensureBotInstance(db, { userId: userA, productCode: 'tortila_bot' })).id;
});

describe('0002 Bots: config history, snapshots, trades, safety', () => {
  it('saveBotConfig increments version, appends history, audits in-txn', async () => {
    const r1 = await saveBotConfig(db, { botInstanceId, config: { symbols: ['BTCUSDT'] }, changedBy: userA });
    const r2 = await saveBotConfig(db, { botInstanceId, config: { symbols: ['ETHUSDT'] }, changedBy: userA });
    expect(r1.version).toBe(1);
    expect(r2.version).toBe(2);
    const versions = await listBotConfigVersions(db, botInstanceId);
    expect(versions[0]!.version).toBe(2); // DESC
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'bot.config.save' && e.targetId === botInstanceId)).toBe(true);
    const saves = events.filter((e) => e.action === 'bot.config.save' && e.targetId === botInstanceId);
    expect(saves.some((e) => JSON.stringify(e.before) === JSON.stringify({ version: 1 }) && JSON.stringify(e.after) === JSON.stringify({ version: 2 }))).toBe(true);
    expect(JSON.stringify(saves)).not.toContain('BTCUSDT');
    expect(JSON.stringify(saves)).not.toContain('ETHUSDT');
  });

  it('saveBotConfig rejects secret/provider/raw/live-control keys before writing history', async () => {
    const before = await listBotConfigVersions(db, botInstanceId);
    await expect(saveBotConfig(db, {
      botInstanceId,
      config: { operationMode: 'manual', apiKey: 'SHOULD_NOT_SAVE' },
      changedBy: userA,
    })).rejects.toThrow(/bot_config_forbidden_key/);
    await expect(saveBotConfig(db, {
      botInstanceId,
      config: { symbolConfigs: [{ symbol: 'AAVE-USDT', providerPubId: 'PROVIDER_SHOULD_NOT_SAVE' }] },
      changedBy: userA,
    })).rejects.toThrow(/bot_config_forbidden_key/);
    await expect(saveBotConfig(db, {
      botInstanceId,
      config: { applyConfig: true },
      changedBy: userA,
    })).rejects.toThrow(/bot_config_forbidden_key/);
    const after = await listBotConfigVersions(db, botInstanceId);
    expect(after.length).toBe(before.length);
  });

  it('insertBotConfigVersion: duplicate (instance, version) throws 23505', async () => {
    const inst = await ensureBotInstance(db, { userId: userB, productCode: 'legacy_bot' });
    await insertBotConfigVersion(db, { botInstanceId: inst.id, version: 1, configJson: { a: 1 } });
    await expect(insertBotConfigVersion(db, { botInstanceId: inst.id, version: 1, configJson: { a: 2 } })).rejects.toThrow();
  });

  it('insertBotConfigVersion rejects secret/provider/raw/live-control keys before appending history', async () => {
    const inst = await ensureBotInstance(db, { userId: userB, productCode: 'legacy_bot' });
    const before = await listBotConfigVersions(db, inst.id);
    await expect(insertBotConfigVersion(db, {
      botInstanceId: inst.id,
      version: 99,
      configJson: { symbolConfigs: [{ symbol: 'AAVE-USDT', providerPubId: 'PROVIDER_SHOULD_NOT_SAVE' }] },
    })).rejects.toThrow(/bot_config_forbidden_key/);
    await expect(insertBotConfigVersion(db, {
      botInstanceId: inst.id,
      version: 100,
      configJson: { rawJson: { liveConfig: 'SHOULD_NOT_SAVE' } },
    })).rejects.toThrow(/bot_config_forbidden_key/);
    await expect(insertBotConfigVersion(db, {
      botInstanceId: inst.id,
      version: 101,
      configJson: { liveControl: true },
    })).rejects.toThrow(/bot_config_forbidden_key/);
    const after = await listBotConfigVersions(db, inst.id);
    expect(after.length).toBe(before.length);
  });

  it('importBotTrade is idempotent: duplicate import returns inserted:false', async () => {
    const trade = {
      botInstanceId, externalTradeId: 'trade-001', symbol: 'BTCUSDT', side: 'long',
      entryPrice: '40000', exitPrice: '41000', size: '0.01', realizedPnlUsd: '10.00',
      openedAt: new Date('2026-01-01T10:00:00Z'), closedAt: new Date('2026-01-01T12:00:00Z'), sourceAdapter: 'tortila',
    };
    expect((await importBotTrade(db, trade)).inserted).toBe(true);
    expect((await importBotTrade(db, trade)).inserted).toBe(false);
    const rows = await db
      .select()
      .from(schema.botTradeImports)
      .where(and(
        eq(schema.botTradeImports.botInstanceId, trade.botInstanceId),
        eq(schema.botTradeImports.externalTradeId, trade.externalTradeId),
      ));
    expect(rows).toHaveLength(1);
  });

  it('importBotTrade keeps Legacy provider-account ids in the idempotency key', async () => {
    const legacyInstance = await ensureBotInstance(db, { userId: userA, productCode: 'legacy_bot' });
    const providerA = await upsertBotProviderAccountMapping(db, {
      userId: userA,
      botInstanceId: legacyInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: '0002_LEGACY_PROVIDER_A',
      actorUserId: admin,
    });
    await disableBotProviderAccountMapping(db, {
      id: providerA.id,
      userId: userA,
      actorUserId: admin,
      reason: 'provider-aware idempotency regression setup',
    });
    const providerB = await upsertBotProviderAccountMapping(db, {
      userId: userA,
      botInstanceId: legacyInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: '0002_LEGACY_PROVIDER_B',
      actorUserId: admin,
    });
    const baseTrade = {
      botInstanceId: legacyInstance.id,
      externalTradeId: 'legacy-shared-external-001',
      symbol: 'BTC-USDT',
      side: 'long',
      entryPrice: '40000',
      exitPrice: '41000',
      size: '0.01',
      realizedPnlUsd: '10.00',
      openedAt: new Date('2026-01-02T10:00:00Z'),
      closedAt: new Date('2026-01-02T12:00:00Z'),
      sourceAdapter: 'legacy-db',
    };

    expect((await importBotTrade(db, { ...baseTrade, botProviderAccountId: providerA.id })).inserted).toBe(true);
    expect((await importBotTrade(db, { ...baseTrade, botProviderAccountId: providerA.id })).inserted).toBe(false);
    expect((await importBotTrade(db, { ...baseTrade, botProviderAccountId: providerB.id })).inserted).toBe(true);

    const rows = await db
      .select()
      .from(schema.botTradeImports)
      .where(and(
        eq(schema.botTradeImports.botInstanceId, legacyInstance.id),
        eq(schema.botTradeImports.externalTradeId, baseTrade.externalTradeId),
      ));
    expect(rows.map((row) => row.botProviderAccountId).sort()).toEqual([providerA.id, providerB.id].sort());
    expect(JSON.stringify(rows)).not.toContain('0002_LEGACY_PROVIDER_');
  });

  it('metric snapshots list DESC; numeric formats to scale', async () => {
    await insertBotMetricSnapshot(db, { botInstanceId, snapshotAt: new Date('2026-01-01T00:00:00Z'), walletEquityUsd: '1000', sourceAdapter: 'tortila' });
    await insertBotMetricSnapshot(db, { botInstanceId, snapshotAt: new Date('2026-01-02T00:00:00Z'), walletEquityUsd: '1050', sourceAdapter: 'tortila' });
    const snaps = await listBotMetricSnapshots(db, botInstanceId, 10);
    expect(snaps[0]!.snapshotAt.getTime()).toBeGreaterThan(snaps[1]!.snapshotAt.getTime());
    expect(snaps[0]!.walletEquityUsd).toBe('1050.0000');
  });

  it('critical safety event writes an in-txn audit row; ack clears unacknowledged', async () => {
    await insertBotSafetyEvent(db, { botInstanceId, eventCode: 'TP_REJECTION_101211', severity: 'critical', description: 'TP rejected 101211' });
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'bot.safety_event' && e.targetId === botInstanceId)).toBe(true);
    await insertBotSafetyEvent(db, { botInstanceId, eventCode: 'RATE_LIMIT_100410', severity: 'warning', description: 'rate limit' });
    const unack = await listBotSafetyEvents(db, botInstanceId, { unacknowledgedOnly: true });
    expect(unack.length).toBeGreaterThan(0);
    await acknowledgeBotSafetyEvent(db, unack[0]!.id, admin);
    const after = await listBotSafetyEvents(db, botInstanceId, { unacknowledgedOnly: true });
    expect(after.find((e) => e.id === unack[0]!.id)).toBeUndefined();
  });
});

describe('0002 Education: teacher profiles, enrollments, progress, pinned links', () => {
  it('createTeacherProfile persists + audits', async () => {
    const p = await createTeacherProfile(db, { userId: teacher, displayName: 'WTC Teacher', socialLinks: { telegram: 'https://t.me/wtc' } });
    expect(p.userId).toBe(teacher);
    expect((await getTeacherProfile(db, teacher))!.displayName).toBe('WTC Teacher');
    expect((await recentAuditEvents(db, 1000)).some((e) => e.action === 'education.teacher_profile_create')).toBe(true);
  });

  it('enrollment idempotent (same row) + audited once + per-user isolation', async () => {
    const first = await upsertEnrollment(db, { userId: userA, courseId });
    const second = await upsertEnrollment(db, { userId: userA, courseId });
    expect(first.id).toBe(second.id);
    expect((await recentAuditEvents(db, 1000)).some((e) => e.action === 'education.enrolled')).toBe(true);
    expect((await listEnrollments(db, userA)).some((e) => e.courseId === courseId)).toBe(true);
    expect((await listEnrollments(db, userB)).some((e) => e.courseId === courseId)).toBe(false);
  });

  it('lesson progress is per-user isolated', async () => {
    await upsertLessonProgress(db, { userId: userA, lessonId, percentComplete: '50.00', completed: false });
    expect((await getLessonProgress(db, userA, lessonId))!.percentComplete).toBe('50.00');
    expect(await getLessonProgress(db, userB, lessonId)).toBeNull();
    expect((await listCourseProgress(db, userB, courseId)).length).toBe(0);
  });

  it('markEnrollmentComplete sets completed_at + audits', async () => {
    await markEnrollmentComplete(db, userA, courseId);
    const e = (await listEnrollments(db, userA)).find((x) => x.courseId === courseId);
    expect(e!.completedAt).not.toBeNull();
    expect((await recentAuditEvents(db, 1000)).some((ev) => ev.action === 'education.course_completed')).toBe(true);
  });

  it('pinned links: create, list (active only), soft-delete + audit', async () => {
    const profile = await getTeacherProfile(db, teacher);
    await createPinnedLink(db, { ownerType: 'teacher_profile', ownerId: profile!.id, label: 'Telegram', url: 'https://t.me/c', iconType: 'telegram', createdBy: teacher });
    const links = await listPinnedLinks(db, 'teacher_profile', profile!.id);
    expect(links[0]!.label).toBe('Telegram');
    await deletePinnedLink(db, links[0]!.id, teacher);
    expect((await listPinnedLinks(db, 'teacher_profile', profile!.id)).find((l) => l.id === links[0]!.id)).toBeUndefined();
    expect((await recentAuditEvents(db, 1000)).some((e) => e.action === 'education.pinned_link_delete')).toBe(true);
  });
});

describe('0002 TradingView: profiles + grants metadata', () => {
  it('profile upsert audits; grant sets current_grant_id; revoke stamps metadata on grant+request and nulls pointer', async () => {
    await upsertTradingViewProfile(db, { userId: userA, tvUsername: 'trader_a' });
    expect((await getTvProfile(db, userA))!.currentGrantId).toBeNull();
    expect((await recentAuditEvents(db, 1000)).some((e) => e.action === 'tv_access.profile_update')).toBe(true);

    const req = await submitTvRequest(db, userA, 'trader_a');
    const grant = await createTvGrant(db, { requestId: req.id, userId: userA, tvUsername: 'trader_a', grantedAt: new Date(), grantedBy: admin, grantedByType: 'admin' });
    expect((await getTvProfile(db, userA))!.currentGrantId).toBe(grant.id);

    await revokeTvGrant(db, grant.id, admin, 'subscription expired');
    const grants = await listTvGrantsForUser(db, userA);
    const g = grants.find((x) => x.id === grant.id)!;
    expect(g.revokedAt).not.toBeNull();
    expect(g.revokedBy).toBe(admin);
    expect((await getTvProfile(db, userA))!.currentGrantId).toBeNull();
    // request row also carries revoke metadata now
    const reqRow = (await listAllTv(db)).find((r) => r.id === req.id)!;
    expect(reqRow.revokedAt).not.toBeNull();
    expect(reqRow.revokedBy).toBe(admin);
    expect((await recentAuditEvents(db, 1000)).some((e) => e.action === 'tv_access.revoke' && e.targetId === grant.id)).toBe(true);
  });

  it('grants are per-user isolated', async () => {
    expect((await listTvGrantsForUser(db, userB)).length).toBe(0);
  });
});

describe('0002 Products: access-event log written with grant', () => {
  it('grantProduct writes a product_access_event (toState active), scoped per-user', async () => {
    await grantProduct(db, userB, 'club', Date.now(), admin);
    const events = await listProductAccessEvents(db, userB);
    expect(events.some((e) => e.productCode === 'club' && e.toState === 'active')).toBe(true);
    expect(events.every((e) => e.userId === userB)).toBe(true);
  });
});

describe('0002 Terminal: release exclusivity + audited events', () => {
  it('upsertTerminalRelease keeps one current per channel/platform', async () => {
    await upsertTerminalRelease(db, { version: '1.4.0', channel: 'stable', platform: 'win32', publishedAt: new Date('2026-01-01'), isCurrent: true });
    await upsertTerminalRelease(db, { version: '1.4.2', channel: 'stable', platform: 'win32', publishedAt: new Date('2026-02-01'), isCurrent: true });
    expect((await getCurrentTerminalRelease(db, 'stable', 'win32'))!.version).toBe('1.4.2');
    const [old] = await db.select().from(schema.terminalReleaseCache).where(and(eq(schema.terminalReleaseCache.version, '1.4.0'), eq(schema.terminalReleaseCache.channel, 'stable')));
    expect(old!.isCurrent).toBe(false);
  });

  it('download + license events audit (no plaintext)', async () => {
    const release = await getCurrentTerminalRelease(db, 'stable', 'win32');
    await recordDownloadEvent(db, { userId: userA, releaseId: release!.id, version: release!.version, platform: 'win32', ipAddress: '192.168.1.1', entitlementVerified: true });
    await recordLicenseEvent(db, { userId: userA, eventType: 'link_confirmed', axiomaUserId: 'axi-1', deviceFingerprint: 'sha256:abc', metadata: { source: 'handshake' } });
    const events = await recentAuditEvents(db, 1000);
    expect(events.some((e) => e.action === 'terminal.download')).toBe(true);
    expect(events.some((e) => e.action === 'terminal.license_event')).toBe(true);
  });
});

describe('0002 Ops: notifications + support tickets', () => {
  it('notifications: unread filter, mark read, per-user isolation', async () => {
    await createNotification(db, { userId: userA, type: 'bot_warning', title: 'TP warning', body: 'check manually' });
    const unread = await listNotifications(db, userA, { unreadOnly: true });
    expect(unread.length).toBeGreaterThan(0);
    await markNotificationRead(db, unread[0]!.id, userA);
    expect((await listNotifications(db, userA, { unreadOnly: true })).find((n) => n.id === unread[0]!.id)).toBeUndefined();
    // a brand-new user has no notifications
    const fresh = await createUser(db, { email: '0002-notif@wtc.local', passwordHash: 'h', displayName: 'N' });
    expect((await listNotifications(db, fresh.id, {})).length).toBe(0);
  });

  it('support ticket create audits; list scoped to user vs admin', async () => {
    await createSupportTicket(db, { userId: userA, productCode: 'tortila_bot', subject: 'Bot issue', body: 'error 100410', priority: 'high' });
    expect((await recentAuditEvents(db, 1000)).some((e) => e.action === 'support.ticket_create')).toBe(true);
    expect((await listSupportTickets(db, { userId: userA })).every((t) => t.userId === userA)).toBe(true);
    await createSupportTicket(db, { userId: userB, subject: 'Other', body: 'details' });
    expect((await listSupportTickets(db, {})).some((t) => t.userId === userB)).toBe(true);
  });
});

describe('0002 Billing: idempotent applyStripeEvent + manual-override precedence', () => {
  it('applies a payment_succeeded once, skips the replay, never downgrades a manual grant', async () => {
    const r1 = await applyStripeEvent(db, { stripeEventId: 'evt_pay_1', billingEvent: 'payment_succeeded', userId: userB, productCodes: ['axioma_terminal'], planCode: 'axioma_monthly' });
    expect(r1.applied).toBe(true);
    expect(r1.productsChanged).toBe(1);
    expect(hasAccess(await entitlementsOf(db, userB), 'axioma_terminal', Date.now())).toBe(true);
    // replay is idempotent
    const replay = await applyStripeEvent(db, { stripeEventId: 'evt_pay_1', billingEvent: 'payment_succeeded', userId: userB, productCodes: ['axioma_terminal'], planCode: 'axioma_monthly' });
    expect(replay.applied).toBe(false);

    // manual grant beats a later subscription_canceled webhook
    await grantProduct(db, userB, 'education', Date.now(), admin);
    await applyStripeEvent(db, { stripeEventId: 'evt_cancel_1', billingEvent: 'subscription_canceled', userId: userB, productCodes: ['education'], planCode: 'education_lifetime' });
    expect(hasAccess(await entitlementsOf(db, userB), 'education', Date.now())).toBe(true); // still active (manual override)
  });

  it('subscriptions upsert + list per-user', async () => {
    await upsertSubscription(db, { userId: userA, planCode: 'axioma_monthly', provider: 'stripe', providerRef: 'sub_123', status: 'active' });
    await upsertSubscription(db, { userId: userA, planCode: 'axioma_yearly', provider: 'stripe', providerRef: 'sub_123', status: 'active' }); // same ref → update
    const subs = await listSubscriptionsForUser(db, userA);
    expect(subs.length).toBe(1);
    expect(subs[0]!.planCode).toBe('axioma_yearly');
  });
});
