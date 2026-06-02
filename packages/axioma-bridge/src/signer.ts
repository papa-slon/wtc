/**
 * Handoff signer resolution + the staging/prod fence (PG6).
 *
 * This is the SINGLE place that decides which signer signs an Axioma handoff token, and the fence that
 * forbids the HS256 dev stub in a real (staging/production) deployment. It is PURE — it NEVER reads
 * process.env. The web/server layer resolves the deployment env + key material from @wtc/config and
 * passes them in, so packages/axioma-bridge stays a zero-dependency package.
 *
 * Fence (docs/handoffs/20260530-2230-ecosystem-security-auditor.md F-01,
 *        docs/handoffs/20260530-2230-ecosystem-axioma-bridge-auditor.md F-01):
 *   - an ES256 key (PEM + kid) is present          → ES256 signer (production-grade, JWKS-verifiable), ANY env;
 *   - else deploymentEnv is 'staging'|'production' → THROW (no HS256 fallback in a real deployment);
 *   - else (development|test) + an HS256 secret     → the HS256 dev stub (handoff.ts, also prod-fenced);
 *   - else                                          → THROW (no signing material at all).
 *
 * Why deploymentEnv and not NODE_ENV: the old guard (handoff.ts) only threw on NODE_ENV==='production',
 * so a staging deployment running NODE_ENV=development would silently ship an unverifiable HS256 token.
 * deploymentEnv (APP_ENV) is the deployment axis, distinct from NODE_ENV (the build-mode axis).
 */
import { createEs256Signer } from './es256.ts';
import { signHandoffToken, type HandoffClaims } from './handoff.ts';

export type DeploymentEnv = 'development' | 'test' | 'staging' | 'production';

export interface HandoffSigner {
  /** Sign claims into a compact JWS handoff token. */
  sign(claims: HandoffClaims): string;
  /** 'ES256' (production-grade, JWKS-verifiable) or 'HS256' (dev stub). */
  readonly alg: 'ES256' | 'HS256';
  /** kid for ES256; null for the HS256 dev stub. */
  readonly keyId: string | null;
}

export interface ResolveHandoffSignerOptions {
  deploymentEnv: DeploymentEnv;
  /** EC P-256 private key (PEM). When present (with es256KeyId), ES256 is used in ANY environment. */
  es256KeyPem?: string | undefined;
  es256KeyId?: string | undefined;
  /** HS256 dev-stub secret — only usable in development|test (handoff.ts also throws in NODE_ENV=production). */
  hs256Secret?: string | undefined;
}

/** A real deployment where the unverifiable HS256 dev stub must never be used. */
export function isRealDeployment(env: DeploymentEnv): boolean {
  return env === 'staging' || env === 'production';
}

/**
 * Resolve the handoff signer for the given deployment env + key material, enforcing the staging/prod
 * fence. Fail-closed: throws rather than silently degrading to an unverifiable signer.
 */
export function resolveHandoffSigner(opts: ResolveHandoffSignerOptions): HandoffSigner {
  if (opts.es256KeyPem && opts.es256KeyId) {
    const signer = createEs256Signer(opts.es256KeyPem, opts.es256KeyId);
    return { alg: 'ES256', keyId: signer.keyId, sign: (claims) => signer.sign(claims) };
  }
  if (isRealDeployment(opts.deploymentEnv)) {
    throw new Error(
      `[axioma-handoff] ES256 signing key required in ${opts.deploymentEnv} ` +
        '(set AXIOMA_HANDOFF_SIGNING_KEY + AXIOMA_HANDOFF_KEY_ID); the HS256 dev stub is fenced out of staging/production',
    );
  }
  if (opts.hs256Secret) {
    const secret = opts.hs256Secret;
    return { alg: 'HS256', keyId: null, sign: (claims) => signHandoffToken(claims, secret) };
  }
  throw new Error('[axioma-handoff] no signing material available (provide an ES256 key or an HS256 dev secret)');
}
