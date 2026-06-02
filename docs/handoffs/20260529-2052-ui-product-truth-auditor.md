# ui-product-truth-auditor handoff

_2026-05-29 20:52. Read-only audit (Phase 1.6, Task E). BOT_ADAPTER_MODE=mock default; web runtime
default on this host = in-memory demo store (no DATABASE_URL). No live servers/SSH/bots/secrets touched.
No code or docs changed except this handoff._

## Scope

Verify the truth of UI/product labels on three screens and the env/lib that back them at runtime:
1. `/admin/tradingview-access` — does it falsely claim the UI is wired to Postgres / DB-backed? The
   ground truth is the TV admin UI is **memory-backed** (in-memory demo store); DB TV repositories
   exist and back the worker, but the **web UI is NOT wired to them** (deferred Part E).
2. `/app/bots` (list) and `/app/bots/[bot]` (detail) — is an explicit mock/simulated banner shown,
   gated on `BOT_ADAPTER_MODE=mock` (not always-on, not absent), on **both** pages?
3. Recommend ONLY truth-label edits (wording fixes + a mock banner where missing). No new features,
   no live wiring.

## Files inspected

- `apps/web/src/app/admin/tradingview-access/page.tsx` (TV admin queue)
- `apps/web/src/app/(app)/app/bots/page.tsx` (bots LIST)
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` (bot DETAIL)
- `apps/web/src/lib/backend.ts` (backend selector: postgres vs in-memory)
- `apps/web/src/lib/db-store.ts` (DB-backed core accessors)
- `apps/web/src/lib/demo.ts` (in-memory demo backend; `tvService`/`tvStore` are memory-only)
- `apps/web/src/lib/server-config.ts` (`botAdapterMode()` resolver, fail-safe to `mock`)
- `packages/config/src/env.ts` (`BOT_ADAPTER_MODE = mock|read-only|audited`, default `mock`)
- `apps/web/src/app/(app)/app/indicators/page.tsx` (same in-memory-badge pattern — related instance)
- `apps/web/src/app/(app)/app/education/page.tsx`, `apps/web/src/app/admin/page.tsx`,
  `apps/web/src/app/(app)/app/layout.tsx`, `apps/web/src/components/PublicTopBar.tsx`,
  `apps/web/src/lib/product-status.ts` (grep sweep for "Simulated"/"in-memory"/"Postgres"/"storage:")
- `packages/ui/src/components/Feedback.tsx` (host of `RiskWarningBanner`; props confirmed via the
  working call site at `bots/[bot]/page.tsx:61-67`)
- Governance/context: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`,
  `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`,
  `docs/NEXT_ACTIONS.md`,
  `docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md`,
  `docs/handoffs/20260529-1921-frontend-product-truth-auditor.md`

## Files changed

None — read-only audit

## Findings

### Finding 1 (HIGH) — TV admin page makes a FALSE "wired to Postgres" claim that contradicts its own badge and the runtime truth

**Severity:** HIGH (the label asserts the opposite of reality — it claims the UI *is* Postgres-wired
when it is in-memory only; this is exactly the "no fake integration / no fake data" violation the
governance rules forbid).

**Evidence:** `apps/web/src/app/admin/tradingview-access/page.tsx:41`

```tsx
<span className="wtc-dim" style={{ fontSize: 12 }}>This admin queue is memory-backed; DB-persisted TV repos exist + are worker-tested, but the UI is wired to Postgres in Phase 1.5.</span>
```

The clause "but the UI is wired to Postgres in Phase 1.5." is **missing the word "NOT"** and is also
tense-broken. As written it states the UI **is** Postgres-wired, which is false and directly
contradicts the badge one line above (`page.tsx:40`: `<StatusPill tone="warn">storage: in-memory
(demo)</StatusPill>`).

**Runtime truth confirmed in code:** `apps/web/src/app/admin/tradingview-access/page.tsx:2` imports
`tvService, tvStore` from `@/lib/backend`; `apps/web/src/lib/backend.ts:48-49` export those as
`memory.tvService` / `memory.tvStore` **unconditionally** (they are NOT routed through the
postgres/in-memory `core` selector and never touch `db-store.ts`). `apps/web/src/lib/demo.ts:72-73`
construct them over the in-memory `createMemoryTvStore()`. So the TV admin queue is memory-backed in
**every** environment, including when `DATABASE_URL` is set. `STATUS.md:34` and
`IMPLEMENTED_FILES.md:26` confirm: "TradingView + LMS web UI remain in-memory (Phase 1.5 deferred
Part E)". This is a Part E item per `NEXT_ACTIONS.md:42-48`.

**Badge status:** an "storage: in-memory (demo)" badge already exists (`page.tsx:40`) and is correct.
The conflicting/false "wired to Postgres" wording remains in the adjacent caption (`page.tsx:41`) and
must be corrected.

**Recommendation:** Fix the caption so it tells the truth (UI NOT wired to Postgres; deferred Part E).
Keep the existing line-40 badge as-is.

**Concrete target fix** — in `apps/web/src/app/admin/tradingview-access/page.tsx`, replace the entire
line 41:

```tsx
        <span className="wtc-dim" style={{ fontSize: 12 }}>This admin queue is memory-backed; DB-persisted TV repos exist + are worker-tested, but the UI is wired to Postgres in Phase 1.5.</span>
```

with:

```tsx
        <span className="wtc-dim" style={{ fontSize: 12 }}>This admin queue is memory-backed; DB-persisted TV repos exist + are worker-tested, but the web UI is NOT yet wired to them — Postgres wiring deferred (Part E).</span>
```

(Optional, to mirror the orchestrator's suggested badge text, the line-40 pill could read
`storage: in-memory (demo) — Postgres wiring deferred (Part E)`, but the shorter pill + corrected
caption already conveys the truth; the load-bearing fix is line 41.)

---

### Finding 2 (PASS) — The sibling in-memory captions (Indicators, Education) are TRUTHFUL — do NOT "fix" them

**Severity:** PASS (verified accurate; included because the brief asked for a cross-`apps/web/src` grep
of "Postgres"/"DB-backed"/"wired"/"storage:" wording, and to forestall an over-eager edit).

A precise grep (`is wired to` / `web UI is wired`) across `apps/web/src` returns **exactly one** false
claim — the admin TV page line 41 (Finding 1). The other in-memory captions are honest:

- `apps/web/src/app/(app)/app/indicators/page.tsx:39-40` — pill `storage: in-memory (demo)` +
  caption "This view is not yet DB-persisted — requests reset on restart (TV/LMS DB wiring is Phase
  1.5)." This page reads the same memory-only `tvService`/`tvStore` (`indicators/page.tsx:4` imports
  them from `@/lib/backend`), and the caption correctly says **not yet DB-persisted**. Truthful — no
  change.
- `apps/web/src/app/(app)/app/education/page.tsx:25-26` — pill `storage: in-memory (demo)` + caption
  "LMS content is not yet DB-persisted — resets on restart (Phase 1.5)." Truthful — no change.

Two minor staleness nits (NOT truth defects, optional): both captions say "Phase 1.5", but the DB
wiring is now deferred to **Part E** (its own session) per `STATUS.md:34`, `NEXT_ACTIONS.md:42-48`.
Re-labelling "(Phase 1.5)" → "(deferred — Part E)" on these two lines would align them with the
post-Phase-1.5 reality, but it is cosmetic, not a false claim. **Do not rewrite these to add "NOT" or
remove the in-memory badge** — they are already correct.

---

### Finding 3 (PASS) — Bot DETAIL page already shows the "Simulated data — not a live account" banner, correctly gated on BOT_ADAPTER_MODE=mock

**Severity:** PASS (no change needed).

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:61-67`

```tsx
      {adapter.mode === 'mock' && (
        <RiskWarningBanner
          severity="warning"
          title="Simulated data — not a live account"
          detail="BOT_ADAPTER_MODE=mock: every metric, position, and trade below is illustrative sample data from the mock adapter, not your real exchange account. Live read-only data requires a configured, audited adapter."
        />
      )}
```

The banner is rendered **only** when `adapter.mode === 'mock'` (gated, not always-on, not absent), and
sits immediately above the 8-card metric grid (`page.tsx:69`). `adapter.mode` derives from
`botAdapterOptions()` → `botAdapterMode()` (`server-config.ts:5-8`), which fail-safes to `mock`.
The header pill (`page.tsx:48`) is also correctly `tone="warn"` for mock. STATUS.md's claim of a
"Simulated data — not a live account" banner is **TRUE for the detail page.** No change needed.

---

### Finding 4 (HIGH) — Bot LIST page (`/app/bots`) is MISSING the mock banner; STATUS's "bot dashboards show a Simulated-data banner" claim is only half-true

**Severity:** HIGH (product-truth gap; this is the gap the orchestrator brief flagged to fix).

**Evidence:** `apps/web/src/app/(app)/app/bots/page.tsx` has **no** `RiskWarningBanner` anywhere
(`RiskWarningBanner` is neither imported on `page.tsx:6` nor rendered). The only mock disambiguation
is inline prose inside the `SectionHeader` sub-copy:

```tsx
// apps/web/src/app/(app)/app/bots/page.tsx:30
<SectionHeader kicker="Trading bots" title="Bots" copy={`Read-only monitoring through adapters. Live controls stay disabled until a dedicated audited adapter is approved. BOT_ADAPTER_MODE=${botAdapterMode()}.`} />
```

`BOT_ADAPTER_MODE=mock` appears only as text appended to a paragraph — not a distinct, gated banner.
The page DOES render per-bot health pills (`page.tsx:36`) sourced from the mock adapter, so a user can
read mock health/PnL-context without any prominent "simulated" warning. This is exactly the gap raised
(but only partially fixed) in the prior Phase 1.5 audit — see
`docs/handoffs/20260529-1921-frontend-product-truth-auditor.md` Finding 2, which recommended adding a
banner to the list page "instead of inline copy"; the detail page got the banner, the list page did
not. So STATUS.md (line 42) and the Phase 1.5 aggregate ("mock bot dashboards show a banner") are only
accurate for the detail page.

**Gating data already available on this page:** `botAdapterMode` is already imported
(`page.tsx:5`: `import { botAdapterMode, botAdapterOptions } from '@/lib/server-config';`), so the gate
`botAdapterMode() === 'mock'` needs no new import. Only `RiskWarningBanner` must be added to the
existing `@wtc/ui` import.

**Recommendation:** Add a `RiskWarningBanner` to the list page, gated on `botAdapterMode() === 'mock'`,
placed directly under the `SectionHeader` and above the bot grid — matching the detail page's pattern
and wording.

**Concrete target fix** (two edits in `apps/web/src/app/(app)/app/bots/page.tsx`):

1. Add `RiskWarningBanner` to the existing UI import on line 6. Replace:

```tsx
import { Card, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
```

with:

```tsx
import { Card, SectionHeader, StatusPill, RiskWarningBanner, buttonClasses, type Tone } from '@wtc/ui';
```

2. Insert the gated banner between the `SectionHeader` (line 30) and the
   `<div className="wtc-grid wtc-grid-2">` (line 31). Insert immediately after line 30:

```tsx
      {botAdapterMode() === 'mock' && (
        <RiskWarningBanner
          severity="warning"
          title="Simulated data — not a live account"
          detail="BOT_ADAPTER_MODE=mock: bot health and figures on this page are illustrative sample data from the mock adapter, not your real exchange account. Live read-only data requires a configured, audited adapter."
        />
      )}
```

The `severity`/`title`/`detail` prop shape is verified against the working call site at
`bots/[bot]/page.tsx:61-67`. No new feature, no live wiring — a truth label only.

## Decisions

- The TV-admin badge ("storage: in-memory (demo)", `page.tsx:40`) is **kept**; the load-bearing fix is
  the false caption on `page.tsx:41` (add "NOT", reframe to "Postgres wiring deferred (Part E)").
- The bot DETAIL page is a confirmed PASS — no edit recommended there (avoid double-banner churn).
- The bot LIST fix reuses the existing `botAdapterMode` import and the detail page's verified
  `RiskWarningBanner` usage, so the change is minimal, gated, and consistent.
- The Indicators and Education in-memory captions were verified TRUTHFUL (Finding 2 = PASS); the brief's
  cross-`apps/web/src` grep for conflicting "Postgres"/"wired"/"DB-backed" wording surfaced exactly ONE
  false claim — the admin TV caption (Finding 1). The orchestrator must NOT add "NOT"/strip badges on
  the indicators/education pages — they already say "not yet DB-persisted".
- I did **not** read `RiskWarningBanner`'s definition directly (the harness deduplicated
  `Feedback.tsx` reads); its prop API is taken from the verified, compiling call site on the detail
  page, which is sufficient and lower-risk than guessing from the component source.

## Risks

- The two false "wired to Postgres / wired to them" captions are the highest risk: an
  admin/operator reading `/admin/tradingview-access` (or a user on `/app/indicators`) is told the TV
  data is DB-persisted when it is in-memory and lost on restart — a direct contradiction of the
  governance "no fake integration, honest adapter + documented TODO" rule.
- The missing list-page banner means a user landing on `/app/bots` (the entry point to bot
  dashboards) sees mock health with no prominent simulated-data warning; only after clicking into a
  bot do they see the banner. Trust/clarity risk, not a security hole.
- None of these are exploitable security vulnerabilities; all are truth-label defects.
- The recommended edits are additive/string-only and should not affect the 10 Playwright e2e tests;
  the new banner uses an existing component already exercised on the detail page.

## Verification/tests

- All evidence is static read-only analysis (Read/Grep/Glob + read-only PowerShell `Get-Content`).
  No app run, no build, no tests executed this session.
- Runtime backing for the TV admin UI was traced through code, not assumed:
  `tradingview-access/page.tsx:2` → `backend.ts:48-49` (unconditional `memory.tvService/tvStore`,
  never via the `core` selector / `db-store.ts`) → `demo.ts:72-73` (in-memory store). This confirms
  the UI is memory-backed in all environments.
- `BOT_ADAPTER_MODE` truth confirmed: `packages/config/src/env.ts:26`
  (`z.enum(['mock','read-only','audited']).default('mock')`) and `server-config.ts:5-8`
  (`botAdapterMode()` returns the env value or fail-safes to `'mock'`); `getBotAdapter` is fed
  `botAdapterOptions()` whose `mode` is `botAdapterMode()`, so `adapter.mode` on the detail page
  reflects the env flag.
- Recommended post-fix gates (NOT run here; for the implementer): `npm run typecheck -w @wtc/web`
  (new import), `npm run build -w @wtc/web`, `npm run lint`, `npm run e2e` (confirm no mobile/desktop
  nav regression and the bots pages still render).

## Next actions

For the frontend implementer (truth-label edits only; no features, no live wiring):
1. **Finding 1** — `apps/web/src/app/admin/tradingview-access/page.tsx:41`: replace the false caption
   with the "…NOT yet wired to them — Postgres wiring deferred (Part E)." string above.
2. **Finding 4** — `apps/web/src/app/(app)/app/bots/page.tsx`: add `RiskWarningBanner` to the line-6
   import and insert the `botAdapterMode() === 'mock'`-gated banner after line 30 (exact code above).
3. **Finding 2** — NO truth fix required. The indicators (`indicators/page.tsx:39-40`) and education
   (`education/page.tsx:25-26`) captions already correctly say "not yet DB-persisted". Optional cosmetic
   only: re-label their "(Phase 1.5)" → "(deferred — Part E)". Do not add "NOT" or remove their badges.
4. After edits: update `STATUS.md:42` so the "Simulated data" banner claim names BOTH the list and
   detail pages (currently it over-claims for the list page). Remove the "storage: in-memory (demo)"
   badges + captions only when Part E actually wires the TV/LMS web UI to the DB repos (per
   `NEXT_ACTIONS.md` item 1), not before.
