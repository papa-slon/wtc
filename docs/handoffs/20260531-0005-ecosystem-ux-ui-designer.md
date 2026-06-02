# Handoff — ecosystem-ux-ui-designer
**Epoch:** 20260531-0005  
**Phase:** PG9 — User cabinet / product UX  
**Session role:** Read-only UX audit + design specification  
**Status:** COMPLETE — design specifications ready for serial implementation

---

## Scope

Design the enriched per-product cabinet card (`ProductCabinetCard`) and the bot exchange-key setup
wizard for PG9. Covers:

1. Cabinet card anatomy — entitlement pill, setup indicator, activity line, single CTA, blocker line.
2. Component decision — new `ProductCabinetCard` vs enriching `ProductStatusCard`.
3. Setup wizard UX — stepper for bot exchange-key → strategy config → review (3 steps).
4. Per-product state map for all 6 product codes.
5. Responsive and accessibility requirements at 375 px.
6. DESIGN_SYSTEM.md section recommendations (new §15 + §16 content, to be applied by operator serialize-last).

---

## Files inspected

| File | Relevance |
|---|---|
| `apps/web/src/app/(app)/app/page.tsx` | Cabinet overview page — current `ProductStatusCard` render loop |
| `packages/ui/src/components.tsx` | `ProductStatusCard` (lines 86–108), all base UI primitives |
| `packages/ui/src/theme.css` | All CSS tokens + `.wtc-table-wrap` card-stack (PG8) |
| `packages/ui/src/index.ts` | Export surface — what is currently exported |
| `apps/web/src/lib/access.ts` | `accessFor`, `reasonLabel`, `reasonTone` — all 9 `AccessReason` values |
| `apps/web/src/lib/product-status.ts` | `PRODUCT_AVAILABILITY` per-code availability taxonomy |
| `packages/entitlements/src/engine.ts` | `AccessDecision`, `Entitlement`, `AccessReason` full type set |
| `packages/entitlements/src/registry.ts` | `PRODUCT_CODES`, `PRODUCTS`, `PLANS`, `expandPlan` |
| `apps/web/src/features/bots/meta.ts` | `BOT_CAPS`, `botHealthPill`, `BotCapabilities` |
| `apps/web/src/features/bots/config.ts` | `loadBotConfig`, `BOT_CONFIG_FIELDS`, `botConfigSchema` |
| `apps/web/src/features/bots/data.tsx` | `loadBot`, `BotAccessRequired` shared gate |
| `apps/web/src/features/terminal/loader.ts` | `loadTerminalRelease`, `TerminalLoaderResult` |
| `apps/web/src/features/lms/queries.ts` | `loadStudentCatalogue`, `loadTeacherWorkspace` |
| `apps/web/src/features/tv/queries.ts` | `loadTvUserData`, `TvUserData` |
| `apps/web/src/lib/backend.ts` | `backendMode`, `getServerDb`, `listExchangeKeys`, `addExchangeKey` |
| `apps/web/src/app/(app)/app/security/page.tsx` | Current flat exchange-key add form |
| `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx` | Current strategy config form |
| `apps/web/src/app/(app)/app/terminal/page.tsx` | Full terminal product page pattern |
| `apps/web/src/app/(app)/app/indicators/page.tsx` | TV indicators page pattern |
| `apps/web/src/app/(app)/app/layout.tsx` | Shell layout — `MobileNav` already rendered |
| `apps/web/src/components/MobileNav.tsx` | Bottom nav component (PG8 addition) |
| `apps/web/src/lib/nav.ts` | `APP_NAV` item list |
| `packages/bot-adapters/src/types.ts` | `BotHealth`, `ReadState`, `RiskWarning` types |
| `packages/bot-adapters/src/warnings.ts` | `TORTILA_WARNINGS`, `LEGACY_WARNINGS`, `TORTILA_PERSISTENT_WARNINGS` |
| `docs/PRODUCTION_BLOCKERS.md` | B2/B3/B4 blocker definitions (exact copy text) |
| `docs/DESIGN_SYSTEM.md` | Sections 1–12 — tokens, type scale, state matrix |
| `docs/handoffs/0000-orchestrator-seed.md` | Design token lock, product code canon |
| `docs/ROADMAP_MASTER.md` | PG9 scope + status labels |
| `docs/EXECUTION_PLAN_MASTER.md` | W10 definition |
| `v2-terminal-os.html` | Visual direction — terminal-OS fintech dark |

---

## Files changed

**None — read-only audit.** One file created: this handoff.

---

## Findings

### F-01 — HIGH — Current cabinet card is entitlement-only; no setup, activity, or blocker signals
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:55–66`  
The cabinet page renders `ProductStatusCard` with only `{ allowed, reason, statusLabel, href, ctaLabel }`.
The card at `packages/ui/src/components.tsx:86–108` has no slot for setup progress, recent activity,
or blocker copy. A user with an active tortila_bot entitlement and zero exchange keys sees a green
"Active / Open" card — the same card as a fully-configured user. Setup state is completely invisible.

**Recommendation:** Replace with `ProductCabinetCard` (new component, see Decision D-01 and spec below).
The new card carries five distinct zones: entitlement pill, setup indicator, activity line, single CTA,
blocker strip. All zones are required props with explicit empty/unknown defaults — never inferred from
client state.

---

### F-02 — HIGH — Tortila risk warnings not surfaced on the cabinet overview card
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:31,44–50`  
`blockingTortila` (error-severity warnings) is rendered as a separate `Card` below the summary metrics,
but the individual product card for `tortila_bot` has no visual indication that a P0 warning is active.
A user scanning the product grid sees "Active" on the Tortila card and must separately notice the warning
section below. The DESIGN_SYSTEM §1 "fail-visible" rule requires risk warnings as first-class card-level UI.

**Recommendation:** The `ProductCabinetCard` for `tortila_bot` must include a `warningCount` prop
(integer ≥ 0). When warningCount > 0, the card renders a condensed warning strip inside the card itself
(not a separate page-level card). The page-level `RiskWarningBanner` block is still shown; the card strip
is additive.

---

### F-03 — HIGH — Legacy bot card shows "Get access" CTA when access is blocked by B3, not by entitlement
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:63`  
When `reason === 'blocked_no_entitlement'` the CTA is "Get access" which implies purchasing will fix
the situation. But `BOT_CAPS.legacy_bot.liveAdapterBlocked = true` (`apps/web/src/features/bots/meta.ts:77`)
means purchasing does not unblock live data — the adapter is hard-blocked by B3. The card does not
distinguish between "blocked because you have no subscription" and "live data blocked regardless of
entitlement state."

**Recommendation:** `ProductCabinetCard` for `legacy_bot` must always render the B3 blocker strip when
`BOT_CAPS.legacy_bot.liveAdapterBlocked === true`, regardless of entitlement state. Copy: "Live data
unavailable — upstream security gate (B3) open." The CTA changes to "View status" (not "Get access")
when B3 is the primary obstacle and the user already has an entitlement; remains "Get access" only when
both entitlement is absent AND B3 is open (the user should understand both facts).

---

### F-04 — MEDIUM — Cabinet card has no mobile responsive treatment
**Evidence:** `packages/ui/src/theme.css:63–67` + `apps/web/src/app/(app)/app/page.tsx:53`  
The cabinet grid uses `.wtc-grid wtc-grid-3` which collapses to 1fr at 640px. The card itself at
`packages/ui/src/components.tsx:97–107` uses only inline-flex header and a single `<a>` CTA.
There is no minimum tap-target declaration and no column reorder for mobile. The CTA anchor uses
`buttonClasses(...)` which at 640px collapse has `min-height: 44px` via `.wtc-btn` (theme.css:176),
but only inside `.wtc-table-wrap`. Outside that context the `min-height` is not set.

**Recommendation:** `.wtc-btn` must have `min-height: 44px` unconditionally (not only inside
`.wtc-table-wrap`). The `ProductCabinetCard` at 375px must render as a full-width single-column block.
The setup indicator, activity line, and CTA must stack vertically with explicit spacing.

---

### F-05 — MEDIUM — Axioma cabinet card CTA is "Open" when all three CTAs are dev placeholders
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:63` + `apps/web/src/app/(app)/app/terminal/page.tsx:163–175`  
When `axioma_terminal` access is allowed, the cabinet card CTA reads "Open" (the `allowed ? 'Open' : ...`
branch). But the terminal page shows all real CTAs as `disabled` with `isDev` placeholders (B4).
The cabinet card CTA "Open" creates a misleading expectation that the terminal is fully operational.

**Recommendation:** `ProductCabinetCard` for `axioma_terminal` must surface the B4 blocker strip:
"Download and journal CTAs are dev placeholders — pending Axioma endpoint confirmation (B4)." The CTA
label changes from "Open" to "View details" so it honestly navigates to the product page without implying
operational readiness.

---

### F-06 — MEDIUM — Exchange-key page is a flat form with no wizard flow or step context
**Evidence:** `apps/web/src/app/(app)/app/security/page.tsx:35–47`  
The security page is a flat single-step form. There is no connection between "add exchange key" and
"configure bot strategy" and "review + go live". A user who just added a key has no guided path to the
next action (strategy config at `/app/bots/[bot]/settings`). The PG9 deliverable calls for a wizard
starting from exchange-key onboarding.

**Recommendation:** Build a three-step wizard at `/app/bots/[bot]/setup` (a new route). The existing
security page remains for standalone key management. The wizard makes the bot-setup intent explicit.
See Decision D-02 and wizard spec below.

---

### F-07 — LOW — Club product card points to `/app/billing` which has no club-specific content
**Evidence:** `apps/web/src/app/(app)/app/page.tsx:14`; `apps/web/src/lib/product-status.ts:19`  
`club` routes to `/app/billing` (`productHref` returns `/app/billing`). `PRODUCT_AVAILABILITY.club`
is `{ status: 'planned', note: 'Not yet available' }`. The billing page is a general billing surface.
The cabinet card gives no honest signal that club is planned (not missing entitlement, not purchasable).

**Recommendation:** `ProductCabinetCard` for `club` must show the availability status from
`PRODUCT_AVAILABILITY` as a secondary pill and set the CTA to "Planned — not yet available" (disabled
button, no href navigation).

---

### F-08 — LOW — No `.wtc-wizard` / `.wtc-step` CSS classes exist in theme.css
**Evidence:** `packages/ui/src/theme.css` — full file reviewed. No wizard-specific selectors.  
The DESIGN_SYSTEM.md §7.9 Accordion mentions "Bot setup wizard steps" as a use case for accordions,
but no CSS foundation exists for a linear multi-step wizard pattern.

**Recommendation:** Add `.wtc-wizard`, `.wtc-wizard-steps`, `.wtc-step`, `.wtc-step.active`,
`.wtc-step.done`, `.wtc-step.locked` classes to `theme.css`. See the CSS spec in Decision D-02.
These are minimal (no JavaScript dependency) — the active step is determined server-side by query
param or route structure.

---

### F-09 — INFO — `reasonTone` in access.ts maps `pending_payment` to `warn` but `blocked_no_entitlement` to `neutral`
**Evidence:** `apps/web/src/lib/access.ts:29–33`  
The current tone mapping is:
- `allowed` → `ok`
- `grace | pending_payment | manual_review` → `warn`
- `blocked_no_entitlement` → `neutral`
- everything else → `bad`

This is correct as a pill tone, but the cabinet card needs a SEPARATE copy string per reason (not just
a tone), plus a distinct icon treatment. The entitlement pill alone is insufficient for operational
decision-making; the user needs to know what to DO. The copy map below (Decision D-03) extends this
without changing `reasonTone`.

---

## Decisions

### D-01 — New `ProductCabinetCard` component in `packages/ui`; do NOT modify `ProductStatusCard`

`ProductStatusCard` is the correct component for the marketing/public catalog. The cabinet is a different
information surface (operational, dense, 5 zones). Enriching `ProductStatusCard` would break the clean
primitive and force marketing pages to carry cabinet props. Create `ProductCabinetCard` as a new export.

**Prop shape:**

```typescript
// packages/ui/src/components.tsx (new addition)

export interface CabinetSetupItem {
  label: string;
  done: boolean;
}

export interface ProductCabinetCardProps {
  // Identity
  code: string;           // ProductCode — drives icon/border treatment
  name: string;
  // Entitlement
  allowed: boolean;
  reason: string;         // AccessReason
  entitlementLabel: string;  // from ACCESS_REASON_COPY[reason].label
  entitlementTone: Tone;     // from reasonTone(reason)
  /** ISO date string OR null. Show grace/expiry countdown when within 14 days. */
  periodEnd: string | null;
  // Setup
  /** Setup checklist items. Empty array = no setup required for this product. */
  setupItems: CabinetSetupItem[];
  // Activity
  /** One-line activity summary. MUST be "—" when unknown/unavailable. Never null. */
  activityLine: string;
  /** epoch-ms of last activity. null = unknown. */
  activityAt: number | null;
  // CTA
  ctaLabel: string;
  ctaHref: string | null;    // null = disabled button (planned/fully-blocked)
  ctaVariant: 'primary' | 'secondary' | 'ghost';  // primary only when allowed + setup complete
  // Blocker
  /** Null = no active blocker. Non-null = render blocker strip at card bottom. */
  blockerText: string | null;
  blockerRef: string | null;    // e.g. 'B3', 'B4', 'B2', 'demo'
  // Warnings
  /** Count of ACTIVE risk warnings (severity error or warning). 0 = no strip. */
  warningCount: number;
  /** Highest severity active warning. Used for strip tone. */
  warningMaxSeverity: 'error' | 'warning' | 'info' | null;
  // Availability
  /** From PRODUCT_AVAILABILITY. Controls secondary pill when status is not 'available'. */
  availabilityStatus: 'available' | 'demo' | 'planned' | 'disabled';
}
```

**Card anatomy (visual zones, top to bottom):**

```
┌─────────────────────────────────────────────────┐
│ [ProductName]              [Entitlement Pill]   │  ← header row
│ [Availability pill — only when demo/planned]    │  ← secondary pill (conditional)
├─────────────────────────────────────────────────┤
│ Setup: ○ Add exchange key  ✓ Strategy config    │  ← setup zone (hidden when no items)
├─────────────────────────────────────────────────┤
│ Activity: Last signal 2h ago                    │  ← activity zone (always "—" default)
├─────────────────────────────────────────────────┤
│ ⚠ 2 active warnings                            │  ← warning strip (only warningCount > 0)
├─────────────────────────────────────────────────┤
│ [Primary CTA button — full width on mobile]     │  ← CTA zone
│ ! Blocker: B3 — live data unavailable           │  ← blocker strip (only when blockerText)
└─────────────────────────────────────────────────┘
```

**Card border treatment:**
- `allowed + setup complete`: `--stroke` (default)
- `allowed + setup incomplete`: `--stroke-gold` (gold-tint, draws attention)
- `grace`: `--stroke-gold` with amber left border 3px
- `revoked | chargeback | refunded`: `--red` alpha stroke
- `planned | demo`: `--stroke` (no premium treatment)
- `warningCount > 0 + severity error`: `--red` alpha stroke overrides entitlement treatment

---

### D-02 — Multi-route wizard at `/app/bots/[bot]/setup/[step]`; server-action friendly

**Decision:** Multi-route (one URL per step) not single-page progressive. Rationale:
1. Each step's form is a server action — Next.js App Router server actions work best per-route.
2. The user can deep-link to step 2 if they already did step 1.
3. Back/forward browser navigation works correctly.
4. Step state (done/not-done) is derived from real DB data on each server render — no client state.

**Routes:**
```
/app/bots/[bot]/setup           → redirect to step 1 (or step 2 if key exists)
/app/bots/[bot]/setup/key       → Step 1: Add exchange key (or "key saved" confirmation)
/app/bots/[bot]/setup/strategy  → Step 2: Strategy configuration
/app/bots/[bot]/setup/review    → Step 3: Review + "Live control disabled" notice
```

**Wizard CSS (to add to `packages/ui/src/theme.css`):**

```css
/* ── Multi-step wizard (PG9) ───────────────────────────────────────────────
 * Usage: wrap steps in .wtc-wizard; each step is .wtc-step.
 * Active step: .wtc-step.active. Completed: .wtc-step.done. Locked: .wtc-step.locked.
 * The step indicator uses a counter-driven circle, pure CSS, no JavaScript.
 */
.wtc-wizard {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Step connector line between steps */
.wtc-wizard-steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 28px;
  overflow-x: auto;    /* allow horizontal scroll only on this row, not the page */
  scrollbar-width: none;
}
.wtc-wizard-steps::-webkit-scrollbar { display: none; }

.wtc-step-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.wtc-step-tab:not(:last-child)::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--stroke);
  margin: 0 8px;
}
.wtc-step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--stroke);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--dim);
  flex-shrink: 0;
}
.wtc-step-label {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Active step */
.wtc-step-tab.active .wtc-step-circle {
  border-color: var(--gold);
  background: rgba(213, 169, 79, 0.12);
  color: var(--gold2);
}
.wtc-step-tab.active .wtc-step-label { color: var(--text); }

/* Done step */
.wtc-step-tab.done .wtc-step-circle {
  border-color: rgba(84, 214, 161, 0.5);
  background: rgba(84, 214, 161, 0.08);
  color: var(--green);
}
.wtc-step-tab.done .wtc-step-label { color: var(--muted); }

/* Locked step */
.wtc-step-tab.locked .wtc-step-circle { opacity: 0.4; }
.wtc-step-tab.locked .wtc-step-label { opacity: 0.4; }

/* At 375px: step labels truncate; circles stay 28px; no horizontal page scroll */
@media (max-width: 640px) {
  .wtc-wizard-steps {
    gap: 0;
    padding-bottom: 4px;
  }
  .wtc-step-label { max-width: 72px; }
}
```

**Wizard step content container:**
```css
.wtc-wizard-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

**Step 1 — Add exchange key (`/app/bots/[bot]/setup/key`):**

Reuses the existing `addExchangeKey` server action from `/app/security`. The step renders:
- `RiskWarningBanner severity="info"` — "Use demo mode first. Grant minimum exchange permissions."
- Exchange select, Label input, API key (type=password), API secret (type=password), Mode select.
- `CsrfField` + submit button: "Encrypt & save key — step 1 of 3".
- If the user already has a key for this exchange: confirmation card + "Next: Strategy config" link.
- Never shows plaintext key values — only `keyMask` after save.

At 375px: all form fields stack single-column; submit button is full-width (`width: 100%`); all inputs
`min-height: 44px`.

**Step 2 — Strategy config (`/app/bots/[bot]/setup/strategy`):**

Renders the same fields as the existing settings page (`BOT_CONFIG_FIELDS`). The difference is context:
- Progress header shows "Step 2 of 3 — Strategy".
- `RiskWarningBanner severity="info"` — "Config is stored in WTC only — never sent to the live bot."
- Submit button: "Save strategy — step 2 of 3".
- "Back to step 1" ghost link.
- After submit, `revalidatePath` + redirect to step 3.

**Step 3 — Review (`/app/bots/[bot]/setup/review`):**

Read-only summary screen:
- Setup checklist (all items with done/pending status).
- `RiskWarningBanner severity="warning"` — "Live bot control stays disabled. WTC stores config; it is not applied to any running process. 'Stop bot' never closes positions."
- If `BOT_CAPS[code].liveAdapterBlocked`: `RiskWarningBanner severity="error"` — exact B3 text from
  `BOT_CAPS.legacy_bot.liveAdapterBlockedReason`.
- If Tortila warnings exist: compact warning list (code + title; severity dot; link to full dashboard).
- Primary CTA: "Open bot dashboard" → `/app/bots/[bot]`.

---

### D-03 — ACCESS_REASON_COPY map: exact label + secondary copy per reason

These strings are the canonical source for cabinet card text. They must be defined as a pure data
object in `apps/web/src/lib/access.ts` (or a new `apps/web/src/lib/cabinet-copy.ts` if the implementer
prefers to keep the file bounded). The map must be consumed by the cabinet page; never inferred ad hoc.

```typescript
export interface AccessReasonCopy {
  label: string;        // entitlement pill label (replaces reasonLabel for cabinet)
  detail: string;       // one-line sub-text shown below the pill in the card header
  ctaLabel: string;     // default CTA label for this reason
  ctaVariant: 'primary' | 'secondary' | 'ghost';
}

export const ACCESS_REASON_COPY: Record<AccessReason, AccessReasonCopy> = {
  allowed: {
    label: 'Active',
    detail: 'Entitlement active.',
    ctaLabel: 'Open',
    ctaVariant: 'primary',
  },
  grace: {
    label: 'Grace period',
    detail: 'Subscription lapsed — access continues briefly. Renew now.',
    ctaLabel: 'Renew subscription',
    ctaVariant: 'secondary',
  },
  pending_payment: {
    label: 'Pending payment',
    detail: 'Payment is processing. Access will activate once confirmed.',
    ctaLabel: 'Check billing',
    ctaVariant: 'ghost',
  },
  expired: {
    label: 'Expired',
    detail: 'Subscription ended. Purchase to restore access.',
    ctaLabel: 'Get access',
    ctaVariant: 'secondary',
  },
  revoked: {
    label: 'Revoked',
    detail: 'Access was administratively revoked. Contact support.',
    ctaLabel: 'Contact support',
    ctaVariant: 'ghost',
  },
  refunded: {
    label: 'Refunded',
    detail: 'Purchase was refunded — access has ended.',
    ctaLabel: 'Get access',
    ctaVariant: 'ghost',
  },
  chargeback: {
    label: 'Chargeback',
    detail: 'Chargeback opened — access suspended. Contact support.',
    ctaLabel: 'Contact support',
    ctaVariant: 'ghost',
  },
  manual_review: {
    label: 'Manual review',
    detail: 'Account flagged for admin review. Access suspended.',
    ctaLabel: 'Contact support',
    ctaVariant: 'ghost',
  },
  blocked_no_entitlement: {
    label: 'Not subscribed',
    detail: 'No active entitlement for this product.',
    ctaLabel: 'Get access',
    ctaVariant: 'secondary',
  },
  blocked_unknown_state: {
    label: 'Unknown state',
    detail: 'Entitlement state could not be determined. Contact support.',
    ctaLabel: 'Contact support',
    ctaVariant: 'ghost',
  },
};
```

**B2 CTA override:** When `reason === 'blocked_no_entitlement'` AND B2 (Stripe checkout NOT RUN),
the CTA label becomes "Contact support — billing not yet live" and `ctaHref` points to `/app/support`
(not a purchase flow). This must be toggled by checking `BILLING_CHECKOUT_ENABLED` env flag (false in
current build). The cabinet page does this override; the copy map supplies the base.

---

### D-04 — Per-product state map (all 6 codes)

#### `tortila_bot`

| Zone | Content |
|---|---|
| Entitlement pill | `ACCESS_REASON_COPY[reason].label` |
| Secondary pill | When `PRODUCT_AVAILABILITY.tortila_bot.status === 'demo'`: gold pill "Preview data" |
| Setup items | 1. "Exchange key added" (done = listExchangeKeys(userId).length > 0); 2. "Bot strategy saved" (done = loadBotConfig(userId,'tortila_bot').version != null) |
| Setup indicator | "Setup 0/2 — Start setup" if no items done; "Setup 1/2 — Strategy needed" if key only; "Setup 2/2 — Ready" if both done |
| Activity line | When allowed + adapter ok: "Journal synced [relative time] ago" from `lastSyncAt`; when not_configured: "Journal not configured — add JOURNAL_READ_TOKEN"; when unreachable: "Journal unreachable"; else "—" |
| CTA | allowed + setup 2/2: "Open dashboard"; allowed + setup incomplete: "Complete setup"; not allowed: `ACCESS_REASON_COPY[reason].ctaLabel` |
| CTA href | allowed: `/app/bots/tortila`; setup incomplete: `/app/bots/tortila/setup`; not allowed: billing or support per copy map |
| Blocker | `warningCount` from `TORTILA_WARNINGS.filter(w => w.severity==='error').length` — always 2 in current build (tp_reconcile_p0 + margin_preflight_p1 are unresolved P0/P1). Strip: "2 unresolved risk signals — P0 TP reconciliation, P1 margin pre-flight." |
| Warning strip | `warningMaxSeverity: 'error'` — red strip, always |
| Demo state | Secondary gold pill "Preview data"; activity line "Simulated data — JOURNAL_READ_TOKEN not configured" |

#### `legacy_bot`

| Zone | Content |
|---|---|
| Entitlement pill | `ACCESS_REASON_COPY[reason].label` |
| Secondary pill | Always gold "Preview data" (adapter is permanently blocked on B3; live data impossible regardless of entitlement) |
| Setup items | None — cannot configure a live adapter in B3-blocked state. Empty `setupItems: []`. |
| Setup indicator | Not rendered (no setup items). |
| Activity line | Always "—" — live adapter hard-blocked (B3); no real data ever shown. |
| CTA | allowed: "View status" (navigates to /app/bots/legacy, which shows the B3 banner); not allowed: "Get access" |
| Blocker | Always rendered: "Live data unavailable — upstream security gate open (B3). Displayed data is illustrative only." `blockerRef: 'B3'` |
| Warning strip | `warningCount: 1` (legacy_plaintext_keys error); red strip: "Exchange key security gate open" |
| Demo state | Same as blocked state — demo and blocked are the same for legacy_bot |

#### `axioma_terminal`

| Zone | Content |
|---|---|
| Entitlement pill | `ACCESS_REASON_COPY[reason].label` |
| Secondary pill | When `PRODUCT_AVAILABILITY.axioma_terminal.status === 'demo'`: gold pill "Dev bridge" |
| Setup items | 1. "Axioma account linked" (done = false until B4 clears); 2. "ES256 signing key configured" (done = jwksConfigured from env presence check) |
| Setup indicator | "Setup 0/2 — Account link pending" |
| Activity line | "—" (no live journal reads in dev mode; `isDev = true` until B4 clears) |
| CTA label | allowed: "View details" (NOT "Open" — see F-05; CTAs are placeholders); not allowed: `ACCESS_REASON_COPY[reason].ctaLabel` |
| CTA href | always `/app/terminal` |
| CTA variant | allowed: 'ghost' (downgraded from primary — product is not operationally ready); not allowed: per copy map |
| Blocker | "Download and journal are dev placeholders — endpoint confirmation and signing key pending (B4)." `blockerRef: 'B4'` |
| Warning strip | `warningCount: 0` (Axioma has no persistent risk warnings in the current build) |
| Demo state | Secondary "Dev bridge" pill; blocker always shown |
| Note on account-link | The "Connect Axioma account" button is `disabled` with explicit tooltip text. The cabinet card does NOT show the connect button — that is on the product detail page. The cabinet card only shows the setup indicator showing the item is incomplete. |

#### `tradingview_indicators`

| Zone | Content |
|---|---|
| Entitlement pill | `ACCESS_REASON_COPY[reason].label` |
| Secondary pill | When `PRODUCT_AVAILABILITY.tradingview_indicators.status === 'demo'`: gold "Demo queue" |
| Setup items | 1. "TradingView username submitted" (done = tvData.requests.length > 0); 2. "Admin grant active" (done = tvData.grants.some(g => g.revokedAt == null)) |
| Setup indicator | Pending grant: "Submitted — awaiting admin"; granted: "Active"; not submitted: "Username needed" |
| Activity line | When granted: "Grant active — expires [date or 'no expiry']"; when expiring_soon: "Expiring in [N] days"; when pending: "Request submitted [date] — pending review"; when no request: "—" |
| CTA | allowed + granted: "View indicators" → `/app/indicators`; allowed + pending: "View request status" → `/app/indicators`; not allowed: "Get access" |
| Blocker | When `tvData.mode === 'demo'`: "Demo mode — requests not persisted. Set DATABASE_URL." `blockerRef: 'demo'` |
| Warning strip | `warningCount: 0` normally. If expiring in < 14 days and `warningCount === 0`: set `warningCount: 1`, `warningMaxSeverity: 'warning'`, activity line "Expiring in N days — renew entitlement". |

#### `education`

| Zone | Content |
|---|---|
| Entitlement pill | `ACCESS_REASON_COPY[reason].label` |
| Secondary pill | When `lmsMode() === 'demo'`: gold "Demo" |
| Setup items | None (no user-side setup required — enrollment is on the education pages). |
| Setup indicator | Not rendered. |
| Activity line | When allowed + DB: "N courses, M% progress" (from `loadStudentCatalogue` — sum of progressPct / count); when allowed + demo: "Demo mode — progress not persisted"; when not allowed: "—" |
| CTA | allowed: "Open education" → `/app/education`; not allowed: `ACCESS_REASON_COPY[reason].ctaLabel` |
| Blocker | When `lmsMode() === 'demo'`: "Demo mode — course progress not persisted (B1 — DATABASE_URL unset)." `blockerRef: 'demo'` |
| Warning strip | `warningCount: 0` |

#### `club`

| Zone | Content |
|---|---|
| Entitlement pill | `ACCESS_REASON_COPY[reason].label` (will always be 'Not subscribed' currently) |
| Secondary pill | Gold "Planned" |
| Setup items | None |
| Setup indicator | Not rendered |
| Activity line | "—" |
| CTA label | "Coming soon" |
| CTA href | null (disabled button) |
| CTA variant | 'ghost' + `disabled` attr |
| Blocker | "Private Club access is not yet available in this build." `blockerRef: null` |
| Warning strip | `warningCount: 0` |

---

### D-05 — Cabinet data loader: `loadCabinetData(userId)` in `apps/web/src/app/(app)/app/page.tsx`

The cabinet page server component must call a single loader per product code that returns a
`CabinetProductState` object. This loader calls the existing feature queries (no new DB queries, no
new tables — PG9 is NO migration). All queries are already behind `getServerDb()` null-guards.

```typescript
// Conceptual shape — implementer places in a local lib, NOT a shared package
// (app-layer only, not unit-testable via vitest, covered by static guard tests)
interface CabinetProductState {
  code: ProductCode;
  // from accessFor()
  allowed: boolean;
  reason: AccessReason;
  entitlement: Entitlement | undefined;
  // derived
  periodEnd: string | null;
  setupItems: CabinetSetupItem[];
  activityLine: string;
  activityAt: number | null;
  ctaLabel: string;
  ctaHref: string | null;
  ctaVariant: 'primary' | 'secondary' | 'ghost';
  blockerText: string | null;
  blockerRef: string | null;
  warningCount: number;
  warningMaxSeverity: 'error' | 'warning' | 'info' | null;
  availabilityStatus: 'available' | 'demo' | 'planned' | 'disabled';
}
```

Loading strategy:
- `tortila_bot`: parallel — `accessFor` + `listExchangeKeys(userId)` + `loadBotConfig(userId, 'tortila_bot')`. Warning count from `TORTILA_WARNINGS` (static — always 2 error-severity in current build).
- `legacy_bot`: `accessFor` only — no live data queries (adapter is blocked).
- `axioma_terminal`: `accessFor` + `loadTerminalRelease('stable', 'windows-x64')` (for `jwksConfigured`).
- `tradingview_indicators`: `accessFor` + `loadTvUserData(userId)`.
- `education`: `accessFor` + `loadStudentCatalogue(userId, allowed)`.
- `club`: `accessFor` only.

All 6 product loaders can run in parallel (`Promise.all`). The page currently already does this for
`accessFor`; it must be extended to include the per-product sub-queries.

---

## Risks

1. **Performance:** Cabinet page now fires 6 parallel `accessFor` calls plus per-product sub-queries.
   In Postgres mode this is ~10–14 queries. All are indexed. Acceptable for an authenticated dashboard.
   If P50 > 500ms, switch to a single `getServerDb()` pass with one batch `entitlementsOf` and
   per-product queries sharing the same DB connection. Mark as a performance observation, not a blocker.

2. **TORTILA_WARNINGS count is static:** The warning count (2 errors) in the cabinet card is derived
   from the static `TORTILA_PERSISTENT_WARNINGS` constant. It will always show "2 unresolved signals"
   until the warnings are cleared in the registry. This is the correct honest behavior. If the
   implementer instead derives the count from a live adapter call, the card must handle `not_configured`
   gracefully (count stays 2 from the static persistent set regardless of adapter state).

3. **B4 blocker text hardcoded:** The Axioma B4 blocker text is a static string in the cabinet loader.
   When B4 clears (endpoint shapes confirmed + signing key provisioned), the blocker text must be
   removed explicitly. Recommend a `AXIOMA_B4_CLEARED` env flag that the implementer can check.

4. **Demo mode misleading:** When `backendMode === 'memory'`, activity lines that normally query the DB
   will return empty/null (all loaders already return demo-safe defaults). The implementer must verify
   that every activity line defaults to "—" in demo mode and is never fabricated.

5. **Wizard route conflict:** `/app/bots/[bot]/setup` must not conflict with existing `/app/bots/[bot]`
   subroutes (overview, settings, positions, trades, equity, safety). The `setup` segment is not in
   the current `BotSubNav`. The implementer must add it only to the wizard pages, not to `BotSubNav`.

---

## Verification / tests

### Static guard tests (PG8 pattern — `tests/integration/`)

The following must be added to the static source-analysis guard tests:

1. **`cabinet-card-states.test.ts`** — assert that for each of the 6 product codes, the `CabinetProductState`
   shape has non-null `ctaLabel`, a valid `ctaVariant`, `activityLine !== null`, and `blockerText` is
   `string | null` (not `undefined`). Use the demo/memory data paths; no DB needed.

2. **`access-reason-copy.test.ts`** — assert that every member of `AccessReason` has a key in
   `ACCESS_REASON_COPY` and that each entry has non-empty `label`, `detail`, `ctaLabel`, and one of
   the three valid `ctaVariant` values. Pure data test; zero dependencies.

3. **`wizard-steps.test.ts`** — assert that each wizard step (`key`, `strategy`, `review`) exists as
   a file in `apps/web/src/app/(app)/app/bots/[bot]/setup/[step]/`. Import shape only.

### E2e (Playwright, 390px mobile project)

4. **`cabinet-cards.e2e.ts`** — at 390px viewport: cabinet grid renders as single column; each
   `ProductCabinetCard` has a visible button with `min-height >= 44` (assert via `getBoundingClientRect`);
   no horizontal scroll (`document.body.scrollWidth === window.innerWidth`).

5. **`wizard-flow.e2e.ts`** — navigate to `/app/bots/tortila/setup`; assert wizard step tabs are
   visible and not overflowing at 390px; complete step 1 (CSRF + form); assert redirect to step 2.

### Manual verification checklist

6. At 375px (explicit viewport): no element extends beyond `window.innerWidth`; all CTAs have tap
   target height ≥ 44px; focus order is logical (entitlement pill → setup → activity → CTA → blocker).
7. With `DATABASE_URL` unset: all 6 cards show expected demo-mode secondary pills and blockerText.
8. With `reason === 'revoked'`: card border is red-alpha; CTA is "Contact support"; no "Get access" label.
9. `club` card: CTA button is rendered as `<button disabled>` (not `<a>`); no navigation on click.

---

## Next actions

| # | Action | Owner | Dependency |
|---|---|---|---|
| 1 | Add `ProductCabinetCard` to `packages/ui/src/components.tsx` + export from `index.ts` | frontend-implementer | this handoff D-01 |
| 2 | Add `ACCESS_REASON_COPY` map to `apps/web/src/lib/access.ts` (or new `cabinet-copy.ts`) | frontend-implementer | D-03 |
| 3 | Add wizard CSS (`.wtc-wizard-steps`, `.wtc-step-tab`, `.wtc-step-circle` etc.) to `packages/ui/src/theme.css` | frontend-implementer | D-02 CSS spec above |
| 4 | Fix `.wtc-btn min-height: 44px` to be unconditional (move out of `.wtc-table-wrap` media context) | frontend-implementer | F-04 |
| 5 | Rewrite `apps/web/src/app/(app)/app/page.tsx` — `loadCabinetData(userId)` + `ProductCabinetCard` | frontend-implementer | steps 1–4 |
| 6 | Build wizard routes `app/bots/[bot]/setup/[step]/page.tsx` (3 routes) | frontend-implementer | D-02 |
| 7 | Add static guard tests per Verification section items 1–3 | tests-runner | steps 1–6 |
| 8 | Add E2e tests per Verification section items 4–5 | tests-runner | steps 1–6 |
| 9 | Apply DESIGN_SYSTEM.md §15 + §16 content below | operator (serialize-last) | after implementation |
| 10 | Verify no horizontal scroll at 375px across cabinet and wizard pages | tests-runner + operator | step 8 |

---

## DESIGN_SYSTEM.md recommended new section content

**The following is recommended content for the operator to append to `docs/DESIGN_SYSTEM.md` as
§15 and §16 after implementation is complete. It is spec, not an edit instruction.**

---

### §15 — ProductCabinetCard (PG9)

The `ProductCabinetCard` is the enriched per-product card for the authenticated cabinet overview
(`/app`). It is distinct from `ProductStatusCard` (used on public/marketing pages) and carries five
zones: entitlement, setup, activity, CTA, and blocker.

**Five zones:**

| Zone | Always rendered | Content when no data |
|---|---|---|
| Entitlement pill | Yes | From `ACCESS_REASON_COPY[reason]` — never inferred |
| Setup indicator | Only when `setupItems.length > 0` | Hidden |
| Activity line | Yes | Literal string "—" (em-dash) |
| Warning strip | Only when `warningCount > 0` | Hidden |
| CTA | Yes | `<button disabled>` when `ctaHref === null` |
| Blocker strip | Only when `blockerText !== null` | Hidden |

**State matrix:**

| State | Border | Entitlement pill | CTA variant | Blocker |
|---|---|---|---|---|
| allowed + setup complete | `--stroke` | green "Active" | primary gold | null |
| allowed + setup incomplete | `--stroke-gold` | green "Active" | secondary "Complete setup" | null |
| grace | `--stroke-gold` + 3px amber left | amber "Grace period" | secondary "Renew" | null |
| pending_payment | `--stroke` | amber "Pending payment" | ghost "Check billing" | null |
| expired | `--stroke` | dim "Expired" | secondary "Get access" | null |
| revoked / chargeback / refunded | red-alpha `--stroke` | red label | ghost "Contact support" | null |
| manual_review | cyan-alpha stroke | cyan "Manual review" | ghost "Contact support" | null |
| blocked_no_entitlement | `--stroke` | neutral "Not subscribed" | secondary "Get access" | null |
| B2 override (no checkout) | `--stroke` | neutral "Not subscribed" | ghost "Contact support — billing not live" | "B2 — self-serve checkout not yet available" |
| B3 override (legacy) | `--stroke` + always | neutral or active | ghost "View status" | "B3 — live data unavailable" |
| B4 override (axioma) | `--stroke` | active/inactive | ghost "View details" | "B4 — download/journal dev placeholders" |
| planned | `--stroke` | neutral "Planned" | ghost disabled | "Not yet available" |
| demo mode | `--stroke` | normal entitlement + gold "Preview data" | per entitlement | "Demo mode — data not persisted" |
| warningCount > 0 severity error | red-alpha `--stroke` (overrides) | normal | normal | warn strip inside card |

**Mobile at 375px:**
- Full width single-column card.
- Entitlement pill wraps to second line if name + pill exceed card width.
- Setup items stack vertically (one per row).
- CTA button: `width: 100%; min-height: 44px`.
- Blocker strip: full width, text wraps.
- No horizontal scroll from any card zone.

---

### §16 — Multi-step Wizard (PG9)

Used exclusively for bot exchange-key onboarding at `/app/bots/[bot]/setup/[step]`.

**Step states:**

| State | Circle | Label | Connector |
|---|---|---|---|
| done | green border + checkmark | `--muted` text | solid `--green` line |
| active | gold border + step number | `--text` | default `--stroke` line |
| locked | dim + number | 40% opacity | default line |

**At 375px:**
- Step labels truncate at 72px with `text-overflow: ellipsis`.
- Step circles remain 28px × 28px.
- The steps row scrolls horizontally within itself (`overflow-x: auto`) — not the page.
- Step content below the row is single-column.
- Back/Next links are full-width `<a>` elements, `min-height: 44px`.
- All form inputs are full-width, `min-height: 44px`.

**Server-action pipeline for each wizard step:**
`assertCsrf → requireUser → Zod parse → accessFor(userId, code) → repo call → in-txn audit → revalidatePath → redirect`

**Never:** expose plaintext keys; fire live bot control; skip CSRF; allow unauthenticated access.

---

*End of §15 / §16 recommendations.*

---

## Handoff format compliance

- Scope: defined above.
- Files inspected: table above (26 files).
- Files changed: None — read-only audit.
- Findings: F-01 through F-09 numbered, each with severity, file:line evidence, recommendation.
- Decisions: D-01 through D-05 with exact prop shapes, CSS, copy strings, and state maps.
- Risks: 5 numbered risks.
- Verification/tests: 10 numbered items.
- Next actions: 10 ordered items with owner and dependency.
