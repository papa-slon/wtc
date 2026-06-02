import { defineConfig, devices } from '@playwright/test';

// E2E uses the dev server (NODE_ENV=development) so session cookies are not Secure-only over http.
const e2ePort = process.env.E2E_PORT ?? '3410';
const baseURL = `http://localhost:${e2ePort}`;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: [/auth-production-profile\.spec\.ts/, /lms-db-materials\.spec\.ts/],
  fullyParallel: false,
  workers: 1,
  // Strict e2e: auth uses /api/e2e/login (E2E_AUTH_BYPASS=1), so the suite no longer depends on
  // Next dev Server Action form posts for login and must not pass with retry noise.
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    // Dedicated e2e port so the suite never reuses a stale dev server on 3000.
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `npm run dev -w @wtc/web -- --port ${e2ePort}`,
    url: baseURL,
    timeout: 150_000,
    reuseExistingServer: false,
    env: {
      E2E_AUTH_BYPASS: '1',
      NEXT_DIST_DIR: '.next-e2e',
      APP_ENV: 'development',
      BOT_ADAPTER_MODE: 'mock',
      FEATURE_LIVE_BOT_CONTROL: 'false',
      FEATURE_TV_AUTOMATION: 'false',
    },
  },
});
