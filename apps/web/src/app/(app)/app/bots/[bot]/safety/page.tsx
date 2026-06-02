import { Card, SectionHeader, StatusPill, MetricCard, RiskWarningBanner, EmptyState } from '@wtc/ui';
import { fmtNum } from '@/lib/format';
import { loadBot, BotAccessRequired, loadBotReadModel } from '@/features/bots/data';
import { BotSubNav } from '@/components/BotSubNav';
import { BOT_CAPS, botHealthPill } from '@/features/bots/meta';

export default async function Page({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const { meta, access } = await loadBot(bot);
  if (!access.allowed) return <BotAccessRequired meta={meta} section="Safety" />;

  const caps = BOT_CAPS[meta.code];
  // Keep safety on the same safe-read path as the other bot pages; blocked/not-ready adapters
  // become visible UI state instead of route crashes.
  const read = await loadBotReadModel(meta.code, ['warnings']);
  const health = read.health;
  const warnings = read.warnings.data ?? [];
  const healthPill = botHealthPill(health);
  const active = warnings.filter((w) => w.severity !== 'info').length;
  const lastSync = health.lastSyncAt != null ? `${Math.round((Date.now() - health.lastSyncAt) / 1000)}s ago` : '—';

  return (
    <div className="wtc-stack">
      <div className="wtc-spread">
        <SectionHeader kicker={`${meta.name} · Safety`} title="Safety & risk events" />
        <StatusPill tone={healthPill.tone}>{healthPill.label}</StatusPill>
      </div>
      <BotSubNav bot={bot} active="safety" />

      {/* Honest read-state detail when a real adapter is not returning fresh data. */}
      {health.readState && health.readState !== 'ok' && health.readStateDetail && (
        <RiskWarningBanner
          severity={health.readState === 'not_configured' || health.readState === 'stale' ? 'warning' : 'error'}
          title={`Journal read: ${healthPill.label}`}
          detail={health.readStateDetail}
        />
      )}
      {read.warnings.issue && (
        <RiskWarningBanner
          severity={read.warnings.issue.kind === 'blocked' || read.warnings.issue.kind === 'error' ? 'error' : 'warning'}
          title={read.warnings.issue.title}
          detail={read.warnings.issue.detail}
        />
      )}

      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Process" value={health.processAlive ? 'Alive' : 'Down'} tone={health.processAlive ? 'up' : 'down'} />
        <MetricCard label="Active warnings" value={fmtNum(active)} tone={active > 0 ? 'down' : 'up'} />
        <MetricCard label="Total events" value={fmtNum(warnings.length)} />
        <MetricCard label="Last sync" value={lastSync} />
      </div>

      {/* Known risk signals (getWarnings()) are first-class and never hidden behind a healthy card. */}
      <Card title="Risk & audit warnings">
        {warnings.length === 0 ? (
          <EmptyState title="No active safety events" hint="Reconciliation, TP/SL, margin and rate-limit signals would appear here." />
        ) : (
          warnings.map((w) => (
            <RiskWarningBanner key={w.code} severity={w.severity} title={w.title} detail={w.detail} />
          ))
        )}
      </Card>

      {caps.notes.length > 0 && (
        <Card title="Known limitations for this bot">
          <ul className="wtc-dim" style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
            {caps.notes.map((n, i) => (<li key={i}>{n}</li>))}
          </ul>
        </Card>
      )}

      <p className="wtc-dim" style={{ fontSize: 12 }}>
        “Stop” never closes positions. Live controls stay disabled until a separately audited adapter is approved (docs/BOT_CONTROL_SAFETY_MODEL.md).
      </p>
    </div>
  );
}
