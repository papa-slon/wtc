# ecosystem-frontend-implementer handoff

## Scope

Read-only audit of all 8 admin pages in `apps/web/src/app/admin/` for Phase Group 8 (PG8).
Goals: (1) identify 375px horizontal-scroll offenders, (2) map missing/inconsistent state pills,
(3) confirm PG2 (Tortila readState) and PG5 (TV revokeReason / expiry) data is surfaced,
(4) confirm no migration is needed, (5) produce a concrete build blueprint for the implementer.

Pages audited:
- /admin (overview — `page.tsx`)
- /admin/users
- /admin/entitlements
- /admin/entitlements/review
- /admin/tradingview-access
- /admin/bots
- /admin/education
- /admin/system-health
- /admin/support

## Files inspected

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
- `packages/ui/src/theme.css`
- `packages/ui/src/components.tsx`
- `packages/ui/src/index.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/tv/queries.ts`
- `apps/web/src/components/MobileNav.tsx`
- `apps/web/src/lib/nav.ts`
- `packages/db/src/repositories.ts` (TvGrantRow, TvRequestDTO, revokeReason field)
- `packages/bot-adapters/src/types.ts` (BotHealth, ReadState)
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `apps/web/src/features/lms/queries.ts` (AdminEducation, LmsMode)
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/DESIGN_SYSTEM.md`

## Files changed

None — read-only audit.

## Findings

### Finding 1 — CRITICAL: No mobile navigation on admin console (navigation blind spot below 900px)

**Severity:** critical  
**Evidence:** `apps/web/src/app/admin/layout.tsx:17-38`

The admin shell uses `.wtc-shell` which hides `.wtc-sidenav` below 900px
(`packages/ui/src/theme.css:121`). No `<MobileNav>` is rendered in the admin layout —
`MobileNav` is used only by the `(app)` layout. The `.wtc-mobile-nav` CSS exists in
`apps/web/src/app/globals.css:9-18` but nothing renders it in admin. Below 900px the admin
console has zero navigation — the user is stranded on whichever page they loaded and cannot
reach any other admin page.

**Recommendation:** Add `<MobileNav items={ADMIN_NAV} />` to `apps/web/src/app/admin/layout.tsx`
(after `<main>`, before closing outer div). This is the single-writer spine file for admin layout.
The `.wtc-mobile-nav` CSS is already present; no CSS change required.

**Target:** `apps/web/src/app/admin/layout.tsx`

---

### Finding 2 — HIGH: 10-column TradingView queue table causes severe horizontal overflow at 375px

**Severity:** high  
**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx:57-159`

The request queue table has 10 columns: User, TV username, Status, Submitted, Granted, Granted by,
Expires, Revoked, Revoked by, Action. The Action column contains inline `<form>` elements with
CSRF fields, reason inputs, duration selects, and submit buttons. There is no `overflow-x`
wrapper, no `data-label` mobile stacking, and no column-priority system. At 375px, this table
overflows the viewport by approximately 4x.

The grant history table (6 columns: TV username, Granted at, Expires, Granted by type, Revoked at,
Revoke reason) also overflows.

The `.wtc-table` class in `packages/ui/src/theme.css:104-108` defines `width: 100%` with no
overflow-x wrapper, no responsive stacking, and no `@media` query.

**Recommendation:** Introduce a CSS-only `.wtc-table-responsive` wrapper class in
`packages/ui/src/theme.css` that applies `overflow-x: auto; -webkit-overflow-scrolling: touch`
at breakpoints below 900px, OR introduce a card-stack pattern using `data-label` attribute on
`<td>` elements activated below 640px. The card-stack approach is preferred for admin (it
preserves inline form semantics in the Action column without restructuring the HTML).

Concrete implementation for TV page:
- Wrap each `<table>` in a `<div className="wtc-table-wrap">` element.
- Define `.wtc-table-wrap` at `<640px` to hide `<thead>`, make `<tr>` a flex column with border,
  make `<td>` display block with `::before { content: attr(data-label) }` prefix.
- Add `data-label="User"`, `data-label="Action"` etc. to every `<td>` in the TV table.
- The inline grant/revoke `<form>` + `<CsrfField>` semantics are PRESERVED in the card-stack
  pattern — the form becomes a full-width block inside the row card. No semantic changes needed.

This avoids adding a React component (lower risk). The `data-label` convention is CSS-only.

**Target:** `packages/ui/src/theme.css` (shared `.wtc-table-wrap` class), then `apps/web/src/app/admin/tradingview-access/page.tsx`

---

### Finding 3 — HIGH: 7-column and 4-column tables in entitlements/bots/system-health overflow at 375px

**Severity:** high  
**Evidence:**
- `apps/web/src/app/admin/entitlements/page.tsx:267-298` — 7-column product-access timeline table (Date, Product, From, To, Reason, Actor, Actor type)
- `apps/web/src/app/admin/entitlements/page.tsx:91-127` — 6-column billing review summary table (Provider, Event type, Reason, Created, User ID, [Review link])
- `apps/web/src/app/admin/bots/page.tsx:205-233` — 4-column bot health checks table (Target, Status, Checked at, Detail)
- `apps/web/src/app/admin/system-health/page.tsx:143-182` — 4-column integration health checks table (Target, Status, Checked at, Detail)

All use `.wtc-table` directly without any overflow wrapper or responsive stacking.

**Recommendation:** Apply the same `.wtc-table-wrap` + `data-label` pattern from Finding 2 to all
tables above. Since `.wtc-table-wrap` is defined once in `packages/ui/src/theme.css`, the fix
to each individual page is mechanical (wrap + add data-label attributes). Each page file is a
disjoint single-writer edit.

**Target:** `packages/ui/src/theme.css` (once), then each page file independently.

---

### Finding 4 — HIGH: Admin education page uses incorrect RBAC pattern

**Severity:** high  
**Evidence:** `apps/web/src/app/admin/education/page.tsx:2-12`

```typescript
const user = await getCurrentUser();
if (!user) redirect('/login');
if (!user.roles.includes('admin')) redirect('/app');
```

This uses `getCurrentUser()` + manual `roles.includes('admin')` role-label check, which violates
the hard rule "entitlements are the only access source of truth; UI/API never infer access from
role labels." All other admin pages (users, entitlements, review, tradingview-access, bots,
system-health, support) use the canonical `requireUser() + assertAdmin(actor.roles)` pattern
from `@wtc/auth`. The `assertAdmin` function centralises the role check in the auth package;
direct `.roles.includes()` comparisons in React files bypass that centralisation.

Additionally, the education page wraps content in `<main className="wtc-container">` instead of
`<div className="wtc-stack">`, which is inconsistent with every other admin page and will break
the visual rhythm.

**Recommendation:**
1. Replace `getCurrentUser() + manual role check` with `requireUser() + assertAdmin(actor.roles)`
   imported from `@wtc/auth` (matches pattern in all other 6 admin pages).
2. Replace `<main className="wtc-container" style={{ padding: '34px 22px' }}>` with
   `<div className="wtc-stack">` to match all other admin pages.

**Target:** `apps/web/src/app/admin/education/page.tsx`

---

### Finding 5 — HIGH: Tortila readState (PG2) not surfaced in admin bots page

**Severity:** high  
**Evidence:**
- `packages/bot-adapters/src/types.ts:33-53` — `ReadState = 'ok' | 'not_configured' | 'unreachable' | 'malformed' | 'stale'` is defined on `BotHealth.readState`.
- `apps/web/src/features/admin/types.ts:109-131` — `AdminBotHealthResult` has `adapterMode`, `tortilaLastOkAt`, `tortilaLastError`, `tortilaBaseUrlConfigured` but NO `tortilaReadState: ReadState` field.
- `apps/web/src/features/admin/queries.ts:202-290` — `loadAdminBotHealth()` queries `integration_health_checks` but does NOT call `getBotAdapter().getHealth()` and therefore never retrieves or exposes `readState`.
- `apps/web/src/app/admin/bots/page.tsx:44-53` — The status badges row shows `adapterMode` but no pill for the actual `readState` (not_configured / unreachable / malformed / stale / ok).

The design brief states: "Consume the real PG2 (Tortila bot readState) + PG5 (TradingView revokeReason / expiry) state that already landed in prior phases — surface it honestly in the admin UI." The PG2 readState is available via `getBotAdapter().getHealth()` but the admin page only reflects a coarser `adapterMode` string.

Note: the existing `tortilaLastOkAt` / `tortilaLastError` from `integration_health_checks` is a
*persisted* health record from the worker tick. The real-time `readState` from the adapter is a
*live* per-request call. Both are needed and serve different purposes: the persisted record shows
historical trend; the live readState shows current state.

**Recommendation:**
1. Add `tortilaReadState: ReadState | null` to `AdminBotHealthResult` in
   `apps/web/src/features/admin/types.ts`.
2. In `loadAdminBotHealth()` in `apps/web/src/features/admin/queries.ts`, call
   `getBotAdapter('tortila_bot', { mode: botAdapterMode(), tortilaBaseUrl: ..., tortilaReadToken: ... }).getHealth()`
   and extract `health.readState` into the result (already never-throws per PG2 contract).
3. In `apps/web/src/app/admin/bots/page.tsx`, add a `StatusPill` for `tortilaReadState` alongside
   the existing `adapterMode` pill, using tone mapping:
   `ok → 'ok'`, `stale → 'warn'`, `not_configured → 'neutral'`,
   `unreachable/malformed → 'bad'`, `null → 'neutral'`.

**Target:** `apps/web/src/features/admin/types.ts`, `apps/web/src/features/admin/queries.ts`, `apps/web/src/app/admin/bots/page.tsx`

---

### Finding 6 — MEDIUM: PG5 TV revokeReason is present in grant history but expiry/expiring_soon state is not explicitly called out in the request queue pill

**Severity:** medium  
**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx:9-11,77`

PG5 data is largely correctly surfaced:
- `revokeReason` is shown in the grant history table (line 191: `{g.revokeReason ?? '—'}`).
- `expiresAt` is shown in the request queue table (line 82: `{fmtDate(r.expiresAt ?? null)}`).
- The `expiring_soon` status is handled: `tone()` maps it to `'warn'` (line 10) and `canGrant()`
  includes it (line 19).

The gap: the `expiring_soon` status pill text is `r.status.replace('_', ' ')` → "expiring soon".
That is correct display text. However, the admin console has no explicit visual call-out (e.g., a
banner or warning icon) for rows whose grant is expiring soon — they appear as a warn-tone pill but
blend with other warn-tone rows (like "pending"). The design system specifies that expiring grants
warrant a `<14-day banner` (per PG7 memory note). The banner was added in the user-facing
`/app/indicators` surface (per PG7 handoff), but the admin queue has no corresponding visual
emphasis to distinguish "expiring soon" rows that need admin attention.

**Recommendation:** In the TV admin request queue, add a `RiskWarningBanner` (severity="warning")
above the table when `counts.active > 0 && rows.some(r => r.status === 'expiring_soon')`, with
message "N grant(s) expiring within 7 days — review and renew or let the worker auto-revoke at
expiry." This uses existing data (no new query needed). Keep the existing pill; the banner is
additive.

**Target:** `apps/web/src/app/admin/tradingview-access/page.tsx`

---

### Finding 7 — MEDIUM: Admin overview page (/admin) uses `listUsers` + `tvService.listAll()` from `@/lib/backend` instead of feature-layer loaders, has no storage mode pill

**Severity:** medium  
**Evidence:** `apps/web/src/app/admin/page.tsx:3-10`

The admin overview page imports `listUsers`, `tvService`, `recentAuditEvents`, `backendMode`
directly from `@/lib/backend` — this bypasses the features-layer (`features/admin/queries.ts`)
where business logic is supposed to live. The design system rule states "no business logic in
React page files — logic belongs in packages/* or features/*."

The page does show a `backendMode` text inline (`Postgres` or `In-memory (dev)`) but does NOT use
a `<StatusPill>` component — it uses raw `className="wtc-up"/"wtc-down"` text. This is
inconsistent with every other admin page which uses `<StatusPill tone="ok">storage:
Postgres</StatusPill>`.

**Recommendation:**
1. Add a `loadAdminOverview()` loader in `features/admin/queries.ts` that returns
   `{ mode, userCount, pendingTv, auditCount }` using the same getServerDb() pattern.
2. Update `apps/web/src/app/admin/page.tsx` to call `loadAdminOverview()` and render a
   `<StatusPill tone="ok">storage: Postgres</StatusPill>` pill consistent with all other pages.

**Target:** `apps/web/src/features/admin/queries.ts` (additive), `apps/web/src/app/admin/page.tsx`

---

### Finding 8 — MEDIUM: Education admin page missing storage mode pill for MetricCards section and uses `<main>` layout wrapper

**Severity:** medium  
**Evidence:** `apps/web/src/app/admin/education/page.tsx:17-79`

The storage pill IS present (line 22) but appears AFTER the `<SectionHeader>` with no `<div
className="wtc-stack">` wrapper around the overall page, so the spacing and pill placement differ
from all other admin pages. More critically, the MetricCard grid (`wtc-grid-4`) and both Card
sections are rendered inside `<main className="wtc-container">` directly, without the
`<div className="wtc-stack">` that all other pages use as their root element. This means the
`gap: 14px` spacing between sections is absent; all sections collapse together.

**Recommendation:** Wrap page content in `<div className="wtc-stack">` matching all other pages
(part of Finding 4 RBAC fix — can be done in the same edit pass).

**Target:** `apps/web/src/app/admin/education/page.tsx`

---

### Finding 9 — MEDIUM: Support page uses `wtc-btn-secondary` raw class instead of `buttonClasses('secondary')`

**Severity:** medium  
**Evidence:** `apps/web/src/app/admin/support/page.tsx:183`

Line 183: `className="wtc-btn wtc-btn-secondary"` is the only callsite in the admin pages that
uses raw CSS class strings instead of the `buttonClasses()` helper imported from `@wtc/ui`. This
is a minor consistency violation but means future button variant changes in the design system will
not apply to this button.

**Recommendation:** Change to `className={buttonClasses('secondary')}`.

**Target:** `apps/web/src/app/admin/support/page.tsx`

---

### Finding 10 — LOW: `eventSnapshot` in entitlements/review page renders via `JSON.stringify` with `overflowX: auto` — potential PII leak vector if eventSnapshot ever contains non-safe fields

**Severity:** low  
**Evidence:** `apps/web/src/app/admin/entitlements/review/page.tsx:97-113`

The `<pre>` block renders `JSON.stringify(item.eventSnapshot, null, 2)` in the admin UI. The
comments state "non-secret fields only" and the loader comment says "Only non-secret event fields
are written to eventSnapshot at creation time." The `ManualReviewItemView.eventSnapshot` type is
`Record<string, unknown>`. The safety guarantee depends entirely on the webhook handler correctly
limiting what is stored in eventSnapshot. This is a latent risk if the webhook handler is ever
updated without reviewing what fields it stores.

**Recommendation:** No immediate change to the render. The risk is upstream in the webhook
handler. Add a comment at this callsite referencing the security constraint: "eventSnapshot
contains only the safe fields written by the billing webhook handler. See
features/billing/webhook.ts for the eventSnapshot construction — raw Stripe body and signature
are never stored." This creates a discoverable breadcrumb for future maintainers.

**Target:** `apps/web/src/app/admin/entitlements/review/page.tsx`

---

### Finding 11 — INFO: All 8 admin pages already have a consistent `storage: Postgres / in-memory (demo)` pill pattern except admin/overview and admin/education (captured above)

**Severity:** info  
**Evidence:** All 8 pages inspected.

Pages with pill: users, entitlements, entitlements/review, tradingview-access, bots (also has
adapter/live-control/legacy pills), system-health, support.
Pages missing consistent pill: admin/page.tsx (uses raw text), admin/education (pill present but
outside wtc-stack, wrong container).

---

### Finding 12 — INFO: Migration not required — all data fields for PG8 UI already exist

**Severity:** info  
**Evidence:** See analysis in Decisions section.

No DB schema change is needed. Every field the admin UI needs to display is already accessible:
- `readState` is live from `getBotAdapter().getHealth()` (no DB needed)
- `revokeReason` is `tradingview_access_grants.revoke_reason` (schema since migration 0002)
- `expiresAt` and `expiring_soon` status are on `tradingview_access_requests` (since 0002)
- `mode: 'postgres' | 'demo'` is returned by every existing loader

## Decisions

**D1 — CSS-only responsive solution with `.wtc-table-wrap` + `data-label` convention.**

The lowest-risk path for "no 375px horizontal scroll" is a CSS-only solution using a new
`.wtc-table-wrap` class in `packages/ui/src/theme.css`. At `max-width: 640px`:
- `.wtc-table-wrap table thead` → `display: none`
- `.wtc-table-wrap table tr` → `display: block; margin-bottom: 12px; border: 1px solid var(--stroke); border-radius: var(--radius)`
- `.wtc-table-wrap table td` → `display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid rgba(148,163,184,.08); gap: 8px`
- `.wtc-table-wrap table td::before` → `content: attr(data-label); color: var(--dim); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; white-space: nowrap`

This preserves inline `<form>` + `<CsrfField>` semantics — the form becomes a full-width block
inside the row card. No React component change needed. No business logic introduced in pages.

Above 640px (tablet/desktop), `.wtc-table-wrap` adds `overflow-x: auto` as a safety net so
intermediate widths (640px-900px) don't overflow. The `data-label` attributes on `<td>` are
purely cosmetic and have no functional effect above 640px.

**D2 — Single-writer sequencing for shared files.**

The files that touch multiple pages must be written by a single agent pass to avoid conflicts:
- `packages/ui/src/theme.css` — MUST be written first (`.wtc-table-wrap` class). All page
  edits depend on this class existing.
- `apps/web/src/app/admin/layout.tsx` — MUST be written before testing mobile nav.
- `apps/web/src/features/admin/types.ts` — extends `AdminBotHealthResult` with `tortilaReadState`.
- `apps/web/src/features/admin/queries.ts` — calls `getBotAdapter().getHealth()`, adds `loadAdminOverview()`.

After those 4 spine edits, all 8 page files are disjoint and can be edited in parallel.

**D3 — No new shared React component required for PG8.**

A new `<ResponsiveTable>` component in `packages/ui` was considered but rejected for PG8 scope.
The CSS-only `.wtc-table-wrap` + `data-label` convention achieves the same result with lower risk
(no new component API, no TS changes to packages/ui/src/index.ts, no downstream consumer
changes). The `DataTable` component from the design system spec remains a Phase 3 target.

**D4 — No migration needed.**

All data fields are already in schema (migration 0002 for TV, migration 0003 for bot snapshots).
The only new data surface (readState) is live from the adapter, not stored.

## Risks

**R1 — `getBotAdapter().getHealth()` in `loadAdminBotHealth()` makes an outbound network call.**
The admin bots page would make a live HTTP call to the Tortila journal on every page load. If
the journal is slow or unreachable, the admin page will block for the adapter timeout
(presumably 5-10s). Mitigate: wrap the `getHealth()` call in a `Promise.race` with a 3s timeout
fallback (return `null` readState on timeout) or read only from `integration_health_checks`
without a live call. Since readState is the point of PG2, using the live call is correct — but the
timeout guard is mandatory.

**R2 — The `data-label` pattern on the 10-column TV table requires updating 10 `<td>` cells per
row.** If new columns are added later, `data-label` must be added manually. This is a maintenance
overhead but acceptable for MVP.

**R3 — The admin/layout.tsx MobileNav fix (Finding 1) adds navigation items that link to admin
pages. If a non-admin somehow reaches /admin on mobile before the layout RBAC check completes,
they would see nav links. This is not a real risk because the layout RBAC check runs on the
server before any HTML renders (redirect('/login') or redirect('/app') fires first).

**R4 — `eventSnapshot` PII latent risk (Finding 10).** Upstream risk in webhook handler, not
renderable here. Documented for future maintainers.

## Verification/tests

**Manual verification checklist (no new tests required in PG8 — existing gate must stay green):**

1. At 375px viewport width, navigate to each of the 8 admin pages. Confirm zero horizontal
   scrollbar on the `<html>` element (use browser devtools responsive mode).
2. Confirm that the TV request queue table card-stacks at 375px, with each `<td>` showing its
   label prefix and the inline grant/revoke forms rendering as full-width blocks.
3. Confirm admin/overview at <900px shows the mobile nav bar with ADMIN_NAV items.
4. Confirm admin/bots page shows a `readState` pill (e.g. "adapter read: not configured") in
   demo/no-token mode.
5. Confirm admin/education uses `requireUser() + assertAdmin()` (verify no `roles.includes`).
6. Run existing Vitest gate (`npm test` / vitest run) — must stay green (406+ passing, cov ≥
   27.12/74.32). PG8 adds no new test files, but no existing test must regress.
7. Run existing e2e gate (`playwright test`) — must stay 36/36. The mobile-nav fix and
   table-responsive fix are visual-only; no existing page routes change.

## Next actions

**Ordered implementation plan (single implementer, sequential for spine files):**

**Step 1 — Spine: `packages/ui/src/theme.css`**
Add `.wtc-table-wrap` responsive table class (D1). This is the shared CSS dependency for all table
fixes. Implement before any page edits.

**Step 2 — Spine: `apps/web/src/app/admin/layout.tsx`**
Add `<MobileNav items={ADMIN_NAV} />` import and render (Finding 1). Import `MobileNav` from
`@/components/MobileNav`, import `ADMIN_NAV` from `@/lib/nav` (already used in the file).

**Step 3 — Spine: `apps/web/src/features/admin/types.ts`**
Add `tortilaReadState: ReadState | null` to `AdminBotHealthResult`.
Import `ReadState` from `@wtc/bot-adapters`.

**Step 4 — Spine: `apps/web/src/features/admin/queries.ts`**
(a) Add `loadAdminOverview()` loader returning `{ mode, userCount, pendingTv, auditCount }`.
(b) Update `loadAdminBotHealth()` to call `getBotAdapter().getHealth()` with a 3s timeout guard,
    extract `health.readState`, add to returned object.

**Step 5 — Disjoint page edits (can be done in any order after Steps 1-4):**

| Page file | Changes |
|-----------|---------|
| `apps/web/src/app/admin/page.tsx` | Use `loadAdminOverview()`; add `<StatusPill>` for mode (F7) |
| `apps/web/src/app/admin/users/page.tsx` | Wrap table in `.wtc-table-wrap`; add `data-label` to 4 `<td>` cells (F3) |
| `apps/web/src/app/admin/entitlements/page.tsx` | Wrap 7-col timeline + 6-col review summary tables in `.wtc-table-wrap`; add `data-label` (F3) |
| `apps/web/src/app/admin/entitlements/review/page.tsx` | Add eventSnapshot PII comment (F10); no table fix needed (table is narrow) |
| `apps/web/src/app/admin/tradingview-access/page.tsx` | Wrap 10-col and 6-col tables in `.wtc-table-wrap`; add all `data-label` attrs; add expiring_soon `<RiskWarningBanner>` (F2, F6) |
| `apps/web/src/app/admin/bots/page.tsx` | Add `tortilaReadState` pill to status badges row (F5); wrap 4-col health checks table (F3) |
| `apps/web/src/app/admin/education/page.tsx` | Fix RBAC to `requireUser()+assertAdmin()`, change root to `<div className="wtc-stack">` (F4, F8) |
| `apps/web/src/app/admin/system-health/page.tsx` | Wrap 4-col integration health checks table in `.wtc-table-wrap`; add `data-label` (F3) |
| `apps/web/src/app/admin/support/page.tsx` | Change raw class string to `buttonClasses('secondary')` (F9) |

**Per-page state coverage after PG8:**

| Page | Storage pill | Empty | Demo | Blocked | readState/Tortila | revokeReason/TV | Mobile nav | Table reflow |
|------|-------------|-------|------|---------|------------------|-----------------|-----------|--------------|
| /admin (overview) | After fix | — | — | — | — | — | After fix | — |
| /admin/users | Already | Already | Already | — | — | — | After fix | After fix |
| /admin/entitlements | Already | Already | Already | — | — | — | After fix | After fix |
| /admin/entitlements/review | Already | Already | Already | — | — | — | After fix | — |
| /admin/tradingview-access | Already | Already | Already | — | — | Already+banner | After fix | After fix |
| /admin/bots | Already | Already | Already | Already | After fix | — | After fix | After fix |
| /admin/education | Already | Already | Already | — | — | — | After fix | — |
| /admin/system-health | Already | Already | Already | — | — | — | After fix | After fix |
| /admin/support | Already | Already | Already | — | — | — | After fix | — |
