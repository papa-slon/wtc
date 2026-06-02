import Link from 'next/link';

/** Tab strip for a bot dashboard. Server component — the active segment is passed in (no client hook). */
const TABS: { seg: string; label: string }[] = [
  { seg: '', label: 'Overview' },
  { seg: 'statistics', label: 'Statistics' },
  { seg: 'journal', label: 'Journal' },
  { seg: 'positions', label: 'Positions' },
  { seg: 'trades', label: 'Trades' },
  { seg: 'equity', label: 'Equity' },
  { seg: 'safety', label: 'Safety' },
  { seg: 'backtester', label: 'Backtester' },
  { seg: 'settings', label: 'Settings' },
];

export function BotSubNav({ bot, active }: { bot: string; active: string }) {
  return (
    <nav
      aria-label="Bot sections"
      className="wtc-row"
      style={{ gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--stroke)', paddingBottom: 12, marginBottom: 4 }}
    >
      {TABS.map((t) => {
        const href = t.seg === 'statistics' ? `/app/bots/statistics?bot=${bot}` : t.seg ? `/app/bots/${bot}/${t.seg}` : `/app/bots/${bot}`;
        const isActive = active === t.seg;
        return (
          <Link
            key={t.seg || 'overview'}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              fontSize: 13,
              textDecoration: 'none',
              color: isActive ? 'var(--text)' : 'var(--muted)',
              background: isActive ? 'var(--panel2)' : 'transparent',
              border: isActive ? '1px solid var(--stroke-gold)' : '1px solid transparent',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
