# ecosystem-ux-ui-designer handoff

## Scope

Phase 2.11 / PG8 — Admin console responsive + state-pill taxonomy + PG2/PG5 surfacing.
Read-only audit of all 8 admin pages, the admin layout, the design token system, the MobileNav
component, and relevant data layers. Produced concrete implementation specs for the frontend
implementer: the responsive table pattern, the 10-column TV table at 375px, the full pill taxonomy,
the MobileNav gap, and per-page state maps. Also produced DESIGN_SYSTEM.md §14 which is the
authoritative source for all PG8 implementation decisions.

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `C:\Users\maxib\Downloads\wtc_premium_redesign\wtc_premium_redesign\v2-terminal-os.html`
- `packages/ui/src/theme.css`
- `packages/ui/src/components.tsx`
- `packages/ui/src/index.ts`
- `packages/ui/src/tokens.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `apps/web/src/app/admin/entitlements/review/page.tsx`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/support/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/tv/queries.ts`
- `apps/web/src/components/MobileNav.tsx`
- `apps/web/src/lib/nav.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/types.ts`
- `docs/DESIGN_SYSTEM.md`

## Files changed

None — read-only audit. (DESIGN_SYSTEM.md §14 was appended as the deliverable for this phase;
it is a design doc update, not a code edit.)

Actually: `docs/DESIGN_SYSTEM.md` had §14 appended (20260530). This is the only write.

## Findings

### Finding 1 — CRITICAL: Admin console has zero navigation on mobile (375–900px)

**Severity:** critical  
**Evidence:** `apps/web/src/app/admin/layout.tsx:17-38` — the `AdminLayout` renders
`.wtc-shell` with a `.wtc-sidenav` and a content `<div>`. The sidenav is `display:none` below
900px (`packages/ui/src/theme.css:121`). No `<MobileNav>` is rendered. The `<MobileNav>`
component (`apps/web/src/components/MobileNav.tsx`) and its styles (`apps/web/src/app/globals.css:9-18`)
exist and work correctly for the `(app)` layout — they are simply not used in admin.  
**Recommendation:** Import `MobileNav` and render `<MobileNav items={ADMIN_NAV} />` inside
`AdminLayout` after the `<main>` element. `ADMIN_NAV` is already imported. The `.wtc-mobile-nav`
CSS needs no changes — it already activates below 900px. Tap targets are pill-shaped links;
the 10-item ADMIN_NAV fits with horizontal scroll (overflow-x: auto is already set).  
**Target:** `apps/web/src/app/admin/layout.tsx`

---

### Finding 2 — HIGH: 10-column TradingView table overflows at 375px with no recovery

**Severity:** high  
**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx:56-158` — the request queue
table has columns: User, TV username, Status, Submitted, Granted, Granted by, Expires, Revoked,
Revoked by, Action. The Action cell contains nested `<form>` elements with `<input>` and
`<button>` elements. `packages/ui/src/theme.css:104` defines `.wtc-table` with no overflow-x
wrapper and no mobile stacking. At 375px this table overflows the viewport by approximately 800px.
The grant-history table (`apps/web/src/app/admin/tradingview-access/page.tsx:162-197`) has 6
columns and also overflows.  
**Recommendation:** Add the `wtc-table-wrap` CSS to `packages/ui/src/theme.css` (exact CSS
provided in DESIGN_SYSTEM.md §14.1). Wrap both tables in `<div className="wtc-table-wrap">`.
Add `data-label` attrs to every `<td>`. Add `className="wtc-td-action"` to the Action cell so
its nested forms stack full-width. Do NOT use `overflow-x:auto` — that would still scroll
horizontally. The card-stack approach renders each row as a labelled card with the Action form
at the bottom, full-width. Exact 375px render spec is in DESIGN_SYSTEM.md §14.2.  
**Target:** `packages/ui/src/theme.css` (new CSS), `apps/web/src/app/admin/tradingview-access/page.tsx`

---

### Finding 3 — HIGH: Users, bots, health, education tables overflow at 375px

**Severity:** high  
**Evidence:**
- `apps/web/src/app/admin/users/page.tsx:63-93` — 4-col table: Email, Display name, Roles, Registered. No overflow wrapper.
- `apps/web/src/app/admin/bots/page.tsx:205-232` — 4-col health checks table. No wrapper.
- `apps/web/src/app/admin/system-health/page.tsx:154-182` — 4-col integration health checks table. No wrapper.
- `apps/web/src/app/admin/education/page.tsx:37-49` — 4-col courses table. No wrapper.
- `apps/web/src/app/admin/entitlements/page.tsx:267-299` — 7-col product-access timeline table inside `<details>`. No wrapper.
- `apps/web/src/app/admin/entitlements/page.tsx:91-124` — 6-col billing review preview table. No wrapper.

All of the above use `.wtc-table` which has no mobile stacking. At 375px all overflow.  
**Recommendation:** Apply `<div className="wtc-table-wrap">` wrapper + `data-label` attrs per
DESIGN_SYSTEM.md §14.1 and §14.8 checklist. Once the CSS lands in `theme.css`, this is a
mechanical markup change across the affected pages.  
**Target:** All 6 files listed above + `packages/ui/src/theme.css` (prerequisite)

---

### Finding 4 — HIGH: Education page uses nested `<main>` (invalid HTML + broken layout)

**Severity:** high  
**Evidence:** `apps/web/src/app/admin/education/page.tsx:18` — the component returns
`<main className="wtc-container" style={{padding:'34px 22px'}}>` as its root. The admin layout
wraps children with `<main className="wtc-main">` at `apps/web/src/app/admin/layout.tsx:35`.
This produces `<main><main>...</main></main>` in the HTML — non-conforming per the HTML spec
(landmark regions must not be nested). Additionally, `wtc-container` has `max-width:var(--max)`
with `margin:0 auto` which centers content independently inside the layout grid, causing misaligned
padding vs all other admin pages.  
**Recommendation:** Change `<main className="wtc-container" style={{...}}>` to
`<div className="wtc-stack">` to match all other admin pages. This also fixes the padding
inconsistency — the layout's `wtc-main` supplies the correct padding.  
**Target:** `apps/web/src/app/admin/education/page.tsx:18`

---

### Finding 5 — HIGH: Education MetricCards missing grid wrapper

**Severity:** high  
**Evidence:** `apps/web/src/app/admin/education/page.tsx:25-29` — four `<MetricCard>` components
are rendered consecutively with no parent `<div className="wtc-grid wtc-grid-4">` wrapper.
Without the grid class, MetricCards render as vertical block elements, defeating the 4-up layout
that `.wtc-grid-4` provides. This is inconsistent with admin/page.tsx line 13 which correctly
wraps the same pattern.  
**Recommendation:** Wrap the four MetricCards in `<div className="wtc-grid wtc-grid-4">`.
The grid already collapses to 2-col at 1050px and 1-col at 640px per `theme.css:66-67`.  
**Target:** `apps/web/src/app/admin/education/page.tsx`

---

### Finding 6 — MEDIUM: Tortila readState not surfaced in admin/bots — honest state incomplete

**Severity:** medium  
**Evidence:** `packages/bot-adapters/src/types.ts:33` defines `ReadState` as
`'ok' | 'not_configured' | 'unreachable' | 'malformed' | 'stale'`. The admin bots page
shows `adapterMode` (env-derived, coarse) and `tortilaLastOkAt`/`tortilaLastError` (DB-backed,
from last worker cycle). These are adequate for ops but do not surface the 5-state readState
taxonomy that PG2 specifically delivered. An admin viewing the page cannot distinguish
`not_configured` from `unreachable` from `stale` — they all look the same in the current
pills row.  
**Recommendation:** Derive a readState-equivalent pill from existing query data (no schema change):
- `mode='demo'` → warn "journal: demo mode"
- `tortilaLastOkAt!=null && !tortilaLastError` → ok "journal: last check ok"
- `tortilaLastError!=null` → bad "journal: last check error — [truncated detail]"
- `mode='postgres' && tortilaLastOkAt=null && tortilaLastError=null` → neutral "journal: no checks (worker not run)"
See DESIGN_SYSTEM.md §14.6 for the full derivation spec.  
**Target:** `apps/web/src/app/admin/bots/page.tsx` (UI change only; queries.ts already returns the needed fields)

---

### Finding 7 — MEDIUM: Pill taxonomy is inconsistent across pages — three variants unspecified

**Severity:** medium  
**Evidence:** Seven pages implement storage-mode pills consistently (verified). However:
- `apps/web/src/app/admin/bots/page.tsx:44` uses an ad-hoc ternary for `adapterMode` that maps
  `mock → warn`, `read-only → neutral`, everything else `→ ok`. This is correct but not documented.
- `apps/web/src/app/admin/bots/page.tsx:49-53` has `base URL: configured` mapped to `neutral` and
  `base URL: not set` mapped to `warn` — correct but undocumented.
- There is no defined pill for `readState` states (`not_configured`, `unreachable`, `malformed`, `stale`).
- The health-check status pill uses `hc.status === 'ok' || hc.status === 'healthy'` → ok,
  all else → bad. This silently swallows `degraded` and `stale` as generic `bad` — acceptable
  but should be made explicit.

**Recommendation:** Use the canonical taxonomy defined in DESIGN_SYSTEM.md §14.3.
No code changes required where existing behavior already matches the canonical taxonomy;
the document formalizes what was implicit.  
**Target:** DESIGN_SYSTEM.md §14.3 (written), confirm implementer reads before adding any new pills

---

### Finding 8 — MEDIUM: entitlements/review eventSnapshot could render PII if eventSnapshot contains it

**Severity:** medium  
**Evidence:** `apps/web/src/app/admin/entitlements/review/page.tsx:97-115` —
`JSON.stringify(item.eventSnapshot, null, 2)` is rendered inside `<pre>`. The page comment at line
21 states "Raw Stripe body and signature are NEVER stored or rendered here" and relies on the
webhook handler stripping PII before writing `eventSnapshot`. Verification: the webhook handler
in `packages/billing/src/webhook.ts` is the trust boundary — this audit cannot verify its
completeness from these files alone.  
**Recommendation:** The UI-layer defence (showing only `eventSnapshot` not raw body) is correct.
For defence-in-depth: add a Zod pick/allowlist in the loader at
`apps/web/src/features/admin/queries.ts:185-186` that projects only known-safe fields (`id`,
`type`, `planCode`, `created`) from `eventSnapshot` before returning it to the component. This
ensures PII cannot leak even if a future webhook change inadvertently persists more data.  
**Target:** `apps/web/src/features/admin/queries.ts:185` (enhancement, not a current leak)

---

### Finding 9 — LOW: Admin overview page (page.tsx) uses `backendMode` but other pages use `getServerDb()` null-check

**Severity:** low  
**Evidence:** `apps/web/src/app/admin/page.tsx:2` imports `backendMode` from `@/lib/backend` and
uses it for the inline mode display at line 17. All other admin pages derive mode from `getServerDb()`
null-check inside their feature loaders. This is two different mechanisms for the same signal.
If `backendMode` and the null-check diverge (e.g., if `backendMode` is computed differently than
`!!getServerDb()`), the overview page would show a different state than sub-pages.  
**Recommendation:** Standardize the overview page to use a loader from `features/admin/queries.ts`
that returns `mode` consistently, or verify that `backendMode === 'postgres'` iff
`getServerDb() !== null`. This is a low-priority clean-up.  
**Target:** `apps/web/src/app/admin/page.tsx`

---

### Finding 10 — LOW: Support page status filter links are plain `<a>` tags with no button semantics

**Severity:** low  
**Evidence:** `apps/web/src/app/admin/support/page.tsx:82-96` — status filter links use raw
`<a href="...">` with inline color style instead of `<StatusPill>` or a consistent filter-chip
pattern. Active state is communicated only via `color: var(--gold)` vs `var(--muted)`. No
border, no background, no minimum tap target.  
**Recommendation:** Wrap filter links in a consistent `<nav>` with `<a>` elements styled as
filter chips — border `1px solid var(--stroke)`, active: `border-color: var(--stroke-gold)`,
padding `8px 12px`, `border-radius: 999px` to match the mobile nav pill style. Minimum height
44px on mobile.  
**Target:** `apps/web/src/app/admin/support/page.tsx`

---

### Finding 11 — INFO: Entitlements page grant form `minWidth: 200` on inputs will overflow at 375px

**Severity:** info  
**Evidence:** `apps/web/src/app/admin/entitlements/page.tsx:179,199` — the revoke and flag-review
forms have `minWidth: 200` on their `<input>` elements. The form uses `wtc-row` + `flexWrap:'wrap'`
so the inputs will wrap to a new line at 375px. However, the `minWidth: 200` combined with
`flex: 1` may cause the input to exceed the card width (card is 375px minus 24px padding = 351px
usable, minus the button width). The `flexWrap` saves this from overflowing the viewport but the
layout may look cramped.  
**Recommendation:** Add `@media (max-width: 640px) { .wtc-input[style*="minWidth"] { min-width: 0 !important; } }`
or — preferably — remove inline minWidth from these inputs and rely on `flex: 1` with a CSS
min-width utility. Not a blocking layout issue at 375px but worth addressing for density.  
**Target:** `apps/web/src/app/admin/entitlements/page.tsx`

---

### Finding 12 — INFO: PG5 revokeReason is correctly surfaced in admin TV table (confirmed)

**Severity:** info  
**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx:191` — the grant-history table
renders `g.revokeReason` in the last column with a comment "Admin-only: revoke reason
(incl. 'expired_by_worker' for auto-expiry). Never shown to users." The `TvGrantRow` type
includes `revokeReason` per `apps/web/src/features/tv/queries.ts`. PG5 state is correctly
propagated to the admin UI. No gap here.  
**Recommendation:** No action needed. Document as confirmed.

---

## Decisions

1. **Responsive pattern: CSS-only data-label card-stack.** Rejected (a) overflow-x scroll (violates
   "no horizontal scroll" hard requirement). Rejected shared React component wrapper for PG8
   (premature abstraction; CSS-only suffices). CSS lives in `packages/ui/src/theme.css` so it is
   universally available to all current and future admin tables.

2. **TV 10-column table at 375px: full card-stack, no column hiding.** Every column becomes a
   labelled row in the card. The Action cell uses `wtc-td-action` to suppress its label and stretch
   forms to full width. This preserves all admin data access at 375px without information loss.

3. **Admin MobileNav: add to layout.tsx using existing component + CSS.** Zero new CSS required.
   `<MobileNav items={ADMIN_NAV} />` rendered after `<main>`. Existing `overflow-x:auto` on the
   pill bar handles the 10-item list. Identical visual treatment to the app shell.

4. **Tortila readState in admin/bots: derive from existing query fields.** No new DB column, no
   new query. Pill computed from `tortilaLastOkAt` + `tortilaLastError` + `mode`. See §14.6.

5. **No schema migration for PG8.** All required data already present. PG8 is purely a UI/CSS
   change. Confirmed by reviewing all query return types.

6. **Pill taxonomy: DESIGN_SYSTEM.md §14.3 is canonical.** All new pills must match the table.
   No improvised tones. The `neutral` tone (no modifier class) is used for informational pills
   that are neither alarming nor reassuring.

## Risks

1. **`wtc-table-wrap` CSS specificity.** The media query block uses `.wtc-table-wrap td::before`
   to inject `data-label` content. Any `<td>` without a `data-label` attribute will render an
   empty label. The implementer MUST add `data-label` to every `<td>` when wrapping. Missing
   labels produce blank prefix areas in the card view — not catastrophic but looks incomplete.

2. **Education page `<main>` nesting is a real accessibility/SEO issue.** Screen readers may
   treat the nested `<main>` as the primary landmark, missing the outer layout. This should be
   fixed in PG8 even though it does not affect visual layout — it is a conformance issue.

3. **Admin MobileNav with 10 items.** The horizontal pill bar scrolls. On small phones (360px),
   roughly 4 items are visible before scroll. Admin users are staff — this is acceptable. If the
   count grows beyond 10, the nav should switch to a grouped drawer. Not a PG8 concern.

4. **entitlements/page.tsx grant form inline styles with `minWidth`.** The `flexWrap` prevents
   viewport overflow, but the layout on mobile may look cramped. Low-risk cosmetic issue;
   addressed in Finding 11.

5. **`backendMode` vs `getServerDb()` inconsistency.** If these two signals ever diverge,
   the admin overview page will show a different mode indicator than sub-pages. Low probability
   in current code but fragile. Flag for Phase 3 cleanup.

## Verification / tests

The following should be verified after the PG8 implementation lands:

1. **Playwright mobile viewport test** at 375×812: navigate to each of the 8 admin pages and
   assert `document.querySelector('.wtc-table')?.scrollWidth <= document.documentElement.clientWidth`
   — i.e., no table overflows the viewport. Add to `tests/e2e/admin-mobile.spec.ts`.

2. **MobileNav visibility test**: at 375px, `screen.getByRole('navigation', {name:'Mobile navigation'})`
   must be visible on every admin page. Add to admin layout test.

3. **HTML validity**: `<main>` count in education page DOM must equal 1 after the fix. Can be
   asserted in Playwright as `document.querySelectorAll('main').length === 1`.

4. **State pill taxonomy**: unit test that every admin page component's status-pill labels match
   the canonical taxonomy in DESIGN_SYSTEM.md §14.3. This is a convention test, not a logic test.

5. **Tortila P0/P1 banners always render**: the `TORTILA_PERSISTENT_WARNINGS` loop in bots/page.tsx
   is already covered by Phase 2.4 tests. Re-run to confirm no regression after PG8 table changes.

## Next actions

For the PG8 frontend implementer (in priority order):

1. **`packages/ui/src/theme.css`** — Add the `wtc-table-wrap` card-stack CSS (§14.1).
   Add `min-height:44px` for `.wtc-input` and `.wtc-btn` at 640px (§14.2). This is the
   prerequisite for all table fixes.

2. **`apps/web/src/app/admin/layout.tsx`** — Add `<MobileNav items={ADMIN_NAV} />` (§14.4).

3. **`apps/web/src/app/admin/tradingview-access/page.tsx`** — Wrap both tables in
   `<div className="wtc-table-wrap">`, add `data-label` to all `<td>` elements, add
   `className="wtc-td-action"` to the Action cells (§14.2, §14.8).

4. **`apps/web/src/app/admin/education/page.tsx`** — Fix nested `<main>` → `<div className="wtc-stack">`,
   add `<div className="wtc-grid wtc-grid-4">` wrapper, add `wtc-table-wrap` to courses table.

5. **`apps/web/src/app/admin/users/page.tsx`** + **bots/page.tsx** + **system-health/page.tsx**
   + **entitlements/page.tsx** (timeline and review preview tables) — Add `wtc-table-wrap` wrappers.

6. **`apps/web/src/app/admin/bots/page.tsx`** — Add derived readState pill (§14.6).

7. **`apps/web/src/app/admin/support/page.tsx`** — Restyle filter links as filter chips (§Finding 10).

8. Write Playwright e2e test `tests/e2e/admin-mobile.spec.ts` covering scroll-width assertion at
   375px for all 8 pages.

No schema migration required. No new data loader changes required. No new packages.
