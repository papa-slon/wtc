import { describe, it, expect } from 'vitest';
import { sessionCookieName, sessionCookieOptions, SESSION_COOKIE_PROD, SESSION_COOKIE_DEV } from './session.ts';

describe('session cookie naming (__Host- prefix in production)', () => {
  it('uses the __Host- prefixed name in production', () => {
    expect(sessionCookieName(true)).toBe('__Host-wtc_session');
    expect(SESSION_COOKIE_PROD).toBe('__Host-wtc_session');
  });

  it('uses the plain name in dev (http cannot satisfy the __Host- Secure requirement)', () => {
    expect(sessionCookieName(false)).toBe('wtc_session');
    expect(SESSION_COOKIE_DEV).toBe('wtc_session');
  });

  it('production cookie options satisfy the __Host- prerequisites (Secure, Path=/, no Domain)', () => {
    const opts = sessionCookieOptions(true);
    expect(opts.secure).toBe(true);
    expect(opts.path).toBe('/');
    expect(opts.httpOnly).toBe(true);
    expect('domain' in opts).toBe(false);
  });

  it('dev cookie options are not Secure (so the cookie works over http)', () => {
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});
