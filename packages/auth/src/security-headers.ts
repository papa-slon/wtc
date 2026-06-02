/**
 * @wtc/auth/security-headers — pure builders for the application security-header suite + CSP.
 *
 * EDGE-SAFE BY CONSTRUCTION: imports nothing. Import via the `@wtc/auth/security-headers` subpath from
 * `apps/web/src/middleware.ts` (the `@wtc/auth` barrel pulls argon2 and is not Edge-safe).
 *
 * Header values follow docs/SECURITY_MODEL.md §6. Two intentional environment splits:
 *  - HSTS is emitted in production only (the dev server is plain http; an HSTS header over http is wrong).
 *  - The CSP `script-src`/`connect-src` relax in development so Next.js HMR (eval + inline + ws) works —
 *    the e2e suite runs against the dev server, so a strict dev CSP would break it.
 *
 * CSP `script-src` policy:
 *  - dev               → 'self' 'unsafe-inline' 'unsafe-eval'   (HMR)
 *  - prod + nonce given → 'self' 'nonce-<n>'                    (strict; the spec target)
 *  - prod + no nonce    → 'self' 'unsafe-inline'                (MVP default — see note)
 *
 * NOTE (MVP concession): the middleware currently calls this WITHOUT a nonce, so production ships
 * `script-src 'self' 'unsafe-inline'` — the same documented concession already made for `style-src`
 * in §6. A per-request nonce ('nonce-<n>') is fully supported here and unit-tested, but wiring it
 * requires the middleware to forward the nonce and the root layout to stamp it, which opts every page
 * into dynamic rendering. That tightening is a tracked Phase-3 follow-up; all other headers and the
 * rate limiter are enforced now.
 */

export type SecurityHeaderEnv = 'production' | 'development';

export interface SecurityHeaderOptions {
  env: SecurityHeaderEnv;
  /** Per-request CSP nonce. When provided in production, `script-src` becomes nonce-strict. */
  nonce?: string | null;
}

export const LMS_EMBED_FRAME_SOURCES = [
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
] as const;

/** Build the Content-Security-Policy header value for the given environment + optional nonce. */
export function buildContentSecurityPolicy(env: SecurityHeaderEnv, nonce?: string | null): string {
  const isProd = env === 'production';

  const scriptSrc = isProd
    ? nonce
      ? `script-src 'self' 'nonce-${nonce}'`
      : `script-src 'self' 'unsafe-inline'`
    : `script-src 'self' 'unsafe-inline' 'unsafe-eval'`;

  const connectSrc = isProd
    ? `connect-src 'self' https://axi-o.ma`
    : `connect-src 'self' https://axi-o.ma ws://localhost:* wss://localhost:*`;

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://cdn.axi-o.ma`,
    `font-src 'self' https://fonts.gstatic.com`,
    connectSrc,
    `frame-src ${LMS_EMBED_FRAME_SOURCES.join(' ')}`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];
  // upgrade-insecure-requests only makes sense under TLS (production).
  if (isProd) directives.push('upgrade-insecure-requests');

  return directives.join('; ') + ';';
}

/**
 * Build the full security-header map to apply to a response. HSTS is production-only; all other headers
 * are emitted in both environments.
 */
export function buildSecurityHeaders(opts: SecurityHeaderOptions): Record<string, string> {
  const { env, nonce } = opts;
  const headers: Record<string, string> = {
    'Content-Security-Policy': buildContentSecurityPolicy(env, nonce),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  if (env === 'production') {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }
  return headers;
}
