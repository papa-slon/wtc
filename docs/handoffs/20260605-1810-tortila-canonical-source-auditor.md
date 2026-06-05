# tortila-canonical-source-auditor handoff

## Scope

Phase 4.60 read-only audit to determine whether a canonical git-backed Tortila / `bot_tortila` source repository exists locally, especially under `C:\Users\maxib\GTE BOT` and likely sibling locations. This audit compared the adjacent non-git-backed `C:\Users\maxib\GTE BOT\bot_tortila` source used by the WTC managed runner, inspected WTC references to `TORTILA_REAL_READ_SOURCE_ROOT` and `bot_tortila`, and identified where the Phase 4.59 `JOURNAL_READ_TOKEN` patch must land.

Constraints honored: no live servers, no exchange/provider probes, no `/api/marks` calls, no production mutation, no raw secrets/DSNs/tokens/passwords printed, and no code edits outside this handoff.

## Files inspected

- `AGENTS.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`
- `docs/handoffs/20260605-1730-phase-459-tortila-journal-auth-proof.md`
- `docs/handoffs/20260605-1730-tortila-journal-auth-boundary-auditor.md`
- `docs/handoffs/20260605-1730-tortila-auth-proof-tests-auditor.md`
- `scripts/run-tortila-real-read-managed.mjs`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/config/src/env.ts`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `C:\Users\maxib\GTE BOT\bot_tortila\AGENTS.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\pyproject.toml`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`

Local search bounds inspected:

- Top-level directories under `C:\Users\maxib\GTE BOT`.
- Shallow `tortila|turtle|turtle_bot` name scan under `C:\Users\maxib\GTE BOT`, `C:\Users\maxib\Documents\Codex`, and `C:\Users\maxib\Downloads`.
- Git-backed sibling repos under `C:\Users\maxib\GTE BOT`: `GTE_PRO`, `GTE_PROJECT`, `GTE_PROJECT — копия`, `GTE_tv_parity`, and `wtc_ecosystem_platform`.
- Additional shallow bot-named candidates in Downloads: `adaptive_bot_deploy3`, `bot tz`.

## Files changed

- `docs/handoffs/20260605-1810-tortila-canonical-source-auditor.md`

## Findings

1. Severity P0 - No canonical git-backed Tortila / `bot_tortila` source repo was found locally within the bounded search. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\.git` is absent, and `git -C "C:\Users\maxib\GTE BOT\bot_tortila" status --short --branch` returns "not a git repository". The shallow `tortila|turtle|turtle_bot` scan found only `C:\Users\maxib\GTE BOT\bot_tortila`. Top-level git-backed siblings under `C:\Users\maxib\GTE BOT` are `GTE_PRO`, `GTE_PROJECT`, `GTE_PROJECT — копия`, `GTE_tv_parity`, and `wtc_ecosystem_platform`; tracked-file scans in the non-WTC siblings found no `tortila`, `turtle_bot`, or `journal/app.py` source. Recommendation: treat canonical bot-source landing as blocked until the operator provides the real git repo path, remote, branch, or source bundle. Target part: source-control release workflow.

2. Severity P0 - The adjacent non-git-backed `bot_tortila` source already contains the Phase 4.59 local read-token patch, but it is not a canonical landing. Evidence: `src/turtle_bot/journal/app.py:101` reads `JOURNAL_READ_TOKEN`; `:108` accepts `x-journal-read-token`; `:111-116` validates the supplied token using constant-time comparison; `:341-342` applies the JSON 401 guard to `/api/*`. Existing local pytest coverage in `tests/test_journal.py:160-178` checks configured-token behavior for missing, wrong bearer, correct bearer, fallback header, and unauthenticated `/api/marks`. Recommendation: copy or reimplement this exact boundary in the canonical bot repo once found, then run bot-side tests before release. Target part: Tortila journal auth boundary.

3. Severity P0 - The exact bot-side files that need canonical edits are `src/turtle_bot/journal/app.py` and `tests/test_journal.py`. Evidence: the middleware lives in `app.py` and the adjacent proof test lives in `tests/test_journal.py:160-178`; WTC-required source endpoints are `/api/health` (`app.py:599`), `/api/summary` (`:603`), `/api/equity` (`:653`), and `/api/trades/list` (`:802`). Recommendation: canonical patch should add the token guard in `app.py`, add or strengthen a parameterized auth matrix in `tests/test_journal.py`, and optionally update only placeholder docs/config examples after security review. Do not edit exchange clients, order managers, or live-control paths for this patch. Target part: canonical Tortila source repo.

4. Severity P0 - WTC is already wired to the expected token contract and source-root fallback, but it points to the adjacent checkout by default. Evidence: `scripts/run-tortila-real-read-managed.mjs:96-97` resolves `TORTILA_REAL_READ_SOURCE_ROOT` or `../bot_tortila`; `:109` refuses when that local source root is absent; `:125` injects a proof-only journal token into the local journal process; `apps/worker/src/index.ts:317` passes `env.JOURNAL_READ_TOKEN` to the adapter; `packages/bot-adapters/src/http.ts:46` attaches bearer auth only when configured; `:95` refuses unauthenticated real reads; `:155-160` maps missing token to `not_configured`. Recommendation: for canonical verification, set `TORTILA_REAL_READ_SOURCE_ROOT` to the canonical git checkout and run the WTC managed proof from there. Target part: WTC proof harness and worker adapter.

5. Severity P0 - `/api/marks` and `/api/overview` remain excluded from WTC proof even if token-gated. Evidence: adjacent bot marks code can instantiate the exchange client (`app.py:42`, `:60-61`) and `/api/marks` calls `_fetch_marks_cached` (`:732`, `:744`); `/api/overview` can also call `_fetch_marks_cached` (`:872`, `:905`). WTC runner allowlists only `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list` (`scripts/run-tortila-real-read-managed.mjs:229`), fails `/api/marks` (`:233-236`), refuses `/api/overview` if requested (`:458-459`), and requires the four safe endpoints (`:461`). Recommendation: keep `/api/marks` and `/api/overview` out of source proof and production read-only WTC consumption. Target part: endpoint boundary.

6. Severity P1 - WTC docs correctly preserve the canonical/production blocker, but the contract should be reconciled only after canonical bot-source landing is proven. Evidence: `docs/STATUS.md:15-20` says Phase 4.59 is local proof and not final production completion, with adjacent non-git-backed source. `docs/NEXT_ACTIONS.md:56-59` names remaining canonical/production blockers. `docs/CONTRACTS/tortila-adapter.md:36-37` and `:473-474` still require token auth plus firewall before production, which remains valid until the canonical repo and deployed service are proven. Recommendation: after canonical source is found and patched, update the contract to say canonical source contains token middleware while production secret provisioning/firewall/network proof remains NOT RUN until separately verified. Target part: WTC contract docs.

## Decisions

1. No local canonical git-backed Tortila repo can be named from this audit. The blocker is missing canonical source-control location: repository path/remote/branch or authoritative source bundle.

2. Do not treat `C:\Users\maxib\GTE BOT\bot_tortila` as the canonical landing target. It is a useful adjacent runtime/source fixture for WTC proof, but it is not git-backed.

3. The Phase 4.59 bot-side patch should land in the canonical Tortila bot repo, preserving the same file paths relative to that repo: `src/turtle_bot/journal/app.py` and `tests/test_journal.py`.

4. WTC should keep using `TORTILA_REAL_READ_SOURCE_ROOT` as the switch for proof. Once canonical source is available locally, point this env var to that git checkout and rerun WTC proof without changing the default fallback unless the repo layout changes.

5. `/api/marks` and `/api/overview` are not acceptance endpoints for WTC. Token-gating protects the journal surface but does not make those endpoints safe for WTC ingestion.

## Risks

1. A non-git adjacent patch can be overwritten, copied incompletely, or deployed from a different source without audit trail.

2. Updating WTC status/docs before canonical landing would overstate production readiness.

3. A future convenience change that reads `/api/overview` could silently reintroduce exchange-backed marks through the journal bundle.

4. Running the managed real-read proof against the default `../bot_tortila` root proves only the adjacent local fixture, not the canonical source.

5. Any command that prints env, process args, raw HTTP headers, DB URLs, or full logs can leak secrets; verification must report statuses and counts only.

## Verification/tests

Run this session:

1. `git status --short --branch` in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform` - observed WTC is git-backed on `codex/bot-analytics-settings-canary-20260603` with substantial pre-existing dirty/untracked work.
2. `Test-Path "C:\Users\maxib\GTE BOT\bot_tortila\.git"` - observed `False`.
3. `git -C "C:\Users\maxib\GTE BOT\bot_tortila" status --short --branch` - observed not a git repository.
4. Top-level git inventory under `C:\Users\maxib\GTE BOT` - observed only `GTE_PRO`, `GTE_PROJECT`, `GTE_PROJECT — копия`, `GTE_tv_parity`, and `wtc_ecosystem_platform` as git-backed; only WTC had tracked Tortila adapter/contract files, not Python `bot_tortila` source.
5. Shallow candidate scans under `C:\Users\maxib\GTE BOT`, `C:\Users\maxib\Documents\Codex`, and `C:\Users\maxib\Downloads` - observed only `C:\Users\maxib\GTE BOT\bot_tortila` as a Tortila/Turtle-named source candidate; Downloads bot-named candidates were non-git and had no shallow Tortila/Turtle/journal directories.
6. Static `rg` inspections of WTC runner/adapter/tests/docs and adjacent bot source - observed the token guard, WTC fallback root, WTC bearer forwarding, auth matrix proof strings, and `/api/marks`/`/api/overview` exclusions.

Not run in this audit:

1. `python -m pytest tests/test_journal.py -q` in `bot_tortila` - NOT RUN because this lane is read-only discovery and the adjacent source is not canonical.
2. `python -m ruff check .` in `bot_tortila` - NOT RUN for the same reason.
3. `npm run accept:tortila:real-read:managed` - NOT RUN because this audit did not start local managed services or mutate DBs.
4. `npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts tests/integration/worker-tortila-snapshot.test.ts` - NOT RUN; static inspection only.
5. Production journal auth/firewall probes, live journal HTTP calls, `/api/marks`, `/api/overview`, exchange/provider probes, SSH/systemd/tmux/process control, deploy, CI, monitoring, and burn-in - NOT RUN and out of scope.

Commands that should prove canonical landing once the canonical bot repo is opened:

1. In canonical Tortila repo:

```powershell
python -m pytest tests/test_journal.py -q
python -m ruff check .
git status --short --branch
```

Acceptance: token-gated `/api/*` returns 401 for missing/wrong token when configured; correct bearer succeeds for `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`; fallback header succeeds for at least one safe endpoint; unauthenticated `/api/marks` is rejected; no raw token value appears in output.

2. In WTC with canonical source root explicitly selected:

```powershell
$env:TORTILA_REAL_READ_SOURCE_ROOT = "<absolute path to canonical Tortila git checkout>"
npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts tests/integration/worker-tortila-snapshot.test.ts
npm run accept:tortila:real-read:managed
npm run secret:scan
git diff --check
```

Acceptance: WTC reads only `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`; reports missing/wrong token as 401 in the auth matrix; imports expected local fixture counts; `marksRequests=0`; `/api/overview` is not requested; output remains redacted.

## Next actions

1. Operator must provide or open the canonical git-backed Tortila bot source path/remote/branch. Current local disk search did not find it.

2. In that canonical repo, verify whether `src/turtle_bot/journal/app.py` and `tests/test_journal.py` already contain the Phase 4.59 `JOURNAL_READ_TOKEN` middleware and tests.

3. If absent, apply only the bot-side journal auth patch to `src/turtle_bot/journal/app.py` and `tests/test_journal.py`; optional placeholder-only `.env.example` or deployment-doc edits require a separate security review.

4. Run canonical bot pytest + ruff, then point WTC `TORTILA_REAL_READ_SOURCE_ROOT` at the canonical checkout and rerun the WTC focused/managed proof commands above.

5. After canonical proof, reconcile WTC `docs/CONTRACTS/tortila-adapter.md`, `docs/STATUS.md`, and `docs/NEXT_ACTIONS.md` to distinguish canonical source landing from still-unproven production token provisioning, firewall restriction, deploy, monitoring, and authorized network probes.

6. Keep live bot control, `/api/marks`, `/api/overview`, exchange/provider probes, production mutation, CI/deploy/monitoring claims, and secret printing out of scope until a separately authorized phase.
