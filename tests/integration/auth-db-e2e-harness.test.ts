import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const runner = read('scripts/run-auth-db-e2e.mjs');
const managedRunner = read('scripts/run-auth-db-e2e-managed.mjs');
const prepare = read('scripts/prepare-auth-db-e2e.ts');
const config = read('playwright.auth-db.config.ts');
const defaultConfig = read('playwright.config.ts');
const spec = read('tests/e2e/auth-production-profile.spec.ts');
const rootPkg = read('package.json');

function runManaged(env: NodeJS.ProcessEnv = {}, args: string[] = []) {
  return spawnSync(process.execPath, ['scripts/run-auth-db-e2e-managed.mjs', ...args], {
    cwd: ROOT,
    env: { ...process.env, AUTH_E2E_ADMIN_DATABASE_URL: '', ...env },
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

function runSafeMessage(raw: string) {
  return spawnSync(process.execPath, [
    '--input-type=module',
    '-e',
    `const { safeMessage } = await import('./scripts/run-auth-db-e2e-managed.mjs'); console.log(safeMessage(new Error(${JSON.stringify(raw)})));`,
  ], {
    cwd: ROOT,
    env: { ...process.env, AUTH_E2E_ADMIN_DATABASE_URL: '' },
    encoding: 'utf8',
    windowsHide: true,
  });
}

describe('auth DB-backed browser acceptance harness', () => {
  it('is wired through dedicated npm scripts and stays out of default gates', () => {
    const scripts = (JSON.parse(rootPkg) as { scripts: Record<string, string> }).scripts;
    const gates = read('scripts/gates.mjs');
    expect(scripts['e2e:auth:production-profile']).toBe('playwright test -c playwright.auth.config.ts');
    expect(scripts['e2e:auth:db']).toBe('node scripts/run-auth-db-e2e.mjs');
    expect(scripts['e2e:auth:db:managed']).toBe('node scripts/run-auth-db-e2e-managed.mjs');
    expect(scripts.e2e).toBe('playwright test');
    expect(scripts.e2e).not.toContain('auth');
    expect(scripts['ci:local']).not.toContain('e2e:auth:db');
    expect(gates).not.toContain('e2e:auth:db');
    expect(defaultConfig).toContain('/auth-production-profile\\.spec\\.ts/');
  });

  it('runs the real auth forms without E2E_AUTH_BYPASS', () => {
    expect(spec).toContain('/api/e2e/login');
    expect(spec).toContain('expect(bypassResponse.status()).toBe(404)');
    expect(spec).toContain("page.goto('/register')");
    expect(spec).toContain("page.goto('/login')");
    expect(spec).toContain('invalid_credentials');
    expect(config).not.toContain('E2E_AUTH_BYPASS');
    expect(config).toContain("const authDbE2ePort = process.env.AUTH_DB_E2E_PORT ?? '3413'");
    expect(config).toContain('baseURL,');
    expect(config).toContain('`npm run dev -w @wtc/web -- --port ${authDbE2ePort}`');
    expect(config).toContain('DATABASE_URL: databaseUrl');
    expect(config).toContain("BOT_ADAPTER_MODE: 'mock'");
    expect(config).toContain("FEATURE_LIVE_BOT_CONTROL: 'false'");
    expect(config).toContain("FEATURE_TV_AUTOMATION: 'false'");
  });

  it('refuses non-throwaway or non-empty databases before running browser tests', () => {
    expect(prepare).toContain('assertThrowawayDbName');
    expect(prepare).toContain('AUTH_E2E_DATABASE_URL');
    expect(prepare).toContain('wtc_test_auth_<suffix>');
    expect(prepare).toContain('^wtc_test(?:_[a-z0-9]+)*$');
    expect(prepare).toContain('information_schema.tables');
    expect(prepare).toContain('is not empty');
    expect(prepare).toContain('auth-db-e2e-prepared.json');
    expect(config).toContain('assertPreparedDatabaseUrl');
    expect(config).toContain('AUTH_DB_E2E_PREP_TOKEN');
  });

  it('managed runner creates and drops a fresh throwaway DB without printing URLs', () => {
    expect(managedRunner).toContain('AUTH_E2E_ADMIN_DATABASE_URL');
    expect(managedRunner).toContain('safeMessage');
    expect(managedRunner).toContain('CREATE DATABASE');
    expect(managedRunner).toContain('DROP DATABASE IF EXISTS');
    expect(managedRunner).toContain('WITH (FORCE)');
    expect(managedRunner).toContain('wtc_test_auth_');
    expect(managedRunner).toContain("['run', 'e2e:auth:db']");
    expect(managedRunner).toContain('AUTH_E2E_DATABASE_URL: targetUrl');
    expect(managedRunner).toContain('runRedactedChildProcess');
    expect(managedRunner).not.toContain('console.log(targetUrl');
    expect(managedRunner).not.toContain('console.error(targetUrl');
    expect(managedRunner).not.toContain('console.log(adminUrl');
    expect(managedRunner).not.toContain('console.error(adminUrl');
  });

  it('managed runner prints safe help without credentials', () => {
    const help = runManaged({}, ['--help']);
    expect(help.status).toBe(0);
    expect(outputOf(help)).toContain('Usage:');
    expect(outputOf(help)).toContain('AUTH_E2E_ADMIN_DATABASE_URL');
  });

  it('managed runner refuses unknown args before using present credentials', () => {
    const url = postgresUrl('admin', 'not-real', '127.0.0.1:1/postgres');
    const unknown = runManaged({ AUTH_E2E_ADMIN_DATABASE_URL: url }, ['--dry-run']);
    expect(unknown.status).toBe(2);
    expect(outputOf(unknown)).toContain('unknown argument');
    expect(outputOf(unknown)).not.toContain(url);
  });

  it('managed runner refuses URL-shaped unknown args without echoing them', () => {
    const rawArg = `${postgresUrl('cli', 'secret', '127.0.0.1:5432/postgres')}?password=cli-secret`;
    const unknown = runManaged({}, [rawArg]);
    const output = outputOf(unknown);

    expect(unknown.status).toBe(2);
    expect(output).toContain('unknown argument');
    expect(output).not.toContain(rawArg);
    expect(output).not.toContain('cli:secret');
    expect(output).not.toContain('cli-secret');
  });

  it('managed runner refuses missing, invalid, and throwaway admin URLs safely', () => {
    const missing = runManaged();
    expect(missing.status).toBe(2);
    expect(outputOf(missing)).toContain('Set AUTH_E2E_ADMIN_DATABASE_URL');

    const invalid = runManaged({ AUTH_E2E_ADMIN_DATABASE_URL: 'not-a-postgres-url' });
    expect(invalid.status).toBe(2);
    expect(outputOf(invalid)).toContain('not a valid URL');

    const throwawayUrl = postgresUrl('postgres', 'not-real', '127.0.0.1:5432/wtc_test_auth_bad_admin');
    const throwaway = runManaged({ AUTH_E2E_ADMIN_DATABASE_URL: throwawayUrl });
    expect(throwaway.status).toBe(2);
    expect(outputOf(throwaway)).toContain('non-throwaway maintenance database');
    expect(outputOf(throwaway)).not.toContain(throwawayUrl);
  });

  it('managed runner sanitizer redacts raw postgres URLs and password parameters', () => {
    const raw = `driver failed for ${postgresUrl('admin', 'secret', '127.0.0.1:5432/postgres')}?sslmode=disable with password=secret-token`;
    const result = runSafeMessage(raw);
    const output = outputOf(result);

    expect(result.status).toBe(0);
    expect(output).toContain('postgres://<redacted>');
    expect(output).toContain('password=<redacted>');
    expect(output).not.toContain('admin:secret');
    expect(output).not.toContain('127.0.0.1:5432/postgres');
    expect(output).not.toContain('secret-token');
  });

  it('child runner and prep use redacted child output in catch paths', () => {
    expect(runner).toContain('function safeMessage');
    expect(runner).toContain("import { redactProcessOutput, runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(runner).not.toContain("stdio: 'inherit'");
    expect(runner).toContain('Auth DB e2e runner failed: ${safeMessage(error)}');
    expect(prepare).toContain('function safeMessage');
    expect(prepare).toContain('console.error(safeMessage(err))');
  });
});
