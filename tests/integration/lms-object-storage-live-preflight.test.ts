import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function fixtureEnv(logRoot: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LMS_FILE_STORAGE_PROVIDER: 's3-r2',
    LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/',
    LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
    LMS_OBJECT_STORAGE_REGION: 'auto',
    LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
    LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
    LMS_PUBLIC_UPLOADS_ENABLED: 'false',
    LMS_OBJECT_STORAGE_PREFLIGHT_LOG_ROOT: logRoot,
  };
}

function cleanOutput(text: string): string {
  return text.replaceAll('\\', '/');
}

function makeLogRoot(): string {
  return join('logs', `test-lms-s3-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function removeLogRoot(logRoot: string) {
  rmSync(resolve(ROOT, logRoot), { recursive: true, force: true });
}

describe('LMS S3/R2 live preflight harness', () => {
  it('is an opt-in command and stays out of default gates', () => {
    const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const gates = read('scripts/gates.mjs');

    expect(rootPkg.scripts['accept:lms:object-storage']).toBe('node scripts/lms-s3-r2-live-preflight.mjs');
    expect(rootPkg.scripts.e2e).not.toContain('lms-s3-r2-live-preflight');
    expect(rootPkg.scripts['ci:local']).not.toContain('accept:lms:object-storage');
    expect(gates).not.toContain('accept:lms:object-storage');
    expect(gates).not.toContain('lms-s3-r2-live-preflight');
  });

  it('builds only redacted dry-run evidence without network output', () => {
    const logs = makeLogRoot();
    try {
      const stdout = execFileSync(process.execPath, ['scripts/lms-s3-r2-live-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: fixtureEnv(logs),
        encoding: 'utf8',
        windowsHide: true,
      });
      const output = cleanOutput(stdout);
      expect(output).toContain('dry-run complete');
      for (const forbidden of [
        'https://objects.test.local',
        'wtc-lms-test',
        'local-access-id',
        'object-storage-test-secret-value',
        'lms/materials/',
        'X-Amz-',
        'AWS4-HMAC-SHA256',
        'authorization',
      ]) {
        expect(output).not.toContain(forbidden);
      }

      const summaries = readdirSync(logs).filter((name) => name.startsWith('summary-') && name.endsWith('.json'));
      expect(summaries).toHaveLength(1);
      const summary = readFileSync(join(logs, summaries[0]!), 'utf8');
      expect(summary).toContain('"mode": "dry-run"');
      expect(summary).toContain('"objectLocator": "redacted"');
      expect(summary).not.toContain('objects.test.local');
      expect(summary).not.toContain('wtc-lms-test');
      expect(summary).not.toContain('local-access-id');
      expect(summary).not.toContain('object-storage-test-secret-value');
      expect(summary).not.toContain('lms/materials/');

      const scan = execFileSync(process.execPath, ['scripts/scan-lms-db-e2e-artifacts.mjs', logs], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(scan).toContain('artifact scan passed');
    } finally {
      removeLogRoot(logs);
    }
  });

  it('refuses live mode without explicit live and throwaway confirmation', () => {
    const logs = makeLogRoot();
    try {
      expect(() => execFileSync(process.execPath, ['scripts/lms-s3-r2-live-preflight.mjs', '--live'], {
        cwd: ROOT,
        env: fixtureEnv(logs),
        encoding: 'utf8',
        windowsHide: true,
      })).toThrow(/live preflight refused/);
    } finally {
      removeLogRoot(logs);
    }
  });
});
