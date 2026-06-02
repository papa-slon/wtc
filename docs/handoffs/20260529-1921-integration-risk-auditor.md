# integration-risk-auditor handoff

_2026-05-29 19:21. Read-only audit of Phase 1.5 integration seams. No live servers touched, no code modified._

## Scope

Cross-cutting integration risk for Phase 1.5. Focused on:
(A) TvAccessService/LmsService async migration call-site breakage  
(B) DB transaction + unique-constraint gaps; migration drift  
(C) `__Host-` session cookie impact on local HTTP dev  
(D) Worker job_queue durability reality  
(E) Wired-but-mock surfaces

Files inspected: `apps/web/src/lib/backend.ts`, `db-store.ts`, `demo.ts`, `apps/web/src/lib/session.ts`,
`apps/web/src/lib/csrf.tsx`, `apps/web/src/app/(auth)/actions.ts`,
`apps/web/src/app/(app)/app/indicators/page.tsx`,
`apps/web/src/app/(app)/app/education/page.tsx`,
`apps/web/src/app/(app)/app/terminal/page.tsx`,
`apps/web/src/app/admin/page.tsx`,
`apps/web/src/app/admin/tradingview-access/page.tsx`,
`apps/web/src/app/teacher/page.tsx`,
`apps/worker/src/index.ts`, `apps/worker/src/jobs.ts`, `apps/worker/src/tick-once.ts`,
`packages/tradingview-access/src/index.ts`,
`packages/lms/src/index.ts`,
`packages/bot-adapters/src/http.ts`,
`packages/axioma-bridge/src/bridge.ts`,
`packages/billing/src/webhook.ts`, `packages/billing/src/provider.ts`,
`packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `packages/db/src/seed.ts`,
`packages/db/migrations/0000_broken_jack_murdock.sql`,
`packages/auth/src/session.ts`,
`packages/audit/src/audit.ts`, `packages/audit/src/redact.ts`,
`docs/NEXT_ACTIONS.md`, `docs/STATUS.md`,
`docs/handoffs/20260529-phase1-persistence-hardening.md`,
`docs/IMPLEMENTED_FILES.md`, `playwright.config.ts`

## Files changed

None — read-only audit.

## Findings

### 1. [HIGH] (A) Ten synchronous call sites will silently break when TvAccessService/LmsService are made async

All current call sites omit `await` because the in-memory implementations are synchronous. Phase 1.5 replaces these with async DB repo calls. Without `await`, server actions return before the DB write completes; page components return stale/empty data.

**Call sites (all in `apps/web/src/`):**

| File | Line | Call | Risk |
|---|---|---|---|
| `app/(app)/app/indicators/page.tsx` | 18 | `tvService.submitRequest(...)` | server action returns before DB insert; user sees no confirmation |
| `app/(app)/app/indicators/page.tsx` | 32 | `tvStore.list()` | returns empty/undefined instead of DB rows |
| `app/admin/tradingview-access/page.tsx` | 16 | `tvService.grant(...)` | server action returns before DB update |
| `app/admin/tradingview-access/page.tsx` | 24 | `tvService.revoke(...)` | server action returns before DB update |
| `app/admin/tradingview-access/page.tsx` | 33 | `tvStore.list()` | returns [] instead of DB rows |
| `app/admin/page.tsx` | 7 | `tvStore.list(...)` | badge count always 0 with DB backend |
| `app/teacher/page.tsx` | 14 | `lmsService.createCourse(...)` | course not persisted before revalidatePath |
| `app/teacher/page.tsx` | 27 | `lmsStore.courses.values()` | returns empty map |
| `app/(app)/app/education/page.tsx` | 19 | `lmsStore.courses.values()` | returns empty map |
| `app/(app)/app/education/page.tsx` | 28 | `lmsService.listLessonsForStudent(...)` | returns [] |

**Recommendation:** Before Phase 1.5 touches the service/store interfaces, audit-stamp all ten call sites with `// PHASE-1.5: must await` markers. Then add `await` atomically when the interface changes. Add a typecheck-enforced `AsyncTvStore` / `AsyncLmsStore` interface so TypeScript catches missing awaits at compile time.

---

### 2. [HIGH] (A) Type mismatch: TvRequest.requestedAt and expiresAt are Date in DB but number in in-memory interface

`packages/tradingview-access/src/index.ts:13` defines `requestedAt: number`. The DB type `TvRequest = typeof s.tradingviewAccessRequests.$inferSelect` (repositories.ts:187) returns `requestedAt: Date` and `expiresAt: Date | null`. `fmtDate()` (`apps/web/src/lib/format.ts:23`) expects `number | null | undefined`. When the indicators page or admin TV page calls `fmtDate(r.requestedAt)` or `fmtDate(r.expiresAt ?? null)` with a DB-backed row, it will receive a `Date` object, causing `new Date(dateObject).toISOString()` to output `Invalid Date` or wrong formatting (Date constructor accepts Date objects, so actually this degrades gracefully to a string representation but TypeScript will flag it once the types diverge).

**Call sites:**
- `apps/web/src/app/(app)/app/indicators/page.tsx:53` — `fmtDate(r.requestedAt)` (TvAccessRequest type, number)
- `apps/web/src/app/(app)/app/indicators/page.tsx:54` — `fmtDate(r.expiresAt ?? null)`
- `apps/web/src/app/admin/tradingview-access/page.tsx:49` — `fmtDate(r.expiresAt ?? null)`

**Recommendation:** When migrating to DB-backed TV, normalise the returned `TvRequest` to a DTO with millisecond-epoch timestamps (`.getTime()`) before passing to the UI layer — identical to how `rowToEntitlement` in `repositories.ts:86` normalises entitlement timestamps. Do not pass raw `$inferSelect` rows to page components.

---

### 3. [HIGH] (B) No unique constraint on entitlements(userId, productCode) — race window allows duplicate rows

`packages/db/src/schema.ts:83` defines `entitlements_user_product_idx` as a plain `index`, not `uniqueIndex`. The `grantProduct` function (`packages/db/src/repositories.ts:108-118`) does a non-atomic SELECT then INSERT without a DB transaction. Two concurrent admin actions or a billing webhook + admin action in the same millisecond window can both pass the existence check and both insert, creating two active entitlement rows for the same product. `entitlementsOf` would then return both rows; `explainAccess` would pick the first — but revoke would update only the first matching row, leaving a ghost active row.

**Recommendation:** Add `uniqueIndex('entitlements_user_product_uq').on(t.userId, t.productCode)` to the entitlements table in `schema.ts`. Regenerate the migration. Also wrap `grantProduct` and `revokeProduct` in a Drizzle transaction (`db.transaction()`). This requires a new migration file — existing `0000_*.sql` should not be edited; generate `0001_*.sql`. Run against the real Postgres 17 at 127.0.0.1:5432 before wiring the production backend selector.

---

### 4. [HIGH] (D) job_queue is a structural fake — no code ever reads from it or claims jobs

`packages/db/src/schema.ts:215-227` defines `job_queue` with `lockedAt`, `doneAt`, `attempts` columns (the anatomy of a proper durable queue). The comment in `apps/worker/src/jobs.ts:3` states "A durable queue (job_queue table) replaces the in-memory demo loop in production." However:

- `packages/db/src/repositories.ts` has **no function** that inserts into, selects from, locks, or marks done any `job_queue` row.
- `packages/db/src/index.ts` exports nothing related to `jobQueue`.
- `apps/worker/src/index.ts:12-19` calls `reconcileAllEntitlements`, `sweepTvExpiry`, and `recordHealthCheck` directly — a cron loop, not a queue consumer.
- Searching the entire codebase finds zero usages of `jobQueue` outside the schema definition and the migration SQL.

The `job_queue` table will be created by migration and accumulate no rows. The worker comment creates a false impression of durable-queue semantics. In production, a worker crash mid-tick loses work with no retry, and no visibility into what ran.

**Recommendation:** Either (a) implement a minimal `claimJob`/`markJobDone` function in repositories and have the worker insert + claim jobs (providing real durability), or (b) remove `lockedAt`/`doneAt`/`attempts` from the schema and update the comment to honestly say "cron-style direct invocations; not a consumed queue". Until this is resolved, document the real failure mode: a worker process crash loses in-progress reconciliation with no retry.

---

### 5. [MEDIUM] (B/E) tradingview_access_tasks accumulate without consumption

`packages/db/src/repositories.ts:215` inserts a `tradingview_access_tasks` row for each expired grant during `sweepTvExpiry`. No code reads these tasks back, marks them done, or acts on them. Tasks grow unboundedly in the DB. The `done` column is always `false`. The `TvAccessTask` type and `listTasks`/`addTask` in the in-memory store have no DB equivalents in repositories.

**Recommendation:** Add `listPendingTvTasks(db)` and `markTvTaskDone(db, taskId)` to repositories. Wire the worker's dbTick to read pending tasks and process them (admin notification or automated TradingView revocation call). Until implemented, add a DB cleanup script or cron to prevent unbounded growth.

---

### 6. [MEDIUM] (C) `__Host-` cookie is documented but NOT currently wired in the app; migration to it must be done atomically

`packages/auth/src/session.ts:34-38` correctly defines `SESSION_COOKIE_PROD = '__Host-wtc_session'` and `sessionCookieName(isProd)`. However, `apps/web/src/lib/session.ts:6` hardcodes `SESSION_COOKIE = 'wtc_session'` (the plain dev name) and never calls `sessionCookieName()`. The login action at `apps/web/src/app/(auth)/actions.ts:14` uses this hardcoded name.

When NEXT_ACTIONS item 5 ("prod session cookie uses `__Host-` prefix over TLS") is implemented:
- If the implementer calls `sessionCookieName(process.env.NODE_ENV === 'production')`, dev over HTTP (`:3000`/`:3100`) correctly gets `wtc_session` and prod gets `__Host-wtc_session`.
- `__Host-` requires `Secure` attribute, `Path=/`, and no `Domain` attribute. If any of these is missing the browser silently rejects the cookie, logging out all users.
- Existing sessions set under `wtc_session` will be orphaned when the cookie name changes — all users are logged out on the next deploy.

**Dev break risk:** `playwright.config.ts:3` explicitly notes "E2E uses the dev server (NODE_ENV=development) so session cookies are not Secure-only over http." Local dev at port 3000/3100 will break if `__Host-` is applied without the `isProd` guard.

**Recommendation:** (1) Replace the hardcoded `SESSION_COOKIE` in `apps/web/src/lib/session.ts` and `actions.ts` with `sessionCookieName(process.env.NODE_ENV === 'production')`. (2) Add a migration notice: deploy a version that reads both names for one release cycle. (3) Confirm `secure: true` is set in `sessionCookieOptions(isProd=true)` — it is (`session.ts:51`), so the `actions.ts:16` inline `secure: process.env.NODE_ENV === 'production'` is consistent. (4) Verify in integration test that the `__Host-` cookie is accepted by the test browser under TLS.

---

### 7. [MEDIUM] (E) Axioma bridge always uses mock — no real bridge factory exists

`apps/web/src/app/(app)/app/terminal/page.tsx:13` always calls `createMockAxiomaBridge()`. There is no `createAxiomaBridge()` or real bridge implementation in `packages/axioma-bridge`. The UI correctly labels this as a dev placeholder. However `AXIOMA_JOURNAL_BASE_URL` and `AXIOMA_BRIDGE_API_TOKEN` are referenced inconsistently: the bridge uses `AXIOMA_JOURNAL_BASE_URL` for `baseUrl` (terminal/page.tsx:14) but `axiomaBridgeIsDev()` checks `AXIOMA_BRIDGE_API_TOKEN` (`apps/web/src/lib/server-config.ts:19`). These are two different env vars; setting one does not configure the other.

**Recommendation:** Align env var usage: use one canonical `AXIOMA_BRIDGE_API_TOKEN` to both detect dev mode and authenticate real calls. Document as a blocking dependency for Phase 1.5 Axioma work: the real bridge factory cannot be written until the `journal_server` endpoint shapes are confirmed per CONTRACTS/axioma-bridge.md.

---

### 8. [MEDIUM] (E) Bot adapters throw AdapterNotReadyError on all data methods except health

`packages/bot-adapters/src/http.ts:77,80,84,88` (Tortila) and equivalent lines for Legacy all throw `AdapterNotReadyError` for `getConfig`, `getMetrics`, `getPositions`, `getTrades`. Only `getHealth()` makes a real HTTP call (but returns `status: 'degraded'` always due to persistent P0/P1 warnings). Setting `BOT_ADAPTER_MODE=read-only` will throw on every dashboard data fetch, making the bot pages non-functional even though the mode name implies read capability.

**Recommendation:** Add a note in CONTRACTS that `BOT_ADAPTER_MODE=read-only` is not yet safe to activate in the UI (all dashboard data calls throw). The UI should catch `AdapterNotReadyError` and display a "data not yet available" state rather than an unhandled error boundary.

---

### 9. [LOW] (B) requestedAt/created_at column naming drift risk in tradingviewAccessRequests

`packages/db/src/schema.ts:151` uses `requestedAt: createdAt()` which maps the JS field `requestedAt` to the SQL column `created_at` (not `requested_at`). This is consistent in Drizzle's ORM layer and the insert at `repositories.ts:190` is correct. However, the migration SQL at line 165 shows `"created_at"` — if a future migration adds a separate `requested_at` column, the naming will collide ambiguously.

**Recommendation:** Rename the Drizzle field to `createdAt` (to match the SQL column name semantically) and add a separate explicit `requestedAt` column (`timestamp('requested_at')`). This requires a `0001_*.sql` migration. Low urgency but fix before the TV DB wire-up to avoid confusion.

---

### 10. [LOW] (E) demo.ts addExchangeKey passes raw secrets to audit.write — relying on redact() to catch them

`apps/web/src/lib/demo.ts:208` passes `{ exchange, apiKey, apiSecret }` to `audit.write`. The audit's `buildEvent()` runs `redact()` which normalises keys and checks against `SECRET_HINTS` (`packages/audit/src/redact.ts:9` — `'apikey'` matches). So the data is correctly redacted before storage. However the pattern is a maintenance risk: any future `after` field that includes secrets under a non-standard key name (e.g. `key`, `secret_val`) would pass through unredacted.

**Recommendation:** Change `demo.ts:208` to pass `after: { exchange: input.exchange }` (never include the raw key material in the audit input, even knowing redact() will catch it). Defence-in-depth: do not rely solely on the redaction layer.

---

## Decisions

- The `job_queue` table must be explicitly declared as either (a) a future capability with `lockedAt`/`doneAt` pending implementation or (b) removed and replaced with a documented cron comment. The current state is misleading.
- Phase 1.5 service async migration must happen as a single atomic PR: schema + repositories + all call sites + type normalisation for date fields. Partial migration (async interface but no await at call sites) will silently lose data in server actions.
- The unique constraint on `entitlements` must ship in the Phase 1.5 migration batch, not deferred.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Partial async migration leaves unawaited server actions | High (easy to miss) | High (silent data loss) | Atomic PR; typecheck enforces; mark sites first |
| Duplicate entitlement rows from concurrent grants | Low in dev, medium in prod with real billing | High (ghost active entitlements) | Add uniqueIndex + transaction before billing goes live |
| `__Host-` misconfiguration logs out all users on deploy | Medium | High (all users) | Implement with `isProd` guard; two-name read period |
| job_queue grows with `tradingview_access_tasks` | Certain (every sweep) | Low short-term, high long-term | Implement consumption or add cleanup |
| AdapterNotReadyError surfaces as error boundary in UI | Certain if BOT_ADAPTER_MODE=read-only | Medium (dashboard unusable) | UI catch layer for this error type |

## Verification / tests

- After adding `uniqueIndex` on entitlements: run `npm run db:generate -w @wtc/db` and verify new migration, then run `npm test` to confirm PGlite integration tests still pass.
- For async migration: add a Vitest test that mocks the DB-backed TvAccessService with a delayed async submit and verifies the server action awaits it.
- For `__Host-` cookies: add a test in `packages/auth` that verifies `sessionCookieName(true)` returns `__Host-wtc_session` and `sessionCookieName(false)` returns `wtc_session`.
- For job_queue: add a PGlite integration test that inserts a job, calls `claimJob`, asserts `lockedAt` is set, calls `markJobDone`, asserts `doneAt` is set.

## Next actions

Ordered by risk priority:

1. **[Immediate, before any Phase 1.5 code]** Mark all 10 synchronous TV/LMS call sites in `apps/web` with `// PHASE-1.5: must await` comments so they are not silently broken during refactor.
2. **[Phase 1.5 migration PR]** Add `uniqueIndex` on `entitlements(userId, productCode)` + `db.transaction()` wraps in `grantProduct`/`revokeProduct`. Generate new migration `0001_*.sql`. Run against Postgres 17 at 127.0.0.1:5432 once credentials are available.
3. **[Phase 1.5 migration PR]** Migrate TvAccessService and LmsService to async repo interfaces, adding `await` at all 10 call sites atomically. Normalise `TvRequest` timestamps to epoch-ms DTOs before UI layer.
4. **[Phase 1.5 auth hardening]** Wire `sessionCookieName(isProd)` in `apps/web/src/lib/session.ts` and `actions.ts`. Test under HTTP dev to confirm `wtc_session` is used. Test under production TLS to confirm `__Host-` is accepted.
5. **[Worker hardening]** Implement `listPendingTvTasks`/`markTvTaskDone` in repositories. Either connect `job_queue` to worker consumption or remove misleading columns and update the comment.
6. **[Before `BOT_ADAPTER_MODE=read-only` in UI]** Add `AdapterNotReadyError` catch in bot dashboard pages to display a graceful "not yet available" state.
7. **[Before Axioma Phase 1.5]** Align `AXIOMA_BRIDGE_API_TOKEN` and `AXIOMA_JOURNAL_BASE_URL` usage into a single env var check. Do not implement the real bridge until `journal_server` endpoint shapes are confirmed.
