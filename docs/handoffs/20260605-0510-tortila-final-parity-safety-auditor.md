# ecosystem-bot-integration-auditor handoff

## Scope
Phase 4.51 read-only integration/safety audit for Tortila final parity. Scope was limited to static/source inspection of WTC Tortila contracts, adapter mappings, worker snapshot/continuity paths, bot statistics/readiness loaders, admin selected-user isolation, and the local Tortila source journal/safety surfaces.

This handoff does not claim a broad N-agent phase audit. It is the single requested read-only auditor lane. No code, env, database, browser, live journal, exchange, provider, or bot-control probe was run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0500-phase-4-50-admin-source-proof-rendered-acceptance.md`
- `docs/CONTRACTS/tortila-adapter.md`
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/http.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/types.ts`
- `packages/bot-adapters/src/tortila/tortila.mapping.ts`
- `packages/bot-adapters/src/adapters.test.ts`
- `packages/bot-adapters/src/__tests__/getHealth-states.test.ts`
- `packages/bot-adapters/src/__tests__/tortila-mapping.test.ts`
- `apps/worker/src/index.ts`
- `apps/worker/src/jobs.ts`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-worker-continuity-managed.mjs`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/integration/worker-continuity-acceptance-runner.test.ts`
- `apps/web/src/lib/server-config.ts`
- `apps/web/src/lib/backend.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/journal.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/e2e/bot-statistics.spec.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/journal/app.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/journal/metrics.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/state/models.py`
- `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/engine/orchestrator.py`

## Files changed
None - read-only audit. Required handoff written: `docs/handoffs/20260605-0510-tortila-final-parity-safety-auditor.md`.

## Findings
1. Severity P1 - Local worker continuity acceptance still proves Tortila mock continuity, not real Tortila journal continuity. Evidence: `scripts/safe-worker-tick.mjs:107-112` forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, and disables live control/TV automation; `scripts/run-worker-continuity-managed.mjs:20-29` states the managed runner proves Tortila mock plus Legacy fixture DB snapshots; `scripts/run-worker-continuity-managed.mjs:274-290` clears `TORTILA_JOURNAL_URL`, `TORTILA_JOURNAL_BASE_URL`, and `JOURNAL_READ_TOKEN`; `tests/integration/worker-tortila-snapshot.test.ts:135-169` proves read-only mode without token records health-only, makes no fetch, and writes no metric/position/trade rows. Recommendation: before calling Tortila locally finished, add/run a separate real read-only Tortila journal continuity gate that requires `sourceAdapter=tortila`, `tortilaReadState=ok`, metrics/positions/trades counts, and redacted output; keep the existing mock runner as fixture continuity only. Target part: runtime acceptance/worker continuity.
2. Severity P1 - Tortila real-read activation is intentionally fail-closed but source auth/firewall remains a production/read-only blocker. Evidence: `docs/CONTRACTS/tortila-adapter.md:31-45` says the current journal has no auth and requires token auth plus network restriction before production WTC deployment; the local Tortila journal source exposes FastAPI routes without `Authorization`, `Bearer`, `Header`, or dependency auth hits in `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/journal/app.py:572-913`; WTC real adapter refuses unauthenticated reads at `packages/bot-adapters/src/http.ts:93-98` and reports `readState=not_configured` at `packages/bot-adapters/src/http.ts:154-156`. Recommendation: do not mark real Tortila read-only complete until the source journal enforces bearer auth and the WTC gate proves authenticated, redacted reads only. Target part: journal ingress/security boundary.
3. Severity P1 - Tortila provider/account identity is not yet modeled the same way as Legacy; current WTC scoping is bot-instance-only. Evidence: DB schema supports `bot_provider_accounts` with provider `tortila-journal` at `packages/db/src/schema.ts:146-174` and provider-scoped snapshot/import columns at `packages/db/src/schema.ts:509-598`; the worker writes Tortila metric/position/trade rows without `botProviderAccountId` at `apps/worker/src/jobs.ts:190-257`; the user dashboard only applies provider mapping to Legacy at `apps/web/src/features/bots/data.tsx:455-496`; admin selected-user filtering returns true for all non-Legacy rows at `apps/web/src/features/admin/user-bot-detail-loader.ts:875-899`. Recommendation: either document and test the invariant "one Tortila journal runtime per WTC bot_instance" with ownership bootstrap proof, or implement active `tortila-journal` provider mapping plus scoped worker writes before final parity. Target part: admin/user isolation and source identity.
4. Severity P1 - Tortila source config provenance is not real-source-proofed. Evidence: contract tracks `GET /api/config` JSON as P1 at `docs/CONTRACTS/tortila-adapter.md:526-534`; the real adapter `getConfig()` throws `AdapterNotReadyError` because the journal has no JSON config endpoint at `packages/bot-adapters/src/http.ts:181-184`; real adapter `validateConfig()` is not implemented at `packages/bot-adapters/src/http.ts:274-276`; selected-user admin has a built-in Tortila config fallback at `apps/web/src/features/admin/user-bot-detail-loader.ts:529-543`; worker metric `rawJson` only persists adapter/source/health/readState/warnings at `apps/worker/src/jobs.ts:206-213`. Recommendation: expose and ingest a sanitized source-config snapshot, or label all Tortila config display as WTC reference/default config rather than source-proven runtime config. Target part: source provenance/config parity.
5. Severity P1 - Runtime warning provenance is incomplete for real Tortila safety signals. Evidence: persistent Tortila warnings always surface until cleared at `packages/bot-adapters/src/warnings.ts:33-47`; signal warnings for TP rejection, rate limit, exchange-flat mismatch, and fill lookup exist at `packages/bot-adapters/src/warnings.ts:49-57`; the real adapter currently returns only `TORTILA_PERSISTENT_WARNINGS` and says signal warnings will be derived once a journal logs endpoint is confirmed at `packages/bot-adapters/src/http.ts:128-131`; the Tortila source has `/api/activity` with safety events at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/journal/app.py:809-841`, but WTC does not consume it. Recommendation: add audited read-only ingestion of activity/safety events or expose "not evaluated" for signal warnings; do not treat missing signal warnings as an all-clear. Target part: safety signal provenance.
6. Severity P1 - TP/margin safety should remain non-green until machine-readable source resolution exists. Evidence: WTC always reports degraded health while P0/P1 are unresolved at `packages/bot-adapters/src/tortila/tortila.mapping.ts:33-53`; the contract requires `tp_reconcile_ok` as a P0 journal state key before clearing the TP warning at `docs/CONTRACTS/tortila-adapter.md:531-536`; Tortila source now has TP verification/replacement paths at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/engine/orchestrator.py:1004-1108`, but WTC does not ingest a resolution key; margin pre-flight blocks when margin data is available, but on `fetch_free_margin` failure it logs and proceeds without the gate at `C:/Users/maxib/GTE BOT/bot_tortila/src/turtle_bot/engine/orchestrator.py:514-545`. Recommendation: keep `tp_reconcile_p0` and `margin_preflight_p1` visible until the journal exposes explicit resolution/state and WTC tests prove warning-clearing logic. Target part: runtime safety readiness.
7. Severity P2 - `/api/marks` is correctly excluded in code, but the contract still contains conflicting endpoint/rate-limit language. Evidence: contract required-endpoints table lists `/api/marks` at `docs/CONTRACTS/tortila-adapter.md:53-63`; the same contract later says "NEVER CONSUME FROM WTC" and marks/unrealized are unavailable at `docs/CONTRACTS/tortila-adapter.md:250-263`; rate-limit guidance still says WTC must not poll marks faster than 30 seconds and recommends `/api/marks` polling at `docs/CONTRACTS/tortila-adapter.md:421-436`; code comments and mappings prohibit marks at `packages/bot-adapters/src/http.ts:1-10` and `packages/bot-adapters/src/tortila/tortila.mapping.ts:151-183`. Recommendation: revise the contract so `/api/marks` appears only as an excluded source endpoint, and add a UI/DB assertion that persisted `unrealizedPnlUsd=0` from unavailable mark data is never rendered as real PnL. Target part: contract clarity and UI truth.
8. Severity P2 - Statistics readiness copy can overstate the data path in DB snapshot mode. Evidence: production/non-mock dashboard requires user-scoped DB snapshots and will not fall back to global adapter reads at `apps/web/src/features/bots/data.tsx:304-310` and `apps/web/src/features/bots/data.tsx:719-737`; if snapshots are missing it returns an explicit scoped snapshot issue at `apps/web/src/features/bots/data.tsx:538-551`; readiness copy currently says Tortila statistics are rendered from read-only adapter data at `apps/web/src/features/bots/readiness.ts:219-230`. Recommendation: adjust copy to "read-only worker snapshots from the Tortila journal" once edits are in scope, so users do not confuse browser-side adapter fetches with persisted worker provenance. Target part: product-facing provenance copy.
9. Severity P3 - No new live-control boundary gap found in this read-only audit. Evidence: control gate remains hard-disabled in `packages/bot-adapters/src/control.ts:1-18`; worker safety state is ok only when live control and TV automation are disabled at `apps/worker/src/index.ts:151-163`; `apps/worker/src/jobs.ts:9-15` documents read-only snapshots, no `/api/marks`, and caught adapter failures; readiness exchange-key checks are metadata-only and explicitly no live exchange ping at `apps/web/src/features/bots/readiness.ts:145-174`; DB exchange-key summaries select counts/masks/metadata and mark `livePing:false` at `packages/db/src/repositories.ts:416-446`. Recommendation: keep live bot start/stop/apply-config and exchange ping out of Tortila final-local parity unless a separate audited phase authorizes and verifies them. Target part: safety/no-live-control boundary.

## Decisions
1. Treated the present request as a single read-only auditor handoff, not a broad implementation phase or aggregate multi-agent audit.
2. Did not run env-managed DB/browser gates because Phase 4.50 already recorded the relevant env as missing and this audit was explicitly read-only/no live probes.
3. Did not inspect `.env` or any secret-bearing runtime values in `bot_tortila`; source inspection was limited to code, docs, and static endpoint definitions.
4. Classified existing WTC no-control/no-marks behavior as a positive safety boundary, while keeping real-source parity blocked by proof gaps.
5. Considered Tortila final-local parity not ready to call complete until a real read-only journal continuity gate and source-proven config/safety provenance are green.

## Risks
1. A mock continuity pass can be mistaken for real Tortila parity because current managed worker acceptance intentionally clears journal URL/token and runs mock.
2. Admin selected-user isolation is safe for one Tortila runtime per bot instance, but not proven for multiple Tortila provider identities unless the invariant is documented/tested or provider scoping is implemented.
3. Persisted Tortila `markPrice=entry` and `unrealizedPnl=0` placeholders can become misleading if any UI treats them as live mark-derived values.
4. Source-side TP and margin improvements exist in code but WTC has no machine-readable source proof to clear warnings, so local finality would be premature.
5. Journal auth/firewall requirements are unresolved from the WTC contract perspective; without them, real reads must remain local/dev-only and fail-closed in WTC.

## Verification/tests
RUN:
1. `git status --short --branch` - observed existing dirty branch/worktree before audit; no pre-existing changes were reverted.
2. Static repository inspection of contracts, adapter code, worker jobs, web loaders, DB schema/repositories, and existing tests listed above.
3. Static source inspection of Tortila journal/orchestrator files under `C:/Users/maxib/GTE BOT/bot_tortila`, excluding env files and live runtime data.
4. Confirmed requested handoff path did not already exist before writing it.

NOT RUN:
1. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; env-managed DB/browser gate was out of scope and Phase 4.50 recorded missing admin DB env.
2. `npm run accept:worker:continuity:managed` - not run; managed worker continuity requires env-managed DB and currently proves mock Tortila/fixture Legacy, not real Tortila journal.
3. Real Tortila journal read-only fetches - not run; no live probes and no token/env values in scope.
4. Tortila `/api/marks` or exchange ping - not run; endpoint is excluded and live exchange probes are forbidden for this audit.
5. Live bot start/stop/apply-config - not run; live control is explicitly out of scope and remains hard-disabled.
6. Browser/rendered tests - not run; audit was static/read-only and Phase 4.50 already recorded browser DB gates blocked by missing env.
7. Full typecheck/test/secret scan/governance - not run; no code was changed and this request asked for a read-only handoff.

## Next actions
1. Add a separate real Tortila journal read-only continuity acceptance gate that is distinct from mock worker continuity and proves `sourceAdapter=tortila`, `readState=ok`, metrics/positions/trades import, redaction, and no `/api/marks`.
2. Decide and document Tortila identity scope: one journal runtime per WTC bot instance, or implement `tortila-journal` provider mapping and scoped worker snapshot/import writes.
3. Implement a sanitized source config endpoint/snapshot or relabel Tortila config surfaces as WTC defaults/reference only.
4. Ingest source safety/activity signals or expose them as "not evaluated" instead of silently omitting real signal warnings.
5. Keep P0/P1 warnings until `tp_reconcile_ok` and margin pre-flight source resolution are machine-readable and covered by tests.
6. Clean the Tortila contract so `/api/marks` is consistently documented as excluded from WTC, not a required/polled endpoint.
7. Once env is supplied, run the managed DB/browser/worker gates and artifact scans without printing secrets or live-control outputs.
