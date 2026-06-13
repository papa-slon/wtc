/**
 * Static contract test for the Tortila statistics gap fixes (G1-G6).
 *
 * Focus: the trade-history filter/pagination island (G1) + its server proxy +
 * the journal reader method it relies on, plus the truthful `mode` threading
 * (G6) and the units column (G2). No Next runtime / DB — source assertions only.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const tradeHistory = read('apps/web/src/features/bots/tortila-overview/trade-history.tsx');
const tradesRoute = read('apps/web/src/app/api/bots/tortila/trades/route.ts');
const reader = read('packages/bot-adapters/src/tortila/tortila-journal-reader.ts');
const overviewData = read('apps/web/src/features/bots/tortila-overview-data.ts');
const overviewIndex = read('apps/web/src/features/bots/tortila-overview/index.tsx');
const statsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const equityPanel = read('apps/web/src/features/bots/tortila-overview/equity-panel.tsx');

describe('G1 — trade history is filterable + paginated via the server proxy', () => {
  it('is a client island that fetches the session-gated proxy (token stays server-side)', () => {
    expect(tradeHistory).toMatch(/^'use client';/);
    expect(tradeHistory).toContain('/api/bots/tortila/trades?');
    expect(tradeHistory).not.toContain('authorization');
    expect(tradeHistory).not.toContain('Bearer');
  });

  it('renders symbol / side / exit-reason filters and prev/next pagination', () => {
    expect(tradeHistory).toContain('Filter by symbol');
    expect(tradeHistory).toContain('Filter by side');
    expect(tradeHistory).toContain('Filter by exit reason');
    // The three journal filter params are forwarded.
    expect(tradeHistory).toContain("qs.set('symbol'");
    expect(tradeHistory).toContain("qs.set('side'");
    expect(tradeHistory).toContain("qs.set('exit_reason'");
    // Pagination controls + a "showing N of M" readout (no 30-row cap).
    expect(tradeHistory).toContain('prev');
    expect(tradeHistory).toContain('next');
    expect(tradeHistory).toMatch(/showing \$\{showingFrom\}-\$\{showingTo\} of \$\{total\}/);
  });

  it('shows the per-trade units column from the journal (G2 — honest, not a dash)', () => {
    expect(tradeHistory).toContain('data-label="U"');
    expect(tradeHistory).toContain('{t.units}');
  });

  it('the overview mounts the TradeHistory island and drops the static 30-row table', () => {
    expect(overviewIndex).toContain('<TradeHistory');
    expect(overviewIndex).not.toContain('Trade history . last 30 closed');
    expect(overviewIndex).not.toContain('data-label="U" className="num">—');
  });
});

describe('G1 — trades proxy route is session + entitlement gated and token-safe', () => {
  it('refuses unauthenticated (401) and missing entitlement (403)', () => {
    expect(tradesRoute).toContain('getCurrentUser()');
    expect(tradesRoute).toMatch(/status: 401/);
    expect(tradesRoute).toContain("botAccessForUser(user, 'tortila_bot')");
    expect(tradesRoute).toMatch(/status: 403/);
  });

  it('never reads the journal token directly and never caches', () => {
    // The docstring documents the gate, so allow the bare token name in a
    // comment but forbid actually reading it (or the adapter options) here.
    expect(tradesRoute).not.toContain('process.env.JOURNAL_READ_TOKEN');
    expect(tradesRoute).not.toContain('botAdapterOptions');
    expect(tradesRoute).toContain("export const runtime = 'nodejs'");
    expect(tradesRoute).toContain("export const dynamic = 'force-dynamic'");
    expect(tradesRoute).toContain("'cache-control': 'no-store'");
  });

  it('loads through the server module that holds the bearer token', () => {
    expect(tradesRoute).toContain('loadTortilaTradesPage');
    expect(overviewData).toContain('export async function loadTortilaTradesPage');
    expect(overviewData).toContain('reader.getTradesList');
  });
});

describe('G1/G6 — journal reader exposes trades-list + summary', () => {
  it('reader has getTradesList using the existing TortilaTradeListSchema', () => {
    expect(reader).toContain('getTradesList');
    expect(reader).toContain('/api/trades/list?');
    expect(reader).toContain('TortilaTradeListSchema');
  });

  it('reader has getSummary (carries demo/live mode + at_ath)', () => {
    expect(reader).toContain('getSummary');
    expect(reader).toContain("fetchAndParse('/api/summary', TortilaSummarySchema)");
  });
});

describe('G6 — mode is truthful (from /api/summary), not a constant', () => {
  it('the loader threads summary.mode + at_ath instead of hard-coding unknown/demo', () => {
    expect(overviewData).toContain('const summary = payload.summary.data');
    expect(overviewData).toContain("const mode: 'demo' | 'live' | 'unknown' = summary?.mode ?? 'unknown'");
    expect(overviewData).toContain('summary?.at_ath');
    // No leftover hard-coded mode constant in the live branch.
    expect(overviewData).not.toContain("const mode: 'demo' | 'live' | 'unknown' = 'unknown';");
  });

  it('the stats page renders the mode label from data, with an honest n/a fallback', () => {
    expect(statsPage).toContain("live.mode === 'unknown' ? 'mode n/a' : live.mode.toUpperCase()");
  });
});

describe('G3/G4 — equity panel has period tabs and a hover readout', () => {
  it('has 1D/7D/30D/ALL period tabs that re-slice client-side', () => {
    expect(equityPanel).toMatch(/^'use client';/);
    expect(equityPanel).toContain("label: '1D'");
    expect(equityPanel).toContain("label: '7D'");
    expect(equityPanel).toContain("label: '30D'");
    expect(equityPanel).toContain("label: 'ALL'");
    expect(equityPanel).toContain('sliceByPeriod');
  });

  it('shows a date + value hover crosshair (G4)', () => {
    expect(equityPanel).toContain('onPointerMove');
    expect(equityPanel).toContain('tov-chart-tip');
  });
});
