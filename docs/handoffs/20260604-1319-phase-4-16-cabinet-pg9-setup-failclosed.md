# Phase 4.16 - cabinet PG9 setup fail-closed repair
## Scope
Repair the cabinet/setup PG9 blocker that kept Phase 4.15 `node scripts/gates.mjs core` red. This phase is a narrow bot setup safety repair: denied access during the setup wizard exchange-key metadata check now no-ops before metadata-check persistence, matching the existing fail-closed pattern and preventing a denied user from receiving a misleading key-check result. It also tightens tests around delegated bot config actions so save, preset, and system-default selection stay no-write when entitlement is denied.

Read-only agents launched before edits:
- [20260604-1309-cabinet-pg9-server-action-auditor.md](20260604-1309-cabinet-pg9-server-action-auditor.md)
- [20260604-1312-cabinet-setup-bot-scope-auditor.md](20260604-1312-cabinet-setup-bot-scope-auditor.md)
- [20260604-1312-cabinet-pg9-gates-auditor.md](20260604-1312-cabinet-pg9-gates-auditor.md)

All three background agents completed and were closed after their results were collected.

## Files inspected
- `tests/integration/cabinet-pg9.test.ts`
- `tests/integration/bot-config-action-handler.test.ts`
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx`
- `apps/web/src/features/bots/config-action-handler.ts`
- `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`
- `apps/web/src/features/cabinet/loader.ts`
- `packages/cabinet/src/derive.ts`
- `scripts/gates.mjs`
- `logs/gates/test.log`
- `docs/handoffs/20260604-1304-phase-4-15-admin-user-runtimehealth-e2e-harness.md`
- `docs/handoffs/20260604-1309-cabinet-pg9-server-action-auditor.md`
- `docs/handoffs/20260604-1312-cabinet-setup-bot-scope-auditor.md`
- `docs/handoffs/20260604-1312-cabinet-pg9-gates-auditor.md`

## Files changed
- `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx` - changed `wizardCheckExchangeKeyMetadata` denied-entitlement behavior from redirecting to `keyCheck=missing` to a silent no-op `return;`.
- `tests/integration/cabinet-pg9.test.ts` - updated the static PG9 guard to require two direct exchange-key fail-closed no-ops and to recognize the shared config-action handler as the fail-closed boundary for delegated config actions.
- `tests/integration/bot-config-action-handler.test.ts` - expanded denied-access coverage so custom save, preset apply, and system-default selection all no-op before parse/preset lookup/persist/select.
- `docs/handoffs/20260604-1309-cabinet-pg9-server-action-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1312-cabinet-setup-bot-scope-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1312-cabinet-pg9-gates-auditor.md` - read-only agent handoff.
- `docs/handoffs/20260604-1319-phase-4-16-cabinet-pg9-setup-failclosed.md` - this aggregate handoff.

## Findings
1. Severity P1 - evidence `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:147`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:148`, `tests/integration/cabinet-pg9.test.ts:111` - recommendation: keep denied entitlement as `return;` in `wizardCheckExchangeKeyMetadata`; target part: setup wizard metadata check. The old redirect shape was fail-closed for writes but could present denied access as a missing key.
2. Severity P1 - evidence `apps/web/src/features/bots/config-action-handler.ts:130`, `apps/web/src/features/bots/config-action-handler.ts:131`, `apps/web/src/features/bots/config-action-handler.ts:132`, `tests/integration/bot-config-action-handler.test.ts:306`, `tests/integration/bot-config-action-handler.test.ts:317`, `tests/integration/bot-config-action-handler.test.ts:324` - recommendation: keep config save/apply/system-default access checks centralized in `resolveActionContext`; target part: delegated bot config server actions. The new tests prove denied access does not parse config, look up presets, persist config, or select a system default.
3. Severity P1 - evidence `tests/integration/cabinet-pg9.test.ts:109`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:115`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:116`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:137`, `apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx:138` - recommendation: preserve CSRF-first ordering before `requireUser` for setup server actions; target part: bot setup action safety.
4. Severity P1 - evidence `tests/integration/cabinet-pg9.test.ts:113`, `tests/integration/cabinet-pg9.test.ts:116`, `apps/web/src/features/bots/ExchangeKeyReadiness.tsx`, `packages/db/src/repositories.ts` - recommendation: keep this as metadata-only WTC vault readiness, not a live exchange ping; target part: user-side key setup. This phase did not introduce exchange/provider calls or live connectivity claims.
5. Severity P1 - evidence `node scripts/gates.mjs core` result in this phase - recommendation: Phase 4.15's full-core blocker is closed; target part: local gate recovery. Core passed all 8 gates after the repair.

## Decisions
- Apply the minimal source fix recommended by the server-action and scope auditors: `wizardCheckExchangeKeyMetadata` denied access now returns before metadata-check persistence.
- Keep delegated config action checks in `config-action-handler` rather than duplicating access logic into every setup wrapper.
- Update PG9 static coverage to reflect the actual split: direct exchange-key actions have direct no-op guards; config actions delegate to the shared fail-closed helper.
- Do not touch cabinet loader/derive/card, DB schema/repositories, worker, live adapters, exchange connectivity, or admin bot drilldowns in this phase.

## Risks
- The worktree remains heavily dirty with many pre-existing modified/untracked files. This phase touched files that were already dirty, so review should focus on the exact lines above rather than treating the full file diff as solely this phase.
- This repair proves metadata-check and config-action fail-closed behavior; it does not prove real exchange connectivity, start/stop safety, live worker continuity, or DB-backed browser acceptance.
- Full Playwright/mobile was not run because the behavior change is server-action/access-path only; if rendered setup layout is later edited, rerun the PG9 mobile browser spec.

## Verification/tests
RUN:
- `npx vitest run tests/integration/cabinet-pg9.test.ts tests/integration/bot-config-action-handler.test.ts` - passed, 2 files / 33 tests.
- `npx eslint apps/web/src/app/(app)/app/bots/[bot]/setup/page.tsx tests/integration/cabinet-pg9.test.ts tests/integration/bot-config-action-handler.test.ts --max-warnings 0` - passed.
- `npm run typecheck -w @wtc/web` - passed.
- `git diff --check` - passed.
- `node scripts/gates.mjs core` - passed: governance, check:core, lint, typecheck, typecheck-web, secret:scan, test, and db:generate all green.

NOT RUN:
- `npx playwright test tests/e2e/cabinet-pg9-mobile.spec.ts --project=mobile` - skipped because no rendered layout/navigation change was made in this phase.
- `npm run e2e:admin-user-bots:db` - no explicit fresh throwaway `ADMIN_USER_BOTS_E2E_DATABASE_URL` was provided.
- `npm run e2e:admin-user-bots:db:managed` - no explicit `ADMIN_USER_BOTS_E2E_ADMIN_DATABASE_URL` was provided.
- `npm run accept:worker:continuity` - no explicit throwaway `DATABASE_URL` was provided.
- `npm run accept:real-pg:managed`, `npm run db:migrate`, `npm run db:seed`, full Playwright, production build, deploy, SSH/tmux/systemd, live bot start/stop/apply-config, exchange/provider calls, raw env reads, raw secret reads - skipped by scope and safety policy.

## Next actions
1. Continue the bot acceptance roadmap from Phase 4.15: build the selected-user browser matrix for fresh-green, stale, and missing runtimeHealth states without false greens from newer same-target health rows.
2. Run DB-backed admin-user bot E2E only when a disposable Postgres target is provided; otherwise keep it NOT RUN.
3. Run worker continuity only with an explicit throwaway `DATABASE_URL`; otherwise keep it NOT RUN.
4. Keep the setup wizard wording clear that metadata readiness is not a live exchange ping and not start-bot readiness.
