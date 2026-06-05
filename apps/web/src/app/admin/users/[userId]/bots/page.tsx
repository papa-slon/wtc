import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, EmptyState, MetricCard, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { loadAdminUserBotDetail } from '@/features/admin/queries';
import { AdminBotRuntimeEvidencePanel, type AdminEvidenceMetric, type AdminEvidenceRow } from '@/features/admin/AdminBotRuntimeEvidencePanel';
import { fmtDateTime, fmtNum } from '@/lib/format';
import { BotOperationMapPanel } from '@/features/bots/BotOperationMapPanel';
import { BotLaunchReadinessPanel } from '@/features/bots/BotLaunchReadinessPanel';
import type { BotReadinessItem } from '@/features/bots/readiness';
import type { AdminUserBotSummary } from '@/features/admin/types';

function entitlementTone(status: string | null): Tone {
  if (status === 'active') return 'ok';
  if (status === 'grace' || status === 'pending_payment' || status === 'manual_review') return 'warn';
  if (status === null) return 'neutral';
  return 'bad';
}

function scopeLabel(bot: AdminUserBotSummary): string {
  if (bot.providerScope === 'user_scoped') return 'user scoped';
  if (bot.providerScope === 'provider_account_mapped') return 'provider account mapped';
  return 'provider account pending';
}

function configCapacityLabel(bot: AdminUserBotSummary): string {
  const summary = bot.configSummary;
  if (!summary) return '-';
  if (bot.productCode === 'legacy_bot') {
    return summary.stageCapacity !== null ? `${fmtNum(summary.stageCapacity)} slots` : '-';
  }
  return summary.riskSummary ?? '-';
}

function configSourceTone(bot: AdminUserBotSummary): Tone {
  const source = bot.configSummary?.source;
  if (source === 'user_override' || source === 'system_default') return 'ok';
  return 'warn';
}

function configSourceShort(bot: AdminUserBotSummary): string {
  const source = bot.configSummary?.source;
  if (source === 'user_override') return 'user custom';
  if (source === 'system_default') return 'system default';
  return 'built-in fallback';
}

function userSaveLabel(bot: AdminUserBotSummary): string {
  const version = bot.configSummary?.userVersion ?? bot.configVersion;
  return version ? `v${version}` : 'none';
}

function valueOrDash(value: string | null | undefined): string {
  return value ?? '-';
}

function positionMarkLabel(bot: AdminUserBotSummary, value: string | null | undefined): string {
  if (bot.productCode === 'tortila_bot') return 'N/A';
  return valueOrDash(value);
}

function positionUnrealizedPnlLabel(bot: AdminUserBotSummary, value: string | null | undefined): string {
  if (bot.productCode === 'tortila_bot') return 'N/A';
  return valueOrDash(value);
}

function positionUnrealizedPnlClass(bot: AdminUserBotSummary, value: string | null | undefined): string | undefined {
  if (bot.productCode === 'tortila_bot') return undefined;
  return pnlClass(value);
}

function metricUnrealizedPnlLabel(bot: AdminUserBotSummary): string {
  if (bot.productCode === 'tortila_bot') return 'N/A';
  return bot.latestMetric?.unrealizedPnlUsd ?? '-';
}

function legacyPendingMetric(bot: AdminUserBotSummary, value: string | number | null | undefined): string {
  if (bot.productCode !== 'legacy_bot') return value == null ? '-' : String(value);
  if (bot.trades.length > 0) return value == null ? 'not reported' : String(value);
  return 'pending import';
}

function sourceProofStatusLabel(bot: AdminUserBotSummary): string {
  const proof = bot.closedTradeSourceProof;
  if (bot.productCode !== 'legacy_bot') return 'not applicable';
  if (!proof) return 'proof snapshot not loaded';
  if (proof.status === 'blocked_no_source') return 'source proof blocked';
  if (proof.status === 'ready_for_mapper' && proof.canImportClosedTrades) return 'mapper-ready proof';
  return 'proof status unknown';
}

function sourceProofTone(bot: AdminUserBotSummary): Tone {
  const proof = bot.closedTradeSourceProof;
  if (bot.productCode !== 'legacy_bot' || !proof) return 'neutral';
  if (proof.status === 'ready_for_mapper' && proof.canImportClosedTrades) return 'ok';
  if (proof.status === 'blocked_no_source') return 'warn';
  return 'neutral';
}

function sourceProofMissingSummary(bot: AdminUserBotSummary): string {
  const proof = bot.closedTradeSourceProof;
  if (bot.productCode !== 'legacy_bot') return 'Tortila uses imported journal trades.';
  if (!proof) return 'No safe source-proof summary is available for this admin view.';
  if (proof.status === 'ready_for_mapper' && proof.canImportClosedTrades) {
    return 'Source contract is mapper-ready; importer replay still needs its own gate.';
  }
  const count = proof.blockerCount || proof.missingRequirements.length;
  return count > 0 ? `${fmtNum(count)} source-proof requirement${count === 1 ? '' : 's'} missing` : 'Closed-trade source proof is not ready.';
}

function sourceProofSourceLabel(bot: AdminUserBotSummary): string {
  const source = bot.closedTradeSourceProof?.source;
  if (source === 'scoped_worker_metric') return 'scoped worker metric';
  if (source === 'global_preflight') return 'global preflight';
  return 'source unknown';
}

function pnlClass(value: string | null | undefined): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return n < 0 ? 'wtc-down' : 'wtc-up';
}

function warningSummaryTone(bot: AdminUserBotSummary): Tone {
  if (bot.warningSummary.maxSeverity === 'error') return 'bad';
  if (bot.warningSummary.maxSeverity === 'warning') return 'warn';
  return 'neutral';
}

function warningScopeLabel(bot: AdminUserBotSummary): string {
  if (bot.warningSummary.scope === 'product_plus_runtime_health') return 'product + health';
  if (bot.warningSummary.scope === 'runtime_not_scoped') return 'runtime not scoped';
  return 'product-level';
}

function botAnchor(bot: AdminUserBotSummary): string {
  return `bot-${bot.productCode}`;
}

function botSlug(bot: AdminUserBotSummary): 'tortila' | 'legacy' {
  return bot.productCode === 'legacy_bot' ? 'legacy' : 'tortila';
}

function overviewRuntimeScope(bot: AdminUserBotSummary): string {
  const scope = bot.productCode === 'tortila_bot'
    ? 'user instance snapshots'
    : bot.providerAccount ? `Legacy pub_id ${bot.providerAccount.providerAccountId}` : 'Legacy pub_id pending';
  return `${scope} / ${runtimeHealthLabel(bot)}`;
}

function overviewWarningLabel(bot: AdminUserBotSummary): string {
  if (bot.warningSummary.count > 0) {
    return `${bot.warningSummary.count} notice${bot.warningSummary.count === 1 ? '' : 's'} - max ${bot.warningSummary.maxSeverity ?? 'info'}`;
  }
  return 'none reported - not an all-clear';
}

function overviewStatsLabel(bot: AdminUserBotSummary): string {
  const evidenceCount = bot.positions.length + bot.trades.length + bot.equityCurve.length;
  if (!bot.latestMetric && evidenceCount === 0) return 'no user-scoped snapshot';
  if (bot.productCode === 'legacy_bot') {
    const history = bot.trades.length > 0 ? `${fmtNum(bot.trades.length)} closed trades` : 'closed-trade history pending';
    return `${bot.latestMetric?.walletEquityUsd ?? '-'} wallet / ${fmtNum(bot.positions.length)} open positions / ${history}`;
  }
  return `${bot.latestMetric?.walletEquityUsd ?? '-'} wallet / ${fmtNum(bot.positions.length)} positions / ${fmtNum(bot.trades.length)} trades / ${fmtNum(bot.equityCurve.length)} equity points`;
}

function hasScopedStatisticsEvidence(bot: AdminUserBotSummary): boolean {
  return !!bot.latestMetric || bot.positions.length > 0 || bot.trades.length > 0 || bot.equityCurve.length > 0;
}

function runtimeScopeTone(bot: AdminUserBotSummary): Tone {
  if (!hasScopedStatisticsEvidence(bot)) return 'warn';
  if (bot.runtimeHealth.state === 'ok') return 'ok';
  if (bot.runtimeHealth.state === 'error') return 'bad';
  return 'warn';
}

function runtimeHealthLabel(bot: AdminUserBotSummary): string {
  const health = bot.runtimeHealth;
  const prefix = hasScopedStatisticsEvidence(bot) ? health.target : `fleet ${health.target}`;
  if (health.state === 'missing') return `${prefix}: missing`;
  return `${prefix}: ${health.readState ?? health.status ?? 'unknown'}`;
}

function statisticsTone(bot: AdminUserBotSummary): Tone {
  if (!hasScopedStatisticsEvidence(bot)) return 'neutral';
  if (bot.workerContinuity.state !== 'ok') return 'warn';
  if (bot.runtimeHealth.state === 'error') return 'bad';
  if (bot.runtimeHealth.state === 'attention' || bot.runtimeHealth.state === 'missing') return 'warn';
  return 'ok';
}

function statisticsStatusLabel(bot: AdminUserBotSummary): string {
  if (!hasScopedStatisticsEvidence(bot)) return 'pending';
  if (bot.workerContinuity.state !== 'ok') return 'user evidence present; aggregate worker pending';
  if (bot.productCode === 'legacy_bot' && bot.trades.length === 0) return 'operational evidence present';
  if (bot.runtimeHealth.state !== 'ok') return 'evidence stale or gated';
  return 'evidence present';
}

function botEvidenceCount(bot: AdminUserBotSummary): number {
  return (bot.latestMetric ? 1 : 0) + bot.positions.length + bot.trades.length + bot.equityCurve.length;
}

type AdminStatisticsCoverageRow = { layer: string; tone: Tone; state: string; evidence: string; next: string };

function tortilaJournalImportGate(bot: AdminUserBotSummary): AdminStatisticsCoverageRow {
  const hasJournalEvidence = bot.trades.length > 0 || bot.equityCurve.length > 0 || !!bot.latestMetric;
  return {
    layer: 'Journal import gate',
    tone: hasJournalEvidence ? 'ok' : 'warn',
    state: hasJournalEvidence ? 'journal evidence present' : 'journal evidence pending',
    evidence: hasJournalEvidence
      ? `Tortila analytics are sourced from persisted user-instance journal rows: ${fmtNum(bot.trades.length)} trades, ${fmtNum(bot.equityCurve.length)} equity points, runtime ${runtimeHealthLabel(bot)}. No /api/marks live call is made by this admin view.`
      : `No selected-user Tortila journal rows exist yet. Runtime ${runtimeHealthLabel(bot)} remains a health signal, not selected-user performance proof.`,
    next: hasJournalEvidence ? 'keep journal worker monitoring' : 'run read-only journal snapshot',
  };
}

function adminStatisticsCoverageRows(bot: AdminUserBotSummary): AdminStatisticsCoverageRow[] {
  const scopedEvidence = hasScopedStatisticsEvidence(bot);
  const workerOk = bot.workerContinuity.state === 'ok' && scopedEvidence;
  const runtimeOk = bot.runtimeHealth.state === 'ok' && scopedEvidence;
  const scoped = bot.productCode !== 'legacy_bot' || bot.statsSource.providerScoped;
  return [
    {
      layer: 'Aggregate worker precheck',
      tone: workerOk ? 'ok' : bot.workerContinuity.state === 'error' ? 'bad' : 'warn',
      state: bot.workerContinuity.checkedAt ? `${bot.workerContinuity.freshness} aggregate` : 'No aggregate worker row',
      evidence: scopedEvidence
        ? bot.workerContinuity.note
        : `${bot.workerContinuity.note} Aggregate worker health is fleet context until this selected user has scoped persisted rows.`,
      next: workerOk ? 'keep monitoring' : scopedEvidence ? 'run worker snapshot cycle' : 'wait for scoped snapshot',
    },
    {
      layer: 'Provider scope',
      tone: scoped ? 'ok' : 'warn',
      state: bot.productCode === 'legacy_bot' ? (scoped ? 'provider account mapped' : 'provider account pending') : 'user instance scoped',
      evidence: bot.productCode === 'legacy_bot'
        ? 'Legacy statistics are user-owned only when one active provider pub_id mapping scopes the snapshot rows.'
        : 'Tortila rows are scoped by bot instance owner.',
      next: scoped ? 'scope accepted' : 'map one active Legacy pub_id',
    },
    {
      layer: 'Operational coverage',
      tone: bot.positions.length > 0 || bot.latestMetric ? 'ok' : 'neutral',
      state: `${fmtNum(bot.positions.length)} open positions / ${bot.latestMetric ? 'wallet snapshot' : 'wallet pending'}`,
      evidence: 'Open exposure and wallet/balance evidence are persisted rows; this page does not call a live provider.',
      next: bot.positions.length > 0 || bot.latestMetric ? 'review runtime freshness' : 'wait for persisted snapshot',
    },
    ...(bot.productCode === 'tortila_bot' ? [tortilaJournalImportGate(bot)] : []),
    ...(bot.productCode === 'legacy_bot'
      ? [
          {
            layer: 'Source-proof gate',
            tone: sourceProofTone(bot),
            state: sourceProofStatusLabel(bot),
            evidence: `Legacy closed-trade source proof is evaluated before importer work from ${sourceProofSourceLabel(bot)}. ${sourceProofMissingSummary(bot)}.`,
            next: bot.closedTradeSourceProof?.canImportClosedTrades ? 'build audited mapper/importer' : 'provide source-proof artifact',
          },
        ]
      : []),
    {
      layer: 'Closed-trade history',
      tone: bot.trades.length > 0 ? 'ok' : bot.productCode === 'legacy_bot' ? 'warn' : 'neutral',
      state: bot.trades.length > 0 ? `${fmtNum(bot.trades.length)} imported trades` : 'pending import',
      evidence: bot.productCode === 'legacy_bot'
        ? 'Legacy PF, win rate, realized PnL, and attribution are not fabricated from active slots or orders.'
        : 'Performance analytics require immutable closed-trade imports.',
      next: bot.trades.length > 0 ? 'analytics available' : 'import closed trades',
    },
    {
      layer: 'Analytics status',
      tone: runtimeOk && workerOk && scopedEvidence ? 'ok' : runtimeOk && scopedEvidence ? 'warn' : 'neutral',
      state: statisticsStatusLabel(bot),
      evidence: overviewStatsLabel(bot),
      next: runtimeOk ? 'inspect bot card' : scopedEvidence ? runtimeHealthLabel(bot) : 'wait for scoped snapshot',
    },
  ];
}

function countWithStats(bots: readonly AdminUserBotSummary[]): number {
  return bots.filter(hasScopedStatisticsEvidence).length;
}

function runtimeAttentionCount(bots: readonly AdminUserBotSummary[]): number {
  return bots.filter((bot) => bot.runtimeHealth.state !== 'ok' || !hasScopedStatisticsEvidence(bot)).length;
}

function workerAttentionCount(bots: readonly AdminUserBotSummary[]): number {
  return bots.filter((bot) => bot.workerContinuity.state !== 'ok' || !hasScopedStatisticsEvidence(bot)).length;
}

function legacyMappingLabel(bots: readonly AdminUserBotSummary[]): string {
  const legacy = bots.find((bot) => bot.productCode === 'legacy_bot');
  if (!legacy) return 'Legacy bot absent';
  if (legacy.providerAccount?.status === 'active') return 'Legacy pub_id mapped';
  return 'Legacy pub_id pending';
}

function selectedUserCommandRows(bots: readonly AdminUserBotSummary[]): Array<{ layer: string; tone: Tone; state: string; evidence: string; boundary: string }> {
  const open = bots.filter((bot) => bot.accessOpen).length;
  const statsReady = countWithStats(bots);
  const attention = runtimeAttentionCount(bots);
  const workerAttention = workerAttentionCount(bots);
  return [
    {
      layer: 'User scope',
      tone: open > 0 ? 'ok' : 'warn',
      state: `${open}/${bots.length} access open`,
      evidence: 'Entitlement status decides what the user can see; admin inspection does not grant access.',
      boundary: 'user-owned view model',
    },
    {
      layer: 'Settings mirror',
      tone: bots.some((bot) => bot.configSummary?.source === 'user_override' || bot.configSummary?.source === 'system_default') ? 'ok' : 'warn',
      state: `${bots.filter((bot) => bot.configSummary).length}/${bots.length} safe summaries`,
      evidence: 'Resolved WTC settings source, symbol preview, risk/stage summary, and default-lock state are shown without edit controls.',
      boundary: 'read-only settings',
    },
    {
      layer: 'Statistics depth',
      tone: statsReady > 0 ? 'ok' : 'neutral',
      state: `${statsReady}/${bots.length} bots with evidence`,
      evidence: `${bots.reduce((sum, bot) => sum + botEvidenceCount(bot), 0)} persisted metric, position, trade, or equity rows across this user.`,
      boundary: 'scoped persisted rows',
    },
    {
      layer: 'Runtime attention',
      tone: attention > 0 ? 'warn' : 'ok',
      state: `${attention} bot${attention === 1 ? '' : 's'} need attention`,
      evidence: bots.map((bot) => `${bot.productName}: ${runtimeHealthLabel(bot)}`).join(' / '),
      boundary: 'no live probe on render',
    },
    {
      layer: 'Aggregate worker precheck',
      tone: workerAttention > 0 ? 'warn' : 'ok',
      state: `${workerAttention} bot${workerAttention === 1 ? '' : 's'} need attention`,
      evidence: bots.map((bot) => `${bot.productName}: ${bot.workerContinuity.freshness} aggregate / ${bot.workerContinuity.botContinuityStatus ?? bot.workerContinuity.status ?? 'unknown'}; not selected-user proof without scoped rows`).join(' / '),
      boundary: "target='worker' aggregate",
    },
    {
      layer: 'Legacy mapping',
      tone: legacyMappingLabel(bots).includes('mapped') ? 'ok' : 'warn',
      state: legacyMappingLabel(bots),
      evidence: 'Legacy provider facts become user-owned only through an active mapped pub_id.',
      boundary: 'provider mapping read-only',
    },
    {
      layer: 'Admin boundary',
      tone: 'bad',
      state: 'inspect only',
      evidence: 'No controls on this page edit user settings, provider mappings, exchange keys, live config, positions, or runtime state.',
      boundary: 'mutation absent',
    },
  ];
}

function userBotEvidenceMetrics(bot: AdminUserBotSummary): AdminEvidenceMetric[] {
  return [
    {
      label: 'Access',
      value: bot.entitlementStatus ?? 'not granted',
      sub: bot.entitlementPlanCode ?? 'no plan',
      tone: bot.accessOpen ? 'up' : undefined,
    },
    {
      label: 'Settings source',
      value: configSourceShort(bot),
      sub: bot.configSummary?.sourceLabel ?? 'no safe source',
      tone: bot.configSummary?.source === 'user_override' || bot.configSummary?.source === 'system_default' ? 'up' : undefined,
    },
    {
      label: 'Runtime health',
      value: bot.runtimeHealth.readState ?? bot.runtimeHealth.status ?? 'missing',
      sub: bot.runtimeHealth.checkedAt ? fmtDateTime(bot.runtimeHealth.checkedAt) : bot.runtimeHealth.target,
      tone: bot.runtimeHealth.state === 'ok' ? 'up' : bot.runtimeHealth.state === 'error' ? 'down' : undefined,
    },
    {
      label: 'Latest metric',
      value: bot.latestMetric ? fmtDateTime(bot.latestMetric.snapshotAt) : 'none',
      sub: bot.latestMetric?.sourceAdapter ?? 'worker snapshot pending',
      tone: bot.latestMetric ? 'up' : undefined,
    },
    {
      label: 'Warning notices',
      value: fmtNum(bot.warningSummary.count),
      sub: warningScopeLabel(bot),
      tone: bot.warningSummary.count > 0 ? 'down' : undefined,
    },
  ];
}

function userBotEvidenceRows(bot: AdminUserBotSummary): AdminEvidenceRow[] {
  return [
    {
      layer: 'Entitlement gate',
      status: entitlementTone(bot.entitlementStatus),
      statusLabel: bot.accessOpen ? 'access open' : 'not open',
      proof: bot.entitlementStatus ?? 'not granted',
      detail: 'User access remains entitlement-driven. Admin visibility does not grant the user product access.',
    },
    {
      layer: 'WTC settings source',
      status: configSourceTone(bot),
      statusLabel: configSourceShort(bot),
      proof: bot.configSummary?.sourceLabel ?? 'No safe WTC settings source',
      detail: bot.configSummary?.sourceDetail ?? 'No validated WTC settings summary is available for this bot.',
    },
    {
      layer: 'Runtime scope',
      status: runtimeScopeTone(bot),
      statusLabel: runtimeHealthLabel(bot),
      proof: scopeLabel(bot),
      detail: bot.runtimeHealth.note,
    },
    {
      layer: 'Aggregate worker precheck',
      status: adminWorkerHeartbeatReadinessStatus(bot) === 'ready' ? 'ok' : bot.workerContinuity.state === 'error' ? 'bad' : 'warn',
      statusLabel: bot.workerContinuity.checkedAt ? `${bot.workerContinuity.freshness} target='worker'` : 'No aggregate worker row',
      proof: bot.workerContinuity.botContinuityStatus ?? bot.workerContinuity.status ?? 'unknown',
      detail: `${bot.workerContinuity.note} This is a global target='worker' row, not selected-user proof; combine it with runtime scope and user-scoped statistics before calling this user ready.`,
    },
    {
      layer: 'User-scoped statistics',
      status: statisticsTone(bot),
      statusLabel: statisticsStatusLabel(bot),
      proof: overviewStatsLabel(bot),
      detail: 'Statistics come from persisted metric, position, trade, and equity rows already scoped by the admin loader; a metric row is not the only possible proof, and runtime health still gates whether that evidence is current.',
    },
    {
      layer: 'Admin boundary',
      status: 'neutral',
      statusLabel: 'inspect only',
      proof: 'view-only drilldown',
      detail: 'This selected-user page does not edit settings, provider mappings, exchange keys, live config, positions, or runtime state.',
    },
  ];
}

function adminRuntimeReadinessStatus(bot: AdminUserBotSummary): BotReadinessItem['status'] {
  if (!hasScopedStatisticsEvidence(bot)) return 'attention';
  if (bot.runtimeHealth.state === 'ok') return 'ready';
  if (bot.runtimeHealth.state === 'error') return 'blocked';
  return 'attention';
}

function adminWorkerHeartbeatReadinessStatus(bot: AdminUserBotSummary): BotReadinessItem['status'] {
  if (!hasScopedStatisticsEvidence(bot)) return 'attention';
  if (bot.workerContinuity.state === 'error') return 'blocked';
  if (bot.workerContinuity.state === 'ok') return 'ready';
  return 'attention';
}

function adminStatisticsReadinessStatus(bot: AdminUserBotSummary): BotReadinessItem['status'] {
  if (!hasScopedStatisticsEvidence(bot)) return 'attention';
  if (bot.workerContinuity.state === 'error') return 'blocked';
  if (bot.workerContinuity.state !== 'ok') return 'attention';
  if (bot.runtimeHealth.state === 'error') return 'blocked';
  if (bot.runtimeHealth.state === 'attention' || bot.runtimeHealth.state === 'missing') return 'attention';
  return 'ready';
}

function adminConnectionReadinessItem(bot: AdminUserBotSummary): BotReadinessItem {
  if (bot.productCode === 'legacy_bot') {
    const mapped = bot.providerAccount?.status === 'active';
    return {
      label: 'Provider pub_id',
      status: mapped ? 'ready' : 'attention',
      value: mapped ? 'Mapped provider account' : 'Provider mapping pending',
      detail: mapped
        ? 'Legacy runtime facts are attributed to this user through an active WTC provider-account mapping. The mapping is inspect-only here.'
        : 'Legacy runtime facts remain fleet diagnostics until exactly one active provider pub_id mapping is assigned to this user.',
      href: `#${botAnchor(bot)}-provider`,
      actionLabel: mapped ? 'Review mapping' : 'Review gap',
    };
  }

  return {
    label: 'Exchange key',
    status: bot.exchangeAccount ? 'ready' : 'attention',
    value: bot.exchangeAccount ? `${bot.exchangeAccount.exchange} metadata saved` : 'No key linked',
    detail: bot.exchangeAccount
      ? 'Admin sees redacted WTC exchange-account metadata only. Secret material is not loaded and no exchange ping is run.'
      : 'No exchange-account metadata is linked to this bot instance; the admin page does not run a connection test.',
    href: `#${botAnchor(bot)}-exchange`,
    actionLabel: bot.exchangeAccount ? 'Review metadata' : 'Review gap',
  };
}

function adminLaunchReadinessItems(bot: AdminUserBotSummary): BotReadinessItem[] {
  return [
    {
      label: 'Access',
      status: bot.accessOpen ? 'ready' : 'blocked',
      value: bot.entitlementStatus ?? 'not granted',
      detail: 'User access is still entitlement-driven. Admin inspection does not grant access or bypass billing state.',
    },
    adminConnectionReadinessItem(bot),
    {
      label: 'Settings source',
      status: bot.configSummary?.source === 'built_in' ? 'attention' : 'ready',
      value: bot.configSummary?.sourceLabel ?? 'No safe WTC settings source',
      detail: bot.configSummary?.sourceDetail ?? 'No validated WTC settings summary is available for this bot.',
      href: `#${botAnchor(bot)}-settings`,
      actionLabel: 'Review settings',
    },
    {
      label: 'Aggregate worker precheck',
      status: adminWorkerHeartbeatReadinessStatus(bot),
      value: bot.workerContinuity.checkedAt
        ? `${bot.workerContinuity.freshness} aggregate - ${fmtDateTime(bot.workerContinuity.checkedAt)}`
        : 'No aggregate worker row',
      detail: `${bot.workerContinuity.note} This is a global target='worker' row, not selected-user proof; selected-user readiness also requires scoped statistics evidence.`,
      href: `#${botAnchor(bot)}-runtime-evidence`,
      actionLabel: 'Review heartbeat',
    },
    {
      label: 'Runtime snapshot',
      status: adminRuntimeReadinessStatus(bot),
      value: runtimeHealthLabel(bot),
      detail: bot.runtimeHealth.note,
      href: `#${botAnchor(bot)}-runtime`,
      actionLabel: 'Review evidence',
    },
    {
      label: 'Statistics',
      status: adminStatisticsReadinessStatus(bot),
      value: statisticsStatusLabel(bot),
      detail: overviewStatsLabel(bot),
      href: `#${botAnchor(bot)}-statistics`,
      actionLabel: 'Review statistics',
    },
    {
      label: 'Warnings',
      status: bot.warningSummary.count > 0 ? 'attention' : 'readonly',
      value: overviewWarningLabel(bot),
      detail: bot.warningSummary.note,
      href: `#${botAnchor(bot)}-warnings`,
      actionLabel: 'Review warnings',
    },
    {
      label: 'Live control',
      status: 'readonly',
      value: 'Admin start/apply/stop disabled',
      detail: 'This page does not start, stop, apply config, run exchange/provider tests, edit user settings, or touch positions.',
    },
  ];
}

export default async function AdminUserBotDetailsPage({ params }: { params: Promise<{ userId: string }> }) {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const { userId } = await params;
  const detail = await loadAdminUserBotDetail(userId);

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin - users"
        title={detail.user ? `${detail.user.displayName} bot details` : 'User bot details'}
        copy="Read-only bot access, saved WTC configuration state, safe exchange-key metadata, and latest user-scoped snapshots. User-owned bot settings and provider mappings are view-only on this page."
      />

      <div className="wtc-row" style={{ marginTop: -4, flexWrap: 'wrap', gap: 8 }}>
        {detail.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
        )}
        <StatusPill tone="bad">LIVE CONTROL: DISABLED</StatusPill>
        <StatusPill tone="neutral">user settings: read-only</StatusPill>
        <StatusPill tone="neutral">provider mappings: read-only</StatusPill>
      </div>

      <RiskWarningBanner
        severity="info"
        title="Operational scope"
        detail={detail.legacyProviderScopeWarning}
      />

      {!detail.user ? (
        <Card title="User lookup">
          <EmptyState
            title={detail.mode === 'demo' ? 'No Postgres user directory' : 'User not found'}
            hint={detail.mode === 'demo' ? 'Connect DATABASE_URL to inspect real user bot state.' : 'Return to the user directory and choose an existing account.'}
          />
          <div style={{ marginTop: 12 }}>
            <Link href="/admin/users" className={buttonClasses('secondary')}>Back to users</Link>
          </div>
        </Card>
      ) : (
        <>
          <Card
            title="User"
            action={<Link href="/admin/users" className={buttonClasses('ghost')}>Back to users</Link>}
          >
            <div className="wtc-grid wtc-grid-4">
              <MetricCard label="Email" value={detail.user.email} />
              <MetricCard label="User ID" value={detail.user.id} />
              <MetricCard label="Roles" value={detail.user.roles.join(', ') || 'user'} />
              <MetricCard label="Registered" value={fmtDateTime(detail.user.createdAt)} />
              <MetricCard label="Exchange keys" value={detail.exchangeKeys.length} tone={detail.exchangeKeys.length > 0 ? 'up' : undefined} />
            </div>
          </Card>

          <Card title="Selected-user statistics command center">
            <div className="wtc-grid wtc-grid-4">
              <MetricCard label="Access open" value={`${detail.bots.filter((bot) => bot.accessOpen).length}/${detail.bots.length}`} />
              <MetricCard label="Scoped statistics" value={`${countWithStats(detail.bots)}/${detail.bots.length}`} sub="metric / position / trade / equity" />
              <MetricCard label="Runtime attention" value={runtimeAttentionCount(detail.bots)} />
              <MetricCard label="Worker attention" value={workerAttentionCount(detail.bots)} />
              <MetricCard label="Admin boundary" value="inspect only" sub="no user-setting mutation" />
            </div>
            <div className="wtc-table-wrap" style={{ marginTop: 12 }} aria-label="Selected-user statistics command center">
              <table className="wtc-table">
                <thead>
                  <tr><th>Layer</th><th>Status</th><th>Evidence</th><th>Boundary</th></tr>
                </thead>
                <tbody>
                  {selectedUserCommandRows(detail.bots).map((row) => (
                    <tr key={row.layer}>
                      <td data-label="Layer">{row.layer}</td>
                      <td data-label="Status"><StatusPill tone={row.tone}>{row.state}</StatusPill></td>
                      <td data-label="Evidence" className="wtc-dim">{row.evidence}</td>
                      <td data-label="Boundary">{row.boundary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Bot drilldown overview">
            <RiskWarningBanner
              severity="info"
              title="Selected-user read-only drilldown"
              detail="Inspect settings source, runtime scope, warnings, and latest stats for this user. This page does not edit user settings, provider mappings, exchange keys, live bot config, or open positions."
            />
            <div className="wtc-table-wrap" style={{ marginTop: 12 }}>
              <table className="wtc-table">
                <thead>
                  <tr><th>Bot</th><th>Access</th><th>Settings source</th><th>Runtime scope</th><th>Warnings</th><th>Latest stats</th><th>Drilldown</th></tr>
                </thead>
                <tbody>
                  {detail.bots.map((bot) => (
                    <tr key={bot.productCode}>
                      <td data-label="Bot">{bot.productName}</td>
                      <td data-label="Access">
                        <StatusPill tone={entitlementTone(bot.entitlementStatus)}>
                          {bot.entitlementStatus ?? 'not granted'}
                        </StatusPill>
                      </td>
                      <td data-label="Settings source">{bot.configSummary?.sourceLabel ?? 'No safe WTC settings source'}</td>
                      <td data-label="Runtime scope">{overviewRuntimeScope(bot)}</td>
                      <td data-label="Warnings">
                        <StatusPill tone={warningSummaryTone(bot)}>{overviewWarningLabel(bot)}</StatusPill>
                      </td>
                      <td data-label="Latest stats">{overviewStatsLabel(bot)}</td>
                      <td className="wtc-td-action" data-label="Drilldown">
                        <Link href={`#${botAnchor(bot)}`} className={buttonClasses('secondary')} style={{ padding: '5px 10px', fontSize: 12 }}>
                          Jump to bot card
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="wtc-grid">
            {detail.bots.map((bot) => (
              <div key={bot.productCode} id={botAnchor(bot)} style={{ scrollMarginTop: 90 }}>
                <Card title={bot.productName}>
                  <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    <StatusPill tone={entitlementTone(bot.entitlementStatus)}>
                      access: {bot.entitlementStatus ?? 'not granted'}
                    </StatusPill>
                    <StatusPill tone={configSourceTone(bot)}>
                      settings: {configSourceShort(bot)}
                    </StatusPill>
                    <StatusPill tone={bot.configSummary?.userVersion ? 'ok' : 'neutral'}>
                      user save: {userSaveLabel(bot)}
                    </StatusPill>
                    <StatusPill tone={bot.exchangeAccount ? 'ok' : 'warn'}>
                      key: {bot.exchangeAccount ? bot.exchangeAccount.mode : 'not linked'}
                    </StatusPill>
                    <StatusPill tone={bot.providerScope === 'user_scoped' || bot.providerScope === 'provider_account_mapped' ? 'ok' : 'warn'}>
                      {scopeLabel(bot)}
                    </StatusPill>
                    <StatusPill tone={runtimeScopeTone(bot)}>
                      runtime: {runtimeHealthLabel(bot)}
                    </StatusPill>
                    {bot.providerAccount && (
                      <StatusPill tone={bot.providerAccount.status === 'active' ? 'ok' : 'warn'}>
                        pub_id: {bot.providerAccount.status}
                      </StatusPill>
                    )}
                  </div>

                  <BotLaunchReadinessPanel
                    bot={botSlug(bot)}
                    botName={`${bot.productName} for ${detail.user?.displayName ?? 'selected user'}`}
                    items={adminLaunchReadinessItems(bot)}
                    title="Admin launch readiness mirror"
                    copy={`Admin can inspect ${bot.productName} readiness for ${detail.user?.displayName ?? 'selected user'}, but this page does not start, stop, apply config, test exchange/provider connectivity, edit user settings, or touch open positions.`}
                    settingsHref={`#${botAnchor(bot)}-settings`}
                    settingsLabel="Review settings"
                    statisticsHref={`#${botAnchor(bot)}-statistics`}
                    statisticsLabel="Review statistics"
                    connectionPillLabel="no live probe"
                    showDisabledControl={false}
                  />

                  <div id={`${botAnchor(bot)}-runtime-evidence`} style={{ scrollMarginTop: 90 }}>
                    <AdminBotRuntimeEvidencePanel
                      title="Selected-user evidence ladder"
                      copy="This ladder separates the user's entitlement, WTC settings source, runtime scope, persisted statistics, and the admin read-only boundary. It is inspection evidence, not permission to mutate the user's bot."
                      metrics={userBotEvidenceMetrics(bot)}
                      rows={userBotEvidenceRows(bot)}
                      framed={false}
                    />
                  </div>

                {bot.providerAccount ? (
                  <div id={`${botAnchor(bot)}-provider`} className="wtc-warning info" role="status" style={{ marginBottom: 12 }}>
                    <span aria-hidden style={{ fontWeight: 800 }}>i</span>
                    <div>
                      <div className="w-title">Provider account mapping</div>
                      <div className="w-detail">
                        {bot.providerAccount.label ?? bot.providerAccount.providerAccountId} - {bot.providerAccount.provider} -{' '}
                        <span className="wtc-mono">{bot.providerAccount.providerAccountId}</span>. This mapping is read-only here and only scopes facts already persisted in WTC.
                      </div>
                    </div>
                  </div>
                ) : bot.productCode === 'legacy_bot' ? (
                  <div id={`${botAnchor(bot)}-provider`} className="wtc-warning warning" role="status" style={{ marginBottom: 12 }}>
                    <span aria-hidden style={{ fontWeight: 800 }}>!</span>
                    <div>
                      <div className="w-title">Provider account not mapped</div>
                      <div className="w-detail">
                        Legacy pub_id rows remain fleet diagnostics until a separate audited provider-mapping workflow assigns an account to this user's Legacy bot instance.
                      </div>
                    </div>
                  </div>
                ) : null}

                <div id={`${botAnchor(bot)}-warnings`} className="wtc-warning info" role="status" style={{ marginBottom: 12 }}>
                  <span aria-hidden style={{ fontWeight: 800 }}>i</span>
                  <div>
                    <div className="w-title">Canonical warning summary</div>
                    <div className="w-detail">
                      <span className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <StatusPill tone={warningSummaryTone(bot)}>
                          {bot.warningSummary.count > 0
                            ? `${bot.warningSummary.count} notice${bot.warningSummary.count === 1 ? '' : 's'}`
                            : 'none reported'}
                        </StatusPill>
                        <StatusPill tone="neutral">{warningScopeLabel(bot)}</StatusPill>
                        <StatusPill tone="neutral">source: {bot.warningSummary.source}</StatusPill>
                        {bot.warningSummary.evaluatedAt ? (
                          <StatusPill tone="neutral">evaluated: {fmtDateTime(bot.warningSummary.evaluatedAt)}</StatusPill>
                        ) : null}
                      </span>
                      <span>{bot.warningSummary.note}</span>
                      {bot.warningSummary.warnings.length > 0 ? (
                        <span className="wtc-stack" style={{ gap: 8, marginTop: 8 }}>
                          {bot.warningSummary.warnings.map((warning) => (
                            <span key={warning.code}>
                              <span className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                                <StatusPill tone={warning.severity === 'error' ? 'bad' : warning.severity === 'warning' ? 'warn' : 'neutral'}>
                                  {warning.severity}
                                </StatusPill>
                                <strong>{warning.title}</strong>
                              </span>
                              <span className="wtc-dim" style={{ display: 'block', fontSize: 12, marginTop: 3 }}>
                                <code className="wtc-mono">{warning.code}</code> - {warning.detail}
                              </span>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="wtc-dim" style={{ display: 'block', fontSize: 12, marginTop: 8 }}>
                          No canonical warning codes in the evaluated summary. This does not change entitlement or live-control state.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="wtc-grid wtc-grid-4">
                  <MetricCard label="Plan" value={bot.entitlementPlanCode ?? '-'} />
                  <MetricCard label="Access open" value={bot.accessOpen ? 'yes' : 'no'} tone={bot.accessOpen ? 'up' : undefined} />
                  <MetricCard label="User config updated" value={fmtDateTime(bot.configSummary?.userUpdatedAt ?? bot.configUpdatedAt)} />
                  <MetricCard label="Entitlement updated" value={fmtDateTime(bot.entitlementUpdatedAt)} />
                </div>

                <div id={`${botAnchor(bot)}-settings`} className="wtc-warning info" role="status" style={{ marginTop: 12 }}>
                  <span aria-hidden style={{ fontWeight: 800 }}>i</span>
                  <div>
                    <div className="w-title">Resolved WTC settings</div>
                    <div className="w-detail">
                      {bot.configSummary
                        ? `${bot.configSummary.sourceLabel}. ${bot.configSummary.sourceDetail}`
                        : 'No safe WTC settings source is available for this bot.'}
                    </div>
                  </div>
                </div>

                {bot.configSummary ? (
                  <>
                    <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
                      <MetricCard label="Config source" value={bot.configSummary.sourceLabel} sub={configSourceShort(bot)} />
                      <MetricCard
                        label="User save"
                        value={bot.configSummary.userVersion ? `v${bot.configSummary.userVersion}` : 'none'}
                        sub={bot.configSummary.userConfigIgnoredByLock ? 'ignored by locked default' : fmtDateTime(bot.configSummary.userUpdatedAt)}
                      />
                      <MetricCard label="Resolved symbols" value={fmtNum(bot.configSummary.symbolCount)} sub={bot.configSummary.symbolPreview} />
                      <MetricCard label={bot.productCode === 'legacy_bot' ? 'Stage capacity' : 'Risk profile'} value={configCapacityLabel(bot)} />
                    </div>
                    {bot.configSummary.systemDefault ? (
                      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                        <StatusPill tone={bot.configSummary.systemDefault.allowUserOverride ? 'neutral' : 'warn'}>
                          default override: {bot.configSummary.systemDefault.allowUserOverride ? 'allowed' : 'locked'}
                        </StatusPill>
                        <StatusPill tone={bot.configSummary.resolvedFromUserSelection ? 'ok' : 'neutral'}>
                          user selected default: {bot.configSummary.resolvedFromUserSelection ? 'yes' : 'no'}
                        </StatusPill>
                        <StatusPill tone="neutral">
                          default profile: {bot.configSummary.systemDefault.profileCode}
                        </StatusPill>
                      </div>
                    ) : null}
                    <div className="wtc-table-wrap" style={{ marginTop: 12 }}>
                      <table className="wtc-table">
                        <thead>
                          <tr><th>Source</th><th>Symbols</th><th>Risk / signal</th><th>Resolved updated</th></tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td data-label="Source">{bot.configSummary.sourceLabel}</td>
                            <td data-label="Symbols">{bot.configSummary.symbols.length > 0 ? bot.configSummary.symbols.slice(0, 10).join(', ') : '-'}</td>
                            <td data-label="Risk / signal">{bot.configSummary.riskSummary ?? '-'}</td>
                            <td data-label="Resolved updated" className="wtc-mono" style={{ fontSize: 12 }}>{fmtDateTime(bot.configSummary.updatedAt)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="wtc-dim" style={{ fontSize: 12, marginTop: 8 }}>
                      {bot.configSummary.notes.join(' - ')}
                    </p>
                    <BotOperationMapPanel
                      productCode={bot.productCode}
                      sourceLabel={bot.configSummary.sourceLabel}
                      symbolSummary={`${fmtNum(bot.configSummary.symbolCount)} symbol${bot.configSummary.symbolCount === 1 ? '' : 's'} - ${bot.configSummary.symbolPreview}`}
                      signalSummary={bot.configSummary.riskSummary ?? (bot.productCode === 'legacy_bot' ? `${fmtNum(bot.configSummary.stageCount ?? 0)} stages` : 'Turtle reference profile')}
                      riskSummary={configCapacityLabel(bot)}
                      runtimeSummary={overviewRuntimeScope(bot)}
                      statisticsSummary={`${fmtNum(bot.positions.length)} positions / ${fmtNum(bot.trades.length)} trades / ${fmtNum(bot.equityCurve.length)} equity points`}
                      adminSummary="Selected-user inspection only; admins see settings source and scoped statistics, but this page does not edit user bot settings."
                      audience="admin"
                      framed={false}
                      title="Admin operation map"
                    />
                  </>
                ) : null}

                {bot.exchangeAccount ? (
                  <div id={`${botAnchor(bot)}-exchange`} className="wtc-warning info" role="status" style={{ marginTop: 12 }}>
                    <span aria-hidden style={{ fontWeight: 800 }}>i</span>
                    <div>
                      <div className="w-title">Exchange key metadata</div>
                      <div className="w-detail">
                        {bot.exchangeAccount.label} - {bot.exchangeAccount.exchange} - {bot.exchangeAccount.keyMask}. Secret material is not loaded by this admin page.
                      </div>
                    </div>
                  </div>
                ) : (
                  <p id={`${botAnchor(bot)}-exchange`} className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
                    No exchange account is linked to this bot instance yet.
                  </p>
                )}

                <div id={`${botAnchor(bot)}-statistics`} style={{ marginTop: 12 }}>
                  {bot.latestMetric ? (
                    <div className="wtc-grid wtc-grid-4">
                      <MetricCard label="Snapshot" value={fmtDateTime(bot.latestMetric.snapshotAt)} tone="up" />
                      <MetricCard label={bot.productCode === 'legacy_bot' ? 'Wallet snapshot' : 'Wallet equity'} value={bot.latestMetric.walletEquityUsd ?? '-'} />
                      <MetricCard
                        label={bot.productCode === 'legacy_bot' ? 'Closed-trade history' : 'Closed PnL'}
                        value={legacyPendingMetric(bot, bot.latestMetric.closedPnlUsd)}
                        sub={bot.productCode === 'legacy_bot' && bot.trades.length === 0 ? `${sourceProofStatusLabel(bot)} - realized PnL pending import` : undefined}
                      />
                      <MetricCard
                        label={bot.productCode === 'legacy_bot' ? 'Imported trades' : 'Trades'}
                        value={bot.productCode === 'legacy_bot' && bot.trades.length === 0 ? 'pending import' : fmtNum(bot.latestMetric.tradeCount)}
                      />
                      <MetricCard label="Unrealized PnL" value={metricUnrealizedPnlLabel(bot)} />
                      <MetricCard label="Win rate" value={legacyPendingMetric(bot, bot.latestMetric.winRate)} />
                      <MetricCard label="Profit factor" value={legacyPendingMetric(bot, bot.latestMetric.profitFactor)} />
                      <MetricCard label="Source" value={bot.latestMetric.sourceAdapter} />
                    </div>
                  ) : (
                    <EmptyState
                      title="No user-scoped metric snapshot"
                      hint="Run the worker snapshot cycle after adapters are configured; this page does not perform live probes during render."
                    />
                  )}
                  <div className="wtc-table-wrap" style={{ marginTop: 12 }} aria-label={`${bot.productName} statistics coverage matrix`}>
                    <table className="wtc-table">
                      <thead>
                        <tr><th>Coverage</th><th>Status</th><th>Evidence</th><th>Next proof</th></tr>
                      </thead>
                      <tbody>
                        {adminStatisticsCoverageRows(bot).map((row) => (
                          <tr key={row.layer}>
                            <td data-label="Coverage">{row.layer}</td>
                            <td data-label="Status"><StatusPill tone={row.tone}>{row.state}</StatusPill></td>
                            <td data-label="Evidence" className="wtc-dim">{row.evidence}</td>
                            <td data-label="Next proof">{row.next}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div id={`${botAnchor(bot)}-runtime`} className="wtc-grid wtc-grid-4" style={{ marginTop: 12 }}>
                  <MetricCard label="Open positions" value={fmtNum(bot.positions.length)} sub={fmtDateTime(bot.statsSource.latestPositionAt)} />
                  <MetricCard label="Recent trades" value={fmtNum(bot.trades.length)} sub={fmtDateTime(bot.statsSource.latestTradeAt)} />
                  <MetricCard label="Equity snapshots" value={fmtNum(bot.statsSource.equityPoints)} />
                  <MetricCard label="Stats scope" value={bot.statsSource.providerScoped ? 'provider account' : 'user instance'} />
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="wtc-row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <strong>Open positions</strong>
                    <span className="wtc-dim" style={{ fontSize: 12 }}>{fmtDateTime(bot.statsSource.latestPositionAt)}</span>
                  </div>
                  {bot.positions.length === 0 ? (
                    <EmptyState title="No open positions" hint="No persisted user-scoped position snapshot exists for this bot yet." />
                  ) : (
                    <div className="wtc-table-wrap">
                      <table className="wtc-table">
                        <thead>
                          <tr><th>Symbol</th><th>Side</th><th>Size</th><th>Entry</th><th>Mark</th><th>uPnL</th><th>Lev</th><th>SL / TP</th><th>Source</th></tr>
                        </thead>
                        <tbody>
                          {bot.positions.map((position, i) => (
                            <tr key={`${position.symbol}-${position.snapshotAt}-${i}`}>
                              <td data-label="Symbol">{position.symbol}</td>
                              <td data-label="Side">{position.side}</td>
                              <td data-label="Size">{position.size}</td>
                              <td data-label="Entry">{position.entryPrice}</td>
                              <td data-label="Mark">{positionMarkLabel(bot, position.markPrice)}</td>
                              <td data-label="uPnL" className={positionUnrealizedPnlClass(bot, position.unrealizedPnlUsd)}>{positionUnrealizedPnlLabel(bot, position.unrealizedPnlUsd)}</td>
                              <td data-label="Lev">{position.leverage !== null ? `${position.leverage}x` : '-'}</td>
                              <td data-label="SL / TP">{valueOrDash(position.slPrice)} / {valueOrDash(position.tpPrice)}</td>
                              <td data-label="Source">{position.sourceAdapter}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="wtc-row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <strong>Recent trades</strong>
                    <span className="wtc-dim" style={{ fontSize: 12 }}>{fmtDateTime(bot.statsSource.latestTradeAt)}</span>
                  </div>
                  {bot.trades.length === 0 ? (
                    <EmptyState title="No closed trades" hint="No persisted user-scoped trade imports exist for this bot yet." />
                  ) : (
                    <div className="wtc-table-wrap">
                      <table className="wtc-table">
                        <thead>
                          <tr><th>Symbol</th><th>Side</th><th>Size</th><th>Entry / exit</th><th>Realized</th><th>Fees</th><th>Funding</th><th>Reason</th><th>Closed</th><th>Source</th></tr>
                        </thead>
                        <tbody>
                          {bot.trades.map((trade) => (
                            <tr key={`${trade.sourceAdapter}-${trade.externalTradeId}`}>
                              <td data-label="Symbol">{trade.symbol}</td>
                              <td data-label="Side">{trade.side}</td>
                              <td data-label="Size">{trade.size}</td>
                              <td data-label="Entry / exit">{trade.entryPrice} / {trade.exitPrice}</td>
                              <td data-label="Realized" className={pnlClass(trade.realizedPnlUsd)}>{trade.realizedPnlUsd}</td>
                              <td data-label="Fees">{trade.feesUsd}</td>
                              <td data-label="Funding">{trade.fundingPaidUsd}</td>
                              <td data-label="Reason">{trade.exitReason ?? '-'}</td>
                              <td data-label="Closed" className="wtc-mono" style={{ fontSize: 12 }}>{fmtDateTime(trade.closedAt)}</td>
                              <td data-label="Source">{trade.sourceAdapter}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="wtc-row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    <strong>Equity snapshots</strong>
                    <span className="wtc-dim" style={{ fontSize: 12 }}>{fmtNum(bot.equityCurve.length)} points</span>
                  </div>
                  {bot.equityCurve.length === 0 ? (
                    <EmptyState title="No equity snapshots" hint="Wallet equity appears here after persisted metric snapshots include wallet equity." />
                  ) : (
                    <div className="wtc-table-wrap">
                      <table className="wtc-table">
                        <thead>
                          <tr><th>Snapshot</th><th>Wallet equity</th><th>Source</th></tr>
                        </thead>
                        <tbody>
                          {bot.equityCurve.slice(-12).reverse().map((point) => (
                            <tr key={`${point.sourceAdapter}-${point.t}`}>
                              <td data-label="Snapshot" className="wtc-mono" style={{ fontSize: 12 }}>{fmtDateTime(point.t)}</td>
                              <td data-label="Wallet equity">{point.equityUsd}</td>
                              <td data-label="Source">{point.sourceAdapter}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>

          <Card title="System provider mappings">
            <RiskWarningBanner
              severity="info"
              title="Read-only provider mapping evidence"
              detail="This page shows which provider pub_id is already mapped to the user's WTC Legacy bot instance. It does not create, disable, or edit mappings, saved settings, exchange keys, live bot config, start/stop state, or open positions."
            />

            {detail.providerAccounts.length === 0 ? (
              <EmptyState title="No provider accounts mapped" hint="Legacy pub_id rows stay on the fleet diagnostics page until a verified mapping exists." />
            ) : (
              <div className="wtc-table-wrap">
                <table className="wtc-table">
                  <thead>
                    <tr><th>Product</th><th>Provider</th><th>Account</th><th>Status</th><th>Updated</th></tr>
                  </thead>
                  <tbody>
                    {detail.providerAccounts.map((account) => (
                      <tr key={account.id}>
                        <td data-label="Product">{account.productCode}</td>
                        <td data-label="Provider">{account.provider}</td>
                        <td data-label="Account">
                          <span className="wtc-mono">{account.providerAccountId}</span>
                          {account.label ? <span className="wtc-dim"> - {account.label}</span> : null}
                        </td>
                        <td data-label="Status"><StatusPill tone={account.status === 'active' ? 'ok' : 'warn'}>{account.status}</StatusPill></td>
                        <td data-label="Updated" className="wtc-mono" style={{ fontSize: 12 }}>{fmtDateTime(account.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Saved exchange keys">
            {detail.exchangeKeys.length === 0 ? (
              <EmptyState title="No saved key metadata" hint="The user has not saved an exchange account in WTC yet." />
            ) : (
              <div className="wtc-table-wrap">
                <table className="wtc-table">
                  <thead>
                    <tr><th>Label</th><th>Exchange</th><th>Mode</th><th>Mask</th></tr>
                  </thead>
                  <tbody>
                    {detail.exchangeKeys.map((key) => (
                      <tr key={key.id}>
                        <td data-label="Label">{key.label}</td>
                        <td data-label="Exchange">{key.exchange}</td>
                        <td data-label="Mode"><StatusPill tone={key.mode === 'live' ? 'warn' : 'neutral'}>{key.mode}</StatusPill></td>
                        <td data-label="Mask" className="wtc-mono" style={{ fontSize: 12 }}>{key.keyMask}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="wtc-row">
            <Link href="/admin/bots" className={buttonClasses('secondary')}>Open fleet bot health</Link>
            <Link href="/admin/entitlements" className={buttonClasses('ghost')}>Open entitlements</Link>
          </div>
        </>
      )}
    </div>
  );
}
