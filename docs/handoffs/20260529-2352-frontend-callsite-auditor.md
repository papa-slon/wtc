# frontend-callsite-auditor handoff

_2026-05-29 23:52. READ-ONLY audit. No servers/tests/builds run; no files created or edited except this handoff. Every claim cited to file:line and confirmed by reading the live file._

## Scope

Phase 1.7 / Part E precursor: enumerate EVERY frontend call site that breaks when `tvService`/`tvStore` (and, IF Option-1 LMS lands, `lmsService`/`lmsStore`) go async, with the exact `await` edit and any DTO/date handling. Verify the 1921 handoff's 10 sites against current line numbers. Locate every "storage: in-memory (demo)" badge so it can be made conditional on `backendMode`. Confirm whether TypeScript would catch a missed `await` today, and recommend typed `AsyncTvStore`/`AsyncLmsStore` interfaces. Target Parts: B, D.

Files in scope: `apps/web/src/app/(app)/app/indicators/page.tsx`, `apps/web/src/app/admin/tradingview-access/page.tsx`, `apps/web/src/app/admin/page.tsx`, `apps/web/src/app/teacher/page.tsx`, `apps/web/src/app/(app)/app/education/page.tsx`.

## Files inspected

- `apps/web/src/app/(app)/app/indicators/page.tsx` (full)
- `apps/web/src/app/admin/tradingview-access/page.tsx` (full)
- `apps/web/src/app/admin/page.tsx` (full)
- `apps/web/src/app/teacher/page.tsx` (full)
- `apps/web/src/app/(app)/app/education/page.tsx` (full)
- `apps/web/src/lib/backend.ts` (full — backend selector / re-exports)
- `apps/web/src/lib/format.ts` (full — `fmtDate` signature)
- `apps/web/src/lib/demo.ts` (grep: tv/lms service+store wiring, lines 15-16, 46-47, 62-63, 72-75, 109-112)
- `apps/web/src/lib/db-store.ts` (grep: tv/lms/course/session symbols — confirms NO TV/LMS exports)
- `packages/tradingview-access/src/index.ts` (full — sync service/store + `TvAccessRequest.requestedAt: number`)
- `packages/lms/src/index.ts` (full — sync service/store + `Course.createdAt: number`)
- `packages/db/src/repositories.ts` (lines 180-279 — async TV repos + `TvRequest = $inferSelect`; grep confirms NO LMS repos)
- `packages/db/src/schema.ts` (lines 140-204 — TV/courses/lessons/materials tables; `requestedAt/grantedAt/expiresAt` are `timestamp`/`createdAt()` → `Date`)
- `docs/handoffs/20260529-1921-integration-risk-auditor.md` (the prior 10-site list being verified)

## Files changed

None — read-only audit

## Findings

### 1. [HIGH] (B) All four TradingView call sites confirmed present; the 1921 line numbers drifted — here are the CURRENT lines + exact await edits

The 1921 handoff lists TV sites at indicators:18/32, admin-tv:16/24/33, admin:7. All four files still contain these calls; line numbers are slightly off in some cases. Current verified state:

| # | File | Current line | Current call | Enclosing fn | Server action? |
|---|---|---|---|---|---|
| a | `app/(app)/app/indicators/page.tsx` | **18** | `tvService.submitRequest(user.id, parsed.data.username, access.allowed, Date.now());` | `submitTvAction` | YES — `'use server'` at line 11; already `async` |
| b | `app/(app)/app/indicators/page.tsx` | **32** | `const requests = tvStore.list().filter((r) => r.userId === user.id);` | `IndicatorsPage` | No — server-component render; already `async` (line 29) |
| c | `app/admin/tradingview-access/page.tsx` | **16** | `tvService.grant(String(formData.get('requestId')), actor.id, Date.now(), 90 * DAY);` | `grantAction` | YES — `'use server'` line 12; already `async` |
| d | `app/admin/tradingview-access/page.tsx` | **24** | `tvService.revoke(String(formData.get('requestId')), actor.id, Date.now());` | `revokeAction` | YES — `'use server'` line 20; already `async` |
| e | `app/admin/tradingview-access/page.tsx` | **33** | `const requests = tvStore.list();` | `AdminTvPage` | No — server-component render; already `async` (line 32) |
| f | `app/admin/page.tsx` | **7** | `const pendingTv = tvStore.list({ status: 'pending' }).length;` | `AdminOverview` | No — server-component render; already `async` (line 5) |

Every enclosing function is already `async`, so adding `await` is always legal — no function signature changes needed.

Exact before -> after:

- **(a) indicators:18** — `tvService.submitRequest(user.id, parsed.data.username, access.allowed, Date.now());` -> `await tvService.submitRequest(user.id, parsed.data.username, access.allowed, Date.now());` (still inside the existing `try { } catch { }` fail-closed block, lines 17-21 — keep the try/catch).
- **(b) indicators:32** — `const requests = tvStore.list().filter((r) => r.userId === user.id);` -> `const requests = (await tvStore.list()).filter((r) => r.userId === user.id);` Note the parentheses: `await` must wrap the call before `.filter`. Equivalent and cleaner: prefer a DB-side filter `await tvStore.listByUser(user.id)` if the async store exposes it (the DB repo already has `listTvByUser(db, userId)` at repositories.ts:233).
- **(c) admin-tv:16** — `tvService.grant(...)` -> `await tvService.grant(...)`.
- **(d) admin-tv:24** — `tvService.revoke(...)` -> `await tvService.revoke(...)`.
- **(e) admin-tv:33** — `const requests = tvStore.list();` -> `const requests = await tvStore.list();` (the subsequent `await Promise.all(requests.map(...))` at line 34 is unaffected).
- **(f) admin:7** — `const pendingTv = tvStore.list({ status: 'pending' }).length;` -> `const pendingTv = (await tvStore.list({ status: 'pending' })).length;` (parenthesize before `.length`).

Recommendation: add all six `await`s atomically in the same PR that flips `backend.ts:49` (`tvStore`) and `backend.ts:48` (`tvService`) to the async DB-backed implementation. Target Part B (and D for the worker-shared repo contract).

### 2. [HIGH] (B) fmtDate render sites WILL type-break under DB DTOs — TvRequest dates are `Date`, fmtDate wants epoch-ms `number`

Confirmed type divergence:
- In-memory `TvAccessRequest.requestedAt: number`, `expiresAt?: number` (`packages/tradingview-access/src/index.ts:13,16`).
- DB `TvRequest = typeof s.tradingviewAccessRequests.$inferSelect` (`packages/db/src/repositories.ts:226`); schema maps `requestedAt: createdAt()` and `expiresAt: timestamp(...)` (`packages/db/src/schema.ts:153,156`) — both deserialize to `Date` / `Date | null`.
- `fmtDate(ms: number | null | undefined)` (`apps/web/src/lib/format.ts:23`) calls `new Date(ms)`. A `Date` passed here is a TS error once the row type is `Date`, and `!ms` truthiness on a `Date` object is always truthy so a real date would never hit the `'—'` fallback (acceptable) but a raw `Date` is still a typecheck violation against the `number` param.

Affected render sites (verified current lines):
- `apps/web/src/app/(app)/app/indicators/page.tsx:58` — `<td className="wtc-mono">{fmtDate(r.requestedAt)}</td>`
- `apps/web/src/app/(app)/app/indicators/page.tsx:59` — `<td className="wtc-mono">{fmtDate(r.expiresAt ?? null)}</td>`
- `apps/web/src/app/admin/tradingview-access/page.tsx:53` — `<td className="wtc-mono">{fmtDate(r.expiresAt ?? null)}</td>`

Recommendation (Part B): do NOT pass raw `$inferSelect` rows to the UI. Introduce a UI DTO with epoch-ms numbers, normalized in the async store/service layer (mirror `recentAuditEvents` in `backend.ts:71` which already does `r.ts.getTime()`, and `rowToEntitlement` in repositories.ts). Proposed DTO:

```ts
export interface TvRequestView {
  id: string;
  userId: string;
  tradingViewUsername: string;
  status: TvAccessStatus;
  requestedAt: number;            // .getTime()
  grantedAt: number | null;
  expiresAt: number | null;       // r.expiresAt ? r.expiresAt.getTime() : null
}
```

With the DTO, the three render sites need NO edit (they already read `r.requestedAt` / `r.expiresAt` as numbers). If instead you pass `Date` rows directly, you must change every site to `fmtDate(r.requestedAt.getTime())` / `fmtDate(r.expiresAt ? r.expiresAt.getTime() : null)` AND widen `fmtDate` to accept `Date` — the DTO approach is strongly preferred (one normalization point, zero render edits, keeps `fmtDate` typed to `number`).

### 3. [HIGH] (D) IF Option-1 LMS lands: all four LMS call sites confirmed, BUT the LMS DB repository layer does NOT exist yet

The 1921 LMS sites are teacher:14/27 and education:19/28. All four confirmed present at the listed/near lines:

| # | File | Current line | Current call | Enclosing fn | Server action? |
|---|---|---|---|---|---|
| g | `app/teacher/page.tsx` | **14** | `lmsService.createCourse({ userId, isAdmin }, { ... }, Date.now());` (spans 14-18) | `createCourseAction` | YES — `'use server'` line 10; already `async` |
| h | `app/teacher/page.tsx` | **27** | `const myCourses = [...lmsStore.courses.values()].filter(...)` | `TeacherPage` | No — server-component render; already `async` (line 22) |
| i | `app/(app)/app/education/page.tsx` | **19** | `const courses = [...lmsStore.courses.values()].filter((c) => c.published);` | `EducationPage` | No — server-component render; already `async` (line 6) |
| j | `app/(app)/app/education/page.tsx` | **32** | `const lessons = lmsService.listLessonsForStudent(c.id, true);` | `EducationPage` (inside `.map`) | No — render; already `async` |

Note the 1921 handoff put site (j) at education:28; the live `listLessonsForStudent` call is at **line 32** (inside the `courses.map(...)` JSX block, lines 31-45). Verify-and-correct: 28 is wrong, 32 is current.

Exact before -> after IF Option-1:
- **(g) teacher:14** — wrap the multi-line call: `await lmsService.createCourse(...)`.
- **(h) teacher:27** — `[...lmsStore.courses.values()]` is a synchronous `Map` spread. An async store cannot expose `.courses` as a live `Map`. This is NOT a simple `await` — it requires an interface method, e.g. `const myCourses = await lmsStore.listCoursesForOwner(user.id, user.roles.includes('admin'));` (push the ownership/admin filter into the query). Cannot be fixed by adding `await` to a `Map` spread.
- **(i) education:19** — same `Map`-spread problem: `const courses = await lmsStore.listPublishedCourses();`.
- **(j) education:32** — `const lessons = await lmsService.listLessonsForStudent(c.id, true);` AND because it is now inside a `.map` callback, the JSX cannot `await` per-iteration directly. Refactor to pre-resolve before render: `const coursesWithLessons = await Promise.all(courses.map(async (c) => ({ c, lessons: await lmsService.listLessonsForStudent(c.id, true) })));` then map over `coursesWithLessons` in JSX (same shape as `admin/tradingview-access/page.tsx:34` already uses `await Promise.all(requests.map(...))`).

BLOCKING for Option-1 (the decision input the operator needs): `packages/db/src/repositories.ts` has ZERO LMS functions — grep for `course|lesson|createCourse|listCourses|lms` (case-insensitive) over the whole file returns no matches. `apps/web/src/lib/db-store.ts` exposes only users/sessions/entitlements/exchange-keys/audit (grep for tv/lms/course returns only `createSession`/`listExchangeKeys`). The schema tables `courses`, `lessons`, `materials` exist (`schema.ts:168,178,188`) but are unbacked by any repo or integration test. Contrast the TV path, which already has tested async repos (`submitTvRequest`/`listTvByUser`/`listAllTv`/`grantTv`/`revokeTv`, repositories.ts:228-244) backing the worker.

Recommendation / decision steer: Option-1 (DB-wire LMS) is materially larger than DB-wiring TV — it requires writing AND integration-testing a brand-new LMS repository layer (createCourse, listCoursesForOwner, listPublishedCourses, listLessonsForStudent/Editor, markComplete + DTO normalization for `createdAt: Date -> number`), then flipping `backend.ts:50-51`. TV is a wiring job; LMS is a build job. If the goal of Phase 1.7/Part E is to ship persisted TV with minimal blast radius, recommend **Option-2 for LMS** (keep LMS in-memory this phase, ship TV DB-wire now) and schedule the LMS repo build as its own phase. Target Part D (worker/repo) + B (UI).

### 4. [MEDIUM] (B/D) The badges are exactly THREE and the locations are confirmed; admin/page.tsx already models the correct `backendMode` pattern

Whole-`apps/web/src` grep for `in-memory (demo)` and for `storage:|memory-backed|DB-persisted` returns exactly three source badges (the only other hit is a stale `.next/server/.../page.js` build artifact — ignore it):

- `apps/web/src/app/(app)/app/indicators/page.tsx:39` — `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>` with sub-copy at line 40 ("...TV/LMS DB wiring is Phase 1.5.").
- `apps/web/src/app/admin/tradingview-access/page.tsx:40` — `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>` with sub-copy at line 41 ("...Postgres wiring deferred (Part E).").
- `apps/web/src/app/(app)/app/education/page.tsx:25` — `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>` with sub-copy at line 26 ("...LMS content is not yet DB-persisted...Phase 1.5.").

`admin/page.tsx` already imports `backendMode` from `@/lib/backend` (line 2) and renders a conditional BACKEND card at line 17 (`backendMode === 'postgres' ? 'Postgres' : 'In-memory (dev)'`). That is the exact pattern to reuse for the three badges.

Recommendation (Part B): when TV is DB-wired, make the indicators (39-40) and admin-tv (40-41) badges conditional on `backendMode` (e.g. render the "in-memory (demo)" pill only when `backendMode === 'memory'`, else a `tone="ok"` "storage: Postgres" pill). Import `backendMode` into both files (neither imports it today — indicators imports `tvService, tvStore` at line 4; admin-tv imports `tvService, tvStore, getUserById` at line 2). The education badge (25-26) should stay unconditionally "in-memory" UNLESS Option-1 LMS lands; if Option-2 (LMS stays memory), leave education's badge as-is and only gate the two TV badges. Concrete pattern:

```tsx
import { tvService, tvStore, backendMode } from '@/lib/backend';
// ...
{backendMode === 'memory' ? (
  <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
) : (
  <StatusPill tone="ok">storage: Postgres</StatusPill>
)}
```

### 5. [HIGH] (B/D) TypeScript would NOT catch a missed await today — the store/service types are synchronous, so a partial migration silently loses writes

Confirmed: `backend.ts:48-51` re-exports `memory.tvService`/`memory.tvStore`/`memory.lmsService`/`memory.lmsStore` directly. Their types come from `packages/tradingview-access/src/index.ts` (`TvAccessStore.list(): TvAccessRequest[]` line 34; `TvAccessService.submitRequest(...): TvAccessRequest` line 58; `.grant`/`.revoke` return `TvAccessRequest`) and `packages/lms/src/index.ts` (`LmsService.createCourse(...): Course` line 64; `listLessonsForStudent(...): Lesson[]` line 88; `LmsStore.courses: Map<...>` line 47). All are synchronous return types — `void`-discarding the return of a sync function is legal, so omitting `await` after the DB swap compiles cleanly and the server action returns before the DB write resolves (the exact silent-data-loss failure the 1921 handoff flagged).

Recommendation (the typecheck-enforcement the assignment asks for): define typed async interfaces and annotate the `backend.ts` exports with them, so any un-awaited call becomes a type error (a `Promise<void>` returned where the prior code discarded a value is still legal, BUT reading `.list()` results as an array — `.filter`/`.length`/`[...spread]` on a `Promise` — is a hard type error, which catches sites b/e/f/h/i immediately). Proposed signatures:

```ts
// in @wtc/tradingview-access (new async-store contract)
export interface AsyncTvStore {
  create(req: TvAccessRequest): Promise<void>;
  get(id: string): Promise<TvAccessRequest | undefined>;
  update(req: TvAccessRequest): Promise<void>;
  list(filter?: { status?: TvAccessStatus }): Promise<TvRequestView[]>;     // DTO, epoch-ms dates
  addTask(task: TvAccessTask): Promise<void>;
  listTasks(filter?: { done?: boolean }): Promise<TvAccessTask[]>;
}
export interface AsyncTvService {
  submitRequest(userId: string, username: string, hasEntitlement: boolean, now: number): Promise<TvRequestView>;
  grant(requestId: string, adminId: string, now: number, durationMs: number): Promise<void>;
  revoke(requestId: string, adminId: string, now: number): Promise<void>;
}

// in @wtc/lms (only if Option-1)
export interface AsyncLmsStore {
  listCoursesForOwner(ownerId: string, isAdmin: boolean): Promise<CourseView[]>;
  listPublishedCourses(): Promise<CourseView[]>;
}
export interface AsyncLmsService {
  createCourse(actor: Actor, input: {...}, now: number): Promise<CourseView>;
  listLessonsForStudent(courseId: string, hasAccess: boolean): Promise<Lesson[]>;
}
```

Then in `backend.ts`: `export const tvStore: AsyncTvStore = ...; export const tvService: AsyncTvService = ...;`. Because the in-memory impls are sync, either wrap them (`async list() { return syncStore.list().map(toView); }`) so the SAME async type is presented in BOTH dev and prod (so a missing `await` is caught in dev typecheck, not just prod), or have `backend.ts` adapt the memory store to the async interface. This is the single most important guardrail: it converts the "easy to miss, silent in prod" risk into a compile-time failure. Target Parts B (TV UI) and D (shared store contract used by worker too).

### 6. [LOW] (B) `backend.ts` does not yet branch tv/lms on `useDb` — the swap point is lines 48-51

For the operator's edit map: unlike `core` (line 20, `useDb ? dbStore : memory`), the TV/LMS exports at `backend.ts:48-51` are hardwired to `memory.*` with a comment ("in-memory this phase"). DB-wiring TV means changing line 48-49 to select a DB-backed `tvService`/`tvStore` when `useDb` (and applying the same `guard()` fail-closed wrapper used for core, lines 32-45, so production without `DATABASE_URL` fails closed rather than silently using memory). There is currently no `tvService`/`tvStore` export from `db-store.ts` (confirmed by grep) — that adapter must be added there alongside the existing core functions. Target Part B/D.

## Decisions

- **Six TV call sites are real and must each receive `await`** (Finding 1): indicators:18, indicators:32, admin-tv:16, admin-tv:24, admin-tv:33, admin:7. Two need parentheses (`(await ...).filter/.length`). All enclosing functions are already `async`.
- **TV date handling is via a `TvRequestView` DTO** normalized to epoch-ms in the store/service layer (Finding 2); with the DTO the three `fmtDate` sites (indicators:58, indicators:59, admin-tv:53) need NO change and `fmtDate` stays typed to `number`.
- **LMS recommendation: Option-2 (keep LMS in-memory this phase)** unless the operator explicitly wants the LMS build now (Finding 3). Rationale: TV has tested async repos already; LMS has NO repository functions at all — Option-1 is a from-scratch repo build + integration tests, not a wiring job. Two LMS sites (teacher:27, education:19) are `Map` spreads that cannot be fixed with `await` alone and need new query methods; education:32 needs a `Promise.all` render refactor.
- **Exactly three "in-memory (demo)" badges** (Finding 4): indicators:39, admin-tv:40, education:25. Gate the two TV badges on `backendMode === 'memory'`; leave education's badge as-is under Option-2.
- **Add `AsyncTvStore`/`AsyncTvService` (and `AsyncLmsStore`/`AsyncLmsService` only under Option-1) typed interfaces** and annotate `backend.ts` exports so missing awaits fail typecheck (Finding 5). Present the async type in BOTH dev and prod so dev typecheck catches omissions.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Partial migration: store goes async, a call site keeps no `await` | High (sync types compile fine today, Finding 5) | High (server action returns before DB write; lost grants/requests) | Land `AsyncTvStore`/`AsyncTvService` typed interfaces FIRST so omissions fail typecheck; add all 6 awaits in the same PR as the backend.ts swap |
| Raw `Date` rows passed to `fmtDate(number)` | High if DTO skipped (Finding 2) | Medium (typecheck error + `Invalid Date`/always-truthy `!ms`) | Normalize to `TvRequestView` epoch-ms DTO in the store/service, not at render |
| Option-1 LMS underestimated as a "wiring" task | Medium (no repos exist, Finding 3) | High (schedule slip; untested LMS persistence) | Choose Option-2 this phase, or scope the LMS repo build (repos + PGlite tests) as its own work item |
| `lmsStore.courses` `Map` spread (teacher:27, education:19) treated as awaitable | Medium | Medium (won't compile / wrong refactor) | Replace with async query methods `listCoursesForOwner`/`listPublishedCourses`; do not `await` a Map |
| education:32 `await` inside JSX `.map` | Medium under Option-1 | Medium (cannot await per-iteration in render) | Pre-resolve with `await Promise.all(courses.map(...))` before JSX (mirror admin-tv:34) |
| TV/LMS exports left hardwired to `memory.*` (backend.ts:48-51) with no `guard()` | Medium | High (prod could silently use memory) | Apply the existing `guard()` fail-closed wrapper to the DB-backed TV exports |
| Badge left unconditional after TV DB-wire | Low | Low (misleading "in-memory" label in prod) | Gate the two TV badges on `backendMode`; reuse the admin/page.tsx:17 pattern |

## Verification/tests

(Recommended for the implementer; NOT run in this read-only audit.)

- Typecheck-as-guard: after adding `AsyncTvStore`/`AsyncTvService` and annotating `backend.ts`, deliberately drop one `await` (e.g. indicators:18) and confirm `tsc` errors (it will, because `.list()` results feed `.filter`/`.length`/spreads). This proves the guardrail works before relying on it.
- Vitest: mock a DB-backed `tvService` with a delayed `async submitRequest`; assert `submitTvAction` awaits (write completes before `revalidatePath`).
- DTO test: assert `tvStore.list()` returns `requestedAt`/`expiresAt` as `number` (epoch-ms), never `Date`, so `fmtDate` stays `number`-typed.
- Badge test (Playwright or component): with `DATABASE_URL` set, indicators + admin-tv pages render "storage: Postgres" (not "in-memory (demo)"); without it, render the warn pill.
- Option-1 only: PGlite integration tests for the new LMS repos (createCourse persists; listPublishedCourses returns only `published`; listLessonsForStudent fail-closed returns `[]` without access) before flipping backend.ts:50-51.

## Next actions

Ordered for the operator:

1. **[Part B/D, do FIRST]** Define `AsyncTvStore` + `AsyncTvService` in `@wtc/tradingview-access` with a `TvRequestView` epoch-ms DTO (Finding 5/2). Annotate `backend.ts:48-49` exports with these types; wrap the in-memory impl so the async type is presented in dev too (so dev typecheck catches missing awaits).
2. **[Part B]** Add DB-backed `tvService`/`tvStore` to `apps/web/src/lib/db-store.ts` (adapting repositories.ts:228-244 to the async interface + DTO normalization). Flip `backend.ts:48-49` to `useDb ? dbStore.* : memory.*` and apply the existing `guard()` fail-closed wrapper (Finding 6).
3. **[Part B]** In the SAME PR, add `await` at the six TV sites — indicators:18, indicators:32 `(await ...).filter`, admin-tv:16, admin-tv:24, admin-tv:33, admin:7 `(await ...).length` (Finding 1). Confirm the three `fmtDate` sites (indicators:58/59, admin-tv:53) need no edit because the DTO returns numbers (Finding 2).
4. **[Part B]** Gate the two TV "in-memory (demo)" badges on `backendMode === 'memory'` — indicators:39-40 and admin-tv:40-41; import `backendMode` into both files; reuse the admin/page.tsx:17 conditional pattern (Finding 4).
5. **[Decision — Part D]** Choose LMS Option-2 (keep in-memory; ship TV only) OR Option-1. If Option-1: build + PGlite-test a new LMS repo layer (createCourse/listCoursesForOwner/listPublishedCourses/listLessonsForStudent/markComplete + `CourseView` DTO), add `AsyncLmsStore`/`AsyncLmsService`, flip backend.ts:50-51, then edit the four LMS sites — teacher:14 (`await`), teacher:27 + education:19 (replace Map spreads with async query methods), education:32 (`Promise.all` render refactor) — and gate the education badge (25-26) (Finding 3).
