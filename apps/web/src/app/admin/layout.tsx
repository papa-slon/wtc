import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCurrentUser, isAdmin } from '@/lib/session';
import { NavLinks } from '@/components/NavLinks';
import { MobileNav } from '@/components/MobileNav';
import { ADMIN_NAV } from '@/lib/nav';
import { logoutAction } from '@/app/(auth)/actions';
import { CsrfField } from '@/lib/csrf';
import { StatusPill, buttonClasses } from '@wtc/ui';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin(user)) redirect('/app'); // server-side RBAC

  return (
    <div className="wtc-shell">
      <aside className="wtc-sidenav">
        <Link href="/" className="wtc-brand">WTC <span>ADMIN</span></Link>
        <nav className="wtc-stack" style={{ marginTop: 22, gap: 4 }}>
          <NavLinks items={ADMIN_NAV} />
        </nav>
        <div style={{ marginTop: 18, borderTop: '1px solid var(--stroke)', paddingTop: 14 }}>
          <Link href="/app">← Back to app</Link>
        </div>
      </aside>
      <div>
        <header className="wtc-topbar">
          <span className="wtc-dim" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>Admin console</span>
          <div className="wtc-row">
            <StatusPill tone="bad">admin</StatusPill>
            <form action={logoutAction}><CsrfField /><button className={buttonClasses('ghost')} style={{ padding: '8px 12px' }}>Logout</button></form>
          </div>
        </header>
        <main className="wtc-main">{children}</main>
      </div>
      {/* Mobile nav: the sidenav is display:none below 900px, so the admin console had no
          navigation on mobile. Rendered inside the admin tree (after the isAdmin gate above) so
          ADMIN_NAV links are never exposed to a non-admin. .wtc-mobile-nav activates at ≤900px. */}
      <MobileNav items={ADMIN_NAV} />
    </div>
  );
}
