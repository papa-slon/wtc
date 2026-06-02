# ecosystem-security-auditor handoff

_Epoch 20260530-0126. Phase 2 security design audit — DESIGN ONLY. No code or shared-package files changed._

## Scope

Phase 2 Part 10 (security design) + Part 0 truth:
(a) Per-mutation security pipeline for every new Phase-2 mutation area.
(b) New audit action vocabulary to add to `packages/audit/src/audit.ts`.
(c) RBAC_MATRIX additions (row per new route/action).
(d) SECRET_VAULT_DESIGN.md truth — verify vs real implementation and fix drift.
(e) Confirm exchange-key form vault requirement and no-plaintext rule.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/SECRET_VAULT_DESIGN.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `packages/auth/src/rbac.ts`
- `packages/auth/src/csrf.ts`
- `packages/auth/src/session.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/crypto/src/vault.ts`
- `apps/web/src/lib/vault.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `docs/handoffs/20260529-2352-phase-1-7-part-e-tv-lms-persistence.md` (prior phase state)

## Files changed

- `docs/SECRET_VAULT_DESIGN.md` — corrected DB schema (two-table split, real column names `key_mask`/`sealed`), labelled non-implemented columns as TARGET, added axioma one-time-code policy, corrected redact.ts blocklist status, added exchange-key form hard rule.
- `docs/AUDIT_LOG_SCHEMA.md` — replaced Phase-0 action-code table with two-tier vocabulary (implemented vs Phase-2 additions), fixed column name drift (`before`/`after` vs `before_redacted`/`after_redacted`), added TARGET redaction additions, added Phase-2 action codes for all new mutation areas.
- `docs/RBAC_MATRIX.md` — added explicit server-side pipeline spec for every mutation, added Phase-2 route rows (bot enable/disable, exchange key pipeline, axioma account-link flows, education enroll/progress, support ticket create/reply pipelines), added Phase-2 RBAC resource additions table.

## Findings

### F1 — CRITICAL: SECRET_VAULT_DESIGN.md DB schema is wrong (column names, table structure)
**Severity**: Critical (doc governs implementation; wrong column names cause drift bugs)
**Evidence**: `packages/db/src/schema.ts:100-117` — actual schema has TWO tables: `exchange_accounts` (with `key_mask`) and `exchange_api_key_secrets` (with `sealed` jsonb). Design doc showed a single combined table with `masked_key`, `vault_record`, `owner_user_id`, `label`, `is_active`, `is_deleted`, `deleted_at`, `updated_at`, `last_used_at` — none of these extra columns exist.
**Fix**: Rewrote the "Stored record shape in DB" section with the real two-table schema, labeled lifecycle columns (`is_active`, `is_deleted`, `deleted_at`) as TARGET.

### F2 — CRITICAL: `secret_rotation_events` table does not exist
**Severity**: Critical (doc describes delete/revoke behavior that requires this table)
**Evidence**: `packages/db/src/schema.ts` — no `secret_rotation_events` table. Rotation event history currently exists only in `audit_logs`.
**Fix**: Labelled the table as TARGET in SECRET_VAULT_DESIGN.md. Delete/revoke procedure now annotated "requires lifecycle columns migration".

### F3 — HIGH: `redact.ts` SECRET_HINTS is missing production-required entries
**Severity**: High (under-redaction allows secret field values into audit log)
**Evidence**: `packages/audit/src/redact.ts:5-19` — current list: `secret, password, passwordhash, apikey, token, authorization, cookie, kek, dek, wrappeddek, privatekey, mnemonic, seedphrase`. Missing: `ciphertext`, `iv`, `tag`, `vaultrecord`, `sealed`, `credentials`, `bearer`, `refreshtoken`, `idtoken`, `accesstoken`, `onetimecode`.
**Fix**: Documented required additions in AUDIT_LOG_SCHEMA.md redaction section. These must be added to `redact.ts` `SECRET_HINTS` before production deployment.

### F4 — HIGH: AUDIT_LOG_SCHEMA.md action codes out of sync with implemented `AUDIT_ACTIONS` enum
**Severity**: High (schema doc had verbose `auth.login.success` style; implementation uses flat `auth.login` style; any route author reading the doc would write wrong action codes)
**Evidence**: `packages/audit/src/audit.ts:8-25` — actual enum: `auth.login`, `auth.login_failed`, `auth.logout`, `exchange_key.create/.update/.delete`, `bot.config_change`, `bot.control_attempt`, `product.grant/.revoke`, `tradingview.submit/.grant/.revoke`, `education.material_change`, `education.course_create`, `admin.action`.
**Fix**: Replaced the action-code section with a two-tier table: (1) implemented codes matching the real enum, (2) Phase-2 additions that must be added to `AUDIT_ACTIONS` before routes write them.

### F5 — MEDIUM: `axioma_account_links.one_time_code` is plaintext
**Severity**: Medium (short-lived but is a secret value in a DB column)
**Evidence**: `packages/db/src/schema.ts:137-145` — `oneTimeCode: text('one_time_code')` with no vault wrapping.
**Fix**: Documented in SECRET_VAULT_DESIGN.md as conditionally acceptable with strict constraints: max 5-min TTL, single-use (nulled on consume), never in audit payload, never in API response after linking. If a long-lived token is introduced it must use the vault.

### F6 — MEDIUM: `packages/auth/src/logger.ts` referenced in SECRET_VAULT_DESIGN.md does not exist
**Severity**: Medium (false assurance)
**Evidence**: `packages/auth/src/logger.ts` not present in source; redaction today is entirely via `@wtc/audit` `redact()`.
**Fix**: Corrected both docs to say the logger is PLANNED; redaction today is via `redact()` only.

### F7 — MEDIUM: RBAC_MATRIX.md had no explicit per-mutation pipeline spec
**Severity**: Medium (implementers had to infer the pipeline ordering; ambiguity allows steps to be reordered)
**Evidence**: Existing matrix had role tables but no canonical step ordering.
**Fix**: Added a "Server-side pipeline for every authenticated mutation" section with the 9-step ordered pipeline.

### F8 — LOW: `audit_logs` Drizzle column names differ from design doc
**Severity**: Low (doc uses `before_redacted`/`after_redacted`; real columns are `before`/`after`)
**Evidence**: `packages/db/src/schema.ts:197-215`.
**Fix**: Added a schema note in AUDIT_LOG_SCHEMA.md explaining `_redacted` is a documentation convention; the implemented columns are `before`/`after`.

### F9 — LOW: RBAC `Resource` type in `rbac.ts` missing Phase-2 resources
**Severity**: Low (design gap for Phase 2 — no code yet)
**Evidence**: `packages/auth/src/rbac.ts:9-20` — no `lesson`, `enrollment`, `bot_instance`, `exchange_account`, `terminal_account_link` resources.
**Fix**: Added a "Phase-2 RBAC Resource additions" table in RBAC_MATRIX.md listing the tokens that must be added to `rbac.ts` before Phase-2 routes ship.

## Per-mutation security pipeline matrix

### Bot config save / version

```
CSRF → Zod(botConfigSchema) → getSession → requireRole([user,admin])
→ requireEntitlement(tortila_bot|legacy_bot) → requireOwnership(botInstance.userId)
→ upsert bot_configs version → in-txn audit bot.config.save {before:{version}, after:{version}}
→ return {version}   // no secrets; no raw config JSON in response
```

### Exchange key add (vault, never plaintext display)

```
CSRF → Zod(keyFormat: length + charset only; NO live test) → getSession
→ requireRole([user,admin]) → requireEntitlement(product)
→ requireOwnership(exchangeAccount.userId if updating)
→ vault.seal(plaintextKey, aad=`user:${userId}|exchange:${exchange}`)
→ tx: insert exchange_accounts {keyMask:maskSecret(key)} + insert exchange_api_key_secrets {sealed, keyId}
→ in-txn audit exchange_key.create {after:{label, key_mask, key_id}}
→ return {id, label, key_mask}   // NEVER plaintext; NEVER sealed blob
```

The exchange-key form MUST use this vault interface. The plaintext key MUST NOT appear in any API response,
including success responses, error responses, validation responses, or logs. The only value returned is `key_mask`.

### Bot enable / disable (mock only — no live control)

```
CSRF → Zod({botId}) → getSession → requireRole([user,admin])
→ requireEntitlement(product) → requireOwnership(botInstance.userId)
→ record mock state change (no live SSH/systemd/process control)
→ in-txn audit bot.enable or bot.disable {after:{mock:true}}
→ return {status:'mock_enabled'|'mock_disabled'}
```

Hard rule: no real bot control until a separately audited adapter is approved. "Stop bot" does not equal "close positions".

### Billing grant / revoke (admin)

```
CSRF → Zod({userId, productCode, reason:min10}) → getSession → assertAdmin(session.roles)
→ tx: upsert entitlements + in-txn audit product.grant|product.revoke
  {before:{state}, after:{state, product_code, plan_code}}
→ queue async notification to affected user
→ return {status:'granted'|'revoked'}
```

### TV submit / grant / revoke

```
[submit] CSRF → Zod({tradingViewUsername}) → getSession → requireRole([user,admin])
  → requireEntitlement(tradingview_indicators)
  → tx: insert tradingview_access_requests + in-txn audit tradingview.submit
  → return {id, status:'pending'}

[grant] CSRF → Zod({requestId, durationMs}) → getSession → assertAdmin
  → tx: update status='granted' + in-txn audit tradingview.grant {after:{status:'granted'}}
  → return {id, status:'granted'}

[revoke] CSRF → Zod({requestId}) → getSession → assertAdmin
  → tx: update status='revoked' + in-txn audit tradingview.revoke {after:{status:'revoked'}}
  → return {id, status:'revoked'}
```

### LMS course create / update

```
[create] CSRF → Zod({title:max200}) → getSession → requireRole([teacher,admin])
  → tx: insert courses {ownerTeacherId:session.userId} + in-txn audit education.course_create
  → return CourseDTO (no secrets)

[update] CSRF → Zod({title?,description?,published?}) → getSession → requireRole([teacher,admin])
  → load course → requireOwnership(course.ownerTeacherId, session.userId) [admin bypasses]
  → tx: update + in-txn audit education.course_update
  → return CourseDTO

[publish] CSRF → Zod({published:bool}) → getSession → requireRole([teacher,admin])
  → requireOwnership → tx: set published=true + in-txn audit education.course_publish
```

### LMS lesson create / update

```
[create] CSRF → Zod({courseId, title, body?, videoUrl?, order:int}) → getSession
  → requireRole([teacher,admin]) → load course → requireOwnership(course.ownerTeacherId)
  → tx: insert lessons + in-txn audit education.lesson_create
  → return LessonDTO

[update] CSRF → Zod → getSession → requireRole([teacher,admin])
  → load lesson → load parent course → requireOwnership(course.ownerTeacherId)
  → tx: update + in-txn audit education.lesson_update
```

### LMS material create / delete

```
[create] CSRF → Zod({lessonId, label, url, kind}) → getSession → requireRole([teacher,admin])
  → load material's lesson → load parent course → requireOwnership(course.ownerTeacherId)
  → tx: insert materials + in-txn audit education.material_upload {after:{label,kind}}
  → return {id, label, url, kind}   // url may be a storage URL; not a secret

[delete] CSRF → Zod({materialId}) → getSession → requireRole([teacher,admin])
  → same ownership chain → tx: delete + in-txn audit education.material_delete
```

### LMS enroll

```
CSRF → Zod({courseId}) → getSession → requireRole([user,teacher,admin])
  → requireEntitlement(education)
  → check course is published (404 if not)
  → tx: insert enrollments {userId:session.userId, courseId} ON CONFLICT DO NOTHING
    + in-txn audit education.enroll
  → return {courseId, enrolledAt}
```

### LMS progress

```
CSRF → Zod({lessonId}) → getSession → requireRole([user,teacher,admin])
  → load enrollment for (session.userId, lesson.courseId) — 403 if not enrolled
  → tx: upsert lesson_progress {completedAt:now} + in-txn audit education.progress
  → return {lessonId, completedAt}
```

### Terminal account link (Axioma)

```
[init] CSRF → Zod({}) → getSession → requireRole([user,admin])
  → requireEntitlement(axioma_terminal)
  → generate one-time code (crypto.randomBytes(16).toString('hex')); TTL = 5 min
  → tx: upsert axioma_account_links {oneTimeCode, codeExpiresAt, state:'pending'}
    + in-txn audit axioma.account_link_init {after:{state:'pending'}}
  → return {code, expiresAt}   // code returned ONCE; never after linking

[complete — called by Axioma server callback] → verify code not expired, matches record
  → tx: update axioma_account_links {state:'linked', oneTimeCode:null, codeExpiresAt:null, axiomaUserId}
    + in-txn audit axioma.account_link_complete
  → return {state:'linked'}

NOTE: one_time_code must NEVER appear in audit payload (add 'onetimecode' to redact.ts SECRET_HINTS).
```

### Terminal download

```
CSRF → Zod({releaseId?}) → getSession → requireRole([user,admin])
  → requireEntitlement(axioma_terminal)
  → generate signed time-limited download URL (server-side only, not stored)
  → in-txn audit axioma.download_request {after:{releaseId, expiresAt}}
  → return {downloadUrl, expiresAt}
```

### Support ticket create / reply

```
[create] CSRF → Zod({subject:min5, body:min10, productCode?}) → getSession → requireAuth
  → tx: insert support_tickets {userId:session.userId} + in-txn audit support.ticket_create
  → return {id, subject, status:'open'}

[reply] CSRF → Zod({body:min1}) → getSession → requireAuth
  → load ticket → if role=user: requireOwnership(ticket.userId, session.userId)
  → tx: insert support_ticket_replies + in-txn audit support.ticket_reply
  → return {id, ticketId, body, createdAt}
```

## New audit action vocabulary

All codes below must be added to `AUDIT_ACTIONS` in `packages/audit/src/audit.ts` before any route writes them.
Existing implemented codes are already in that file — do not duplicate them.

### Phase-2 additions by domain

**Bot**: `bot.config.save`, `bot.config.version_delete`, `bot.enable`, `bot.disable`

**Exchange keys**: `exchange_key.rewrap`, `exchange_key.test`

**Auth**: `auth.logout_all`, `auth.password_change`, `auth.password_reset_request`, `auth.password_reset_success`, `auth.account_unlock`, `auth.session_revoke`

**Billing**: `product.grace_start`, `product.expire`, `product.refund`, `product.chargeback`, `billing.webhook_received`, `billing.webhook_rejected`

**TradingView**: `tradingview.expire`

**Axioma**: `axioma.account_link_init`, `axioma.account_link_complete`, `axioma.account_link_revoke`, `axioma.download_request`, `axioma.release_publish`

**Education**: `education.course_update`, `education.course_publish`, `education.course_delete`, `education.lesson_create`, `education.lesson_update`, `education.lesson_delete`, `education.material_upload`, `education.material_delete`, `education.enroll`, `education.progress`

**Terminal**: `terminal.account_link`, `terminal.download`

**Support**: `support.ticket_create`, `support.ticket_reply`, `support.ticket_status_change`

**Admin**: `admin.user_role_assign`, `admin.user_role_revoke`, `admin.user_delete`, `admin.user_view`, `admin.entitlement_grant`, `admin.entitlement_revoke`

**System**: `system.vault_rewrap_batch`, `system.worker_expiry_run`, `system.health_check`

### Redaction additions required before production

Add to `SECRET_HINTS` in `packages/audit/src/redact.ts`:
`ciphertext`, `iv`, `tag`, `vaultrecord`, `sealed`, `credentials`, `bearer`, `refreshtoken`, `idtoken`, `accesstoken`, `onetimecode`

## Decisions

1. Exchange-key form: MUST use `vault.seal()` server-side; MUST NOT return plaintext in any response. The only permitted response field is `key_mask`.
2. Bot enable/disable: MUST remain mock-only (no live control). The mock path still writes an audit row with `{mock:true}` to make the attempt traceable.
3. Axioma one-time code: plaintext in DB is conditionally acceptable under the 5-min TTL + single-use + no-audit-log constraints. Any long-lived token must use the vault.
4. All Phase-2 mutations must follow the 9-step pipeline in RBAC_MATRIX.md verbatim — Zod first, assertAdmin as first line of admin actions, in-txn audit last before response.
5. New audit action codes are proposed as flat two-or-three-part strings (e.g. `bot.config.save`) consistent with the existing implemented enum style — NOT the verbose `auth.login.success` style from the Phase-0 doc.

## Risks

1. **`redact.ts` under-redaction (F3)** — must be fixed before any production deployment. Until `sealed`, `iv`, `tag`, `onetimecode` are in SECRET_HINTS, those field names could leak vault material or one-time codes into audit rows.
2. **`packages/auth/src/logger.ts` does not exist** — any structured app-level logging outside `@wtc/audit` has no redaction today. All app logging paths must route through `redact()` or avoid secret fields entirely until the logger is built.
3. **Lifecycle columns for exchange keys are TARGET** — delete/revoke flows for exchange API keys cannot be fully implemented without a migration adding `is_active`, `is_deleted`, `deleted_at` to `exchange_api_key_secrets`. This must be a Phase-2 migration task before key lifecycle features are built.
4. **`secret_rotation_events` table is TARGET** — KEK rotation procedure requires this table before rotation can be operationally executed. Rotation events are currently only in `audit_logs`.
5. **Phase-2 RBAC resources not yet in `rbac.ts`** — `lesson`, `enrollment`, `bot_instance`, `exchange_account`, `terminal_account_link` are not in the Resource type. Phase-2 routes must not ship to production using only the `admin.action` catchall; proper resource tokens must be added first.

## Verification/tests

DESIGN ONLY phase — no gates run. The following gates must be run after any implementer adds to `AUDIT_ACTIONS` or `redact.ts`:

- `npm run check:core` — smoke-tests the changed packages
- `npm run typecheck -w @wtc/web` — confirms AuditAction type is still exhaustive
- `npm test` — confirms redact unit tests still pass and new action codes are in AUDIT_ACTIONS

## Next actions

1. Add Phase-2 audit action codes to `packages/audit/src/audit.ts` `AUDIT_ACTIONS` (blocking for all Phase-2 mutation routes).
2. Add redaction entries to `packages/audit/src/redact.ts` `SECRET_HINTS` (blocking for production deployment).
3. Add migration: `is_active`, `is_deleted`, `deleted_at`, `updated_at` to `exchange_api_key_secrets` (blocking for key delete/revoke).
4. Add `secret_rotation_events` table migration (blocking for KEK rotation).
5. Add Phase-2 resources to `packages/auth/src/rbac.ts` `Resource` type as each area's routes are built.
6. Build `packages/auth/src/logger.ts` structured logger with SECRET_HINTS blocklist before production.
