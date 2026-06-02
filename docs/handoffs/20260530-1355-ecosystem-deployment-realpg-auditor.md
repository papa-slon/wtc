# Handoff: ecosystem-deployment-realpg-auditor — Phase 2.4 Read-Only Audit

**Slug:** ecosystem-deployment-realpg-auditor
**Epoch:** 20260530-1355
**Wave:** Phase 2.4 Real Bot Read-Only + Access Ops + Production Readiness Spine
**Workstream:** G (deployment / real-Postgres readiness)

---

## Scope

Read-only audit of the real-Postgres acceptance path, local dev plumbing, and deployment
documentation. Covers:

1. `tests/integration/db-real-postgres.test.ts` — opt-in harness (5 tests) and its guard contract
2. `packages/db/{drizzle.config.ts,package.json,src/seed.ts,src/seed-cli.ts,src/client.ts,src/index.ts,src/repositories.ts}` — migration, seed, and DB creation machinery
3. `packages/db/migrations/meta/_journal.json` — migration journal (3 entries: 0000, 0001, 0002)
4. `docker-compose.yml` — local Postgres service
5. `.env.example` — redacted env template
6. `.github/workflows/ci.yml` — staged CI (inert — no git repo / no remote)
7. `docs/DEPLOYMENT.md` — phased rollout doc
8. `package.json` (root) — npm scripts including `db:migrate`, `db:seed`, `ci:local`
9. `apps/web/src/lib/backend.ts` — backend selector (fail-closed production guard)
10. `packages/config/src/env.ts` — env schema and production guards

---

## Files inspected

- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\tests\integration\db-real-postgres.test.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\drizzle.config.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\package.json`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\src\seed.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\src\seed-cli.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\src\client.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\src\index.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\src\repositories.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\migrations\meta\_journal.json`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\migrations\0000_broken_jack_murdock.sql`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\db\migrations\0002_sour_paibok.sql`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docker-compose.yml`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\.env.example`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\.github\workflows\ci.yml`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\DEPLOYMENT.md`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\package.json`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\apps\web\src\lib\backend.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\packages\config\src\env.ts`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\handoffs\20260530-1145-ecosystem-devops-implementer.md`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\handoffs\20260530-0925-ecosystem-devops-implementer.md`
- `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform\docs\handoffs\0000-orchestrator-seed.md`

---

## Files changed

None — read-only audit

---

## Findings

### Finding 1 — HIGH — Real-PG harness has NO DB-name guard enforcement (code-level)

**Evidence:** `tests/integration/db-real-postgres.test.ts:37-46`

```typescript
const URL = process.env.REAL_POSTGRES_DATABASE_URL;
const run = !!URL;
describe.skipIf(!run)('@wtc/db real Postgres ...', () => {
  beforeAll(async () => {
    sql = postgres(URL as string, { max: 10 });
    ...
    for (const f of files) await sql.unsafe(readFileSync(join(migDir, f), 'utf8'));
```

`DEPLOYMENT.md` states (line 52-53): "the DB name in `REAL_POSTGRES_DATABASE_URL` must be `wtc_test`
or start with `wtc_test_`. Any other name means the harness may be pointed at a live or populated
database." However, the test file itself never asserts this rule. The harness fires against whatever
URL is provided if any URL is set, even `postgres://user:pass@host/production`.

**Recommendation (Workstream G):** Add a DB-name guard at the top of the `beforeAll` block.
The guard must parse the URL and assert the database component is `wtc_test` or starts with
`wtc_test_`, throwing a hard error (not a skip) if violated. Example:

```typescript
const dbName = new URL(URL as string).pathname.slice(1);
if (dbName !== 'wtc_test' && !dbName.startsWith('wtc_test_')) {
  throw new Error(
    `SAFETY: REAL_POSTGRES_DATABASE_URL must point to a wtc_test or wtc_test_* DB. Got: "${dbName}"`
  );
}
```

This converts the documented operator requirement into a hard machine-enforced invariant.

**Target Workstream:** G

---

### Finding 2 — HIGH — `seed-cli.ts` reads only `DATABASE_URL`, never `REAL_POSTGRES_DATABASE_URL`

**Evidence:** `packages/db/src/seed-cli.ts:4-6`:

```typescript
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required to seed');
const db = createDb(url);
```

`packages/db/package.json` script at line 12: `"db:seed": "tsx src/seed-cli.ts"`.

The real-PG harness (`db-real-postgres.test.ts`) seeds via `seedDatabase(db)` using the
`REAL_POSTGRES_DATABASE_URL` pool directly (test lines 62-68), bypassing `seed-cli.ts`.
However, the CI workflow (`ci.yml` line 78) runs `npm run db:seed -w @wtc/db` with
`DATABASE_URL` set to the `wtc` database, NOT the `wtc_test` database.

This is correct by design: the seed step is for the main `wtc` DB, while the harness
self-seeds `wtc_test`. But the wiring needs explicit documentation so operators do not
accidentally run `db:seed` against `wtc_test` then expect the harness to start from empty
(the harness applies raw migrations, not `db:seed`, against `wtc_test`).

**Recommendation:** Add a comment to `DEPLOYMENT.md` making this separation explicit:
`db:seed` targets `DATABASE_URL` (`wtc`); the real-PG harness self-seeds `wtc_test` via
`seedDatabase(db)` inside `beforeAll`. Running `db:seed` against `wtc_test` before the
harness is harmless (idempotent) but unnecessary and should not be part of operator procedure.

**Target Workstream:** G

---

### Finding 3 — HIGH — Raw-migration non-idempotency: harness MUST start from an empty DB each run

**Evidence:** `db-real-postgres.test.ts:49-53`:

```typescript
const migDir = join(process.cwd(), 'packages', 'db', 'migrations');
const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
expect(files.length).toBeGreaterThan(0);
for (const f of files) await sql.unsafe(readFileSync(join(migDir, f), 'utf8'));
```

The harness executes raw SQL files (not drizzle-kit's `migrate` command) via `sql.unsafe`.
Drizzle migration SQL uses `CREATE TABLE "..."` statements without `IF NOT EXISTS`. Running the
harness against a `wtc_test` database that already has the schema from a prior run will fail
with "relation already exists" errors. `DEPLOYMENT.md` lines 70-72 correctly document this:
"The harness applies raw migrations (not idempotent re-run safe) so each run needs a fresh
`wtc_test`. Drop and recreate before a second run."

`ci.yml` lines 83 and 90-91 handle this correctly with explicit DROP/CREATE before both
`npm test` and `npm run coverage`. The local operator procedure at `DEPLOYMENT.md` lines 58-60
also shows DROP then CREATE.

The gap is that the non-idempotency is only communicated in prose. Combining with Finding 1,
a DB-name guard that also checks the schema is empty would make the machine-enforced contract
complete.

**Recommendation:** In Phase 2.4, extend the `beforeAll` guard (Finding 1) to also verify
the DB is empty before proceeding:

```typescript
const tableCount = await sql`
  SELECT count(*) as c FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
`;
if (Number(tableCount[0]?.c ?? 0) > 0) {
  throw new Error(
    'SAFETY: wtc_test must be empty before running the real-PG harness. ' +
    'DROP DATABASE wtc_test; CREATE DATABASE wtc_test; then retry.'
  );
}
```

**Target Workstream:** G

---

### Finding 4 — MEDIUM — `packages/config/src/env.ts` requires `DATABASE_URL` unconditionally (no default)

**Evidence:** `packages/config/src/env.ts:17`: `DATABASE_URL: z.string().min(1)`

There is no `.default(...)`. `loadEnv()` throws if `DATABASE_URL` is absent. This means:

1. `npm run dev` will throw at server start unless `DATABASE_URL` is set in `.env` (even when
   the app is intended to run in in-memory mode via `apps/web/src/lib/backend.ts`).
2. The real-PG test harness (`REAL_POSTGRES_DATABASE_URL`) does not touch `loadEnv()` at all
   (it uses `postgres-js` directly), so this does not affect the test harness itself.
3. The CI `ci.yml` sets `DATABASE_URL: postgres://wtc:wtc@localhost:5432/wtc` at the job level
   (line 31), so CI does not hit this issue.

This is a pre-existing known behaviour (documented in the Phase 2.1 devops handoff) and is
intentional for production fail-closed. The operator must set `DATABASE_URL` in `.env` even
for the dev/in-memory path. `.env.example` already provides a placeholder value.

**Recommendation:** `DEPLOYMENT.md` and `.env.example` already document this. No code change
needed unless a future decision is made to make `DATABASE_URL` optional in development (would
require adding `.optional()` and updating `backend.ts`'s `useDb` logic). Document the
intent explicitly in DEPLOYMENT.md Phase 2.4 notes.

**Target Workstream:** G

---

### Finding 5 — MEDIUM — CI is STAGED and INERT; must not be claimed as green

**Evidence:** `.github/workflows/ci.yml` header comment (line 1):
"CI is staged: this repo is not yet a git repo / has no GitHub remote. Local gate equivalent:
npm run ci:local. CI pending."

`DEPLOYMENT.md` lines 73-87 document this explicitly: "CI (`ci.yml`) is staged but NOT RUN —
the repository has no `.git` directory and no GitHub remote. The workflow file is correct and
future-ready but has never executed."

There is no `.git` directory in the working directory (`C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`).

**Confirmed:** CI has NEVER run. Any reference to "CI passing" in this codebase refers only to
`npm run ci:local` (the local equivalent: check:core, governance:check, lint, typecheck, typecheck web,
secret:scan, npm test, build). The full CI sequence including `db:migrate`, `db:seed`, the
`postgres:17-alpine` service container, and the real-PG harness has never executed.

**Recommendation:** Do NOT claim CI is green until: (a) git is initialised, (b) a GitHub
remote is added, (c) a real push/PR triggers the workflow, and (d) all steps in `ci.yml`
pass on the GitHub Actions runner. `DEPLOYMENT.md` line 87 already states this. Phase 2.4
must preserve this warning unchanged and may not soften the NOT-RUN language.

**Target Workstream:** G

---

### Finding 6 — MEDIUM — Migration 0003 (Phase 2.4 billing durable webhook ledger) does not exist yet; the harness will pick it up automatically when it lands

**Evidence:** `packages/db/migrations/meta/_journal.json` — 3 entries only (0000, 0001, 0002).
`db-real-postgres.test.ts:50-53` reads all `.sql` files from the migrations directory sorted
alphabetically. When migration 0003 lands, the harness will apply it automatically without any
test-file change.

**Critical constraint (verified):** Migration 0003 MUST be purely additive (new tables or
nullable columns only). Because the harness applies all migrations in sequence against a fresh
`wtc_test` database, a non-additive 0003 (e.g. one that renames a column or drops a table)
would break the sequential raw-apply chain AND could corrupt a partially-migrated production
database.

**Recommendation:** When db-architect writes migration 0003, it must: (a) use only `CREATE TABLE`
/ `ALTER TABLE ... ADD COLUMN ... DEFAULT NULL` / `CREATE INDEX` statements, (b) never drop
or rename tables or columns, and (c) include a pre-migration `pg_dump` instruction in the
operator checklist (mirrors the 0002 procedure in `DEPLOYMENT.md`). The Phase 2.4 devops
implementer must update `DEPLOYMENT.md` with a migration-0003 pre/post checklist section.

**Target Workstream:** G

---

### Finding 7 — MEDIUM — `drizzle.config.ts` reads `DATABASE_URL` only; real-PG harness bypasses drizzle-kit

**Evidence:** `packages/db/drizzle.config.ts:7-14`:

```typescript
const url = process.env.DATABASE_URL ?? '';
export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
});
```

`REAL_POSTGRES_DATABASE_URL` is never read by drizzle-kit. This is by design: the harness
applies raw SQL directly (`sql.unsafe`) rather than using drizzle-kit's `migrate` command.
The drizzle.config.ts `DATABASE_URL` empty-string fallback (line 7) means `db:generate`
(which does not connect) works offline. Any command that connects (`db:migrate`, `db:studio`)
MUST have `DATABASE_URL` set explicitly — the comment in drizzle.config.ts lines 3-6
documents this correctly.

**Recommendation:** No code change needed. Confirm in operator procedure: to apply migrations
to `wtc_test` via drizzle-kit (instead of raw SQL), the operator must temporarily set
`DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/wtc_test` and run
`npm run db:migrate -w @wtc/db`. The harness's raw-SQL path is an acceptable alternative
for the throwaway-DB acceptance run and is the current approach.

**Target Workstream:** G

---

### Finding 8 — LOW — `seed.ts` idempotency relies on a unique index; course insert is NOT idempotent

**Evidence:** `packages/db/src/seed.ts:43-47` — entitlement inserts use `.onConflictDoNothing()`.
`seed.ts:50-51` — the teacher course insert:

```typescript
await db.insert(courses).values({
  ownerTeacherId: userId,
  title: 'Risk Management Fundamentals',
  ...
});
```

There is no `.onConflictDoNothing()` on the course insert. Running `db:seed` twice against
the same database will insert a second identical course for the teacher user. The `courses`
table has no unique constraint on `(ownerTeacherId, title)`.

In the real-PG harness, `seedDatabase(db)` is called once in the test body (`test line 62`)
and is verified to be idempotent via a second call (`test line 63`): "second seed must not
throw". The second call will insert a second course row, not throw — so the test passes but
the idempotency comment is misleading for the course entity.

**Recommendation:** Add `.onConflictDoNothing()` to the course insert in `seed.ts`, or add a
`UNIQUE (owner_teacher_id, title)` constraint to the courses table in migration 0003, or
guard with a prior lookup. The harness test should be strengthened to assert
`(await listCoursesForTeacher(db, teacherId, false)).length === 1` after two seeds.

**Target Workstream:** G

---

### Finding 9 — LOW — `.env.example` missing `REAL_POSTGRES_DATABASE_URL` entry

**Evidence:** `.env.example` lines 1-48 — no `REAL_POSTGRES_DATABASE_URL` entry. The variable
is documented in `DEPLOYMENT.md` lines 58-68 (throwaway-DB flow) and in the CI workflow
(`ci.yml` line 37). `.env.example` serves as the canonical reference operators use when
setting up local development; the absence of this variable means an operator must discover
it from `DEPLOYMENT.md` or the test file header comment.

**Recommendation:** Add a commented placeholder to `.env.example` in the "Database" section:

```
# --- Real-Postgres acceptance harness (opt-in; NEVER point at a live DB) ---
# DB name MUST be wtc_test or start with wtc_test_. See docs/DEPLOYMENT.md for the
# throwaway-DB flow. Omit this var entirely to skip the harness (npm test stays green).
# REAL_POSTGRES_DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/wtc_test
```

Note: the line is commented out (`#`) because the harness MUST NOT run by default.

**Target Workstream:** G

---

### Finding 10 — LOW — PGlite is NOT a substitute for real-PG acceptance; this is not documented at the harness entrypoint

**Evidence:** `tests/integration/db-real-postgres.test.ts` header comment (lines 1-14) correctly
states: "This is the cross-connection / real-engine complement to `db-persistence.test.ts`
(PGlite, single connection)." However, `docs/DEPLOYMENT.md` does not include an explicit
statement that PGlite results do NOT satisfy the real-Postgres acceptance gate.

PGlite differences from real Postgres that affect the test suite:
- Single-connection only (no true concurrent isolation)
- No network round-trip; no TCP pool overhead
- SQLSTATE codes may differ for some constraint violations
- No `pg_isready` / health-check semantics
- No `pg_dump` / `pg_restore` capability

**Recommendation:** Add the following statement to `DEPLOYMENT.md` in the "Real-Postgres
integration harness" section, immediately after the first paragraph:

```
PGlite (used by `db-persistence.test.ts` and `db-0002.test.ts`) is an in-process engine
used for fast unit-level DB tests. It is NOT a substitute for real-PG acceptance. The
`REAL_POSTGRES_DATABASE_URL` harness (postgres-js driver, real concurrent connections) is
the only accepted evidence that the schema and repositories work against production-grade
PostgreSQL 17. Claiming a real-PG gate pass based on PGlite results alone is incorrect.
```

**Target Workstream:** G

---

## Decisions

1. **Real-PG gate is NOT RUN this session.** `REAL_POSTGRES_DATABASE_URL` is not set. Docker
   is absent on this host. Native PostgreSQL 17 credentials are not available to this agent.
   The precise reason: environment variable `REAL_POSTGRES_DATABASE_URL` is not present; no
   throwaway `wtc_test` database is provisioned. This is an honest NOT-RUN, not a failure.

2. **`DATABASE_URL` is also not set.** `db:migrate` and `db:seed` are NOT RUN. The in-process
   PGlite tests run without any live Postgres. This is the correct default state for a dev
   machine where Docker is absent and no native PG credentials are provided.

3. **CI is permanently inert** until the repository gains a `.git` directory and a GitHub remote.
   The `ci.yml` file has never executed. This audit confirms the workflow file is structurally
   correct (it drops/creates `wtc_test` before both `npm test` and `coverage`, sets both
   `DATABASE_URL` and `REAL_POSTGRES_DATABASE_URL`, applies migrations and seeds before tests)
   but makes no claim of CI green status.

4. **PGlite results do not count as real-PG acceptance.** The Phase 2.3 gate counts
   (171/5 Vitest, 28/28 e2e) are PGlite-backed. The real-PG harness (5 tests) is a separate,
   opt-in acceptance gate that MUST be run before any production deployment.

5. **The DB-name guard (Finding 1) must be added in Phase 2.4** before the harness is run
   against any real database. The operator procedure in `DEPLOYMENT.md` is not machine-enforced
   without it.

---

## Risks

1. **HIGH — Harness can fire against a non-throwaway DB.** No machine-enforced DB-name check
   in `db-real-postgres.test.ts`. An operator who accidentally sets `REAL_POSTGRES_DATABASE_URL`
   to the production `wtc` database URL would apply all migrations (raw SQL, no idempotency
   guard) against production data. Mitigation: add the URL pathname guard (Finding 1) before
   any operator is asked to run the harness.

2. **HIGH — Non-idempotent raw migration apply.** Running the harness twice without dropping
   and recreating `wtc_test` will produce "relation already exists" errors. This is documented
   but not machine-enforced. The `beforeAll` empty-schema check (Finding 3) would make this
   safe by default.

3. **MEDIUM — Phase 2.4 migration 0003 must be purely additive.** If it alters or drops
   existing objects, the sequential raw-SQL apply in the harness will fail, and a partially-
   applied migration in production could lose data. Enforce via db-architect review gate before
   any `db:migrate` run.

4. **MEDIUM — `seed.ts` course insert is not idempotent** (Finding 8). Repeated `db:seed`
   calls against the `wtc` production database (or any non-throwaway) will accumulate duplicate
   course rows. Mitigation: fix before the first production `db:seed` run.

5. **MEDIUM — `loadEnv()` requires `DATABASE_URL` even in dev mode.** An operator who copies
   `.env.example` to `.env` and tries `npm run dev` without filling in `DATABASE_URL` will get
   a boot-time throw from `loadEnv()`. The app's in-memory mode is not accessible without
   setting `DATABASE_URL` to a syntactically valid string (even if Postgres is not running — the
   selector in `backend.ts` does not validate connectivity at boot, only at first DB call).

6. **LOW — `REAL_POSTGRES_DATABASE_URL` absent from `.env.example`** (Finding 9). Operators
   may not know the variable name without reading `DEPLOYMENT.md` or the test file.

---

## Opt-in real-Postgres flow specification (Phase 2.4 authoritative)

This section specifies exactly how the opt-in real-PG flow works. Any DEPLOYMENT.md edit in
Phase 2.4 must conform to this spec.

### Preconditions

Before running the harness, all of the following must be true:

1. `REAL_POSTGRES_DATABASE_URL` is set and its DB-name component is `wtc_test` or starts with
   `wtc_test_`. Any other name is an operator error.
2. The `wtc_test` database exists and is EMPTY (no tables in `public` schema).
3. `DATABASE_URL` is set (required by `loadEnv()`; does not need to be the same server).
4. The operator has reviewed the migration SQL files in `packages/db/migrations/` before running.

### Step-by-step (PowerShell, local PostgreSQL 17)

```powershell
# 1. Create a fresh throwaway DB. Replace <user> and <password> with local PG17 credentials.
#    DB name MUST be wtc_test or start with wtc_test_.
psql -h 127.0.0.1 -U <user> -c "DROP DATABASE IF EXISTS wtc_test"
psql -h 127.0.0.1 -U <user> -c "CREATE DATABASE wtc_test"

# 2. Set the opt-in env var for this PowerShell session. NEVER commit this.
$env:REAL_POSTGRES_DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc_test"

# 3. Ensure DATABASE_URL is also set (required by loadEnv; may point at a different local DB).
$env:DATABASE_URL = "postgres://<user>:<password>@127.0.0.1:5432/wtc"

# 4. Ensure SESSION_SECRET and SECRET_VAULT_KEK are set (required by loadEnv in non-test paths).
$env:SESSION_SECRET = "$(node -e "console.log(require('crypto').randomBytes(48).toString('base64'))")"
$env:SECRET_VAULT_KEK = "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"

# 5. Run only the real-PG harness (5 tests; skipped in normal npm test runs).
npm test -- tests/integration/db-real-postgres.test.ts

# 6. To run a second time: drop and recreate first (migrations are not idempotent re-run safe).
psql -h 127.0.0.1 -U <user> -c "DROP DATABASE IF EXISTS wtc_test"
psql -h 127.0.0.1 -U <user> -c "CREATE DATABASE wtc_test"
# Then repeat step 5.
```

### If `REAL_POSTGRES_DATABASE_URL` is absent

`describe.skipIf(!run)` at `db-real-postgres.test.ts:46` makes the entire 5-test block inert.
`npm test` exits 0. The single always-present test in the outer `describe` block (line 112)
reports: "skipped (set REAL_POSTGRES_DATABASE_URL to enable)". This is correct behaviour.

**PGlite is NOT a substitute for real-PG acceptance.** The PGlite harness
(`tests/integration/db-persistence.test.ts`, `tests/integration/db-0002.test.ts`) runs in
all `npm test` invocations and exercises the same repository functions, but it cannot prove:
real postgres-js driver behaviour, genuine multi-connection concurrent isolation, or
production SQLSTATE error codes. The real-PG harness is the only accepted evidence for
production-grade PostgreSQL 17 compatibility.

### Condition for marking the real-PG gate RUN

The gate is RUN (and may be reported as such) only when ALL of:
- `REAL_POSTGRES_DATABASE_URL` was set to a `wtc_test` or `wtc_test_*` URL
- `npm test -- tests/integration/db-real-postgres.test.ts` exited 0
- All 5 tests reported PASS (not skip, not fail)
- The run was against a fresh empty `wtc_test` database

If any condition is unmet, the gate is NOT RUN (not failed — "not run" is the honest state).

### What `db:migrate` and `db:seed` require

`db:migrate` (root script: `npm run db:migrate -w @wtc/db`):
- Requires `DATABASE_URL` set to a valid Postgres connection string
- Runs drizzle-kit `migrate` command, which applies outstanding migrations from `packages/db/migrations/`
- Must NOT be run against any non-throwaway database without a prior `pg_dump`
- NOT RUN in this session (no `DATABASE_URL` / no Postgres available)

`db:seed` (root script: `npm run db:seed -w @wtc/db`):
- Requires `DATABASE_URL` (reads it directly in `seed-cli.ts:4`)
- Runs `seedDatabase(db)` which is idempotent for users/roles/products/plans/entitlements
  but NOT idempotent for the teacher course insert (Finding 8)
- NOT RUN in this session

Both commands are gated on `DATABASE_URL`. When `DATABASE_URL` is absent → NOT RUN with
reason: "DATABASE_URL not set; no throwaway Postgres available on this host."

---

## Exact `.env.example` edit required for Phase 2.4

Insert the following block after the existing `DATABASE_URL` line in `.env.example` (after
line 8, inside the `# --- Database` section):

```
# --- Real-Postgres acceptance harness (opt-in; NEVER point at a live or populated DB) ---
# DB name MUST be wtc_test or start with wtc_test_. See docs/DEPLOYMENT.md for the full
# throwaway-DB flow. Leave this variable UNSET to skip the harness (npm test stays green).
# REAL_POSTGRES_DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/wtc_test
```

The line is commented out. It must never be uncommented in `.env.example` itself.

---

## Exact `DEPLOYMENT.md` edits required for Phase 2.4

### Edit 1 — Add explicit PGlite-is-not-real-PG statement

In the "Real-Postgres integration harness" section, after the first sentence of the second
paragraph ("The test suite runs against PGlite..."), insert:

```
PGlite is an in-process engine used for fast unit-level DB tests. It is NOT a substitute for
real-PG acceptance. Only a passing run of `tests/integration/db-real-postgres.test.ts` with
`REAL_POSTGRES_DATABASE_URL` set to a `wtc_test` database constitutes real-Postgres acceptance.
```

### Edit 2 — Add DB-name guard note

In the "Hard guard" paragraph (after "MUST be satisfied before running the harness"), add:

```
Note: Phase 2.4 adds a machine-enforced version of this guard inside the test file's
`beforeAll` block. If you are running an older version of the harness that lacks this guard,
manually verify the URL pathname before proceeding.
```

### Edit 3 — Add migration 0003 pre-migration checklist entry

In the "Migrations & rollback" section, add a bullet:

```
- Before applying migration 0003 (Phase 2.4): `pg_dump` backup. Confirm 0003 is purely
  additive (CREATE TABLE / ADD COLUMN only — no DROP, no RENAME). Apply against `wtc_test`
  throwaway first; review output; then apply against the target with a prior dump.
```

### Edit 4 — Clarify `db:seed` non-idempotency for courses

In the "Migrations & rollback" section, add a caution:

```
- `db:seed` is idempotent for users, roles, products, plans, and entitlements (all use
  `onConflictDoNothing`). The teacher course insert is NOT yet idempotent — running
  `db:seed` more than once against the same DB will insert duplicate course rows. Run
  `db:seed` exactly once against any given database until Finding 8 is fixed.
```

---

## Verification/tests

Gates status this audit session:

| Gate | Status | Reason |
|---|---|---|
| `db:migrate` | NOT RUN | `DATABASE_URL` not set; no Postgres available on host |
| `db:seed` | NOT RUN | `DATABASE_URL` not set |
| real-PG harness (`REAL_POSTGRES_DATABASE_URL`) | NOT RUN | Env var not set; no throwaway `wtc_test` DB provisioned |
| `npm test` (PGlite) | NOT RUN this session | Read-only audit; no code changed; prior session reported 171 pass |
| `npm run build -w @wtc/web` | NOT RUN this session | Read-only audit |
| `npm run ci:local` | NOT RUN this session | Read-only audit |
| CI (GitHub Actions `ci.yml`) | INERT — never executed | No `.git` directory, no GitHub remote |

File inspection confirmations:

| Fact | Confirmed |
|---|---|
| Migration journal: entries 0000, 0001, 0002 only | `_journal.json` lines 1-26 |
| Harness skip guard: `describe.skipIf(!run)` | `db-real-postgres.test.ts:46` |
| No DB-name guard in test code | `db-real-postgres.test.ts:37-55` — none present |
| `seed-cli.ts` reads `DATABASE_URL` only | `seed-cli.ts:4` |
| `drizzle.config.ts` reads `DATABASE_URL` with empty fallback | `drizzle.config.ts:7` |
| `backend.ts` fails closed in production without `DATABASE_URL` | `backend.ts:22-32` |
| `loadEnv` requires `DATABASE_URL` (no default) | `env.ts:17` |
| `docker-compose.yml` uses `postgres:17-alpine` | `docker-compose.yml:4` |
| `ci.yml` drops/creates `wtc_test` before both test and coverage runs | `ci.yml:83,90-91` |
| `ci.yml` has never executed | `ci.yml:1` comment + no `.git` directory |
| `.env.example` contains no real secrets | All sensitive fields are placeholders |
| `seed.ts` course insert lacks `onConflictDoNothing` | `seed.ts:50-51` |

---

## Next actions

1. **(Phase 2.4, G-1, HIGH)** db-architect or tests-runner: add the DB-name + empty-schema
   guard to `tests/integration/db-real-postgres.test.ts` `beforeAll` (Finding 1 + Finding 3).
   No other test file changes required. This is a safety-critical addition before any operator
   runs the harness against a real server.

2. **(Phase 2.4, G-2, HIGH)** devops-implementer: update `docs/DEPLOYMENT.md` with the four
   edits specified above (PGlite clarification, DB-name guard note, migration 0003 checklist,
   `db:seed` non-idempotency caution).

3. **(Phase 2.4, G-3, MEDIUM)** devops-implementer: add `REAL_POSTGRES_DATABASE_URL`
   commented placeholder to `.env.example` (exact text in Finding 9 / `.env.example edit`
   section above).

4. **(Phase 2.4, G-4, MEDIUM)** db-architect: when writing migration 0003, confirm additive-only
   constraint. Update `DEPLOYMENT.md` migration-0003 pre/post checklist.

5. **(Phase 2.4, G-5, LOW)** db-architect or implementer: fix `seed.ts` course insert to add
   `.onConflictDoNothing()` or add a unique constraint in migration 0003 (Finding 8).

6. **(Before first production deployment)** Operator must run the real-PG harness (5 tests, all
   PASS) against a fresh `wtc_test` database with the full migration chain (0000 + 0001 + 0002 +
   0003 when available) before any `DATABASE_URL` pointing at the production `wtc` database is
   used for `db:migrate`. PGlite results alone do NOT satisfy this gate.

7. **(When git/remote available)** Activate CI: `git init`, add remote, push. Do NOT claim CI
   green until `ci.yml` has executed on a real push to the GitHub remote and all steps passed.
