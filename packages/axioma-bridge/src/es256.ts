/**
 * ES256 (ECDSA P-256) Axioma handoff signer + verifier — the production-grade path.
 *
 * The HS256 signer in handoff.ts stays a DEV-ONLY stub that throws in production. ES256 tokens are
 * verifiable by Axioma against the public JWKS (see jwks.ts + the /.well-known/axioma-jwks.json route).
 * The private key NEVER leaves this module and is NEVER present in any JWKS output (a hard assertion in
 * `publicJwk()` refuses to emit a JWK containing the private scalar `d`).
 *
 * Durable jti/replay persistence lives in @wtc/db (`axioma_handoff_jti_revocations` plus
 * record/consume/revoke/purge repositories). This pure package verifies signatures and claim shape;
 * route handlers own DB-backed replay checks and audit writes.
 */
import { createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify, type KeyObject } from 'node:crypto';
import { HANDOFF_ISSUER, handoffNowSeconds, type HandoffClaims } from './handoff.ts';

const enc = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url');

export interface Es256Signer {
  keyId: string;
  /** Sign claims as a compact JWS with header { alg:'ES256', typ:'JWT', kid }. */
  sign(claims: HandoffClaims): string;
  /** Public JWK for the JWKS endpoint — guaranteed free of the private scalar `d`. */
  publicJwk(): Record<string, unknown>;
}

export function createEs256Signer(privateKeyPem: string, keyId: string): Es256Signer {
  if (!privateKeyPem) throw new Error('[axioma-handoff] ES256 signer requires AXIOMA_HANDOFF_SIGNING_KEY');
  if (!keyId) throw new Error('[axioma-handoff] ES256 signer requires AXIOMA_HANDOFF_KEY_ID');
  const privateKey = createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ec') throw new Error('[axioma-handoff] signing key must be an EC (P-256) key');
  const publicKey = createPublicKey(privateKey);

  return {
    keyId,
    sign(claims) {
      const header = enc(JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: keyId }));
      const payload = enc(JSON.stringify(claims));
      const signingInput = `${header}.${payload}`;
      // JOSE ES256 needs the raw r||s (IEEE P-1363) signature, not DER.
      const signature = cryptoSign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
      return `${signingInput}.${enc(signature)}`;
    },
    publicJwk() {
      const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
      if ('d' in jwk) throw new Error('[axioma-handoff] refusing to expose a JWK containing the private scalar');
      return { ...jwk, kid: keyId, use: 'sig', alg: 'ES256' };
    },
  };
}

export interface Es256VerifyOptions {
  audience: string;
  now: number;
  /** return true if this jti has already been consumed (replay) — store-backed, TARGET durability */
  isReplayed?: (jti: string) => boolean;
}
export type Es256VerifyResult = { valid: true; claims: HandoffClaims } | { valid: false; reason: string };

/** Verify an ES256 handoff token against a public key (mirrors the Axioma verifier; used in tests). */
export function verifyEs256HandoffToken(
  token: string,
  publicKey: string | KeyObject,
  opts: Es256VerifyOptions,
): Es256VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [header, payload, sig] = parts as [string, string, string];
  let head: { alg?: string; typ?: string };
  try {
    head = JSON.parse(dec(header).toString('utf8')) as { alg?: string; typ?: string };
  } catch {
    return { valid: false, reason: 'bad_header' };
  }
  if (head.alg !== 'ES256') return { valid: false, reason: 'wrong_alg' };
  if (head.typ !== 'JWT') return { valid: false, reason: 'bad_typ' };
  const key = typeof publicKey === 'string' ? createPublicKey(publicKey) : publicKey;
  const ok = cryptoVerify('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' }, dec(sig));
  if (!ok) return { valid: false, reason: 'bad_signature' };
  let claims: HandoffClaims;
  try {
    claims = JSON.parse(dec(payload).toString('utf8')) as HandoffClaims;
  } catch {
    return { valid: false, reason: 'bad_payload' };
  }
  if (claims.iss !== HANDOFF_ISSUER) return { valid: false, reason: 'bad_issuer' };
  if (claims.aud !== opts.audience) return { valid: false, reason: 'aud_mismatch' };
  const nowSec = handoffNowSeconds(opts.now);
  if (typeof claims.nbf === 'number' && nowSec < claims.nbf) return { valid: false, reason: 'not_before' };
  if (typeof claims.exp !== 'number' || nowSec >= claims.exp) return { valid: false, reason: 'expired' };
  if (opts.isReplayed && claims.jti && opts.isReplayed(claims.jti)) return { valid: false, reason: 'replayed' };
  return { valid: true, claims };
}
