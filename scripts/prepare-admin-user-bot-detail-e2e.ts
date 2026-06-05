import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  createDbClient,
  createUser,
  DEMO_PASSWORD,
  ensureBotInstance,
  findUserByEmail,
  grantProduct,
  importBotTrade,
  insertBotConfigVersion,
  insertBotMetricSnapshot,
  insertBotPositionSnapshot,
  recordHealthCheck,
  saveBotConfig,
  schema,
  seedDatabase,
  type Db,
  upsertBotProviderAccountMapping,
} from '@wtc/db';
import { hashPassword } from '@wtc/auth';

const url = process.env.ADMIN_USER_BOTS_E2E_DATABASE_URL;
const prepToken = process.env.ADMIN_USER_BOTS_E2E_PREP_TOKEN;
const runUserRoutes = process.env.ADMIN_USER_BOTS_E2E_USER_ROUTES === '1';
const markerPath = join(process.cwd(), '.next-e2e-admin-user-bots', 'admin-user-bots-e2e-prepared.json');
const runtimeScenarios = ['degraded-readable', 'fresh-green', 'stale', 'missing'] as const;
type RuntimeHealthScenario = (typeof runtimeScenarios)[number];
const defaultRuntimeScenario: RuntimeHealthScenario = 'degraded-readable';

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgres://<redacted>')
    .replace(/(password=)[^&\s]+/gi, '$1<redacted>');
}

export function assertThrowawayDbName(databaseUrl: string): string {
  let name: string;
  try {
    name = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error('Admin user bot detail DB e2e refused: ADMIN_USER_BOTS_E2E_DATABASE_URL is not a valid URL.');
  }
  if (!/^wtc_test(?:_[a-z0-9]+)*$/.test(name)) {
    throw new Error(
      `Admin user bot detail DB e2e refused: database "${name || '(none)'}" is not a throwaway test DB. ` +
        'Use a fresh database named wtc_test or wtc_test_admin_user_bots_<suffix> only.',
    );
  }
  return name;
}

export function parseRuntimeHealthScenario(value: string | undefined): RuntimeHealthScenario {
  if (!value) return defaultRuntimeScenario;
  if ((runtimeScenarios as readonly string[]).includes(value)) return value as RuntimeHealthScenario;
  throw new Error(
    `Admin user bot detail DB e2e refused: ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO "${value}" is not supported. ` +
      `Use one of: ${runtimeScenarios.join(', ')}.`,
  );
}

async function seedRuntimeHealthScenario(db: Db, scenario: RuntimeHealthScenario): Promise<void> {
  if (scenario === 'missing') return;

  if (scenario === 'fresh-green') {
    await recordHealthCheck(db, 'tortila-journal', 'ok', {
      status: 'ok',
      processAlive: true,
      readState: 'ok',
      readStateDetail: 'Tortila selected-user runtime snapshot is fresh.',
      warnings: ['apiKey=TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    });
    await recordHealthCheck(db, 'legacy-bot', 'ok', {
      status: 'ok',
      processAlive: true,
      readState: 'ok',
      readStateDetail: 'Legacy selected-user runtime snapshot is fresh.',
      providerAccountMappingsSeen: 1,
      providerAccountMappingsSnapshotted: 1,
      warnings: ['token=LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    });
    await db.insert(schema.integrationHealthChecks).values({
      target: 'worker',
      status: 'ok',
      detail: {
        coreWorkerStatus: 'ok',
        botContinuityStatus: 'ok',
        tortilaSnapshot: 'ok',
        tortilaReadState: 'ok',
        legacySnapshot: 'ok',
        legacyReadState: 'ok',
      },
    });
    return;
  }

  if (scenario === 'stale') {
    await recordHealthCheck(db, 'tortila-journal', 'ok', {
      status: 'ok',
      processAlive: true,
      readState: 'stale',
      readStateDetail: 'Tortila selected-user runtime snapshot is stale for acceptance proof.',
      warnings: ['apiKey=TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    });
    await recordHealthCheck(db, 'legacy-bot', 'ok', {
      status: 'ok',
      processAlive: true,
      readState: 'stale',
      readStateDetail: 'Legacy selected-user runtime snapshot is stale for acceptance proof.',
      providerAccountMappingsSeen: 1,
      providerAccountMappingsSnapshotted: 1,
      warnings: ['token=LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    });
    await db.insert(schema.integrationHealthChecks).values({
      target: 'worker',
      status: 'ok',
      checkedAt: new Date(Date.now() - 10 * 60 * 1000),
      detail: {
        coreWorkerStatus: 'ok',
        botContinuityStatus: 'ok',
        tortilaSnapshot: 'ok',
        tortilaReadState: 'ok',
        legacySnapshot: 'ok',
        legacyReadState: 'ok',
      },
    });
    return;
  }

  await recordHealthCheck(db, 'tortila-journal', 'degraded', {
    status: 'degraded',
    processAlive: true,
    readState: 'ok',
    readStateDetail: 'Tortila selected-user runtime snapshot is readable but degraded.',
    warnings: ['tp_reconcile_p0', 'fill_lookup_109421', 'apiKey=TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    warningCodes: ['margin_preflight_p1', 'not_real'],
  });
  await recordHealthCheck(db, 'legacy-bot', 'degraded', {
    status: 'degraded',
    processAlive: true,
    readState: 'ok',
    readStateDetail: 'Legacy selected-user runtime snapshot is readable but degraded.',
    providerAccountMappingsSeen: 1,
    providerAccountMappingsSnapshotted: 1,
    warnings: ['no_trade_history'],
    warningCodes: ['legacy_quarantined', 'tp_reconcile_p0', 'token=LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER'],
    quarantineReason: 'PROVIDER_REASON_SHOULD_NOT_RENDER',
  });
  await db.insert(schema.integrationHealthChecks).values({
    target: 'worker',
    status: 'not_configured',
    detail: {
      coreWorkerStatus: 'ok',
      botContinuityStatus: 'attention',
      tortilaSnapshot: 'ok',
      tortilaReadState: 'ok',
      legacySnapshot: 'ok',
      legacyReadState: 'ok',
      warningCodes: ['WORKER_SECRET_MARKER_SHOULD_NOT_RENDER'],
    },
  });
}

async function prepareFixture(databaseUrl: string): Promise<{ dbName: string; userAId: string; migrationCount: number; runtimeScenario: RuntimeHealthScenario; userRoutes: boolean }> {
  const dbName = assertThrowawayDbName(databaseUrl);
  const runtimeScenario = parseRuntimeHealthScenario(process.env.ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO);
  const { client, db } = createDbClient(databaseUrl);
  try {
    const existing = await client<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    if (existing.length > 0) {
      throw new Error(
        `Admin user bot detail DB e2e refused: ${dbName} is not empty (${existing.length} table(s)). ` +
          'Drop/recreate the throwaway DB before running this acceptance harness.',
      );
    }

    const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
    const files = readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort();
    if (files.length === 0) throw new Error('Admin user bot detail DB e2e refused: no migration SQL files found.');
    for (const file of files) {
      await client.unsafe(readFileSync(join(migDir, file), 'utf8'));
    }
    await seedDatabase(db);
    const demoPasswordHash = await hashPassword(DEMO_PASSWORD);

    const admin = await findUserByEmail(db, 'admin@wtc.local');
    if (!admin) throw new Error('Admin user bot detail DB e2e refused: seeded admin user was not found.');

    const userA = await createUser(db, {
      email: 'admin-drilldown-a@wtc.local',
      passwordHash: demoPasswordHash,
      displayName: 'Drilldown User A',
    });
    const userB = await createUser(db, {
      email: 'admin-drilldown-b@wtc.local',
      passwordHash: 'hash-user-b-should-never-render',
      displayName: 'Drilldown User B',
    });

    await grantProduct(db, userA.id, 'tortila_bot', Date.parse('2026-06-03T09:00:00Z'), admin.id, 'admin_user_bots_e2e_a_tortila');
    await grantProduct(db, userB.id, 'legacy_bot', Date.parse('2026-06-03T09:01:00Z'), admin.id, 'admin_user_bots_e2e_b_legacy');
    await db.insert(schema.entitlements).values({
      userId: userA.id,
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
        userId: userA.id,
        exchange: 'bingx',
        label: 'USER_A_EXCHANGE_ONLY',
        mode: 'demo',
        keyMask: '****A111',
      })
      .returning();
    const [exchangeB] = await db
      .insert(schema.exchangeAccounts)
      .values({
        userId: userB.id,
        exchange: 'binance',
        label: 'USER_B_EXCHANGE_MUST_NOT_LEAK',
        mode: 'live',
        keyMask: '****B999',
      })
      .returning();
    if (!exchangeA || !exchangeB) throw new Error('Admin user bot detail DB e2e refused: exchange fixture insert failed.');

    await db.insert(schema.exchangeApiKeySecrets).values({
      exchangeAccountId: exchangeA.id,
      sealed: { marker: 'USER_A_SEALED_SECRET_SHOULD_NOT_RENDER' },
      keyId: 'key-user-a-secret-should-not-render',
    });
    await db.insert(schema.exchangeApiKeySecrets).values({
      exchangeAccountId: exchangeB.id,
      sealed: { marker: 'USER_B_SEALED_SECRET_MUST_NOT_LEAK' },
      keyId: 'key-user-b-secret-must-not-leak',
    });

    const instanceA = await ensureBotInstance(db, {
      userId: userA.id,
      productCode: 'tortila_bot',
      exchangeAccountId: exchangeA.id,
    });
    const legacyInstanceA = await ensureBotInstance(db, {
      userId: userA.id,
      productCode: 'legacy_bot',
    });
    const instanceB = await ensureBotInstance(db, {
      userId: userB.id,
      productCode: 'legacy_bot',
      exchangeAccountId: exchangeB.id,
    });

    const legacyProviderA = await upsertBotProviderAccountMapping(db, {
      userId: userA.id,
      botInstanceId: legacyInstanceA.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'USER_A_LEGACY_PUB_ID',
      label: 'User A Legacy provider account',
      actorUserId: admin.id,
    });
    await upsertBotProviderAccountMapping(db, {
      userId: userB.id,
      botInstanceId: instanceB.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'USER_B_LEGACY_PUB_ID_MUST_NOT_LEAK',
      label: 'User B Legacy provider account must not leak',
      actorUserId: admin.id,
    });

    await saveBotConfig(db, {
      botInstanceId: instanceA.id,
      config: {
        rawMarker: 'USER_A_RAW_CONFIG_SHOULD_NOT_RENDER',
        operationMode: 'manual',
        symbols: ['A_ONLY_SYMBOL'],
        timeframe: '4h',
        system: 2,
        riskPercent: 0.3,
        maxOpenSymbols: 3,
      },
      changedBy: userA.id,
    });
    await saveBotConfig(db, {
      botInstanceId: legacyInstanceA.id,
      config: {
        rawMarker: 'USER_A_LEGACY_RAW_CONFIG_SHOULD_NOT_RENDER',
        operationMode: 'manual',
        symbols: 'USER_A_LEGACY_SYMBOL',
        defaultTimeframe: '3m',
        defaultTakeProfitPercent: 0.5,
        symbolConfigs: [{ symbol: 'USER_A_LEGACY_SYMBOL', useRsi: true, useCci: false }],
        stageConfigs: [
          { stage: 1, rsiSlots: 2, cciSlots: 1 },
          { stage: 2, rsiSlots: 1, cciSlots: 1 },
        ],
      },
      changedBy: userA.id,
    });
    await saveBotConfig(db, {
      botInstanceId: instanceB.id,
      config: { rawMarker: 'USER_B_RAW_CONFIG_MUST_NOT_LEAK', symbols: ['B_ONLY_SYMBOL'] },
      changedBy: userB.id,
    });
    await insertBotConfigVersion(db, {
      botInstanceId: instanceA.id,
      version: 77,
      configJson: { rawMarker: 'USER_A_HISTORY_CONFIG_SHOULD_NOT_RENDER' },
      changedBy: userA.id,
      note: 'admin user bot detail e2e fixture',
    });
    await insertBotConfigVersion(db, {
      botInstanceId: instanceB.id,
      version: 77,
      configJson: { rawMarker: 'USER_B_HISTORY_CONFIG_MUST_NOT_LEAK' },
      changedBy: userB.id,
      note: 'admin user bot detail e2e fixture',
    });

    await insertBotMetricSnapshot(db, {
      botInstanceId: instanceA.id,
      snapshotAt: new Date('2026-06-03T08:00:00Z'),
      walletEquityUsd: '1100.0000',
      closedPnlUsd: '11.0000',
      sourceAdapter: 'USER_A_OLDER_SOURCE',
      tradeCount: 3,
    });
    await insertBotMetricSnapshot(db, {
      botInstanceId: instanceA.id,
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
      botInstanceId: instanceB.id,
      snapshotAt: new Date('2026-06-03T11:00:00Z'),
      walletEquityUsd: '9999.9900',
      closedPnlUsd: '999.0000',
      sourceAdapter: 'USER_B_LATEST_SOURCE_MUST_NOT_LEAK',
      tradeCount: 99,
    });
    await insertBotMetricSnapshot(db, {
      botInstanceId: legacyInstanceA.id,
      snapshotAt: new Date('2026-06-03T12:30:00Z'),
      walletEquityUsd: '7777.7700',
      sourceAdapter: 'USER_A_LEGACY_NULL_FLEET_SHOULD_NOT_RENDER',
      tradeCount: 77,
      rawJson: {
        closedTradeSourceProof: {
          status: 'blocked_no_source',
          canImportClosedTrades: false,
          missingRequirements: ['UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER'],
        },
      },
    });
    await insertBotMetricSnapshot(db, {
      botInstanceId: legacyInstanceA.id,
      botProviderAccountId: legacyProviderA.id,
      snapshotAt: new Date('2026-06-03T12:00:00Z'),
      walletEquityUsd: '2222.2200',
      sourceAdapter: 'USER_A_LEGACY_SCOPED_SOURCE',
      tradeCount: 22,
      rawJson: {
        closedTradeSourceProof: {
          status: 'ready_for_mapper',
          canImportClosedTrades: true,
          missingRequirements: ['closed_at', 'SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER', 'symbol'],
          rawPayloadAllowlist: ['SOURCE_PROOF_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER'],
          unsafeRawPayloadFields: ['SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER'],
          blockers: ['SOURCE_PROOF_BLOCKER_SHOULD_NOT_RENDER'],
          evidenceRef: 'SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER',
        },
        liveConfig: {
          providerAccountId: 'SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER',
          apiKey: 'SOURCE_PROOF_RAW_API_KEY_SHOULD_NOT_RENDER',
        },
      },
    });

    await insertBotPositionSnapshot(db, {
      botInstanceId: instanceA.id,
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
      botInstanceId: instanceB.id,
      botProviderAccountId: legacyProviderA.id,
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
      botInstanceId: legacyInstanceA.id,
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
      botInstanceId: legacyInstanceA.id,
      botProviderAccountId: legacyProviderA.id,
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
      botInstanceId: instanceA.id,
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
    if (runUserRoutes) {
      await saveBotConfig(db, {
        botInstanceId: instanceA.id,
        config: {
          rawMarker: 'USER_ROUTE_RAW_CONFIG_SHOULD_NOT_RENDER',
          operationMode: 'manual',
          symbols: 'USER_ROUTE_TORTILA_CONFIG_SYMBOL',
          symbolConfigs: [
            {
              symbol: 'USER_ROUTE_TORTILA_CONFIG_SYMBOL',
              timeframe: '4h',
              system: 2,
              riskPercent: 0.45,
              stopN: 2,
              addStep: 0.5,
              maxUnits: 3,
              atrPeriod: 20,
              takeProfitRr: 8,
            },
          ],
          timeframe: '4h',
          system: 2,
          riskPercent: 0.45,
          stopN: 2,
          addStep: 0.5,
          maxUnits: 3,
          atrPeriod: 20,
          leverage: 3,
          takeProfitRr: 8,
          maxOpenSymbols: 2,
          maxTotalUnits: 6,
          maxUnitsPerDirection: 4,
          haltDrawdownPercent: 35,
          dailyMaxLossPercent: 6,
          maxNewEntriesPerTick: 2,
        },
        changedBy: userA.id,
      });
      await insertBotConfigVersion(db, {
        botInstanceId: instanceA.id,
        version: 88,
        configJson: { rawMarker: 'USER_ROUTE_HISTORY_CONFIG_SHOULD_NOT_RENDER' },
        changedBy: userA.id,
        note: 'user route tortila mark unavailable e2e fixture',
      });
      await insertBotMetricSnapshot(db, {
        botInstanceId: instanceA.id,
        snapshotAt: new Date('2026-06-03T10:20:00Z'),
        walletEquityUsd: '4321.0000',
        closedPnlUsd: '12.3400',
        unrealizedPnlUsd: '8888.8800',
        winRate: '0.5000',
        profitFactor: '1.2500',
        maxDrawdownPct: '0.0100',
        sourceAdapter: 'tortila',
        tradeCount: 1,
      });
      await insertBotPositionSnapshot(db, {
        botInstanceId: instanceA.id,
        snapshotAt: new Date('2026-06-03T10:21:00Z'),
        sourceAdapter: 'tortila',
        positions: [
          {
            symbol: 'USER_ROUTE_TORTILA_POSITION',
            side: 'long',
            size: '0.25000000',
            entryPrice: '100.00000000',
            markPrice: '99999.99000000',
            unrealizedPnlUsd: '8888.8800',
            leverage: 3,
            tpPrice: '125.00000000',
            slPrice: '80.00000000',
            openedAt: new Date('2026-06-03T09:45:00Z'),
          },
        ],
      });
      await importBotTrade(db, {
        botInstanceId: instanceA.id,
        externalTradeId: 'USER_ROUTE_TORTILA_TRADE_ID',
        symbol: 'USER_ROUTE_TORTILA_TRADE',
        side: 'long',
        entryPrice: '100.00000000',
        exitPrice: '112.00000000',
        size: '0.10000000',
        realizedPnlUsd: '1.2000',
        feesUsd: '0.0100',
        fundingPaidUsd: '0.0000',
        openedAt: new Date('2026-06-03T09:00:00Z'),
        closedAt: new Date('2026-06-03T10:22:00Z'),
        exitReason: 'take_profit',
        sourceAdapter: 'tortila',
        rawJson: { marker: 'USER_ROUTE_RAW_TRADE_SHOULD_NOT_RENDER' },
      });
    }
    await importBotTrade(db, {
      botInstanceId: instanceB.id,
      botProviderAccountId: legacyProviderA.id,
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
      botInstanceId: legacyInstanceA.id,
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
      botInstanceId: legacyInstanceA.id,
      botProviderAccountId: legacyProviderA.id,
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

    await seedRuntimeHealthScenario(db, runtimeScenario);

    return { dbName, userAId: userA.id, migrationCount: files.length, runtimeScenario, userRoutes: runUserRoutes };
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  if (!url) throw new Error('Set ADMIN_USER_BOTS_E2E_DATABASE_URL to a fresh throwaway Postgres database before running admin user bot detail DB e2e.');
  if (!prepToken) throw new Error('Use npm run e2e:admin-user-bots:db so the admin user bot detail prep token is generated.');

  const prepared = await prepareFixture(url);
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, JSON.stringify({
    dbName: prepared.dbName,
    userAId: prepared.userAId,
    runtimeScenario: prepared.runtimeScenario,
    userRoutes: prepared.userRoutes,
    urlHmacSha256: createHmac('sha256', prepToken).update(url).digest('hex'),
    migrationCount: prepared.migrationCount,
    preparedAt: new Date().toISOString(),
  }, null, 2) + '\n');
  console.log(`Prepared ${prepared.dbName} for admin user bot detail DB e2e with ${prepared.migrationCount} migration(s), scenario ${prepared.runtimeScenario}, and a selected-user bot fixture.`);
}

main().catch((err) => {
  console.error(safeMessage(err));
  process.exit(1);
});
