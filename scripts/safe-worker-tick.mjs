#!/usr/bin/env node
/**
 * Runs one local worker tick with deployment-unsafe features forced off.
 * With DATABASE_URL set it exercises the real DB tick; otherwise it runs the memory demo tick.
 */
import { join } from 'node:path';
import { runRedactedChildProcess } from './redacted-child-process.mjs';

const acceptanceProfiles = {
  full: {
    workerStatus: 'ok',
    botContinuity: 'ok',
    tortila: 'ok',
    legacy: 'ok',
  },
  'setup-needed': {
    workerStatus: 'not_configured',
    botContinuity: 'attention',
    tortila: 'ok',
    legacy: 'skipped',
  },
};

function usage() {
  console.log(
    [
      'Usage: node scripts/safe-worker-tick.mjs [--require-db] [--expect-continuity=full|setup-needed]',
      '',
      'Runs one safe local worker tick with live controls disabled and output redacted.',
      'Without DATABASE_URL it runs the memory demo unless --require-db is present.',
      'With --require-db, continuity output is checked against the selected profile.',
      'The full profile requires worker_status=ok, bot_continuity=ok, tortila=ok, legacy=ok.',
      'The setup-needed profile proves the DB/worker path and Tortila mock snapshot while Legacy read-only is not configured.',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    requireDb: false,
    expectContinuity: null,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--require-db') {
      parsed.requireDb = true;
      continue;
    }
    if (arg.startsWith('--expect-continuity=')) {
      parsed.expectContinuity = arg.slice('--expect-continuity='.length);
      continue;
    }
    throw new Error('Safe worker tick refused: unknown argument.');
  }

  if (parsed.expectContinuity && !acceptanceProfiles[parsed.expectContinuity]) {
    throw new Error('Safe worker tick refused: unsupported continuity expectation profile.');
  }

  return parsed;
}

function parseContinuityTuple(output) {
  const line = output
    .split(/\r?\n/)
    .find((entry) => entry.includes('[worker:tick] DB tick OK;'));
  if (!line) return null;

  const match = line.match(
    /worker_status=([^;\s]+);\s+bot_continuity=([^;\s]+);[\s\S]*?tortila=([^;\s()]+)[\s\S]*?;\s+legacy=([^;\s()]+)/,
  );
  if (!match) return null;

  return {
    workerStatus: match[1],
    botContinuity: match[2],
    tortila: match[3],
    legacy: match[4],
  };
}

function sameTuple(actual, expected) {
  return actual.workerStatus === expected.workerStatus
    && actual.botContinuity === expected.botContinuity
    && actual.tortila === expected.tortila
    && actual.legacy === expected.legacy;
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

if (options.help) {
  usage();
  process.exit(0);
}

const forcedEnv = {
  APP_ENV: 'development',
  BOT_ADAPTER_MODE: 'mock',
  FEATURE_LIVE_BOT_CONTROL: 'false',
  FEATURE_TV_AUTOMATION: 'false',
};

const root = process.cwd();
const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const tickScript = join(root, 'apps', 'worker', 'src', 'tick-once.ts');
const args = [tsxCli, tickScript];

if (!process.env.DATABASE_URL && !options.requireDb) {
  args.push('--memory-demo');
}

const child = runRedactedChildProcess(process.execPath, args, {
  cwd: root,
  env: { ...process.env, ...forcedEnv },
  forwardStdout: false,
  forwardStderr: false,
  windowsHide: true,
});

if (child.stdout) process.stdout.write(child.stdout);
if (child.stderr) process.stderr.write(child.stderr);

if (child.signal) {
  process.kill(process.pid, child.signal);
} else {
  if (child.status !== 0) process.exit(child.status ?? 1);

  const expectedProfile = options.expectContinuity ?? (options.requireDb ? 'full' : null);
  if (expectedProfile) {
    const actual = parseContinuityTuple(child.stdout);
    const expected = acceptanceProfiles[expectedProfile];
    if (!actual) {
      console.error('[worker:acceptance] failed: DB tick continuity tuple was not found in redacted output.');
      process.exit(1);
    }
    if (!sameTuple(actual, expected)) {
      console.error(
        `[worker:acceptance] failed: expected profile=${expectedProfile} worker_status=${expected.workerStatus} bot_continuity=${expected.botContinuity} tortila=${expected.tortila} legacy=${expected.legacy}; observed worker_status=${actual.workerStatus} bot_continuity=${actual.botContinuity} tortila=${actual.tortila} legacy=${actual.legacy}`,
      );
      process.exit(1);
    }
    console.log(
      `[worker:acceptance] tuple OK; profile=${expectedProfile}; worker_status=${actual.workerStatus}; bot_continuity=${actual.botContinuity}; tortila=${actual.tortila}; legacy=${actual.legacy}`,
    );
  }

  process.exit(0);
}
