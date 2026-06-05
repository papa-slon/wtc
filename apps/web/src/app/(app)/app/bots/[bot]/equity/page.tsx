import { filterZeroEquity } from '@wtc/analytics';
import { Card, SectionHeader, StatusPill, MetricCard, MetricValue, RiskWarningBanner, EmptyState, type Tone } from '@wtc/ui';
import { fmtMoney, fmtPct, fmtDate } from '@/lib/format';
import { loadBot, BotAccessRequired, loadBotReadModelForUser } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';
import { BOT_CAPS } from '@/features/bots/meta';

export default async function Page({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const { meta, access, user } = await loadBot(bot);
  if (!access.allowed) return <BotAccessRequired meta={meta} section="Equity" />;

  const caps = BOT_CAPS[meta.code];
  const read = await loadBotReadModelForUser(user.id, meta.code, ['equityCurve', 'metrics']);
  const curve = filterZeroEquity(read.equityCurve.data ?? []);
  const metrics = read.metrics.data;
  const tone: Tone = read.health.status === 'healthy' ? 'ok' : read.health.status === 'down' ? 'bad' : 'warn';
  const recent = curve.slice(-12).reverse();

  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker={`${meta.name} - Equity`} title="Equity & drawdown" />
        <StatusPill tone={tone}>{read.health.status}</StatusPill>
      </div>
      <BotSubNav bot={bot} active="equity" />

      {read.adapterMode === 'mock' && (
        <RiskWarningBanner
          severity="warning"
          title="Simulated data - not a live account"
          detail="BOT_ADAPTER_MODE=mock: the equity series below is illustrative sample data."
        />
      )}
      {(read.equityCurve.issue ?? read.metrics.issue) && (
        <RiskWarningBanner
          severity={(read.equityCurve.issue ?? read.metrics.issue)!.kind === 'blocked' ? 'error' : 'warning'}
          title={(read.equityCurve.issue ?? read.metrics.issue)!.title}
          detail={(read.equityCurve.issue ?? read.metrics.issue)!.detail}
        />
      )}

      {metrics && (
        <div className="wtc-grid wtc-grid-4">
          <MetricCard label="Wallet equity" value={fmtMoney(metrics.walletEquity)} />
          <MetricCard label="Peak equity" value={fmtMoney(metrics.peakEquity)} />
          <MetricCard label="Max drawdown" value={<MetricValue value={metrics.maxDrawdownPct} suffix="%" />} tone="down" />
          <MetricCard label="ROI since start" value={<MetricValue value={metrics.roiPctSinceStart} suffix="%" />} sub={metrics.firstEquity != null ? `from ${fmtMoney(metrics.firstEquity)}` : 'baseline N/A'} />
        </div>
      )}

      <Card title="Equity curve">
        {!caps.hasEquityCurve || curve.length === 0 ? (
          <EmptyState
            title="No equity history available"
            hint={`${meta.name} exposes no equity-curve endpoint - wallet balance only. The curve is never fabricated.`}
          />
        ) : (
          <>
            <table className="wtc-table">
              <thead><tr><th>Time</th><th>Equity</th></tr></thead>
              <tbody>
                {recent.map((p) => (
                  <tr key={p.t}><td>{fmtDate(p.t)}</td><td>{fmtMoney(p.equity)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
              Current drawdown {fmtPct(metrics?.currentDrawdownPct)}. Zero/placeholder equity rows are dropped before drawdown is computed,
              so a single bad row can never report a false near-100% drawdown.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
