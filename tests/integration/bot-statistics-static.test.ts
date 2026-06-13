import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const statsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const overviewData = read('apps/web/src/features/bots/tortila-overview-data.ts');
const overviewIndex = read('apps/web/src/features/bots/tortila-overview/index.tsx');
const journalPage = read('apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx');
const journalFeature = read('apps/web/src/features/bots/journal.ts');
const subnav = read('apps/web/src/components/BotSubNav.tsx');
const botsList = read('apps/web/src/app/(app)/app/bots/page.tsx');

describe('bot statistics surface (premium + simple)', () => {
  it('ships a clean premium statistics page with a bot selector', () => {
    expect(statsPage).toMatch(/Trading bot performance/);
    expect(statsPage).toMatch(/BOT_LIST\.map/);
    expect(statsPage).toMatch(/\/app\/bots\/statistics\?bot=\$\{bot\.slug\}/);
    // Premium Tortila terminal is rendered, not the old audit panels.
    expect(statsPage).toMatch(/import \{ TortilaOverview \} from '@\/features\/bots\/tortila-overview'/);
    expect(statsPage).toMatch(/<TortilaOverview/);
  });

  it('removes the cluttered audit panels entirely (continuity / operation map / evidence ladder / command center)', () => {
    expect(statsPage).not.toMatch(/BotContinuityPanel/);
    expect(statsPage).not.toMatch(/BotOperationMapPanel/);
    expect(statsPage).not.toMatch(/BotRuntimeEvidencePanel/);
    expect(statsPage).not.toMatch(/BotStatisticsCommandCenter/);
    expect(statsPage).not.toMatch(/Statistics continuity monitor/);
    expect(statsPage).not.toMatch(/Statistics operation map/);
    expect(statsPage).not.toMatch(/Statistics evidence ladder/);
    expect(statsPage).not.toMatch(/Statistics command center/);
    expect(statsPage).not.toMatch(/workerHeartbeatStatus/);
    expect(statsPage).not.toMatch(/loadBotReadinessForUser/);
  });

  it('reads LIVE data from the journal (not stale WTC DB snapshots) and never fabricates $0', () => {
    expect(statsPage).toMatch(/loadTortilaLiveOverview/);
    // The page itself never calls the adapter factory or fetch directly (token stays server-side in the loader).
    expect(statsPage).not.toMatch(/getBotAdapter/);
    expect(statsPage).not.toMatch(/fetch\(/);
    // Honest empty-data guard: an all-zero journal payload is reported as `empty`, not a live $0 account.
    expect(overviewData).toMatch(/status: 'empty'/);
    expect(overviewData).toMatch(/no equity, trades, or open positions/);
    expect(overviewData).toMatch(/createHttpTortilaAdapter/);
    expect(overviewData).toMatch(/walletEquity > 0 \|\| trades\.length > 0 \|\| positions\.length > 0/);
  });

  it('shows exactly one mode chip and one health chip — no evidence ladder of statuses', () => {
    expect(statsPage).toMatch(/liveHealthChip/);
    expect(statsPage).toMatch(/StatusPill/);
    // Single mode label derived from the journal demo/live flag.
    expect(statsPage).toMatch(/live\.mode === 'live'/);
  });

  it('renders an honest not-configured / unreachable / empty state instead of stale positions', () => {
    expect(statsPage).toMatch(/Live data unavailable/);
    expect(statsPage).toMatch(/No live numbers to show/);
    expect(statsPage).toMatch(/never fabricates a \$0 account or stale positions/);
  });

  it('has no fake action buttons — only read-only navigation links', () => {
    expect(statsPage).not.toMatch(/type="submit"/);
    expect(statsPage).not.toMatch(/Start bot|Stop bot|startBot|stopBot|applyConfig/);
    expect(statsPage).toMatch(/Settings/);
    expect(statsPage).toMatch(/Backtester/);
  });

  it('renders the full premium dashboard section family from TortilaOverview', () => {
    // EquityPanel replaces the static EquityChart/DrawdownChart (G3/G4 — period
    // tabs + hover); TradeHistory replaces the static 30-row table (G1/G2).
    for (const sym of ['Sparkline', 'EquityPanel', 'PositionCard', 'SymbolContribution', 'MonthlyBars', 'CalendarHeatmap', 'DistributionChart', 'TradeHistory', 'ActivityFeed']) {
      expect(overviewIndex).toContain(sym);
    }
    expect(overviewIndex).toMatch(/Costs and tracking/);
  });

  it('upgrades the Legacy tab to the premium reconstructed DCA terminal, not the old Codex panels', () => {
    // The Legacy tab now reads the SAFE read-only journal shim and renders the premium reconstructed
    // DCA overview (averaging depth, signal mix, reconstructed PnL) via the capabilities-driven wrapper.
    expect(statsPage).toMatch(/loadLegacyLiveOverview/);
    expect(statsPage).toMatch(/<LegacyOverview/);
    expect(statsPage).toMatch(/LEGACY_DCA_CAPS/);
    // Honest fallback: never fabricates when the shim is unconfigured / empty / unreachable.
    expect(statsPage).toMatch(/No reconstructed numbers to show/);
    expect(statsPage).toMatch(/never fabricates a \$0 account or placeholder positions/);
    // No old Codex theater.
    expect(statsPage).not.toMatch(/LegacyOperationsPanel/);
    expect(statsPage).not.toMatch(/Legacy statistics cockpit/);
  });

  it('is linked from the bot list and bot subnav', () => {
    expect(botsList).toMatch(/\/app\/bots\/statistics\?bot=tortila/);
    expect(botsList).toMatch(/Open statistics/);
    expect(subnav).toMatch(/Statistics/);
    expect(subnav).toMatch(/Journal/);
    expect(subnav).toMatch(/\/app\/bots\/statistics\?bot=\$\{bot\}/);
  });

  it('keeps the DB-first trade review journal surface intact (unrelated page)', () => {
    expect(journalPage).toMatch(/Trade review journal/);
    expect(journalPage).toMatch(/Review queue/);
    expect(journalPage).toMatch(/Save review/);
    expect(journalFeature).toMatch(/listBotTradeImports/);
    expect(journalFeature).toMatch(/listBotTradeReviews/);
    expect(journalFeature).toMatch(/upsertBotTradeReview/);
    expect(journalFeature).toMatch(/Imported trades remain immutable/);
  });
});
