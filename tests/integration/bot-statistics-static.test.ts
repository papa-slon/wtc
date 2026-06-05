import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const statsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const statsPanels = read('apps/web/src/features/bots/statistics-panels.tsx');
const statsCommandCenter = read('apps/web/src/features/bots/BotStatisticsCommandCenter.tsx');
const runtimeEvidence = read('apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx');
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
    expect(statsPage).toMatch(/bots with metrics/);
    expect(statsPage).toMatch(/partialMoney/);
    expect(statsPage).toMatch(/BotJournalPanels/);
    expect(statsPage).toMatch(/BotOperationMapPanel/);
    expect(statsPage).toMatch(/Statistics operation map/);
    expect(statsPage).toMatch(/BotRuntimeEvidencePanel/);
    expect(statsPage).toMatch(/Statistics evidence ladder/);
    expect(statsPage).toMatch(/BotStatisticsCommandCenter/);
    expect(statsCommandCenter).toMatch(/Statistics command center/);
    expect(statsPage).toMatch(/operationReview\.metrics/);
  });

  it('uses safe read models and never direct adapter calls', () => {
    expect(statsPage).toMatch(/loadBotReadModel/);
    expect(statsPage).not.toMatch(/getBotAdapter/);
    expect(statsPage).toMatch(/No bot metrics available/);
    expect(statsPage).toMatch(/legacyLiveConfig/);
    expect(statsPage).toMatch(/LegacyOperationsPanel/);
    expect(statsPage).toMatch(/loadBotConfig/);
    expect(statsPage).toMatch(/buildBotConfigReview/);
  });

  it('uses the shared warning summary state instead of raw empty warning claims', () => {
    expect(statsPage).toMatch(/WarningSummaryPanel/);
    expect(statsPage).toMatch(/Risk and status notes/);
    expect(statsPage).toMatch(/\['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'\]/);
    expect(statsPage).toMatch(/Warning state unavailable/);
    expect(statsPage).toMatch(/Bot room links and limitations/);
    expect(statsPage).not.toMatch(/No adapter warnings/);
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
    expect(statsPanels).toMatch(/Provider runtime snapshot unavailable/);
    expect(statsPanels).toMatch(/DB snapshot evidence/);
    expect(statsPanels).not.toMatch(/DB live-read/);
    expect(statsPanels).not.toMatch(/live reads blocked/);
  });

  it('renders a runtime evidence ladder for statistics source clarity', () => {
    expect(runtimeEvidence).toMatch(/Runtime evidence ladder/);
    expect(runtimeEvidence).toMatch(/Journal health/);
    expect(runtimeEvidence).toMatch(/WTC worker check/);
    expect(runtimeEvidence).toMatch(/WTC DB snapshot/);
    expect(runtimeEvidence).toMatch(/Scoped page data/);
    expect(runtimeEvidence).toMatch(/equitySamples/);
    expect(runtimeEvidence).toMatch(/provider secrets, and raw provider payloads are not rendered/);
    expect(runtimeEvidence).not.toMatch(/getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|apiKey|apiSecret|sealed|Connection verified/);
  });

  it('renders a statistics command center that links performance, settings, admin mirror, and live boundary', () => {
    expect(statsCommandCenter).toMatch(/export function BotStatisticsCommandCenter/);
    expect(statsCommandCenter).toMatch(/Statistics command center/);
    expect(statsCommandCenter).toMatch(/1\. Data scope/);
    expect(statsCommandCenter).toMatch(/2\. Performance/);
    expect(statsCommandCenter).toMatch(/3\. Risk/);
    expect(statsCommandCenter).toMatch(/4\. Settings link/);
    expect(statsCommandCenter).toMatch(/5\. Admin mirror/);
    expect(statsCommandCenter).toMatch(/6\. Live boundary/);
    expect(statsCommandCenter).toMatch(/Admins can inspect this user-scoped settings and statistics model/);
    expect(statsCommandCenter).toMatch(/does not run exchange pings, provider probes, live config apply, position actions, or runtime start\/stop/);
    expect(statsCommandCenter).toMatch(/\/app\/bots\/\$\{props\.bot\}\/settings/);
    expect(statsCommandCenter).toMatch(/\/app\/bots\/\$\{props\.bot\}\/safety/);
    expect(statsCommandCenter).not.toMatch(/getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|apiKey|apiSecret|sealed|Connection verified|type="submit"/);
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
