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
  LegacyAccountsSchema,
  type LegacyHealth,
  type LegacySummary,
  type LegacyPositions,
  type LegacySymbolBreakdown,
  type LegacySignals,
  type LegacyActivity,
  type LegacyEquity,
  type LegacyDepthDistribution,
  type LegacyAccounts,
} from './legacy.shim.schemas.ts';

/** Append `?api_id=<accountId>` (account scoping) to a path, merging with any
 *  existing query string. The value is URL-encoded. No accountId = aggregate. */
function withAccount(path: string, accountId?: string): string {
  if (!accountId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}api_id=${encodeURIComponent(accountId)}`;
}

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
  /** GET /api/accounts — the trading accounts for the switcher (SAFE columns only; never keys). */
  getAccounts(): Promise<LegacyJournalResult<LegacyAccounts>>;
  /** Each read below takes an optional `accountId` (= pub_id) to scope to one account; omit = aggregate. */
  getSummary(accountId?: string): Promise<LegacyJournalResult<LegacySummary>>;
  getPositions(accountId?: string): Promise<LegacyJournalResult<LegacyPositions>>;
  getSymbolBreakdown(accountId?: string): Promise<LegacyJournalResult<LegacySymbolBreakdown>>;
  getSignals(accountId?: string): Promise<LegacyJournalResult<LegacySignals>>;
  getActivity(limit?: number, accountId?: string): Promise<LegacyJournalResult<LegacyActivity>>;
  getEquity(accountId?: string): Promise<LegacyJournalResult<LegacyEquity>>;
  getDepthDistribution(accountId?: string): Promise<LegacyJournalResult<LegacyDepthDistribution>>;
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
    getAccounts() {
      return fetchAndParse('/api/accounts', LegacyAccountsSchema);
    },
    getSummary(accountId) {
      return fetchAndParse(withAccount('/api/summary', accountId), LegacySummarySchema);
    },
    getPositions(accountId) {
      return fetchAndParse(withAccount('/api/positions', accountId), LegacyPositionsSchema);
    },
    getSymbolBreakdown(accountId) {
      return fetchAndParse(withAccount('/api/symbol_breakdown', accountId), LegacySymbolBreakdownSchema);
    },
    getSignals(accountId) {
      return fetchAndParse(withAccount('/api/signals', accountId), LegacySignalsSchema);
    },
    getActivity(limit = 80, accountId) {
      const l = Math.min(500, Math.max(10, Math.floor(limit)));
      return fetchAndParse(withAccount(`/api/activity?limit=${l}`, accountId), LegacyActivitySchema);
    },
    getEquity(accountId) {
      return fetchAndParse(withAccount('/api/equity', accountId), LegacyEquitySchema);
    },
    getDepthDistribution(accountId) {
      return fetchAndParse(withAccount('/api/depth_distribution', accountId), LegacyDepthDistributionSchema);
    },
  };
}
