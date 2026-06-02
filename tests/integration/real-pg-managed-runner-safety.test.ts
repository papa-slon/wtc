import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function runRealPgManaged(env: NodeJS.ProcessEnv = {}, args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/run-real-pg-harness-managed.mjs', ...args], {
    cwd: ROOT,
    env: { ...process.env, REAL_POSTGRES_ADMIN_DATABASE_URL: '', ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runGates(args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/gates.mjs', ...args], {
    cwd: ROOT,
    env: process.env,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function outputOf(result: ReturnType<typeof runRealPgManaged> | ReturnType<typeof runGates>): string {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function postgresUrl(user: string, password: string, hostAndDb: string): string {
  return ['postgres://', user, ':', password, '@', hostAndDb].join('');
}

describe('managed real-PG runner safety', () => {
  it('is an opt-in command and stays out of default gates', () => {
    const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const gates = read('scripts/gates.mjs');
    const runner = read('scripts/run-real-pg-harness-managed.mjs');

    expect(rootPkg.scripts['accept:real-pg:managed']).toBe('node scripts/run-real-pg-harness-managed.mjs');
    expect(rootPkg.scripts.e2e).not.toContain('run-real-pg-harness-managed');
    expect(rootPkg.scripts['ci:local']).not.toContain('accept:real-pg:managed');
    expect(gates).not.toContain('accept:real-pg:managed');
    expect(gates).not.toContain('run-real-pg-harness-managed');
    expect(runner).toContain("import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(runner).toContain('runRedactedChildProcess');
    expect(runner).not.toContain("stdio: 'inherit'");
  });

  it('prints safe help without credentials', () => {
    const result = runRealPgManaged({}, ['--help']);
    const output = outputOf(result);

    expect(result.status).toBe(0);
    expect(output).toContain('Usage:');
    expect(output).toContain('REAL_POSTGRES_ADMIN_DATABASE_URL');
    expect(output).toContain('<maintenance_db>');
    expect(output).not.toContain('postgres://postgres:pw@');
  });

  it('refuses unknown arguments before requiring credentials', () => {
    const result = runRealPgManaged({}, ['--dry-run']);
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('Real-PG managed runner refused');
    expect(output).toContain('unknown argument');
  });

  it('refuses unknown arguments before using present credentials', () => {
    const url = postgresUrl('postgres', 'not-real', '127.0.0.1:1/postgres');
    const result = runRealPgManaged({ REAL_POSTGRES_ADMIN_DATABASE_URL: url }, ['--dry-run']);
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('Real-PG managed runner refused');
    expect(output).toContain('unknown argument');
    expect(output).not.toContain(url);
  });

  it('refuses URL-shaped unknown arguments without echoing them', () => {
    const rawArg = `${postgresUrl('cli', 'secret', '127.0.0.1:5432/postgres')}?password=cli-secret`;
    const result = runRealPgManaged({}, [rawArg]);
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('Real-PG managed runner refused');
    expect(output).toContain('unknown argument');
    expect(output).not.toContain(rawArg);
    expect(output).not.toContain('cli:secret');
    expect(output).not.toContain('cli-secret');
  });

  it('refuses missing admin URLs before DB mutation', () => {
    const result = runRealPgManaged();
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('Set REAL_POSTGRES_ADMIN_DATABASE_URL');
  });

  it('refuses invalid and throwaway admin URLs without leaking full URLs', () => {
    const invalid = runRealPgManaged({ REAL_POSTGRES_ADMIN_DATABASE_URL: 'not-a-postgres-url' });
    expect(invalid.status).toBe(2);
    expect(outputOf(invalid)).toContain('not a valid URL');

    const throwawayUrl = postgresUrl('postgres', 'not-real', '127.0.0.1:5432/wtc_test_bad_admin');
    const throwaway = runRealPgManaged({ REAL_POSTGRES_ADMIN_DATABASE_URL: throwawayUrl });
    const throwawayOutput = outputOf(throwaway);

    expect(throwaway.status).toBe(2);
    expect(throwawayOutput).toContain('non-throwaway maintenance database');
    expect(throwawayOutput).not.toContain(throwawayUrl);
  });

  it('lists all gate modes in invalid-mode help', () => {
    const result = runGates(['not-a-mode']);
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('quick | core | full | build | e2e');
  });
});
