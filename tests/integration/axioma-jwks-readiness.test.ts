import { afterEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { resolveAxiomaJwksReadiness } from '../../apps/web/src/features/terminal/axioma-jwks-readiness.ts';
import { axiomaRouteReadiness } from '../../apps/web/src/features/terminal/axioma-route-core.ts';
import { GET } from '../../apps/web/src/app/.well-known/axioma-jwks.json/route.ts';

function privatePem(): string {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
}

const ORIGINAL_KEY = process.env.AXIOMA_HANDOFF_SIGNING_KEY;
const ORIGINAL_KID = process.env.AXIOMA_HANDOFF_KEY_ID;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.AXIOMA_HANDOFF_SIGNING_KEY;
  } else {
    process.env.AXIOMA_HANDOFF_SIGNING_KEY = ORIGINAL_KEY;
  }
  if (ORIGINAL_KID === undefined) {
    delete process.env.AXIOMA_HANDOFF_KEY_ID;
  } else {
    process.env.AXIOMA_HANDOFF_KEY_ID = ORIGINAL_KID;
  }
});

describe('Axioma JWKS readiness', () => {
  it('reports missing key and key id separately', () => {
    expect(resolveAxiomaJwksReadiness({}).blockers).toEqual(['signing_key_missing', 'key_id_missing']);
    expect(resolveAxiomaJwksReadiness({ AXIOMA_HANDOFF_SIGNING_KEY: privatePem() }).blockers).toEqual(['key_id_missing']);
    expect(resolveAxiomaJwksReadiness({ AXIOMA_HANDOFF_KEY_ID: 'kid-1' }).blockers).toEqual(['signing_key_missing']);
  });

  it('rejects an invalid signing key even when both env names are present', () => {
    const readiness = resolveAxiomaJwksReadiness({
      AXIOMA_HANDOFF_SIGNING_KEY: 'not-a-p256-private-key',
      AXIOMA_HANDOFF_KEY_ID: 'kid-invalid',
    });
    expect(readiness.configured).toBe(false);
    expect(readiness.blockers).toEqual(['signing_key_invalid']);
    expect(readiness.jwks).toBeNull();
  });

  it('shared route readiness rejects invalid ES256 key material before reporting configured', () => {
    expect(axiomaRouteReadiness({
      dbAvailable: true,
      env: {
        AXIOMA_ROUTE_SKELETON_ENABLED: 'true',
        AXIOMA_BRIDGE_API_TOKEN: 'configured',
        AXIOMA_HANDOFF_SIGNING_KEY: 'not-a-p256-private-key',
        AXIOMA_HANDOFF_KEY_ID: 'kid-invalid',
        AXIOMA_JOURNAL_BASE_URL: 'https://axi-o.ma',
      },
    })).toEqual({ configured: false, blockers: ['es256_key_invalid'] });
  });

  it('builds a public JWKS for a valid P-256 private key without exposing private scalar d', () => {
    const readiness = resolveAxiomaJwksReadiness({
      AXIOMA_HANDOFF_SIGNING_KEY: privatePem(),
      AXIOMA_HANDOFF_KEY_ID: 'kid-valid',
    });
    expect(readiness.configured).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.jwks?.keys).toHaveLength(1);
    const jwk = readiness.jwks!.keys[0]!;
    expect(jwk.kid).toBe('kid-valid');
    expect(jwk.alg).toBe('ES256');
    expect('d' in jwk).toBe(false);
  });

  it('public JWKS route returns no-store 503 when unconfigured', async () => {
    delete process.env.AXIOMA_HANDOFF_SIGNING_KEY;
    delete process.env.AXIOMA_HANDOFF_KEY_ID;

    const res = await GET();

    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    await expect(res.json()).resolves.toEqual({ error: 'jwks_not_configured' });
  });

  it('public JWKS route returns cacheable JWKS when configured', async () => {
    process.env.AXIOMA_HANDOFF_SIGNING_KEY = privatePem();
    process.env.AXIOMA_HANDOFF_KEY_ID = 'kid-route';

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    const body = (await res.json()) as { keys?: Array<Record<string, unknown>> };
    expect(body.keys).toHaveLength(1);
    expect(body.keys![0]!.kid).toBe('kid-route');
    expect('d' in body.keys![0]!).toBe(false);
  });
});
