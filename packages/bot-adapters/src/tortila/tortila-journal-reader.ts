/**
 * Tortila journal HTTP reader — extended endpoints for the WTC web dashboard.
 *
 * The existing `createHttpTortilaAdapter` in ../http.ts implements the four
 * canonical endpoints needed by the worker / canonical-metric pipeline
 * (`/api/health`, `/api/summary`, `/api/trades/list`, `/api/equity`). The
 * premium dashboard page needs an additional 9 endpoints (advanced metrics,
 * symbol breakdown, calendar heatmap, monthly returns, distribution histogram,
 * underwater drawdown series, live marks, mixed activity timeline, and the
 * bundle endpoint `/api/overview`).
 *
 * Rather than expand the `BotAdapter` interface (which already serves both
 * Tortila and Legacy bots and the worker pipeline), this reader stands alone:
 *
 *   const reader = createTortilaJournalReader(baseUrl, token);
 *   const { performance, trades, drawdown } = await reader.getAdvanced();
 *
 * All fetchers are read-only GET with bearer auth and a 4-second timeout. None
 * throw on network / shape failure — instead each method returns either parsed
 * data OR a `{ error: string }` object that the dashboard renders as an
 * honest empty section. NEVER return synthetic data on failure.
 */
import {
  TortilaAdvancedMetricsSchema,
  TortilaSymbolBreakdownSchema,
  TortilaMonthlySchema,
  TortilaCalendarSchema,
  TortilaDistributionSchema,
  TortilaDrawdownSeriesSchema,
  TortilaMarksSchema,
  TortilaActivitySchema,
  type TortilaAdvancedMetrics,
  type TortilaSymbolBreakdown,
  type TortilaMonthly,
  type TortilaCalendar,
  type TortilaDistribution,
  type TortilaDrawdownSeries,
  type TortilaMarks,
  type TortilaActivity,
} from './tortila.extended.schemas.ts';
import {
  TortilaSummarySchema,
  TortilaTradeListSchema,
  type TortilaSummary,
  type TortilaTradeList,
} from './tortila.schemas.ts';

/** Filters accepted by the journal `/api/trades/list` endpoint (app.py:802). */
export interface TortilaTradeListQuery {
  page?: number;
  pageSize?: number;
  symbol?: string;
  side?: string;
  exitReason?: string;
}

export type TortilaJournalReadError = { error: string };
export type TortilaJournalResult<T> = T | TortilaJournalReadError;

export function isTortilaJournalError<T>(value: TortilaJournalResult<T>): value is TortilaJournalReadError {
  return typeof value === 'object' && value !== null && 'error' in value && typeof (value as { error: unknown }).error === 'string';
}

export interface TortilaJournalReader {
  /** Configured base URL (no trailing slash) and token presence — never the token value. */
  readonly baseUrl: string;
  readonly hasToken: boolean;
  /** GET /api/summary — carries the demo/live `mode` flag + at_ath used by the hero. */
  getSummary(): Promise<TortilaJournalResult<TortilaSummary>>;
  getAdvanced(): Promise<TortilaJournalResult<TortilaAdvancedMetrics>>;
  getSymbolBreakdown(): Promise<TortilaJournalResult<TortilaSymbolBreakdown>>;
  getMonthly(): Promise<TortilaJournalResult<TortilaMonthly>>;
  getCalendar(weeks?: number): Promise<TortilaJournalResult<TortilaCalendar>>;
  getDistribution(bins?: number): Promise<TortilaJournalResult<TortilaDistribution>>;
  getDrawdownSeries(): Promise<TortilaJournalResult<TortilaDrawdownSeries>>;
  getMarks(): Promise<TortilaJournalResult<TortilaMarks>>;
  getActivity(limit?: number): Promise<TortilaJournalResult<TortilaActivity>>;
  /** GET /api/trades/list — paginated, filterable trade history (group I). */
  getTradesList(query?: TortilaTradeListQuery): Promise<TortilaJournalResult<TortilaTradeList>>;
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
 * Construct a journal reader. `baseUrl` is required; `token` may be undefined
 * (which causes every method to return `{ error: 'token not configured' }`).
 *
 * No global state, no caching — the caller (the Next.js API route) is
 * responsible for caching policy (cache-control headers, route-segment
 * revalidation, or none at all for live polls).
 */
export function createTortilaJournalReader(baseUrl: string, token?: string, timeoutMs = 4000): TortilaJournalReader {
  const base = baseUrl.replace(/\/$/, '');
  const hasToken = Boolean(token);
  const tokenOrError = <T>(): TortilaJournalResult<T> | null =>
    hasToken ? null : ({ error: 'JOURNAL_READ_TOKEN is not configured' } satisfies TortilaJournalReadError as TortilaJournalResult<T>);

  async function fetchAndParse<T>(path: string, schema: { safeParse: (raw: unknown) => { success: boolean; data?: T; error?: { message: string } } }): Promise<TortilaJournalResult<T>> {
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
    getSummary() {
      return fetchAndParse('/api/summary', TortilaSummarySchema);
    },
    getAdvanced() {
      return fetchAndParse('/api/metrics/advanced', TortilaAdvancedMetricsSchema);
    },
    getSymbolBreakdown() {
      return fetchAndParse('/api/symbol_breakdown', TortilaSymbolBreakdownSchema);
    },
    getMonthly() {
      return fetchAndParse('/api/monthly', TortilaMonthlySchema);
    },
    getCalendar(weeks = 26) {
      const w = Math.min(104, Math.max(4, Math.floor(weeks)));
      return fetchAndParse(`/api/calendar?weeks=${w}`, TortilaCalendarSchema);
    },
    getDistribution(bins = 14) {
      const b = Math.min(40, Math.max(4, Math.floor(bins)));
      return fetchAndParse(`/api/distribution?bins=${b}`, TortilaDistributionSchema);
    },
    getDrawdownSeries() {
      return fetchAndParse('/api/drawdown', TortilaDrawdownSeriesSchema);
    },
    getMarks() {
      return fetchAndParse('/api/marks', TortilaMarksSchema);
    },
    getActivity(limit = 100) {
      const l = Math.min(500, Math.max(10, Math.floor(limit)));
      return fetchAndParse(`/api/activity?limit=${l}`, TortilaActivitySchema);
    },
    getTradesList(query = {}) {
      const params = new URLSearchParams();
      const page = Math.max(1, Math.floor(query.page ?? 1));
      const pageSize = Math.min(500, Math.max(10, Math.floor(query.pageSize ?? 50)));
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (query.symbol) params.set('symbol', query.symbol);
      if (query.side) params.set('side', query.side);
      if (query.exitReason) params.set('exit_reason', query.exitReason);
      return fetchAndParse(`/api/trades/list?${params.toString()}`, TortilaTradeListSchema);
    },
  };
}
