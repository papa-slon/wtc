# ecosystem-task-router handoff

_Epoch 20260530-1042. Phase 2.2 — Full LMS + Service Wiring + Docs Truth Cleanup. Read-only routing; no code edited. Operator persisted this file (the `ecosystem-task-router` agent type has no Write tool by design)._

## Scope

Classify Phase 2.2 work (PARTS A–H). Reconcile the RICH education spec (epoch 20260530-0925) against the LEAN Phase-2.1 schema that actually landed. Confirm write-ownership, name risk gates, supply PART-A doc-fix specifics, and recommend the minimum coherent one-session deliverable (Rule 7).

## Files inspected

- `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260530-0925-phase-2-1-platform-spine-product-surfaces.md`
- `docs/handoffs/20260530-0925-ecosystem-education-implementer.md`
- `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `packages/lms/src/index.ts`
- `apps/web/src/lib/{lms-types,backend,db-store,demo}.ts`
- `apps/web/src/app/teacher/{page,courses/page}.tsx`, `apps/web/src/app/admin/education/page.tsx`

## Files changed

None — read-only audit (advisory; operator persists this handoff).

## Findings

1. **[CRITICAL] Table count is 38, not 39.** 21 pre-0002 tables + 17 new in 0002 (the 18th item was an ALTER on the existing `tradingview_access_requests`, not a CREATE). `grep pgTable` counts 39 only because line 8 is the `import { pgTable, … }` line. Fix `39`→`38` in `NEXT_ACTIONS.md` (line ~44), `IMPLEMENTED_FILES.md` (lines ~48–49), and the STATUS "21 + 18" phrasing.
2. **[WARN] "12-agent" wording is honest and governance-passing** — the 0925 aggregate cites 12 per-agent files; governance counts cited handoffs (13 because the aggregate also links 1 prior-epoch handoff in Next-actions). No doc bug; the Phase-2.2 aggregate must cite its own-epoch (20260530-1042) handoffs.
3. **[HIGH] `NEXT_ACTIONS.md` "Phase 1.8 — Full LMS" entry is stale** — those tables/repos landed in Phase 2.1; remove/replace with the Phase-2.2 UI item.
4. **[HIGH] `STATUS.md` "Still NOT deployable" still references Phase-1.8 full LMS + the already-cleared `revoked_at`/`revoked_by` debt** — update to Phase 2.2 UI + drop the cleared debt.
5. **[HIGH] `pinned_links.owner_id` is NOT NULL in the landed schema; no `global` ownerType** — Phase 2.2 supports `teacher_profile`|`course` only; the student "community" card stays an honest placeholder (global = Phase 3).
6. **[HIGH] `lesson_progress` columns are `percent_complete`/`completed`/`last_accessed_at`** (not the spec's `state`/`progress_pct`/`last_seen_at`) — the service DTO derives `state`/`progressPct`/`lastSeenAt`; no migration.
7. **[MEDIUM] `enrollments` has no `source` column** — derive `source` from `entitlementId` null-ness in the DTO.
8. **[MEDIUM] `packages/lms` is the thin sync class; `demo.ts` imports it** — extend the class + keep barrel back-compat exports, or update `demo.ts` atomically.
9. **[MEDIUM] `backend.ts deniedLmsService` + `demo.ts lmsService` cover only 4 methods** — interface expansion is typecheck-enforced; extend all adapters atomically.
10–12. **[LOW] courses/lessons/materials lack rich columns** — derive/default in DTOs (level='beginner', tags=[], isFeatured=false, sortOrder, contentType from videoUrl, materialType from kind). No migration.

## Decisions

- **D1. LANDABLE = pragmatic full LMS on the existing 38-table schema; NO migration 0003.** Map the contract onto real columns via DTO adapters; route by **id**; defer rich columns (slug/level/tags/embed/file-meta/global-pinned/progress-state-machine) to a future migration 0003 (Phase 3), labelled TARGET.
- **D2. Migration 0003 explicitly deferred to Phase 3.**
- **D3. Minimum coherent deliverable:** PART A (truth) → PART B (`packages/lms` domain: errors/types/schemas/guards/mappers) → PART C (service + adapters wiring, typecheck-enforced) → PART D/E/F (teacher/student/admin UI on the landed repos) → PART H (tests). Repo additions limited to `getCourseStudentList`, `listTeacherProfiles`, `listLessonsForCourse` (single-writer = operator, in `repositories.ts`).
- **D4. Write-ownership:** shared files single-writer (operator): `repositories.ts` (only the 3 new reads), `lms-types.ts`, `db-store.ts`, `demo.ts`, `backend.ts`, `packages/lms/*`. Disjoint route trees: `app/teacher/**`, `app/(app)/app/education/**`, `app/admin/education/**`, `features/lms/**`. No `schema.ts`/migration edits.
- **D5. No one-file prototype** — domain logic in `packages/lms` + `features/lms`; pages are server-component shells + server actions.

## Risks

| Risk | Severity | Caught by | Mitigation |
|---|---|---|---|
| `deniedLmsService`/`demo.ts` missing new methods | P1 | typecheck | extend atomically with the interface |
| barrel refactor breaks `demo.ts` import of the thin class | P1 | typecheck | re-export old symbols from the new barrel |
| progress DTO loses startedAt/completedAt precision (no columns) | P2 | review | document the approximation; label TARGET |
| `getCourseStudentList` needs a join not in any repo | P2 | typecheck/runtime | add the one repo function (operator) |
| pinned `global` unsupported → community card placeholder | P3 | e2e | label honestly as Phase-3 |
| progress API route CSRF (JSON body, not FormData) | P1 | security | use form server-actions for mark-complete (reuse assertCsrf) or add `assertCsrfFromRequest` |

## Verification/tests

Gate sequence (in order): `governance:check` → `check:core` → `lint` → `typecheck` → `typecheck -w @wtc/web` → `secret:scan` → `test` → `coverage` → `db:generate` (expect 38 tables, "No schema changes") → `build -w @wtc/web` → `e2e`. `db:migrate`/`db:seed`/real-PG = NOT RUN (no `DATABASE_URL`). Mandatory LMS tests (PGlite): cross-teacher ownership (+admin bypass), entitlement fail-closed, unpublished fail-closed, enrollment idempotency, per-user progress isolation, markLessonComplete → course completion + `education.course_completed` audit, progress upsert.

## Next actions

PART A first (operator, no gate chain). Then PART B/C (operator-serial, typecheck after each adapter) → PART D/E/F (UI) → PART H (tests) → gates → aggregate citing every 20260530-1042 per-agent handoff. **Rule-7 stop boundary:** never leave `deniedLmsService`/`demo.ts` out of sync with the interface (breaks typecheck — not a valid stop). If budget degrades after the teacher+student vertical, Rule-7 the admin breadth with a precise follow-up.
