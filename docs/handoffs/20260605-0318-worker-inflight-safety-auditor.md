# worker-inflight-safety-auditor handoff
## Scope
Read-only safety/security audit for WTC Phase 4.46 worker in-flight guard boundaries. The audit inspected whether the current/target guard shape can be accepted without provider calls, secret exposure, fake green continuity, live bot control changes, or weakened env isolation/log redaction. This auditor did not run live provider probes, mutate DB state, start/stop servers or bots, touch external secrets, or edit product/source/test/docs beyond this handoff.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/NEXT_ACTIONS.md`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/tick-once.ts`
- `apps/worker/src/legacy-live.ts`
- `scripts/safe-worker-tick.mjs`
- `scripts/redacted-child-process.mjs`
- `package.json`
- `apps/worker/package.json`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `tests/integration/worker-inflight-guard.test.ts`
- `tests/integration/worker-health-mapping.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `tests/integration/two-bot-continuity-contract-static.test.ts`
- `tests/integration/child-output-redaction.test.ts`
- `tests/integration/db-seed-preview-hardening.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/legacy-live-worker-static.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- Prior handoff context: `docs/handoffs/20260605-0215-bot-final-gap-runtime-safety-auditor.md`, `docs/handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md`, `docs/handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md`

## Files changed
None — read-only audit. This handoff file is the only write performed by this auditor.

## Findings
1. Severity P0 - The in-flight guard must remain a pure scheduler serializer, not a new provider or worker job path. Evidence: the current dirty-tree candidate `createSerializedDbWorkerTickRunner` accepts only injected `runTick`, `now`, and `logger`, and on overlap it returns `skipped_in_flight` after logging numeric age/skip telemetry (`apps/worker/src/index.ts:93`, `apps/worker/src/index.ts:109`, `apps/worker/src/index.ts:115`, `apps/worker/src/index.ts:118`). The long-running DB interval is wired through this runner (`apps/worker/src/index.ts:478`, `apps/worker/src/index.ts:486`), while one-shot `dbTick()` still calls `runDbWorkerTick` directly for acceptance (`apps/worker/src/index.ts:432`, `apps/worker/src/index.ts:436`). Recommendation: keep the guard free of `fetch`, adapter construction, env reads, DB URL handling, provider tokens, and bot control imports; serialize only the scheduled DB tick. Target part: `createSerializedDbWorkerTickRunner` and `main()` DB interval.

2. Severity P0 - The guard must not weaken the live-control boundary. Evidence: repository rules prohibit live server mutation, plaintext exchange secrets, live bot start/stop/apply-config, and non-entitlement access (`AGENTS.md:76`, `AGENTS.md:81`, `AGENTS.md:82`, `AGENTS.md:88`); the safety model keeps all controls disabled until audited and permanently forbids systemd/tmux/process kill, `.env` mutation, exchange order calls, bot API key reads, and bot state resets (`docs/BOT_CONTROL_SAFETY_MODEL.md:15`, `docs/BOT_CONTROL_SAFETY_MODEL.md:17`, `docs/BOT_CONTROL_SAFETY_MODEL.md:35`, `docs/BOT_CONTROL_SAFETY_MODEL.md:42`); adapter control methods throw hard-disabled errors (`packages/bot-adapters/src/control.ts:16`, `packages/bot-adapters/src/http.ts:57`, `packages/bot-adapters/src/legacy/legacy-blocked.ts:89`). Recommendation: do not add or call `startBot`, `stopBot`, `applyConfig`, `systemctl`, `tmux`, SSH, process-kill, exchange ping/order, or `.env` writes in the guard or its tests. Target part: worker imports, scheduler callback, and any follow-up telemetry.

3. Severity P0 - The guard must not expose secrets in logs or retained output. Evidence: current worker operational errors are redacted for bearer/token/key/password-shaped data (`apps/worker/src/index.ts:60`, `apps/worker/src/index.ts:64`, `apps/worker/src/index.ts:231`, `apps/worker/src/index.ts:340`, `apps/worker/src/index.ts:367`, `apps/worker/src/index.ts:484`, `apps/worker/src/index.ts:488`); the overlap warning contains only static text plus numeric `age_ms` and `skipped_while_in_flight` (`apps/worker/src/index.ts:115`, `tests/integration/worker-inflight-guard.test.ts:42`); safe worker acceptance runs through `runRedactedChildProcess` with stdout/stderr captured before forwarding (`scripts/safe-worker-tick.mjs:123`, `scripts/safe-worker-tick.mjs:131`, `scripts/redacted-child-process.mjs:44`, `scripts/redacted-child-process.mjs:78`); redaction tests cover DB URLs, auth headers, cookies, JWT/private-key-like values, Stripe/Axioma/LMS secrets, raw public IP URLs, and retained child output (`tests/integration/child-output-redaction.test.ts:46`, `tests/integration/child-output-redaction.test.ts:75`, `tests/integration/child-output-redaction.test.ts:120`). Recommendation: keep skip logging constant/numeric only and do not interpolate errors, env, DSNs, provider URLs, tokens, raw payloads, or child output into the guard warning. Target part: overlap warning and runner logs.

4. Severity P1 - The guard must not create fake green continuity. Evidence: `NEXT_ACTIONS` explicitly scopes Phase 4.46 to no-env runtime clarity and says not to call providers (`docs/NEXT_ACTIONS.md:52`, `docs/NEXT_ACTIONS.md:54`); worker health is green only when the core worker and both bot outcomes are `ok`, while skipped/not-configured reads become `not_configured`/`attention` (`apps/worker/src/index.ts:175`, `apps/worker/src/index.ts:193`, `tests/integration/worker-health-mapping.test.ts:79`, `tests/integration/worker-health-mapping.test.ts:84`, `tests/integration/two-bot-continuity-contract-static.test.ts:35`, `tests/integration/two-bot-continuity-contract-static.test.ts:46`); admin health marks stale `target='worker'` rows stale even if their stored status is `ok` (`tests/integration/admin-bot-health-loader.test.ts:498`, `tests/integration/admin-bot-health-loader.test.ts:518`), and the static safety test freezes the stale-row UI boundary (`tests/integration/bot-read-safety-static.test.ts:404`, `tests/integration/bot-read-safety-static.test.ts:416`). Recommendation: if skip telemetry is ever persisted, it must be non-green/stale-eligible and must not refresh `target='worker'` as `ok`; current log-only skip behavior is safer for this no-env slice. Target part: worker heartbeat semantics and admin readiness surfaces.

5. Severity P1 - The guard tests should stay no-env/local and must not open managed DB/provider paths. Evidence: safe worker smoke forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false` (`scripts/safe-worker-tick.mjs:107`, `scripts/safe-worker-tick.mjs:109`, `scripts/safe-worker-tick.mjs:110`, `scripts/safe-worker-tick.mjs:111`; also asserted in `tests/integration/db-seed-preview-hardening.test.ts:67`); local bot/admin acceptance refuses managed DB/source/live env and scrubs provider variables such as `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_URL`, `JOURNAL_READ_TOKEN`, and system bot IDs before local proof (`tests/integration/bot-admin-acceptance-runner.test.ts:57`, `tests/integration/bot-admin-acceptance-runner.test.ts:73`, `tests/integration/bot-admin-acceptance-runner.test.ts:102`). Recommendation: keep `tests/integration/worker-inflight-guard.test.ts` as a pure injected-runner contract, and do not fold managed worker continuity, provider URLs, or live read tokens into this phase. Target part: Phase 4.46 test selection and gate list.

6. Severity P2 - Retained evidence should use the redacted safe wrapper, not the raw direct worker tick script. Evidence: root `worker:tick` still maps to `npm run tick -w @wtc/worker` and the workspace tick maps to `tsx src/tick-once.ts` (`package.json:21`, `apps/worker/package.json:9`); `tick-once.ts` top-level catch logs the raw thrown message (`apps/worker/src/tick-once.ts:26`, `apps/worker/src/tick-once.ts:27`), while canonical smoke/continuity scripts use `safe-worker-tick.mjs` (`package.json:22`, `package.json:24`) and its redacted child-process wrapper (`scripts/safe-worker-tick.mjs:123`, `scripts/redacted-child-process.mjs:78`). Recommendation: for this phase's retained proof, prefer `npm run worker:smoke`, focused Vitest, and `npm run accept:worker:continuity` only when scoped DB env is explicitly provided; do not archive raw `worker:tick` output. Target part: acceptance commands and retained logs.

## Decisions
- Treat the current dirty-tree `apps/worker/src/index.ts` guard plus untracked `tests/integration/worker-inflight-guard.test.ts` as the candidate implementation under audit, not as auditor-authored changes.
- Accept the guard shape only if it remains an injected pure runner around the scheduled DB interval and leaves `dbTick()` / one-shot acceptance direct.
- Keep this phase no-env/local unless the operator explicitly supplies throwaway managed DB env in a separate scoped gate.
- Do not add UI controls, provider probes, exchange pings, live bot control, deploy, SSH, systemd, tmux, or DB mutation as part of this safety slice.

## Risks
- The worktree was already heavily dirty before this auditor handoff, including modified worker files and untracked Phase 4 handoffs/tests. This audit did not revert, normalize, or attribute those changes.
- If a future implementer persists overlap skips as fresh `target='worker'` health rows with `status='ok'`, admin/user continuity could look green while the worker is actually stuck. Preserve stale-row safeguards and keep skip rows non-green if persistence is added.
- Direct raw `worker:tick` output remains less safe for retained evidence than the redacted wrapper. Use the safe wrapper for logs that may be stored or shared.

## Verification/tests
- RUN: read-only inspection with `rg`, `Get-Content`, `git status --short --branch`, `git diff -- apps/worker/src/index.ts tests/integration/worker-inflight-guard.test.ts`, and `Test-Path docs/handoffs/20260605-0318-worker-inflight-safety-auditor.md`.
- NOT RUN: Vitest/typecheck/lint/secret scan/governance. Reason: this auditor was scoped to read-only inspection plus one handoff write; no product/test code was changed by this auditor.
- NOT RUN: `npm run worker:smoke`, `npm run accept:worker:continuity`, `npm run accept:worker:continuity:managed`, `npm run accept:bots:local`, Playwright, or rendered/browser gates. Reason: not required for this read-only safety audit; managed gates require explicit throwaway DB env and can mutate DBs.
- NOT RUN: live provider probes, live bot start/stop/apply-config, deploy/canary publish, SSH/systemd/tmux, DB migration/seed, or external secret access. Reason: explicitly forbidden by scope and safety protocol.

## Next actions
1. Keep the implementation bounded to `apps/worker/src/index.ts` scheduler serialization and `tests/integration/worker-inflight-guard.test.ts` pure contract coverage.
2. Run the no-env focused guard test plus existing worker safety tests in the implementation session: `npm test -- tests/integration/worker-inflight-guard.test.ts tests/integration/worker-health-mapping.test.ts tests/integration/two-bot-continuity-contract-static.test.ts tests/integration/child-output-redaction.test.ts`.
3. Run `npm run secret:scan`, root typecheck, and `git diff --check` before claiming the phase green.
4. Do not run managed worker continuity unless `WORKER_CONTINUITY_ADMIN_DATABASE_URL` is explicitly supplied for a fresh throwaway DB; never point it at production/raw persistent URLs or echo DSNs.
5. Aggregate handoff must list this auditor handoff by path and must state exact gates RUN/NOT RUN.
