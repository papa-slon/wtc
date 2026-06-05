/**
 * apps/web/src/middleware.ts — application-layer security middleware (Next.js Edge runtime).
 *
 * Two responsibilities (docs/SECURITY_MODEL.md §4 + §6):
 *  1. IP-keyed auth rate-limiting on the real auth entry points — the Next.js SERVER ACTIONS that POST
 *     to /login (loginAction) and /register (registerAction). There are NO /api/auth/* routes; the
 *     §4 endpoint names are aspirational. A brute-force exceeding 10 req/min per IP gets 429 + Retry-After.
 *  2. Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
 *     Permissions-Policy, COOP, CORP) on every top-level DOCUMENT response.
 *
 * EDGE-SAFETY: imports ONLY `next/server` + the two pure, dependency-free @wtc/auth subpath modules.
 * It must never import the `@wtc/auth` barrel (it pulls `@node-rs/argon2`, a Node-native binding that
 * breaks the Edge bundle).
 *
 * DOCUMENT-ONLY HEADERS: security headers are applied to top-level document responses only — i.e. GET
 * requests that are neither an RSC payload fetch (`RSC` header) nor a Server Action (`Next-Action`
 * header). Every POST is left untouched: ALL server actions are POSTs (whether invoked via the fetch
 * protocol with a `Next-Action` header OR, before hydration, as a native form POST with no such header),
 * and mutating a Server Action response corrupts the Next.js action protocol — observed in e2e as a dev
 * "unexpected response was received from the server" on form submit. Gating on the GET method covers
 * both action shapes regardless of headers. The browser still enforces the CSP/framing policy carried by
 * the document response that loaded the page; RSC/action responses are trusted same-origin fetches that
 * need no header decoration.
 *
 * /api/billing/webhook is excluded two ways (matcher + early return): the Stripe receiver needs its raw
 * body untouched, is CSRF-exempt by design, and must never be rate-limited.
 *
 * Rate-limit store: an in-process Map (per Edge instance). Single-instance is sufficient for MVP; a
 * multi-instance deployment relies on the nginx limit_req zone (§4 layer 1) and/or a future shared store.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit, getClientIp } from '@wtc/auth/rate-limit';
import { buildSecurityHeaders } from '@wtc/auth/security-headers';

const WEBHOOK_PATH = '/api/billing/webhook';

// Auth rate-limit policy (§4): 10 requests / 60s per client IP on the auth server-action POST paths.
const RATE_LIMIT = { windowMs: 60_000, max: 10 } as const;
const AUTH_POST_PATHS = new Set(['/login', '/register']);

// Per-instance sliding-window store. Module scope persists across requests within one Edge instance.
const rateLimitStore = new Map<string, number[]>();

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * True only for a top-level document navigation: a GET that is not an RSC prefetch and not a Server
 * Action. Security headers are applied only to these responses; POSTs (server actions / form submits)
 * and RSC fetches are passed through untouched.
 */
function isDocumentNavigation(request: NextRequest): boolean {
  return (
    request.method === 'GET' &&
    !request.nextUrl.pathname.startsWith('/api/') &&
    !request.headers.has('rsc') &&
    !request.headers.has('next-action')
  );
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  const env = isProduction() ? 'production' : 'development';
  // nonce omitted at MVP (see security-headers.ts): prod ships script-src 'self' 'unsafe-inline'.
  const headers = buildSecurityHeaders({ env, nonce: null });
  for (const [name, value] of Object.entries(headers)) res.headers.set(name, value);
  return res;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // (1) Billing webhook: never touch (raw body, CSRF-exempt, no rate-limit). Defense-in-depth beyond
  //     the matcher exclusion — return immediately without headers or limiting.
  if (pathname === WEBHOOK_PATH) return NextResponse.next();

  // (2) Auth rate-limiting — POSTs to the server-action page paths (this includes the action request).
  if (request.method === 'POST' && AUTH_POST_PATHS.has(pathname)) {
    const ip = getClientIp(request.headers);

    // Enforce when we can identify the client (proxied traffic) OR we are in production. In a non-prod
    // direct-localhost request (dev / e2e) there is no x-forwarded-for, so `ip` is null — we trust
    // localhost and skip enforcement, which keeps the e2e smoke suite's many legitimate logins from
    // tripping the limiter. Production fails closed: an unidentifiable client lands in the 'unknown'
    // bucket and is still throttled (a stripped header cannot bypass the limit).
    if (ip !== null || isProduction()) {
      const key = `auth:${ip ?? 'unknown'}`;
      const verdict = checkRateLimit(rateLimitStore, key, RATE_LIMIT, Date.now());
      if (!verdict.allowed) {
        const retryAfter = Math.ceil(verdict.retryAfterMs / 1000);
        // No account-existence disclosure (§4): a generic message for both /login and /register.
        const res = NextResponse.json(
          { error: 'rate_limited', message: 'Too many requests. Please try again later.' },
          { status: 429 },
        );
        res.headers.set('Retry-After', String(retryAfter));
        res.headers.set('X-RateLimit-Limit', String(RATE_LIMIT.max));
        res.headers.set('X-RateLimit-Remaining', '0');
        return res;
      }
    }
  }

  // (3) Stamp security headers on top-level document responses only. POSTs (server actions / form
  //     submits) and RSC fetches pass through untouched (see DOCUMENT-ONLY HEADERS note above).
  return isDocumentNavigation(request)
    ? applySecurityHeaders(NextResponse.next())
    : NextResponse.next();
}

// Run on all routes EXCEPT Next internals, static assets (any final segment with a file extension),
// the well-known JWKS endpoint, and the billing webhook (raw body / CSRF-exempt).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|\\.well-known|api/billing/webhook|[^/]+\\.[^/]+$).*)'],
};
