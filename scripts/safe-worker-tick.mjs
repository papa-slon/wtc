#!/usr/bin/env node
/**
 * Runs one local worker tick with deployment-unsafe features forced off.
 * With DATABASE_URL set it exercises the real DB tick; otherwise it runs the memory demo tick.
 */
import { join } from 'node:path';
import { runRedactedChildProcess } from './redacted-child-process.mjs';

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

if (!process.env.DATABASE_URL && !process.argv.includes('--require-db')) {
  args.push('--memory-demo');
}

const child = runRedactedChildProcess(process.execPath, args, {
  cwd: root,
  env: { ...process.env, ...forcedEnv },
  windowsHide: true,
});

if (child.signal) {
  process.kill(process.pid, child.signal);
} else {
  process.exit(child.status ?? 1);
}
