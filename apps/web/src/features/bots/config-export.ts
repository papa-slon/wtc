import { z } from 'zod';
import type { BotProductCode } from './meta';
import { serializeTortilaSymbolConfigs } from './tortila-runtime-format';

const operationMode = z.enum(['manual', 'auto']).default('manual');
const legacyTimeframe = z.enum(['1m', '3m', '5m', '15m', '1h']).default('3m');

const booleanLike = z.preprocess((value) => {
  if (value === true || value === 'true' || value === 'on' || value === '1') return true;
  if (value === false || value === 'false' || value === 'off' || value === '0' || value === null || value === undefined || value === '') return false;
  return value;
}, z.boolean());

const numericCsv = z.string().trim().min(1).max(120).refine((value) => {
  return value.split(',').map((s) => s.trim()).every((part) => part !== '' && Number.isFinite(Number(part)));
}, 'Expected a comma-separated numeric list.');

const tortilaSymbolConfigSchema = z.object({
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

type TortilaSymbolConfig = z.infer<typeof tortilaSymbolConfigSchema>;

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

const legacySymbolConfigSchema = legacySymbolConfigBaseSchema.superRefine(refineLegacySymbolConfig);

const legacyRuntimeSymbolConfigSchema = legacySymbolConfigBaseSchema.extend({
  providerPubId: z.string().trim().min(1).max(256).optional(),
}).superRefine(refineLegacySymbolConfig);

type LegacySymbolConfig = z.infer<typeof legacySymbolConfigSchema>;
type LegacyRuntimeSymbolConfig = z.infer<typeof legacyRuntimeSymbolConfigSchema>;

const legacyStageConfigSchema = z.object({
  stage: z.coerce.number().int().min(1).max(8),
  rsiSlots: z.coerce.number().int().min(0).max(50),
  cciSlots: z.coerce.number().int().min(0).max(50),
});

type LegacyStageConfig = z.infer<typeof legacyStageConfigSchema>;

const TORTILA_SYMBOL_ROW_LIMIT = 8;
const LEGACY_SYMBOL_ROW_LIMIT = 14;

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

function botConfigDefaultsFor(productCode: BotProductCode): Record<string, string> {
  return productCode === 'legacy_bot' ? LEGACY_DEFAULTS : TORTILA_DEFAULTS;
}

function tortilaSymbolConfigsFromConfig(config: Record<string, unknown> | null | undefined): TortilaSymbolConfig[] {
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

function legacySymbolConfigsFromConfig(config: Record<string, unknown> | null | undefined): LegacySymbolConfig[] {
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

function legacyRuntimeSymbolConfigsFromConfig(config: Record<string, unknown> | null | undefined): LegacyRuntimeSymbolConfig[] {
  const parsed = z.array(legacyRuntimeSymbolConfigSchema).safeParse(config?.symbolConfigs);
  if (parsed.success && parsed.data.length > 0) return parsed.data;
  return legacySymbolConfigsFromConfig(config);
}

function legacyStageConfigsFromConfig(config: Record<string, unknown> | null | undefined): LegacyStageConfig[] {
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

function legacyAllowedExportConfig(productCode: BotProductCode, config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const defaults = botConfigDefaultsFor(productCode);
  const symbolConfigs = legacyRuntimeSymbolConfigsFromConfig(config).map((row) => {
    const safe = { ...row };
    delete safe.providerPubId;
    return safe;
  });
  const stageConfigs = legacyStageConfigsFromConfig(config);
  const operationModeParsed = operationMode.safeParse(config?.operationMode);
  const operationModeValue = operationModeParsed.success ? operationModeParsed.data : defaults.operationMode;
  const defaultTimeframeParsed = legacyTimeframe.safeParse(config?.defaultTimeframe ?? config?.timeframe);

  return {
    operationMode: operationModeValue,
    apiProfile: valueFromConfig(config, defaults, 'apiProfile').slice(0, 80),
    maxSymbols: configNumber(config, 'maxSymbols', Number(defaults.maxSymbols ?? 3)),
    defaultTimeframe: defaultTimeframeParsed.success ? defaultTimeframeParsed.data : defaults.defaultTimeframe,
    defaultTakeProfitPercent: configNumber(config, 'defaultTakeProfitPercent', Number(defaults.defaultTakeProfitPercent ?? 0.5)),
    defaultInitialEntryPercent: configNumber(config, 'defaultInitialEntryPercent', Number(defaults.defaultInitialEntryPercent ?? 2)),
    defaultUseBalancePercent: configNumber(config, 'defaultUseBalancePercent', Number(defaults.defaultUseBalancePercent ?? 1.5)),
    defaultLeverage: configNumber(config, 'defaultLeverage', Number(defaults.defaultLeverage ?? 2)),
    symbols: symbolConfigs.map((row) => row.symbol).join(', '),
    symbolConfigs,
    stageConfigs,
  };
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

  const legacyConfig = legacyAllowedExportConfig(productCode, config);
  const symbolConfigs = legacyConfig.symbolConfigs as LegacySymbolConfig[];
  const stageConfigs = legacyConfig.stageConfigs as LegacyStageConfig[];
  return {
    filename: 'wtc-legacy-config.json',
    contentType: 'application/json; charset=utf-8',
    body: `${JSON.stringify({
      productCode,
      warning: 'Safe config export only. Legacy live-read uses provider pub_id snapshots. No exchange keys included. No live apply token included.',
      config: legacyConfig,
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
