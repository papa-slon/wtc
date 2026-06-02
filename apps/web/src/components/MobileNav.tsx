'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav';

/** Bottom navigation bar shown below 900px (where the sidenav is hidden). */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="wtc-mobile-nav" aria-label="Mobile navigation">
      {items.map((i) => {
        const active = pathname === i.href || (i.href !== '/app' && i.href !== '/admin' && pathname.startsWith(i.href));
        return (
          <Link key={i.href} href={i.href} className={active ? 'active' : undefined}>
            {i.label}
            {i.soon && <span className="wtc-dim" style={{ fontSize: 9, marginLeft: 4, letterSpacing: '.06em' }}>soon</span>}
          </Link>
        );
      })}
    </nav>
  );
}
