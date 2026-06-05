'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { StatusPill } from '@wtc/ui';
import { instrumentOptionsForBot } from '@wtc/shared';
import type { LegacyRuntimeSymbolConfig, LegacyStageConfig, LegacySymbolConfig } from './config-types';
import type { BotConfigErrorCopy } from './config-error-copy';
import { InstrumentPicker } from './InstrumentPicker';
import {
  LEGACY_STAGE_CAPACITY_DRAFT_EVENT,
  type LegacyStageCapacityDraftEventDetail,
  type LegacyStageCapacityIssue,
} from './config-review';

const TF_OPTIONS = ['1m', '3m', '5m', '15m', '1h'] as const;
const LEGACY_SYMBOL_ROW_LIMIT = 14;
const LEGACY_STAGE_ROW_LIMIT = 4;
const ISSUE_SCROLL_MARGIN_TOP = 96;

type LegacySignal = 'rsi' | 'cci';
interface LegacyStageDraft {
  stage: string;
  rsiSlots: string;
  cciSlots: string;
}

interface LegacyRowDraft {
  symbol: string;
  active: boolean;
  stage: string;
  timeframe: LegacySymbolConfig['timeframe'];
  rsiLength: string;
  rsiThreshold: string;
  cciLength: string;
  cciThreshold: string;
}

interface LegacyStageResolutionRow {
  stageLabel: string;
  rsiCandidates: string[];
  cciCandidates: string[];
  rsiUsed: number;
  rsiSlots: number;
  cciUsed: number;
  cciSlots: number;
  status: 'inside capacity' | 'full' | 'over capacity';
}

function rowAt(rows: readonly LegacyRuntimeSymbolConfig[], index: number): Partial<LegacyRuntimeSymbolConfig> {
  return rows[index] ?? {};
}

function stageAt(rows: readonly LegacyStageConfig[], index: number): Partial<LegacyStageConfig> {
  return rows[index] ?? {};
}

function defaultStageDraft(rows: readonly LegacyStageConfig[], index: number): LegacyStageDraft {
  const r = stageAt(rows, index);
  const stage = r.stage != null ? String(r.stage) : index < 2 ? String(index + 1) : '';
  const rsiSlots = r.rsiSlots ?? (index === 0 ? 3 : index === 1 ? 2 : 0);
  const cciSlots = r.cciSlots ?? (index === 0 ? 2 : index === 1 ? 1 : 0);
  return { stage, rsiSlots: String(rsiSlots), cciSlots: String(cciSlots) };
}

function defaultRowDraft(rows: readonly LegacyRuntimeSymbolConfig[], index: number): LegacyRowDraft {
  const r = rowAt(rows, index);
  return {
    symbol: r.symbol ?? '',
    active: r.active ?? true,
    stage: String(r.stage ?? 1),
    timeframe: r.timeframe ?? '3m',
    rsiLength: String(r.rsiLength ?? 14),
    rsiThreshold: String(r.rsiThreshold ?? 20),
    cciLength: String(r.cciLength ?? 14),
    cciThreshold: String(r.cciThreshold ?? -300),
  };
}

function numericDraft(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function signalValue(row: Partial<LegacySymbolConfig>): LegacySignal {
  return row.useCci && !row.useRsi ? 'cci' : 'rsi';
}

function signalLabel(signal: LegacySignal): string {
  return signal === 'cci' ? 'CCI cross-down' : 'RSI cross-down';
}

function signalDescriptor(row: LegacyRowDraft, signal: LegacySignal): string {
  return signal === 'cci'
    ? `CCI ${row.cciLength} <= ${row.cciThreshold}`
    : `RSI ${row.rsiLength} <= ${row.rsiThreshold}`;
}

function stageUsageRows(rows: readonly LegacyRowDraft[], signals: readonly LegacySignal[]): Map<number, { rsi: number; cci: number }> {
  const usage = new Map<number, { rsi: number; cci: number }>();
  rows.forEach((row, index) => {
    if (!row.symbol || row.active === false) return;
    const stage = Number(row.stage);
    if (!Number.isFinite(stage)) return;
    const signal = signals[index] ?? 'rsi';
    const current = usage.get(stage) ?? { rsi: 0, cci: 0 };
    current[signal] += 1;
    usage.set(stage, current);
  });
  return usage;
}

function firstDraftStageCapacityIssue(
  drafts: readonly LegacyStageDraft[],
  usage: ReadonlyMap<number, { rsi: number; cci: number }>,
): LegacyStageCapacityIssue | undefined {
  return drafts
    .map((draft, index) => {
      const stage = Number(draft.stage);
      const used = usage.get(stage) ?? { rsi: 0, cci: 0 };
      const rsiSlots = numericDraft(draft.rsiSlots);
      const cciSlots = numericDraft(draft.cciSlots);
      return {
        stage,
        stageRow: index + 1,
        rsiUsed: used.rsi,
        rsiSlots,
        cciUsed: used.cci,
        cciSlots,
        activeCoins: used.rsi + used.cci,
        overRsi: used.rsi > rsiSlots,
        overCci: used.cci > cciSlots,
      };
    })
    .filter((issue) => Number.isFinite(issue.stage) && (issue.overRsi || issue.overCci))
    .sort((a, b) => a.stageRow - b.stageRow)[0];
}

function dispatchDraftStageCapacityPreview(detail: LegacyStageCapacityDraftEventDetail): void {
  window.dispatchEvent(new CustomEvent(LEGACY_STAGE_CAPACITY_DRAFT_EVENT, { detail }));
}

function pubShort(value: string | undefined): string {
  return value ? `${value.slice(0, 8)}...${value.slice(-4)}` : 'provider';
}

function pubIdSummary(count: number): string {
  return count === 1 ? '1 pub_id mapped' : `${count} pub_ids mapped`;
}

function candidateSummary(candidates: readonly string[]): string {
  if (candidates.length === 0) return 'None';
  const head = candidates.slice(0, 3).join('; ');
  return candidates.length > 3 ? `${head}; +${candidates.length - 3}` : head;
}

function stageResolutionRows(
  rows: readonly LegacyRowDraft[],
  signals: readonly LegacySignal[],
  stageDrafts: readonly LegacyStageDraft[],
): LegacyStageResolutionRow[] {
  return stageDrafts.map((draft, index) => {
    const stage = Number(draft.stage);
    const stageRows = Number.isFinite(stage)
      ? rows
        .map((row, rowIndex) => ({ row, rowIndex }))
        .filter(({ row }) => row.symbol && row.active !== false && Number(row.stage) === stage)
      : [];
    const rsiCandidates = stageRows
      .filter(({ rowIndex }) => (signals[rowIndex] ?? 'rsi') === 'rsi')
      .map(({ row, rowIndex }) => `#${rowIndex + 1} ${row.symbol} ${row.timeframe} ${signalDescriptor(row, 'rsi')}`);
    const cciCandidates = stageRows
      .filter(({ rowIndex }) => (signals[rowIndex] ?? 'rsi') === 'cci')
      .map(({ row, rowIndex }) => `#${rowIndex + 1} ${row.symbol} ${row.timeframe} ${signalDescriptor(row, 'cci')}`);
    const rsiSlots = numericDraft(draft.rsiSlots);
    const cciSlots = numericDraft(draft.cciSlots);
    const rsiUsed = rsiCandidates.length;
    const cciUsed = cciCandidates.length;
    const over = rsiUsed > rsiSlots || cciUsed > cciSlots;
    const full = !over && rsiUsed + cciUsed > 0 && rsiUsed === rsiSlots && cciUsed === cciSlots;
    return {
      stageLabel: Number.isFinite(stage) ? `Stage ${stage}` : `Stage row ${index + 1}`,
      rsiCandidates,
      cciCandidates,
      rsiUsed,
      rsiSlots,
      cciUsed,
      cciSlots,
      status: over ? 'over capacity' : full ? 'full' : 'inside capacity',
    };
  });
}

export function LegacyAveragingConfigTable({
  rows,
  stages,
  providerAccountCount,
  sourceLabel = 'WTC reference profile',
  sourceDetail = 'Rows are saved as WTC-side reference intent. No live Legacy config apply happens from this table.',
  showProviderIdentity = false,
  saveIssue,
}: {
  rows: readonly LegacyRuntimeSymbolConfig[];
  stages: readonly LegacyStageConfig[];
  providerAccountCount?: number;
  sourceLabel?: string;
  sourceDetail?: string;
  showProviderIdentity?: boolean;
  saveIssue?: BotConfigErrorCopy;
}) {
  const [signals, setSignals] = useState(() =>
    Array.from({ length: LEGACY_SYMBOL_ROW_LIMIT }, (_, i) => signalValue(rowAt(rows, i))),
  );
  const [stageDrafts, setStageDrafts] = useState(() =>
    Array.from({ length: LEGACY_STAGE_ROW_LIMIT }, (_, i) => defaultStageDraft(stages, i)),
  );
  const [rowDrafts, setRowDrafts] = useState(() =>
    Array.from({ length: LEGACY_SYMBOL_ROW_LIMIT }, (_, i) => defaultRowDraft(rows, i)),
  );
  const [stageDraftTouched, setStageDraftTouched] = useState(false);
  const activeRows = rowDrafts.filter((row) => row.symbol && row.active);
  const rsiRows = rowDrafts.filter((row, index) => row.symbol && row.active && (signals[index] ?? 'rsi') === 'rsi');
  const cciRows = rowDrafts.filter((row, index) => row.symbol && row.active && (signals[index] ?? 'rsi') === 'cci');
  const delayRows = rows.filter((row) => row.useDelayFilter);
  const deltaRows = rows.filter((row) => row.useDeltaFilter);
  const rowProviderCount = showProviderIdentity ? new Set(rows.map((row) => row.providerPubId).filter(Boolean)).size : 0;
  const providerCount = providerAccountCount ?? rowProviderCount;
  const stageTotals = stageDrafts.reduce(
    (sum, stage) => ({
      rsi: sum.rsi + numericDraft(stage.rsiSlots),
      cci: sum.cci + numericDraft(stage.cciSlots),
    }),
    { rsi: 0, cci: 0 },
  );
  const stageUsage = useMemo(() => stageUsageRows(rowDrafts, signals), [rowDrafts, signals]);
  const draftStageCapacityIssue = useMemo(() => firstDraftStageCapacityIssue(stageDrafts, stageUsage), [stageDrafts, stageUsage]);
  const resolutionRows = useMemo(() => stageResolutionRows(rowDrafts, signals, stageDrafts), [rowDrafts, signals, stageDrafts]);
  useEffect(() => {
    dispatchDraftStageCapacityPreview({ active: stageDraftTouched, issue: draftStageCapacityIssue });
  }, [stageDraftTouched, draftStageCapacityIssue]);
  useEffect(() => () => dispatchDraftStageCapacityPreview({ active: false }), []);
  const stagePreview = stageDrafts.reduce(
    (summary, draft) => {
      const stage = Number(draft.stage);
      const used = stageUsage.get(stage) ?? { rsi: 0, cci: 0 };
      const rsi = numericDraft(draft.rsiSlots);
      const cci = numericDraft(draft.cciSlots);
      const over = used.rsi > rsi || used.cci > cci;
      const full = !over && used.rsi + used.cci > 0 && used.rsi === rsi && used.cci === cci;
      return {
        over: summary.over + (over ? 1 : 0),
        full: summary.full + (full ? 1 : 0),
      };
    },
    { over: 0, full: 0 },
  );
  const symbolOptions = useMemo(() => instrumentOptionsForBot('legacy_bot', rows.map((row) => row.symbol).filter(Boolean)), [rows]);
  const updateRowDraft = (index: number, patch: Partial<LegacyRowDraft>) => {
    setRowDrafts((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="wtc-stack" style={{ gap: 16 }}>
      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Legacy strategy map</h3>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            One coin uses one trigger: RSI or CCI. Stages decide how many active symbols each trigger may hold.
          </p>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            A coin consumes one slot in its selected stage and trigger bucket. Tune the threshold, then check stage usage below before saving.
          </p>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Source: {sourceLabel}. {sourceDetail}
          </p>
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone="gold">{sourceLabel}</StatusPill>
          <StatusPill tone="ok">{activeRows.length} active coins</StatusPill>
          <StatusPill tone="neutral">{rsiRows.length} RSI</StatusPill>
          <StatusPill tone="neutral">{cciRows.length} CCI</StatusPill>
          <StatusPill tone="neutral">{delayRows.length} delay filters</StatusPill>
          <StatusPill tone="neutral">{deltaRows.length} delta filters</StatusPill>
          <StatusPill tone={providerCount > 0 ? 'neutral' : 'warn'}>{pubIdSummary(providerCount)}</StatusPill>
        </div>
      </div>

      <div className="wtc-stack" style={{ gap: 12 }}>
        <section
          style={{
            border: '1px solid var(--stroke)',
            borderRadius: 8,
            padding: 14,
            background: 'rgba(255,255,255,0.025)',
          }}
        >
          <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15 }}>Trigger resolution map</h4>
              <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                Multiple RSI or CCI coins in the same stage are independent trigger candidates. Stage capacity shows whether the bucket has room; WTC does not assign a hidden priority order from this page.
              </p>
              <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                Paused rows and blank coin rows are excluded from this draft map. Candidate labels show row number, symbol, timeframe, and trigger threshold before save.
              </p>
            </div>
            <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <StatusPill tone={stagePreview.over > 0 ? 'bad' : stagePreview.full > 0 ? 'warn' : 'ok'}>
                {stagePreview.over > 0 ? `${stagePreview.over} overloaded buckets` : stagePreview.full > 0 ? `${stagePreview.full} full buckets` : 'buckets inside capacity'}
              </StatusPill>
              <StatusPill tone="neutral">RSI bucket</StatusPill>
              <StatusPill tone="neutral">CCI bucket</StatusPill>
            </div>
          </div>
          <div className="wtc-table-wrap">
            <table className="wtc-table">
              <thead><tr><th>Stage bucket</th><th>RSI candidates</th><th>CCI candidates</th><th>Capacity state</th></tr></thead>
              <tbody>
                {resolutionRows.map((row) => (
                  <tr key={row.stageLabel}>
                    <td data-label="Stage bucket">{row.stageLabel}</td>
                    <td data-label="RSI candidates">{candidateSummary(row.rsiCandidates)}</td>
                    <td data-label="CCI candidates">{candidateSummary(row.cciCandidates)}</td>
                    <td data-label="Capacity state">
                      <div className="wtc-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <StatusPill tone={row.status === 'over capacity' ? 'bad' : row.status === 'full' ? 'warn' : 'ok'}>{row.status}</StatusPill>
                        <StatusPill tone="neutral">{row.rsiUsed}/{row.rsiSlots} RSI</StatusPill>
                        <StatusPill tone="neutral">{row.cciUsed}/{row.cciSlots} CCI</StatusPill>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {Array.from({ length: Math.min(LEGACY_SYMBOL_ROW_LIMIT, Math.max(rows.length, 6)) }, (_, i) => {
          const r = rowAt(rows, i);
          const draftRow = rowDrafts[i] ?? defaultRowDraft(rows, i);
          const signal = signals[i] ?? signalValue(r);
          const providerPubId = showProviderIdentity ? r.providerPubId : undefined;
          const rowSaveIssue = saveIssue?.target === 'legacy-row' && saveIssue.row === i + 1 ? saveIssue : undefined;
          const hasSaveIssue = !!rowSaveIssue;
          const issueId = `legacy-symbol-${i + 1}-save-error`;
          const errorProps = hasSaveIssue ? { 'aria-invalid': true, 'aria-describedby': issueId } : {};
          return (
            <section
              key={i}
              id={`legacy-symbol-${i + 1}`}
              aria-describedby={hasSaveIssue ? issueId : undefined}
              tabIndex={hasSaveIssue ? -1 : undefined}
              style={{
                border: hasSaveIssue ? '1px solid rgba(255, 103, 103, 0.75)' : '1px solid var(--stroke)',
                borderRadius: 8,
                padding: 14,
                background: hasSaveIssue ? 'rgba(255, 103, 103, 0.075)' : 'rgba(255,255,255,0.025)',
                scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP,
              }}
            >
              {rowSaveIssue && (
                <div
                  id={issueId}
                  role="alert"
                  tabIndex={-1}
                  style={{
                    border: '1px solid rgba(255, 103, 103, 0.55)',
                    borderRadius: 8,
                    marginBottom: 12,
                    padding: 10,
                    background: 'rgba(255, 103, 103, 0.06)',
                  }}
                >
                  <strong>{rowSaveIssue.title}</strong>
                  <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>{rowSaveIssue.inlineHint ?? rowSaveIssue.detail}</p>
                </div>
              )}
              <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div className="wtc-kicker">{providerPubId ? `pub_id ${pubShort(providerPubId)}` : `${sourceLabel} slot ${i + 1}`}</div>
                  <h4 style={{ margin: '3px 0 0', fontSize: 15 }}>{draftRow.symbol || 'New coin'}</h4>
                </div>
                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <StatusPill tone={draftRow.active === false ? 'neutral' : 'ok'}>{draftRow.active === false ? 'paused' : 'enabled'}</StatusPill>
                  <StatusPill tone="neutral">{signalLabel(signal)}</StatusPill>
                  <StatusPill tone="gold">Stage {draftRow.stage || 1} / {signal.toUpperCase()} slot</StatusPill>
                  <StatusPill tone="neutral">{r.useDelayFilter ? 'Delay filter on' : 'Delay filter off'}</StatusPill>
                  <StatusPill tone="neutral">{r.useDeltaFilter ? 'Delta filter on' : 'Delta filter off'}</StatusPill>
                </div>
              </div>

              <div className="wtc-grid wtc-grid-4">
                <InstrumentPicker
                  name={`legacy_symbol_${i}`}
                  defaultValue={r.symbol ?? ''}
                  options={symbolOptions}
                  placeholder="AAVE-USDT"
                  help="Search the Legacy/BingX catalog or type a dash-format symbol."
                  invalid={hasSaveIssue}
                  describedBy={hasSaveIssue ? issueId : undefined}
                  onChange={(event) => updateRowDraft(i, { symbol: event.target.value })}
                />
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Manual symbol override</span>
                  <input
                    className="wtc-input"
                    name={`legacy_symbol_custom_${i}`}
                    placeholder="DOGE-USDT"
                    {...errorProps}
                    onChange={(event) => {
                      const custom = event.target.value.trim();
                      if (custom) updateRowDraft(i, { symbol: custom });
                    }}
                  />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Status</span>
                  <select
                    className="wtc-input"
                    name={`legacy_active_${i}`}
                    defaultValue={String(r.active ?? true)}
                    {...errorProps}
                    onChange={(event) => updateRowDraft(i, { active: event.target.value === 'true' })}
                  >
                    <option value="true">Enabled</option>
                    <option value="false">Paused</option>
                  </select>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Timeframe</span>
                  <select
                    className="wtc-input"
                    name={`legacy_tf_${i}`}
                    defaultValue={r.timeframe ?? '3m'}
                    {...errorProps}
                    onChange={(event) => updateRowDraft(i, { timeframe: event.target.value as LegacySymbolConfig['timeframe'] })}
                  >
                    {TF_OPTIONS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                  </select>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Trigger</span>
                  <select
                    className="wtc-input"
                    name={`legacy_signal_${i}`}
                    value={signal}
                    {...errorProps}
                    onChange={(event) => {
                      const next = [...signals];
                      next[i] = event.target.value === 'cci' ? 'cci' : 'rsi';
                      setSignals(next);
                    }}
                  >
                    <option value="rsi">RSI</option>
                    <option value="cci">CCI</option>
                  </select>
                </label>
              </div>

              <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
                {signal === 'rsi' ? (
                  <>
                    <label className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>RSI length</span>
                      <input
                        className="wtc-input"
                        name={`legacy_rsi_len_${i}`}
                        type="number"
                        step="1"
                        defaultValue={String(r.rsiLength ?? 14)}
                        {...errorProps}
                        onChange={(event) => updateRowDraft(i, { rsiLength: event.target.value })}
                      />
                      <span className="wtc-dim" style={{ fontSize: 11 }}>Lookback candles, allowed 2-100.</span>
                    </label>
                    <label className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>RSI trigger threshold</span>
                      <input
                        className="wtc-input"
                        name={`legacy_rsi_thr_${i}`}
                        type="number"
                        step="1"
                        defaultValue={String(r.rsiThreshold ?? 20)}
                        {...errorProps}
                        onChange={(event) => updateRowDraft(i, { rsiThreshold: event.target.value })}
                      />
                      <span className="wtc-dim" style={{ fontSize: 11 }}>Lower values are stricter; allowed 1-100.</span>
                    </label>
                    <input type="hidden" name={`legacy_cci_len_${i}`} value={String(r.cciLength ?? 14)} />
                    <input type="hidden" name={`legacy_cci_thr_${i}`} value={String(r.cciThreshold ?? -300)} />
                  </>
                ) : (
                  <>
                    <label className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>CCI length</span>
                      <input
                        className="wtc-input"
                        name={`legacy_cci_len_${i}`}
                        type="number"
                        step="1"
                        defaultValue={String(r.cciLength ?? 14)}
                        {...errorProps}
                        onChange={(event) => updateRowDraft(i, { cciLength: event.target.value })}
                      />
                      <span className="wtc-dim" style={{ fontSize: 11 }}>Lookback candles, allowed 2-100.</span>
                    </label>
                    <label className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>CCI trigger threshold</span>
                      <input
                        className="wtc-input"
                        name={`legacy_cci_thr_${i}`}
                        type="number"
                        step="1"
                        defaultValue={String(r.cciThreshold ?? -300)}
                        {...errorProps}
                        onChange={(event) => updateRowDraft(i, { cciThreshold: event.target.value })}
                      />
                      <span className="wtc-dim" style={{ fontSize: 11 }}>Usually negative for oversold entries; allowed -500 to 500.</span>
                    </label>
                    <input type="hidden" name={`legacy_rsi_len_${i}`} value={String(r.rsiLength ?? 14)} />
                    <input type="hidden" name={`legacy_rsi_thr_${i}`} value={String(r.rsiThreshold ?? 20)} />
                  </>
                )}
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Stage slot group</span>
                  <input
                    className="wtc-input"
                    name={`legacy_stage_${i}`}
                    type="number"
                    step="1"
                    defaultValue={String(r.stage ?? 1)}
                    {...errorProps}
                    onChange={(event) => updateRowDraft(i, { stage: event.target.value })}
                  />
                  <span className="wtc-dim" style={{ fontSize: 11 }}>Consumes RSI or CCI capacity in the stage table below.</span>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Take profit %</span>
                  <input className="wtc-input" name={`legacy_tp_${i}`} type="number" step="0.05" defaultValue={String(r.takeProfitPercent ?? 0.5)} {...errorProps} />
                </label>
              </div>

              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Position sizing, averaging ladder, delay/delta filters</summary>
                <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Initial entry %</span>
                    <input className="wtc-input" name={`legacy_entry_${i}`} type="number" step="0.1" defaultValue={String(r.initialEntryPercent ?? 100)} {...errorProps} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Balance %</span>
                    <input className="wtc-input" name={`legacy_balance_${i}`} type="number" step="0.1" defaultValue={String(r.useBalancePercent ?? 1.5)} {...errorProps} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Leverage</span>
                    <input className="wtc-input" name={`legacy_lev_${i}`} type="number" step="1" defaultValue={String(r.leverage ?? 2)} {...errorProps} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Averaging levels</span>
                    <input className="wtc-input" name={`legacy_levels_${i}`} type="number" step="1" defaultValue={String(r.averagingLevels ?? 3)} {...errorProps} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Drop ladder %</span>
                    <input className="wtc-input" name={`legacy_drops_${i}`} defaultValue={r.averagingPercents ?? '3,12,35'} {...errorProps} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Volume ladder %</span>
                    <input className="wtc-input" name={`legacy_volumes_${i}`} defaultValue={r.averagingVolumePercents ?? '4,6,12'} {...errorProps} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Delay filter</span>
                    <select className="wtc-input" name={`legacy_delay_on_${i}`} defaultValue={String(r.useDelayFilter ?? false)} {...errorProps}>
                      <option value="false">Disabled</option>
                      <option value="true">Enabled</option>
                    </select>
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Delay bars</span>
                    <input className="wtc-input" name={`legacy_delay_bars_${i}`} type="number" step="1" defaultValue={String(r.delayBars ?? 1)} {...errorProps} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Delta filter</span>
                    <select className="wtc-input" name={`legacy_delta_on_${i}`} defaultValue={String(r.useDeltaFilter ?? false)} {...errorProps}>
                      <option value="false">Disabled</option>
                      <option value="true">Enabled</option>
                    </select>
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Delta threshold</span>
                    <input className="wtc-input" name={`legacy_delta_${i}`} type="number" step="0.1" defaultValue={String(r.deltaFilter ?? 0)} {...errorProps} />
                  </label>
                </div>
              </details>
            </section>
          );
        })}
      </div>

      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Stage capacity</h3>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            These limits decide how many active RSI and CCI slots each Legacy stage may hold before the next signal waits.
          </p>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Usage updates as you edit the draft capacities below. Saving still only writes a WTC-side reference profile.
          </p>
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone={stagePreview.over > 0 ? 'bad' : stagePreview.full > 0 ? 'warn' : 'ok'}>
            {stagePreview.over > 0 ? `${stagePreview.over} over capacity` : stagePreview.full > 0 ? `${stagePreview.full} full` : 'draft preview inside capacity'}
          </StatusPill>
          <StatusPill tone="neutral">{stageTotals.rsi} RSI slots</StatusPill>
          <StatusPill tone="neutral">{stageTotals.cci} CCI slots</StatusPill>
          <StatusPill tone="ok">{stageTotals.rsi + stageTotals.cci} total slots</StatusPill>
        </div>
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead><tr><th>Stage</th><th>RSI capacity</th><th>CCI capacity</th><th>Usage</th><th>Status</th></tr></thead>
          <tbody>
            {Array.from({ length: LEGACY_STAGE_ROW_LIMIT }, (_, i) => {
              const draft = stageDrafts[i] ?? defaultStageDraft(stages, i);
              const stage = Number(draft.stage);
              const rsi = numericDraft(draft.rsiSlots);
              const cci = numericDraft(draft.cciSlots);
              const used = stageUsage.get(stage) ?? { rsi: 0, cci: 0 };
              const overRsi = used.rsi > rsi;
              const overCci = used.cci > cci;
              const exactFull = !overRsi && !overCci && used.rsi + used.cci > 0 && used.rsi === rsi && used.cci === cci;
              const stageSaveIssue = saveIssue?.target === 'legacy-stage' && saveIssue.row === i + 1 ? saveIssue : undefined;
              const hasSaveIssue = !!stageSaveIssue;
              const issueId = `legacy-stage-${i + 1}-save-error`;
              const errorProps = hasSaveIssue ? { 'aria-invalid': true, 'aria-describedby': issueId } : {};
              return (
                <Fragment key={i}>
                  <tr
                    id={`legacy-stage-${i + 1}`}
                    aria-describedby={hasSaveIssue ? issueId : undefined}
                    tabIndex={hasSaveIssue ? -1 : undefined}
                    style={hasSaveIssue ? { background: 'rgba(255, 103, 103, 0.075)', scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP } : { scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP }}
                  >
                    <td data-label="Stage">
                      <input
                        className="wtc-input"
                        name={`legacy_stage_slot_${i}`}
                        type="number"
                        step="1"
                        value={draft.stage}
                        {...errorProps}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setStageDraftTouched(true);
                          setStageDrafts((current) => current.map((row, index) => (index === i ? { ...row, stage: nextValue } : row)));
                        }}
                      />
                    </td>
                    <td data-label="RSI capacity">
                      <input
                        className="wtc-input"
                        name={`legacy_stage_rsi_${i}`}
                        type="number"
                        step="1"
                        value={draft.rsiSlots}
                        {...errorProps}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setStageDraftTouched(true);
                          setStageDrafts((current) => current.map((row, index) => (index === i ? { ...row, rsiSlots: nextValue } : row)));
                        }}
                      />
                    </td>
                    <td data-label="CCI capacity">
                      <input
                        className="wtc-input"
                        name={`legacy_stage_cci_${i}`}
                        type="number"
                        step="1"
                        value={draft.cciSlots}
                        {...errorProps}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setStageDraftTouched(true);
                          setStageDrafts((current) => current.map((row, index) => (index === i ? { ...row, cciSlots: nextValue } : row)));
                        }}
                      />
                    </td>
                    <td data-label="Usage">
                      <div className="wtc-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <StatusPill tone={overRsi ? 'bad' : used.rsi > 0 ? 'neutral' : 'neutral'}>{used.rsi}/{rsi} RSI used</StatusPill>
                        <StatusPill tone={overCci ? 'bad' : used.cci > 0 ? 'neutral' : 'neutral'}>{used.cci}/{cci} CCI used</StatusPill>
                      </div>
                    </td>
                    <td data-label="Status">
                      <StatusPill tone={overRsi || overCci ? 'bad' : exactFull ? 'warn' : 'ok'}>
                        {overRsi || overCci ? 'over capacity' : exactFull ? 'full' : 'inside capacity'}
                      </StatusPill>
                    </td>
                  </tr>
                  {stageSaveIssue && (
                    <tr>
                      <td colSpan={5}>
                        <div
                          id={issueId}
                          role="alert"
                          tabIndex={-1}
                          style={{
                            border: '1px solid rgba(255, 103, 103, 0.55)',
                            borderRadius: 8,
                            padding: 10,
                            background: 'rgba(255, 103, 103, 0.06)',
                          }}
                        >
                          <strong>{stageSaveIssue.title}</strong>
                          <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>{stageSaveIssue.inlineHint ?? stageSaveIssue.detail}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
