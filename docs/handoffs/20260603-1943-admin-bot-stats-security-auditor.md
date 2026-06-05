# ecosystem-security-auditor handoff
## Scope
Phase 3.75 admin user bot statistics drilldown security audit for read-only positions, trades, and equity panels under `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Audit requirements checked: target-user scoping, Legacy provider mapping scoping, masked provider ids, no `rawJson` / secrets / API keys / tokens in admin DTOs or UI, no mutation forms, no live probes, and no user setting edits.

No product code edits, no live bot probes, no SSH/tmux/systemd/exchange checks, and no runtime mutation were performed.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1935-phase-3-74-admin-bot-drilldown-readonly.md`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/queries.ts`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `apps/web/src/features/admin/health-detail.ts`
- `packages/db/src/repositories.ts`
- `packages/db/src/schema.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-statistics-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`

## Files changed
None - read-only audit of product code. Handoff artifact only: `docs/handoffs/20260603-1943-admin-bot-stats-security-auditor.md`.

## Findings
1. Severity: High. Evidence: `apps/web/src/features/admin/types.ts:75`-`91` exposes only `latestMetric` on `AdminUserBotSummary`; `apps/web/src/features/admin/user-bot-detail-loader.ts:323`-`353` loads configs plus latest metric rows only; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:197`-`213` renders only the latest metric card group and no positions/trades/equity tables. Recommendation: do not mark Phase 3.75 complete until the admin DTO, loader, and page include read-only positions, trades, and equity panels. Target part: admin user bot statistics drilldown.
2. Severity: High. Evidence: the existing latest-metric Legacy scoping is correct and must be copied to the new panels: provider mappings are selected for the target user only at `apps/web/src/features/admin/user-bot-detail-loader.ts:306`-`320`; active mapping is keyed by bot instance at `apps/web/src/features/admin/user-bot-detail-loader.ts:377`-`383`; Legacy metric rows are ignored unless `botProviderAccountId` matches the active mapping at `apps/web/src/features/admin/user-bot-detail-loader.ts:387`-`392`; the fixture includes an unscoped Legacy metric and a scoped Legacy metric at `tests/integration/admin-user-bot-detail-loader.test.ts:243`-`257`, with assertions excluding the unscoped row at `tests/integration/admin-user-bot-detail-loader.test.ts:324`-`353`. Recommendation: positions/trades/equity must use the same target `botInstanceId` plus active Legacy `botProviderAccountId` rule; missing mapping must render a warning/empty state, not fleet diagnostics. Target part: Legacy provider mapping scoping.
3. Severity: Medium. Evidence: generic repository readers are not safe enough for the admin drilldown as-is: `packages/db/src/repositories.ts:1885`-`1886` lists positions by `botInstanceId` only; `packages/db/src/repositories.ts:1908`-`1909` lists trades by `botInstanceId` only and returns full `BotTradeImportRow`; `packages/db/src/schema.ts:514` and `packages/db/src/schema.ts:528` show trades carry both `botProviderAccountId` and `rawJson`; `packages/db/src/schema.ts:457` and `packages/db/src/schema.ts:471` show metric/equity snapshots also carry provider scope plus `rawJson`. Recommendation: add admin-specific safe projections or loader-local selects that join/verify target user and active provider mapping, and never select `rawJson`. Target part: repositories/admin loader.
4. Severity: Medium. Evidence: panel-specific security tests are missing: current admin loader tests insert and assert only `botMetricSnapshots` at `tests/integration/admin-user-bot-detail-loader.test.ts:215`-`257` and `tests/integration/admin-user-bot-detail-loader.test.ts:300`-`327`; static guardrails assert no forms/actions/live controls at `tests/integration/admin-user-bot-detail-static.test.ts:60`-`69`; user-facing bot read safety covers DB snapshots at `tests/integration/bot-read-safety-static.test.ts:70`-`85`, but not admin positions/trades/equity DTOs. Recommendation: add target-user fixtures for `botPositionSnapshots`, `botTradeImports`, and equity metric history, including other-user rows, Legacy unscoped rows, rawJson/apiKey/token sentinels, and missing-provider-mapping cases. Target part: tests.
5. Severity: Low. Evidence: existing provider id masking is in place for the current route: `apps/web/src/features/admin/user-bot-detail-loader.ts:121`-`125` masks provider ids; `apps/web/src/features/admin/user-bot-detail-loader.ts:226`-`240` maps `providerAccountId` through the mask; tests assert the masked form and reject full target/other-user ids at `tests/integration/admin-user-bot-detail-loader.test.ts:329`-`349`. Risk: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:116` renders the optional mapping label before the masked id, and labels are admin-provided by `apps/web/src/features/admin/schemas.ts:100`-`104`. Recommendation: keep displaying only masked `providerAccountId`; if labels may contain raw provider ids, sanitize or mask labels before display. Target part: provider mapping presentation.
6. Severity: Low. Evidence: the current page is read-only for the audited surface: admin auth gates run at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:31`-`36`; read-only/live-disabled badges render at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:52`-`54`; no-live-probe copy renders at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:209`-`212`; no-create/disable/edit copy renders at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:218`-`223`; static tests reject mutation imports, CSRF fields, submit buttons, and live controls at `tests/integration/admin-user-bot-detail-static.test.ts:60`-`69`. Recommendation: preserve this import-free, form-free route pattern when adding positions/trades/equity panels. Target part: page/actions boundary.

## Decisions
1. Current 3.74-style admin user bot detail is security-aligned for read-only latest metrics, safe config summary, masked provider ids, and exchange-key metadata.
2. Phase 3.75 admin positions/trades/equity drilldown is not implemented in the inspected files, so this security audit cannot approve the requested panels as complete.
3. Future panel loaders should use explicit admin DTO projections in `user-bot-detail-loader.ts` or equivalent, not generic full-row repository return types.
4. For Legacy, no active WTC provider mapping means no user-owned Legacy positions, trades, or equity facts may render on the selected-user page.

## Risks
1. The worktree was already heavily dirty before this audit; product code changes belong to adjacent phases and were not modified here.
2. `rawJson` exists on metric and trade storage and is read by the separate fleet-health admin query (`apps/web/src/features/admin/queries.ts:436`-`447`). Keep the user drilldown independent from that fleet diagnostic path.
3. Provider labels are not secret fields, but a human could type a raw provider id into a label. If strict "masked provider ids only" applies to labels too, add label redaction.
4. No gates were run by this agent; this was a static/read-only security audit.

## Verification/tests
RUN:
1. Read required governance docs and prior Phase 3.74 handoff.
2. Static source inspection of loader/page/types/actions/repositories/schema/tests with `rg`, `Select-String`, and line-numbered `Get-Content`.
3. Verified no product files were edited by this agent.

NOT RUN:
1. `npm test`, targeted Vitest, typecheck, lint, build, or Playwright - skipped because this was a read-only security-auditor pass with no product edits.
2. DB migration/apply/push - skipped because no schema or migration edits were made.
3. Live Legacy/Tortila bot probes, SSH, tmux, systemd, worker restart, exchange ping, start/stop/retest/apply-config, `.env` reads, or provider DB mutation - forbidden by scope and not run.

## Next actions
1. Implement Phase 3.75 admin DTOs for positions, trades, and equity history with explicit safe scalar fields only.
2. Scope Tortila by selected user's `bot_instances.user_id`; scope Legacy by selected user's bot instance plus active `bot_provider_accounts.id`.
3. Select no `rawJson`, config history JSON, exchange secret rows, API keys, tokens, or live-apply credentials.
4. Render read-only panels with no forms, no server-action imports, no live fetch/probe controls, and no user setting edit affordances.
5. Add loader/static tests proving other-user rows, unscoped Legacy rows, full provider ids, `rawJson`, `apiKey`, `apiSecret`, and `token` sentinels do not appear in serialized admin detail output.
