import { describe, expect, it } from 'vitest';
import {
  BACKTESTER_RUNNER_DISTRIBUTED,
  BACKTESTER_RUNNER_RELEASE,
  backtesterPill,
  botHasBacktester,
  deriveBacktesterView,
  getRunnerRelease,
  type BacktesterView,
} from './derive';

const RESULT_KEYS = ['equityCurve', 'metrics', 'trades', 'pnl', 'results', 'returns', 'curve'];

function assertNoFabricatedResults(view: BacktesterView): void {
  for (const k of RESULT_KEYS) expect(k in view).toBe(false);
  for (const [key, value] of Object.entries(view)) {
    if (key !== 'runner') expect(typeof value).not.toBe('number');
  }
}

describe('@wtc/backtester availability', () => {
  it('runner distribution is ON only for the static offline Tortila ZIP', () => {
    expect(BACKTESTER_RUNNER_DISTRIBUTED).toBe(true);
    expect(BACKTESTER_RUNNER_RELEASE.fileName).toBe('wtc-backtester-0.1.0.zip');
    expect(BACKTESTER_RUNNER_RELEASE.routeHref).toBe('/api/bots/tortila/backtest/runner-download');
  });

  it('botHasBacktester: tortila yes, legacy no', () => {
    expect(botHasBacktester('tortila')).toBe(true);
    expect(botHasBacktester('legacy')).toBe(false);
  });

  it('getRunnerRelease is fail-closed for legacy', () => {
    expect(getRunnerRelease('tortila')).toEqual(BACKTESTER_RUNNER_RELEASE);
    expect(getRunnerRelease('legacy')).toBeNull();
  });

  it('backtesterPill is honest per surface', () => {
    expect(backtesterPill('tortila')).toEqual({ tone: 'ok', label: 'Available' });
    expect(backtesterPill('legacy')).toEqual({ tone: 'bad', label: 'Not available' });
  });
});

describe('@wtc/backtester deriveBacktesterView', () => {
  it('legacy -> permanent product-boundary card', () => {
    const v = deriveBacktesterView('legacy');
    expect(v.kind).toBe('legacy_boundary');
    expect(v.body).toMatch(/does not have a backtester/i);
    expect(v.accessReason).toBeUndefined();
    expect(v.runner).toBeUndefined();
    assertNoFabricatedResults(v);
  });

  it('tortila + not entitled -> access_required carrying the denial reason', () => {
    const v = deriveBacktesterView('tortila', { allowed: false, reason: 'blocked_no_entitlement' });
    expect(v.kind).toBe('access_required');
    expect(v.accessReason).toBe('blocked_no_entitlement');
    expect(v.runner).toBeUndefined();
    assertNoFabricatedResults(v);
  });

  it('FAIL CLOSED: tortila with no access decision denies', () => {
    const v = deriveBacktesterView('tortila');
    expect(v.kind).toBe('access_required');
    expect(v.accessReason).toBe('blocked_unknown_state');
  });

  it('tortila + allowed -> runner_available with release metadata and no result payload', () => {
    const v = deriveBacktesterView('tortila', { allowed: true, reason: 'allowed' });
    expect(v.kind).toBe('runner_available');
    expect(v.title).toMatch(/download local backtester/i);
    expect(v.body).toMatch(/never in the web tier/i);
    expect(v.body).toMatch(/never generates or estimates returns/i);
    expect(v.runner).toEqual(BACKTESTER_RUNNER_RELEASE);
    assertNoFabricatedResults(v);
  });
});
