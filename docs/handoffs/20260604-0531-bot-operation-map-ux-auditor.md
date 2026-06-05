# bot-operation-map-ux-auditor handoff
## Scope
Read-only Phase 3.97 UX/product audit for the WTC Legacy/Tortila bot operation map.

Scope was limited to inspecting current user bot dashboard/settings/setup/statistics surfaces, admin bot pages, and the admin selected-user bot detail page. The audit recommends the smallest high-value UX slice that makes the bot chain obvious: settings source -> per-coin config -> RSI/CCI or Turtle signal -> stages/slots/risk -> runtime/read-only evidence -> statistics/admin visibility.

No product code, tests, package files, generated artifacts, live bot services, provider DBs, exchange calls, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest, or runtime service mutation was invoked. No background-agent or N-agent audit claim is made; this was the single requested foreground read-only auditor pass.

## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`
8. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
9. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
10. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
11. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
12. `apps/web/src/features/bots/BotReadinessMap.tsx`
13. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
14. `apps/web/src/features/bots/config-review.ts`
15. `apps/web/src/features/bots/readiness.ts`
16. `apps/web/src/features/bots/readiness-loader.ts`
17. `apps/web/src/features/bots/TortilaSymbolConfigTable.tsx`
18. `apps/web/src/features/bots/LegacyAveragingConfigTable.tsx`
19. `apps/web/src/features/bots/statistics-panels.tsx`
20. `apps/web/src/features/bots/config-types.ts`
21. `apps/web/src/app/admin/bots/page.tsx`
22. `apps/web/src/app/admin/bots/config/page.tsx`
23. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
24. `apps/web/src/features/admin/user-bot-detail-loader.ts`
25. `apps/web/src/features/admin/types.ts`

## Files changed
None - read-only audit. This handoff file is the only permitted write.

## Findings
1. Severity: High. The current UI has the right facts, but users must assemble the bot lifecycle from separate panels instead of seeing one continuous operation map. Evidence: settings loads the WTC config source, per-bot rows, stage rows, Legacy runtime config, exchange keys, and readiness in one route at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:189`; it renders a source card at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:284`, source-choice cards at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:326`, the effective settings review at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:378`, a Legacy provider runtime snapshot at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:380`, and the per-coin editors at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:509`. Recommendation: add one reusable `BotOperationMap` strip/card that orders those existing facts into Source, Coin plan, Signal/slots/risk, Runtime evidence, Statistics/Admin visibility. Target part: user bot settings/dashboard information architecture.
2. Severity: High. The dashboard calls the readiness table an operational map, but the table is status-oriented and omits the strategy-specific "how it works" concepts the user asked to make obvious. Evidence: dashboard renders `BotReadinessMap` with copy "operational map" at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:152`; `BotReadinessMap` columns are only Layer, Status, Current state, Meaning, and Action at `apps/web/src/features/bots/BotReadinessMap.tsx:31`; readiness items are Access, Connection, Settings source, optional Runtime/Statistics, and Live control/apply at `apps/web/src/features/bots/readiness.ts:193`. Recommendation: keep readiness as a safety/status table, but put the new operation map above or beside it so it shows the domain chain: for Legacy, RSI/CCI + stage slots + active runtime slots; for Tortila, Turtle system + risk/unit caps + journal evidence. Target part: dashboard first-screen comprehension.
3. Severity: High. `BotConfigReviewPanel` already explains signals, risk, and stages well enough to reuse, but it stops before runtime/statistics/admin visibility. Evidence: Tortila review summarizes Turtle system mix, coin plan, per-trade risk, portfolio caps, and risk limits at `apps/web/src/features/bots/config-review.ts:101`; Legacy review summarizes RSI/CCI split, active stages, stage capacity, signal map, and stage slots at `apps/web/src/features/bots/config-review.ts:163`; the renderer shows only review pills, metrics, and section tables at `apps/web/src/features/bots/BotConfigReviewPanel.tsx:18`. Recommendation: do not rewrite the editors; derive the operation-map strategy cells from the same `BotConfigReview` data and add only the missing runtime/statistics/admin cells from existing readiness/read-model/admin summaries. Target part: shared bot UX component.
4. Severity: Medium. Statistics exposes runtime evidence and analytics, but it does not show the resolved WTC settings source that produced or differs from that evidence. Evidence: the statistics page loads the active read model including config/warnings at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:224`; Legacy statistics derive rows/stages from runtime config only at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:239`; selected-bot metrics and Legacy operations render at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:332` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:390`. Recommendation: in the first slice, add a compact operation-map summary to statistics that says whether rows are runtime snapshot evidence or WTC reference settings, with links back to settings and dashboard. Target part: statistics source attribution.
5. Severity: Medium. Admin fleet and selected-user pages are safe and read-only, but they mirror the same split: settings source, provider mapping, runtime snapshots, warnings, positions, trades, and equity are separate evidence blocks rather than one explainable map. Evidence: admin fleet says live control is disabled and Legacy DB live-read is read-only at `apps/web/src/app/admin/bots/page.tsx:123`, then shows Tortila snapshots, Legacy pub_id inspector, active slots, and active order coverage at `apps/web/src/app/admin/bots/page.tsx:300`, `apps/web/src/app/admin/bots/page.tsx:360`, `apps/web/src/app/admin/bots/page.tsx:397`, and `apps/web/src/app/admin/bots/page.tsx:420`; selected-user detail shows resolved WTC settings at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:226`, config metrics at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:240`, runtime metrics at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:300`, and stats scope at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:318`. Recommendation: first add the same operation-map shape to the selected-user bot card using current `configSummary`, `providerAccount`, `latestMetric`, and `statsSource`, then link fleet rows to that detail when mapped. Target part: admin user bot detail.
6. Severity: Low. The admin selected-user DTO already has enough fields for a first map, but it is slightly lossy for future per-signal/admin parity. Evidence: `AdminUserBotConfigSummary` has source, symbols, stage count/capacity, and `riskSummary` at `apps/web/src/features/admin/types.ts:96`; the loader derives Legacy signal summary/stage capacity at `apps/web/src/features/admin/user-bot-detail-loader.ts:346` and `apps/web/src/features/admin/user-bot-detail-loader.ts:523`; Tortila summary currently falls back to top-level system/timeframe/risk fields at `apps/web/src/features/admin/user-bot-detail-loader.ts:555`. Recommendation: first slice should use existing fields; a follow-up can add safe `systemMix`, `avgRiskPercent`, and `signalSplit` fields if the component needs parity without raw config exposure. Target part: admin DTO ergonomics.

## Decisions
1. No product code, tests, package files, runtime artifacts, docs other than this handoff, or live services were edited.
2. This pass classifies Phase 3.97 as a single scoped read-only UX/product audit, not a broad multi-agent implementation phase; no background agents were launched and no N-agent claim is made.
3. The smallest high-value UX slice is a shared operation-map component, not a new editor, new data model, live adapter, provider read, or service mutation.
4. The map should reuse existing safe summaries first: `BotConfigReview`, `BotReadinessDto`, `BotReadModel` issue/status fields, and `AdminUserBotConfigSummary`.
5. The map must preserve the safety boundary: it may explain "runtime/read-only evidence" and "admin visibility", but it must not imply live apply, exchange ping, provider DB mutation, start/stop, retest, or position closing.

## Risks
1. If the operation map is implemented as another status table only, it will duplicate `BotReadinessMap` and fail the product goal. It needs an explicit left-to-right chain.
2. If the map pulls raw runtime config or provider identifiers into admin/user UI, it can create a disclosure regression. Use existing sanitized summaries and masked provider IDs only.
3. If the first slice lands on every surface at once, it may spread tests too thin. Prefer one shared component plus the two highest-value placements first.
4. The worktree was already heavily dirty before this audit, including the inspected bot and admin files; this pass preserved that state.
5. Statistics/admin wording must not call a snapshot "matching active config" unless the evidence is actually runtime-scoped and current.

## Verification/tests
RUN:
1. Required start docs were read: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, `docs/NEXT_ACTIONS.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/handoffs/20260604-0459-phase-3-96-bot-settings-row-error-feedback.md`.
2. `git rev-parse --is-inside-work-tree` - PASS, git-backed.
3. `git branch --show-current` - observed `codex/bot-analytics-settings-canary-20260603`.
4. `git status --short` - observed broad pre-existing dirty state before the handoff write; no unrelated files were reverted.
5. Focused `rg` and line-number reads inspected the user dashboard/settings/setup/statistics surfaces, bot review/readiness/statistics components, admin fleet/defaults pages, admin selected-user detail page, and supporting admin/bot DTO loaders.
6. `Test-Path docs/handoffs/20260604-0531-bot-operation-map-ux-auditor.md` before writing - PASS, file did not already exist.

NOT RUN:
1. Product code/test/package/docs implementation gates - skipped because this is a read-only UX/product audit with exactly one permitted handoff write.
2. `npm test`, typecheck, lint, build, Playwright/e2e, `npm run governance:check`, and secret scan - skipped for read-only audit scope; no executable code was changed.
3. Live bot services, provider DBs, exchange calls, env/vault/secret files, SSH, tmux, systemd, worker tick/restart, start/stop/apply/retest - forbidden by scope and not run.
4. Background-agent cleanup - not applicable; no background agents were launched in this single-auditor pass.

## Next actions
1. Implement a shared `BotOperationMap` in `apps/web/src/features/bots/` with five rows or columns: Settings source, Per-coin config, Signal and capacity/risk, Runtime/read-only evidence, Statistics/admin visibility.
2. First placement: user bot dashboard near the existing readiness map, because it already has `read`, `wtcConfig`, and readiness data in one place.
3. Second placement: admin selected-user bot detail inside each bot card, using `configSummary`, `providerAccount`, `warningSummary`, `latestMetric`, and `statsSource`.
4. Optional same-slice low-risk placement: statistics selected-bot header, limited to source/evidence attribution and links back to dashboard/settings.
5. Add focused static tests asserting the chain labels, Legacy RSI/CCI/stage language, Tortila Turtle/risk language, read-only/live-control-disabled wording, and absence of raw secrets/provider URLs.
