'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  /** Refresh interval in milliseconds. */
  intervalMs?: number;
  /** Whether the page is configured to fetch real data. When false the
   *  component still mounts (so the user sees the "not configured" hint) but
   *  it does not poll. */
  enabled?: boolean;
  /** ISO timestamp of the last server render — shown to the user. */
  initialServerTs: string;
}

/** Auto-refresh signal. We deliberately use `router.refresh()` so the page
 *  re-renders as a server component (no client-side state divergence, no
 *  duplicate fetch in the client). The component renders a small status bar
 *  with last-update time and a pulse indicator. */
export function AutoRefresh({ intervalMs = 30_000, enabled = true, initialServerTs }: AutoRefreshProps) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<string>(initialServerTs);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      setLastRefresh(new Date().toISOString());
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  const ts = new Date(lastRefresh);
  const label = Number.isNaN(ts.getTime())
    ? '—'
    : `${String(ts.getUTCHours()).padStart(2, '0')}:${String(ts.getUTCMinutes()).padStart(2, '0')}:${String(ts.getUTCSeconds()).padStart(2, '0')} UTC`;

  return (
    <div className="wtc-row" style={{ gap: 8, fontSize: 11, color: 'var(--muted)' }}>
      {enabled ? (
        <>
          <span className="tov-pulse" aria-hidden="true" />
          <span>Auto-refresh {Math.round(intervalMs / 1000)}s</span>
          <span className="tov-dim">.</span>
          <span className="tov-mono">last {label}</span>
        </>
      ) : (
        <>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--dim)', display: 'inline-block' }} />
          <span>Auto-refresh paused</span>
        </>
      )}
    </div>
  );
}
