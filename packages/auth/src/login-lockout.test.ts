import { describe, expect, it } from 'vitest';
import {
  EMPTY_LOGIN_LOCKOUT_STATE,
  isLoginLocked,
  nextAdminUnlockState,
  nextLoginFailureState,
  nextLoginSuccessState,
} from './login-lockout.ts';

const minute = 60_000;

describe('login lockout policy', () => {
  it('locks for 15 minutes on the fifth failure inside 15 minutes', () => {
    let state = { ...EMPTY_LOGIN_LOCKOUT_STATE };
    for (let i = 0; i < 4; i += 1) {
      const next = nextLoginFailureState(state, 1_000 + i);
      state = next.state;
      expect(next.lockoutApplied).toBe(false);
    }

    const fifth = nextLoginFailureState(state, 1_010);
    expect(fifth.lockoutApplied).toBe(true);
    expect(fifth.lockoutReason).toBe('15m');
    expect(fifth.state.accountLockedUntil).toBe(1_010 + 15 * minute);
    expect(isLoginLocked(fifth.state, 1_010)).toBe(true);
  });

  it('resets the short window after it expires', () => {
    let state = { ...EMPTY_LOGIN_LOCKOUT_STATE };
    for (let i = 0; i < 4; i += 1) state = nextLoginFailureState(state, 1_000 + i).state;

    const afterWindow = nextLoginFailureState(state, 1_000 + 15 * minute + 1);
    expect(afterWindow.lockoutApplied).toBe(false);
    expect(afterWindow.state.failedLogin15mCount).toBe(1);
    expect(afterWindow.state.failedLogin60mCount).toBe(5);
  });

  it('uses the longer 60-minute lockout when the long threshold is crossed', () => {
    let state = { ...EMPTY_LOGIN_LOCKOUT_STATE };
    for (let i = 0; i < 9; i += 1) {
      state = nextLoginFailureState(state, 1_000 + i * 6 * minute).state;
    }

    const tenth = nextLoginFailureState(state, 1_000 + 9 * 6 * minute);
    expect(tenth.lockoutApplied).toBe(true);
    expect(tenth.lockoutReason).toBe('60m');
    expect(tenth.state.accountLockedUntil).toBe(1_000 + 9 * 6 * minute + 60 * minute);
  });

  it('sets the review marker at the total failure threshold', () => {
    let state = { ...EMPTY_LOGIN_LOCKOUT_STATE };
    for (let i = 0; i < 19; i += 1) {
      state = nextLoginFailureState(state, 1_000 + i * 16 * minute).state;
    }

    const twentieth = nextLoginFailureState(state, 1_000 + 19 * 16 * minute);
    expect(twentieth.reviewRequired).toBe(true);
    expect(twentieth.state.accountLockoutReviewRequiredAt).toBe(1_000 + 19 * 16 * minute);
  });

  it('clears all lockout state on successful login', () => {
    const locked = nextLoginFailureState(
      {
        ...EMPTY_LOGIN_LOCKOUT_STATE,
        failedLogin15mCount: 4,
        failedLogin15mResetAt: 20 * minute,
      },
      1_000,
    ).state;
    expect(locked.accountLockedUntil).not.toBeNull();
    expect(nextLoginSuccessState()).toEqual(EMPTY_LOGIN_LOCKOUT_STATE);
  });

  it('clears all lockout state on admin unlock', () => {
    expect(nextAdminUnlockState()).toEqual(EMPTY_LOGIN_LOCKOUT_STATE);
  });
});
