import { Card, MetricCard, RiskWarningBanner, StatusPill, type Tone } from '@wtc/ui';

export interface AdminEvidenceMetric {
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down';
}

export interface AdminEvidenceRow {
  layer: string;
  status: Tone;
  statusLabel: string;
  proof: string;
  detail: string;
}

export function AdminBotRuntimeEvidencePanel({
  title = 'Admin runtime evidence ladder',
  copy,
  metrics,
  rows,
  framed = true,
}: {
  title?: string;
  copy: string;
  metrics: AdminEvidenceMetric[];
  rows: AdminEvidenceRow[];
  framed?: boolean;
}) {
  const body = (
    <>
      {!framed && <h3 style={{ margin: '18px 0 0', fontSize: 16 }}>{title}</h3>}
      <RiskWarningBanner
        severity="info"
        title="Read-only admin evidence"
        detail={copy}
      />

      <div className="wtc-grid wtc-grid-4" style={{ marginTop: 12, marginBottom: 14 }}>
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            sub={metric.sub}
            tone={metric.tone}
          />
        ))}
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
            {rows.map((row) => (
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
        Admin visibility is diagnostic only. User-owned settings, provider mappings, credentials,
        open positions, and runtime actions are not changed from this evidence panel.
      </p>
    </>
  );

  if (!framed) {
    return <div className="wtc-stack" style={{ gap: 12 }}>{body}</div>;
  }

  return <Card title={title}>{body}</Card>;
}
