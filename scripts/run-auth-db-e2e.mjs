#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const markerPath = '.next-e2e-auth-db/auth-db-e2e-prepared.json';
const url = process.env.AUTH_E2E_DATABASE_URL;
if (!url) {
  console.error(
    'Set AUTH_E2E_DATABASE_URL to a fresh throwaway Postgres database named wtc_test or wtc_test_<suffix>. ' +
      'LMS_E2E_DATABASE_URL and REAL_POSTGRES_DATABASE_URL are reserved for their own acceptance gates.',
  );
  process.exit(2);
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

const prepToken = randomBytes(24).toString('hex');
rmSync(markerPath, { force: true });
mkdirSync('.next-e2e-auth-db', { recursive: true });

const env = {
  ...process.env,
  AUTH_E2E_DATABASE_URL: url,
  DATABASE_URL: url,
  AUTH_DB_E2E: '1',
  AUTH_DB_E2E_PREP_TOKEN: prepToken,
  NEXT_DIST_DIR: '.next-e2e-auth-db',
  APP_ENV: 'development',
  BOT_ADAPTER_MODE: 'mock',
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
  runRequired(process.execPath, ['--experimental-strip-types', 'scripts/prepare-auth-db-e2e.ts']);

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  exitCode = runRedacted(npx, ['playwright', 'test', '-c', 'playwright.auth-db.config.ts']);
} catch (error) {
  console.error(`Auth DB e2e runner failed: ${safeMessage(error)}`);
  if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
} finally {
  rmSync(markerPath, { force: true });
  console.log('Auth DB e2e marker cleaned. Archive only redacted stdout and reviewed/scanner-clean artifacts if retained; then drop the throwaway DB.');
}

if (exitCode !== 0) process.exit(exitCode);
