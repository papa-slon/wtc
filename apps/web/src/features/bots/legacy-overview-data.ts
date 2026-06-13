import 'server-only';
import {
  createLegacyJournalReader,
  isLegacyJournalError,
  type LegacyAccount,
  type LegacyActivity,
  type LegacyDepthDistribution,
  type LegacyEquity,
  type LegacyJournalReadError,
  type LegacyPositions,
  type LegacySignals,
  type LegacySummary,
  type LegacySymbolBreakdown,
} from '@wtc/bot-adapters';
import { botAdapterOptions } from '@/lib/server-config';

// ---------------------------------------------------------------------------
// Legacy (DCA/averaging) premium overview data layer — the "PLUG DATA SOURCE"
// seam. Mirrors tortila-overview-data.ts, but the legacy bot has NO canonical
// adapter feed (its control adapter is hard-blocked) and NO realized-PnL/equity
// tables — every money figure here is RECONSTRUCTED by the read-only journal
// shim from the closed-cycle order ladder and is labelled accordingly. The
// LEGACY_JOURNAL_TOKEN never leaves this module.
//
// This path is INDEPENDENT of getBotAdapter()/createLegacyBlockedAdapter — it
// never calls the blocked /api_management control adapter.
// ---------------------------------------------------------------------------

export interface LegacyOverviewSlice<T> {
  data: T | null;
  error: string | null;
}

/** All-in-one premium DCA-dashboard payload. Each slice is independent; one
 *  endpoint failing never blocks the others. DELIBERATELY omits the Tortila-only
 *  slices (advanced/monthly/calendar/distribution/marks/trades) — the shim does
 *  not serve them and the DCA page does not render them. */
export interface LegacyOverviewPayload {
  configured: boolean;
  baseUrl: string;
  assembledAt: string;
  adapterMode: 'mock' | 'read-only' | 'audited';
  /** From /api/health — money is reconstructed, not exchange-confirmed. */
  reconstructed: boolean;
  /** Bot trading mode from /api/health|summary ('LIVE' → 'live'). No demo branch. */
  mode: 'live' | 'unknown';
  /** Scoped account (pub_id) when one was requested, else null = aggregate across accounts. */
  accountId: string | null;
  /** Reconstruction method string (from /api/summary) surfaced in the standing honesty banner. */
  reconMethod: string | null;
  /** Live-mark caveat (from /api/positions) — rendered once. */
  markNote: string | null;
  summary: LegacyOverviewSlice<LegacySummary>;
  positions: LegacyOverviewSlice<LegacyPositions>;
  symbolBreakdown: LegacyOverviewSlice<LegacySymbolBreakdown>;
  signals: LegacyOverviewSlice<LegacySignals>;
  activity: LegacyOverviewSlice<LegacyActivity>;
  equity: LegacyOverviewSlice<LegacyEquity>;
  depthDistribution: LegacyOverviewSlice<LegacyDepthDistribution>;
}

function wrap<T>(value: T | LegacyJournalReadError): LegacyOverviewSlice<T> {
  if (isLegacyJournalError(value)) return { data: null, error: value.error };
  return { data: value, error: null };
}

function notConfiguredReason(mode: 'mock' | 'read-only' | 'audited', baseUrl: string, hasToken: boolean): string {
  if (mode === 'mock') {
    return 'BOT_ADAPTER_MODE is mock — the legacy journal shim is not contacted. Set BOT_ADAPTER_MODE=read-only with LEGACY_JOURNAL_URL and LEGACY_JOURNAL_TOKEN to read reconstructed data.';
  }
  if (!baseUrl) return 'LEGACY_JOURNAL_URL is not set — set the read-only legacy journal shim base URL.';
  if (!hasToken) return 'LEGACY_JOURNAL_TOKEN is not set — the legacy journal shim requires bearer authentication.';
  return 'The legacy journal shim is not configured for this environment.';
}

const EMPTY_SLICE = { data: null, error: null as string | null };

/**
 * Fetch the reconstructed DCA-dashboard payload from the legacy journal shim.
 * Honest fallback: when the adapter is in `mock` mode OR the shim URL/token is
 * absent, every slice carries an explanatory `error` (NEVER synthetic data).
 */
export async function loadLegacyOverviewPayload(accountId?: string): Promise<LegacyOverviewPayload> {
  const opts = botAdapterOptions();
  const baseUrl = opts.legacyJournalUrl ?? '';
  const configured = opts.mode !== 'mock' && Boolean(baseUrl) && Boolean(opts.legacyReadToken);
  const assembledAt = new Date().toISOString();

  if (!configured) {
    const reason = notConfiguredReason(opts.mode, baseUrl, Boolean(opts.legacyReadToken));
    return {
      configured: false,
      baseUrl,
      assembledAt,
      adapterMode: opts.mode,
      reconstructed: true,
      mode: 'unknown',
      accountId: accountId ?? null,
      reconMethod: null,
      markNote: null,
      summary: { ...EMPTY_SLICE, error: reason },
      positions: { ...EMPTY_SLICE, error: reason },
      symbolBreakdown: { ...EMPTY_SLICE, error: reason },
      signals: { ...EMPTY_SLICE, error: reason },
      activity: { ...EMPTY_SLICE, error: reason },
      equity: { ...EMPTY_SLICE, error: reason },
      depthDistribution: { ...EMPTY_SLICE, error: reason },
    };
  }

  const reader = createLegacyJournalReader(baseUrl, opts.legacyReadToken);
  const [health, summary, positions, symbolBreakdown, signals, activity, equity, depthDistribution] = await Promise.all([
    reader.getHealth(),
    reader.getSummary(accountId),
    reader.getPositions(accountId),
    reader.getSymbolBreakdown(accountId),
    reader.getSignals(accountId),
    reader.getActivity(80, accountId),
    reader.getEquity(accountId),
    reader.getDepthDistribution(accountId),
  ]);

  const summarySlice = wrap(summary);
  const positionsSlice = wrap(positions);
  const healthData = isLegacyJournalError(health) ? null : health;
  // Mode is authoritative from /api/health (falls back to /api/summary), normalised to live|unknown.
  const rawMode = healthData?.mode ?? summarySlice.data?.mode ?? '';
  const mode: 'live' | 'unknown' = rawMode.toUpperCase() === 'LIVE' ? 'live' : 'unknown';

  return {
    configured: true,
    baseUrl: reader.baseUrl,
    assembledAt,
    adapterMode: opts.mode,
    reconstructed: healthData?.reconstructed ?? true,
    mode,
    accountId: accountId ?? null,
    reconMethod: summarySlice.data?.method ?? null,
    markNote: positionsSlice.data?.mark_note ?? null,
    summary: summarySlice,
    positions: positionsSlice,
    symbolBreakdown: wrap(symbolBreakdown),
    signals: wrap(signals),
    activity: wrap(activity),
    equity: wrap(equity),
    depthDistribution: wrap(depthDistribution),
  };
}

// ---------------------------------------------------------------------------
// LIVE read with status + derived DCA scalars (mirrors loadTortilaLiveOverview).
// There is NO canonical metrics/positions/trades/equityCurve read for legacy —
// everything comes from the shim payload + a few scalars derived here.
// ---------------------------------------------------------------------------

export type LegacyLiveStatus = 'live' | 'empty' | 'not-configured' | 'error';

export interface LegacyLiveOverview {
  status: LegacyLiveStatus;
  /** Human-readable reason for any non-`live` status (rendered verbatim). */
  statusDetail: string | null;
  mode: 'live' | 'unknown';
  reconstructed: boolean;
  baseUrl: string;
  adapterMode: 'mock' | 'read-only' | 'audited';
  payload: LegacyOverviewPayload;
  /** Weighted mean averaging depth across all cycles (from depth_distribution). */
  avgDepth: number | null;
  /** Reconstructed net PnL per closed cycle. */
  netPerCycle: number | null;
  /** ISO date the reconstructed tracking window starts (equity.ts[0]). */
  sinceIso: string | null;
  /** Count of currently-open "stuck" bags. */
  openBags: number;
  /** Deepest currently-open averaging depth (e.g. 3 for a 3/3 bag). */
  worstOpenDepth: number | null;
  /** Sum of today's (UTC) reconstructed take-profit close PnL from the activity feed. */
  todayPnl: number;
}

function weightedAvgDepth(dist: LegacyDepthDistribution | null): number | null {
  if (!dist || dist.all.length === 0) return null;
  let num = 0;
  let den = 0;
  for (const b of dist.all) {
    num += b.depth * b.count;
    den += b.count;
  }
  return den > 0 ? num / den : null;
}

function todayClosePnl(activity: LegacyActivity | null): number {
  if (!activity) return 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const startMs = start.getTime();
  let sum = 0;
  for (const r of activity.rows) {
    if (r.kind !== 'close' || typeof r.net_pnl !== 'number') continue;
    const t = Date.parse(r.ts);
    if (Number.isFinite(t) && t >= startMs) sum += r.net_pnl;
  }
  return sum;
}

/**
 * Read the legacy premium overview LIVE from the journal shim (reconstructed),
 * with an honest status. Never throws. The token never leaves this module. When
 * the shim is unconfigured/unreachable/empty, the relevant `status` is returned
 * and the page renders an honest, non-fabricated state.
 */
export async function loadLegacyLiveOverview(accountId?: string): Promise<LegacyLiveOverview> {
  const opts = botAdapterOptions();
  const baseUrl = opts.legacyJournalUrl ?? '';
  const configured = opts.mode !== 'mock' && Boolean(baseUrl) && Boolean(opts.legacyReadToken);
  const payload = await loadLegacyOverviewPayload(accountId);

  const base = {
    mode: payload.mode,
    reconstructed: payload.reconstructed,
    baseUrl: payload.baseUrl || baseUrl,
    adapterMode: opts.mode,
    payload,
    avgDepth: null as number | null,
    netPerCycle: null as number | null,
    sinceIso: null as string | null,
    openBags: 0,
    worstOpenDepth: null as number | null,
    todayPnl: 0,
  };

  if (!configured) {
    return {
      ...base,
      status: 'not-configured',
      statusDetail: notConfiguredReason(opts.mode, baseUrl, Boolean(opts.legacyReadToken)),
    };
  }

  // A transport/shape failure on the authoritative summary slice ⇒ error state.
  const summary = payload.summary.data;
  if (!summary && payload.summary.error) {
    return {
      ...base,
      status: 'error',
      statusDetail: `The legacy journal shim at ${payload.baseUrl || baseUrl} did not return a valid summary: ${payload.summary.error}`,
    };
  }

  const positions = payload.positions.data;
  const equity = payload.equity.data;
  const closedCycles = summary?.closed_cycles ?? 0;
  const openRows = positions?.rows ?? [];
  const equityLen = equity?.ts.length ?? 0;

  // Honest-empty guard: the shim responded but reconstructed nothing. Show the
  // honest "no data" state rather than a fabricated $0 / empty dashboard.
  const hasData = closedCycles > 0 || openRows.length > 0 || equityLen > 0;
  if (!hasData) {
    return {
      ...base,
      status: 'empty',
      statusDetail:
        `The legacy journal shim at ${payload.baseUrl || baseUrl} responded but reconstructed no closed cycles, ` +
        'open positions, or equity history. This usually means the shim is reading an empty or wrong database. ' +
        'Reconstructed numbers are hidden rather than shown as a fabricated empty account.',
    };
  }

  const avgDepth = weightedAvgDepth(payload.depthDistribution.data);
  const netPerCycle = summary && closedCycles > 0 ? summary.realized_pnl_net / closedCycles : null;
  const sinceIso = equity?.ts[0] ?? null;
  const worstOpenDepth = openRows.length > 0 ? Math.max(...openRows.map((r) => r.averaging_depth)) : null;

  return {
    ...base,
    status: 'live',
    statusDetail: null,
    avgDepth,
    netPerCycle,
    sinceIso,
    openBags: summary?.open_positions ?? openRows.length,
    worstOpenDepth,
    todayPnl: todayClosePnl(payload.activity.data),
  };
}

export interface LegacyAccountsResult {
  configured: boolean;
  accounts: LegacyAccount[];
  error: string | null;
}

/**
 * List the legacy trading accounts for the account switcher. SAFE columns only
 * — the shim never returns keys/secrets/owner-login.
 *
 * CALLER CONTRACT (security-critical): the shim cannot authenticate the operator,
 * so callers MUST gate this behind `isAdmin(user)` (or a future per-user owned-
 * account filter). An ungated caller would re-open cross-tenant account
 * enumeration. The sole caller today (statistics/page.tsx) is admin-gated, and a
 * static test asserts that gate. This loader is a pure read; never throws; the
 * token stays server-side.
 */
export async function loadLegacyAccounts(): Promise<LegacyAccountsResult> {
  const opts = botAdapterOptions();
  const baseUrl = opts.legacyJournalUrl ?? '';
  const configured = opts.mode !== 'mock' && Boolean(baseUrl) && Boolean(opts.legacyReadToken);
  if (!configured) {
    return { configured: false, accounts: [], error: notConfiguredReason(opts.mode, baseUrl, Boolean(opts.legacyReadToken)) };
  }
  const reader = createLegacyJournalReader(baseUrl, opts.legacyReadToken);
  const res = await reader.getAccounts();
  if (isLegacyJournalError(res)) return { configured: true, accounts: [], error: res.error };
  return { configured: true, accounts: res.rows, error: null };
}
