# ecosystem-security-auditor handoff

## Scope

PG8 pre-implementation security audit of the admin console change surface. Read-only review of
all 8 admin pages plus supporting files: layout, data loaders, actions, CSRF, UI components, and
nav. Focused on: PII/secret leak through responsive refactoring, revokeReason admin-only gate,
RBAC consistency across all admin routes, CSRF preservation in card-reflowed forms, honest-pill
integrity, and no new client-side data exposure.

## Files inspected

- apps/web/src/app/admin/layout.tsx
- apps/web/src/app/admin/page.tsx
- apps/web/src/app/admin/users/page.tsx
- apps/web/src/app/admin/entitlements/page.tsx
- apps/web/src/app/admin/entitlements/review/page.tsx
- apps/web/src/app/admin/tradingview-access/page.tsx
- apps/web/src/app/admin/bots/page.tsx
- apps/web/src/app/admin/education/page.tsx
- apps/web/src/app/admin/system-health/page.tsx
- apps/web/src/app/admin/support/page.tsx
- apps/web/src/features/admin/queries.ts
- apps/web/src/features/admin/types.ts
- apps/web/src/features/admin/actions.ts
- apps/web/src/features/admin/schemas.ts
- apps/web/src/features/tv/queries.ts
- apps/web/src/features/tv/actions.ts
- apps/web/src/features/billing/timeline.ts
- apps/web/src/features/lms/queries.ts
- apps/web/src/lib/backend.ts
- apps/web/src/lib/session.ts
- apps/web/src/lib/csrf.tsx
- apps/web/src/app/api/billing/webhook/route.ts
- apps/web/src/components/MobileNav.tsx
- apps/web/src/lib/nav.ts
- apps/web/src/app/(app)/app/layout.tsx
- apps/web/src/app/layout.tsx
- packages/ui/src/theme.css
- packages/ui/src/components.tsx
- packages/ui/src/index.ts
- apps/web/src/app/globals.css

## Files changed

None — read-only audit.

## Findings

### F-01 [medium] Admin overview page has no per-page RBAC check — relies solely on layout gate

**Evidence:** apps/web/src/app/admin/page.tsx lines 1–26. No `requireUser()` or `assertAdmin()` call. The file uses `getCurrentUser()` → `isAdmin()` only in the layout; the page itself calls `listUsers()`, `tvService.listAll()`, and `recentAuditEvents()` without any direct guard.

**Detail:** The Next.js App Router layout at apps/web/src/app/admin/layout.tsx:11–14 does enforce `getCurrentUser` + `isAdmin` + `redirect('/app')`. This is the actual runtime gate. However, the page diverges from the consistent pattern used by all other 7 admin pages (`requireUser` + `assertAdmin`). If the layout guard is bypassed (e.g., direct server-component invocation in a future test, RSC streaming, or a misconfigured middleware exclusion), the page would serve user counts, pending TV request counts, and audit event counts to an unauthenticated caller.

**Recommendation:** Add `const actor = await requireUser(); assertAdmin(actor.roles);` at the top of AdminOverview, matching every other admin page. This costs nothing at runtime and closes the defence-in-depth gap.

**Target:** apps/web/src/app/admin/page.tsx (PG8 implementation)

---

### F-02 [medium] Education admin page uses a weaker RBAC pattern than all other admin pages

**Evidence:** apps/web/src/app/admin/education/page.tsx lines 9–11. Uses `getCurrentUser()` + `user.roles.includes('admin')` with a manual redirect, instead of `requireUser()` + `assertAdmin(roles)` which is the canonical pattern on all 7 other admin pages.

**Detail:** The functional result is equivalent at runtime. The risk is consistency: `assertAdmin` from `@wtc/auth` is the single-source RBAC check that can be audited, tested independently, and updated in one place. A manual `roles.includes('admin')` check duplicates logic and creates divergence if role names change or the assertAdmin function gains additional validation (rate-limit bypass detection, suspended-account check, etc.). Additionally, the education page does not call `requireUser()` — it uses `getCurrentUser()` which returns null rather than throwing on unauthenticated requests. If the redirect is somehow bypassed (e.g., inside an error boundary or an RSC context where redirect is suppressed), data from `loadAdminEducation()` would be returned.

**Recommendation:** Replace with `const actor = await requireUser(); assertAdmin(actor.roles);`. Remove `redirect('login')` and `redirect('/app')` — `requireUser` throws `UNAUTHENTICATED` and `assertAdmin` throws on role mismatch, both of which Next.js handles correctly.

**Target:** apps/web/src/app/admin/education/page.tsx (PG8 implementation)

---

### F-03 [medium] Education admin page wraps content in `<main className="wtc-container">` instead of layout's `<div className="wtc-stack">` — structural inconsistency with security implications

**Evidence:** apps/web/src/app/admin/education/page.tsx line 18. Uses `<main className="wtc-container" style={{ padding: '34px 22px' }}>`. Every other admin page returns `<div className="wtc-stack">` and relies on the layout's `<main className="wtc-main">` wrapper for padding and content sizing.

**Detail:** The layout already wraps children in `<main className="wtc-main">`. The education page nests a second `<main>` inside, producing invalid HTML (nested `<main>` elements). The `wtc-container` class sets `max-width: var(--max); margin: 0 auto; padding: 0 22px` — this is the public-facing container, not the admin shell container. On a responsive refactor (PG8), the implementer must recognize that this page has a unique layout wrapper that will interact differently with any table-overflow fix applied uniformly across the admin pages.

**Recommendation:** Replace `<main className="wtc-container" style={{ padding: '34px 22px' }}>...</main>` with `<div className="wtc-stack">...</div>`. The layout already provides the `<main>` wrapper. This also ensures the table-overflow fix applied to all other pages works uniformly here.

**Target:** apps/web/src/app/admin/education/page.tsx (PG8 implementation)

---

### F-04 [medium] `.wtc-table` has no overflow-x wrapper — 10-column TV table and 7-column timeline table overflow at 375px with no scroll affordance

**Evidence:** packages/ui/src/theme.css line 104: `.wtc-table { width: 100%; border-collapse: collapse; }` — no `overflow-x: auto` wrapper defined anywhere in theme.css or globals.css.

Affected tables by column count:
- apps/web/src/app/admin/tradingview-access/page.tsx lines 56–159: 10-column request queue table + 6-column grant history table. The Action column contains full inline form controls (CsrfField, input, select, two submit buttons).
- apps/web/src/app/admin/entitlements/page.tsx lines 267–299: 7-column product-access timeline table (inside a `<details>` element per user card).
- apps/web/src/app/admin/system-health/page.tsx lines 154–183: 4-column integration health checks table.
- apps/web/src/app/admin/bots/page.tsx lines 205–232: 4-column bot health checks table.
- apps/web/src/app/admin/users/page.tsx lines 62–93: 4-column user table.

**Security dimension:** When a wide table overflows without a scrollable container, the browser may clip or hide columns. On the 10-column TV table, the "Action" column (which contains the grant/revoke forms including CsrfField) is the rightmost column. If it is clipped on mobile, an admin performing triage on a mobile device cannot see the CSRF-protected action forms — they may attempt workarounds (disabling viewport restrictions, using the desktop site) that reduce security. The CSRF token is not lost from the DOM, but the UX failure creates a risk vector.

**Recommendation for PG8:** Wrap each `.wtc-table` in `<div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>` at the call site, OR add a `.wtc-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }` class to theme.css and apply it as a wrapper `<div className="wtc-table-wrap">`. The 10-column TV table is the highest priority. For the Action column specifically, consider converting the row to a card layout at mobile breakpoints rather than just making it scrollable.

**Target:** packages/ui/src/theme.css (add wrapper class) + all 5 affected page files (PG8 implementation)

---

### F-05 [low] Admin overview page (/admin) has no storage-mode pill — inconsistent with all 7 other admin pages

**Evidence:** apps/web/src/app/admin/page.tsx lines 1–26. Uses `backendMode` (string 'postgres' | 'memory') to conditionally style a text label inside a Card, but does NOT render a `<StatusPill>` as the authoritative storage-mode indicator. In demo mode the text reads "In-memory (dev)" styled with `wtc-down` color, which is not the canonical `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>` pattern.

**Detail:** Every other admin page shows the canonical storage-mode pill as the first element below the SectionHeader. The overview page is typically the first page an admin loads. If it shows a non-standard demo indicator, the admin may not notice the demo state and interpret the summary counts (users, pending TV requests, audit events) as reflecting real data.

**Recommendation:** Add the canonical storage-mode pill row beneath the SectionHeader, consistent with other admin pages. Also note `backendMode` is `'postgres' | 'memory'` (not `'postgres' | 'demo'`), whereas other pages use `mode === 'postgres'`. The overview page must use `backendMode !== 'postgres'` to detect non-postgres state.

**Target:** apps/web/src/app/admin/page.tsx (PG8 implementation)

---

### F-06 [low] revokeReason is correctly admin-only — no user-surface exposure confirmed; responsive refactor must preserve this

**Evidence:** apps/web/src/app/admin/tradingview-access/page.tsx lines 190–191 (grant-history table). Comment explicitly states: `{/* Admin-only: revoke reason (incl. 'expired_by_worker' for auto-expiry). Never shown to users. */}`. The `revokeReason` field is only present in `TvGrantRow` returned by `loadTvAdminData()` in apps/web/src/features/tv/queries.ts lines 67–97. The user-facing `loadTvUserData()` at lines 36–46 also returns `grants: TvGrantRow[]` via `listTvGrantsForUser`.

**Risk to investigate for PG8 implementation:** `TvGrantRow` includes `revokeReason` and is returned to the user-facing TV page (`/app/indicators`). If the PG8 responsive refactor of the TV page for users renders grant history rows (TvGrantRow), it MUST NOT render `revokeReason`. The current `/app/indicators` page should be reviewed to confirm it does not render this field. The admin TV page already has the correct comment and admin gate; the guard is at the admin-only route level, not at the DTO level.

**Recommendation:** For PG8, when reflowing the TV admin table to cards, preserve the admin-only block on revokeReason. Additionally, audit `/app/indicators` page to confirm `revokeReason` is not rendered there (outside this review's scope but flagged for the responsive-implementer).

**Target:** apps/web/src/app/admin/tradingview-access/page.tsx (preserve during PG8 card reflow)

---

### F-07 [low] Support ticket body is rendered unescaped via `{ticket.body}` with `whiteSpace: pre-wrap` — appropriate for admin view but must not leak to user-facing surfaces

**Evidence:** apps/web/src/app/admin/support/page.tsx lines 143–149. The ticket body is rendered with `whiteSpace: pre-wrap; overflow: hidden; maxHeight: 120`. This is a React JSX text node so HTML injection is not possible (React escapes by default). The userId field is truncated to 18 chars (line 153). No email addresses are shown (correct — ticket only exposes userId, not email).

**Assessment:** The rendering is correct for an admin-only page. The ticket body is user-controlled text; in a card-based mobile refactor, the `maxHeight: 120; overflow: hidden` truncation should be preserved to prevent very long ticket bodies from dominating the mobile card layout.

**Recommendation:** Preserve the `maxHeight: 120; overflow: hidden` truncation when reflowing to mobile cards. Optionally add a "Show more" expand pattern for long bodies. Confirm the support page is not accessible without assertAdmin (it is — lines 44–45 are correct).

**Target:** apps/web/src/app/admin/support/page.tsx (preserve overflow truncation during PG8)

---

### F-08 [low] eventSnapshot rendered via JSON.stringify without field-level filtering — relies on creation-time guarantee

**Evidence:** apps/web/src/app/admin/entitlements/review/page.tsx lines 96–113. The `eventSnapshot` field is rendered as `JSON.stringify(item.eventSnapshot, null, 2)` inside a collapsible `<details>` block. The comment on line 20–22 states "eventSnapshot is shown only for non-secret, non-PII fields (id, type, planCode)". This guarantee is enforced at creation time in apps/web/src/app/api/billing/webhook/route.ts line 151 where the snapshot is explicitly `{ id: event.id, type: event.type, planCode: event.planCode ?? null }`.

**Risk:** There is no render-time filter on `eventSnapshot`. If a future code path creates a manual_review item with a richer snapshot (e.g., including a userId, email, or other PII in the object), the review page would render it verbatim. The safety is entirely creation-time, not render-time.

**Recommendation:** The current implementation is safe because the only creation path (webhook route line 151) is narrow and explicit. For defence in depth, the render-time code should apply a whitelist: `JSON.stringify(pick(item.eventSnapshot, ['id', 'type', 'planCode']), null, 2)` where `pick` selects only known-safe keys. This ensures the page is safe even if a second creation path is added in the future without a security review.

**Target:** apps/web/src/app/admin/entitlements/review/page.tsx + apps/web/src/features/admin/types.ts (add render-time field whitelist — low priority)

---

### F-09 [info] MobileNav uses APP_NAV only — admin links are NOT in the mobile nav; confirmed correct

**Evidence:** apps/web/src/app/(app)/app/layout.tsx line 42: `<MobileNav items={APP_NAV} />`. The `ADMIN_NAV` import is not present in this layout. apps/web/src/lib/nav.ts lines 8–18 shows APP_NAV contains only `/app/*` routes with no admin paths. The admin layout (apps/web/src/app/admin/layout.tsx) does NOT render `<MobileNav>`.

**Assessment:** Admin links in the app sidenav (lines 24–25 of app layout) are gated by `user.roles.includes('admin')` on the server side. This is correct. The "Admin console" link in the app sidenav is shown server-side only for admin users — it will not appear in the mobile nav or in the HTML for non-admin users.

**Finding:** No mobile nav security issue. The admin console has no mobile nav at all — the sidenav disappears below 900px (theme.css line 121) and no replacement is rendered. PG8 must add mobile navigation to the admin layout.

**Recommendation:** When PG8 adds a mobile nav to the admin layout, it MUST render `<MobileNav items={ADMIN_NAV} />` INSIDE the admin layout (after the assertAdmin gate), never in the root or app layout. The admin layout gate at lines 12–14 already ensures only admins reach this layout.

**Target:** apps/web/src/app/admin/layout.tsx (PG8 — add MobileNav inside the post-gate render tree)

---

### F-10 [info] CSRF field preservation in TV grant/revoke forms — confirmed safe for card reflow

**Evidence:** apps/web/src/app/admin/tradingview-access/page.tsx lines 89–121 (grant form) and lines 126–147 (revoke form). Each form has `<CsrfField />` as its first child. The CsrfField component (apps/web/src/lib/csrf.tsx lines 25–28) renders a single `<input type="hidden" name="csrf" value={token} />`. The CSRF token is per-session and bound to the session cookie.

**Assessment for PG8:** When the TV table rows are reflowed into cards, the entire `<form>` block for each row must move together as a unit. The `<CsrfField />` must remain the first child of each `<form>`. The hidden `requestId`, `targetUserId`, and `tvUsername` inputs must also move with the form. Split/duplicate forms or moving inputs outside the form element would break the CSRF check in `assertCsrf`.

**Recommendation:** The PG8 implementer must reflow the `<form>` elements (not just the visible fields) into cards. Do not split the form between the card header (visible fields) and a footer (hidden inputs + CsrfField). Keep all form elements together as they currently appear.

**Target:** apps/web/src/app/admin/tradingview-access/page.tsx (PG8 — card reflow must preserve form integrity)

---

### F-11 [info] No migration required — confirmed from security lens

**Evidence:** The PG8 scope (mobile-readable cards, consistent pills, surfacing existing PG2/PG5 state) is entirely UI presentation. The data layer (queries.ts, types.ts, tv/queries.ts) already returns all required fields including botHealth readState, tortilaLastError, revokeReason, expiresAt. No new columns, tables, or query patterns are required.

**Assessment:** No DB schema change is needed for PG8. migrationNeeded = false.

---

## Decisions

1. The admin layout RBAC gate (layout.tsx lines 12–14) is the effective runtime guard for all admin routes. Per-page `requireUser` + `assertAdmin` calls are defence-in-depth. PG8 must add the defence-in-depth check to admin/page.tsx and fix education/page.tsx.
2. eventSnapshot safety relies on creation-time narrowness (only 3 fields). This is acceptable but should be supplemented with render-time filtering in a future phase.
3. revokeReason is admin-only by route isolation (all TV admin data only accessible via loadTvAdminData which is only called from the admin TV page). The DTO includes it but user-facing pages must not render it.
4. The `backendMode` variable in backend.ts uses `'memory'` not `'demo'` as the non-postgres value. Admin pages that call `getServerDb()` use `mode: 'postgres' | 'demo'` from their own loaders. The overview page uses `backendMode` directly which has a different string set. The implementer must not mix these.

## Risks

1. **10-column TV table refactoring complexity.** The Action column contains two separate forms (grant + revoke), each with CSRF + hidden inputs + a text input + a select/button. Converting this to a mobile card while preserving form integrity is the highest implementation risk. The implementer must not split forms across card sections.
2. **Education page structural double-wrap.** The nested `<main>` inside `<main>` may produce unexpected layout behavior during the responsive refactor. The implementer should fix F-03 first, then apply the table-overflow fix.
3. **eventSnapshot unfiltered at render time.** If a new billing event type creates a manual_review item with richer snapshot content, the admin review page would expose it. Low current risk; medium future risk if the webhook route is extended.
4. **No admin mobile nav yet.** The admin console is currently unusable on mobile (no navigation below 900px). PG8 must add mobile nav inside the admin layout post-RBAC-gate — if added incorrectly in a parent layout, admin routes would be exposed in the public or app nav.

## Verification/tests

PG8 implementation should be verified against:
1. All 8 admin pages: each must open `requireUser()` + `assertAdmin()` before any data access.
2. TV table card reflow: submit grant form and revoke form on a 375px viewport — assert the CSRF token is present in the submitted form data (Playwright test).
3. Mobile nav (if added): confirm ADMIN_NAV items are not rendered to non-admin users by checking the HTML of the app layout for a user without the admin role.
4. revokeReason: confirm it does not appear in the HTML of /app/indicators for a regular user.
5. Storage-mode pills: all 8 pages must show the canonical pill; demo mode must never imply live persistent data.
6. eventSnapshot: add a test that creates a manual_review item with a PII-containing snapshot and assert the render page does NOT display the PII field (would require the render-time whitelist from F-08).

## Next actions

1. [Required — PG8 implementer] Fix F-01: add `requireUser` + `assertAdmin` to admin/page.tsx.
2. [Required — PG8 implementer] Fix F-02 and F-03: rewrite education/page.tsx to use canonical RBAC pattern and correct layout wrapper.
3. [Required — PG8 implementer] Fix F-04: add overflow-x wrapper to all `.wtc-table` instances in the admin pages (theme.css class or inline wrapper). Priority: TV page 10-column table.
4. [Required — PG8 implementer] Fix F-05: add canonical storage-mode pill to admin/page.tsx.
5. [Required — PG8 implementer] F-09 / admin mobile nav: add `<MobileNav items={ADMIN_NAV} />` INSIDE admin/layout.tsx after the assertAdmin redirect block.
6. [Recommended — PG8 implementer] Preserve F-07 truncation and F-10 form integrity during card reflow.
7. [Future phase] F-08: add render-time field whitelist for eventSnapshot.
