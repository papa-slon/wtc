import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { and, eq } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { schema, seedDatabase, findUserByEmail, entitlementsOf, type Db } from '@wtc/db';

let db: Db;

beforeAll(async () => {
  const pg = new PGlite();
  const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) await pg.exec(readFileSync(join(migDir, f), 'utf8'));
  db = drizzle(pg, { schema }) as unknown as Db;
}, 30_000);

describe('db seed deploy-readiness hardening', () => {
  it('is idempotent across repeated runs, including the demo course', async () => {
    await seedDatabase(db);
    await seedDatabase(db);

    const teacher = await findUserByEmail(db, 'teacher@wtc.local');
    expect(teacher).not.toBeNull();
    expect(teacher!.roles).toEqual(expect.arrayContaining(['teacher', 'user']));

    const demoCourses = await db
      .select({ id: schema.courses.id })
      .from(schema.courses)
      .where(and(eq(schema.courses.ownerTeacherId, teacher!.id), eq(schema.courses.title, 'Risk Management Fundamentals')));
    expect(demoCourses.length).toBe(1);

    const user = await findUserByEmail(db, 'user@wtc.local');
    expect(user).not.toBeNull();
    const entitlements = await entitlementsOf(db, user!.id);
    expect(entitlements.filter((e) => e.productCode === 'education').length).toBe(1);
    expect(entitlements.filter((e) => e.productCode === 'tortila_bot').length).toBe(1);
    expect(entitlements.filter((e) => e.productCode === 'axioma_terminal').length).toBe(1);
  });

  it('safe preview script forces development/mock/no-live-control flags', () => {
    const rootPkg = readFileSync(join(process.cwd(), 'package.json'), 'utf8');
    expect(rootPkg).toContain('"preview:safe": "node scripts/safe-preview.mjs"');
    expect(rootPkg).toContain('"worker:smoke": "node scripts/safe-worker-tick.mjs"');

    const script = readFileSync(join(process.cwd(), 'scripts', 'safe-preview.mjs'), 'utf8');
    expect(script).toContain("APP_ENV: 'development'");
    expect(script).toContain("BOT_ADAPTER_MODE: 'mock'");
    expect(script).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(script).toContain("FEATURE_TV_AUTOMATION: 'false'");
    expect(script).toContain("const nextCli = join(root, 'node_modules', 'next', 'dist', 'bin', 'next')");
    expect(script).toContain('spawn(process.execPath');
    expect(script).toContain("'--hostname', '0.0.0.0'");
    expect(script).toContain("'--port', '3000'");
    expect(script).toContain('shell: false');
    expect(script).toContain("stdio: ['inherit', 'pipe', 'pipe']");
    expect(script).toContain("import { redactProcessOutput } from './redacted-child-process.mjs'");
    expect(script).not.toContain("stdio: 'inherit'");
  });

  it('safe worker smoke forces mock mode and no live-control flags', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'safe-worker-tick.mjs'), 'utf8');
    expect(script).toContain("APP_ENV: 'development'");
    expect(script).toContain("BOT_ADAPTER_MODE: 'mock'");
    expect(script).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(script).toContain("FEATURE_TV_AUTOMATION: 'false'");
    expect(script).toContain("const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')");
    expect(script).toContain("const tickScript = join(root, 'apps', 'worker', 'src', 'tick-once.ts')");
    expect(script).toContain("args.push('--memory-demo')");
    expect(script).toContain("import { runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(script).toContain('runRedactedChildProcess(process.execPath, args');
    expect(script).not.toContain("stdio: 'inherit'");
  });
});
