/**
 * Legacy DCA journal-shim schema + reader sanity tests. These guard the
 * read-only shim contract consumed by the WTC premium DCA dashboard. Every
 * schema must: (1) accept a realistic populated payload, (2) accept the
 * empty/cold-start payload, and (3) reject obviously wrong shapes. The reader
 * must NEVER throw and NEVER leak the bearer token.
 *
 * No live shim — fixtures are inline objects shaped to match the Python
 * serialisers in bot/journal_shim/{app,reconstruct}.py; fetch is stubbed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LegacyHealthSchema,
  LegacySummarySchema,
  LegacyPositionsSchema,
  LegacySymbolBreakdownSchema,
  LegacySignalsSchema,
  LegacyActivitySchema,
  LegacyEquitySchema,
  LegacyDepthDistributionSchema,
} from '../legacy/legacy.shim.schemas.ts';
import {
  createLegacyJournalReader,
  isLegacyJournalError,
} from '../legacy/legacy-journal-reader.ts';

const SUMMARY = {
  now: '2026-06-13T11:00:00+00:00',
  mode: 'LIVE',
  reconstructed: true,
  method: 'Closed-cycle TP reconstruction',
  realized_pnl_net: 1234.5,
  realized_pnl_gross: 1380.2,
  fees_total: 145.7,
  equity_last: 1234.5,
  equity_baseline: 0,
  closed_cycles: 791,
  open_cycles: 2,
  total_cycles: 793,
  tp_completion_rate_pct: 99.7,
  open_positions: 2,
  accounts_running: 2,
  accounts_total: 2,
  tp_pct: 0.0045,
  fee_rate: 0.0005,
};

describe('Legacy shim schemas — populated + cold-start + reject', () => {
  it('summary: full payload parses', () => {
    expect(LegacySummarySchema.safeParse(SUMMARY).success).toBe(true);
  });

  it('health: parses', () => {
    expect(LegacyHealthSchema.safeParse({ ok: true, ts: '2026-06-13T11:00:00+00:00', mode: 'LIVE', reconstructed: true }).success).toBe(true);
  });

  it('positions: averaged_entry may be null (MARKET price=0) without faking 0', () => {
    const ok = LegacyPositionsSchema.safeParse({
      reconstructed: true,
      mark_note: 'Live mark not pulled in v1.',
      rows: [
        { symbol: 'BCH-USDT', side: 'LONG', reason: 'RED', stage: 1, averaging_depth: 3, averaged_entry: null, averaged_entry_available: false, mark_unavailable: true, opened_at: '2026-05-11T00:00:00+00:00', age_hours: 800.5 },
        { symbol: 'FARTCOIN-USDT', side: 'LONG', reason: 'YELLOW', stage: 2, averaging_depth: 3, averaged_entry: 1.23, averaged_entry_available: true, mark_unavailable: true, opened_at: null, age_hours: null },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('symbol breakdown: empty + populated', () => {
    expect(LegacySymbolBreakdownSchema.safeParse({ reconstructed: true, rows: [] }).success).toBe(true);
    expect(LegacySymbolBreakdownSchema.safeParse({
      reconstructed: true,
      rows: [{ symbol: 'TAO-USDT', cycles: 416, closed_cycles: 416, open_cycles: 0, net_pnl: 512.3, gross_pnl: 560, fees: 47.7, avg_depth: 0.4, contribution_pct: 41.5 }],
    }).success).toBe(true);
  });

  it('signals: legend + mix + over_time (period string + reason counts)', () => {
    const ok = LegacySignalsSchema.safeParse({
      reconstructed: true,
      legend: { RED: 'CCI', YELLOW: 'RSI', GREEN: 'other' },
      mix: { RED: 574, YELLOW: 217 },
      over_time: [{ period: '2026-05', RED: 120, YELLOW: 44 }, { period: '2026-06', RED: 90 }],
    });
    expect(ok.success).toBe(true);
  });

  it('activity: open + close rows (net_pnl only on close)', () => {
    const ok = LegacyActivitySchema.safeParse({
      reconstructed: true,
      rows: [
        { ts: '2026-06-13T10:00:00+00:00', kind: 'close', symbol: 'BCH-USDT', reason: 'RED', depth: 3, net_pnl: 4.2, label: 'TP hit' },
        { ts: '2026-06-13T09:00:00+00:00', kind: 'open', symbol: 'TAO-USDT', reason: 'YELLOW', depth: 0, label: 'cycle opened' },
      ],
    });
    expect(ok.success).toBe(true);
  });

  it('equity: aligned arrays accepted; ts/equity length mismatch rejected', () => {
    expect(LegacyEquitySchema.safeParse({
      reconstructed: true, method: 'x', baseline: 0, absolute: false,
      ts: ['2026-06-12', '2026-06-13'], equity: [1, 2], dd_ts: ['2026-06-12', '2026-06-13'], dd_pct: [0, -1.1],
    }).success).toBe(true);
    expect(LegacyEquitySchema.safeParse({
      reconstructed: true, method: 'x', baseline: 0, absolute: false,
      ts: ['2026-06-12', '2026-06-13'], equity: [1], dd_ts: [], dd_pct: [],
    }).success).toBe(false);
    expect(LegacyEquitySchema.safeParse({
      reconstructed: true, method: 'x', baseline: 0, absolute: false,
      ts: [], equity: [], dd_ts: ['2026-06-13'], dd_pct: [],
    }).success).toBe(false);
  });

  it('depth distribution: all + open buckets', () => {
    const ok = LegacyDepthDistributionSchema.safeParse({
      reconstructed: true,
      note: 'depth N/3 = how stuck',
      all: [{ depth: 0, count: 680 }, { depth: 1, count: 101 }, { depth: 2, count: 4 }, { depth: 3, count: 6 }],
      open: [{ depth: 3, count: 2 }],
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a payload missing required keys', () => {
    expect(LegacySummarySchema.safeParse({ mode: 'LIVE' }).success).toBe(false);
  });
});

describe('Legacy journal reader — token gate + error envelope (never throws, never leaks)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an error envelope (never throws) when token is missing', async () => {
    const reader = createLegacyJournalReader('http://localhost:8090');
    const result = await reader.getSummary();
    expect(isLegacyJournalError(result)).toBe(true);
    if (isLegacyJournalError(result)) expect(result.error).toContain('LEGACY_JOURNAL_TOKEN');
  });

  it('strips trailing slash and never exposes the token value', () => {
    const reader = createLegacyJournalReader('http://localhost:8090/', 'secret-token');
    expect(reader.baseUrl).toBe('http://localhost:8090');
    expect(reader.hasToken).toBe(true);
    expect(JSON.stringify(reader)).not.toContain('secret-token');
  });

  it('returns parsed data on a good payload (behavioral, stubbed fetch)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => SUMMARY })));
    const reader = createLegacyJournalReader('http://localhost:8090', 'tok');
    const result = await reader.getSummary();
    expect(isLegacyJournalError(result)).toBe(false);
    if (!isLegacyJournalError(result)) expect(result.closed_cycles).toBe(791);
  });

  it('returns an error envelope (never throws) on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const reader = createLegacyJournalReader('http://localhost:8090', 'tok');
    const result = await reader.getSummary();
    expect(isLegacyJournalError(result)).toBe(true);
  });

  it('returns an error envelope (never fabricates) on a schema-mismatch payload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ wrong: 'shape' }) })));
    const reader = createLegacyJournalReader('http://localhost:8090', 'tok');
    const result = await reader.getSummary();
    expect(isLegacyJournalError(result)).toBe(true);
  });

  it('sends Authorization: Bearer with the token', async () => {
    const spy = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({ ok: true, status: 200, json: async () => SUMMARY }));
    vi.stubGlobal('fetch', spy);
    const reader = createLegacyJournalReader('http://localhost:8090', 'tok');
    await reader.getSummary();
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.authorization).toBe('Bearer tok');
  });

  it('getAccounts() hits /api/accounts and parses safe rows', async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => ({
      reconstructed: true,
      rows: [{ pub_id: 'ACCT_A', market: 'BINGX', running: true, quarantined: false, quarantine_reason: null, orders: 3, cycles: 1, open_slots: 1, symbols: 1 }],
    }) }));
    vi.stubGlobal('fetch', spy);
    const reader = createLegacyJournalReader('http://localhost:8090', 'tok');
    const res = await reader.getAccounts();
    expect(spy.mock.calls[0]?.[0]).toContain('/api/accounts');
    expect(isLegacyJournalError(res)).toBe(false);
    if (!isLegacyJournalError(res)) expect(res.rows[0]?.pub_id).toBe('ACCT_A');
  });

  it('account scoping appends ?api_id= (merging with an existing query string)', async () => {
    const spy = vi.fn((_url: string) => Promise.resolve({ ok: true, status: 200, json: async () => SUMMARY }));
    vi.stubGlobal('fetch', spy);
    const reader = createLegacyJournalReader('http://localhost:8090', 'tok');
    await reader.getSummary('PUBID123');
    expect(spy.mock.calls[0]?.[0]).toContain('/api/summary?api_id=PUBID123');
    await reader.getActivity(50, 'PUBID123');
    expect(spy.mock.calls[1]?.[0]).toContain('/api/activity?limit=50&api_id=PUBID123');
    // No accountId = aggregate (no api_id param).
    await reader.getEquity();
    expect(spy.mock.calls[2]?.[0]).not.toContain('api_id=');
  });
});
