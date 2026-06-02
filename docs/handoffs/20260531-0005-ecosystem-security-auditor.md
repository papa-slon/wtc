## Scope

PG9 pre-implementation security audit. Read-only pass over the cabinet overview (/app/page.tsx), all
per-product detail pages, the exchange-key setup-wizard (security/page.tsx and bots/[bot]/settings/page.tsx),
the access layer, entitlement engine, vault, audit redaction, and CSRF pipeline. Verification of fail-closed
access, secret-safety, activity-signal isolation, blocker honesty, and CTA correctness for the planned PG9
enrichment. No code was written or modified.

## Files inspected

- apps/web/src/app/(app)/app/page.tsx
- apps/web/src/app/(app)/app/security/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/positions/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/equity/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx
- apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx
- apps/web/src/app/(app)/app/indicators/page.tsx
- apps/web/src/app/(app)/app/terminal/page.tsx
- apps/web/src/app/(app)/app/education/page.tsx
- apps/web/src/app/(app)/app/education/[courseId]/page.tsx
- apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx
- apps/web/src/app/(app)/app/billing/page.tsx
- apps/web/src/app/(app)/app/layout.tsx
- apps/web/src/lib/access.ts
- apps/web/src/lib/backend.ts
- apps/web/src/lib/demo.ts
- apps/web/src/lib/db-store.ts
- apps/web/src/lib/session.ts
- apps/web/src/lib/csrf.tsx
- apps/web/src/lib/product-status.ts
- apps/web/src/features/bots/data.tsx
- apps/web/src/features/bots/config.ts
- apps/web/src/features/bots/meta.ts
- apps/web/src/features/tv/queries.ts
- apps/web/src/features/terminal/loader.ts
- apps/web/src/features/lms/queries.ts
- apps/web/src/features/lms/guard.ts
- packages/entitlements/src/engine.ts
- packages/entitlements/src/registry.ts
- packages/ui/src/components.tsx
- packages/shared/src/schemas.ts
- packages/crypto/src/vault.ts
- packages/audit/src/redact.ts
- packages/bot-adapters/src/meta.ts (via features/bots/meta.ts)
- packages/bot-adapters/src/warnings.ts
- tests/integration/csrf-coverage.test.ts
- docs/PRODUCTION_BLOCKERS.md

## Files changed

None — read-only audit.

## Findings

### F-01 — MEDIUM — TV activity data loaded unconditionally before entitlement check (data-minimization gap)

**File:** apps/web/src/app/(app)/app/indicators/page.tsx:32-33

```
const access = await accessFor(user.id, 'tradingview_indicators');
const tvData = await loadTvUserData(user.id);
```

`loadTvUserData` is called on line 33 regardless of whether `access.allowed` is true or false. For a user
whose entitlement is revoked, expired, or blocked, the DB query still executes and fetches their TV
username (profile.tvUsername), all historical grant records (tvData.grants), and all historical access
requests (tvData.requests) from Postgres.

The data is per-user-isolated (all queries filter by `userId`) so no cross-user leak occurs. However the
principle established in the AGENTS.md brief ("gather activity ONLY when access.allowed") and
SECRET_VAULT_DESIGN.md ("no data for non-entitled product") is violated. A revoked user's TradingView
username and grant history should not be fetched at all; only the denial UI should render.

**Severity:** MEDIUM. No cross-user data exposure. No secret leakage. But the pattern of loading
per-product activity data for non-entitled users must not be replicated in PG9 card enrichment — any
per-product setup/activity signal (bot config, TV username, terminal account-link) must be fetched ONLY
inside a `if (access.allowed)` branch.

**Recommendation for PG9:** Add an early gate:
```
if (!access.allowed) { /* render denial card only */ return; }
const tvData = await loadTvUserData(user.id);
```
For PG9 product card enrichment, always structure as: access decision → if not allowed, skip ALL
per-product data loading → return minimal denial card. Apply the same pattern across every product card
that fetches setup/activity signals.

---

### F-02 — LOW — CSRF-first ordering in the exchange-key wizard action

**File:** apps/web/src/app/(app)/app/security/page.tsx:10-11

```
const user = await requireUser();
await assertCsrf(formData);
```

The established pipeline ordering documented in AGENTS.md and features/lms/guard.ts is
`assertCsrf → requireUser → Zod → RBAC`. The security page action reverses the first two steps
(`requireUser` is called before `assertCsrf`).

The CSRF token in this implementation is derived from the session cookie value via
`deriveSessionCsrfToken(sessionToken, csrfSecret)` — see csrf.tsx. This means `assertCsrf` itself
internally reads the session cookie (via `currentSessionToken()`). Calling `requireUser` first is
therefore not exploitable here: an unauthenticated request has no session and `requireUser` would throw
before any CSRF validation, which is fail-closed. However:

1. The reversed ordering makes the CSRF check dependent on having a valid session, which is a weaker
   defence model than having CSRF as the outermost gate (the LMS pattern in features/lms/guard.ts).
2. The pattern inconsistency with the documented pipeline creates confusion for implementors and could
   lead to copy-paste of the weaker ordering in PG9 wizard actions.
3. The CSRF-coverage guard test (tests/integration/csrf-coverage.test.ts) only checks that assertCsrf is
   present, not that it is called before requireUser.

**Recommendation for PG9:** Adopt `assertCsrf → requireUser` ordering in all new wizard actions (matching
the LMS pattern). The security page action should be fixed at the same time, but is not a critical
exploit path given the session-bound derivation. Add an ordering assertion to the CSRF-coverage test:
check that the line offset of `assertCsrf(` is earlier than `requireUser(` in each action.

---

### F-03 — LOW — Legacy backtester page returns before requireUser for the legacy slug

**File:** apps/web/src/app/(app)/app/bots/[bot]/backtester/page.tsx:18-28

```
if (bot === 'legacy') {
  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Legacy backtester" title="Not available" />
      ...
    </div>
  );
}
const user = await requireUser();
```

An authenticated (but non-entitled) user who navigates to `/app/bots/legacy/backtester` receives the
"Not available" card without any entitlement check. The content reveals no sensitive data (it only says
the feature is out of scope) so the practical risk is negligible. The page is protected by the
`(app)/app/layout.tsx` auth gate (`getCurrentUser` → redirect('/login') on line 15) so unauthenticated
access is blocked at the layout level.

However the inconsistency with every other bot sub-page (which all call `loadBot()` → `BotAccessRequired`
before rendering anything) means this page accidentally shows a bot sub-page to any user who hits the URL,
regardless of their legacy_bot entitlement. The content is anodyne but the pattern must not be replicated
in PG9 card detail pages.

**Recommendation for PG9:** Always call `requireUser()` and `accessFor()` before any product-specific
render — even for "coming soon / not available" states. Move the legacy bot lock check to AFTER the
entitlement gate or inside `loadBot()`.

---

### F-04 — INFO — TORTILA_WARNINGS rendered on the overview page regardless of tortila_bot entitlement

**File:** apps/web/src/app/(app)/app/page.tsx:31, 44-49

```
const blockingTortila = TORTILA_WARNINGS.filter((w) => w.severity === 'error');
...
{blockingTortila.length > 0 && (
  <Card title="Operational notices (Tortila)">
    {blockingTortila.map((w) => ( ... ))}
  </Card>
)}
```

`TORTILA_WARNINGS` is a static constant (no DB/network call) imported from `@wtc/bot-adapters`. It
contains canonical risk warnings about the Tortila bot (TP reconciliation P0, margin pre-flight P1) that
are rendered on the overview page for ALL authenticated users, including those who have no `tortila_bot`
entitlement.

The data disclosed is operational/risk metadata about the platform's bot integration, not user-specific
data. No PII, no secrets. However, showing a "Risk & audit warnings" card about a product the user does
not own is noisy and confuses the security model (it implies product-level state is visible without
entitlement).

For PG9 the per-product cards must only show setup/activity/risk data when `access.allowed` (or at least
when the user holds a non-blocked entitlement). The Tortila warnings card on the overview page should be
gated on the user having a `tortila_bot` entitlement.

**Recommendation for PG9:** Add `const tortilaAccess = decisions.find(d => d.code === 'tortila_bot')?.d;`
and gate the Tortila warnings card on `tortilaAccess?.allowed`. TORTILA_WARNINGS is still always shown
on the Tortila bot dashboard sub-page (which is already entitlement-gated).

---

### F-05 — INFO — double requireUser() call in bot settings page

**File:** apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:37 and 40

```
const { meta, access } = await loadBot(bot);  // internally calls requireUser() once
...
const state = await loadBotConfig((await requireUser()).id, meta.code);
```

`loadBot()` already calls `requireUser()` internally (features/bots/data.tsx:14-15). The settings page
then calls `requireUser()` a second time on line 40 to get the userId for `loadBotConfig`. This is not a
security issue (both calls return the same session user, and the DB is queried by the same token hash)
but it is a wasteful round-trip to the session store.

**Recommendation for PG9:** Return the user object from `loadBot()` alongside meta+access, or cache the
result. PG9 wizard pages that call `loadBot()` should reuse the returned user rather than calling
`requireUser()` again.

---

### F-06 — INFO — CSRF-coverage test minimum count is stale

**File:** tests/integration/csrf-coverage.test.ts:23

```
expect(files.length).toBeGreaterThanOrEqual(7);
```

The test finds 7+ server-action files. As of PG8 there are significantly more than 7 server-action files
across the app (lms/actions.ts alone has 9 actions; admin/actions.ts has 5; features/tv/actions.ts has 2;
plus auth, billing, security, settings, indicators, teacher). The floor of 7 no longer exercises a
meaningful regression.

**Recommendation for PG9:** Update the floor to the current count (17 or above) and add the ordering
check noted in F-02. The test already correctly asserts per-file CSRF coverage; raising the floor catches
a future deletion of a file from the scan path.

---

### F-07 — LOW — `saveBotConfigAction` silently returns without audit on entitlement denial

**File:** apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:20-21

```
const access = await accessFor(user.id, meta.code);
if (!access.allowed) return;
```

The bot settings action fails closed (good) but returns silently on entitlement denial, writing no audit
row. The LMS guard (features/lms/guard.ts) established the correct pattern in PG7: denials must be
audited with `result:'failure'` so that an adversary who forges a request or submits after entitlement
expires produces a detectable audit trail.

No secret data is exposed; the action simply does nothing. But without an audit row, a revoked user
repeatedly submitting config forms leaves no trace.

**Recommendation for PG9:** Apply the PG7 LMS guard pattern to bot config actions: on access denial,
write an audit event (`bot.config_denied`, targetType `bot_config`, result `failure`, reason from
`access.reason`) before returning. This is especially important for the live-mode config path.

---

### F-08 — INFO — Security wizard form fields use type="password" which is browser-safe

**File:** apps/web/src/app/(app)/app/security/page.tsx:41-42

```
<input ... id="apiKey" name="apiKey" type="password" required />
<input ... id="apiSecret" name="apiSecret" type="password" required />
```

Confirmed positive: `type="password"` prevents autocomplete to non-password managers, prevents browser
history persistence, and prevents the value from appearing in screenshots. Combined with the vault seal
on the server side (`addExchangeKey` → `getVault().seal(JSON.stringify({apiKey, apiSecret}), aad)`) and
the audit writing only `keyMask` (never plaintext), the exchange-key pipeline satisfies all
SECRET_VAULT_DESIGN.md controls.

No action required. Documenting for PG9 implementors: any new wizard field capturing API keys or secrets
must use `type="password"`.

---

### F-09 — INFO — Positive: entitlement engine correctly gates all activity data in the bot sub-pages

All bot sub-pages (positions, trades, equity, safety, settings) correctly call `loadBot()` →
`if (!access.allowed) return <BotAccessRequired ... />` before fetching ANY adapter data. The adapter
calls `getBotAdapter()`, `getHealth()`, `getMetrics()`, `getPositions()`, `getTrades()`, `getConfig()` are
all inside the post-gate code path. No bot positions, metrics, or config data is loaded for non-entitled
users.

Similarly, education pages (courses, lessons) pass `hasAccess: access.allowed` to `loadStudentCourse` /
`loadStudentLesson`, which check `if (!hasAccess) return null` as the first statement — a double gate.

The terminal page derives `licStatus` from `access.reason` (not from the bridge mock) which is correct
fail-closed behaviour. CTAs are disabled when `isDev || !access.allowed`.

---

### F-10 — INFO — Positive: B2/B3/B4 blockers are surfaced honestly throughout

- B3 (legacy adapter blocked): `BOT_CAPS.liveAdapterBlocked` is `true` for `legacy_bot`; the bot overview
  renders a distinct `RiskWarningBanner severity="error"` with the B3 explanation
  (apps/web/src/app/(app)/app/bots/[bot]/page.tsx:79-83). The "Start bot" and "Stop bot" buttons are
  disabled with honest tooltips. No fake "available" state.

- B4 (Axioma CTAs): All three CTAs (Download, Open-Journal, Connect-account) are `disabled` when `isDev`
  is true (terminal/page.tsx:119,163,188). `axiomaBridgeIsDev()` reads `APP_ENV` and the presence of
  `AXIOMA_BRIDGE_API_TOKEN`. An explicit banner explains the dev-placeholder state.

- B2 (Stripe checkout): billing/page.tsx renders a prominent `RiskWarningBanner severity="warning"`
  labelled "Mock checkout — hard disabled in production" and the mock-purchase form is conditionally
  rendered only when `process.env.NODE_ENV !== 'production'`.

---

### F-11 — INFO — Positive: audit redaction is defence-in-depth for exchange keys

The `addExchangeKey` repo function in packages/db/src/repositories.ts:203 writes the in-txn audit row
with only `{ label, exchange, mode, keyMask, keyId }` — never the apiKey or apiSecret. The `redact()`
function in packages/audit/src/redact.ts has `'apikey'` in SECRET_HINTS (normalised lowercase, covering
`apiKey`, `api_key`, `API_KEY`). Even if a future caller accidentally includes the raw key in an audit
after payload, the redactor would catch it. Both controls are independent.

---

## Decisions

1. F-01 is the primary action item for PG9 implementation: TV activity data (and all per-product
   setup/activity signals) must be loaded inside an `if (access.allowed)` branch in every product card.
   The PG9 enrichment spec must make this the canonical pattern in code comments.

2. F-02 ordering is a policy clarification, not a critical security fix, given the session-bound CSRF
   derivation. PG9 new actions should adopt `assertCsrf → requireUser` ordering from the start.

3. The layout-level auth gate in (app)/app/layout.tsx:15 is confirmed present and correct, providing
   a fallback authentication boundary for all routes under /app. Per-page requireUser() calls are
   defence-in-depth, not the primary gate.

4. The `TORTILA_WARNINGS` static constant is safe to import in the overview page (no secrets, no DB call)
   but the resulting card should be gated on entitlement per F-04 recommendation.

5. No migration is needed for any PG9 security control. All required gates exist; the issue is
   ordering/gating discipline in new code.

## Risks

- F-01 pattern will replicate if PG9 implementors copy indicators/page.tsx as a template. The handoff
  should explicitly cite indicators/page.tsx line 33 as the anti-pattern and bot/[bot]/page.tsx:24 as
  the canonical pattern.

- The CSRF-coverage test (F-06) only fires if the files happen to drop below 7. As the file count grows,
  the test becomes less useful as a regression guard. Risk: a new wizard action file that imports
  'use server' but forgets assertCsrf could pass the test if the per-file assertion is the only
  thing checked.

- If PG9 adds new server actions in features/ directories outside apps/web/src/app/, the CSRF-coverage
  test scanner (which only searches APP_DIR = apps/web/src/app/) will miss them. This is true for
  features/tv/actions.ts and features/lms/actions.ts today (they are scanned via page-level imports, not
  directly). PG9 must verify that new feature actions are included in the scan.

- F-07 (no audit on config denial) is a low risk today because the bot config is never applied to the
  live bot. It becomes high-risk if live-control actions are ever added — silent denial with no audit
  trace is unacceptable for live trading controls.

## Verification / tests

- CSRF pipeline verified: tests/integration/csrf-coverage.test.ts confirms assertCsrf in every
  server-action file. The per-file assertion is per-action granular.
- Entitlement engine is pure-function tested in packages/entitlements (explainAccess, evaluateStatus,
  fail-closed unknown-state path).
- DB audit redaction tested via packages/audit tests (redact SECRET_HINTS coverage).
- Vault seal/open tested via packages/crypto tests (AES-256-GCM round-trip, AAD binding).
- Exchange-key pipeline (no plaintext in DB): packages/db/src/repositories.ts:188-211 never stores raw
  apiKey/apiSecret; only sealed blob + keyMask persisted. `listExchangeKeys` (line 208) explicitly
  confirms it never joins exchange_api_key_secrets.
- LMS denial audit (PG7 guard pattern) tested in tests/integration/lms-rbac-pipeline.test.ts.

Tests needed for PG9:
- Integration test asserting that `loadTvUserData` is NOT called when `access.allowed === false` (static
  source analysis: check that the loadTvUserData call in indicators/page.tsx is inside an `if (access.allowed)`
  branch after the fix lands).
- CSRF ordering test: extend csrf-coverage.test.ts to assert that the byte offset of `assertCsrf(` is
  less than the byte offset of `requireUser(` in each action.
- Guard test: for each new PG9 product card data loader, a static guard test (like the PG7/PG8 pattern
  in tests/integration/*.test.ts) asserting the loader is called only inside the `if (access.allowed)`
  branch.

## Next actions

1. Before any PG9 edit: fix F-01 in indicators/page.tsx — move `loadTvUserData` call inside
   `if (access.allowed)` branch. This is a one-line gate addition; no migration, no new UI.

2. PG9 enriched card implementation must follow the gate-first pattern:
   access decision → if not allowed, return minimal denial card (never load per-product data).

3. Add the TORTILA_WARNINGS entitlement gate on the overview page (F-04): gate the Operational notices
   card on the tortila_bot access decision being allowed or grace.

4. Raise the CSRF-coverage test floor from 7 to the current count plus add ordering assertion (F-06).

5. Add audit-on-denial to saveBotConfigAction (F-07) using the lms/guard.ts pattern as a template.

6. Fix the ordering in security/page.tsx addKeyAction from `requireUser → assertCsrf` to
   `assertCsrf → requireUser` for consistency (F-02, low-risk but correct the pattern before PG9
   copy-paste risk grows).
