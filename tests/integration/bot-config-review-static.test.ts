import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildBotConfigReview, firstLegacyStageCapacityIssue, legacyStageCapacityIssues } from '../../apps/web/src/features/bots/config-review';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

describe('bot config effective review guardrails', () => {
  it('summarizes Tortila risk/system settings without live-control language', () => {
    const review = buildBotConfigReview({
      productCode: 'tortila_bot',
      sourceLabel: 'System default v2',
      config: {
        operationMode: 'auto',
        maxOpenSymbols: 3,
        maxTotalUnits: 8,
        maxUnitsPerDirection: 5,
        haltDrawdownPercent: 25,
        dailyMaxLossPercent: 4,
        maxNewEntriesPerTick: 2,
      },
      tortilaRows: [
        { symbol: 'XRP/USDT:USDT', timeframe: '4h', system: 2, riskPercent: 0.3, stopN: 2, addStep: 0.5, maxUnits: 4, atrPeriod: 20, takeProfitRr: 0 },
        { symbol: 'TRX/USDT:USDT', timeframe: '1h', system: 1, riskPercent: 0.5, stopN: 3, addStep: 1, maxUnits: 3, atrPeriod: 20, takeProfitRr: 13 },
      ],
    });

    expect(review.title).toBe('Effective Tortila settings review');
    expect(review.summary).toContain('2 configured coins');
    expect(review.metrics.map((metric) => metric.label)).toContain('System mix');
    expect(review.sections.map((section) => section.title)).toEqual(['Coin plan', 'Risk limits']);
    expect(JSON.stringify(review).toLowerCase()).not.toMatch(/startbot|stopbot|applyconfig|connection verified|apikey|apisecret/);
  });

  it('summarizes Legacy RSI/CCI stage slots and provider mapping as read-only evidence', () => {
    const review = buildBotConfigReview({
      productCode: 'legacy_bot',
      sourceLabel: 'Custom v3',
      config: { operationMode: 'manual', maxSymbols: 4 },
      providerAccountCount: 1,
      legacyRows: [
        { symbol: 'AAVE-USDT', active: true, timeframe: '3m', stage: 1, useRsi: true, rsiLength: 14, rsiThreshold: 20, useCci: false, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, useBalancePercent: 1.5, leverage: 2, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
        { symbol: 'TAO-USDT', active: true, timeframe: '1m', stage: 2, useRsi: false, rsiLength: 14, rsiThreshold: 20, useCci: true, cciLength: 20, cciThreshold: -240, takeProfitPercent: 0.5, initialEntryPercent: 100, useBalancePercent: 1.5, leverage: 2, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useDelayFilter: true, delayBars: 2, useDeltaFilter: true, deltaFilter: -10 },
      ],
      legacyStages: [
        { stage: 1, rsiSlots: 3, cciSlots: 2 },
        { stage: 2, rsiSlots: 2, cciSlots: 1 },
      ],
    });

    expect(review.title).toBe('Effective Legacy settings review');
    expect(review.summary).toContain('1 RSI trigger');
    expect(review.summary).toContain('1 CCI trigger');
    expect(review.metrics.find((metric) => metric.label === 'Stage capacity')?.value).toBe('8 slots');
    expect(review.sections.map((section) => section.title)).toEqual(['Signal map', 'Stage slots']);
    expect(review.footnote).toContain('read-only evidence');
  });

  it('identifies the first Legacy stage that exceeds its RSI or CCI capacity', () => {
    const rows = [
      { symbol: 'AAVE-USDT', active: true, timeframe: '3m', stage: 1, useRsi: true, rsiLength: 14, rsiThreshold: 20, useCci: false, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, useBalancePercent: 1.5, leverage: 2, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
      { symbol: 'BCH-USDT', active: true, timeframe: '3m', stage: 1, useRsi: true, rsiLength: 14, rsiThreshold: 20, useCci: false, cciLength: 20, cciThreshold: -230, takeProfitPercent: 0.5, initialEntryPercent: 100, useBalancePercent: 1.5, leverage: 2, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useDelayFilter: false, delayBars: 1, useDeltaFilter: false, deltaFilter: 0 },
      { symbol: 'TAO-USDT', active: true, timeframe: '1m', stage: 2, useRsi: false, rsiLength: 14, rsiThreshold: 20, useCci: true, cciLength: 20, cciThreshold: -240, takeProfitPercent: 0.5, initialEntryPercent: 100, useBalancePercent: 1.5, leverage: 2, averagingLevels: 3, averagingPercents: '3,12,35', averagingVolumePercents: '4,6,12', useDelayFilter: true, delayBars: 2, useDeltaFilter: true, deltaFilter: -10 },
    ] as const;
    const stages = [
      { stage: 1, rsiSlots: 1, cciSlots: 2 },
      { stage: 2, rsiSlots: 2, cciSlots: 1 },
    ] as const;

    expect(legacyStageCapacityIssues(rows, stages)).toEqual([
      {
        stage: 1,
        stageRow: 1,
        rsiUsed: 2,
        rsiSlots: 1,
        cciUsed: 0,
        cciSlots: 2,
        activeCoins: 2,
        overRsi: true,
        overCci: false,
      },
    ]);
    expect(firstLegacyStageCapacityIssue(rows, stages)?.stageRow).toBe(1);
  });

  it('wires the review panel into user settings/setup and admin system defaults only', () => {
    const dashboard = read('apps/web/src/app/(app)/app/bots/[bot]/page.tsx');
    const settings = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
    const setup = read('apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx');
    const admin = read('apps/web/src/app/admin/bots/config/page.tsx');
    const panel = read('apps/web/src/features/bots/BotConfigReviewPanel.tsx');
    const setupCenter = read('apps/web/src/features/bots/BotSetupControlCenter.tsx');
    const operationPanel = read('apps/web/src/features/bots/BotOperationMapPanel.tsx');
    const legacyTable = read('apps/web/src/features/bots/LegacyAveragingConfigTable.tsx');
    const tortilaTable = read('apps/web/src/features/bots/TortilaSymbolConfigTable.tsx');
    const errorCopy = read('apps/web/src/features/bots/config-error-copy.ts');

    expect(dashboard).toContain('BotOperationMapPanel');
    expect(dashboard).toContain('operationReview.metrics');
    expect(settings).toContain('buildBotConfigReview');
    expect(settings).toContain('firstLegacyStageCapacityIssue');
    expect(settings).toContain('legacyStageCapacityIssue={legacyStageCapacityIssue}');
    expect(settings).toContain('botConfigErrorCopy');
    expect(settings).toContain('botConfigErrorRedirect');
    expect(settings).toContain('firstFormIssue: botConfigFirstFormIssue');
    expect(settings).toContain('<BotConfigReviewPanel review={configReview} />');
    expect(settings).toContain('TORTILA_EMBEDDED_FIELD_NAMES');
    expect(settings).toContain('tortilaPortfolioCaps');
    expect(settings).toContain('portfolioCaps={tortilaPortfolioCaps}');
    expect(settings).toContain('How this bot will operate');
    expect(settings).toContain('BotOperationMapPanel');
    expect(settings).toContain('system v${state.systemDefault.version}');
    expect(settings).toContain('custom v${state.version}');
    expect(setup).toContain('Current setup settings review');
    expect(setup).toContain('BotSetupControlCenter');
    expect(setup).toContain('firstLegacyStageCapacityIssue');
    expect(setup).toContain('legacyStageCapacityIssue={legacyStageCapacityIssue}');
    expect(setup).toContain('Setup operation map');
    expect(setup).toContain('BotOperationMapPanel');
    expect(setup).toContain('botConfigErrorCopy');
    expect(setup).toContain('firstFormIssue: botConfigFirstFormIssue');
    expect(setup).toContain("!hasKeys || !hasConfig");
    expect(setup).toContain('Save strategy settings first');
    expect(setup).toContain('TORTILA_EMBEDDED_FIELD_NAMES');
    expect(setup).toContain('tortilaPortfolioCaps');
    expect(setup).toContain('portfolioCaps={tortilaPortfolioCaps}');
    expect(admin).toContain('Effective system default review');
    expect(admin).toContain('providerAccountCount: 0');
    expect(panel).toContain('Read-only summary of the config that will be saved or inherited.');
    expect(setupCenter).toContain('Bot setup control center');
    expect(setupCenter).toContain("'use client'");
    expect(setupCenter).toContain('Default or custom');
    expect(setupCenter).toContain('Exchange key');
    expect(setupCenter).toContain('Provider pub_id');
    expect(setupCenter).toContain('WTC vault metadata confirmed');
    expect(setupCenter).toContain('Exchange metadata saved');
    expect(setupCenter).toContain('DB mapping confirmed');
    expect(setupCenter).toContain('Snapshot evidence only');
    expect(setupCenter).toContain('Coin and stage map');
    expect(setupCenter).toContain('Coin strategy map');
    expect(setupCenter).toContain('activeIssue?: BotConfigErrorCopy');
    expect(setupCenter).toContain('legacyStageCapacityIssue?: LegacyStageCapacityIssue');
    expect(setupCenter).toContain('LEGACY_STAGE_CAPACITY_DRAFT_EVENT');
    expect(setupCenter).toContain('Validation issue');
    expect(setupCenter).toContain('Needs fix');
    expect(setupCenter).toContain('Draft stage capacity warning');
    expect(setupCenter).toContain('Unsaved over capacity');
    expect(setupCenter).toContain('Unsaved draft preview');
    expect(setupCenter).toContain('Stage capacity warning');
    expect(setupCenter).toContain('Over capacity');
    expect(setupCenter).toContain('Review stage');
    expect(setupCenter).toContain('legacy-stage-${issue.stageRow}');
    expect(setupCenter).toContain('tortila-symbol-${issue.row}');
    expect(setupCenter).toContain('legacy-symbol-${issue.row}');
    expect(setupCenter).toContain('legacy-stage-${issue.row}');
    expect(setupCenter).toContain("issue.target === 'tortila-cap'");
    expect(setupCenter).toContain('tortila-portfolio-caps');
    expect(setupCenter).toContain('Fix caps');
    expect(setupCenter).toContain('Fix row');
    expect(setupCenter).toContain('Fix stage');
    expect(setupCenter).toContain('Review and statistics');
    expect(setupCenter).toContain('User/admin boundary');
    expect(setupCenter).toContain('Live control boundary');
    expect(setupCenter).toContain('Live exchange ping is still not run');
    expect(setupCenter).toContain('Start, stop, live diagnostics, live apply, and position-closing actions are not available');
    expect(setupCenter).not.toContain('providerPubId');
    expect(settings).toContain('legacyProviderState={readiness.providerPubIdState}');
    expect(settings).toContain('activeIssue={configError ?? undefined}');
    expect(settings).toContain('saveIssue={configError ?? undefined}');
    expect(setup).toContain('legacyProviderState={readiness.providerPubIdState}');
    expect(setup).toContain('activeIssue={configError ?? undefined}');
    expect(setup).toContain('saveIssue={configError ?? undefined}');
    expect(setup).toContain('WTC vault metadata confirmed; live exchange ping not run');
    expect(setup).toContain('WTC metadata saved; live exchange ping not run');
    expect(setup).not.toContain('connection test pending');
    expect(operationPanel).toContain('Bot operation map');
    expect(operationPanel).toContain('Coin trigger map');
    expect(operationPanel).toContain('Coin strategy map');
    expect(operationPanel).toContain('Runtime evidence');
    expect(operationPanel).toContain('Admin visibility');
    expect(operationPanel).toContain('live control disabled');
    expect(operationPanel).toContain('no live apply, start, or stop');
    expect(legacyTable).toContain('legacy_symbol_custom_');
    expect(legacyTable).toContain('InstrumentPicker');
    expect(legacyTable).toContain("instrumentOptionsForBot('legacy_bot'");
    expect(legacyTable).toContain('Search the Legacy/BingX catalog or type a dash-format symbol');
    expect(legacyTable).toContain('legacy_symbol_${i}');
    expect(legacyTable).toContain('Stage {draftRow.stage || 1} / {signal.toUpperCase()} slot');
    expect(legacyTable).toContain('A coin consumes one slot in its selected stage and trigger bucket');
    expect(legacyTable).toContain('Trigger resolution map');
    expect(legacyTable).toContain('independent trigger candidates');
    expect(legacyTable).toContain('WTC does not assign a hidden priority order from this page');
    expect(legacyTable).toContain('Paused rows and blank coin rows are excluded from this draft map');
    expect(legacyTable).toContain('Candidate labels show row number, symbol, timeframe, and trigger threshold before save');
    expect(legacyTable).toContain('LegacyRowDraft');
    expect(legacyTable).toContain('defaultRowDraft');
    expect(legacyTable).toContain('rowDrafts');
    expect(legacyTable).toContain('setRowDrafts');
    expect(legacyTable).toContain('updateRowDraft');
    expect(legacyTable).toContain('signalDescriptor');
    expect(legacyTable).toContain('#${rowIndex + 1} ${row.symbol} ${row.timeframe}');
    expect(legacyTable).toContain('stageResolutionRows');
    expect(legacyTable).toContain('candidateSummary');
    expect(legacyTable).toContain('RSI candidates');
    expect(legacyTable).toContain('CCI candidates');
    expect(legacyTable).toContain('Capacity state');
    expect(legacyTable).toContain('RSI trigger threshold');
    expect(legacyTable).toContain('CCI trigger threshold');
    expect(legacyTable).toContain('Stage slot group');
    expect(legacyTable).toContain('allowed -500 to 500');
    expect(legacyTable).toContain('Usage updates as you edit the draft capacities below');
    expect(legacyTable).toContain('draft preview inside capacity');
    expect(legacyTable).toContain('LEGACY_STAGE_CAPACITY_DRAFT_EVENT');
    expect(legacyTable).toContain('dispatchDraftStageCapacityPreview');
    expect(legacyTable).toContain('firstDraftStageCapacityIssue');
    expect(legacyTable).toContain('stageDraftTouched');
    expect(legacyTable).toContain('stageDrafts');
    expect(legacyTable).toContain('setStageDrafts');
    expect(legacyTable).toContain('value={draft.rsiSlots}');
    expect(legacyTable).toContain('value={draft.cciSlots}');
    expect(legacyTable).toContain('RSI used');
    expect(legacyTable).toContain('CCI used');
    expect(legacyTable).toContain('inside capacity');
    expect(legacyTable).toContain('over capacity');
    expect(legacyTable).toContain('id={`legacy-symbol-${i + 1}`}');
    expect(legacyTable).toContain('id={`legacy-stage-${i + 1}`}');
    expect(legacyTable).toContain('role="alert"');
    expect(legacyTable).toContain('aria-invalid');
    expect(legacyTable).toContain('ISSUE_SCROLL_MARGIN_TOP');
    expect(legacyTable).toContain('scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP');
    expect(legacyTable).toContain('tabIndex={hasSaveIssue ? -1 : undefined}');
    expect(legacyTable).toContain('tabIndex={-1}');
    expect(tortilaTable).toContain("'use client'");
    expect(tortilaTable).toContain('Tortila strategy map');
    expect(tortilaTable).toContain('TORTILA_CAP_INPUTS');
    expect(tortilaTable).toContain('TORTILA_CAP_ERROR_CODES');
    expect(tortilaTable).toContain('TORTILA_CAP_ISSUE_INPUTS');
    expect(tortilaTable).toContain('tortilaPortfolioCapIssue');
    expect(tortilaTable).toContain('capInputHasIssue');
    expect(tortilaTable).toContain("issue?.target === 'tortila-cap'");
    expect(tortilaTable).toContain('TortilaPortfolioCaps');
    expect(tortilaTable).toContain('defaultPortfolioCaps');
    expect(tortilaTable).toContain('capDraft');
    expect(tortilaTable).toContain('setCapDraft');
    expect(tortilaTable).toContain('updateCapDraft');
    expect(tortilaTable).toContain('portfolioCapRows');
    expect(tortilaTable).toContain('Portfolio caps');
    expect(tortilaTable).toContain('tortila-portfolio-caps-save-error');
    expect(tortilaTable).toContain('Portfolio cap issue');
    expect(tortilaTable).toContain('WTC reference caps');
    expect(tortilaTable).toContain('saved with strategy profile');
    expect(tortilaTable).toContain('Reference cap');
    expect(tortilaTable).toContain('Draft pressure');
    expect(tortilaTable).toContain('draft over reference cap');
    expect(tortilaTable).toContain('draft inside reference cap');
    expect(tortilaTable).toContain('name={cap.name}');
    expect(tortilaTable).toContain('maxOpenSymbols');
    expect(tortilaTable).toContain('maxTotalUnits');
    expect(tortilaTable).toContain('maxUnitsPerDirection');
    expect(tortilaTable).toContain('haltDrawdownPercent');
    expect(tortilaTable).toContain('dailyMaxLossPercent');
    expect(tortilaTable).toContain('maxNewEntriesPerTick');
    expect(tortilaTable).toContain('tortila-portfolio-limit');
    expect(tortilaTable).toContain('tortila-risk-limit');
    expect(tortilaTable).toContain('tortila-entry-throttle');
    expect(tortilaTable).toContain('TortilaRowDraft');
    expect(tortilaTable).toContain('defaultRowDraft');
    expect(tortilaTable).toContain('rowDrafts');
    expect(tortilaTable).toContain('setRowDrafts');
    expect(tortilaTable).toContain('updateRowDraft');
    expect(tortilaTable).toContain('activeDraftRows');
    expect(tortilaTable).toContain('strategyMapRows');
    expect(tortilaTable).toContain('candidateLabel');
    expect(tortilaTable).toContain('#${rowIndex + 1} ${effectiveSymbol(row)} ${row.timeframe}');
    expect(tortilaTable).toContain('Draft map groups visible coin rows by Turtle system');
    expect(tortilaTable).toContain('Candidate labels show row number, symbol, timeframe, system, risk, stop, add step, max units, ATR, and TP before save');
    expect(tortilaTable).toContain('Turtle bucket');
    expect(tortilaTable).toContain('Coin candidates');
    expect(tortilaTable).toContain('Risk shape');
    expect(tortilaTable).toContain('Position guardrails');
    expect(tortilaTable).toContain('Runtime export preview (draft)');
    expect(tortilaTable).toContain('Generated SYMBOL_CONFIGS (draft)');
    expect(tortilaTable).toContain('This preview reflects the visible draft rows in this form');
    expect(tortilaTable).toContain('id={`tortila-symbol-${i + 1}`}');
    expect(tortilaTable).toContain('role="alert"');
    expect(tortilaTable).toContain('aria-invalid');
    expect(tortilaTable).toContain('aria-describedby={hasInputIssue ? capIssueId : undefined}');
    expect(tortilaTable).toContain('ISSUE_SCROLL_MARGIN_TOP');
    expect(tortilaTable).toContain('scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP');
    expect(tortilaTable).toContain('tabIndex={hasSaveIssue ? -1 : undefined}');
    expect(tortilaTable).toContain('tabIndex={-1}');
    expect(errorCopy).toContain('code: string');
    expect(errorCopy).toContain('code,');
    expect(errorCopy).toContain("'tortila-cap'");
    expect(errorCopy).toContain('const tortilaCap');
    expect(errorCopy).toContain('ROW_SCOPED_ERROR_CODES');
    expect(errorCopy).toContain('Max open symbols must be 1-20');
    expect(errorCopy).toContain('Drawdown halt must be 1-95%');
    expect(errorCopy).toContain('SAFE_ERROR_CODES');
    expect(errorCopy).toContain('botConfigErrorRedirect');
    expect(errorCopy).toContain('URLSearchParams');

    const surfaces = [dashboard, settings, setup, admin, panel, setupCenter, operationPanel].join('\n');
    for (const forbidden of ['getBotAdapter', 'applyConfig', 'startBot', 'stopBot', 'restartBot', 'testExchange', 'providerAccountId', 'rawJson']) {
      expect(surfaces).not.toContain(forbidden);
    }
    for (const forbidden of ['apiSecret', 'providerPubId', 'providerAccountId', 'rawJson', 'applyConfig', 'startBot', 'stopBot', 'retest', 'legacyDatabaseUrl', 'https://']) {
      expect(errorCopy).not.toContain(forbidden);
    }
  });
});
