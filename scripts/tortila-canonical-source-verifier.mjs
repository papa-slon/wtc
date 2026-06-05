#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { redactProcessOutput } from './redacted-child-process.mjs';

const REQUIRED_FILES = [
  'pyproject.toml',
  join('src', 'turtle_bot', 'journal', 'app.py'),
  join('tests', 'test_journal.py'),
];

const SAFE_ENDPOINTS = ['/api/health', '/api/summary', '/api/equity', '/api/trades/list'];

function safeMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return redactProcessOutput(message);
}

function usage() {
  console.log([
    'Usage: TORTILA_CANONICAL_SOURCE_ROOT=<absolute git checkout> npm run verify:tortila:canonical-source',
    '',
    'Verifies that a Tortila/Turtle source checkout is a canonical git-backed source packet for WTC read-only proof.',
    'The verifier is local/read-only: it does not read env secrets, call HTTP endpoints, query DBs, or mutate files.',
    '',
    'Required source shape:',
    '- clean git checkout with HEAD, current branch, and at least one remote name',
    '- pyproject.toml',
    '- src/turtle_bot/journal/app.py',
    '- tests/test_journal.py',
    '- JOURNAL_READ_TOKEN middleware for /api/* using bearer or x-journal-read-token',
    '- tests proving missing/wrong token 401, bearer/header success, and /api/marks rejection when token is configured',
  ].join('\n'));
}

function runGit(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${safeMessage(result.stderr || result.stdout || 'unknown git error')}`);
  }
  return result.stdout.trim();
}

function requireText(text, pattern, label) {
  const ok = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
  if (!ok) throw new Error(`missing ${label}`);
}

function readRequiredFile(root, relativePath) {
  const file = join(root, relativePath);
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(`missing required file ${relativePath}`);
  }
  return readFileSync(file, 'utf8');
}

export function verifyTortilaCanonicalSourceRoot(sourceRoot) {
  if (!sourceRoot || typeof sourceRoot !== 'string') {
    throw new Error('TORTILA_CANONICAL_SOURCE_ROOT is required.');
  }

  const root = realpathSync(resolve(sourceRoot));
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error('TORTILA_CANONICAL_SOURCE_ROOT must point at an existing directory.');
  }

  const topLevel = realpathSync(runGit(root, ['rev-parse', '--show-toplevel']));
  if (topLevel !== root) {
    throw new Error('TORTILA_CANONICAL_SOURCE_ROOT must be the git repository root.');
  }

  const head = runGit(root, ['rev-parse', 'HEAD']);
  const branch = runGit(root, ['branch', '--show-current']);
  if (!/^[0-9a-f]{40}$/i.test(head)) {
    throw new Error('canonical source git HEAD is not a full commit hash.');
  }
  if (!branch) {
    throw new Error('canonical source must be on a named branch, not detached HEAD.');
  }

  const remotes = runGit(root, ['remote'])
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (remotes.length === 0) {
    throw new Error('canonical source must have at least one git remote name.');
  }

  const status = runGit(root, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status) {
    throw new Error('canonical source checkout must be clean before WTC accepts it.');
  }

  for (const relativePath of REQUIRED_FILES) {
    readRequiredFile(root, relativePath);
  }

  const app = readRequiredFile(root, join('src', 'turtle_bot', 'journal', 'app.py'));
  const tests = readRequiredFile(root, join('tests', 'test_journal.py'));

  requireText(app, 'JOURNAL_READ_TOKEN', 'journal token env lookup in app.py');
  requireText(app.toLowerCase(), 'authorization', 'authorization header read in app.py');
  requireText(app.toLowerCase(), 'bearer ', 'bearer token parsing in app.py');
  requireText(app, 'x-journal-read-token', 'fallback token header in app.py');
  requireText(app, 'compare_digest', 'constant-time token compare in app.py');
  requireText(app, /request\.url\.path\.startswith\(["']\/api\/["']\)/, '/api/* middleware boundary in app.py');
  requireText(app, 'status_code=401', '401 JSON response in app.py');
  for (const endpoint of SAFE_ENDPOINTS) {
    requireText(app, endpoint, `${endpoint} route in app.py`);
  }

  requireText(tests, 'JOURNAL_READ_TOKEN', 'journal token test fixture');
  requireText(tests.toLowerCase(), 'wrong-token', 'wrong-token auth test');
  requireText(tests.toLowerCase(), 'bearer ', 'bearer auth test');
  requireText(tests, 'x-journal-read-token', 'token header auth test');
  requireText(tests, '401', '401 auth assertions');
  requireText(tests, '/api/marks', '/api/marks auth rejection assertion');
  requireText(tests, '/api/health', '/api/health auth assertion');
  requireText(tests, '/api/summary', '/api/summary auth assertion');

  return {
    ok: true,
    root,
    branch,
    head,
    remotes,
    requiredFiles: REQUIRED_FILES,
    safeEndpoints: SAFE_ENDPOINTS,
  };
}

function printSummary(summary, json) {
  const safe = {
    ok: summary.ok,
    root: summary.root,
    branch: summary.branch,
    head: summary.head,
    remotes: summary.remotes,
    requiredFiles: summary.requiredFiles,
    safeEndpoints: summary.safeEndpoints,
  };
  if (json) {
    console.log(JSON.stringify(safe, null, 2));
    return;
  }
  console.log(`Tortila canonical source verifier PASS: branch=${safe.branch} head=${safe.head}`);
  console.log(`Required files: ${safe.requiredFiles.join(', ')}`);
  console.log(`Safe WTC endpoints: ${safe.safeEndpoints.join(', ')}`);
  console.log(`Git remotes present: ${safe.remotes.join(', ')}`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = process.argv.slice(2);
  const allowedArgs = new Set(['--help', '-h', '--json']);
  const unknownArg = args.find((arg) => !allowedArgs.has(arg));
  const json = args.includes('--json');

  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }
  if (unknownArg) {
    console.error('Tortila canonical source verifier refused: unknown argument.');
    process.exit(2);
  }

  try {
    const summary = verifyTortilaCanonicalSourceRoot(process.env.TORTILA_CANONICAL_SOURCE_ROOT);
    printSummary(summary, json);
  } catch (error) {
    console.error(`Tortila canonical source verifier refused: ${safeMessage(error)}`);
    process.exit(2);
  }
}
