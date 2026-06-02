/**
 * @wtc/crypto — envelope secret vault for exchange API keys and other secrets.
 *
 * Design (see docs/SECRET_VAULT_DESIGN.md):
 *  - AES-256-GCM authenticated encryption.
 *  - Envelope: a random per-secret Data Encryption Key (DEK) encrypts the plaintext;
 *    the DEK is itself encrypted ("wrapped") by a Key Encryption Key (KEK) loaded from env.
 *  - Each sealed record records the KEK `keyId` so KEKs can be rotated (re-wrap the DEK only).
 *  - Optional AAD binds a ciphertext to its context (e.g. `user:42|exchange:bingx`) so a row
 *    cannot be transplanted to another user/purpose without failing authentication.
 *  - Plaintext is never persisted, logged, or returned except by an explicit `open()` call.
 *
 * Zero dependencies (only node:crypto) so it can be smoke-tested with `node` directly.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const VAULT_VERSION = 1 as const;
const ALG = 'aes-256-gcm';
const KEY_LEN = 32; // 256-bit
const IV_LEN = 12; // 96-bit nonce (GCM standard)
const TAG_LEN = 16;

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

/** A sealed secret record. Safe to persist; contains no plaintext and no key material. */
export interface SealedSecret {
  /** schema version */
  v: number;
  /** id of the KEK that wrapped this record's DEK (for rotation) */
  keyId: string;
  /** base64( iv | tag | ciphertext ) of the DEK encrypted under the KEK */
  wrappedDek: string;
  /** base64( iv | tag | ciphertext ) of the plaintext encrypted under the DEK */
  payload: string;
  /** optional context string the ciphertext is bound to (not secret) */
  aad?: string;
}

export interface VaultKey {
  keyId: string;
  kek: Buffer;
}

/** Parse a base64 KEK from env and validate its length. */
export function parseKek(base64: string): Buffer {
  let buf: Buffer;
  try {
    buf = Buffer.from(base64, 'base64');
  } catch {
    throw new VaultError('KEK is not valid base64');
  }
  if (buf.length !== KEY_LEN) {
    throw new VaultError(`KEK must decode to ${KEY_LEN} bytes, got ${buf.length}`);
  }
  return buf;
}

function encryptBlob(key: Buffer, plaintext: Buffer, aad?: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  if (aad) cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptBlob(key: Buffer, blob: string, aad?: Buffer): Buffer {
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) throw new VaultError('ciphertext too short / corrupt');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    // GCM auth failure (wrong key, tampered ciphertext, or wrong AAD)
    throw new VaultError('decryption failed: authentication tag mismatch');
  }
}

export interface SecretVault {
  readonly activeKeyId: string;
  seal(plaintext: string, aad?: string): SealedSecret;
  open(sealed: SealedSecret, aad?: string): string;
  /** Re-wrap a record's DEK under the active KEK (KEK rotation). Payload is unchanged. */
  rewrap(sealed: SealedSecret): SealedSecret;
}

/**
 * Create a vault. `active` is the current KEK used for new seals and rewraps.
 * `previous` are retired KEKs kept available so old records can still be opened/rewrapped.
 */
export function createSecretVault(active: VaultKey, previous: VaultKey[] = []): SecretVault {
  if (active.kek.length !== KEY_LEN) throw new VaultError('active KEK must be 32 bytes');
  const keys = new Map<string, Buffer>();
  keys.set(active.keyId, active.kek);
  for (const p of previous) keys.set(p.keyId, p.kek);

  const wrapAad = (keyId: string) => Buffer.from('kek:' + keyId, 'utf8');

  function seal(plaintext: string, aad?: string): SealedSecret {
    const dek = randomBytes(KEY_LEN);
    try {
      const payload = encryptBlob(dek, Buffer.from(plaintext, 'utf8'), aad ? Buffer.from(aad, 'utf8') : undefined);
      const wrappedDek = encryptBlob(active.kek, dek, wrapAad(active.keyId));
      const rec: SealedSecret = { v: VAULT_VERSION, keyId: active.keyId, wrappedDek, payload };
      if (aad !== undefined) rec.aad = aad;
      return rec;
    } finally {
      dek.fill(0);
    }
  }

  function unwrapDek(sealed: SealedSecret): Buffer {
    const kek = keys.get(sealed.keyId);
    if (!kek) throw new VaultError('unknown KEK keyId: ' + sealed.keyId);
    return decryptBlob(kek, sealed.wrappedDek, wrapAad(sealed.keyId));
  }

  function open(sealed: SealedSecret, aad?: string): string {
    if (sealed.v !== VAULT_VERSION) throw new VaultError('unsupported vault version: ' + sealed.v);
    const dek = unwrapDek(sealed);
    try {
      const ctx = aad ?? sealed.aad;
      const pt = decryptBlob(dek, sealed.payload, ctx !== undefined ? Buffer.from(ctx, 'utf8') : undefined);
      return pt.toString('utf8');
    } finally {
      dek.fill(0);
    }
  }

  function rewrap(sealed: SealedSecret): SealedSecret {
    const dek = unwrapDek(sealed);
    try {
      const wrappedDek = encryptBlob(active.kek, dek, wrapAad(active.keyId));
      return { ...sealed, keyId: active.keyId, wrappedDek };
    } finally {
      dek.fill(0);
    }
  }

  return { activeKeyId: active.keyId, seal, open, rewrap };
}

/** Mask a secret for display. Never store the raw value to show it; mask at capture time. */
export function maskSecret(value: string): string {
  if (value.length <= 4) return '••••';
  return '••••••••' + value.slice(-4);
}
