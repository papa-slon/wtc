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

function quickPathLayer(page: Page, label: string) {
  return page.locator('tr').filter({ has: page.locator('td[data-label="Layer"]', { hasText: label }) });
}

function resolutionCell(page: Page, label: string) {
  return page.locator(`td[data-label="${label}"]`);
}

function resolutionStage(page: Page, label: string) {
  return page.locator('tr').filter({ has: page.locator('td[data-label="Stage bucket"]', { hasText: label }) });
}

function tortilaStrategyBucket(page: Page, label: string) {
  return page.locator('tr').filter({ has: page.locator('td[data-label="Turtle bucket"]', { hasText: label }) });
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
  await expect(page.getByText('Bot setup control center')).toBeVisible();
  await expect(setupLayer(page, 'Default or custom')).toBeVisible();
  await expect(setupLayer(page, 'Exchange key')).toBeVisible();
  await expect(setupLayer(page, 'Coin strategy map')).toBeVisible();
  await expect(setupLayer(page, 'Live control boundary')).toBeVisible();
  await expect(page.getByText('Basic settings path')).toBeVisible();
  await expect(quickPathLayer(page, '2. Coin strategy').locator('td[data-label="What it means"]')).toContainText('System');
  await expect(quickPathLayer(page, '3. Portfolio caps').locator('td[data-label="What it means"]')).toContainText('Directional cap');
  await expect(quickPathLayer(page, '4. Exchange key').locator('td[data-label="What it means"]')).toContainText('live exchange ping is not run here');
  await expect(quickPathLayer(page, '5. Statistics').locator('td[data-label="What it means"]')).toContainText('admin views are read-only');
  await expect(quickPathLayer(page, '7. Live boundary').locator('td[data-label="What it means"]')).toContainText('No live apply');
  await expect(page.getByRole('link', { name: 'Open settings editor' })).toHaveAttribute('href', '#custom-settings');
  await expect(page.getByText('Settings readiness map')).toBeVisible();
  await expect(page.getByText('Settings continuity monitor')).toBeVisible();
  await expect(page.locator('td[data-label="Proof"]', { hasText: 'settings evidence rows' }).first()).toBeVisible();
  await expect(page.getByRole('row', { name: /Live apply.*Disabled/ })).toBeVisible();
  await expect(page.getByText('Private exchange connection')).toBeVisible();
  await expect(page.getByText(/No encrypted exchange key saved|No live exchange ping is claimed|Exchange ping unavailable|Check WTC vault readiness/).first()).toBeVisible();
  await expect(page.getByText('Per-coin Tortila configuration')).toBeVisible();
  await expect(page.getByText('Effective settings review')).toBeVisible();
  await expect(page.getByText('Settings continuity monitor')).toBeVisible();
  await expect(page.getByText('Effective Tortila settings review')).toBeVisible();
  await expect(page.getByText('How this bot will operate')).toBeVisible();
  await expect(operationLayer(page, '2. Coin strategy map')).toBeVisible();
  await expect(operationLayer(page, '4. Runtime evidence')).toBeVisible();
  await expect(operationLayer(page, '6. Admin visibility')).toBeVisible();
  await expect(page.getByText('Coin plan')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tortila strategy map' })).toBeVisible();
  await expect(page.getByText('Draft map groups visible coin rows by Turtle system')).toBeVisible();
  await expect(page.getByText('Candidate labels show row number, symbol, timeframe, system, risk, stop, add step, max units, ATR, and TP before save')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portfolio caps' })).toBeVisible();
  await expect(page.getByText('Edit the reference-level limits that are saved with this coin map')).toBeVisible();
  await expect(page.locator('input[name="maxOpenSymbols"]')).toBeVisible();
  await expect(page.locator('input[name="maxTotalUnits"]')).toBeVisible();
  await expect(page.locator('input[name="maxUnitsPerDirection"]')).toBeVisible();
  await expect(tortilaPortfolioGuardrail(page, 'Max open symbols').locator('td[data-label="Draft pressure"]')).toContainText('5 draft coins');
  await expect(tortilaPortfolioGuardrail(page, 'Max total units').locator('td[data-label="Draft pressure"]')).toContainText('20 draft max units');
  await expect(tortilaPortfolioGuardrail(page, 'Drawdown halt').locator('td[data-label="Reference cap"]')).toContainText('35%');
  await page.locator('input[name="maxOpenSymbols"]').fill('4');
  await expect(tortilaPortfolioGuardrail(page, 'Max open symbols').locator('td[data-label="Status"]')).toContainText('draft over reference cap');
  await page.locator('input[name="maxTotalUnits"]').fill('25');
  await expect(tortilaPortfolioGuardrail(page, 'Max total units').locator('td[data-label="Status"]')).toContainText('draft inside reference cap');
  await expect(page.locator('td[data-label="Coin candidates"]').filter({ hasText: '#1 XRP/USDT:USDT' }).first()).toBeVisible();
  await page.locator('select[name="system_0"]').selectOption('1');
  await expect(tortilaStrategyBucket(page, 'System 1 (20/10)').locator('td[data-label="Coin candidates"]')).toContainText('#1 XRP/USDT:USDT');
  await page.locator('input[name="risk_0"]').fill('0.7');
  await expect(tortilaStrategyBucket(page, 'System 1 (20/10)').locator('td[data-label="Coin candidates"]')).toContainText('risk 0.7%');
  await expect(page.getByText('Manual symbol override').first()).toBeVisible();
  await expect(page.getByText('Turtle system').first()).toBeVisible();
  await expect(page.getByText('Runtime export preview (draft)')).toBeVisible();
  await expect(page.getByText('Generated SYMBOL_CONFIGS (draft)')).toBeVisible();
  await expect(page.getByLabel('Generated SYMBOL_CONFIGS draft')).toContainText('XRP/USDT:USDT@4h@1@0.007@2@1@4@20@0');
  await expect(page.getByText('Copy draft is for manual review only')).toBeVisible();
  await expect(page.getByText('Download config export uses the last saved WTC reference version')).toBeVisible();
  const copyDraft = page.getByRole('button', { name: 'Copy draft SYMBOL_CONFIGS' });
  await expect(copyDraft).toBeEnabled();
  await expect(copyDraft).toHaveAttribute('data-copy-value', /XRP\/USDT:USDT@4h@1@0\.007@2@1@4@20@0/);
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
  await expect(page.getByText('Bot setup control center')).toBeVisible();
  await expect(page.getByText('Settings continuity monitor')).toBeVisible();
  await expect(page.locator('td[data-label="Proof"]', { hasText: 'settings evidence rows' }).first()).toBeVisible();
  await expect(setupLayer(page, 'Default or custom')).toBeVisible();
  await expect(setupLayer(page, 'Provider pub_id')).toBeVisible();
  await expect(setupLayer(page, 'Coin and stage map')).toBeVisible();
  await expect(page.getByText('Basic settings path')).toBeVisible();
  await expect(quickPathLayer(page, '2. Coin trigger').locator('td[data-label="What it means"]')).toContainText('each active coin consumes one trigger slot');
  await expect(quickPathLayer(page, '3. Stage slots').locator('td[data-label="What it means"]')).toContainText('Multiple RSI or CCI coins');
  await expect(quickPathLayer(page, '4. Provider link').locator('td[data-label="What it means"]')).toContainText('read-only evidence');
  await expect(quickPathLayer(page, '6. Save and export').locator('td[data-label="Status"]')).toContainText('Export blocked');
  await expect(quickPathLayer(page, '7. Live boundary').locator('td[data-label="What it means"]')).toContainText('provider mutation');
  await expect(page.getByText('Effective settings review')).toBeVisible();
  await expect(page.getByText('Effective Legacy settings review')).toBeVisible();
  await expect(page.getByText('How this bot will operate')).toBeVisible();
  await expect(operationLayer(page, '2. Coin trigger map')).toBeVisible();
  await expect(operationLayer(page, '4. Runtime evidence')).toBeVisible();
  await expect(page.getByText('Signal map')).toBeVisible();
  await expect(page.getByText('Legacy strategy map')).toBeVisible();
  await expect(page.getByText('One coin uses one trigger: RSI or CCI')).toBeVisible();
  await expect(page.getByText('A coin consumes one slot in its selected stage and trigger bucket')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trigger resolution map' })).toBeVisible();
  await expect(page.getByText('independent trigger candidates')).toBeVisible();
  await expect(page.getByText('WTC does not assign a hidden priority order from this page')).toBeVisible();
  await expect(page.getByText('Paused rows and blank coin rows are excluded from this draft map')).toBeVisible();
  await expect(resolutionCell(page, 'RSI candidates').first()).toBeVisible();
  await expect(resolutionCell(page, 'CCI candidates').first()).toBeVisible();
  await expect(resolutionCell(page, 'RSI candidates').filter({ hasText: '#1' }).first()).toBeVisible();
  await page.locator('select[name="legacy_signal_0"]').selectOption('cci');
  await expect(resolutionCell(page, 'CCI candidates').filter({ hasText: '#1' }).first()).toBeVisible();
  await page.locator('input[name="legacy_stage_0"]').fill('2');
  await expect(resolutionStage(page, 'Stage 2').locator('td[data-label="CCI candidates"]')).toContainText('#1');
  await expect(page.getByText(/Stage 1 \/ RSI slot|Stage 1 \/ CCI slot/).first()).toBeVisible();
  await expect(page.getByText(/RSI trigger threshold|CCI trigger threshold/).first()).toBeVisible();
  await expect(page.getByText('Stage slot group').first()).toBeVisible();
  await expect(page.getByText('Manual symbol override').first()).toBeVisible();
  await expect(page.getByText('Delay filter').first()).toBeVisible();
  await expect(page.getByText('Delta filter').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stage capacity' })).toBeVisible();
  await expect(page.getByText('RSI used').first()).toBeVisible();
  await expect(page.getByText('CCI used').first()).toBeVisible();
  await expect(page.getByText(/inside capacity|full|over capacity/).first()).toBeVisible();
  await expect(page.locator('input[name="legacy_stage_rsi_0"]')).toBeVisible();
  await expect(page.locator('input[name="legacy_stage_cci_0"]')).toBeVisible();
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
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/settings\?err=config&issue=tortila-row-risk&row=1/);
  await expect(setupLayer(page, 'Validation issue')).toBeVisible();
  const fixRowLink = page.getByRole('link', { name: 'Fix row' });
  await expect(fixRowLink).toHaveAttribute('href', '#tortila-symbol-1');
  const rowAlert = page.locator('#tortila-symbol-1 [role="alert"]');
  await expect(rowAlert).toBeVisible();
  await fixRowLink.click();
  await expect(page).toHaveURL(/#tortila-symbol-1$/);
  expect(await targetInViewport(page, '#tortila-symbol-1 [role="alert"]'), 'Tortila row alert is visible after Fix row').toBe(true);
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
  await page.locator('input[name="maxOpenSymbols"]').fill('21');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/settings\?err=config&issue=tortila-portfolio-limit/);
  await expect(setupLayer(page, 'Validation issue')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fix caps' })).toHaveAttribute('href', '#tortila-portfolio-caps');
  await expect(page.getByRole('link', { name: 'Fix row' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Fix stage' })).toHaveCount(0);
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
  await page.locator('input[name="maxNewEntriesPerTick"]').fill('21');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/tortila\/settings\?err=config&issue=tortila-entry-throttle/);
  await expect(setupLayer(page, 'Validation issue')).toBeVisible();
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
  await page.getByText('Position sizing, averaging ladder, delay/delta filters').first().click();
  await page.locator('input[name="legacy_levels_0"]').fill('4');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/legacy\/settings\?err=config&issue=legacy-row-ladder&row=1/);
  await expect(setupLayer(page, 'Validation issue')).toBeVisible();
  const fixRowLink = page.getByRole('link', { name: 'Fix row' });
  await expect(fixRowLink).toHaveAttribute('href', '#legacy-symbol-1');
  const rowAlert = page.locator('#legacy-symbol-1 [role="alert"]');
  await expect(rowAlert).toBeVisible();
  await fixRowLink.click();
  await expect(page).toHaveURL(/#legacy-symbol-1$/);
  expect(await targetInViewport(page, '#legacy-symbol-1 [role="alert"]'), 'Legacy row alert is visible after Fix row').toBe(true);
  await expect(rowAlert.getByText('Fix Legacy coin slot 1')).toBeVisible();
  await expect(rowAlert.getByText('Drop ladder and volume ladder must be comma-separated numbers')).toBeVisible();
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy invalid settings scrolls horizontally').toBe(true);
});

test('Legacy invalid stage capacity returns a stage-targeted save error', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/legacy/settings');
  await page.locator('input[name="legacy_stage_rsi_0"]').fill('99');
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(page).toHaveURL(/\/app\/bots\/legacy\/settings\?err=config&issue=legacy-stage-capacity&row=1/);
  await expect(setupLayer(page, 'Validation issue')).toBeVisible();
  const fixStageLink = page.getByRole('link', { name: 'Fix stage' });
  await expect(fixStageLink).toHaveAttribute('href', '#legacy-stage-1');
  const stageAlert = page.locator('#legacy-stage-1-save-error');
  await expect(stageAlert).toBeVisible();
  await fixStageLink.click();
  await expect(page).toHaveURL(/#legacy-stage-1$/);
  expect(await targetInViewport(page, '#legacy-stage-1-save-error'), 'Legacy stage alert is visible after Fix stage').toBe(true);
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
  await expect(page.getByText('Connection verified')).toHaveCount(0);
  expect(await noHScroll(page), 'Admin bot defaults scrolls horizontally').toBe(true);
  await page.screenshot({ path: shot('admin-bot-defaults', info.project.name), fullPage: true });
});

test('Legacy stage over-capacity advisory routes from setup control center', async ({ page }) => {
  await loginUser(page);

  await page.goto('/app/bots/legacy/settings');
  const draftRsiSlots = await fillLegacyStageDraftCap(page, 'legacy_stage_rsi_0');
  const draftCciSlots = await fillLegacyStageDraftCap(page, 'legacy_stage_cci_0');
  const liveStagePreview = page.locator('#legacy-stage-1');
  await expect(liveStagePreview.getByText(new RegExp(`/${draftRsiSlots} RSI used`))).toBeVisible();
  await expect(liveStagePreview.getByText(new RegExp(`/${draftCciSlots} CCI used`))).toBeVisible();
  await expect(liveStagePreview.getByText('over capacity')).toBeVisible();
  await expect(setupLayer(page, 'Draft stage capacity warning')).toBeVisible();
  await expect(page.getByText(/Unsaved draft preview: Stage 1 uses .* RSI slots and .* CCI slots/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review stage' })).toHaveAttribute('href', '#legacy-stage-1');
  await expect(page.getByText(/\d+ over capacity/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save custom settings' }).click();

  await expect(setupLayer(page, 'Stage capacity warning')).toBeVisible();
  await expect(page.getByText(/Stage 1 uses .* RSI slots and .* CCI slots/)).toBeVisible();
  const settingsReviewStageLink = page.getByRole('link', { name: 'Review stage' });
  await expect(settingsReviewStageLink).toHaveAttribute('href', '#legacy-stage-1');
  await settingsReviewStageLink.click();
  await expect(page).toHaveURL(/#legacy-stage-1$/);
  expect(await targetInViewport(page, '#legacy-stage-1'), 'Legacy over-capacity stage is visible from settings Review stage').toBe(true);
  await expect(page.getByText('over capacity').first()).toBeVisible();
  await expect(page.getByText(/Connection verified|applyConfig|startBot|stopBot/)).toHaveCount(0);
  expect(await noHScroll(page), 'Legacy over-capacity settings scrolls horizontally').toBe(true);

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
