# BOT #2 Dashboard Integration Plan

> **Status:** Planning only. No source files were modified to produce this document.
> **Author context:** Read-only exploration of `wtc_ecosystem_platform` (Next.js App Router monorepo).
> **Coordination constraint:** A parallel agent is redesigning the **Tortila** page right now
> (`apps/web/src/app/(app)/app/bots/[bot]/page.tsx`, `features/bots/tortila-overview/*`, possibly
> `packages/ui`). This plan treats the post-redesign Tortila overview as the **gold-standard premium
> template** and says "replicate it for bot #2" rather than inventing a parallel design. Every
> shared/conflict-prone file is called out in §3 + §7 so the build is sequenced **after** Tortila lands.

---

## 0. TL;DR architectural finding

The ecosystem is **structurally multi-bot but type-level two-bot-hardcoded.**

- **Structurally multi-bot:** the bot dashboard is already a **dynamic route** —
  `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — driven by a slug→meta `MAP` (page.tsx:32-35) and
  a central `BOT_LIST` registry (`apps/web/src/features/bots/meta.ts:20-23`). Adding a bot is mostly
  *data*, not new route files.
- **Hard-capped at two products:** the union type
  `BotProductCode = 'tortila_bot' | 'legacy_bot'` (`packages/bot-adapters/src/types.ts:7`) and the
  product registry `PRODUCT_CODES` (`packages/entitlements/src/registry.ts:6-13`) enumerate a *closed*
  set. A genuinely new third bot requires touching these enums (a typed, compiler-enforced change that
  ripples through `data.tsx`, `meta.ts`, `factory.ts`, `warnings.ts`). The **second bot alongside
  Tortila already exists as `legacy_bot`** — today it renders a *basic* dashboard branch
  (page.tsx:283-347), not the premium `TortilaOverview`. See §1 for which of the two readings applies.

---

## 1. Routing decision

### What exists today
- App Router group: `(app)` → segment `app` → `bots`.
- Bot **index / list page**: `apps/web/src/app/(app)/app/bots/page.tsx` — renders a card per
  `BOT_LIST` entry (the "Two-bot finish board" + combined portfolio).
- Bot **detail page** (the dashboard): `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — **already a
  dynamic `[bot]` route.** It resolves the slug via a local `MAP` (page.tsx:32-35) and `notFound()`s on
  an unknown slug. Inside, it branches on `meta.code`:
  - `tortila_bot` → renders the premium `<TortilaOverview/>` (page.tsx:255-281).
  - `legacy_bot` → renders a basic metrics/positions/trades block (page.tsx:283-347).
- Bot **sub-pages** (already dynamic, already multi-bot):
  `[bot]/journal`, `[bot]/positions`, `[bot]/trades`, `[bot]/equity`, `[bot]/safety`,
  `[bot]/settings`, `[bot]/setup`, `[bot]/backtester`. Tab strip = `components/BotSubNav.tsx`.
- Sidebar nav (`apps/web/src/lib/nav.ts:8-18`, rendered by `(app)/app/layout.tsx`) has a **single
  `/app/bots` entry** — it does **not** enumerate individual bots, so the left nav needs **no change**
  for bot #2.

### Recommendation
**Do NOT add a sibling static route. Reuse the existing `[bot]` dynamic route. The cleanest path is to
promote bot #2 into the premium template by generalising the `tortila_bot` branch — not by copying
`page.tsx`.**

Two concrete sub-cases — confirm which one the project means by "second bot" (Open Question Q1):

| Reading | What "bot #2" is | Route action | Enum action |
|---|---|---|---|
| **A (most likely)** | Upgrade the **existing `legacy_bot`** to the premium overview | None — slug `legacy` already routes | None — `legacy_bot` already in all enums |
| **B** | A **brand-new 3rd product** (e.g. `oldbot`) | Add 1 row to `MAP` (page.tsx) + 1 row to `BOT_LIST` (meta.ts) | Add to `BotProductCode` + `PRODUCT_CODES` + caps + warnings |

Either way the **page file is shared** with the Tortila redesign → sequence after it (§7).

**Why not a sibling `bots/oldbot/page.tsx`:** Next.js App Router does **not allow** a static segment and
a dynamic `[bot]` segment to coexist at the same level if the static one collides with a slug the
dynamic route also serves; more importantly it would **fork** the premium template (duplicating the
~430-line page, the readiness panels, the continuity/runtime-evidence panels, the access gate), which
directly violates the "replicate, don't fork" mandate and guarantees drift from the gold standard.

---

## 2. Bot adapter pattern (how data is fed)

There are **two distinct adapter layers**. Bot #2 must satisfy whichever the chosen data path uses.

### 2a. Canonical `BotAdapter` interface (worker + base dashboard)
`packages/bot-adapters/src/types.ts:73-93`. Every bot implements this; it produces the **canonical**
types from `@wtc/analytics` (`CanonicalMetrics`, `CanonicalPosition`, `CanonicalTrade`, `EquityPoint`).
Selected by `getBotAdapter(productCode, opts)` in `packages/bot-adapters/src/factory.ts:27-40`.
Methods: `getHealth`, `getWarnings`, `getConfig`, `getMetrics`, `getPositions`, `getTrades`,
`getEquityCurve?` (optional), `validateConfig`, plus permanently-disabled `startBot/stopBot/applyConfig`.

Real implementations are **HTTP GET-only** (`packages/bot-adapters/src/http.ts`) and never fabricate
data — unconfirmed shapes throw `AdapterNotReadyError`. The Tortila real adapter
(`createHttpTortilaAdapter`, http.ts:90) reads `/api/health`, `/api/summary`, `/api/trades/list`,
`/api/equity`. The Legacy real adapter is **deliberately blocked** (`createLegacyBlockedAdapter`,
factory.ts:39; http.ts:280-287) because the legacy `/api_management/` endpoint leaks plaintext keys —
so legacy production data comes from **worker DB snapshots**, not a live HTTP adapter.

### 2b. Extended `TortilaJournalReader` (premium overview ONLY)
`packages/bot-adapters/src/tortila/tortila-journal-reader.ts:49-61`. This is the pattern that powers
the *premium* dashboard and is the one bot #2 most needs to replicate. It is a **standalone reader
deliberately kept off the `BotAdapter` interface** (so the worker pipeline is untouched). 8 read-only
GET methods, each returning `T | { error: string }` (never throws, never fabricates):
`getAdvanced`, `getSymbolBreakdown`, `getMonthly`, `getCalendar`, `getDistribution`,
`getDrawdownSeries`, `getMarks`, `getActivity`. Endpoints + Zod schemas live in
`tortila/tortila.extended.schemas.ts`. The web layer wraps it in `loadTortilaOverviewPayload()`
(`apps/web/src/features/bots/tortila-overview-data.ts`).

### What bot #2 needs to expose
To get the **same premium dashboard**, bot #2's journal/API must serve an equivalent of the extended
endpoints **OR** bot #2 provides a thin adapter that maps its native data into the same TS return
types. See §4 for the exact interface. The two paths are parameterised at the **data seam** in §5.

---

## 3. Shared UI & data components

### Chart library — IMPORTANT
**There is NO third-party chart library.** No recharts / Chart.js / visx. Every chart is **hand-rolled
inline SVG** in `apps/web/src/features/bots/tortila-overview/`:
- `equity-chart.tsx` → `EquityChart` + `DrawdownChart` (SVG path/area, manual ticks).
- `distribution-chart.tsx`, `monthly-bars.tsx`, `symbol-bars.tsx`, `calendar-heatmap.tsx`,
  `sparkline.tsx`.

→ Bot #2 reuses these components **as-is** by feeding them plain number arrays. No new dependency.

### `packages/ui` (shared, cross-product) — `packages/ui/src/index.ts`
Reusable now: `Card`, `SectionHeader`, `StatusPill`, `MetricCard`, `MetricValue`,
`RiskWarningBanner`, `EmptyState`, `ProductStatusCard`, `buttonClasses`, `cn`, `Tone`,
`tokens`, `chartColors`. These are product-agnostic and **bot #2 uses them directly with no change.**

### New premium components the Tortila redesign will (re)produce — bot #2 should reuse
Everything under `apps/web/src/features/bots/tortila-overview/`:
`index.tsx` (the `TortilaOverview` composition: Hero, PerformanceOverview, RiskPanel, equity card,
positions grid, symbol contribution, monthly, calendar, distribution, trade table, activity feed,
costs band), plus `auto-refresh.tsx`, `position-card.tsx`, `activity-feed.tsx`, `format.ts`, and the
charts above.

### Premium CSS lives in the global stylesheet — SHARED, conflict-prone
All `tov-*` classes (hero, KPI, grid, trade-table, feed, mini-cards, calendar legend, costs) are in
**`apps/web/src/app/globals.css`** (27 `tov-*`/`tortila-overview` blocks confirmed). There is **no
co-located CSS module.** If the Tortila redesign restyles `tov-*`, bot #2 inherits it automatically —
**but** if bot #2 needs its own accent (e.g. a different chip color), that edit also lands in
`globals.css` → **must be sequenced after the redesign** to avoid clobbering.

---

## 4. Adapter spec — the interface bot #2 must implement

Bot #2 should reuse the canonical `BotAdapter` (§2a) for the base reads **and** provide an extended
reader mirroring `TortilaJournalReader` (§2b) for the premium sections. The cleanest, lowest-coupling
implementation is to **generalise the existing Tortila reader into a shared journal reader** the new
bot also constructs, since the extended schemas are already generic JSON shapes (period returns,
symbol rows, monthly rows, calendar days, distribution bins, drawdown series, marks, activity).

### 4a. Base (canonical) — already defined, do not change
```ts
// packages/bot-adapters/src/types.ts:73
interface BotAdapter {
  productCode: BotProductCode;            // must include bot #2's code
  mode: 'mock' | 'real';
  getHealth(): Promise<BotHealth>;        // NEVER throws; returns readState ok|not_configured|unreachable|malformed|stale
  getWarnings(): Promise<RiskWarning[]>;
  getConfig(instanceId): Promise<BotConfigView>;
  getMetrics(instanceId): Promise<CanonicalMetrics>;     // from @wtc/analytics
  getPositions(instanceId): Promise<CanonicalPosition[]>;
  getTrades(instanceId): Promise<CanonicalTrade[]>;
  getEquityCurve?(instanceId): Promise<EquityPoint[]>;   // optional; render via filterZeroEquity
  validateConfig(input): Promise<ValidationResult>;
  startBot/stopBot/applyConfig: Promise<never>;          // MUST stay disabled
}
```

### 4b. Extended (premium overview) — replicate `TortilaJournalReader`
Target return types (all already exported from `@wtc/bot-adapters`; reuse verbatim or as a generic
`BotJournalReader`):
```ts
interface Bot2JournalReader {          // mirror of TortilaJournalReader (tortila-journal-reader.ts:49)
  readonly baseUrl: string;
  readonly hasToken: boolean;
  getAdvanced():        Promise<Result<TortilaAdvancedMetrics>>;   // performance/trades/drawdown/best_day/worst_day
  getSymbolBreakdown(): Promise<Result<TortilaSymbolBreakdown>>;   // { rows: SymbolBreakdownRow[] }
  getMonthly():         Promise<Result<TortilaMonthly>>;           // { rows: MonthlyRow[] }
  getCalendar(weeks?):  Promise<Result<TortilaCalendar>>;          // { start,end,days[],max_abs }
  getDistribution(bins?): Promise<Result<TortilaDistribution>>;    // { edges[],counts[],wins,losses }
  getDrawdownSeries():  Promise<Result<TortilaDrawdownSeries>>;    // { ts[],dd_pct[],peak[] }
  getMarks():           Promise<Result<TortilaMarks>>;             // { ts,ttl_sec,marks{},stale }
  getActivity(limit?):  Promise<Result<TortilaActivity>>;          // { rows: ActivityItem[] }
}
// Result<T> = T | { error: string }   — methods NEVER throw, NEVER fabricate on failure.
```
Exact field shapes: `packages/bot-adapters/src/tortila/tortila.extended.schemas.ts`. If bot #2's data
differs, define `bot2.extended.schemas.ts` with the same *output* TS types so the overview components
need zero changes.

### 4c. The props contract the dashboard consumes (the real target)
The premium component takes `TortilaOverviewProps`
(`features/bots/tortila-overview/index.tsx:38-64`): `metrics`, `positions`, `trades`, `equityCurve`,
`payload` (the 8 extended slices), `mode`, `atAth`, `startDateIso`, `todayPnl`, `pnlPctSinceStart`,
`feesTotal`, `fundingTotal`, `netPnl`. **If bot #2 yields these, it gets the gold-standard page for
free.** Recommended: rename/generalise `TortilaOverview` → `BotOverview` during the build (a SHARED
edit — sequence after redesign).

---

## 5. Data-source plumbing + the "PLUG DATA SOURCE HERE" seam

How Tortila gets its data today (server components, no React Query on the page — RSC `await`):
1. `[bot]/page.tsx:121-130` runs `Promise.all([...])`:
   - `loadBotReadModelForUser(userId, code, parts)` → `features/bots/data.tsx:734`. In non-mock/prod
     this reads **WTC Postgres worker snapshots** (`loadDbBotReadModelForUser`, data.tsx:421); in mock
     it reads the mock adapter (`loadAdapterBotReadModel`, data.tsx:697). Returns canonical
     metrics/positions/trades/equity/config/warnings.
   - `loadBotConfig(...)` (reference config).
   - `loadTortilaOverviewPayload()` → `features/bots/tortila-overview-data.ts:58` → constructs
     `createTortilaJournalReader(baseUrl, token)` and fans out the 8 extended GETs. Token from
     `botAdapterOptions()` (`lib/server-config.ts:10-19`): `TORTILA_JOURNAL_URL` + `JOURNAL_READ_TOKEN`.
2. Client auto-refresh (`auto-refresh.tsx`) re-polls the **session-gated proxy**
   `apps/web/src/app/api/bots/tortila/overview/route.ts` (note: a **static** path, not `[bot]`), which
   re-calls `loadTortilaOverviewPayload()` server-side so the token never reaches the browser.

### The seam for bot #2 (parameterise, works for API **or** DB)
Define **one loader function** `loadBot2OverviewPayload()` (new file, §Files-to-ADD) with the **same
return type** `TortilaOverviewPayload`. Internally branch on the bot's data mode:
- **If old bot exposes an HTTP API (e.g. port 8000):** construct the generic journal reader against
  `BOT2_JOURNAL_URL` + `BOT2_READ_TOKEN` (new env keys in `server-config.ts`).
- **If old bot needs a DB read:** implement the slices from a DB query (mirroring
  `loadDbBotReadModelForUser`) and return the same `TortilaOverviewSlice<T>` shape.

> **`// PLUG DATA SOURCE HERE`** — put this seam inside `loadBot2OverviewPayload()`. The page,
> components, CSS, and proxy route stay identical regardless of whether the source is API or DB. The
> base canonical reads already have this seam built in: `loadBotReadModelForUser` auto-switches
> DB-vs-adapter (data.tsx:739-751), so for the base panels you only register bot #2's `productCode` and
> its DB `healthTarget`/snapshot rows (data.tsx:426, 540) **if** going the DB route.

The separate old-bot audit must report which path applies (Open Question Q2/Q3).

---

## 6. Auth & entitlements

- **Page-level auth:** `requireUser()` / `getCurrentUser()` (`lib/session`) in the layout
  (`(app)/app/layout.tsx:14-15`, redirects to `/login`) and in the page (`page.tsx:106`). **No change**
  — bot #2 inherits it.
- **Per-bot entitlement gate:** `botAccessForUser(user, productCode)` (`lib/access.ts:10-15`) →
  `explainAccess()` from `@wtc/entitlements`. Admins bypass (access.ts:11-13). The page renders an
  "Access required → billing" block when `!access.allowed` (page.tsx:109-117). The auto-refresh proxy
  enforces the *same* gate (route.ts:25-27) returning 401/403.
- **Does bot #2 need a new entitlement?**
  - **Reading A (upgrade `legacy_bot`):** **No.** `legacy_bot` already has a product code, a `legacy_monthly`
    plan (`registry.ts:47`), and an access path. Nothing to add.
  - **Reading B (new product):** **Yes.** Add the code to `PRODUCT_CODES` + `PRODUCTS` and at least one
    `PLANS` entry (`packages/entitlements/src/registry.ts:6-63`). This is the entitlement seam. No new
    *permission/role* is needed — the existing product-entitlement machinery covers it. Optionally wire
    it into a bundle.

---

## 7. Sequencing (avoid merge conflicts with the live Tortila redesign)

**Phase 0 — BLOCK until the Tortila redesign lands and is merged.** Do not touch any file in §"Files to
MODIFY" before then. Safe to do *now* in parallel: drafting bot #2's schemas/adapter/loader in **new**
files (§"Files to ADD"), since they don't collide.

Then, in order:

1. **(If Reading B) Widen the enums first** — `packages/entitlements/src/registry.ts`
   (`PRODUCT_CODES`/`PRODUCTS`/`PLANS`) and `packages/bot-adapters/src/types.ts` (`BotProductCode`).
   This is compiler-enforced; fix the resulting type errors in `meta.ts`, `factory.ts`, `warnings.ts`,
   `data.tsx`. (Skip entirely for Reading A.)
2. **Add bot #2 data layer (new files, no conflict):** extended schemas, generic journal reader (or
   `createBot2JournalReader`), `loadBot2OverviewPayload()` with the `// PLUG DATA SOURCE HERE` seam,
   and (if DB) the snapshot read branch.
3. **Generalise the premium overview** — rename `TortilaOverview` → `BotOverview` (or parameterise it
   with a `bot`/label prop) in `features/bots/tortila-overview/index.tsx`. **SHARED with the redesign —
   do AFTER it merges**, then re-point the Tortila branch to the generalised component in the same PR.
4. **Wire bot #2 into the dashboard page** — `[bot]/page.tsx`: add bot #2 to `MAP` (Reading B only),
   and replace its render branch (or the generic branch) to call `<BotOverview/>` with
   `loadBot2OverviewPayload()`. **SHARED — do AFTER redesign.**
5. **Add the auto-refresh proxy route** for bot #2 — either a new static
   `app/api/bots/<slug>/overview/route.ts` mirroring the Tortila one, **or** (cleaner) refactor the
   Tortila route into a dynamic `app/api/bots/[bot]/overview/route.ts` that dispatches by slug. The
   dynamic refactor is SHARED (moves the existing file) → do after redesign.
6. **Register in `BOT_LIST`** (`features/bots/meta.ts:20`) so the index page + finish board list bot #2
   (Reading B only) and set its `BOT_CAPS` entry. **SHARED — do after redesign.**
7. **(Optional) per-bot CSS accents** in `apps/web/src/app/globals.css`. **SHARED — do last** to avoid
   clobbering restyled `tov-*` rules.
8. Update admin surfaces if needed (`app/admin/bots/page.tsx` hardcodes `bot-tortila_bot` /
   `bot-legacy_bot` anchors and per-bot health rows) — only for Reading B.

---

## Files to ADD (new — no conflict, safe to start now)

| File | Purpose | Reading |
|---|---|---|
| `packages/bot-adapters/src/<bot2>/<bot2>.extended.schemas.ts` | Zod schemas for bot #2's premium endpoints, **outputting the same TS types** as Tortila's (or re-export them if shapes match). | A or B |
| `packages/bot-adapters/src/<bot2>/<bot2>-journal-reader.ts` | `createBot2JournalReader` mirroring `TortilaJournalReader`. *Preferred alt:* refactor Tortila's reader into a shared generic and construct it for bot #2. | A or B |
| `apps/web/src/features/bots/<bot2>-overview-data.ts` | `loadBot2OverviewPayload()` returning `TortilaOverviewPayload`; contains the **`// PLUG DATA SOURCE HERE`** seam (API vs DB). | A or B |
| `apps/web/src/app/api/bots/<slug>/overview/route.ts` | Session+entitlement-gated auto-refresh proxy for bot #2 (mirror of the Tortila route). *Alt:* dynamic `[bot]/overview/route.ts`. | A or B |

## Files to MODIFY (SHARED / conflict-prone — edit ONLY after Tortila redesign merges)

| File | Change | Conflict risk | Reading |
|---|---|---|---|
| `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` | Add bot #2 to `MAP`; route its branch to `<BotOverview/>` + `loadBot2OverviewPayload()`. | **HIGH** — redesign owns this file. | A (rewire legacy branch) / B (new MAP row) |
| `apps/web/src/features/bots/tortila-overview/index.tsx` | Rename/generalise `TortilaOverview` → `BotOverview` (+ label prop). | **HIGH** — redesign owns this. | A or B |
| `apps/web/src/app/globals.css` | Optional per-bot `tov-*` accents. | **HIGH** — redesign restyles `tov-*`. | A or B |
| `apps/web/src/features/bots/meta.ts` | Add `BOT_LIST` row + `BOT_CAPS` entry. | MED | B |
| `packages/entitlements/src/registry.ts` | Add to `PRODUCT_CODES`/`PRODUCTS`/`PLANS`. | MED | B |
| `packages/bot-adapters/src/types.ts` | Widen `BotProductCode`. | MED (compiler ripples) | B |
| `packages/bot-adapters/src/factory.ts` | Add bot #2 adapter selection branch. | MED | B |
| `packages/bot-adapters/src/warnings.ts` | Add bot #2 warning registry (so empty ≠ fake all-clear). | MED | B |
| `apps/web/src/features/bots/data.tsx` | (DB path) register `healthTarget` + snapshot reads for bot #2's `productCode`. | MED | B + DB |
| `apps/web/src/lib/server-config.ts` | (API path) add `BOT2_JOURNAL_URL` / `BOT2_READ_TOKEN`. | LOW | A or B + API |
| `apps/web/src/app/admin/bots/page.tsx` | Add bot #2 health row/anchor. | LOW | B |

> **Files that DO NOT need changing:** `lib/nav.ts` (sidebar has one `/app/bots` entry),
> `(app)/app/layout.tsx`, `components/BotSubNav.tsx` (already slug-parameterised),
> `components/NavLinks.tsx`, `packages/ui/*` (components are product-agnostic).

---

## 8. Effort (S / M / L)

| Piece | Reading A (upgrade legacy) | Reading B (new product) |
|---|---|---|
| Enum/registry widening | — | **S** |
| Extended schemas + journal reader | **M** (reuse Tortila's) | **M** |
| `loadBot2OverviewPayload` + data seam | **M** (API) / **L** (DB) | **M** (API) / **L** (DB) |
| Generalise `TortilaOverview` → `BotOverview` | **M** (shared, careful) | **M** |
| Wire page branch | **S** | **S–M** |
| Auto-refresh proxy route | **S** | **S** |
| `BOT_LIST` / `BOT_CAPS` / admin | — | **S** |
| CSS accents (optional) | **S** | **S** |
| **Total** | **M** (mostly rewire + data seam) | **M–L** (enum ripple + data seam) |

The dominant cost in both readings is the **data seam** (matching bot #2's real data to the
`TortilaOverviewPayload`/canonical shapes), not the UI — the UI is fully reusable.

---

## 9. Open questions (the old-bot audit must answer before build)

- **Q1 — Identity:** Is "bot #2" the **existing `legacy_bot`** getting the premium treatment
  (Reading A), or a **genuinely new 3rd product** (Reading B)? This decides whether the enums change.
  *(Strong signal it's Reading A: `legacy_bot` already exists end-to-end but only renders the basic
  branch at page.tsx:283-347.)*
- **Q2 — Data transport:** Does the old bot expose an **HTTP API (port 8000?)** or must WTC read its
  **DB**? This selects the branch inside the `// PLUG DATA SOURCE HERE` seam.
- **Q3 — Auth to source:** If API: bearer token? header name? Is there a read-only token analogous to
  `JOURNAL_READ_TOKEN`? If DB: read-only connection string, and is there a per-user ownership mapping
  (the Tortila/legacy DB path requires a user-scoped `botInstance`, data.tsx:443-459)?
- **Q4 — Endpoint coverage:** Which premium sections can the old bot actually populate (advanced
  metrics? symbol breakdown? calendar? distribution? marks? activity)? Missing ones render the honest
  "section unavailable" card — confirm that's acceptable vs. hiding those cards for bot #2.
- **Q5 — Marks/live safety:** Does the old bot own its exchange connection (so WTC must NOT proxy live
  marks, as with Tortila/legacy)? Confirms whether `getMarks` is wired or intentionally absent.
- **Q6 — Legacy block precedent:** If Reading A, the legacy *control/HTTP* adapter is hard-blocked for
  plaintext-key reasons (http.ts:280-287). Confirm the premium **read-only** overview pulls from the
  safe worker-DB snapshot path, **not** the blocked `/api_management/` endpoint.
- **Q7 — Naming:** If Reading B, what are the canonical `productCode`, `slug`, display name, and plan
  code(s) for bot #2? Needed for the registry + `MAP` + `BOT_LIST` rows.
