/** Tiny server-rendered SVG sparkline — no client JS, no chart dependency. */
export function Sparkline({ values, width = 260, height = 64, color = '#69e2ff' }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return <div className="wtc-dim" style={{ fontSize: 12 }}>—</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 8) - 4).toFixed(1)}`);
  const d = `M ${pts.join(' L ')}`;
  const area = `${d} L ${width},${height} L 0,${height} Z`;
  const up = values[values.length - 1]! >= values[0]!;
  const stroke = up ? color : '#ff6b74';
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="equity sparkline">
      <path d={area} fill={stroke} fillOpacity={0.08} />
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}
