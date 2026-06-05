export interface NavItem {
  href: string;
  label: string;
  /** true => route is a guarded skeleton ("coming later"), shown with a marker in nav */
  soon?: boolean;
}

export const APP_NAV: NavItem[] = [
  { href: '/app', label: 'Overview' },
  { href: '/app/products', label: 'Products' },
  { href: '/app/bots', label: 'Bots' },
  { href: '/app/terminal', label: 'Axioma Terminal' },
  { href: '/app/indicators', label: 'TradingView Access' },
  { href: '/app/education', label: 'Education' },
  { href: '/app/billing', label: 'Billing' },
  { href: '/app/security', label: 'Security & Keys' },
  { href: '/app/support', label: 'Support' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/entitlements', label: 'Entitlements' },
  { href: '/admin/tradingview-access', label: 'TradingView Queue' },
  { href: '/admin/bots', label: 'Bots' },
  { href: '/admin/bots/config', label: 'Bot Defaults' },
  { href: '/admin/terminal', label: 'Terminal' },
  { href: '/admin/education', label: 'Education' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/audit-log', label: 'Audit Log' },
  { href: '/admin/system-health', label: 'System Health' },
];

export const TEACHER_NAV: NavItem[] = [
  { href: '/teacher', label: 'Overview' },
  { href: '/teacher/courses', label: 'Courses' },
  { href: '/teacher/materials', label: 'Materials' },
  { href: '/teacher/community', label: 'Community' },
  { href: '/teacher/students', label: 'Students' },
];

export const PUBLIC_NAV: NavItem[] = [
  { href: '/products', label: 'Products' },
  { href: '/products/terminal', label: 'Axioma' },
  { href: '/education', label: 'Education' },
  { href: '/pricing', label: 'Pricing' },
];
