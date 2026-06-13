'use client';

import { useId, useMemo, useState } from 'react';
import { instrumentOptionsForBot } from '@wtc/shared';
import type { LegacyRuntimeSymbolConfig, LegacyStageConfig, LegacySymbolConfig } from './config-types';
import type { BotConfigErrorCopy } from './config-error-copy';

/*
 * Premium per-coin Legacy (RSI/CCI + DCA/averaging + "Tetris" stage) editor.
 *
 * Pure RENDER swap inside the existing `<form id="custom-settings"
 * action={saveBotConfigAction}>` — it posts the EXACT same input `name`
 * attributes the server action parses (config.ts → legacySymbolConfigsFromForm /
 * legacyStageConfigsFromForm), so the save contract is byte-compatible:
 *
 *   per coin, index i in 0..13:
 *     legacy_symbol_{i}        (visible coin combobox)
 *     legacy_symbol_custom_{i} (hidden empty — folded into the one coin field)
 *     legacy_active_{i} legacy_tf_{i} legacy_signal_{i}
 *     legacy_rsi_len_{i} legacy_rsi_thr_{i} legacy_cci_len_{i} legacy_cci_thr_{i}
 *       ^ BOTH trigger pairs are ALWAYS submitted (the inactive one as hidden
 *         mirror inputs) — the Zod row schema validates both regardless of which
 *         trigger is selected, so dropping the inactive pair fails the parse.
 *     legacy_stage_{i} legacy_tp_{i}
 *     legacy_entry_{i} legacy_balance_{i} legacy_lev_{i} legacy_levels_{i}
 *     legacy_drops_{i} legacy_volumes_{i}
 *     legacy_delay_on_{i} legacy_delay_bars_{i} legacy_delta_on_{i} legacy_delta_{i}
 *   per stage, index i in 0..3:
 *     legacy_stage_slot_{i} legacy_stage_rsi_{i} legacy_stage_cci_{i}
 *
 * No trigger-resolution map, no candidate-label strings, no pill walls, no
 * separate "manual symbol override", no repeated disclaimers. Just clean coin
 * cards + a collapsed stage-capacity group with one quiet usage readout.
 * FEATURE_LIVE_BOT_CONTROL=false: nothing here applies to the live bot.
 */

const TF_OPTIONS: LegacySymbolConfig['timeframe'][] = ['1m', '3m', '5m', '15m', '1h'];
const LEGACY_SYMBOL_ROW_LIMIT = 14;
const LEGACY_STAGE_ROW_LIMIT = 4;
const ISSUE_SCROLL_MARGIN_TOP = 96;

type LegacySignal = 'rsi' | 'cci';

interface CoinSlot {
  index: number;
  symbol: string;
  active: 'true' | 'false';
  timeframe: LegacySymbolConfig['timeframe'];
  signal: LegacySignal;
  rsiLength: string;
  rsiThreshold: string;
  cciLength: string;
  cciThreshold: string;
  stage: string;
  takeProfitPercent: string;
  initialEntryPercent: string;
  useBalancePercent: string;
  leverage: string;
  averagingLevels: string;
  averagingPercents: string;
  averagingVolumePercents: string;
  useDelayFilter: 'true' | 'false';
  delayBars: string;
  useDeltaFilter: 'true' | 'false';
  deltaFilter: string;
}

interface StageSlot {
  index: number;
  stage: string;
  rsiSlots: string;
  cciSlots: string;
}

function slotFromConfig(row: LegacyRuntimeSymbolConfig | undefined, index: number): CoinSlot {
  return {
    index,
    symbol: row?.symbol ?? '',
    active: row ? (row.active === false ? 'false' : 'true') : 'true',
    timeframe: row?.timeframe ?? '3m',
    signal: row ? (row.useCci && !row.useRsi ? 'cci' : 'rsi') : 'rsi',
    rsiLength: String(row?.rsiLength ?? 14),
    rsiThreshold: String(row?.rsiThreshold ?? 20),
    cciLength: String(row?.cciLength ?? 14),
    cciThreshold: String(row?.cciThreshold ?? -300),
    stage: String(row?.stage ?? 1),
    takeProfitPercent: String(row?.takeProfitPercent ?? 0.5),
    initialEntryPercent: String(row?.initialEntryPercent ?? 100),
    useBalancePercent: String(row?.useBalancePercent ?? 1.5),
    leverage: String(row?.leverage ?? 2),
    averagingLevels: String(row?.averagingLevels ?? 3),
    averagingPercents: row?.averagingPercents ?? '3,12,35',
    averagingVolumePercents: row?.averagingVolumePercents ?? '4,6,12',
    useDelayFilter: row?.useDelayFilter ? 'true' : 'false',
    delayBars: String(row?.delayBars ?? 1),
    useDeltaFilter: row?.useDeltaFilter ? 'true' : 'false',
    deltaFilter: String(row?.deltaFilter ?? 0),
  };
}

function stageFromConfig(row: LegacyStageConfig | undefined, index: number): StageSlot {
  const stage = row?.stage != null ? String(row.stage) : index < 2 ? String(index + 1) : '';
  const rsiSlots = row?.rsiSlots ?? (index === 0 ? 3 : index === 1 ? 2 : 0);
  const cciSlots = row?.cciSlots ?? (index === 0 ? 2 : index === 1 ? 1 : 0);
  return { index, stage, rsiSlots: String(rsiSlots), cciSlots: String(cciSlots) };
}

function emptySlot(index: number): CoinSlot {
  return slotFromConfig(undefined, index);
}

function shortSymbol(s: string): string {
  return s.split(':')[0] ?? s;
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Segmented control that writes a visually-hidden <select> carrying the real
 *  form value (premium look, accessible, byte-compatible name). */
function Segmented<T extends string>({
  label, name, value, options, onChange, hint,
}: {
  label: string;
  name: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <label className="tset-field">
      <span className="tset-label">{label}</span>
      <div className="tset-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`tset-seg-btn${value === o.value ? ' active' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <select
        className="tset-visually-hidden"
        name={name}
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && <span className="tset-hint">{hint}</span>}
    </label>
  );
}

export function LegacyAveragingConfigEditor({
  rows,
  stages,
  canCustomize = true,
  saveIssue,
}: {
  rows: readonly LegacyRuntimeSymbolConfig[];
  stages: readonly LegacyStageConfig[];
  canCustomize?: boolean;
  saveIssue?: BotConfigErrorCopy;
}) {
  const [slots, setSlots] = useState<CoinSlot[]>(() => {
    const configured = rows.slice(0, LEGACY_SYMBOL_ROW_LIMIT).map((row, i) => slotFromConfig(row, i));
    return configured.length > 0 ? configured : [emptySlot(0)];
  });
  // Stage capacity is a fixed 4-row "Tetris" model — always rendered (the parse
  // reads legacy_stage_slot_0..3), so these stay a fixed array, not add/remove.
  const [stageSlots, setStageSlots] = useState<StageSlot[]>(() =>
    Array.from({ length: LEGACY_STAGE_ROW_LIMIT }, (_, i) => stageFromConfig(stages[i], i)),
  );
  const [capsOpen, setCapsOpen] = useState(false);
  const datalistId = useId();

  const options = useMemo(
    () => instrumentOptionsForBot('legacy_bot', rows.map((row) => row.symbol).filter(Boolean)),
    [rows],
  );

  const nextFreeIndex = useMemo(() => {
    const used = new Set(slots.map((s) => s.index));
    for (let i = 0; i < LEGACY_SYMBOL_ROW_LIMIT; i += 1) if (!used.has(i)) return i;
    return -1;
  }, [slots]);
  const atLimit = slots.length >= LEGACY_SYMBOL_ROW_LIMIT || nextFreeIndex === -1;
  const activeCount = slots.filter((s) => s.symbol && s.active === 'true').length;

  // Per-stage usage: how many active coins consume each stage's RSI / CCI bucket.
  const stageUsage = useMemo(() => {
    const usage = new Map<number, { rsi: number; cci: number }>();
    for (const s of slots) {
      if (!s.symbol || s.active !== 'true') continue;
      const stage = num(s.stage);
      const cur = usage.get(stage) ?? { rsi: 0, cci: 0 };
      cur[s.signal] += 1;
      usage.set(stage, cur);
    }
    return usage;
  }, [slots]);

  const stageCapsIssue = saveIssue?.target === 'legacy-stage' ? saveIssue : undefined;

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
  function updateStage(index: number, patch: Partial<StageSlot>): void {
    setStageSlots((current) => current.map((s) => (s.index === index ? { ...s, ...patch } : s)));
  }

  return (
    <div className="tset-root">
      <div className="tset-toolbar">
        <div>
          <div className="tset-toolbar-title">Your coins</div>
          <p className="tset-toolbar-sub">
            One card per coin. Each coin uses one trigger — RSI or CCI — and consumes a slot in its stage bucket. Set the
            trigger, stage, take-profit and averaging ladder, then save. Saving stores a versioned profile on your account —
            nothing is pushed to a live exchange or bot.
          </p>
        </div>
        <div className="wtc-row" style={{ gap: 10, alignItems: 'center' }}>
          <span className="tset-note" style={{ margin: 0 }}>{activeCount} active coin{activeCount === 1 ? '' : 's'}</span>
          <button
            type="button"
            className="tset-add-btn"
            onClick={addCoin}
            disabled={atLimit || !canCustomize}
            title={atLimit ? 'Maximum 14 coins' : 'Add a coin to the portfolio'}
          >
            + Add coin
          </button>
        </div>
      </div>

      {atLimit && <p className="tset-note">Maximum 14 coins reached. Remove one to add another.</p>}

      <datalist id={datalistId}>
        {options.map((o) => (
          <option key={o.symbol} value={o.symbol} label={`${o.venue} - ${o.format}${o.source === 'runtime' ? ' - runtime' : ''}`} />
        ))}
      </datalist>

      <div className="tset-coin-grid">
        {slots.map((slot) => {
          const i = slot.index;
          const rowSaveIssue = saveIssue?.target === 'legacy-row' && saveIssue.row === i + 1 ? saveIssue : undefined;
          const hasIssue = !!rowSaveIssue;
          const issueId = `legacy-symbol-${i + 1}-save-error`;
          const errAttrs = hasIssue ? { 'aria-invalid': true as const, 'aria-describedby': issueId } : {};
          const isRsi = slot.signal === 'rsi';
          return (
            <section
              key={i}
              id={`legacy-symbol-${i + 1}`}
              className={`tset-coin-card${hasIssue ? ' tset-coin-card-error' : ''}`}
              aria-describedby={hasIssue ? issueId : undefined}
              tabIndex={hasIssue ? -1 : undefined}
              style={{ scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP }}
            >
              {/* Fold the legacy "manual override" into the single coin field. */}
              <input type="hidden" name={`legacy_symbol_custom_${i}`} value="" />

              <header className="tset-coin-head">
                <div className="tset-coin-id">
                  <span className="tset-coin-sym">{shortSymbol(slot.symbol) || 'New coin'}</span>
                  <span className="tset-sys-chip">Stage {slot.stage || '1'} · {slot.signal.toUpperCase()}</span>
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
                  name={`legacy_symbol_${i}`}
                  value={slot.symbol}
                  placeholder="AAVE-USDT"
                  autoComplete="off"
                  {...errAttrs}
                  onChange={(e) => updateSlot(i, { symbol: e.target.value })}
                />
                <span className="tset-hint">Search the Legacy/BingX catalog or type a dash-format symbol.</span>
              </label>

              <div className="tset-field-grid">
                <Segmented
                  label="Status"
                  name={`legacy_active_${i}`}
                  value={slot.active}
                  options={[{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Paused' }]}
                  onChange={(v) => updateSlot(i, { active: v })}
                />
                <Segmented
                  label="Timeframe"
                  name={`legacy_tf_${i}`}
                  value={slot.timeframe}
                  options={TF_OPTIONS.map((tf) => ({ value: tf, label: tf }))}
                  onChange={(v) => updateSlot(i, { timeframe: v })}
                />
                <Segmented
                  label="Trigger"
                  name={`legacy_signal_${i}`}
                  value={slot.signal}
                  options={[{ value: 'rsi', label: 'RSI' }, { value: 'cci', label: 'CCI' }]}
                  onChange={(v) => updateSlot(i, { signal: v })}
                  hint="One trigger per coin."
                />

                {isRsi ? (
                  <>
                    <label className="tset-field">
                      <span className="tset-label">RSI length</span>
                      <input className="tset-input tset-mono" name={`legacy_rsi_len_${i}`} type="number" step="1" inputMode="numeric" value={slot.rsiLength} {...errAttrs} onChange={(e) => updateSlot(i, { rsiLength: e.target.value })} />
                      <span className="tset-hint">Lookback candles (2-100).</span>
                    </label>
                    <label className="tset-field">
                      <span className="tset-label">RSI threshold</span>
                      <input className="tset-input tset-mono" name={`legacy_rsi_thr_${i}`} type="number" step="1" inputMode="numeric" value={slot.rsiThreshold} {...errAttrs} onChange={(e) => updateSlot(i, { rsiThreshold: e.target.value })} />
                      <span className="tset-hint">Lower is stricter (1-100).</span>
                    </label>
                    {/* Inactive trigger pair — submitted as hidden mirror inputs. */}
                    <input type="hidden" name={`legacy_cci_len_${i}`} value={slot.cciLength} />
                    <input type="hidden" name={`legacy_cci_thr_${i}`} value={slot.cciThreshold} />
                  </>
                ) : (
                  <>
                    <label className="tset-field">
                      <span className="tset-label">CCI length</span>
                      <input className="tset-input tset-mono" name={`legacy_cci_len_${i}`} type="number" step="1" inputMode="numeric" value={slot.cciLength} {...errAttrs} onChange={(e) => updateSlot(i, { cciLength: e.target.value })} />
                      <span className="tset-hint">Lookback candles (2-100).</span>
                    </label>
                    <label className="tset-field">
                      <span className="tset-label">CCI threshold</span>
                      <input className="tset-input tset-mono" name={`legacy_cci_thr_${i}`} type="number" step="1" inputMode="numeric" value={slot.cciThreshold} {...errAttrs} onChange={(e) => updateSlot(i, { cciThreshold: e.target.value })} />
                      <span className="tset-hint">Usually negative for oversold entries (-500 to 500).</span>
                    </label>
                    {/* Inactive trigger pair — submitted as hidden mirror inputs. */}
                    <input type="hidden" name={`legacy_rsi_len_${i}`} value={slot.rsiLength} />
                    <input type="hidden" name={`legacy_rsi_thr_${i}`} value={slot.rsiThreshold} />
                  </>
                )}

                <label className="tset-field">
                  <span className="tset-label">Stage slot group</span>
                  <input className="tset-input tset-mono" name={`legacy_stage_${i}`} type="number" step="1" inputMode="numeric" value={slot.stage} {...errAttrs} onChange={(e) => updateSlot(i, { stage: e.target.value })} />
                  <span className="tset-hint">Consumes one {slot.signal.toUpperCase()} slot in this stage.</span>
                </label>

                <label className="tset-field">
                  <span className="tset-label">Take-profit %</span>
                  <input className="tset-input tset-mono" name={`legacy_tp_${i}`} type="number" step="0.05" inputMode="decimal" value={slot.takeProfitPercent} {...errAttrs} onChange={(e) => updateSlot(i, { takeProfitPercent: e.target.value })} />
                  <span className="tset-hint">Fixed take-profit. This bot uses no stop-loss.</span>
                </label>
              </div>

              <details className="tset-coin-adv">
                <summary>Position sizing &amp; averaging ladder</summary>
                <div className="tset-field-grid">
                  <label className="tset-field">
                    <span className="tset-label">Initial entry %</span>
                    <input className="tset-input tset-mono" name={`legacy_entry_${i}`} type="number" step="0.1" inputMode="decimal" value={slot.initialEntryPercent} onChange={(e) => updateSlot(i, { initialEntryPercent: e.target.value })} />
                  </label>
                  <label className="tset-field">
                    <span className="tset-label">Balance %</span>
                    <input className="tset-input tset-mono" name={`legacy_balance_${i}`} type="number" step="0.1" inputMode="decimal" value={slot.useBalancePercent} onChange={(e) => updateSlot(i, { useBalancePercent: e.target.value })} />
                  </label>
                  <label className="tset-field">
                    <span className="tset-label">Leverage</span>
                    <input className="tset-input tset-mono" name={`legacy_lev_${i}`} type="number" step="1" inputMode="numeric" value={slot.leverage} onChange={(e) => updateSlot(i, { leverage: e.target.value })} />
                  </label>
                  <label className="tset-field">
                    <span className="tset-label">Averaging levels</span>
                    <input className="tset-input tset-mono" name={`legacy_levels_${i}`} type="number" step="1" inputMode="numeric" value={slot.averagingLevels} onChange={(e) => updateSlot(i, { averagingLevels: e.target.value })} />
                    <span className="tset-hint">DCA depth cap — drives the "how stuck" stat.</span>
                  </label>
                  <label className="tset-field">
                    <span className="tset-label">Drop ladder %</span>
                    <input className="tset-input" name={`legacy_drops_${i}`} value={slot.averagingPercents} onChange={(e) => updateSlot(i, { averagingPercents: e.target.value })} />
                    <span className="tset-hint">Comma list, e.g. 3,12,35.</span>
                  </label>
                  <label className="tset-field">
                    <span className="tset-label">Volume ladder %</span>
                    <input className="tset-input" name={`legacy_volumes_${i}`} value={slot.averagingVolumePercents} onChange={(e) => updateSlot(i, { averagingVolumePercents: e.target.value })} />
                    <span className="tset-hint">Comma list, e.g. 4,6,12.</span>
                  </label>
                  <Segmented
                    label="Delay filter"
                    name={`legacy_delay_on_${i}`}
                    value={slot.useDelayFilter}
                    options={[{ value: 'false', label: 'Off' }, { value: 'true', label: 'On' }]}
                    onChange={(v) => updateSlot(i, { useDelayFilter: v })}
                  />
                  <label className="tset-field">
                    <span className="tset-label">Delay bars</span>
                    <input className="tset-input tset-mono" name={`legacy_delay_bars_${i}`} type="number" step="1" inputMode="numeric" value={slot.delayBars} onChange={(e) => updateSlot(i, { delayBars: e.target.value })} />
                  </label>
                  <Segmented
                    label="Delta filter"
                    name={`legacy_delta_on_${i}`}
                    value={slot.useDeltaFilter}
                    options={[{ value: 'false', label: 'Off' }, { value: 'true', label: 'On' }]}
                    onChange={(v) => updateSlot(i, { useDeltaFilter: v })}
                  />
                  <label className="tset-field">
                    <span className="tset-label">Delta threshold</span>
                    <input className="tset-input tset-mono" name={`legacy_delta_${i}`} type="number" step="0.1" inputMode="decimal" value={slot.deltaFilter} onChange={(e) => updateSlot(i, { deltaFilter: e.target.value })} />
                  </label>
                </div>
              </details>
            </section>
          );
        })}
      </div>

      {/* Stage capacity — the "Tetris" slot limiter. ONE collapsed group, a quiet
          per-stage usage readout instead of a pill grid + resolution table. */}
      <details className="tset-caps" open={capsOpen || !!stageCapsIssue}>
        <summary
          className="tset-caps-summary"
          onClick={(e) => { e.preventDefault(); setCapsOpen((o) => !o); }}
        >
          <span>Stage capacity</span>
          <span className="tset-caps-hint">how many RSI / CCI slots each stage holds</span>
        </summary>
        <div className="tset-caps-body" style={{ scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP }}>
          {stageCapsIssue && (
            <div role="alert" tabIndex={-1} className="tset-inline-error">
              <strong>{stageCapsIssue.title}</strong>
              <p>{stageCapsIssue.inlineHint ?? stageCapsIssue.detail}</p>
            </div>
          )}
          <div className="wtc-stack" style={{ gap: 12 }}>
            {stageSlots.map((stg) => {
              const i = stg.index;
              const stageNum = num(stg.stage);
              const used = stageUsage.get(stageNum) ?? { rsi: 0, cci: 0 };
              const rsiCap = num(stg.rsiSlots);
              const cciCap = num(stg.cciSlots);
              const over = used.rsi > rsiCap || used.cci > cciCap;
              const stageIssue = saveIssue?.target === 'legacy-stage' && saveIssue.row === i + 1 ? saveIssue : undefined;
              return (
                <div
                  key={i}
                  id={`legacy-stage-${i + 1}`}
                  className="tset-field-grid"
                  style={{ alignItems: 'end', scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP }}
                  aria-describedby={stageIssue ? `legacy-stage-${i + 1}-save-error` : undefined}
                  tabIndex={stageIssue ? -1 : undefined}
                >
                  <label className="tset-field">
                    <span className="tset-label">Stage</span>
                    <input className="tset-input tset-mono" name={`legacy_stage_slot_${i}`} type="number" step="1" inputMode="numeric" value={stg.stage} onChange={(e) => updateStage(i, { stage: e.target.value })} />
                  </label>
                  <label className="tset-field">
                    <span className="tset-label">RSI slots</span>
                    <input className="tset-input tset-mono" name={`legacy_stage_rsi_${i}`} type="number" step="1" inputMode="numeric" value={stg.rsiSlots} onChange={(e) => updateStage(i, { rsiSlots: e.target.value })} />
                  </label>
                  <label className="tset-field">
                    <span className="tset-label">CCI slots</span>
                    <input className="tset-input tset-mono" name={`legacy_stage_cci_${i}`} type="number" step="1" inputMode="numeric" value={stg.cciSlots} onChange={(e) => updateStage(i, { cciSlots: e.target.value })} />
                  </label>
                  <div className="tset-field">
                    <span className="tset-label">Usage</span>
                    <span className={`tset-input tset-mono${over ? ' tset-coin-card-error' : ''}`} style={{ display: 'flex', alignItems: 'center', background: 'transparent' }}>
                      {used.rsi}/{rsiCap} RSI · {used.cci}/{cciCap} CCI{over ? ' · over' : ''}
                    </span>
                  </div>
                  {stageIssue && (
                    <div id={`legacy-stage-${i + 1}-save-error`} role="alert" tabIndex={-1} className="tset-inline-error" style={{ gridColumn: '1 / -1' }}>
                      <strong>{stageIssue.title}</strong>
                      <p>{stageIssue.inlineHint ?? stageIssue.detail}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </details>
    </div>
  );
}
