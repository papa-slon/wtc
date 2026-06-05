import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function runManaged(args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['scripts/run-worker-continuity-managed.mjs', ...args], {
    cwd: root,
    env: { ...process.env, WORKER_CONTINUITY_ADMIN_DATABASE_URL: '', ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runSafeWorker(args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['scripts/safe-worker-tick.mjs', ...args], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: '', ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function outputOf(result: ReturnType<typeof runManaged> | ReturnType<typeof runSafeWorker>): string {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

function postgresUrl(user: string, password: string, hostAndDb: string): string {
  return ['postgres://', user, ':', password, '@', hostAndDb].join('');
}

describe('worker continuity acceptance runners', () => {
  it('registers fixture, strict full, and managed continuity acceptance as opt-in scripts', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    const gates = read('scripts/gates.mjs');
    const safeWorker = read('scripts/safe-worker-tick.mjs');
    const managed = read('scripts/run-worker-continuity-managed.mjs');

    expect(scripts['accept:bots:continuity:contract']).toBe('node scripts/gates.mjs bot-continuity-local');
    expect(scripts['accept:worker:continuity:fixture']).toBe('vitest run tests/integration/two-bot-continuity-contract-static.test.ts');
    expect(scripts['accept:worker:continuity']).toBe('node scripts/safe-worker-tick.mjs --require-db --expect-continuity=full');
    expect(scripts['accept:worker:continuity:managed']).toBe('node scripts/run-worker-continuity-managed.mjs');
    expect(scripts.e2e).not.toContain('worker-continuity');
    expect(scripts['ci:local']).not.toContain('accept:worker:continuity');
    expect(gates).not.toContain('accept:worker:continuity:managed');
    expect(gates).not.toContain('run-worker-continuity-managed');
    expect(gates).toContain("'worker-continuity-fixture': {");
    expect(gates).toContain("cmd: 'npm run accept:worker:continuity:fixture'");
    expect(gates).toContain("'bot-continuity-local': ['worker-continuity-fixture', 'worker-smoke']");

    expect(safeWorker).toContain("full: {");
    expect(safeWorker).toContain("workerStatus: 'ok'");
    expect(safeWorker).toContain("botContinuity: 'ok'");
    expect(safeWorker).toContain("'setup-needed': {");
    expect(safeWorker).toContain("workerStatus: 'not_configured'");
    expect(safeWorker).toContain("botContinuity: 'attention'");
    expect(safeWorker).toContain('parseContinuityTuple');
    expect(safeWorker).toContain('forwardStdout: false');
    expect(safeWorker).toContain('forwardStderr: false');

    expect(managed).toContain('WORKER_CONTINUITY_ADMIN_DATABASE_URL');
    expect(managed).toContain('wtc_test_worker_continuity_');
    expect(managed).toContain("['scripts/safe-worker-tick.mjs', '--require-db', '--expect-continuity=full']");
    expect(managed).toContain('prepareWorkerContinuityFixture');
    expect(managed).toContain("CREATE TABLE api_keys");
    expect(managed).toContain("CREATE TABLE symbolsettingss");
    expect(managed).toContain("CREATE TABLE stageconfigs");
    expect(managed).toContain("CREATE TABLE slots");
    expect(managed).toContain("CREATE TABLE orders");
    expect(managed).toContain("LEGACY_LIVE_READS_ENABLED: 'true'");
    expect(managed).toContain('LEGACY_DATABASE_URL: targetUrl');
    expect(managed).toContain("TORTILA_JOURNAL_URL: ''");
    expect(managed).toContain("WHERE target = 'worker'");
    expect(managed).toContain('ORDER BY created_at DESC');
    expect(managed).not.toContain('ORDER BY checked_at DESC');
    expect(managed).toContain('DROP DATABASE IF EXISTS');
    expect(managed).toContain('runRedactedChildProcess');
    expect(managed).not.toContain("stdio: 'inherit'");
  });

  it('safe worker wrapper refuses unsupported args and profiles without DB mutation', () => {
    const unknown = runSafeWorker(['--wat']);
    expect(unknown.status).toBe(2);
    expect(outputOf(unknown)).toContain('unknown argument');

    const badProfile = runSafeWorker(['--expect-continuity=pretend']);
    expect(badProfile.status).toBe(2);
    expect(outputOf(badProfile)).toContain('unsupported continuity expectation profile');

    const help = runSafeWorker(['--help']);
    expect(help.status).toBe(0);
    expect(outputOf(help)).toContain('--expect-continuity=full|setup-needed');
    expect(outputOf(help)).toContain('worker_status=ok');
    expect(outputOf(help)).not.toContain('postgres://user:password');
  });

  it('managed runner redacts and refuses missing, invalid, throwaway, and unknown inputs', () => {
    const help = runManaged(['--help']);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('WORKER_CONTINUITY_ADMIN_DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<maintenance_db>');
    expect(help.stdout).toContain('wtc_test_worker_continuity_*');
    expect(help.stdout).toContain('Legacy fixture DB snapshots');

    const unknown = runManaged(['--wat']);
    expect(unknown.status).toBe(2);
    expect(outputOf(unknown)).toContain('unknown argument');

    const missing = runManaged();
    expect(missing.status).toBe(2);
    expect(outputOf(missing)).toContain('Set WORKER_CONTINUITY_ADMIN_DATABASE_URL');

    const invalid = runManaged([], { WORKER_CONTINUITY_ADMIN_DATABASE_URL: 'not-a-postgres-url' });
    expect(invalid.status).toBe(2);
    expect(outputOf(invalid)).toContain('not a valid URL');

    const throwawayUrl = postgresUrl('postgres', 'not-real', '127.0.0.1:5432/wtc_test_worker_continuity_bad');
    const throwaway = runManaged([], { WORKER_CONTINUITY_ADMIN_DATABASE_URL: throwawayUrl });
    expect(throwaway.status).toBe(2);
    expect(outputOf(throwaway)).toContain('non-throwaway maintenance database');
    expect(outputOf(throwaway)).not.toContain(throwawayUrl);
    expect(outputOf(throwaway)).not.toContain('not-real');
  });

  it('does not write full database URLs or credentials into acceptance runner sources', () => {
    for (const source of [read('scripts/safe-worker-tick.mjs'), read('scripts/run-worker-continuity-managed.mjs')]) {
      expect(source).not.toMatch(/postgres:\/\/[^<][^\s'"]+:[^\s'"]+@/);
      expect(source).not.toContain('password@');
      expect(source).not.toMatch(/postgres:\/\/\w+:\w+@/);
    }
  });
});
