import type { TortilaActivityItem } from '@wtc/bot-adapters';
import { fmtShortTs, fmtSignedOrDash, shortSymbol, signClass } from './format';

interface ActivityFeedProps {
  items: TortilaActivityItem[];
}

const KIND_LABEL: Record<TortilaActivityItem['kind'], string> = {
  trade: 'trade',
  safety: 'safety',
  decision: 'decision',
};

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return <div className="tov-empty-mini">No recent activity recorded.</div>;
  }
  return (
    <div className="tov-feed">
      {items.map((item, i) => {
        const amt = item.kind === 'trade' && typeof item.net_pnl === 'number' ? item.net_pnl : null;
        const label = item.label ?? '';
        const detail = item.detail ?? '';
        const sym = item.symbol ? shortSymbol(item.symbol) : '';
        return (
          <div key={`${item.ts}-${i}`} className="tov-feed-item">
            <span className="tov-feed-ts">{fmtShortTs(item.ts)}</span>
            <div>
              <div className="tov-feed-label">
                <span className={`tov-feed-kind ${item.kind}`}>{KIND_LABEL[item.kind]}</span>
                {sym && <strong style={{ marginRight: 6 }}>{sym}</strong>}
                {label}
              </div>
              {detail && <div className="tov-feed-detail">{detail}</div>}
            </div>
            <span className={`tov-feed-amt ${signClass(amt)}`}>{amt !== null ? fmtSignedOrDash(amt) : ''}</span>
          </div>
        );
      })}
    </div>
  );
}
