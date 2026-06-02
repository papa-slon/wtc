# Audit Log Schema — WTC Ecosystem Platform

> Status: Phase 0 design document, updated Phase 2 (2026-05-30). Governs all implementation.
> Owner: ecosystem-security-auditor
> Last updated: 2026-05-30

Related docs:
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [RBAC_MATRIX.md](./RBAC_MATRIX.md)
- [SECRET_VAULT_DESIGN.md](./SECRET_VAULT_DESIGN.md)

---

## Design Principles

1. **Append-only**: the application DB user (`wtc_app_role`) has `INSERT` and `SELECT` on `audit_logs` only — no `UPDATE`, no `DELETE`, no `TRUNCATE`. Schema enforces this at the Postgres permission level, not just application code.
2. **Atomic with action**: every audited action writes the audit row in the same DB transaction as the action itself. If the audit write fails, the action is rolled back.
3. **No secrets in audit logs**: secret fields, raw keys, ciphertext, IVs, and plaintext values are NEVER included in any audit log column. See Redaction Rules below.
4. **Immutable actor identity**: `actor_user_id` and `actor_role` are read from the server-side session at request time — never from the request body or client state.
5. **Tamper-evident**: append-only table with no soft-delete; compliance retention minimum 2 years; admin tooling reads but cannot modify.

---

## Table Definition

```sql
CREATE TABLE audit_logs (
  -- Identity
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts               timestamptz NOT NULL DEFAULT now(),

  -- Actor (who performed the action)
  actor_user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
                   -- NULL for system/webhook/background-job actors
  actor_role       text NOT NULL,
                   -- 'user' | 'teacher' | 'admin' | 'support' | 'system' | 'webhook'
  actor_context    text,
                   -- free-form: 'login-page', 'admin-panel', 'billing-webhook', 'worker:expiry'

  -- Action
  action           text NOT NULL,
                   -- namespaced action code (see Action Codes below)

  -- Target resource
  target_type      text NOT NULL,
                   -- entity type: 'user' | 'session' | 'entitlement' | 'bot_config' | ...
  target_id        text NOT NULL,
                   -- UUID or composite key of the affected resource

  -- Request metadata
  ip               inet,
  user_agent       text,
  request_id       uuid,
                   -- correlates to HTTP request-id header for log tracing

  -- Diff (redacted)
  before_redacted  jsonb,
                   -- snapshot of relevant fields BEFORE the change; secrets removed
  after_redacted   jsonb,
                   -- snapshot of relevant fields AFTER the change; secrets removed

  -- Outcome
  result           text NOT NULL,
                   -- 'success' | 'failure' | 'partial'
  failure_reason   text,
                   -- populated only when result='failure'; no secrets or stack traces

  -- Compliance
  retention_class  text NOT NULL DEFAULT 'standard',
                   -- 'standard' (2yr) | 'financial' (7yr) | 'security' (5yr)
  metadata         jsonb
                   -- optional structured extras; secrets blocklist applied before write
);

-- Indexes for admin querying and GDPR exports
CREATE INDEX audit_logs_actor_user_id_idx ON audit_logs (actor_user_id);
CREATE INDEX audit_logs_target_idx        ON audit_logs (target_type, target_id);
CREATE INDEX audit_logs_ts_idx            ON audit_logs (ts DESC);
CREATE INDEX audit_logs_action_idx        ON audit_logs (action);
```

The application role is granted only:
```sql
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.audit_logs FROM wtc_app_role;
GRANT INSERT ON TABLE public.audit_logs TO wtc_app_role;
GRANT SELECT ON TABLE public.audit_logs TO wtc_app_role;
-- No UPDATE, DELETE, TRUNCATE
```

Operational acceptance is checked by `npm run accept:audit:append-only-role`, which connects as the
restricted application role, verifies `SELECT`/`INSERT` are granted and `UPDATE`/`DELETE`/`TRUNCATE`
are not granted on `public.audit_logs`, verifies the role is not elevated and does not own the table,
then writes one safe `system.health_check` probe row. The gate is still NOT RUN for production unless
that command has passed against the intended production role and database in the current session.

> **Schema note**: the implemented `audit_logs` Drizzle schema (`packages/db/src/schema.ts`) uses
> `before`/`after` column names (not `before_redacted`/`after_redacted`). Redaction is applied
> by `packages/audit/src/redact.ts` `redact()` BEFORE the row is written — the column values are
> always already-redacted; the `_redacted` suffix in this doc is a documentation convention only.

---

## Column Definitions

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key; generated server-side |
| `ts` | timestamptz | NO | UTC timestamp of the audit event; set by DB default, not client |
| `actor_user_id` | uuid | YES | FK to `users.id`; NULL for system/webhook actors |
| `actor_role` | text | YES | Role held by actor at time of action (NULL for some system actors) |
| `action` | text | NO | Namespaced action code (see below) |
| `target_type` | text | NO | Entity type affected |
| `target_id` | text | YES | UUID or composite ID of affected entity |
| `ip` | text | YES | Client IP address (NULL for system actors) |
| `user_agent` | text | YES | Raw User-Agent header value, max 512 chars |
| `request_id` | text | YES | Correlation ID from `X-Request-ID` header for log tracing |
| `before` | jsonb | YES | Pre-change field snapshot with secrets removed |
| `after` | jsonb | YES | Post-change field snapshot with secrets removed |
| `result` | text | NO | `'success'` or `'failure'` |
| `retention_class` | text | NO | `'standard'` (2yr), `'financial'` (7yr), `'security'` (5yr) — TARGET; column not yet in schema |

---

## Canonical Action Codes

Action codes follow the pattern `<domain>.<entity_or_verb>` (flat two-part or three-part) as implemented
in `packages/audit/src/audit.ts` `AUDIT_ACTIONS`.

### Implemented action codes (in `AUDIT_ACTIONS`)

These are the values the TypeScript type enforces. Every new action must be added to `AUDIT_ACTIONS`
in `packages/audit/src/audit.ts` before any route may write it.

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `auth.login` | Successful login | security |
| `auth.register` | Successful public account registration | security |
| `auth.login_failed` | Failed login attempt | security |
| `auth.account_unlock` | Admin unlocks a locked or review-required account | security |
| `auth.logout` | User-initiated logout | standard |
| `exchange_key.create` | New exchange API key stored in vault | financial |
| `exchange_key.update` | Exchange API key replaced (re-encrypted) | financial |
| `exchange_key.delete` | Key deleted by user or admin | financial |
| `bot.config_change` | Bot config saved or version created | financial |
| `bot.control_attempt` | Start/stop bot requested (mock phase — no live action) | security |
| `product.grant` | Manual or webhook product entitlement granted | financial |
| `product.revoke` | Manual or webhook product entitlement revoked | financial |
| `tradingview.submit` | User submits TV username for access | standard |
| `tradingview.grant` | Admin grants TradingView access | financial |
| `tradingview.revoke` | Admin revokes TradingView access | financial |
| `education.material_change` | Teacher creates, updates, or deletes a lesson material | standard |
| `education.course_create` | Teacher creates a course | standard |
| `admin.action` | Generic admin action (used when no specific code fits yet) | security |

### Phase-2 additions — add to `AUDIT_ACTIONS` before implementation

These action codes must be added to `packages/audit/src/audit.ts` `AUDIT_ACTIONS` before any route writes
them. All routes that write them must do so in the same DB transaction as the mutation (the in-txn pattern
from `grantProduct` / `submitTvRequest`).

#### Bot configuration (extend existing)

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `bot.config.save` | Bot config saved (new version created; replaces generic `bot.config_change` for new routes) | financial |
| `bot.config.version_delete` | Config version deleted by admin | financial |
| `bot.enable` | Bot enabled (mock only — no live action) | security |
| `bot.disable` | Bot disabled (mock only — no live action) | security |

#### Exchange keys (extend existing)

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `exchange_key.rewrap` | KEK rotation — DEK re-wrapped under new KEK | financial |
| `exchange_key.test` | Exchange connection test performed (key used transiently, not stored in output) | financial |

#### Authentication (extend existing)

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `auth.logout_all` | "Sign out all devices" | security |
| `auth.password_change` | User changes own password | security |
| `auth.password_reset_request` | Password reset link requested | security |
| `auth.password_reset_success` | Password successfully reset via token | security |
| `auth.session_revoke` | Admin revokes a specific session | security |

#### Billing / entitlements (extend existing)

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `product.grace_start` | Entitlement enters grace period | financial |
| `product.expire` | Worker expires an entitlement at end of period | financial |
| `product.refund` | Refund webhook changes state to `refunded` | financial |
| `product.chargeback` | Chargeback webhook changes state to `chargeback` | financial |
| `billing.webhook_received` | Billing webhook payload received | financial |
| `billing.webhook_rejected` | Billing webhook rejected (bad signature or replay) | financial |

#### TradingView (extend existing)

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `tradingview.expire` | Worker expires TradingView grant | financial |

#### Axioma Terminal

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `axioma.account_link_init` | Handoff token / one-time code issued for account linking | security |
| `axioma.account_link_complete` | Account link confirmed | security |
| `axioma.account_link_revoke` | Account link revoked | security |
| `axioma.handoff_jti_consume` | Axioma server consumes a WTC handoff JTI through the WTC Option A route | security |
| `axioma.handoff_jti_replay` | WTC rejects an already-used, unknown, expired, or revoked handoff JTI | security |
| `axioma.handoff_jti_revoke` | WTC revokes outstanding handoff JTIs after entitlement/admin changes | security |
| `axioma.download_request` | User requests a one-time terminal download URL; raw token/hash never included | financial |
| `axioma.release_publish` | Admin publishes new terminal release | standard |
| `terminal.download` | User downloads or attempts to consume a terminal release download token; raw token/hash never included | financial |

#### Education / LMS (extend existing)

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `education.course_update` | Teacher updates course metadata | standard |
| `education.course_publish` | Teacher publishes a course | standard |
| `education.course_delete` | Admin or teacher deletes a course (soft delete) | standard |
| `education.lesson_create` | Teacher creates a lesson | standard |
| `education.lesson_update` | Teacher updates lesson content | standard |
| `education.lesson_delete` | Teacher or admin deletes a lesson | standard |
| `education.material_upload` | Teacher uploads a material; file payload records safe metadata only (`storageProvider`, `hasStorageKey`, `scanStatus`, `hasQuarantineReason`, `retainedUntil`) | standard |
| `education.material_delete` | Teacher or admin soft-deletes a material (`deletedAt` only; no file bytes or storage key in audit) | standard |
| `education.material_cleanup` | Worker hard-deletes expired local/object file rows, completes pending upload object cleanup after eligible cleanup is confirmed, or records pending upload cleanup dead-letter counts; summary counts/provider/cutoff/scope/generic error code only, no cleanup task IDs, material IDs, filenames, hashes, bytes, storage keys, signed URLs, request headers, scanner details, provider responses, or quarantine details | standard |
| `education.material_cleanup_ack` | Admin acknowledges a guarded aggregate cohort of dead-lettered pending-upload cleanup tasks after review; summary count/provider/scope only, `targetId = null`, no cleanup task IDs, object keys, filenames, hashes, signed URLs, request headers, scanner details, provider responses, raw errors, or selected row arrays | standard |
| `education.material_cleanup_retry` | Admin requeues a guarded aggregate cohort of acknowledged dead-lettered pending-upload cleanup tasks for worker retry; summary count/provider/scope only, `targetId = null`, no cleanup task IDs, object keys, filenames, hashes, signed URLs, request headers, scanner details, provider responses, raw errors, or selected row arrays | standard |
| `education.material_download` | Entitled user downloads a clean published file material; audit excludes file bytes and storage key | standard |
| `education.enroll` | User enrolls in a course (entitlement checked before write) | standard |
| `education.progress` | User marks a lesson complete | standard |

#### Terminal / Axioma account link

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `terminal.account_link` | User initiates Axioma account link from WTC | security |
| `terminal.download` | User downloads terminal binary | financial |

#### Support tickets

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `support.ticket_create` | User or support creates a ticket | standard |
| `support.ticket_reply` | Any party replies to a ticket | standard |
| `support.ticket_status_change` | Admin or support changes ticket status | standard |

#### Admin (extend existing)

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `admin.user_role_assign` | Admin assigns role to user | security |
| `admin.user_role_revoke` | Admin removes role from user | security |
| `admin.user_delete` | Admin soft-deletes user account | financial |
| `admin.user_view` | Admin views user profile (optional — for access audit) | security |
| `admin.entitlement_grant` | Admin manually grants product access (more specific than `product.grant`) | financial |
| `admin.entitlement_revoke` | Admin manually revokes product access | financial |

#### System / Worker

| Action code | Trigger | Retention class |
|-------------|---------|-----------------|
| `system.vault_rewrap_batch` | KEK rotation batch job starts | security |
| `system.worker_expiry_run` | Subscription expiry worker runs | standard |
| `system.health_check` | Integration health check result recorded | standard |

---

## Redaction Rules

The following rules MUST be enforced in `packages/audit/src/redact.ts` before any data is written to the
`audit_logs` table. Redaction is applied by calling `redact()` on `before`/`after` payloads inside
`buildEvent()` in `packages/audit/src/audit.ts`.

### Field-name blocklist (applied recursively — currently implemented in `redact.ts`)

Any JSON key matching these patterns (normalized: lowercase, strip `_`, `-`, spaces) has its value
replaced with `"[REDACTED]"`:

```
secret, password, passwordhash, apikey, token, authorization, cookie,
kek, dek, wrappeddek, privatekey, mnemonic, seedphrase
```

### Field-name blocklist additions required before production (TARGET — not yet in `redact.ts`)

Add to `SECRET_HINTS` array in `packages/audit/src/redact.ts`:

```
ciphertext, iv, tag, vaultrecord, sealed, credentials, bearer,
refreshtoken, idtoken, accesstoken, onetimecode
```

`onetimecode` covers the legacy `axioma_account_links.one_time_code` column, and `link_nonce_hash`
must also never appear in audit payloads. Current account-link paths store only hash-only OTC state and
audit link row ids, status, expiry, and failure reasons.

### Value-pattern blocklist

Even if field names pass the blocklist, string values matching these patterns are replaced with `"[REDACTED_VALUE]"`:

- Strings of 32+ hex characters (likely raw keys or tokens)
- Strings starting with `Bearer ` or `Basic `
- Strings matching the PHC hash format `$argon2id$...`
- Strings matching the `$2b$` bcrypt format

### Before/after snapshot rules

- `before_redacted` and `after_redacted` capture ONLY the fields relevant to the action. They do NOT capture full row dumps.
- For `exchange_key.create`: `before = null`, `after = { label, key_mask, key_id }`.
- For `product.grant`: `before = { state: 'none' }`, `after = { state: 'active', product_code, plan_code, expires_at }`.
- For `auth.register`: `before = null`, `after = { roles, hasDisplayName }`; never include email, password, password hash, or session token material.
- For `auth.account_unlock`: `before` and `after` may include only lockout state fields
  (`failedLogin15mCount`, `failedLogin15mResetAt`, `failedLogin60mCount`, `failedLogin60mResetAt`,
  `failedLoginTotalCount`, `lastFailedLoginAt`, `accountLockedUntil`, `accountLockoutReviewRequiredAt`),
  plus `after.unlocked = true` and the validated admin `reason`. Never include email, password/password hash,
  session/token material, raw submitted identifiers, IP/user-agent, stack traces, or full user-row dumps.
- For `bot.config.save`: `before = { version }`, `after = { version }`. No raw config JSON.
- For `education.course_create`: `before = null`, `after = { title, published }`.
- For `tradingview.submit`: `after = { status: 'pending', tradingViewUsername }` (TV username is a public handle, not a secret).
- `failure_reason` is a category string (e.g. `'invalid_credentials'`, `'account_locked'`, `'signature_mismatch'`). No exception message, no stack trace.

### What is NEVER in audit logs

- Raw exchange API keys or secrets
- Argon2id password hashes
- CSRF tokens
- Session tokens or their hashes
- AES IVs, tags, DEKs, or wrapped DEKs
- The `sealed` jsonb blob or any part of it
- User passwords in any form
- Plaintext content of vault records
- OAuth tokens or refresh tokens
- Axioma one-time linking codes
- Payment provider webhook raw bodies (log metadata only: event_type, provider_event_id)
- Full HTTP request/response bodies

---

## Sample Audit Log Rows

### auth.login

```json
{
  "id": "a1b2c3d4-...",
  "ts": "2026-05-30T10:23:44.123Z",
  "actor_user_id": "u-abc123",
  "actor_role": "user",
  "action": "auth.login",
  "target_type": "session",
  "target_id": "s-xyz789",
  "ip": "203.0.113.42",
  "user_agent": "Mozilla/5.0 ...",
  "request_id": "r-dead1234",
  "before": null,
  "after": { "session_created": true },
  "result": "success"
}
```

### exchange_key.create

```json
{
  "id": "b2c3d4e5-...",
  "ts": "2026-05-30T10:25:00.000Z",
  "actor_user_id": "u-abc123",
  "actor_role": "user",
  "action": "exchange_key.create",
  "target_type": "exchange_api_key_secret",
  "target_id": "k-key001",
  "before": null,
  "after": {
    "label": "Main BingX Key",
    "key_mask": "••••••••1234",
    "key_id": "kek-dev"
  },
  "result": "success"
}
```

### product.grant

```json
{
  "id": "c3d4e5f6-...",
  "ts": "2026-05-30T11:00:00.000Z",
  "actor_user_id": "u-admin001",
  "actor_role": "admin",
  "action": "product.grant",
  "target_type": "entitlement",
  "target_id": "u-user007:axioma_terminal",
  "before": { "state": "none" },
  "after": {
    "state": "active",
    "product_code": "axioma_terminal"
  },
  "result": "success"
}
```

### bot.config.save

```json
{
  "id": "d4e5f6a7-...",
  "ts": "2026-05-30T12:00:00.000Z",
  "actor_user_id": "u-abc123",
  "actor_role": "user",
  "action": "bot.config.save",
  "target_type": "bot_config",
  "target_id": "bc-version002",
  "before": { "version": 1 },
  "after": { "version": 2 },
  "result": "success"
}
```

---

## Retention and Archival

| Retention class | Minimum retention | Action at expiry |
|----------------|-------------------|-----------------|
| `standard` | 2 years | Move to cold storage (S3/GCS archive) |
| `security` | 5 years | Move to cold storage; keep index in hot DB |
| `financial` | 7 years | Move to cold storage; compliance archive; legal hold capable |

Audit rows are NEVER hard-deleted within their retention window. After the window, rows are deleted only
by an explicit archival/compliance job, with its own meta-audit entry.

---

## Access to Audit Logs

| Role | Access |
|------|--------|
| `admin` | Full read via `/api/admin/audit-log`; filter by actor, target, action, date range |
| `support` | Read-only view via `/api/admin/audit-log` (same endpoint, scoped by role middleware) |
| `user` | Own audit entries only via `/api/me/audit` (login events, key events, entitlement events for own account) |
| `teacher` | Own course/material audit events only |
| Drizzle ORM DB user `wtc_app_role` | INSERT + SELECT only |

No role has DELETE, UPDATE, or TRUNCATE on `audit_logs`.
