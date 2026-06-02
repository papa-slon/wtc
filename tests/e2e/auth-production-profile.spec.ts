import { expect, test } from '@playwright/test';

function uniqueEmail(projectName: string) {
  const safeProject = projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `auth-profile-${safeProject}-${Date.now()}@wtc.local`;
}

test('real register and login forms work without the e2e auth bypass', async ({ page }, info) => {
  const email = uniqueEmail(info.project.name);
  const password = 'ProdProfilePass123';

  const bypassResponse = await page.request.post('/api/e2e/login', {
    data: { email: 'user@wtc.local', password: 'wtc-demo-pass-123' },
  });
  expect(bypassResponse.status()).toBe(404);

  await page.goto('/register');
  await page.getByLabel('Display name').fill('Production Profile User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password (min 10 chars)').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Account overview' })).toBeVisible();

  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('WrongPassword123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/login\?error=invalid_credentials/);
  await expect(page.getByText('Could not sign in')).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: 'Account overview' })).toBeVisible();
});
