'use client';

import { useMemo, useState } from 'react';
import { StatusPill, buttonClasses } from '@wtc/ui';
import type { TortilaSymbolConfig } from './config-types';
import type { BotConfigErrorCopy } from './config-error-copy';
import {
  serializeTortilaSymbolConfigs,
  trimTortilaRuntimeNumber as trimNumber,
  type TortilaRuntimeSymbolConfig,
} from './tortila-runtime-format';

const TF_OPTIONS = ['4h', '1h'] as const;
const TORTILA_SYMBOL_ROW_LIMIT = 8;
const TORTILA_SYMBOL_OPTIONS = [
  'XRP/USDT:USDT',
  'TRX/USDT:USDT',
  'NEAR/USDT:USDT',
  'HBAR/USDT:USDT',
  'LINK/USDT:USDT',
  'BTC/USDT:USDT',
  'ETH/USDT:USDT',
  'SOL/USDT:USDT',
  'BNB/USDT:USDT',
  'AVAX/USDT:USDT',
  'SUI/USDT:USDT',
  'ATOM/USDT:USDT',
] as const;
const ISSUE_SCROLL_MARGIN_TOP = 96;
const TORTILA_CAP_INPUTS = [
  { name: 'maxOpenSymbols', label: 'Max open symbols', step: '1', hint: 'How many configured coins the reference profile allows open at once.' },
  { name: 'maxTotalUnits', label: 'Max total units', step: '1', hint: 'Pyramid unit cap across the whole WTC reference profile.' },
  { name: 'maxUnitsPerDirection', label: 'Units per direction', step: '1', hint: 'Directional pyramid cap saved with this profile.' },
  { name: 'haltDrawdownPercent', label: 'Drawdown halt %', step: '1', hint: 'Portfolio drawdown halt reference.' },
  { name: 'dailyMaxLossPercent', label: 'Daily loss halt %', step: '0.5', hint: 'Daily risk halt reference.' },
  { name: 'maxNewEntriesPerTick', label: 'Entries per tick', step: '1', hint: 'Fresh-entry throttle per scheduler tick.' },
] as const;
const DEFAULT_TORTILA_PORTFOLIO_CAPS = {
  maxOpenSymbols: '5',
  maxTotalUnits: '12',
  maxUnitsPerDirection: '8',
  haltDrawdownPercent: '35',
  dailyMaxLossPercent: '6',
  maxNewEntriesPerTick: '2',
} as const;

type TortilaPortfolioCapName = (typeof TORTILA_CAP_INPUTS)[number]['name'];
type TortilaPortfolioCaps = Record<TortilaPortfolioCapName, string>;
type TortilaCapTone = 'ok' | 'warn' | 'bad' | 'neutral';
const TORTILA_CAP_ERROR_CODES = new Set(['tortila-portfolio-limit', 'tortila-risk-limit', 'tortila-entry-throttle']);
const TORTILA_CAP_ISSUE_INPUTS: Record<string, readonly TortilaPortfolioCapName[]> = {
  'tortila-portfolio-limit': ['maxOpenSymbols', 'maxTotalUnits', 'maxUnitsPerDirection'],
  'tortila-risk-limit': ['haltDrawdownPercent', 'dailyMaxLossPercent'],
  'tortila-entry-throttle': ['maxNewEntriesPerTick'],
};

interface TortilaRowDraft {
  symbol: string;
  customSymbol: string;
  timeframe: TortilaSymbolConfig['timeframe'];
  system: string;
  riskPercent: string;
  stopN: string;
  addStep: string;
  maxUnits: string;
  atrPeriod: string;
  takeProfitRr: string;
}

interface TortilaStrategyMapRow {
  bucket: string;
  candidates: string[];
  riskShape: string;
  guardrails: string;
}

interface TortilaPortfolioCapRow {
  label: string;
  reference: string;
  draft: string;
  status: string;
  tone: TortilaCapTone;
}

function rowAt(rows: readonly TortilaSymbolConfig[], index: number): Partial<TortilaSymbolConfig> {
  return rows[index] ?? {};
}

function symbolOptions(rows: readonly TortilaSymbolConfig[]): string[] {
  return [...new Set([...rows.map((row) => row.symbol).filter(Boolean), ...TORTILA_SYMBOL_OPTIONS])].sort();
}

function systemLabel(system: number | string | undefined): string {
  return Number(system) === 1 ? 'System 1 (20/10)' : 'System 2 (55/20)';
}

function numericDraft(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function defaultPortfolioCaps(caps: Partial<TortilaPortfolioCaps> | undefined): TortilaPortfolioCaps {
  return {
    maxOpenSymbols: caps?.maxOpenSymbols ?? DEFAULT_TORTILA_PORTFOLIO_CAPS.maxOpenSymbols,
    maxTotalUnits: caps?.maxTotalUnits ?? DEFAULT_TORTILA_PORTFOLIO_CAPS.maxTotalUnits,
    maxUnitsPerDirection: caps?.maxUnitsPerDirection ?? DEFAULT_TORTILA_PORTFOLIO_CAPS.maxUnitsPerDirection,
    haltDrawdownPercent: caps?.haltDrawdownPercent ?? DEFAULT_TORTILA_PORTFOLIO_CAPS.haltDrawdownPercent,
    dailyMaxLossPercent: caps?.dailyMaxLossPercent ?? DEFAULT_TORTILA_PORTFOLIO_CAPS.dailyMaxLossPercent,
    maxNewEntriesPerTick: caps?.maxNewEntriesPerTick ?? DEFAULT_TORTILA_PORTFOLIO_CAPS.maxNewEntriesPerTick,
  };
}

function capNumber(caps: TortilaPortfolioCaps, name: TortilaPortfolioCapName): number {
  return numericDraft(caps[name], numericDraft(DEFAULT_TORTILA_PORTFOLIO_CAPS[name], 0));
}

function tortilaPortfolioCapIssue(issue: BotConfigErrorCopy | undefined): BotConfigErrorCopy | undefined {
  return issue?.target === 'tortila-cap' && TORTILA_CAP_ERROR_CODES.has(issue.code) ? issue : undefined;
}

function capInputHasIssue(name: TortilaPortfolioCapName, issue: BotConfigErrorCopy | undefined): boolean {
  return !!issue && (TORTILA_CAP_ISSUE_INPUTS[issue.code] ?? []).includes(name);
}

function comparableCapStatus(used: number, cap: number): { status: string; tone: TortilaCapTone } {
  if (used > cap) return { status: 'draft over reference cap', tone: 'bad' };
  if (used === cap && cap > 0) return { status: 'reference cap reached', tone: 'warn' };
  if (used === 0) return { status: 'no draft usage', tone: 'neutral' };
  return { status: 'draft inside reference cap', tone: 'ok' };
}

function defaultRowDraft(rows: readonly TortilaSymbolConfig[], index: number): TortilaRowDraft {
  const r = rowAt(rows, index);
  return {
    symbol: r.symbol ?? '',
    customSymbol: '',
    timeframe: r.timeframe ?? '4h',
    system: String(r.system ?? 2),
    riskPercent: String(r.riskPercent ?? 0.3),
    stopN: String(r.stopN ?? 2),
    addStep: String(r.addStep ?? 1),
    maxUnits: String(r.maxUnits ?? 4),
    atrPeriod: String(r.atrPeriod ?? 20),
    takeProfitRr: String(r.takeProfitRr ?? 0),
  };
}

function effectiveSymbol(row: TortilaRowDraft): string {
  return row.customSymbol.trim() || row.symbol.trim();
}

function activeDraftRows(rowDrafts: readonly TortilaRowDraft[]): TortilaRowDraft[] {
  return rowDrafts.filter((row) => effectiveSymbol(row));
}

function runtimeDraftRows(rows: readonly TortilaRowDraft[]): TortilaRuntimeSymbolConfig[] {
  return activeDraftRows(rows).map((row) => ({
    symbol: effectiveSymbol(row),
    timeframe: row.timeframe || '4h',
    system: numericDraft(row.system, 2),
    riskPercent: numericDraft(row.riskPercent, 0.3),
    stopN: numericDraft(row.stopN, 2),
    addStep: numericDraft(row.addStep, 1),
    maxUnits: numericDraft(row.maxUnits, 4),
    atrPeriod: numericDraft(row.atrPeriod, 20),
    takeProfitRr: numericDraft(row.takeProfitRr, 0),
  }));
}

function riskBand(riskPercent: number): string {
  if (riskPercent < 0.25) return 'low';
  if (riskPercent <= 0.75) return 'standard';
  return 'elevated';
}

function tpLabel(takeProfitRr: number): string {
  return takeProfitRr > 0 ? `TP ${trimNumber(takeProfitRr, 2)}R` : 'TP off';
}

function candidateLabel(row: TortilaRowDraft, rowIndex: number): string {
  const risk = numericDraft(row.riskPercent, 0.3);
  const stop = numericDraft(row.stopN, 2);
  const add = numericDraft(row.addStep, 1);
  const units = numericDraft(row.maxUnits, 4);
  const atr = numericDraft(row.atrPeriod, 20);
  const tp = numericDraft(row.takeProfitRr, 0);
  return `#${rowIndex + 1} ${effectiveSymbol(row)} ${row.timeframe} S${numericDraft(row.system, 2)} risk ${trimNumber(risk, 2)}% stop ${trimNumber(stop, 2)}N add ${trimNumber(add, 2)}N units ${units} ATR ${atr} ${tpLabel(tp)}`;
}

function strategyMapRows(rowDrafts: readonly TortilaRowDraft[]): TortilaStrategyMapRow[] {
  return [2, 1].map((system) => {
    const indexed = rowDrafts
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => effectiveSymbol(row) && numericDraft(row.system, 2) === system);
    if (indexed.length === 0) {
      return {
        bucket: systemLabel(system),
        candidates: [],
        riskShape: 'No draft coins',
        guardrails: 'No per-coin pyramid budget in this bucket.',
      };
    }
    const risks = indexed.map(({ row }) => numericDraft(row.riskPercent, 0.3));
    const stops = indexed.map(({ row }) => numericDraft(row.stopN, 2));
    const adds = indexed.map(({ row }) => numericDraft(row.addStep, 1));
    const units = indexed.reduce((sum, { row }) => sum + numericDraft(row.maxUnits, 4), 0);
    const fixedTp = indexed.filter(({ row }) => numericDraft(row.takeProfitRr, 0) > 0).length;
    const avg = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const avgRisk = avg(risks);
    return {
      bucket: systemLabel(system),
      candidates: indexed.map(({ row, index }) => candidateLabel(row, index)),
      riskShape: `${trimNumber(avgRisk, 2)}% avg risk, ${riskBand(Math.max(...risks))} max row`,
      guardrails: `${units} max draft units, ${trimNumber(avg(stops), 2)}N avg stop, ${trimNumber(avg(adds), 2)}N avg add, ${fixedTp}/${indexed.length} fixed TP`,
    };
  });
}

function portfolioCapRows(rowDrafts: readonly TortilaRowDraft[], caps: TortilaPortfolioCaps): TortilaPortfolioCapRow[] {
  const activeRows = activeDraftRows(rowDrafts);
  const maxOpenSymbols = capNumber(caps, 'maxOpenSymbols');
  const maxTotalUnits = capNumber(caps, 'maxTotalUnits');
  const maxUnitsPerDirection = capNumber(caps, 'maxUnitsPerDirection');
  const haltDrawdownPercent = capNumber(caps, 'haltDrawdownPercent');
  const dailyMaxLossPercent = capNumber(caps, 'dailyMaxLossPercent');
  const maxNewEntriesPerTick = capNumber(caps, 'maxNewEntriesPerTick');
  const totalDraftUnits = activeRows.reduce((sum, row) => sum + numericDraft(row.maxUnits, 4), 0);
  const largestRowUnits = activeRows.reduce((max, row) => Math.max(max, numericDraft(row.maxUnits, 4)), 0);
  const openStatus = comparableCapStatus(activeRows.length, maxOpenSymbols);
  const totalStatus = comparableCapStatus(totalDraftUnits, maxTotalUnits);
  const directionStatus = comparableCapStatus(largestRowUnits, maxUnitsPerDirection);

  return [
    {
      label: 'Max open symbols',
      reference: `${maxOpenSymbols} symbols`,
      draft: `${activeRows.length} draft coins`,
      ...openStatus,
    },
    {
      label: 'Max total units',
      reference: `${maxTotalUnits} units`,
      draft: `${totalDraftUnits} draft max units`,
      ...totalStatus,
    },
    {
      label: 'Units per direction',
      reference: `${maxUnitsPerDirection} units`,
      draft: `largest row ${largestRowUnits}`,
      ...directionStatus,
    },
    {
      label: 'Drawdown halt',
      reference: `${trimNumber(haltDrawdownPercent, 2)}%`,
      draft: 'WTC reference halt',
      status: 'saved reference',
      tone: 'neutral',
    },
    {
      label: 'Daily loss halt',
      reference: `${trimNumber(dailyMaxLossPercent, 2)}%`,
      draft: 'daily risk reference',
      status: 'saved reference',
      tone: 'neutral',
    },
    {
      label: 'Entries per tick',
      reference: `${maxNewEntriesPerTick} entries`,
      draft: 'fresh-entry throttle',
      status: 'saved reference',
      tone: 'neutral',
    },
  ];
}

export function TortilaSymbolConfigTable({
  rows,
  portfolioCaps,
  sourceLabel = 'WTC reference profile',
  sourceDetail = 'Each card is saved as WTC-side strategy intent. Nothing is pushed to a live bot from this table.',
  saveIssue,
}: {
  rows: readonly TortilaSymbolConfig[];
  portfolioCaps?: Partial<TortilaPortfolioCaps>;
  sourceLabel?: string;
  sourceDetail?: string;
  saveIssue?: BotConfigErrorCopy;
}) {
  const initialRowCount = Math.min(TORTILA_SYMBOL_ROW_LIMIT, Math.max(rows.length + 1, 5));
  const [rowDrafts, setRowDrafts] = useState<TortilaRowDraft[]>(() => (
    Array.from({ length: initialRowCount }, (_, i) => defaultRowDraft(rows, i))
  ));
  const [capDraft, setCapDraft] = useState<TortilaPortfolioCaps>(() => defaultPortfolioCaps(portfolioCaps));
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const activeRows = useMemo(() => activeDraftRows(rowDrafts), [rowDrafts]);
  const exportValue = useMemo(() => serializeTortilaSymbolConfigs(runtimeDraftRows(rowDrafts)), [rowDrafts]);
  const mapRows = useMemo(() => strategyMapRows(rowDrafts), [rowDrafts]);
  const portfolioRows = useMemo(() => portfolioCapRows(rowDrafts, capDraft), [rowDrafts, capDraft]);
  const options = symbolOptions(rows);
  const systemOne = activeRows.filter((row) => numericDraft(row.system, 2) === 1).length;
  const systemTwo = activeRows.filter((row) => numericDraft(row.system, 2) === 2).length;
  const avgDraftRisk = activeRows.length === 0
    ? '-'
    : `${(activeRows.reduce((sum, row) => sum + numericDraft(row.riskPercent, 0.3), 0) / activeRows.length).toFixed(2)}% avg risk`;
  const maxDraftUnits = activeRows.reduce((sum, row) => sum + numericDraft(row.maxUnits, 4), 0);
  const capSaveIssue = tortilaPortfolioCapIssue(saveIssue);
  const hasCapSaveIssue = !!capSaveIssue;
  const capIssueId = 'tortila-portfolio-caps-save-error';

  function updateRowDraft(index: number, patch: Partial<TortilaRowDraft>): void {
    setRowDrafts((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function updateCapDraft(name: TortilaPortfolioCapName, value: string): void {
    setCapDraft((current) => ({ ...current, [name]: value }));
  }

  function copyDraftExport(): void {
    if (!exportValue) {
      setCopyState('manual');
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setCopyState('manual');
      return;
    }
    void navigator.clipboard.writeText(exportValue)
      .then(() => setCopyState('copied'))
      .catch(() => setCopyState('manual'));
  }

  return (
    <div className="wtc-stack" style={{ gap: 16 }}>
      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Per-coin Tortila configuration</h3>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Choose a coin, Turtle system, risk, ATR stop, pyramid add step, unit cap, and TP reference. Each card saves a WTC-side profile only.
          </p>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Source: {sourceLabel}. {sourceDetail}
          </p>
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone="gold">{sourceLabel}</StatusPill>
          <StatusPill tone="ok">{activeRows.length} draft coins</StatusPill>
          <StatusPill tone="neutral">{systemTwo} S2</StatusPill>
          <StatusPill tone="neutral">{systemOne} S1</StatusPill>
          <StatusPill tone="neutral">{avgDraftRisk}</StatusPill>
          <StatusPill tone="neutral">{maxDraftUnits} max units</StatusPill>
        </div>
      </div>

      <section className="wtc-stack" style={{ gap: 10, border: '1px solid var(--stroke)', borderRadius: 8, padding: 14, background: 'rgba(255,255,255,0.025)' }}>
        <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Tortila strategy map</h3>
            <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.55 }}>
              Draft map groups visible coin rows by Turtle system and shows the risk and pyramid shape WTC will save.
            </p>
            <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.55 }}>
              Blank rows are ignored. Candidate labels show row number, symbol, timeframe, system, risk, stop, add step, max units, ATR, and TP before save.
            </p>
          </div>
          <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <StatusPill tone="neutral">draft preview</StatusPill>
            <StatusPill tone={portfolioRows.some((row) => row.tone === 'bad') ? 'bad' : 'ok'}>WTC reference caps</StatusPill>
            <StatusPill tone="bad">no live exchange apply</StatusPill>
          </div>
        </div>
        <section
          id="tortila-portfolio-caps"
          className="wtc-stack"
          aria-describedby={hasCapSaveIssue ? capIssueId : undefined}
          tabIndex={hasCapSaveIssue ? -1 : undefined}
          style={{ gap: 10, scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP }}
        >
          <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 14 }}>Portfolio caps</h4>
              <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.55 }}>
                Edit the reference-level limits that are saved with this coin map: open symbols, pyramid units, directional units, halt thresholds, and entry throttle.
              </p>
            </div>
            <StatusPill tone={hasCapSaveIssue ? 'bad' : 'neutral'}>{hasCapSaveIssue ? 'Portfolio cap issue' : 'saved with strategy profile'}</StatusPill>
          </div>
          {capSaveIssue && (
            <div
              id={capIssueId}
              role="alert"
              tabIndex={-1}
              style={{
                border: '1px solid rgba(255, 103, 103, 0.55)',
                borderRadius: 8,
                padding: 10,
                background: 'rgba(255, 103, 103, 0.06)',
              }}
            >
              <strong>{capSaveIssue.title}</strong>
              <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>{capSaveIssue.inlineHint ?? capSaveIssue.detail}</p>
            </div>
          )}
          <div className="wtc-grid wtc-grid-3">
            {TORTILA_CAP_INPUTS.map((cap) => {
              const hasInputIssue = capInputHasIssue(cap.name, capSaveIssue);
              return (
                <label key={cap.name} className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>{cap.label}</span>
                  <input
                    className="wtc-input"
                    name={cap.name}
                    type="number"
                    step={cap.step}
                    value={capDraft[cap.name]}
                    onChange={(event) => updateCapDraft(cap.name, event.target.value)}
                    aria-invalid={hasInputIssue || undefined}
                    aria-describedby={hasInputIssue ? capIssueId : undefined}
                  />
                  <span className="wtc-dim" style={{ fontSize: 11 }}>{cap.hint}</span>
                </label>
              );
            })}
          </div>
          <div className="wtc-table-wrap" aria-label="Tortila portfolio caps">
            <table className="wtc-table">
              <thead>
                <tr>
                  <th>Portfolio guardrail</th>
                  <th>Reference cap</th>
                  <th>Draft pressure</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {portfolioRows.map((row) => (
                  <tr key={row.label}>
                    <td data-label="Portfolio guardrail">{row.label}</td>
                    <td data-label="Reference cap">{row.reference}</td>
                    <td data-label="Draft pressure" className="wtc-dim">{row.draft}</td>
                    <td data-label="Status"><StatusPill tone={row.tone}>{row.status}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="wtc-dim" style={{ fontSize: 11, margin: 0 }}>
            These caps are WTC reference settings for the saved profile. They are not a live exchange position report and they do not apply to the running bot from this page.
          </p>
        </section>
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Turtle bucket</th>
                <th>Coin candidates</th>
                <th>Risk shape</th>
                <th>Position guardrails</th>
              </tr>
            </thead>
            <tbody>
              {mapRows.map((row) => (
                <tr key={row.bucket}>
                  <td data-label="Turtle bucket">{row.bucket}</td>
                  <td data-label="Coin candidates" className="wtc-dim">
                    {row.candidates.length > 0 ? row.candidates.join('; ') : 'No draft coins in this system'}
                  </td>
                  <td data-label="Risk shape">{row.riskShape}</td>
                  <td data-label="Position guardrails" className="wtc-dim">{row.guardrails}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wtc-dim" style={{ fontSize: 11, margin: 0 }}>
          Saving stores the coin rows and portfolio caps as one WTC reference profile only.
        </p>
      </section>

      <div className="wtc-stack" style={{ gap: 12 }}>
        {rowDrafts.map((draft, i) => {
          const selected = draft.symbol;
          const displaySymbol = effectiveSymbol(draft);
          const rowSaveIssue = saveIssue?.target === 'tortila-row' && saveIssue.row === i + 1 ? saveIssue : undefined;
          const hasSaveIssue = !!rowSaveIssue;
          const issueId = `tortila-symbol-${i + 1}-save-error`;
          return (
            <section
              key={i}
              id={`tortila-symbol-${i + 1}`}
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
                  <div className="wtc-kicker">slot {i + 1}</div>
                  <h4 style={{ margin: '3px 0 0', fontSize: 15 }}>{displaySymbol || 'New coin'}</h4>
                </div>
                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <StatusPill tone={displaySymbol ? 'ok' : 'neutral'}>{displaySymbol ? 'configured' : 'empty'}</StatusPill>
                  <StatusPill tone="neutral">{systemLabel(draft.system)}</StatusPill>
                  <StatusPill tone="neutral">{riskBand(numericDraft(draft.riskPercent, 0.3))} risk</StatusPill>
                </div>
              </div>

              <div className="wtc-grid wtc-grid-4">
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Coin</span>
                  <select
                    className="wtc-input"
                    name={`symbol_${i}`}
                    value={selected}
                    onChange={(event) => updateRowDraft(i, { symbol: event.target.value })}
                    aria-invalid={hasSaveIssue || undefined}
                    aria-describedby={hasSaveIssue ? issueId : undefined}
                  >
                    <option value="">Add coin...</option>
                    {options.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
                  </select>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Manual symbol override</span>
                  <input
                    className="wtc-input"
                    name={`symbol_custom_${i}`}
                    placeholder="DOGE/USDT:USDT"
                    value={draft.customSymbol}
                    onChange={(event) => updateRowDraft(i, { customSymbol: event.target.value })}
                    aria-invalid={hasSaveIssue || undefined}
                    aria-describedby={hasSaveIssue ? issueId : undefined}
                  />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Timeframe</span>
                  <select
                    className="wtc-input"
                    name={`tf_${i}`}
                    value={draft.timeframe}
                    onChange={(event) => updateRowDraft(i, { timeframe: event.target.value as TortilaSymbolConfig['timeframe'] })}
                    aria-invalid={hasSaveIssue || undefined}
                    aria-describedby={hasSaveIssue ? issueId : undefined}
                  >
                    {TF_OPTIONS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                  </select>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Turtle system</span>
                  <select
                    className="wtc-input"
                    name={`system_${i}`}
                    value={draft.system}
                    onChange={(event) => updateRowDraft(i, { system: event.target.value })}
                    aria-invalid={hasSaveIssue || undefined}
                    aria-describedby={hasSaveIssue ? issueId : undefined}
                  >
                    <option value="2">System 2 (55/20)</option>
                    <option value="1">System 1 (20/10)</option>
                  </select>
                </label>
              </div>

              <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Risk %</span>
                  <input className="wtc-input" name={`risk_${i}`} type="number" step="0.1" value={draft.riskPercent} onChange={(event) => updateRowDraft(i, { riskPercent: event.target.value })} aria-invalid={hasSaveIssue || undefined} aria-describedby={hasSaveIssue ? issueId : undefined} />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>ATR stop N</span>
                  <input className="wtc-input" name={`stop_${i}`} type="number" step="0.5" value={draft.stopN} onChange={(event) => updateRowDraft(i, { stopN: event.target.value })} aria-invalid={hasSaveIssue || undefined} aria-describedby={hasSaveIssue ? issueId : undefined} />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Add step N</span>
                  <input className="wtc-input" name={`add_${i}`} type="number" step="0.25" value={draft.addStep} onChange={(event) => updateRowDraft(i, { addStep: event.target.value })} aria-invalid={hasSaveIssue || undefined} aria-describedby={hasSaveIssue ? issueId : undefined} />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Max units</span>
                  <input className="wtc-input" name={`maxUnits_${i}`} type="number" step="1" value={draft.maxUnits} onChange={(event) => updateRowDraft(i, { maxUnits: event.target.value })} aria-invalid={hasSaveIssue || undefined} aria-describedby={hasSaveIssue ? issueId : undefined} />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>ATR period</span>
                  <input className="wtc-input" name={`atr_${i}`} type="number" step="1" value={draft.atrPeriod} onChange={(event) => updateRowDraft(i, { atrPeriod: event.target.value })} aria-invalid={hasSaveIssue || undefined} aria-describedby={hasSaveIssue ? issueId : undefined} />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>TP R</span>
                  <input className="wtc-input" name={`tp_${i}`} type="number" step="1" value={draft.takeProfitRr} onChange={(event) => updateRowDraft(i, { takeProfitRr: event.target.value })} aria-invalid={hasSaveIssue || undefined} aria-describedby={hasSaveIssue ? issueId : undefined} />
                </label>
              </div>

              <p className="wtc-dim" style={{ fontSize: 11, margin: '10px 0 0' }}>
                Export mapping: symbol@tf@system@risk@stop@add@max_units@atr@tp_rr. Risk is entered as percent and exported as runtime fraction.
              </p>
            </section>
          );
        })}
      </div>

      <details open>
        <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Runtime export preview (draft)</summary>
        <label className="wtc-stack" style={{ gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 13 }}>Generated SYMBOL_CONFIGS (draft)</span>
          <div
            className="wtc-input wtc-mono"
            aria-label="Generated SYMBOL_CONFIGS draft"
            style={{ minHeight: 92, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {exportValue || 'No draft coin rows'}
          </div>
          <span className="wtc-dim" style={{ fontSize: 11 }}>
            This preview reflects the visible draft rows in this form. Copy draft is for manual review only. Download config export uses the last saved WTC reference version. Nothing is pushed to the live bot by this page.
          </span>
        </label>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            className={buttonClasses('secondary')}
            type="button"
            onClick={copyDraftExport}
            data-copy-value={exportValue}
            disabled={!exportValue}
          >
            Copy draft SYMBOL_CONFIGS
          </button>
          <StatusPill tone={copyState === 'copied' ? 'ok' : copyState === 'manual' ? 'warn' : 'neutral'}>
            {copyState === 'copied' ? 'draft copied' : copyState === 'manual' ? 'copy manually' : 'manual review copy'}
          </StatusPill>
        </div>
      </details>
    </div>
  );
}
