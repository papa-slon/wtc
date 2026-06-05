# bot-continuity-web-product-auditor handoff
## Scope
Read-only Phase 4.26 web/product audit of bot continuity and launch-readiness UX for user and admin surfaces. The audit inspected dashboard, settings, setup, statistics, selected-user admin bot detail, shared continuity/readiness/operation panels, admin runtime evidence, readiness DTOs/loaders, and relevant static/browser tests. No code, tests, config, migrations, live bot control, provider probes, exchange probes, SSH, tmux, systemd, deploy, or worker ticks were changed or run.

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/STATUS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/NEXT_ACTIONS.md`
- `docs/handoffs/20260604-1145-phase-4-12-bot-continuity-monitor.md`
- `docs/handoffs/20260604-1205-phase-4-13-worker-bot-continuity-proof.md`
- `docs/handoffs/20260604-1243-phase-4-14-admin-health-consumption.md`
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md`
- `docs/handoffs/20260604-1621-phase-4-22-bot-statistics-admin-command-center.md`
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`
- `docs/handoffs/20260604-1724-phase-4-25-admin-launch-readiness-mirror.md`
- `apps/web/src/app/(app)/app/bots/[bot]/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/app/(app)/app/bots/statistics/page.tsx`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `apps/web/src/features/bots/BotContinuityPanel.tsx`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/features/bots/BotReadinessMap.tsx`
- `apps/web/src/features/bots/BotOperationMapPanel.tsx`
- `apps/web/src/features/bots/continuity.ts`
- `apps/web/src/features/bots/readiness.ts`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/admin/AdminBotRuntimeEvidencePanel.tsx`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/features/admin/user-bot-detail-loader.ts`
- `apps/web/src/features/admin/types.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-readiness-server-dto-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/e2e/bot-readiness-map.spec.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`

## Files changed
- `docs/handoffs/20260604-1729-bot-continuity-web-product-auditor.md` - this handoff only.
- None - read-only audit for code, tests, config, and migrations.

## Findings
1. Severity P1 - Continuity state is visible in the right user places and uses the correct read-only framing. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:170` mounts `BotReadinessMap`, `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:175` mounts `BotLaunchReadinessPanel`, and `apps/web/src/app/(app)/app/bots/[bot]/page.tsx:177` mounts `BotContinuityPanel` on the bot dashboard; `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:323`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:314`, and `apps/web/src/app/(app)/app/bots/statistics/page.tsx:353` mount continuity on settings, setup, and statistics. Recommendation: preserve this placement order and keep continuity before deeper evidence/stat tables when future layout work happens. Target part: user bot dashboard/settings/setup/statistics.
2. Severity P1 - Launch readiness does include explicit worker heartbeat freshness now, and the loader feeds the required scalar health fields. Evidence: `apps/web/src/features/bots/readiness.ts:91` builds `workerHeartbeatItem`, `apps/web/src/features/bots/readiness.ts:105` labels it `Worker heartbeat`, `apps/web/src/features/bots/readiness.ts:107`-`116` renders fresh/no-heartbeat/needs-review copy, `apps/web/src/features/bots/readiness.ts:254`-`255` inserts it before runtime/statistics rows, and `apps/web/src/features/bots/readiness-loader.ts:105`-`107` passes `processAlive`, `lastSyncAt`, and `staleDataSeconds`. Recommendation: treat this as a non-negotiable launch gate and keep tests asserting the freshness value, not only the row label. Target part: readiness DTO and launch readiness panel.
3. Severity P2 - Admin selected-user launch readiness has the worker heartbeat row, but its heartbeat/evidence anchors land on a statistics-scope grid rather than the actual evidence ladder. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:340`-`350` defines `Worker heartbeat` with `href: #...-runtime`, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:352`-`357` sends `Runtime snapshot` to the same anchor, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:549`-`555` renders the selected-user evidence ladder without an anchor, while `apps/web/src/app/admin/users/[userId]/bots/page.tsx:737`-`742` defines `#...-runtime` on a grid of open positions, trades, equity snapshots, and stats scope. Recommendation: move the runtime anchor to the evidence ladder or add a new `#...-runtime-health` anchor around the runtime-health evidence; update static and DB E2E tests to click `Review heartbeat` and assert it lands near `Runtime health`/worker freshness. Target part: admin selected-user anchor polish.
4. Severity P2 - Admin selected-user top command center summarizes runtime attention but not aggregate worker-heartbeat freshness, so admins must inspect each bot card to know whether continuity is fresh. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:441`-`447` top metrics are access, scoped statistics, runtime attention, and admin boundary; `apps/web/src/app/admin/users/[userId]/bots/page.tsx:177`-`183` row evidence lists runtime labels but no freshness count; per-bot freshness exists later at `apps/web/src/app/admin/users/[userId]/bots/page.tsx:340`-`347`. Recommendation: add a top metric/row such as `Worker heartbeat freshness: 2/2 fresh` or `1 stale / 1 missing`, linking to the per-bot heartbeat rows. Target part: admin selected-user summary command center.
5. Severity P2 - Settings/setup continuity copy tells users to open dashboard or safety for worker proof, but the continuity component has no inline action link. Evidence: `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx:255`-`258` says to open dashboard or safety; `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:253`-`256` says to open dashboard or safety; `apps/web/src/features/bots/BotContinuityPanel.tsx:95`-`98` ends with explanatory copy only. Recommendation: add optional CTA props to `BotContinuityPanel` or page-level links like `Open dashboard` and `Open safety` on settings/setup continuity blocks. Target part: user settings/setup continuity navigation.
6. Severity P2 - The launch-readiness table carries heartbeat freshness, but the top scan cards do not. Evidence: `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:84`-`88` top metrics are launch decision, ready layers, needs attention, and blocked layers; the heartbeat is only in the item table at `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:91`-`117`. Recommendation: promote the worker heartbeat item into a small top metric or pill so a user/admin can see freshness before reading the full table. Target part: launch-readiness scanability.

## Decisions
- Treated continuity and launch readiness as read-only product evidence, not operational control.
- Did not recommend live start/stop/apply-config, live exchange ping, provider probes, or worker tick execution.
- Considered current user-surface placement broadly correct; recommendations are focused on scanability and anchor precision.
- Kept admin fleet `/admin/bots` separate from selected-user `/admin/users/[userId]/bots`: the fleet page already has a `Worker bot continuity` card, while the selected-user page needs better aggregate freshness and anchor targeting.

## Risks
- The worktree was already heavily dirty and untracked before this audit; this handoff certifies only read-only observations from the current files inspected.
- Other agents or phases may still be moving files in this checkout, so line evidence should be rechecked before implementation.
- Focused tests were run, but no browser, DB-managed, full-suite, worker, or deploy gates were run in this audit lane.
- The audit found polish/test-follow-up items, not a live-control safety regression.

## Verification/tests
RUN:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603` with many pre-existing modified and untracked files.
- Protocol/doc reads - `AGENTS.md`, `docs/SESSION_PROTOCOL.md`, seed/status/implemented/next-action docs, and relevant Phase 4 handoffs inspected.
- `rg` and line-numbered file reads over the requested user/admin pages, components, loaders/DTOs, and tests.
- `npx vitest run tests/integration/bot-readiness-builder.test.ts` - PASS, 1 file / 9 tests.
- `npx vitest run tests/integration/bot-readiness-builder.test.ts tests/integration/bot-readiness-server-dto-static.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS, 3 files / 20 tests.

NOT RUN:
- `npm run e2e:admin-user-bots:db:managed`, `npm run e2e:admin-user-bots:db:managed:matrix`, and DB-backed Playwright - NOT RUN; this read-only audit had no disposable Postgres authorization.
- `npm run accept:worker:continuity`, worker tick/smoke/dev-worker commands - NOT RUN; these mutate or execute worker continuity paths and were outside scope.
- Full `npm test`, full Playwright, build, deploy, SSH, tmux, systemd, live bot start/stop/apply-config, exchange/provider probes - NOT RUN by audit scope.
- One attempted `npx vitest run tests/integration/bot-readiness-builder.test.ts --runInBand` did not execute tests because Vitest rejects `--runInBand`; it was rerun without that flag and passed.

## Next actions
1. Fix selected-user admin anchor targeting so `Review heartbeat` lands on runtime-health/worker freshness evidence, then update static and DB E2E coverage for the click target.
2. Add selected-user aggregate worker-heartbeat freshness to the top admin command center.
3. Add direct dashboard/safety CTAs to settings/setup continuity blocks.
4. Consider promoting worker heartbeat freshness into the launch-readiness top metric row while keeping the detailed table row.
5. Keep live bot control, provider probes, exchange pings, worker ticks, and deploy work out of these UX polish changes unless a separate audited phase explicitly authorizes them.
