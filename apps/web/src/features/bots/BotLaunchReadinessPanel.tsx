import Link from 'next/link';
import { Card, MetricCard, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import type { BotReadinessItem } from './readiness';

function itemTone(status: BotReadinessItem['status']): Tone {
  if (status === 'ready') return 'ok';
  if (status === 'attention') return 'warn';
  if (status === 'blocked') return 'bad';
  return 'neutral';
}

function launchState(items: readonly BotReadinessItem[]): { tone: Tone; label: string; detail: string } {
  const blocked = items.filter((item) => item.status === 'blocked');
  const attention = items.filter((item) => item.status === 'attention');
  if (blocked.length > 0) {
    return {
      tone: 'bad',
      label: 'Launch blocked',
      detail: `${blocked.length} required layer${blocked.length === 1 ? '' : 's'} blocked before live-control can even be reviewed.`,
    };
  }
  if (attention.length > 0) {
    return {
      tone: 'warn',
      label: 'Operator review required',
      detail: `${attention.length} layer${attention.length === 1 ? '' : 's'} still need attention; this page will not start the bot.`,
    };
  }
  return {
    tone: 'neutral',
    label: 'Read-only ready',
    detail: 'Readiness facts are coherent, but live start remains disabled until a separate audited adapter is approved.',
  };
}

export function BotLaunchReadinessPanel({
  bot,
  botName,
  items,
  title = 'Launch readiness command center',
  copy,
  settingsHref,
  settingsLabel = 'Open settings',
  statisticsHref,
  statisticsLabel = 'Open statistics',
  disabledLabel = 'Start bot unavailable',
  disabledTitle = 'Disabled until live bot start is separately audited and approved',
  connectionPillLabel = 'no exchange ping',
  showDisabledControl = true,
}: {
  bot: string;
  botName: string;
  items: readonly BotReadinessItem[];
  title?: string;
  copy?: string;
  settingsHref?: string;
  settingsLabel?: string;
  statisticsHref?: string | null;
  statisticsLabel?: string;
  disabledLabel?: string;
  disabledTitle?: string;
  connectionPillLabel?: string;
  showDisabledControl?: boolean;
}) {
  const blocked = items.filter((item) => item.status === 'blocked');
  const attention = items.filter((item) => item.status === 'attention');
  const ready = items.filter((item) => item.status === 'ready');
  const state = launchState(items);
  const next = blocked[0] ?? attention[0] ?? items.find((item) => item.href);
  const fallbackSettingsHref = settingsHref ?? `/app/bots/${bot}/settings`;
  const resolvedStatisticsHref = statisticsHref === undefined ? `/app/bots/statistics?bot=${bot}` : statisticsHref;

  return (
    <Card title={title}>
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusPill tone={state.tone}>{state.label}</StatusPill>
        <StatusPill tone="bad">live start disabled</StatusPill>
        <StatusPill tone="neutral">{connectionPillLabel}</StatusPill>
      </div>
      <p className="wtc-dim" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
        {copy ?? `${botName} can be reviewed from WTC readiness evidence, but this page does not start, stop, apply config, retest exchange connectivity, or touch open positions.`}
      </p>

      <div className="wtc-grid wtc-grid-4" style={{ marginBottom: 14 }}>
        <MetricCard label="Launch decision" value={state.label} sub={state.detail} tone={state.tone === 'bad' || state.tone === 'warn' ? 'down' : undefined} />
        <MetricCard label="Ready layers" value={ready.length} sub={`${items.length} total readiness rows`} />
        <MetricCard label="Needs attention" value={attention.length} sub="review before live-control audit" tone={attention.length > 0 ? 'down' : undefined} />
        <MetricCard label="Blocked layers" value={blocked.length} sub="must be fixed first" tone={blocked.length > 0 ? 'down' : undefined} />
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Gate</th>
              <th>Status</th>
              <th>Current state</th>
              <th>Launch meaning</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.label}>
                <td data-label="Gate">{item.label}</td>
                <td data-label="Status"><StatusPill tone={itemTone(item.status)}>{item.status}</StatusPill></td>
                <td data-label="Current state">{item.value}</td>
                <td data-label="Launch meaning" className="wtc-dim">{item.detail}</td>
                <td data-label="Next action" className="wtc-td-action">
                  {item.href && item.actionLabel ? (
                    <Link href={item.href} className={buttonClasses('ghost')}>{item.actionLabel}</Link>
                  ) : (
                    <span className="wtc-dim">No action</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="wtc-row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {showDisabledControl ? (
          <button
            className={buttonClasses('ghost')}
            type="button"
            disabled
            title={disabledTitle}
          >
            {disabledLabel}
          </button>
        ) : null}
        {next?.href && next.actionLabel ? (
          <Link href={next.href} className={buttonClasses('secondary')}>{next.actionLabel}</Link>
        ) : (
          <Link href={fallbackSettingsHref} className={buttonClasses('secondary')}>{settingsLabel}</Link>
        )}
        {resolvedStatisticsHref ? (
          <Link href={resolvedStatisticsHref} className={buttonClasses('ghost')}>{statisticsLabel}</Link>
        ) : null}
      </div>
    </Card>
  );
}
