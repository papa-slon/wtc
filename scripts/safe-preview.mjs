#!/usr/bin/env node
/**
 * Starts the local web preview with deployment-unsafe features forced off.
 * This is a developer-only profile; it never enables live bot control,
 * TradingView automation, or non-mock bot adapters.
 */
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactProcessOutput } from './redacted-child-process.mjs';

export const forcedEnv = {
  APP_ENV: 'development',
  BOT_ADAPTER_MODE: 'mock',
  FEATURE_LIVE_BOT_CONTROL: 'false',
  FEATURE_TV_AUTOMATION: 'false',
};

const MAX_PENDING_CHARS = 64 * 1024;
const CARRYOVER_CHARS = 4096;
const PRIVATE_KEY_BEGIN = /-----BEGIN [A-Z ]*PRIVATE KEY-----/i;
const PRIVATE_KEY_END = /-----END [A-Z ]*PRIVATE KEY-----/i;

function privateKeyHoldIndex(text) {
  const begin = text.search(PRIVATE_KEY_BEGIN);
  if (begin < 0) return -1;
  const afterBegin = text.slice(begin);
  const end = PRIVATE_KEY_END.exec(afterBegin);
  if (!end) return begin;
  const endOffset = begin + end.index + end[0].length;
  return /[\r\n]/.test(text.slice(endOffset)) ? -1 : begin;
}

export function createRedactedStreamForwarder(write) {
  let pending = '';

  function forward(text) {
    if (text) write(redactProcessOutput(text));
  }

  function flushCompleteLines() {
    const holdAt = privateKeyHoldIndex(pending);
    if (holdAt >= 0) {
      forward(pending.slice(0, holdAt));
      pending = pending.slice(holdAt);
      return;
    }

    const lastLineBreak = Math.max(pending.lastIndexOf('\n'), pending.lastIndexOf('\r'));
    if (lastLineBreak >= 0) {
      forward(pending.slice(0, lastLineBreak + 1));
      pending = pending.slice(lastLineBreak + 1);
    }

    if (pending.length > MAX_PENDING_CHARS) {
      const keepFrom = Math.max(0, pending.length - CARRYOVER_CHARS);
      forward(pending.slice(0, keepFrom));
      pending = pending.slice(keepFrom);
    }
  }

  return {
    write(chunk) {
      pending += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk ?? '');
      flushCompleteLines();
    },
    flush() {
      forward(pending);
      pending = '';
    },
  };
}

function pipeRedacted(input, output) {
  const forwarder = createRedactedStreamForwarder((text) => output.write(text));
  input.on('data', (chunk) => forwarder.write(chunk));
  input.on('end', () => forwarder.flush());
  input.on('close', () => forwarder.flush());
  return forwarder;
}

export function startSafePreview({ root = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  const webCwd = join(root, 'apps', 'web');
  const nextCli = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  const args = [nextCli, 'dev', '--hostname', '0.0.0.0', '--port', '3000'];
  const child = spawn(process.execPath, args, {
    cwd: webCwd,
    env: { ...process.env, ...forcedEnv },
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const stdoutForwarder = pipeRedacted(child.stdout, stdout);
  const stderrForwarder = pipeRedacted(child.stderr, stderr);

  child.on('exit', (code, signal) => {
    stdoutForwarder.flush();
    stderrForwarder.flush();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  return child;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  startSafePreview();
}
