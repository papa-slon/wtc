import { CHART_COLORS } from './format';

/** Inline area sparkline. Server-rendered SVG, no JS. Accepts a values array
 *  and infers up/down color from first vs last sample. Returns null when there
 *  isn't enough data to draw a meaningful line (the call site renders a hint). */
export function Sparkline({ values, width = 320, height = 56, pad = 2 }: { values: number[]; width?: number; height?: number; pad?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const rng = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const goingUp = last >= first;
  const color = goingUp ? CHART_COLORS.up : CHART_COLORS.down;
  const path = values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = height - pad - ((v - min) / rng) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const areaPath = `${path} L${(width - pad).toFixed(1)},${(height - pad).toFixed(1)} L${pad},${(height - pad).toFixed(1)} Z`;
  const gradId = `tov-spark-${goingUp ? 'up' : 'dn'}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
