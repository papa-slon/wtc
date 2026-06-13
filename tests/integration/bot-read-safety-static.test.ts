import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const accessLib = read('apps/web/src/lib/access.ts');
const data = read('apps/web/src/features/bots/data.tsx');
const botsList = read('apps/web/src/app/(app)/app/bots/page.tsx');
const botDetail = read('apps/web/src/app/(app)/app/bots/[bot]/page.tsx');
const positions = read('apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx');
const trades = read('apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx');
const equity = read('apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx');
const safety = read('apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx');
const warningPanel = read('apps/web/src/features/bots/WarningSummaryPanel.tsx');
const settings = read('apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx');
const setup = read('apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx');
const exchangeKeyReadiness = read('apps/web/src/features/bots/ExchangeKeyReadiness.tsx');
const botReadinessMap = read('apps/web/src/features/bots/BotReadinessMap.tsx');
const botLaunchReadinessPanel = read('apps/web/src/features/bots/BotLaunchReadinessPanel.tsx');
const botSetupControlCenter = read('apps/web/src/features/bots/BotSetupControlCenter.tsx');
const botOperationMap = read('apps/web/src/features/bots/BotOperationMapPanel.tsx');
const botContinuity = read('apps/web/src/features/bots/continuity.ts');
const botContinuityPanel = read('apps/web/src/features/bots/BotContinuityPanel.tsx');
const botRuntimeEvidence = read('apps/web/src/features/bots/BotRuntimeEvidencePanel.tsx');
const botReadiness = read('apps/web/src/features/bots/readiness.ts');
const botReadinessLoader = read('apps/web/src/features/bots/readiness-loader.ts');
const dbRepositories = read('packages/db/src/repositories.ts');
const statistics = read('apps/web/src/app/(app)/app/bots/statistics/page.tsx');
const backtester = read('apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx');
const configExportRoute = read('apps/web/src/app/api/bots/[bot]/config-export/route.ts');
const runnerDownloadRoute = read('apps/web/src/app/api/bots/[bot]/backtest/runner-download/route.ts');
const config = read('apps/web/src/features/bots/config.ts');
const adminQueries = read('apps/web/src/features/admin/queries.ts');
const adminBotHealthLoader = read('apps/web/src/features/admin/bot-health-loader.ts');
const adminHealthDetail = read('apps/web/src/features/admin/health-detail.ts');
const adminBots = read('apps/web/src/app/admin/bots/page.tsx');
const adminEvidencePanel = read('apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx');
const journal = read('apps/web/src/features/bots/journal.ts');
const warningsRegistry = read('packages/bot-adapters/src/warnings.ts');
const legacyConfigTable = read('apps/web/src/features/bots/LegacyAveragingConfigTable.tsx');
const tortilaConfigTable = read('apps/web/src/features/bots/TortilaSymbolConfigTable.tsx');

function sourceForFunction(src: string, name: string): string {
  const start = src.indexOf(`async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = src.indexOf('\nasync function ', start + 1);
  const exportDefault = src.indexOf('\nexport default', start + 1);
  const endCandidates = [next, exportDefault].filter((n) => n > start);
  const end = endCandidates.length > 0 ? Math.min(...endCandidates) : src.length;
  return src.slice(start, end);
}

describe('bot read surfaces tolerate blocked/not-ready adapters', () => {
  it('lets admins inspect bot pages while keeping ordinary bot access entitlement-gated', () => {
    expect(accessLib).toMatch(/export async function botAccessForUser/);
    expect(accessLib).toMatch(/user\.roles\.includes\('admin'\)/);
    expect(accessLib).toMatch(/return accessFor\(user\.id, productCode\)/);
    for (const source of [data, botsList, botDetail, settings, setup, backtester, configExportRoute, runnerDownloadRoute]) {
      expect(source).toMatch(/botAccessForUser/);
    }
  });

  it('shared loader catches LegacyAdapterBlockedError and AdapterNotReadyError', () => {
    expect(data).toMatch(/LegacyAdapterBlockedError/);
    expect(data).toMatch(/AdapterNotReadyError/);
    expect(data).toMatch(/botReadIssueFromError/);
    expect(data).toMatch(/safeBotCall/);
    expect(data).toMatch(/loadBotReadModel/);
  });

  it('bot dashboard pages use the safe read model instead of direct adapter data calls', () => {
    for (const source of [botsList, botDetail, positions, trades, equity, safety]) {
      expect(source).toMatch(/loadBotReadModelForUser/);
      expect(source).not.toMatch(/getBotAdapter/);
    }
  });

  it('bot list does not call read adapters for unentitled products', () => {
    expect(botsList).toMatch(/const read = access\.allowed \? await loadBotReadModelForUser\(user\.id, b\.code, \['metrics', 'warnings'\]\) : null/);
    expect(botsList).toMatch(/adapter status hidden until entitlement is active/);
  });

  it('bot list exposes a two-bot finish board without live-control or secret wiring', () => {
    expect(botsList).toMatch(/Two-bot finish board/);
    expect(botsList).toMatch(/Tortila finish path/);
    expect(botsList).toMatch(/Legacy finish path/);
    expect(botsList).toMatch(/loadBotReadinessForUser/);
    expect(botsList).toMatch(/includeOperationalRows: true/);
    expect(botsList).toMatch(/Configure Legacy averaging/);
    expect(botsList).toMatch(/Review Tortila Turtle settings/);
    expect(botsList).toMatch(/Open setup review/);
    expect(botsList).toMatch(/Open \{b\.name\} statistics/);
    expect(botsList).toMatch(/Open dashboard/);
    expect(botsList).toMatch(/Worker heartbeat/);
    expect(botsList).toMatch(/Live control/);
    expect(botsList).toMatch(/Live controls disabled/);
    expect(botsList).toMatch(/default profile/);
    expect(botsList).toMatch(/custom profile/);
    expect(botsList).toMatch(/settings editor/);
    expect(botsList).toMatch(/readiness dashboard/);
    expect(botsList).toMatch(/statistics cockpit/);
    expect(botsList).toMatch(/\/app\/bots\/statistics\?bot=\$\{b\.slug\}/);
    expect(botsList).not.toMatch(/features\/admin|loadAdmin|getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|apiKey|apiSecret|sealed|Connection verified|test connection|providerUrl|rawJson|liveConfig/);
  });

  it('UI renders adapter read issues instead of fabricating zeros', () => {
    for (const source of [botsList, botDetail, positions, trades, equity, safety]) {
      expect(source).toMatch(/\.issue/);
    }
    expect(botDetail).toMatch(/No metrics available from this adapter/);
  });

  it('keeps Tortila real-mode Mark and uPnL placeholders visibly unavailable and neutral', () => {
    expect(data).toContain('markUnavailable: boolean');
    expect(data).toContain('function sourceAdapterIsReal');
    expect(data).toContain("markUnavailable: productCode === 'tortila_bot'");
    expect(data).toContain("sourceAdapterIsReal(latestPosition?.sourceAdapter)");
    // The statistics page renders the premium TortilaOverview; mark/uPnL handling now lives in the
    // shared PositionCard, which shows "N/A" / "unavailable" when no live mark is present.
    expect(read('apps/web/src/features/bots/tortila-overview/position-card.tsx')).toContain('unavailable');
    expect(read('apps/web/src/features/bots/tortila-overview/position-card.tsx')).toContain('N/A');
    for (const source of [botDetail, positions]) {
      expect(source).toContain('const markUnavailable = read.markUnavailable');
      expect(source).toContain('Mark and uPnL unavailable');
      expect(source).toContain('WTC does not call /api/marks or a live exchange to fill Mark and uPnL.');
      expect(source).toContain("markUnavailable ? 'N/A' : fmtNum(p.markPrice)");
      expect(source).toContain("className={markUnavailable ? undefined : p.unrealizedPnl < 0 ? 'wtc-down' : 'wtc-up'}");
      expect(source).not.toContain("className={!markUnavailable && p.unrealizedPnl < 0 ? 'wtc-down' : 'wtc-up'}");
    }
  });

  it('bot dashboard/settings render a user-owned readiness map without live-control semantics', () => {
    expect(botDetail).toMatch(/BotReadinessMap/);
    expect(botDetail).toMatch(/BotLaunchReadinessPanel/);
    expect(botDetail).toMatch(/loadBotReadinessForUser\(user, meta\.code, 'dashboard', \{ read \}\)/);
    expect(botDetail).toMatch(/const readinessItems = readiness\.items/);
    // SETTINGS_SPEC: the premium settings page deletes the readiness map +
    // continuity monitor. The setup page keeps them (out of scope for the spec).
    expect(settings).not.toMatch(/Settings readiness map/);
    expect(settings).not.toMatch(/BotContinuityPanel/);
    expect(settings).not.toMatch(/Settings continuity monitor/);
    expect(settings).toMatch(/TORTILA_EMBEDDED_FIELD_NAMES/);
    expect(settings).toMatch(/tortilaPortfolioCaps/);
    expect(settings).toMatch(/portfolioCaps=\{tortilaPortfolioCaps\}/);
    expect(setup).toMatch(/Setup readiness map/);
    expect(setup).toMatch(/loadBotReadinessForUser\(user, meta\.code, 'setup-review'/);
    expect(setup).toMatch(/includeOperationalRows: false/);
    expect(setup).toMatch(/const setupReadiness = readiness\.items/);
    expect(setup).toMatch(/BotContinuityPanel/);
    expect(setup).toMatch(/uncheckedBotContinuityHealth/);
    expect(setup).toMatch(/title="Setup continuity monitor"/);
    expect(setup).toMatch(/dataRowsLabel="setup evidence rows"/);
    expect(setup).toMatch(/TORTILA_EMBEDDED_FIELD_NAMES/);
    expect(setup).toMatch(/tortilaPortfolioCaps/);
    expect(setup).toMatch(/portfolioCaps=\{tortilaPortfolioCaps\}/);
    expect(botReadinessLoader).toMatch(/import 'server-only'/);
    expect(botReadinessLoader).toMatch(/summarizeExchangeKeyMetadata/);
    expect(botReadinessLoader).toMatch(/summarizeUserBotProviderMapping/);
    expect(botReadinessLoader).toMatch(/if \(!access\.allowed\)/);
    expect(botReadiness).toMatch(/readState === 'unreachable' \|\| input\.readState === 'malformed'/);
    expect(botReadiness).toMatch(/Exchange metadata saved/);
    expect(botReadiness).toMatch(/vault_metadata_confirmed/);
    expect(botReadiness).toMatch(/if \(!input\.accessAllowed\) return \[accessItem\]/);
    expect(botReadiness).toMatch(/Worker heartbeat/);
    expect(botReadiness).toMatch(/target='worker'/);
    expect(botReadiness).toMatch(/workerBotContinuityStatus/);
    expect(botReadiness).toMatch(/lastSyncAt/);
    expect(botReadiness).toMatch(/staleDataSeconds/);
    expect(botReadiness).toMatch(/Fresh aggregate/);
    expect(botReadiness).toMatch(/Runtime snapshot/);
    expect(botReadiness).toMatch(/Start\/stop\/apply disabled/);
    expect(botReadiness).toMatch(/Live apply/);
    expect(botReadinessMap).toMatch(/export function BotReadinessMap/);
    expect(botReadinessMap).toMatch(/wtc-table/);
    expect(botLaunchReadinessPanel).toMatch(/export function BotLaunchReadinessPanel/);
    expect(botLaunchReadinessPanel).toMatch(/Launch readiness command center/);
    expect(botLaunchReadinessPanel).toMatch(/Launch decision/);
    expect(botLaunchReadinessPanel).toMatch(/Start bot unavailable/);
    expect(botLaunchReadinessPanel).toMatch(/live start disabled/);
    expect(botLaunchReadinessPanel).toMatch(/no exchange ping/);
    expect(botLaunchReadinessPanel).toMatch(/does not start, stop, apply config, retest\s+exchange connectivity, or touch open positions/);
    expect(botLaunchReadinessPanel).toMatch(/Open statistics/);
    expect(botSetupControlCenter).toMatch(/export function BotSetupControlCenter/);
    expect(botSetupControlCenter).toMatch(/'use client'/);
    expect(botSetupControlCenter).toMatch(/Bot setup control center/);
    expect(botSetupControlCenter).toMatch(/Default or custom/);
    expect(botSetupControlCenter).toMatch(/WTC vault metadata confirmed/);
    expect(botSetupControlCenter).toMatch(/Exchange metadata saved/);
    expect(botSetupControlCenter).toMatch(/DB mapping confirmed/);
    expect(botSetupControlCenter).toMatch(/Coin and stage map/);
    expect(botSetupControlCenter).toMatch(/activeIssue\?: BotConfigErrorCopy/);
    expect(botSetupControlCenter).toMatch(/legacyStageCapacityIssue\?: LegacyStageCapacityIssue/);
    expect(botSetupControlCenter).toMatch(/LEGACY_STAGE_CAPACITY_DRAFT_EVENT/);
    expect(botSetupControlCenter).toMatch(/Validation issue/);
    expect(botSetupControlCenter).toMatch(/Needs fix/);
    expect(botSetupControlCenter).toMatch(/Draft stage capacity warning/);
    expect(botSetupControlCenter).toMatch(/Unsaved over capacity/);
    expect(botSetupControlCenter).toMatch(/Stage capacity warning/);
    expect(botSetupControlCenter).toMatch(/Over capacity/);
    expect(botSetupControlCenter).toMatch(/Review stage/);
    expect(botSetupControlCenter).toContain('tortila-symbol-${issue.row}');
    expect(botSetupControlCenter).toContain('legacy-symbol-${issue.row}');
    expect(botSetupControlCenter).toContain('legacy-stage-${issue.row}');
    expect(botSetupControlCenter).toContain('legacy-stage-${issue.stageRow}');
    expect(botSetupControlCenter).toContain("issue.target === 'tortila-cap'");
    expect(botSetupControlCenter).toContain('tortila-portfolio-caps');
    expect(botSetupControlCenter).toMatch(/Fix caps/);
    expect(botSetupControlCenter).toMatch(/Fix row/);
    expect(botSetupControlCenter).toMatch(/Fix stage/);
    expect(legacyConfigTable).toMatch(/ISSUE_SCROLL_MARGIN_TOP/);
    expect(legacyConfigTable).toMatch(/scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP/);
    expect(legacyConfigTable).toMatch(/tabIndex=\{hasSaveIssue \? -1 : undefined\}/);
    expect(legacyConfigTable).toMatch(/stageDrafts/);
    expect(legacyConfigTable).toMatch(/setStageDrafts/);
    expect(legacyConfigTable).toMatch(/stageDraftTouched/);
    expect(legacyConfigTable).toMatch(/dispatchDraftStageCapacityPreview/);
    expect(legacyConfigTable).toMatch(/firstDraftStageCapacityIssue/);
    expect(legacyConfigTable).toMatch(/Trigger resolution map/);
    expect(legacyConfigTable).toMatch(/independent trigger candidates/);
    expect(legacyConfigTable).toMatch(/WTC does not assign a hidden priority order from this page/);
    expect(legacyConfigTable).toMatch(/Paused rows and blank coin rows are excluded from this draft map/);
    expect(legacyConfigTable).toMatch(/Candidate labels show row number, symbol, timeframe, and trigger threshold before save/);
    expect(legacyConfigTable).toMatch(/LegacyRowDraft/);
    expect(legacyConfigTable).toMatch(/defaultRowDraft/);
    expect(legacyConfigTable).toMatch(/rowDrafts/);
    expect(legacyConfigTable).toMatch(/setRowDrafts/);
    expect(legacyConfigTable).toMatch(/updateRowDraft/);
    expect(legacyConfigTable).toMatch(/signalDescriptor/);
    expect(legacyConfigTable).toMatch(/stageResolutionRows/);
    expect(legacyConfigTable).toMatch(/candidateSummary/);
    expect(legacyConfigTable).toMatch(/RSI candidates/);
    expect(legacyConfigTable).toMatch(/CCI candidates/);
    expect(legacyConfigTable).toMatch(/value=\{draft\.rsiSlots\}/);
    expect(legacyConfigTable).toMatch(/value=\{draft\.cciSlots\}/);
    expect(tortilaConfigTable).toMatch(/ISSUE_SCROLL_MARGIN_TOP/);
    expect(tortilaConfigTable).toMatch(/scrollMarginTop: ISSUE_SCROLL_MARGIN_TOP/);
    expect(tortilaConfigTable).toMatch(/tabIndex=\{hasSaveIssue \? -1 : undefined\}/);
    expect(tortilaConfigTable).toMatch(/TORTILA_CAP_INPUTS/);
    expect(tortilaConfigTable).toMatch(/TORTILA_CAP_ERROR_CODES/);
    expect(tortilaConfigTable).toMatch(/TORTILA_CAP_ISSUE_INPUTS/);
    expect(tortilaConfigTable).toMatch(/tortilaPortfolioCapIssue/);
    expect(tortilaConfigTable).toMatch(/capInputHasIssue/);
    expect(tortilaConfigTable).toMatch(/issue\?\.target === 'tortila-cap'/);
    expect(tortilaConfigTable).toMatch(/Portfolio caps/);
    expect(tortilaConfigTable).toMatch(/tortila-portfolio-caps-save-error/);
    expect(tortilaConfigTable).toMatch(/Portfolio cap issue/);
    expect(tortilaConfigTable).toMatch(/WTC reference caps/);
    expect(tortilaConfigTable).toMatch(/Reference cap/);
    expect(tortilaConfigTable).toMatch(/Draft pressure/);
    expect(tortilaConfigTable).toMatch(/draft over reference cap/);
    expect(tortilaConfigTable).toMatch(/draft inside reference cap/);
    expect(tortilaConfigTable).toMatch(/These caps are WTC reference settings/);
    expect(tortilaConfigTable).toMatch(/aria-describedby=\{hasInputIssue \? capIssueId : undefined\}/);
    expect(botSetupControlCenter).toMatch(/User\/admin boundary/);
    expect(botSetupControlCenter).toMatch(/Live control boundary/);
    expect(botSetupControlCenter).not.toMatch(/providerPubId/);
    // SETTINGS_SPEC: the premium settings page deletes BotSetupControlCenter and
    // the other constructor panels (including the engineer-speak "no live-control
    // adapter actions" provenance card). It keeps the real save-error wiring + the
    // single honest save-bar note that nothing reaches a live exchange/bot.
    expect(settings).not.toMatch(/BotSetupControlCenter/);
    expect(settings).not.toMatch(/no live-control adapter actions/);
    expect(settings).toMatch(/saveIssue=\{configError \?\? undefined\}/);
    expect(settings).toMatch(/Nothing is pushed to a live exchange or bot/);
    expect(setup).toMatch(/BotSetupControlCenter/);
    expect(setup).toMatch(/mode="setup"/);
    expect(setup).toMatch(/exchangeKeyState=\{readiness\.exchangeKeyState\}/);
    expect(setup).toMatch(/legacyProviderState=\{readiness\.providerPubIdState\}/);
    expect(setup).toMatch(/hasConfig=\{hasConfig\}/);
    expect(setup).toMatch(/activeIssue=\{configError \?\? undefined\}/);
    expect(setup).toMatch(/saveIssue=\{configError \?\? undefined\}/);
    expect(setup).toMatch(/legacyStageCapacityIssue=\{legacyStageCapacityIssue\}/);
    expect(setup).toMatch(/WTC vault metadata confirmed; live exchange ping not run/);
    expect(setup).toMatch(/WTC metadata saved; live exchange ping not run/);
    expect(setup).not.toMatch(/connection test pending/);
    expect(botOperationMap).toMatch(/export function BotOperationMapPanel/);
    expect(botOperationMap).toMatch(/Settings source/);
    expect(botOperationMap).toMatch(/Runtime evidence/);
    expect(botOperationMap).toMatch(/Admin visibility/);
    expect(botOperationMap).toMatch(/Secrets and raw provider payloads are not rendered/);
    expect(botDetail).toMatch(/BotContinuityPanel/);
    expect(botDetail).toMatch(/dataRows=\{scopedDataRows\}/);
    // The statistics page is intentionally premium + simple: it renders the live trading terminal and
    // does NOT carry the continuity/evidence audit panels (those remain on the bot-room + safety pages).
    expect(statistics).not.toMatch(/BotContinuityPanel/);
    expect(statistics).not.toMatch(/Statistics continuity monitor/);
    expect(safety).toMatch(/BotContinuityPanel/);
    expect(safety).toMatch(/title="Safety continuity monitor"/);
    expect(botContinuity).toMatch(/export function buildBotContinuitySummary/);
    expect(botContinuity).toMatch(/export function uncheckedBotContinuityHealth/);
    expect(botContinuity).toMatch(/Silent-stop guard/);
    expect(botContinuity).toMatch(/statusLabel/);
    expect(botContinuity).toMatch(/dataRowsLabel/);
    expect(botContinuity).toMatch(/Mock\/demo data never becomes green continuity proof/);
    expect(botContinuity).toMatch(/This monitor never starts, stops, runs connection checks, applies config/);
    expect(botContinuityPanel).toMatch(/Continuity monitor/);
    expect(botContinuityPanel).toMatch(/worker heartbeat, scoped runtime snapshots, data freshness/);
    expect(botContinuityPanel).not.toMatch(/getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|apiKey|apiSecret|sealed|Connection verified/);
    expect(botDetail).toMatch(/BotRuntimeEvidencePanel/);
    expect(statistics).not.toMatch(/BotRuntimeEvidencePanel/);
    expect(botRuntimeEvidence).toMatch(/export function BotRuntimeEvidencePanel/);
    expect(botRuntimeEvidence).toMatch(/Runtime evidence ladder/);
    expect(botRuntimeEvidence).toMatch(/journal -> worker -> WTC DB snapshot -> scoped page data/);
    expect(botRuntimeEvidence).toMatch(/Tortila journal health is read by the WTC worker/);
    expect(botRuntimeEvidence).toMatch(/Legacy runtime is read by provider pub_id through the WTC worker/);
    expect(botRuntimeEvidence).toMatch(/metricsAvailable/);
    expect(botRuntimeEvidence).toMatch(/staleDataSeconds/);
    expect(botRuntimeEvidence).toMatch(/lastSyncAt/);
    expect(botLaunchReadinessPanel).not.toMatch(/getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|apiKey|apiSecret|sealed|Connection verified/);
    for (const source of [botReadiness, botReadinessMap, botSetupControlCenter, botOperationMap, botContinuity, botRuntimeEvidence, botReadinessLoader]) {
      expect(source).not.toMatch(/getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|apiKey|apiSecret|sealed|Connection verified/);
    }
  });

  it('cabinet consumes compact readiness rows only through entitlement-gated signals', () => {
    const cabinetLoader = read('apps/web/src/features/cabinet/loader.ts');
    const cabinetDerive = read('packages/cabinet/src/derive.ts');
    const cabinetCard = read('apps/web/src/features/cabinet/CabinetProductCard.tsx');
    expect(cabinetLoader).toMatch(/loadBotReadinessForUser/);
    expect(cabinetLoader).toMatch(/decision\.allowed \? await gatherSignals\(userId, code, decision\) : undefined/);
    expect(cabinetLoader).not.toMatch(/listExchangeKeys|loadBotConfig|buildBotReadinessItems/);
    expect(cabinetDerive).toMatch(/readinessItems\?: CabinetReadinessItem\[\]/);
    expect(cabinetDerive).toMatch(/input\.allowed \? \(input\.signals\?\.readinessItems \?\? \[\]\) : \[\]/);
    expect(cabinetCard).toMatch(/Readiness/);
    expect(cabinetCard).not.toMatch(/accessFor|getBotAdapter|listExchangeKeys|loadBotConfig|fetch\(|vault\.open|apiKey|apiSecret|Connection verified/);
  });

  it('safety route reads warnings through the safe wrapper', () => {
    expect(safety).toMatch(/loadBotReadModelForUser\(user\.id, meta\.code, \['warnings'\]\)/);
    expect(safety).toMatch(/read\.warnings\.issue/);
    expect(data).toMatch(/warnings: SafeBotRead<RiskWarning\[\]>/);
    expect(data).toMatch(/warningsFromDetail\(productCode, detail\)/);
    expect(warningsRegistry).toMatch(/warningCodesFromDetail/);
    expect(warningsRegistry).toMatch(/record\.warnings/);
    expect(warningsRegistry).toMatch(/record\.warningCodes/);
    expect(warningsRegistry).toMatch(/legacy_quarantined/);
    expect(warningsRegistry).toMatch(/LEGACY_RUNTIME_WARNINGS/);
  });

  it('user warning summary keeps unavailable and unscoped states distinct from none reported', () => {
    expect(data).toMatch(/export type BotWarningStatus = 'warnings_present' \| 'none_reported' \| 'unavailable' \| 'not_evaluated'/);
    expect(data).toMatch(/export type BotWarningScope =/);
    expect(data).toMatch(/'adapter_warning_read'/);
    expect(data).toMatch(/'provider_account_health'/);
    expect(data).toMatch(/'runtime_not_scoped'/);
    expect(data).toMatch(/singleMappedLegacyHealth/);
    expect(data).toMatch(/scopedLegacyRuntimeHealth/);
    expect(data).toMatch(/Warnings not requested/);
    expect(data).toMatch(/Warnings not scoped to this account/);
    expect(data).toMatch(/Warning snapshot unavailable/);
    expect(data).toMatch(/botWarningSummary\(health, warningRead, want\.has\('warnings'\), runtimeScope\)/);
    expect(data).toMatch(/botWarningSummary\(health, warnings, want\.has\('warnings'\), want\.has\('warnings'\) \? 'adapter_warning_read' : 'not_requested'\)/);
    expect(warningPanel).toMatch(/function scopeLabel/);
    expect(warningPanel).toMatch(/scope: \{scopeLabel\(summary\)\}/);
    expect(warningPanel).toMatch(/not permission for live control/);
  });

  it('bot list, dashboard, safety, and statistics render warning summaries without green all-clear copy', () => {
    expect(botsList).toMatch(/WarningSummaryInline/);
    expect(botDetail).toMatch(/WarningSummaryPanel/);
    expect(botDetail).toMatch(/loadBotReadModelForUser\(user\.id, meta\.code, \['metrics', 'positions', 'trades', 'config', 'warnings'\]\)/);
    expect(safety).toMatch(/WarningSummaryPanel/);
    expect(safety).toMatch(/warningSummary\.activeCount/);
    expect(safety).toMatch(/tone=\{active > 0 \? 'down' : undefined\}/);
    // The statistics page reads the LIVE journal (loadTortilaLiveOverview) instead of WTC DB snapshots,
    // and never fabricates a green all-clear or a $0 account.
    expect(statistics).toMatch(/loadTortilaLiveOverview/);
    for (const source of [botsList, botDetail, safety, statistics]) {
      expect(source).not.toMatch(/No active safety events|No adapter warnings|Connection verified/);
      expect(source).not.toMatch(/warningSummary\.status === 'none_reported' \? 'up'/);
    }
  });

  it('not_configured health skips UI data reads instead of probing unauthenticated endpoints', () => {
    expect(data).toMatch(/const canReadData = health\.readState !== 'not_configured'/);
    expect(data).toMatch(/want\.has\('metrics'\) && canReadData/);
    expect(data).toMatch(/want\.has\('trades'\) && canReadData/);
  });

  it('production Tortila read-only UI is DB-snapshot backed, not web adapter backed', () => {
    expect(data).toMatch(/function dbSnapshotMode\(productCode: BotProductCode\)/);
    expect(data).toMatch(/productCode === 'tortila_bot'/);
    expect(data).toMatch(/productCode === 'legacy_bot'/);
    expect(data).toMatch(/process\.env\.NODE_ENV === 'production'/);
    expect(data).toMatch(/loadDbBotReadModelForUser/);
    expect(data).toMatch(/integrationHealthChecks/);
    expect(data).toMatch(/botMetricSnapshots/);
    expect(data).toMatch(/botPositionSnapshots/);
    expect(data).toMatch(/botTradeImports/);
  });

  it('production user DB snapshots are scoped by user bot instance and Legacy provider mapping', () => {
    expect(data).toMatch(/where\(and\(eq\(schema\.botInstances\.userId, userId\), eq\(schema\.botInstances\.productCode, productCode\), isNull\(schema\.botInstances\.accountId\)\)\)/);
    expect(data).toMatch(/schema\.botProviderAccounts/);
    expect(data).toMatch(/providerMappingIssue/);
    expect(data).toMatch(/userScopedSnapshotRequired/);
    expect(data).toMatch(/User-scoped WTC DB snapshots are required in non-mock mode/);
    expect(data).toMatch(/this page will not fall back to a global adapter read/);
    expect(data).toMatch(/eq\(schema\.botProviderAccounts\.status, 'active'\)/);
    expect(data).toMatch(/botProviderAccountId/);
    expect(data).toMatch(/return loadAdapterBotReadModel\(productCode, parts\)/);
    expect(read('apps/web/src/features/bots/config-export-handler.ts')).toMatch(/provider_mapping_required/);
    expect(data).toMatch(/legacy_provider_mapping_required/);
    expect(read('apps/web/src/features/bots/runtime-config-sanitizer.ts')).toMatch(/mode: 'unknown'/);
  });

  it('admin bot health renders not_configured as setup-needed, not a generic error', () => {
    expect(adminQueries).toMatch(/loadAdminBotHealthFromDb/);
    expect(adminBotHealthLoader).toMatch(/tortilaJournalStatus/);
    expect(adminBotHealthLoader).toMatch(/tortilaJournalReadState/);
    expect(adminBotHealthLoader).toMatch(/tortilaFleetSnapshots/);
    expect(adminBotHealthLoader).toMatch(/eq\(schema\.botInstances\.productCode, 'tortila_bot'\)/);
    expect(adminBotHealthLoader).toMatch(/innerJoin\(schema\.users/);
    expect(adminBotHealthLoader).not.toMatch(/schema\.exchangeApiKeySecrets/);
    expect(adminBotHealthLoader).toMatch(/lastErr\.status === 'not_configured'/);
    expect(adminBotHealthLoader).toMatch(/projectHealthDetail\(lastErr\.detail\)/);
    expect(adminBotHealthLoader).toMatch(/detail: projectHealthDetail\(r\.detail\)/);
    expect(adminBotHealthLoader).toMatch(/botWarningSummaries/);
    expect(adminBotHealthLoader).toMatch(/warningsFromDetail/);
    expect(adminBotHealthLoader).toMatch(/ADMIN_WORKER_CONTINUITY_STALE_AFTER_SECONDS/);
    expect(adminBotHealthLoader).toMatch(/freshness: ageSeconds > ADMIN_WORKER_CONTINUITY_STALE_AFTER_SECONDS \? 'stale' : 'fresh'/);
    expect(adminHealthDetail).toMatch(/warningCodes/);
    expect(adminHealthDetail).toMatch(/warningCodesFromDetail\(redacted\)/);
    expect(adminHealthDetail).toMatch(/delete safe\.warningCodes/);
    expect(adminBots).toMatch(/journal: setup needed/);
    expect(adminBots).toMatch(/tortilaJournalReadStateDetail/);
    expect(adminBots).toMatch(/Canonical warning summary/);
    expect(adminBots).toMatch(/Bot owner drilldown/);
    expect(adminBots).toMatch(/Read-only owner explorer/);
    expect(adminBots).toMatch(/Admin fleet evidence ladder/);
    expect(adminBots).toMatch(/fleetEvidenceRows/);
    expect(adminBots).toMatch(/continuity\.freshness === 'stale'/);
    expect(adminBots).toMatch(/workerFreshnessSummary/);
    expect(adminBots).toMatch(/stale target='worker' row is treated as attention/);
    expect(adminEvidencePanel).toMatch(/AdminBotRuntimeEvidencePanel/);
    expect(adminEvidencePanel).toMatch(/Read-only admin evidence/);
    expect(adminEvidencePanel).toMatch(/Admin visibility is diagnostic only/);
    expect(adminBots).toMatch(/Tortila user-scoped snapshots/);
    expect(adminBots).toMatch(/bot instance owner/);
    expect(adminBots).toMatch(/Open read-only user view/);
    expect(adminBots).not.toMatch(/Open details/);
    expect(adminBots).toMatch(/\/admin\/users\/\$\{mappedUser\.userId\}\/bots#\$\{row\.detailAnchor\}/);
    expect(adminBots).toMatch(/detailAnchor: 'bot-tortila_bot'/);
  });

  it('admin bot health exposes a safe Legacy pub_id inspector from worker snapshots', () => {
    expect(adminQueries).toMatch(/loadAdminBotHealthFromDb/);
    expect(adminBotHealthLoader).toMatch(/legacyProviderAccounts/);
    expect(adminBotHealthLoader).toMatch(/legacyActiveSlots/);
    expect(adminBotHealthLoader).toMatch(/legacyActiveOrders/);
    expect(adminBotHealthLoader).toMatch(/botProviderAccounts/);
    expect(adminBotHealthLoader).toMatch(/innerJoin\(schema\.users/);
    expect(adminBotHealthLoader).toMatch(/mappedUser/);
    expect(adminBotHealthLoader).toMatch(/maskLegacyPubId/);
    expect(adminBots).toMatch(/Legacy pub_id inspector/);
    expect(adminBots).toMatch(/pub_id \$\{account\.pubId\}/);
    expect(adminBots).toMatch(/mapping required/);
    expect(adminBots).toMatch(/fleet diagnostics only/);
    expect(adminBots).toMatch(/Mapped user/);
    expect(adminBots).toMatch(/\/admin\/users\/\$\{mappedUser\.userId\}\/bots#\$\{row\.detailAnchor\}/);
    expect(adminBots).toMatch(/detailAnchor: 'bot-legacy_bot'/);
    expect(adminBots).toMatch(/Provider DB connection/);
    expect(adminBots).not.toMatch(/DB URL/);
    expect(adminBots).not.toMatch(/type="submit"/);
  });

  it('admin users page exposes a read-only bot owner selector without raw provider or live-control data', () => {
    const adminUsers = read('apps/web/src/app/admin/users/page.tsx');

    expect(adminUsers).toMatch(/Bot owner selector/);
    expect(adminUsers).toMatch(/loadAdminBotHealth/);
    expect(adminUsers).toMatch(/buildBotOwnerSelectorRows/);
    expect(adminUsers).toMatch(/email, name, user id, masked pub_id/);
    expect(adminUsers).toMatch(/Selected-user inspection only/);
    expect(adminUsers).toMatch(/Open read-only Tortila view/);
    expect(adminUsers).toMatch(/Open read-only Legacy view/);
    expect(adminUsers).toMatch(/Open fleet diagnostics/);
    expect(adminUsers).toMatch(/Global defaults/);
    expect(adminUsers).toMatch(/\/admin\/bots\/config/);
    expect(adminUsers).toMatch(/\/admin\/users\/\$\{snapshot\.ownerUser\.userId\}\/bots#bot-tortila_bot/);
    expect(adminUsers).toMatch(/\/admin\/users\/\$\{mapped\.userId\}\/bots#bot-legacy_bot/);
    expect(adminUsers).not.toMatch(/providerAccountId|rawJson|exchangeApiKeySecrets|apiSecret|apiKey|sealed|vault\.open/);
    expect(adminUsers).not.toMatch(/startBot|stopBot|applyConfig|test connection|Connection verified|type="submit" name="start"/);
  });

  it('admin read-only safety model does not expose disabled runtime controls as current UI', () => {
    const safetyModel = read('docs/BOT_CONTROL_SAFETY_MODEL.md');

    expect(safetyModel).toMatch(/admin and user bot evidence pages show no runtime/);
    expect(safetyModel).toMatch(/disabled control affordance/);
    expect(safetyModel).not.toMatch(/shows a read-only "Stop Bot" button/);
  });

  it('bot journal stays DB-only when Postgres is configured', () => {
    const dbLookup = journal.indexOf('const inst = await ensureBotInstance');
    const importsBranch = journal.indexOf('if (imports.length > 0)');
    const noImportsReturn = journal.indexOf("source: 'db_imports'", importsBranch);
    expect(dbLookup).toBeGreaterThan(0);
    expect(importsBranch).toBeGreaterThan(dbLookup);
    expect(noImportsReturn).toBeGreaterThan(importsBranch);
    expect(journal.indexOf("const read = await loadBotReadModel(productCode, ['trades']);", dbLookup)).toBe(-1);
  });
});

describe('bot config captures manual/auto intent without live control', () => {
  it('schema persists operationMode as manual|auto with a manual-safe default', () => {
    expect(config).toMatch(/z\.enum\(\['manual', 'auto'\]\)\.default\('manual'\)/);
    expect(config).toMatch(/BOT_OPERATION_MODES/);
    expect(config).toMatch(/operationMode: 'manual'/);
  });

  it('ships product-specific reference profiles and demo persistence for browser setup', () => {
    expect(config).toMatch(/BotConfigPreset/);
    expect(config).toMatch(/TORTILA_PRESETS/);
    expect(config).toMatch(/LEGACY_PRESETS/);
    expect(config).toMatch(/botConfigPresetsFor/);
    expect(config).toMatch(/botConfigPresetFor/);
    expect(config).toMatch(/__WTC_DEMO_BOT_CONFIGS__/);
  });

  it('config is product-specific for Tortila and Legacy', () => {
    expect(config).toMatch(/tortilaBotConfigSchema/);
    expect(config).toMatch(/legacyBotConfigSchema/);
    expect(config).toMatch(/tortilaSymbolConfigSchema/);
    expect(config).toMatch(/serializeTortilaSymbolConfigs/);
    expect(config).toMatch(/stopN/);
    expect(config).toMatch(/rsiLength/);
    expect(config).toMatch(/botConfigSchemaFor/);
    expect(config).toMatch(/botConfigFieldsFor/);
  });

  it('settings and setup parse and render operationMode with product strategy copy', () => {
    const actionHandler = read('apps/web/src/features/bots/config-action-handler.ts');
    for (const source of [settings, setup]) {
      expect(source).toMatch(/configFromForm: botConfigFormInput/);
      expect(source).toMatch(/formIssues: botConfigFormIssues/);
      expect(source).toMatch(/handleSaveBotConfigAction\(formData/);
      expect(source).toMatch(/name="operationMode"/);
    }
    expect(actionHandler).toMatch(/deps\.formIssues\(ctx\.productCode, formData\)/);
    expect(actionHandler).toMatch(/deps\.configFromForm\(ctx\.productCode, formData\)/);
    expect(settings).toMatch(/botConfigErrorCopy/);
    expect(settings).toMatch(/failed draft was not saved/);
    expect(settings).toMatch(/settings\?err=config/);
    expect(setup).toMatch(/setup\?step=strategy&err=config/);
    expect(config).toMatch(/export function botConfigFormIssues/);
    expect(config).toMatch(/duplicated/);
    expect(config).toMatch(/Custom draft/);
    expect(config).toMatch(/WTC automation intent/);
    expect(settings).toMatch(/Strategy mode/);
    expect(settings).toMatch(/applyBotPresetAction/);
    expect(settings).toMatch(/Reference profiles/);
    expect(setup).toMatch(/wizardApplyPreset/);
    expect(setup).toMatch(/Save as custom profile/);
  });

  it('Tortila settings/setup render a per-coin SYMBOL_CONFIGS editor', () => {
    const symbolTable = read('apps/web/src/features/bots/TortilaSymbolConfigTable.tsx');
    expect(symbolTable).toMatch(/Per-coin Tortila configuration/);
    expect(symbolTable).toMatch(/Manual symbol override/);
    expect(symbolTable).toMatch(/Turtle system/);
    expect(symbolTable).toMatch(/'use client'/);
    expect(symbolTable).toMatch(/Tortila strategy map/);
    expect(symbolTable).toMatch(/Draft map groups visible coin rows by Turtle system/);
    expect(symbolTable).toMatch(/Candidate labels show row number, symbol, timeframe, system, risk, stop, add step, max units, ATR, and TP before save/);
    expect(symbolTable).toMatch(/TortilaRowDraft/);
    expect(symbolTable).toMatch(/defaultRowDraft/);
    expect(symbolTable).toMatch(/rowDrafts/);
    expect(symbolTable).toMatch(/setRowDrafts/);
    expect(symbolTable).toMatch(/updateRowDraft/);
    expect(symbolTable).toMatch(/activeDraftRows/);
    expect(symbolTable).toMatch(/strategyMapRows/);
    expect(symbolTable).toMatch(/candidateLabel/);
    expect(symbolTable).toMatch(/Turtle bucket/);
    expect(symbolTable).toMatch(/Coin candidates/);
    expect(symbolTable).toMatch(/Risk shape/);
    expect(symbolTable).toMatch(/Position guardrails/);
    expect(symbolTable).toMatch(/no live exchange apply/);
    expect(symbolTable).toMatch(/Runtime export preview \(draft\)/);
    expect(symbolTable).toMatch(/Generated SYMBOL_CONFIGS \(draft\)/);
    expect(symbolTable).toMatch(/visible draft rows/);
    expect(symbolTable).toMatch(/Generated SYMBOL_CONFIGS/);
    expect(symbolTable).toMatch(/symbol@tf@system@risk@stop@add@max_units@atr@tp_rr/);
    expect(config).toMatch(/symbol_custom_/);
    // Settings uses the premium TortilaCoinConfigEditor (same save contract);
    // setup/admin keep the shared TortilaSymbolConfigTable.
    expect(settings).toMatch(/TortilaCoinConfigEditor/);
    expect(setup).toMatch(/TortilaSymbolConfigTable/);
    expect(config).toMatch(/symbolConfigs: z\.array/);
  });

  it('Tortila exchange connection UI does not claim a live exchange ping', () => {
    const setupAction = sourceForFunction(setup, 'wizardCheckExchangeKeyMetadata');
    const settingsAction = sourceForFunction(settings, 'checkExchangeKeyMetadataAction');
    const metadataRepo = sourceForFunction(dbRepositories, 'recordExchangeKeyMetadataCheck');
    expect(settings).toMatch(/Private exchange connection/);
    expect(settings).toMatch(/checkExchangeKeyMetadataAction/);
    expect(setup).toMatch(/wizardCheckExchangeKeyMetadata/);
    expect(exchangeKeyReadiness).toMatch(/Check WTC vault readiness/);
    expect(exchangeKeyReadiness).toMatch(/Run read-only exchange ping \(future\)/);
    expect(exchangeKeyReadiness).toMatch(/type="button"[\s\S]*disabled[\s\S]*Run read-only exchange ping \(future\)/);
    const futurePingButtonPrefixes = exchangeKeyReadiness
      .split('Run read-only exchange ping (future)')
      .slice(0, -1)
      .map((prefix) => prefix.slice(prefix.lastIndexOf('<button')));
    expect(futurePingButtonPrefixes.length).toBeGreaterThan(0);
    for (const prefix of futurePingButtonPrefixes) {
      expect(prefix).toMatch(/type="button"/);
      expect(prefix).toMatch(/disabled/);
      expect(prefix).not.toMatch(/type="submit"/);
    }
    expect(exchangeKeyReadiness).toMatch(/No live exchange ping is claimed/);
    expect(exchangeKeyReadiness).toMatch(/Exchange ping unavailable/);
    expect(exchangeKeyReadiness).toMatch(/WTC metadata/);
    expect(metadataRepo).toMatch(/exchange_key\.metadata_check/);
    expect(metadataRepo).not.toMatch(/action: 'exchange_key\.test'/);
    expect(metadataRepo).toMatch(/checkKind: 'sealed_metadata_only'/);
    expect(metadataRepo).toMatch(/livePing: false/);
    expect(metadataRepo).toMatch(/select\(\{ id: s\.exchangeApiKeySecrets\.id \}\)/);
    expect(metadataRepo).not.toMatch(/s\.exchangeApiKeySecrets\.sealed/);
    for (const action of [setupAction, settingsAction]) {
      expect(action).toMatch(/assertCsrf\(formData\)/);
      expect(action).toMatch(/exchangeKeyMetadataCheckSchema\.safeParse/);
      expect(action).toMatch(/botAccessForUser/);
      expect(action).toMatch(/recordExchangeKeyMetadataCheck/);
      expect(action).not.toMatch(/if \(!access\.allowed\) redirect\([\s\S]*keyCheck=missing/);
      expect(action).not.toMatch(/getBotAdapter|fetch\(|vault\.open|startBot|stopBot|applyConfig|retest|LEGACY_DATABASE_URL|TORTILA_JOURNAL_URL|apiKey|apiSecret|sealed/);
    }
    expect(setupAction).toMatch(/if \(!access\.allowed\) return;/);
    expect(settingsAction).toMatch(/if \(!access\.allowed\) return;/);
    expect(setup).not.toMatch(/Connection verified/);
    expect(settings).not.toMatch(/Connection verified/);
    expect(exchangeKeyReadiness).not.toMatch(/Connection verified/);
  });

  it('legacy setup uses the existing pub_id runtime instead of collecting WTC exchange keys', () => {
    expect(setup).toMatch(/Connected through existing Legacy pub_id/);
    expect(setup).toMatch(/Provider mapping pending - WTC reference only/);
    expect(setup).toMatch(/Exchange-key step is not used for Legacy/);
    expect(setup).toMatch(/provider pub_id/);
    expect(settings).toMatch(/Legacy provider accounts/);
    expect(settings).toMatch(/pubId/);
    expect(settings).not.toMatch(/Showing latest Legacy live snapshot/);
  });

  it('legacy settings enforce one visible trigger per coin and expose pub_id context', () => {
    const legacyTable = read('apps/web/src/features/bots/LegacyAveragingConfigTable.tsx');
    const botData = read('apps/web/src/features/bots/data.tsx');
    const persistableSchemaStart = config.indexOf('export const legacySymbolConfigSchema');
    const runtimeSchemaStart = config.indexOf('export const legacyRuntimeSymbolConfigSchema');
    expect(config).toMatch(/Choose exactly one signal: RSI or CCI/);
    expect(persistableSchemaStart).toBeGreaterThanOrEqual(0);
    expect(runtimeSchemaStart).toBeGreaterThan(persistableSchemaStart);
    expect(config.slice(persistableSchemaStart, runtimeSchemaStart)).not.toContain('providerPubId');
    expect(config.slice(runtimeSchemaStart, runtimeSchemaStart + 500)).toContain('providerPubId');
    expect(config).toMatch(/legacyRuntimeSymbolConfigsFromConfig/);
    expect(config).not.toMatch(/formData\.get\(`legacy_pub_id_/);
    expect(botData).toContain('buildSafeRuntimeConfigView');
    expect(botData).not.toContain('raw: liveConfig');
    expect(config).not.toMatch(/signal === 'both'/);
    expect(legacyTable).toMatch(/<option value="rsi">RSI<\/option>/);
    expect(legacyTable).toMatch(/<option value="cci">CCI<\/option>/);
    expect(legacyTable).not.toMatch(/RSI \+ CCI/);
    expect(legacyTable).not.toMatch(/legacy_pub_id_/);
    expect(legacyTable).toMatch(/Delay filter/);
    expect(legacyTable).toMatch(/Delta filter/);
    expect(legacyTable).toMatch(/Stage capacity/);
    expect(legacyTable).toMatch(/legacy_delay_on_/);
    expect(legacyTable).toMatch(/legacy_delta_on_/);
  });

  it('legacy source clarity never coerces zero provider mappings to one', () => {
    const legacyTable = read('apps/web/src/features/bots/LegacyAveragingConfigTable.tsx');
    expect(botDetail).not.toMatch(/legacyAccounts\.length \|\| 1/);
    expect(statistics).not.toMatch(/legacyAccounts\.length \|\| 1/);
    expect(legacyTable).not.toMatch(/providerCount \|\| 1/);
    // The "Configuration source" / "Resolved source" provenance cards were removed
    // from the decluttered premium settings shell (SETTINGS_SPEC). The zero-coercion
    // guard is what this test protects; the legacy empty-state still proves it.
    expect(settings).toMatch(/0 provider pub_id mapped/);
    expect(setup).toMatch(/Setup source/);
    expect(setup).toMatch(/Save custom settings first/);
  });
});
