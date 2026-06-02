# Phase 2.3 — Commercial Access & Operations Buildout (aggregate handoff)

_2026-05-30 11:45 epoch. Operator-authored aggregate per [`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §4.
Driven by a **5-auditor read-only fan-out (agents-before-edits, Rule 1)** → **operator-orchestrated serial implementation
waves** (no parallel edits — not a git repo, no worktrees). **14 per-agent handoffs** at this epoch, every one cited below.
Not a git repo — no commits/branches/PRs/CI proof. No live servers/SSH/bots/exchange/TradingView-automation/real-Stripe-charge/
Axioma-production calls. **Not production-ready.**_

## Scope

Phase 2.3 turns the Phase-2.1 data/crypto spine into **visible commercial + operational surfaces**, plus critical
correctness/truth cleanup. Delivered across **five product areas** (acceptance criterion: ≥4):

- **Part 0** — docs/nav truth cleanup + **4 critical LMS correctness fixes**.
- **Part 1** — real **`POST /api/billing/webhook`** (signed, idempotent, audited, fail-closed) + product-access timeline + honest billing/pricing UI.
- **Part 2** — TradingView access ops (user state + admin queue on the 0002 grant repos; reason/duration/state-guard/entitlement-recheck). **Manual-first; no automation.**
- **Part 3** — terminal/Axioma DB-wiring (`terminal_release_cache` read; license/download/account-link state; ES256/JWKS readiness; hard-boundary callout; honest dev placeholders).
- **Part 4** — admin operations console (`/admin/users`, `/admin/system-health`, **new** `/admin/support`, `/admin/entitlements` reason/validUntil + timeline).
- **Part 5** — bot product visibility **read-only polish only** (live control stays disabled; legacy adapter stays blocked).

The data layer already existed (migration 0002 repos), so this phase is route + UI + service-glue + correctness + tests + docs — **no migration 0003**.

## Agents launched (14 per-agent handoffs — all closed; every one cited)

**Wave 1 — read-only audit fan-out (5; agents-before-edits):**
1. `ecosystem-task-router` → [`20260530-1145-ecosystem-task-router.md`](20260530-1145-ecosystem-task-router.md) — 7-part classification, write-ownership map, Rule-7 landable scope, risk gates (operator-persisted: this agent has no Write tool).
2. `ecosystem-billing-access-auditor` → [`20260530-1145-ecosystem-billing-access-auditor.md`](20260530-1145-ecosystem-billing-access-auditor.md) — webhook route algorithm, idempotency-ledger vs stale `webhook_idempotency_keys` doc, event-map gaps, admin reason/validUntil gaps, timeline shape.
3. `ecosystem-security-auditor` → [`20260530-1145-ecosystem-security-auditor.md`](20260530-1145-ecosystem-security-auditor.md) — per-mutation pipelines; the 4 LMS correctness bugs (F-01..F-04); webhook CSRF-exempt raw-body; TV grant wiring (F-08); terminal entitlementVerified (F-10); admin DTO no-passwordHash (F-13).
4. `ecosystem-axioma-bridge-auditor` → [`20260530-1145-ecosystem-axioma-bridge-auditor.md`](20260530-1145-ecosystem-axioma-bridge-auditor.md) — terminal DB-wiring design, LicenseStatus gap, `axiomaBridgeIsDev` gating, raw-OTC migration deferral, ES256 publicJwk safety.
5. `ecosystem-bot-integration-auditor` → [`20260530-1145-ecosystem-bot-integration-auditor.md`](20260530-1145-ecosystem-bot-integration-auditor.md) — confirmed all 3 safety gates (control throws, mock default, DB-only config); legacy stays blocked; Zod schema files absent → no new adapter mappings.

**Wave 2 — must-lands implementation (Part 0 + Part 1):**
6. `ecosystem-db-architect` → [`20260530-1145-ecosystem-db-architect.md`](20260530-1145-ecosystem-db-architect.md) — 5 backward-compatible repo edits (no schema change).
7. `ecosystem-education-implementer` → [`20260530-1145-ecosystem-education-implementer.md`](20260530-1145-ecosystem-education-implementer.md) — the 4 LMS fixes in `features/lms`.
8. `ecosystem-backend-implementer` → [`20260530-1145-ecosystem-backend-implementer.md`](20260530-1145-ecosystem-backend-implementer.md) — the webhook route + `features/billing/timeline.ts`.
9. `ecosystem-tests-runner` (must-lands) → [`20260530-1145-ecosystem-tests-runner-mustlands.md`](20260530-1145-ecosystem-tests-runner-mustlands.md) — billing-webhook + LMS-fix tests; scoped gates.

**Wave 3 — visible-progress implementation (Parts 2–5 + docs + full gates):**
10. `ecosystem-tradingview-access-implementer` → [`20260530-1145-ecosystem-tradingview-access-implementer.md`](20260530-1145-ecosystem-tradingview-access-implementer.md) — TV user/admin surfaces + grant/revoke actions.
11. `ecosystem-frontend-implementer` (product surfaces) → [`20260530-1145-ecosystem-frontend-implementer.md`](20260530-1145-ecosystem-frontend-implementer.md) — billing/pricing/terminal UI + bot read-only polish.
12. `ecosystem-frontend-implementer` (admin console) → [`20260530-1145-ecosystem-frontend-implementer-admin.md`](20260530-1145-ecosystem-frontend-implementer-admin.md) — admin users/system-health/support/entitlements.
13. `ecosystem-devops-implementer` → [`20260530-1145-ecosystem-devops-implementer.md`](20260530-1145-ecosystem-devops-implementer.md) — nav/product-status/contract-doc truth + `.env.example`.
14. `ecosystem-tests-runner` (final) → [`20260530-1145-ecosystem-tests-runner.md`](20260530-1145-ecosystem-tests-runner.md) — TV/terminal/admin tests + e2e specs + the full gate sequence.

(`frontend-implementer` and `tests-runner` each ran twice on disjoint scopes → 14 handoff files across 12 agent roles.)

## Files changed

**Repos / domain (db-architect, sole writer of `repositories.ts`):** `packages/db/src/repositories.ts` — `createCourse(+teacherProfileId?)`, `upsertEnrollment(+actorUserId?)`, `markEnrollmentComplete` (audit `targetId` = enrollment.id, fetched in-txn), `grantProduct(+reason?,+validUntil?)`, `revokeProduct(+reason?)`. All params optional/trailing — existing callers unbroken.

**LMS correctness (education):** `apps/web/src/features/lms/{queries.ts,actions.ts}` — teacher read-isolation (ownership before roster/lessons), `createCourseAction` populates `teacherProfileId`, `adminEnrollAction` records the admin as audit actor.

**Billing (backend):** `apps/web/src/app/api/billing/webhook/route.ts` (**NEW**), `apps/web/src/features/billing/timeline.ts` (**NEW**, user view omits actor).

**Surfaces (tradingview + frontend):** `apps/web/src/features/tv/{queries.ts,actions.ts}` (**NEW**), `app/(app)/app/indicators/page.tsx`, `app/admin/tradingview-access/page.tsx`; `apps/web/src/features/terminal/loader.ts` (**NEW**), `app/(app)/app/terminal/page.tsx`, `packages/axioma-bridge/src/bridge.ts` (LicenseStatus +grace/revoked/unknown, backward-compatible); `app/(app)/app/billing/page.tsx`, `app/(public)/pricing/page.tsx`; `app/(app)/app/bots/{page.tsx,[bot]/page.tsx}` (read-only polish); `apps/web/src/features/admin/{types,queries,schemas,actions}.ts` (**NEW**), `app/admin/{users,system-health,support,entitlements}/page.tsx`.

**Docs/nav (devops):** `apps/web/src/lib/nav.ts`, `apps/web/src/lib/product-status.ts`, `docs/CONTRACTS/billing-webhooks.md`, `docs/PAYMENT_WEBHOOK_STATE_MACHINE.md`, `docs/CONTRACTS/tradingview-access.md`, `docs/INTEGRATION_MAP.md`, `.env.example`.

**Tests (tests-runner):** `tests/integration/billing-webhook.test.ts` (**NEW**), `tests/integration/lms-fixes.test.ts` (**NEW**), `tests/integration/phase23-visible-progress.test.ts` (**NEW**), `tests/e2e/smoke.spec.ts` (18→28). Plus 2 lint fixes in `features/admin/queries.ts` + `features/tv/actions.ts`.

**Operator (truth docs + aggregate):** `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, this aggregate.

## Routes added/promoted

- `POST /api/billing/webhook` (**NEW** — first real API mutation route; signature-verified, idempotent, CSRF-exempt).
- `/admin/support` (**NEW** — admin ticket triage).
- Promoted placeholders → real: `/admin/users`, `/admin/system-health`. Enriched: `/admin/tradingview-access`, `/admin/entitlements`, `/app/indicators`, `/app/terminal`, `/app/billing`, `/pricing`. (`/admin/products` intentionally stays a Placeholder — the catalogue is code-defined in `@wtc/entitlements`.) Build = **44 routes**.

## Findings → fixes

- **LMS F-01 (HIGH) cross-teacher read isolation** — `loadTeacherCourse` fetched roster/lessons before any ownership check. **Fixed:** `assertTeacherOwns` now gates before any fetch; non-owner non-admin → `null` (404). Covered by the existing LMS tests + e2e.
- **LMS F-02 (HIGH) admin-enroll audit actor** — manual enrol recorded the enrolled student as actor. **Fixed:** `upsertEnrollment(+actorUserId?)`; `adminEnrollAction` passes the admin id. Test asserts the audit actor is the admin.
- **LMS F-03 (MEDIUM) completion audit target** — `targetType='enrollment'` but `targetId=courseId`. **Fixed:** in-txn SELECT of the enrollment row → `targetId = enrollment.id`. Test asserts it.
- **LMS F-04 (HIGH) course `teacherProfileId`** — never populated. **Fixed:** `createCourse(+teacherProfileId?)`; `createCourseAction` looks up the profile and passes it (falls back to `ownerTeacherId`). Test asserts the column is set.
- **Billing F4/F5 (HIGH) webhook route absent + idempotency-store doc drift** — **Fixed:** real route built (below); `billing-webhooks.md`/`PAYMENT_WEBHOOK_STATE_MACHINE.md` updated to the as-built `audit_logs` ledger; `webhook_idempotency_keys` marked TARGET-only.
- **TV F-08 (HIGH) grant not on the 0002 grant repos** — **Fixed (partial):** admin grant now calls `createTvGrant` (grant table + profile pointer) alongside `grantTv`, with reason + duration + state-guard + entitlement re-check. See Risks for the documented two-step-atomicity + revoke-reason follow-ups.
- **TV F-06/F-09 + Axioma F-6 doc drift** — **Fixed:** `tradingview-access.md` marks `tradingview_profiles`/`tradingview_access_grants` + revoke columns CURRENT; `INTEGRATION_MAP.md` release-cache TTL 6h→10min.
- **Terminal F-1/F-3 (HIGH)** — page never read the DB; `LicenseStatus` lacked grace/revoked. **Fixed:** `features/terminal/loader.ts` reads `getCurrentTerminalRelease`; `LicenseStatus` extended (backward-compatible); hard-boundary callout + disabled dev placeholders.
- **Admin F-12/F-13 (HIGH)** — **Fixed:** every admin action does `requireUser → assertAdmin → assertCsrf → Zod`; `AdminUserView` strips `passwordHash`.

## Decisions

1. **Serial implementation on the real tree** (not a git repo → no worktree isolation). Read-only auditors ran in parallel; implementers ran one-at-a-time with single-writer file ownership (`repositories.ts` = db-architect only). Two implementation workflows with an operator review at the billing-webhook (money/secrets) boundary.
2. **Webhook idempotency = `audit_logs` ledger** (Phase-2.1 as-built), not the contract's `webhook_idempotency_keys` table. Documented; table remains a TARGET.
3. **No migration 0003.** The raw-OTC `axioma_account_links` concern is deferred *with* the (out-of-scope) OTC account-link flow; the terminal page shows `not_linked` honestly.
4. **TV/terminal/bot held at the safe boundary:** TV manual-first (no automation/task-runner claim); terminal Download + Open-Journal stay disabled dev-placeholders (no proxy/ES256 prod signer exists); bot live control stays disabled and the legacy adapter stays blocked (Zod schema files absent → no new mappings).
5. **`frontend-implementer` and `tests-runner` split into two runs each** on disjoint scopes for quality; each wrote its own cited handoff.

## Risks

- **TV grant two-step atomicity (P1):** `grantTv` then `createTvGrant` are separate transactions; a failure between them leaves the request `granted` with no grant-table row. **Follow-up:** a combined atomic repo (db-architect).
- **TV revoke reason not persisted (P2):** `revokeTv` has no `reason` param, so the validated revoke reason is discarded (revoke is still audited). **Follow-up:** add optional `reason` to `revokeTv`; wire `revokeTvGrant` (needs grantId-by-requestId lookup).
- **Webhook missing-`userId` (P2):** events without resolvable `userId` are acknowledged (200, no grant — fail-closed) but no `manual_review` alert is raised. **Follow-up:** write a `manual_review` audit/notification (the manual-review flow is staged).
- **Coverage statements % dipped to 24.33%** as new UI/route code grew the denominator (route handlers/pages are e2e-covered, excluded from Vitest); **branch rose to 71.06%** (first time >70%). Not an enforced gate.
- **Admin `/admin/users` N+1** on `createdAt` — acceptable at MVP scale; `listUsersWithCreatedAt` is a future db-architect repo.
- All surfaces render their **honest labelled demo state** in this environment (no `DATABASE_URL`); the DB path is PGlite-integration-tested and fails closed in production.

## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)

_Final sequential run on the final tree (ecosystem-tests-runner). All runnable gates GREEN:_

| # | Gate | Result |
|---|---|---|
| 1 | `npm run governance:check` | **PASS** — re-run by operator after this aggregate: current phase 20260530-1145; **14 cited** per-agent handoffs all present; 0 errors, 1 allowlisted historical warning |
| 2 | `npm run check:core` | **PASS** (7 zero-install smokes) |
| 3 | `npm run lint` | **PASS** (`--max-warnings 0`; 2 errors fixed) |
| 4 | `npm run typecheck` (packages) | **PASS** |
| 5 | `npm run typecheck -w @wtc/web` | **PASS** |
| 6 | `npm run secret:scan` | **PASS** (clean; `whsec_`/`sk_test_` placeholders not flagged) |
| 7 | `npm test` (Vitest) | **PASS — 171 passed / 5 skipped (176)** across 23 files (+17 over the 154/5 Phase-2.2 baseline: billing-webhook 4, lms-fixes 5, phase23-visible-progress 8) |
| 8 | `npm run coverage` | **PASS — 24.33% stmts / 71.06% branch** |
| 9 | `npm run db:generate -w @wtc/db` | **PASS — 38 tables; "No schema changes"** (no migration this phase) |
| 10 | `npm run build -w @wtc/web` | **PASS — 44 routes** incl. `/api/billing/webhook`, `/admin/support` |
| 11 | `npm run e2e` (Playwright, `CI=1`) | **PASS 28/28** (14 desktop + 14 mobile; +5 Phase-2.3 specs ×2) |
| — | `db:migrate` / `db:seed` / real-PG | **NOT RUN** — no `DATABASE_URL`/`REAL_POSTGRES_DATABASE_URL`; Docker absent. |
| — | `npm ci` | **NOT RE-RUN** — `node_modules` present; not a git repo. |

Not touched (safety policy): SSH/live servers, live bot control, real adapters/billing live calls, Axioma production handoff/download, TradingView automation, plaintext exchange keys.

## Background agents — closed

All 14 per-agent runs across the three workflows (1 audit fan-out + 2 implementation waves) **completed**. **No agents remain running.**

## Production blockers (NOT production-ready)

1. **Real Postgres run** — `db:migrate`/`db:seed`/real-PG NOT RUN (no `DATABASE_URL`/Docker). Provide a `wtc_test` URL to finish.
2. **Stripe not configured** — webhook returns 400 until `STRIPE_WEBHOOK_SECRET`/`STRIPE_SECRET_KEY` (+ price map) are provisioned; no real checkout/charge path exists (by design).
3. **Axioma real bridge** — ES256 production signer + download proxy + OTC link flow are TARGET; terminal actions stay disabled dev-placeholders.
4. **TV grant atomicity + revoke-reason** follow-ups (Risks); TradingView automation remains intentionally absent (ToS).
5. **Bot real adapters** — legacy stays blocked (plaintext-key/service-account); no Zod schema files → no read-only mappings; live control disabled.
6. Auth rate-limiting middleware; CI activation (needs git + remote).

## Next actions (each its own NEW session)

- **Phase 2.4 — TV grant atomicity + revoke reason** (combined atomic grant repo; `revokeTv(+reason?)`; wire `revokeTvGrant`); webhook `manual_review` alerting; admin flag/approve/reject review actions; `listUsersWithCreatedAt`.
- **Phase 2.5 — Terminal real bridge** — ES256 prod signer + JWKS consume + download proxy + OTC account-link (needs the raw-OTC→hash migration) once `journal_server` shapes are confirmed.
- **Phase 3 — LMS migration 0003** (rich columns) + real-Postgres harness run.
