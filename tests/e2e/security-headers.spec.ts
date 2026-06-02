import { test, expect } from '@playwright/test';

// PG11 — apps/web/src/middleware.ts. Runs against the DEV server (NODE_ENV=development, http),
// so HSTS is absent and the CSP is the relaxed dev variant (unsafe-eval for HMR).

const REQUIRED_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

test('PG11: security headers are present on GET /', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBeLessThan(400);
  const h = res.headers();
  for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
    expect(h[name], `${name} header`).toBe(value);
  }
  expect(h['permissions-policy']).toContain('camera=()');
  expect(h['strict-transport-security'], 'no HSTS over http dev').toBeUndefined();
  const csp = h['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("'unsafe-eval'"); // dev relaxation for HMR
});

// NOTE: the 429 breach path is deliberately NOT exercised over e2e. Per the PG11 tests-runner handoff
// (docs/handoffs/20260530-1815-ecosystem-tests-runner.md), hammering the single shared dev server with a
// rapid POST burst destabilises it and flakes adjacent server-action tests. The 429 logic is covered at
// the unit level instead (packages/auth/src/rate-limit.test.ts — 14 cases incl. block-on-max+1 and
// Retry-After); the header assertion above proves the middleware is active on responses.
