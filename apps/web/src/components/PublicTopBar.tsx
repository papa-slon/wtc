import Link from 'next/link';
import { PUBLIC_NAV } from '@/lib/nav';
import { buttonClasses, StatusPill } from '@wtc/ui';
import { getCurrentUser } from '@/lib/session';
import { backendMode } from '@/lib/backend';
import { botAdapterMode, axiomaBridgeIsDev } from '@/lib/server-config';

export async function PublicTopBar() {
  const user = await getCurrentUser();
  // Environment-aware status — never claim "online" when running on the in-memory demo store, the mock
  // bot adapters, or the dev Axioma bridge. Honest signal: demo environment vs a fully-wired one.
  const isDemo = backendMode === 'memory' || botAdapterMode() === 'mock' || axiomaBridgeIsDev();
  return (
    <header className="wtc-topbar">
      <div className="wtc-row">
        <Link href="/" className="wtc-brand">
          WTC <span>ECOSYSTEM</span>
        </Link>
        {isDemo ? (
          <StatusPill tone="warn">demo environment</StatusPill>
        ) : (
          <StatusPill tone="ok">ecosystem online</StatusPill>
        )}
      </div>
      <nav className="wtc-row" style={{ gap: 18 }}>
        {PUBLIC_NAV.map((n) => (
          <Link key={n.href} href={n.href} className="wtc-muted" style={{ fontSize: 13 }}>
            {n.label}
          </Link>
        ))}
        {user ? (
          <Link href="/app" className={buttonClasses('secondary')}>Open dashboard</Link>
        ) : (
          <>
            <Link href="/login" className="wtc-muted" style={{ fontSize: 13 }}>Login</Link>
            <Link href="/register" className={buttonClasses('primary')}>Get access</Link>
          </>
        )}
      </nav>
    </header>
  );
}
