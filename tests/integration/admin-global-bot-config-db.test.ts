import { describe, expect, it, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  findUserByEmail,
  getBotGlobalConfig,
  listBotGlobalConfigVersions,
  listBotGlobalConfigs,
  recentAuditEvents,
  saveBotGlobalConfig,
  schema,
  seedDatabase,
  type Db,
} from '@wtc/db';

let db: Db;
let adminId: string;

const tortilaConfig = {
  operationMode: 'manual',
  symbols: 'BTC/USDT:USDT',
  symbolConfigs: [
    { symbol: 'BTC/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, stopN: 2, addStep: 0.5, maxUnits: 4, atrPeriod: 20, takeProfitRr: 0 },
  ],
  timeframe: '4h',
  system: 2,
  riskPercent: 0.3,
  stopN: 2,
  addStep: 0.5,
  maxUnits: 4,
  atrPeriod: 20,
  leverage: 3,
  takeProfitRr: 0,
  maxOpenSymbols: 5,
  maxTotalUnits: 12,
  maxUnitsPerDirection: 8,
  haltDrawdownPercent: 35,
  dailyMaxLossPercent: 6,
  maxNewEntriesPerTick: 2,
};

const legacyConfig = {
  operationMode: 'manual',
  apiProfile: 'legacy-main',
  symbols: 'AAVE-USDT',
  maxSymbols: 3,
  defaultTimeframe: '3m',
  defaultTakeProfitPercent: 0.5,
  defaultInitialEntryPercent: 2,
  defaultUseBalancePercent: 1.5,
  defaultLeverage: 2,
  symbolConfigs: [
    {
      symbol: 'AAVE-USDT',
      active: true,
      timeframe: '3m',
      useRsi: true,
      useCci: false,
      rsiLength: 14,
      rsiThreshold: 20,
      cciLength: 20,
      cciThreshold: -230,
      takeProfitPercent: 0.5,
      initialEntryPercent: 100,
      averagingLevels: 3,
      averagingPercents: '3,12,35',
      averagingVolumePercents: '4,6,12',
      useBalancePercent: 1.5,
      leverage: 2,
      stage: 1,
      useDelayFilter: false,
      delayBars: 1,
      useDeltaFilter: false,
      deltaFilter: 0,
    },
  ],
  stageConfigs: [{ stage: 1, rsiSlots: 3, cciSlots: 2 }],
};

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const file of readdirSync(migDir).filter((name) => name.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, file), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  adminId = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
}, 30_000);

describe('admin global bot config repositories', () => {
  it('saves system defaults without creating user bot instances or user configs', async () => {
    const botInstancesBefore = (await db.select({ id: schema.botInstances.id }).from(schema.botInstances)).length;
    const botConfigsBefore = (await db.select({ id: schema.botConfigs.id }).from(schema.botConfigs)).length;

    const first = await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      profileCode: 'system_default',
      label: 'Tortila system default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: tortilaConfig,
      changedBy: adminId,
      reason: 'reviewed tortila system baseline',
      expectedVersion: 0,
    });
    const second = await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      profileCode: 'system_default',
      label: 'Tortila system default v2',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: { ...tortilaConfig, maxOpenSymbols: 6 },
      changedBy: adminId,
      reason: 'reviewed tortila portfolio cap',
      expectedVersion: 1,
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    const current = await getBotGlobalConfig(db, 'tortila_bot');
    expect(current?.version).toBe(2);
    expect(current?.config).toMatchObject({ maxOpenSymbols: 6 });

    const versions = await listBotGlobalConfigVersions(db, second.id);
    expect(versions.map((row) => row.version)).toEqual([2, 1]);
    expect(versions[0]?.reason).toBe('reviewed tortila portfolio cap');

    const botInstancesAfter = (await db.select({ id: schema.botInstances.id }).from(schema.botInstances)).length;
    const botConfigsAfter = (await db.select({ id: schema.botConfigs.id }).from(schema.botConfigs)).length;
    expect(botInstancesAfter).toBe(botInstancesBefore);
    expect(botConfigsAfter).toBe(botConfigsBefore);
  });

  it('supports separate Legacy defaults and rejects stale or duplicate active defaults', async () => {
    await saveBotGlobalConfig(db, {
      productCode: 'legacy_bot',
      label: 'Legacy system default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: legacyConfig,
      changedBy: adminId,
      reason: 'reviewed legacy averaging baseline',
      expectedVersion: 0,
    });

    const all = await listBotGlobalConfigs(db);
    expect(all.some((row) => row.productCode === 'legacy_bot')).toBe(true);
    await expect(saveBotGlobalConfig(db, {
      productCode: 'legacy_bot',
      label: 'Legacy stale write',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: legacyConfig,
      changedBy: adminId,
      reason: 'stale legacy default update',
      expectedVersion: 0,
    })).rejects.toThrow('bot_global_config_stale_version');

    await expect(saveBotGlobalConfig(db, {
      productCode: 'legacy_bot',
      profileCode: 'alt_default',
      label: 'Legacy alternate active default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: legacyConfig,
      changedBy: adminId,
      reason: 'alternate published default collision',
      expectedVersion: 0,
    })).rejects.toThrow('bot_global_config_unique_conflict');
  });

  it('rejects forbidden global config keys at the repository boundary without writes', async () => {
    const forbiddenCases: Array<[string, Record<string, unknown>]> = [
      ['api_key', { apiKey: 'redacted' }],
      ['provider_pub_id', { symbolConfigs: [{ symbol: 'AAVE-USDT', providerPubId: 'provider-pub-redacted' }] }],
      ['provider_account', { symbolConfigs: [{ symbol: 'BTC/USDT:USDT', providerAccountId: 'provider-account-redacted' }] }],
      ['provider_accounts', { providerAccounts: [{ id: 'provider-account-redacted' }] }],
      ['active_slots', { activeSlots: [{ providerPubId: 'provider-pub-redacted', symbol: 'AAVE-USDT' }] }],
      ['active_order_summary', { activeOrderSummary: [{ providerPubId: 'provider-pub-redacted', symbol: 'AAVE-USDT' }] }],
      ['raw_json', { rawJson: { liveConfig: 'redacted' } }],
      ['legacy_url', { legacyDatabaseUrl: 'redacted-url' }],
      ['live_apply', { applyConfig: true }],
      ['live_control', { startBot: true, stopBot: true }],
      ['live_control_alias', { liveControl: true }],
      ['exchange_apply_alias', { exchangeApply: true }],
      ['exchange_order_alias', { exchangeOrder: true }],
    ];

    for (const [name, unsafe] of forbiddenCases) {
      const countsBefore = {
        configs: (await db.select({ id: schema.botGlobalConfigs.id }).from(schema.botGlobalConfigs)).length,
        versions: (await db.select({ id: schema.botGlobalConfigVersions.id }).from(schema.botGlobalConfigVersions)).length,
        audits: (await db.select({ id: schema.auditLogs.id }).from(schema.auditLogs)).length,
      };

      await expect(saveBotGlobalConfig(db, {
        productCode: 'tortila_bot',
        profileCode: `unsafe_${name}`,
        label: `Unsafe ${name}`,
        status: 'draft',
        appliesToNewUsers: false,
        allowUserOverride: false,
        config: { ...tortilaConfig, ...unsafe },
        changedBy: adminId,
        reason: `unsafe ${name} should be rejected`,
        expectedVersion: 0,
      })).rejects.toThrow('bot_config_forbidden_key');

      const countsAfter = {
        configs: (await db.select({ id: schema.botGlobalConfigs.id }).from(schema.botGlobalConfigs)).length,
        versions: (await db.select({ id: schema.botGlobalConfigVersions.id }).from(schema.botGlobalConfigVersions)).length,
        audits: (await db.select({ id: schema.auditLogs.id }).from(schema.auditLogs)).length,
      };
      expect(countsAfter).toEqual(countsBefore);
    }
  });

  it('audits metadata only and keeps raw config out of audit rows', async () => {
    const audits = await recentAuditEvents(db, 1000);
    const audit = audits.find((row) => row.action === 'bot.global_config.save' && row.targetType === 'bot_global_config');
    expect(audit).toBeDefined();
    expect(audit?.actorUserId).toBe(adminId);
    expect(audit?.actorRole).toBe('admin');
    expect(JSON.stringify(audit?.after)).toContain('productCode');
    expect(JSON.stringify(audit?.after)).toContain('version');
    expect(JSON.stringify(audit?.after)).not.toContain('symbolConfigs');
    expect(JSON.stringify(audit?.after)).not.toContain('BTC/USDT');
    expect(JSON.stringify(audit?.after)).not.toContain('apiKey');
    expect(JSON.stringify(audit?.after)).not.toContain('providerPubId');
  });

  it('relies on DB constraints for product/status allowlists', async () => {
    await expect(db.insert(schema.botGlobalConfigs).values({
      productCode: 'unknown_bot',
      profileCode: 'system_default',
      label: 'Invalid product',
      status: 'published',
      config: {},
      updatedBy: adminId,
    })).rejects.toThrow();

    const current = await getBotGlobalConfig(db, 'legacy_bot');
    expect(current).not.toBeNull();
    const rows = await db.select().from(schema.botGlobalConfigVersions).where(eq(schema.botGlobalConfigVersions.globalConfigId, current!.id));
    expect(rows.length).toBe(1);
  });
});
