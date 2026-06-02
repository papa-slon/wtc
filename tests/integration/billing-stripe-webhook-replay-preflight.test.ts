import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

function cleanOutput(text: string): string {
  return text.replaceAll('\\', '/');
}

function makeLogRoot(): string {
  return join('logs', `test-stripe-webhook-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function removeLogRoot(logRoot: string) {
  rmSync(resolve(ROOT, logRoot), { recursive: true, force: true });
}

describe('Stripe webhook replay preflight harness', () => {
  it('is an opt-in command and stays out of default gates', () => {
    const rootPkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const gates = read('scripts/gates.mjs');

    expect(rootPkg.scripts['accept:billing:stripe-webhook']).toBe('node --import tsx scripts/billing-stripe-webhook-replay-preflight.mjs');
    expect(rootPkg.scripts.e2e).not.toContain('billing-stripe-webhook-replay-preflight');
    expect(rootPkg.scripts['ci:local']).not.toContain('accept:billing:stripe-webhook');
    expect(gates).not.toContain('accept:billing:stripe-webhook');
    expect(gates).not.toContain('billing-stripe-webhook-replay-preflight');
  });

  it('runs dry-run through the extracted webhook handler and keeps retained evidence redacted', () => {
    const logs = makeLogRoot();
    try {
      const stdout = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/billing-stripe-webhook-replay-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: {
          ...process.env,
          APP_ENV: 'development',
          STRIPE_WEBHOOK_REPLAY_PREFLIGHT_LOG_ROOT: logs,
        },
        encoding: 'utf8',
        windowsHide: true,
      });
      const output = cleanOutput(stdout);
      expect(output).toContain('dry-run complete');
      expect(output).toContain('network=not-run');
      for (const forbidden of [
        'whsec_',
        'stripe-signature',
        't=1900000000,v1=',
        '"object":"event"',
        '"object": "event"',
        'cs_test_',
        'sk_test_',
      ]) {
        expect(output).not.toContain(forbidden);
      }

      const summaries = readdirSync(logs).filter((name) => name.startsWith('summary-') && name.endsWith('.json'));
      expect(summaries).toHaveLength(1);
      const summary = readFileSync(join(logs, summaries[0]!), 'utf8');
      expect(summary).toContain('"provider": "stripe"');
      expect(summary).toContain('"network": "not-run"');
      expect(summary).toContain('"result": "pass"');
      expect(summary).toContain('"valid_checkout"');
      expect(summary).toContain('"duplicate_terminal_noop"');
      expect(summary).toContain('"bad_signature_rejected"');
      expect(summary).toContain('"missing_user_manual_review"');
      for (const forbidden of [
        'whsec_',
        'stripe-signature',
        't=1900000000,v1=',
        '"object": "event"',
        '"object":"event"',
        'sk_test_',
        'cs_test_',
      ]) {
        expect(summary).not.toContain(forbidden);
      }

      const scan = execFileSync(process.execPath, ['scripts/scan-lms-db-e2e-artifacts.mjs', logs], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(scan).toContain('artifact scan passed');
    } finally {
      removeLogRoot(logs);
    }
  });

  it('refuses to run under APP_ENV=production', () => {
    const logs = makeLogRoot();
    try {
      expect(() => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/billing-stripe-webhook-replay-preflight.mjs', '--dry-run'], {
        cwd: ROOT,
        env: {
          ...process.env,
          APP_ENV: 'production',
          STRIPE_WEBHOOK_REPLAY_PREFLIGHT_LOG_ROOT: logs,
        },
        encoding: 'utf8',
        windowsHide: true,
      })).toThrow(/preflight refused/);
    } finally {
      removeLogRoot(logs);
    }
  });
});
