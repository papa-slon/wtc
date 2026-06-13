/**
 * Legacy DCA bot journal "shim" HTTP reader — the SAFE read-only data path for
 * the premium WTC statistics dashboard.
 *
 * This mirrors `createTortilaJournalReader` (../tortila/tortila-journal-reader.ts):
 * 8 read-only GET methods over the standalone read-only shim (bot/journal_shim/),
 * each returning either parsed data OR a `{ error: string }` object that the
 * dashboard renders as an honest empty section. None throw on network / shape
 * failure. NEVER returns synthetic data on failure.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * SECURITY — read this before touching:
 *   This reader talks ONLY to the read-only journal shim. It is explicitly NOT
 *   `createLegacyBlockedAdapter` and has NOTHING to do with the legacy bot's
 *   `/api_management/` control endpoint (which leaks plaintext keys and is
 *   HARD-BLOCKED in factory.ts — that block stays intact). This path:
 *     - issues read-only GETs to LEGACY_JOURNAL_URL only,
 *     - carries the LEGACY_JOURNAL_TOKEN as a bearer header (token stays
 *       server-side; never reaches the browser),
 *     - never unblocks control, never writes, never touches BingX keys.
 * ──────────────────────────────────────────────────────────────────────────
 */
import {
  LegacyHealthSchema,
  LegacySummarySchema,
  LegacyPositionsSchema,
  LegacySymbolBreakdownSchema,
  LegacySignalsSchema,
  LegacyActivitySchema,
  LegacyEquitySchema,
  LegacyDepthDistributionSchema,
  type LegacyHealth,
  type LegacySummary,
  type LegacyPositions,
  type LegacySymbolBreakdown,
  type LegacySignals,
  type LegacyActivity,
  type LegacyEquity,
  type LegacyDepthDistribution,
} from './legacy.shim.schemas.ts';

export type LegacyJournalReadError = { error: string };
export type LegacyJournalResult<T> = T | LegacyJournalReadError;

export function isLegacyJournalError<T>(value: LegacyJournalResult<T>): value is LegacyJournalReadError {
  return typeof value === 'object' && value !== null && 'error' in value && typeof (value as { error: unknown }).error === 'string';
}

export interface LegacyJournalReader {
  /** Configured base URL (no trailing slash) and token presence — never the token value. */
  readonly baseUrl: string;
  readonly hasToken: boolean;
  /** GET /api/health — `reconstructed` flag + bot trading `mode` (LIVE). Open (no token) on the shim. */
  getHealth(): Promise<LegacyJournalResult<LegacyHealth>>;
  /** GET /api/summary — reconstructed PnL/fees, cycle counts, accounts, tp_pct/fee_rate, `method`. */
  getSummary(): Promise<LegacyJournalResult<LegacySummary>>;
  /** GET /api/positions — open "stuck bag" rows (depth, averaged entry, age). mark/uPnL intentionally absent. */
  getPositions(): Promise<LegacyJournalResult<LegacyPositions>>;
  /** GET /api/symbol_breakdown — per-symbol cycles + reconstructed net PnL + avg depth + contribution. */
  getSymbolBreakdown(): Promise<LegacyJournalResult<LegacySymbolBreakdown>>;
  /** GET /api/signals — RED(CCI)/YELLOW(RSI) mix + per-month over_time counts. */
  getSignals(): Promise<LegacyJournalResult<LegacySignals>>;
  /** GET /api/activity?limit — cycle opens + take-profit closes (newest first). */
  getActivity(limit?: number): Promise<LegacyJournalResult<LegacyActivity>>;
  /** GET /api/equity — relative cumulative reconstructed PnL curve + underwater drawdown (baseline 0). */
  getEquity(): Promise<LegacyJournalResult<LegacyEquity>>;
  /** GET /api/depth_distribution — averaging-depth histogram (all vs open) = the "how stuck" view. */
  getDepthDistribution(): Promise<LegacyJournalResult<LegacyDepthDistribution>>;
}

async function getJson(url: string, token: string | undefined, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Construct a legacy journal-shim reader. `baseUrl` is required; `token` may be
 * undefined (which causes the gated methods to return
 * `{ error: 'LEGACY_JOURNAL_TOKEN is not configured' }`). `/api/health` is open
 * on the shim, but for honesty in production we still require the token here so
 * the WTC proxy never reads an unauthenticated shim.
 *
 * No global state, no caching — the caller (the Next.js server component / API
 * route) owns caching policy.
 */
export function createLegacyJournalReader(baseUrl: string, token?: string, timeoutMs = 4000): LegacyJournalReader {
  const base = baseUrl.replace(/\/$/, '');
  const hasToken = Boolean(token);
  const tokenOrError = <T>(): LegacyJournalResult<T> | null =>
    hasToken ? null : ({ error: 'LEGACY_JOURNAL_TOKEN is not configured' } satisfies LegacyJournalReadError as LegacyJournalResult<T>);

  async function fetchAndParse<T>(path: string, schema: { safeParse: (raw: unknown) => { success: boolean; data?: T; error?: { message: string } } }): Promise<LegacyJournalResult<T>> {
    const gate = tokenOrError<T>();
    if (gate) return gate;
    let raw: unknown;
    try {
      raw = await getJson(`${base}${path}`, token, timeoutMs);
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'network error' };
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success || parsed.data === undefined) {
      return { error: parsed.error?.message ?? 'schema validation failed' };
    }
    return parsed.data;
  }

  return {
    baseUrl: base,
    hasToken,
    getHealth() {
      return fetchAndParse('/api/health', LegacyHealthSchema);
    },
    getSummary() {
      return fetchAndParse('/api/summary', LegacySummarySchema);
    },
    getPositions() {
      return fetchAndParse('/api/positions', LegacyPositionsSchema);
    },
    getSymbolBreakdown() {
      return fetchAndParse('/api/symbol_breakdown', LegacySymbolBreakdownSchema);
    },
    getSignals() {
      return fetchAndParse('/api/signals', LegacySignalsSchema);
    },
    getActivity(limit = 80) {
      const l = Math.min(500, Math.max(10, Math.floor(limit)));
      return fetchAndParse(`/api/activity?limit=${l}`, LegacyActivitySchema);
    },
    getEquity() {
      return fetchAndParse('/api/equity', LegacyEquitySchema);
    },
    getDepthDistribution() {
      return fetchAndParse('/api/depth_distribution', LegacyDepthDistributionSchema);
    },
  };
}
