# bot-next-completion-security-auditor handoff
## Scope
Read-only Phase 4.24 security/runtime audit for the next WTC bot-completion implementation slice.

Focus areas inspected:
- User setup/settings paths toward adding keys, checking key readiness, saving config, exporting config, and opening the dashboard.
- Config action/export guardrails for no live start/stop/apply-config and no secret/provider-id leakage.
- Worker continuity and runtime proof paths for honest status without stopping or mutating live bots.
- Legacy provider `pub_id` handling across worker snapshots, user/admin read models, and export.

No live/provider/worker mutation commands were run. No preview, Playwright browser, DB mutation, SSH, systemd, tmux, exchange, provider, or worker tick command was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1517-phase-4-20-bot-export-browser-failclosed.md`
- `docs/handoffs/20260604-1549-phase-4-21-bot-settings-basic-path.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `docs/handoffs/20260604-1637-phase-4-23-admin-bot-owner-selector.md`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/config-action-handler.ts`
- `apps/web/src/features/bots/config-export.ts`
- `apps/web/src/features/bots/config-export-handler.ts`
- `apps/web/src/features/bots/runtime-config-sanitizer.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/lib/db-store.ts`
- `apps/web/src/lib/demo.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/tick-once.ts`
- `scripts/safe-worker-tick.mjs`
- `package.json`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/index.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/shared/src/schemas.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-route-handler.test.ts`
- `tests/integration/bot-runtime-config-sanitizer.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/legacy-provider-worker.test.ts`

## Files changed
None - read-only audit. This handoff file is the only written artifact.

## Findings
1. Severity P1 - Worker continuity acceptance is safe but not sufficient for real-runtime proof if run through the current package script. Evidence: `package.json:23` maps `accept:worker:continuity` to `node scripts/safe-worker-tick.mjs --require-db`, while `scripts/safe-worker-tick.mjs:9-14` forcibly sets `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false`; `apps/worker/src/tick-once.ts:22-23` prints DB tick result but does not override that forced mock mode. Recommendation: next slice may use this as a safety/DB pipeline gate only; any claim of real Tortila/Legacy runtime continuity must use a separate read-only, no-live-control gate that explicitly proves `BOT_ADAPTER_MODE=read-only` or Legacy DB reads with redacted output and does not stop/restart the worker. Target part: worker continuity proof.

2. Severity P1 - Key readiness is correctly metadata-only today; the next "test keys" UX must not relabel this as exchange connectivity. Evidence: setup collects `apiKey`/`apiSecret` and mode at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:123-131` and `:425-437`; the readiness action calls `recordExchangeKeyMetadataCheck` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:135-150` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:172-187`; the DB repository selects only owned account and secret-row ids, not sealed payloads, at `packages/db/src/repositories.ts:449-480`; the UI keeps "Run read-only exchange ping (future)" disabled at `apps/web/src/features/bots/ExchangeKeyReadiness.tsx:117-130`. Recommendation: next implementation should preserve the current "Check WTC vault readiness" wording or introduce a separate disabled/feature-gated live exchange ping lane; do not make the Start path depend on a live ping until security plus bot-integration audits approve the adapter. Target part: key readiness/start preflight UX.

3. Severity P1 - Live start/stop/apply-config remains disabled in inspected code, so the next slice should add Start/test affordances only as disabled/review gates, not adapter calls. Evidence: config action form keys deny `applyConfig`, `startBot`, `stopBot`, `start`, `stop`, `restart`, and exchange-control terms at `apps/web/src/features/bots/config-action-handler.ts:51-86`; setup/settings save and preset actions route only to WTC config persistence at `apps/web/src/features/bots/config-action-handler.ts:159-230`; adapter control throws unless both feature flag and audit approval pass at `packages/bot-adapters/src/control.ts:16-18`; Tortila HTTP adapter control methods call `assertBotControlAllowed(..., false, false)` at `packages/bot-adapters/src/http.ts:57-72`; the adapter factory keeps Legacy non-mock on the blocked adapter at `packages/bot-adapters/src/factory.ts:32-39`. Recommendation: the next user-facing Start button should be a readiness/review surface that explains missing gates and links to setup/safety, while the actual server action/route remains absent until the separate audit phase. Target part: bot Start/apply boundary.

4. Severity P1 - Legacy raw provider identifiers are still stored inside worker snapshot `rawJson.liveConfig`; UI/export paths mask or strip them, but the next slice must guard every new user/admin surface against accidentally serializing raw runtime config. Evidence: worker builds `providerAccounts[].pubId`, `symbolConfigs[].providerPubId`, `activeSlots[].providerPubId`, and `activeOrderSummary[].providerPubId` at `apps/worker/src/legacy-live.ts:234-276`, then persists that config under metric `rawJson.liveConfig` at `apps/worker/src/legacy-live.ts:416-448`; user read model routes runtime config through `buildSafeRuntimeConfigView` at `apps/web/src/features/bots/data.tsx:633-637`; sanitizer masks/removes provider identity and secret/control keys at `apps/web/src/features/bots/runtime-config-sanitizer.ts:3-37` and `:72-95`; admin fleet loader masks pub_ids before returning view rows at `apps/web/src/features/admin/bot-health-loader.ts:317-360`; export removes `providerPubId` from Legacy symbol configs at `apps/web/src/features/bots/config-export.ts:224-230`. Recommendation: before adding any new Start/readiness/admin proof panel, add static and rendered assertions that raw `pubId`, `providerPubId`, `providerAccountId`, and `rawJson.liveConfig` do not appear in HTML, JSON route responses, retained screenshots, logs, or handoffs. Target part: provider identity leak boundary.

5. Severity P2 - Runtime proof panel logic is honest, but settings/setup pages intentionally use unchecked continuity when they do not fetch runtime evidence; next slice should keep the "Open dashboard/safety for worker-backed proof" distinction. Evidence: settings uses `uncheckedBotContinuityHealth` when runtime proof is not loaded at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:253-258`; setup does the same at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:252-256`; continuity only becomes `proven` when real non-mock health is fresh, processAlive is true, no warnings are active, and readState is `ok` at `apps/web/src/features/bots/continuity.ts:57-70`. Recommendation: if adding a "ready to start" aggregate, compute it from the stricter dashboard/safety worker proof, not from settings/setup row counts. Target part: readiness aggregation.

6. Severity P2 - Worker runtime errors are captured without killing the long-running worker, which is the right acceptance behavior and should be preserved. Evidence: Tortila snapshot errors are caught and logged as "tick continues" at `apps/worker/src/index.ts:253-258`; Legacy snapshot errors are caught similarly at `apps/worker/src/index.ts:280-285`; the interval catches DB tick failures instead of exiting at `apps/worker/src/index.ts:398-401`; snapshot helpers record health errors and return instead of crashing at `apps/worker/src/jobs.ts:287-308`. Recommendation: next proof gates should assert worker health rows and logs, not prove safety by stopping/restarting the worker process. Target part: worker continuity acceptance.

## Decisions
- Treated this as one read-only per-agent auditor handoff, not a broad multi-agent implementation phase. No background agents were launched from this lane; no "N-agent audit" claim is made.
- Did not run any live/provider/worker mutation commands, including worker tick, exchange ping, provider reads, SSH, tmux, systemd, DB migration/seed, preview deploy, or Playwright.
- Considered current Start/test-key direction acceptable only if the next slice keeps "test keys" as WTC vault metadata readiness and keeps real exchange ping plus start/apply disabled until a separate approved audit.
- Treated masked provider IDs as acceptable display evidence only when raw values are not serialized to user/admin HTML, route responses, retained artifacts, logs, or handoffs.

## Risks
- The repository was already heavily dirty before this audit; this handoff does not certify the whole working tree or prior untracked phase files.
- Because no tests were run in this read-only audit, all gate status below is NOT RUN unless explicitly listed as inspection-only.
- The current worker acceptance script is safety-biased and mock-forced; it cannot be used as evidence that a real journal/provider read path is currently green.
- Legacy DB snapshots legitimately need provider IDs internally for scoping, but any new UI/API proof surface could leak raw IDs if it bypasses existing mask/sanitize helpers.
- The next implementation slice can easily over-promise if "Start" means "ready review" in UI but appears as actual live bot control; copy, disabled states, and tests must keep that boundary crisp.

## Verification/tests
RUN:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a heavily dirty pre-existing worktree.
- Read-only source/doc inspection only.

NOT RUN:
- `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm run lint`, `npm test`, focused Vitest, Playwright, `node scripts/gates.mjs quick|full`, `npm run secret:scan`, `npm run governance:check` - not run by read-only audit scope.
- `npm run worker:smoke` and `npm run accept:worker:continuity` - not run because the user forbade worker mutation commands; additionally, current `accept:worker:continuity` is mock-forced and should not be treated as real-runtime proof.
- `npm run db:generate`, `npm run db:migrate`, `npm run db:seed` - not run by scope and no DB mutation rule.
- Live bot start/stop/apply-config, live exchange ping, provider calls, Legacy DB live read, Tortila journal read, SSH, tmux, systemd, deploy, or worker restart - not run by safety policy and user instruction.

## Next actions
1. Build the next user-facing "Start readiness" slice as a disabled/review surface: show required gates, key metadata state, config source, worker proof state, and why live start/apply remains disabled.
2. Keep `Check WTC vault readiness` as metadata-only; add a separate disabled "read-only exchange ping" lane only if the adapter audit approves it.
3. Add static and browser assertions that Start/readiness/export/admin proof surfaces do not expose raw `pubId`, `providerPubId`, `providerAccountId`, `rawJson`, API keys, sealed vault blobs, bearer tokens, or env URLs.
4. Add a real-runtime read-only continuity gate separate from `scripts/safe-worker-tick.mjs`, with `FEATURE_LIVE_BOT_CONTROL=false`, no worker stop/restart, redacted output, and explicit PASS/NOT RUN reporting.
5. Do not enable live start/stop/apply-config until a separate security plus bot-integration phase approves adapter behavior, audit logging, RBAC/entitlement checks, and rollback semantics.
