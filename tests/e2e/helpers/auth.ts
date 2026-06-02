import { expect, type Page } from '@playwright/test';

const DEMO_PASSWORD = 'wtc-demo-pass-123';

export async function loginAs(page: Page, email = 'user@wtc.local') {
  await page.context().clearCookies();
  const response = await page.request.post('/api/e2e/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(response.ok(), `e2e login failed for ${email}: ${response.status()}`).toBe(true);
  await page.goto('/app', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/app$/);
}

export const loginUser = (page: Page) => loginAs(page, 'user@wtc.local');
export const loginAdmin = (page: Page) => loginAs(page, 'admin@wtc.local');
export const loginTeacher = (page: Page) => loginAs(page, 'teacher@wtc.local');
