import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const userStatsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const statsCommandCenter = read('apps/web/src/features/bots/BotStatisticsCommandCenter.tsx');
const statsPanels = read('apps/web/src/features/bots/statistics-panels.tsx');
const adminUserBots = read('apps/web/src/app/admin/users/[userId]/bots/page.tsx');

describe('bot statistics completion clarity', () => {
  it('promotes aggregate worker heartbeat into the user statistics command center', () => {
    expect(userStatsPage).toMatch(/loadBotReadinessForUser\(user, active\.code, 'dashboard', \{ read: activeRead \}\)/);
    expect(userStatsPage).toMatch(/workerHeartbeatStatus/);
    expect(userStatsPage).toMatch(/workerHeartbeatLabel=\{workerHeartbeat\.label\}/);
    expect(userStatsPage).toMatch(/workerHeartbeatDetail=\{workerHeartbeat\.detail\}/);
    expect(statsCommandCenter).toMatch(/Worker heartbeat/);
    expect(statsCommandCenter).toMatch(/0\. Worker heartbeat/);
    expect(statsCommandCenter).toMatch(/target='worker'/);
    expect(statsCommandCenter).toMatch(/Statistics are not treated as green unless/);
  });

  it('renders Legacy operational completion without fabricating performance history', () => {
    expect(statsPanels).toMatch(/Legacy statistics cockpit/);
    expect(statsPanels).toMatch(/Stage utilization/);
    expect(statsPanels).toMatch(/Active triggers/);
    expect(statsPanels).toMatch(/Order-symbol coverage/);
    expect(statsPanels).toMatch(/Closed-trade history/);
    expect(statsPanels).toMatch(/Source-proof gate/);
    expect(statsPanels).toMatch(/sourceProofStatusLabel/);
    expect(statsPanels).toMatch(/sourceProofMissingSummary/);
    expect(statsPanels).toMatch(/pending import/);
    expect(statsPanels).toMatch(/Legacy source proof blocked/);
    expect(statsPanels).toMatch(/no durable Legacy closed-trade source is proven/);
    expect(statsPanels).toMatch(/Win rate, profit factor, realized PnL, and attribution stay hidden/);
    expect(statsPanels).toMatch(/Stage utilization by trigger/);
    expect(userStatsPage).toMatch(/closedTradeCount=\{trades\.filter/);
    expect(userStatsPage).toMatch(/legacyClosedTradeSourceProof/);
    expect(userStatsPage).toMatch(/closedTradeSourceProof=\{legacyClosedTradeSourceProof\}/);
  });

  it('renders Tortila journal confidence without treating live marks as proof', () => {
    expect(statsPanels).toMatch(/Tortila journal confidence/);
    expect(statsPanels).toMatch(/Journal trades/);
    expect(statsPanels).toMatch(/persisted closed-trade rows/);
    expect(statsPanels).toMatch(/Persisted journal source/);
    expect(statsPanels).toMatch(/computed only from persisted WTC journal snapshots/);
    expect(statsPanels).toMatch(/does not call \/api\/marks/);
    expect(statsPanels).toMatch(/Health alone is not treated as performance proof/);
  });

  it('mirrors completion clarity into selected-user admin drilldown', () => {
    expect(adminUserBots).toMatch(/adminStatisticsCoverageRows/);
    expect(adminUserBots).toMatch(/statistics coverage matrix/);
    expect(adminUserBots).toMatch(/Aggregate worker precheck/);
    expect(adminUserBots).toMatch(/Provider scope/);
    expect(adminUserBots).toMatch(/Operational coverage/);
    expect(adminUserBots).toMatch(/Journal import gate/);
    expect(adminUserBots).toMatch(/tortilaJournalImportGate/);
    expect(adminUserBots).toMatch(/journal evidence present/);
    expect(adminUserBots).toMatch(/persisted user-instance journal rows/);
    expect(adminUserBots).toMatch(/No \/api\/marks live call is made by this admin view/);
    expect(adminUserBots).toMatch(/keep journal worker monitoring/);
    expect(adminUserBots).toMatch(/Source-proof gate/);
    expect(adminUserBots).toMatch(/sourceProofStatusLabel/);
    expect(adminUserBots).toMatch(/sourceProofMissingSummary/);
    expect(adminUserBots).toMatch(/sourceProofSourceLabel/);
    expect(adminUserBots).toMatch(/Legacy closed-trade source proof is evaluated before importer work from/);
    expect(adminUserBots).toMatch(/provide source-proof artifact/);
    expect(adminUserBots).toMatch(/Closed-trade history/);
    expect(adminUserBots).toMatch(/Analytics status/);
    expect(adminUserBots).toMatch(/legacyPendingMetric/);
    expect(adminUserBots).toMatch(/pending import/);
    expect(adminUserBots).toMatch(/Legacy PF, win rate, realized PnL, and attribution are not fabricated/);
  });

  it('keeps the completion surfaces read-only and secret-free', () => {
    for (const source of [userStatsPage, statsCommandCenter, statsPanels, adminUserBots]) {
      expect(source).not.toMatch(/getBotAdapter|vault\.open|apiKey|apiSecret|sealed|Connection verified/);
      expect(source).not.toMatch(/startBot|stopBot|applyConfig|type="submit" name="start"/);
    }
    expect(userStatsPage).not.toMatch(/fetch\(/);
    expect(statsCommandCenter).not.toMatch(/fetch\(/);
    expect(statsPanels).not.toMatch(/fetch\(/);
  });
});
