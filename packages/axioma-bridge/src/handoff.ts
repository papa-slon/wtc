/**
 * Axioma handoff token — short-lived signed token for "Open Axioma Journal" / account-link.
 *
 * !!! DEV STUB: this is an HS256 (symmetric) signer for LOCAL testing only. The production signer
 * MUST be ES256 (asymmetric, JWKS) per docs/AXIOMA_HANDOFF_TOKEN_SPEC.md — a spec-compliant Axioma
 * verifier will REJECT an HS256 token. The dev stub keeps the same safety-critical claim set
 * (iss/aud/sub/ent/iat/exp/jti/nonce/purpose), 5-minute TTL, and jti replay prevention so the flow
 * can be exercised end-to-end. A test asserts alg='HS256' to keep this divergence visible in CI.
 *
 * Hard boundary: this token gates server-backed Axioma features only. It NEVER gates local Axioma
 * order execution, NEVER carries exchange keys, and NEVER carries the user's Axioma password or
 * a raw Axioma JWT.
 */
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export type HandoffPurpose = 'open_journal' | 'account_link';

export interface HandoffEntitlementSnapshot {
  product_code: string;
  state: 'active' | 'grace' | 'none' | 'expired' | 'revoked' | 'refunded' | 'chargeback' | 'manual_review';
  expires_at: string | null;
}

export interface HandoffClaims {
  iss: string;
  aud: string;
  sub: string; // WTC user id
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  nonce: string;
  wtc_flow: HandoffPurpose;
  wtc_entitlement: HandoffEntitlementSnapshot;
  wtc_axioma_user_id: string | null;
}

export const HANDOFF_TTL_MS = 5 * 60 * 1000;
export const HANDOFF_TTL_SECONDS = HANDOFF_TTL_MS / 1000;
// Matches docs/AXIOMA_HANDOFF_TOKEN_SPEC.md (Axioma validates iss as an exact string).
export const HANDOFF_ISSUER = 'https://app.wtc.example.com';
const ISSUER = HANDOFF_ISSUER;

const enc = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const dec = (s: string) => Buffer.from(s, 'base64url');

export function handoffNowSeconds(now: number): number {
  return now > 10_000_000_000 ? Math.floor(now / 1000) : Math.floor(now);
}

export function buildHandoffClaims(
  userId: string,
  productCode: string,
  purpose: HandoffPurpose,
  now: number,
  audience: string,
  opts?: { entitlement?: Partial<HandoffEntitlementSnapshot>; axiomaUserId?: string | null },
): HandoffClaims {
  const iat = handoffNowSeconds(now);
  return {
    iss: ISSUER,
    aud: audience,
    sub: userId,
    iat,
    nbf: iat,
    exp: iat + HANDOFF_TTL_SECONDS,
    jti: randomUUID(),
    nonce: randomBytes(32).toString('base64url'),
    wtc_flow: purpose,
    wtc_entitlement: {
      product_code: opts?.entitlement?.product_code ?? productCode,
      state: opts?.entitlement?.state ?? 'active',
      expires_at: opts?.entitlement?.expires_at ?? null,
    },
    wtc_axioma_user_id: opts?.axiomaUserId ?? null,
  };
}

export function signHandoffToken(claims: HandoffClaims, secret: string): string {
  // DEV-STUB GUARD: HS256 is a local-only signer. A spec-compliant Axioma verifier REJECTS HS256, so
  // this must never issue tokens in production — production requires the ES256/JWKS signer (not yet
  // built) per docs/AXIOMA_HANDOFF_TOKEN_SPEC.md.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[axioma-handoff] HS256 dev-stub signer is disabled in production; implement the ES256/JWKS signer first');
  }
  const header = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = enc(JSON.stringify(claims));
  const sig = enc(createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

export interface VerifyOptions {
  audience: string;
  now: number;
  /** return true if this jti has already been consumed (replay) */
  isReplayed?: (jti: string) => boolean;
}

export type VerifyResult = { valid: true; claims: HandoffClaims } | { valid: false; reason: string };

export function verifyHandoffToken(token: string, secret: string, opts: VerifyOptions): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [header, payload, sig] = parts as [string, string, string];
  let head: { alg?: string; typ?: string };
  try {
    head = JSON.parse(dec(header).toString('utf8')) as { alg?: string; typ?: string };
  } catch {
    return { valid: false, reason: 'bad_header' };
  }
  if (head.alg !== 'HS256') return { valid: false, reason: 'wrong_alg' };
  if (head.typ !== 'JWT') return { valid: false, reason: 'bad_typ' };
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
  const got = dec(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return { valid: false, reason: 'bad_signature' };

  let claims: HandoffClaims;
  try {
    claims = JSON.parse(dec(payload).toString('utf8')) as HandoffClaims;
  } catch {
    return { valid: false, reason: 'bad_payload' };
  }
  if (claims.iss !== ISSUER) return { valid: false, reason: 'bad_issuer' };
  if (claims.aud !== opts.audience) return { valid: false, reason: 'aud_mismatch' };
  const nowSec = handoffNowSeconds(opts.now);
  if (typeof claims.nbf === 'number' && nowSec < claims.nbf) return { valid: false, reason: 'not_before' };
  if (typeof claims.exp !== 'number' || nowSec >= claims.exp) return { valid: false, reason: 'expired' };
  if (opts.isReplayed && claims.jti && opts.isReplayed(claims.jti)) return { valid: false, reason: 'replayed' };
  return { valid: true, claims };
}
