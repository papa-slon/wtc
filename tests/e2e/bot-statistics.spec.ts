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

async function expectStatisticsShell(page: Page, label: string) {
  await expect(page.getByRole('heading', { name: 'Trading bot performance' })).toBeVisible();
  await expect(page.getByText('Portfolio snapshot')).toBeVisible();
  await expect(page.getByText('Statistics continuity monitor')).toBeVisible();
  await expect(page.getByText('Statistics operation map')).toBeVisible();
  await expect(page.getByText('Statistics evidence ladder')).toBeVisible();
  await expect(page.getByText('Statistics command center')).toBeVisible();
  await expect(page.getByText('Admin mirror')).toBeVisible();
  await expect(page.getByText('Live boundary')).toBeVisible();
  expect(await page.getByText('live control disabled').count(), `${label} must show live-control disabled copy`).toBeGreaterThan(0);
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  await expect(page.getByText('Start bot')).toHaveCount(0);
  await expectNoHScroll(page, label);
}

test('Tortila statistics render complete read-only performance evidence', async ({ page }, info) => {
  await loginUser(page);

  await page.goto('/app/bots/statistics?bot=tortila');
  await expectStatisticsShell(page, '/app/bots/statistics?bot=tortila');
  await expect(page.getByRole('heading', { name: 'Tortila Bot' })).toBeVisible();
  await expect(page.getByText('Net PnL after fees')).toBeVisible();
  await expect(page.getByText('Win rate', { exact: true })).toBeVisible();
  await expect(page.getByText('Profit factor', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Equity curve', exact: true })).toBeVisible();
  await expect(page.getByText('Performance diagnostics')).toBeVisible();
  await expect(page.getByText('Tortila journal confidence')).toBeVisible();
  await expect(page.getByText('Persisted journal source')).toBeVisible();
  await expect(page.getByText('no exchange or /api/marks probe')).toBeVisible();
  await expect(page.getByText('computed only from persisted WTC journal snapshots')).toBeVisible();
  await expect(page.getByText('Monthly returns')).toBeVisible();
  await expect(page.getByText('Symbol contribution')).toBeVisible();
  await expect(page.getByText('Open risk exposure')).toBeVisible();
  await expect(page.getByText('closed trade imports pending')).toHaveCount(0);
  await expect(page.getByText('Legacy closed-trade history pending')).toHaveCount(0);
  await page.screenshot({ path: shot('bot-statistics-tortila-dedicated', info.project.name), fullPage: true });
});

test('Legacy statistics preserve operational evidence without fabricated closed-trade history', async ({ page }, info) => {
  await loginUser(page);

  await page.goto('/app/bots/statistics?bot=legacy');
  await expectStatisticsShell(page, '/app/bots/statistics?bot=legacy');
  await expect(page.getByRole('heading', { name: 'Legacy Bot' })).toBeVisible();
  await expect(page.getByText('Legacy operations')).toBeVisible();
  await expect(page.getByText('Legacy statistics cockpit')).toBeVisible();
  await expect(page.getByText('Averaging bot configuration coverage')).toBeVisible();
  await expect(page.getByText('Provider pub_id', { exact: true })).toBeVisible();
  await expect(page.getByText('closed trade imports pending')).toBeVisible();
  await expect(page.getByText('Source-proof gate')).toBeVisible();
  await expect(page.getByText('pending import')).toBeVisible();
  await expect(page.getByText('closed trades pending')).toBeVisible();
  await expect(page.getByText('PF, win rate, realized PnL pending')).toBeVisible();
  await expect(page.getByText('Legacy closed-trade history pending')).toBeVisible();
  await expect(page.getByText('Win rate, profit factor, realized PnL, and attribution stay hidden')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Equity curve', exact: true })).toHaveCount(0);
  await expect(page.getByText('Net PnL after fees')).toHaveCount(0);
  await page.screenshot({ path: shot('bot-statistics-legacy-dedicated', info.project.name), fullPage: true });
});
