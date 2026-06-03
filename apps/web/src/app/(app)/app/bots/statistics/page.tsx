import Link from 'next/link';
import { computeAdvancedAnalytics, filterZeroEquity, type CanonicalPosition, type CanonicalTrade, type EquityPoint } from '@wtc/analytics';
import { Card, EmptyState, MetricCard, MetricValue, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { requireUser } from '@/lib/session';
import { fmtDateTime, fmtMoney, fmtNum, fmtPf, fmtPct } from '@/lib/format';
import { BOT_CAPS, BOT_LIST, botHealthPill, type BotMeta } from '@/features/bots/meta';
import { loadBotReadModel, type BotReadIssue, type BotReadModel } from '@/features/bots/data';
import { BotJournalPanels, LegacyOperationsPanel } from '@/features/bots/statistics-panels';
import { legacyStageConfigsFromConfig, legacySymbolConfigsFromConfig, loadBotConfig } from '@/features/bots/config';

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

function compactDate(ms: number): string {
  return new Date(ms).toISOString().slice(5, 16).replace('T', ' ');
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
                  <td data-label="uPnL" className={!markUnavailable && p.unrealizedPnl < 0 ? 'wtc-down' : 'wtc-up'}>
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
        ? await loadBotReadModel(bot.code, ['metrics', 'positions', 'trades', 'equityCurve', 'warnings'])
        : null;
      return { ...bot, accessAllowed: access.allowed, accessReason: reasonLabel(access.reason), read };
    }),
  );
  const active = rows.find((r) => r.slug === selected) ?? rows[0]!;
  const activeRead = active.read;
  const healthPill = activeRead ? botHealthPill(activeRead.health) : { tone: 'bad' as Tone, label: 'locked' };
  const metrics = activeRead?.metrics.data ?? null;
  const positions = activeRead?.positions.data ?? [];
  const trades = activeRead?.trades.data ?? [];
  const equity = activeRead?.equityCurve.data ?? [];
  const caps = BOT_CAPS[active.code];
  const markUnavailable = active.code === 'tortila_bot' && activeRead?.adapterMode === 'real';
  const advanced = computeAdvancedAnalytics({ trades, positions, equityCurve: equity });
  const configState = active.accessAllowed ? await loadBotConfig(user.id, active.code) : null;
  const legacyRows = active.code === 'legacy_bot' ? legacySymbolConfigsFromConfig(configState?.current ?? null) : [];
  const legacyStages = active.code === 'legacy_bot' ? legacyStageConfigsFromConfig(configState?.current ?? null) : [];
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
          <MetricCard label="Entitled bots" value={fmtNum(rows.filter((r) => r.accessAllowed).length)} sub={`of ${rows.length}`} />
          <MetricCard label="Total wallet equity" value={fmtMoney(totalWalletEquity)} />
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
              detail="BOT_ADAPTER_MODE=mock: statistics below are illustrative sample data for preview. No exchange or bot account is connected."
            />
          )}

          {caps.liveAdapterBlocked && (
            <RiskWarningBanner
              severity="error"
              title="Live adapter unavailable - blocked (B3)"
              detail={caps.liveAdapterBlockedReason ?? 'This bot cannot use a live read-only adapter until its blocker clears.'}
            />
          )}

          {issueBanner(activeRead?.metrics.issue ?? activeRead?.positions.issue ?? activeRead?.trades.issue ?? activeRead?.equityCurve.issue ?? null)}

          {metrics ? (
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
          ) : (
            <Card title="Metrics unavailable">
              <EmptyState title="No bot metrics available" hint="The page stays up and shows adapter blockers instead of fabricating zeros." />
            </Card>
          )}

          <EquityPanel meta={active} points={equity} />

          <div className="wtc-grid wtc-grid-2">
            <PositionsTable positions={positions} markUnavailable={markUnavailable} />
            <TradesTable trades={trades} />
          </div>

          <BotJournalPanels
            meta={active}
            metrics={metrics}
            positions={positions}
            trades={trades}
            equity={equity}
            markUnavailable={markUnavailable}
          />

          {active.code === 'legacy_bot' && (
            <LegacyOperationsPanel rows={legacyRows} stages={legacyStages} />
          )}

          <Card title="Risk and status notes">
            {activeRead?.warnings.data && activeRead.warnings.data.length > 0 ? (
              activeRead.warnings.data.map((w) => (
                <RiskWarningBanner key={w.code} severity={w.severity} title={w.title} detail={w.detail} />
              ))
            ) : (
              <EmptyState title="No adapter warnings" />
            )}
            {caps.notes.length > 0 && (
              <ul className="wtc-dim" style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                {caps.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            )}
            <div className="wtc-row" style={{ marginTop: 16 }}>
              <Link href={`/app/bots/${active.slug}`} className={buttonClasses('secondary')}>Open bot room</Link>
              <Link href={`/app/bots/${active.slug}/settings`} className={buttonClasses('ghost')}>Configure</Link>
              {caps.hasBacktester && <Link href={`/app/bots/${active.slug}/backtester`} className={buttonClasses('ghost')}>Download backtester</Link>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
