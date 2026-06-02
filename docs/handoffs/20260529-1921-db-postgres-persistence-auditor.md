# db-postgres-persistence-auditor handoff

_2026-05-29 19:21 UTC. Phase 1.5 read-only DB/persistence audit. No live servers, no code edits._

## Scope

Audit `packages/db` (schema, repositories, seed, client, migration) and the full persistence path
(`apps/web/src/lib/{backend,db-store,session}.ts`, `apps/worker/src/*`) against six specific
correctness questions (D1–D6) and the requirements for running real `db:migrate`/`db:seed` against
the live PG17 host and a Postgres-backed CI job (Part C).

## Files inspected

- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/client.ts`
- `packages/db/src/seed.ts`
- `packages/db/src/seed-cli.ts`
- `packages/db/src/index.ts`
- `packages/db/drizzle.config.ts`
- `packages/db/package.json`
- `packages/db/migrations/0000_broken_jack_murdock.sql`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/session.ts`
- `apps/web/src/app/(auth)/actions.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `tests/integration/db-persistence.test.ts`
- `docker-compose.yml`
- `.env.example`
- `package.json`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260529-phase1-persistence-hardening.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `AGENTS.md`

## Files changed

None — read-only audit.

## Findings

### D1 — MISSING: entitlements UNIQUE constraint on (user_id, product_code)

**Severity: high**

**Evidence:**
- `packages/db/src/schema.ts:83` — `entitlements` table third-argument uses `index(...)` not `uniqueIndex(...)`:
  ```
  (t) => ({ userProductIdx: index('entitlements_user_product_idx').on(t.userId, t.productCode) }),
  ```
- `packages/db/migrations/0000_broken_jack_murdock.sql:210` confirms the generated DDL:
  ```sql
  CREATE INDEX "entitlements_user_product_idx" ON "entitlements" USING btree ("user_id","product_code");
  ```
  This is a plain non-unique btree index. There is NO `UNIQUE INDEX` or `UNIQUE CONSTRAINT` on
  `(user_id, product_code)` anywhere in the schema or migration.

**Impact:** The database enforces no uniqueness. Concurrent `grantProduct` calls (or a race between
a billing webhook and an admin grant) can insert two rows with the same `(user_id, product_code)`,
leading to duplicate entitlements. `entitlementsOf` returns both; `hasAccess` would still pass, but
`revokeProduct` uses `.limit(1)` and would only revoke the first row — the second row survives,
leaving a ghost `active` entitlement that billing cannot clear.

**Recommendation:** Change `index(...)` to `uniqueIndex(...)` in `schema.ts:83`, re-run
`db:generate` to produce a new migration that drops the plain index and creates a unique one:
```ts
(t) => ({ userProductIdx: uniqueIndex('entitlements_user_product_idx').on(t.userId, t.productCode) }),
```
Alternatively add `onConflictDoUpdate` (upsert) semantics in `grantProduct` so the insert path
can never duplicate. Both changes are required together: the constraint prevents concurrent inserts;
the upsert eliminates the pre-check SELECT + conditional INSERT gap.

**Target part: D**

---

### D2 — MISSING: grantProduct and revokeProduct do NOT use a transaction

**Severity: high**

**Evidence:**
- `packages/db/src/repositories.ts:108–118` (`grantProduct`): issues up to three separate awaited
  statements — a `SELECT`, then either an `UPDATE` or `INSERT`, then `audit.write(INSERT)` — with no
  wrapping `db.transaction(...)` call.
- `packages/db/src/repositories.ts:120–126` (`revokeProduct`): same pattern — `SELECT`, `UPDATE`,
  `audit.write(INSERT)`, no transaction.
- Grep for "transaction" across `repositories.ts` returns no matches (confirmed zero results).

**Impact:** If the audit `INSERT` fails after the entitlement `UPDATE/INSERT` succeeds, the
entitlement change is committed without an audit trail — a compliance gap. Conversely, if the DB
crashes between the entitlement write and the audit write, the audit log is missing. For concurrent
requests, a second caller can read the pre-grant state in the window between the `SELECT` and the
`UPDATE`.

**Recommendation:** Wrap the entitlement mutation and audit insert in a single Drizzle transaction:
```ts
await db.transaction(async (tx) => {
  // existing SELECT + UPDATE/INSERT logic using tx instead of db
  await tx.insert(s.auditLogs).values(buildEvent(auditInput));
});
```
The `AuditWriter` interface passed in should be replaced with a plain `AuditInput` object inside the
transaction helper so the audit write participates in the same txn. Alternatively, accept an
`AuditInput` parameter and call the DB audit writer inside the transaction.

**Target part: D**

---

### D3 — MISSING: createUser does NOT wrap user + roles insert in a transaction

**Severity: medium**

**Evidence:**
- `packages/db/src/repositories.ts:60–68` (`createUser`): issues a `SELECT` (duplicate check), then
  `db.insert(users)`, then a `for` loop of `db.insert(userRoles)` — three or more separate awaited
  statements with no `db.transaction(...)`.
- Grep for "transaction" returns no matches in `repositories.ts`.

**Impact:** If the process crashes or the DB connection drops after the `users` row is inserted but
before the `user_roles` rows are inserted, the user exists in the DB with no roles. On next login
`rolesOf` returns `[]`, so `roles` is empty; RBAC checks that expect at least `['user']` would
denote them as an un-roleed user. The duplicate-email check is also a separate `SELECT` before the
`INSERT`, creating a TOCTOU gap (two concurrent registrations for the same email can both pass the
check before either insert — though the `users_email_idx` unique constraint prevents both from
committing, only one will succeed and the other gets a DB error rather than the friendly "already
registered" message).

**Recommendation:** Wrap the body of `createUser` in `db.transaction(async (tx) => { ... })`,
using `tx` for all queries inside. The existing `onConflictDoNothing()` on `userRoles` inserts is
already a safe fallback; the main gap is the user insert + roles insert atomicity.

**Target part: D**

---

### D4 — MISSING: addExchangeKey does NOT wrap account + sealed-secret in a transaction

**Severity: high**

**Evidence:**
- `packages/db/src/repositories.ts:138–149` (`addExchangeKey`): issues `db.insert(exchangeAccounts)`
  then `db.insert(exchangeApiKeySecrets)` as two sequential awaited statements with no transaction.

**Impact:** If the `exchange_api_key_secrets` insert fails (e.g. constraint violation, transient
network error) after the `exchange_accounts` row has been committed, a dangling `exchange_accounts`
row exists with no secret material. `listExchangeKeys` will return it to the user as a valid key
with no secret behind it. Any attempt to use the key for a bot connection will fail silently or with
a confusing error. The vault material is also lost — the user would need to re-enter their API key
to recover.

**Recommendation:** Wrap both inserts in `db.transaction(async (tx) => { ... })`. Both rows must
commit atomically or both must roll back:
```ts
export async function addExchangeKey(db, input) {
  return db.transaction(async (tx) => {
    const [acct] = await tx.insert(s.exchangeAccounts).values(...).returning();
    if (!acct) throw new Error('failed to insert exchange account');
    await tx.insert(s.exchangeApiKeySecrets).values({ exchangeAccountId: acct.id, ... });
    return { id: acct.id, ... };
  });
}
```

**Target part: D**

---

### D5 — CONFIRMED BUG: destroySession is fire-and-forget (void, not awaited)

**Severity: high**

**Evidence:**
- `apps/web/src/lib/db-store.ts:75–77`:
  ```ts
  export function destroySession(token: string | undefined): void {
    if (token) void rDestroySession(db(), hashToken(token));
  }
  ```
  The function is declared `void` (synchronous return type) and uses `void` to discard the Promise
  from `rDestroySession`.
- `apps/web/src/app/(auth)/actions.ts:59`:
  ```ts
  destroySession(jar.get(SESSION_COOKIE)?.value);
  ```
  The call site does NOT await (and cannot await since the function returns `void`).
- The `logoutAction` server action at `actions.ts:55–62` calls `destroySession(...)` then
  immediately calls `jar.delete(SESSION_COOKIE)` and `redirect('/')`. The DB `UPDATE sessions SET
  revoked = true` is never awaited before the response is sent.

**Impact:** On logout:
1. The server sends the redirect (clearing the cookie) before the DB `revoked` flag is set.
2. If the DB update fails (transient error), the session token remains valid in the database.
3. A sufficiently fast attacker who captures the session cookie before the browser redirect can
   replay it and the DB check in `userForTokenHash` will return a valid user because `revoked` is
   still `false`.
4. Under high load the fire-and-forget Promise may be abandoned entirely by the Node.js event loop
   before it resolves.

**Recommendation:**
1. Change `destroySession` in `db-store.ts` to `async function` returning `Promise<void>` and
   `await rDestroySession(...)`.
2. Update the matching signature in `demo.ts` and `backend.ts` exports.
3. In `logoutAction`, `await destroySession(...)` before `jar.delete(SESSION_COOKIE)` and
   `redirect('/')`.
4. Verify the in-memory `demo.ts` implementation is also synchronous-safe (it is, but the type
   should match).

**Target part: D**

---

### D6 — job_queue table exists but has NO durable consumer; worker does NOT read from it

**Severity: medium**

**Evidence:**
- `packages/db/src/schema.ts:215–227`: `job_queue` table is defined with `kind`, `payload`,
  `run_at`, `locked_at`, `done_at`, `attempts` — a proper durable queue schema including a
  `locked_at` column (implying skip-locked/advisory lock semantics were planned).
- `packages/db/migrations/0000_broken_jack_murdock.sql:94–102`: DDL confirms `job_queue` table and
  `job_queue_run_idx` index on `run_at` are created.
- `packages/db/src/repositories.ts`: zero references to `jobQueue`, `job_queue`, `lockedAt`, or any
  dequeue/claim function. No `FOR UPDATE SKIP LOCKED` query anywhere in the file.
- `apps/worker/src/index.ts:12–19` (`dbTick`): the worker uses only `reconcileAllEntitlements`,
  `sweepTvExpiry`, and `recordHealthCheck` — none of which interact with `job_queue`.
- `apps/worker/src/jobs.ts:3`: comment says "A durable queue (job_queue table) replaces the
  in-memory demo loop in production" — but no such replacement is implemented; the comment describes
  the intended future state, not the current code.

**Impact:** The `job_queue` table is dead schema. Any code that inserts a job row (future billing
webhooks, TV revoke tasks dispatched as jobs, etc.) will never be processed — jobs accumulate but
are never claimed or executed. The `tradingview_access_tasks` table is a partial workaround
(worker reads it directly via `sweepTvExpiry`) but is a separate mechanism, not the general queue.
`lockedAt` on `job_queue` suggests the author intended SELECT FOR UPDATE SKIP LOCKED semantics;
without it, a multi-worker deployment would double-process jobs.

**Recommendation:** Either:
(a) Implement a `dequeueJobs(db, kinds, limit)` repository function using
    `SELECT ... FOR UPDATE SKIP LOCKED WHERE done_at IS NULL AND run_at <= now AND locked_at IS NULL`,
    wrap the claim+execute+done update in a transaction, and wire it into `dbTick`; or
(b) Remove `job_queue` from the schema (and migration) if not planned for Phase 1.5, and document
    that `tradingview_access_tasks` is the only queue mechanism used by the worker.

Option (a) is preferred if billing webhook retry / bot config propagation jobs are coming in Phase 2.
Document the chosen path in `docs/ARCHITECTURE.md`.

**Target part: D**

---

### C1 — drizzle.config.ts uses PG16 credentials as default; live host is PG17

**Severity: medium**

**Evidence:**
- `packages/db/drizzle.config.ts:7`:
  ```ts
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://wtc:wtc@localhost:5432/wtc' },
  ```
  The fallback default `postgres://wtc:wtc@localhost:5432/wtc` will be used if `DATABASE_URL` is not
  set. This is intentional for dev, but means `db:migrate` run without `DATABASE_URL` set will
  target the live PG17 on `127.0.0.1:5432` with credentials `wtc:wtc` (unknown if those credentials
  exist on the live instance).
- `docker-compose.yml:4`: local dev Postgres image is `postgres:16-alpine`, while the live host
  confirmed as PostgreSQL 17. The migration was generated against PG dialect but version-pinned to
  16 in the compose file. No incompatibility is known between the generated DDL and PG17, but the
  mismatch is undocumented.
- PG17 credentials are UNKNOWN (confirmed in audit instructions). Running `db:migrate` with the
  default fallback URL risks connecting to the live PG17 with wrong credentials (connection refused
  is the best case; a matching credential set would mutate the live DB).

**Recommendation:**
1. Add a guard to `drizzle.config.ts` that throws if `DATABASE_URL` is not set, removing the
   localhost fallback:
   ```ts
   const url = process.env.DATABASE_URL;
   if (!url) throw new Error('DATABASE_URL must be set to run drizzle-kit commands');
   dbCredentials: { url },
   ```
2. Update `docker-compose.yml` to use `postgres:17-alpine` to match the live target.
3. Document the live PG17 credentials requirement (in a sealed `.env` or secrets manager, not in
   source).

**Target part: C**

---

### C2 — No GitHub Actions CI workflow exists; no Postgres service job for integration tests

**Severity: medium**

**Evidence:**
- `docs/STATUS.md` states "`db:migrate` / `db:seed` against Docker Postgres — NOT RUN".
- Bash check confirms: `.github/` directory does NOT exist in the repo root.
- `docs/NEXT_ACTIONS.md` Phase 1.5 item 1: "Real Postgres in CI: run `db:migrate`/`db:seed` + a
  Postgres-backed integration job."
- The only integration test (`tests/integration/db-persistence.test.ts`) uses PGlite (in-process
  WASM Postgres), not a real Postgres TCP server. PGlite does not exercise `postgres-js` connection
  pooling, PG17-specific behaviors, or network-layer issues.

**What a GitHub Actions Postgres-service job should contain (proposed):**
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: wtc
          POSTGRES_PASSWORD: wtc
          POSTGRES_DB: wtc
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      NODE_ENV: test
      DATABASE_URL: postgres://wtc:wtc@localhost:5432/wtc
      SESSION_SECRET: ci-session-secret-not-real-32bytes-padded
      SECRET_VAULT_KEK: ci-kek-not-real-32bytes-padded-here
      SECRET_VAULT_KEY_ID: kek-ci
      AXIOMA_HANDOFF_SIGNING_SECRET: ci-axioma-secret-not-real-48bytes-pads
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'npm' }
      - run: npm ci
      - run: npm run db:migrate -w @wtc/db       # applies real DDL to PG17
      - run: npm run db:seed -w @wtc/db           # seeds demo data
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test                              # includes PGlite integration test
      - run: npm run secret:scan
      - run: npm run build -w @wtc/web
```
Notes:
- `SESSION_SECRET` / `SECRET_VAULT_KEK` / `AXIOMA_HANDOFF_SIGNING_SECRET` must be long enough to
  pass the `requiredSecret()` guard (rejects placeholder strings), but must NOT be real prod values.
  Generate throwaway 32/48-byte base64 strings and store them as GitHub Actions secrets.
- A separate job (or step) should run `db:migrate` against the service before `npm test` to verify
  migration idempotency and FK ordering.
- Playwright e2e should be a separate job that runs `npm run dev:e2e` (port 3100) and gates on
  `chromium` install.

**Target part: C**

---

### C3 — seed.ts inserts entitlements without onConflictDoNothing; NOT idempotent on re-run

**Severity: medium**

**Evidence:**
- `packages/db/src/seed.ts:43–47`: the entitlement inserts for the demo user have no
  `onConflictDoNothing()`:
  ```ts
  await db.insert(entitlements).values([
    { userId, productCode: 'tortila_bot', ... },
    { userId, productCode: 'axioma_terminal', ... },
    { userId, productCode: 'education', ... },
  ]);
  ```
  Compare with the users/roles/products/plans inserts at lines 14–21 which all have
  `.onConflictDoNothing()`.
- Because there is no UNIQUE constraint on `(user_id, product_code)` (see D1), re-running the seed
  against an already-seeded DB inserts duplicate entitlement rows rather than failing or
  up-serting. The duplicate-email check on line 34 causes `inserted[0]?.id` to be undefined
  (the `onConflictDoNothing` returns no rows), so `userId` is `undefined` and the entitlement
  inserts are skipped — but only because the user insert returns no rows. If a seed re-run is
  attempted against a DB where the user was inserted by another path, the entitlement inserts
  would duplicate.

**Recommendation:** Fix D1 first (add UNIQUE constraint). Then add `.onConflictDoNothing()` to the
entitlement inserts in `seed.ts` so the seed is truly idempotent:
```ts
await db.insert(entitlements).values([...]).onConflictDoNothing();
```
This also requires passing a `conflictTarget` to Drizzle's `onConflictDoNothing` once the unique
index exists.

**Target part: C**

---

### C4 — drizzle-kit migrate vs live PG17: credentials unknown, no pre-flight check

**Severity: medium**

**Evidence:**
- `docs/STATUS.md` (honesty note): "No Docker/Postgres on this host, so the DB path is verified via
  PGlite … `db:migrate`/`db:seed` scripts … were NOT run against a Docker Postgres here."
- `docs/NEXT_ACTIONS.md`: "To exercise the real Postgres path … `docker compose up -d && DATABASE_URL=...
  npm run db:migrate`" — credentials are `...` (user must supply).
- `docs/STATUS.md`: Live PG17 on `127.0.0.1:5432`; credentials UNKNOWN. No pg_hba.conf or role
  info confirmed in discovery.
- `drizzle.config.ts` `db:migrate` uses `drizzle-kit migrate` which runs the SQL migration files
  directly. There is no pre-flight check for PG version, available extensions, or whether the
  `gen_random_uuid()` function is available (it requires `pgcrypto` in PG < 13, but is built-in in
  PG 13+; PG17 is safe).

**What is needed to run `db:migrate`/`db:seed` against the live PG17:**
1. Discover the PG17 credentials (`psql -U postgres` or check `/etc/postgresql/17/main/pg_hba.conf`
   on the server — requires approved SSH; do not SSH without approval).
2. Create a `wtc` role and `wtc` database (or use the discovered credentials):
   ```sql
   CREATE ROLE wtc WITH LOGIN PASSWORD '...';
   CREATE DATABASE wtc OWNER wtc;
   ```
3. Set `DATABASE_URL=postgres://wtc:<pass>@127.0.0.1:5432/wtc` in the environment.
4. Run `npm run db:migrate -w @wtc/db` — applies `0000_broken_jack_murdock.sql`.
5. Run `npm run db:seed -w @wtc/db` — seeds demo data (guard: requires `DATABASE_URL`).
6. Verify with `psql -U wtc -d wtc -c "\dt"` (21 tables expected).

**Target part: C**

---

### C5 — postgres:16 in docker-compose vs PG17 on live host (version mismatch, undocumented)

**Severity: low**

**Evidence:**
- `docker-compose.yml:4`: `image: postgres:16-alpine`
- Audit instruction: "PostgreSQL 17 IS running on 127.0.0.1:5432"
- The generated migration DDL has no PG-version-specific syntax incompatible with PG17 (no partitioned tables, no PG16+ features). However the mismatch means local dev validation is done against PG16 while production is PG17.

**Recommendation:** Update `docker-compose.yml` to `postgres:17-alpine`. While no known
incompatibility exists, aligning versions reduces the risk of subtle behavioral differences in
query planning, default settings, or new PG17 behaviors.

**Target part: C**

---

## Decisions

1. All six D-series questions are now answered with confirmed file:line evidence.
2. Part C audit is complete: the two items needed to run real migrations are (a) live PG17
   credentials (external dependency) and (b) the CI workflow (code gap — no `.github/` exists).
3. The `job_queue` table is confirmed as dead schema (D6): the table exists, the worker does not
   read from it.
4. The `destroySession` fire-and-forget is confirmed as a real bug (D5), not a speculation.

## Risks

- **D1 (missing UNIQUE)** is the highest-priority schema risk: without it, duplicate entitlements
  can accumulate silently, and revoke operations are unreliable. Fix before wiring billing webhooks.
- **D4 (addExchangeKey no txn)** is the highest-priority secret-safety risk: a partial insert
  leaves a dangling account row with no vault secret, confusing to debug and potentially exposable
  if `listExchangeKeys` is used as a presence check.
- **D5 (destroySession fire-and-forget)** is the highest-priority auth safety risk: logout does not
  guarantee DB revocation before the response is sent.
- **D2/D3 (no transactions)**: lower immediate risk since the audit write is append-only and
  failures are more likely transient, but these should be fixed before the billing webhook path
  lands (webhooks trigger entitlement changes that must be atomic with audit).
- Running `db:migrate` with the default fallback URL (`wtc:wtc@localhost:5432`) against the live
  PG17 without confirmed credentials could fail silently or, if credentials happen to match, mutate
  production. The guard proposed in C1 is a safety net.

## Verification/tests

- D1: `grep -n "uniqueIndex" packages/db/src/schema.ts` — only 3 matches (users/user_roles/sessions);
  entitlements is absent.
- D2/D3/D4: `grep -rn "transaction" packages/db/src/repositories.ts` — zero matches.
- D5: `grep -n "void rDestroySession" apps/web/src/lib/db-store.ts` → line 76; confirmed `void`
  keyword discards promise.
- D6: `grep -rn "jobQueue\|job_queue" packages/db/src/repositories.ts` — zero matches; `grep -rn
  "jobQueue\|job_queue" apps/worker/src/` — only one comment line in `jobs.ts`.
- C2: `.github/` directory does not exist (confirmed via bash `ls`).

## Next actions

Priority order:

1. **(D1/C3 — blocking for billing)** Add `uniqueIndex` on `entitlements(user_id, product_code)` in
   `schema.ts`; re-run `db:generate` to produce a new migration; add `onConflictDoUpdate` / upsert
   semantics in `grantProduct` to handle the concurrent-insert race; add `.onConflictDoNothing()`
   to seed entitlement inserts.

2. **(D5 — blocking for auth safety)** Make `destroySession` in `db-store.ts` async and awaited in
   `logoutAction`. Update `demo.ts` to match the async signature. Update `backend.ts` guard type.

3. **(D4 — blocking for secrets path)** Wrap `addExchangeKey` in `db.transaction(...)`.

4. **(D2 — compliance)** Wrap `grantProduct` and `revokeProduct` entitlement-update + audit-insert
   in a single `db.transaction(...)`.

5. **(D3 — correctness)** Wrap `createUser` user + roles inserts in `db.transaction(...)`.

6. **(C1 — safety)** Remove the localhost fallback from `drizzle.config.ts`; throw if
   `DATABASE_URL` is unset.

7. **(C2 — CI)** Create `.github/workflows/ci.yml` with a `postgres:17-alpine` service job (spec
   above), secret-quality env vars as GitHub Actions secrets (never real prod values).

8. **(C4 — deployment readiness)** Get live PG17 credentials via approved SSH; create the `wtc`
   role/DB; run `db:migrate` + `db:seed`; verify 21 tables present.

9. **(D6 — architecture)** Decide: implement the `job_queue` consumer (dequeue with FOR UPDATE SKIP
   LOCKED) or remove the dead schema and document `tradingview_access_tasks` as the only worker
   queue. Update `docs/ARCHITECTURE.md` accordingly.

10. **(C5 — minor)** Update `docker-compose.yml` to `postgres:17-alpine`.
