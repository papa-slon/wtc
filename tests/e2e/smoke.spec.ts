import { test, expect } from '@playwright/test';
import { loginAdmin, loginTeacher, loginUser } from './helpers/auth';

const shot = (name: string, project: string) => `tests/e2e/screenshots/${name}-${project}.png`;

test('public landing renders', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Every')).toBeVisible();
  await page.screenshot({ path: shot('landing', info.project.name), fullPage: true });
});

test('pricing renders', async ({ page }, info) => {
  await page.goto('/pricing');
  await expect(page.getByText('Plans & bundles')).toBeVisible();
  await page.screenshot({ path: shot('pricing', info.project.name), fullPage: true });
});

test('/products/legacy-bot renders (slug matches SITEMAP)', async ({ page }) => {
  const res = await page.goto('/products/legacy-bot');
  expect(res?.status()).toBeLessThan(400); // not a 404
  await expect(page.getByRole('heading', { name: 'Legacy Bot' })).toBeVisible();
});

test('user dashboard, bot warnings, terminal, security', async ({ page }, info) => {
  await loginUser(page);
  await expect(page.getByRole('heading', { name: 'Account overview' })).toBeVisible();
  await page.screenshot({ path: shot('app-overview', info.project.name), fullPage: true });

  await page.goto('/app/bots/tortila');
  await expect(page.getByText('Continuity monitor')).toBeVisible();
  await expect(page.getByText('Silent-stop guard')).toBeVisible();
  await expect(page.getByText('Runtime evidence ladder')).toBeVisible();
  await expect(page.getByText('Runtime status notes')).toBeVisible(); // warnings are first-class
  await expect(page.getByText('TP reconciliation / restore not implemented')).toBeVisible();
  await page.screenshot({ path: shot('bot-tortila', info.project.name), fullPage: true });

  await page.goto('/app/terminal');
  await expect(page.getByRole('heading', { name: 'Axioma Terminal' })).toBeVisible();
  await page.screenshot({ path: shot('axioma-terminal', info.project.name), fullPage: true });

  await page.goto('/app/security');
  await expect(page.getByRole('heading', { name: 'Exchange keys & security' })).toBeVisible();
  await page.screenshot({ path: shot('security', info.project.name), fullPage: true });
});

test('admin console', async ({ page }, info) => {
  await loginAdmin(page);
  await page.goto('/admin/entitlements');
  await expect(page.getByRole('heading', { name: 'Entitlements' })).toBeVisible();
  await page.screenshot({ path: shot('admin-entitlements', info.project.name), fullPage: true });

  await page.goto('/admin/tradingview-access');
  await expect(page.getByRole('heading', { name: 'TradingView access queue' })).toBeVisible();
  // Phase 2.3: admin TV page now uses loadTvAdminData() from features/tv/queries which returns
  // empty list in demo mode (no DATABASE_URL in e2e). Prior assertion ('demo_trader_99' from
  // in-memory backend) is no longer valid. Assert queue heading + manual-first copy instead.
  await expect(page.getByText('Manual grant/revoke only')).toBeVisible();
  await page.screenshot({ path: shot('admin-tradingview', info.project.name), fullPage: true });
});

test('user: indicators + education pages render (memory backend)', async ({ page }) => {
  await loginUser(page);
  await page.goto('/app/indicators');
  await expect(page.getByRole('heading', { name: 'Indicator access' })).toBeVisible();
  // Phase 2.3: the indicators page now renders 'storage: in-memory (demo)' (was 'in-memory (dev)')
  await expect(page.getByText('storage: in-memory (demo)')).toBeVisible(); // memory fallback badge (no DATABASE_URL in e2e)
  await page.goto('/app/education');
  await expect(page.getByRole('heading', { name: 'Lessons & materials' })).toBeVisible();
  await expect(page.getByText('Risk Management Fundamentals')).toBeVisible(); // seeded published course
});

test('teacher: course console renders the teacher\'s course', async ({ page }) => {
  await loginTeacher(page);
  await page.goto('/teacher');
  await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible();
  await expect(page.getByText('Risk Management Fundamentals')).toBeVisible(); // teacher's seeded course
});

test('Phase 2.2 LMS surfaces render (teacher courses, student course detail, admin education)', async ({ page }, info) => {
  // Teacher: full courses surface + create form (real route, not a placeholder)
  await loginTeacher(page);
  await page.goto('/teacher/courses');
  await expect(page.getByRole('heading', { name: 'Courses', exact: true })).toBeVisible();
  await expect(page.getByText('Create a course')).toBeVisible();
  await page.screenshot({ path: shot('teacher-courses', info.project.name), fullPage: true });

  // Student: catalogue → open a DB-backed course detail (renders the honest demo state in memory mode)
  await loginUser(page);
  await page.goto('/app/education');
  await page.getByRole('link', { name: 'Open course →' }).first().click();
  await expect(page.getByText('storage: in-memory (demo)')).toBeVisible(); // honest demo label, no DATABASE_URL in e2e

  // Admin: education moderation (real route, admin-only)
  await loginAdmin(page);
  await page.goto('/admin/education');
  await expect(page.getByRole('heading', { name: 'Education moderation' })).toBeVisible();
});

test('bot dashboard sub-tabs render with unified analytics (Tortila)', async ({ page }, info) => {
  await loginUser(page);

  // Unified/combined analytics on the bots list (Part 4)
  await page.goto('/app/bots');
  await expect(page.getByText('Two-bot finish board')).toBeVisible();
  await expect(page.getByText('Tortila finish path')).toBeVisible();
  await expect(page.getByText('Legacy finish path')).toBeVisible();
  await expect(page.getByText('Live controls disabled')).toBeVisible();
  await expect(page.getByText('settings editor')).toBeVisible();
  await expect(page.getByText('readiness dashboard')).toBeVisible();
  await expect(page.getByText('statistics cockpit')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review Tortila Turtle settings' })).toHaveAttribute('href', '/app/bots/tortila/settings');
  await expect(page.getByRole('link', { name: 'Configure Legacy averaging' })).toHaveAttribute('href', '/app/bots/legacy/settings');
  await expect(page.getByRole('link', { name: 'Open Tortila Bot statistics' })).toHaveAttribute('href', '/app/bots/statistics?bot=tortila');
  await expect(page.getByRole('link', { name: 'Open Legacy Bot statistics' })).toHaveAttribute('href', '/app/bots/statistics?bot=legacy');
  await expect(page.getByRole('link', { name: 'Open setup review' }).first()).toHaveAttribute('href', '/app/bots/tortila/setup?step=key');
  await expect(page.getByRole('link', { name: 'Open setup review' }).nth(1)).toHaveAttribute('href', '/app/bots/legacy/setup?step=strategy');
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  await expect(page.getByText(/startBot|stopBot|applyConfig/)).toHaveCount(0);
  await expect(page.getByText('Combined portfolio (entitled bots)')).toBeVisible();
  await expect(page.getByText('Total wallet equity')).toBeVisible();
  // Legacy onboarding now uses the existing provider pub_id runtime instead of collecting WTC keys.
  await expect(page.getByText('Limited data - trade history and equity curve are not available for this bot.')).toBeVisible();
  await page.screenshot({ path: shot('bots-combined', info.project.name), fullPage: true });

  // Positions sub-tab (read-only, mock) — a real position row, not a placeholder
  await page.goto('/app/bots/tortila/positions');
  await expect(page.getByRole('heading', { name: 'Open positions', exact: true })).toBeVisible();
  await expect(page.getByText('NEAR-USDT')).toBeVisible();

  await page.goto('/app/bots/statistics?bot=tortila');
  await expect(page.getByRole('heading', { name: 'Trading bot performance' })).toBeVisible();
  // Premium statistics terminal: in mock mode the journal is not contacted, so the page renders
  // the honest not-configured fallback. The deleted Codex audit panels must stay gone.
  await expect(page.getByText('No live numbers to show')).toBeVisible();
  await expect(page.getByText('never fabricates a $0 account or stale positions')).toBeVisible();
  await expect(page.getByText('Portfolio snapshot')).toHaveCount(0);
  await expect(page.getByText('Statistics continuity monitor')).toHaveCount(0);
  await page.screenshot({ path: shot('bot-statistics-journal', info.project.name), fullPage: true });

  await page.goto('/app/bots/statistics?bot=legacy');
  await expect(page.getByRole('heading', { name: 'Trading bot performance' })).toBeVisible();
  await expect(page.getByText('No reconstructed numbers to show')).toBeVisible();
  await expect(page.getByText('never fabricates a $0 account or placeholder positions')).toBeVisible();

  // Trades sub-tab — net-of-fees metric is present (fees never hidden)
  await page.goto('/app/bots/tortila/trades');
  await expect(page.getByRole('heading', { name: 'Closed trades', exact: true })).toBeVisible();
  await expect(page.getByText('Net PnL (after fees)')).toBeVisible();

  // Equity sub-tab — ROI-since-start metric (GAP-B) present
  await page.goto('/app/bots/tortila/equity');
  await expect(page.getByRole('heading', { name: 'Equity & drawdown', exact: true })).toBeVisible();
  await expect(page.getByText('ROI since start')).toBeVisible();

  // Safety sub-tab — known P0 risk warning is first-class, never hidden
  await page.goto('/app/bots/tortila/safety');
  await expect(page.getByRole('heading', { name: 'Safety & risk events', exact: true })).toBeVisible();
  await expect(page.getByText('Safety continuity monitor')).toBeVisible();
  await expect(page.getByText('TP reconciliation / restore not implemented')).toBeVisible();
  await page.screenshot({ path: shot('bot-tortila-safety', info.project.name), fullPage: true });

  await page.goto('/app/bots/tortila/journal');
  await expect(page.getByRole('heading', { name: 'Trade review journal' })).toBeVisible();
  await expect(page.getByText('Review queue')).toBeVisible();
  await expect(page.getByText('Using latest adapter trades')).toBeVisible();
  await expect(page.getByText('Save review').first()).toBeVisible();
  await page.screenshot({ path: shot('bot-tortila-journal', info.project.name), fullPage: true });
});

// ============================= Phase 2.3 new surfaces =============================

test('Phase 2.3 billing page: product-access timeline section + mock-checkout label', async ({ page }, info) => {
  await loginUser(page);
  await page.goto('/app/billing');
  // Timeline section present
  await expect(page.getByText('Access event timeline')).toBeVisible();
  // Mock checkout is labelled dev-only — never a real Stripe flow
  await expect(page.getByText(/Mock checkout.*hard disabled in production/)).toBeVisible();
  await page.screenshot({ path: shot('billing', info.project.name), fullPage: true });
});

test('Phase 2.3 admin pages: users list + system health safety states + support triage', async ({ page }, info) => {
  await loginAdmin(page);

  // Admin users — renders (real-or-demo)
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'User directory' })).toBeVisible();
  await expect(page.getByText('Bot owner selector')).toBeVisible();
  await expect(page.getByPlaceholder('email, name, user id, masked pub_id')).toBeVisible();
  await expect(page.getByText('Selected-user inspection only')).toBeVisible();
  await expect(page.getByText('Results open read-only user settings and statistics')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Global defaults' })).toHaveAttribute('href', '/admin/bots/config');
  await page.getByPlaceholder('email, name, user id, masked pub_id').fill('user');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/admin\/users\?q=user/);
  await expect(page.getByText('Bot owner selector')).toBeVisible();
  // Storage pill is present (postgres or demo)
  await expect(page.getByText(/storage:/)).toBeVisible();
  await page.screenshot({ path: shot('admin-users', info.project.name), fullPage: true });

  // Admin system-health — backend-mode + safety-disabled states always visible
  await page.goto('/admin/system-health');
  await expect(page.getByRole('heading', { name: 'System health' })).toBeVisible();
  // Safety-disabled states must be surfaced
  await expect(page.getByText('Live bot control')).toBeVisible();
  await expect(page.getByText('TradingView automation')).toBeVisible();
  // DISABLED pills are present (policy always disables both)
  await expect(page.getByText('DISABLED').first()).toBeVisible();
  await page.screenshot({ path: shot('admin-system-health', info.project.name), fullPage: true });

  // Admin support triage
  await page.goto('/admin/support');
  await expect(page.getByRole('heading', { name: 'Support ticket triage' })).toBeVisible();
  // Storage pill present
  await expect(page.getByText(/storage:/)).toBeVisible();
  await page.screenshot({ path: shot('admin-support', info.project.name), fullPage: true });
});

test('Phase 2.3 TV admin queue + user indicator: manual-first copy', async ({ page }, info) => {
  // Admin TV: manual-first copy present; queue renders (empty in demo mode)
  await loginAdmin(page);
  await page.goto('/admin/tradingview-access');
  await expect(page.getByRole('heading', { name: 'TradingView access queue' })).toBeVisible();
  await expect(page.getByText('Manual grant/revoke only')).toBeVisible();
  // Storage pill present (demo mode in e2e)
  await expect(page.getByText(/storage:/)).toBeVisible();
  await page.screenshot({ path: shot('admin-tv-phase23', info.project.name), fullPage: true });

  // User indicators: manual-first copy visible; status section renders
  await loginUser(page);
  await page.goto('/app/indicators');
  await expect(page.getByRole('heading', { name: 'Indicator access' })).toBeVisible();
  await expect(page.getByText('granted manually by an admin').first()).toBeVisible();
  await page.screenshot({ path: shot('indicators-phase23', info.project.name), fullPage: true });
});

test('Phase 2.3 terminal page: hard-boundary callout + DISABLED dev-placeholder buttons', async ({ page }, info) => {
  await loginUser(page);
  await page.goto('/app/terminal');
  await expect(page.getByRole('heading', { name: 'Axioma Terminal' })).toBeVisible();

  // Hard boundary callout — always visible, non-dismissible
  await expect(page.getByText('WTC never gates your local Axioma order execution')).toBeVisible();

  // Storage mode pill (demo in e2e — no DATABASE_URL)
  await expect(page.getByText('storage: in-memory (demo)')).toBeVisible();

  // The Download button must be present and disabled in dev mode
  const downloadBtn = page.getByRole('button', { name: /dev placeholder/ }).first();
  await expect(downloadBtn).toBeVisible();
  await expect(downloadBtn).toBeDisabled();

  await page.screenshot({ path: shot('terminal-phase23', info.project.name), fullPage: true });
});

test('Phase 2.3 no live-control buttons enabled on bot pages', async ({ page }, info) => {
  await loginUser(page);
  await page.goto('/app/bots/tortila');

  // The premium bot room replaced the old Start/Stop (disabled) buttons with a single disabled
  // "Start bot unavailable" control + a "live start disabled" pill and a read-only live-actions metric.
  await expect(page.getByRole('button', { name: 'Start bot unavailable' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start bot (disabled)' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop bot (disabled)' })).toHaveCount(0);
  await expect(page.getByText('live start disabled')).toBeVisible();
  await expect(page.getByText('read-only monitoring').first()).toBeVisible();
  await expect(page.getByText(/does not start, stop, apply config/)).toBeVisible();

  await page.screenshot({ path: shot('bot-controls-disabled', info.project.name), fullPage: true });
});

// ============================= Phase 2.4 new surfaces =============================

// E2E-29/30 (desktop + mobile): /admin/tradingview-access
// Grant form duration dropdown + revoke reason field present.
// In demo mode the queue is empty so we assert the form structure via the page text/copy.
test('Phase 2.4 E2E-29/30: admin TV access — grant form structure + copy visible', async ({ page }, info) => {
  await loginAdmin(page);
  await page.goto('/admin/tradingview-access');

  // Heading and manual-first copy (always visible regardless of queue state)
  await expect(page.getByRole('heading', { name: 'TradingView access queue' })).toBeVisible();
  await expect(page.getByText('Manual grant/revoke only')).toBeVisible();

  // Storage pill present (demo in e2e)
  await expect(page.getByText(/storage:/)).toBeVisible();

  // The queue EmptyState card renders when no requests exist
  await expect(page.getByText('Access request queue')).toBeVisible();
  await expect(page.getByText('Queue is empty')).toBeVisible();

  // Grant history card renders with its empty state
  // Card title includes "(tradingview_access_grants)" — assert the EmptyState inside the card
  await expect(page.getByText('No grants recorded yet')).toBeVisible();

  // Grant form instructions are embedded in the page copy (always visible in the SectionHeader)
  await expect(page.getByText('Access is granted by an admin')).toBeVisible();

  await page.screenshot({ path: shot('admin-tv-phase24', info.project.name), fullPage: true });
});

// E2E-31/32 (desktop + mobile): /app/bots/tortila — mock adapter pill + DISABLED controls
// Verifies: mock data pill present, Start/Stop disabled, no live-control buttons enabled.
// The mock adapter MUST NOT crash the page (AdapterNotReadyError would crash the real adapter's
// unmapped methods; mock implements all methods so this test passes in demo/mock mode).
test('Phase 2.4 E2E-31/32: bot/tortila renders with mock pill + Start/Stop DISABLED + no crash', async ({ page }, info) => {
  await loginUser(page);
  await page.goto('/app/bots/tortila');

  // Page rendered without crash — heading is present
  await expect(page.getByRole('heading', { name: 'Tortila Bot' })).toBeVisible();

  // Mock adapter mode pill is present and labelled "mock data"
  // (StatusPill renders adapter.mode + " data" when mode === 'mock')
  await expect(page.getByText('mock data').first()).toBeVisible();

  // Simulated-data card is shown when adapter.mode === 'mock'
  await expect(page.getByText('Simulated preview data')).toBeVisible();

  // P0/P1 risk warnings are always shown (never hidden behind a green card)
  await expect(page.getByText('Runtime status notes')).toBeVisible();
  await expect(page.getByText('TP reconciliation / restore not implemented')).toBeVisible();

  // The premium bot room replaced the old Start/Stop (disabled) buttons with a single disabled
  // "Start bot unavailable" control + a "live start disabled" pill and a read-only live-actions metric.
  await expect(page.getByRole('button', { name: 'Start bot unavailable' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start bot (disabled)' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stop bot (disabled)' })).toHaveCount(0);
  await expect(page.getByText('live start disabled')).toBeVisible();
  await expect(page.getByText('read-only monitoring').first()).toBeVisible();
  await expect(page.getByText(/does not start, stop, apply config/)).toBeVisible();

  await page.screenshot({ path: shot('bot-tortila-phase24', info.project.name), fullPage: true });
});

// E2E-33/34 (desktop + mobile): /admin/entitlements/review — manual review queue card present
// In demo mode the page renders the demo EmptyState (no pending items in memory).
// The page heading and demo-mode copy must be present regardless.
test('Phase 2.4 E2E-33/34: admin entitlements review queue renders + demo-mode copy visible', async ({ page }, info) => {
  await loginAdmin(page);
  await page.goto('/admin/entitlements/review');

  // Heading always present
  await expect(page.getByRole('heading', { name: 'Billing manual-review queue' })).toBeVisible();

  // Page copy describing the queue purpose is always visible
  await expect(page.getByText('Webhook events that could not be automatically applied')).toBeVisible();

  // Storage pill present (demo in e2e — no DATABASE_URL)
  await expect(page.getByText(/storage:/)).toBeVisible();

  // In demo mode: the demo EmptyState is shown (not a crash, not a missing heading)
  // "Demo mode — no review items" or "No pending items" will be visible depending on mode
  const demoOrEmpty = page.getByText(/Demo mode|No pending items/);
  await expect(demoOrEmpty.first()).toBeVisible();

  // Verify NO live-control buttons are present on this admin page
  // (entitlement grants here are audited manual actions, not auto-buttons)
  const liveControlBtn = page.getByRole('button', { name: /Start bot|Stop bot/ });
  await expect(liveControlBtn).toHaveCount(0);

  await page.screenshot({ path: shot('admin-entitlements-review-phase24', info.project.name), fullPage: true });
});
