import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loginAs } from './helpers/auth';

test.skip(
  process.env.ADMIN_USER_BOTS_E2E !== '1' || process.env.ADMIN_USER_BOTS_E2E_USER_ROUTES !== '1',
  'DB-backed user bot route acceptance is opt-in via npm run e2e:admin-user-bots:db:user-routes.',
);
test.describe.configure({ mode: 'serial' });

const marker = JSON.parse(readFileSync('.next-e2e-admin-user-bots/admin-user-bots-e2e-prepared.json', 'utf8')) as {
  userAId?: string;
  userRoutes?: boolean;
};

const shot = (name: string, project: string) => `tests/e2e/screenshots/${name}-${project}.png`;

const HIDDEN_MARKERS = [
  'USER_ROUTE_RAW_CONFIG_SHOULD_NOT_RENDER',
  'USER_ROUTE_HISTORY_CONFIG_SHOULD_NOT_RENDER',
  'USER_ROUTE_RAW_TRADE_SHOULD_NOT_RENDER',
  'USER_A_TORTILA_RAW_TRADE_SHOULD_NOT_RENDER',
  'USER_A_RAW_CONFIG_SHOULD_NOT_RENDER',
  'USER_A_HISTORY_CONFIG_SHOULD_NOT_RENDER',
  'USER_A_SEALED_SECRET_SHOULD_NOT_RENDER',
  'key-user-a-secret-should-not-render',
  'TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER',
  'WORKER_SECRET_MARKER_SHOULD_NOT_RENDER',
  'passwordHash',
  'apiSecret',
  'apiKey',
  'sealed',
  'token=',
  '99,999.99',
  '99999.99',
  '$8,888.88',
  '8,888.88',
  '8888.88',
] as const;

function expectNoLeakInText(text: string, markers: readonly string[]): void {
  for (const markerText of markers) {
    expect(text).not.toContain(markerText);
    expect(text).not.toContain(Buffer.from(markerText, 'utf8').toString('base64'));
  }
}

async function visibleBody(page: Page): Promise<string> {
  return page.locator('body').innerText();
}

async function expectNoHScroll(page: Page, label: string): Promise<void> {
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(noHScroll, `${label} scrolls horizontally`).toBe(true);
}

async function expectNeutralNaCell(cell: Locator, label: string): Promise<void> {
  await expect(cell, `${label} should render N/A`).toHaveText('N/A');
  await expect(cell, `${label} should not use profit/loss tone`).not.toHaveClass(/wtc-up|wtc-down/);
}

async function expectDashboardPositionNa(page: Page): Promise<void> {
  const row = page.locator('tbody tr').filter({ hasText: 'USER_ROUTE_TORTILA_POSITION' });
  await expect(row).toHaveCount(1);
  await expectNeutralNaCell(row.locator('td[data-label="Mark"]'), 'dashboard Mark');
  await expectNeutralNaCell(row.locator('td[data-label="uPnL"]'), 'dashboard uPnL');
}

async function expectPositionsPageNa(page: Page): Promise<void> {
  const row = page.locator('tbody tr').filter({ hasText: 'USER_ROUTE_TORTILA_POSITION' });
  await expect(row).toHaveCount(1);
  await expectNeutralNaCell(row.locator('td').nth(4), 'positions Mark');
  await expectNeutralNaCell(row.locator('td').nth(5), 'positions uPnL');
}

async function expectStatisticsPositionNa(page: Page): Promise<void> {
  const row = page.locator('tbody tr').filter({ hasText: 'USER_ROUTE_TORTILA_POSITION' }).filter({ has: page.locator('td[data-label="Mark"]') });
  await expect(row).toHaveCount(1);
  await expectNeutralNaCell(row.locator('td[data-label="Mark"]'), 'statistics Mark');
  await expectNeutralNaCell(row.locator('td[data-label="uPnL"]'), 'statistics uPnL');
}

test('DB-backed current-user Tortila routes render Mark/uPnL unavailable without live marks calls or leaks', async ({ page }, info) => {
  expect(marker.userAId, 'prepared selected user id').toBeTruthy();
  expect(marker.userRoutes, 'prepared fixture is in user-route mode').toBe(true);

  const requestedUrls: string[] = [];
  page.on('request', (request) => requestedUrls.push(request.url()));

  await loginAs(page, 'admin-drilldown-a@wtc.local');

  await test.step('dashboard route', async () => {
    await page.goto('/app/bots/tortila');
    await expect(page.getByRole('heading', { name: 'Tortila Bot' })).toBeVisible();
    await expect(page.getByText('Mark and uPnL unavailable')).toBeVisible();
    await expect(page.getByText('WTC does not call /api/marks or a live exchange to fill Mark and uPnL.')).toBeVisible();
    await expect(page.getByText('USER_ROUTE_TORTILA_CONFIG_SYMBOL')).toBeVisible();
    await expectDashboardPositionNa(page);
    await expect(page.getByRole('button', { name: 'Start bot (disabled)' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Stop bot (disabled)' })).toBeDisabled();
    expectNoLeakInText(await visibleBody(page), HIDDEN_MARKERS);
    await expectNoHScroll(page, '/app/bots/tortila');
  });

  await test.step('positions route', async () => {
    await page.goto('/app/bots/tortila/positions');
    await expect(page.getByRole('heading', { name: 'Open positions', exact: true })).toBeVisible();
    await expect(page.getByText('Mark and uPnL unavailable')).toBeVisible();
    await expectPositionsPageNa(page);
    expectNoLeakInText(await visibleBody(page), HIDDEN_MARKERS);
    await expectNoHScroll(page, '/app/bots/tortila/positions');
  });

  await test.step('statistics route', async () => {
    await page.goto('/app/bots/statistics?bot=tortila');
    await expect(page.getByRole('heading', { name: 'Trading bot performance' })).toBeVisible();
    await expect(page.getByText('Tortila journal confidence')).toBeVisible();
    await expectStatisticsPositionNa(page);
    expectNoLeakInText(await visibleBody(page), HIDDEN_MARKERS);
    await expectNoHScroll(page, '/app/bots/statistics?bot=tortila');
  });

  expect(requestedUrls.filter((url) => url.includes('/api/marks'))).toEqual([]);
  await page.screenshot({ path: shot('user-bot-routes-db', info.project.name), fullPage: true });
});
