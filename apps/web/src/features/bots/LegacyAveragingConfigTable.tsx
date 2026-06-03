'use client';

import { useMemo, useState } from 'react';
import { StatusPill } from '@wtc/ui';
import type { LegacyStageConfig, LegacySymbolConfig } from './config';

const TF_OPTIONS = ['1m', '3m', '5m', '15m', '1h'] as const;
const LEGACY_SYMBOL_ROW_LIMIT = 14;
const LEGACY_STAGE_ROW_LIMIT = 4;
const BASE_SYMBOL_OPTIONS = [
  'AAVE-USDT',
  'ATOM-USDT',
  'AVAX-USDT',
  'BCH-USDT',
  'FARTCOIN-USDT',
  'KSM-USDT',
  'LINK-USDT',
  'SOL-USDT',
  'SUI-USDT',
  'TAO-USDT',
  'UNI-USDT',
  'XLM-USDT',
];

function rowAt(rows: readonly LegacySymbolConfig[], index: number): Partial<LegacySymbolConfig> {
  return rows[index] ?? {};
}

function stageAt(rows: readonly LegacyStageConfig[], index: number): Partial<LegacyStageConfig> {
  return rows[index] ?? {};
}

function signalValue(row: Partial<LegacySymbolConfig>): 'rsi' | 'cci' {
  return row.useCci && !row.useRsi ? 'cci' : 'rsi';
}

function signalLabel(signal: 'rsi' | 'cci'): string {
  return signal === 'cci' ? 'CCI cross-down' : 'RSI cross-down';
}

function pubShort(value: string | undefined): string {
  return value ? `${value.slice(0, 8)}...${value.slice(-4)}` : 'provider';
}

export function LegacyAveragingConfigTable({
  rows,
  stages,
}: {
  rows: readonly LegacySymbolConfig[];
  stages: readonly LegacyStageConfig[];
}) {
  const [signals, setSignals] = useState(() =>
    Array.from({ length: LEGACY_SYMBOL_ROW_LIMIT }, (_, i) => signalValue(rowAt(rows, i))),
  );
  const activeRows = rows.filter((row) => row.active);
  const rsiRows = rows.filter((row) => signalValue(row) === 'rsi');
  const cciRows = rows.filter((row) => signalValue(row) === 'cci');
  const providerCount = new Set(rows.map((row) => row.providerPubId).filter(Boolean)).size;
  const symbolOptions = useMemo(() => {
    const current = rows.map((row) => row.symbol).filter(Boolean);
    return [...new Set([...current, ...BASE_SYMBOL_OPTIONS])].sort();
  }, [rows]);

  return (
    <div className="wtc-stack" style={{ gap: 16 }}>
      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Legacy strategy map</h3>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            One coin uses one trigger: RSI or CCI. Stages decide how many active symbols each trigger may hold.
          </p>
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone="ok">{activeRows.length} active coins</StatusPill>
          <StatusPill tone="neutral">{rsiRows.length} RSI</StatusPill>
          <StatusPill tone="neutral">{cciRows.length} CCI</StatusPill>
          <StatusPill tone="neutral">{providerCount || 1} pub_id</StatusPill>
        </div>
      </div>

      <div className="wtc-stack" style={{ gap: 12 }}>
        {Array.from({ length: Math.min(LEGACY_SYMBOL_ROW_LIMIT, Math.max(rows.length, 6)) }, (_, i) => {
          const r = rowAt(rows, i);
          const signal = signals[i] ?? signalValue(r);
          const providerPubId = r.providerPubId;
          return (
            <section
              key={i}
              style={{
                border: '1px solid var(--stroke)',
                borderRadius: 8,
                padding: 14,
                background: 'rgba(255,255,255,0.025)',
              }}
            >
              <input type="hidden" name={`legacy_pub_id_${i}`} value={providerPubId ?? ''} />
              <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div className="wtc-kicker">{providerPubId ? `pub_id ${pubShort(providerPubId)}` : `slot ${i + 1}`}</div>
                  <h4 style={{ margin: '3px 0 0', fontSize: 15 }}>{r.symbol || 'New coin'}</h4>
                </div>
                <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <StatusPill tone={r.active === false ? 'neutral' : 'ok'}>{r.active === false ? 'paused' : 'enabled'}</StatusPill>
                  <StatusPill tone="neutral">{signalLabel(signal)}</StatusPill>
                </div>
              </div>

              <div className="wtc-grid wtc-grid-4">
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Coin</span>
                  <select className="wtc-input" name={`legacy_symbol_${i}`} defaultValue={r.symbol ?? symbolOptions[0] ?? 'AAVE-USDT'}>
                    {symbolOptions.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
                  </select>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Status</span>
                  <select className="wtc-input" name={`legacy_active_${i}`} defaultValue={String(r.active ?? true)}>
                    <option value="true">Enabled</option>
                    <option value="false">Paused</option>
                  </select>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Timeframe</span>
                  <select className="wtc-input" name={`legacy_tf_${i}`} defaultValue={r.timeframe ?? '3m'}>
                    {TF_OPTIONS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                  </select>
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Trigger</span>
                  <select
                    className="wtc-input"
                    name={`legacy_signal_${i}`}
                    value={signal}
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
                      <input className="wtc-input" name={`legacy_rsi_len_${i}`} type="number" step="1" defaultValue={String(r.rsiLength ?? 14)} />
                    </label>
                    <label className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>RSI threshold</span>
                      <input className="wtc-input" name={`legacy_rsi_thr_${i}`} type="number" step="1" defaultValue={String(r.rsiThreshold ?? 20)} />
                    </label>
                    <input type="hidden" name={`legacy_cci_len_${i}`} value={String(r.cciLength ?? 14)} />
                    <input type="hidden" name={`legacy_cci_thr_${i}`} value={String(r.cciThreshold ?? -300)} />
                  </>
                ) : (
                  <>
                    <label className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>CCI length</span>
                      <input className="wtc-input" name={`legacy_cci_len_${i}`} type="number" step="1" defaultValue={String(r.cciLength ?? 14)} />
                    </label>
                    <label className="wtc-stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 12 }}>CCI threshold</span>
                      <input className="wtc-input" name={`legacy_cci_thr_${i}`} type="number" step="1" defaultValue={String(r.cciThreshold ?? -300)} />
                    </label>
                    <input type="hidden" name={`legacy_rsi_len_${i}`} value={String(r.rsiLength ?? 14)} />
                    <input type="hidden" name={`legacy_rsi_thr_${i}`} value={String(r.rsiThreshold ?? 20)} />
                  </>
                )}
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Stage</span>
                  <input className="wtc-input" name={`legacy_stage_${i}`} type="number" step="1" defaultValue={String(r.stage ?? 1)} />
                </label>
                <label className="wtc-stack" style={{ gap: 4 }}>
                  <span style={{ fontSize: 12 }}>Take profit %</span>
                  <input className="wtc-input" name={`legacy_tp_${i}`} type="number" step="0.05" defaultValue={String(r.takeProfitPercent ?? 0.5)} />
                </label>
              </div>

              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Position sizing and averaging ladder</summary>
                <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Initial entry %</span>
                    <input className="wtc-input" name={`legacy_entry_${i}`} type="number" step="0.1" defaultValue={String(r.initialEntryPercent ?? 100)} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Balance %</span>
                    <input className="wtc-input" name={`legacy_balance_${i}`} type="number" step="0.1" defaultValue={String(r.useBalancePercent ?? 1.5)} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Leverage</span>
                    <input className="wtc-input" name={`legacy_lev_${i}`} type="number" step="1" defaultValue={String(r.leverage ?? 2)} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Averaging levels</span>
                    <input className="wtc-input" name={`legacy_levels_${i}`} type="number" step="1" defaultValue={String(r.averagingLevels ?? 3)} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Drop ladder %</span>
                    <input className="wtc-input" name={`legacy_drops_${i}`} defaultValue={r.averagingPercents ?? '3,12,35'} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Volume ladder %</span>
                    <input className="wtc-input" name={`legacy_volumes_${i}`} defaultValue={r.averagingVolumePercents ?? '4,6,12'} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Delay bars</span>
                    <input className="wtc-input" name={`legacy_delay_bars_${i}`} type="number" step="1" defaultValue={String(r.delayBars ?? 1)} />
                  </label>
                  <label className="wtc-stack" style={{ gap: 4 }}>
                    <span style={{ fontSize: 12 }}>Delta filter</span>
                    <input className="wtc-input" name={`legacy_delta_${i}`} type="number" step="0.1" defaultValue={String(r.deltaFilter ?? 0)} />
                  </label>
                  <input type="hidden" name={`legacy_delay_on_${i}`} value={String(r.useDelayFilter ?? false)} />
                  <input type="hidden" name={`legacy_delta_on_${i}`} value={String(r.useDeltaFilter ?? false)} />
                </div>
              </details>
            </section>
          );
        })}
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead><tr><th>Stage</th><th>RSI capacity</th><th>CCI capacity</th><th>Total</th></tr></thead>
          <tbody>
            {Array.from({ length: LEGACY_STAGE_ROW_LIMIT }, (_, i) => {
              const r = stageAt(stages, i);
              const rsi = r.rsiSlots ?? (i === 0 ? 3 : i === 1 ? 2 : 0);
              const cci = r.cciSlots ?? (i === 0 ? 2 : i === 1 ? 1 : 0);
              return (
                <tr key={i}>
                  <td data-label="Stage"><input className="wtc-input" name={`legacy_stage_slot_${i}`} type="number" step="1" defaultValue={r.stage != null ? String(r.stage) : i < 2 ? String(i + 1) : ''} /></td>
                  <td data-label="RSI capacity"><input className="wtc-input" name={`legacy_stage_rsi_${i}`} type="number" step="1" defaultValue={String(rsi)} /></td>
                  <td data-label="CCI capacity"><input className="wtc-input" name={`legacy_stage_cci_${i}`} type="number" step="1" defaultValue={String(cci)} /></td>
                  <td data-label="Total">{rsi + cci}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
