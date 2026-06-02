import { defineConfig, devices } from '@playwright/test';

const authE2ePort = process.env.AUTH_E2E_PORT ?? '3412';
const baseURL = `http://localhost:${authE2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /auth-production-profile\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run dev -w @wtc/web -- --port ${authE2ePort}`,
    url: baseURL,
    timeout: 150_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: '.next-e2e-auth',
      APP_ENV: 'development',
      BOT_ADAPTER_MODE: 'mock',
      FEATURE_LIVE_BOT_CONTROL: 'false',
      FEATURE_TV_AUTOMATION: 'false',
    },
  },
});
