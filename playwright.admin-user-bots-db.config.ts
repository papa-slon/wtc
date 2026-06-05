import { defineConfig, devices } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

function dbNameFromUrl(raw: string): string {
  try {
    return new URL(raw).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error('Admin user bot detail DB e2e refused: ADMIN_USER_BOTS_E2E_DATABASE_URL is not a valid URL.');
  }
}

function assertPreparedDatabaseUrl(): { databaseUrl: string; userAId: string } {
  if (process.env.ADMIN_USER_BOTS_E2E !== '1') {
    throw new Error('Use npm run e2e:admin-user-bots:db to run the guarded admin user bot detail DB browser harness.');
  }
  const databaseUrl = process.env.ADMIN_USER_BOTS_E2E_DATABASE_URL;
  if (!databaseUrl) throw new Error('Set ADMIN_USER_BOTS_E2E_DATABASE_URL through npm run e2e:admin-user-bots:db.');
  const dbName = dbNameFromUrl(databaseUrl);
  if (!/^wtc_test(?:_[a-z0-9]+)*$/.test(dbName)) throw new Error(`Admin user bot detail DB e2e refused non-throwaway database "${dbName}".`);
  const prepToken = process.env.ADMIN_USER_BOTS_E2E_PREP_TOKEN;
  if (!prepToken) throw new Error('Admin user bot detail DB e2e refused: missing prep token. Use npm run e2e:admin-user-bots:db.');
  const marker = JSON.parse(readFileSync('.next-e2e-admin-user-bots/admin-user-bots-e2e-prepared.json', 'utf8')) as {
    dbName?: string;
    userAId?: string;
    userRoutes?: boolean;
    urlHmacSha256?: string;
  };
  const expected = createHmac('sha256', prepToken).update(databaseUrl).digest('hex');
  if (marker.dbName !== dbName || marker.urlHmacSha256 !== expected || !marker.userAId) {
    throw new Error('Admin user bot detail DB e2e refused: prep marker does not match ADMIN_USER_BOTS_E2E_DATABASE_URL.');
  }
  if (process.env.ADMIN_USER_BOTS_E2E_USER_ROUTES === '1' && marker.userRoutes !== true) {
    throw new Error('Admin user bot detail DB e2e refused: prep marker was not prepared for user-route proof mode.');
  }
  return { databaseUrl, userAId: marker.userAId };
}

const prepared = assertPreparedDatabaseUrl();
const adminUserBotsDbE2ePort = process.env.ADMIN_USER_BOTS_E2E_PORT ?? '3414';
const baseURL = `http://localhost:${adminUserBotsDbE2ePort}`;
const runUserRoutes = process.env.ADMIN_USER_BOTS_E2E_USER_ROUTES === '1';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: runUserRoutes ? /user-bot-routes-db\.spec\.ts/ : /admin-user-bot-detail-db\.spec\.ts/,
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
    { name: runUserRoutes ? 'user-bot-routes-db-desktop' : 'admin-user-bots-db-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: runUserRoutes ? 'user-bot-routes-db-mobile' : 'admin-user-bots-db-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run dev -w @wtc/web -- --port ${adminUserBotsDbE2ePort}`,
    url: baseURL,
    timeout: 150_000,
    reuseExistingServer: false,
    env: {
      E2E_AUTH_BYPASS: '1',
      NEXT_DIST_DIR: '.next-e2e-admin-user-bots',
      APP_ENV: 'development',
      DATABASE_URL: prepared.databaseUrl,
      ADMIN_USER_BOTS_E2E_USER_ID: prepared.userAId,
      BOT_ADAPTER_MODE: runUserRoutes ? 'read-only' : 'mock',
      FEATURE_LIVE_BOT_CONTROL: 'false',
      FEATURE_TV_AUTOMATION: 'false',
      SESSION_SECRET: process.env.SESSION_SECRET ?? '',
      SECRET_VAULT_KEK: process.env.SECRET_VAULT_KEK ?? '',
    },
  },
});
