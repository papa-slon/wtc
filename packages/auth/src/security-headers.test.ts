import { describe, it, expect } from 'vitest';
import { buildSecurityHeaders, buildContentSecurityPolicy, LMS_EMBED_FRAME_SOURCES } from './security-headers.ts';

const prod = buildSecurityHeaders({ env: 'production', nonce: 'abc123' });
const prodNoNonce = buildSecurityHeaders({ env: 'production' });
const dev = buildSecurityHeaders({ env: 'development' });

describe('buildSecurityHeaders — environment-independent headers', () => {
  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'],
    ['Cross-Origin-Opener-Policy', 'same-origin'],
    ['Cross-Origin-Resource-Policy', 'same-origin'],
  ])('%s is %s in both envs', (header, value) => {
    expect(prod[header]).toBe(value);
    expect(dev[header]).toBe(value);
  });
});

describe('buildSecurityHeaders — HSTS is production-only', () => {
  it('emits HSTS in production', () => {
    expect(prod['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
  });
  it('omits HSTS in development (http dev server)', () => {
    expect(dev['Strict-Transport-Security']).toBeUndefined();
  });
});

describe('buildContentSecurityPolicy — script-src by env/nonce', () => {
  it('production with a nonce → strict nonce script-src, no unsafe-* in scripts', () => {
    const csp = buildContentSecurityPolicy('production', 'abc123');
    const scriptSrc = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc123'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    // style-src legitimately keeps 'unsafe-inline' (the documented §6 concession) — unchanged by the nonce.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('production without a nonce → MVP default script-src self + unsafe-inline (documented concession)', () => {
    const csp = buildContentSecurityPolicy('production');
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'nonce-");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it('development → relaxed script-src with unsafe-eval + unsafe-inline, no nonce (HMR)', () => {
    const csp = buildContentSecurityPolicy('development');
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(csp).not.toContain("'nonce-");
  });

  it('development connect-src allows localhost websockets for HMR', () => {
    const csp = buildContentSecurityPolicy('development');
    expect(csp).toContain('ws://localhost:*');
    expect(csp).toContain('wss://localhost:*');
  });
});

describe('buildContentSecurityPolicy — shared hardening directives', () => {
  const csp = buildContentSecurityPolicy('production', 'n');
  it.each([
    "default-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://cdn.axi-o.ma",
    "font-src 'self' https://fonts.gstatic.com",
  ])('contains %s', (directive) => {
    expect(csp).toContain(directive);
  });

  it('allows only the LMS sanitized embed hosts in frame-src', () => {
    expect(csp).toContain(`frame-src ${LMS_EMBED_FRAME_SOURCES.join(' ')}`);
    expect(csp).toContain('https://www.youtube.com');
    expect(csp).toContain('https://www.youtube-nocookie.com');
    expect(csp).toContain('https://player.vimeo.com');
  });

  it('production includes upgrade-insecure-requests; development does not', () => {
    expect(buildContentSecurityPolicy('production', 'n')).toContain('upgrade-insecure-requests');
    expect(buildContentSecurityPolicy('development')).not.toContain('upgrade-insecure-requests');
  });

  it('every CSP is a single non-empty header line terminated by a semicolon', () => {
    expect(prod['Content-Security-Policy']).toMatch(/;$/);
    expect(prodNoNonce['Content-Security-Policy']).toMatch(/;$/);
    expect(dev['Content-Security-Policy']).toMatch(/;$/);
  });
});
