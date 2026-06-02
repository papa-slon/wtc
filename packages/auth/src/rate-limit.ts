/**
 * @wtc/auth/rate-limit — pure, dependency-free sliding-window rate limiter + client-IP extraction.
 *
 * EDGE-SAFE BY CONSTRUCTION: this module imports NOTHING (no `@node-rs/argon2`, no `node:*`), so it
 * can be imported directly from `apps/web/src/middleware.ts` (Next.js Edge runtime). It is deliberately
 * NOT re-exported from `@wtc/auth` (the barrel pulls `password.ts` → argon2, which breaks the Edge
 * bundle); import it via the `@wtc/auth/rate-limit` subpath only.
 *
 * The limiter is a sliding-window log: the caller owns the `store` Map (so it can live as module state
 * in the middleware, or be a fresh Map in a test) and passes `now` explicitly (no hidden clock — fully
 * deterministic under Vitest). See docs/SECURITY_MODEL.md §4 (10 req/min per IP on auth entry points).
 */

/** Minimal structural type for anything header-like with a `.get()` (the Web `Headers`, a `NextRequest`'s
 *  headers, or a plain test stub). */
export interface HeaderLookup {
  get(name: string): string | null;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum allowed requests per key within the window. */
  max: number;
}

export interface RateLimitResult {
  /** False once the key has used up `max` requests inside the current window. */
  allowed: boolean;
  /** Requests still permitted in the current window after this call (0 when blocked). */
  remaining: number;
  /** Milliseconds until the oldest in-window request expires (0 when allowed). Drives `Retry-After`. */
  retryAfterMs: number;
}

/**
 * Extract the client IP from proxy headers. Returns `null` when no IP can be determined (e.g. a direct
 * localhost connection in dev/e2e with no proxy in front). The caller decides how to treat `null`
 * (the middleware trusts localhost in non-production and fails closed in production).
 *
 * Order: `x-forwarded-for` first hop (the original client; nginx prepends, so the left-most is the real
 * client) → `x-real-ip` → null. Never trusts a body- or query-supplied address.
 */
export function getClientIp(headers: HeaderLookup): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = headers.get('x-real-ip');
  if (xri) {
    const trimmed = xri.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/**
 * Sliding-window-log rate check. Prunes entries older than `now - windowMs`, then either records `now`
 * (allowed) or rejects (blocked) without recording — so a sustained flood does not perpetually extend
 * the block past one window. Mutates `store[key]` in place (the caller owns `store`).
 */
export function checkRateLimit(
  store: Map<string, number[]>,
  key: string,
  opts: RateLimitOptions,
  now: number,
): RateLimitResult {
  const { windowMs, max } = opts;
  const cutoff = now - windowMs;
  const live = (store.get(key) ?? []).filter((ts) => ts > cutoff);

  if (live.length >= max) {
    // Blocked: do NOT record this attempt. Retry-After = when the oldest live request leaves the window.
    const oldest = live[0]!; // live is non-empty here (length >= max >= 1) and ascending
    store.set(key, live);
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, oldest + windowMs - now) };
  }

  live.push(now);
  store.set(key, live);
  return { allowed: true, remaining: max - live.length, retryAfterMs: 0 };
}
