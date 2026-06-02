# ecosystem-task-router handoff

_2026-05-30 16:25 epoch. READ-ONLY planner pass for the 12-phase-group end-to-end program.
Classifies the program into ordered workstreams with owning lane, exact WRITE scopes (for overlap
detection), SHARED single-writer files (must serialize), risk gate(s), and parallel-vs-sequential
ordering. Feeds `EXECUTION_PLAN_MASTER.md`. No code/doc edits except this handoff._

## Scope

Map the operator's 12-phase-group program (PG1..PG12) into an ordered execution plan. For EACH phase
group: (a) owning lane/agent, (b) exact files/packages it WRITES, (c) which writes hit SHARED
single-writer files that must serialize, (d) the risk gate(s) that apply, (e) what runs in parallel vs
sequential. Establish the cross-cutting serialization spine and the dependency edges between groups.
Current baseline = Phase 2.4 complete (migration 0003 = 40 tables; gates green: test 238/5, e2e 34/34,
build 53 routes, coverage 24.94/70.77, governance PASS). Real-PG / Stripe-checkout / Axioma-ES256 /
legacy-adapter / CI remain NOT RUN / TARGET / BLOCKED / inert.

## Files inspected

- `docs/STATUS.md` (Phase 2.4 + history), `docs/NEXT_ACTIONS.md:14-18` (Phase 2.5/3/Ops queue),
  `docs/IMPLEMENTED_FILES.md` (write-ownership ground truth; Persistence table at :104-113).
- `docs/handoffs/20260530-1355-phase-2-4-real-bot-readonly-access-ops.md` (latest aggregate; 18 agents,
  files-changed map at :46-62, blockers at :118-126).
- `docs/SESSION_PROTOCOL.md` (Rules 1–8; disjoint-write-scope rule §2), `AGENTS.md` (roster + Writes
  column at :9-26; non-negotiable gates at :74-82).
- Repo layout: `packages/*/src/index.ts` (15 packages), `apps/web/src/lib/*.ts` (12 shared libs),
  `apps/web/src/features/**` (bots/support/lms/billing/tv/terminal/admin), `apps/worker/src/*.ts`
  (index/jobs/tick-once), `apps/web/src/app/api/**/route.ts` (only `billing/webhook`),
  `packages/bot-adapters/src/__fixtures__/tortila/*` (11 JSON files on disk).
- Drift verification: `docs/IMPLEMENTED_FILES.md:107-108`, `docs/CONTRACTS/billing-webhooks.md:21`,
  `docs/STATUS.md:9` + `docs/NEXT_ACTIONS.md:5` (fixture count).

## Files changed

None — read-only audit.

## Findings

1. **MEDIUM — `packages/db/src/{schema.ts,repositories.ts}` is the single hardest serialization point;
   3 phase groups want to write migration 0004+.** Evidence: PG4 (billing checkout/subscriptions), PG6
   (Axioma jti-replay store + raw-OTC→hash migration, `docs/...-phase-2-4-...:123`), PG7 (LMS rich
   columns migration 0003-rich, `docs/NEXT_ACTIONS.md:16`) each need schema changes; `repositories.ts`
   is touched by virtually every backend group (`docs/IMPLEMENTED_FILES.md:109`). Recommendation: one
   `ecosystem-db-architect` owns `packages/db` exclusively per phase; consumer groups never edit schema.
   Sequence each migration in its own DB-foundation wave before its consumers (the Phase-2.4 pattern,
   `docs/...-phase-2-4-...:79`). Target: cross-cutting (governs PG4/PG6/PG7).

2. **HIGH — three live truth docs are the universal SHARED single-writer and the top overlap hazard.**
   Evidence: `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` are updated by the
   operator at the end of EVERY phase (`docs/...-phase-2-4-...:62`). Recommendation: only the operator
   (aggregate step) writes these three; per-agent handoffs are append-only new files. Every phase group
   below lists these as serialize-last. Target: cross-cutting (all PGs).

3. **MEDIUM — stale docs drift confirmed on disk; assign to PG1 as its concrete deliverable.**
   Evidence: (i) `docs/IMPLEMENTED_FILES.md:107` "Drizzle schema (38 tables)" and `:108` "3 migrations,
   38 tables" — actual = 40 tables / 3 migrations incl. 0003 (`docs/...-phase-2-4-...:48`); (ii)
   `docs/CONTRACTS/billing-webhooks.md:21` summary-table row still names the dead
   `webhook_idempotency_keys` (landed table is `billing_webhook_events`, correctly described at
   `:209-221` of the same file — so only the :21 row is wrong); (iii) fixture count "8 fixtures" at
   `docs/STATUS.md:9`, `docs/NEXT_ACTIONS.md:5`, and the `IMPLEMENTED_FILES.md` Phase-2.4 section vs **11**
   JSON files in `packages/bot-adapters/src/__fixtures__/tortila/` (health/summary/equity/trades_list ×
   valid+edge variants). Recommendation: PG1 owner (devops-docs) fixes (i)/(ii)/(iii) in the live docs;
   do NOT rewrite the immutable `20260530-1355` aggregate handoff. Target: PG1.

4. **MEDIUM — `apps/web/src/middleware.ts` does not exist; PG11 auth rate-limiting is greenfield, not an
   edit.** Evidence: glob for `apps/web/src/middleware.ts` returns no file; F-AUTH-08 still pending
   (`docs/NEXT_ACTIONS.md:89-90`, `docs/...-phase-2-4-...:125`). Recommendation: PG11 creates the file
   fresh; because Next middleware is process-global it is a de-facto single-writer surface — one owner,
   serialize against any other middleware need. Target: PG11.

5. **HIGH — `apps/web/src/app/api/**` has exactly ONE real route today; PG4/PG6 each add new API routes
   that must not collide and each needs the per-mutation pipeline.** Evidence: only
   `apps/web/src/app/api/billing/webhook/route.ts` exists; Axioma download-proxy/OTC-link/education-
   progress namespaces are "planned" (`docs/IMPLEMENTED_FILES.md:97-102`). Recommendation: each new
   route handler is a disjoint path (distinct folder) → safe to parallelize ACROSS groups, but every
   route still passes the security gate (CSRF/Zod/RBAC/entitlement/audit, `AGENTS.md:89`). Target:
   PG4 (`api/billing/checkout`), PG6 (`api/axioma/*`, `api/terminal/download`).

6. **LOW — `apps/web/src/lib/{backend.ts,db-store.ts,demo.ts,nav.ts}` are shared but append-mostly.**
   Evidence: `backend.ts`/`db-store.ts`/`demo.ts` are the fail-closed selector + adapters every feature
   reads (`docs/IMPLEMENTED_FILES.md:111-112`); `nav.ts` was co-edited by Phase-2.4 frontend
   (`docs/...-phase-2-4-...:56`). Recommendation: treat each as single-writer PER PHASE (the phase
   touching a given surface owns it that session); cross-phase parallel edits to these four are
   prohibited. Target: cross-cutting (PG2/PG7/PG8/PG9 frontend waves).

7. **MEDIUM — `packages/bot-adapters` (PG2) and `packages/axioma-bridge` (PG6) share the worker
   (`apps/worker/src/{index.ts,jobs.ts}`) as a single-writer health-collector surface.** Evidence: the
   Tortila health collector landed in `apps/worker/src/{jobs.ts,index.ts}` (`docs/...-phase-2-4-...:52`);
   any Axioma/integration-health collector (PG6/PG11) edits the same two files. Recommendation: worker
   files are single-writer per phase; if PG2 and PG6 ever run together, serialize the worker edits.
   Target: PG2/PG6/PG11.

8. **LOW — PG3 (legacy/second bot) is a BLOCKED no-op that must ship a hard code gate, not features.**
   Evidence: legacy adapter BLOCKED on upstream plaintext keys, 5 security gates NOT STARTED
   (`docs/...-phase-2-4-...:122`); control always throws (`docs/IMPLEMENTED_FILES.md:128`).
   Recommendation: PG3's only writes are an honest placeholder + a regression test asserting the legacy
   path stays disabled (`packages/bot-adapters/src/{mock-legacy.ts,control.ts}` + a test). No schema, no
   UI features. Runs fully parallel (tiny, isolated). Target: PG3.

9. **LOW — PG10 (backtester) and PG12 (CI/deploy) are near-isolated and parallelizable late.**
   Evidence: `packages/backtester/src/index.ts` is a self-contained job/result model with UI download
   disabled (`docs/IMPLEMENTED_FILES.md:137`); CI is inert pending git (`docs/IMPLEMENTED_FILES.md:169-
   173`). Recommendation: PG10 = one bounded choice (real local-runner download/upload OR explicit
   locked state) confined to `packages/backtester` + its UI page; PG12 = docs + `.github/workflows` +
   deploy scripts, no app-logic writes. Both can run parallel to most groups once their dependencies
   (PG1 real-PG truth for PG12) are met. Target: PG10/PG12.

10. **MEDIUM — real-PG acceptance (PG1) is an upstream dependency for honest PG12 deployment claims and
    for PG4 subscription persistence proof.** Evidence: `db:migrate`/`db:seed`/real-PG = NOT RUN, no
    `DATABASE_URL`/Docker (`docs/...-phase-2-4-...:109`); PG12 deploy docs need a proven migrate/seed/
    rollback path. Recommendation: PG1 must either prove migration 0003 + concurrent
    `billing_webhook_events` unique behavior against a throwaway `wtc_test`/`wtc_test_*` DB (with a
    DB-name guard) OR record NOT RUN honestly; PG12's production-readiness checklist consumes that result.
    Target: PG1 → PG12 dependency.

## Decisions

1. **Eight ordered workstreams (W1..W8) over the 12 phase groups**, mapped to the existing agent roster
   (`AGENTS.md:9-26`). The mapping (also the `roadmapItems` returned):
   - **W1 Foundation/Truth/Real-PG** = PG1 → `ecosystem-devops-implementer` (docs) +
     `ecosystem-db-architect` (real-PG harness/guard) + `ecosystem-deployment-realpg` auditor.
   - **W2 Bot productization** = PG2 → `ecosystem-backend-implementer` + `ecosystem-bot-integration-
     auditor` + `ecosystem-frontend-implementer` (bot UI).
   - **W3 Legacy boundary (BLOCKED gate)** = PG3 → `ecosystem-backend-implementer` (hard gate +
     regression test only).
   - **W4 Billing/entitlements** = PG4 → `ecosystem-billing-access-auditor` +
     `ecosystem-backend-implementer` + `ecosystem-frontend-implementer`; needs `ecosystem-db-architect`
     if subscriptions/checkout need schema.
   - **W5 TradingView access** = PG5 → `ecosystem-tradingview-access-implementer`.
   - **W6 Axioma/terminal/journal** = PG6 → `ecosystem-axioma-bridge-auditor` +
     `ecosystem-backend-implementer` + `ecosystem-db-architect` (jti/OTC migration).
   - **W7 Education/LMS** = PG7 → `ecosystem-education-implementer` + `ecosystem-db-architect`
     (0003-rich migration if bounded+tested) + frontend.
   - **W8 Surfaces & Ops** = PG8 (admin), PG9 (cabinet/UX), PG10 (backtester), PG11 (security/rate-limit/
     observability), PG12 (CI/deploy) → `ecosystem-frontend-implementer` (PG8/PG9),
     `ecosystem-backtester-architect` (PG10), `ecosystem-security-auditor` +
     `ecosystem-frontend-implementer` (PG11), `ecosystem-devops-implementer` (PG12).

2. **Serialization spine (the single-writer files that force ordering across ALL groups):**
   `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `packages/audit/src/audit.ts`,
   `apps/web/src/lib/{backend.ts,db-store.ts,demo.ts,nav.ts}`, `apps/web/src/middleware.ts`,
   `apps/worker/src/{index.ts,jobs.ts}`, `packages/auth/src/rbac.ts`, `packages/config/src/env.ts`, root
   gate configs (`package.json` scripts, `.github/workflows/ci.yml`, `scripts/check-governance.mjs`,
   `eslint`/`tsconfig`), and the three truth docs (`STATUS.md`/`NEXT_ACTIONS.md`/`IMPLEMENTED_FILES.md`).
   Each is owned by exactly one agent per phase; cross-phase parallel edits are prohibited.

3. **Parallel-safe disjoint write scopes** (can run concurrently when in different phases or different
   sub-agents within a phase, because their file sets do not overlap):
   - PG2 bot UI = `apps/web/src/{features/bots/*, app/(app)/app/bots/**}` + `packages/bot-adapters/*`.
   - PG5 TV = `apps/web/src/features/tv/*` + `apps/web/src/app/admin/tradingview-access/**` +
     `packages/tradingview-access/*`.
   - PG7 LMS = `apps/web/src/features/lms/*` + `apps/web/src/app/{teacher,(app)/app/education,admin/
     education}/**` + `packages/lms/*`.
   - PG8 admin = `apps/web/src/features/admin/*` + `apps/web/src/app/admin/**`.
   - PG9 cabinet = `apps/web/src/app/(app)/app/**` page composition (read-only consumers of features).
   - PG10 = `packages/backtester/*` + its single UI page.
   - PG3 = `packages/bot-adapters/src/{mock-legacy.ts,control.ts}` + one test (tiny, isolated).
   These overlap ONLY on the spine in Decision 2, which serializes them.

4. **Recommended global ordering** (honors dependencies; maximizes parallelism within a phase):
   `PG1` (truth + real-PG; unblocks honest PG12) → then the Phase-2.5 cluster `PG5 + PG6` (TV finish +
   Axioma; PG6 carries a DB migration so its db-foundation wave precedes its consumers) → `PG4` (billing
   checkout behind a flag; db-foundation wave if needed) → `PG7` (LMS rich migration + UI) →
   `PG2`/`PG8`/`PG9` (productization + surfaces; mostly UI, parallel-safe off the spine) →
   `PG11` (security/rate-limit; middleware greenfield) → `PG10` (backtester bounded choice) →
   `PG12` (CI/deploy readiness; consumes PG1 real-PG result). `PG3` (legacy gate) can land any time as a
   tiny isolated change. Each phase remains its own session (`SESSION_PROTOCOL.md` §1).

5. **Risk-gate assignment per group** (gate = the audit/proof that must pass before the group is DONE):
   PG1 → db + real-PG; PG2 → bot-runtime + e2e; PG3 → bot-runtime + security (gate-against-activation);
   PG4 → billing + security + db; PG5 → security + e2e (manual-first, no automation); PG6 → security +
   db (jti/OTC) — WTC never gates local order execution; PG7 → db (if migration) + ux + e2e; PG8 → ux +
   security (RBAC) + e2e; PG9 → ux + e2e; PG10 → (bounded) build/e2e + no-fake-results; PG11 → security
   (+ observability) + e2e; PG12 → real-PG (consumed) + db + governance/CI.

## Risks

- **Migration serialization is the critical path.** PG4/PG6/PG7 each may need a migration (0004/0005/…);
  they MUST be sequenced one-at-a-time through `ecosystem-db-architect` on the serial spine, never
  parallel — a parallel schema edit corrupts the single `schema.ts` + the migration meta journal.
- **Real-PG remains NOT RUN until creds/Docker exist** (`docs/...-phase-2-4-...:120`). PG1 may land
  honestly as NOT RUN; PG12's deploy claims must then stay TARGET, not DONE. PGlite is not a substitute.
- **Truth-doc contention**: if two phases edit `STATUS.md`/`NEXT_ACTIONS.md`/`IMPLEMENTED_FILES.md`, the
  later silently clobbers the earlier. Enforce operator-only, aggregate-step writes.
- **Scope creep on PG3/PG10**: both are explicitly bounded (gate-only / one bounded choice). Treating
  them as feature work violates the BLOCKED boundary (PG3) or fabricates results (PG10).
- **Governance gate**: every phase must keep `npm run governance:check` PASS — each per-agent handoff
  cited in the aggregate (`scripts/check-governance.mjs`); an uncited current-epoch handoff fails the gate.

## Verification/tests

Read-only planning pass — no gates run. Baseline carried from the latest aggregate
(`docs/...-phase-2-4-...:96-110`): governance PASS, check:core PASS, lint PASS, typecheck ×2 PASS,
secret:scan PASS, test 238/5/243, coverage 24.94/70.77, db:generate 40 tables, build 53 routes, e2e
34/34. NOT RUN: `db:migrate`/`db:seed`/real-PG (no `DATABASE_URL`/Docker); `npm ci` (node_modules
present). Drift findings (#3) verified directly against disk (file:line cited).

## Next actions

- Operator persists this classification into `EXECUTION_PLAN_MASTER.md` (single-writer = operator) using
  the W1..W8 mapping + serialization spine (Decisions 1–4).
- Start PG1 in its own session: devops-docs fixes the three drift items (Finding #3) and db-architect +
  deployment-realpg auditor prepare/run the real-PG acceptance (DB-name guard `wtc_test`/`wtc_test_*`),
  recording RUN or NOT RUN honestly.
- For every subsequent phase: launch read-only auditors before edits (Rule 1); route all `packages/db`
  + truth-doc writes through the single owner; keep the migration waves serial (Decision 2).
