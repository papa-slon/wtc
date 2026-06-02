# ecosystem-tests-runner handoff

## Scope

Phase 2.11 / Phase Group 8 (Admin console — mobile responsiveness, honest state pills, PG2/PG5 consumption). Read-only audit of:
- All 8 admin pages under `apps/web/src/app/admin/` plus layout and overview
- Playwright config, existing e2e specs (smoke + security-headers)
- `packages/ui/src/theme.css` and `components.tsx` (design system)
- `apps/web/src/app/globals.css` (mobile nav CSS)
- `apps/web/src/components/MobileNav.tsx` and `apps/web/src/lib/nav.ts`
- `apps/web/src/features/admin/{queries.ts,types.ts}` and `apps/web/src/features/tv/queries.ts`
- Gate runs: lint, typecheck (packages + web), `npm test` (Vitest), `npx playwright test`

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
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
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/tv/queries.ts`
- `apps/web/src/components/MobileNav.tsx`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/app/globals.css`
- `packages/ui/src/theme.css`
- `packages/ui/src/components.tsx`
- `packages/ui/src/index.ts`
- `playwright.config.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/security-headers.spec.ts`
- `package.json`

## Files changed

None — read-only audit

## Findings

### F-01 — CRITICAL: Admin has zero navigation on mobile (390px / 375px)
**Severity:** critical
**Evidence:** `apps/web/src/app/admin/layout.tsx:17` — admin shell uses `<div className="wtc-shell">` with `.wtc-sidenav`; `packages/ui/src/theme.css:121` — `@media (max-width:900px) { .wtc-shell { grid-template-columns: 1fr; } .wtc-sidenav { display: none; } }`. `apps/web/src/app/globals.css:9-18` — `.wtc-mobile-nav { display: none; }` — `MobileNav` is only used by the `(app)` layout, not the admin layout. `apps/web/src/app/admin/layout.tsx:1-39` — no `<MobileNav>` import or usage.
**Impact:** Every one of the 8 admin pages is navigable ONLY via the hidden sidenav. On a 375-390px viewport an admin user sees a topbar (logout), the page content, and no navigation whatsoever. There is no back button, no page links, and no way to navigate between admin sections on mobile.
**Recommendation:** Add `<MobileNav items={ADMIN_NAV} />` to the admin layout (after `<main>`), wired to the existing `ADMIN_NAV` from `lib/nav.ts`. The `.wtc-mobile-nav` CSS is already defined in `globals.css` and activates at ≤900px. This is a 3-line addition to `layout.tsx`. Alternative: a compact admin hamburger menu / drawer. Either is acceptable; the MobileNav reuse is the lowest-effort path.
**Target:** PG8

---

### F-02 — HIGH: 10-column and 6-column tables overflow on mobile — no horizontal scroll wrapper
**Severity:** high
**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx:56-158` — `<table className="wtc-table">` with 10 `<th>` headers (User, TV username, Status, Submitted, Granted, Granted by, Expires, Revoked, Revoked by, Action); `packages/ui/src/theme.css:104` — `.wtc-table { width: 100%; border-collapse: collapse; }` — **no `overflow-x` wrapper, no `display:block`, no mobile stacking**. The 6-column grant-history table on the same page at line 171 is equally affected. `apps/web/src/app/admin/entitlements/page.tsx:267-295` — a 7-column timeline sub-table per user. `apps/web/src/app/admin/system-health/page.tsx:152-183` — a 4-column health-check table. `apps/web/src/app/admin/bots/page.tsx:205-230` — a 4-column health-check table. `apps/web/src/app/admin/audit-log/page.tsx:12-26` — a 5-column table.
**Impact:** On a 375px viewport, the 10-column TV table and all multi-column tables will overflow the viewport width, causing horizontal page scroll. This violates the PG8 "NO 375px horizontal scroll" acceptance criterion. The worst offender is `/admin/tradingview-access` with its inline grant/revoke forms embedded in the Action column.
**Recommendation:** For the TV 10-column table: wrap in `<div style={{ overflowX: 'auto' }}>`. For the Action column specifically: convert to a stacked card layout (one row = one expandable card) at mobile breakpoints — this is the only ergonomic solution for a table that holds interactive forms (the Action column inputs/buttons need full width to be usable). For the 4–7-column tables: `overflowX: 'auto'` wrapper is sufficient. Add a `.wtc-table-scroll` utility class to `theme.css` that applies `overflow-x: auto` so all tables can opt in consistently.
**Target:** PG8

---

### F-03 — HIGH: Admin education page uses wrong layout root (`wtc-container` not `wtc-stack`)
**Severity:** high
**Evidence:** `apps/web/src/app/admin/education/page.tsx:18` — `<main className="wtc-container" style={{ padding: '34px 22px' }}>` — every other admin page uses `<div className="wtc-stack">` as the root, which uses the correct `.wtc-stack` spacing pattern. The `wtc-container` class applies `max-width: var(--max); margin: 0 auto; padding: 0 22px;` — double padding at mobile (the outer `.wtc-main` already pads 26px 22px). Additionally, the education page is the only admin page that uses `getCurrentUser()` / manual `!user.roles.includes('admin')` check instead of `requireUser()` + `assertAdmin()`.
**Impact:** (a) Layout inconsistency on mobile — the education page has a double padding wrapping and misses the shared stack spacing rhythm. (b) Auth pattern diverges from all other admin pages: `getCurrentUser()` + manual role check (line 9-11) instead of `requireUser()` + `assertAdmin()`. `assertAdmin` (in `@wtc/auth`) is the canonical RBAC check that throws a typed `AppError`; the manual check does a `redirect()` which is behaviorally equivalent but does not emit an audit row on denial (violates the LMS RBAC principle from PG7). This is the same "silent return" anti-pattern PG7 just eliminated for LMS.
**Recommendation:** (a) Replace `<main className="wtc-container" ...>` with `<div className="wtc-stack">`. (b) Replace `getCurrentUser()` + manual role check with `requireUser()` + `assertAdmin(actor.roles)` — no migration, just a 3-line import/call swap consistent with the other 7 pages.
**Target:** PG8

---

### F-04 — MEDIUM: No-scroll assertion gap — mobile project viewport is 390px not 375px; PG8 acceptance criterion says 375px
**Severity:** medium
**Evidence:** `playwright.config.ts:24` — `{ name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }` — the mobile project is 390px wide (iPhone 14 equivalent), NOT the 375px the PG8 spec names. The Playwright `devices['iPhone SE']` is 375px. The difference matters for the TV table: a 390px viewport may not overflow on the same 10-column table that does at 375px.
**Impact:** The existing mobile e2e project does not verify the PG8 spec's 375px baseline. Tests that pass at 390px may still fail at 375px. The scroll assertion (described below in Verification/tests) must target 375px to be definitive.
**Recommendation:** Add a third Playwright project `{ name: 'mobile375', use: { viewport: { width: 375, height: 812 } } }` scoped only to the 8 admin pages and the no-scroll + screenshot checks. Alternatively, change the existing mobile project to 375px (but that changes coverage for all 36 current tests — adding a narrower project is safer). The no-scroll `evaluate` check must run at 375px width.
**Target:** PG8

---

### F-05 — MEDIUM: Missing storage/state pill on `/admin/page.tsx` (overview)
**Severity:** medium
**Evidence:** `apps/web/src/app/admin/page.tsx:10-26` — uses `backendMode` from `@/lib/backend` (line 2) but only shows it as a colored text label in a `<Card>` (`backendMode === 'postgres' ? 'Postgres' : 'In-memory (dev)'`, line 17) rather than a `<StatusPill>`. This page also calls `tvService.listAll()` (line 7) from the legacy `tvService` (the old in-memory TV service object, not the `loadTvAdminData` loader from `features/tv/queries.ts`). All 7 other admin pages use the `<StatusPill>` pattern for the storage pill.
**Impact:** (a) The overview page's storage indicator is not an honest pill (tone=ok/warn) — it's a styled `div` with a CSS class. This is inconsistent with the "honest state pills everywhere" acceptance criterion. (b) `tvService.listAll()` is the old in-memory service; it does not use the DB-backed `loadTvAdminData`. In demo mode this is fine, but in postgres mode the count shown on the overview will be wrong (always 0 from the in-memory service) while the actual TV page shows real data. This is a data inconsistency between overview and detail.
**Recommendation:** Convert the storage indicator on the overview to `<StatusPill tone="ok">storage: Postgres</StatusPill>` / `<StatusPill tone="warn">storage: in-memory (demo)</StatusPill>`. Replace `tvService.listAll()` with a dedicated count query from `loadTvAdminData()` or equivalent to ensure the overview count matches the detail page.
**Target:** PG8

---

### F-06 — MEDIUM: Typecheck fails on packages tsconfig (`tsc --noEmit -p tsconfig.json`)
**Severity:** medium
**Evidence:** `npm run typecheck` exit code 2 with:
- `packages/audit/src/audit.test.ts:44:12` — `error TS2532: Object is possibly 'undefined'`
- `packages/audit/src/audit.test.ts:45:12` — `error TS2532: Object is possibly 'undefined'`
- `tests/integration/lms-rbac-pipeline.test.ts:30:53` — `error TS2322: Type 'string | undefined' is not assignable to type 'string'`
- `tests/integration/lms-rbac-pipeline.test.ts:33:52` — `error TS2532: Object is possibly 'undefined'`
- `tests/integration/lms-rbac-pipeline.test.ts:96:52` — `error TS2345: Argument of type 'string | undefined' is not assignable to type 'string'`
The web typecheck (`npm run typecheck -w @wtc/web`) passes cleanly.
**Impact:** Packages-level typecheck is broken. The STATUS.md for Phase 2.10 reported "typecheck ×2 ✓" — this is either a newly introduced regression or the status was not checked after PG7 implementation. The test files need non-null assertions (`!` or nullish coalescing) on array access results.
**Recommendation:** Add non-null assertions or `.at(0)!` / `?? ''` to the 5 flagged lines. These are test files only; the production code typechecks cleanly. Fix is 1-line-per-site mechanical; no logic change.
**Target:** PG8 (gate-blocking for the typecheck gate)

---

### F-07 — MEDIUM: `db-pg5.test.ts` flakes under parallel PGlite load (hook timeout at 10 s)
**Severity:** medium
**Evidence:** `npm test` first run (exit 1): `tests/integration/db-pg5.test.ts` — `Error: Hook timed out in 10000ms` — `beforeAll` hook initializing PGlite with all migrations. The suite passes when run in isolation (`npx vitest run tests/integration/db-pg5.test.ts` = 5/5 in 1.9s). Second `npm test` run shows 406 passed / 8 skipped — the flake is load-dependent.
**Impact:** The full-suite `npm test` can exit 1 on the first try, which would incorrectly fail the CI gate. The second run passes (406/8/414 = consistent with Phase 2.10 STATUS). This is a known PGlite-under-load pattern present in other test files (db-persistence also warns at 500ms).
**Recommendation:** Increase the `hookTimeout` in `db-pg5.test.ts` `beforeAll` from the default 10 000ms to 30 000ms: `beforeAll(async () => { ... }, 30_000)`. This is the same fix that would be applied to any slow PGlite init. Alternatively, use vitest's global `testTimeout`/`hookTimeout` config in `vitest.config.ts`.
**Target:** PG8

---

### F-08 — LOW: Admin layout missing `<MobileNav>` means no e2e screenshot evidence for admin at 375–390px mobile nav state
**Severity:** low
**Evidence:** `tests/e2e/smoke.spec.ts:52-65` — the `admin console` test visits `/admin/entitlements` and `/admin/tradingview-access` on both desktop and mobile projects, but does not assert navigation presence on mobile. The existing mobile screenshots show the content but cannot prove navigation works (there is none — see F-01). Screenshots taken at 390px with no nav are misleading artifacts that could be passed off as "mobile works".
**Impact:** The current e2e test set provides no guard against the no-navigation regression. PG8 must add explicit mobile nav assertions.
**Recommendation:** Once F-01 is fixed (MobileNav added), add assertions: `await expect(page.locator('.wtc-mobile-nav')).toBeVisible()` on mobile project for each admin page. These should be in a dedicated `admin-mobile-pg8.spec.ts` file.
**Target:** PG8

---

### F-09 — LOW: `eventSnapshot` rendered via `JSON.stringify` — potential XSS if snapshot contains user-controlled content
**Severity:** low
**Evidence:** `apps/web/src/app/admin/entitlements/review/page.tsx:112` — `{JSON.stringify(item.eventSnapshot, null, 2)}` rendered inside a `<pre>`. The comment on line 22 states "non-secret, non-PII fields" — but the snapshot is stored as `JSONB` and its content depends on what the billing event writer includes. `JSON.stringify` output rendered inside `<pre>` in React is safe from XSS (React escapes text nodes), but if this was ever switched to `dangerouslySetInnerHTML` it would become a vector. Current: safe.
**Impact:** Currently safe due to React's text escaping. Note for future: if a JSON viewer component is added, ensure it does not use `dangerouslySetInnerHTML`. This is an informational finding, not an active bug.
**Recommendation:** Add a comment to the `<pre>` block noting that `JSON.stringify` output is safe here only because React escapes text content. If replaced with a rich viewer, sanitize first.
**Target:** Phase 3 (informational)

---

### F-10 — INFO: No `<MobileNav>` for admin means the `wtc-main` bottom padding override (88px) in globals.css does not apply in admin context
**Severity:** info
**Evidence:** `apps/web/src/app/globals.css:17` — `@media (max-width:900px) { .wtc-main { padding-bottom: 88px; } }` — this override reserves space for the fixed `.wtc-mobile-nav` bar. Since admin has no MobileNav, admin content at mobile will naturally have less bottom padding, but content may still appear behind the (nonexistent) nav bar area — not a problem today, but once F-01 is fixed the 88px bottom padding will be needed in `.wtc-main` for admin pages too.
**Impact:** Post-F-01 fix, without the padding admin page content will be clipped by the mobile nav bar. This is a follow-on consideration for the F-01 implementer.
**Recommendation:** After F-01 is implemented, verify `.wtc-main` padding-bottom applies correctly to the admin main area. The existing CSS in `globals.css` already applies to `.wtc-main` globally (not scoped to app-only), so it should work once MobileNav is present.
**Target:** PG8 (follow-on to F-01)

## Decisions

1. **Mobile viewport for PG8 tests is 375px**, not 390px (the current Playwright mobile project). The PG8 acceptance criterion explicitly names 375px. A dedicated `mobile375` Playwright project or overriding the existing mobile project is required.
2. **The no-scroll assertion uses `scrollWidth <= clientWidth + 1`** — a 1px tolerance accounts for sub-pixel rendering differences across browsers. The `evaluate` call must run after the full page load (not just navigation completion).
3. **`retries: 2` is preserved** — two mobile server-action login flakes were observed this run (test #26 and #34 auto-retried green). This is the known dev-only Next.js server-action recompilation race. It is NOT a regression. Final result: **36/36 green** (2 auto-retried).
4. **`db-pg5.test.ts` hook timeout flake** is a new observation. The full-suite first run exited 1 (hook timeout); second run gave 406/8/414. The fix (30s `beforeAll` timeout) must land before PG8 gates are run.

## Risks

- **R-01 (HIGH): Admin pages completely unusable on mobile without F-01 fix.** The PG8 acceptance criterion for "mobile-readable cards — NO 375px horizontal scroll" cannot be met by responsive table fixes alone if there is no navigation. A user who navigates to `/admin` on mobile has no way to reach the other 7 pages.
- **R-02 (HIGH): TV 10-column table + inline forms are the hardest responsive problem.** Wrapping in `overflow-x: auto` is a stopgap. The Action column contains multi-input forms (reason text input + duration select + submit button); these cannot be made usable at 375px inside a scrolling table cell. A card-per-row approach is strongly recommended for this page specifically. This requires more implementation effort than the other 7 pages.
- **R-03 (MEDIUM): Typecheck gate is broken** (`packages/audit/src/audit.test.ts` + `lms-rbac-pipeline.test.ts` — 5 errors). STATUS.md Phase 2.10 claimed "typecheck ×2 ✓" but the packages typecheck fails on the current tree. Must be fixed before any PG8 gate claim.
- **R-04 (MEDIUM): Admin e2e test has no admin session reuse** — the `admin console` test in `smoke.spec.ts:52` logs in fresh with `admin@wtc.local`. This works because the seed creates this user. Any PG8 new admin page tests should use the same `login(page, 'admin@wtc.local')` helper — the admin session is cookie-based and lasts the test. This is confirmed working in the current suite.
- **R-05 (LOW): `db-pg5.test.ts` PGlite init can time out under parallel load** (observed once). Add explicit `hookTimeout` before PG8 gates.

## Verification/tests

### Gate results observed this session

| Gate | Command | Result |
|------|---------|--------|
| lint | `npm run lint` | PASS — exit 0, 0 warnings |
| typecheck (packages) | `npm run typecheck` | FAIL — 5 errors in audit.test.ts + lms-rbac-pipeline.test.ts |
| typecheck (web) | `npm run typecheck -w @wtc/web` | PASS — exit 0 |
| unit+integration | `npm test` | PASS (2nd run) — **406 passed / 8 skipped (414)**, 39 files; 1st run flaked on db-pg5 hook timeout |
| e2e | `npx playwright test` | PASS — **36/36** (2 mobile auto-retried green: known dev-only Server-Action race); screenshots written |

NOT RUN: real-PG `db:migrate`/`db:seed`/harness (no `DATABASE_URL` — B1); B2 Stripe checkout; B4 Axioma activation.

### Playwright config confirmed facts

- **Mobile project viewport: 390px x 844** (`playwright.config.ts:24`). NOT 375px. PG8 needs a 375px project or override.
- **Desktop project: 1440 x 900**.
- `retries: 2` carried. 2 flakes observed (mobile login race — both auto-retried green).
- `baseURL: http://localhost:3100` (dedicated e2e port).
- `workers: 1, fullyParallel: false` — serial execution.

### Exact PG8 no-scroll assertions to add

For each of the 8 admin pages, after login as admin and navigation to the page, run:

```typescript
const noScroll = await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
);
expect(noScroll, `horizontal scroll on ${page.url()}`).toBe(true);
```

This must be run in the `mobile375` project (375px viewport). The 8 pages to cover:
1. `/admin/users`
2. `/admin/entitlements`
3. `/admin/entitlements/review`
4. `/admin/tradingview-access` — worst offender (10-column + form Action column)
5. `/admin/bots`
6. `/admin/education`
7. `/admin/system-health`
8. `/admin/support`

Note for `/admin/tradingview-access`: the queue is empty in demo mode (no DATABASE_URL), so the 10-column table body will not render — the `EmptyState` renders instead. The scroll test on an empty-queue state may pass even without the overflow fix. To properly test the table, either seed a TV request or assert the EmptyState renders (not the table) and note that the table path requires a Postgres-backed test.

### Screenshot check plan

For each of the 8 pages, call:
```typescript
await page.screenshot({ path: `tests/e2e/screenshots/admin-${slug}-mobile375.png`, fullPage: true });
```

These screenshots serve as visual regression baselines for PG8. They must be taken AFTER F-01 (MobileNav) and F-02 (overflow-x fixes) are implemented.

### State-pill presence assertions (to add to PG8 e2e spec)

```typescript
// Storage pill on every admin page
await expect(page.getByText(/storage: (Postgres|in-memory \(demo\))/)).toBeVisible();

// Demo-mode empty state copy (when no DATABASE_URL — the e2e environment)
await expect(page.getByText(/demo mode|in-memory \(demo\)/i)).toBeVisible();

// B3 legacy-blocked banner (bots page always)
await page.goto('/admin/bots');
await expect(page.getByText('Legacy adapter BLOCKED')).toBeVisible();
await expect(page.getByText('BLOCKED').first()).toBeVisible();

// Bot readState (PG2): adapter mode pill always present on bots page
await expect(page.getByText(/adapter: (mock|read-only)/)).toBeVisible();

// TV revokeReason column (PG5): visible in grant history table (admin-only)
// In demo mode the table is empty; assert the column header in the non-empty postgres path only.
// In demo mode: assert the EmptyState "No grants recorded yet"
await expect(page.getByText('No grants recorded yet')).toBeVisible();
```

### Admin auth path confirmation

The existing e2e suite uses `login(page, 'admin@wtc.local')` (smoke.spec.ts line 9). The `admin@wtc.local` user is seeded by `apps/web/src/lib/seed.ts` (or equivalent) with the `admin` role. The admin layout (`apps/web/src/app/admin/layout.tsx:12-14`) gates all admin pages with `requireUser()` + `isAdmin(user)`. The e2e seed password is `wtc-demo-pass-123`. This path is confirmed working: tests #6, #9, #12, #16, #18 all exercise it (observed green this session). No new auth mechanism is needed for PG8 admin tests.

### Static/unit tests worth adding for PG8

Since vitest excludes `apps/web/**` (the pattern in vitest.config or tsconfig.base.json), admin page source assertions must be done via source analysis in `tests/integration/`. Candidates:

1. **`tests/integration/admin-mobile-pills.test.ts`** — Source-read assertions (fs-based, no React render) that:
   - Every file in `apps/web/src/app/admin/*/page.tsx` contains the string `StatusPill` (storage pill presence check).
   - Every file contains `requireUser` OR `getCurrentUser` (not unauthenticated).
   - Every file contains `assertAdmin` OR `isAdmin` (admin RBAC check).
   - The education page (`admin/education/page.tsx`) — flag if it uses `getCurrentUser` without `assertAdmin` (the F-03 authz pattern gap).
   - The `admin/page.tsx` (overview) — flag if it lacks `requireUser`/`assertAdmin` (it currently lacks both; the route is protected only by the layout redirect — acceptable for overview but should be documented).

2. **`tests/integration/admin-no-business-logic.test.ts`** — Assert that admin page files do not contain direct DB import (`import.*from.*@wtc/db` or `import.*from.*drizzle-orm`) — business logic belongs in `features/admin/queries.ts` or `packages/*`. Exception: the education page may import from `@wtc/entitlements` (product codes enum). The TV page imports from `@/features/tv/queries` — correct. The entitlements page imports from `@/lib/backend` directly — borderline (uses `listUsers` + `entitlementsOf` which are lib-level helpers, acceptable).

### Known flake pattern for PG8 gates

The `retries:2` config covers the dev-only server-action recompilation race. Two mobile tests were auto-retried this session (smoke.spec.ts:78 and smoke.spec.ts:217). Verify that any new PG8 mobile tests do not add a third login-race path in the same worker run — sequential single-worker execution means back-to-back logins from the same Next.js dev server can trip the race if the server is still recompiling a module. If PG8 adds many new mobile tests with logins, consider whether a shared session fixture would reduce the recompilation surface.

## Next actions

1. **Fix F-06 (typecheck) immediately** — 5 non-null assertion fixes in `packages/audit/src/audit.test.ts:44-45` and `tests/integration/lms-rbac-pipeline.test.ts:30,33,96` before any PG8 gate claim.
2. **Fix F-07 (db-pg5 hookTimeout)** — add `30_000` ms explicit timeout to `db-pg5.test.ts:40` `beforeAll` to eliminate the parallel-load flake.
3. **F-03 auth pattern fix (education page)** — replace `getCurrentUser()` + manual role check with `requireUser()` + `assertAdmin()` in `apps/web/src/app/admin/education/page.tsx:9-11`. Also replace `<main className="wtc-container">` with `<div className="wtc-stack">` for layout consistency.
4. **F-01 (admin MobileNav)** — add `<MobileNav items={ADMIN_NAV} />` to `apps/web/src/app/admin/layout.tsx` after `<main>`. This is the PG8 gate prerequisite.
5. **F-02 (table overflow)** — add `overflowX: 'auto'` wrappers to all multi-column tables. For the TV 10-column+forms table, implement a card-per-row stacked layout at 640px breakpoint.
6. **F-04 (375px e2e project)** — add `mobile375` Playwright project at 375px for the 8 admin page no-scroll assertions.
7. **F-05 (admin overview storage pill)** — convert the overview's backend indicator to `<StatusPill>` and fix the `tvService.listAll()` call to use DB-backed data.
8. **Write `tests/e2e/admin-mobile-pg8.spec.ts`** with: no-scroll `evaluate` check for all 8 pages at 375px, storage pill assertions, MobileNav presence assertion, state-pill checks (B3 blocked, adapter mode, demo empty-states).
9. **Write `tests/integration/admin-mobile-pills.test.ts`** with source-analysis checks for `StatusPill` presence, `assertAdmin` usage, and no-business-logic boundary assertions.
10. **Update `docs/STATUS.md` real-vs-mocked tally** after PG8 gates are verified.
