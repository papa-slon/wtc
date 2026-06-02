# ecosystem-security-auditor handoff

_Epoch 20260530-1042. Phase 2.2 — Full LMS mutation security audit. Read-only. No code changed._

---

## Scope

Audit every Phase-2.2 LMS mutation for the complete server-side security pipeline. Deliverables:

1. Per-mutation pipeline table: Zod schema → requireUser → assertCsrf → RBAC → ownership → entitlement → repo (in-txn audit) → response.
2. Audit code gap analysis: which `education.*` codes exist in `AUDIT_ACTIONS` vs which Phase-2.2 route layer needs and which are still missing.
3. CSRF variant gap: `csrf.tsx` uses `deriveSessionCsrfToken` (synchronizer), not `verifyCsrf` (double-submit) — document the production path and the mismatch with SECURITY_MODEL.md.
4. XSS posture for lesson body and embed_html content.
5. `StudentProgressSummary` data-minimisation conformance.
6. Regression test specification for CSRF, RBAC matrix, in-txn audit, and ownership.
7. New findings specific to Phase-2.2 beyond those already reported in the Phase-2.1 handoff (20260530-0925).

---

## Files inspected

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0925-ecosystem-security-auditor.md` (Phase-2.1 security handoff — all F/D/R items carried forward unless explicitly resolved below)
- `docs/handoffs/20260530-0925-ecosystem-education-implementer.md` (Phase-2.1 LMS contract spec — canonical for interface, Zod schemas, guards, view types, test matrix)
- `packages/audit/src/audit.ts` (AUDIT_ACTIONS — current state)
- `packages/auth/src/rbac.ts` (Resource, MATRIX, can, canActOnOwned, assertAdmin)
- `packages/auth/src/csrf.ts` (generateCsrfToken, verifyCsrf, deriveSessionCsrfToken)
- `apps/web/src/lib/csrf.tsx` (CsrfField, assertCsrf, csrfToken — uses deriveSessionCsrfToken)
- `apps/web/src/lib/access.ts` (accessFor, reasonLabel, reasonTone)
- `packages/db/src/repositories.ts` (all Phase-2.1 repos — lines 317-838)
- `packages/db/src/schema.ts` (full schema — tables present/absent confirmed)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### F1 — HIGH: assertCsrf uses synchronizer-token variant, not double-submit; SECURITY_MODEL.md specifies double-submit only

**Severity**: High — the production CSRF path diverges from the documented design.

**Evidence**: `packages/auth/src/csrf.ts:28-31` exports `deriveSessionCsrfToken` (HMAC of `session_token + server_secret`). `apps/web/src/lib/csrf.tsx:20-35` uses `deriveSessionCsrfToken` exclusively via `csrfToken()` and `assertCsrf()`. The `verifyCsrf` double-submit function in `csrf.ts` is exported but never called by `csrf.tsx`.

`SECURITY_MODEL.md §3` specifies the double-submit pattern ("server middleware validates: X-CSRF-Token header value matches the CSRF cookie value"). The synchronizer-token variant is a distinct and stronger mechanism (per-session determinism; no cookie second factor) but it is NOT the documented production path.

**Impact for Phase-2.2**: All teacher/student/admin mutation server actions that call `assertCsrf(formData)` use the synchronizer variant. This is internally consistent (both ends call `deriveSessionCsrfToken` with the same session token + secret), so there is no actual bypass risk. However:
- `SECURITY_MODEL.md` is now wrong about the implementation.
- `deriveSessionCsrfToken` binds to the session token — if a session token is leaked, the CSRF token for that session is also computable by the attacker. Double-submit does not have this coupling.

**Recommendation**: Either (a) update `SECURITY_MODEL.md §3` to document the synchronizer variant as the approved Phase-2 production path and explain the trade-off, or (b) switch `csrf.tsx` to the double-submit pattern using `verifyCsrf`. Do NOT use both patterns in parallel. The Phase-2.2 implementer must call `assertCsrf(formData)` exactly as it stands — do not call `verifyCsrf` directly. The choice of variant is a design decision for the operator; this audit records the gap.

---

### F2 — HIGH: lessonProgress schema columns diverge from LMS plan §4.6; repo uses db-architect column names

**Severity**: High — the `upsertLessonProgress` repo (`repositories.ts:596-601`) writes `percentComplete`, `completed`, `lastAccessedAt` (db-architect spec). The education implementer handoff (Decision 3) resolved this in favour of plan §4.6 columns: `progress_pct`, `state` ('started'|'completed'), `started_at`, `completed_at`, `last_seen_at`. The schema as landed (`schema.ts:419-434`) uses the db-architect variant.

**Impact for Phase-2.2**: The `upsertProgress` and `markLessonComplete` service methods specified in the LMS interface use `progressPct` / `state` / `completedAt`. If the service layer writes these against the landed schema, there will be a mismatch. The `UpsertProgressSchema` and `ProgressView` type (from the implementer handoff) reference `progressPct` / `state`. The auto-complete-at-95% logic in the service spec checks `state !== 'completed'` — but the DB column is `completed: boolean`. The service layer must reconcile to the landed schema or migration 0002 must add the plan columns.

**Recommendation**: Before any service method writes to `lesson_progress`, the operator must decide: use the landed db-architect columns (simplest) or add the plan §4.6 columns in migration 0002/0003. The `upsertProgress` pipeline below is written against the LANDED schema (db-architect variant) because that is what exists. The implementer handoff's `ProgressView.state` field must be computed from `completed: boolean` in the DTO mapper (`state = completed ? 'completed' : 'started'`). Audit this reconciliation explicitly before the service is built.

---

### F3 — HIGH: pinnedLinks.ownerId is NOT NULL in landed schema; education implementer spec requires nullable for 'global' ownerType

**Severity**: High — `schema.ts:442` declares `ownerId: uuid('owner_id').notNull()`. The education implementer handoff (Finding 5, Decision from plan §4.7) requires `owner_id` to be NULLABLE for `ownerType='global'`. The `CreatePinnedLinkSchema` in the implementer spec allows `ownerId` to be absent when `ownerType='global'`. The `createPinnedLink` repo (`repositories.ts:614`) requires `input.ownerId: string` (non-optional).

**Impact for Phase-2.2**: Admin-created global pinned links cannot be inserted with the current repo signature or schema. The `listPinnedLinks` call for global community links (`ownerType:'global'`) also cannot work without a matching `ownerId`. This is a blocker for the global pinned links feature.

**Recommendation**: Migration 0002 (or an additive 0003 patch) must ALTER `pinned_links.owner_id` to allow NULL and add the CHECK constraint `(owner_type != 'global' OR owner_id IS NULL)`. The `createPinnedLink` repo signature must make `ownerId` optional and the `listPinnedLinks` repo must handle the `ownerType='global'` case where `ownerId IS NULL`.

---

### F4 — MEDIUM: createCourse repo does not forward actor's teacherProfileId; audit uses ownerTeacherId as actor

**Severity**: Medium — `createCourse` (`repositories.ts:356-366`) is the thin Phase-1.7 repo. It uses `input.ownerTeacherId` as both the `courses.owner_teacher_id` column and as `actorUserId` in the audit row. Post-migration 0002, Phase-2.2 `createCourse` in the full LMS service must use `teacher_profile_id` for the course row and `actorUserId` from the session. The route layer must pass the session userId as the actor, not the teacherProfileId. The full-service `createCourse` method must:
- Accept `actorUserId` (session.userId, for audit) and `teacherProfileId` (for `courses.teacher_profile_id`).
- Emit audit action `education.course_create` with `actorUserId = session.userId`.
- Never use `teacherProfileId` as `actorUserId`.

**Recommendation**: The Phase-2.2 implementer must write a new `createCourseFull` repo (or extend `createCourse`) that accepts both fields and writes the audit row with the correct actor.

---

### F5 — MEDIUM: education.enroll vs education.enrolled — two codes exist; route layer must pick one consistently

**Severity**: Medium — `AUDIT_ACTIONS` contains BOTH `'education.enroll'` (Phase-2.1 security handoff D1 addition) and `'education.enrolled'` (what the landed `upsertEnrollment` repo actually writes at `repositories.ts:577`). These are different strings covering the same semantic event.

**Evidence**:
- `audit.ts:79` — `'education.enroll'` is in the array (from the security handoff D1 list).
- `audit.ts:83` — `'education.enrolled'` is also in the array (the repo writes this).
- `repositories.ts:577` — `upsertEnrollment` writes `action: 'education.enrolled'`.

**Impact**: If a Phase-2.2 route adds a call that writes `education.enroll` for the same event type, the audit log becomes ambiguous. Queries for "all enrollments" must know to match both strings.

**Decision (see Decisions section D1)**: `education.enrolled` is canonical (it is what the landed repo actually writes). `education.enroll` is a duplicate from the design spec and must be treated as deprecated. Phase-2.2 route code must write `education.enrolled` exclusively. `education.enroll` is retained in `AUDIT_ACTIONS` for backward compatibility (it may have been written by test fixtures) but must not be used in new code.

---

### F6 — MEDIUM: education.course.completed vs education.course_completed — naming inconsistency

**Severity**: Medium — the education implementer handoff (Decision D5, Test 5-C) references audit action `'education.course.completed'` (dot-separated, 3 parts). The landed `AUDIT_ACTIONS` at `audit.ts:84` contains `'education.course_completed'` (underscore). The landed `markEnrollmentComplete` repo (`repositories.ts:591`) writes `action: 'education.course_completed'`.

**Impact**: If a Phase-2.2 service method calls `checkCourseCompletion` (from the implementer spec) and writes `'education.course.completed'`, it will fail TypeScript compilation because that string is not in `AUDIT_ACTIONS`. Conversely, the test in the implementer handoff (Test 5-C) queries for `'education.course.completed'` which will find zero rows.

**Decision (see D2)**: `education.course_completed` is canonical (what the repo writes, what is in `AUDIT_ACTIONS`). The implementer spec's references to `'education.course.completed'` must be treated as a typographical error in that spec. Phase-2.2 service code and tests must use `education.course_completed`.

---

### F7 — LOW: upsertLessonProgress has no server-side 8-second debounce guard at the repo layer

**Severity**: Low — the education implementer handoff (Progress section) specifies: "Server debounce: SELECT last_seen_at; if NOW() - last_seen_at < 8s → return existing row unchanged." The landed `upsertLessonProgress` repo (`repositories.ts:596-601`) does not implement this — it unconditionally upserts on every call. The rate limit on the route (`6/min/user/lesson`) provides partial protection but the debounce logic is expected to live in the service method, not the repo.

**Impact**: Without the 8-second guard, a fast client can write 6 progress updates per minute per lesson (the route rate limit), which is functionally correct but not what the spec requires. For Phase-2.2 the service method `upsertProgress` must implement this guard above the repo call.

**Recommendation**: The `upsertProgress` service method must: (1) call `getLessonProgress(userId, lessonId)`, (2) if `lastAccessedAt > now - 8000ms`, return the existing row without calling `upsertLessonProgress`, (3) otherwise call `upsertLessonProgress`. This is service-layer logic, not repo logic.

---

### F8 — LOW: adminCreateEnrollment has no corresponding repo; ensureEnrolled audit action does not distinguish source

**Severity**: Low — the LMS interface specifies two enrollment methods: `ensureEnrolled` (source='entitlement', no audit row per the spec "no audit row") and `adminCreateEnrollment` (source='manual_admin', writes audit row). The landed repo `upsertEnrollment` writes `education.enrolled` on every real insert regardless of source. There is no separate `adminCreateEnrollment` repo that tags the enrollment with `source='manual_admin'` and writes the audit row with `actorRole='admin'`.

**Impact**: Admin enrollments are currently indistinguishable from self-enrollments in the audit log. The `enrollments` table has no `source` column (it is in `EnrollmentView` DTO only). The enrollments table's `entitlementId` nullable column serves as a partial signal (null = admin), but the audit row does not distinguish actor role.

**Recommendation**: Phase-2.2 must add: (a) an `adminCreateEnrollment` repo that calls `upsertEnrollment` with `source='manual_admin'` semantics AND writes an in-txn audit row with `actorRole='admin'`, `actorUserId=adminId`; (b) ensure the `ensureEnrolled` route does NOT write an audit row (the spec says no audit per call for the high-frequency path).

---

### F9 — LOW: No CSRF coverage for API route progress mutations (POST /api/education/progress, POST /api/education/progress/complete)

**Severity**: Low — the API routes for progress (`POST /api/education/progress`, `POST /api/education/progress/complete`) are Next.js API route handlers, not server actions. `assertCsrf` from `csrf.tsx` reads from `FormData`. API route handlers receive JSON bodies, not FormData. The `assertCsrf` function as written cannot be used directly in API route handlers without adaptation.

**Impact**: If the API route handler does not implement CSRF protection adapted to JSON-body requests (reading from `X-WTC-CSRF` header), the progress POST endpoints are not CSRF-protected. Since these are authenticated POST mutations, they require CSRF coverage.

**Recommendation**: The API route handlers for progress must implement CSRF verification by reading the `X-WTC-CSRF` header from the request and comparing it to `csrfToken()` (the synchronizer token for the session). The client island (`ProgressTracker.tsx`, `MarkCompleteButton.tsx`) must include this header in every POST. Do not use `assertCsrf(formData)` for JSON-body API routes — use the header variant.

---

## Decisions

### D1 — Canonical audit codes: education.enrolled is the single enrollment code

`education.enrolled` is the canonical code for all enrollment events (what `upsertEnrollment` actually writes). `education.enroll` (from the Phase-2.1 design doc) is a duplicate variant retained in the array for backward compat only. No new Phase-2.2 code may write `education.enroll`. The following table shows final authoritative code assignments for Phase-2.2 mutations:

| Mutation | Canonical audit code | Source in AUDIT_ACTIONS | Repo emits |
|---|---|---|---|
| createCourse (thin) | `education.course_create` | EXISTS (line 14) | YES (repositories.ts:363) |
| createCourse (full Phase-2.2) | `education.course_create` | EXISTS | route layer must call |
| updateCourse | `education.course_update` | EXISTS (line 69) | NOT YET (route layer) |
| publishCourse | `education.course_publish` | EXISTS (line 70) | NOT YET (route layer) |
| unpublishCourse | `education.course_publish` | EXISTS — reuse with `after:{published:false}` | NOT YET (route layer) |
| deleteCourse | `education.course_delete` | EXISTS (line 71) | NOT YET (route layer) |
| createLesson | `education.lesson_create` | EXISTS (line 72) | NOT YET (route layer) |
| updateLesson | `education.lesson_update` | EXISTS (line 73) | NOT YET (route layer) |
| deleteLesson | `education.lesson_delete` | EXISTS (line 74) | NOT YET (route layer) |
| reorderLessons | `education.lesson_update` | EXISTS — reuse | NOT YET (route layer) |
| createMaterial | `education.material_upload` | EXISTS (line 75) | NOT YET (route layer) |
| deleteMaterial | `education.material_delete` | EXISTS (line 76) | NOT YET (route layer) |
| createTeacherProfile | `education.teacher_profile_create` | EXISTS (line 77) | YES (repositories.ts:556) |
| updateTeacherProfile | `education.teacher_profile_update` | EXISTS (line 78) | YES (repositories.ts:567) |
| ensureEnrolled | `education.enrolled` (only on first insert) | EXISTS (line 83) | YES (repositories.ts:577) |
| adminCreateEnrollment | `education.enrolled` with `actorRole:'admin'` | EXISTS | NOT YET — needs new repo |
| upsertProgress | NO audit row per call | — | CORRECT: none |
| markLessonComplete | NO audit row per call | — | CORRECT: none |
| markEnrollmentComplete (course completion) | `education.course_completed` | EXISTS (line 84) | YES (repositories.ts:591) |
| createPinnedLink | `education.pinned_link_create` | EXISTS (line 85) | YES (repositories.ts:618) |
| deletePinnedLink | `education.pinned_link_delete` | EXISTS (line 86) | YES (repositories.ts:629) |
| setCourseFeatured (admin) | `education.course_update` | EXISTS — reuse | NOT YET (route layer) |
| setTeacherProfileActive (admin) | `education.teacher_profile_update` | EXISTS — reuse | NOT YET (route layer) |

**Summary**: All `education.*` codes needed by Phase-2.2 ARE ALREADY in `AUDIT_ACTIONS`. No new codes need to be added to `audit.ts`. The gap is at the route/service layer: mutations for updateCourse, publishCourse, unpublishCourse, deleteCourse, lesson CRUD, material CRUD, reorderLessons, setCourseFeatured, setTeacherProfileActive all need their in-txn audit inserts in the route or service implementation. The repos for these have not yet been written.

### D2 — education.course_completed is canonical (not education.course.completed)

The education implementer handoff test (Test 5-C) references `'education.course.completed'`. That string is NOT in `AUDIT_ACTIONS`. The correct code is `'education.course_completed'` (in AUDIT_ACTIONS at line 84; written by `markEnrollmentComplete` at repositories.ts:591). All Phase-2.2 service code and tests must use `education.course_completed`.

### D3 — CSRF variant: synchronizer token (deriveSessionCsrfToken) is the Phase-2.2 production path

`apps/web/src/lib/csrf.tsx` implements the synchronizer-token variant using `deriveSessionCsrfToken`. This is internally consistent and has no bypass risk when used correctly. It is NOT the double-submit pattern described in SECURITY_MODEL.md. For Phase-2.2:
- All server actions (teacher/admin mutations via forms) call `assertCsrf(formData)` — this uses the synchronizer variant. Correct; do not change.
- All API route mutations (JSON-body progress endpoints, potential API-based mutations) must verify the synchronizer token from the `X-WTC-CSRF` request header using: `verifyCsrf(await csrfToken(), req.headers.get('x-wtc-csrf') ?? '')`. The client islands must read the token from a meta tag or server-provided prop and include it as the `X-WTC-CSRF` header.
- `SECURITY_MODEL.md §3` must be updated by the operator to reflect that the synchronizer variant is the implemented pattern.

### D4 — StudentProgressSummary: confirmed data-minimal; no email or userId exposure

`StudentProgressSummary` (defined in the education implementer handoff `packages/lms/src/types.ts`) contains: `displayName`, `enrolledAt`, `completedLessons`, `totalLessons`, `progressPct`, `lastSeenAt?`. It does NOT include `email`, `userId`, `session`, or any PII beyond the display name. The `getCourseStudentList` service method must join via `teacherProfiles.displayName` (not `users.email`). The repo must SELECT only the needed columns and MUST NOT include `users.email`, `users.password_hash`, or `users.id` in any returned shape.

This conforms to the hard rule: student non-enumeration. The teacher sees metrics and a display name only.

### D5 — XSS posture: lesson body is plain text/markdown; embedHtml must be sanitized before DB write

The landed `lessons` schema (`schema.ts:188-193`) has columns `body: text` and `videoUrl: text`. There is no `embed_html` column in the schema. The education implementer handoff's `CreateLessonSchema` includes `embedHtml?: z.string().max(5000)` and notes "embedHtml is sanitized by service before write."

Rules:
1. `lessons.body` is plain text / Markdown. The renderer in the student-facing lesson page must render Markdown with a sanitizing renderer (e.g. `marked` + `DOMPurify` in browser, or server-side `rehype-sanitize`). Raw `dangerouslySetInnerHTML` on unsanitized body text is prohibited.
2. If `embedHtml` is added to the schema in a future migration: the service method `createLesson` / `updateLesson` MUST call `sanitizeEmbedHtml(embedHtml)` (a server-side sanitizer that strips `<script>`, event attributes, and non-allowlisted tags) BEFORE writing to the DB. This sanitization must occur inside the service method, not in the route handler, so it cannot be bypassed by a direct repo call.
3. The current schema has no `embed_html` column. If Phase-2.2 adds it, migration + sanitizer must land in the same wave.
4. `MaterialView` exposes `externalUrl` (HTTPS-validated by Zod, `httpsUrl` refinement). This is safe for `<a href>` rendering but must not be rendered as `dangerouslySetInnerHTML`.

---

## Per-mutation security pipeline table

Every pipeline is in execution order. Steps may not be reordered. Column headers: Step number | Layer | Detail.

### Conventions

- `assertCsrf(formData)` = synchronizer token check using `deriveSessionCsrfToken` (csrf.tsx). For server actions on forms.
- `assertCsrfHeader(req)` = header variant: `verifyCsrf(await csrfToken(), req.headers.get('x-wtc-csrf') ?? '')`. For API route handlers with JSON bodies.
- `requireUser(session)` = getSession + 401 if no valid session.
- `can(roles, resource, action)` = RBAC matrix check; 403 on false.
- `assertTeacherOwns(teacherProfileId, courseId, isAdmin, fetchOwner)` = ownership guard; 403 on OwnershipDenied; admin bypass.
- `assertEducationAccess(userId, productCode, hasAccess)` = entitlement guard; fail-closed; 403 on EntitlementDenied.
- All repo calls that write data include an in-txn audit insert.

---

### Teacher mutations

#### createCourse (Phase-2.2 full)

```
1. assertCsrf(formData)                              — 403 on mismatch
2. Zod.safeParse(CreateCourseSchema, formData)       — 422 on failure
3. requireUser(session)                              — 401
4. can(session.roles, 'course', 'create')            — 403 (teacher | admin only)
5. load teacherProfile by session.userId             — 404 if no profile (teacher must have a profile)
6. [no entitlement check: teacher creating content]
7. tx: INSERT courses { teacherProfileId, ownerTeacherId=session.userId, title, slug, description,
        thumbnailUrl, productCode, level, tags, published:false }
   tx: INSERT audit_logs action='education.course_create'
       actorUserId=session.userId, actorRole=session.roles[0],
       targetType='course', after={ title, slug, published:false }
8. return CourseAdminView (no secrets)
```

#### updateCourse

```
1. assertCsrf(formData)
2. Zod.safeParse(UpdateCourseSchema, formData)        — 422
3. requireUser(session)                               — 401
4. can(session.roles, 'course', 'update')             — 403
5. load course by courseId                            — 404
6. assertTeacherOwns(session.userId → teacherProfile.id, courseId, isAdmin, fetchOwner) — 403
7. tx: UPDATE courses { ...patch, updatedAt }
   tx: INSERT audit_logs action='education.course_update'
       actorUserId=session.userId,
       before={ title, published } (prior values), after={ ...patch fields changed }
8. return CourseAdminView
```

#### publishCourse / unpublishCourse

```
1. assertCsrf(formData)
2. Zod.safeParse({ courseId: uuid })                 — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'course', 'update')            — 403
5. load course                                       — 404
6. assertTeacherOwns(...)                            — 403
7. tx: UPDATE courses SET published = [true|false]
   tx: INSERT audit_logs action='education.course_publish'
       after={ courseId, published:[true|false] }
8. return { courseId, published }
NOTE: unpublishCourse reuses 'education.course_publish' with after.published=false.
      Must NOT reuse 'education.course_delete'.
```

#### deleteCourse

```
1. assertCsrf(formData)
2. Zod.safeParse({ courseId: uuid })                 — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'course', 'delete')            — 403
5. load course                                       — 404
6. assertTeacherOwns(...)                            — 403 (admin bypasses; non-admin teacher cannot
                                                          delete if enrollments.count > 0: LmsConflict → 409)
7. tx: soft-delete or hard-delete if admin and override
   tx: INSERT audit_logs action='education.course_delete'
       actorUserId=session.userId, after={ courseId, title }
8. return { deleted: true }
RULE: if enrollments exist and actor is not admin, return 409 LmsConflict with enrolled count.
      Admin bypass: force-delete still audited; after includes { override: true }.
```

#### createLesson

```
1. assertCsrf(formData)
2. Zod.safeParse(CreateLessonSchema, formData)        — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'lesson', 'create')            — 403
5. load course by courseId                           — 404
6. assertTeacherOwns(...)                            — 403
7. [embedHtml present?] sanitizeEmbedHtml(embedHtml) — strip unsafe tags/attrs before DB write
8. tx: INSERT lessons { courseId, title, slug, description, contentType, videoUrl,
        sanitized_embedHtml, articleBody, externalUrl, durationSec, isPreview, sortOrder }
   tx: INSERT audit_logs action='education.lesson_create'
       after={ courseId, title, contentType }  — no body/videoUrl in audit (can be large)
9. return LessonAdminView
```

#### updateLesson

```
1. assertCsrf(formData)
2. Zod.safeParse(UpdateLessonSchema, formData)        — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'lesson', 'update')            — 403
5. load lesson; load parent course via lesson.courseId — 404
6. assertTeacherOwns(via course)                     — 403
7. [embedHtml in patch?] sanitizeEmbedHtml first
8. tx: UPDATE lessons SET { ...patch }
   tx: INSERT audit_logs action='education.lesson_update'
       after={ lessonId, changed_fields: Object.keys(patch) }
9. return LessonAdminView
```

#### deleteLesson

```
1. assertCsrf(formData)
2. Zod.safeParse({ lessonId: uuid })                 — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'lesson', 'delete')            — 403
5. load lesson → load course                         — 404
6. assertTeacherOwns(...)                            — 403
7. tx: DELETE lessons (cascade: lesson_progress, materials deleted by FK cascade)
   tx: INSERT audit_logs action='education.lesson_delete'
       after={ lessonId, courseId }
8. return { deleted: true }
```

#### reorderLessons

```
1. assertCsrf(formData)
2. Zod.safeParse(ReorderLessonsSchema, formData)     — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'lesson', 'update')            — 403
5. load course by courseId                           — 404
6. assertTeacherOwns(...)                            — 403
7. validate all lessonIds belong to courseId         — 422 on mismatch
8. tx: UPDATE lessons SET sort_order = idx for each lessonId in orderedLessonIds
   tx: INSERT audit_logs action='education.lesson_update'
       after={ courseId, reordered: true, count: orderedLessonIds.length }
9. return { reordered: true }
```

#### createMaterial

```
1. assertCsrf(formData)
2. Zod.safeParse(CreateMaterialSchema, formData)     — 422 (discriminated union: file|link)
3. requireUser(session)                              — 401
4. can(session.roles, 'material', 'create')          — 403
5. load lesson → load course                         — 404
6. assertTeacherOwns(...)                            — 403
7. [materialType='file'] fileKey = 'dev-stub/' + randomUUID() (Phase-2.2 stub; no bytes stored)
8. tx: INSERT materials { lessonId, title, materialType, fileKey?, fileName?, fileSizeBytes?,
        mimeType?, externalUrl?, sortOrder }
   tx: INSERT audit_logs action='education.material_upload'
       after={ lessonId, title, materialType, mimeType? }
       — fileKey MUST NOT appear in audit row (storage key is not a secret but is internal)
9. return MaterialView (no fileKey)
NOTE: route response MUST include 'x-wtc-stub: material-download-unavailable' header
      for materialType='file' in Phase-2.2.
```

#### deleteMaterial

```
1. assertCsrf(formData)
2. Zod.safeParse({ materialId: uuid })               — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'material', 'delete')          — 403
5. load material → load lesson → load course         — 404
6. assertTeacherOwns(...)                            — 403
7. tx: DELETE materials
   tx: INSERT audit_logs action='education.material_delete'
       after={ materialId, lessonId }
8. return { deleted: true }
```

#### updateTeacherProfile

```
1. assertCsrf(formData)
2. Zod.safeParse(UpdateTeacherProfileSchema, formData) — 422
3. requireUser(session)                               — 401
4. can(session.roles, 'course', 'update') OR session.userId === profile.userId — 403
   [non-admin self: ownership check session.userId === teacherProfile.userId]
   [admin: can(roles,'course','manage') — bypasses ownership]
5. load teacherProfile by teacherProfileId            — 404
6. [non-admin] if teacherProfile.userId !== session.userId → 403
7. [socialLinks present] validate each URL: must pass httpsUrl refinement — 422
8. tx: UPDATE teacher_profiles SET { ...patch, updatedAt }
   tx: INSERT audit_logs action='education.teacher_profile_update'
       actorUserId=session.userId, actorRole=activeRole,
       targetType='teacher_profile', targetId=teacherProfileId
       — no bio text in audit (may be large/personal)
9. return TeacherProfileView
```

#### createPinnedLink

```
1. assertCsrf(formData)
2. Zod.safeParse(CreatePinnedLinkSchema, formData)   — 422
   [refine: ownerType='global' requires ownerId absent; others require ownerId present]
3. requireUser(session)                              — 401
4. can(session.roles, 'course', 'create') OR isAdmin — 403
   [ownerType='global': admin only — assertAdmin(session.roles)]
5. [ownerType='teacher_profile'] load profile; if profile.userId !== session.userId AND !isAdmin → 403
   [ownerType='course'] assertTeacherOwns(...)      — 403
   [ownerType='global'] assertAdmin(session.roles)  — 403
6. [ownerId present] validate ownerId is a real course/profile UUID (load it)
7. tx: INSERT pinned_links { ownerType, ownerId (NULL if global), label, url, iconType, sortOrder }
   tx: INSERT audit_logs action='education.pinned_link_create'
       after={ ownerType, ownerId?, label }
8. return PinnedLinkView
NOTE: schema.pinnedLinks.ownerId is currently NOT NULL — this is a blocker (see F3).
      Phase-2.2 cannot insert global pinned links until the column is made nullable.
```

#### deletePinnedLink

```
1. assertCsrf(formData)
2. Zod.safeParse({ linkId: uuid })                  — 422
3. requireUser(session)                             — 401
4. can(session.roles, 'course', 'delete') OR isAdmin — 403
5. load pinnedLink                                  — 404
6. [non-admin] verify session.userId === pinnedLink.createdBy — 403
   [admin] bypass ownership
7. tx: UPDATE pinned_links SET is_active=false (soft-delete; history preserved)
   tx: INSERT audit_logs action='education.pinned_link_delete'
       after={ linkId, ownerType }
8. return { deleted: true }
NOTE: the repo uses soft-delete correctly (repositories.ts:626). Never hard-delete.
```

---

### Student mutations

#### ensureEnrolled (idempotent; called on course page open)

```
1. [NO CSRF required for this path IF called from a server component during page render]
   [IF called from an API route POST: assertCsrfHeader(req)]
2. Zod.safeParse({ courseId: uuid }, input)          — 422
3. requireUser(session)                              — 401
4. can(session.roles, 'enrollment', 'create')        — 403
5. assertEducationAccess(session.userId, course.productCode ?? 'education', hasAccess)
   — 403 EntitlementDenied if not entitled; fail-closed
6. load course; 404 if not published (published course required before enrolling)
7. repo: upsertEnrollment({ userId, courseId, entitlementId: activeEntitlement?.id })
   — ON CONFLICT DO NOTHING; audit row ONLY on first insert (education.enrolled)
8. return EnrollmentView
NOTE: no audit row on re-enrollment (idempotent path).
     The landed repo (repositories.ts:573-583) is correct for this.
```

#### upsertProgress (POST /api/education/progress — high-frequency API route)

```
1. assertCsrfHeader(req)                            — 403 (JSON body, not FormData)
2. Zod.safeParse(UpsertProgressSchema, body)         — 422
   { lessonId: uuid, courseId: uuid, progressPct: int 0-100 }
3. requireUser(session)                             — 401
4. can(session.roles, 'enrollment', 'read')         — 403 (implicit: must be enrolled)
5. assertEducationAccess(session.userId, course.productCode ?? 'education', hasAccess) — 403
6. load enrollment for (session.userId, courseId)  — 403 if not enrolled (must be enrolled first)
7. SERVICE-LAYER DEBOUNCE: getLessonProgress(session.userId, lessonId)
   if lastAccessedAt > now - 8000ms → return existing ProgressView (no DB write)
8. [progressPct >= 95] auto-transition state to 'completed'
9. repo: upsertLessonProgress({ userId, lessonId, percentComplete, completed })
   [if state just transitioned to completed]: checkCourseCompletion(tx, userId, courseId)
     → if all published lessons complete: markEnrollmentComplete → audit education.course_completed
10. NO per-call audit row for upsertProgress itself
11. Rate limit: 6/min/user/lesson enforced at route middleware
12. return ProgressView
```

#### markLessonComplete (POST /api/education/progress/complete)

```
1. assertCsrfHeader(req)                            — 403
2. Zod.safeParse(MarkCompleteSchema, body)          — 422
   { lessonId: uuid, courseId: uuid }
3. requireUser(session)                             — 401
4. assertEducationAccess(session.userId, course.productCode ?? 'education', hasAccess) — 403
5. load enrollment for (session.userId, courseId)  — 403 if not enrolled
6. repo: upsertLessonProgress({ userId, lessonId, percentComplete:'100', completed:true })
   in same tx: checkCourseCompletion (may write education.course_completed)
7. NO per-call audit row for markLessonComplete itself
8. return ProgressView
```

---

### Admin mutations

#### adminCreateEnrollment

```
1. assertCsrf(formData)
2. Zod.safeParse(AdminCreateEnrollmentSchema, formData) — 422
   { userId: uuid, courseId: uuid }
3. requireUser(session)                              — 401
4. assertAdmin(session.roles)                        — 403 (admin only)
5. load user by userId                              — 404
6. load course by courseId                          — 404 if not found (admin can enroll in any)
7. [no entitlement check: admin bypasses entitlement for manual enrollment]
8. tx: INSERT enrollments { userId, courseId, entitlementId: null } ON CONFLICT DO NOTHING
   tx: INSERT audit_logs action='education.enrolled'
       actorUserId=session.userId (admin), actorRole='admin',
       targetType='enrollment', after={ userId, courseId, source:'manual_admin' }
9. return EnrollmentView { source:'manual_admin' }
NOTE: audit row must carry actorRole='admin' and the target userId — this is an admin action
      on behalf of another user. The targetId should be the enrollment row id.
```

#### setCourseFeatured (admin)

```
1. assertCsrf(formData)
2. Zod.safeParse({ courseId: uuid, isFeatured: boolean }, formData) — 422
3. requireUser(session)                              — 401
4. assertAdmin(session.roles)                        — 403
5. load course                                       — 404
6. tx: UPDATE courses SET is_featured = isFeatured  [requires is_featured column in schema/migration]
   tx: INSERT audit_logs action='education.course_update'
       after={ courseId, isFeatured }
7. return { courseId, isFeatured }
NOTE: is_featured is not in the landed schema.ts. Migration 0002/0003 must add it.
      This is a TARGET column; Phase-2.2 must not write it until the column exists.
```

#### Admin overrides (setTeacherProfileActive, admin course update)

```
[setTeacherProfileActive]
1. assertCsrf(formData)
2. Zod.safeParse({ teacherProfileId: uuid, isActive: boolean }) — 422
3. requireUser(session)                              — 401
4. assertAdmin(session.roles)                        — 403
5. load teacherProfile                               — 404
6. tx: UPDATE teacher_profiles SET is_active = isActive
   tx: INSERT audit_logs action='education.teacher_profile_update'
       actorUserId=session.userId, actorRole='admin'
       after={ isActive }
7. return { teacherProfileId, isActive }

[admin updateCourse — same as teacher pipeline but ownership check skipped]
Steps 1-3 same.
4. assertAdmin(session.roles)                        — 403
5. load course                                       — 404
6. [NO assertTeacherOwns — admin bypass]
7-8. Same tx/audit as teacher updateCourse.
```

---

## CSRF coverage summary

| Mutation | CSRF required | Method | Implementation |
|---|---|---|---|
| createCourse | YES | assertCsrf(formData) | server action |
| updateCourse | YES | assertCsrf(formData) | server action |
| publishCourse / unpublishCourse | YES | assertCsrf(formData) | server action |
| deleteCourse | YES | assertCsrf(formData) | server action |
| createLesson | YES | assertCsrf(formData) | server action |
| updateLesson | YES | assertCsrf(formData) | server action |
| deleteLesson | YES | assertCsrf(formData) | server action |
| reorderLessons | YES | assertCsrf(formData) | server action |
| createMaterial | YES | assertCsrf(formData) | server action |
| deleteMaterial | YES | assertCsrf(formData) | server action |
| updateTeacherProfile | YES | assertCsrf(formData) | server action |
| createPinnedLink | YES | assertCsrf(formData) | server action |
| deletePinnedLink | YES | assertCsrf(formData) | server action |
| ensureEnrolled (server component) | NO (read context) | — | server render, not mutation |
| ensureEnrolled (API POST) | YES | assertCsrfHeader(req) | if exposed as API |
| upsertProgress (API POST) | YES | assertCsrfHeader(req) | client island POSTs JSON |
| markLessonComplete (API POST) | YES | assertCsrfHeader(req) | client island POSTs JSON |
| adminCreateEnrollment | YES | assertCsrf(formData) | admin form |
| setCourseFeatured | YES | assertCsrf(formData) | admin form |
| setTeacherProfileActive | YES | assertCsrf(formData) | admin form |

---

## RBAC matrix for Phase-2.2 resources (verified from rbac.ts)

| Resource | Action | user | teacher | admin | support |
|---|---|---|---|---|---|
| course | read | YES | YES | YES | NO |
| course | create | NO | YES | YES | NO |
| course | update | NO | YES | YES | NO |
| course | delete | NO | YES | YES | NO |
| course | manage | NO | NO | YES | NO |
| lesson | read | YES | YES | YES | NO |
| lesson | create | NO | YES | YES | NO |
| lesson | update | NO | YES | YES | NO |
| lesson | delete | NO | YES | YES | NO |
| material | read | YES | YES | YES | NO |
| material | create | NO | YES | YES | NO |
| material | update | NO | YES | YES | NO |
| material | delete | NO | YES | YES | NO |
| enrollment | read | YES | YES | YES | NO |
| enrollment | create | YES | NO | YES | NO |
| enrollment | manage | NO | NO | YES | NO |

All confirmed present in `rbac.ts:30-54`. The `support` role has no write access to any LMS resource — confirmed correct (support is read-only for audit/tickets).

Note: teacher ownership on `course/lesson/material` is enforced at the service layer via `assertTeacherOwns`, not by a separate RBAC resource. The RBAC matrix grants teachers the action; ownership narrows it to their own objects. Admin role has `manage` on course (implying all actions) — `can(['admin'],'course','read')` returns true through the manage path.

---

## No-secrets and data-minimisation verification

### Audit rows — no secrets in any education action payload

All confirmed-landed repos write safe payloads:
- `createTeacherProfile` after: `{ displayName }` — no bio (personal text), no avatarUrl (URL is not a secret but is personal; consider omitting).
- `updateTeacherProfile` after: none (no patch fields — see repositories.ts:567). This is correct for privacy; the change is recorded but no field values are in the audit row.
- `upsertEnrollment` after: `{ courseId }` — no userId leak (actorUserId carries that implicitly).
- `markEnrollmentComplete` after: `{ courseId }` — correct.
- `createPinnedLink` after: `{ label, ownerType }` — no URL in audit row (URL is not a secret but omitting reduces noise; the label is sufficient for forensics).
- `deletePinnedLink` after: none — correct.

Phase-2.2 route-layer audit rows must follow the same pattern: never put lesson body text, embed HTML, or material file keys in audit before/after.

### StudentProgressSummary — no email, userId, or session

Type definition confirmed: `displayName`, `enrolledAt`, `completedLessons`, `totalLessons`, `progressPct`, `lastSeenAt?`. The `getCourseStudentList` service method SQL must join via `teacher_profiles.display_name` (NOT `users.email`). The `userId` column from the `enrollments` table must not appear in the returned shape.

### MaterialView — no fileKey

`MaterialView` type omits `fileKey`. The `getMaterialDownloadUrl` route must not return `fileKey` in any response field. The DB `materials` table (if extended to have `file_key`) must never join that column into the student-facing view.

### lesson.body and embed_html — confirmed no HTML injection path in current schema

The `lessons.body` column stores plain text. No `embed_html` column exists in the landed schema. Until migration adds it, there is no XSS vector at the schema layer. The renderer must apply Markdown-safe processing (no raw `dangerouslySetInnerHTML` on unsanitized text).

---

## Risks

### R1 — BLOCKING: pinnedLinks.ownerId is NOT NULL (F3)

Admin-created global pinned links cannot be inserted. The `createPinnedLink` pipeline for `ownerType='global'` is blocked until the schema column is made nullable and the repo signature updated. Phase-2.2 must not ship the global pinned links feature until this is resolved.

### R2 — BLOCKING: lesson_progress column name mismatch between landed schema and LMS service spec (F2)

The service method `upsertProgress` (from the implementer spec) references `progressPct` / `state` / `completedAt`. The landed schema has `percentComplete`, `completed`, `lastAccessedAt`. The service layer must reconcile to the landed columns or migration 0002 must be amended. This must be resolved before the service is written — writing it against the wrong column names will compile but fail at runtime.

### R3 — HIGH: CSRF variant not reflected in SECURITY_MODEL.md (F1)

The synchronizer-token implementation diverges from the documented double-submit pattern. While there is no immediate bypass risk, the documentation is wrong and could mislead future implementers into mixing patterns.

### R4 — HIGH: assertCsrfHeader pattern does not exist yet (F9)

The API route handlers for progress mutations need a CSRF header check. No utility function for this exists in `csrf.tsx`. The implementer must add a `assertCsrfFromRequest(req: Request): Promise<void>` function to `csrf.tsx` that reads `req.headers.get('x-wtc-csrf')` and calls `verifyCsrf(await csrfToken(), headerValue)`. Without this, the progress API endpoints are CSRF-unprotected POST mutations.

### R5 — MEDIUM: createCourse full-service actor/profile separation (F4)

If the Phase-2.2 `createCourse` service method copies the thin repo pattern and uses `teacherProfileId` as `actorUserId`, the audit row will carry the profile UUID rather than the user UUID. This makes the audit row non-joinable against `users` table and breaks the actor identity chain.

### R6 — MEDIUM: education.enroll / education.enrolled duplicate codes (F5)

Two codes for the same event exist in `AUDIT_ACTIONS`. While having both does not break anything, any audit query for "all enrollments" must union on both codes. The non-canonical code (`education.enroll`) must not be written by any new code.

### R7 — LOW: upsertLessonProgress debounce not at repo layer (F7)

The high-frequency upsert has no server-side 8-second guard. The service method must implement this before the progress API is live; otherwise the DB is written on every client event within the 6/min rate limit.

### R8 — LOW: is_featured column absent from landed schema

`setCourseFeatured` pipeline requires `is_featured: boolean` on `courses`. Not present in `schema.ts`. Must be added in migration before the admin feature is built.

---

## Verification/tests

The operator must add the following tests using Vitest + the PGlite integration harness.

### 1. CSRF coverage — Phase-2.2 server actions

```typescript
// Pattern for every Phase-2.2 teacher/admin server action:
it('createCourse rejects missing CSRF token', async () => {
  const fd = new FormData();
  fd.set('title', 'Test');
  fd.set('slug', 'test');
  // no 'csrf' field
  await expect(createCourseAction(fd)).rejects.toThrow('CSRF');
});

it('createCourse rejects mismatched CSRF token', async () => {
  const fd = new FormData();
  fd.set('title', 'Test');
  fd.set('slug', 'test');
  fd.set('csrf', 'wrong-token');
  await expect(createCourseAction(fd)).rejects.toThrow('CSRF');
});

it('createCourse accepts valid CSRF token', async () => {
  const token = await csrfToken(); // real token for session
  const fd = new FormData();
  fd.set('title', 'Test');
  fd.set('slug', 'test');
  fd.set('csrf', token);
  const result = await createCourseAction(fd);
  expect(result.id).toBeDefined();
});
// Repeat for: updateCourse, publishCourse, unpublishCourse, deleteCourse,
// createLesson, updateLesson, deleteLesson, reorderLessons,
// createMaterial, deleteMaterial, updateTeacherProfile,
// createPinnedLink, deletePinnedLink, adminCreateEnrollment,
// setCourseFeatured, setTeacherProfileActive.
```

### 2. CSRF header — API route progress mutations

```typescript
it('POST /api/education/progress rejects missing x-wtc-csrf header', async () => {
  const res = await fetch('/api/education/progress', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lessonId: '...', courseId: '...', progressPct: 50 }),
  });
  expect(res.status).toBe(403);
});

it('POST /api/education/progress/complete rejects wrong csrf header', async () => {
  const res = await fetch('/api/education/progress/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-wtc-csrf': 'wrong' },
    body: JSON.stringify({ lessonId: '...', courseId: '...' }),
  });
  expect(res.status).toBe(403);
});
```

### 3. RBAC matrix — Phase-2.2 resources (spot-check the critical deny cells)

```typescript
import { can, assertAdmin } from '@wtc/auth';

// Lesson
it('user cannot create lesson', () => expect(can(['user'], 'lesson', 'create')).toBe(false));
it('teacher can create lesson', () => expect(can(['teacher'], 'lesson', 'create')).toBe(true));
it('admin can create lesson', () => expect(can(['admin'], 'lesson', 'create')).toBe(true));
it('support cannot create lesson', () => expect(can(['support'], 'lesson', 'create')).toBe(false));

// Enrollment
it('user can create enrollment', () => expect(can(['user'], 'enrollment', 'create')).toBe(true));
it('teacher cannot create enrollment', () => expect(can(['teacher'], 'enrollment', 'create')).toBe(false));

// Course delete — user cannot
it('user cannot delete course', () => expect(can(['user'], 'course', 'delete')).toBe(false));
it('teacher can delete course', () => expect(can(['teacher'], 'course', 'delete')).toBe(true));

// assertAdmin
it('assertAdmin throws for teacher role', () => {
  expect(() => assertAdmin(['teacher'])).toThrow('FORBIDDEN');
});
it('assertAdmin passes for admin role', () => {
  expect(() => assertAdmin(['admin'])).not.toThrow();
});
```

### 4. Ownership isolation — teacher cannot edit another teacher's course

```typescript
it('teacher A cannot updateCourse owned by teacher B', async () => {
  const { db } = await createTestDb();
  const teacherA = await createUser(db, { email: 'a@t.com', passwordHash: 'h', displayName: 'A', roles: ['teacher'] });
  const teacherB = await createUser(db, { email: 'b@t.com', passwordHash: 'h', displayName: 'B', roles: ['teacher'] });
  const profileB = await createTeacherProfile(db, { userId: teacherB.id, displayName: 'B' });
  const courseB = await createCourse(db, { ownerTeacherId: teacherB.id, title: 'B Course' });
  // simulate full-service updateCourse with isAdmin=false, actorUserId=teacherA.id
  await expect(
    updateCourseService(db, teacherA.id, false, courseB.id, { title: 'Hacked' })
  ).rejects.toThrow('OwnershipDenied');
});

it('admin can updateCourse owned by any teacher', async () => {
  // same setup; pass isAdmin=true
  const result = await updateCourseService(db, adminUser.id, true, courseB.id, { title: 'Admin Edit' });
  expect(result.title).toBe('Admin Edit');
  // audit log must carry actorUserId=adminUser.id
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'education.course_update'));
  expect(logs[0].actorUserId).toBe(adminUser.id);
});
```

### 5. In-txn audit — education mutations write the correct codes

```typescript
it('createTeacherProfile writes education.teacher_profile_create audit row', async () => {
  const { db } = await createTestDb();
  const user = await createUser(db, { ... });
  await createTeacherProfile(db, { userId: user.id, displayName: 'Prof X' });
  const logs = await db.select().from(auditLogs)
    .where(eq(auditLogs.action, 'education.teacher_profile_create'));
  expect(logs).toHaveLength(1);
  expect(logs[0].actorUserId).toBe(user.id);
  expect((logs[0].after as any).displayName).toBe('Prof X');
});

it('upsertEnrollment writes education.enrolled only on first insert', async () => {
  const { db } = await createTestDb();
  const user = await createUser(db, { ... });
  const course = await createCourse(db, { ownerTeacherId: user.id, title: 'C' });
  await upsertEnrollment(db, { userId: user.id, courseId: course.id });
  await upsertEnrollment(db, { userId: user.id, courseId: course.id }); // second call
  const logs = await db.select().from(auditLogs)
    .where(eq(auditLogs.action, 'education.enrolled'));
  expect(logs).toHaveLength(1); // exactly one audit row, not two
});

it('markEnrollmentComplete writes education.course_completed (not education.course.completed)', async () => {
  const { db } = await createTestDb();
  const user = await createUser(db, { ... });
  const course = await createCourse(db, { ownerTeacherId: user.id, title: 'C' });
  await upsertEnrollment(db, { userId: user.id, courseId: course.id });
  await markEnrollmentComplete(db, user.id, course.id);
  const logs = await db.select().from(auditLogs)
    .where(eq(auditLogs.action, 'education.course_completed'));
  expect(logs).toHaveLength(1);
  // confirm the wrong code was NOT written
  const wrongCode = await db.select().from(auditLogs)
    .where(eq(auditLogs.action, 'education.course.completed' as any));
  expect(wrongCode).toHaveLength(0);
});
```

### 6. StudentProgressSummary — no email or userId in teacher's student list

```typescript
it('getCourseStudentList returns only displayName + progress metrics (no email, no userId)', async () => {
  const summary = await lmsService.getCourseStudentList(teacherId, false, courseId);
  for (const s of summary) {
    expect(s).not.toHaveProperty('email');
    expect(s).not.toHaveProperty('userId');
    expect(s).not.toHaveProperty('session');
    expect(s).toHaveProperty('displayName');
    expect(s).toHaveProperty('progressPct');
    expect(typeof s.displayName).toBe('string');
  }
});
```

### 7. XSS posture — embedHtml sanitization

```typescript
it('createLesson strips script tags from embedHtml before DB write', async () => {
  const result = await lmsService.createLesson(teacherId, false, courseId, {
    title: 'Embed Lesson',
    slug: 'embed-lesson',
    contentType: 'embed',
    embedHtml: '<iframe src="https://example.com"></iframe><script>alert(1)</script>',
  });
  expect(result.embedHtml).not.toContain('<script>');
  expect(result.embedHtml).not.toContain('alert(1)');
});

it('createLesson strips event attributes from embedHtml', async () => {
  const result = await lmsService.createLesson(teacherId, false, courseId, {
    title: 'Embed2',
    slug: 'embed-2',
    contentType: 'embed',
    embedHtml: '<iframe onload="stealCookies()"></iframe>',
  });
  expect(result.embedHtml).not.toContain('onload');
});
```

### 8. Entitlement fail-closed — upsertProgress denied without education access

```typescript
it('upsertProgress returns 403 when education entitlement is absent', async () => {
  // user with no entitlements
  const res = await POST_with_valid_csrf('/api/education/progress', {
    lessonId: validLesson.id,
    courseId: validCourse.id,
    progressPct: 50,
  }, noEntitlementSession);
  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.error).toBe('ENTITLEMENT_DENIED');
});
```

---

## Next actions

In priority order:

1. **Resolve pinnedLinks.ownerId NOT NULL (R1 / F3)** — blocking for global pinned links. Amend migration 0002 to make `owner_id` nullable; add CHECK constraint; update `createPinnedLink` repo signature to accept `ownerId?: string`.

2. **Resolve lessonProgress column name mismatch (R2 / F2)** — blocking for service layer. Either: (a) keep the landed columns (`percentComplete`, `completed`, `lastAccessedAt`) and adapt all service method code and DTO mappers to use them, OR (b) amend migration 0002 to add plan §4.6 columns. Decision must be made before any `upsertProgress` service code is written.

3. **Add assertCsrfFromRequest utility to csrf.tsx (R4 / F9)** — blocking for progress API routes. Add:
   ```typescript
   export async function assertCsrfFromRequest(req: Request): Promise<void> {
     const header = req.headers.get('x-wtc-csrf') ?? '';
     const expected = await csrfToken();
     if (!expected || !verifyCsrf(expected, header)) throw new AppError('forbidden', 'CSRF validation failed');
   }
   ```
   Client islands must read the synchronizer token from a server-provided prop and include it as `X-WTC-CSRF` header.

4. **Update SECURITY_MODEL.md §3** — document that the synchronizer-token variant (deriveSessionCsrfToken) is the implemented production CSRF path; the double-submit pattern is available but not active (F1 / R3).

5. **Write Phase-2.2 repos for updateCourse, lesson CRUD, material CRUD** — each must include an in-txn audit insert with the correct action code (see D1 table above). The route layer must NOT write audit rows separately; the repo transaction is the only place.

6. **Fix adminCreateEnrollment** (F8) — add a distinct repo function that writes the audit row with `actorRole:'admin'` and does not depend on the `ensureEnrolled` idempotent path.

7. **Implement sanitizeEmbedHtml** in `packages/lms/src/service/` — must strip `<script>`, `on*` event attributes, and non-allowlisted tags. Must be called inside `createLesson` / `updateLesson` service methods before the DB write.

8. **Do not use education.enroll in new code** (F5 / R6) — the code is retained in the array but must not appear in any Phase-2.2 route or service. Use `education.enrolled` exclusively.

9. **Add is_featured column to courses** if `setCourseFeatured` is in Phase-2.2 scope — add it as a nullable `boolean` column in migration 0002/0003 before building the admin route.

10. **Run regression tests** (Verification section above) — all 8 test groups must be green before Phase-2.2 routes are considered complete.
