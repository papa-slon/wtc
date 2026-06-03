import { StatusPill } from '@wtc/ui';
import {
  LEGACY_STAGE_ROW_LIMIT,
  LEGACY_SYMBOL_ROW_LIMIT,
  type LegacyStageConfig,
  type LegacySymbolConfig,
} from './config';

const TF_OPTIONS = ['1m', '3m', '5m', '15m', '1h'] as const;

function rowAt(rows: readonly LegacySymbolConfig[], index: number): Partial<LegacySymbolConfig> {
  return rows[index] ?? {};
}

function stageAt(rows: readonly LegacyStageConfig[], index: number): Partial<LegacyStageConfig> {
  return rows[index] ?? {};
}

function signalValue(row: Partial<LegacySymbolConfig>): 'rsi' | 'cci' | 'both' {
  if (row.useRsi && row.useCci) return 'both';
  if (row.useCci) return 'cci';
  return 'rsi';
}

export function LegacyAveragingConfigTable({
  rows,
  stages,
}: {
  rows: readonly LegacySymbolConfig[];
  stages: readonly LegacyStageConfig[];
}) {
  const activeRows = rows.filter((row) => row.active);
  const rsiRows = rows.filter((row) => row.useRsi);
  const cciRows = rows.filter((row) => row.useCci);

  return (
    <div className="wtc-stack" style={{ gap: 14 }}>
      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Legacy symbol matrix</h3>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>
            Per-symbol RSI/CCI, timeframe, sizing, and averaging settings saved as WTC reference config.
          </p>
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone="ok">{activeRows.length} active</StatusPill>
          <StatusPill tone="neutral">{rsiRows.length} RSI</StatusPill>
          <StatusPill tone="neutral">{cciRows.length} CCI</StatusPill>
        </div>
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>On</th>
              <th>Symbol</th>
              <th>TF</th>
              <th>Signal</th>
              <th>RSI len</th>
              <th>RSI thr</th>
              <th>CCI len</th>
              <th>CCI thr</th>
              <th>Stage</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: LEGACY_SYMBOL_ROW_LIMIT }, (_, i) => {
              const r = rowAt(rows, i);
              return (
                <tr key={i}>
                  <td data-label="On">
                    <select className="wtc-input" name={`legacy_active_${i}`} defaultValue={String(r.active ?? true)}>
                      <option value="true">on</option>
                      <option value="false">off</option>
                    </select>
                  </td>
                  <td data-label="Symbol">
                    <input className="wtc-input" name={`legacy_symbol_${i}`} defaultValue={r.symbol ?? ''} placeholder={i === 0 ? 'AAVE-USDT' : ''} />
                  </td>
                  <td data-label="TF">
                    <select className="wtc-input" name={`legacy_tf_${i}`} defaultValue={r.timeframe ?? '3m'}>
                      {TF_OPTIONS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                    </select>
                  </td>
                  <td data-label="Signal">
                    <select className="wtc-input" name={`legacy_signal_${i}`} defaultValue={signalValue(r)}>
                      <option value="rsi">RSI</option>
                      <option value="cci">CCI</option>
                      <option value="both">Both</option>
                    </select>
                  </td>
                  <td data-label="RSI len"><input className="wtc-input" name={`legacy_rsi_len_${i}`} type="number" step="1" defaultValue={String(r.rsiLength ?? 14)} /></td>
                  <td data-label="RSI thr"><input className="wtc-input" name={`legacy_rsi_thr_${i}`} type="number" step="1" defaultValue={String(r.rsiThreshold ?? 20)} /></td>
                  <td data-label="CCI len"><input className="wtc-input" name={`legacy_cci_len_${i}`} type="number" step="1" defaultValue={String(r.cciLength ?? 20)} /></td>
                  <td data-label="CCI thr"><input className="wtc-input" name={`legacy_cci_thr_${i}`} type="number" step="1" defaultValue={String(r.cciThreshold ?? -230)} /></td>
                  <td data-label="Stage"><input className="wtc-input" name={`legacy_stage_${i}`} type="number" step="1" defaultValue={String(r.stage ?? 1)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>TP %</th>
              <th>Entry %</th>
              <th>Balance %</th>
              <th>Lev</th>
              <th>Levels</th>
              <th>Drops %</th>
              <th>Volumes %</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: LEGACY_SYMBOL_ROW_LIMIT }, (_, i) => {
              const r = rowAt(rows, i);
              return (
                <tr key={i}>
                  <td data-label="Symbol" className="wtc-mono">{r.symbol || '-'}</td>
                  <td data-label="TP %"><input className="wtc-input" name={`legacy_tp_${i}`} type="number" step="0.05" defaultValue={String(r.takeProfitPercent ?? 0.5)} /></td>
                  <td data-label="Entry %"><input className="wtc-input" name={`legacy_entry_${i}`} type="number" step="0.1" defaultValue={String(r.initialEntryPercent ?? 2)} /></td>
                  <td data-label="Balance %"><input className="wtc-input" name={`legacy_balance_${i}`} type="number" step="0.1" defaultValue={String(r.useBalancePercent ?? 1.5)} /></td>
                  <td data-label="Lev"><input className="wtc-input" name={`legacy_lev_${i}`} type="number" step="1" defaultValue={String(r.leverage ?? 2)} /></td>
                  <td data-label="Levels"><input className="wtc-input" name={`legacy_levels_${i}`} type="number" step="1" defaultValue={String(r.averagingLevels ?? 3)} /></td>
                  <td data-label="Drops %"><input className="wtc-input" name={`legacy_drops_${i}`} defaultValue={r.averagingPercents ?? '3,12,35'} /></td>
                  <td data-label="Volumes %"><input className="wtc-input" name={`legacy_volumes_${i}`} defaultValue={r.averagingVolumePercents ?? '4,6,12'} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead><tr><th>Stage</th><th>RSI slots</th><th>CCI slots</th></tr></thead>
          <tbody>
            {Array.from({ length: LEGACY_STAGE_ROW_LIMIT }, (_, i) => {
              const r = stageAt(stages, i);
              return (
                <tr key={i}>
                  <td data-label="Stage"><input className="wtc-input" name={`legacy_stage_slot_${i}`} type="number" step="1" defaultValue={r.stage != null ? String(r.stage) : i < 2 ? String(i + 1) : ''} /></td>
                  <td data-label="RSI slots"><input className="wtc-input" name={`legacy_stage_rsi_${i}`} type="number" step="1" defaultValue={String(r.rsiSlots ?? (i === 0 ? 3 : i === 1 ? 2 : 0))} /></td>
                  <td data-label="CCI slots"><input className="wtc-input" name={`legacy_stage_cci_${i}`} type="number" step="1" defaultValue={String(r.cciSlots ?? (i === 0 ? 2 : i === 1 ? 1 : 0))} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <StatusPill tone="ok">safe JSON export ready</StatusPill>
        <span className="wtc-dim" style={{ fontSize: 12 }}>
          The export contains strategy and slot settings only; no exchange credentials and no live-apply token.
        </span>
      </div>
    </div>
  );
}
