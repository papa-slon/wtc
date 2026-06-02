/**
 * CSRF helpers.
 *
 * `generateCsrfToken` remains for legacy tests and generic double-submit use. The current web app
 * server-action path derives a deterministic per-session token with `deriveSessionCsrfToken`.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_COOKIE = 'wtc_csrf';
export const CSRF_HEADER = 'x-wtc-csrf';

export function generateCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export function verifyCsrf(cookieToken: string | undefined, submittedToken: string | undefined): boolean {
  if (!cookieToken || !submittedToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(submittedToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Derive a deterministic per-session CSRF token (synchronizer token bound to the session).
 * Both the form render and the receiving action recompute it from the session token + a server
 * secret — no extra cookie or middleware, and no first-render race. Returns '' for an empty
 * session so unauthenticated forms cannot pass this check (they must not use this path).
 */
export function deriveSessionCsrfToken(sessionToken: string, secret: string): string {
  if (!sessionToken) return '';
  return createHmac('sha256', secret).update('csrf:' + sessionToken).digest('hex');
}
