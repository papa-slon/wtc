import { buildJwks, createEs256Signer, type Jwks } from '@wtc/axioma-bridge';

export type AxiomaJwksBlocker = 'signing_key_missing' | 'key_id_missing' | 'signing_key_invalid';

export interface AxiomaJwksReadiness {
  configured: boolean;
  blockers: AxiomaJwksBlocker[];
  jwks: Jwks | null;
}

export function resolveAxiomaJwksReadiness(env: NodeJS.ProcessEnv = process.env): AxiomaJwksReadiness {
  const blockers: AxiomaJwksBlocker[] = [];
  const key = env.AXIOMA_HANDOFF_SIGNING_KEY;
  const keyId = env.AXIOMA_HANDOFF_KEY_ID;
  if (!key) blockers.push('signing_key_missing');
  if (!keyId) blockers.push('key_id_missing');
  if (!key || !keyId) return { configured: false, blockers, jwks: null };

  try {
    return { configured: true, blockers: [], jwks: buildJwks([createEs256Signer(key, keyId)]) };
  } catch {
    return { configured: false, blockers: ['signing_key_invalid'], jwks: null };
  }
}
