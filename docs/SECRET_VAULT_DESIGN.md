# Secret Vault Design — WTC Ecosystem Platform

> Status: Phase 0 design document, updated Phase 2 (2026-05-30). Governs all implementation.
> Owner: ecosystem-security-auditor
> Last updated: 2026-05-30

Related docs:
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md)
- [RBAC_MATRIX.md](./RBAC_MATRIX.md)

---

## Purpose and Scope

The WTC secret vault governs the storage of user exchange API keys (BingX, Binance, OKX, etc.) and any other per-user secrets that must be held server-side. Exchange API keys are the highest-risk data WTC stores — if leaked they allow unauthorized trading, position manipulation, or fund withdrawal on user accounts.

**Primary subject**: `exchange_api_key_secrets` table (sealed vault record only — no plaintext column).

**Secondary subjects**: any future per-user secrets (OAuth refresh tokens, etc.) follow the same pattern. See the note on `axioma_account_links.one_time_code` below.

---

## Hard Rule — No Plaintext Secrets, Anywhere

> **NO plaintext secrets in DB, logs, audit logs, error traces, screenshots, fixtures, test seeds, browser state, API responses, or response headers. No exceptions.**

Enforcement:
- `packages/audit/src/redact.ts` `redact()` is the IMPLEMENTED deep-redaction function applied to all `before`/`after` payloads before any audit row is written. Its current blocklist (matched case-insensitively after stripping `_`, `-`, spaces) is:
  `secret`, `password`, `passwordhash`, `apikey`, `token`, `authorization`, `cookie`, `kek`, `dek`, `wrappeddek`, `privatekey`, `mnemonic`, `seedphrase`.
  TARGET additions required before production (not yet in redact.ts): `ciphertext`, `iv`, `tag`, `vaultrecord`, `sealed`, `credentials`, `bearer`, `refreshtoken`, `idtoken`. Add these to `SECRET_HINTS` in `redact.ts`.
- `packages/auth/src/logger.ts` with a structured-logger blocklist is **PLANNED — not yet implemented**. Until it exists, structured app logging must not be passed raw secrets. Redaction today is enforced solely by `@wtc/audit` `redact()`.
- Zod response schemas for all API routes explicitly exclude secret fields; they are never in the output schema.
- `npm run secret:scan` (secretlint via `@secretlint/secretlint-rule-preset-recommend`) is the local text secret-scan gate.
  The staged CI workflow includes it, but CI is **NOT RUN** until this workspace is git-backed, has a GitHub remote, and the
  workflow has actually completed on a push/PR. `.secretlintrc` config is at repo root.
- Drizzle: the `exchangeApiKeySecrets.sealed` column is typed `jsonb.$type<Record<string,unknown>>()` — callers must pass a `SealedSecret` object, never a raw string.

---

## Encryption Scheme: AES-256-GCM Envelope Encryption

### Overview

```
KEK (Key Encryption Key)
  └─ CURRENT: the single active KEK is in env var SECRET_VAULT_KEK; its id is SECRET_VAULT_KEY_ID
     (default "kek-dev"). The per-keyId WTC_VAULT_KEK_{keyId} naming below is TARGET (rotation), not implemented.
  └─ used ONLY to wrap/unwrap DEK

DEK (Data Encryption Key)
  └─ 256-bit random per-secret (per DB row)
  └─ stored wrapped (encrypted by KEK) in DB inside the sealed jsonb column (field: wrappedDek)
  └─ used ONLY to encrypt/decrypt the secret payload

Ciphertext
  └─ AES-256-GCM(key=DEK, iv=12-byte random, aad=optional context string, plaintext=secret)
  └─ stored as base64(iv | tag | ciphertext) inside the sealed jsonb column (field: payload)
```

This envelope design means:
- KEK rotation does not require re-encrypting all secrets — only the `wrappedDek` field is re-wrapped.
- DEK compromise of one row does not compromise other rows (each row has its own DEK).
- KEK never touches the DB — it lives only in environment variables.

### Algorithm parameters

| Field | Value |
|-------|-------|
| KEK algorithm | AES-256-GCM (key: 32 bytes from env, base64-encoded — 44 chars) |
| DEK algorithm | AES-256-GCM (key: `crypto.randomBytes(32)`) |
| IV (nonce) | 12 bytes — `crypto.randomBytes(12)` — per encryption operation |
| AAD (additional authenticated data) | Optional context string (e.g. `"user:{userId}|exchange:{exchange}"`) binds the ciphertext to its context, preventing transplant attacks |
| DEK wrap AAD | `"kek:" + keyId` (UTF-8 bytes) |
| Tag | 16 bytes GCM authentication tag |
| Stored blob format | `base64( iv[12] | tag[16] | ciphertext[n] )` — both for `wrappedDek` and `payload` |

### Node.js implementation module: `packages/crypto/src/vault.ts`

IMPLEMENTED shape (the sealed record actually persisted) — base64 blobs, NOT hex. `packages/crypto/src/vault.ts`
is PURE: it takes the KEK as an argument and reads **no** env (the app boundary `apps/web/src/lib/vault.ts`
reads `SECRET_VAULT_KEK`/`SECRET_VAULT_KEY_ID` and injects the parsed KEK).

```typescript
export interface SealedSecret {
  v: number;            // schema version (VAULT_VERSION = 1)
  keyId: string;        // id of the KEK that wrapped this record's DEK (for rotation)
  wrappedDek: string;   // base64( iv | tag | ciphertext ) of the DEK encrypted under the KEK
  payload: string;      // base64( iv | tag | ciphertext ) of the plaintext encrypted under the DEK
  aad?: string;         // optional context string the ciphertext is bound to (not secret)
}
export interface VaultKey { keyId: string; kek: Buffer; }
export function parseKek(base64: string): Buffer;                                        // pure; validates 32-byte length
export function createSecretVault(active: VaultKey, previous?: VaultKey[]): SecretVault; // pure; KEK is an arg, reads no env
// SecretVault: seal(plaintext, aad?) / open(sealed, aad?) / rewrap(sealed)
export function maskSecret(value: string): string;                                       // returns ••••••••<last4>
```

### Stored record shape in DB — IMPLEMENTED (as of Phase 1.7)

The vault is split across TWO tables. This is the authoritative schema; the earlier single-table design was a
Phase-0 sketch that was NOT implemented.

```sql
-- Non-secret account metadata (label, mask, exchange, mode, owner)
CREATE TABLE exchange_accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exchange    text NOT NULL,
  label       text NOT NULL,
  mode        text NOT NULL,           -- 'demo' | 'live'
  key_mask    text NOT NULL,           -- e.g. ••••1234 (non-secret display hint; masked at capture)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Sealed vault record only — NO plaintext column, NO label, NO user_id directly
CREATE TABLE exchange_api_key_secrets (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_account_id  uuid NOT NULL REFERENCES exchange_accounts(id) ON DELETE CASCADE,
  sealed               jsonb NOT NULL,   -- SealedSecret { v, keyId, wrappedDek, payload, aad? }
  key_id               text NOT NULL,    -- = sealed.keyId (redundant index field for rotation queries)
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

**Column name corrections from Phase-0 sketch:**
- Implemented column is `key_mask` (in `exchange_accounts`), not `masked_key`.
- Implemented column is `sealed` (in `exchange_api_key_secrets`), not `vault_record`.
- The combined single-table design with `owner_user_id`, `label`, `masked_key`, `vault_record`, `is_active`, `is_deleted`, `updated_at`, `last_used_at`, `deleted_at` is NOT implemented. The soft-delete/lifecycle columns (`is_active`, `is_deleted`, `deleted_at`) are TARGET — they must be added in a migration before the delete/revoke flows documented below can be implemented.

`key_mask` is the ONLY form of the key ever returned to UI or API responses. Never the plaintext, never the ciphertext, never the `sealed` blob.

### `secret_rotation_events` table

> **TARGET — NOT YET IN SCHEMA.** This table does not exist in `packages/db/src/schema.ts` as of Phase 1.7.
> Rotation event history is currently captured only via the `audit_logs` table (action `key.rewrap`).
> Add this table in a dedicated migration before implementing KEK rotation.

```sql
CREATE TABLE secret_rotation_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_id        uuid NOT NULL REFERENCES exchange_api_key_secrets(id),
  actor_user_id    uuid NOT NULL REFERENCES users(id),
  event_type       text NOT NULL,  -- 'create' | 'rewrap' | 'delete' | 'revoke'
  old_key_id       text,           -- KEK key ID before rotation
  new_key_id       text,           -- KEK key ID after rotation
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  reason           text            -- admin note
);
```

---

## KEK Key Management

### Key naming convention

CURRENT (implemented): a single active KEK in `SECRET_VAULT_KEK`, with its id in `SECRET_VAULT_KEY_ID`
(default `kek-dev`). Retired KEKs are supplied IN CODE as the `previous[]` argument to `createSecretVault`,
not via env. The per-keyId env-naming scheme below is **TARGET** (a future multi-version rotation story),
**not implemented**.

```
SECRET_VAULT_KEK=<base64-32-bytes>      # CURRENT — the active KEK (base64-encoded 32 bytes, 44 chars)
SECRET_VAULT_KEY_ID=kek-dev             # CURRENT — id stamped into each sealed record's keyId

WTC_VAULT_KEK_<keyId>=<base64-32-bytes> # TARGET — per-keyId env naming for multi-version rotation (not implemented)
```

> The implemented vault (`packages/crypto/src/vault.ts` `parseKek`) requires a **base64-encoded 32-byte**
> key (44 chars). Generate with `openssl rand -base64 32` or
> `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

TARGET (rotation): multiple KEK versions coexist in the environment during rotation; old versions are kept
until all rows referencing them are rewrapped, then removed.

### Active key selection

CURRENT: the app boundary `apps/web/src/lib/vault.ts` reads `SECRET_VAULT_KEK` + `SECRET_VAULT_KEY_ID`
and calls `createSecretVault({ keyId, kek: parseKek(SECRET_VAULT_KEK) })`. The vault module takes the KEK
as an **argument** and reads **no** env itself.

New encryptions use the active key. Decryption resolves the key by `record.keyId` (the active key plus any
retired keys passed as `previous[]`) — so old records remain decryptable during rotation.

---

## Scoped Decrypt Permission

Decryption is not a general capability. The following rules govern when `vault.open()` may be called:

1. **Only** `packages/bot-adapters` may call `vault.open()`, and only in the context of passing a key to a validated exchange connection test.
2. The exchange adapter receives the plaintext key in memory; it is NOT stored, logged, or returned.
3. The plaintext key is passed via a dedicated function parameter — never via a general-purpose state object or context where it could be accidentally serialized.
4. After the connection test, the plaintext is local and garbage-collected; there is no caching.
5. Every call to `vault.open()` must have a unit test that verifies no plaintext appears in the function's return value or any logged output.

```typescript
// Allowed usage pattern — only in packages/bot-adapters/src/keyTest.ts
async function testExchangeConnection(accountId: string, userId: string): Promise<ConnectionTestResult> {
  const [acct] = await db.select().from(exchangeAccounts).where(eq(exchangeAccounts.id, accountId));
  requireOwnership(acct.userId, userId);
  const [secret] = await db.select().from(exchangeApiKeySecrets)
    .where(eq(exchangeApiKeySecrets.exchangeAccountId, accountId));
  const plaintext = vault.open(secret.sealed as SealedSecret, `user:${userId}|exchange:${acct.exchange}`);
  try {
    return await exchangeClient.testConnection({ key: plaintext });
  } finally {
    // plaintext is local; JS GC will collect it
  }
}
```

---

## Key Rotation Procedure

### Re-wrap (KEK rotation, no secret change)

> **TARGET — not yet implemented.** The current vault holds ONE active KEK (`SECRET_VAULT_KEK` /
> `SECRET_VAULT_KEY_ID`) plus any retired KEKs supplied in code as `createSecretVault(active, previous[])`.
> The per-keyId env-var flow below (`WTC_VAULT_KEK_*` / `WTC_VAULT_ACTIVE_KEY_ID`) is the future
> multi-version rotation design, not the implemented mechanism. `secret_rotation_events` table is also TARGET.

When a new KEK is deployed, re-wrap all rows referencing the old key:

```
1. Generate new KEK: openssl rand -base64 32   (base64-encoded 32 bytes; NOT hex)
2. Add to env: WTC_VAULT_KEK_kek-2026-07=<new base64-32>
3. Keep old env var: WTC_VAULT_KEK_kek-2026-01=<old base64-32>
4. Set WTC_VAULT_ACTIVE_KEY_ID=kek-2026-07
5. Run migration job: vault.rewrap(record, 'kek-2026-07') for all rows in exchange_api_key_secrets
   - each row: unwrap DEK with old KEK, re-wrap DEK with new KEK, write updated sealed + key_id
   - write secret_rotation_events row: event_type='rewrap', old_key_id, new_key_id
   - done in a DB transaction per row; if any row fails, it stays on old key (handled next run)
6. Verify: all rows have key_id = 'kek-2026-07'
7. Remove old env var: WTC_VAULT_KEK_kek-2026-01
```

This re-wrap operation does NOT expose the exchange API key plaintext — only the DEK is decrypted and re-encrypted.

### User-initiated key replace

If a user replaces their exchange API key:
1. POST new key via `/api/bots/:bot/keys` — new `seal()` + new row in `exchange_api_key_secrets`.
2. Old `exchange_api_key_secrets` row: set a soft-delete flag (requires adding `is_active`/`is_deleted` columns — TARGET).
3. Audit row written in the same transaction: action `key.create` for new row, `key.update` for the account.

---

## Delete / Revoke

> The lifecycle columns (`is_active`, `is_deleted`, `deleted_at`) are **TARGET** — they do not exist in
> the current `exchange_api_key_secrets` schema. Until they are added, delete/revoke is not implementable
> without a migration. Add before Phase 2 key-lifecycle features.

| Action | Target DB effect (once lifecycle columns are added) |
|--------|------|
| User deletes a key | `is_deleted = true`, `deleted_at = now()`, `is_active = false`. The `sealed` JSONB is overwritten with `null` (ciphertext destroyed). Row kept for audit trail. |
| Admin revokes a key | Same as user delete; admin `actor_user_id` recorded in `secret_rotation_events`. |
| User account deleted | All `exchange_api_key_secrets` rows for the user: sealed set to null, is_deleted = true. Hard delete of vault material only; row kept 90 days for compliance, then hard-deleted. |
| Key expired by entitlement revoke | `is_active = false`; `sealed` preserved (user retains data, just bot cannot use it). |

---

## Masking Rules for UI

The UI receives ONLY the `key_mask` field from `exchange_accounts` (a non-secret display hint generated
at capture time by `maskSecret()` in `packages/crypto/src/vault.ts`: `'••••••••' + value.slice(-4)`).

| Context | What is displayed |
|---------|------------------|
| Key list page | `••••••••1234` (the `key_mask` from `exchange_accounts`) |
| Key detail page | Same `key_mask`; no further reveal |
| Clipboard copy | NOT available for key values |
| Error messages | NEVER include key value; reference `exchange_account_id` (UUID) only |
| API responses | `key_mask` field only; the `sealed` jsonb is never serialized in any API response |
| Audit log | NEVER include any key field — audit entries reference the `exchange_api_key_secrets.id` (UUID) only |
| Logs / traces | `@wtc/audit` `redact()` replaces secret-looking keys with `[REDACTED]` |
| Test fixtures | Use `fake-key-XXXX-for-test` strings; no real key format matches in fixtures |
| Playwright screenshots | Masked fields must be blurred in screenshot artifacts if screenshots are committed |

**Exchange key form (UI) requirement**: the form for adding an exchange API key MUST use the vault interface
(`vault.seal()` via the server action) and MUST NEVER display, echo, or return the plaintext key in any
response, including success responses. The only value returned to the client after a successful add is the
`key_mask`. There is no "confirm key" flow that reveals the key after submission.

---

## Axioma Account-Link One-Time Code

`axioma_account_links.one_time_code` stores a short-lived, single-use linking code in plaintext. This is
acceptable ONLY under the following constraints, all of which must hold:
- Maximum TTL of 5 minutes (`code_expires_at`).
- Single-use: the code is nulled out (`one_time_code = null`, `code_expires_at = null`) atomically with the
  `state = 'linked'` update on first successful use.
- Never returned in an API response after the linking flow completes.
- Never logged or included in audit payloads (audit entries record only the `axioma_account_links.id`).
- If a long-lived Axioma session token is ever introduced, it must use the vault (`SealedSecret`) — not a
  plaintext column.

---

## Additional Secret Types (Future)

When additional server-side secrets are introduced (OAuth refresh tokens, billing webhook signing secrets,
etc.), they use the same `SealedSecret` structure stored in a dedicated table with a `sealed jsonb` column.
The `packages/crypto/src/vault.ts` module is the single encryption implementation.

No secret is ever stored as a plaintext column, regardless of whether it seems "low value" at the time.
