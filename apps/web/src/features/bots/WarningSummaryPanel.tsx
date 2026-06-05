import { Card, EmptyState, RiskWarningBanner, StatusPill, type Tone } from '@wtc/ui';
import { fmtDateTime } from '@/lib/format';
import type { BotWarningSummary } from '@/features/bots/data';

function summaryTone(summary: BotWarningSummary): Tone {
  if (summary.status === 'unavailable' || summary.status === 'not_evaluated') return 'warn';
  if (summary.maxSeverity === 'error') return 'bad';
  if (summary.maxSeverity === 'warning') return 'warn';
  return 'neutral';
}

function stateLabel(summary: BotWarningSummary): string {
  if (summary.status === 'warnings_present') {
    return `${summary.count} notice${summary.count === 1 ? '' : 's'}`;
  }
  if (summary.status === 'none_reported') return 'none reported';
  if (summary.status === 'unavailable') return 'snapshot unavailable';
  return 'not fully evaluated';
}

function sourceLabel(summary: BotWarningSummary): string {
  if (summary.source === 'warnings_read') return 'warnings read';
  if (summary.source === 'health') return 'health snapshot';
  return 'not requested';
}

function scopeLabel(summary: BotWarningSummary): string {
  if (summary.scope === 'adapter_warning_read') return 'adapter warning read';
  if (summary.scope === 'product_health') return 'product health';
  if (summary.scope === 'provider_account_health') return 'provider account health';
  if (summary.scope === 'runtime_not_scoped') return 'runtime not scoped';
  return 'not requested';
}

export function WarningSummaryInline({ summary }: { summary: BotWarningSummary }) {
  return (
    <span className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <StatusPill tone={summaryTone(summary)}>{stateLabel(summary)}</StatusPill>
      <span className="wtc-dim" style={{ fontSize: 12 }}>
        {summary.status === 'warnings_present'
          ? `${summary.activeCount} active risk notice${summary.activeCount === 1 ? '' : 's'}`
          : summary.title}
      </span>
    </span>
  );
}

export function WarningSummaryPanel({
  summary,
  title = 'Risk & audit warnings',
}: {
  summary: BotWarningSummary;
  title?: string;
}) {
  const unavailable = summary.status === 'unavailable' || summary.status === 'not_evaluated';
  return (
    <Card title={title}>
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <StatusPill tone={summaryTone(summary)}>{stateLabel(summary)}</StatusPill>
        <StatusPill tone="neutral">source: {sourceLabel(summary)}</StatusPill>
        <StatusPill tone={summary.scope === 'runtime_not_scoped' ? 'warn' : 'neutral'}>scope: {scopeLabel(summary)}</StatusPill>
        {summary.evaluatedAt ? (
          <StatusPill tone="neutral">evaluated: {fmtDateTime(summary.evaluatedAt)}</StatusPill>
        ) : null}
      </div>

      {summary.issue ? (
        <RiskWarningBanner
          severity={summary.issue.kind === 'blocked' || summary.issue.kind === 'error' ? 'error' : 'warning'}
          title={summary.issue.title}
          detail={summary.issue.detail}
        />
      ) : null}

      {summary.warnings.length > 0 ? (
        <div className="wtc-stack" style={{ gap: 10 }}>
          {summary.warnings.map((warning) => (
            <RiskWarningBanner
              key={warning.code}
              severity={warning.severity}
              title={warning.title}
              detail={warning.detail}
            />
          ))}
          <p className="wtc-dim" style={{ fontSize: 12, margin: 0 }}>
            {summary.detail}
          </p>
        </div>
      ) : unavailable ? (
        <EmptyState title={summary.title} hint={summary.detail} />
      ) : (
        <EmptyState
          title={summary.title}
          hint="The latest evaluated source reported no canonical warning codes. This is not permission for live control and not a guarantee that the exchange/runtime is risk-free."
        />
      )}
    </Card>
  );
}
