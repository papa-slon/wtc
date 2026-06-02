import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const hostileRoot = ['https://example.invalid/logs?token=', 'secret-token'].join('');
const forbiddenFragments = ['example.invalid', 'secret-token', 'https://example.invalid'];
const created: string[] = [];

const cases = [
  {
    name: 'lms-object-storage',
    command: process.execPath,
    args: ['scripts/lms-s3-r2-live-preflight.mjs', '--dry-run'],
    env: {
      LMS_FILE_STORAGE_PROVIDER: 's3-r2',
      LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/',
      LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
      LMS_OBJECT_STORAGE_REGION: 'auto',
      LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
      LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
      LMS_PUBLIC_UPLOADS_ENABLED: 'false',
      LMS_OBJECT_STORAGE_PREFLIGHT_LOG_ROOT: hostileRoot,
    },
  },
  {
    name: 'lms-external-scanner',
    command: process.execPath,
    args: ['scripts/lms-external-scanner-live-preflight.mjs', '--dry-run'],
    env: {
      LMS_FILE_SCANNER_MODE: 'external',
      LMS_FILE_SCANNER_ENDPOINT: 'https://scanner.test.local/scan',
      LMS_FILE_SCANNER_TOKEN: 'scanner-local-token-value',
      LMS_PUBLIC_UPLOADS_ENABLED: 'false',
      LMS_FILE_SCANNER_PREFLIGHT_LOG_ROOT: hostileRoot,
    },
  },
  {
    name: 'stripe-webhook',
    command: process.execPath,
    args: ['--import', 'tsx', 'scripts/billing-stripe-webhook-replay-preflight.mjs', '--dry-run'],
    env: {
      APP_ENV: 'development',
      STRIPE_WEBHOOK_REPLAY_PREFLIGHT_LOG_ROOT: hostileRoot,
    },
  },
  {
    name: 'stripe-checkout',
    command: process.execPath,
    args: ['--import', 'tsx', 'scripts/billing-stripe-checkout-preflight.mjs', '--dry-run'],
    env: {
      APP_ENV: 'development',
      STRIPE_CHECKOUT_PREFLIGHT_LOG_ROOT: hostileRoot,
    },
  },
  {
    name: 'axioma-handoff',
    command: process.execPath,
    args: ['--import', 'tsx', 'scripts/axioma-handoff-preflight.mjs', '--dry-run'],
    env: {
      APP_ENV: 'development',
      AXIOMA_HANDOFF_SIGNING_KEY: '',
      AXIOMA_HANDOFF_KEY_ID: '',
      AXIOMA_BRIDGE_API_TOKEN: '',
      AXIOMA_HANDOFF_PREFLIGHT_LOG_ROOT: hostileRoot,
    },
  },
];

afterEach(() => {
  for (const rel of created.splice(0)) rmSync(resolve(ROOT, rel), { recursive: true, force: true });
});

function makeRoot(): string {
  const rel = join('logs', `test-preflight-wiring-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  created.push(rel);
  return rel;
}

function tryDirectoryLink(target: string, link: string): boolean {
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES' || code === 'EINVAL') return false;
    }
    throw error;
  }
}

describe('preflight log root wiring', () => {
  it.each(cases)('refuses URL-shaped log roots before summary writes: $name', (item) => {
    const result = spawnSync(item.command, item.args, {
      cwd: ROOT,
      env: { ...process.env, ...item.env },
      encoding: 'utf8',
      windowsHide: true,
    });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');

    expect(result.status).toBe(2);
    expect(output).toContain('preflight log root must be repo-local under logs/');
    expect(output).not.toContain('summary=');
    for (const fragment of forbiddenFragments) expect(output).not.toContain(fragment);
  });

  it('does not create a directory from rejected root-like input', () => {
    const rejectedRel = join('logs', '..', 'outside-preflight-root');
    rmSync(resolve(ROOT, 'outside-preflight-root'), { recursive: true, force: true });
    const result = spawnSync(process.execPath, ['scripts/lms-s3-r2-live-preflight.mjs', '--dry-run'], {
      cwd: ROOT,
      env: {
        ...process.env,
        LMS_FILE_STORAGE_PROVIDER: 's3-r2',
        LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/',
        LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
        LMS_OBJECT_STORAGE_REGION: 'auto',
        LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
        LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
        LMS_PUBLIC_UPLOADS_ENABLED: 'false',
        LMS_OBJECT_STORAGE_PREFLIGHT_LOG_ROOT: rejectedRel,
      },
      encoding: 'utf8',
      windowsHide: true,
    });

    expect(result.status).toBe(2);
    expect(existsSync(resolve(ROOT, 'outside-preflight-root'))).toBe(false);
  });

  it('refuses linked log roots with a clean refusal before summary writes', () => {
    const rel = makeRoot();
    const target = resolve(ROOT, rel, 'target');
    const link = resolve(ROOT, rel, 'linked-root');
    mkdirSync(target, { recursive: true });
    if (!tryDirectoryLink(target, link)) return;

    const result = spawnSync(process.execPath, ['scripts/lms-s3-r2-live-preflight.mjs', '--dry-run'], {
      cwd: ROOT,
      env: {
        ...process.env,
        LMS_FILE_STORAGE_PROVIDER: 's3-r2',
        LMS_OBJECT_STORAGE_ENDPOINT: 'https://objects.test.local/',
        LMS_OBJECT_STORAGE_BUCKET: 'wtc-lms-test',
        LMS_OBJECT_STORAGE_REGION: 'auto',
        LMS_OBJECT_STORAGE_ACCESS_KEY_ID: 'local-access-id',
        LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'object-storage-test-secret-value',
        LMS_PUBLIC_UPLOADS_ENABLED: 'false',
        LMS_OBJECT_STORAGE_PREFLIGHT_LOG_ROOT: `${rel}/linked-root`,
      },
      encoding: 'utf8',
      windowsHide: true,
    });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');

    expect(result.status).toBe(2);
    expect(output).toContain('preflight log root must be repo-local under logs/');
    expect(output).not.toContain('summary=');
    expect(existsSync(resolve(target, 'summary-linked.json'))).toBe(false);
  });
});
