# ecosystem-ux-ui-designer handoff

## Scope

Phase 2.2 — Full LMS UX. Epoch 20260530-1042. Read-only audit.

Produces the authoritative component-level LMS specification for the frontend implementer:
teacher dashboard, course editor, materials manager, student progress, student course grid,
course detail, lesson view, admin education surface, and pinned/community links. All surfaces
are constrained to the actual LEAN schema in `@wtc/lms` (`packages/lms/src/index.ts`) and the
thin async `LmsService` in `apps/web/src/lib/lms-types.ts`. No new fields are designed in.
No tags, thumbnails, level labels, embed widgets, or file-upload flows exist in the schema —
this spec never designs for them.

---

## Files inspected

- `AGENTS.md` — agent roster and non-negotiable gates
- `docs/SESSION_PROTOCOL.md` — governance process
- `docs/DESIGN_SYSTEM.md` — tokens, type scale, spacing, component inventory, state matrix, §13 amendments
- `docs/UX_SPEC_PHASE2.md` — Phase 2 surface specifications (§7 Education/LMS and all shared rules)
- `docs/handoffs/20260530-0925-ecosystem-ux-ui-designer.md` — prior Phase 2.1 handoff (component priority order, honesty label placements, component specs A.1–A.13)
- `packages/lms/src/index.ts` — canonical LEAN schema: Course, Lesson, Material, LessonProgress, LmsStore, LmsService
- `apps/web/src/lib/lms-types.ts` — async LmsService interface (thin Part-E model: createCourse, listCoursesForTeacher, listPublishedCourses, listLessonsForStudent)
- `apps/web/src/lib/backend.ts` — backend selector: `lmsService` (DB or in-memory), `backendMode`, `getServerDb()`
- `apps/web/src/lib/demo.ts` — in-memory adapter: seed data (one course, one lesson), lmsService wrapper, no progress/enrollment in thin model
- `apps/web/src/app/(app)/app/education/page.tsx` — Phase 1 student view (functional; no CourseCard, no progress, no lesson routing)
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` — Phase 2.1 settings page (reference for honesty label pattern: StorageModeBanner, RiskWarningBanner, StatusPill)
- `apps/web/src/app/(app)/app/support/page.tsx` — Phase 2.1 support page (reference for form pattern: CsrfField, select, textarea, wtc-table, StatusPill tones)
- `apps/web/src/app/teacher/page.tsx` — teacher dashboard (functional: createCourse form, course list; missing Edit links)
- `apps/web/src/app/teacher/courses/page.tsx` — Placeholder (no list, no edit links)
- `apps/web/src/app/teacher/courses/[id]/page.tsx` — Placeholder (no editor)
- `apps/web/src/app/teacher/students/page.tsx` — Placeholder
- `apps/web/src/app/teacher/materials/page.tsx` — Placeholder
- `apps/web/src/app/admin/education/page.tsx` — Placeholder
- `packages/ui/src/components.tsx` — actual @wtc/ui exports: Card, SectionHeader, StatusPill, MetricCard, MetricValue, RiskWarningBanner, EmptyState, ProductStatusCard, buttonClasses, cn, Tone
- `packages/ui/src/index.ts` — barrel: what is actually exported (no DataTable, no Drawer, no Toggle — those exist only in DESIGN_SYSTEM.md spec, not yet built)
- `apps/web/src/app/globals.css` — wtc-stack, wtc-spread, wtc-row, wtc-grid, wtc-mobile-nav

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### 1. LEAN schema hard boundaries (what DOES and DOES NOT exist)

The implementer must work within the following actual fields. Nothing outside this table may
appear in a form, table column, filter, or display label without a corresponding schema change
(that is out of scope for this phase).

| Entity | Available fields | NOT available (do not design for) |
|---|---|---|
| Course | `id`, `ownerTeacherId`, `title`, `description?`, `productCode` (`education`/`club`), `published`, `createdAt` | tags, level, thumbnail, cover image, duration, category, slug |
| Lesson | `id`, `courseId`, `title`, `body?`, `videoUrl?`, `order`, `published` | type badge (video/text/quiz), file attachment, embed, quiz payload, duration estimate |
| Material | `id`, `lessonId`, `label`, `url`, `kind` (`link`/`file`/`embed`) | file size, mime type, upload progress (no upload endpoint exists in LmsService) |
| LessonProgress | `userId`, `lessonId`, `completedAt` | percentComplete float (only a completedAt timestamp — progress % must be derived as `completedLessons / totalLessons`) |
| Actor | `userId`, `isAdmin` | role beyond teacher/admin, displayName (available from user session, not LmsStore) |

The thin `LmsService` interface (lms-types.ts) exposes only: `createCourse`, `listCoursesForTeacher`,
`listPublishedCourses`, `listLessonsForStudent`. It does NOT expose: `getCourse`, `updateCourse`,
`createLesson`, `updateLesson`, `deleteLesson`, `addMaterial`, `removeMaterial`, `markComplete`,
`listProgress`, `listAllCourses` (admin), `listEnrollments`.

Consequence: surfaces requiring those methods need the LmsService interface to be extended before
the frontend page can be built. The spec below calls out each such extension explicitly.

---

### 2. (HIGH) Student education page has no CourseCard, no progress derivation, no lesson routing

`apps/web/src/app/(app)/app/education/page.tsx` lines 38–49: renders a `<Card title={c.title}>`
with an `<ol>` of lesson titles. No progress bar, no "Continue lesson" CTA, no link to a lesson
page. The lesson page route `/app/education/[courseId]/lessons/[lessonId]` does not exist.

Progress derivation requires: count of published lessons for the course (available from
`listLessonsForStudent`) and count of completed lessons (requires `listProgress` — not yet in
LmsService interface). Until `listProgress` is added, progress must display as `0%` with an
honest label "progress tracking not yet active", never as a fabricated percentage.

---

### 3. (HIGH) Teacher dashboard course list has no Edit links

`apps/web/src/app/teacher/page.tsx` lines 48–57: each course row is a `wtc-spread` div with
title + StatusPill. No "Edit" or "Add lesson" link. A teacher cannot navigate to the course
editor from the dashboard. This is a broken flow: create works, edit is unreachable.

Fix is a single-line addition to each course row (an `<a href="/teacher/courses/{c.id}">Edit</a>`
button). Does not require a new component. Must ship before the course editor is useful.

---

### 4. (HIGH) Teacher course editor (`/teacher/courses/[id]`) is Placeholder with no LmsService backing

The editor requires server-side calls that do not exist in the current LmsService interface:
`getCourse(id)`, `updateCourse(actor, id, patch)`, `createLesson(actor, input)`,
`updateLesson(actor, id, patch)`, `deleteLesson(actor, id)`. The page cannot be built without
these methods being added to the interface and implemented in both adapters (in-memory + DB).

The materials section (add/remove link materials) requires `addMaterial(actor, input)` and
`removeMaterial(actor, id)`. Since there is no file-upload endpoint in LmsService, the
`FilePicker` component specified in the prior UX_SPEC_PHASE2.md §7.3 MUST be replaced with a
simple URL input + label pair. This is a schema constraint, not a phase decision — do not
fabricate upload progress UI for a capability that does not exist.

---

### 5. (HIGH) Admin education is Placeholder — no LmsService admin methods exist

`/admin/education` requires `listAllCourses()` (admin: all teachers) and optionally enrollment
counts. Neither exists in the current interface. The admin page cannot be built as a DataTable
until these are added. Interim: a card-based list using `listCoursesForTeacher` with
`actor.isAdmin = true` (which the in-memory adapter already handles via the `isAdmin` branch in
`listCoursesForTeacher`). This is available today and can power the admin overview without a
schema change.

---

### 6. (MEDIUM) Teacher students page is Placeholder — progress not queryable

`/teacher/students` requires a `listStudentProgress(actor, courseId)` method returning
`{ userId, displayName, completedLessons, totalLessons }`. This does not exist. When built,
the student progress table must show `displayName` only — never email. The `displayName` field
comes from the users table, not from LmsStore, so the query joins user records.

---

### 7. (MEDIUM) in-memory adapter has no markComplete, addMaterial, or updateCourse in thin LmsService

`packages/lms/src/index.ts` has `markComplete` and `updateCourse` on the class, but these are
not exposed in `apps/web/src/lib/lms-types.ts` (the async interface). The teacher editor and
student lesson completion both block on this gap. The LmsService interface must be extended in
lms-types.ts and both adapters (demo.ts and db-store.ts) updated before those surfaces ship.

---

### 8. (MEDIUM) StorageModeBanner is absent from all teacher pages

`/teacher` and `/teacher/courses/[id]` have no storage mode indicator. The pattern is
established in the settings page (StatusPill + wtc-dim note when `backendMode !== 'postgres'`)
and the student education page. Every teacher-facing and admin-facing LMS surface must show the
storage mode badge at the top, consistent with the settings page reference pattern.

---

### 9. (LOW) CommunityCard in student view uses `wtc-dim` spans — no honesty label for missing links

`apps/web/src/app/(app)/app/education/page.tsx` lines 51–57: community links rendered as
`<span className="wtc-dim" title="...">Telegram (soon)</span>`. The title attribute is
browser-only (no mobile access). The "not configured" state should be the text content
itself, not a tooltip, consistent with the null-to-dash rule: "Telegram — not configured"
in `--dim` with no action affordance. This does not require a schema change.

---

## Decisions

### D-1: LmsService interface extensions required before implementation

The following methods must be added to `apps/web/src/lib/lms-types.ts` and both adapters before
the corresponding surface can be built. The implementer (ecosystem-education-implementer) owns
these, not this handoff. This handoff specifies the UI that depends on them.

| Method | Used by | Returns |
|---|---|---|
| `getCourse(id)` | Teacher course editor (read), Admin education | `CourseView or null` |
| `updateCourse(actor, id, patch)` | Teacher course editor (save settings) | `CourseView` |
| `createLesson(actor, courseId, input)` | LessonEditorDrawer (create mode) | `LessonView` |
| `updateLesson(actor, id, patch)` | LessonEditorDrawer (edit mode) | `LessonView` |
| `deleteLesson(actor, id)` | LessonEditorDrawer (delete) | `void` |
| `listLessonsForEditor(actor, courseId)` | Teacher course editor (lesson list including drafts) | `LessonView[]` |
| `addMaterial(actor, lessonId, input)` | Materials section (add link) | `Material` |
| `removeMaterial(actor, materialId)` | Materials section (remove) | `void` |
| `listMaterials(lessonId)` | Lesson view (student), course editor | `Material[]` |
| `markComplete(userId, lessonId, hasAccess, now)` | Lesson view (progress toggle) | `void` |
| `listProgress(userId, courseId)` | Student course grid (progress %), lesson view (toggle state) | `LessonProgress[]` |
| `listAllCourses(actor)` | Admin education overview | `CourseView[]` |
| `getLessonForStudent(lessonId, userId, hasAccess)` | Lesson page (student) | `LessonView or null` |

---

### D-2: Progress percentage is derived, never stored as a float

Progress % = `completedLessons.length / publishedLessons.length * 100`. Both values come from
queries, not from a stored field. This is the only correct derivation against the LEAN schema.

If `listProgress` is not yet implemented, the progress bar renders at 0% with the note:
"Progress tracking — not yet active (in-memory dev mode)". Never fabricate a non-zero %.

If `publishedLessons.length === 0`, the progress bar is hidden entirely. The CTA becomes
"Coming soon" (disabled ghost). No `0 of 0 lessons` label.

---

### D-3: Material add = URL input only (no file upload)

The `FilePicker` component specified in UX_SPEC_PHASE2.md §7.3 (teacher materials section)
requires a server-side file-upload endpoint that does not exist. The `Material` schema has
`url: string` and `kind: 'link' | 'file' | 'embed'`. The teacher materials section therefore
uses a `TextInput url` + `TextInput label` + `Select kind` form row — the same pattern as any
link form. Kind `'file'` remains selectable but the URL must be a pre-hosted URL (the teacher
pastes a link). No upload progress bar. No drag-and-drop zone. This is not a limitation to
apologize for — it is the honest representation of what the system supports.

---

### D-4: Student progress table shows displayName only, never email

The teacher students page (`/teacher/students`) and the admin enrollment table
(`/admin/education`) must never display user email. The displayName from the users table is the
only identifier shown. If displayName is null or empty, show "User [id-prefix-8]" in `--dim`.
This is not a GDPR decision — it is a policy decision from the non-negotiable gates (no PII in
student views).

---

### D-5: Entitlement-locked state is honest, not a crash

When `access.allowed === false` on the student education page:
- Show `SectionHeader kicker="Education" title="Lessons & materials"`
- Show `RiskWarningBanner severity="warning"` with the access reason (using `reasonLabel()`)
- Show a single CTA `<a href="/app/billing" className={buttonClasses('primary')}>Activate Education</a>`
- Do NOT show any course titles, lesson counts, or progress data behind the gate
- Do NOT show an error component — this is not an error, it is an expected entitlement state

The current Phase 1 implementation already does this correctly. Phase 2.2 must preserve it
while adding the CourseCard composition when access IS granted.

---

### D-6: "storage: in-memory (dev)" badge appears on all LMS surfaces

Placement rule (matches settings page reference):

```
[SectionHeader]
[wtc-row: StatusPill tone="warn" "storage: in-memory (dev)" + wtc-dim note if !postgres]
[OR: StatusPill tone="ok" "storage: Postgres" if postgres]
... content below ...
```

This applies to: student education page, teacher dashboard, teacher course editor, admin
education page, and any new lesson page. The exact note text from the settings page is the
reference: "Demo mode — saves are not persisted. Set DATABASE_URL to store [content] in Postgres."
Adjust the word in brackets per surface (content / courses / progress).

---

### D-7: Component reuse vs new-build for Phase 2.2

| Surface | Reuse from @wtc/ui or existing pages | Build new (presentational, feature-scoped) |
|---|---|---|
| Student course grid | Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses | CourseCard (progress bar + CTA state), ProgressBar (inline component, not a separate file — embed in CourseCard) |
| Student lesson page | Card, SectionHeader, EmptyState, buttonClasses | LessonPage layout (route-specific Next.js page, not a packages/ui component), VideoEmbed (iframe wrapper with border-radius + --panel bg), MaterialsList (simple link list) |
| Teacher dashboard | Card, SectionHeader, StatusPill, EmptyState, buttonClasses, CsrfField — all already in use | Edit link added inline (not a new component), QuickAddLessonDrawer (Drawer not yet built — see below) |
| Teacher course editor | Card, SectionHeader, StatusPill, EmptyState, buttonClasses, CsrfField | TeacherCourseEditor (accordion composition), LessonEditorDrawer (requires Drawer — see below) |
| Materials section | Card, buttonClasses, CsrfField | MaterialAddForm (inline form row: url input + label input + kind select), MaterialsList (link rows with remove button) |
| Admin education | Card, SectionHeader, StatusPill, EmptyState, buttonClasses | AdminCoursesTable (raw wtc-table until DataTable component exists) |

The `Drawer` component is in DESIGN_SYSTEM.md §7.8 and listed in the Phase 2.1 handoff but
is NOT yet exported from `packages/ui/src/index.ts`. Until it is built, `LessonEditorDrawer`
must be implemented as a modal (dialog element) or as an inline expand section within the course
editor accordion. Do not fake a Drawer with a positioned div — use a native `<dialog>` element
with the correct CSS to match the panel2/blur/overlay elevation rules.

---

### D-8: Null rendering rules for all new LMS components

| Value | Null/missing treatment |
|---|---|
| `course.description` | `--dim` "No description" (not empty string, not omitted) |
| `lesson.body` | Empty state "No lesson content yet" (not a blank area) |
| `lesson.videoUrl` | Video embed section hidden entirely (not an empty iframe) |
| `material.label` | "Untitled material" in `--dim` |
| `progress` (not yet tracked) | Progress bar at 0% with note "Progress tracking — not yet active" |
| `completedAt` | `fmtDate(completedAt)` or "—" via MetricValue pattern |
| `lesson.order` | If order is 0 or missing, render "?" in the order column, never "0" |
| `course.createdAt` | `fmtDate(createdAt)` — 0 renders as "—" |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Implementer extends LmsService methods but does not audit mutations | High | High | Every mutation (createLesson, updateLesson, deleteLesson, addMaterial, removeMaterial, markComplete) must call `audit.write()` with `actorUserId`, `action`, `targetType`, `targetId`, `after`. The existing createCourse pattern in demo.ts is the canonical reference. |
| Teacher course editor bypasses ownerTeacherId check via direct POST | Medium | High | Every server action must re-check `getCourse(id).ownerTeacherId === actor.userId || actor.isAdmin` before any write. The route-level auth guard alone is insufficient. |
| Student progress % shows fabricated non-zero value if listProgress is not ready | High | Medium | D-2 is non-negotiable: if listProgress unavailable, progress = 0% with explicit note. Never derive from lesson count alone without completion data. |
| Admin enrollment table shows email column | Medium | Medium | D-4: displayName only. The admin enrollment table in UX_SPEC_PHASE2.md §7.4 lists "User email" — this spec overrides that with displayName. If email is needed for admin support workflows, it goes in a row-click Drawer visible only to admins, not in the table column. |
| LessonEditorDrawer implemented as a positioned div (fake Drawer) before Drawer component exists | Medium | Medium | Use native `<dialog>` with the styling rules from DESIGN_SYSTEM.md elevation §5 (Overlay: 0 34px 100px rgba(0,0,0,.55), blur(20px)). A positioned div is not focustrap-safe and breaks keyboard accessibility. |
| Materials URL input accepts arbitrary URLs — no validation | Medium | Low | Server action must validate that the URL is a valid http/https URL (new URL(input) check in server action). Reject data: URIs and javascript: URIs. Show inline error message. |
| VideoEmbed renders arbitrary videoUrl as an iframe src | Medium | Medium | Allowlist: only youtube.com, youtu.be, vimeo.com, loom.com hostnames are rendered as iframes. All other URLs render as a plain `<a>` link with the label "Video link (external)". Reject data: and javascript: schemes. |
| In-memory LmsService does not persist lesson progress across server restarts | Always | Low | StorageModeBanner already handles this. No additional treatment needed — the honest label is the mitigation. |

---

## Verification/tests

This is a design-only agent. No test execution.

The following test requirements apply to Phase 2.2 implementation:

1. `CourseCard status="not_started"`: progress bar width must be 0, CTA label must be "Start course".
2. `CourseCard status="in_progress"`: progress bar width must equal `(completedLessons/totalLessons)*100%`, CTA label must be "Continue lesson".
3. `CourseCard status="completed"`: progress bar width must be 100%, CTA label must be "Review course".
4. `CourseCard lessonCount=0`: progress bar must be hidden (not rendered), CTA must be "Coming soon" with `disabled` attribute.
5. Student education page with `access.allowed=false`: `RiskWarningBanner` must be present, no course title or lesson count must appear in the DOM.
6. Student education page with `backendMode='memory'`: `StatusPill` with text containing "in-memory" must appear above course content.
7. Teacher course editor server action: if `getCourse(id).ownerTeacherId !== actor.userId && !actor.isAdmin`, action must return without mutation (test via direct POST bypass simulation).
8. MaterialAddForm: URL input with value "javascript:alert(1)" must fail server-side validation and return an inline error. data: scheme URLs same.
9. VideoEmbed with a non-allowlisted URL (e.g., `https://example.com/video`) must render as `<a>` not `<iframe>`.
10. Admin education course list: no email address may appear in the rendered HTML of the table (selector test on rendered output).
11. Lesson progress derivation: `completedLessons=0, totalLessons=5` must render progress bar at 0% and note "Progress tracking — not yet active" when `backendMode='memory'`.

---

## Next actions

The following component specs are the authoritative implementation guide for Phase 2.2.
Each section gives: data loading shape, typed props, layout, state matrix, and honesty constraints.

---

### LMS-1: StudentCourseGrid (`/app/education/page.tsx`)

**Current state:** Functional but minimal. Cards have no progress, no "Continue" CTA, no lesson routing.

**Page data loading (extend existing):**

```ts
const user = await requireUser();
const access = await accessFor(user.id, 'education');
if (!access.allowed) { /* existing gate — unchanged */ }
const courses = await lmsService.listPublishedCourses();
const withData = await Promise.all(courses.map(async (c) => {
  const lessons = await lmsService.listLessonsForStudent(c.id, true);
  // listProgress requires LmsService extension — see D-1
  // Until extended: pass progress = [] and derive completedLessons = 0
  const progress = lmsService.listProgress
    ? await lmsService.listProgress(user.id, c.id)
    : [];
  const completedLessons = progress.filter((p) =>
    lessons.some((l) => l.id === p.lessonId)
  ).length;
  const nextLesson = lessons.find((l) =>
    !progress.some((p) => p.lessonId === l.id)
  );
  return { course: c, lessons, completedLessons, nextLessonId: nextLesson?.id };
}));
```

**CourseCard props:**

```ts
interface CourseCardProps {
  courseId: string;
  chapterLabel: string;      // "Chapter 01 of N" — derived from courses.indexOf(c) + 1
  title: string;
  description: string | undefined;
  totalLessons: number;
  completedLessons: number;
  nextLessonId: string | undefined;
  progressTracked: boolean;  // false when listProgress is not available
}
```

**CourseCard layout (file: `apps/web/src/features/lms/CourseCard.tsx`):**

```
┌──────────────────────────────────────────────────────────┐
│ CHAPTER 01 OF 3                         [enrolled]       │  <- kicker: 11px --gold2 uppercase
│                                                          │
│ Risk Management Fundamentals                             │  <- heading-xl 24px --text
│ Position sizing, drawdown control, journaling...         │  <- 14px --muted 2-line clamp
│                                                          │
│ [████████░░░░]  4 of 6 lessons complete  [note if !tracked] │  <- 4px bar, --green fill
│                                                          │
│ [Continue lesson]              [View all lessons →]      │
└──────────────────────────────────────────────────────────┘
```

- Card variant: `wtc-card` (elevated)
- Progress bar: `<div style="height:4px; border-radius:999px; background:var(--stroke)"><div style="width:{pct}%; background:var(--green)"></div></div>`
- When `!progressTracked`: bar renders at 0% + `<span className="wtc-dim" style={{fontSize:11}}>Progress tracking — not yet active</span>`
- "Continue lesson" href: `/app/education/{courseId}/lessons/{nextLessonId}` if nextLessonId, else `/app/education/{courseId}/lessons/{firstLessonId}`
- "View all lessons →" href: `/app/education/{courseId}` (course detail page — see LMS-2)

**State matrix:**

| State | Progress bar | CTA label | CTA state |
|---|---|---|---|
| `not_started` (completedLessons=0, totalLessons>0) | 0%, --stroke only | "Start course" | enabled, links to lesson 1 |
| `in_progress` (0 < completed < total) | X%, --green fill | "Continue lesson" | enabled, links to nextLessonId |
| `completed` (completed === total) | 100%, --green fill | "Review course" | enabled, links to lesson 1 |
| `empty` (totalLessons=0) | hidden | "Coming soon" | disabled ghost, no href |
| `!progressTracked` | 0%, --stroke, note below | "Start course" | enabled (lessons are accessible even without tracked progress) |

---

### LMS-2: CourseDetailPage (`/app/education/[courseId]/page.tsx`)

New route. Shows all published lessons for a course with completion checkmarks.

**Page data:**

```ts
const user = await requireUser();
const access = await accessFor(user.id, 'education');
if (!access.allowed) redirect('/app/education');
const course = await lmsService.getCourse(courseId);   // requires LmsService extension
if (!course || !course.published) notFound();
const lessons = await lmsService.listLessonsForStudent(courseId, true);
const progress = lmsService.listProgress
  ? await lmsService.listProgress(user.id, courseId)
  : [];
```

**Layout:**

```
[SectionHeader kicker="Education" title={course.title}]
[StorageModeBanner]
[p class wtc-muted: course.description or "No description"]
[Lesson list: ordered]
  Each item: [checkmark or circle] [lesson title] [→ link to lesson page]
[Bottom: CTA row "← Back to courses" ghost + "Continue" primary if nextLessonId]
```

Checkmark: `--green` filled circle (7px) when `progress.some(p => p.lessonId === l.id)`.
Uncompleted: `--stroke` circle outline (7px).
Locked lesson (not yet published, should not appear — server filters these): never rendered
because `listLessonsForStudent` already returns only `published: true` lessons.

**State matrix:**

| State | Lesson list | Navigation |
|---|---|---|
| `idle` | Rendered with completion circles | CTA row |
| `loading` | SkeletonText x N rows | hidden |
| `empty` (no published lessons) | EmptyState "No lessons published yet" | "← Back" only |
| `error` (getCourse fails) | ErrorState | "← Back" only |
| `disabled` (not entitled — redirect catches this) | N/A | N/A |

---

### LMS-3: LessonPage (`/app/education/[courseId]/lessons/[lessonId]/page.tsx`)

New route. Full reading layout per v3-editorial reference.

**Page data:**

```ts
const user = await requireUser();
const access = await accessFor(user.id, 'education');
if (!access.allowed) redirect('/app/education');
// getLessonForStudent: fail-closed — returns null if lesson is draft or course is draft
const lesson = await lmsService.getLessonForStudent(lessonId, user.id, true);
if (!lesson) notFound();
const materials = await lmsService.listMaterials(lesson.id);  // requires extension
const allLessons = await lmsService.listLessonsForStudent(lesson.courseId, true);
const lessonIndex = allLessons.findIndex((l) => l.id === lessonId);
const prevLesson = lessonIndex > 0 ? allLessons[lessonIndex - 1] : null;
const nextLesson = lessonIndex < allLessons.length - 1 ? allLessons[lessonIndex + 1] : null;
const progress = lmsService.listProgress
  ? await lmsService.listProgress(user.id, lesson.courseId)
  : [];
const isCompleted = progress.some((p) => p.lessonId === lessonId);
```

**Layout (max-width 780px, margin 0 auto, padding 0 24px):**

```
[breadcrumb: <a href="/app/education">Education</a> / <a href="/app/education/{courseId}">{courseTitle}</a> / Lesson {N}]
  — 13px --dim, no decoration on links (color: var(--muted))
[h1: lesson.title — display-md 28–48px clamp, font-weight 700]
[StorageModeBanner if !postgres]
[VideoEmbed if lesson.videoUrl — full-width, 16:9 aspect, border-radius var(--radius), --panel bg]
[lesson body: if lesson.body — rendered as <div className="lesson-body">{lesson.body}</div>]
  [if !lesson.body: EmptyState title="No lesson content yet"]
[MaterialsCard if materials.length > 0]
[Progress toggle row]
[Navigation row]
```

**VideoEmbed allowlist rule (Decision section Risk row):**
Hostnames allowed as `<iframe src>`: youtube.com, youtu.be, vimeo.com, loom.com.
All other valid URLs: `<a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="wtc-link">Video link (external)</a>`.
data: and javascript: URLs: rejected server-side before the page renders (treat as no videoUrl).

**MaterialsCard layout:**

```
[Card title="Materials"]
  [wtc-stack]
    each material:
    [wtc-spread]
      [left: material.label (14px --text)]
      [right: material.kind badge (11px --dim uppercase) + <a href={material.url} ...>Open →</a>]
```

Material kind badge: "link" / "file" / "embed" in --dim text, no color accent.
If `material.label` is empty: "Untitled material" in --dim.
`href` target: `_blank` with `rel="noopener noreferrer"`.

**Progress toggle row:**

```
[wtc-spread]
  [left: <label> checkbox "Mark as complete" + note if !progressTracked]
  [right: "Completed {fmtDate(completedAt)}" in --green 13px OR nothing]
```

The toggle is a form with a server action (`markCompleteAction`). If `!progressTracked` (listProgress
unavailable): render the checkbox as `disabled` with note "Progress tracking — not yet active".
Never show the checkbox as enabled if the server action would throw.

**Navigation row:**

```
[wtc-row justified]
  [<a href={prevLesson ? "/app/education/{courseId}/lessons/{prevLesson.id}" : "#"} 
     className={buttonClasses('ghost')} 
     aria-disabled={!prevLesson}>← Previous</a>]
  [<a href="/app/education/{courseId}" className={buttonClasses('ghost')}>All lessons</a>]
  [<a href={nextLesson ? "/app/education/{courseId}/lessons/{nextLesson.id}" : "#"} 
     className={buttonClasses(nextLesson ? 'primary' : 'ghost')}
     aria-disabled={!nextLesson}>Next →</a>]
```

**State matrix:**

| State | Video | Body | Materials | Toggle |
|---|---|---|---|---|
| `idle` | Renders per allowlist | Rendered | Link rows | Enabled (if progressTracked) or disabled |
| `loading` | Skeleton 16:9 rect (--panel bg, shimmer) | SkeletonText x5 | SkeletonText x2 | Disabled |
| `error` (lesson not found / 404) | — | ErrorState spanning full content area | — | — |
| `empty` (body=null, videoUrl=null, materials=[]) | hidden | EmptyState "No content yet" | hidden | Disabled |
| `!progressTracked` | Renders | Renders | Renders | disabled + note |

---

### LMS-4: TeacherDashboard (`/teacher/page.tsx`) — extend existing

**Required change: add Edit links to course list (single-file change, no new component).**

In the `myCourses.map` block, add:

```tsx
<div className="wtc-row" style={{ gap: 8, marginTop: 6 }}>
  <a href={`/teacher/courses/${c.id}`} className={buttonClasses('ghost')} style={{ fontSize: 13, padding: '5px 12px' }}>
    Edit
  </a>
  <a href={`/teacher/courses/${c.id}#lessons`} className={buttonClasses('ghost')} style={{ fontSize: 13, padding: '5px 12px' }}>
    Add lesson
  </a>
</div>
```

**StorageModeBanner (add below SectionHeader, before the grid):**

```tsx
<div className="wtc-row" style={{ marginBottom: 8 }}>
  {backendMode === 'postgres'
    ? <StatusPill tone="ok">storage: Postgres</StatusPill>
    : <>
        <StatusPill tone="warn">storage: in-memory (dev)</StatusPill>
        <span className="wtc-dim" style={{ fontSize: 12 }}>
          Demo mode — courses reset on restart. Set DATABASE_URL to persist to Postgres.
        </span>
      </>
  }
</div>
```

**CreateCourseCard state matrix:**

| State | Form | Submit button |
|---|---|---|
| `idle` | Empty fields, title required | "Create course" primary |
| `loading` (submit in progress) | All fields disabled | "Creating..." with pointer-events none |
| `success` | Form clears, course appears in list below | Toast "Course created" (if Toast component available, else page revalidate) |
| `error` (title too short / server error) | Fields preserved | Inline error below title field |

Title validation: minimum 3 characters, maximum 120. Enforced in the server action via
`botConfigSchema`-equivalent pattern (zod `z.string().min(3).max(120)`). Return early on failure
— the current createCourseAction has no validation; this must be added.

---

### LMS-5: TeacherCourseEditor (`/teacher/courses/[id]/page.tsx` + feature component)

This page is currently a Placeholder. Full replacement required.

**Page data (requires LmsService extensions from D-1):**

```ts
const user = await getCurrentUser();
if (!user) redirect('/login');
if (!user.roles.includes('teacher') && !user.roles.includes('admin')) redirect('/app');
const course = await lmsService.getCourse(params.id);
if (!course) notFound();
// Ownership check — must happen server-side, not just in layout
if (course.ownerTeacherId !== user.id && !user.roles.includes('admin')) redirect('/teacher');
const lessons = await lmsService.listLessonsForEditor(
  { userId: user.id, isAdmin: user.roles.includes('admin') },
  course.id
);
const materials = await lmsService.listMaterials(course.id);  // returns [] until extension ships
```

**Page layout:**

```
[main.wtc-container]
  [wtc-spread]
    [SectionHeader kicker="Teacher · course editor" title={course.title}]
    [StatusPill tone={course.published ? 'ok' : 'warn'}]{course.published ? 'published' : 'draft'}[/StatusPill]
  [/wtc-spread]
  [wtc-row: StorageModeBanner]
  [a href="/teacher" ghost "← Back to teacher console"]

  [TeacherCourseEditor component — see below]
```

**TeacherCourseEditor (file: `apps/web/src/features/lms/TeacherCourseEditor.tsx`):**

Accordion-per-section. Uses native accordion (`<details>`/`<summary>`) styled per design tokens
until the `Accordion` component from packages/ui is built.

Accordion section 1: "Course settings" (open by default)

```
[TextInput: course.title, name="title", required, min 3, max 120]
[Textarea: course.description, name="description", rows=4, placeholder="Course description"]
[label + checkbox: "Published", name="published", defaultChecked={course.published}]
[if user.roles.includes('admin'): TextInput teacher ID (disabled, display-only) — label: "Teacher: {course.ownerTeacherId}"]
[Button variant="primary" type="submit" "Save settings"]
[Note: "Saving updates this course only — does not affect enrolled student access immediately."]
```

Form action: `updateCourseSettingsAction` (server action) — validates + calls `lmsService.updateCourse()`.
RBAC: re-checks ownership inside the action (not just in the page guard).

Accordion section 2: "Lessons" (open by default, id="lessons" for anchor linking)

```
[lesson list — wtc-stack]
  each lesson:
  [wtc-spread]
    [left: wtc-row: lesson.order label (--dim 11px "N.") + lesson.title (14px bold)]
    [right: wtc-row:
      [StatusPill tone={lesson.published ? 'ok' : 'warn'}]
      [button "Edit" → opens LessonEditorDialog in edit mode]
      [button "Delete" variant="danger" size="sm" → opens confirm dialog]
    ]
[Button variant="ghost" "Add lesson" → opens LessonEditorDialog in create mode]
```

Lesson order display: `lesson.order` from schema. If reorder arrows are implemented, up/down
buttons call `updateLesson(actor, id, { order: newOrder })`. Phase 2.2 spec: render order
as label only; reorder deferred to later phase.

Accordion section 3: "Materials (links)"

```
[materials list — wtc-stack]
  each material:
  [wtc-spread]
    [left: material.label (14px) + --dim 11px material.kind badge]
    [right: <a href={material.url} target="_blank" class="wtc-link">Open</a> + button "Remove" variant="danger" size="sm"]
[AddMaterialForm — inline, not a drawer]
  [wtc-row]
    [TextInput label, name="label", placeholder="Material title", style maxWidth 200]
    [TextInput url, name="url", placeholder="https://...", style flex 1]
    [Select kind: link / file / embed, style maxWidth 120]
    [Button primary "Add" type="submit"]
  [validation note: "URL must be https://... — no file uploads in this phase"]
```

Add material form action: `addMaterialAction` — validates URL (https only, no data:/javascript:),
calls `lmsService.addMaterial()`.

**LessonEditorDialog (replaces LessonEditorDrawer until Drawer component exists):**

Uses native `<dialog>` element. CSS matches Overlay elevation: `box-shadow: 0 34px 100px rgba(0,0,0,.55)`, `backdrop-filter: blur(20px)`, `background: var(--panel2)`, `border: 1px solid var(--stroke)`, `border-radius: var(--radius-lg)`, `max-width: 640px`, `width: 100%`.

```
[dialog]
  [header wtc-spread]
    [h3: "Edit lesson" or "Add lesson"]
    [button type="button" aria-label="Close" onclick="dialog.close()"]
  [form wtc-stack]
    [TextInput title, required]
    [Textarea body, rows=6, placeholder="Lesson content (plain text or Markdown)"]
    [TextInput videoUrl, placeholder="https://youtube.com/... (optional)"]
    [label + checkbox: "Published"]
    [wtc-row justify-between]
      [Button danger type="button" "Delete lesson" — only in edit mode → opens inline confirm]
      [wtc-row]
        [Button ghost type="button" "Cancel" onclick="dialog.close()"]
        [Button primary type="submit" "Save lesson"]
  [DevPlaceholderBanner equivalent if in-memory: note "Changes reset on restart"]
```

Dialog server actions: `createLessonAction` / `updateLessonAction` / `deleteLessonAction`.
All re-check ownership. Delete shows an inline confirm span before the action fires.

**State matrix for TeacherCourseEditor:**

| State | Course settings | Lesson list | Materials |
|---|---|---|---|
| `idle` | Form with current values | Lesson rows | Material rows + add form |
| `loading` (save settings) | All fields disabled | Unchanged | Unchanged |
| `success` (save) | StatusPill flashes green briefly (revalidatePath) | Unchanged | Unchanged |
| `error` (save fails) | Inline error below the field that failed | Unchanged | Unchanged |
| `loading` (add/edit lesson) | Unchanged | Disabled row buttons | Unchanged |
| `success` (add lesson) | Unchanged | New row appears | Unchanged |
| `error` (lesson save) | Unchanged | ErrorState inside dialog | Unchanged |
| `empty` (no lessons) | Unchanged | EmptyState "No lessons yet" + Add button | Unchanged |
| `empty` (no materials) | Unchanged | Unchanged | EmptyState "No materials yet" + add form |

---

### LMS-6: TeacherStudentsPage (`/teacher/students/page.tsx`)

Currently Placeholder. Requires `listStudentProgress` LmsService extension.

**Page data (requires extension):**

```ts
const user = await getCurrentUser();
if (!user || (!user.roles.includes('teacher') && !user.roles.includes('admin'))) redirect('/app');
const myCourses = await lmsService.listCoursesForTeacher({ userId: user.id, isAdmin: user.roles.includes('admin') });
// listStudentProgress: returns [{courseId, userId, displayName, completedLessons, totalLessons}]
// Not available until LmsService is extended — render honest empty state if unavailable
const progress = lmsService.listStudentProgress
  ? await lmsService.listStudentProgress({ userId: user.id, isAdmin: user.roles.includes('admin') })
  : null;
```

**Layout:**

```
[SectionHeader kicker="Teacher console" title="Student progress"]
[StorageModeBanner]
[course Select filter — filters table to selected course]
[Progress table or EmptyState]
[Back to teacher console ghost button]
```

**Progress table columns (never email):**

| Column | Priority | Notes |
|---|---|---|
| Student | 1 | `displayName` — if null: "User [id prefix 8]" in --dim |
| Course | 1 | course title |
| Completed | 1 | `{completedLessons} of {totalLessons} lessons` |
| Progress | 2 | inline mini progress bar (same 4px bar as CourseCard) |
| Last activity | 3 | `fmtDate(latestCompletedAt)` or "—" |

If `listStudentProgress` is not available:

```tsx
<EmptyState
  title="Progress data not available"
  hint="Student progress tracking requires the full LmsService extension (Phase 2.2+). In-memory mode shows no progress data."
/>
```

This is the honest state — do not fabricate rows.

**State matrix:**

| State | Table | Filter |
|---|---|---|
| `idle` | Rows per enrolled student | Enabled |
| `loading` | SkeletonTable 3 rows | Disabled |
| `empty` (no enrollments) | EmptyState "No students enrolled yet" | Disabled |
| `extension_missing` | EmptyState with extension note | Disabled |
| `error` | ErrorState | Disabled |

---

### LMS-7: AdminEducationPage (`/admin/education/page.tsx`)

Currently Placeholder. Interim implementation available today using existing LmsService.

**Page data (uses existing LmsService — no extension required for the overview):**

```ts
// Auth: requireAdmin() or equivalent
const user = await getCurrentUser();
if (!user || !user.roles.includes('admin')) redirect('/app');
// listCoursesForTeacher with isAdmin=true returns ALL courses across all teachers
const allCourses = await lmsService.listCoursesForTeacher({ userId: user.id, isAdmin: true });
// Enrollment data requires listAllEnrollments — defer to when extension ships
```

**Layout:**

```
[SectionHeader kicker="Admin · Education" title="Education moderation"]
[StorageModeBanner]
[Card title="All courses ({N})"]
  [course table or EmptyState]
[Card title="Enrollments" — EmptyState "Enrollment data available after LmsService extension"]
```

**Course table columns:**

| Column | Priority | Notes |
|---|---|---|
| Title | 1 | |
| Teacher | 1 | `ownerTeacherId` (8-char prefix in --dim) until user lookup added |
| Published | 1 | StatusPill ok/warn |
| Lesson count | 2 | Count derived at query time (requires `listLessonsForEditor`) or shows "—" |
| Created | 2 | `fmtDate(createdAt)` |
| Actions | 1 | "View" → `/teacher/courses/{id}` + "Toggle publish" (calls updateCourse) |

Toggle publish server action: `adminTogglePublishAction` — no ownership check required for admin,
but still audits `audit.write()`.

**Enrollment table:** Renders `EmptyState title="Enrollment data not yet available" hint="Full enrollment tracking ships with the LmsService extension."` until `listAllEnrollments` is added.
The empty state is honest — it does not say "coming soon" (that implies external dependency).
It says "not yet available" (an internal implementation gap).

**State matrix:**

| State | Courses table | Enrollments card |
|---|---|---|
| `idle` | Rows | EmptyState with extension note |
| `loading` | SkeletonTable 3 rows | EmptyState (no skeleton) |
| `empty` (no courses) | EmptyState "No courses yet" | Same |
| `error` | ErrorState | Same |

---

### LMS-8: CommunityCard (`/app/education/page.tsx` — inline)

Current implementation: `<span className="wtc-dim" title="...">Telegram (soon)</span>`.

Replacement (no new component file — inline in the education page):

```tsx
<Card title="Community">
  <div className="wtc-stack" style={{ gap: 8 }}>
    <div className="wtc-spread">
      <span style={{ fontSize: 14 }}>Telegram</span>
      <span className="wtc-dim" style={{ fontSize: 13 }}>Not configured</span>
    </div>
    <div className="wtc-spread">
      <span style={{ fontSize: 14 }}>Instagram</span>
      <span className="wtc-dim" style={{ fontSize: 13 }}>Not configured</span>
    </div>
    <div className="wtc-spread">
      <span style={{ fontSize: 14 }}>Private Club</span>
      <a href="/products/club" className="wtc-link" style={{ fontSize: 13 }}>
        Learn more →
      </a>
    </div>
  </div>
</Card>
```

When community links are configured (via admin-set env vars or DB config): replace the
"Not configured" span with `<a href={link} target="_blank" rel="noopener noreferrer" className="wtc-link">Join</a>`.
The implementation reads from an optional env var or admin config table — that is a backend
concern. The UX rule is: if the link is absent, show "Not configured" in --dim, never hide
the row entirely (fail-visible).

---

### LMS-9: Pinned teacher/course links (community links in LmsStore)

The `@wtc/lms` schema has `Material.kind: 'link' | 'file' | 'embed'`. There is no separate
"pinned links" table. Pinned community links per course are a subset of `materials` where
`kind === 'link'`. They render in the `MaterialsCard` on the lesson page (LMS-3) and optionally
in the course detail page (LMS-2) as a sidebar section.

No new schema field is needed. The implementer does not add a `pinned: boolean` field to
Material without a schema change reviewed by the db-architect. In Phase 2.2, "pinned links"
= all materials with `kind === 'link'` for the top-level course (not lesson-scoped), if
`lmsService.listMaterials(courseId)` is called at the course level rather than lesson level.

This is a backend-level query decision, not a UI decision. The UI renders whatever the query
returns. If the course-level materials query does not exist in Phase 2.2, the "pinned links"
section is omitted from the course detail page with a note in the code: `// pinned links: requires course-level material query`.

---

### State Matrix: honesty-label placement (mandatory, per DESIGN_SYSTEM.md §13.5)

| Label | Mandatory placement | Trigger |
|---|---|---|
| "storage: in-memory (dev) — resets on restart" | StatusPill immediately below SectionHeader on every LMS page | `backendMode !== 'postgres'` |
| "Progress tracking — not yet active" | Inline below progress bar in CourseCard; below Toggle in lesson page | `listProgress` not in LmsService |
| "Progress data not available" | EmptyState in teacher students table | `listStudentProgress` not in LmsService |
| "Enrollment data not yet available" | EmptyState in admin enrollments card | `listAllEnrollments` not in LmsService |
| "No file uploads in this phase" | Validation note below material URL input | always in Phase 2.2 |
| "Saving updates this course only — does not affect enrolled student access immediately" | Note below save button in course settings | always |
| "Changes reset on restart" | Note inside LessonEditorDialog when backendMode=memory | `backendMode !== 'postgres'` |
| null description → "No description" | wtc-dim span in CourseCard | `course.description == null` |
| null body → EmptyState "No lesson content yet" | inside lesson page body section | `lesson.body == null` |
| Video URL not on allowlist → "Video link (external)" as anchor | replaces iframe | non-allowlisted URL |

---

## Next actions

**Ordering for the frontend implementer (Phase 2.2):**

1. Extend `LmsService` interface and both adapters: `getCourse`, `updateCourse`, `createLesson`,
   `updateLesson`, `deleteLesson`, `listLessonsForEditor`, `addMaterial`, `removeMaterial`,
   `listMaterials`, `markComplete`, `listProgress`. (Owned by ecosystem-education-implementer.)

2. Add Edit links to `/teacher/page.tsx` course list rows. Single-file change, unblocked today.

3. Add StorageModeBanner to `/teacher/page.tsx`. Single-file change, unblocked today.

4. Replace `/teacher/courses/[id]/page.tsx` Placeholder with `TeacherCourseEditor` (LMS-5).
   Depends on step 1 (getCourse, listLessonsForEditor, updateCourse, createLesson, etc.).

5. Replace `/teacher/students/page.tsx` Placeholder with progress table (LMS-6).
   Depends on step 1 (listStudentProgress).

6. Extend student `/app/education/page.tsx` with CourseCard composition and progress bars (LMS-1).
   Partially unblocked (lessonCount available; progressTracked=false path renders honest 0%).

7. Create `/app/education/[courseId]/page.tsx` course detail route (LMS-2).
   Depends on step 1 (getCourse).

8. Create `/app/education/[courseId]/lessons/[lessonId]/page.tsx` lesson page (LMS-3).
   Depends on step 1 (getLessonForStudent, listMaterials, markComplete, listProgress).

9. Replace `/admin/education/page.tsx` Placeholder with AdminCoursesTable (LMS-7).
   Partially unblocked today (listCoursesForTeacher with isAdmin=true already works).

10. Fix CommunityCard null-state rendering in student education page (LMS-8). Unblocked today.
