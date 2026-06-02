/**
 * Opaque session tokens. The raw token goes in an httpOnly+Secure+SameSite cookie; the DB
 * stores only its SHA-256 hash. Verification is constant-time. Node-crypto only (runnable).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface SessionToken {
  /** raw token to set in the cookie (never stored) */
  token: string;
  /** sha-256 hex of the token (store this) */
  tokenHash: string;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): SessionToken {
  // 32 random bytes as hex (64 chars) per docs/SECURITY_MODEL.md §2
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

/** Constant-time comparison of a presented token against a stored hash. */
export function verifySessionToken(presentedToken: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(presentedToken), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Prod uses the __Host- prefix (forces Secure, Path=/, no Domain — RFC 6265bis). Dev over http
// cannot use __Host- (it requires Secure), so dev falls back to a plain name.
export const SESSION_COOKIE_PROD = '__Host-wtc_session';
export const SESSION_COOKIE_DEV = 'wtc_session';
export const SESSION_COOKIE = SESSION_COOKIE_DEV;
export function sessionCookieName(isProd: boolean): string {
  return isProd ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export function sessionCookieOptions(isProd: boolean): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: Math.floor(SESSION_TTL_MS / 1000) };
}
