import { Card, SectionHeader, StatusPill, MetricCard, MetricValue, RiskWarningBanner, EmptyState, type Tone } from '@wtc/ui';
import { fmtMoney, fmtNum, fmtPf, fmtDate } from '@/lib/format';
import { loadBot, BotAccessRequired, loadBotReadModelForUser } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';
import { BOT_CAPS } from '@/features/bots/meta';

export default async function Page({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const { meta, access, user } = await loadBot(bot);
  if (!access.allowed) return <BotAccessRequired meta={meta} section="Trades" />;

  const caps = BOT_CAPS[meta.code];
  const read = await loadBotReadModelForUser(user.id, meta.code, ['trades', 'metrics']);
  const trades = read.trades.data ?? [];
  const metrics = read.metrics.data;
  const closed = trades.filter((t) => t.closedAt !== null);
  const tone: Tone = read.health.status === 'healthy' ? 'ok' : read.health.status === 'down' ? 'bad' : 'warn';

  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker={`${meta.name} - Trades`} title="Closed trades" />
        <StatusPill tone={tone}>{read.health.status}</StatusPill>
      </div>
      <BotSubNav bot={bot} active="trades" />

      {read.adapterMode === 'mock' && (
        <RiskWarningBanner
          severity="warning"
          title="Simulated data - not a live account"
          detail="BOT_ADAPTER_MODE=mock: the trade history below is illustrative sample data."
        />
      )}
      {(read.trades.issue ?? read.metrics.issue) && (
        <RiskWarningBanner
          severity={(read.trades.issue ?? read.metrics.issue)!.kind === 'blocked' ? 'error' : 'warning'}
          title={(read.trades.issue ?? read.metrics.issue)!.title}
          detail={(read.trades.issue ?? read.metrics.issue)!.detail}
        />
      )}

      {metrics && (
        <div className="wtc-grid wtc-grid-4">
          <MetricCard label="Closed trades" value={fmtNum(metrics.tradeCount)} sub={`${metrics.winCount}W / ${metrics.lossCount}L`} />
          <MetricCard label="Win rate" value={<MetricValue value={metrics.winRatePct} suffix="%" />} />
          <MetricCard label="Profit factor" value={fmtPf(metrics.profitFactor)} />
          <MetricCard label="Net PnL (after fees)" value={fmtMoney(metrics.netPnlWithFees)} tone={metrics.netPnlWithFees >= 0 ? 'up' : 'down'} />
        </div>
      )}

      <Card title="Closed trade history">
        {!caps.hasTradeHistory ? (
          <EmptyState
            title="No closed-trade history available"
            hint={`${meta.name} exposes no closed-trade endpoint. Trade-level analytics are not fabricated; only wallet/position data is shown elsewhere.`}
          />
        ) : closed.length === 0 ? (
          <EmptyState title="No closed trades yet" hint="Win rate and profit factor show dashes until closed trades exist." />
        ) : (
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Symbol</th><th>Side</th><th>Qty</th><th>Gross</th><th>Fee</th><th>Funding</th><th>Net</th><th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((t) => {
                const net = t.realizedPnl - t.fee + t.funding;
                return (
                  <tr key={t.id}>
                    <td>{t.symbol}</td>
                    <td>{t.side}</td>
                    <td>{fmtNum(t.qty)}</td>
                    <td className={t.realizedPnl >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(t.realizedPnl)}</td>
                    <td>{fmtMoney(t.fee)}</td>
                    <td>{fmtMoney(t.funding)}</td>
                    <td className={net >= 0 ? 'wtc-up' : 'wtc-down'}>{fmtMoney(net)}</td>
                    <td>{fmtDate(t.closedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <p className="wtc-dim" style={{ fontSize: 12 }}>Net = gross realized PnL - fees + funding. Gross is shown separately so fees are never hidden.</p>
    </div>
  );
}
