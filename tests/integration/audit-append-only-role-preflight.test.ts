import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function runScript(env: NodeJS.ProcessEnv = {}, args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/audit-append-only-role-preflight.mjs', ...args], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function outputOf(result: ReturnType<typeof runScript>): string {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

describe('audit append-only role preflight', () => {
  it('is an opt-in command and stays out of default gates', () => {
    const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const gates = read('scripts/gates.mjs');

    expect(rootPkg.scripts['accept:audit:append-only-role']).toBe('node scripts/audit-append-only-role-preflight.mjs');
    expect(rootPkg.scripts.e2e).not.toContain('audit-append-only-role-preflight');
    expect(rootPkg.scripts['ci:local']).not.toContain('accept:audit:append-only-role');
    expect(gates).not.toContain('accept:audit:append-only-role');
    expect(gates).not.toContain('audit-append-only-role-preflight');
  });

  it('prints safe help without credentials', () => {
    const result = runScript({}, ['--help']);
    const output = outputOf(result);

    expect(result.status).toBe(0);
    expect(output).toContain('Usage:');
    expect(output).toContain('wtc_app_role');
    expect(output).not.toContain('postgres://wtc_app_role:pw@');
  });

  it('refuses unknown arguments', () => {
    const result = runScript({}, ['--dry-run']);
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('preflight refused');
    expect(output).toContain('unknown argument');
  });

  it('refuses before any database URL is required unless explicitly accepted', () => {
    const result = runScript();
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('preflight refused');
    expect(output).toContain('AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT=1');
  });

  it('refuses accepted runs without a restricted app-role URL', () => {
    const result = runScript({ AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT: '1' });
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('preflight refused');
    expect(output).toContain('AUDIT_APPEND_ONLY_DATABASE_URL');
  });

  it('refuses invalid URLs before opening a database connection', () => {
    const result = runScript({
      AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT: '1',
      AUDIT_APPEND_ONLY_DATABASE_URL: 'not-a-postgres-url',
    });
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('preflight refused');
    expect(output).toContain('not a valid URL');
  });

  it('refuses administrative-looking URL users on throwaway targets', () => {
    const url = ['postgres://', 'postgres', ':not-real', '@127.0.0.1:5432/wtc_test_audit_role'].join('');
    const result = runScript({
      AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT: '1',
      AUDIT_APPEND_ONLY_DATABASE_URL: url,
    });
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('preflight refused');
    expect(output).toContain('administrative role');
    expect(output).not.toContain(url);
  });

  it('refuses non-throwaway targets before opening a database connection', () => {
    const url = ['postgres://', 'wtc_app_role', ':not-real', '@127.0.0.1:5432/wtc_platform_preview'].join('');
    const result = runScript({
      AUDIT_APPEND_ONLY_PREFLIGHT_ACCEPT: '1',
      AUDIT_APPEND_ONLY_DATABASE_URL: url,
    });
    const output = outputOf(result);

    expect(result.status).toBe(2);
    expect(output).toContain('preflight refused');
    expect(output).toContain('not a wtc_test throwaway target');
    expect(output).not.toContain(url);
  });

  it('checks restricted role attributes and table ownership in source', () => {
    const script = read('scripts/audit-append-only-role-preflight.mjs');

    expect(script).toContain("|| 'wtc_app_role'");
    expect(script).toContain('rolsuper');
    expect(script).toContain('rolcreatedb');
    expect(script).toContain('rolcreaterole');
    expect(script).toContain('rolreplication');
    expect(script).toContain('rolbypassrls');
    expect(script).toContain('role owns audit_logs');
    expect(script).toContain("has_table_privilege(current_user, 'public.audit_logs', 'TRUNCATE')");
  });
});
