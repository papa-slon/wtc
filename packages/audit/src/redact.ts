/**
 * Deep redaction for audit payloads. Secrets must NEVER reach the audit log.
 * Over-redaction is acceptable; under-redaction is not. Zero dependencies.
 */
// Substring matcher (isSecretKey uses `includes`). Phase 2.1 additions cover vault ciphertext,
// one-time codes, and bearer/refresh/id/access tokens (the last three are already caught by 'token'
// but listed for explicitness). DELIBERATELY OMITTED: bare 'iv' and 'tag' — as substrings they would
// redact innocuous fields ('isActive' contains "iv", 'stage'/'stages' contains "tag"). The AES-GCM
// iv/tag they protect only ever appear INSIDE a sealed vault record, whose parent key ('sealed' /
// 'vaultrecord' / 'ciphertext') is already redacted wholesale here. See
// docs/handoffs/20260530-0925-ecosystem-security-auditor.md F3 (operator-adjusted).
const SECRET_HINTS = [
  'secret',
  'password',
  'passwordhash',
  'apikey',
  'token',
  'authorization',
  'cookie',
  'kek',
  'dek',
  'wrappeddek',
  'privatekey',
  'mnemonic',
  'seedphrase',
  // --- Phase 2.1 additions ---
  'ciphertext',
  'vaultrecord',
  'sealed',
  'credentials',
  'bearer',
  'refreshtoken',
  'idtoken',
  'accesstoken',
  'onetimecode',
];

export const REDACTED = '[REDACTED]';

function isSecretKey(key: string): boolean {
  const norm = key.toLowerCase().replace(/[_\s-]/g, '');
  return SECRET_HINTS.some((h) => norm.includes(h));
}

// Value-pattern blocklist (docs/AUDIT_LOG_SCHEMA.md Redaction Rules / Phase 2.5 security finding F-07):
// some secrets reach a payload under an innocuous key name (e.g. { message: '$argon2id$...' } or a raw
// 64-hex session-token value), so a key-name-only filter misses them. These patterns are anchored and
// specific enough to avoid false positives on ordinary prose/short ids:
//   - PHC / bcrypt hashes:      starts with $argon2id$ / $argon2i$ / $argon2d$ / $2a$ / $2b$ / $2y$ /
//                               $scrypt$ / $pbkdf2$
//   - HTTP auth header values:  starts with "Bearer " or "Basic "
//   - long hex blobs:           a whole string of 64+ hex chars (SHA-256 digests, raw session tokens,
//                               raw key material) — a UUID (has dashes) and short hex ids do NOT match.
const PHC_OR_BCRYPT = /^\$(argon2(id|i|d)?|2[aby]|scrypt|pbkdf2)\$/;
const HTTP_AUTH_VALUE = /^(Bearer|Basic) /;
const LONG_HEX = /^[0-9a-f]{64,}$/i;

/** True when a STRING value looks like secret material regardless of its key name. */
export function isSecretValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return PHC_OR_BCRYPT.test(value) || HTTP_AUTH_VALUE.test(value) || LONG_HEX.test(value);
}

/**
 * Return a deep copy with secret-looking keys AND secret-looking string values replaced by [REDACTED].
 * Caps depth/breadth. Over-redaction is acceptable; under-redaction is not.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[TRUNCATED]';
  // Scalar path: redact a string whose VALUE matches the secret-value patterns (any depth, incl. array
  // elements and values under innocuous keys). Non-string scalars pass through unchanged.
  if (value === null || typeof value !== 'object') return isSecretValue(value) ? REDACTED : value;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSecretKey(k) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}
