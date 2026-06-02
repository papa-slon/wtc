import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function runManaged(env: NodeJS.ProcessEnv = {}, args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/run-audit-append-only-role-managed.mjs', ...args], {
    cwd: ROOT,
    env: { ...process.env, AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL: '', ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function outputOf(result: ReturnType<typeof runManaged>): string {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function postgresUrl(user: string, password: string, hostAndDb: string): string {
  return ['postgres://', user, ':', password, '@', hostAndDb].join('');
}

describe('managed audit append-only role runner safety', () => {
  it('is an opt-in command and stays out of default gates', () => {
    const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const gates = read('scripts/gates.mjs');
    const runner = read('scripts/run-audit-append-only-role-managed.mjs');

    expect(rootPkg.scripts['accept:audit:append-only-role:managed']).toBe(
      'node scripts/run-audit-append-only-role-managed.mjs',
    );
    expect(rootPkg.scripts.e2e).not.toContain('run-audit-append-only-role-managed');
    expect(rootPkg.scripts['ci:local']).not.toContain('accept:audit:append-only-role:managed');
    expect(gates).not.toContain('accept:audit:append-only-role:managed');
    expect(gates).not.toContain('run-audit-append-only-role-managed');
    expect(runner).toContain("import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(runner).toContain('runRedactedChildProcess');
    expect(runner).not.toContain("stdio: 'inherit'");
  });

  it('prints safe help without credentials', () => {
    const result = runManaged({}, ['--help']);
    const output = outputOf(result);

    expect(result.status).toBe(0);
    expect(output).toContain('Usage:');
    expect(output).toContain('AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL');
    expect(output).toContain('<maintenance_db>');
    expect(output).not.toContain('postgres://postgres:pw@');
  });

  it('refuses unknown arguments before requiring credentials', () => {
    const result = runManaged({}, ['--dry-run']);
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('Audit append-only managed runner refused');
    expect(output).toContain('unknown argument');
  });

  it('refuses unknown arguments before using present credentials', () => {
    const url = postgresUrl('postgres', 'not-real', '127.0.0.1:1/postgres');
    const result = runManaged({ AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL: url }, ['--dry-run']);
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('Audit append-only managed runner refused');
    expect(output).toContain('unknown argument');
    expect(output).not.toContain(url);
  });

  it('refuses missing admin URLs before DB mutation', () => {
    const result = runManaged();
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('Set AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL');
  });

  it('refuses invalid and throwaway admin URLs without leaking full URLs', () => {
    const invalid = runManaged({ AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL: 'not-a-postgres-url' });
    expect(invalid.status).toBe(2);
    expect(outputOf(invalid)).toContain('not a valid URL');

    const throwawayUrl = postgresUrl('postgres', 'not-real', '127.0.0.1:5432/wtc_test_bad_admin');
    const throwaway = runManaged({ AUDIT_APPEND_ONLY_ADMIN_DATABASE_URL: throwawayUrl });
    const throwawayOutput = outputOf(throwaway);

    expect(throwaway.status).toBe(2);
    expect(throwawayOutput).toContain('non-throwaway maintenance database');
    expect(throwawayOutput).not.toContain(throwawayUrl);
  });

  it('creates a temporary role, grants only audit_logs read/write, delegates preflight, and drops cleanup targets', () => {
    const runner = read('scripts/run-audit-append-only-role-managed.mjs');

    expect(runner).toContain('CREATE ROLE');
    expect(runner).toContain('quoteGeneratedIdentifier');
    expect(runner).toContain('quoteGeneratedLiteral');
    expect(runner).toContain('NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION');
    expect(runner).toContain('GRANT SELECT, INSERT ON public.audit_logs');
    expect(runner).toContain('runExistingPreflight');
    expect(runner).toContain('DROP DATABASE IF EXISTS');
    expect(runner).toContain('DROP ROLE IF EXISTS');
  });
});
