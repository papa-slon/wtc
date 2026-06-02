# ecosystem-product-architect handoff

## Scope

Phase 2 product design pass. Epoch 20260530-0126. This agent owns `PRODUCT_BRIEF.md`, `SITEMAP.md`, `MVP_SCOPE.md`, `OPEN_QUESTIONS.md`. Deliverables:

- (a) Full Phase-2 product map and user journeys across all six product modules
- (b) Definitive sitemap with explicit routing architecture decision
- (c) Monetization/access model per product
- (d) Part-0 truth-cleanup list for all four owned docs plus deltas for other doc owners

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/PRODUCT_BRIEF.md` (v1.0)
- `docs/SITEMAP.md` (v1.0)
- `docs/MVP_SCOPE.md` (v1.0)
- `docs/OPEN_QUESTIONS.md` (v1.0)
- `apps/web/src/lib/nav.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/(app)/app/terminal/page.tsx`
- `apps/web/src/app/(app)/app/indicators/page.tsx`
- `apps/web/src/app/(app)/app/education/page.tsx`
- `apps/web/src/app/(app)/app/billing/page.tsx`
- `apps/web/src/app/(public)/products/[slug]/page.tsx`
- `apps/web/src/app/(public)/page.tsx`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `packages/entitlements/src/registry.ts`
- `packages/db/src/schema.ts`
- `packages/tradingview-access/src/index.ts`
- `packages/lms/src/index.ts`
- Full glob of `apps/web/src/app/**/*.tsx` (route inventory)
- Full glob of `packages/**/*.ts` (package inventory)

---

## Files changed

- `docs/PRODUCT_BRIEF.md` — updated to v2.0; added Phase 2 narrative per product; corrected TV/LMS status
- `docs/SITEMAP.md` — updated to v2.0; added routing decision section; Phase column per route; Phase 2 build list table; wizard-step routing decision
- `docs/MVP_SCOPE.md` — updated to v2.0; ground-truth Phase 1.7 status column; Phase 2 target items table; TARGET table callouts; corrected TV/LMS/billing statements
- `docs/OPEN_QUESTIONS.md` — updated to v2.0; added Q-12 (routing architecture, decided) and Q-13 (education lesson route, open)
- `docs/handoffs/20260530-0126-ecosystem-product-architect.md` — this file

---

## Findings

### F-1 (MEDIUM) — TV described as "purely manual/admin-queue only" without DB context

**Evidence**: `PRODUCT_BRIEF.md` v1.0 §4.4 and `MVP_SCOPE.md` v1.0 §2.6 described TradingView access as using `tradingview_profiles` and `tradingview_access_grants` tables as if they were current. The live schema (`packages/db/src/schema.ts`) and the Phase 1.7 implementation use `tradingview_access_requests` and `tradingview_access_tasks` only. `tradingview_profiles` and `tradingview_access_grants` are TARGET tables not yet migrated.

**Action taken**: Corrected in PRODUCT_BRIEF.md §4.4 and MVP_SCOPE.md §2.6 with explicit "TARGET" labelling. Added WARNING note about current audit actions being `tradingview.submit/.grant/.revoke`.

**Delta for other docs**: `TRADINGVIEW_ACCESS_PLAN.md` and `CONTRACTS/tradingview-access.md` should clarify that `tradingview_profiles` and `tradingview_access_grants` are Phase 2 targets, not current tables. Current implementation uses `tradingview_access_requests`. The db-architect or tradingview-access-implementer should add TARGET labels to these tables in `DATA_MODEL.md` and `DOMAIN_MODEL.md`.

---

### F-2 (HIGH) — TradingView UI is DB-backed when `DATABASE_URL` is set; docs implied it was always in-memory

**Evidence**: `apps/web/src/lib/backend.ts` lines 53–61, 61: `tvService` is `dbStore.tvService` when `useDb` is true (i.e. `DATABASE_URL` is set), and `memory.tvService` otherwise. The same pattern applies to `lmsService` (lines 62–73). In dev mode without `DATABASE_URL`, both are in-memory. The `/app/indicators` and `/app/admin/tradingview-access` pages show a backend mode badge (`[storage: Postgres]` vs `[storage: in-memory (dev)]`).

Previous `MVP_SCOPE.md` §2.6 said "stores in `tradingview_profiles`" (non-existent table) and did not mention the in-memory fallback or the DB-backed path. This misleads implementers into thinking the TV store is always in-memory or that it targets a different table.

**Action taken**: Corrected in `MVP_SCOPE.md` §2.6: changed to reflect `tradingview_access_requests` as the actual table, and documented the `DATABASE_URL` vs in-memory distinction. Corrected in `PRODUCT_BRIEF.md` §4.4.

**Delta for other docs**: `TRADINGVIEW_ACCESS_PLAN.md` should document the `TvService` interface and note that the DB adapter wraps `tradingview_access_requests`, not `tradingview_profiles`. Any doc that says the TV UI "always uses the in-memory store" must be corrected.

---

### F-3 (HIGH) — Education described as "purely planned" in some contexts; thin LMS is implemented

**Evidence**: The Phase 1.7 handoff (`docs/handoffs/20260529-2352-phase-1-7-part-e-tv-lms-persistence.md`) confirmed LMS is implemented. `apps/web/src/app/(app)/app/education/page.tsx` and `apps/web/src/app/teacher/courses/[id]/page.tsx` are real, working pages using `lmsService` (DB-backed or in-memory). `packages/lms/src/index.ts` has a full `LmsService` class with course/lesson/material CRUD and ownership enforcement.

Previous `MVP_SCOPE.md` §2.7 said "stores in `teacher_profiles`/`enrollments`/`lesson_progress`" — those are TARGET tables, not current ones. The current thin LMS uses only `courses`, `lessons`, `materials`.

**Action taken**: Corrected in `MVP_SCOPE.md` §2.7 and `PRODUCT_BRIEF.md` §4.5. Added explicit TARGET labels for `teacher_profiles`, `enrollments`, `lesson_progress`. Stated the thin LMS is implemented as of Phase 1.7.

**Delta for other docs**: `EDUCATION_LMS_PLAN.md` should not call the LMS "purely planned" for basic course/lesson/material CRUD. It should note Phase 1.7 as the thin model baseline and Phase 1.8 as the enrollment/progress target.

---

### F-4 (MEDIUM) — `billing` route unity: no dual-route ambiguity found, but MVP_SCOPE had no explicit statement

**Evidence**: `apps/web/src/app/(app)/app/billing/page.tsx` exists and is the single unified billing route. `nav.ts` lists `/app/billing` as a single nav item. There was no duplicate or split billing route in the codebase. However, `MVP_SCOPE.md` v1.0 did not explicitly state the billing route is unified, and the product brief had legacy references that could suggest separate billing flows per product.

**Action taken**: Added explicit "billing route is unified" statement in `SITEMAP.md` §2.14.

---

### F-5 (LOW) — `secret-vault` KEK design notes in MVP_SCOPE

**Evidence**: `OPEN_QUESTIONS.md` Q-11 already has a thorough treatment of the env-var vs KMS KEK custody question including the `KeyProvider` abstraction path. `MVP_SCOPE.md` v1.0 did not reference Q-11 in the deferred items table, making the KEK migration path invisible to readers of MVP_SCOPE alone.

**Action taken**: Added Q-11 reference and KEK migration as an explicit deferred item in `MVP_SCOPE.md` §4.

**Delta for other docs (security-auditor)**: `SECRET_VAULT_DESIGN.md` should reference Q-11 explicitly and the Phase 3 hard gate. `SECURITY_MODEL.md` should note that env-var KEK is acceptable pre-production only. These are security-auditor docs; delta listed here for the handoff, not edited.

---

### F-6 (LOW) — `demo.ts` swap note in seed is a devops delta, not a product concern

**Evidence**: The seed mentions "swap demo.ts" as a deploy step. This is a devops/deploy concern (the `demo.ts` in-memory store should not be present in a production build). It is correctly owned by the devops-implementer, not this agent.

**Delta for devops-implementer**: Ensure the production build does not bundle `demo.ts` in-memory store in a way that could be activated. The `backend.ts` `denied` flag and `assertNotProduction()` guards already handle this at runtime, but a build-time check (e.g. `NEXT_PUBLIC_BUILD_TARGET=production` excluding demo routes) may be worth adding. Record in `ARCHITECTURE_DECISIONS.md` if a build-time approach is chosen.

---

### F-7 (MEDIUM) — `/app/bots/[bot]` MAP is hardcoded; unknown slugs return 404 — confirmed correct

**Evidence**: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` has a `MAP` of `{tortila: {code: 'tortila_bot', ...}, legacy: {code: 'legacy_bot', ...}}`. Any slug not in the map returns `notFound()`. This is correct behavior — only valid bot slugs should resolve. No product codes beyond `tortila_bot` and `legacy_bot` map to bot dashboard routes, which is consistent with the seed.

**Action taken**: Documented in `SITEMAP.md` §2.4 that `MAP` is hardcoded to two bot slugs; unknown slugs → 404. No change needed to code.

---

### F-8 (MEDIUM) — `indicators_quarterly` plan code billing field is `one_time` in registry, not `quarterly`

**Evidence**: `packages/entitlements/src/registry.ts` line 51: `indicators_quarterly: { ..., billing: 'one_time', ... }`. The plan is named "quarterly" but its billing cadence is `one_time` (not a recurring `quarterly` cadence). This may confuse implementers who expect a `quarterly` billing type. The seed's `BillingCadence` type has no `quarterly` value; it is `one_time | monthly | yearly | manual`.

**Action taken**: No change to product docs (this is a registry/billing implementation detail). Logged here for the billing-access-auditor.

**Delta for billing-access-auditor**: `BILLING_PROVIDER_PLAN.md` and `CONTRACTS/billing-webhooks.md` should clarify that `indicators_quarterly` maps to a one-time purchase with a 90-day entitlement period, not a recurring quarterly billing event. The entitlement expiry logic (not the billing cadence) enforces the 90-day window. If a recurring quarterly plan is intended, the plan registry needs a `quarterly` billing cadence and a migration.

---

## Decisions

### D-1 — Routing: Dynamic routes only; no static product/bot route duplicates

The Phase 2 prompt's list of explicit paths (`/products/tortila-bot`, `/app/bots/tortila/setup`, etc.) are served by the existing dynamic route files `/products/[slug]/page.tsx` and `/app/bots/[bot]/[section]/page.tsx`. No static route files will be created for individual products or bots. SEO is served via `generateStaticParams()`.

Recorded in `OPEN_QUESTIONS.md` Q-12.

### D-2 — Bot wizard sub-steps are UI state inside `/app/bots/[bot]/settings`, not separate routes

Setup wizard steps (exchange-keys, symbols, risk, etc.) are implemented as multi-step form state within the `settings` sub-route. The frontend-implementer may choose sub-routes if URL-addressable wizard steps are needed for deep-linking, but this is not a product scope requirement.

### D-3 — Education lesson route: `/app/education/[courseId]/[lessonId]` (default; open question)

The default for Phase 2 lesson pages is a nested dynamic route. Recorded in `OPEN_QUESTIONS.md` Q-13.

### D-4 — `tradingview_profiles` and `tradingview_access_grants` are TARGET tables

These tables appear in some Phase 0 docs as if they exist. They do not exist in `packages/db/src/schema.ts`. Any Phase 2 code referencing them must first have a migration approved by the db-architect. Until then, the implementation uses `tradingview_access_requests`.

---

## Risks

### R-1 — TARGET table confusion causing Phase 2 implementation errors

Multiple TARGET tables (`tradingview_profiles`, `tradingview_access_grants`, `teacher_profiles`, `enrollments`, `lesson_progress`) are referenced in Phase 0 docs without being labelled as TARGET. An implementer reading only a contract doc (e.g. `TRADINGVIEW_ACCESS_PLAN.md`) may write code that JOINs against a non-existent table. **Mitigation**: the four owned docs now carry explicit "TARGET" labels. The db-architect and subdomain plan owners need to add these labels to their docs (see F-1, F-3 deltas above).

### R-2 — Mock billing guard (`assertNotProduction()`) is the only runtime protection against mock-purchase in production

`/app/billing/page.tsx` uses `assertNotProduction('Mock checkout')` to block the dev-only grant. If `NODE_ENV` is misconfigured (e.g. set to `development` in a staging/production build), this guard is ineffective. **Mitigation**: the devops-implementer should verify `NODE_ENV=production` is enforced in all non-dev deployments; a build-time check (e.g. dead-code elimination of the mock form at production build) provides defense-in-depth.

### R-3 — `indicators_quarterly` billing cadence mismatch (F-8)

If the billing provider is ever wired expecting a `quarterly` subscription event, it will not find the plan in the cadence enum. The entitlement must be manually set to expire after 90 days. **Mitigation**: billing-access-auditor must clarify this in `BILLING_PROVIDER_PLAN.md` before any billing provider is wired.

### R-4 — Phase 2 sub-tab placeholders need full implementations before shippability

Five bot sub-tabs (settings, positions, trades, equity, safety) render `BotSubPagePlaceholder` components. These are clearly marked as placeholders and do not present fake data. Risk is that Phase 2 scope is under-estimated: each tab requires a complete implementation against the canonical analytics model. The settings tab in particular requires a multi-step config wizard for two different bot configurations. **Mitigation**: Phase 2 implementers should scope each tab separately; equity and positions tabs require live or mock adapter data with stale-badge handling.

---

## Verification / tests

This is a design-only agent. No code was written or modified. The following verifications were performed by inspection:

- Route inventory: all routes in `nav.ts` match pages in the `apps/web/src/app/` directory tree.
- Slug registry: all product slugs in `packages/entitlements/src/registry.ts` match the `COPY` map in `/products/[slug]/page.tsx`.
- Bot MAP: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` MAP entries match product codes in the registry.
- DB schema: `packages/db/src/schema.ts` was read and the 21 existing tables were confirmed. TARGET tables confirmed absent.
- TradingView service: `backend.ts` confirmed DB-backed vs in-memory selection logic; `tradingview_access_requests` confirmed as current table.
- LMS service: `backend.ts` confirmed LMS is DB-backed when `DATABASE_URL` set; `courses`/`lessons`/`materials` confirmed in schema.ts.
- Plan codes: `packages/entitlements/src/registry.ts` reviewed; all plan codes match seed registry.
- Billing mock guard: `assertNotProduction('Mock checkout')` confirmed in `billing/page.tsx`.

Gates RUN: design review (this agent)
Gates NOT RUN: test suite (no code changed; not applicable), DB migrations (no schema changes; not applicable), e2e (no UI changes; not applicable)

---

## Final Phase-2 sitemap (build list)

These are the routes and features that Phase 2 must implement (full implementations replacing placeholders or adding new routes):

### New route implementations (replace BotSubPagePlaceholder)

| Route | File | Action |
|-------|------|--------|
| `/app/bots/[bot]/settings` | `(app)/app/bots/[bot]/settings/page.tsx` | Full multi-step config wizard for Tortila (symbols/timeframe/risk/ATR/trailing-TP/winner-filter) and Legacy (symbols/RSI/CCI/stages/leverage/TP%/balance%); save to `bot_configs`; "pending sync" badge |
| `/app/bots/[bot]/positions` | `(app)/app/bots/[bot]/positions/page.tsx` | Full positions table from adapter; stale badge; error code flags (101211, 109421, 100410); entitlement gate |
| `/app/bots/[bot]/trades` | `(app)/app/bots/[bot]/trades/page.tsx` | Paginated trade history (50/page); date range filter; stale badge |
| `/app/bots/[bot]/equity` | `(app)/app/bots/[bot]/equity/page.tsx` | Recharts area equity chart; 8 metric cards with definition tooltips; realized vs unrealized labelled |
| `/app/bots/[bot]/safety` | `(app)/app/bots/[bot]/safety/page.tsx` | Safety event timeline; P0/P1/info severity badges; non-dismissible P0 warnings |

### New routes (no existing page)

| Route | File path to create | Notes |
|-------|--------------------|----|
| `/app/education/[courseId]/[lessonId]` | `(app)/app/education/[courseId]/[lessonId]/page.tsx` | Individual lesson page; video embed/PDF/link materials; progress mark button; requires `enrollments`/`lesson_progress` migration (Phase 1.8) |

### Full content replacements (skeletons → real implementations)

| Route | File | Action |
|-------|------|--------|
| `/app/products` | `(app)/app/products/page.tsx` | Full 6-product entitlement state grid; plan/state/expiry cards; upgrade CTAs |
| `/app/support` | `(app)/app/support/page.tsx` | Create ticket form + ticket list; Axioma support CTA |

### Phase 2 content expansions (public pages)

| Route | File | Action |
|-------|------|--------|
| `/products/[slug]` | `(public)/products/[slug]/page.tsx` | Expand `COPY` map per product slug with full sales copy, screenshots, feature lists, system requirements (terminal), risk/known-limitations (tortila), pricing CTAs |

### DB migrations required before Phase 2 sub-features

| Table | Purpose | Prerequisite for |
|-------|---------|-----------------|
| `tradingview_profiles` | Per-user TV profile metadata | TV access Phase 2 features |
| `tradingview_access_grants` | Normalized grant records | TV access grant tracking Phase 2 |
| `teacher_profiles` | Teacher profile metadata | Full teacher dashboard Phase 1.8 |
| `enrollments` | Student–course enrollment | Progress tracking Phase 1.8 |
| `lesson_progress` | Per-lesson completion state | Progress bar, lesson mark button |

All migrations must go through the db-architect and be approved before any Phase 2 code references these tables.

---

## Part-0 truth-cleanup deltas

### Deltas in docs owned by this agent (applied in this session)

| Doc | Location | Old (misleading) text | Corrected text | Severity |
|-----|----------|-----------------------|----------------|----------|
| `PRODUCT_BRIEF.md` | §4.4 TV section | Referenced `tradingview_profiles` and `tradingview_access_grants` as if current | Corrected to `tradingview_access_requests`; TARGET tables labelled | HIGH |
| `PRODUCT_BRIEF.md` | §4.5 Education | Implied education was "purely planned" | Stated thin LMS is implemented Phase 1.7; TARGET tables labelled | HIGH |
| `MVP_SCOPE.md` | §2.6 TV | "stores in `tradingview_profiles`" | Corrected to `tradingview_access_requests`; DB-backed vs in-memory documented | HIGH |
| `MVP_SCOPE.md` | §2.6 TV | No mention of in-memory fallback | Added: DB-backed when `DATABASE_URL` set; in-memory dev fallback | MEDIUM |
| `MVP_SCOPE.md` | §2.7 LMS | Referenced `teacher_profiles`, `enrollments`, `lesson_progress` as current | All three labelled TARGET; thin LMS as Phase 1.7 baseline | HIGH |
| `MVP_SCOPE.md` | §3 deferred | No KEK migration item | Added KEK env-var → managed KMS as Phase 3 deferred item (Q-11 ref) | LOW |
| `SITEMAP.md` | (new section) | No routing architecture decision | Added explicit D-1 decision: dynamic routes only | MEDIUM |
| `SITEMAP.md` | §2.14 billing | No explicit "unified route" statement | Added "billing route is unified" | LOW |
| `SITEMAP.md` | All routes | No Phase column | Added Phase 1.x vs 2 vs deferred column per route | MEDIUM |
| `OPEN_QUESTIONS.md` | (new entries) | No Q-12 or Q-13 | Added Q-12 (routing, decided) and Q-13 (lesson route, open) | LOW |

### Deltas for other doc owners (not applied — out of write scope)

These changes must be applied by the respective doc owners. They are listed here for the aggregate phase handoff to action.

**tradingview-access-implementer → `TRADINGVIEW_ACCESS_PLAN.md` and `CONTRACTS/tradingview-access.md`:**
- Current implementation uses `tradingview_access_requests` table (EXISTS in schema.ts). Change any reference to `tradingview_profiles` or `tradingview_access_grants` to label them as Phase 2 TARGET additions.
- Note that the TV service is already DB-backed when `DATABASE_URL` is set (not "purely in-memory"). The `TvService` interface wraps `tradingview_access_requests` rows.
- Current audit actions: `tradingview.submit`, `tradingview.grant`, `tradingview.revoke`. Confirm these match `AUDIT_LOG_SCHEMA.md`.

**education-implementer → `EDUCATION_LMS_PLAN.md`:**
- Thin LMS (Course/Lesson/Material CRUD, entitlement-gated student view) is implemented as of Phase 1.7. Remove any statement calling basic LMS functionality "purely planned."
- Phase 1.8 adds `teacher_profiles`, `enrollments`, `lesson_progress` tables and full enrollment/progress tracking. These are TARGET tables — mark them clearly.
- Note the LMS is DB-backed when `DATABASE_URL` is set (same pattern as TV service).

**billing-access-auditor → `BILLING_PROVIDER_PLAN.md` and `ENTITLEMENT_STATE_MACHINE.md`:**
- `indicators_quarterly` plan code has `billing: 'one_time'` in the registry (not a recurring `quarterly` cadence). Clarify that this is a one-time purchase creating a 90-day entitlement, not a recurring quarterly billing event. If a recurring quarterly subscription is intended, the `BillingCadence` enum needs a `quarterly` value and the registry needs updating.
- Mock purchase guard is `assertNotProduction('Mock checkout')` in `billing/page.tsx`. Note this in the billing plan as a dev-only bypass, hard-disabled in production.

**security-auditor → `SECRET_VAULT_DESIGN.md` and `SECURITY_MODEL.md`:**
- `SECRET_VAULT_DESIGN.md`: reference Q-11 explicitly. The env-var KEK is acceptable for dev/pre-production. Phase 3 hard gate: no production deployment with real user exchange keys at scale on env-only KEK custody. The `KeyProvider` abstraction for `packages/crypto/src/vault.ts` should be the formal Phase 3 target.
- `SECURITY_MODEL.md`: note that `assertNotProduction()` in `billing/page.tsx` is a runtime guard but not a build-time elimination. Recommend defense-in-depth at the build level.

**devops-implementer → deployment docs:**
- `demo.ts` (in-memory store) ships in the Node.js bundle but is never activated in production because `NODE_ENV=production && !DATABASE_URL` triggers the `denied` flag in `backend.ts`. Verify that `NODE_ENV=production` is enforced in all non-dev deployments; a wrong `NODE_ENV` in staging could activate in-memory mode silently. Add a startup assertion if not already present.
- The mock purchase form in `/app/billing` is guarded by `assertNotProduction()`. If a staging environment is deployed with `NODE_ENV=development`, this guard is bypassed. Confirm the environment variable policy.

**db-architect → `DATA_MODEL.md` and `DOMAIN_MODEL.md`:**
- Add explicit TARGET labels to: `tradingview_profiles`, `tradingview_access_grants`, `teacher_profiles`, `enrollments`, `lesson_progress`. These are in the seed's bounded context list but not yet in `packages/db/src/schema.ts`. An implementer reading `DATA_MODEL.md` should immediately know which tables are current vs future migrations.

---

## Next actions

1. Aggregate phase handoff author: cite this handoff (`docs/handoffs/20260530-0126-ecosystem-product-architect.md`) in the phase aggregate.
2. db-architect: apply TARGET labels to `DATA_MODEL.md` / `DOMAIN_MODEL.md` for the five tables listed above. Schedule Phase 1.8 migration for `teacher_profiles`, `enrollments`, `lesson_progress`.
3. tradingview-access-implementer: update `TRADINGVIEW_ACCESS_PLAN.md` per delta above.
4. education-implementer: update `EDUCATION_LMS_PLAN.md` per delta above.
5. billing-access-auditor: clarify `indicators_quarterly` billing cadence in `BILLING_PROVIDER_PLAN.md`.
6. security-auditor: add Q-11 Phase 3 gate reference to `SECRET_VAULT_DESIGN.md`.
7. devops-implementer: verify `NODE_ENV=production` enforcement and mock-store bypass risk in staging.
8. Phase 2 frontend-implementer: use `docs/SITEMAP.md` §5 (Phase 2 build list) as the authoritative task list. Build the five bot sub-tabs, two skeleton replacements, education lesson route (after Phase 1.8 migration), and expanded public product page copy. Do NOT add static route files for individual products or bots — use dynamic routes as decided (Q-12).
9. Phase 2 backend-implementer: Phase 1.8 DB migration for `teacher_profiles`, `enrollments`, `lesson_progress` must land before individual lesson pages or progress tracking are wired.
