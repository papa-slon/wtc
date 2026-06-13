/** DCA-specific label + color helpers for the legacy overview leaves.
 *  Kept tiny and shared so the depth gauge, signal mix, and stuck-bag cards
 *  speak the same visual language. Colors mirror CHART_COLORS / the house
 *  palette; nothing here fabricates a value. */
import { CHART_COLORS } from '../tortila-overview/format';

/** Map the bot's signal `reason` to its human trigger label. RED=CCI, YELLOW=RSI
 *  (the shim `signals.legend` is authoritative; this is the safe fallback for
 *  endpoints — e.g. positions — that carry only the raw reason). */
export function reasonLabel(reason: string, legend?: Record<string, string>): string {
  const fromLegend = legend?.[reason];
  if (fromLegend) return fromLegend;
  const up = reason.toUpperCase();
  if (up === 'RED') return 'CCI';
  if (up === 'YELLOW') return 'RSI';
  if (up === 'GREEN') return 'other';
  return reason;
}

/** Stable color per signal reason for split bars / stacked over-time charts. */
export function reasonColor(reason: string): string {
  switch (reason.toUpperCase()) {
    case 'RED':
      return CHART_COLORS.down; // CCI
    case 'YELLOW':
      return '#f5c451'; // RSI (amber)
    case 'GREEN':
      return CHART_COLORS.up; // other
    default:
      return CHART_COLORS.muted;
  }
}

/** Averaging-depth color ramp: green (clean) → gold → amber → red (max-depth
 *  "stuck" bag). The deeper a bag has averaged down without hitting TP, the more
 *  risk it carries. */
export function depthColor(depth: number): string {
  if (depth <= 0) return CHART_COLORS.up;
  if (depth === 1) return CHART_COLORS.gold;
  if (depth === 2) return '#f59e0b';
  return CHART_COLORS.down;
}

/** Tone class for a depth chip (mirrors the up/down/neutral CSS used elsewhere). */
export function depthTone(depth: number, maxDepth: number): 'up' | 'down' | 'neutral' {
  if (depth <= 0) return 'up';
  if (depth >= maxDepth) return 'down';
  return 'neutral';
}
