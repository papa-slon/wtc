/**
 * PG2: the worker maps a real adapter's BotHealth.readState to the integration_health_checks `status`
 * string. The honesty invariant: not_configured must NOT look like an outage (down/error). This is a
 * pure function, so it is unit-tested directly (the worker itself is strip-run, not gate-typechecked).
 */
import { describe, it, expect } from 'vitest';
import { healthCheckStatusFor } from '../../apps/worker/src/jobs.ts';
import {
  botContinuityStatus,
  finalWorkerHealthStatus,
  workerRequiresDatabase,
  workerSafetyState,
} from '../../apps/worker/src/index.ts';

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

describe('final worker bot-continuity status', () => {
  const okOutcomes = [
    { snapshot: 'ok' as const, readState: 'ok', healthStatus: 'ok' },
    { snapshot: 'ok' as const, readState: 'ok', healthStatus: 'ok' },
  ];

  it('is green only after core worker and both bot reads are ok', () => {
    expect(finalWorkerHealthStatus('ok', okOutcomes)).toBe('ok');
    expect(botContinuityStatus(okOutcomes)).toBe('ok');
  });

  it('marks skipped/not_configured bot reads as attention instead of green', () => {
    const outcomes = [
      { snapshot: 'ok' as const, readState: 'ok', healthStatus: 'ok' },
      { snapshot: 'skipped' as const, readState: 'not_configured', healthStatus: 'not_configured' },
    ];

    expect(finalWorkerHealthStatus('ok', outcomes)).toBe('not_configured');
    expect(botContinuityStatus(outcomes)).toBe('attention');
  });

  it('marks malformed or unreachable bot reads as worker errors', () => {
    expect(finalWorkerHealthStatus('ok', [
      { snapshot: 'error', readState: 'malformed', healthStatus: 'error' },
      { snapshot: 'ok', readState: 'ok', healthStatus: 'ok' },
    ])).toBe('error');
    expect(botContinuityStatus([
      { snapshot: 'ok', readState: 'ok', healthStatus: 'ok' },
      { snapshot: 'error', readState: 'unreachable', healthStatus: 'down' },
    ])).toBe('error');
  });

  it('preserves core worker error or misconfiguration severity', () => {
    expect(finalWorkerHealthStatus('error', okOutcomes)).toBe('error');
    expect(finalWorkerHealthStatus('misconfigured', okOutcomes)).toBe('misconfigured');
  });
});
