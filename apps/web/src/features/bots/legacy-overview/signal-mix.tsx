import type { LegacySignalsOverTimeRow } from '@wtc/bot-adapters';
import { CHART_COLORS } from '../tortila-overview/format';
import { reasonLabel, reasonColor } from './dca-format';

interface SignalMixProps {
  legend: Record<string, string>;
  mix: Record<string, number>;
  over_time: LegacySignalsOverTimeRow[];
}

/** Order reasons RED, YELLOW, GREEN first (CCI/RSI/other), then any extras. */
function orderReasons(keys: string[]): string[] {
  const priority = ['RED', 'YELLOW', 'GREEN'];
  return [...keys].sort((a, b) => {
    const ia = priority.indexOf(a.toUpperCase());
    const ib = priority.indexOf(b.toUpperCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
}

/**
 * Signal-source mix: RED (CCI) vs YELLOW (RSI). Only buckets actually present in
 * `mix` are rendered — no fabricated GREEN/empty bar. Counts, not PnL.
 */
export function SignalMix({ legend, mix, over_time }: SignalMixProps) {
  const reasons = orderReasons(Object.keys(mix).filter((k) => (mix[k] ?? 0) > 0));
  const total = reasons.reduce((s, r) => s + (mix[r] ?? 0), 0);
  if (total === 0) {
    return <div className="tov-empty-mini">No signal history yet.</div>;
  }

  return (
    <div className="wtc-stack" style={{ gap: 14 }}>
      {/* Proportional split bar */}
      <div>
        <div style={{ display: 'flex', height: 16, borderRadius: 6, overflow: 'hidden', background: 'rgba(148,163,184,0.07)' }}>
          {reasons.map((r) => {
            const n = mix[r] ?? 0;
            const w = (n / total) * 100;
            return (
              <div
                key={r}
                title={`${reasonLabel(r, legend)}: ${n.toLocaleString()} (${w.toFixed(1)}%)`}
                style={{ width: `${w.toFixed(2)}%`, background: reasonColor(r) }}
              />
            );
          })}
        </div>
        <div className="wtc-row" style={{ gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          {reasons.map((r) => {
            const n = mix[r] ?? 0;
            return (
              <span key={r} className="wtc-row" style={{ gap: 6, alignItems: 'center', fontSize: 12 }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: reasonColor(r) }} />
                <span className="tov-mono">{reasonLabel(r, legend)}</span>
                <span className="tov-dim tov-mono">{n.toLocaleString()} · {((n / total) * 100).toFixed(1)}%</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Per-month stacked cycle-start counts */}
      {over_time.length > 0 && (
        <div>
          <div className="tov-mute-xs" style={{ marginBottom: 6 }}>Cycle starts by trigger, per month</div>
          <OverTimeStacked rows={over_time} reasons={reasons} legend={legend} />
        </div>
      )}
    </div>
  );
}

function reasonCount(row: LegacySignalsOverTimeRow, reason: string): number {
  const v = (row as Record<string, unknown>)[reason];
  return typeof v === 'number' ? v : 0;
}

/** Stacked monthly bars of cycle-start COUNTS (not PnL), colored by trigger. */
function OverTimeStacked({ rows, reasons, legend }: { rows: LegacySignalsOverTimeRow[]; reasons: string[]; legend: Record<string, string> }) {
  const width = 600;
  const height = 200;
  const padL = 28;
  const padR = 8;
  const padT = 10;
  const padB = 26;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const totals = rows.map((row) => reasons.reduce((s, r) => s + reasonCount(row, r), 0));
  const hi = Math.max(1, ...totals);
  const colStep = w / rows.length;
  const barW = colStep * 0.66;

  const yTicks = [0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Cycle starts by trigger per month">
      {yTicks.map((frac) => {
        const y = padT + (1 - frac) * h;
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={padL + w} y2={y} stroke={CHART_COLORS.grid} strokeWidth={1} />
            <text x={padL - 4} y={y + 3} fontSize="10" textAnchor="end" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(hi * frac)}
            </text>
          </g>
        );
      })}
      {rows.map((row, i) => {
        const cx = padL + i * colStep + (colStep - barW) / 2;
        let yCursor = padT + h;
        const period = typeof row.period === 'string' ? row.period : '';
        const total = totals[i] ?? 0;
        return (
          <g key={period || i}>
            {reasons.map((r) => {
              const n = reasonCount(row, r);
              if (n <= 0) return null;
              const segH = (n / hi) * h;
              yCursor -= segH;
              return (
                <rect key={r} x={cx} y={yCursor} width={barW} height={Math.max(0.5, segH)} fill={reasonColor(r)} fillOpacity={0.85}>
                  <title>{`${period} · ${reasonLabel(r, legend)}: ${n}`}</title>
                </rect>
              );
            })}
            <text x={cx + barW / 2} y={padT + h + 14} fontSize="9" textAnchor="middle" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {period.slice(2)}
            </text>
            {total > 0 && (
              <text x={cx + barW / 2} y={padT + h - (total / hi) * h - 3} fontSize="9" textAnchor="middle" fill={CHART_COLORS.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {total}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
