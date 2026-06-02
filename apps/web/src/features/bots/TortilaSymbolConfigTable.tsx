import { StatusPill } from '@wtc/ui';
import {
  serializeTortilaSymbolConfigs,
  TORTILA_SYMBOL_ROW_LIMIT,
  type TortilaSymbolConfig,
} from './config';

const TF_OPTIONS = ['4h', '1h'] as const;

function rowAt(rows: readonly TortilaSymbolConfig[], index: number): Partial<TortilaSymbolConfig> {
  return rows[index] ?? {};
}

export function TortilaSymbolConfigTable({ rows }: { rows: readonly TortilaSymbolConfig[] }) {
  const exportValue = serializeTortilaSymbolConfigs(rows);

  return (
    <div className="wtc-stack" style={{ gap: 12 }}>
      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Per-coin Tortila configuration</h3>
          <p className="wtc-dim" style={{ fontSize: 12, margin: '4px 0 0' }}>Edit each coin exactly as it will be exported for Tortila.</p>
        </div>
      </div>
      <div className="wtc-row" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <StatusPill tone="ok">SYMBOL_CONFIGS ready</StatusPill>
        <span className="wtc-dim" style={{ fontSize: 12, minWidth: 0, flex: '1 1 180px', overflowWrap: 'anywhere' }}>
          One row maps to `symbol@tf@system@risk@stop@add@max_units@atr@tp_rr`. Risk is entered as percent and exported as runtime fraction.
        </span>
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>TF</th>
              <th>Sys</th>
              <th>Risk %</th>
              <th>Stop N</th>
              <th>Add N</th>
              <th>Units</th>
              <th>ATR</th>
              <th>TP R</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: TORTILA_SYMBOL_ROW_LIMIT }, (_, i) => {
              const r = rowAt(rows, i);
              return (
                <tr key={i}>
                  <td data-label="Symbol">
                    <input className="wtc-input" name={`symbol_${i}`} defaultValue={r.symbol ?? ''} placeholder={i === 0 ? 'XRP/USDT:USDT' : ''} />
                  </td>
                  <td data-label="TF">
                    <select className="wtc-input" name={`tf_${i}`} defaultValue={r.timeframe ?? '4h'}>
                      {TF_OPTIONS.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                    </select>
                  </td>
                  <td data-label="Sys">
                    <select className="wtc-input" name={`system_${i}`} defaultValue={String(r.system ?? 2)}>
                      <option value="2">2</option>
                      <option value="1">1</option>
                    </select>
                  </td>
                  <td data-label="Risk %"><input className="wtc-input" name={`risk_${i}`} type="number" step="0.1" defaultValue={String(r.riskPercent ?? 0.3)} /></td>
                  <td data-label="Stop N"><input className="wtc-input" name={`stop_${i}`} type="number" step="0.5" defaultValue={String(r.stopN ?? 2)} /></td>
                  <td data-label="Add N"><input className="wtc-input" name={`add_${i}`} type="number" step="0.25" defaultValue={String(r.addStep ?? 1)} /></td>
                  <td data-label="Units"><input className="wtc-input" name={`maxUnits_${i}`} type="number" step="1" defaultValue={String(r.maxUnits ?? 4)} /></td>
                  <td data-label="ATR"><input className="wtc-input" name={`atr_${i}`} type="number" step="1" defaultValue={String(r.atrPeriod ?? 20)} /></td>
                  <td data-label="TP R"><input className="wtc-input" name={`tp_${i}`} type="number" step="1" defaultValue={String(r.takeProfitRr ?? 0)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label className="wtc-stack" style={{ gap: 6, marginTop: 14 }}>
        <span style={{ fontSize: 13 }}>Generated SYMBOL_CONFIGS</span>
        <div
          className="wtc-input wtc-mono"
          aria-label="Generated SYMBOL_CONFIGS"
          style={{ minHeight: 92, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
        >
          {exportValue}
        </div>
        <span className="wtc-dim" style={{ fontSize: 11 }}>
          This is the exact WTC-side export string for Tortila. It is not pushed to the live bot by this page.
        </span>
      </label>
    </div>
  );
}
