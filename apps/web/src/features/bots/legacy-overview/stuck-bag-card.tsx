import type { LegacyPositionRow } from '@wtc/bot-adapters';
import { fmtPriceAuto, fmtHold, shortSymbol } from '../tortila-overview/format';
import { reasonLabel, depthColor, depthTone } from './dca-format';

interface StuckBagCardProps {
  row: LegacyPositionRow;
  /** Max averaging depth the strategy allows (DCA ladder length). Default 3. */
  maxDepth?: number;
  legend?: Record<string, string>;
}

/**
 * Open "stuck bag" card for the DCA bot. Deliberately NOT a PositionCard variant:
 * the legacy bot has NO stop-loss and NO live mark pull in v1, so a price ladder
 * with a stop spine and a Mark/Unrealised row would structurally invite a future
 * fabricated number. This card shows ONLY honest, directly-available fields.
 */
export function StuckBagCard({ row, maxDepth = 3, legend }: StuckBagCardProps) {
  const cap = Math.max(maxDepth, row.averaging_depth);
  const tone = depthTone(row.averaging_depth, cap);
  const pips = Array.from({ length: cap }, (_, i) => i < row.averaging_depth);
  return (
    <div className="tov-pos-card">
      <div className="tov-pos-head">
        <span className="tov-pos-sym">{shortSymbol(row.symbol)}</span>
        <span className="tov-chip long">LONG</span>
        <span className={`tov-chip ${tone === 'down' ? 'short' : tone === 'up' ? 'long' : ''}`}>
          {`depth ${row.averaging_depth}/${cap}`}
        </span>
      </div>
      <div className="tov-pos-body">
        <div className="tov-pos-rows">
          <div className="tov-pos-row">
            <span className="tov-lbl">Averaged entry</span>
            <span className="tov-val tov-mono">
              {row.averaged_entry_available && row.averaged_entry !== null
                ? fmtPriceAuto(row.averaged_entry)
                : <span className="tov-dim">unavailable</span>}
            </span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Averaging depth</span>
            <span className="tov-val tov-mono" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              {pips.map((filled, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: filled ? depthColor(row.averaging_depth) : 'transparent',
                    border: `1px solid ${filled ? depthColor(row.averaging_depth) : 'rgba(148,163,184,0.35)'}`,
                  }}
                />
              ))}
              <span style={{ marginLeft: 4 }}>{row.averaging_depth}/{cap}</span>
            </span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Stage</span>
            <span className="tov-val tov-mono">{row.stage}</span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Trigger</span>
            <span className="tov-val tov-mono">{reasonLabel(row.reason, legend)}</span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Held</span>
            <span className="tov-val tov-mono">{fmtHold(row.age_hours)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
