import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { redactProcessOutput, runRedactedChildProcess } from '../../scripts/redacted-child-process.mjs';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function postgresUrl(user: string, password: string, hostAndDb: string): string {
  return ['postgres://', user, ':', password, '@', hostAndDb].join('');
}

function leakCorpus(): string {
  const dbUrl = postgresUrl('child_user', 'child_pw', '127.0.0.1:5432/wtc_test_child');
  const jwt = ['eyJ', 'a'.repeat(12), '.', 'b'.repeat(12), '.', 'c'.repeat(12)].join('');
  const stripeKey = ['sk', '_test_', 'childsecret'].join('');
  const webhook = ['whsec', '_childsecret'].join('');
  const privateKey = [
    '-----BEGIN ',
    'PRIVATE KEY-----',
    '\nchild-key-material\n',
    '-----END ',
    'PRIVATE KEY-----',
  ].join('');
  return [
    `DATABASE_URL=${dbUrl}`,
    `REAL_POSTGRES_DATABASE_URL=${dbUrl}`,
    `password=child_pw`,
    `Authorization: Bearer child-token`,
    `authorization=Basic Y2hpbGQ6cHc=`,
    `cookie: wtc_session=${'a'.repeat(64)}`,
    `STRIPE_SECRET_KEY=${stripeKey}`,
    `STRIPE_WEBHOOK_SECRET=${webhook}`,
    `AXIOMA_BRIDGE_API_TOKEN=axioma-child-token`,
    `LMS_FILE_SCANNER_TOKEN=scanner-child-token`,
    `LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY=object-child-secret`,
    `ADMIN_USER_BOTS_E2E_HMAC=hmac-child-secret`,
    `PUBLIC_PREVIEW_URL=http://203.0.113.44:3000/app`,
    `LMS_FILE_SCANNER_ENDPOINT=https://scanner.example.invalid/check`,
    `signed=https://storage.example.invalid/object?X-Amz-Signature=childsig&AWSAccessKeyId=childkey`,
    jwt,
    privateKey,
  ].join('\n');
}

describe('child process retained-output redaction', () => {
  it('redacts the child-output leak corpus in plain text', () => {
    const raw = leakCorpus();
    const out = redactProcessOutput(raw);

    for (const forbidden of [
      'child_user:child_pw',
      'child_pw',
      'child-token',
      'Y2hpbGQ6cHc=',
      'childsecret',
      'axioma-child-token',
      'scanner-child-token',
      'object-child-secret',
      'hmac-child-secret',
      '203.0.113.44',
      'scanner.example.invalid',
      'childsig',
      'childkey',
      'child-key-material',
    ]) {
      expect(out).not.toContain(forbidden);
    }
    expect(out).toContain('<redacted>');
    expect(out).toContain('DATABASE_URL=<redacted>');
    expect(out).toContain('Authorization: <redacted>');
    expect(out).toContain('cookie: <redacted>');
  });

  it('captures child stdout and stderr before forwarding retained output', () => {
    const stdoutLeak = leakCorpus();
    const stderrLeak = `${leakCorpus()}\nstderr-only=Bearer stderr-child-token`;
    const result = runRedactedChildProcess(process.execPath, [
      '--input-type=module',
      '-e',
      [
        'process.stdout.write(process.env.CHILD_REDACTION_STDOUT);',
        'process.stderr.write(process.env.CHILD_REDACTION_STDERR);',
        'process.exit(7);',
      ].join(''),
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        CHILD_REDACTION_STDOUT: stdoutLeak,
        CHILD_REDACTION_STDERR: stderrLeak,
      },
      forwardStdout: false,
      forwardStderr: false,
      windowsHide: true,
    });

    const retained = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(7);
    expect(retained).toContain('<redacted>');
    expect(retained).not.toContain('child_user:child_pw');
    expect(retained).not.toContain('child-token');
    expect(retained).not.toContain('stderr-child-token');
    expect(retained).not.toContain('203.0.113.44');
    expect(retained).not.toContain('child-key-material');
  });

  it.runIf(process.platform === 'win32')('runs Windows cmd shims through the redacted child-process helper', () => {
    const result = runRedactedChildProcess('npm.cmd', ['--version'], {
      cwd: ROOT,
      forwardStdout: false,
      forwardStderr: false,
      windowsHide: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('wires retained gate logs through the redacted child-process helper', () => {
    const gates = read('scripts/gates.mjs');
    const worker = read('scripts/safe-worker-tick.mjs');
    const preview = read('scripts/safe-preview.mjs');

    expect(gates).toContain("import { runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(gates).toContain('forwardStdout: false');
    expect(gates).toContain('forwardStderr: false');
    expect(gates).toContain('redacted child output discarded after metric extraction');
    expect(gates).toContain("writeFileSync(logFile, retainedLog, 'utf8')");
    expect(gates).not.toContain('execSync(');
    expect(gates).not.toContain("stdio: ['ignore', fd, fd]");
    expect(worker).toContain("import { runRedactedChildProcess } from './redacted-child-process.mjs'");
    expect(worker).toContain('runRedactedChildProcess(process.execPath, args');
    expect(worker).not.toContain("stdio: 'inherit'");
    expect(preview).toContain("import { redactProcessOutput } from './redacted-child-process.mjs'");
    expect(preview).toContain('createRedactedStreamForwarder');
    expect(preview).toContain("stdio: ['inherit', 'pipe', 'pipe']");
    expect(preview).not.toContain("stdio: 'inherit'");
  });
});
