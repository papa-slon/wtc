# Phase 4.45 two-bot finish board handoff

## Scope
Close the next no-env product-clarity gap for the Legacy/Tortila bot workbench by making `/app/bots` a user-facing
completion map instead of only a bot list plus portfolio summary. The page must summarize, per bot, settings, setup,
worker continuity, statistics, and live-control boundaries, with direct navigation into the existing settings/setup/dashboard
and statistics pages. This phase is UI/read-model only: no provider probes, no exchange-key tests, no live start/stop/apply,
and no admin-only user data.

Read-only phase handoffs:
- [20260605-0305-two-bot-finish-board-ux-auditor.md](20260605-0305-two-bot-finish-board-ux-auditor.md)
- [20260605-0305-two-bot-finish-board-safety-auditor.md](20260605-0305-two-bot-finish-board-safety-auditor.md)
- [20260605-0305-two-bot-finish-board-tests-auditor.md](20260605-0305-two-bot-finish-board-tests-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0215-phase-4-44-admin-worker-continuity-freshness.md`
- [20260605-0305-two-bot-finish-board-ux-auditor.md](20260605-0305-two-bot-finish-board-ux-auditor.md)
- [20260605-0305-two-bot-finish-board-safety-auditor.md](20260605-0305-two-bot-finish-board-safety-auditor.md)
- [20260605-0305-two-bot-finish-board-tests-auditor.md](20260605-0305-two-bot-finish-board-tests-auditor.md)
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `apps/web/src/features/bots/readiness-loader.ts`
- `apps/web/src/features/bots/readiness.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/bot-readiness-builder.test.ts`
- `tests/integration/bot-statistics-completion.test.ts`
- `tests/e2e/smoke.spec.ts`

## Files changed
- `apps/web/src/app/(app)/app/bots/page.tsx`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/e2e/smoke.spec.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0305-phase-4-45-two-bot-finish-board.md`

## Findings
1. Severity P1 - `/app/bots` lacked a first-screen finish map tying together the already-built settings, setup, worker,
   statistics, and no-live boundaries. Evidence: `apps/web/src/app/(app)/app/bots/page.tsx:90` now renders `Two-bot finish
   board`; `apps/web/src/app/(app)/app/bots/page.tsx:110` renders per-bot `Legacy finish path` / `Tortila finish path`;
   `apps/web/src/app/(app)/app/bots/page.tsx:126` links into setup review; `apps/web/src/app/(app)/app/bots/page.tsx:170`
   states live controls are disabled. Recommendation: keep `/app/bots` as the cabinet-level operator map until a separately
   audited live-control workflow exists. Target part: user bot overview.
2. Severity P1 - The finish map needed to be user-scoped and safe, not an admin or provider adapter shortcut. Evidence:
   `apps/web/src/app/(app)/app/bots/page.tsx:10` imports `loadBotReadinessForUser`; `apps/web/src/app/(app)/app/bots/page.tsx:54`
   calls it with existing access/read data and `includeOperationalRows: true`; `tests/integration/bot-read-safety-static.test.ts:85`
   adds a static safety test that forbids admin imports, direct adapter calls, live-control verbs, raw secret fields, provider
   URLs, and fake "Connection verified" copy. Recommendation: keep exchange-key testing and live-control probes out of this
   page until bot-integration and security audits approve them. Target part: safety boundary.
3. Severity P2 - The new board needed rendered proof, not only source-string proof. Evidence:
   `tests/e2e/smoke.spec.ts:105` checks the board renders; `tests/e2e/smoke.spec.ts:112` and `tests/e2e/smoke.spec.ts:113`
   assert the two settings CTAs; `tests/e2e/smoke.spec.ts:116` and `tests/e2e/smoke.spec.ts:117` assert the setup-review
   links; `tests/e2e/smoke.spec.ts:108` checks the no-live-control copy. Recommendation: keep the focused smoke assertion
   in place and include it in rendered bot/admin acceptance when this branch is promoted. Target part: rendered acceptance.

## Decisions
1. Use `loadBotReadinessForUser` and the existing user bot read model rather than building a new bot-overview DTO.
2. Show operational worker rows on `/app/bots` because the cabinet overview is the right place for continuity evidence;
   keep setup/settings pages free of worker-operational rows.
3. Add navigation and evidence copy only. Do not add exchange key retest, provider probe, live start/stop/apply, or admin
   selected-user controls in this user surface.
4. Keep the existing combined portfolio summary below the new board so the page remains analytical after the completion map.

## Risks
1. Managed worker continuity was not run in this phase because `WORKER_CONTINUITY_ADMIN_DATABASE_URL` was not supplied.
2. Selected-user admin DB matrix was not run in this phase because `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was not supplied.
3. Legacy closed-trade import is still blocked by source proof; this phase does not prove a durable Legacy closed-trade/fill
   source.
4. Live exchange ping and live bot control remain disabled and were intentionally not implemented.
5. This phase has focused rendered proof for `/app/bots`; a full rendered bot/admin pack should be rerun before promotion if
   the branch is staged or deployed.

## Verification/tests
RUN:
1. Branch/status inspection: `git status --short`; `git branch --show-current` -> branch
   `codex/bot-analytics-settings-canary-20260603` with a pre-existing broad dirty tree.
2. Read-only phase handoffs produced before edits:
   [20260605-0305-two-bot-finish-board-ux-auditor.md](20260605-0305-two-bot-finish-board-ux-auditor.md),
   [20260605-0305-two-bot-finish-board-safety-auditor.md](20260605-0305-two-bot-finish-board-safety-auditor.md), and
   [20260605-0305-two-bot-finish-board-tests-auditor.md](20260605-0305-two-bot-finish-board-tests-auditor.md).
3. `npx vitest run tests/integration/bot-read-safety-static.test.ts tests/integration/bot-readiness-builder.test.ts tests/integration/bot-statistics-completion.test.ts`
   -> PASS (`3` files, `41` tests).
4. `npm run typecheck -- --pretty false` -> PASS.
5. Initial broad `npx playwright test tests/e2e/smoke.spec.ts` on `E2E_PORT=3492` was stopped by a timeout after surfacing a
   strict-mode selector collision: `a[href="/app/bots/tortila/setup?step=key"]` matched both `Open setup review` and `Add key`.
   The assertion was repaired to use role-based setup-review links.
6. `$env:E2E_PORT='3492'; npx playwright test tests/e2e/smoke.spec.ts -g "bot dashboard sub-tabs render"` -> PASS (`2`
   tests, desktop/mobile).
7. In-app Browser sanity on local dev server `http://127.0.0.1:3493`: demo login reached `/app/bots`; DOM snapshot verified
   `Two-bot finish board`, `Tortila finish path`, `Legacy finish path`, the four primary settings/statistics links,
   `Worker heartbeat`, `Statistics`, `Live control`, and `Live controls disabled`; forbidden strings `startBot`, `stopBot`,
   `applyConfig`, and `Connection verified` were absent -> PASS. Browser screenshot capture was attempted but timed out in
   the in-app Browser CDP layer; rendered desktop/mobile visual proof remains covered by the Playwright smoke gate.
8. `npm run secret:scan` -> PASS.
9. `npm run governance:check` -> PASS (`0` errors, `1` known historical warning for
   `20260529-1921-integration-risk-auditor.md`).
10. `git diff --check` -> PASS.
11. `npm run typecheck -- --pretty false` was rerun after removing the transient `.next-browser-3493` dev-server include
    from generated Next type references -> PASS.
12. Completed background agents were closed after collecting results:
    `019e9424-18ae-74e1-b6eb-3f32431ac817`, `019e9424-8e84-71b0-a5e5-868b3cfd113f`, and
    `019e9424-ff25-7e82-aa41-f7fc40f9876f`.

NOT RUN:
1. `npm run accept:bots:local` - not rerun in this focused UI phase; latest known PASS remains Phase 4.42.
2. `npm run accept:bots:rendered` - not rerun in this focused UI phase; focused smoke was used for the changed `/app/bots`
   surface.
3. `npm run accept:worker:continuity:managed` - blocked by missing managed throwaway DB env.
4. `npm run e2e:admin-user-bots:db:managed:matrix` - blocked by missing managed throwaway DB env.
5. Legacy closed-trade import/source acceptance - blocked by missing durable Legacy source proof.
6. Live provider/exchange ping and live bot start/stop/apply-config - intentionally blocked by safety protocol.
7. Production deploy, canary switch, GitHub CI, and monitoring/burn-in - outside this no-env product-closure phase.

## Next actions
1. Keep or stop the local dev server on `http://localhost:3493` based on operator need; it was used only for browser sanity
   with mock adapters and live control disabled.
2. Next implementation phase should be the no-env worker in-flight guard unless the operator supplies managed DB env or a
   Legacy closed-trade source-proof artifact.
