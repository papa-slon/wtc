import Link from 'next/link';
import { Card, StatusPill, buttonClasses } from '@wtc/ui';
import type { BotReadinessItem, BotReadinessStatus } from './readiness';

function statusTone(status: BotReadinessStatus): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (status === 'ready') return 'ok';
  if (status === 'attention') return 'warn';
  if (status === 'blocked') return 'bad';
  return 'neutral';
}

function statusLabel(status: BotReadinessStatus): string {
  if (status === 'ready') return 'ready';
  if (status === 'attention') return 'needs review';
  if (status === 'blocked') return 'blocked';
  return 'read-only';
}

export function BotReadinessMap({
  title = 'Bot readiness map',
  copy,
  items,
}: {
  title?: string;
  copy?: string;
  items: BotReadinessItem[];
}) {
  return (
    <Card title={title}>
      {copy && <p className="wtc-muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>{copy}</p>}
      <div className="wtc-table-wrap">
        <table className="wtc-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Status</th>
              <th>Current state</th>
              <th>Meaning</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.label}>
                <td data-label="Layer">{item.label}</td>
                <td data-label="Status"><StatusPill tone={statusTone(item.status)}>{statusLabel(item.status)}</StatusPill></td>
                <td data-label="Current state">{item.value}</td>
                <td data-label="Meaning" className="wtc-dim">{item.detail}</td>
                <td data-label="Action" className="wtc-td-action">
                  {item.href && item.actionLabel ? (
                    <Link href={item.href} className={buttonClasses('ghost')}>{item.actionLabel}</Link>
                  ) : (
                    <span className="wtc-dim">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
