import { defineConfig } from 'vitest/config';

// Root Vitest config: discovers unit/integration tests across packages.
// Tests use relative imports inside their own package to avoid needing
// workspace symlinks (so they run before `npm install` wiring is complete).
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/**'],
    environment: 'node',
    globals: true,
    reporters: 'default',
    // PGlite integration suites apply all migrations in beforeAll; that can exceed the 10s default when
    // the host is under load (e.g. a full sweep run right after the 9-min Playwright e2e). 30s globally
    // makes every PGlite suite resilient (was per-suite on db-pg5 only — db-0002/db-tv-expiring flaked).
    hookTimeout: 30_000,
  },
});
