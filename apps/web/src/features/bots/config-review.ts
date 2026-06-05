import type { BotProductCode } from './meta';
import type { LegacyStageConfig, LegacySymbolConfig, TortilaSymbolConfig } from './config-types';

export type BotConfigReviewTone = 'ok' | 'warn' | 'bad' | 'gold' | 'neutral';

export interface BotConfigReviewMetric {
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down';
}

export interface BotConfigReviewPill {
  label: string;
  tone?: BotConfigReviewTone;
}

export interface BotConfigReviewRow {
  label: string;
  value: string;
  detail: string;
}

export interface BotConfigReviewSection {
  title: string;
  detail: string;
  rows: BotConfigReviewRow[];
}

export interface BotConfigReview {
  productCode: BotProductCode;
  title: string;
  summary: string;
  metrics: BotConfigReviewMetric[];
  pills: BotConfigReviewPill[];
  sections: BotConfigReviewSection[];
  footnote: string;
}

export interface BuildBotConfigReviewInput {
  productCode: BotProductCode;
  sourceLabel: string;
  config?: Record<string, unknown> | null;
  tortilaRows?: readonly TortilaSymbolConfig[];
  legacyRows?: readonly LegacySymbolConfig[];
  legacyStages?: readonly LegacyStageConfig[];
  providerAccountCount?: number;
}

export interface LegacyStageCapacityIssue {
  stage: number;
  stageRow: number;
  rsiUsed: number;
  rsiSlots: number;
  cciUsed: number;
  cciSlots: number;
  activeCoins: number;
  overRsi: boolean;
  overCci: boolean;
}

export const LEGACY_STAGE_CAPACITY_DRAFT_EVENT = 'wtc:legacy-stage-capacity-draft';

export interface LegacyStageCapacityDraftEventDetail {
  active: boolean;
  issue?: LegacyStageCapacityIssue;
}

function asNumber(config: Record<string, unknown> | null | undefined, key: string): number | null {
  const n = Number(config?.[key]);
  return Number.isFinite(n) ? n : null;
}

function modeLabel(config: Record<string, unknown> | null | undefined): string {
  return config?.operationMode === 'auto' ? 'automation intent' : 'custom draft';
}

function fmtPct(value: number, digits = 2): string {
  return `${value.toFixed(digits).replace(/\.?0+$/, '')}%`;
}

function avg(values: readonly number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function max(values: readonly number[]): number {
  return values.length ? Math.max(...values) : 0;
}

function symbolPreview(symbols: readonly string[]): string {
  if (symbols.length === 0) return 'No symbols configured';
  const head = symbols.slice(0, 4).join(', ');
  return symbols.length > 4 ? `${head} +${symbols.length - 4}` : head;
}

function timeframeMix(rows: readonly TortilaSymbolConfig[]): string {
  const oneH = rows.filter((row) => row.timeframe === '1h').length;
  const fourH = rows.filter((row) => row.timeframe === '4h').length;
  if (oneH > 0 && fourH > 0) return `${fourH} 4h / ${oneH} 1h`;
  if (oneH > 0) return `${oneH} 1h`;
  return `${fourH} 4h`;
}

function tortilaReview(input: BuildBotConfigReviewInput): BotConfigReview {
  const rows = input.tortilaRows ?? [];
  const config = input.config ?? {};
  const risks = rows.map((row) => row.riskPercent);
  const systemOne = rows.filter((row) => row.system === 1).length;
  const systemTwo = rows.filter((row) => row.system === 2).length;
  const tpCount = rows.filter((row) => row.takeProfitRr > 0).length;
  const avgRisk = avg(risks);
  const maxRisk = max(risks);
  const maxOpenSymbols = asNumber(config, 'maxOpenSymbols');
  const maxTotalUnits = asNumber(config, 'maxTotalUnits');
  const maxUnitsPerDirection = asNumber(config, 'maxUnitsPerDirection');
  const haltDrawdown = asNumber(config, 'haltDrawdownPercent');
  const dailyMaxLoss = asNumber(config, 'dailyMaxLossPercent');
  const maxNewEntries = asNumber(config, 'maxNewEntriesPerTick');

  return {
    productCode: 'tortila_bot',
    title: 'Effective Tortila settings review',
    summary: `${rows.length} configured coin${rows.length === 1 ? '' : 's'} using ${systemTwo} System 2 and ${systemOne} System 1 profiles. Average risk is ${fmtPct(avgRisk)} per trade; live exchange apply remains disabled.`,
    pills: [
      { label: input.sourceLabel, tone: 'gold' },
      { label: modeLabel(config), tone: config.operationMode === 'auto' ? 'ok' : 'neutral' },
      { label: timeframeMix(rows), tone: 'neutral' },
      { label: `${tpCount} TP rule${tpCount === 1 ? '' : 's'}`, tone: tpCount > 0 ? 'ok' : 'neutral' },
    ],
    metrics: [
      { label: 'Coins configured', value: String(rows.length), sub: symbolPreview(rows.map((row) => row.symbol)), tone: rows.length > 0 ? 'up' : undefined },
      { label: 'System mix', value: `${systemTwo} S2 / ${systemOne} S1`, sub: 'Turtle 55/20 vs 20/10' },
      { label: 'Risk profile', value: fmtPct(avgRisk), sub: `max ${fmtPct(maxRisk)} per trade`, tone: maxRisk > 2 ? 'down' : undefined },
      { label: 'Portfolio caps', value: maxOpenSymbols == null ? '-' : `${maxOpenSymbols} symbols`, sub: `${maxTotalUnits ?? '-'} total units / ${maxUnitsPerDirection ?? '-'} per side` },
    ],
    sections: [
      {
        title: 'Coin plan',
        detail: 'Each row is a saved WTC-side strategy profile, not a live exchange mutation.',
        rows: rows.slice(0, 8).map((row) => ({
          label: row.symbol,
          value: `S${row.system} / ${row.timeframe} / ${fmtPct(row.riskPercent)}`,
          detail: `Stop ${row.stopN}N, add ${row.addStep}N, max ${row.maxUnits} units, ATR ${row.atrPeriod}, TP ${row.takeProfitRr > 0 ? `${row.takeProfitRr}R` : 'off'}.`,
        })),
      },
      {
        title: 'Risk limits',
        detail: 'Portfolio-level guardrails saved with the reference profile.',
        rows: [
          { label: 'Max open symbols', value: maxOpenSymbols == null ? '-' : String(maxOpenSymbols), detail: 'Maximum symbols the reference profile allows open at once.' },
          { label: 'Max total units', value: maxTotalUnits == null ? '-' : String(maxTotalUnits), detail: 'Pyramid unit cap across all configured symbols.' },
          { label: 'Daily max loss', value: dailyMaxLoss == null ? '-' : fmtPct(dailyMaxLoss), detail: 'Reference daily loss stop for WTC review.' },
          { label: 'Halt drawdown', value: haltDrawdown == null ? '-' : fmtPct(haltDrawdown), detail: 'Reference portfolio drawdown halt.' },
          { label: 'Entry throttle', value: maxNewEntries == null ? '-' : String(maxNewEntries), detail: 'Maximum fresh entries per scheduler tick in the reference profile.' },
        ],
      },
    ],
    footnote: 'Exchange keys, vault metadata checks, and live exchange pings are separate from this settings review.',
  };
}

function legacySignalLabel(row: LegacySymbolConfig): string {
  return row.useCci && !row.useRsi ? `CCI ${row.cciLength} <= ${row.cciThreshold}` : `RSI ${row.rsiLength} <= ${row.rsiThreshold}`;
}

function legacySignalBucket(row: LegacySymbolConfig): 'rsi' | 'cci' {
  return row.useCci && !row.useRsi ? 'cci' : 'rsi';
}

function stageRowForIssue(stage: number, stages: readonly LegacyStageConfig[]): number {
  const configuredIndex = stages.findIndex((row) => row.stage === stage);
  if (configuredIndex >= 0) return configuredIndex + 1;
  return Number.isInteger(stage) && stage >= 1 && stage <= 4 ? stage : 1;
}

export function legacyStageCapacityIssues(
  rows: readonly LegacySymbolConfig[],
  stages: readonly LegacyStageConfig[],
): LegacyStageCapacityIssue[] {
  const usage = new Map<number, { rsi: number; cci: number }>();
  for (const row of rows) {
    if (row.active === false || !row.symbol.trim()) continue;
    const stage = Number(row.stage);
    if (!Number.isFinite(stage)) continue;
    const current = usage.get(stage) ?? { rsi: 0, cci: 0 };
    current[legacySignalBucket(row)] += 1;
    usage.set(stage, current);
  }

  return [...usage.entries()]
    .map(([stage, used]) => {
      const capacity = stages.find((row) => row.stage === stage);
      const rsiSlots = capacity?.rsiSlots ?? 0;
      const cciSlots = capacity?.cciSlots ?? 0;
      return {
        stage,
        stageRow: stageRowForIssue(stage, stages),
        rsiUsed: used.rsi,
        rsiSlots,
        cciUsed: used.cci,
        cciSlots,
        activeCoins: used.rsi + used.cci,
        overRsi: used.rsi > rsiSlots,
        overCci: used.cci > cciSlots,
      };
    })
    .filter((issue) => issue.overRsi || issue.overCci)
    .sort((a, b) => a.stageRow - b.stageRow || a.stage - b.stage);
}

export function firstLegacyStageCapacityIssue(
  rows: readonly LegacySymbolConfig[],
  stages: readonly LegacyStageConfig[],
): LegacyStageCapacityIssue | undefined {
  return legacyStageCapacityIssues(rows, stages)[0];
}

function legacyReview(input: BuildBotConfigReviewInput): BotConfigReview {
  const rows = input.legacyRows ?? [];
  const stages = input.legacyStages ?? [];
  const config = input.config ?? {};
  const active = rows.filter((row) => row.active !== false);
  const rsi = active.filter((row) => row.useRsi && !row.useCci);
  const cci = active.filter((row) => row.useCci && !row.useRsi);
  const delay = active.filter((row) => row.useDelayFilter);
  const delta = active.filter((row) => row.useDeltaFilter);
  const activeStages = new Set(active.map((row) => row.stage)).size;
  const maxLevels = max(active.map((row) => row.averagingLevels));
  const rsiSlots = stages.reduce((sum, row) => sum + row.rsiSlots, 0);
  const cciSlots = stages.reduce((sum, row) => sum + row.cciSlots, 0);
  const slotTotal = rsiSlots + cciSlots;
  const providerCount = input.providerAccountCount ?? 0;
  const capacityIssue = firstLegacyStageCapacityIssue(rows, stages);

  return {
    productCode: 'legacy_bot',
    title: 'Effective Legacy settings review',
    summary: `${active.length} active coin${active.length === 1 ? '' : 's'} across ${activeStages || 0} stage${activeStages === 1 ? '' : 's'}: ${rsi.length} RSI trigger${rsi.length === 1 ? '' : 's'} and ${cci.length} CCI trigger${cci.length === 1 ? '' : 's'}. Stage capacity is ${slotTotal} slots; live apply remains disabled.`,
    pills: [
      { label: input.sourceLabel, tone: 'gold' },
      { label: modeLabel(config), tone: config.operationMode === 'auto' ? 'ok' : 'neutral' },
      { label: providerCount === 1 ? '1 pub_id mapped' : `${providerCount} pub_ids mapped`, tone: providerCount > 0 ? 'ok' : 'warn' },
      { label: `${activeStages || 0} active stages`, tone: activeStages > 0 ? 'neutral' : 'warn' },
    ],
    metrics: [
      { label: 'Active coins', value: `${active.length}/${rows.length}`, sub: symbolPreview(active.map((row) => row.symbol)), tone: active.length > 0 ? 'up' : undefined },
      { label: 'Signal split', value: `${rsi.length} RSI / ${cci.length} CCI`, sub: `${delay.length} delay / ${delta.length} delta filters` },
      { label: 'Stage capacity', value: `${slotTotal} slots`, sub: capacityIssue ? `Stage ${capacityIssue.stage} over capacity` : `${rsiSlots} RSI / ${cciSlots} CCI`, tone: capacityIssue ? 'down' : undefined },
      { label: 'Averaging depth', value: maxLevels > 0 ? `${maxLevels} levels` : '-', sub: `default max symbols: ${config.maxSymbols ?? '-'}` },
    ],
    sections: [
      {
        title: 'Signal map',
        detail: 'One coin has one active trigger: RSI or CCI. Stage decides which slot bucket the coin belongs to.',
        rows: active.slice(0, 10).map((row) => ({
          label: row.symbol,
          value: legacySignalLabel(row),
          detail: `Stage ${row.stage}, ${row.timeframe}, TP ${fmtPct(row.takeProfitPercent)}, ${row.averagingLevels} averaging levels, leverage ${row.leverage}x.`,
        })),
      },
      {
        title: 'Stage slots',
        detail: 'Stage capacity is the plain slot budget admins and users can compare before saving.',
        rows: stages.map((row) => ({
          label: `Stage ${row.stage}`,
          value: `${row.rsiSlots} RSI / ${row.cciSlots} CCI`,
          detail: `${row.rsiSlots + row.cciSlots} total slot${row.rsiSlots + row.cciSlots === 1 ? '' : 's'} available for this stage.`,
        })),
      },
    ],
    footnote: 'Provider pub_id mappings and worker snapshots are read-only evidence. They are not copied into user settings and never expose exchange secrets.',
  };
}

export function buildBotConfigReview(input: BuildBotConfigReviewInput): BotConfigReview {
  return input.productCode === 'legacy_bot' ? legacyReview(input) : tortilaReview(input);
}
