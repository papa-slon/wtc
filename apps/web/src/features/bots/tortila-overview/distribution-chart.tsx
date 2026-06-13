import type { TortilaDistribution } from '@wtc/bot-adapters';
import { CHART_COLORS } from './format';

interface DistributionChartProps {
  data: TortilaDistribution;
  width?: number;
  height?: number;
}

/** Trade-PnL histogram. Bars to the right of zero are green (winners), to the
 *  left are red (losers). Zero-line marked. */
export function DistributionChart({ data, width = 900, height = 200 }: DistributionChartProps) {
  if (data.counts.length === 0 || data.edges.length === 0) {
    return <div className="tov-empty-mini">No closed trades yet.</div>;
  }
  const padL = 16;
  const padR = 16;
  const padT = 12;
  const padB = 24;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const maxCount = Math.max(...data.counts);
  const cols = data.counts.length;
  const barW = w / cols * 0.85;
  const colStep = w / cols;
  // Find the bin index that straddles zero.
  let zeroIdx = 0;
  for (let i = 0; i < data.edges.length - 1; i += 1) {
    if (data.edges[i]! <= 0 && data.edges[i + 1]! > 0) {
      zeroIdx = i;
      break;
    }
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Trade PnL distribution">
      {[0.25, 0.5, 0.75].map((frac) => {
        const y = padT + frac * h;
        return <line key={`g-${frac}`} x1={padL} y1={y} x2={padL + w} y2={y} stroke={CHART_COLORS.grid} strokeWidth={1} />;
      })}
      {data.counts.map((c, i) => {
        const cx = padL + i * colStep + (colStep - barW) / 2;
        const barH = (c / (maxCount || 1)) * h;
        const yTop = padT + h - barH;
        const isWin = i >= zeroIdx + 1;
        const color = isWin ? CHART_COLORS.up : CHART_COLORS.down;
        const lo = data.edges[i] ?? 0;
        const hi = data.edges[i + 1] ?? 0;
        return (
          <g key={i}>
            <rect x={cx} y={yTop} width={barW} height={Math.max(0, barH)} fill={color} fillOpacity={0.78} rx={1.5} />
            <title>{`${lo.toFixed(2)} … ${hi.toFixed(2)}: ${c} trade${c === 1 ? '' : 's'}`}</title>
          </g>
        );
      })}
      {/* Zero line */}
      <line
        x1={padL + (zeroIdx + 1) * colStep}
        y1={padT}
        x2={padL + (zeroIdx + 1) * colStep}
        y2={padT + h}
        stroke={CHART_COLORS.gridStrong}
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <text x={padL + (zeroIdx + 1) * colStep + 4} y={padT + 10} fontSize="10" fill={CHART_COLORS.dim}>0</text>
      <text x={padL} y={padT + h + 16} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {(data.edges[0] ?? 0).toFixed(1)}
      </text>
      <text x={padL + w} y={padT + h + 16} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }} textAnchor="end">
        {(data.edges[data.edges.length - 1] ?? 0).toFixed(1)}
      </text>
    </svg>
  );
}
