import { beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ensureBotInstance,
  findUserByEmail,
  getCurrentBotConfig,
  getPublishedBotGlobalConfig,
  listBotConfigVersions,
  saveBotConfig,
  saveBotGlobalConfig,
  schema,
  seedDatabase,
  type Db,
} from '@wtc/db';

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

async function createDb(): Promise<{ db: Db; adminId: string; userId: string }> {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const file of readdirSync(migDir).filter((name) => name.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, file), 'utf8'));
  }
  const db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  const adminId = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  const userId = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  return { db, adminId, userId };
}

describe('user resolved bot config DB boundaries', () => {
  let db: Db;
  let adminId: string;
  let userId: string;

  beforeEach(async () => {
    ({ db, adminId, userId } = await createDb());
  }, 30_000);

  it('inherits only published applying system defaults without creating user config rows', async () => {
    const instancesBefore = (await db.select({ id: schema.botInstances.id }).from(schema.botInstances)).length;
    const configsBefore = (await db.select({ id: schema.botConfigs.id }).from(schema.botConfigs)).length;

    await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      label: 'Tortila system default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: tortilaConfig,
      changedBy: adminId,
      reason: 'publish tortila baseline',
      expectedVersion: 0,
    });

    const published = await getPublishedBotGlobalConfig(db, 'tortila_bot');
    expect(published?.status).toBe('published');
    expect(published?.appliesToNewUsers).toBe(true);
    expect(published?.config).toMatchObject({ maxOpenSymbols: 5 });

    const instancesAfter = (await db.select({ id: schema.botInstances.id }).from(schema.botInstances)).length;
    const configsAfter = (await db.select({ id: schema.botConfigs.id }).from(schema.botConfigs)).length;
    expect(instancesAfter).toBe(instancesBefore);
    expect(configsAfter).toBe(configsBefore);
  });

  it('ignores draft, archived, and non-applying defaults for user inheritance', async () => {
    await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      label: 'Draft default',
      status: 'draft',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: tortilaConfig,
      changedBy: adminId,
      reason: 'draft only',
      expectedVersion: 0,
    });
    expect(await getPublishedBotGlobalConfig(db, 'tortila_bot')).toBeNull();

    await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      label: 'Published but not inherited',
      status: 'published',
      appliesToNewUsers: false,
      allowUserOverride: true,
      config: tortilaConfig,
      changedBy: adminId,
      reason: 'review only',
      expectedVersion: 1,
    });
    expect(await getPublishedBotGlobalConfig(db, 'tortila_bot')).toBeNull();

    await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      label: 'Archived default',
      status: 'archived',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: tortilaConfig,
      changedBy: adminId,
      reason: 'retired',
      expectedVersion: 2,
    });
    expect(await getPublishedBotGlobalConfig(db, 'tortila_bot')).toBeNull();
  });

  it('keeps user overrides user-owned when admins publish newer defaults', async () => {
    await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      label: 'Tortila system default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: tortilaConfig,
      changedBy: adminId,
      reason: 'publish v1',
      expectedVersion: 0,
    });

    const inst = await ensureBotInstance(db, { userId, productCode: 'tortila_bot' });
    await saveBotConfig(db, {
      botInstanceId: inst.id,
      config: { ...tortilaConfig, maxOpenSymbols: 9 },
      changedBy: userId,
      note: 'custom override',
    });
    await saveBotGlobalConfig(db, {
      productCode: 'tortila_bot',
      label: 'Tortila system default v2',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: { ...tortilaConfig, maxOpenSymbols: 6 },
      changedBy: adminId,
      reason: 'publish v2',
      expectedVersion: 1,
    });

    const current = await getCurrentBotConfig(db, inst.id);
    const published = await getPublishedBotGlobalConfig(db, 'tortila_bot');
    const versions = await listBotConfigVersions(db, inst.id);
    expect(current?.config).toMatchObject({ maxOpenSymbols: 9 });
    expect(published?.config).toMatchObject({ maxOpenSymbols: 6 });
    expect(versions.map((row) => row.version)).toEqual([1]);
    expect(versions[0]?.changedBy).toBe(userId);
  });

  it('supports Legacy published defaults with symbol and stage matrices', async () => {
    await saveBotGlobalConfig(db, {
      productCode: 'legacy_bot',
      label: 'Legacy system default',
      status: 'published',
      appliesToNewUsers: true,
      allowUserOverride: true,
      config: legacyConfig,
      changedBy: adminId,
      reason: 'publish legacy baseline',
      expectedVersion: 0,
    });

    const published = await getPublishedBotGlobalConfig(db, 'legacy_bot');
    expect(published?.config).toMatchObject({
      symbols: 'AAVE-USDT',
      symbolConfigs: [{ symbol: 'AAVE-USDT', useRsi: true, useCci: false }],
      stageConfigs: [{ stage: 1, rsiSlots: 3, cciSlots: 2 }],
    });
    expect(JSON.stringify(published?.config)).not.toContain('apiKey');
    expect(JSON.stringify(published?.config)).not.toContain('providerAccountId');
    expect(JSON.stringify(published?.config)).not.toContain('rawJson');
  });
});
