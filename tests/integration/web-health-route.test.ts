import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GET, HEAD } from '../../apps/web/src/app/api/health/route.ts';

const routeSource = readFileSync('apps/web/src/app/api/health/route.ts', 'utf8');

describe('web health route', () => {
  it('returns a no-store non-secret liveness payload', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ ok: true, status: 'ok', service: 'wtc-web' });
  });

  it('supports HEAD probes without body or cache', async () => {
    const res = await HEAD();
    expect(res.status).toBe(204);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('does not expose DB, env, adapter, token, or raw health details', () => {
    expect(routeSource).not.toMatch(/DATABASE_URL|process\.env|getServerDb|integrationHealthChecks|JOURNAL_READ_TOKEN|TORTILA_JOURNAL|LEGACY_DATABASE_URL|authorization|bearer|rawJson/i);
  });
});
