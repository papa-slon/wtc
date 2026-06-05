import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ensureBotInstance,
  disableBotProviderAccountMapping,
  findUserByEmail,
  listActiveBotProviderAccounts,
  schema,
  seedDatabase,
  summarizeUserBotProviderMapping,
  upsertBotProviderAccountMapping,
  type Db,
} from '@wtc/db';
import { snapshotLegacyRowsToWtc } from '../../apps/worker/src/legacy-live.ts';

let db: Db;
let userId: string;
let adminId: string;
let otherUserId: string;

const legacyRows = {
  accounts: [
    {
      pub_id: 'USER_A_PROVIDER_PUB_ID',
      market: 'BINGX',
      running: true,
      balance: '3210.55',
      quarantined: false,
      quarantine_reason: null,
    },
  ],
  settings: [
    {
      api_id: 'USER_A_PROVIDER_PUB_ID',
      symbol: 'BTC-USDT',
      active: true,
      timeframe: '3m',
      use_rsi: true,
      use_cci: false,
      rsi_length: 14,
      rsi_threshold: '22',
      cci_length: 20,
      cci_threshold: '-180',
      take_profit_percent: '0.7',
      initial_entry_percent: '100',
      averaging_levels: 3,
      averaging_percents: '3,9,21',
      averaging_volume_percents: '4,8,16',
      use_balance_percent: '1.2',
      leverage: 2,
      stage: 1,
      use_delay_filter: true,
      delay_bars: 2,
      use_delta_filter: false,
      delta_filter: '0',
    },
  ],
  stages: [
    { api_id: 'USER_A_PROVIDER_PUB_ID', stage: 1, rsi_slots: 2, cci_slots: 1 },
  ],
  slots: [
    {
      api_id: 'USER_A_PROVIDER_PUB_ID',
      position: 'BTC-USDT',
      reason: 'YELLOW',
      stage: 1,
      averaging_count: 1,
      active: true,
      created_at: new Date('2026-06-03T08:00:00Z'),
    },
  ],
  orders: [
    {
      api_id: 'USER_A_PROVIDER_PUB_ID',
      position: 'BTC-USDT',
      position_side: 'LONG',
      note: 'BUY',
      price: '100000',
      quantity: '0.01',
      active: true,
    },
    {
      api_id: 'USER_A_PROVIDER_PUB_ID',
      position: 'BTC-USDT',
      position_side: 'LONG',
      note: 'TAKE_PROFIT',
      price: '101000',
      quantity: '0.01',
      active: true,
    },
  ],
};

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  for (const f of readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  db = drizzle(pg, { schema }) as unknown as Db;
  await seedDatabase(db);
  userId = (await findUserByEmail(db, 'user@wtc.local'))!.id;
  adminId = (await findUserByEmail(db, 'admin@wtc.local'))!.id;
  otherUserId = (await findUserByEmail(db, 'teacher@wtc.local'))!.id;
}, 30_000);

describe('Legacy provider-account worker snapshot scoping', () => {
  it('lists only active provider-account mappings for the Legacy worker', async () => {
    await expect(summarizeUserBotProviderMapping(db, {
      userId: otherUserId,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
    })).resolves.toMatchObject({ botInstanceId: null, activeCount: 0, status: 'missing_instance' });

    const activeInstance = await ensureBotInstance(db, { userId, productCode: 'legacy_bot' });
    const inactiveInstance = await ensureBotInstance(db, { userId, productCode: 'tortila_bot' });
    const active = await upsertBotProviderAccountMapping(db, {
      userId,
      botInstanceId: activeInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'USER_A_PROVIDER_PUB_ID',
      actorUserId: adminId,
    });
    await upsertBotProviderAccountMapping(db, {
      userId,
      botInstanceId: inactiveInstance.id,
      productCode: 'tortila_bot',
      provider: 'tortila-journal',
      providerAccountId: 'TORTILA_SHOULD_NOT_MATCH',
      actorUserId: adminId,
    });

    const mappings = await listActiveBotProviderAccounts(db, { productCode: 'legacy_bot', provider: 'legacy-db' });
    expect(mappings.map((row) => row.id)).toContain(active.id);
    expect(mappings.every((row) => row.productCode === 'legacy_bot' && row.provider === 'legacy-db' && row.status === 'active')).toBe(true);
    await expect(summarizeUserBotProviderMapping(db, {
      userId,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
    })).resolves.toMatchObject({ botInstanceId: activeInstance.id, activeCount: 1, status: 'active_mapping' });
    await expect(upsertBotProviderAccountMapping(db, {
      userId,
      botInstanceId: activeInstance.id,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      providerAccountId: 'USER_A_SECOND_ACTIVE_PUB_ID',
      actorUserId: adminId,
    })).rejects.toThrow('provider_account_already_mapped');
  });

  it('writes metric and position snapshots scoped to the mapped WTC provider account', async () => {
    const [mapping] = await listActiveBotProviderAccounts(db, { productCode: 'legacy_bot', provider: 'legacy-db' });
    expect(mapping).toBeTruthy();

    const result = await snapshotLegacyRowsToWtc(db, {
      botInstanceId: mapping!.botInstanceId,
      botProviderAccountId: mapping!.id,
      rows: legacyRows,
      now: Date.parse('2026-06-03T08:05:00Z'),
      adapterMode: 'read-only',
    });

    expect(result).toMatchObject({
      healthStatus: 'ok',
      accountsSeen: 1,
      settingsSeen: 1,
      positionsSeen: 1,
      runningCount: 1,
      quarantinedCount: 0,
    });

    const metrics = await db.select().from(schema.botMetricSnapshots).where(eq(schema.botMetricSnapshots.botProviderAccountId, mapping!.id));
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      botInstanceId: mapping!.botInstanceId,
      botProviderAccountId: mapping!.id,
      sourceAdapter: 'legacy-db',
    });
    expect(Number(metrics[0]!.walletEquityUsd)).toBe(3210.55);
    expect(metrics[0]!.rawJson).toMatchObject({
      providerAccountScoped: true,
      accountCount: 1,
      liveConfig: {
        providerAccounts: [expect.objectContaining({ pubId: 'USER_A_PROVIDER_PUB_ID', running: true })],
        symbolConfigs: [expect.objectContaining({ symbol: 'BTC-USDT', providerPubId: 'USER_A_PROVIDER_PUB_ID' })],
      },
    });

    const positions = await db.select().from(schema.botPositionSnapshots).where(eq(schema.botPositionSnapshots.botProviderAccountId, mapping!.id));
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      botInstanceId: mapping!.botInstanceId,
      botProviderAccountId: mapping!.id,
      sourceAdapter: 'legacy-db',
      symbol: 'BTC-USDT',
      side: 'long',
    });

    const serialized = JSON.stringify({ metrics, positions });
    expect(serialized).not.toMatch(/api_key|secret_key|authorization|access_token/i);
  });

  it('requires target-user ownership when disabling a provider-account mapping', async () => {
    const [mapping] = await listActiveBotProviderAccounts(db, { productCode: 'legacy_bot', provider: 'legacy-db' });
    expect(mapping).toBeTruthy();

    await expect(disableBotProviderAccountMapping(db, {
      id: mapping!.id,
      actorUserId: adminId,
      userId: otherUserId,
      reason: 'wrong user ownership probe',
    })).rejects.toThrow('provider_account_mapping_not_owned_by_user');

    await disableBotProviderAccountMapping(db, {
      id: mapping!.id,
      actorUserId: adminId,
      userId,
      reason: 'operator verified replacement mapping',
    });

    const activeMappings = await listActiveBotProviderAccounts(db, { productCode: 'legacy_bot', provider: 'legacy-db' });
    expect(activeMappings.some((row) => row.id === mapping!.id)).toBe(false);
    await expect(summarizeUserBotProviderMapping(db, {
      userId,
      productCode: 'legacy_bot',
      provider: 'legacy-db',
    })).resolves.toMatchObject({ activeCount: 0, status: 'missing_mapping' });
  });
});
