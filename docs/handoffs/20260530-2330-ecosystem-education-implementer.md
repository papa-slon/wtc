# ecosystem-education-implementer handoff

## Scope

PG7 LMS audit: enumerate every RBAC/ownership/entitlement silent-return site in
`apps/web/src/features/lms/actions.ts`; assess completeness (pinned-link / teacher-profile
action coverage); deliver a per-field do-now / Phase-3 verdict for the rich migration (0005);
confirm the overall rich-migration boundedness verdict.

## Files inspected

- `apps/web/src/features/lms/actions.ts` (full read)
- `apps/web/src/features/lms/queries.ts` (full read)
- `packages/lms/src/guards.ts`
- `packages/lms/src/errors.ts`
- `packages/lms/src/types.ts`
- `packages/lms/src/completion.ts`
- `packages/lms/src/index.ts`
- `packages/db/src/schema.ts` lines 181-210, 395-466
- `packages/db/src/repositories.ts` (LMS section, lines 382-808)
- `packages/audit/src/audit.ts` (AUDIT_ACTIONS list)
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/app/teacher/courses/[id]/page.tsx`
- `apps/web/src/app/teacher/layout.tsx` (directory confirmed)
- `apps/web/src/app/(app)/app/education/` (directory confirmed)
- `apps/web/src/app/admin/education/page.tsx` (directory confirmed)
- `docs/EDUCATION_LMS_PLAN.md` (§1-21)
- `docs/ROADMAP_MASTER.md` §7
- `docs/PRODUCTION_BLOCKERS.md`
- `docs/EXECUTION_PLAN_MASTER.md`
- `docs/STATUS.md`
- `docs/handoffs/0000-orchestrator-seed.md`

## Files changed

None — read-only audit.

## Findings

### Finding 1 — HIGH — createCourseAction: RBAC guard silently returns, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:60`
```
if (!isTeacher) return;
```
**What it guards:** rejects non-teacher/non-admin from creating courses.
**Problem:** silent `return` means a non-teacher calling this action receives an empty 200 response; no denial is recorded in `audit_logs`. A security scanner (or attacker) cannot distinguish "denied" from "no-op".
**Recommendation:** Replace with `audit.write({ action: 'education.course_create', result: 'failure', actorUserId: user.id, actorRole: roles, targetType: 'course', targetId: null })` followed by `throw new OwnershipDenied('FORBIDDEN: teacher or admin required')`. The exact audit action code (`education.course_create` with `result:'failure'`) and the error type should be coordinated with the security-auditor who owns `AUDIT_ACTIONS` additions.
**Target area:** Workstream 1 (RBAC-throw fix).

---

### Finding 2 — HIGH — updateCourseAction: RBAC guard + ownership guard both silently return, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:76` (RBAC) and `apps/web/src/features/lms/actions.ts:82` (ownership).
```ts
if (!isTeacher) return;                                        // line 76
if (!(await ownsCourse(user.id, isAdmin, courseId))) return;   // line 82
```
**What they guard:** (a) rejects non-teacher/admin; (b) rejects a teacher editing another teacher's course.
**Problem:** the ownership denial at line 82 is the most security-sensitive case — Teacher A can call `updateCourseAction` with Teacher B's `courseId` and receive a silent 200. No audit row is written; there is no detectable signal of the cross-ownership attempt.
**Recommendation:** For the RBAC check (line 76): throw + audit as in Finding 1. For the ownership check (line 82): throw `OwnershipDenied` AND audit a denial row. The audit record should include `actorUserId: user.id`, `actorRole: user's role`, `targetType: 'course'`, `targetId: courseId`, `result: 'failure'`. The security-auditor should decide whether a new `education.ownership_denied` code is added to `AUDIT_ACTIONS` or whether existing `education.course_update` with `result:'failure'` is sufficient.
**Target area:** Workstream 1 (RBAC-throw fix + denial audit).

---

### Finding 3 — HIGH — setCoursePublishedAction: RBAC guard + ownership guard both silently return, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:90-97`.
```ts
if (!isTeacher) return;                                        // line 90
if (!(await ownsCourse(user.id, isAdmin, courseId))) return;   // line 97
```
**What they guard:** prevents unauthorized publish/unpublish of a course. A non-teacher calling this action, or a teacher trying to publish another teacher's course, receives a silent success response.
**Recommendation:** Same pattern as Finding 2: throw + denial audit at both check sites. Action code subject to security-auditor decision.
**Target area:** Workstream 1.

---

### Finding 4 — HIGH — createLessonAction: RBAC guard + ownership guard both silently return, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:106-113`.
```ts
if (!isTeacher) return;                                        // line 106
if (!(await ownsCourse(user.id, isAdmin, courseId))) return;   // line 113
```
**What it guards:** prevents lesson creation inside another teacher's course.
**Recommendation:** Same pattern.
**Target area:** Workstream 1.

---

### Finding 5 — HIGH — setLessonPublishedAction: RBAC guard + ownership guard both silently return, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:121-129`.
```ts
if (!isTeacher) return;                                        // line 121
if (!(await ownsCourse(user.id, isAdmin, courseId))) return;   // line 129
```
**What it guards:** prevents unauthorized lesson publish toggle (including cross-teacher).
**Recommendation:** Same pattern.
**Target area:** Workstream 1.

---

### Finding 6 — HIGH — createMaterialAction: RBAC guard + ownership guard both silently return, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:137-145`.
```ts
if (!isTeacher) return;                                        // line 137
if (!(await ownsCourse(user.id, isAdmin, courseId))) return;   // line 145
```
**What it guards:** prevents material creation in another teacher's lesson.
**Recommendation:** Same pattern.
**Target area:** Workstream 1.

---

### Finding 7 — HIGH — deleteMaterialAction: RBAC guard + ownership guard both silently return, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:153-160`.
```ts
if (!isTeacher) return;                                        // line 153
if (!(await ownsCourse(user.id, isAdmin, courseId))) return;   // line 160
```
**What it guards:** prevents deletion of material in another teacher's lesson.
**Recommendation:** Same pattern.
**Target area:** Workstream 1.

---

### Finding 8 — HIGH — enrollAction: entitlement guard silently returns, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:172`:
```ts
if (!access.allowed) return; // fail-closed
```
Also lines 175-177: a non-existent or unpublished course also causes a silent `return` with no audit.
**What it guards:** prevents enrollment by a student without the `education` entitlement; also prevents enrollment in a draft/non-existent course.
**Note:** The comment correctly labels line 172 as "fail-closed" but the current implementation does NOT fail closed in the security sense — it silently discards the denial and returns a 200-equivalent to the caller. True fail-closed means throw + record the denial.
**Recommendation:** At line 172, throw `EntitlementDenied` and audit with `actorUserId: user.id`, `targetType: 'enrollment'`, `targetId: courseId`, `result: 'failure'`. The `course not published` branch (lines 175-177) should throw `LmsNotFound` (hiding draft existence is the correct behavior); no denial audit needed for that branch because it is not a security decision — returning 404 is the correct and documented behavior.
**Target area:** Workstream 1 (entitlement denial + audit).

---

### Finding 9 — HIGH — markLessonCompleteAction: entitlement guard silently returns, no audit; lesson-not-found guard also silent

**Evidence:** `apps/web/src/features/lms/actions.ts:187-193`.
```ts
if (!access.allowed) return; // fail-closed   // line 190
// ...
if (!lessons.some((l) => l.id === lessonId)) return;  // line 193
```
**What it guards:** line 190 is the entitlement denial (student without education access); line 193 is the "lesson not published or not in this course" check (fail-closed for student enumeration).
**Recommendation:** Line 190: throw `EntitlementDenied` + audit denial. Line 193: throw `LmsNotFound` (correct behavior — no audit needed, not a security cross-boundary violation).
**Target area:** Workstream 1.

---

### Finding 10 — HIGH — adminEnrollAction: RBAC guard silently returns, no audit

**Evidence:** `apps/web/src/features/lms/actions.ts:213`:
```ts
if (!isAdmin) return; // admin-only
```
**What it guards:** non-admin calling the admin enrollment action.
**Recommendation:** throw an appropriate error (e.g. `OwnershipDenied` or a dedicated `RbacDenied`) AND audit the attempt with `actorUserId: user.id`, `targetType: 'enrollment'`, `result: 'failure'`.
**Target area:** Workstream 1.

---

### Finding 11 — MEDIUM — CSRF-first ordering: all actions call requireUser before assertCsrf

**Evidence:** Every action in `apps/web/src/features/lms/actions.ts` follows the pattern:
```ts
const user = await requireUser();   // line 57, 73, 88, 103, 118, 134, 150, 167, 181, 209
await assertCsrf(formData);         // immediately after
```
For example, `createCourseAction` lines 57-58.
**Context:** `assertCsrf` at `apps/web/src/lib/csrf.tsx:31` reads the session cookie DIRECTLY (via `cookies()`) and does NOT depend on the `user` object returned by `requireUser`. It is therefore safe and preferable to call `assertCsrf` first, before `requireUser`, on every action. This prevents CSRF token consumption on unauthenticated requests and aligns with defense-in-depth.
**Recommendation:** Swap to the canonical pipeline: `assertCsrf(formData)` FIRST, then `requireUser()`, then Zod, then RBAC/ownership (now throwing+auditing), then repo.
**Target area:** Workstream 2 (CSRF-first ordering).

---

### Finding 12 — MEDIUM — Pinned-link actions: repos exist but NO live server action in apps/web

**Evidence:**
- `packages/db/src/repositories.ts:791` — `createPinnedLink` exists with in-txn audit (`education.pinned_link_create`).
- `packages/db/src/repositories.ts:803` — `deletePinnedLink` exists with in-txn audit (`education.pinned_link_delete`).
- Grep across `apps/web/src/**` finds zero calls to either function.
- `apps/web/src/features/lms/actions.ts` has no pinned-link actions.
- There is no `/teacher/community` page (the route structure in `EDUCATION_LMS_PLAN.md` §6.2 lists it as a TARGET).
**Assessment:** The `pinned_link_create` and `pinned_link_delete` audit codes in `AUDIT_ACTIONS` are registered and the repos are ready, but the web surface (the server actions + the teacher community page + the admin global-link UI) is absent. The audit code registration is NOT dead code (it is defensive pre-registration for Phase 3), but there is currently no path for any user to trigger these audit rows through the web UI.
**Recommendation:** Document this as Phase-3 scope explicitly in `docs/EDUCATION_LMS_PLAN.md` and in the PG7 implementation notes. No action needed this phase unless the operator decides to add the teacher community UI in PG7 scope.
**Target area:** Completeness / Phase-3 plan.

---

### Finding 13 — MEDIUM — Teacher-profile actions: createTeacherProfile / updateTeacherProfile repos exist but NO live server action in apps/web

**Evidence:**
- `packages/db/src/repositories.ts:719` — `createTeacherProfile` (in-txn audit `education.teacher_profile_create`).
- `packages/db/src/repositories.ts:731` — `updateTeacherProfile` (in-txn audit `education.teacher_profile_update`).
- Grep across `apps/web/src/**` finds zero server action calls to either function.
- `createTeacherProfile` is only called from `tests/integration/lms-fixes.test.ts:48` (test setup only).
**Assessment:** Same situation as pinned links. The repos are ready, but there is no web surface for a teacher to create or edit their profile, and no admin action to create teacher profiles or set `isActive`. These are Phase-3 features per the plan.
**Recommendation:** Explicitly mark in the plan as Phase-3 (teacher profile edit UI + admin profile management). If PG7 scope includes a minimal teacher self-profile create/update, add a server action with the full RBAC+ownership+audit pipeline.
**Target area:** Completeness / Phase-3 plan.

---

### Finding 14 — LOW — ownsCourse() swallows OwnershipDenied in a try/catch, converting throw to false

**Evidence:** `apps/web/src/features/lms/actions.ts:39-49`:
```ts
async function ownsCourse(...): Promise<boolean> {
  ...
  try {
    assertTeacherOwns({...});
    return true;
  } catch {
    return false;   // converts the throw into a boolean
  }
}
```
**Assessment:** This is safe as a helper (it allows the calling site to decide how to respond), but once the calling sites are updated to throw + audit on denial (Findings 2-7), this helper should either be replaced with a direct `assertTeacherOwns` call (which already throws `OwnershipDenied`) or the helper should be retained but the calling site should distinguish the denial reason before deciding to throw or audit. The swallowed exception currently prevents any information about WHY ownership was denied from reaching the audit layer.
**Recommendation:** After the Findings 2-7 fixes, call `assertTeacherOwns` directly in each action (rather than through this boolean wrapper) so the throw propagates naturally and the audit can be written before re-throwing.
**Target area:** Workstream 1 refactor.

---

## Rich Migration (0005) — Per-field verdict

The current lean schema (migration 0002) is the 41-table baseline. Migration 0004 was the last migration (`axioma_handoff_jti_revocations`). The next migration for LMS would be 0005.

The dead-code-avoidance discipline (PG4 checkout, PG6 signer resolver) requires that no column be added without a real consumer this phase. Phase-3 rich UI (embed players, file upload, global links, slug URLs, auto-progress) is explicitly NOT being built in PG7.

**Field-by-field analysis:**

| Field | Column target | Real consumer this phase? | Additive+safe? | Special concern | Verdict |
|---|---|---|---|---|---|
| `courses.slug` | `courses` ADD COLUMN `slug text` | No — slug-URL routing (`/app/education/[courseSlug]`) is Phase-3 UI. Current routes use `[courseId]` (UUID). | Yes, with a migration-time `slugify(title, id)` backfill. | UNIQUE constraint requires the backfill to be non-colliding. | **Phase-3** |
| `courses.level` | `courses` ADD COLUMN `level text DEFAULT 'beginner'` | No — no filter UI, no display, no Zod field in current `createCourseSchema`. | Yes, additive with a safe default. | None. | **Phase-3** |
| `courses.tags` | `courses` ADD COLUMN `tags text[] DEFAULT '{}'` | No — no filter/tag UI anywhere. | Yes, additive with a safe default. | None. | **Phase-3** |
| `lessons.content_type` | `lessons` ADD COLUMN `content_type text DEFAULT 'video'` | Partially — `deriveContentType` in `packages/lms/src/completion.ts:35` DERIVES this from `video_url` today. The type view uses `contentType: ContentType` mapped by the derive function. A stored column would be redundant without a rich content-type selector UI (for embed/article/link). Adding the column without a consumer creates dual-truth risk (stored `content_type` vs derived). | Yes, additive, but creates a data-consistency hazard unless the derive function is retired. | Dual-truth: both the derived value and the stored column would exist simultaneously. Must not add without retiring `deriveContentType`. | **Phase-3** |
| `lessons.embed_html` | `lessons` ADD COLUMN `embed_html text` | No — there is no embed sanitizer (`sanitizeEmbedHtml`) in the codebase. `EDUCATION_LMS_PLAN.md §9.2` describes a sanitizer that does NOT yet exist. | Yes, additive. | **XSS surface**: `embed_html` contains raw HTML (even if sanitized). Without the sanitizer in place, storing this column is premature. A stored but unsanitized embed_html could be rendered as raw HTML in Phase-3 if a developer forgets the sanitization step. Requires a sanitizer library decision (DOMPurify/Node, Rust/WASM), security review, and CSP nonce (currently deferred to Phase 3). | **Phase-3 — do NOT add without sanitizer + security review** |
| `materials.file_size_bytes` / `materials.mime_type` / `materials.file_key` / `materials.file_name` | `materials` ADD COLUMN(s) | No — file upload is explicitly BLOCKED (`ROADMAP_MASTER.md §7`, `PRODUCTION_BLOCKERS.md` references "upload security review"). The current `createMaterialAction` only handles links/embeds (no file bytes). | Yes, additive with null defaults. | **Blocked by upload security review.** Adding these columns now creates dead-code schema surface; the upload handler is not built and BLOCKED. | **Phase-3 — blocked by upload security review** |
| `pinned_links.owner_type = 'global'` | `pinned_links` CHECK constraint currently allows `teacher_profile\|course` only. | No — there is no admin global-link UI and no server action for creating global pinned links. | Adding 'global' to the CHECK is additive. | No consumer this phase. Would need a new action + RBAC check (admin-only for global). | **Phase-3** |
| `lesson_progress.state` (explicit column) | `lesson_progress` ADD COLUMN `state text DEFAULT 'started'` | No — `deriveLessonState` in `packages/lms/src/completion.ts:21-27` derives the state from `completed` + `percent_complete`. No Phase-3 rich progress UI (video scrub, auto-`started` on open). | Yes, additive. | Dual-truth same as `content_type`: stored `state` vs `deriveLessonState`. Must not add without retiring the derive function. | **Phase-3** |

**Overall rich-migration verdict: Phase-3 plan.** No field passes the "real consumer this phase + no special risk" test. The table of Phase-3 column additions for the `ecosystem-db-architect` to spec in DDL:

```
-- courses (migration 0005, Phase-3)
ALTER TABLE courses ADD COLUMN slug text;           -- backfill: slugify(title, id); then UNIQUE
ALTER TABLE courses ADD COLUMN level text NOT NULL DEFAULT 'beginner';
ALTER TABLE courses ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE courses ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- lessons (migration 0005, Phase-3)
ALTER TABLE lessons ADD COLUMN content_type text NOT NULL DEFAULT 'video';   -- retire deriveContentType after
ALTER TABLE lessons ADD COLUMN embed_html text;      -- requires sanitizer + security review first
ALTER TABLE lessons ADD COLUMN article_body text;
ALTER TABLE lessons ADD COLUMN external_url text;
ALTER TABLE lessons ADD COLUMN duration_sec integer;
ALTER TABLE lessons ADD COLUMN is_preview boolean NOT NULL DEFAULT false;
ALTER TABLE lessons ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE lessons ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- materials (migration 0005, Phase-3, AFTER upload security review cleared)
ALTER TABLE materials ADD COLUMN file_key text;
ALTER TABLE materials ADD COLUMN file_name text;
ALTER TABLE materials ADD COLUMN file_size_bytes bigint;
ALTER TABLE materials ADD COLUMN mime_type text;
ALTER TABLE materials ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- pinned_links (migration 0005, Phase-3)
-- Re-add CHECK constraint: owner_type IN ('teacher_profile','course','global')
-- owner_id made nullable for global (owner_type='global' has owner_id=NULL)

-- lesson_progress (migration 0005, Phase-3)
ALTER TABLE lesson_progress ADD COLUMN state text NOT NULL DEFAULT 'started';  -- retire deriveLessonState after
```

Note: the `embed_html` column and the `file_key`/`file_size_bytes`/`mime_type` material columns have additional prerequisites (sanitizer + upload security review cleared) that MUST be resolved before those specific ALTER TABLEs go in — they can be split into a migration 0005-a (non-risky fields) and 0005-b (upload+embed, after prerequisites).

## Decisions

1. **Denial audit code naming:** the security-auditor must decide whether to add a new `education.access_denied` (or `education.rbac_denied` / `education.ownership_denied`) code to `AUDIT_ACTIONS`, or to reuse existing `education.*` codes with `result: 'failure'`. Either approach is defensible; the important constraint is that EVERY silent-return site gets a written audit row on denial. This is a cross-agent decision between education-implementer and security-auditor.

2. **ownsCourse() helper fate:** after the throw+audit refactor, the `ownsCourse()` boolean wrapper should either be replaced with direct `assertTeacherOwns` calls (preferred — simpler, no exception swallowing) or retained as a helper that additionally calls `audit.write` before returning false. Operator/implementer to decide which pattern is cleaner.

3. **embed_html XSS sanitizer:** before migration 0005 can add `lessons.embed_html`, a sanitizer library must be chosen and implemented. `EDUCATION_LMS_PLAN.md §9.2` describes the required behavior. This is a security-auditor decision (library choice + security review) gating the Phase-3 embed column.

4. **Upload security review (BLOCKED):** the material file-meta columns are blocked on the upload security review. Operator must schedule this review and record the outcome in `PRODUCTION_BLOCKERS.md` before migration 0005-b goes in.

5. **CSRF-first ordering:** the canonical pipeline is `assertCsrf → requireUser → Zod → RBAC/ownership (throw+audit) → repo → revalidate`. Security-auditor should confirm this is the standard for ALL action files (not just LMS) so the refactor is consistent.

## Risks

1. **Silent returns mask active cross-teacher attacks in production.** Until the throw+audit fix lands, a teacher can call any teacher mutation against another teacher's course and receive a 200 OK. There is no audit row to detect this in the `audit_logs` table. This is the highest-priority risk.

2. **`content_type` and `state` dual-truth.** If migration 0005 adds `lessons.content_type` or `lesson_progress.state` without retiring `deriveContentType` / `deriveLessonState`, both computed values exist. A future developer reading the schema will not know which is canonical. The retire step must be co-located in the same migration.

3. **embed_html stored without sanitizer.** If `lessons.embed_html` is added to the schema before `sanitizeEmbedHtml` is implemented and tested, any code that later renders the column directly creates a stored XSS vector. The Phase-3 block on this column must be honoured.

4. **Pinned-link and teacher-profile repos with no web surface are invisible to QA.** No e2e test exercises `createPinnedLink`, `deletePinnedLink`, `createTeacherProfile`, or `updateTeacherProfile` via a real user action. If a regression is introduced in these repos it will not be caught by the current e2e suite.

5. **Demo mode bypasses all security.** `if (!db) return;` (present in every action) means in demo mode (no DATABASE_URL) ALL actions silently no-op before any RBAC or ownership check. This is intentional and documented ("no persistence in demo mode"), but means the security fixes only matter in the Postgres path. This is acceptable given the platform is not production-ready yet (B1 still open), but should be noted.

## Verification/tests

The following tests are needed as part of the PG7 implementation to confirm the fixes:

1. **Unit tests in `packages/lms` or `tests/integration/lms-rbac.test.ts` (new file):**
   - Non-teacher calling `createCourseAction` → expect audit row with `result: 'failure'` AND an error thrown.
   - Teacher A calling `updateCourseAction` with Teacher B's courseId → expect audit row (denial) AND thrown error.
   - Student calling `enrollAction` without education entitlement → expect audit row (denial) AND thrown error.
   - Admin calling `adminEnrollAction` with a non-admin user → expect audit row AND thrown error.

2. **CSRF ordering regression:** existing e2e or unit tests should confirm that calling an action without a CSRF token still throws (assertCsrf first does not change the throw behavior — it fires sooner, which is strictly safer).

3. **db:generate PASS with 41 tables (no change):** migration 0005 is deferred. After this phase `db:generate` must still show 41 tables / "No schema changes".

4. **Full gates:** governance:check, check:core, lint, typecheck x2, secret:scan, test, coverage, build, e2e.

## Next actions

1. **Security-auditor** (PG7 lane): confirm the new denial audit code name (existing `result:'failure'` on existing codes, or new `education.access_denied` code) and add it to `AUDIT_ACTIONS` if a new code is needed. Also confirm the canonical CSRF-first pipeline.

2. **ecosystem-db-architect**: note the Phase-3 DDL sketch above; no schema changes needed for PG7.

3. **ecosystem-education-implementer** (implementation, post-audit): apply Findings 1-10 to `apps/web/src/features/lms/actions.ts`:
   - Reorder to `assertCsrf → requireUser → Zod → RBAC-throw+audit → ownership-throw+audit → repo → revalidate`.
   - Replace every `if (!isTeacher) return;` with throw + audit.
   - Replace every `if (!(await ownsCourse(...))) return;` with direct `assertTeacherOwns` + audit on denial.
   - Replace `if (!access.allowed) return;` with throw `EntitlementDenied` + audit.
   - Replace `if (!isAdmin) return;` in `adminEnrollAction` with throw + audit.
   - The `ownsCourse()` boolean helper should be removed in favor of direct `assertTeacherOwns` calls.

4. **ecosystem-tests-runner**: run the full gate suite after the PG7 implementation; confirm 41 tables / "No schema changes" from `db:generate`; confirm test count increases with the new rbac denial tests.

5. **Operator**: record the Phase-3 rich migration column list (from the sketch above) in `docs/EDUCATION_LMS_PLAN.md §21` and `docs/ROADMAP_MASTER.md §7` as "Phase-3 / migration 0005". Schedule the upload security review (clears the material file-meta columns) and the embed sanitizer decision (clears `embed_html`).
