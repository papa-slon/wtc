/**
 * Real, READ-ONLY HTTP adapters. Used only when BOT_ADAPTER_MODE is `read-only` or `audited`.
 * They issue GETs only — never any control/mutation. Endpoint→canonical mappings whose exact JSON
 * shape is not yet confirmed throw AdapterNotReadyError (honest stub) rather than fabricating data.
 * The Tortila P0/P1 warnings persist here too — switching to real data must NOT hide known issues.
 * See docs/CONTRACTS/tortila-adapter.md and legacy-bot-adapter.md.
 *
 * SAFETY: DO NOT call /api/marks from WTC. The bot owns the exchange connection.
 *         DO NOT enable any live exchange call or SSH/tmux interaction from this file.
 *         Control methods (startBot/stopBot/applyConfig) are and must remain DISABLED.
 */
import { computeMetrics, filterZeroEquity, type CanonicalMetrics, type CanonicalPosition, type CanonicalTrade, type EquityPoint } from '@wtc/analytics';
import type { BotAdapter, BotConfigView, BotHealth, BotProductCode, ReadState, RiskWarning, ValidationResult } from './types.ts';
import { ADAPTER_STALE_THRESHOLD_MS } from './types.ts';
import { assertBotControlAllowed } from './control.ts';
import { TORTILA_PERSISTENT_WARNINGS } from './warnings.ts';
import {
  TortilaHealthSchema,
  TortilaSummarySchema,
  TortilaTradeListSchema,
  TortilaEquityCurveSchema,
} from './tortila/tortila.schemas.ts';
import {
  healthToCanonical,
  tradeRowToCanonical,
  positionSummaryToCanonical,
  equityCurveToPoints,
} from './tortila/tortila.mapping.ts';

export class AdapterNotReadyError extends Error {
  constructor(productCode: string, method: string, detail?: string) {
    super(
      detail
        ? `Real ${productCode} adapter method "${method}" failed: ${detail}`
        : `Real ${productCode} adapter method "${method}" is not verified yet. Confirm the endpoint JSON shape in docs/CONTRACTS, then implement the mapping. Until then, use the mock adapter.`,
    );
    this.name = 'AdapterNotReadyError';
  }
}

async function getJson(url: string, timeoutMs = 4000, token?: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    // JOURNAL_READ_TOKEN → bearer auth. Only attached when a token is configured; the value is NEVER
    // logged, returned, or placed in an error message (errors interpolate only the URL + HTTP status).
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function disabledControl(productCode: BotProductCode) {
  return {
    async startBot(): Promise<never> {
      assertBotControlAllowed('startBot', false, false);
      throw new Error('unreachable');
    },
    async stopBot(): Promise<never> {
      assertBotControlAllowed('stopBot', false, false);
      throw new Error('unreachable');
    },
    async applyConfig(): Promise<never> {
      assertBotControlAllowed('applyConfig', false, false);
      throw new Error('unreachable');
    },
    productCode,
  };
}

/**
 * Tortila journal (:8080) read-only adapter.
 *
 * Implemented endpoints:
 *   getHealth      → GET /api/health (always safe; never throws; fail-closed to processAlive=false)
 *   getMetrics     → GET /api/summary + GET /api/trades/list (all pages); calls computeMetrics
 *   getPositions   → GET /api/summary → open_position_summaries
 *   getTrades      → GET /api/trades/list (paginated, page_size=500, all pages)
 *   getEquityCurve → GET /api/equity; applies filterZeroEquity
 *
 * NEVER calls /api/marks — bot owns the exchange connection. See F-07 in tortila-journal-auditor.
 *
 * getConfig is NOT implemented — journal has no /api/config endpoint (see contract).
 * Control methods are DISABLED unconditionally — never route start/stop/applyConfig here.
 */
export function createHttpTortilaAdapter(baseUrl: string, token?: string): BotAdapter {
  const base = baseUrl.replace(/\/$/, '');

  function requireReadToken(method: string): string {
    if (!token) {
      throw new AdapterNotReadyError('tortila', method, 'JOURNAL_READ_TOKEN is not set - refusing unauthenticated journal read');
    }
    return token;
  }

  /** Fetch all pages of /api/trades/list (page_size=500) and return all rows. */
  async function fetchAllTrades(method = 'getTrades'): Promise<CanonicalTrade[]> {
    const readToken = requireReadToken(method);
    const all: CanonicalTrade[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const raw = await getJson(`${base}/api/trades/list?page=${page}&page_size=500`, 4000, readToken);
      const parsed = TortilaTradeListSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AdapterNotReadyError('tortila', 'getTrades', `schema mismatch at page ${page}: ${parsed.error.message}`);
      }
      const data = parsed.data;
      totalPages = data.pages;
      for (const row of data.rows) {
        all.push(tradeRowToCanonical(row));
      }
      page += 1;
    }
    return all;
  }

  return {
    ...disabledControl('tortila_bot'),
    productCode: 'tortila_bot',
    mode: 'real',

    async getWarnings(): Promise<RiskWarning[]> {
      // The unresolved P0/P1 are surfaced unconditionally. Signal warnings (101211/100410/…) are
      // derived from journal logs once that endpoint is confirmed — none are fabricated here yet.
      return TORTILA_PERSISTENT_WARNINGS;
    },

    /**
     * Read-only health with a first-class readState. NEVER throws — every failure mode maps to a
     * returned BotHealth so the worker tick and the dashboard render an honest, specific status:
     *   not_configured (no token) · unreachable (network/non-2xx) · malformed (bad shape) · stale (old ts) · ok.
     * The P0/P1 warnings are attached in every branch (a read failure must not hide known issues).
     */
    async getHealth(): Promise<BotHealth> {
      const warnings = await this.getWarnings();
      const failClosed = (readState: ReadState, detail: string): BotHealth => ({
        productCode: 'tortila_bot',
        processAlive: false,
        status: 'down',
        readState,
        readStateDetail: detail,
        lastSyncAt: null,
        staleDataSeconds: null,
        uptimeSeconds: null,
        warnings,
      });

      // not_configured: a real adapter cannot authenticate to the journal without a read token.
      if (!token) return failClosed('not_configured', 'JOURNAL_READ_TOKEN is not set — cannot authenticate to the journal');

      // unreachable: network error / timeout / non-2xx (message carries the URL + status, never the token).
      let raw: unknown;
      try {
        raw = await getJson(`${base}/api/health`, 4000, token);
      } catch (err) {
        return failClosed('unreachable', `journal /api/health unreachable: ${err instanceof Error ? err.message : 'network error'}`);
      }

      // malformed: a 2xx body that fails schema validation.
      const parsed = TortilaHealthSchema.safeParse(raw);
      if (!parsed.success) return failClosed('malformed', 'journal /api/health response failed schema validation');

      // ts parse failure is treated as malformed (not stale) to avoid false positives.
      const tsMs = Date.parse(parsed.data.ts);
      if (Number.isNaN(tsMs)) return failClosed('malformed', 'journal /api/health ts is not a parseable timestamp');

      const ageMs = Date.now() - tsMs;
      const healthy = healthToCanonical(parsed.data); // status 'degraded' (P0/P1 unresolved), readState 'ok'
      if (ageMs > ADAPTER_STALE_THRESHOLD_MS) {
        return { ...healthy, status: 'stale', readState: 'stale', readStateDetail: `journal data is ${Math.round(ageMs / 1000)}s old`, warnings };
      }
      return { ...healthy, readState: 'ok', warnings };
    },

    async getConfig(): Promise<BotConfigView> {
      // Journal has no /api/config endpoint. See docs/CONTRACTS/tortila-adapter.md.
      throw new AdapterNotReadyError('tortila', 'getConfig');
    },

    async getMetrics(): Promise<CanonicalMetrics> {
      const readToken = requireReadToken('getMetrics');
      // Step 1: fetch summary for aggregate fields (walletEquity, firstEquity, openPositions, etc.)
      let rawSummary: unknown;
      try {
        rawSummary = await getJson(`${base}/api/summary`, 4000, readToken);
      } catch (err) {
        throw new AdapterNotReadyError('tortila', 'getMetrics', `network error fetching /api/summary: ${err instanceof Error ? err.message : String(err)}`);
      }
      const summaryParsed = TortilaSummarySchema.safeParse(rawSummary);
      if (!summaryParsed.success) {
        throw new AdapterNotReadyError('tortila', 'getMetrics', `summary schema mismatch: ${summaryParsed.error.message}`);
      }
      const summary = summaryParsed.data;

      // Step 2: fetch all trades (Option B — individual trades for correct fee-sign handling)
      let trades: CanonicalTrade[];
      try {
        trades = await fetchAllTrades('getMetrics');
      } catch (err) {
        if (err instanceof AdapterNotReadyError) throw err;
        throw new AdapterNotReadyError('tortila', 'getMetrics', `network error fetching trades: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Step 3: fetch equity curve
      let rawEquity: unknown;
      try {
        rawEquity = await getJson(`${base}/api/equity`, 4000, readToken);
      } catch {
        rawEquity = null; // equity is non-fatal for metrics; fall through to filterZeroEquity([])
      }
      const equityParsed = TortilaEquityCurveSchema.safeParse(rawEquity);
      const equityCurve: EquityPoint[] = equityParsed.success
        ? equityCurveToPoints(equityParsed.data)
        : filterZeroEquity([]); // fail-open on equity (non-fatal); log shape issue via return

      // Step 4: map positions for openPositions count in computeMetrics
      const positions = summary.open_position_summaries.map(positionSummaryToCanonical);

      return computeMetrics({
        trades,
        positions,
        equityCurve,
        walletEquity: summary.last_equity,
        firstEquity: summary.first_equity > 0 ? summary.first_equity : null,
        safetyEventCount: TORTILA_PERSISTENT_WARNINGS.filter((w) => w.severity !== 'info').length,
      });
    },

    async getPositions(_instanceId: string): Promise<CanonicalPosition[]> {
      const readToken = requireReadToken('getPositions');
      let rawSummary: unknown;
      try {
        rawSummary = await getJson(`${base}/api/summary`, 4000, readToken);
      } catch (err) {
        throw new AdapterNotReadyError('tortila', 'getPositions', `network error: ${err instanceof Error ? err.message : String(err)}`);
      }
      const parsed = TortilaSummarySchema.safeParse(rawSummary);
      if (!parsed.success) {
        throw new AdapterNotReadyError('tortila', 'getPositions', `summary schema mismatch: ${parsed.error.message}`);
      }
      return parsed.data.open_position_summaries.map(positionSummaryToCanonical);
    },

    async getTrades(_instanceId: string): Promise<CanonicalTrade[]> {
      try {
        return await fetchAllTrades();
      } catch (err) {
        if (err instanceof AdapterNotReadyError) throw err;
        throw new AdapterNotReadyError('tortila', 'getTrades', `network error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },

    async getEquityCurve(_instanceId: string): Promise<EquityPoint[]> {
      const readToken = requireReadToken('getEquityCurve');
      let rawEquity: unknown;
      try {
        rawEquity = await getJson(`${base}/api/equity`, 4000, readToken);
      } catch (err) {
        throw new AdapterNotReadyError('tortila', 'getEquityCurve', `network error: ${err instanceof Error ? err.message : String(err)}`);
      }
      const parsed = TortilaEquityCurveSchema.safeParse(rawEquity);
      if (!parsed.success) {
        throw new AdapterNotReadyError('tortila', 'getEquityCurve', `equity schema mismatch: ${parsed.error.message}`);
      }
      return equityCurveToPoints(parsed.data);
    },

    async validateConfig(): Promise<ValidationResult> {
      return { ok: false, errors: ['real adapter validateConfig not implemented'] };
    },
  };
}

// NOTE: the real legacy HTTP adapter (createHttpLegacyAdapter) was DELETED in Phase 2.8 / PG3.
// The legacy /api_management/ endpoint returns plaintext exchange keys (docs/PRODUCTION_BLOCKERS.md B3),
// so there must be NO code path that fetches it. The factory routes the legacy bot to
// createLegacyBlockedAdapter (packages/bot-adapters/src/legacy/legacy-blocked.ts) in every non-mock mode
// and to createMockLegacyAdapter in mock mode. Re-introducing a real legacy adapter requires the upstream
// key fix + the 5 BOT_CONTROL_SAFETY_MODEL gates. The Zod plaintext-key exclusion schema
// (legacy/legacy-plaintext-exclusion.ts) must be applied to any future legacy body before mapping.
