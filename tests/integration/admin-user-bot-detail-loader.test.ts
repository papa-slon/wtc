import { describe, expect, it, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  schema,
  seedDatabase,
  createUser,
  findUserByEmail,
  grantProduct,
  ensureBotInstance,
  saveBotConfig,
  saveBotGlobalConfig,
  insertBotConfigVersion,
  insertBotMetricSnapshot,
  insertBotPositionSnapshot,
  importBotTrade,
  recordHealthCheck,
  upsertBotProviderAccountMapping,
  type Db,
} from '@wtc/db';
import { loadAdminUserBotDetailFromDb } from '../../apps/web/src/features/admin/user-bot-detail-loader.ts';

let db: Db;
let adminId: string;
let userAId: string;
let userBId: string;
let userABotInstanceId: string;
let userALegacyBotInstanceId: string;
let userALegacyProviderAccountId: string;
let userBBotInstanceId: string;

async function tableCounts(targetDb: Db = db) {
  const [auditRows, configRows, configVersionRows, snapshotRows, positionRows, tradeRows, instanceRows, exchangeRows, secretRows, providerAccountRows] = await Promise.all([
    targetDb.select({ id: schema.auditLogs.id }).from(schema.auditLogs),
    targetDb.select({ id: schema.botConfigs.id }).from(schema.botConfigs),
    targetDb.select({ id: schema.botConfigVersions.id }).from(schema.botConfigVersions),
    targetDb.select({ id: schema.botMetricSnapshots.id }).from(schema.botMetricSnapshots),
    targetDb.select({ id: schema.botPositionSnapshots.id }).from(schema.botPositionSnapshots),
    targetDb.select({ id: schema.botTradeImports.id }).from(schema.botTradeImports),
    targetDb.select({ id: schema.botInstances.id }).from(schema.botInstances),
    targetDb.select({ id: schema.exchangeAccounts.id }).from(schema.exchangeAccounts),
    targetDb.select({ id: schema.exchangeApiKeySecrets.id }).from(schema.exchangeApiKeySecrets),
    targetDb.select({ id: schema.botProviderAccounts.id }).from(schema.botProviderAccounts),
  ]);
  return {
    audits: auditRows.length,
    configs: configRows.length,
    configVersions: configVersionRows.length,
    snapshots: snapshotRows.length,
    positions: positionRows.length,
    trades: tradeRows.length,
    instances: instanceRows.length,
    exchanges: exchangeRows.length,
    secretRows: secretRows.length,
    providerAccounts: providerAccountRows.length,
  };
}

async function createIsolatedDb(): Promise<{ db: Db; adminId: string }> {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  const isolatedDb = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(isolatedDb);
  const admin = await findUserByEmail(isolatedDb, 'admin@wtc.local');
  expect(admin).toBeTruthy();
  return { db: isolatedDb, adminId: admin!.id };
}

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

  const userA = await createUser(db, {
    email: 'admin-drilldown-a@wtc.local',
    passwordHash: 'hash-user-a-should-never-render',
    displayName: 'Drilldown User A',
  });
  const userB = await createUser(db, {
    email: 'admin-drilldown-b@wtc.local',
    passwordHash: 'hash-user-b-should-never-render',
    displayName: 'Drilldown User B',
  });
  userAId = userA.id;
  userBId = userB.id;

  await grantProduct(db, userAId, 'tortila_bot', Date.parse('2026-06-03T09:00:00Z'), adminId, 'admin_drilldown_a_tortila');
  await grantProduct(db, userBId, 'legacy_bot', Date.parse('2026-06-03T09:01:00Z'), adminId, 'admin_drilldown_b_legacy');
  await db.insert(schema.entitlements).values({
    userId: userAId,
    productCode: 'legacy_bot',
    status: 'active',
    source: 'manual_grant',
    planCode: 'admin_grant',
    startsAt: new Date('2026-06-01T00:00:00Z'),
    expiresAt: new Date('2026-06-02T00:00:00Z'),
    manualOverride: true,
    updatedAt: new Date('2026-06-03T09:02:00Z'),
  });

  const [exchangeA] = await db
    .insert(schema.exchangeAccounts)
    .values({
      userId: userAId,
      exchange: 'bingx',
      label: 'USER_A_EXCHANGE_ONLY',
      mode: 'demo',
      keyMask: '****A111',
    })
    .returning();
  const [exchangeB] = await db
    .insert(schema.exchangeAccounts)
    .values({
      userId: userBId,
      exchange: 'binance',
      label: 'USER_B_EXCHANGE_MUST_NOT_LEAK',
      mode: 'live',
      keyMask: '****B999',
    })
    .returning();
  expect(exchangeA).toBeTruthy();
  expect(exchangeB).toBeTruthy();
  await db.insert(schema.exchangeApiKeySecrets).values({
    exchangeAccountId: exchangeA!.id,
    sealed: { marker: 'USER_A_SEALED_SECRET_SHOULD_NOT_RENDER' },
    keyId: 'key-user-a-secret-should-not-render',
  });
  await db.insert(schema.exchangeApiKeySecrets).values({
    exchangeAccountId: exchangeB!.id,
    sealed: { marker: 'USER_B_SEALED_SECRET_MUST_NOT_LEAK' },
    keyId: 'key-user-b-secret-must-not-leak',
  });

  const instanceA = await ensureBotInstance(db, {
    userId: userAId,
    productCode: 'tortila_bot',
    exchangeAccountId: exchangeA!.id,
  });
  const legacyInstanceA = await ensureBotInstance(db, {
    userId: userAId,
    productCode: 'legacy_bot',
  });
  const instanceB = await ensureBotInstance(db, {
    userId: userBId,
    productCode: 'legacy_bot',
    exchangeAccountId: exchangeB!.id,
  });
  userABotInstanceId = instanceA.id;
  userALegacyBotInstanceId = legacyInstanceA.id;
  userBBotInstanceId = instanceB.id;

  const userALegacyProviderAccount = await upsertBotProviderAccountMapping(db, {
    userId: userAId,
    botInstanceId: userALegacyBotInstanceId,
    productCode: 'legacy_bot',
    provider: 'legacy-db',
    providerAccountId: 'USER_A_LEGACY_PUB_ID',
    label: 'User A Legacy provider account',
    actorUserId: adminId,
  });
  userALegacyProviderAccountId = userALegacyProviderAccount.id;
  await upsertBotProviderAccountMapping(db, {
    userId: userBId,
    botInstanceId: userBBotInstanceId,
    productCode: 'legacy_bot',
    provider: 'legacy-db',
    providerAccountId: 'USER_B_LEGACY_PUB_ID_MUST_NOT_LEAK',
    label: 'User B Legacy provider account must not leak',
    actorUserId: adminId,
  });

  await saveBotConfig(db, {
    botInstanceId: userABotInstanceId,
    config: {
      rawMarker: 'USER_A_RAW_CONFIG_SHOULD_NOT_RENDER',
      operationMode: 'manual',
      symbols: ['A_ONLY_SYMBOL'],
      timeframe: '4h',
      system: 2,
      riskPercent: 0.3,
      maxOpenSymbols: 3,
    },
    changedBy: userAId,
  });
  await saveBotConfig(db, {
    botInstanceId: userALegacyBotInstanceId,
    config: {
      rawMarker: 'USER_A_LEGACY_RAW_CONFIG_SHOULD_NOT_RENDER',
      operationMode: 'manual',
      symbols: 'USER_A_LEGACY_SYMBOL',
      defaultTimeframe: '3m',
      defaultTakeProfitPercent: 0.5,
      symbolConfigs: [
        { symbol: 'USER_A_LEGACY_SYMBOL', useRsi: true, useCci: false },
      ],
      stageConfigs: [
        { stage: 1, rsiSlots: 2, cciSlots: 1 },
        { stage: 2, rsiSlots: 1, cciSlots: 1 },
      ],
    },
    changedBy: userAId,
  });
  await saveBotConfig(db, {
    botInstanceId: userBBotInstanceId,
    config: { rawMarker: 'USER_B_RAW_CONFIG_MUST_NOT_LEAK', symbols: ['B_ONLY_SYMBOL'] },
    changedBy: userBId,
  });
  await insertBotConfigVersion(db, {
    botInstanceId: userABotInstanceId,
    version: 77,
    configJson: { rawMarker: 'USER_A_HISTORY_CONFIG_SHOULD_NOT_RENDER' },
    changedBy: userAId,
    note: 'admin drilldown loader fixture',
  });
  await insertBotConfigVersion(db, {
    botInstanceId: userBBotInstanceId,
    version: 77,
    configJson: { rawMarker: 'USER_B_HISTORY_CONFIG_MUST_NOT_LEAK' },
    changedBy: userBId,
    note: 'admin drilldown loader fixture',
  });

  await insertBotMetricSnapshot(db, {
    botInstanceId: userABotInstanceId,
    snapshotAt: new Date('2026-06-03T08:00:00Z'),
    walletEquityUsd: '1100.0000',
    closedPnlUsd: '11.0000',
    sourceAdapter: 'USER_A_OLDER_SOURCE',
    tradeCount: 3,
  });
  await insertBotMetricSnapshot(db, {
    botInstanceId: userABotInstanceId,
    snapshotAt: new Date('2026-06-03T10:00:00Z'),
    walletEquityUsd: '1234.5600',
    closedPnlUsd: '22.0000',
    unrealizedPnlUsd: '3.0000',
    winRate: '0.6500',
    profitFactor: '1.7000',
    maxDrawdownPct: '0.0400',
    sourceAdapter: 'USER_A_LATEST_SOURCE',
    tradeCount: 7,
  });
  await insertBotMetricSnapshot(db, {
    botInstanceId: userBBotInstanceId,
    snapshotAt: new Date('2026-06-03T11:00:00Z'),
    walletEquityUsd: '9999.9900',
    closedPnlUsd: '999.0000',
    sourceAdapter: 'USER_B_LATEST_SOURCE_MUST_NOT_LEAK',
    tradeCount: 99,
  });
  await insertBotMetricSnapshot(db, {
    botInstanceId: userALegacyBotInstanceId,
    snapshotAt: new Date('2026-06-03T12:30:00Z'),
    walletEquityUsd: '7777.7700',
    sourceAdapter: 'USER_A_LEGACY_NULL_FLEET_SHOULD_NOT_RENDER',
    tradeCount: 77,
  });
  await insertBotMetricSnapshot(db, {
    botInstanceId: userALegacyBotInstanceId,
    botProviderAccountId: userALegacyProviderAccountId,
    snapshotAt: new Date('2026-06-03T12:00:00Z'),
    walletEquityUsd: '2222.2200',
    sourceAdapter: 'USER_A_LEGACY_SCOPED_SOURCE',
    tradeCount: 22,
  });

  await insertBotPositionSnapshot(db, {
    botInstanceId: userABotInstanceId,
    snapshotAt: new Date('2026-06-03T10:05:00Z'),
    sourceAdapter: 'USER_A_TORTILA_POSITION_SOURCE',
    positions: [
      {
        symbol: 'A_ONLY_POSITION_SYMBOL',
        side: 'long',
        size: '0.25000000',
        entryPrice: '100.00000000',
        markPrice: '105.00000000',
        unrealizedPnlUsd: '12.5000',
        leverage: 3,
        tpPrice: '120.00000000',
        slPrice: '90.00000000',
        openedAt: new Date('2026-06-03T09:30:00Z'),
      },
    ],
  });
  await insertBotPositionSnapshot(db, {
    botInstanceId: userBBotInstanceId,
    botProviderAccountId: userALegacyProviderAccountId,
    snapshotAt: new Date('2026-06-03T10:10:00Z'),
    sourceAdapter: 'USER_B_POSITION_SOURCE_MUST_NOT_LEAK',
    positions: [
      {
        symbol: 'USER_B_POSITION_SYMBOL_MUST_NOT_LEAK',
        side: 'short',
        size: '9.00000000',
        entryPrice: '1.00000000',
      },
    ],
  });
  await insertBotPositionSnapshot(db, {
    botInstanceId: userALegacyBotInstanceId,
    snapshotAt: new Date('2026-06-03T12:40:00Z'),
    sourceAdapter: 'USER_A_LEGACY_UNSCOPED_POSITION_SHOULD_NOT_RENDER',
    positions: [
      {
        symbol: 'USER_A_LEGACY_UNSCOPED_POSITION',
        side: 'long',
        size: '1.00000000',
        entryPrice: '200.00000000',
      },
    ],
  });
  await insertBotPositionSnapshot(db, {
    botInstanceId: userALegacyBotInstanceId,
    botProviderAccountId: userALegacyProviderAccountId,
    snapshotAt: new Date('2026-06-03T12:10:00Z'),
    sourceAdapter: 'USER_A_LEGACY_POSITION_SOURCE',
    positions: [
      {
        symbol: 'USER_A_LEGACY_POSITION_SYMBOL',
        side: 'short',
        size: '2.50000000',
        entryPrice: '300.00000000',
        markPrice: '280.00000000',
        unrealizedPnlUsd: '50.0000',
        leverage: 4,
      },
    ],
  });

  await importBotTrade(db, {
    botInstanceId: userABotInstanceId,
    externalTradeId: 'USER_A_TORTILA_TRADE_ID',
    symbol: 'A_ONLY_TRADE_SYMBOL',
    side: 'long',
    entryPrice: '100.00000000',
    exitPrice: '110.00000000',
    size: '0.50000000',
    realizedPnlUsd: '5.0000',
    feesUsd: '0.1000',
    fundingPaidUsd: '-0.0500',
    openedAt: new Date('2026-06-03T08:00:00Z'),
    closedAt: new Date('2026-06-03T10:30:00Z'),
    exitReason: 'take_profit',
    sourceAdapter: 'USER_A_TORTILA_TRADE_SOURCE',
    rawJson: { marker: 'USER_A_TORTILA_RAW_TRADE_SHOULD_NOT_RENDER' },
  });
  await importBotTrade(db, {
    botInstanceId: userBBotInstanceId,
    botProviderAccountId: userALegacyProviderAccountId,
    externalTradeId: 'USER_B_TRADE_ID_MUST_NOT_LEAK',
    symbol: 'USER_B_TRADE_SYMBOL_MUST_NOT_LEAK',
    side: 'short',
    entryPrice: '1.00000000',
    exitPrice: '0.50000000',
    size: '9.00000000',
    realizedPnlUsd: '99.0000',
    openedAt: new Date('2026-06-03T08:00:00Z'),
    closedAt: new Date('2026-06-03T10:45:00Z'),
    sourceAdapter: 'USER_B_TRADE_SOURCE_MUST_NOT_LEAK',
    rawJson: { marker: 'USER_B_RAW_TRADE_MUST_NOT_LEAK' },
  });
  await importBotTrade(db, {
    botInstanceId: userALegacyBotInstanceId,
    externalTradeId: 'USER_A_LEGACY_UNSCOPED_TRADE_ID',
    symbol: 'USER_A_LEGACY_UNSCOPED_TRADE',
    side: 'long',
    entryPrice: '200.00000000',
    exitPrice: '210.00000000',
    size: '1.00000000',
    realizedPnlUsd: '10.0000',
    openedAt: new Date('2026-06-03T08:00:00Z'),
    closedAt: new Date('2026-06-03T12:45:00Z'),
    sourceAdapter: 'USER_A_LEGACY_UNSCOPED_TRADE_SOURCE_SHOULD_NOT_RENDER',
    rawJson: { marker: 'USER_A_LEGACY_UNSCOPED_RAW_TRADE_SHOULD_NOT_RENDER' },
  });
  await importBotTrade(db, {
    botInstanceId: userALegacyBotInstanceId,
    botProviderAccountId: userALegacyProviderAccountId,
    externalTradeId: 'USER_A_LEGACY_TRADE_ID',
    symbol: 'USER_A_LEGACY_TRADE_SYMBOL',
    side: 'short',
    entryPrice: '300.00000000',
    exitPrice: '250.00000000',
    size: '2.00000000',
    realizedPnlUsd: '100.0000',
    feesUsd: '1.0000',
    fundingPaidUsd: '0.0000',
    openedAt: new Date('2026-06-03T08:00:00Z'),
    closedAt: new Date('2026-06-03T12:15:00Z'),
    exitReason: 'manual',
    sourceAdapter: 'USER_A_LEGACY_TRADE_SOURCE',
    rawJson: { marker: 'USER_A_LEGACY_RAW_TRADE_SHOULD_NOT_RENDER' },
  });
  await recordHealthCheck(db, 'tortila-journal', 'degraded', {
    status: 'degraded',
    processAlive: true,
    readState: 'ok',
    warnings: ['tp_reconcile_p0', 'fill_lookup_109421', 'apiKey=TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    warningCodes: ['margin_preflight_p1', 'not_real'],
  });
  await recordHealthCheck(db, 'legacy-bot', 'degraded', {
    status: 'degraded',
    processAlive: true,
    readState: 'ok',
    providerAccountMappingsSeen: 1,
    providerAccountMappingsSnapshotted: 1,
    warnings: ['no_trade_history'],
    warningCodes: ['legacy_quarantined', 'tp_reconcile_p0', 'token=LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    quarantineReason: 'PROVIDER_REASON_SHOULD_NOT_RENDER',
  });
}, 30_000);

describe('admin user bot detail loader isolation', () => {
  it('returns only target-owned bot state and never leaks another user or raw config/secrets', async () => {
    const before = await tableCounts();
    const detail = await loadAdminUserBotDetailFromDb(db, userAId, Date.parse('2026-06-03T12:00:00Z'));
    const after = await tableCounts();

    expect(after).toEqual(before);
    expect(detail.mode).toBe('postgres');
    expect(detail.liveControlDisabled).toBe(true);
    expect(detail.user).toMatchObject({
      id: userAId,
      email: 'admin-drilldown-a@wtc.local',
      displayName: 'Drilldown User A',
    });

    const tortila = detail.bots.find((bot) => bot.productCode === 'tortila_bot');
    const legacy = detail.bots.find((bot) => bot.productCode === 'legacy_bot');
    expect(tortila).toBeTruthy();
    expect(legacy).toBeTruthy();
    expect(tortila).toMatchObject({
      entitlementStatus: 'active',
      accessOpen: true,
      botInstanceId: userABotInstanceId,
      configVersion: 1,
      providerScope: 'user_scoped',
    });
    expect(tortila!.configSummary).toMatchObject({
      source: 'user_override',
      version: 1,
      sourceLabel: 'User custom profile v1',
      userVersion: 1,
      operationMode: 'manual',
      symbolCount: 1,
      symbols: ['A_ONLY_SYMBOL'],
      riskSummary: 'System 2 - 4h timeframe - 0.3% risk - 3 max symbols',
    });
    expect(tortila!.exchangeAccount).toMatchObject({
      label: 'USER_A_EXCHANGE_ONLY',
      exchange: 'bingx',
      mode: 'demo',
      keyMask: '****A111',
    });
    expect(tortila!.latestMetric).toMatchObject({
      walletEquityUsd: '1234.5600',
      sourceAdapter: 'USER_A_LATEST_SOURCE',
      tradeCount: 7,
    });
    expect(tortila!.closedTradeSourceProof).toBeNull();
    expect(tortila!.positions).toHaveLength(1);
    expect(tortila!.positions[0]).toMatchObject({
      symbol: 'A_ONLY_POSITION_SYMBOL',
      sourceAdapter: 'USER_A_TORTILA_POSITION_SOURCE',
      unrealizedPnlUsd: '12.5000',
    });
    expect(tortila!.trades).toHaveLength(1);
    expect(tortila!.trades[0]).toMatchObject({
      externalTradeId: 'USER_A_TORTILA_TRADE_ID',
      symbol: 'A_ONLY_TRADE_SYMBOL',
      sourceAdapter: 'USER_A_TORTILA_TRADE_SOURCE',
      realizedPnlUsd: '5.0000',
    });
    expect(tortila!.equityCurve.map((point) => point.equityUsd)).toEqual(['1100.0000', '1234.5600']);
    expect(tortila!.statsSource).toMatchObject({
      equityPoints: 2,
      providerScoped: false,
    });
    expect(tortila!.warningSummary).toMatchObject({
      status: 'warnings_present',
      count: 6,
      maxSeverity: 'error',
      source: 'integration_health_checks',
      scope: 'product_plus_runtime_health',
    });
    expect(tortila!.warningSummary.warnings.map((warning) => warning.code)).toContain('fill_lookup_109421');
    expect(tortila!.runtimeHealth).toMatchObject({
      target: 'tortila-journal',
      status: 'degraded',
      readState: 'ok',
      freshness: 'fresh',
      state: 'attention',
    });

    expect(legacy).toMatchObject({
      entitlementStatus: 'expired',
      accessOpen: false,
      botInstanceId: userALegacyBotInstanceId,
      configVersion: 1,
      exchangeAccount: null,
      providerScope: 'provider_account_mapped',
    });
    expect(legacy!.configSummary).toMatchObject({
      source: 'user_override',
      version: 1,
      sourceLabel: 'User custom profile v1',
      userVersion: 1,
      operationMode: 'manual',
      symbolCount: 1,
      symbols: ['USER_A_LEGACY_SYMBOL'],
      stageCount: 2,
      stageCapacity: 5,
      riskSummary: '1 RSI / 0 CCI - 3m timeframe - 0.5% TP',
    });
    expect(legacy!.latestMetric).toMatchObject({
      walletEquityUsd: '2222.2200',
      sourceAdapter: 'USER_A_LEGACY_SCOPED_SOURCE',
      tradeCount: 22,
    });
    expect(legacy!.closedTradeSourceProof).toMatchObject({
      status: 'blocked_no_source',
      canImportClosedTrades: false,
      blockerCount: 16,
      source: 'global_preflight',
    });
    expect(legacy!.closedTradeSourceProof?.missingRequirements).toContain('source_table_or_api');
    expect(legacy!.closedTradeSourceProof?.missingRequirements).toContain('closed_at');
    expect(legacy!.positions).toHaveLength(1);
    expect(legacy!.positions[0]).toMatchObject({
      symbol: 'USER_A_LEGACY_POSITION_SYMBOL',
      sourceAdapter: 'USER_A_LEGACY_POSITION_SOURCE',
      unrealizedPnlUsd: '50.0000',
    });
    expect(legacy!.trades).toHaveLength(1);
    expect(legacy!.trades[0]).toMatchObject({
      externalTradeId: 'USER_A_LEGACY_TRADE_ID',
      symbol: 'USER_A_LEGACY_TRADE_SYMBOL',
      sourceAdapter: 'USER_A_LEGACY_TRADE_SOURCE',
      realizedPnlUsd: '100.0000',
    });
    expect(legacy!.equityCurve.map((point) => point.equityUsd)).toEqual(['2222.2200']);
    expect(legacy!.statsSource).toMatchObject({
      equityPoints: 1,
      providerScoped: true,
    });
    expect(legacy!.warningSummary).toMatchObject({
      status: 'warnings_present',
      count: 4,
      maxSeverity: 'warning',
      source: 'integration_health_checks',
      scope: 'product_plus_runtime_health',
    });
    expect(legacy!.warningSummary.warnings.map((warning) => warning.code)).toEqual([
      'ws_fallback',
      'legacy_plaintext_keys',
      'no_trade_history',
      'legacy_quarantined',
    ]);
    expect(legacy!.runtimeHealth).toMatchObject({
      target: 'legacy-bot',
      status: 'degraded',
      readState: 'ok',
      freshness: 'fresh',
      state: 'attention',
    });
    expect(legacy!.providerAccount).toMatchObject({
      provider: 'legacy-db',
      providerAccountId: 'USER_A...B_ID',
      status: 'active',
    });
    expect(detail.providerAccounts).toHaveLength(1);
    expect(detail.providerAccounts[0]).toMatchObject({
      providerAccountId: 'USER_A...B_ID',
      status: 'active',
    });
    expect(detail.legacyProviderScopeWarning).toContain('provider-account mapping');

    const json = JSON.stringify(detail);
    expect(json).not.toContain(userBId);
    expect(json).not.toContain(userBBotInstanceId);
    expect(json).not.toContain('admin-drilldown-b@wtc.local');
    expect(json).not.toContain('Drilldown User B');
    expect(json).not.toContain('USER_B_EXCHANGE_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_LEGACY_PUB_ID_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_A_LEGACY_PUB_ID');
    expect(json).not.toContain('User B Legacy provider account must not leak');
    expect(json).not.toContain('****B999');
    expect(json).not.toContain('USER_B_LATEST_SOURCE_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_POSITION_SYMBOL_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_POSITION_SOURCE_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_TRADE_ID_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_TRADE_SYMBOL_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_TRADE_SOURCE_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_RAW_TRADE_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_A_LEGACY_NULL_FLEET_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_LEGACY_UNSCOPED_POSITION_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_LEGACY_UNSCOPED_POSITION');
    expect(json).not.toContain('USER_A_LEGACY_UNSCOPED_TRADE_ID');
    expect(json).not.toContain('USER_A_LEGACY_UNSCOPED_TRADE');
    expect(json).not.toContain('USER_A_LEGACY_UNSCOPED_TRADE_SOURCE_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_LEGACY_UNSCOPED_RAW_TRADE_SHOULD_NOT_RENDER');
    expect(json).not.toContain('7777.7700');
    expect(json).not.toContain('9999.9900');
    expect(json).not.toContain('B_ONLY_SYMBOL');
    expect(json).not.toContain('USER_B_RAW_CONFIG_MUST_NOT_LEAK');
    expect(json).not.toContain('USER_B_HISTORY_CONFIG_MUST_NOT_LEAK');
    expect(json).toContain('A_ONLY_SYMBOL');
    expect(json).toContain('USER_A_LEGACY_SYMBOL');
    expect(json).toContain('A_ONLY_POSITION_SYMBOL');
    expect(json).toContain('A_ONLY_TRADE_SYMBOL');
    expect(json).toContain('USER_A_LEGACY_POSITION_SYMBOL');
    expect(json).toContain('USER_A_LEGACY_TRADE_SYMBOL');
    expect(json).not.toContain('USER_B_SEALED_SECRET_MUST_NOT_LEAK');
    expect(json).not.toContain('key-user-b-secret-must-not-leak');

    expect(json).not.toContain('USER_A_RAW_CONFIG_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_LEGACY_RAW_CONFIG_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_HISTORY_CONFIG_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_TORTILA_RAW_TRADE_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_LEGACY_RAW_TRADE_SHOULD_NOT_RENDER');
    expect(json).not.toContain('TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER');
    expect(json).not.toContain('LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER');
    expect(json).not.toContain('PROVIDER_REASON_SHOULD_NOT_RENDER');
    expect(json).not.toContain('USER_A_SEALED_SECRET_SHOULD_NOT_RENDER');
    expect(json).not.toContain('key-user-a-secret-should-not-render');
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain('hash-user-a-should-never-render');
    expect(json).not.toContain('hash-user-b-should-never-render');
    expect(json).not.toContain('sealed');
    expect(json).not.toContain('apiSecret');
    expect(json).not.toContain('apiKey');
    expect(json).not.toContain('token');
    expect(json).not.toContain('blockers');
    expect(json).not.toContain('unsafeRawPayloadFields');
    expect(json).not.toContain('rawPayloadAllowlist');
    expect(json).not.toContain('evidenceRef');
    expect(json).not.toContain('sourceField');
    expect(json).not.toContain('artifactId');
  });

  it('prefers scoped Legacy metric source-proof summaries and drops unsafe raw proof fields', async () => {
    const { db: proofDb, adminId: proofAdminId } = await createIsolatedDb();
    const user = await createUser(proofDb, {
      email: 'admin-source-proof@wtc.local',
      passwordHash: 'hash-source-proof-should-not-render',
      displayName: 'Source Proof User',
    });
    await grantProduct(proofDb, user.id, 'legacy_bot', Date.parse('2026-06-05T06:00:00Z'), proofAdminId, 'source-proof');
    const instance = await ensureBotInstance(proofDb, { userId: user.id, productCode: 'legacy_bot' });
    const providerAccount = await upsertBotProviderAccountMapping(proofDb, {
      userId: user.id,
      botInstanceId: instance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'SOURCE_PROOF_PROVIDER_PUB_ID',
      label: 'Source proof provider',
      actorUserId: proofAdminId,
    });
    await insertBotMetricSnapshot(proofDb, {
      botInstanceId: instance.id,
      snapshotAt: new Date('2026-06-05T06:10:00Z'),
      walletEquityUsd: '9999.9900',
      sourceAdapter: 'UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER',
      tradeCount: 99,
      rawJson: {
        closedTradeSourceProof: {
          status: 'blocked_no_source',
          canImportClosedTrades: false,
          missingRequirements: ['unscoped_marker_should_not_render'],
        },
      },
    });
    await insertBotMetricSnapshot(proofDb, {
      botInstanceId: instance.id,
      botProviderAccountId: providerAccount.id,
      snapshotAt: new Date('2026-06-05T06:05:00Z'),
      walletEquityUsd: '3333.3300',
      sourceAdapter: 'SCOPED_SOURCE_PROOF_SOURCE',
      tradeCount: 3,
      rawJson: {
        closedTradeSourceProof: {
          status: 'ready_for_mapper',
          canImportClosedTrades: true,
          missingRequirements: ['closed_at', 'api_key', 'too-wide-field-name', 'symbol'],
          rawPayloadAllowlist: ['trade_id'],
          unsafeRawPayloadFields: ['api_key'],
          blockers: ['unsafe_raw_payload_field:api_key'],
          evidenceRef: 'legacy/source.py:1',
        },
        liveConfig: {
          providerAccountId: 'RAW_PROVIDER_ID_SHOULD_NOT_RENDER',
          apiKey: 'RAW_API_KEY_SHOULD_NOT_RENDER',
        },
      },
    });

    const detail = await loadAdminUserBotDetailFromDb(proofDb, user.id, Date.parse('2026-06-05T06:20:00Z'));
    const legacy = detail.bots.find((bot) => bot.productCode === 'legacy_bot');

    expect(legacy?.latestMetric).toMatchObject({
      walletEquityUsd: '3333.3300',
      sourceAdapter: 'SCOPED_SOURCE_PROOF_SOURCE',
      tradeCount: 3,
    });
    expect(legacy?.closedTradeSourceProof).toEqual({
      status: 'ready_for_mapper',
      canImportClosedTrades: true,
      missingRequirements: ['closed_at', 'symbol'],
      blockerCount: 2,
      source: 'scoped_worker_metric',
    });

    const json = JSON.stringify(detail);
    expect(json).not.toContain('UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER');
    expect(json).not.toContain('unscoped_marker_should_not_render');
    expect(json).not.toContain('SOURCE_PROOF_PROVIDER_PUB_ID');
    expect(json).not.toContain('RAW_PROVIDER_ID_SHOULD_NOT_RENDER');
    expect(json).not.toContain('RAW_API_KEY_SHOULD_NOT_RENDER');
    expect(json).not.toContain('rawPayloadAllowlist');
    expect(json).not.toContain('unsafeRawPayloadFields');
    expect(json).not.toContain('evidenceRef');
    expect(json).not.toContain('api_key');
    expect(json).not.toContain('blockers');
  }, 30_000);

  it('adds per-product runtime health and does not treat stale or missing health as green scope', async () => {
    const { db: runtimeDb } = await createIsolatedDb();
    const user = await createUser(runtimeDb, {
      email: 'admin-runtime-health@wtc.local',
      passwordHash: 'hash-runtime-health-should-not-render',
      displayName: 'Runtime Health User',
    });
    await ensureBotInstance(runtimeDb, { userId: user.id, productCode: 'tortila_bot' });
    await runtimeDb.insert(schema.integrationHealthChecks).values([
      {
        target: 'tortila-journal',
        status: 'ok',
        checkedAt: new Date('2026-06-04T12:00:00Z'),
        detail: {
          readState: 'stale',
          readStateDetail: 'journal payload is older than freshness window',
          token: 'TORTILA_RUNTIME_SECRET_SHOULD_NOT_RENDER',
        },
      },
      ...Array.from({ length: 30 }, (_, i) => ({
        target: 'legacy-bot',
        status: 'ok',
        checkedAt: new Date(Date.parse('2026-06-04T12:01:00Z') + i * 1000),
        detail: {
          readState: 'ok',
          providerAccountMappingsSeen: 0,
          providerAccountMappingsSnapshotted: 0,
        },
      })),
    ]);

    const detail = await loadAdminUserBotDetailFromDb(runtimeDb, user.id, Date.parse('2026-06-04T12:02:30Z'));
    const tortila = detail.bots.find((bot) => bot.productCode === 'tortila_bot');
    const legacy = detail.bots.find((bot) => bot.productCode === 'legacy_bot');

    expect(tortila?.runtimeHealth).toMatchObject({
      target: 'tortila-journal',
      status: 'ok',
      readState: 'stale',
      readStateDetail: 'journal payload is older than freshness window',
      freshness: 'stale',
      state: 'attention',
    });
    expect(legacy?.runtimeHealth).toMatchObject({
      target: 'legacy-bot',
      status: 'ok',
      readState: 'ok',
      freshness: 'fresh',
      state: 'ok',
    });
    expect(JSON.stringify(detail)).not.toContain('TORTILA_RUNTIME_SECRET_SHOULD_NOT_RENDER');
  }, 30_000);

  it('marks missing selected-user bot health as missing instead of green runtime evidence', async () => {
    const { db: runtimeDb } = await createIsolatedDb();
    const user = await createUser(runtimeDb, {
      email: 'admin-runtime-missing@wtc.local',
      passwordHash: 'hash-runtime-missing-should-not-render',
      displayName: 'Runtime Missing User',
    });

    const detail = await loadAdminUserBotDetailFromDb(runtimeDb, user.id, Date.parse('2026-06-04T12:00:00Z'));

    expect(detail.bots.map((bot) => bot.runtimeHealth)).toEqual([
      expect.objectContaining({
        target: 'tortila-journal',
        status: null,
        freshness: 'missing',
        state: 'missing',
      }),
      expect.objectContaining({
        target: 'legacy-bot',
        status: null,
        freshness: 'missing',
        state: 'missing',
      }),
    ]);
  }, 30_000);

  it('keeps Legacy runtime warnings unscoped when selected provider has no persisted evidence', async () => {
    const { db: scopedDb, adminId: scopedAdminId } = await createIsolatedDb();
    const user = await createUser(scopedDb, {
      email: 'admin-legacy-warning-unscoped@wtc.local',
      passwordHash: 'hash-legacy-warning-unscoped-should-not-render',
      displayName: 'Warning Scope User',
    });
    await grantProduct(scopedDb, user.id, 'legacy_bot', Date.parse('2026-06-04T12:00:00Z'), scopedAdminId, 'legacy warning scope');
    const instance = await ensureBotInstance(scopedDb, { userId: user.id, productCode: 'legacy_bot' });
    await upsertBotProviderAccountMapping(scopedDb, {
      userId: user.id,
      botInstanceId: instance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'WARNING_SCOPE_PROVIDER_PUB_ID',
      label: 'Warning-scope provider',
      actorUserId: scopedAdminId,
    });
    await recordHealthCheck(scopedDb, 'legacy-bot', 'ok', {
      readState: 'ok',
      providerAccountMappingsSeen: 1,
      providerAccountMappingsSnapshotted: 1,
      warningCodes: ['legacy_quarantined', 'no_trade_history'],
      providerMarker: 'OTHER_PROVIDER_WARNING_SHOULD_NOT_RENDER',
    });
    await recordHealthCheck(scopedDb, 'worker', 'ok', {
      coreWorkerStatus: 'ok',
      botContinuityStatus: 'ok',
      legacySnapshot: 'ok',
      legacyReadState: 'ok',
    });

    const detail = await loadAdminUserBotDetailFromDb(scopedDb, user.id, Date.parse('2026-06-04T12:02:00Z'));
    const legacy = detail.bots.find((bot) => bot.productCode === 'legacy_bot');

    expect(legacy?.providerScope).toBe('provider_account_mapped');
    expect(legacy?.latestMetric).toBeNull();
    expect(legacy?.positions).toEqual([]);
    expect(legacy?.trades).toEqual([]);
    expect(legacy?.equityCurve).toEqual([]);
    expect(legacy?.runtimeHealth.state).toBe('ok');
    expect(legacy?.workerContinuity.state).toBe('ok');
    expect(legacy?.warningSummary.scope).toBe('runtime_not_scoped');
    expect(legacy?.warningSummary.source).toBe('product_registry');
    expect(legacy?.warningSummary.evaluatedAt).toBeNull();
    expect(legacy?.warningSummary.warnings.map((warning) => warning.code)).not.toContain('legacy_quarantined');
    expect(JSON.stringify(detail)).not.toContain('WARNING_SCOPE_PROVIDER_PUB_ID');
    expect(JSON.stringify(detail)).not.toContain('OTHER_PROVIDER_WARNING_SHOULD_NOT_RENDER');
  }, 30_000);

  it('does not pick the first active Legacy provider mapping when multiple mappings exist', async () => {
    const { db: ambiguousDb, adminId: ambiguousAdminId } = await createIsolatedDb();
    const user = await createUser(ambiguousDb, {
      email: 'admin-legacy-ambiguous@wtc.local',
      passwordHash: 'hash-legacy-ambiguous-should-not-render',
      displayName: 'Ambiguous Legacy User',
    });
    await grantProduct(ambiguousDb, user.id, 'legacy_bot', Date.parse('2026-06-04T10:00:00Z'), ambiguousAdminId, 'ambiguous-legacy');
    const instance = await ensureBotInstance(ambiguousDb, { userId: user.id, productCode: 'legacy_bot' });
    const firstMapping = await upsertBotProviderAccountMapping(ambiguousDb, {
      userId: user.id,
      botInstanceId: instance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'AMBIGUOUS_FIRST_LEGACY_PUB_ID',
      label: 'First ambiguous mapping',
      actorUserId: ambiguousAdminId,
    });
    await upsertBotProviderAccountMapping(ambiguousDb, {
      userId: user.id,
      botInstanceId: instance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db-v2',
      providerAccountId: 'AMBIGUOUS_SECOND_LEGACY_PUB_ID',
      label: 'Second ambiguous mapping',
      actorUserId: ambiguousAdminId,
    });
    await insertBotMetricSnapshot(ambiguousDb, {
      botInstanceId: instance.id,
      botProviderAccountId: firstMapping.id,
      snapshotAt: new Date('2026-06-04T10:05:00Z'),
      walletEquityUsd: '4444.4400',
      closedPnlUsd: '44.0000',
      sourceAdapter: 'AMBIGUOUS_LEGACY_SOURCE_SHOULD_NOT_RENDER',
      tradeCount: 4,
    });
    await recordHealthCheck(ambiguousDb, 'legacy-bot', 'ok', {
      readState: 'ok',
      providerAccountMappingsSeen: 2,
      providerAccountMappingsSnapshotted: 2,
    });

    const detail = await loadAdminUserBotDetailFromDb(ambiguousDb, user.id, Date.parse('2026-06-04T10:07:00Z'));
    const legacy = detail.bots.find((bot) => bot.productCode === 'legacy_bot');

    expect(detail.providerAccounts).toHaveLength(2);
    expect(legacy?.providerAccount).toBeNull();
    expect(legacy?.providerScope).toBe('provider_account_pending');
    expect(legacy?.latestMetric).toBeNull();
    expect(legacy?.positions).toEqual([]);
    expect(legacy?.trades).toEqual([]);
    expect(legacy?.equityCurve).toEqual([]);
    expect(legacy?.statsSource.providerScoped).toBe(false);
    expect(legacy?.warningSummary.scope).toBe('runtime_not_scoped');
    expect(detail.providerAccounts.map((account) => account.status)).toEqual(['active', 'active']);
    expect(detail.providerAccounts.map((account) => account.providerAccountId)).toEqual(['AMBIGU...B_ID', 'AMBIGU...B_ID']);
    expect(JSON.stringify(detail)).not.toContain('AMBIGUOUS_FIRST_LEGACY_PUB_ID');
    expect(JSON.stringify(detail)).not.toContain('AMBIGUOUS_SECOND_LEGACY_PUB_ID');
    expect(JSON.stringify(detail)).not.toContain('AMBIGUOUS_LEGACY_SOURCE_SHOULD_NOT_RENDER');
    expect(JSON.stringify(detail)).not.toContain('4444.4400');
  }, 30_000);

  it('resolves admin-visible config source through defaults, markers, locks, built-ins, and short provider masks', async () => {
    const { db: sourceDb, adminId: sourceAdminId } = await createIsolatedDb();
    const tortilaDefaultV1 = {
      operationMode: 'auto',
      symbols: 'BTC/USDT:USDT',
      symbolConfigs: [{ symbol: 'BTC/USDT:USDT' }],
      timeframe: '4h',
      system: 2,
      riskPercent: 0.4,
      maxOpenSymbols: 4,
    };
    const tortilaDefaultV2 = {
      ...tortilaDefaultV1,
      symbols: 'ETH/USDT:USDT',
      symbolConfigs: [{ symbol: 'ETH/USDT:USDT' }],
      maxOpenSymbols: 8,
    };
    const legacyLockedDefault = {
      operationMode: 'manual',
      symbols: 'LOCKED_DEFAULT_SYMBOL',
      defaultTimeframe: '3m',
      defaultTakeProfitPercent: 0.55,
      symbolConfigs: [{ symbol: 'LOCKED_DEFAULT_SYMBOL', useRsi: false, useCci: true }],
      stageConfigs: [{ stage: 1, rsiSlots: 0, cciSlots: 3 }],
    };

    const defaultUser = await createUser(sourceDb, {
      email: 'admin-source-default@wtc.local',
      passwordHash: 'hash-source-default-should-not-render',
      displayName: 'Default Source User',
    });
    await grantProduct(sourceDb, defaultUser.id, 'tortila_bot', Date.parse('2026-06-03T13:00:00Z'), sourceAdminId, 'source-default');
    await saveBotGlobalConfig(sourceDb, {
      productCode: 'tortila_bot',
      label: 'Tortila admin default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: tortilaDefaultV1,
      changedBy: sourceAdminId,
      reason: 'publish admin source default',
      expectedVersion: 0,
    });

    const beforeDefaultLoad = await tableCounts(sourceDb);
    const defaultDetail = await loadAdminUserBotDetailFromDb(sourceDb, defaultUser.id);
    const afterDefaultLoad = await tableCounts(sourceDb);
    expect(afterDefaultLoad).toEqual(beforeDefaultLoad);
    const defaultTortila = defaultDetail.bots.find((bot) => bot.productCode === 'tortila_bot');
    const defaultLegacy = defaultDetail.bots.find((bot) => bot.productCode === 'legacy_bot');
    expect(defaultTortila?.botInstanceId).toBeNull();
    expect(defaultTortila?.configSummary).toMatchObject({
      source: 'system_default',
      sourceLabel: 'Tortila admin default v1',
      version: 1,
      userVersion: null,
      resolvedFromUserSelection: false,
      userConfigIgnoredByLock: false,
      symbols: ['BTC/USDT:USDT'],
      riskSummary: 'System 2 - 4h timeframe - 0.4% risk - 4 max symbols',
    });
    expect(defaultLegacy?.configSummary).toMatchObject({
      source: 'built_in',
      sourceLabel: 'Built-in Legacy defaults',
      version: null,
      userVersion: null,
      systemDefault: null,
    });

    const markerUser = await createUser(sourceDb, {
      email: 'admin-source-marker@wtc.local',
      passwordHash: 'hash-source-marker-should-not-render',
      displayName: 'Marker Source User',
    });
    const markerInstance = await ensureBotInstance(sourceDb, { userId: markerUser.id, productCode: 'tortila_bot' });
    await saveBotConfig(sourceDb, {
      botInstanceId: markerInstance.id,
      changedBy: markerUser.id,
      note: 'select system default',
      config: {
        __wtcBotConfigSource: 'system_default',
        profileCode: 'system_default',
        globalConfigId: 'GLOBAL_CONFIG_ID_SHOULD_NOT_RENDER',
        selectedGlobalVersion: 1,
      },
    });
    await saveBotGlobalConfig(sourceDb, {
      productCode: 'tortila_bot',
      label: 'Tortila admin default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: tortilaDefaultV2,
      changedBy: sourceAdminId,
      reason: 'publish admin source default v2',
      expectedVersion: 1,
    });
    const markerDetail = await loadAdminUserBotDetailFromDb(sourceDb, markerUser.id);
    const markerTortila = markerDetail.bots.find((bot) => bot.productCode === 'tortila_bot');
    expect(markerTortila?.configVersion).toBe(1);
    expect(markerTortila?.configSummary).toMatchObject({
      source: 'system_default',
      sourceLabel: 'Tortila admin default v2',
      version: 2,
      userVersion: 1,
      resolvedFromUserSelection: true,
      symbols: ['ETH/USDT:USDT'],
      riskSummary: 'System 2 - 4h timeframe - 0.4% risk - 8 max symbols',
    });

    await saveBotGlobalConfig(sourceDb, {
      productCode: 'legacy_bot',
      label: 'Legacy locked default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: false,
      config: legacyLockedDefault,
      changedBy: sourceAdminId,
      reason: 'publish locked legacy default',
      expectedVersion: 0,
    });
    const lockedUser = await createUser(sourceDb, {
      email: 'admin-source-locked@wtc.local',
      passwordHash: 'hash-source-locked-should-not-render',
      displayName: 'Locked Source User',
    });
    const lockedInstance = await ensureBotInstance(sourceDb, { userId: lockedUser.id, productCode: 'legacy_bot' });
    await upsertBotProviderAccountMapping(sourceDb, {
      userId: lockedUser.id,
      botInstanceId: lockedInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'AB12',
      label: 'Short provider id must be masked',
      actorUserId: sourceAdminId,
    });
    await saveBotConfig(sourceDb, {
      botInstanceId: lockedInstance.id,
      changedBy: lockedUser.id,
      note: 'stale user override ignored by locked default',
      config: {
        operationMode: 'manual',
        symbols: 'LOCKED_CUSTOM_SHOULD_NOT_RENDER',
        defaultTimeframe: '1m',
        defaultTakeProfitPercent: 9,
        symbolConfigs: [{ symbol: 'LOCKED_CUSTOM_SHOULD_NOT_RENDER', useRsi: true, useCci: false }],
        stageConfigs: [{ stage: 1, rsiSlots: 9, cciSlots: 0 }],
      },
    });
    const lockedDetail = await loadAdminUserBotDetailFromDb(sourceDb, lockedUser.id);
    const lockedLegacy = lockedDetail.bots.find((bot) => bot.productCode === 'legacy_bot');
    expect(lockedLegacy?.configSummary).toMatchObject({
      source: 'system_default',
      sourceLabel: 'Legacy locked default v1',
      version: 1,
      userVersion: 1,
      userConfigIgnoredByLock: true,
      symbols: ['LOCKED_DEFAULT_SYMBOL'],
      riskSummary: '0 RSI / 1 CCI - 3m timeframe - 0.55% TP',
    });
    expect(lockedLegacy?.providerAccount?.providerAccountId).toMatch(/^id#[a-f0-9]{8}$/);

    const json = JSON.stringify({ defaultDetail, markerDetail, lockedDetail });
    expect(json).not.toContain('GLOBAL_CONFIG_ID_SHOULD_NOT_RENDER');
    expect(json).not.toContain('LOCKED_CUSTOM_SHOULD_NOT_RENDER');
    expect(json).not.toContain('AB12');
    expect(json).not.toContain('hash-source-default-should-not-render');
    expect(json).not.toContain('hash-source-marker-should-not-render');
    expect(json).not.toContain('hash-source-locked-should-not-render');
    expect(json).not.toContain('apiSecret');
    expect(json).not.toContain('apiKey');
    expect(json).not.toContain('sealed');
    expect(json).not.toContain('token');
  }, 30_000);

  it('fails closed for unknown users without surfacing any bot rows', async () => {
    const detail = await loadAdminUserBotDetailFromDb(db, '00000000-0000-0000-0000-000000000000');
    expect(detail).toMatchObject({
      mode: 'postgres',
      user: null,
      bots: [],
      exchangeKeys: [],
      liveControlDisabled: true,
    });
  });
});
