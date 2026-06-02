/**
 * PG2: the worker maps a real adapter's BotHealth.readState to the integration_health_checks `status`
 * string. The honesty invariant: not_configured must NOT look like an outage (down/error). This is a
 * pure function, so it is unit-tested directly (the worker itself is strip-run, not gate-typechecked).
 */
import { describe, it, expect } from 'vitest';
import { healthCheckStatusFor } from '../../apps/worker/src/jobs.ts';
import { workerRequiresDatabase, workerSafetyState } from '../../apps/worker/src/index.ts';

describe('worker readState → integration_health_checks status mapping', () => {
  it('not_configured → not_configured (setup-needed is NOT an outage)', () => {
    expect(healthCheckStatusFor('not_configured', false)).toBe('not_configured');
  });
  it('unreachable → down', () => {
    expect(healthCheckStatusFor('unreachable', false)).toBe('down');
  });
  it('malformed → error', () => {
    expect(healthCheckStatusFor('malformed', false)).toBe('error');
  });
  it('stale → ok (data present, just old)', () => {
    expect(healthCheckStatusFor('stale', true)).toBe('ok');
  });
  it('ok → ok', () => {
    expect(healthCheckStatusFor('ok', true)).toBe('ok');
  });
  it('undefined readState falls back to processAlive (back-compat with mock/older adapters)', () => {
    expect(healthCheckStatusFor(undefined, true)).toBe('ok');
    expect(healthCheckStatusFor(undefined, false)).toBe('down');
  });
});

describe('worker deploy DB guard', () => {
  it('allows memory demo only outside staging/production', () => {
    expect(workerRequiresDatabase({ APP_ENV: 'development' })).toBe(false);
    expect(workerRequiresDatabase({ NODE_ENV: 'test' })).toBe(false);
  });

  it('requires DATABASE_URL in production-like worker environments', () => {
    expect(workerRequiresDatabase({ APP_ENV: 'staging' })).toBe(true);
    expect(workerRequiresDatabase({ APP_ENV: 'production' })).toBe(true);
    expect(workerRequiresDatabase({ NODE_ENV: 'production' })).toBe(true);
  });
});

describe('worker safety heartbeat state', () => {
  it('defaults to safe disabled flags', () => {
    expect(workerSafetyState({})).toEqual({
      liveControlDisabled: true,
      tvAutomationDisabled: true,
      status: 'ok',
    });
  });

  it('marks a heartbeat misconfigured if unsafe flags are enabled', () => {
    expect(workerSafetyState({ FEATURE_LIVE_BOT_CONTROL: 'true' })).toMatchObject({
      liveControlDisabled: false,
      tvAutomationDisabled: true,
      status: 'misconfigured',
    });
    expect(workerSafetyState({ FEATURE_TV_AUTOMATION: '1' })).toMatchObject({
      liveControlDisabled: true,
      tvAutomationDisabled: false,
      status: 'misconfigured',
    });
  });
});
