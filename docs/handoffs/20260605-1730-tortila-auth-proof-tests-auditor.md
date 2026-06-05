# tortila-auth-proof-tests-auditor handoff

## Scope
Read-only Phase 4.59 audit to design exact verification for the token-gated Tortila/WTC read-only journal proof.

Target proof:
- Unauthenticated journal requests fail.
- Wrong-token journal requests fail.
- Correct-token journal requests pass for `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`.
- `/api/marks` remains excluded from WTC.
- No exchange calls are made by the WTC proof path.

No code was edited. No live services, live bots, exchange APIs, SSH, systemd, tmux, production DBs, or external journal endpoints were touched. Existing dirty worktree changes were treated as pre-existing.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`
- `docs/handoffs/20260605-1600-tortila-real-read-proof-auditor.md`
- `docs/handoffs/20260605-1600-phase-458-safety-tests-auditor.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `package.json`
- `scripts/run-tortila-real-read-managed.mjs`
- `scripts/redacted-child-process.mjs`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\conftest.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\pyproject.toml`

## Files changed
None - read-only audit. This handoff was written at `docs/handoffs/20260605-1730-tortila-auth-proof-tests-auditor.md` as requested.

## Findings
1. Severity P0 - Tortila journal token middleware exists in the sibling bot source, but the current bot-side pytest only proves a partial matrix. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:100-118` reads `JOURNAL_READ_TOKEN`, accepts `Authorization: Bearer` or `x-journal-read-token`, compares with `hmac.compare_digest`, and returns 401 on failure; `:341-345` applies this middleware to every `/api/` path. Existing pytest at `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py:160-179` proves unauthenticated `/api/health` fails, wrong bearer `/api/health` fails, correct bearer `/api/health` passes, correct `x-journal-read-token` `/api/summary` passes, and unauthenticated `/api/marks` fails. It does not yet parameterize the full WTC-required endpoint set. Recommendation: add a bot-side parameterized auth matrix for `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`: no token = 401, wrong bearer = 401, correct bearer = 200. Target part: `bot_tortila` journal pytest.

2. Severity P0 - WTC's HTTP Tortila adapter is already token-aware and fail-closed when the token is absent. Evidence: `packages/bot-adapters/src/http.ts:41-50` attaches `Authorization: Bearer <token>` to GET requests and does not include the token in error text; `:93-97` refuses data methods when no token is configured; `:154-162` maps missing token or failed health to fail-closed health/read-state; `packages/bot-adapters/src/factory.ts:21-23` documents `tortilaReadToken`; `apps/worker/src/index.ts:314-318` passes `env.JOURNAL_READ_TOKEN` into the adapter. Existing worker test `tests/integration/worker-tortila-snapshot.test.ts:135-168` proves read-only mode without `JOURNAL_READ_TOKEN` makes no journal fetch and persists no Tortila snapshots. Recommendation: keep this as the WTC fail-closed baseline, and add/keep a 401 wrong-token worker case that verifies no token leak and no metric/trade/position import. Target part: WTC adapter/worker tests.

3. Severity P0 - The Phase 4.58 managed runner proves the correct-token happy path plus no-marks, but it does not yet explicitly prove unauthenticated and wrong-token failure for each allowed endpoint. Evidence: `scripts/run-tortila-real-read-managed.mjs:14` defines a proof token; `:112-126` injects it into the local Tortila journal env; `:226-253` allowlists `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`, rejects `/api/marks`, and forwards auth headers to the upstream journal; `:294-296` waits for health with a correct bearer token; `:349-351` passes the token into the WTC worker; `:411-418` requires all allowed endpoints to be requested and `:412-413` fails if marks was requested. Static runner coverage at `tests/integration/tortila-real-read-managed-runner.test.ts:36-57` pins token forwarding and no-marks strings, but not the negative auth probe matrix. Recommendation: add a managed-runner `assertJournalAuthMatrix(proxyUrl)` before `runWorkerTick()`: for every allowed endpoint, request with no auth and wrong bearer and require 401, then request with the correct bearer and require 2xx; record only endpoint/status labels, never token values. Target part: `scripts/run-tortila-real-read-managed.mjs` and `tests/integration/tortila-real-read-managed-runner.test.ts`.

4. Severity P0 - `/api/marks` remains the exchange-call boundary and must stay outside WTC proof. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:42-72` constructs `BingXClient` and calls `fetch_tickers`/`fetch_ticker`; `/api/marks` calls that helper at `:734-746`; `/api/overview` also embeds marks at `:906-908`. WTC adapter comments and mappings exclude marks at `packages/bot-adapters/src/http.ts:8-10` and `:79-85`; `apps/worker/src/jobs.ts:9-14` and `:97-112` state `snapshotTortilaJournal` is read-only and never calls `/api/marks`. Contract evidence: `docs/CONTRACTS/tortila-adapter.md:249-255`, `:424-447`, and `:511-512` keep marks excluded from WTC. Recommendation: the Phase 4.59 gate must continue to allow only `/api/health`, `/api/summary`, `/api/equity`, `/api/trades/list`; it must fail on `/api/marks` and should also fail on `/api/overview` because overview currently includes marks. Target part: runner allowlist and static safety tests.

5. Severity P0 - "No exchange calls" needs a bot-side assertion, not only a WTC request log. Evidence: WTC can count requests through its proxy (`scripts/run-tortila-real-read-managed.mjs:226-253`), but exchange calls would happen inside the Python journal only if marks/overview or `_fetch_marks_cached()` runs. The allowed endpoints read store data: `/api/health` at `app.py:601-603`, `/api/summary` at `:605-653`, `/api/equity` at `:655-662`, and `/api/trades/list` at `:804-812`; `_live_equity_state()` reads bot state at `:180-192` and does not instantiate an exchange client. Recommendation: add a `bot_tortila` pytest that monkeypatches `turtle_bot.journal.app._fetch_marks_cached` to raise, then hits the four allowed endpoints with the correct bearer token and expects 200; the same test should not call `/api/marks` as a WTC endpoint. Target part: `bot_tortila/tests/test_journal.py`.

6. Severity P1 - Contract documentation is stale about auth state, which can confuse review of the proof. Evidence: `docs/CONTRACTS/tortila-adapter.md:33-38` still says the journal currently has no auth and the token must be added before production, while the sibling Tortila app now has token middleware and tests. `docs/STATUS.md:14-16` correctly keeps production auth/firewall rollout separate from local read proof. Recommendation: in the implementation phase, update the contract to say local Tortila source now has a `JOURNAL_READ_TOKEN` gate, while production firewall/reverse-proxy/network restriction remains NOT RUN until a deployment/security phase proves it. Target part: `docs/CONTRACTS/tortila-adapter.md`.

7. Severity P1 - Redaction gates exist and must remain mandatory because auth proof introduces token-shaped values. Evidence: `scripts/redacted-child-process.mjs:44-62` redacts secret assignments, Postgres URLs, authorization headers, bearer values, cookies, JWTs, and private keys; worker redaction at `apps/worker/src/index.ts:60-65` strips bearer and token/key/password shapes. Phase 4.58 already ran `npm run secret:scan` per `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md:57-64`. Recommendation: require `npm run secret:scan`, `npm run governance:check`, `git diff --check`, and a retained-artifact marker scan after any runner/test changes. Target part: final acceptance gate stack.

## Decisions
1. WTC's canonical auth header for the Tortila journal proof is `Authorization: Bearer <token>`. `x-journal-read-token` may remain a Tortila compatibility path, but the WTC proof should not rely on it.
2. The proof endpoint set is exactly `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`.
3. `/api/marks` is not a negative-auth success case for WTC. It remains an excluded endpoint; the WTC runner must fail if it is requested.
4. `/api/overview` should also stay outside the WTC proof until it no longer embeds marks/exchange-backed data.
5. Production journal firewall/reverse-proxy proof is a separate deploy/security gate. Local loopback auth proof does not clear production network exposure.
6. No background agents were spawned by this auditor and no N-agent audit claim is made. There are no spawned agents left running from this handoff.

## Risks
1. A correct-token `/api/marks` test would prove the journal endpoint can authenticate, but it would also exercise the exchange-call boundary if positions exist. Keep marks out of WTC and prove it only as excluded.
2. The runner's static tests can drift into string-presence coverage only. The managed runner itself should perform runtime auth probes against the loopback journal proxy.
3. If the auth probe logs raw headers, bearer values, DSNs, or env assignments, it can turn a security proof into a leak artifact. Use constant labels and redaction helpers.
4. If the runner is pointed at a production database or public journal, it violates the phase boundary. The managed runner must keep loopback-only journal URLs, temp SQLite fixtures, and fresh `wtc_test_tortila_real_read_*` databases.
5. The broader worktree is very dirty. A future implementation must stage only its intentional files and avoid rewriting unrelated user changes.

## Verification/tests
RUN this session:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with broad pre-existing dirty/untracked changes.
2. Read-only `rg` and `Get-Content` inspections over WTC runner/scripts/tests/docs and sibling `bot_tortila` journal/tests.
3. `Test-Path docs/handoffs/20260605-1730-tortila-auth-proof-tests-auditor.md` before write - file did not exist.

NOT RUN this session:
1. WTC Vitest, Playwright, typecheck, lint, secret scan, governance, managed DB runner - NOT RUN because this was a read-only auditor/design phase.
2. `bot_tortila` pytest - NOT RUN because this was inspection only.
3. Live Tortila journal, production firewall/auth, deploy, CI, monitoring, burn-in - NOT RUN and out of scope.
4. `/api/marks`, `/api/overview`, exchange pings, provider probes, live bot start/stop/apply-config, SSH/systemd/tmux - NOT RUN and prohibited for this scope.

Exact future verification commands after implementation:

```powershell
cd "C:\Users\maxib\GTE BOT\bot_tortila"
py -3.11 -m pytest tests/test_journal.py -q
```

Expected bot-side coverage to add/verify before this command is accepted:
- Parameterized auth matrix for `/api/health`, `/api/summary`, `/api/equity`, `/api/trades/list`.
- For each endpoint: no token = 401, `Authorization: Bearer wrong-token` = 401, correct bearer = 200.
- Monkeypatch `_fetch_marks_cached` to raise while the four allowed endpoints are requested with the correct bearer, proving the allowed WTC proof endpoints do not touch marks/exchange code.

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
npx vitest run tests/integration/tortila-real-read-managed-runner.test.ts tests/integration/worker-tortila-snapshot.test.ts packages/bot-adapters/src/adapters.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/bot-read-safety-static.test.ts
```

Expected WTC static/unit coverage to add/verify before this command is accepted:
- Runner contains and calls `assertJournalAuthMatrix`.
- Runner probes no-auth/wrong-auth/correct-auth for all four allowed endpoints.
- Runner forwards `Authorization` but never logs the bearer value.
- Runner still rejects `/api/marks` and does not allow `/api/overview`.
- Worker without `JOURNAL_READ_TOKEN` makes no fetch and imports no metrics/trades/positions.
- Worker wrong-token/401 path records fail-closed read state, imports no metrics/trades/positions, and does not leak the token.

```powershell
cd "C:\Users\maxib\GTE BOT\wtc_ecosystem_platform"
$env:TORTILA_REAL_READ_ADMIN_DATABASE_URL = "postgres://<local_admin_user>:<password>@127.0.0.1:<port>/<maintenance_db>"
npm run accept:tortila:real-read:managed
Remove-Item Env:\TORTILA_REAL_READ_ADMIN_DATABASE_URL
```

Expected managed-runner acceptance:
- Creates/drops only a fresh `wtc_test_tortila_real_read_*` DB.
- Starts only a loopback Tortila journal fixture and loopback allowlist proxy.
- Auth matrix observed: no token and wrong token return 401 for `/api/health`, `/api/summary`, `/api/equity`, `/api/trades/list`; correct bearer returns 2xx.
- Worker proof observed: `sourceAdapter=tortila`, `readState=ok`, `tradesImported=2`, `positionsSnapshotted=1`, `tradeCount=2`.
- Endpoint proof observed: required endpoints were requested; `/api/marks` requests = 0; `/api/overview` requests = 0.
- No live control, no exchange/provider probes, no production DB targets, no raw token/DSN output.

Final safety gates after the focused proof:

```powershell
npm run secret:scan
npm run governance:check
git diff --check
```

Retained artifact marker scan, if any logs/artifacts are retained:

```powershell
$paths = @("logs", "test-results", "playwright-report", ".codex-logs", "tests/e2e/screenshots") | Where-Object { Test-Path $_ }
if ($paths.Count -gt 0) {
  Get-ChildItem -Path $paths -Recurse -File |
    Select-String -SimpleMatch -Pattern "phase-458-dummy-read-token", "Bearer ", "JOURNAL_READ_TOKEN=", "postgres://", "password=", "apiKey", "apiSecret", "SOURCE_PROOF_RAW", "MUST_NOT_LEAK", "SHOULD_NOT_RENDER"
}
```

Acceptance rule for the marker scan: no hits containing raw tokens, bearer values, DSNs, passwords, exchange secrets, raw source payload markers, or hidden hostile markers. If the scan prints intentional redacted strings only, the final report must say exactly what was redacted and why it is acceptable.

## Next actions
1. Implement the bot-side auth matrix and no-exchange helper test in `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`.
2. Implement the WTC managed-runner auth matrix in `scripts/run-tortila-real-read-managed.mjs` and pin it in `tests/integration/tortila-real-read-managed-runner.test.ts`.
3. Add/confirm worker 401 wrong-token coverage in `tests/integration/worker-tortila-snapshot.test.ts`.
4. Update `docs/CONTRACTS/tortila-adapter.md` to separate current local token middleware from still-unproven production firewall/network rollout.
5. Run the exact commands above and report gates RUN/NOT RUN. Do not claim production Tortila auth/firewall or live deployment green from local loopback proof.
