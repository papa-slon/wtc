import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/session';
import { NavLinks } from '@/components/NavLinks';
import { MobileNav } from '@/components/MobileNav';
import { TEACHER_NAV } from '@/lib/nav';
import { logoutAction } from '@/app/(auth)/actions';
import { CsrfField } from '@/lib/csrf';
import { StatusPill, buttonClasses } from '@wtc/ui';

/** Server-side guard for all /teacher routes (teacher or admin only). */
export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.includes('teacher') && !user.roles.includes('admin')) redirect('/app');
  return (
    <div className="wtc-shell">
      <aside className="wtc-sidenav">
        <Link href="/" className="wtc-brand">WTC <span>TEACH</span></Link>
        <nav className="wtc-stack" style={{ marginTop: 22, gap: 4 }}>
          <NavLinks items={TEACHER_NAV} />
        </nav>
        <div style={{ marginTop: 18, borderTop: '1px solid var(--stroke)', paddingTop: 14 }} className="wtc-stack">
          <Link href="/app">Back to app</Link>
          {user.roles.includes('admin') && <Link href="/admin/education">Admin education</Link>}
        </div>
      </aside>
      <div>
        <header className="wtc-topbar">
          <span className="wtc-dim" style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase' }}>Teacher console</span>
          <div className="wtc-row">
            <StatusPill tone="gold">{user.displayName}</StatusPill>
            <form action={logoutAction}><CsrfField /><button className={buttonClasses('ghost')} style={{ padding: '8px 12px' }}>Logout</button></form>
          </div>
        </header>
        <main className="wtc-main">{children}</main>
      </div>
      <MobileNav items={TEACHER_NAV} />
    </div>
  );
}
