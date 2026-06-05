# ecosystem-security-auditor handoff
## Scope
Phase 4.39 read-only security audit for safety, RBAC, secret, redaction, and acceptance boundaries around any next Legacy closed-trade source proof or importer work.

This audit did not run live services, did not call providers/exchanges, did not read or print env values, did not mutate a database, did not start/stop/apply bot config, did not kill processes, and did not inspect row data from any live Legacy database. It inspected WTC repo code/docs and existing handoff evidence only.

## Files inspected
- `docs/BOT_CONTROL_SAFETY_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/RBAC_MATRIX.md`
- `docs/AUDIT_LOG_SCHEMA.md`
- `docs/CONTRACTS/legacy-bot-adapter.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md`
- `docs/handoffs/20260604-2000-phase-4-34-data-model-provider-trade-scope.md`
- `docs/handoffs/20260604-2145-local-bot-admin-acceptance-safety-auditor.md`
- `packages/bot-adapters/src/factory.ts`
- `packages/bot-adapters/src/control.ts`
- `packages/bot-adapters/src/warnings.ts`
- `packages/bot-adapters/src/mock-legacy.ts`
- `packages/bot-adapters/src/legacy/legacy-blocked.ts`
- `packages/bot-adapters/src/legacy/legacy-plaintext-exclusion.ts`
- `packages/audit/src/redact.ts`
- `packages/audit/src/audit.ts`
- `packages/db/src/schema.ts`
- `packages/db/src/repositories.ts`
- `packages/db/migrations/0021_complete_pepper_potts.sql`
- `apps/worker/src/legacy-live.ts`
- `apps/worker/src/index.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx`
- `scripts/redacted-child-process.mjs`
- `scripts/safe-worker-tick.mjs`
- `scripts/run-admin-user-bot-detail-e2e.mjs`
- `scripts/run-admin-user-bot-detail-e2e-managed.mjs`
- `scripts/prepare-admin-user-bot-detail-e2e.ts`
- `playwright.admin-user-bots-db.config.ts`
- `tests/integration/legacy-provider-worker.test.ts`
- `tests/integration/worker-tortila-snapshot.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
`docs/handoffs/20260604-2245-legacy-closed-trade-source-safety-auditor.md` only.

## Findings
1. Severity P1 - Legacy closed-trade import remains source-blocked; WTC destination readiness is not source proof. Evidence: Phase 4.31 says the local Legacy source lacks realized PnL, fees, funding, trade-level opened/closed timestamps, and stable fill identity (`docs/handoffs/20260604-1918-phase-4-31-legacy-closed-trade-source-audit.md:57`), and current worker snapshot rows only cover accounts, settings, stages, active slots, and active orders (`apps/worker/src/legacy-live.ts:32-92`, `apps/worker/src/legacy-live.ts:319-381`). Recommendation: require a source-proof artifact before implementation: repo-local model/migration, upstream contract/PR, or operator-approved metadata-only provider schema handoff that names the safe table/API and required fields. Target part: Legacy closed-trade source proof.

2. Severity P1 - Inactive Legacy slots/orders must not be used as closed-trade economics or PnL evidence. Evidence: Legacy contract states active slots are only a proxy for open positions and bot intent, not confirmed exchange state (`docs/CONTRACTS/legacy-bot-adapter.md:271-288`), and states no closed-trade history is available through the Legacy adapter/API (`docs/CONTRACTS/legacy-bot-adapter.md:293-314`). Recommendation: reject any source proof based only on inactive orders, closed slots, active-order summaries, or balance deltas; require stable external trade/fill id, symbol, side, size, entry, exit, realized PnL, fees, funding policy, opened/closed timestamps, exit reason, replay semantics, and raw payload allowlist. Target part: importer source mapper.

3. Severity P1 - Live control, shell/process-manager control, exchange actions, and direct bot-state mutation remain forbidden during source proof/importer work. Evidence: control methods remain disabled until gates pass (`docs/BOT_CONTROL_SAFETY_MODEL.md:17-24`), permanent prohibitions include SSH, systemctl/service, tmux/screen, process kill, `.env` mutation, exchange order calls, exchange-key reads, bot DB clearing, and direct config overwrites (`docs/BOT_CONTROL_SAFETY_MODEL.md:28-43`), and the current action table still forbids `/api/marks`, bot config writes, start/stop, SSH/systemd/tmux, exchange orders, and key reads (`docs/BOT_CONTROL_SAFETY_MODEL.md:255-267`). Recommendation: future source proof may inspect repo/local metadata or operator-approved schema metadata only; it must not start/stop/restart bots, apply config, ping exchanges, query live exchange history, mutate provider/WTC DBs, or use shell/process-manager controls. Target part: operator/runbook and importer acceptance.

4. Severity P1 - Legacy HTTP `/api_management` must stay blocked for source proof because it is the plaintext-key risk path. Evidence: the blocked adapter documents that WTC must not issue real HTTP requests to Legacy until the upstream plaintext-key fix and all gates are cleared (`packages/bot-adapters/src/legacy/legacy-blocked.ts:1-16`), the factory routes every non-mock Legacy mode to the blocked adapter and ignores `legacyBaseUrl` (`packages/bot-adapters/src/factory.ts:32-39`), and the contract says the old HTTP adapter is deleted with no env/config path to reach Legacy (`docs/CONTRACTS/legacy-bot-adapter.md:399-409`). Recommendation: do not use the Legacy HTTP management API for closed-trade discovery; prefer an upstream safe read-only summary/table or metadata-only provider schema proof with explicit secret exclusion. Target part: Legacy adapter/source integration.

5. Severity P1 - RBAC and entitlement boundaries are required before any user/admin importer surface can claim data. Evidence: all bot routes require authenticated session plus active product entitlement (`docs/RBAC_MATRIX.md:112-147`), admin routes require admin role and audit for mutations while support is read-only (`docs/RBAC_MATRIX.md:226-240`), provider-account mapping actions enforce `requireUser`, `assertAdmin`, CSRF, validation, DB-backed mutation, actor id, reason, and audit-path revalidation (`apps/web/src/features/admin/actions.ts:354-390`, `apps/web/src/features/admin/actions.ts:397-426`), and selected-user admin stats are scoped by WTC `botProviderAccountId` for Legacy (`apps/web/src/features/admin/user-bot-detail-loader.ts:875-925`). Recommendation: any importer UI or admin acceptance route must enforce session, entitlement, provider mapping, admin-only mutation, CSRF, reason, and in-transaction audit; support/read-only views must not expose mutation controls or unscoped Legacy runtime rows. Target part: web/admin RBAC.

6. Severity P1 - Provider-scoped import must use WTC `bot_provider_accounts.id`, not raw Legacy `pub_id`, as the durable scope key. Evidence: `bot_trade_imports` contains nullable `bot_provider_account_id` plus required external trade economics fields (`packages/db/src/schema.ts:564-585`), unique indexes split scoped and unscoped imports (`packages/db/src/schema.ts:588-596`, `packages/db/migrations/0021_complete_pepper_potts.sql:1-3`), and `importBotTrade()` selects the conflict target based on WTC `botProviderAccountId` and audits only `externalTradeId`, `sourceAdapter`, and `botProviderAccountId` (`packages/db/src/repositories.ts:2234-2267`). Recommendation: future Legacy importer must pass `botProviderAccountId: providerAccount.id`, include a two-provider same-external-id replay test, and keep raw provider ids out of audit rows and user-visible importer evidence except for explicitly authorized admin ops identity views. Target part: DB/import idempotency and audit metadata.

7. Severity P1 - Secret redaction must be enforced before rows, logs, audit events, or retained artifacts are written. Evidence: worker safe text scrubs password/secret/token/key and Bearer patterns (`apps/worker/src/legacy-live.ts:113-123`), selected Legacy DB rows are rejected if secret-looking fields are selected (`apps/worker/src/legacy-live.ts:143-147`, `apps/worker/src/legacy-live.ts:382-386`), audit redaction blocks secret/key/token/credential fields and secret-looking values (`packages/audit/src/redact.ts:12-36`, `packages/audit/src/redact.ts:45-78`), and redacted child process output masks DB URLs, secret assignments, provider URLs, credentials, auth headers, cookies, JWTs, Stripe secrets, and private keys before forwarding stdout/stderr (`scripts/redacted-child-process.mjs:6-18`, `scripts/redacted-child-process.mjs:44-82`). Recommendation: any source-proof/importer script must use an explicit field allowlist plus `isLegacySecretField()`/audit redaction checks, use `runRedactedChildProcess` for child commands, avoid `stdio: inherit`, and never archive raw env dumps, full URLs, provider endpoints, cookies, traces, or unreviewed screenshots. Target part: logs, audit payloads, test artifacts, worker mapper.

8. Severity P1 - Legacy user-facing PnL, win rate, profit factor, and attribution claims must remain pending until source-backed imports exist and rendered proof passes. Evidence: current Legacy metrics store wallet equity but set closed PnL, win rate, profit factor, fees, funding, and related fields unavailable with `tradeCount: 0` (`apps/worker/src/legacy-live.ts:416-431`), UI shows `pending import` and a warning that win rate, profit factor, realized PnL, and attribution stay hidden until imports exist (`apps/web/src/features/bots/statistics-panels.tsx:587-609`), the command center forces Legacy PnL to `closed trade imports pending` (`apps/web/src/app/(app)/app/bots/statistics/page.tsx:456-481`), and the trades page states no closed-trade endpoint means trade analytics are not fabricated (`apps/web/src/app/(app)/app/bots/[bot]/trades/page.tsx:51-58`). Recommendation: do not replace pending/N/A labels with numeric performance claims until provider-scoped imported rows exist from a proven source and rendered desktop/mobile user plus admin pages show both pending and loaded branches without leaks. Target part: product/statistics UI.

9. Severity P1 - Acceptance runners must not blur local mock proof, managed throwaway DB proof, and live/provider proof. Evidence: `safe-worker-tick` documents memory-demo vs DB continuity profiles and forces `APP_ENV=development`, `BOT_ADAPTER_MODE=mock`, `FEATURE_LIVE_BOT_CONTROL=false`, and `FEATURE_TV_AUTOMATION=false` (`scripts/safe-worker-tick.mjs:24-34`, `scripts/safe-worker-tick.mjs:107-125`, `scripts/safe-worker-tick.mjs:139-155`); admin-user DB e2e requires a throwaway DB, guarded prep token, mock adapter, live-control off, TV automation off, and reviewed/scanner-clean artifact handling (`scripts/run-admin-user-bot-detail-e2e.mjs:7-13`, `scripts/run-admin-user-bot-detail-e2e.mjs:25-39`, `scripts/run-admin-user-bot-detail-e2e.mjs:75-76`, `playwright.admin-user-bots-db.config.ts:14-30`, `playwright.admin-user-bots-db.config.ts:49-70`). Recommendation: importer acceptance must label gates as LOCAL MOCK, MANAGED THROWAWAY DB, or LIVE/PROVIDER SOURCE PROOF; local/mock proof cannot green-light live import, provider DB access, or UI PnL claims. Target part: acceptance reporting and package scripts.

10. Severity P2 - Current worker health has Legacy snapshot counters but no Legacy closed-trade importer counters, which is correct now but must change if an importer is added. Evidence: worker result fields track Legacy accounts/settings/positions/provider-scope only (`apps/worker/src/index.ts:195-202`), Legacy worker orchestration logs accounts/settings/positions only (`apps/worker/src/index.ts:263-279`), while Tortila tests already prove closed-trade import/audit idempotency (`tests/integration/worker-tortila-snapshot.test.ts:58-76`). Recommendation: once source proof lands and the mapper imports rows, extend Legacy result and health details with `tradesSeen` and `tradesImported`, and verify replay inserts zero duplicates while keeping health output redacted. Target part: worker observability.

11. Severity P2 - Raw `pub_id` is operational identity, not exchange secret, but it still needs scope discipline. Evidence: selected-user summaries mask provider account ids (`apps/web/src/features/admin/user-bot-detail-loader.ts:799-810`), selected-user stats filter by WTC provider-account id (`apps/web/src/features/admin/user-bot-detail-loader.ts:875-925`), admin fleet ops can render raw `pub_id` in its inspector (`apps/web/src/app/admin/bots/page.tsx:696-723`), and admin global config explicitly forbids provider ids, raw live config, active slots/orders, DB URLs, live-control fields, and secrets in saved system defaults (`apps/web/src/features/admin/actions.ts:431-492`). Recommendation: keep raw `pub_id` restricted to existing admin ops/source-filter contexts; importer audit rows, user views, retained artifacts, and global configs should use WTC ids, masked labels, or counts unless a separate admin-only operational view explicitly authorizes raw identity. Target part: provider identity privacy boundary.

## Decisions
- Safe allowed actions for the next source-proof phase: read repo/local-source files, inspect WTC docs/code/tests, inspect a Legacy upstream PR/contract, or run an operator-approved metadata-only schema query that returns table/column names and constraints only, with no row data and no secrets.
- Safe allowed implementation actions after source proof: add a fixture-backed mapper in `apps/worker/src/legacy-live.ts`, call `importBotTrade()` with WTC `botProviderAccountId`, add provider-scoped replay tests, add redacted worker counters, and update UI/tests from pending to loaded branches only for proven imported rows.
- Forbidden actions remain: live bot start/stop/apply-config/retest, SSH/systemd/tmux/screen/process kill, `.env` mutation, exchange order/cancel/close or history calls from WTC, Legacy HTTP `/api_management` probing, raw env/secret reads, provider DB row dumps, unredacted child output, and DB mutation outside explicitly approved throwaway/managed scopes.
- Redaction rule: over-redact. Never print/copy env values, DSNs, tokens, cookies, provider endpoints, exchange keys, private URLs, raw provider payloads, or unreviewed browser artifacts. Audit `after` payloads should contain metadata only.
- Acceptance rule: no live import and no UI PnL/performance claim until source proof plus fixture mapper plus replay/idempotency tests plus redaction/secret scan plus rendered user/admin statistics evidence are all green in the same phase.

## Risks
- A destination schema and import repository can be mistaken for proof that Legacy can produce closed-trade rows. It cannot.
- Inactive orders/slots can look like historical state, but they lack trade-level economics and can fabricate PnL/win-rate analytics.
- Parent shells may contain DB URLs or bot/provider env vars; local acceptance scripts must scrub/override them or refuse.
- Raw `pub_id` is useful operationally but can become cross-user attribution leakage if rendered outside scoped admin contexts.
- Browser traces/screenshots on failed DB e2e can retain fixture identifiers or page text; artifact review/scanning is required before archive.

## Verification/tests
RUN:
- `git status --short --branch` - observed dirty branch `codex/bot-analytics-settings-canary-20260603` with many pre-existing modifications/untracked handoffs before this audit.
- `Test-Path docs/handoffs/20260604-2245-legacy-closed-trade-source-safety-auditor.md` - returned `False` before writing.
- Read-only `rg`/line-range inspection of docs, adapters, worker, DB schema/repositories, admin/user surfaces, scripts, and tests listed above.

NOT RUN:
- `npm test`, focused Vitest, typecheck, lint, build, `secret:scan`, and governance - not run because this phase made no code/test/schema changes and was a read-only audit plus handoff.
- `npm run db:migrate`, managed worker continuity, admin-user DB Playwright matrix, preview/e2e, live provider/exchange probes, live bot control, SSH/tmux/systemd, deploy, production monitoring - not run by explicit safety scope.
- Any raw env/secret inspection, provider DB row query, provider call, exchange call, bot start/stop/apply, process kill, or DB mutation - not run by instruction and policy.

## Next actions
1. Before any Legacy closed-trade importer work, obtain one source-proof artifact naming the source table/API, provider filter, durable external trade/fill id, economics fields, timestamps, exit reason, replay semantics, and raw payload allowlist.
2. If source proof is repo/upstream only, implement the smallest fixture-backed mapper and tests first; do not run live import.
3. If source proof requires provider DB metadata, run a separate operator-approved metadata-only discovery phase that returns schema/constraints only, redacts output, and writes its own handoff.
4. After mapper implementation, required acceptance: provider-scoped same-external-id replay test, no secret/raw provider id leaks, worker typecheck, root typecheck, `npm run secret:scan`, governance, and rendered user/admin statistics proof showing pending and loaded states accurately.
