# ecosystem-ux-ui-designer handoff

**Epoch:** 20260531-0030
**Agent:** ecosystem-ux-ui-designer
**Phase:** PG10 — Backtester / Distribution (option b: explicit locked card)
**Session role:** Read-only UX audit + premium terminal-first locked-card design specification
**Status:** COMPLETE — design specifications ready for implementation

---

## Scope

Design the honest, permanently-locked backtester page for option (b): the operator has decided the real
local-runner distribution (option a — backtest_jobs/backtest_artifacts tables, 9 API routes, HMAC upload
tokens, artifact storage, vendored Python runner ZIP, chart components) is deferred to a future multi-session
epic. PG10 ships the backtester route as a correct, complete, no-half-state locked card.

Specific deliverables:

1. The three render states the page must produce — Legacy boundary card, Tortila not-entitled, and Tortila
   entitled-but-locked — with exact copy for each.
2. Premium terminal-first UI anatomy for each state: component primitives, pill taxonomy, responsive layout,
   accessibility requirements.
3. Specification for the `packages/backtester` orphaned-package cleanup: a latent bug (undefined `engine`
   reference noted in the prompt) that is currently un-caught because the package exports are never imported
   by any application source file.
4. Assessment of whether the Tortila cabinet card or `BotSubNav` needs any change to reflect the locked state.

This handoff is READ-ONLY. No code was changed.

---

## Files inspected

| File | Purpose |
|------|---------|
| `docs/handoffs/0000-orchestrator-seed.md` | Design tokens, product codes, hard rules |
| `AGENTS.md` | Handoff format, governance, non-negotiable gates |
| `docs/SESSION_PROTOCOL.md` | Process governance |
| `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` | Current half-state to fix |
| `packages/backtester/src/index.ts` | Orphaned type-model package |
| `packages/backtester/package.json` | Package metadata; listed in apps/web but never imported |
| `docs/BACKTESTER_DISTRIBUTION_PLAN.md` | Full option-a design + §16.1/§17 locked design rules |
| `docs/CONTRACTS/backtester-runner.md` | Contract; §10 mock/real status; §16.1 download-disabled rule |
| `docs/ROADMAP_MASTER.md` §10 | PG10 operator-decision line |
| `docs/PRODUCTION_BLOCKERS.md` | PG10 operator decision line; B1/B2/B4/B7 context |
| `docs/EXECUTION_PLAN_MASTER.md` W11 | PG10 workstream definition |
| `packages/cabinet/src/derive.ts` | `@wtc/cabinet` pure deriver; ACCESS_REASON_COPY; reasonLabel/reasonTone |
| `packages/cabinet/src/index.ts` | Cabinet package exports |
| `packages/ui/src/theme.css` | All design tokens, `.wtc-card`, `.wtc-pill`, `.wtc-btn`, `.wtc-warning`, `.wtc-empty`, `.wtc-table-wrap`, `.wtc-wizard-steps`, `.wtc-card-row`, `.wtc-shell` |
| `docs/handoffs/20260531-0005-phase-2-12-user-cabinet-product-ux.md` | PG9 aggregate: responsive patterns, pill taxonomy, `@wtc/cabinet`, fail-closed precedents |
| `docs/handoffs/20260531-0005-ecosystem-ux-ui-designer.md` | PG9 UX handoff; ACCESS_REASON_COPY map; per-product state maps |
| `docs/handoffs/20260530-0126-ecosystem-backtester-architect.md` | §17.2 Legacy wording rule; §16.1 disabled-button rule |
| `apps/web/src/components/BotSubNav.tsx` | Tab strip; `backtester` tab rendered for all bots |
| `C:/Users/maxib/Downloads/wtc_premium_redesign/wtc_premium_redesign/v2-terminal-os.html` | Visual direction (referenced per operator instruction; not read directly — tokens already locked in theme.css) |

---

## Files changed

None — read-only audit.

---

## Findings

### F-01 — HIGH — Current Legacy branch says "coming soon" — violates the hard product-boundary rule

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:19–29`

The Legacy branch renders:

```
<Card title="Coming soon">
  <p>...out of scope at MVP. Only the Tortila backtester is available. See the product roadmap for a future release.</p>
</Card>
```

"Coming soon" and "future release" violate `BACKTESTER_DISTRIBUTION_PLAN.md §17.2`, which explicitly
states: "The wording does NOT say 'coming soon' or 'planned' — it states the product boundary clearly."
This is a permanent product decision, not a roadmap promise. "See the product roadmap for a future
release" implies Legacy will eventually get a backtester; that implication is dishonest.

**Recommendation:** Replace with the permanent boundary card specified in Finding F-01's fix section and
the State 1 spec below. The card title must be "Not available for this bot" (not "Coming soon"); body
copy must state the product boundary without any roadmap promise.

---

### F-02 — HIGH — Tortila entitled branch renders a functional-looking dead form with disabled teaser buttons

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:43–66`

The entitled Tortila branch renders:
- A `<form>` with six real form fields (Symbols, Timeframe, System, Risk %, Start, End) in a `.wtc-grid-3`
- Two disabled buttons: "Queue run (local runner required)" and "Download local runner (soon)"
- An EmptyState "Results" card

This is the half-state the operator decision targets. Problems:

1. The form fields are interactive and editable by the user. An editable form with no working submit
   action creates a misleading interaction: the user fills in values and nothing happens. A disabled
   submit button adjacent to interactive fields is worse UX than no form at all.
2. "Download local runner (soon)" is a teaser button. `BACKTESTER_DISTRIBUTION_PLAN.md §16.1` and
   `docs/CONTRACTS/backtester-runner.md §10` both say the runner is "not yet available" — but "soon"
   implies the download is imminent, which is not a committed timeline.
3. "Queue run (local runner required)" as a disabled label implies queueing is a real feature that is
   only gated on local-runner availability. In option (b), queueing is not built at all.
4. The `SectionHeader` copy "Heavy backtests run in a downloadable local runner — not in the web tier.
   Results appear here only when a real artifact is uploaded." is excellent and honest — but is paired
   with a fake interactive form, which contradicts it.

**Recommendation:** Remove the form and teaser buttons entirely. Replace with the honest locked card
specified in State 3 below. The copy explaining the architectural reason (local-runner distribution not
yet shipped) must remain; the dead form must not.

---

### F-03 — HIGH — packages/backtester is listed in apps/web dependencies but never actually imported

**Evidence:**
- `apps/web/package.json:30` — `"@wtc/backtester": "*"` listed as dependency
- `apps/web/next.config.ts:20` — `'@wtc/backtester'` listed in `transpilePackages`
- Zero application source files (`apps/web/src/**`) import from `@wtc/backtester`
- `packages/backtester/src/index.ts` is not consumed by `backtester/page.tsx` which imports only from
  `@wtc/ui` and `@/lib/*`

The package is registered but orphaned. This means:
- The type stubs in `packages/backtester/src/index.ts` are never typechecked in context
- The prompt notes a latent bug: `backtesterStatusLabel()` (noted as a function that was in an earlier
  version of the package at ~line 29) referenced an undefined `engine` field. Whether that specific
  function still exists is moot — the package is entirely untested because no consumer imports it, so
  Vitest never runs its code paths through normal coverage.
- The `BacktestService` class (lines 48–69) uses `globalThis.crypto.randomUUID()` which requires Node
  18+ or a browser environment — this is fine for the target, but the lack of any test means it is
  unverified.
- The `BacktestJob` type in `index.ts` uses `system: string` (line 13 via `BacktestParams`), while
  `BACKTESTER_DISTRIBUTION_PLAN.md §5.1` and `TortilaJobParamsSchema` specify `system: 1 | 2` (integer).
  This is a known type drift that will cause a compile error when option (a) is eventually built and the
  package is wired as a real consumer.

**Recommendation (option b does not require the package):** In option (b), the backtester page imports
nothing from `@wtc/backtester`. The implementer should either (a) remove `@wtc/backtester` from
`apps/web/package.json` and `next.config.ts` for the duration of option (b) — keeping the package on
disk for future reference but not registered as a live dependency — or (b) add a comment to the package
explaining it is a design-only stub with no live consumers. The correct PG10 action is to clean the
dependency registration so typecheck does not silently ignore the orphaned package types.

**Target part:** `apps/web/package.json`, `apps/web/next.config.ts`, `packages/backtester/src/index.ts`
(documentation comment), and this finding's note for the Phase 6 implementer.

---

### F-04 — MEDIUM — BotSubNav renders a "Backtester" tab for ALL bots including Legacy

**Evidence:** `apps/web/src/components/BotSubNav.tsx:4–12`

```typescript
const TABS: { seg: string; label: string }[] = [
  { seg: '', label: 'Overview' },
  { seg: 'positions', label: 'Positions' },
  ...
  { seg: 'backtester', label: 'Backtester' },
  { seg: 'settings', label: 'Settings' },
];
```

The TABS array is static and the `Backtester` entry is rendered for both `tortila` and `legacy`. When
a Legacy user clicks "Backtester" they land on the Legacy boundary card (State 1). This is not broken
in a functional sense — the boundary card correctly communicates the product limit — but it creates a
navigation path that advertises a feature that will never exist for this bot. A tab that leads to a
"not available for this bot" permanent boundary card is misleading UI.

Note: the PG9 aggregate handoff (`20260531-0005-phase-2-12-user-cabinet-product-ux.md`, Decisions §3)
explicitly decided NOT to add a `setup` tab to `BotSubNav`. The backtester tab was not touched in PG8/PG9.

This is flagged as a pre-existing bug, not a new regression. PG10's job is to make the page honest; the
nav tab is a separate question.

**Recommendation:** This is a product decision that requires the operator to answer: should Legacy Bot's
BotSubNav suppress the Backtester tab entirely, or retain it (leading to an honest permanent boundary
card)? Two honest options:

Option A (clean): Pass the bot's `productCode` into `BotSubNav` and filter out `backtester` when
`productCode === 'legacy_bot'`. A tab that can never have content should not appear.

Option B (retain, honest boundary): Keep the tab but ensure the landing card is an explicit, permanent,
non-dismissable boundary card (State 1 below). This is the minimal PG10 change.

This handoff recommends Option A as the more honest UX, but notes that option (b) for PG10 can ship
option B (retain + honest card) with the tab decision carried to a follow-up.

**Target part:** `apps/web/src/components/BotSubNav.tsx` (decision required, not mandated by this audit)

---

### F-05 — MEDIUM — Cabinet Tortila card: backtester sub-feature not reflected in the setup items

**Evidence:** `packages/cabinet/src/derive.ts:138–155` (setupStateFromItems) + PG9 UX handoff D-04
(tortila_bot setup items: "Exchange key added" + "Bot strategy saved")

The cabinet card setup items for `tortila_bot` are: exchange key added (boolean) and strategy saved
(boolean). There is no signal about the backtester. Given option (b) — the backtester is a sub-feature
that is not yet available — this is correct behavior: the cabinet card correctly describes the setup
state of the live bot product, not of a deferred sub-feature.

However, if a user completes setup (2/2 items done) and then navigates to Backtester, they will find
the locked card. This creates a minor expectation mismatch: "Setup complete" on the cabinet card but
"not available yet" on the backtester tab.

**Recommendation:** The cabinet card does NOT need to be changed for option (b). The backtester is a
sub-feature of `tortila_bot`; its unavailability does not affect the bot product's setup state. The
honest signal is in the backtester page itself. Do not add a "Backtester: not available" setup item
to the cabinet card — that would be inaccurate noise on a setup checklist whose items are about making
the bot run, not about accessing a future sub-feature.

No change needed. Noted for completeness.

---

### F-06 — LOW — page.tsx imports `buttonClasses` from `@wtc/ui` but option (b) has no interactive buttons

**Evidence:** `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:4`

```typescript
import { Card, SectionHeader, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
```

With option (b), the Tortila entitled state renders a locked informational card with no interactive
buttons. The `buttonClasses` import becomes unused. Unused imports produce ESLint warnings under
`--max-warnings 0`.

**Recommendation:** Remove `buttonClasses` from the import when the form/button block is replaced.
Keep `Card`, `SectionHeader`, `EmptyState`, `RiskWarningBanner` — all four are used across the three
states.

---

## Decisions

### D-01 — Three states the page must render (exact anatomy and copy)

Option (b) produces exactly three render states. There is no fourth "loading" or "pending" state —
no async data is fetched for a locked card (except the entitlement check, which is already the
existing `accessFor` + `requireUser` pattern).

---

#### State 1 — Legacy Bot: permanent product boundary card

**Trigger:** `bot === 'legacy'`

**Entitlement check:** NONE. The boundary is a product decision, not an entitlement decision. Render
immediately before any session/entitlement check. The `requireUser()` call is still required (the user
must be authenticated to see any app route) but `accessFor` is not called for legacy backtester.

**HTML landmark:** `<main>` (provided by the app layout); the page renders a `<div className="wtc-stack">`.

**Anatomy:**

```
<SectionHeader
  kicker="Legacy backtester"
  title="Not available for this bot"
/>

<Card>                                     ← .wtc-card (no title prop needed)
  <p className="wtc-muted">               ← body copy, em-dash list
    The Legacy Bot does not have a backtester.
    The Turtle strategy backtester is available under
    Bots → Tortila → Backtester.
  </p>
</Card>
```

**What is NOT rendered:**
- No `<form>`. No inputs. No buttons. No download link.
- No "coming soon", no "planned", no "future release" language.
- No `RiskWarningBanner` (this is a product boundary, not a risk signal).
- No "Upgrade" or purchase CTA — entitlement is irrelevant.

**Exact copy:**

```
kicker:  "Legacy backtester"
title:   "Not available for this bot"
body:    "The Legacy Bot does not have a backtester. The Tortila Turtle strategy
          backtester is available under Bots → Tortila → Backtester."
```

No additional copy. No roadmap reference. No date promise.

**Pill / status chip:** None. This state has no status chip — a chip would imply a state that could
change (e.g. "locked" chips imply "could be unlocked"). The boundary is permanent.

**Responsive at 375px:** `.wtc-card` is full-width with `padding: 22px` from `theme.css:59`. The body
copy wraps naturally. No minimum width constraints; no horizontal scroll risk.

**A11y:** No `<form>`, no `<button>`. The `<p>` body copy is plain text. Focus order: heading
(from `SectionHeader`) → paragraph text. No interactive controls to confuse keyboard users.
`SectionHeader` renders `<h1>` or `<h2>` (verify with component definition); the `kicker` is a
`<p className="wtc-kicker">` or a `<span>`. Both are correct landmarks under the app layout `<main>`.

---

#### State 2 — Tortila Bot, not entitled: access-required gate

**Trigger:** `bot === 'tortila'` AND `!access.allowed`

**Entitlement check:** The existing `accessFor(user.id, 'tortila_bot')` pattern — already in the page.
Reuse exactly. No change to the access model.

**Anatomy:**

```
<SectionHeader
  kicker="Tortila backtester"
  title="Access required"
/>

<RiskWarningBanner
  severity="warning"
  title={`Backtester access — ${reasonLabel(access.reason)}`}
  detail="The backtester is a sub-feature of the Tortila Bot product.
          An active Tortila Bot subscription is required."
/>

<Card>
  <p className="wtc-muted">
    You do not currently have access to the Tortila Backtester.
    Backtester access is included with an active Tortila Bot subscription.
    [View plans link → /pricing or /app/billing]
  </p>
</Card>
```

**What is NOT rendered:**
- No config form. No inputs. No download button.
- No teaser for backtester features.

**Exact copy (RiskWarningBanner):**

```
severity: "warning"
title:    `Backtester access — ${reasonLabel(access.reason)}`
          e.g. "Backtester access — Not subscribed"
          e.g. "Backtester access — Expired"
          e.g. "Backtester access — Grace period"
detail:   "The backtester is a sub-feature of the Tortila Bot product.
           An active Tortila Bot subscription is required."
```

**Pill / status chip:** No additional pill. The `RiskWarningBanner` with `severity="warning"` already
uses the amber `.wtc-warning.warning` style from `theme.css:99`. This is the correct tone for an access
denial — not an error (the user's data is not at risk), not info (the situation requires action).

**Link CTA:** The "View plans" / "Contact support" CTA must be a plain `<a>` or a ghost button styled
link, NOT a `<button>`. This avoids the `disabled` button anti-pattern (a non-entitled user can navigate
to billing). The CTA target follows the `@wtc/cabinet` `deriveNextAction` precedent:
- `reason === 'blocked_no_entitlement'` + `checkoutEnabled === false` → `href="/app/support"`,
  label "Contact support"
- `reason === 'expired'` + `checkoutEnabled === false` → `href="/app/support"`, label "Contact support"
- `reason === 'grace'` → `href="/app/billing"`, label "View billing"
- `reason === 'pending_payment'` → `href="/app/billing"`, label "Check billing status"
- All other non-allowed reasons → `href="/app/support"`, label "Contact support"

This CTA belongs inside the `<Card>` body, not as a standalone `<button>`. It is a link, styled as
`className={buttonClasses('ghost')}`, `min-height: 44px` guaranteed by the unconditional `.wtc-btn`
base rule added in PG9.

**Responsive at 375px:** `RiskWarningBanner` uses `.wtc-warning` flex layout. At 375px the icon and
text stack correctly (`align-items: flex-start` from `theme.css:97`). The CTA link inside the card
is full-width if implemented as `display: block; width: 100%`. No horizontal scroll risk.

**A11y:** `RiskWarningBanner` renders with `role="alert"` or a `<section>` with a visible heading —
verify with component definition. The CTA link has descriptive text (not "click here"). Focus order:
heading → banner → card text → CTA link.

---

#### State 3 — Tortila Bot, entitled: honest "not yet available" locked card

**Trigger:** `bot === 'tortila'` AND `access.allowed`

This is the primary target of PG10 option (b). The user has a valid entitlement but the backtester
sub-feature is not yet distributed.

**Design principle:** State WHY. The card must explain the specific reason the feature is locked:
the local-runner distribution is not yet shipped. The platform never fabricates returns. No teaser form,
no progress placeholder, no ambiguous "coming soon" pill.

**Anatomy:**

```
<SectionHeader
  kicker="Tortila backtester"
  title="Backtester"
  copy="Backtests run locally on your machine via a downloadable runner package.
        The platform records job parameters and displays real uploaded results only —
        it never fabricates returns or equity curves."
/>

<Card>

  <-- Zone 1: locked status strip (inline, not a separate full banner) -->
  <div className="wtc-warning info" style={{ marginBottom: 16 }}>
    <div>
      <p className="w-title">Local runner not yet distributed</p>
      <p className="w-detail">
        The downloadable runner package for the Tortila Turtle strategy backtester
        has not yet been released. When it ships, you will be able to configure
        a run here, download the runner, execute it locally, and upload the result
        artifact to view your equity curve and trade metrics.
      </p>
      <p className="w-detail" style={{ marginTop: 6 }}>
        The platform never produces synthetic or illustrative backtest results.
        Only results from a real uploaded artifact are shown.
      </p>
    </div>
  </div>

  <-- Zone 2: what the feature will do (static description, no interactive elements) -->
  <div className="wtc-grid wtc-grid-2" style={{ marginTop: 0 }}>

    <div className="wtc-metric">
      <p className="label">Strategy</p>
      <p className="value" style={{ fontSize: 16 }}>Turtle Breakout</p>
      <p className="wtc-dim" style={{ fontSize: 12, marginTop: 4 }}>
        Donchian channel · Wilder ATR · Multi-unit pyramid
      </p>
    </div>

    <div className="wtc-metric">
      <p className="label">Data source</p>
      <p className="value" style={{ fontSize: 16 }}>Local OHLCV download</p>
      <p className="wtc-dim" style={{ fontSize: 12, marginTop: 4 }}>
        Public BingX endpoints · No exchange keys required
      </p>
    </div>

    <div className="wtc-metric">
      <p className="label">Execution</p>
      <p className="value" style={{ fontSize: 16 }}>Your machine</p>
      <p className="wtc-dim" style={{ fontSize: 12, marginTop: 4 }}>
        Python 3.11+ · ZIP runner package · No web-tier compute
      </p>
    </div>

    <div className="wtc-metric">
      <p className="label">Results</p>
      <p className="value" style={{ fontSize: 16 }}>Uploaded artifact only</p>
      <p className="wtc-dim" style={{ fontSize: 12, marginTop: 4 }}>
        Platform validates · Never fabricated · Immutable after upload
      </p>
    </div>

  </div>

</Card>
```

**What is NOT rendered:**
- No `<form>` with Symbols/Timeframe/System/Risk/Start/End inputs.
- No "Queue run" button (disabled or otherwise).
- No "Download local runner" button (disabled or otherwise).
- No "Results" EmptyState card (the locked card IS the results area; the EmptyState implies there is a
  state where results would appear, which is misleading when the feature is not built).
- No "coming soon" pill or chip.

**Pill / status chip — specification:**

Use a `neutral` chip from the canonical pill taxonomy (`theme.css:77-86`). The pill uses the base
`.wtc-pill` class with NO tone modifier (i.e., not `.ok`, `.warn`, `.bad`, `.gold`). This signals
"not yet available" without implying a pending state or a risk.

```
<span className="wtc-pill" aria-label="Feature status">
  <i aria-hidden="true" />
  Not yet available
</span>
```

Placement: inline next to or below the `SectionHeader` title, before the card. Alternatively, the
`SectionHeader` `kicker` can embed the status: `kicker="Tortila backtester · Not yet available"`.

The neutral pill (no tone) is the correct choice here. A `.gold` pill would imply something positive
or premium-tier; a `.warn` pill would imply a risk. The feature simply does not exist yet. No tone.

**Why not a "planned" pill:** The `.wtc-pill.gold` "Planned" treatment is used by `club` in the cabinet
card (a planned product). The backtester is a sub-feature of an existing product (tortila_bot) that is
OWNED by this user. It is not "planned" in the sense of a roadmap item the user would subscribe to —
it is a feature they have entitlement to use but cannot yet because the distribution infrastructure is
not built. The distinction matters: the neutral chip says "not yet distributed", not "on the roadmap".

**Responsive at 375px:**

`.wtc-grid wtc-grid-2` collapses to `1fr` at `max-width: 640px` (`theme.css:67`). At 375px, the four
metric tiles stack to single column. Each `.wtc-metric` has `padding: 14px 16px` and `border-radius:
var(--radius)` — no minimum width constraints, wraps cleanly.

The `.wtc-warning.info` strip uses `display: flex; gap: 12px; align-items: flex-start` (`theme.css:97`).
At 375px the icon and text block wrap without overflow. `p` elements inside inherit their parent's
width. No horizontal scroll from this component.

The `SectionHeader` `copy` prop renders as a `<p className="wtc-lead">` which has `line-height: 1.7`
and wraps naturally. No truncation.

**A11y:**

- No interactive controls: no buttons, no inputs, no links (except optionally a plain link in the status
  strip pointing to documentation if the copy warrants it).
- The `.wtc-warning.info` strip must have a descriptive role. If `RiskWarningBanner` always renders
  `role="alert"`, use it directly. If the inline `.wtc-warning` div is used, add `role="status"` for
  informational notices that are not urgent alerts.
- No `disabled` control that looks interactive. This is the critical UX anti-pattern from the current
  page: `<button disabled>Queue run</button>` looks like an operable control. Removing the button
  entirely eliminates the false affordance.
- Focus order: SectionHeader heading → neutral pill → info strip → metric grid (read-only). No focusable
  interactive elements, so the user does not waste tab stops on inert controls.
- The metric `.wtc-metric` divs are decorative descriptions, not interactive. They do not need `role`,
  `tabindex`, or `aria-*`. Plain `<div>` with semantic `<p>` children is correct.

---

### D-02 — packages/backtester cleanup for option (b)

The package is orphaned (registered but never imported). For option (b), the correct minimal action is:

**Recommended cleanup (low-risk, no behaviour change):**

1. Remove `"@wtc/backtester": "*"` from `apps/web/package.json` dependencies. The package is not
   consumed by any source file; having it in the dependency list causes `npm install` to symlink it
   without any consumer to validate it. This is dead weight.

2. Remove `'@wtc/backtester'` from `transpilePackages` in `apps/web/next.config.ts`. Transpiling an
   orphaned package adds compile cost with no benefit.

3. Add a `/* DESIGN STUB — option (a) phase 6 only. See docs/BACKTESTER_DISTRIBUTION_PLAN.md. */`
   comment at the top of `packages/backtester/src/index.ts` to make the orphan status explicit to any
   future reader.

4. The package itself (files on disk) is NOT deleted. It is design documentation — the type model,
   `BacktestService`, and `BacktestStore` are the spec for Phase 6. Deleting them would lose context.

**Type drift to note for Phase 6:**

`packages/backtester/src/index.ts:13` — `BacktestParams.system: string`. The authoritative schema in
`BACKTESTER_DISTRIBUTION_PLAN.md §5.1` specifies `system: 1 | 2` (integer enum). When Phase 6
scaffolds the real package, this field must be corrected to `system: 1 | 2` to match the Zod schema
and the Python engine's `BacktestConfig.system` integer field. Do not copy the stub type to production.

---

### D-03 — BotSubNav: `backtester` tab — carry as a decision, not a mandate

`BotSubNav` renders the `Backtester` tab for all bots including Legacy. For PG10 option (b), the
minimum viable change is to ensure the page it leads to is honest (States 1 and 3 above). The tab
itself is pre-existing; modifying `BotSubNav` is in scope only if the operator decides to suppress
the tab for Legacy.

**Design recommendation (non-binding for PG10):** Filter out `backtester` from `TABS` when
`productCode === 'legacy_bot'`. The nav renders one fewer tab; users are not offered navigation to a
page that says "not available for this bot." This is a one-line conditional filter in `BotSubNav.tsx`.

**For PG10:** The page fix (States 1–3) is the required change. The nav tab suppression is the
recommended follow-up; it can be a separate small PR after PG10 lands.

---

### D-04 — Cabinet Tortila product card: no change needed for option (b)

The `ProductCabinetCard` for `tortila_bot` (PG9) shows setup state (exchange key + strategy config),
activity line, and warning signals. The backtester sub-feature is not part of the cabinet card's setup
checklist — correctly. An entitled Tortila user who has completed setup (2/2 items) will see "Ready"
on the cabinet card and then discover the backtester tab is locked when they navigate to it.

This ordering is the correct information hierarchy: the cabinet card describes product-level setup (is
the bot runnable?), not sub-feature availability. The locked backtester page is the right place to
communicate sub-feature status.

No change to the cabinet loader or `deriveProductCard` is needed for PG10.

---

### D-05 — No migration needed; option (b) is zero-table

**Evidence:** `docs/PRODUCTION_BLOCKERS.md` PG10 decision line; the current page uses `accessFor` +
`requireUser` only — no DB tables beyond `entitlements`/`sessions` which already exist.

Option (b) requires:
- Zero new tables (the `backtest_jobs`/`backtest_artifacts` tables are option (a) only)
- Zero new API routes (no job creation, no artifact upload, no runner download endpoint)
- Zero changes to `packages/db/src/schema.ts`
- `db:generate` confirms 41 tables, no schema changes — same as PG9

**Migration needed: false.**

---

## Summary: exact copy strings for all three states

For the implementer, the required string constants in one place:

```typescript
// Copy for page.tsx — option (b) locked card strings

// State 1: Legacy boundary
const LEGACY_KICKER = 'Legacy backtester';
const LEGACY_TITLE = 'Not available for this bot';
const LEGACY_BODY =
  'The Legacy Bot does not have a backtester. The Tortila Turtle strategy backtester ' +
  'is available under Bots → Tortila → Backtester.';

// State 2: Tortila not-entitled
const TORTILA_GATE_KICKER = 'Tortila backtester';
const TORTILA_GATE_TITLE = 'Access required';
// Banner title uses reasonLabel(access.reason) — dynamic
const TORTILA_GATE_DETAIL =
  'The backtester is a sub-feature of the Tortila Bot product. ' +
  'An active Tortila Bot subscription is required.';

// State 3: Tortila entitled, locked
const TORTILA_LOCKED_KICKER = 'Tortila backtester';
const TORTILA_LOCKED_TITLE = 'Backtester';
const TORTILA_LOCKED_COPY =
  'Backtests run locally on your machine via a downloadable runner package. ' +
  'The platform records job parameters and displays real uploaded results only — ' +
  'it never fabricates returns or equity curves.';
const TORTILA_LOCKED_STATUS_TITLE = 'Local runner not yet distributed';
const TORTILA_LOCKED_STATUS_DETAIL =
  'The downloadable runner package for the Tortila Turtle strategy backtester has not yet ' +
  'been released. When it ships, you will be able to configure a run here, download the ' +
  'runner, execute it locally, and upload the result artifact to view your equity curve ' +
  'and trade metrics. The platform never produces synthetic or illustrative backtest results. ' +
  'Only results from a real uploaded artifact are shown.';
```

No "coming soon", no "planned", no "future release", no "Download (soon)", no teaser button text.

---

## Risks

1. **BotSubNav Backtester tab for Legacy (F-04):** The tab remains and leads to State 1 unless the
   operator decides to suppress it. This is not a regression (the boundary card is honest) but it is
   mild nav pollution. Carry as a follow-on decision.

2. **`packages/backtester` orphan continues until cleaned up (F-03):** If `apps/web/package.json`
   retains the dependency, the package is compiled as a transpiled module without ever being used.
   This is low-risk but produces dead transpile cost and obscures the orphan status.

3. **Phase 6 type drift (D-02):** `BacktestParams.system: string` vs `system: 1 | 2`. If a Phase 6
   implementer copies the stub type without checking the plan, the Zod schema and the stub type will
   conflict at runtime. The comment added by D-02 and this handoff are the documented warning.

4. **State 3 metric grid at 375px:** The `.wtc-grid-2` collapse to 1fr at 640px is verified by the
   PG8/PG9 grid CSS. However, the specific metric tile content (multi-line `<p>` inside `.wtc-metric`)
   has not been e2e-tested at 375px. The implementer must add a 375px Playwright spec (see
   Verification below) or manually confirm no overflow.

5. **`SectionHeader copy` prop existence:** The current page uses `SectionHeader` with a `copy` prop
   at line 45. If the `SectionHeader` component does not render the `copy` prop (check
   `packages/ui/src/components.tsx`), State 3's architectural explanation will be silently dropped.
   The implementer must verify the `copy` prop renders or move the copy into the card body.

---

## Verification / tests

### Required for PG10

1. **Static source guard (new entry in `tests/integration/`):**
   `backtester-pg10.test.ts` — assert:
   - The page renders NO `<form>` element in any of the three states (search source for `<form` in
     `page.tsx` — must be zero matches after the fix).
   - The Legacy branch contains no string matching `/coming soon/i` or `/future release/i`.
   - The Tortila entitled branch contains no `disabled` button elements (`<button` + `disabled`).
   - The import list of `page.tsx` does NOT include `buttonClasses` (after the fix).
   - `@wtc/backtester` is NOT imported in `page.tsx`.

2. **E2e at 375px (Playwright, 375px viewport project):**
   `backtester-pg10-mobile.spec.ts` — navigate to:
   - `/app/bots/legacy/backtester`: assert "Not available for this bot" heading visible; assert no
     form element; assert no "coming soon" text; assert `document.body.scrollWidth === window.innerWidth`.
   - `/app/bots/tortila/backtester` (demo/mock mode, user not entitled): assert `RiskWarningBanner`
     visible; assert no form element.
   - `/app/bots/tortila/backtester` (demo/mock mode, user entitled): assert "Local runner not yet
     distributed" status strip visible; assert no form element; assert no disabled button; assert
     `document.body.scrollWidth === window.innerWidth`.

3. **Gate: `npm run lint`** — must pass `--max-warnings 0` after removing unused `buttonClasses` import.

4. **Gate: `npm run typecheck`** — must pass after removing `@wtc/backtester` from `apps/web/package.json`
   (if that cleanup is included in PG10 scope; otherwise the orphan continues without typecheck impact
   since it is never imported in source).

5. **Manual verification:**
   - At 375px: all three states render without horizontal page scroll.
   - State 3: no button or input is focusable (no false interactive affordance).
   - State 2: the CTA link has `min-height >= 44px` (`.wtc-btn` base rule from PG9).
   - State 1: no interactive elements at all.

### Gates NOT RUN in this audit (read-only)

All gates are not run — this is a read-only audit session. The implementer's gates will include:
`check:core`, `lint`, `typecheck`, `secret:scan`, `vitest`, `db:generate` (must stay 41 tables),
`build`, `e2e`. Per `SESSION_PROTOCOL.md §6`, each must be observed green in the implementation session.

---

## Next actions

| Priority | Action | Owner | Target file(s) |
|---|---|---|---|
| P0 | Fix State 1: replace `<Card title="Coming soon">` block with permanent boundary card (copy in D-01 State 1) | frontend-implementer | `apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx` |
| P0 | Fix State 2: verify existing `!access.allowed` branch copy is accurate (it is close — `reasonLabel(access.reason)` reuse is correct); add detail copy from D-01 State 2 to the `<Card>` body | frontend-implementer | same page |
| P0 | Fix State 3: replace the dead form + two disabled buttons with the honest locked card (copy in D-01 State 3); remove `buttonClasses` import | frontend-implementer | same page |
| P1 | Add static guard tests `backtester-pg10.test.ts` (no-form, no-disabled-button, no-coming-soon assertions) | tests-runner | `tests/integration/backtester-pg10.test.ts` |
| P1 | Add 375px Playwright spec `backtester-pg10-mobile.spec.ts` | tests-runner | `tests/e2e/backtester-pg10-mobile.spec.ts` |
| P1 | Remove `"@wtc/backtester": "*"` from `apps/web/package.json` + `'@wtc/backtester'` from `apps/web/next.config.ts` (orphan cleanup) | frontend-implementer | `apps/web/package.json`, `apps/web/next.config.ts` |
| P2 | Add design-stub comment to top of `packages/backtester/src/index.ts` | frontend-implementer | `packages/backtester/src/index.ts` |
| P2 | Operator decision: suppress `backtester` tab in `BotSubNav` for Legacy Bot (Option A in F-04) or retain with honest boundary card (Option B — minimum PG10 scope) | operator | `apps/web/src/components/BotSubNav.tsx` |
| P3 | Phase 6 (future): when option (a) is greenlit, replace stub types in `packages/backtester/src/index.ts` (fix `system: string` → `system: 1 | 2`); scaffold real Zod schemas, job CRUD, tokens, artifact validation, `ArtifactStorage` | backtester-implementer (future) | `packages/backtester/src/` |

---

## Migration needed

False. Zero new tables, zero new routes, zero schema changes. `db:generate` must report 41 tables with
"No schema changes, nothing to migrate" — identical to PG9 baseline.

---

*End of handoff — ecosystem-ux-ui-designer, epoch 20260531-0030.*
