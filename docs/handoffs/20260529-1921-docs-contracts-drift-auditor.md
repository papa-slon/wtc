# docs-contracts-drift-auditor handoff

_2026-05-29 19:21. STRICTLY READ-ONLY audit. No code or existing doc modified._

## Scope

Audit the entire `docs/` tree + root `README.md` for drift between documented "current
reality" and actual code (Part B). Specifically: (1) any remaining `BOT_ADAPTER_MODE=real`;
(2) any doc presenting `apps/web/src/app/api/**` REST/webhook routes as CURRENT; (3) honesty
of persistence wording (DB-backed core when `DATABASE_URL` set; TradingView + LMS web UI still
in-memory until Phase 1.5); (4) Axioma wording (spec written; mock bridge + HS256 dev signer
implemented; ES256/JWKS NOT implemented); (5) TradingView wording (DB repos/worker exist; web
UI memory-backed); (6) CI wording (no `.github/workflows` → no doc may claim "CI exists").

## Files inspected

Ground truth: `AGENTS.md`; `docs/handoffs/0000-orchestrator-seed.md`; `docs/STATUS.md`;
`docs/handoffs/20260529-phase1-persistence-hardening.md`; `docs/IMPLEMENTED_FILES.md`;
`docs/NEXT_ACTIONS.md`.

Audited docs: `README.md`; `docs/ARCHITECTURE.md`; `docs/INTEGRATION_MAP.md`;
`docs/DEPLOYMENT.md`; `docs/CONTRACTS/tortila-adapter.md`; `docs/CONTRACTS/legacy-bot-adapter.md`;
`docs/CONTRACTS/axioma-bridge.md`; `docs/CONTRACTS/billing-webhooks.md`;
`docs/BACKTESTER_DISTRIBUTION_PLAN.md`; `docs/AXIOMA_HANDOFF_TOKEN_SPEC.md`;
`docs/BOT_CONTROL_SAFETY_MODEL.md`; `docs/TRADINGVIEW_ACCESS_PLAN.md`; `docs/BOT_INTEGRATION_PLAN.md`;
`docs/SECURITY_MODEL.md`; `docs/SECRET_VAULT_DESIGN.md`; plus whole-tree greps of `docs/**`.

Code/fact confirmations (Grep/Glob): `packages/config/src/env.ts:25` (enum value);
`packages/bot-adapters/src/http.ts:2`; `packages/axioma-bridge/src/handoff.ts` (HS256 dev stub);
Glob `apps/web/src/app/api/**` → **No files found** (directory does not exist);
Glob `packages/axioma-bridge/src/*.ts` → `bridge.ts`, `handoff.ts`, `index.ts` exist.

## Files changed

None — read-only audit.

## Findings

1. **[HIGH] `BOT_ADAPTER_MODE=real` still present in tortila-adapter contract (5 hits).**
   Evidence: `docs/CONTRACTS/tortila-adapter.md:6`, `:42`, `:423`, `:434`, and the Mock-vs-Real
   table cells `docs/CONTRACTS/tortila-adapter.md:419-421` (uses `real` as the column value for
   Staging/Production). The real enum has NO `=real` value — `packages/config/src/env.ts:25` is
   `z.enum(['mock','read-only','audited']).default('mock')`.
   Recommendation: replace every `BOT_ADAPTER_MODE=real` with `BOT_ADAPTER_MODE=read-only` (or
   `audited` for the live-control gate), e.g. line 6 → "Real adapter reads from the live journal
   when `BOT_ADAPTER_MODE=read-only` (or `audited`)."; line 423/434 → "`BOT_ADAPTER_MODE=read-only`
   must not be set in any environment until …" / "before setting `BOT_ADAPTER_MODE=read-only`".
   In the table, change the `real` cells (lines 420-421) to `read-only`/`audited`. Target part: B.

2. **[HIGH] `BOT_ADAPTER_MODE=real` still present in legacy-bot-adapter contract (4 hits).**
   Evidence: `docs/CONTRACTS/legacy-bot-adapter.md:382`, `:394`, `:409`, and Mock-vs-Real table
   cells `docs/CONTRACTS/legacy-bot-adapter.md:390-392` (Staging/Production = `real`).
   Recommendation: same substitution as Finding 1 — `=real` → `=read-only`/`audited`; line 382 →
   "before WTC enters production with `BOT_ADAPTER_MODE=read-only`"; line 394 → "`BOT_ADAPTER_MODE=read-only`
   for the legacy bot requires:"; line 409 → "before setting `BOT_ADAPTER_MODE=read-only`"; table
   cells (lines 391-392) → `read-only`/`audited`. Target part: B.

3. **[HIGH] ARCHITECTURE.md presents the entire `/api/**` REST surface as CURRENT, unlabelled.**
   Evidence: `docs/ARCHITECTURE.md:177` — "All routes live under `apps/web/src/app/api/` as
   Next.js route handlers." followed by the ~50-row route table (`:181`–`:231`) and the billing
   webhook note (`:233`). Glob confirms `apps/web/src/app/api/**` does NOT exist; the app uses
   server actions + `apps/web/src/lib/backend.ts` (see `docs/IMPLEMENTED_FILES.md:8-11`).
   Recommendation: relabel section 4 as TARGET/FUTURE. Change line 177 to: "**TARGET (not yet
   built).** There is no `apps/web/src/app/api/**` directory today; the app uses server actions +
   the `apps/web/src/lib/backend.ts` selector. The table below is the planned REST surface." Add the
   same banner above the billing-routes note at line 233. Target part: B.

4. **[MEDIUM] BACKTESTER plan presents the api route directory as current location.**
   Evidence: `docs/BACKTESTER_DISTRIBUTION_PLAN.md:552` — "All routes are in
   `apps/web/src/app/api/bots/[bot]/backtest/`." (table `:554`+, and the `/api/...` flow at
   `:44-47`, `:202`). Directory does not exist.
   Recommendation: prefix line 552 with "TARGET (not yet implemented): " so it reads "TARGET (not
   yet implemented): routes will live in `apps/web/src/app/api/bots/[bot]/backtest/`." Target part: B.

5. **[MEDIUM] README run flow presents Docker/Postgres path as the default; omits in-memory default.**
   Evidence: `README.md:49-53` — `docker compose up -d  # local Postgres`, then `db:migrate`/
   `db:seed`/`dev`, with no mention that the app boots on an in-memory demo backend by default and
   that Docker is unavailable on this host (verified host fact: Docker NOT installed). Contrast the
   honest note at `docs/DEPLOYMENT.md:32` and `docs/STATUS.md:42`.
   Recommendation: add a one-line note under the run block, e.g. "The app boots on an **in-memory
   demo backend by default** (no DB needed); the `docker compose`/`db:migrate`/`db:seed` steps are
   only for the real Postgres path and require Docker (not installed on the current host)." Mark the
   docker/db lines as optional. Target part: B.

6. **[MEDIUM] DEPLOYMENT.md "Local development" block leads with `docker compose up -d` as if routine.**
   Evidence: `docs/DEPLOYMENT.md:13` (`docker compose up -d  # local Postgres on :5432`) inside the
   default local-dev recipe; the in-memory caveat appears only afterward at `:32`. Docker is not
   installed on this host (verified fact); PostgreSQL 17 runs natively on 127.0.0.1:5432.
   Recommendation: move the in-memory note (line 32) above the recipe, and annotate the docker line
   as "(optional — only for the Postgres path; Docker is not installed on the current host. A native
   PostgreSQL 17 on 127.0.0.1:5432 also works via `DATABASE_URL`.)". Target part: B.

7. **[MEDIUM] axioma-bridge contract has a stale self-contradicting claim: handoff spec "not yet written".**
   Evidence: `docs/CONTRACTS/axioma-bridge.md:507` — "Open Axioma Journal | Contract defined, not
   implemented | … Handoff token spec (`AXIOMA_HANDOFF_TOKEN_SPEC.md`) not yet written." The spec
   IS written (`docs/AXIOMA_HANDOFF_TOKEN_SPEC.md` exists, ES256 spec) AND a dev HS256 signer is
   implemented (`packages/axioma-bridge/src/handoff.ts:58-59`, `alg:'HS256'`).
   Recommendation: change the line-507 note to: "Handoff token **spec is written**
   (`AXIOMA_HANDOFF_TOKEN_SPEC.md`, ES256); an **HS256 dev-stub signer is implemented** in
   `handoff.ts` — the ES256/JWKS production signer is NOT yet implemented." Target part: B.

8. **[MEDIUM] axioma-bridge status header understates implementation ("implementation pending").**
   Evidence: `docs/CONTRACTS/axioma-bridge.md:3` — "**Status:** Phase 0 — contract defined,
   implementation pending". The mock bridge IS implemented (`createMockAxiomaBridge`, confirmed at
   `docs/CONTRACTS/axioma-bridge.md:513` and `packages/axioma-bridge/src/bridge.ts`) and an HS256
   dev handoff signer exists.
   Recommendation: amend line 3 to: "**Status:** Phase 1 — contract defined; **mock bridge + HS256
   dev-stub handoff implemented**; ES256/JWKS production signer and real read-only endpoints pending."
   Target part: B.

9. **[LOW] BOT_CONTROL_SAFETY_MODEL gate lists "All tests green in CI" with no CI caveat.**
   Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:148` ("All tests green in CI.") under a checklist
   whose own `Status: NOT STARTED` (`:151`). No `.github/workflows` exists (verified fact). This is
   a future *gate precondition*, not a false "CI exists today" claim, but the standing "local gates
   pass; CI pending" reality is not stated.
   Recommendation: soften to "All tests green in CI (CI pipeline pending — today local gates pass;
   see STATUS.md)." Same optional touch for `docs/CONTRACTS/billing-webhooks.md:318` and `:351`
   ("passing in CI" / "must pass in CI"). Target part: B.

10. **[INFO] CI honesty across the rest of docs is already correct — no false "CI exists" claim found.**
    Evidence: `docs/STATUS.md:47` and `docs/handoffs/20260529-phase1-persistence-hardening.md:74,76`
    list "CI + secretlint" as still-needed; `docs/SECRET_VAULT_DESIGN.md:32` explicitly says "PLANNED
    (not yet implemented — no CI …)"; `docs/NEXT_ACTIONS.md:32,46` frame CI as a Phase-1.5 action.
    No doc asserts a CI pipeline currently runs. No change required; recorded for completeness so the
    fix set is not over-broadened. Target part: B.

11. **[INFO] Persistence wording in current-state docs is honest and code-consistent.**
    Evidence: `docs/STATUS.md:24-28`, `docs/IMPLEMENTED_FILES.md:12-26`, and
    `docs/handoffs/20260529-phase1-persistence-hardening.md:27-41,66-68` all state: core
    users/sessions/entitlements/audit/exchange-keys go through `@wtc/db` when `DATABASE_URL` is set,
    in-memory otherwise (fail-closed in prod); **TradingView + LMS web UI remain in-memory** while DB
    TV repos exist + are tested + back the worker. Consistent with `apps/web/src/lib/backend.ts` /
    `packages/db/src/repositories.ts`. README.md line 26 ("db/ Drizzle schema + migrations + seed
    (Postgres)") is accurate. No change required. Target part: B.

12. **[INFO] TradingView wording is consistent: DB repos/worker exist, web UI still memory-backed.**
    Evidence: `docs/IMPLEMENTED_FILES.md:24-26,38`; `docs/handoffs/20260529-phase1-persistence-hardening.md:68`;
    `docs/CONTRACTS/tradingview-access.md` and `docs/TRADINGVIEW_ACCESS_PLAN.md:534` (memory service).
    Aligned with `packages/tradingview-access/src/index.ts` (memory) + `packages/db/src/repositories.ts`
    (DB repo). No change required. Target part: B.

## Decisions

- Treated `real` used as a *column value* in the Mock-vs-Real tables (tortila :419-421, legacy
  :390-392) as in-scope for Finding 1/2: it is still the `=real` mode under a different layout and
  is equally false against the `mock|read-only|audited` enum.
- Did NOT flag the many `/api/...` references in pure design/spec docs (DOMAIN_MODEL, EDUCATION_LMS_PLAN,
  BILLING_PROVIDER_PLAN, AXIOMA_HANDOFF_TOKEN_SPEC sequence diagrams, BOT_INTEGRATION_PLAN external
  journal endpoints) as drift: those are either (a) the *external* Tortila/journal_server API surface
  (e.g. `:8080/api/health`), or (b) clearly framed as target design within a planning doc. Only docs
  that assert these routes are the *current WTC build location* (ARCHITECTURE.md:177, BACKTESTER:552)
  were flagged.
- CI gate-precondition phrasing in NOT-STARTED checklists (Findings 9) rated LOW, not HIGH, because
  it does not claim CI exists now.

## Risks

- The most load-bearing drift is Finding 3 (ARCHITECTURE.md §4): a reader/agent could implement
  against, or assume the existence of, ~50 REST endpoints that do not exist, contradicting the
  server-actions reality and `docs/IMPLEMENTED_FILES.md`.
- Findings 1/2 risk an operator setting an invalid env value (`BOT_ADAPTER_MODE=real`) that the zod
  enum will reject at boot — a deploy-time failure.
- Findings 7/8 understate Axioma progress, which could cause duplicated work or mistrust of the
  contract doc; opposite-direction (over-claim) risk is absent here.

## Verification/tests

Read-only audit; no tests run, no files changed. Claims verified by Read/Grep/Glob only.
Key verifications: Glob `apps/web/src/app/api/**` → no files (directory absent);
`packages/config/src/env.ts:25` enum = `mock|read-only|audited`;
`packages/axioma-bridge/src/handoff.ts:59` emits `alg:'HS256'` (dev stub), no ES256 signer present;
6 `BOT_ADAPTER_MODE=real` prose hits located via Grep across the two adapter contracts.

## Next actions

- A doc-owner (platform-architect for ARCHITECTURE/BACKTESTER; bot-integration-auditor for the two
  adapter contracts; axioma-bridge-auditor for axioma-bridge.md; devops-implementer for
  README/DEPLOYMENT) applies Findings 1-8 with the exact wording above. All are Part-B documentation
  edits; no code change required.
- Optional low-priority pass for Finding 9 CI caveats.
- Re-run `rg "BOT_ADAPTER_MODE=real" docs` after edits → expect zero hits.
