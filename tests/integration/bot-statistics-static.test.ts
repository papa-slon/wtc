import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const statsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const statsPanels = read('apps/web/src/features/bots/statistics-panels.tsx');
const journalPage = read('apps/web/src/app/(app)/app/bots/[bot]/journal/page.tsx');
const journalFeature = read('apps/web/src/features/bots/journal.ts');
const subnav = read('apps/web/src/components/BotSubNav.tsx');
const botsList = read('apps/web/src/app/(app)/app/bots/page.tsx');

describe('bot statistics surface', () => {
  it('ships a shared statistics page with bot selector and safe per-strategy copy', () => {
    expect(statsPage).toMatch(/Trading bot performance/);
    expect(statsPage).toMatch(/BOT_LIST\.map/);
    expect(statsPage).toMatch(/Different strategies are not blended into one fake win rate/);
    expect(statsPage).toMatch(/Portfolio snapshot/);
    expect(statsPage).toMatch(/BotJournalPanels/);
  });

  it('uses safe read models and never direct adapter calls', () => {
    expect(statsPage).toMatch(/loadBotReadModel/);
    expect(statsPage).not.toMatch(/getBotAdapter/);
    expect(statsPage).toMatch(/No bot metrics available/);
    expect(statsPage).toMatch(/legacyLiveConfig/);
    expect(statsPage).toMatch(/LegacyOperationsPanel/);
  });

  it('renders responsive tables with data labels and an honest no-equity state', () => {
    expect(statsPage).toMatch(/wtc-table-wrap/);
    expect(statsPage).toMatch(/data-label="Symbol"/);
    expect(statsPage).toMatch(/No equity curve available/);
    expect(statsPage).toMatch(/does not expose enough equity history/);
  });

  it('is linked from the bot list and bot subnav', () => {
    expect(botsList).toMatch(/\/app\/bots\/statistics\?bot=tortila/);
    expect(botsList).toMatch(/Open statistics/);
    expect(subnav).toMatch(/Statistics/);
    expect(subnav).toMatch(/Journal/);
    expect(subnav).toMatch(/\/app\/bots\/statistics\?bot=\$\{bot\}/);
  });

  it('adds journal-grade panels without fabricating unavailable data', () => {
    expect(statsPanels).toMatch(/Returns matrix/);
    expect(statsPanels).toMatch(/Risk diagnostics/);
    expect(statsPanels).toMatch(/Trade quality/);
    expect(statsPanels).toMatch(/Symbol contribution/);
    expect(statsPanels).toMatch(/Daily PnL heatmap/);
    expect(statsPanels).toMatch(/PnL distribution/);
    expect(statsPanels).toMatch(/Exit reasons/);
    expect(statsPanels).toMatch(/Open risk exposure/);
    expect(statsPanels).toMatch(/Activity feed/);
    expect(statsPanels).toMatch(/filterZeroEquity/);
    expect(statsPanels).toMatch(/No monthly return data/);
    expect(statsPanels).toMatch(/No exit-reason data/);
  });

  it('renders Legacy operational statistics from safe pub_id snapshots', () => {
    expect(statsPage).toMatch(/liveConfig=\{legacyLiveConfig\}/);
    expect(statsPage).toMatch(/Wallet balance snapshot/);
    expect(statsPage).toMatch(/Active orders/);
    expect(statsPanels).toMatch(/Provider accounts/);
    expect(statsPanels).toMatch(/Active slots/);
    expect(statsPanels).toMatch(/Active order coverage/);
    expect(statsPanels).not.toMatch(/live reads blocked/);
  });

  it('adds a DB-first trade journal review surface without mutating imported trades', () => {
    expect(journalPage).toMatch(/Trade review journal/);
    expect(journalPage).toMatch(/Review queue/);
    expect(journalPage).toMatch(/Save review/);
    expect(journalFeature).toMatch(/listBotTradeImports/);
    expect(journalFeature).toMatch(/listBotTradeReviews/);
    expect(journalFeature).toMatch(/upsertBotTradeReview/);
    expect(journalFeature).toMatch(/Imported trades remain immutable/);
  });
});
