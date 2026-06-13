import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const userStatsPage = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const overviewData = read('apps/web/src/features/bots/tortila-overview-data.ts');
const adminUserBots = read('apps/web/src/app/admin/users/[userId]/bots/page.tsx');

describe('bot statistics completion clarity', () => {
  it('user statistics page is the live premium terminal, free of the old audit machinery', () => {
    // The cluttered worker-heartbeat / readiness / command-center machinery is gone from this page.
    expect(userStatsPage).not.toMatch(/loadBotReadinessForUser/);
    expect(userStatsPage).not.toMatch(/workerHeartbeatStatus/);
    expect(userStatsPage).not.toMatch(/BotStatisticsCommandCenter/);
    expect(userStatsPage).not.toMatch(/Worker heartbeat/);
    // It reads live journal data and renders the premium overview.
    expect(userStatsPage).toMatch(/loadTortilaLiveOverview/);
    expect(userStatsPage).toMatch(/<TortilaOverview/);
  });

  it('the deleted noise-panel component files are actually removed', () => {
    expect(() => read('apps/web/src/features/bots/BotStatisticsCommandCenter.tsx')).toThrow();
    expect(() => read('apps/web/src/features/bots/statistics-panels.tsx')).toThrow();
  });

  it('Legacy tab renders the premium reconstructed DCA terminal without fabricating performance history', () => {
    // Premium reconstructed DCA terminal via the safe read-only shim — never a fabricated account.
    expect(userStatsPage).toMatch(/loadLegacyLiveOverview/);
    expect(userStatsPage).toMatch(/<LegacyOverview/);
    expect(userStatsPage).toMatch(/never fabricates a \$0 account or placeholder positions/);
    expect(userStatsPage).not.toMatch(/Legacy statistics cockpit/);
    expect(userStatsPage).not.toMatch(/Stage utilization/);
  });

  it('Tortila live read never treats an empty journal as a real $0 account', () => {
    expect(overviewData).toMatch(/HONEST EMPTY GUARD/);
    expect(overviewData).toMatch(/status: 'empty'/);
    expect(overviewData).toMatch(/Live numbers are hidden rather than shown as a fabricated \$0 account/);
    // walletEquity is mapped from /api/summary last_equity by the HTTP adapter — the live read uses it.
    expect(overviewData).toMatch(/adapter\.getMetrics\('tortila_bot'\)/);
  });

  it('mirrors completion clarity into selected-user admin drilldown (unchanged admin surface)', () => {
    expect(adminUserBots).toMatch(/adminStatisticsCoverageRows/);
    expect(adminUserBots).toMatch(/statistics coverage matrix/);
    expect(adminUserBots).toMatch(/Aggregate worker precheck/);
    expect(adminUserBots).toMatch(/Provider scope/);
    expect(adminUserBots).toMatch(/Operational coverage/);
    expect(adminUserBots).toMatch(/Journal import gate/);
    expect(adminUserBots).toMatch(/tortilaJournalImportGate/);
    expect(adminUserBots).toMatch(/No \/api\/marks live call is made by this admin view/);
    expect(adminUserBots).toMatch(/Source-proof gate/);
    expect(adminUserBots).toMatch(/Legacy PF, win rate, realized PnL, and attribution are not fabricated/);
  });

  it('keeps the user statistics surface read-only and secret-free', () => {
    expect(userStatsPage).not.toMatch(/getBotAdapter|vault\.open|apiKey|apiSecret|sealed|Connection verified/);
    expect(userStatsPage).not.toMatch(/startBot|stopBot|applyConfig|type="submit"/);
    // The page delegates the live read to the loader; it must not fetch the token-bearing journal itself.
    expect(userStatsPage).not.toMatch(/fetch\(/);
  });
});
