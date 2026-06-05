# admin-launch-readiness-ux-auditor handoff
## Scope
Phase 4.25 read-only UX/product audit for the admin selected-user bot drilldown in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope question: should `/admin/users/[userId]/bots` mirror the user bot launch-readiness verdict in a premium, obvious, read-only way? Inspected current admin/user bot pages, `BotLaunchReadinessPanel`, `BotReadinessMap`, statistics/admin command centers, settings/source panels, and related coverage. No code edits, live/provider commands, worker commands, deploy commands, or tests were run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/statistics-panels.tsx`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/admin-user-bot-detail-loader.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/bot-readiness-map.spec.ts`

## Files changed
- `docs/handoffs/20260604-1715-admin-launch-readiness-ux-auditor.md` - this handoff only; no code, app, test, provider, worker, or deploy files changed.

## Findings
1. Severity P1 - Admin selected-user drilldown does not yet mirror the user launch-readiness verdict as an obvious command-center panel. Evidence: the user bot dashboard imports and mounts `BotLaunchReadinessPanel` at `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:9`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:13`, and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:170`-`175`; the admin selected-user page imports only admin evidence and operation-map surfaces at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:1`-`9`. Its selected-user overview rows cover user scope, settings, statistics, runtime attention, Legacy mapping, and admin boundary at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:145`-`190`, while each bot card starts with status pills plus `Selected-user evidence ladder` at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:394`-`427`. Recommendation: add a per-bot admin launch-readiness verdict before the evidence ladder, with the same top-level state language, ready/attention/blocked counts, gate table, and live-start disabled boundary as the user bot dashboard. Target part: `/admin/users/[userId]/bots` per-bot cards.

2. Severity P1 - The existing launch panel has the right verdict mechanics, but direct reuse without admin-safe link handling would send admins to user self-service routes instead of a selected-user read-only mirror. Evidence: `BotLaunchReadinessPanel` derives `Launch blocked`, `Operator review required`, and `Read-only ready` from readiness rows at `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:12`-`33`; it renders the verdict pills, counts, table, and disabled `Start bot unavailable` button at `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:71`-`128`. However its fallback settings/statistics links target `/app/bots/...` at `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:68`-`69`, and shared readiness items also carry `/app/bots/...` hrefs at `apps/web/src/features/bots/readiness.ts:110`, `apps/web/src/features/bots/readiness.ts:139`, `apps/web/src/features/bots/readiness.ts:152`, `apps/web/src/features/bots/readiness.ts:170`, and `apps/web/src/features/bots/readiness.ts:203`. Recommendation: either add an admin/audience mode that strips or rewrites action links, or map `BotReadinessItem` links to local anchors/admin-safe read-only destinations before rendering. Do not route an admin selected-user mirror to the admin actor's own `/app/bots` pages. Target part: launch panel API and admin routing boundary.

3. Severity P1 - The admin loader has most ingredients for launch readiness, but its DTO does not expose shared readiness rows or a launch verdict, so React would need to recompute if implemented naively. Evidence: the user readiness DTO already exposes `items: BotReadinessItem[]` at `apps/web/src/features/bots/readiness-loader.ts:29`-`40`, and `loadBotReadinessForUser` builds those shared rows server-side at `apps/web/src/features/bots/readiness-loader.ts:116`-`205`. The admin selected-user summary type stops at config, exchange/provider summaries, runtime health, statistics, provider scope, and warnings at `apps/web/src/features/admin/types.ts:157`-`178`, and the DB loader returns those fields but no readiness item list at `apps/web/src/features/admin/user-bot-detail-loader.ts:1115`-`1139`. Recommendation: add `readinessItems` and/or a compact `launchReadiness` summary to `AdminUserBotSummary`, built by a shared server helper or `buildBotReadinessItems` with an admin-selected-user surface. Avoid duplicate local readiness logic inside the page component. Target part: `features/admin/user-bot-detail-loader.ts` and `features/admin/types.ts`.

4. Severity P2 - Current admin evidence panels are strong read-only substrate, but they are not a launch-readiness verdict. Evidence: the page correctly warns that selected-user drilldown is read-only at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:353`-`358`; `AdminBotRuntimeEvidencePanel` states admin visibility is diagnostic only at `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx:75`-`77`; and the admin operation map says settings have no live apply/start/stop and connects settings to runtime evidence without implying live control at `apps/web/src/features/bots/BotOperationMapPanel.tsx:88`-`91` and `apps/web/src/features/bots/BotOperationMapPanel.tsx:176`-`184`. Recommendation: keep those panels, but make the launch verdict the first glance item in each bot card: status pill, disabled live-start badge/button, no exchange ping/provider probe, and the exact blocker that prevents launch review. Target part: admin UX hierarchy.

5. Severity P2 - Settings/setup/source and statistics surfaces already define the product truth the admin mirror should reuse. Evidence: settings passes config source, exchange key state, Legacy provider state, and settings readiness rows into source/readiness panels at `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:285`-`320`; setup does the same for onboarding and review at `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:296`-`312` and `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:596`-`602`; statistics has an admin mirror row and live boundary at `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:76`-`84` and `apps/web/src/features/bots/BotStatisticsCommandCenter.tsx:113`; Legacy operational stats require mapped provider pub_id plus worker snapshot at `apps/web/src/features/bots/statistics-panels.tsx:479`-`489`. Recommendation: admin launch readiness should show the same six conceptual layers: access, exchange key or provider pub_id, settings source, runtime snapshot, statistics, and live control. Add Legacy stage/provider context only from safe summaries; do not expose raw config, raw provider ids, sealed secrets, or live-apply credentials. Target part: admin product copy and readiness row composition.

6. Severity P2 - Existing tests will need deliberate updates because the current admin e2e treats any `Start bot` wording/button as forbidden, while user launch readiness intentionally uses a disabled start button. Evidence: user dashboard e2e expects `Launch readiness command center`, `live start disabled`, `no exchange ping`, and disabled `Start bot unavailable` at `tests/e2e/bot-readiness-map.spec.ts:24`-`29`; admin e2e hidden markers include `Start bot`, `Stop bot`, `Test connection`, and `Connection verified` at `tests/e2e/admin-user-bot-detail-db.spec.ts:157`-`162`, and it currently expects zero buttons matching `/start|stop|apply|test connection/i` at `tests/e2e/admin-user-bot-detail-db.spec.ts:226`-`228`. Static admin coverage asserts many read-only guardrails but no launch panel at `tests/integration/admin-user-bot-detail-static.test.ts:70`-`140`, while user static coverage locks the launch panel's no-live-control semantics at `tests/integration/bot-readiness-server-dto-static.test.ts:73`-`81`. Recommendation: add admin-specific static and DB-backed e2e expectations for the launch mirror, allowing only the exact disabled read-only affordance or a non-button badge, while keeping negative checks for forms, submit, `startBot`, `stopBot`, `applyConfig`, `fetch(`, provider calls, `apiKey`, `apiSecret`, `sealed`, and `Connection verified`. Target part: acceptance coverage.

## Decisions
- Treated this as a single read-only auditor lane for Phase 4.25, not an aggregate implementation phase. No N-agent audit claim is made.
- Did not edit code, tests, package metadata, migrations, runtime config, provider mappings, worker files, or deploy files.
- Did not launch or run background agents from this lane; no background agents remain open from this audit.
- Considered all existing dirty worktree files pre-existing. This audit changes only this handoff file.
- Recommended using shared readiness DTO/builder logic rather than bespoke React-only launch logic.
- Recommended admin-safe or stripped action links before reusing the user launch panel in a selected-user admin context.

## Risks
- The working tree was heavily dirty before this audit, including the exact admin/user bot surfaces inspected; line evidence reflects the current checkout at audit time.
- Directly mounting the user launch panel in admin could route the admin actor to self-service `/app/bots/...` pages instead of a selected user's read-only drilldown.
- Recomputing readiness in React would risk drifting from the user dashboard, settings, setup, cabinet, and static tests that already treat server-built readiness rows as the source of truth.
- A disabled `Start bot unavailable` affordance is product-useful but test-sensitive; current admin e2e forbids broad `Start bot` text/buttons.
- "Read-only ready" can be misread as live-start approval unless the panel keeps the live-start disabled and no exchange ping/provider probe copy visible.
- Legacy provider identity remains sensitive: admin launch readiness must keep provider pub_id scoped/masked and must not turn fleet diagnostics into user-owned evidence without the active mapping rules already present in the loader.

## Verification/tests
RUN:
- Read-only protocol/doc inspection: `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed handoff, latest Phase 4.24 aggregate, status/implemented/next docs.
- Read-only code and test inspection with `rg` and `Get-Content`.
- Read-only git state inspection: current branch is `codex/bot-analytics-settings-canary-20260603`; many modified/untracked files pre-existed this audit.

NOT RUN:
- `npm run lint`, `npm run typecheck`, `npm run typecheck -w @wtc/web`, `npm test`, focused Vitest, Next build, Playwright, visual evidence, and `node scripts/gates.mjs` were not run because this was a read-only UX/product audit with no code changes.
- `npm run e2e:admin-user-bots:db:managed:matrix` and DB-backed admin selected-user browser acceptance were not run because this audit did not start a disposable DB/browser harness.
- `npm run secret:scan` and `npm run governance:check` were not run in this auditor lane.
- Live bot start/stop/apply-config, exchange ping, provider probe, Legacy live DB read, worker tick/dev-worker/continuity commands, SSH/tmux/systemd/nginx, deploy, and production/canary checks were not run by explicit scope and safety policy.

No gate is claimed green from this session.

## Next actions
1. Add admin-selected-user readiness data to `AdminUserBotSummary`, preferably by shared server-side readiness builder logic, with an admin surface that can strip/rewrite unsafe action links.
2. Add an admin read-only launch-readiness mirror per bot card above `Selected-user evidence ladder`; it should expose the same verdict, counts, rows, and disabled live-start boundary as the user dashboard.
3. Keep admin launch CTAs non-mutating: local anchors, admin-safe read-only links, disabled exact affordance, or badge-only status. No forms, submits, server actions, provider probes, exchange pings, or live bot controls.
4. Update static and DB-backed e2e tests to assert the admin launch mirror while preserving all no-secret/no-live-control negative checks.
5. After implementation, run focused static/admin loader tests, web typecheck, DB-backed admin-user bot e2e if authorized, secret scan, governance check, and `git diff --check`.
