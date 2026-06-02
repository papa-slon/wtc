import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { createEs256Signer, verifyEs256HandoffToken } from './es256.ts';
import { buildJwks } from './jwks.ts';
import { buildHandoffClaims } from './handoff.ts';

const NOW = 1_900_000_000_000;
const AUD = 'https://axi-o.ma';

function keypair() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' });
}

describe('Axioma ES256 handoff signer + JWKS', () => {
  it('round-trips sign → verify with the matching public key', () => {
    const { privateKey, publicKey } = keypair();
    const signer = createEs256Signer(privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'kid-1');
    const claims = buildHandoffClaims('user-1', 'axioma_terminal', 'open_journal', NOW, AUD);
    const token = signer.sign(claims);
    const res = verifyEs256HandoffToken(token, publicKey, { audience: AUD, now: NOW + 1000 });
    expect(res.valid).toBe(true);
    if (res.valid) expect(res.claims.sub).toBe('user-1');
  });

  it('header advertises ES256 + kid (not HS256)', () => {
    const { privateKey } = keypair();
    const signer = createEs256Signer(privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'kid-xyz');
    const token = signer.sign(buildHandoffClaims('u', 'axioma_terminal', 'account_link', NOW, AUD));
    const header = JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8'));
    expect(header.alg).toBe('ES256');
    expect(header.typ).toBe('JWT');
    expect(header.kid).toBe('kid-xyz');
  });

  it('JWKS exposes only the public key (no private scalar `d`)', () => {
    const { privateKey } = keypair();
    const signer = createEs256Signer(privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'kid-1');
    const jwks = buildJwks([signer]);
    expect(jwks.keys).toHaveLength(1);
    const jwk = jwks.keys[0]!;
    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.alg).toBe('ES256');
    expect('d' in jwk).toBe(false); // CRITICAL: private scalar must never be exposed
    expect(jwk.x).toBeTruthy();
    expect(jwk.y).toBeTruthy();
  });

  it('rejects a token signed by a different key', () => {
    const a = keypair();
    const b = keypair();
    const signer = createEs256Signer(a.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'kid-1');
    const token = signer.sign(buildHandoffClaims('u', 'axioma_terminal', 'open_journal', NOW, AUD));
    const res = verifyEs256HandoffToken(token, b.publicKey, { audience: AUD, now: NOW });
    expect(res.valid).toBe(false);
  });

  it('rejects an expired token and an audience mismatch and a replayed jti', () => {
    const { privateKey, publicKey } = keypair();
    const signer = createEs256Signer(privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'kid-1');
    const claims = buildHandoffClaims('u', 'axioma_terminal', 'open_journal', NOW, AUD);
    const token = signer.sign(claims);
    expect(verifyEs256HandoffToken(token, publicKey, { audience: AUD, now: claims.exp + 1 }).valid).toBe(false); // expired
    expect(verifyEs256HandoffToken(token, publicKey, { audience: 'https://evil', now: NOW }).valid).toBe(false); // aud
    expect(verifyEs256HandoffToken(token, publicKey, { audience: AUD, now: NOW, isReplayed: () => true }).valid).toBe(false); // replay
  });

  it('verify rejects a non-ES256 alg header (no HS256 downgrade)', () => {
    const { publicKey } = keypair();
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(buildHandoffClaims('u', 'axioma_terminal', 'open_journal', NOW, AUD))).toString('base64url');
    const forged = `${header}.${payload}.${Buffer.from('x').toString('base64url')}`;
    const res = verifyEs256HandoffToken(forged, publicKey, { audience: AUD, now: NOW });
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe('wrong_alg');
  });

  it('requires both a key and a key id', () => {
    const { privateKey } = keypair();
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
    expect(() => createEs256Signer('', 'kid')).toThrow();
    expect(() => createEs256Signer(pem, '')).toThrow();
  });
});
