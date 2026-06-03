import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import type { BotProductCode } from '@wtc/bot-adapters';
import { Card, SectionHeader, StatusPill, MetricCard, MetricValue, RiskWarningBanner, EmptyState, buttonClasses } from '@wtc/ui';
import { fmtMoney, fmtPf, fmtNum } from '@/lib/format';
import { BotSubNav } from '@/components/BotSubNav';
import { BOT_CAPS, capLabel, botHealthPill } from '@/features/bots/meta';
import { loadBotReadModel, type BotReadIssue } from '@/features/bots/data';
import { backtesterPill } from '@wtc/backtester';
import {
  BOT_OPERATION_MODES,
  legacyStageConfigsFromConfig,
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
}: {
  productCode: BotProductCode;
  runtimeConfig: Record<string, unknown> | null;
  referenceConfig: Record<string, unknown> | null;
}) {
  const source = runtimeConfig ?? referenceConfig ?? {};
  if (productCode === 'legacy_bot') {
    const rows = legacySymbolConfigsFromConfig(source);
    const stages = legacyStageConfigsFromConfig(source);
    const providerAccounts = objectArray(runtimeConfig?.providerAccounts);
    const activeSlots = objectArray(runtimeConfig?.activeSlots);
    const activeOrders = objectArray(runtimeConfig?.activeOrderSummary);
    const rsiRows = rows.filter((row) => row.useRsi && !row.useCci).length;
    const cciRows = rows.filter((row) => row.useCci && !row.useRsi).length;
    const stageCapacity = stages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
    return (
      <div className="wtc-grid wtc-grid-3">
        <MetricCard label="Strategy mode" value={modeLabel(source.operationMode)} sub={runtimeConfig ? 'provider snapshot' : 'saved reference'} />
        <MetricCard label="Provider pub_id" value={providerAccounts.length || '-'} sub="safe account identity" />
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
      <MetricCard label="Strategy mode" value={modeLabel(source.operationMode)} sub={runtimeConfig ? 'runtime snapshot' : 'saved reference'} />
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
  const read = await loadBotReadModel(meta.code, ['metrics', 'positions', 'trades', 'config']);
  const wtcConfig = await loadBotConfig(user.id, meta.code);
  const { health } = read;
  const healthPill = botHealthPill(health);
  const metrics = read.metrics.data;
  const positions = read.positions.data ?? [];
  const trades = read.trades.data ?? [];
  const config = read.config.data;
  const markUnavailable = meta.code === 'tortila_bot' && read.adapterMode === 'real';
  const runtimeConfig = config?.raw && typeof config.raw === 'object' ? config.raw as Record<string, unknown> : null;
  const legacyConfig = meta.code === 'legacy_bot' ? runtimeConfig ?? wtcConfig.current : null;
  const legacyRows = meta.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(legacyConfig) : [];
  const legacyStages = meta.code === 'legacy_bot' ? legacyStageConfigsFromConfig(legacyConfig) : [];
  const legacySlots = meta.code === 'legacy_bot' ? objectArray(runtimeConfig?.activeSlots) : [];
  const legacyOrders = meta.code === 'legacy_bot' ? objectArray(runtimeConfig?.activeOrderSummary) : [];
  const legacyAccounts = meta.code === 'legacy_bot' ? objectArray(runtimeConfig?.providerAccounts) : [];
  const legacyStageCapacity = legacyStages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
  const legacyRsiRows = legacyRows.filter((row) => row.useRsi && !row.useCci).length;
  const legacyCciRows = legacyRows.filter((row) => row.useCci && !row.useRsi).length;

  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker="Bot dashboard" title={meta.name} />
        <div className="wtc-row">
          <StatusPill tone={healthPill.tone}>{healthPill.label}</StatusPill>
          <StatusPill tone={read.adapterMode === 'mock' ? 'warn' : 'neutral'}>{read.adapterMode} data</StatusPill>
        </div>
      </div>

      <BotSubNav bot={bot} active="" />

      {health.readState && health.readState !== 'ok' && health.readStateDetail && (
        <RiskWarningBanner
          severity={health.readState === 'not_configured' || health.readState === 'stale' ? 'warning' : 'error'}
          title={`Journal read: ${healthPill.label}`}
          detail={health.readStateDetail}
        />
      )}

      {health.warnings.length > 0 && (
        <Card title="Runtime status notes">
          {health.warnings.map((w) => (
            <RiskWarningBanner key={w.code} severity={w.severity} title={w.title} detail={w.detail} />
          ))}
        </Card>
      )}

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

      {metrics ? (
        meta.code === 'legacy_bot' ? (
          <div className="wtc-grid wtc-grid-4">
            <MetricCard label="Wallet balance snapshot" value={fmtMoney(metrics.walletEquity)} sub={`${legacyAccounts.length || 1} provider pub_id`} />
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
            <table className="wtc-table">
              <thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>uPnL</th></tr></thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr key={i}>
                    <td>{p.symbol}</td><td>{p.side}</td><td>{fmtNum(p.qty)}</td><td>{fmtNum(p.entryPrice)}</td><td>{markUnavailable ? 'N/A' : fmtNum(p.markPrice)}</td>
                    <td className={!markUnavailable && p.unrealizedPnl < 0 ? 'wtc-down' : 'wtc-up'}>{markUnavailable ? 'N/A' : fmtMoney(p.unrealizedPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Recent trades">
          <ReadIssueBanner issue={read.trades.issue} />
          {trades.filter((t) => t.closedAt).length === 0 ? (
            <EmptyState title="No closed trades" hint="Win rate / profit factor show dashes until real closed trades exist." />
          ) : (
            <table className="wtc-table">
              <thead><tr><th>Symbol</th><th>Side</th><th>Realized</th><th>Fee</th></tr></thead>
              <tbody>
                {trades.filter((t) => t.closedAt).slice(0, 8).map((t) => (
                  <tr key={t.id}>
                    <td>{t.symbol}</td><td>{t.side}</td>
                    <td className={t.realizedPnl >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(t.realizedPnl)}</td>
                    <td>{fmtMoney(t.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Configuration & controls">
        <div className="wtc-grid wtc-grid-3" style={{ marginBottom: 16 }}>
          <MetricCard label="WTC mode" value={modeLabel(wtcConfig.current?.operationMode)} sub={wtcConfig.version != null ? `reference v${wtcConfig.version}` : 'not saved yet'} />
          <MetricCard label="Config storage" value={wtcConfig.mode === 'postgres' ? 'Postgres' : 'Demo'} sub={wtcConfig.mode === 'postgres' ? 'versioned/audited' : 'in-memory preview'} />
          <MetricCard label="Live actions" value="Unavailable" sub="read-only monitoring" />
        </div>
        <div className="wtc-row" style={{ marginBottom: 16 }}>
          <Link href={`/app/bots/${bot}/settings`} className={buttonClasses('secondary')}>Configure bot</Link>
          <Link href={`/app/bots/${bot}/setup`} className={buttonClasses('ghost')}>Guided setup</Link>
        </div>
        {config ? (
          <ConfigSummary productCode={meta.code} runtimeConfig={runtimeConfig} referenceConfig={wtcConfig.current} />
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
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Trade history endpoint</td>
              <td>
                <StatusPill tone={caps.hasTradeHistory ? 'ok' : 'bad'}>
                  {caps.hasTradeHistory ? 'Available' : 'Not available - limited data'}
                </StatusPill>
              </td>
            </tr>
            <tr>
              <td>Equity curve endpoint</td>
              <td>
                <StatusPill tone={caps.hasEquityCurve ? 'ok' : 'bad'}>
                  {caps.hasEquityCurve ? 'Available' : 'Not available - limited data'}
                </StatusPill>
              </td>
            </tr>
            <tr>
              <td>Backtester</td>
              <td>
                <StatusPill tone={backtester.tone}>{backtester.label}</StatusPill>
              </td>
            </tr>
            <tr>
              <td>Take-profit</td>
              <td><StatusPill tone={caps.takeProfit === 'supported' ? 'ok' : caps.takeProfit === 'future' ? 'warn' : 'bad'}>{capLabel(caps.takeProfit)}</StatusPill></td>
            </tr>
            <tr>
              <td>Stop-loss</td>
              <td><StatusPill tone={caps.stopLoss === 'supported' ? 'ok' : caps.stopLoss === 'future' ? 'warn' : 'bad'}>{capLabel(caps.stopLoss)}</StatusPill></td>
            </tr>
          </tbody>
        </table>
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
