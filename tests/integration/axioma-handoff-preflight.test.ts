import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function cleanOutput(text: string): string {
  return text.replaceAll('\\', '/');
}

function makeLogRoot(): string {
  return join('logs', `test-axioma-handoff-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function removeLogRoot(logRoot: string) {
  rmSync(resolve(ROOT, logRoot), { recursive: true, force: true });
}

function safeEnv(logRoot: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    APP_ENV: 'development',
    AXIOMA_HANDOFF_SIGNING_KEY: '',
    AXIOMA_HANDOFF_KEY_ID: '',
    AXIOMA_BRIDGE_API_TOKEN: '',
    AXIOMA_HANDOFF_PREFLIGHT_LOG_ROOT: logRoot,
  };
}

describe('Axioma handoff preflight harness', () => {
  it('is an opt-in command and stays out of default gates', () => {
    const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const gates = read('scripts/gates.mjs');

    expect(rootPkg.scripts['accept:axioma:handoff-preflight']).toBe('node --import tsx scripts/axioma-handoff-preflight.mjs');
    expect(rootPkg.scripts.e2e).not.toContain('axioma-handoff-preflight');
    expect(rootPkg.scripts['ci:local']).not.toContain('accept:axioma:handoff-preflight');
    expect(gates).not.toContain('accept:axioma:handoff-preflight');
    expect(gates).not.toContain('axioma-handoff-preflight');
  });

  it('runs dry-run through generated ES256/JWKS and local handlers with retained evidence redacted', () => {
    const logs = makeLogRoot();
    try {
      const stdout = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/axioma-handoff-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: safeEnv(logs),
        encoding: 'utf8',
        windowsHide: true,
      });
      const output = cleanOutput(stdout);
      expect(output).toContain('dry-run complete');
      expect(output).toContain('network=not-run');
      for (const forbidden of [
        'PRIVATE KEY',
        'AXIOMA_HANDOFF_SIGNING_KEY',
        'AXIOMA_BRIDGE_API_TOKEN',
        'Bearer ',
        '/wtc-handoff',
        '"jti"',
        '"nonce"',
        'wtc_axioma_user_id',
      ]) {
        expect(output).not.toContain(forbidden);
      }

      const summaries = readdirSync(logs).filter((name) => name.startsWith('summary-') && name.endsWith('.json'));
      expect(summaries).toHaveLength(1);
      const summary = readFileSync(join(logs, summaries[0]!), 'utf8');
      expect(summary).toContain('"provider": "axioma"');
      expect(summary).toContain('"network": "not-run"');
      expect(summary).toContain('"result": "pass"');
      expect(summary).toContain('"alg": "ES256"');
      expect(summary).toContain('"replayStatus": 409');
      for (const forbidden of [
        'PRIVATE KEY',
        'AXIOMA_HANDOFF_SIGNING_KEY',
        'AXIOMA_BRIDGE_API_TOKEN',
        'Bearer ',
        '/wtc-handoff',
        '"jti"',
        '"nonce"',
        'wtc_axioma_user_id',
      ]) {
        expect(summary).not.toContain(forbidden);
      }
      expect(summary).not.toMatch(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/);

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

  it('refuses production or configured live-material environments', () => {
    const logs = makeLogRoot();
    try {
      expect(() => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/axioma-handoff-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: { ...safeEnv(logs), APP_ENV: 'production' },
        encoding: 'utf8',
        windowsHide: true,
      })).toThrow(/preflight refused/);

      expect(() => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/axioma-handoff-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: { ...safeEnv(logs), AXIOMA_HANDOFF_SIGNING_KEY: 'configured-key-must-not-be-used' },
        encoding: 'utf8',
        windowsHide: true,
      })).toThrow(/preflight refused/);

      expect(() => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/axioma-handoff-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: { ...safeEnv(logs), AXIOMA_BRIDGE_API_TOKEN: 'configured-token-must-not-be-used' },
        encoding: 'utf8',
        windowsHide: true,
      })).toThrow(/preflight refused/);
    } finally {
      removeLogRoot(logs);
    }
  });
});
