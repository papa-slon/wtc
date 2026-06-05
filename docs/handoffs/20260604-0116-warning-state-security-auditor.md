# warning-state-security-auditor handoff
## Scope
Phase 3.87 read-only security/scope audit of proposed and in-progress user-facing warning-state DTO work across user bot list, bot dashboard, safety, statistics, cabinet, admin fleet summaries, and admin selected-user bot summaries.

Focus: entitlements fail closed, no raw provider JSON, no provider free-text, no secret leakage, no live-control semantics, no exchange ping/retest claims, and no all-clear safety copy.

This audit did not edit code, tests, migrations, runtime config, environment files, live services, worker state, provider databases, bots, SSH, tmux, systemd, or exchange connections. The only write was this handoff.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/IMPLEMENTED_FILES.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`
8. `packages/bot-adapters/src/types.ts`
9. `packages/bot-adapters/src/warnings.ts`
10. `packages/bot-adapters/src/adapters.test.ts`
11. `apps/web/src/features/bots/data.tsx`
12. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
13. `apps/web/src/app/(app)/app/bots/page.tsx`
14. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
15. `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx`
16. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
17. `apps/web/src/features/cabinet/loader.ts`
18. `apps/web/src/features/cabinet/CabinetProductCard.tsx`
19. `packages/cabinet/src/derive.ts`
20. `apps/web/src/features/admin/health-detail.ts`
21. `apps/web/src/features/admin/bot-health-loader.ts`
22. `apps/web/src/features/admin/user-bot-detail-loader.ts`
23. `apps/web/src/features/admin/types.ts`
24. `apps/web/src/app/admin/bots/page.tsx`
25. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
26. `tests/integration/admin-health-detail.test.ts`
27. `tests/integration/admin-bot-health-loader.test.ts`
28. `tests/integration/admin-user-bot-detail-static.test.ts`
29. `tests/integration/bot-read-safety-static.test.ts`
30. `tests/integration/bot-statistics-static.test.ts`
31. `tests/integration/cabinet-pg9.test.ts`

## Files changed
None - read-only audit

## Findings
1. Severity: High. User warning state now has useful states, but it still lacks an explicit scope field, so fleet/product health warnings can be over-attributed to a current user bot. Evidence: `apps/web/src/features/bots/data.tsx:71` defines `BotWarningStatus`, but `apps/web/src/features/bots/data.tsx:73` to `apps/web/src/features/bots/data.tsx:84` has no `scope`/`providerScoped` field; production DB mode reads latest product health details at `apps/web/src/features/bots/data.tsx:373` to `apps/web/src/features/bots/data.tsx:374`; Legacy provider-mapping failure still carries those warnings into `emptyDbReadModel` at `apps/web/src/features/bots/data.tsx:413` to `apps/web/src/features/bots/data.tsx:424`; the shared panel labels only `warnings read` / `health snapshot` / `health only` at `apps/web/src/features/bots/WarningSummaryPanel.tsx:21` to `apps/web/src/features/bots/WarningSummaryPanel.tsx:24`. Recommendation: extend the user DTO with a scope such as `product_registry`, `user_instance_health`, `provider_account_health`, and `runtime_not_scoped`, matching the admin-selected-user model at `apps/web/src/features/admin/types.ts:135` to `apps/web/src/features/admin/types.ts:143` and `apps/web/src/features/admin/user-bot-detail-loader.ts:270` to `apps/web/src/features/admin/user-bot-detail-loader.ts:304`. Target part: user bot list/dashboard/safety/statistics warning DTO and copy.
2. Severity: Medium. The safety page still visually treats zero active warnings as green/up when the DTO status is `none_reported`; that can read like an all-clear despite safer explanatory copy elsewhere. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:47` to `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:50` sets the `Active warnings` metric tone to `up` for `none_reported`; the shared panel later warns that no canonical codes is not permission for live control or proof that runtime/exchange is risk-free at `apps/web/src/features/bots/WarningSummaryPanel.tsx:83` to `apps/web/src/features/bots/WarningSummaryPanel.tsx:86`. Recommendation: make the zero-warning safety metric neutral, or relabel it as "Canonical notices" and reserve green only for a separately audited safety state. Target part: `/app/bots/[bot]/safety`.
3. Severity: Medium. Admin fleet warning summaries are still two-state (`warnings_present`/`none_reported`) and do not carry `unavailable` or `not_evaluated`, so a row with no canonical codes can lack the richer user warning-state nuance. Evidence: `apps/web/src/features/admin/types.ts:199` to `apps/web/src/features/admin/types.ts:208` defines `AdminBotWarningSummary` with only two statuses; `apps/web/src/features/admin/bot-health-loader.ts:62` to `apps/web/src/features/admin/bot-health-loader.ts:80` derives `none_reported` solely from canonical warning count; `/admin/bots` renders `none reported` and "No canonical warning codes in the latest evaluated health detail" at `apps/web/src/app/admin/bots/page.tsx:173` to `apps/web/src/app/admin/bots/page.tsx:185`. Recommendation: either align admin fleet summaries with the user `unavailable`/`not_evaluated` state machine or include health/read-state scope in the summary row so "none reported" cannot be mistaken for service safety. Target part: `/admin/bots` canonical warning summary.
4. Severity: High. No raw provider warning text or secret-shaped warning strings are currently exposed by the warning normalizer. Evidence: warning extraction only accepts canonical codes from `warnings` and `warningCodes` at `packages/bot-adapters/src/warnings.ts:130` to `packages/bot-adapters/src/warnings.ts:145`, then filters by product-allowed codes at `packages/bot-adapters/src/warnings.ts:148` to `packages/bot-adapters/src/warnings.ts:163`; tests prove `apiKey`/`apiSecret` strings are dropped at `packages/bot-adapters/src/adapters.test.ts:88` to `packages/bot-adapters/src/adapters.test.ts:108`. Recommendation: keep future warning DTOs populated from registry-owned `RiskWarning` objects only, never provider message strings, stack traces, or raw JSON blobs. Target part: shared warning normalizer and all warning consumers.
5. Severity: High. Admin warning summaries sanitize integration health detail before warning DTO projection, which is the right boundary and should be preserved. Evidence: `projectHealthDetail` redacts, allowlists, canonicalizes warning codes, deletes `warningCodes`, and returns only safe keys at `apps/web/src/features/admin/health-detail.ts:68` to `apps/web/src/features/admin/health-detail.ts:83`; admin health loader derives warning summaries from the projected detail at `apps/web/src/features/admin/bot-health-loader.ts:340` to `apps/web/src/features/admin/bot-health-loader.ts:351`; tests cover bearer/token/key/value redaction at `tests/integration/admin-health-detail.test.ts:16` to `tests/integration/admin-health-detail.test.ts:47` and Legacy health warning normalization without secret leakage at `tests/integration/admin-bot-health-loader.test.ts:263` to `tests/integration/admin-bot-health-loader.test.ts:298`. Recommendation: do not bypass `projectHealthDetail` when adding admin warning-state fields. Target part: admin fleet and selected-user warning summaries.
6. Severity: High. Entitlement fail-closed is preserved in the inspected user/cabinet warning paths. Evidence: bot list loads `loadBotReadModelForUser` only inside `access.allowed` at `apps/web/src/app/(app)/app/bots/page.tsx:17` to `apps/web/src/app/(app)/app/bots/page.tsx:22`; bot dashboard returns access-required before reading the model at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:97` to `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:108`; safety uses `loadBot`/`BotAccessRequired` before warning reads at `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:8` to `apps/web/src/app/(app)/app/bots/[bot]/safety/page.tsx:16`; cabinet signals are fetched only under `decision.allowed` at `apps/web/src/features/cabinet/loader.ts:155` to `apps/web/src/features/cabinet/loader.ts:160`, and the pure deriver zeros warnings when not allowed at `packages/cabinet/src/derive.ts:219` to `packages/cabinet/src/derive.ts:228`. Recommendation: keep warning DTO reads and cabinet warning counts behind the existing entitlement branches. Target part: user bot list, dashboard, safety, statistics, and cabinet.
7. Severity: Medium. Static coverage has not fully caught up with the richer warning-state contract. Evidence: `tests/integration/bot-read-safety-static.test.ts:123` to `tests/integration/bot-read-safety-static.test.ts:133` checks the safety route uses the safe wrapper and registry, but does not assert `WarningSummaryPanel`, `none_reported` caveats, `unavailable`, `not_evaluated`, or no green all-clear; `tests/integration/bot-statistics-static.test.ts:26` to `tests/integration/bot-statistics-static.test.ts:32` checks safe read models but not the warning panel or DTO states. Recommendation: add focused static/unit coverage for `botWarningSummary`, `WarningSummaryPanel`, bot list inline labels, safety/statistics/dashboard usage, admin two-state vs richer-state behavior, and banned strings (`rawJson`, provider free text, `apiKey`, `apiSecret`, `token`, `startBot`, `stopBot`, `applyConfig`, `retest`, `Connection verified`). Target part: warning-state regression tests.

## Decisions
1. Treat `BotWarningSummary` plus `WarningSummaryPanel` as the intended user-facing DTO/component direction.
2. Do not accept warning status as an access source of truth; entitlements remain the only access source of truth.
3. Do not treat "none reported" as all-clear safety. It means only "no canonical warning codes were reported by the evaluated source."
4. Do not route warning-state work through live adapters, provider free text, raw provider JSON, exchange ping/retest, worker ticks, or live-control actions.
5. No N-agent claim is made for this handoff.

## Risks
1. Without an explicit warning scope on the user DTO, Legacy global health warnings can be shown on user pages without making clear whether they are product-level, fleet-level, or uniquely mapped to that user's provider account.
2. Green/up visual styling on zero warning count can undermine otherwise careful "not an all-clear" copy.
3. Admin fleet summaries may lag the user warning-state model unless their status union is expanded or paired with health/read-state context.
4. The wider working tree was already dirty during this audit; this handoff audits the current files inspected, not a clean committed diff.

## Verification/tests
RUN:
1. Required governance/status/handoff reads: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md`, and `docs/handoffs/20260604-0113-phase-3-86-warning-summary-normalizer.md`.
2. Source inspection with `rg`/PowerShell line reads over warning DTO, user bot surfaces, cabinet, admin summaries, and focused tests.
3. `git rev-parse --show-toplevel` - observed this workspace is currently git-backed at `C:/Users/maxib/GTE BOT/wtc_ecosystem_platform`.
4. `git status --short --untracked-files=no` - observed a pre-existing dirty working tree across many product/test/docs files before this handoff write.

NOT RUN:
1. Unit/Vitest, typecheck, lint, build, Playwright/e2e, browser preview, screenshot checks - skipped because this was a read-only security/scope audit.
2. Worker tick/smoke/restart, live bots, provider DB reads/writes, `.env`, vault/secrets, SSH, tmux, systemd, exchange ping, retest, start/stop/apply-config - forbidden by scope.
3. Git staging/commit/push - not requested and not appropriate for this read-only audit.

## Next actions
1. Add `scope`/`providerScoped` semantics to the user-facing warning-state DTO before treating it as complete across list/dashboard/safety/statistics.
2. Change safety zero-warning styling from green/up to neutral unless a separately audited safety verdict exists.
3. Extend static/unit coverage for the warning-state DTO and all consumers, including banned raw/provider/secret/live-control strings.
4. Consider aligning admin fleet summaries with the richer user warning-state union or adding explicit health/read-state context to every "none reported" row.
