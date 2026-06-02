import { describe, it, expect } from 'vitest';
import { checkRateLimit, getClientIp, type HeaderLookup } from './rate-limit.ts';

const OPTS = { windowMs: 60_000, max: 10 } as const;
const stub = (h: Record<string, string>): HeaderLookup => ({ get: (n) => h[n.toLowerCase()] ?? null });

describe('checkRateLimit (sliding-window log)', () => {
  it('allows the first call and decrements remaining from max-1', () => {
    const store = new Map<string, number[]>();
    const r = checkRateLimit(store, 'k', OPTS, 1_000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(9);
    expect(r.retryAfterMs).toBe(0);
  });

  it('allows up to max calls within the window, remaining counting down to 0', () => {
    const store = new Map<string, number[]>();
    let last = checkRateLimit(store, 'k', OPTS, 1_000);
    for (let i = 1; i < OPTS.max; i++) last = checkRateLimit(store, 'k', OPTS, 1_000 + i);
    expect(last.allowed).toBe(true);
    expect(last.remaining).toBe(0); // 10th call: max - 10 = 0
  });

  it('blocks call max+1 within the window', () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < OPTS.max; i++) checkRateLimit(store, 'k', OPTS, 1_000 + i);
    const blocked = checkRateLimit(store, 'k', OPTS, 1_000 + OPTS.max);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('blocked result has retryAfterMs > 0 and <= windowMs', () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < OPTS.max; i++) checkRateLimit(store, 'k', OPTS, 1_000 + i);
    const blocked = checkRateLimit(store, 'k', OPTS, 1_500);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(OPTS.windowMs);
  });

  it('retryAfterMs equals oldest + windowMs - now', () => {
    const store = new Map<string, number[]>();
    // oldest entry recorded at t=1000; fill to max
    checkRateLimit(store, 'k', OPTS, 1_000);
    for (let i = 1; i < OPTS.max; i++) checkRateLimit(store, 'k', OPTS, 1_000 + i);
    const now = 5_000;
    const blocked = checkRateLimit(store, 'k', OPTS, now);
    expect(blocked.retryAfterMs).toBe(1_000 + OPTS.windowMs - now);
  });

  it('isolates keys: saturating key A does not block key B', () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < OPTS.max; i++) checkRateLimit(store, 'A', OPTS, 1_000 + i);
    expect(checkRateLimit(store, 'A', OPTS, 1_020).allowed).toBe(false);
    expect(checkRateLimit(store, 'B', OPTS, 1_020).allowed).toBe(true);
  });

  it('resets after the full window elapses (all old entries expire)', () => {
    const store = new Map<string, number[]>();
    // fill all max entries at the SAME instant so they all leave the window together
    for (let i = 0; i < OPTS.max; i++) checkRateLimit(store, 'k', OPTS, 1_000);
    expect(checkRateLimit(store, 'k', OPTS, 1_000).allowed).toBe(false);
    // jump just past the window → every entry pruned → full budget restored
    const after = checkRateLimit(store, 'k', OPTS, 1_000 + OPTS.windowMs + 1);
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(9);
  });

  it('partial expiry: only out-of-window entries are pruned, remaining reflects live entries', () => {
    const store = new Map<string, number[]>();
    // batch 1: 3 entries at t=1000 (will expire); batch 2: 3 entries at t=40000 (will survive)
    for (let i = 0; i < 3; i++) checkRateLimit(store, 'k', OPTS, 1_000);
    for (let i = 0; i < 3; i++) checkRateLimit(store, 'k', OPTS, 40_000);
    const now = 1_000 + OPTS.windowMs + 1; // cutoff = 1001 → batch 1 (t=1000) pruned, batch 2 (t=40000) survives
    const r = checkRateLimit(store, 'k', OPTS, now);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(6); // 3 live (batch 2) + this call = 4 used, max 10 → 6 remaining
  });

  it('mutates the caller-owned store in place', () => {
    const store = new Map<string, number[]>();
    checkRateLimit(store, 'k', OPTS, 1_000);
    expect(store.get('k')).toEqual([1_000]);
  });
});

describe('getClientIp', () => {
  it('uses the first hop of x-forwarded-for', () => {
    expect(getClientIp(stub({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1, 10.0.0.2' }))).toBe('203.0.113.7');
  });

  it('handles a single-value x-forwarded-for', () => {
    expect(getClientIp(stub({ 'x-forwarded-for': '198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(getClientIp(stub({ 'x-real-ip': '192.0.2.5' }))).toBe('192.0.2.5');
  });

  it('returns null when no proxy headers are present (direct localhost)', () => {
    expect(getClientIp(stub({}))).toBeNull();
  });

  it('returns null for an empty/whitespace x-forwarded-for and no x-real-ip', () => {
    expect(getClientIp(stub({ 'x-forwarded-for': '   ' }))).toBeNull();
  });
});
