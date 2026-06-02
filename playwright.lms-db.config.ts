import { defineConfig, devices } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

function dbNameFromUrl(raw: string): string {
  try {
    return new URL(raw).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error('LMS DB e2e refused: LMS_E2E_DATABASE_URL is not a valid URL.');
  }
}

function assertPreparedDatabaseUrl(): string {
  if (process.env.LMS_DB_E2E !== '1') throw new Error('Use npm run e2e:lms:db to run the guarded LMS DB browser harness.');
  const databaseUrl = process.env.LMS_E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('Set LMS_E2E_DATABASE_URL through npm run e2e:lms:db.');
  const dbName = dbNameFromUrl(databaseUrl);
  if (!/^wtc_test(?:_[a-z0-9]+)*$/.test(dbName)) throw new Error(`LMS DB e2e refused non-throwaway database "${dbName}".`);
  const prepToken = process.env.LMS_DB_E2E_PREP_TOKEN;
  if (!prepToken) throw new Error('LMS DB e2e refused: missing prep token. Use npm run e2e:lms:db.');
  const marker = JSON.parse(readFileSync('.next-e2e-db/lms-db-e2e-prepared.json', 'utf8')) as { dbName?: string; urlHmacSha256?: string };
  const expected = createHmac('sha256', prepToken).update(databaseUrl).digest('hex');
  if (marker.dbName !== dbName || marker.urlHmacSha256 !== expected) {
    throw new Error('LMS DB e2e refused: prep marker does not match LMS_E2E_DATABASE_URL.');
  }
  return databaseUrl;
}

const databaseUrl = assertPreparedDatabaseUrl();
const lmsDbE2ePort = process.env.LMS_DB_E2E_PORT ?? '3411';
const baseURL = `http://localhost:${lmsDbE2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /lms-db-materials\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'lms-db-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'lms-db-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run dev -w @wtc/web -- --port ${lmsDbE2ePort}`,
    url: baseURL,
    timeout: 150_000,
    reuseExistingServer: false,
    env: {
      E2E_AUTH_BYPASS: '1',
      NEXT_DIST_DIR: '.next-e2e-db',
      APP_ENV: 'development',
      DATABASE_URL: databaseUrl,
      BOT_ADAPTER_MODE: 'mock',
      FEATURE_LIVE_BOT_CONTROL: 'false',
      FEATURE_TV_AUTOMATION: 'false',
      SESSION_SECRET: process.env.SESSION_SECRET ?? '',
      SECRET_VAULT_KEK: process.env.SECRET_VAULT_KEK ?? '',
    },
  },
});
