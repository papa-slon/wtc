# Phase 4.44 admin worker continuity freshness handoff
## Scope
No-env runtime-safety implementation phase for the WTC bot/admin surfaces. The goal was to close the Phase 4.44 P1 gap found by the runtime/safety lane: `/admin/bots` could previously show green worker continuity from an old `target='worker'` row if its saved status/detail were `ok`. This phase makes the admin fleet worker proof freshness-aware without managed DB env, live provider probes, exchange pings, deploy, or live bot control.

Read-only lanes launched before implementation and closed before this aggregate:
- [bot-final-gap-product-ux-auditor](20260605-0215-bot-final-gap-product-ux-auditor.md)
- [bot-final-gap-runtime-safety-auditor](20260605-0215-bot-final-gap-runtime-safety-auditor.md)
- [bot-final-gap-tests-gates-auditor](20260605-0215-bot-final-gap-tests-gates-auditor.md)

## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0145-phase-4-43-admin-readonly-labels.md`
- `docs/handoffs/20260605-0215-bot-final-gap-product-ux-auditor.md`
- `docs/handoffs/20260605-0215-bot-final-gap-runtime-safety-auditor.md`
- `docs/handoffs/20260605-0215-bot-final-gap-tests-gates-auditor.md`
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/settings/page.tsx`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`

## Files changed
- `apps/web/src/features/admin/types.ts`
- `apps/web/src/features/admin/bot-health-loader.ts`
- `apps/web/src/app/admin/bots/page.tsx`
- `tests/integration/admin-bot-health-loader.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md`

## Findings
1. Severity P1 - Admin fleet worker continuity needed a freshness gate before green status. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:24` now defines the 180-second admin stale window; `apps/web/src/features/admin/bot-health-loader.ts:76` computes `freshness` from row age; `apps/web/src/app/admin/bots/page.tsx:82` keeps stale rows at attention instead of green. Recommendation: keep the stale-row check before any `ok` pill logic and do not use stale persisted rows as current bot-continuity proof. Target part: `/admin/bots` worker continuity pill and acceptance gate.
2. Severity P1 - Admin evidence needed to show row age, not only the saved worker tuple. Evidence: `apps/web/src/app/admin/bots/page.tsx:105`-`106` formats the freshness summary; `apps/web/src/app/admin/bots/page.tsx:152`, `312`, and `363` include freshness in the gate, metric, and evidence ladder; `apps/web/src/app/admin/bots/page.tsx:551`-`578` renders the Worker bot continuity Freshness metric and explicit stale-row copy. Recommendation: keep age/freshness visible wherever the worker tuple is used as proof. Target part: admin fleet evidence ladder and Worker bot continuity card.
3. Severity P2 - Setup/settings pages should remain configuration/readiness surfaces, not aggregate worker proof surfaces. Evidence: `tests/integration/bot-read-safety-static.test.ts:99` and `110` now assert setup/settings continue to call readiness with `includeOperationalRows: false`. Recommendation: keep operational worker proof on dashboard/safety/admin evidence pages until a separately audited UX says otherwise. Target part: user setup/settings no-fake-green boundary.
4. Severity P2 - Freshness logic needed deterministic testability. Evidence: `apps/web/src/features/admin/bot-health-loader.ts:347` exposes an optional `now`; `tests/integration/admin-bot-health-loader.test.ts:498` and `521` prove a stale stored `ok` worker row is projected as `freshness: 'stale'`. Recommendation: use injected time in loader tests whenever acceptance depends on row age. Target part: admin DB loader regression coverage.

## Decisions
- Implemented the runtime/safety P1 slice before the product/UX finish board because it directly reduces silent-stop false confidence.
- Used the same 3-minute freshness window already used by selected-user admin worker detail.
- Kept the phase no-env and read-only from a runtime perspective: no worker tick during render, no provider/journal probe during render, no exchange ping, no live bot start/stop/apply-config.
- Deferred the product/UX finish board on `/app/bots` and the worker in-flight tick guard to follow-up slices.

## Risks
- The worktree was heavily dirty before this phase; unrelated modified and untracked files remain and were not normalized.
- This phase proves that stale persisted worker evidence does not render green in local/admin UI. It does not prove managed worker continuity against a real throwaway Postgres database.
- The admin stale window is local UI policy. Production monitoring still needs external worker/process supervision and managed DB proof.
- No rendered Playwright pass was run for this specific freshness slice; current proof is loader/static/type/security.

## Verification/tests
RUN:
1. `git status --short --branch` - confirmed current branch and pre-existing dirty tree before edits.
2. Read-only `rg`/`Get-Content` inspections of the Phase 4.43 aggregate, Phase 4.44 read-only handoffs, admin loader/types/page, setup/settings readiness calls, and focused tests.
3. `npx vitest run tests/integration/admin-bot-health-loader.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts` - PASS, 3 files, 45 tests.
4. `npm run typecheck -- --pretty false` - PASS.
5. `npm run secret:scan` - PASS.
6. `npm run governance:check` - PASS, 0 errors, 1 known historical warning.
7. `git diff --check` - PASS.

NOT RUN:
1. `npm run accept:bots:local` - not run for this narrow freshness slice; latest canonical local acceptance stayed documented from Phase 4.42.
2. `npm run accept:bots:rendered` - not run; no rendered UI assertions changed in this slice.
3. `npm run accept:bots:continuity:contract` - not run; product continuity contract semantics were unchanged.
4. `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` was not supplied.
5. `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied.
6. Legacy closed-trade source proof, live provider/exchange probes, live bot start/stop/apply-config, deploy/canary publish, GitHub CI, SSH/systemd/tmux, and production monitoring - not run by safety scope.

## Next actions
1. If no managed DB env is available, implement the product/UX finish-board slice on `/app/bots` so users see the two-bot completion path from the first bot screen.
2. Add a small no-env worker tick in-flight guard so a slow DB tick cannot overlap the next interval and muddy heartbeat meaning.
3. When throwaway DB env is available, run `npm run accept:worker:continuity:managed` and `npm run e2e:admin-user-bots:db:managed:matrix`.
4. Keep Legacy closed-trade analytics pending until a real source-proof artifact names a durable closed-trade/fill table or API.
