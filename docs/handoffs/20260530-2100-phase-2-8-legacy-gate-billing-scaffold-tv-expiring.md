# Phase 2.8 / Phase Groups 3 + 4(unblocked) + PG5-follow-up — Legacy hard gate · Billing scaffold · markExpiringSoon (aggregate handoff)

_2026-05-30, epoch `20260530-2100`. Operator-authored aggregate per [`SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **5 read-only auditor fan-out (agents-before-edits, Rule 1)** via one Workflow run (`wf_824781f2-457`)
→ operator-orchestrated **serial** implementation (not a git repo, no worktrees, no parallel writers). **5 per-agent
handoff files** at this epoch, every one cited below. No SSH / live server / live bot / live exchange / Stripe charge /
TradingView automation / Axioma production call. **Not production-ready.** Fourth phase-group window in the operator's
continuous program (follows Phase 2.7 / PG2+PG5, epoch `20260530-1930`)._

## Scope

Three bounded workstreams from [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md):

- **PG3 — Legacy hard gate (B3 in-repo gate; real adapter stays BLOCKED).** Honest "live adapter unavailable" UI for the
  legacy bot (replacing the generic "simulated data" banner); a `LegacyBlockedAdapter` compile-time gate + regression test
  proving the legacy bot **cannot activate** a real HTTP adapter in any mode; a Zod exclusion schema that strips any
  plaintext-key (SECRET_HINTS) field from a `/api_management/` body before it could reach the WTC canonical layer.
- **PG4 — Billing (UNBLOCKED parts only).** Q-2 (billing provider) is **OPEN** (default: manual admin grant only) and **no
  Stripe test keys** exist in this environment, so **B2 test-mode checkout is NOT RUN**. Delivered the unblocked scaffold: a
  pure `checkoutAvailability()` gate, a `features/billing/` view-model + server-only checkout-CTA module, and an honest
  pricing/billing CTA. The `available:true` path is intentionally **absent** (no dead code).
- **PG5 follow-up — `markExpiringSoon`.** A worker pre-pass that finally writes the 7-day `expiring_soon` status (tracked
  F-06 from Phase 2.7), co-landed with the **critical** widening of `sweepTvExpiry` to also revoke `expiring_soon` rows.

**No migration** (`db:generate` → "No schema changes"; 40 tables): PG5 reuses `tradingview_access_requests.status`
(text, no CHECK); PG3/PG4 add no tables.

## Agents launched (5 per-agent handoffs — all closed; every one cited)

Read-only audit fan-out (one Workflow run `wf_824781f2-457`; all 5 returned, none left running):
1. `ecosystem-bot-integration-auditor` → [`…-ecosystem-bot-integration-auditor.md`](20260530-2100-ecosystem-bot-integration-auditor.md) — `LegacyBlockedAdapter` + `LegacyAdapterBlockedError(blockerRef='B3')` design, factory gate (F-01), `liveAdapterBlocked` data-driven banner (F-04), `LegacyApiSafeBodySchema` exclusion (F-05), barrel-export hygiene (F-06), serial impl order (D-06).
2. `ecosystem-security-auditor` → [`…-ecosystem-security-auditor.md`](20260530-2100-ecosystem-security-auditor.md) — SECRET_HINTS sufficiency (F-01), legacy body-isolation (F-02), 5 BOT_CONTROL gates remain NOT STARTED (F-03), **B2 NOT RUN** + checkout seam (F-04), STRIPE_* env handling (F-06), system-actor + audit decision for `markExpiringSoon` (F-07), the **sweepTvExpiry-must-include-expiring_soon** correctness bug (F-08 / Risk 1).
3. `ecosystem-billing-access-auditor` → [`…-ecosystem-billing-access-auditor.md`](20260530-2100-ecosystem-billing-access-auditor.md) — duplicated inline PLANS map (F-01), no `checkoutAvailability`/honest CTA (F-02), prod render-guard for dev-only mock checkout (F-03), `markExpiringSoon` is not dead code (F-04), explicit TARGET/NOT-RUN table for createCheckout/price-map/integration test (F-05), entitlement-only-source invariant (F-06), **two-files-only no-dead-code** decision.
4. `ecosystem-tradingview-access-implementer` → [`…-ecosystem-tradingview-access-implementer.md`](20260530-2100-ecosystem-tradingview-access-implementer.md) — `markExpiringSoon` predicate (`gt(now)` lower bound + `isNotNull`), `expiresAt` on the request row (F-03), `TV_EXPIRING_SOON_WINDOW_MS` placement (F-04), exact signature + `returning({id})` count + no-audit decision (F-05), worker call-site (F-06), the **critical sweep-widening** next-action, 6-case test matrix (F-09).
5. `ecosystem-tests-runner` → [`…-ecosystem-tests-runner.md`](20260530-2100-ecosystem-tests-runner.md) — exact test files/placement (legacy-blocked gate+exclusion, checkoutAvailability, db-tv-expiring), the full gate sequence, the legacy-banner **content-only** e2e assertion (F-05), **no-429/no-burst-e2e** reaffirmation, `retries:2` carry-forward, governance N-cited note (F-07).

## Cross-auditor conflicts resolved (operator decisions)

1. **SECRET_HINTS sourcing** — bot-integration (D-05: local list, avoid `@wtc/audit` coupling) vs security (F-01: import
   `isSecretKey`/`isSecretValue`). **Decision: local `LEGACY_SECRET_FIELD_NAMES` in `@wtc/bot-adapters`** — keeps the package
   boundary clean (`@wtc/bot-adapters` depends only on `@wtc/analytics`), with a SUPERSET-of-redact comment + a new
   OPEN_QUESTIONS standing item ([Q-14](../OPEN_QUESTIONS.md)) to prevent drift.
2. **`createHttpLegacyAdapter` fate** — bot-integration F-06 (remove from barrel; may remain in http.ts) vs tests-runner D-6
   ("remains exported"). **Decision: DELETED from `http.ts` + barrel + factory** — the strongest "cannot activate" guarantee:
   the `/api_management/` probe code no longer exists. The contract doc preserves the mapping knowledge.
3. **`markExpiringSoon` signature** — three variants across handoffs. **Decision: `markExpiringSoon(db, now?, windowMs = TV_EXPIRING_SOON_WINDOW_MS)`**
   (matches `sweepTvExpiry(db, now)`; window overridable for tests) + the TV-auditor's correct predicate (with the `> now`
   lower bound so already-expired grants are left for the sweep).
4. **`checkoutAvailability` shape/location** — **Decision: pure `checkoutAvailability(opts)` in `@wtc/billing`** (unit-tested
   without env mutation) + a thin server-only `checkoutCta()` web wrapper that reads env. Keyed on existing
   `BILLING_PROVIDER`+`STRIPE_SECRET_KEY` — **no new `BILLING_CHECKOUT_ENABLED` env var** (stays off the `env.ts` spine; that
   flag would gate a path that does not exist yet). The `available:true` branch is **absent** until B2.

## Files changed

**PG3 — `@wtc/bot-adapters` (the legacy hard gate):**
- `packages/bot-adapters/src/legacy/legacy-blocked.ts` (new) — `LegacyAdapterBlockedError` (readonly `blockerRef='B3'`) + `createLegacyBlockedAdapter()`: every data/health-read method throws the blocked error, control methods throw `BotControlDisabledError`, `getHealth()` returns a deterministic blocked state (`readState='not_configured'`, detail cites B3) with **no network call**, `getWarnings()` still surfaces `LEGACY_WARNINGS`.
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts` (new) — `LegacyApiSafeBodySchema` (Zod transform) + `isLegacySecretField` + `LEGACY_SECRET_FIELD_NAMES` (superset of redact.ts SECRET_HINTS) + recursive `stripSecretFields` (drops secret-hint keys at any depth; cap 8).
- `packages/bot-adapters/src/factory.ts` — legacy non-mock mode now returns `createLegacyBlockedAdapter()` (ignores `legacyBaseUrl` — cannot point at the bot); mock mode → `createMockLegacyAdapter()`. Removed the `createHttpLegacyAdapter` import.
- `packages/bot-adapters/src/http.ts` — **DELETED** `createHttpLegacyAdapter` (the `/api_management/` probe); dropped the now-unused `LEGACY_WARNINGS` import; left a comment explaining the deletion + the blocked path.
- `packages/bot-adapters/src/index.ts` — barrel drops `createHttpLegacyAdapter`; adds `createLegacyBlockedAdapter`, `LegacyAdapterBlockedError`, `LegacyApiSafeBodySchema`, `isLegacySecretField`, `LEGACY_SECRET_FIELD_NAMES`.
- `apps/web/src/features/bots/meta.ts` — `BotCapabilities.liveAdapterBlocked` (+ `liveAdapterBlockedReason`); `legacy_bot: true` (B3 reason), `tortila_bot: false`.
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` — banner swap: `caps.liveAdapterBlocked` → honest "Live adapter unavailable — blocked pending upstream fix (B3)" (error tone) else the existing mock "Simulated data" banner.
- `apps/web/src/app/(app)/app/bots/page.tsx` — per-card "Live adapter unavailable — blocked (B3)" banner for `liveAdapterBlocked` bots (legacy), shown regardless of access/mode.

**PG5 follow-up — `@wtc/db` + worker:**
- `packages/db/src/repositories.ts` — `gt`/`isNotNull` added to the drizzle import; `TV_EXPIRING_SOON_WINDOW_MS = 7d`; new `markExpiringSoon(db, now?, windowMs?)` (predicate `status='granted' AND expiresAt IS NOT NULL AND expiresAt > now AND expiresAt <= now+window`; `.returning({id})` count; no per-row audit); **`sweepTvExpiry` predicate widened** to `inArray(status, ['granted','expiring_soon'])` (co-land — else expiring_soon rows would never be revoked).
- `apps/worker/src/index.ts` — `dbTick` calls `markExpiringSoon(db, now)` **before** `sweepTvExpiry`; `tvExpiringSoon` added to the worker health-check detail + log line.

**PG4 — `@wtc/billing` + web billing feature dir:**
- `packages/billing/src/provider.ts` — pure `checkoutAvailability(opts)` + `CheckoutAvailability` type (3 honest false branches; **no `available:true` branch** until B2).
- `packages/billing/src/index.ts` — exports `checkoutAvailability` + `CheckoutAvailability`.
- `apps/web/src/features/billing/plans.ts` (new) — pure `buildPricingCards()` view-model (consumed by both pages; removes the duplicated inline `PLANS.filter/map`).
- `apps/web/src/features/billing/checkout.ts` (new) — server-only `checkoutCta()` (honest CTA from env via `checkoutAvailability`).
- `apps/web/src/app/(public)/pricing/page.tsx` — consumes `buildPricingCards()` + renders the `checkoutCta()` pill ("Self-serve checkout unavailable") and honest CTA (logged-in → "Contact support for access" → `/app/support`; logged-out → "Create account"). Updated the "How access works" banner copy.
- `apps/web/src/app/(app)/app/billing/page.tsx` — dev-only mock-checkout section now uses `buildPricingCards()` and is wrapped in a `NODE_ENV !== 'production'` render guard (F-03).

**Tests:**
- `packages/bot-adapters/src/__tests__/legacy-blocked.test.ts` (new, **42**) — factory gate (read-only/audited + baseUrl ⇒ blocked, never HTTP; mock ⇒ mock), blocked data methods throw `LegacyAdapterBlockedError(blockerRef='B3')`, control throws `BotControlDisabledError`, `getHealth` no-fetch (stubbed `fetch` asserted not called), warnings canonical + `legacy_plaintext_keys`, Zod exclusion strips api_key/secret_key (flat/nested/array, value-not-present).
- `tests/integration/db-tv-expiring.test.ts` (new, **7**, isolated PGlite) — 6-day→expiring_soon, 10-day→granted, already-expired→untouched (left for sweep), idempotent, revoked-untouched, and the **sequence** proof (granted→expiring_soon→revoked, exercising the widened sweep).
- `packages/billing/src/provider.test.ts` (+**4**) — `checkoutAvailability` never returns `available:true` (provider unset / mock / stripe-no-key / stripe+key-not-wired).

**Docs (owned-doc truth updates):**
- `docs/OPEN_QUESTIONS.md` — new **Q-14** (SECRET_HINTS ↔ LEGACY_SECRET_FIELD_NAMES coordination, standing item).
- `docs/CONTRACTS/legacy-bot-adapter.md` — Mock-vs-Real table: read-only/audited now routes to `LegacyBlockedAdapter` (real HTTP adapter deleted; BLOCKED on B3).
- `docs/BOT_CONTROL_SAFETY_MODEL.md` — note the factory-level legacy block.
- `docs/TRADINGVIEW_ACCESS_PLAN.md` — `expiring_soon` transition marked CURRENT (was TARGET).
- `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` — operator truth (serialize-last).

## Findings → fixes (summary)

- **PG3 F-01/F-02 (factory routed legacy to a live `/api_management/` adapter).** Deleted the real legacy HTTP adapter; the
  factory routes every non-mock mode to `createLegacyBlockedAdapter` (no network, throws on data). Regression-tested.
- **PG3 F-04 (one banner for all bots implied legacy could be configured on).** `liveAdapterBlocked` capability drives a
  distinct legacy banner — honest that the live adapter is permanently blocked (B3), not merely unconfigured.
- **PG3 F-05 (no SECRET_HINTS exclusion existed).** `LegacyApiSafeBodySchema` strips every secret-hint field (flat/nested/
  array) before any value could reach the canonical layer — the WTC-side B3 deliverable (16 exclusion tests).
- **PG5 F-08 / Risk-1 (the critical bug).** `markExpiringSoon` writing `expiring_soon` would have stranded those rows
  forever because `sweepTvExpiry` filtered `status='granted'` only. **Co-landed** the sweep widening to
  `inArray(['granted','expiring_soon'])`; the db-tv-expiring sequence test proves an expiring_soon row is revoked at expiry.
- **PG4 F-02 (CTA didn't signal checkout is off).** `checkoutCta()` drives an honest "Self-serve checkout unavailable" pill +
  a "Contact support for access" CTA — no fake purchase button. `checkoutAvailability` can never report available here.
- **PG4 dead-code avoidance.** Only the two genuinely-consumed modules were built (`plans.ts`, `checkout.ts`); the
  `actions/CheckoutButton/SubscriptionStatus` items stay TARGET (would be dead code until B2 — the PG11 logger precedent).

## Decisions

1. Real legacy HTTP adapter **deleted**; `LegacyBlockedAdapter` is the only legacy non-mock path; mock stays the demo path.
2. `liveAdapterBlocked` is a **static product capability** (true for legacy in every mode) — even mock-mode legacy dashboards
   show the honest "blocked" banner (the message: you see simulated data; the real adapter is permanently blocked).
3. `LEGACY_SECRET_FIELD_NAMES` is a **local superset** of redact.ts SECRET_HINTS (no `@wtc/audit` dependency); drift tracked in Q-14.
4. `markExpiringSoon` writes **no per-row audit** (internal informational status bump; the durable record is the later
   `tv_access.revoke`). System actor pattern applies if any future audit is added.
5. **B2 NOT RUN** (Q-2 open + no Stripe test keys). `checkoutAvailability` has no `available:true` branch; no new env flag.
6. **No migration** — `db:generate` = "No schema changes" (40 tables).
7. Continuous program, governed per group: own epoch + aggregate; the newest aggregate is the strictly-validated one.

## Risks

- **`markExpiringSoon`/`sweepTvExpiry` interaction** is correct only because the sweep predicate was widened to include
  `expiring_soon` — verified by the sequence test. Any future change to either predicate must preserve this invariant.
- **`LegacyApiSafeBodySchema` has no runtime caller today** (the blocked adapter never fetches). It exists as the B3
  deliverable for the future un-block; its 16 unit tests give it near-100% coverage so it is not silently dead.
- **`LEGACY_SECRET_FIELD_NAMES` vs redact.ts SECRET_HINTS drift** — mitigated by the superset comment + Q-14; a future
  redact.ts addition must be mirrored.
- **Legacy dashboard behaviour change in read-only mode** — previously fell through to mock; now returns the blocked
  adapter (honest, not a regression). Mock mode (the default + e2e) is unchanged for data rendering.
- All surfaces still render the honest labelled demo state here (no `DATABASE_URL`); **PGlite is not a substitute for
  real-PG acceptance (B1)** — unchanged.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run check:core` | **PASS** (7 smokes) |
| 2 | `npm run lint` | **PASS** (`--max-warnings 0`, exit 0) |
| 3 | `npm run typecheck` (packages) | **PASS** |
| 4 | `npm run typecheck -w @wtc/web` | **PASS** |
| 5 | `npm run secret:scan` | **PASS** (clean) |
| 6 | `npm test` (Vitest) | **PASS — 370 passed / 7 skipped (377)** across 35 files (+53: legacy-blocked 42, db-tv-expiring 7, checkoutAvailability 4) |
| 7 | `npm run coverage` | **PASS — 26.21% stmts / 73.49% branch** (↑ from 25.61 / 72.72) |
| 8 | `npm run db:generate -w @wtc/db` | **PASS — 40 tables; "No schema changes"** (no migration this phase) |
| 9 | `npm run build -w @wtc/web` | **PASS — 44 app routes; `ƒ Middleware 35.2 kB`** |
| 10 | `npm run e2e` (Playwright) | **PASS — 36/36** (35 passed clean + **1 dev-only Server-Action login recompilation-race flake auto-retried green** — the mobile Phase-2.4 E2E-31/32 `login` `waitForURL('**/app')`; `retries:2`; exit 0). The **new legacy blocked-banner content assertion** on `/app/bots` passed. 5.4 min. |
| 11 | `npm run governance:check` | **PASS** (current phase `20260530-2100`; 5 cited per-agent handoffs all present; max 5 ≤ 5; 0 errors, 1 allowlisted historical warning) |
| — | `db:migrate` / `db:seed` / real-PG harness | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent (B1). |
| — | **B2 Stripe test-mode checkout** (createCheckout, price map, pending_payment→active integration test) | **NOT RUN** — Q-2 undecided + no Stripe test keys (B2). `checkoutAvailability` reports unavailable. |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety): SSH/live servers, live bot control, real adapters/exchange, real Stripe charge, Axioma production
handoff, TradingView automation, plaintext exchange keys. `BOT_ADAPTER_MODE=mock` default preserved; **legacy real adapter
deleted + factory-blocked (B3)**.

## Background agents — closed

All 5 per-agent runs in the audit fan-out (Workflow `wf_824781f2-457`) **completed**. **No agents remain running.**

## Next actions (continuous program — each its own epoch + aggregate)

- **PG6 Axioma non-blocked surface** (ES256 wire behind a staging fence + `axioma_handoff_jti_revocations` table + `consumeJti`;
  CTAs stay disabled) — needs the PG-DB wave; CTAs blocked on B4 (endpoint shapes + P-256 key).
- **PG7 LMS** rich migration (if bounded) + LMS RBAC-throw + CSRF-first ordering.
- **PG8 Admin console** mobile cards + honest state pills consuming PG2/PG5 real state.
- **Operator-gated (BLOCKED until provided):** real-PG `wtc_test` URL (B1); Stripe provider decision + test keys (B2);
  Axioma endpoint shapes + P-256 key (B4); legacy plaintext-key upstream fix (B3 — un-blocks the real adapter); git init + remote (B6).
- **Carried:** F-03 structured logger (PG12); CSP per-request nonce (PG3 carryover); move static headers to `next.config.ts`;
  Q-14 SECRET_HINTS coordination.
- Full register: [`PRODUCTION_BLOCKERS.md`](../PRODUCTION_BLOCKERS.md); ordering: [`EXECUTION_PLAN_MASTER.md`](../EXECUTION_PLAN_MASTER.md).
