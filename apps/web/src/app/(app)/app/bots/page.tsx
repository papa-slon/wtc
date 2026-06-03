import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { combineMetrics } from '@wtc/analytics';
import { botAdapterMode } from '@/lib/server-config';
import { Card, SectionHeader, StatusPill, MetricCard, MetricValue, RiskWarningBanner, buttonClasses, type Tone } from '@wtc/ui';
import { fmtMoney, fmtPf, fmtNum } from '@/lib/format';
import { BOT_LIST, BOT_CAPS } from '@/features/bots/meta';
import { loadBotReadModel } from '@/features/bots/data';

function healthTone(status: string): Tone {
  return status === 'healthy' ? 'ok' : status === 'degraded' || status === 'stale' ? 'warn' : 'bad';
}

export default async function BotsPage() {
  const user = await requireUser();
  const rows = await Promise.all(
    BOT_LIST.map(async (b) => {
      const access = await botAccessForUser(user, b.code);
      const read = access.allowed ? await loadBotReadModel(b.code, ['metrics']) : null;
      return { ...b, access, read };
    }),
  );

  const tortila = rows.find((r) => r.code === 'tortila_bot');
  const legacy = rows.find((r) => r.code === 'legacy_bot');
  const combined = combineMetrics(
    tortila?.access.allowed ? tortila.read?.metrics.data ?? null : null,
    legacy?.access.allowed ? legacy.read?.metrics.data ?? null : null,
  );
  const entitledCount = rows.filter((r) => r.access.allowed).length;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Trading bots"
        title="Bots"
        copy={`Read-only monitoring through adapters. Live controls stay disabled until a dedicated audited adapter is approved. BOT_ADAPTER_MODE=${botAdapterMode()}.`}
      />
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href="/app/bots/statistics?bot=tortila" className={buttonClasses('secondary')}>Open statistics</Link>
        <span className="wtc-dim" style={{ fontSize: 12 }}>Bot-level stats use the same dashboard style; strategy metrics are not blended.</span>
      </div>
      {botAdapterMode() === 'mock' && (
        <RiskWarningBanner
          severity="warning"
          title="Simulated data — not a live account"
          detail="Bot dashboards use the mock adapter (BOT_ADAPTER_MODE=mock). No live exchange or bot account is connected; every figure below is illustrative."
        />
      )}

      {entitledCount > 0 && (
        <Card title="Combined portfolio (entitled bots)">
          <div className="wtc-grid wtc-grid-4">
            <MetricCard label="Total wallet equity" value={fmtMoney(combined.totalWalletEquity)} />
            <MetricCard label="Open positions" value={fmtNum(combined.totalOpenPositions)} />
            <MetricCard
              label="Tortila net PnL (after fees)"
              value={fmtMoney(combined.netPnlWithFeesTortila)}
              tone={(combined.netPnlWithFeesTortila ?? 0) >= 0 ? 'up' : 'down'}
            />
            <MetricCard label="Bots entitled" value={fmtNum(entitledCount)} sub={`of ${rows.length}`} />
          </div>
          <p className="wtc-dim" style={{ fontSize: 12, marginTop: 10 }}>
            Win rate and profit factor are shown per bot below - never averaged across different strategies.
          </p>
        </Card>
      )}

      <div className="wtc-grid wtc-grid-2">
        {rows.map((b) => (
          <Card key={b.slug}>
            <div className="wtc-spread">
              <h3 style={{ margin: 0, fontSize: 19 }}>{b.name}</h3>
              <StatusPill tone={b.access.allowed && b.read ? healthTone(b.read.health.status) : 'bad'}>
                {b.access.allowed && b.read ? b.read.health.status : 'locked'}
              </StatusPill>
            </div>
            <p className="wtc-dim" style={{ fontSize: 12, margin: '6px 0 0' }}>{b.tagline}</p>
            <div className="wtc-row" style={{ marginTop: 10 }}>
              <StatusPill tone={b.access.allowed ? 'ok' : 'bad'}>{reasonLabel(b.access.reason)}</StatusPill>
              {b.access.allowed && b.read ? (
                <span className="wtc-dim" style={{ fontSize: 12 }}>
                  process {b.read.health.processAlive ? 'alive' : 'down'} - {b.read.health.warnings.length} warning(s)
                </span>
              ) : (
                <span className="wtc-dim" style={{ fontSize: 12 }}>adapter status hidden until entitlement is active</span>
              )}
            </div>
            {b.access.allowed && b.read?.metrics.issue && (
              <div style={{ marginTop: 10 }}>
                <RiskWarningBanner
                  severity={b.read.metrics.issue.kind === 'blocked' ? 'error' : 'warning'}
                  title={b.read.metrics.issue.title}
                  detail={b.read.metrics.issue.detail}
                />
              </div>
            )}
            {b.access.allowed && b.read?.metrics.data && (
              <div className="wtc-grid wtc-grid-2" style={{ marginTop: 14 }}>
                <MetricCard label="Wallet equity" value={fmtMoney(b.read.metrics.data.walletEquity)} />
                <MetricCard
                  label="Win rate"
                  value={<MetricValue value={b.read.metrics.data.winRatePct} suffix="%" />}
                  sub={`PF ${fmtPf(b.read.metrics.data.profitFactor)}`}
                />
              </div>
            )}
            {BOT_CAPS[b.code].liveAdapterBlocked && (
              <div style={{ marginTop: 10 }}>
                <RiskWarningBanner
                  severity="error"
                  title="Live adapter unavailable — blocked (B3)"
                  detail={BOT_CAPS[b.code].liveAdapterBlockedReason ?? 'The live read-only adapter for this bot is blocked upstream.'}
                />
              </div>
            )}
            {!BOT_CAPS[b.code].hasTradeHistory && (
              <p className="wtc-dim" style={{ fontSize: 12, margin: '10px 0 0' }}>
                Limited data - trade history and equity curve are not available for this bot.
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <Link href={`/app/bots/${b.slug}`} className={buttonClasses(b.access.allowed ? 'primary' : 'ghost')}>
                {b.access.allowed ? 'Open dashboard' : 'View status'}
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <p className="wtc-dim" style={{ fontSize: 12 }}>
        Read-only monitoring through adapters. "Stop" never closes positions. Live controls remain disabled until a separately audited adapter is approved.
        See docs/BOT_CONTROL_SAFETY_MODEL.md.
      </p>
    </div>
  );
}
