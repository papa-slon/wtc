/**
 * Argon2id password hashing. Parameters match docs/SECURITY_MODEL.md §1 (m=65536, t=3, p=2).
 * Uses @node-rs/argon2 (native binding). Runs/typechecks after `npm install`, not under bare-node smoke.
 */
import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 defaults to the Argon2id variant; params per docs/SECURITY_MODEL.md §1.
const OPTIONS = {
  memoryCost: 65536, // 64 MiB (OWASP minimum)
  timeCost: 3,
  parallelism: 2,
  outputLen: 32,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, OPTIONS);
}

export async function verifyPassword(phcHash: string, plaintext: string): Promise<boolean> {
  try {
    return await verify(phcHash, plaintext);
  } catch {
    return false;
  }
}
