import { AppError } from './errors.ts';

/**
 * Fence a dev-only affordance. Throws in production so the feature is unreachable there
 * (e.g. mock self-service entitlement grant). Use in the action BODY, not just the JSX.
 */
export function assertNotProduction(feature: string, nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (nodeEnv === 'production') throw new AppError('forbidden', `${feature} is disabled in production`);
}

/**
 * Resolve a required secret. Returns the env value if set; otherwise a clearly-labelled dev
 * fallback in non-production; otherwise THROWS (fail closed) in production. Never silently
 * falls back to a known/dev secret in production.
 */
/** Values that are obviously placeholders/dev strings and must never be accepted in production. */
const PLACEHOLDER_RE = /^(replace-with|dev-only|dev-handoff|changeme|change-me|placeholder|example|test-secret|xxxx)/i;

export function isPlaceholderSecret(value: string): boolean {
  return PLACEHOLDER_RE.test(value.trim());
}

/**
 * Reject low-entropy / repeated-character secrets (e.g. "ssssss…", "ababab…", "111111…"). A real
 * random secret of >=12 chars has many distinct characters; very few uniques means it was hand-typed,
 * not produced by a CSPRNG. A random hex/base64 key clears this bar with a wide margin.
 */
export function isLowEntropySecret(value: string): boolean {
  const v = value.trim();
  if (v.length < 12) return false; // length is enforced separately; do not double-judge short values
  return new Set(v).size < 6;
}

/** A secret unacceptable in production: a known placeholder OR a low-entropy/repeated value. */
export function isWeakSecret(value: string): boolean {
  return isPlaceholderSecret(value) || isLowEntropySecret(value);
}

/**
 * True iff `value` is canonical base64 that decodes to exactly `bytes` bytes — e.g. a 32-byte
 * (256-bit) AES KEK. Mirrors @wtc/crypto `parseKek` (base64 → 32 bytes) so config-load validation
 * and the vault agree. A hex string of the wrong decoded length (e.g. `openssl rand -hex 24` → 36
 * bytes, or a 32-char base64 → 24 bytes) is rejected.
 */
export function isBase64Key(value: string, bytes: number): boolean {
  const v = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return false;
  try {
    return Buffer.from(v, 'base64').length === bytes;
  } catch {
    return false;
  }
}

export function requiredSecret(
  name: string,
  value: string | undefined,
  devFallback: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string {
  const isProd = nodeEnv === 'production';
  if (value && value.length > 0) {
    if (isProd && isWeakSecret(value)) {
      throw new Error(`[config] ${name} looks like a placeholder or low-entropy value and is not allowed in production`);
    }
    return value;
  }
  if (!isProd) return devFallback;
  throw new Error(`[config] ${name} is required in production (no dev fallback outside development)`);
}
