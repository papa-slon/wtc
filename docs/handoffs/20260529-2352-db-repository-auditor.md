# db-repository-auditor handoff — 20260529-2352

## Scope
Phase 1.7 / Part E prep. READ-ONLY inventory of `packages/db` for the TradingView and Education (LMS)
bounded contexts. Goal: (1) confirm exact exported function names, parameters, and return row types for
the TradingView repos and whether each writes an audit row in the same transaction (vs the
`grantProduct`/`revokeProduct` pattern); confirm the `tradingview_access_{requests,tasks}` tables and the
`requestedAt -> created_at` column mapping; confirm whether `listPendingTvTasks`/`markTvTaskDone` exist.
(2) Inventory which education tables exist in `schema.ts` and whether ANY education repos exist. (3)
Specify the exact TypeScript signatures of the repo functions to ADD for Part B (DB-wire the existing TV
web UI) and Part C Option 1 (DB-wire the LMS web UI), following the existing transaction+audit pattern.
Target Parts: B, C, D. Verified each prior `20260529-1921-integration-risk-auditor` claim against the live
files rather than trusting it. No automation, no live servers, no secrets.

## Files inspected
- `packages/db/src/schema.ts` (243 lines) — read in full. TV tables L148-165; education tables L168-194;
  `auditLogs` L197-215; `jobQueue` RESERVED L217-234.
- `packages/db/src/repositories.ts` (279 lines) — read in full. `grantProduct`/`revokeProduct`
  txn+audit pattern L127-155; `auditRowValues` L193-210; `createDbAuditWriter` L212-218; TV repos
  L224-258; worker jobs L260-278.
- `packages/db/src/index.ts` (6 lines) — re-exports `* from './repositories.ts'` (L5); so every repo fn
  is exported from `@wtc/db`.
- `packages/db/src/client.ts` (11 lines) — `Db = ReturnType<typeof createDb>`, postgres-js driver.
- `packages/db/src/seed.ts` (54 lines) — seeds one course (L50); imports only
  `users,roles,userRoles,products,plans,entitlements,courses` (L9) — no lessons/materials seeded.
- `packages/db/migrations/0000_broken_jack_murdock.sql` L155-178 — `tradingview_access_requests` and
  `tradingview_access_tasks` DDL; confirms physical column name.
- `packages/tradingview-access/src/index.ts` (107 lines) — in-memory `TvAccessService` +
  `TvAccessRequest`/`TvAccessTask` interfaces (the types the web UI renders today).
- `packages/lms/src/index.ts` (107 lines) — in-memory `LmsService` + `Course`/`Lesson`/`Material`/
  `LessonProgress` interfaces and method signatures to mirror.
- `packages/audit/src/audit.ts` (109 lines) + `index.ts` — `AuditInput`, `buildEvent`, `AUDIT_ACTIONS`
  (incl. `tradingview.grant`/`tradingview.revoke`/`education.material_change`).
- `apps/web/src/lib/backend.ts` (78 lines) — TV/LMS hardwired to in-memory (L48-51).
- `apps/web/src/lib/db-store.ts` (108 lines) — DB-backed core accessors; no TV/LMS bindings.
- `apps/web/src/app/(app)/app/indicators/page.tsx` (77 lines) — user TV view + submit (`tvStore.list()`
  filtered by user L32; `tvService.submitRequest` L18; renders `r.requestedAt` L58).
- `apps/web/src/app/admin/tradingview-access/page.tsx` (68 lines) — admin queue (`tvStore.list()` L33;
  `tvService.grant`/`revoke` L16/L24).
- `apps/web/src/app/teacher/page.tsx` (61 lines) — `lmsService.createCourse` L14; `lmsStore.courses` L27.
- `apps/web/src/app/(app)/app/education/page.tsx` (56 lines) — `lmsStore.courses` L19;
  `lmsService.listLessonsForStudent` L32.

## Files changed
None — read-only audit

## Findings

### 1. [INFO] (B) Exact TradingView repo surface — names, params, RETURN types confirmed
Verified in `packages/db/src/repositories.ts`. The six functions exist with these exact signatures
(all exported via `@wtc/db`):

| Repo fn | Signature (verified file:line) | Returns |
| --- | --- | --- |
| `submitTvRequest` | `(db: Db, userId: string, username: string, now = Date.now()) => Promise<TvRequest>` — repositories.ts:228 | the inserted row |
| `listTvByUser` | `(db: Db, userId: string) => Promise<TvRequest[]>` — repositories.ts:233 | rows for one user |
| `listAllTv` | `(db: Db) => Promise<TvRequest[]>` — repositories.ts:236 | all rows |
| `grantTv` | `(db: Db, requestId: string, adminId: string, now: number, durationMs: number) => Promise<void>` — repositories.ts:239 | void |
| `revokeTv` | `(db: Db, requestId: string, _adminId: string, _now: number) => Promise<void>` — repositories.ts:242 | void |
| `sweepTvExpiry` | `(db: Db, now = Date.now()) => Promise<{ expired: number; tasksQueued: number }>` — repositories.ts:246 | counts |

`TvStatus` (repositories.ts:225) = `'pending' | 'granted' | 'expiring_soon' | 'expired' | 'revoked'`.
`TvRequest = typeof s.tradingviewAccessRequests.$inferSelect` (repositories.ts:226), i.e. the raw row:
`{ id: string; userId: string; tradingViewUsername: string; status: string; requestedAt: Date; grantedAt: Date | null; grantedBy: string | null; expiresAt: Date | null }`.
Note: `status` is typed `string` (not `TvStatus`) on the inferred row, and the date fields are `Date`/`Date|null` — see Finding 4 for the DTO consequence.

### 2. [HIGH] (B) Neither grantTv nor revokeTv writes an audit row (asymmetric with grantProduct/revokeProduct)
`grantTv` (repositories.ts:239-241) and `revokeTv` (repositories.ts:242-244) are bare
`db.update(...)` calls with NO `db.transaction` and NO `auditLogs` insert. Contrast `grantProduct`
(repositories.ts:127-145) and `revokeProduct` (repositories.ts:147-155), which wrap the mutation AND an
`auditLogs` insert in ONE `db.transaction` (the in-txn comment at L124-126: "an entitlement change is never
left un-audited"). `submitTvRequest` (repositories.ts:228-232) is likewise un-audited and non-transactional.

The audit actions already exist: `'tradingview.grant'` and `'tradingview.revoke'` are in `AUDIT_ACTIONS`
(`packages/audit/src/audit.ts`:19-20) but are emitted by NO repo. So today, when the TV web UI is wired
to the DB (Part B), grant/revoke would silently skip the audit trail that the entitlements path guarantees.

Current (repositories.ts:239-244):
```ts
export async function grantTv(db: Db, requestId: string, adminId: string, now: number, durationMs: number): Promise<void> {
  await db.update(s.tradingviewAccessRequests).set({ status: 'granted', grantedAt: new Date(now), grantedBy: adminId, expiresAt: new Date(now + durationMs) }).where(eq(s.tradingviewAccessRequests.id, requestId));
}
export async function revokeTv(db: Db, requestId: string, _adminId: string, _now: number): Promise<void> {
  await db.update(s.tradingviewAccessRequests).set({ status: 'revoked' }).where(eq(s.tradingviewAccessRequests.id, requestId));
}
```
Proposed corrected text (mirror grant/revokeProduct: wrap in `db.transaction`, write audit via
`auditRowValues` in the same tx, and use the supplied `adminId`/`now` for revoke):
```ts
export async function grantTv(db: Db, requestId: string, adminId: string, now: number, durationMs: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'granted', grantedAt: new Date(now), grantedBy: adminId, expiresAt: new Date(now + durationMs) })
      .where(eq(s.tradingviewAccessRequests.id, requestId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.grant', targetType: 'tradingview_request', targetId: requestId, after: { status: 'granted', expiresAt: new Date(now + durationMs).toISOString() } }));
  });
}
export async function revokeTv(db: Db, requestId: string, adminId: string, now: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(s.tradingviewAccessRequests)
      .set({ status: 'revoked' })
      .where(eq(s.tradingviewAccessRequests.id, requestId));
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: adminId, actorRole: 'admin', action: 'tradingview.revoke', targetType: 'tradingview_request', targetId: requestId, after: { status: 'revoked' } }));
  });
}
```
Recommendation: make grant/revoke (and ideally submit) audit-writing + transactional before/at Part B
wire-up. This is the single most important DB-layer change for Part B because it closes an audit gap that
only appears once the UI stops using the in-memory store. Target Part: B (and D for the audit-coverage gate).

### 3. [MEDIUM] (B) listPendingTvTasks / markTvTaskDone do NOT exist (confirms 1921 Finding 5)
Grep across the repo for `listPendingTvTasks|markTvTaskDone` returns ZERO hits in any `.ts` source (only
in prior handoff text). `repositories.ts` has no task-reader/closer: `sweepTvExpiry` (repositories.ts:246-258)
is the ONLY function that touches `tradingview_access_tasks`, and it only INSERTs (`db.insert(s.tradingviewAccessTasks).values({ requestId: r.id, kind: 'revoke', done: false })`, repositories.ts:254). The `done` column
(schema.ts:164, default `false`) is never flipped; rows accumulate unconsumed. The in-memory store HAS
`addTask`/`listTasks` (`packages/tradingview-access/src/index.ts`:35-36,47-48) with no DB equivalent.
Recommendation (only if Part B/D scope includes worker task consumption — otherwise leave to a later phase
and just note the unbounded growth): add `listPendingTvTasks(db)`/`markTvTaskDone(db, taskId)`:
```ts
export type TvTask = typeof s.tradingviewAccessTasks.$inferSelect;
export async function listPendingTvTasks(db: Db): Promise<TvTask[]> {
  return db.select().from(s.tradingviewAccessTasks).where(eq(s.tradingviewAccessTasks.done, false));
}
export async function markTvTaskDone(db: Db, taskId: string): Promise<void> {
  await db.update(s.tradingviewAccessTasks).set({ done: true }).where(eq(s.tradingviewAccessTasks.id, taskId));
}
```
Target Part: B (data layer) / D (worker). NOT required to merely render the web UI; flagged because the
table is RESERVED-adjacent and the gap is real.

### 4. [HIGH] (B) requestedAt/expiresAt are Date in DB rows but number in the in-memory interface the UI renders
Confirms 1921 Finding 2. In-memory `TvAccessRequest` (`packages/tradingview-access/src/index.ts`:8-19)
types `requestedAt: number`, `grantedAt?: number`, `expiresAt?: number`. The DB `TvRequest`
(`$inferSelect`, repositories.ts:226) types `requestedAt: Date`, `expiresAt: Date | null`, etc. The web UI
at `apps/web/src/app/(app)/app/indicators/page.tsx`:58 renders `fmtDate(r.requestedAt)` and L59
`fmtDate(r.expiresAt ?? null)`; `apps/web/src/app/admin/tradingview-access/page.tsx`:53 renders
`fmtDate(r.expiresAt ?? null)`. If Part B swaps `tvStore.list()`/`tvService.*` for the raw repo rows, the
UI receives `Date` objects (and `null` instead of `undefined`) where it expects epoch-ms `number`, and the
in-memory-shaped `revokedAt`/`revokedBy` fields are absent entirely. Recommendation: do NOT hand raw repo
rows to the UI. Add user-scoped/admin list functions that return a normalized epoch-ms DTO matching the
in-memory shape (see Finding 5) so the page components are unchanged. Target Part: B.

### 5. [MEDIUM] (B) Specify the TV DTO + user/admin list repo fns to ADD (normalized epoch-ms)
To wire Part B without changing the page render code, add a DTO equal to the in-memory `TvAccessRequest`
shape and list functions that map rows -> DTO (epoch-ms, `undefined` for nulls). Note: the DB schema has
NO `revokedAt`/`revokedBy` columns (schema.ts:148-157), so those in-memory fields cannot be reproduced
from the DB — the UI does not read them, so omit them (or persist them only if Part B adds columns; out of
scope here). Proposed additions to `repositories.ts` (replicate the existing `rowToEntitlement` mapper
style at repositories.ts:102-117):
```ts
export interface TvRequestDTO {
  id: string;
  userId: string;
  tradingViewUsername: string;
  status: TvStatus;
  requestedAt: number;            // epoch ms
  grantedAt?: number;
  grantedBy?: string;
  expiresAt?: number;
}
function rowToTvDTO(r: TvRequest): TvRequestDTO {
  const dto: TvRequestDTO = { id: r.id, userId: r.userId, tradingViewUsername: r.tradingViewUsername, status: r.status as TvStatus, requestedAt: r.requestedAt.getTime() };
  if (r.grantedAt) dto.grantedAt = r.grantedAt.getTime();
  if (r.grantedBy) dto.grantedBy = r.grantedBy;
  if (r.expiresAt) dto.expiresAt = r.expiresAt.getTime();
  return dto;
}
export async function listTvByUserDTO(db: Db, userId: string): Promise<TvRequestDTO[]> {
  return (await listTvByUser(db, userId)).map(rowToTvDTO);
}
export async function listAllTvDTO(db: Db): Promise<TvRequestDTO[]> {
  return (await listAllTv(db)).map(rowToTvDTO);
}
```
(`submitTvRequest`/`grantTv`/`revokeTv` already exist; per Finding 2 they should become audit-writing.)
Target Part: B.

### 6. [LOW] (B) requestedAt JS field maps to SQL column created_at — no requested_at column (confirms 1921 Finding 9)
Verified: `schema.ts`:153 `requestedAt: createdAt(),` and `createdAt()` (schema.ts:11) builds
`timestamp('created_at', ...)`. The migration DDL confirms the physical column is `"created_at"`
(`packages/db/migrations/0000_broken_jack_murdock.sql`:165) — there is NO `requested_at` column anywhere.
The Drizzle insert at repositories.ts:229 correctly writes `requestedAt: new Date(now)`. This works today
and is internally consistent. Risk is only naming drift: a future migration adding a literal `requested_at`
column would collide semantically with the JS field name. Recommendation: leave as-is for Part B (changing
it forces a `0001_*.sql` migration for zero behavioural gain); if a rename is ever desired, rename the
Drizzle field to `createdAt` to match the column and surface it as `requestedAt` only in the DTO
(Finding 5). Target Part: B. Severity LOW — current code is correct.

### 7. [INFO] (C) Education tables present in schema.ts; teacher_profiles/enrollments/lesson_progress are NOT
Verified in `schema.ts`. Present: `courses` (L168-176: `id, ownerTeacherId, title, description,
productCode default 'education', published default false, createdAt`), `lessons` (L178-186: `id, courseId,
title, body, videoUrl, order default 0, published default false`), `materials` (L188-194: `id, lessonId,
label, url, kind default 'link'`). ABSENT from `schema.ts`: `enrollments`, `lesson_progress`,
`teacher_profiles` (grep across `packages/db/src` returns hits only in `schema.ts` for courses/lessons/
materials and in `seed.ts`; none for the other three). So `LessonProgress` (in-memory at
`packages/lms/src/index.ts`:35-39 and used by `markComplete` L102-105) has NO backing table — any DB-backed
`markComplete`/progress read for Part C would require a NEW `lesson_progress` table + migration (out of
this audit's add-scope; flag for Part C if progress persistence is in scope). Target Part: C.

### 8. [HIGH] (C) ZERO education repositories exist
`repositories.ts` contains NO course/lesson/material/enrollment/progress functions — grep for
`createCourse|listTeacherCourses|listPublishedCourses|listLessonsForStudent|courses|lessons` across
`packages/db/src` matches only `schema.ts` (table defs) and `seed.ts` (the single seeded course at
seed.ts:50). The web UI does ALL LMS work through the in-memory `LmsService`
(`apps/web/src/app/teacher/page.tsx`:14,27; `apps/web/src/app/(app)/app/education/page.tsx`:19,32). For
Part C Option 1 the entire education repo layer is greenfield. Target Part: C.

### 9. [MEDIUM] (C) Specify the Part C Option 1 education repo fns to ADD (exact signatures)
Mirror the in-memory `LmsService` (`packages/lms/src/index.ts`) shapes and the txn+audit pattern from
`grant/revokeProduct`. `createCourse` is a mutation, so per the existing convention it should be
transactional and write an `auditLogs` row (action `'education.material_change'` already exists in
`AUDIT_ACTIONS`, `packages/audit/src/audit.ts`:21). Reads are plain `db.select`. Note the in-memory `Course`
uses epoch-ms `createdAt: number` and `productCode: 'education' | 'club'` (lms/src/index.ts:7-15), while the
DB row gives `createdAt: Date` and `productCode: string`; return a normalized DTO so the pages render
unchanged. Proposed additions to `repositories.ts`:
```ts
export type CourseRow = typeof s.courses.$inferSelect;
export type LessonRow = typeof s.lessons.$inferSelect;

export interface CourseDTO {
  id: string;
  ownerTeacherId: string;
  title: string;
  description?: string;
  productCode: string;
  published: boolean;
  createdAt: number;            // epoch ms
}
function rowToCourse(r: CourseRow): CourseDTO {
  const dto: CourseDTO = { id: r.id, ownerTeacherId: r.ownerTeacherId, title: r.title, productCode: r.productCode, published: r.published, createdAt: r.createdAt.getTime() };
  if (r.description) dto.description = r.description;
  return dto;
}

// Mutation: transactional + audit, mirroring grantProduct (repositories.ts:127-145).
export async function createCourse(
  db: Db,
  input: { ownerTeacherId: string; title: string; description?: string; productCode?: string; published?: boolean },
  now = Date.now(),
): Promise<CourseDTO> {
  return db.transaction(async (tx) => {
    const [c] = await tx.insert(s.courses).values({
      ownerTeacherId: input.ownerTeacherId,
      title: input.title,
      description: input.description ?? null,
      productCode: input.productCode ?? 'education',
      published: input.published ?? false,
    }).returning();
    if (!c) throw new Error('failed to insert course');
    await tx.insert(s.auditLogs).values(auditRowValues({ actorUserId: input.ownerTeacherId, actorRole: 'teacher', action: 'education.material_change', targetType: 'course', targetId: c.id, after: { title: c.title, published: c.published } }));
    return rowToCourse(c);
  });
}

// Teacher/admin view — all of a teacher's courses (drafts included).
export async function listTeacherCourses(db: Db, ownerTeacherId: string): Promise<CourseDTO[]> {
  return (await db.select().from(s.courses).where(eq(s.courses.ownerTeacherId, ownerTeacherId))).map(rowToCourse);
}

// Student view — published courses only (entitlement gating stays at the route, as today).
export async function listPublishedCourses(db: Db): Promise<CourseDTO[]> {
  return (await db.select().from(s.courses).where(eq(s.courses.published, true))).map(rowToCourse);
}

// Student view — published lessons of one course, ordered. Fail-closed gating stays at the route.
export async function listLessonsForStudent(db: Db, courseId: string): Promise<LessonRow[]> {
  return db.select().from(s.lessons)
    .where(and(eq(s.lessons.courseId, courseId), eq(s.lessons.published, true)))
    .orderBy(s.lessons.order);
}
```
Notes: (a) `and`, `eq` are already imported (repositories.ts:11); `orderBy` is available on the Drizzle
query builder but is NOT yet imported as a helper — ordering via `.orderBy(s.lessons.order)` needs no extra
import, but if a desc/asc helper is wanted add `asc` to the `drizzle-orm` import at repositories.ts:11.
(b) The entitlement/ownership checks that `LmsService.listLessonsForStudent`/`canEdit` perform in-memory
(lms/src/index.ts:88-99) are enforced at the route via `accessFor(...)`/`assertAdmin` today
(`apps/web/src/app/(app)/app/education/page.tsx`:8; `apps/web/src/app/teacher/page.tsx`:12,25) — keep that
gating at the route; the repo stays a thin data layer (matches how `db-store.ts` delegates rules to repos
and routes). (c) `admin` sees all courses: the route can call `listTeacherCourses` per-owner or you can add
a `listAllCourses(db)` if the admin path needs it (teacher/page.tsx:27 currently shows all to admins).
Target Part: C.

### 10. [INFO] (D) The txn + in-transaction audit pattern to replicate
The canonical pattern for any audited mutation (to copy for TV grant/revoke and LMS createCourse):
1. `auditRowValues(input: AuditInput)` (repositories.ts:193-210) maps an `AuditInput` to an `auditLogs`
   row, calling `buildEvent` (redacts before/after, generates id/ts) — `packages/audit/src/audit.ts`:59-76.
2. Wrap the domain mutation AND `tx.insert(s.auditLogs).values(auditRowValues({...}))` in ONE
   `db.transaction(async (tx) => { ... })` so the mutation is never left un-audited (exactly
   `grantProduct` repositories.ts:129-144 and `revokeProduct` repositories.ts:148-154).
3. Use a valid action from `AUDIT_ACTIONS` (`packages/audit/src/audit.ts`:8-23) — `tradingview.grant`,
   `tradingview.revoke`, `education.material_change` already exist; no new action codes needed.
4. NEVER put raw secrets in `before`/`after` (the vault/sealed pattern at repositories.ts:167-188 and
   db-store.ts:91-100 keeps plaintext out of the DB; audit `redact()` is a second layer). None of the TV/LMS
   fields are secret, but keep `after` to status/title/published booleans, not full payloads.
Target Part: D (audit-coverage / persistence-truth gate), applied within B and C.

## Decisions
- This auditor does not pick the LMS approach; that is the lms-approach-decider's call. Data-layer facts
  bearing on it: Part C Option 1 (DB-wire LMS) is fully greenfield in `packages/db` — `courses`/`lessons`/
  `materials` tables exist (schema.ts:168-194) but ZERO education repos exist (Finding 8), and
  `lesson_progress`/`enrollments`/`teacher_profiles` tables do NOT exist (Finding 7), so any progress/
  enrollment persistence needs a NEW table + migration on top of the four read/write repos in Finding 9.
- For Part B, the existing six TV repos are reusable as-is for reads, but grant/revoke MUST be upgraded to
  the transactional audit-writing pattern (Finding 2) and the UI MUST consume normalized epoch-ms DTOs
  (Findings 4-5) rather than raw `$inferSelect` rows.

## Risks
- HIGH: wiring the TV admin UI to the current `grantTv`/`revokeTv` would persist grants/revokes with NO
  audit trail (Finding 2) — a regression vs the entitlements path and a likely Part D gate failure.
- HIGH: handing raw repo rows (`Date`, `null`) to the existing TV pages breaks `fmtDate` expectations and
  drops fields the in-memory type carried (Finding 4); must add DTOs first.
- MEDIUM: `tradingview_access_tasks` rows accumulate forever (no consumer; Finding 3) — orthogonal to web
  wiring but worsens as soon as the DB path is the live one.
- MEDIUM: any LMS progress/enrollment feature in Part C is blocked on a missing table (Finding 7), not just
  a missing repo — scope accordingly.
- LOW: `requestedAt -> created_at` naming (Finding 6) is correct but a latent drift trap for future
  migrations.

## Verification/tests
- READ-ONLY audit. Ran NO npm/tests/builds/git (hard rule).
- Every claim cited to a file:line I opened: `schema.ts` (full), `repositories.ts` (full), `index.ts`,
  `client.ts`, `seed.ts`, `migrations/0000_broken_jack_murdock.sql` L155-178, `packages/audit/src/audit.ts`
  + `index.ts`, `packages/tradingview-access/src/index.ts` (full), `packages/lms/src/index.ts` (full),
  `apps/web/src/lib/backend.ts`, `db-store.ts`, and the four TV/LMS pages.
- `listPendingTvTasks`/`markTvTaskDone` absence confirmed by Grep (zero `.ts` source hits). Education-repo
  absence confirmed by Grep over `packages/db/src` (matches only `schema.ts`/`seed.ts`).
- Existing TV repos ARE PGlite-integration-tested + back the worker per repo header (repositories.ts:7-9);
  I did not re-run those tests (read-only). Proposed signatures are type-checked by inspection against the
  live schema/imports; an implementer must run `npm run typecheck`/tests after adding them.

## Next actions
1. (B) Make `grantTv`/`revokeTv`/`submitTvRequest` transactional and audit-writing using `auditRowValues`
   + `db.transaction`, actions `tradingview.grant`/`tradingview.revoke` (Findings 2, 10). Pass the real
   `adminId`/`now` through `revokeTv` (drop the leading-underscore unused params).
2. (B) Add `TvRequestDTO` + `rowToTvDTO` + `listTvByUserDTO`/`listAllTvDTO` returning epoch-ms DTOs; wire
   `apps/web/src/app/(app)/app/indicators/page.tsx` and `apps/web/src/app/admin/tradingview-access/page.tsx`
   to them (and to `submitTvRequest`/`grantTv`/`revokeTv`) via `backend.ts`/`db-store.ts`, keeping the
   in-memory path for dev. Remove the "storage: in-memory (demo)" pills as each view lands (Findings 4-5).
3. (C, if Option 1 chosen) Add `createCourse` (transactional+audit), `listTeacherCourses`,
   `listPublishedCourses`, `listLessonsForStudent` per Finding 9; wire teacher/education pages; keep
   entitlement/ownership gating at the route. Decide separately whether `lesson_progress`/enrollment
   persistence is in scope — if so, add the table + migration first (Finding 7).
4. (D) Add/extend tests asserting an `audit_logs` row is written in the SAME transaction for TV grant/revoke
   and course creation (mirror the existing grant/revokeProduct audit assertion), so the audit-coverage gate
   covers TV/LMS once they are DB-backed.
5. (B/D) Decide on `tradingview_access_tasks` consumption: either add `listPendingTvTasks`/`markTvTaskDone`
   (Finding 3) + a worker consumer, or document the table as queue-only with a cleanup job; do not present
   it as consumed.
