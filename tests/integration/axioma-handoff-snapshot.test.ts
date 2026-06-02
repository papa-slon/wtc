import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  buildHandoffClaims,
  createEs256Signer,
  verifyEs256HandoffToken,
  type HandoffEntitlementSnapshot,
} from '@wtc/axioma-bridge';

const NOW = 1_900_000_000_000;
const AUD = 'https://axi-o.ma';

function keypair() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' });
}

describe('Axioma handoff payload snapshots', () => {
  it('signs the provided entitlement snapshot and linked Axioma user id', () => {
    const { privateKey, publicKey } = keypair();
    const entitlement: HandoffEntitlementSnapshot = {
      product_code: 'axioma_terminal',
      state: 'grace',
      expires_at: '2030-03-17T17:46:40.000Z',
    };
    const signer = createEs256Signer(privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'kid-snapshot');
    const claims = buildHandoffClaims('wtc-user-1', 'axioma_terminal', 'open_journal', NOW, AUD, {
      entitlement,
      axiomaUserId: 'axioma-user-123',
    });

    const verified = verifyEs256HandoffToken(signer.sign(claims), publicKey, { audience: AUD, now: NOW + 1000 });
    expect(verified.valid).toBe(true);
    if (!verified.valid) throw new Error(verified.reason);
    expect(verified.claims.wtc_entitlement).toEqual(entitlement);
    expect(verified.claims.wtc_axioma_user_id).toBe('axioma-user-123');
  });

  it('defaults to an active no-link snapshot only when no explicit snapshot is supplied', () => {
    const { privateKey, publicKey } = keypair();
    const signer = createEs256Signer(privateKey.export({ type: 'pkcs8', format: 'pem' }) as string, 'kid-default');
    const claims = buildHandoffClaims('wtc-user-2', 'axioma_terminal', 'account_link', NOW, AUD);

    const verified = verifyEs256HandoffToken(signer.sign(claims), publicKey, { audience: AUD, now: NOW + 1000 });
    expect(verified.valid).toBe(true);
    if (!verified.valid) throw new Error(verified.reason);
    expect(verified.claims.wtc_entitlement).toEqual({
      product_code: 'axioma_terminal',
      state: 'active',
      expires_at: null,
    });
    expect(verified.claims.wtc_axioma_user_id).toBeNull();
  });
});
