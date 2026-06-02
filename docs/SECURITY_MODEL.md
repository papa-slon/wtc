# Security Model — WTC Ecosystem Platform

> Status: Phase 0 design document. Governs all implementation.
> Owner: ecosystem-security-auditor
> Last updated: 2026-05-29

Related docs:
- [RBAC_MATRIX.md](./RBAC_MATRIX.md)
- [SECRET_VAULT_DESIGN.md](./SECRET_VAULT_DESIGN.md)
- [AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md)
- [AXIOMA_HANDOFF_TOKEN_SPEC.md](./AXIOMA_HANDOFF_TOKEN_SPEC.md)

---

## 1. Password Hashing

### Algorithm: Argon2id

WTC uses **Argon2id** (the hybrid mode recommended by OWASP and RFC 9106 for general web auth). It provides resistance to both side-channel and GPU brute-force attacks.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Variant | `argon2id` | Hybrid: side-channel + GPU resistance |
| Memory cost `m` | **65536 KiB (64 MiB)** | OWASP recommended minimum for Argon2id |
| Time cost `t` | **3** iterations | Minimum 3 per RFC 9106 §4 |
| Parallelism `p` | **2** | Matches typical dual-core available in Docker container; scale to `4` in production with headroom |
| Salt length | **16 bytes** — cryptographically random via `crypto.getRandomValues` | Per-hash unique |
| Hash output length | **32 bytes** | Sufficient collision resistance |
| Stored format | PHC string `$argon2id$v=19$m=65536,t=3,p=2$<base64-salt>$<base64-hash>` | Self-describing, enables future parameter migration |

**Implementation package**: `@node-rs/argon2` (native binding, no WASM overhead on server).

### Rules

- Hashing occurs only in `packages/auth/src/password.ts` — never inline in routes or server actions.
- The raw password is **never stored**, logged, or passed across module boundaries after the hash call returns.
- Timing-safe comparison via the library's built-in verify (constant-time).
- On parameter upgrade: re-hash on next successful login (verify old hash, store new hash silently). Old parameters remain decodable from the PHC string.

---

## 2. Session Model

### Session type: opaque random token

WTC does **not** use JWT for browser sessions. Sessions are opaque tokens stored server-side. This prevents session content inspection by the client, simplifies revocation, and eliminates JWT algorithm confusion attacks.

### Token generation

```
sessionId = crypto.randomBytes(32) → hex string (64 chars)
stored in cookie as-is; server stores SHA-256(sessionId) in `sessions` table
```

The cookie value is the raw token. The DB stores `session_token_hash = SHA-256(token)` so a DB dump cannot be replayed without also forging the hash pre-image.

### Cookie attributes

| Attribute | Value | Why |
|-----------|-------|-----|
| `HttpOnly` | `true` | No JS access; XSS cannot steal it |
| `Secure` | `true` | HTTPS-only (enforced; see §6) |
| `SameSite` | `Lax` | CSRF protection for top-level navigations; allows OAuth redirect flows |
| `Path` | `/` | Full site scope |
| `Max-Age` | `86400` (24h) for regular login; `2592000` (30d) if user checks "Remember me" | Short default; explicit opt-in for long session |
| `Domain` | NOT set (same-origin only) | Prevent cross-subdomain leakage |
| Name | `__Host-wtc_session` | `__Host-` prefix enforces `Secure`, no `Domain`, `Path=/` per RFC 6265bis |

### Server-side session record (table `sessions`)

```sql
sessions (
  id              uuid primary key,
  session_token_hash  char(64) not null unique,  -- SHA-256(raw token), hex
  user_id         uuid not null references users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now(),
  expires_at      timestamptz not null,
  ip_created      inet,
  user_agent      text,
  is_revoked      boolean not null default false
)
```

Index on `(session_token_hash)` for O(1) lookup.
Index on `(user_id)` for "list active sessions" and "revoke all" operations.

### Session lifecycle

| Event | Action |
|-------|--------|
| Login | New token generated; row inserted; old tokens from same user-agent are NOT automatically invalidated (multi-device support); each device has its own row |
| Request | `session_token_hash` looked up; `last_active_at` updated; `expires_at` checked; `is_revoked` checked |
| Password change | All existing sessions for the user are marked `is_revoked = true` and `expires_at = now()` |
| Logout | Current session row is marked `is_revoked = true` |
| "Sign out all devices" | All rows for `user_id` are marked `is_revoked = true` |
| Token rotation | On each successful request the session `expires_at` is **not** extended by default; extension only happens on explicit keep-alive calls or when `last_active_at` threshold is crossed. This prevents infinite session sliding. |
| Expiry cleanup | Background worker deletes expired/revoked sessions older than 7 days (keeping an audit trail for 7 days) |

### Session rotation on privilege change

Any time a user's role is elevated (e.g. granted `admin`) or an entitlement is granted/revoked, the session remains valid but the session's cached role/entitlement data is **re-fetched from DB on every request** — there is no in-memory role cache that persists between requests. RBAC checks are always DB-authoritative.

---

## 3. CSRF Protection - session-bound hidden-field token

Current server actions use a session-bound synchronizer token derived from the session cookie and `SESSION_SECRET`; no extra CSRF cookie is issued for this path.

### Flow

1. Authenticated mutating forms render `<CsrfField />`.
2. `apps/web/src/lib/csrf.tsx` derives `HMAC-SHA256("csrf:" + sessionToken, SESSION_SECRET)`.
3. The hidden `csrf` form field is submitted with the server action.
4. The receiving action calls `assertCsrf(formData)`, recomputes the expected token from the current session cookie, and verifies it constant-time through `@wtc/auth`.
5. If the token is missing, stale, or mismatched, the action fails closed with `403` before business logic runs.

### Scope

- Authenticated mutating server actions must call `assertCsrf(formData)`.
- Pre-session `loginAction` and `registerAction` are intentionally exempt; they are protected by validation plus auth POST rate limiting.
- GET requests are intentionally side-effect-free.

### Token binding

The active web CSRF token is bound to the current session cookie and rotates naturally when the session token changes on login/logout.

---

## 4. Auth Rate-Limiting

Auth rate limiting is split between the current app middleware layer and the DB-backed login lockout layer:

### Layer 1 — IP-based (nginx / middleware)

Target production nginx upstream config:

```
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
limit_req zone=auth burst=5 nodelay;
```

This blocks 10 requests/minute per IP with a burst of 5 for legitimate quick retries.

### Layer 2 — Account-specific login lockout

For account-specific lockout (preventing distributed IP attacks against a known user), the target model tracks failed attempts in the `users` table:

```
failed_login_15m_count                 integer not null default 0
failed_login_15m_reset_at              timestamptz
failed_login_60m_count                 integer not null default 0
failed_login_60m_reset_at              timestamptz
failed_login_total_count               integer not null default 0
last_failed_login_at                   timestamptz
account_locked_until                   timestamptz
account_lockout_review_required_at     timestamptz
```

| Threshold | Action |
|-----------|--------|
| 5 failed attempts within 15 min | Temporary lockout: 15 minutes |
| 10 failed attempts within 60 min | Lockout: 60 minutes |
| 20 failed attempts total | Account flagged for admin review; email notification still target-only |
| Lockout bypass | Cannot be bypassed from client; admin can unlock via admin panel (audit logged) |

Current implementation note: Phase 3.43 added the login lockout state columns, pure policy in
`packages/auth/src/login-lockout.ts`, transactional DB login attempts in `packages/db/src/repositories.ts`, and memory-mode
parity in `apps/web/src/lib/demo.ts`. Phase 3.44 added local admin unlock via `nextAdminUnlockState()` and
`unlockUserLoginLockout()`: the DB transaction row-locks the target user, clears failed-login, lockout, and review state, and
writes `auth.account_unlock` with safe before/after lockout state plus the validated admin reason. The `/admin/users` page
projects only admin-safe lockout fields and submits through a CSRF-protected admin server action. The `/login` server action
delegates to `attemptLogin()` and redirects wrong password, unknown account, and locked account outcomes to the same generic
`invalid_credentials` browser code. Failed and locked login attempts write `auth.login_failed` audit rows through the
backend/DB path; unknown-account audit target fields do not persist the raw submitted identifier. Phase 3.45 added local
registration audit logging: the DB-backed public registration path opts into an in-transaction `auth.register` row from
`createUser()`, and demo mode mirrors the event. The audit payload is limited to non-secret metadata (`roles`,
`hasDisplayName`) and does not include email, password, password hash, or session token material.

Still target-only / not run: email notification, password-reset/change/verify-email route lockout, production
nginx/shared-store proof, production database rollout, active real-Postgres admin-unlock race proof, live production
deploy, and CI. Append-only audit DB role verification now has an opt-in local acceptance command
(`npm run accept:audit:append-only-role`) but remains NOT RUN for production until the operator supplies the intended
restricted DB role URL and explicitly approves the target.

### Endpoints covered

| Endpoint | Limit type |
|----------|-----------|
| `POST /login` (Next server-action form post) | IP middleware (10r/min current) + DB-backed account lockout |
| `POST /register` (Next server-action form post) | IP only (10r/min current); successful DB-backed registration audits `auth.register` |
| `POST /api/auth/reset-password` | Target only; route not implemented |
| `POST /api/auth/change-password` | Target only; route not implemented |
| `POST /api/auth/verify-email` | Target only; route not implemented |

### Response

Rate-limited responses return `429 Too Many Requests` with `Retry-After` header and generic copy. Login and registration page error rendering maps only stable error codes; arbitrary query-string error text is not displayed. No information about whether the account exists is disclosed.

---

## 5. Server-Side RBAC Enforcement Points

RBAC is **always** enforced server-side. Client-side role checks are for UX only (hiding links) and cannot be the sole gate. The single authoritative check lives in `packages/auth/src/rbac.ts`.

### Enforcement architecture

```
Request → Route Handler / Server Action
           ↓
           getSession(request) → SessionResult | null
           ↓
           requireAuth(session)          -- throws 401 if no session
           ↓
           requireRole(session, role[])  -- throws 403 if role mismatch
           ↓
           requireEntitlement(userId, productCode) -- throws 403 if not entitled
           ↓
           requireOwnership(resourceOwnerId, userId) -- for teacher/content checks
           ↓
           Business logic
```

### Role enforcement per namespace

| Route namespace | Required roles | Notes |
|----------------|----------------|-------|
| `GET /api/me` | any authenticated | Returns own data only |
| `GET /api/products/*` | public | Entitlement check for gated content |
| `GET /api/entitlements/*` | `user` (own) | Admin can access any user's |
| `POST /api/entitlements/grant` | `admin` | Audit required |
| `DELETE /api/entitlements/revoke` | `admin` | Audit required |
| `GET /api/bots/*` | `user` + active entitlement | Own bot only |
| `PATCH /api/bots/*/config` | `user` + active entitlement | Config writes audit-logged |
| `GET /api/axioma/*` | `user` + `axioma_terminal` entitlement | |
| `GET /api/tradingview-access/*` | `user` (own) / `admin` (all) | |
| `POST /api/admin/*` | `admin` | Every admin write is audit logged |
| `GET /api/admin/*` | `admin` or `support` | Support: read-only subset |
| `POST /api/teacher/*` | `teacher` + ownership | Object-ownership enforced |
| `GET /api/audit/*` | `admin` | |

### Object ownership (teacher)

Teacher routes enforce that the authenticated user is the `owner_user_id` of the resource:

```typescript
// packages/auth/src/rbac.ts
export function requireOwnership(
  resourceOwnerId: string,
  actorUserId: string,
  actorRoles: Role[]
): void {
  if (actorRoles.includes('admin')) return; // admin bypass
  if (resourceOwnerId !== actorUserId) {
    throw new ForbiddenError('You do not own this resource');
  }
}
```

### Student non-enumeration

Education APIs enforce that hidden/unentitled content is **never returned** in list responses:

- `GET /api/education/courses` returns only courses where `is_published = true AND (is_free OR user has active education entitlement)`.
- Hidden courses (`is_published = false`) are never included in student queries at the SQL level — not filtered post-fetch.
- Unpublished lessons within a published course return 404 (not 403) to avoid confirming existence.

### Admin override audit requirement

Any admin action that overrides a user's normal access (grant, revoke, unlock, impersonate-view) MUST write an audit log row before the action is committed. If the audit write fails, the action is rolled back. This is enforced by the transaction pattern:

```typescript
await db.transaction(async (tx) => {
  await auditLog.write(tx, { action: 'admin.entitlement.grant', ... });
  await entitlements.grant(tx, { ... });
});
```

---

## 6. Transport Security and HTTP Headers

### TLS / HSTS

- All traffic over TLS 1.2+ (TLS 1.3 preferred). TLS 1.0/1.1 disabled at nginx.
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - 2-year HSTS; includes subdomains; submitted to HSTS preload list after stable production domain confirmed.

### Content Security Policy

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{SERVER_NONCE}';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://cdn.axi-o.ma;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://axi-o.ma;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
```

- `nonce-{SERVER_NONCE}` is a per-request random value injected into Next.js middleware and stamped onto all `<script>` tags.
- `style-src 'unsafe-inline'` is a pragmatic concession for Tailwind CSS v4 at MVP; to be tightened to nonce-only in Phase 3.
- `frame-ancestors 'none'` prevents clickjacking.
- `upgrade-insecure-requests` ensures mixed content is upgraded.

### Additional headers

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (redundant with CSP frame-ancestors but belt-and-suspenders) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

These are set in `apps/web/src/middleware.ts` via Next.js middleware and confirmed at nginx level.

---

## 7. Input Validation with Zod

All inputs are validated at **every boundary** — not just the form, but at the route handler/server action level, independent of client-side validation.

### Schema location

- `packages/shared/src/schemas/` — canonical Zod schemas for all domain objects.
- Route handlers import from `packages/shared`; they never define their own inline schemas.
- Client forms use the same schemas (via shared package) for consistent error messages.

### Validation pattern

```typescript
// Example: POST /api/bots/config
import { botConfigUpdateSchema } from '@wtc/shared/schemas/bot';

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = botConfigUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }
  // parsed.data is type-safe from here
}
```

### Rules

- `.safeParse()` is used everywhere; `.parse()` (throws) only in migration scripts where errors are fatal.
- All string inputs are `.trim()`'d before validation.
- Exchange API key fields are validated for format (length, allowed characters) but NOT for validity against the exchange (that requires a live API call handled separately).
- Numeric fields (leverage, risk percent) have explicit `.min()` and `.max()` bounds matching product safety rules.
- No `z.any()` or `z.unknown()` in production schemas without explicit justification.
- Zod error messages are sanitized before returning to clients — internal field paths are included only for `user`-facing form errors, not for `admin`/`teacher` endpoints where the path could hint at schema structure.

---

## 8. STRIDE Threat Model

| Threat | Category | Affected Component | Mitigation |
|--------|----------|--------------------|------------|
| Session token theft via XSS | **Spoofing** | Auth cookie | `HttpOnly` prevents JS access; CSP nonce blocks injected scripts |
| Session token theft via network | **Spoofing** | Auth cookie | `Secure` flag; TLS only; HSTS preload |
| Credential brute-force | **Spoofing** | `POST /login` | Argon2id (slow); IP rate-limit; DB-backed account lockout for login; production shared-store/nginx proof still required |
| JWT algorithm confusion | **Spoofing** | Axioma handoff token | Explicit `alg: 'ES256'` header validation; no HS256/none accepted |
| CSRF — state-changing request from third-party | **Tampering** | Authenticated mutating server actions | `SameSite=Lax`; session-bound hidden-field CSRF token verified by each action |
| Request body tampering | **Tampering** | All API routes | Zod schema validation at route boundary |
| SQL injection | **Tampering** | DB queries | Drizzle ORM parameterized queries; no raw SQL with string interpolation |
| Exchange API key exfiltration via API response | **Information Disclosure** | `/api/bots/*/keys` | Keys never returned in any API response; masked in UI; AES-256-GCM vault |
| Exchange API key exfiltration via logs | **Information Disclosure** | Any logger call | Structured logger has key-field redaction list; audit log redacts `*_secret` fields |
| Admin audit log tampering | **Tampering** | `audit_logs` table | Append-only (no UPDATE/DELETE permissions granted to app DB user); immutable row design |
| Horizontal privilege escalation (user A accesses user B's data) | **Elevation of Privilege** | Any user-scoped API | All queries parameterized on `userId` from session (not request body); no trusting client-supplied userId |
| Vertical privilege escalation (user claims admin role) | **Elevation of Privilege** | RBAC middleware | Roles read from DB session join; client cannot supply or modify roles |
| Teacher edits another teacher's course | **Elevation of Privilege** | Education API | `requireOwnership()` check on every teacher mutation; admin-only bypass is audited |
| Student enumerates hidden lessons | **Information Disclosure** | Education API | SQL WHERE filters `is_published = true` before fetch; 404 not 403 for unpublished |
| Replay of Axioma handoff token | **Spoofing** | Axioma bridge | `jti` nonce checked against Redis/DB revocation set; 5-minute TTL; one-time use |
| DoS via slow Argon2id on login | **Denial of Service** | Auth service | IP rate-limit at nginx (10r/min) limits blast radius; Argon2id runs in worker thread pool not event loop |
| Bot control command injection | **Tampering** | Bot adapter | Bot controls are mock-only until audited; no live SSH/systemd calls from WTC |
| Secrets in git/logs/fixtures | **Information Disclosure** | Entire codebase | `.gitignore` for `.env`; structured logger redaction; no fixtures with real keys; CI checks for secret patterns |
| Chargeback/refund entitlement bypass | **Elevation of Privilege** | Entitlements + billing webhook | Webhook signature verified; `chargeback` state immediately fails-closed; state machine enforced in `packages/entitlements` |
| SSRF via bot adapter URL | **Tampering** | Bot adapters | Adapter URLs are config-only (env); never user-supplied; allowlist enforced |
| Open redirect after login | **Spoofing** | Auth login redirect | Redirect target validated against allowlist of internal paths; no external URL redirects |
| TradingView credential stuffing | **Tampering** | TV access workflow | TV username collected only; no WTC-held TV credentials; no browser automation in production path |
