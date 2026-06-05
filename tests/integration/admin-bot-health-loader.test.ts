import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createUser,
  ensureBotInstance,
  findUserByEmail,
  insertBotMetricSnapshot,
  recordHealthCheck,
  schema,
  seedDatabase,
  upsertBotProviderAccountMapping,
  type Db,
} from '@wtc/db';
import { loadAdminBotHealthFromDb, type AdminBotHealthBase } from '../../apps/web/src/features/admin/bot-health-loader.ts';

let db: Db;
let adminId: string;

async function tableCounts() {
  const [users, instances, mappings, metrics] = await Promise.all([
    db.select({ id: schema.users.id }).from(schema.users),
    db.select({ id: schema.botInstances.id }).from(schema.botInstances),
    db.select({ id: schema.botProviderAccounts.id }).from(schema.botProviderAccounts),
    db.select({ id: schema.botMetricSnapshots.id }).from(schema.botMetricSnapshots),
  ]);
  return {
    users: users.length,
    instances: instances.length,
    mappings: mappings.length,
    metrics: metrics.length,
  };
}

async function createIsolatedDb(): Promise<Db> {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  const isolatedDb = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(isolatedDb);
  return isolatedDb;
}

const base: AdminBotHealthBase = {
  adapterMode: 'read-only',
  liveControlDisabled: true,
  legacyAdapterBlocked: true,
  legacyDbLiveReadEnabled: true,
  legacyDatabaseConfigured: true,
  tortilaBaseUrlConfigured: false,
};

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  const admin = await findUserByEmail(db, 'admin@wtc.local');
  expect(admin).toBeTruthy();
  adminId = admin!.id;
}, 30_000);

describe('admin bot health DB loader', () => {
  it('maps Legacy fleet pub_id rows to active user provider mappings without mutating state', async () => {
    const mappedUser = await createUser(db, {
      email: 'fleet-mapped@wtc.local',
      passwordHash: 'hash-fleet-mapped-should-not-render',
      displayName: 'Fleet Mapped User',
    });
    const hiddenUser = await createUser(db, {
      email: 'fleet-hidden@wtc.local',
      passwordHash: 'hash-fleet-hidden-should-not-render',
      displayName: 'Hidden Mapping User',
    });
    const mappedInstance = await ensureBotInstance(db, { userId: mappedUser.id, productCode: 'legacy_bot' });
    const hiddenInstance = await ensureBotInstance(db, { userId: hiddenUser.id, productCode: 'legacy_bot' });
    await upsertBotProviderAccountMapping(db, {
      userId: mappedUser.id,
      botInstanceId: mappedInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'USER_A_PROVIDER_PUB_ID',
      label: 'Mapped provider account',
      actorUserId: adminId,
    });
    await upsertBotProviderAccountMapping(db, {
      userId: hiddenUser.id,
      botInstanceId: hiddenInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'HIDDEN_PROVIDER_PUB_ID_SHOULD_NOT_RENDER',
      label: 'Hidden provider account',
      actorUserId: adminId,
    });

    await insertBotMetricSnapshot(db, {
      botInstanceId: mappedInstance.id,
      snapshotAt: new Date('2026-06-03T14:00:00Z'),
      walletEquityUsd: '1234.0000',
      sourceAdapter: 'legacy-live-db',
      rawJson: {
        secretMarker: 'RAW_SECRET_MARKER_SHOULD_NOT_RENDER',
        liveConfig: {
          providerAccounts: [
            {
              pubId: 'USER_A_PROVIDER_PUB_ID',
              market: 'BINGX',
              running: true,
              balance: 1000.25,
              symbols: 3,
              activeSlots: 2,
              activeOrders: 1,
            },
            {
              pubId: 'UNMAPPED_PROVIDER_PUB_ID',
              market: 'BINGX',
              running: false,
              balance: 44,
              symbols: 1,
              activeSlots: 0,
              activeOrders: 0,
            },
          ],
          activeSlots: [
            {
              providerPubId: 'USER_A_PROVIDER_PUB_ID',
              symbol: 'BTC-USDT',
              signal: 'rsi',
              stage: 1,
              averagingCount: 2,
              openedAt: Date.parse('2026-06-03T13:30:00Z'),
            },
            {
              providerPubId: 'UNMAPPED_PROVIDER_PUB_ID',
              symbol: 'ETH-USDT',
              signal: 'cci',
              stage: 2,
              averagingCount: 1,
            },
          ],
          activeOrderSummary: [
            {
              providerPubId: 'USER_A_PROVIDER_PUB_ID',
              symbol: 'BTC-USDT',
              note: 'tp',
              qty: 1,
              price: 120,
            },
          ],
        },
      },
    });

    const before = await tableCounts();
    const detail = await loadAdminBotHealthFromDb(db, base);
    const after = await tableCounts();
    expect(after).toEqual(before);

    const mapped = detail.legacyProviderAccounts.find((row) => row.mappedUser?.userId === mappedUser.id);
    const unmapped = detail.legacyProviderAccounts.find((row) => row.mappedUser === null);
    expect(mapped).toMatchObject({
      pubId: 'USER_A...B_ID',
      market: 'BINGX',
      running: true,
      mappedUser: {
        userId: mappedUser.id,
        botInstanceId: mappedInstance.id,
        displayName: 'Fleet Mapped User',
        email: 'fleet-mapped@wtc.local',
        providerLabel: 'Mapped provider account',
      },
    });
    expect(unmapped).toMatchObject({
      pubId: 'UNMAPP...B_ID',
      mappedUser: null,
      running: false,
    });
    expect(detail.legacyActiveSlots.find((row) => row.symbol === 'BTC-USDT')?.mappedUser).toMatchObject({
      userId: mappedUser.id,
      email: 'fleet-mapped@wtc.local',
    });
    expect(detail.legacyActiveSlots.find((row) => row.symbol === 'ETH-USDT')?.mappedUser).toBeNull();
    expect(detail.legacyActiveOrders[0]?.mappedUser).toMatchObject({
      userId: mappedUser.id,
      email: 'fleet-mapped@wtc.local',
    });

    const json = JSON.stringify(detail);
    expect(json).toContain('USER_A...B_ID');
    expect(json).toContain('UNMAPP...B_ID');
    expect(json).not.toContain('USER_A_PROVIDER_PUB_ID');
    expect(json).not.toContain('UNMAPPED_PROVIDER_PUB_ID');
    expect(json).not.toContain('HIDDEN_PROVIDER_PUB_ID_SHOULD_NOT_RENDER');
    expect(json).not.toContain('fleet-hidden@wtc.local');
    expect(json).not.toContain('Hidden Mapping User');
    expect(json).not.toContain('hash-fleet-mapped-should-not-render');
    expect(json).not.toContain('hash-fleet-hidden-should-not-render');
    expect(json).not.toContain('RAW_SECRET_MARKER_SHOULD_NOT_RENDER');
    expect(json).not.toContain('apiSecret');
    expect(json).not.toContain('apiKey');
    expect(json).not.toContain('sealed');
    expect(json).not.toContain('token');
  });

  it('aggregates Legacy fleet pub_id rows from multiple provider-scoped snapshots', async () => {
    const isolatedDb = await createIsolatedDb();
    const admin = await findUserByEmail(isolatedDb, 'admin@wtc.local');
    expect(admin).toBeTruthy();
    const firstUser = await createUser(isolatedDb, {
      email: 'fleet-first@wtc.local',
      passwordHash: 'hash-fleet-first-should-not-render',
      displayName: 'Fleet First',
    });
    const secondUser = await createUser(isolatedDb, {
      email: 'fleet-second@wtc.local',
      passwordHash: 'hash-fleet-second-should-not-render',
      displayName: 'Fleet Second',
    });
    const firstInstance = await ensureBotInstance(isolatedDb, { userId: firstUser.id, productCode: 'legacy_bot' });
    const secondInstance = await ensureBotInstance(isolatedDb, { userId: secondUser.id, productCode: 'legacy_bot' });
    const firstMapping = await upsertBotProviderAccountMapping(isolatedDb, {
      userId: firstUser.id,
      botInstanceId: firstInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'FIRST_PROVIDER_PUB_ID',
      label: 'First provider account',
      actorUserId: admin!.id,
    });
    const secondMapping = await upsertBotProviderAccountMapping(isolatedDb, {
      userId: secondUser.id,
      botInstanceId: secondInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'SECOND_PROVIDER_PUB_ID',
      label: 'Second provider account',
      actorUserId: admin!.id,
    });

    await insertBotMetricSnapshot(isolatedDb, {
      botInstanceId: firstInstance.id,
      botProviderAccountId: firstMapping.id,
      snapshotAt: new Date('2026-06-04T12:00:00Z'),
      walletEquityUsd: '1111.0000',
      sourceAdapter: 'legacy-db',
      rawJson: {
        firstSecret: 'FIRST_RAW_SECRET_SHOULD_NOT_RENDER',
        liveConfig: {
          providerAccounts: [{ pubId: 'FIRST_PROVIDER_PUB_ID', market: 'BINGX', running: true, balance: 1111, symbols: 2, activeSlots: 1, activeOrders: 1 }],
          activeSlots: [{ providerPubId: 'FIRST_PROVIDER_PUB_ID', symbol: 'BTC-USDT', signal: 'rsi', stage: 1, averagingCount: 1 }],
          activeOrderSummary: [{ providerPubId: 'FIRST_PROVIDER_PUB_ID', symbol: 'BTC-USDT', note: 'TAKE_PROFIT', qty: 1, price: 100 }],
        },
      },
    });
    await insertBotMetricSnapshot(isolatedDb, {
      botInstanceId: secondInstance.id,
      botProviderAccountId: secondMapping.id,
      snapshotAt: new Date('2026-06-04T12:00:30Z'),
      walletEquityUsd: '2222.0000',
      sourceAdapter: 'legacy-db',
      rawJson: {
        secondSecret: 'SECOND_RAW_SECRET_SHOULD_NOT_RENDER',
        liveConfig: {
          providerAccounts: [{ pubId: 'SECOND_PROVIDER_PUB_ID', market: 'BINGX', running: false, balance: 2222, symbols: 3, activeSlots: 1, activeOrders: 1 }],
          activeSlots: [{ providerPubId: 'SECOND_PROVIDER_PUB_ID', symbol: 'ETH-USDT', signal: 'cci', stage: 2, averagingCount: 2 }],
          activeOrderSummary: [{ providerPubId: 'SECOND_PROVIDER_PUB_ID', symbol: 'ETH-USDT', note: 'BUY', qty: 2, price: 200 }],
        },
      },
    });

    const detail = await loadAdminBotHealthFromDb(isolatedDb, base);

    expect(detail.legacyProviderAccounts).toHaveLength(2);
    expect(detail.legacyProviderAccounts.map((row) => row.mappedUser?.email).sort()).toEqual([
      'fleet-first@wtc.local',
      'fleet-second@wtc.local',
    ]);
    expect(detail.legacyProviderAccounts.map((row) => row.pubId).sort()).toEqual(['FIRST_...B_ID', 'SECOND...B_ID']);
    expect(detail.legacyActiveSlots.map((row) => row.symbol).sort()).toEqual(['BTC-USDT', 'ETH-USDT']);
    expect(detail.legacyActiveOrders.map((row) => row.symbol).sort()).toEqual(['BTC-USDT', 'ETH-USDT']);
    expect(detail.legacyActiveSlots.find((row) => row.symbol === 'BTC-USDT')?.mappedUser?.email).toBe('fleet-first@wtc.local');
    expect(detail.legacyActiveSlots.find((row) => row.symbol === 'ETH-USDT')?.mappedUser?.email).toBe('fleet-second@wtc.local');

    const json = JSON.stringify(detail);
    expect(json).not.toContain('FIRST_PROVIDER_PUB_ID');
    expect(json).not.toContain('SECOND_PROVIDER_PUB_ID');
    expect(json).not.toContain('FIRST_RAW_SECRET_SHOULD_NOT_RENDER');
    expect(json).not.toContain('SECOND_RAW_SECRET_SHOULD_NOT_RENDER');
  }, 30_000);

  it('shows Tortila fleet owners from WTC bot instances without provider id inference', async () => {
    const tortilaOwner = await createUser(db, {
      email: 'tortila-owner@wtc.local',
      passwordHash: 'hash-tortila-owner-should-not-render',
      displayName: 'Tortila Owner',
    });
    const tortilaInstance = await ensureBotInstance(db, { userId: tortilaOwner.id, productCode: 'tortila_bot' });

    await insertBotMetricSnapshot(db, {
      botInstanceId: tortilaInstance.id,
      snapshotAt: new Date('2026-06-03T15:00:00Z'),
      walletEquityUsd: '2222.0000',
      tradeCount: 8,
      sourceAdapter: 'tortila',
      rawJson: {
        rawJournalMarker: 'TORTILA_RAW_JOURNAL_MARKER_SHOULD_NOT_RENDER',
        token: 'TORTILA_TOKEN_SHOULD_NOT_RENDER',
      },
    });
    await insertBotMetricSnapshot(db, {
      botInstanceId: tortilaInstance.id,
      snapshotAt: new Date('2026-06-03T15:05:00Z'),
      walletEquityUsd: '2333.0000',
      tradeCount: 9,
      sourceAdapter: 'tortila',
      rawJson: {
        newerRawJournalMarker: 'TORTILA_NEWER_RAW_MARKER_SHOULD_NOT_RENDER',
        apiSecret: 'TORTILA_SECRET_SHOULD_NOT_RENDER',
      },
    });

    const before = await tableCounts();
    const detail = await loadAdminBotHealthFromDb(db, base);
    const after = await tableCounts();
    expect(after).toEqual(before);

    const tortila = detail.tortilaFleetSnapshots.find((row) => row.botInstanceId === tortilaInstance.id);
    expect(tortila).toMatchObject({
      botInstanceId: tortilaInstance.id,
      snapshotAt: Date.parse('2026-06-03T15:05:00Z'),
      walletEquityUsd: '2333.0000',
      tradeCount: 9,
      sourceAdapter: 'tortila',
      scope: 'bot_instance_owner',
      ownerUser: {
        userId: tortilaOwner.id,
        displayName: 'Tortila Owner',
        email: 'tortila-owner@wtc.local',
      },
    });

    const json = JSON.stringify(detail);
    expect(json).toContain('bot_instance_owner');
    expect(json).toContain('tortila-owner@wtc.local');
    expect(json).not.toContain('hash-tortila-owner-should-not-render');
    expect(json).not.toContain('TORTILA_RAW_JOURNAL_MARKER_SHOULD_NOT_RENDER');
    expect(json).not.toContain('TORTILA_NEWER_RAW_MARKER_SHOULD_NOT_RENDER');
    expect(json).not.toContain('TORTILA_TOKEN_SHOULD_NOT_RENDER');
    expect(json).not.toContain('TORTILA_SECRET_SHOULD_NOT_RENDER');
    expect(json).not.toContain('providerAccountId');
  });

  it('normalizes Legacy warningCodes into safe admin health warnings', async () => {
    await recordHealthCheck(db, 'legacy-bot', 'degraded', {
      status: 'degraded',
      processAlive: true,
      readState: 'ok',
      warnings: ['ws_fallback'],
      warningCodes: ['legacy_quarantined', 'no_trade_history', 'apiKey=LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER'],
      token: 'Bearer legacy.secret.token',
    });

    const before = await tableCounts();
    const detail = await loadAdminBotHealthFromDb(db, base);
    const after = await tableCounts();
    expect(after).toEqual(before);

    const legacyHealth = detail.botHealthChecks.find((row) => row.target === 'legacy-bot');
    expect(legacyHealth?.detail).toMatchObject({
      status: 'degraded',
      processAlive: true,
      readState: 'ok',
      warnings: ['ws_fallback', 'legacy_quarantined', 'no_trade_history'],
    });
    const legacySummary = detail.botWarningSummaries.find((row) => row.target === 'legacy-bot');
    expect(legacySummary).toMatchObject({
      productCode: 'legacy_bot',
      status: 'warnings_present',
      count: 3,
      maxSeverity: 'warning',
      source: 'integration_health_checks',
    });
    expect(legacySummary?.warnings.map((warning) => warning.code)).toEqual(['ws_fallback', 'legacy_quarantined', 'no_trade_history']);
    expect(legacyHealth?.detail).not.toHaveProperty('warningCodes');
    expect(JSON.stringify(legacyHealth)).not.toContain('LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER');
    expect(JSON.stringify(legacySummary)).not.toContain('LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER');
    expect(JSON.stringify(legacyHealth)).not.toContain('legacy.secret.token');
  });

  it('surfaces stale Tortila readState even when the coarse health status is ok', async () => {
    const staleDb = await createIsolatedDb();
    await staleDb.insert(schema.integrationHealthChecks).values({
      target: 'tortila-journal',
      status: 'ok',
      checkedAt: new Date('2026-06-04T10:00:00Z'),
      detail: {
        status: 'ok',
        readState: 'stale',
        readStateDetail: 'journal event age exceeded freshness window',
        token: 'Bearer TORTILA_STALE_TOKEN_SHOULD_NOT_RENDER',
      },
    });

    const detail = await loadAdminBotHealthFromDb(staleDb, base);
    const tortilaHealth = detail.botHealthChecks.find((row) => row.target === 'tortila-journal');

    expect(detail.tortilaJournalStatus).toBe('ok');
    expect(detail.tortilaJournalReadState).toBe('stale');
    expect(detail.tortilaJournalReadStateDetail).toBe('journal event age exceeded freshness window');
    expect(detail.tortilaLastError).toBeNull();
    expect(tortilaHealth).toMatchObject({
      target: 'tortila-journal',
      status: 'ok',
      detail: {
        readState: 'stale',
        readStateDetail: 'journal event age exceeded freshness window',
      },
    });
    expect(JSON.stringify(detail)).not.toContain('TORTILA_STALE_TOKEN_SHOULD_NOT_RENDER');
  }, 30_000);

  it('keeps bot health targets visible when newer non-bot health rows exceed the old global window', async () => {
    const isolatedDb = await createIsolatedDb();
    await isolatedDb.insert(schema.integrationHealthChecks).values([
      {
        target: 'tortila-journal',
        status: 'ok',
        checkedAt: new Date('2026-06-04T10:00:00Z'),
        detail: { readState: 'ok', warnings: ['tp_reconcile_p0'] },
      },
      {
        target: 'legacy-bot',
        status: 'degraded',
        checkedAt: new Date('2026-06-04T10:01:00Z'),
        detail: { readState: 'ok', warningCodes: ['legacy_quarantined'] },
      },
      ...Array.from({ length: 60 }, (_, i) => ({
        target: `system-noise-${i}`,
        status: 'ok',
        checkedAt: new Date(Date.parse('2026-06-04T11:00:00Z') + i * 1000),
        detail: { status: 'ok' },
      })),
    ]);

    const detail = await loadAdminBotHealthFromDb(isolatedDb, base);

    expect(detail.botHealthChecks.map((row) => row.target)).toContain('tortila-journal');
    expect(detail.botHealthChecks.map((row) => row.target)).toContain('legacy-bot');
    expect(detail.botWarningSummaries.map((row) => row.target).sort()).toEqual(['legacy-bot', 'tortila-journal']);
  }, 30_000);

  it('projects worker bot continuity detail from the latest worker health row', async () => {
    const isolatedDb = await createIsolatedDb();
    await isolatedDb.insert(schema.integrationHealthChecks).values({
      target: 'worker',
      status: 'not_configured',
      checkedAt: new Date('2026-06-04T12:00:00Z'),
      detail: {
        coreWorkerStatus: 'ok',
        botContinuityStatus: 'attention',
        tortilaSnapshot: 'skipped',
        tortilaHealthStatus: 'not_configured',
        tortilaReadState: 'not_configured',
        legacySnapshot: 'ok',
        legacyHealthStatus: 'ok',
        legacyReadState: 'ok',
        token: 'WORKER_SECRET_TOKEN_SHOULD_NOT_RENDER',
      },
    });

    const detail = await loadAdminBotHealthFromDb(isolatedDb, base, { now: Date.parse('2026-06-04T12:01:00Z') });

    expect(detail.workerBotContinuity).toMatchObject({
      status: 'not_configured',
      checkedAt: Date.parse('2026-06-04T12:00:00Z'),
      freshness: 'fresh',
      ageSeconds: 60,
      staleAfterSeconds: 180,
      coreWorkerStatus: 'ok',
      botContinuityStatus: 'attention',
      tortilaSnapshot: 'skipped',
      tortilaHealthStatus: 'not_configured',
      tortilaReadState: 'not_configured',
      legacySnapshot: 'ok',
      legacyHealthStatus: 'ok',
      legacyReadState: 'ok',
    });
    expect(JSON.stringify(detail)).not.toContain('WORKER_SECRET_TOKEN_SHOULD_NOT_RENDER');
  }, 30_000);

  it('marks stale ok worker continuity rows as stale so admin fleet cannot show old proof as green', async () => {
    const isolatedDb = await createIsolatedDb();
    await isolatedDb.insert(schema.integrationHealthChecks).values({
      target: 'worker',
      status: 'ok',
      checkedAt: new Date('2026-06-04T12:00:00Z'),
      detail: {
        coreWorkerStatus: 'ok',
        botContinuityStatus: 'ok',
        tortilaSnapshot: 'ok',
        tortilaHealthStatus: 'ok',
        tortilaReadState: 'ok',
        legacySnapshot: 'ok',
        legacyHealthStatus: 'ok',
        legacyReadState: 'ok',
      },
    });

    const detail = await loadAdminBotHealthFromDb(isolatedDb, base, { now: Date.parse('2026-06-04T12:10:00Z') });

    expect(detail.workerBotContinuity).toMatchObject({
      status: 'ok',
      botContinuityStatus: 'ok',
      freshness: 'stale',
      ageSeconds: 600,
      staleAfterSeconds: 180,
      tortilaSnapshot: 'ok',
      legacySnapshot: 'ok',
    });
  }, 30_000);

  it('keeps malformed and unreachable read states bad and sanitized at the admin boundary', async () => {
    const isolatedDb = await createIsolatedDb();
    await isolatedDb.insert(schema.integrationHealthChecks).values([
      {
        target: 'tortila-journal',
        status: 'down',
        checkedAt: new Date('2026-06-04T12:10:00Z'),
        detail: {
          error: 'journal unreachable token=TORTILA_UNREACHABLE_SECRET',
          readState: 'unreachable',
          readStateDetail: 'journal endpoint unreachable',
        },
      },
      {
        target: 'legacy-bot',
        status: 'error',
        checkedAt: new Date('2026-06-04T12:11:00Z'),
        detail: {
          error: 'legacy malformed apiKey=LEGACY_MALFORMED_SECRET',
          readState: 'malformed',
          readStateDetail: 'legacy snapshot payload malformed',
        },
      },
    ]);

    const detail = await loadAdminBotHealthFromDb(isolatedDb, base);
    const tortilaHealth = detail.botHealthChecks.find((row) => row.target === 'tortila-journal');
    const legacyHealth = detail.botHealthChecks.find((row) => row.target === 'legacy-bot');

    expect(detail.tortilaJournalStatus).toBe('down');
    expect(detail.tortilaJournalReadState).toBe('unreachable');
    expect(detail.tortilaLastError).toBe('journal unreachable token=[REDACTED]');
    expect(tortilaHealth?.detail).toMatchObject({
      readState: 'unreachable',
      readStateDetail: 'journal endpoint unreachable',
    });
    expect(legacyHealth?.detail).toMatchObject({
      readState: 'malformed',
      readStateDetail: 'legacy snapshot payload malformed',
    });
    expect(JSON.stringify(detail)).not.toContain('TORTILA_UNREACHABLE_SECRET');
    expect(JSON.stringify(detail)).not.toContain('LEGACY_MALFORMED_SECRET');
  }, 30_000);
});
