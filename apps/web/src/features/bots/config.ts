import 'server-only';
import { z } from 'zod';
import { getServerDb } from '@/lib/backend';
import {
  ensureBotInstance,
  getBotInstanceForUserProductAccount,
  getPublishedBotGlobalConfig,
  saveBotConfig,
  getCurrentBotConfig,
  listBotConfigVersions,
  listBotSafetyEvents,
} from '@wtc/db';
import type { BotGlobalConfigRow } from '@wtc/db';
import type { BotProductCode } from '@/features/bots/meta';
import type { BotConfigActionConfigError } from './config-action-handler';
export { exportBotConfig } from './config-export';
export { serializeTortilaSymbolConfig, serializeTortilaSymbolConfigs } from './tortila-runtime-format';

const operationMode = z.enum(['manual', 'auto']).default('manual');

export const TORTILA_SYMBOL_ROW_LIMIT = 8;
export const LEGACY_SYMBOL_ROW_LIMIT = 14;
export const LEGACY_STAGE_ROW_LIMIT = 4;

const booleanLike = z.preprocess((value) => {
  if (value === true || value === 'true' || value === 'on' || value === '1') return true;
  if (value === false || value === 'false' || value === 'off' || value === '0' || value === null || value === undefined || value === '') return false;
  return value;
}, z.boolean());

// The DCA bot resamples RSI/CCI from a 1m kline stream, so its timeframe is NOT
// limited to a fixed set (2m, 10m, 30m, 4h, … are all valid). Accept any
// minute/hour timeframe; this is saved as a WTC-versioned draft only and is
// never pushed to the live bot.
const legacyTimeframe = z
  .string()
  .trim()
  .regex(/^[1-9][0-9]*(m|h)$/, 'Use a timeframe like 1m, 2m, 5m, 15m, 1h or 4h')
  .default('3m');

const numericCsv = z.string().trim().min(1).max(120).refine((value) => {
  return value.split(',').map((s) => s.trim()).every((part) => part !== '' && Number.isFinite(Number(part)));
}, 'Expected a comma-separated numeric list.');

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

const legacySymbolConfigShape = {
  symbol: z.string().trim().min(1).max(40),
  active: booleanLike.default(true),
  timeframe: legacyTimeframe,
  useRsi: booleanLike.default(true),
  useCci: booleanLike.default(false),
  rsiLength: z.coerce.number().int().min(2).max(100),
  rsiThreshold: z.coerce.number().min(1).max(100),
  cciLength: z.coerce.number().int().min(2).max(100),
  cciThreshold: z.coerce.number().min(-500).max(500),
  takeProfitPercent: z.coerce.number().min(0.05).max(20),
  initialEntryPercent: z.coerce.number().min(0.1).max(100),
  averagingLevels: z.coerce.number().int().min(1).max(8),
  averagingPercents: numericCsv,
  averagingVolumePercents: numericCsv,
  useBalancePercent: z.coerce.number().min(0.1).max(100),
  leverage: z.coerce.number().int().min(1).max(50),
  stage: z.coerce.number().int().min(1).max(8),
  useDelayFilter: booleanLike.default(false),
  delayBars: z.coerce.number().int().min(1).max(100).default(1),
  useDeltaFilter: booleanLike.default(false),
  deltaFilter: z.coerce.number().min(-10_000).max(10_000).default(0),
};

const legacySymbolConfigBaseSchema = z.object(legacySymbolConfigShape);
type LegacySymbolConfigShape = z.infer<typeof legacySymbolConfigBaseSchema>;

function refineLegacySymbolConfig(row: LegacySymbolConfigShape, ctx: z.RefinementCtx): void {
  if (row.useRsi === row.useCci) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['useRsi'], message: 'Choose exactly one signal: RSI or CCI.' });
  }
  const dropCount = row.averagingPercents.split(',').map((s) => s.trim()).filter(Boolean).length;
  const volumeCount = row.averagingVolumePercents.split(',').map((s) => s.trim()).filter(Boolean).length;
  if (dropCount !== row.averagingLevels) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['averagingPercents'], message: 'Drop count must match averaging levels.' });
  }
  if (volumeCount !== row.averagingLevels) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['averagingVolumePercents'], message: 'Volume count must match averaging levels.' });
  }
}

export const legacySymbolConfigSchema = legacySymbolConfigBaseSchema.superRefine(refineLegacySymbolConfig);

export const legacyRuntimeSymbolConfigSchema = legacySymbolConfigBaseSchema.extend({
  providerPubId: z.string().trim().min(1).max(256).optional(),
}).superRefine(refineLegacySymbolConfig);

export type LegacySymbolConfig = z.infer<typeof legacySymbolConfigSchema>;
export type LegacyRuntimeSymbolConfig = z.infer<typeof legacyRuntimeSymbolConfigSchema>;

export const legacyStageConfigSchema = z.object({
  stage: z.coerce.number().int().min(1).max(8),
  rsiSlots: z.coerce.number().int().min(0).max(50),
  cciSlots: z.coerce.number().int().min(0).max(50),
});

export type LegacyStageConfig = z.infer<typeof legacyStageConfigSchema>;

export const legacyBotConfigSchema = z.object({
  operationMode,
  apiProfile: z.string().trim().min(1).max(80),
  symbols: z.string().trim().min(1).max(600),
  maxSymbols: z.coerce.number().int().min(1).max(50),
  defaultTimeframe: legacyTimeframe,
  defaultTakeProfitPercent: z.coerce.number().min(0.05).max(20),
  defaultInitialEntryPercent: z.coerce.number().min(0.1).max(100),
  defaultUseBalancePercent: z.coerce.number().min(0.1).max(100),
  defaultLeverage: z.coerce.number().int().min(1).max(50),
  symbolConfigs: z.array(legacySymbolConfigSchema).min(1).max(30),
  stageConfigs: z.array(legacyStageConfigSchema).min(1).max(8),
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
    label: 'Custom draft',
    hint: 'Edit a WTC-side draft for review. It is saved as a version and is not pushed to the running bot.',
  },
  {
    value: 'auto',
    label: 'WTC automation intent',
    hint: 'Save an automation preference for review. Runtime apply still requires a separately audited adapter.',
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
  { name: 'apiProfile', label: 'API profile label', type: 'text', placeholder: 'main-bingx', hint: 'Human label only. WTC never stores exchange keys in this config.' },
  { name: 'maxSymbols', label: 'Max symbols', type: 'number', step: '1', placeholder: '3', hint: 'Global startup cap from the legacy engine.' },
  { name: 'defaultTimeframe', label: 'Default timeframe', type: 'select', placeholder: '3m', hint: 'Used for new rows only; live rows are per-symbol.', options: [{ value: '1m', label: '1m' }, { value: '2m', label: '2m' }, { value: '3m', label: '3m' }, { value: '5m', label: '5m' }, { value: '10m', label: '10m' }, { value: '15m', label: '15m' }, { value: '30m', label: '30m' }, { value: '1h', label: '1h' }, { value: '2h', label: '2h' }, { value: '4h', label: '4h' }] },
  { name: 'defaultTakeProfitPercent', label: 'Default TP (%)', type: 'number', step: '0.05', placeholder: '0.5', hint: 'Reference default; every symbol row can override it.' },
  { name: 'defaultInitialEntryPercent', label: 'Default entry (%)', type: 'number', step: '0.1', placeholder: '2', hint: 'Reference initial allocation default.' },
  { name: 'defaultUseBalancePercent', label: 'Default balance (%)', type: 'number', step: '0.1', placeholder: '1.5', hint: 'Reference capital slice default.' },
  { name: 'defaultLeverage', label: 'Default leverage', type: 'number', step: '1', placeholder: '2', hint: 'Reference leverage. Live apply remains disabled.' },
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
  apiProfile: 'legacy-main',
  symbols: 'AAVE-USDT, ATOM-USDT, AVAX-USDT, BCH-USDT, FARTCOIN-USDT, KSM-USDT, LINK-USDT, SOL-USDT, SUI-USDT, TAO-USDT, UNI-USDT, XLM-USDT',
  maxSymbols: '3',
  defaultTimeframe: '3m',
  defaultTakeProfitPercent: '0.5',
  defaultInitialEntryPercent: '2',
  defaultUseBalancePercent: '1.5',
  defaultLeverage: '2',
};

const LEGACY_SYMBOL_DEFAULTS: readonly LegacySymbolConfig[] = [
  { symbol: 'AAVE-USDT', active: true, timeframe: '1m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'ATOM-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'AVAX-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'BCH-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 23, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'FARTCOIN-USDT', active: true, timeframe: '3m', useRsi: false, useCci: true, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '4,15,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'KSM-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'LINK-USDT', active: true, timeframe: '1m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'SOL-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 10, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,15,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 3, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'SUI-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 11, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '3,6,12', useBalancePercent: 1.5, leverage: 1, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'TAO-USDT', active: true, timeframe: '1m', useRsi: false, useCci: true, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -240, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'UNI-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
  { symbol: 'XLM-USDT', active: true, timeframe: '3m', useRsi: true, useCci: false, rsiLength: 14, rsiThreshold: 20, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, averagingLevels: 3, averagingPercents: '4,12,35', averagingVolumePercents: '4,6,12', useBalancePercent: 1.5, leverage: 2, stage: 1, useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
];

const LEGACY_STAGE_DEFAULTS: readonly LegacyStageConfig[] = [
  { stage: 1, rsiSlots: 3, cciSlots: 2 },
  { stage: 2, rsiSlots: 2, cciSlots: 1 },
];

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
    name: 'Live matrix reference',
    mode: 'manual',
    description: 'Reference profile shaped after the discovered RSI/CCI averaging bot matrix. Live-read uses provider pub_id snapshots; live apply remains disabled.',
    summary: ['12 per-symbol rows', 'RSI and CCI signal split', '3-level averaging ladders', 'stage slot matrix'],
    config: { ...LEGACY_DEFAULTS, operationMode: 'manual', symbolConfigs: LEGACY_SYMBOL_DEFAULTS, stageConfigs: LEGACY_STAGE_DEFAULTS },
  },
  {
    id: 'legacy-conservative',
    name: 'Conservative averaging',
    mode: 'manual',
    description: 'Smaller initial allocation and fewer slots for users who want a safer reference configuration.',
    summary: ['Smaller balance slice', 'TP 0.35%', '2 averaging levels', 'lower slot counts'],
    config: {
      ...LEGACY_DEFAULTS,
      operationMode: 'manual',
      defaultTakeProfitPercent: '0.35',
      defaultInitialEntryPercent: '1',
      defaultUseBalancePercent: '1',
      defaultLeverage: '1',
      symbolConfigs: LEGACY_SYMBOL_DEFAULTS.map((r) => ({
        ...r,
        takeProfitPercent: 0.35,
        initialEntryPercent: Math.min(r.initialEntryPercent, 20),
        averagingLevels: 2,
        averagingPercents: '4,18',
        averagingVolumePercents: '3,6',
        useBalancePercent: Math.min(r.useBalancePercent, 1),
        leverage: 1,
      })),
      stageConfigs: [
        { stage: 1, rsiSlots: 2, cciSlots: 1 },
        { stage: 2, rsiSlots: 1, cciSlots: 1 },
      ],
    },
  },
  {
    id: 'legacy-auto-reference',
    name: 'Automatic intent reference',
    mode: 'auto',
    description: 'Stores the user intent for automated legacy operation while WTC reads the current runtime by provider pub_id snapshots.',
    summary: ['Auto intent only', 'full symbol matrix', 'stage slots retained', 'read-only live snapshots'],
    config: { ...LEGACY_DEFAULTS, operationMode: 'auto', symbolConfigs: LEGACY_SYMBOL_DEFAULTS, stageConfigs: LEGACY_STAGE_DEFAULTS },
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
  if (productCode === 'legacy_bot') {
    const symbolConfigs = legacySymbolConfigsFromForm(formData);
    return {
      ...base,
      symbols: symbolConfigs.map((r) => r.symbol).join(', '),
      symbolConfigs,
      stageConfigs: legacyStageConfigsFromForm(formData),
    };
  }
  if (productCode !== 'tortila_bot') return base;
  const symbolConfigs = tortilaSymbolConfigsFromForm(formData);
  return {
    ...base,
    symbols: symbolConfigs.map((r) => r.symbol).join(', '),
    symbolConfigs,
  };
}

function zodMessages(result: z.SafeParseReturnType<unknown, unknown>): string[] {
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

function duplicateIssues(kind: string, values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) continue;
    if (seen.has(normalized)) duplicates.add(value.trim());
    seen.add(normalized);
  }
  return [...duplicates].map((value) => `${kind} "${value}" is duplicated.`);
}

function hasDuplicate(values: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) continue;
    if (seen.has(normalized)) return true;
    seen.add(normalized);
  }
  return false;
}

function firstZodPath(result: z.SafeParseReturnType<unknown, unknown>): string {
  if (result.success) return '';
  const path = result.error.issues[0]?.path[0];
  return typeof path === 'string' ? path : '';
}

function tortilaRowIssueCode(field: string): string {
  if (field === 'symbol') return 'tortila-row-symbol';
  if (field === 'timeframe') return 'tortila-row-timeframe';
  if (field === 'system') return 'tortila-row-system';
  if (field === 'riskPercent') return 'tortila-row-risk';
  if (field === 'stopN') return 'tortila-row-stop';
  if (field === 'addStep') return 'tortila-row-add';
  if (field === 'maxUnits') return 'tortila-row-units';
  if (field === 'atrPeriod') return 'tortila-row-atr';
  if (field === 'takeProfitRr') return 'tortila-row-tp';
  return 'tortila-row-invalid';
}

function legacyRowIssueCode(field: string): string {
  if (field === 'symbol') return 'legacy-row-symbol';
  if (field === 'timeframe') return 'legacy-row-timeframe';
  if (field === 'active') return 'legacy-row-status';
  if (field === 'useRsi' || field === 'useCci') return 'legacy-row-signal';
  if (field === 'rsiLength' || field === 'rsiThreshold') return 'legacy-row-rsi';
  if (field === 'cciLength' || field === 'cciThreshold') return 'legacy-row-cci';
  if (field === 'takeProfitPercent') return 'legacy-row-tp';
  if (field === 'initialEntryPercent') return 'legacy-row-entry';
  if (field === 'useBalancePercent') return 'legacy-row-balance';
  if (field === 'leverage') return 'legacy-row-leverage';
  if (field === 'averagingLevels') return 'legacy-row-levels';
  if (field === 'averagingPercents' || field === 'averagingVolumePercents') return 'legacy-row-ladder';
  if (field === 'stage') return 'legacy-row-stage';
  if (field === 'delayBars' || field === 'useDelayFilter') return 'legacy-row-delay';
  if (field === 'deltaFilter' || field === 'useDeltaFilter') return 'legacy-row-delta';
  return 'legacy-row-invalid';
}

function legacyStageIssueCode(field: string): string {
  return field === 'stage' ? 'legacy-stage-number' : 'legacy-stage-capacity';
}

function topLevelIssueCode(productCode: BotProductCode, field: string): string {
  if (field === 'operationMode') return 'operation-mode';
  if (productCode === 'legacy_bot') {
    if (field === 'apiProfile') return 'legacy-api-profile';
    if (field === 'maxSymbols') return 'legacy-max-symbols';
    if (field === 'defaultTimeframe') return 'legacy-default-timeframe';
    if (field === 'defaultTakeProfitPercent') return 'legacy-default-tp';
    if (field === 'defaultInitialEntryPercent') return 'legacy-default-entry';
    if (field === 'defaultUseBalancePercent') return 'legacy-default-balance';
    if (field === 'defaultLeverage') return 'legacy-default-leverage';
    return 'legacy-config-invalid';
  }
  if (field === 'maxOpenSymbols' || field === 'maxTotalUnits' || field === 'maxUnitsPerDirection') return 'tortila-portfolio-limit';
  if (field === 'haltDrawdownPercent' || field === 'dailyMaxLossPercent') return 'tortila-risk-limit';
  if (field === 'maxNewEntriesPerTick') return 'tortila-entry-throttle';
  return 'tortila-config-invalid';
}

export function botConfigFirstFormIssue(productCode: BotProductCode, formData: FormData): BotConfigActionConfigError | null {
  if (productCode === 'tortila_bot') {
    const symbols: string[] = [];
    for (let i = 0; i < TORTILA_SYMBOL_ROW_LIMIT; i += 1) {
      const selectedSymbol = String(formData.get(`symbol_${i}`) ?? '').trim();
      const customSymbol = String(formData.get(`symbol_custom_${i}`) ?? '').trim();
      const symbol = customSymbol || selectedSymbol;
      if (!symbol) continue;
      symbols.push(symbol);
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
      if (!parsed.success) return { code: tortilaRowIssueCode(firstZodPath(parsed)), row: i + 1 };
    }
    if (hasDuplicate(symbols)) return { code: 'tortila-duplicate-symbol' };
  } else {
    const legacySymbols: string[] = [];
    for (let i = 0; i < LEGACY_SYMBOL_ROW_LIMIT; i += 1) {
      const selectedSymbol = String(formData.get(`legacy_symbol_${i}`) ?? '').trim();
      const customSymbol = String(formData.get(`legacy_symbol_custom_${i}`) ?? '').trim();
      const symbol = customSymbol || selectedSymbol;
      if (!symbol) continue;
      legacySymbols.push(symbol);
      const signal = String(formData.get(`legacy_signal_${i}`) ?? 'rsi');
      const parsed = legacySymbolConfigSchema.safeParse({
        symbol,
        active: formData.get(`legacy_active_${i}`),
        timeframe: formData.get(`legacy_tf_${i}`),
        useRsi: signal === 'rsi',
        useCci: signal === 'cci',
        rsiLength: formData.get(`legacy_rsi_len_${i}`),
        rsiThreshold: formData.get(`legacy_rsi_thr_${i}`),
        cciLength: formData.get(`legacy_cci_len_${i}`),
        cciThreshold: formData.get(`legacy_cci_thr_${i}`),
        takeProfitPercent: formData.get(`legacy_tp_${i}`),
        initialEntryPercent: formData.get(`legacy_entry_${i}`),
        averagingLevels: formData.get(`legacy_levels_${i}`),
        averagingPercents: formData.get(`legacy_drops_${i}`),
        averagingVolumePercents: formData.get(`legacy_volumes_${i}`),
        useBalancePercent: formData.get(`legacy_balance_${i}`),
        leverage: formData.get(`legacy_lev_${i}`),
        stage: formData.get(`legacy_stage_${i}`),
        useDelayFilter: formData.get(`legacy_delay_on_${i}`),
        delayBars: formData.get(`legacy_delay_bars_${i}`) ?? '1',
        useDeltaFilter: formData.get(`legacy_delta_on_${i}`),
        deltaFilter: formData.get(`legacy_delta_${i}`) ?? '0',
      });
      if (!parsed.success) return { code: legacyRowIssueCode(firstZodPath(parsed)), row: i + 1 };
    }
    if (hasDuplicate(legacySymbols)) return { code: 'legacy-duplicate-symbol' };

    const stages: string[] = [];
    for (let i = 0; i < LEGACY_STAGE_ROW_LIMIT; i += 1) {
      const stage = String(formData.get(`legacy_stage_slot_${i}`) ?? '').trim();
      if (!stage) continue;
      stages.push(stage);
      const parsed = legacyStageConfigSchema.safeParse({
        stage,
        rsiSlots: formData.get(`legacy_stage_rsi_${i}`),
        cciSlots: formData.get(`legacy_stage_cci_${i}`),
      });
      if (!parsed.success) return { code: legacyStageIssueCode(firstZodPath(parsed)), row: i + 1 };
    }
    if (hasDuplicate(stages)) return { code: 'legacy-stage-duplicate' };
  }

  const parsedConfig = botConfigSchemaFor(productCode).safeParse(botConfigFormInput(productCode, formData));
  if (!parsedConfig.success) return { code: topLevelIssueCode(productCode, firstZodPath(parsedConfig)) };
  return null;
}

export function botConfigFormIssues(productCode: BotProductCode, formData: FormData): string[] {
  const issues: string[] = [];

  if (productCode === 'tortila_bot') {
    const symbols: string[] = [];
    for (let i = 0; i < TORTILA_SYMBOL_ROW_LIMIT; i += 1) {
      const selectedSymbol = String(formData.get(`symbol_${i}`) ?? '').trim();
      const customSymbol = String(formData.get(`symbol_custom_${i}`) ?? '').trim();
      const symbol = customSymbol || selectedSymbol;
      if (!symbol) continue;
      symbols.push(symbol);
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
      if (!parsed.success) issues.push(`Tortila coin ${i + 1}: ${zodMessages(parsed).join(' ')}`);
    }
    issues.push(...duplicateIssues('Tortila coin', symbols));
    return issues;
  }

  const legacySymbols: string[] = [];
  for (let i = 0; i < LEGACY_SYMBOL_ROW_LIMIT; i += 1) {
    const selectedSymbol = String(formData.get(`legacy_symbol_${i}`) ?? '').trim();
    const customSymbol = String(formData.get(`legacy_symbol_custom_${i}`) ?? '').trim();
    const symbol = customSymbol || selectedSymbol;
    if (!symbol) continue;
    legacySymbols.push(symbol);
    const signal = String(formData.get(`legacy_signal_${i}`) ?? 'rsi');
    const parsed = legacySymbolConfigSchema.safeParse({
      symbol,
      active: formData.get(`legacy_active_${i}`),
      timeframe: formData.get(`legacy_tf_${i}`),
      useRsi: signal === 'rsi',
      useCci: signal === 'cci',
      rsiLength: formData.get(`legacy_rsi_len_${i}`),
      rsiThreshold: formData.get(`legacy_rsi_thr_${i}`),
      cciLength: formData.get(`legacy_cci_len_${i}`),
      cciThreshold: formData.get(`legacy_cci_thr_${i}`),
      takeProfitPercent: formData.get(`legacy_tp_${i}`),
      initialEntryPercent: formData.get(`legacy_entry_${i}`),
      averagingLevels: formData.get(`legacy_levels_${i}`),
      averagingPercents: formData.get(`legacy_drops_${i}`),
      averagingVolumePercents: formData.get(`legacy_volumes_${i}`),
      useBalancePercent: formData.get(`legacy_balance_${i}`),
      leverage: formData.get(`legacy_lev_${i}`),
      stage: formData.get(`legacy_stage_${i}`),
      useDelayFilter: formData.get(`legacy_delay_on_${i}`),
      delayBars: formData.get(`legacy_delay_bars_${i}`) ?? '1',
      useDeltaFilter: formData.get(`legacy_delta_on_${i}`),
      deltaFilter: formData.get(`legacy_delta_${i}`) ?? '0',
    });
    if (!parsed.success) issues.push(`Legacy coin ${i + 1}: ${zodMessages(parsed).join(' ')}`);
  }
  issues.push(...duplicateIssues('Legacy coin', legacySymbols));

  const stages: string[] = [];
  for (let i = 0; i < LEGACY_STAGE_ROW_LIMIT; i += 1) {
    const stage = String(formData.get(`legacy_stage_slot_${i}`) ?? '').trim();
    if (!stage) continue;
    stages.push(stage);
    const parsed = legacyStageConfigSchema.safeParse({
      stage,
      rsiSlots: formData.get(`legacy_stage_rsi_${i}`),
      cciSlots: formData.get(`legacy_stage_cci_${i}`),
    });
    if (!parsed.success) issues.push(`Legacy stage ${i + 1}: ${zodMessages(parsed).join(' ')}`);
  }
  issues.push(...duplicateIssues('Legacy stage', stages));
  return issues;
}

function legacySymbolConfigsFromForm(formData: FormData): LegacySymbolConfig[] {
  const rows: LegacySymbolConfig[] = [];
  for (let i = 0; i < LEGACY_SYMBOL_ROW_LIMIT; i += 1) {
    const selectedSymbol = String(formData.get(`legacy_symbol_${i}`) ?? '').trim();
    const customSymbol = String(formData.get(`legacy_symbol_custom_${i}`) ?? '').trim();
    const symbol = customSymbol || selectedSymbol;
    if (!symbol) continue;
    const signal = String(formData.get(`legacy_signal_${i}`) ?? 'rsi');
    const parsed = legacySymbolConfigSchema.safeParse({
      symbol,
      active: formData.get(`legacy_active_${i}`),
      timeframe: formData.get(`legacy_tf_${i}`),
      useRsi: signal === 'rsi',
      useCci: signal === 'cci',
      rsiLength: formData.get(`legacy_rsi_len_${i}`),
      rsiThreshold: formData.get(`legacy_rsi_thr_${i}`),
      cciLength: formData.get(`legacy_cci_len_${i}`),
      cciThreshold: formData.get(`legacy_cci_thr_${i}`),
      takeProfitPercent: formData.get(`legacy_tp_${i}`),
      initialEntryPercent: formData.get(`legacy_entry_${i}`),
      averagingLevels: formData.get(`legacy_levels_${i}`),
      averagingPercents: formData.get(`legacy_drops_${i}`),
      averagingVolumePercents: formData.get(`legacy_volumes_${i}`),
      useBalancePercent: formData.get(`legacy_balance_${i}`),
      leverage: formData.get(`legacy_lev_${i}`),
      stage: formData.get(`legacy_stage_${i}`),
      useDelayFilter: formData.get(`legacy_delay_on_${i}`),
      delayBars: formData.get(`legacy_delay_bars_${i}`) ?? '1',
      useDeltaFilter: formData.get(`legacy_delta_on_${i}`),
      deltaFilter: formData.get(`legacy_delta_${i}`) ?? '0',
    });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows.length > 0 ? rows : [...LEGACY_SYMBOL_DEFAULTS];
}

function legacyStageConfigsFromForm(formData: FormData): LegacyStageConfig[] {
  const rows: LegacyStageConfig[] = [];
  for (let i = 0; i < LEGACY_STAGE_ROW_LIMIT; i += 1) {
    const stage = String(formData.get(`legacy_stage_slot_${i}`) ?? '').trim();
    if (!stage) continue;
    const parsed = legacyStageConfigSchema.safeParse({
      stage,
      rsiSlots: formData.get(`legacy_stage_rsi_${i}`),
      cciSlots: formData.get(`legacy_stage_cci_${i}`),
    });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows.length > 0 ? rows : [...LEGACY_STAGE_DEFAULTS];
}

function tortilaSymbolConfigsFromForm(formData: FormData): TortilaSymbolConfig[] {
  const rows: TortilaSymbolConfig[] = [];
  for (let i = 0; i < TORTILA_SYMBOL_ROW_LIMIT; i += 1) {
    const selectedSymbol = String(formData.get(`symbol_${i}`) ?? '').trim();
    const customSymbol = String(formData.get(`symbol_custom_${i}`) ?? '').trim();
    const symbol = customSymbol || selectedSymbol;
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

function configNumber(config: Record<string, unknown> | null | undefined, key: string, fallback: number): number {
  const n = Number(config?.[key]);
  return Number.isFinite(n) ? n : fallback;
}

function configTimeframe(config: Record<string, unknown> | null | undefined): LegacySymbolConfig['timeframe'] {
  const parsed = legacyTimeframe.safeParse(config?.defaultTimeframe ?? config?.timeframe);
  return parsed.success ? parsed.data : '3m';
}

export function legacySymbolConfigsFromConfig(config: Record<string, unknown> | null | undefined): LegacySymbolConfig[] {
  const parsed = z.array(legacySymbolConfigSchema).safeParse(config?.symbolConfigs);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  const symbols = typeof config?.symbols === 'string'
    ? config.symbols.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  if (symbols.length > 0) {
    const base = LEGACY_SYMBOL_DEFAULTS[0]!;
    return symbols.slice(0, LEGACY_SYMBOL_ROW_LIMIT).map((symbol) => ({
      ...base,
      symbol,
      timeframe: configTimeframe(config),
      rsiLength: configNumber(config, 'rsiLength', base.rsiLength),
      rsiThreshold: configNumber(config, 'rsiOversold', configNumber(config, 'rsiThreshold', base.rsiThreshold)),
      cciLength: configNumber(config, 'cciLength', base.cciLength),
      cciThreshold: configNumber(config, 'cciThreshold', base.cciThreshold),
      takeProfitPercent: configNumber(config, 'takeProfitPercent', configNumber(config, 'defaultTakeProfitPercent', base.takeProfitPercent)),
      initialEntryPercent: configNumber(config, 'initialEntryPercent', configNumber(config, 'defaultInitialEntryPercent', base.initialEntryPercent)),
      averagingLevels: configNumber(config, 'averagingLevels', base.averagingLevels),
      useBalancePercent: configNumber(config, 'useBalancePercent', configNumber(config, 'defaultUseBalancePercent', base.useBalancePercent)),
      leverage: configNumber(config, 'leverage', configNumber(config, 'defaultLeverage', base.leverage)),
    }));
  }
  return [...LEGACY_SYMBOL_DEFAULTS];
}

export function legacyRuntimeSymbolConfigsFromConfig(config: Record<string, unknown> | null | undefined): LegacyRuntimeSymbolConfig[] {
  const parsed = z.array(legacyRuntimeSymbolConfigSchema).safeParse(config?.symbolConfigs);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  return legacySymbolConfigsFromConfig(config);
}

export function legacyRuntimeSymbolSourceExists(config: Record<string, unknown> | null | undefined): boolean {
  const parsed = z.array(legacyRuntimeSymbolConfigSchema).safeParse(config?.symbolConfigs);
  if (parsed.success && parsed.data.length > 0) return true;
  return typeof config?.symbols === 'string' && config.symbols.split(',').some((s) => s.trim().length > 0);
}

export function legacyStageConfigsFromConfig(config: Record<string, unknown> | null | undefined): LegacyStageConfig[] {
  const parsed = z.array(legacyStageConfigSchema).safeParse(config?.stageConfigs);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  const maxSlots = configNumber(config, 'maxSlots', Number.NaN);
  if (Number.isFinite(maxSlots) && maxSlots > 0) {
    return [{ stage: 1, rsiSlots: Math.max(0, Math.ceil(maxSlots / 2)), cciSlots: Math.max(0, Math.floor(maxSlots / 2)) }];
  }
  return [...LEGACY_STAGE_DEFAULTS];
}

export function legacyRuntimeStageSourceExists(config: Record<string, unknown> | null | undefined): boolean {
  const parsed = z.array(legacyStageConfigSchema).safeParse(config?.stageConfigs);
  if (parsed.success && parsed.data.length > 0) return true;
  const maxSlots = configNumber(config, 'maxSlots', Number.NaN);
  return Number.isFinite(maxSlots) && maxSlots > 0;
}

export interface BotConfigVersionView { version: number; createdAt: number; note: string | null }
export interface BotSafetyView { code: string; severity: string; description: string; observedAt: number }
export type BotConfigSource = 'user_override' | 'system_default' | 'built_in';
export interface BotConfigSourceIssue {
  kind: 'warning' | 'error';
  title: string;
  detail: string;
}
export interface BotSystemDefaultView {
  id: string;
  profileCode: string;
  label: string;
  version: number;
  allowUserOverride: boolean;
  appliesToNewUsers: boolean;
  updatedAt: number;
}
export interface BotConfigState {
  mode: 'postgres' | 'demo';
  source: BotConfigSource;
  sourceLabel: string;
  sourceDetail: string;
  current: Record<string, unknown> | null;
  userCurrent: Record<string, unknown> | null;
  version: number | null;
  systemDefault: BotSystemDefaultView | null;
  sourceIssue?: BotConfigSourceIssue | null;
  versions: BotConfigVersionView[];
  safety: BotSafetyView[];
}

const BOT_CONFIG_SOURCE_KEY = '__wtcBotConfigSource';
const SYSTEM_DEFAULT_PROFILE_CODE = 'system_default';

function productDefaultName(productCode: string): string {
  return productCode === 'legacy_bot' ? 'Legacy' : 'Tortila';
}

function isBotProductCode(productCode: string): productCode is BotProductCode {
  return productCode === 'tortila_bot' || productCode === 'legacy_bot';
}

function isSystemDefaultSelection(config: Record<string, unknown> | null | undefined): boolean {
  return config?.[BOT_CONFIG_SOURCE_KEY] === SYSTEM_DEFAULT_PROFILE_CODE;
}

const FORBIDDEN_USER_BOT_CONFIG_KEYS = new Set([
  'apikey',
  'apisecret',
  'secret',
  'password',
  'passwordhash',
  'token',
  'authorization',
  'cookie',
  'sealed',
  'keyid',
  'wrappeddek',
  'vaultrecord',
  'credentials',
  'providerpubid',
  'provideraccountid',
  'pubid',
  'provideraccounts',
  'liveconfig',
  'rawjson',
  'legacydatabaseurl',
  'tortilajournalbaseurl',
  'tortilajournalurl',
  'headers',
  'applyconfig',
  'startbot',
  'stopbot',
  'start',
  'stop',
  'restart',
  'retest',
  'testexchange',
]);

function normalizedConfigKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function assertNoForbiddenUserBotConfigKeys(value: unknown, path = 'config'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenUserBotConfigKeys(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_USER_BOT_CONFIG_KEYS.has(normalizedConfigKey(key))) {
      throw new Error(`bot_config_forbidden_key:${path}.${key}`);
    }
    assertNoForbiddenUserBotConfigKeys(nested, `${path}.${key}`);
  }
}

function safeUserBotConfigForProduct(productCode: string, config: Record<string, unknown>): Record<string, unknown> {
  if (!isBotProductCode(productCode)) throw new Error('bot_config_unknown_product');
  assertNoForbiddenUserBotConfigKeys(config);
  const parsed = botConfigSchemaFor(productCode).safeParse(config);
  if (!parsed.success) throw new Error('bot_config_invalid');
  return parsed.data as unknown as Record<string, unknown>;
}

function parseUserBotConfigForProduct(productCode: string, config: Record<string, unknown>): Record<string, unknown> | null {
  try {
    return safeUserBotConfigForProduct(productCode, config);
  } catch {
    return null;
  }
}

function systemDefaultSelectionConfig(systemDefault: BotSystemDefaultView): Record<string, unknown> {
  return {
    [BOT_CONFIG_SOURCE_KEY]: SYSTEM_DEFAULT_PROFILE_CODE,
    profileCode: systemDefault.profileCode,
    globalConfigId: systemDefault.id,
    selectedGlobalVersion: systemDefault.version,
  };
}

function publishedSystemDefault(row: BotGlobalConfigRow | null): BotSystemDefaultView | null {
  if (!row) return null;
  return {
    id: row.id,
    profileCode: row.profileCode,
    label: row.label,
    version: row.version,
    allowUserOverride: row.allowUserOverride,
    appliesToNewUsers: row.appliesToNewUsers,
    updatedAt: row.updatedAt.getTime(),
  };
}

function publishedSystemDefaultConfig(productCode: string, row: BotGlobalConfigRow | null): Record<string, unknown> | null {
  if (!row || !isBotProductCode(productCode)) return null;
  const parsed = botConfigSchemaFor(productCode).safeParse(row.config);
  return parsed.success ? parsed.data as unknown as Record<string, unknown> : null;
}

function sourceLabelFor(productCode: string, source: BotConfigSource, version: number | null, systemDefault: BotSystemDefaultView | null): string {
  if (source === 'user_override') return version !== null ? `My custom profile v${version}` : 'My custom profile';
  if (source === 'system_default') return systemDefault ? `${systemDefault.label} v${systemDefault.version}` : 'System default';
  return `Built-in ${productDefaultName(productCode)} defaults`;
}

function sourceDetailFor(productCode: string, source: BotConfigSource, systemDefault: BotSystemDefaultView | null): string {
  if (source === 'user_override') {
    if (productCode === 'legacy_bot') {
      return 'You are editing your personal WTC reference version. Admins can update the shared default, but they cannot edit this user-owned Legacy profile; provider snapshots stay read-only evidence.';
    }
    return 'You are editing your personal WTC reference version. Admins can update the shared default, but they cannot edit this user-owned Tortila profile; exchange keys stay encrypted separately.';
  }
  if (source === 'system_default') {
    const overrideText = systemDefault?.allowUserOverride === false
      ? 'Personal overrides are locked for this default.'
      : 'Saving the form creates your own user-owned version.';
    if (productCode === 'legacy_bot') {
      return `Editable fields are resolved from the admin-published Legacy system default. ${overrideText} Provider runtime snapshots are never silently copied into this form.`;
    }
    return `Editable fields are resolved from the admin-published Tortila system default. ${overrideText} Live exchange apply and connection testing remain disabled.`;
  }
  if (productCode === 'legacy_bot') {
    return 'Editable fields start from safe built-in Legacy defaults because no user version or published system default is available. Nothing is pushed to the live bot.';
  }
  return 'Editable fields start from safe built-in Tortila defaults because no user version or published system default is available. Save a version before treating this as your personal bot profile.';
}

function configState(input: {
  mode: 'postgres' | 'demo';
  productCode: string;
  source: BotConfigSource;
  current: Record<string, unknown> | null;
  userCurrent: Record<string, unknown> | null;
  version: number | null;
  systemDefault: BotSystemDefaultView | null;
  sourceIssue?: BotConfigSourceIssue | null;
  versions: BotConfigVersionView[];
  safety: BotSafetyView[];
}): BotConfigState {
  return {
    ...input,
    sourceLabel: sourceLabelFor(input.productCode, input.source, input.version, input.systemDefault),
    sourceDetail: sourceDetailFor(input.productCode, input.source, input.systemDefault),
    sourceIssue: input.sourceIssue ?? null,
  };
}

function invalidUserConfigIssue(version: number): BotConfigSourceIssue {
  return {
    kind: 'error',
    title: 'Saved custom profile failed validation',
    detail: `The latest user-owned config v${version} is no longer valid for this bot schema, so WTC is using the published system default or built-in fallback until a valid profile is saved.`,
  };
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

function demoKey(userId: string, productCode: string, accountId?: string | null): string {
  return accountId ? `${userId}:${productCode}:${accountId}` : `${userId}:${productCode}`;
}

function loadDemoBotConfig(userId: string, productCode: string, accountId?: string | null): BotConfigState {
  const versions = demoConfigs().get(demoKey(userId, productCode, accountId)) ?? [];
  const current = versions.at(-1) ?? null;
  return configState({
    mode: 'demo',
    productCode,
    source: current && !isSystemDefaultSelection(current.config) && parseUserBotConfigForProduct(productCode, current.config) ? 'user_override' : 'built_in',
    current: current && !isSystemDefaultSelection(current.config) ? parseUserBotConfigForProduct(productCode, current.config) : null,
    userCurrent: current && !isSystemDefaultSelection(current.config) ? parseUserBotConfigForProduct(productCode, current.config) : null,
    version: current?.version ?? null,
    systemDefault: null,
    sourceIssue: current && !isSystemDefaultSelection(current.config) && !parseUserBotConfigForProduct(productCode, current.config) ? invalidUserConfigIssue(current.version) : null,
    versions: versions.slice().reverse().slice(0, 10).map((v) => ({ version: v.version, createdAt: v.createdAt, note: v.note })),
    safety: [],
  });
}

export async function loadBotConfig(userId: string, productCode: string, accountId?: string): Promise<BotConfigState> {
  const db = getServerDb();
  if (!db) return loadDemoBotConfig(userId, productCode, accountId ?? null);
  const [systemDefaultRow, inst] = await Promise.all([
    getPublishedBotGlobalConfig(db, productCode),
    getBotInstanceForUserProductAccount(db, { userId, productCode, accountId: accountId ?? null }),
  ]);
  let systemDefault = publishedSystemDefault(systemDefaultRow);
  const systemDefaultConfig = publishedSystemDefaultConfig(productCode, systemDefaultRow);
  if (systemDefault && !systemDefaultConfig) systemDefault = null;
  if (!inst) {
    return configState({
      mode: 'postgres',
      productCode,
      source: systemDefault ? 'system_default' : 'built_in',
      current: systemDefaultConfig && systemDefault ? systemDefaultConfig : null,
      userCurrent: null,
      version: null,
      systemDefault,
      versions: [],
      safety: [],
    });
  }
  const cfg = await getCurrentBotConfig(db, inst.id);
  const [versions, safety] = await Promise.all([
    listBotConfigVersions(db, inst.id, 10),
    listBotSafetyEvents(db, inst.id),
  ]);
  const versionViews = versions.map((v) => ({ version: v.version, createdAt: v.createdAt.getTime(), note: v.note }));
  const safetyViews = safety.slice(0, 20).map((e) => ({ code: e.eventCode, severity: e.severity, description: e.description, observedAt: e.observedAt.getTime() }));
  const parsedUserConfig = cfg && !isSystemDefaultSelection(cfg.config) ? parseUserBotConfigForProduct(productCode, cfg.config) : null;
  const invalidUserConfig = !!cfg && !isSystemDefaultSelection(cfg.config) && !parsedUserConfig;
  if (cfg && parsedUserConfig && systemDefault?.allowUserOverride !== false) {
    return configState({
      mode: 'postgres',
      productCode,
      source: 'user_override',
      current: parsedUserConfig,
      userCurrent: parsedUserConfig,
      version: cfg.version,
      systemDefault,
      versions: versionViews,
      safety: safetyViews,
    });
  }
  return configState({
    mode: 'postgres',
    productCode,
    source: systemDefault ? 'system_default' : 'built_in',
    current: systemDefaultConfig && systemDefault ? systemDefaultConfig : null,
    userCurrent: parsedUserConfig,
    version: cfg?.version ?? null,
    systemDefault,
    sourceIssue: invalidUserConfig && cfg ? invalidUserConfigIssue(cfg.version) : null,
    versions: versionViews,
    safety: safetyViews,
  });
}

export async function persistBotConfig(userId: string, productCode: string, config: Record<string, unknown>, note?: string, accountId?: string | null): Promise<'saved' | 'demo'> {
  const safeConfig = safeUserBotConfigForProduct(productCode, config);
  const db = getServerDb();
  if (!db) {
    const key = demoKey(userId, productCode, accountId);
    const versions = demoConfigs().get(key) ?? [];
    versions.push({ version: versions.length + 1, createdAt: Date.now(), note: note ?? null, config: safeConfig });
    demoConfigs().set(key, versions);
    return 'demo';
  }
  const systemDefaultRow = await getPublishedBotGlobalConfig(db, productCode);
  const systemDefault = publishedSystemDefault(systemDefaultRow);
  const systemDefaultConfig = publishedSystemDefaultConfig(productCode, systemDefaultRow);
  if (systemDefault && systemDefaultConfig && !systemDefault.allowUserOverride) throw new Error('bot_config_override_disabled');
  const inst = await ensureBotInstance(db, { userId, productCode, accountId: accountId ?? null });
  await saveBotConfig(db, { botInstanceId: inst.id, config: safeConfig, changedBy: userId, note });
  return 'saved';
}

export async function selectSystemDefaultBotConfig(userId: string, productCode: string, accountId?: string | null): Promise<'saved' | 'unavailable'> {
  const db = getServerDb();
  if (!db) return 'unavailable';
  const systemDefaultRow = await getPublishedBotGlobalConfig(db, productCode);
  const systemDefault = publishedSystemDefault(systemDefaultRow);
  const systemDefaultConfig = publishedSystemDefaultConfig(productCode, systemDefaultRow);
  if (!systemDefault || !systemDefaultConfig) return 'unavailable';
  const inst = await ensureBotInstance(db, { userId, productCode, accountId: accountId ?? null });
  await saveBotConfig(db, {
    botInstanceId: inst.id,
    config: systemDefaultSelectionConfig(systemDefault),
    changedBy: userId,
    note: `use-system-default:${systemDefault.profileCode}:v${systemDefault.version}`,
  });
  return 'saved';
}
