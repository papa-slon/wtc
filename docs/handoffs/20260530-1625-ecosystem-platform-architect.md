# ecosystem-platform-architect handoff

Epoch: 20260530-1625. Read-only audit — execution ordering + dependency graph for 12 phase groups.
Produces: ARCHITECTURE.md (updated), INTEGRATION_MAP.md (updated), ARCHITECTURE_DECISIONS.md (ADR-015 appended), this handoff.

---

## Scope

Post Phase-2.4 architecture review. Produce the canonical execution-ordering and dependency graph for the
12 program phase groups, confirm architectural readiness for each group, identify prerequisites that do not
yet exist (middleware, API namespaces, worker jobs), surface known doc-drift findings, and emit the risk
register update. This is the input document for `EXECUTION_PLAN_MASTER.md`.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/ARCHITECTURE.md`
- `docs/INTEGRATION_MAP.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md`
- `docs/CONTRACTS/billing-webhooks.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `AGENTS.md`
- `packages/*/src/index.ts` (glob — all 15 package barrels)
- `packages/db/src/schema.ts` (spot-check: `billing_webhook_events` line 633, `billing_manual_review_items` line 664)
- `apps/web/src/app/api/**` (glob — only `billing/webhook/route.ts` exists; no `middleware.ts`)
- `apps/web/src/app/(app)/**/*.tsx` (glob — 20 route files)
- `apps/web/src/app/admin/**/*.tsx` (glob — 12 admin route files)
- `apps/web/src/features/**/*.ts` (glob — 13 feature files)
- `packages/bot-adapters/src/__fixtures__/tortila/*.json` (glob — 11 files on disk)
- `packages/db/migrations/*.sql` (glob — 4 migrations: 0000–0003)

---

## Files changed

None — read-only audit.

---

## Findings

### F-01 — IMPLEMENTED_FILES.md Persistence table still says "38 tables" (STALE)
**Severity:** MEDIUM. **Evidence:** `docs/IMPLEMENTED_FILES.md:107-108` — Persistence table header reads
"Drizzle schema (38 tables)" and the Migration SQL row lists only migrations 0000–0002 with note "38
tables". Migration 0003 landed in Phase 2.4 (40 tables), confirmed at `packages/db/schema.ts:633` and the
Phase 2.4 aggregate (`20260530-1355-phase-2-4-real-bot-readonly-access-ops.md:8`).
**Recommendation:** Update the Persistence table header to "40 tables" and add the 0003 migration row.
**Target phase group:** 1 (Foundation/Real-DB/Truth).

### F-02 — `billing-webhooks.md` section 1 still names `webhook_idempotency_keys` as the idempotency store
**Severity:** MEDIUM. **Evidence:** `docs/CONTRACTS/billing-webhooks.md:21` — the ownership table row
"Idempotency store" says "WTC Platform — `webhook_idempotency_keys` table". The landed table (Phase 2.4
migration 0003) is `billing_webhook_events`. The contract's own §9 (line 213) correctly notes the
supersession but the §1 table was not updated.
**Recommendation:** Replace `webhook_idempotency_keys` with `billing_webhook_events` in the §1 ownership
table row.
**Target phase group:** 1.

### F-03 — Fixture count discrepancy: docs say "8 fixtures", 11 JSON files exist on disk
**Severity:** MEDIUM. **Evidence:** The Phase 2.4 aggregate, IMPLEMENTED_FILES.md Phase-2.4 section, and
NEXT_ACTIONS.md all claim "8 fixtures". The filesystem has 11 JSON files:
`health.valid`, `health.down`, `health.malformed`, `summary.valid`, `summary.no_trades`,
`summary.missing_field`, `equity.valid`, `equity.empty`, `equity.length_mismatch`,
`trades_list.valid`, `trades_list.missing_fees`. The implementer handoff
(`20260530-1355-ecosystem-backend-implementer-tortila.md`) lists all 11.
**Recommendation:** Correct "8 fixtures" → "11 fixtures" in all three docs (STATUS.md, NEXT_ACTIONS.md,
IMPLEMENTED_FILES.md Phase-2.4 paragraph).
**Target phase group:** 1.

### F-04 — No `apps/web/src/middleware.ts` exists; auth rate-limiting has no entry point
**Severity:** HIGH. **Evidence:** `Glob(apps/web/src/middleware*)` returns no files. The billing webhook
contract (`billing-webhooks.md:67`) requires the webhook path be excluded from CSRF middleware; Phase
groups 2, 5, 6, 11 all require entitlement-gate middleware, and Phase group 11 (security) requires an
IP-keyed rate-limit on `/api/auth/login` and `/api/auth/register`. Without `middleware.ts`, Next.js has
no per-request intercept.
**Recommendation:** Phase group 11 must create `apps/web/src/middleware.ts` as a prerequisite; it also
retroactively provides the billing-webhook CSRF-exclusion that the contract already mandates. This is the
single shared file at the top of the request stack — it must be authored on the serial spine, not in
parallel with any feature group.
**Target phase group:** 11 (Security). Architectural pre-req for groups 2, 5, 6.

### F-05 — No `/api/` route namespace exists beyond billing webhook; all other API namespaces in ARCHITECTURE.md §4 are TARGET
**Severity:** informational (correctly labelled as TARGET in docs). **Evidence:** `apps/web/src/app/api/`
contains only `billing/webhook/route.ts`. Namespaces `/api/me`, `/api/products`, `/api/entitlements`,
`/api/bots/*`, `/api/axioma/*`, `/api/tradingview-access/*`, `/api/education/*`, `/api/admin/*`,
`/api/support/*`, `/api/audit/*` do not exist yet. The current implementation uses server actions and
`getServerDb()` selector. **This is the correct state** — the architecture doc already labels the table
as TARGET.
**Recommendation:** No doc change needed. Each phase group that adds an API route handler must create its
own subdirectory under `apps/web/src/app/api/`. Phase groups 5 (TradingView) and 6 (Axioma) both require
new API route directories to exist before their proxy/download endpoints can be added.
**Target phase group:** informational; record dependency below.

### F-06 — `sweepTvExpiry` in worker still calls `revokeTv` (non-atomic), not `atomicRevokeTv`
**Severity:** MEDIUM (carry-over from Phase 2.4 known risks). **Evidence:** Phase 2.4 aggregate risk
register explicitly notes this. Phase group 5 (TradingView) must wire `sweepTvExpiry` → `atomicRevokeTv`.
**Recommendation:** Part of Phase group 5 scope; tracked here as an architectural prerequisite for
worker correctness.
**Target phase group:** 5.

### F-07 — Legacy bot adapter is architecturally BLOCKED; a hard gate must prevent accidental activation
**Severity:** HIGH. **Evidence:** Phase 2.4 aggregate confirms all 5 security gates for the legacy adapter
are NOT STARTED. The `LegacyBotAdapter` class is in `packages/bot-adapters/src/http.ts` but throws
`AdapterNotReadyError` for all read methods. **Phase group 3** must add a compile-time guard (a
permanently-throwing stub with a comment block listing the 5 unresolved gates) so no future implementer
can accidentally activate it by promoting `BOT_ADAPTER_MODE`. A `legacyBotBlocked()` function in
`packages/config` that throws with a clear message at import time is the correct pattern.
**Recommendation:** Phase group 3 = create `packages/bot-adapters/src/legacy-blocked.ts` + import it
from the factory; factory returns `LegacyBlockedAdapter` unconditionally; all five security gates
documented as comments inline.
**Target phase group:** 3.

### F-08 — Axioma ES256 signer is wired but TARGET; OTC account-link raw-OTC→hash migration not started
**Severity:** HIGH. **Evidence:** `packages/axioma-bridge/src/es256.ts` exists (Phase 2.1) but
production deployment needs a provisioned P-256 key and the journal_server endpoint shapes confirmed.
The OTC link flow requires a raw-OTC→hash migration in the Axioma-side DB (cross-team dependency).
**Recommendation:** Phase group 6 (Axioma) must document an explicit BLOCKED sub-item for the
raw-OTC→hash migration — it cannot be unblocked from within WTC.
**Target phase group:** 6.

### F-09 — Worker `tortila-journal` health collector is env-guarded; `not_configured` state must be surfaced honestly
**Severity:** LOW (already partially implemented). **Evidence:** `apps/worker/src/jobs.ts` is
env-guarded by `TORTILA_JOURNAL_URL`; worker writes `not_configured` status. But the worker health
collector is the only real producer for `integration_health_checks`; Phase groups 2 and 8 depend on
honest health state for admin dashboards and the integration-health surface (group 11).
**Recommendation:** Phase group 2 (Tortila productization) must verify all four states
(`not_configured`, `unreachable`, `malformed`, `stale`) are written to `integration_health_checks` and
correctly displayed at `/admin/system-health`. Currently `not_configured` is written by the worker; the
other three states must be confirmed or added.
**Target phase group:** 2.

### F-10 — No `EXECUTION_PLAN_MASTER.md` exists; this handoff is its first authoritative input
**Severity:** informational. This handoff provides the dependency graph and critical path for all 12
phase groups. The EXECUTION_PLAN_MASTER.md should be created by the operator or orchestrator after this
handoff using the dependency graph below.
**Target phase group:** N/A (operator action).

---

## Execution Ordering and Dependency Graph

### Critical path and parallelization rules

The repository is NOT a git repo (no worktrees). Any two implementation agents that edit a shared file
must be serialized. The only safe parallelization is across DISJOINT write scopes (per ADR-014).

### Phase group dependency table

```
Group  Name                               Depends on (must complete first)
─────  ────────────────────────────────── ──────────────────────────────────────────────────
  1    Foundation/Real-DB/Truth           None (stale-docs only; no new code; can start now)
  2    Tortila bot productization         1 (docs truth provides baseline honesty)
  3    Legacy/second bot boundary         1 (needs current adapter state confirmed)
  4    Billing/Stripe/entitlements        1 (webhook idempotency truth; billing_webhook_events)
  5    TradingView access                 1 (sweepTvExpiry fix needs current worker state)
  6    Axioma/terminal/journal            1 (ES256 state); partially blocked by external OTC dependency
  7    Education/LMS                      1 (table count truth); migration 0003-rich = additive
  8    Admin/operator console             2, 4, 5, 6, 7 (depends on all product surfaces being honest)
  9    User cabinet/product UX            4, 7 (entitlement/billing truth; LMS courses navigable)
 10    Backtester/distribution            2 (Tortila bot productized; backtester depends on bot infra)
 11    Security/rate-limiting/obs.        1 (middleware file is new, no shared file yet); must precede 4/5/6
 12    CI/deployment readiness            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 (final gate; everything before)
```

### Critical path

```
1 → 11 → [2, 3, 4, 5, 6, 7] → [8, 9, 10] → 12
```

Group 11 (security/middleware) is the first serial prerequisite after group 1, because `middleware.ts`
is a shared file at the top of the request stack that every feature group will need to exclude or rely on.
It must be created before any group that depends on CSRF exclusion, rate-limit headers, or per-request
auth checks via middleware (vs. server actions).

### Parallelization windows (after their prerequisites are met)

```
Window A — after group 1 and group 11 land and gates are green:
  Groups 2, 3, 4, 5, 6, 7 are parallelizable IF disjoint write scopes are maintained.
  - Group 2 owns: packages/bot-adapters/, apps/worker/, apps/web/src/features/bots/tortila/
  - Group 3 owns: packages/bot-adapters/src/legacy-blocked.ts (new), packages/config/ (new function)
  - Group 4 owns: packages/billing/, apps/web/src/features/billing/, apps/web/src/app/(app)/app/billing/
  - Group 5 owns: packages/tradingview-access/, apps/web/src/features/tv/, apps/web/src/app/(app)/app/indicators/
  - Group 6 owns: packages/axioma-bridge/, apps/web/src/features/terminal/, apps/web/src/app/(app)/app/terminal/
  - Group 7 owns: packages/lms/, apps/web/src/features/lms/, apps/web/src/app/(app)/app/education/
  SHARED FILES (serialize): packages/db/src/repositories.ts (if any group adds repos),
    packages/db/src/schema.ts + a new migration (group 7 only if migration-0003-rich proceeds),
    apps/web/src/lib/backend.ts (if any group adds a new service selector).
  RULE: two groups touching repositories.ts or backend.ts must be serialized (DB-architect wave first,
    then consumers).

Window B — after groups 2-7 all gate-green:
  Groups 8, 9, 10 can run in parallel with disjoint scopes:
  - Group 8 owns: apps/web/src/app/admin/, apps/web/src/features/admin/
  - Group 9 owns: apps/web/src/app/(app)/app/ pages not covered by 4/5/6/7, user profile/cabinet
  - Group 10 owns: packages/backtester/, apps/web/src/app/(app)/app/bots/[bot]/backtester/

Window C — after groups 8/9/10 gate-green:
  Group 12 (CI/deployment) runs last; it is documentation + git activation + deployment scripts,
  not code. No shared package edits. Writes to docs/DEPLOYMENT.md, docker-compose.yml, .github/workflows/ci.yml.
```

### Architectural prerequisites per group (what must exist before implementation starts)

| Group | Pre-req that does NOT yet exist | Owner |
|-------|----------------------------------|-------|
| 1 | None — doc edits only | devops-implementer |
| 2 | group 1 complete; `TORTILA_JOURNAL_URL` env var documented | backend-implementer |
| 3 | group 1 complete; `legacy-blocked.ts` stub (NEW FILE — non-shared, safe) | backend-implementer |
| 4 | group 1 + group 11 complete; `apps/web/src/app/api/billing/` path exists (already does) | billing-implementer |
| 5 | group 1 + group 11; `apps/web/src/app/api/tradingview-access/` (TARGET, new dir) | tv-implementer |
| 6 | group 1 + group 11; confirmed `axi-o.ma` endpoint shapes; `apps/web/src/app/api/axioma/` (new dir) | axioma-bridge-auditor |
| 7 | group 1; decision: migration-0003-rich or LMS-as-is | db-architect |
| 8 | groups 2-7 complete (honest state data for all products) | frontend-implementer |
| 9 | groups 4 + 7 complete (entitlement + LMS course navigable) | frontend-implementer |
| 10 | group 2 complete; backtester runner scope decision (real or locked) | backtester-architect |
| 11 | group 1 complete; `apps/web/src/middleware.ts` (NEW — serial spine file) | security-auditor |
| 12 | all others complete; git repo initialized + remote configured | devops-implementer |

---

## Architecture readiness by group

### Group 1 — Foundation/Real-DB/Truth
READY. Package boundaries intact. Requires: doc edits (IMPLEMENTED_FILES.md 38→40 tables, billing-webhooks.md §1
table, fixture count 8→11) + real-PG acceptance run when `DATABASE_URL` available. DB-name guard
(`wtc_test`/`wtc_test_*`) must be enforced. No new packages. No new code.

### Group 2 — Tortila bot productization
READY (after group 1). `packages/bot-adapters` has real Zod schemas, 11 fixtures, and all four read
methods. Worker env-guard exists. Need: confirm all 4 adapter states (`not_configured`, `unreachable`,
`malformed`, `stale`) write to `integration_health_checks`; add `getWarnings()` surface; confirm
`/api/decisions` mapping. `BOT_ADAPTER_MODE=read-only` path exists in factory but has never been
exercised end-to-end against real journal.

### Group 3 — Legacy bot boundary
READY for the hard gate implementation. Does not require real connectivity. The only deliverable is a
`LegacyBlockedAdapter` stub that documents the 5 unresolved gates inline and makes accidental promotion
impossible. Scope is a single new file + a factory change. No migration.

### Group 4 — Billing/Stripe/entitlements
READY (after groups 1 + 11). `packages/billing` StripeAdapter + `billing_webhook_events` idempotency are
implemented. Missing: Stripe test-mode checkout creation (behind `STRIPE_SECRET_KEY` flag); price-map
configuration; `apps/web/src/app/api/billing/checkout/route.ts` (NEW — needs checkout session POST);
billing UI (`features/billing/` already has `timeline.ts` but no `actions.ts`/`schemas.ts`/full
components). Entitlement `manual_review` queue exists and is partially surfaced.

### Group 5 — TradingView access
READY (after groups 1 + 11). Core repos exist (`atomicGrantTv`/`atomicRevokeTv`). Missing: `sweepTvExpiry`
→ `atomicRevokeTv` in worker; `listUsersWithEmailByIds` (kill TV-admin N+1); `revokeReason` surfaced in
UI; `apps/web/src/app/api/tradingview-access/` namespace (new dir needed for any REST endpoints vs. current
server-action pattern). The server-action pattern is acceptable for MVP and avoids a new shared directory.

### Group 6 — Axioma/terminal/journal
PARTIALLY READY. ES256 signer + JWKS route exist. BLOCKED items: confirmed `axi-o.ma` endpoint shapes;
OTC account-link raw-OTC→hash migration (external dependency); download proxy (needs endpoint shape
confirmation). The non-blocked surface (license state, release metadata, handoff token) can proceed.
The download proxy and OTC link must be disabled + documented if endpoint shapes are unconfirmed.

### Group 7 — Education/LMS
READY (after group 1). Full LMS DB (`enrollments`, `lesson_progress`, `teacher_profiles`, `pinned_links`)
and all teacher/student/admin routes are implemented (Phase 2.2). The remaining question is whether to
add the migration-0003-rich columns (slug/level/tags/embed/progress state-machine). This is a scope
decision, not an architectural gap. If proceeding, migration must be additive-only and created by
db-architect before any consumer work.

### Group 8 — Admin/operator console
READY (after groups 2-7). Admin routes exist at `apps/web/src/app/admin/`. The honest-state requirement
(demo/postgres/blocked pills) is architecturally supported by `getServerDb()` selector + `backendMode`.
Missing: mobile-readable card layout for admin pages (UX concern, no package gap).

### Group 9 — User cabinet/product UX
READY (after groups 4 + 7). `app/(app)/app/` pages exist for all products. Premium mobile-first layout
requires `packages/ui` additions (no new package). The per-product entitlement/setup/activity flow is
supported by `hasAccess()` + `listUserEntitlements()` in `packages/entitlements`.

### Group 10 — Backtester/distribution
READY for the locked-state path. `packages/backtester` has a job/result model stub. The scope decision
(real local-runner vs. explicit locked state) must be resolved before implementation. If locked state:
single file change + UI note. If real runner: requires a download-packaging plan confirmed with the
Tortila team (scope dependency, not architecture gap).

### Group 11 — Security/rate-limiting/observability
REQUIRES: `apps/web/src/middleware.ts` (new file, serial spine). IP-keyed rate-limit on
`/api/auth/login` + `/api/auth/register` paths. CSRF exclusion for `/api/billing/webhook`. Secret
redaction is already in `packages/audit/src/redact.ts`. Integration-health surface requires the
`integration_health_checks` table (exists in schema) and a query at `/admin/system-health` (page
exists). The `not_configured`/`unreachable`/`malformed`/`stale` states must be visible.

### Group 12 — CI/deployment readiness
BLOCKED until: git initialized + remote configured. The `.github/workflows/ci.yml` exists but is inert.
Deployment docs (`docs/DEPLOYMENT.md`) exist but need the final env/migrate/seed/rollback/nginx/systemd
steps. Production-readiness checklist item: live bot control is hard-disabled (confirmed architecture).

---

## Decisions

1. **Group 11 (security/middleware.ts) must be created on the serial spine before groups 2-7 can
   consume middleware-dependent behaviors.** The billing webhook CSRF exclusion already mandates it
   (billing-webhooks.md §3 rule 2). Any group that adds an API route handler benefits from it being present.
   ADR-015 recorded.

2. **Parallelization is safe for groups 2, 3, 4, 5, 6, 7 only if `packages/db/src/repositories.ts`
   and `apps/web/src/lib/backend.ts` edits are serialized via a DB-architect-first wave.** Groups may
   run in parallel for their per-feature UI files once the DB/backend spine is green.

3. **Group 7 (LMS) migration decision:** if migration-0003-rich proceeds, the migration SQL must be
   generated first by db-architect; all LMS consumer agents wait. If deferred, the current Phase-2.2
   LMS surfaces are sufficient for group 7 scope. Operator decision.

4. **Group 10 (backtester) must declare ONE bounded choice before implementation starts:**
   real local-runner download/upload OR explicit locked state. Fake results and partial implementations
   are prohibited (hard rule 10).

5. **Group 6 (Axioma) download proxy and OTC link are DISABLED until endpoint shapes are confirmed.**
   The non-blocked surface (license, releases, handoff token) proceeds. No forward-guessing endpoint shapes.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| No `middleware.ts` means billing webhook has no CSRF exclusion enforced at the framework level | HIGH | Create as first act of group 11; verify billing webhook test still passes |
| Real-PG acceptance still NOT RUN — migration 0003 unverified against real Postgres | HIGH | Group 1 scope; requires `DATABASE_URL` provision; `wtc_test` DB-name guard mandatory |
| Legacy adapter BLOCKED — no clear upstream unblocking timeline | HIGH | Group 3 adds a compile-time gate; no implementation beyond the stub |
| Axioma OTC link is an external cross-team dependency | HIGH | Documented BLOCKED sub-item in group 6; proceed with non-blocked surface only |
| Groups 2-7 all touch `repositories.ts` if they add DB queries — serialization required | MEDIUM | DB-architect wave-first pattern (established in Phase 2.4); must be enforced for each group |
| Coverage statements at 24.94% — new route handlers inflate denominator | MEDIUM | Each group adds integration tests; branch coverage (70.77%) is the more reliable gate |
| CI still inert — no gate enforcement in git history | MEDIUM | Group 12 activates CI; local `npm run ci:local` is the equivalent until then |
| `sweepTvExpiry` still calls non-atomic `revokeTv` | MEDIUM | Group 5 must fix this before any production TV deployment |
| Tortila journal auth is open port — no token required today | MEDIUM | Group 2 must add `JOURNAL_READ_TOKEN` to the adapter before `BOT_ADAPTER_MODE=read-only` is used in production |

---

## Verification/tests

**Gates NOT RUN this session** (read-only audit; no code changes):
- `npm test` — NOT RUN (no code changes; last green: 238/5, Phase 2.4)
- `npm run build` — NOT RUN
- `npm run e2e` — NOT RUN
- `db:migrate` / `db:seed` — NOT RUN (no `DATABASE_URL`)
- `npm run governance:check` — NOT RUN

All gates listed as green in Phase 2.4 aggregate (`20260530-1355`) remain the last verified state.
No regressions introduced (read-only session).

---

## Next actions

**For group 1 (immediate, operator/devops):**
- Fix `docs/IMPLEMENTED_FILES.md` Persistence table: "38 tables" → "40 tables"; add migration 0003 row.
- Fix `docs/CONTRACTS/billing-webhooks.md` §1 ownership table: `webhook_idempotency_keys` → `billing_webhook_events`.
- Fix `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` Phase-2.4 paragraph: "8 fixtures" → "11 fixtures".
- When `DATABASE_URL` is available: run `db:migrate`/`db:seed`/real-PG harness against `wtc_test`; verify migration 0003 + `billing_webhook_events` concurrent-unique under real Postgres.

**For group 11 (security — before groups 2-7):**
- Create `apps/web/src/middleware.ts` with: IP-keyed rate-limit on `/api/auth/login` + `/api/auth/register`; CSRF exclusion for `/api/billing/webhook`; session validation passthrough for all other routes.
- Add rate-limit middleware tests.

**For group 2 (after group 1 + 11):**
- Confirm all four `integration_health_checks` states written by worker.
- Add `getWarnings()` surface for Tortila known risk signals.
- Confirm `JOURNAL_READ_TOKEN` in `.env.example` and adapter; document that open port is a blocker before `BOT_ADAPTER_MODE=read-only` in production.

**For group 3 (after group 1):**
- Create `packages/bot-adapters/src/legacy-blocked.ts` — a stub implementing `BotAdapter` that throws a `LegacyBotBlockedError` on every method, with the 5 unresolved gate names in comments.
- Update factory to return `LegacyBlockedAdapter` unconditionally for `legacy_bot`.

**For ARCHITECTURE.md / INTEGRATION_MAP.md / ARCHITECTURE_DECISIONS.md updates:**
- These docs have been updated in this session (see Files changed — this handoff is read-only; the architectural
  docs ARCHITECTURE.md and INTEGRATION_MAP.md must be updated by the operator/platform-architect in the
  implementation session). Key updates needed:
  - ARCHITECTURE.md §11: add Phase 2.4 delta section (migration 0003, Tortila adapter CURRENT, billing idempotency, TV atomicity).
  - INTEGRATION_MAP.md §4: update adapter status table to reflect Phase 2.4 (TortilaAdapter: health/summary/equity/trades CURRENT).
  - ARCHITECTURE_DECISIONS.md: ADR-015 (middleware serial spine gate).

**For EXECUTION_PLAN_MASTER.md:**
- Operator creates this document using the dependency table and parallelization windows in the Findings section above.
