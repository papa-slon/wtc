import { describe, it, expect } from 'vitest';
import { buildHandoffClaims, signHandoffToken, verifyHandoffToken, HANDOFF_TTL_MS, HANDOFF_ISSUER } from './handoff.ts';

const SECRET = 'test-secret';
const AUD = 'axi-o.ma';
const NOW = 1_800_000_000_000;

const part = (token: string, i: number) => JSON.parse(Buffer.from(token.split('.')[i]!, 'base64url').toString('utf8'));

describe('Axioma handoff token constraints', () => {
  const token = signHandoffToken(buildHandoffClaims('user-1', 'axioma_terminal', 'open_journal', NOW, AUD), SECRET);

  it('carries ONLY the declared claims — never a password or raw Axioma JWT', () => {
    const keys = Object.keys(part(token, 1)).sort();
    expect(keys).toEqual([
      'aud',
      'exp',
      'iat',
      'iss',
      'jti',
      'nbf',
      'nonce',
      'sub',
      'wtc_axioma_user_id',
      'wtc_entitlement',
      'wtc_flow',
    ]);
    for (const forbidden of ['axioma_jwt', 'jwt', 'password', 'apiKey', 'apiSecret']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(token.toLowerCase()).not.toContain('password');
  });

  it('uses the spec issuer (exact-match string)', () => {
    expect(part(token, 1).iss).toBe(HANDOFF_ISSUER);
    expect(HANDOFF_ISSUER).toBe('https://app.wtc.example.com');
  });

  it('is the documented dev stub (HS256) — production MUST be ES256', () => {
    expect(part(token, 0).alg).toBe('HS256');
    expect(part(token, 0).typ).toBe('JWT');
  });

  it('uses Unix-second registered claims and the documented WTC payload shape', () => {
    const payload = part(token, 1);
    expect(payload.iat).toBe(Math.floor(NOW / 1000));
    expect(payload.nbf).toBe(payload.iat);
    expect(payload.exp).toBe(payload.iat + 5 * 60);
    expect(payload.wtc_flow).toBe('open_journal');
    expect(payload.wtc_entitlement).toEqual({ product_code: 'axioma_terminal', state: 'active', expires_at: null });
    expect(payload.wtc_axioma_user_id).toBeNull();
    expect(typeof payload.nonce).toBe('string');
    expect(payload.nonce.length).toBeGreaterThanOrEqual(40);
  });

  it('verifies, and rejects expiry / wrong audience / replay', () => {
    expect(verifyHandoffToken(token, SECRET, { audience: AUD, now: NOW + 1000 }).valid).toBe(true);
    expect(verifyHandoffToken(token, SECRET, { audience: AUD, now: NOW + HANDOFF_TTL_MS + 1 }).valid).toBe(false);
    expect(verifyHandoffToken(token, SECRET, { audience: 'evil.com', now: NOW }).valid).toBe(false);
    const used = new Set<string>([part(token, 1).jti]);
    expect(verifyHandoffToken(token, SECRET, { audience: AUD, now: NOW, isReplayed: (j) => used.has(j) }).valid).toBe(false);
  });

  it('refuses to sign in production — the HS256 dev-stub is fenced until the ES256/JWKS signer exists', () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() =>
        signHandoffToken(buildHandoffClaims('user-1', 'axioma_terminal', 'open_journal', NOW, AUD), SECRET),
      ).toThrow(/production/i);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
