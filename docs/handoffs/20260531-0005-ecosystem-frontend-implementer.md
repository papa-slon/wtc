# PG9 Read-Only Audit Handoff — ecosystem-frontend-implementer
**Epoch:** 20260531-0005  
**Phase:** 2.12 / Phase Group 9 — User Cabinet / Product UX  
**Agent:** ecosystem-frontend-implementer  
**Session rule:** Read-only audit. No code or doc files edited except this handoff.

---

## Scope

Per-product cabinet cards enrichment + mobile-first setup wizard design for `apps/web`.

Questions to answer:
1. Where does the pure per-product derivation logic live so it is unit-testable?
2. What is the server-side loader plan per product?
3. What is the full file map (SPINE vs DISJOINT)?
4. Is a migration needed?
5. What PG8 patterns can be reused?

---

## Files inspected

| File | Purpose |
|---|---|
| `docs/handoffs/0000-orchestrator-seed.md` | canonical decisions, hard rules |
| `docs/DESIGN_SYSTEM.md` | §14 pill taxonomy, §7.17 ProductStatusCard, §10 responsive |
| `docs/ROADMAP_MASTER.md §9` | PG9 deliverables |
| `docs/EXECUTION_PLAN_MASTER.md W10` | SPINE classification |
| `docs/PRODUCTION_BLOCKERS.md` | B2/B3/B4 honest surface requirements |
| `apps/web/src/app/(app)/app/page.tsx` | current cabinet overview (enrichment target) |
| `apps/web/src/app/(app)/app/layout.tsx` | MobileNav confirmed present |
| `apps/web/src/app/(app)/app/security/page.tsx` | flat exchange-key form (wizard starting point) |
| `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` | bot config form |
| `packages/ui/src/components.tsx` | ProductStatusCard props (lines 86–108) |
| `packages/ui/src/index.ts` | barrel exports |
| `packages/ui/src/theme.css` | `.wtc-table-wrap`, `.wtc-wizard` absent (lines 109–177) |
| `apps/web/src/lib/access.ts` | accessFor/reasonLabel/reasonTone |
| `apps/web/src/lib/backend.ts` | backendMode, getServerDb, listExchangeKeys, addExchangeKey |
| `apps/web/src/lib/product-status.ts` | PRODUCT_AVAILABILITY/AVAILABILITY_TONE/AVAILABILITY_LABEL |
| `apps/web/src/lib/nav.ts` | APP_NAV (no `/app/onboarding` exists yet) |
| `packages/entitlements/src/engine.ts` | AccessDecision, Entitlement shape |
| `packages/entitlements/src/registry.ts` | PRODUCT_CODES (6), PRODUCTS, PLANS |
| `apps/web/src/features/bots/config.ts` | loadBotConfig → BotConfigState |
| `apps/web/src/features/bots/meta.ts` | botHealthPill, BOT_CAPS, BotCapabilities |
| `apps/web/src/features/bots/data.tsx` | loadBot, BotAccessRequired |
| `apps/web/src/features/tv/queries.ts` | loadTvUserData → TvUserData |
| `apps/web/src/features/terminal/loader.ts` | loadTerminalRelease → TerminalLoaderResult |
| `apps/web/src/features/lms/queries.ts` | loadStudentCatalogue → StudentCatalogue |
| `apps/web/src/features/billing/timeline.ts` | loadUserTimeline → UserTimelineEntry |
| `packages/bot-adapters/src/types.ts` | BotHealth, ReadState, RiskWarning |
| `packages/bot-adapters/src/warnings.ts` | TORTILA_WARNINGS, BOT_CAPS |
| `packages/bot-adapters/src/factory.ts` | getBotAdapter |
| `tests/integration/admin-responsive.test.ts` | PG8 static-analysis guard pattern |

---

## Files changed

None — read-only audit.

---

## Findings

### F1 — HIGH — ProductStatusCard props are too thin for PG9 enrichment
**Evidence:** `packages/ui/src/components.tsx:86–108`  
The current component accepts only: `{name, description, allowed, reason, statusLabel, href, ctaLabel}`. PG9 requires surfacing setup state, recent activity, next action, and blockers. The card has no slots for these. The component **must be extended** (or a richer variant created), or the page-level composition must render additional sub-elements beneath each card. Extending the shared `ProductStatusCard` in `packages/ui` is a SPINE edit (single-writer). The alternative — a `CabinetProductCard` wrapper in `features/cabinet/` that composes `ProductStatusCard` + additional rows — keeps the UI package minimal and avoids a SPINE write.

**Recommendation:** Create `apps/web/src/features/cabinet/CabinetProductCard.tsx` that wraps existing `ProductStatusCard` and renders enriched rows beneath it. This is a DISJOINT file and requires no SPINE touch.

---

### F2 — HIGH — Pure derivation logic location: `packages/*` vs `features/cabinet/`
**Evidence:** `vitest.config.ts` excludes `apps/web/**`; `tests/integration/admin-responsive.test.ts` (PG8 pattern) uses `readFileSync` for static source guards as the substitute for app-layer Vitest.

The per-product `{entitlement, setup, activity, nextAction, blockers}` derivation is pure: it takes already-fetched inputs (AccessDecision, BotConfigState, TvUserData, StudentCatalogue, TerminalLoaderResult, boolean flags from BOT_CAPS, backendMode, PRODUCT_AVAILABILITY) and returns a serializable view-model. This is testable as a pure function.

**Two options:**

Option A — New package `@wtc/cabinet` (zero deps on server-only code, takes POJOs):  
- Real Vitest unit coverage (not static-only).  
- The function would need ALL its input types duplicated or re-imported — those types live in `apps/web` server-only modules (`BotConfigState`, `TvUserData`, etc.). Moving those types into the package would require extracting them, which cascades into a SPINE edit of `features/*` files.  
- The package would only be consumed by one surface (the cabinet loader) — low reuse value.

Option B — `apps/web/src/features/cabinet/` module with a static source-analysis guard test (the PG8 pattern):  
- `features/cabinet/deriver.ts` holds the pure derivation function with no imports of React or `server-only`.  
- `tests/integration/cabinet-deriver.test.ts` loads it via a `require`/`import` (or the static readFileSync pattern) and asserts structural invariants.  
- Actually, because `deriver.ts` would import types from `apps/web` features (BotConfigState etc.), it cannot be a clean package anyway.

**Recommendation (F2):** Use Option B — `apps/web/src/features/cabinet/deriver.ts` as a pure TypeScript module (no `'use server'`, no `'server-only'`, no React imports). Add `tests/integration/cabinet-deriver-guard.test.ts` that reads the file source and asserts the derivation function is present and returns the canonical shape keys. This follows the proven PG8 static-guard pattern and keeps all type dependencies co-located.

**Function signature:**

```typescript
// apps/web/src/features/cabinet/deriver.ts
// No 'server-only' import — pure TS, no React, testable in isolation.

import type { AccessDecision, Entitlement } from '@wtc/entitlements';
import type { BotConfigState } from '@/features/bots/config';
import type { TvUserData } from '@/features/tv/queries';
import type { StudentCatalogue } from '@/features/lms/queries';
import type { TerminalLoaderResult } from '@/features/terminal/loader';
import type { UserTimelineEntry } from '@/features/billing/timeline';
import type { BotCapabilities } from '@/features/bots/meta';
import type { Availability } from '@/lib/product-status';

export type SetupState =
  | 'complete'       // all required setup done
  | 'needs_key'      // no exchange key for bot products
  | 'needs_config'   // key present but no bot config saved
  | 'needs_username' // no TV username
  | 'not_applicable' // setup concept doesn't apply (club/education/terminal)
  | 'unavailable';   // demo mode: cannot determine setup state

export type BlockerRef = 'B2' | 'B3' | 'B4' | 'demo';

export interface ProductCardViewModel {
  productCode: string;
  entitlementAllowed: boolean;
  entitlementReason: string;
  entitlementStatus: string;
  /** epoch-ms of currentPeriodEnd/expiresAt/graceUntil from the entitlement, if present */
  expiresAt: number | null;
  setupState: SetupState;
  /** short human label for the setup state — never fabricated in demo mode */
  setupLabel: string;
  /** up to 1 recent activity summary line */
  recentActivity: string | null;
  /** the single most-actionable next action label */
  nextAction: string;
  /** href for the nextAction CTA */
  nextActionHref: string;
  /** blockers that honestly suppress a CTA or degrade the card */
  blockers: BlockerRef[];
  /** is the product running in demo/mock mode (backendMode==='memory' or adapter==='mock') */
  isDemo: boolean;
  availability: Availability;
}

export function deriveProductCard(
  productCode: string,
  decision: AccessDecision,
  opts: {
    backendMode: 'postgres' | 'memory';
    availability: Availability;
    /** required only for tortila_bot and legacy_bot */
    botConfig?: BotConfigState;
    botCaps?: BotCapabilities;
    hasExchangeKey?: boolean;
    /** required only for tradingview_indicators */
    tvData?: TvUserData;
    /** required only for education */
    lmsCatalogue?: StudentCatalogue;
    /** required only for axioma_terminal */
    terminalData?: TerminalLoaderResult;
    /** most recent timeline entry for "recent activity" */
    latestTimelineEntry?: UserTimelineEntry | null;
  },
): ProductCardViewModel
```

---

### F3 — HIGH — Loader plan: one server-side loader orchestrates all inputs per product
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:29` uses `Promise.all` over `accessFor`; `apps/web/src/lib/backend.ts:36` exposes `backendMode`.

**Recommendation:** Create `apps/web/src/features/cabinet/loader.ts` (server-only). It:
1. Calls `accessFor` for all 6 product codes (already parallelised in the page).
2. For each product where `decision.allowed` OR `availability !== 'planned'`, fetches the minimal setup/activity signal — gated on `backendMode` to avoid fabricating data in demo mode.
3. Passes all inputs to `deriveProductCard` from `deriver.ts`.
4. Returns `ProductCardViewModel[]` — the page renders it without any conditional data fetching.

**Per-product signal map:**

| Product | Setup signal | Activity signal | Demo behaviour |
|---|---|---|---|
| `tortila_bot` | `listExchangeKeys(userId)` (has key?), `loadBotConfig(userId, 'tortila_bot')` (version !== null?) | `loadBotConfig().safety` length or `latestTimelineEntry` | In-memory: `hasExchangeKey=false`, `botConfig.mode='demo'`, `setupState='unavailable'` |
| `legacy_bot` | `listExchangeKeys(userId)`, `loadBotConfig(userId, 'legacy_bot')` | same | same; additionally `blockers=['B3']` always (BOT_CAPS.liveAdapterBlocked) |
| `axioma_terminal` | `loadTerminalRelease()` (release !== null, jwksConfigured) | `latestTimelineEntry` | `setupState='not_applicable'`; `blockers=['B4']` always (CTAs disabled) |
| `tradingview_indicators` | `loadTvUserData(userId)` (profile !== null) | most recent grant or request | demo: `tvData={mode:'demo', profile:null, ...}`, `setupState='needs_username'` (not fabricated — simply absent) |
| `education` | `loadStudentCatalogue(userId, allowed)` | course count / progressPct | demo: `courses=[]`, `setupState='not_applicable'` |
| `club` | none (access flag only) | none | `setupState='not_applicable'` always |

All loaders are already `'server-only'` and return an explicit `mode: 'postgres' | 'demo'` field. The cabinet loader propagates that flag into `isDemo` on the view-model — never fabricating data.

---

### F4 — MEDIUM — Setup wizard route: extend `/app/security` flat form vs add `/app/bots/[bot]/setup`
**Evidence:** `apps/web/src/app/(app)/app/security/page.tsx` — existing flat form; `apps/web/src/lib/nav.ts:8–18` — no `/app/onboarding` entry.

The flat `/app/security` form handles key vault. A guided onboarding wizard for bot users (Step 1: Add exchange key → Step 2: Set symbols/risk/TP → Step 3: Confirm demo mode) needs multi-step state but can be server-rendered in Next.js App Router as a step-by-URL pattern.

**Recommendation:**

- Keep `/app/security` as the flat exchange-key form (unchanged, SPINE file).
- Add `/app/bots/[bot]/setup/page.tsx` as the guided wizard entry point. This is a DISJOINT file (new route within the existing `bots/[bot]/` tree). It renders as a sequence of UI cards using `.wtc-wizard` / `.wtc-step` CSS classes (see F5).
- The wizard steps are encoded as a `step` query param (`?step=1`, `?step=2`, `?step=3`) — no client state, fully server-rendered, works without JS.
- The nav item for "Setup" appears only as a contextual CTA from the cabinet card's `nextAction`, not as a permanent nav link.
- No `/app/onboarding` top-level route needed; product-specific setup lives under the product route.

---

### F5 — MEDIUM — Missing `.wtc-wizard` / `.wtc-step` CSS classes
**Evidence:** `packages/ui/src/theme.css` line count = 199; no `.wtc-wizard` or `.wtc-step` class exists (confirmed by full read).

The wizard step UI needs a distinct visual treatment (step indicator, progress dots, step-number prefix). Without CSS classes it must use inline styles — which is fragile and inconsistent.

**Recommendation:** Add `.wtc-wizard` and `.wtc-step` to `packages/ui/src/theme.css`. This is a SPINE edit (single-writer). The classes needed:

```css
/* Wizard step container: vertical stack of numbered sections */
.wtc-wizard { display: flex; flex-direction: column; gap: 16px; }
/* Individual step: a card with a numbered label */
.wtc-step { border: 1px solid var(--stroke); border-radius: var(--radius); padding: 20px 22px; }
.wtc-step-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.wtc-step-num { width: 28px; height: 28px; border-radius: 50%; background: rgba(213,169,79,0.12);
  border: 1px solid var(--stroke-gold); color: var(--gold2); font-size: 12px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.wtc-step-num.done { background: rgba(84,214,161,0.12); border-color: rgba(84,214,161,0.32);
  color: var(--green); }
.wtc-step-num.active { box-shadow: 0 0 14px rgba(213,169,79,0.2); }
```

These classes affect no existing components (no regression risk). The edit is 12 CSS lines.

---

### F6 — MEDIUM — `ProductStatusCard` CTA is `<a>` only; wizard CTA needs a route link not a form
**Evidence:** `packages/ui/src/components.tsx:103` — `<a className={buttonClasses(...)} href={props.href}>`.

The existing card renders a single `<a>` link. The wizard CTA and "Setup needed" next-action CTA are also links (not form submissions), so this pattern is compatible. No component change needed for the basic wizard CTA — only the route must exist.

---

### F7 — LOW — `club` product: no cheap setup or activity signal
**Evidence:** `apps/web/src/features/billing/timeline.ts` is the only available signal; no `club`-specific repo or service exists.

The club product has `status: 'planned'` in `PRODUCT_AVAILABILITY`. There is no club-specific setup concept (no exchange key, no TV username, no config). The only available signal is the entitlement state itself.

**Recommendation:** `deriveProductCard` for `club` always returns `setupState: 'not_applicable'` and `recentActivity: null`. The card shows entitlement status only. This is an honest limitation — it must be labelled as such, never fabricated.

---

### F8 — LOW — `axioma_terminal` CTAs remain disabled (B4); card must not render enabled download/journal CTAs
**Evidence:** `docs/PRODUCTION_BLOCKERS.md B4` — all three Axioma CTAs are disabled dev-placeholders; `apps/web/src/features/terminal/loader.ts:93` checks `process.env.AXIOMA_HANDOFF_SIGNING_KEY` presence.

**Recommendation:** `deriveProductCard` for `axioma_terminal` must set `blockers: ['B4']` unconditionally (regardless of `jwksConfigured`). The cabinet card renders the terminal product with a disabled "Manage" CTA and an honest `StatusPill` labelled "CTAs disabled (B4)". This mirrors how the admin console surfaces the B3 banner — data-driven, not hardcoded in JSX.

---

### F9 — LOW — backendMode demo note must appear on every product card in memory mode
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:29–66` — current overview renders no demo notice per-card.

**Recommendation:** `CabinetProductCard` renders a `StatusPill tone="warn"` with label `"demo data"` (following the PG8 canonical pill taxonomy) whenever `viewModel.isDemo === true`. The existing topbar already shows the global `demo data (in-memory)` pill (`apps/web/src/app/(app)/app/layout.tsx:33`) — the per-card version is a narrower, product-level signal (e.g. "bot config not persisted"). Never suppress it.

---

## Decisions

1. **Pure derivation in `apps/web/src/features/cabinet/deriver.ts`** (Option B, not a new package). The file has no `'server-only'`, no React imports, and is covered by a static source-analysis guard test at `tests/integration/cabinet-deriver-guard.test.ts` using the PG8 `readFileSync` pattern. A new `@wtc/cabinet` package would require extracting server-only types (BotConfigState etc.) into a shared package, causing cascading SPINE edits — not justified for a single-consumer pure function.

2. **Server-side cabinet loader** at `apps/web/src/features/cabinet/loader.ts` (server-only). It fans out all product data fetches in a single `Promise.all` call, then maps each result through `deriveProductCard`. The page (`apps/web/src/app/(app)/app/page.tsx`) calls the loader once and renders `CabinetProductCard` for each view-model.

3. **Wizard route** at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` (new DISJOINT file). Steps encoded as `?step=N` query param. No top-level `/app/onboarding` route added — product-specific setup lives under the product.

4. **`migrationNeeded: false`** — all required signals (exchange keys, bot config versions, TV profile/grants, LMS enrollments/progress, terminal release, billing timeline) are served by existing repos on the 41-table schema. No new column or table is required for PG9 cabinet enrichment.

5. **`packages/ui/src/theme.css` wizard CSS** is the only SPINE file touched. The 12-line addition of `.wtc-wizard`, `.wtc-step`, `.wtc-step-header`, `.wtc-step-num` classes. All other PG9 files are DISJOINT.

6. **`ProductStatusCard` in `packages/ui` is NOT extended.** A DISJOINT `CabinetProductCard` wrapper in `features/cabinet/` composes the existing card with enriched sub-rows. This avoids a SPINE write to `packages/ui/src/components.tsx`.

7. **MobileNav in app layout already present** (`apps/web/src/app/(app)/app/layout.tsx:42`). No mobile-nav gap to fix in the `(app)` route group — unlike PG8's admin fix.

8. **`.wtc-table-wrap` is NOT needed on the cabinet overview.** PG9 adds cards, not tables, to `/app/page.tsx`. The `.wtc-table-wrap` pattern applies only if a table appears (e.g. a key-vault summary table inside the wizard). Use it there with `data-label` attributes if a table is introduced.

---

## File Map

### SPINE files (single-writer; serialize all edits)

| File | Change | Writer |
|---|---|---|
| `packages/ui/src/theme.css` | Add `.wtc-wizard`, `.wtc-step`, `.wtc-step-header`, `.wtc-step-num` CSS classes (~12 lines) | ecosystem-frontend-implementer only |
| `apps/web/src/lib/nav.ts` | No change needed (wizard is a product sub-route, not a top-level nav item) | — |
| `apps/web/src/lib/product-status.ts` | No change needed | — |

### DISJOINT files (new; parallel-safe)

| File | Type | Purpose |
|---|---|---|
| `apps/web/src/features/cabinet/deriver.ts` | NEW | Pure view-model derivation; no server-only; no React |
| `apps/web/src/features/cabinet/loader.ts` | NEW | Server-only orchestrator: fetches all product signals in parallel, maps through deriver |
| `apps/web/src/features/cabinet/CabinetProductCard.tsx` | NEW | RSC wrapper composing ProductStatusCard + enriched rows (setup, activity, next action, blockers) |
| `apps/web/src/features/cabinet/types.ts` | NEW | Re-exports ProductCardViewModel, SetupState, BlockerRef from deriver |
| `apps/web/src/app/(app)/app/page.tsx` | EDIT (enrich) | Replace bare ProductStatusCard loop with CabinetProductCard loop using loader output |
| `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` | NEW | Guided wizard: Step 1 (exchange key) → Step 2 (bot config) → Step 3 (confirm) |
| `tests/integration/cabinet-deriver-guard.test.ts` | NEW | Static source-analysis guard: asserts deriver exports `deriveProductCard`, has no React/server-only imports, returns canonical keys |

### Reuse map

| Component/utility | Reused as-is | Notes |
|---|---|---|
| `ProductStatusCard` from `@wtc/ui` | Yes | Wrapped inside `CabinetProductCard`, not replaced |
| `MobileNav` | Yes (already in `(app)` layout) | No gap — confirmed present |
| `.wtc-table-wrap` + `data-label` | Conditional | Use in wizard if a table (key list) is rendered |
| `StatusPill` (ok/warn/bad/neutral) | Yes | Entitlement pill + demo pill + blocker pill per card |
| `RiskWarningBanner` | Yes | Tortila P0/P1 warnings surfaced at card level (compact) |
| `EmptyState` | Yes | Empty state for products with no setup data yet |
| `Card` | Yes | Wizard step container |
| `backendMode` from `@/lib/backend` | Yes | Drives `isDemo` flag in deriver |
| `accessFor` / `reasonLabel` / `reasonTone` from `@/lib/access` | Yes | Entitlement decision |
| `PRODUCT_AVAILABILITY` from `@/lib/product-status` | Yes | Demo/planned/available label per product |
| `BOT_CAPS` from `@/features/bots/meta` | Yes | `liveAdapterBlocked` → `blockers: ['B3']` for legacy |
| `loadBotConfig` | Yes | Setup state for bots |
| `listExchangeKeys` | Yes | Whether user has a key (has-key check only, never exposing masked value in cabinet card) |
| `loadTvUserData` | Yes | TV setup state |
| `loadStudentCatalogue` | Yes | LMS activity signal |
| `loadTerminalRelease` | Yes | Axioma setup/activity signal |
| `loadUserTimeline` | Yes | Recent activity for billing-driven products |

---

## Risks

1. **SPINE contention on `theme.css`** — if PG10 or PG12 also touch `theme.css` concurrently (not a git repo), the last writer wins. The wizard CSS addition is small (12 lines, bottom of file) — serialise after any other PG9 SPINE edits.

2. **`Promise.all` in cabinet loader may slow the overview page** — the current page calls `accessFor` × 6 already. Adding `listExchangeKeys` (1 query), `loadBotConfig` × 2 (up to 4 queries each in postgres), `loadTvUserData` (3 queries), `loadStudentCatalogue` (N courses × 2 queries), `loadTerminalRelease` (1 query), `loadUserTimeline` × 6 (1 query each) could be 20–30 DB round-trips. Mitigation: gate each per-product fetch on `decision.allowed` (unentitled products skip setup/activity fetch — only the access decision is needed). This reduces typical load to 2–4 product fetches per user.

3. **Demo mode fabrication risk** — `loadStudentCatalogue` in demo returns `courses: []` (correctly). `loadBotConfig` in demo returns `mode: 'demo', current: null`. `loadTvUserData` in demo returns `profile: null`. All return honest empty/null values. The deriver must propagate `isDemo: true` and show `setupState: 'unavailable'` (never "Setup complete") whenever `backendMode === 'memory'`.

4. **`axioma_terminal` B4 honest surface** — the terminal page already has disabled CTAs; the cabinet card must mirror that state. Risk: a future implementer adds an enabled CTA to the card before B4 is cleared. Mitigation: `deriveProductCard` hard-codes `blockers: ['B4']` for `axioma_terminal` (not conditional on any env var) until B4 clears. The static guard test asserts this.

5. **Wizard step encoding as query param** — if Next.js caches the `/app/bots/[bot]/setup` page at the CDN level, step state may bleed across users. Mitigation: the wizard page uses `export const dynamic = 'force-dynamic'` (already the pattern for all auth-gated pages in the `(app)` route group).

---

## Verification/tests

### Unit coverage (Vitest, via packages/*)

None for this feature — `deriver.ts` lives in `apps/web/` which is excluded from Vitest. The PG8 static-guard pattern is the substitute.

### Static source-analysis guard (new Vitest test, `tests/integration/`)

`tests/integration/cabinet-deriver-guard.test.ts`:
- Reads `apps/web/src/features/cabinet/deriver.ts` source.
- Asserts `deriveProductCard` is exported.
- Asserts the file does NOT contain `'server-only'` or `React` imports (pure TS invariant).
- Asserts the return type comment or variable names include all canonical keys: `entitlementAllowed`, `setupState`, `nextAction`, `blockers`, `isDemo`.
- Asserts `blockers` is typed to include `'B4'` for `axioma_terminal` (static string-match).

`tests/integration/cabinet-loader-guard.test.ts`:
- Reads `apps/web/src/features/cabinet/loader.ts` source.
- Asserts `'server-only'` import present.
- Asserts `Promise.all` used (parallel fetch pattern).
- Asserts `deriveProductCard` called.

### Playwright e2e (additions to existing suite)

`tests/e2e/cabinet-pg9.spec.ts`:
- Desktop (1280px): `/app` renders 6 product cards, each with a StatusPill, a next-action CTA, and a setup state label.
- Mobile (390px): product cards stack single-column; no horizontal scroll; MobileNav visible.
- Unentitled product: card shows "Not owned" pill and "Get access" CTA; no operational data rows.
- Demo mode: each card shows "demo data" pill; no `$0.00` or `0.00` fabricated values.
- Tortila P0 notice: cabinet overview surfaces at least 1 RiskWarningBanner for `tp_reconcile_p0` when tortila is entitled (backendMode memory + mock adapter).

`tests/e2e/wizard-pg9.spec.ts`:
- `/app/bots/tortila/setup?step=1`: renders step 1 (exchange key form).
- `/app/bots/tortila/setup?step=2`: without a key (demo), redirects to step 1 or shows "complete step 1 first".
- Mobile (390px): wizard steps stack single-column; form inputs have 44px min-height (touch targets).

### Gates

The PG8 baseline (test 441/8/449, cov 26.83/74.32, e2e 36/1-flaky/1-skip, build 35.2 kB middleware) must remain green after PG9 implementation. The new static guard tests add to the integration suite; the e2e suite grows by 2 spec files. No migration → `db:generate` output unchanged.

---

## Next actions

1. **DB architect confirmation** (required first): confirm `migrationNeeded: false`. All signals are queryable from the 41-table schema. No action needed unless a new signal is identified.

2. **SPINE write: `packages/ui/src/theme.css`** — add `.wtc-wizard` / `.wtc-step` CSS (12 lines). Single-writer. Serialise before other PG9 theme changes.

3. **Create `apps/web/src/features/cabinet/deriver.ts`** — pure `deriveProductCard` function with the signature in F2.

4. **Create `apps/web/src/features/cabinet/loader.ts`** — server-only, fan-out fetcher, maps through `deriveProductCard`.

5. **Create `apps/web/src/features/cabinet/CabinetProductCard.tsx`** — RSC wrapping `ProductStatusCard` + enriched rows.

6. **Enrich `apps/web/src/app/(app)/app/page.tsx`** — replace bare card loop with `CabinetProductCard` consuming loader output. Keep `SectionHeader`, `RiskWarningBanner` (Tortila notices), and the summary metric cards.

7. **Create `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`** — 3-step guided wizard (key → config → confirm). Mark `export const dynamic = 'force-dynamic'`.

8. **Add static guard tests** — `tests/integration/cabinet-deriver-guard.test.ts` + `tests/integration/cabinet-loader-guard.test.ts`.

9. **Add Playwright specs** — `tests/e2e/cabinet-pg9.spec.ts` + `tests/e2e/wizard-pg9.spec.ts`.

10. **Run full gates** (governance/check:core/lint/typecheck/test/coverage/build/e2e) and record results against PG8 baseline.

11. **Write PG9 aggregate handoff** citing this file + any implementation-agent handoffs.
