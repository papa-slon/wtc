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
export const LEGACY_SYMBOL_ROW_LIMIT = 14;
export const LEGACY_STAGE_ROW_LIMIT = 4;

const booleanLike = z.preprocess((value) => {
  if (value === true || value === 'true' || value === 'on' || value === '1') return true;
  if (value === false || value === 'false' || value === 'off' || value === '0' || value === null || value === undefined || value === '') return false;
  return value;
}, z.boolean());

const legacyTimeframe = z.enum(['1m', '3m', '5m', '15m', '1h']).default('3m');

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

export const legacySymbolConfigSchema = z.object({
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
}).superRefine((row, ctx) => {
  if (!row.useRsi && !row.useCci) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['useRsi'], message: 'Enable RSI, CCI, or both.' });
  }
  const dropCount = row.averagingPercents.split(',').map((s) => s.trim()).filter(Boolean).length;
  const volumeCount = row.averagingVolumePercents.split(',').map((s) => s.trim()).filter(Boolean).length;
  if (dropCount !== row.averagingLevels) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['averagingPercents'], message: 'Drop count must match averaging levels.' });
  }
  if (volumeCount !== row.averagingLevels) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['averagingVolumePercents'], message: 'Volume count must match averaging levels.' });
  }
});

export type LegacySymbolConfig = z.infer<typeof legacySymbolConfigSchema>;

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
  { name: 'apiProfile', label: 'API profile label', type: 'text', placeholder: 'main-bingx', hint: 'Human label only. WTC never stores exchange keys in this config.' },
  { name: 'maxSymbols', label: 'Max symbols', type: 'number', step: '1', placeholder: '3', hint: 'Global startup cap from the legacy engine.' },
  { name: 'defaultTimeframe', label: 'Default timeframe', type: 'select', placeholder: '3m', hint: 'Used for new rows only; live rows are per-symbol.', options: [{ value: '1m', label: '1m' }, { value: '3m', label: '3m' }, { value: '5m', label: '5m' }, { value: '15m', label: '15m' }, { value: '1h', label: '1h' }] },
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

function legacySymbolConfigsFromForm(formData: FormData): LegacySymbolConfig[] {
  const rows: LegacySymbolConfig[] = [];
  for (let i = 0; i < LEGACY_SYMBOL_ROW_LIMIT; i += 1) {
    const symbol = String(formData.get(`legacy_symbol_${i}`) ?? '').trim();
    if (!symbol) continue;
    const signal = String(formData.get(`legacy_signal_${i}`) ?? 'rsi');
    const parsed = legacySymbolConfigSchema.safeParse({
      symbol,
      active: formData.get(`legacy_active_${i}`),
      timeframe: formData.get(`legacy_tf_${i}`),
      useRsi: signal === 'rsi' || signal === 'both',
      useCci: signal === 'cci' || signal === 'both',
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

export function legacyStageConfigsFromConfig(config: Record<string, unknown> | null | undefined): LegacyStageConfig[] {
  const parsed = z.array(legacyStageConfigSchema).safeParse(config?.stageConfigs);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  const maxSlots = configNumber(config, 'maxSlots', Number.NaN);
  if (Number.isFinite(maxSlots) && maxSlots > 0) {
    return [{ stage: 1, rsiSlots: Math.max(0, Math.ceil(maxSlots / 2)), cciSlots: Math.max(0, Math.floor(maxSlots / 2)) }];
  }
  return [...LEGACY_STAGE_DEFAULTS];
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
  const symbolConfigs = legacySymbolConfigsFromConfig(safeConfig);
  const stageConfigs = legacyStageConfigsFromConfig(safeConfig);
  return {
    filename: 'wtc-legacy-config.json',
    contentType: 'application/json; charset=utf-8',
    body: `${JSON.stringify({
      productCode,
      warning: 'Safe config export only. Legacy live-read uses provider pub_id snapshots. No exchange keys included. No live apply token included.',
      config: {
        ...safeConfig,
        symbols: symbolConfigs.map((row) => row.symbol).join(', '),
        symbolConfigs,
        stageConfigs,
      },
      native: {
        settings: symbolConfigs.map((row) => ({
          symbol: row.symbol,
          active: row.active,
          timeframe: row.timeframe,
          use_rsi: row.useRsi,
          use_cci: row.useCci,
          rsi_length: row.rsiLength,
          rsi_threshold: row.rsiThreshold,
          cci_length: row.cciLength,
          cci_threshold: row.cciThreshold,
          take_profit_percent: row.takeProfitPercent,
          initial_entry_percent: row.initialEntryPercent,
          averaging_levels: row.averagingLevels,
          averaging_percents: row.averagingPercents,
          averaging_volume_percents: row.averagingVolumePercents,
          use_balance_percent: row.useBalancePercent,
          leverage: row.leverage,
          stage: row.stage,
        })),
        stage_config: stageConfigs.map((row) => ({
          stage: row.stage,
          rsi_slots: row.rsiSlots,
          cci_slots: row.cciSlots,
        })),
      },
    }, null, 2)}\n`,
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
