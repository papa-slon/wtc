# Phase 1.5 — Governance + Persistence Truth + Production Baseline Hardening (aggregate handoff)

_2026-05-29. Operator-authored aggregate per `docs/SESSION_PROTOCOL.md` §4. Driven by a **7-agent
read-only audit** + **2 disjoint implementation agents**, each with its own per-agent handoff file
(linked below — this is a real N-agent run, not a narrative). No live servers/SSH/bots touched; real
adapters stay mock; no real secrets stored; **not** claimed production-ready._

## Scope
Phase 1.5 Parts A–H: strengthen project governance; correct docs/contract drift; harden DB correctness
(transactions, unique constraint, awaited logout); production-baseline security (`__Host-` cookie,
secret-quality, HS256 prod-fence); product-truth UI; add staged CI + real-Postgres path; run all
acceptance gates. Part E (TV/LMS → async DB repos) **deferred to its own session** (operator decision).

## Agents launched (all closed — see Verification)
**Audit fan-out** — Workflow task `w8c5mo7i8` (run `wf_a024bbf8-fbf`), 7 read-only auditors, parallel:
1. `governance-session-protocol-auditor` → [`…-governance-session-protocol-auditor.md`](20260529-1921-governance-session-protocol-auditor.md)
2. `docs-contracts-drift-auditor` → [`…-docs-contracts-drift-auditor.md`](20260529-1921-docs-contracts-drift-auditor.md)
3. `db-postgres-persistence-auditor` → [`…-db-postgres-persistence-auditor.md`](20260529-1921-db-postgres-persistence-auditor.md)
4. `security-auth-secrets-auditor` → [`…-security-auth-secrets-auditor.md`](20260529-1921-security-auth-secrets-auditor.md)
5. `frontend-product-truth-auditor` → [`…-frontend-product-truth-auditor.md`](20260529-1921-frontend-product-truth-auditor.md)
6. `qa-ci-e2e-auditor` → [`…-qa-ci-e2e-auditor.md`](20260529-1921-qa-ci-e2e-auditor.md)
7. `integration-risk-auditor` → [`…-integration-risk-auditor.md`](20260529-1921-integration-risk-auditor.md)

**Implementation** — Workflow task `w68e3s134` (run `wf_c8f072c9-e0b`), 2 disjoint-scope agents, parallel:
8. `docs-drift-fixer` (Part B) → [`…-docs-drift-fixer.md`](20260529-1921-docs-drift-fixer.md)
9. `ci-devops-implementer` (Part C devops) → [`…-ci-devops-implementer.md`](20260529-1921-ci-devops-implementer.md)

Parts A, D, F, G + truth docs + this handoff were authored by the operator (security-critical / judgment-heavy).

## Files changed
**Governance (A):** `docs/SESSION_PROTOCOL.md` (new), `AGENTS.md`, `docs/handoffs/0000-orchestrator-seed.md`,
+ honesty corrections in `docs/STATUS.md`, `docs/handoffs/20260529-phase1-persistence-hardening.md`,
`docs/handoffs/20260529-acceptance-hardening.md`.
**Docs drift (B, by agent):** `docs/CONTRACTS/{tortila-adapter,legacy-bot-adapter,axioma-bridge,billing-webhooks}.md`,
`docs/ARCHITECTURE.md`, `docs/BACKTESTER_DISTRIBUTION_PLAN.md`, `docs/BOT_CONTROL_SAFETY_MODEL.md`,
`README.md`, `docs/DEPLOYMENT.md`.
**CI/devops (C, by agent):** `.github/workflows/ci.yml` (new), `docker-compose.yml` (pg17),
`package.json` (`ci:local`), `tests/e2e/screenshots/.gitkeep` (new).
**DB correctness (C/D):** `packages/db/src/{schema.ts,repositories.ts,seed.ts}`, `packages/db/drizzle.config.ts`,
`packages/db/migrations/0001_early_toad_men.sql` (new + meta), `apps/web/src/lib/{db-store.ts,demo.ts}`,
`apps/web/src/app/(auth)/actions.ts`, `tests/integration/db-persistence.test.ts`.
**Security (F):** `packages/shared/src/{env-guards.ts,index.ts}`, `packages/config/src/{env.ts,env.test.ts}`,
`packages/config/package.json`, `packages/axioma-bridge/src/handoff.ts`, `packages/audit/src/audit.ts`,
`apps/web/src/lib/session.ts`, `apps/web/src/app/(auth)/login/page.tsx`, `packages/auth/src/session.test.ts` (new).
**UI truth (G):** `apps/web/src/components/{PublicTopBar,MobileNav}.tsx`,
`apps/web/src/app/(public)/{products/page.tsx,products/[slug]/page.tsx,legal/[doc]/page.tsx}`,
`apps/web/src/app/(app)/app/bots/[bot]/page.tsx`, `apps/web/src/lib/product-status.ts` (new),
+ in-memory badges on `apps/web/src/app/(app)/app/{indicators,education}/page.tsx` & `admin/tradingview-access/page.tsx`.
**Decisions/truth:** `docs/ARCHITECTURE_DECISIONS.md` (ADR-010 pg17, ADR-011 hardening),
`docs/{STATUS,IMPLEMENTED_FILES,NEXT_ACTIONS}.md`.

## Findings → fixes (47 findings across the 7 auditors)
- **A (governance):** SESSION_PROTOCOL.md created (8 rules); AGENTS.md rules + reconciled handoff format;
  **GOV-02 critical** — the prior "6-agent"/"5-auditor" claims had **zero** backing handoffs → restated honestly.
- **B (drift):** removed all `BOT_ADAPTER_MODE=real`; relabelled the non-existent `/api/**` surface as TARGET;
  corrected the understated axioma-bridge status; README/DEPLOYMENT lead with the in-memory default + Docker-absent
  caveat; softened "tests green in CI" (CI pending).
- **C/D (db):** entitlements **UNIQUE** `(user_id,product_code)` (migration 0001); grant/revoke/createUser/
  addExchangeKey **transactional**; logout `destroySession` **awaited**; drizzle localhost fallback removed;
  `job_queue` documented RESERVED (not a fake queue); seed idempotent.
- **F (security):** `__Host-` cookie wired (prod); placeholder **+ low-entropy** secret rejection + required
  AXIOMA secret in prod; HS256 signer throws in prod; console audit writer prod-fenced; demo creds hidden in
  prod login; raw key material removed from audit input.
- **G (ui truth):** env-aware public status; mock-data banner on bot dashboards; mobile "soon" parity; product
  availability taxonomy; legal DRAFT banner; TV/LMS in-memory badges. (Backend badge already correct — no change.)
- **Deferred (logged, not done):** Part E TV/LMS async (own session); ES256/JWKS; real bot adapters; billing
  webhook; auth rate-limiting (F-AUTH-08); CI activation (needs git).

## Decisions
- Deferred Part E (operator+user decision) to avoid context overrun per `SESSION_PROTOCOL.md` §8; added honest
  badges instead. Standardised Postgres 17 (ADR-010). Removed the repo `audit` param from grant/revoke so the
  audit row is written **inside** the transaction (atomicity over signature-compat); updated the 4 call sites.
  `@wtc/config` now depends on `@wtc/shared` (lock re-synced; `npm ci` reproducible).

## Risks
- `npm ci` was re-synced for the new `config→shared` edge; CI must `npm install` before `npm ci` if the lock drifts.
- The build is now all-dynamic (cookie/session app) — the prior "31 static" claim was inaccurate, not a regression.
- Real Postgres path is unverified against a live server (creds unknown) — see NOT RUN below.
- Making TV/LMS async (Part E) will break 10 sync call sites (see integration-risk handoff) — must be atomic.

## Verification/tests — gates RUN vs NOT RUN (per `SESSION_PROTOCOL.md` §6)
| Gate | Result |
|---|---|
| `npm ci` | **PASS** (368 pkgs, 47s; reproducible; lock re-synced) |
| `npm run ci:local` (composite) | **PASS** end-to-end (check:core + lint + typecheck×2 + secret:scan + test + build) |
| `npm run check:core` | **PASS** (7 smokes) |
| `npm run lint` | **PASS** (exit 0) |
| `npm run typecheck` (packages) + `-w @wtc/web` | **PASS** both |
| `npm test` | **PASS 64/64** (12 files; PGlite integration 7/7 with new txn/unique/atomic-audit assertions) |
| `npm run build -w @wtc/web` | **PASS** (compiled; dynamic app, `/_not-found` static) |
| `npm run secret:scan` | **PASS** (clean) |
| `npm run coverage` | **PASS** — 25.07% stmts / 61.26% branch (↑ from 23.75 / 58.94) |
| `npm run e2e` | **PASS 10/10** (desktop + mobile; chromium pre-installed) |
| `npm run db:generate -w @wtc/db` | **PASS** (migration 0001) |
| `db:migrate` / `db:seed` against **real Postgres** | **NOT RUN** — local PG17 present but credentials unknown to the agent; Docker absent. SQL verified via PGlite. Ready command in `NEXT_ACTIONS.md`. |

## Background agents — closed
Both Workflow runs (`wf_a024bbf8-fbf` audit, `wf_c8f072c9-e0b` impl) ran to completion and returned; no
background agents remain running at the time of this report.

## Next actions
See `docs/NEXT_ACTIONS.md`. In order, each as a NEW session: (1) Part E TV/LMS async DB; (2) real Postgres
run + postgres-js integration test; (3) billing webhook/provider; (4) Axioma ES256/JWKS; (5) real bot adapters;
(6) auth rate-limiting + append-only audit role; (7) activate CI once git + remote exist.
