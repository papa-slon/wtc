import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config, middleware } from '../../apps/web/src/middleware.ts';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

function authPost(path: '/login' | '/register', ip?: string): NextRequest {
  const headers = new Headers();
  if (ip) headers.set('x-forwarded-for', ip);
  return new NextRequest(`https://wtc.local${path}`, { method: 'POST', headers });
}

async function exhaustAuthPath(path: '/login' | '/register', ip: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const allowed = middleware(authPost(path, ip));
    expect(allowed.status).not.toBe(429);
  }
  return middleware(authPost(path, ip));
}

describe('auth rate-limit middleware', () => {
  it('matches auth server-action pages and excludes webhook/static surfaces', () => {
    expect(unstable_doesMiddlewareMatch({ config, url: 'https://wtc.local/login' })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: 'https://wtc.local/register' })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: 'https://wtc.local/api/billing/webhook' })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: 'https://wtc.local/.well-known/axioma-jwks.json' })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: 'https://wtc.local/favicon.ico' })).toBe(false);
  });

  it('returns 429, retry headers, and generic JSON on the 11th login POST per client IP', async () => {
    const blocked = await exhaustAuthPath('/login', '203.0.113.42');

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^[1-9]\d*$/);
    expect(blocked.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0');
    await expect(blocked.json()).resolves.toEqual({
      error: 'rate_limited',
      message: 'Too many requests. Please try again later.',
    });
  });

  it('applies the same 429 contract to register POSTs', async () => {
    const blocked = await exhaustAuthPath('/register', '203.0.113.43');

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toMatch(/^[1-9]\d*$/);
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0');
    await expect(blocked.json()).resolves.toMatchObject({ error: 'rate_limited' });
  });

  it('skips direct no-IP development requests but fails closed in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      for (let attempt = 0; attempt < 11; attempt += 1) {
        expect(middleware(authPost('/login')).status).not.toBe(429);
      }

      process.env.NODE_ENV = 'production';
      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect(middleware(authPost('/register')).status).not.toBe(429);
      }
      expect(middleware(authPost('/register')).status).toBe(429);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('keeps the Edge middleware on auth subpath imports', () => {
    const source = read('apps/web/src/middleware.ts');
    expect(source).toContain("from '@wtc/auth/rate-limit'");
    expect(source).toContain("from '@wtc/auth/security-headers'");
    expect(source).not.toMatch(/from ['"]@wtc\/auth['"]/);
  });
});
