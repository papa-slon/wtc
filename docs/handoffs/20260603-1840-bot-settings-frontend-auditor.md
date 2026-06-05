# bot-settings-frontend-auditor handoff
## Scope
Read-only Phase 3.73 frontend implementation audit for a bounded bot settings clarity patch. Focus: settings/setup source band and next actions, Legacy/Tortila config table source/custom chips, dashboard/statistics zero-mapping honesty, and mobile/text overflow risk. No live bots, SSH, tmux, systemd, exchange APIs, provider DBs, `.env` files, or live control paths were started, stopped, probed, or mutated.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260603-1830-phase-3-72-legacy-provider-ingestion-admin-mapping.md`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
- `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
- `apps/web/src/features/bots/config.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `packages/ui/src/theme.css`
- `packages/ui/src/components.tsx`
- `tests/e2e/bot-settings.spec.ts`
- `tests/e2e/cabinet-pg9-mobile.spec.ts`
- `tests/e2e/smoke.spec.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-statistics-static.test.ts`

## Files changed
None - read-only audit.

Handoff file written: `docs/handoffs/20260603-1840-bot-settings-frontend-auditor.md`

## Findings
1. Severity: High. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:127` uses `legacyLiveConfig ?? state.current ?? {}` as the editable source, while the first-screen summary only shows storage/version/provider count at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:147` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:166`. Recommendation: add a compact configuration source band before the metric cards with explicit states for provider snapshot, saved WTC reference version, built-in defaults, and provider mapping/read blocker; include one next action link such as Settings, Guided setup, Download export, or Admin mapping required. Target part: settings page source band and next actions.

2. Severity: High. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:141` uses the same provider-snapshot-first `cur` source, but the setup banner at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:183` only describes the policy state and the review empty state at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:331` does not summarize the current source. Recommendation: reuse the same source-band helper from settings in setup, placed after the stepper/banners and before strategy cards, so users see whether they are editing defaults, saved WTC config, or provider-derived rows before saving. Target part: setup page source band and review next action.

3. Severity: High. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:176` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:320` render `${legacyAccounts.length || 1} provider pub_id`, and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:88` renders `{providerCount || 1} pub_id`. Recommendation: remove all `|| 1` provider-count fallbacks; render "0 mapped", "mapping required", or "provider snapshot unavailable" unless an actual provider account/providerPubId row exists. Target part: Legacy dashboard/statistics metrics and Legacy strategy map header.

4. Severity: Medium. Evidence: Legacy row headers preserve provider pub_id only as a hidden field and compact label at `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:107` and `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx:110`, while Tortila accepts manual custom symbols at `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx:99` and the parser gives custom input precedence at `apps/web/src/features/bots/config.ts:557`. Recommendation: add small `StatusPill` chips per row for `provider snapshot`, `saved WTC`, `default seed`, and `custom symbol`; for Legacy, pass an explicit `sourceKind` or `configSource` prop from settings/setup because the component cannot reliably infer default-vs-saved after `legacySymbolConfigsFromConfig()` fills defaults. Target part: LegacyAveragingConfigTable, TortilaSymbolConfigTable, and call sites.

5. Severity: Medium. Evidence: settings version/safety tables are unwrapped at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:320` and `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:339`, and bot dashboard tables are unwrapped at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:205`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:223`, and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:270`; the responsive table/card CSS already exists at `packages/ui/src/theme.css:110`. Recommendation: wrap these tables in `<div className="wtc-table-wrap">` and add `data-label` to every `td`; keep long ids/notes inside wrapped table/card rows rather than MetricCard values. Target part: settings history/safety tables and bot dashboard open positions/trades/capability tables.

6. Severity: Medium. Evidence: `tests/e2e/bot-settings.spec.ts:25` and `tests/e2e/bot-settings.spec.ts:42` check settings horizontal scroll, `tests/e2e/cabinet-pg9-mobile.spec.ts:43` checks setup mobile, and `tests/integration/bot-read-safety-static.test.ts:196` covers Legacy pub_id copy, but no test currently asserts zero-provider wording or source/custom chips. Recommendation: extend existing static tests with expected source-band/chip text and add a zero-mapping assertion that rejects `/\|\| 1\} provider pub_id/` and `{providerCount || 1}`; if time permits, add dashboard/statistics no-horizontal-scroll e2e coverage. Target part: bot settings/read-safety/static and Playwright coverage.

## Decisions
1. Keep the patch UI-only and bounded to `apps/web` bot pages/components plus focused tests; do not change DB schema, provider ingestion, live adapters, entitlements, or admin mapping logic.
2. Reuse existing primitives: `StatusPill`, `RiskWarningBanner`, `MetricCard`, `EmptyState`, `wtc-row`, `wtc-grid`, `wtc-table-wrap`, and existing wrapped-table CSS.
3. Prefer one small source helper shared by settings/setup over duplicating source-copy conditionals in each page.
4. Treat `providerAccounts.length` as provider snapshot visibility, not proof of durable ownership; do not let zero accounts render as one account.

## Risks
1. The worktree was already dirty on branch `codex/bot-analytics-settings-canary-20260603`, including files in this audit scope; this lane did not revert or overwrite other work.
2. No live provider DB or worker tick was inspected, so source bands must describe observed UI/read-model states only.
3. Existing e2e settings screenshots may run in demo data where version/safety tables are empty, so static wrapper assertions are still useful.
4. `MetricCard` does not add overflow wrapping itself at `packages/ui/src/components.tsx:46`; long text should stay in wrapped rows/tables for this bounded patch.

## Verification/tests
RUN:
1. Read required governance and predecessor handoff docs.
2. `git status --short --branch` - observed dirty branch and pre-existing modified/untracked files.
3. Source inspection with numbered line reads and `rg` over scoped bot settings/setup/dashboard/statistics components, UI CSS, and tests.

NOT RUN:
1. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-statistics-static.test.ts` - not run; no implementation patch in this lane.
2. `npx playwright test tests/e2e/bot-settings.spec.ts tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile` - not run; no implementation patch in this lane.
3. Live bot/provider DB/exchange/SSH/tmux/systemd/.env checks - forbidden by scope and not run.

## Next actions
1. Implement the bounded frontend patch in this order: shared settings/setup source band, zero-provider fallback removal, row source/custom chips, then table wrapping/data labels.
2. Update `tests/integration/bot-read-safety-static.test.ts` and `tests/integration/bot-statistics-static.test.ts` for source-band/chip/zero-mapping copy.
3. Run focused static tests, then `tests/e2e/bot-settings.spec.ts` and the mobile setup/dashboard no-horizontal-scroll checks.
4. Preserve read-only safety copy: no live apply, no start/stop, no exchange ping, no provider DB probing, and no user-side provider mapping form.
