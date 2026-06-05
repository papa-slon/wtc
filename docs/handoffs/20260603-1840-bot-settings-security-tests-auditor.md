# bot-settings-security-tests-auditor handoff
## Scope
Read-only Phase 3.73 security/tests audit of the proposed bot settings source-clarity slice. Focused on no fake connection tests, no live control, no secret display/logging, admin/user separation, provider mapping ownership, and regression tests for zero Legacy provider mappings.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/data.tsx`
- `apps/web/src/app/api/bots/[bot]/config-export/route.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-config-export-static.test.ts`
- `tests/e2e/bot-settings.spec.ts`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/meta.ts`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/actions.ts`
- `apps/web/src/features/admin/schemas.ts`
- `packages/db/src/repositories.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`

## Files changed
None - read-only audit, except this required handoff file: `docs/handoffs/20260603-1840-bot-settings-security-tests-auditor.md`.

## Findings
1. Severity: High. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:176` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:320` render `${legacyAccounts.length || 1} provider pub_id`, so zero visible provider accounts can still display as one. Recommendation: replace the fallback with explicit zero/mapping-pending text, and add static coverage banning `legacyAccounts.length || 1` / `providerCount || 1` on Legacy source surfaces. Target part: user dashboard/statistics source-clarity counters.

2. Severity: High. Evidence: `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:88` renders `{providerCount || 1} pub_id`, while `apps/web/src/features/bots/config.ts:69`, `apps/web/src/features/bots/config.ts:435`, and `apps/web/src/features/bots/config.ts:485` keep `providerPubId` in user-submitted config. Recommendation: remove provider-account identity from user-persisted reference config, or keep it as masked read-only display derived from the scoped read model only; provider mapping must remain admin/DB-owned. Target part: provider mapping ownership boundary.

3. Severity: Medium. Evidence: `apps/web/src/features/bots/config.ts:655` includes full `symbolConfigs` in the sanitized Legacy export, and `apps/web/src/features/bots/config.ts:689` emits that object in `config`, so any retained `providerPubId` can be exported by an entitled user even though the native export omits it. Recommendation: strip `providerPubId` from `legacyAllowedExportConfig()` output and add an export test that fails on `providerPubId` / raw `pub_id` identifiers as well as `apiKey` / `apiSecret`. Target part: config export data minimization.

4. Severity: Medium. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:192` says "Connected through existing Legacy pub_id" even when `legacyLiveConfig` is null, and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:336` says "legacy uses provider pub_id" when review can be reached from a WTC reference config alone. Recommendation: branch copy on mapped/live-snapshot availability; pending users should see "provider mapping pending - WTC reference only" rather than connected language. Target part: setup/review source clarity.

5. Severity: Medium. Evidence: `apps/web/src/app/api/bots/[bot]/config-export/route.ts:24` gates Legacy export by comparing the issue title string to "Legacy provider mapping required", while `apps/web/src/features/bots/data.tsx:151`-`154` defines that as display copy. Recommendation: add a structured `BotReadIssue` code such as `legacy_provider_mapping_required`, gate on that code, and add tests for zero and multiple active mappings. Target part: config-export fail-closed gate.

6. Severity: Medium. Evidence: `tests/integration/bot-read-safety-static.test.ts:87`-`95` checks that provider mapping code exists but not that zero mappings avoid fabricated counts; `tests/integration/bot-read-safety-static.test.ts:196`-`203` positively requires "Connected through existing Legacy pub_id"; `tests/e2e/bot-settings.spec.ts:32`-`43` covers only the settings page and no pending-mapping dashboard/statistics state. Recommendation: add regression tests for zero mapping, multiple mapping, dashboard/statistics counters, setup pending copy, and export sanitization. Target part: security/source-clarity regression suite.

## Decisions
- No live bots, SSH, tmux, systemd, exchange APIs, provider DBs, `.env` files, or live control paths were touched.
- Existing exchange-key UI is not claiming a green connection test: settings/setup show disabled "Test connection pending audit" and password-only key entry for non-Legacy paths.
- Admin mapping path is directionally correct: admin-only page/action use CSRF, Zod validation, audited DB repository calls, and do not edit strategy settings, exchange keys, live bot config, start/stop state, or positions.

## Risks
- Current source clarity can still imply a provider mapping where none exists, undermining the Phase 3.72 fail-closed ownership model.
- Full provider identifiers may leak through user config/export if they remain embedded in `symbolConfigs`.
- Static tests currently prove presence of guardrail strings more than behavior; copy changes or fallback changes can bypass the intended safety gate.

## Verification/tests
RUN:
1. Static source inspection of the files listed above.
2. `git status --short --branch` to confirm the worktree was already dirty and this audit must avoid reverting/overwriting concurrent work.

NOT RUN:
1. Vitest/Playwright gates - not run because this auditor is read-only except the required handoff, and the requested scope is an audit of test gaps.
2. Live Legacy/Tortila start, stop, restart, retest, apply-config, exchange ping, SSH, tmux, systemd, provider DB, `.env`, or live control checks - forbidden by scope.

## Next actions
1. Fix the three `|| 1` provider-count fallbacks and add static tests banning that regression.
2. Remove or sanitize `providerPubId` from user-submitted config and config export; source provider identity from admin mapping/read-model context only.
3. Replace string-title export gating with structured issue codes and cover zero/multiple mapping with tests.
4. Add Playwright or DB-backed integration coverage for pending Legacy mapping states on settings, setup, dashboard, statistics, and config export.
