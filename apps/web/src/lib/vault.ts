import 'server-only';
import { createSecretVault, parseKek, type SecretVault } from '@wtc/crypto';
import { requiredSecret } from '@wtc/shared';

// DEV-ONLY fallback KEK (all 0x07 bytes). requiredSecret() returns this ONLY in non-production.
// The vault is created LAZILY (first use) so a missing SECRET_VAULT_KEK fails closed at RUNTIME in
// production without breaking `next build` (the build host does not have runtime secrets injected).
const DEV_ONLY_KEK = Buffer.alloc(32, 7).toString('base64');

let cached: SecretVault | null = null;

export function getVault(): SecretVault {
  if (cached) return cached;
  const kekB64 = requiredSecret('SECRET_VAULT_KEK', process.env.SECRET_VAULT_KEK, DEV_ONLY_KEK);
  const keyId = process.env.SECRET_VAULT_KEY_ID || 'kek-dev';
  cached = createSecretVault({ keyId, kek: parseKek(kekB64) });
  return cached;
}
