import { defineConfig, devices } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

function dbNameFromUrl(raw: string): string {
  try {
    return new URL(raw).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error('Auth DB e2e refused: AUTH_E2E_DATABASE_URL is not a valid URL.');
  }
}

function assertPreparedDatabaseUrl(): string {
  if (process.env.AUTH_DB_E2E !== '1') throw new Error('Use npm run e2e:auth:db to run the guarded auth DB browser harness.');
  const databaseUrl = process.env.AUTH_E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('Set AUTH_E2E_DATABASE_URL through npm run e2e:auth:db.');
  const dbName = dbNameFromUrl(databaseUrl);
  if (!/^wtc_test(?:_[a-z0-9]+)*$/.test(dbName)) throw new Error(`Auth DB e2e refused non-throwaway database "${dbName}".`);
  const prepToken = process.env.AUTH_DB_E2E_PREP_TOKEN;
  if (!prepToken) throw new Error('Auth DB e2e refused: missing prep token. Use npm run e2e:auth:db.');
  const marker = JSON.parse(readFileSync('.next-e2e-auth-db/auth-db-e2e-prepared.json', 'utf8')) as { dbName?: string; urlHmacSha256?: string };
  const expected = createHmac('sha256', prepToken).update(databaseUrl).digest('hex');
  if (marker.dbName !== dbName || marker.urlHmacSha256 !== expected) {
    throw new Error('Auth DB e2e refused: prep marker does not match AUTH_E2E_DATABASE_URL.');
  }
  return databaseUrl;
}

const databaseUrl = assertPreparedDatabaseUrl();
const authDbE2ePort = process.env.AUTH_DB_E2E_PORT ?? '3413';
const baseURL = `http://localhost:${authDbE2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /auth-production-profile\.spec\.ts/,
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
    { name: 'auth-db-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'auth-db-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run dev -w @wtc/web -- --port ${authDbE2ePort}`,
    url: baseURL,
    timeout: 150_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: '.next-e2e-auth-db',
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
