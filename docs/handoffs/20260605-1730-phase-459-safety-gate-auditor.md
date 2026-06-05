# phase-459-safety-gate-auditor handoff
## Scope
Read-only Phase 4.59 safety/gate audit after Phase 4.58 Tortila local real-read proof.

Goal: inspect the Phase 4.58 aggregate and auditor handoffs, WTC safety/contract docs, WTC worker/adapter auth boundaries, and local `bot_tortila` journal source boundaries to decide:
- what remains hard-blocked after the Tortila local real-read proof;
- whether production Tortila journal auth/firewall can be partially completed locally;
- which gates are safe to run locally versus which require a dedicated production/deploy/security phase.

No application code was edited. No live service, journal endpoint, exchange/provider endpoint, production database, deploy, or CI was called. No `.env`, secret values, raw DB rows, raw JSON payloads, tokens, DSNs, cookies, or raw endpoint payloads were read or recorded. This handoff is the only file written.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md`
- `docs/handoffs/20260605-1600-phase-458-safety-tests-auditor.md`
- `docs/handoffs/20260605-1600-tortila-real-read-proof-auditor.md`
- `docs/handoffs/20260605-1600-legacy-source-deep-auditor.md`
- `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`
- `docs/handoffs/20260605-1425-source-artifact-discovery-auditor.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `.env.example`
- `package.json`
- `scripts/run-tortila-real-read-managed.mjs`
- `tests/integration/tortila-real-read-managed-runner.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/config/src/env.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\cli.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\config.py`
- `C:\Users\maxib\GTE BOT\bot_tortila\README.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\DEPLOYMENT.md`
- `C:\Users\maxib\GTE BOT\bot_tortila\WTC_ECOSYSTEM_DISCOVERY_MAP.md`

## Files changed
- `docs/handoffs/20260605-1730-phase-459-safety-gate-auditor.md` - this handoff only.

## Findings
1. Severity P0 - Phase 4.58 cleared the local Tortila real-read proof, but only for a loopback/disposable acceptance lane. Evidence: `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md:4-11` scopes the proof to temporary local Postgres and a temporary Tortila SQLite fixture, proving `sourceAdapter=tortila`, `readState=ok`, counts, and `marksRequests=0`; `:13-18` keeps production journal auth/firewall, exchange pings, live control, and deploy out of scope; `:55-72` records local gates run and production/live gates not run. Recommendation: treat Phase 4.58 as local read-path proof only, not production readiness. Target part: continuation gate boundary.

2. Severity P0 - Legacy closed-trade import remains hard-blocked. Evidence: `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md:41` records no `VALID_SOURCE_CANDIDATE`; `docs/handoffs/20260605-1600-legacy-source-deep-auditor.md:35-43` defines the required source fields and `:194-201` decides that no local artifact qualifies. Recommendation: do not start Legacy mapper/importer/UI unlock until a valid source artifact is supplied and audited. Target part: Legacy source/import.

3. Severity P0 - `/api/marks` remains permanently blocked for WTC, and `/api/overview` remains blocked for this proof lane because it bundles marks. Evidence: `docs/CONTRACTS/tortila-adapter.md:249-255` excludes `/api/marks`; `:446-447` says not to add a live marks gate; `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:734-746` exposes `/api/marks`; `:874-878` describes `/api/overview` as bundling marks; `scripts/run-tortila-real-read-managed.mjs:226-250` allowlists only health/summary/equity/trades-list and fails marks. Recommendation: keep WTC adapter/worker on the Phase 4.58 endpoint allowlist unless a separate no-marks endpoint split is audited. Target part: Tortila journal boundary.

4. Severity P0 - Exchange pings, provider probes, "test connection", and live bot start/stop/apply-config remain hard-blocked. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:15-24` says control methods are disabled at adapter level; `:28-43` permanently prohibits SSH/systemd/tmux, `.env` mutation, exchange API calls, key reads/logging, bot DB resets, and direct config overwrites; `:257-269` keeps marks, writes, starts/stops, SSH/systemd/tmux, exchange orders, and key reads unavailable. Recommendation: local auth/firewall work must not grow into live probe or control work. Target part: live-control safety.

5. Severity P1 - Production journal auth can be partially completed locally because the local `bot_tortila` source already has token middleware and WTC has fail-closed token plumbing, but the WTC contract doc is stale. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:100-118` reads `JOURNAL_READ_TOKEN`, accepts bearer or `x-journal-read-token`, and rejects mismatches; `:341-345` applies this to `/api/*`; `C:\Users\maxib\GTE BOT\bot_tortila\tests\test_journal.py:160-178` tests missing/wrong token rejection and bearer/header acceptance. WTC evidence: `packages/bot-adapters/src/http.ts:41-50` sends bearer auth without logging the token; `:93-98` refuses unauthenticated data reads; `packages/config/src/env.ts:116-120` requires `JOURNAL_READ_TOKEN` in production when adapter mode is not mock; `.env.example:96-98` documents the required token. Conflicting doc evidence: `docs/CONTRACTS/tortila-adapter.md:33-38` still says the journal has no auth middleware and token auth must be added; `:535` still tracks token middleware as a future requirement. Recommendation: next local phase can reconcile docs/tests around current auth, but must not claim production auth until a real secret is provisioned, systemd/env is configured, and redacted deployment verification passes. Target part: Tortila auth gate.

6. Severity P1 - Firewall can only be partially completed locally. Evidence: Phase 4.58 runner binds the proof journal/proxy to loopback at `scripts/run-tortila-real-read-managed.mjs:205-208`, starts the journal on loopback at `:265-274`, and uses a loopback allowlist proxy at `:528-538`; this proves local isolation behavior. However, WTC contract requires port restriction to the WTC server IP at `docs/CONTRACTS/tortila-adapter.md:42-45` and `:470-474`, while local Tortila deployment/source docs still show default/public-style exposure: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:951-953` defaults `--host` to `0.0.0.0`, and `C:\Users\maxib\GTE BOT\bot_tortila\DEPLOYMENT.md:37-46` still instructs opening port `8080`. Recommendation: locally test loopback binding, endpoint allowlist, and config templates, but require remote security-group/firewall proof before production `BOT_ADAPTER_MODE=read-only`. Target part: network boundary.

7. Severity P1 - Phase 4.58's token proof is meaningful but not sufficient for secret hygiene in production. Evidence: `scripts/run-tortila-real-read-managed.mjs:112-126` sets a dummy proof token and placeholder exchange values for a temporary local journal; `:337-356` gives the WTC worker a dummy token and disables live controls/Legacy live reads; `tests/integration/worker-tortila-snapshot.test.ts:171-200` pins that health failures do not leak the token; `scripts/redacted-child-process.mjs:19-20` and `:58` redact auth headers/bearer values. Recommendation: keep using dummy local tokens in tests; production requires vault/secret injection, no committed token, retained-artifact scans, and redacted logs. Target part: secret hygiene.

8. Severity P1 - The local Tortila journal remains source-boundary sensitive even with token auth. Evidence: `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\journal\app.py:33-66` can lazily construct a BingX client to fetch marks; `C:\Users\maxib\GTE BOT\bot_tortila\src\turtle_bot\cli.py:43-57` and `:79-90` construct exchange/runtime objects for runtime/reconcile commands; Phase 4.58 avoids these by starting only `turtle_bot.journal.app` against a temp DB with `/api/marks` blocked. Recommendation: production auth/firewall work must not instantiate engine/reconcile/status paths or call marks. Target part: bot_tortila source boundary.

9. Severity P1 - Docs/status should be corrected before a release claim. Evidence: `docs/CONTRACTS/tortila-adapter.md:33-38` conflicts with current local `bot_tortila` token middleware; `docs/CONTRACTS/tortila-adapter.md:529-537` still lists token auth as a future change; `docs/handoffs/20260605-1600-phase-458-tortila-real-read-proof.md:76` correctly says production auth/firewall needs a separate phase. Recommendation: next non-live local phase may update docs and add an explicit auth/firewall acceptance checklist, but it should still list production firewall/deploy as NOT RUN. Target part: documentation truth.

## Decisions
1. Hard-blocked after Phase 4.58:
   - Legacy closed-trade import/mapper/realized analytics unlock.
   - `/api/marks` in every WTC mode and `/api/overview` for the current WTC proof/worker lane.
   - Exchange pings/provider probes/test-connection.
   - Live bot start/stop/apply-config, SSH/systemd/tmux/process control, `.env` mutation, exchange orders, bot DB resets, or direct bot config writes from WTC.
   - Production DB mutation, deploy, CI publication, production monitoring, and burn-in.
   - Production `BOT_ADAPTER_MODE=read-only` until token provisioning plus firewall/network proof are observed in the target environment.

2. Locally completable without breaking safety:
   - Reconcile WTC docs with the current `bot_tortila` token middleware.
   - Add or run local token-auth tests proving unauthenticated `/api/*` is rejected when `JOURNAL_READ_TOKEN` is set and bearer/header auth succeeds.
   - Keep or improve the Phase 4.58 loopback allowlist proof for `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list`.
   - Add a local config/template/static check that production-like read-only mode requires `JOURNAL_READ_TOKEN` and refuses unauthenticated reads.
   - Add an explicit retained-artifact scan for tokens, DSNs, public IP URLs, raw payload markers, and forbidden `/api/marks`/`/api/overview` usage.

3. Not locally completable as production proof:
   - Actual production firewall/security-group/iptables state.
   - Actual systemd environment rollout for journal token and WTC worker token.
   - External-negative and WTC-server-positive network probes.
   - Secret vault provisioning, rotation/grace procedure, and production log/artifact inspection.
   - Production release/deploy/rollback and post-deploy monitoring.

4. The safest next phase is a narrow non-live auth/firewall documentation and local-preflight phase, not a production activation phase. A production activation phase should be opened only after the operator supplies the target deployment/network plan and authorizes remote checks.

## Risks
1. Treating the local dummy-token proof as production auth would hide missing production secret provisioning, rotation, systemd/env sync, and redacted log verification.
2. Treating loopback binding as firewall proof would miss security-group or host-firewall exposure on the real server.
3. The WTC contract doc can mislead future agents because it says journal auth is still absent even though local source now has token middleware.
4. `/api/overview` can reintroduce marks indirectly if a future adapter tries to simplify calls by consuming the dashboard bundle.
5. The broad dirty worktree means release scope must be explicitly staged and verified; this audit did not classify the full dirty tree for shipping.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a broad pre-existing dirty/untracked tree; this audit wrote only this handoff.
2. Read-only inspection of Phase 4.58 aggregate and auditor handoffs.
3. Read-only inspection of WTC safety docs, Tortila contract, env schema/example, adapter token handling, worker token/redaction behavior, and real-read runner.
4. Read-only inspection of local `bot_tortila` journal token middleware, journal route boundaries, CLI/runtime boundary, deployment notes, and journal tests.
5. `rg`/PowerShell evidence scans for `JOURNAL_READ_TOKEN`, `/api/marks`, `/api/overview`, firewall/security group/loopback, control methods, and production gate language.

NOT RUN in this audit:
1. `npm run accept:tortila:real-read:managed` - NOT RUN; Phase 4.58 already recorded it green and this was read-only.
2. Vitest, Playwright, typecheck, lint, build, governance, secret scan, artifact scan, and visual review - NOT RUN; no code changed.
3. Local journal server start or HTTP probe - NOT RUN; this audit inspected prior proof and source only.
4. Production journal auth/firewall proof - NOT RUN; requires target environment, secret provisioning, and network authorization.
5. External network/security-group/iptables/ufw checks - NOT RUN; outside local read-only scope.
6. `.env` reads/writes, secret vault access, raw DB row/payload reads, logs with raw payloads, screenshots, deploy, CI, monitoring, burn-in - NOT RUN.
7. `/api/marks`, `/api/overview`, exchange/provider pings, test-connection, live bot start/stop/apply-config, SSH/systemd/tmux/process control - NOT RUN; prohibited or separate audited phase.
8. Legacy source/import gate - NOT RUN; no valid source artifact exists.

Required gates before claiming production Tortila auth/firewall green:
1. Local preflight:
   - Token-auth tests for `bot_tortila` journal and WTC adapter/worker pass.
   - Local loopback-only journal run uses a dummy token, endpoint allowlist, no marks/overview, no exchange/client imports on the exercised path, and redacted output.
   - WTC docs/contracts/status are updated to reflect current auth state and remaining production firewall requirements.
   - `npm run secret:scan` plus retained-artifact marker scan pass after any implementation/docs changes.
2. Production/deploy phase:
   - Real token provisioned through the approved secret path, not committed or printed.
   - Journal service configured with `JOURNAL_READ_TOKEN`; WTC worker configured with the matching read token.
   - Journal binds or is firewall-restricted so only approved WTC-origin traffic can reach the safe API surface.
   - External-negative probe proves port/API is not publicly reachable; server-local or WTC-origin positive probe proves authorized reads work.
   - Worker proves `sourceAdapter=tortila`, `readState=ok`, allowed endpoints only, `marksRequests=0`, and no raw/secret artifacts.
   - Rollback and monitoring evidence are recorded.

## Next actions
1. Open a narrow local auth/firewall preflight phase to update stale docs and add/run token/allowlist/static checks; do not run production networking in that phase.
2. Keep Legacy source/import blocked until a valid Legacy source artifact is supplied and audited.
3. Keep `/api/marks`, `/api/overview`, exchange/provider probes, test-connection, and live bot controls forbidden.
4. Open a separate production auth/firewall activation phase only when target host/network details, secret provisioning plan, and remote-check authorization are available.
5. Before any release, stage intentionally, run the full relevant gate stack, and record exact gates RUN/NOT RUN in an aggregate handoff.
