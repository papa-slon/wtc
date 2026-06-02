import {
  buildHandoffClaims,
  createEs256Signer,
  resolveHandoffSigner,
  type HandoffPurpose,
  type HandoffEntitlementSnapshot,
  type HandoffSigner,
} from '@wtc/axioma-bridge';

export type AxiomaRouteBlocker =
  | 'flag_disabled'
  | 'database_not_configured'
  | 'bridge_token_missing'
  | 'es256_key_missing'
  | 'es256_key_invalid'
  | 'journal_base_url_invalid';

export interface AxiomaRouteReadiness {
  configured: boolean;
  blockers: AxiomaRouteBlocker[];
}

type AxiomaRouteEnv = {
  [key: string]: string | undefined;
  APP_ENV?: string;
  AXIOMA_ROUTE_SKELETON_ENABLED?: string;
  AXIOMA_BRIDGE_API_TOKEN?: string;
  AXIOMA_HANDOFF_SIGNING_KEY?: string;
  AXIOMA_HANDOFF_KEY_ID?: string;
  AXIOMA_HANDOFF_AUDIENCE?: string;
  AXIOMA_JOURNAL_BASE_URL?: string;
};

export function axiomaRouteReadiness(opts: { dbAvailable: boolean; env?: AxiomaRouteEnv }): AxiomaRouteReadiness {
  const env = opts.env ?? process.env;
  const blockers: AxiomaRouteBlocker[] = [];
  if (env.AXIOMA_ROUTE_SKELETON_ENABLED !== 'true') blockers.push('flag_disabled');
  if (!opts.dbAvailable) blockers.push('database_not_configured');
  if (!env.AXIOMA_BRIDGE_API_TOKEN?.trim()) blockers.push('bridge_token_missing');
  if (!env.AXIOMA_HANDOFF_SIGNING_KEY || !env.AXIOMA_HANDOFF_KEY_ID) {
    blockers.push('es256_key_missing');
  } else {
    try {
      createEs256Signer(env.AXIOMA_HANDOFF_SIGNING_KEY, env.AXIOMA_HANDOFF_KEY_ID);
    } catch {
      blockers.push('es256_key_invalid');
    }
  }
  try {
    new URL(env.AXIOMA_JOURNAL_BASE_URL ?? 'https://axi-o.ma');
  } catch {
    blockers.push('journal_base_url_invalid');
  }
  return { configured: blockers.length === 0, blockers };
}

export function resolveAxiomaRouteSigner(env: AxiomaRouteEnv = process.env): HandoffSigner {
  return resolveHandoffSigner({
    deploymentEnv: env.APP_ENV === 'test' || env.APP_ENV === 'staging' || env.APP_ENV === 'production'
      ? env.APP_ENV
      : 'development',
    es256KeyPem: env.AXIOMA_HANDOFF_SIGNING_KEY,
    es256KeyId: env.AXIOMA_HANDOFF_KEY_ID,
    hs256Secret: undefined,
  });
}

export function buildAxiomaHandoff(
  input: {
    userId: string;
    purpose: HandoffPurpose;
    now?: number;
    env?: AxiomaRouteEnv;
    entitlement?: HandoffEntitlementSnapshot;
    axiomaUserId?: string | null;
  },
): { token: string; jti: string; issuedAt: Date; expiresAt: Date; postUrl: string; signerAlg: 'ES256' | 'HS256' } {
  const env = input.env ?? process.env;
  const now = input.now ?? Date.now();
  const audience = env.AXIOMA_HANDOFF_AUDIENCE ?? 'axi-o.ma';
  const baseUrl = env.AXIOMA_JOURNAL_BASE_URL ?? 'https://axi-o.ma';
  const signer = resolveAxiomaRouteSigner(env);
  const claims = buildHandoffClaims(input.userId, 'axioma_terminal', input.purpose, now, audience, {
    entitlement: input.entitlement,
    axiomaUserId: input.axiomaUserId ?? null,
  });
  const token = signer.sign(claims);
  return {
    token,
    jti: claims.jti,
    issuedAt: new Date(claims.iat * 1000),
    expiresAt: new Date(claims.exp * 1000),
    postUrl: new URL('/wtc-handoff', baseUrl).toString(),
    signerAlg: signer.alg,
  };
}
