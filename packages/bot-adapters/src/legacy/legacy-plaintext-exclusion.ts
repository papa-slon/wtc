/**
 * LegacyApiSafeBodySchema — a Zod transform that STRIPS any field whose key looks like an exchange
 * secret, before ANY parsed value from a legacy `/api_management/` body could reach the WTC canonical
 * layer. This is the WTC-side deliverable for docs/PRODUCTION_BLOCKERS.md B3 item 2.
 *
 * The legacy adapter is currently BLOCKED (see ./legacy-blocked.ts) — no /api_management/ call is
 * issued from the factory, so this schema has no runtime caller today. It exists so that WHEN the
 * upstream plaintext-key fix lands and the adapter is un-blocked, no code path can accidentally forward
 * a plaintext `api_key` / `secret_key` / token to the canonical mapping layer: a stripped body simply
 * does not contain the field.
 *
 * COORDINATION (see docs/OPEN_QUESTIONS.md Q-14): LEGACY_SECRET_FIELD_NAMES below is the bot-adapter
 * package's own list (this package deliberately does NOT depend on @wtc/audit). It is a SUPERSET of the
 * @wtc/audit redact.ts SECRET_HINTS list — any addition to that list should be mirrored here.
 */
import { z } from 'zod';

/** Normalise a key for substring comparison: lowercase, drop `_`, `-`, and whitespace. */
function normaliseKey(k: string): string {
  return k.toLowerCase().replace(/[_\s-]/g, '');
}

/**
 * Secret field-name substrings. Any object key whose normalised form CONTAINS one of these is removed.
 * Superset of @wtc/audit redact.ts SECRET_HINTS (packages/audit/src/redact.ts) plus the known legacy
 * API fields (`api_key`, `secret_key` → match `apikey` / `secret`) and common exchange-key aliases.
 * 'key' and 'pass' alone are deliberately excluded (too broad — would strip `api_id`, etc.); the real
 * legacy fields are covered by the more specific `apikey` / `secret` / `password` entries.
 */
export const LEGACY_SECRET_FIELD_NAMES = [
  // Core exchange-credential aliases (cover api_key, secret_key, api_secret, apiKey, …)
  'apikey',
  'secret',
  'privatekey',
  'passphrase',
  'password',
  'token',
  'mnemonic',
  'seedphrase',
  // Mirrored from @wtc/audit redact.ts SECRET_HINTS
  'passwordhash',
  'authorization',
  'cookie',
  'kek',
  'dek',
  'wrappeddek',
  'ciphertext',
  'vaultrecord',
  'sealed',
  'credential',
  'bearer',
  'refreshtoken',
  'idtoken',
  'accesstoken',
  'onetimecode',
] as const;

/** True when a field key (after normalisation) matches any LEGACY_SECRET_FIELD_NAMES entry. */
export function isLegacySecretField(key: string): boolean {
  const norm = normaliseKey(key);
  return LEGACY_SECRET_FIELD_NAMES.some((hint) => norm.includes(hint));
}

/**
 * Return a deep copy with all secret-hint keys removed (at any nesting depth; capped at 8 levels to
 * match the redact.ts depth cap). Secret fields are DROPPED entirely — not replaced with a [REDACTED]
 * marker — so the canonical layer never even sees a placeholder for exchange-key material. The input
 * is not mutated.
 */
function stripSecretFields(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => stripSecretFields(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!isLegacySecretField(k)) out[k] = stripSecretFields(v, depth + 1);
  }
  return out;
}

/**
 * Accepts any value and returns it with every secret-hint field stripped. Apply this to a legacy
 * `/api_management/*` body BEFORE any stricter downstream schema or mapping (when the adapter is
 * eventually un-blocked):
 *   const safe = LegacyApiSafeBodySchema.parse(rawBody);  // secret fields gone here
 */
export const LegacyApiSafeBodySchema = z.unknown().transform((v) => stripSecretFields(v));
