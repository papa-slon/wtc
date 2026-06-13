import type { TortilaMonthlyRow } from '@wtc/bot-adapters';
import { CHART_COLORS } from './format';

interface MonthlyBarsProps {
  rows: TortilaMonthlyRow[];
  width?: number;
  height?: number;
}

/** Monthly net P&L bars, signed (green up, red down). */
export function MonthlyBars({ rows, width = 600, height = 220 }: MonthlyBarsProps) {
  if (rows.length === 0) {
    return <div className="tov-empty-mini">No monthly history yet.</div>;
  }
  const padL = 26;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const maxPos = rows.reduce((m, r) => Math.max(m, r.net_pnl), 0);
  const minNeg = rows.reduce((m, r) => Math.min(m, r.net_pnl), 0);
  const lo = Math.min(minNeg, 0) * 1.1;
  const hi = Math.max(maxPos, 0) * 1.1 || 1;
  const rng = hi - lo || 1;
  const zeroY = padT + (1 - (0 - lo) / rng) * h;
  const barW = w / rows.length * 0.7;
  const colStep = w / rows.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Monthly returns">
      {/* zero line */}
      <line x1={padL} y1={zeroY} x2={padL + w} y2={zeroY} stroke={CHART_COLORS.gridStrong} strokeWidth={1} />
      {[0.25, 0.5, 0.75].map((frac) => {
        const v = lo + rng * (1 - frac);
        const y = padT + frac * h;
        return (
          <g key={`g-${frac}`}>
            <line x1={padL} y1={y} x2={padL + w} y2={y} stroke={CHART_COLORS.grid} strokeWidth={1} />
            <text x={padL - 4} y={y + 3} fontSize="10" textAnchor="end" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(v).toLocaleString()}</text>
          </g>
        );
      })}
      {rows.map((row, i) => {
        const cx = padL + i * colStep + (colStep - barW) / 2;
        const isPos = row.net_pnl >= 0;
        const yTop = isPos ? padT + (1 - (row.net_pnl - lo) / rng) * h : zeroY;
        const yBot = isPos ? zeroY : padT + (1 - (row.net_pnl - lo) / rng) * h;
        const height = Math.max(2, Math.abs(yBot - yTop));
        const color = isPos ? CHART_COLORS.up : CHART_COLORS.down;
        const label = row.month.slice(2); // 2026-05 -> 26-05
        return (
          <g key={row.month}>
            <rect x={cx} y={yTop} width={barW} height={height} fill={color} fillOpacity={0.8} rx={2} />
            <title>{`${row.month}: ${row.net_pnl >= 0 ? '+' : ''}${row.net_pnl.toFixed(2)} USDT (${row.trades} trades, ${row.wr_pct.toFixed(0)}% WR)`}</title>
            <text x={cx + barW / 2} y={padT + h + 14} fontSize="10" textAnchor="middle" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>{label}</text>
          </g>
        );
      })}
    </svg>
  );
}
