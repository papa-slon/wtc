import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/session';
import { NavLinks } from '@/components/NavLinks';
import { MobileNav } from '@/components/MobileNav';
import { APP_NAV } from '@/lib/nav';
import { logoutAction } from '@/app/(auth)/actions';
import { CsrfField } from '@/lib/csrf';
import { backendMode } from '@/lib/backend';
import { StatusPill, buttonClasses } from '@wtc/ui';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <div className="wtc-shell">
      <aside className="wtc-sidenav">
        <Link href="/" className="wtc-brand">WTC <span>OS</span></Link>
        <nav className="wtc-stack" style={{ marginTop: 22, gap: 4 }}>
          <NavLinks items={APP_NAV} />
        </nav>
        <div style={{ marginTop: 18, borderTop: '1px solid var(--stroke)', paddingTop: 14 }} className="wtc-stack">
          {user.roles.includes('admin') && <Link href="/admin">Admin console</Link>}
          {user.roles.includes('teacher') && <Link href="/teacher">Teacher console</Link>}
        </div>
      </aside>
      <div>
        <header className="wtc-topbar">
          <span className="wtc-dim" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>WTC Dashboard</span>
          <div className="wtc-row">
            <StatusPill tone={backendMode === 'postgres' ? 'ok' : 'warn'}>{backendMode === 'postgres' ? 'postgres' : 'demo data (in-memory)'}</StatusPill>
            <StatusPill tone="gold">{user.displayName}</StatusPill>
            <form action={logoutAction}>
              <CsrfField />
              <button className={buttonClasses('ghost')} type="submit" style={{ padding: '8px 12px' }}>Logout</button>
            </form>
          </div>
        </header>
        <main className="wtc-main">{children}</main>
      </div>
      <MobileNav items={APP_NAV} />
    </div>
  );
}
