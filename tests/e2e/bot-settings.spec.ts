import { test, expect, type Page } from '@playwright/test';
import { loginAdmin, loginUser } from './helpers/auth';

const shot = (slug: string, project: string) => `tests/e2e/screenshots/${slug}-${project}.png`;

async function noHScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth <= de.clientWidth + 1;
  });
}

async function targetInViewport(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight && rect.bottom > 0;
  });
}

function operationLayer(page: Page, label: string) {
  return page.locator('td[data-label="Layer"]', { hasText: label });
}

function setupLayer(page: Page, label: string) {
  return page.locator('td[data-label="Setup layer"]', { hasText: label });
}

function resolutionCell(page: Page, label: string) {
  return page.locator(`td[data-label="${label}"]`);
}

function tortilaPortfolioGuardrail(page: Page, label: string) {
  return page.locator('tr').filter({ has: page.locator('td[data-label="Portfolio guardrail"]', { hasText: label }) });
}

function expectNoUnsafeExportMarkers(value: string): void {
  for (const marker of [
    'apiKey',
    'apiSecret',
    'providerPubId',
    'sealed-secret-value',
    'wrapped-dek-secret-value',
    'postgres://legacy-secret-value',
    'https://journal-secret-value',
    'admin-user-secret-value',
    'owner-secret@example.test',
    'live-control-secret-value',
    'authorization',
    'bearer-secret-value',
    'startBot',
    'stopBot',
    'applyConfig',
    'Connection verified',
  ]) {
    expect(value).not.toContain(marker);
    expect(value).not.toContain(Buffer.from(marker, 'utf8').toString('base64'));
  }
}

async function fillLegacyStageDraftCap(page: Page, name: string): Promise<string> {
  const input = page.locator(`input[name="${name}"]`);
  const current = await input.inputValue();
  const next = current === '0' ? '1' : '0';
  await input.fill(next);
  return next;
}

test('bot settings workbench renders safe coin configuration for Tortila and Legacy', async ({ page }, info) => {
  await loginUser(page);

  await page.goto('/app/bots/tortila/settings');
  await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
  // ----- Premium Tortila settings page (redesigned per-coin editor) -----
  // Resolved-source status pill sits beside the kept "Configuration" heading.
  await expect(
    page.locator('.wtc-pill').filter({ hasText: /default settings|custom v\d+|system v\d+/ }).first(),
  ).toBeVisible();
  // Bot section tab strip with Settings active.
  const tortilaSubNav = page.getByRole('navigation', { name: 'Bot sections' });
  await expect(tortilaSubNav).toBeVisible();
  await expect(tortilaSubNav.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('aria-current', 'page');
  // Source + reference cards.
  await expect(page.getByRole('heading', { name: 'Reference profiles', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Private exchange connection', exact: true })).toBeVisible();
  await expect(page.getByText(/No encrypted exchange key saved|No live exchange ping is claimed|Exchange ping unavailable|Check WTC vault readiness/).first()).toBeVisible();

  // Save form keeps its id + Strategy mode select + Save button (byte-compatible action).
  const customForm = page.locator('form#custom-settings');
  await expect(customForm).toBeVisible();
  await expect(customForm.locator('select[name="operationMode"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save custom settings' })).toBeVisible();

  // Premium per-coin cards: the first card renders the saved XRP coin.
  const coinSymbol0 = page.locator('input[name="symbol_0"]');
  await expect(coinSymbol0).toHaveValue('XRP/USDT:USDT');
  const symbolListId = await coinSymbol0.getAttribute('list');
  expect(symbolListId, 'coin combobox is wired to a catalog datalist').toBeTruthy();
  await expect(page.locator(`datalist[id="${symbolListId}"]`)).toHaveCount(1);
  await expect(customForm.getByText('Coin', { exact: true }).first()).toBeVisible();
  const system0 = page.locator('select[name="system_0"]');
  await expect(system0).toBeVisible();
  await expect(system0.locator('option')).toHaveText(['System 2 (55/20)', 'System 1 (20/10)']);
  await expect(customForm.getByText('Turtle system', { exact: true }).first()).toBeVisible();
  await expect(page.locator('input[name="risk_0"]')).toBeVisible();
  await expect(page.locator('input[name="stop_0"]')).toBeVisible();

  // Live card preview reacts to edits (the old strategy-map table is gone).
  const coinCard0 = page.locator('#tortila-symbol-1');
  await system0.selectOption('1');
  await expect(coinCard0.locator('.tset-sys-chip')).toHaveText('System 1');
  await page.locator('input[name="risk_0"]').fill('0.7');
  await expect(page.locator('input[name="risk_0"]')).toHaveValue('0.7');
  await expect(coinCard0.getByText('standard risk')).toBeVisible();

  // Portfolio caps live inside a collapsed <details>; cap inputs appear only after expanding.
  const capsSummary = page.locator('summary.tset-caps-summary', { hasText: 'Portfolio caps' });
  await expect(capsSummary).toBeVisible();
  await expect(page.locator('input[name="maxOpenSymbols"]')).toBeHidden();
  await capsSummary.click();
  for (const cap of ['maxOpenSymbols', 'maxTotalUnits', 'maxUnitsPerDirection', 'haltDrawdownPercent', 'dailyMaxLossPercent', 'maxNewEntriesPerTick']) {
    await expect(page.locator(`input[name="${cap}"]`)).toBeVisible();
  }

  // Advanced (leverage + compatibility fields) is a second collapsed group.
  const advancedSummary = page.locator('summary.tset-caps-summary', { hasText: 'Advanced' });
  await expect(advancedSummary).toBeVisible();
  await advancedSummary.click();
  await expect(customForm.locator('[name="leverage"]')).toBeVisible();

  // Retained reference/audit cards.
  await expect(page.getByRole('heading', { name: 'Version history', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Safety events', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Export current reference config', exact: true })).toBeVisible();
  const tortilaExport = page.getByRole('link', { name: 'Download last saved reference export' });
  await expect(tortilaExport).toHaveAttribute('href', '/api/bots/tortila/config-export');
  await expect(page.getByText('Download the saved WTC reference settings in a bot-native format')).toBeVisible();
  await expect(page.getByText('This export contains no exchange keys and does not apply anything to a live bot')).toBeVisible();
  const tortilaExportResponse = await page.request.get('/api/bots/tortila/config-export');
  const tortilaExportHeaders = tortilaExportResponse.headers();
  const tortilaExportBody = await tortilaExportResponse.text();
  expect(tortilaExportResponse.status(), 'Tortila config export status').toBe(200);
  expect(tortilaExportHeaders['content-type']).toBe('text/plain; charset=utf-8');
  expect(tortilaExportHeaders['content-disposition']).toBe('attachment; filename="wtc-tortila-config.env"');
  expect(tortilaExportHeaders['cache-control']).toBe('no-store');
  expect(tortilaExportHeaders['x-content-type-options']).toBe('nosniff');
  expect(tortilaExportHeaders['referrer-policy']).toBe('no-referrer');
  expect(tortilaExportBody).toContain('# WTC Tortila Bot reference export');
  expect(tortilaExportBody).toContain('SYMBOL_CONFIGS=');
  expect(tortilaExportBody).not.toContain('XRP/USDT:USDT@4h@1@0.007@2@1@4@20@0');
  expectNoUnsafeExportMarkers(tortilaExportBody);
  expectNoUnsafeExportMarkers(Object.entries(tortilaExportHeaders).map(([k, v]) => `${k}: ${v}`).join('\n'));
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  expect(await noHScroll(page), 'Tortila settings scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('bot-tortila-settings', info.project.name), fullPage: true });

  await page.goto('/app/bots/tortila/settings?err=config');
  await expect(page.getByText('Configuration was not saved')).toBeVisible();
  await expect(page.getByText('One or more rows are out of range')).toBeVisible();

  await page.goto('/app/bots/legacy/settings');
  await expect(page.getByRole('heading', { name: 'Configuration', exact: true })).toBeVisible();
  // ----- Premium Legacy settings page (redesigned per-coin averaging editor) -----
  // Resolved-source status pill sits beside the kept "Configuration" heading.
  await expect(
    page.locator('.wtc-pill').filter({ hasText: /default settings|custom v\d+|system v\d+/ }).first(),
  ).toBeVisible();
  // Bot section tab strip with Settings active.
  const legacySubNav = page.getByRole('navigation', { name: 'Bot sections' });
  await expect(legacySubNav).toBeVisible();
  await expect(legacySubNav.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('aria-current', 'page');

  // Save form keeps its id + Strategy mode select + Save button (byte-compatible action).
  const legacyForm = page.locator('form#custom-settings');
  await expect(legacyForm).toBeVisible();
  await expect(legacyForm.locator('select[name="operationMode"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save custom settings' })).toBeVisible();

  // Premium per-coin averaging cards replace the old strategy-map / trigger-resolution /
  // manual-symbol-override tables. The first card renders the saved AAVE coin.
  await expect(legacyForm.getByText('Your coins')).toBeVisible();
  await expect(legacyForm.locator('.tset-note', { hasText: /active coins?/ })).toBeVisible();
  const legacyCoin0 = page.locator('input[name="legacy_symbol_0"]');
  await expect(legacyCoin0).toHaveValue('AAVE-USDT');
  const legacyListId = await legacyCoin0.getAttribute('list');
  expect(legacyListId, 'legacy coin combobox is wired to a catalog datalist').toBeTruthy();
  await expect(page.locator(`datalist[id="${legacyListId}"]`)).toHaveCount(1);
  const legacyCard0 = page.locator('#legacy-symbol-1');
  const legacyChip0 = legacyCard0.locator('.tset-sys-chip');
  await expect(legacyChip0).toContainText('Stage 1');
  await expect(legacyChip0).toContainText('RSI');
  // One trigger per coin, exposed as a byte-stable hidden select behind a segmented control.
  await expect(legacyCard0.locator('select[name="legacy_signal_0"]')).toHaveCount(1);

  // Stage capacity is a collapsed group; the stage-slot inputs appear only after expanding.
  await expect(page.locator('input[name="legacy_stage_rsi_0"]')).toBeHidden();
  await page.getByText('Stage capacity').click();
  await expect(page.locator('input[name="legacy_stage_rsi_0"]')).toBeVisible();
  await expect(page.locator('input[name="legacy_stage_cci_0"]')).toBeVisible();
  // 12 active stage-1 coins against only 3 RSI / 2 CCI slots — the inline readout is honestly "over".
  await expect(page.locator('#legacy-stage-1')).toContainText('over');

  // Live coin-card chip reacts to a trigger flip (the deleted resolution-map table is gone).
  await legacyCard0.getByRole('button', { name: 'CCI', exact: true }).click();
  await expect(legacyChip0).toContainText('CCI');
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  const legacyExportBlocked = page.getByRole('button', { name: 'Export requires mapped pub_id' });
  await expect(legacyExportBlocked).toBeDisabled();
  await expect(legacyExportBlocked).toHaveAttribute('title', 'Legacy export requires exactly one active mapped pub_id');
  await expect(page.getByText('Legacy export needs exactly one mapped pub_id')).toBeVisible();
  await expect(page.getByText('Admin must map one active Legacy provider pub_id')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download last saved reference export' })).toHaveCount(0);
  await expect(page.getByText('Download the saved WTC reference settings in a bot-native format')).toBeVisible();
  await expect(page.getByText('This export contains no exchange keys and does not apply anything to a live bot')).toBeVisible();
  const legacyExportResponse = await page.request.get('/api/bots/legacy/config-export');
  const legacyExportHeaders = legacyExportResponse.headers();
  const legacyExportBody = await legacyExportResponse.text();
  expect(legacyExportResponse.status(), 'Legacy config export blocked status').toBe(403);
  expect(legacyExportHeaders['content-type']).toContain('application/json');
  expect(legacyExportHeaders['cache-control']).toBe('no-store');
  expect(legacyExportHeaders['x-content-type-options']).toBe('nosniff');
  expect(legacyExportHeaders['referrer-policy']).toBe('no-referrer');
  expect(legacyExportHeaders['content-disposition']).toBeUndefined();
  expect(JSON.parse(legacyExportBody)).toEqual({ error: 'provider_mapping_required' });
  expectNoUnsafeExportMarkers(legacyExportBody);
  expectNoUnsafeExportMarkers(Object.entries(legacyExportHeaders).map(([k, v]) => `${k}: ${v}`).join('\n'));
  expect(await noHScroll(page), 'Legacy settings scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('bot-legacy-settings', info.project.name), fullPage: true });
});

test('Tortila invalid coin settings return a row-targeted save error', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/tortila/settings');
  await page.locator('input[name="risk_0"]').fill('9');
  // The premium coin card guards ranges client-side (type=number, max=3). Disable native form
  // validation so the out-of-range draft reaches the SERVER and exercises its validation +
  // inline-error path (defense in depth — the server must reject even a bypassed client).
  await page.locator('form#custom-settings').evaluate((f) => f.setAttribute('novalidate', ''));
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/settings\?err=config&issue=tortila-row-risk&row=1/);
  const rowAlert = page.locator('#tortila-symbol-1 [role="alert"]');
  await expect(rowAlert).toBeVisible();
  // Premium settings page has no setup-control-center "Fix row" link; the error renders
  // inline inside the offending coin card and the input is flagged + wired to that alert.
  await expect(page.locator('input[name="risk_0"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('input[name="risk_0"]')).toHaveAttribute('aria-describedby', 'tortila-symbol-1-save-error');
  await expect(page.getByText(/this failed draft was not saved/)).toBeVisible();
  await expect(rowAlert.getByText('Fix Tortila coin slot 1')).toBeVisible();
  await expect(rowAlert.getByText('Risk % must be between 0.1 and 3')).toBeVisible();
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  expect(await noHScroll(page), 'Tortila invalid settings scrolls horizontally').toBe(true);
});

test('Tortila setup key readiness is metadata-only and never claims a live exchange ping', async ({ page }, info) => {
  await loginUser(page);
  const apiKey = `E2E_DEMO_KEY_${Date.now()}`;
  const apiSecret = `E2E_DEMO_SECRET_${Date.now()}`;

  await page.goto('/app/bots/tortila/setup?step=key');
  await expect(page.getByRole('heading', { name: 'Guided onboarding' })).toBeVisible();
  await expect(page.getByText('Stored in WTC only - never sent to the live bot')).toBeVisible();
  await expect(page.locator('#exchange')).toBeVisible();
  await expect(page.getByText(/Connection verified|startBot|stopBot|applyConfig/)).toHaveCount(0);

  await page.locator('#exchange').selectOption('bingx');
  await page.locator('#label').fill('E2E demo metadata account');
  await page.locator('#apiKey').fill(apiKey);
  await page.locator('#apiSecret').fill(apiSecret);
  await page.locator('#mode').selectOption('demo');
  await page.getByRole('button', { name: 'Encrypt & save key' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/setup\?step=strategy$/);
  await expect(setupLayer(page, 'Exchange key')).toBeVisible();
  await expect(page.getByText(/encrypted key rows?/).first()).toBeVisible();
  let visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain(apiKey);
  expect(visibleText).not.toContain(apiSecret);
  expect(visibleText).not.toContain(Buffer.from(apiKey, 'utf8').toString('base64'));
  expect(visibleText).not.toContain(Buffer.from(apiSecret, 'utf8').toString('base64'));

  await page.goto('/app/bots/tortila/setup?step=key');
  const savedKeyCard = page.locator('.wtc-card.wtc-stack').filter({ hasText: 'E2E demo metadata account' }).first();
  await expect(savedKeyCard).toBeVisible();
  await expect(savedKeyCard.locator('.wtc-card-row').filter({ hasText: 'Exchange' }).filter({ hasText: 'bingx' })).toBeVisible();
  await expect(savedKeyCard.getByText('WTC metadata', { exact: true })).toBeVisible();
  await expect(savedKeyCard.getByText('Format check', { exact: true })).toBeVisible();
  await expect(savedKeyCard.getByText('Exchange ping', { exact: true })).toBeVisible();
  await expect(savedKeyCard.getByText('not run', { exact: true }).first()).toBeVisible();
  await expect(savedKeyCard.getByText('Live bot control', { exact: true })).toBeVisible();
  await expect(savedKeyCard.getByRole('button', { name: 'Run read-only exchange ping (future)' })).toBeDisabled();
  await expect(page.getByText('Exchange ping unavailable')).toBeVisible();

  await savedKeyCard.getByRole('button', { name: 'Check WTC vault readiness' }).click();
  await expect(page).toHaveURL(/\/app\/bots\/tortila\/setup\?step=key&keyCheck=vault-present$/);
  await expect(page.getByText('WTC readiness check passed')).toBeVisible();
  await expect(page.getByText('No live exchange ping was run')).toBeVisible();
  await expect(page.getByText(/Connection verified|startBot|stopBot|applyConfig/)).toHaveCount(0);
  visibleText = await page.locator('body').innerText();
  expect(visibleText).not.toContain(apiKey);
  expect(visibleText).not.toContain(apiSecret);
  expect(await noHScroll(page), 'Tortila key readiness flow scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('bot-tortila-key-readiness', info.project.name), fullPage: true });
});

test('Tortila invalid portfolio caps return a top-level caps save error', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/tortila/settings');
  // Portfolio caps live in a collapsed <details>; open it before editing a cap.
  await page.locator('summary.tset-caps-summary', { hasText: 'Portfolio caps' }).click();
  await page.locator('input[name="maxOpenSymbols"]').fill('21');
  // Premium caps guard ranges client-side (max=20); disable native form validation so the
  // out-of-range draft reaches the server's caps validation + inline-error path.
  await page.locator('form#custom-settings').evaluate((f) => f.setAttribute('novalidate', ''));
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/settings\?err=config&issue=tortila-portfolio-limit/);
  // No setup-control-center fix links on the premium page; the cap error surfaces a
  // page-level banner and an inline caps alert, and must not spill into a coin-row alert.
  await expect(page.getByText(/this failed draft was not saved/)).toBeVisible();
  await expect(page.locator('#tortila-symbol-1-save-error')).toHaveCount(0);
  const portfolioAlert = page.locator('#tortila-portfolio-caps-save-error');
  await expect(portfolioAlert).toBeVisible();
  await expect(portfolioAlert.getByText('Fix Tortila portfolio limits')).toBeVisible();
  await expect(portfolioAlert.getByText('Max open symbols must be 1-20')).toBeVisible();
  await expect(page.locator('input[name="maxOpenSymbols"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('input[name="maxOpenSymbols"]')).toHaveAttribute('aria-describedby', 'tortila-portfolio-caps-save-error');
  await expect(page.locator('input[name="haltDrawdownPercent"]')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Tortila portfolio cap error scrolls horizontally').toBe(true);

  await page.goto('/app/bots/tortila/setup?step=strategy');
  await page.locator('input[name="dailyMaxLossPercent"]').fill('0.1');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/setup\?step=strategy&err=config&issue=tortila-risk-limit/);
  await expect(setupLayer(page, 'Validation issue')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fix caps' })).toHaveAttribute('href', '#tortila-portfolio-caps');
  const riskAlert = page.locator('#tortila-portfolio-caps-save-error');
  await expect(riskAlert).toBeVisible();
  await expect(riskAlert.getByText('Fix Tortila risk limits')).toBeVisible();
  await expect(page.locator('input[name="dailyMaxLossPercent"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('input[name="maxNewEntriesPerTick"]')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Tortila risk cap error scrolls horizontally').toBe(true);

  await page.goto('/app/bots/tortila/settings');
  // Open the collapsed portfolio caps <details> before editing the throttle cap.
  await page.locator('summary.tset-caps-summary', { hasText: 'Portfolio caps' }).click();
  await page.locator('input[name="maxNewEntriesPerTick"]').fill('21');
  await page.locator('form#custom-settings').evaluate((f) => f.setAttribute('novalidate', ''));
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/settings\?err=config&issue=tortila-entry-throttle/);
  const throttleAlert = page.locator('#tortila-portfolio-caps-save-error');
  await expect(throttleAlert).toBeVisible();
  await expect(throttleAlert.getByText('Fix Tortila entry throttle')).toBeVisible();
  await expect(page.locator('input[name="maxNewEntriesPerTick"]')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('input[name="maxOpenSymbols"]')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Tortila throttle error scrolls horizontally').toBe(true);
});

test('Legacy invalid averaging ladder returns a row-targeted save error', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/legacy/settings');
  // The averaging ladder lives in the per-coin "Position sizing & averaging ladder" group.
  await page.locator('#legacy-symbol-1').getByText('Position sizing & averaging ladder').click();
  await page.locator('input[name="legacy_levels_0"]').fill('4');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/legacy\/settings\?err=config&issue=legacy-row-ladder&row=1/);
  // Premium settings page: the error renders inline inside the offending coin card
  // (no setup-control-center "Fix row" link), and the page banner confirms rejection.
  const rowAlert = page.locator('#legacy-symbol-1 [role="alert"]');
  await expect(rowAlert).toBeVisible();
  await expect(rowAlert.getByText('Fix Legacy coin slot 1')).toBeVisible();
  await expect(rowAlert.getByText('Drop ladder and volume ladder must be comma-separated numbers')).toBeVisible();
  await expect(page.getByText(/this failed draft was not saved/)).toBeVisible();
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy invalid settings scrolls horizontally').toBe(true);
});

test('Legacy invalid stage capacity returns a stage-targeted save error', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/legacy/settings');
  // Stage capacity is a collapsed group; open it before editing a stage slot.
  await page.getByText('Stage capacity').click();
  await page.locator('input[name="legacy_stage_rsi_0"]').fill('99');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/legacy\/settings\?err=config&issue=legacy-stage-capacity&row=1/);
  // Premium settings page: the stage error renders inline inside the offending stage row.
  // The group is force-opened on a stage save error, so the alert is reachable without a
  // setup-control-center "Fix stage" link.
  const stageAlert = page.locator('#legacy-stage-1-save-error');
  await expect(stageAlert).toBeVisible();
  await expect(stageAlert.getByText('Fix Legacy stage row 1')).toBeVisible();
  await expect(stageAlert.getByText('RSI and CCI capacities must be whole numbers from 0 to 50')).toBeVisible();
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy invalid stage settings scrolls horizontally').toBe(true);
});

test('Tortila setup invalid strategy save routes to the row target', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/tortila/setup?step=strategy');
  await page.locator('input[name="risk_0"]').fill('9');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/setup\?step=strategy&err=config&issue=tortila-row-risk&row=1/);
  await expect(setupLayer(page, 'Validation issue')).toBeVisible();
  const fixRowLink = page.getByRole('link', { name: 'Fix row' });
  await expect(fixRowLink).toHaveAttribute('href', '#tortila-symbol-1');
  const rowAlert = page.locator('#tortila-symbol-1 [role="alert"]');
  await expect(rowAlert).toBeVisible();
  await fixRowLink.click();
  await expect(page).toHaveURL(/#tortila-symbol-1$/);
  expect(await targetInViewport(page, '#tortila-symbol-1 [role="alert"]'), 'Tortila setup row alert is visible after Fix row').toBe(true);
  await expect(rowAlert.getByText('Risk % must be between 0.1 and 3')).toBeVisible();
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Tortila setup invalid settings scrolls horizontally').toBe(true);
});

test('bot setup renders effective review and blocks incomplete Tortila review', async ({ page }, info) => {
  await loginUser(page);

  await page.goto('/app/bots/tortila/setup?step=strategy');
  await expect(page.getByRole('heading', { name: 'Guided onboarding' })).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/вњ|вЂ|�/);
  await expect(page.getByText('Bot setup control center')).toBeVisible();
  await expect(setupLayer(page, 'Default or custom')).toBeVisible();
  await expect(setupLayer(page, 'Exchange key')).toBeVisible();
  await expect(setupLayer(page, 'Coin strategy map')).toBeVisible();
  await expect(page.getByText('Current setup settings review')).toBeVisible();
  await expect(page.getByText('Effective Tortila settings review')).toBeVisible();
  await expect(page.getByText('Setup operation map')).toBeVisible();
  await expect(operationLayer(page, '2. Coin strategy map')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tortila strategy map' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portfolio caps' })).toBeVisible();
  await expect(page.locator('input[name="maxOpenSymbols"]')).toBeVisible();
  await expect(tortilaPortfolioGuardrail(page, 'Entries per tick').locator('td[data-label="Reference cap"]')).toContainText('2 entries');
  await expect(page.locator('td[data-label="Coin candidates"]').filter({ hasText: '#1 XRP/USDT:USDT' }).first()).toBeVisible();
  await expect(page.getByText('Runtime export preview (draft)')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settings source', exact: true })).toBeVisible();
  expect(await noHScroll(page), 'Tortila setup strategy scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('bot-tortila-setup-strategy', info.project.name), fullPage: true });

  await page.goto('/app/bots/tortila/setup?step=review');
  await expect(page.getByText(/Add an exchange key first|Save strategy settings first|Settings to review/)).toBeVisible();
  expect(await noHScroll(page), 'Tortila setup review scrolls horizontally').toBe(true);

  await page.goto('/app/bots/legacy/setup');
  await expect(page.getByText('Bot setup control center')).toBeVisible();
  await expect(page.getByText('Setup continuity monitor')).toBeVisible();
  await expect(setupLayer(page, 'Provider pub_id')).toBeVisible();
  await expect(setupLayer(page, 'Coin and stage map')).toBeVisible();
  await expect(page.getByText('Current setup settings review')).toBeVisible();
  await expect(page.getByText('Effective Legacy settings review')).toBeVisible();
  await expect(page.getByText('Setup operation map')).toBeVisible();
  await expect(operationLayer(page, '2. Coin trigger map')).toBeVisible();
  await expect(page.getByText('Stage slots')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trigger resolution map' })).toBeVisible();
  await expect(page.getByText('independent trigger candidates')).toBeVisible();
  await expect(page.getByText('Paused rows and blank coin rows are excluded from this draft map')).toBeVisible();
  await expect(resolutionCell(page, 'RSI candidates').first()).toBeVisible();
  await expect(resolutionCell(page, 'CCI candidates').first()).toBeVisible();
  await expect(resolutionCell(page, 'RSI candidates').filter({ hasText: '#1' }).first()).toBeVisible();
  await expect(page.getByText('Stage slot group').first()).toBeVisible();
  await expect(page.getByText('Manual symbol override').first()).toBeVisible();
  await expect(page.getByText('RSI used').first()).toBeVisible();
  await expect(page.getByText('CCI used').first()).toBeVisible();
  const setupDraftRsiSlots = await fillLegacyStageDraftCap(page, 'legacy_stage_rsi_0');
  const setupDraftCciSlots = await fillLegacyStageDraftCap(page, 'legacy_stage_cci_0');
  const setupLiveStagePreview = page.locator('#legacy-stage-1');
  await expect(setupLiveStagePreview.getByText(new RegExp(`/${setupDraftRsiSlots} RSI used`))).toBeVisible();
  await expect(setupLiveStagePreview.getByText(new RegExp(`/${setupDraftCciSlots} CCI used`))).toBeVisible();
  await expect(setupLiveStagePreview.getByText('over capacity')).toBeVisible();
  await expect(setupLayer(page, 'Draft stage capacity warning')).toBeVisible();
  await expect(page.getByText(/Unsaved draft preview: Stage 1 uses .* RSI slots and .* CCI slots/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review stage' })).toHaveAttribute('href', '/app/bots/legacy/setup?step=strategy#legacy-stage-1');
  await expect(page.getByText(/draft preview inside capacity|\d+ over capacity/).first()).toBeVisible();
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy setup scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('bot-legacy-setup', info.project.name), fullPage: true });
});

test('admin bot defaults renders effective review without user override controls', async ({ page }, info) => {
  await loginAdmin(page);

  await page.goto('/admin/bots/config');
  await expect(page.getByRole('heading', { name: 'System bot defaults' })).toBeVisible();
  await expect(page.getByText('Effective system default review').first()).toBeVisible();
  await expect(page.getByText('LIVE CONTROL: DISABLED').first()).toBeVisible();
  await expect(page.getByText('user settings unaffected').first()).toBeVisible();
  await expect(page.getByText('Effective Legacy settings review')).toBeVisible();
  await expect(page.getByText('Effective Tortila settings review')).toBeVisible();
  await expect(page.locator('input[name="maxOpenSymbols"]')).toHaveCount(1);
  await expect(page.locator('input[name="maxTotalUnits"]')).toHaveCount(1);
  await expect(page.locator('input[name="maxUnitsPerDirection"]')).toHaveCount(1);
  await expect(page.locator('input[name="haltDrawdownPercent"]')).toHaveCount(1);
  await expect(page.locator('input[name="dailyMaxLossPercent"]')).toHaveCount(1);
  await expect(page.locator('input[name="maxNewEntriesPerTick"]')).toHaveCount(1);
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  expect(await noHScroll(page), 'Admin bot defaults scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('admin-bot-defaults', info.project.name), fullPage: true });
});

test('Legacy stage over-capacity advisory routes from setup control center', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/legacy/settings');
  // The premium editor surfaces over-capacity honestly inline (no control-center advisory):
  // Stage 1 holds 12 active stage-1 coins against only 3 RSI / 2 CCI slots.
  await page.getByText('Stage capacity').click();
  const stage1 = page.locator('#legacy-stage-1');
  await expect(stage1).toContainText('over');
  // The byte-stable stage-cap inputs drive that live readout: widen both caps past the
  // active counts and the over-capacity flag clears in place — no save, no fabrication.
  await page.locator('input[name="legacy_stage_rsi_0"]').fill('20');
  await page.locator('input[name="legacy_stage_cci_0"]').fill('20');
  await expect(stage1).not.toContainText('over');
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy over-capacity settings scrolls horizontally').toBe(true);

  // The setup wizard keeps its control-center advisory routing (unchanged old surface);
  // the built-in default is already over its stage-1 RSI capacity.
  await page.goto('/app/bots/legacy/setup?step=strategy');
  await expect(setupLayer(page, 'Stage capacity warning')).toBeVisible();
  const setupReviewStageLink = page.getByRole('link', { name: 'Review stage' });
  await expect(setupReviewStageLink).toHaveAttribute('href', '/app/bots/legacy/setup?step=strategy#legacy-stage-1');
  await setupReviewStageLink.click();
  await expect(page).toHaveURL(/\/app\/bots\/legacy\/setup\?step=strategy#legacy-stage-1$/);
  expect(await targetInViewport(page, '#legacy-stage-1'), 'Legacy over-capacity stage is visible from setup Review stage').toBe(true);
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy over-capacity setup scrolls horizontally').toBe(true);
});
