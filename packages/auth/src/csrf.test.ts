import { describe, it, expect } from 'vitest';
import { deriveSessionCsrfToken, verifyCsrf } from './csrf.ts';

describe('session-bound CSRF token', () => {
  it('is empty for an empty session (so unauthenticated forms cannot pass)', () => {
    expect(deriveSessionCsrfToken('', 'secret')).toBe('');
  });
  it('is deterministic per session and differs across sessions', () => {
    const a = deriveSessionCsrfToken('session-A', 'secret');
    const a2 = deriveSessionCsrfToken('session-A', 'secret');
    const b = deriveSessionCsrfToken('session-B', 'secret');
    expect(a).toBe(a2);
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(16);
  });
  it('verifyCsrf accepts the matching token and rejects mismatches/missing', () => {
    const t = deriveSessionCsrfToken('sess', 'secret');
    expect(verifyCsrf(t, t)).toBe(true);
    expect(verifyCsrf(t, t + 'x')).toBe(false);
    expect(verifyCsrf(t, undefined)).toBe(false);
    expect(verifyCsrf(undefined, t)).toBe(false);
  });
});
