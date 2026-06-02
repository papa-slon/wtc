import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

let tmp: string | null = null;

afterEach(() => {
  if (tmp) rmSync(resolve(process.cwd(), tmp), { recursive: true, force: true });
  tmp = null;
});

function makeTmp(): string {
  tmp = join('logs', `test-lms-artifacts-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(resolve(process.cwd(), tmp), { recursive: true });
  return tmp;
}

function runScan(path: string, env: Record<string, string> = {}): string {
  return execFileSync(process.execPath, ['scripts/scan-lms-db-e2e-artifacts.mjs', path], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runScanRaw(paths: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['scripts/scan-lms-db-e2e-artifacts.mjs', ...paths], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
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

describe('LMS DB e2e artifact scanner', () => {
  it('passes clean generated text artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'summary.txt'), '44 passed\nno-store\ncontent-type text/plain\n');
    expect(runScan(dir)).toContain('artifact scan passed');
  });

  it('refuses unsafe explicit roots without echoing supplied path values', () => {
    const unsafeRoots = [
      ['https://example.invalid/logs?token=', 'secret-token'].join(''),
      'logs/../../secret-token-outside',
      resolve(process.cwd(), '..', 'secret-token-outside'),
    ];

    for (const unsafeRoot of unsafeRoots) {
      const result = runScanRaw([unsafeRoot]);
      const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
      expect(result.status).toBe(2);
      expect(output).toContain('artifact roots must be workspace-local paths');
      expect(output).not.toContain('secret-token');
      expect(output).not.toContain('example.invalid');
    }
  });

  it('refuses missing explicit roots instead of passing with a missing-root count', () => {
    const result = runScanRaw(['logs/test-missing-artifact-root-does-not-exist']);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(2);
    expect(output).toContain('explicit artifact root missing');
  });

  it('refuses linked explicit artifact roots without scanning linked targets', () => {
    const dir = makeTmp();
    const target = join(dir, 'target');
    const linked = join(dir, 'linked-root');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'DATABASE_URL=postgres-secret.txt'), 'clean text\n');
    if (!tryDirectoryLink(resolve(process.cwd(), target), resolve(process.cwd(), linked))) return;

    const result = runScanRaw([linked]);
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
    expect(result.status).toBe(2);
    expect(output).toContain('artifact roots must be workspace-local paths');
    expect(output).not.toContain('DATABASE_URL=postgres-secret');
  });

  it('refuses linked artifact paths discovered during directory walks', () => {
    const dir = makeTmp();
    const artifacts = join(dir, 'artifacts');
    const target = join(dir, 'target');
    const linked = join(artifacts, 'linked-child');
    mkdirSync(artifacts, { recursive: true });
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'summary.txt'), 'clean text\n');
    if (!tryDirectoryLink(resolve(process.cwd(), target), resolve(process.cwd(), linked))) return;

    const result = runScanRaw([artifacts]);
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
    expect(result.status).toBe(2);
    expect(output).toContain('artifact roots must be workspace-local paths');
    expect(output).not.toContain('linked-child/summary.txt');
  });

  it('refuses dynamic marker manifests reached through linked path segments', () => {
    const dir = makeTmp();
    const artifacts = join(dir, 'artifacts');
    const target = join(dir, 'manifest-target');
    const linked = join(dir, 'linked-manifest');
    mkdirSync(artifacts, { recursive: true });
    mkdirSync(target, { recursive: true });
    writeFileSync(join(artifacts, 'summary.txt'), '44 passed\n');
    writeFileSync(join(target, 'markers.json'), JSON.stringify({
      version: 1,
      markers: [{ label: 'linked marker', value: 'linked-manifest-secret-value' }],
    }));
    if (!tryDirectoryLink(resolve(process.cwd(), target), resolve(process.cwd(), linked))) return;

    const result = runScanRaw([artifacts], {
      LMS_DB_E2E_DYNAMIC_MARKERS_PATH: join(linked, 'markers.json'),
    });
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
    expect(result.status).toBe(1);
    expect(output).toContain('dynamic marker manifest rejected');
    expect(output).not.toContain('linked-manifest-secret-value');
  });

  it('refuses unsafe dynamic marker manifest paths without echoing supplied values', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'summary.txt'), '44 passed\n');
    const result = runScanRaw([dir], {
      LMS_DB_E2E_DYNAMIC_MARKERS_PATH: ['https://example.invalid/markers.json?token=', 'secret-token'].join(''),
    });
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('dynamic marker manifest rejected');
    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('example.invalid');
  });

  it('fails on LMS uploaded bytes, storage keys, or raw iframe HTML in text artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'leak.html'), [
      'fileBytesBase64',
      'fileName',
      'mimeType',
      'lms/materials/aa/hash/name',
      'db-backed lms acceptance desktop',
      '<iframe src="https://player.vimeo.com/video/123456789"></iframe>',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on LMS metadata fields or auth headers in generated artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'trace.json'), JSON.stringify({
      contentSha256: 'not-a-hash',
      storageProvider: 'db-local',
      retainedUntil: 1_900_000_000_000,
      quarantineReason: 'eicar_test_signature',
      deletedAt: null,
      hasStorageKey: true,
      headers: {
        'x-lms-sha256': 'not-used-anymore',
        'set-cookie': 'wtc_session=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        authorization: 'Bearer abc.def',
      },
    }));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on LMS scanner token assignments in generated artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'scanner-env.log'), 'LMS_FILE_SCANNER_ENDPOINT=https://scanner.example.test/scan\nLMS_FILE_SCANNER_TOKEN=scanner-local-token-value\n');
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on external scanner request or provider response evidence in generated artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'scanner-network.log'), [
      'LMS_FILE_SCANNER_LIVE_ACCEPTANCE=1',
      'LMS_FILE_SCANNER_LIVE_EICAR=1',
      'authorization: Bearer scanner-local-token-value',
      'content-type: application/octet-stream',
      'x-wtc-lms-mime-type: text/plain',
      'x-wtc-lms-size-bytes: 4',
      '{"status":"clean"}',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on Stripe webhook replay secrets, signatures, or raw provider bodies', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'stripe-replay.log'), [
      'STRIPE_SECRET_KEY=sk_test_retained_secret',
      'STRIPE_WEBHOOK_SECRET=whsec_retained_secret',
      'stripe-signature: t=1900000000,v1=8bd2c1b03d3d7b35f9e3f5ce3cc8283e',
      '{"id":"evt_retained","object":"event","type":"checkout.session.completed"}',
      'cs_test_retained_session',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on Stripe checkout request secrets, price IDs, or raw request bodies', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'stripe-checkout.log'), [
      'Authorization: Bearer sk_test_retained_secret',
      'POST https://api.stripe.com/v1/checkout/sessions',
      'line_items[0][price]=price_retained',
      'metadata[userId]=00000000-0000-4000-8000-000000000123',
      'cs_test_retained_session',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on Axioma handoff key, token, or raw claim evidence in generated artifacts', () => {
    const dir = makeTmp();
    const jwt = [
      Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: 'kid-retained' })).toString('base64url'),
      Buffer.from(JSON.stringify({ jti: '00000000-0000-4000-8000-000000000001', nonce: 'raw-nonce', wtc_axioma_user_id: 'axioma-user' })).toString('base64url'),
      Buffer.from('signature').toString('base64url'),
    ].join('.');
    writeFileSync(join(dir, 'axioma-handoff.log'), [
      'AXIOMA_HANDOFF_SIGNING_KEY=-----BEGIN PRIVATE KEY-----',
      'AXIOMA_BRIDGE_API_TOKEN=service-token',
      'POST https://axi-o.ma/wtc-handoff',
      jwt,
      '{"jti":"00000000-0000-4000-8000-000000000001","nonce":"raw-nonce","wtc_axioma_user_id":"axioma-user"}',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on object-store env assignments or provider response markers in generated artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'object-store-env.log'), [
      'LMS_OBJECT_STORAGE_ENDPOINT=https://objects.example.test',
      'LMS_OBJECT_STORAGE_BUCKET=wtc-lms-live-test',
      'LMS_OBJECT_STORAGE_REGION=auto',
      'LMS_OBJECT_STORAGE_ACCESS_KEY_ID=local-access-id',
      'LMS_OBJECT_STORAGE_SECRET_ACCESS_KEY=object-storage-test-secret-value',
      'x-amz-content-sha256: abc123',
      'x-amz-date: 20300317T174640Z',
      '<Error><Code>SignatureDoesNotMatch</Code></Error>',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on signed object URL tokens in generated artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'network.txt'), 'redirect https://objects.example.test/object?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc123');
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on raw preview URLs or public-IP SSH targets without printing matched values', () => {
    const dir = makeTmp();
    const rawPreviewUrl = ['http://54', '.179', '.188', '.61/'].join('');
    const rawSshTarget = ['ubuntu@54', '.179', '.188', '.61'].join('');
    writeFileSync(join(dir, 'preview.log'), [
      `APP_BASE_URL=${rawPreviewUrl}`,
      `ssh ${rawSshTarget}`,
      `preview ${rawPreviewUrl}app/login`,
    ].join('\n'));
    try {
      runScan(dir);
      throw new Error('scan unexpectedly passed');
    } catch (error) {
      const text = `${error instanceof Error ? error.message : String(error)}`;
      expect(text).toContain('artifact scan failed');
      expect(text).toContain('raw public IP URL in artifact');
      expect(text).toContain('raw SSH public IP target in artifact');
      expect(text).toContain('preview/base URL assignment in artifact');
      expect(text).not.toContain(rawPreviewUrl);
      expect(text).not.toContain(rawSshTarget);
    }
  });

  it('fails on generic DB URL, DSN, redirect URL, or token assignments without printing values', () => {
    const dir = makeTmp();
    const dsn = ['postgres://audit_role', ':', 'role-pass@127.0.0.1:5432/wtc_test_audit'].join('');
    const token = ['journal', '-read', '-token', '-retained'].join('');
    const redirectUrl = ['https://preview', '.example', '.invalid/checkout/success'].join('');
    writeFileSync(join(dir, 'env-and-redirects.log'), [
      `REAL_POSTGRES_DATABASE_URL=${dsn}`,
      `LMS_E2E_ADMIN_DATABASE_URL=${dsn}`,
      `AUDIT_APPEND_ONLY_DATABASE_URL=${dsn}`,
      `DATABASE_DSN=${dsn}`,
      `JOURNAL_READ_TOKEN=${token}`,
      `WTC_INTERNAL_API_KEY=${token}`,
      `success_url=${redirectUrl}`,
      `cancel_url=${redirectUrl}`,
    ].join('\n'));
    try {
      runScan(dir);
      throw new Error('scan unexpectedly passed');
    } catch (error) {
      const text = `${error instanceof Error ? error.message : String(error)}`;
      expect(text).toContain('artifact scan failed');
      expect(text).toContain('database/admin URL or DSN assignment');
      expect(text).toContain('generic secret token or API key assignment');
      expect(text).toContain('raw app redirect URL field in artifact');
      expect(text).not.toContain(dsn);
      expect(text).not.toContain(token);
      expect(text).not.toContain(redirectUrl);
    }
  });

  it('refuses raw preview/dev-server logs as retained archive evidence', () => {
    const dir = makeTmp();
    const previewLog = join(dir, 'preview-safe-phase356.log');
    const devLog = join(dir, 'dev-server.log');
    writeFileSync(previewLog, 'ready - started server on 0.0.0.0:3000\n');
    writeFileSync(devLog, 'ready - local dev server\n');

    const result = runScanRaw([previewLog, devLog]);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('raw safe-preview log artifact');
    expect(output).toContain('raw dev-server log artifact');
  });

  it('fails on object cleanup evidence with raw keys or request headers', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'cleanup.log'), [
      'lms object cleanup failed for lms/materials/objectcleanupdeleted01',
      'authorization: AWS4-HMAC-SHA256 Credential=local-access-id/20260602/auto/s3/aws4_request',
      'X-Amz-Signature=abc123',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on pending upload cleanup retry evidence with raw object material', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'pending-upload-cleanup.log'), [
      'pending cleanup task 00000000-0000-4000-8000-000000000001',
      'cleanupTaskId=00000000-0000-4000-8000-000000000001',
      'DELETE https://objects.example.test/wtc-lms-test/lms/materials/pendinguploaddeleteok01',
      'Authorization: AWS4-HMAC-SHA256 Credential=local-access-id/20260602/auto/s3/aws4_request',
      'X-Amz-Algorithm=AWS4-HMAC-SHA256',
    ].join('\n'));
    expect(() => runScan(dir)).toThrow(/artifact scan failed/);
  });

  it('fails on dynamic marker manifest values without printing matched values', () => {
    const dir = makeTmp();
    const artifacts = join(dir, 'artifacts');
    mkdirSync(artifacts);
    const manifest = join(dir, 'dynamic-markers.json');
    const dynamicValue = 'wtc-db-e2e-notes-dynamic-secret.txt';
    writeFileSync(manifest, JSON.stringify({
      version: 1,
      markers: [{ label: 'uploaded filename', value: dynamicValue }],
    }));
    writeFileSync(join(artifacts, 'trace.txt'), `download header ${dynamicValue}\n`);
    try {
      runScan(artifacts, { LMS_DB_E2E_DYNAMIC_MARKERS_PATH: manifest });
      throw new Error('scan unexpectedly passed');
    } catch (error) {
      const text = `${error instanceof Error ? error.message : String(error)}`;
      expect(text).toContain('dynamic LMS marker uploaded filename');
      expect(text).not.toContain(dynamicValue);
    }
  });

  it('fails closed on malformed dynamic marker manifests', () => {
    const dir = makeTmp();
    const artifacts = join(dir, 'artifacts');
    mkdirSync(artifacts);
    const manifest = join(dir, 'dynamic-markers.json');
    writeFileSync(manifest, JSON.stringify({ version: 1, markers: [{ label: 'bad', value: '' }] }));
    writeFileSync(join(artifacts, 'summary.txt'), '44 passed\n');
    expect(() => runScan(artifacts, { LMS_DB_E2E_DYNAMIC_MARKERS_PATH: manifest })).toThrow(/dynamic marker manifest rejected/);
  });

  it('skips screenshot image bytes but fails closed on compressed trace artifacts', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'lesson.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, ...Buffer.from('storageKey')]));
    expect(runScan(dir)).toContain('artifact scan passed');

    writeFileSync(join(dir, 'trace.zip'), Buffer.from('not a real zip'));
    expect(() => runScan(dir)).toThrow(/unscanned binary\/container artifact/);
  });

  it('does not print the forbidden matched value in failure output', () => {
    const dir = makeTmp();
    const secretLike = ['postgres://user', ':', 'pass@127.0.0.1:5432/wtc_test_lms_secret'].join('');
    writeFileSync(join(dir, 'stdout.log'), `LMS_E2E_DATABASE_URL=${secretLike}\n`);
    try {
      runScan(dir);
      throw new Error('scan unexpectedly passed');
    } catch (error) {
      const text = `${error instanceof Error ? error.message : String(error)}`;
      expect(text).toContain('artifact scan failed');
      expect(text).not.toContain(secretLike);
    }
  });

  it('is wired into the opt-in LMS DB e2e runner', () => {
    const runner = execFileSync(process.execPath, ['-e', "console.log(require('fs').readFileSync('scripts/run-lms-db-e2e.mjs','utf8'))"], {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(runner).toContain('scripts/scan-lms-db-e2e-artifacts.mjs');
    expect(runner).toContain('runRedactedChildProcess');
    expect(runner).toContain('scanning generated artifacts before exit');
    expect(runner).toContain('Archive redacted stdout, test-results/');
  });
});
