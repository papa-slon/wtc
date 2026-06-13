/**
 * Tortila extended-schema sanity tests. These guard the journal-side contract
 * consumed by the WTC premium dashboard. Every schema must:
 *   1. accept the empty/cold-start payload (no trades, no equity samples), and
 *   2. accept a realistic, fully-populated payload, and
 *   3. reject obviously wrong shapes (missing required keys / length mismatch).
 *
 * No network — fixtures are inline objects shaped to match the Python
 * serialisers in bot_tortila/src/turtle_bot/journal/{app,metrics}.py.
 */
import { describe, expect, it } from 'vitest';
import {
  TortilaAdvancedMetricsSchema,
  TortilaActivitySchema,
  TortilaCalendarSchema,
  TortilaDistributionSchema,
  TortilaDrawdownSeriesSchema,
  TortilaMarksSchema,
  TortilaMonthlySchema,
  TortilaSymbolBreakdownSchema,
} from '../tortila/tortila.extended.schemas.ts';
import {
  createTortilaJournalReader,
  isTortilaJournalError,
} from '../tortila/tortila-journal-reader.ts';

describe('Tortila extended schemas — empty / cold-start payloads', () => {
  it('advanced metrics: nullable fields at cold start', () => {
    const cold = {
      performance: {
        sharpe: null,
        sortino: null,
        calmar: null,
        recovery_factor: null,
        cagr_pct: null,
        vol_daily_pct: null,
        mean_daily_pct: null,
        total_return_pct: null,
        best_day_pct: 0,
        worst_day_pct: 0,
        time_in_market_pct: 0,
        trades_per_week: 0,
        period_returns: { today_pct: null, d7_pct: null, d30_pct: null, d90_pct: null, ytd_pct: null, all_pct: null },
      },
      trades: {
        count: 0, wins: 0, losses: 0, scratches: 0,
        win_rate_pct: 0, loss_rate_pct: 0,
        avg_win: 0, avg_loss: 0, largest_win: 0, largest_loss: 0,
        profit_factor: null, expectancy: 0, gross_profit: 0, gross_loss: 0,
        avg_hold_hours: 0, max_consec_wins: 0, max_consec_losses: 0,
      },
      drawdown: {
        max_dd_pct: 0, max_dd_usd: 0,
        max_dd_start: null, max_dd_trough: null, max_dd_recovered: null,
        max_dd_duration_days: 0, longest_underwater_days: 0,
        avg_dd_pct: 0, current_dd_pct: 0,
      },
      best_day: { date: null, pnl: 0 },
      worst_day: { date: null, pnl: 0 },
    };
    const parsed = TortilaAdvancedMetricsSchema.safeParse(cold);
    expect(parsed.success).toBe(true);
  });

  it('symbol breakdown: empty rows array', () => {
    expect(TortilaSymbolBreakdownSchema.safeParse({ rows: [] }).success).toBe(true);
  });

  it('monthly: empty rows array', () => {
    expect(TortilaMonthlySchema.safeParse({ rows: [] }).success).toBe(true);
  });

  it('calendar: empty grid still valid', () => {
    const ok = TortilaCalendarSchema.safeParse({
      start: '2026-01-01',
      end: '2026-06-13',
      days: [],
      max_abs: 0,
    });
    expect(ok.success).toBe(true);
  });

  it('distribution: empty histogram', () => {
    expect(TortilaDistributionSchema.safeParse({ edges: [], counts: [], wins: 0, losses: 0 }).success).toBe(true);
  });

  it('drawdown series: zero-length arrays accepted', () => {
    expect(TortilaDrawdownSeriesSchema.safeParse({ ts: [], dd_pct: [], peak: [] }).success).toBe(true);
  });

  it('marks: empty marks map', () => {
    const ok = TortilaMarksSchema.safeParse({ ts: '2026-06-13T00:00:00+00:00', ttl_sec: 30, marks: {}, stale: false });
    expect(ok.success).toBe(true);
  });

  it('activity: empty rows', () => {
    expect(TortilaActivitySchema.safeParse({ rows: [] }).success).toBe(true);
  });
});

describe('Tortila extended schemas — realistic populated payloads', () => {
  it('advanced metrics with populated values', () => {
    const populated = {
      performance: {
        sharpe: 1.4, sortino: 1.9, calmar: 2.2, recovery_factor: 3.5,
        cagr_pct: 38.4, vol_daily_pct: 1.8, mean_daily_pct: 0.21,
        total_return_pct: 41.2,
        best_day_pct: 5.3, worst_day_pct: -3.1, time_in_market_pct: 64,
        trades_per_week: 3.2,
        period_returns: { today_pct: 0.21, d7_pct: 2.3, d30_pct: 6.5, d90_pct: 18, ytd_pct: 41.2, all_pct: 41.2 },
      },
      trades: {
        count: 88, wins: 52, losses: 36, scratches: 0,
        win_rate_pct: 59.1, loss_rate_pct: 40.9,
        avg_win: 142.5, avg_loss: -88.3,
        largest_win: 1820, largest_loss: -610,
        profit_factor: 1.85, expectancy: 47.3, gross_profit: 7410, gross_loss: 3179,
        avg_hold_hours: 16.4, max_consec_wins: 7, max_consec_losses: 3,
      },
      drawdown: {
        max_dd_pct: 11.4, max_dd_usd: 22380, max_dd_start: '2026-03-01T00:00:00+00:00',
        max_dd_trough: '2026-03-08T00:00:00+00:00', max_dd_recovered: '2026-03-22T00:00:00+00:00',
        max_dd_duration_days: 21, longest_underwater_days: 28, avg_dd_pct: 4.1, current_dd_pct: 0,
      },
      best_day: { date: '2026-04-02', pnl: 1820 },
      worst_day: { date: '2026-03-08', pnl: -1450 },
    };
    expect(TortilaAdvancedMetricsSchema.safeParse(populated).success).toBe(true);
  });

  it('symbol breakdown row', () => {
    const ok = TortilaSymbolBreakdownSchema.safeParse({
      rows: [{
        symbol: 'NEAR-USDT:USDT', trades: 18, wins: 11, losses: 7,
        win_rate_pct: 61.1, net_pnl: 412.5, gross_profit: 720, gross_loss: -307.5,
        profit_factor: 2.34, avg_hold_hours: 22.5, contribution_pct: 18.4,
        best_trade: 220, worst_trade: -88,
      }],
    });
    expect(ok.success).toBe(true);
  });

  it('drawdown series rejects length mismatch', () => {
    const bad = TortilaDrawdownSeriesSchema.safeParse({
      ts: ['2026-01-01', '2026-01-02'],
      dd_pct: [0, -1.2, -2.5],
      peak: [100, 100, 100],
    });
    expect(bad.success).toBe(false);
  });
});

describe('Tortila journal reader — token gating + error envelope', () => {
  it('returns an error envelope (never throws) when token is missing', async () => {
    const reader = createTortilaJournalReader('http://localhost:8080');
    const result = await reader.getAdvanced();
    expect(isTortilaJournalError(result)).toBe(true);
    if (isTortilaJournalError(result)) {
      expect(result.error).toContain('JOURNAL_READ_TOKEN');
    }
  });

  it('strips trailing slash on base URL', () => {
    const reader = createTortilaJournalReader('http://localhost:8080/');
    expect(reader.baseUrl).toBe('http://localhost:8080');
    expect(reader.hasToken).toBe(false);
  });

  it('hasToken flag reflects token presence — never exposes the value', () => {
    const reader = createTortilaJournalReader('http://localhost:8080', 'secret-token');
    expect(reader.hasToken).toBe(true);
    // baseUrl must never leak the token in any field.
    expect(JSON.stringify(reader)).not.toContain('secret-token');
  });
});
