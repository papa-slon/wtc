# phase-4-25-admin-launch-readiness-mirror handoff
## Scope
Add the selected-user admin mirror for bot launch readiness after the Phase 4.24 user dashboard panel. This phase keeps `/admin/users/[userId]/bots` diagnostic-only: admins can inspect Tortila and Legacy readiness for a selected user, but cannot start, stop, apply config, test exchange/provider connectivity, edit user settings, edit provider mappings, or touch positions.

Linked auditor handoffs:
- [docs/handoffs/20260604-1715-admin-launch-readiness-ux-auditor.md](docs/handoffs/20260604-1715-admin-launch-readiness-ux-auditor.md)
- [docs/handoffs/20260604-1714-admin-launch-readiness-security-auditor.md](docs/handoffs/20260604-1714-admin-launch-readiness-security-auditor.md)
- [docs/handoffs/20260604-1714-admin-launch-readiness-gates-auditor.md](docs/handoffs/20260604-1714-admin-launch-readiness-gates-auditor.md)

## Files inspected
- `AGENTS.md`
- `docs/SESSION_PROTOCOL.md`
- `docs/handoffs/0000-orchestrator-seed.md`
- `docs/handoffs/20260604-1705-phase-4-24-bot-launch-readiness-command-center.md`
- `docs/handoffs/20260604-1715-admin-launch-readiness-ux-auditor.md`
- `docs/handoffs/20260604-1714-admin-launch-readiness-security-auditor.md`
- `docs/handoffs/20260604-1714-admin-launch-readiness-gates-auditor.md`
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx`
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx`
- `tests/integration/admin-user-bot-detail-static.test.ts`
- `tests/integration/bot-read-safety-static.test.ts`
- `tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts`
- `tests/e2e/admin-user-bot-detail-db.spec.ts`
- `tests/e2e/admin-mobile-pg8.spec.ts`
- `scripts/gates.mjs`

## Files changed
- `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx` - added admin-safe optional copy/link/control props while preserving the user dashboard defaults.
- `apps/web/src/app/admin/users/[userId]/bots/page.tsx` - added a per-bot read-only admin launch-readiness mirror fed from selected-user safe summary fields.
- `tests/integration/admin-user-bot-detail-static.test.ts` - locked the admin mirror, same-page anchors, no-live-probe label, scalar readiness helpers, and no live-control boundary.
- `tests/e2e/admin-user-bot-detail-db.spec.ts` - added DB-backed browser expectations for two admin mirrors and `no live probe`.
- `docs/handoffs/20260604-1715-admin-launch-readiness-ux-auditor.md` - read-only auditor handoff.
- `docs/handoffs/20260604-1714-admin-launch-readiness-security-auditor.md` - read-only auditor handoff.
- `docs/handoffs/20260604-1714-admin-launch-readiness-gates-auditor.md` - read-only auditor handoff.
- `docs/handoffs/20260604-1724-phase-4-25-admin-launch-readiness-mirror.md` - this aggregate handoff.

## Findings
1. Severity P1 - The admin selected-user bot page now shows the missing launch-readiness mirror without adding admin live controls. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:316` builds the readiness rows, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:521` sets `Admin launch readiness mirror`, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:528` sets `showDisabledControl={false}`. Recommendation: keep this mirror above runtime evidence so selected-user launch blockers are visible before diagnostic detail. Target part: `/admin/users/[userId]/bots`.
2. Severity P1 - The shared launch panel is now safe to reuse on admin surfaces because user-page defaults remain opt-in defaults, while admin can override copy, links, connection label, and disabled-control rendering. Evidence: `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:40` keeps the user title default, `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:48` keeps `no exchange ping` as the user default, `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:49` defaults `showDisabledControl` to true, and `apps/web/src/features/bots/BotLaunchReadinessPanel.tsx:123` renders the disabled control only when requested. Recommendation: use explicit props for every non-user surface. Target part: shared bot readiness UI.
3. Severity P1 - Admin readiness is derived from selected-user safe summary fields instead of provider probes, exchange pings, worker mutation, or raw runtime/config payloads. Evidence: `apps/web/src/app/admin/users/[userId]/bots/page.tsx:289` builds connection readiness, `apps/web/src/app/admin/users/[userId]/bots/page.tsx:316` assembles the rows, and `apps/web/src/app/admin/users/[userId]/bots/page.tsx:360` records `Admin start/apply/stop disabled`. Recommendation: keep future readiness refactors scalar-only on admin pages. Target part: admin DTO/UI boundary.
4. Severity P1 - Tests now lock the admin mirror and preserve the no-live-control acceptance shape. Evidence: `tests/integration/admin-user-bot-detail-static.test.ts:104` asserts the admin title, `tests/integration/admin-user-bot-detail-static.test.ts:106` asserts `no live probe`, `tests/integration/admin-user-bot-detail-static.test.ts:107` asserts hidden disabled control rendering, and `tests/e2e/admin-user-bot-detail-db.spec.ts:206`-`207` expects two rendered mirrors and two `no live probe` pills. Recommendation: run the DB-backed matrix with disposable Postgres authorization before claiming selected-user populated DB acceptance. Target part: test acceptance.

## Decisions
- Reused `BotLaunchReadinessPanel` rather than creating a parallel admin component, but added props so admin surfaces can strip user self-service assumptions.
- Hid the disabled start-labelled button on the admin page to preserve the existing "no start/stop/apply/test connection buttons" selected-user contract.
- Used same-page anchors for settings/statistics review instead of linking admins to `/app/bots/...` self-service routes.
- Built admin readiness rows from `AdminUserBotSummary` values already present on the page. No adapter calls, exchange pings, provider probes, worker ticks, route mutations, forms, or submit controls were added.

## Risks
- The worktree remains heavily dirty with many pre-existing modified and untracked files; this handoff certifies only the Phase 4.25 files listed above.
- The DB-backed selected-user matrix was not run in this phase, so populated Postgres ownership/leak proof remains pending.
- Worker continuity and live bot non-stop proof were outside this focused UI mirror phase and remain separate acceptance work.
- The initial implementation pass temporarily duplicated part of the admin bot card JSX; this was repaired before typecheck and focused tests were green.

## Verification/tests
RUN:
- `npm run typecheck -w @wtc/web` - PASS.
- `npx vitest run tests/integration/admin-user-bot-detail-static.test.ts tests/integration/bot-read-safety-static.test.ts tests/integration/admin-user-bot-detail-db-e2e-harness.test.ts` - PASS, 3 files / 39 tests.
- `E2E_PORT=3426 npx playwright test tests/e2e/admin-mobile-pg8.spec.ts --project=mobile` - PASS, 1 mobile layout test including `/admin/users/demo-user/bots`.
- `node scripts/gates.mjs quick` - PASS, 4 gates, 0 failing.
- `npm run secret:scan` - PASS.
- `npm run governance:check` - PASS before this aggregate, with 0 errors and 1 historical warning.
- `git diff --check` - PASS.
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - PASS inventory check, 103 image files, 0 blocked artifacts, 0 missing roots, 104 total artifact files, 0 dynamic markers.

NOT RUN / NOT GREEN:
- `npm run e2e:admin-user-bots:db:managed:matrix` - NOT RUN; requires explicit disposable Postgres/admin harness authorization.
- `npm run evidence:visual -- --manifest <manifest>` - NOT RUN; no formal visual manifest was promoted for this narrow mirror.
- Worker continuity gates such as `npm run worker:smoke`, `npm run worker:tick`, `npm run dev:worker`, and `npm run accept:worker:continuity` - NOT RUN; live/worker continuity is a separate authorized phase.
- Live bot start/stop/apply-config, live exchange ping, provider probe, deploy, SSH, tmux, systemd, preview/prod mutation - NOT RUN by safety scope.

## Next actions
1. Run `npm run governance:check` again after this aggregate handoff so Phase 4.25 is recognized by the governance gate.
2. With explicit disposable Postgres approval, run `npm run e2e:admin-user-bots:db:managed:matrix` to prove the selected-user mirror against populated DB scenarios.
3. Continue the broader bot completion plan with worker continuity proof and live/non-stop acceptance as a new phase; do not mix it into this admin UI mirror phase.
