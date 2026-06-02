import { test, expect } from '@playwright/test';
import { loginAdmin } from './helpers/auth';

/**
 * Phase 2.11 / PG8 — Admin console mobile-readability acceptance (375px).
 *
 * The orchestrator criterion is "no 375px horizontal scroll across the admin console". The shared
 * mobile project is 390px, so this spec resizes to EXACTLY 375px (iPhone-SE width) and runs once
 * (scoped to the mobile project). For every admin page it asserts: (1) the page rendered, (2) the
 * admin MobileNav is visible (the sidenav is display:none below 900px — without this, mobile admins
 * were stranded), (3) an honest storage pill is present, and (4) the document does not scroll
 * horizontally. Honest caveat: e2e runs in demo mode (no DATABASE_URL) so the tables render their
 * EmptyState — the table card-stack with real rows is guarded statically by
 * tests/integration/admin-responsive.test.ts (every table wrapped) + the §14 CSS. This spec proves
 * the shell, nav, pills, banners, metric rows and empty states all fit 375px.
 */

const shot = (slug: string) => `tests/e2e/screenshots/${slug}-mobile375.png`;

const ADMIN_PAGES: { path: string; heading: string; slug: string }[] = [
  { path: '/admin', heading: 'System overview', slug: 'admin-overview' },
  { path: '/admin/users', heading: 'User directory', slug: 'admin-users' },
  { path: '/admin/products', heading: 'Products & plans', slug: 'admin-products' },
  { path: '/admin/entitlements', heading: 'Entitlements', slug: 'admin-entitlements' },
  { path: '/admin/entitlements/review', heading: 'Billing manual-review queue', slug: 'admin-review' },
  { path: '/admin/tradingview-access', heading: 'TradingView access queue', slug: 'admin-tv' },
  { path: '/admin/bots', heading: 'Bot fleet', slug: 'admin-bots' },
  { path: '/admin/terminal', heading: 'Terminal releases', slug: 'admin-terminal' },
  { path: '/admin/education', heading: 'Education moderation', slug: 'admin-education' },
  { path: '/admin/system-health', heading: 'System health', slug: 'admin-system-health' },
  { path: '/admin/support', heading: 'Support ticket triage', slug: 'admin-support' },
  { path: '/admin/audit-log', heading: 'Audit log', slug: 'admin-audit-log' },
];

test('PG8: admin console is mobile-readable at 375px (no h-scroll + mobile nav + storage pill)', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'PG8 375px checks run once, in the mobile project.');
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAdmin(page);

  for (const { path, heading, slug } of ADMIN_PAGES) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();

    // (2) Admin mobile navigation is present (the sidenav is hidden below 900px).
    await expect(page.locator('.wtc-mobile-nav')).toBeVisible();

    // (3) Honest storage/state pill present on every admin page.
    await expect(page.getByText(/storage:/).first()).toBeVisible();

    // (4) No horizontal page scroll at 375px — the core PG8 acceptance criterion.
    const noHScroll = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth <= de.clientWidth + 1;
    });
    expect(noHScroll, `${path} scrolls horizontally at 375px`).toBe(true);

    await page.screenshot({ path: shot(slug), fullPage: true });
  }
});
