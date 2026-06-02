# ecosystem-tests-runner handoff

**Epoch:** 20260530-1042
**Phase:** 2.2 — Full LMS vertical (test plan + gate execution)
**Role:** Read-only audit — no code edited this wave.

---

## Scope

Phase 2.2 integration test plan + gate run. Covers:
1. Full gate execution (governance:check through e2e) on the current Phase 2.1 tree — every gate
   reported with the exact observed result.
2. Integration test plan keyed to the landed LMS repos in `packages/db/src/repositories.ts` and
   the new full LMS service contract from the education-implementer handoff.
3. E2e additions for the teacher/student/admin education flows.
4. Exact gate sequence with RUN vs NOT RUN annotated for this env (no DATABASE_URL).
5. Coverage risk: LMS service/route layer excluded from Vitest; push logic into packages.
6. DB-name safety guard status: NOT yet implemented (carried open finding from Phase 2.1).

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/TEST_PLAN_PHASE2.md`
- `docs/handoffs/20260530-0925-ecosystem-tests-runner.md` (prior wave)
- `docs/handoffs/20260530-0925-ecosystem-education-implementer.md` (LMS contract + 5 test cases)
- `tests/integration/db-0002.test.ts` (full — 19 tests: bots/education/TV/products/terminal/ops/billing)
- `tests/integration/db-persistence.test.ts` (full — 19 tests: Phase 1.5-1.7 repos + thin LMS)
- `tests/integration/db-real-postgres.test.ts` (full — safety guard status confirmed absent)
- `tests/e2e/smoke.spec.ts` (full — 8 tests × 2 projects = 16)
- `packages/db/src/repositories.ts` (lines 546-631: the landed LMS repos — teacher_profiles,
  enrollments, lesson_progress, pinned_links)
- `packages/entitlements/src/state-machine.ts` (full — default branch line 89 confirmed)
- `packages/auth/src/rbac.ts` (full — MATRIX confirmed; lesson/enrollment/material rows present)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### F-1 (OPEN, HIGH) — DB-name safety guard still absent from db-real-postgres.test.ts

**Evidence:** `tests/integration/db-real-postgres.test.ts` lines 47-54 — `beforeAll` creates the
postgres pool and immediately calls `sql.unsafe(readFileSync(...), 'utf8')` with no check on the
database name. The pattern `$env:REAL_POSTGRES_DATABASE_URL` comment on line 11 references `wtc_test`
by convention, but there is no code that enforces this. If the env var were set to a production URL,
the migrations would be applied to it.

This was F-2 in the prior wave (20260530-0925-ecosystem-tests-runner.md) and was documented as a
"Wave-2 implementer, HIGH priority" action. It was NOT implemented.

**Required fix (Phase 2.2 implementer — first action before any new test files):**
Insert as the first statement of `beforeAll`, before the `for (const f of files)` loop at line 51:
```ts
const dbName = new URL(URL as string).pathname.replace(/^\//, '');
if (!/^wtc_test(_[a-zA-Z0-9_]+)?$/.test(dbName)) {
  throw new Error(
    `SAFETY: real-PG harness refuses to run against '${dbName}'. ` +
    `Only wtc_test or wtc_test_* databases are permitted.`
  );
}
```
This guard must fire before `sql.unsafe(...)` is ever called.

### F-2 (HIGH) — state-machine.ts branch coverage at 43.47% (line 89 default branch untested)

**Evidence:** Coverage output line: `state-machine.ts | 74.57 | 43.47 | 100 | 74.57 | ...80-81,86-87,89`.
Line 89 is `default: return 'manual_review'` — the fail-closed collapse for an unknown status string.
This is the most safety-critical untested path in the entire codebase: if a DB row contains a
corrupted or future status value, this branch is the only guard that collapses to a non-granting
state. It is also the path that `nextStatus('BOGUS_STATE' as any, 'payment_succeeded')` must exercise.

No test in `packages/entitlements/src/engine.test.ts` currently hits this branch. The prior handoff
(F-4 in 20260530-0925) documented it; it was not fixed.

**Required test additions to `packages/entitlements/src/engine.test.ts`:**
- `nextStatus('UNKNOWN_STATE' as any, 'payment_succeeded')` must return `'manual_review'` (line 89).
- `nextStatus('none', 'payment_failed')` must return `'none'` (no-op branch at line 67 return current).
- `nextStatus('grace', 'subscription_canceled')` must return `'grace'` (no-op at line 78 return current).
- `isGranting('BOGUS')` must return `false` (already in `__smoke__`; needs a Vitest case too).

### F-3 (HIGH) — reconcileAllEntitlements (repositories.ts:389-401) is zero-covered

**Evidence:** Coverage output: `repositories.ts | 88.75 | 72.98 | 85.54 | 88.75 | ...83,689,768-777`.
Line 389 is `reconcileAllEntitlements`. It is called only by `apps/worker/src/jobs.ts` which is
excluded from Vitest. No integration test covers it.

**Required:** Add to the new `billing-entitlement-states.test.ts` integration test file:
seed an entitlement row with `currentPeriodEnd` and `graceUntil` both in the past, call
`reconcileAllEntitlements(db, now)`, assert `changed >= 1`, and verify the row's `status` in the DB
has been updated to `'expired'`.

### F-4 (HIGH) — LMS repos landed in Phase 2.1 but service-layer tests are absent

**Evidence:** `tests/integration/db-0002.test.ts` lines 102-141 confirm the following landed repos
are PGlite-tested at the repository layer: `createTeacherProfile`, `getTeacherProfile`,
`upsertEnrollment` (idempotency + per-user isolation), `upsertLessonProgress` (isolation),
`markEnrollmentComplete` (completed_at + audit), `createPinnedLink`/`listPinnedLinks`/`deletePinnedLink`.

What is NOT tested: the service-layer guards. The 5 mandatory test cases from the education-implementer
handoff (ownership guard, entitlement fail-closed, enrollment idempotency at service layer, per-user
progress isolation at service layer, markLessonComplete + checkCourseCompletion chain) all target the
`LmsService` interface — which does not yet exist as a concrete implementation. These 5 tests are
BLOCKED until `packages/lms` is refactored per D2 in the education-implementer handoff.

The repo-level analogs (db-0002.test.ts) are passing. The service-layer tests are the Phase 2.2 target.

### F-5 (MEDIUM) — upsertLessonProgress column name mismatch: repo uses percent_complete/completed; plan uses progress_pct/state

**Evidence:** `repositories.ts` line 596-600 uses `percentComplete` (string NUMERIC) and `completed`
(boolean). The education-implementer handoff Decision D3 mandates `progress_pct` (INTEGER) and
`state` ('started'|'completed') per EDUCATION_LMS_PLAN.md §4.6. The schema migration 0002 has
already been generated — check which column names landed.

**Impact on tests:** The 5 mandatory test cases in the education-implementer handoff assume `state`
and `progress_pct`. If `db-0002.test.ts` line 120 is already using `percentComplete` (it is —
`upsertLessonProgress(db, { ..., percentComplete: '50.00', completed: false })`), the service-layer
tests must use the actual schema, NOT the plan naming. The implementer must reconcile before writing
the service and its tests. Do not write service-layer tests assuming `state`/`progress_pct` without
first confirming the generated schema.

**Action:** Read `packages/db/migrations/0002_sour_paibok.sql` for the actual `lesson_progress`
column names before writing any Phase 2.2 service test.

### F-6 (MEDIUM) — No Phase 2.2 integration test files exist yet

**Evidence:** `tests/integration/` contains exactly 5 files: `csrf-coverage.test.ts`,
`check-governance.test.ts`, `db-real-postgres.test.ts`, `db-persistence.test.ts`, `db-0002.test.ts`.
None of the 10 planned Phase 2 test files exist. The 5 service-layer LMS test cases from the
education-implementer handoff have no corresponding test file.

### F-7 (MEDIUM) — packages/lms/src/index.ts is zero-covered (0% all metrics)

**Evidence:** Coverage output: `packages/lms/src | 0 | 0 | 0 | 0 | 1-106`. The thin in-memory
`LmsService` class is never exercised by Vitest (it is only used through `demo.ts` which is also
0%). The Phase 2.2 refactor (service/ + guards/ structure per D2) must bring this to coverage.
Push all business logic into `packages/lms` — the route layer uses it but Vitest cannot reach routes.

### F-8 (MEDIUM) — No Phase 2.2 e2e spec files exist

**Evidence:** `tests/e2e/` has exactly `smoke.spec.ts`. 20 screenshots exist (10 tests × 2 projects).
The education-specific e2e flows (teacher course create, student lesson progress, admin education
panel) are not covered. The existing smoke.spec.ts covers `/app/education` and `/teacher` at the
heading level only (lines 64-79).

### F-9 (LOW) — analytics normalization: metrics.ts branch at 90% (lines 177-178, 254, 270 uncovered)

**Evidence:** Coverage output: `metrics.ts | 100 | 90 | 100 | 100 | ...77-178,254,270`.
These are edge-case branches: single-point equity (no drawdown), firstEquity=0 guard, and ROI
undefined guard. The 13-test suite covers primary paths. These gaps do not affect LMS work directly.

**Required test additions to `packages/analytics/src/metrics.test.ts`:**
- Single-point equity curve: `computeDrawdown([{equity:1000}])` returns `maxDrawdownPct:0`.
- `firstEquity=0` edge case for ROI calculation (avoid divide-by-zero branch).

### F-10 (INFO) — governance:check current epoch is 20260530-0925 (Phase 2.1); Phase 2.2 aggregate not yet written

**Evidence:** `npm run governance:check` output: "current phase 20260530-0925". The Phase 2.2
aggregate handoff does not yet exist. This is expected (it is written at phase close). The
governance:check gate passes against the Phase 2.1 aggregate. When the Phase 2.2 aggregate is
written at epoch 20260530-1042, the governance:check gate must be re-run and confirmed green before
any Phase 2.2 gate is declared green.

---

## Decisions

1. All new integration tests use the PGlite harness pattern from `db-0002.test.ts` lines 34-51:
   `beforeAll` reads all `.sql` files from `packages/db/migrations/` in sort order, applies them
   via `pg.exec(...)`, then wraps with `drizzle(pg, { schema })`. Migration 0002 exists on disk
   (`0002_sour_paibok.sql`) — no `describe.skipIf` guard needed for any LMS table.

2. Service-layer LMS tests target the `LmsService` interface methods, not the repo functions
   directly. The repo tests are already in `db-0002.test.ts`. Phase 2.2 adds a new file
   `tests/integration/lms-service.test.ts` that instantiates the DB-backed LMS service with a
   PGlite `db` and calls service methods, asserting both the returned view types and the audit rows.

3. The DB-name safety guard (F-1) is a hard prerequisite: it must be added to
   `db-real-postgres.test.ts` BEFORE any Phase 2.2 work proceeds. It is a one-line gate.

4. `db:migrate` and `db:seed` remain NOT RUN until `DATABASE_URL` pointing at a real Postgres
   instance with known credentials is provided. Not a gate failure — an environment constraint.

5. Phase 2.2 does NOT change the DB schema (no migration 0003). `db:generate` confirms "No schema
   changes" and will continue to report that throughout Phase 2.2.

6. The real-PG harness (5 cases in `db-real-postgres.test.ts`) remains NOT RUN for the same reason
   as always. The Phase 2.2 harness additions (concurrent progress upsert race) should be guarded
   with the same `describe.skipIf(!run)` pattern.

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| lesson_progress column names in 0002 SQL do not match education-implementer plan (F-5) | P1 | Read 0002_sour_paibok.sql before writing any service test; reconcile the naming in the LmsService implementation |
| deniedLmsService in backend.ts covers only 4 thin methods; adding 18 more without extending it causes a typecheck failure | P1 | TypeScript compile enforces completeness; run typecheck gate immediately after any LmsService interface expansion |
| demo.ts in-memory adapter wraps only 4 thin methods; same TypeScript enforcement applies | P1 | Implement all methods in demo.ts atomically in the same diff as lms-types.ts expansion |
| checkCourseCompletion double-completion race: two concurrent markLessonComplete calls could write two audit rows | P1 | Use `UPDATE ... WHERE completed_at IS NULL` to make the enrollment update idempotent; the audit row uses the same enrollment.id so a unique constraint can prevent duplicates |
| embed_html XSS: sanitizeEmbedHtml must be called inside updateLesson before any DB write | P0 | Add a Vitest test that calls updateLesson with `<script>alert(1)</script>` and asserts the stored value does not contain `<script>` |
| Teacher ownership check bypassed at the route layer if RBAC check is skipped | P1 | Service method calls assertTeacherOwns internally; route layer cannot skip it by calling a repo directly — enforce this by only exporting LmsService, not individual repo functions from packages/lms |
| 0002 schema lesson_progress uses percent_complete/completed (db-architect spec); plan expects progress_pct/state (education plan §4.6) | P1 | db-0002.test.ts line 120 confirms the LANDED column names are percentComplete/completed; the education-implementer handoff Decision D3 says to use plan names — this is a contradiction that must be resolved before the service is written |
| DB-name guard absent (F-1) means a misconfigured REAL_POSTGRES_DATABASE_URL could run migrations against a production DB | HIGH | Add the guard as first action of Phase 2.2 implementer session |
| Coverage will drop if packages/lms is refactored but the new service methods are not covered by Vitest (they are only called from apps/web which is excluded) | MEDIUM | Push all business logic (guards, completion logic) into packages/lms; cover with lms-service.test.ts using PGlite injection |

---

## Verification / tests

### Gates run this session (all observed — no claims from memory)

| # | Gate | Command | Result | Evidence |
|---|------|---------|--------|----------|
| 1 | governance:check | `npm run governance:check` | PASS | 0 errors, 1 allowlisted warning (20260529-1921 historical); current phase 20260530-0925; 13 cited per-agent handoffs all present |
| 2 | check:core | `npm run check:core` | PASS | 7 smokes: entitlements 8, crypto 7, analytics 14, audit, auth, axioma-bridge 7, billing — all pass |
| 3 | lint | `npm run lint` | PASS | ESLint 9 flat config; exit 0; --max-warnings 0 |
| 4 | typecheck (packages) | `npm run typecheck` | PASS | `tsc --noEmit -p tsconfig.json`; exit 0 |
| 5 | typecheck (@wtc/web) | `npm run typecheck -w @wtc/web` | PASS | `tsc --noEmit`; exit 0 |
| 6 | secret:scan | `npm run secret:scan` | PASS | secretlint exit 0; no matches |
| 7 | test (Vitest) | `npm test` | PASS | **140 passed / 5 skipped (145)** across 18 files; 3.41s |
| 8 | coverage | `npm run coverage` | PASS | **33.21% stmts / 69.48% branch** (matches Phase 2.1 baseline — no new source added this wave) |
| 9 | db:generate | `npm run db:generate -w @wtc/db` | PASS | **38 tables** confirmed; "No schema changes, nothing to migrate" — schema in sync |
| 10 | build | `npm run build -w @wtc/web` | PASS | 40 routes compiled (31/31 pages + teacher skeleton routes + JWKS route); no type errors in build |
| 11 | e2e | `npx playwright test` | PASS | **16/16** (8 tests × desktop + mobile); 1.5m; no flake; 20 screenshots in `tests/e2e/screenshots/` |

### Gates NOT RUN (with reason)

| # | Gate | Reason |
|---|------|--------|
| 12 | `npm run db:migrate -w @wtc/db` | Requires `DATABASE_URL` pointing at a real Postgres instance. PG17 present at 127.0.0.1:5432 but credentials unknown to the build agent. Docker absent. |
| 13 | `npm run db:seed -w @wtc/db` | Same reason as db:migrate. |
| 14 | Real-PG harness (`REAL_POSTGRES_DATABASE_URL`) | Requires `REAL_POSTGRES_DATABASE_URL` set to a `wtc_test` or `wtc_test_*` database. Credentials unknown. The 5 cases inside `db-real-postgres.test.ts` skip automatically via `describe.skipIf(!run)`. The always-present availability test (1 case) passes. |

### Vitest test count breakdown (Phase 2.1 baseline — what the implementer inherits)

| File | Tests | Notes |
|------|-------|-------|
| `tests/integration/db-0002.test.ts` | 19 pass | PGlite; 0002 repos: bots/education/TV/products/terminal/ops/billing |
| `tests/integration/db-persistence.test.ts` | 19 pass | PGlite; Phase 1.5-1.7 repos + thin LMS |
| `tests/integration/db-real-postgres.test.ts` | 1 pass + 5 skip | Availability test passes; real-PG suite skips |
| `tests/integration/csrf-coverage.test.ts` | 3 pass | Static scan of 'use server' files |
| `tests/integration/check-governance.test.ts` | 7 pass | governance fixture self-tests |
| `packages/analytics/src/metrics.test.ts` | 13 pass | computeMetrics, computeDrawdown, combineMetrics |
| `packages/entitlements/src/engine.test.ts` | 11 pass | State machine, fail-closed, bundles, reconcileExpiry |
| `packages/auth/src/rbac.test.ts` | 3 pass | can(), canActOnOwned() |
| `packages/auth/src/csrf.test.ts` | 3 pass | CSRF token round-trip |
| `packages/auth/src/session.test.ts` | 4 pass | hashToken, session token shape |
| `packages/crypto/src/vault.test.ts` | 5 pass | AES-256-GCM round-trip, tamper, rotation |
| `packages/axioma-bridge/src/handoff.test.ts` | 5 pass | ES256 sign/verify, expiry, aud |
| `packages/axioma-bridge/src/es256.test.ts` | 7 pass | ES256 signer, JWKS public-only assertion |
| `packages/billing/src/stripe.test.ts` | 8 pass | Stripe webhook verify, idempotency |
| `packages/billing/src/provider.test.ts` | 3 pass | Provider mock round-trip |
| `packages/bot-adapters/src/adapters.test.ts` | 7 pass | Mock adapters, warning aggregation |
| `packages/config/src/env.test.ts` | 12 pass | KEK validation, secret quality guards |
| `packages/shared/src/env-guards.test.ts` | 10 pass | Base64, entropy, placeholder checks |

---

## Phase 2.2 integration test plan

All new files go in `tests/integration/`. Each uses the same PGlite harness from `db-0002.test.ts`.
Migration 0002 (`0002_sour_paibok.sql`) exists on disk — no `describe.skipIf` guard is needed.

**IMPORTANT before writing any test:** Read `packages/db/migrations/0002_sour_paibok.sql` to confirm
the exact `lesson_progress` column names (F-5). The repo uses `percentComplete`/`completed`; the
education plan uses `progress_pct`/`state`. Reconcile before writing any service-layer tests.

### File: `tests/integration/lms-service.test.ts` (new — 12 cases; mapped to education-implementer §Verification/tests)

This file tests the full `LmsService` interface after Phase 2.2 implements `packages/lms/src/service/`.
It instantiates the DB-backed adapter with a PGlite `db` handle.

| # | Case | Source | Assertion |
|---|------|--------|-----------|
| 1 | Ownership: teacher A cannot edit teacher B's course | education-implementer Test 1 | `updateCourse(actorUserId=userA, isAdmin=false, courseB.id, {...})` rejects with `OwnershipDenied` |
| 2 | Admin bypass: admin can edit any course | education-implementer Test 1 | `updateCourse(actorUserId=admin, isAdmin=true, courseB.id, {...})` resolves; audit row `education.course.updated` present with actorUserId=admin |
| 3 | Entitlement fail-closed: no education access → assertEducationAccess throws | education-implementer Test 2 | User with no entitlements: `assertEducationAccess(user.id, 'education', hasAccess)` rejects with `EntitlementDenied` |
| 4 | Fail-closed: listLessonsForStudent with hasEducationAccess=false returns [] | education-implementer Test 2 | Thin repo call `listLessonsForStudent(db, course.id, false)` returns `[]` |
| 5 | Enrollment idempotency at service layer: ON CONFLICT DO NOTHING | education-implementer Test 3 | `ensureEnrolled(user.id, course.id)` twice → second call returns same id; DB has exactly 1 row |
| 6 | Per-user progress isolation: user A's progress invisible to user B | education-implementer Test 4 | `upsertProgress(userA.id, ...)` then `getCourseProgress(userB.id, courseId)` returns progressPct=0 and completedLessons=0 |
| 7 | markLessonComplete sets state/completedAt on lesson_progress | education-implementer Test 5A | result.state='completed', result.completedAt defined, result.progressPct=100 |
| 8 | checkCourseCompletion: enrollments.completed_at set when all lessons complete | education-implementer Test 5B | enrollment row for (user, course) has completed_at not null after markLessonComplete on the only published lesson |
| 9 | checkCourseCompletion audit: education.course.completed row in audit_logs | education-implementer Test 5C | `recentAuditEvents(db, 1000)` contains row with action='education.course.completed' and actor_user_id=user.id |
| 10 | upsertProgress auto-complete at 95%: state transitions | education-implementer §Additional mandatory test | `upsertProgress(user.id, lesson.id, course.id, 95)` → result.state='completed'; second call at 100 does not reset completedAt |
| 11 | Unpublished course fail-closed: getLessonForStudent returns null | F-4 / education plan §getLessonForStudent | `getLessonForStudent(user.id, lesson.id)` for a lesson in an unpublished course returns null |
| 12 | Course ownership: teacher-only action on another teacher's course → OwnershipDenied at RBAC layer | rbac.ts + lms guard | `canActOnOwned(['teacher'], 'course', 'update', teacherB_id, teacherA_id)` returns false |

### File: `tests/integration/lms-full.test.ts` (new — repo-layer cases not yet covered by db-0002)

Complements `db-0002.test.ts`. Covers cases that require a fresh PGlite db to avoid cross-test
contamination from the shared `beforeAll` in `db-0002.test.ts`.

| # | Case | Assertion |
|---|------|-----------|
| 1 | createTeacherProfile: getTeacherProfile by userId only returns own profile | `getTeacherProfile(db, userB_id)` returns null when only userA has a profile |
| 2 | upsertEnrollment full chain: createCourse → upsertEnrollment → markEnrollmentComplete → listEnrollments | Enrollment row present; completedAt set; audit 'education.course_completed' present |
| 3 | createPinnedLink with global ownerType (ownerId=null) — if schema permits | Depends on F-5 resolution: owner_id nullable for global type |
| 4 | listPinnedLinks sort_order ordering: two links, assert DESC vs ASC return | Links returned in ascending sort_order |
| 5 | deletePinnedLink: is_active=false; listPinnedLinks excludes it; audit row present | Soft-delete confirmed |

### File: `tests/integration/billing-entitlement-states.test.ts` (new — addresses F-3)

Uses tables from 0000/0001. PGlite harness picks up 0002 automatically (no regression).

| # | Case | Assertion |
|---|------|-----------|
| 1 | grantProduct → hasAccess=true; revokeProduct → hasAccess=false | Standard grant/revoke flow |
| 2 | applyBillingEvent 'refunded' → status='refunded'; hasAccess=false | Billing state transition |
| 3 | applyBillingEvent 'chargeback' → status='chargeback'; hasAccess=false | |
| 4 | reconcileAllEntitlements (F-3 fix): seed row with past currentPeriodEnd and past graceUntil → status='expired'; changed>=1 | Exercises repositories.ts line 389 |
| 5 | Manual grant after revoked → status='active'; hasAccess=true | Manual override precedence |
| 6 | nextStatus('BOGUS_STATE' as any, 'payment_succeeded') → 'manual_review' | Fail-closed default branch (state-machine.ts line 89 — F-2 fix) |
| 7 | nextStatus('none', 'payment_failed') → 'none' | No-op branch |
| 8 | isGranting('BOGUS') → false | Type-safety for DB corruption |

### File: `tests/integration/rbac-matrix.test.ts` (new — pure in-process, no DB)

| # | Assertion | MATRIX row |
|---|-----------|------------|
| 1 | `can(['user'], 'lesson', 'create')` is false | lesson.create = ['teacher','admin'] |
| 2 | `can(['teacher'], 'lesson', 'create')` is true | lesson.create |
| 3 | `can(['teacher'], 'enrollment', 'manage')` is false | enrollment.manage = ['admin'] |
| 4 | `can(['admin'], 'enrollment', 'manage')` is true | |
| 5 | `canActOnOwned(['teacher'], 'course', 'update', 'tid1', 'tid2')` is false | ownership mismatch |
| 6 | `canActOnOwned(['admin'], 'course', 'update', 'x', 'y')` is true | admin bypass |
| 7 | `can(['user'], 'material', 'create')` is false | material.create = ['teacher','admin'] |
| 8 | `can(['user'], 'audit_log', 'read')` is false | audit_log.read = ['admin','support'] |
| 9 | `can(['support'], 'audit_log', 'read')` is true | |
| 10 | `can(['user'], 'bot_config', 'delete')` is false | bot_config has no delete key |
| 11 | `can(['admin'], 'entitlement', 'manage')` is true | |
| 12 | `can(['support'], 'entitlement', 'manage')` is false | entitlement.manage = ['admin'] |

---

## Phase 2.2 e2e additions

All specs in `tests/e2e/`. Dev server runs on `:3100` (in-memory — no DATABASE_URL). Assertions are
against structure/labels/demo state, NOT database persistence. Login credentials:
- `user@wtc.local` / `wtc-demo-pass-123` (student)
- `teacher@wtc.local` / `wtc-demo-pass-123` (teacher)
- `admin@wtc.local` / `wtc-demo-pass-123` (admin)

The existing `smoke.spec.ts` already covers `/app/education` heading and `/teacher` heading.
Phase 2.2 extends coverage with lesson/progress/admin education flows.

### File: `tests/e2e/education.spec.ts` (new — 8 tests × 2 projects = 16 additional e2e cases)

| Test | Login | Route | Key assertions |
|------|-------|-------|----------------|
| Student catalogue renders with in-memory badge | user | `/app/education` | `getByRole('heading', {name:'Lessons & materials'})` visible; `getByText('storage: in-memory (dev)')` visible (demo label honesty rule) |
| Student sees published course card | user | `/app/education` | `getByText('Risk Management Fundamentals')` visible (seeded course) |
| Student course detail page renders | user | `/app/education/[courseSlug]` | Lesson list heading visible; no 500 |
| Student cannot access teacher routes | user | `/teacher/courses/new` | 403 or redirect; NO teacher heading content visible |
| Teacher dashboard shows courses | teacher | `/teacher` | `getByRole('heading', {name:'Your courses'})` visible; seeded course card visible |
| Teacher course list page | teacher | `/teacher/courses` | Course list or placeholder visible; no 500 |
| Teacher course detail | teacher | `/teacher/courses/[id]` | Course heading visible or placeholder; no 500 |
| Admin education panel | admin | `/admin/education` | Heading visible; no 500; all courses visible |
| Screenshots | — | — | `education-student-{project}.png`, `teacher-courses-{project}.png`, `teacher-course-detail-{project}.png`, `admin-education-{project}.png` |

### Extend `tests/e2e/smoke.spec.ts` (add to existing 8 tests)

Add to the existing 8 smoke tests (not a new file — extend smoke.spec.ts):

| Test | Key assertions |
|------|----------------|
| `/app/support` renders | Support heading or form visible; no 500 |
| `/app/billing` renders | Billing heading visible; at least one entitlement row |
| `/app/bots/tortila/settings` renders | Settings heading visible; no 500; simulated-data banner present |

These 3 additions bring smoke.spec.ts to 11 tests × 2 projects = 22 e2e cases total.

### Minimum screenshot inventory for Phase 2.2 (all in tests/e2e/screenshots/)

Existing (Phase 2.1, 20 files): landing, pricing, app-overview, bot-tortila, axioma-terminal,
security, admin-entitlements, admin-tradingview, bots-combined, bot-tortila-safety — desktop + mobile.

Phase 2.2 additions (8 new names × 2 projects = 16 new files):
`education-student`, `teacher-courses`, `teacher-course-detail`, `admin-education`,
`billing-user`, `support-page`, `bot-settings-tortila`, `tv-admin-queue` — desktop + mobile.

---

## Gate sequence for Phase 2.2 (expected RUN vs NOT RUN)

| # | Gate | Command | Expected | Reason if NOT RUN |
|---|------|---------|----------|-------------------|
| 1 | governance:check | `npm run governance:check` | RUN | Zero-dep, fs-only; always runnable |
| 2 | check:core | `npm run check:core` | RUN | Zero-dep Node type-stripping smokes |
| 3 | lint | `npm run lint` | RUN | ESLint 9 flat config; no DB needed |
| 4 | typecheck (packages) | `npm run typecheck` | RUN | tsc --noEmit; no DB needed |
| 5 | typecheck (@wtc/web) | `npm run typecheck -w @wtc/web` | RUN | tsc --noEmit; no DB needed — KEY gate for deniedLmsService completeness |
| 6 | secret:scan | `npm run secret:scan` | RUN | secretlint; no DB needed |
| 7 | test (Vitest) | `npm test` | RUN | PGlite; no DB creds needed |
| 8 | coverage | `npm run coverage` | RUN | PGlite; target: >= 33.21% stmts / >= 69.48% branch |
| 9 | db:generate | `npm run db:generate -w @wtc/db` | RUN | No DB creds needed; confirms 38 tables, no 0003 |
| 10 | build | `npm run build -w @wtc/web` | RUN | No secrets needed at build time (instrumentation.ts not called during build) |
| 11 | e2e | `npx playwright test` | RUN | In-memory dev server; Chromium installed |
| 12 | db:migrate | `npm run db:migrate -w @wtc/db` | NOT RUN | No DATABASE_URL; PG17 credentials unknown to agent; Docker absent |
| 13 | db:seed | `npm run db:seed -w @wtc/db` | NOT RUN | Same reason as db:migrate |
| 14 | Real-PG harness | `REAL_POSTGRES_DATABASE_URL=... npm test` | NOT RUN | Credentials unknown; db-real-postgres.test.ts skips automatically |

---

## Coverage risk (Phase 2.2 specific)

| Path | Risk | Mitigation |
|------|------|-----------|
| `packages/lms/src/service/` (new Phase 2.2 code) | HIGH — zero Vitest coverage until tests land | `tests/integration/lms-service.test.ts` with PGlite injection covers service methods |
| `packages/lms/src/guards/ownership.ts` | HIGH — ownership guard is the most safety-critical LMS path | Cover assertTeacherOwns in lms-service.test.ts case 1 (OwnershipDenied) and case 2 (admin bypass) |
| `packages/lms/src/guards/entitlement.ts` | HIGH — fail-closed guard | Cover assertEducationAccess in lms-service.test.ts case 3 |
| `apps/web/src/app/(app)/app/education/[courseSlug]/` (new routes) | EXCLUDED from Vitest | Playwright education.spec.ts covers these routes |
| `apps/web/src/app/api/education/progress/route.ts` (new API route) | EXCLUDED from Vitest | Playwright test: POST /api/education/progress; assert 200 vs 403 |
| `apps/web/src/app/teacher/courses/[id]/` (placeholder → real) | EXCLUDED from Vitest | Playwright teacher flow covers heading visibility |
| `checkCourseCompletion` logic (inside upsertProgress txn) | MEDIUM — only exercised through service layer | lms-service.test.ts case 8 (completion audit) and case 10 (auto-complete at 95%) |
| `state-machine.ts` default branch (line 89) | HIGH — fail-closed for unknown status | billing-entitlement-states.test.ts case 6 |
| `reconcileAllEntitlements` (repositories.ts:389) | HIGH — zero coverage | billing-entitlement-states.test.ts case 4 |

---

## Real vs mock/dev tally update

The existing STATUS.md real-vs-mock tally is unchanged by this read-only wave. After Phase 2.2 implementation:

- **Will become real + Vitest-covered:** `packages/lms/src/service/` methods, ownership guard,
  entitlement guard, checkCourseCompletion — when `lms-service.test.ts` lands.
- **Remains in-memory dev (labeled):** `demo.ts` LMS adapter (new methods added but still in-memory);
  all LMS routes when no DATABASE_URL present — the storage-mode pill must be preserved on every
  new education route.
- **Remains NOT RUN:** `db:migrate`, `db:seed`, real-PG harness (no credentials).

---

## Next actions

1. (HIGH, F-1) Phase 2.2 implementer: add the DB-name safety guard to
   `tests/integration/db-real-postgres.test.ts` `beforeAll` as the FIRST statement before
   `sql.unsafe(...)`. Pattern: parse `new URL(URL).pathname.replace(/^\//,'')`, reject if not
   matching `/^wtc_test(_[a-zA-Z0-9_]+)?$/`. This is a one-liner gate that was documented in two
   consecutive handoffs and not implemented.

2. (HIGH, F-5) Phase 2.2 implementer: read `packages/db/migrations/0002_sour_paibok.sql` for the
   exact `lesson_progress` column names BEFORE writing any `LmsService` implementation or test.
   If the column names are `percent_complete`/`completed` (db-architect spec), the service layer
   must adapt (map to `progressPct`/`state` in DTOs). Do NOT write tests that assume `progress_pct`
   or `state` without confirming the schema.

3. (HIGH, F-2 + F-3) Phase 2.2 implementer: extend `packages/entitlements/src/engine.test.ts` with
   the 4 missing fail-closed branch cases (state-machine.ts line 89, no-op branches). Add
   `reconcileAllEntitlements` to `billing-entitlement-states.test.ts`.

4. (HIGH) Phase 2.2 implementer: refactor `packages/lms/src/` per education-implementer handoff
   Decision D2 (service/ + guards/ + schemas.ts + errors.ts). Barrel `index.ts` must re-export all
   thin class aliases for backward compat with `demo.ts` during the transition.

5. (HIGH) Phase 2.2 implementer: extend `apps/web/src/lib/lms-types.ts` with all 18 new methods of
   the full `LmsService` interface. Extend `deniedLmsService` in `backend.ts` for all 18 new methods.
   TypeScript typecheck gate will fail if any method is missing.

6. (MEDIUM) Phase 2.2 implementer: write `tests/integration/lms-service.test.ts` (12 cases),
   `tests/integration/lms-full.test.ts` (5 cases), `tests/integration/billing-entitlement-states.test.ts`
   (8 cases), `tests/integration/rbac-matrix.test.ts` (12 cases).

7. (MEDIUM) Phase 2.2 implementer: write `tests/e2e/education.spec.ts` (8 tests × 2 projects)
   alongside the new education route implementations. Extend `smoke.spec.ts` with 3 additional
   cases (support, billing, bot-settings).

8. (MEDIUM) Phase 2.2 implementer: extend `packages/analytics/src/metrics.test.ts` with the 2
   missing edge-case branches (single-point equity, firstEquity=0 ROI guard — F-9).

9. Operator: after all Phase 2.2 gates are green, write the Phase 2.2 aggregate handoff at
   `docs/handoffs/20260530-<HHMM>-phase-2-2-full-lms.md` linking this per-agent handoff by path.
   Then re-run `npm run governance:check` to confirm the new aggregate is the current phase and
   all cited handoffs are present.

10. Future: provide `REAL_POSTGRES_DATABASE_URL=postgres://<creds>@127.0.0.1:5432/wtc_test` to
    enable gate 14 (real-PG harness with the new 5 cases). After the DB-name guard (action 1)
    lands, this is safe to run.
