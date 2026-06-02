import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createDbClient, seedDatabase } from '@wtc/db';

const url = process.env.LMS_E2E_DATABASE_URL;
const prepToken = process.env.LMS_DB_E2E_PREP_TOKEN;
const markerPath = join(process.cwd(), '.next-e2e-db', 'lms-db-e2e-prepared.json');

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgres://<redacted>')
    .replace(/(password=)[^&\s]+/gi, '$1<redacted>');
}

export function assertThrowawayDbName(databaseUrl: string): string {
  let name: string;
  try {
    name = new URL(databaseUrl).pathname.replace(/^\//, '').toLowerCase();
  } catch {
    throw new Error('LMS DB e2e refused: LMS_E2E_DATABASE_URL is not a valid URL.');
  }
  if (!/^wtc_test(?:_[a-z0-9]+)*$/.test(name)) {
    throw new Error(
      `LMS DB e2e refused: database "${name || '(none)'}" is not a throwaway test DB. ` +
        'Use a fresh database named wtc_test or wtc_test_lms_<suffix> only.',
    );
  }
  return name;
}

async function main(): Promise<void> {
  if (!url) throw new Error('Set LMS_E2E_DATABASE_URL to a fresh throwaway Postgres database before running LMS DB e2e.');
  if (!prepToken) throw new Error('Use npm run e2e:lms:db so the LMS DB e2e prep token is generated.');
  const dbName = assertThrowawayDbName(url);
  const { client, db } = createDbClient(url);
  try {
    const existing = await client<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `;
    if (existing.length > 0) {
      throw new Error(
        `LMS DB e2e refused: ${dbName} is not empty (${existing.length} table(s)). ` +
          'Drop/recreate the throwaway DB before running this acceptance harness.',
      );
    }

    const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
    const files = readdirSync(migDir).filter((file) => file.endsWith('.sql')).sort();
    if (files.length === 0) throw new Error('LMS DB e2e refused: no migration SQL files found.');
    for (const file of files) {
      await client.unsafe(readFileSync(join(migDir, file), 'utf8'));
    }
    await seedDatabase(db);
    mkdirSync(dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, JSON.stringify({
      dbName,
      urlHmacSha256: createHmac('sha256', prepToken).update(url).digest('hex'),
      migrationCount: files.length,
      preparedAt: new Date().toISOString(),
    }, null, 2) + '\n');
    console.log(`Prepared ${dbName} for LMS DB e2e with ${files.length} migration(s) and demo seed data.`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(safeMessage(err));
  process.exit(1);
});
