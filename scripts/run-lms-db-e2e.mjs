#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs';

const markerPath = '.next-e2e-db/lms-db-e2e-prepared.json';
const dynamicMarkerPath = '.next-e2e-db/lms-db-e2e-dynamic-markers.json';
const url = process.env.LMS_E2E_DATABASE_URL;
if (!url) {
  console.error(
    'Set LMS_E2E_DATABASE_URL to a fresh throwaway Postgres database named wtc_test or wtc_test_<suffix>. ' +
      'REAL_POSTGRES_DATABASE_URL is reserved for tests/integration/db-real-postgres.test.ts and is not accepted here.',
  );
  process.exit(2);
}

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

const prepToken = randomBytes(24).toString('hex');
rmSync(markerPath, { force: true });
rmSync(dynamicMarkerPath, { force: true });
mkdirSync(dirname(dynamicMarkerPath), { recursive: true });
writeFileSync(dynamicMarkerPath, JSON.stringify({ version: 1, markers: [] }, null, 2));

const env = {
  ...process.env,
  LMS_E2E_DATABASE_URL: url,
  DATABASE_URL: url,
  LMS_DB_E2E: '1',
  LMS_DB_E2E_PREP_TOKEN: prepToken,
  LMS_DB_E2E_DYNAMIC_MARKERS_PATH: dynamicMarkerPath,
  E2E_AUTH_BYPASS: '1',
  NEXT_DIST_DIR: '.next-e2e-db',
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
let playwrightAttempted = false;
let scannerAttempted = false;

try {
  runRequired(process.execPath, ['--experimental-strip-types', 'scripts/prepare-lms-db-e2e.ts']);

  playwrightAttempted = true;
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const playwrightExit = runRedacted(npx, ['playwright', 'test', '-c', 'playwright.lms-db.config.ts']);
  if (playwrightExit !== 0) {
    console.error(`LMS DB Playwright exited ${playwrightExit}; scanning generated artifacts before exit.`);
    exitCode = playwrightExit;
  }

  scannerAttempted = true;
  const scannerExit = runRedacted(process.execPath, ['scripts/scan-lms-db-e2e-artifacts.mjs']);
  if (scannerExit !== 0) {
    console.error(`LMS DB artifact scanner exited ${scannerExit}.`);
    if (exitCode === 0) exitCode = scannerExit;
  }
} catch (error) {
  console.error(`LMS DB e2e runner failed: ${safeMessage(error)}`);
  if (exitCode === 0) exitCode = typeof error?.status === 'number' ? error.status : 1;
  if (playwrightAttempted && !scannerAttempted) {
    try {
      scannerAttempted = true;
      const scannerExit = runRedacted(process.execPath, ['scripts/scan-lms-db-e2e-artifacts.mjs']);
      if (scannerExit !== 0) console.error(`LMS DB artifact scanner exited ${scannerExit}.`);
    } catch (scanError) {
      console.error(`LMS DB artifact scanner could not run: ${safeMessage(scanError)}`);
    }
  }
} finally {
  rmSync(markerPath, { force: true });
  rmSync(dynamicMarkerPath, { force: true });
  console.log(
    'LMS DB e2e markers cleaned. Archive redacted stdout, test-results/, playwright-report/ if generated, ' +
      'and tests/e2e/screenshots/lms-db-material-lesson-*.png only after text artifact and visual review gates pass; then drop the throwaway DB.',
  );
}

if (exitCode !== 0) process.exit(exitCode);
