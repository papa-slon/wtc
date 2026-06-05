import { Card, MetricCard, StatusPill } from '@wtc/ui';
import type { BotConfigReview } from './config-review';

function ReviewContent({ review }: { review: BotConfigReview }) {
  return (
    <div className="wtc-stack" style={{ gap: 14 }}>
      <div className="wtc-row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {review.pills.map((pill) => (
          <StatusPill key={pill.label} tone={pill.tone ?? 'neutral'}>{pill.label}</StatusPill>
        ))}
      </div>
      <div>
        <h4 style={{ margin: 0, fontSize: 15 }}>{review.title}</h4>
      </div>
      <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        {review.summary}
      </p>
      <div className="wtc-grid wtc-grid-4">
        {review.metrics.map((metric) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} sub={metric.sub} tone={metric.tone} />
        ))}
      </div>
      <div className="wtc-grid wtc-grid-2">
        {review.sections.map((section) => (
          <section key={section.title} className="wtc-stack" style={{ gap: 10 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15 }}>{section.title}</h4>
              <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.55 }}>{section.detail}</p>
            </div>
            <div className="wtc-table-wrap">
              <table className="wtc-table">
                <thead><tr><th>Item</th><th>Setting</th><th>Meaning</th></tr></thead>
                <tbody>
                  {section.rows.length > 0 ? section.rows.map((row) => (
                    <tr key={`${section.title}-${row.label}`}>
                      <td data-label="Item" className="wtc-mono" style={{ fontSize: 12 }}>{row.label}</td>
                      <td data-label="Setting">{row.value}</td>
                      <td data-label="Meaning" className="wtc-dim">{row.detail}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td data-label="Item">-</td>
                      <td data-label="Setting">No rows</td>
                      <td data-label="Meaning" className="wtc-dim">Save at least one configured row before this section can summarize it.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <p className="wtc-dim" style={{ fontSize: 12, margin: 0 }}>
        {review.footnote}
      </p>
    </div>
  );
}

export function BotConfigReviewPanel({
  review,
  framed = true,
  title = 'Effective settings review',
}: {
  review: BotConfigReview;
  framed?: boolean;
  title?: string;
}) {
  if (!framed) {
    return (
      <section className="wtc-stack" style={{ gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <p className="wtc-dim" style={{ margin: '4px 0 0', fontSize: 12 }}>Read-only summary of the config that will be saved or inherited.</p>
        </div>
        <ReviewContent review={review} />
      </section>
    );
  }

  return (
    <Card title={title}>
      <ReviewContent review={review} />
    </Card>
  );
}
