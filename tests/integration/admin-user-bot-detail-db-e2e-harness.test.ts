import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const rootPkg = read('package.json');
const runner = read('scripts/run-admin-user-bot-detail-e2e.mjs');
const managedRunner = read('scripts/run-admin-user-bot-detail-e2e-managed.mjs');
const prepare = read('scripts/prepare-admin-user-bot-detail-e2e.ts');
const config = read('playwright.admin-user-bots-db.config.ts');
const defaultConfig = read('playwright.config.ts');
const spec = read('tests/e2e/admin-user-bot-detail-db.spec.ts');
const userRouteSpec = read('tests/e2e/user-bot-routes-db.spec.ts');

function runManaged(args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/run-admin-user-bot-detail-e2e-managed.mjs', ...args], {
    cwd: root,
    env: { ...process.env, ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL: '' },
    encoding: 'utf8',
  });
}

describe('admin user bot detail DB e2e harness', () => {
  it('is registered as an opt-in script and excluded from default gates', () => {
    const scripts = JSON.parse(rootPkg).scripts as Record<string, string>;
    expect(scripts['e2e:admin-user-bots:db']).toBe('node scripts/run-admin-user-bot-detail-e2e.mjs');
    expect(scripts['e2e:admin-user-bots:db:managed']).toBe('node scripts/run-admin-user-bot-detail-e2e-managed.mjs');
    expect(scripts['e2e:admin-user-bots:db:managed:matrix']).toBe('node scripts/run-admin-user-bot-detail-e2e-managed.mjs --matrix');
    expect(scripts['e2e:admin-user-bots:db:user-routes']).toBe('node scripts/run-admin-user-bot-detail-e2e.mjs --user-routes');
    expect(scripts['e2e:admin-user-bots:db:managed:user-routes']).toBe('node scripts/run-admin-user-bot-detail-e2e-managed.mjs --user-routes');
    expect(scripts.e2e).not.toContain('admin-user-bots');
    expect(scripts['ci:local']).not.toContain('admin-user-bots');
    expect(defaultConfig).toContain('/admin-user-bot-detail-db\\.spec\\.ts/');
    expect(defaultConfig).toContain('/user-bot-routes-db\\.spec\\.ts/');
  });

  it('requires an explicit prepared throwaway database marker before Playwright can start', () => {
    expect(prepare).toContain('assertThrowawayDbName');
    expect(prepare).toContain('/^wtc_test(?:_[a-z0-9]+)*$/');
    expect(prepare).toContain('information_schema.tables');
    expect(prepare).toContain('is not empty');
    expect(prepare).toContain('admin-user-bots-e2e-prepared.json');
    expect(prepare).toContain('ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO');
    expect(prepare).toContain("['degraded-readable', 'fresh-green', 'stale', 'missing']");
    expect(prepare).toContain('parseRuntimeHealthScenario');
    expect(prepare).toContain('seedRuntimeHealthScenario');
    expect(prepare).toContain("target: 'worker'");
    expect(prepare).toContain("botContinuityStatus: 'ok'");
    expect(prepare).toContain("botContinuityStatus: 'attention'");
    expect(prepare).toContain("checkedAt: new Date(Date.now() - 10 * 60 * 1000)");
    expect(prepare).toContain('WORKER_SECRET_MARKER_SHOULD_NOT_RENDER');
    expect(prepare).toContain('runtimeScenario: prepared.runtimeScenario');
    expect(prepare).toContain('userRoutes: prepared.userRoutes');
    expect(prepare).toContain('urlHmacSha256');
    expect(config).toContain("ADMIN_USER_BOTS_E2E !== '1'");
    expect(config).toContain('ADMIN_USER_BOTS_E2E_DATABASE_URL');
    expect(config).toContain('admin-user-bots-e2e-prepared.json');
    expect(config).toContain('urlHmacSha256');
    expect(config).toContain('prep marker does not match');
    expect(config).toContain("ADMIN_USER_BOTS_E2E_USER_ROUTES === '1'");
    expect(config).toContain('prep marker was not prepared for user-route proof mode');
  });

  it('seeds selected-user bot state and forbidden leak markers without live control', () => {
    expect(prepare).toContain('Drilldown User A');
    expect(prepare).toContain('Drilldown User B');
    expect(prepare).toContain('A_ONLY_SYMBOL');
    expect(prepare).toContain('USER_A_LEGACY_SYMBOL');
    expect(prepare).toContain('A_ONLY_POSITION_SYMBOL');
    expect(prepare).toContain('USER_A_LEGACY_POSITION_SYMBOL');
    expect(prepare).toContain('A_ONLY_TRADE_SYMBOL');
    expect(prepare).toContain('USER_A_LEGACY_TRADE_SYMBOL');
    expect(prepare).toContain('USER_B_TRADE_SYMBOL_MUST_NOT_LEAK');
    expect(prepare).toContain('USER_A_SEALED_SECRET_SHOULD_NOT_RENDER');
    expect(prepare).toContain('USER_B_SEALED_SECRET_MUST_NOT_LEAK');
    expect(prepare).toContain('tortila-journal');
    expect(prepare).toContain('legacy-bot');
    expect(prepare).toContain('readStateDetail');
    expect(prepare).toContain('Tortila selected-user runtime snapshot is readable but degraded.');
    expect(prepare).toContain('Legacy selected-user runtime snapshot is readable but degraded.');
    expect(prepare).toContain('Tortila selected-user runtime snapshot is fresh.');
    expect(prepare).toContain('Legacy selected-user runtime snapshot is fresh.');
    expect(prepare).toContain('Tortila selected-user runtime snapshot is stale for acceptance proof.');
    expect(prepare).toContain('Legacy selected-user runtime snapshot is stale for acceptance proof.');
    expect(prepare).toContain('DEMO_PASSWORD');
    expect(prepare).toContain('hashPassword(DEMO_PASSWORD)');
    expect(prepare).toContain("const runUserRoutes = process.env.ADMIN_USER_BOTS_E2E_USER_ROUTES === '1'");
    expect(prepare).toContain('USER_ROUTE_TORTILA_CONFIG_SYMBOL');
    expect(prepare).toContain("symbols: 'USER_ROUTE_TORTILA_CONFIG_SYMBOL'");
    expect(prepare).toContain('symbolConfigs: [');
    expect(prepare).toContain("symbol: 'USER_ROUTE_TORTILA_CONFIG_SYMBOL'");
    expect(prepare).toContain("timeframe: '4h'");
    expect(prepare).toContain('stopN: 2');
    expect(prepare).toContain('addStep: 0.5');
    expect(prepare).toContain('maxTotalUnits: 6');
    expect(prepare).toContain('maxUnitsPerDirection: 4');
    expect(prepare).toContain('maxNewEntriesPerTick: 2');
    expect(prepare).toContain('USER_ROUTE_TORTILA_POSITION');
    expect(prepare).toContain('USER_ROUTE_TORTILA_TRADE');
    expect(prepare).toContain('USER_ROUTE_RAW_CONFIG_SHOULD_NOT_RENDER');
    expect(prepare).toContain('USER_ROUTE_RAW_TRADE_SHOULD_NOT_RENDER');
    expect(prepare).toContain("sourceAdapter: 'tortila'");
    expect(prepare).toContain("markPrice: '99999.99000000'");
    expect(prepare).toContain("unrealizedPnlUsd: '8888.8800'");
    expect(prepare).toContain("if (scenario === 'missing') return;");
    expect(prepare).toContain('providerAccountMappingsSeen: 1');
    expect(prepare).toContain('providerAccountMappingsSnapshotted: 1');
    expect(prepare).toContain('closedTradeSourceProof');
    expect(prepare).toContain("status: 'ready_for_mapper'");
    expect(prepare).toContain('SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER');
    expect(prepare).toContain('UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER');
    expect(prepare).toContain('SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER');
    expect(runner).toContain('ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO');
    expect(runner).toContain('--user-routes');
    expect(runner).toContain('ADMIN_USER_BOTS_E2E_USER_ROUTES');
    expect(runner).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(runner).toContain("BOT_ADAPTER_MODE: runUserRoutes ? 'read-only' : 'mock'");
    expect(managedRunner).toContain('--matrix');
    expect(managedRunner).toContain('--user-routes');
    expect(managedRunner).toContain('ADMIN_USER_BOTS_E2E_USER_ROUTES');
    expect(managedRunner).toContain('--matrix and --user-routes are separate acceptance lanes');
    expect(managedRunner).toContain('runtimeScenarios');
    expect(managedRunner).toContain('runManagedScenario');
    expect(managedRunner).toContain('ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO: scenario');
    expect(managedRunner).toContain('scenarioDbSegment');
    expect(config).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(config).toContain("BOT_ADAPTER_MODE: runUserRoutes ? 'read-only' : 'mock'");
    expect(config).toContain('user-bot-routes-db\\.spec\\.ts');
  });

  it('renders selected-user facts and asserts absent mutation/secret markers', () => {
    expect(spec).toContain('/admin/users/${marker.userAId}/bots');
    expect(spec).toContain('storage: Postgres');
    expect(spec).toContain('LIVE CONTROL: DISABLED');
    expect(spec).toContain('user settings: read-only');
    expect(spec).toContain('provider mappings: read-only');
    expect(spec).toContain('Runtime health');
    expect(spec).toContain('Runtime scope');
    expect(spec).toContain('runtimeScenarioFromMarker');
    expect(spec).toContain('RUNTIME_SCENARIO_EXPECTATIONS');
    expect(spec).toContain('workerAttentionState');
    expect(spec).toContain('workerHeartbeatValue');
    expect(spec).toContain('workerEvidence');
    expect(spec).toContain('workerNotes');
    expect(spec).toContain('degraded-readable');
    expect(spec).toContain('fresh-green');
    expect(spec).toContain("statisticsLabel: 'evidence present'");
    expect(spec).toContain("statisticsLabel: 'user evidence present; aggregate worker pending'");
    expect(spec).toContain("workerAttentionState: '0 bots need attention'");
    expect(spec).toContain("workerAttentionState: '2 bots need attention'");
    expect(spec).toContain("workerHeartbeatValue: 'fresh aggregate'");
    expect(spec).toContain("workerHeartbeatValue: 'stale aggregate'");
    expect(spec).toContain("workerHeartbeatValue: 'No aggregate worker row'");
    expect(spec).toContain('Aggregate worker continuity is fresh and tortila snapshot/readState are ok.');
    expect(spec).toContain("Aggregate target='worker' heartbeat is older than the admin freshness window.");
    expect(spec).toContain("No aggregate target='worker' heartbeat row exists yet.");
    expect(spec).toContain('runtime: tortila-journal: ok');
    expect(spec).toContain('runtime: legacy-bot: ok');
    expect(spec).toContain('runtime: tortila-journal: stale');
    expect(spec).toContain('runtime: legacy-bot: stale');
    expect(spec).toContain('runtime: tortila-journal: missing');
    expect(spec).toContain('runtime: legacy-bot: missing');
    expect(spec).toContain('for (const label of scenarioExpectation.runtimePills)');
    expect(spec).toContain('user instance snapshots / tortila-journal: ok');
    expect(spec).toContain('Legacy pub_id USER_A...B_ID / legacy-bot: ok');
    expect(spec).toContain('user instance snapshots / tortila-journal: stale');
    expect(spec).toContain('Legacy pub_id USER_A...B_ID / legacy-bot: stale');
    expect(spec).toContain('No persisted tortila-journal health row exists yet. Run the worker snapshot cycle.');
    expect(spec).toContain('user evidence present; aggregate worker pending');
    expect(spec).toContain('Tortila selected-user runtime snapshot is readable but degraded.');
    expect(spec).toContain('Legacy selected-user runtime snapshot is readable but degraded.');
    expect(spec).toContain('Tortila selected-user runtime snapshot is fresh.');
    expect(spec).toContain('Legacy selected-user runtime snapshot is fresh.');
    expect(spec).toContain('Tortila selected-user runtime snapshot is stale for acceptance proof.');
    expect(spec).toContain('Legacy selected-user runtime snapshot is stale for acceptance proof.');
    expect(spec).toContain('Bot drilldown overview');
    expect(spec).toContain('Selected-user read-only drilldown');
    expect(spec).toContain('Source-proof gate');
    expect(spec).toContain('Journal import gate');
    expect(spec).toContain('journal evidence present');
    expect(spec).toContain('persisted user-instance journal rows');
    expect(spec).toContain('No /api/marks live call is made by this admin view.');
    expect(spec).toContain('keep journal worker monitoring');
    expect(spec).toContain('mapper-ready proof');
    expect(spec).toContain('scoped worker metric');
    expect(spec).toContain('build audited mapper/importer');
    expect(spec).toContain("page.getByLabel('Legacy Bot statistics coverage matrix')");
    expect(spec).toContain("page.getByLabel('Tortila Bot statistics coverage matrix')");
    expect(spec).toContain('const journalImportRow');
    expect(spec).toContain("journalImportRow.getByRole('button')");
    expect(spec).toContain("journalImportRow.getByRole('link')");
    expect(spec).toContain("page.locator('#bot-tortila_bot-runtime + div tbody tr')");
    expect(spec).toContain("td[data-label=\"Mark\"]");
    expect(spec).toContain("td[data-label=\"uPnL\"]");
    expect(spec).toContain("toHaveText('N/A')");
    expect(spec).toContain('const sourceProofRow');
    expect(spec).toContain("sourceProofRow.getByRole('button')");
    expect(spec).toContain("sourceProofRow.getByRole('link')");
    expect(spec).toContain('Statistics come from persisted metric, position, trade, and equity rows already scoped by the admin loader');
    expect(spec).toContain('view-only drilldown');
    expect(spec).toContain('Jump to bot card');
    expect(spec).toContain("getByRole('link', { name: 'Jump to bot card' })");
    expect(spec).toContain('A_ONLY_SYMBOL');
    expect(spec).toContain('USER_A_LEGACY_SYMBOL');
    expect(spec).toContain('USER_B_TRADE_SYMBOL_MUST_NOT_LEAK');
    expect(spec).toContain('USER_A_RAW_CONFIG_SHOULD_NOT_RENDER');
    expect(spec).toContain('UNSCOPED_SOURCE_PROOF_SHOULD_NOT_RENDER');
    expect(spec).toContain('SOURCE_PROOF_API_KEY_SHOULD_NOT_RENDER');
    expect(spec).toContain('SOURCE_PROOF_RAW_PROVIDER_ID_SHOULD_NOT_RENDER');
    expect(spec).toContain('TORTILA_HEALTH_SECRET_SHOULD_NOT_RENDER');
    expect(spec).toContain('WORKER_SECRET_MARKER_SHOULD_NOT_RENDER');
    expect(spec).toContain("page.locator('main form')");
    expect(spec).toContain('main input[type="hidden"][name="csrf"]');
    expect(spec).toContain('getByRole');
    expect(spec).toContain('button');
    expect(spec).toContain('start|stop|apply|test connection');
  });

  it('adds a focused current-user Tortila route proof without creating a second DB lifecycle', () => {
    expect(userRouteSpec).toContain('/app/bots/tortila');
    expect(userRouteSpec).toContain('/app/bots/tortila/positions');
    expect(userRouteSpec).toContain('/app/bots/statistics?bot=tortila');
    expect(userRouteSpec).toContain("loginAs(page, 'admin-drilldown-a@wtc.local')");
    expect(userRouteSpec).toContain('ADMIN_USER_BOTS_E2E_USER_ROUTES');
    expect(userRouteSpec).toContain('USER_ROUTE_TORTILA_CONFIG_SYMBOL');
    expect(userRouteSpec).toContain('USER_ROUTE_TORTILA_POSITION');
    expect(userRouteSpec).toContain('Mark and uPnL unavailable');
    expect(userRouteSpec).toContain("toHaveText('N/A')");
    expect(userRouteSpec).toContain('not.toHaveClass(/wtc-up|wtc-down/)');
    expect(userRouteSpec).toContain("request.url()");
    expect(userRouteSpec).toContain("url.includes('/api/marks')");
    expect(userRouteSpec).toContain('USER_ROUTE_RAW_CONFIG_SHOULD_NOT_RENDER');
    expect(userRouteSpec).toContain('USER_ROUTE_RAW_TRADE_SHOULD_NOT_RENDER');
    expect(userRouteSpec).toContain('99,999.99');
    expect(userRouteSpec).toContain('8,888.88');
    expect(userRouteSpec).toContain('expectNoLeakInText');
    expect(userRouteSpec).toContain("getByRole('button', { name: 'Start bot (disabled)' })");
    expect(rootPkg).not.toContain('run-user-bot-positions-e2e');
    expect(rootPkg).not.toContain('USER_BOT_POSITIONS_E2E');
    expect(config).toContain("testMatch: runUserRoutes ? /user-bot-routes-db\\.spec\\.ts/ : /admin-user-bot-detail-db\\.spec\\.ts/");
  });

  it('managed runner redacts and refuses missing URL or unknown args', () => {
    const help = runManaged(['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db>');
    expect(help.stdout).toContain('--matrix');
    expect(help.stdout).toContain('--user-routes');
    expect(help.stdout).toContain('degraded-readable, fresh-green, stale, missing');
    expect(help.stdout).toContain('wtc_test_admin_user_bots_*');

    const unknown = runManaged(['--wat']);
    expect(unknown.status).toBe(2);
    expect(`${unknown.stdout}${unknown.stderr}`).toContain('unknown argument');

    const missing = runManaged();
    expect(missing.status).toBe(2);
    expect(`${missing.stdout}${missing.stderr}`).toContain('Set ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL');
    expect(`${missing.stdout}${missing.stderr}`).not.toContain('postgres://user:password');

    const matrixUserRoutes = runManaged(['--matrix', '--user-routes']);
    expect(matrixUserRoutes.status).toBe(2);
    expect(`${matrixUserRoutes.stdout}${matrixUserRoutes.stderr}`).toContain('--matrix and --user-routes are separate acceptance lanes');
  });

  it('does not write full database URLs or credentials into files that are likely to be archived', () => {
    for (const source of [runner, managedRunner, prepare, config]) {
      expect(source).not.toMatch(/postgres:\/\/[^<][^\s'"]+:[^\s'"]+@/);
      expect(source).not.toContain('password@');
      expect(source).not.toMatch(/postgres:\/\/\w+:\w+@/);
    }
  });
});
