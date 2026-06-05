#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const markerPath = '.next-e2e-admin-user-bots/admin-user-bots-e2e-prepared.json';
const url = process.env.ADMIN_USER_BOTS_E2E_DATABASE_URL;
const args = process.argv.slice(2);
const allowedArgs = new Set(['--help', '-h', '--user-routes']);
const unknownArg = args.find((arg) => !allowedArgs.has(arg));
const runUserRoutes = args.includes('--user-routes') || process.env.ADMIN_USER_BOTS_E2E_USER_ROUTES === '1';

function usage() {
  console.log(
    [
      'Usage: ADMIN_USER_BOTS_E2E_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/wtc_test npm run e2e:admin-user-bots:db',
      '       ADMIN_USER_BOTS_E2E_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/wtc_test npm run e2e:admin-user-bots:db:user-routes',
      '',
      'Runs the guarded selected-user bot detail DB browser harness against a fresh throwaway database.',
      'The --user-routes mode reuses the same prepared DB lifecycle and runs the current-user Tortila route proof in read-only adapter mode.',
      'Do not archive full URLs, passwords, cookies, raw env dumps, Playwright traces, or unreviewed artifacts.',
    ].join('\n'),
  );
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}
if (unknownArg) {
  console.error('Admin user bot detail DB e2e runner refused: unknown argument.');
  process.exit(2);
}
if (!url) {
  console.error(
    'Set ADMIN_USER_BOTS_E2E_DATABASE_URL to a fresh throwaway Postgres database named wtc_test or wtc_test_<suffix>. ' +
      'REAL_POSTGRES_DATABASE_URL, AUTH_E2E_DATABASE_URL, and LMS_E2E_DATABASE_URL are reserved for their own gates.',
  );
  process.exit(2);
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

const prepToken = randomBytes(24).toString('hex');
rmSync(markerPath, { force: true });
mkdirSync('.next-e2e-admin-user-bots', { recursive: true });

const env = {
  ...process.env,
  ADMIN_USER_BOTS_E2E_DATABASE_URL: url,
  DATABASE_URL: url,
  ADMIN_USER_BOTS_E2E: '1',
  ADMIN_USER_BOTS_E2E_PREP_TOKEN: prepToken,
  ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO: process.env.ADMIN_USER_BOTS_E2E_RUNTIME_SCENARIO ?? 'degraded-readable',
  ADMIN_USER_BOTS_E2E_USER_ROUTES: runUserRoutes ? '1' : '0',
  E2E_AUTH_BYPASS: '1',
  NEXT_DIST_DIR: '.next-e2e-admin-user-bots',
  APP_ENV: 'development',
  BOT_ADAPTER_MODE: runUserRoutes ? 'read-only' : 'mock',
  FEATURE_LIVE_BOT_CONTROL: 'false',
  FEATURE_TV_AUTOMATION: 'false',
  SESSION_SECRET: process.env.SESSION_SECRET ?? randomBytes(48).toString('base64'),
  SECRET_VAULT_KEK: process.env.SECRET_VAULT_KEK ?? randomBytes(32).toString('base64'),
};

function runRedacted(command, args) {
  const result = runRedactedChildProcess(command, args, {
    cwd: process.cwd(),
    env,
    windowsHide: true,
  });
  if (result.signal) {
    console.error(`${command} ${args.join(' ')} stopped by signal ${result.signal}.`);
    return 1;
  }
  return typeof result.status === 'number' ? result.status : 1;
}

function runRequired(command, args) {
  const exitCode = runRedacted(command, args);
  if (exitCode !== 0) {
    const error = new Error(`${command} ${args.join(' ')} exited ${exitCode}.`);
    error.status = exitCode;
    throw error;
  }
}

let exitCode = 0;
try {
  runRequired(process.execPath, ['--experimental-strip-types', 'scripts/prepare-admin-user-bot-detail-e2e.ts']);

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  exitCode = runRedacted(npx, ['playwright', 'test', '-c', 'playwright.admin-user-bots-db.config.ts']);
} catch (error) {
  console.error(`Admin user bot detail DB e2e runner failed: ${safeMessage(error)}`);
  if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
} finally {
  rmSync(markerPath, { force: true });
  console.log(
    'Admin user bot detail DB e2e marker cleaned. Archive only redacted stdout and reviewed/scanner-clean artifacts if retained; then drop the throwaway DB.',
  );
}

if (exitCode !== 0) process.exit(exitCode);
