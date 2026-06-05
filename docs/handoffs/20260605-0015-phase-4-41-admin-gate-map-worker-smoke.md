# Phase 4.41 admin gate map + worker smoke handoff
## Scope
Close the next no-env/local Legacy/Tortila completion gap after Phase 4.40 without touching live bots, provider sources,
managed databases, deploy, or user secrets.

This phase used three read-only agents before implementation:
- [ecosystem-tests-runner / platform auditor](20260605-0015-bot-continuity-next-gap-tests-auditor.md)
- [ecosystem-ux-ui-designer product auditor](20260605-0015-bot-settings-ux-next-gap-auditor.md)
- [ecosystem-bot-integration-auditor](20260605-0015-bot-integration-next-gap-auditor.md)

All three agent results were collected and the background agents were closed before this aggregate handoff.

## Files inspected
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260604-2335-phase-4-40-bot-admin-runner-safety-hardening.md`
- `docs/handoffs/20260605-0015-bot-continuity-next-gap-tests-auditor.md`
- `docs/handoffs/20260605-0015-bot-settings-ux-next-gap-auditor.md`
- `docs/handoffs/20260605-0015-bot-integration-next-gap-auditor.md`
- `apps/web/src/app/admin/bots/page.tsx`
- `scripts/gates.mjs`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`

## Files changed
- `apps/web/src/app/admin/bots/page.tsx`
- `scripts/gates.mjs`
- `tests/integration/admin-bot-completion-gate-map.test.ts`
- `tests/integration/bot-admin-acceptance-runner.test.ts`
- `docs/STATUS.md`
- `docs/NEXT_ACTIONS.md`
- `docs/IMPLEMENTED_FILES.md`
- `docs/handoffs/20260605-0015-phase-4-41-admin-gate-map-worker-smoke.md`

## Findings
1. Severity P1 - The local bot/admin acceptance command needed a worker heartbeat/safety bridge before browser proof.
   Evidence: `scripts/gates.mjs:19`, `scripts/gates.mjs:128`, `scripts/gates.mjs:129`, and `scripts/gates.mjs:169`.
   Recommendation: keep `worker-smoke` in `bot-admin-local` between `ci:local` and rendered bot/admin E2E. Target part:
   local acceptance runner.
2. Severity P1 - Admins needed a first-screen completion map that names what is locally green versus env/source/live blocked.
   Evidence: `apps/web/src/app/admin/bots/page.tsx:96`, `apps/web/src/app/admin/bots/page.tsx:112`,
   `apps/web/src/app/admin/bots/page.tsx:478`, and `apps/web/src/app/admin/bots/page.tsx:487`. Recommendation: keep the
   `/admin/bots` gate map as env-presence-only and never print DSNs/tokens. Target part: admin fleet readiness UI.
3. Severity P1 - Local UI must not imply live-control readiness. Evidence:
   `tests/integration/admin-bot-completion-gate-map.test.ts:21`,
   `tests/integration/bot-admin-acceptance-runner.test.ts:54`, and
   `tests/integration/bot-admin-acceptance-runner.test.ts:102`. Recommendation: keep live controls disabled until separate
   bot-integration and security approval exists. Target part: bot control safety boundary.
4. Severity P2 - The next no-env integration gap is a cheap two-bot continuity contract fixture, not managed DB proof.
   Evidence: [ecosystem-bot-integration-auditor handoff](20260605-0015-bot-integration-next-gap-auditor.md) findings 1-2.
   Recommendation: start a new Phase 4.42 for fixture/static continuity semantics if managed envs remain unavailable.
   Target part: worker/bot continuity contract.
5. Severity P2 - Admin entry-point action labels still have a small copy clarity gap. Evidence:
   [ecosystem-ux-ui-designer product auditor handoff](20260605-0015-bot-settings-ux-next-gap-auditor.md) findings 1-2.
   Recommendation: in a later narrow copy-only phase, rename admin drilldown buttons to explicitly say read-only. Target part:
   admin owner/user entry points.

## Decisions
- Added an admin-facing `Bot completion gate map` to `/admin/bots`.
- The map shows only env presence (`SET` / `NOT_SET`) and explicit command names, never env values.
- Added `worker-smoke` to `scripts/gates.mjs` and included it only in `bot-admin-local`, not the faster `bot-admin-e2e`
  rendered-only plan.
- Kept all managed/source/live/prod gates opt-in and not run because required envs were absent in this session.
- Did not implement Legacy closed-trade import; source proof remains blocked.
- Did not start, stop, apply config to, or probe either live bot.

## Risks
- `worker-smoke` proves the no-env worker memory tick path, not the managed tuple
  `worker_status=ok/bot_continuity=ok/tortila=ok/legacy=ok`.
- The admin gate map is a local operator map; it does not replace managed DB, source, deploy, or production monitoring proof.
- Legacy closed-trade analytics remain pending until a real source table/API proves stable trade id, close timestamp, realized
  PnL, fees, funding, and replay semantics.
- The worktree is still broad and dirty from earlier phases; this phase did not reconcile unrelated changes or certify a
  publishable commit.

## Verification/tests
RUN:
- Env-presence check for managed/source envs - all observed `NOT_SET` before implementation:
  `WORKER_CONTINUITY_ADMIN_DATABASE_URL`, `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL`, `REAL_POSTGRES_*`, `AUTH_E2E_*`,
  `LMS_E2E_*`, `AUDIT_APPEND_ONLY_*`, `LEGACY_DATABASE_URL`, `TORTILA_JOURNAL_URL`, and `JOURNAL_READ_TOKEN`.
- `npx vitest run tests/integration/admin-bot-completion-gate-map.test.ts` - PASS, 4 tests.
- `npm run typecheck -- --pretty false` - PASS after admin map.
- `npx vitest run tests/integration/admin-responsive.test.ts tests/integration/admin-user-bot-detail-static.test.ts` - PASS,
  53 tests.
- `git diff --check` - PASS after admin map.
- `npm run accept:bots:rendered` - PASS: `bot-admin-e2e` 65 passed on `E2E_PORT=3470`; visual inventory 107 images.
- `node --check scripts/gates.mjs` - PASS.
- `npx vitest run tests/integration/bot-admin-acceptance-runner.test.ts tests/integration/admin-bot-completion-gate-map.test.ts`
  - PASS, 8 tests.
- `npm run worker:smoke` - PASS: `[worker:tick] memory demo tick OK`.
- `npm run typecheck -- --pretty false` - PASS after runner change.
- Local refused-env check for bot/admin runner - PASS, no refused env present.
- `npm run accept:bots:local` - PASS, 4 gates:
  - `ci:local` PASS, metric `Generating static pages (36/36)`
  - `worker-smoke` PASS, metric `[worker:tick] memory demo tick OK`
  - `bot-admin-e2e` PASS, 65 passed on `E2E_PORT=3470`
  - `visual-inventory` PASS, 107 images
- Direct Playwright visual proof after Browser fallback:
  - `logs/visual-review-contact-sheets/20260605-0015-admin-gate-map/admin-bot-completion-gate-map-desktop.png`
  - `logs/visual-review-contact-sheets/20260605-0015-admin-gate-map/admin-bot-completion-gate-map-mobile.png`
  - `logs/visual-review-contact-sheets/20260605-0015-admin-gate-map/admin-bot-completion-gate-map-mobile-table.png`

NOT RUN:
- `npm run accept:worker:continuity:managed` - not run; `WORKER_CONTINUITY_ADMIN_DATABASE_URL` not supplied and this gate
  creates/drops a throwaway DB.
- `npm run e2e:admin-user-bots:db:managed:matrix` - not run; `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` not supplied and this
  gate creates/drops a throwaway DB.
- Legacy closed-trade source/importer proof - not run; source table/API still not proven.
- Provider/exchange probes, live exchange ping, live bot start/stop/apply-config, close-position, or live config mutation -
  not run by safety rule.
- Deploy/canary publish, GitHub CI for this dirty tree, SSH/systemd/tmux, production monitoring, and production burn-in -
  not run.

## Next actions
1. If no managed env is available, start a new Phase 4.42 for the local two-bot continuity contract fixture recommended by
   the bot-integration auditor.
2. If doing a small UX-only phase, rename admin entry-point drilldown labels to explicitly say read-only and update the
   relevant local assertions.
3. When `WORKER_CONTINUITY_ADMIN_DATABASE_URL` exists, run `npm run accept:worker:continuity:managed` in its own phase.
4. When `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` exists, run `npm run e2e:admin-user-bots:db:managed:matrix` in its own phase.
5. Keep Legacy closed-trade analytics blocked until a real source-proof contract is supplied.
