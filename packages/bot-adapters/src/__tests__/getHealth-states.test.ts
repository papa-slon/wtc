/**
 * Read-only health-state discrimination for the real Tortila HTTP adapter (PG2).
 *
 * getHealth() must surface four distinct read states AND must NEVER throw — every failure mode
 * resolves to a BotHealth so the worker tick and the dashboard render an honest, specific status:
 *   not_configured (no token) · unreachable (network/non-2xx) · malformed (bad shape) · stale (old ts) · ok.
 *
 * Strategy: stub the global fetch so no real network call is made. The not_configured path must not
 * call fetch at all (a real adapter never runs unauthenticated).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AdapterNotReadyError, createHttpTortilaAdapter } from '../http.ts';

const BASE = 'http://127.0.0.1:65535';
const TOKEN = 'super-secret-journal-token-value';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Tortila real adapter getHealth() — 4 read states (never throws)', () => {
  it('not_configured: no token ⇒ readState=not_configured and fetch is never called', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const adapter = createHttpTortilaAdapter(BASE); // no token
    const health = await adapter.getHealth();
    expect(health.readState).toBe('not_configured');
    expect(health.processAlive).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    // P0/P1 warnings are still attached even when not configured.
    expect(health.warnings.map((w) => w.code)).toContain('tp_reconcile_p0');
  });

  it('unreachable: fetch rejects ⇒ readState=unreachable, resolves (does not throw)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const adapter = createHttpTortilaAdapter(BASE, TOKEN);
    const health = await adapter.getHealth();
    expect(health.readState).toBe('unreachable');
    expect(health.processAlive).toBe(false);
    expect(health.status).not.toBe('healthy');
  });

  it('unreachable: non-2xx ⇒ readState=unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, false, 503)));
    const adapter = createHttpTortilaAdapter(BASE, TOKEN);
    const health = await adapter.getHealth();
    expect(health.readState).toBe('unreachable');
  });

  it('malformed: 200 body fails schema ⇒ readState=malformed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ unexpected: 'shape' })));
    const adapter = createHttpTortilaAdapter(BASE, TOKEN);
    const health = await adapter.getHealth();
    expect(health.readState).toBe('malformed');
    expect(health.processAlive).toBe(false);
  });

  it('malformed: 200 body with unparseable ts ⇒ readState=malformed (not stale)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true, ts: 'not-a-timestamp' })));
    const adapter = createHttpTortilaAdapter(BASE, TOKEN);
    const health = await adapter.getHealth();
    expect(health.readState).toBe('malformed');
  });

  it('stale: valid body with an old ts ⇒ readState=stale', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true, ts: '2020-01-01T00:00:00+00:00' })));
    const adapter = createHttpTortilaAdapter(BASE, TOKEN);
    const health = await adapter.getHealth();
    expect(health.readState).toBe('stale');
    expect(health.status).toBe('stale');
  });

  it('ok: valid body with a fresh ts ⇒ readState=ok, status non-healthy (P0/P1 persist)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true, ts: new Date().toISOString() })));
    const adapter = createHttpTortilaAdapter(BASE, TOKEN);
    const health = await adapter.getHealth();
    expect(health.readState).toBe('ok');
    expect(health.processAlive).toBe(true);
    expect(health.status).not.toBe('healthy'); // unresolved P0/P1 keep it 'degraded'
  });

  it('never leaks the token into the returned BotHealth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true, ts: new Date().toISOString() })));
    const adapter = createHttpTortilaAdapter(BASE, TOKEN);
    const health = await adapter.getHealth();
    expect(JSON.stringify(health)).not.toContain(TOKEN);
  });

  it('attaches Authorization: Bearer <token> only when a token is configured', async () => {
    const fetchSpy = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(jsonResponse({ ok: true, ts: new Date().toISOString() })),
    );
    vi.stubGlobal('fetch', fetchSpy);

    await createHttpTortilaAdapter(BASE, TOKEN).getHealth();
    const init = fetchSpy.mock.calls[0]![1];
    expect((init!.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);

    // No token ⇒ not_configured short-circuit ⇒ no fetch, so no Authorization header is ever sent.
    fetchSpy.mockClear();
    await createHttpTortilaAdapter(BASE).getHealth();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('no token: all real data methods refuse to fetch unauthenticated', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const adapter = createHttpTortilaAdapter(BASE);

    await expect(adapter.getMetrics('x')).rejects.toThrow(AdapterNotReadyError);
    await expect(adapter.getPositions('x')).rejects.toThrow(AdapterNotReadyError);
    await expect(adapter.getTrades('x')).rejects.toThrow(AdapterNotReadyError);
    expect(adapter.getEquityCurve).toBeDefined();
    await expect(adapter.getEquityCurve!('x')).rejects.toThrow(AdapterNotReadyError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
