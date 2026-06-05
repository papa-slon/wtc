import { Card, MetricCard, RiskWarningBanner, StatusPill } from '@wtc/ui';
import type { BotHealth, BotProductCode } from '@wtc/bot-adapters';
import { fmtDateTime, fmtNum } from '@/lib/format';
import { buildBotContinuitySummary } from './continuity';

interface BotContinuityPanelProps {
  productCode: BotProductCode;
  adapterMode: 'mock' | 'real';
  health: BotHealth;
  activeWarningCount?: number;
  dataRows?: number;
  dataRowsLabel?: string;
  dataRowsDetail?: string;
  configSourceLabel?: string;
  connectionLabel?: string;
  title?: string;
}

function freshnessValue(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'no age';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function alertSeverity(tone: 'ok' | 'warn' | 'bad' | 'neutral'): 'info' | 'warning' | 'error' {
  if (tone === 'bad') return 'error';
  if (tone === 'warn' || tone === 'neutral') return 'warning';
  return 'info';
}

export function BotContinuityPanel({
  productCode,
  adapterMode,
  health,
  activeWarningCount = 0,
  dataRows = 0,
  dataRowsLabel,
  dataRowsDetail,
  configSourceLabel,
  connectionLabel,
  title = 'Continuity monitor',
}: BotContinuityPanelProps) {
  const summary = buildBotContinuitySummary({
    productCode,
    adapterMode,
    health,
    activeWarningCount,
    dataRows,
    dataRowsLabel,
    dataRowsDetail,
    configSourceLabel,
    connectionLabel,
  });

  return (
    <Card title={title}>
      <RiskWarningBanner
        severity={alertSeverity(summary.tone)}
        title={summary.headline}
        detail={summary.detail}
      />

      <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12, marginBottom: 14 }}>
        <MetricCard label="Continuity" value={summary.label} tone={summary.tone === 'ok' ? 'up' : summary.tone === 'bad' ? 'down' : undefined} />
        <MetricCard label="Worker cadence" value={`${summary.expectedCadenceSeconds}s`} sub="expected check interval" />
        <MetricCard label="Last worker check" value={health.lastSyncAt ? fmtDateTime(health.lastSyncAt) : 'pending'} />
        <MetricCard label="Snapshot age" value={freshnessValue(health.staleDataSeconds)} sub={`${fmtNum(dataRows)} ${dataRowsLabel ?? 'scoped rows'}`} />
      </div>

      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Status</th>
              <th>Proof</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr key={row.layer}>
                <td data-label="Layer">{row.layer}</td>
                <td data-label="Status"><StatusPill tone={row.status}>{row.statusLabel}</StatusPill></td>
                <td data-label="Proof">{row.proof}</td>
                <td data-label="Meaning" className="wtc-dim">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="wtc-dim" style={{ fontSize: 12, lineHeight: 1.6, margin: '12px 0 0' }}>
        Continuity proof is read-only: it combines worker heartbeat, scoped runtime snapshots, data freshness,
        and warning state. It is not a start button and it is not an exchange connection test.
      </p>
    </Card>
  );
}
