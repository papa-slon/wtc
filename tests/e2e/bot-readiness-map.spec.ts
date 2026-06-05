import { test, expect, type Page } from '@playwright/test';
import { loginUser } from './helpers/auth';

const shot = (slug: string, project: string) => `tests/e2e/screenshots/${slug}-${project}.png`;

async function noHScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth <= de.clientWidth + 1;
  });
}

function readinessLayer(page: Page, label: string) {
  return page.locator('td[data-label="Layer"]').filter({ hasText: new RegExp(`^${label}$`) }).first();
}

function readinessRow(page: Page, label: string) {
  return readinessLayer(page, label).locator('xpath=ancestor::tr');
}

test('bot dashboard readiness maps are visible and honest for Tortila and Legacy', async ({ page }, info) => {
  await loginUser(page);

  await page.goto('/app/bots/tortila');
  await expect(page.getByText('Bot readiness map')).toBeVisible();
  await expect(page.getByText('Launch readiness command center')).toBeVisible();
  await expect(page.getByText('live start disabled')).toBeVisible();
  await expect(page.getByText('no exchange ping')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start bot unavailable' })).toBeDisabled();
  await expect(page.getByText('Continuity monitor')).toBeVisible();
  await expect(page.getByText('Silent-stop guard')).toBeVisible();
  await expect(readinessLayer(page, 'Access')).toBeVisible();
  await expect(readinessLayer(page, 'Exchange key')).toBeVisible();
  await expect(readinessLayer(page, 'Strategy source')).toBeVisible();
  await expect(readinessLayer(page, 'Worker heartbeat')).toBeVisible();
  await expect(readinessLayer(page, 'Runtime snapshot')).toBeVisible();
  await expect(readinessLayer(page, 'Statistics')).toBeVisible();
  await expect(readinessRow(page, 'Live control')).toContainText('Start/stop/apply disabled');
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  expect(await noHScroll(page), 'Tortila dashboard scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('bot-tortila-readiness', info.project.name), fullPage: true });

  await page.goto('/app/bots/legacy');
  await expect(page.getByText('Bot readiness map')).toBeVisible();
  await expect(page.getByText('Launch readiness command center')).toBeVisible();
  await expect(page.getByText('live start disabled')).toBeVisible();
  await expect(page.getByText('no exchange ping')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start bot unavailable' })).toBeDisabled();
  await expect(page.getByText('Continuity monitor')).toBeVisible();
  await expect(page.getByText('Silent-stop guard')).toBeVisible();
  await expect(readinessLayer(page, 'Access')).toBeVisible();
  await expect(readinessLayer(page, 'Provider pub_id')).toBeVisible();
  await expect(readinessLayer(page, 'Strategy source')).toBeVisible();
  await expect(readinessLayer(page, 'Worker heartbeat')).toBeVisible();
  await expect(readinessLayer(page, 'Runtime snapshot')).toBeVisible();
  await expect(readinessLayer(page, 'Statistics')).toBeVisible();
  await expect(readinessRow(page, 'Live control')).toContainText('Start/stop/apply disabled');
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy dashboard scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('bot-legacy-readiness', info.project.name), fullPage: true });
});
