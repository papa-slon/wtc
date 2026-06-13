/** Number-format helpers for the Tortila overview dashboard. All return '—'
 *  on null/undefined/non-finite — never '0' or 'NaN'. The em-dash signals
 *  "no data", which the design treats as a first-class state. */

export function fmtNumberOrDash(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
}

export function fmtPctOrDash(value: number | null | undefined, decimals = 2, signed = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  const sign = signed && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

export function fmtSignedOrDash(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}`;
}

export function fmtMoneyOrDash(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(decimals)}`;
}

export function fmtMoneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${abs.toFixed(2)}`;
}

export function fmtPriceAuto(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(2);
  if (abs >= 1) return value.toFixed(4);
  if (abs >= 0.01) return value.toFixed(5);
  return value.toFixed(8);
}

/** Hours -> short human label: 0.5h, 6.3h, 2.1d, 12m. */
export function fmtHold(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/** Profit factor: 'n/a' on null, '∞' on Infinity, fixed otherwise. */
export function fmtPf(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'n/a';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : 'n/a';
  return value.toFixed(2);
}

/** Symbol with quote stripped: 'NEAR-USDT:USDT' -> 'NEAR-USDT'. */
export function shortSymbol(s: string): string {
  return s.split(':')[0] ?? s;
}

/** Compact short timestamp (UTC) — month/day hh:mm. */
export function fmtShortTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Sign-color CSS class for trading values. */
export function signClass(value: number | null | undefined): 'wtc-up' | 'wtc-down' | '' {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return '';
  return value > 0 ? 'wtc-up' : 'wtc-down';
}

/** Color tokens shared by the SVG charts (matches the existing theme.css). */
export const CHART_COLORS = {
  up: '#54d6a1',
  upBg: 'rgba(84, 214, 161, 0.16)',
  down: '#ff6b74',
  downBg: 'rgba(255, 107, 116, 0.16)',
  info: '#69e2ff',
  infoBg: 'rgba(105, 226, 255, 0.16)',
  gold: '#d5a94f',
  goldBg: 'rgba(213, 169, 79, 0.16)',
  muted: '#94a3b8',
  dim: '#64748b',
  grid: 'rgba(148, 163, 184, 0.10)',
  gridStrong: 'rgba(148, 163, 184, 0.20)',
} as const;
