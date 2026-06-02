# ecosystem-platform-architect handoff

Epoch: 20260530-0925. Phase 2.1 — read-only verification audit of the serial spine S-1→S-8 and
parallel groups P-A→P-E against current code. No code or shared docs edited this session.

---

## Scope

1. Verify the S-1→S-8 serial spine and P-A→P-E parallel groups are correct and collision-free
   against the actual files on disk as of epoch 20260530-0925.
2. Confirm the `features/<domain>/{queries,actions,schemas,types}.ts` layout rule and the
   "computeMetrics only in queries.ts" constraint.
3. Confirm the shared-file single-writer set and that parallel group file sets remain disjoint.
4. Produce a precise, operator-ready build checklist and a priority ranking of the four highest-
   value / lowest-risk parallel surfaces.

---

## Files inspected

- `AGENTS.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260530-0126-ecosystem-platform-architect.md`
- `docs/handoffs/20260530-0126-ecosystem-db-architect.md`
- `docs/ARCHITECTURE.md` (§§1–11)
- `docs/ARCHITECTURE_DECISIONS.md` (ADR-001 through ADR-014)
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/web/src/lib/lms-types.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts` (all sections)
- `packages/analytics/src/metrics.ts`
- `packages/analytics/src/index.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/lms/src/index.ts`
- `packages/billing/src/index.ts`
- `packages/billing/src/provider.ts`
- `packages/billing/src/webhook.ts`
- `packages/axioma-bridge/src/bridge.ts`
- `packages/axioma-bridge/src/handoff.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/(public)/products/page.tsx`
- `apps/web/src/app/teacher/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/api/**` (glob — no files found; the `/api/` directory does not exist yet)
- `apps/web/src/features/**` (glob — only `bots/meta.ts` and `bots/data.tsx` exist)

---

## Files changed

None — read-only audit (this handoff only).

---

## Findings

### F-01 — [HIGH] `features/` layout violation in existing bot pages: `computeMetrics` and `combineMetrics` called directly in page.tsx files, not in queries.ts

**Evidence:**
- `apps/web/src/app/(app)/app/bots/page.tsx:5` imports `combineMetrics` from `@wtc/analytics` and
  calls it directly in the page component.
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx:2` imports `filterZeroEquity` from
  `@wtc/analytics` and calls it inline.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` calls `adapter.getMetrics()` directly and uses
  the raw result inline with no `queries.ts` intermediary.
- None of the bot sub-pages use `features/bots/{tortila,legacy}/queries.ts` — those files do not
  exist yet (only `features/bots/meta.ts` and `features/bots/data.tsx` exist).

**Implication:** ADR-013 ("page.tsx files are thin shells; no data fetching beyond calling a
queries.ts function") is already violated by the current bot pages. The P-C parallel group plan
says to extend these pages, but it must also REFACTOR the existing bot pages to move
`computeMetrics`/`combineMetrics`/`filterZeroEquity` calls out of the page components and into
the new `features/bots/{tortila,legacy}/queries.ts` files.

**Recommendation:** P-C implementer must treat the existing bot pages as rewrites, not extensions.
The refactor is safe (same data, same output) but must be scoped explicitly. Add a gate: after
the P-C refactor, grep for `@wtc/analytics` in any `page.tsx` file — result must be zero.

---

### F-02 — [HIGH] `apps/web/src/app/teacher/page.tsx` contains a server action with inline RBAC and business logic — violates ADR-013

**Evidence:**
- `apps/web/src/app/teacher/page.tsx:9–19` defines `createCourseAction` as a `'use server'`
  function directly inside the page file. The function performs RBAC checking (`user.roles.includes`)
  and calls `lmsService.createCourse` inline.
- This is business logic in a page file, not in `features/lms/actions.ts`.

**Implication:** The P-A implementer extending this page must move `createCourseAction` (and any
future teacher mutations) into `apps/web/src/features/lms/actions.ts`. The page should import
and bind the action, not define it.

**Recommendation:** P-A work item: migrate `createCourseAction` and all future LMS mutations to
`features/lms/actions.ts`. The mutation pipeline there must be: Zod → session → RBAC →
ownership check (`assertTeacherOwns`) → LMS service → audit → response.

---

### F-03 — [HIGH] `lms-types.ts` is thin (Phase 1.7 model only) and is a spine prerequisite — confirmed, no drift

**Evidence:**
- `apps/web/src/lib/lms-types.ts:22–28` defines only four methods: `createCourse`,
  `listCoursesForTeacher`, `listPublishedCourses`, `listLessonsForStudent`.
- This is exactly the "Part E thin model" described in the prior handoff. The comment on line 6
  explicitly marks it "NOT the full contract (no enrollments/lesson_progress/teacher_profiles)."
- `packages/lms/src/index.ts` already has `LessonProgress`, `LmsStore`, and an `Actor` type,
  meaning the `@wtc/lms` package has more surface than `lms-types.ts` exposes. No conflict; the
  spine step S-7 will align them.

**Status:** No drift. S-7 (`lms-types.ts` expansion) is confirmed still required and the plan
is correct.

---

### F-04 — [MEDIUM] `packages/db/src/schema.ts` has 21 tables; all 17+ tables for Wave-2 are absent — S-1 is the absolute blocker

**Evidence:**
- `schema.ts` final table is `integrationHealthChecks` (line 236–242). Tables present: users,
  roles, userRoles, sessions, products, plans, entitlements, subscriptions, exchangeAccounts,
  exchangeApiKeySecrets, botInstances, botConfigs, axiomaAccountLinks, tradingviewAccessRequests,
  tradingviewAccessTasks, courses, lessons, materials, auditLogs, jobQueue,
  integrationHealthChecks = 21 tables.
- Missing (all needed by Wave-2): botConfigVersions, botMetricSnapshots, botPositionSnapshots,
  botTradeImports, botSafetyEvents, teacherProfiles, enrollments, lessonProgress, pinnedLinks,
  tradingviewProfiles, tradingviewAccessGrants, productAccessEvents, terminalReleaseCache,
  terminalDownloadEvents, terminalLicenseEvents, notifications, supportTickets (17 tables).
- The `tradingviewAccessRequests` table also lacks the `revoked_at`/`revoked_by` columns that
  S-1 / db-architect handoff specifies to add.

**Status:** Confirmed. S-1 must land before any other spine step begins.

---

### F-05 — [MEDIUM] `packages/db/src/repositories.ts` — `revokeTv` function discards the actor from the schema column; schema has no `revoked_at`/`revoked_by` yet — known debt, now confirmed

**Evidence:**
- `repositories.ts:277–283` comment: "adminId/now are recorded in the audit row (the schema has no
  revoked_at/revoked_by columns yet)."
- The function sets `status: 'revoked'` but does NOT write `revoked_at` or `revoked_by` to the row
  because those columns do not exist in the current schema.

**Implication:** After S-1 adds `revoked_at`/`revoked_by` to `tradingviewAccessRequests`, the S-2
repo update MUST also update `revokeTv` to populate those columns. This is explicitly in the
db-architect handoff "Next actions" item 3.

**Status:** Tracked in db-architect handoff. No action by platform-architect, but confirmed as a
mandatory update in S-2.

---

### F-06 — [MEDIUM] `backend.ts` denied stub for `lmsService` covers only the 4 thin methods — correct for now, will be stale after S-6/S-7

**Evidence:**
- `apps/web/src/lib/backend.ts:66–71` defines the denied stub with exactly the 4 methods in the
  current `LmsService` interface.
- After S-7 extends `LmsService` with enrollment/progress/teacher-profile methods, the denied stub
  must be extended to match. TypeScript will catch this at compile time (the object literal will not
  satisfy the interface), so the gate is enforced automatically.

**Recommendation:** S-6 implementer should note that the denied stub will fail typecheck after S-7
unless all new methods are added. The recommended approach from the prior handoff (do S-7 and S-6
in one sitting) is reconfirmed here.

---

### F-07 — [MEDIUM] `packages/axioma-bridge/src/handoff.ts` is HS256 — S-8 (ES256/JWKS upgrade) is confirmed required and has no blocking dependency beyond S-3

**Evidence:**
- `handoff.ts:1–13` comment: "DEV STUB: this is an HS256 (symmetric) signer for LOCAL testing only.
  The production signer MUST be ES256."
- `packages/axioma-bridge/src/index.ts` exports `signHandoffToken` which calls the HS256 path.
- There is no `signer.ts` or `jwks.ts` file in `packages/axioma-bridge/src/` — they must be created
  as new files in S-8.
- There is no `apps/web/src/app/api/` directory at all; the JWKS route handler at
  `apps/web/src/app/api/axioma/.well-known/jwks.json/route.ts` is entirely new.

**Status:** Confirmed. S-8 scope is accurate.

---

### F-08 — [MEDIUM] `packages/billing/src/` has `webhook.ts` and `provider.ts` with a `BillingProvider` interface and `MockBillingAdapter` — but no `StripeAdapter` class exists yet

**Evidence:**
- `billing/src/index.ts` exports `createMockBillingProvider` and `createBillingProvider` from
  `provider.ts`.
- `billing/src/provider.ts:23–28` defines `BillingProvider` interface correctly.
- There is no `stripe-adapter.ts` file in `packages/billing/src/`.

**Implication:** S-5 (StripeAdapter) is a net-new file in an existing package. The `index.ts` will
need to export `StripeAdapter` after S-5 lands. This is additive — no existing exports break.

**Status:** No drift from the plan. S-5 scope is accurate.

---

### F-09 — [LOW] The `apps/web/src/app/api/` directory does not exist — ALL planned API route handlers are net-new

**Evidence:** Glob `apps/web/src/app/api/**` returned no files.

**Implication:** Every route handler in the plan (Stripe webhook, admin APIs, Axioma APIs, JWKS
endpoint) is a directory + file creation. The file-system must create the nested directory tree.
On Windows (this host) that means creating directories explicitly; `next.js` will resolve them at
build time.

**Recommendation:** Each parallel group implementer is responsible for creating the `app/api/...`
directory tree for the routes they own. No collision exists because each group owns disjoint
namespaces.

---

### F-10 — [LOW] `billingService` selector is entirely absent from `backend.ts`, `db-store.ts`, and `demo.ts` — S-6 must add it

**Evidence:**
- `backend.ts` exports no `billingService` symbol.
- `db-store.ts` imports from `@wtc/db` but no billing-related functions.
- `demo.ts` has no billing service wiring (the mock self-grant in `billing/page.tsx` calls
  `grantProduct` directly, bypassing any billing abstraction layer).

**Implication:** S-6 must add `billingService` to all three files. The denied stub pattern (same
as `tvService`/`lmsService`) must be applied. The `BillingProvider` interface from
`packages/billing/src/provider.ts` is the correct type to expose; the DB-backed adapter calls
`applyStripeEvent` (S-5 + S-3 repo function); the demo adapter wraps `createMockBillingProvider`.

**Status:** No drift. S-6 scope is accurate and F-03 in the prior handoff anticipated this.

---

### F-11 — [LOW] `features/bots/data.tsx` contains a JSX component (`BotAccessRequired`) — this is a component, not a query

**Evidence:**
- `features/bots/data.tsx:21–34` exports `BotAccessRequired`, a React component returning JSX.
- The file also exports `loadBot`, which is a server-side data loader.
- The P-C plan puts components in `features/bots/shared/components/` and queries in
  `features/bots/{tortila,legacy}/queries.ts`.

**Implication:** When P-C implements the full features tree, `BotAccessRequired` should move to
`features/bots/shared/components/`. `loadBot` can remain as a shared utility or move to a
`features/bots/shared/queries.ts`. The existing `data.tsx` should be split. This is a clean-up
scoped to P-C; the existing pages already import from `data.tsx` so the move must be done
atomically with the page rewrites.

**Status:** Low risk, scoped to P-C. No impact on spine.

---

### F-12 — [INFO] No collision detected between parallel groups — file ownership matrix is valid

**Verified:**
- `features/lms/**` (P-A) — does not exist yet; no overlap possible.
- `features/billing/**` (P-B) — does not exist yet.
- `features/bots/**` (P-C) — only `meta.ts` and `data.tsx` exist, both scoped to bots.
- `features/axioma/**` (P-D) — does not exist yet.
- `features/admin/**` (P-E) — does not exist yet.
- `app/(public)/products/[slug]/page.tsx` appears in both P-D (terminal slug) and P-E (other
  slugs). The prior handoff's ownership table assigns this file to P-E with the note "non-terminal
  slugs only" and assigns the terminal slug to P-D. In practice this is a single file that both
  groups need to touch. This IS a potential collision (see F-13 below).

---

### F-13 — [MEDIUM] `apps/web/src/app/(public)/products/[slug]/page.tsx` is a potential collision between P-D and P-E

**Evidence:**
- The prior handoff assigns `apps/web/src/app/(public)/products/[slug]/page.tsx` to P-D ("extend
  — terminal product page") AND to P-E ("non-terminal slugs only").
- Because this is NOT a git repo, two parallel groups cannot edit the same file concurrently.

**Recommendation:** Resolve the collision by making the file owned exclusively by ONE group. Two
options:
- Option A (preferred): P-E owns `products/[slug]/page.tsx` entirely. The terminal slug case is
  handled by a conditional in the page that delegates to a `features/axioma/` component imported
  from P-D's feature dir. This is pure component-level delegation and requires no file collision
  (P-D's component is already created by that point).
- Option B: P-D runs first, creates the file with the terminal slug case; P-E then extends it for
  non-terminal slugs. Requires strict sequencing (P-D before P-E for this one file).

Option A is recommended because it maintains the parallel group invariant with no sequencing
dependency between P-D and P-E.

---

### F-14 — [INFO] S-4 (@wtc/lms) and S-5 (@wtc/billing) can be parallelized after S-3 — confirmed, no file overlap

**Evidence:**
- `packages/lms/src/` and `packages/billing/src/` are entirely separate directories.
- S-4 edits only `packages/lms/src/index.ts`, `schemas.ts`, `types.ts`.
- S-5 creates `packages/billing/src/stripe-adapter.ts` and edits `packages/billing/src/index.ts`.
- No shared file. The prior handoff's note that S-4 and S-5 can run in parallel after S-3 is
  confirmed correct.

---

### F-15 — [INFO] S-8 (Axioma ES256) can begin after S-3, not after S-7 — confirmed, but sequencing note in prior handoff stands

**Evidence:** S-8 edits only `packages/axioma-bridge/src/` (new files: `signer.ts`, `jwks.ts`)
and `apps/web/src/app/api/axioma/.well-known/jwks.json/route.ts`. It has no dependency on S-4,
S-5, S-6, or S-7. The prior handoff placed S-8 last "for clarity" and noted it could run earlier
by a separate implementer. This is confirmed correct. If the operator has two implementers
available, S-8 can be parallelized with S-4+S-5 after S-3.

---

## Decisions

1. **P-C (bot pages) is a REWRITE, not an extension** for the three existing bot pages that
   violate ADR-013. The refactor scope: move `computeMetrics`/`combineMetrics`/`filterZeroEquity`
   calls from page files into `features/bots/{tortila,legacy}/queries.ts`. No new test gate needed
   beyond the existing `npm run typecheck` + analytics import grep.

2. **P-A (LMS) must migrate `createCourseAction` from `teacher/page.tsx` into
   `features/lms/actions.ts`**. The page.tsx becomes a thin shell after this move.

3. **Collision resolution for `products/[slug]/page.tsx`**: P-E owns the file exclusively.
   P-D creates a `features/axioma/components/AxiomaProductCard.tsx` component; the slug page
   imports it conditionally when `params.slug === 'terminal'`. This is a clean delegation pattern
   with no file ownership conflict.

4. **The shared-file single-writer set is unchanged from the prior handoff.** The set is:
   `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`,
   `apps/web/src/lib/backend.ts`, `apps/web/src/lib/db-store.ts`, `apps/web/src/lib/demo.ts`,
   `apps/web/src/lib/lms-types.ts`, and `packages/axioma-bridge/src/handoff.ts` (touched by S-8).
   No parallel group may touch any of these files.

5. **S-7 and S-6 must be a single sitting by one implementer.** The TypeScript compile will fail
   at S-6 if S-7 has not expanded `LmsService` first (the denied stub in `backend.ts` would not
   satisfy the new interface). They are logically one unit of work.

---

## Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R-1 | S-1 (migration 0002) scope is 17 new tables + 1 ALTER — single largest step on the spine | P1 | Use db-architect's three-chunk sequencing (Bots → Products/TV/Axioma → Education/Ops). Rule-7 STOP applies if quality degrades mid-migration. |
| R-2 | Existing bot pages violate ADR-013 and must be refactored in P-C | P1 | P-C implementer is explicitly scoped to rewrite, not extend. Gate: zero `@wtc/analytics` imports in any `page.tsx` after P-C. |
| R-3 | S-6 blast radius: `backend.ts`/`db-store.ts`/`demo.ts` are the most-connected shared files | P1 | S-7 immediately before S-6 in one sitting. Run `npm run typecheck -w @wtc/web` after every added method, not only at the end. |
| R-4 | `products/[slug]/page.tsx` owned by two groups in prior plan (F-13) | P2 | Resolved by Decision 3: P-E owns the file; P-D creates the component used conditionally inside it. |
| R-5 | `demo.ts` in-memory billing service must be added in S-6 but `billingService` pattern is not yet established | P2 | Use `createMockBillingProvider` from `@wtc/billing` as the demo adapter. The billing page currently calls `grantProduct` directly — this bypass is acceptable for dev mode but must NOT be the model for the `billingService` selector, which will use the proper `BillingProvider` interface. |
| R-6 | `apps/web/src/app/api/` directory does not exist — all route handlers need directory creation | P2 | Each group creates its own subdirectory tree. On Windows, the directory must be created before the route file. |
| R-7 | `packages/axioma-bridge/src/handoff.ts` contains the HS256 signer; S-8 adds ES256 but does NOT delete HS256 (it must remain for dev) | P2 | S-8 adds `signer.ts` as a NEW file; `handoff.ts` is unchanged. Production code must use the new `signer.ts` path. The existing handoff test asserting `alg='HS256'` must remain green and a new test asserting `alg='ES256'` from `signer.ts` must be added. |
| R-8 | No `DATABASE_URL` in this environment — `db:migrate` gate remains NOT RUN | P3 | Same as all prior phases. The PGlite integration test harness is the substitution. |

---

## Verification/tests

Gates NOT RUN this session (read-only audit):
- `npm run governance:check` — NOT RUN (no code changes)
- `npm run typecheck` — NOT RUN
- `npm test` — NOT RUN
- `npm run lint` — NOT RUN
- `npm run build -w @wtc/web` — NOT RUN
- `npm run e2e` — NOT RUN
- `db:migrate` / `db:seed` — NOT RUN (no `DATABASE_URL`, same as all prior phases)

Gates to run after each spine step (operator checklist):
- After S-1: `npm run typecheck` green. Migration SQL reviewed for additive-only (no DROP, no
  column rename of existing data columns).
- After S-2: `npm run typecheck` green.
- After S-3: `npm run typecheck` green.
- After S-4: `npm run typecheck` green + `npm test` green (new Zod schema unit tests).
- After S-5: `npm run typecheck` green + `npm test` green (StripeAdapter signature + idempotency).
- After S-7+S-6 (one sitting): `npm run typecheck -w @wtc/web` green + `npm test` green.
- After S-8: `npm run typecheck` green + unit test: ES256 sign+verify round-trip green; HS256 test
  still green; new `alg='ES256'` assertion green.
- After all spine steps: full gate run (`lint` + both `typecheck` + `test` + `secret:scan`).
- After each parallel group: `npm run typecheck -w @wtc/web` green + group's own unit tests green.
- After I-1: `governance:check` + `lint` + both `typecheck` + `test` + `secret:scan` + `build` +
  `e2e`.

---

## Next actions

### Ordered build checklist (operator-ready)

**SERIAL SPINE — complete in this order, one step at a time, green gate required before proceeding:**

1. **S-1 [db-architect]** — Add 17 tables + 1 ALTER to `packages/db/src/schema.ts`.
   Generate migration `0002_ecosystem_expansion.sql`. Per db-architect handoff three-chunk order:
   (a) Bots group first, (b) Products/TradingView/Axioma group, (c) Education/Ops group.
   Mandatory: teacher_profiles backfill script must run INSIDE the migration transaction.
   Gate: `npm run typecheck` green; migration SQL reviewed (additive only; no DROP of existing
   columns; no rename of `bot_configs.version` or `bot_configs.config`).

2. **S-2 [single implementer]** — Add LMS repo functions to `packages/db/src/repositories.ts`:
   `createTeacherProfile`, `getTeacherProfile`, `updateTeacherProfile`, `upsertEnrollment`,
   `markEnrollmentComplete`, `listEnrollments`, `upsertLessonProgress`, `getLessonProgress`,
   `listCourseProgress`, `createPinnedLink`, `listPinnedLinks`, `deletePinnedLink`.
   Also update `revokeTv` to populate `revoked_at`/`revoked_by` (F-05 debt).
   Gate: `npm run typecheck` green.

3. **S-3 [same or different implementer, after S-2]** — Add billing repo functions to
   `packages/db/src/repositories.ts`: `upsertSubscription`, `applyStripeEvent` (idempotent by
   `stripe_event_id`), `listSubscriptionsForUser`. Also add all bot-analytics, TradingView, Axioma,
   Ops, and Products repo functions from the db-architect handoff table (bot_config_versions,
   bot_metric_snapshots, bot_position_snapshots, bot_trade_imports, bot_safety_events,
   tradingview_profiles, tradingview_access_grants, product_access_events, terminal_release_cache,
   terminal_download_events, terminal_license_events, notifications, support_tickets).
   Note: S-3 in the prior plan covered only billing repos; the db-architect handoff covers all new
   repos in one section. The operator may split S-2 and S-3 across the full repo list as needed.
   Gate: `npm run typecheck` green.

4. **S-4 [@wtc/lms full service — after S-3]** — Extend `packages/lms/src/index.ts` with full
   `LmsService` interface (enrollment, progress, teacher-profile methods). Add
   `packages/lms/src/schemas.ts` (Zod) and `packages/lms/src/types.ts` (`CourseAdminView`,
   `LessonStudentView`, `EnrollmentView`, `ProgressView`, `TeacherProfileView`). Interface must be
   additive over the current thin surface.
   Gate: `npm run typecheck` green + `npm test` green.

   **S-5 [@wtc/billing StripeAdapter — can run in parallel with S-4 after S-3]** — Create
   `packages/billing/src/stripe-adapter.ts` with real webhook signature verification and event
   parsing. Update `packages/billing/src/index.ts` to export `StripeAdapter`.
   Gate: `npm run typecheck` green + `npm test` green.

   **S-8 [Axioma ES256 — can run in parallel with S-4+S-5 after S-3]** — Create
   `packages/axioma-bridge/src/signer.ts` (ES256/P-256 signer; `AXIOMA_HANDOFF_SIGNING_KEY` env
   var) and `packages/axioma-bridge/src/jwks.ts` (JWKS builder, public key only). Create
   `apps/web/src/app/api/axioma/.well-known/jwks.json/route.ts` (public Next.js route handler,
   cached 1 hour). Keep `handoff.ts` unchanged (HS256 path stays for dev).
   Gate: `npm run typecheck` green + unit test: ES256 sign+verify round-trip; JWKS contains only
   the public key; existing HS256 test still green.

5. **S-7 [lms-types.ts — immediately before S-6, same sitting]** — Extend
   `apps/web/src/lib/lms-types.ts` with full LmsService interface additions (enrollment, progress,
   teacher-profile methods). Add `EnrollmentView`, `ProgressView` types.
   Gate: `npm run typecheck -w @wtc/web` (will fail until S-6 completes the denied stub, so run as
   one combined step with S-6).

6. **S-6 [backend.ts + db-store.ts + demo.ts — single writer, one sitting, after S-4+S-5+S-7]** —
   Add `billingService` selector (denied stub + DB-backed + in-memory adapters).
   Extend `lmsService` selector to full contract (new methods from S-7).
   Extend `tvService` selector if any new TV repo functions from S-3 are exposed.
   Gate: `npm run typecheck -w @wtc/web` green + `npm test` green. Verify: no remaining TypeScript
   errors in any denied stub (the interface now has more methods).

**[Full spine gate]** After S-6 (and all of S-4/S-5/S-8 complete): run
`npm run governance:check` + `npm run lint` + `npm run typecheck` (both) + `npm test` +
`npm run secret:scan`. All must be green before any parallel group begins.

---

**PARALLEL GROUPS — only after spine gate is fully green:**

Groups run concurrently by disjoint writers. No shared-file edits. Each group implementer is
responsible for creating their feature directory tree and API route directory tree.

**P-A [LMS pages]** — Highest-value surface (full LMS is the core product differentiator).
- Create `apps/web/src/features/lms/` with `queries.ts`, `actions.ts`, `schemas.ts`, `types.ts`,
  `components/`.
- REWRITE `apps/web/src/app/teacher/page.tsx` to be a thin shell (move `createCourseAction` to
  `features/lms/actions.ts` per Decision 2).
- Extend/create: `education/page.tsx`, `education/[courseId]/page.tsx`,
  `education/[courseId]/[lessonId]/page.tsx`, teacher course/material/student pages,
  `admin/education/page.tsx`.
- All entitlement gating via `hasAccess(userId, 'education')` before any course/lesson query.
- Gate: `npm run typecheck -w @wtc/web` green + group unit tests green.

**P-C [Bot analytics pages]** — Second-highest value (existing pages already work but violate ADR-013).
- Create full `apps/web/src/features/bots/` tree: `tortila/`, `legacy/`, `shared/`.
- REWRITE existing bot pages (P-C scope explicitly includes refactoring, not just extension):
  - Move `computeMetrics`/`combineMetrics` calls into `queries.ts` (F-01 fix).
  - Move `filterZeroEquity` call in equity page into `features/bots/tortila/queries.ts`.
  - Move `BotAccessRequired` component from `data.tsx` to `features/bots/shared/components/`.
- Extend bot sub-pages as planned.
- Post-refactor gate: `grep -r "@wtc/analytics" apps/web/src/app` must return zero results.
- Gate: `npm run typecheck -w @wtc/web` green + group unit tests green.

**P-B [Billing pages]** — Third priority (billing is a revenue path).
- Create `apps/web/src/features/billing/` with `queries.ts`, `actions.ts`, `schemas.ts`, `types.ts`,
  `components/`.
- Create `apps/web/src/app/api/billing/webhook/route.ts` (Stripe webhook; signature verification
  is the FIRST line, before any state access; idempotent via `applyStripeEvent`).
- Extend `apps/web/src/app/(app)/app/billing/page.tsx` to use `billingService` via `queries.ts`
  rather than calling `entitlementsOf` + `grantProduct` directly.
- Extend `apps/web/src/app/(public)/pricing/page.tsx`.
- `CheckoutButton.tsx` is a client component receiving a server action reference; no payment SDK
  import in the component.
- Gate: `npm run typecheck -w @wtc/web` green + unit tests: signature rejection, idempotency.

**P-D [Axioma pages]** — Fourth priority (ES256 signer in S-8 is the prerequisite; P-D depends on S-8).
- Create `apps/web/src/features/axioma/` with `queries.ts`, `actions.ts`, `schemas.ts`, `types.ts`,
  `components/` (including `AxiomaProductCard.tsx` used by the slug page per Decision 3).
- Create `apps/web/src/app/api/axioma/status/route.ts`, `releases/route.ts`, `download/route.ts`,
  `account-link/route.ts` (the `jwks.json` route was created in S-8 and must NOT be touched by P-D).
- Extend `apps/web/src/app/(app)/app/terminal/page.tsx` to use `features/axioma/queries.ts` rather
  than calling `createMockAxiomaBridge` directly in the page.
- All Axioma routes gated by `axioma_terminal` entitlement check before any bridge call.
- Download URLs are signed and expiring; never a direct file path.
- Gate: `npm run typecheck -w @wtc/web` green.

**P-E [Admin + public product pages]** — Lowest risk to defer, but high admin value.
- Create `apps/web/src/features/admin/` with `queries.ts`, `actions.ts`, `schemas.ts`, `types.ts`,
  `components/`.
- Own `apps/web/src/app/(public)/products/[slug]/page.tsx` exclusively (Decision 3). Import
  `AxiomaProductCard` from P-D's `features/axioma/components/` for the terminal slug case.
- Extend admin pages: `users/`, `products/`, `system-health/`.
- Create `apps/web/src/app/api/admin/users/route.ts`, `entitlements/route.ts`,
  `system-health/route.ts` (all require `admin` role check as first gate).
- Gate: `npm run typecheck -w @wtc/web` green.

---

**Recommended first-four parallel surfaces to land (highest-value / lowest-risk):**

1. **P-A (LMS)** — Unblocked after spine; highest product value; the migration and repo functions
   (S-1 through S-4) fully back it. The refactor of `teacher/page.tsx` reduces future tech debt.

2. **P-C (Bot analytics)** — Existing pages already render; the refactor improves architecture
   without changing user-visible output. Lowest risk of regressions because the data path
   (adapters → `combineMetrics` → page) is well-exercised; the refactor is a move, not a rewrite
   of logic.

3. **P-B (Billing)** — Stripe webhook is the most security-critical new surface. Landing it early
   gives more time for the signature-verification unit tests to be exercised before deployment.

4. **P-D (Axioma)** — Depends on S-8 (ES256 signer). Once S-8 is green, P-D can proceed. The
   mock bridge is already wired in the terminal page; P-D upgrades it to use the real ES256 path
   for the account-link and journal-open flows.

   P-E (admin panels) is the lowest-risk deferral: the pages are already `Placeholder` components
   and blocking P-E does not prevent any user-facing product from working. Land P-E last or in a
   subsequent session if time budget is constrained.

---

**Integration step (I-1) after all parallel groups complete:**

1. `npm run governance:check` — per-agent handoffs cited for each group.
2. `npm run typecheck` (both) + `npm test` + `npm run lint` + `npm run secret:scan` — all green.
3. `npm run build -w @wtc/web` — all pages compile.
4. `npm run e2e` — smoke passes.
5. Post-P-C gate: `grep -r "@wtc/analytics" apps/web/src/app` = zero results.
6. Operator writes aggregate phase handoff linking each group's per-agent handoff.
7. `db:migrate` / `db:seed` against real PG17 — deferred until `DATABASE_URL` is available (same
   NOT RUN status as all prior phases).
