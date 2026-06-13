import 'server-only';
import {
  createHttpTortilaAdapter,
  createTortilaJournalReader,
  isTortilaJournalError,
  type TortilaActivity,
  type TortilaAdvancedMetrics,
  type TortilaCalendar,
  type TortilaDistribution,
  type TortilaDrawdownSeries,
  type TortilaJournalReadError,
  type TortilaMarks,
  type TortilaMonthly,
  type TortilaSummary,
  type TortilaSymbolBreakdown,
  type TortilaTradeList,
  type TortilaTradeListQuery,
} from '@wtc/bot-adapters';
import type { CanonicalMetrics, CanonicalPosition, CanonicalTrade, EquityPoint } from '@wtc/analytics';
import { botAdapterOptions } from '@/lib/server-config';

export interface TortilaOverviewSlice<T> {
  data: T | null;
  error: string | null;
}

/** All-in-one premium-dashboard payload. Each slice is independent; one
 *  endpoint failing never blocks the others. The page renders an honest
 *  "section unavailable" card when a slice's `error` is set. */
export interface TortilaOverviewPayload {
  /** Reader configuration; renderable as a status pill. */
  configured: boolean;
  baseUrl: string;
  /** ISO timestamp of when the data was assembled (server time). */
  assembledAt: string;
  /** Adapter mode from BOT_ADAPTER_MODE; the page uses this to decide between
   *  mock-warning vs real-data badges. */
  adapterMode: 'mock' | 'read-only' | 'audited';
  /** /api/summary slice — the authoritative source for demo/live `mode` + at_ath. */
  summary: TortilaOverviewSlice<TortilaSummary>;
  advanced: TortilaOverviewSlice<TortilaAdvancedMetrics>;
  symbolBreakdown: TortilaOverviewSlice<TortilaSymbolBreakdown>;
  monthly: TortilaOverviewSlice<TortilaMonthly>;
  calendar: TortilaOverviewSlice<TortilaCalendar>;
  distribution: TortilaOverviewSlice<TortilaDistribution>;
  drawdownSeries: TortilaOverviewSlice<TortilaDrawdownSeries>;
  marks: TortilaOverviewSlice<TortilaMarks>;
  activity: TortilaOverviewSlice<TortilaActivity>;
}

function wrap<T>(value: T | TortilaJournalReadError): TortilaOverviewSlice<T> {
  if (isTortilaJournalError(value)) return { data: null, error: value.error };
  return { data: value, error: null };
}

/**
 * Fetch the extended dashboard payload from the Tortila journal. Honest
 * fallback: when the adapter is in `mock` mode OR the journal URL/token is
 * absent, the function still resolves, but every slice carries an explanatory
 * `error` (NEVER synthetic data).
 *
 * The token NEVER leaves this module — the page renders the data already
 * dereferenced in a server component.
 */
export async function loadTortilaOverviewPayload(): Promise<TortilaOverviewPayload> {
  const opts = botAdapterOptions();
  const baseUrl = opts.tortilaBaseUrl ?? '';
  const configured = opts.mode !== 'mock' && Boolean(baseUrl) && Boolean(opts.tortilaReadToken);
  const assembledAt = new Date().toISOString();

  if (!configured) {
    const reason = opts.mode === 'mock'
      ? 'BOT_ADAPTER_MODE is mock — the Tortila journal is not contacted in this mode.'
      : !baseUrl
        ? 'TORTILA_JOURNAL_URL is not set — set the journal base URL.'
        : 'JOURNAL_READ_TOKEN is not set — the journal requires bearer authentication.';
    return {
      configured: false,
      baseUrl,
      assembledAt,
      adapterMode: opts.mode,
      summary: { data: null, error: reason },
      advanced: { data: null, error: reason },
      symbolBreakdown: { data: null, error: reason },
      monthly: { data: null, error: reason },
      calendar: { data: null, error: reason },
      distribution: { data: null, error: reason },
      drawdownSeries: { data: null, error: reason },
      marks: { data: null, error: reason },
      activity: { data: null, error: reason },
    };
  }

  const reader = createTortilaJournalReader(baseUrl, opts.tortilaReadToken);
  const [summary, advanced, symbolBreakdown, monthly, calendar, distribution, drawdownSeries, marks, activity] = await Promise.all([
    reader.getSummary(),
    reader.getAdvanced(),
    reader.getSymbolBreakdown(),
    reader.getMonthly(),
    reader.getCalendar(26),
    reader.getDistribution(14),
    reader.getDrawdownSeries(),
    reader.getMarks(),
    reader.getActivity(80),
  ]);

  return {
    configured: true,
    baseUrl: reader.baseUrl,
    assembledAt,
    adapterMode: opts.mode,
    summary: wrap(summary),
    advanced: wrap(advanced),
    symbolBreakdown: wrap(symbolBreakdown),
    monthly: wrap(monthly),
    calendar: wrap(calendar),
    distribution: wrap(distribution),
    drawdownSeries: wrap(drawdownSeries),
    marks: wrap(marks),
    activity: wrap(activity),
  };
}

// ---------------------------------------------------------------------------
// Trade-history page read (G1). The trade-history table is a client island that
// pages + filters via the journal `/api/trades/list` endpoint. This loader is
// the server-side half: it carries the bearer token (which never leaves the
// module) and returns either the parsed page or an honest `{ error }` envelope.
// The Next.js route handler that calls this is session + entitlement gated.
// ---------------------------------------------------------------------------

export interface TortilaTradesPageResult {
  data: TortilaTradeList | null;
  error: string | null;
}

export async function loadTortilaTradesPage(query: TortilaTradeListQuery): Promise<TortilaTradesPageResult> {
  const opts = botAdapterOptions();
  const baseUrl = opts.tortilaBaseUrl ?? '';
  const configured = opts.mode !== 'mock' && Boolean(baseUrl) && Boolean(opts.tortilaReadToken);
  if (!configured) {
    return { data: null, error: notConfiguredReason(opts, baseUrl) };
  }
  const reader = createTortilaJournalReader(baseUrl, opts.tortilaReadToken);
  const result = await reader.getTradesList(query);
  if (isTortilaJournalError(result)) return { data: null, error: result.error };
  return { data: result, error: null };
}

// ---------------------------------------------------------------------------
// LIVE core read (bypasses stale WTC DB snapshots).
//
// PART 1 fix: the statistics page used to read core metrics/positions/trades/
// equity from `loadBotReadModelForUser` → WTC DB snapshot tables written by the
// worker. Those snapshots go stale the moment the worker stops (or starts
// reading a misconfigured journal), so the page showed an old positions set and
// $0 equity. This loader instead reads the SAME canonical numbers DIRECTLY from
// the live Tortila journal HTTP adapter (`/api/summary`, `/api/trades/list`,
// `/api/equity`) — the exact path the earlier extended-slice loader already
// uses for advanced metrics. One server-side read, token stays server-side.
//
// HONEST EMPTY GUARD: a journal pointed at an empty/cold DB returns a real,
// schema-valid all-zero payload (last_equity=0, 0 trades, 0 positions). We must
// NOT render that as a live "$0 account" — it is indistinguishable from a
// misconfigured data source. When the live read parses but carries no equity,
// no trades and no positions, `status` is reported as `empty` so the page shows
// a clear "data source returned no data" banner instead of fabricating zeros.
// ---------------------------------------------------------------------------

export type TortilaLiveStatus = 'live' | 'empty' | 'not-configured' | 'error';

export interface TortilaLiveOverview {
  status: TortilaLiveStatus;
  /** Human-readable reason for any non-`live` status (rendered verbatim). */
  statusDetail: string | null;
  /** Adapter mode from BOT_ADAPTER_MODE. */
  adapterMode: 'mock' | 'read-only' | 'audited';
  /** Configured journal base URL (no token). */
  baseUrl: string;
  /** Live demo/live flag from /api/summary; 'unknown' when not read. */
  mode: 'demo' | 'live' | 'unknown';
  /** Whether the bot is currently at an all-time-high equity (current DD ~ 0). */
  atAth: boolean;
  /** Canonical core reads (empty arrays / null when not live). */
  metrics: CanonicalMetrics | null;
  positions: CanonicalPosition[];
  trades: CanonicalTrade[];
  equityCurve: EquityPoint[];
  /** Extended premium slices (each independently nullable). */
  payload: TortilaOverviewPayload;
}

function notConfiguredReason(opts: ReturnType<typeof botAdapterOptions>, baseUrl: string): string {
  if (opts.mode === 'mock') {
    return 'BOT_ADAPTER_MODE is mock — the live Tortila journal is not contacted. Set BOT_ADAPTER_MODE=read-only with TORTILA_JOURNAL_URL and JOURNAL_READ_TOKEN to read live data.';
  }
  if (!baseUrl) return 'TORTILA_JOURNAL_URL is not set — set the journal base URL to read live data.';
  return 'JOURNAL_READ_TOKEN is not set — the journal requires bearer authentication.';
}

/**
 * Read the Tortila premium overview LIVE from the journal (core canonical
 * numbers + extended slices), bypassing the WTC DB snapshot tables.
 *
 * Never throws. The token never leaves this module. When the journal is
 * unconfigured/unreachable/empty, the relevant `status` is returned and the
 * page renders an honest non-fabricated state.
 */
export async function loadTortilaLiveOverview(): Promise<TortilaLiveOverview> {
  const opts = botAdapterOptions();
  const baseUrl = opts.tortilaBaseUrl ?? '';
  const configured = opts.mode !== 'mock' && Boolean(baseUrl) && Boolean(opts.tortilaReadToken);
  const payload = await loadTortilaOverviewPayload();

  if (!configured) {
    return {
      status: 'not-configured',
      statusDetail: notConfiguredReason(opts, baseUrl),
      adapterMode: opts.mode,
      baseUrl,
      mode: 'unknown',
      atAth: false,
      metrics: null,
      positions: [],
      trades: [],
      equityCurve: [],
      payload,
    };
  }

  // Live read via the read-only HTTP adapter. getMetrics internally fetches
  // /api/summary + all /api/trades/list pages + /api/equity, so it carries the
  // authoritative walletEquity (= summary.last_equity) and the trade set.
  const adapter = createHttpTortilaAdapter(baseUrl, opts.tortilaReadToken);
  try {
    const [metrics, positions, trades, equityCurve] = await Promise.all([
      adapter.getMetrics('tortila_bot'),
      adapter.getPositions('tortila_bot'),
      adapter.getTrades('tortila_bot'),
      adapter.getEquityCurve!('tortila_bot'),
    ]);

    const hasData = metrics.walletEquity > 0 || trades.length > 0 || positions.length > 0 || equityCurve.length > 0;
    if (!hasData) {
      return {
        status: 'empty',
        statusDetail:
          `The Tortila journal at ${payload.baseUrl || baseUrl} responded but reported no equity, trades, or open positions. ` +
          'This usually means the journal process is reading an empty or wrong database (check its DB_PATH / working directory). ' +
          'Live numbers are hidden rather than shown as a fabricated $0 account.',
        adapterMode: opts.mode,
        baseUrl: payload.baseUrl || baseUrl,
        mode: 'unknown',
        atAth: false,
        metrics: null,
        positions: [],
        trades: [],
        equityCurve: [],
        payload,
      };
    }

    // G6: thread the truthful demo/live flag from /api/summary instead of a
    // hard-coded constant. The canary is VST/demo, but this MUST come from data.
    const summary = payload.summary.data;
    const mode: 'demo' | 'live' | 'unknown' = summary?.mode ?? 'unknown';
    // Prefer the journal's own all-time-high flag; fall back to the
    // drawdown-derived guess when /api/summary is unavailable.
    const atAth = summary?.at_ath ?? (metrics.currentDrawdownPct !== null && metrics.currentDrawdownPct < 1e-6);
    return {
      status: 'live',
      statusDetail: null,
      adapterMode: opts.mode,
      baseUrl: payload.baseUrl || baseUrl,
      mode,
      atAth,
      metrics,
      positions,
      trades,
      equityCurve,
      payload,
    };
  } catch (err) {
    // getMetrics throws AdapterNotReadyError on network / schema failure. The
    // message is already secret-free (URL + status only). Surface it honestly.
    return {
      status: 'error',
      statusDetail: err instanceof Error ? err.message : 'Live Tortila journal read failed.',
      adapterMode: opts.mode,
      baseUrl: payload.baseUrl || baseUrl,
      mode: 'unknown',
      atAth: false,
      metrics: null,
      positions: [],
      trades: [],
      equityCurve: [],
      payload,
    };
  }
}
