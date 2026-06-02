# Handoff — ecosystem-tests-runner
**Epoch:** 20260531-0005  
**Phase:** 2.12 / Phase Group 9 (User Cabinet / Product UX)  
**Role:** ecosystem-tests-runner (read-only audit)  
**Status:** Read-only — no code files edited.

---

## Scope

Define the PG9 acceptance/test plan; run and confirm the PG8 baseline gates; flag gate risks; specify unit, integration static-guard, and e2e tests for the PG9 deliverables (per-product enriched cabinet cards + mobile setup wizard).

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/ROADMAP_MASTER.md` §9
- `docs/PRODUCTION_BLOCKERS.md`
- `apps/web/src/app/(app)/app/page.tsx`
- `apps/web/src/app/(app)/app/layout.tsx`
- `apps/web/src/app/(app)/app/security/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/product-status.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/lms/queries.ts` (partial)
- `apps/web/src/features/tv/queries.ts` (partial)
- `apps/web/src/features/terminal/loader.ts` (partial)
- `packages/entitlements/src/engine.ts`
- `packages/entitlements/src/registry.ts`
- `packages/entitlements/src/engine.test.ts`
- `packages/ui/src/components.tsx`
- `packages/ui/src/theme.css`
- `packages/crypto/src/vault.test.ts`
- `packages/analytics/src/metrics.test.ts`
- `packages/auth/src/rbac.test.ts`
- `tests/integration/admin-responsive.test.ts`
- `tests/integration/lms-rbac-pipeline.test.ts`
- `tests/integration/csrf-coverage.test.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `playwright.config.ts`
- `vitest.config.ts`

---

## Files changed

None — read-only audit.

---

## Gate run results (commands + observed outcomes)

### 1. `npm run lint`
**PASS** — exit 0, no warnings. ESLint `--max-warnings 0` satisfied.

### 2. `npm run typecheck`
**PASS** — `tsc --noEmit -p tsconfig.json` exits 0, no errors.

### 3. `npm run test` (Vitest unit/integration)
**PASS** — 441 passed / 8 skipped (449 total), 40 test files.  
Exact output: `Test Files 40 passed (40)  Tests 441 passed | 8 skipped (449)`.  
Duration: 12.45 s. Matches the PG8 baseline exactly.

### 4. `npx playwright test` (desktop + mobile smoke + screenshots)
**PASS** — 36 passed / 1 flaky-retried-green / 1 skipped (38 scheduled slots).  
The 1 flaky: `[mobile] smoke.spec.ts:180 — Phase 2.3 TV admin queue + user indicator: manual-first copy` — `TimeoutError: page.waitForURL` on first attempt, passed on retry #1. This is the known dev-only Server-Action recompile race (retries:2 is already in playwright.config.ts). The 1 skipped: `[desktop] admin-mobile-pg8.spec.ts:41` — correctly skipped by `test.skip(info.project.name !== 'mobile', …)`.  
No genuine failures observed.

### 5. `npm run db:generate -w @wtc/db`
**PASS** — 41 tables listed, output ends with `No schema changes, nothing to migrate 😴`.  
PG9 requires NO new migration (confirmed). Table count matches PG8 baseline.

---

## Findings

### F-01 — info — Cabinet overview page carries ONLY 5 props per card; no setup/activity/blocker enrichment yet
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:55-65`  
`ProductStatusCard` receives only `{name, description, allowed, reason, statusLabel, href, ctaLabel}`. There is no per-product setup state, recent-activity snapshot, or blocker attribution. The PG9 deliverable requires enriching this to include: `setupState` (is exchange key present? is config saved?), `activitySummary` (last bot health pill or LMS enrollment count), `nextAction` (most actionable CTA), and `blockers` (B2/B3/B4/demo-mode signals).  
**Recommendation:** In the implementation phase, create a pure derivation function `packages/cabinet/src/derive.ts` (zero UI deps) that takes `{AccessDecision, botHealth?, exchangeKeys, configVersion, lmsEnrollmentCount, tvGrant?, terminalMode, blocker?}` and returns `{setupState, activityLabel, nextAction, blockers}`. Placing it in a package (not `apps/web`) gives it real Vitest unit coverage.  
**Target:** PG9 implementation agent.

### F-02 — info — `ProductStatusCard` component has no `setup`/`activity`/`blocker` prop slots yet
**Evidence:** `packages/ui/src/components.tsx:86-108`  
The component renders 7 fixed props. PG9 enrichment will need either (a) extending this component with optional `setupLabel?`, `activityLabel?`, `blockers?: string[]` props, or (b) a new `ProductCabinetCard` variant. PG8's pattern was to extend existing components carefully.  
**Recommendation:** Prefer option (b) — `ProductCabinetCard` in `packages/ui/src/components.tsx` — to avoid breaking the existing `ProductStatusCard` used on `/products/*` pages. The new component reuses `StatusPill`, `RiskWarningBanner`, `buttonClasses`.  
**Target:** PG9 ux-ui-designer / frontend-implementer.

### F-03 — info — No `.wtc-wizard` / `.wtc-step` CSS classes exist in theme.css
**Evidence:** `packages/ui/src/theme.css:1-199` (all lines read — no wizard classes)  
The setup wizard for exchange-key onboarding (the primary PG9 wizard target) needs responsive step-container CSS. The PG8 `.wtc-table-wrap` / `.wtc-table-wrap td::before` pattern is the canonical responsive CSS model (pure CSS, no JS). A `.wtc-wizard` wrapper + `.wtc-wizard-step` + `.wtc-wizard-progress` taxonomy needs to be added to DESIGN_SYSTEM §14 and `theme.css`.  
**Recommendation:** Add `.wtc-wizard { display: flex; flex-direction: column; gap: 18px; }` + `.wtc-wizard-step { ... }` in `theme.css` during implementation. On mobile (≤640px) the step container stacks vertically with 44px-minimum tap targets, matching `.wtc-btn { min-height: 44px }` and `.wtc-input { min-height: 44px }` already in theme.css.  
**Target:** PG9 ux-ui-designer.

### F-04 — info — Security page (`/app/security`) is already the wizard target but has no step-by-step UI
**Evidence:** `apps/web/src/app/(app)/app/security/page.tsx:34-68`  
The flat add-exchange-key form already has correct CSRF-first pipeline (`assertCsrf` → `requireUser` → Zod → `addExchangeKey` → `revalidatePath`), AES-256-GCM sealed via vault, and `keyMask`-only display (no plaintext in any response). The PG9 wizard builds ON TOP of this correct foundation. The mutation action does NOT need to be rewritten — only the presentation layer (step stepper, progress indicator) is new.  
**Recommendation:** Keep the existing `addKeyAction` server action untouched; wrap the form in a `WizardStep` shell that shows progress state client-side. The security-critical pipeline is already correct and CSRF-covered by `tests/integration/csrf-coverage.test.ts`.  
**Target:** PG9 frontend-implementer.

### F-05 — info — `backendMode==='memory'` (demo) blocker is not surfaced per-product card today
**Evidence:** `apps/web/src/lib/backend.ts:35`; `apps/web/src/app/(app)/app/page.tsx:27-68`  
The cabinet overview page does not distinguish between "no access" and "no access because this is demo mode". Per the prompt, the cards must surface blockers honestly including `demo-mode`. The derivation function (F-01) should emit a `blocker: 'demo'` field when `backendMode === 'memory'` and the product requires real DB activity (tortila_bot, axioma_terminal).  
**Recommendation:** The `derive.ts` function accepts `backendMode` as an input and maps it to an honest blocker label. No new server call needed.  
**Target:** PG9 implementation agent.

### F-06 — info — B3 / B4 / B2 blocker surfacing is per-product but not yet on the cabinet card
**Evidence:** `apps/web/src/features/bots/meta.ts:46-50` (`BOT_CAPS.liveAdapterBlocked`); `docs/PRODUCTION_BLOCKERS.md:B2,B3,B4`  
`BOT_CAPS.legacy_bot.liveAdapterBlocked = true` (B3 permanent). `BOT_CAPS.tortila_bot.liveAdapterBlocked = false` (unblocked once JOURNAL_READ_TOKEN configured). Axioma CTAs are disabled (B4). Billing CTA is "contact support" (B2). These are static facts that the `derive.ts` function should consume and surface as `blockers[]` on each card.  
**Recommendation:** The derive function takes `caps: BotCapabilities | undefined` and maps `liveAdapterBlocked → 'B3: live adapter blocked'`; maps `axioma_terminal` product → check if CTAs disabled → `'B4: CTAs pending'`; maps billing → `'B2: self-serve checkout pending'`.  
**Target:** PG9 implementation agent.

### F-07 — medium — `ProductStatusCard` tone for `grace` vs. `reason==='grace'` — minor drift risk
**Evidence:** `packages/ui/src/components.tsx:95` — tone computed from `props.reason`; `apps/web/src/lib/access.ts:27-33` — `reasonTone()` is defined separately but not used in `page.tsx:62`; `page.tsx` computes `statusLabel` from `reasonLabel()` but the tone is hardcoded in the component.  
Two tone-derivation paths exist: `ProductStatusCard` derives tone from `props.reason` inline (line 95), and `reasonTone()` in access.ts provides a parallel mapping never consumed by the cabinet page. If PG9 adds a `ProductCabinetCard` it should import and use `reasonTone()` from `access.ts` to avoid a third path.  
**Recommendation:** `ProductCabinetCard` must import `reasonTone` from `@/lib/access` (server-only) or replicate it in a pure util; document in a code comment which is the canonical path.  
**Target:** PG9 ux-ui-designer.

---

## PG9 Unit Test Plan — `packages/cabinet/src/__tests__/derive.test.ts`

Vitest coverage path (vitest includes `packages/**/*.test.ts` per `vitest.config.ts:8`).

The derivation function signature (to be created):

```ts
// packages/cabinet/src/derive.ts
export interface CabinetCardInput {
  code: ProductCode;
  decision: AccessDecision;
  backendMode: 'postgres' | 'memory';
  exchangeKeyCount: number;       // 0 = no keys added
  botConfigVersion: number | null; // null = unconfigured
  botHealth?: { readState: string; status: string };
  lmsEnrollmentCount: number;
  tvGrantActive: boolean;
  terminalMode: 'postgres' | 'demo';
  caps?: BotCapabilities;
}

export interface CabinetCardOutput {
  setupState: 'complete' | 'partial' | 'none' | 'na';
  activityLabel: string | null;
  nextAction: string;   // e.g. "Add exchange key", "Get access", "Open"
  blockers: string[];   // e.g. ["B3: live adapter blocked"]
}

export function deriveCabinetCard(input: CabinetCardInput): CabinetCardOutput
```

Test table (inputs → expected outputs):

| # | code | allowed | reason | excKeys | cfgVer | backendMode | caps.liveAdapterBlocked | expected nextAction | expected setupState | expected blockers |
|---|------|---------|--------|---------|--------|-------------|------------------------|--------------------|--------------------|------------------|
| U-01 | tortila_bot | false | blocked_no_entitlement | 0 | null | postgres | false | "Get access" | "na" | [] |
| U-02 | tortila_bot | true | allowed | 0 | null | postgres | false | "Add exchange key" | "none" | [] |
| U-03 | tortila_bot | true | allowed | 2 | null | postgres | false | "Configure bot" | "partial" | [] |
| U-04 | tortila_bot | true | allowed | 1 | 3 | postgres | false | "Open" | "complete" | [] |
| U-05 | tortila_bot | true | allowed | 1 | 3 | memory | false | "Open (demo)" | "complete" | ["demo: not persisted"] |
| U-06 | legacy_bot | true | allowed | 0 | null | postgres | true | "View status" | "na" | ["B3: live adapter blocked"] |
| U-07 | axioma_terminal | true | allowed | 0 | null | postgres | undefined | "Open" | "na" | ["B4: CTAs pending provisioning"] |
| U-08 | tortila_bot | false | grace | 0 | null | postgres | false | "Renew" | "na" | [] |
| U-09 | tortila_bot | false | expired | 0 | null | postgres | false | "Renew" | "na" | [] |
| U-10 | tortila_bot | false | revoked | 0 | null | postgres | false | "Contact support" | "na" | [] |
| U-11 | tortila_bot | false | manual_review | 0 | null | postgres | false | "Pending review" | "na" | [] |
| U-12 | education | true | allowed | 0 | null | postgres | undefined | "Open" | "complete" | [] |
| U-13 | club | false | blocked_no_entitlement | 0 | null | postgres | undefined | "Get access" | "na" | ["B2: self-serve checkout not yet available"] |
| U-14 | tradingview_indicators | true | allowed | 0 | null | postgres | undefined | "Open" | "complete" | [] |
| U-15 | tortila_bot | false | blocked_unknown_state | 0 | null | postgres | false | "Contact support" | "na" | [] |

**Fail-closed invariant tests** (must pass at the unit level):

- U-FC-01: when `allowed=false`, `nextAction` NEVER equals `"Open"` for any product code.
- U-FC-02: when `allowed=false`, `setupState` MUST equal `"na"` (never gather activity for denied users — no data leakage).
- U-FC-03: `blockers` for `legacy_bot` with `caps.liveAdapterBlocked=true` is NEVER empty regardless of `allowed`.
- U-FC-04: any `reason` not in the known `AccessReason` union falls through to `nextAction="Contact support"` (exhaustive switch with default).
- U-FC-05: `backendMode='memory'` always appends a demo-mode blocker for products that require live DB activity (tortila_bot, axioma_terminal, tradingview_indicators).

---

## PG9 Static Source-Guard Tests — `tests/integration/cabinet-pg9.test.ts`

Pattern: static analysis of `apps/web/src/app/(app)/app/page.tsx` and the wizard pages (vitest excludes `apps/web/**` from execution but the integration directory reads source files with `readFileSync` — established by `tests/integration/admin-responsive.test.ts`, `csrf-coverage.test.ts`, `lms-rbac-pipeline.test.ts`).

```ts
// tests/integration/cabinet-pg9.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
```

**Assertions to include:**

1. Every `PRODUCT_CODES` entry has a corresponding card rendered:

```ts
it('every PRODUCT_CODE appears in the cabinet page source', () => {
  const src = readFileSync(join(APP_DIR, '(app)/app/page.tsx'), 'utf8');
  for (const code of PRODUCT_CODES) {
    expect(src).toContain(code);
  }
});
```

2. Activity is gathered ONLY when `allowed`:

```ts
it('loader gathers per-product activity inside an allowed guard (not unconditionally)', () => {
  const src = readFileSync(loaderPath, 'utf8');
  // The loader must NOT call listExchangeKeys / loadBotConfig / loadTvUserData
  // outside a `if (d.allowed)` or `decision.allowed` guard.
  expect(src).toMatch(/if\s*\(\s*(?:d|decision)\.allowed\b/);
});
```

3. Wizard action is CSRF-first:

```ts
it('addKeyAction calls assertCsrf before requireUser', () => {
  const src = readFileSync(join(APP_DIR, '(app)/app/security/page.tsx'), 'utf8');
  const csrf = src.indexOf('assertCsrf(');
  const auth = src.indexOf('requireUser(');
  expect(csrf).toBeGreaterThan(-1);
  expect(csrf).toBeLessThan(auth);
});
```

4. No plaintext secret field is rendered in the keys table:

```ts
it('security page renders only keyMask — never apiKey or apiSecret as plain text in the table', () => {
  const src = readFileSync(join(APP_DIR, '(app)/app/security/page.tsx'), 'utf8');
  // The table must NOT render k.apiKey or k.apiSecret (only k.keyMask)
  expect(src).not.toMatch(/\bk\.apiKey\b/);
  expect(src).not.toMatch(/\bk\.apiSecret\b/);
  expect(src).toContain('k.keyMask');
});
```

5. Cabinet page has a `StatusPill` per card (PG8 pattern applied to cabinet):

```ts
it('cabinet page renders StatusPill', () => {
  const src = readFileSync(join(APP_DIR, '(app)/app/page.tsx'), 'utf8');
  expect(src).toContain('StatusPill');
});
```

6. Bot settings action is CSRF-first and entitlement-gated:

```ts
it('saveBotConfigAction: CSRF first, entitlement gate before persist', () => {
  const src = readFileSync(join(APP_DIR, '(app)/app/bots/[bot]/settings/page.tsx'), 'utf8');
  const csrf = src.indexOf('assertCsrf(');
  const access = src.indexOf('accessFor(');
  const persist = src.indexOf('persistBotConfig(');
  expect(csrf).toBeLessThan(access);
  expect(access).toBeLessThan(persist);
});
```

---

## PG9 E2E Test Plan — `tests/e2e/cabinet-pg9-mobile.spec.ts`

Pattern: mirrors `tests/e2e/admin-mobile-pg8.spec.ts`. The mobile project viewport is 390px; set to exactly 375px via `page.setViewportSize({ width: 375, height: 812 })`. Scope to the `mobile` project via `test.skip(info.project.name !== 'mobile', …)`.

Screenshots directory: `tests/e2e/screenshots/` (existing).

```ts
// tests/e2e/cabinet-pg9-mobile.spec.ts
import { test, expect, type Page } from '@playwright/test';

const shot = (slug: string) => `tests/e2e/screenshots/${slug}-pg9-mobile375.png`;
const DEMO_PASSWORD = 'wtc-demo-pass-123';

async function login(page: Page, email = 'user@wtc.local') {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', DEMO_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app', { timeout: 60_000 });
}
```

**Test E2E-PG9-01: Cabinet cards at 375px — no horizontal scroll**

```
test('PG9: cabinet cards render at 375px with no horizontal scroll', ...)
  → page.setViewportSize({ width: 375, height: 812 })
  → login(page)
  → page.goto('/app')
  → for each PRODUCT_CODES:
      assert: at least one element with the product name is visible
  → assert: every card has a status pill (locator('.wtc-pill').count() >= 6)
  → assert: every card has a CTA anchor/button
  → noHScroll check: document.documentElement.scrollWidth <= clientWidth + 1
  → screenshot: shot('cabinet-overview')
```

**Test E2E-PG9-02: Each product card shows status pill + next-action CTA**

```
test('PG9: each product card shows status pill + actionable CTA')
  → login
  → page.goto('/app')
  → assert pill present per card (by product name heading → sibling pill)
  → assert CTA link/button present per card
  → screenshot: shot('cabinet-cards-ctas')
```

**Test E2E-PG9-03: Setup wizard (exchange-key onboarding) renders + navigable on mobile**

```
test('PG9: setup wizard (security/exchange-key) renders at 375px, no h-scroll, inputs reachable')
  → login
  → page.goto('/app/security')
  → assert heading 'Exchange keys & security' visible
  → assert form inputs reachable: page.locator('#apiKey').isVisible()
  → assert form inputs reachable: page.locator('#apiSecret').isVisible()
  → assert submit button visible and tap-target OK: page.locator('button[type="submit"]').isVisible()
  → noHScroll check
  → screenshot: shot('wizard-exchange-key')
```

**Test E2E-PG9-04: Bot config wizard renders + navigable on mobile**

```
test('PG9: bot settings config form renders at 375px, no h-scroll')
  → login
  → page.goto('/app/bots/tortila/settings')
  → assert heading 'Configuration' visible
  → assert config fields visible (symbols, riskPercent, leverage)
  → assert save button visible
  → noHScroll check
  → screenshot: shot('wizard-bot-config')
```

**Test E2E-PG9-05: Honest demo/blocker labels visible at 375px**

```
test('PG9: honest blocker/demo labels visible on cabinet cards at 375px')
  → login (memory/demo backend — no DATABASE_URL in e2e)
  → page.goto('/app')
  → assert 'demo data (in-memory)' OR 'Not owned' visible (honest state, not fabricated)
  → screenshot: shot('cabinet-honest-state')
```

**Known dev-only flake:** The `retries: 2` in `playwright.config.ts` covers the Server-Action recompile race. Any PG9 test that navigates to `/app/security` and posts the form (if added later as a mutation test) should be aware this flake can occur on the initial mobile compilation. The current PG9 e2e plan is read-only navigation only (no form submit) so the flake risk is lower.

**Honest caveat:** In e2e demo mode (`backendMode==='memory'`, no `DATABASE_URL`) the cabinet page will show "Not owned" for most product cards (no seeded entitlements for `user@wtc.local` beyond what `demo.ts` provides). The PG9 e2e tests must assert the STRUCTURE (pill present, CTA present, no h-scroll) rather than specific allowed/denied states that depend on DB seeding. This is the same pattern as `admin-mobile-pg8.spec.ts` which asserts the EmptyState renders — not the real data.

---

## Baseline confirmation and PG9 delta prediction

### PG8 baseline (confirmed by this run)
- Unit/integration: **441 passed / 8 skipped (449)** — 40 test files
- Coverage: **26.83% stmts / 74.32% branch** (not run this session; confirmed from STATUS.md)
- e2e: **36 passed / 1 flaky-retried-green / 1 skipped** — matches exactly
- `db:generate`: **41 tables, No schema changes** — confirmed
- Lint: PASS, Typecheck: PASS

### PG9 predicted delta
- New Vitest unit tests in `packages/cabinet/src/__tests__/derive.test.ts`: **~20–22 tests** (15 table cases + 5 fail-closed invariants + setup/teardown helpers)
- New static source-guard tests in `tests/integration/cabinet-pg9.test.ts`: **~8–10 tests**
- Predicted test total post-PG9: **~469–473 passed / 8 skipped**
- Coverage: stmts likely **-0.2 to -0.4%** (new app-layer cabinet page code grows the denominator while packages/cabinet pure logic grows numerator — net slight decline typical of this pattern, see PG8/PG7 history). Branch: **held or slight ↑** if the derive.ts branches are well-covered.
- New e2e tests: **5 new specs × 2 projects = 10 new slots** (1 of 10 mobile-only = 9 non-skipped). Total e2e: **~45 passed / 1 flaky-green / 2 skipped**.
- Migration: **NO migration** (PG9 consumes existing DB tables; cabinet enrichment is derived at render time from existing repos — no new column needs identified).

---

## Known flags (carried forward)

### Flag A — dev-only Server-Action e2e flake (retries:2)
**Evidence:** `playwright.config.ts:11-14`; observed in this run: `[mobile] smoke.spec.ts:180 retry #1 (5.9s) passed`.  
The Next.js dev server compiles routes and server actions on demand. When the mobile project runs a route for the first time in a session it can transiently return an unexpected response during module compilation. `retries: 2` is already in config and is the correct mitigation. This is NOT a production issue (production is pre-compiled). The PG9 spec must NOT assert on POST responses in its mobile smoke — navigation-only checks avoid this flake.

### Flag B — apps/web vitest exclusion
**Evidence:** `vitest.config.ts:9` — `exclude: ['**/node_modules/**', '**/dist/**', 'apps/web/**']`  
All `apps/web/src/**` (pages, server actions, features, lib) is EXCLUDED from Vitest execution. Server components need Next request context (cookies, headers) that cannot be mocked in a Node test environment. The mitigation pattern (established in PG7/PG8) is:  
1. Pure logic → `packages/*` → real Vitest unit tests.  
2. Server actions / pages → `tests/integration/*.test.ts` static source analysis with `readFileSync`.  
3. Runtime behavior → Playwright e2e.  
PG9 must follow this same pattern: `packages/cabinet/src/derive.ts` for the derivation logic (unit-testable), `tests/integration/cabinet-pg9.test.ts` for the source guards, `tests/e2e/cabinet-pg9-mobile.spec.ts` for the runtime behavior.

---

## Real vs mocked tally update (PG9 additions)

No new real integrations land in PG9. The cabinet enrichment uses existing repos (listExchangeKeys, loadBotConfig, loadTvUserData, lmsMode, terminalMode) already categorized in prior phases. The tally is unchanged from PG8.

**Still NOT RUN (carried):**
- B1: real-PG `db:migrate`/`db:seed`/harness (no `DATABASE_URL`)
- B2: Stripe self-serve checkout
- B4: Axioma terminal CTAs activation (P-256 key unprovisioned)
- `npm ci`

---

## Decisions

1. PG9 requires NO migration — confirmed by `db:generate` (41 tables, no changes). All enrichment data is derived at render time from existing DB tables and adapter state.
2. The derivation logic (`deriveCabinetCard`) must live in `packages/cabinet/src/derive.ts` (not in `apps/web`) to achieve real Vitest unit coverage — this is the architecturally mandated pattern per `AGENTS.md` and `vitest.config.ts`.
3. A new `ProductCabinetCard` component variant is preferred over extending the existing `ProductStatusCard` to avoid breaking existing usages on `/products/*` pages.
4. The setup wizard presentation layer builds on the already-correct `addKeyAction` security pipeline (CSRF → requireUser → Zod → vault seal) — the wizard is a UX wrapper, not a security change.
5. PG9 e2e tests MUST use `page.setViewportSize({ width: 375, height: 812 })` explicitly (the mobile project is 390px; 375 requires explicit override — same pattern as `admin-mobile-pg8.spec.ts:43`).
6. The PG9 e2e tests assert structure (pill present, CTA present, no h-scroll) and honest state labels — NOT specific allowed/denied product states that depend on DB seeding unavailable in e2e demo mode.

---

## Risks

1. **Cabinet loader gathers activity unconditionally** — if the implementation fetches `listExchangeKeys` / `loadBotConfig` for all 6 products without first checking `d.allowed`, it leaks activity signals to denied users (information disclosure). The static source-guard test F-02 in `tests/integration/cabinet-pg9.test.ts` guards against this regression.
2. **`backendMode==='memory'` in e2e means most product cards show "Not owned"** — the enrichment layer (setup state, activity) will return empty/null for most products in e2e. Tests must not depend on specific entitlement state; assert structure only.
3. **Wizard form submit in e2e may flake** — posting the `addKeyAction` server action in a mobile e2e test can hit the Server-Action recompile race. The PG9 e2e plan avoids form submits (navigation + render assertions only) to keep the flake budget at the existing 1.
4. **Coverage regression** — each PG9 implementation adds app-layer code (apps/web, not counted by Vitest) to the denominator while packages/cabinet adds to the numerator. Historical pattern (PG7: -0.08%, PG8: -0.29%) suggests a small stmt% decline is expected and acceptable as long as branch% holds.
5. **`ProductCabinetCard` without a proper `aria` role/label on the status pill** — the `StatusPill` component renders `<i />` as a decorative dot with no `aria-label`; if blockers are surfaced only via the pill color on mobile (small viewport) this may be inaccessible. The implementation should include a text label, not rely on color alone.

---

## Verification / tests

All 5 gates run this session:
- `npm run lint` → PASS (exit 0)
- `npm run typecheck` → PASS (exit 0)  
- `npm run test` → PASS (441/8/449, 40 files)
- `npx playwright test` → PASS (36/1-flaky-green/1-skip)
- `npm run db:generate -w @wtc/db` → PASS (41 tables, No schema changes)

Priority coverage gaps identified (pre-PG9 baseline):
- **Entitlement state machine** — covered by `packages/entitlements/src/engine.test.ts` (11 tests): fail-closed, time transitions, bundle expansion, manual grant precedence. Adequate.
- **Crypto envelope vault** — covered by `packages/crypto/src/vault.test.ts` (5 tests): no-plaintext round-trip, wrong-AAD/tamper/unknown-keyId fail-closed, KEK rotation. Adequate.
- **RBAC matrix** — covered by `packages/auth/src/rbac.test.ts` (3 tests): `assertAdmin` pass/throw, matrix entitlement:manage admin-only. Thin but covers the guard used in every admin server action.
- **Analytics normalization** — covered by `packages/analytics/src/metrics.test.ts` (13 tests): closed vs unrealized PnL, drawdown (GAP-F zero-equity fix), netPnlWithFees, ROI, cross-bot aggregation, data stale detection. Adequate.
- **PG9 gap** — `deriveCabinetCard` (does not exist yet): 0 tests. This is the priority unit coverage gap for PG9.

---

## Next actions

1. (Implementation agent) Create `packages/cabinet/src/derive.ts` + `packages/cabinet/src/__tests__/derive.test.ts` (20+ unit tests covering the table above + fail-closed invariants U-FC-01 through U-FC-05).
2. (Implementation agent) Create `tests/integration/cabinet-pg9.test.ts` (8–10 static source-guard tests).
3. (Implementation agent) Create `tests/e2e/cabinet-pg9-mobile.spec.ts` (5 specs; mobile-project scoped; 375px explicit viewport; navigation-only, no form submits).
4. (ux-ui-designer) Add `.wtc-wizard` / `.wtc-wizard-step` / `.wtc-wizard-progress` CSS classes to `packages/ui/src/theme.css` and document in DESIGN_SYSTEM §14.
5. (ux-ui-designer) Design `ProductCabinetCard` in `packages/ui/src/components.tsx` with optional `setupLabel?`, `activityLabel?`, `blockers?: string[]` props, reusing `StatusPill` + `RiskWarningBanner` + `buttonClasses`.
6. (frontend-implementer) Enrich `apps/web/src/app/(app)/app/page.tsx` cabinet loader: call `deriveCabinetCard` per product AFTER entitlement check; gather per-product signals only when `d.allowed`.
7. (security-auditor) Verify no new plaintext secret field is introduced in the wizard form or the card data loader.
8. Confirm `npm run db:generate -w @wtc/db` = "No schema changes" after PG9 implementation (expected: 41 tables unchanged).
