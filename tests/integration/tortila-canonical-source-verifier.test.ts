import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const verifierPath = 'scripts/tortila-canonical-source-verifier.mjs';

const tempRoots: string[] = [];

function runGit(root: string, args: string[]) {
  const result = spawnSync('git', ['-C', root, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
}

function makeTempRoot(name: string): string {
  const root = mkdtempSync(join(tmpdir(), `${name}-`));
  tempRoots.push(root);
  return root;
}

function writeCanonicalFiles(root: string) {
  mkdirSync(join(root, 'src', 'turtle_bot', 'journal'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(join(root, 'pyproject.toml'), '[project]\nname = "turtle-bot"\n', 'utf8');
  writeFileSync(
    join(root, 'src', 'turtle_bot', 'journal', 'app.py'),
    [
      'import hmac',
      'import os',
      'from fastapi import Request',
      'from fastapi.responses import JSONResponse',
      '',
      'def _configured_read_token() -> str:',
      '    return os.environ.get("JOURNAL_READ_TOKEN", "").strip()',
      '',
      'def _request_read_token(request: Request) -> str:',
      '    auth = request.headers.get("authorization", "")',
      '    if auth.lower().startswith("bearer "):',
      '        return auth[7:].strip()',
      '    return request.headers.get("x-journal-read-token", "").strip()',
      '',
      'def _has_valid_journal_read_token(request: Request) -> bool:',
      '    expected = _configured_read_token()',
      '    supplied = _request_read_token(request)',
      '    return bool(supplied and hmac.compare_digest(supplied, expected))',
      '',
      'async def require_api_read_token(request: Request, call_next):',
      '    if request.url.path.startswith("/api/") and not _has_valid_journal_read_token(request):',
      '        return JSONResponse({"detail": "journal read token required"}, status_code=401)',
      '    return await call_next(request)',
      '',
      '@app.get("/api/health")',
      'async def health(): pass',
      '@app.get("/api/summary")',
      'async def summary(): pass',
      '@app.get("/api/equity")',
      'async def equity(): pass',
      '@app.get("/api/trades/list")',
      'async def trades_list(): pass',
      '@app.get("/api/marks")',
      'async def marks(): pass',
      '@app.get("/api/overview")',
      'async def overview(): pass',
      '',
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    join(root, 'tests', 'test_journal.py'),
    [
      'def test_api_requires_read_token_when_configured(client, monkeypatch):',
      '    monkeypatch.setenv("JOURNAL_READ_TOKEN", "journal-test-token")',
      '    r = client.get("/api/health")',
      '    assert r.status_code == 401',
      '    wrong = client.get("/api/health", headers={"authorization": "Bearer wrong-token"})',
      '    assert wrong.status_code == 401',
      '    bearer = client.get("/api/health", headers={"authorization": "Bearer journal-test-token"})',
      '    assert bearer.status_code == 200',
      '    header = client.get("/api/summary", headers={"x-journal-read-token": "journal-test-token"})',
      '    assert header.status_code == 200',
      '    marks = client.get("/api/marks")',
      '    assert marks.status_code == 401',
      '',
    ].join('\n'),
    'utf8',
  );
}

function makeGitBackedCanonicalFixture(): string {
  const root = makeTempRoot('wtc-tortila-canonical');
  writeCanonicalFiles(root);
  runGit(root, ['init']);
  runGit(root, ['checkout', '-b', 'main']);
  runGit(root, ['config', 'user.email', 'wtc-tests@example.invalid']);
  runGit(root, ['config', 'user.name', 'WTC Tests']);
  runGit(root, ['remote', 'add', 'origin', 'https://example.invalid/tortila.git']);
  runGit(root, ['add', '.']);
  runGit(root, ['commit', '-m', 'canonical tortila source']);
  return root;
}

function runVerifier(root?: string, args: string[] = ['--json']) {
  return spawnSync(process.execPath, [verifierPath, ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(root ? { TORTILA_CANONICAL_SOURCE_ROOT: root } : {}),
    },
    encoding: 'utf8',
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('Tortila canonical source verifier', () => {
  it('refuses missing or non-git source roots before any runtime proof', () => {
    const missing = runVerifier();
    expect(missing.status).toBe(2);
    expect(`${missing.stdout}\n${missing.stderr}`).toContain('TORTILA_CANONICAL_SOURCE_ROOT');

    const nonGit = makeTempRoot('wtc-tortila-non-git');
    writeCanonicalFiles(nonGit);
    const result = runVerifier(nonGit);
    expect(result.status).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toContain('git rev-parse --show-toplevel failed');
  });

  it('accepts only a clean git-backed source with token middleware and auth tests', () => {
    const root = makeGitBackedCanonicalFixture();
    const result = runVerifier(root);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      branch: string;
      head: string;
      remotes: string[];
      safeEndpoints: string[];
    };
    expect(parsed.ok).toBe(true);
    expect(parsed.branch).toBe('main');
    expect(parsed.head).toMatch(/^[0-9a-f]{40}$/);
    expect(parsed.remotes).toEqual(['origin']);
    expect(parsed.safeEndpoints).toEqual(['/api/health', '/api/summary', '/api/equity', '/api/trades/list']);
    expect(result.stdout).not.toContain('example.invalid');

    writeFileSync(join(root, 'UNTRACKED.txt'), 'dirty\n', 'utf8');
    const dirty = runVerifier(root);
    expect(dirty.status).toBe(2);
    expect(`${dirty.stdout}\n${dirty.stderr}`).toContain('checkout must be clean');
  });
});
