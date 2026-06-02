# db-race-safety-auditor handoff

_2026-05-29. Phase 1.6 Task B — DB race-safety audit. READ-ONLY: no code edits, no migrations, no
installs, no test runs, no git. Only this one handoff file was written._

## Scope
Audit the concurrency/race safety of the `@wtc/db` persistence layer and specify exact fixes + tests:
- `packages/db/src/repositories.ts` — `grantProduct`, `revokeProduct`, `createUser`, `addExchangeKey`
- `packages/db/src/schema.ts` — unique indexes available as `ON CONFLICT` targets
- `packages/db/migrations/{0000_broken_jack_murdock,0001_early_toad_men}.sql`
- `packages/db/src/client.ts` — driver (postgres-js prod / PGlite tests)
- `tests/integration/db-persistence.test.ts` — existing transactional/unique tests + PGlite wiring

Focus: confirm the `grantProduct` SELECT-then-INSERT race, confirm `createUser` duplicate-email
behaviour, specify the `onConflictDoUpdate` upsert fix (exact target + set clause, preserving
`grantManual`/`applyBillingEvent` status semantics with the audit row in the SAME txn), note
PGlite-vs-postgres-js differences for `ON CONFLICT` + error codes, and spec the PGlite tests to add.

## Files inspected
- `packages/db/src/repositories.ts` (261 lines) — `grantProduct` L115-127, `revokeProduct` L129-137, `createUser` L60-72, `addExchangeKey` L149-164, `auditRowValues` L175-192
- `packages/db/src/schema.ts` (243 lines) — `entitlements` + unique index L67-86; `users` email unique L14-24; `userRoles` unique L30-37; `tradingviewAccessTasks` L159-165; `auditLogs` L197-215
- `packages/db/src/client.ts` (11 lines) — postgres-js `drizzle()` factory; `Db` type
- `packages/db/src/seed.ts` (54 lines) — `onConflictDoNothing` seed (entitlements L43-47)
- `packages/db/src/index.ts` (6 lines) — barrel re-exports `schema`, `createDb`, `Db`, seed, repositories
- `packages/db/migrations/0000_broken_jack_murdock.sql` — base DDL; `entitlements_user_product_idx` created as a PLAIN index at L210
- `packages/db/migrations/0001_early_toad_men.sql` — drops the plain index and recreates it as `CREATE UNIQUE INDEX "entitlements_user_product_idx" ON "entitlements" USING btree ("user_id","product_code")`
- `tests/integration/db-persistence.test.ts` (121 lines) — PGlite wiring L39-48 (`new PGlite()`, applies every `migrations/*.sql` via `pg.exec`, `drizzle(pg,{schema})`); existing grant idempotency test L75-87; dup-email test L71-73
- `packages/entitlements/src/engine.ts` — `grantManual` L159-172, `applyBillingEvent` L197-213
- `packages/entitlements/src/state-machine.ts` — `nextStatus` L47-91 (`manual_grant → 'active'` L55-56)
- `node_modules/@electric-sql/pglite/dist/index.d.ts` — `NoticeOrError`/`DatabaseError` expose `code: string | undefined` (L109-135)
- Context/governance: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, `docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md`, `docs/handoffs/20260529-1921-db-postgres-persistence-auditor.md` (the prior DB auditor handoff; the kickoff's `20260529-1921-db-postgres-persistence-auditor.md` path was correct, the `…-1921-phase-1-5-…` path resolved to the aggregate)

## Files changed
None — read-only audit

## Findings

### Finding 1 — CONFIRMED: `grantProduct` SELECT-then-(INSERT|UPDATE) is NOT idempotent under concurrent grants (unique-violation race)
- **Severity:** HIGH
- **Evidence:** `packages/db/src/repositories.ts:115-127`. Inside one `db.transaction`:
  - L117 `const [existing] = await tx.select().from(s.entitlements).where(and(eq(userId), eq(productCode))).limit(1);`
  - L118-120 if `existing` → `applyBillingEvent(...,'manual_grant')` then `tx.update(...)`
  - L121-124 else → `grantManual(...)` then **`tx.insert(s.entitlements).values({ userId, productCode, ... })`** (no `onConflict`)
  - L125 `tx.insert(s.auditLogs).values(...)` (audit row in the same txn — good)
  - The unique target exists: `entitlements_user_product_idx` UNIQUE on `(user_id, product_code)` (`schema.ts:85`; migration `0001_early_toad_men.sql:2`).
- **Why it races:** Postgres default isolation is **READ COMMITTED**. Two concurrent `grantProduct(user, product)` transactions, when no row exists yet, BOTH execute the L117 SELECT and BOTH see "no existing row" (neither sees the other's uncommitted INSERT). Both take the `else` branch and both attempt the L123 INSERT. The first commits; the second hits the `(user_id, product_code)` unique index and throws Postgres `23505` (unique_violation). The transaction aborts and the error propagates out of `grantProduct`. So a duplicate concurrent grant is **non-idempotent**: it raises instead of being a no-op/refresh. (The unique index does correctly prevent a duplicate ROW — the defect is the unhandled THROW, not row duplication.)
- **Note on the existing test:** `tests/integration/db-persistence.test.ts:77-79` calls `grantProduct` twice **sequentially** ("idempotent") — that path is fine because the 2nd call sees the row and UPDATEs. It does NOT cover the concurrent case, so the race is currently untested.
- **Recommendation:** Replace the SELECT-then-branch with a single DB-level upsert (`onConflictDoUpdate`) so concurrent duplicates collapse to one INSERT + one UPDATE-on-conflict and never raise 23505. Keep the audit insert in the same txn.
- **Concrete target fix:** see Decision 1 (exact target columns + set clause + how status semantics are preserved).

### Finding 2 — CONFIRMED: `createUser` concurrent duplicate email surfaces a raw `23505`, not the friendly `'email already registered'`
- **Severity:** MEDIUM
- **Evidence:** `packages/db/src/repositories.ts:60-72`. Inside one `db.transaction`:
  - L65 `const [existing] = await tx.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);`
  - L66 `if (existing) throw new Error('email already registered');`
  - L67 `tx.insert(s.users).values({ email, ... }).returning();`
  - `users.email` is UNIQUE (`schema.ts:23` `users_email_idx`; migration `0000:215`).
- **Why it races:** Same READ COMMITTED window as Finding 1. Two concurrent `createUser` calls for the same email both pass the L65-66 check (neither sees the other's uncommitted row), both attempt the L67 INSERT; one commits, the other throws raw `23505`. So the friendly `'email already registered'` is only guaranteed on the **sequential** path (the existing test `tests/integration/db-persistence.test.ts:71-73` exercises only that). Under concurrency the caller gets an opaque unique-violation error with a different `message`, breaking the single stable error contract.
- **Recommendation:** **Option (a) — graceful.** Catch the unique violation inside `createUser` and rethrow the friendly error, so callers see ONE contract (`'email already registered'`) regardless of sequential-vs-concurrent timing. Rationale: the registration action and any UI already key off that message; leaking `23505`/Postgres text is worse UX and a (minor) implementation-detail leak. Option (b) (document the raw violation) is acceptable but pushes 23505-handling onto every caller. **Recommend (a).** Lock the chosen behaviour with the concurrent test in Verification §3.
- **Concrete target fix:** see Decision 2.

### Finding 3 — INFO/LOW: `revokeProduct` and `addExchangeKey` are NOT exposed to the same insert-race; no change required for Task B
- **Severity:** LOW (informational — scope confirmation)
- **Evidence:**
  - `revokeProduct` (`repositories.ts:129-137`): SELECT (L131), `if (!existing) return;` (L132), then UPDATE by `existing.id` (L134) + audit (L135). It only ever UPDATEs an existing row and short-circuits when none exists. Concurrent revokes of the same row both UPDATE to `revoked` (idempotent end-state); concurrent grant-vs-revoke is a last-writer-wins status race, not a unique-violation. No INSERT, so no 23505 path. (A grant racing a revoke could still interleave, but that is a business-ordering concern, not the duplicate-row race in scope.)
  - `addExchangeKey` (`repositories.ts:149-164`): two INSERTs (account, then sealed secret) in one txn. `exchange_accounts` has NO unique business key (`schema.ts:100-108` — only the PK uuid), so repeated calls intentionally create distinct accounts; there is no ON CONFLICT target and no duplicate-key race. Atomicity is already correct (both rows commit or roll back together).
- **Recommendation:** None for Task B. The two race fixes are `grantProduct` (Finding 1) and `createUser` (Finding 2).

### Finding 4 — INFO: audit-row semantics for a duplicate grant must be defined before the test can assert a count
- **Severity:** LOW (test-design prerequisite)
- **Evidence:** `grantProduct` always inserts exactly one `auditLogs` row per call (`repositories.ts:125`), regardless of insert-vs-update branch. With the upsert fix, each of two concurrent calls still runs to completion and still writes its own audit row → **two audit rows** for two grant calls of the same `(user, product)`. There is no de-duplication of audit on a no-op refresh, and per the audit model (append-only, every mutation audited — `AGENTS.md` "every mutation … audit log") that is the correct/honest behaviour: two admin actions occurred, two audit rows.
- **Recommendation:** Adopt "one audit row per `grantProduct` call" as the contract and assert it explicitly (Verification §2). Do NOT silently let the count be unasserted.

## Decisions

### Decision 1 — Exact `grantProduct` upsert fix (target columns + set clause + preserved semantics)
Replace the SELECT + if/else INSERT/UPDATE (`repositories.ts:117-124`) with a single
`onConflictDoUpdate`, keeping the audit insert (L125) in the same transaction.

**Target columns:** `[s.entitlements.userId, s.entitlements.productCode]` (matches the UNIQUE
`entitlements_user_product_idx`).

**Status semantics check (load-bearing):** both prior branches resolve to `status: 'active'`:
- new-row branch used `grantManual()` → `state-machine.nextStatus(_, 'manual_grant') = 'active'` (`state-machine.ts:55-56`) and `grantManual` sets `status:'active'` (`engine.ts:163`).
- existing-row branch used `applyBillingEvent(existing,'manual_grant')` → `manual_grant` is an admin event applied from ANY state and also yields `'active'` (`engine.ts:203-204`, `state-machine.ts:55-56`).
So the post-grant status is **`'active'`** in every case, and the upsert SET clause can set
`status: 'active'` directly. (`manual_grant` never downgrades — it always activates — so there is no
state where the upsert would differ from the old branch logic for `status`.) The only branch
difference was in non-status fields: the INSERT branch seeded `source:'manual_grant'`,
`planCode:'admin_grant'`, `startsAt:now`; the UPDATE branch left the existing row's `source`/`planCode`
untouched. Preserve that by only inserting those defaults and NOT overwriting `source`/`planCode` on
conflict (a manual grant should not clobber an existing subscription's `source`/`planCode`).

**Code sketch (illustrative — implementer writes the real edit; auditor does not edit):**
```ts
export async function grantProduct(db: Db, userId: string, productCode: ProductCode, now = Date.now()): Promise<void> {
  await db.transaction(async (tx) => {
    const fresh = grantManual(userId, productCode, now); // status 'active', source 'manual_grant', planCode 'admin_grant', manualOverride true
    await tx
      .insert(s.entitlements)
      .values({
        userId,
        productCode,
        status: fresh.status,          // 'active'
        source: fresh.source,          // 'manual_grant'  (insert-only default)
        planCode: fresh.planCode,      // 'admin_grant'   (insert-only default)
        manualOverride: true,
        startsAt: new Date(now),
        updatedAt: new Date(now),
      })
      .onConflictDoUpdate({
        target: [s.entitlements.userId, s.entitlements.productCode],
        // refresh path == old UPDATE branch: activate + mark manual override, bump updatedAt.
        // Do NOT overwrite source/planCode/startsAt on conflict (preserve an existing subscription's metadata).
        set: { status: 'active', manualOverride: true, updatedAt: new Date(now) },
      });
    await tx.insert(s.auditLogs).values(
      auditRowValues({ actorRole: 'admin', action: 'product.grant', targetType: 'entitlement', targetId: `${userId}:${productCode}`, after: { status: 'active' } }),
    );
  });
}
```
Notes:
- Because both old branches produced `status:'active'`, the static `set: { status: 'active', ... }`
  is faithful. If a future change makes the post-grant status depend on the existing row, switch to a
  **read-after-upsert** (re-SELECT the row inside the same `tx` and recompute via `applyBillingEvent`)
  rather than a static set — but that is NOT needed today for `manual_grant`.
- Under concurrency: both txns attempt the INSERT; the loser's INSERT hits the unique index and is
  redirected to the `DO UPDATE` branch instead of raising 23505 → idempotent, exactly one row, no throw.
- The audit insert stays inside `tx` (atomicity preserved per Phase 1.5 Decision).

### Decision 2 — Exact `createUser` fix (graceful 23505 → friendly error)
Keep the in-txn `SELECT` (it still gives the fast/friendly path for the common sequential case) but
wrap the user INSERT so a concurrent unique violation is translated. Detect via `err.code === '23505'`
(works for both drivers — see Finding/Decision 3 below). Sketch:
```ts
return db.transaction(async (tx) => {
  const [existing] = await tx.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);
  if (existing) throw new Error('email already registered');
  let u;
  try {
    [u] = await tx.insert(s.users).values({ email: input.email, passwordHash: input.passwordHash, displayName: input.displayName }).returning();
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new Error('email already registered');
    throw e;
  }
  if (!u) throw new Error('failed to insert user');
  for (const r of roles) await tx.insert(s.userRoles).values({ userId: u.id, roleCode: r }).onConflictDoNothing();
  return { id: u.id, email: u.email, displayName: input.displayName, passwordHash: u.passwordHash, roles };
});
```
Caveat for the implementer: in postgres-js, once a statement errors inside a transaction the txn is
aborted, so catching 23505 and continuing to issue more statements on the same `tx` would fail. Here
it is safe because the catch immediately `throw`s (rolling back) — it does not try to continue. If a
"swallow + continue" approach is ever wanted, it must run in its own txn/savepoint.

### Decision 3 — PGlite vs postgres-js: `ON CONFLICT` and unique-violation detection are portable
- **ON CONFLICT:** PGlite is real Postgres (WASM), so `INSERT ... ON CONFLICT (...) DO UPDATE` and
  Drizzle's `.onConflictDoUpdate({ target, set })` behave identically to postgres-js. The existing
  test already relies on PGlite executing the real migration SQL (`db-persistence.test.ts:39-48`) and
  on `onConflictDoNothing` in the seed, so the upsert is exercisable in PGlite with no shim.
- **Error code surfacing:** PGlite's error object is a `DatabaseError implements NoticeOrError` with a
  `code: string | undefined` field (`node_modules/@electric-sql/pglite/dist/index.d.ts:109-135`), and
  it carries the Postgres SQLSTATE `'23505'` for unique violations. postgres-js likewise exposes
  `.code` on its `PostgresError`. **Therefore `err.code === '23505'` is the portable detector across
  both drivers** and is what both the `createUser` fix and the test should use. Detect by **code, not
  message** (messages differ between engines). A defensive test MAY also tolerate a message regex as a
  fallback, but `code` is the primary, portable signal.

### Decision 4 — Audit-row contract for duplicate grants
One audit row per `grantProduct` call (Finding 4). Two concurrent grants of the same `(user, product)`
⇒ exactly **2** `product.grant` audit rows. Assert this number explicitly in the test.

## Risks
- **Concurrent grant 23505 in production (Finding 1):** today a webhook-driven grant racing an admin
  grant (or a double-clicked admin action) can throw a unique violation and surface as a 500 / failed
  action, even though the end-state is fine. The upsert removes this. Until fixed, treat concurrent
  manual grants as non-idempotent.
- **`createUser` error-contract drift (Finding 2):** under concurrent signups the caller may currently
  receive `23505` text instead of `'email already registered'`; any UI/branching keyed on the friendly
  message misbehaves on that race. Low frequency, but the fix is cheap.
- **Upsert SET correctness:** the static `set: { status:'active', ... }` is only valid because
  `manual_grant` always activates. If the grant action is later generalised (e.g. graded grants with
  expiry, or non-activating admin events routed through this function), switch to read-after-upsert to
  recompute status; otherwise the SET could mask a non-`active` intended state.
- **Transaction-abort-then-continue trap:** any future "catch 23505 and keep using the same `tx`" code
  will fail in postgres-js (aborted txn). The recommended fixes avoid this by re-throwing immediately.
- **Test isolation:** the PGlite instance is shared across the file via `beforeAll` (one `new PGlite()`
  for all `it`s). New concurrent-race tests should use a FRESH email and a product not already granted
  to the chosen user (e.g. grant a not-yet-entitled product to `admin@wtc.local`, or create a dedicated
  user) so prior tests' rows don't pre-satisfy the conflict and mask the race.

## Verification/tests
No gates were run (read-only; per kickoff). Tests to ADD to
`tests/integration/db-persistence.test.ts` (PGlite-backed; same `db` harness). These currently FAIL
against the SELECT-then-INSERT code (Finding 1) and the raw-23505 `createUser` (Finding 2), and PASS
after the Decision 1 / Decision 2 fixes — i.e. they lock in the fixes.

**1. Concurrent duplicate grant is idempotent — exactly one row, no throw.**
Use a user+product NOT already entitled (grant a fresh product to the admin so seed rows don't mask it):
```ts
it('grantProduct: concurrent duplicate grants are idempotent (one row, no throw)', async () => {
  const admin = await findUserByEmail(db, 'admin@wtc.local');
  // 'club' is not seeded for admin → forces the INSERT/conflict path for BOTH calls.
  await expect(
    Promise.all([grantProduct(db, admin!.id, 'club'), grantProduct(db, admin!.id, 'club')]),
  ).resolves.toBeDefined(); // must NOT reject with a 23505 unique violation
  const rows = (await entitlementsOf(db, admin!.id)).filter((e) => e.productCode === 'club');
  expect(rows).toHaveLength(1);                       // unique index → exactly one row
  expect(rows[0]!.status).toBe('active');             // manual_grant activates
});
```
(If `club` is already used by the existing grant/revoke test ordering, use a distinct product code or a
freshly `createUser`'d user to guarantee the conflict path is hit by both concurrent calls.)

**2. Audit-row count for duplicate grants is defined and asserted (Decision 4).**
```ts
it('grantProduct: each grant call writes its own audit row (2 calls ⇒ 2 product.grant rows)', async () => {
  const u = await createUser(db, { email: `grant-audit-${Date.now()}@wtc.local`, passwordHash: 'x', displayName: 'GA' });
  await Promise.all([grantProduct(db, u.id, 'club'), grantProduct(db, u.id, 'club')]);
  const events = await recentAuditEvents(db, 1000);
  const grants = events.filter((e) => e.action === 'product.grant' && e.targetId === `${u.id}:club`);
  expect(grants).toHaveLength(2);                     // one audit row per call (append-only)
});
```

**3. `createUser` concurrent duplicate email — graceful friendly error (Decision 2 / Option a).**
```ts
it('createUser: concurrent duplicate email yields one user and a friendly rejection', async () => {
  const email = `dup-race-${Date.now()}@wtc.local`;
  const results = await Promise.allSettled([
    createUser(db, { email, passwordHash: 'x', displayName: 'A' }),
    createUser(db, { email, passwordHash: 'x', displayName: 'B' }),
  ]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected  = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  expect(fulfilled).toHaveLength(1);
  expect(rejected).toHaveLength(1);
  // chosen behaviour = graceful: the friendly message, NOT a raw 23505
  expect(String(rejected[0].reason?.message ?? rejected[0].reason)).toMatch(/already registered/i);
  // exactly one row persisted
  const u = await findUserByEmail(db, email);
  expect(u).not.toBeNull();
});
```
If the team instead picks Option (b) (document the raw violation), replace the message assertion with a
portable code check:
```ts
const reason = rejected[0].reason as { code?: string; message?: string };
expect(reason.code === '23505' || /unique|duplicate/i.test(String(reason.message))).toBe(true);
```
…but recommended is Option (a) (assert the friendly message).

**Determinism note:** PGlite runs in-process; `Promise.all`/`Promise.allSettled` interleave the two
transactions on one connection-less engine. The race is still reproduced because both transactions run
their SELECT before either INSERT commits; the unique index forces the conflict deterministically. No
sleeps needed.

## Next actions
1. **Implementer (backend/db):** apply Decision 1 (`grantProduct` → `onConflictDoUpdate` with target
   `[entitlements.userId, entitlements.productCode]`, set `{ status:'active', manualOverride:true,
   updatedAt }`, audit insert kept in-txn) and Decision 2 (`createUser` catch `23505` → rethrow
   `'email already registered'`). No schema/migration change needed — the UNIQUE index already exists
   (`0001_early_toad_men.sql`).
2. **Implementer:** add the three tests in Verification §1-§3 to `tests/integration/db-persistence.test.ts`.
3. **tests-runner:** run `npm test` (Vitest, PGlite) to confirm the new tests pass and the suite stays
   green; this is the gate for Task B. (`db:migrate`/`db:seed` against real Postgres remains the
   separate, still-NOT-RUN gate per `docs/STATUS.md`/`docs/NEXT_ACTIONS.md`.)
4. **Optional follow-up (out of Task B scope):** if a future grant path becomes non-activating, switch
   the upsert SET to read-after-upsert + `applyBillingEvent` to recompute status (see Risks).
