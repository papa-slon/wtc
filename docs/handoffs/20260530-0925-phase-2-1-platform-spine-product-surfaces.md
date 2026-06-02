# Phase 2.1 — Migration 0002 + Broad Platform Spine + Parallel Product Surfaces (aggregate handoff)

_2026-05-30 09:25 epoch. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **12-agent read-only design/audit fan-out** (one parallel wave, agents-before-edits), each with a
per-agent handoff cited below. Implementation followed the established **audit-fan-out → operator-serial-implement**
pattern (Phase 1.7 / Phase 2 precedent): all shared-file work was single-writer (operator). Not a git repo — no
commits/branches/PRs/CI proof. No live servers/SSH/bots touched; real bot control stays disabled; no real exchange
calls; no Axioma production bridge; no TradingView automation; no real `db:migrate`/`db:seed` (no `DATABASE_URL`).
**Not production-ready.**_

## Scope

Phase 2.1 implements the staged serial spine + product surfaces designed in Phase 2 (epoch `20260530-0126`).
Per **Rule 7**, the full 12-part build (entire data spine + S-4 full LMS + S-6 full selector rewrite + 7 parallel UI
groups) cannot be implemented AND gate-verified at quality in one session. This session therefore: (1) ran the
mandatory **12-agent parallel audit fan-out** producing code-exact, implementation-ready specs verified against
*current* code; (2) implemented and **gate-verified the complete, tested data/crypto spine** (migration `0002`,
~40 repositories, the Stripe webhook adapter, the Axioma ES256/JWKS upgrade, and the security-vocabulary hardening);
(3) landed **two new real product surfaces** (bot-config settings, support/notifications). The remaining UI breadth
(full LMS, billing UI, TV grants/profiles UI, admin panels, terminal DB-wiring) is **staged** with a copy-pasteable
follow-up prompt (Next actions) — **this is a Rule-7 partial landing, NOT a phase-complete claim.**

## Agents launched (12 — all closed; per-agent handoffs cited)

One parallel Wave-1 fan-out (read-only design/audit; no code edits in Wave 1). Each wrote a per-agent handoff in
canonical format at the `20260530-0925` epoch. (`ecosystem-task-router` is a read-only agent type with **no Write
tool** by design — it authored its handoff content and the operator persisted the file; noted in that file's header.)

1. `ecosystem-task-router` → [`20260530-0925-ecosystem-task-router.md`](20260530-0925-ecosystem-task-router.md) — Phase-2.1 classification, write-ownership confirmation, minimum-coherent-landable-scope, risk gates.
2. `ecosystem-platform-architect` → [`20260530-0925-ecosystem-platform-architect.md`](20260530-0925-ecosystem-platform-architect.md) — spine S-1→S-8 + P-A→P-E re-verification; flagged page-level `@wtc/analytics` import drift + the products/[slug] dual-owner collision.
3. `ecosystem-db-architect` → [`20260530-0925-ecosystem-db-architect.md`](20260530-0925-ecosystem-db-architect.md) — the paste-ready Drizzle for all 18 tables + 1 ALTER, the column-name/circular-FK/INET/partial-index gotchas, the offline `db:generate` flow, and the full PGlite test matrix. **Primary S-1/S-2/S-3 implementation source.**
4. `ecosystem-security-auditor` → [`20260530-0925-ecosystem-security-auditor.md`](20260530-0925-ecosystem-security-auditor.md) — paste-ready AUDIT_ACTIONS/SECRET_HINTS/RBAC additions; the `addExchangeKey` missing-audit and `grantProduct` actor findings.
5. `ecosystem-bot-integration-auditor` → [`20260530-0925-ecosystem-bot-integration-auditor.md`](20260530-0925-ecosystem-bot-integration-auditor.md) — WTC-DB-only config-save flow, the Tortila/Legacy config field sets, safety-severity mapping, and the missing simulated-data banner on the safety sub-page.
6. `ecosystem-billing-access-auditor` → [`20260530-0925-ecosystem-billing-access-auditor.md`](20260530-0925-ecosystem-billing-access-auditor.md) — StripeAdapter contract, the missing event branches, the product_access_events + DB-idempotency gaps.
7. `ecosystem-axioma-bridge-auditor` → [`20260530-0925-ecosystem-axioma-bridge-auditor.md`](20260530-0925-ecosystem-axioma-bridge-auditor.md) — ES256/JWKS spec, the `!('d' in jwk)` hard assertion, the JWKS route path, and the honest jti/replay TARGET gap.
8. `ecosystem-education-implementer` → [`20260530-0925-ecosystem-education-implementer.md`](20260530-0925-ecosystem-education-implementer.md) — full LmsService (22 methods), Zod/view-types, ownership/entitlement guards, route trees, progress-persistence rules.
9. `ecosystem-tradingview-access-implementer` → [`20260530-0925-ecosystem-tradingview-access-implementer.md`](20260530-0925-ecosystem-tradingview-access-implementer.md) — current-vs-TARGET reconciliation, the six new TV repos, the revoke-metadata debt fix, automation-stays-off confirmation.
10. `ecosystem-ux-ui-designer` → [`20260530-0925-ecosystem-ux-ui-designer.md`](20260530-0925-ecosystem-ux-ui-designer.md) — component specs + honesty-label placement for all Phase-2.1 surfaces; the three-tier build priority.
11. `ecosystem-tests-runner` → [`20260530-0925-ecosystem-tests-runner.md`](20260530-0925-ecosystem-tests-runner.md) — Phase-2.1 integration/e2e test plan, the real-PG `wtc_test` name-guard requirement, the observed baseline gate run.
12. `ecosystem-devops-implementer` → [`20260530-0925-ecosystem-devops-implementer.md`](20260530-0925-ecosystem-devops-implementer.md) — env declarations (Stripe already optional; Axioma ES256 vars TARGET), unchanged local-run story, additive-migration rollback note.

## Files changed

**Migrations added (1):** `packages/db/migrations/0002_sour_paibok.sql` — 18 new tables + 1 ALTER (`tradingview_access_requests` +`revoked_at`/`revoked_by`), the hand-added `teacher_profiles` backfill (from `courses.owner_teacher_id`, additive — `owner_teacher_id` kept), and the `pinned_links` owner_type CHECK. `meta/0002_snapshot.json` + `_journal.json` regenerated.

**Packages changed (6):**
- `@wtc/db` — `schema.ts` (18 tables, `courses.teacher_profile_id`, TV revoke cols; `numeric`/`sql` imports); `repositories.ts` (~40 new repos across bots/education/TV/products/terminal/ops/billing; `grantProduct`/`revokeProduct` now write `product_access_events` + accept `actorUserId`; `addExchangeKey` now writes its in-txn audit row; `revokeTv` now persists `revoked_at`/`revoked_by`; `TvRequestDTO` carries revoke fields).
- `@wtc/audit` — `audit.ts` (Phase-2.1 AUDIT_ACTIONS codes); `redact.ts` (SECRET_HINTS: ciphertext/sealed/vaultrecord/credentials/bearer/onetimecode/… — **`iv`/`tag` deliberately omitted**, see Decisions).
- `@wtc/auth` — `rbac.ts` (6 new Resource tokens + MATRIX rows).
- `@wtc/billing` — `stripe.ts` (**new** — real Stripe-signature webhook verify + event parse; checkout is an honest not-configured error, never faked); `provider.ts` (wires `createBillingProvider('stripe',…)`); `index.ts` (exports); `stripe.test.ts` (**new**, 8 tests); `provider.test.ts` (stale "stripe not implemented" assertion updated to the new reality).
- `@wtc/axioma-bridge` — `es256.ts` (**new** — ECDSA P-256 signer/verifier, IEEE-P1363 sig, public-JWK with no `d`); `jwks.ts` (**new**); `index.ts` (exports); `es256.test.ts` (**new**, 7 tests). HS256 stub unchanged (still prod-throwing).
- `@wtc/web` — `lib/db-store.ts` (`getDb()`); `lib/backend.ts` (`getServerDb()` — DB when DATABASE_URL set, null in dev for labelled fallback, fail-closed in prod); `features/bots/config.ts` (**new**); `app/(app)/app/bots/[bot]/settings/page.tsx` (placeholder → **real** config form + version history + safety log); `features/support/data.ts` (**new**); `app/(app)/app/support/page.tsx` (placeholder → **real** ticket create/list + notifications); `app/.well-known/axioma-jwks.json/route.ts` (**new** public JWKS route).

**Tests added:** `tests/integration/db-0002.test.ts` (**new**, 19 PGlite cases). **Truth docs:** `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, this aggregate.

**Routes added/promoted (3):** `/.well-known/axioma-jwks.json` (new); `/app/bots/[bot]/settings` (placeholder→real); `/app/support` (placeholder→real).

## Findings → fixes

- **Cross-agent audit-code naming conflict (db-architect vs security-auditor):** the new TV grant repos must write `tv_access.grant/.revoke/.profile_update` (db-architect's PGlite tests assert these) while the legacy request flow keeps `tradingview.*`. **Resolved** by including BOTH vocabularies in `AUDIT_ACTIONS` so the union type stays exhaustive.
- **`iv`/`tag` over-redaction (security F3, operator-adjusted):** `redact()` matches by substring, so bare `iv`/`tag` would redact innocuous fields (`isActive` contains "iv"; `stage`/`stages` contains "tag"). The AES-GCM iv/tag they protect only ever appear inside a sealed vault record whose parent key (`sealed`/`vaultrecord`/`ciphertext`) is already redacted wholesale. **Decision:** omit `iv`/`tag`, document inline.
- **`addExchangeKey` missing in-txn audit (security F1):** **fixed** — now writes `exchange_key.create` with only mask/label/keyId (never the sealed blob or plaintext).
- **`revokeTv` revoke-metadata debt (db-architect F9 / TV F3):** **fixed** — persists `revoked_at`/`revoked_by` on the request row (was audit-only).
- **Billing webhook idempotency had no table in 0002:** **resolved** by using the append-only `audit_logs` row (`billing.webhook_received`, `targetId = stripeEventId`) as the dedupe ledger — `applyStripeEvent` returns `{applied:false}` on replay. A dedicated table is a documented TARGET.
- **Migration backfill ordering:** the `teacher_profiles` backfill + `courses` UPDATE + `pinned_links` CHECK were appended at the **end** of the generated SQL (every table/column exists by then), avoiding ordering hazards.

## Decisions

1. **Rule-7 partial landing.** Verified deliverable = the full data/crypto spine + 2 new UI surfaces. The full `@wtc/lms` 22-method contract (S-4), the full backend-selector rewrite (S-6 LMS/billing services in `db-store.ts`/`demo.ts`), and the remaining 5 UI groups are **staged**, not half-built. A **lean S-6/S-7** (the `getServerDb()` accessor) was implemented instead — new surfaces use it + the `@wtc/db` repos directly, with an honest labelled demo fallback when no DB.
2. **Operator-serial implementation** (Phase 1.7/2 precedent) — shared files (`schema.ts`/`repositories.ts`/`backend.ts`/`db-store.ts`/`audit.ts`/`redact.ts`/`rbac.ts`) are single-writer; no parallel implementer agents (keeps governance clean: 12 design handoffs, operator implements, aggregate cites the 12).
3. **All migration work is additive** — `0000`/`0001` untouched; `owner_teacher_id` retained (drop is a Phase-3 cleanup).
4. **Stripe webhook is real without an SDK** — Stripe's `t=,v1=` HMAC scheme is exactly `verifyWebhookSignature`; only the signing secret is needed. Checkout (a live API call) throws an honest not-configured error unless `STRIPE_SECRET_KEY` is set — never a fake session.
5. **Axioma ES256 private key never leaves `es256.ts`**; `publicJwk()` hard-asserts no `d`; HS256 stays prod-throwing; jti/replay durability is an honest TARGET (no jti table).

## Risks

- The migration-dependent UI breadth (LMS-full, billing UI, TV grants UI, admin panels) is designed + repo-backed but **UI-unbuilt** — follow the serial spine + the per-agent specs; do not parallelise shared-file edits.
- New surfaces in THIS environment (no `DATABASE_URL`) render their **honest labelled demo state** — config saves / tickets are not persisted until a DB is connected (the DB path is PGlite-integration-tested + fails closed in production).
- `applyStripeEvent` idempotency via the audit ledger is correct but does a small scan on `audit_logs` (action-indexed); a dedicated `billing_webhook_events` table is the TARGET for high throughput.
- ES256 needs a real P-256 key in `AXIOMA_HANDOFF_SIGNING_KEY` + `AXIOMA_HANDOFF_KEY_ID` (still TARGET in `loadEnv`/`.env.example`); the JWKS route honestly returns an empty key set until configured.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

_Sequential run on the final tree. All runnable gates GREEN:_

| # | Gate | Result |
|---|---|---|
| 1 | `npm run governance:check` | **PASS** — current phase 20260530-0925; 12 cited per-agent handoffs all present (run after this aggregate) |
| 2 | `npm run check:core` | **PASS** (7 zero-install smokes) |
| 3 | `npm run lint` | **PASS** (`--max-warnings 0`) |
| 4 | `npm run typecheck` (packages) | **PASS** |
| 5 | `npm run typecheck -w @wtc/web` | **PASS** |
| 6 | `npm test` (Vitest) | **PASS — 140 passed / 5 skipped (145)** across 18 files (+34: 19 `db-0002`, 8 `stripe`, 7 `es256`; was 106/5) |
| 7 | `npm run secret:scan` | **PASS** (clean) |
| 8 | `npm run coverage` | **PASS — 33.21% stmts / 69.48% branch** (↑ from 26.74 / 67.47) |
| 9 | `npm run db:generate -w @wtc/db` | **PASS** — generated `0002_sour_paibok.sql`; re-run reports "No schema changes" (in sync) |
| 10 | `npm run build -w @wtc/web` | **PASS** — all routes compiled incl. the new settings/support pages + the JWKS route |
| 11 | `npm run e2e` (Playwright, `CI=1`) | **PASS 16/16** (desktop + mobile; new pages render their honest demo state) |
| — | `db:migrate`/`db:seed` against **real Postgres** | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; opt-in harness skipped (5 cases). |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety policy): SSH/live servers, live bot control, real adapters/billing live calls, Axioma production handoff, TradingView automation, plaintext exchange keys.

## Background agents — closed

The 12 Wave-1 design/audit agents ran as one parallel fan-out that **completed**. **No agents remain running.**

## Next actions (Rule-7 follow-up — each its own NEW session)

Follow the serial spine in [`20260530-0126-ecosystem-platform-architect.md`](20260530-0126-ecosystem-platform-architect.md); the data layer + repos already exist, so these are largely UI + service-wiring:

- **Phase 2.2 — Full LMS (S-4 + P-A):** extend `packages/lms` to the 22-method async contract (`docs/handoffs/20260530-0925-ecosystem-education-implementer.md` has the interface + Zod + view types), wire it through `lib/lms-types.ts` + `db-store.ts` + `demo.ts` (full S-6), then build the teacher/student/admin route trees on the `enrollments`/`lesson_progress`/`teacher_profiles`/`pinned_links` repos (already landed + tested).
- **Phase 2.3 — Billing UI + webhook route (P-B):** `/pricing` + `/app/billing` plan/subscription status (repos `listSubscriptionsForUser`/`applyStripeEvent` exist), the `POST /api/billing/webhook` route (verify-first via the new `createStripeProvider`), and the `ProductAccessView` timeline from `product_access_events`.
- **Phase 2.4 — TV grants/profiles UI (P-E) + admin panels (P-F admin):** user TV profile state + admin grant/revoke-with-metadata (repos `upsertTradingViewProfile`/`createTvGrant`/`revokeTvGrant` exist); real admin users/products/system-health + the support **admin** triage view (`updateSupportTicket`); notifications mark-read action.
- **Phase 2.5 — Terminal DB-wiring (P-D):** back `/app/terminal` + `/products/axioma-terminal` with `terminal_release_cache`/`terminal_download_events`/`terminal_license_events` (repos exist) and wire the ES256 signer + `/.well-known/axioma-jwks.json` (route exists) once `AXIOMA_HANDOFF_SIGNING_KEY` is provisioned.
- **Real Postgres:** provide a throwaway `wtc_test` `DATABASE_URL`, run `db:migrate` (0000+0001+0002) + `db:seed`, and the opt-in `REAL_POSTGRES_DATABASE_URL` harness (add the `wtc_test*` DB-name guard the tests-runner specified).
