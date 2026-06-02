# ecosystem-security-auditor handoff

_Epoch 20260530-0925. Phase 2.1 — implementation-readiness verification. Read-only audit. No code changed._

## Scope

Verify current code against the Phase-2 design handoff (20260530-0126) before any Phase-2.1 route is
written. Produce the exact operator additions required — paste-ready — for:

1. `AUDIT_ACTIONS` additions in `packages/audit/src/audit.ts`
2. `SECRET_HINTS` additions in `packages/audit/src/redact.ts`
3. `Resource` type additions in `packages/auth/src/rbac.ts`
4. Per-mutation canonical security pipeline (all Phase-2.1 areas)
5. No-plaintext rule verification (bot config, exchange key mask, one_time_code, product_access_events,
   bot_safety_events, Axioma ES256/HS256)
6. Security regression test specification

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-security-auditor.md` (prior design handoff — authoritative)
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/auth/src/rbac.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/session.ts`
- `apps/web/src/lib/access.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`

## Files changed

None — read-only audit (this handoff only).

## Findings

### F1 — CRITICAL: AUDIT_ACTIONS missing all Phase-2.1 codes; type union is not exhaustive for new routes

**Severity**: Critical — a route that writes an action code not present in `AUDIT_ACTIONS` will produce a
TypeScript type error and, if bypassed with a cast, will write an unrecognised string into the append-only
audit log. There is no runtime enforcement fallback once the type check is defeated.

**Evidence**: `packages/audit/src/audit.ts:8-25` — the array contains exactly 16 entries (the Phase-1.7
set). None of the Phase-2 codes listed in the design handoff are present. The `AuditAction` union is
derived directly from `AUDIT_ACTIONS as const`, so it is structurally exhaustive over only those 16
strings.

**Recommendation**: Add all Phase-2.1 codes listed in the Decisions section below before any Phase-2
route is written. The operator must paste the additions verbatim; partial additions create a window where
some routes can compile and others cannot, producing inconsistent audit coverage.

---

### F2 — CRITICAL: SECRET_HINTS missing 11 production-required entries; vault and one-time-code fields unredacted

**Severity**: Critical — if a vault-material field name (e.g. `sealed`, `iv`, `tag`) or the Axioma
one-time code field (`onetimecode`) ever appears in a `before`/`after` payload that reaches `buildEvent`,
`redact()` will pass it through verbatim to the append-only `audit_logs` table. The audit log has no
update path; a leaked field cannot be removed.

**Evidence**: `packages/audit/src/redact.ts:5-19` — current SECRET_HINTS array: `secret, password,
passwordhash, apikey, token, authorization, cookie, kek, dek, wrappeddek, privatekey, mnemonic,
seedphrase`. Missing: `ciphertext`, `iv`, `tag`, `vaultrecord`, `sealed`, `credentials`, `bearer`,
`refreshtoken`, `idtoken`, `accesstoken`, `onetimecode`.

**Cross-check against schema**: `packages/db/src/schema.ts:114` — `exchangeApiKeySecrets.sealed` is a
jsonb field whose field name `sealed` is not in the current SECRET_HINTS. `packages/db/src/schema.ts:142`
— `axiomaAccountLinks.oneTimeCode` maps to JSON key `oneTimeCode`; the normalised form is `onetimecode`,
which is not in SECRET_HINTS.

**Recommendation**: Add all 11 entries listed in the Decisions section before any vault-adjacent route or
Axioma linking route is built. The additions are blocking for production deployment.

---

### F3 — HIGH: Resource type in rbac.ts missing 6 Phase-2 resource tokens

**Severity**: High — Phase-2 route handlers that reference a resource not in the `Resource` union will
either fail TypeScript compilation or fall through to the `admin.action` catchall, losing fine-grained
RBAC visibility and making the RBAC matrix non-exhaustive at runtime.

**Evidence**: `packages/auth/src/rbac.ts:9-20` — `Resource` union contains 11 entries. Missing:
`lesson`, `enrollment`, `bot_instance`, `exchange_account`, `terminal_account_link`,
`support_ticket_reply`. The MATRIX object has no entry for these, so `can(roles, 'lesson', 'create')`
returns `false` for all roles — a silent deny rather than a type error.

**Recommendation**: Add the 6 resource tokens (listed in Decisions below) AND the corresponding MATRIX
entries before Phase-2 routes that gate on them are written.

---

### F4 — HIGH: addExchangeKey in repositories.ts does not write an in-transaction audit row

**Severity**: High — the `grantProduct`, `revokeProduct`, `submitTvRequest`, `grantTv`, `revokeTv`, and
`createCourse` functions all follow the in-txn audit pattern correctly. `addExchangeKey`
(`packages/db/src/repositories.ts:167-182`) does NOT write an audit row inside its transaction. A key
can be sealed and persisted with no corresponding `exchange_key.create` audit entry.

**Evidence**: `packages/db/src/repositories.ts:173-181` — the transaction inserts into
`exchangeAccounts` and `exchangeApiKeySecrets` but contains no `tx.insert(s.auditLogs)` call.

**Recommendation**: Before any Phase-2 exchange-key route ships, the operator must add the in-txn audit
insert to `addExchangeKey`, passing `after: { label, key_mask, key_id }` only — no sealed blob, no IV,
no ciphertext. This is a blocking gap: a key operation with no audit trail violates the design contract
in AUDIT_LOG_SCHEMA.md and the hard rule in AGENTS.md ("every mutation … audit log").

---

### F5 — HIGH: bot_safety_events and bot_config_versions tables absent from schema; Phase-2 mutation targets have no backing tables

**Severity**: High — the Phase-2 design describes mutations for `bot.config.save` (creates a new bot
config version), `bot.enable`/`bot.disable` (writes to `bot_safety_events`), and product/terminal
download events (`product_access_events`, `terminal_download_events`, `terminal_license_events`). None
of these tables are present in `packages/db/src/schema.ts`.

**Evidence**: `packages/db/src/schema.ts` — tables present for bots: `botInstances`, `botConfigs`. No
`botConfigVersions`, `botSafetyEvents`, `productAccessEvents`, `terminalDownloadEvents`,
`terminalLicenseEvents` table. The seed document (`0000-orchestrator-seed.md:94`) lists them as part of
the bounded-context table names, but they were not scaffolded in the initial schema.

**Recommendation**: The operator must add migration(s) for these tables before the routes that write to
them are implemented. Routes must not be written against non-existent tables.

---

### F6 — MEDIUM: deriveSessionCsrfToken (synchronizer variant) and double-submit verifyCsrf are both implemented; production selection is not enforced

**Severity**: Medium — `packages/auth/src/csrf.ts` exports both `verifyCsrf` (double-submit: compares
cookie token to header token) and `deriveSessionCsrfToken` (synchronizer: HMAC of session token + server
secret). The design doc (SECURITY_MODEL.md §3) specifies double-submit only. A route that
accidentally uses `deriveSessionCsrfToken` without the matching verifier, or mixes the two, could create
a CSRF bypass.

**Evidence**: `packages/auth/src/csrf.ts:14-31` — both functions exported. No production-enforced
selection. The design doc calls `verifyCsrf` the correct one ("server middleware validates:
X-CSRF-Token header value matches the CSRF cookie value").

**Recommendation**: Document in a code comment inside `csrf.ts` that only `verifyCsrf` (double-submit)
is the approved production path. `deriveSessionCsrfToken` is an alternative implementation available for
future consideration; it must not be used in Phase-2 routes unless the design doc is explicitly updated.

---

### F7 — MEDIUM: axioma_account_links.oneTimeCode stored plaintext; no enforcement of 5-min TTL or single-use at repository layer

**Severity**: Medium — the 5-min TTL + single-use + no-audit-log constraints documented in the design
handoff (20260530-0126, F5) are correct policy, but there is no repository function that enforces them.
The schema column (`packages/db/src/schema.ts:142`) has `oneTimeCode: text('one_time_code')` and
`codeExpiresAt`. The check that a code is not expired and that it is nulled on consumption must be in
the repository or route, not left to ad-hoc inline logic.

**Recommendation**: When the Axioma account-link route is built, the repository function that consumes
the code must: (a) check `codeExpiresAt > now()` inside the same transaction that nulls the code, and
(b) return an error if the code is already null (single-use enforcement). The route must never return
the code after the link is complete, and the audit row must not include the code value (blocked by
`onetimecode` in SECRET_HINTS once F2 is fixed).

---

### F8 — LOW: AUDIT_LOG_SCHEMA.md lists terminal.account_link and axioma.account_link_init as two separate codes for the same event

**Severity**: Low — the design handoff Phase-2 additions table in AUDIT_LOG_SCHEMA.md includes both
`terminal.account_link` and `axioma.account_link_init` for what appears to be the same trigger ("user
initiates Axioma account link from WTC"). This creates ambiguity: implementers may write one, the other,
or both.

**Evidence**: `docs/AUDIT_LOG_SCHEMA.md:200-227` — `axioma.account_link_init` in the Axioma section and
`terminal.account_link` in the "Terminal / Axioma account link" section appear to cover the same event.

**Decision (below)**: Use `axioma.account_link_init` exclusively for the WTC-side init step. Drop
`terminal.account_link` as a duplicate. `axioma.download_request` covers the download step; `terminal.download`
is also a duplicate. Only `axioma.*` codes are canonical for Axioma product events.

---

### F9 — LOW: repositories.ts grantProduct/revokeProduct do not propagate actorUserId; audit row has actorRole='admin' but null actorUserId

**Severity**: Low — `grantProduct` (`packages/db/src/repositories.ts:143`) writes `actorRole: 'admin'`
but does not accept or record `actorUserId`. An admin's identity in the `audit_logs` row will be null,
reducing the forensic value of the row.

**Recommendation**: `grantProduct` and `revokeProduct` signatures should accept an optional `actorUserId`
parameter passed from the route handler (which has the session). This is a Phase-2 quality fix, not a
blocker, but it must be resolved before admin entitlement routes are considered complete.

---

## Decisions

### D1 — Exact AUDIT_ACTIONS additions (paste into packages/audit/src/audit.ts)

The operator must replace the existing `AUDIT_ACTIONS` array with this extended version. The existing 16
entries are kept; the Phase-2 additions follow. The `AuditAction` type derives automatically from the
`as const` array — no separate type edit is needed.

```typescript
export const AUDIT_ACTIONS = [
  // --- Phase 1 (implemented) — do not remove ---
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'exchange_key.create',
  'exchange_key.update',
  'exchange_key.delete',
  'bot.config_change',
  'bot.control_attempt',
  'product.grant',
  'product.revoke',
  'tradingview.submit',
  'tradingview.grant',
  'tradingview.revoke',
  'education.material_change',
  'education.course_create',
  'admin.action',

  // --- Phase 2 additions — add before any Phase-2 route writes them ---

  // Bot configuration (granular replacements for bot.config_change / bot.control_attempt)
  'bot.config.save',            // new bot config version created
  'bot.config.version_delete',  // admin deletes a config version
  'bot.enable',                 // mock enable request recorded
  'bot.disable',                // mock disable request recorded

  // Exchange keys
  'exchange_key.rewrap',        // KEK rotation — DEK re-wrapped under new KEK
  'exchange_key.test',          // connection test performed (key used transiently, not in output)

  // Authentication
  'auth.logout_all',            // sign-out-all-devices
  'auth.password_change',       // user changes own password
  'auth.password_reset_request', // reset link requested
  'auth.password_reset_success', // reset completed
  'auth.account_unlock',        // admin unlocks locked account
  'auth.session_revoke',        // admin revokes a specific session

  // Billing / entitlements
  'product.grace_start',        // entitlement enters grace period
  'product.expire',             // worker expires entitlement
  'product.refund',             // refund webhook applied
  'product.chargeback',         // chargeback webhook applied
  'billing.webhook_received',   // webhook payload accepted
  'billing.webhook_rejected',   // webhook rejected (bad sig or replay)

  // TradingView
  'tradingview.expire',         // worker expires TV grant

  // Axioma Terminal (canonical codes — terminal.account_link / terminal.download are DROPPED as duplicates)
  'axioma.account_link_init',      // one-time code issued for linking
  'axioma.account_link_complete',  // link confirmed by Axioma callback
  'axioma.account_link_revoke',    // link revoked
  'axioma.download_request',       // user requests signed download URL
  'axioma.release_publish',        // admin publishes new release

  // Education / LMS (granular replacements for education.material_change)
  'education.course_update',    // teacher updates course metadata
  'education.course_publish',   // teacher publishes course
  'education.course_delete',    // admin or teacher soft-deletes course
  'education.lesson_create',    // teacher creates lesson
  'education.lesson_update',    // teacher updates lesson
  'education.lesson_delete',    // teacher or admin deletes lesson
  'education.material_upload',  // teacher uploads material (create)
  'education.material_delete',  // teacher or admin deletes material
  'education.enroll',           // user enrolls in course (entitlement checked first)
  'education.progress',         // user marks lesson complete

  // Support tickets
  'support.ticket_create',         // ticket opened
  'support.ticket_reply',          // reply added
  'support.ticket_status_change',  // admin/support changes status

  // Admin (granular replacements for admin.action)
  'admin.user_role_assign',     // role granted to user
  'admin.user_role_revoke',     // role removed from user
  'admin.user_delete',          // account soft-deleted
  'admin.user_view',            // admin views user profile (access audit)
  'admin.entitlement_grant',    // admin manually grants access (more specific than product.grant)
  'admin.entitlement_revoke',   // admin manually revokes access

  // System / worker
  'system.vault_rewrap_batch',  // KEK rotation batch job start
  'system.worker_expiry_run',   // subscription expiry worker run
  'system.health_check',        // integration health check recorded
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
```

Total: 16 existing + 48 additions = 64 codes. The type union remains exhaustive over the array;
TypeScript will error at the call site if an unlisted string is passed to `action`.

---

### D2 — Exact SECRET_HINTS additions (paste into packages/audit/src/redact.ts)

Replace the existing `SECRET_HINTS` array with this extended version. The existing 13 entries are kept;
11 entries are added.

```typescript
const SECRET_HINTS = [
  // --- Phase 1 (implemented) — do not remove ---
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

  // --- Phase 2 additions ---
  'ciphertext',    // generic ciphertext field
  'iv',            // AES-GCM initialisation vector
  'tag',           // AES-GCM authentication tag
  'vaultrecord',   // legacy vault record shape
  'sealed',        // exchange_api_key_secrets.sealed jsonb (vault envelope)
  'credentials',   // generic credentials object
  'bearer',        // Bearer token values
  'refreshtoken',  // OAuth / Axioma refresh token
  'idtoken',       // OAuth ID token
  'accesstoken',   // OAuth access token
  'onetimecode',   // axioma_account_links.one_time_code — MUST NEVER appear in audit
];
```

The normaliser in `isSecretKey` (`key.toLowerCase().replace(/[_\s-]/g, '')`) means that field names like
`one_time_code`, `oneTimeCode`, `access_token`, `sealed`, `iv` all match correctly after normalisation.

---

### D3 — Exact Resource type additions (paste into packages/auth/src/rbac.ts)

Replace the `Resource` type union and extend the `MATRIX` object:

```typescript
export type Resource =
  | 'user'
  | 'product'
  | 'entitlement'
  | 'bot_config'
  | 'exchange_key'
  | 'tradingview_access'
  | 'course'
  | 'material'
  | 'audit_log'
  | 'support_ticket'
  | 'system_health'
  // Phase-2 additions:
  | 'lesson'
  | 'enrollment'
  | 'bot_instance'
  | 'exchange_account'
  | 'terminal_account_link'
  | 'support_ticket_reply';
```

Corresponding MATRIX entries to add:

```typescript
lesson: {
  read: ['user', 'teacher', 'admin', 'support'],
  create: ['teacher', 'admin'],
  update: ['teacher', 'admin'],
  delete: ['teacher', 'admin'],
  manage: ['admin'],
},
enrollment: {
  read: ['user', 'teacher', 'admin', 'support'],
  create: ['user', 'teacher', 'admin'],
  manage: ['admin'],
},
bot_instance: {
  read: ['user', 'admin', 'support'],
  create: ['admin'],
  manage: ['admin'],
},
exchange_account: {
  // read returns masked metadata only; no plaintext ever
  read: ['user', 'admin'],
  create: ['user', 'admin'],
  delete: ['user', 'admin'],
},
terminal_account_link: {
  read: ['user', 'admin', 'support'],
  create: ['user'],
  delete: ['user', 'admin'],
  manage: ['admin'],
},
support_ticket_reply: {
  read: ['user', 'teacher', 'support', 'admin'],
  create: ['user', 'teacher', 'support', 'admin'],
  manage: ['support', 'admin'],
},
```

---

### D4 — Duplicated audit codes dropped

`terminal.account_link` and `terminal.download` are dropped. They duplicate `axioma.account_link_init`
and `axioma.download_request` respectively. Using both would create divergent audit trails for the same
events. All Axioma product events use the `axioma.*` namespace exclusively.

---

## Per-mutation canonical security pipelines

Every pipeline is in execution order. Steps may not be reordered. CSRF precedes step 1 (Zod parse) on
all POST/PUT/PATCH/DELETE routes.

### Bot config save / version

```
CSRF check (verifyCsrf)
→ Zod.safeParse(botConfigSchema) — 422 on failure
→ getSession → requireAuth                           — 401
→ requireRole([user, admin])                         — 403
→ requireEntitlement(tortila_bot | legacy_bot)       — 403 fail-closed
→ requireOwnership(botInstance.userId, session.userId) — 403
→ tx: upsert bot_configs, increment version
→ tx: INSERT audit_logs action='bot.config.save'
      before={version: N}, after={version: N+1}
      — NO raw config JSON in before/after
→ return { version: N+1 }   // no keys, no config blob
```

### Bot safety ack (enable / disable — mock only)

```
CSRF check
→ Zod.safeParse({ botId, action: z.enum(['enable','disable']) })
→ getSession → requireAuth                   — 401
→ requireRole([user, admin])                 — 403
→ requireEntitlement(product)                — 403
→ requireOwnership(botInstance.userId)       — 403
→ tx: INSERT bot_safety_events { kind: action, metadata: { mock: true } }
     — metadata carries NO plaintext keys, NO sealed blobs
→ tx: INSERT audit_logs action='bot.enable' | 'bot.disable'
      after={ mock: true, botId }
→ return { status: 'mock_enabled' | 'mock_disabled' }
HARD RULE: no real SSH/systemd/process call until adapter is separately audited.
```

### Education — enroll

```
CSRF check
→ Zod.safeParse({ courseId: z.string().uuid() })
→ getSession → requireAuth                         — 401
→ requireRole([user, teacher, admin])              — 403
→ requireEntitlement('education')                  — 403 fail-closed
→ load course; 404 if not published
→ tx: INSERT enrollments {userId, courseId} ON CONFLICT DO NOTHING
→ tx: INSERT audit_logs action='education.enroll'
      after={ courseId, enrolledAt }
→ return { courseId, enrolledAt }
```

### Education — lesson progress

```
CSRF check
→ Zod.safeParse({ lessonId: z.string().uuid() })
→ getSession → requireAuth                         — 401
→ requireRole([user, teacher, admin])              — 403
→ load enrollment for (session.userId, lesson.courseId) — 403 if not enrolled
→ tx: upsert lesson_progress { completedAt: now() }
→ tx: INSERT audit_logs action='education.progress'
      after={ lessonId, completedAt }
→ return { lessonId, completedAt }
```

### Education — teacher profile / pinned link (course update / material upload)

```
[course update]
CSRF check
→ Zod.safeParse({ title?, description?, published? })
→ getSession → requireAuth                               — 401
→ requireRole([teacher, admin])                          — 403
→ load course; 404 if not found
→ requireOwnership(course.ownerTeacherId, session.userId) — 403 (admin bypasses)
→ tx: UPDATE courses
→ tx: INSERT audit_logs action='education.course_update'
      before={ title, published }, after={ title, published }
→ return CourseDTO (no secrets)

[material upload]
CSRF check
→ Zod.safeParse({ lessonId, label, url, kind })
→ getSession → requireAuth                              — 401
→ requireRole([teacher, admin])                         — 403
→ load lesson → load parent course
→ requireOwnership(course.ownerTeacherId, session.userId) — 403
→ tx: INSERT materials
→ tx: INSERT audit_logs action='education.material_upload'
      after={ label, kind }   // url is a storage URL, not a secret
→ return { id, label, url, kind }
```

### TradingView grant / revoke / profile

```
[submit]
CSRF check
→ Zod.safeParse({ tradingViewUsername: z.string().min(1) })
→ getSession → requireAuth                              — 401
→ requireRole([user, teacher, admin])                   — 403
→ requireEntitlement('tradingview_indicators')          — 403
→ tx: INSERT tradingview_access_requests
→ tx: INSERT audit_logs action='tradingview.submit'
      after={ status:'pending', tradingViewUsername }
      — TV username is a public handle, not a secret
→ return { id, status:'pending' }

[grant]
CSRF check
→ Zod.safeParse({ requestId: uuid, durationMs: z.number().int().positive() })
→ getSession → assertAdmin(session.roles)               — 403
→ tx: UPDATE tradingview_access_requests status='granted'
→ tx: INSERT audit_logs action='tradingview.grant'
      after={ status:'granted', expiresAt }
→ return { id, status:'granted' }

[revoke]
CSRF check
→ Zod.safeParse({ requestId: uuid })
→ getSession → assertAdmin(session.roles)               — 403
→ tx: UPDATE tradingview_access_requests status='revoked'
→ tx: INSERT audit_logs action='tradingview.revoke'
      after={ status:'revoked' }
→ return { id, status:'revoked' }
```

### TradingView profile (tv_profile / tradingview_access_grants)

```
[user profile GET — read only; no CSRF]
→ getSession → requireAuth                             — 401
→ requireEntitlement('tradingview_indicators')         — 403
→ SELECT tradingview_access_requests WHERE userId=session.userId
→ return DTO (no secrets)

[admin grant record]
CSRF check
→ Zod.safeParse({ requestId, platformUsername, grantedAt, expiresAt })
→ getSession → assertAdmin(session.roles)              — 403
→ tx: INSERT tradingview_access_grants
→ tx: INSERT audit_logs action='tradingview.grant'
      after={ platformUsername, expiresAt }
→ return DTO
```

### product_access_event (billing webhook handler)

```
[webhook ingress — no CSRF; signature verification replaces CSRF]
→ verify provider HMAC signature against raw body — 401/403 on failure
→ Zod.safeParse(webhookPayload)                        — 422 on failure
→ idempotency: check providerEventId for replay        — 200 no-op if seen
→ tx: apply billing state transition to entitlements
→ tx: INSERT audit_logs action='billing.webhook_received'
      after={ eventType, providerEventId, productCode, newStatus }
      — NO raw webhook body; NO provider customer ID beyond reference
→ return { received: true }
RULE: if signature invalid → INSERT audit_logs action='billing.webhook_rejected'; return 400
```

### Terminal download / license

```
[download URL]
CSRF check
→ Zod.safeParse({ releaseId?: uuid })
→ getSession → requireAuth                             — 401
→ requireRole([user, admin])                           — 403
→ requireEntitlement('axioma_terminal')                — 403
→ generate signed time-limited URL (server-side; not persisted; expires ≤ 5 min)
→ tx: INSERT terminal_download_events { userId, releaseId, requestedAt }
→ tx: INSERT audit_logs action='axioma.download_request'
      after={ releaseId, expiresAt }
→ return { downloadUrl, expiresAt }
RULE: downloadUrl is a signed URL, not the binary itself; it must expire and be single-use.

[license check — read only; no CSRF]
→ getSession → requireAuth                             — 401
→ requireEntitlement('axioma_terminal')                — 403
→ SELECT terminal_license_events WHERE userId=session.userId
→ return { licensed: bool, expiresAt }
```

### Support ticket create / reply

```
[create]
CSRF check
→ Zod.safeParse({ subject: z.string().min(5), body: z.string().min(10), productCode?: z.string() })
→ getSession → requireAuth                             — 401
→ requireRole([user, teacher, admin, support])         — 403
→ tx: INSERT support_tickets { userId: session.userId }
→ tx: INSERT audit_logs action='support.ticket_create'
      after={ subject, status:'open' }
→ return { id, subject, status:'open' }

[reply]
CSRF check
→ Zod.safeParse({ body: z.string().min(1) })
→ getSession → requireAuth                             — 401
→ load ticket — 404 if not found
→ if session.roles = ['user']: requireOwnership(ticket.userId, session.userId) — 403
→ tx: INSERT support_ticket_replies
→ tx: INSERT audit_logs action='support.ticket_reply'
      after={ ticketId, createdAt }
      — body NOT in audit row (may contain sensitive user text)
→ return { id, ticketId, createdAt }
```

### Notifications (system-generated; no user mutation)

```
[send — internal worker/system call]
→ no user CSRF required (system actor)
→ Zod.safeParse(notificationPayload)
→ verify caller is internal (service token or worker context — not user session)
→ tx: INSERT notifications { userId, kind, payload }
→ tx: INSERT audit_logs action='admin.action'
      actorRole='system', after={ kind, userId }
→ return { queued: true }
RULE: notification payload must not contain exchange keys, session tokens, or vault material.
```

### Axioma account link init / complete / revoke

```
[init]
CSRF check
→ Zod.safeParse({})
→ getSession → requireAuth                             — 401
→ requireRole([user, admin])                           — 403
→ requireEntitlement('axioma_terminal')                — 403
→ code = crypto.randomBytes(16).toString('hex')       // 32-char hex; one-time use
→ expiresAt = now + 5 min
→ tx: UPSERT axioma_account_links { oneTimeCode: code, codeExpiresAt, state:'pending' }
→ tx: INSERT audit_logs action='axioma.account_link_init'
      after={ state:'pending' }
      — code MUST NOT appear in the audit row (blocked by SECRET_HINTS 'onetimecode')
→ return { code, expiresAt }   // returned ONCE; never again

[complete — Axioma server callback]
→ verify request comes from Axioma server (shared secret or mTLS; not user session)
→ Zod.safeParse({ code, axiomaUserId })
→ tx: SELECT axioma_account_links WHERE oneTimeCode=code AND codeExpiresAt > now()
      — 403 if expired or not found
→ tx: UPDATE axioma_account_links { state:'linked', oneTimeCode:null, codeExpiresAt:null, axiomaUserId }
→ tx: INSERT audit_logs action='axioma.account_link_complete'
      after={ state:'linked', axiomaUserId }
→ return { state:'linked' }

[revoke]
CSRF check
→ Zod.safeParse({})
→ getSession → requireAuth                             — 401
→ requireOwnership(link.userId, session.userId)        — 403 (admin bypasses)
→ tx: UPDATE axioma_account_links { state:'not_linked', axiomaUserId:null }
→ tx: INSERT audit_logs action='axioma.account_link_revoke'
      after={ state:'not_linked' }
→ return { state:'not_linked' }
```

---

## No-plaintext rule verification

### Bot config save — no secrets

The `bot_configs.config` jsonb column holds trading parameters (symbols, RSI/CCI values, leverage
percentages, etc.). These are not secret values. However, a config payload may incidentally contain a
field named `apikey`, `token`, or `secret` if a user mistakenly pastes a key into a config field. The
`redact()` call on the `before`/`after` payload in `buildEvent` will catch these by field name. The
response must return only `{ version }` — no raw config JSON. This is enforced by pipeline step 9 above.

### Exchange-key form — key_mask only

`addExchangeKey` (`repositories.ts:167-182`) correctly inserts only `keyMask` into `exchangeAccounts`
and the opaque `sealed` vault record into `exchangeApiKeySecrets`. The `listExchangeKeys` function
(`repositories.ts:184-188`) explicitly never joins `exchangeApiKeySecrets` — confirmed. The response
shape is `{ id, label, key_mask, createdAt }`. Plaintext key is never persisted and never returned.

**Gap (see F4)**: the in-txn audit row is missing from `addExchangeKey`. It must be added before any
route depends on this function.

### Terminal one_time_code — never in audit payload

`axioma_account_links.oneTimeCode` (`schema.ts:142`) is a plaintext column. The only permitted
lifecycle is: generate → store → return to user once → consume (null) in the same transaction that
completes the link. Once `onetimecode` is added to SECRET_HINTS (D2 above), any payload containing a
key named `oneTimeCode`, `one_time_code`, `onetimecode` (all normalise identically) will be redacted to
`[REDACTED]` before reaching `audit_logs`. The route must not return the code a second time after the
`/complete` callback fires.

### product_access_events — no secrets

`product_access_events` (TARGET table; not yet in schema) will record `eventType`, `providerEventId`,
`userId`, `productCode`, `newStatus`. None of these are secrets. The raw webhook body must not be stored.
Payment provider customer IDs may be considered PII but are not secrets under the vault policy.

### bot_safety_events.metadata — no plaintext keys

The `bot_safety_events` table (TARGET; not yet in schema) will have a `metadata` jsonb column. The
pipeline above (`bot enable / disable`) specifies `metadata: { mock: true }` only. The `redact()`
function is applied to `before`/`after` in `buildEvent`, but the `metadata` field on
`bot_safety_events` is a raw DB column not routed through `redact()`. The operator must ensure the
repository function that inserts into `bot_safety_events` does NOT include any field that could contain
vault material or plaintext keys. A value-pattern blocklist check (hex string ≥ 32 chars triggers
redaction) is the second line of defence. Until `bot_safety_events` exists and its insert is
implemented, this rule cannot be mechanically verified.

### Axioma ES256 private key — never exposed; HS256 unreachable in prod

The SECURITY_MODEL.md §8 STRIDE threat model entry for "JWT algorithm confusion" specifies:
`alg: 'ES256'` header validation; no HS256/none accepted. The Axioma handoff token spec
(`AXIOMA_HANDOFF_TOKEN_SPEC.md`) reinforces ES256 with explicit alg validation. No ES256 private key
material appears in `schema.ts`, `repositories.ts`, `audit.ts`, or `redact.ts` — confirmed. The private
key is an environment variable (`AXIOMA_PRIVATE_KEY` or equivalent); it must never be stored in the DB,
never returned in an API response, and must not appear in any audit log payload. The `privatekey` entry
in SECRET_HINTS (`redact.ts:16`) will catch a field named `privateKey` or `private_key` in any audit
payload. HS256 is blocked by explicit algorithm validation at the token verification layer; the handoff
spec must document that no fallback to HS256 is permitted even if the verification library supports it.

---

## Verification / tests

The operator must add the following test cases before any Phase-2 route is merged. Tests use Vitest.
No test may touch a live service; all secret-handling tests use Vitest mocks or the existing
`createMemoryAuditWriter`.

### 1. CSRF coverage — new server actions

For each new POST/PUT/PATCH/DELETE route handler:

```typescript
// Example pattern — repeat for every Phase-2 mutation endpoint
it('rejects request with missing CSRF token', async () => {
  const res = await POST_without_csrf_header('/api/bots/1/config', validBody);
  expect(res.status).toBe(403);
});

it('rejects request with mismatched CSRF token', async () => {
  const res = await POST_with_wrong_csrf('/api/bots/1/config', validBody);
  expect(res.status).toBe(403);
});

it('accepts request with matching CSRF token', async () => {
  const res = await POST_with_valid_csrf('/api/bots/1/config', validBody);
  expect(res.status).not.toBe(403);
});
```

Mutation endpoints requiring CSRF coverage: bot config save, bot enable/disable, exchange key CRUD,
education course/lesson/material CRUD, education enroll/progress, axioma account-link init/revoke,
support ticket create/reply, admin entitlement grant/revoke, admin user role assign/revoke, TV submit.

### 2. RBAC matrix completeness — new resources

```typescript
it('lesson resource: user cannot create', () => {
  expect(can(['user'], 'lesson', 'create')).toBe(false);
});
it('lesson resource: teacher can create', () => {
  expect(can(['teacher'], 'lesson', 'create')).toBe(true);
});
it('enrollment resource: user can create', () => {
  expect(can(['user'], 'enrollment', 'create')).toBe(true);
});
it('terminal_account_link: support cannot create', () => {
  expect(can(['support'], 'terminal_account_link', 'create')).toBe(false);
});
it('exchange_account: support cannot read', () => {
  expect(can(['support'], 'exchange_account', 'read')).toBe(false);
});
// Repeat can() assertions for every (role, resource, action) cell in the RBAC_MATRIX.md tables
// that corresponds to a Phase-2 resource. Target: full coverage of every ❌ and ✅ cell.
```

### 3. Redact unit tests — new SECRET_HINTS

```typescript
// packages/audit/src/redact.test.ts — add these cases:
it('redacts sealed field', () => {
  expect(redact({ sealed: { v: 1, keyId: 'k1', payload: 'AAAA' } })).toEqual({ sealed: '[REDACTED]' });
});
it('redacts iv field', () => {
  expect(redact({ iv: 'aabbccdd' })).toEqual({ iv: '[REDACTED]' });
});
it('redacts tag field', () => {
  expect(redact({ tag: 'deadbeef' })).toEqual({ tag: '[REDACTED]' });
});
it('redacts onetimecode via normalised key one_time_code', () => {
  expect(redact({ one_time_code: 'abc123' })).toEqual({ one_time_code: '[REDACTED]' });
});
it('redacts onetimecode via camelCase oneTimeCode', () => {
  expect(redact({ oneTimeCode: 'abc123' })).toEqual({ oneTimeCode: '[REDACTED]' });
});
it('redacts bearer token value', () => {
  expect(redact({ bearer: 'eyJhbGci...' })).toEqual({ bearer: '[REDACTED]' });
});
it('redacts refreshtoken', () => {
  expect(redact({ refreshToken: 'rt_xyz' })).toEqual({ refreshToken: '[REDACTED]' });
});
it('redacts credentials object', () => {
  expect(redact({ credentials: { username: 'u', password: 'p' } })).toEqual({ credentials: '[REDACTED]' });
});
it('does not redact safe fields', () => {
  expect(redact({ label: 'My Key', key_mask: '••••1234', status: 'active' }))
    .toEqual({ label: 'My Key', key_mask: '••••1234', status: 'active' });
});
// Value-pattern: long hex string
it('redacts 32+ char hex string values regardless of key name', () => {
  // NOTE: value-pattern redaction is not yet implemented in redact.ts;
  // this test MUST FAIL until the operator adds value-pattern logic.
  // Mark as todo until implemented.
});
```

### 4. In-transaction audit assertions

```typescript
// For each repository function that has an in-txn audit row:
it('addExchangeKey writes audit row in same transaction', async () => {
  // After F4 is fixed:
  const { db, auditRows } = createTestDb();
  await addExchangeKey(db, validInput);
  expect(auditRows).toHaveLength(1);
  expect(auditRows[0].action).toBe('exchange_key.create');
  expect(auditRows[0].after).toEqual({ label: validInput.label, key_mask: validInput.keyMask, key_id: validInput.keyId });
  // Confirm no sealed/iv/tag in after:
  expect(JSON.stringify(auditRows[0].after)).not.toContain('sealed');
});

it('grantProduct audit row carries actorUserId when provided', async () => {
  // After F9 is fixed:
  const { db, auditRows } = createTestDb();
  await grantProduct(db, userId, 'education', Date.now(), adminId);
  expect(auditRows[0].actorUserId).toBe(adminId);
});

it('axioma account-link complete nulls one_time_code atomically', async () => {
  const { db } = createTestDb();
  await initAccountLink(db, userId, code, expiresAt);
  await completeAccountLink(db, code, axiomaUserId);
  const link = await db.select().from(s.axiomaAccountLinks).where(eq(s.axiomaAccountLinks.userId, userId));
  expect(link[0].oneTimeCode).toBeNull();
  expect(link[0].state).toBe('linked');
});

it('axioma account-link init audit row does not contain the code', async () => {
  const { db, auditRows } = createTestDb();
  await initAccountLink(db, userId, code, expiresAt);
  expect(JSON.stringify(auditRows[0])).not.toContain(code);
  expect(auditRows[0].after).not.toHaveProperty('onetimecode');
  expect(auditRows[0].after).not.toHaveProperty('oneTimeCode');
  expect(auditRows[0].after).not.toHaveProperty('one_time_code');
});
```

### 5. Ownership isolation

```typescript
it('teacher cannot update another teacher course', async () => {
  const result = canActOnOwned(['teacher'], 'course', 'update', 'user-a', 'user-b');
  expect(result).toBe(false);
});
it('admin can update any teacher course', async () => {
  const result = canActOnOwned(['admin'], 'course', 'update', 'user-a', 'user-b');
  expect(result).toBe(true);
});
it('user cannot update exchange key they do not own', async () => {
  const result = canActOnOwned(['user'], 'exchange_key', 'update', 'user-a', 'user-b');
  expect(result).toBe(false);
});
it('support cannot read exchange_account at all (RBAC)', () => {
  expect(can(['support'], 'exchange_account', 'read')).toBe(false);
});
```

### 6. Axioma ES256 / HS256 algorithm guard

```typescript
it('rejects HS256-signed Axioma handoff token', async () => {
  const hsToken = signWithHmac('secret', payload);
  await expect(verifyAxiomaToken(hsToken)).rejects.toThrow();
});
it('rejects alg=none Axioma handoff token', async () => {
  const noneToken = buildNoneAlgToken(payload);
  await expect(verifyAxiomaToken(noneToken)).rejects.toThrow();
});
it('accepts valid ES256-signed Axioma handoff token', async () => {
  const token = signWithEc('ES256', privateKey, payload);
  const result = await verifyAxiomaToken(token);
  expect(result.sub).toBe(payload.sub);
});
```

---

## Risks

### R1 — BLOCKING: addExchangeKey has no in-txn audit (F4)

Until fixed, any exchange key stored has no audit trail. This is a hard violation of the append-only
audit contract. Phase-2 exchange key routes must not ship until this is resolved.

### R2 — BLOCKING: 5 schema tables are TARGET-only (F5)

`bot_safety_events`, `bot_config_versions`, `product_access_events`, `terminal_download_events`,
`terminal_license_events` are referenced by Phase-2 mutation pipelines but do not exist in
`packages/db/src/schema.ts`. Migrations must land before implementation begins.

### R3 — BLOCKING: SECRET_HINTS gap before production (F2)

`sealed`, `iv`, `tag`, `onetimecode` are not in SECRET_HINTS. Any vault-adjacent payload reaching
`buildEvent` before this is fixed will write un-redacted vault field names into the append-only audit
log. Cannot be corrected post-write.

### R4 — HIGH: grantProduct/revokeProduct lose actorUserId (F9)

Admin entitlement operations leave a null actor in audit rows. This degrades forensic capability. Must
be fixed before admin entitlement routes are built.

### R5 — MEDIUM: value-pattern redaction not yet implemented

The AUDIT_LOG_SCHEMA.md specifies value-pattern redaction (32+ hex char strings, Bearer prefix, Argon2
PHC format). `redact.ts` implements only key-name redaction. If a safe-named field (e.g. `hash`,
`digest`, `ref`) contains a raw key value, it will not be caught. This is a defence-in-depth gap.

### R6 — LOW: logger.ts does not exist (carried from F6 of prior handoff)

Any structured app-level log output outside `@wtc/audit` has no redaction. All log calls in routes must
route through `redact()` or avoid secret-adjacent field names entirely until
`packages/auth/src/logger.ts` is built.

---

## Next actions

In priority order (blocking items first):

1. **Add SECRET_HINTS** (D2) to `packages/audit/src/redact.ts` — blocking for any production deployment
   and any vault-adjacent route. Do this first; it is a two-minute edit with immediate blast-radius
   reduction.

2. **Add AUDIT_ACTIONS** (D1) to `packages/audit/src/audit.ts` — blocking for all Phase-2 route
   compilation. Without this, TypeScript will reject any route that writes a Phase-2 action code.

3. **Add Resource type entries and MATRIX** (D3) to `packages/auth/src/rbac.ts` — blocking for Phase-2
   routes that gate on `lesson`, `enrollment`, `bot_instance`, `exchange_account`,
   `terminal_account_link`, `support_ticket_reply`.

4. **Fix addExchangeKey in-txn audit gap** (F4) — add `tx.insert(s.auditLogs)` inside the existing
   transaction in `packages/db/src/repositories.ts:173-181`.

5. **Add Phase-2 schema migrations** (F5) — `bot_safety_events`, `bot_config_versions`,
   `product_access_events`, `terminal_download_events`, `terminal_license_events` must exist before
   routes that write to them are implemented.

6. **Fix grantProduct/revokeProduct actorUserId** (F9) — add optional `actorUserId` parameter to both
   functions; thread from route handler.

7. **Write regression tests** (Verification section) — CSRF coverage, RBAC completeness, redact unit
   tests, in-txn audit assertions, ownership isolation, ES256/HS256 algorithm guard.

8. **Implement axioma account-link repository** — enforce 5-min TTL and single-use nulling atomically
   inside the transaction (F7).

9. **Document csrf.ts selection** (F6) — add comment clarifying `verifyCsrf` is the production path;
   `deriveSessionCsrfToken` is an alternative not active in Phase-2 routes.

10. **Implement value-pattern redaction** (R5) — extend `redact()` to detect 32+ hex char strings and
    `Bearer ` prefixed values as a second line of defence.
