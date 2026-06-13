'use client';

import { useMemo, useState } from 'react';
import { CHART_COLORS, fmtNumberOrDash } from './format';

export type EquityPeriod = '1d' | '7d' | '30d' | 'all';

interface EquityPanelProps {
  /** ISO timestamps aligned with `equity`. */
  ts: string[];
  equity: number[];
  /** Initial-equity reference line (dashed). Hidden when null. */
  initialEquity: number | null;
  /** Drawdown series (<= 0), aligned with `ddTs`. Optional. */
  ddTs?: string[];
  ddPct?: number[];
}

const PERIODS: { id: EquityPeriod; label: string; ms: number | null }[] = [
  { id: '1d', label: '1D', ms: 86_400_000 },
  { id: '7d', label: '7D', ms: 7 * 86_400_000 },
  { id: '30d', label: '30D', ms: 30 * 86_400_000 },
  { id: 'all', label: 'ALL', ms: null },
];

interface HoverState {
  i: number;
  x: number;
}

function sliceByPeriod<T>(ts: string[], series: T[], cutoffMs: number | null): { ts: string[]; series: T[] } {
  if (cutoffMs === null || ts.length === 0) return { ts, series };
  const now = Date.now();
  // First index whose timestamp falls inside the [now - cutoff, now] window.
  // Timestamps are ascending, so the slice from here to the end is the period.
  const startIdx = ts.findIndex((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && now - t <= cutoffMs;
  });
  // No sample within the window -> nothing to show for this period.
  if (startIdx === -1) return { ts: [], series: [] };
  return { ts: ts.slice(startIdx), series: series.slice(startIdx) };
}

function tsShort(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/**
 * G3 + G4 — interactive equity + drawdown panel. Period tabs (1D/7D/30D/ALL)
 * re-slice the already-loaded series client-side (no refetch). A pointer
 * crosshair shows the exact date + equity + drawdown on hover.
 */
export function EquityPanel({ ts, equity, initialEquity, ddTs, ddPct }: EquityPanelProps) {
  const [period, setPeriod] = useState<EquityPeriod>('all');
  const [hover, setHover] = useState<HoverState | null>(null);

  const cutoff = PERIODS.find((p) => p.id === period)?.ms ?? null;
  const eq = useMemo(() => sliceByPeriod(ts, equity, cutoff), [ts, equity, cutoff]);
  const dd = useMemo(() => {
    if (!ddTs || !ddPct) return null;
    return sliceByPeriod(ddTs, ddPct, cutoff);
  }, [ddTs, ddPct, cutoff]);

  // Equity chart geometry.
  const width = 900;
  const height = 260;
  const padL = 8;
  const padR = 56;
  const padT = 14;
  const padB = 22;
  const w = width - padL - padR;
  const h = height - padT - padB;

  const values = eq.series;
  const enoughData = values.length >= 2;

  const geom = useMemo(() => {
    if (!enoughData) return null;
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (initialEquity !== null) {
      lo = Math.min(lo, initialEquity);
      hi = Math.max(hi, initialEquity);
    }
    const padV = (hi - lo) * 0.04 || 1;
    lo -= padV;
    hi += padV;
    const rng = hi - lo || 1;
    const stepX = w / (values.length - 1);
    const x = (i: number) => padL + i * stepX;
    const y = (v: number) => padT + (1 - (v - lo) / rng) * h;
    return { lo, hi, rng, stepX, x, y };
  }, [enoughData, values, initialEquity, w, h]);

  const first = enoughData ? values[0]! : 0;
  const last = enoughData ? values[values.length - 1]! : 0;
  const goingUp = last >= first;
  const color = goingUp ? CHART_COLORS.up : CHART_COLORS.down;
  const gradId = goingUp ? 'tov-eqp-up' : 'tov-eqp-dn';

  const path = geom ? values.map((v, i) => `${i === 0 ? 'M' : 'L'}${geom.x(i).toFixed(1)},${geom.y(v).toFixed(1)}`).join(' ') : '';
  const areaPath = geom ? `${path} L${geom.x(values.length - 1).toFixed(1)},${(padT + h).toFixed(1)} L${padL},${(padT + h).toFixed(1)} Z` : '';

  const ticks = 5;
  const tickValues = geom ? Array.from({ length: ticks + 1 }, (_, i) => geom.lo + (geom.rng / ticks) * i) : [];
  const xTickCount = 4;
  const xTickIdx = enoughData ? Array.from({ length: xTickCount + 1 }, (_, i) => Math.round((i * (values.length - 1)) / xTickCount)) : [];

  const initialY = geom && initialEquity !== null ? geom.y(initialEquity) : null;

  // Drawdown at the hovered index (matched by timestamp position when aligned).
  const hoveredDd = hover && dd && dd.series.length === values.length ? dd.series[hover.i] : null;

  function onMove(evt: React.PointerEvent<SVGSVGElement>) {
    if (!geom || !enoughData) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const relX = ((evt.clientX - rect.left) / rect.width) * width;
    const i = Math.max(0, Math.min(values.length - 1, Math.round((relX - padL) / geom.stepX)));
    setHover({ i, x: geom.x(i) });
  }

  return (
    <div>
      <div className="tov-row-between" style={{ marginBottom: 10 }}>
        <span className="tov-mute-xs">{enoughData ? `${values.length} samples` : 'equity history'}</span>
        <div className="tov-period-tabs" role="tablist" aria-label="Equity period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={`tov-period-tab ${period === p.id ? 'active' : ''}`}
              onClick={() => { setPeriod(p.id); setHover(null); }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!enoughData ? (
        <div className="tov-empty-mini">Not enough equity history in this window. Try a longer period.</div>
      ) : (
        <>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label="Equity curve"
            style={{ touchAction: 'none' }}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {tickValues.map((v, i) => {
              const y = geom!.y(v);
              return (
                <g key={`g-${i}`}>
                  <line x1={padL} y1={y} x2={padL + w} y2={y} stroke={CHART_COLORS.grid} strokeWidth={1} />
                  <text x={padL + w + 6} y={y + 3} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(v).toLocaleString()}</text>
                </g>
              );
            })}
            {initialY !== null && (
              <line x1={padL} y1={initialY} x2={padL + w} y2={initialY} stroke={CHART_COLORS.muted} strokeDasharray="4 4" strokeWidth={1} opacity={0.55} />
            )}
            <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
            <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={geom!.x(values.length - 1)} cy={geom!.y(last)} r={3} fill={color} />
            {xTickIdx.map((i, idx) => (
              <text key={`x-${idx}`} x={geom!.x(i)} y={padT + h + 14} fontSize="10" fill={CHART_COLORS.dim} textAnchor="middle">
                {tsShort(eq.ts[i]).split(' ')[0]}
              </text>
            ))}
            {hover && (
              <g pointerEvents="none">
                <line x1={hover.x} y1={padT} x2={hover.x} y2={padT + h} stroke={CHART_COLORS.gridStrong} strokeWidth={1} />
                <circle cx={hover.x} cy={geom!.y(values[hover.i]!)} r={3.5} fill={color} stroke="#0b1423" strokeWidth={1} />
              </g>
            )}
          </svg>

          {hover && (
            <div className="tov-chart-tip" role="status">
              <span className="tov-mono tov-dim">{tsShort(eq.ts[hover.i])}</span>
              <span className="tov-mono" style={{ color }}>{fmtNumberOrDash(values[hover.i], 2)} USDT</span>
              {hoveredDd !== null && hoveredDd !== undefined && (
                <span className="tov-mono tov-down">dd {hoveredDd.toFixed(2)}%</span>
              )}
            </div>
          )}

          {dd && dd.series.length >= 2 && (
            <DrawdownMini ts={dd.ts} ddPct={dd.series} hoverIdx={hover && dd.series.length === values.length ? hover.i : null} />
          )}
        </>
      )}
    </div>
  );
}

/** Compact underwater drawdown strip beneath the equity chart, with an aligned
 *  hover marker driven by the parent. */
function DrawdownMini({ ts, ddPct, hoverIdx }: { ts: string[]; ddPct: number[]; hoverIdx: number | null }) {
  const width = 900;
  const height = 110;
  const padL = 8;
  const padR = 56;
  const padT = 8;
  const padB = 14;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const minVal = Math.min(...ddPct);
  const lo = minVal * 1.08 || -1;
  const rng = 0 - lo || 1;
  const stepX = w / (ddPct.length - 1);
  const xOf = (i: number) => padL + i * stepX;
  const yOf = (v: number) => padT + (1 - (v - lo) / rng) * h;
  const path = ddPct.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const areaPath = `${path} L${xOf(ddPct.length - 1).toFixed(1)},${(padT + h).toFixed(1)} L${padL},${(padT + h).toFixed(1)} Z`;
  void ts;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Drawdown underwater curve" style={{ marginTop: -4 }}>
      <defs>
        <linearGradient id="tov-ddp-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.down} stopOpacity="0.30" />
          <stop offset="100%" stopColor={CHART_COLORS.down} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={padL} y1={padT} x2={padL + w} y2={padT} stroke={CHART_COLORS.gridStrong} strokeWidth={1} />
      <text x={padL + w + 6} y={padT + 3} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>0%</text>
      <text x={padL + w + 6} y={padT + h + 3} fontSize="10" fill={CHART_COLORS.dim} style={{ fontVariantNumeric: 'tabular-nums' }}>{lo.toFixed(1)}%</text>
      <path d={areaPath} fill="url(#tov-ddp-grad)" stroke="none" />
      <path d={path} fill="none" stroke={CHART_COLORS.down} strokeWidth="1.4" strokeLinejoin="round" />
      {hoverIdx !== null && hoverIdx >= 0 && hoverIdx < ddPct.length && (
        <g pointerEvents="none">
          <line x1={xOf(hoverIdx)} y1={padT} x2={xOf(hoverIdx)} y2={padT + h} stroke={CHART_COLORS.gridStrong} strokeWidth={1} />
          <circle cx={xOf(hoverIdx)} cy={yOf(ddPct[hoverIdx]!)} r={3} fill={CHART_COLORS.down} stroke="#0b1423" strokeWidth={1} />
        </g>
      )}
    </svg>
  );
}
