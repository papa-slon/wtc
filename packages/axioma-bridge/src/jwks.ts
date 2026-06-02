/**
 * JWKS builder for the Axioma handoff public keys. Emits ONLY public JWKs (the signer's `publicJwk()`
 * already refuses to include the private scalar). Served at /.well-known/axioma-jwks.json — public,
 * unauthenticated, cacheable. Axioma fetches this to verify ES256 handoff tokens by `kid`.
 */
import type { Es256Signer } from './es256.ts';

export interface Jwks {
  keys: Record<string, unknown>[];
}

export function buildJwks(signers: Es256Signer[]): Jwks {
  return { keys: signers.map((s) => s.publicJwk()) };
}
