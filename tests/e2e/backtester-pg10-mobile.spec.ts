import { test, expect, type Page } from '@playwright/test';
import { loginUser } from './helpers/auth';

async function noHScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth <= de.clientWidth + 1;
  });
}

test('PG10: Tortila backtester exposes the local-runner download at 375px', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'PG10 375px checks run once, in the mobile project.');
  await page.setViewportSize({ width: 375, height: 812 });
  await loginUser(page);

  await page.goto('/app/bots/tortila/backtester');
  await expect(page.getByRole('heading', { name: /download local backtester/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /download local runner/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /download current config/i })).toBeVisible();
  await expect(page.getByText(/results stay local/i)).toBeVisible();
  expect(await noHScroll(page), 'tortila backtester scrolls horizontally at 375px').toBe(true);
  await page.screenshot({ path: 'tests/e2e/screenshots/backtester-tortila-mobile375.png', fullPage: true });
});

test('PG10: Legacy backtester is a permanent product-boundary card at 375px', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'PG10 375px checks run once, in the mobile project.');
  await page.setViewportSize({ width: 375, height: 812 });
  await loginUser(page);

  await page.goto('/app/bots/legacy/backtester');
  await expect(page.getByText(/does not have a backtester/i)).toBeVisible();
  expect(await noHScroll(page), 'legacy backtester scrolls horizontally at 375px').toBe(true);
  await page.screenshot({ path: 'tests/e2e/screenshots/backtester-legacy-mobile375.png', fullPage: true });
});
