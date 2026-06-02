/**
 * Zero-dependency smoke test runnable with `node --experimental-strip-types`.
 * Verifies the envelope vault without npm install / vitest.
 */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createSecretVault, parseKek, maskSecret, VaultError } from './vault.ts';

const kekB64 = randomBytes(32).toString('base64');
const vault = createSecretVault({ keyId: 'kek-test-1', kek: parseKek(kekB64) });

const secret = 'bingx_api_key_AbC123:and_a_secret_xyz';
const aad = 'user:42|exchange:bingx';

// 1. round-trip with AAD
const sealed = vault.seal(secret, aad);
assert.equal(vault.open(sealed), secret, 'round-trip should recover plaintext');
assert.ok(!JSON.stringify(sealed).includes(secret), 'sealed record must not contain plaintext');
assert.ok(!JSON.stringify(sealed).includes('api_key_AbC123'), 'no plaintext fragments in record');

// 2. wrong AAD must fail (context binding)
assert.throws(() => vault.open({ ...sealed, aad: 'user:99|exchange:bingx' }), VaultError, 'wrong AAD must fail');

// 3. tampered ciphertext must fail (GCM integrity)
const tampered = Buffer.from(sealed.payload, 'base64');
const ti = tampered.length - 1;
tampered[ti] = (tampered[ti] ?? 0) ^ 0x01;
assert.throws(() => vault.open({ ...sealed, payload: tampered.toString('base64') }), VaultError, 'tamper must fail');

// 4. unknown keyId must fail
assert.throws(() => vault.open({ ...sealed, keyId: 'nope' }), VaultError, 'unknown keyId must fail');

// 5. KEK rotation: rewrap under a new active KEK, old record still opens via `previous`
const newKek = { keyId: 'kek-test-2', kek: parseKek(randomBytes(32).toString('base64')) };
const rotated = createSecretVault(newKek, [{ keyId: 'kek-test-1', kek: parseKek(kekB64) }]);
const rewrapped = rotated.rewrap(sealed);
assert.equal(rewrapped.keyId, 'kek-test-2', 'rewrap should adopt the new active keyId');
assert.equal(rotated.open(rewrapped), secret, 'rewrapped record must still decrypt to plaintext');

// 6. KEK length validation
assert.throws(() => parseKek(Buffer.from('short').toString('base64')), VaultError, 'short KEK must reject');

// 7. masking never reveals the secret body
const masked = maskSecret(secret);
assert.ok(masked.endsWith(secret.slice(-4)) && !masked.includes('api_key'), 'mask shows only last 4');

console.log('OK  @wtc/crypto vault: 7 checks passed (round-trip, AAD bind, tamper, keyId, rotation, kek-len, mask)');
