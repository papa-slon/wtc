# ecosystem-devops-implementer handoff

_Epoch 20260530-1042. Phase 2.2 — Full LMS read-only audit. Environment declarations, local run
story, migration status, CI status, and table-count truth check for the Full LMS vertical._

## Scope

Phase 2.2 builds the Full LMS UI vertical on the Phase 2.1 landed codebase. This audit confirms:

1. No new required env var is introduced (LMS uses the existing DB + entitlements; material file
   upload is a dev stub, no S3/storage provider is wired this phase).
2. The local run story is unchanged: `npm run dev` renders LMS surfaces in honest demo mode without
   any DB credential; `npm test` (PGlite) covers LMS repos with no DB creds; `db:migrate`/`db:seed`
   = NOT RUN (no `DATABASE_URL`, Docker absent).
3. No new migration (0003) is needed this phase; the schema already contains all LMS tables
   (`enrollments`, `lesson_progress`, `teacher_profiles`, `pinned_links`) as of migration 0002.
4. CI stays inert (not a git repo); `ci:local` is the equivalent; no new CI step blocks this phase.
5. TRUTH: `schema.ts` declares exactly 38 tables (the import line at line 8 inflates a naive grep
   count to 39); three docs incorrectly say 39.

## Files inspected

- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/DEPLOYMENT.md`
- `docs/handoffs/20260530-0925-ecosystem-devops-implementer.md` (prior Phase 2.1 devops handoff)
- `.env.example`
- `packages/config/src/env.ts` (loadEnv Zod schema — lines 13-66)
- `apps/web/instrumentation.ts` (boot loadEnv)
- `packages/db/drizzle.config.ts`
- `packages/db/migrations/meta/_journal.json`
- `packages/db/migrations/0000_broken_jack_murdock.sql` (CREATE TABLE count: 21)
- `packages/db/migrations/0001_early_toad_men.sql` (no new tables — index fix only)
- `packages/db/migrations/0002_sour_paibok.sql` (CREATE TABLE count: 17; ALTERs: 3 cols + 1 CHECK)
- `packages/db/src/schema.ts` (all 38 pgTable declarations — lines 15-585)
- `packages/db/src/repositories.ts` (LMS repos: enrollments, lessonProgress, teacherProfile,
  pinnedLinks — lines 546-612; thin Part-E repos — lines 317-366)
- `package.json` (root scripts — check:core, ci:local, db:*, test, dev)
- `packages/lms/src/index.ts` (in-memory LmsService — synchronous Map-backed)
- `packages/lms/package.json`
- `apps/web/src/lib/lms-types.ts` (async LmsService interface — 4-method thin contract)
- `apps/web/src/lib/backend.ts` (fail-closed selector; deniedLmsService stub)
- `apps/web/src/app/(app)/app/education/page.tsx` (student catalogue — entitlement-gated)
- `apps/web/src/app/(public)/education/page.tsx` (public marketing page)
- `apps/web/src/app/admin/education/page.tsx` (Placeholder — safe to fill)
- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/teacher/courses/page.tsx` (Placeholder)
- `apps/web/src/app/teacher/courses/[id]/page.tsx` (Placeholder)
- `apps/web/src/app/teacher/materials/page.tsx` (Placeholder)
- `apps/web/src/app/teacher/students/page.tsx` (Placeholder)
- `tests/integration/db-0002.test.ts` (PGlite suite covering Phase 2.1 repos including LMS)
- `docs/EDUCATION_LMS_PLAN.md` (material file-upload stub status: lines 24-25, 990-991)
- `docs/handoffs/20260530-0925-ecosystem-education-implementer.md` (Full LMS contract spec)
- `docs/IMPLEMENTED_FILES.md` (table count: line 48-49)
- `docs/NEXT_ACTIONS.md` (table count: line 44)

## Files changed

None — read-only audit (this handoff only).

## Findings

### 1. [CONFIRMED] Phase 2.2 introduces NO new required env var

**Evidence:** `packages/config/src/env.ts` (lines 13-66) — the Zod schema contains no LMS-specific
env var. The LMS vertical uses:

- `DATABASE_URL` — already required (line 17); wires to `@wtc/db` LMS repos when set
- `SESSION_SECRET`, `SECRET_VAULT_KEK` — already required (lines 19-20)
- All billing and Axioma vars are unchanged from Phase 2.1

Material file upload (`packages/lms/src/index.ts` — `Material.kind = 'file'`) is a **dev stub
only**. The `materials` table (`schema.ts:195`) stores `url` as a plain text column; no `file_key`,
no S3 key, no bucket reference exists in the current schema. The `EDUCATION_LMS_PLAN.md:990-991`
explicitly marks this as "Interface + S3 adapter stub / Wire real S3/R2 bucket in Phase 4 devops".
No `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `R2_ACCOUNT_ID`, or any storage var
is required this phase. None appears in `env.ts` or `.env.example`.

**Verdict: zero new env vars required for Phase 2.2.**

### 2. [CONFIRMED] Local run story unchanged — LMS surfaces render in honest demo mode

**`npm run dev` (in-memory, no DB, no new secrets):**

`apps/web/src/lib/backend.ts:20-35` — `useDb = !!process.env.DATABASE_URL`. When `DATABASE_URL` is
absent (the default dev path), `backendMode = 'memory'` and `lmsService` is the in-memory adapter
(`demo.ts`). The education page (`app/education/page.tsx:24-26`) shows a `StatusPill` with
`tone="warn"` and the label "storage: in-memory (dev)" rather than silently serving stale data.
The in-memory store is pre-seeded with one demo course and one lesson by `demo.ts:171-172`. No
additional env var is needed; the page renders honestly without any DB.

**`npm test` (PGlite, no DB creds):**

`tests/integration/db-0002.test.ts` applies all three migration SQL files via `PGlite` (in-process,
no server) and exercises the full Phase 2.1 / Full LMS repos: `createTeacherProfile`,
`upsertEnrollment`, `listEnrollments`, `markEnrollmentComplete`, `upsertLessonProgress`,
`getLessonProgress`, `listCourseProgress`, `createPinnedLink`, `listPinnedLinks`, `deletePinnedLink`.
No `DATABASE_URL` or network access is required. `npm test` stays green without any DB credential.

**`db:migrate` / `db:seed` = NOT RUN:**

No `DATABASE_URL` is set on this host; Docker is absent; native PostgreSQL 17 credentials are not
provided to this agent. These commands are deferred per the hard rule in `docs/DEPLOYMENT.md`. The
operator must follow the throwaway-DB flow (DEPLOYMENT.md "Real-Postgres integration harness")
before running these against any non-throwaway database.

### 3. [CONFIRMED] No migration 0003 needed for Phase 2.2

**Evidence:** `packages/db/src/schema.ts` already contains all tables the Full LMS contract
requires as of migration 0002:

- `teacher_profiles` (schema.ts:383; 0002 SQL:155) — teacher identity extension
- `enrollments` (schema.ts:400; 0002 SQL:84) — student enrollment per course
- `lesson_progress` (schema.ts:418; 0002 SQL:93) — per-user, per-lesson progress (UPSERT)
- `pinned_links` (schema.ts:437; 0002 SQL:115) — teacher/course community links

The `courses` table already has `teacher_profile_id` (additive column added in 0002 SQL:228).
The `materials` table (`schema.ts:195`; 0000) stores `url` as plain text — adequate for the Phase
2.2 stub (link/embed types only; file upload deferred).

`packages/db/src/repositories.ts:546-612` already implements: `createTeacherProfile`,
`getTeacherProfile`, `updateTeacherProfile`, `upsertEnrollment`, `listEnrollments`,
`markEnrollmentComplete`, `upsertLessonProgress`, `getLessonProgress`, `listCourseProgress`,
`createPinnedLink`, `listPinnedLinks`, `deletePinnedLink` — all with in-transaction audit writes.

**No `db:generate` run is needed for Phase 2.2 unless a schema.ts edit is made. If the education
implementer adds any column or table, the operator must run `db:generate` (offline, no DB) and
review the produced SQL before applying it.** If the implementer stays within the existing schema
(which is the Phase 2.2 design intent), no 0003 is produced.

If a 0003 is generated (additive only — a hard rule), the rollback path is identical to 0002:
pg_dump before applying, restore from dump + redeploy prior build if rollback is needed. Never
write a "down" migration that drops tables or columns. Never run any destructive command against
0000/0001/0002 data.

### 4. [CONFIRMED] CI stays inert; no new CI step required

The repository has no `.git` directory and no GitHub remote (confirmed: `docs/DEPLOYMENT.md:75`).
`ci.yml` has never executed. This is unchanged from Phase 2.1.

The local equivalent is `npm run ci:local` (runs: `check:core`, `governance:check`, `lint`,
`typecheck` packages, `typecheck -w @wtc/web`, `secret:scan`, `npm test`, `build -w @wtc/web`).

Phase 2.2 introduces no new npm scripts and no new Docker services. The `check:core` command
(`package.json:25`) does NOT include a `packages/lms` smoke — `packages/lms` has no
`__smoke__.ts` file. This is a pre-existing gap (lms is a pure synchronous in-memory module;
its logic is indirectly exercised by `demo.ts` and by the PGlite suite). If Phase 2.2 adds
significant new logic to `packages/lms`, a `__smoke__.ts` should be added and wired into
`check:core`. This is a Phase 2.2 implementer task, not a blocker to starting the phase.

`governance:check` will require this handoff file to be present and cited in the aggregate phase
handoff. No other new CI requirement exists.

### 5. [TRUTH FLAG] schema.ts has 38 tables; three docs incorrectly say 39

**Evidence:**

Counting `export const X = pgTable(` declarations in `packages/db/src/schema.ts`:

- Lines 15-243: 21 tables (matches 0000 SQL `CREATE TABLE` count of 21)
- Lines 263-585: 17 tables (matches 0002 SQL `CREATE TABLE` count of 17)
- Migration 0001 (`0001_early_toad_men.sql`): 0 new tables — drops and recreates one UNIQUE INDEX only

Total: **38 tables across 3 migrations**.

The grep count of 39 includes the import line (`line 8: import { pgTable, ... } from
'drizzle-orm/pg-core'`), which matches the pattern but is not a table declaration.

**Docs claiming 39 that must be corrected:**

- `docs/IMPLEMENTED_FILES.md:48` — "Drizzle schema (39 tables)"
- `docs/IMPLEMENTED_FILES.md:49` — "generated (3 migrations, 39 tables)"
- `docs/NEXT_ACTIONS.md:44` — "no DB needed; 3 migrations, 39 tables as of 0002"

All three should read **38 tables**. These are documentation drift items, not code bugs; the schema
and migration SQL are self-consistent at 38. The doc edits are low-risk and can be made by any
agent with write access to `docs/`.

### 6. [INFO] Stripe production guard still deferred — unchanged from Phase 2.1

`packages/config/src/env.ts:37-38` — `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` remain
`z.string().optional()` with no production guard. The Phase 2.1 devops handoff flagged this as
a medium-severity deferred item. Phase 2.2 does not change the billing path; the guard remains
deferred until the Stripe `BillingProvider` is implemented.

### 7. [INFO] backend.ts comment still references "Phase 1.8" for full LMS contract

`apps/web/src/lib/backend.ts:10` — comment reads "The LMS web UI is DB-wired the same way (thin
Part-E model — the full enrollments/lesson-progress contract is Phase 1.8)." This is stale; the
full contract repos are already in `repositories.ts`. The comment is cosmetic documentation drift;
it does not affect runtime behaviour. Flagged for the education implementer to update when they
wire the full `LmsService` interface.

## Decisions

1. Phase 2.2 requires zero new env vars. The operator must copy `.env.example` to `.env`, fill
   `SESSION_SECRET` (48 random base64 bytes) and `SECRET_VAULT_KEK` (32 random base64 bytes), and
   optionally set `DATABASE_URL` for the Postgres path. No storage, S3, or provider secret is needed.

2. No migration 0003 is required unless the education implementer edits `schema.ts`. If they do,
   `db:generate` must be run offline first and the produced SQL reviewed before any `db:migrate`.

3. `.env.example` requires no edit this phase. It contains no real secrets and no LMS-specific
   placeholder is needed.

4. The three doc corrections (IMPLEMENTED_FILES.md x2, NEXT_ACTIONS.md x1) from "39 tables" to
   "38 tables" are low-risk doc fixes; they should be made by the next agent that touches those
   files (education-implementer or tests-runner is the natural owner).

5. No deployment, no server-side edits, no `.env` mutation. This is a read-only audit phase.

## Risks

1. **Table count doc drift (low):** Three docs claim 39 tables. Incorrect but harmless to runtime.
   Correct before any future "db:generate / 39-table schema" references are cited in new docs.

2. **Material file upload stub (by design, low):** The `materials.url` column is a plain text URL.
   Any Phase 2.2 UI that lets a teacher "upload a file" must redirect to a link-type stub or show
   an honest "not available in this build" message. A real storage adapter is Phase 4. If the
   implementer wires a file input without a storage backend, the route must return a clear 501 /
   "not implemented" rather than silently discarding the upload or storing raw binary in a text
   column.

3. **check:core gap for @wtc/lms (low):** `packages/lms` has no `__smoke__.ts`. If Phase 2.2 adds
   significant business logic to `packages/lms/src/index.ts` (e.g. the full ownership guard for
   teacher isolation), a smoke should be added. Without it, a type-stripping regression in the lms
   package would not be caught by `check:core` (only caught by `npm test` via the PGlite suite).

4. **backend.ts deniedLmsService stub covers only 4 methods (medium):** The current `deniedLmsService`
   in `backend.ts:79-84` implements only the 4 thin-contract methods. When Phase 2.2 expands
   `LmsService` (via `lms-types.ts`) to include the full contract (enrollment, progress, teacher
   profile, pinned links), the denied stub must be updated to cover all new methods — otherwise
   TypeScript will emit a type error at build time if `DATABASE_URL` is absent in production. This
   is caught by `npm run build -w @wtc/web` in `ci:local`; it will surface as a compilation error
   before deployment.

5. **Stripe production guard still absent (medium, carry-over from Phase 2.1):** unchanged — see
   Phase 2.1 devops handoff Finding 5. Not introduced by Phase 2.2.

## Verification/tests

Gates RUN this session (read-only audit):

| Gate | Result |
|---|---|
| All mandatory files read (AGENTS.md, SESSION_PROTOCOL.md, DEPLOYMENT.md, prior devops handoff, .env.example, env.ts, instrumentation.ts, drizzle.config.ts, _journal.json, 0000/0001/0002 SQL, schema.ts, repositories.ts, package.json, lms/index.ts, lms-types.ts, backend.ts, education pages, db-0002.test.ts, EDUCATION_LMS_PLAN.md, education-implementer handoff, IMPLEMENTED_FILES.md, NEXT_ACTIONS.md) | PASS — all files read; facts cited by file:line |
| Phase 2.2 introduces no new required env var | CONFIRMED — env.ts has no LMS-specific var; .env.example unchanged |
| Material file upload deferred — no S3/storage env needed | CONFIRMED — EDUCATION_LMS_PLAN.md:990-991; materials.url is plain text in schema |
| npm run dev renders LMS in honest demo mode | CONFIRMED — backend.ts:20-35 selects memory path; education/page.tsx:26-33 shows in-memory warning |
| npm test (PGlite) covers LMS repos — no DB creds | CONFIRMED — db-0002.test.ts:20-24 imports all LMS repos; runs PGlite (no server) |
| db:migrate / db:seed = NOT RUN | CONFIRMED — no DATABASE_URL; Docker absent |
| No migration 0003 required | CONFIRMED — all LMS tables present in 0002; repositories.ts already implements full LMS repo surface |
| If 0003 were generated: additive only, safe rollback | CONFIRMED pattern — pg_dump before apply; restore + redeploy for rollback |
| CI stays inert | CONFIRMED — no .git directory (DEPLOYMENT.md:75); ci.yml has never executed |
| ci:local = local equivalent | CONFIRMED — package.json:27 |
| schema.ts has 38 tables (not 39) | CONFIRMED — 21 (0000) + 0 (0001) + 17 (0002) = 38; import line at schema.ts:8 inflates naive grep count |
| Three docs say 39 — flagged | CONFIRMED — IMPLEMENTED_FILES.md:48, IMPLEMENTED_FILES.md:49, NEXT_ACTIONS.md:44 |
| .env.example contains no real secrets | CONFIRMED — all sensitive fields are empty placeholders |
| docker-compose.yml image is postgres:17-alpine | NOT RE-READ this session (confirmed in Phase 2.1 devops handoff; no edit since) |

Gates NOT RUN this session:

| Gate | Reason |
|---|---|
| `npm run ci:local` | Read-only audit; no code changed this wave |
| `npm run dev` boot test | Read-only audit wave |
| `npm test` execution | Read-only audit wave; db-0002.test.ts previously confirmed green (Phase 2.1) |
| `db:generate` | No schema.ts change this wave; no DATABASE_URL required for this command, but not needed |
| `db:migrate` / `db:seed` | No DATABASE_URL provided; no throwaway DB available |
| Real-PG harness (`REAL_POSTGRES_DATABASE_URL`) | No throwaway DB credentials provided |
| CI (GitHub Actions) | Not a git repo / no remote — permanently inert until activation |
| `npm run e2e` | Offline-fast audit; Playwright not installed this session |

## Next actions

1. **Phase 2.2 education-implementer (primary):** expand `apps/web/src/lib/lms-types.ts`
   `LmsService` interface with the full contract methods (enrollment, progress, teacher profile,
   pinned links) per `docs/handoffs/20260530-0925-ecosystem-education-implementer.md`. Then:
   - Update `apps/web/src/lib/demo.ts` `lmsService` adapter to implement the new methods.
   - Update `apps/web/src/lib/db-store.ts` `lmsService` adapter (wire new repos from `@wtc/db`).
   - Update `apps/web/src/lib/backend.ts` `deniedLmsService` stub to cover all new methods
     (TypeScript will catch missing methods at build time — treat this as a hard gate).
   - Fill `apps/web/src/app/teacher/courses/page.tsx`,
     `apps/web/src/app/teacher/courses/[id]/page.tsx`,
     `apps/web/src/app/teacher/materials/page.tsx`,
     `apps/web/src/app/teacher/students/page.tsx`,
     and `apps/web/src/app/admin/education/page.tsx` (all currently `Placeholder`).
   - Material file input: if shown, render as a link-type stub with an honest "file upload
     requires Phase 4 storage" note; do NOT store binary in the `url` text column.

2. **Doc corrections (any agent touching docs/):** change "39 tables" to "38 tables" in:
   - `docs/IMPLEMENTED_FILES.md:48`
   - `docs/IMPLEMENTED_FILES.md:49`
   - `docs/NEXT_ACTIONS.md:44`

3. **backend.ts comment (education-implementer):** update the stale "Phase 1.8" comment at
   `apps/web/src/lib/backend.ts:10` to reflect that the full LMS contract repos are already landed
   in `repositories.ts` as of Phase 2.1.

4. **check:core (tests-runner, optional):** if Phase 2.2 adds ownership-guard logic to
   `packages/lms/src/index.ts`, add `packages/lms/src/__smoke__.ts` and wire it into the
   `check:core` script in `package.json`.

5. **Operator (if db:migrate needed on a real DB):** follow the pre-migration checklist in
   `docs/DEPLOYMENT.md` ("Migrations & rollback"). Run `pg_dump` first. Only against a throwaway
   (`wtc_test`) or with a prior dump. Rollback = restore from dump + redeploy prior build.
   No destructive operations against 0000/0001/0002 tables.

6. **Operator (CI activation):** unchanged from Phase 2.1 — when ready, run `git init`, add a
   remote, and push. First CI run exercises the full gate set. Do not claim CI is green until
   that run completes successfully on the remote.
