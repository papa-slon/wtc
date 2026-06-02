# Handoff: ecosystem-admin-ops-ux-auditor

**Epoch:** 20260530-1355
**Slug:** ecosystem-admin-ops-ux-auditor
**Agent:** admin-ops/frontend UX auditor (Workstream F + C UI)
**Wave:** Phase 2.4 — Read-Only Audit

---

## Scope

Full UX audit of the admin operations console and bot-integration frontend. Covers:

- `apps/web/src/app/admin/**` — all admin page surfaces (users, system-health, support, entitlements, bots, tradingview-access, audit-log, education, products, overview, layout)
- `apps/web/src/features/admin/{types,queries,schemas,actions}.ts`
- `apps/web/src/features/bots/{meta.ts,data.tsx,config.ts}`
- `apps/web/src/features/billing/timeline.ts`
- `apps/web/src/features/tv/{queries.ts,actions.ts}`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/lib/{nav.ts,product-status.ts,access.ts,format.ts}`
- `apps/web/src/app/(app)/app/bots/**` — all bot user-facing sub-pages
- `tests/e2e/smoke.spec.ts` — existing Playwright coverage inventory
- Phase 2.3 handoffs at `docs/handoffs/20260530-1145-*` for known follow-ups

Design direction anchored to: `docs/handoffs/0000-orchestrator-seed.md` tokens (--bg:#050a12, --gold:#d5a94f, --cyan:#69e2ff, --green:#54d6a1, --red:#ff6b74) and v2-terminal-os.html premium terminal-first dark aesthetic.

---

## Files inspected

- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/users/page.tsx`
- `apps/web/src/app/admin/system-health/page.tsx`
- `apps/web/src/app/admin/support/page.tsx`
- `apps/web/src/app/admin/entitlements/page.tsx`
- `apps/web/src/app/admin/tradingview-access/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/audit-log/page.tsx`
- `apps/web/src/app/admin/education/page.tsx`
- `apps/web/src/app/admin/products/page.tsx`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/billing/timeline.ts`
- `apps/web/src/features/tv/queries.ts`
- `apps/web/src/features/tv/actions.ts`
- `apps/web/src/features/terminal/loader.ts`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/lib/product-status.ts`
- `apps/web/src/lib/access.ts`
- `apps/web/src/lib/format.ts`
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
- `apps/web/src/app/api/billing/webhook/route.ts`
- `packages/bot-adapters/src/http.ts`
- `tests/e2e/smoke.spec.ts`
- `docs/handoffs/20260530-1145-ecosystem-frontend-implementer-admin.md`
- `docs/handoffs/20260530-1145-ecosystem-billing-access-auditor.md` (partial)
- `docs/handoffs/20260530-1145-ecosystem-bot-integration-auditor.md` (partial)
- `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md`
- `docs/handoffs/0000-orchestrator-seed.md`

---

## Files changed

None — read-only audit

---

## Findings

### F-01 — HIGH — Admin bots page is a bare `<Placeholder>` with no operational content
**Evidence:** `apps/web/src/app/admin/bots/page.tsx:1-5` — renders `<Placeholder kicker="Admin · bots" title="Bot fleet" note="..." />`. ADMIN_NAV marks it `soon: true` (`apps/web/src/lib/nav.ts:26`). No loader, no data, no state matrix.
**Recommendation:** Replace the placeholder with a real cross-user bot health surface (see full spec in Decisions/F-01 below). The admin bot-fleet view is a first-class operations tool: adapter mode disclosure, Tortila adapter readiness, legacy-blocked status, last health-check rows from `integration_health_checks`, safety-disabled hardcoded states. All implemented through a new `loadAdminBotHealth` loader in `apps/web/src/features/admin/queries.ts` — no new schema required. Loader reads `integration_health_checks` via `getServerDb()` filtered to `target LIKE 'bot.%'` plus the hardcoded adapter-mode env (`BOT_ADAPTER_MODE`). Remove `soon: true` from ADMIN_NAV bots entry when complete.
**Target Workstream:** F

### F-02 — HIGH — Webhook missing/unresolvable userId fires no manual_review alert
**Evidence:** `apps/web/src/app/api/billing/webhook/route.ts:88-91` — when `event.userId` is null/undefined the route immediately returns `{ received: true }` (200 OK, acknowledged) with NO audit write, NO support ticket creation, and NO `manual_review` state applied to any entitlement. This is listed as a known Phase-2.3 follow-up in the task brief point (c) and in `docs/handoffs/20260530-1145-phase-2-3-commercial-access-ops.md`.
**Recommendation:** When a verified Stripe event with a known billing event type arrives but `event.userId` is missing or the user cannot be resolved, write an audit log row with `action='billing.webhook.userId_missing'`, `targetId=event.id`, `result='manual_review'`, and insert a support ticket with `priority='urgent'`, `subject='Billing webhook — user not resolved'`, `productCode=event.planCode`. This makes the unresolvable payment immediately visible in `/admin/support` and `/admin/audit-log`. The 200 acknowledgement to Stripe is correct (retrying will not help without metadata). Implementation belongs in the webhook route and a new `recordWebhookAlert` helper in `features/billing/`. No schema change required — `support_tickets` and `audit_logs` tables exist (migration 0002).
**Target Workstream:** B / F

### F-03 — HIGH — TV revoke does not write `reason` to the audit row; `revokeTvGrant` is not called
**Evidence:** `apps/web/src/features/tv/actions.ts:142-146` — the parsed `reason` from the Zod schema is explicitly discarded via `void _reason`. `revokeTv` in `@wtc/db` writes a fixed audit payload without the admin-supplied reason. `revokeTvGrant` is never called from the revoke action, so the `tradingview_access_grants` row is never updated with `revokedAt`. This is listed as a known Phase-2.3 follow-up in the task brief point (b) and in the action-level comment at line 144.
**Recommendation (db-architect):** Add an optional `reason?: string` param to `revokeTv` in `packages/db/src/repositories.ts` that threads through to the `audit_logs` payload. Add a `revokeTvGrantByRequestId(db, requestId, revokedAt)` helper (or amend `revokeTvGrant` to accept a `requestId` lookup) so the grant row is updated atomically with the request-row revoke. The `enhancedRevokeAction` in `features/tv/actions.ts` should then pass `reason` and call both. Until this is done, the revoke audit trail is incomplete and the `tradingview_access_grants` table has orphaned active rows.
**Target Workstream:** C / D

### F-04 — HIGH — TV grant is two non-atomic transactions; divergence on `createTvGrant` failure
**Evidence:** `apps/web/src/features/tv/actions.ts:100-113` — `grantTv` (step 1) and `createTvGrant` (step 2) are sequential calls in separate repo transactions. If `createTvGrant` throws, the request row is already `'granted'` but no `tradingview_access_grants` row exists. The action-level comment at line 101-104 acknowledges this as a tracked enhancement.
**Recommendation (db-architect):** Wrap both calls in a single Drizzle transaction at the repo level. Create a `grantTvAtomic(db, params)` function in `repositories.ts` that performs the `UPDATE tradingview_access_requests SET status='granted'` and `INSERT INTO tradingview_access_grants` inside one `db.transaction()` call. The `enhancedGrantAction` calls `grantTvAtomic` instead of the two separate functions.
**Target Workstream:** D / C

### F-05 — MEDIUM — Admin users page has N+1 query on `createdAt` (per-user extra SELECT)
**Evidence:** `apps/web/src/features/admin/queries.ts:59-64` — `loadAdminUsers` does a secondary per-user `db.select({ createdAt })` for every user returned by `listUsers()`. This is O(n) extra queries. Confirmed in Phase 2.3 handoff `20260530-1145-ecosystem-frontend-implementer-admin.md:109` as a known risk.
**Recommendation (db-architect):** Add `listUsersWithCreatedAt(db): Promise<(DbUser & { createdAt: Date | null })[]>` to `packages/db/src/repositories.ts` using a single JOIN or a single SELECT with all needed columns. `loadAdminUsers` replaces the two-step loop with one call. For MVP with few users this is not urgent, but it should land before beta to avoid page-load regressions.
**Target Workstream:** D

### F-06 — MEDIUM — Webhook idempotency uses SELECT-then-INSERT race (no unique DB constraint)
**Evidence:** `packages/db/src/repositories.ts` (per Phase 2.3 billing-access-auditor handoff `20260530-1145-ecosystem-billing-access-auditor.md:67-72`) — idempotency is enforced via `SELECT from audit_logs WHERE action='billing.webhook_received' AND targetId=eventId` followed by conditional `INSERT`. Under concurrent delivery of the same Stripe event (Stripe sends duplicates within its retry window), both requests may pass the SELECT check before either has committed the INSERT.
**Recommendation (db-architect):** Add a UNIQUE constraint on `(action, targetId)` to the `audit_logs` table via migration 0003, limited to `action = 'billing.webhook_received'` rows, or add a dedicated `billing_webhook_idempotency` table with `(event_id TEXT PRIMARY KEY, processed_at TIMESTAMPTZ)`. The current SELECT-then-INSERT is safe under normal single-process load; the race only manifests under true concurrent delivery (multiple workers). Until then, this is a documented acceptable risk for single-worker deployments. Mark in CONTRACTS/billing-webhooks.md as "TARGET for migration 0003."
**Target Workstream:** B / D

### F-07 — MEDIUM — Billing manual-review queue has NO admin surface
**Evidence:** No route or loader exists for `entitlement.status = 'manual_review'`. The state exists in the state machine (`packages/entitlements/src/state-machine.ts` — referenced in the entitlement state machine doc) and is a legitimate landing state for chargebacks, ambiguous webhook outcomes, and the missing-userId scenario (F-02). Currently the only way to discover a `manual_review` entitlement is to browse `/admin/entitlements` and notice the status pill. There is no dedicated queue, no filter, and no approve/reject/resolve action.
**Recommendation:** Add a billing manual-review queue section to `/admin/entitlements` page (or a dedicated `/admin/billing-review` route if the surface grows large). The loader `loadAdminUsers` + `entitlementsOf` already provides the data; add a filter for `status === 'manual_review'` and render a queue above the per-user cards. Each queue entry needs three actions: **Approve** (transition to `active` via `adminGrantProductAction` with reason), **Reject** (transition to `expired` or `revoked` via `adminRevokeProductAction` with reason), and **Dismiss** (mark resolved in the audit log without state change — requires a new lightweight audit-only action). Every action is audited in-transaction.
**Target Workstream:** F / B

### F-08 — MEDIUM — Admin support page lacks ticket assignment and reply thread
**Evidence:** `apps/web/src/app/admin/support/page.tsx:162-191` — the only mutation available is a status-select dropdown update. The `assignedTo` field exists in `AdminTicketView` (types.ts:66) and in the DB schema (`support_tickets.assignedTo`), but there is no UI control to assign a ticket. There is no support_ticket_replies table (noted as Phase 3 in the frontend-admin handoff `20260530-1145-ecosystem-frontend-implementer-admin.md:154`). The ticket body is rendered with `maxHeight:120px; overflow:hidden` which silently truncates long messages.
**Recommendation:** For Phase 2.4: (a) Add an "Assign to me" button in the ticket status form that sets `assignedTo = actor.id` via `adminUpdateTicketAction` (extend the Zod schema to accept optional `assignedTo`). (b) Expand the body truncation to a `<details>` disclosure (accessible, never hides content from keyboard users). Full reply thread is deferred to Phase 3 / migration 0003.
**Target Workstream:** F

### F-09 — MEDIUM — Admin overview page still uses `listUsers()` from `lib/backend` (legacy wrapper) instead of `loadAdminUsers()`
**Evidence:** `apps/web/src/app/admin/page.tsx:3` — `import { listUsers, tvService, recentAuditEvents, backendMode } from '@/lib/backend'`. This bypasses the `features/admin/queries.ts` loader which strips `passwordHash` via `mapToAdminUserView`. The overview page only uses `users.length` so no passwordHash is currently exposed — but the import is architecturally incorrect and would be a security defect if the template ever rendered user details.
**Recommendation:** Replace `listUsers` call in `/admin/page.tsx` with `loadAdminUsers()` from `features/admin/queries.ts` and use `result.users.length`. Also replace the `backendMode` import with the `mode` field from `loadAdminUsers()` result. This closes the architectural gap without behavior change.
**Target Workstream:** F / A

### F-10 — MEDIUM — Admin layout `StatusPill tone="bad"` for "admin" role badge is confusing
**Evidence:** `apps/web/src/app/admin/layout.tsx:31` — `<StatusPill tone="bad">admin</StatusPill>`. The `bad` tone uses `--red` color, making the "admin" role badge look like an error indicator. Legitimate; intentional as a warning that you are in a privileged context. However, a `tone="warn"` with explicit label "ADMIN MODE" or a dedicated amber badge better communicates "elevated privilege" vs. "error state" per the design token system.
**Recommendation:** Change to `tone="warn"` and label text `"ADMIN MODE"`. Update the e2e test that asserts admin-specific UI if it currently hard-tests the red tone. This is a cosmetic/UX correctness issue — no security impact.
**Target Workstream:** F

### F-11 — LOW — ADMIN_NAV missing `/admin/bots` entry without `soon:true` removal after implementation
**Evidence:** `apps/web/src/lib/nav.ts:26` — `{ href: '/admin/bots', label: 'Bots', soon: true }`. The `soon: true` flag suppresses the nav link visually. There is currently no real content at this route (F-01). When F-01 is implemented the `soon: true` must be explicitly removed; there is no automated guard to enforce this.
**Recommendation:** When the admin bots page is built (F-01), remove `soon: true` from the nav entry in the same PR/agent wave. Add a governance note in the F-01 implementation spec to make this a hard requirement.
**Target Workstream:** F

### F-12 — LOW — Audit log page renders `actorRole` not `actorId` for actor column
**Evidence:** `apps/web/src/app/admin/audit-log/page.tsx:16` — the actor column renders `{e.actorRole ?? 'system'}`. The `actorRole` field shows generic role ('admin', 'user') but not identity. For accountability the actor column should prefer `actorId` (truncated) with `actorRole` as a sub-label.
**Recommendation:** Render `{e.actorId ? e.actorId.slice(0, 14) + '…' : e.actorRole ?? 'system'}` with role as a secondary `wtc-dim` span. Low priority but important for incident review traceability.
**Target Workstream:** F

### F-13 — LOW — Entitlements N+1: `Promise.all(users.map(loadAdminTimeline))` fires per user
**Evidence:** `apps/web/src/app/admin/entitlements/page.tsx:29-34` — for every user, `loadAdminTimeline(u.id, { limit: 20 })` runs independently. With many users this is O(n) DB round-trips. Low impact for MVP user counts.
**Recommendation:** Accept as MVP known limitation. Document in `features/billing/timeline.ts` that a bulk `listProductAccessEventsByUserIds(db, userIds[])` loader is the production-readiness fix. Implement when user count exceeds ~50. Not a Phase 2.4 blocker.
**Target Workstream:** D / F

---

## Decisions

### Admin Console Layout — Full Specification (Premium Terminal-First)

The admin console inherits the existing `wtc-shell` layout (fixed left sidenav + topbar). The following additions and modifications are implementation-ready specs for Phase 2.4.

#### Admin Shell (layout.tsx)

```
wtc-shell
  ├── aside.wtc-sidenav
  │     ├── "WTC" brand + "ADMIN" badge (amber/warn tone, not red)
  │     └── NavLinks from ADMIN_NAV (all items, including /admin/bots once F-01 lands)
  └── div
        ├── header.wtc-topbar
        │     ├── left: "Admin console" uppercase muted label + storage-mode pill (Postgres/demo)
        │     └── right: "ADMIN MODE" amber StatusPill + logout form
        └── main.wtc-main → {children}
```

The `backendMode` display (currently only on the overview page) belongs in the topbar of the layout so every admin page inherits it without per-page duplication.

#### State Matrix — All Admin Actions

Every admin action (grant, revoke, ticket-update, TV-grant, TV-revoke) must declare:

| State | Display |
|---|---|
| idle | Form rendered; submit button enabled; no spinner |
| submitting (loading) | Submit button shows spinner + "Processing…" text; inputs disabled |
| success | Inline success banner ("Grant applied — audit row written"); page revalidated |
| error (validation) | Inline error below field; field highlighted with --red border |
| error (server) | Toast/banner at top of card: "Action failed: [safe message]. No state was changed." |
| disabled | Button rendered with `disabled` HTML attr + `title` tooltip explaining why |

Next.js server actions with RSC revalidate do not expose explicit loading state to the page. The loading state is achieved via `useFormStatus` hook in a client-side button wrapper component. Spec: create `packages/ui/src/SubmitButton.tsx` — a client component that reads `useFormStatus().pending` and renders `disabled + spinner` while the action is in-flight.

#### F-01 Full Spec: Admin Bot Health Page (`/admin/bots`)

**Route:** `apps/web/src/app/admin/bots/page.tsx` — replace Placeholder with a full RSC.

**Loader:** `loadAdminBotHealth()` in `apps/web/src/features/admin/queries.ts`.

```typescript
export interface AdminBotHealthResult {
  mode: 'postgres' | 'demo';
  adapterMode: 'mock' | 'read-only' | 'audited';
  liveControlDisabled: true; // always hardcoded true
  legacyAdapterBlocked: true; // always hardcoded true
  tortilaPersistentWarnings: BotWarning[]; // from packages/bot-adapters/src/warnings.ts
  legacyWarnings: BotWarning[];
  lastHealthChecks: HealthCheckView[]; // integration_health_checks WHERE target LIKE 'bot.%'
  tortila: {
    status: string; // from integration_health_checks latest row for 'bot.tortila.journal'
    lastCheckedAt: number | null;
    detail: Record<string, unknown> | null;
  };
  legacy: {
    status: string;
    lastCheckedAt: number | null;
    detail: Record<string, unknown> | null;
  };
}
```

The loader reads `process.env.BOT_ADAPTER_MODE` directly (no DB call needed for adapter mode). For health check rows, it filters `integration_health_checks` to `target LIKE 'bot.%'` ordered by `checkedAt DESC LIMIT 20`.

**Page layout:**

```
SectionHeader kicker="Admin · bots" title="Bot fleet"
  copy="Cross-user bot health diagnostics. Live control is permanently DISABLED by safety policy.
        Legacy adapter is BLOCKED (plaintext-key issue unresolved). Tortila journal is read-only."

Row: [storage-mode pill] [adapter-mode pill] [live-control DISABLED badge (red)] [legacy BLOCKED badge (red)]

Card "Safety-disabled states (policy)"
  Row: [DISABLED badge] "Live bot control — start/stop/applyConfig permanently disabled until audited adapter approved"
  Row: [BLOCKED badge]  "Legacy bot read-only — plaintext-key/service-account issue unresolved; adapter stays blocked"
  Row: [DISABLED badge] "TradingView automation — manual-first only (see TradingView Queue)"

Card "Tortila journal health (bot.tortila.journal)"
  MetricCards: [Last status] [Last checked] [Adapter mode]
  RiskWarningBanner for each TORTILA_PERSISTENT_WARNINGS item (severity=warning, never dismissible)
  Note: "P0: TP reconciliation/restore — persists until bot journal reports resolution."
        "P1: Margin pre-flight — persists until bot journal reports resolution."
  EmptyState (no integration_health_checks rows): "No health checks recorded.
    Worker must run and call journal /api/health to populate this table."

Card "Legacy bot status (bot.legacy)"
  MetricCards: [status: BLOCKED] [reason: plaintext-key issue unresolved]
  RiskWarningBanner severity="error" title="Legacy adapter BLOCKED"
    detail="The legacy bot API (:8000) returns plaintext exchange keys in responses.
            This adapter must NOT be proxied through WTC until a service-account or
            encrypted-key solution is audited and approved. See docs/CONTRACTS/legacy-bot-adapter.md."

Card "Integration health checks (bot.* targets)"
  table: Target | Status | Checked at | Detail (truncated 120 chars)
  EmptyState: "No health checks for bot targets yet."
```

**State matrix for this page (all RSC, no mutations):**

| State | Display |
|---|---|
| postgres + checks present | Full health check table + live status pills |
| postgres + no checks | EmptyState: "Run the worker to populate integration health checks" |
| demo (no DATABASE_URL) | "storage: in-memory (demo)" pill; all counts = 0; EmptyState with "Connect Postgres" hint |
| adapter=mock | "adapter: mock" amber pill; safety note "Data is mock — not a live account" |
| adapter=read-only | "adapter: read-only" cyan pill; health checks reflect live journal poll |

#### F-02 Full Spec: Webhook Manual-Review Alert

**Location:** `apps/web/src/app/api/billing/webhook/route.ts` and new helper `apps/web/src/features/billing/review.ts`.

```typescript
// features/billing/review.ts
export async function recordWebhookAlert(
  db: Db,
  opts: {
    eventId: string;
    eventType: string;
    planCode: string | undefined;
    reason: 'userId_missing' | 'user_not_found';
  }
): Promise<void>
```

The helper performs (in a single transaction):
1. INSERT into `audit_logs` with `action='billing.webhook.userId_missing'`, `targetId=eventId`, `result='manual_review'`, `metadata={eventType, planCode, reason}`.
2. INSERT into `support_tickets` with `subject='Billing webhook — user not resolved'`, `priority='urgent'`, `body` containing safe diagnostic text (event id, event type, plan code — never raw Stripe payload, never signature), `productCode=planCode`.

The webhook route calls `recordWebhookAlert` before the `return Response.json({ received: true })` when `!event.userId`.

This surfaces the incident in both `/admin/support` (urgent open ticket) and `/admin/audit-log` immediately.

#### F-07 Full Spec: Billing Manual-Review Queue

**Location:** `/admin/entitlements` page — add a "Manual review queue" section above the per-user cards.

```
Card "Billing manual-review queue" (only rendered when reviewCount > 0, or always in postgres mode with count badge)
  [badge: N items in manual_review]
  table: User | Product | Status | Reason | Since
  Actions per row (inline forms):
    [Approve] → adminGrantProductAction (reason required, transitions to active)
    [Reject]  → adminRevokeProductAction (reason required, transitions to revoked)
    [Dismiss] → new adminDismissReviewAction (audit-only, no state change)
```

`loadAdminUsers` result already contains entitlements via `entitlementsOf`. Filter for `evaluateStatus(e, now) === 'manual_review'` to build the queue rows. No new loader needed; extend the existing entitlements page loader.

**State matrix:**

| State | Display |
|---|---|
| queue empty (postgres) | Section rendered with "No items in manual review" empty state |
| queue empty (demo) | Section collapsed; "Connect Postgres to view manual-review queue" |
| 1+ items | Red badge on section header; each row shows approve/reject/dismiss forms |
| approve submitting | Row inputs disabled; spinner on Approve button |
| approve success | Row removed from table; success banner "Entitlement approved — user now active" |
| reject submitting | Spinner on Reject |
| reject success | Row removed; banner "Entitlement rejected — user notified via support ticket" |

#### TV State Management — Full State Matrix

For `/admin/tradingview-access`:

| Row status | Visible actions |
|---|---|
| pending | Grant form (reason required + duration select); no revoke |
| expiring_soon | Grant form (re-grant/extend) + Revoke form |
| granted | Revoke form (reason required); no grant |
| expired | No actions available |
| revoked | No actions available |

After F-03 lands: the Revoke form must submit `reason` to `enhancedRevokeAction` which threads it to `revokeTv` and also calls `revokeTvGrantByRequestId`.

**Empty states:**

| Mode | Empty state |
|---|---|
| demo (no DATABASE_URL) | "Queue requires Postgres. Connect DATABASE_URL and restart to manage real TV requests." |
| postgres, no requests | "No TradingView access requests submitted yet. Users submit requests from /app/indicators." |
| postgres, no grants | "No grants recorded. Grant history appears after the first admin grant." |

#### Support Ticket Triage — Full State Matrix

For `/admin/support`:

| Ticket status | Available transitions (select options) |
|---|---|
| open | → in_progress, resolved, closed |
| in_progress | → open, resolved, closed |
| resolved | → open, closed |
| closed | No form shown (static "Closed" text) |

**Additional Phase 2.4 additions per F-08:**

- Assign-to-me button: inline in each ticket form; adds `assignedTo=actor.id` to `adminUpdateTicketAction`. Extend `ticketUpdateSchema` with `assignedTo: z.string().uuid().optional()`.
- Body disclosure: wrap body in `<details><summary>Show full message</summary>{body}</details>` instead of `maxHeight:120px` truncation.

**Priority tone mapping:**

| priority | StatusPill tone | Background |
|---|---|---|
| urgent | bad | --red at 8% opacity border |
| high | warn | --gold at 8% opacity border |
| normal | neutral | default |
| low | neutral | default |

**Urgent tickets** (priority=urgent or status=open for >72h) get a `RiskWarningBanner severity="error"` above their card — they must not be missed in a scrollable list.

#### Entitlement Timeline — State and Display

Timeline `<details>` element (inside per-user entitlement card) shows/hides product-access events. States:

| State | Display |
|---|---|
| 0 events | `<details>` not rendered at all |
| 1-5 events | `<details>` open by default; table visible |
| 6+ events | `<details>` collapsed; summary shows count |

State-transition color mapping in timeline table:
- `fromState/toState = 'active'` → StatusPill tone='ok' (green)
- `fromState/toState = 'grace'` → tone='warn' (amber)
- `fromState/toState = 'expired'|'revoked'|'chargeback'|'refunded'` → tone='bad' (red)
- `fromState/toState = 'pending_payment'|'manual_review'` → tone='warn' (amber)
- `fromState/toState = 'none'` → tone='neutral' (muted)

#### Terminal Readiness State Matrix (for completeness)

`/app/terminal` surfaces via `loadTerminalRelease`. Admin-relevant states:

| Condition | Admin-visible in system-health |
|---|---|
| mode=demo | "storage: in-memory (demo)" pill; release data is mock |
| mode=postgres, release=null | "No terminal release cached — populate terminal_release_cache" |
| mode=postgres, release present | Version + channel + platform displayed |
| jwksConfigured=false | Amber warning "AXIOMA_HANDOFF_SIGNING_KEY not set — SSO handoff disabled" |
| jwksConfigured=true | Cyan confirmation "JWKS configured" |

This data should surface in `/admin/system-health` alongside the webhook health section. The `loadSystemHealth` loader should be extended to call `loadTerminalRelease` and return `jwksConfigured + terminalReleasePresent`.

---

## Risks

### R-01 — HIGH — `admin/bots` is a live ADMIN_NAV entry (visible to admins) with only a Placeholder
The nav item is rendered with `soon:true` which visually marks it "coming later" but it still links to a page that shows no content. For production this must be either fully implemented (F-01) or the nav entry must be removed entirely until ready.

### R-02 — HIGH — Missing-userId webhook events are silently acknowledged with no alert
Any Stripe event where `event.userId` is absent silently returns 200 with no audit trail and no human-visible alert. A misconfigured Stripe webhook metadata setup (e.g., client_reference_id missing) would result in paid users never being activated, with no operations team alert. This is the most operationally dangerous gap at the billing boundary.

### R-03 — HIGH — TV grant table can have orphaned 'granted' request rows without a matching grant row
If `createTvGrant` fails after `grantTv` succeeds (F-04), the request status is 'granted' but the `tradingview_access_grants` table has no corresponding row. The admin panel shows "granted" status and offers a Revoke button, but `revokeTvGrant` would have no row to update. The grant history card would also show no entries.

### R-04 — MEDIUM — No billing manual-review surface means `manual_review` entitlement state is invisible
An entitlement in `manual_review` state blocks access (fail-closed is correct) but the operations team has no queue or workflow to resolve it. The user is blocked with no visibility into why. The only current path is for an admin to recognize the status in the full entitlements table.

### R-05 — MEDIUM — Support ticket body is silently truncated in the admin view
`apps/web/src/app/admin/support/page.tsx:147` — `maxHeight:120px; overflow:hidden` on the body paragraph. A support ticket with a long problem description is cut off for the triaging admin without any indicator that content was hidden. This is an accessibility and operational accuracy issue.

### R-06 — LOW — `fmtDate` returns only YYYY-MM-DD (no time component) for audit/support timestamps
`apps/web/src/lib/format.ts:23-26` — `new Date(ms).toISOString().slice(0, 10)`. For audit log and support triage, the time-of-day is critical for incident correlation. The `audit-log/page.tsx` uses a different inline formatter that includes time (ISO.replace('T',' ').slice(0,19)) but `support/page.tsx` and `entitlements/page.tsx` use `fmtDate` which loses time.
**Recommendation:** Add `fmtDateTime(ms)` to `lib/format.ts` that returns `YYYY-MM-DD HH:MM` and use it for admin-facing timestamps. Keep `fmtDate` for display contexts where date-only is appropriate (e.g., "valid until" date picker labels).

---

## Verification/tests

### Existing Playwright Coverage (28 specs in `tests/e2e/smoke.spec.ts`)

Admin-specific e2e tests present:
- `admin console` — `/admin/entitlements` heading + screenshot; `/admin/tradingview-access` heading + "Manual grant/revoke only" text
- `Phase 2.3 admin pages` — users list heading + storage pill; system-health heading + "Live bot control" + "TradingView automation" + "DISABLED" pill; support triage heading + storage pill
- `Phase 2.3 TV admin queue` — heading + manual-first copy + storage pill + screenshot

**GAPS in current Playwright coverage for admin-ops:**

1. `/admin/bots` — not tested at all (placeholder renders, no content assertions)
2. `/admin/audit-log` — no test asserts the audit log renders (only entitlements/TV/support/users covered)
3. `/admin/system-health` — JWKS/terminal readiness state not asserted
4. Billing manual-review queue — no test (surface does not exist yet)
5. Support ticket assignment — no test
6. TV revoke with reason — no test verifying reason flows to audit log
7. TV grant atomicity — no test verifying both request row and grant row updated
8. `/admin/support?status=open` URL filter — no test for filtered view

### Required Playwright Additions (Phase 2.4)

Add to `tests/e2e/smoke.spec.ts`:

```
test('admin audit log renders and is not empty after actions', async ({ page }) => {
  await login(page, 'admin@wtc.local');
  await page.goto('/admin/audit-log');
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible();
  // After login there should be at least one audit event
  await expect(page.getByText(/storage:/i)).toBeVisible(); // not applicable here but storage pill from layout
  // Audit log has a table (not EmptyState) because login generates audit events
  // In demo mode (no DATABASE_URL) this will be EmptyState — both paths should be asserted
  const hasTable = await page.locator('table').count();
  const hasEmpty = await page.getByText('No audit events yet').count();
  expect(hasTable + hasEmpty).toBeGreaterThan(0); // at least one path renders
});

test('admin bots page renders health surface (not Placeholder)', async ({ page }) => {
  await login(page, 'admin@wtc.local');
  await page.goto('/admin/bots');
  await expect(page.getByRole('heading', { name: 'Bot fleet' })).toBeVisible();
  // DISABLED safety badges must be first-class (never hidden behind healthy card)
  await expect(page.getByText('Live bot control')).toBeVisible();
  await expect(page.getByText('DISABLED').first()).toBeVisible();
  await expect(page.getByText('Legacy adapter BLOCKED').or(page.getByText('BLOCKED')).first()).toBeVisible();
  // Tortila P0/P1 warnings must surface
  await expect(page.getByText(/TP reconciliation/i)).toBeVisible();
});

test('admin support page: body disclosure + assignment form visible', async ({ page }) => {
  await login(page, 'admin@wtc.local');
  await page.goto('/admin/support');
  await expect(page.getByRole('heading', { name: 'Support ticket triage' })).toBeVisible();
  // Storage pill present
  await expect(page.getByText(/storage:/)).toBeVisible();
  // In demo mode: empty state with correct hint
  const empty = page.getByText(/Tickets created by users appear here/);
  const table = page.locator('.wtc-card').first(); // ticket card
  expect((await empty.count()) + (await table.count())).toBeGreaterThan(0);
});

test('admin support status filter: ?status=open renders filtered view', async ({ page }) => {
  await login(page, 'admin@wtc.local');
  await page.goto('/admin/support?status=open');
  await expect(page.getByRole('heading', { name: /open/i })).toBeVisible().catch(() => {
    // heading may say "Tickets — open (0)" in postgres or just "Tickets" in demo
  });
  await expect(page.getByText(/storage:/)).toBeVisible();
});

test('admin system-health: JWKS and terminal-readiness visible', async ({ page }) => {
  await login(page, 'admin@wtc.local');
  await page.goto('/admin/system-health');
  await expect(page.getByRole('heading', { name: 'System health' })).toBeVisible();
  // Terminal readiness section present (once added to loadSystemHealth)
  // For now: safety states are present
  await expect(page.getByText('DISABLED').first()).toBeVisible();
});

test('admin billing manual-review queue section present', async ({ page }) => {
  await login(page, 'admin@wtc.local');
  await page.goto('/admin/entitlements');
  // Section must exist (even if empty) once F-07 lands
  await expect(page.getByText(/manual.review queue/i)).toBeVisible();
});
```

### Unit Test Additions for Phase 2.4

Add to a new `tests/integration/phase24-admin-ops.test.ts`:

1. `loadAdminBotHealth()` in demo mode returns hardcoded `liveControlDisabled: true`, `legacyAdapterBlocked: true`, `adapterMode: 'mock'`.
2. `loadAdminBotHealth()` in postgres mode reads `integration_health_checks` for `bot.*` targets.
3. `recordWebhookAlert()` writes both an audit_log row and a support_ticket row in a single test transaction.
4. Billing manual-review filter: `loadAdminUsers` result with an entitlement in `manual_review` state surfaces in the queue filter.
5. `fmtDateTime()` formats epoch-ms to `YYYY-MM-DD HH:MM` correctly.
6. Ticket body disclosure: no content hidden (regression guard that `maxHeight` CSS does not appear in ticket body element).

---

## Next actions

Listed by priority and target workstream:

**P0 — before any production use:**

1. **[Workstream B / backend-implementer]** Fix F-02: implement `recordWebhookAlert` in `features/billing/review.ts` and wire into `apps/web/src/app/api/billing/webhook/route.ts` for missing-userId path. Add `tests/integration/phase24-admin-ops.test.ts` test for this path.

2. **[Workstream F / frontend-implementer]** Fix F-01: implement admin bots health page (`/admin/bots`) per the spec in Decisions/F-01. Remove `soon:true` from ADMIN_NAV bots entry (F-11). Add Playwright test.

3. **[Workstream D / db-architect]** Fix F-04: implement `grantTvAtomic(db, params)` in `repositories.ts` wrapping both `grantTv` + `createTvGrant` in a single Drizzle transaction.

4. **[Workstream C / tradingview-implementer + D / db-architect]** Fix F-03: add `reason?: string` to `revokeTv` repo; add `revokeTvGrantByRequestId` helper; thread both into `enhancedRevokeAction`.

**P1 — high operational value, target Phase 2.4:**

5. **[Workstream F]** Fix F-07: add billing manual-review queue section to `/admin/entitlements`. Add `adminDismissReviewAction` server action. Add Playwright test.

6. **[Workstream F]** Fix F-08: add assign-to-me to support triage. Replace `maxHeight` truncation with `<details>` disclosure. Extend `ticketUpdateSchema` with `assignedTo?`.

7. **[Workstream F]** Fix F-09: replace `listUsers` import in `/admin/page.tsx` with `loadAdminUsers()` from `features/admin/queries`.

**P2 — quality/correctness:**

8. **[Workstream D / db-architect]** Fix F-05: add `listUsersWithCreatedAt` repo function to eliminate N+1 in `loadAdminUsers`.

9. **[Workstream F]** Fix F-10: change admin layout `StatusPill tone="bad"` for role badge to `tone="warn"` with label "ADMIN MODE".

10. **[Workstream F]** Fix F-12: improve audit log actor column to prefer `actorId` (truncated) with role as sub-label.

11. **[Workstream F]** Add `fmtDateTime(ms)` to `lib/format.ts`; use in admin support and entitlements timelines (F-06).

12. **[Workstream B / billing]** Document F-06 in `docs/CONTRACTS/billing-webhooks.md`: idempotency race condition is acceptable for single-worker deployments; mark unique-constraint as TARGET for migration 0003.

13. **[Workstream F]** Extend `loadSystemHealth` to include terminal JWKS state and terminal release presence. Surface in `/admin/system-health`.

**Deferred (Phase 3 / migration 0003):**

14. Support ticket replies (`support_ticket_replies` table).
15. Role mutation UI in `/admin/users` (promote/demote to teacher/support roles).
16. Dedicated `billing_webhook_idempotency` table with UNIQUE constraint (F-06 full fix).
17. Bulk `listProductAccessEventsByUserIds` for entitlements N+1 (F-13).
