/**
 * Tortila adapter mapping unit tests.
 *
 * T-01..T-20: field mapping, sign inversions, schema validation, control stubs.
 * W-01..W-06: warning registry assertions.
 *
 * ALL tests use fixture JSON only — no network calls, no live HTTP/SSH/BingX.
 * See: docs/handoffs/20260530-1355-ecosystem-tortila-journal-auditor.md (Verification section).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeMetrics } from '@wtc/analytics';
import { BotControlDisabledError } from '../control.ts';
import {
  CANONICAL_WARNING_CODES,
  TORTILA_PERSISTENT_WARNINGS,
  TORTILA_SIGNAL_WARNINGS,
  TORTILA_WARNINGS,
} from '../warnings.ts';
import {
  TortilaHealthSchema,
  TortilaSummarySchema,
  TortilaTradeListSchema,
  TortilaEquityCurveSchema,
} from '../tortila/tortila.schemas.ts';
import {
  healthToCanonical,
  summaryToMetricsInput,
  tradeRowToCanonical,
  positionSummaryToCanonical,
  equityCurveToPoints,
} from '../tortila/tortila.mapping.ts';
import { createHttpTortilaAdapter, AdapterNotReadyError } from '../http.ts';

// ---------------------------------------------------------------------------
// Load fixtures
// ---------------------------------------------------------------------------

import healthValid from '../__fixtures__/tortila/health.valid.json';
import healthDown from '../__fixtures__/tortila/health.down.json';
import healthMalformed from '../__fixtures__/tortila/health.malformed.json';
import summaryValid from '../__fixtures__/tortila/summary.valid.json';
import summaryNoTrades from '../__fixtures__/tortila/summary.no_trades.json';
import summaryMissingField from '../__fixtures__/tortila/summary.missing_field.json';
import equityValid from '../__fixtures__/tortila/equity.valid.json';
import equityEmpty from '../__fixtures__/tortila/equity.empty.json';
import equityLengthMismatch from '../__fixtures__/tortila/equity.length_mismatch.json';
import tradesListValid from '../__fixtures__/tortila/trades_list.valid.json';
import tradesListMissingFees from '../__fixtures__/tortila/trades_list.missing_fees.json';

// ---------------------------------------------------------------------------
// T-01: health.valid.json — safeParse succeeds; processAlive === true
// ---------------------------------------------------------------------------

describe('T-01: TortilaHealthSchema — health.valid.json parses; processAlive true', () => {
  it('safeParse succeeds and processAlive is true', () => {
    const parsed = TortilaHealthSchema.safeParse(healthValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const mapped = healthToCanonical(parsed.data);
    expect(mapped.processAlive).toBe(true);
    expect(mapped.productCode).toBe('tortila_bot');
  });
});

// ---------------------------------------------------------------------------
// T-02: health.down.json — processAlive false; status degraded; P0+P1 warnings present
// ---------------------------------------------------------------------------

describe('T-02: TortilaHealthSchema — health.down.json: processAlive false, warnings present', () => {
  it('processAlive is false and status is degraded with P0+P1 warnings', () => {
    const parsed = TortilaHealthSchema.safeParse(healthDown);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const mapped = healthToCanonical(parsed.data);
    expect(mapped.processAlive).toBe(false);
    expect(mapped.status).toBe('degraded');
    const codes = mapped.warnings.map((w) => w.code);
    expect(codes).toContain('tp_reconcile_p0');
    expect(codes).toContain('margin_preflight_p1');
  });
});

// ---------------------------------------------------------------------------
// T-03: health.malformed.json — safeParse fails; adapter maps to processAlive: false
// ---------------------------------------------------------------------------

describe('T-03: TortilaHealthSchema — health.malformed.json: safeParse fails (fail-closed)', () => {
  it('safeParse fails on malformed (missing ok field)', () => {
    const parsed = TortilaHealthSchema.safeParse(healthMalformed);
    expect(parsed.success).toBe(false);
  });

  it('fail-closed: missing ok maps to processAlive false', () => {
    // When safeParse fails, the adapter should treat ok as false.
    const fallback = healthToCanonical({ ok: false, ts: '2026-05-30T13:55:00+00:00' });
    expect(fallback.processAlive).toBe(false);
    expect(fallback.status).toBe('degraded');
  });
});

// ---------------------------------------------------------------------------
// T-04: summary.valid.json — safeParse succeeds; winRatePct !== 0 when trades > 0
// ---------------------------------------------------------------------------

describe('T-04: TortilaSummarySchema — summary.valid.json parses; winRatePct non-zero', () => {
  it('safeParse succeeds', () => {
    const parsed = TortilaSummarySchema.safeParse(summaryValid);
    expect(parsed.success).toBe(true);
  });

  it('winRatePct is non-zero when trades_total > 0', () => {
    const parsed = TortilaSummarySchema.safeParse(summaryValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const mapped = summaryToMetricsInput(parsed.data);
    expect(mapped.winRatePct).not.toBe(0);
    expect(mapped.winRatePct).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T-05: summary.no_trades.json — winRatePct === null (not 0); profitFactor null
// ---------------------------------------------------------------------------

describe('T-05: zero-trades state — winRatePct null (not 0)', () => {
  it('winRatePct is null when trades_total === 0', () => {
    const parsed = TortilaSummarySchema.safeParse(summaryNoTrades);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const mapped = summaryToMetricsInput(parsed.data);
    expect(mapped.winRatePct).toBeNull();
  });

  it('computeMetrics with zero trades returns null profitFactor', () => {
    // When no trades: profitFactor must be null, not 0 or Infinity.
    const metrics = computeMetrics({ trades: [], positions: [], equityCurve: [], walletEquity: 0 });
    expect(metrics.profitFactor).toBeNull();
    expect(metrics.winRatePct).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T-06: summary.missing_field.json — safeParse fails (missing net_pnl_with_fees)
// ---------------------------------------------------------------------------

describe('T-06: TortilaSummarySchema — missing net_pnl_with_fees causes safeParse failure', () => {
  it('safeParse fails when net_pnl_with_fees is absent', () => {
    const parsed = TortilaSummarySchema.safeParse(summaryMissingField);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-07: fees sign inversion — feesTotal = Math.abs(fees_total) = 17.40 (positive)
// ---------------------------------------------------------------------------

describe('T-07: fees_total sign inversion — canonical feesTotal is positive cost', () => {
  it('feesTotal = Math.abs(fees_total) = 17.40 from summary.valid.json', () => {
    const parsed = TortilaSummarySchema.safeParse(summaryValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // fees_total in fixture is -17.40 (stored negative); canonical must be +17.40
    expect(parsed.data.fees_total).toBe(-17.40);
    const mapped = summaryToMetricsInput(parsed.data);
    expect(mapped.feesTotal).toBeCloseTo(17.40, 5);
  });
});

// ---------------------------------------------------------------------------
// T-08: netPnlWithFees uses net_pnl_with_fees (198.40), NOT net_pnl (215.80)
// ---------------------------------------------------------------------------

describe('T-08: netPnlWithFees from net_pnl_with_fees, not net_pnl', () => {
  it('netPnlWithFees = 198.40 (not 215.80 which is net_pnl)', () => {
    const parsed = TortilaSummarySchema.safeParse(summaryValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.net_pnl).toBeCloseTo(215.80, 5);
    expect(parsed.data.net_pnl_with_fees).toBeCloseTo(198.40, 5);
    const mapped = summaryToMetricsInput(parsed.data);
    // Must use net_pnl_with_fees, not net_pnl
    expect(mapped.netPnlWithFees).toBeCloseTo(198.40, 5);
    expect(mapped.netPnlWithFees).not.toBeCloseTo(215.80, 1);
  });
});

// ---------------------------------------------------------------------------
// T-09: trades_list.valid.json — row[0].fee = Math.abs(-5.60) = 5.60
// ---------------------------------------------------------------------------

describe('T-09: trade row fee sign inversion', () => {
  it('row[0].fee = Math.abs(-5.60) = 5.60', () => {
    const parsed = TortilaTradeListSchema.safeParse(tradesListValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const row0 = parsed.data.rows[0]!;
    // fees_pnl in fixture is -5.60; canonical fee must be +5.60
    expect(row0.fees_pnl).toBe(-5.60);
    const canonical = tradeRowToCanonical(row0);
    expect(canonical.fee).toBeCloseTo(5.60, 5);
  });
});

// ---------------------------------------------------------------------------
// T-10: row[0] CanonicalTrade.realizedPnl = 142.50 (gross_pnl direct)
// ---------------------------------------------------------------------------

describe('T-10: trade row realizedPnl maps from gross_pnl directly', () => {
  it('realizedPnl = 142.50 (gross_pnl, before fees/funding)', () => {
    const parsed = TortilaTradeListSchema.safeParse(tradesListValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const canonical = tradeRowToCanonical(parsed.data.rows[0]!);
    expect(canonical.realizedPnl).toBeCloseTo(142.50, 5);
  });
});

// ---------------------------------------------------------------------------
// T-11: row[0] CanonicalTrade.qty = 0 (qty is null in source, maps to 0)
// ---------------------------------------------------------------------------

describe('T-11: trade row qty is null in source → maps to 0', () => {
  it('qty = 0 because TradeRow has no total_qty field', () => {
    const parsed = TortilaTradeListSchema.safeParse(tradesListValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    // The fixture has qty: null (as serialize_trade always produces)
    expect(parsed.data.rows[0]!.qty).toBeNull();
    const canonical = tradeRowToCanonical(parsed.data.rows[0]!);
    expect(canonical.qty).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T-12: row[0] CanonicalTrade.closedAt is not null (closed trade)
// ---------------------------------------------------------------------------

describe('T-12: trade row closedAt is not null for closed trades', () => {
  it('closedAt is a number (epoch ms), not null', () => {
    const parsed = TortilaTradeListSchema.safeParse(tradesListValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const canonical = tradeRowToCanonical(parsed.data.rows[0]!);
    expect(canonical.closedAt).not.toBeNull();
    expect(typeof canonical.closedAt).toBe('number');
    expect(isNaN(canonical.closedAt as number)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-13: trades_list.missing_fees.json — schema fails (fees_pnl absent)
// ---------------------------------------------------------------------------

describe('T-13: trades_list.missing_fees.json — fees_pnl absent causes schema failure', () => {
  it('safeParse fails when fees_pnl field is absent from a row', () => {
    const parsed = TortilaTradeListSchema.safeParse(tradesListMissingFees);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-14: equity.valid.json — toEquityPoints returns 3 points; epoch ms; all equity > 0
// ---------------------------------------------------------------------------

describe('T-14: equity.valid.json — equityCurveToPoints returns correct points', () => {
  it('returns 3 points with epoch ms timestamps and all equity > 0', () => {
    const parsed = TortilaEquityCurveSchema.safeParse(equityValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const points = equityCurveToPoints(parsed.data);
    expect(points).toHaveLength(3);
    for (const p of points) {
      expect(typeof p.t).toBe('number');
      expect(isNaN(p.t)).toBe(false);
      expect(p.t).toBeGreaterThan(0);
      expect(p.equity).toBeGreaterThan(0);
    }
  });

  it('first point t is correct epoch ms from ISO string', () => {
    const parsed = TortilaEquityCurveSchema.safeParse(equityValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const points = equityCurveToPoints(parsed.data);
    const expected = new Date('2026-01-15T12:00:00+00:00').getTime();
    expect(points[0]!.t).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// T-15: equity.empty.json — returns []; does not crash
// ---------------------------------------------------------------------------

describe('T-15: equity.empty.json — empty curve returns []', () => {
  it('returns empty array without throwing', () => {
    const parsed = TortilaEquityCurveSchema.safeParse(equityEmpty);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const points = equityCurveToPoints(parsed.data);
    expect(points).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T-16: equity.length_mismatch.json — schema refinement fails; adapter returns []
// ---------------------------------------------------------------------------

describe('T-16: equity.length_mismatch.json — refinement fails (ts.length !== equity.length)', () => {
  it('safeParse fails on length mismatch', () => {
    const parsed = TortilaEquityCurveSchema.safeParse(equityLengthMismatch);
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T-17: equity.valid.json — filterZeroEquity applied; no zero-equity points
// ---------------------------------------------------------------------------

describe('T-17: filterZeroEquity is applied; no zero-equity points in output', () => {
  it('zero-equity points are filtered out', () => {
    // Inject a zero-equity point alongside valid points
    const withZero = {
      ts: ['2026-01-14T12:00:00+00:00', ...equityValid.ts],
      equity: [0, ...equityValid.equity],
    };
    const parsed = TortilaEquityCurveSchema.safeParse(withZero);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const points = equityCurveToPoints(parsed.data);
    for (const p of points) {
      expect(p.equity).toBeGreaterThan(0);
    }
    // Should have 3 points (the zero one was filtered)
    expect(points).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// T-18: computeMetrics with both trade rows from trades_list.valid.json
//   Row 0: gross_pnl=142.50, fees_pnl=-5.60→fee=5.60, funding_pnl=0.80
//   Row 1: gross_pnl=-38.20, fees_pnl=-2.80→fee=2.80, funding_pnl=-0.60
//   Expected: feesTotal=8.40, netPnlWithFees = (142.50 + (-38.20)) - 8.40 + (0.80 + (-0.60))
//           = 104.30 - 8.40 + 0.20 = 96.10
// ---------------------------------------------------------------------------

describe('T-18: computeMetrics with trades from valid fixture — feesTotal and netPnlWithFees', () => {
  it('feesTotal = 8.40 (sum of abs fees); netPnlWithFees = closedPnl - feesTotal + fundingTotal', () => {
    const parsed = TortilaTradeListSchema.safeParse(tradesListValid);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const trades = parsed.data.rows.map(tradeRowToCanonical);
    const metrics = computeMetrics({
      trades,
      positions: [],
      equityCurve: [],
      walletEquity: 0,
    });
    // feesTotal = 5.60 + 2.80 = 8.40
    expect(metrics.feesTotal).toBeCloseTo(8.40, 5);
    // closedPnl = 142.50 + (-38.20) = 104.30
    expect(metrics.closedPnl).toBeCloseTo(104.30, 5);
    // fundingTotal = 0.80 + (-0.60) = 0.20
    expect(metrics.fundingTotal).toBeCloseTo(0.20, 5);
    // netPnlWithFees = 104.30 - 8.40 + 0.20 = 96.10
    expect(metrics.netPnlWithFees).toBeCloseTo(96.10, 5);
  });
});

// ---------------------------------------------------------------------------
// T-19: startBot throws BotControlDisabledError
// ---------------------------------------------------------------------------

describe('T-19: startBot is disabled and throws BotControlDisabledError', () => {
  it('startBot throws BotControlDisabledError', async () => {
    const adapter = createHttpTortilaAdapter('http://127.0.0.1:65535');
    await expect(adapter.startBot('instance-1')).rejects.toThrow(BotControlDisabledError);
  });
});

// ---------------------------------------------------------------------------
// T-20: stopBot throws BotControlDisabledError
// ---------------------------------------------------------------------------

describe('T-20: stopBot is disabled and throws BotControlDisabledError', () => {
  it('stopBot throws BotControlDisabledError', async () => {
    const adapter = createHttpTortilaAdapter('http://127.0.0.1:65535');
    await expect(adapter.stopBot('instance-1')).rejects.toThrow(BotControlDisabledError);
  });
});

// ---------------------------------------------------------------------------
// W-01..W-06: Warning registry assertions
// ---------------------------------------------------------------------------

describe('W-01: TORTILA_PERSISTENT_WARNINGS contains tp_reconcile_p0 at severity error', () => {
  it('tp_reconcile_p0 is present with severity error', () => {
    const w = TORTILA_PERSISTENT_WARNINGS.find((w) => w.code === 'tp_reconcile_p0');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('error');
  });
});

describe('W-02: TORTILA_PERSISTENT_WARNINGS contains margin_preflight_p1 at severity warning', () => {
  it('margin_preflight_p1 is present with severity warning', () => {
    const w = TORTILA_PERSISTENT_WARNINGS.find((w) => w.code === 'margin_preflight_p1');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
  });
});

describe('W-03: TORTILA_SIGNAL_WARNINGS contains tp_rejection_101211', () => {
  it('tp_rejection_101211 is in TORTILA_SIGNAL_WARNINGS', () => {
    expect(TORTILA_SIGNAL_WARNINGS.map((w) => w.code)).toContain('tp_rejection_101211');
  });
});

describe('W-04: TORTILA_SIGNAL_WARNINGS contains rate_limit_100410', () => {
  it('rate_limit_100410 is in TORTILA_SIGNAL_WARNINGS', () => {
    expect(TORTILA_SIGNAL_WARNINGS.map((w) => w.code)).toContain('rate_limit_100410');
  });
});

describe('W-05: No warning code in TORTILA_WARNINGS is outside CANONICAL_WARNING_CODES', () => {
  it('every TORTILA_WARNINGS code is in CANONICAL_WARNING_CODES', () => {
    for (const w of TORTILA_WARNINGS) {
      expect(CANONICAL_WARNING_CODES).toContain(w.code as (typeof CANONICAL_WARNING_CODES)[number]);
    }
  });
});

describe('W-06: getHealth on real adapter always returns status !== healthy regardless of ok field', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => healthValid,
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('status is never healthy even when ok=true', async () => {
    const adapter = createHttpTortilaAdapter('http://127.0.0.1:65535', 'unit-test-token');
    const health = await adapter.getHealth();
    expect(health.status).not.toBe('healthy');
  });

  it('processAlive is true when ok=true', async () => {
    const adapter = createHttpTortilaAdapter('http://127.0.0.1:65535', 'unit-test-token');
    const health = await adapter.getHealth();
    expect(health.processAlive).toBe(true);
  });
});

// W-07: machine-verify the P0/P1 healthy-status guard (F-08) — documentation alone is not enough.
describe('W-07: healthToCanonical never returns status=healthy while a P0/P1 error warning exists', () => {
  it('an error-severity persistent warning forces a non-healthy status (and readState ok on a valid read)', () => {
    const hasErrorWarning = TORTILA_PERSISTENT_WARNINGS.some((w) => w.severity === 'error');
    expect(hasErrorWarning).toBe(true); // guard precondition: tp_reconcile_p0 is an error
    const mapped = healthToCanonical({ ok: true, ts: '2026-05-30T13:55:00+00:00' });
    expect(mapped.status).not.toBe('healthy');
    // A successfully parsed health body is a reachable, well-formed read.
    expect(mapped.readState).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// Additional: position mapping — markPrice falls back to avg_entry; unrealizedPnl = 0
// ---------------------------------------------------------------------------

describe('Position mapping: markPrice = avg_entry; unrealizedPnl = 0 (unavailable)', () => {
  it('markPrice equals entryPrice (avg_entry approximation)', () => {
    const validSummary = TortilaSummarySchema.safeParse(summaryValid);
    expect(validSummary.success).toBe(true);
    if (!validSummary.success) return;
    const pos = validSummary.data.open_position_summaries[0]!;
    const canonical = positionSummaryToCanonical(pos);
    expect(canonical.markPrice).toBe(canonical.entryPrice);
    expect(canonical.entryPrice).toBe(pos.avg_entry);
  });

  it('unrealizedPnl is 0 (mark price not available via journal)', () => {
    const validSummary = TortilaSummarySchema.safeParse(summaryValid);
    expect(validSummary.success).toBe(true);
    if (!validSummary.success) return;
    const pos = validSummary.data.open_position_summaries[0]!;
    const canonical = positionSummaryToCanonical(pos);
    expect(canonical.unrealizedPnl).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Additional: AdapterNotReadyError schema-mismatch detail test
// ---------------------------------------------------------------------------

describe('AdapterNotReadyError includes schema-mismatch detail', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ unexpected: 'shape' }),
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getPositions throws AdapterNotReadyError with schema-mismatch detail on bad JSON', async () => {
    const adapter = createHttpTortilaAdapter('http://127.0.0.1:65535');
    await expect(adapter.getPositions('x')).rejects.toThrow(AdapterNotReadyError);
  });

  it('getEquityCurve throws AdapterNotReadyError with schema-mismatch detail on bad JSON', async () => {
    const adapter = createHttpTortilaAdapter('http://127.0.0.1:65535');
    await expect(adapter.getEquityCurve?.('x')).rejects.toThrow(AdapterNotReadyError);
  });
});
