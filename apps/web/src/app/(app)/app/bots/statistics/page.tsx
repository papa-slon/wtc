import Link from 'next/link';
import { computeAdvancedAnalytics, filterZeroEquity, type CanonicalPosition, type CanonicalTrade, type EquityPoint } from '@wtc/analytics';
import { Card, EmptyState, MetricCard, MetricValue, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { requireUser } from '@/lib/session';
import { fmtDateTime, fmtMoney, fmtNum, fmtPf, fmtPct } from '@/lib/format';
import { BOT_CAPS, BOT_LIST, botHealthPill, type BotMeta } from '@/features/bots/meta';
import { loadBotReadModelForUser, type BotReadIssue, type BotReadModel } from '@/features/bots/data';
import { BotOperationMapPanel } from '@/features/bots/BotOperationMapPanel';
import { BotContinuityPanel } from '@/features/bots/BotContinuityPanel';
import { BotRuntimeEvidencePanel } from '@/features/bots/BotRuntimeEvidencePanel';
import { WarningSummaryPanel } from '@/features/bots/WarningSummaryPanel';
import { BotJournalPanels, LegacyOperationsPanel } from '@/features/bots/statistics-panels';
import { BotStatisticsCommandCenter } from '@/features/bots/BotStatisticsCommandCenter';
import { loadBotReadinessForUser } from '@/features/bots/readiness-loader';
import type { BotRuntimeReadinessInput } from '@/features/bots/readiness';
import {
  legacySymbolConfigsFromConfig,
  loadBotConfig,
  legacyRuntimeStageSourceExists,
  legacyRuntimeSymbolSourceExists,
  legacyStageConfigsFromConfig,
  legacyRuntimeSymbolConfigsFromConfig,
  tortilaSymbolConfigsFromConfig,
} from '@/features/bots/config';
import { buildBotConfigReview } from '@/features/bots/config-review';

type BotStatsRow = BotMeta & {
  accessReason: string;
  accessAllowed: boolean;
  read: BotReadModel | null;
};

function selectedBotSlug(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return BOT_LIST.some((b) => b.slug === value) ? value! : BOT_LIST[0]!.slug;
}

function issueBanner(issue: BotReadIssue | null) {
  if (!issue) return null;
  return (
    <RiskWarningBanner
      severity={issue.kind === 'blocked' ? 'error' : 'warning'}
      title={issue.title}
      detail={issue.detail}
    />
  );
}

function pnlTone(value: number | null | undefined): 'up' | 'down' | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) return undefined;
  return value >= 0 ? 'up' : 'down';
}

function objectArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : [];
}

function providerPubIdSummary(count: number): string {
  return count === 1 ? '1 provider pub_id mapped' : `${count} provider pub_ids mapped`;
}

function partialMoney(value: number, contributors: number): string {
  return contributors > 0 ? fmtMoney(value) : 'N/A';
}

function compactDate(ms: number): string {
  return new Date(ms).toISOString().slice(5, 16).replace('T', ' ');
}

function freshnessText(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'age unknown';
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.round(minutes / 60)}h old`;
}

function workerHeartbeatStatus(runtime: BotRuntimeReadinessInput | null): { label: string; tone: Tone; detail: string } {
  if (!runtime || !runtime.workerCheckedAt) {
    return {
      label: 'No aggregate worker row',
      tone: 'warn',
      detail: "No aggregate target='worker' heartbeat is available for this render; the page stays read-only and cannot prove bot continuity.",
    };
  }

  const blocked =
    runtime.workerStatus === 'error' ||
    runtime.workerBotContinuityStatus === 'error' ||
    runtime.workerProductSnapshot === 'error' ||
    runtime.workerProductReadState === 'unreachable' ||
    runtime.workerProductReadState === 'malformed';
  const stale = (runtime.workerAgeSeconds ?? 0) > (runtime.workerStaleAfterSeconds ?? 3 * 60);
  const ready =
    !blocked &&
    !stale &&
    runtime.workerStatus === 'ok' &&
    runtime.workerBotContinuityStatus === 'ok' &&
    runtime.workerProductSnapshot === 'ok' &&
    runtime.workerProductReadState === 'ok';

  return {
    label: ready
      ? `Fresh aggregate - ${freshnessText(runtime.workerAgeSeconds)}`
      : `Aggregate needs review - ${freshnessText(runtime.workerAgeSeconds)}`,
    tone: blocked ? 'bad' : ready ? 'ok' : 'warn',
    detail: runtime.workerDetail
      ?? `Worker=${runtime.workerStatus ?? 'unknown'}, botContinuity=${runtime.workerBotContinuityStatus ?? 'unknown'}, productSnapshot=${runtime.workerProductSnapshot ?? 'unknown'}, productReadState=${runtime.workerProductReadState ?? 'unknown'}.`,
  };
}

function equityPath(points: EquityPoint[], width = 720, height = 210): string {
  if (points.length < 2) return '';
  const values = points.map((p) => p.equity).filter((n) => Number.isFinite(n));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return points
    .map((p, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * width;
      const y = height - ((p.equity - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function EquityPanel({ meta, points }: { meta: BotMeta; points: EquityPoint[] }) {
  const curve = filterZeroEquity(points);
  const path = equityPath(curve);
  const first = curve[0];
  const last = curve.at(-1);

  return (
    <Card title="Equity curve">
      {curve.length < 2 || !path ? (
        <EmptyState
          title="No equity curve available"
          hint={`${meta.name} does not expose enough equity history for a curve. The platform does not fabricate a chart.`}
        />
      ) : (
        <>
          <div
            style={{
              width: '100%',
              minHeight: 260,
              border: '1px solid var(--stroke)',
              borderRadius: 18,
              padding: 14,
              background:
                'linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)',
              backgroundSize: '100% 25%, 12.5% 100%',
              overflow: 'hidden',
            }}
          >
            <svg viewBox="0 0 720 210" role="img" aria-label={`${meta.name} equity curve`} style={{ width: '100%', height: 230 }}>
              <polyline points={path} fill="none" stroke="var(--cyan)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
          <div className="wtc-spread" style={{ marginTop: 10, gap: 12, flexWrap: 'wrap' }}>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Start {first ? `${compactDate(first.t)} / ${fmtMoney(first.equity)}` : 'N/A'}
            </span>
            <span className="wtc-dim" style={{ fontSize: 12 }}>
              Last {last ? `${compactDate(last.t)} / ${fmtMoney(last.equity)}` : 'N/A'}
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function PositionsTable({ positions, markUnavailable }: { positions: CanonicalPosition[]; markUnavailable: boolean }) {
  return (
    <Card title={`Open positions (${positions.length})`}>
      {positions.length === 0 ? (
        <EmptyState title="No open positions" />
      ) : (
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Entry</th>
                <th>Mark</th>
                <th>uPnL</th>
                <th>Margin</th>
                <th>Stop</th>
                <th>TP</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={`${p.symbol}-${i}`}>
                  <td data-label="Symbol">{p.symbol}</td>
                  <td data-label="Side">{p.side}</td>
                  <td data-label="Qty">{fmtNum(p.qty)}</td>
                  <td data-label="Entry">{fmtNum(p.entryPrice)}</td>
                  <td data-label="Mark">{markUnavailable ? 'N/A' : fmtNum(p.markPrice)}</td>
                  <td data-label="uPnL" className={markUnavailable ? undefined : p.unrealizedPnl < 0 ? 'wtc-down' : 'wtc-up'}>
                    {markUnavailable ? 'N/A' : fmtMoney(p.unrealizedPnl)}
                  </td>
                  <td data-label="Margin">{p.marginUsed != null ? fmtMoney(p.marginUsed) : '-'}</td>
                  <td data-label="Stop">{p.stopPrice != null ? fmtNum(p.stopPrice) : '-'}</td>
                  <td data-label="TP">{p.hasTp ? (p.tpPrice != null ? fmtNum(p.tpPrice) : 'set') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TradesTable({ trades }: { trades: CanonicalTrade[] }) {
  const closed = trades.filter((t) => t.closedAt !== null).slice(0, 12);
  return (
    <Card title="Recent closed trades">
      {closed.length === 0 ? (
        <EmptyState title="No closed trades" hint="Win rate and profit factor stay empty until real closed trades exist." />
      ) : (
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Side</th>
                <th>Qty</th>
                <th>Gross</th>
                <th>Fee</th>
                <th>Funding</th>
                <th>Net</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((t) => {
                const net = t.realizedPnl - t.fee + t.funding;
                return (
                  <tr key={t.id}>
                    <td data-label="Symbol">{t.symbol}</td>
                    <td data-label="Side">{t.side}</td>
                    <td data-label="Qty">{fmtNum(t.qty)}</td>
                    <td data-label="Gross" className={pnlTone(t.realizedPnl) === 'down' ? 'wtc-down' : 'wtc-up'}>{fmtMoney(t.realizedPnl)}</td>
                    <td data-label="Fee">{fmtMoney(t.fee)}</td>
                    <td data-label="Funding">{fmtMoney(t.funding)}</td>
                    <td data-label="Net" className={net < 0 ? 'wtc-down' : 'wtc-up'}>{fmtMoney(net)}</td>
                    <td data-label="Closed">{fmtDateTime(t.closedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default async function BotStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ bot?: string | string[] }>;
}) {
  const params = await searchParams;
  const selected = selectedBotSlug(params.bot);
  const user = await requireUser();
  const rows: BotStatsRow[] = await Promise.all(
    BOT_LIST.map(async (bot) => {
      const access = await botAccessForUser(user, bot.code);
      const read = access.allowed
        ? await loadBotReadModelForUser(user.id, bot.code, ['metrics', 'positions', 'trades', 'equityCurve', 'config', 'warnings'])
        : null;
      return { ...bot, accessAllowed: access.allowed, accessReason: reasonLabel(access.reason), read };
    }),
  );
  const active = rows.find((r) => r.slug === selected) ?? rows[0]!;
  const activeRead = active.read;
  const activeConfig = active.accessAllowed ? await loadBotConfig(user.id, active.code) : null;
  const activeReadiness = active.accessAllowed && activeRead
    ? await loadBotReadinessForUser(user, active.code, 'dashboard', { read: activeRead })
    : null;
  const workerHeartbeat = workerHeartbeatStatus(activeReadiness?.runtime ?? null);
  const healthPill = activeRead ? botHealthPill(activeRead.health) : { tone: 'bad' as Tone, label: 'locked' };
  const metrics = activeRead?.metrics.data ?? null;
  const positions = activeRead?.positions.data ?? [];
  const trades = activeRead?.trades.data ?? [];
  const equity = activeRead?.equityCurve.data ?? [];
  const scopedDataRows = (metrics ? 1 : 0) + positions.length + trades.length + equity.length + (activeRead?.config.data ? 1 : 0) + (activeRead?.warningSummary.count ?? 0);
  const caps = BOT_CAPS[active.code];
  const markUnavailable = activeRead?.markUnavailable ?? false;
  const advanced = computeAdvancedAnalytics({ trades, positions, equityCurve: equity });
  const legacyLiveConfig =
    active.code === 'legacy_bot' && activeRead?.config.data?.raw && typeof activeRead.config.data.raw === 'object'
      ? activeRead.config.data.raw as Record<string, unknown>
      : null;
  const legacyClosedTradeSourceProof =
    active.code === 'legacy_bot' ? activeRead?.closedTradeSourceProof ?? null : null;
  const hasLegacyRuntimeRows = active.code === 'legacy_bot' && legacyRuntimeSymbolSourceExists(legacyLiveConfig);
  const hasLegacyRuntimeStages = active.code === 'legacy_bot' && legacyRuntimeStageSourceExists(legacyLiveConfig);
  const legacyRows = hasLegacyRuntimeRows ? legacyRuntimeSymbolConfigsFromConfig(legacyLiveConfig) : [];
  const legacyStages = hasLegacyRuntimeStages ? legacyStageConfigsFromConfig(legacyLiveConfig) : [];
  const legacyAccounts = objectArray(legacyLiveConfig?.providerAccounts);
  const legacySlots = objectArray(legacyLiveConfig?.activeSlots);
  const legacyOrders = objectArray(legacyLiveConfig?.activeOrderSummary);
  const legacyRsiRows = legacyRows.filter((row) => row.useRsi && !row.useCci).length;
  const legacyCciRows = legacyRows.filter((row) => row.useCci && !row.useRsi).length;
  const legacyStageCapacity = legacyStages.reduce((sum, row) => sum + row.rsiSlots + row.cciSlots, 0);
  const operationReview = activeConfig
    ? buildBotConfigReview({
      productCode: active.code,
      sourceLabel: activeConfig.sourceLabel,
      config: activeConfig.current,
      tortilaRows: active.code === 'tortila_bot' ? tortilaSymbolConfigsFromConfig(activeConfig.current) : [],
      legacyRows: active.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(activeConfig.current) : [],
      legacyStages: active.code === 'legacy_bot' ? legacyStageConfigsFromConfig(activeConfig.current) : [],
      providerAccountCount: legacyAccounts.length,
    })
    : null;
  const walletContributors = rows.filter((row) => row.accessAllowed && row.read?.metrics.data).length;
  const entitledBots = rows.filter((r) => r.accessAllowed).length;
  const totalWalletEquity = rows.reduce((sum, row) => sum + (row.read?.metrics.data?.walletEquity ?? 0), 0);
  const totalOpenPositions = rows.reduce((sum, row) => sum + (row.read?.positions.data?.length ?? 0), 0);

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Bot statistics"
        title="Trading bot performance"
        copy="Pick a bot at the top. Portfolio totals are summed only where that is mathematically safe; win rate, PF, and strategy-specific stats stay per bot."
      />

      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {rows.map((bot) => {
          const isActive = bot.slug === active.slug;
          return (
            <Link
              key={bot.slug}
              href={`/app/bots/statistics?bot=${bot.slug}`}
              aria-current={isActive ? 'page' : undefined}
              className={buttonClasses(isActive ? 'secondary' : 'ghost')}
            >
              {bot.name}
            </Link>
          );
        })}
      </div>

      <Card title="Portfolio snapshot">
        <div className="wtc-grid wtc-grid-4">
          <MetricCard label="Entitled bots" value={fmtNum(entitledBots)} sub={`of ${rows.length}`} />
          <MetricCard label="Total wallet equity" value={partialMoney(totalWalletEquity, walletContributors)} sub={`${walletContributors}/${entitledBots} bots with metrics`} />
          <MetricCard label="Open positions" value={fmtNum(totalOpenPositions)} />
          <MetricCard label="Selected bot" value={active.name} sub={active.accessReason} />
        </div>
        <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
          Different strategies are not blended into one fake win rate. Switch bot above for bot-level PF, drawdown, trades, and equity.
        </p>
      </Card>

      <div className="wtc-spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div className="wtc-kicker">{active.tagline}</div>
          <h3 style={{ margin: '4px 0 0', fontSize: 22 }}>{active.name}</h3>
        </div>
        <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusPill tone={healthPill.tone}>{healthPill.label}</StatusPill>
          {activeRead && <StatusPill tone={activeRead.adapterMode === 'mock' ? 'warn' : 'neutral'}>{activeRead.adapterMode} data</StatusPill>}
        </div>
      </div>

      {!active.accessAllowed ? (
        <Card title="Access required">
          <EmptyState title={`${active.name} is locked`} hint="Activate or renew access in Billing to view this bot's statistics." />
          <div style={{ marginTop: 14 }}>
            <Link href="/app/billing" className={buttonClasses('primary')}>Go to billing</Link>
          </div>
        </Card>
      ) : (
        <>
          {activeRead?.adapterMode === 'mock' && (
            <RiskWarningBanner
              severity="warning"
              title="Simulated data - not a live account"
              detail="Statistics below are illustrative preview data. No exchange or bot account is connected for this view."
            />
          )}

          {caps.liveAdapterBlocked && (
            <RiskWarningBanner
              severity="error"
              title="Direct live control unavailable"
              detail={caps.liveAdapterBlockedReason ?? 'This bot is monitored through read-only worker snapshots. Direct runtime control is not available here.'}
            />
          )}

          {issueBanner(activeRead?.metrics.issue ?? activeRead?.positions.issue ?? activeRead?.trades.issue ?? activeRead?.equityCurve.issue ?? null)}

          {activeRead && (
            <BotContinuityPanel
              productCode={active.code}
              adapterMode={activeRead.adapterMode}
              health={activeRead.health}
              activeWarningCount={activeRead.warningSummary.activeCount}
              dataRows={scopedDataRows}
              dataRowsLabel="statistics evidence rows"
              dataRowsDetail="Metrics, positions, trades, equity samples, config, and warning rows count only after entitlement and bot ownership scope pass."
              configSourceLabel={activeConfig?.sourceLabel}
              connectionLabel={active.code === 'legacy_bot' ? providerPubIdSummary(legacyAccounts.length) : activeRead.adapterMode === 'mock' ? 'mock adapter preview' : 'exchange metadata not shown here'}
              title="Statistics continuity monitor"
            />
          )}

          {operationReview && activeConfig && (
            <BotOperationMapPanel
              productCode={active.code}
              sourceLabel={activeConfig.sourceLabel}
              configMetrics={operationReview.metrics}
              runtimeSummary={active.code === 'legacy_bot' ? providerPubIdSummary(legacyAccounts.length) : `${trades.length} trades / ${positions.length} open positions`}
              statisticsSummary={active.code === 'legacy_bot' ? `${legacySlots.length || positions.length} active slots / ${legacyOrders.length || 0} active orders` : 'equity curve, drawdown, PF, win rate, positions, trades, and journal diagnostics'}
              settingsHref={`/app/bots/${active.slug}/settings`}
              dashboardHref={`/app/bots/${active.slug}`}
              title="Statistics operation map"
            />
          )}

          {activeRead && (
            <BotRuntimeEvidencePanel
              productCode={active.code}
              adapterMode={activeRead.adapterMode}
              health={activeRead.health}
              metricsAvailable={!!metrics}
              positionsCount={positions.length}
              tradesCount={trades.length}
              equitySamples={equity.length}
              configSnapshotAvailable={!!activeRead.config.data}
              warningStatus={activeRead.warningSummary.status}
              warningCount={activeRead.warningSummary.count}
              title="Statistics evidence ladder"
            />
          )}

          {activeRead && (
            <BotStatisticsCommandCenter
              productCode={active.code}
              bot={active.slug}
              botName={active.name}
              adapterMode={activeRead.adapterMode}
              healthLabel={healthPill.label}
              healthTone={healthPill.tone}
              workerHeartbeatLabel={workerHeartbeat.label}
              workerHeartbeatTone={workerHeartbeat.tone}
              workerHeartbeatDetail={workerHeartbeat.detail}
              configSourceLabel={activeConfig?.sourceLabel ?? 'No WTC config source'}
              walletLabel={metrics ? fmtMoney(metrics.walletEquity) : 'N/A'}
              pnlLabel={active.code === 'legacy_bot' ? 'closed trade imports pending' : metrics ? fmtMoney(metrics.netPnlWithFees) : 'N/A'}
              pnlTone={active.code === 'legacy_bot' ? undefined : pnlTone(metrics?.netPnlWithFees)}
              winRateLabel={metrics ? fmtPct(metrics.winRatePct) : 'N/A'}
              profitFactorLabel={metrics ? fmtPf(metrics.profitFactor) : 'N/A'}
              drawdownLabel={active.code === 'legacy_bot' ? `${legacyStageCapacity} stage slots` : metrics ? fmtPct(metrics.maxDrawdownPct) : 'N/A'}
              openPositionsCount={positions.length}
              tradesCount={trades.length}
              equitySamples={equity.length}
              scopedDataRows={scopedDataRows}
              warningCount={activeRead.warningSummary.count}
              runtimeSummary={active.code === 'legacy_bot' ? providerPubIdSummary(legacyAccounts.length) : `${positions.length} positions / ${trades.length} trades from journal snapshots`}
              statisticsSummary={active.code === 'legacy_bot' ? `${legacySlots.length || positions.length} active slots / ${legacyOrders.length || 0} active orders` : `${equity.length} equity samples and ${trades.length} closed-trade rows`}
              settingsSummary={operationReview?.summary ?? 'Open settings to review the resolved WTC strategy profile.'}
            />
          )}

          {metrics ? (
            <>
              {active.code === 'legacy_bot' ? (
                <div className="wtc-grid wtc-grid-4">
                  <MetricCard label="Wallet balance snapshot" value={fmtMoney(metrics.walletEquity)} sub={providerPubIdSummary(legacyAccounts.length)} />
                  <MetricCard label="Configured symbols" value={legacyRows.length} sub={`${legacyRsiRows} RSI / ${legacyCciRows} CCI`} />
                  <MetricCard label="Active slots" value={legacySlots.length || positions.length} sub={`${legacyStageCapacity} stage capacity`} />
                  <MetricCard label="Active orders" value={legacyOrders.length || '-'} sub="BUY / averaging / TP coverage" />
                </div>
              ) : (
                <>
                  <div className="wtc-grid wtc-grid-4">
                    <MetricCard label="Wallet equity" value={fmtMoney(metrics.walletEquity)} />
                    <MetricCard label="Closed PnL" value={fmtMoney(metrics.closedPnl)} tone={pnlTone(metrics.closedPnl)} />
                    <MetricCard label="Net PnL after fees" value={fmtMoney(metrics.netPnlWithFees)} tone={pnlTone(metrics.netPnlWithFees)} />
                    <MetricCard label="Unrealized PnL" value={markUnavailable ? 'N/A' : fmtMoney(metrics.unrealizedPnl)} tone={markUnavailable ? undefined : pnlTone(metrics.unrealizedPnl)} />
                    <MetricCard label="Win rate" value={<MetricValue value={metrics.winRatePct} suffix="%" />} sub={`${metrics.winCount}/${metrics.tradeCount} trades`} />
                    <MetricCard label="Profit factor" value={fmtPf(metrics.profitFactor)} />
                    <MetricCard label="Max drawdown" value={<MetricValue value={metrics.maxDrawdownPct} suffix="%" />} tone="down" />
                    <MetricCard label="Current drawdown" value={fmtPct(metrics.currentDrawdownPct)} tone="down" />
                  </div>
                  <div className="wtc-grid wtc-grid-4">
                    <MetricCard label="ROI since start" value={fmtPct(metrics.roiPctSinceStart)} tone={pnlTone(metrics.roiPctSinceStart)} />
                    <MetricCard label="Expectancy" value={fmtMoney(metrics.expectancy)} tone={pnlTone(metrics.expectancy)} />
                    <MetricCard label="Sharpe" value={fmtNum(advanced.risk.sharpe)} />
                    <MetricCard label="Sortino" value={fmtNum(advanced.risk.sortino)} />
                    <MetricCard label="Calmar" value={fmtNum(advanced.risk.calmar)} />
                    <MetricCard label="Recovery" value={fmtNum(advanced.risk.recoveryFactor)} />
                    <MetricCard label="Trades/week" value={fmtNum(advanced.tradeQuality.tradesPerWeek)} />
                    <MetricCard label="Best / worst day" value={`${fmtMoney(advanced.tradeQuality.bestDayNet)} / ${fmtMoney(advanced.tradeQuality.worstDayNet)}`} />
                  </div>
                </>
              )}
            </>
          ) : (
            <Card title="Metrics unavailable">
              <EmptyState title="No bot metrics available" hint="The page stays up and shows adapter blockers instead of fabricating zeros." />
            </Card>
          )}

          {active.code !== 'legacy_bot' && <EquityPanel meta={active} points={equity} />}

          <div className="wtc-grid wtc-grid-2">
            <PositionsTable positions={positions} markUnavailable={markUnavailable} />
            <TradesTable trades={trades} />
          </div>

          {active.code !== 'legacy_bot' && (
            <BotJournalPanels
              meta={active}
              metrics={metrics}
              positions={positions}
              trades={trades}
              equity={equity}
              markUnavailable={markUnavailable}
            />
          )}

          {active.code === 'legacy_bot' && (
            <LegacyOperationsPanel
              rows={legacyRows}
              stages={legacyStages}
              liveConfig={legacyLiveConfig}
              closedTradeCount={trades.filter((trade) => trade.closedAt !== null).length}
              closedTradeSourceProof={legacyClosedTradeSourceProof}
            />
          )}

          {activeRead ? (
            <WarningSummaryPanel summary={activeRead.warningSummary} title="Risk and status notes" />
          ) : (
            <Card title="Risk and status notes">
              <EmptyState title="Warning state unavailable" hint="Activate bot access to evaluate warning state." />
            </Card>
          )}

          {(caps.notes.length > 0 || activeRead) && (
            <Card title="Bot room links and limitations">
            {caps.notes.length > 0 && (
              <ul className="wtc-dim" style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                {caps.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            )}
            <div className="wtc-row" style={{ marginTop: 16 }}>
              <Link href={`/app/bots/${active.slug}`} className={buttonClasses('secondary')}>Open bot room</Link>
              <Link href={`/app/bots/${active.slug}/settings`} className={buttonClasses('ghost')}>Configure</Link>
              {caps.hasBacktester && <Link href={`/app/bots/${active.slug}/backtester`} className={buttonClasses('ghost')}>Download backtester</Link>}
            </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
