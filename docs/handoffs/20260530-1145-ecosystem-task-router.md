# ecosystem-task-router handoff

_Epoch 20260530-1145. Phase 2.3 — Commercial Access & Operations Buildout. Read-only routing audit; no code edited. The ecosystem-task-router agent has no Write tool — the operator persisted this file._

> **Operator note (persisted by operator):** The actual Phase-2.3 read-only audit wave ran **5** read-only auditors at this epoch: `ecosystem-task-router`, `ecosystem-billing-access-auditor`, `ecosystem-security-auditor`, `ecosystem-axioma-bridge-auditor`, `ecosystem-bot-integration-auditor`. The "10 auditors" enumerated in this routing plan was this agent's idealised fan-out; the remaining roles (db-architect, education-implementer, backend-implementer, tradingview-access-implementer, frontend-implementer, devops-implementer, tests-runner) run as **serial implementers** in the implementation waves, each with its own per-agent handoff at this epoch. The aggregate cites every handoff that actually exists; no inflated "N-agent" claim is made.

## Scope

Classify Phase 2.3 across its 7 Parts. Produce: (1) write-ownership map (one implementer per file/dir, no collision), (2) minimum coherent landable scope per Rule 7, (3) risk gates per Part, (4) confirmation that the read-only audit wave precedes all edits (Rule 1).

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`, `docs/handoffs/20260530-1042-phase-2-2-full-lms-service-wiring.md`, `docs/handoffs/20260530-1042-ecosystem-task-router.md`
- `docs/SESSION_PROTOCOL.md`, `docs/STATUS.md`, `docs/CONTRACTS/tradingview-access.md`, `docs/CONTRACTS/billing-webhooks.md`
- `packages/db/src/repositories.ts`, `packages/db/src/schema.ts`, `packages/billing/src/stripe.ts`, `packages/billing/src/webhook.ts`, `packages/lms/src/lms.test.ts`
- `apps/web/src/lib/{backend.ts,nav.ts,product-status.ts,db-store.ts,csrf.tsx}`, `apps/web/src/features/lms/{actions.ts,queries.ts}`
- `apps/web/src/app/.well-known/axioma-jwks.json/route.ts`, `apps/web/src/app/(app)/app/{billing,terminal}/page.tsx`, `apps/web/src/app/admin/{tradingview-access,entitlements,users,products,system-health}/page.tsx`, `apps/web/src/app/(public)/pricing/page.tsx`

## Files changed

None — read-only audit

## Findings

1. **[HIGH] product-status.ts marks `education` as `'planned'` (Part 0).** `apps/web/src/lib/product-status.ts:18`. Full LMS landed in Phase 2.2. Fix → `status:'demo'` + updated note. Writer: devops.
2. **[HIGH] TEACHER_NAV `soon:true` stale on landed routes (Part 0).** `apps/web/src/lib/nav.ts:35` — `/teacher/courses`, `/teacher/students` are real (Phase 2.2). `/teacher/materials` is still a Placeholder → keeps `soon:true`. Writer: devops.
3. **[HIGH] ADMIN_NAV `/admin/education` carries `soon:true`; `/admin/support` absent (Part 0).** `apps/web/src/lib/nav.ts:28-29`. Writer: devops (after the route exists).
4. **[HIGH] POST /api/billing/webhook route absent (Part 1).** `apps/web/src/app/api/` does not exist. HMAC verify lives in `packages/billing/src/stripe.ts` (`parseWebhook`) + `webhook.ts`; `applyStripeEvent` idempotent repo present. Writer of new route: backend-implementer.
5. **[HIGH] billing-webhooks.md idempotency-store doc drift (Part 0).** Contract §7 references `webhook_idempotency_keys`; as-built uses the `audit_logs` ledger (Phase 2.1). Record the deviation; do not create the table. Writer: devops.
6. **[MEDIUM] tradingview-access.md DTO doc drift (Part 0/2).** Contract claims `revokedAt`/`revokedBy` absent, but `repositories.ts` `TvRequestDTO` + `revokeTv` set them (landed in 0002). `tradingview_profiles`/`tradingview_access_grants` repos also landed — verify against `schema.ts` and mark CURRENT. Writer: devops.
7. **[MEDIUM] Terminal page mock-only; DB terminal repos unused (Part 3).** `apps/web/src/app/(app)/app/terminal/page.tsx`. Wire `getCurrentTerminalRelease`/`recordDownloadEvent`/`recordLicenseEvent` via `getServerDb()`. Writer: backend/frontend (terminal feature).
8. **[MEDIUM] admin/users, admin/products, admin/system-health are Placeholders (Part 4).** Build users (listUsers) + system-health (integrationHealthChecks + backend mode). products stays a Placeholder (catalog is code-defined). Writer: frontend (+ backend query helpers).
9. **[MEDIUM] /pricing implies a checkout flow with no real Stripe path (Part 1).** CTA honesty; billing page should reflect the real webhook. Writer: frontend.
10. **[LOW] 4 LMS correctness items need precise audit (Part 0).** Routed to security-auditor + education-implementer; confirmed real bugs (read-isolation, admin-enroll actor, completion target, course teacherProfileId). Correctness only, no migration.

## Decisions

### D1. Write-ownership map (serial, no collision)

| File / Directory | Owner | Part |
|---|---|---|
| `apps/web/src/app/api/billing/webhook/route.ts` (NEW) | backend-implementer | 1 |
| `apps/web/src/features/billing/` (NEW) | backend-implementer | 1 |
| `apps/web/src/app/(app)/app/billing/page.tsx`, `apps/web/src/app/(public)/pricing/page.tsx` | frontend-implementer | 1 |
| `apps/web/src/app/(app)/app/terminal/page.tsx`, `apps/web/src/features/terminal/` (NEW) | frontend-implementer | 3 |
| `apps/web/src/app/admin/tradingview-access/page.tsx`, `apps/web/src/features/tv/` (NEW), `apps/web/src/app/(app)/app/indicators/page.tsx` | tradingview-access-implementer | 2 |
| `apps/web/src/app/admin/{users,system-health,support}/page.tsx`, `apps/web/src/features/admin/` (NEW) | frontend-implementer | 4 |
| `apps/web/src/app/admin/entitlements/page.tsx` | frontend-implementer | 4 |
| `apps/web/src/app/(app)/app/bots/**` (read-only polish) | frontend-implementer | 5 |
| `apps/web/src/features/lms/{actions.ts,queries.ts}` | education-implementer | 0 |
| `packages/db/src/repositories.ts` | **db-architect (sole writer)** | 0/1/4 |
| `packages/db/src/schema.ts` | **READ ONLY — no migration 0003** | — |
| `apps/web/src/lib/nav.ts`, `apps/web/src/lib/product-status.ts`, `docs/CONTRACTS/*`, `docs/INTEGRATION_MAP.md`, `.env.example` | devops-implementer | 0 |
| `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, the aggregate | **operator** | 0/all |
| `tests/integration/**`, `tests/e2e/**` | tests-runner | 6 |

**Single-writer shared files:** `repositories.ts` → db-architect only; `backend.ts` → backend-implementer only (if touched); `nav.ts`/`product-status.ts` → devops only. New `features/*` dirs follow the Phase-2.1 pattern (import `@wtc/db` repos + `getServerDb()` directly; no `backend.ts` edit needed).

### D2. Minimum coherent landable scope (Rule 7)

- **MUST fully land + gate-verify:** Part 0 (4 LMS correctness fixes + docs truth) and Part 1 (webhook route + product-access timeline + billing/pricing UI honesty).
- **Visible progress (real, not placeholder):** Part 2 (TV grant/revoke wired to the 0002 grant repos + reason/duration/state-guard + enriched admin queue), Part 3 (DB-backed terminal release/license/download display + LicenseStatus fix + honest dev placeholders), Part 4 (admin users + system-health + support triage + entitlements reason/validUntil/timeline).
- **Lower priority / additive:** Part 5 (bot read-only UX polish — control stays disabled, legacy stays blocked, no new adapter mappings).

### D3. Implementation order (strict serial, one implementer at a time)

1. Read-only audit wave (parallel; 5 auditors) — no edits until closed.
2. db-architect — `repositories.ts` correctness + optional params (no schema change).
3. education-implementer — `features/lms` correctness fixes.
4. backend-implementer — webhook route + `features/billing` timeline.
5. tradingview-access-implementer — TV user/admin surfaces on the 0002 grant repos.
6. frontend-implementer — terminal + admin console + billing/pricing UI + bot polish.
7. devops-implementer — docs/nav/product-status truth.
8. tests-runner — tests + gates.

### D4. No migration 0003

The 38-table schema (migration 0002) fully supports Parts 0–5. `webhook_idempotency_keys` was deliberately replaced by the `audit_logs` ledger in Phase 2.1 — do not create it. The `axioma_account_links` raw-OTC concern (axioma-auditor F-2) is deferred with the OTC link flow (out of Phase-2.3 scope).

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| CSRF/body middleware consumes the webhook raw body | P0 | No `middleware.ts` exists; App Router handlers don't run CSRF by default; read body via `req.text()`; keep route CSRF-exempt. |
| TV double-grant of an already-granted request | P1 | Add a state guard (only `pending`/`expiring_soon` → granted). |
| Terminal `DEV_ONLY_SIGNING` reaches prod | P1 | `requiredSecret()` already throws in prod; keep dev-placeholder labels until the real bridge is wired. |
| Product-access timeline leaks `actorId` to the user | P2 | User view excludes `actorId`/`actorType`; admin view may include actor. |
| `/admin/users` leaks `passwordHash`/email | P0 | Define an `AdminUserView` DTO stripping `passwordHash`; scope email to admin. |
| `education` status change exposes LMS to anon | P1 | product-status is display metadata only; access gating remains fail-closed in `accessFor()`. |

## Verification/tests

- Before any edit: all read-only auditors closed with per-agent handoffs at epoch 20260530-1145. ✓
- Part 1: PGlite billing tests (verify-first; reject missing/tampered; idempotent duplicate; product_access_events in-txn); `secret:scan` clean of `STRIPE_WEBHOOK_SECRET`; `build -w @wtc/web` compiles the new route.
- Final gate sequence: `governance:check` → `check:core` → `lint` → `typecheck` → `typecheck -w @wtc/web` → `secret:scan` → `test` → `coverage` → `db:generate` (expect "No schema changes", 38 tables) → `build -w @wtc/web` → `e2e`. NOT RUN: `db:migrate`/`db:seed`/real-PG (no `DATABASE_URL`/Docker).

## Next actions

1. Launch the serial implementation waves per D3, each writing a handoff at `docs/handoffs/20260530-1145-<slug>.md`.
2. Operator writes the aggregate `20260530-1145-phase-2-3-commercial-access-ops.md` citing every per-agent handoff, with the gates table.
3. Hard rules in force: webhook signature-verified + idempotent; entitlements the only access source (fail-closed); TV manual-first (no automation); live bot control disabled; mock/dev visibly labelled; no plaintext secrets anywhere.
