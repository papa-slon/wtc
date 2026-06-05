# next-actions-truth-auditor handoff
## Scope
Phase 4.33 read-only next-actions truth audit for `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Requested scope: inspect `docs/NEXT_ACTIONS.md` plus Phase 4.27 through Phase 4.32 handoffs, then produce a concrete priority order for remaining work as `fixable-now`, `blocked-by-env`, `blocked-by-source`, and `blocked-by-safety`.

No source code was edited. No secret/env values were read or printed. No DB, service, provider, exchange, deploy, SSH/tmux/systemd, or bot-control action was run. This file is the only protocol write.

No background agents were spawned for this single named auditor lane; none were left open.

## Files inspected
- `docs/NEXT_ACTIONS.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/DATA_MODEL.md`
- `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md`
- `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md`
- `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md`
- `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md`
- `docs/handoffs/20260604-1754-admin-user-bot-db-matrix-auditor.md`
- `docs/handoffs/20260604-1756-worker-continuity-acceptance-auditor.md`
- `docs/handoffs/20260604-1758-bot-product-ux-completion-auditor.md`
- `docs/handoffs/20260604-1815-bot-statistics-data-security-auditor.md`
- `docs/handoffs/20260604-1818-bot-statistics-ux-product-auditor.md`
- `docs/handoffs/20260604-1821-bot-statistics-tests-visual-auditor.md`
- `docs/handoffs/20260604-1834-legacy-provider-scope-tests-auditor.md`
- `docs/handoffs/20260604-1835-legacy-provider-scope-data-auditor.md`
- `docs/handoffs/20260604-1835-selected-user-readiness-ux-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-db-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-worker-auditor.md`
- `docs/handoffs/20260604-1852-legacy-trade-idempotency-tests-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md`
- `docs/handoffs/20260604-1910-legacy-closed-trade-tests-ux-auditor.md`
- `docs/handoffs/20260604-1925-product-completion-auditor.md`
- `docs/handoffs/20260604-1925-rendered-acceptance-gates-auditor.md`
- `docs/handoffs/20260604-1925-rendered-acceptance-ux-auditor.md`

## Files changed
- `docs/handoffs/20260604-1950-next-actions-truth-auditor.md` - required handoff only.

## Findings
1. Severity P1 - Priority 1, fixable-now: the top-level Phase 4.32 rollup is mostly current, but `docs/DATA_MODEL.md` still has stale provider-unaware trade-import index wording. Evidence: `docs/NEXT_ACTIONS.md:8-11` says the next fixable-now work includes rollup upkeep and `DATA_MODEL` reconciliation; `docs/STATUS.md:3-23` and `docs/IMPLEMENTED_FILES.md:3-28` already contain Phase 4.32 local truth; `docs/DATA_MODEL.md:551` and `docs/DATA_MODEL.md:1385` still list `idx_bti_external_trade_id` on `(source_adapter, external_trade_id)` while Phase 4.30 records split scoped/unscoped partial indexes at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:54-56`. Recommendation: first local cleanup should update `docs/DATA_MODEL.md` and keep `NEXT_ACTIONS`/`STATUS`/`IMPLEMENTED_FILES` aligned after this auditor handoff. Target part: docs truth.
2. Severity P1 - Priority 2, fixable-now: provider-aware trade idempotency should not be reimplemented; it is closed as code/schema work, with only docs/gate follow-through remaining. Evidence: Phase 4.29 still listed provider-aware idempotency as open at `docs/handoffs/20260604-1849-phase-4-29-legacy-provider-scope-hardening.md:60`, but Phase 4.30 closed it with DB invariants, repository conflict targeting, and regression coverage at `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:54-58` and `docs/handoffs/20260604-1908-phase-4-30-legacy-trade-idempotency.md:78-85`. Recommendation: do not spend the next slice rebuilding this invariant; spend only on stale docs and any focused non-live gates needed after docs/code changes. Target part: `bot_trade_imports` priority truth.
3. Severity P1 - Priority 3, fixable-now: rendered statistics and visual acceptance can be strengthened locally without provider/source access. Evidence: Phase 4.28 records no dedicated bot statistics e2e and no browser run for that patch at `docs/handoffs/20260604-1827-phase-4-28-bot-statistics-completion-cockpit.md:81-82`; Phase 4.32 records no-live-DB rendered pack green at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:49` but still no formal visual manifest at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:56` and `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:85`; the rendered-gates auditor confirms `tests/e2e/bot-statistics.spec.ts` is absent and formal manifest remains not green at `docs/handoffs/20260604-1925-rendered-acceptance-gates-auditor.md:55`, `docs/handoffs/20260604-1925-rendered-acceptance-gates-auditor.md:63`, and `docs/handoffs/20260604-1925-rendered-acceptance-gates-auditor.md:105`. Recommendation: add/run a dedicated Tortila/Legacy statistics rendered proof only if final acceptance needs more than current smoke sub-tab coverage; pair screenshot evidence with a reviewed visual manifest before claiming formal visual acceptance. Target part: rendered UX and visual governance.
4. Severity P1 - Priority 4, blocked-by-env: hard worker continuity remains gated by an operator-approved disposable/admin Postgres path, not by more local UI work. Evidence: `docs/NEXT_ACTIONS.md:12-15` names the managed worker tuple gate and required tuple; Phase 4.27 defines tuple acceptance and the managed runner at `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:54-56`; Phase 4.27 marks `accept:worker:continuity:managed` not run because the required admin Postgres URL was absent at `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:84`; Phase 4.32 repeats the not-run gate at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:55` and `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:84`. Recommendation: do not claim non-stop continuity complete until `npm run accept:worker:continuity:managed` is run in an approved disposable DB context and records `worker_status=ok; bot_continuity=ok; tortila=ok; legacy=ok`. Target part: worker continuity proof.
5. Severity P1 - Priority 5, blocked-by-env: populated selected-user admin proof remains gated by the managed DB browser matrix. Evidence: `docs/NEXT_ACTIONS.md:14-15` names the admin-user DB matrix env blocker; Phase 4.27 says selected-user DB matrix fixtures exist and assert aggregate worker states at `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:56`, but the matrix was not run without the opt-in DB URL at `docs/handoffs/20260604-1810-phase-4-27-managed-worker-continuity-acceptance.md:86`; Phase 4.32 repeats the missing DB matrix at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:54` and `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:83`. Recommendation: run `npm run e2e:admin-user-bots:db:managed:matrix` only after explicit disposable/admin Postgres authorization, then review scenario screenshots and visual artifacts. Target part: admin selected-user DB acceptance.
6. Severity P1 - Priority 6, blocked-by-source: Legacy closed-trade import must remain blocked until a real source-proof artifact exists. Evidence: `docs/NEXT_ACTIONS.md:16-18` lists required source fields; Phase 4.31 says the local Legacy source lacks a durable closed-trade/fill model and current WTC Legacy ingestion is runtime-snapshot only at `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:57-61`; the source auditor classifies closed-trade table/columns as `UNKNOWN_NO_EVIDENCE` at `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md:47` and says no importer should be implemented until source fields are mapped at `docs/handoffs/20260604-1910-legacy-closed-trade-source-auditor.md:55`; the importer auditor verdict is explicitly blocked at `docs/handoffs/20260604-1910-legacy-closed-trade-importer-auditor.md:5`. Recommendation: do not derive PnL, win rate, profit factor, or closed-trade history from inactive orders/slots; require a repo-local model/contract, upstream PR, or operator-approved metadata-only schema proof first. Target part: Legacy analytics and importer.
7. Severity P1 - Priority 7, blocked-by-safety: live exchange ping, live provider/exchange probes, and live bot start/stop/apply-config remain intentionally disabled. Evidence: `docs/NEXT_ACTIONS.md:19-20` keeps live ping/control disabled until bot-integration and security audits approve live adapters; `docs/STATUS.md:17-20` lists live ping, live bot control, live provider/exchange probes, deploy, and monitoring as not green/not run; Phase 4.32 marks live Legacy DB/provider/exchange probes and live bot control not run at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:86-88`; the product completion auditor classifies live exchange ping/start as security plus bot-integration blocked at `docs/handoffs/20260604-1925-product-completion-auditor.md:75`. Recommendation: leave these out of the next local slice; do not add live-control affordances until a separate audited safety phase approves adapters and gates. Target part: live-control safety.
8. Severity P2 - Release/deploy completion is not a next local truth-audit fix because the worktree is heavily dirty and full release gates were not run in this audit. Evidence: current `git status --short --branch` was observed on `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with hundreds of dirty output lines; the rendered-gates auditor recorded the same branch and a broad dirty worktree at `docs/handoffs/20260604-1925-rendered-acceptance-gates-auditor.md:9`; Phase 4.32 warns release/deploy is unsafe until intended files are reconciled and full gates are run at `docs/handoffs/20260604-1941-phase-4-32-rendered-acceptance-proof.md:70`. Recommendation: before any deploy/final-complete claim, reconcile intended files, update docs, run exact gates, and stage/commit intentionally in a separate release-safe phase. Target part: release hygiene.

## Decisions
- The priority order in the current top of `docs/NEXT_ACTIONS.md` is broadly truthful after Phase 4.32.
- `docs/STATUS.md` and `docs/IMPLEMENTED_FILES.md` already contain the Phase 4.18-4.32 local completion rollup; `docs/DATA_MODEL.md` is the clearest remaining docs-truth mismatch.
- The full product goal is not complete: WTC-side bot/admin surfaces are substantially built and no-live-DB rendered proof is green, but worker continuity, admin-user DB matrix, formal visual manifest, live/safety gates, production/deploy proof, and Legacy closed-trade source proof are not green.
- Managed worker continuity and admin-user DB matrix are blocked by disposable/admin Postgres environment authorization, not by source-model work.
- Legacy closed-trade import is blocked by source evidence, not by WTC destination storage; Phase 4.30 made the WTC import destination ready.
- Live exchange ping, provider/exchange probes, and live bot start/stop/apply-config are blocked by safety/audit and must not be smuggled into a local UI/docs slice.

## Risks
- Screenshot-producing Playwright can be mistaken for formal visual acceptance unless a reviewed visual manifest is created and passed.
- A direct DB fixture can make Legacy admin/statistics UI look loaded while real Legacy source ingestion remains unproven.
- Running managed DB gates against the wrong database would violate the disposable-DB boundary; use only the guarded managed runners with explicit operator-approved admin/disposable Postgres URLs.
- Local source may differ from a live Legacy DB, but proving that requires a separate metadata-only source phase with no row data, no secrets, and explicit safety approval.
- The dirty worktree makes deploy/release claims unsafe until intended files and gates are reconciled.

## Verification/tests
RUN:
- `Get-Location` - confirmed current root is `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with broad pre-existing modified and untracked paths.
- `rg --files docs/handoffs | rg "phase-4-(27|28|29|30|31|32)"` - found Phase 4.27 through Phase 4.32 aggregate handoffs.
- `rg --files docs/handoffs | rg "20260604-(1754|1756|1758|1815|1818|1821|1834|1835|1852|1910|1925)-.*auditor\.md"` - found the relevant participant auditor handoffs.
- Read-only `rg` evidence scans across `docs/NEXT_ACTIONS.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/DATA_MODEL.md`, and the Phase 4.27-4.32 handoff chain.
- `Test-Path docs/handoffs/20260604-1950-next-actions-truth-auditor.md` - returned `False` before writing this required handoff.

NOT RUN:
- No Vitest, lint, typecheck, build, Playwright, e2e, governance, secret scan, DB migrate/generate, worker tick, worker smoke, managed worker continuity, admin-user DB matrix, visual manifest, deploy, SSH/tmux/systemd, provider/exchange probes, raw env reads, raw secret reads, live exchange ping, or live bot control were run in this auditor lane.
- No background agents were launched; therefore no agent cleanup was needed.

## Next actions
1. Fixable-now: update `docs/DATA_MODEL.md` so `bot_trade_imports` documents the Phase 4.30 provider-scoped/unscoped partial unique indexes instead of the old provider-unaware unique index.
2. Fixable-now: after this handoff and any docs cleanup, run the smallest appropriate non-live doc/source gates, starting with `npm run governance:check`; add `git diff --check`, focused Vitest, typecheck, or build only if the touched files warrant them.
3. Fixable-now if final acceptance needs it: add or run a dedicated `tests/e2e/bot-statistics.spec.ts` for Tortila and Legacy desktop/mobile, then promote screenshots only with a reviewed visual manifest.
4. Blocked-by-env: when the approved worker-continuity admin/disposable Postgres URL is supplied, run `npm run accept:worker:continuity:managed` and record the created/dropped DB name plus `worker_status=ok; bot_continuity=ok; tortila=ok; legacy=ok`.
5. Blocked-by-env: when the approved admin-user DB browser URL is supplied, run `npm run e2e:admin-user-bots:db:managed:matrix`, review scenario screenshots, and run visual artifact inventory/manifest gates.
6. Blocked-by-source: before any Legacy closed-trade importer, obtain a source-proof artifact naming the closed-trade/fill source, stable external id, mapped provider filter, symbol, side, size, entry/exit prices, realized PnL, fees/funding, opened/closed timestamps, exit reason, replay semantics, and raw payload allowlist.
7. Blocked-by-safety: keep live exchange ping, live provider/exchange probes, and live bot start/stop/apply-config disabled until separate bot-integration and security audits explicitly approve live-control adapters and acceptance gates.
