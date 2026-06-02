/**
 * PG6 — Axioma handoff signer resolution + the staging/prod fence, and the ES256-into-bridge wiring.
 *
 * Tests use a GENERATED P-256 key (never a real provisioned key — B4 stays NOT RUN). They prove:
 *   - dev/test may use the HS256 dev stub;
 *   - staging|production WITHOUT an ES256 key THROW (the HS256 stub is fenced out of real deployments);
 *   - an ES256 key is preferred in any env and produces JWKS-verifiable tokens;
 *   - createAxiomaBridge signs with the injected signer and records the issued jti;
 *   - an HS256 token is rejected by the ES256 verifier (no alg-downgrade).
 *
 * Design: docs/handoffs/20260530-2230-ecosystem-tests-runner.md,
 *         docs/handoffs/20260530-2230-ecosystem-security-auditor.md (F-01/F-06),
 *         docs/handoffs/20260530-2230-ecosystem-axioma-bridge-auditor.md (F-01/F-02).
 */
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { resolveHandoffSigner, isRealDeployment } from './signer.ts';
import { createAxiomaBridge } from './bridge.ts';
import { verifyEs256HandoffToken } from './es256.ts';
import { buildHandoffClaims, verifyHandoffToken } from './handoff.ts';

const NOW = 1_900_000_000_000;
const AUD = 'axi-o.ma';
const HS_SECRET = 'dev-handoff-secret-please-rotate-1234';

function p256(): { pem: string; publicKey: KeyObject } {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, publicKey };
}

describe('resolveHandoffSigner — staging/prod fence', () => {
  it('development + HS256 secret (no ES256 key) → HS256 dev stub', () => {
    const signer = resolveHandoffSigner({ deploymentEnv: 'development', hs256Secret: HS_SECRET });
    expect(signer.alg).toBe('HS256');
    expect(signer.keyId).toBeNull();
    const token = signer.sign(buildHandoffClaims('u', 'axioma_terminal', 'open_journal', NOW, AUD));
    expect(verifyHandoffToken(token, HS_SECRET, { audience: AUD, now: NOW + 1000 }).valid).toBe(true);
  });

  it('test + HS256 secret → HS256 dev stub allowed', () => {
    expect(resolveHandoffSigner({ deploymentEnv: 'test', hs256Secret: HS_SECRET }).alg).toBe('HS256');
  });

  it('ES256 key present → ES256 signer in ANY env (development)', () => {
    const { pem } = p256();
    const signer = resolveHandoffSigner({ deploymentEnv: 'development', es256KeyPem: pem, es256KeyId: 'kid-1', hs256Secret: HS_SECRET });
    expect(signer.alg).toBe('ES256');
    expect(signer.keyId).toBe('kid-1');
  });

  it('staging + NO key → THROWS (HS256 stub fenced out)', () => {
    expect(() => resolveHandoffSigner({ deploymentEnv: 'staging', hs256Secret: HS_SECRET })).toThrow(/ES256 signing key required in staging/);
  });

  it('production + NO key → THROWS (HS256 stub fenced out)', () => {
    expect(() => resolveHandoffSigner({ deploymentEnv: 'production', hs256Secret: HS_SECRET })).toThrow(/ES256 signing key required in production/);
  });

  it('staging + ES256 key → ES256 signer; token verifies against the public key', () => {
    const { pem, publicKey } = p256();
    const signer = resolveHandoffSigner({ deploymentEnv: 'staging', es256KeyPem: pem, es256KeyId: 'kid-stg' });
    expect(signer.alg).toBe('ES256');
    const token = signer.sign(buildHandoffClaims('u', 'axioma_terminal', 'open_journal', NOW, AUD));
    expect(verifyEs256HandoffToken(token, publicKey, { audience: AUD, now: NOW + 1000 }).valid).toBe(true);
  });

  it('production + ES256 key → ES256 signer (real deployment, keyed)', () => {
    const { pem } = p256();
    expect(resolveHandoffSigner({ deploymentEnv: 'production', es256KeyPem: pem, es256KeyId: 'kid-prod' }).alg).toBe('ES256');
  });

  it('no ES256 key and no HS256 secret → THROWS (no signing material)', () => {
    expect(() => resolveHandoffSigner({ deploymentEnv: 'development' })).toThrow(/no signing material/);
  });

  it('isRealDeployment is true only for staging/production', () => {
    expect(isRealDeployment('staging')).toBe(true);
    expect(isRealDeployment('production')).toBe(true);
    expect(isRealDeployment('development')).toBe(false);
    expect(isRealDeployment('test')).toBe(false);
  });
});

describe('createAxiomaBridge — ES256 signing + jti recording', () => {
  it('createJournalHandoff signs with the injected ES256 signer and records the jti', async () => {
    const { pem, publicKey } = p256();
    const signer = resolveHandoffSigner({ deploymentEnv: 'production', es256KeyPem: pem, es256KeyId: 'kid-1' });
    const recorded: { jti: string; sub: string; issuedAt: number; expiresAt: number }[] = [];
    const bridge = createAxiomaBridge({
      baseUrl: 'https://axi-o.ma',
      signer,
      audience: AUD,
      now: () => NOW,
      recordJti: async (jti, sub, issuedAt, expiresAt) => { recorded.push({ jti, sub, issuedAt, expiresAt }); },
    });
    const { postUrl, token, expiresAt, method } = await bridge.createJournalHandoff('user-7', true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.sub).toBe('user-7');
    expect(recorded[0]!.issuedAt).toBe(NOW);
    expect(expiresAt).toBe(NOW + 5 * 60 * 1000);
    expect(postUrl).toBe('https://axi-o.ma/wtc-handoff');
    expect(method).toBe('POST');
    expect(postUrl).not.toContain('?token=');
    // The jti is recorded BEFORE the token is handed out, and matches the token's jti claim.
    const res = verifyEs256HandoffToken(token, publicKey, { audience: AUD, now: NOW + 1000 });
    expect(res.valid).toBe(true);
    if (res.valid) {
      expect(res.claims.sub).toBe('user-7');
      expect(res.claims.jti).toBe(recorded[0]!.jti);
    }
  });

  it('createJournalHandoff throws without entitlement (never signs, never records)', async () => {
    const { pem } = p256();
    const signer = resolveHandoffSigner({ deploymentEnv: 'production', es256KeyPem: pem, es256KeyId: 'kid-1' });
    let recordCount = 0;
    const bridge = createAxiomaBridge({ baseUrl: 'https://axi-o.ma', signer, audience: AUD, recordJti: async () => { recordCount += 1; } });
    await expect(bridge.createJournalHandoff('u', false)).rejects.toThrow(/entitlement/i);
    expect(recordCount).toBe(0);
  });

  it('an HS256 token is rejected by the ES256 verifier (no alg-downgrade)', () => {
    const hs = resolveHandoffSigner({ deploymentEnv: 'development', hs256Secret: HS_SECRET });
    const token = hs.sign(buildHandoffClaims('u', 'axioma_terminal', 'open_journal', NOW, AUD));
    const { publicKey } = p256();
    const res = verifyEs256HandoffToken(token, publicKey, { audience: AUD, now: NOW });
    expect(res.valid).toBe(false);
    if (!res.valid) expect(res.reason).toBe('wrong_alg');
  });
});
