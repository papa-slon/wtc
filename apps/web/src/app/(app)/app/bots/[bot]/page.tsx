import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import type { BotProductCode } from '@wtc/bot-adapters';
import { Card, SectionHeader, StatusPill, MetricCard, MetricValue, RiskWarningBanner, EmptyState, buttonClasses } from '@wtc/ui';
import { fmtMoney, fmtPf, fmtNum } from '@/lib/format';
import { BotSubNav } from '@/components/BotSubNav';
import { BotReadinessMap } from '@/features/bots/BotReadinessMap';
import { BotOperationMapPanel } from '@/features/bots/BotOperationMapPanel';
import { BotContinuityPanel } from '@/features/bots/BotContinuityPanel';
import { BotRuntimeEvidencePanel } from '@/features/bots/BotRuntimeEvidencePanel';
import { BotLaunchReadinessPanel } from '@/features/bots/BotLaunchReadinessPanel';
import { WarningSummaryPanel } from '@/features/bots/WarningSummaryPanel';
import { providerPubIdSummary } from '@/features/bots/readiness';
import { loadBotReadinessForUser } from '@/features/bots/readiness-loader';
import { BOT_CAPS, capLabel, botHealthPill } from '@/features/bots/meta';
import { loadBotReadModelForUser, type BotReadIssue } from '@/features/bots/data';
import { buildBotConfigReview } from '@/features/bots/config-review';
import { backtesterPill } from '@wtc/backtester';
import {
  BOT_OPERATION_MODES,
  legacyStageConfigsFromConfig,
  legacyRuntimeSymbolConfigsFromConfig,
  legacySymbolConfigsFromConfig,
  loadBotConfig,
  tortilaSymbolConfigsFromConfig,
} from '@/features/bots/config';

const MAP: Record<string, { code: BotProductCode; name: string }> = {
  tortila: { code: 'tortila_bot', name: 'Tortila Bot' },
  legacy: { code: 'legacy_bot', name: 'Legacy Bot' },
};

function ReadIssueBanner({ issue }: { issue: BotReadIssue | null }) {
  if (!issue) return null;
  return (
    <RiskWarningBanner
      severity={issue.kind === 'blocked' ? 'error' : 'warning'}
      title={issue.title}
      detail={issue.detail}
    />
  );
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
}

function modeLabel(value: unknown): string {
  const mode = BOT_OPERATION_MODES.find((m) => m.value === value);
  return mode?.label ?? BOT_OPERATION_MODES[0]!.label;
}

function ConfigSummary({
  productCode,
  runtimeConfig,
  referenceConfig,
  referenceLabel,
}: {
  productCode: BotProductCode;
  runtimeConfig: Record<string, unknown> | null;
  referenceConfig: Record<string, unknown> | null;
  referenceLabel: string;
}) {
  const source = runtimeConfig ?? referenceConfig ?? {};
  if (productCode === 'legacy_bot') {
    const rows = runtimeConfig ? legacyRuntimeSymbolConfigsFromConfig(runtimeConfig) : legacySymbolConfigsFromConfig(referenceConfig);
    const stages = legacyStageConfigsFromConfig(source);
    const providerAccounts = objectArray(runtimeConfig?.providerAccounts);
    const activeSlots = objectArray(runtimeConfig?.activeSlots);
    const activeOrders = objectArray(runtimeConfig?.activeOrderSummary);
    const rsiRows = rows.filter((row) => row.useRsi && !row.useCci).length;
    const cciRows = rows.filter((row) => row.useCci && !row.useRsi).length;
    const stageCapacity = stages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
    return (
      <div className="wtc-grid wtc-grid-3">
        <MetricCard label="Strategy mode" value={modeLabel(source.operationMode)} sub={runtimeConfig ? 'provider snapshot' : referenceLabel} />
        <MetricCard label="Provider pub_id" value={providerAccounts.length} sub={providerPubIdSummary(providerAccounts.length)} />
        <MetricCard label="Symbols" value={rows.length} sub={`${rsiRows} RSI / ${cciRows} CCI`} />
        <MetricCard label="Stage capacity" value={stageCapacity} sub={`${stages.length} stages`} />
        <MetricCard label="Active slots" value={activeSlots.length || '-'} sub="slot/order projection" />
        <MetricCard label="Active orders" value={activeOrders.length || '-'} sub="BUY / averaging / TP" />
      </div>
    );
  }
  const rows = tortilaSymbolConfigsFromConfig(source);
  return (
    <div className="wtc-grid wtc-grid-3">
      <MetricCard label="Strategy mode" value={modeLabel(source.operationMode)} sub={runtimeConfig ? 'runtime snapshot' : referenceLabel} />
      <MetricCard label="Symbols" value={rows.length} sub={rows.slice(0, 3).map((row) => row.symbol).join(', ')} />
      <MetricCard label="Timeframe" value={rows[0]?.timeframe ?? '-'} />
      <MetricCard label="Risk profile" value={rows[0] ? `${rows[0].riskPercent}%` : '-'} sub="per-trade reference" />
      <MetricCard label="System" value={rows[0] ? `System ${rows[0].system}` : '-'} />
      <MetricCard label="Max units" value={rows[0]?.maxUnits ?? '-'} />
    </div>
  );
}

export default async function BotDetailPage({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const meta = MAP[bot];
  if (!meta) notFound();
  const user = await requireUser();
  const access = await botAccessForUser(user, meta.code);

  if (!access.allowed) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker={meta.name} title="Access required" />
        <RiskWarningBanner severity="warning" title={`Access ${reasonLabel(access.reason)}`} detail="Your entitlement does not currently grant access to this bot. Visit billing to activate or renew." />
        <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
      </div>
    );
  }

  const caps = BOT_CAPS[meta.code];
  const backtester = backtesterPill(meta.code === 'tortila_bot' ? 'tortila' : 'legacy');
  const [read, wtcConfig] = await Promise.all([
    loadBotReadModelForUser(user.id, meta.code, ['metrics', 'positions', 'trades', 'config', 'warnings']),
    loadBotConfig(user.id, meta.code),
  ]);
  const readiness = await loadBotReadinessForUser(user, meta.code, 'dashboard', { read });
  const { health } = read;
  const healthPill = botHealthPill(health);
  const metrics = read.metrics.data;
  const positions = read.positions.data ?? [];
  const trades = read.trades.data ?? [];
  const config = read.config.data;
  const scopedDataRows = (metrics ? 1 : 0) + positions.length + trades.length + (config ? 1 : 0) + read.warningSummary.count;
  const markUnavailable = read.markUnavailable;
  const runtimeConfig = config?.raw && typeof config.raw === 'object' ? config.raw as Record<string, unknown> : null;
  const legacyConfig = meta.code === 'legacy_bot' ? runtimeConfig ?? wtcConfig.current : null;
  const legacyRows = meta.code === 'legacy_bot'
    ? runtimeConfig ? legacyRuntimeSymbolConfigsFromConfig(runtimeConfig) : legacySymbolConfigsFromConfig(wtcConfig.current)
    : [];
  const legacyStages = meta.code === 'legacy_bot' ? legacyStageConfigsFromConfig(legacyConfig) : [];
  const legacySlots = meta.code === 'legacy_bot' ? objectArray(runtimeConfig?.activeSlots) : [];
  const legacyOrders = meta.code === 'legacy_bot' ? objectArray(runtimeConfig?.activeOrderSummary) : [];
  const legacyAccounts = meta.code === 'legacy_bot' ? objectArray(runtimeConfig?.providerAccounts) : [];
  const legacyStageCapacity = legacyStages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
  const legacyRsiRows = legacyRows.filter((row) => row.useRsi && !row.useCci).length;
  const legacyCciRows = legacyRows.filter((row) => row.useCci && !row.useRsi).length;
  const operationLegacyRows = meta.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(wtcConfig.current) : [];
  const operationLegacyStages = meta.code === 'legacy_bot' ? legacyStageConfigsFromConfig(wtcConfig.current) : [];
  const operationTortilaRows = meta.code === 'tortila_bot' ? tortilaSymbolConfigsFromConfig(wtcConfig.current) : [];
  const operationReview = buildBotConfigReview({
    productCode: meta.code,
    sourceLabel: wtcConfig.sourceLabel,
    config: wtcConfig.current,
    tortilaRows: operationTortilaRows,
    legacyRows: operationLegacyRows,
    legacyStages: operationLegacyStages,
    providerAccountCount: legacyAccounts.length,
  });
  const readinessItems = readiness.items;

  return (
    <div className="wtc-stack">
      <div className="wtc-spread" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <SectionHeader kicker="Bot dashboard" title={meta.name} />
        <div className="wtc-row">
          <StatusPill tone={healthPill.tone}>{healthPill.label}</StatusPill>
          <StatusPill tone={read.adapterMode === 'mock' ? 'warn' : 'neutral'}>{read.adapterMode} data</StatusPill>
        </div>
      </div>

      <BotSubNav bot={bot} active="" />

      <BotReadinessMap
        items={readinessItems}
        copy="This is the operational map for the bot room: what is configured, what is only a read-only snapshot, and what is still deliberately disabled."
      />

      <BotLaunchReadinessPanel bot={bot} botName={meta.name} items={readinessItems} />

      <BotContinuityPanel
        productCode={meta.code}
        adapterMode={read.adapterMode}
        health={health}
        activeWarningCount={read.warningSummary.activeCount}
        dataRows={scopedDataRows}
        dataRowsLabel="dashboard evidence rows"
        dataRowsDetail="Metrics, positions, trades, config, and warning rows count only after entitlement and bot ownership scope pass."
        configSourceLabel={wtcConfig.sourceLabel}
        connectionLabel={meta.code === 'legacy_bot' ? providerPubIdSummary(legacyAccounts.length) : read.adapterMode === 'mock' ? 'mock adapter preview' : 'exchange metadata not shown here'}
      />

      <BotOperationMapPanel
        productCode={meta.code}
        sourceLabel={wtcConfig.sourceLabel}
        configMetrics={operationReview.metrics}
        runtimeSummary={meta.code === 'legacy_bot' ? providerPubIdSummary(legacyAccounts.length) : config ? 'runtime config snapshot available' : 'runtime config read unavailable'}
        statisticsSummary={meta.code === 'legacy_bot' ? `${legacySlots.length || positions.length} active slots / ${legacyOrders.length || 0} active orders` : `${trades.length} trades / ${positions.length} open positions`}
        settingsHref={`/app/bots/${bot}/settings`}
        statisticsHref={`/app/bots/statistics?bot=${bot}`}
      />

      <BotRuntimeEvidencePanel
        productCode={meta.code}
        adapterMode={read.adapterMode}
        health={health}
        metricsAvailable={!!metrics}
        positionsCount={positions.length}
        tradesCount={trades.length}
        configSnapshotAvailable={!!config}
        warningStatus={read.warningSummary.status}
        warningCount={read.warningSummary.count}
      />

      {health.readState && health.readState !== 'ok' && health.readStateDetail && (
        <RiskWarningBanner
          severity={health.readState === 'not_configured' || health.readState === 'stale' ? 'warning' : 'error'}
          title={`Journal read: ${healthPill.label}`}
          detail={health.readStateDetail}
        />
      )}

      <WarningSummaryPanel summary={read.warningSummary} title="Runtime status notes" />

      {caps.liveAdapterBlocked ? (
        <RiskWarningBanner
          severity="error"
          title="Direct live control unavailable"
          detail={caps.liveAdapterBlockedReason ?? 'This bot is monitored through read-only snapshots. Direct runtime control is not available on the dashboard.'}
        />
      ) : (
        read.adapterMode === 'mock' && (
          <RiskWarningBanner
            severity="warning"
            title="Simulated preview data"
            detail="The figures below are illustrative preview data from the mock adapter, not a real exchange or bot account."
          />
        )
      )}

      <ReadIssueBanner issue={read.metrics.issue ?? read.positions.issue ?? read.trades.issue} />

      {markUnavailable && (
        <RiskWarningBanner
          severity="info"
          title="Mark and uPnL unavailable"
          detail="Tortila real-mode positions come from persisted read-only journal snapshots. WTC does not call /api/marks or a live exchange to fill Mark and uPnL."
        />
      )}

      {metrics ? (
        meta.code === 'legacy_bot' ? (
          <div className="wtc-grid wtc-grid-4">
            <MetricCard label="Wallet balance snapshot" value={fmtMoney(metrics.walletEquity)} sub={providerPubIdSummary(legacyAccounts.length)} />
            <MetricCard label="Configured symbols" value={legacyRows.length} sub={`${legacyRsiRows} RSI / ${legacyCciRows} CCI`} />
            <MetricCard label="Active slots" value={legacySlots.length || positions.length} sub={`${legacyStageCapacity} stage capacity`} />
            <MetricCard label="Active orders" value={legacyOrders.length || '-'} sub="BUY / averaging / TP coverage" />
          </div>
        ) : (
          <div className="wtc-grid wtc-grid-4">
            <MetricCard label="Wallet equity" value={fmtMoney(metrics.walletEquity)} />
            <MetricCard label="Closed PnL" value={fmtMoney(metrics.closedPnl)} tone={metrics.closedPnl >= 0 ? 'up' : 'down'} />
            <MetricCard label="Unrealized PnL" value={markUnavailable ? 'N/A' : fmtMoney(metrics.unrealizedPnl)} tone={!markUnavailable && metrics.unrealizedPnl < 0 ? 'down' : undefined} />
            <MetricCard label="ROI on margin" value={<MetricValue value={metrics.roiOnMarginPct} suffix="%" />} />
            <MetricCard label="Win rate" value={<MetricValue value={metrics.winRatePct} suffix="%" />} sub={`${metrics.winCount}/${metrics.tradeCount} trades`} />
            <MetricCard label="Profit factor" value={fmtPf(metrics.profitFactor)} />
            <MetricCard label="Max drawdown" value={<MetricValue value={metrics.maxDrawdownPct} suffix="%" />} tone="down" />
            <MetricCard label="Open risk (margin)" value={fmtMoney(metrics.openRisk)} />
          </div>
        )
      ) : (
        <Card title="Metrics unavailable">
          <EmptyState title="No metrics available from this adapter" hint="The page stays up and shows the blocker instead of fabricating zeros or crashing." />
        </Card>
      )}

      <div className="wtc-grid wtc-grid-2">
        <Card title="Open positions">
          <ReadIssueBanner issue={read.positions.issue} />
          {positions.length === 0 ? (
            <EmptyState title="No open positions" />
          ) : (
            <div className="wtc-table-wrap">
              <table className="wtc-table">
                <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>uPnL</th></tr></thead>
                <tbody>
                  {positions.map((p, i) => (
                    <tr key={i}>
                      <td data-label="Symbol">{p.symbol}</td>
                      <td data-label="Side">{p.side}</td>
                      <td data-label="Qty">{fmtNum(p.qty)}</td>
                      <td data-label="Entry">{fmtNum(p.entryPrice)}</td>
                      <td data-label="Mark">{markUnavailable ? 'N/A' : fmtNum(p.markPrice)}</td>
                      <td data-label="uPnL" className={markUnavailable ? undefined : p.unrealizedPnl < 0 ? 'wtc-down' : 'wtc-up'}>{markUnavailable ? 'N/A' : fmtMoney(p.unrealizedPnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Recent trades">
          <ReadIssueBanner issue={read.trades.issue} />
          {trades.filter((t) => t.closedAt).length === 0 ? (
            <EmptyState title="No closed trades" hint="Win rate / profit factor show dashes until real closed trades exist." />
          ) : (
            <div className="wtc-table-wrap">
              <table className="wtc-table">
                <thead><tr><th>Symbol</th><th>Side</th><th>Realized</th><th>Fee</th></tr></thead>
                <tbody>
                  {trades.filter((t) => t.closedAt).slice(0, 8).map((t) => (
                    <tr key={t.id}>
                      <td data-label="Symbol">{t.symbol}</td>
                      <td data-label="Side">{t.side}</td>
                      <td data-label="Realized" className={t.realizedPnl >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(t.realizedPnl)}</td>
                      <td data-label="Fee">{fmtMoney(t.fee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Configuration & controls">
        <div className="wtc-grid wtc-grid-3" style={{ marginBottom: 16 }}>
          <MetricCard label="WTC mode" value={modeLabel(wtcConfig.current?.operationMode)} sub={wtcConfig.sourceLabel} />
          <MetricCard label="Config storage" value={wtcConfig.mode === 'postgres' ? 'Postgres' : 'Demo'} sub={wtcConfig.mode === 'postgres' ? 'versioned/audited' : 'in-memory preview'} />
          <MetricCard label="Live actions" value="Unavailable" sub="read-only monitoring" />
        </div>
        <div className="wtc-row" style={{ marginBottom: 16 }}>
          <Link href={`/app/bots/${bot}/settings`} className={buttonClasses('secondary')}>Configure bot</Link>
          <Link href={`/app/bots/${bot}/setup`} className={buttonClasses('ghost')}>Guided setup</Link>
        </div>
        {config ? (
          <ConfigSummary productCode={meta.code} runtimeConfig={runtimeConfig} referenceConfig={wtcConfig.current} referenceLabel={wtcConfig.sourceLabel} />
        ) : (
          <>
            <ReadIssueBanner issue={read.config.issue} />
            <EmptyState title="Runtime config read unavailable" hint="WTC settings remain available and versioned; live runtime config reads stay blocked until the adapter is verified." />
          </>
        )}
        <div className="wtc-row" style={{ marginTop: 16 }}>
          <button className={buttonClasses('ghost')} disabled title="Disabled: live control requires an audited adapter">Start bot (disabled)</button>
          <button className={buttonClasses('ghost')} disabled title="Disabled: 'stop' never closes positions; requires audited adapter">Stop bot (disabled)</button>
          {caps.hasBacktester && (
            <Link href={`/app/bots/${bot}/backtester`} className={buttonClasses('secondary')}>Backtester</Link>
          )}
        </div>
        <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
          This room is read-only monitoring. Start, stop, and live config apply are not available here.
        </p>
      </Card>

      <Card title="Capability summary">
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td data-label="Feature">Trade history endpoint</td>
                <td data-label="Status">
                  <StatusPill tone={caps.hasTradeHistory ? 'ok' : 'bad'}>
                    {caps.hasTradeHistory ? 'Available' : 'Not available - limited data'}
                  </StatusPill>
                </td>
              </tr>
              <tr>
                <td data-label="Feature">Equity curve endpoint</td>
                <td data-label="Status">
                  <StatusPill tone={caps.hasEquityCurve ? 'ok' : 'bad'}>
                    {caps.hasEquityCurve ? 'Available' : 'Not available - limited data'}
                  </StatusPill>
                </td>
              </tr>
              <tr>
                <td data-label="Feature">Backtester</td>
                <td data-label="Status">
                  <StatusPill tone={backtester.tone}>{backtester.label}</StatusPill>
                </td>
              </tr>
              <tr>
                <td data-label="Feature">Take-profit</td>
                <td data-label="Status"><StatusPill tone={caps.takeProfit === 'supported' ? 'ok' : caps.takeProfit === 'future' ? 'warn' : 'bad'}>{capLabel(caps.takeProfit)}</StatusPill></td>
              </tr>
              <tr>
                <td data-label="Feature">Stop-loss</td>
                <td data-label="Status"><StatusPill tone={caps.stopLoss === 'supported' ? 'ok' : caps.stopLoss === 'future' ? 'warn' : 'bad'}>{capLabel(caps.stopLoss)}</StatusPill></td>
              </tr>
            </tbody>
          </table>
        </div>
        {caps.notes.length > 0 && (
          <ul className="wtc-dim" style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            {caps.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        )}
      </Card>

      <p className="wtc-dim" style={{ fontSize: 12 }}>
        Read-only monitoring only. Start, stop, and live config apply are unavailable on this screen.
      </p>
    </div>
  );
}
