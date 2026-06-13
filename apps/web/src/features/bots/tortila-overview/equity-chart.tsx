import { CHART_COLORS } from './format';

interface EquityChartProps {
  ts: string[];
  equity: number[];
  /** Initial equity reference line (dashed). Hidden when null. */
  initialEquity: number | null;
  width?: number;
  height?: number;
}

/** Equity curve as an inline SVG line + area. Axes are rendered with subtle
 *  grid lines and Y tick labels on the right (matches the v2 journal layout). */
export function EquityChart({ ts, equity, initialEquity, width = 900, height = 280 }: EquityChartProps) {
  if (equity.length < 2) {
    return (
      <div className="tov-empty-mini">Equity history will appear once the bot snapshots equity (typically every 15 min).</div>
    );
  }
  const padL = 8;
  const padR = 56;
  const padT = 14;
  const padB = 22;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const min = Math.min(...equity);
  const max = Math.max(...equity);
  let lo = min;
  let hi = max;
  if (initialEquity !== null) {
    lo = Math.min(lo, initialEquity);
    hi = Math.max(hi, initialEquity);
  }
  // Add 4% headroom so the line isn't pinned to the top edge.
  const pad = (hi - lo) * 0.04 || 1;
  lo -= pad;
  hi += pad;
  const rng = hi - lo || 1;
  const stepX = w / (equity.length - 1);

  const first = equity[0]!;
  const last = equity[equity.length - 1]!;
  const goingUp = last >= first;
  const color = goingUp ? CHART_COLORS.up : CHART_COLORS.down;

  const pointStr = (i: number, v: number) => `${(padL + i * stepX).toFixed(1)},${(padT + (1 - (v - lo) / rng) * h).toFixed(1)}`;
  const path = equity.map((v, i) => (i === 0 ? `M${pointStr(i, v)}` : `L${pointStr(i, v)}`)).join(' ');
  const areaPath = `${path} L${(padL + (equity.length - 1) * stepX).toFixed(1)},${(padT + h).toFixed(1)} L${padL},${(padT + h).toFixed(1)} Z`;

  const ticks = 5;
  const tickStep = rng / ticks;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => lo + tickStep * i);

  // X axis: show 4 evenly-spaced timestamps
  const xTicks = 4;
  const xValues = Array.from({ length: xTicks + 1 }, (_, i) => Math.round((i * (equity.length - 1)) / xTicks));
  const tsLabel = (i: number) => {
    const iso = ts[i];
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCMonth() + 1}/${String(d.getUTCDate()).padStart(2, '0')}`;
  };

  const initialY = initialEquity !== null ? padT + (1 - (initialEquity - lo) / rng) * h : null;
  const gradId = goingUp ? 'tov-eq-up' : 'tov-eq-dn';

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Grid */}
      {tickValues.map((v, i) => {
        const y = padT + (1 - (v - lo) / rng) * h;
        return (
          <g key={`g-${i}`}>
            <line x1={padL} y1={y} x2={padL + w} y2={y} stroke={CHART_COLORS.grid} strokeWidth={1} />
            <text x={padL + w + 6} y={y + 3} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(v).toLocaleString()}</text>
          </g>
        );
      })}
      {/* Initial-equity reference line */}
      {initialY !== null && (
        <line x1={padL} y1={initialY} x2={padL + w} y2={initialY} stroke={CHART_COLORS.muted} strokeDasharray="4 4" strokeWidth={1} opacity={0.55} />
      )}
      {/* Area + line */}
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {/* End-point marker */}
      <circle cx={padL + (equity.length - 1) * stepX} cy={padT + (1 - (last - lo) / rng) * h} r={3} fill={color} />
      {/* X axis labels */}
      {xValues.map((i, idx) => {
        const x = padL + i * stepX;
        return (
          <text key={`x-${idx}`} x={x} y={padT + h + 14} fontSize="10" fill={CHART_COLORS.dim} textAnchor="middle">
            {tsLabel(i)}
          </text>
        );
      })}
    </svg>
  );
}

interface DrawdownChartProps {
  ts: string[];
  ddPct: number[];
  width?: number;
  height?: number;
}

/** Underwater drawdown curve. Values are stored <= 0 in the journal output. */
export function DrawdownChart({ ts, ddPct, width = 900, height = 130 }: DrawdownChartProps) {
  if (ddPct.length < 2) return null;
  const padL = 8;
  const padR = 56;
  const padT = 8;
  const padB = 14;
  const w = width - padL - padR;
  const h = height - padT - padB;

  // dd values are <= 0; min is the deepest (largest absolute).
  const minVal = Math.min(...ddPct);
  const lo = minVal * 1.08;
  const hi = 0;
  const rng = hi - lo || 1;
  const stepX = w / (ddPct.length - 1);

  const path = ddPct
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(padL + i * stepX).toFixed(1)},${(padT + (1 - (v - lo) / rng) * h).toFixed(1)}`)
    .join(' ');
  const areaPath = `${path} L${(padL + (ddPct.length - 1) * stepX).toFixed(1)},${(padT + h).toFixed(1)} L${padL},${(padT + h).toFixed(1)} Z`;
  void ts;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Drawdown underwater curve">
      <defs>
        <linearGradient id="tov-dd-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.down} stopOpacity="0.30" />
          <stop offset="100%" stopColor={CHART_COLORS.down} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* 0% reference */}
      <line x1={padL} y1={padT} x2={padL + w} y2={padT} stroke={CHART_COLORS.gridStrong} strokeWidth={1} />
      <text x={padL + w + 6} y={padT + 3} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>0%</text>
      <text x={padL + w + 6} y={padT + h + 3} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>{lo.toFixed(1)}%</text>
      <path d={areaPath} fill="url(#tov-dd-grad)" stroke="none" />
      <path d={path} fill="none" stroke={CHART_COLORS.down} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
