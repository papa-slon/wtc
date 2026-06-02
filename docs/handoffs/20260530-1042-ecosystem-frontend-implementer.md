# ecosystem-frontend-implementer handoff

_Epoch 20260530-1042. Phase 2.2 — Full LMS UI (read-only audit + specification). No code edited.
Per `docs/SESSION_PROTOCOL.md`: this handoff specifies the exact file structure, server-component
shape, action patterns, storage-badge convention, and state coverage for every LMS route the
operator will implement. The implementing session reads this as the canonical instruction set._

---

## Scope

Specify the complete `apps/web` implementation plan for Phase 2.2 Full LMS UI, covering:

1. `features/lms/` structure: `queries.ts`, `actions.ts`, `types.ts`, and named presentational
   components — with no business logic in React pages.
2. Server-component shape for every LMS route (teacher, student, admin) mapped to the lean column
   set confirmed in the codebase (no slug, no tags, no embed — real columns only).
3. Inline server-action patterns for every mutation (CsrfField + assertCsrf + requireUser + RBAC +
   ownership + revalidatePath), exactly as the Phase-2.1 `bots/[bot]/settings/page.tsx` surface does.
4. Storage badge pattern (backendMode / getServerDb → 'storage: Postgres' vs
   'storage: in-memory (demo)') on every LMS page, matching the exact JSX pattern from
   `indicators/page.tsx` lines 39-46.
5. Entitlement-locked / unpublished / empty / loading state coverage per the design system state
   matrix and the fail-closed rules.
6. Reuse map: existing `@wtc/ui` exports vs new surface-local presentational components.

---

## Files inspected

- `AGENTS.md` — roster, non-negotiable gates, conventions.
- `docs/SESSION_PROTOCOL.md` — process governance.
- `docs/handoffs/20260530-0925-ecosystem-education-implementer.md` — full LmsService interface,
  Zod schemas, view types, ownership guards, route tree, progress persistence rules, test matrix.
  This is the canonical contract spec this handoff translates into UI instructions.
- `docs/DESIGN_SYSTEM.md` — component inventory, state matrix, editorial (v3) direction for student
  pages, storage-badge mandatory requirement (§13.5).
- `apps/web/src/app/(app)/app/indicators/page.tsx` — gold-standard pattern: backendMode storage
  badge, RiskWarningBanner for entitlement wall, CsrfField + assertCsrf in inline server action,
  accessFor fail-closed, fmtDate, StatusPill, EmptyState, wtc-table.
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` — Phase-2.1 real feature surface:
  loadBot/BotAccessRequired (feature-module data loader), botConfigSchema Zod parse in action,
  getServerDb-backed persistBotConfig, backendMode badge.
- `apps/web/src/features/bots/config.ts` — the canonical feature-module shape: `'server-only'`
  top-of-file, getServerDb(), 'demo' fallback label, Zod schema, view-type interfaces, async loader
  functions. This is the pattern `features/lms/queries.ts` MUST replicate exactly.
- `apps/web/src/features/support/data.ts` — second example of the same feature-module pattern.
- `apps/web/src/lib/session.ts` — requireUser, getCurrentUser, isAdmin.
- `apps/web/src/lib/access.ts` — accessFor, reasonLabel, reasonTone (entitlement check, fail-closed).
- `apps/web/src/lib/csrf.tsx` — CsrfField (async server component), assertCsrf (throws on mismatch).
- `apps/web/src/lib/format.ts` — fmtDate, fmtMoney, fmtPct, fmtNum (null renders as '—').
- `apps/web/src/lib/backend.ts` — backendMode, getServerDb, lmsService (4-method thin),
  deniedLmsService (must grow with interface), recentAuditEvents.
- `apps/web/src/lib/lms-types.ts` — thin 4-method LmsService interface (current ground truth).
- `apps/web/src/lib/demo.ts` — in-memory lmsService adapter (must grow with interface).
- `apps/web/src/lib/db-store.ts` — DB lmsService adapter (must grow with interface).
- `apps/web/src/app/teacher/page.tsx` — thin real teacher surface: RBAC redirect pattern, inline
  createCourseAction, getCurrentUser (not requireUser — note the difference vs indicators).
- `apps/web/src/app/teacher/layout.tsx` — RBAC guard (teacher||admin → /app redirect).
- `apps/web/src/app/teacher/courses/page.tsx` — pure Placeholder, safe to replace.
- `apps/web/src/app/teacher/courses/[id]/page.tsx` — pure Placeholder, safe to replace.
- `apps/web/src/app/teacher/materials/page.tsx` — pure Placeholder, safe to replace.
- `apps/web/src/app/teacher/students/page.tsx` — pure Placeholder, safe to replace.
- `apps/web/src/app/(app)/app/education/page.tsx` — thin real student surface: storage badge
  (lines 25-31 — exact JSX to replicate), entitlement wall RiskWarningBanner, Community placeholder.
- `apps/web/src/app/admin/education/page.tsx` — pure Placeholder, safe to replace.
- `apps/web/src/app/admin/layout.tsx` — admin RBAC layout (isAdmin server-side).
- `packages/ui/src/index.ts` — exports: Card, SectionHeader, StatusPill, MetricCard, MetricValue,
  RiskWarningBanner, EmptyState, ProductStatusCard, buttonClasses, Tone, cn.
- `packages/ui/src/components.tsx` — exact signatures for all exported components. EmptyState
  accepts {title, hint?}. Card accepts {title?, action?, children, className?}.
- `packages/lms/src/index.ts` — current thin synchronous LmsService class over Maps, LmsStore,
  createMemoryLmsStore, Course, Lesson, Material, LessonProgress, Actor. Barrel exports these.

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. [INFO] Lean column set confirmed — schema note for route params

The actual DB schema (migration 0000) uses `published` (boolean), `title`, `description`,
`video_url`, `order`, `body` on lessons. There is no `slug`, `tags`, `embed_html`, `level`,
`thumbnail_url`, `sort_order`, or `content_type` column in the existing thin schema. The Phase 2.2
route param for course detail must be `[id]` (UUID) — which the existing placeholder already uses
at `teacher/courses/[id]/page.tsx`. Student routes should likewise use `[courseId]` and `[lessonId]`
(UUIDs), not slugs. This matches the Phase-2.1 education-implementer handoff finding §2 and the
explicit note "Route by course id / lesson id (no slug column exists)" in the task prompt.

For the full LmsService interface (22-method contract from the education-implementer handoff), the
new methods add `videoUrl`, `order`, and `published` for lessons; `label`/`url`/`kind` for
materials; `progressPct`/`completed` for progress; `displayName` for teacher profiles and
`pinned_links`. No rich fields need to be fabricated.

### 2. [CRITICAL] teacher/page.tsx uses getCurrentUser, not requireUser — inconsistency to fix

`teacher/page.tsx` line 6 imports `getCurrentUser` and manually `redirect('/login')` on null.
All other authenticated surfaces (indicators, bots/settings, education/page.tsx) use `requireUser`
which throws `UNAUTHENTICATED` caught by the error boundary. The new LMS pages MUST use
`requireUser` consistently (matching indicators.tsx and education/page.tsx). The teacher/page.tsx
should be updated to `requireUser` when Phase 2.2 replaces its content.

The `teacher/layout.tsx` already guards with redirect — but only role-checks, not auth. Using
`requireUser` inside the page (not relying solely on the layout redirect) is the defensive pattern
in Phase-2.1 surfaces.

### 3. [INFO] backendMode token is 'memory' not 'demo' — badge text must say 'in-memory (demo)'

`backend.ts` line 35: `export const backendMode: 'postgres' | 'memory' = useDb ? 'postgres' : 'memory'`.
The value is `'memory'`, not `'demo'`. The storage badge check is `backendMode === 'postgres'`.
When false, the label text visible to the user is "storage: in-memory (demo)" (as seen in
`indicators/page.tsx` line 42 and `education/page.tsx` line 29). Every new LMS page must use
`backendMode === 'postgres'` as the condition and the exact strings:
- true branch: `<StatusPill tone="ok">storage: Postgres</StatusPill>`
- false branch: `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>` + explanatory span.

The span text for LMS pages should read: "Dev fallback — LMS content resets on restart. Set
DATABASE_URL to persist to Postgres." This appears above all course/lesson data, not inside a Card.

### 4. [INFO] lmsService in backend.ts is the only call site — features/lms/queries.ts wraps it

The feature-module pattern (config.ts, support/data.ts) calls `getServerDb()` and invokes
`@wtc/db` repos directly for complex data shapes. For LMS, the full `LmsService` interface is the
indirection layer — `features/lms/queries.ts` imports `lmsService` from `@/lib/backend` (not
`getServerDb`) and wraps calls into typed view-loader functions. `getServerDb()` is used only for
admin audit queries (recentAuditEvents already covers this) or for direct repo calls that are not
on the LmsService interface. The implication: `features/lms/queries.ts` depends on lmsService being
extended first (the backend.ts + lms-types.ts + demo.ts + db-store.ts quad-update).

### 5. [INFO] entitlement check pattern: accessFor, not manual entitlementsOf

`access.ts` exposes `accessFor(userId, productCode): Promise<AccessDecision>` which internally
calls `entitlementsOf` and `explainAccess`. All LMS student routes check
`await accessFor(user.id, 'education')` (or the course's productCode if non-null). Never call
`entitlementsOf` directly in route files. The RBAC check (teacher/admin role) precedes entitlement
for teacher routes; student routes check entitlement only.

### 6. [INFO] No CourseAdminView / LessonAdminView in packages/lms yet — queries.ts returns lean DTOs

The current `packages/lms` exports: `Course`, `Lesson`, `Material`, `LessonProgress`, `Actor`,
`LmsStore`, `LmsService` class (synchronous). The view types from the education-implementer handoff
(`CourseAdminView`, `LessonAdminView`, `TeacherProfileView`, etc.) do not yet exist in the package.
Until the full refactor lands, `features/lms/queries.ts` defines local view interfaces that map
from the thin `CourseView` (= `CourseDTO` from `@wtc/db`) and `LessonView` (= `LessonDTO`) shapes
using the columns that actually exist: `id`, `ownerTeacherId`, `title`, `description`, `published`,
`createdAt` for courses; `id`, `courseId`, `title`, `body`, `videoUrl`, `order`, `published` for
lessons. These local view interfaces live in `features/lms/types.ts`, not in `packages/lms`.

### 7. [INFO] deniedLmsService in backend.ts has only 4 methods — typecheck will fail on extension

`backend.ts` lines 79-84: `deniedLmsService` implements only the thin 4 methods. When
`lms-types.ts` is extended to the full 22-method interface, the TypeScript compiler will report a
missing-method error on `deniedLmsService`. This must be fixed atomically in the same diff as the
interface extension — every new method throws `new Error(DENIED_MSG)`. This is a compile-enforced
gate; do not merge a partial interface extension.

### 8. [INFO] demo.ts lmsService has only 4 methods — must grow with interface

`demo.ts` lines 124-139: the in-memory lmsService object implements only 4 methods. Extension
requires implementing all ~18 new methods over `S().lmsStore` (the existing `Map` structures plus
new Maps for enrollments, lesson_progress, teacher_profiles, pinned_links added to `DemoState`).
The "storage: in-memory (demo)" label on each page is the honest user-visible disclosure.

### 9. [INFO] materials/page.tsx is a teacher-level route, not lesson-level

The existing placeholder at `teacher/materials/page.tsx` is teacher-scoped. The education-implementer
handoff routes materials at `teacher/courses/[id]/lessons/[lessonId]/materials/page.tsx` (lesson-
scoped). The teacher-level materials page becomes a cross-course materials overview (list all
materials for all teacher's lessons). Both can coexist; the lesson-scoped route is more useful.

### 10. [INFO] admin/education/page.tsx is a single Placeholder — the full admin surface needs sub-routes

The admin education area currently has one file. Phase 2.2 adds at minimum:
`admin/education/page.tsx` (overview), `admin/education/courses/page.tsx`,
`admin/education/teachers/page.tsx`, `admin/education/enrollments/page.tsx`. These all sit under
the existing `admin/layout.tsx` which already provides the isAdmin guard.

---

## Decisions

### D1. features/lms/ structure: four server-only files + presentational components

```
apps/web/src/features/lms/
  queries.ts        # 'server-only' — data loaders that call lmsService from backend.ts
  actions.ts        # NOT a module — server actions are defined inline in page.tsx files
                    # (matching the Phase-2.1 pattern: config.ts has loader functions but
                    # the action function is defined inside the page using 'use server')
  types.ts          # Local view interfaces for the lean column set (no @wtc/lms dependency)
  components/
    CoursePill.tsx          # StatusPill wrapper: published/draft tone
    LessonRow.tsx           # <tr> for lesson list (title, order, published badge, edit link)
    StudentProgressRow.tsx  # <tr> for student progress list (displayName, pct, lastSeen)
    StorageBadge.tsx        # Reusable storage mode pill + span (extracted from page repetition)
    LessonProgressBar.tsx   # Progress bar: completedLessons / totalLessons, green fill
    MaterialRow.tsx         # <tr> for materials list (label, kind, url/download CTA)
    PinnedLinkRow.tsx       # <tr> for pinned links list (label, url, kind pill, delete button)
```

`actions.ts` does NOT exist as a module. Server actions are inline `'use server'` functions inside
the page file that needs them — exactly as in `indicators/page.tsx` (submitTvAction) and
`teacher/page.tsx` (createCourseAction). This avoids the pattern where action files grow to contain
business logic; all logic stays in `lmsService` calls.

### D2. features/lms/queries.ts: server-only data loader pattern

Exact shape to implement, following `features/bots/config.ts`:

```typescript
import 'server-only';
import { lmsService, backendMode } from '@/lib/backend';

// Local view types (import from ./types.ts, defined there)
import type { CourseSummary, LessonSummary, StudentProgress, MaterialSummary } from './types.ts';

/** Storage mode for the storage badge on every page. Re-exported so pages don't import backend directly. */
export { backendMode } from '@/lib/backend';

/** Load all courses for the authenticated teacher. Returns [] in demo when lmsService is thin. */
export async function loadTeacherCourses(userId: string, isAdmin: boolean): Promise<{
  mode: 'postgres' | 'memory';
  courses: CourseSummary[];
}> { ... }

/** Load a single course for a teacher/admin. Returns null if not found or not owned. */
export async function loadCourseForEditor(userId: string, isAdmin: boolean, courseId: string): Promise<{
  mode: 'postgres' | 'memory';
  course: CourseSummary | null;
  lessons: LessonSummary[];
}> { ... }

/** Load lessons for a published course that the student is entitled to see. */
export async function loadCourseForStudent(userId: string, courseId: string): Promise<{
  mode: 'postgres' | 'memory';
  course: CourseSummary | null;
  lessons: LessonSummary[];
}> { ... }

/** Load a single lesson for a student. Returns null if not published or not enrolled. */
export async function loadLessonForStudent(userId: string, lessonId: string): Promise<{
  mode: 'postgres' | 'memory';
  lesson: LessonSummary | null;
}> { ... }

/** Load student progress for a teacher's courses. displayName + pct only; no userId, no email. */
export async function loadStudentProgress(userId: string, isAdmin: boolean): Promise<{
  mode: 'postgres' | 'memory';
  rows: StudentProgress[];
}> { ... }

/** Load published courses for the student catalogue. No entitlement required to list. */
export async function loadPublishedCourses(): Promise<{
  mode: 'postgres' | 'memory';
  courses: CourseSummary[];
}> { ... }
```

The `mode` field on every return maps to `backendMode === 'postgres' ? 'postgres' : 'memory'`
(matching the bots/config.ts pattern: `mode: 'postgres'` when DB, `mode: 'demo'` when null DB).
Pages destructure `{ mode, courses }` and render the StorageBadge with `mode`.

### D3. features/lms/types.ts: lean view interfaces (no @wtc/lms package dependency)

These map to the actual columns in the lean schema. Once `packages/lms` is refactored with the
full view types (education-implementer handoff), these local types are replaced by imports from
`@wtc/lms`.

```typescript
// features/lms/types.ts
export interface CourseSummary {
  id: string;
  ownerTeacherId: string;
  title: string;
  description: string | null;    // null renders as '—' via fmtDate pattern
  published: boolean;
  createdAt: number;             // epoch-ms
}

export interface LessonSummary {
  id: string;
  courseId: string;
  title: string;
  body: string | null;           // lesson body text (lean schema column)
  videoUrl: string | null;
  order: number;
  published: boolean;
}

export interface MaterialSummary {
  id: string;
  lessonId: string;
  label: string;
  url: string;
  kind: 'link' | 'file' | 'embed';
}

export interface StudentProgress {
  displayName: string;           // never userId or email
  enrolledAt: number;
  progressPct: number;           // 0-100
  completedLessons: number;
  totalLessons: number;
  lastSeenAt: number | null;     // null renders as '—'
}
```

### D4. Storage badge component: extract to avoid repetition across 10+ pages

```typescript
// features/lms/components/StorageBadge.tsx
// NOT 'server-only' — it is a pure presentational RSC (no data access)
import { StatusPill } from '@wtc/ui';

export function StorageBadge({ mode }: { mode: 'postgres' | 'memory' }) {
  if (mode === 'postgres') {
    return (
      <div className="wtc-row" style={{ marginTop: -4 }}>
        <StatusPill tone="ok">storage: Postgres</StatusPill>
      </div>
    );
  }
  return (
    <div className="wtc-row" style={{ marginTop: -4 }}>
      <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
      <span className="wtc-dim" style={{ fontSize: 12 }}>
        Dev fallback — LMS content resets on restart. Set DATABASE_URL to persist to Postgres.
      </span>
    </div>
  );
}
```

Placement rule: `<StorageBadge mode={mode} />` appears immediately after the `<SectionHeader>`
and before any Card or data grid — identical to the position in `indicators/page.tsx` lines 38-47.

### D5. RBAC patterns: teacherOrAdmin inline check vs admin-only layout

Teacher routes: the existing `teacher/layout.tsx` already guards with role redirect. Pages still
call `requireUser()` defensively (in case layout is bypassed via direct fetch). The pattern is:

```typescript
// Inside teacher route page.tsx — defensive even though layout guards
const user = await requireUser();
// layout handles redirect — this line is belt-and-suspenders only for server actions
if (!user.roles.includes('teacher') && !user.roles.includes('admin')) return <AccessDenied />;
```

Admin routes: `admin/layout.tsx` guards with `isAdmin(user)`. Pages trust the layout guard for
display but server actions inside those pages call `requireUser()` + check `user.roles.includes('admin')`
before any mutation — identical to how `bots/[bot]/settings/page.tsx` checks `access.allowed` in
the action before `persistBotConfig`.

### D6. Server action shape: exact pattern for every LMS mutation

Every LMS mutation follows this shape, matching `saveBotConfigAction` in bots/settings exactly:

```typescript
async function createLessonAction(formData: FormData): Promise<void> {
  'use server';
  const user = await requireUser();
  await assertCsrf(formData);
  // RBAC: teacher or admin only
  if (!user.roles.includes('teacher') && !user.roles.includes('admin')) return;
  const courseId = String(formData.get('courseId') ?? '');
  // Zod parse — fail-closed: invalid input = silent no-op (no 500 thrown to client)
  const parsed = CreateLessonSchema.safeParse({
    title: formData.get('title'),
    videoUrl: formData.get('videoUrl') || undefined,
    body: formData.get('body') || undefined,
    order: Number(formData.get('order') ?? 0),
    published: formData.get('published') === 'on',
  });
  if (!parsed.success) return;
  try {
    // Ownership enforced inside lmsService.createLesson (not in the page action)
    await lmsService.createLesson(
      { userId: user.id, isAdmin: user.roles.includes('admin') },
      courseId,
      parsed.data,
    );
  } catch {
    // OwnershipDenied / LmsNotFound — silently fail; no error message echoed to client
  }
  revalidatePath(`/teacher/courses/${courseId}`);
}
```

Key rules from the inspected patterns:
- `requireUser()` is always first, before assertCsrf, before any logic.
- `assertCsrf(formData)` is always second.
- `safeParse` not `parse` — never throw a Zod error to the client.
- Errors caught with empty catch — the page re-renders via revalidatePath showing current state.
- `revalidatePath` always uses the page's own path (not a sibling).

### D7. Zod schemas for forms: defined in features/lms/queries.ts, not in page files

The form Zod schemas (CreateLessonSchema, UpdateCourseSchema etc.) are defined in
`features/lms/queries.ts` as named exports so the action can import them without the action file
importing from a separate `schemas.ts`. This matches `features/bots/config.ts` which exports
`botConfigSchema` alongside the loader functions. The full Zod schemas are specified in the
education-implementer handoff `## Full LmsService contract` section and must be copied from there,
mapped to the lean column set (omit slug, tags, thumbnailUrl, level, sortOrder — use title,
description, videoUrl, body, order, published only for the Phase 2.2 lean implementation).

### D8. entitlement-wall pattern: RiskWarningBanner, not redirect, not 403 page

Student routes check `accessFor(user.id, 'education')`. On failure:

```typescript
if (!access.allowed) {
  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Education" title="Course" />
      <RiskWarningBanner
        severity="warning"
        title={`Access ${reasonLabel(access.reason)}`}
        detail="Education content is entitlement-gated. Activate the Education product in billing to unlock this course."
      />
    </div>
  );
}
```

This is exactly what `education/page.tsx` lines 10-17 does. Never redirect to /app/billing (the
education-implementer handoff D4 prohibits redirect loops). Never return a Next.js `notFound()` for
entitlement failures (that hides the reason — design system §1 "fail-visible" principle).

### D9. null renders as '—' using fmtDate/MetricValue — no raw null in JSX

Every nullable field rendered in tables or cards uses the existing utilities:
- Date fields: `fmtDate(row.createdAt)` — returns '—' on null/undefined.
- Numeric fields: `<MetricValue value={row.progressPct} suffix="%" />` — renders '—' on null.
- String fields: `{row.description ?? '—'}` — explicit fallback, never raw null.

This rule applies to ALL LMS pages. The `MetricValue` component is already exported from `@wtc/ui`.

---

## Route-by-route implementation specifications

### Teacher routes

#### /teacher (page.tsx — extend existing thin surface)

Current state: real server component with `createCourseAction` (thin 4-method interface).

Phase 2.2 additions:
- Add `<StorageBadge mode={backendMode === 'postgres' ? 'postgres' : 'memory'} />` after SectionHeader.
- Add a teacher profile summary Card (displayName, bio snippet, social links) loaded via
  `lmsService.getTeacherProfileByUserId(user.id)` — render null fields as '—'.
- Add stat MetricCards: total courses, total published lessons, enrolled students count.
  Use `<MetricValue>` for each count; show Skeleton shape (wtc-dim + '—') when lmsService is thin.
- Replace existing thin course list with link rows to `/teacher/courses/[id]`.
- Keep the existing `createCourseAction` and create-course Card; expand the form to include
  `description` textarea and `published` checkbox (already present in thin action — keep as-is).
- Add link to `/teacher/courses` (full course list), `/teacher/students`, `/teacher/materials`.

Server actions on this page: `createCourseAction` (unchanged signature; already has CsrfField).

#### /teacher/courses (page.tsx — replace Placeholder)

Loader: `loadTeacherCourses(user.id, isAdmin)` from `features/lms/queries.ts`.

Server component shape:
```
requireUser() → RBAC check → loadTeacherCourses → render
SectionHeader kicker="Teacher · courses" title="Your courses"
StorageBadge mode={mode}
[Link href="/teacher" ghost] ← Teacher overview
[Link href="/teacher/courses/new" primary] New course       ← links to new course page
Card title={`Courses (${courses.length})`}
  if empty: EmptyState title="No courses yet" hint="Create your first course from the overview."
  else: <table class="wtc-table">
    thead: Title | Status | Lessons | Created | Actions
    tbody: courses.map → CoursePill + fmtDate(createdAt) + Link to /teacher/courses/[id]
```

No server action on this page — it is a list view. All mutations happen on the detail page.

State coverage:
- loading: not applicable (RSC — data is awaited before render)
- empty: EmptyState component
- postgres: StorageBadge tone="ok"
- memory/demo: StorageBadge tone="warn"
- RBAC denied: layout.tsx redirects before render; page does not render a denied state

#### /teacher/courses/[id] (page.tsx — replace Placeholder, primary teacher work surface)

This is the most complex teacher page. It contains:
1. Course metadata display + edit-in-place form (title, description, published toggle)
2. Lesson list with reorder affordance (display-only order numbers; no drag-drop in Phase 2.2)
3. Add lesson inline form
4. Publish/unpublish toggle action
5. Link to student list for this course (if enrolled count > 0)

Loader: `loadCourseForEditor(user.id, isAdmin, params.id)` from `features/lms/queries.ts`.

Null guard: if `course === null` → `<EmptyState title="Course not found" />` with link back.

Server actions (all inline, all with CsrfField + assertCsrf + requireUser + RBAC):

```typescript
// updateCourseAction: title, description, published (formData)
// createLessonAction: title, body, videoUrl, order, published (formData + courseId hidden)
// publishCourseAction: courseId hidden field
// unpublishCourseAction: courseId hidden field
// deleteLessonAction: lessonId hidden field (only if no student progress — else show disabled state)
```

Server component skeleton:
```
requireUser() → RBAC → loadCourseForEditor
SectionHeader kicker="Teacher · course editor" title={course?.title ?? '—'}
StorageBadge mode={mode}
[if course null] EmptyState + link back
[else]
  Card title="Course details" action={CoursePill published/draft}
    form action={updateCourseAction}
      CsrfField
      input hidden name="courseId" value={course.id}
      label Title: wtc-input name="title" defaultValue={course.title}
      label Description: textarea name="description" defaultValue={course.description ?? ''}
      label: checkbox name="published" defaultChecked={course.published}
      button Save changes
    div.wtc-row
      form action={publishCourseAction} [if !published]
        CsrfField + input hidden courseId
        button primary: Publish course
      form action={unpublishCourseAction} [if published]
        CsrfField + input hidden courseId
        button ghost: Unpublish

  Card title={`Lessons (${lessons.length})`} action={Link /teacher/courses/[id]/lessons/new}
    if empty: EmptyState title="No lessons yet"
    else: table.wtc-table
      thead: # | Title | Video | Published | Actions
      tbody: lessons.sort(order).map → LessonRow (link to /teacher/courses/[id]/lessons/[lessonId])
      [each row has: form action={deleteLessonAction} with CsrfField + lessonId hidden + button danger]
```

State coverage:
- course not found: EmptyState
- no lessons: EmptyState with CTA
- published: CoursePill tone="ok", Unpublish button visible
- draft: CoursePill tone="warn", Publish button visible
- storage badge on all states

#### /teacher/courses/[id]/lessons/new (NEW page.tsx)

Loader: only needs the courseId from params to populate the hidden field.
Validation: title required, videoUrl optional (https only, validated Zod), body optional textarea,
order integer (default 0), published checkbox.

Server component shape:
```
requireUser() → RBAC
SectionHeader kicker="Teacher · new lesson" title="Add lesson"
StorageBadge mode={backendMode === 'postgres' ? 'postgres' : 'memory'}
Card title="Lesson details"
  form action={createLessonAction}
    CsrfField
    input hidden courseId
    input title (required)
    textarea body (optional)
    input videoUrl (optional, type url)
    input type=number order defaultValue=0
    checkbox published
    button primary: Add lesson
Link href="/teacher/courses/[id]" ghost: ← Back to course
```

On success: revalidatePath(`/teacher/courses/${courseId}`) and redirect back.
redirect() is called after revalidatePath inside the action — this requires `redirect` from
`next/navigation` imported inside the action (NOT inside the component). Pattern precedent:
teacher/page.tsx uses revalidatePath only (no redirect); indicators.tsx uses revalidatePath only.
For the "new" form, revalidatePath + no redirect is acceptable — the form re-renders empty and the
user sees the course page updated on next navigation.

#### /teacher/courses/[id]/lessons/[lessonId] (NEW page.tsx)

Loader: `loadCourseForEditor` for the course context + `lmsService.getLessonForTeacher(user.id, isAdmin, lessonId)` (once the full interface lands).

In the interim (Phase 2.2 with thin lmsService), the lesson is loaded by filtering the
`loadCourseForEditor` lesson list for `lesson.id === lessonId`.

Server component shape:
```
requireUser() → RBAC → loadCourseForEditor (filter lesson by lessonId)
[if lesson null] EmptyState + link back to course
[else]
SectionHeader kicker={`Lesson ${lesson.order}`} title={lesson.title}
StorageBadge mode={mode}
Card title="Edit lesson" action={CoursePill published/draft tone for lesson.published}
  form action={updateLessonAction}
    CsrfField
    input hidden lessonId + courseId
    input title defaultValue
    textarea body defaultValue
    input videoUrl defaultValue (type url)
    input type=number order defaultValue
    checkbox published defaultChecked
    button Save lesson
[if lesson.videoUrl] Card title="Video preview"
  <a href={lesson.videoUrl} target="_blank" rel="noreferrer noopener"
     class={buttonClasses('ghost')}>Open video ↗</a>
  [DESIGN SYSTEM §9.5: never embed external video without sanitization — link only in Phase 2.2]
Card title="Materials"  ← link/file materials (lean schema: label, url, kind)
  form action={addMaterialAction}
    CsrfField + hidden lessonId + courseId
    input label + input url + select kind (link|file|embed)
    button Add material
  [materials list: MaterialRow × n, each with delete form]
```

#### /teacher/materials (page.tsx — replace Placeholder with overview)

Loader: `loadTeacherCourses` to get all courses, then flatten materials from all lessons.
In Phase 2.2 with thin lmsService this is an EmptyState with a clear note: "Materials are managed
per-lesson. Navigate to a course lesson to add or remove materials." Link to /teacher/courses.

This avoids calling a method that doesn't exist on the thin interface yet.

#### /teacher/students (page.tsx — replace Placeholder)

Loader: `loadStudentProgress(user.id, isAdmin)`.

In thin-lmsService mode: returns `{ mode: 'memory', rows: [] }` (lmsService has no
`getCourseStudentList` yet). The page renders EmptyState with the demo label.

When full lmsService lands: renders a table with StudentProgressRow per student.

Server component shape:
```
requireUser() → RBAC → loadStudentProgress
SectionHeader kicker="Teacher · students" title="Enrolled students"
StorageBadge mode={mode}
Card title="Student progress"
  if rows.length === 0:
    EmptyState title="No enrolled students yet"
      hint="Students appear here once they enroll in a published course you own."
  else: table.wtc-table
    thead: Student | Course | Progress | Last active | Completed
    tbody: rows.map → StudentProgressRow
      displayName | progressPct% bar | fmtDate(lastSeenAt) | completedLessons/totalLessons
```

PRIVACY RULE enforced by query loader: `displayName` only, never email, never userId.

---

### Student routes

#### /app/education (page.tsx — extend existing thin surface)

Current state: real server component, storage badge lines 25-31, entitlement wall lines 10-17.

Phase 2.2 additions (minimal — keep the page working while lmsService is thin):
- Replace the inline lesson list per course with a `<CourseSummaryCard>` component (title,
  description, published badge) that links to `/app/education/[courseId]`.
- Add `<LessonProgressBar>` showing course-level progress (only once `getCourseProgress` exists;
  in thin mode: render '—' via MetricValue).
- Replace the Community static card with `lmsService.listPinnedLinks('global')` call (once the
  full interface lands); in thin mode keep the current static dim spans.

No storage badge change needed — the existing badge at lines 25-31 is already correct.

#### /app/education/[courseId] (NEW page.tsx)

RBAC/entitlement: requireUser → accessFor('education') → entitlement wall on failure.

Loader: `loadCourseForStudent(user.id, params.courseId)`.

Server component shape:
```
requireUser() → accessFor('education') → [if !allowed] RiskWarningBanner wall, return early
loadCourseForStudent → [if course null] EmptyState "Course not found" + link back
[else]
SectionHeader kicker="Education" title={course.title}
StorageBadge mode={mode}
[course.description && <p class="wtc-lead">{course.description}</p>]
Card title={`Lessons (${lessons.length})`}
  if lessons empty (or all unpublished):
    EmptyState title="No published lessons yet"
  else: ol.wtc-stack
    lessons.sort(order).map: LessonSummaryItem (link to /app/education/[courseId]/[lessonId])
      showing: order number + title + (completed checkmark or '—') + video badge if videoUrl
LessonProgressBar (enrolled count / total when available — '—' in thin mode)
[pinned links for this course — once listPinnedLinks('course', courseId) exists]
```

On first load of a published course: calls `lmsService.ensureEnrolled` (idempotent) inside the
server component render (not a form action — enrollment is automatic on viewing). This is the same
pattern as the existing thin `education/page.tsx` calling `listLessonsForStudent` with `true`.

The call site: `await lmsService.ensureEnrolled(user.id, course.id)` wraps in try/catch to handle
the case where the thin lmsService doesn't have this method yet — in thin mode, the call is silently
skipped and the page still renders the lesson list.

#### /app/education/[courseId]/[lessonId] (NEW page.tsx)

RBAC/entitlement: requireUser → accessFor('education') → wall on failure.

Loader: `loadLessonForStudent(user.id, params.lessonId)`.

State coverage:
- entitlement denied: RiskWarningBanner wall
- lesson not found / unpublished: EmptyState + link back
- no videoUrl: render body text only (wtc-lead paragraph with max-width 780px per DESIGN_SYSTEM §9.5)
- has videoUrl: render `<a href>Open video ↗</a>` link (NEVER embed without sanitizer in Phase 2.2)
- materials list: MaterialRow × n; empty → EmptyState "No materials for this lesson"
- Mark complete button: form action with CsrfField + hidden lessonId + courseId

Server component shape:
```
requireUser() → accessFor → wall
loadLessonForStudent → [null] EmptyState + link back
SectionHeader kicker={`Lesson ${lesson.order}`} title={lesson.title}
StorageBadge mode={mode}
[lesson.body && <p class="wtc-lead" style={{maxWidth:780, margin:'0 auto'}}>{lesson.body}</p>]
[lesson.videoUrl &&
  Card title="Video"
    <a href={lesson.videoUrl} target="_blank" class={buttonClasses('ghost')}>Watch video ↗</a>]
Card title="Materials"
  [materials empty] EmptyState title="No materials"
  [else] table.wtc-table MaterialRow × n (label, kind pill, url link)
Card title="Progress"
  form action={markCompleteAction}
    CsrfField
    input hidden lessonId + courseId
    button primary: Mark as complete
  [show completedAt if already completed: fmtDate(progress.completedAt ?? null)]
Link href="/app/education/[courseId]" ghost: ← Back to course
```

markCompleteAction: requireUser + assertCsrf + accessFor('education') + lmsService.markLessonComplete.
In thin mode: try/catch, silently fails, revalidatePath still called.

---

### Admin routes

#### /admin/education (page.tsx — replace Placeholder with overview)

RBAC: admin/layout.tsx guards. Page trusts the layout but server actions call `requireUser()` + check.

Phase 2.2 overview is intentionally lean: stat MetricCards + link cards to sub-sections.

Server component shape:
```
SectionHeader kicker="Admin · education" title="Education overview"
StorageBadge mode={backendMode === 'postgres' ? 'postgres' : 'memory'}
div.wtc-grid.wtc-grid-2
  MetricCard label="Published courses" value={<MetricValue value={courses.length} />}
  MetricCard label="Total enrollments" value={<MetricValue value={null} />}  ← '—' until full
  MetricCard label="Active teachers" value={<MetricValue value={null} />}
  MetricCard label="Completions today" value={<MetricValue value={null} />}
Card title="Course management"
  table.wtc-table (all courses, all states — using listPublishedCourses + future admin query)
  [Link to /admin/education/courses]
Card title="Quick actions"
  [Link to /admin/education/teachers] Manage teachers
  [Link to /admin/education/enrollments] Manual enrollments
  [Link to /admin/audit-log?filter=education] Recent LMS audit events
```

The audit link goes to the existing `/admin/audit-log` with a filter query param — not a new route —
because `recentAuditEvents` is already exposed there.

#### /admin/education/courses (NEW page.tsx)

Admin-only course list (all teachers, all states — published and draft).

Server component shape:
```
requireUser() → isAdmin check → redirect('/admin')
SectionHeader kicker="Admin · education" title="All courses"
StorageBadge mode={...}
Card title="Courses"
  table.wtc-table
    thead: Title | Teacher | Status | Lessons | Created | Actions
    tbody: courses.map → CoursePill + fmtDate + Link to /admin/education/courses/[id]
```

Server actions: `adminPublishCourseAction` (toggle published), `adminSetFeaturedAction` — both
require `user.roles.includes('admin')` inside the action. Admin has no ownership check (isAdmin
bypasses `assertTeacherOwns` in the service layer).

#### /admin/education/teachers (NEW page.tsx)

Thin in Phase 2.2 (no `listTeacherProfiles` on the thin lmsService): render EmptyState "Teacher
profile management available once migration 0002 lands." with a static note.

Once full lmsService lands: table of teacherProfiles + activate/deactivate toggle form.

#### /admin/education/enrollments (NEW page.tsx)

Manual enrollment form: adminId, userId (text input for now), courseId (select from published courses).

Server component shape:
```
requireUser() → isAdmin check
SectionHeader kicker="Admin · education" title="Manual enrollment"
StorageBadge mode={...}
RiskWarningBanner severity="info"
  title="Manual enrollment bypasses entitlement gate"
  detail="Only use for support cases. The enrollment will be source='manual_admin' in audit logs."
Card title="Enroll a user"
  form action={adminEnrollAction}
    CsrfField
    input userId (text — admin knows the UUID; no user search in Phase 2.2)
    select courseId (options from loadPublishedCourses)
    button primary: Enroll
```

adminEnrollAction: requireUser + assertCsrf + isAdmin check + AdminCreateEnrollmentSchema.safeParse +
lmsService.adminCreateEnrollment + revalidatePath.

---

## Existing components to reuse vs new

### Reuse from @wtc/ui (no changes needed)

| Component | Used where |
|---|---|
| `Card` | Every LMS page (all course/lesson/material panels) |
| `SectionHeader` | Every LMS page (kicker + title + copy) |
| `StatusPill` | Storage badge, published/draft pill, course status |
| `MetricCard` + `MetricValue` | Admin overview stats, teacher dashboard stat row |
| `RiskWarningBanner` | Entitlement wall (severity="warning"), info banners (severity="info") |
| `EmptyState` | Empty course list, empty lesson list, empty materials, empty students |
| `buttonClasses` | All form submit buttons, link buttons |

### New surface-local presentational components (features/lms/components/)

| Component | Props | Responsibility |
|---|---|---|
| `StorageBadge` | `{ mode: 'postgres' \| 'memory' }` | Storage mode pill + explanatory span |
| `CoursePill` | `{ published: boolean }` | StatusPill tone="ok"/"warn" + text "published"/"draft" |
| `LessonRow` | `{ lesson: LessonSummary; courseId: string; isEditor: boolean }` | Table row: order, title, video badge, published pill, edit link |
| `LessonProgressBar` | `{ completed: number; total: number }` | Progress fraction bar; renders '—' when total===0 |
| `StudentProgressRow` | `{ row: StudentProgress }` | Table row: displayName, pct bar, lastSeen, completed count |
| `MaterialRow` | `{ material: MaterialSummary; onDelete?: boolean }` | Table row: label, kind pill, url link, optional delete form |
| `PinnedLinkRow` | `{ link: PinnedLinkView; canDelete: boolean }` | Table row: label, iconType pill, url link, delete form |

All new components are presentational: typed props, no data fetching, no `lmsService` calls, no
`'server-only'` directive. They receive already-loaded data as props from the server page component.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| thin lmsService (4 methods) causes runtime errors when new pages call non-existent methods | P0 | Every new method call is wrapped in try/catch in Phase 2.2 pages; EmptyState fallback renders instead of crashing |
| deniedLmsService missing methods causes TypeScript compile failure when lms-types.ts is extended | P0 | The interface extension and deniedLmsService extension MUST be in the same diff; typecheck gate catches it |
| demo.ts lmsService missing methods causes TypeScript compile failure | P0 | Same rule: demo.ts and db-store.ts must be updated atomically with lms-types.ts |
| teacher/page.tsx uses getCurrentUser not requireUser — inconsistency creates auth bypass risk in actions | P1 | Replace with requireUser when Phase 2.2 fills this page; layout.tsx redirect is not sufficient for action security |
| videoUrl rendered as <video src> without sanitization = SSRF / XSS risk | P0 | Phase 2.2 renders video as `<a href>` link only — no embed; add this as a RiskWarningBanner severity="info" on the lesson view page |
| ensureEnrolled called in RSC render (not an action) — could fail silently in thin mode | P1 | Wrapped in try/catch; if it throws, the lesson list still renders; enrollment is eventually consistent |
| courseId/lessonId from URL params are unvalidated UUIDs — invalid UUIDs reach the service | P1 | Parse with `z.string().uuid().safeParse(params.courseId)` before any service call; on failure render EmptyState |
| admin enrollment form accepts raw userId string — typos create bad data | P2 | AdminCreateEnrollmentSchema validates UUID format; on parse failure action silently returns; add inline error display in Phase 2.3 |
| LessonProgressBar renders '0/0' if total is 0 — misleading | P1 | Guard: `total === 0` → render MetricValue value={null} (outputs '—') |
| StorageBadge rendered below a Card instead of above — violates §13.5 placement rule | P2 | Design rule enforced by code review: StorageBadge always immediately after SectionHeader |

---

## Verification/tests

The following must be verified before Phase 2.2 is marked complete:

1. **Typecheck gate passes** after any lms-types.ts extension: `pnpm typecheck -w @wtc/web` must
   report zero errors. The deniedLmsService and demo.ts adapter must implement every method.

2. **Storage badge appears on every LMS page** (not just education/page.tsx). Manually verify:
   `/teacher`, `/teacher/courses`, `/teacher/courses/[id]`, `/app/education/[courseId]`,
   `/app/education/[courseId]/[lessonId]`, `/admin/education`, `/admin/education/courses`.

3. **Entitlement wall works**: log in as a user with no 'education' entitlement, navigate to
   `/app/education/[courseId]` — must render RiskWarningBanner, not a 500 or blank page.

4. **Ownership enforced**: log in as teacher A, navigate to `/teacher/courses/[id-of-teacher-B-course]`
   — must render EmptyState "Course not found" (the service returns null for non-owned courses).

5. **CSRF check passes**: submit any LMS form (createLesson, updateCourse, markComplete) — action
   must complete without CSRF error. Remove the CsrfField from a test and verify the action silently
   no-ops (assertCsrf throws → caught by Next.js error boundary or caught in action).

6. **Null renders as '—'**: navigate to a lesson with no body, no videoUrl — must render '—' or
   skip the section entirely, not render `null` or `undefined` as DOM text.

7. **Demo mode labeled**: run without DATABASE_URL, navigate to any LMS page — storage badge with
   tone="warn" and "Dev fallback — LMS content resets on restart" must be visible above first Card.

8. **Admin-only routes gate correctly**: log in as a teacher (not admin), navigate to
   `/admin/education` — must redirect to `/app` (admin/layout.tsx guard).

These 8 checks map directly to the 5 mandatory tests in the education-implementer handoff plus the
3 UI-specific state checks (storage badge, entitlement wall, null rendering).

---

## Next actions

1. **Prerequisite (backend):** Extend `lms-types.ts` interface (at minimum: createLesson,
   updateCourse, publishCourse, unpublishCourse, ensureEnrolled, markLessonComplete,
   getCourseStudentList). Extend deniedLmsService, demo.ts, and db-store.ts atomically in the
   same diff. Run typecheck gate. This must happen BEFORE Phase 2.2 UI work.

2. **Create features/lms/ structure:** `types.ts` (lean view interfaces D3), `queries.ts`
   (data loader functions D2), `components/StorageBadge.tsx` (D4), `components/CoursePill.tsx`,
   `components/LessonRow.tsx`, `components/StudentProgressRow.tsx`, `components/MaterialRow.tsx`.

3. **Fill teacher routes in priority order:**
   - `/teacher/courses/[id]` (highest teacher value — lesson editor)
   - `/teacher/courses` (course list with links)
   - `/teacher/courses/[id]/lessons/new` (create lesson)
   - `/teacher/courses/[id]/lessons/[lessonId]` (edit lesson + materials)
   - `/teacher/students` (progress overview)
   - `/teacher/materials` (lean overview with link to per-lesson management)
   - `/teacher` (extend existing surface — lowest risk to existing real content)

4. **Fill student routes:**
   - `/app/education/[courseId]` (course detail + lesson list)
   - `/app/education/[courseId]/[lessonId]` (lesson view + mark complete)
   - `/app/education` (extend existing — add CourseCard links, progress bar)

5. **Fill admin routes:**
   - `/admin/education` (replace Placeholder with stats + links)
   - `/admin/education/courses` (all-courses table)
   - `/admin/education/enrollments` (manual enrollment form)
   - `/admin/education/teachers` (EmptyState pending migration 0002)

6. **Run gates in order:** `governance:check` → `lint` → `typecheck` → `typecheck -w @wtc/web` →
   `test` → `secret:scan` → `build -w @wtc/web`. Do NOT run `db:migrate` without a throwaway
   DATABASE_URL — migration 0002 is a separate phase. E2E after build.

7. **Stop condition (SESSION_PROTOCOL §8):** If the lms-types.ts extension (step 1) reveals that
   the demo.ts refactor exceeds scope (more than ~100 lines of new in-memory implementations),
   stop and write a handoff capturing exact state. Do not extend a single session past the
   lms-types + backend + features/lms structure steps. Teacher course detail page and student routes
   are separate commits.

8. **Phase 2.3 (future):** Add API routes `POST /api/education/progress` and
   `POST /api/education/progress/complete` for client-side progress tracking. Add `ProgressTracker`
   and `MarkCompleteButton` client islands. These are explicitly out of scope for Phase 2.2 (no
   client components in this phase — all interactions via server actions and form posts).
