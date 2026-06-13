/**
 * Extended Zod schemas for the Tortila journal endpoints used by the WTC web
 * dashboard's premium overview page. These shapes are derived from a read-only
 * audit of:
 *   bot_tortila/src/turtle_bot/journal/app.py  (route handlers)
 *   bot_tortila/src/turtle_bot/journal/metrics.py  (serialisers)
 *
 * All schemas are intentionally permissive on nullable / optional fields so a
 * journal at any data fill state (cold-start, no trades, no equity) parses to a
 * stable, well-typed empty-but-valid shape. The dashboard renders the empty
 * branch — it never fabricates numbers.
 *
 * SAFETY: this file is READ-ONLY metadata. It never wraps a call to /api/marks
 * from the worker pipeline — that endpoint is the dashboard's responsibility,
 * surfaced behind a session-gated server route. See packages/bot-adapters/
 * src/http.ts for the canonical worker integration rules.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// /api/metrics/advanced  (app.py:707-730)
// ---------------------------------------------------------------------------

export const TortilaPeriodReturnsSchema = z.object({
  today_pct: z.number().nullable(),
  d7_pct: z.number().nullable(),
  d30_pct: z.number().nullable(),
  d90_pct: z.number().nullable(),
  ytd_pct: z.number().nullable(),
  all_pct: z.number().nullable(),
});

export const TortilaPerformanceSchema = z.object({
  sharpe: z.number().nullable(),
  sortino: z.number().nullable(),
  calmar: z.number().nullable(),
  recovery_factor: z.number().nullable(),
  cagr_pct: z.number().nullable(),
  vol_daily_pct: z.number().nullable(),
  mean_daily_pct: z.number().nullable(),
  total_return_pct: z.number().nullable(),
  best_day_pct: z.number(),
  worst_day_pct: z.number(),
  time_in_market_pct: z.number(),
  trades_per_week: z.number(),
  period_returns: TortilaPeriodReturnsSchema,
});

export const TortilaTradeAggregatesSchema = z.object({
  count: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  scratches: z.number().int().nonnegative(),
  win_rate_pct: z.number().nonnegative(),
  loss_rate_pct: z.number().nonnegative(),
  avg_win: z.number(),
  avg_loss: z.number(),
  largest_win: z.number(),
  largest_loss: z.number(),
  profit_factor: z.number().nullable(),
  expectancy: z.number(),
  gross_profit: z.number(),
  gross_loss: z.number(),
  avg_hold_hours: z.number(),
  max_consec_wins: z.number().int().nonnegative(),
  max_consec_losses: z.number().int().nonnegative(),
});

export const TortilaDrawdownStatsSchema = z.object({
  max_dd_pct: z.number(),
  max_dd_usd: z.number(),
  max_dd_start: z.string().nullable(),
  max_dd_trough: z.string().nullable(),
  max_dd_recovered: z.string().nullable(),
  max_dd_duration_days: z.number(),
  longest_underwater_days: z.number(),
  avg_dd_pct: z.number(),
  current_dd_pct: z.number(),
});

export const TortilaAdvancedMetricsSchema = z.object({
  performance: TortilaPerformanceSchema,
  trades: TortilaTradeAggregatesSchema,
  drawdown: TortilaDrawdownStatsSchema,
  best_day: z.object({ date: z.string().nullable(), pnl: z.number() }),
  worst_day: z.object({ date: z.string().nullable(), pnl: z.number() }),
});
export type TortilaAdvancedMetrics = z.infer<typeof TortilaAdvancedMetricsSchema>;

// ---------------------------------------------------------------------------
// /api/symbol_breakdown  (app.py:754-763, metrics.py:446-489)
// ---------------------------------------------------------------------------

export const TortilaSymbolBreakdownRowSchema = z.object({
  symbol: z.string(),
  trades: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  win_rate_pct: z.number(),
  net_pnl: z.number(),
  gross_profit: z.number(),
  gross_loss: z.number(),
  profit_factor: z.number().nullable(),
  avg_hold_hours: z.number(),
  contribution_pct: z.number(),
  best_trade: z.number(),
  worst_trade: z.number(),
});

export const TortilaSymbolBreakdownSchema = z.object({
  rows: z.array(TortilaSymbolBreakdownRowSchema),
});
export type TortilaSymbolBreakdown = z.infer<typeof TortilaSymbolBreakdownSchema>;
export type TortilaSymbolBreakdownRow = z.infer<typeof TortilaSymbolBreakdownRowSchema>;

// ---------------------------------------------------------------------------
// /api/monthly  (app.py:775-782, metrics.py:504-522)
// ---------------------------------------------------------------------------

export const TortilaMonthlyRowSchema = z.object({
  month: z.string(),
  net_pnl: z.number(),
  trades: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  wr_pct: z.number(),
});

export const TortilaMonthlySchema = z.object({
  rows: z.array(TortilaMonthlyRowSchema),
});
export type TortilaMonthly = z.infer<typeof TortilaMonthlySchema>;
export type TortilaMonthlyRow = z.infer<typeof TortilaMonthlyRowSchema>;

// ---------------------------------------------------------------------------
// /api/calendar  (app.py:765-773, metrics.py:525-543)
// ---------------------------------------------------------------------------

export const TortilaCalendarDaySchema = z.object({
  date: z.string(),
  pnl: z.number(),
  dow: z.number().int().min(0).max(6),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
});

export const TortilaCalendarSchema = z.object({
  start: z.string(),
  end: z.string(),
  days: z.array(TortilaCalendarDaySchema),
  max_abs: z.number(),
});
export type TortilaCalendar = z.infer<typeof TortilaCalendarSchema>;
export type TortilaCalendarDay = z.infer<typeof TortilaCalendarDaySchema>;

// ---------------------------------------------------------------------------
// /api/distribution  (app.py:784-791, metrics.py:549-572)
// ---------------------------------------------------------------------------

export const TortilaDistributionSchema = z.object({
  edges: z.array(z.number()),
  counts: z.array(z.number().int().nonnegative()),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});
export type TortilaDistribution = z.infer<typeof TortilaDistributionSchema>;

// ---------------------------------------------------------------------------
// /api/drawdown  (app.py:793-800, metrics.py:154-169)
// ---------------------------------------------------------------------------

export const TortilaDrawdownSeriesSchema = z
  .object({
    ts: z.array(z.string()),
    dd_pct: z.array(z.number()),
    peak: z.array(z.number()),
  })
  .refine((v) => v.ts.length === v.dd_pct.length && v.ts.length === v.peak.length, {
    message: 'ts, dd_pct, and peak must have the same length',
    path: ['dd_pct'],
  });
export type TortilaDrawdownSeries = z.infer<typeof TortilaDrawdownSeriesSchema>;

// ---------------------------------------------------------------------------
// /api/marks  (app.py:732-752)
// ---------------------------------------------------------------------------

export const TortilaMarkSchema = z.object({
  last: z.number().nullable().optional(),
  mark: z.number().nullable().optional(),
  bid: z.number().nullable().optional(),
  ask: z.number().nullable().optional(),
  ts: z.string().optional(),
});

export const TortilaMarksSchema = z.object({
  ts: z.string(),
  ttl_sec: z.number().int().positive(),
  marks: z.record(z.string(), TortilaMarkSchema),
  stale: z.boolean(),
});
export type TortilaMarks = z.infer<typeof TortilaMarksSchema>;
export type TortilaMark = z.infer<typeof TortilaMarkSchema>;

// ---------------------------------------------------------------------------
// /api/activity  (app.py:836-870)
// ---------------------------------------------------------------------------

export const TortilaActivityItemSchema = z.object({
  ts: z.string(),
  kind: z.enum(['decision', 'safety', 'trade']),
  symbol: z.string().optional(),
  label: z.string().optional(),
  detail: z.string().optional(),
  side: z.string().optional(),
  level: z.string().optional(),
  net_pnl: z.number().optional(),
});

export const TortilaActivitySchema = z.object({
  rows: z.array(TortilaActivityItemSchema),
});
export type TortilaActivity = z.infer<typeof TortilaActivitySchema>;
export type TortilaActivityItem = z.infer<typeof TortilaActivityItemSchema>;
