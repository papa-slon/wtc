import { Card, SectionHeader, StatusPill, RiskWarningBanner, EmptyState, type Tone } from '@wtc/ui';
import { fmtMoney, fmtNum, fmtPct } from '@/lib/format';
import { loadBot, BotAccessRequired, loadBotReadModel } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';

export default async function Page({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const { meta, access } = await loadBot(bot);
  if (!access.allowed) return <BotAccessRequired meta={meta} section="Positions" />;

  const read = await loadBotReadModel(meta.code, ['positions']);
  const positions = read.positions.data ?? [];
  const tone: Tone = read.health.status === 'healthy' ? 'ok' : read.health.status === 'down' ? 'bad' : 'warn';
  const markUnavailable = meta.code === 'tortila_bot' && read.adapterMode === 'real';

  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker={`${meta.name} - Positions`} title="Open positions" />
        <StatusPill tone={tone}>{read.health.status}</StatusPill>
      </div>
      <BotSubNav bot={bot} active="positions" />

      {read.adapterMode === 'mock' && (
        <RiskWarningBanner
          severity="warning"
          title="Simulated data - not a live account"
          detail="BOT_ADAPTER_MODE=mock: positions below are illustrative sample data, not a live exchange account."
        />
      )}
      {read.positions.issue && (
        <RiskWarningBanner
          severity={read.positions.issue.kind === 'blocked' ? 'error' : 'warning'}
          title={read.positions.issue.title}
          detail={read.positions.issue.detail}
        />
      )}

      <Card title={`Open positions (${positions.length})`}>
        {positions.length === 0 ? (
          <EmptyState title="No open positions" />
        ) : (
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>uPnL</th>
                <th>Margin</th><th>Stop</th><th>Take-profit</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={`${p.symbol}-${i}`}>
                  <td>{p.symbol}</td>
                  <td>{p.side}</td>
                  <td>{fmtNum(p.qty)}</td>
                  <td>{fmtNum(p.entryPrice)}</td>
                  <td>{markUnavailable ? 'N/A' : fmtNum(p.markPrice)}</td>
                  <td className={!markUnavailable && p.unrealizedPnl < 0 ? 'wtc-down' : 'wtc-up'}>{markUnavailable ? 'N/A' : fmtMoney(p.unrealizedPnl)}</td>
                  <td>{p.marginUsed != null ? fmtMoney(p.marginUsed) : '-'}</td>
                  <td>{p.stopPrice != null ? `${fmtNum(p.stopPrice)}${p.stopDistPct != null ? ` (${fmtPct(p.stopDistPct)})` : ''}` : '-'}</td>
                  <td>{p.hasTp ? (p.tpPrice != null ? fmtNum(p.tpPrice) : 'set') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="wtc-dim" style={{ fontSize: 12 }}>
        Read-only view. "Stop" never closes positions; live controls require an audited adapter (docs/BOT_CONTROL_SAFETY_MODEL.md).
      </p>
    </div>
  );
}
