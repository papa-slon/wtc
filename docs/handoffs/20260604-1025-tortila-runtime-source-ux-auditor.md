# ecosystem-ux-ui-designer handoff
## Scope
Read-only UX/product audit for Phase 4.10 Tortila runtime/source evidence map.

Goal: inspect current Tortila dashboard, settings, setup, statistics, admin bot fleet, and selected-user drilldown surfaces; identify the smallest next `apps/web` UX slice that helps users and admins understand whether Tortila is working, what evidence is current, what is missing, and which boundaries remain read-only.

Strictly out of scope: product code edits, test edits, live server mutation, env/secret inspection, provider/API/exchange ping, order/position/mark reads, bot start/stop/apply/retest, worker tick, DB mutation, deploy, and any claim that WTC can live-control or live-enforce Tortila.
## Files inspected
1. `AGENTS.md`
2. `docs/SESSION_PROTOCOL.md`
3. `docs/handoffs/0000-orchestrator-seed.md`
4. `docs/STATUS.md`
5. `docs/NEXT_ACTIONS.md`
6. `docs/IMPLEMENTED_FILES.md`
7. `docs/handoffs/20260604-1016-phase-4-09-tortila-cap-validation.md`
8. `docs/handoffs/20260604-0921-phase-4-07-tortila-strategy-map.md`
9. `docs/handoffs/20260604-0926-phase-4-08-tortila-portfolio-caps-map.md`
10. `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
11. `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
12. `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
13. `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
14. `apps/web/src/app/admin/bots/page.tsx`
15. `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
16. `apps/web/src/features/bots/data.tsx`
17. `apps/web/src/features/bots/WarningSummaryPanel.tsx`
18. `apps/web/src/features/bots/BotOperationMapPanel.tsx`
19. `apps/web/src/features/bots/BotReadinessMap.tsx`
20. `apps/web/src/features/bots/BotSetupControlCenter.tsx`
21. `apps/web/src/features/bots/BotConfigReviewPanel.tsx`
22. `apps/web/src/features/bots/statistics-panels.tsx`
23. `apps/web/src/features/admin/bot-health-loader.ts`
24. `apps/web/src/features/admin/user-bot-detail-loader.ts`
## Files changed
None - read-only audit, except this handoff path:
1. `docs/handoffs/20260604-1025-tortila-runtime-source-ux-auditor.md`
## Findings
1. Severity: High. Tortila already shows health and data-mode pills, readiness, operation map, runtime warnings, metrics, positions, trades, config summary, and disabled live-control copy, but users still have to assemble the evidence chain from separate cards. Evidence: dashboard loads metrics/positions/trades/config/warnings at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:116`; top pills show health plus adapter mode at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:159`; readiness map copy appears at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:166`; operation map runtime summary is set at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:171`; warning summary is separate at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:189`; live control is explicitly unavailable at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:191`. Recommendation: add one compact `Tortila evidence ladder` panel near the top of the dashboard, directly below the subnav and before the operation map, with four steps: `Journal health`, `Worker snapshot`, `WTC DB snapshot`, and `User-scoped page data`. Target part: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx` plus a reusable `features/bots` component.
2. Severity: High. The data model already computes freshness and missing-proof states, but the UI does not present freshness as a professional dashboard primitive. Evidence: `BotHealth` carries `lastSyncAt` and `staleDataSeconds` in `apps/web/src/features/bots/data.tsx:115`; DB health derives stale, ok, unreachable, and not-configured states at `apps/web/src/features/bots/data.tsx:339`; stale detail says data is only from the last persisted WTC DB snapshot at `apps/web/src/features/bots/data.tsx:363`; `lastSyncAt` and `staleDataSeconds` are returned at `apps/web/src/features/bots/data.tsx:376`; missing user-scoped snapshots return an explicit issue at `apps/web/src/features/bots/data.tsx:535`. Recommendation: show a `Freshness` row with `last worker check`, `latest metric snapshot`, `latest position snapshot`, `latest trade import`, and `age`, using neutral/warn/error tones. Do not show "online" unless the evaluated read state is ok and the snapshot is fresh by the existing threshold. Target part: shared Tortila evidence component fed by the existing read model.
3. Severity: High. Warning copy is honest and registry-owned, but it is currently a separate status notes panel rather than part of the source ladder users scan first. Evidence: warning states include `warnings_present`, `none_reported`, `unavailable`, and `not_evaluated` at `apps/web/src/features/bots/data.tsx:72`; "no warnings" copy says it is not permission for live control or proof of exchange safety at `apps/web/src/features/bots/data.tsx:273`; `WarningSummaryPanel` displays source and scope pills at `apps/web/src/features/bots/WarningSummaryPanel.tsx:60`; empty state repeats no live-control guarantee at `apps/web/src/features/bots/WarningSummaryPanel.tsx:94`. Recommendation: keep `WarningSummaryPanel`, but add a one-line warning state inside the evidence ladder: `0 reported by latest evaluated health snapshot`, `not evaluated`, `runtime snapshot unavailable`, or `N canonical notices`. Link/anchor to the full warning panel. Target part: dashboard and statistics.
4. Severity: High. Settings/setup have strong WTC-reference wording, but Tortila runtime evidence is expressed as key metadata or generic journal snapshots, not as a source ladder. Evidence: settings says `Resolved source`, key metadata, and `WTC version only` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:324`; it says Tortila exchange keys are separate from settings source and runtime snapshots are read-only evidence at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:412`; operation map on settings uses `journal snapshots, positions, trades, equity, and warnings` at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:420`; setup says `no live apply/start/stop` at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:332`; setup review says live exchange ping was not run at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:597`. Recommendation: place a small read-only `Runtime evidence` strip beside/under `Resolved source` on settings and setup: `WTC reference profile`, `exchange key metadata`, `journal/worker snapshot`, `warnings`, and `missing proof`. Copy must say `Settings are WTC-side intent; runtime evidence is read-only and may be stale`. Target part: settings/setup summary cards.
5. Severity: Medium. Admin pages have the strongest evidence language, but the admin fleet view and selected-user drilldown use different layouts for the same truth. Evidence: admin bots page states no live probe during render at `apps/web/src/app/admin/bots/page.tsx:13`; page copy says no start/stop/applyConfig exists at `apps/web/src/app/admin/bots/page.tsx:165`; owner explorer explains unmapped facts remain fleet diagnostics at `apps/web/src/app/admin/bots/page.tsx:233`; latest bot metric snapshot renders snapshot time and source adapter at `apps/web/src/app/admin/bots/page.tsx:388`; Tortila user-scoped snapshots explain WTC bot instance ownership at `apps/web/src/app/admin/bots/page.tsx:464`; selected-user drilldown copy is read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:104`; latest metric and source render at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:375`. Recommendation: reuse the same evidence ladder language in admin mode, with admin-only labels: `fleet health row`, `user bot instance`, `snapshot source adapter`, `selected user scope`, and `no live mutation`. Target part: `admin/bots` and `admin/users/[userId]/bots`.
6. Severity: Medium. Statistics is professional and data-rich, but its "portfolio snapshot" and panels need clearer provenance when data is stale or missing. Evidence: statistics loads the read model at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:229`; portfolio snapshot card starts at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:299`; simulated data and live-control-unavailable banners exist at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:333` and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:339`; `WarningSummaryPanel` is rendered at `apps/web/src/app/(app)/app/bots/statistics/page.tsx:425`. Recommendation: add a compact provenance header above Tortila stats: `Source: WTC DB snapshots`, `Latest metric: <time or missing>`, `Warnings: <state>`, `Control: disabled`. Avoid "live PnL" unless the label says `snapshot`. Target part: statistics page header.
7. Severity: High. The smallest safe next slice is UI composition and copy, not a new adapter, worker tick, runtime diff, or exchange test. Evidence: Phase 4.09 explicitly says runtime Tortila truth is not proven and needs a separate runtime/source phase before current live config, runtime enforcement, exchange proof, or control action claims (`docs/handoffs/20260604-1016-phase-4-09-tortila-cap-validation.md`). The seed says Tortila has a journal service and known risk signals that must surface as warnings, never hide behind a green card (`docs/handoffs/0000-orchestrator-seed.md`). Recommendation: build an `EvidenceLadderPanel` that only consumes existing sanitized `BotReadModel`, `BotHealth`, `BotWarningSummary`, and existing latest snapshot timestamps. It should not read env, call providers, invoke worker code, or add mutations. Target part: reusable `apps/web/src/features/bots` presentation component.
## Decisions
1. Recommended next UX slice: a shared `Tortila evidence ladder` / `Runtime evidence` component, not a new page and not live control.
2. Primary placement: dashboard top, immediately after `BotSubNav`; secondary compact placement: settings/setup summary area and statistics header; admin variant: fleet and selected-user drilldown.
3. Copy should use these terms: `read-only evidence`, `latest worker snapshot`, `WTC DB snapshot`, `user-scoped`, `snapshot stale`, `missing proof`, `live control disabled`.
4. Copy should avoid these terms unless explicitly negative: `running safely`, `synced`, `live enforcement`, `applied to bot`, `exchange verified`, `start`, `stop`, `apply config`, `position close`.
5. Safe CTA set: `Review warnings`, `Open statistics`, `Open settings`, `Ask admin to map evidence`, or `Wait for next worker snapshot`. No CTA should trigger a worker tick, provider read, exchange ping, start/stop, apply, retest, or order/mark read.
6. Visual shape: dense terminal dashboard row, not a marketing card. Use four horizontal steps on desktop and stacked rows on mobile, each with a status pill, timestamp/age, one-line proof, and a missing-proof hint.
## Risks
1. A green health pill without freshness context can imply "bot is working now" even when only an older DB snapshot exists.
2. Calling snapshot values "live" would overstate the evidence and undermine the read-only canary boundary.
3. Duplicating evidence language separately on dashboard/settings/statistics/admin could drift quickly; use one shared formatter/component with `audience: 'user' | 'admin'`.
4. Users may still want a real "is it stopped?" answer. The honest UI can say `process health from latest worker/journal check`, but cannot claim current process state without a fresh audited runtime check.
5. Admin drilldown can accidentally look like an edit surface; keep user settings, provider mappings, exchange keys, and live bot state view-only.
## Verification/tests
RUN:
1. Required protocol/current-state docs read.
2. `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with a heavily dirty pre-existing worktree.
3. `Test-Path -LiteralPath docs/handoffs/20260604-1025-tortila-runtime-source-ux-auditor.md` - returned `False` before writing.
4. Read-only inspection with `rg`, `Get-Content`, and targeted line-numbered output.
5. Wrote only this handoff file.

NOT RUN:
1. Playwright, Vitest, typecheck, lint, build, secret scan, governance check, coverage, full CI - skipped because this was an authorized read-only UX/product audit handoff with no product/test edits.
2. Live bot start/stop/apply/retest, live diagnostics, exchange ping, provider/API calls, order/position/mark reads, `/api/marks`, worker tick, DB mutation, deploy/canary mutation, SSH/tmux/systemd - skipped by explicit safety boundary.
3. Env value/secret inspection, vault reads, raw provider payload inspection - skipped by explicit safety boundary.
4. Git commit, push, PR - not requested.
## Next actions
1. Implement `apps/web/src/features/bots/BotEvidenceLadderPanel.tsx` or similarly named shared component. Inputs should come from existing sanitized read models and optional latest snapshot metadata only.
2. Add the panel to Tortila dashboard first: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`, between `BotSubNav` and `BotReadinessMap`.
3. Add compact variants to Tortila settings/setup summary and statistics header using the same copy formatter.
4. Add admin variant rows to `apps/web/src/app/admin/bots/page.tsx` and `apps/web/src/app/admin/users/[userId]/bots/page.tsx` only after the user-facing dashboard variant is stable.
5. Add focused tests for source ladder copy, stale/missing proof states, warning summary state, mobile no-horizontal-scroll, and absence of live-control/live-enforcement claims.
