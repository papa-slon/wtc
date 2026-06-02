# ecosystem-security-auditor handoff

## Scope

PG7 security pipeline audit. CSRF-first ordering + RBAC-throw+audit design for
`apps/web/src/features/lms/actions.ts`. Read-only audit; no source edits.

Establishes the exact per-mutation security pipeline the implementer must wire and the
precise audit/exception design (exception type, audit code, fields, ordering resolution).

---

## Files inspected

- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/tv/actions.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/web/src/middleware.ts`
- `packages/lms/src/guards.ts`
- `packages/lms/src/errors.ts`
- `packages/lms/src/index.ts`
- `packages/audit/src/audit.ts`
- `packages/audit/src/redact.ts`
- `packages/auth/src/rbac.ts`
- `packages/shared/src/errors.ts`
- `packages/shared/src/roles.ts`
- `docs/SECURITY_MODEL.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/ROADMAP_MASTER.md`
- `docs/EXECUTION_PLAN_MASTER.md`
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`

---

## Files changed

None — read-only audit

---

## Findings

### F-01 [HIGH] requireUser runs before assertCsrf in all 10 LMS mutations

**Evidence:**
- `apps/web/src/features/lms/actions.ts:57-58` (`createCourseAction`): `requireUser()` then `assertCsrf(formData)`.
- Same order at lines `73-74`, `88-89`, `104-105`, `119-120`, `135-136`, `151-152`, `167-168`, `182-183`, `209-210` (all 10 exported actions).

The file docstring at line 3-4 states `assertCsrf → Zod → requireUser → RBAC` which reverses the actual code order (requireUser is first in every action body). The code does not match the docstring.

**Root cause:** `assertCsrf` reads the session cookie independently via `apps/web/src/lib/csrf.tsx:14-17` (`currentSessionToken` uses `cookies()` directly — no call to `requireUser`, no session validation). It is fully independent of `requireUser`. There is no technical reason to run `requireUser` first.

**Why it matters:** Running `requireUser` before `assertCsrf` leaks a timing difference to an unauthenticated caller: an anonymous request sees a different branch (unauthenticated throw from `requireUser`) vs. an authenticated-but-CSRF-bad request (CSRF throw). The canonical hardening ordering is: CSRF first (rejects forged cross-origin POSTs before touching any user-identity I/O), then authentication.

**Recommended corrected pipeline (all 10 actions):**
```
assertCsrf(formData)          ← Step 1: reject forged POSTs before any I/O
const user = await requireUser()   ← Step 2: throw UNAUTHENTICATED if no session
<Zod parse>                   ← Step 3: throw on invalid input (not authz, see F-04)
<RBAC/ownership/entitlement check> ← Step 4: throw + audit on denial (see F-02/F-03)
<repo call (in-txn audit on success)> ← Step 5
<revalidatePath>              ← Step 6
```

**Target:** `apps/web/src/features/lms/actions.ts`, all 10 action functions.

---

### F-02 [CRITICAL] RBAC, ownership, and entitlement denials silently return — no audit, no throw

**Evidence (RBAC denials):**
- `apps/web/src/features/lms/actions.ts:60`: `if (!isTeacher) return;`
- `apps/web/src/features/lms/actions.ts:76`: `if (!isTeacher) return;`
- `apps/web/src/features/lms/actions.ts:92`: `if (!isTeacher) return;`
- `apps/web/src/features/lms/actions.ts:107`: `if (!isTeacher) return;`
- `apps/web/src/features/lms/actions.ts:122`: `if (!isTeacher) return;`
- `apps/web/src/features/lms/actions.ts:138`: `if (!isTeacher) return;`
- `apps/web/src/features/lms/actions.ts:154`: `if (!isTeacher) return;`
- `apps/web/src/features/lms/actions.ts:213`: `if (!isAdmin) return;` (admin-only `adminEnrollAction`)

**Evidence (ownership denials):**
- `apps/web/src/features/lms/actions.ts:82`: `if (!(await ownsCourse(...))) return;`
- `apps/web/src/features/lms/actions.ts:97`: `if (!(await ownsCourse(...))) return;`
- `apps/web/src/features/lms/actions.ts:113`: `if (!(await ownsCourse(...))) return;`
- `apps/web/src/features/lms/actions.ts:129`: `if (!(await ownsCourse(...))) return;`
- `apps/web/src/features/lms/actions.ts:145`: `if (!(await ownsCourse(...))) return;`
- `apps/web/src/features/lms/actions.ts:161`: `if (!(await ownsCourse(...))) return;`

**Evidence (entitlement denials — student actions):**
- `apps/web/src/features/lms/actions.ts:172`: `if (!access.allowed) return;`
- `apps/web/src/features/lms/actions.ts:188`: `if (!access.allowed) return;`

**Contrast:** `requireUser()` and `assertCsrf()` already throw on failure (session.ts:18, csrf.tsx:34). Only the authz checks silently return.

**Consequence:** An attacker probing teacher-only endpoints with a non-teacher session receives a 200-OK with no body change — indistinguishable from a successful no-op. There is zero audit trail for RBAC/ownership/entitlement violations. The ROADMAP_MASTER §7 and ROADMAP §11 both list this as a known open finding requiring PG7 resolution.

**Recommendation — exact design:**

**(a) Exception type.** Use `AppError('forbidden', '<safe message>')` from `@wtc/shared` (`packages/shared/src/errors.ts`). This is the same class that `assertCsrf` throws at `apps/web/src/lib/csrf.tsx:34`. Do NOT throw `OwnershipDenied` or `EntitlementDenied` from `@wtc/lms` at the action layer — those are domain-layer errors for the `guards.ts` primitives. The action layer catches or checks and then throws `AppError('forbidden', ...)` with a message that does NOT reveal which specific check failed (no info-leak: "Access denied" is sufficient in all cases).

**(b) Audit code.** Add ONE new cross-cutting code `'education.access_denied'` to `AUDIT_ACTIONS` in `packages/audit/src/audit.ts`. Do NOT reuse the per-action education.* codes with a `result:'denied'` variant — the existing codes (`education.course_create`, `education.course_update`, etc.) represent successful operations with `result:'success'`. A separate `education.access_denied` code cleanly separates the denial-event semantic and allows querying all LMS access violations in one filter. The `AuditResult` type must also expand to include `'denied'` alongside the existing `'success'` and `'failure'` values.

**(c) Required audit fields for each denial:**
```
actorUserId: user.id            // available after requireUser() — see ordering note F-03
actorRole:   user.roles[0] ?? 'user'
action:      'education.access_denied'
targetType:  <resource type — e.g. 'course', 'lesson', 'material', 'enrollment'>
targetId:    <the courseId/lessonId/materialId from formData, or null if Zod not yet parsed>
result:      'denied'
before:      undefined          // no before/after on a denial — no object was loaded
after:       undefined
```

No request body fields, no formData values, no course title or description in the audit payload. The `targetId` is the resource identifier (a UUID) read directly from `formData.get('courseId')` etc. — this is non-sensitive routing data, not user content.

**(d) Which denials must audit+throw:**
- RBAC check (`!isTeacher`, `!isAdmin`): YES — throw `AppError('forbidden', 'Access denied')` + audit with `targetType:'course'` (or the relevant resource) and `targetId` from formData.
- Ownership check (`!(await ownsCourse(...))`): YES — throw + audit with `targetType:'course'` and `targetId:courseId`.
- Entitlement check (`!access.allowed`): YES — throw `AppError('forbidden', 'Access denied')` + audit with `targetType:'course'` and `targetId:courseId`.
- Admin-only (`adminEnrollAction`, `!isAdmin`): YES — throw + audit with `targetType:'enrollment'` and `targetId` from formData.

**(e) demo-mode (no DB) audit path:** `backend.ts:63` exports `audit: AuditWriter` which in non-denied (demo) mode delegates to `memory.audit`. The in-memory audit writer (`createMemoryAuditWriter`) handles `write()` synchronously without a DB — it will accept the denial event. In production with a DB, `core.audit` is the DB writer. Both paths handle `audit.write()` for the denial event. This is confirmed safe: the `audit.write()` call does not go through `getServerDb()` (which returns null in demo) but through the exported `audit` writer which is always defined. The implementer MUST `await audit.write(...)` inside the action before throwing, since the throw will unwind — the audit must be written first.

**Target:** `apps/web/src/features/lms/actions.ts` (all denial sites), `packages/audit/src/audit.ts` (add code + expand AuditResult).

---

### F-03 [HIGH] Ordering interaction: CSRF-first vs denial-audit needs actor identity

**Evidence:** The denial audit (F-02) requires `user.id` and `user.roles` (actorUserId/actorRole). These are only available after `requireUser()` returns. CSRF must be first. This creates a dependency chain:

`assertCsrf` → `requireUser` → RBAC/ownership/entitlement check + `audit.write(denial)` → throw

There is no conflict to resolve: `assertCsrf` is independent of user identity (reads the cookie token directly, hashes it via `deriveSessionCsrfToken`). `requireUser` reads the same cookie and looks up the user. The resolved canonical ordering is:

```
1. await assertCsrf(formData)           // rejects CSRF-bad before any DB/user I/O
2. const user = await requireUser()     // throws UNAUTHENTICATED; provides actor for audit
3. const { isAdmin, isTeacher } = roles(user)
4. if (!isTeacher) {
     await audit.write({ actorUserId: user.id, actorRole: ..., action: 'education.access_denied', ... });
     throw new AppError('forbidden', 'Access denied');
   }
5. <Zod parse>                          // parse AFTER authz (see F-04 for Zod decision)
6. <ownership/entitlement check + audit+throw if denied>
7. <repo call (in-txn audit on success)>
8. revalidatePath(...)
```

This is the only ordering that satisfies all three constraints: CSRF-first (security), actor identity for audit (correctness), and audit-before-throw (audit durability).

**Note on Zod placement:** Zod MUST run after the authz checks (step 5 above, NOT step 3). Running Zod before authz would give an unauthenticated caller information about the expected field shapes (validation errors reveal schema). The current order in the LMS actions already runs Zod after the RBAC check (e.g. line 61 `!isTeacher` return is before line 62 `safeParse`) — this positioning is correct. The fix preserves this.

**Target:** `apps/web/src/features/lms/actions.ts` — confirm ordering in each action after the fix.

---

### F-04 [MEDIUM] Zod parse failure: stay as graceful return (not throw)

**Evidence:** Currently all `if (!parsed.success) return;` at lines `61`, `78-79`, `110`, etc. The task prompt asks whether Zod failures should throw 400 or stay as graceful returns.

**Decision and justification:** Zod failures are **input errors, not authz events**. They MUST NOT be audited as `education.access_denied`. A silent return is acceptable for form input errors in server actions (a Zod failure does not indicate a privilege escalation attempt; it indicates a bad form submission, typically a UI bug). Changing them to throw an error would change user-visible behavior (the page would show an unhandled error rather than just not refreshing). This is a UX decision, not a security decision, and the existing behavior is consistent with the pattern throughout the codebase (e.g., `apps/web/src/app/(auth)/actions.ts:25` redirects on schema failure for login/register). The LMS actions currently use `return` — keep this as-is.

**Exception:** The `adminEnrollSchema` Zod failure at line `214` (`if (!parsed.success) return;`) comes AFTER the `!isAdmin` check. Its silent return is also acceptable for the same reasons.

**Target:** No change required for Zod failure handling.

---

### F-05 [MEDIUM] middleware.ts does NOT handle CSRF for server actions — confirmed, no conflict

**Evidence:** `apps/web/src/middleware.ts` is document-GET + auth-rate-limit only. It explicitly passes through all POST requests (`isDocumentNavigation` at line 54-59 gates on `method === 'GET'`). Server action CSRF is handled inside each action via `assertCsrf(formData)` (double-submit cookie pattern). The middleware comment at lines 17-21 explicitly documents this design.

**Confirmed:** Moving `assertCsrf` to be the first call inside each action does NOT conflict with middleware. The middleware never intercepts the CSRF token from the form body.

**Target:** No change to middleware.ts required.

---

### F-06 [LOW] LMS actions docstring misstates the pipeline order

**Evidence:** `apps/web/src/features/lms/actions.ts:3-4` states `assertCsrf → Zod → requireUser → RBAC` but the actual code runs `requireUser → assertCsrf → RBAC → Zod`. After PG7 implementation the pipeline becomes `assertCsrf → requireUser → RBAC/audit+throw → Zod → repo`. The docstring must be updated to reflect the corrected order.

**Target:** `apps/web/src/features/lms/actions.ts:3-7` (file docstring).

---

### F-07 [INFO] `ownsCourse` swallows `OwnershipDenied` — correct for its role as a boolean predicate

**Evidence:** `apps/web/src/features/lms/actions.ts:39-49`: `ownsCourse` calls `assertTeacherOwns` inside a try/catch and returns `false` on any thrown `OwnershipDenied`. This is the correct design: `ownsCourse` is a boolean predicate used in the `if (!(await ownsCourse(...))) return;` pattern. After PG7 the callers will replace those silent returns with audit+throw. The `ownsCourse` helper should be retained as-is (the catch is intentional). The FIX is at the call sites, not inside `ownsCourse` itself.

**Target:** No change to `ownsCourse` function body required.

---

### F-08 [INFO] redact.ts coverage for denial audit payloads — confirmed safe

**Evidence:** Denial audit events carry `targetType` (a string like `'course'`), `targetId` (a UUID string), `actorUserId` (UUID), `actorRole` (string). None of these match the `SECRET_HINTS` list in `packages/audit/src/redact.ts:12-36` and none match the value-pattern rules at lines 54-56 (PHC, Bearer, 64-hex). The `before` and `after` fields are `undefined` (not set). redact.ts will pass these fields through unchanged. No additional redaction rules are needed for the denial audit payload.

**Target:** No change required.

---

### F-09 [INFO] `AuditResult` type needs `'denied'` added

**Evidence:** `packages/audit/src/audit.ts:117`: `export type AuditResult = 'success' | 'failure';`. The denial event will set `result: 'denied'`. The existing `'failure'` value is already used by `auth.login_failed` (apps/web/src/app/(auth)/actions.ts:28). Adding `'denied'` as a third value is the correct semantic: `'failure'` = an attempted operation that failed due to system error or bad credentials; `'denied'` = an attempted operation blocked by access control policy.

**This is a required code change** alongside the `'education.access_denied'` action code addition.

**Target:** `packages/audit/src/audit.ts:117` — add `| 'denied'` to `AuditResult`. Also update `AuditInput.result` optional field and the `buildEvent` default (which should remain `'success'` — denial events pass `result:'denied'` explicitly).

---

## Decisions

**D-01 — Exception type at the action layer:** `AppError('forbidden', 'Access denied')` from `@wtc/shared`. NOT `OwnershipDenied`/`EntitlementDenied` from `@wtc/lms` — those are domain-layer errors for the `guards.ts` primitives. The action layer unifies all three denial types (RBAC, ownership, entitlement) into a single `AppError('forbidden', ...)` with no specificity in the message (no info-leak about which check failed).

**D-02 — Audit code:** Add `'education.access_denied'` to `AUDIT_ACTIONS`. NOT a reuse of per-action codes with `result:'denied'` — the existing codes map to successful operations and mixing the semantics creates ambiguity. A single cross-cutting denial code allows one-filter querying of all LMS access violations.

**D-03 — Ordering:** `assertCsrf → requireUser → RBAC/entitlement+audit+throw → Zod → repo`. CSRF is unconditionally first; requireUser provides the actor identity for the denial audit; Zod stays after authz (already the current layout, preserved). This ordering satisfies all three constraints without conflict.

**D-04 — Zod failures:** Remain as silent `return` (no audit, no throw). Input errors are not authz events.

**D-05 — `AuditResult` expansion:** Add `'denied'` as a third value alongside `'success'` and `'failure'`.

**D-06 — `ownsCourse` helper:** Retained unchanged. The fix is at the call sites (replace `return` with `audit.write + throw`).

---

## Risks

**R-01 — Throw propagation in Next.js server actions.** `AppError('forbidden', ...)` thrown from a server action propagates to the React error boundary. The UI must handle this gracefully (show a toast/error state rather than an unhandled white-screen). The implementer must confirm that the LMS UI pages have an error boundary or that the thrown error is caught at the form-submit handler. If the pages do not have error boundaries, the implementation must either (a) add them or (b) use a try/catch inside the action that returns an error result. The CRITICAL requirement is that the audit MUST be written before the throw — the audit write must not be inside a catch that is skipped.

**R-02 — Demo-mode audit durability.** In demo mode `audit.write()` writes to the in-memory store only — these events are lost on process restart. This is the existing design and is acceptable for demo mode. In production the DB writer must flush to `audit_logs` before the throw. Because `audit.write()` is `await`ed before the `throw`, the write succeeds (or throws itself, in which case the action throws with a DB error rather than a forbidden error — also acceptable).

**R-03 — Missing `'denied'` from `AuditResult` breaks TypeScript.** If `'denied'` is not added to `AuditResult`, the `audit.write({ ..., result: 'denied' })` call will be a TS type error. This is a good compile-time guard — the type fix must co-land with the action fix.

**R-04 — db:generate after audit.ts change.** Adding the new code to `AUDIT_ACTIONS` and expanding `AuditResult` are pure TypeScript changes in `packages/audit/src/audit.ts`. These do NOT touch `packages/db/src/schema.ts` and do NOT require a new migration. The `audit_logs` table stores `action` as `text` (not an enum) and `result` as `text` with a default — confirmed from PGlite behavior. No schema migration is needed for PG7.

**R-05 — No info-leak in thrown messages.** The `AppError('forbidden', 'Access denied')` message must be the same across RBAC, ownership, and entitlement denials. Do NOT put the specific check type (`'not teacher'`, `'not your course'`, `'no education entitlement'`) in the message — this would leak which check failed to the caller. The audit payload (not visible to the caller) may use `targetType` to distinguish course/lesson/material/enrollment.

---

## Verification/tests

The implementer must add tests verifying the new behavior. Recommended test cases:

**Unit tests (pure, no DB needed):**
1. A non-teacher calling `createCourseAction` receives a thrown `AppError` with `code:'forbidden'`.
2. A non-teacher calling `updateCourseAction` receives a thrown `AppError` — not a silent void return.
3. A non-admin calling `adminEnrollAction` receives a thrown `AppError`.
4. A student without `education` entitlement calling `enrollAction` receives a thrown `AppError`.

**PGlite integration tests:**
5. Denial on RBAC (`!isTeacher`) writes an `education.access_denied` row to `audit_logs` with `result:'denied'`, correct `actorUserId`, `actorRole`, `targetType:'course'`, and a non-null `targetId`.
6. Denial on ownership (`!ownsCourse`) writes an `education.access_denied` row with `result:'denied'`.
7. Denial on entitlement (`!access.allowed`) writes an `education.access_denied` row with `result:'denied'`.
8. A successful `createCourseAction` does NOT write an `education.access_denied` row (only the `education.course_create` row from the repo).
9. CSRF comes before requireUser: an unauthenticated request with a bad CSRF token throws from `assertCsrf`, not from `requireUser` (test by calling the action directly with an empty formData and confirming the error is AppError(forbidden) not Error(UNAUTHENTICATED)).

**Gate impact:** `npm test` must cover the new unit + PGlite cases. The `npm run typecheck` gate catches the `AuditResult` type expansion drift. `npm run secret:scan` passes (no secrets in the added audit payload). `npm run build` confirms the action module compiles. e2e smoke tests do not exercise LMS mutations directly (smoke logs in as `user@wtc.local` which has no education entitlement) — the new deny-throw behavior does not break existing e2e.

---

## Next actions

1. **`packages/audit/src/audit.ts`** — add `'education.access_denied'` to `AUDIT_ACTIONS`; expand `AuditResult` to `'success' | 'failure' | 'denied'`.
2. **`apps/web/src/features/lms/actions.ts`** — in all 10 action functions:
   a. Move `assertCsrf(formData)` to be the FIRST statement.
   b. Replace each `if (!isTeacher) return;` with `await audit.write({...}) + throw new AppError('forbidden', 'Access denied')`.
   c. Replace each `if (!(await ownsCourse(...))) return;` with the same pattern.
   d. Replace each `if (!access.allowed) return;` (entitlement) with the same pattern.
   e. Replace the `if (!isAdmin) return;` in `adminEnrollAction` with the same pattern.
   f. Update the file docstring to reflect the corrected pipeline order: `assertCsrf → requireUser → RBAC/audit+throw → Zod → repo → revalidate`.
3. **Test file** — add unit + PGlite tests per verification section above.
4. **Check `db:generate`** confirms no schema change (audit.ts changes do not touch schema.ts).
5. **Run full gate suite** after implementation: governance/check:core/lint/typecheck×2/secret:scan/test/coverage/db:generate/build/e2e.
