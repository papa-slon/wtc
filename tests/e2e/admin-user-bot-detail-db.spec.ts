import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loginAdmin } from './helpers/auth';

test.skip(process.env.ADMIN_USER_BOTS_E2E !== '1', 'DB-backed admin user bot detail acceptance is opt-in via npm run e2e:admin-user-bots:db.');
test.describe.configure({ mode: 'serial' });

const shot = (name: string, scenario: string, project: string) => `tests/e2e/screenshots/${name}-${scenario}-${project}.png`;
const marker = JSON.parse(readFileSync('.next-e2e-admin-user-bots/admin-user-bots-e2e-prepared.json', 'utf8')) as {
  userAId?: string;
  runtimeScenario?: string;
};

const runtimeScenarios = ['degraded-readable', 'fresh-green', 'stale', 'missing'] as const;
type RuntimeScenario = (typeof runtimeScenarios)[number];

function runtimeScenarioFromMarker(value: string | undefined): RuntimeScenario {
  if ((runtimeScenarios as readonly string[]).includes(value ?? '')) return value as RuntimeScenario;
  throw new Error(`Prepared admin-user bot detail marker has unsupported runtimeScenario "${value ?? '(missing)'}".`);
}

const RUNTIME_SCENARIO_EXPECTATIONS: Record<RuntimeScenario, {
  runtimePills: readonly string[];
  overviewRuntimeScopes: readonly string[];
  runtimeScopeLabels: readonly string[];
  statisticsLabel: string;
  workerAttentionState: string;
  workerHeartbeatValue: string;
  workerEvidence: string;
  workerNotes: readonly string[];
  notes: readonly string[];
  extraVisibleMarkers: readonly string[];
}> = {
  'degraded-readable': {
    runtimePills: ['runtime: tortila-journal: ok', 'runtime: legacy-bot: ok'],
    overviewRuntimeScopes: ['user instance snapshots / tortila-journal: ok', 'Legacy pub_id USER_A...B_ID / legacy-bot: ok'],
    runtimeScopeLabels: ['tortila-journal: ok', 'legacy-bot: ok'],
    statisticsLabel: 'user evidence present; aggregate worker pending',
    workerAttentionState: '2 bots need attention',
    workerHeartbeatValue: 'fresh aggregate',
    workerEvidence: 'Tortila Bot: fresh aggregate / attention; not selected-user proof without scoped rows / Legacy Bot: fresh aggregate / attention; not selected-user proof without scoped rows',
    workerNotes: [
      "Aggregate target='worker' is not green for tortila: worker=not_configured, botContinuity=attention, snapshot=ok, readState=ok.",
      "Aggregate target='worker' is not green for legacy: worker=not_configured, botContinuity=attention, snapshot=ok, readState=ok.",
    ],
    notes: [
      'Tortila selected-user runtime snapshot is readable but degraded.',
      'Legacy selected-user runtime snapshot is readable but degraded.',
    ],
    extraVisibleMarkers: ['fill_lookup_109421', 'legacy_quarantined'],
  },
  'fresh-green': {
    runtimePills: ['runtime: tortila-journal: ok', 'runtime: legacy-bot: ok'],
    overviewRuntimeScopes: ['user instance snapshots / tortila-journal: ok', 'Legacy pub_id USER_A...B_ID / legacy-bot: ok'],
    runtimeScopeLabels: ['tortila-journal: ok', 'legacy-bot: ok'],
    statisticsLabel: 'evidence present',
    workerAttentionState: '0 bots need attention',
    workerHeartbeatValue: 'fresh aggregate',
    workerEvidence: 'Tortila Bot: fresh aggregate / ok; not selected-user proof without scoped rows / Legacy Bot: fresh aggregate / ok; not selected-user proof without scoped rows',
    workerNotes: [
      'Aggregate worker continuity is fresh and tortila snapshot/readState are ok.',
      'Aggregate worker continuity is fresh and legacy snapshot/readState are ok.',
    ],
    notes: [
      'Tortila selected-user runtime snapshot is fresh.',
      'Legacy selected-user runtime snapshot is fresh.',
    ],
    extraVisibleMarkers: [],
  },
  stale: {
    runtimePills: ['runtime: tortila-journal: stale', 'runtime: legacy-bot: stale'],
    overviewRuntimeScopes: ['user instance snapshots / tortila-journal: stale', 'Legacy pub_id USER_A...B_ID / legacy-bot: stale'],
    runtimeScopeLabels: ['tortila-journal: stale', 'legacy-bot: stale'],
    statisticsLabel: 'user evidence present; aggregate worker pending',
    workerAttentionState: '2 bots need attention',
    workerHeartbeatValue: 'stale aggregate',
    workerEvidence: 'Tortila Bot: stale aggregate / ok; not selected-user proof without scoped rows / Legacy Bot: stale aggregate / ok; not selected-user proof without scoped rows',
    workerNotes: [
      "Aggregate target='worker' heartbeat is older than the admin freshness window.",
    ],
    notes: [
      'Tortila selected-user runtime snapshot is stale for acceptance proof.',
      'Legacy selected-user runtime snapshot is stale for acceptance proof.',
    ],
    extraVisibleMarkers: [],
  },
  missing: {
    runtimePills: ['runtime: tortila-journal: missing', 'runtime: legacy-bot: missing'],
    overviewRuntimeScopes: ['user instance snapshots / tortila-journal: missing', 'Legacy pub_id USER_A...B_ID / legacy-bot: missing'],
    runtimeScopeLabels: ['tortila-journal: missing', 'legacy-bot: missing'],
    statisticsLabel: 'user evidence present; aggregate worker pending',
    workerAttentionState: '2 bots need attention',
    workerHeartbeatValue: 'No aggregate worker row',
    workerEvidence: 'Tortila Bot: missing aggregate / unknown; not selected-user proof without scoped rows / Legacy Bot: missing aggregate / unknown; not selected-user proof without scoped rows',
    workerNotes: [
      "No aggregate target='worker' heartbeat row exists yet. Run the worker snapshot cycle before selected-user launch readiness can be green.",
    ],
    notes: [
      'No persisted tortila-journal health row exists yet. Run the worker snapshot cycle.',
      'No persisted legacy-bot health row exists yet. Run the worker snapshot cycle.',
    ],
    extraVisibleMarkers: [],
  },
} as const;

const runtimeScenario = runtimeScenarioFromMarker(marker.runtimeScenario);
const scenarioExpectation = RUNTIME_SCENARIO_EXPECTATIONS[runtimeScenario];

const COMMON_VISIBLE_MARKERS = [
  'Drilldown User A',
  'admin-drilldown-a@wtc.local',
  'storage: Postgres',
  'LIVE CONTROL: DISABLED',
  'user settings: read-only',
  'provider mappings: read-only',
  'Runtime health',
  'Runtime scope',
  'Worker attention',
  'A_ONLY_SYMBOL',
  'USER_A_LEGACY_SYMBOL',
  'USER_A_EXCHANGE_ONLY',
  '****A111',
  'USER_A_LATEST_SOURCE',
  'USER_A_LEGACY_SCOPED_SOURCE',
  'A_ONLY_POSITION_SYMBOL',
  'USER_A_LEGACY_POSITION_SYMBOL',
  'A_ONLY_TRADE_SYMBOL',
  'USER_A_LEGACY_TRADE_SYMBOL',
  'USER_A_TORTILA_POSITION_SOURCE',
  'USER_A_LEGACY_POSITION_SOURCE',
  'USER_A_TORTILA_TRADE_SOURCE',
  'USER_A_LEGACY_TRADE_SOURCE',
  'Bot drilldown overview',
  'Selected-user read-only drilldown',
  'Admin launch readiness mirror',
  'Aggregate worker precheck',
  'Journal import gate',
  'journal evidence present',
  'persisted user-instance journal rows',
  'No /api/marks live call is made by this admin view.',
  'keep journal worker monitoring',
  'Source-proof gate',
  'mapper-ready proof',
  'scoped worker metric',
  'Source contract is mapper-ready; importer replay still needs its own gate.',
  'build audited mapper/importer',
  'not selected-user proof',
  'no live probe',
  'Selected-user evidence ladder',
  'Read-only admin evidence',
  'Statistics come from persisted metric, position, trade, and equity rows already scoped by the admin loader',
  'view-only drilldown',
  'Jump to bot card',
  'Canonical warning summary',
  'System provider mappings',
] as const;

const HIDDEN_MARKERS = [
  'Drilldown User B',
  'admin-drilldown-b@wtc.local',
  'USER_B_EXCHANGE_MUST_NOT_LEAK',
  'USER_B_LEGACY_PUB_ID_MUST_NOT_LEAK',
  'USER_B_LEGACY_PUB_ID',
  'USER_B_LATEST_SOURCE_MUST_NOT_LEAK',
  'USER_B_POSITION_SYMBOL_MUST_NOT_LEAK',
  'USER_B_POSITION_SOURCE_MUST_NOT_LEAK',
  'USER_B_TRADE_ID_MUST_NOT_LEAK',
  'USER_B_TRADE_SYMBOL_MUST_NOT_LEAK',
  'USER_B_TRADE_SOURCE_MUST_NOT_LEAK',
  'USER_B_RAW_TRADE_MUST_NOT_LEAK',
  'USER_B_RAW_CONFIG_MUST_NOT_LEAK',
  'USER_B_HISTORY_CONFIG_MUST_NOT_LEAK',
  'USER_B_SEALED_SECRET_MUST_NOT_LEAK',
  'key-user-b-secret-must-not-leak',
  '****B999',
  'B_ONLY_SYMBOL',
  'USER_A_LEGACY_PUB_ID',
  'USER_A_RAW_CONFIG_SHOULD_NOT_RENDER',
  'USER_A_LEGACY_RAW_CONFIG_SHOULD_NOT_RENDER',
  'USER_A_HISTORY_CONFIG_SHOULD_NOT_RENDER',
  'USER_A_TORTILA_RAW_TRADE_SHOULD_NOT_RENDER',
  'USER_A_LEGACY_RAW_TRADE_SHOULD_NOT_RENDER',
  'USER_A_LEGACY_NULL_FLEET_SHOULD_NOT_RENDER',
  'UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER',
  'SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER',
  'SOURCE_PROOF_PAYLOAD_ALLOWLIST_SHOULD_NOT_RENDER',
  'SOURCE_PROOF_BLOCKER_SHOULD_NOT_RENDER',
  'SOURCE_PROOF_EVIDENCE_REF_SHOULD_NOT_RENDER',
  'SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER',
  'SOURCE_PROOF_RAW_API_KEY_SHOULD_NOT_RENDER',
  'USER_A_LEGACY_UNSCOPED_POSITION_SHOULD_NOT_RENDER',
  'USER_A_LEGACY_UNSCOPED_POSITION',
  'USER_A_LEGACY_UNSCOPED_TRADE_ID',
  'USER_A_LEGACY_UNSCOPED_TRADE',
  'USER_A_LEGACY_UNSCOPED_TRADE_SOURCE_SHOULD_NOT_RENDER',
  'USER_A_LEGACY_UNSCOPED_RAW_TRADE_SHOULD_NOT_RENDER',
  'USER_A_SEALED_SECRET_SHOULD_NOT_RENDER',
  'key-user-a-secret-should-not-render',
  'TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER',
  'LEGACY_HEALTH_SECRET_SHOULD_NOT_RENDER',
  'WORKER_SECRET_MARKER_SHOULD_NOT_RENDER',
  'PROVIDER_REASON_SHOULD_NOT_RENDER',
  'hash-user-a-should-never-render',
  'hash-user-b-should-never-render',
  'passwordHash',
  'apiSecret',
  'apiKey',
  'sealed',
  'token=',
  'Map Legacy pub_id',
  'Apply config',
  'Start bot',
  'Stop bot',
  'Test connection',
  'Connection verified',
] as const;

const ACTION_COPY_MARKERS = new Set(['Apply config', 'Start bot', 'Stop bot', 'Test connection', 'Connection verified']);

async function expectNoHScroll(page: Page, label: string): Promise<void> {
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(noHScroll, `${label} scrolls horizontally`).toBe(true);
}

async function expectTextPresent(page: Page, text: string): Promise<void> {
  expect(await page.getByText(text).count(), `visible text marker "${text}"`).toBeGreaterThanOrEqual(1);
}

function expectNoLeakInText(text: string, markers: readonly string[]): void {
  const normalizedText = text.toLowerCase();
  for (const marker of markers) {
    expect(text).not.toContain(marker);
    if (!ACTION_COPY_MARKERS.has(marker)) expect(normalizedText).not.toContain(marker.toLowerCase());
    expect(text).not.toContain(Buffer.from(marker, 'utf8').toString('base64'));
  }
}

test('DB-backed admin user bot detail renders selected-user facts without edit or secret leaks', async ({ page }, info) => {
  expect(marker.userAId, 'prepared selected user id').toBeTruthy();
  expect(marker.runtimeScenario).toBe(runtimeScenario);
  await loginAdmin(page);
  await page.goto(`/admin/users/${marker.userAId}/bots`);

  await expect(page.getByRole('heading', { name: 'Drilldown User A bot details' })).toBeVisible();
  await expect(page.getByText('storage: Postgres')).toBeVisible();
  await expect(page.getByText('LIVE CONTROL: DISABLED')).toBeVisible();
  await expect(page.getByText('user settings: read-only')).toBeVisible();
  await expect(page.getByText('provider mappings: read-only')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'User', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bot drilldown overview' })).toBeVisible();
  await expect(page.getByText('Selected-user read-only drilldown')).toBeVisible();
  await expect(page.getByText(scenarioExpectation.workerAttentionState)).toHaveCount(2);
  expect(await page.getByText('Runtime health').count()).toBeGreaterThanOrEqual(2);
  expect(await page.getByText('Runtime scope').count()).toBeGreaterThanOrEqual(2);
  for (const label of scenarioExpectation.runtimePills) await expectTextPresent(page, label);
  for (const label of scenarioExpectation.overviewRuntimeScopes) await expectTextPresent(page, label);
  await expectTextPresent(page, scenarioExpectation.statisticsLabel);
  for (const note of scenarioExpectation.notes) await expectTextPresent(page, note);
  await expect(page.getByText(scenarioExpectation.workerHeartbeatValue).first()).toBeVisible();
  for (const note of scenarioExpectation.workerNotes) {
    await expect(page.getByText(note).first()).toBeVisible();
  }
  expect(await page.getByText('Selected-user evidence ladder').count()).toBeGreaterThanOrEqual(2);
  expect(await page.getByText('Admin launch readiness mirror').count()).toBeGreaterThanOrEqual(2);
  expect(await page.getByText('Aggregate worker precheck').count()).toBeGreaterThanOrEqual(3);
  expect(await page.getByText('no live probe').count()).toBeGreaterThanOrEqual(2);
  expect(await page.getByText('Read-only admin evidence').count()).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole('link', { name: 'Jump to bot card' })).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Tortila Bot' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Legacy Bot' })).toBeVisible();
  await expect(page.getByText('Stats scope')).toHaveCount(2);
  await expect(page.getByText('provider account').first()).toBeVisible();
  await expect(page.getByText('user instance').first()).toBeVisible();

  const visibleText = await page.locator('body').innerText();
  const visibleMarkers = [
    ...COMMON_VISIBLE_MARKERS,
    ...scenarioExpectation.runtimePills,
    ...scenarioExpectation.overviewRuntimeScopes,
    ...scenarioExpectation.runtimeScopeLabels,
    scenarioExpectation.statisticsLabel,
    scenarioExpectation.workerAttentionState,
    scenarioExpectation.workerEvidence,
    scenarioExpectation.workerHeartbeatValue,
    ...scenarioExpectation.workerNotes,
    ...scenarioExpectation.notes,
    ...scenarioExpectation.extraVisibleMarkers,
  ];
  const visibleTextLower = visibleText.toLowerCase();
  for (const markerText of visibleMarkers) expect(visibleTextLower).toContain(markerText.toLowerCase());
  expect(visibleText).toContain('USER_A...B_ID');
  expectNoLeakInText(visibleText, HIDDEN_MARKERS);

  const legacyCoverage = page.getByLabel('Legacy Bot statistics coverage matrix');
  const tortilaCoverage = page.getByLabel('Tortila Bot statistics coverage matrix');
  const journalImportRow = tortilaCoverage.locator('tbody tr').filter({ hasText: 'Journal import gate' });
  await expect(journalImportRow).toHaveCount(1);
  await expect(journalImportRow).toContainText('journal evidence present');
  await expect(journalImportRow).toContainText('persisted user-instance journal rows');
  await expect(journalImportRow).toContainText('No /api/marks live call is made by this admin view.');
  await expect(journalImportRow).toContainText('keep journal worker monitoring');
  await expect(journalImportRow.getByRole('button')).toHaveCount(0);
  await expect(journalImportRow.getByRole('link')).toHaveCount(0);
  await expect(legacyCoverage.getByText('Journal import gate')).toHaveCount(0);

  const tortilaPositionRow = page.locator('#bot-tortila_bot-runtime + div tbody tr').filter({ hasText: 'A_ONLY_POSITION_SYMBOL' });
  await expect(tortilaPositionRow).toHaveCount(1);
  await expect(tortilaPositionRow.locator('td[data-label="Mark"]')).toHaveText('N/A');
  await expect(tortilaPositionRow.locator('td[data-label="uPnL"]')).toHaveText('N/A');

  const sourceProofRow = legacyCoverage.locator('tbody tr').filter({ hasText: 'Source-proof gate' });
  await expect(sourceProofRow).toHaveCount(1);
  await expect(sourceProofRow).toContainText('mapper-ready proof');
  await expect(sourceProofRow).toContainText('scoped worker metric');
  await expect(sourceProofRow).toContainText('Source contract is mapper-ready; importer replay still needs its own gate.');
  await expect(sourceProofRow).toContainText('build audited mapper/importer');
  await expect(sourceProofRow.getByRole('button')).toHaveCount(0);
  await expect(sourceProofRow.getByRole('link')).toHaveCount(0);
  await expect(tortilaCoverage.getByText('Source-proof gate')).toHaveCount(0);

  await expect(page.locator('main form')).toHaveCount(0);
  await expect(page.locator('main input[type="hidden"][name="csrf"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /start|stop|apply|test connection/i })).toHaveCount(0);
  await expectNoHScroll(page, `/admin/users/${marker.userAId}/bots`);
  await page.screenshot({ path: shot('admin-user-bot-detail-db', runtimeScenario, info.project.name), fullPage: true });
});
