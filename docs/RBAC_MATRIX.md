# RBAC Matrix — WTC Ecosystem Platform

> Status: Phase 0 design document, updated Phase 2 (2026-05-30). Governs all implementation.
> Owner: ecosystem-security-auditor
> Last updated: 2026-05-30

Related docs:
- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [AUDIT_LOG_SCHEMA.md](./AUDIT_LOG_SCHEMA.md)

---

## Roles

| Role | Description |
|------|-------------|
| `user` | Authenticated customer with zero or more active product entitlements |
| `teacher` | User with educator privileges; can create and manage own courses/materials |
| `admin` | Full platform operator; can override entitlements and manage all resources |
| `support` | Read-only operator; can view user data and tickets, cannot mutate entitlements |

A user may hold multiple roles. Role assignment is stored in `user_roles` and read fresh from DB on every authenticated request — no cached role on the session or JWT.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Allowed |
| ❌ | Denied (403) |
| ✅ own | Allowed for own resources only |
| ✅ entitlement | Allowed only if active entitlement for the product |
| ✅ audit | Allowed, but write to audit log is mandatory and atomic |
| ❌ never | Hard rule; never implement regardless of role |

---

## Server-side pipeline for every authenticated mutation

Every mutating route handler and server action MUST execute in this exact order. Steps may not be reordered or skipped.

```
1. Zod parse (safeParse — reject 422 on failure; no business logic on invalid input)
2. getSession(request) → requireAuth(session)           -- 401 if no valid session
3. requireRole(session, allowedRoles)                   -- 403 if role not in set
4. [if product-gated] requireEntitlement(userId, code)  -- 403 if not active/grace
5. [if ownership-scoped] requireOwnership(resourceOwner, userId)  -- 403 if not owner
6. [admin actions] assertAdmin(session.roles)           -- first line of action body
7. Business logic (DB write)
8. In-transaction audit row (buildEvent → auditRowValues → tx.insert(auditLogs))
   -- audit write is in the SAME transaction as the mutation; rollback if audit fails
9. Return response — secrets NEVER in response body; masked_key / key_mask only
```

CSRF: every POST/PUT/PATCH/DELETE route must validate the CSRF double-submit token
(`verifyCsrf(cookieToken, headerToken)` from `packages/auth/src/csrf.ts`) before step 1.

---

## API Namespace Matrix

### `/api/auth/*` — Authentication

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `POST /login` | ✅ public | ✅ public | ✅ public | ✅ public | IP rate-limited; DB-backed account lockout; audit `auth.login` / `auth.login_failed` |
| `POST /register` | ✅ public | ✅ public | ✅ public | ✅ public | Rate-limited; successful DB-backed registration writes `auth.register` |
| `POST /logout` | ✅ own | ✅ own | ✅ own | ✅ own | Revokes current session; audit `auth.logout` |
| `POST /logout-all` | ✅ own | ✅ own | ✅ own | ✅ own | Revokes all sessions; audit `auth.logout_all` |
| `POST /change-password` | ✅ own | ✅ own | ✅ own | ✅ own | Invalidates all sessions; audit `auth.password_change` |
| `POST /reset-password` | ✅ public | ✅ public | ✅ public | ✅ public | Rate-limited; audit `auth.password_reset_request` / `auth.password_reset_success` |
| Admin force-password-reset | ❌ | ❌ | ✅ audit | ❌ | |

---

### `/api/me` — Own profile

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/me` | ✅ own | ✅ own | ✅ own | ✅ own | Never returns other users |
| `PATCH /api/me` | ✅ own | ✅ own | ✅ own | ❌ | Profile update; CSRF required |
| `DELETE /api/me` | ✅ own | ✅ own | ❌ | ❌ | Account deletion (soft delete); admin reviews |

---

### `/api/products/*` — Product catalog

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/products` | ✅ public | ✅ public | ✅ public | ✅ public | Metadata only; no pricing secrets |
| `GET /api/products/:code` | ✅ public | ✅ public | ✅ public | ✅ public | |
| `POST /api/products` | ❌ | ❌ | ✅ audit | ❌ | Create product record |
| `PATCH /api/products/:code` | ❌ | ❌ | ✅ audit | ❌ | Update product metadata |

---

### `/api/entitlements/*` — Access control

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/entitlements/me` | ✅ own | ✅ own | ✅ own | ✅ own | Own entitlements only |
| `GET /api/entitlements/:userId` | ❌ | ❌ | ✅ | ✅ | Support: read-only |
| `POST /api/entitlements/grant` | ❌ | ❌ | ✅ audit | ❌ | Manual admin grant; in-txn audit `product.grant` |
| `POST /api/entitlements/revoke` | ❌ | ❌ | ✅ audit | ❌ | Manual admin revoke; in-txn audit `product.revoke` |
| Billing-webhook grant/revoke | ❌ never (direct) | ❌ never | ❌ never (direct) | ❌ never | Only via webhook handler with verified signature |

---

### `/api/bots/*` — Bot management

All bot routes require both: (a) authenticated session and (b) active entitlement for the relevant product code (`tortila_bot` or `legacy_bot`).

#### Bot instances

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/bots` | ✅ own | ✅ own | ✅ all | ✅ all | Lists bot instances owned by user |
| `GET /api/bots/tortila/health` | ✅ entitlement | ✅ entitlement | ✅ | ✅ | |
| `GET /api/bots/legacy/health` | ✅ entitlement | ✅ entitlement | ✅ | ✅ | |

#### Bot metrics / monitoring (read-only)

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/bots/:bot/metrics` | ✅ own+entitlement | ✅ own+entitlement | ✅ | ✅ | |
| `GET /api/bots/:bot/positions` | ✅ own+entitlement | ✅ own+entitlement | ✅ | ✅ | |
| `GET /api/bots/:bot/trades` | ✅ own+entitlement | ✅ own+entitlement | ✅ | ✅ | |
| `GET /api/bots/:bot/equity` | ✅ own+entitlement | ✅ own+entitlement | ✅ | ✅ | |
| `GET /api/bots/:bot/safety` | ✅ own+entitlement | ✅ own+entitlement | ✅ | ✅ | |
| `GET /api/bots/:bot/decisions` | ✅ own+entitlement | ✅ own+entitlement | ✅ | ✅ | |

#### Bot configuration

Pipeline for `PUT /api/bots/:bot/config`: Zod → session auth → requireRole(user/admin) → requireEntitlement → requireOwnership(botInstance.userId) → save config → in-txn audit `bot.config.save` → return {version}; no secrets in response.

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/bots/:bot/config` | ✅ own+entitlement | ✅ own+entitlement | ✅ | ✅ | Keys masked in response; no vault material |
| `PUT /api/bots/:bot/config` | ✅ own+entitlement | ✅ own+entitlement | ✅ audit | ❌ | In-txn audit `bot.config.save`; creates new version |
| `DELETE /api/bots/:bot/config/:version` | ❌ | ❌ | ✅ audit | ❌ | In-txn audit `bot.config.version_delete` |
| `POST /api/bots/:bot/enable` | ✅ own+entitlement | ✅ own+entitlement | ✅ audit | ❌ | **Mock only** — no live action; audit `bot.enable` |
| `POST /api/bots/:bot/disable` | ✅ own+entitlement | ✅ own+entitlement | ✅ audit | ❌ | **Mock only** — no live action; audit `bot.disable` |

#### Exchange API keys

Pipeline for `POST /api/bots/:bot/keys`: Zod (key format validation only — no live exchange test) → session auth → requireRole(user/admin) → requireEntitlement → requireOwnership → `vault.seal(apiKey, aad)` → insert exchange_account + exchange_api_key_secrets in one transaction + in-txn audit `exchange_key.create` → return {id, label, key_mask}; NEVER return plaintext key.

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/bots/:bot/keys` | ✅ own — masked | ✅ own — masked | ✅ masked | ❌ | Returns `{id, label, key_mask, createdAt}` — NEVER plaintext |
| `POST /api/bots/:bot/keys` | ✅ own+entitlement | ✅ own+entitlement | ✅ audit | ❌ | Vault seal; in-txn audit `exchange_key.create` |
| `PUT /api/bots/:bot/keys/:id` | ✅ own+entitlement | ✅ own+entitlement | ✅ audit | ❌ | Re-seal; in-txn audit `exchange_key.update` |
| `DELETE /api/bots/:bot/keys/:id` | ✅ own+entitlement | ✅ own+entitlement | ✅ audit | ❌ | Null sealed column; in-txn audit `exchange_key.delete` |
| Return plaintext key in any response | ❌ never | ❌ never | ❌ never | ❌ never | **Hard rule; no exceptions** |

---

### `/api/axioma/*` — Axioma Terminal product

All routes require active `axioma_terminal` entitlement unless noted.

Pipeline for `POST /api/axioma/account-link/init`: Zod → session auth → requireRole(user/admin) → requireEntitlement(axioma_terminal) → generate one-time code (short random, 5-min TTL) → upsert axioma_account_links → in-txn audit `axioma.account_link_init` → return {code, expiresAt}; NEVER return the code after it has been consumed.

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/axioma/status` | ✅ entitlement | ✅ entitlement | ✅ | ✅ | License state, linked account status |
| `GET /api/axioma/releases` | ✅ entitlement | ✅ entitlement | ✅ | ✅ | Latest release metadata |
| `POST /api/axioma/account-link/init` | ✅ entitlement | ✅ entitlement | ✅ audit | ❌ | One-time code; audit `axioma.account_link_init`; code max TTL 5 min |
| `POST /api/axioma/account-link/complete` | ✅ entitlement | ✅ entitlement | ❌ | ❌ | Code consumed atomically; audit `axioma.account_link_complete` |
| `DELETE /api/axioma/account-link` | ✅ own | ✅ own | ✅ audit | ❌ | Revoke link; audit `axioma.account_link_revoke` |
| `GET /api/axioma/journal/redirect` | ✅ entitlement | ✅ entitlement | ✅ | ❌ | Returns signed redirect URL |
| `GET /api/axioma/download-url` | ✅ entitlement | ✅ entitlement | ✅ | ❌ | Signed time-limited URL; audit `axioma.download_request` |
| `POST /api/axioma/releases` | ❌ | ❌ | ✅ audit | ❌ | Publish new release; audit `axioma.release_publish` |

---

### `/api/tradingview-access/*` — TradingView Indicators

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/tradingview-access/me` | ✅ own | ✅ own | ✅ | ✅ | Own request/grant status |
| `POST /api/tradingview-access/request` | ✅ entitlement | ✅ entitlement | ✅ | ❌ | Submits TV username; in-txn audit `tradingview.submit` |
| `GET /api/tradingview-access/requests` (all) | ❌ | ❌ | ✅ | ✅ | Admin queue view |
| `POST /api/tradingview-access/grant` | ❌ | ❌ | ✅ audit | ❌ | In-txn audit `tradingview.grant` |
| `POST /api/tradingview-access/revoke` | ❌ | ❌ | ✅ audit | ❌ | In-txn audit `tradingview.revoke` |
| Automated TV credential actions | ❌ never | ❌ never | ❌ never | ❌ never | No credential stuffing; manual queue only |

---

### `/api/education/*` — LMS

#### Course management

Pipeline for `POST /api/education/courses`: Zod (title required, max 200 chars) → session auth → requireRole(teacher/admin) → insert course with ownerTeacherId = session.userId → in-txn audit `education.course_create` → return CourseDTO (no secrets).

Pipeline for `PUT /api/education/courses/:id`: Zod → session auth → requireRole(teacher/admin) → load course → requireOwnership(course.ownerTeacherId, session.userId) [admin bypasses] → update → in-txn audit `education.course_update`.

Pipeline for `PUT /api/education/lessons/:id`: Zod → session auth → requireRole(teacher/admin) → load lesson → load parent course → requireOwnership(course.ownerTeacherId, session.userId) → update → in-txn audit `education.lesson_update`.

Pipeline for `POST /api/education/materials`: Zod (url, label, kind) → session auth → requireRole(teacher/admin) → load material's lesson → load parent course → requireOwnership(course.ownerTeacherId, session.userId) → insert → in-txn audit `education.material_upload`.

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `GET /api/education/courses` | ✅ public+entitlement | ✅ own | ✅ all | ✅ all | Students see published+entitled only (SQL filter) |
| `GET /api/education/courses/:id` | ✅ if entitled or free | ✅ own | ✅ | ✅ | |
| `GET /api/education/lessons/:id` | ✅ if enrolled+entitled | ✅ own | ✅ | ✅ | 404 (not 403) for unentitled |
| `POST /api/education/courses` | ❌ | ✅ own | ✅ audit | ❌ | In-txn audit `education.course_create` |
| `PUT /api/education/courses/:id` | ❌ | ✅ own only | ✅ audit | ❌ | In-txn audit `education.course_update`; ownership check |
| `PATCH /api/education/courses/:id/publish` | ❌ | ✅ own only | ✅ audit | ❌ | In-txn audit `education.course_publish` |
| `DELETE /api/education/courses/:id` | ❌ | ❌ | ✅ audit | ❌ | Soft delete; in-txn audit `education.course_delete` |
| `POST /api/education/lessons` | ❌ | ✅ own course | ✅ audit | ❌ | In-txn audit `education.lesson_create`; ownership via parent course |
| `PUT /api/education/lessons/:id` | ❌ | ✅ own course | ✅ audit | ❌ | In-txn audit `education.lesson_update` |
| `DELETE /api/education/lessons/:id` | ❌ | ✅ own course | ✅ audit | ❌ | In-txn audit `education.lesson_delete` |
| `POST /api/education/materials` | ❌ | ✅ own lesson | ✅ audit | ❌ | In-txn audit `education.material_upload` |
| `DELETE /api/education/materials/:id` | ❌ | ✅ own lesson | ✅ audit | ❌ | In-txn audit `education.material_delete` |
| `GET /api/education/enrollments` | ✅ own | ✅ own enrolled | ✅ all | ✅ all | |
| `POST /api/education/enroll` | ✅ entitlement | ✅ entitlement | ✅ audit | ❌ | requireEntitlement(education); in-txn audit `education.enroll` |
| `POST /api/education/progress` | ✅ own | ✅ own | ✅ | ❌ | requireOwnership(enrollment.userId); in-txn audit `education.progress` |
| `GET /api/education/students` (all) | ❌ | ✅ own course students | ✅ | ✅ | Teacher sees only own course students |

---

### `/api/admin/*` — Administration

All admin routes require `admin` role. Every mutating admin action is audit logged. Read-only admin routes are also accessible to `support` as noted.
Current App Router implementation note: account unlock is implemented as a `/admin/users` server action with
`assertAdmin()`, CSRF validation, a 10-character minimum reason, and in-transaction `auth.account_unlock` audit. The REST-like
route name below is the contract notation for that mutation family.

| Action | admin | support | Notes |
|--------|-------|---------|-------|
| `GET /api/admin/users` | ✅ | ✅ | |
| `GET /api/admin/users/:id` | ✅ | ✅ | |
| `PATCH /api/admin/users/:id/role` | ✅ audit | ❌ | In-txn audit `admin.user_role_assign` / `admin.user_role_revoke` |
| `POST /api/admin/users/:id/unlock` | ✅ audit | ❌ | In-txn audit `auth.account_unlock` |
| `GET /api/admin/entitlements` | ✅ | ✅ | |
| `POST /api/admin/entitlements/grant` | ✅ audit | ❌ | In-txn audit `product.grant`; Zod requires `reason` min 10 chars |
| `POST /api/admin/entitlements/revoke` | ✅ audit | ❌ | In-txn audit `product.revoke`; Zod requires `reason` min 10 chars |
| `GET /api/admin/audit-log` | ✅ | ✅ | Read-only; support can view |
| `GET /api/admin/system-health` | ✅ | ✅ | |
| `GET /api/admin/bots` | ✅ | ✅ | |
| `GET /api/admin/tradingview-access` | ✅ | ✅ | |
| `POST /api/admin/tradingview-access/grant` | ✅ audit | ❌ | In-txn audit `tradingview.grant` |
| `POST /api/admin/tradingview-access/revoke` | ✅ audit | ❌ | In-txn audit `tradingview.revoke` |
| `GET /api/admin/education` | ✅ | ✅ | |
| `DELETE /api/admin/education/*` | ✅ audit | ❌ | In-txn audit per entity type |
| `GET /api/admin/axioma` | ✅ | ✅ | Release/license diagnostics |
| `POST /api/admin/axioma/releases` | ✅ audit | ❌ | In-txn audit `axioma.release_publish` |

---

### `/api/support/*` — Support tickets

Pipeline for `POST /api/support/tickets`: Zod (subject required, min 5 chars; body required, min 10 chars) → session auth → requireRole(user/teacher/admin/support) → insert ticket with userId = session.userId → in-txn audit `support.ticket_create` → return {id, subject, status}.

Pipeline for `POST /api/support/tickets/:id/reply`: Zod → session auth → requireRole(user/teacher/admin/support) → load ticket → if user role: requireOwnership(ticket.userId, session.userId) → insert reply → in-txn audit `support.ticket_reply`.

| Action | user | teacher | admin | support | Notes |
|--------|------|---------|-------|---------|-------|
| `POST /api/support/tickets` | ✅ own | ✅ own | ✅ | ✅ | In-txn audit `support.ticket_create` |
| `GET /api/support/tickets` | ✅ own | ✅ own | ✅ all | ✅ all | |
| `GET /api/support/tickets/:id` | ✅ own | ✅ own | ✅ | ✅ | |
| `POST /api/support/tickets/:id/reply` | ✅ own | ✅ own | ✅ | ✅ | In-txn audit `support.ticket_reply` |
| `PATCH /api/support/tickets/:id/status` | ❌ | ❌ | ✅ audit | ✅ | In-txn audit `support.ticket_status_change` |

---

## Teacher Object-Ownership Rules

The following rules are enforced at the DB query level (not only at the middleware level):

1. **Course ownership**: `courses.owner_teacher_id = session.userId` — checked on every teacher mutating route. Column name in schema: `ownerTeacherId`.
2. **Lesson ownership**: `lessons.course_id → courses.owner_teacher_id = session.userId` — teachers cannot modify lessons in other teachers' courses.
3. **Material ownership**: `materials.lesson_id → lessons.course_id → courses.owner_teacher_id = session.userId` — same chain.
4. **Admin bypass**: if `session.roles.includes('admin')`, the ownership check is skipped via `canActOnOwned()` in `packages/auth/src/rbac.ts`; the action proceeds and is audit logged.
5. **No cross-teacher read of drafts**: unpublished courses/lessons from another teacher are not returned in any query for teacher users.

---

## Student Non-Enumeration Rules

To prevent a student from probing for hidden or unentitled content:

1. **List endpoints** (`GET /api/education/courses`, `GET /api/education/lessons`): SQL WHERE clause includes `published = true AND (is_free = true OR EXISTS(SELECT 1 FROM entitlements WHERE user_id=$userId AND product_code='education' AND status IN ('active','grace')))`. This filter is applied at the database, not post-fetch.
2. **Detail endpoints** (`GET /api/education/courses/:id`, `/lessons/:id`): return `404` (not `403`) when the content exists but the student is not entitled. This prevents confirming the existence of hidden content.
3. **Admin/teacher preview**: admins and owning teachers receive a flag `published: false` in responses to distinguish draft visibility, but this flag is never returned to student-role requests.
4. **Lesson list within a course**: only entitled students can see the lesson list. If not entitled, the course detail endpoint returns the course description and CTA to purchase, but not the lesson list.

---

## Admin Override Audit Requirement

Any admin action that modifies access state or user data must satisfy all of the following before it is accepted:

| Requirement | Enforcement |
|-------------|-------------|
| Admin role verified | Server-side `assertAdmin(session.roles)` — first line of the action body |
| Reason field provided | Zod schema requires non-empty `reason: z.string().min(10)` for grant/revoke and account unlock |
| Audit log row written atomically | DB transaction: audit write + action write in same transaction; if audit write fails, action is rolled back |
| Actor identity recorded | `actor_user_id`, `actor_role` from session (not from request body) |
| Immutable record | `audit_logs` rows are never updated or deleted |
| Notification to affected user | Target policy; current local account unlock does not queue notification yet |

If a support user attempts an admin-only mutation, the request is rejected with `403`. Read-only escalation audit is still a
target policy unless a route/action explicitly implements it.

---

## Phase-2 RBAC Resource additions

The following resources must be added to the `Resource` type in `packages/auth/src/rbac.ts` as routes are built:

| Resource token | Covers |
|----------------|--------|
| `lesson` | Education lessons (currently merged into `course` in rbac.ts) |
| `enrollment` | Course enrollments |
| `bot_instance` | Bot instance lifecycle |
| `exchange_account` | Exchange account metadata (non-secret) |
| `terminal_account_link` | Axioma account link state |
| `support_ticket_reply` | Replies to support tickets |

Until these are added, the `admin.action` catchall audit code and `can(roles, 'course', action)` checks may be used as a temporary bridge. The bridge MUST be replaced with the specific resource before any Phase-2 route ships to production.
