# qa-gates-auditor handoff

_2026-05-29 23:52. Phase 1.7 / Part E (DB-wire the existing TradingView + LMS web UI, decide LMS approach). READ-ONLY audit mapping the tests + gates so Part D tests and Part F gates are precise. No code, scripts, builds, installs, migrations, servers, or git were run. Every claim below is cited file:line and was confirmed by reading the live file this session._

## Scope

Map the existing test + gate surface so Part D (new TV/LMS integration tests) and Part F (gate run) are exact:
- The PGlite setup pattern in `tests/integration/db-persistence.test.ts` and EXACTLY how to add TV-DB and LMS-DB integration tests in the same style.
- e2e coverage today (`playwright.config.ts` + `tests/e2e/smoke.spec.ts`), what to add for `/app/indicators`, `/admin/tradingview-access`, `/app/education`, `/teacher`, how e2e logs in, which backend it runs (memory, no `DATABASE_URL`), and whether DB-wiring affects e2e.
- The exact gate command sequence (`ci:local` order) + coverage + `secret:scan` scope.
- `REAL_POSTGRES_DATABASE_URL`: how `db-real-postgres.test.ts` skips, and whether `ci.yml`'s Postgres service maps it (so the harness does not silently skip in CI) — with the exact mapping to add or an explicit "pending" verdict.

Also verified the prior `20260529-1921-integration-risk-auditor` claims (10 sync TV/LMS call sites + `requestedAt` Date-vs-number) against the live files — several have shifted line numbers and one (the entitlements unique-index finding) is now STALE/resolved.

## Files inspected

- `package.json` (root — scripts; `ci:local` chain)
- `apps/web/package.json` (`dev:e2e`, build/typecheck scripts)
- `vitest.config.ts`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `.secretlintrc.json`, `.secretlintignore`
- `tsconfig.json`
- `tests/integration/db-persistence.test.ts` (PGlite harness — full)
- `tests/integration/db-real-postgres.test.ts` (opt-in real-PG harness — full)
- `tests/integration/check-governance.test.ts` (full)
- `tests/integration/csrf-coverage.test.ts` (full)
- `tests/e2e/smoke.spec.ts` (the ONLY e2e spec — full)
- `packages/db/src/repositories.ts` (TV repos + grant/revoke txn — full)
- `packages/db/src/schema.ts` (full — TV/LMS tables, types, indexes)
- `packages/db/src/seed.ts` (full)
- `packages/db/src/index.ts` (barrel — what is exported for test imports)
- `packages/db/migrations/0000_broken_jack_murdock.sql` (TV table column names), `packages/db/migrations/0001_early_toad_men.sql` (unique-index migration)
- `apps/web/src/lib/backend.ts` (selector), `apps/web/src/lib/db-store.ts`, `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/format.ts` (`fmtDate` signature)
- `packages/tradingview-access/src/index.ts` (in-memory Tv types/service)
- `packages/lms/src/index.ts` (in-memory LMS types/service)
- TV/LMS web UI call sites: `apps/web/src/app/(app)/app/indicators/page.tsx`, `apps/web/src/app/(app)/app/education/page.tsx`, `apps/web/src/app/teacher/page.tsx`, `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/worker/src/tick-once.ts`
- Prior handoffs: `docs/handoffs/20260529-1921-integration-risk-auditor.md`, `20260529-2052-qa-ci-gates-auditor.md`, `20260529-2228-gate-repro-auditor.md`, `20260529-2228-frontend-build-e2e-auditor.md`
- Globs: `tests/integration/*.test.ts` (4 files), `packages/**/*.test.ts` (10 files), `apps/web/**/*.test.ts` (0 files), `packages/*/src/__smoke__.ts` (7 smokes), `tests/e2e/**`

## Files changed

None — read-only audit

## Findings

Severity legend: HIGH / MEDIUM / LOW / INFO. Each finding is cited file:line and tagged with the target Part.

---

### Finding 1 — INFO: PGlite setup pattern in `db-persistence.test.ts` — the exact template to reuse for TV-DB and LMS-DB tests

- **Severity:** INFO (foundational — this is the pattern Part D extends)
- **Evidence:** `tests/integration/db-persistence.test.ts:39-48` — `beforeAll` does: `const pg = new PGlite()` (in-memory, ephemeral); read every `*.sql` in `join(process.cwd(), 'packages', 'db', 'migrations')` SORTED (`:42-44`); `for (const f of files) await pg.exec(readFileSync(...))` (`:46`); then `db = drizzle(pg, { schema }) as unknown as Db` (`:47`). Imports come from `@wtc/db` (`:12-32`) and the test casts the PGlite-backed Drizzle to `Db`. The header comment (`:1-6`) states the production driver is postgres-js but the query API is identical, so the repos are exercised against a real Postgres engine without Docker. Both migrations (`0000_*.sql`, `0001_*.sql`) are applied because the glob picks up all `.sql` sorted — so the unique entitlements index from `0001` (`packages/db/migrations/0001_early_toad_men.sql:1-2`) IS in effect inside the test DB.
- **Impact:** New TV/LMS DB tests should be added either as new `describe(...)` blocks INSIDE this same file (reusing the single `db`/`beforeAll`, fastest, one shared PGlite) OR as a sibling `tests/integration/db-tradingview.test.ts` / `db-lms.test.ts` with the identical `beforeAll`. Recommendation: add them as new `describe` blocks in `db-persistence.test.ts` (the seed already runs at `:51-59`, giving you `user@wtc.local` + `admin@wtc.local` + `teacher@wtc.local` to act against) — this avoids a second migration apply and keeps the harness count low.
- **Target part:** D

---

### Finding 2 — INFO: TV-DB repos already exist and are partially covered — exact additional TV integration tests to add (the missing list-all / revoke / audit assertions)

- **Severity:** INFO
- **Evidence:** `packages/db/src/repositories.ts` exports the full async TV repo set: `submitTvRequest` (`:228-232`), `listTvByUser` (`:233-235`), `listAllTv` (`:236-238`), `grantTv` (`:239-241`), `revokeTv` (`:242-244`), `sweepTvExpiry` (`:246-258`). `packages/db/src/index.ts:5` is `export * from './repositories.ts'`, so all six are importable from `@wtc/db`. Today exactly ONE TV test exists: `db-persistence.test.ts:109-119` covers submit → list-by-user → grant(already-expired) → sweep marks expired + queues a task (`expect(swept.tasksQueued).toBeGreaterThanOrEqual(1)`). NOT covered: `listAllTv` (admin list), `revokeTv`, and the fact that grant/revoke/submit write NO audit row (see Finding 6).
- **Impact / what to add (Part D, same style, new `it()`s in the same describe):**
  - **admin list:** `submitTvRequest(db, user.id, 'tv_admin_list')`; `expect((await listAllTv(db)).some(r => r.id === req.id)).toBe(true)`.
  - **revoke:** submit → `grantTv(db, req.id, admin.id, Date.now(), 90*86_400_000)` → `revokeTv(db, req.id, admin.id, Date.now())` → `expect((await listTvByUser(db, user.id)).find(r => r.id === req.id)?.status).toBe('revoked')`.
  - **expiry sweep queues a task (positive + idempotency):** the existing test asserts `swept.expired >= 1` and `tasksQueued >= 1`; add a follow-up assertion that a SECOND `sweepTvExpiry(db, Date.now())` returns `{ expired: 0, tasksQueued: 0 }` (the row is now `'expired'`, no longer `'granted'`, so it is not re-swept — confirms `repositories.ts:250` `eq(status,'granted')` filter). Optionally assert a `tradingview_access_tasks` row exists with `kind:'revoke'`, `done:false` by selecting via the schema (`db.select().from(schema.tradingviewAccessTasks)`), since there is no `listPendingTvTasks` repo yet (see Finding 7).
  - **fail-closed submit:** the DB `submitTvRequest` (`repositories.ts:228`) does NOT take a `hasIndicatorEntitlement` flag (unlike the in-memory `TvAccessService.submitRequest`, `packages/tradingview-access/src/index.ts:58-59` which throws if not entitled). So the fail-closed gate must live in the server action / a wrapper, NOT the repo. Part D should add the entitlement check at the call site and a test that the action does not insert when `accessFor(...).allowed === false`. **Do not** assert the repo itself is fail-closed — it is not, by design.
- **Target part:** D, E

---

### Finding 3 — HIGH: there are NO LMS DB repositories at all — LMS integration tests CANNOT be written until Part E adds them; this is the central Part E build item

- **Severity:** HIGH (blocks the LMS half of Part D; drives the Part E LMS DECISION)
- **Evidence:** Grep for `export async function (createCourse|listCourses|listTeacherCourses|listStudent|listLessons|createLesson|coursesByTeacher|publishedCourses)` across `packages/db/src` → **No matches**. `repositories.ts` has Identity, Sessions, Entitlements, Exchange keys, Audit, TradingView, and Worker-jobs sections only — there is no Education/LMS section. The schema HAS the tables: `courses` (`schema.ts:168-176`), `lessons` (`:178-186`), `materials` (`:188-194`), and the seed inserts one course (`seed.ts:50`). But no repo function reads/writes them. The web UI is still on the in-memory `LmsService`/`lmsStore` (`backend.ts:50-51`; `education/page.tsx:3,19,32`; `teacher/page.tsx:5,14,27`).
- **Impact:** The brief asks for LMS tests (create course, list teacher courses, list student courses/lessons, access-denied if not entitled). These cannot exist until Part E adds LMS repos. This is the LMS "approach DECISION" the brief calls for, expressed concretely.
- **Recommendation (Part E — add to `packages/db/src/repositories.ts`, mirroring the TV repo style; then Part D tests them). Proposed signatures (timestamps normalised to epoch-ms DTOs per Finding 5 so they match the `@wtc/lms` interface in `packages/lms/src/index.ts:7-25`):**
  ```ts
  // ---------------- Education / LMS (async repo) ----------------
  export type DbCourse = typeof s.courses.$inferSelect;
  export type DbLesson = typeof s.lessons.$inferSelect;

  export async function createCourse(
    db: Db,
    input: { ownerTeacherId: string; title: string; description?: string; productCode?: 'education' | 'club'; published?: boolean },
  ): Promise<DbCourse>;                                   // INSERT ... RETURNING
  export async function listCoursesForTeacher(db: Db, teacherId: string): Promise<DbCourse[]>; // WHERE owner_teacher_id = teacherId
  export async function listAllCourses(db: Db): Promise<DbCourse[]>;                           // admin sees all
  export async function listPublishedCourses(db: Db): Promise<DbCourse[]>;                     // WHERE published = true (student catalog)
  export async function listLessonsForStudent(db: Db, courseId: string, hasEducationAccess: boolean): Promise<DbLesson[]>; // [] if !hasEducationAccess OR course not published; else published lessons ORDER BY "order"
  export async function listLessonsForEditor(db: Db, courseId: string, actor: { userId: string; isAdmin: boolean }): Promise<DbLesson[]>; // [] unless owner or admin
  ```
  Reuse the EXACT visibility/ownership rules already verified in `@wtc/lms` (`LmsService.listLessonsForStudent`, `packages/lms/src/index.ts:88-93`, and `canEdit`, `:57-59`) so the DB layer matches the in-memory contract the UI relied on. **DECISION note:** the in-memory `LmsService` enforces ownership/visibility in the service class; the DB approach should keep those same rules in the repo functions (fail-closed `[]` on no access), because the server action only has the actor + entitlement, not a service.
- **LMS tests to add (Part D, same PGlite style; teacher already seeded as `teacher@wtc.local` with the 'Risk Management Fundamentals' course at `seed.ts:50`):**
  - **create course:** `const t = await findUserByEmail(db, 'teacher@wtc.local'); const c = await createCourse(db, { ownerTeacherId: t!.id, title: 'New', published: true }); expect((await listCoursesForTeacher(db, t!.id)).some(x => x.id === c.id)).toBe(true)`.
  - **list teacher courses:** assert the seeded course is returned for the teacher and NOT for `user@wtc.local`.
  - **list student courses/lessons:** seed a published lesson (insert via `schema.lessons`), then `expect((await listLessonsForStudent(db, c.id, true)).length).toBeGreaterThan(0)` and ordering by `order`.
  - **access-denied if not entitled (fail-closed):** `expect(await listLessonsForStudent(db, c.id, false)).toEqual([])` and `expect(await listLessonsForStudent(db, unpublishedCourseId, true)).toEqual([])`.
- **Target part:** E (repos) + D (tests)

---

### Finding 4 — HIGH (corrects the prior 1921 handoff): the 10 synchronous TV/LMS call sites are REAL and still memory-backed, but several line numbers have shifted — here is the verified current map

- **Severity:** HIGH (Part E must `await` these atomically when switching to async DB repos; stale line numbers would misdirect the edit)
- **Evidence (each VERIFIED this session):** `backend.ts:48-51` still wires `tvService`/`tvStore`/`lmsService`/`lmsStore` to `memory.*` (the comment at `:47` says "in-memory this phase"). Current call sites:

  | File | Verified line | Call | Prior 1921 claim |
  |---|---|---|---|
  | `app/(app)/app/indicators/page.tsx` | **18** | `tvService.submitRequest(...)` (no `await`, inside try/catch) | :18 ✓ |
  | `app/(app)/app/indicators/page.tsx` | **32** | `tvStore.list().filter(...)` | :32 ✓ |
  | `app/admin/tradingview-access/page.tsx` | **16** | `tvService.grant(...)` | :16 ✓ |
  | `app/admin/tradingview-access/page.tsx` | **24** | `tvService.revoke(...)` | :24 ✓ |
  | `app/admin/tradingview-access/page.tsx` | **33** | `tvStore.list()` | :33 ✓ |
  | `app/teacher/page.tsx` | **14** | `lmsService.createCourse(...)` | :14 ✓ |
  | `app/teacher/page.tsx` | **27** | `lmsStore.courses.values()` | :27 ✓ |
  | `app/(app)/app/education/page.tsx` | **19** | `lmsStore.courses.values()` | :19 ✓ |
  | `app/(app)/app/education/page.tsx` | **32** | `lmsService.listLessonsForStudent(c.id, true)` | :28 (now :32) |
  | `app/admin/page.tsx` | not re-read this session | `tvStore.list(...)` badge | :7 (INHERITED — not re-verified; verify before edit) |

  Note: `indicators/page.tsx:18` is wrapped in try/catch precisely because the in-memory `submitRequest` throws fail-closed; the DB `submitTvRequest` does not throw on missing entitlement (Finding 2), so the fail-closed check must move to `accessFor(...)` before the call (the page already computes `access` at `:14`).
- **Impact:** When Part E flips `backend.ts` exports to async DB wrappers, all of these must gain `await` in the SAME change or server actions return before the write completes (silent data loss) and page reads return Promises instead of arrays. The two `*.values()` spreads on `lmsStore.courses` (`education:19`, `teacher:27`) and `tvStore.list()` calls become `await listPublishedCourses(...)` / `await listCoursesForTeacher(...)` / `await listAllTv(...)` etc.
- **Recommendation:** Part E should make the change atomic (selector + all call sites + DTO normalisation). A typecheck-enforced async interface (returning `Promise<...>`) makes `tsc` catch any missed `await` at the `typecheck -w @wtc/web` gate (Part F).
- **Target part:** E

---

### Finding 5 — HIGH (verified, still live): `TvRequest.requestedAt`/`expiresAt` are `Date` in the DB but `number` in the in-memory interface and in `fmtDate` — the UI must receive epoch-ms DTOs, not raw `$inferSelect` rows

- **Severity:** HIGH (a real type break at the `typecheck -w @wtc/web` gate the moment the UI is fed DB rows)
- **Evidence:**
  - In-memory contract: `packages/tradingview-access/src/index.ts:13-16` — `requestedAt: number; grantedAt?: number; expiresAt?: number;`.
  - DB contract: `repositories.ts:226` `TvRequest = typeof s.tradingviewAccessRequests.$inferSelect`; the schema columns are `requestedAt: createdAt()` → a `timestamp` → JS `Date` (`schema.ts:153`), and `expiresAt: timestamp(...)` → `Date | null` (`:156`), `grantedAt` → `Date | null` (`:154`).
  - Consumer: `apps/web/src/lib/format.ts:23` — `export function fmtDate(ms: number | null | undefined)`; body `if (!ms) return '—'; return new Date(ms).toISOString().slice(0,10)`. A `Date` object is truthy and `new Date(date)` works, so it would not crash — but TypeScript flags the `Date`-where-`number` mismatch (gate failure), and `!ms` on a Date is never true so an epoch-0 sentinel behaves differently.
  - Call sites that pass these into `fmtDate`: `indicators/page.tsx:58` `fmtDate(r.requestedAt)`, `:59` `fmtDate(r.expiresAt ?? null)`; `admin/tradingview-access/page.tsx:53` `fmtDate(r.expiresAt ?? null)`. (Prior 1921 handoff cited the admin one as `:49`; it is now **:53**.)
- **Impact:** Feeding `$inferSelect` rows straight to the pages breaks `npm run typecheck -w @wtc/web` (Part F gate) and is semantically wrong.
- **Recommendation:** Part E adds a normaliser that converts DB rows to a UI DTO with epoch-ms numbers — exactly like `rowToEntitlement` does for entitlements (`repositories.ts:102-117`, `.getTime()` on each timestamp). Either return the DTO from the repo or map at the `db-store`/`backend` boundary. Part D should add a tiny unit assertion that the normaliser yields `typeof dto.requestedAt === 'number'`.
- **Target part:** E

---

### Finding 6 — MEDIUM: TV submit/grant/revoke repos write NO audit row (unlike entitlements grant/revoke) — "audit rows where required" must be designed, not assumed

- **Severity:** MEDIUM
- **Evidence:** `grantProduct`/`revokeProduct` write their audit row inside the SAME transaction (`repositories.ts:143` and `:153` insert into `s.auditLogs`). By contrast `submitTvRequest` (`:228-232`), `grantTv` (`:239-241`), and `revokeTv` (`:242-244`) perform ONLY the `tradingview_access_requests` mutation — no `auditLogs` insert. The in-memory TV service likewise writes no audit (`packages/tradingview-access/src/index.ts:71-85`). So today there is no TV audit trail at all.
- **Impact:** The brief's Part D item "audit rows where required" cannot be tested for TV because no TV repo emits audit. The orchestrator must DECIDE whether admin TV grant/revoke should be audited (recommended — it is an admin entitlement-adjacent action) before a test can assert it.
- **Recommendation (Part E):** add an `auditLogs` insert inside `grantTv`/`revokeTv` (ideally in the same `db.transaction` as the status update, mirroring `grantProduct`), e.g. `action: 'tradingview.grant'` / `'tradingview.revoke'`, `targetType: 'tradingview_access_request'`, `targetId: requestId`. Then Part D asserts `recentAuditEvents(db, ...)` contains those actions — identical to the existing entitlement audit assertions at `db-persistence.test.ts:84-86`. If the decision is "submit is not audited", document it so the test does not look for a submit audit row.
- **Target part:** E (emit) + D (assert)

---

### Finding 7 — MEDIUM: `tradingview_access_tasks` are queued by `sweepTvExpiry` but there is no `listPendingTvTasks`/`markTvTaskDone` repo — sweep-queues-a-task is testable only by raw schema select

- **Severity:** MEDIUM (carried from 1921 Finding 5; still true)
- **Evidence:** `sweepTvExpiry` inserts a task row per expired grant (`repositories.ts:254`, `kind:'revoke'`, `done:false`) and returns `tasksQueued`. No repo reads tasks back (Grep confirms no `listPendingTvTasks`/`markTvTaskDone` in `packages/db/src`). The worker's `tick-once.ts:17-18` uses the IN-MEMORY `TvAccessService.sweep`, NOT the DB `sweepTvExpiry` — so the DB sweep+task path is exercised ONLY by `db-persistence.test.ts:109-119`.
- **Impact:** Part D can assert "sweep queues a task" two ways: (a) via the returned `tasksQueued` count (already done at `:117`), or (b) by `db.select().from(schema.tradingviewAccessTasks)` to inspect the row. There is no repo accessor, so (b) requires importing `schema` (already imported in the test at `:13`).
- **Recommendation:** If Part E adds `listPendingTvTasks(db)` / `markTvTaskDone(db, id)` (the honest worker-consumption story), Part D should test them. Otherwise document that tasks accumulate unconsumed and test only the count + a raw select. Keep this out of the LMS/TV UI-wiring scope unless the orchestrator wants the worker change too.
- **Target part:** E (optional repos) + D

---

### Finding 8 — INFO (corrects the prior 1921 handoff): the entitlements unique-index + transactional grant/revoke finding is now RESOLVED — do not re-flag it

- **Severity:** INFO (truth correction so the orchestrator does not re-do resolved work)
- **Evidence:** Prior `20260529-1921-integration-risk-auditor.md` Finding 3 said `entitlements_user_product_idx` was a plain `index` and `grantProduct` was a non-atomic SELECT-then-INSERT with no transaction. As of THIS tree both are fixed: `schema.ts:85` is `uniqueIndex('entitlements_user_product_idx')`; migration `0001_early_toad_men.sql:1-2` drops the old index and re-creates it UNIQUE; `grantProduct` (`repositories.ts:127-145`) wraps an `onConflictDoUpdate` upsert + in-txn audit in `db.transaction`; `revokeProduct` (`:147-155`) is likewise transactional. The PGlite tests cover the concurrent-grant idempotency (`db-persistence.test.ts:122-141`) and `db-real-postgres.test.ts:78-91` covers the TRUE cross-connection race.
- **Impact:** None to add for Part D/F on this axis — it is already green. Mentioned only to prevent re-opening a closed finding.
- **Target part:** D (no action — already covered)

---

### Finding 9 — INFO: e2e coverage today — 5 specs × 2 projects = 10 cases; how it logs in; runs the MEMORY backend (no `DATABASE_URL`); DB-wiring will NOT affect e2e

- **Severity:** INFO (directly answers the brief)
- **Evidence:**
  - Spec inventory: `tests/e2e/smoke.spec.ts` has 5 `test(...)` (`:14` public landing, `:21` pricing, `:27` `/products/legacy-bot`, `:33` user dashboard+bot+terminal+security, `:52` admin console). `playwright.config.ts:16-19` defines two projects (`desktop` 1440×900, `mobile` 390×844), `:7-8` `fullyParallel:false`/`workers:1` → **10 total**.
  - Login: `smoke.spec.ts:6-12` `login(page, email)` → `goto('/login')`, fill `#email`/`#password` with `DEMO_PASSWORD='wtc-demo-pass-123'` (`:3`), click submit, `waitForURL('**/app')`. Uses the seeded demo users `user@wtc.local` (`:34`) and `admin@wtc.local` (`:53`).
  - Backend: `playwright.config.ts:20-26` webServer `command:'npm run dev:e2e -w @wtc/web'` → `apps/web/package.json:8` `dev:e2e = next dev --port 3100`. NODE_ENV=development, and the e2e CI job (`ci.yml:84-104`) sets NO `DATABASE_URL` (only the `gates` job has it at `ci.yml:31`). So `backend.ts:16` `useDb = !!process.env.DATABASE_URL` is FALSE → e2e runs the **in-memory demo backend**. Login works against the in-memory seed (`demo.ts:79-113`).
  - Existing TV/LMS coverage in e2e: `/admin/tradingview-access` IS visited (`smoke.spec.ts:58`) but the ONLY assertion is the unchanged heading `getByRole('heading',{name:'TradingView access queue'})` (`:59`). `/app/indicators`, `/app/education`, `/teacher` are NOT visited at all today.
- **Impact / does DB-wiring affect e2e?** No. e2e runs memory-backed (no `DATABASE_URL`), so wiring the TV/LMS UI to Postgres changes nothing about the e2e run UNLESS Part E makes the in-memory path go through the same async DTO interface — in which case the only risk is a missed `await` (caught by `typecheck -w @wtc/web`, not by e2e). The "storage: in-memory (demo)" pills (`indicators/page.tsx:39`, `education/page.tsx:25`, `admin/tradingview-access/page.tsx:40`) are correct ONLY while memory-backed; if Part E DB-wires these, those captions must be updated (Part E content change) but no e2e selector asserts them, so no e2e break.
- **Recommendation (Part D — optional e2e additions, memory-backed, mirroring the existing login+heading pattern):**
  - `/app/indicators` (login as `user@wtc.local`): assert heading `Indicator access` (`SectionHeader title`, `indicators/page.tsx:36`) visible; optionally submit a username and assert a row appears (note `user@wtc.local`'s indicators entitlement is seeded EXPIRED in memory — `demo.ts:104` — so the submit form is `disabled`; the demo also pre-submits one request at `demo.ts:112`, so a "Your access requests" row should already render).
  - `/admin/tradingview-access` (login as `admin@wtc.local`): the existing heading assertion stays; optionally assert the demo request row (`demo_trader_99`, `demo.ts:112`) is present.
  - `/app/education` (login as `user@wtc.local`, who has `education` active — `demo.ts:102`): assert heading `Lessons & materials` (`education/page.tsx:13/23`) and the seeded course `Risk Management Fundamentals` (`demo.ts:109`).
  - `/teacher` (login as `teacher@wtc.local`): assert heading `Your courses` (`teacher/page.tsx:32`). NOTE the smoke `login()` helper waits for `**/app` (`smoke.spec.ts:11`); `teacher@wtc.local` redirects fine to `/app` first, then `goto('/teacher')`. Add `teacher@wtc.local` is seeded with `teacher` role (`demo.ts:93`).
  - Keep these additive and screenshot-only (`screenshot:'only-on-failure'`, no `toHaveScreenshot` baselines — `playwright.config.ts:11-14`) so they cannot pixel-flake.
- **Target part:** D

---

### Finding 10 — INFO: exact gate command sequence — `ci:local` order, coverage, and `secret:scan` scope (Part F)

- **Severity:** INFO (the precise Part F run)
- **Evidence:**
  - `package.json:27` — `"ci:local": "npm run check:core && npm run governance:check && npm run lint && npm run typecheck && npm run typecheck -w @wtc/web && npm run secret:scan && npm test && npm run build -w @wtc/web"`. So `ci:local` order is: **check:core → governance:check → lint → typecheck → typecheck -w @wtc/web → secret:scan → test → build -w @wtc/web**. It does NOT include `coverage` or `e2e`.
  - Underlying scripts (`package.json:13-26`): `check:core` = 7× `node --experimental-strip-types packages/*/src/__smoke__.ts` (entitlements, crypto, analytics, audit, auth, axioma-bridge, billing — confirmed by the 7 `__smoke__.ts` globs); `governance:check` = `node scripts/check-governance.mjs`; `lint` = `eslint . --max-warnings 0`; `typecheck` = `tsc --noEmit -p tsconfig.json` (covers `packages/*/src` + `tests/**` + `vitest.config.ts`, EXCLUDES `apps/web` — `tsconfig.json:8-13`); `typecheck -w @wtc/web` = `tsc --noEmit` in the app; `test` = `vitest run`; `coverage` = `vitest run --coverage` (`@vitest/coverage-v8`); `secret:scan` = `secretlint "**/*"`; `build` = `next build` for `@wtc/web`; `e2e` = `playwright test`.
  - vitest discovers (`vitest.config.ts:8-9`) `packages/**/*.test.ts` (10 files) + `tests/integration/**/*.test.ts` (4 files: csrf-coverage, db-persistence, check-governance, db-real-postgres), EXCLUDING `apps/web/**`, `node_modules`, `dist`. So **14 test files** run (the prior 2052 handoff's "12 files" predates `check-governance.test.ts` + `db-real-postgres.test.ts`). `apps/web/**/*.test.ts` glob → 0 files, so nothing under the app is tested by vitest (only by typecheck/e2e).
  - `secret:scan` scope: `.secretlintrc.json` uses only `@secretlint/secretlint-rule-preset-recommend`; `.secretlintignore` excludes `node_modules, .next, dist, out, build, coverage, pgdata, test-results, playwright-report, package-lock.json, *.png, *.ico, *.tsbuildinfo`. So `secretlint "**/*"` scans all source incl. `tests/**`, `docs/**`, migrations — but NOT the heavy artifact dirs.
- **Impact:** Part F's canonical full run (the gate-repro-auditor's 10-gate chain, `20260529-2228-gate-repro-auditor.md:133-143`) is: **governance:check → check:core → lint → typecheck → typecheck -w @wtc/web → test → secret:scan → coverage → build -w @wtc/web → e2e**, run STRICTLY SEQUENTIALLY (build/e2e/coverage all touch `apps/web/.next` or the source tree and must never run concurrently). `ci:local` alone is INSUFFICIENT for Part F because it omits `coverage` and `e2e`.
- **Recommendation (Part F):**
  - New TV/LMS integration tests land in `vitest run` (→ `test` + `coverage` gates). New LMS repos land in `packages/db/src` → covered by `typecheck` (not `typecheck -w @wtc/web`, since `apps/web` is excluded there).
  - If Part D adds any base64/secret-shaped literal to a test fixture, prefer generating it at runtime (`crypto.randomBytes(32).toString('base64')`, as `vault.test.ts` does) so `secret:scan` does not flag a committed blob.
  - When Part E edits `backend.ts`/pages, the `typecheck -w @wtc/web` gate is the one that catches missed `await`/Date-vs-number (Findings 4, 5).
- **Target part:** F

---

### Finding 11 — HIGH: `db-real-postgres.test.ts` skips on missing `REAL_POSTGRES_DATABASE_URL`, and `ci.yml` does NOT map that variable — so the real-PG harness SILENTLY SKIPS in CI today

- **Severity:** HIGH (the brief's explicit question — CI gives a false sense of real-PG coverage)
- **Evidence:**
  - Skip mechanism: `tests/integration/db-real-postgres.test.ts:37-46` — `const URL = process.env.REAL_POSTGRES_DATABASE_URL; const run = !!URL; describe.skipIf(!run)(...)`. When unset, the whole real-PG block is inert; a single always-present availability test (`:112-115`) reports `'skipped (set REAL_POSTGRES_DATABASE_URL to enable)'`. So the suite stays green with no DB.
  - CI mapping: `.github/workflows/ci.yml` has a `postgres:17-alpine` service (`:16-28`) and the `gates` job sets `env: DATABASE_URL: postgres://wtc:wtc@localhost:5432/wtc` (`:30-31`). It does **NOT** set `REAL_POSTGRES_DATABASE_URL` anywhere (Grep confirms `REAL_POSTGRES_DATABASE_URL` appears ONLY in `db-real-postgres.test.ts`, never in `ci.yml`). Therefore in CI, `db-real-postgres.test.ts` runs but `describe.skipIf(!run)` is TRUE → it SKIPS, even though a perfectly good throwaway Postgres is already running for the job.
- **Impact:** CI advertises a Postgres service but never exercises the postgres-js driver / real-engine cross-connection race against it. The PGlite test still runs (real engine, single connection), but the opt-in real-PG complement is dead weight in CI.
- **Recommendation (Part F — exact mapping to add to `.github/workflows/ci.yml`, in the `gates` job `env:` block at lines 30-31; the service already exists, so this is a one-line addition):**
  ```yaml
      env:
        DATABASE_URL: postgres://wtc:wtc@localhost:5432/wtc
        REAL_POSTGRES_DATABASE_URL: postgres://wtc:wtc@localhost:5432/wtc
  ```
  This points the harness at the SAME ephemeral CI service DB (it is a throwaway container, satisfying the test's "throwaway only" safety note at `db-real-postgres.test.ts:10-14`). After adding it, the real-PG block runs (migrate + seed + cross-connection grant race + FK cascade) instead of skipping. CAVEAT: the `gates` job already runs `db:migrate` + `db:seed` against this DB (`ci.yml:69-73`) before `npm test`; the real-PG harness re-applies migrations via `sql.unsafe(...)` (`db-real-postgres.test.ts:50-53`) — the committed migrations must be idempotent-enough on an already-migrated DB, OR the harness should run against a SEPARATE database name (e.g. add a second service or `CREATE DATABASE wtc_test`). Simplest safe option: keep the mapping but document that the real-PG harness expects a pristine DB; if double-migration errors, point `REAL_POSTGRES_DATABASE_URL` at a distinct DB. **If the orchestrator does not want to touch CI this phase, document it as PENDING:** "CI Postgres service runs but `REAL_POSTGRES_DATABASE_URL` is unmapped → `db-real-postgres.test.ts` skips in CI; PGlite (`db-persistence.test.ts`) is the active real-engine coverage." (CI is currently inert anyway — not a git repo — so this is parity hygiene, not a live break.)
- **Target part:** F

---

### Finding 12 — LOW: `requestedAt` JS field maps to SQL column `created_at` (not `requested_at`) — naming drift to be aware of when adding LMS repos / any new TV column

- **Severity:** LOW (carried from 1921 Finding 9; still true, low urgency)
- **Evidence:** `schema.ts:153` `requestedAt: createdAt()` where `createdAt()` (`:11`) returns `timestamp('created_at', ...)`. Migration `0000_broken_jack_murdock.sql:165` confirms the `tradingview_access_requests` table has a `"created_at"` column (no `requested_at`). The insert at `repositories.ts:229` writes `requestedAt: new Date(now)` which Drizzle maps to `created_at` — correct, but the JS/SQL names diverge.
- **Impact:** None functionally today. Only a confusion risk if a future migration adds a literal `requested_at` column. Mentioned so Part E's LMS/TV work does not introduce a second timestamp with the same intent.
- **Recommendation:** No action required for Part D/E/F. If touched later, rename the Drizzle field to `createdAt` and add an explicit `requested_at` only if a distinct semantic is needed (a new migration).
- **Target part:** E (awareness only)

---

## Decisions

1. **PGlite is the test substrate for all new TV/LMS DB tests** (Finding 1). Add them as new `describe`/`it` blocks inside `tests/integration/db-persistence.test.ts` (reuse the single `beforeAll` PGlite + the seed at `:51-59` for ready-made `user`/`admin`/`teacher`), or as siblings with the identical `beforeAll` if isolation is preferred. No Docker, no real PG needed for Part D.
2. **LMS DB repositories must be CREATED in Part E before any LMS DB test can exist** (Finding 3) — there are zero LMS repo functions today. This is the concrete form of the brief's "DECIDE the LMS approach": add `createCourse`/`listCoursesForTeacher`/`listAllCourses`/`listPublishedCourses`/`listLessonsForStudent`/`listLessonsForEditor` to `repositories.ts`, reusing the verified ownership/visibility rules from `@wtc/lms` (`packages/lms/src/index.ts:57-100`), returning epoch-ms DTOs.
3. **The TV repo set already exists and is partially tested**; Part D adds admin-list (`listAllTv`), revoke (`revokeTv`), sweep-idempotency, and (if Finding 6 is adopted) audit-row assertions. The fail-closed entitlement gate stays at the server-action layer, NOT the repo (Finding 2).
4. **Timestamps must be normalised to epoch-ms before the UI** (Finding 5) — return DTOs, never raw `$inferSelect` rows, mirroring `rowToEntitlement` (`repositories.ts:102-117`). This is what keeps `typecheck -w @wtc/web` green.
5. **e2e is unaffected by DB-wiring** because it runs the in-memory backend (no `DATABASE_URL` in the e2e CI job) (Finding 9). New e2e is optional, additive, memory-backed, heading-level assertions only.
6. **Part F runs the full 10-gate sequential chain**, not `ci:local` (which omits `coverage` + `e2e`) (Finding 10).
7. **`REAL_POSTGRES_DATABASE_URL` is unmapped in CI today** → `db-real-postgres.test.ts` silently skips in CI (Finding 11). Either add the one-line `env:` mapping (with the double-migration caveat) or explicitly document PENDING.
8. **Do NOT re-open the entitlements unique-index / transaction finding** from the 1921 handoff — it is resolved (Finding 8).

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LMS DB tests written before LMS repos exist | High if briefed literally | Tests cannot compile/run | Part E adds repos FIRST (Finding 3); Part D tests them after |
| Missed `await` when flipping TV/LMS to async DB (silent data loss in server actions; Promise leaks into JSX) | High (10 call sites, Finding 4) | High | Atomic Part E change; async (Promise-returning) interface so `typecheck -w @wtc/web` catches every miss |
| Raw `Date` rows fed to `fmtDate(number)` → `typecheck -w @wtc/web` RED (Finding 5) | High the moment UI sees DB rows | Medium (gate fail) | Epoch-ms DTO normaliser before the UI layer |
| `db-real-postgres.test.ts` skips in CI (Finding 11) → false sense of real-PG coverage | Certain today (unmapped) | Medium | Map `REAL_POSTGRES_DATABASE_URL` to the CI service DB (mind double-migration), or document PENDING |
| Double-migration error if `REAL_POSTGRES_DATABASE_URL` shares the `gates` job DB already migrated/seeded (Finding 11) | Medium | Medium | Point it at a distinct DB (`wtc_test`) or confirm migration idempotency before enabling |
| New base64/secret-shaped test fixture trips `secret:scan` (Finding 10) | Low | Low (gate fail) | Generate KEK/secret literals at runtime in-test, as `vault.test.ts` does |
| TV grant/revoke have no audit trail (Finding 6) | Certain (by current design) | Medium (admin action unaudited) | Decide + emit `tradingview.grant`/`.revoke` audit in the same txn, then assert in Part D |
| TV tasks accumulate unconsumed (Finding 7) | Certain every sweep | Low short-term | Out of UI-wiring scope; add `listPendingTvTasks`/`markTvTaskDone` only if the worker change is wanted |

## Verification/tests

- **Gates RUN this session:** NONE (read-only audit — no npm/vitest/playwright/tsc/secretlint/build/migrate/seed/git executed, per the hard rules).
- **Static verification performed (all VERIFIED by reading the live file this session):**
  - PGlite harness shape: `tests/integration/db-persistence.test.ts:39-48` (new PGlite, sorted-migrations apply, drizzle-cast); seed + existing TV test at `:51-59`, `:109-119`.
  - Real-PG skip + CI mapping gap: `db-real-postgres.test.ts:37-46` (`describe.skipIf(!run)`), `:112-115` (availability test); `.github/workflows/ci.yml:16-31` (postgres service + `DATABASE_URL`, NO `REAL_POSTGRES_DATABASE_URL`); Grep confirmed `REAL_POSTGRES_DATABASE_URL` appears only in the test file.
  - TV repos exist: `repositories.ts:228-258`; barrel re-export `index.ts:5`. LMS repos absent: Grep for the 8 likely LMS function names → 0 matches in `packages/db/src`.
  - Type mismatch: `packages/tradingview-access/src/index.ts:13-16` (`number`) vs `schema.ts:153-156` (`Date`) vs `format.ts:23` (`fmtDate(number)`), consumed at `indicators/page.tsx:58-59` + `admin/tradingview-access/page.tsx:53`.
  - 10 sync call sites + memory wiring: `backend.ts:48-51`; lines re-confirmed per Finding 4 table (education student-lessons shifted :28→:32; admin fmtDate :49→:53; `admin/page.tsx:7` INHERITED, not re-read).
  - Resolved 1921 finding: `schema.ts:85` uniqueIndex; `0001_early_toad_men.sql:1-2`; transactional grant/revoke `repositories.ts:127-155`; race tests `db-persistence.test.ts:122-141`, `db-real-postgres.test.ts:78-91`.
  - Gate chain + scope: `package.json:13-27`; `vitest.config.ts:8-9` (14 files discovered); `tsconfig.json:8-13` (apps/web excluded from root typecheck); `.secretlintrc.json` + `.secretlintignore`; canonical 10-gate order from `20260529-2228-gate-repro-auditor.md:133-143`.
  - e2e: `playwright.config.ts:7-26`, `tests/e2e/smoke.spec.ts:6-61`, `apps/web/package.json:8` (`dev:e2e`), `ci.yml:84-104` (e2e job has NO `DATABASE_URL`).
- **INHERITED (relied on, NOT re-run by me):** the historical "e2e 10/10" green result and the public-landing first-compile flake (`20260529-2228-frontend-build-e2e-auditor.md`); the KEK-fixture / `governance:check`-slotting findings from `20260529-2052-qa-ci-gates-auditor.md` (those are Part G, already landed per MEMORY Phase 1.6.1); `apps/web/src/app/admin/page.tsx:7` TV badge call site (not re-read this session — verify before editing).

## Next actions

Ordered for Part E (build) → Part D (tests) → Part F (gates):

1. **[Part E — LMS repos, prerequisite for LMS tests]** Add the Education/LMS section to `packages/db/src/repositories.ts` with the signatures in Finding 3, reusing `@wtc/lms` ownership/visibility rules (`packages/lms/src/index.ts:57-100`) and returning epoch-ms DTOs. Export is automatic via `index.ts:5`.
2. **[Part E — TV/LMS UI wiring, atomic]** Flip `backend.ts:48-51` to async DB wrappers; add `await` at all call sites in Finding 4 (re-verify `admin/page.tsx:7` first); add a Date→epoch-ms DTO normaliser (Finding 5) modelled on `rowToEntitlement`; move the fail-closed entitlement check to the server action (Finding 2); update the three "storage: in-memory (demo)" captions (`indicators:39`, `education:25`, `admin/tradingview-access:40`) to reflect DB-backed status. Decide + emit TV grant/revoke audit (Finding 6).
3. **[Part D — TV integration tests]** In `db-persistence.test.ts`, add `it()`s for admin list (`listAllTv`), `revokeTv`, sweep idempotency (2nd sweep → 0), and (if Finding 6 adopted) `tradingview.grant`/`.revoke` audit rows via `recentAuditEvents` — same style as `:109-119` and `:84-86`.
4. **[Part D — LMS integration tests]** Add create-course, list-teacher-courses, list-student-courses/lessons (ordered, published-only), and access-denied (`hasEducationAccess=false` → `[]`, unpublished course → `[]`) — using the seeded `teacher@wtc.local` + its course (`seed.ts:50`).
5. **[Part D — optional e2e]** Add memory-backed heading-level specs for `/app/indicators`, `/app/education`, `/teacher` (and one extra assertion on `/admin/tradingview-access`) per Finding 9; additive, no pixel baselines.
6. **[Part F — gates]** Run the 10-gate chain STRICTLY SEQUENTIALLY (governance:check → check:core → lint → typecheck → typecheck -w @wtc/web → test → secret:scan → coverage → build -w @wtc/web → e2e); `ci:local` alone is insufficient (no coverage/e2e). Generate any secret-shaped test fixture at runtime so `secret:scan` stays clean.
7. **[Part F — CI parity]** Either add `REAL_POSTGRES_DATABASE_URL` to the `gates` job `env:` in `ci.yml` (Finding 11; mind the double-migration caveat — distinct DB if needed) so the real-PG harness stops silently skipping, OR document it PENDING in STATUS.
