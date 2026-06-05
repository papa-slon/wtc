import { test, expect, type Page } from '@playwright/test';
import { loginAdmin, loginUser } from './helpers/auth';

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
          left: Math.round(rect.left),
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

async function expectVisibleBoxesInsideViewport(page: Page, selector: string, label: string) {
  const failures = await page.locator(selector).evaluateAll((els) => {
    const width = window.innerWidth;
    return els
      .map((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent ?? '').replace(/\s+/g, ' ').slice(0, 80),
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0,
          left: rect.left,
          right: rect.right,
          width,
        };
      })
      .filter((box) => box.visible && (box.left < -1 || box.right > box.width + 1));
  });
  expect(failures, `${label} has overflowing warning/pill boxes`).toEqual([]);
}

async function assertWarningSurface(page: Page, label: string) {
  await expectNoHScroll(page, label);
  await expectVisibleBoxesInsideViewport(page, '.wtc-warning, .wtc-pill, .wtc-table-wrap', label);
  await expect(page.getByText('No adapter warnings')).toHaveCount(0);
  await expect(page.getByText('No active safety events')).toHaveCount(0);
  await expect(page.getByText('Connection verified')).toHaveCount(0);
}

test('user bot warning summaries render without all-clear copy or overflow', async ({ page }, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 375, height: 812 });
  await loginUser(page);

  await page.goto('/app/bots');
  await expect(page.getByRole('heading', { name: 'Bots', exact: true })).toBeVisible();
  await expect(page.getByText(/notice/).first()).toBeVisible();
  await assertWarningSurface(page, '/app/bots');
  await page.screenshot({ path: shot('warning-summary-bots-list', info.project.name), fullPage: true });

  for (const bot of ['tortila', 'legacy']) {
    await page.goto(`/app/bots/${bot}`);
    await expect(page.getByText('Runtime status notes')).toBeVisible();
    await expect(page.getByText('scope: adapter warning read').first()).toBeVisible();
    await assertWarningSurface(page, `/app/bots/${bot}`);
    await page.screenshot({ path: shot(`warning-summary-${bot}-dashboard`, info.project.name), fullPage: true });

    await page.goto(`/app/bots/${bot}/safety`);
    await expect(page.getByRole('heading', { name: 'Safety & risk events' })).toBeVisible();
    await expect(page.getByText('Risk & audit warnings')).toBeVisible();
    await expect(page.getByText('scope: adapter warning read').first()).toBeVisible();
    await assertWarningSurface(page, `/app/bots/${bot}/safety`);
    await page.screenshot({ path: shot(`warning-summary-${bot}-safety`, info.project.name), fullPage: true });

    await page.goto(`/app/bots/statistics?bot=${bot}`);
    await expect(page.getByText('Risk and status notes')).toBeVisible();
    await expect(page.getByText('scope: adapter warning read').first()).toBeVisible();
    await assertWarningSurface(page, `/app/bots/statistics?bot=${bot}`);
    await page.screenshot({ path: shot(`warning-summary-${bot}-statistics`, info.project.name), fullPage: true });
  }
});

test('admin warning summaries stay contained on the fleet page', async ({ page }, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 375, height: 812 });
  await loginAdmin(page);

  await page.goto('/admin/bots');
  await expect(page.getByRole('heading', { name: 'Bot fleet' })).toBeVisible();
  await expect(page.getByText('Canonical warning summary')).toBeVisible();
  await expect(page.getByText('TP reconciliation / restore not implemented')).toBeVisible();
  await assertWarningSurface(page, '/admin/bots');
  await page.screenshot({ path: shot('warning-summary-admin-bots', info.project.name), fullPage: true });
});
