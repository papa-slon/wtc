# ecosystem-platform-architect handoff

Epoch: 20260530-0126. Phase 2 — Wave-2 design. DESIGN-ONLY session (no code, no shared files edited).

---

## Scope

Deliver the Phase-2 architecture deltas and — most importantly — the sequenced Wave-2 implementation
plan: dependency-ordered serial spine + disjoint parallel groups, with explicit file ownership so
implementers never collide. Also confirm package reuse, feature-dir layout, and Part-4 analytics
data-flow. Coordinate schema table needs with db-architect via this handoff. Do not edit
STATUS/NEXT_ACTIONS/IMPLEMENTED_FILES (WAVE-1 RULES).

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/ARCHITECTURE.md`
- `docs/INTEGRATION_MAP.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/EDUCATION_LMS_PLAN.md` (§§1–20)
- `docs/BOT_INTEGRATION_PLAN.md`
- `docs/CANONICAL_ANALYTICS_MODEL.md`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts` (header)
- `apps/web/src/lib/nav.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/analytics/src/metrics.ts`
- `packages/analytics/src/index.ts`
- `packages/bot-adapters/src/types.ts`
- `apps/web/src/app/**/*.tsx` (glob — 42 files)
- `packages/analytics/src/` (glob)
- `packages/bot-adapters/src/` (glob)
- `docs/handoffs/20260529-2352-phase-1-7-part-e-tv-lms-persistence.md`
- Memory files: `wtc-phase-1-7-complete.md`, `wtc-governed-build-model.md`

---

## Files changed

- `docs/ARCHITECTURE.md` — header epoch updated; §11 (Phase 2 Architecture Deltas) appended
- `docs/INTEGRATION_MAP.md` — header epoch updated; §6 (Phase 2 Integration Deltas) appended
- `docs/ARCHITECTURE_DECISIONS.md` — ADR-012, ADR-013, ADR-014 appended
- `docs/handoffs/20260530-0126-ecosystem-platform-architect.md` — this file (new)

---

## Findings

### F-01 — No new packages are needed for Wave-2 (CONFIRMED)
**Severity:** informational. All 14 existing packages cover Wave-2 scope:
- `@wtc/lms` + `@wtc/db` + `@wtc/entitlements` + `@wtc/audit` handle full LMS.
- `@wtc/billing` handles Stripe adapter.
- `@wtc/axioma-bridge` + `@wtc/crypto` handle ES256/JWKS upgrade.
- `@wtc/bot-adapters` + `@wtc/analytics` handle bot dashboard; `computeMetrics` already typed, tested,
  and zero-dependency.
- `@wtc/auth` handles auth hardening.
ADR-012 recorded.

### F-02 — `apps/web/src/features/` does not yet exist; directories must be created per-group
**Severity:** informational / planning. The `features/` tree is defined in ARCHITECTURE.md §7 but not
yet created on disk (Phase 1 used direct app-layer files). Wave-2 implementers must create the
directories as part of each group's work. The `queries.ts` / `actions.ts` / `schemas.ts` / `types.ts`
pattern is canonical (ADR-013).

### F-03 — `backend.ts` selector will need extension for billing and expanded LMS
**Severity:** planning. The spine step S-6 (backend selector extension) must add `billingService`
and extend `lmsService` to the full contract (enrollments/progress) using the same guard/denied-stub
pattern. This is a shared-file edit and must be on the serial spine, not in any parallel group.

### F-04 — LMS migration `0002` is a prerequisite for ALL LMS feature work
**Severity:** high / planning. The full LMS contract (`teacher_profiles`, `enrollments`,
`lesson_progress`, `pinned_links`) requires migration `0002` before any LMS repository or feature work
can compile. Migration must land in S-1 of the spine, coordinated with db-architect.

### F-05 — Bot analytics `queries.ts` is the only place `computeMetrics` is called
**Severity:** architectural constraint. `packages/analytics` exports `computeMetrics` and
`CanonicalMetrics`. Feature components must receive `CanonicalMetrics` as a typed prop only.
No component may import `@wtc/analytics` directly. Enforced by: TypeScript project references
(feature components are in `apps/web`; they can import `@wtc/analytics`, but the rule is a team
convention enforced in code review + a lint rule if needed). The data-flow diagram in
ARCHITECTURE.md §11.3 is the authoritative reference.

### F-06 — Parallel groups have no shared-file overlap (confirmed)
**Severity:** informational. The five Wave-2 parallel groups (LMS pages, billing pages, bot dashboard
pages, axioma pages, public product pages) each own disjoint feature directories and page files. No
two groups share a file once the serial spine is complete. Verified against the existing page tree:
`features/lms/`, `features/billing/`, `features/bots/tortila/`, `features/bots/legacy/`,
`features/axioma/`, `features/bots/shared/` are all independent subtrees.

### F-07 — `tradingview_access_tasks` executor gap is a known deferred risk
**Severity:** low / carry-over. The revoke-task executor is still not implemented (`job_queue`
RESERVED). Wave-2 does not change this. The admin-TV grant queue in `features/tradingview/` is
extended for Wave-2's admin UX but the underlying task-runner gap persists. Flagged for a post-Wave-2
session.

---

## Decisions

1. **No new packages for Wave-2.** All 14 existing packages are sufficient. ADR-012.
2. **`features/` layout is canonical from Wave-2 onward.** All new UI logic goes in
   `apps/web/src/features/<domain>/`. ADR-013.
3. **Serial spine then parallel groups.** Because this is not a git repo, shared-file edits are serial
   (S-1 through S-8). Per-page feature work is parallel across disjoint groups only after the spine
   reaches a green gate. ADR-014.
4. **`computeMetrics` called once, in `queries.ts`, server-side.** Components receive `CanonicalMetrics`
   as props. `@wtc/analytics` is not imported in React component files.
5. **LMS migration `0002` is coordinated with db-architect.** Platform-architect does not edit
   `DATA_MODEL.md`; the schema tables needed (`teacher_profiles`, `enrollments`, `lesson_progress`,
   `pinned_links`) are communicated via this handoff (see "Next actions" below).

---

## Wave-2 sequenced implementation plan (serial spine + disjoint parallel groups)

### Overview

```
SERIAL SPINE (S-1 → S-8): shared files, one at a time, gates between each step
    │
    ▼ (gate: typecheck green after S-8)
    │
PARALLEL GROUPS (P-A through P-E): disjoint feature dirs, no shared-file overlap
    │
    ▼
INTEGRATION STEP (I-1): wire parallel group outputs into existing pages, final gate run
```

---

### Serial Spine

Each step must reach a green `npm run typecheck` before the next step begins.
Steps S-4 through S-8 also require `npm test` green before proceeding.

---

#### S-1 — Schema migration `0002` (db-architect owns; platform-architect coordinates)

**Owned by:** db-architect (edits `packages/db/src/schema.ts` and generates migration `0002_lms_full.sql`)

**Files touched:**
- `packages/db/src/schema.ts` — add tables: `teacherProfiles`, `enrollments`, `lessonProgress`, `pinnedLinks`
- `drizzle/0002_lms_full.sql` (generated by `npm run db:generate -w @wtc/db`)

**What to add (schema spec for db-architect):**

```
teacher_profiles
  id              uuid PK default gen_random_uuid()
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  display_name    text NOT NULL
  bio             text
  avatar_url      text
  social_links    jsonb default '{}'::jsonb
  is_active       boolean NOT NULL default true
  created_at      timestamptz NOT NULL default now()
  updated_at      timestamptz NOT NULL default now()
  UNIQUE (user_id)

enrollments
  id              uuid PK default gen_random_uuid()
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  course_id       uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE
  enrolled_at     timestamptz NOT NULL default now()
  completed_at    timestamptz
  UNIQUE (user_id, course_id)

lesson_progress
  id              uuid PK default gen_random_uuid()
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  lesson_id       uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE
  completed_at    timestamptz
  last_watched_at timestamptz NOT NULL default now()
  UNIQUE (user_id, lesson_id)

pinned_links
  id              uuid PK default gen_random_uuid()
  teacher_profile_id  uuid NOT NULL REFERENCES teacher_profiles(id) ON DELETE CASCADE
  label           text NOT NULL
  url             text NOT NULL
  kind            text NOT NULL default 'link'   -- telegram | youtube | instagram | website | link
  order           integer NOT NULL default 0
  created_at      timestamptz NOT NULL default now()
```

**Gate:** `npm run db:generate -w @wtc/db` succeeds; `npm run typecheck` green.

---

#### S-2 — Repository functions for full LMS

**Owned by:** single implementer (edits `packages/db/src/repositories.ts`)

**Files touched:**
- `packages/db/src/repositories.ts` — add sections:
  - `TeacherProfiles`: `createTeacherProfile`, `getTeacherProfile`, `updateTeacherProfile`
  - `Enrollments`: `enrollUser`, `unenrollUser`, `listEnrollments`, `getEnrollment`
  - `LessonProgress`: `markLessonComplete`, `getLessonProgress`, `listCourseProgress`
  - `PinnedLinks`: `upsertPinnedLinks`, `listPinnedLinks`
  - Each mutation that changes access or content state writes its audit row in the same transaction.

**Gate:** `npm run typecheck` green.

---

#### S-3 — Repository functions for billing (Stripe event persistence)

**Owned by:** single implementer (continues editing `packages/db/src/repositories.ts`)

**Files touched:**
- `packages/db/src/repositories.ts` — add section:
  - `Billing`: `upsertSubscription`, `applyStripeEvent` (idempotent by `stripe_event_id`),
    `listSubscriptionsForUser`

**Gate:** `npm run typecheck` green.

---

#### S-4 — `@wtc/lms` package — full service contract

**Owned by:** single implementer (edits `packages/lms/src/`)

**Files touched:**
- `packages/lms/src/index.ts` — export full `LmsService` interface (extended from Phase 1.7 thin model)
- `packages/lms/src/schemas.ts` — Zod schemas for course/lesson/enrollment/progress input
- `packages/lms/src/types.ts` — `CourseAdminView`, `LessonStudentView`, `EnrollmentView`,
  `ProgressView`, `TeacherProfileView`

**Note:** The thin `LmsService` in `apps/web/src/lib/lms-types.ts` is the CURRENT interface.
This step extends it. The interface must remain backward-compatible (additive only).

**Gate:** `npm run typecheck` green; `npm test` green (add unit tests for Zod schemas).

---

#### S-5 — `@wtc/billing` package — StripeAdapter

**Owned by:** single implementer (edits `packages/billing/src/`)

**Files touched:**
- `packages/billing/src/stripe-adapter.ts` — real webhook signature verification + event parsing
- `packages/billing/src/index.ts` — export `StripeAdapter`, `MockBillingAdapter`, `BillingAdapter`
  interface

**Gate:** `npm run typecheck` green; `npm test` green (unit test: signature verify mock, idempotency
logic, each event type → correct entitlement transition).

---

#### S-6 — `apps/web/src/lib/backend.ts` + `db-store.ts` + `demo.ts` — selector extension

**Owned by:** single implementer — these three files are a shared-file set and must be edited together
in one atomic step.

**Files touched (ALL three in one step; no other step may touch these files simultaneously):**
- `apps/web/src/lib/backend.ts` — add `billingService` selector (denied stub pattern); extend
  `lmsService` selector to full contract
- `apps/web/src/lib/db-store.ts` — add DB-backed `billingService`; extend DB-backed `lmsService`
- `apps/web/src/lib/demo.ts` — add in-memory `billingService`; extend in-memory `lmsService`

**Gate:** `npm run typecheck -w @wtc/web` green; `npm test` green.

---

#### S-7 — `apps/web/src/lib/lms-types.ts` — interface expansion

**Owned by:** single implementer (edits one file only)

**Files touched:**
- `apps/web/src/lib/lms-types.ts` — extend `LmsService` interface with full enrollment/progress/
  teacher-profile methods; update `CourseView`, `LessonView`; add `EnrollmentView`, `ProgressView`

**Note:** must be done BEFORE S-6 if S-6 depends on the new interface, or after S-6 if S-6 defines
the concrete shape first. Recommended: do S-7 immediately before S-6 in the same sitting since these
two are tightly coupled. The ordering here is logical; in practice S-7 and S-6 form one unit of work.

**Gate:** `npm run typecheck -w @wtc/web` green.

---

#### S-8 — Axioma bridge ES256/JWKS upgrade (`packages/axioma-bridge/src/`)

**Owned by:** single implementer

**Files touched:**
- `packages/axioma-bridge/src/signer.ts` — replace HS256 stub with ES256 (ECDSA P-256) signer;
  `AXIOMA_HANDOFF_SIGNING_KEY` env var (PEM or JWK private key); `AXIOMA_HANDOFF_KEY_ID` env var
- `packages/axioma-bridge/src/jwks.ts` — new: JWKS public key endpoint builder
- `apps/web/src/app/api/axioma/.well-known/jwks.json/route.ts` — new: Next.js route handler that
  calls `jwks.ts`; public, no auth, cached 1 hour

**Gate:** `npm run typecheck` green; `npm run typecheck -w @wtc/web` green; unit test: ES256 sign +
verify round-trip; HS256 still throws in production (existing test must remain green).

---

### Parallel Groups

The following five groups may be implemented concurrently ONLY after the serial spine (S-1 through S-8)
reaches a **fully green gate**: `governance:check`, `lint`, `typecheck` (both), `npm test`.

Each group owns an exclusive set of files. No group edits a file owned by another group. No group
edits any shared file from the spine.

---

#### P-A — Full LMS pages (student + teacher + admin education routes)

**Exclusive file ownership:**
```
apps/web/src/features/lms/           (create new)
  queries.ts
  actions.ts
  schemas.ts
  types.ts
  components/
    CourseGrid.tsx
    LessonPage.tsx
    ProgressBar.tsx
    EnrollmentGate.tsx
    MaterialList.tsx
    TeacherProfileCard.tsx
    PinnedLinks.tsx

apps/web/src/app/(app)/app/education/page.tsx        (extend existing thin page)
apps/web/src/app/(app)/app/education/[courseId]/page.tsx   (new)
apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx  (new)
apps/web/src/app/teacher/page.tsx                    (extend existing thin page)
apps/web/src/app/teacher/courses/page.tsx            (extend existing thin page)
apps/web/src/app/teacher/courses/[id]/page.tsx       (extend existing thin page)
apps/web/src/app/teacher/materials/page.tsx          (extend)
apps/web/src/app/teacher/students/page.tsx           (extend)
apps/web/src/app/admin/education/page.tsx            (extend existing thin page)
```

**Does NOT touch:** any `features/billing/`, `features/bots/`, `features/axioma/`, `features/tradingview/` files; no `backend.ts`, `db-store.ts`, `demo.ts`, `repositories.ts` (spine already done).

**Key implementation rules for this group:**
- `queries.ts` calls `lmsService` from `backend.ts` — not the DB repos directly.
- All entitlement gating uses `hasAccess(userId, 'education')` from `@wtc/entitlements` before any
  course/lesson query. Fail-closed: empty/403 on no entitlement, not a redirect loop.
- Teacher mutations call `assertTeacherOwns(teacherProfileId, resourceId)` inside the action, not
  just in the page layout.
- `actions.ts` follows the mutation pipeline: Zod → session → RBAC → ownership → LMS service → audit → response.

---

#### P-B — Billing pages (plan cards, checkout, subscription status, payment history)

**Exclusive file ownership:**
```
apps/web/src/features/billing/       (create new)
  queries.ts
  actions.ts
  schemas.ts
  types.ts
  components/
    PlanCard.tsx
    CheckoutButton.tsx
    SubscriptionStatus.tsx
    PaymentHistory.tsx
    BillingGate.tsx

apps/web/src/app/(app)/app/billing/page.tsx          (extend existing thin page)
apps/web/src/app/(public)/pricing/page.tsx           (extend existing thin page)
apps/web/src/app/api/billing/webhook/route.ts        (new — Stripe webhook receiver)
```

**Does NOT touch:** any `features/lms/`, `features/bots/`, `features/axioma/` files; no `backend.ts`, `db-store.ts`, `demo.ts`, `repositories.ts`.

**Key implementation rules for this group:**
- `app/api/billing/webhook/route.ts` verifies `Stripe-Signature` FIRST; returns 400 immediately on
  invalid signature before touching any state.
- Idempotency: `stripe_event_id` checked via `billingService` before applying any state change.
- The mock checkout "self-grant" dev shortcut remains in `actions.ts` fenced by
  `assertNotProduction()`.
- No payment status is read from client-side; all billing state comes from the server via `queries.ts`.
- `CheckoutButton.tsx` is a client component; it receives a server-action reference, not a payment
  provider SDK import.

---

#### P-C — Bot analytics dashboard (Tortila + Legacy bot pages)

**Exclusive file ownership:**
```
apps/web/src/features/bots/          (create new subtree)
  tortila/
    queries.ts    ← calls TortilaAdapter.getSnapshot(); calls computeMetrics(); returns CanonicalMetrics + warnings
    actions.ts    ← bot config save (WTC DB only, no live forward)
    schemas.ts
    types.ts
    components/
      TortilaDashboard.tsx
      EquityChart.tsx
      TradeTable.tsx
      RiskWarnings.tsx
      PositionTable.tsx
  legacy/
    queries.ts    ← calls LegacyBotAdapter.getSnapshot(); calls computeMetrics()
    actions.ts
    schemas.ts
    types.ts
    components/
      LegacyDashboard.tsx
      ConfigReadView.tsx
      StageView.tsx
  shared/
    components/
      BotMetricGrid.tsx
      HealthBadge.tsx
      WarnBanner.tsx
      ApiKeyVaultForm.tsx
      SimulatedDataBanner.tsx
    types.ts

apps/web/src/app/(app)/app/bots/page.tsx             (extend existing thin page)
apps/web/src/app/(app)/app/bots/[bot]/page.tsx       (extend existing thin page)
apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx        (extend)
apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx        (extend)
apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx     (extend)
apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx      (extend)
apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx        (extend)
apps/web/src/app/admin/bots/page.tsx                 (extend existing thin page)
```

**Does NOT touch:** any `features/lms/`, `features/billing/`, `features/axioma/` files; no
`backend.ts`, `db-store.ts`, `repositories.ts`.

**Key implementation rules for this group:**
- `queries.ts` is the ONLY place `computeMetrics` from `@wtc/analytics` is called.
- `TortilaDashboard` and `LegacyDashboard` receive `CanonicalMetrics` and `RiskWarning[]` as props.
  They never import `@wtc/analytics`.
- `WarnBanner` is rendered unconditionally when `warnings.length > 0`; a green "healthy" card is
  never shown when severity `error` warnings exist.
- All null metrics render as `—` (never as 0).
- `SimulatedDataBanner` is rendered when `BOT_ADAPTER_MODE === 'mock'` (already wired in Phase 1.6).
- Bot config saves (`actions.ts`) write to `bot_configs` (WTC DB) only; never forwarded to the live
  bot. Audit row in the same transaction.

---

#### P-D — Axioma product pages (license state, download, account-link, journal link)

**Exclusive file ownership:**
```
apps/web/src/features/axioma/        (create new)
  queries.ts
  actions.ts
  schemas.ts
  types.ts
  components/
    AxiomaProductCard.tsx
    LicenseState.tsx
    DownloadCTA.tsx
    JournalLink.tsx
    AccountLinkFlow.tsx
    ReleaseNotes.tsx

apps/web/src/app/(app)/app/terminal/page.tsx         (extend existing thin page)
apps/web/src/app/(public)/products/[slug]/page.tsx   (extend — terminal product page)
apps/web/src/app/api/axioma/status/route.ts          (new)
apps/web/src/app/api/axioma/releases/route.ts        (new)
apps/web/src/app/api/axioma/download/route.ts        (new)
apps/web/src/app/api/axioma/account-link/route.ts    (new)
apps/web/src/app/api/axioma/.well-known/jwks.json/route.ts  (new — from S-8)
```

**Does NOT touch:** any `features/lms/`, `features/billing/`, `features/bots/` files.

**Key implementation rules for this group:**
- All Axioma routes are gated by `axioma_terminal` entitlement check before any bridge call.
- Download URLs are signed and expiring (generated by `packages/axioma-bridge`); never a direct file
  path.
- Account-link flow uses the ES256 handoff token from S-8; the HS256 path must not be reachable in
  production.
- `JournalLink` opens `axi-o.ma` in a new tab with the handoff token in query string; WTC does not
  proxy journal data.

---

#### P-E — Public product pages + admin panels (products, admin users, admin health)

**Exclusive file ownership:**
```
apps/web/src/features/admin/         (extend / create)
  queries.ts
  actions.ts
  schemas.ts
  types.ts
  components/
    UserTable.tsx
    EntitlementManager.tsx
    AuditLogTable.tsx
    HealthPanel.tsx
    SystemHealthGrid.tsx

apps/web/src/app/(public)/products/page.tsx          (extend existing thin page)
apps/web/src/app/(public)/products/[slug]/page.tsx   (non-terminal slugs only)
apps/web/src/app/admin/users/page.tsx                (extend existing thin page)
apps/web/src/app/admin/products/page.tsx             (extend existing thin page)
apps/web/src/app/admin/system-health/page.tsx        (extend existing thin page)
apps/web/src/app/api/admin/users/route.ts            (new)
apps/web/src/app/api/admin/entitlements/route.ts     (new)
apps/web/src/app/api/admin/system-health/route.ts    (new)
```

**Does NOT touch:** any `features/lms/`, `features/billing/`, `features/bots/`, `features/axioma/` files.

---

### Integration step

#### I-1 — Final gate run + handoff

After all parallel groups are complete:

1. `npm run governance:check` — verify all per-agent handoffs cited.
2. `npm run typecheck` + `npm run typecheck -w @wtc/web` — both green.
3. `npm test` — all tests pass (add group-level unit tests as part of each group's work).
4. `npm run lint` — green.
5. `npm run secret:scan` — clean.
6. `npm run build -w @wtc/web` — all pages compile.
7. `npm run e2e` — smoke passes.
8. Operator writes aggregate phase handoff linking each group's per-agent handoff.

---

### Dependency graph summary

```
S-1 (schema 0002)
    └── S-2 (LMS repos)
            └── S-3 (billing repos)
                    └── S-4 (@wtc/lms full)
                            └── S-5 (@wtc/billing StripeAdapter)
                                    └── S-7 (lms-types.ts)
                                            └── S-6 (backend.ts + db-store.ts + demo.ts)
                                                    └── S-8 (axioma ES256)
                                                            │
                                        ┌───────────────────┴───────────────────┐
                                        │                                       │
                                   P-A  P-B  P-C  P-D  P-E (all parallel)
                                        │
                                        └── I-1 (final gate run)
```

Notes:
- S-7 is listed before S-6 because `lms-types.ts` defines the interface that `db-store.ts` and
  `demo.ts` implement. In practice, S-7 and S-6 are done in one sitting by the same implementer.
- S-5 (StripeAdapter) and S-4 (`@wtc/lms`) can be done in parallel by different implementers because
  they touch different packages and neither file overlaps. However, both must complete before S-6.
- S-8 (Axioma ES256) has no dependency on S-4 or S-5; it only needs S-3 to be done. It is placed
  last on the spine for clarity, but it can run after S-3 by a separate implementer in parallel with
  S-4 and S-5.

---

### File ownership matrix (complete)

| File / Directory | Owner | Phase |
|---|---|---|
| `packages/db/src/schema.ts` | S-1 (db-architect) | Spine |
| `drizzle/0002_*.sql` | S-1 (db-architect) | Spine |
| `packages/db/src/repositories.ts` (LMS) | S-2 | Spine |
| `packages/db/src/repositories.ts` (billing) | S-3 | Spine |
| `packages/lms/src/` | S-4 | Spine |
| `packages/billing/src/stripe-adapter.ts` | S-5 | Spine |
| `apps/web/src/lib/lms-types.ts` | S-7 | Spine |
| `apps/web/src/lib/backend.ts` | S-6 | Spine — shared file, single-writer |
| `apps/web/src/lib/db-store.ts` | S-6 | Spine — shared file, single-writer |
| `apps/web/src/lib/demo.ts` | S-6 | Spine — shared file, single-writer |
| `packages/axioma-bridge/src/signer.ts` | S-8 | Spine |
| `packages/axioma-bridge/src/jwks.ts` | S-8 | Spine |
| `apps/web/src/app/api/axioma/.well-known/*/route.ts` | S-8 | Spine |
| `apps/web/src/features/lms/**` | P-A | Parallel |
| `apps/web/src/app/(app)/app/education/**` | P-A | Parallel |
| `apps/web/src/app/teacher/**` | P-A | Parallel |
| `apps/web/src/app/admin/education/**` | P-A | Parallel |
| `apps/web/src/features/billing/**` | P-B | Parallel |
| `apps/web/src/app/(app)/app/billing/page.tsx` | P-B | Parallel |
| `apps/web/src/app/(public)/pricing/page.tsx` | P-B | Parallel |
| `apps/web/src/app/api/billing/webhook/route.ts` | P-B | Parallel |
| `apps/web/src/features/bots/**` | P-C | Parallel |
| `apps/web/src/app/(app)/app/bots/**` | P-C | Parallel |
| `apps/web/src/app/admin/bots/page.tsx` | P-C | Parallel |
| `apps/web/src/features/axioma/**` | P-D | Parallel |
| `apps/web/src/app/(app)/app/terminal/page.tsx` | P-D | Parallel |
| `apps/web/src/app/api/axioma/status|releases|download|account-link/route.ts` | P-D | Parallel |
| `apps/web/src/features/admin/**` | P-E | Parallel |
| `apps/web/src/app/(public)/products/**` | P-E | Parallel |
| `apps/web/src/app/admin/users|products|system-health/page.tsx` | P-E | Parallel |
| `apps/web/src/app/api/admin/*/route.ts` | P-E | Parallel |

---

## Risks

1. **S-1 schema migration blocks everything.** If db-architect is unavailable or the schema changes,
   the entire spine is blocked. Mitigation: db-architect is the first agent launched per SESSION_PROTOCOL
   Rule 1 (agents before edits). Platform-architect has provided the complete table spec above.

2. **S-6 is a blast-radius step.** `backend.ts`, `db-store.ts`, and `demo.ts` are the most-connected
   shared files in the web app (touched by almost every page). Any type error here blocks all downstream
   work. Mitigation: do S-7 immediately before S-6 (same sitting); run typecheck after every add.

3. **Parallel group P-C (bot analytics) produces mock data only.** `computeMetrics` will run over mock
   adapter output. The dashboard will correctly show "Simulated data" banners. Real adapter promotion
   is a post-Wave-2 gate (separate audit). Risk: implementers must not remove the `SimulatedDataBanner`
   or claim real data.

4. **Billing webhook route is a new attack surface.** P-B introduces `POST /api/billing/webhook`.
   The signature check is the first line of the handler; a coding error here could allow unsigned
   events. Mitigation: unit test for signature failure rejection; integration test for idempotency.

5. **ES256 key management.** S-8 requires a real P-256 private key in env. The existing `assertNotProduction`
   / `requiredSecret` pattern guards against missing keys. The JWKS endpoint must be public but must
   not leak private key material. Mitigation: `jwks.ts` exports only the public JWK; private key
   never leaves `signer.ts` scope.

---

## Coordination with db-architect

The db-architect must:
1. Add the four tables listed in S-1 to `packages/db/src/schema.ts`.
2. Run `npm run db:generate -w @wtc/db` to produce migration `0002_lms_full.sql`.
3. Confirm that existing `courses` / `lessons` / `materials` columns are unchanged (additive migration
   only; no column drops; no FK restructuring of existing tables).
4. Update `docs/DATA_MODEL.md` to reflect the new tables (their owned document; platform-architect
   does NOT edit DATA_MODEL).
5. Signal completion via a per-agent handoff so S-2 can begin.

The `teacher_profile_id` foreign key on `courses` replaces the current `owner_teacher_id` reference
(which points directly to `users`). The migration must either: (a) keep `owner_teacher_id` as a
deprecated column and add `teacher_profile_id` as the new FK (safer, additive), or (b) drop
`owner_teacher_id` and replace it (destructive, requires existing rows to have `teacher_profiles` rows
first). Recommended: option (a) for the migration, with a follow-up cleanup migration once all
`teacher_profiles` rows are seeded. This is a db-architect decision; platform-architect records the
constraint here.

---

## Verification/tests

DESIGN-ONLY session. No gates run this session.

Planned gates for the full Wave-2 (after I-1):
- `npm run governance:check` — per-agent handoffs cited for each group agent
- `npm run lint` + `typecheck` (both) + `npm test` + `secret:scan` + `build` + `e2e`
- `db:migrate` + `db:seed` against real PG17 — deferred until `DATABASE_URL` is available (same
  NOT RUN status as Phase 1.7)

---

## Next actions

1. **db-architect** — implement S-1: add schema tables, generate migration `0002`, write per-agent
   handoff. Do this BEFORE any implementer starts S-2.

2. **Single implementer** — S-2 through S-8 in order. S-4 and S-5 can be done by two implementers
   concurrently (different packages, no file overlap) after S-3 is complete. S-6 (backend.ts +
   db-store.ts + demo.ts) must be a single-writer atomic step.

3. **Five implementers (or five sequential passes)** — P-A through P-E after all spine gates green.
   Each group owns its stated file set exclusively.

4. **Operator** — I-1 gate run + aggregate handoff linking each group's per-agent handoff.

5. **Post-Wave-2 (separate sessions):** real-Postgres run (db:migrate + db:seed + postgres-js
   integration test); TV task-runner + `revoked_at`/`revoked_by` columns; real bot adapters (phase 4
   deployment gate); auth rate-limiting middleware; CI activation (needs git + remote).
