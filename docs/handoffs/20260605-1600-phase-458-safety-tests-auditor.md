# phase-458-safety-tests-auditor handoff
## Scope
Read-only Phase 4.58 safety/tests gate audit after Phase 4.57 unblocked the managed local DB proof. Scope was to inspect AGENTS/session protocol, the Phase 4.57 aggregate and its auditor handoffs, package scripts, tests, worker/admin read-only safety surfaces, and bot source-proof boundaries.

Goal: define exact continuation gates for moving beyond managed DB proof without unsafe live control:
- Tortila real-read proof.
- Legacy source proof.
- Permanent no `/api/marks`.
- No exchange pings or provider/live-control probes.
- Artifact scanning.
- Type/lint/build/governance gates.
- Local implementation candidates versus items that must remain blocked.

No code or docs other than this handoff were to be edited. No secrets, tokens, passwords, cookies, DSNs, or raw source payloads were printed or recorded.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md`
- `docs/handoffs/20260605-1425-test-db-env-discovery-auditor.md`
- `docs/handoffs/20260605-1425-source-artifact-discovery-auditor.md`
- `docs/handoffs/20260605-1425-safety-gate-orchestration-auditor.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/ACCEPTANCE_MATRIX_MASTER.md`
- `package.json`
- `apps/worker/package.json`
- `scripts/gates.mjs`
- `scripts/redacted-child-process.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `scripts/safe-worker-tick.mjs`
- `scripts/scan-lms-db-e2e-artifacts.mjs`
- `scripts/check-retained-visual-artifacts.mjs`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/legacy-closed-trade-source-proof.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/features/bots/config-export.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `packages/db/src/repositories.ts`
- `tests/e2e/user-bot-routes-db.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/legacy-closed-trade-source-proof-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-config-export-static.test.ts`

## Files changed
- `docs/handoffs/20260605-1600-phase-458-safety-tests-auditor.md` - this handoff only.

## Findings
1. Severity P0 - Process governance still requires phase honesty and exact gate accounting. Evidence: `AGENTS.md:42` requires broad/major phases to launch read-only agents before edits; `AGENTS.md:45` forbids N-agent claims without per-agent handoff files; `AGENTS.md:52` requires background-agent cleanup; `AGENTS.md:57` requires exact gates RUN and NOT RUN; `AGENTS.md:76-82` keeps discovery read-only, forbids plaintext exchange secrets, forbids live bot start/stop/apply-config, and requires fail-closed entitlements. Recommendation: Phase 4.58 continuation must either stay a narrow implementation session or launch/cite agents first if it becomes broad. Target part: session protocol.

2. Severity P0 - Phase 4.57 cleared local managed DB proof only; it did not clear source/live gates. Evidence: `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md:75` records the current-user Tortila DB route proof green; `:81` says remaining blockers are external/live/source gates; `:117-120` keeps Tortila real journal/auth/firewall, Legacy source/import, `/api/marks`, exchange pings, provider live probes, live bot control, and test-connection NOT RUN. Recommendation: do not treat Phase 4.57 as permission to run live probes or import Legacy closed trades. Target part: continuation gate boundary.

3. Severity P0 - Tortila real-read proof is locally implementable as a separate read-only harness, but it is not yet green. Evidence: the source auditor classified the local Tortila DB/journal shape as a valid source candidate but insufficient until a read-only run proves `sourceAdapter=tortila` and `readState=ok` at `docs/handoffs/20260605-1425-source-artifact-discovery-auditor.md:54`; it recommends a temp-copy journal harness that proves `/api/health`, `/api/summary`, `/api/equity`, and `/api/trades/list` while failing `/api/marks` at `:103`. Adapter evidence: `packages/bot-adapters/src/http.ts:79-85` lists the allowed journal endpoints and says `/api/marks` is never called; `:135-178` maps health into fail-closed `readState` values and `ok`. Worker evidence: `apps/worker/src/jobs.ts:101-110` gates real HTTP mode on `TORTILA_JOURNAL_URL` and says no control methods or `/api/marks`; `apps/worker/src/jobs.ts:127` persists `sourceAdapter` as `tortila` only for real adapter mode. Recommendation: build/run this only in a separate read-only local source phase with loopback journal, temp DB copy, redacted env, network interception, and artifact scan. Target part: Tortila source proof.

4. Severity P0 - `/api/marks` must remain a permanent exclusion, not a TODO endpoint or acceptance shortcut. Evidence: `docs/CONTRACTS/tortila-adapter.md:424` says the worker must never poll `/api/marks`; `:446-447` says there is no WTC timeout budget and static exclusion checks should be kept; `:460` marks `/api/marks` as excluded. Runtime/test evidence: `apps/worker/src/jobs.ts:10-12` documents no live control, no `/api/marks`, mock default; `tests/e2e/user-bot-routes-db.spec.ts:123` asserts no requested URL includes `/api/marks`; `tests/e2e/admin-user-bot-detail-db.spec.ts:300` requires admin copy stating no `/api/marks` live call. Recommendation: any Tortila real-read gate must fail on a `/api/marks` request. Target part: marks boundary.

5. Severity P0 - Exchange pings and live bot control are still blocked, including "test connection" style UX. Evidence: `docs/BOT_CONTROL_SAFETY_MODEL.md:15-18` says `startBot`, `stopBot`, and `applyConfig` throw until gates pass; `docs/BOT_CONTROL_SAFETY_MODEL.md:40` forbids exchange API calls through WTC; `docs/BOT_CONTROL_SAFETY_MODEL.md:262-269` says `/api/marks`, start/stop, SSH/systemd/tmux, exchange orders, and reading exchange keys are never/currently unavailable. UI/repo evidence: `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:60-73` states no live exchange ping is claimed; `:126-139` renders future ping buttons disabled; `packages/db/src/repositories.ts:442-479` records only `sealed_metadata_only` with `livePing: false`; `tests/integration/bot-read-safety-static.test.ts:591-617` pins that no live ping is claimed. Recommendation: local work can improve metadata-only readiness and redacted audit evidence, but must not add a real ping. Target part: exchange-key readiness and live control.

6. Severity P0 - Legacy closed-trade source proof remains blocked by absent source artifact; importer work cannot start honestly. Evidence: Phase 4.57 keeps Legacy realized metrics fail-closed until a real artifact proves stable closed-trade/fill identity, provider scope, replay semantics, realized PnL, fees/funding, timestamps, exit reason, and raw-payload allowlist at `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md:87`; it keeps the source/import gate NOT RUN at `:118` and says a separate phase starts only when a valid artifact names required fields at `:128`. Source auditor evidence: no `LEGACY_SOURCE_ARTIFACT` was found at `docs/handoffs/20260605-1425-source-artifact-discovery-auditor.md:71`, and Legacy orders/slots/settings are insufficient at `:60-62`. Code/test evidence: `packages/bot-adapters/src/legacy/closed-trade-source-proof.ts:1-23` defines required proof and forbidden substitutes; `:89-119` evaluates missing/unsafe proof into `blocked_no_source`; `:128-136` makes current proof blocked; `tests/integration/legacy-closed-trade-source-proof-static.test.ts:50-56` pins current blocked state. Recommendation: no Legacy closed-trade import, analytics unlock, or mapper claim until source proof passes. Target part: Legacy source/import.

7. Severity P1 - Artifact scanning exists, but bot-source artifact scanning is still partly manual. Evidence: Phase 4.57 ran `npm run secret:scan` at `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md:109` and a textual artifact marker scan at `:111`; safety orchestration requires `secret:scan` plus a `Select-String` marker scan over logs/test-results/playwright-report/screenshots at `docs/handoffs/20260605-1425-safety-gate-orchestration-auditor.md:123-127`. Redaction helper evidence: `scripts/redacted-child-process.mjs:47-62` redacts DB URLs, secrets, provider URLs, auth headers, cookies, JWTs, private keys, Stripe secrets, and public IP URLs. Existing scanner evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:34-40` defines retained gate-log and visual artifact scanning, but the bot marker scan is not exposed as a dedicated npm script. Recommendation: locally implement or wire a bot-specific artifact scanner before calling retained browser/source artifacts clean; until then keep the manual marker scan mandatory. Target part: evidence retention.

8. Severity P1 - Type/lint/build/governance gates are already scriptable and should be required after any local implementation. Evidence: `package.json:12-18` defines build/typecheck/secret/lint scripts; `package.json:54-55` defines governance and `ci:local`; `scripts/gates.mjs:169-170` defines core/full gate plans; Phase 4.57 observed typecheck, web/worker typecheck, lint, web build, secret scan, governance, and diff-check green at `docs/handoffs/20260605-1425-phase-4-57-managed-db-proof-unblocked.md:104-115`. Recommendation: rerun the full relevant gate stack after any code/test/docs implementation, and do not carry Phase 4.57 green status forward if files changed. Target part: local verification.

9. Severity P1 - Admin and worker safety model is read-only by design; render paths must not trigger probes. Evidence: admin page comments and copy say all data is read-only and no live-control buttons exist at `apps/web/src/app/admin/bots/page.tsx:419`, and that admin render does not run worker ticks, journal probes, Legacy DB reads, or live bot control at `:578`; worker env logic uses `TORTILA_JOURNAL_URL`/`TORTILA_JOURNAL_BASE_URL` only for read-only snapshots at `apps/worker/src/index.ts:266`, skips when not configured at `:299-306`, and logs source adapter without running control at `:331`. Recommendation: future admin safety tests should assert render-only behavior separately from worker snapshot commands. Target part: admin/worker boundary.

## Decisions
1. Phase 4.58 should not run or claim new live/source gates from this audit. This handoff defines gates only.
2. Locally implementable now, in a separate implementation phase:
   - A Tortila read-only local real-read harness using a temp copy of the candidate journal DB, loopback-only journal endpoint, redacted test env, and `/api/marks` interception.
   - A bot-specific retained-artifact scanner or script wrapper for `SHOULD_NOT_RENDER`, `MUST_NOT_LEAK`, source-proof raw markers, DSNs, bearer/cookie/header markers, and cross-user markers.
   - Additional static/browser tests that prove no active `/api/marks`, no exchange ping, no control method, no admin mutation form, and no raw source/secret leakage.
   - Local metadata-only exchange-key readiness hardening, as long as it stays `livePing:false`.
3. Must remain blocked:
   - Legacy closed-trade import/mapper/analytics unlock until a valid `LEGACY_SOURCE_ARTIFACT` passes the proof requirements.
   - `/api/marks` in all modes.
   - Exchange pings, provider live probes, `test connection`, live bot start/stop/apply-config, SSH/systemctl/tmux/process control, `.env` writes, and exchange order actions.
   - Production/app DB create/drop or migration during discovery.
   - Deploy, CI publication, monitoring, and burn-in unless a dedicated release phase is opened.
4. Tortila real-read can prove read wiring, health/equity/position/trade endpoint parsing, source adapter, read state, warning provenance, and no marks. It must not be used as closed-trade import proof if the source has zero closed trades.

## Risks
1. A local Tortila journal harness could accidentally start engine/exchange code if it is not isolated to journal-only startup against a temp DB copy.
2. A real-read token, URL, or DB path can leak through stdout, Playwright trace, screenshots, or retained logs if artifact scanning is skipped or ad hoc.
3. The existing scanner is strong for generic secrets and LMS artifacts, but bot-specific hostile markers currently rely on manual scanning.
4. Legacy order/slot/snapshot fields can look like trade proof but still do not prove closed fills, realized economics, replay semantics, or safe raw payloads.
5. The worktree is already very broad and dirty; any release/PR phase must intentionally stage and verify the exact tree.

## Verification/tests
RUN in this audit:
1. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a broad pre-existing dirty/untracked tree; this audit changed only the new handoff.
2. Read-only file inspections of AGENTS/session protocol, Phase 4.57 aggregate and auditor handoffs, package scripts, worker/admin safety code, docs, tests, and scanner scripts.
3. `rg -n` evidence scans for `/api/marks`, sourceAdapter/readState, exchange ping, live-control calls, Legacy source-proof requirements, artifact scan/redaction, and gate scripts.
4. `rg --files apps/web/src/app/api` - observed no `/api/marks` API route under the WTC app API tree.

NOT RUN in this audit:
1. `npm test`, focused Vitest, Playwright, typecheck, lint, build, governance, secret scan, artifact scan, and visual review - NOT RUN because this was a read-only gate-definition audit.
2. Managed DB gates - NOT RUN; Phase 4.57 already recorded them green, and this audit did not receive a new implementation or new DB env.
3. Tortila real-read harness - NOT RUN; separate read-only source phase required.
4. Legacy source/import gate - NOT RUN; no new valid source artifact was supplied.
5. `/api/marks`, exchange pings, provider probes, test connection, live bot control, SSH/systemctl/tmux/process control, `.env` writes, deploy, CI, monitoring, and burn-in - NOT RUN; prohibited or separate phase.

Exact continuation gates before claiming progress beyond managed DB proof:
1. Protocol gate:
   - If broad/major: launch/cite read-only agents before edits, one handoff per agent, aggregate handoff cites all agent files, close all agents, list gates RUN/NOT RUN.
   - If narrow: state no N-agent claim and write one scoped handoff.
2. Local managed DB regression gate after relevant code changes:
   - `npm run e2e:admin-user-bots:db:managed:user-routes`
   - `npm run e2e:admin-user-bots:db:managed:matrix`
   - `npm run accept:worker:continuity:managed`
   - Acceptance: runners create/drop only fresh `wtc_test_*` DBs, no DSNs printed, user/admin routes pass, worker tuple is `worker_status=ok`, `bot_continuity=ok`, `tortila=ok`, `legacy=ok`, and artifacts scan clean.
3. Tortila real-read gate:
   - Use loopback-only read-only journal harness against a temp/copied source DB or approved source endpoint.
   - Prove allowed endpoint reads only: `/api/health`, `/api/summary`, `/api/equity`, `/api/trades/list`.
   - Prove persisted `sourceAdapter=tortila`, `readState=ok`, redacted health detail, source-config provenance, identity scope, warnings/safety-signal ingestion, and no raw/secret payload rendering.
   - Fail if `/api/marks`, exchange domains, provider live probes, start/stop/apply, or test-connection code paths are invoked.
4. Legacy source-proof gate:
   - Require a valid source artifact with stable trade id, mapped provider scope/filter, symbol, side, size, entry/exit prices, realized PnL, fees/funding, opened/closed timestamps, exit reason, replay/backfill semantics, idempotency plan, raw-payload allowlist, and explicit rejection of inactive orders/slots/snapshots/Tortila/GTE/Axioma substitutes.
   - Only after `ready_for_mapper` may a separate mapper/importer phase begin.
5. No marks/no exchange/live-control gate:
   - Focused static/browser tests must assert no `/api/marks` fetches, no exchange ping, disabled future ping UI, metadata-only exchange readiness with `livePing:false`, no admin mutation forms, no start/stop/apply/test-connection buttons on read-only pages, and adapter control methods throwing.
6. Artifact gate:
   - `npm run secret:scan`
   - Bot marker scan over `logs`, `test-results`, `playwright-report`, `.next-e2e-admin-user-bots`, and `tests/e2e/screenshots` for `SHOULD_NOT_RENDER`, `MUST_NOT_LEAK`, `SOURCE_PROOF_RAW`, `apiKey`, `apiSecret`, `sealed`, `token=`, `Bearer `, `postgres://`, `password=`, and cross-user markers.
   - `node scripts/scan-lms-db-e2e-artifacts.mjs logs/gates test-results playwright-report tests/e2e/screenshots` for retained text artifacts.
   - If screenshots are retained as acceptance evidence, require `npm run evidence:visual -- --manifest <visual-review.json> tests/e2e/screenshots`; `--inventory` alone is not acceptance.
7. Type/lint/build/governance gate after implementation:
   - `npm run governance:check`
   - `npm run lint`
   - `npm run typecheck`
   - `npm run typecheck -w @wtc/web`
   - `npm run typecheck -w @wtc/worker`
   - `npm test`
   - `npm run build -w @wtc/web`
   - `npm run secret:scan`
   - `git diff --check`

## Next actions
1. Start a narrow implementation phase for the bot-specific artifact scanner and no-live/no-marks static gate wiring. This can be completed locally without source secrets or live probes.
2. Start a separate Tortila real-read proof phase only after the operator approves a loopback/temp-copy journal harness and supplies/authorizes the read-only source inputs. Do not run the engine or exchange client.
3. Keep Legacy closed-trade import blocked until a valid source artifact is supplied and the source-proof gate reaches `ready_for_mapper`.
4. Keep `/api/marks`, exchange pings, provider probes, live bot control, SSH/systemctl/tmux/process control, `.env` writes, production DB mutation, deploy, CI, monitoring, and burn-in out of scope unless a separate audited phase explicitly authorizes the relevant non-live gate.
5. If any UI, worker, adapter, DB, or scanner files change, rerun the exact gate stack in `Verification/tests` and record RUN/NOT RUN with reasons in the next aggregate handoff.
