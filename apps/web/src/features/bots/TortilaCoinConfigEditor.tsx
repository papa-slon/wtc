'use client';

import { useId, useMemo, useState } from 'react';
import { instrumentOptionsForBot } from '@wtc/shared';
import type { TortilaSymbolConfig } from './config-types';
import type { BotConfigErrorCopy } from './config-error-copy';

/*
 * Premium per-coin Tortila configuration editor (settings page only).
 *
 * This is a pure RENDER swap inside the existing `<form id="custom-settings"
 * action={saveBotConfigAction}>`. It posts the EXACT same input `name`
 * attributes the server action parses (see config.ts → tortilaSymbolConfigsFromForm
 * + botConfigFirstFormIssue), so the save contract is byte-compatible:
 *
 *   per coin, index i in 0..7:
 *     symbol_{i}          (visible coin combobox; supports a typed CCXT symbol)
 *     symbol_custom_{i}   (hidden empty string — folded into the one coin field;
 *                          server resolves effectiveSymbol = custom || selected,
 *                          so an empty custom means the typed symbol_{i} wins)
 *     tf_{i} system_{i} risk_{i} stop_{i} add_{i} maxUnits_{i} atr_{i} tp_{i}
 *   portfolio caps (top-level names):
 *     maxOpenSymbols maxTotalUnits maxUnitsPerDirection
 *     haltDrawdownPercent dailyMaxLossPercent maxNewEntriesPerTick
 *
 * No strategy map, no draft-pressure table, no copy-SYMBOL_CONFIGS widget, no
 * per-field status pills. Just clean coin cards + a collapsed caps group.
 */

const TF_OPTIONS = ['4h', '1h'] as const;
const TORTILA_SYMBOL_ROW_LIMIT = 8;
const ISSUE_SCROLL_MARGIN_TOP = 96;

const TORTILA_CAP_INPUTS = [
  { name: 'maxOpenSymbols', label: 'Max open symbols', min: '1', max: '20', step: '1', hint: 'How many coins may be open at once (1-20).' },
  { name: 'maxTotalUnits', label: 'Max total units', min: '1', max: '50', step: '1', hint: 'Pyramid unit cap across the whole portfolio (1-50).' },
  { name: 'maxUnitsPerDirection', label: 'Units per direction', min: '1', max: '30', step: '1', hint: 'Directional pyramid cap (1-30).' },
  { name: 'haltDrawdownPercent', label: 'Drawdown halt %', min: '1', max: '95', step: '1', hint: 'Portfolio drawdown halt threshold (1-95).' },
  { name: 'dailyMaxLossPercent', label: 'Daily loss halt %', min: '0.5', max: '50', step: '0.5', hint: 'Daily risk halt threshold (0.5-50).' },
  { name: 'maxNewEntriesPerTick', label: 'Entries per tick', min: '1', max: '20', step: '1', hint: 'Fresh-entry throttle per scheduler tick (1-20).' },
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

const TORTILA_CAP_ISSUE_INPUTS: Record<string, readonly TortilaPortfolioCapName[]> = {
  'tortila-portfolio-limit': ['maxOpenSymbols', 'maxTotalUnits', 'maxUnitsPerDirection'],
  'tortila-risk-limit': ['haltDrawdownPercent', 'dailyMaxLossPercent'],
  'tortila-entry-throttle': ['maxNewEntriesPerTick'],
};

interface CoinSlot {
  /** Stable form index 0..7 — drives the `name` attribute suffix. */
  index: number;
  symbol: string;
  timeframe: TortilaSymbolConfig['timeframe'];
  system: string;
  riskPercent: string;
  stopN: string;
  addStep: string;
  maxUnits: string;
  atrPeriod: string;
  takeProfitRr: string;
}

function slotFromConfig(row: TortilaSymbolConfig | undefined, index: number): CoinSlot {
  return {
    index,
    symbol: row?.symbol ?? '',
    timeframe: row?.timeframe ?? '4h',
    system: String(row?.system ?? 2),
    riskPercent: String(row?.riskPercent ?? 0.3),
    stopN: String(row?.stopN ?? 2),
    addStep: String(row?.addStep ?? 1),
    maxUnits: String(row?.maxUnits ?? 4),
    atrPeriod: String(row?.atrPeriod ?? 20),
    takeProfitRr: String(row?.takeProfitRr ?? 0),
  };
}

function emptySlot(index: number): CoinSlot {
  return slotFromConfig(undefined, index);
}

function numericDraft(value: string, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function riskBand(riskPercent: number): 'low' | 'standard' | 'elevated' {
  if (riskPercent < 0.25) return 'low';
  if (riskPercent <= 0.75) return 'standard';
  return 'elevated';
}

function shortSymbol(s: string): string {
  return s.split(':')[0] ?? s;
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

export function TortilaCoinConfigEditor({
  rows,
  portfolioCaps,
  canCustomize = true,
  saveIssue,
}: {
  rows: readonly TortilaSymbolConfig[];
  portfolioCaps?: Partial<TortilaPortfolioCaps>;
  canCustomize?: boolean;
  saveIssue?: BotConfigErrorCopy;
}) {
  // One slot per configured coin (at least one card so the page is never empty).
  const [slots, setSlots] = useState<CoinSlot[]>(() => {
    const configured = rows.slice(0, TORTILA_SYMBOL_ROW_LIMIT).map((row, i) => slotFromConfig(row, i));
    return configured.length > 0 ? configured : [emptySlot(0)];
  });
  const [capDraft, setCapDraft] = useState<TortilaPortfolioCaps>(() => defaultPortfolioCaps(portfolioCaps));
  const [capsOpen, setCapsOpen] = useState(false);
  const datalistId = useId();

  const options = useMemo(
    () => instrumentOptionsForBot('tortila_bot', rows.map((row) => row.symbol).filter(Boolean)),
    [rows],
  );

  const nextFreeIndex = useMemo(() => {
    const used = new Set(slots.map((s) => s.index));
    for (let i = 0; i < TORTILA_SYMBOL_ROW_LIMIT; i += 1) if (!used.has(i)) return i;
    return -1;
  }, [slots]);
  const atLimit = slots.length >= TORTILA_SYMBOL_ROW_LIMIT || nextFreeIndex === -1;

  const capIssueId = 'tortila-portfolio-caps-save-error';
  const capSaveIssue = saveIssue?.target === 'tortila-cap' ? saveIssue : undefined;

  function updateSlot(index: number, patch: Partial<CoinSlot>): void {
    setSlots((current) => current.map((s) => (s.index === index ? { ...s, ...patch } : s)));
  }
  function addCoin(): void {
    if (atLimit) return;
    setSlots((current) => [...current, emptySlot(nextFreeIndex)]);
  }
  function removeCoin(index: number): void {
    setSlots((current) => (current.length <= 1 ? current : current.filter((s) => s.index !== index)));
  }
  function updateCap(name: TortilaPortfolioCapName, value: string): void {
    setCapDraft((current) => ({ ...current, [name]: value }));
  }

  return (
    <div className="tset-root">
      <div className="tset-toolbar">
        <div>
          <div className="tset-toolbar-title">Your coins</div>
          <p className="tset-toolbar-sub">
            One card per coin. Pick a coin, set its Turtle system, risk and stop, then save. Saving stores a versioned
            profile on your account — nothing is pushed to a live exchange.
          </p>
        </div>
        <button
          type="button"
          className="tset-add-btn"
          onClick={addCoin}
          disabled={atLimit || !canCustomize}
          title={atLimit ? 'Maximum 8 coins' : 'Add a coin to the portfolio'}
        >
          + Add coin
        </button>
      </div>

      {atLimit && <p className="tset-note">Maximum 8 coins reached. Remove one to add another.</p>}

      {/* Shared catalog datalist for every coin combobox. */}
      <datalist id={datalistId}>
        {options.map((o) => (
          <option key={o.symbol} value={o.symbol} label={`${o.venue} - ${o.format}${o.source === 'runtime' ? ' - runtime' : ''}`} />
        ))}
      </datalist>

      <div className="tset-coin-grid">
        {slots.map((slot) => {
          const i = slot.index;
          const rowSaveIssue = saveIssue?.target === 'tortila-row' && saveIssue.row === i + 1 ? saveIssue : undefined;
          const hasIssue = !!rowSaveIssue;
          const issueId = `tortila-symbol-${i + 1}-save-error`;
          const sys = numericDraft(slot.system, 2);
          const band = riskBand(numericDraft(slot.riskPercent, 0.3));
          const tpVal = numericDraft(slot.takeProfitRr, 0);
          return (
            <section
              key={i}
              id={`tortila-symbol-${i + 1}`}
              className={`tset-coin-card${hasIssue ? ' tset-coin-card-error' : ''}`}
              aria-describedby={hasIssue ? issueId : undefined}
              tabIndex={hasIssue ? -1 : undefined}
              style={{ scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP }}
            >
              {/* Hidden field that folds the legacy "manual override" into the
                  single coin combobox without breaking the save contract. */}
              <input type="hidden" name={`symbol_custom_${i}`} value="" />

              <header className="tset-coin-head">
                <div className="tset-coin-id">
                  <span className="tset-coin-sym">{shortSymbol(slot.symbol) || 'New coin'}</span>
                  <span className={`tset-sys-chip s${sys}`}>System {sys}</span>
                </div>
                <button
                  type="button"
                  className="tset-remove-btn"
                  onClick={() => removeCoin(i)}
                  disabled={slots.length <= 1}
                  aria-label={`Remove ${shortSymbol(slot.symbol) || 'coin'}`}
                  title="Remove coin"
                >
                  ×
                </button>
              </header>

              {rowSaveIssue && (
                <div id={issueId} role="alert" tabIndex={-1} className="tset-inline-error">
                  <strong>{rowSaveIssue.title}</strong>
                  <p>{rowSaveIssue.inlineHint ?? rowSaveIssue.detail}</p>
                </div>
              )}

              <label className="tset-field tset-field-wide">
                <span className="tset-label">Coin</span>
                <input
                  className="tset-input"
                  list={datalistId}
                  name={`symbol_${i}`}
                  value={slot.symbol}
                  placeholder="XRP/USDT:USDT"
                  autoComplete="off"
                  aria-invalid={hasIssue || undefined}
                  aria-describedby={hasIssue ? issueId : undefined}
                  onChange={(e) => updateSlot(i, { symbol: e.target.value })}
                />
                <span className="tset-hint">Search the BingX swap catalog or type any CCXT swap symbol.</span>
              </label>

              <div className="tset-field-grid">
                <label className="tset-field">
                  <span className="tset-label">Timeframe</span>
                  <div className="tset-seg" role="group" aria-label="Timeframe">
                    {TF_OPTIONS.map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        className={`tset-seg-btn${slot.timeframe === tf ? ' active' : ''}`}
                        aria-pressed={slot.timeframe === tf}
                        onClick={() => updateSlot(i, { timeframe: tf })}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                  {/* The segmented control writes the real select value. */}
                  <select
                    className="tset-visually-hidden"
                    name={`tf_${i}`}
                    value={slot.timeframe}
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={(e) => updateSlot(i, { timeframe: e.target.value as TortilaSymbolConfig['timeframe'] })}
                  >
                    {TF_OPTIONS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                  </select>
                </label>

                <label className="tset-field">
                  <span className="tset-label">Turtle system</span>
                  <select
                    className="tset-input"
                    name={`system_${i}`}
                    value={slot.system}
                    aria-invalid={hasIssue || undefined}
                    aria-describedby={hasIssue ? issueId : undefined}
                    onChange={(e) => updateSlot(i, { system: e.target.value })}
                  >
                    <option value="2">System 2 (55/20)</option>
                    <option value="1">System 1 (20/10)</option>
                  </select>
                  <span className="tset-hint">{sys === 2 ? 'Slower, fewer false breakouts.' : 'Faster, more entries.'}</span>
                </label>

                <label className="tset-field">
                  <span className="tset-label">Risk %</span>
                  <input
                    className="tset-input tset-mono"
                    name={`risk_${i}`}
                    type="number"
                    min="0.1"
                    max="3"
                    step="0.1"
                    inputMode="decimal"
                    value={slot.riskPercent}
                    aria-invalid={hasIssue || undefined}
                    aria-describedby={hasIssue ? issueId : undefined}
                    onChange={(e) => updateSlot(i, { riskPercent: e.target.value })}
                  />
                  <span className={`tset-band tset-band-${band}`}>{band} risk</span>
                </label>

                <label className="tset-field">
                  <span className="tset-label">ATR stop (N)</span>
                  <input
                    className="tset-input tset-mono"
                    name={`stop_${i}`}
                    type="number"
                    min="1"
                    max="4"
                    step="0.5"
                    inputMode="decimal"
                    value={slot.stopN}
                    aria-invalid={hasIssue || undefined}
                    aria-describedby={hasIssue ? issueId : undefined}
                    onChange={(e) => updateSlot(i, { stopN: e.target.value })}
                  />
                  <span className="tset-hint">Stop distance in ATR multiples (1-4).</span>
                </label>

                <label className="tset-field">
                  <span className="tset-label">Add step (N)</span>
                  <input
                    className="tset-input tset-mono"
                    name={`add_${i}`}
                    type="number"
                    min="0.25"
                    max="2"
                    step="0.25"
                    inputMode="decimal"
                    value={slot.addStep}
                    aria-invalid={hasIssue || undefined}
                    aria-describedby={hasIssue ? issueId : undefined}
                    onChange={(e) => updateSlot(i, { addStep: e.target.value })}
                  />
                  <span className="tset-hint">Pyramid add distance (0.25-2).</span>
                </label>

                <label className="tset-field">
                  <span className="tset-label">Max units</span>
                  <input
                    className="tset-input tset-mono"
                    name={`maxUnits_${i}`}
                    type="number"
                    min="1"
                    max="4"
                    step="1"
                    inputMode="numeric"
                    value={slot.maxUnits}
                    aria-invalid={hasIssue || undefined}
                    aria-describedby={hasIssue ? issueId : undefined}
                    onChange={(e) => updateSlot(i, { maxUnits: e.target.value })}
                  />
                  <span className="tset-hint">Pyramid cap (1-4).</span>
                </label>

                <label className="tset-field">
                  <span className="tset-label">ATR period</span>
                  <input
                    className="tset-input tset-mono"
                    name={`atr_${i}`}
                    type="number"
                    min="10"
                    max="30"
                    step="1"
                    inputMode="numeric"
                    value={slot.atrPeriod}
                    aria-invalid={hasIssue || undefined}
                    aria-describedby={hasIssue ? issueId : undefined}
                    onChange={(e) => updateSlot(i, { atrPeriod: e.target.value })}
                  />
                  <span className="tset-hint">Wilder ATR lookback (10-30).</span>
                </label>

                <label className="tset-field">
                  <span className="tset-label">Take-profit (R)</span>
                  <input
                    className="tset-input tset-mono"
                    name={`tp_${i}`}
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    inputMode="numeric"
                    value={slot.takeProfitRr}
                    aria-invalid={hasIssue || undefined}
                    aria-describedby={hasIssue ? issueId : undefined}
                    onChange={(e) => updateSlot(i, { takeProfitRr: e.target.value })}
                  />
                  <span className="tset-hint">{tpVal > 0 ? `Fixed TP at ${tpVal}R.` : '0 = TP off (let the stop trail).'}</span>
                </label>
              </div>
            </section>
          );
        })}
      </div>

      {/* Collapsed portfolio caps. Force-open when a cap save error is present so
          the offending field is reachable. */}
      <details className="tset-caps" open={capsOpen || !!capSaveIssue}>
        <summary
          className="tset-caps-summary"
          onClick={(e) => { e.preventDefault(); setCapsOpen((o) => !o); }}
        >
          <span>Portfolio caps</span>
          <span className="tset-caps-hint">global limits across all coins</span>
        </summary>
        <div
          id="tortila-portfolio-caps"
          className="tset-caps-body"
          aria-describedby={capSaveIssue ? capIssueId : undefined}
          tabIndex={capSaveIssue ? -1 : undefined}
          style={{ scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP }}
        >
          {capSaveIssue && (
            <div id={capIssueId} role="alert" tabIndex={-1} className="tset-inline-error">
              <strong>{capSaveIssue.title}</strong>
              <p>{capSaveIssue.inlineHint ?? capSaveIssue.detail}</p>
            </div>
          )}
          <div className="tset-field-grid">
            {TORTILA_CAP_INPUTS.map((cap) => {
              const inputHasIssue = !!capSaveIssue && (TORTILA_CAP_ISSUE_INPUTS[capSaveIssue.code] ?? []).includes(cap.name);
              return (
                <label key={cap.name} className="tset-field">
                  <span className="tset-label">{cap.label}</span>
                  <input
                    className="tset-input tset-mono"
                    name={cap.name}
                    type="number"
                    min={cap.min}
                    max={cap.max}
                    step={cap.step}
                    inputMode={cap.step === '0.5' ? 'decimal' : 'numeric'}
                    value={capDraft[cap.name]}
                    aria-invalid={inputHasIssue || undefined}
                    aria-describedby={inputHasIssue ? capIssueId : undefined}
                    onChange={(e) => updateCap(cap.name, e.target.value)}
                  />
                  <span className="tset-hint">{cap.hint}</span>
                </label>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
