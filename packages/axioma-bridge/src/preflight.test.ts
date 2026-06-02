import { describe, expect, it } from 'vitest';
import { createAxiomaHandoffPreflightFixture, runAxiomaHandoffPreflight } from './preflight.ts';

describe('Axioma handoff preflight summary', () => {
  it('proves generated ES256/JWKS handoff readiness without returning raw token or key material', () => {
    const summary = runAxiomaHandoffPreflight({
      fixture: createAxiomaHandoffPreflightFixture({
        keyId: 'kid-preflight-test',
        audience: 'axioma-preflight-test',
      }),
    });
    expect(summary).toMatchObject({
      mode: 'dry-run',
      network: 'not-run',
      keyMaterial: 'generated-ephemeral-p256',
      signer: { alg: 'ES256', keyId: 'kid-preflight-test', keyIdPresent: true },
      jwks: { keyCount: 1, hasPrivateScalar: false },
      verification: {
        signature: 'passed',
        wrongAudience: 'rejected',
        replay: 'rejected',
        expired: 'rejected',
      },
      result: 'pass',
    });
    const text = JSON.stringify(summary);
    expect(text).not.toContain('PRIVATE KEY');
    expect(text).not.toMatch(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/);
    expect(text).not.toContain('"jti"');
    expect(text).not.toContain('"nonce"');
    expect(text).not.toContain('wtc_axioma_user_id');
  });
});
