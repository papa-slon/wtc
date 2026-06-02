import 'server-only';
import { z } from 'zod';
import { getServerDb } from '@/lib/backend';
import {
  ensureBotInstance,
  saveBotConfig,
  getCurrentBotConfig,
  listBotConfigVersions,
  listBotInstancesForUser,
  listBotSafetyEvents,
} from '@wtc/db';
import type { BotProductCode } from '@/features/bots/meta';

const operationMode = z.enum(['manual', 'auto']).default('manual');

export const TORTILA_SYMBOL_ROW_LIMIT = 8;

export const tortilaSymbolConfigSchema = z.object({
  symbol: z.string().trim().min(1).max(40),
  timeframe: z.enum(['1h', '4h']).default('4h'),
  system: z.coerce.number().int().min(1).max(2),
  riskPercent: z.coerce.number().min(0.1).max(3),
  stopN: z.coerce.number().min(1).max(4),
  addStep: z.coerce.number().min(0.25).max(2),
  maxUnits: z.coerce.number().int().min(1).max(4),
  atrPeriod: z.coerce.number().int().min(10).max(30),
  takeProfitRr: z.coerce.number().min(0).max(50),
});

export type TortilaSymbolConfig = z.infer<typeof tortilaSymbolConfigSchema>;

export const tortilaBotConfigSchema = z.object({
  operationMode,
  symbols: z.string().trim().min(1).max(300),
  symbolConfigs: z.array(tortilaSymbolConfigSchema).min(1).max(20),
  timeframe: z.enum(['1h', '4h']).default('4h'),
  system: z.coerce.number().int().min(1).max(2),
  riskPercent: z.coerce.number().min(0.1).max(3),
  stopN: z.coerce.number().min(1).max(4),
  addStep: z.coerce.number().min(0.25).max(2),
  maxUnits: z.coerce.number().int().min(1).max(4),
  atrPeriod: z.coerce.number().int().min(10).max(30),
  leverage: z.coerce.number().int().min(1).max(10),
  takeProfitRr: z.coerce.number().min(0).max(50),
  maxOpenSymbols: z.coerce.number().int().min(1).max(20),
  maxTotalUnits: z.coerce.number().int().min(1).max(50),
  maxUnitsPerDirection: z.coerce.number().int().min(1).max(30),
  haltDrawdownPercent: z.coerce.number().min(1).max(95),
  dailyMaxLossPercent: z.coerce.number().min(0.5).max(50),
  maxNewEntriesPerTick: z.coerce.number().int().min(1).max(20),
});

export const legacyBotConfigSchema = z.object({
  operationMode,
  symbols: z.string().trim().min(1).max(300),
  rsiLength: z.coerce.number().int().min(2).max(100),
  rsiOversold: z.coerce.number().min(1).max(50),
  cciLength: z.coerce.number().int().min(2).max(100),
  cciThreshold: z.coerce.number().min(10).max(300),
  takeProfitPercent: z.coerce.number().min(0.1).max(20),
  initialEntryPercent: z.coerce.number().min(0.1).max(50),
  averagingLevels: z.coerce.number().int().min(1).max(8),
  maxSlots: z.coerce.number().int().min(1).max(20),
  leverage: z.coerce.number().int().min(1).max(20),
});

export const botConfigSchema = tortilaBotConfigSchema.or(legacyBotConfigSchema);
export type BotConfigInput = z.infer<typeof botConfigSchema>;

export interface BotConfigField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  step?: string;
  placeholder: string;
  hint: string;
  options?: readonly { value: string; label: string }[];
}

export interface BotConfigPreset {
  id: string;
  name: string;
  mode: 'manual' | 'auto';
  description: string;
  summary: readonly string[];
  config: Record<string, unknown>;
}

export const BOT_OPERATION_MODES = [
  {
    value: 'manual',
    label: 'Manual review mode',
    hint: 'WTC records this bot as operator-reviewed before action. This is metadata only.',
  },
  {
    value: 'auto',
    label: 'Automatic reference mode',
    hint: 'WTC records the bot as intended for automated strategy operation. It still does not send commands to the live bot.',
  },
] as const;

const TORTILA_FIELDS: readonly BotConfigField[] = [
  { name: 'symbols', label: 'Symbols summary', type: 'text', placeholder: 'XRP/USDT:USDT, TRX/USDT:USDT', hint: 'Auto-filled from the per-coin table below; kept for compatibility.' },
  { name: 'timeframe', label: 'Timeframe', type: 'select', placeholder: '4h', hint: 'Closed-candle strategy timeframe.', options: [{ value: '4h', label: '4h' }, { value: '1h', label: '1h' }] },
  { name: 'system', label: 'Turtle system', type: 'select', placeholder: '2', hint: 'System 1 = 20/10, System 2 = 55/20.', options: [{ value: '2', label: 'System 2 (55/20)' }, { value: '1', label: 'System 1 (20/10)' }] },
  { name: 'riskPercent', label: 'Risk per trade (%)', type: 'number', step: '0.1', placeholder: '0.3', hint: '0.1-3% WTC-side reference risk.' },
  { name: 'stopN', label: 'ATR stop N', type: 'number', step: '0.5', placeholder: '2.0', hint: 'Stop distance in ATR multiples.' },
  { name: 'addStep', label: 'Add step N', type: 'number', step: '0.25', placeholder: '0.5', hint: 'Pyramid add distance in ATR multiples.' },
  { name: 'maxUnits', label: 'Max units', type: 'number', step: '1', placeholder: '4', hint: 'Turtle pyramid cap.' },
  { name: 'atrPeriod', label: 'ATR period', type: 'number', step: '1', placeholder: '20', hint: 'Wilder ATR lookback.' },
  { name: 'leverage', label: 'Leverage', type: 'number', step: '1', placeholder: '3', hint: 'Reference leverage; live exchange apply is disabled.' },
  { name: 'takeProfitRr', label: 'Take-profit R', type: 'number', step: '1', placeholder: '0', hint: '0 = no fixed TP; values are WTC-side reference only.' },
  { name: 'maxOpenSymbols', label: 'Max open symbols', type: 'number', step: '1', placeholder: '5', hint: 'Portfolio cap equivalent to MAX_OPEN_SYMBOLS.' },
  { name: 'maxTotalUnits', label: 'Max total units', type: 'number', step: '1', placeholder: '12', hint: 'Portfolio cap across all symbols.' },
  { name: 'maxUnitsPerDirection', label: 'Max units per direction', type: 'number', step: '1', placeholder: '8', hint: 'Directional exposure cap.' },
  { name: 'haltDrawdownPercent', label: 'Halt drawdown (%)', type: 'number', step: '1', placeholder: '35', hint: 'Portfolio drawdown halt reference.' },
  { name: 'dailyMaxLossPercent', label: 'Daily max loss (%)', type: 'number', step: '0.5', placeholder: '6', hint: 'Daily risk halt reference.' },
  { name: 'maxNewEntriesPerTick', label: 'Max new entries per tick', type: 'number', step: '1', placeholder: '2', hint: 'Throttle for fresh entries per scheduler tick.' },
];

const LEGACY_FIELDS: readonly BotConfigField[] = [
  { name: 'symbols', label: 'Symbols', type: 'text', placeholder: 'BTCUSDT, XRPUSDT', hint: 'Comma-separated legacy bot symbols.' },
  { name: 'rsiLength', label: 'RSI length', type: 'number', step: '1', placeholder: '14', hint: 'RSI lookback.' },
  { name: 'rsiOversold', label: 'RSI oversold', type: 'number', step: '1', placeholder: '30', hint: 'Entry threshold.' },
  { name: 'cciLength', label: 'CCI length', type: 'number', step: '1', placeholder: '20', hint: 'CCI lookback.' },
  { name: 'cciThreshold', label: 'CCI threshold', type: 'number', step: '1', placeholder: '100', hint: 'CCI signal threshold.' },
  { name: 'takeProfitPercent', label: 'Take-profit (%)', type: 'number', step: '0.1', placeholder: '1.2', hint: 'Legacy TP target.' },
  { name: 'initialEntryPercent', label: 'Initial entry (%)', type: 'number', step: '0.1', placeholder: '2.0', hint: 'Initial allocation reference.' },
  { name: 'averagingLevels', label: 'Averaging levels', type: 'number', step: '1', placeholder: '3', hint: 'DCA averaging ladder depth.' },
  { name: 'maxSlots', label: 'Max slots', type: 'number', step: '1', placeholder: '5', hint: 'Maximum concurrent symbol slots.' },
  { name: 'leverage', label: 'Leverage', type: 'number', step: '1', placeholder: '5', hint: 'Reference leverage; live adapter is blocked.' },
];

const TORTILA_DEFAULTS: Record<string, string> = {
  operationMode: 'manual',
  symbols: 'XRP/USDT:USDT, TRX/USDT:USDT, NEAR/USDT:USDT, HBAR/USDT:USDT, LINK/USDT:USDT',
  timeframe: '4h',
  system: '2',
  riskPercent: '0.3',
  stopN: '2.0',
  addStep: '0.5',
  maxUnits: '4',
  atrPeriod: '20',
  leverage: '3',
  takeProfitRr: '0',
  maxOpenSymbols: '5',
  maxTotalUnits: '12',
  maxUnitsPerDirection: '8',
  haltDrawdownPercent: '35',
  dailyMaxLossPercent: '6',
  maxNewEntriesPerTick: '2',
};

const TORTILA_SYMBOL_DEFAULTS: readonly TortilaSymbolConfig[] = [
  { symbol: 'XRP/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, stopN: 2, addStep: 1, maxUnits: 4, atrPeriod: 20, takeProfitRr: 0 },
  { symbol: 'TRX/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.5, stopN: 3, addStep: 1, maxUnits: 4, atrPeriod: 20, takeProfitRr: 13 },
  { symbol: 'NEAR/USDT:USDT', timeframe: '4h', system: 1, riskPercent: 0.3, stopN: 3, addStep: 1, maxUnits: 4, atrPeriod: 20, takeProfitRr: 5 },
  { symbol: 'HBAR/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, stopN: 2, addStep: 0.5, maxUnits: 4, atrPeriod: 20, takeProfitRr: 13 },
  { symbol: 'LINK/USDT:USDT', timeframe: '4h', system: 1, riskPercent: 0.3, stopN: 2, addStep: 1, maxUnits: 4, atrPeriod: 20, takeProfitRr: 0 },
];

const LEGACY_DEFAULTS: Record<string, string> = {
  operationMode: 'manual',
  symbols: 'BTCUSDT, XRPUSDT, ADAUSDT',
  rsiLength: '14',
  rsiOversold: '30',
  cciLength: '20',
  cciThreshold: '100',
  takeProfitPercent: '1.2',
  initialEntryPercent: '2.0',
  averagingLevels: '3',
  maxSlots: '5',
  leverage: '5',
};

const TORTILA_PRESETS: readonly BotConfigPreset[] = [
  {
    id: 'tortila-reference-heroes',
    name: 'Reference heroes 4h',
    mode: 'auto',
    description: 'Default WTC reference profile for the current Tortila hero basket. Saved as automation intent, not pushed to a live bot.',
    summary: ['Per-coin settings', 'XRP/TRX/NEAR/HBAR/LINK', 'TP where explicitly tested', 'Exports SYMBOL_CONFIGS'],
    config: { ...TORTILA_DEFAULTS, operationMode: 'auto', symbols: TORTILA_SYMBOL_DEFAULTS.map((r) => r.symbol).join(', '), symbolConfigs: TORTILA_SYMBOL_DEFAULTS },
  },
  {
    id: 'tortila-low-drawdown',
    name: 'Low-drawdown review',
    mode: 'manual',
    description: 'Lower-risk review profile for users who want to inspect every change before live operations are ever enabled.',
    summary: ['4h System 1', '0.2% risk', 'wider stop', 'manual review mode'],
    config: {
      ...TORTILA_DEFAULTS,
      operationMode: 'manual',
      system: '1',
      riskPercent: '0.2',
      stopN: '3.0',
      takeProfitRr: '0',
      symbols: TORTILA_SYMBOL_DEFAULTS.map((r) => r.symbol).join(', '),
      symbolConfigs: TORTILA_SYMBOL_DEFAULTS.map((r) => ({ ...r, system: 1, riskPercent: 0.2, stopN: 3, takeProfitRr: 0 })),
    },
  },
  {
    id: 'tortila-tp-reference',
    name: 'TP reference research',
    mode: 'manual',
    description: 'Research profile for users testing take-profit R settings locally before copying decisions into WTC.',
    summary: ['4h System 2', '0.3% risk', 'TP 13R reference', 'verify in local runner first'],
    config: {
      ...TORTILA_DEFAULTS,
      operationMode: 'manual',
      takeProfitRr: '13',
      symbols: TORTILA_SYMBOL_DEFAULTS.map((r) => r.symbol).join(', '),
      symbolConfigs: TORTILA_SYMBOL_DEFAULTS.map((r) => ({ ...r, takeProfitRr: r.takeProfitRr || 13 })),
    },
  },
];

const LEGACY_PRESETS: readonly BotConfigPreset[] = [
  {
    id: 'legacy-balanced-reference',
    name: 'Balanced RSI/CCI',
    mode: 'manual',
    description: 'Reference profile for the legacy averaging strategy. Live adapter remains blocked, so this is WTC-side configuration only.',
    summary: ['RSI 14 / CCI 20', 'TP 1.2%', '3 averaging levels', 'manual mode'],
    config: { ...LEGACY_DEFAULTS, operationMode: 'manual' },
  },
  {
    id: 'legacy-conservative',
    name: 'Conservative averaging',
    mode: 'manual',
    description: 'Smaller initial allocation and fewer slots for users who want a safer reference configuration.',
    summary: ['Initial 1%', 'TP 0.8%', '2 averaging levels', '3 slots'],
    config: { ...LEGACY_DEFAULTS, operationMode: 'manual', takeProfitPercent: '0.8', initialEntryPercent: '1.0', averagingLevels: '2', maxSlots: '3', leverage: '3' },
  },
  {
    id: 'legacy-auto-reference',
    name: 'Automatic intent reference',
    mode: 'auto',
    description: 'Stores the user intent for automated legacy operation once the B3 upstream key leak is fixed and reviewed.',
    summary: ['Auto intent only', 'RSI/CCI baseline', '5 slots', 'blocked from live connection today'],
    config: { ...LEGACY_DEFAULTS, operationMode: 'auto' },
  },
];

export function botConfigSchemaFor(productCode: BotProductCode): typeof tortilaBotConfigSchema | typeof legacyBotConfigSchema {
  return productCode === 'legacy_bot' ? legacyBotConfigSchema : tortilaBotConfigSchema;
}

export function botConfigFieldsFor(productCode: BotProductCode): readonly BotConfigField[] {
  return productCode === 'legacy_bot' ? LEGACY_FIELDS : TORTILA_FIELDS;
}

export function botConfigDefaultsFor(productCode: BotProductCode): Record<string, string> {
  return productCode === 'legacy_bot' ? LEGACY_DEFAULTS : TORTILA_DEFAULTS;
}

export function botConfigPresetsFor(productCode: BotProductCode): readonly BotConfigPreset[] {
  return productCode === 'legacy_bot' ? LEGACY_PRESETS : TORTILA_PRESETS;
}

export function botConfigPresetFor(productCode: BotProductCode, presetId: string): BotConfigPreset | undefined {
  return botConfigPresetsFor(productCode).find((p) => p.id === presetId);
}

export function botConfigFormInput(productCode: BotProductCode, formData: FormData): Record<string, unknown> {
  const fields = ['operationMode', ...botConfigFieldsFor(productCode).map((f) => f.name)];
  const base = Object.fromEntries(fields.map((name) => [name, formData.get(name)]));
  if (productCode !== 'tortila_bot') return base;
  const symbolConfigs = tortilaSymbolConfigsFromForm(formData);
  return {
    ...base,
    symbols: symbolConfigs.map((r) => r.symbol).join(', '),
    symbolConfigs,
  };
}

function trimNumber(n: number, decimals = 8): string {
  return n.toFixed(decimals).replace(/\.?0+$/, '');
}

function toRuntimeRiskFraction(riskPercent: number): string {
  return trimNumber(riskPercent / 100, 6);
}

export function serializeTortilaSymbolConfig(row: TortilaSymbolConfig): string {
  return [
    row.symbol,
    row.timeframe,
    String(row.system),
    toRuntimeRiskFraction(row.riskPercent),
    trimNumber(row.stopN, 3),
    trimNumber(row.addStep, 3),
    String(row.maxUnits),
    String(row.atrPeriod),
    trimNumber(row.takeProfitRr, 3),
  ].join('@');
}

export function serializeTortilaSymbolConfigs(rows: readonly TortilaSymbolConfig[]): string {
  return rows.map(serializeTortilaSymbolConfig).join(';');
}

function tortilaSymbolConfigsFromForm(formData: FormData): TortilaSymbolConfig[] {
  const rows: TortilaSymbolConfig[] = [];
  for (let i = 0; i < TORTILA_SYMBOL_ROW_LIMIT; i += 1) {
    const symbol = String(formData.get(`symbol_${i}`) ?? '').trim();
    if (!symbol) continue;
    const parsed = tortilaSymbolConfigSchema.safeParse({
      symbol,
      timeframe: formData.get(`tf_${i}`),
      system: formData.get(`system_${i}`),
      riskPercent: formData.get(`risk_${i}`),
      stopN: formData.get(`stop_${i}`),
      addStep: formData.get(`add_${i}`),
      maxUnits: formData.get(`maxUnits_${i}`),
      atrPeriod: formData.get(`atr_${i}`),
      takeProfitRr: formData.get(`tp_${i}`),
    });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows.length > 0 ? rows : [...TORTILA_SYMBOL_DEFAULTS];
}

export function tortilaSymbolConfigsFromConfig(config: Record<string, unknown> | null | undefined): TortilaSymbolConfig[] {
  const parsed = z.array(tortilaSymbolConfigSchema).safeParse(config?.symbolConfigs);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  const symbols = typeof config?.symbols === 'string' ? config.symbols.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (symbols.length > 0) {
    return symbols.slice(0, TORTILA_SYMBOL_ROW_LIMIT).map((symbol) => ({ ...TORTILA_SYMBOL_DEFAULTS[0]!, symbol }));
  }
  return [...TORTILA_SYMBOL_DEFAULTS];
}

function valueFromConfig(config: Record<string, unknown> | null | undefined, defaults: Record<string, string>, key: string): string {
  const v = config?.[key];
  return v === null || v === undefined || v === '' ? defaults[key] ?? '' : String(v);
}

export function exportBotConfig(productCode: BotProductCode, config: Record<string, unknown> | null | undefined): { filename: string; contentType: string; body: string } {
  if (productCode === 'tortila_bot') {
    const defaults = botConfigDefaultsFor(productCode);
    const rows = tortilaSymbolConfigsFromConfig(config);
    const lines = [
      '# WTC Tortila Bot reference export',
      '# Safe config only: no exchange keys, no secrets, no live-apply token.',
      `OPERATION_MODE=${valueFromConfig(config, defaults, 'operationMode')}`,
      `SYMBOL_CONFIGS=${serializeTortilaSymbolConfigs(rows)}`,
      `MAX_OPEN_SYMBOLS=${valueFromConfig(config, defaults, 'maxOpenSymbols')}`,
      `MAX_TOTAL_UNITS=${valueFromConfig(config, defaults, 'maxTotalUnits')}`,
      `MAX_UNITS_PER_DIRECTION=${valueFromConfig(config, defaults, 'maxUnitsPerDirection')}`,
      `HALT_DRAWDOWN_PCT=${valueFromConfig(config, defaults, 'haltDrawdownPercent')}`,
      `DAILY_MAX_LOSS_PCT=${valueFromConfig(config, defaults, 'dailyMaxLossPercent')}`,
      `MAX_NEW_ENTRIES_PER_TICK=${valueFromConfig(config, defaults, 'maxNewEntriesPerTick')}`,
      '',
    ];
    return { filename: 'wtc-tortila-config.env', contentType: 'text/plain; charset=utf-8', body: lines.join('\n') };
  }

  const defaults = botConfigDefaultsFor(productCode);
  const safeConfig = { ...defaults, ...(config ?? {}) };
  return {
    filename: 'wtc-legacy-config.json',
    contentType: 'application/json; charset=utf-8',
    body: `${JSON.stringify({ productCode, warning: 'Reference config only. Live Legacy adapter remains blocked (B3). No exchange keys included.', config: safeConfig }, null, 2)}\n`,
  };
}

export interface BotConfigVersionView { version: number; createdAt: number; note: string | null }
export interface BotSafetyView { code: string; severity: string; description: string; observedAt: number }
export interface BotConfigState {
  mode: 'postgres' | 'demo';
  current: Record<string, unknown> | null;
  version: number | null;
  versions: BotConfigVersionView[];
  safety: BotSafetyView[];
}

interface DemoConfigVersion {
  version: number;
  createdAt: number;
  note: string | null;
  config: Record<string, unknown>;
}

const demoGlobal = globalThis as unknown as { __WTC_DEMO_BOT_CONFIGS__?: Map<string, DemoConfigVersion[]> };
function demoConfigs(): Map<string, DemoConfigVersion[]> {
  if (!demoGlobal.__WTC_DEMO_BOT_CONFIGS__) demoGlobal.__WTC_DEMO_BOT_CONFIGS__ = new Map();
  return demoGlobal.__WTC_DEMO_BOT_CONFIGS__;
}

function demoKey(userId: string, productCode: string): string {
  return `${userId}:${productCode}`;
}

function loadDemoBotConfig(userId: string, productCode: string): BotConfigState {
  const versions = demoConfigs().get(demoKey(userId, productCode)) ?? [];
  const current = versions.at(-1) ?? null;
  return {
    mode: 'demo',
    current: current?.config ?? null,
    version: current?.version ?? null,
    versions: versions.slice().reverse().slice(0, 10).map((v) => ({ version: v.version, createdAt: v.createdAt, note: v.note })),
    safety: [],
  };
}

export async function loadBotConfig(userId: string, productCode: string): Promise<BotConfigState> {
  const db = getServerDb();
  if (!db) return loadDemoBotConfig(userId, productCode);
  const inst = (await listBotInstancesForUser(db, userId)).find((i) => i.productCode === productCode);
  if (!inst) return { mode: 'postgres', current: null, version: null, versions: [], safety: [] };
  const cfg = await getCurrentBotConfig(db, inst.id);
  const versions = await listBotConfigVersions(db, inst.id, 10);
  const safety = await listBotSafetyEvents(db, inst.id);
  return {
    mode: 'postgres',
    current: cfg?.config ?? null,
    version: cfg?.version ?? null,
    versions: versions.map((v) => ({ version: v.version, createdAt: v.createdAt.getTime(), note: v.note })),
    safety: safety.slice(0, 20).map((e) => ({ code: e.eventCode, severity: e.severity, description: e.description, observedAt: e.observedAt.getTime() })),
  };
}

export async function persistBotConfig(userId: string, productCode: string, config: Record<string, unknown>, note?: string): Promise<'saved' | 'demo'> {
  const db = getServerDb();
  if (!db) {
    const key = demoKey(userId, productCode);
    const versions = demoConfigs().get(key) ?? [];
    versions.push({ version: versions.length + 1, createdAt: Date.now(), note: note ?? null, config });
    demoConfigs().set(key, versions);
    return 'demo';
  }
  const inst = await ensureBotInstance(db, { userId, productCode });
  await saveBotConfig(db, { botInstanceId: inst.id, config, changedBy: userId, note });
  return 'saved';
}
