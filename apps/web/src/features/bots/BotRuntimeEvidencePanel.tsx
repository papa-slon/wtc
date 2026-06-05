import { Card, MetricCard, RiskWarningBanner, StatusPill, type Tone } from '@wtc/ui';
import type { BotHealth, BotProductCode, HealthStatus, ReadState } from '@wtc/bot-adapters';
import { fmtDateTime, fmtNum } from '@/lib/format';

type AdapterMode = 'mock' | 'real';

interface BotRuntimeEvidencePanelProps {
  productCode: BotProductCode;
  adapterMode: AdapterMode;
  health: BotHealth;
  metricsAvailable: boolean;
  positionsCount: number;
  tradesCount: number;
  configSnapshotAvailable: boolean;
  warningStatus: string;
  warningCount: number;
  equitySamples?: number;
  title?: string;
}

interface EvidenceRow {
  layer: string;
  status: Tone;
  value: string;
  detail: string;
}

function readStateTone(readState: ReadState | undefined, status: HealthStatus): Tone {
  if (readState === 'ok') return status === 'healthy' ? 'ok' : 'warn';
  if (readState === 'not_configured') return 'neutral';
  if (readState === 'stale') return 'warn';
  if (readState === 'unreachable' || readState === 'malformed') return 'bad';
  if (status === 'healthy') return 'ok';
  if (status === 'stale' || status === 'degraded') return 'warn';
  return 'bad';
}

function readStateLabel(readState: ReadState | undefined, status: HealthStatus): string {
  return readState ?? status;
}

function toneLabel(tone: Tone): string {
  if (tone === 'ok') return 'fresh proof';
  if (tone === 'warn') return 'needs review';
  if (tone === 'bad') return 'blocked';
  return 'pending';
}

function freshnessLabel(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'no age recorded';
  if (seconds < 60) return `${seconds}s old`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m old`;
  return `${Math.round(minutes / 60)}h old`;
}

function sourceLabel(productCode: BotProductCode, adapterMode: AdapterMode): string {
  if (adapterMode === 'mock') return 'mock adapter preview';
  return productCode === 'legacy_bot' ? 'legacy provider snapshot' : 'tortila journal snapshot';
}

function sourceDetail(productCode: BotProductCode, adapterMode: AdapterMode): string {
  if (adapterMode === 'mock') {
    return 'Synthetic preview data is rendered so the room stays usable while no runtime proof is connected.';
  }
  if (productCode === 'legacy_bot') {
    return 'Legacy runtime is read by provider pub_id through the WTC worker and persisted as safe DB snapshot rows.';
  }
  return 'Tortila journal health is read by the WTC worker, persisted in WTC DB snapshots, then scoped to this page.';
}

function evidenceRows(props: BotRuntimeEvidencePanelProps): EvidenceRow[] {
  const anySnapshot =
    props.metricsAvailable || props.positionsCount > 0 || props.tradesCount > 0 || props.configSnapshotAvailable;
  const readTone = readStateTone(props.health.readState, props.health.status);
  const pageScopeDetail = props.productCode === 'legacy_bot'
    ? 'User data is scoped by entitlement plus provider mapping; admin drilldowns are read-only owner views.'
    : 'User data is scoped by entitlement plus the user bot instance; admin drilldowns are read-only owner views.';
  return [
    {
      layer: props.productCode === 'legacy_bot' ? 'Provider runtime' : 'Journal health',
      status: readTone,
      value: readStateLabel(props.health.readState, props.health.status),
      detail: sourceDetail(props.productCode, props.adapterMode),
    },
    {
      layer: 'WTC worker check',
      status: props.health.lastSyncAt ? readTone : 'neutral',
      value: props.health.lastSyncAt ? fmtDateTime(props.health.lastSyncAt) : 'pending',
      detail: props.health.lastSyncAt
        ? `Latest recorded check is ${freshnessLabel(props.health.staleDataSeconds)}.`
        : 'No worker health check has been recorded for this owner-scoped runtime yet.',
    },
    {
      layer: 'WTC DB snapshot',
      status: anySnapshot ? 'ok' : props.adapterMode === 'mock' ? 'warn' : 'neutral',
      value: anySnapshot ? 'rows present' : 'no rows yet',
      detail: `${props.metricsAvailable ? 'Metrics available' : 'Metrics pending'}; ${props.positionsCount} positions; ${props.tradesCount} trades; config ${props.configSnapshotAvailable ? 'available' : 'pending'}.`,
    },
    {
      layer: 'Scoped page data',
      status: props.adapterMode === 'mock' ? 'warn' : anySnapshot ? 'ok' : 'neutral',
      value: props.adapterMode === 'mock' ? 'preview scope' : 'current user scope',
      detail: pageScopeDetail,
    },
  ];
}

export function BotRuntimeEvidencePanel(props: BotRuntimeEvidencePanelProps) {
  const rows = evidenceRows(props);
  const readTone = readStateTone(props.health.readState, props.health.status);
  const equityCopy = props.equitySamples === undefined ? null : `${fmtNum(props.equitySamples)} equity samples`;
  const readStateDetail = props.health.readState && props.health.readState !== 'ok' ? props.health.readStateDetail : null;

  return (
    <Card title={props.title ?? 'Runtime evidence ladder'}>
      <div className="wtc-grid wtc-grid-4" style={{ marginBottom: 14 }}>
        <MetricCard label="Source mode" value={sourceLabel(props.productCode, props.adapterMode)} sub="journal -> worker -> WTC DB snapshot -> scoped page data" />
        <MetricCard label="Process signal" value={props.health.processAlive ? 'alive reported' : 'not proven'} sub="read-only health snapshot" />
        <MetricCard label="Freshness" value={freshnessLabel(props.health.staleDataSeconds)} sub={props.health.lastSyncAt ? fmtDateTime(props.health.lastSyncAt) : 'no sync recorded'} />
        <MetricCard label="Statistics proof" value={props.metricsAvailable ? 'metrics present' : 'metrics pending'} sub={equityCopy ?? `${fmtNum(props.positionsCount)} positions / ${fmtNum(props.tradesCount)} trades`} />
      </div>

      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <StatusPill tone={readTone}>{readStateLabel(props.health.readState, props.health.status)}</StatusPill>
        <StatusPill tone={props.adapterMode === 'mock' ? 'warn' : 'neutral'}>{props.adapterMode} data</StatusPill>
        <StatusPill tone={props.warningCount > 0 ? 'warn' : 'neutral'}>{props.warningStatus.replace(/_/g, ' ')}</StatusPill>
      </div>

      {readStateDetail && (
        <RiskWarningBanner
          severity={props.health.readState === 'not_configured' || props.health.readState === 'stale' ? 'warning' : 'error'}
          title="Runtime proof needs review"
          detail={readStateDetail}
        />
      )}

      <div className="wtc-table-wrap" style={{ marginTop: readStateDetail ? 14 : 0 }}>
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
            {rows.map((row) => (
              <tr key={row.layer}>
                <td data-label="Layer">{row.layer}</td>
                <td data-label="Status"><StatusPill tone={row.status}>{toneLabel(row.status)}</StatusPill></td>
                <td data-label="Proof">{row.value}</td>
                <td data-label="Meaning" className="wtc-dim">{row.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="wtc-dim" style={{ fontSize: 12, lineHeight: 1.6, margin: '12px 0 0' }}>
        This panel is read-only evidence. Runtime actions, provider secrets, and raw provider payloads are not rendered here.
      </p>
    </Card>
  );
}
