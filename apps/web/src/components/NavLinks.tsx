'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav';

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== '/app' && item.href !== '/admin' && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href} className={active ? 'active' : undefined}>
            {item.label}
            {item.soon && <span className="wtc-dim" style={{ fontSize: 10, marginLeft: 6, letterSpacing: '.08em' }}>soon</span>}
          </Link>
        );
      })}
    </>
  );
}
