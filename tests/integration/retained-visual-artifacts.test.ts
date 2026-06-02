import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

let tmp: string | null = null;

const reviewedMarkerLabels = [
  'secret-like text',
  'Postgres URL or DSN',
  'session or auth token',
  'cookie or authorization header',
  'raw public IP URL',
  'signed object URL token',
  'LMS internal storage or metadata',
  'Stripe or provider token',
];

afterEach(() => {
  if (tmp) rmSync(resolve(process.cwd(), tmp), { recursive: true, force: true });
  tmp = null;
});

function makeTmp(): string {
  tmp = join('logs', `test-retained-visual-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(resolve(process.cwd(), tmp), { recursive: true });
  return tmp;
}

function runVisual(args: string[], env: Record<string, string> = {}): string {
  return execFileSync(process.execPath, ['scripts/check-retained-visual-artifacts.mjs', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function runVisualRaw(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['scripts/check-retained-visual-artifacts.mjs', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
    windowsHide: true,
  });
}

function writeImage(dir: string, name = 'screen.png') {
  writeFileSync(join(dir, name), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));
}

function writeManifest(dir: string, entries: unknown[]) {
  const manifest = join(dir, 'visual-review.json');
  writeFileSync(manifest, JSON.stringify({ version: 1, generatedAt: '2026-06-02T00:00:00.000Z', artifacts: entries }));
  return manifest;
}

function reviewedEntry(path: string, extra: Record<string, unknown> = {}) {
  return {
    path,
    result: 'pass',
    method: 'manual',
    reviewer: 'operator',
    reviewedAt: '2026-06-02T00:00:00.000Z',
    reviewedMarkerLabels,
    ...extra,
  };
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

describe('retained visual artifact checker', () => {
  it('fails closed when retained images exist without a review manifest', () => {
    const dir = makeTmp();
    writeImage(dir);
    const result = runVisualRaw([dir]);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('review manifest required');
    expect(output).toContain('missing visual review manifest');
  });

  it('supports inventory mode without claiming acceptance', () => {
    const dir = makeTmp();
    writeImage(dir);
    const output = runVisual(['--inventory', dir]);
    expect(output).toContain('retained visual artifact inventory');
    expect(output).toContain('1 image file(s)');
  });

  it('passes when every retained image has a passing manual review entry', () => {
    const dir = makeTmp();
    writeImage(dir);
    const imagePath = `${dir.replaceAll('\\', '/')}/screen.png`;
    const manifest = writeManifest(dir, [reviewedEntry(imagePath)]);
    const output = runVisual(['--manifest', manifest, dir]);
    expect(output).toContain('retained visual artifact check passed');
    expect(output).toContain('1 reviewed artifact(s)');
  });

  it('validates a supplied manifest even when the scanned root has no retained images', () => {
    const dir = makeTmp();
    const manifest = writeManifest(dir, [reviewedEntry(`${dir.replaceAll('\\', '/')}/ghost.png`)]);
    const result = runVisualRaw(['--manifest', manifest, dir]);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('manifest artifact is not present in scanned image roots');
  });

  it('fails when the manifest omits a retained image', () => {
    const dir = makeTmp();
    writeImage(dir, 'one.png');
    writeImage(dir, 'two.png');
    const manifest = writeManifest(dir, [reviewedEntry(`${dir.replaceAll('\\', '/')}/one.png`)]);
    const result = runVisualRaw(['--manifest', manifest, dir]);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('missing visual review manifest entry');
  });

  it('scans OCR text sidecars and does not print matched values', () => {
    const dir = makeTmp();
    writeImage(dir);
    const secretLike = ['postgres://visual', ':', 'secret@127.0.0.1:5432/wtc_test_visual'].join('');
    const sidecar = join(dir, 'screen.ocr.txt');
    writeFileSync(sidecar, `OCR saw ${secretLike}\n`);
    const manifest = writeManifest(dir, [
      reviewedEntry(`${dir.replaceAll('\\', '/')}/screen.png`, { method: 'ocr', ocrTextPath: sidecar }),
    ]);

    const result = runVisualRaw(['--manifest', manifest, dir]);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('OCR text sidecar contains Postgres URL or DSN');
    expect(output).not.toContain(secretLike);
  });

  it('requires dynamic marker labels in review manifests without printing marker values', () => {
    const dir = makeTmp();
    writeImage(dir);
    const markerValue = 'visual-dynamic-secret-marker';
    const markerManifest = join(dir, 'markers.json');
    writeFileSync(markerManifest, JSON.stringify({
      version: 1,
      markers: [{ label: 'visual marker', value: markerValue }],
    }));
    const manifest = writeManifest(dir, [reviewedEntry(`${dir.replaceAll('\\', '/')}/screen.png`)]);

    const result = runVisualRaw(['--manifest', manifest, dir], {
      LMS_DB_E2E_DYNAMIC_MARKERS_PATH: markerManifest,
    });
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('missing reviewed marker label dynamic marker visual marker');
    expect(output).not.toContain(markerValue);
  });

  it('refuses unsafe roots and manifest paths without echoing supplied values', () => {
    const result = runVisualRaw(['--manifest', 'https://example.invalid/manifest?token=secret-token', 'logs/../../secret-token']);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).toBe(2);
    expect(output).toContain('artifact roots must be workspace-local paths');
    expect(output).not.toContain('secret-token');
    expect(output).not.toContain('example.invalid');
  });

  it('refuses linked visual artifact roots without inventorying linked targets', () => {
    const dir = makeTmp();
    const target = join(dir, 'target');
    const linked = join(dir, 'linked-root');
    mkdirSync(target, { recursive: true });
    writeImage(target);
    if (!tryDirectoryLink(resolve(process.cwd(), target), resolve(process.cwd(), linked))) return;

    const result = runVisualRaw(['--inventory', linked]);
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
    expect(result.status).toBe(2);
    expect(output).toContain('artifact roots must be workspace-local paths');
    expect(output).not.toContain('screen.png');
  });

  it('refuses linked visual artifact paths discovered during directory walks', () => {
    const dir = makeTmp();
    const artifacts = join(dir, 'artifacts');
    const target = join(dir, 'target');
    const linked = join(artifacts, 'linked-child');
    mkdirSync(artifacts, { recursive: true });
    mkdirSync(target, { recursive: true });
    writeImage(target);
    if (!tryDirectoryLink(resolve(process.cwd(), target), resolve(process.cwd(), linked))) return;

    const result = runVisualRaw(['--inventory', artifacts]);
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
    expect(result.status).toBe(2);
    expect(output).toContain('artifact roots must be workspace-local paths');
    expect(output).not.toContain('linked-child/screen.png');
  });

  it('rejects visual review manifests reached through linked path segments', () => {
    const dir = makeTmp();
    const artifacts = join(dir, 'artifacts');
    const target = join(dir, 'manifest-target');
    const linked = join(dir, 'linked-manifest');
    mkdirSync(artifacts, { recursive: true });
    mkdirSync(target, { recursive: true });
    writeImage(artifacts);
    const imagePath = `${artifacts.replaceAll('\\', '/')}/screen.png`;
    writeManifest(target, [reviewedEntry(imagePath)]);
    if (!tryDirectoryLink(resolve(process.cwd(), target), resolve(process.cwd(), linked))) return;

    const result = runVisualRaw(['--manifest', join(linked, 'visual-review.json'), artifacts]);
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
    expect(result.status).toBe(1);
    expect(output).toContain('visual review manifest rejected');
    expect(output).not.toContain('linked-manifest');
  });

  it('rejects OCR sidecars reached through linked path segments', () => {
    const dir = makeTmp();
    const artifacts = join(dir, 'artifacts');
    const target = join(dir, 'ocr-target');
    const linked = join(dir, 'linked-ocr');
    mkdirSync(artifacts, { recursive: true });
    mkdirSync(target, { recursive: true });
    writeImage(artifacts);
    writeFileSync(join(target, 'screen.ocr.txt'), 'clean OCR text\n');
    if (!tryDirectoryLink(resolve(process.cwd(), target), resolve(process.cwd(), linked))) return;

    const imagePath = `${artifacts.replaceAll('\\', '/')}/screen.png`;
    const manifest = writeManifest(artifacts, [
      reviewedEntry(imagePath, { method: 'ocr', ocrTextPath: join(linked, 'screen.ocr.txt') }),
    ]);

    const result = runVisualRaw(['--manifest', manifest, artifacts]);
    const output = `${result.stdout}\n${result.stderr}`.replaceAll('\\', '/');
    expect(result.status).toBe(1);
    expect(output).toContain('OCR text sidecar rejected');
    expect(output).not.toContain('linked-ocr/screen.ocr.txt');
  });

  it('is exposed through the root package script', () => {
    const pkg = execFileSync(process.execPath, ['-e', "console.log(require('fs').readFileSync('package.json','utf8'))"], {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(pkg).toContain('"evidence:visual": "node scripts/check-retained-visual-artifacts.mjs"');
  });

  it('keeps CI upload limited to validated visual review manifests', () => {
    const workflow = execFileSync(process.execPath, ['-e', "console.log(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"], {
      cwd: process.cwd(),
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(workflow).toContain('Validate reviewed visual evidence manifests');
    expect(workflow).toContain('npm run evidence:visual -- --manifest "$manifest" tests/e2e/screenshots');
    expect(workflow).toContain('path: logs/retained-visual-artifacts/**/visual-review*.json');
    expect(workflow).not.toContain('path: tests/e2e/screenshots/**');
  });
});
