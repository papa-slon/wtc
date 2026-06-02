# Phase 2.11 / Phase Group 8 — Admin console: mobile-readable cards + honest state pills (aggregate handoff)

_2026-05-30, epoch `20260530-2345`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **4 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run (`wf_e5c0e2fe-2d7`)
→ operator-orchestrated **serial** implementation (not a git repo, no worktrees, no parallel writers). **4 per-agent
handoff files** at this epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge /
TradingView automation / Axioma production handoff. **Not production-ready.** Seventh phase-group window in the operator's
continuous program (follows Phase 2.10 / PG7, epoch `20260530-2330`)._

## Scope

PG8 (Admin console) from [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md) W9 / [`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §8 —
a **UI/UX phase, no migration** (`db:generate` = "No schema changes"; 41 tables, unanimous 4/4 auditor verdict). Two deliverables
across the admin console (the 8 named pages `/admin/{users,entitlements,entitlements/review,tradingview-access,bots,education,
system-health,support}` + the shared `/admin` overview and `/admin/audit-log`, since the fixes are shared-surface):

1. **Mobile-readable cards — no 375px horizontal scroll.** `.wtc-table` had zero responsive handling; the **10-column TradingView
   queue** (its Action cell carrying the inline grant/revoke forms), the 7-column entitlements timeline, and ~6 other tables
   overflowed horizontally at 375px with no recovery. Fixed with a **CSS-only `data-label` card-stack** (`.wtc-table-wrap` in
   `packages/ui/src/theme.css`; DESIGN_SYSTEM §14): below 640px each row becomes a labelled card, so there is no horizontal page
   scroll regardless of column count. **Critical co-fix:** the admin layout never rendered `<MobileNav>` (the sidenav is
   `display:none` below 900px), so admins had **no navigation on mobile** — `<MobileNav items={ADMIN_NAV} />` was added inside the
   admin tree (after the `isAdmin` gate). A `min-width:0 !important` mobile rule lets fixed-`minWidth` inline form inputs shrink to
   fit 375px (the review form's 280px input overflowed). Filter links → 44px tap-target chips.
2. **Honest empty/demo/postgres/blocked state pills everywhere**, consuming the real PG2/PG5 state. The canonical pill taxonomy
   (§14.3) is applied consistently; the `/admin` overview moved off the stale in-memory `tvService` to a DB-backed
   `loadAdminOverview()` (honest demo→0) + a canonical storage pill + per-page `requireUser`+`assertAdmin`; the **PG2 Tortila
   read-state** is surfaced on `/admin/bots` as a **derived** pill (from the last persisted health check — no live probe); the
   **PG5 expiring-soon** grants get a `RiskWarningBanner` on the TV queue (auto-revoke timeline). `/admin/audit-log` also gained
   per-page RBAC + a storage pill. Defence-in-depth: `eventSnapshot` is allowlisted to `{id,type,planCode}` in the loader.

**Migration:** none (41 tables; `db:generate` = "No schema changes, nothing to migrate").

## Agents launched (4 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run `wf_e5c0e2fe-2d7`; all 4 returned, none left running):
1. `ecosystem-ux-ui-designer` → [`…-ecosystem-ux-ui-designer.md`](20260530-2345-ecosystem-ux-ui-designer.md) — owned the responsive
   pattern decision (CSS `data-label` card-stack over a scroll box), the canonical pill taxonomy (§14.3), the MobileNav wiring, the
   derived bots read-state pill, and a per-page state map + implementer checklist (appended as DESIGN_SYSTEM.md §14). F-01..F-10.
2. `ecosystem-frontend-implementer` → [`…-ecosystem-frontend-implementer.md`](20260530-2345-ecosystem-frontend-implementer.md) —
   the minimal-diff file map (shared spine vs per-page), the education non-canonical-RBAC + nested-`<main>` finding, the PG2
   readState gap, the PG5 expiring-soon banner, `migrationNeeded:false`. F1..F10.
3. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-2345-ecosystem-security-auditor.md) — confirmed
   passwordHash-stripping, CSRF-form integrity on reflow, admin-only `revokeReason` isolation; flagged the overview/education
   weaker-RBAC gap, the unreachable CSRF forms inside the unwrapped TV table on mobile, the `eventSnapshot` render-time allowlist,
   and the MobileNav-after-the-gate placement requirement. F-01..F-10.
4. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260530-2345-ecosystem-tests-runner.md) — the 375px acceptance
   plan, the mobile-project-is-390-not-375 gap, the admin-login path, **the inherited PG7 packages-typecheck failure (F-06,
   5 errors)** and the `db-pg5` `beforeAll` hookTimeout flake (F-07). F-01..F-10.

## Cross-auditor conflicts resolved (operator decisions)

1. **Responsive mechanism.** ux-ui-designer (card-stack `data-label`) vs security/tests (mentioned `overflow-x:auto` scroll box).
   **Decision: card-stack** — a scroll box still scrolls and fails "no 375px horizontal scroll". (ADR-018; §14.1.)
2. **PG2 readState surfacing.** frontend-implementer F5 suggested a live `getBotAdapter().getHealth()` call in the loader (3s
   timeout); ux-ui-designer §14.6 suggested deriving from the persisted DB signals. **Decision: derive from DB** — an ops page
   reflects the last worker cycle, and a synchronous network probe in a server-render path is the wrong place. No live probe.
3. **`eventSnapshot` hardening.** frontend (comment-only) vs security/ux (query-layer allowlist). **Decision: loader allowlist**
   (`pickSafeSnapshot` → `{id,type,planCode}`) — lossless for every current call site (verified) + defence-in-depth, plus a
   traceability comment at the render site.
4. **Scope.** The named acceptance set is 8 pages, but the **shared** fixes (the `.wtc-table-wrap` CSS + the layout `<MobileNav>`)
   naturally cover the whole admin console; applying them to all 10 admin pages (incl. `/admin` overview + `/admin/audit-log`) is
   correct — a half-applied responsive fix would be a quality regression. A false positive was rejected: ux F-05 ("education
   MetricCards missing `wtc-grid-4` wrapper") — the wrapper is already present; not changed.
5. **Inherited red gate.** The tests-runner found `npm run typecheck` exits **2** on the PG7 tree (5 `noUncheckedIndexedAccess`
   errors in PG7's `audit.test.ts` + `lms-rbac-pipeline.test.ts`). **Decision: fix it in PG8** — a phase cannot claim gates green
   while a gate is red; the fix is 5 mechanical non-null assertions in test files. (PG7's "typecheck ✓" claim was inaccurate.)

## Files changed

**Spine / shared (single-writer, serialized-first):**
- `packages/ui/src/theme.css` — new `.wtc-table-wrap` responsive card-stack (§14.1) + `@media (max-width:640px)` 44px tap targets
  and `min-width:0 !important`; card-stack `td` gets `overflow-wrap:anywhere`/`word-break:break-word` so long mono values
  (`targetType:targetId`, action codes) wrap instead of forcing the card wider than 375px.
- `apps/web/src/app/admin/layout.tsx` — import + render `<MobileNav items={ADMIN_NAV} />` inside the admin tree (after the gate).
- `apps/web/src/features/admin/queries.ts` — `pickSafeSnapshot` eventSnapshot allowlist (applied in `loadManualReviewItems`) +
  new `loadAdminOverview()` (DB-backed counts; demo→0).

**Per-page (disjoint):** `apps/web/src/app/admin/` — `page.tsx` (RBAC + storage pill + DB counts), `users/page.tsx`,
`entitlements/page.tsx` (2 tables), `entitlements/review/page.tsx` (comment), `tradingview-access/page.tsx` (2 tables +
`wtc-td-action` + expiring-soon banner), `bots/page.tsx` (table + derived journal read-state pill), `education/page.tsx`
(canonical RBAC + `<div className="wtc-stack">` root + table), `system-health/page.tsx` (table), `support/page.tsx`
(filter chips + `buttonClasses`), `audit-log/page.tsx` (RBAC + storage pill + table).

**Tests:**
- `tests/integration/admin-responsive.test.ts` (**new**, 35) — static guards (vitest excludes `apps/web/**`): every admin table
  wrapped + has `data-label`; MobileNav in the layout; education canonical-RBAC + no nested `<main>`; overview RBAC + storage pill;
  every page renders a `StatusPill`.
- `tests/e2e/admin-mobile-pg8.spec.ts` (**new**) — at exactly 375px: no horizontal page scroll + MobileNav visible + storage pill
  across all 10 admin pages (scoped to the mobile project; logs in as `admin@wtc.local`).
- `packages/audit/src/audit.test.ts` + `tests/integration/lms-rbac-pipeline.test.ts` — 5 non-null fixes (the inherited red
  typecheck gate). `tests/integration/db-pg5.test.ts` — `beforeAll` 30s timeout (PGlite-under-load flake).

**Docs (owned-doc truth, serialize-last):** `docs/DESIGN_SYSTEM.md` §14 (ux-ui-designer), `docs/ARCHITECTURE_DECISIONS.md`
**ADR-018**, `docs/ROADMAP_MASTER.md` §8, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`.

## Findings → fixes (summary)

- **Critical (4/4): no admin mobile nav.** `<MobileNav items={ADMIN_NAV} />` added after the layout's `isAdmin` gate (links never
  exposed to non-admins; `.wtc-main` already has 88px bottom padding ≤900px).
- **High: 375px table overflow (TV 10-col worst).** All 10 admin tables wrapped in `.wtc-table-wrap` + `data-label`; the TV Action
  cell uses `.wtc-td-action` (full-width stacked forms). The e2e at 375px **caught a real overflow** the demo-empty DB-backed pages
  hid: `/admin/audit-log` (the only table rendering rows in demo) overflowed on long mono values → fixed with
  `overflow-wrap:anywhere` on the card-stack `td`. CSRF forms reflow as complete units (security F-10 honoured).
- **High: education page.** Canonical `requireUser`+`assertAdmin` (was `getCurrentUser`+`roles.includes`); root `<main>` →
  `<div className="wtc-stack">` (kills nested `<main>`).
- **Medium: PG2/PG5 surfacing.** Derived journal read-state pill on `/admin/bots`; expiring-soon `RiskWarningBanner` on the TV queue.
- **Medium: honest pills + overview.** `/admin` overview moved to a DB-backed loader + canonical pill + per-page RBAC; audit-log
  gained the same. `eventSnapshot` allowlisted in the loader.
- **Inherited red gate fixed.** `npm run typecheck` was exit 2 (5 PG7 test-file errors) → now exit 0.

## Decisions

1. No migration this phase (41 tables, unanimous). Pure UI/UX + 3 test-file fixes.
2. CSS `data-label` card-stack (not a scroll box) is the responsive mechanism; no new shared component (ADR-018 / §14.1).
3. PG2 readState pill is **derived from persisted health checks**, not a live probe in the render path.
4. `eventSnapshot` is allowlisted to `{id,type,planCode}` in the loader (lossless + defence-in-depth).
5. Shared fixes apply to all 10 admin pages (consistency); the named-8 are the acceptance set.
6. The inherited PG7 typecheck failure is fixed in PG8 (a phase may not claim green over a red gate).

## Risks

- **Demo-mode table coverage.** e2e runs in demo (no `DATABASE_URL`), so most DB-backed admin tables render their EmptyState — the
  375px spec exercises the card-stack with real rows only on `/admin/audit-log` (in-memory backend). The table **wrapping** on every
  page is guarded statically (`admin-responsive.test.ts`); the card-stack-with-data rendering is proven on audit-log + reasoned from
  the shared CSS. A real-PG e2e (B1) would exercise all populated tables. Honest gap.
- **Server actions not executed in vitest** (apps/web excluded) — admin page guarantees are static-source + e2e asserted, the
  established repo pattern. No behavioural regression in the admin server actions was in PG8 scope (RBAC/CSRF unchanged).
- All surfaces still render the honest labelled demo state here; **PGlite is not a substitute for real-PG acceptance (B1)** —
  unchanged. Still NOT production-ready.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run check:core` | **PASS** (7 smokes) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 3 | `npm run typecheck` (packages) | **PASS** (exit 0 — **fixed the inherited PG7 exit-2: 5 test-file `noUncheckedIndexedAccess` errors**) |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** (exit 0 — all 10 page edits + 2 helpers) |
| 5 | `npm run secret:scan` | **PASS** (clean) |
| 6 | `npm test` (Vitest) | **PASS — 441 passed / 8 skipped (449)** across 40 files (+35 vs 2.10's 406: admin-responsive 35; db-pg5 flake fixed) |
| 7 | `npm run coverage` | **PASS — 26.83% stmts / 74.32% branch** (branch held; stmts −0.29 vs PG7's 27.12 = new app-layer admin code — loaders/helpers/page edits — in the e2e-covered, unit-excluded `apps/web` denominator; no enforced threshold) |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 41 tables; "No schema changes, nothing to migrate"** (no migration) |
| 9 | `npm run build -w @wtc/web` | **PASS — 33/33 pages; `ƒ Middleware 35.2 kB`** |
| 10 | `npm run e2e` (Playwright) | **PASS — 36 passed / 1 flaky (auto-retried green — known dev-only Server-Action recompilation race) / 1 skipped (desktop instance of the mobile-only 375px spec)** (5.3 min; incl. the new `admin-mobile-pg8` 375px spec; `retries:2` carried). The 375px spec **caught a real `/admin/audit-log` overflow** on long mono values, fixed pre-merge via `overflow-wrap` on the card-stack `td`, then re-run green. |
| 11 | `npm run governance:check` | **PASS** (current phase `20260530-2345`; 4 cited per-agent handoffs all present; 0 errors, 1 allowlisted historical warning) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | **B2 Stripe test-mode checkout** | **NOT RUN** — Q-2 undecided + no Stripe test keys (unchanged). |
| — | **B4 Axioma real activation** | **NOT RUN / TARGET** — OP P-256 key + EXT endpoint shapes (unchanged). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production handoff /
journal_server, TradingView automation, plaintext exchange keys. `BOT_ADAPTER_MODE=mock` default preserved; legacy real adapter
stays deleted + factory-blocked (B3); all three Axioma terminal CTAs stay disabled (B4).

## Background agents — closed

All 4 per-agent runs in the audit fan-out (Workflow `wf_e5c0e2fe-2d7`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG9 User cabinet** — per-product cards (entitlement/setup/activity/next-action/blockers) + mobile-first setup wizards;
  depends on PG4/PG7 outputs ([`ROADMAP_MASTER.md`](../ROADMAP_MASTER.md) §9).
- **Phase-3 LMS rich** — migration 0005 co-landed with its consumers + pinned-link/teacher-profile web surfaces (carried from PG7).
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider + test keys (B2); Axioma endpoint
  shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3); git init + remote (B6); Q-6 club+education bundling.
- **Carried:** F-03 structured logger (PG12); CSP per-request nonce; move static headers to `next.config.ts`. Consider a real-PG
  e2e pass to exercise the populated admin tables' card-stack (demo renders EmptyState for DB-backed pages).
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
