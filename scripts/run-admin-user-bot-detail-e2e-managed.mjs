#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const args = process.argv.slice(2);
const runtimeScenarios = ['degraded-readable', 'fresh-green', 'stale', 'missing'];
const defaultRuntimeScenario = 'degraded-readable';
const allowedArgs = new Set(['--help', '-h', '--matrix', '--user-routes']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const adminUrl = process.env.ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL;
const runMatrix = args.includes('--matrix');
const runUserRoutes = args.includes('--user-routes') || process.env.ADMIN_USER_BOTS_E2E_USER_ROUTES === '1';

function usage() {
  console.log(
    [
      'Usage: ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run e2e:admin-user-bots:db:managed',
      '       ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run e2e:admin-user-bots:db:managed -- --matrix',
      '       ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run e2e:admin-user-bots:db:managed -- --user-routes',
      '       ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db> npm run e2e:admin-user-bots:db:managed:user-routes',
      '',
      'Creates a fresh wtc_test_admin_user_bots_* database, delegates to npm run e2e:admin-user-bots:db, then drops it.',
      `Single-scenario mode uses ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO or ${defaultRuntimeScenario}.`,
      `Matrix mode runs: ${runtimeScenarios.join(', ')}.`,
      'User-routes mode reuses the same throwaway DB lifecycle and runs the current-user Tortila route proof in read-only adapter mode.',
      'The admin URL must point at a non-throwaway maintenance database such as postgres.',
      'Do not archive full URLs, passwords, cookies, raw env dumps, Playwright traces, or unreviewed artifacts.',
    ].join('\n'),
  );
}

function parseAdminUrl(raw) {
  if (!raw) {
    throw new Error(
      'Set ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL to a local/admin Postgres URL that can CREATE/DROP DATABASE. ' +
        'This runner creates a fresh wtc_test_admin_user_bots_* database and then runs npm run e2e:admin-user-bots:db.',
    );
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Admin user bot detail DB managed runner refused: ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL is not a valid URL.');
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error('Admin user bot detail DB managed runner refused: admin URL must use postgres:// or postgresql://.');
  }
  const adminDb = parsed.pathname.replace(/^\//, '').toLowerCase();
  if (!adminDb || /^wtc_test(?:_|$)/.test(adminDb)) {
    throw new Error('Admin user bot detail DB managed runner refused: admin URL must point at a non-throwaway maintenance database.');
  }
  return parsed;
}

export function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

function parseRuntimeScenario(raw) {
  const value = raw || defaultRuntimeScenario;
  if (!runtimeScenarios.includes(value)) {
    throw new Error(
      `Admin user bot detail DB managed runner refused: ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO "${value}" is not supported. ` +
        `Use one of: ${runtimeScenarios.join(', ')}.`,
    );
  }
  return value;
}

function scenarioDbSegment(scenario) {
  return scenario.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function buildDbName(scenario) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `wtc_test_admin_user_bots_${scenarioDbSegment(scenario)}_${stamp}_${randomBytes(3).toString('hex')}`;
}

function buildTargetUrl(admin, dbName) {
  const target = new URL(admin.toString());
  target.pathname = `/${dbName}`;
  return target.toString();
}

function runExistingHarness(targetUrl, scenario) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = runRedactedChildProcess(npm, ['run', 'e2e:admin-user-bots:db'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ADMIN_USER_BOTS_E2E_DATABASE_URL: targetUrl,
      ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO: scenario,
      ADMIN_USER_BOTS_E2E_USER_ROUTES: runUserRoutes ? '1' : '0',
    },
    windowsHide: true,
  });
  if (result.signal) {
    console.error(`npm run e2e:admin-user-bots:db stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

async function runManagedScenario(adminSql, admin, scenario) {
  const dbName = buildDbName(scenario);
  const targetUrl = buildTargetUrl(admin, dbName);
  let created = false;
  let exitCode = 0;

  try {
    await adminSql`CREATE DATABASE ${adminSql(dbName)}`;
    created = true;
    console.log(`Created admin user bot detail DB e2e throwaway database ${dbName} for scenario ${scenario}.`);
    exitCode = runExistingHarness(targetUrl, scenario);
  } catch (error) {
    console.error(`Admin user bot detail DB managed runner failed for scenario ${scenario}: ${safeMessage(error)}`);
    if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
  } finally {
    if (created) {
      try {
        await adminSql`DROP DATABASE IF EXISTS ${adminSql(dbName)} WITH (FORCE)`;
        console.log(`Dropped admin user bot detail DB e2e throwaway database ${dbName}.`);
      } catch (dropError) {
        console.error(`Admin user bot detail DB managed runner could not drop ${dbName}: ${safeMessage(dropError)}`);
        if (exitCode === 0) exitCode = 1;
      }
    }
  }

  return exitCode;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    process.exit(0);
  }
  if (unknownArg) {
    console.error('Admin user bot detail DB managed runner refused: unknown argument.');
    process.exit(2);
  }
  if (runMatrix && runUserRoutes) {
    console.error('Admin user bot detail DB managed runner refused: --matrix and --user-routes are separate acceptance lanes.');
    process.exit(2);
  }

  let admin;
  try {
    admin = parseAdminUrl(adminUrl);
  } catch (error) {
    console.error(safeMessage(error));
    process.exit(2);
  }

  let scenarios;
  try {
    scenarios = runMatrix ? runtimeScenarios : [parseRuntimeScenario(process.env.ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO)];
  } catch (error) {
    console.error(safeMessage(error));
    process.exit(2);
  }

  const adminSql = postgres(admin.toString(), { max: 1 });
  let exitCode = 0;

  try {
    for (const scenario of scenarios) {
      const scenarioExitCode = await runManagedScenario(adminSql, admin, scenario);
      if (scenarioExitCode !== 0 && exitCode === 0) exitCode = scenarioExitCode;
    }
  } catch (error) {
    console.error(`Admin user bot detail DB managed runner failed: ${safeMessage(error)}`);
    if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
  } finally {
    await adminSql.end({ timeout: 5 }).catch(() => {});
  }

  if (exitCode !== 0) process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('run-admin-user-bot-detail-e2e-managed.mjs')) {
  await main();
}
