# Handoff: ecosystem-security-auditor — Phase 2.3 Read-Only Security Audit

**Epoch:** 20260530-1145
**Agent:** ecosystem-security-auditor
**Wave:** Phase 2.3 — READ-ONLY audit, zero code edits

---

## Scope

Full security audit of every new Phase 2.3 mutation path across all seven Parts, producing:
- Per-mutation server-side pipeline tables (Zod → session → CSRF → RBAC → ownership → repo/txn → audit → revalidate)
- Billing webhook specifics: signature-first, CSRF-exempt, raw-body, idempotency, secrets-in-audit check
- TV grant/revoke with reason/duration audit
- Terminal download/license entitlement-verified semantics
- Admin console assertAdmin-in-each-action check
- Part 0 LMS correctness fixes: four concrete bugs with recommended remediation
- No-secrets checklist
- Regression test spec

Files inspected cover packages/auth, packages/audit, packages/billing, packages/axioma-bridge, packages/db, packages/lms, apps/web/src/lib, apps/web/src/features/lms, apps/web/src/app/.well-known, apps/web/src/app/(auth), and all relevant docs/CONTRACTS.

---

## Files inspected

| File | Lines read |
|---|---|
| `packages/auth/src/rbac.ts` | 1–96 |
| `packages/auth/src/csrf.ts` | 1–32 |
| `apps/web/src/lib/csrf.tsx` | 1–35 |
| `apps/web/src/lib/session.ts` | 1–25 |
| `apps/web/src/lib/backend.ts` | 1–113 |
| `apps/web/src/lib/access.ts` | 1–34 |
| `apps/web/src/lib/db-store.ts` | 1–165 |
| `packages/db/src/repositories.ts` | 1–933 |
| `packages/db/src/schema.ts` | 170–200, 355–410, 540–560, 460–475 |
| `apps/web/src/features/lms/queries.ts` | 1–216 |
| `apps/web/src/features/lms/actions.ts` | 1–216 |
| `packages/audit/src/audit.ts` | 1–188 |
| `packages/audit/src/redact.ts` | 1–56 |
| `packages/billing/src/stripe.ts` | 1–69 |
| `packages/billing/src/webhook.ts` | 1–70 |
| `packages/billing/src/provider.ts` | 1–76 |
| `packages/axioma-bridge/src/es256.ts` | 1–91 |
| `packages/axioma-bridge/src/jwks.ts` | 1–15 |
| `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` | 1–27 |
| `apps/web/src/app/(auth)/actions.ts` | 1–62 |
| `packages/lms/src/guards.ts` | 1–32 |
| `packages/lms/src/types.ts` | 1–100 |
| `docs/CONTRACTS/billing-webhooks.md` | all |
| `docs/CONTRACTS/tradingview-access.md` | all |
| `docs/handoffs/0000-orchestrator-seed.md` | all |

---

## Files changed

None — read-only audit

---

## Findings

### F-01 — HIGH — Part 0 — loadTeacherCourse fetches roster before ownership check (read-isolation bug)

**Evidence:** `apps/web/src/features/lms/queries.ts:103–118`

`loadTeacherCourse` calls `getCourseById` (line 106), then immediately builds `courseAdmin` (line 108) which internally calls `getCourseCounts` — both reads happen before any ownership check. Then `listLessonsForCourse` (line 109) and `getCourseStudentList` (line 110) are called, also before any ownership guard. The call site (teacher course page) must independently enforce ownership, but the function itself provides no built-in safety guarantee, meaning a miscalled path would expose another teacher's lesson list and student roster.

**Recommendation (Part 0 fix a):** Add an ownership guard at the top of `loadTeacherCourse`:

```typescript
// apps/web/src/features/lms/queries.ts  ~line 105
export async function loadTeacherCourse(userId: string, isAdmin: boolean, courseId: string): Promise<TeacherCourseDetail | null> {
  const db = getServerDb();
  if (!db) return null;
  const c = await getCourseById(db, courseId);
  if (!c) return null;
  // OWNERSHIP GATE — before any data is loaded
  const profile = await getTeacherProfile(db, userId);
  assertTeacherOwns({
    isAdmin,
    actorUserId: userId,
    actorTeacherProfileId: profile?.id ?? null,
    courseOwnerTeacherId: c.ownerTeacherId,
    courseTeacherProfileId: c.teacherProfileId,
  });
  // ... rest of the function unchanged
```

The `assertTeacherOwns` call must precede the `courseAdmin`, `listLessonsForCourse`, and `getCourseStudentList` calls. This is a correctness fix, not a new migration.

---

### F-02 — HIGH — Part 0 — adminEnrollAction audit actor is the enrolled student, not the admin

**Evidence:** `apps/web/src/features/lms/actions.ts:204–215` and `packages/db/src/repositories.ts:667–677`

`adminEnrollAction` (actions.ts:213) calls `upsertEnrollment(db, { userId: parsed.data.userId, courseId: ... })` — it passes the target student's `userId` as `input.userId`. Inside `upsertEnrollment` (repositories.ts:671), the audit row is written with `actorUserId: input.userId` — which is the **enrolled student's id**, not the admin actor id. An admin enrolling a student is therefore recorded in audit_logs as if the student enrolled themselves, with `actorRole: 'user'`.

This violates the audit log spec (actor must be the actual principal performing the action) and prevents distinguishing admin-forced enrollments from self-enrollments in the audit trail.

**Recommendation (Part 0 fix b):** Add an `actorUserId` parameter to `upsertEnrollment` (or add a separate `adminUpsertEnrollment` repo that writes the audit row with the admin actor):

```typescript
// packages/db/src/repositories.ts — upsertEnrollment signature change
export async function upsertEnrollment(
  db: Db,
  input: { userId: string; courseId: string; entitlementId?: string; actorUserId?: string; actorRole?: string },
  now = Date.now(),
): Promise<EnrollmentRow>
```

Inside the function, write the audit row as:
```typescript
// When actorUserId differs from userId, this is an admin/system enrollment
const isAdminEnroll = input.actorUserId && input.actorUserId !== input.userId;
await tx.insert(s.auditLogs).values(auditRowValues({
  actorUserId: input.actorUserId ?? input.userId,
  actorRole: isAdminEnroll ? 'admin' : 'user',
  action: 'education.enrolled',
  targetType: 'enrollment',
  targetId: inserted.id,
  after: { courseId: input.courseId, enrolledUserId: input.userId },
}, now));
```

Call site in `adminEnrollAction`:
```typescript
await upsertEnrollment(db, {
  userId: parsed.data.userId,
  courseId: parsed.data.courseId,
  actorUserId: user.id,        // the admin
  actorRole: 'admin',
});
```

Self-enrollment call sites (`enrollAction` line 173, `markLessonCompleteAction` line 190) omit `actorUserId` (defaults to `userId`).

---

### F-03 — MEDIUM — Part 0 — markEnrollmentComplete audit targetId is courseId, not enrollmentId

**Evidence:** `packages/db/src/repositories.ts:682–687`

```typescript
await tx.insert(s.auditLogs).values(auditRowValues({
  actorUserId: userId,
  actorRole: 'user',
  action: 'education.course_completed',
  targetType: 'enrollment',      // ← correct type
  targetId: courseId,            // ← WRONG: should be the enrollment row id
  after: { courseId }
}, now));
```

`targetType` is `'enrollment'` but `targetId` is `courseId` (a course UUID). The audit schema requires `targetId` to be the id of the `targetType` entity. The enrollment row id is available because `markEnrollmentComplete` receives the `userId + courseId` pair and updates `enrollments WHERE (userId, courseId)` — the enrollment id must be fetched first.

**Recommendation (Part 0 fix c):** Fetch the enrollment row before updating it, then use its `id` as `targetId`:

```typescript
export async function markEnrollmentComplete(db: Db, userId: string, courseId: string, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    const [enrollment] = await tx.select({ id: s.enrollments.id })
      .from(s.enrollments)
      .where(and(eq(s.enrollments.userId, userId), eq(s.enrollments.courseId, courseId)))
      .limit(1);
    if (!enrollment) return;  // already completed or not enrolled
    await tx.update(s.enrollments).set({ completedAt: new Date(now) }).where(eq(s.enrollments.id, enrollment.id));
    await tx.insert(s.auditLogs).values(auditRowValues({
      actorUserId: userId,
      actorRole: 'user',
      action: 'education.course_completed',
      targetType: 'enrollment',
      targetId: enrollment.id,   // ← correct: enrollment row id
      after: { courseId }
    }, now));
  });
}
```

---

### F-04 — HIGH — Part 0 — createCourse never sets teacherProfileId; ownership degrades to user-id fallback

**Evidence:** `packages/db/src/repositories.ts:356–366` and `packages/db/src/schema.ts:172–183`

`createCourse` at repositories.ts:358–365 inserts with `ownerTeacherId: input.ownerTeacherId` (the user's `users.id`) but never populates `teacherProfileId` (the `teacher_profiles.id` FK added in migration 0002). The schema at schema.ts:177 shows `teacherProfileId` is nullable and references `teacherProfiles`. The `assertTeacherOwns` guard (packages/lms/src/guards.ts:22–25) first checks `ownsByProfile` (teacher_profile_id match), then falls back to `ownsByUser` (owner_teacher_id = users.id match). As long as `teacherProfileId` is never set on courses, the profile-based ownership path is never exercised, and a teacher who has a `teacher_profiles` row but whose `users.id` differs from `courses.owner_teacher_id` (due to a migration or import anomaly) could be incorrectly denied.

Additionally, `createCourseAction` (actions.ts:64) calls `createCourse(db, { ownerTeacherId: user.id, ... })` — passing the users.id directly. If a teacher_profiles row exists for this user, its id is never linked.

**Recommendation (Part 0 fix d):** Extend `createCourse` input to accept an optional `teacherProfileId`, and update `createCourseAction` to look up the actor's teacher profile first:

```typescript
// packages/db/src/repositories.ts — createCourse input type
export async function createCourse(
  db: Db,
  input: { ownerTeacherId: string; teacherProfileId?: string | null; title: string; description?: string; published?: boolean },
  now = Date.now()
): Promise<CourseDTO>
```

Inside the insert, include `teacherProfileId: input.teacherProfileId ?? null`.

```typescript
// apps/web/src/features/lms/actions.ts — createCourseAction
export async function createCourseAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  await assertCsrf(formData);
  const { isTeacher } = roles(user);
  if (!isTeacher) return;
  const parsed = createCourseSchema.safeParse({ ... });
  if (!parsed.success) return;
  const db = getServerDb();
  if (!db) return;
  // Look up teacher profile to populate teacherProfileId
  const { getTeacherProfile } = await import('@wtc/db');
  const profile = await getTeacherProfile(db, user.id);
  await createCourse(db, {
    ownerTeacherId: user.id,
    teacherProfileId: profile?.id ?? null,
    title: parsed.data.title,
    description: parsed.data.description,
    published: false,
  });
  revalidatePath('/teacher/courses');
}
```

The `ownerTeacherId` (users.id) is kept as the authoritative FK for existing rows; `teacherProfileId` is supplemental and the source of truth for the `ownsByProfile` path going forward.

---

### F-05 — HIGH — Part 1 — POST /api/billing/webhook does not exist; no middleware.ts to exempt it

**Evidence:** `apps/web/src/app` directory — only `(auth)/actions.ts` and `.well-known/axioma-jwks.json/route.ts` exist. No `middleware.ts` found at any level.

The billing webhook route handler (`apps/web/src/app/api/billing/webhook/route.ts`) does not yet exist. The billing-webhooks.md contract (§3) requires the route to be:
- CSRF-exempt (raw body must reach the handler unmodified)
- Excluded from any request-logging middleware that logs request bodies
- Rate-limited at the reverse proxy (nginx)

Since there is no `apps/web/src/middleware.ts` today, there is no CSRF middleware intercepting API routes. When the webhook route is built for Part 1, the implementation must **not** add a CSRF check to this route (signature is its sole auth), and must **not** parse the request body via Next.js's automatic JSON parsing (use `req.text()` to get the raw string before any framework processing). The absence of middleware today is a neutral observation; the risk is that future middleware additions (e.g., adding auth/CSRF to `/api/**`) could inadvertently break the webhook if `/api/billing/webhook` is not explicitly excluded.

**Recommendation (Part 1):** When implementing the webhook route:
1. Use `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'` at the top of the route file.
2. Read the raw body with `const rawBody = await req.text()` before any JSON.parse.
3. Read `stripe-signature` header with `req.headers.get('stripe-signature') ?? ''`.
4. Signature verification (`verifyWebhookSignature`) is the FIRST operation before any DB or state access.
5. Never pass `rawBody` or the signature header value to the audit logger. Log only `eventId` and `eventType` in the `billing.webhook_received` audit row (already enforced by the existing `applyStripeEvent` repo which records `billingEvent` enum value, not raw body).
6. If/when a `middleware.ts` is added, include an explicit matcher that excludes `/api/billing/webhook` from any CSRF or body-logging middleware.

---

### F-06 — HIGH — Part 1 — billing-webhooks.md contract references webhook_idempotency_keys table that does not exist

**Evidence:** `docs/CONTRACTS/billing-webhooks.md` §7 specifies a `webhook_idempotency_keys` PostgreSQL table for idempotency. Phase 2.1 deliberately used `audit_logs` as the dedupe ledger instead (repositories.ts:909–910: `SELECT id FROM audit_logs WHERE action='billing.webhook_received' AND target_id=$stripeEventId`). The table does not exist in migration 0002 (38-table schema).

**Recommendation (Part 1):** Update `docs/CONTRACTS/billing-webhooks.md` §7 to document the confirmed deviation:
- Replace the `webhook_idempotency_keys` table spec with: "Idempotency store: `audit_logs` table, action=`billing.webhook_received`, `target_id`=`stripeEventId`. A dedicated `billing_webhook_events` table is a documented TARGET for higher-throughput dedupe — see docs/ARCHITECTURE_DECISIONS.md."
- The `applyStripeEvent` implementation at repositories.ts:909 already correctly uses the audit ledger; the doc is the source of drift, not the code.

---

### F-07 — MEDIUM — Part 1 — applyStripeEvent audit row includes full billingEvent enum in `after` payload; acceptable but worth documenting

**Evidence:** `packages/db/src/repositories.ts:911`

```typescript
await tx.insert(s.auditLogs).values(auditRowValues({
  ...
  after: { billingEvent: input.billingEvent, planCode: input.planCode ?? null }
}, now));
```

`input.billingEvent` is a `BillingEvent` enum value (e.g., `'payment_succeeded'`) — this is safe. The raw Stripe body is never logged here. The `redact()` function (redact.ts:46–55) would not strip this because it is not a secret-hint key. This is correct behaviour.

However, the `NormalizedEvent.raw` field (provider.ts:21: `raw: unknown`) from `parseWebhook` in stripe.ts:62 captures the full Stripe event object. This `raw` field must never be forwarded to `applyStripeEvent` or written to any audit row. The current `applyStripeEvent` signature (repositories.ts:903–905) only accepts `stripeEventId`, `billingEvent`, `userId`, `productCodes`, and `planCode` — it does NOT accept a `raw` parameter. This is correct and safe.

**Recommendation (Part 1):** Document explicitly in the route handler that `event.raw` from `parseWebhook` is discarded after extracting the above fields. A comment like `// event.raw is intentionally not persisted — only the normalized fields above reach the DB` is sufficient.

---

### F-08 — HIGH — Part 2 — grantTv/revokeTv use old request-centric repos; createTvGrant/revokeTvGrant (migration 0002 repos) not yet wired to the TvService

**Evidence:** `apps/web/src/lib/db-store.ts:142–147` — `tvService.grant` calls `rGrantTv` (the old `tradingview_access_requests`-only path). `rRevokeTv` likewise. The Phase 2.1 migration 0002 added `tradingview_profiles` and `tradingview_access_grants` tables with repos `createTvGrant` and `revokeTvGrant` (repositories.ts:748–770), but these are not wired into the TvService used by admin actions.

`grantTv` (repositories.ts:288–293) updates only `tradingview_access_requests`; it does not insert into `tradingview_access_grants`. `createTvGrant` (repositories.ts:748–758) inserts into `tradingview_access_grants` AND upserts `tradingview_profiles.currentGrantId`. These are two separate code paths — only one is used today.

Also: `revokeTvGrant` at repositories.ts:761–769 accepts a `reason?` string and records it in the `tradingview_access_grants.revokeReason` column (schema.ts:470). The existing `revokeTv` (repositories.ts:296–300) does not record a reason at all. The TV contract (tradingview-access.md) lists "Reason field" as a TARGET gap.

**Recommendation (Part 2):** Wire the Part 2 admin grant/revoke actions through `createTvGrant` + `revokeTvGrant` rather than the legacy `grantTv`/`revokeTv`. The TvService interface should grow a `reason?: string` parameter on `revoke`. The admin action must:
1. Call `assertAdmin(actor.roles)` as the first line.
2. Perform a fail-closed entitlement re-check: `const access = await accessFor(targetUserId, 'tradingview_indicators'); if (!access.allowed) return;` before calling `createTvGrant`.
3. Accept `durationDays` from admin form input (Zod-validated: integer, 1–365), defaulting to 90 days.
4. Accept `reason` from admin form input (Zod-validated: non-empty string).
5. State guard: only `pending` requests can be granted (check `request.status === 'pending'` inside the action before calling the repo).

**Pipeline table for TV grant (Part 2 target):**

| Step | Implementation |
|---|---|
| assertCsrf | `assertCsrf(formData)` |
| requireUser | `requireUser()` |
| assertAdmin | `assertAdmin(user.roles)` |
| Zod | `z.object({ requestId: z.string().uuid(), durationDays: z.number().int().min(1).max(365), reason: z.string().min(1).max(500) })` |
| state guard | fetch request row, check `status === 'pending'` |
| entitlement re-check | `accessFor(request.userId, 'tradingview_indicators').allowed` |
| repo (in-txn audit) | `createTvGrant(db, { requestId, userId, tvUsername, grantedAt, expiresAt, grantedBy: actor.id, grantedByType: 'admin' })` |
| revalidate | `revalidatePath('/admin/tradingview-access')` |

---

### F-09 — MEDIUM — Part 2 — tradingview-access.md doc is STALE: claims tradingview_profiles and tradingview_access_grants are TARGET

**Evidence:** `docs/CONTRACTS/tradingview-access.md` — "Tables TARGET (not implemented): `tradingview_profiles` + `tradingview_access_grants`" in the Reality statement. The orchestrator seed ground truth confirms these tables landed in migration 0002. `packages/db/src/schema.ts` and `repositories.ts` contain both tables and their full repo suite (`upsertTradingViewProfile`, `getTvProfile`, `createTvGrant`, `revokeTvGrant`, `listTvGrantsForUser`, `listAllTvGrants`).

**Recommendation (Part 0 / Part 2):** Update `docs/CONTRACTS/tradingview-access.md` Reality statement:
- Move `tradingview_profiles` and `tradingview_access_grants` from "TARGET" to "CURRENT".
- Update the "Tables CURRENT" list to include all four: `tradingview_access_requests`, `tradingview_access_tasks`, `tradingview_profiles`, `tradingview_access_grants`.
- Update the `TvRequestDTO` section to reflect that `revokedAt`/`revokedBy` ARE present on the `tradingview_access_requests` row (added in migration 0002 — confirmed at repositories.ts:266–270).

---

### F-10 — MEDIUM — Part 3 — recordDownloadEvent.entitlementVerified is a caller-supplied boolean; no enforcement that the caller actually checked

**Evidence:** `packages/db/src/repositories.ts:814–818`

```typescript
export async function recordDownloadEvent(
  db: Db,
  input: { ...; entitlementVerified: boolean },
  now = Date.now()
): Promise<void>
```

The repo blindly stores whatever boolean the caller passes. The integration test at `tests/integration/db-0002.test.ts:192` passes `entitlementVerified: true` but does not exercise the failure path (i.e., confirm the download is blocked when `entitlementVerified: false`). The repo's responsibility is recording; enforcement must happen at the route handler / server action level. If a miscoded Part 3 handler calls `recordDownloadEvent(db, { ..., entitlementVerified: true })` without actually checking the entitlement, the field becomes meaningless.

**Recommendation (Part 3):** The terminal download server action MUST perform `accessFor(userId, 'axioma_terminal')` first and pass the `.allowed` result as `entitlementVerified`. The action must return early (fail-closed) when `allowed === false`. The `entitlementVerified: false` path should still record the download attempt to the DB (it is a security signal, not a success) but must return a 403-equivalent to the client before serving a download URL. Test spec: one unit test for `entitlementVerified: true` (download proceeds) and one for `false` (no URL served, attempt recorded).

---

### F-11 — MEDIUM — Part 3 — ES256/JWKS private key safety confirmed; one gap: jti replay is in-memory only, no durable cross-process store

**Evidence:** `packages/axioma-bridge/src/es256.ts:47` — `publicJwk()` hard-asserts `if ('d' in jwk) throw new Error(...)` — the private scalar never reaches the JWKS output. The `apps/web/src/app/.well-known/axioma-jwks.json/route.ts` returns an empty key set if the PEM is misconfigured (no stack trace leaks). This is correct.

Gap: `verifyEs256HandoffToken` (es256.ts:57) accepts an optional `isReplayed` callback. The spec at AXIOMA_HANDOFF_TOKEN_SPEC.md requires jti replay prevention, but there is no durable `jti` store — the callback is marked as "TARGET durability". In the current state a handoff token can be replayed if the Axioma verifier does not maintain its own store.

**Recommendation (Part 3):** Document in the Part 3 implementation: "jti replay prevention is TARGET — no durable jti store table exists. The `isReplayed` callback is optional and no persistent store is wired. The 5-minute token expiry (`exp`) is the only replay mitigation in production today." Add `axioma_handoff_jti` table design to OPEN_QUESTIONS.md. Never gate local order execution on this token (hard rule 5 of the orchestrator seed).

---

### F-12 — HIGH — Part 4 — assertAdmin must be the first statement inside EACH admin server action, not only in layout

**Evidence:** `packages/auth/src/rbac.ts:93–95` documents this requirement explicitly. The two existing admin surfaces confirm correct placement:
- `apps/web/src/app/admin/entitlements/page.tsx` line 12: `assertAdmin(actor.roles)` is the second statement (after `requireUser()`) in `grantAction`.
- `apps/web/src/app/admin/tradingview-access/page.tsx` lines 14 and 22: same pattern.

**Risk for Part 4 new surfaces:** Every new server action in `/admin/users`, `/admin/products`, `/admin/system-health`, `/admin/support` MUST follow the same `requireUser()` → `assertAdmin(user.roles)` → `assertCsrf(formData)` → Zod pattern. The `assertAdmin` MUST NOT be moved to a shared wrapper that is only called conditionally or post-Zod.

**Recommendation (Part 4):** For support ticket status update actions specifically, verify that:
- `assertAdmin` or `assertRole(['support', 'admin'])` is the first post-session check (not left to the layout middleware).
- The `updateSupportTicket` call passes `actorId: user.id` so the audit row has the correct actor.
- The audit action is `support.ticket_update` (already in AUDIT_ACTIONS at audit.ts:90).

**Pipeline table for admin support ticket update (Part 4 target):**

| Step | Implementation |
|---|---|
| requireUser | `const user = await requireUser()` |
| RBAC | `if (!user.roles.includes('support') && !user.roles.includes('admin')) return` |
| assertCsrf | `await assertCsrf(formData)` |
| Zod | `z.object({ ticketId: z.string().uuid(), status: z.enum(['open','in_progress','resolved','closed']), ... })` |
| getServerDb | fail-closed, no-op in demo mode |
| repo (in-txn audit) | `updateSupportTicket(db, ticketId, patch, user.id)` |
| revalidate | `revalidatePath('/admin/support')` |

---

### F-13 — MEDIUM — Part 4 — admin user listing must not leak email where displayName suffices

**Evidence:** `packages/db/src/repositories.ts:56–59`

`listUsers` returns full `DbUser` objects including `email` and `passwordHash`. The `DbUser.passwordHash` must never reach any admin UI surface — but `listUsers` already includes it in the returned shape. Any Part 4 admin user table must map rows to a display DTO before rendering.

**Recommendation (Part 4):** Define an `AdminUserView` DTO that omits `passwordHash` and conditionally includes `email` (show email only to `admin`, not to `support`):

```typescript
interface AdminUserView {
  id: string;
  displayName: string;
  email?: string;        // omit for support role
  roles: string[];
}
```

The `system_health` resource in the RBAC matrix (rbac.ts:53) grants `read` to both `admin` and `support`. User details (email) grant `read` only to `admin` and `support` (rbac.ts:31). A support agent CAN read email per the current matrix, but implementation should use the explicit DTO mapping rather than forwarding raw `DbUser` to client components.

---

### F-14 — LOW — Part 5 — bot dashboard read-only: RBAC matrix confirms no write path for users; live control is disabled by policy

**Evidence:** `packages/auth/src/rbac.ts:36` — `bot_instance: { read: ['user', 'admin'], create: ['user'], update: ['user'], manage: ['admin'] }`. The policy "live control is always disabled by policy" is documented inline at rbac.ts:35. The orchestrator seed hard rule 3 and rule 5 both prohibit live bot control from WTC.

No new findings for Part 5 beyond confirming the matrix is correct and that any dashboard surface for bots must be read-only for `user` (no action buttons that forward commands to the live bot). The `bot_safety_events` display of risk signals (TP mismatch, margin, rate limits) is read-only and is explicitly required to surface warnings, never hide them (orchestrator seed, line 29–31).

---

### F-15 — LOW — Part 6 — sweepTvExpiry does not write audit rows for scheduler-driven expiry transitions

**Evidence:** `packages/db/src/repositories.ts:303–315`

`sweepTvExpiry` updates request status to `'expired'` and inserts `tradingview_access_tasks` rows but writes no `audit_logs` entry. The Phase 2.1 audit.ts registers `'tradingview.expire'` as a valid action (audit.ts:55) but no code path writes it.

**Recommendation (Part 2/6):** Add an in-txn audit row inside the per-row loop in `sweepTvExpiry`:

```typescript
await db.insert(s.auditLogs).values(auditRowValues({
  actorRole: 'system',
  action: 'tradingview.expire',
  targetType: 'tradingview_access_request',
  targetId: r.id,
  after: { status: 'expired' }
}, now));
```

This is a correctness/compliance fix rather than a security finding, but it is required for a complete audit trail.

---

## Decisions

1. **Billing webhook idempotency:** Confirmed deviation from docs/CONTRACTS/billing-webhooks.md — `audit_logs` ledger is the actual dedupe store, not a `webhook_idempotency_keys` table. The doc must be updated; the code is correct. No migration 0003 is needed for this.

2. **CSRF exemption for webhook:** No middleware.ts exists today. The billing webhook route (Part 1) MUST NOT include CSRF validation — its sole auth is the Stripe-Signature HMAC. Document this exclusion explicitly in the route file and in any future middleware matcher.

3. **assertAdmin placement:** All existing admin server actions follow the correct `requireUser()` → `assertAdmin()` → `assertCsrf()` → Zod pattern. New Part 4 actions must replicate this exact order.

4. **Part 0 LMS correctness fixes:** All four are correctness bugs (not style), two are HIGH (ownership isolation, audit actor identity), one is MEDIUM (audit targetId semantics), one is HIGH (teacher profile linkage). All are code-only fixes, no new migration required.

5. **TV grant/revoke Part 2:** Must switch from legacy `grantTv`/`revokeTv` to `createTvGrant`/`revokeTvGrant` repos (migration 0002 paths). Entitlement re-check at grant time is mandatory. Reason and duration are mandatory form fields.

6. **ES256 private key:** Confirmed never exposed. `publicJwk()` hard-asserts no `d` scalar. JWKS route returns empty set on misconfiguration, no stack trace.

7. **entitlementVerified enforcement:** The boolean must be set from an actual `accessFor` call, not hardcoded `true`. Route handler must fail-closed before serving any download URL.

---

## Risks

| Risk | Severity | Mitigated by |
|---|---|---|
| loadTeacherCourse exposes cross-teacher data (F-01) | HIGH | Fix required before any teacher course surface goes live |
| adminEnrollAction audit records wrong actor (F-02) | HIGH | Fix required; confounds audit-based forensics |
| Webhook route body parsing by Next.js middleware (F-05) | HIGH | No middleware.ts today; add exclusion comment to future middleware |
| billing-webhooks.md doc drift causes confusion over idempotency store (F-06) | HIGH | Doc update resolves; no code change needed |
| TV admin grant using legacy repo, no entitlement re-check, no reason field (F-08) | HIGH | Part 2 must switch to createTvGrant + add re-check |
| entitlementVerified boolean not enforced at call site (F-10) | MEDIUM | Part 3 action must derive from accessFor |
| jti replay not durable (F-11) | MEDIUM | Token expiry is mitigating; durable store is TARGET |
| passwordHash leaking from listUsers to admin UI (F-13) | MEDIUM | Requires AdminUserView DTO mapping |
| sweepTvExpiry expiry transitions not audited (F-15) | LOW | Add audit row inside sweep loop |

---

## Verification / tests

### Regression test spec — Part 0 LMS correctness fixes

**LMS-SEC-001: loadTeacherCourse ownership gate**
```typescript
// Vitest unit test (no DB needed — mock getServerDb, getCourseById, getTeacherProfile)
it('loadTeacherCourse: rejects a teacher accessing another teacher course', async () => {
  mockGetCourseById.mockResolvedValue({ id: 'c1', ownerTeacherId: 'teacher-B', teacherProfileId: 'tp-B', ... });
  mockGetTeacherProfile.mockResolvedValue({ id: 'tp-A', userId: 'teacher-A' });
  await expect(loadTeacherCourse('teacher-A', false, 'c1')).rejects.toThrow('FORBIDDEN');
});
it('loadTeacherCourse: admin bypasses ownership', async () => {
  mockGetCourseById.mockResolvedValue({ id: 'c1', ownerTeacherId: 'teacher-B', teacherProfileId: 'tp-B', ... });
  await expect(loadTeacherCourse('admin-user', true, 'c1')).resolves.not.toBeNull();
});
```

**LMS-SEC-002: adminEnrollAction audit actor**
```typescript
// PGlite integration test
it('adminEnrollAction: audit row actor is admin, not enrolled student', async () => {
  await adminEnrollAction(formDataWith({ userId: studentId, courseId, csrf: validCsrf }));
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'education.enrolled'));
  expect(logs[0].actorUserId).toBe(adminId);       // NOT studentId
  expect(logs[0].actorRole).toBe('admin');
});
```

**LMS-SEC-003: markEnrollmentComplete audit targetId**
```typescript
// PGlite integration test
it('markEnrollmentComplete: audit targetId is enrollment row id, not courseId', async () => {
  const enrollment = await upsertEnrollment(db, { userId, courseId });
  await markEnrollmentComplete(db, userId, courseId);
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'education.course_completed'));
  expect(logs[0].targetId).toBe(enrollment.id);    // enrollment UUID, not courseId
  expect(logs[0].targetType).toBe('enrollment');
});
```

**LMS-SEC-004: createCourse teacherProfileId linkage**
```typescript
// PGlite integration test
it('createCourse: teacherProfileId is set when a teacher_profiles row exists', async () => {
  const profile = await createTeacherProfile(db, { userId, displayName: 'T' });
  const course = await createCourse(db, { ownerTeacherId: userId, teacherProfileId: profile.id, title: 'T' });
  expect(course.teacherProfileId).toBe(profile.id);
});
```

### Regression test spec — Part 1 Billing Webhook

**BW-SIG-001:** Valid Stripe signature + `checkout.session.completed` → 200, entitlement `active`
**BW-SIG-002:** Tampered body (body mutated after signing) → 400 `signature_invalid`, no DB write
**BW-SIG-003:** Missing `stripe-signature` header → 400
**BW-SIG-004:** Duplicate `stripeEventId` → 200, `applyStripeEvent` returns `{applied: false}`, no second entitlement write
**BW-SIG-005:** Audit row for `billing.webhook_received` contains ONLY `stripeEventId` + `billingEvent` enum — no raw body, no signature value (assert `after` object keys are a subset of `['billingEvent', 'planCode']`)

### Regression test spec — Part 2 TV Grant/Revoke

**TV-SEC-001:** `adminGrantAction` without admin role → access denied before any DB write
**TV-SEC-002:** `adminGrantAction` with lapsed entitlement for target user → fails at entitlement re-check, no grant row written
**TV-SEC-003:** `adminGrantAction` on already-granted request (status != 'pending') → state guard rejects, no duplicate grant row
**TV-SEC-004:** `revokeTvGrant` audit row contains `reason` field set to the submitted reason string
**TV-SEC-005:** `revokeTvGrant` audit row actor is the admin user, not the revoked user

### Regression test spec — Part 3 Terminal Download

**TERM-SEC-001:** `recordDownloadEvent` with `entitlementVerified: false` → row is written with flag false (download recorded as security signal)
**TERM-SEC-002:** Terminal download server action with no active `axioma_terminal` entitlement → returns 403-equivalent, no download URL served, `entitlementVerified: false` record written
**TERM-SEC-003:** `publicJwk()` does not contain `d` key (already passes in es256.test.ts — confirm this test is in the test suite)
**TERM-SEC-004:** JWKS route returns `{keys:[]}` when `AXIOMA_HANDOFF_SIGNING_KEY` is missing (no stack trace in response)

### No-secrets checklist

| Surface | Secret type | Check |
|---|---|---|
| `billing.webhook_received` audit row | Stripe-Signature header value | NOT included (only eventId + billingEvent enum) |
| `billing.webhook_received` audit row | Raw webhook body | NOT included |
| `tv_access.grant` audit row | any secret | Not applicable (TV username is public) |
| `tv_access.revoke` audit row | any secret | Not applicable |
| `terminal.download` audit row | Private key / signing key | NOT included (only version + platform + entitlementVerified) |
| `terminal.license_event` audit row | Device fingerprint | deviceFingerprint is stored in `terminal_license_events` table (not audit) — audit contains only eventType |
| `JWKS /.well-known/axioma-jwks.json` response | Private scalar `d` | Hard-asserted absent by `publicJwk()` |
| `exchange_key.create` audit row | sealed blob / plaintext key | Covered by `redact()` — `sealed` is a SECRET_HINT keyword |
| `auth.login_failed` audit row | Password | `targetId` is email, not password — correct |
| Admin user list endpoint | passwordHash | Must be stripped at DTO mapping layer (F-13) |

---

## Next actions

| Priority | Action | Owner | Part |
|---|---|---|---|
| P0 | Fix loadTeacherCourse to assert ownership BEFORE fetching roster/lessons (F-01) | education-implementer | 0 |
| P0 | Fix adminEnrollAction to pass actorUserId=admin.id to upsertEnrollment (F-02) | education-implementer | 0 |
| P0 | Fix markEnrollmentComplete to use enrollment.id as audit targetId, not courseId (F-03) | education-implementer | 0 |
| P0 | Fix createCourse/createCourseAction to populate teacherProfileId from teacher_profiles (F-04) | education-implementer | 0 |
| P1 | Implement POST /api/billing/webhook: req.text() raw body, sig-first, CSRF-exempt, idempotent via audit ledger (F-05) | billing-implementer | 1 |
| P1 | Update docs/CONTRACTS/billing-webhooks.md §7: replace webhook_idempotency_keys with audit_logs ledger deviation note (F-06) | security-auditor (doc only) | 1 |
| P1 | Part 1 route: discard event.raw after field extraction; add comment (F-07) | billing-implementer | 1 |
| P1 | Switch TV admin grant/revoke to createTvGrant/revokeTvGrant; add entitlement re-check + reason + duration + state guard (F-08) | tv-access-implementer | 2 |
| P1 | Update docs/CONTRACTS/tradingview-access.md: tradingview_profiles + tradingview_access_grants are CURRENT not TARGET; update revokedAt/revokedBy presence (F-09) | security-auditor (doc only) | 0/2 |
| P1 | Terminal download action: derive entitlementVerified from accessFor, fail-closed before URL (F-10) | terminal-implementer | 3 |
| P2 | Add axioma_handoff_jti durable store design to OPEN_QUESTIONS.md (F-11) | security-auditor | 3 |
| P2 | All new Part 4 admin actions: requireUser → assertAdmin → assertCsrf → Zod pattern (F-12) | admin-implementer | 4 |
| P2 | Define AdminUserView DTO in Part 4 user list; strip passwordHash; scope email to admin role only (F-13) | admin-implementer | 4 |
| P3 | sweepTvExpiry: add in-txn audit row per expired request (F-15) | tv-access-implementer | 2/6 |
| P3 | Run gates: confirm test counts advance and no regression in existing 154/5 suite | test-implementer | 6 |
