# tortila-journal-auth-boundary-auditor handoff
## Scope
Read-only Phase 4.59 audit of the Tortila journal authentication boundary between WTC and the adjacent Tortila source.

Workspace: `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.
Adjacent source: `C:\Users\maxib\GTE BOT\bot_tortila`.

Question: determine whether the next safe non-looping implementation is to modify adjacent `bot_tortila` journal JSON endpoints to enforce `JOURNAL_READ_TOKEN` for the endpoints WTC consumes, and identify exact files, tests, and gates required.

Constraints honored: no code edits, no live/exchange calls, no raw payload/token/secret printing, no journal HTTP server start, no `/api/marks` or `/api/overview` call.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/ARCHITECTURE.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`
- `docs/handoffs/20260605-1600-tortila-real-read-proof-auditor.md`
- `docs/handoffs/20260605-1600-phase-458-safety-tests-auditor.md`
- `packages/bot-adapters/src/http.ts`
- `packages/config/src/env.ts`
- `apps/worker/src/index.ts`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `C:\Users\maxib\GTE BOT\bot_tortila\AGENTS.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\pyproject.toml`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`

## Files changed
None - read-only audit.

## Findings
1. Severity P0 - The adjacent `bot_tortila` working copy already has `JOURNAL_READ_TOKEN` enforcement on all `/api/*` routes, so the next safe step is not a blind new implementation in this checkout. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:100-118` reads `JOURNAL_READ_TOKEN`, accepts `Authorization: Bearer` or `x-journal-read-token`, compares with `hmac.compare_digest`, and returns HTTP 401 on mismatch; `:341-345` applies the guard to every path starting with `/api/`. Recommendation: treat this as an existing adjacent-source change requiring verification, canonical landing, and docs reconciliation. Target part: Tortila journal auth boundary.

2. Severity P0 - The current token middleware covers the WTC-consumed JSON endpoints and also covers excluded JSON endpoints, but WTC must still consume only the allowlisted endpoints. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:601-605` exposes `/api/health` and `/api/summary`; `:804-833` exposes `/api/trades/list`; WTC consumes `/api/equity` per `packages/bot-adapters/src/http.ts:78-83`; the middleware covers all `/api/*` at `app.py:341-345`. `/api/overview` still bundles marks (`app.py:874-906`), and WTC contract excludes `/api/marks` because it calls BingX (`docs/CONTRACTS/tortila-adapter.md:249-255`). Recommendation: keep WTC endpoint allowlist to `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`; do not add `/api/overview` or `/api/marks` even though token-gated. Target part: WTC adapter/worker source contract.

3. Severity P0 - WTC is already aligned to the token shape expected by the adjacent journal. Evidence: `packages/bot-adapters/src/http.ts:46-49` attaches `Authorization: Bearer <token>` only when configured and avoids token logging; `:93-108` refuses unauthenticated real read methods and fetches `/api/trades/list`; `:154-160` returns `readState=not_configured` for health without token and otherwise reads `/api/health`; `apps/worker/src/index.ts:314-317` passes `env.JOURNAL_READ_TOKEN` into the adapter. Recommendation: do not add another WTC auth mechanism; keep bearer token as the canonical WTC-to-journal contract. Target part: WTC worker and adapter.

4. Severity P1 - The adjacent bot auth boundary has a focused local test already present, but this audit did not run it. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py:160-178` sets `JOURNAL_READ_TOKEN`, verifies missing token 401, wrong bearer 401, correct bearer 200, fallback header 200 on `/api/summary`, and unauthenticated `/api/marks` 401. Recommendation: the implementation/verification phase must run this test and preferably the full `tests/test_journal.py` file before claiming the bot-side boundary is green. Target part: bot_tortila tests.

5. Severity P1 - WTC documentation is stale relative to the adjacent source now inspected. Evidence: `docs/CONTRACTS/tortila-adapter.md:33-38` still says the journal has no auth middleware and lists adding `JOURNAL_READ_TOKEN` as required; `:470-474` still gates `BOT_ADAPTER_MODE=read-only` on token auth plus firewall; `:535-537` still lists API token auth and firewall as future P0 items. Recommendation: after bot-side verification, update WTC docs to distinguish "token middleware present in inspected adjacent source" from "production firewall/token provisioning not yet proven." Target part: WTC contracts/status docs.

6. Severity P0 - Production auth/firewall remains separate from local source correctness. Evidence: Phase 4.58 proved WTC real-read locally green (`docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md:37-39`) but explicitly did not run production journal auth/firewall proof (`:66-69`) and called it a separate gate (`:74-76`). Recommendation: next non-looping production slice is not just code; it must include deployment config, firewall restriction, token provisioning, and a redacted smoke. Target part: production readiness.

7. Severity P1 - The adjacent `bot_tortila` folder is not git-backed in this checkout, so "already implemented" cannot be treated as landed upstream without a canonical source-control check. Evidence: `git status --short --branch` in `C:\Users\maxib\GTE BOT\bot_tortila` returned "not a git repository"; `C:\Users\maxib\GTE BOT\bot_tortila\AGENTS.md` defines the standard code-change chain as `turtle-task-router -> turtle-implementer -> relevant auditor -> turtle-tests-runner` and marks live-trading boundary as high risk. Recommendation: if this change must be landed, open the canonical bot repository or source bundle, apply only `src/turtle_bot/journal/app.py` plus tests/docs, and run the Turtle test chain before deployment. Target part: source-control/landing plan.

## Decisions
1. Verdict: do not start by modifying this adjacent `bot_tortila` working copy. It already contains the intended `JOURNAL_READ_TOKEN` middleware and tests. The next safe non-looping implementation is a verification/landing/docs-reconciliation slice.

2. If canonical `bot_tortila` source does not contain this middleware, the exact bot-side implementation files are:
   - `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
   - `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`
   - Optional docs/config examples only after audit: `C:\Users\maxib\GTE BOT\bot_tortila\.env.example`, `C:\Users\maxib\GTE BOT\bot_tortila\DEPLOYMENT.md`

3. WTC code should not need a new auth implementation for this boundary. Required WTC follow-up files are documentation/tests only unless a gate fails:
   - `docs/CONTRACTS/tortila-adapter.md`
   - `docs/ARCHITECTURE.md`
   - `docs/ACCEPTANCE_MATRIX_MASTER.md`
   - `scripts/run-tortila-real-read-managed.mjs` and `tests/integration/tortila-real-read-managed-runner.test.ts` only if the existing harness fails against the verified bot-side middleware.

4. `/api/marks` and `/api/overview` remain excluded from WTC consumption. Token-gating them protects the journal surface but does not make them WTC-safe source endpoints.

## Risks
1. Treating the non-git adjacent working copy as canonical could hide an unlanded local patch.
2. Updating only WTC docs without proving the deployed Tortila journal has the middleware would overstate production readiness.
3. Enabling `BOT_ADAPTER_MODE=read-only` in production before firewall restriction means a leaked or reachable journal surface could expose operational data.
4. Token values can leak through command output, access logs, failed child processes, screenshots, or retained artifacts if smoke runners are not redacted.
5. `/api/overview` can fetch marks, so any future "single bundle" optimization can silently violate the no-exchange/no-marks boundary.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` in WTC - observed branch `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked files.
2. `git status --short --branch` in adjacent `bot_tortila` - not git-backed in this checkout.
3. Static `rg`/file inspections of WTC AGENTS/session protocol, WTC Tortila adapter/worker/config/docs/handoffs, adjacent bot AGENTS, journal app, and journal tests.

NOT RUN in this audit:
1. Bot pytest/ruff - NOT RUN; read-only auditor lane, no code edits.
2. WTC Vitest/typecheck/lint/secret scan - NOT RUN; read-only auditor lane, no code edits.
3. `npm run accept:tortila:real-read:managed` - NOT RUN; this audit selected gates, it did not start local journal or worker proof.
4. Journal HTTP smoke - NOT RUN; no live server start and no endpoint calls.
5. `/api/marks`, `/api/overview`, exchange/provider probes, live bot start/stop/apply-config/test-connection, SSH/systemctl/tmux/process control, deploy, CI, monitoring, and burn-in - NOT RUN; prohibited or separate approved phases.

Required gates for the next implementation/verification slice:
1. Bot-side focused auth gate:
   - `python -m pytest tests/test_journal.py -q`
   - Acceptance: missing token and wrong bearer return 401; correct `Authorization: Bearer` returns 200; fallback `x-journal-read-token` returns 200; unauthenticated `/api/marks` returns 401; no token value appears in output.

2. Bot-side hygiene gate:
   - `python -m pytest -q`
   - `python -m ruff check .`
   - Acceptance: no exchange calls, no live bot control, no secret/raw payload output.

3. WTC adapter/token contract gate:
   - `npx vitest run packages/bot-adapters/src/__tests__/getHealth-states.test.ts packages/bot-adapters/src/__tests__/tortila-mapping.test.ts tests/integration/tortila-real-read-managed-runner.test.ts tests/integration/worker-tortila-snapshot.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/bot-read-safety-static.test.ts`
   - Acceptance: WTC sends bearer token only when configured, reports `readState=not_configured` without token, never calls `/api/marks` or `/api/overview`, and preserves redaction.

4. WTC managed real-read gate when isolated DB env is approved:
   - `npm run accept:tortila:real-read:managed`
   - Acceptance: `sourceAdapter=tortila`, `readState=ok`, imported trade/position counts, required endpoints `/api/health`, `/api/summary`, `/api/equity`, `/api/trades/list`, and `marksRequests=0`.

5. WTC build/safety gates after any WTC doc/code/test edit:
   - `npm run typecheck -w @wtc/worker`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run secret:scan`
   - `git diff --check`

6. Production auth/firewall gate before deployment claim:
   - Provision `JOURNAL_READ_TOKEN` in the Tortila journal service and WTC worker secret source without printing it.
   - Restrict journal `:8080` to the WTC server/loopback path only.
   - Redacted smoke: missing token 401, wrong token 401, correct bearer 200 for `/api/health`; WTC worker snapshot reads only allowlisted endpoints; retained logs/artifacts contain no bearer token, DSN, API key, or raw payload.

## Next actions
1. Open or identify the canonical git-backed `bot_tortila` source. Verify whether `src/turtle_bot/journal/app.py` and `tests/test_journal.py` already contain the middleware/tests inspected here.
2. If canonical source lacks the change, implement only the bot-side middleware/tests listed above, then run bot pytest/ruff gates.
3. After bot-side verification, update WTC `docs/CONTRACTS/tortila-adapter.md` to remove the stale "no auth middleware" claim while keeping production firewall/token provisioning as NOT RUN until proven.
4. Rerun the WTC adapter/token and managed real-read gates before enabling `BOT_ADAPTER_MODE=read-only` outside local proof.
5. Keep Legacy closed-trade import, `/api/marks`, `/api/overview`, exchange/provider probes, live bot controls, deploy, CI, monitoring, and burn-in out of scope until a separate audited phase authorizes them.
