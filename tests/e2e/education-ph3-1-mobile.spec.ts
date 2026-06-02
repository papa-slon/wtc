import { test, expect, type Page } from '@playwright/test';
import { loginUser } from './helpers/auth';

/**
 * Phase 3.1 — LMS rich (level/tags + content_type). The demo backend seeds one published education course
 * ("Risk Management Fundamentals"); courseMemToView maps it with the level default 'beginner', so the
 * student catalogue renders a level badge. Navigation-only; authentication uses the e2e-only
 * cookie endpoint instead of posting a Next Server Action form. The rich write paths (teacher forms,
 * content_type) and the XSS guards are asserted statically in tests/integration/lms-ph3-1-static.test.ts
 * and on PGlite in tests/integration/db-lms-ph3-1.test.ts (the demo user is not a teacher, and the demo
 * backend has no DATABASE_URL — so the teacher editor / DB-backed detail are out of e2e reach here).
 */

async function noHScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}

test('Phase 3.1: student catalogue shows a course level badge', async ({ page }) => {
  await loginUser(page);
  await page.goto('/app/education');
  await expect(page.getByRole('heading', { name: 'Lessons & materials' })).toBeVisible();
  await expect(page.getByText('Risk Management Fundamentals')).toBeVisible(); // seeded published course
  await expect(page.getByText('beginner', { exact: false }).first()).toBeVisible(); // level badge (0005)
});

test('Phase 3.1: student catalogue has no horizontal scroll at 375px', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Phase 3.1 375px check runs once, in the mobile project.');
  await page.setViewportSize({ width: 375, height: 812 });
  await loginUser(page);
  await page.goto('/app/education');
  await expect(page.getByText('Risk Management Fundamentals')).toBeVisible();
  expect(await noHScroll(page), 'education catalogue scrolls horizontally at 375px').toBe(true);
  await page.screenshot({ path: 'tests/e2e/screenshots/education-ph3-1-mobile375.png', fullPage: true });
});
