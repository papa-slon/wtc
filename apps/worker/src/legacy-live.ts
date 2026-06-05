import postgres from 'postgres';
import { CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF, isLegacySecretField } from '@wtc/bot-adapters';
import type { BotProviderAccountRow, Db } from '@wtc/db';

type WorkerEnv = Record<string, string | undefined>;
type LegacySql = ReturnType<typeof postgres>;

export interface LegacyLiveSnapshotResult {
  status: 'ok' | 'error' | 'skipped';
  lastError: string | null;
  healthStatus: 'ok' | 'error' | 'not_configured';
  readState: 'ok' | 'not_configured' | null;
  accountsSeen: number;
  settingsSeen: number;
  positionsSeen: number;
  providerAccountsScoped: number;
}

export interface LegacyLiveRowsSnapshotResult {
  healthStatus: 'ok' | 'error' | 'not_configured';
  readState: 'ok' | 'not_configured';
  accountsSeen: number;
  settingsSeen: number;
  stageConfigsSeen: number;
  positionsSeen: number;
  slotsSeen: number;
  runningCount: number;
  quarantinedCount: number;
  warningCodes: string[];
}

interface LegacyApiAccountRow {
  pub_id: string;
  market: string | null;
  running: boolean;
  balance: number | string | null;
  quarantined: boolean | null;
  quarantine_reason: string | null;
}

interface LegacySymbolSettingRow {
  api_id: string;
  symbol: string;
  active: boolean | null;
  timeframe: string | null;
  use_rsi: boolean | null;
  use_cci: boolean | null;
  rsi_length: number | null;
  rsi_threshold: number | string | null;
  cci_length: number | null;
  cci_threshold: number | string | null;
  take_profit_percent: number | string | null;
  initial_entry_percent: number | string | null;
  averaging_levels: number | null;
  averaging_percents: string | null;
  averaging_volume_percents: string | null;
  use_balance_percent: number | string | null;
  leverage: number | null;
  stage: number | null;
  use_delay_filter: boolean | null;
  delay_bars: number | null;
  use_delta_filter: boolean | null;
  delta_filter: number | string | null;
}

interface LegacyStageConfigRow {
  api_id: string;
  stage: number | null;
  rsi_slots: number | null;
  cci_slots: number | null;
}

interface LegacySlotRow {
  api_id: string;
  position: string;
  reason: string | null;
  stage: number | null;
  averaging_count: number | null;
  active: boolean | null;
  created_at: Date | string | null;
}

interface LegacyOrderRow {
  api_id: string;
  position: string;
  position_side: string | null;
  note: string | null;
  price: number | string | null;
  quantity: number | string | null;
  active: boolean | null;
}

interface LegacyLiveRows {
  accounts: LegacyApiAccountRow[];
  settings: LegacySymbolSettingRow[];
  stages: LegacyStageConfigRow[];
  slots: LegacySlotRow[];
  orders: LegacyOrderRow[];
}

function signalFromRow(row: Pick<LegacySymbolSettingRow, 'use_rsi' | 'use_cci'>): 'rsi' | 'cci' {
  return row.use_cci === true && row.use_rsi !== true ? 'cci' : 'rsi';
}

function flagEnabled(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function opMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/postgres:\/\/([^:\s]+):([^@\s]+)@/gi, 'postgres://$1:[REDACTED]@')
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .slice(0, 220);
}

function safeText(value: string | null | undefined, max = 160): string | null {
  if (!value) return null;
  return value
    .replace(/(password|secret|token|key)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .slice(0, max);
}

function n(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function int(value: unknown, fallback: number): number {
  const parsed = Math.trunc(n(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function dateOrNull(value: Date | string | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function assertNoSecretFields(rows: readonly Record<string, unknown>[], scope: string): void {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (isLegacySecretField(key)) {
        throw new Error(`legacy_${scope}_query_selected_secret_field:${key}`);
      }
    }
  }
}

async function legacyRelationExists(sql: LegacySql, tableName: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = ${tableName}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function resolveLegacyRelation(sql: LegacySql, candidates: readonly string[], label: string): Promise<string> {
  for (const candidate of candidates) {
    if (await legacyRelationExists(sql, candidate)) return candidate;
  }
  throw new Error(`legacy_relation_not_found:${label}`);
}

async function legacyColumnExists(sql: LegacySql, tableName: string, columnName: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = ${tableName} and column_name = ${columnName}
    ) as exists
  `;
  return rows[0]?.exists === true;
}

function normalizeTimeframe(value: string | null | undefined): '1m' | '3m' | '5m' | '15m' | '1h' {
  return value === '1m' || value === '3m' || value === '5m' || value === '15m' || value === '1h' ? value : '3m';
}

function normalizeSide(value: string | null | undefined): 'long' | 'short' {
  return String(value ?? '').toUpperCase() === 'SHORT' ? 'short' : 'long';
}

function activeSettings(settings: LegacySymbolSettingRow[]): LegacySymbolSettingRow[] {
  return settings.filter((row) => row.active !== false);
}

export function buildLegacyLiveConfig(rows: LegacyLiveRows): Record<string, unknown> {
  const settings = activeSettings(rows.settings);
  const first = settings[0];
  const firstAccount = rows.accounts[0];
  const stageConfigs = rows.stages
    .filter((row) => row.stage != null)
    .sort((a, b) => int(a.stage, 0) - int(b.stage, 0))
    .map((row) => ({
      providerPubId: row.api_id,
      stage: int(row.stage, 1),
      rsiSlots: Math.max(0, int(row.rsi_slots, 0)),
      cciSlots: Math.max(0, int(row.cci_slots, 0)),
    }));

  const symbolConfigs = settings.map((row) => ({
    providerPubId: row.api_id,
    symbol: row.symbol,
    active: row.active !== false,
    timeframe: normalizeTimeframe(row.timeframe),
    signal: signalFromRow(row),
    useRsi: signalFromRow(row) === 'rsi',
    useCci: signalFromRow(row) === 'cci',
    rsiLength: int(row.rsi_length, 14),
    rsiThreshold: n(row.rsi_threshold, 30),
    cciLength: int(row.cci_length, 20),
    cciThreshold: n(row.cci_threshold, -100),
    takeProfitPercent: n(row.take_profit_percent, 1),
    initialEntryPercent: n(row.initial_entry_percent, 5),
    averagingLevels: Math.max(1, int(row.averaging_levels, 3)),
    averagingPercents: row.averaging_percents ?? '2,4,6',
    averagingVolumePercents: row.averaging_volume_percents ?? '10,20,30',
    useBalancePercent: n(row.use_balance_percent, 100),
    leverage: Math.max(1, int(row.leverage, 1)),
    stage: Math.max(1, int(row.stage, 1)),
    useDelayFilter: row.use_delay_filter === true,
    delayBars: Math.max(1, int(row.delay_bars, 2)),
    useDeltaFilter: row.use_delta_filter === true,
    deltaFilter: n(row.delta_filter, 0),
  }));

  return {
    operationMode: 'auto',
    apiProfile: firstAccount ? `legacy-live-${String(firstAccount.market ?? 'market').toLowerCase()}` : 'legacy-live',
    providerAccounts: rows.accounts.map((row) => ({
      pubId: row.pub_id,
      market: row.market ?? 'BINGX',
      running: row.running,
      balance: n(row.balance),
      quarantined: row.quarantined === true,
      quarantineReason: safeText(row.quarantine_reason),
      symbols: settings.filter((setting) => setting.api_id === row.pub_id).length,
      activeSlots: rows.slots.filter((slot) => slot.api_id === row.pub_id && slot.active !== false).length,
      activeOrders: rows.orders.filter((order) => order.api_id === row.pub_id && order.active !== false).length,
    })),
    symbols: symbolConfigs.map((row) => row.symbol).join(', '),
    maxSymbols: Math.max(1, symbolConfigs.length),
    defaultTimeframe: normalizeTimeframe(first?.timeframe),
    defaultTakeProfitPercent: n(first?.take_profit_percent, 1),
    defaultInitialEntryPercent: n(first?.initial_entry_percent, 5),
    defaultUseBalancePercent: n(first?.use_balance_percent, 100),
    defaultLeverage: Math.max(1, int(first?.leverage, 1)),
    symbolConfigs,
    stageConfigs: stageConfigs.length > 0 ? stageConfigs : [{ stage: 1, rsiSlots: 0, cciSlots: 0 }],
    activeSlots: rows.slots
      .filter((slot) => slot.active !== false)
      .map((slot) => ({
        providerPubId: slot.api_id,
        symbol: slot.position,
        signal: String(slot.reason ?? '').toUpperCase() === 'RED' ? 'cci' : 'rsi',
        stage: Math.max(1, int(slot.stage, 1)),
        averagingCount: Math.max(0, int(slot.averaging_count, 0)),
        openedAt: dateOrNull(slot.created_at)?.getTime() ?? null,
      })),
    activeOrderSummary: rows.orders
      .filter((order) => order.active !== false)
      .map((order) => ({
        providerPubId: order.api_id,
        symbol: order.position,
        note: String(order.note ?? '').toUpperCase() || 'UNKNOWN',
        qty: n(order.quantity),
        price: n(order.price),
      })),
  };
}

export function buildLegacyLivePositions(rows: LegacyLiveRows) {
  return rows.slots
    .filter((slot) => slot.active !== false)
    .map((slot) => {
      const related = rows.orders.filter((order) => order.active !== false && order.api_id === slot.api_id && order.position === slot.position);
      const entryOrders = related.filter((order) => {
        const note = String(order.note ?? '').toUpperCase();
        return note === 'BUY' || note === 'AVERAGING';
      });
      const totalQty = entryOrders.reduce((sum, order) => sum + n(order.quantity), 0);
      const notional = entryOrders.reduce((sum, order) => sum + n(order.quantity) * n(order.price), 0);
      const avgEntry = totalQty > 0 ? notional / totalQty : 0;
      const tpOrder = related.find((order) => String(order.note ?? '').toUpperCase() === 'TAKE_PROFIT');
      const slOrder = related.find((order) => String(order.note ?? '').toUpperCase() === 'STOP_LOSS');
      const side = normalizeSide(entryOrders[0]?.position_side ?? related[0]?.position_side);
      return {
        providerPubId: slot.api_id,
        signal: String(slot.reason ?? '').toUpperCase() === 'RED' ? 'cci' : 'rsi',
        symbol: slot.position,
        side,
        qty: totalQty,
        entryPrice: avgEntry,
        markPrice: avgEntry,
        unrealizedPnl: 0,
        tpPrice: tpOrder ? n(tpOrder.price) : null,
        stopPrice: slOrder ? n(slOrder.price) : null,
        hasTp: !!tpOrder,
        openedAt: dateOrNull(slot.created_at)?.getTime() ?? null,
        units: Math.max(1, int(slot.averaging_count, 0) + 1),
        stage: Math.max(1, int(slot.stage, 1)),
      };
    });
}

export function buildLegacyLiveWarnings(rows: LegacyLiveRows): string[] {
  const warnings = ['no_trade_history'];
  if (rows.accounts.some((row) => row.quarantined === true)) warnings.push('legacy_quarantined');
  return warnings;
}

async function readLegacyRows(databaseUrl: string, apiId?: string): Promise<LegacyLiveRows> {
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 5,
    prepare: false,
  });
  try {
    const symbolSettingsTable = await resolveLegacyRelation(sql, ['symbolsettingss', 'symbolsettings'], 'symbol_settings');
    const hasDelayFilter = await legacyColumnExists(sql, symbolSettingsTable, 'use_delay_filter');
    const hasDelayBars = await legacyColumnExists(sql, symbolSettingsTable, 'delay_bars');
    const hasDeltaFilterFlag = await legacyColumnExists(sql, symbolSettingsTable, 'use_delta_filter');
    const hasDeltaFilterValue = await legacyColumnExists(sql, symbolSettingsTable, 'delta_filter');

    const accounts = apiId
      ? await sql<LegacyApiAccountRow[]>`
          select pub_id, market::text as market, running, balance, quarantined, quarantine_reason
          from api_keys
          where pub_id = ${apiId}
          order by id
        `
      : await sql<LegacyApiAccountRow[]>`
          select pub_id, market::text as market, running, balance, quarantined, quarantine_reason
          from api_keys
          where running = true
          order by id
          limit 20
        `;
    assertNoSecretFields(accounts as unknown as Record<string, unknown>[], 'accounts');
    const apiIds = accounts.map((row) => row.pub_id);
    if (apiIds.length === 0) return { accounts, settings: [], stages: [], slots: [], orders: [] };

    const settings = await sql<LegacySymbolSettingRow[]>`
      select api_id, symbol, active, timeframe, use_rsi, use_cci, rsi_length, rsi_threshold,
             cci_length, cci_threshold, take_profit_percent, initial_entry_percent,
             averaging_levels, averaging_percents, averaging_volume_percents,
             use_balance_percent, leverage, stage,
             ${hasDelayFilter ? sql`use_delay_filter` : sql`false`} as use_delay_filter,
             ${hasDelayBars ? sql`delay_bars` : sql`1`} as delay_bars,
             ${hasDeltaFilterFlag ? sql`use_delta_filter` : sql`false`} as use_delta_filter,
             ${hasDeltaFilterValue ? sql`delta_filter` : sql`0`} as delta_filter
      from ${sql(symbolSettingsTable)}
      where api_id in ${sql(apiIds)}
      order by api_id, symbol
    `;
    const stages = await sql<LegacyStageConfigRow[]>`
      select api_id, stage, rsi_slots, cci_slots
      from stageconfigs
      where api_id in ${sql(apiIds)}
      order by api_id, stage
    `;
    const slots = await sql<LegacySlotRow[]>`
      select api_id, position, reason::text as reason, stage, averaging_count, active, created_at
      from slots
      where api_id in ${sql(apiIds)} and active = true
      order by api_id, stage, position
    `;
    const orders = await sql<LegacyOrderRow[]>`
      select api_id, position, position_side::text as position_side, note::text as note, price, quantity, active
      from orders
      where api_id in ${sql(apiIds)} and active = true
      order by api_id, position, id
    `;

    assertNoSecretFields(settings as unknown as Record<string, unknown>[], 'settings');
    assertNoSecretFields(stages as unknown as Record<string, unknown>[], 'stages');
    assertNoSecretFields(slots as unknown as Record<string, unknown>[], 'slots');
    assertNoSecretFields(orders as unknown as Record<string, unknown>[], 'orders');
    return { accounts, settings, stages, slots, orders };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function snapshotLegacyRowsToWtc(
  db: Db,
  input: {
    botInstanceId: string;
    botProviderAccountId?: string | null;
    rows: LegacyLiveRows;
    now: number;
    adapterMode: string;
  },
): Promise<LegacyLiveRowsSnapshotResult> {
  const { insertBotMetricSnapshot, insertBotPositionSnapshot } = await import('@wtc/db');
  const rows = input.rows;
  const config = buildLegacyLiveConfig(rows);
  const positions = buildLegacyLivePositions(rows);
  const warningCodes = buildLegacyLiveWarnings(rows);
  const walletEquity = rows.accounts.reduce((sum, row) => sum + n(row.balance), 0);
  const runningCount = rows.accounts.filter((row) => row.running).length;
  const quarantinedCount = rows.accounts.filter((row) => row.quarantined === true).length;
  const healthStatus = rows.accounts.length === 0 ? 'not_configured' : quarantinedCount > 0 ? 'error' : 'ok';
  const readState = rows.accounts.length === 0 ? 'not_configured' : 'ok';
  const snapshotAt = new Date(input.now);
  const providerAccountScoped = !!input.botProviderAccountId;

  await insertBotMetricSnapshot(db, {
    botInstanceId: input.botInstanceId,
    botProviderAccountId: input.botProviderAccountId ?? null,
    snapshotAt,
    sourceAdapter: 'legacy-db',
    walletEquityUsd: String(walletEquity),
    closedPnlUsd: undefined,
    unrealizedPnlUsd: undefined,
    winRate: undefined,
    profitFactor: undefined,
    maxDrawdownPct: undefined,
    currentDrawdownPct: undefined,
    totalFeesUsd: undefined,
    totalFundingUsd: undefined,
    openRiskUsd: undefined,
    tradeCount: 0,
    rawJson: {
      adapterMode: input.adapterMode,
      sourceAdapter: 'legacy-db',
      providerAccountScoped,
      healthStatus: healthStatus === 'ok' ? 'healthy' : healthStatus === 'error' ? 'degraded' : 'down',
      readState,
      processAlive: rows.accounts.length > 0 && runningCount > 0,
      accountCount: rows.accounts.length,
      runningCount,
      quarantinedCount,
      settingsSeen: rows.settings.length,
      stageConfigsSeen: rows.stages.length,
      slotsSeen: rows.slots.length,
      warningCodes,
      closedTradeSourceProof: {
        status: CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.status,
        canImportClosedTrades: CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.canImportClosedTrades,
        missingRequirements: CURRENT_LEGACY_CLOSED_TRADE_SOURCE_PROOF.missingRequirements,
      },
      liveConfig: config,
    },
  });

  await insertBotPositionSnapshot(db, {
    botInstanceId: input.botInstanceId,
    botProviderAccountId: input.botProviderAccountId ?? null,
    snapshotAt,
    sourceAdapter: 'legacy-db',
    positions: positions.map((p) => ({
      symbol: p.symbol,
      side: p.side,
      size: String(p.qty),
      entryPrice: String(p.entryPrice),
      markPrice: String(p.markPrice),
      unrealizedPnlUsd: '0',
      ...(p.tpPrice != null ? { tpPrice: String(p.tpPrice) } : {}),
      ...(p.stopPrice != null ? { slPrice: String(p.stopPrice) } : {}),
      ...(p.openedAt ? { openedAt: new Date(p.openedAt) } : {}),
    })),
  });

  return {
    healthStatus,
    readState,
    accountsSeen: rows.accounts.length,
    settingsSeen: rows.settings.length,
    stageConfigsSeen: rows.stages.length,
    positionsSeen: positions.length,
    slotsSeen: rows.slots.length,
    runningCount,
    quarantinedCount,
    warningCodes,
  };
}

function mappedAccountErrorDetail(mapping: Pick<BotProviderAccountRow, 'id' | 'botInstanceId'>, err: unknown): Record<string, unknown> {
  return {
    botProviderAccountId: mapping.id,
    botInstanceId: mapping.botInstanceId,
    error: opMessage(err),
  };
}

export async function snapshotLegacyBotPostgres(db: Db, now = Date.now(), env: WorkerEnv = process.env): Promise<LegacyLiveSnapshotResult> {
  const { ensureBotInstance, listActiveBotProviderAccounts, recordHealthCheck } = await import('@wtc/db');
  const enabled = flagEnabled(env.LEGACY_LIVE_READS_ENABLED);
  const databaseUrl = env.LEGACY_DATABASE_URL;
  const instanceId = env.SYSTEM_LEGACY_BOT_INSTANCE_ID;
  const ownerId = env.SYSTEM_LEGACY_BOT_OWNER_ID ?? env.SYSTEM_BOT_OWNER_ID;
  const adapterMode = env.BOT_ADAPTER_MODE ?? 'mock';

  if (!enabled) {
    await recordHealthCheck(db, 'legacy-bot', 'not_configured', {
      readState: 'not_configured',
      readStateDetail: 'set LEGACY_LIVE_READS_ENABLED=true to enable DB-backed legacy live reads',
      adapterMode,
      liveControlDisabled: true,
    });
    return {
      status: 'skipped',
      lastError: null,
      healthStatus: 'not_configured',
      readState: 'not_configured',
      accountsSeen: 0,
      settingsSeen: 0,
      positionsSeen: 0,
      providerAccountsScoped: 0,
    };
  }
  if (!databaseUrl) {
    await recordHealthCheck(db, 'legacy-bot', 'not_configured', {
      readState: 'not_configured',
      readStateDetail: 'set LEGACY_DATABASE_URL for DB-backed legacy live reads',
      adapterMode,
      liveControlDisabled: true,
    });
    return {
      status: 'skipped',
      lastError: null,
      healthStatus: 'not_configured',
      readState: 'not_configured',
      accountsSeen: 0,
      settingsSeen: 0,
      positionsSeen: 0,
      providerAccountsScoped: 0,
    };
  }

  try {
    const providerAccounts = await listActiveBotProviderAccounts(db, {
      productCode: 'legacy_bot',
      provider: 'legacy-db',
      limit: 100,
    });

    if (providerAccounts.length > 0) {
      let accountsSeen = 0;
      let settingsSeen = 0;
      let positionsSeen = 0;
      let runningCount = 0;
      let quarantinedCount = 0;
      let errors = 0;
      let lastError: string | null = null;
      const warningCodes = new Set<string>();

      for (const providerAccount of providerAccounts) {
        try {
          const rows = await readLegacyRows(databaseUrl, providerAccount.providerAccountId);
          const snap = await snapshotLegacyRowsToWtc(db, {
            botInstanceId: providerAccount.botInstanceId,
            botProviderAccountId: providerAccount.id,
            rows,
            now,
            adapterMode,
          });
          accountsSeen += snap.accountsSeen;
          settingsSeen += snap.settingsSeen;
          positionsSeen += snap.positionsSeen;
          runningCount += snap.runningCount;
          quarantinedCount += snap.quarantinedCount;
          for (const code of snap.warningCodes) warningCodes.add(code);
        } catch (err) {
          errors += 1;
          lastError = opMessage(err);
          console.warn(`[worker:legacy-snapshot] provider account scoped read failed: ${lastError}`);
          await recordHealthCheck(db, 'legacy-bot-provider-account', 'error', {
            ...mappedAccountErrorDetail(providerAccount, err),
            adapterMode,
            sourceAdapter: 'legacy-db',
            liveControlDisabled: true,
          });
        }
      }

      const healthStatus = errors > 0 || quarantinedCount > 0 ? 'error' : accountsSeen === 0 ? 'not_configured' : 'ok';
      const readState = accountsSeen === 0 ? 'not_configured' : 'ok';
      await recordHealthCheck(db, 'legacy-bot', healthStatus, {
        status: healthStatus === 'ok' ? 'healthy' : healthStatus === 'error' ? 'degraded' : 'down',
        readState,
        readStateDetail:
          accountsSeen === 0
            ? 'Legacy DB scoped reads succeeded but no mapped provider accounts were found in the provider DB'
            : 'Legacy DB live-read snapshots stored by WTC provider-account mapping',
        processAlive: accountsSeen > 0 && runningCount > 0,
        adapterMode,
        sourceAdapter: 'legacy-db',
        liveControlDisabled: true,
        providerAccountMappingsSeen: providerAccounts.length,
        providerAccountMappingsSnapshotted: providerAccounts.length - errors,
        providerAccountMappingErrors: errors,
        accountsSeen,
        settingsSeen,
        positionsSnapshotted: positionsSeen,
        quarantinedCount,
        warningCodes: Array.from(warningCodes),
      });

      return {
        status: errors > 0 ? 'error' : 'ok',
        lastError,
        healthStatus,
        readState,
        accountsSeen,
        settingsSeen,
        positionsSeen,
        providerAccountsScoped: providerAccounts.length - errors,
      };
    }

    if (!instanceId && !ownerId) {
      await recordHealthCheck(db, 'legacy-bot', 'not_configured', {
        readState: 'not_configured',
        readStateDetail:
          'Create active bot_provider_accounts rows or set SYSTEM_LEGACY_BOT_INSTANCE_ID/SYSTEM_LEGACY_BOT_OWNER_ID for fleet diagnostics',
        adapterMode,
        liveControlDisabled: true,
      });
      return {
        status: 'skipped',
        lastError: null,
        healthStatus: 'not_configured',
        readState: 'not_configured',
        accountsSeen: 0,
        settingsSeen: 0,
        positionsSeen: 0,
        providerAccountsScoped: 0,
      };
    }

    const botInstanceId = instanceId ?? (await ensureBotInstance(db, { userId: ownerId!, productCode: 'legacy_bot' })).id;
    const rows = await readLegacyRows(databaseUrl, env.LEGACY_API_ID);
    const snap = await snapshotLegacyRowsToWtc(db, {
      botInstanceId,
      rows,
      now,
      adapterMode,
    });

    await recordHealthCheck(db, 'legacy-bot', snap.healthStatus, {
      status: snap.healthStatus === 'ok' ? 'healthy' : snap.healthStatus === 'error' ? 'degraded' : 'down',
      readState: snap.readState,
      readStateDetail:
        rows.accounts.length === 0
          ? 'Legacy DB read succeeded but no running API accounts were found'
          : 'Legacy DB fleet diagnostic snapshot stored in WTC Postgres',
      processAlive: rows.accounts.length > 0 && snap.runningCount > 0,
      adapterMode,
      sourceAdapter: 'legacy-db',
      liveControlDisabled: true,
      providerAccountMappingsSeen: 0,
      providerAccountMappingsSnapshotted: 0,
      accountsSeen: snap.accountsSeen,
      settingsSeen: snap.settingsSeen,
      positionsSnapshotted: snap.positionsSeen,
      quarantinedCount: snap.quarantinedCount,
      warningCodes: snap.warningCodes,
    });

    return {
      status: 'ok',
      lastError: null,
      healthStatus: snap.healthStatus,
      readState: snap.readState,
      accountsSeen: snap.accountsSeen,
      settingsSeen: snap.settingsSeen,
      positionsSeen: snap.positionsSeen,
      providerAccountsScoped: 0,
    };
  } catch (err) {
    const error = opMessage(err);
    await recordHealthCheck(db, 'legacy-bot', 'error', {
      error,
      adapterMode,
      sourceAdapter: 'legacy-db',
      liveControlDisabled: true,
    });
    return {
      status: 'error',
      lastError: error,
      healthStatus: 'error',
      readState: null,
      accountsSeen: 0,
      settingsSeen: 0,
      positionsSeen: 0,
      providerAccountsScoped: 0,
    };
  }
}
