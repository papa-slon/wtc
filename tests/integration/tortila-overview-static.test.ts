/**
 * Static contract test for the premium Tortila overview page.
 *
 * Reads source files (no Next runtime, no DB) and asserts that:
 *   - The new TortilaOverview component is mounted on /app/bots/[bot] for
 *     productCode === 'tortila_bot'.
 *   - The overview data loader reads the bearer token from the canonical
 *     `botAdapterOptions()` helper and never inlines it into a fetch URL
 *     or response.
 *   - The /api/bots/tortila/overview proxy is session-gated and entitlement-
 *     gated (matches the pattern used by the rest of the bots surfaces).
 *   - Every section of the dashboard (hero, KPIs, performance overview,
 *     equity chart, drawdown chart, risk panel, positions, symbol contrib,
 *     monthly, calendar, distribution, trade history, activity, costs) is
 *     rendered from the TortilaOverview server component.
 *   - The page does NOT render the previous greyed-out "Start bot (disabled)"
 *     and "Stop bot (disabled)" buttons.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const botDetail = read('apps/web/src/app/(app)/app/bots/[bot]/page.tsx');
const overviewIndex = read('apps/web/src/features/bots/tortila-overview/index.tsx');
const overviewData = read('apps/web/src/features/bots/tortila-overview-data.ts');
const overviewRoute = read('apps/web/src/app/api/bots/tortila/overview/route.ts');
const reader = read('packages/bot-adapters/src/tortila/tortila-journal-reader.ts');
const extendedSchemas = read('packages/bot-adapters/src/tortila/tortila.extended.schemas.ts');

describe('Tortila premium overview: page wiring', () => {
  it('mounts TortilaOverview on /app/bots/[bot] when productCode is tortila_bot', () => {
    expect(botDetail).toMatch(/import \{ TortilaOverview \} from '@\/features\/bots\/tortila-overview'/);
    expect(botDetail).toMatch(/import \{ loadTortilaOverviewPayload \} from '@\/features\/bots\/tortila-overview-data'/);
    expect(botDetail).toMatch(/meta\.code === 'tortila_bot' \? loadTortilaOverviewPayload\(\) : Promise\.resolve\(null\)/);
    expect(botDetail).toMatch(/meta\.code === 'tortila_bot' && tortilaJournalPayload \? \(\s*<TortilaOverview/);
  });

  it('keeps the BotContinuity / Evidence / WarningSummary panels visible on the tortila page', () => {
    expect(botDetail).toMatch(/<BotContinuityPanel/);
    expect(botDetail).toMatch(/<BotRuntimeEvidencePanel/);
    expect(botDetail).toMatch(/<WarningSummaryPanel/);
  });

  it('removes the previously greyed-out Start/Stop disabled buttons', () => {
    expect(botDetail).not.toMatch(/Start bot \(disabled\)/);
    expect(botDetail).not.toMatch(/Stop bot \(disabled\)/);
  });

  it('renders the legacy 8-tile metric grid only for the legacy bot, not on the tortila path', () => {
    // The legacy 4-tile snapshot row must remain for legacy.
    expect(botDetail).toMatch(/Wallet balance snapshot/);
    expect(botDetail).toMatch(/meta\.code === 'legacy_bot' && \(/);
  });

  it('requests equityCurve in the tortila read parts list (in addition to canonical parts)', () => {
    expect(botDetail).toMatch(/\['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'\]/);
  });
});

describe('Tortila overview: extended schemas + journal reader', () => {
  it('exports schemas + types for the 8 dashboard endpoints', () => {
    for (const sym of [
      'TortilaAdvancedMetricsSchema',
      'TortilaSymbolBreakdownSchema',
      'TortilaMonthlySchema',
      'TortilaCalendarSchema',
      'TortilaDistributionSchema',
      'TortilaDrawdownSeriesSchema',
      'TortilaMarksSchema',
      'TortilaActivitySchema',
    ]) {
      expect(extendedSchemas).toContain(`export const ${sym}`);
    }
  });

  it('journal reader uses Authorization: Bearer header (matching the bot adapter)', () => {
    expect(reader).toMatch(/authorization\s*=\s*`Bearer \$\{token\}`/);
  });

  it('journal reader returns an error envelope when token is missing, never throws', () => {
    expect(reader).toMatch(/JOURNAL_READ_TOKEN is not configured/);
    expect(reader).toMatch(/error: err instanceof Error \? err\.message : 'network error'/);
  });

  it('journal reader exposes hasToken as a derived boolean, not the secret', () => {
    // hasToken is published; the bearer secret must never appear as a property on the returned reader
    // object literal (otherwise JSON.stringify(reader) would leak it).
    expect(reader).toMatch(/return \{\s*baseUrl: base,\s*hasToken,/);
    expect(reader).not.toMatch(/return \{[^}]*\btoken:/s);
  });
});

describe('Tortila overview: data loader respects bot-adapter options + token gate', () => {
  it('reads BOT_ADAPTER_MODE and tortila options from botAdapterOptions()', () => {
    expect(overviewData).toMatch(/import \{ botAdapterOptions \} from '@\/lib\/server-config'/);
    expect(overviewData).toMatch(/const opts = botAdapterOptions\(\)/);
  });

  it('fails closed when mode is mock or token is missing (no synthetic data)', () => {
    expect(overviewData).toMatch(/opts\.mode !== 'mock'/);
    expect(overviewData).toMatch(/JOURNAL_READ_TOKEN is not set/);
    expect(overviewData).toMatch(/TORTILA_JOURNAL_URL is not set/);
  });

  it('returns per-slice error/data shape so one endpoint failure does not block others', () => {
    expect(overviewData).toMatch(/TortilaOverviewSlice<T>/);
    expect(overviewData).toMatch(/await Promise\.all\(\[/);
  });
});

describe('Tortila overview: API route is session + entitlement gated', () => {
  it('refuses unauthenticated requests with 401 and missing entitlement with 403', () => {
    expect(overviewRoute).toMatch(/await getCurrentUser\(\)/);
    expect(overviewRoute).toMatch(/return NextResponse\.json\(\{ error: 'unauthenticated' \}, \{ status: 401/);
    expect(overviewRoute).toMatch(/botAccessForUser\(user, 'tortila_bot'\)/);
    expect(overviewRoute).toMatch(/status: 403/);
  });

  it('never spreads token-bearing options into the response body', () => {
    // The route must not return the journal options directly. Allow `JOURNAL_READ_TOKEN` to appear
    // in the file's comments (it documents the gate) but require the response shape to be a single
    // typed payload from the loader, never the raw options.
    expect(overviewRoute).toMatch(/NextResponse\.json\(payload/);
    expect(overviewRoute).not.toMatch(/process\.env\.JOURNAL_READ_TOKEN/);
    expect(overviewRoute).not.toMatch(/botAdapterOptions/);
  });

  it('runs on nodejs runtime and never caches', () => {
    expect(overviewRoute).toMatch(/export const runtime = 'nodejs'/);
    expect(overviewRoute).toMatch(/export const dynamic = 'force-dynamic'/);
    expect(overviewRoute).toMatch(/'cache-control': 'no-store'/);
  });
});

describe('Tortila overview: all 12 sections are rendered', () => {
  it('hero strip with equity, mode, sparkline, KPI cells', () => {
    expect(overviewIndex).toMatch(/function Hero\(/);
    expect(overviewIndex).toMatch(/Sparkline/);
    expect(overviewIndex).toMatch(/KpiCell/);
  });

  it('performance overview, equity & drawdown, risk panel', () => {
    expect(overviewIndex).toMatch(/function PerformanceOverview/);
    // G3/G4: the equity + drawdown charts are now an interactive client panel
    // (period tabs + hover crosshair) rather than two static SVGs.
    expect(overviewIndex).toMatch(/EquityPanel/);
    expect(overviewIndex).toMatch(/function RiskPanel/);
  });

  it('open positions w/ price ladder, symbol contribution, monthly, calendar, distribution, trades, activity, costs', () => {
    expect(overviewIndex).toMatch(/PositionCard/);
    expect(overviewIndex).toMatch(/SymbolContribution/);
    expect(overviewIndex).toMatch(/MonthlyBars/);
    expect(overviewIndex).toMatch(/CalendarHeatmap/);
    expect(overviewIndex).toMatch(/DistributionChart/);
    // G1: trade history is a filterable, paginated client island.
    expect(overviewIndex).toMatch(/Trade history/);
    expect(overviewIndex).toMatch(/TradeHistory/);
    expect(overviewIndex).toMatch(/ActivityFeed/);
    expect(overviewIndex).toMatch(/Costs and tracking/);
  });

  it('Hero pulls advanced KPIs from /api/metrics/advanced (Sharpe, Sortino, max DD, time-in-market, expectancy)', () => {
    expect(overviewIndex).toMatch(/adv\?\.performance\.sharpe/);
    expect(overviewIndex).toMatch(/adv\?\.performance\.sortino/);
    expect(overviewIndex).toMatch(/adv\?\.drawdown\.max_dd_pct/);
    expect(overviewIndex).toMatch(/adv\?\.performance\.time_in_market_pct/);
    expect(overviewIndex).toMatch(/adv\?\.trades\.expectancy/);
  });
});
