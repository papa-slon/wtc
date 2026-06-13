import type { TortilaMark } from '@wtc/bot-adapters';
import { CHART_COLORS, fmtPriceAuto, fmtHold, fmtSignedOrDash, signClass } from './format';

interface PositionCardProps {
  symbol: string;
  side: 'long' | 'short';
  units: number;
  system: number;
  totalQty: number;
  avgEntry: number;
  lastEntry: number;
  stop: number | null;
  hasTp: boolean;
  /** Open-time epoch ms (or null). */
  openedAtMs: number | null;
  /** Live mark from /api/marks; null when unavailable. */
  mark: TortilaMark | null | undefined;
  /** Server "now" epoch ms — used to compute held time without client drift. */
  nowMs: number;
}

/** Compute unrealised PnL from entry, qty, side, mark. Mirrors the v2 journal
 *  formula at static/dashboard.js. Returns null when mark is unavailable. */
function computeUpnl(entry: number, qty: number, side: 'long' | 'short', markPx: number | null | undefined): number | null {
  if (markPx === null || markPx === undefined || !Number.isFinite(markPx)) return null;
  if (!entry || !qty) return null;
  if (side === 'long') return (markPx - entry) * qty;
  return (entry - markPx) * qty;
}

/** Inline SVG price ladder. Y axis: low to high price. Markers: stop, entry,
 *  mark, last-entry. Values are positioned proportionally between min/max. */
function PriceLadder({
  entry,
  mark,
  stop,
  lastEntry,
  side,
}: {
  entry: number;
  mark: number | null;
  stop: number | null;
  lastEntry: number | null;
  side: 'long' | 'short';
}) {
  const pts: { v: number; label: string; color: string }[] = [];
  pts.push({ v: entry, label: 'E', color: CHART_COLORS.gold });
  if (mark !== null) pts.push({ v: mark, label: 'M', color: CHART_COLORS.info });
  if (stop !== null && stop !== 0) pts.push({ v: stop, label: 'S', color: CHART_COLORS.down });
  if (lastEntry !== null && lastEntry !== entry) pts.push({ v: lastEntry, label: 'L', color: CHART_COLORS.muted });
  if (pts.length === 0) return null;
  const lo = Math.min(...pts.map((p) => p.v));
  const hi = Math.max(...pts.map((p) => p.v));
  const rng = hi - lo || 1;
  const w = 32;
  const h = 180;
  // For SHORT positions, invert vertical axis so "favourable" is up.
  const yOf = (v: number) => {
    const frac = (v - lo) / rng;
    const inverted = side === 'short' ? frac : 1 - frac;
    return 4 + inverted * (h - 8);
  };
  return (
    <svg viewBox={`0 0 ${w} ${h + 8}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {/* Spine */}
      <line x1={w / 2} y1={4} x2={w / 2} y2={h + 4} stroke={CHART_COLORS.grid} strokeWidth={1} />
      {pts.map((p, i) => {
        const y = yOf(p.v);
        return (
          <g key={`${p.label}-${i}`}>
            <line x1={w / 2 - 6} y1={y} x2={w / 2 + 6} y2={y} stroke={p.color} strokeWidth={1.6} />
            <text x={w / 2 + 8} y={y + 3} fontSize={9} fill={p.color} fontFamily="ui-monospace, monospace" fontWeight={700}>
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function PositionCard(props: PositionCardProps) {
  const { symbol, side, units, system, totalQty, avgEntry, lastEntry, stop, hasTp, openedAtMs, mark, nowMs } = props;
  const markPx = mark?.mark ?? mark?.last ?? null;
  const upnl = computeUpnl(avgEntry, totalQty, side, markPx);
  const heldMs = openedAtMs ? Math.max(0, nowMs - openedAtMs) : null;
  const heldH = heldMs !== null ? heldMs / 3_600_000 : null;
  // Distance to stop %
  const stopDistPct = stop && stop !== 0 && markPx
    ? side === 'long'
      ? ((markPx - stop) / markPx) * 100
      : ((stop - markPx) / markPx) * 100
    : null;
  const shortName = symbol.split(':')[0] ?? symbol;
  return (
    <div className="tov-pos-card">
      <div className="tov-pos-head">
        <span className="tov-pos-sym">{shortName}</span>
        <span className={`tov-chip ${side}`}>{side.toUpperCase()}</span>
        <span className="tov-chip">{`S${system} . ${units}U`}</span>
      </div>
      <div className="tov-pos-body">
        <div className="tov-pos-rows">
          <div className="tov-pos-row">
            <span className="tov-lbl">Mark</span>
            <span className="tov-val tov-mono">{markPx !== null ? fmtPriceAuto(markPx) : <span className="tov-dim">unavailable</span>}</span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Avg entry</span>
            <span className="tov-val tov-mono">{fmtPriceAuto(avgEntry)}</span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Last entry</span>
            <span className="tov-val tov-mono">{fmtPriceAuto(lastEntry)}</span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Qty</span>
            <span className="tov-val tov-mono">{fmtPriceAuto(totalQty)}</span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Stop</span>
            <span className="tov-val tov-mono">
              {stop ? fmtPriceAuto(stop) : <span className="tov-down">none</span>}
              {stopDistPct !== null && (
                <span className="tov-dim" style={{ marginLeft: 6, fontSize: 11 }}>
                  ({stopDistPct >= 0 ? '+' : ''}{stopDistPct.toFixed(2)}%)
                </span>
              )}
            </span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Take-profit</span>
            <span className="tov-val tov-mono">
              {hasTp ? <span className="tov-up">active</span> : <span className="tov-warn">none</span>}
            </span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Unrealised</span>
            <span className={`tov-val tov-mono ${signClass(upnl)}`}>
              {upnl !== null ? fmtSignedOrDash(upnl) : <span className="tov-dim">N/A</span>}
            </span>
          </div>
          <div className="tov-pos-row">
            <span className="tov-lbl">Held</span>
            <span className="tov-val tov-mono">{fmtHold(heldH)}</span>
          </div>
        </div>
        <div className="tov-pos-ladder">
          <PriceLadder entry={avgEntry} mark={markPx} stop={stop} lastEntry={lastEntry} side={side} />
        </div>
      </div>
    </div>
  );
}
