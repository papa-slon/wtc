import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function fixtureEnv(logRoot: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LMS_FILE_SCANNER_MODE: 'external',
    LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.test.local/scan',
    LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
    LMS_FILE_SCANNER_TIMEOUT_MS: '2500',
    LMS_PUBLIC_UPLOADS_ENABLED: 'false',
    LMS_FILE_SCANNER_PREFLIGHT_LOG_ROOT: logRoot,
  };
}

function cleanOutput(text: string): string {
  return text.replaceAll('\\', '/');
}

function makeLogRoot(): string {
  return join('logs', `test-lms-scanner-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function removeLogRoot(logRoot: string) {
  rmSync(resolve(ROOT, logRoot), { recursive: true, force: true });
}

describe('LMS external scanner live preflight harness', () => {
  it('is an opt-in command and stays out of default gates', () => {
    const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const gates = read('scripts/gates.mjs');

    expect(rootPkg.scripts['accept:lms:external-scanner']).toBe('node scripts/lms-external-scanner-live-preflight.mjs');
    expect(rootPkg.scripts.e2e).not.toContain('lms-external-scanner-live-preflight');
    expect(rootPkg.scripts['ci:local']).not.toContain('accept:lms:external-scanner');
    expect(gates).not.toContain('accept:lms:external-scanner');
    expect(gates).not.toContain('lms-external-scanner-live-preflight');
  });

  it('builds only redacted dry-run evidence without scanner network output', () => {
    const logs = makeLogRoot();
    try {
      const stdout = execFileSync(process.execPath, ['scripts/lms-external-scanner-live-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: fixtureEnv(logs),
        encoding: 'utf8',
        windowsHide: true,
      });
      const output = cleanOutput(stdout);
      expect(output).toContain('dry-run complete');
      for (const forbidden of [
        'https://scanner.test.local',
        'scanner-local-token-value',
        'Bearer',
        'authorization',
        'x-wtc-lms-mime-type',
        'x-wtc-lms-size-bytes',
        'application/octet-stream',
        'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
      ]) {
        expect(output).not.toContain(forbidden);
      }

      const summaries = readdirSync(logs).filter((name) => name.startsWith('summary-') && name.endsWith('.json'));
      expect(summaries).toHaveLength(1);
      const summary = readFileSync(join(logs, summaries[0]!), 'utf8');
      expect(summary).toContain('"mode": "dry-run"');
      expect(summary).toContain('"scannerEndpoint": "redacted"');
      expect(summary).not.toContain('scanner.test.local');
      expect(summary).not.toContain('scanner-local-token-value');
      expect(summary).not.toContain('Bearer');
      expect(summary).not.toContain('x-wtc-lms-mime-type');
      expect(summary).not.toContain('application/octet-stream');
      expect(summary).not.toContain('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');

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

  it('refuses live mode without explicit live and quarantine-corpus confirmation', () => {
    const logs = makeLogRoot();
    try {
      expect(() => execFileSync(process.execPath, ['scripts/lms-external-scanner-live-preflight.mjs', '--live'], {
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
