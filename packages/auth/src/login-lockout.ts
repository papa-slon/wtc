export interface LoginLockoutPolicy {
  shortWindowMs: number;
  shortWindowMaxFailures: number;
  shortLockoutMs: number;
  longWindowMs: number;
  longWindowMaxFailures: number;
  longLockoutMs: number;
  reviewFailureThreshold: number;
}

export const LOGIN_LOCKOUT_POLICY: LoginLockoutPolicy = {
  shortWindowMs: 15 * 60_000,
  shortWindowMaxFailures: 5,
  shortLockoutMs: 15 * 60_000,
  longWindowMs: 60 * 60_000,
  longWindowMaxFailures: 10,
  longLockoutMs: 60 * 60_000,
  reviewFailureThreshold: 20,
};

export interface LoginLockoutState {
  failedLogin15mCount: number;
  failedLogin15mResetAt: number | null;
  failedLogin60mCount: number;
  failedLogin60mResetAt: number | null;
  failedLoginTotalCount: number;
  lastFailedLoginAt: number | null;
  accountLockedUntil: number | null;
  accountLockoutReviewRequiredAt: number | null;
}

export interface LoginFailureTransition {
  state: LoginLockoutState;
  lockoutApplied: boolean;
  lockoutReason: '15m' | '60m' | null;
  reviewRequired: boolean;
}

export const EMPTY_LOGIN_LOCKOUT_STATE: LoginLockoutState = {
  failedLogin15mCount: 0,
  failedLogin15mResetAt: null,
  failedLogin60mCount: 0,
  failedLogin60mResetAt: null,
  failedLoginTotalCount: 0,
  lastFailedLoginAt: null,
  accountLockedUntil: null,
  accountLockoutReviewRequiredAt: null,
};

function liveWindow(count: number, resetAt: number | null, now: number, windowMs: number): { count: number; resetAt: number } {
  if (resetAt !== null && resetAt > now) return { count, resetAt };
  return { count: 0, resetAt: now + windowMs };
}

function maxNullable(a: number | null, b: number): number {
  return a === null ? b : Math.max(a, b);
}

export function isLoginLocked(state: LoginLockoutState, now: number): boolean {
  return state.accountLockedUntil !== null && state.accountLockedUntil > now;
}

export function nextLoginFailureState(
  state: LoginLockoutState,
  now: number,
  policy: LoginLockoutPolicy = LOGIN_LOCKOUT_POLICY,
): LoginFailureTransition {
  const short = liveWindow(state.failedLogin15mCount, state.failedLogin15mResetAt, now, policy.shortWindowMs);
  const long = liveWindow(state.failedLogin60mCount, state.failedLogin60mResetAt, now, policy.longWindowMs);
  const nextShortCount = short.count + 1;
  const nextLongCount = long.count + 1;
  const nextTotalCount = state.failedLoginTotalCount + 1;

  let lockedUntil = state.accountLockedUntil !== null && state.accountLockedUntil > now ? state.accountLockedUntil : null;
  let lockoutReason: LoginFailureTransition['lockoutReason'] = null;

  if (nextShortCount >= policy.shortWindowMaxFailures) {
    lockedUntil = maxNullable(lockedUntil, now + policy.shortLockoutMs);
    lockoutReason = '15m';
  }

  if (nextLongCount >= policy.longWindowMaxFailures) {
    const longLockUntil = now + policy.longLockoutMs;
    if (lockedUntil === null || longLockUntil >= lockedUntil) lockoutReason = '60m';
    lockedUntil = maxNullable(lockedUntil, longLockUntil);
  }

  const reviewRequired = nextTotalCount >= policy.reviewFailureThreshold;
  const reviewRequiredAt = reviewRequired
    ? (state.accountLockoutReviewRequiredAt ?? now)
    : state.accountLockoutReviewRequiredAt;

  return {
    lockoutApplied: lockedUntil !== null && lockedUntil > now,
    lockoutReason,
    reviewRequired,
    state: {
      failedLogin15mCount: nextShortCount,
      failedLogin15mResetAt: short.resetAt,
      failedLogin60mCount: nextLongCount,
      failedLogin60mResetAt: long.resetAt,
      failedLoginTotalCount: nextTotalCount,
      lastFailedLoginAt: now,
      accountLockedUntil: lockedUntil,
      accountLockoutReviewRequiredAt: reviewRequiredAt,
    },
  };
}

export function nextLoginSuccessState(): LoginLockoutState {
  return { ...EMPTY_LOGIN_LOCKOUT_STATE };
}

export function nextAdminUnlockState(): LoginLockoutState {
  return { ...EMPTY_LOGIN_LOCKOUT_STATE };
}
