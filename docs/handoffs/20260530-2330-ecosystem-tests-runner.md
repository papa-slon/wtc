# ecosystem-tests-runner handoff

## Scope

PG7 (LMS) pre-implementation audit — full gate sequence, regression risk analysis for the
LMS RBAC-throw + CSRF-first changes, e2e user flow inspection, NOT-RUN ledger, and exact
test specifications for new PG7 test cases. This is the read-only tests-runner agent for the
PG7 fan-out.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/handoffs/20260530-2230-phase-2-9-axioma-es256-jti-store.md`
- `docs/EXECUTION_PLAN_MASTER.md` (W8 / PG7 entry)
- `docs/ROADMAP_MASTER.md` (§7 Education/LMS)
- `docs/PRODUCTION_BLOCKERS.md`
- `apps/web/src/features/lms/actions.ts`
- `apps/web/src/lib/csrf.tsx`
- `apps/web/src/lib/session.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/app/(app)/app/education/[courseId]/page.tsx`
- `apps/web/src/app/teacher/layout.tsx`
- `packages/lms/src/index.ts`
- `packages/lms/src/guards.ts`
- `packages/audit/src/audit.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/security-headers.spec.ts`
- `tests/integration/lms-service.test.ts`
- `tests/integration/lms-fixes.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/integration/admin-ops-rbac.test.ts`
- `packages/lms/src/lms.test.ts`
- `playwright.config.ts`
- `vitest.config.ts`
- `package.json`

## Files changed

None — read-only audit.

## Gate results (RUN this session — observed, not assumed)

All gates were executed and results observed directly.

| Gate | Command | Result | Count |
|------|---------|--------|-------|
| lint | `npm run lint` | PASS | exit 0 |
| typecheck (packages) | `npm run typecheck` | PASS | exit 0 |
| typecheck (web) | `npm run typecheck -w @wtc/web` | PASS | exit 0 |
| unit + integration tests | `npm test` | PASS | 394 passed / 8 skipped (402) across 37 test files |
| e2e (Playwright) | `npx playwright test` | PASS | 36/36 — 35 clean + 1 flaky auto-retried green (see F-01) |

Gates NOT RUN this session (with reasons — see NOT-RUN ledger below):
- `npm run governance:check` — not run this pass (read-only audit; operator runs this after implementation)
- `npm run check:core` — not run this pass (read-only audit)
- `npm run secret:scan` — not run this pass
- `npm run coverage` — not run this pass
- `npm run db:generate -w @wtc/db` — not applicable (no schema changes expected unless rich migration lands)
- `npm run build -w @wtc/web` — not run this pass
- `db:migrate`, `db:seed`, real-PG harness — NOT RUN (B1: no `DATABASE_URL`; PGlite is not a substitute)
- `npm ci` — NOT RUN (node_modules already present; network unavailability not verified)

## Findings

### F-01 — info — Known dev-race flake on mobile, auto-retried green
**Evidence:** `tests/e2e/smoke.spec.ts:269` — `[mobile] Phase 2.4 E2E-31/32: bot/tortila` timed out
on first attempt (Server-Action recompilation race: `page.waitForURL` 60s timeout during login, retry
#1 passed in 4.6s). This is the documented dev-only race from Phase 2.6/PG11. `retries: 2` in
`playwright.config.ts:13` absorbs it. Not a regression; not a production issue.
**Recommendation:** Carry `retries: 2` forward. Document in the aggregate as: "1 flaky auto-retried
green (dev-only Server-Action recompilation race; not a production risk)".
**Target:** `playwright.config.ts` (no change needed)

### F-02 — high — LMS actions: CSRF called AFTER requireUser in all 9 actions
**Evidence:** `apps/web/src/features/lms/actions.ts:57-58` (createCourseAction), `:73-74`
(updateCourseAction), `:88-89` (setCoursePublishedAction), `:104-105` (createLessonAction),
`:119-120` (setLessonPublishedAction), `:135-136` (createMaterialAction), `:151-152`
(deleteMaterialAction), `:167-168` (enrollAction), `:182-183` (markLessonCompleteAction),
`:210-211` (adminEnrollAction). The file comment at line 4 says the canonical pipeline is
`assertCsrf -> Zod -> requireUser -> ...`, but the actual code calls `requireUser()` first then
`assertCsrf(formData)`. `assertCsrf` reads the session cookie independently (csrf.tsx:14 —
`currentSessionToken()` reads directly from `cookies()`, independent of `requireUser`), so it
CAN move first without breaking anything. This means a forged unauthenticated POST will authenticate
a user lookup before hitting CSRF validation — the wrong order per the security model.
**Recommendation (PG7 implementation):** Swap to: `await assertCsrf(formData)` as the FIRST
statement in every LMS action, before `await requireUser()`. Both calls are async and independent.
No behaviour change for legitimate flows; forged unauthenticated requests are rejected sooner.
**Target area:** `apps/web/src/features/lms/actions.ts`

### F-03 — high — LMS actions: 6 silent returns on RBAC/ownership/entitlement denial — no audit, no throw
**Evidence:**
- `apps/web/src/features/lms/actions.ts:60` — `if (!isTeacher) return;` (createCourseAction)
- `apps/web/src/features/lms/actions.ts:76` — `if (!isTeacher) return;` (updateCourseAction)
- `apps/web/src/features/lms/actions.ts:90` — `if (!isTeacher) return;` (setCoursePublishedAction)
- `apps/web/src/features/lms/actions.ts:107` — `if (!isTeacher) return;` (createLessonAction)
- `apps/web/src/features/lms/actions.ts:122` — `if (!isTeacher) return;` (setLessonPublishedAction)
- `apps/web/src/features/lms/actions.ts:137` — `if (!isTeacher) return;` (createMaterialAction)
- `apps/web/src/features/lms/actions.ts:153` — `if (!isTeacher) return;` (deleteMaterialAction)
- `apps/web/src/features/lms/actions.ts:82` — `if (!(await ownsCourse(...))) return;` (updateCourseAction)
- `apps/web/src/features/lms/actions.ts:97` — `if (!(await ownsCourse(...))) return;` (setCoursePublishedAction)
- `apps/web/src/features/lms/actions.ts:113` — `if (!(await ownsCourse(...))) return;` (createLessonAction)
- `apps/web/src/features/lms/actions.ts:129` — `if (!(await ownsCourse(...))) return;` (setLessonPublishedAction)
- `apps/web/src/features/lms/actions.ts:145` — `if (!(await ownsCourse(...))) return;` (createMaterialAction)
- `apps/web/src/features/lms/actions.ts:160` — `if (!(await ownsCourse(...))) return;` (deleteMaterialAction)
- `apps/web/src/features/lms/actions.ts:172` — `if (!access.allowed) return;` (enrollAction)
- `apps/web/src/features/lms/actions.ts:188` — `if (!access.allowed) return;` (markLessonCompleteAction)
- `apps/web/src/features/lms/actions.ts:212` — `if (!isAdmin) return;` (adminEnrollAction)

None of these writes an audit row or throws. The operator's spec is: write a denial audit row
(result:'denied') AND throw a forbidden error. Note: `requireUser()` and `assertCsrf()` already
throw — only the authz checks silently return.

There is NO `education.rbac_denied` or `education.entitlement_denied` audit code in
`packages/audit/src/audit.ts` (lines 80-96). Two new codes must be added:
`education.rbac_denied` and `education.entitlement_denied`.

**Recommendation (PG7 implementation):**
1. Add `education.rbac_denied` and `education.entitlement_denied` to `AUDIT_ACTIONS` in
   `packages/audit/src/audit.ts`.
2. Replace every `return;` after an RBAC/ownership/entitlement check with:
   `await audit.write({ actorUserId: user.id, actorRole: ..., action: 'education.rbac_denied',
   targetType: '...', result: 'failure', after: { reason: '...' } }); throw new AppError('forbidden', '...');`
   For entitlement denials use `education.entitlement_denied`.
3. `audit` must be imported from `@/lib/backend` in `features/lms/actions.ts`.
   It is already available via `backend.ts:63`.
**Target area:** `packages/audit/src/audit.ts`, `apps/web/src/features/lms/actions.ts`

### F-04 — medium — No denial audit code exists — test for it will fail until added
**Evidence:** `packages/audit/src/audit.ts:80-96`. The AUDIT_ACTIONS array contains all
`education.*` codes (course_create/update/publish/delete, lesson_*, material_*, teacher_profile_*,
enroll/enrolled/progress/course_completed, pinned_link_*) but has NO denial codes. A test that
asserts `result: 'denied'` (or `'failure'`) with a denial action against the audit store will
fail until F-03's codes are added. Tests for denial MUST be written only after the codes land.
**Recommendation:** The new test file (`tests/integration/lms-rbac-deny.test.ts` — see
Verification/tests below) must be written after the `education.rbac_denied` /
`education.entitlement_denied` codes land in `audit.ts`. Gate ordering: `audit.ts` code additions
come first (DB wave / audit wave), then the test file.
**Target area:** `tests/integration/lms-rbac-deny.test.ts` (new)

### F-05 — critical — E2E REGRESSION RISK ANALYSIS for LMS throw-on-denial (DETERMINED SAFE)
**Evidence and reasoning:**

(a) **Which user the e2e smoke uses:** `tests/e2e/smoke.spec.ts:6` — `login(page, 'user@wtc.local')`.
`user@wtc.local` has roles `['user']` (demo.ts:156) — no `teacher` role, no `admin` role. It DOES
have an active `education` entitlement (demo.ts:164).

(b) **Does any e2e test submit an LMS teacher action as user@wtc.local?**
Inspected every test block in smoke.spec.ts. The teacher-surface tests (`smoke.spec.ts:78`,
`smoke.spec.ts:85`) log in as `teacher@wtc.local`, NOT as `user@wtc.local`. They do NOT submit
any create/update/publish form — they only navigate to the route and assert headings/copy.
No `enrollAction` or `markLessonCompleteAction` form is submitted by any e2e test (the course
detail page at smoke.spec.ts:96 navigates to the course detail page in demo mode, which renders
the `storage: in-memory (demo)` banner BEFORE any form — the form is never reached because
`lmsMode() === 'demo'` returns early at `apps/web/src/app/(app)/app/education/[courseId]/page.tsx:24`).

(c) **In demo mode: does the throw fire before the db-null check?**
In the current silent-return pattern, RBAC/entitlement checks fire BEFORE the `getServerDb()`
null-check in every action. After the PG7 throw-on-denial change:
- For teacher actions (e.g. `createCourseAction`): a `user@wtc.local` actor would hit
  `if (!isTeacher) [THROW]` BEFORE `const db = getServerDb()`. No DB null-check is reached.
  The throw would happen whether or not db is null.
- However: NO e2e test submits a teacher action as user@wtc.local (confirmed above).
  Teacher pages are guarded by `TeacherLayout` (teacher/layout.tsx:8-9) which redirects
  non-teacher users to `/app` before the page renders — so no teacher form is ever submitted
  by user@wtc.local in the e2e suite.
- For student actions (`enrollAction`, `markLessonCompleteAction`): user@wtc.local HAS an
  active education entitlement (demo.ts:164), so `access.allowed` is TRUE. No throw fires.
  These actions would NOT regress even if submitted — but they are NOT submitted in the e2e.

**VERDICT: The PG7 throw-on-denial changes are E2E-SAFE with zero changes to the e2e suite.**
The page-level guard (TeacherLayout redirect) prevents non-teachers from ever seeing teacher
forms. The student entitlement check passes for user@wtc.local. No form submission in the e2e
suite exercises a denial path.

**Target area:** `tests/e2e/smoke.spec.ts` (no changes required)

### F-06 — medium — csrf-coverage.test.ts: static check passes today but does not verify ordering
**Evidence:** `tests/integration/csrf-coverage.test.ts:27-36`. The static check counts
`assertCsrf(` occurrences per file and requires at least as many as there are action functions.
This passes today. But it does NOT verify that assertCsrf is called BEFORE requireUser. After
the PG7 CSRF-first change, the ordering guarantee needs a new test or a static scan that parses
the actual call sequence.
**Recommendation:** Add a new static test in `csrf-coverage.test.ts` (or a new file) that scans
`apps/web/src/features/lms/actions.ts` and asserts that in each exported async function,
the first `await` statement matches `assertCsrf`. A regexp scan
`/export async function \w+.*?{.*?await (\w+)/s` per function block is sufficient for this
file-level guarantee.
**Target area:** `tests/integration/csrf-coverage.test.ts` (additive test) or new file

### F-07 — low — No unit test for the `ownsCourse` helper returning false → silent return (pre-PG7)
**Evidence:** `apps/web/src/features/lms/actions.ts:39-49`. The `ownsCourse` helper catches
`assertTeacherOwns` and returns false. `@wtc/lms` unit tests (`packages/lms/src/lms.test.ts:17`)
test `assertTeacherOwns` throwing correctly, but no test exercises `ownsCourse` specifically
in the action context (it wraps assertTeacherOwns in a try/catch). After PG7, the `ownsCourse`
helper will still be used but the caller will throw on `false` — the helper itself is fine, but
the integration between the helper and the throw should be tested.
**Recommendation:** The new `lms-rbac-deny.test.ts` (see Verification/tests) should include a
case where an authenticated teacher calls an action on another teacher's course and the ownership
denial throws + audits (verifying the throw comes from the action layer, not just from the guard).
**Target area:** `tests/integration/lms-rbac-deny.test.ts` (new)

### F-08 — info — Rich LMS migration (0005): verdict DEFER to Phase 3
**Evidence:** ROADMAP_MASTER.md:82 — "only if bounded+tested, else Phase-3 plan". PG7 scope
assessment: the candidate columns (slug, level, tags, content_type, embed_html, file size/mime,
global pinned_links, lesson_progress state machine) ALL have no live consumer this phase. The
rich UI (embed players, file upload, global links, auto-progress, slug URLs) is explicitly
Phase-3 per the established dead-code-avoidance discipline (PG4 checkout, PG6 signer resolver
precedents). File upload is additionally BLOCKED on an upload security review (ROADMAP §7).
**Recommendation:** Do NOT land migration 0005 in PG7. Document as Phase-3 plan. The
`db:generate` gate should report "No schema changes" / still 41 tables after PG7.
**Target area:** docs/ROADMAP_MASTER.md (update status), no schema files

## Decisions

1. **Rich LMS migration 0005: DEFER (Phase-3 plan).** No schema changes in PG7. Dead-code-avoidance
   discipline is binding; zero consumers exist this phase. Gate target: `db:generate` = "No schema
   changes", 41 tables.

2. **New audit codes needed before tests:** `education.rbac_denied` and `education.entitlement_denied`
   must land in `packages/audit/src/audit.ts` BEFORE the new `lms-rbac-deny.test.ts` is written.
   Ordering: audit codes (impl wave) → lms actions throw-on-denial (impl wave) → new tests.

3. **E2e suite: no changes required.** The throw-on-denial change is safe for all 36 existing
   Playwright tests. No new e2e tests needed for PG7 (the LMS mutation surfaces are in demo mode
   and teacher forms require teacher@wtc.local; neither path exercises a denial in the current suite).

4. **CSRF-first change: safe for csrf-coverage.test.ts.** The existing static counter check
   still passes. An additive ordering check should be added.

## Risks

1. **If a teacher action is called in a context where `audit.write` throws** (e.g. in-memory demo
   mode the audit writer does NOT throw — it's the memory writer. In DB mode `audit.write` calls the
   DB writer which throws if `DATABASE_URL` is missing in production — but that is the desired
   fail-closed behaviour). No additional risk from the throw-on-denial change.

2. **`AppError` import.** `actions.ts` currently does not import `AppError`. The throw must use a
   consistent error type. `AppError` is available from `@wtc/shared`. If the implementation uses a
   plain `Error`, the e2e would still not regress (the error is server-side), but type consistency
   matters for the `result: 'failure'` audit entry.

3. **The `result` field on `AuditInput`.** `packages/audit/src/audit.ts:136-146` — `result?:
   AuditResult` defaults to `'success'` at line 159. The denial audit must explicitly pass
   `result: 'failure'` (not the string `'denied'` — `AuditResult` only accepts `'success'|'failure'`).
   The STATUS.md references `result:'denied'` in prose but the actual type is `'failure'`. Implementer
   must use the typed value `'failure'`. (Separately, the `audit_logs` DB table has `result` with
   `default 'success'` — the column accepts any string per the Drizzle schema but the TS type is
   narrower. The `'failure'` value is correct for both.)

4. **`audit` import in `features/lms/actions.ts`.** The `audit` export from `@/lib/backend`
   (`backend.ts:63`) is already the correct in-memory-or-DB-or-denied writer. It must be imported
   into `actions.ts`. This is a new import line — low risk.

5. **Retries:2 carry-forward.** The PG7 implementation will likely add new server actions that could
   trigger the dev-only Server-Action recompilation race. `retries: 2` in `playwright.config.ts:13`
   must be preserved. Any PG7 e2e additions should follow the existing pattern.

## Verification/tests

### New test file: `tests/integration/lms-rbac-deny.test.ts` (PGlite + in-memory audit sink)

This test file must be created AFTER the implementation wave lands the throw-on-denial changes
and the two new audit codes. It should cover:

**LMS-DENY-001 — RBAC denial writes audit row (result:'failure') + throws**
- Setup: create a user with roles=['user'] (no teacher/admin). Call a teacher action (e.g.
  `createCourseAction`-equivalent logic via the guard directly) and verify:
  a. The call throws (not a silent no-op).
  b. An audit event with `action:'education.rbac_denied'` and `result:'failure'` exists in the
     audit sink.
- Implementation note: since actions are Next.js server actions (import 'use server'), they cannot
  be imported directly in Vitest. Test the GUARD layer (`assertTeacherOwns`, `assertEducationAccess`)
  and the audit-write logic via a pure helper extracted from the action, OR test via a thin wrapper
  function that the implementation exposes. Alternatively, test the complete path through the
  `@wtc/lms` guards + a mock audit writer (no PGlite needed for the RBAC check itself).

**LMS-DENY-002 — CSRF-first ordering: missing CSRF token is rejected before requireUser**
- Setup: call `assertCsrf` with empty FormData (no `csrf` field) directly.
- Verify: throws `AppError('forbidden', 'CSRF validation failed')` (csrf.tsx:34).
- Verify: this is a pure unit test — no DB, no user lookup. `assertCsrf` reads the session cookie
  independently (currentSessionToken() via `cookies()`). In a unit test context, mock `cookies()`
  to return a known session token, then assert the mismatch throws before any user lookup occurs.
- Target: demonstrates CSRF fires first (the ordering guarantee).

**LMS-DENY-003 — Ownership denial writes audit row + throws (teacher editing another teacher's course)**
- Setup (PGlite): create teacherA, teacherB, course owned by teacherA. Simulate teacherB calling
  a course-mutation action on teacherA's course.
- Verify: throws (not silent return).
- Verify: audit row `action:'education.rbac_denied'`, `actorUserId: teacherBId`, `result:'failure'`.

**LMS-DENY-004 — Entitlement denial writes audit row + throws (student without education access)**
- Setup (PGlite or in-memory): user with no `education` entitlement (or expired). Simulate calling
  `enrollAction`-equivalent (the guard: `accessFor → access.allowed === false`).
- Verify: throws.
- Verify: audit row `action:'education.entitlement_denied'`, `result:'failure'`.

**LMS-DENY-005 — Legit teacher path does NOT throw (regression guard)**
- Setup (PGlite): teacherA creates course, calls update on own course.
- Verify: does NOT throw. Verify audit row has `result:'success'`.

**LMS-DENY-006 — Legit student path does NOT throw (regression guard)**
- Setup (PGlite): user with active education entitlement, published course.
- Verify: `enrollAction`-equivalent does NOT throw. Verify progress audit row written.

### Static test addition: CSRF ordering in LMS actions (additive to csrf-coverage.test.ts)

Add a test that reads `apps/web/src/features/lms/actions.ts`, extracts each exported async function
body, and asserts that the first `await` call in the function body is `assertCsrf`. A line-number
scan: assert that the line number of the first `assertCsrf(` occurrence in the function is LOWER
than the first `requireUser(` occurrence. This is a static text scan — no execution required.

## Full gate sequence for the PG7 close

Run in this order. All must be green before the aggregate handoff is written.

1. `npm run governance:check` — validates the 5+ per-agent handoffs at the PG7 epoch are cited.
2. `npm run check:core` — 7 smoke tests (pure packages; zero-install).
3. `npm run lint` — ESLint exit 0, max-warnings 0.
4. `npm run typecheck` — packages tsconfig.
5. `npm run typecheck -w @wtc/web` — web tsconfig.
6. `npm run secret:scan` — secretlint; no new secrets.
7. `npm test` — Vitest (currently 394/8/402); after PG7 expect +6 to +10 new tests from
   `lms-rbac-deny.test.ts` + csrf-ordering static test. Total should exceed 400 passed.
8. `npm run coverage` — check stmts/branch do not drop (current: 27.2% / 74.32%).
9. `npm run db:generate -w @wtc/db` — expect "No schema changes" / 41 tables (no 0005 migration).
10. `npm run build -w @wtc/web` — full Next.js build.
11. `npx playwright test` — 36/36 (retries:2 carry; 1 dev-race flake expected/benign).

## NOT-RUN ledger (standing — every phase close)

| Gate | Reason skipped |
|------|---------------|
| `db:migrate -w @wtc/db` (real Postgres) | B1: no `DATABASE_URL` / no Docker; PGlite is NOT a substitute |
| `db:seed -w @wtc/db` (real Postgres) | B1: same |
| `tests/integration/db-real-postgres.test.ts` cross-connection / migration tests | B1: same; 7 of 11 cases are `skipIf(!REAL_POSTGRES_DATABASE_URL)` |
| Stripe checkout / live charge | B2: no Stripe test keys; billing provider undecided (Q-2) |
| Axioma ES256 activation (P-256 key + journal endpoints + CTAs) | B4: P-256 key unprovisioned (OP) + endpoint shapes unconfirmed (EXT) |
| `npm ci` | node_modules already present; network availability not verified in this environment |
| CI/CD (.github/workflows/ci.yml) | B6: not a git repo; workflow never executed |

## Next actions

1. (Operator / implementation) Land `education.rbac_denied` and `education.entitlement_denied`
   in `packages/audit/src/audit.ts` — single line addition each.
2. (Implementation) In `apps/web/src/features/lms/actions.ts`:
   a. Import `audit` from `@/lib/backend` and `AppError` from `@wtc/shared`.
   b. Move `assertCsrf(formData)` to FIRST in every action (before `requireUser()`).
   c. Replace every silent `return;` after RBAC/ownership/entitlement check with:
      `await audit.write({ actorUserId: user.id, actorRole: '...', action: 'education.rbac_denied',
      targetType: '...', result: 'failure', after: { reason: '...' } }); throw new AppError('forbidden', '...');`
      Use `education.entitlement_denied` for access.allowed=false paths.
3. (Tests) Write `tests/integration/lms-rbac-deny.test.ts` with 6 cases (LMS-DENY-001..006).
4. (Tests) Add CSRF-ordering static assertion to `tests/integration/csrf-coverage.test.ts`.
5. (Operator) Run the full gate sequence above. All must be green before PG7 aggregate handoff.
6. (Operator) Update `docs/STATUS.md` real-vs-mocked tally (see below).
7. Rich LMS migration (0005): document as Phase-3 plan in ROADMAP_MASTER.md §7.

## STATUS.md real-vs-mocked tally update (post-PG7)

After PG7 implementation, add to the "Real + verified" section:
- LMS RBAC denial: `education.rbac_denied` / `education.entitlement_denied` audit row written +
  action throws on RBAC/ownership/entitlement denial — PGlite-tested (LMS-DENY-001..004).
- LMS CSRF-first ordering: `assertCsrf` fires before `requireUser` in all LMS actions —
  static-scan-verified (csrf-coverage.test.ts addition).
- LMS legit paths: teacher and student happy paths still work after throw-on-denial
  refactor — PGlite-tested (LMS-DENY-005..006).
