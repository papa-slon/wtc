/**
 * Zod schemas for the legacy DCA bot's READ-ONLY journal "shim" endpoints.
 *
 * The shim (a standalone read-only FastAPI over the bot's Postgres — see
 * bot/journal_shim/) mirrors the SHAPE of the Tortila journal so the WTC fetch
 * layer is uniform, but its payloads are DIFFERENT: the legacy DB has no
 * realized-PnL / equity tables, so money figures are RECONSTRUCTED from the
 * closed-cycle order ladder (every cycle exits at a fixed +0.45% take-profit on
 * the volume-weighted average entry) and every payload carries
 * `reconstructed: true` + a `method` string. Genuinely-unavailable values (live
 * mark / unrealized PnL) are omitted, never faked.
 *
 * SAFETY: this file is READ-ONLY metadata for the SAFE shim path. It has nothing
 * to do with `createLegacyBlockedAdapter` (the hard-blocked /api_management
 * control path) — that block stays intact. These schemas only validate GET
 * responses from the read-only shim.
 *
 * All schemas are intentionally permissive on nullable / optional fields so a
 * shim at any data fill state parses to a stable, well-typed shape and the
 * dashboard renders the honest empty branch instead of fabricating numbers.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// GET /api/health  (journal_shim/app.py: health)
// ---------------------------------------------------------------------------

export const LegacyHealthSchema = z.object({
  ok: z.boolean(),
  ts: z.string(),
  mode: z.string(),
  reconstructed: z.boolean(),
});
export type LegacyHealth = z.infer<typeof LegacyHealthSchema>;

// ---------------------------------------------------------------------------
// GET /api/summary  (journal_shim/app.py: summary)
// ---------------------------------------------------------------------------

export const LegacySummarySchema = z.object({
  now: z.string(),
  mode: z.string(),
  reconstructed: z.boolean(),
  method: z.string(),
  realized_pnl_net: z.number(),
  realized_pnl_gross: z.number(),
  fees_total: z.number(),
  equity_last: z.number(),
  equity_baseline: z.number(),
  closed_cycles: z.number().int().nonnegative(),
  open_cycles: z.number().int().nonnegative(),
  total_cycles: z.number().int().nonnegative(),
  /** TP-completion rate. ~100% by construction (fixed TP, no stop-loss). The UI
   *  FETCHES this but DELIBERATELY NEVER RENDERS it — it is a misleading vanity
   *  metric for a no-stop DCA bot. */
  tp_completion_rate_pct: z.number(),
  open_positions: z.number().int().nonnegative(),
  accounts_running: z.number().int().nonnegative(),
  accounts_total: z.number().int().nonnegative(),
  tp_pct: z.number(),
  fee_rate: z.number(),
});
export type LegacySummary = z.infer<typeof LegacySummarySchema>;

// ---------------------------------------------------------------------------
// GET /api/positions  (journal_shim/app.py: positions)
// ---------------------------------------------------------------------------

export const LegacyPositionRowSchema = z.object({
  symbol: z.string(),
  side: z.string(), // live code path is LONG-only
  reason: z.string(),
  stage: z.number().int(),
  averaging_depth: z.number().int().nonnegative(),
  /** Volume-weighted averaged ENTRY of the still-open bag. null when no priced
   *  fill rows exist (MARKET entries can store price=0). Render "unavailable",
   *  never 0/blank. */
  averaged_entry: z.number().nullable(),
  averaged_entry_available: z.boolean(),
  /** No live mark is pulled in v1 — unrealized PnL is unavailable, never faked. */
  mark_unavailable: z.boolean(),
  opened_at: z.string().nullable(),
  age_hours: z.number().nullable(),
});

export const LegacyPositionsSchema = z.object({
  reconstructed: z.boolean(),
  mark_note: z.string(),
  rows: z.array(LegacyPositionRowSchema),
});
export type LegacyPositions = z.infer<typeof LegacyPositionsSchema>;
export type LegacyPositionRow = z.infer<typeof LegacyPositionRowSchema>;

// ---------------------------------------------------------------------------
// GET /api/symbol_breakdown  (journal_shim/app.py: symbol_breakdown)
// ---------------------------------------------------------------------------

export const LegacySymbolBreakdownRowSchema = z.object({
  symbol: z.string(),
  cycles: z.number().int().nonnegative(),
  closed_cycles: z.number().int().nonnegative(),
  open_cycles: z.number().int().nonnegative(),
  net_pnl: z.number(),
  gross_pnl: z.number(),
  fees: z.number(),
  avg_depth: z.number(),
  contribution_pct: z.number(),
});

export const LegacySymbolBreakdownSchema = z.object({
  reconstructed: z.boolean(),
  rows: z.array(LegacySymbolBreakdownRowSchema),
});
export type LegacySymbolBreakdown = z.infer<typeof LegacySymbolBreakdownSchema>;
export type LegacySymbolBreakdownRow = z.infer<typeof LegacySymbolBreakdownRowSchema>;

// ---------------------------------------------------------------------------
// GET /api/signals  (journal_shim/app.py: signals)
//   legend maps reason -> human label (RED=CCI, YELLOW=RSI, GREEN=other).
//   mix is reason -> count. over_time is per-month { period, <reason>:count, ... }.
// ---------------------------------------------------------------------------

// period is a string ("YYYY-MM"); every other key is a per-reason count (number).
// Modelled as a permissive record so the schema parses any reason set without a
// catchall/intersection typing wrinkle.
export const LegacySignalsOverTimeRowSchema = z.record(z.string(), z.union([z.number(), z.string()]));

export const LegacySignalsSchema = z.object({
  reconstructed: z.boolean(),
  legend: z.record(z.string(), z.string()),
  mix: z.record(z.string(), z.number()),
  over_time: z.array(LegacySignalsOverTimeRowSchema),
});
export type LegacySignals = z.infer<typeof LegacySignalsSchema>;
export type LegacySignalsOverTimeRow = z.infer<typeof LegacySignalsOverTimeRowSchema>;

// ---------------------------------------------------------------------------
// GET /api/activity  (journal_shim/app.py: activity)
//   kind is 'open' (cycle opened) | 'close' (TP hit); net_pnl only on close.
// ---------------------------------------------------------------------------

export const LegacyActivityRowSchema = z.object({
  ts: z.string(),
  kind: z.string(),
  symbol: z.string(),
  reason: z.string().optional(),
  depth: z.number().int().optional(),
  net_pnl: z.number().optional(),
  label: z.string().optional(),
});

export const LegacyActivitySchema = z.object({
  reconstructed: z.boolean(),
  rows: z.array(LegacyActivityRowSchema),
});
export type LegacyActivity = z.infer<typeof LegacyActivitySchema>;
export type LegacyActivityRow = z.infer<typeof LegacyActivityRowSchema>;

// ---------------------------------------------------------------------------
// GET /api/equity  (journal_shim/app.py: equity)
//   Relative cumulative reconstructed PnL (baseline 0, absolute:false), NOT a
//   wallet balance. ts/equity are aligned; dd_ts/dd_pct are aligned.
// ---------------------------------------------------------------------------

export const LegacyEquitySchema = z
  .object({
    reconstructed: z.boolean(),
    method: z.string(),
    baseline: z.number(),
    absolute: z.boolean(),
    ts: z.array(z.string()),
    equity: z.array(z.number()),
    dd_ts: z.array(z.string()),
    dd_pct: z.array(z.number()),
  })
  .refine((v) => v.ts.length === v.equity.length, {
    message: 'ts and equity must have the same length',
    path: ['equity'],
  })
  .refine((v) => v.dd_ts.length === v.dd_pct.length, {
    message: 'dd_ts and dd_pct must have the same length',
    path: ['dd_pct'],
  });
export type LegacyEquity = z.infer<typeof LegacyEquitySchema>;

// ---------------------------------------------------------------------------
// GET /api/depth_distribution  (journal_shim/app.py: depth_distribution)
//   Averaging depth N/3 = "how stuck" a bag is. `all` = every cycle (history),
//   `open` = currently-open bags only. THE signature DCA risk view.
// ---------------------------------------------------------------------------

export const LegacyDepthBucketSchema = z.object({
  depth: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
});

export const LegacyDepthDistributionSchema = z.object({
  reconstructed: z.boolean(),
  note: z.string(),
  all: z.array(LegacyDepthBucketSchema),
  open: z.array(LegacyDepthBucketSchema),
});
export type LegacyDepthDistribution = z.infer<typeof LegacyDepthDistributionSchema>;
export type LegacyDepthBucket = z.infer<typeof LegacyDepthBucketSchema>;
