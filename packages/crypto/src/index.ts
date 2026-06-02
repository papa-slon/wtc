export {
  createSecretVault,
  parseKek,
  maskSecret,
  VaultError,
  VAULT_VERSION,
} from './vault.ts';
export type { SealedSecret, SecretVault, VaultKey } from './vault.ts';
