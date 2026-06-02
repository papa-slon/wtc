import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolvePreflightLogRoot, writePreflightSummary } from '../../scripts/preflight-log-root.mjs';

const ROOT = process.cwd();
const created: string[] = [];
const tokenUrl = ['https://example.invalid/logs?token=', 'secret-token'].join('');
const fileUrl = ['file:///', 'tmp/secret-token/logs'].join('');
const postgresUrl = ['postgres://user', ':', 'password@example.invalid/db'].join('');

afterEach(() => {
  for (const rel of created.splice(0)) rmSync(resolve(ROOT, rel), { recursive: true, force: true });
});

function makeRoot(): string {
  const rel = `logs/test-preflight-root-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

describe('preflight log root confinement', () => {
  it('accepts repo-local logs roots and returns normalized relative summary paths', () => {
    const rel = makeRoot();
    const root = resolvePreflightLogRoot(`${rel}\\nested`, 'logs/fallback');
    const summaryPath = writePreflightSummary(root, { runId: 'abc123', result: 'pass' });

    expect(summaryPath).toBe(`${rel}/nested/summary-abc123.json`);
    expect(summaryPath).not.toContain(ROOT);
    const written = resolve(ROOT, summaryPath);
    expect(existsSync(written)).toBe(true);
    expect(readFileSync(written, 'utf8')).toContain('"result": "pass"');
  });

  it('uses a safe fallback when override is blank', () => {
    const rel = makeRoot();
    const root = resolvePreflightLogRoot('   ', rel);
    expect(root.displayRoot).toBe(rel);
  });

  it('rejects existing linked log root segments before summary writes', () => {
    const rel = makeRoot();
    const target = resolve(ROOT, rel, 'target');
    const linked = resolve(ROOT, rel, 'linked-root');
    mkdirSync(target, { recursive: true });
    if (!tryDirectoryLink(target, linked)) return;

    expect(() => resolvePreflightLogRoot(`${rel}/linked-root`, 'logs/fallback')).toThrow(/preflight log root/);
    expect(existsSync(resolve(target, 'summary-linked.json'))).toBe(false);
  });

  it('creates summaries exclusively and refuses to overwrite retained summaries', () => {
    const rel = makeRoot();
    const root = resolvePreflightLogRoot(rel, 'logs/fallback');
    const first = writePreflightSummary(root, { runId: 'fixed-run', result: 'pass' });

    expect(() => writePreflightSummary(root, { runId: 'fixed-run', result: 'fail' })).toThrow();
    expect(readFileSync(resolve(ROOT, first), 'utf8')).toContain('"result": "pass"');
    expect(readFileSync(resolve(ROOT, first), 'utf8')).not.toContain('"result": "fail"');
  });

  it.each([
    ['windows absolute', 'C:\\secret-token\\logs'],
    ['posix absolute', '/tmp/secret-token/logs'],
    ['unc path', '//server/share/logs'],
    ['url root', tokenUrl],
    ['file url', fileUrl],
    ['postgres url', postgresUrl],
    ['parent root', '../logs'],
    ['nested traversal', 'logs/sub/../../outside'],
    ['backslash traversal', 'logs\\..\\outside'],
    ['non logs root', 'tmp/preflight'],
  ])('rejects %s without returning the supplied path', (_label, raw) => {
    expect(() => resolvePreflightLogRoot(raw, 'logs/fallback')).toThrow(/preflight log root/);
  });
});
