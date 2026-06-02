import { defineConfig } from 'drizzle-kit';

// SECURITY: no localhost fallback. `db:generate` (offline schema diff) does not connect, so an empty
// URL is fine there; any command that actually connects (migrate/push/studio) MUST be given
// DATABASE_URL explicitly. This prevents accidentally migrating an unintended local Postgres (e.g. a
// dev/native PG instance already listening on :5432).
const url = process.env.DATABASE_URL ?? '';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
});
