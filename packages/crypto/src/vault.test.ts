import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createSecretVault, parseKek, maskSecret, VaultError } from './vault.ts';

function newVault(keyId = 'k1') {
  return createSecretVault({ keyId, kek: parseKek(randomBytes(32).toString('base64')) });
}

describe('envelope secret vault', () => {
  it('round-trips a secret and never stores plaintext', () => {
    const v = newVault();
    const secret = 'super-secret-api-key-12345';
    const sealed = v.seal(secret, 'user:1');
    expect(v.open(sealed)).toBe(secret);
    expect(JSON.stringify(sealed)).not.toContain(secret);
  });

  it('fails closed on wrong AAD, tamper, and unknown keyId', () => {
    const v = newVault();
    const sealed = v.seal('value', 'ctx:a');
    expect(() => v.open({ ...sealed, aad: 'ctx:b' })).toThrow(VaultError);
    const bad = Buffer.from(sealed.payload, 'base64');
    const bi = bad.length - 1;
    bad[bi] = (bad[bi] ?? 0) ^ 0xff;
    expect(() => v.open({ ...sealed, payload: bad.toString('base64') })).toThrow(VaultError);
    expect(() => v.open({ ...sealed, keyId: 'ghost' })).toThrow(VaultError);
  });

  it('supports KEK rotation via rewrap while keeping old KEKs available', () => {
    const oldKekB64 = randomBytes(32).toString('base64');
    const v1 = createSecretVault({ keyId: 'old', kek: parseKek(oldKekB64) });
    const sealed = v1.seal('rotate-me', 'user:7');
    const v2 = createSecretVault(
      { keyId: 'new', kek: parseKek(randomBytes(32).toString('base64')) },
      [{ keyId: 'old', kek: parseKek(oldKekB64) }],
    );
    const rewrapped = v2.rewrap(sealed);
    expect(rewrapped.keyId).toBe('new');
    expect(v2.open(rewrapped)).toBe('rotate-me');
  });

  it('rejects malformed KEKs', () => {
    expect(() => parseKek('not-32-bytes')).toThrow(VaultError);
  });

  it('masks secrets to last 4 chars', () => {
    expect(maskSecret('abcd1234')).toBe('••••••••1234');
    expect(maskSecret('xy')).toBe('••••');
  });
});
