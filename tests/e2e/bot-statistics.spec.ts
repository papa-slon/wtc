import { test, expect, type Page } from '@playwright/test';
import { loginUser } from './helpers/auth';

const shot = (slug: string, project: string) => `tests/e2e/screenshots/${slug}-${project}.png`;

async function expectNoHScroll(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const de = document.documentElement;
    const offenders = Array.from(document.querySelectorAll('body *'))
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          cls: typeof el.className === 'string' ? el.className : '',
          text: (el.textContent ?? '').replace(/\s+/g, ' ').slice(0, 80),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((box) => box.visible && box.right > de.clientWidth + 1)
      .slice(0, 8);
    return { ok: de.scrollWidth <= de.clientWidth + 1, scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, offenders };
  });
  expect(result.ok, `${label} scrolls horizontally: ${JSON.stringify(result)}`).toBe(true);
}

// The premium statistics terminal reads LIVE data (Tortila journal / Legacy
// reconstructed shim). The bot-admin-e2e gate runs with BOT_ADAPTER_MODE=mock and
// no journal env, so BOTH bots fail closed to the HONEST not-configured fallback —
// never a fabricated $0 account. These specs assert that premium shell + fallback,
// and that the deleted "Codex" audit panels are gone for good.
const DELETED_CODEX_PANELS = [
  'Portfolio snapshot',
  'Statistics continuity monitor',
  'Statistics operation map',
  'Statistics evidence ladder',
  'Statistics command center',
  'Admin mirror',
  'Live boundary',
];

async function expectStatisticsShell(page: Page, label: string) {
  // Premium page heading + two-bot selector (each strategy keeps its own terminal).
  await expect(page.getByRole('heading', { name: 'Trading bot performance' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Tortila Bot' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Legacy Bot' })).toBeVisible();

  // The cluttered audit panels the redesign deleted must not reappear.
  for (const ghost of DELETED_CODEX_PANELS) {
    await expect(page.getByText(ghost)).toHaveCount(0);
  }

  // Read-only terminal: no live-control theatre, no fake connection claims.
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  await expect(page.getByText('Start bot')).toHaveCount(0);
  await expect(page.getByText('Stop bot')).toHaveCount(0);

  await expectNoHScroll(page, label);
}

test('Tortila statistics render an honest not-configured terminal in mock mode (no fabricated $0)', async ({ page }, info) => {
  await loginUser(page);

  await page.goto('/app/bots/statistics?bot=tortila');
  await expectStatisticsShell(page, '/app/bots/statistics?bot=tortila');
  await expect(page.getByRole('link', { name: 'Tortila Bot' })).toHaveAttribute('aria-current', 'page');

  // Exactly one mode chip + one health chip — no evidence ladder of statuses.
  await expect(page.locator('.wtc-pill', { hasText: 'mode n/a' })).toBeVisible();
  await expect(page.locator('.wtc-pill', { hasText: 'Setup needed' })).toBeVisible();

  // Honest fallback: mock mode never contacts the journal, and the dashboard refuses
  // to fabricate a live $0 account or stale positions.
  await expect(page.getByRole('heading', { name: 'Live data unavailable' })).toBeVisible();
  await expect(page.getByText('Live data source not configured')).toBeVisible();
  await expect(page.getByText('BOT_ADAPTER_MODE is mock')).toBeVisible();
  await expect(page.getByText('No live numbers to show')).toBeVisible();
  await expect(page.getByText('never fabricates a $0 account or stale positions')).toBeVisible();

  // None of the premium dashboard money panels render without live data.
  await expect(page.getByText('Net PnL after fees')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Equity curve', exact: true })).toHaveCount(0);

  // Read-only navigation only (Settings + Backtester for Tortila).
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Backtester' })).toBeVisible();

  await page.screenshot({ path: shot('bot-statistics-tortila-dedicated', info.project.name), fullPage: true });
});

test('Legacy statistics render the reconstructed-DCA fallback without fabricated closed-trade history', async ({ page }, info) => {
  await loginUser(page);

  await page.goto('/app/bots/statistics?bot=legacy');
  await expectStatisticsShell(page, '/app/bots/statistics?bot=legacy');
  await expect(page.getByRole('link', { name: 'Legacy Bot' })).toHaveAttribute('aria-current', 'page');

  // Reconstructed-mode chip (gold) + one health chip. The mode label is RECON,
  // never a fabricated DEMO/LIVE.
  await expect(page.locator('.wtc-pill.gold', { hasText: 'RECON' })).toBeVisible();
  await expect(page.locator('.wtc-pill', { hasText: 'Setup needed' })).toBeVisible();

  // Honest reconstructed fallback — never a wallet equity, $0 account, or placeholder
  // positions, and never a fabricated closed-trade history.
  await expect(page.getByRole('heading', { name: 'Legacy Bot reconstructed view' })).toBeVisible();
  await expect(page.getByText('Reconstructed data source not configured')).toBeVisible();
  await expect(page.getByText('BOT_ADAPTER_MODE is mock')).toBeVisible();
  await expect(page.getByText('No reconstructed numbers to show')).toBeVisible();
  await expect(page.getByText('never fabricates a $0 account or placeholder positions')).toBeVisible();

  // The reconstructed DCA terminal sections only render with live data; in mock mode
  // no reconstructed PnL, equity curve, wallet equity, or win-rate is shown.
  await expect(page.getByText('Reconstructed net PnL')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Equity curve', exact: true })).toHaveCount(0);
  await expect(page.getByText('Net PnL after fees')).toHaveCount(0);

  await page.screenshot({ path: shot('bot-statistics-legacy-dedicated', info.project.name), fullPage: true });
});
