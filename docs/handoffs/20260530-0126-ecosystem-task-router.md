# ecosystem-task-router handoff

Epoch: 20260530-0126. Phase 2 — Wave-2 routing. READ-ONLY session (no code, no shared files edited).

> Operator note: the `ecosystem-task-router` agent type is read-only (Tools: Read/Grep/Glob — no Write
> by design), so it authored this content and the operator persisted the file on its behalf. The
> routing below is the agent's deliverable verbatim.

---

## Scope

Classify the Phase-2 build into domains, produce the ordered agent chain, define risk gates, flag hard
rules, produce the write-ownership map and recommended Wave-2 sequencing. This agent never edits code
or documentation. All routing decisions encoded here are advisory to the operator-serial-implement
chain.

---

## Files inspected

- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/handoffs/20260530-0126-ecosystem-platform-architect.md`

---

## Files changed

None — read-only audit.

---

## Findings

### F-01 — Phase-2 scope is 12 Parts across 9 domains

| Part | Name | Domain(s) |
|---|---|---|
| 0 | Truth cleanup | architecture |
| 1 | Product site / cabinet | product, frontend |
| 2 | Tortila surface | bot-integration, frontend |
| 3 | Legacy surface | bot-integration, frontend |
| 4 | Unified analytics | bot-integration, backend |
| 5 | Bot-config persistence | db/data, backend |
| 6 | Terminal / Axioma | axioma-bridge, frontend, backend |
| 7 | TradingView | tradingview-access, db/data, frontend |
| 8 | Full LMS | education, db/data, frontend, backend |
| 9 | Billing / entitlements | billing/entitlements, db/data, backend |
| 10 | Security / RBAC | security, backend |
| 11 | Real-PG / CI | db/data, deploy |
| 12 | Tests / e2e | QA |

### F-02 — Risk zones are clearly stratified

**P0 (highest risk — serialization and correctness required):**
- Shared-file persistence layer: `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`,
  `apps/web/src/lib/backend.ts`, `apps/web/src/lib/db-store.ts`, `apps/web/src/lib/demo.ts`,
  `packages/audit/src/audit.ts`.
- Entitlement and secret correctness: any change to entitlement gating or KEK wiring.
- Analytics GAP-F drawdown bug in `packages/analytics/src/metrics.ts` (must be fixed before bot
  dashboard surfaces the metric to users).

**P1 (significant, scheduled):** bot dashboards (Parts 2/3/4/5); full LMS (Part 8, migration-dependent);
billing repos + Stripe adapter (Part 9); TradingView table additions (Part 7); Axioma terminal + ES256 (Part 6).

**P2 (lower risk, deferrable):** product-copy polish (Part 1); backtester (deferred/RESERVED);
notifications / support.

### F-03 — Full 12-part build cannot be completed and gate-verified at quality in one session

Rule 7 applies. The bounded slice for this session is: unified analytics (Part 4) + read-only bot
dashboards (Parts 2/3) using existing packages and mock adapters, with NO migration. Migration-0002-
dependent parts (5/7/8/9) are staged for subsequent sessions.

### F-04 — Serial spine confirmed; parallel groups have no shared-file overlap

Platform-architect (20260530-0126) confirmed five disjoint parallel groups (P-A through P-E) across
`features/lms/`, `features/billing/`, `features/bots/`, `features/axioma/`, `features/admin/`.

---

## Decisions

1. **Bounded Wave-2 slice for this session:** unified analytics + read-only bot dashboards with mock
   adapters and no migration. All migration-dependent parts follow in subsequent sessions.
2. **Serial spine then parallel groups** (platform-architect ADR-014 + Phase 1.7 pattern).
3. **Domain classification drives agent assignment** (see write-ownership map).
4. **All hard rules from `0000-orchestrator-seed.md` remain unchanged** for Wave-2.

---

## Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R-01 | Analytics GAP-F drawdown bug surfaces to users before fix | P0 | Fix in analytics package before bot dashboard pages render the metric; green test required |
| R-02 | Shared-file collision on spine steps | P0 | Serial spine; no parallel group touches schema/repositories/backend/db-store/demo/audit |
| R-03 | Migration `0002` is multi-session; partial state breaks builds | P0 | Defer S-1+ to a dedicated session; bounded slice avoids migration entirely |
| R-04 | Entitlement gate regression | P0 | `hasAccess` fail-closed verified by security auditor before any new entitlement surface ships |
| R-05 | Exchange keys / Stripe secrets leak | P0 | Encrypted-only vault; webhook signature verified first |
| R-06 | Axioma HS256 path reachable in production | P1 | HS256 prod-throw test stays green; ES256 path deferred |
| R-07 | TV revoke-task executor gap persists | P1 | Carry-over; tasks remain informational/unconsumed; no Wave-2 change |
| R-08 | One-file prototype temptation | P1 | features/ layout canonical; logic in packages |
| R-09 | Backtester scope bleed | P2 | Backtester deferred; no Wave-2 backtester logic |

---

## Verification / tests

No code changed. Required gate sequence before/after Wave-2 implementation:
`governance:check` → `check:core` → `lint` → `typecheck` (+ `-w @wtc/web`) → `secret:scan` → `npm test`
→ `coverage` → `build -w @wtc/web` → `e2e`.

---

## Next actions

1. Operator confirms bounded-slice decision (analytics + bot dashboards, no migration this session).
2. Analytics GAP-F fix lands first (prerequisite for the dashboard metric).
3. Bot dashboard sub-tabs use existing mock adapters; no migration required.
4. Migration-dependent parts (5/7/8/9) → subsequent sessions per the spine in the platform-architect handoff.
5. Final gate run + aggregate handoff citing all per-agent handoffs.

---

## Write-ownership map

| Part | Owner agent | Primary files | Gate required |
|---|---|---|---|
| 0 — truth cleanup | architecture (single-writer) | `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, truth docs | governance:check |
| 1 — product site/cabinet | frontend | public product pages, `features/admin/` | lint + typecheck + e2e |
| 2 — Tortila surface | frontend (bot pages) | `apps/web/.../app/bots/[bot]/**` | bot-integration audit + typecheck |
| 3 — Legacy surface | frontend (bot pages) | `apps/web/.../app/bots/[bot]/**` | bot-integration audit + typecheck |
| 4 — unified analytics | backend + bot-integration | `packages/analytics/src/metrics.ts` (GAP-F + combine), bot `queries.ts` | bot-integration audit + npm test |
| 5 — bot-config persistence | db-architect (SERIAL) | `packages/db/src/{schema,repositories}.ts` | spine gate |
| 6 — terminal/Axioma | axioma-bridge + frontend | `packages/axioma-bridge/src/`, terminal pages | security + axioma audit |
| 7 — TradingView | tv + db/data | `packages/db/src/schema.ts` (TV), TV pages | tv audit + spine gate |
| 8 — full LMS | education + db/data + frontend | `packages/lms/src/`, repos (LMS), teacher/education pages | education audit + spine gate |
| 9 — billing/entitlements | billing + db/data | `packages/billing/src/`, repos (billing), billing pages | billing + security audit |
| 10 — security/RBAC | security | `packages/auth/src/`, `packages/audit/src/audit.ts` | security audit mandatory |
| 11 — real-PG/CI | devops + db/data | `tests/integration/db-real-postgres.test.ts`, `.github/workflows/` | deploy gate |
| 12 — tests/e2e | QA | `tests/**` | npm test + e2e green |

**Shared files requiring single-writer serialization (spine, in order):**
1. `packages/db/src/schema.ts` (S-1) → 2. migration SQL (S-1) → 3. `packages/db/src/repositories.ts`
(S-2 then S-3) → 4. `apps/web/src/lib/lms-types.ts` (S-7) → 5–7. `apps/web/src/lib/{backend,db-store,demo}.ts`
(S-6, atomic) → 8. `packages/audit/src/audit.ts` → 9. `apps/web/src/lib/nav.ts` → 10. access.ts → 11. product-status.ts.

---

## Recommended Wave-2 sequencing

### This session (bounded slice — no migration)
- **Step 1 — Analytics GAP-F fix + additive metrics** in `packages/analytics/src/metrics.ts`; verify with `npm test`.
- **Step 2 — Read-only bot dashboard sub-tabs (Parts 2/3/4)** using existing `@wtc/bot-adapters` mocks + `@wtc/analytics`; combined view via `combineMetrics`. No migration.
- **Step 3 — Final gate run** + aggregate handoff citing all per-agent handoffs.

### Subsequent sessions (migration-dependent)
- **Session N+1:** S-1 (schema `0002`) → S-2 (LMS repos) → S-3 (billing repos) → gate; then S-4 + S-5 parallel → S-7 → S-6 (atomic) → S-8 → gate.
- **Session N+2:** parallel groups P-A/P-B/P-D/P-E after spine gate green.
- **Session N+3:** integration + full gate run + real-PG verification.

**Rule 7 rationale:** the 18-table migration + full LMS repos + billing adapter + Axioma ES256 + 5 parallel
feature groups cannot all be implemented AND gate-verified at production quality in one session. The
bounded slice delivers a verifiable vertical this session while staging migration-dependent work correctly.
