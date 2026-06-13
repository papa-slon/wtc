import type { LegacyDepthBucket } from '@wtc/bot-adapters';
import { depthColor } from './dca-format';

interface DepthGaugeProps {
  all: LegacyDepthBucket[];
  open: LegacyDepthBucket[];
  note: string;
}

function countAt(buckets: LegacyDepthBucket[], depth: number): number {
  return buckets.find((b) => b.depth === depth)?.count ?? 0;
}

function pct(n: number, total: number): string {
  if (total <= 0) return '0%';
  return `${((n / total) * 100).toFixed(n / total >= 0.1 ? 0 : 1)}%`;
}

/**
 * "How stuck" — averaging-depth distribution. This REPLACES the Tortila risk
 * panel / win-rate for the DCA bot: depth N is the meaningful risk signal (how
 * far a bag averaged down without hitting TP). Counts are MEASURED from the
 * order ladder (not reconstructed money), so there is no 'reconstructed' tag.
 */
export function DepthGauge({ all, open, note }: DepthGaugeProps) {
  if (all.length === 0) {
    return <div className="tov-empty-mini">No cycle history yet to chart averaging depth.</div>;
  }
  const total = all.reduce((s, b) => s + b.count, 0);
  const maxDepth = all.reduce((m, b) => Math.max(m, b.depth), 0);
  const maxCount = all.reduce((m, b) => Math.max(m, b.count), 0) || 1;
  const openTotal = open.reduce((s, b) => s + b.count, 0);
  const openMaxDepth = open.reduce((m, b) => Math.max(m, b.depth), 0);
  const openAtMax = countAt(open, openMaxDepth);

  const clean = countAt(all, 0);
  const once = countAt(all, 1);
  const deep = all.filter((b) => b.depth >= 2).reduce((s, b) => s + b.count, 0);

  // Render one row per depth 0..maxDepth so empty depths still show (honest gaps).
  const rows = Array.from({ length: maxDepth + 1 }, (_, depth) => ({
    depth,
    count: countAt(all, depth),
    openCount: countAt(open, depth),
  }));

  // sqrt scale + a min visible width so the rare deep "stuck" bags — the actual
  // risk story — never collapse next to the dominant depth-0 bucket.
  const widthPct = (count: number): number => {
    if (count <= 0) return 0;
    return Math.max(3, (Math.sqrt(count) / Math.sqrt(maxCount)) * 100);
  };

  return (
    <div className="wtc-stack" style={{ gap: 14 }}>
      <div className="tov-mini-grid">
        <div className="tov-mini-card">
          <div className="tov-mini-lbl">Clean fills (depth 0)</div>
          <div className="tov-mini-val tov-mono tov-up">{clean.toLocaleString()}</div>
          <div className="tov-mini-sub">{pct(clean, total)} of {total.toLocaleString()} cycles</div>
        </div>
        <div className="tov-mini-card">
          <div className="tov-mini-lbl">Averaged once</div>
          <div className="tov-mini-val tov-mono">{once.toLocaleString()}</div>
          <div className="tov-mini-sub">{pct(once, total)} averaged 1 level</div>
        </div>
        <div className="tov-mini-card">
          <div className="tov-mini-lbl">Averaged 2x+</div>
          <div className="tov-mini-val tov-mono" style={{ color: '#f59e0b' }}>{deep.toLocaleString()}</div>
          <div className="tov-mini-sub">{pct(deep, total)} deep bags</div>
        </div>
        <div className="tov-mini-card">
          <div className="tov-mini-lbl">Open at max depth</div>
          <div className="tov-mini-val tov-mono tov-down">{openAtMax.toLocaleString()}</div>
          <div className="tov-mini-sub">{openTotal} open bag{openTotal === 1 ? '' : 's'} now</div>
        </div>
      </div>

      <div className="wtc-stack" style={{ gap: 6 }}>
        {rows.map((r) => (
          <div key={r.depth} className="tov-sym-bar-row" style={{ gridTemplateColumns: '110px 1fr 120px' }}>
            <span className="name">depth {r.depth}</span>
            <div className="tov-sym-bar" style={{ height: 12 }} title={`depth ${r.depth}: ${r.count.toLocaleString()} cycles${r.openCount ? ` · ${r.openCount} open now` : ''}`}>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: `${widthPct(r.count).toFixed(2)}%`,
                  background: depthColor(r.depth),
                  opacity: 0.85,
                  borderRadius: 4,
                }}
              />
              {r.openCount > 0 && (
                <div
                  title={`${r.openCount} open bag(s) at depth ${r.depth}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${widthPct(r.openCount).toFixed(2)}%`,
                    border: '1.5px solid var(--text)',
                    borderRadius: 4,
                    boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
            <span className="tov-mono" style={{ textAlign: 'right' }}>
              {r.count.toLocaleString()} <span className="tov-dim">({pct(r.count, total)})</span>
            </span>
          </div>
        ))}
      </div>

      <p className="tov-mute-xs" style={{ margin: 0 }}>
        {note} Outlined overlay = currently-open bags. Measured from the order ladder.
      </p>
    </div>
  );
}
