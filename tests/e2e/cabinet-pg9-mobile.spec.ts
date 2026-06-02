import { test, expect, type Page } from '@playwright/test';
import { loginUser } from './helpers/auth';

const shot = (slug: string) => `tests/e2e/screenshots/${slug}-mobile375.png`;

async function noHScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth <= de.clientWidth + 1;
  });
}

test('PG9: cabinet per-product cards are mobile-readable + honest at 375px', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'PG9 375px checks run once, in the mobile project.');
  await page.setViewportSize({ width: 375, height: 812 });
  await loginUser(page);

  await expect(page.getByRole('heading', { name: 'Account overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your products' })).toBeVisible();
  await expect(page.getByText('storage: in-memory (demo)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Finish setup' })).toBeVisible();
  await expect(page.getByText('Blocked (B3)')).toBeVisible();
  await expect(page.getByText('Blocked (B4)')).toBeVisible();
  await expect(page.getByText('Coming soon')).toBeVisible();

  expect(await noHScroll(page), '/app cabinet scrolls horizontally at 375px').toBe(true);
  await page.screenshot({ path: shot('cabinet-overview'), fullPage: true });
});

test('PG9: bot setup wizard renders a mobile stepper at 375px (navigation-only)', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'PG9 375px checks run once, in the mobile project.');
  await page.setViewportSize({ width: 375, height: 812 });
  await loginUser(page);

  await page.goto('/app/bots/tortila/setup');
  await expect(page.getByRole('heading', { name: 'Guided onboarding' })).toBeVisible();
  await expect(page.locator('.wtc-wizard-steps')).toBeVisible();
  await expect(page.getByText(/Stored in WTC only.*never sent to the live bot/)).toBeVisible();
  await expect(page.locator('#apiKey')).toBeVisible();
  expect(await noHScroll(page), 'wizard step=key scrolls horizontally at 375px').toBe(true);
  await page.screenshot({ path: shot('wizard-key'), fullPage: true });

  await page.goto('/app/bots/tortila/setup?step=strategy');
  await expect(page.getByText(/Step 2.*Strategy configuration/)).toBeVisible();
  await expect(page.locator('input[name="riskPercent"]')).toBeVisible();
  expect(await noHScroll(page), 'wizard step=strategy scrolls horizontally at 375px').toBe(true);
  await page.screenshot({ path: shot('wizard-strategy'), fullPage: true });

  await page.goto('/app/bots/legacy/setup');
  await expect(page.getByRole('heading', { name: 'Guided onboarding' })).toBeVisible();
  await expect(page.getByText('Live setup blocked (B3)')).toBeVisible();
  await expect(page.getByText('Reference profiles')).toBeVisible();
  await expect(page.locator('select[name="operationMode"]')).toBeVisible();
  await expect(page.locator('input[name="rsiLength"]')).toBeVisible();
  expect(await noHScroll(page), 'legacy wizard strategy scrolls horizontally at 375px').toBe(true);
  await page.screenshot({ path: shot('legacy-wizard-strategy'), fullPage: true });
});
