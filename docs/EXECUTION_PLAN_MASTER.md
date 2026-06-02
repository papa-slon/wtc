# EXECUTION_PLAN_MASTER — WTC Ecosystem Platform

_Ordered workstreams, dependency graph, parallelization plan, file-ownership map, and the per-phase
review/fix/test loop. Created 2026-05-30, epoch `20260530-1625`, from the planning fan-out
([task-router](handoffs/20260530-1625-ecosystem-task-router.md),
[platform-architect](handoffs/20260530-1625-ecosystem-platform-architect.md)). Process governance:
[`SESSION_PROTOCOL.md`](SESSION_PROTOCOL.md)._

## 0. Operating constraints that shape the plan
- **Not a git repo → no worktrees.** Parallel *implementation* with overlapping write scopes is unsafe
  (no isolation). Parallel **read-only audits** are safe. So: fan out auditors in parallel; implement
  shared files **serially** (single-writer).
- **Each phase group = its own epoch + aggregate handoff** citing every per-agent handoff
  (`governance:check` enforces this). Multiple phase groups may run in one session; the **newest**
  aggregate is the one strictly validated.
- **DB foundation first within any window.** Any group needing a schema change goes through one
  `ecosystem-db-architect` migration wave **before** its consumers (the Phase-2.4 pattern).

## 1. Single-writer "spine" files (serialize all edits; never two concurrent writers)
| File / area | Owner role |
|---|---|
| `packages/db/src/schema.ts`, `packages/db/src/repositories.ts`, `packages/db/migrations/*` | `ecosystem-db-architect` only, one migration wave at a time |
| `packages/audit/src/{audit,redact}.ts` | security/db, serialized |
| `apps/web/src/lib/{backend,db-store,demo,nav,product-status}.ts` | one writer per phase |
| `apps/web/src/middleware.ts` (**greenfield**) | `ecosystem-security-auditor`/PG11 only |
| `apps/worker/src/{index,jobs}.ts` | one writer per phase |
| `packages/auth/src/rbac.ts`, `packages/config/src/env.ts` | serialized |
| root gate configs (`package.json`, `scripts/check-governance.mjs`, `eslint.config.js`, `vitest.config.ts`) | operator |
| `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md` | **operator-only, aggregate step, serialize-last** |

Disjoint feature scopes are parallel-safe **off** the spine: bot UI (`features/bots`, `app/(app)/app/bots`),
TV (`features/tv`, `app/admin/tradingview-access`), LMS (`features/lms`, `app/teacher`, `app/admin/education`),
admin (`features/admin`, `app/admin`), cabinet (`app/(app)/app` composition), backtester (`packages/backtester`),
legacy gate (`packages/bot-adapters/{mock-legacy,control}`), new API route folders (each is its own directory).

## 2. Critical path & dependency graph
```
PG1 Foundation/Truth ──► PG11 middleware.ts (serial-spine prerequisite for new API routes)
        │                         │
        ▼                         ▼
   [ PG2 Tortila ] [ PG3 Legacy gate ] [ PG4 Billing* ] [ PG5 TV ] [ PG6 Axioma* ] [ PG7 LMS* ]
        └────────────── parallel windows, disjoint scopes; * = DB wave first ──────────────┘
                                  │
                                  ▼
            [ PG8 Admin console ] [ PG9 User cabinet ] [ PG10 Backtester ]
                                  │   (consume PG2/4/5/6/7 real state)
                                  ▼
                         PG12 CI / Deployment readiness  (gated on real-PG + git init)
```
Key edges (full list in the two source handoffs):
- PG12 honest deploy/migrate/seed claims **depend on** PG1 real-PG run (or recorded NOT RUN).
- PG4 checkout, PG6 Axioma routes **depend on** PG11 `middleware.ts` (CSRF exclusion + rate-limit) existing.
- PG4/PG6/PG7 schema changes **depend on** a one-at-a-time `ecosystem-db-architect` wave on `packages/db`.
- PG8 admin **depends on** PG2 bot states + PG4 review queue + PG5 TV + PG6 terminal readiness.
- PG9 cabinet **depends on** entitlements (fail-closed) + PG4/PG7 outputs.
- External-blocked (cannot finish from inside the repo): PG3 real adapter (legacy keys), PG6 CTAs
  (Axioma endpoints + OTC migration), PG12 CI (git init).

## 3. Ordered workstreams (recommended sequencing)
| # | Workstream | Owners (roles) | Risk gate(s) |
|---|---|---|---|
| W1 | **PG1** Foundation/Truth + real-PG readiness | devops-docs + db-architect | db, real-PG, docs-truth |
| W2 | **PG11** `middleware.ts` + redact value-guard + logger (serial spine) | security-auditor | security, build, e2e |
| W3 | **PG2** Tortila read-only states + warnings + token | backend + bot-integration + frontend | bot-runtime, e2e |
| W4 | **PG3** Legacy hard gate + honest UI (+ Zod body exclusion, BLOCKED) | backend (gate only) | bot-runtime, security |
| W5 | **PG4** Billing test-mode checkout flag + billing UI + manual_review polish | billing + backend + frontend | billing, security, db |
| W6 | **PG5** TV atomic sweep + N+1 fix + revokeReason UI + expiry banner | tradingview-access | security, e2e, db |
| W7 | **PG6** Axioma non-blocked surface (ES256 wire, jti store) — CTAs stay disabled | axioma-bridge + backend + db | security, db |
| W8 | **PG7** LMS rich migration (if bounded) + RBAC-throw fix | education + db + frontend | db, ux, e2e |
| W9 | **PG8** Admin console dashboards + mobile cards | frontend | ux, security, e2e |
| W10 | **PG9** User cabinet per-product UX | frontend + ux-designer | ux, e2e |
| W11 | **PG10** Backtester (one bounded choice) | backtester-architect | build, no-fake-results |
| W12 | **PG12** CI/deploy docs + production-readiness checklist | devops | real-PG, governance/CI |

## 4. Per-phase lifecycle (every phase group repeats this)
1. **Audit fan-out** (read-only, parallel) — auditors write per-agent handoffs at the phase epoch.
2. **DB wave** (if a migration is needed) — `ecosystem-db-architect` only, single-writer on `packages/db`.
3. **Serial implementation** — disjoint scopes may use one agent each; shared files single-writer.
4. **Focused tests** — `ecosystem-tests-runner` on the touched area.
5. **Review** — code/security/domain reviewer audits.
6. **Fix loop** — reviewer findings → implementer/operator fix → focused tests rerun → reviewer recheck.
7. **Full gates** — when the batch is ready (governance/check:core/lint/typecheck×2/secret:scan/test/coverage/db:generate/build/e2e; real-PG when creds exist).
8. **Truth docs** — operator updates STATUS/NEXT_ACTIONS/IMPLEMENTED_FILES (serialize-last).
9. **Aggregate handoff** — cite every per-agent handoff; run `governance:check`.
10. **Continue immediately** to the next group, unless a hard blocker (creds/live-approval/decision/destructive) or a Rule-7 stop (context/scope/quality) requires handing a new-session prompt.

## 5. Parallelization rules (concrete)
- ✅ Parallel: read-only auditors; disjoint feature dirs in **separate** sessions/phases.
- ⚠️ Serial: anything touching a spine file; any two migrations; the three truth docs.
- ❌ Never: two implementers editing `schema.ts`/`repositories.ts`/`middleware.ts`/`backend.ts` concurrently in this non-git repo.

## 6. Definition of "phase complete"
All focused + full gates green (or honestly NOT RUN with reason), reviewer findings resolved, truth docs
updated, aggregate handoff written, `governance:check` PASS. No false "production-ready" claim.
